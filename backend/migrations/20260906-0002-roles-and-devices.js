'use strict';

/**
 * PHASE 3A — RBAC ROLES + FCM DEVICE REGISTRY.
 *
 * Two additive schema changes, both safe on FRESH (migration-built) and
 * ADOPTED (legacy V1 baseline-adopted) databases:
 *
 *  1. Users.role — ENUM('user','moderator','admin'). Backfill rule:
 *     existing isAdmin=1 → 'admin'; everyone else → 'user'. The legacy
 *     isAdmin BOOLEAN is kept in sync (see the grant/revoke route) so old
 *     readers (resolveLiveHostUser/assignLiveHost, frontend user objects)
 *     stay truthful during the transition — role is the authoritative
 *     column, isAdmin becomes a derived projection of role === 'admin'.
 *
 *  2. Devices — server-side FCM push-token registry (Phase 3A task 3).
 *     One row per (user, token): unique(userId+token). FK user with
 *     ON DELETE CASCADE so user deletion (guest cleanup, account purge)
 *     removes their devices atomically. `lastSeenAt` marks registration
 *     freshness for future stale-token pruning; `prunedAt` supports
 *     soft retirement when FCM reports a token invalid (that needs
 *     firebase-admin — out of scope here, documented in code).
 *
 * Portability (matches 0001): DataTypes.ENUM receives a native type on
 * PostgreSQL; SQLite degrades to TEXT. No PRAGMAs, no TINYINT.
 *
 * ADOPTED-DB safety: both steps are pure ADD COLUMN / CREATE TABLE —
 * none of the pre-existing V1 tables are rebuilded, and the backfill only
 * UPDATEs the newly-added role column. FK constraints match the pattern
 * 0001 emits (references/onUpdate/onDelete).
 */

const { DataTypes } = require('sequelize');

async function up({ context }) {
  const qi = context; // queryInterface
  const sequelize = context.sequelize;
  await sequelize.transaction(async (transaction) => {
    // ---- 1. Users.role ------------------------------------------------------
    // Guard: an adopted V1 DB adopted before this migration exists has no
    // role column; a partially-migrated one (e.g. manual operator ALTER)
    // might. addColumn is idempotent-safe here only via the describeTable
    // check, because Umzug never re-runs an executed migration anyway — but
    // defensive code keeps one-off manual replays (docs/ops runbooks)
    // harmless.
    const usersTable = (await qi.describeTable('Users'));
    const hasRole = Object.prototype.hasOwnProperty.call(usersTable, 'role');

    if (!hasRole) {
      await qi.addColumn('Users', 'role', {
        type: DataTypes.ENUM('user', 'moderator', 'admin'),
        allowNull: false,
        // Everyone defaults to 'user' — fail-closed by construction.
        defaultValue: 'user',
      }, { transaction });
    }

    // Backfill: isAdmin=1 → admin. Runs unconditionally (cheap, idempotent):
    // on a fresh DB the table is empty; on an adopted DB this is the
    // one-time promotion of the legacy flag; on a re-run it's a no-op
    // because admins already carry role='admin'.
    // DEFENSIVE: an adopted V1-era Users table might predate the isAdmin
    // flag entirely (or a freshly-created-but-empty legacy shape) — check
    // the column exists before the UPDATE, and fail soft (role stays 'user')
    // rather than crashing boot for a schema we cannot interpret.
    const hasIsAdmin = Object.prototype.hasOwnProperty.call(usersTable, 'isAdmin');
    if (hasIsAdmin) {
      // POSTGRES PORTABILITY (launch verification fix): the table was created
      // quoted-camelCase ("Users") by 0001, but this raw statement referenced
      // it unquoted — Postgres folds unquoted identifiers to lowercase and
      // failed with `relation "users" does not exist`. Quoting works on both
      // dialects (SQLite is case-insensitive). `isAdmin = 1` also breaks on
      // Postgres BOOLEAN columns (`operator does not exist: boolean = integer`);
      // a bare boolean predicate in WHERE is valid on Postgres (real boolean)
      // and SQLite (non-zero integer is truthy), so it stays portable.
      await sequelize.query(
        "UPDATE \"Users\" SET role = 'admin' WHERE \"isAdmin\" AND (role IS NULL OR role <> 'admin')",
        { transaction }
      );
    } else {
      console.warn('⚠️  roles migration: Users.isAdmin not found — skipping backfill (all users stay role=user).');
    }

    // ---- 2. Devices --------------------------------------------------------
    const tables = (await qi.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('devices')) {
      await qi.createTable('Devices', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        // FCM device token (up to ~4KB; STRING(512) is the conventional cap).
        token: { type: DataTypes.STRING(512), allowNull: false },
        // Free-form client hint (android/ios) — informational only.
        platform: { type: DataTypes.STRING(32), allowNull: true },
        lastSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });

      // Upsert key: one row per (userId, token). FCM issues one token per
      // app install; the same install re-registering refreshes lastSeenAt.
      await qi.addIndex(
        'Devices',
        ['userId', 'token'],
        { unique: true, name: 'idx_devices_user_token', transaction }
      );
      await qi.addIndex('Devices', ['lastSeenAt'], { name: 'devices_last_seen_at', transaction });
    }
  });
}

async function down({ context }) {
  const qi = context;
  const sequelize = context.sequelize;
  await sequelize.transaction(async (transaction) => {
    await qi.dropTable('Devices', { transaction, cascade: true });
    await qi.removeColumn('Users', 'role', { transaction });
    if (sequelize.getDialect() === 'postgres') {
      await sequelize.query('DROP TYPE IF EXISTS "enum_Users_role"', { transaction });
    }
  });
}

module.exports = { up, down };
