'use strict';

/**
 * Migration system tests.
 *
 * Covers the three guarantees the Phase 1 migration work must hold:
 *  1. A fresh database is fully built by the migrator (Users exists).
 *  2. Watch Parties are NOT part of the V2 schema (deferred to V3).
 *  3. Migrations are idempotent — a second run executes nothing.
 * Plus: FK constraints are live at the SQL layer (bogus videoId rejected),
 * meta bookkeeping exists, and the baseline-adopt path records without DDL.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

const { migrate, status } = require('../db/migrate');

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

function freshSqlite() {
  // :memory: works with umzug's SequelizeStorage (all calls share one
  // sequelize instance/connection pool).
  return new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
}

test('migrator builds the full V2 schema on a fresh database', async (t) => {
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());

  const result = await migrate({ sequelize, logger: silentLogger });
  assert.equal(result.adoptedBaseline, false, 'fresh DB must not hit the adopt path');
  assert.equal(result.executed.length, 2, 'both migrations execute on a fresh DB');
  assert.match(result.executed[0], /initial-v2-schema\.js$/);
  assert.match(result.executed[1], /roles-and-devices\.js$/);

  const tables = await sequelize.getQueryInterface().showAllTables();
  const lower = tables.map((t) => String(t).toLowerCase());
  for (const expected of ['Users', 'Videos', 'Groups', 'Meetings', 'LiveStatuses', 'Wallets', 'Devices']) {
    assert.ok(lower.includes(expected.toLowerCase()), `${expected} table must exist`);
  }

  // Phase 3A shape: Users.role ENUM + Devices FK cascade live at SQL level.
  const usersCols = await sequelize.getQueryInterface().describeTable('Users');
  assert.ok(Object.prototype.hasOwnProperty.call(usersCols, 'role'), 'Users.role column must exist');
});

test('Watch Party tables are deferred to V3 — not created by migrations', async (t) => {
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());
  await migrate({ sequelize, logger: silentLogger });

  const tables = (await sequelize.getQueryInterface().showAllTables()).map((x) => String(x).toLowerCase());
  assert.ok(!tables.includes('watchparties'), 'WatchParties must NOT exist');
  assert.ok(!tables.includes('watchparty'), 'WatchParty must NOT exist');
  assert.ok(!tables.includes('watchpartyparticipants'), 'WatchPartyParticipants must NOT exist');
});

test('migrations are idempotent — second run is a no-op', async (t) => {
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());

  await migrate({ sequelize, logger: silentLogger });
  const second = await migrate({ sequelize, logger: silentLogger });
  assert.equal(second.executed.length, 0, 'no migrations should execute on the second run');
  assert.equal(second.adoptedBaseline, false);

  const { pending } = await status({ sequelize });
  assert.equal(pending.length, 0);
});

test('FK constraints are enforced at the SQL layer', async (t) => {
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());
  await migrate({ sequelize, logger: silentLogger });

  // Define the same three models the API uses and create rows — Likes must
  // reject a bogus videoId with a FK violation (parity with V1 sync()).
  const { defineCoreModels } = require('../models');
  const core = defineCoreModels(sequelize, DataTypes);
  const { User, Video, Like } = core;

  const user = await User.create({ username: 'fkuser', password: 'x' });
  const video = await Video.create({ userId: user.id, filename: 'sample.mp4' });
  await Like.create({ userId: user.id, videoId: video.id }); // valid parent — OK

  await assert.rejects(
    () => Like.create({ userId: user.id, videoId: '00000000-0000-0000-0000-00000000dead' }),
    (err) => {
      assert.ok(
        err.name === 'SequelizeForeignKeyConstraintError' || /FOREIGN KEY|foreign key/i.test(err.message),
        `expected FK violation, got: ${err.name}: ${err.message}`
      );
      return true;
    },
    'inserting a Like with a bogus videoId must fail'
  );

  // CASCADE parity: deleting the user takes their video + like with it.
  await user.destroy();
  assert.equal(await Video.count(), 0, 'video cascade-deleted with user');
  assert.equal(await Like.count(), 0, 'like cascade-deleted with user');
});

test('legacy composite unique indexes land in the migration-built schema', async (t) => {
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());
  await migrate({ sequelize, logger: silentLogger });

  const [indexes] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
  );
  const names = indexes.map((r) => r.name).sort();
  for (const expected of [
    'idx_follows_pair', 'idx_likes_user_video', 'idx_stars_user_video',
    'idx_storyviews_story_viewer', 'idx_videosaves_user_video',
    'idx_videoreposts_user_video', 'idx_postlikes_user_post',
  ]) {
    assert.ok(names.includes(expected), `${expected} missing`);
  }
});

test('BASELINE-ADOPT: legacy V1 database is recorded, not re-created', async (t) => {
  // Simulate a V1 database: a Users table (with data) and NO SequelizeMeta.
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());
  const qi = sequelize.getQueryInterface();
  await qi.createTable('Users', {
    id: { type: DataTypes.UUID, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false },
    legacyColumn: { type: DataTypes.STRING },
  });
  await qi.createTable('WatchParties', { id: { type: DataTypes.UUID, primaryKey: true } }); // V1-era leftover
  await sequelize.query("INSERT INTO Users (id, username, legacyColumn) VALUES ('11111111-1111-1111-1111-111111111111', 'legacy_user', 'kept')");

  const result = await migrate({ sequelize, logger: silentLogger });
  assert.equal(result.adoptedBaseline, true, 'V1 DB must adopt, not execute');
  assert.equal(result.executed.length, 2, 'baseline recorded + 0002 executed for real');
  assert.ok(result.recordedBaselines.includes('20260906-0001-initial-v2-schema.js'),
    'the initial migration must be RECORDED only (its DDL must not re-run)');

  // The legacy DB is NOT rebuilt: legacy column + V1-era leftovers survive.
  const [rows] = await sequelize.query('SELECT legacyColumn FROM Users');
  assert.equal(rows[0].legacyColumn, 'kept', 'adopted DB must not be rebuilt');
  const tables = (await qi.showAllTables()).map((x) => String(x).toLowerCase());
  assert.ok(tables.includes('watchparties'), 'V1 leftover table survives an adopt (cleanup happens at the planned V2 wipe)');

  // PHASE 3A: the post-baseline migration EXECUTED on the adopted DB —
  // role column added (defensive backfill skipped: no isAdmin column in
  // this legacy shape) and Devices table created for real.
  const usersCols = await qi.describeTable('Users');
  assert.ok(Object.prototype.hasOwnProperty.call(usersCols, 'role'),
    'adopted DB must gain Users.role from migration 0002');
  assert.ok(tables.includes('devices'), 'adopted DB must gain the Devices table from migration 0002');
  const [roleRows] = await sequelize.query('SELECT role FROM Users');
  assert.equal(roleRows[0].role, 'user', 'defensive backfill leaves role=user when isAdmin column is absent');

  // And a second run over the adopted DB is a plain no-op.
  const second = await migrate({ sequelize, logger: silentLogger });
  assert.equal(second.adoptedBaseline, false, 'adopted DB has meta — no adopt on second run');
  assert.equal(second.executed.length, 0);
});

test('BASELINE-ADOPT with legacy admins: isAdmin=true backfills to role=admin, others user', async (t) => {
  const sequelize = freshSqlite();
  t.after(() => sequelize.close());
  const qi = sequelize.getQueryInterface();
  // Legacy shape WITH the isAdmin flag (the real V1 dev DB has it).
  await qi.createTable('Users', {
    id: { type: DataTypes.UUID, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false },
    isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  });
  await sequelize.query("INSERT INTO Users (id, username, isAdmin) VALUES ('21111111-1111-1111-1111-111111111111', 'owner', 1)");
  await sequelize.query("INSERT INTO Users (id, username, isAdmin) VALUES ('31111111-1111-1111-1111-111111111111', 'member', 0)");

  const result = await migrate({ sequelize, logger: silentLogger });
  assert.equal(result.adoptedBaseline, true);

  const [rows] = await sequelize.query('SELECT username, role FROM Users ORDER BY username');
  assert.equal(rows.length, 2);
  const byName = {};
  for (const r of rows) byName[r.username] = r.role;
  assert.equal(byName.owner, 'admin', 'isAdmin=1 must backfill to admin');
  assert.equal(byName.member, 'user', 'isAdmin=0 stays user');

  // Idempotent on re-run.
  const second = await migrate({ sequelize, logger: silentLogger });
  assert.equal(second.executed.length, 0);
  const [rows2] = await sequelize.query('SELECT username, role FROM Users ORDER BY username');
  for (const r of rows2) {
    assert.equal(r.role, r.username === 'owner' ? 'admin' : 'user');
  }
});

test('migrate CLI runner works against a real sqlite file (SQLITE_PATH)', async (t) => {
  // config/database.js honors process.env.SQLITE_PATH — exercise the same
  // factory the npm run migrate CLI uses, against a temp file.
  const file = path.join(os.tmpdir(), `ikhwezi-migration-test-${process.pid}-${Date.now()}.db`);
  const prevPath = process.env.SQLITE_PATH;
  process.env.SQLITE_PATH = file;
  t.after(() => {
    if (prevPath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = prevPath;
    fs.rmSync(file, { force: true });
  });

  const sequelize = require('../config/database').createSequelize({ logging: false });
  const result = await migrate({ sequelize, logger: silentLogger });
  assert.equal(result.executed.length, 2);
  const tables = await sequelize.getQueryInterface().showAllTables();
  assert.ok(tables.includes('SequelizeMeta'), 'SequelizeMeta bookkeeping table created');
  assert.ok(tables.includes('Users'));
  assert.ok(tables.includes('Devices'), 'Phase 3A Devices table comes from 0002');
  await sequelize.close();
});
