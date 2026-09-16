'use strict';

/**
 * Health/readiness probes with dependency checks (Phase 3B).
 *
 *  - /api/health: lightweight liveness + dependency status JSON.
 *  - /api/ready: returns 200 only when DB (and Redis, if configured) and
 *    storage are healthy; 503 otherwise.
 *  - Results are cached for HEALTH_CACHE_TTL_MS to avoid thundering herd.
 *  - Every check catches errors and reports degraded status honestly — a
 *    failing dependency never becomes a 500 from the probe itself.
 */

const fs = require('fs');
const path = require('path');
const fsp = require('fs/promises');

const DEFAULT_CACHE_TTL_MS = 5_000;

function createHealthService({
  sequelize,
  redisClient = null,
  storageProvider = null,
  mediaPipeline = null,
  env = process.env,
  logger = null,
} = {}) {
  const cacheTtl = Math.max(0, parseInt(env.HEALTH_CACHE_TTL_MS, 10) || DEFAULT_CACHE_TTL_MS);
  let cache = null;
  let lastCheck = 0;

  async function checkDatabase() {
    try {
      await Promise.race([
        sequelize.authenticate(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 3_000)),
      ]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function checkRedis() {
    if (!redisClient) return { ok: true, skipped: true };
    try {
      if (typeof redisClient.ping === 'function') {
        await Promise.race([
          redisClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2_000)),
        ]);
      } else if (redisClient.isReady !== undefined) {
        if (!redisClient.isReady) throw new Error('Redis client not ready');
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function checkStorage() {
    try {
      const probeDir = path.join(__dirname, '..', 'storage', 'health');
      await fsp.mkdir(probeDir, { recursive: true });
      const probeFile = path.join(probeDir, `probe-${Date.now()}.tmp`);
      const content = `probe-${Math.random()}`;
      await fsp.writeFile(probeFile, content, 'utf8');
      const read = await fsp.readFile(probeFile, 'utf8');
      await fsp.unlink(probeFile);
      if (read !== content) throw new Error('storage read mismatch');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function runAll() {
    const now = Date.now();
    if (cache && (now - lastCheck) < cacheTtl) return cache;

    const [database, redis, storage] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkStorage(),
    ]);

    const overall = database.ok && storage.ok && (redis.ok || redis.skipped);
    const result = {
      status: overall ? 'ok' : 'degraded',
      healthy: overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || null,
      environment: process.env.NODE_ENV || 'development',
      dependencies: { database, redis, storage },
      // Media pipeline observability — informational, NOT a readiness
      // gate. Transcode disabled / FFmpeg missing / local-only storage are
      // all VALID operating states (every stage fails open), so a false
      // "unhealthy" here would page an operator for nothing. This gives
      // the operator an honest one-glance pipeline posture instead.
      media: mediaPipeline ? {
        storageType: mediaPipeline.storageProvider?.type || 'unknown',
        objectStorage: !!mediaPipeline.storageProvider?.capabilities?.objectStorage,
        transcodeRequested: !!mediaPipeline.transcode?.capabilities?.requested,
        transcodeEnabled: !!mediaPipeline.transcode?.capabilities?.enabled,
        transcodeProfiles: mediaPipeline.transcode?.capabilities?.profiles || [],
        queueType: mediaPipeline.transcodeQueue?.capabilities?.type || 'unknown',
        queueRedis: !!mediaPipeline.transcodeQueue?.capabilities?.redis,
      } : { status: 'unavailable', reason: 'media pipeline did not initialize (uploads stay local-only)' },
    };

    cache = result;
    lastCheck = now;
    return result;
  }

  function resetCache() {
    cache = null;
    lastCheck = 0;
  }

  return {
    health: runAll,
    ready: async () => {
      const result = await runAll();
      return { ok: result.healthy, result };
    },
    resetCache,
  };
}

module.exports = { createHealthService };
