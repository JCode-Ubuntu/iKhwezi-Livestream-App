'use strict';

/**
 * Test harness: boots the modular parts of the backend (models, auth
 * middleware, groups, meetings, direct messages) against an in-memory SQLite
 * database and a real HTTP listener on an ephemeral port.
 *
 * It deliberately does NOT require backend/index.js (which opens the production
 * SQLite file and starts listening on PORT). Everything under test here is the
 * extracted module code that index.js itself mounts, so coverage is real.
 */

const express = require('express');
const http = require('http');
const { Sequelize, DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const { defineCoreModels } = require('../models');
const { buildAuthMiddleware } = require('../middleware/auth');

const JWT_SECRET = 'test_jwt_secret_test_jwt_secret_test_jwt_secret';
const ADMIN_KEY = 'test_admin_key_123';

function createFakeIo() {
  const emitted = [];
  const target = (rooms) => ({
    emit: (event, payload) => { emitted.push({ rooms, event, payload }); },
  });
  const io = {
    emitted,
    to: (room) => target([room]),
    emit: (event, payload) => { emitted.push({ rooms: ['*'], event, payload }); },
    use: () => {},
    on: () => {},
    reset: () => { emitted.length = 0; },
    find: (event) => emitted.filter((e) => e.event === event),
  };
  return io;
}

async function createHarness() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const core = defineCoreModels(sequelize, DataTypes);
  const { User, DirectMessage } = core;

  const auth = buildAuthMiddleware({ User, JWT_SECRET, ADMIN_KEY });
  const io = createFakeIo();
  const auditLog = [];
  const logAudit = async (action, details, ip) => { auditLog.push({ action, details, ip }); };
  const passthrough = (req, res, next) => next();

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const groups = require('../groups').mount({
    app, io, sequelize, User, DataTypes, Op,
    authenticate: auth.authenticate,
    requireRegistered: auth.requireRegistered,
    interactionRateLimit: passthrough,
    logAudit,
  });
  const meetings = require('../meetings').mount({
    app, io, sequelize, User, DataTypes,
    authenticate: auth.authenticate,
    requireRegistered: auth.requireRegistered,
    interactionRateLimit: passthrough,
    logAudit,
    groups,
  });
  require('../routes/messages').buildMessageRoutes({
    app, io, sequelize, Op, User, DirectMessage,
    authenticate: auth.authenticate,
    requireRegistered: auth.requireRegistered,
    interactionRateLimit: passthrough,
  });

  // Mirror the production tail: JSON 404 for unknown API paths + JSON errors.
  app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    res.status(err?.status || 500).json({ error: err?.status ? err.message : 'Internal server error' });
  });

  await sequelize.sync();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  let userSeq = 0;
  async function createUser(overrides = {}) {
    userSeq += 1;
    const username = overrides.username || `user${userSeq}`;
    const user = await User.create({
      username,
      displayName: overrides.displayName || username,
      email: overrides.email || `${username}@test.local`,
      password: await bcrypt.hash('pw', 4),
      isGuest: !!overrides.isGuest,
      isBanned: !!overrides.isBanned,
      isAdmin: !!overrides.isAdmin,
    });
    return { user, token: auth.signToken(user) };
  }

  async function api(method, path, { token, body, headers = {} } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : (body instanceof FormData ? body : JSON.stringify(body)),
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
  }

  return {
    app, server, base, sequelize, io, auditLog,
    models: { ...core, ...groups.models, ...meetings.models },
    groups, meetings, auth,
    createUser, api, close,
    JWT_SECRET, ADMIN_KEY,
  };
}

module.exports = { createHarness, JWT_SECRET, ADMIN_KEY };
