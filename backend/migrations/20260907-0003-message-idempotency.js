'use strict';

/**
 * Phase 4/5 Messages hardening: idempotent sends.
 *
 * Adds clientMessageId columns to DirectMessages and GroupMessages so a
 * retry with the same client-generated id returns the already-persisted
 * row instead of creating a duplicate. The unique index is on
 * (senderId, clientMessageId) — a user can reuse an id across users/groups,
 * but not for two of their own messages.
 *
 * Nullable + no default: existing rows stay valid; new sends must supply it.
 */

const { DataTypes } = require('sequelize');

async function up({ context }) {
  const sequelize = context.sequelize;
  const qi = context;
  await sequelize.transaction(async (transaction) => {
    const tables = new Set((await qi.showAllTables()).map((t) => String(t).toLowerCase()));

    if (tables.has('directmessages')) {
      const dmTable = await qi.describeTable('DirectMessages');
      if (!Object.prototype.hasOwnProperty.call(dmTable, 'clientMessageId')) {
        await qi.addColumn('DirectMessages', 'clientMessageId', {
          type: DataTypes.STRING(255),
          allowNull: true,
        }, { transaction });
        await qi.addIndex('DirectMessages', ['senderId', 'clientMessageId'], {
          unique: true,
          name: 'direct_messages_sender_client_msg_id',
          transaction,
        });
      }
    }

    if (tables.has('groupmessages')) {
      const gmTable = await qi.describeTable('GroupMessages');
      if (!Object.prototype.hasOwnProperty.call(gmTable, 'clientMessageId')) {
        await qi.addColumn('GroupMessages', 'clientMessageId', {
          type: DataTypes.STRING(255),
          allowNull: true,
        }, { transaction });
        await qi.addIndex('GroupMessages', ['senderId', 'clientMessageId'], {
          unique: true,
          name: 'group_messages_sender_client_msg_id',
          transaction,
        });
      }
    }
  });
}

async function down({ context }) {
  const sequelize = context.sequelize;
  const qi = context;
  await sequelize.transaction(async (transaction) => {
    await qi.removeIndex('DirectMessages', 'direct_messages_sender_client_msg_id', { transaction });
    await qi.removeColumn('DirectMessages', 'clientMessageId', { transaction });
    await qi.removeIndex('GroupMessages', 'group_messages_sender_client_msg_id', { transaction });
    await qi.removeColumn('GroupMessages', 'clientMessageId', { transaction });
  });
}

module.exports = { up, down };
