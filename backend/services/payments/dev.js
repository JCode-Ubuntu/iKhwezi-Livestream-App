'use strict';

/**
 * Dev provider — local-development top-ups WITHOUT any real payment provider.
 *
 * Deliberately NOT registered as a fallback in production: buildPaymentService
 * refuses to select it when IS_PRODUCTION, so "free coins" can never leak into
 * production merely because no gateway is configured (a configured gateway is
 * required there; until then top-ups are honestly disabled).
 *
 * createCheckout resolves { devGrant: true } instead of a hosted checkout URL;
 * the route translates that into the instant grant. parseWebhook always
 * reports unhandled — the dev grant is synchronous by design.
 */

function buildDevProvider() {
  return {
    id: 'dev',

    async createCheckout({ payment }) {
      return { devGrant: true, paymentId: payment.id };
    },

    async parseWebhook() {
      return { handled: false };
    },
  };
}

module.exports = { buildDevProvider };
