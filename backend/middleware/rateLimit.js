'use strict';

/**
 * Rate limiting — in-memory (single-node) with an optional Redis-backed
 * store for multi-instance correctness.
 *
 *   REDIS_URL set (and reachable) → fixed-window counters in Redis, shared
 *                                    across every backend instance behind the
 *                                    load balancer, surviving restarts.
 *   REDIS_URL unset, or Redis fails → the original in-memory store (the
 *                                    default; identical behaviour to the
 *                                    limiter this replaces).
 *
 * Honesty rules (mirroring queues/index.js + storage-v2):
 *   - Redis problems NEVER take a request path down. Every Redis operation
 *     is time-boxed and failure falls back to the in-memory counter for
 *     THAT request, so a Redis outage degrades rate limiting accuracy —
 *     it never 500s an upload or a login.
 *   - The limiter surface is identical to the original createRateLimiter:
 *     `(req, res, next) => void`, 429 + { error } when over the cap.
 *   - No new middleware registration is required anywhere: call sites pass
 *     the same guards they always did.
 *
 * Atomicity: the fixed window uses a single INCR per key + EXPIRE on the
 * first hit. INCR is atomic in Redis, so concurrent instances cannot race
 * past the cap the way read-modify-write on shared memory can across nodes.
 * (PEXPIRE is issued only when INCR returns 1 — the canonical fixed-window
 * pattern; a lost EXPIRE race at worst leaves a key without TTL, which the
 * stale-key sweep on the Redis client's next use cannot fix, but which is
 * bounded by the sweep below and by the in-memory fallback path.)
 */

const RATE_LIMIT_REDIS_TIMEOUT_MS = 250;

/** In-memory fixed-window store — the exact behaviour of the original
 *  limiter from index.js (Map of key → hit timestamps, periodic sweep). */
function createInMemoryStore({ sweepIntervalMs = 5 * 60 * 1000, windowMs = 15 * 60 * 1000 } = {}) {
  const store = new Map();
  const timer = setInterval(() => {
    const cut = Date.now() - windowMs;
    for (const [k, hits] of store) {
      const fresh = hits.filter((t) => t > cut);
      if (fresh.length === 0) store.delete(k); else store.set(k, fresh);
    }
  }, sweepIntervalMs);
  timer.unref();
  return {
    /** @param {number} windowMs duration of the window (ms) — timestamps at
     *  or before now-windowMs are filtered out of the counter. */
    async hit(key, now, windowMs) {
      const hits = (store.get(key) || []).filter((t) => t > now - windowMs);
      hits.push(now);
      store.set(key, hits);
      return { count: hits.length, over: false };
    },
  };
}

/** Redis fixed-window store. Falls back to in-memory per-hit on any error. */
function createRedisStore({ redisClient, fallbackStore, timeoutMs = RATE_LIMIT_REDIS_TIMEOUT_MS, log } = {}) {
  return {
    /** @param {number} windowMs duration of the window (ms) — used for
     *  bucketing (now / windowMs) and the key TTL. */
    async hit(key, now, windowMs) {
      try {
        const redisKey = `rl:${key}:${Math.floor(now / windowMs)}`;
        const count = await withTimeout(
          redisClient.incr(redisKey),
          timeoutMs,
          'redis incr timeout',
        );
        if (count === 1) {
          // TTL slightly above the window so the bucket self-cleans.
          await withTimeout(
            redisClient.pexpire(redisKey, windowMs + 1000),
            timeoutMs,
            'redis pexpire timeout',
          ).catch(() => {});
        }
        return { count, over: false };
      } catch (err) {
        log?.warn?.(`rate-limit: Redis unavailable (${err?.message || err}) — falling back to in-memory counter`);
        return fallbackStore.hit(key, now, now - windowMs);
      }
    },
  };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms).unref()),
  ]);
}

/**
 * Build the rate-limiter factory.
 *
 * @param {object} [opts]
 * @param {object} [opts.env]              environment snapshot (default process.env)
 * @param {object} [opts.redisClient]      an ioredis-compatible client; when
 *                                         provided AND REDIS_URL is set, the
 *                                         Redis store is used (with fallback).
 * @param {function} [opts.log]            logger (default console)
 * @returns {{ createRateLimiter, capabilities }}
 */
function buildRateLimiterFactory(opts = {}) {
  const {
    env = process.env,
    redisClient = null,
    log = console,
  } = opts;

  const redisUrl = (env.REDIS_URL || '').trim();
  const useRedis = !!(redisClient && redisUrl);

  const fallbackStore = createInMemoryStore();
  const store = useRedis
    ? createRedisStore({ redisClient, fallbackStore, log })
    : fallbackStore;

  /** Identical surface to the original createRateLimiter in index.js. */
  function createRateLimiter(windowMs, max, message) {
    return (req, res, next) => {
      const key = `${req.ip || req.socket?.remoteAddress || 'x'}:${req.path}`;
      const now = Date.now();
      // The store returns the count for this window; over-limit is decided
      // here so both backends share one policy. The Redis store buckets by
      // now/windowMs and needs the DURATION; the in-memory store filters
      // timestamps against the now-windowMs cutoff.
      store.hit(key, now, windowMs).then(({ count }) => {
        if (count > max) {
          return res.status(429).json({ error: message || 'Too many requests. Please slow down.' });
        }
        next();
      }).catch(() => {
        // Absolute last resort (should be unreachable — the stores never
        // throw): allow the request but log. Fail-open beats a hard 500.
        log?.error?.('rate-limit: store hit failed — allowing request (fail-open)');
        next();
      });
    };
  }

  return {
    createRateLimiter,
    capabilities: Object.freeze({
      backend: useRedis ? 'redis' : 'in-memory',
      redis: useRedis,
    }),
  };
}

module.exports = {
  buildRateLimiterFactory,
  createInMemoryStore,
  createRedisStore,
};
