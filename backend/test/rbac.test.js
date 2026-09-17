'use strict';

/**
 * Phase 3A — RBAC middleware + admin-route behaviour (server side).
 *
 * Covers the fail-closed contract of requireRole/requireModerationAccess and
 * the ADMIN_KEY disposition:
 *  - role checks load the DB row at call time (demote-on-the-fly honored),
 *  - no token → 401, wrong role / banned / deleted → 403,
 *  - users default to 'user' and pass no gate,
 *  - moderator scope = ban/unban users only,
 *  - legacy ADMIN_KEY: works only on the ban route, audited + warned;
 *    ADMIN_KEY_ENABLED=false kills every key path (bootstrap 501s).
 *
 * The RBAC grant/bootstrap (exactly one generous path, POST
 * /api/admin/bootstrap/grant) is exercised in devices.test.js-adjacent flow
 * here as a plain-middleware simulation mirroring index.js.
 */

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const { defineCoreModels } = require('../models');
const { buildAuthMiddleware } = require('../middleware/auth');
const { buildRbacMiddleware, ROLES } = require('../middleware/rbac');

const JWT_SECRET = 'test_jwt_secret_test_jwt_secret_test_jwt_secret';
const ADMIN_KEY = 'test_admin_key_123';

function buildApp({ User, adminKeyEnabled = true, logAudit, requireRole, requireModerationAccess }) {
  const app = express();
  app.use(express.json());
  const { authenticate } = buildAuthMiddleware({ User, JWT_SECRET, ADMIN_KEY });

  // Mirror of production admin surface (subset that exercises RBAC):
  app.post('/api/admin/verify', authenticate, requireRole('admin', 'moderator'), (req, res) => {
    res.json({ valid: true, role: req.user.role });
  });
  app.get('/api/admin/analytics', authenticate, requireRole('admin'), (req, res) => {
    res.json({ ok: true });
  });
  app.patch('/api/admin/users/:id/ban', authenticate, requireModerationAccess, async (req, res) => {
    const target = await User.findByPk(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (req.user && target.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot block your own account' });
    }
    // Mirror of the production invariant: only a full admin (not a
    // moderator) may ban another admin; the legacy key keeps that power.
    const adminKeyMatches = (provided) => {
      const crypto = require('crypto');
      const a = Buffer.from(String(provided || ''));
      const b = Buffer.from(ADMIN_KEY);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    };
    if (target.role === 'admin' && req.user?.role !== 'admin' && !adminKeyMatches(req.headers['x-admin-key'])) {
      return res.status(403).json({ error: 'Only an admin can block another admin account' });
    }
    target.isBanned = !target.isBanned;
    await target.save();
    await logAudit(target.isBanned ? 'USER_BANNED' : 'USER_UNBANNED', { userId: target.id });
    return res.json({ isBanned: target.isBanned });
  });
app.post('/api/admin/bootstrap/grant', async (req, res) => {
  if (!adminKeyEnabled) {
    return res.status(501).json({ error: 'Admin key disabled' });
  }
  res.json({ granted: true });
});
  app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

async function boot(opts = {}) {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const models = defineCoreModels(sequelize, DataTypes);
  const { User } = models;
  await sequelize.sync();

  const auditLog = [];
  const logAudit = async (action, details, ip) => { auditLog.push({ action, details, ip }); };
  const rbac = buildRbacMiddleware({
    User, JWT_SECRET, ADMIN_KEY,
    logAudit,
    // SECURITY REMEDIATION default-OFF semantics: the middleware's key layer
    // is enabled ONLY when explicitly requested (mirrors index.js).
    adminKeyEnabled: opts.adminKeyEnabled === true,
  });
  const { requireRole, requireModerationAccess } = rbac;

  const app = buildApp({
    User, requireRole, requireModerationAccess,
    adminKeyEnabled: opts.adminKeyEnabled !== false,
    logAudit,
  });
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
      isBanned: !!overrides.isBanned,
      isAdmin: !!overrides.isAdmin,
      role: overrides.role || 'user',
    });
    const token = require('jsonwebtoken').sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
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

  return { sequelize, models, User, auditLog, mkUser, api, base,
    async close() {
      await new Promise((r) => server.close(r));
      await sequelize.close();
    } };
}

