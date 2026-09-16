'use strict';

const test = require('node:test');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { createHealthService } = require('../lib/health');

test.describe('health service (Phase 3B)', () => {
  async function buildDb() {
    const { createSequelize } = require('../config/database');
    const dbPath = path.join(__dirname, `health-test-${Date.now()}.db`);
    const sequelize = createSequelize({ env: { SQLITE_PATH: dbPath, DATABASE_URL: '' }, logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } });
    await sequelize.authenticate();
    return { sequelize, dbPath };
  }

  test('reports healthy when DB and storage are ok', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      const health = createHealthService({ sequelize, env: { HEALTH_CACHE_TTL_MS: '0' } });
      const result = await health.health();
      assert.strictEqual(result.healthy, true);
      assert.strictEqual(result.dependencies.database.ok, true);
      assert.strictEqual(result.dependencies.storage.ok, true);
      assert.ok(result.dependencies.redis.skipped);
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  test('ready() returns 503 when DB is down', async () => {
    const { sequelize, dbPath } = await buildDb();
    await sequelize.close();
    try { fs.unlinkSync(dbPath); } catch {}
    const health = createHealthService({ sequelize, env: { HEALTH_CACHE_TTL_MS: '0' } });
    const { ok, result } = await health.ready();
    assert.strictEqual(ok, false);
    assert.strictEqual(result.healthy, false);
    assert.strictEqual(result.dependencies.database.ok, false);
  });

  test('caches results within TTL', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      let calls = 0;
      const stub = {
        authenticate: async () => { calls++; }
      };
      const health = createHealthService({ sequelize: stub, env: { HEALTH_CACHE_TTL_MS: '10000' } });
      await health.health();
      await health.health();
      await health.ready();
      assert.strictEqual(calls, 1, 'authenticate should be cached');
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  test('resetCache forces a fresh check', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      let calls = 0;
      const stub = {
        authenticate: async () => { calls++; }
      };
      const health = createHealthService({ sequelize: stub, env: { HEALTH_CACHE_TTL_MS: '10000' } });
      await health.health();
      health.resetCache();
      await health.health();
      assert.strictEqual(calls, 2);
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  test('redis skipped when no client provided', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      const health = createHealthService({ sequelize, env: { HEALTH_CACHE_TTL_MS: '0' } });
      const result = await health.health();
      assert.ok(result.dependencies.redis.skipped);
      assert.strictEqual(result.dependencies.redis.ok, true);
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  test('redis checked when client provided', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      let pings = 0;
      const redis = { ping: async () => { pings++; return 'PONG'; } };
      const health = createHealthService({ sequelize, redisClient: redis, env: { HEALTH_CACHE_TTL_MS: '0' } });
      const result = await health.health();
      assert.strictEqual(result.dependencies.redis.ok, true);
      assert.strictEqual(pings, 1);
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  test('media section reports pipeline posture (informational, never gates)', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      const health = createHealthService({
        sequelize,
        mediaPipeline: {
          storageProvider: { type: 'local', capabilities: { objectStorage: false } },
          transcode: { capabilities: { requested: false, enabled: false, profiles: ['480p'] } },
          transcodeQueue: { capabilities: { type: 'in-process', redis: false } },
        },
        env: { HEALTH_CACHE_TTL_MS: '0' },
      });
      const result = await health.health();
      assert.strictEqual(result.healthy, true, 'pipeline posture must not affect overall health');
      assert.strictEqual(result.media.storageType, 'local');
      assert.strictEqual(result.media.objectStorage, false);
      assert.strictEqual(result.media.transcodeEnabled, false);
      assert.deepStrictEqual(result.media.transcodeProfiles, ['480p']);
      assert.strictEqual(result.media.queueType, 'in-process');
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  test('media section reports honest unavailability when pipeline is null', async () => {
    const { sequelize, dbPath } = await buildDb();
    try {
      const health = createHealthService({ sequelize, mediaPipeline: null, env: { HEALTH_CACHE_TTL_MS: '0' } });
      const result = await health.health();
      assert.strictEqual(result.healthy, true, 'pipeline absence must not affect overall health');
      assert.strictEqual(result.media.status, 'unavailable');
      assert.ok(result.media.reason.includes('local-only'));
    } finally {
      await sequelize.close();
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });
});
