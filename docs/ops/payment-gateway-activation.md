# PayFast is the production payment provider — activation guide

PayFast is now **implemented** (`backend/services/payments/payfast.js`,
provider-agnostic contract unchanged). Turning it on in production is pure
configuration — no code changes, no rewrites, and any future SA gateway
(Yoco/Ozow/Peach) still plugs into the same contract.

## What is already built (no money required to verify)

- **Signed POST checkout** — PayFast's hosted page takes MD5-signed form
  fields; the backend signs them, the frontend auto-submits the form
  (`frontend/src/pages/Profile.jsx` handles `checkoutMethod: 'post'`).
- **ITN (webhook) verification, fail-closed**: MD5 signature →
  server-to-server `/eng/query/validate` re-POST (can be disabled with
  `PAYFAST_SKIP_VALIDATE=1` if PayFast's known 403 issue applies) →
  `payment_status` decoding.
- **Amount integrity**: the ITN's `amount_gross` must match the ledger
  row's coins at the configured ZAR rate before a single coin is credited
  (`verifyPayment` contract hook in `backend/services/payments/index.js`).
- **Idempotency**: replays never double-credit ((provider, providerRef)
  unique ledger constraint). **Audit trail**: every state transition is
  logged; the exact ZAR amount + FX rate are stored on the payment row.

## Operator steps (the only part that needs you)

1. **Sign up / log in** at <https://payfast.io> (sandbox first:
   <https://sandbox.payfast.io>). PayFast requires a verified SA business
   entity for live mode; sandbox needs only an account.
2. In the dashboard: **Settings → Integration**, copy
   - `Merchant ID`
   - `Merchant Key`
   - set a **Passphrase** (required — signatures are not secured without it)
3. In **Settings → Integration**, set the **ITN notify URL** to:
   `https://ikhwezi.site/api/payments/webhook/payfast`
4. **Send me exactly three values** (sandbox now, live later):
   `Merchant ID`, `Merchant Key`, `Passphrase` — plus your chosen
   ZAR-per-USD rate (default suggestion: R18 per $1 → 100 coins = R18).
   I store them as GitHub secrets; the deploy pipeline installs them on the
   server automatically (`PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`,
   `PAYFAST_PASSPHRASE`, `PAYFAST_ZAR_PER_USD`, `PAYFAST_MODE=sandbox|live`).
5. **Verify together**: create a top-up in the app → PayFast sandbox page →
   complete payment → wallet credited exactly once (ledger row `succeeded`);
   replay the ITN → duplicate, no double credit.
6. **Go live**: dashboard → live credentials → same three values sent to me
   → I flip `PAYFAST_MODE=live`. Done.

## Local testing without PayFast

`NODE_ENV != production` + no provider env → the dev provider grants coins
instantly (ledger-tracked). This is what the current local demo uses.

## Reference

- Provider contract: `backend/services/payments/contract.js`
- PayFast provider: `backend/services/payments/payfast.js`
- Service (ledger/wallet/idempotency): `backend/services/payments/index.js`
- ITN endpoint: `POST /api/payments/webhook/payfast` (form-encoded)
- Env reference: `.env.dist` → "PAYMENTS (provider-agnostic)" section
