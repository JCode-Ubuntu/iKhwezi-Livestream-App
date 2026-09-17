'use strict';

/**
 * PAYMENTS LEDGER — provider-agnostic payment transactions.
 *
 * Adds the Payments table: ONE row per payment intent, created BEFORE the
 * user is redirected to the provider (status 'pending'), finalized by the
 * provider's webhook. `provider` is recorded per row so the future South
 * African gateway coexists with the (paused) Stripe provider without schema
 * churn. (provider, providerRef) is UNIQUE — the idempotency anchor for
 * webhook-driven finalization: replayed webhooks can never double-credit.
 *
 * Dialect-portable (SQLite + PostgreSQL), mirrors 0001 conventions: UUID PKs,
 * no PRAGMAs, no TINYINT literals, explicit timestamps. Partial indexes are
 * deliberately avoided for portability; indexes here are plain.
 */

const { DataTypes } = require('sequelize');

async function up({ context }) {
  const createTable = context.createTable.bind(context);
  const addIndex = context.addIndex.bind(context);
  const sequelize = context.sequelize;
  await sequelize.transaction(async (transaction) => {
    await createTable('Payments', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'dev-grant' },
      providerRef: { type: DataTypes.STRING(255), allowNull: true },
      coins: { type: DataTypes.INTEGER, allowNull: false },
      amountCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'USD' },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
      failureReason: { type: DataTypes.STRING(255), allowNull: true },
      metadata: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await addIndex('Payments', ['userId'], { name: 'payments_user_id', transaction });
    await addIndex('Payments', ['status'], { name: 'payments_status', transaction });
    await addIndex('Payments', ['provider', 'providerRef'], { unique: true, name: 'payments_provider_ref', transaction });
  });
}

async function down({ context }) {
  const dropTable = context.dropTable.bind(context);
  const sequelize = context.sequelize;
  await sequelize.transaction(async (transaction) => {
    await dropTable('Payments', { transaction, cascade: true });
  });
}

module.exports = { up, down };
