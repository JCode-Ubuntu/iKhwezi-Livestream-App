'use strict';

/**
 * Shared Redis client — built from REDIS_URL, owned in one place.
 *
 * Why: BullMQ (queues), the health probe (lib/health.js checkRedis), and
 * rate limiting (middleware/rateLimit.js) all need a connection when
 * REDIS_URL is configured. Creating one client per consumer multiplies
 * connection slots and reconnect storms; this module hands out a single
 * lazily-created, shared client with honest degradation:
 *
 *   REDIS_URL set   → one shared ioredis client (reconnect with backoff,
 *                     error-logged but never thrown)
 *   REDIS_URL unset → null (the honest "not configured" value every
 *                     consumer already handles)
 *
 * Connection lifecycle:
 *   - The client connects eagerly when created (so the first health probe
 *     and the first rate-limit hit find it ready), but `connect()` is
 *     awaited by NOBODY on a request path — failures land in the error
 *     handler and consumers keep their own timeouts/fallbacks.
 *   - `disconnectSharedRedisClient()` closes it (best-effort, used by
 *     tests and graceful shutdown).
 *   - `getRedisClient()` never throws and never blocks.
 */

const { createLogger } = require('./logger');

let shared = null;
let attempted = false;

/**
 * @param {object} [opts]
 * @param {object} [opts.env] environment snapshot (default process.env)
 * @param {function} [opts.log] logger (default: lib/logger)
 * @returns {object|null} shared ioredis client, or null when not configured
 */
function getRedisClient(opts = {}) {
  const {
    env = process.env,
    log = opts.log || createLogger(),
  } = opts;

  if (attempted) return shared;
  attempted = true;

  const redisUrl = (env.REDIS_URL || '').trim();
  if (!redisUrl) return null; // not configured — the honest default

  try {
    // Lazy require: ioredis is only needed when REDIS_URL is set.
    const Redis = require('ioredis');
    shared = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      // Never let a Redis hiccup crash the process — log and retry with
      // capped backoff. ioredis reconnects automatically; consumers still
      // fail open on their own timeouts.
      retryStrategy: (times) => Math.min(times * 200, 5_000),
      // Keep reconnect attempts quiet at the socket level (errors surface
      // through the 'error' event below instead of unhandled throws).
      enableOfflineQueue: true,
    });
    shared.on('error', (err) => {
      log.warn?.(`redis: connection error (${err?.message || err}) — consumers degrade to their fallbacks`);
    });
    return shared;
  } catch (err) {
    log.warn?.(
      `\n${'='.repeat(78)}\n⚠️  REDIS_URL is set but the Redis client could not be created ` +
      `(${err?.message || err}). Redis-backed features degrade to their local fallbacks.\n${'='.repeat(78)}\n`
    );
    shared = null;
    return null;
  }
}

/** Best-effort close of the shared client (tests, graceful shutdown). */
async function disconnectSharedRedisClient() {
  const client = shared;
  shared = null;
  attempted = false;
  if (!client) return;
  try {
    if (typeof client.disconnect === 'function') client.disconnect();
    else if (typeof client.quit === 'function') await client.quit();
  } catch { /* best-effort */ }
}

/** Test hook: forget the shared client so a new one can be built. */
function resetSharedRedisClient() {
  const client = shared;
  shared = null;
  attempted = false;
  try { client?.disconnect?.(); } catch { /* best-effort */ }
}

module.exports = { getRedisClient, disconnectSharedRedisClient, resetSharedRedisClient };
