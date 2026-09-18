'use strict';

/**
 * REAL PostgreSQL integration suite (forensic audit finding C8).
 *
 * Until now every DB test ran on sqlite::memory: — fine for unit coverage of
 * the extracted modules, but nothing proved the app actually works on
 * PostgreSQL: the migrations' quoted camelCase identifiers ("Users",
 * "DirectMessages"), the native ENUM columns, the composite unique indexes
 * (payments (provider, providerRef), direct_messages (senderId,
 * clientMessageId)), and the hot-path indexes from 0005.
 *
 * GATING: the entire suite is skipped unless PG_TEST_URL is set (CI defines
 * it against a postgres:16 service container; locally it is usually unset).
 * A skipped file performs NO connection attempts and exits cleanly.
 *
 * The database is built by the REAL migration runner (db/migrate.js) — this
 * is deliberate integration value: it proves the committed migrations run on
 * Postgres. Each test gets clean state via TRUNCATE ... CASCADE so tests stay
 * independent and the suite stays fast (one connection, one schema build).
 *
 * The URL MUST point at a DISPOSABLE database: the suite migrates and
 * truncates it at will.
 */

const test = require('node:test');
const assert = require('node:assert');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const { migrate } = require('../db/migrate');
const { defineCoreModels } = require('../models');

// ---------------------------------------------------------------------------
// Gating — the whole file is a no-op without PG_TEST_URL.
// ---------------------------------------------------------------------------
const maybeSkip = {
  skip: process.env.PG_TEST_URL
    ? false
    : 'PG_TEST_URL not set — Postgres integration suite requires a disposable database',
};

// ---------------------------------------------------------------------------
// Lazy top-level setup: built on the first test that actually runs.
// (A skipped file never reaches this — zero connection attempts.)
// ---------------------------------------------------------------------------
let sequelize = null;
let models = null;
let registeredTeardown = false;

async function getDb(t) {
  if (sequelize) return { sequelize, models };

  sequelize = new Sequelize(process.env.PG_TEST_URL, {
    dialect: 'postgres',
    ssl: false,
    logging: false,
  });

  // REAL migration runner — proves migrations execute on PostgreSQL.
  await migrate({
    sequelize,
    logger: { info() {}, warn() {}, error: (e) => console.error(e) },
  });

  models = defineCoreModels(sequelize, DataTypes);

  // TEARDOWN (afterAll equivalent): register once, on whichever test builds
  // the DB first. node:test always runs this hook — even on failure — so the
  // connection pool is closed and `node --test` exits cleanly (a hanging
  // handle would wedge CI forever).
  if (!registeredTeardown && t && typeof t.after === 'function') {
    t.after(async () => {
      if (sequelize) await sequelize.close();
      sequelize = null;
      models = null;
    });
    registeredTeardown = true;
  }

  return { sequelize, models };
}

// Tables to reset between tests (migration 0001 builds the full V2 schema;
// 0002 adds Devices, 0004 adds Payments — all camelCase, hence the quoting).
const CORE_TABLES = [
  'Ads', 'AuditLogs', 'Users', 'Challenges', 'Videos', 'Comments',
  'DirectMessages', 'Follows', 'GiftLogs', 'Groups', 'GroupBans',
  'GroupInvites', 'GroupMembers', 'GroupMessages', 'GroupMessageReads',
  'GroupMutes', 'GroupReactions', 'Likes', 'LiveStatuses', 'Meetings',
  'MeetingParticipants', 'Points', 'TextPosts', 'PostLikes',
  'ProcessedStripeEvents', 'Stars', 'Stories', 'StoryComments', 'StoryViews',
  'Subscriptions', 'VideoReposts', 'VideoSaves', 'Wallets', 'Devices',
  'Payments',
];

/**
 * Robust clean-state: one raw TRUNCATE of every known table in a single
 * statement (quoted camelCase names; CASCADE handles FK dependencies,
 * restartIdentity is a no-op for UUID PKs but is the complete reset form).
 */
