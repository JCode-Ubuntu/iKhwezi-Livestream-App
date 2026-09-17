'use strict';

/**
 * PAYMENT SERVICE — the provider-agnostic core of coin top-ups.
 *
 * OWNS (per the payment provider contract in contract.js):
 *   - the Payments ledger (create → pending → succeeded/failed),
 *   - wallet crediting inside a DB transaction with a row lock,
 *   - idempotency via the Payments.status check, the (provider, providerRef)
 *     unique index, and the legacy ProcessedStripeEvents guard (Stripe
 *     webhook replays),
 *   - audit trail (logAudit hook),
 *   - realtime wallet broadcast (emit hook).
 *
 * PROVIDERS only create checkouts and decode webhooks (services/payments/*.js).
 * Adding the South African gateway later = drop in a provider module + env
 * config — no wallet/ledger/route rewrites.
 *
 * Coin pricing stays centralized: 100 coins = $1.00 USD (1 coin = 1 cent).
 */

const COINS_PER_USD = 100;

function buildPaymentService({
  models,
  provider = null,
  isProduction = false,
  logAudit = async () => {},
  emit = () => {},
  logger = null,
} = {}) {
  const { Payment, Wallet, ProcessedStripeEvent } = models;
  const log = logger || { warn: () => {}, error: () => {}, info: () => {} };

  /** Credit coins to a wallet inside a transaction; returns the new balance.
   *  Row lock prevents lost updates against concurrent gifts/spends. */
  async function creditWallet(userId, coins, transaction) {
    const [wallet] = await Wallet.findOrCreate({
      where: { userId },
      defaults: { userId, coins: 0 },
      transaction,
      lock: transaction ? { transaction } : undefined,
    });
    wallet.coins += coins;
    await wallet.save({ transaction });
    return wallet.coins;
  }

  return {
    providerId: provider ? provider.id : null,

    /**
     * Start a top-up. Creates the ledger row FIRST (status pending), then
     * asks the provider for a checkout. Dev provider resolves a grant; real
     * providers resolve { checkoutUrl }.
     * @returns {{ mode:'checkout', checkoutUrl, paymentId }
     *          | { mode:'dev-grant', coins, paymentId }}
     */
    async createTopup({ user, coins, returnUrl }) {
      if (!provider) {
        const err = new Error('Payment processor not configured');
        err.status = 503;
        throw err;
      }
      const amountCents = coins; // 1 coin = 1 cent (100 coins = $1)

      const payment = await Payment.create({
        userId: user.id,
        provider: provider.id,
        coins,
        amountCents,
        currency: 'USD',
        status: 'pending',
      });

      const result = await provider.createCheckout({
        payment,
        coins,
        amountCents,
        currency: 'USD',
        returnUrl,
      });

      if (result.providerRef) {
        payment.providerRef = result.providerRef;
        await payment.save();
      }

      if (result.devGrant) {
        // Dev-mode instant grant — the route refuses this in production.
        const newBalance = await Payment.sequelize.transaction((t) =>
          creditWallet(user.id, coins, t));
        payment.status = 'succeeded';
        payment.providerRef = payment.providerRef || `dev-${payment.id}`;
        await payment.save();
        await logAudit('WALLET_TOPUP_DEV_GRANT', { userId: user.id, coins, paymentId: payment.id }, null);
        emit(`user_${user.id}`, 'wallet-updated', { coins: newBalance });
        return { mode: 'dev-grant', coins: newBalance, paymentId: payment.id };
      }

      await logAudit('WALLET_TOPUP_INITIATED', { userId: user.id, coins, provider: provider.id, paymentId: payment.id }, null);
      return { mode: 'checkout', checkoutUrl: result.checkoutUrl, paymentId: payment.id };
    },

    /**
     * Webhook entry: provider decodes + verifies, service finalizes the
     * ledger + wallet. Idempotent: replays resolve { duplicate: true }.
     */
    async handleWebhook({ rawBody, headers }) {
      if (!provider) {
        const err = new Error('Payment processor not configured');
        err.status = 503;
        throw err;
      }
      const parsed = await provider.parseWebhook({ rawBody, headers });
      if (!parsed || parsed.handled === false) {
        return { ignored: true };
      }
      const { eventId, providerRef, outcome, failureReason } = parsed;

      // Legacy Stripe-replay guard (ProcessedStripeEvents.eventId unique):
      // preserves behavior parity with the pre-refactor webhook path. Other
      // providers skip this (their replays are caught by the ledger below).
      if (provider.id === 'stripe' && eventId) {
        const [, created] = await ProcessedStripeEvent.findOrCreate({
          where: { eventId },
          defaults: { eventId },
        });
        if (!created) return { duplicate: true };
      }

      // Ledger idempotency: find the payment row via (provider, providerRef).
      const payment = await Payment.findOne({ where: { provider: provider.id, providerRef } });
      if (!payment) {
        log.warn?.('payment webhook for unknown providerRef (ledger row missing)', { provider: provider.id });
        return { unknown: true };
      }
      if (payment.status === 'succeeded') {
        return { duplicate: true };
      }

      if (outcome === 'succeeded') {
        const newBalance = await Payment.sequelize.transaction(async (t) => {
          const balance = await creditWallet(payment.userId, payment.coins, t);
          payment.status = 'succeeded';
          await payment.save({ transaction: t });
          return balance;
        });
        emit(`user_${payment.userId}`, 'wallet-updated', { coins: newBalance });
        await logAudit('WALLET_TOPUP_SUCCEEDED', { userId: payment.userId, coins: payment.coins, provider: provider.id, paymentId: payment.id }, null);
        return { credited: true, coins: payment.coins, userId: payment.userId };
      }

      payment.status = 'failed';
      payment.failureReason = failureReason || 'provider reported failure';
      await payment.save();
      await logAudit('WALLET_TOPUP_FAILED', { userId: payment.userId, provider: provider.id, paymentId: payment.id, reason: payment.failureReason }, null);
      return { failed: true, reason: payment.failureReason };
    },

    /** Route helper payload for /api/wallet/me. */
    get capabilities() {
      return {
        provider: provider ? provider.id : null,
        checkoutEnabled: !!(provider && provider.id !== 'dev'),
        devGrantEnabled: !!(provider && provider.id === 'dev'),
      };
    },

    COINS_PER_USD,
  };
}

module.exports = { buildPaymentService, COINS_PER_USD };