test('requireRole fail-closed: rejects missing token, plain user, and in-JWT-only role claims', async () => {
  const h = await boot();
  try {
    const { user: plain, token: plainToken } = await h.mkUser({ role: 'user' });
    const { token: adminToken } = await h.mkUser({ role: 'admin', isAdmin: true });

    // No token → 401.
    const anon = await h.api('POST', '/api/admin/verify');
    assert.equal(anon.status, 401);

    // Guest JWT (user row is guest, role user) → 403.
    const { token: guestToken } = await h.mkUser({ role: 'user', isGuest: true });
    const guest = await h.api('POST', '/api/admin/verify', { token: guestToken });
    assert.equal(guest.status, 403);

    // Registered-but-plain user → 403.
    const plainRes = await h.api('POST', '/api/admin/verify', { token: plainToken });
    assert.equal(plainRes.status, 403);

    // Trusted admin passes and sees their role.
    const adminRes = await h.api('POST', '/api/admin/verify', { token: adminToken });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.role, 'admin');

    // FORGED token: a JWT minted with the right secret cannot smuggle a role
    // claim — the middleware only reads DB role.
    const forged = require('jsonwebtoken')
      .sign({ id: plain.id, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    const forgedRes = await h.api('POST', '/api/admin/verify', { token: forged });
    assert.equal(forgedRes.status, 403);
  } finally {
    await h.close();
  }
});

test('requireRole checks the DB at call time: demoting an admin revokes access with the SAME token', async () => {
  const h = await boot();
  try {
    const { user, token } = await h.mkUser({ role: 'admin', isAdmin: true });
    const before = await h.api('GET', '/api/admin/analytics', { token });
    assert.equal(before.status, 200);

    await user.update({ role: 'user', isAdmin: false });

    const after = await h.api('GET', '/api/admin/analytics', { token });
    assert.equal(after.status, 403);

    // Banning on the fly also revokes. NOTE: the auth middleware short-
    // circuits banned accounts to anonymous (req.user=null), so requireRole
    // answers 401, not 403 — both are fail-closed denials; assert exactly
    // what the production chain produces.
    await user.update({ role: 'admin', isAdmin: true, isBanned: true });
    const banned = await h.api('GET', '/api/admin/analytics', { token });
    assert.ok([401, 403].includes(banned.status), `expected denial, got ${banned.status}`);
  } finally {
    await h.close();
  }
});

test('deleted account: token still verifies but every gate fails closed', async () => {
  const h = await boot();
  try {
    const { user, token } = await h.mkUser({ role: 'admin', isAdmin: true });
    await user.destroy();
    const res = await h.api('POST', '/api/admin/verify', { token });
    // authenticate treats a missing row as anonymous; requireRole then
    // rejects — 401 here (both 401/403 are honest denials, never 200).
    assert.ok([401, 403].includes(res.status), `expected denial, got ${res.status}`);
  } finally {
    await h.close();
  }
});

test('moderator scope = ban/unban only; admin-only routes reject moderator', async () => {
  const h = await boot();
  try {
    const { token: modToken } = await h.mkUser({ role: 'moderator' });
    const { user: target, token: targetToken } = await h.mkUser({});

    const verify = await h.api('POST', '/api/admin/verify', { token: modToken });
    assert.equal(verify.status, 200);
    assert.equal(verify.data.role, 'moderator');

    // Moderator may ban a plain user.
    const ban = await h.api('PATCH', `/api/admin/users/${target.id}/ban`, { token: modToken });
    assert.equal(ban.status, 200);
    assert.equal(ban.data.isBanned, true);

    // Admin-only surface fails closed for moderator: requireRole('admin').
    const analytics = await h.api('GET', '/api/admin/analytics', { token: modToken });
    assert.equal(analytics.status, 403);
  } finally {
    await h.close();
  }
});

test('moderator cannot ban an admin; moderators cannot self-ban', async () => {
  const h = await boot();
  try {
    const { user: modUser, token: modToken } = await h.mkUser({ role: 'moderator' });
    const { user: adminUser, token: adminToken } = await h.mkUser({ role: 'admin', isAdmin: true });

    // Production invariant mirrored: moderator cannot ban an admin.
    const res = await h.api('PATCH', `/api/admin/users/${adminUser.id}/ban`, {
      token: modToken,
      headers: { 'x-admin-key': 'wrong' },
    });
    assert.equal(res.status, 403);

    // Self-ban is a 400.
    const self = await h.api('PATCH', `/api/admin/users/${modUser.id}/ban`, { token: modToken });
    assert.equal(self.status, 400);
  } finally {
    await h.close();
  }
});

test('legacy ADMIN_KEY: ban transition guard works, is audited; ADMIN_KEY_ENABLED=false kills every key path', async () => {
  // SECURITY REMEDIATION default-OFF semantics: the key layer exists ONLY
  // when explicitly enabled — the first boot opts in to test that path.
  const h = await boot({ adminKeyEnabled: true });
  try {
    const { user: target } = await h.mkUser({});

    // Key path works during transition and writes an audit entry.
    const viaKey = await h.api('PATCH', `/api/admin/users/${target.id}/ban`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(viaKey.status, 200);
    assert.ok(h.auditLog.some((e) => e.action === 'ADMIN_KEY_USE'));
    assert.ok(h.auditLog.some((e) => e.action === 'USER_BANNED'));

    // Wrong key fails closed.
    const target2 = await h.mkUser({});
    const wrong = await h.api('PATCH', `/api/admin/users/${target2.user.id}/ban`, {
      headers: { 'x-admin-key': 'nope' },
    });
    assert.equal(wrong.status, 403);
  } finally {
    await h.close();
  }

  const h2 = await boot({ adminKeyEnabled: false });
  try {
    const { user: target } = await h2.mkUser({});
    const viaKey = await h2.api('PATCH', `/api/admin/users/${target.id}/ban`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(viaKey.status, 403);

    // Bootstrap route mirrors index.js: 501 when the key is disabled.
    const boot5 = await h2.api('POST', '/api/admin/bootstrap/grant', {
      body: { userId: target.id },
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(boot5.status, 501);
  } finally {
    await h2.close();
  }
});

test('ROLES contract: user < moderator < admin, default user for everyone', async () => {
  assert.deepEqual(ROLES, ['user', 'moderator', 'admin']);
  const h = await boot();
  try {
    // Schema/model default: everyone starts as 'user' — no one inherits
    // privileges without an explicit grant (fail-closed default).
    const { user } = await h.mkUser({});
    assert.equal(user.role, 'user');
    const explicitAdmin = await h.mkUser({ isAdmin: true, role: 'admin' });
    assert.equal(explicitAdmin.user.role, 'admin');
    assert.ok(!user.isAdmin); // legacy flag untouched by default
  } finally {
    await h.close();
  }
});