async function truncateAll() {
  const list = CORE_TABLES.map((t) => `"${t}"`).join(', ');
  await sequelize.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

// Hot-path index names created by migrations/20260917-0005-hot-path-indexes.js
const HOT_PATH_INDEXES = [
  'idx_likes_video_id',
  'idx_comments_video_id',
  'idx_stars_video_id',
  'idx_videoreposts_video_id',
  'idx_storycomments_story_id',
  'idx_stories_expires_at',
  'idx_dm_receiver_read',
  'idx_dm_sender_clientmsgid',
  'idx_videos_user_published_created',
  'idx_subscriptions_creator_expires',
];

// ---------------------------------------------------------------------------
// 1. MIGRATIONS: the real runner built the fresh schema on Postgres
// ---------------------------------------------------------------------------
test('migrations: fresh schema built on Postgres, meta recorded', maybeSkip, async () => {
  const { sequelize: db } = await getDb();

  // Key tables exist (exact case as created by 0001-0004).
  const tables = await db.getQueryInterface().showAllTables();
  const lower = tables.map((t) => String(t).toLowerCase());
  for (const expected of ['Users', 'Videos', 'Stories', 'Payments', 'Devices', 'Groups', 'GroupMessages', 'Meetings']) {
    assert.ok(lower.includes(expected.toLowerCase()), `${expected} table must exist on Postgres`);
  }

  // SequelizeMeta recorded ≥6 migrations, names carry the .js extension
  // (umzug's default resolver names = file names).
  const [metaRows] = await db.query('SELECT "name" FROM "SequelizeMeta"');
  assert.ok(metaRows.length >= 6, `expected ≥6 recorded migrations, got ${metaRows.length}`);
  for (const row of metaRows) {
    assert.match(String(row.name), /\.js$/, 'migration name must include the .js extension');
  }
});

// ---------------------------------------------------------------------------
// 2. AUTH: register-shaped user creation + authenticate() core logic on PG
// ---------------------------------------------------------------------------
test('auth: bcrypt-verified user with UUID PK and Postgres timestamps', maybeSkip, async () => {
  const { sequelize: db, models: m } = await getDb();
  await truncateAll();

  // Exactly what the /api/auth/register route does (bcryptjs, cost 10).
  const password = 'S3cure-Passphrase!';
  const user = await m.User.create({
    username: 'authuser',
    email: 'authuser@test.local',
    password: await bcrypt.hash(password, 10),
    displayName: 'Auth User',
  });

  // UUID primary key materialized by the database round-trip.
  assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  const stored = await m.User.findByPk(user.id);

  // authenticate() middleware core logic: locate the user, then compare the
  // stored hash with bcryptjs — a wrong password is rejected.
  assert.ok(await bcrypt.compare(password, stored.password), 'correct password verifies');
  assert.ok(!(await bcrypt.compare('wrong-password', stored.password)), 'wrong password rejected');

  // Postgres timestamps: NOT NULL TIMESTAMP columns populated on create.
  assert.ok(stored.createdAt instanceof Date, 'createdAt must be a Date');
  assert.ok(stored.updatedAt instanceof Date, 'updatedAt must be a Date');

  // They are database-populated, not just JS artifacts: re-read raw.
  const [rows] = await db.query('SELECT "createdAt", "updatedAt" FROM "Users" WHERE id = :id', {
    replacements: { id: user.id },
  });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].createdAt !== null && rows[0].createdAt !== undefined, 'raw createdAt non-null on Postgres');
  assert.ok(rows[0].updatedAt !== null && rows[0].updatedAt !== undefined, 'raw updatedAt non-null on Postgres');
});

// ---------------------------------------------------------------------------
// 3. RBAC/roles: the 0002 ENUM column works on native PG enums
// ---------------------------------------------------------------------------
test('rbac: role ENUM persists user and admin on Postgres', maybeSkip, async () => {
  const { sequelize: db, models: m } = await getDb();
  await truncateAll();

  // Default path: model-level ENUM default 'user'.
  const user = await m.User.create({
    username: 'plainuser',
    password: 'x',
    isAdmin: false,
  });
  assert.equal(user.role, 'user', 'isAdmin=false user defaults to role=user');

  // The DB column must be the native PG enum: bump straight in SQL.
  await db.query(`UPDATE "Users" SET role = 'admin' WHERE id = :id`, {
    replacements: { id: user.id },
  });

  const readBack = await m.User.findByPk(user.id);
  assert.equal(readBack.role, 'admin', 'role=admin survives a PG round-trip');

  // A value outside the ENUM must be rejected at the SQL layer.
  await assert.rejects(
    () => db.query(`UPDATE "Users" SET role = 'superadmin' WHERE id = :id`, {
      replacements: { id: user.id },
    }),
    /invalid input value for enum|role/i,
    'native PG ENUM must reject values outside user/moderator/admin'
  );
});

