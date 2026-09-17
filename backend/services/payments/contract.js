'use strict';

/**
 * PAYMENT PROVIDER CONTRACT (provider-agnostic payments).
 *
 * A provider plugs into buildPaymentService() and implements exactly:
 *
 *   id: string                        — 'stripe' | 'dev' | 'payfast' | ...
 *   async createCheckout({ payment, user, coins, amountCents, currency, returnUrl })
 *       → { checkoutUrl }             — start a hosted payment; throw on failure.
 *                                       `payment` is the already-created Payments row.
 *   async parseWebhook({ rawBody, headers })
 *       → { handled: false }          — provider has no webhook (e.g. dev).
 *       → { handled: true, eventId, providerRef, outcome: 'succeeded'|'failed',
 *           failureReason? , coins, userId }
 *                                     — verify signature, decode the event.
 *                                       MUST throw on bad signatures.
 *
 * Rules (same honesty rules as storage-v2/meetings):
 *   - A provider NEVER touches the wallet directly. It only creates checkouts
 *     and decodes webhooks; the SERVICE owns crediting, idempotency, ledger
 *     state transitions and audit. This is what keeps "subscribe → configure →
 *     enable" possible without rewrites later.
 *   - No credentials may ever be logged. Providers receive secrets via the
 *     factory and must not expose them in errors they throw.
 */
