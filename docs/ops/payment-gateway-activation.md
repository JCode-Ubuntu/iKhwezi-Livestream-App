# BLOCKER: payment gateway activation — operator actions required (later, when funded)

Stripe is deliberately PAUSED as the production payment provider.
The payment stack is provider-agnostic (see `backend/services/payments/
contract.js`); activating the future South African gateway is a
config exercise, not a rewrite.

## What already works today (no money required)

- Dev top-ups: run locally with NODE_ENV != production → instant coin
  grants, full ledger tracking (Payments table).
- Production without a provider: top-ups honestly answer 503
  "Payment processor not configured". Gifting/subscriptions keep
  working from existing coins.

## South African gateway — shortlist (decision later)

| Provider | Notes |
|---|---|
| PayFast | Most common in SA; hosted checkout + ITN (webhook) callback; supports cards, SnapScan, Mobicred, etc. |
| Yoco | Simple hosted checkout / API; good developer docs. |
| Ozow | Instant EFT focus; good for bank-transfer-heavy audiences. |
| Peach Payments | Card + EFT, broader enterprise features. |

Pick based on fees, settlement currency (ZAR), payout cadence and
webhook reliability — the integration surface below is identical for
all of them.

## Activation steps (when subscribed)

1. **Provider module** — add `backend/services/payments/<provider>.js`
   implementing the contract:
   - `createCheckout({ payment, coins, amountCents, currency, returnUrl })`
     → `{ checkoutUrl, providerRef }`
   - `parseWebhook({ rawBody, headers })` →
     `{ handled, eventId, providerRef, outcome, coins, userId }`
     (verify the signature inside; throw on mismatch).
2. **Env selection** — extend `buildPaymentProviderFromEnv` in
   `backend/index.js` with the provider's env vars (e.g.
   `PAYFAST_MERCHANT_ID`, `PAYFAST_API_TOKEN`, ...). Precedence must be
   explicit if both providers are ever configured.
3. **Webhook route** — add the path to `PAYMENT_WEBHOOK_PATHS`
   (e.g. `/api/payments/webhook/payfast`). Raw-body middleware already
   handles capture; the service owns ledger + wallet + idempotency.
4. **Currency** — payments are USD/coins-denominated (1 coin = 1 cent,
   100 coins = $1). For ZAR settlement, either convert at checkout
   (provider-side) or make `currency` env-driven — the ledger stores it
   per row already.
5. **Test** — provider sandbox → `createTopup` → webhook → ledger row
   `succeeded` + wallet credited exactly once (replay the webhook to
   verify idempotency).
6. **Enable in production** — set the env vars on the server, recreate
   backend. `wallet/me` → `payments.capabilities` flips automatically.

## Optional: re-enabling Stripe later

Install state already present (optionalDependency). Set
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, point the Stripe webhook
endpoint at `/api/payments/webhook/stripe` (or the legacy
`/api/stripe/webhook` alias), register the webhook in the Stripe
dashboard for `checkout.session.completed`. Nothing else changes.