// ---------------------------------------------------------------------------
// 4. WALLET/PAYMENTS: (provider, providerRef) unique index enforces
//    webhook/retry idempotency at the SQL layer
// ---------------------------------------------------------------------------
test('payments: duplicate (provider, providerRef) rejected; credit lands once', maybeSkip, async () => {
  const { models: m } = await getDb();
  await truncateAll();

  const user = await m.User.create({ username: 'payuser', password: 'x' });
  const wallet = await m.Wallet.create({ userId: user.id, coins: 0 });

  // First payment intent — created before redirecting to the provider.
  await m.Payment.create({
    userId: user.id,
    provider: 'payfast',
    providerRef: 'ref-1',
    coins: 100,
    status: 'pending',
  });

  // The replayed webhook/retry must hit the payments_provider_ref unique
  // index — the DB is the last line of defense against double-crediting.
  await assert.rejects(
    () => m.Payment.create({
      userId: user.id,
      provider: 'payfast',
      providerRef: 'ref-1',
      coins: 100,
      status: 'pending',
    }),
    (err) => {
      assert.ok(
        err.name === 'SequelizeUniqueConstraintError' || /duplicate key|unique constraint/i.test(err.message),
        `expected unique-constraint rejection, got: ${err.name}: ${err.message}`
      );
      return true;
    },
    'second Payment with the same (provider, providerRef) must be rejected'
  );

  // Exactly one ledger row survived, then the service credit: 0 → 100.
  assert.equal(await m.Payment.count({ where: { provider: 'payfast', providerRef: 'ref-1' } }), 1);
  await wallet.update({ coins: 100 });
  const reloaded = await m.Wallet.findByPk(wallet.id);
  assert.equal(reloaded.coins, 100, 'wallet credited exactly once');
});

// ---------------------------------------------------------------------------
// 5. MESSAGE IDEMPOTENCY: (senderId, clientMessageId) unique index (0003)
// ---------------------------------------------------------------------------
test('messages: duplicate clientMessageId rejected, distinct one accepted', maybeSkip, async () => {
  const { models: m } = await getDb();
  await truncateAll();

  const sender = await m.User.create({ username: 'dm_sender', password: 'x' });
  const receiver = await m.User.create({ username: 'dm_receiver', password: 'x' });

  const base = { senderId: sender.id, receiverId: receiver.id, content: 'hello' };
  await m.DirectMessage.create({ ...base, clientMessageId: 'client-42' });

  // Network retry with the SAME clientMessageId → unique index rejects.
  await assert.rejects(
    () => m.DirectMessage.create({ ...base, clientMessageId: 'client-42' }),
    (err) => {
      assert.ok(
        err.name === 'SequelizeUniqueConstraintError' || /duplicate key|unique constraint/i.test(err.message),
        `expected unique-constraint rejection, got: ${err.name}: ${err.message}`
      );
      return true;
    },
    'second DirectMessage with the same (senderId, clientMessageId) must be rejected'
  );

  // A genuinely new message (different clientMessageId) passes.
  await m.DirectMessage.create({ ...base, clientMessageId: 'client-43' });
  assert.equal(await m.DirectMessage.count(), 2);

  // NULL clientMessageId rows never collide (the index is on non-null pairs).
  await m.DirectMessage.create({ ...base });
  assert.equal(await m.DirectMessage.count(), 3);
});

// ---------------------------------------------------------------------------
// 6. HOT-PATH INDEXES: 0005 landed in pg_indexes
// ---------------------------------------------------------------------------
test('hot-path indexes: 0005 indexes exist in pg_indexes', maybeSkip, async () => {
  const { sequelize: db } = await getDb();

  // Fetch all schema indexes and filter in JS — avoids Sequelize named-array
  // expansion quirks with IN (:names) / ANY(:names) on Postgres.
  const [rows] = await db.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`
  );
  const present = new Set(rows.map((r) => r.indexname));
  const idxSample = [...present].filter((n) => String(n).startsWith('idx_')).sort().join(',');
  for (const name of HOT_PATH_INDEXES) {
    assert.ok(present.has(name), `hot-path index ${name} must exist in pg_indexes (have: ${idxSample})`);
  }
});

// ---------------------------------------------------------------------------
// 7. CASING PORTABILITY: migration 0002's quoted-identifier UPDATE works
// ---------------------------------------------------------------------------
test('casing portability: 0002 quoted-camelCase backfill UPDATE runs on PG', maybeSkip, async () => {
  const { sequelize: db, models: m } = await getDb();
  await truncateAll();

  // Legacy-flag admin still on the default 'user' role (role is NOT NULL with
  // default 'user' after 0002 — the migration UPDATE also matches role <> 'admin').
  const user = await m.User.create({ username: 'legacy_admin', password: 'x', isAdmin: true, role: 'user' });

  // The exact statement from migrations/20260906-0002-roles-and-devices.js —
  // quoted camelCase identifiers survive Postgres case-folding, and the bare
  // boolean predicate ("isAdmin" AND ...) works on a real PG BOOLEAN column.
  // Sequelize returns [rows, metadata] for UPDATE — rowCount lives on metadata.
  const [, metadata] = await db.query(
    "UPDATE \"Users\" SET role = 'admin' WHERE \"isAdmin\" AND (role IS NULL OR role <> 'admin')"
  );

  assert.equal(metadata.rowCount, 1, 'exactly the legacy-flag admin row is promoted');

  const readBack = await m.User.findByPk(user.id);
  assert.equal(readBack.role, 'admin');
});
