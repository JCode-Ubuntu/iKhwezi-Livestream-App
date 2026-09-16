'use strict';

/**
 * Shared Redis client tests (lib/redis.js).
 *
 * No network assertions: only the configuration-shape decisions are
 * verified — the honest null when REDIS_URL is unset, construction when it
 * is set, and the one-client-per-process cache. Constructed clients are
 * disconnected in teardown so the test process can exit cleanly.
 */

const test = require('node:test');
const assert = require('assert');

const { getRedisClient, resetSharedRedisClient } = require('../lib/redis');

test.describe('shared redis client', () => {
  test.afterEach(() => {
    resetSharedRedisClient();
  });

  test('returns null when REDIS_URL is unset (honest default)', () => {
    const client = getRedisClient({ env: {}, log: { warn: () => {} } });
    assert.strictEqual(client, null);
  });

  test('returns null for a whitespace-only REDIS_URL', () => {
    const client = getRedisClient({ env: { REDIS_URL: '   ' }, log: { warn: () => {} } });
    assert.strictEqual(client, null);
  });

  test('constructs a client when REDIS_URL is set (then disconnects)', () => {
    const client = getRedisClient({ env: { REDIS_URL: 'redis://localhost:6379' }, log: { warn: () => {} } });
    assert.ok(client, 'client object returned');
    assert.strictEqual(typeof client.incr, 'function', 'ioredis-compatible surface');
    assert.strictEqual(typeof client.pexpire, 'function');
  });

  test('caches the decision — one client per process', () => {
    const a = getRedisClient({ env: { REDIS_URL: 'redis://localhost:6379' }, log: { warn: () => {} } });
    const b = getRedisClient({ env: {}, log: { warn: () => {} } });
    assert.strictEqual(a, b, 'second call returns the cached client, not null');
  });

  test('resetSharedRedisClient allows a fresh decision', () => {
    getRedisClient({ env: { REDIS_URL: 'redis://localhost:6379' }, log: { warn: () => {} } });
    resetSharedRedisClient();
    const client = getRedisClient({ env: {}, log: { warn: () => {} } });
    assert.strictEqual(client, null);
  });
});
