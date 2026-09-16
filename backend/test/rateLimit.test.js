'use strict';

/**
 * Rate limiter tests (Redis-backed workstream).
 *
 * Covers both backends through the same public surface:
 *   - in-memory store (the default — identical to the original limiter)
 *   - Redis store (via a fake ioredis-compatible client; no network)
 *   - the fail-open path when Redis errors
 */

const test = require('node:test');
const assert = require('assert');

const {
  buildRateLimiterFactory,
  createInMemoryStore,
  createRedisStore,
} = require('../middleware/rateLimit');

/** Minimal fake ioredis client: in-script INCR/PEXPIRE over a Map. */
function createFakeRedis({ failMode = false } = {}) {
  const state = new Map();
  const calls = [];
  return {
    calls,
    async incr(key) {
      calls.push(['incr', key]);
      if (failMode) throw new Error('connection lost');
      const next = (state.get(key) || 0) + 1;
      state.set(key, next);
      return next;
    },
    async pexpire(key, ms) {
      calls.push(['pexpire', key, ms]);
      if (failMode) throw new Error('connection lost');
      return 1;
    },
    _state: state,
  };
}

function makeReq(path = '/api/x', ip = '1.2.3.4') {
  return { ip, path, socket: { remoteAddress: ip } };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    jsonDone: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) {
      this.body = payload;
      // Resolve the request-lifecycle promise on the response path too —
      // a 429 never calls next(), so tests must not hang waiting for it.
      this.jsonDone?.();
      return this;
    },
  };
  return res;
}

/** Run one request through the middleware; resolves when the middleware
 *  either calls next() or responds. */
function runLimit(limit, req, res) {
  return new Promise((resolve) => {
    res.jsonDone = resolve;
    limit(req, res, resolve);
  });
}

test.describe('rate limiter', () => {
  test('in-memory: blocks after max hits within the window (429 + message)', async () => {
    const { createRateLimiter, capabilities } = buildRateLimiterFactory({ env: {} });
    assert.equal(capabilities.backend, 'in-memory');
    assert.equal(capabilities.redis, false);

    const limit = createRateLimiter(60_000, 3, 'Slow down.');
    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      await runLimit(limit, makeReq(), res);
      assert.equal(res.statusCode, null, `request ${i + 1} should pass`);
    }
    const blocked = makeRes();
    await runLimit(limit, makeReq(), blocked);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.error, 'Slow down.');
  });

  test('in-memory: separate paths have separate counters', async () => {
    const { createRateLimiter } = buildRateLimiterFactory({ env: {} });
    const limit = createRateLimiter(60_000, 1, 'no');
    const r1 = makeRes();
    await runLimit(limit, makeReq('/a'), r1);
    assert.equal(r1.statusCode, null);
    const r2 = makeRes();
    await runLimit(limit, makeReq('/b'), r2);
    assert.equal(r2.statusCode, null, 'different path → fresh bucket');
  });

  test('in-memory: same key passes again after the window elapses', async () => {
    // windowMs of 0 → every hit starts a new window (window = now - 0, and
    // previous hits at the same ms are filtered only if strictly older).
    const { createRateLimiter } = buildRateLimiterFactory({ env: {} });
    const limit = createRateLimiter(0, 1, 'no');
    const first = makeRes();
    await runLimit(limit, makeReq(), first);
    assert.equal(first.statusCode, null);
    // Force a later "now" by monkey-patching Date.now for the second hit.
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = () => t0 + 5;
    try {
      const second = makeRes();
      await runLimit(limit, makeReq(), second);
      assert.equal(second.statusCode, null, 'window elapsed → allowed');
    } finally {
      Date.now = realNow;
    }
  });

  test('redis: shared counters across limiter instances via the client', async () => {
    const redis = createFakeRedis();
    const { createRateLimiter, capabilities } = buildRateLimiterFactory({
      env: { REDIS_URL: 'redis://localhost:6379' },
      redisClient: redis,
    });
    assert.equal(capabilities.backend, 'redis');
    assert.equal(capabilities.redis, true);

    const limit = createRateLimiter(60_000, 2, 'too many');
    for (let i = 0; i < 2; i++) {
      const res = makeRes();
      await runLimit(limit, makeReq(), res);
      assert.equal(res.statusCode, null);
    }
    const blocked = makeRes();
    await runLimit(limit, makeReq(), blocked);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.error, 'too many');
    // INCR was used (atomic counter), and PEXPIRE fired on the first hit.
    assert.ok(redis.calls.some(([op]) => op === 'incr'));
    assert.ok(redis.calls.some(([op]) => op === 'pexpire'));
  });

  test('redis: keys are bucketed per window (fixed window)', async () => {
    const redis = createFakeRedis();
    const { createRateLimiter } = buildRateLimiterFactory({
      env: { REDIS_URL: 'redis://localhost:6379' },
      redisClient: redis,
    });
    const limit = createRateLimiter(10_000, 1, 'no');
    const first = makeRes();
    await runLimit(limit, makeReq(), first);
    assert.equal(first.statusCode, null);

    // Advance into the next window bucket.
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = () => t0 + 20_000;
    try {
      const second = makeRes();
      await runLimit(limit, makeReq(), second);
      assert.equal(second.statusCode, null, 'new window bucket → fresh counter');
    } finally {
      Date.now = realNow;
    }
  });

  test('redis: failure falls back to the in-memory store (no 500, still limits)', async () => {
    const redis = createFakeRedis({ failMode: true });
    const warnings = [];
    const { createRateLimiter } = buildRateLimiterFactory({
      env: { REDIS_URL: 'redis://localhost:6379' },
      redisClient: redis,
      log: { warn: (m) => warnings.push(m) },
    });
    const limit = createRateLimiter(60_000, 2, 'fallback cap');
    for (let i = 0; i < 2; i++) {
      const res = makeRes();
      await runLimit(limit, makeReq(), res);
      assert.equal(res.statusCode, null, `fallback request ${i + 1} passes`);
    }
    const blocked = makeRes();
    await runLimit(limit, makeReq(), blocked);
    assert.equal(blocked.statusCode, 429, 'in-memory fallback still enforces the cap');
    assert.ok(warnings.some((w) => w.includes('Redis unavailable')), 'degradation is logged');
  });

  test('redis client with no REDIS_URL stays in-memory (honest config)', async () => {
    const redis = createFakeRedis();
    const { capabilities } = buildRateLimiterFactory({ env: {}, redisClient: redis });
    assert.equal(capabilities.backend, 'in-memory');
  });

  test('stores: createRedisStore returns count from INCR', async () => {
    const redis = createFakeRedis();
    const store = createRedisStore({ redisClient: redis, fallbackStore: createInMemoryStore() });
    const r1 = await store.hit('k', 1000, 0);
    assert.deepEqual(r1, { count: 1, over: false });
    const r2 = await store.hit('k', 1001, 0);
    assert.deepEqual(r2, { count: 2, over: false });
  });
});
