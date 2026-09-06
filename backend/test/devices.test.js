'use strict';

/**
 * Phase 3A — FCM device registry (Task 3, server side).
 *
 * Mirrors the production route pair from backend/index.js (POST/DELETE
 * /api/devices) against in-memory SQLite:
 *  - auth required (401 anonymous), registered only (403 guest),
 *  - upsert semantics: same (user, token) refreshes lastSeenAt, no dupes,
 *  - per-user cap (MAX 5) with stalest-first eviction,
 *  - delete-on-logout removes exactly the caller's row (idempotent),
 *  - FK cascade: destroying the user removes their devices,
 *  - cross-user isolation: one user can never see/remove another's token.
 */

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const { defineCoreModels } = require('../models');
const { buildAuthMiddleware } = require('../middleware/auth');

const JWT_SECRET = 'test_jwt_secret_test_jwt_secret_test_jwt_secret';
const ADMIN_KEY = 'test_admin_key_123';
const MAX_DEVICES_PER_USER = 5;

function buildRoutes(app, { Device, authenticate, requireRegistered, interactionRateLimit }) {
  app.post('/api/devices', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
    try {
      const { token, platform } = req.body || {};
      if (!token || typeof token !== 'string' || token.length < 20 || token.length > 512) {
        return res.status(400).json({ error: 'Valid device token required' });
      }
      const userId = req.user.id;
      const [device, created] = await Device.findOrCreate({
        where: { userId, token },
        defaults: { userId, token, platform: typeof platform === 'string' ? platform.slice(0, 32) : null },
      });
      if (!created) {
        await device.update({ lastSeenAt: new Date() });
      }
      const count = await Device.count({ where: { userId } });
      let evicted = 0;
      if (count > MAX_DEVICES_PER_USER) {
        const stale = await Device.findAll({
          where: { userId },
          order: [['lastSeenAt', 'ASC']],
          limit: count - MAX_DEVICES_PER_USER,
        });
        if (stale.length) {
          await Device.destroy({ where: { id: stale.map((d) => d.id) } });
          evicted = stale.length;
        }
      }
      return res.json({ registered: true, deviceId: device.id, evicted });
    } catch (err) {
      return res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.delete('/api/devices', authenticate, requireRegistered, async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Device token required' });
      }
      const destroyed = await Device.destroy({ where: { userId: req.user.id, token } });
      return res.json({ removed: destroyed > 0 });
    } catch (err) {
      return res.status(500).json({ error: 'Removal failed' });
    }
  });
}

async function boot() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const models = defineCoreModels(sequelize, DataTypes);
  const { User, Device } = models;
  await sequelize.sync();

  const auth = buildAuthMiddleware({ User, JWT_SECRET, ADMIN_KEY });
  const passthrough = (req, res, next) => next();

  const app = express();
  app.use(express.json());
  buildRoutes(app, { Device, authenticate: auth.authenticate, requireRegistered: auth.requireRegistered, interactionRateLimit: passthrough });
  app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  let seq = 0;
  async function mkUser(overrides = {}) {
    seq += 1;
    const username = overrides.username || `user${seq}`;
    const user = await User.create({
      username,
      displayName: username,
      email: `${username}@test.local`,
      password: await bcrypt.hash('pw', 4),
      isGuest: !!overrides.isGuest,
      role: overrides.role || 'user',
    });
    const token = auth.signToken(user);
    return { user, token };
  }

  async function api(method, path, { token, body, headers = {} } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }

  return { sequelize, models, User, Device, mkUser, api,
    async close() {
      await new Promise((r) => server.close(r));
      await sequelize.close();
    } };
}

const tok = (n) => `fcm-token-${String(n).padStart(8, '0')}-abcd1234wxyz`;

