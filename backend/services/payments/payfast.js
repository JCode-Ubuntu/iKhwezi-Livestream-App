'use strict';

/**
 * PAYFAST PROVIDER — South African gateway (services/payments/payfast.js).
 *
 * Implements the provider contract (services/payments/contract.js) plus two
 * documented extensions:
 *
 *   1. POST checkout — PayFast's hosted payment page is an HTML <form> POST of
 *      MD5-signed fields (there is no redirect URL like Stripe's). createCheckout
 *      therefore returns { checkoutUrl, checkoutMethod:'post', checkoutFields }
 *      and the client must render a form that auto-POSTs to checkoutUrl.
 *      Stripe/dev keep returning only { checkoutUrl } — the extension is optional
 *      and backward compatible.
 *   2. verifyPayment({ payment, fields }) — optional service-side integrity hook.
 *      The service calls it with the ledger row + decoded ITN fields AFTER the
 *      signature/validate checks pass and BEFORE crediting. PayFast uses it to
 *      enforce that amount_gross (ZAR) matches the ledger row's coins at the
 *      configured rate — a tampered ITN can never credit a different amount.
 *
 * Security model (in order, all fail-closed):
 *   a. MD5 signature over the alphabetically-sorted urlencoded ITN params with
 *      the merchant passphrase appended (PayFast spec).
 *   b. Server-to-server confirmation: re-POST the signed param string to
 *      https://(sandbox.|www.)payfast.co.za/eng/query/validate → must answer
 *      VALID. NOTE: since 2025-08 some merchants report the validate endpoint
 *      answering 403 for perfectly valid ITNs (woocommerce-gateway-payfast
 *      issue #320). PAYFAST_SKIP_VALIDATE=1 is the documented escape hatch —
 *      the MD5 signature check (a) remains active when it is used.
 *   c. payment_status must be COMPLETE for success (CANCELLED/FAILED → failed).
 *   d. Amount verification via verifyPayment (above).
 *
 * Credential handling: secrets are received via the factory, never logged, and
 * never included in thrown errors.
 *
 * Pricing: PayFast settles in ZAR. The ledger stays in its canonical USD coin
 * terms (1 coin = 1 US cent); the ZAR charge is coins × (PAYFAST_ZAR_PER_USD /
 * 100) and the exact rate + amount are recorded in the ledger row's metadata
 * for the audit trail.
 */

const crypto = require('crypto');
const querystring = require('querystring');

const PROCESS_URLS = {
  live: 'https://www.payfast.co.za/eng/process',
  sandbox: 'https://sandbox.payfast.co.za/eng/process',
};
const VALIDATE_URLS = {
  live: 'https://www.payfast.co.za/eng/query/validate',
  sandbox: 'https://sandbox.payfast.co.za/eng/query/validate',
};

