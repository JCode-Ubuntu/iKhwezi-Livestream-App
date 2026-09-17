'use strict';

/**
 * Stripe provider — ISOLATED implementation of the payment provider contract.
 *
 * Stripe is deliberately PAUSED as the production payment provider (product
 * decision: a South African gateway will be the production provider). This
 * module stays as an optional, fully isolated future provider: it is loaded
 * ONLY when STRIPE_SECRET_KEY is set, and the rest of the payment stack has
 * zero knowledge of Stripe specifics. Nothing here may leak into
 * paymentService.js or the wallet routes.
 *
 * Webhook contract: POST /api/payments/webhook/:provider routes here with the
 * RAW body; constructEvent throws on bad signatures (verified in tests).
 */

function buildStripeProvider({ secretKey, webhookSecret } = {}) {
  if (!secretKey) {
    throw new TypeError('stripe provider requires secretKey');
  }
  // Lazy require: requiring the provider module without a secret must not
  // pull the SDK (keeps the paused state genuinely dependency-light).
  const stripe = require('stripe')(secretKey);

  return {
    id: 'stripe',

    async createCheckout({ payment, coins, amountCents, currency, returnUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: (currency || 'USD').toLowerCase(),
            product_data: { name: `${coins} iKHWEZI Coins` },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        metadata: { paymentId: payment.id, userId: payment.userId, coins: String(coins) },
        success_url: `${returnUrl}?topup=success&payment=${payment.id}`,
        cancel_url: `${returnUrl}?topup=cancelled&payment=${payment.id}`,
      });
      return { checkoutUrl: session.url, providerRef: session.id };
    },

    async parseWebhook({ rawBody, headers }) {
      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }
      // constructEvent verifies the signature and throws on mismatch.
      const event = stripe.webhooks.constructEvent(
        rawBody,
        headers['stripe-signature'],
        webhookSecret,
      );

      if (event.type !== 'checkout.session.completed') {
        return { handled: false };
      }

      const session = event.data.object;
      const coins = parseInt(session.metadata?.coins, 10) || 0;
      const userId = session.metadata?.userId || null;
      if (!coins || !userId) {
        // Malformed metadata: surface as a failed outcome so the service
        // marks the ledger row failed instead of crashing the webhook.
        return {
          handled: true,
          eventId: event.id,
          providerRef: session.id,
          outcome: 'failed',
          failureReason: 'missing checkout metadata',
          coins: 0,
          userId: null,
        };
      }

      return {
        handled: true,
        eventId: event.id,
        providerRef: session.id,
        outcome: 'succeeded',
        coins,
        userId,
      };
    },
  };
}

module.exports = { buildStripeProvider };
