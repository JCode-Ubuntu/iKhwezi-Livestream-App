'use strict';

/**
 * Database connection factory.
 *
 *   SQLITE_PATH   — override the SQLite file (default: backend/storage/ikhwezi.db)
 *   DATABASE_URL  — postgres://… switches the dialect to PostgreSQL. Requires
 *                   the `pg` package (npm i pg) — deliberately not a hard
 *                   dependency while production runs on SQLite.
 *   DATABASE_SSL  — "false" to disable TLS for Postgres (default: on, with
 *                   rejectUnauthorized=false for managed providers).
 *
 * Nothing here migrates data. Moving production from SQLite to Postgres is a
 * separate, deliberate operation (dump → load → verify) — see docs.
 */

const { Sequelize } = require('sequelize');

function createSequelize({ sqlitePath, logging = false } = {}) {
  const url = process.env.DATABASE_URL || '';

  if (url && /^postgres(ql)?:\/\//i.test(url)) {
    try {
      require.resolve('pg');
    } catch {
      throw new Error('DATABASE_URL points at PostgreSQL but the "pg" package is not installed. Run: npm install pg');
    }
    const ssl = process.env.DATABASE_SSL === 'false' ? false : { require: true, rejectUnauthorized: false };
    return new Sequelize(url, {
      dialect: 'postgres',
      logging,
      dialectOptions: ssl ? { ssl } : {},
      pool: { max: 10, min: 0, idle: 10_000, acquire: 30_000 },
    });
  }

  return new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_PATH || sqlitePath,
    logging,
  });
}

module.exports = { createSequelize };