test('POST /api/devices requires auth and a registered (non-guest) account', async () => {
  const h = await boot();
  try {
    // Anonymous → 401.
    const anon = await h.api('POST', '/api/devices', { body: { token: tok(1) } });
    assert.equal(anon.status, 401);

    // Guest → 403 with the honest register-first message.
    const { token: guestToken } = await h.mkUser({ isGuest: true });
    const guest = await h.api('POST', '/api/devices', { token: guestToken, body: { token: tok(1) } });
    assert.equal(guest.status, 403);
    assert.equal(guest.data.error, 'Sign in to continue');

    // Registered → 200.
    const { token } = await h.mkUser();
    const ok = await h.api('POST', '/api/devices', { token, body: { token: tok(1), platform: 'android' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.registered, true);
  } finally {
    await h.close();
  }
});

test('upsert: re-registering the same token refreshes it instead of duplicating', async () => {
  const h = await boot();
  try {
    const { user, token } = await h.mkUser();
    const first = await h.api('POST', '/api/devices', { token, body: { token: tok(2) } });
    assert.equal(first.status, 200);
    const countAfterFirst = await h.Device.count({ where: { userId: user.id } });
    assert.equal(countAfterFirst, 1);

    // Space apart so lastSeenAt differs.
    await new Promise((r) => setTimeout(r, 20));
    const second = await h.api('POST', '/api/devices', { token, body: { token: tok(2) } });
    assert.equal(second.status, 200);
    const countAfterSecond = await h.Device.count({ where: { userId: user.id } });
    assert.equal(countAfterSecond, 1, 'upsert must not create a duplicate (userId, token) row');
  } finally {
    await h.close();
  }
});

test('validates token shape', async () => {
  const h = await boot();
  try {
    const { token } = await h.mkUser();
    const short = await h.api('POST', '/api/devices', { token, body: { token: 'tiny' } });
    assert.equal(short.status, 400);
    const missing = await h.api('POST', '/api/devices', { token, body: {} });
    assert.equal(missing.status, 400);
    const long = await h.api('POST', '/api/devices', { token, body: { token: 'x'.repeat(600) } });
    assert.equal(long.status, 400);
  } finally {
    await h.close();
  }
});

test('per-user cap: sixth device evicts the stalest, never another user\'s device', async () => {
  const h = await boot();
  try {
    const { user, token } = await h.mkUser();
    const { user: other } = await h.mkUser();
    await h.Device.create({ userId: other.id, token: 'belongs-to-other-user-0000001' });

    for (let i = 0; i < MAX_DEVICES_PER_USER; i++) {
      const res = await h.api('POST', '/api/devices', { token, body: { token: tok(i + 10) } });
      assert.equal(res.status, 200);
      await new Promise((r) => setTimeout(r, 15)); // distinct lastSeenAt ordering
    }
    assert.equal(await h.Device.count({ where: { userId: user.id } }), MAX_DEVICES_PER_USER);

    // Sixth device: oldest (tok(10)) is evicted.
    const sixth = await h.api('POST', '/api/devices', { token, body: { token: tok(99) } });
    assert.equal(sixth.status, 200);
    assert.equal(sixth.data.evicted, 1);
    assert.equal(await h.Device.count({ where: { userId: user.id } }), MAX_DEVICES_PER_USER);
    assert.equal(await h.Device.count({ where: { token: tok(10) } }), 0, 'stalest token must be evicted');
    assert.equal(await h.Device.count({ where: { token: tok(99) } }), 1);

    // Other user's device untouched.
    assert.equal(await h.Device.count({ where: { userId: other.id } }), 1);
  } finally {
    await h.close();
  }
});

test('DELETE /api/devices removes only the caller\'s row and is idempotent', async () => {
  const h = await boot();
  try {
    const { user, token } = await h.mkUser();
    const { token: otherToken } = await h.mkUser();
    await h.Device.create({ userId: user.id, token: tok(20) });
    await h.Device.create({ userId: user.id, token: tok(21) });

    // Remove one.
    const del = await h.api('DELETE', '/api/devices', { token, body: { token: tok(20) } });
    assert.equal(del.status, 200);
    assert.equal(del.data.removed, true);
    assert.equal(await h.Device.count({ where: { userId: user.id } }), 1);

    // Idempotent: deleting it again is 200/removed:false.
    const again = await h.api('DELETE', '/api/devices', { token, body: { token: tok(20) } });
    assert.equal(again.status, 200);
    assert.equal(again.data.removed, false);

    // Cross-user isolation: the other account cannot delete this user's tokens.
    const cross = await h.api('DELETE', '/api/devices', { token: otherToken, body: { token: tok(21) } });
    assert.equal(cross.status, 200);
    assert.equal(cross.data.removed, false);
    assert.equal(await h.Device.count({ where: { userId: user.id } }), 1);
    assert.equal(await h.Device.count({ where: { token: tok(21) } }), 1);
  } finally {
    await h.close();
  }
});

test('FK cascade: destroying a user removes their devices with them', async () => {
  const h = await boot();
  try {
    const { user, token } = await h.mkUser();
    const { user: survivor } = await h.mkUser();
    await h.api('POST', '/api/devices', { token, body: { token: tok(30) } });
    await h.Device.create({ userId: survivor.id, token: tok(31) });

    await user.destroy();

    assert.equal(await h.Device.count({ where: { token: tok(30) } }), 0);
    assert.equal(await h.Device.count({ where: { userId: survivor.id } }), 1);
  } finally {
    await h.close();
  }
});
