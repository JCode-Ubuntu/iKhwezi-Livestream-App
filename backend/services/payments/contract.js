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
 *       → { checkoutUrl, checkoutMethod:'post', checkoutFields, metadata? }
 *                                     — POST-checkout extension (PayFast): the
 *                                       client renders an auto-POSTing form to
 *                                       checkoutUrl carrying checkoutFields
 *                                       (already provider-signed). `metadata`,
 *                                       when present, is stored on the ledger
 *                                       row for the audit trail.
 *   async parseWebhook({ rawBody, headers })
 *       → { handled: false }          — provider has no webhook (e.g. dev).
 *       → { handled: true, eventId, providerRef, outcome: 'succeeded'|'failed',
 *           failureReason? , coins, userId, fields? }
 *                                     — verify signature, decode the event.
 *                                       MUST throw on bad signatures.
 *                                       `fields` (optional) carries the decoded
 *                                       notification for verifyPayment.
 *   async verifyPayment({ payment, fields })   — OPTIONAL integrity hook.
 *       → boolean                     — called by the service after signature
 *                                       checks pass, BEFORE crediting: lets an
 *                                       amount-bearing provider (PayFast ZAR)
 *                                       prove the notification matches the
 *                                       ledger row. Returning false fails the
 *                                       payment (fail-closed).
 *
 * Rules (same honesty rules as storage-v2/meetings):
 *   - A provider NEVER touches the wallet directly. It only creates checkouts
 *     and decodes webhooks; the SERVICE owns crediting, idempotency, ledger
 *     state transitions and audit. This is what keeps "subscribe → configure →
 *     enable" possible without rewrites later.
 *   - No credentials may ever be logged. Providers receive secrets via the
 *     factory and must not expose them in errors they throw.
 */