/** PayFast URL-encoding: encodeURIComponent with spaces as '+' (per spec). */
function pfEncode(value) {
  return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

/**
 * Build the sorted, urlencoded parameter string (excludes `signature` and
 * empty values — PayFast spec). This is the base for both the MD5 signature
 * and the /eng/query/validate re-POST.
 */
function pfParamString(params) {
  return Object.keys(params)
    .filter((k) => k !== 'signature' && params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
    .sort()
    .map((k) => `${k}=${pfEncode(params[k])}`)
    .join('&');
}

/** PayFast MD5 signature: md5(paramString + '&passphrase=' + enc(passphrase)). */
function pfSignature(params, passphrase) {
  let base = pfParamString(params);
  if (passphrase) base += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash('md5').update(base).digest('hex');
}

/** Flatten querystring.parse's repeated-key arrays deterministically (first wins). */
function flattenParams(parsed) {
  const out = {};
  for (const [k, v] of Object.entries(parsed)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.merchantId        PayFast merchant id (required)
 * @param {string} opts.merchantKey       PayFast merchant key / API key (required)
 * @param {string} opts.passphrase        PayFast passphrase (required for signature security)
 * @param {number} opts.zarPerUsd         ZAR charged per USD of coins (required, > 0)
 * @param {'live'|'sandbox'} [opts.mode]  defaults to 'sandbox'
 * @param {string} [opts.notifyUrl]       override the ITN (webhook) URL
 * @param {boolean} [opts.skipValidate]   skip /eng/query/validate (escape hatch, see header)
 * @param {Function} [opts.fetchImpl]     fetch implementation (injectable for tests)
 */
function buildPayfastProvider({
  merchantId,
  merchantKey,
  passphrase,
  zarPerUsd,
  mode = 'sandbox',
  notifyUrl = null,
  skipValidate = false,
  fetchImpl = null,
} = {}) {
  if (!merchantId || !merchantKey || !passphrase) {
    throw new Error('payfast provider requires merchantId, merchantKey and passphrase');
  }
  const rate = Number(zarPerUsd);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('payfast provider requires a positive zarPerUsd rate');
  }
  const safeMode = PROCESS_URLS[mode] ? mode : 'sandbox';
  const doFetch = fetchImpl || global.fetch;

  /** Ledger coins (USD cents) → ZAR charged at the configured rate. */
  function zarForCoins(coins) {
    return Math.round(((coins * rate) / 100) * 100) / 100;
  }

  return {
    id: 'payfast',
    zarPerUsd: rate,
    mode: safeMode,

    /**
     * Contract: createCheckout → POST-checkout descriptor.
     * The ledger row already exists (status pending, currency USD,
     * amountCents = coins); PayFast references it via m_payment_id = payment.id
     * and the ITN returns that id as m_payment_id.
     */
    async createCheckout({ payment, user, coins, returnUrl }) {
      const zar = zarForCoins(coins);
      const displayName = (user?.displayName || user?.username || 'iKHWEZI user').trim();
      const [nameFirst, ...rest] = displayName.split(/\s+/);
      const fields = {
        merchant_id: merchantId,
        merchant_key: merchantKey,
        return_url: returnUrl,
        cancel_url: returnUrl,
        notify_url: notifyUrl || undefined,
        name_first: nameFirst || 'iKHWEZI',
        name_last: rest.join(' ') || undefined,
        email_address: user?.email || undefined,
        m_payment_id: payment.id,
        amount: zar.toFixed(2),
        item_name: `${coins} iKHWEZI coins`,
        item_description: `iKHWEZI wallet top-up: ${coins} coins (R${zar.toFixed(2)})`,
      };
      const signature = pfSignature(fields, passphrase);
      const checkoutFields = { ...fields, signature };
      return {
        checkoutUrl: PROCESS_URLS[safeMode],
        checkoutMethod: 'post',
        checkoutFields,
        providerRef: payment.id,
        // Audit metadata: exact ZAR charge + rate in force at checkout time.
        metadata: JSON.stringify({ zar: zar.toFixed(2), zarPerUsd: rate, mode: safeMode }),
      };
    },

    /**
     * Contract: parseWebhook — verify MD5 signature (fail-closed), confirm with
     * PayFast's validate endpoint (fail-closed unless disabled), decode the
     * outcome. Coin amounts are NEVER taken from the ITN — the service credits
     * from its own ledger row; amount equality is enforced via verifyPayment.
     */
    async parseWebhook({ rawBody }) {
      const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
      const params = flattenParams(querystring.parse(text));

      const received = String(params.signature || '').toLowerCase();
      const expected = pfSignature(params, passphrase);
      if (!received || received !== expected) {
        const err = new Error('PayFast ITN signature verification failed');
        err.status = 403;
        throw err;
      }

      if (!skipValidate) {
        // Re-POST the signed param string (WITHOUT passphrase — PayFast spec).
        let verdict = '';
        try {
          const res = await doFetch(VALIDATE_URLS[safeMode], {
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'user-agent': 'ikhwezi-payments',
            },
            body: pfParamString(params),
            signal: AbortSignal.timeout(10000),
          });
          verdict = String(await res.text()).trim();
        } catch (err) {
          const e = new Error('PayFast validate endpoint unreachable');
          e.status = 503;
          throw e;
        }
        if (!verdict.startsWith('VALID')) {
          const err = new Error(`PayFast ITN validation failed (${verdict.slice(0, 32) || 'no verdict'})`);
          err.status = 403;
          throw err;
        }
      }

      const status = String(params.payment_status || '').toUpperCase();
      return {
        handled: true,
        eventId: `payfast:${params.pf_payment_id || params.m_payment_id || 'unknown'}:${status}`,
        providerRef: String(params.m_payment_id || ''),
        outcome: status === 'COMPLETE' ? 'succeeded' : 'failed',
        failureReason: status === 'COMPLETE' ? undefined : `PayFast status: ${status || 'MISSING'}`,
        fields: params,
      };
    },

    /**
     * Contract extension: amount integrity. Expected ZAR is recomputed from the
     * LEDGER row's coins (never from the ITN) and must match amount_gross.
     */
    async verifyPayment({ payment, fields }) {
      if (!fields || fields.amount_gross === undefined) return false;
      const actual = Number.parseFloat(String(fields.amount_gross));
      if (!Number.isFinite(actual)) return false;
      const expected = zarForCoins(payment.coins);
      return Math.abs(actual - expected) <= 0.011;
    },
  };
}

/** Build from env; throws (caller degrades to no provider with a loud warn). */
function buildPayfastProviderFromEnv(env = process.env) {
  return buildPayfastProvider({
    merchantId: (env.PAYFAST_MERCHANT_ID || '').trim(),
    merchantKey: (env.PAYFAST_MERCHANT_KEY || '').trim(),
    passphrase: (env.PAYFAST_PASSPHRASE || '').trim(),
    zarPerUsd: Number.parseFloat(env.PAYFAST_ZAR_PER_USD || ''),
    mode: (env.PAYFAST_MODE || 'sandbox').trim() === 'live' ? 'live' : 'sandbox',
    notifyUrl: (env.PAYFAST_NOTIFY_URL || '').trim() || null,
    skipValidate: env.PAYFAST_SKIP_VALIDATE === '1' || env.PAYFAST_SKIP_VALIDATE === 'true',
  });
}

module.exports = {
  buildPayfastProvider,
  buildPayfastProviderFromEnv,
  // exported for tests (regression vectors)
  pfEncode,
  pfParamString,
  pfSignature,
};
