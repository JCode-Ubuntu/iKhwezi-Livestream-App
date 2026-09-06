'use strict';

/**
 * Migration runner — umzug + SequelizeStorage (SequelizeMeta table).
 *
 * CLI (backend):
 *   npm run migrate           → run all pending migrations (up)
 *   npm run migrate:status    → list executed/pending migrations
 *
 * Programmatic (backend/index.js boot):
 *   const { migrate } = require('./db/migrate');
 *   const { adoptedBaseline } = await migrate({ sequelize });
 *
 * BASELINE-ADOPT for legacy V1 databases (e.g. the existing dev SQLite file):
 * before running up(), if the `Users` table exists but SequelizeMeta does not,
 * every discovered migration is recorded into meta WITHOUT executing its DDL
 * (the tables already exist). A loud warning is logged — a fresh V2 database
 * deliberately expects a wipe (roadmap: clean-slate V2). Otherwise up() runs
 * normally, so fresh databases get the full DDL from migration 1.
 *
 * Dialect support: SQLite (dev) and PostgreSQL (prod, DATABASE_URL) — the
 * migrations themselves are dialect-portable (no PRAGMAs, no TINYINT).
 */

const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const { SequelizeMetaName } = require('./migration-meta');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LEGACY_BASELINE_TABLE = 'Users';
// Only the INITIAL schema migration is "the baseline" for a legacy V1
// database: its tables already exist, so its DDL must NOT re-run. Every
// LATER migration (0002+ roles/devices, and anything after) expresses real
// schema changes the legacy DB never had — those must EXECUTE normally on
// an adopted database, exactly like on a fresh one.
const BASELINE_MIGRATION_NAME = '20260906-0001-initial-v2-schema.js';

function createUmzug({ sequelize, logger = console } = {}) {
  // `logger: false` = quiet mode (tests): give umzug inert sinks instead of
  // passing the raw boolean through (umzug calls logger.info etc. blindly).
  const umzugLogger = logger
    ? logger
    : { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  const umzug = new Umzug({
    migrations: {
      // umzug resolves each *.js via require() (defaultResolver) — names in
      // SequelizeMeta include the extension (e.g. "20260906-0001-initial-v2-schema.js").
      glob: ['migrations/*.js', { cwd: path.join(__dirname, '..') }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: umzugLogger,
  });
  return umzug;
}

/** True when a V1-era database exists without any migration bookkeeping. */
async function needsBaselineAdoption(sequelize) {
  const qi = sequelize.getQueryInterface();
  const hasUsers = await qi.tableExists(LEGACY_BASELINE_TABLE);
  if (!hasUsers) return false;
  const hasMeta = await qi.tableExists(SequelizeMetaName);
  return !hasMeta;
}

async function status({ sequelize, logger = console } = {}) {
  const umzug = createUmzug({ sequelize, logger });
  const executed = await umzug.executed();
  const pending = await umzug.pending();
  return { executed: executed.map((m) => m.name), pending: pending.map((m) => m.name) };
}

/**
 * Run all pending migrations. Returns { executed, adoptedBaseline }.
 * `adoptedBaseline` is true when a legacy V1 schema was adopted as-is.
 */
async function migrate({ sequelize, logger = console } = {}) {
  let adoptedBaseline = false;
  let recorded = [];
  const umzug = createUmzug({ sequelize, logger });

  if (await needsBaselineAdoption(sequelize)) {
    adoptedBaseline = true;
    const pending = await umzug.pending();
    const baseline = pending.filter((m) => m.name === BASELINE_MIGRATION_NAME);
    if (baseline.length) {
      console.warn('\n' + '='.repeat(78));
      console.warn('⚠️  LEGACY DATABASE DETECTED — adopting the existing schema as baseline.');
      console.warn('⚠️  The INITIAL V2 schema migration is RECORDED but its DDL is NOT re-run');
      console.warn('⚠️  (the tables already exist from the pre-migration era).');
      console.warn('⚠️  Adopted schema may differ from the clean V2 schema (e.g. orphaned');
      console.warn('⚠️  WatchParty tables from deferred features may remain).');
      console.warn('⚠️  A database WIPE is required for a clean V2 schema adoption —');
      console.warn('⚠️  allowed by the roadmap (clean-slate V2, no data migration).');
      console.warn('⚠️  Later migrations (0002+) still EXECUTE here: they carry real');
      console.warn('⚠️  changes the legacy DB never had (e.g. Users.role, Devices).');
      console.warn('='.repeat(78) + '\n');
      // Record WITHOUT executing: mark the baseline as done so the DDL for
      // tables that already exist never re-runs. Everything else (0002+)
      // falls through to up() and executes for real on the adopted DB.
      const storage = umzug.storage;
      await storage.syncModel();
      for (const m of baseline) {
        await storage.logMigration({ name: m.name });
        recorded.push(m.name);
      }
    }
  }

  const executed = await umzug.up();
  return {
    executed: [...recorded, ...executed.map((m) => m.name)],
    adoptedBaseline,
    recordedBaselines: recorded,
  };
}

// ---- CLI entry -------------------------------------------------------------
async function main() {
  const sequelize = require('../config/database').createSequelize({});
  try {
    await sequelize.authenticate();

    const [command] = process.argv.slice(2);
    if (command === 'status') {
      const { executed, pending } = await status({ sequelize });
      console.log(`dialect: ${sequelize.getDialect()}`);
      console.log(`executed (${executed.length}):`);
      for (const name of executed) console.log(`  ✔ ${name}`);
      console.log(`pending (${pending.length}):`);
      for (const name of pending) console.log(`  … ${name}`);
      if (!pending.length) console.log('  (none — database is up to date)');
      return;
    }

    const { executed, adoptedBaseline } = await migrate({ sequelize });
    if (adoptedBaseline) {
      console.log(`migrations: adopted existing schema as baseline (${executed.length} recorded, DDL not re-run)`);
    } else {
      console.log(executed.length
        ? `migrations: executed ${executed.length} → ${executed.join(', ')}`
        : 'migrations: up to date (0 executed)');
    }
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrate, status, createUmzug, needsBaselineAdoption };
