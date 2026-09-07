'use strict';

const test = require('node:test');
const assert = require('assert');
const { buildRequestContextMiddleware } = require('../middleware/requestContext');

test.describe('requestContext middleware (Phase 3B)', () => {
  function makeReq(path, headers = {}) {
    return {
      method: 'GET',
      path,
      originalUrl: path,
      headers,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      user: null,
    };
  }

  function makeRes() {
    const listeners = {};
    return {
      statusCode: 200,
      headers: {},
      getHeader: () => null,
      on: (event, fn) => { listeners[event] = fn; },
      removeListener: () => {},
      emit: (event) => { if (listeners[event]) listeners[event](); },
    };
  }

  test('assigns correlation id from header', (t, done) => {
    const logs = [];
    const logger = { info: (msg, extra) => logs.push({ msg, extra }), error: () => {}, warn: () => {}, debug: () => {} };
    const mw = buildRequestContextMiddleware({ logger, env: { NODE_ENV: 'development' } });
    const req = makeReq('/api/foo', { 'x-correlation-id': 'abc-123' });
    const res = makeRes();
    mw(req, res, () => {
      assert.strictEqual(req.id, 'abc-123');
      assert.ok(req.logger);
      res.emit('finish');
      assert.strictEqual(logs[0].extra.correlationId, 'abc-123', `got ${JSON.stringify(logs[0])}`);
      done();
    });
  });

  test('generates correlation id when header missing', (t, done) => {
    const mw = buildRequestContextMiddleware({ logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} }, env: { NODE_ENV: 'development' } });
    const req = makeReq('/api/foo');
    const res = makeRes();
    mw(req, res, () => {
      assert.ok(/^[0-9a-f-]{36}$/i.test(req.id));
      done();
    });
  });

  test('skips health logging in production by default', (t, done) => {
    const logs = [];
    const logger = { info: (msg, extra) => logs.push({ msg, extra }), error: () => {}, warn: () => {}, debug: () => {} };
    const mw = buildRequestContextMiddleware({ logger, env: { NODE_ENV: 'production' } });
    const req = makeReq('/api/health');
    const res = makeRes();
    mw(req, res, () => {
      res.emit('finish');
      assert.strictEqual(logs.length, 0);
      done();
    });
  });

  test('logs health when LOG_REQUESTS_HEALTH=true', (t, done) => {
    const logs = [];
    const logger = { info: (msg, extra) => logs.push({ msg, extra }), error: () => {}, warn: () => {}, debug: () => {} };
    const mw = buildRequestContextMiddleware({ logger, env: { NODE_ENV: 'production', LOG_REQUESTS_HEALTH: 'true' } });
    const req = makeReq('/api/health');
    const res = makeRes();
    mw(req, res, () => {
      res.emit('finish');
      assert.strictEqual(logs.length, 1);
      done();
    });
  });
});
