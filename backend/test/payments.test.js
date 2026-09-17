'use strict';

const test = require('node:test');
const assert = require('assert');
const crypto = require('crypto');
const querystring = require('querystring');
const { Sequelize, DataTypes } = require('sequelize');

const { defineCoreModels } = require('../models');
const { buildPaymentService } = require('../services/payments');
const { buildStripeProvider } = require('../services/payments/stripe');
const { buildDevProvider } = require('../services/payments/dev');
const { buildPayfastProvider, pfSignature, pfParamString } = require('../services/payments/payfast');

async function buildDb() {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const models = defineCoreModels(sequelize, DataTypes);
  await sequelize.sync({ force: true });
  // FK parity: Wallet.userId / Payments.userId reference Users (0001 constraints).
  // Real flows always have a registered user; create one and reuse its id so
  // tests enforce the same constraints production enforces.
  const user = await models.User.create({ username: 'paytest', password: 'x' });
  return { sequelize, models, userId: user.id };
}

/** Stripe-compatible webhook signature header (HMAC-SHA256 of "t.payload"). */
function stripeSignatureHeader(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

test.describe('payment service (provider-agnostic)', () => {
  test('createTopup without provider → 503, nothing created', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const svc = buildPaymentService({ models, provider: null });
      await assert.rejects(
        () => svc.createTopup({ user: { id: userId }, coins: 100, returnUrl: 'http://x' }),
        (err) => err.status === 503,
      );
      assert.strictEqual(await models.Payment.count(), 0, 'no ledger row on unconfigured provider');
    } finally { await sequelize.close(); }
  });

  test('dev provider: instant grant credits wallet, ledger row succeeded, audited', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const audits = [];
      const emitted = [];
      const svc = buildPaymentService({
        models,
        provider: buildDevProvider(),
        logAudit: async (action, details) => audits.push({ action, details }),
        emit: (room, event, payload) => emitted.push({ room, event, payload }),
      });
      await models.Wallet.create({ userId: userId, coins: 0 });

      const result = await svc.createTopup({ user: { id: userId }, coins: 100, returnUrl: 'http://x' });
      assert.strictEqual(result.mode, 'dev-grant');
      assert.strictEqual(result.coins, 100);

      const wallet = await models.Wallet.findOne({ where: { userId: userId } });
      assert.strictEqual(wallet.coins, 100);

      const payment = await models.Payment.findOne({ where: { userId: userId } });
      assert.ok(payment, 'ledger row created');
      assert.strictEqual(payment.status, 'succeeded');
      assert.strictEqual(payment.provider, 'dev');
      assert.strictEqual(payment.coins, 100);
      assert.strictEqual(payment.amountCents, 100, '1 coin = 1 cent');
      assert.ok(payment.providerRef.startsWith('dev-'), 'providerRef backfilled for dev grants');

      assert(audits.some((a) => a.action === 'WALLET_TOPUP_DEV_GRANT'));
      assert(emitted.some((e) => e.event === 'wallet-updated' && e.payload.coins === 100));
      assert.strictEqual(svc.capabilities.devGrantEnabled, true);
      assert.strictEqual(svc.capabilities.checkoutEnabled, false);
    } finally { await sequelize.close(); }
  });

  test('real provider webhook: success path credits wallet once, replays are duplicates', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const provider = {
        id: 'fakepay',
        createCheckout: async () => ({ checkoutUrl: 'https://pay.example/checkout', providerRef: 'tx_1' }),
        parseWebhook: async ({ rawBody }) => JSON.parse(rawBody.toString('utf8')),
      };
      const svc = buildPaymentService({ models, provider });

      const payment = await models.Payment.create({
        userId: userId, provider: 'fakepay', providerRef: 'tx_1',
        coins: 50, amountCents: 50, currency: 'USD', status: 'pending',
      });
      await models.Wallet.create({ userId: userId, coins: 0 });

      const event = (outcome) => JSON.stringify({
        handled: true, eventId: `evt_${outcome}`, providerRef: 'tx_1',
        outcome, coins: 50, userId: userId,
      });

      const first = await svc.handleWebhook({ rawBody: Buffer.from(event('succeeded')), headers: {} });
      assert.strictEqual(first.credited, true);
      const wallet = await models.Wallet.findOne({ where: { userId: userId } });
      assert.strictEqual(wallet.coins, 50);
      await payment.reload();
      assert.strictEqual(payment.status, 'succeeded');

      // Replay → duplicate, no double credit.
      const replay = await svc.handleWebhook({ rawBody: Buffer.from(event('succeeded')), headers: {} });
      assert.strictEqual(replay.duplicate, true);
      const walletAfter = await models.Wallet.findOne({ where: { userId: userId } });
      assert.strictEqual(walletAfter.coins, 50, 'wallet credited exactly once');

      // Succeeded payment + a NEW event id (Stripe would retry with same id,
      // but a second distinct success event must also not double-credit).
      const secondEvent = JSON.stringify({
        handled: true, eventId: 'evt_other', providerRef: 'tx_1',
        outcome: 'succeeded', coins: 50, userId: userId,
      });
      const second = await svc.handleWebhook({ rawBody: Buffer.from(secondEvent), headers: {} });
      assert.strictEqual(second.duplicate, true, 'ledger status is the second idempotency layer');
    } finally { await sequelize.close(); }
  });

  test('real provider webhook: failed outcome marks ledger failed with reason', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const provider = {
        id: 'fakepay',
        createCheckout: async () => ({ checkoutUrl: 'https://pay.example/checkout', providerRef: 'tx_2' }),
        parseWebhook: async ({ rawBody }) => JSON.parse(rawBody.toString('utf8')),
      };
      const svc = buildPaymentService({ models, provider });
      await models.Payment.create({
        userId: userId, provider: 'fakepay', providerRef: 'tx_2',
        coins: 10, amountCents: 10, currency: 'USD', status: 'pending',
      });

      const result = await svc.handleWebhook({
        rawBody: Buffer.from(JSON.stringify({
          handled: true, eventId: 'evt_f1', providerRef: 'tx_2',
          outcome: 'failed', failureReason: 'card declined', coins: 0, userId: userId,
        })),
        headers: {},
      });
      assert.strictEqual(result.failed, true);
      const payment = await models.Payment.findOne({ where: { providerRef: 'tx_2' } });
      assert.strictEqual(payment.status, 'failed');
      assert.strictEqual(payment.failureReason, 'card declined');
    } finally { await sequelize.close(); }
  });

  test('webhook for unknown providerRef → { unknown }, nothing crashes', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const provider = {
        id: 'fakepay',
        createCheckout: async () => ({}),
        parseWebhook: async () => ({
          handled: true, eventId: 'evt_x', providerRef: 'nope',
          outcome: 'succeeded', coins: 5, userId: userId,
        }),
      };
      const svc = buildPaymentService({ models, provider });
      const result = await svc.handleWebhook({ rawBody: Buffer.from('{}'), headers: {} });
      assert.strictEqual(result.unknown, true);
    } finally { await sequelize.close(); }
  });

  test('unhandled provider event → { ignored }', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const svc = buildPaymentService({ models, provider: buildDevProvider() });
      const result = await svc.handleWebhook({ rawBody: Buffer.from('{}'), headers: {} });
      assert.strictEqual(result.ignored, true);
    } finally { await sequelize.close(); }
  });
});

test.describe('stripe provider (isolated, paused)', () => {
  const SECRET = 'whsec_test_123';

  function makeEvent() {
    return {
      id: 'evt_stripe_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          metadata: { userId: 'user-abc', coins: '75', paymentId: 'p1' },
        },
      },
    };
  }

  test('valid signature → decoded success outcome', async () => {
    const provider = buildStripeProvider({ secretKey: 'sk_test_dummy', webhookSecret: SECRET });
    const payload = Buffer.from(JSON.stringify(makeEvent()));
    const parsed = await provider.parseWebhook({
      rawBody: payload,
      headers: { 'stripe-signature': stripeSignatureHeader(payload.toString('utf8'), SECRET) },
    });
    assert.strictEqual(parsed.handled, true);
    assert.strictEqual(parsed.outcome, 'succeeded');
    assert.strictEqual(parsed.providerRef, 'cs_test_1');
    assert.strictEqual(parsed.coins, 75);
    assert.strictEqual(parsed.userId, 'user-abc');
  });

  test('invalid signature → THROWS (never silently accepted)', async () => {
    const provider = buildStripeProvider({ secretKey: 'sk_test_dummy', webhookSecret: SECRET });
    const payload = Buffer.from(JSON.stringify(makeEvent()));
    await assert.rejects(() => provider.parseWebhook({
      rawBody: payload,
      headers: { 'stripe-signature': stripeSignatureHeader(payload.toString('utf8'), 'whsec_WRONG') },
    }));
  });

  test('non-checkout events → handled:false (ignored, not failed)', async () => {
    const provider = buildStripeProvider({ secretKey: 'sk_test_dummy', webhookSecret: SECRET });
    const evt = makeEvent();
    evt.type = 'invoice.paid';
    const payload = Buffer.from(JSON.stringify(evt));
    const parsed = await provider.parseWebhook({
      rawBody: payload,
      headers: { 'stripe-signature': stripeSignatureHeader(payload.toString('utf8'), SECRET) },
    });
    assert.strictEqual(parsed.handled, false);
  });

  test('checkout.session.completed with missing metadata → failed outcome (no crash)', async () => {
    const provider = buildStripeProvider({ secretKey: 'sk_test_dummy', webhookSecret: SECRET });
    const evt = makeEvent();
    evt.data.object.metadata = {};
    const payload = Buffer.from(JSON.stringify(evt));
    const parsed = await provider.parseWebhook({
      rawBody: payload,
      headers: { 'stripe-signature': stripeSignatureHeader(payload.toString('utf8'), SECRET) },
    });
    assert.strictEqual(parsed.outcome, 'failed');
    assert.strictEqual(parsed.userId, null);
  });

  test('provider refuses to build without a secret key', () => {
    assert.throws(() => buildStripeProvider({ secretKey: '' }), TypeError);
  });
});

test.describe('payfast provider', () => {
  const PF = {
    merchantId: '10000100',
    merchantKey: '46f0cd694581a',
    passphrase: 'test-passphrase',
    zarPerUsd: 18,
    mode: 'sandbox',
  };

  /** Build a valid, signed ITN body for `coins` at PF's rate. */
  function signedItn({ coins = 100, paymentId = '11111111-1111-4111-8111-111111111111', status = 'COMPLETE', pfPaymentId = '999' }) {
    const zar = ((coins * PF.zarPerUsd) / 100).toFixed(2);
    const params = {
      m_payment_id: paymentId,
      pf_payment_id: pfPaymentId,
      payment_status: status,
      amount_gross: zar,
      item_name: `${coins} iKHWEZI coins`,
      merchant_id: PF.merchantId,
      email_address: 'user@test.local',
    };
    return querystring.stringify({ ...params, signature: pfSignature(params, PF.passphrase) });
  }

  test('factory requires full config and a positive rate', () => {
    assert.throws(() => buildPayfastProvider({ merchantId: '1', merchantKey: 'k' }), /passphrase/);
    assert.throws(() => buildPayfastProvider({ ...PF, zarPerUsd: 0 }), /zarPerUsd/);
    assert.throws(() => buildPayfastProvider({ ...PF, zarPerUsd: -5 }), /zarPerUsd/);
  });

  test('createCheckout returns signed POST-form fields and ZAR metadata', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const provider = buildPayfastProvider({ ...PF, notifyUrl: 'https://ikhwezi.site/api/payments/webhook/payfast' });
      const payment = await models.Payment.create({ userId, provider: 'payfast', coins: 250, amountCents: 250, currency: 'USD', status: 'pending' });
      const user = await models.User.findByPk(userId);

      const result = await provider.createCheckout({ payment, user, coins: 250, returnUrl: 'https://ikhwezi.site/profile/x' });
      assert.strictEqual(result.checkoutMethod, 'post');
      assert.strictEqual(result.checkoutUrl, 'https://sandbox.payfast.co.za/eng/process');
      assert.strictEqual(result.providerRef, payment.id);
      assert.strictEqual(result.checkoutFields.m_payment_id, payment.id);
      assert.strictEqual(result.checkoutFields.amount, '45.00', '250 coins × R18 per $1 = R45.00');
      assert.strictEqual(result.checkoutFields.notify_url, 'https://ikhwezi.site/api/payments/webhook/payfast');
      assert.ok(result.checkoutFields.signature, 'fields carry a signature');
      assert.strictEqual(result.checkoutFields.signature, pfSignature(result.checkoutFields, PF.passphrase), 'signature self-consistent');
      assert.strictEqual(JSON.parse(result.metadata).zar, '45.00');
      assert.strictEqual(JSON.parse(result.metadata).zarPerUsd, 18);
    } finally { await sequelize.close(); }
  });

  test('valid COMPLETE ITN (validate disabled) credits the wallet once; replay is a duplicate', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const audits = []; const emitted = [];
      const svc = buildPaymentService({
        models,
        provider: buildPayfastProvider({ ...PF, skipValidate: true }),
        logAudit: async (a, d) => audits.push({ a, d }),
        emit: (room, event, payload) => emitted.push({ event, payload }),
      });
      const payment = await models.Payment.create({ userId, provider: 'payfast', coins: 100, amountCents: 100, currency: 'USD', status: 'pending' });
      payment.providerRef = payment.id; await payment.save(); // parity with createTopup flow
      await models.Wallet.create({ userId, coins: 0 });

      const result = await svc.handleWebhook({ rawBody: Buffer.from(signedItn({ coins: 100, paymentId: payment.id })), headers: {} });
      assert.ok(result.credited, 'webhook credited');
      const wallet = await models.Wallet.findOne({ where: { userId } });
      assert.strictEqual(wallet.coins, 100);
      const row = await models.Payment.findByPk(payment.id);
      assert.strictEqual(row.status, 'succeeded');

      const replay = await svc.handleWebhook({ rawBody: Buffer.from(signedItn({ coins: 100, paymentId: payment.id })), headers: {} });
      assert.ok(replay.duplicate);
      assert.strictEqual((await models.Wallet.findOne({ where: { userId } })).coins, 100, 'no double credit');
      assert(audits.some((x) => x.a === 'WALLET_TOPUP_SUCCEEDED'));
      assert(emitted.some((e) => e.event === 'wallet-updated' && e.payload.coins === 100));
    } finally { await sequelize.close(); }
  });

  test('ITN amount must match the ledger row (fail-closed against foreign/tampered notifications)', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const svc = buildPaymentService({
        models,
        provider: buildPayfastProvider({ ...PF, skipValidate: true }),
      });
      // Valid R18.00 ITN (100 coins) replayed against a 1000-coin ledger row:
      // signature + validate would pass, but verifyPayment must refuse.
      const payment = await models.Payment.create({ userId, provider: 'payfast', coins: 1000, amountCents: 1000, currency: 'USD', status: 'pending' });
      payment.providerRef = payment.id; await payment.save();
      await models.Wallet.create({ userId, coins: 0 });

      const result = await svc.handleWebhook({ rawBody: Buffer.from(signedItn({ coins: 100, paymentId: payment.id })), headers: {} });
      assert.ok(result.failed, 'foreign ITN fails');
      assert.strictEqual(result.reason, 'amount verification failed');
      const row = await models.Payment.findByPk(payment.id);
      assert.strictEqual(row.status, 'failed');
      assert.strictEqual(row.failureReason, 'amount verification failed');
      assert.strictEqual((await models.Wallet.findOne({ where: { userId } })).coins, 0, 'nothing credited');
    } finally { await sequelize.close(); }
  });

  test('bad signature → 403, CANCELLED → failed, validate-unreachable → 503', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const provider = buildPayfastProvider({ ...PF, skipValidate: true });
      const svc = buildPaymentService({ models, provider });

      const payment = await models.Payment.create({ userId, provider: 'payfast', coins: 100, amountCents: 100, currency: 'USD', status: 'pending' });
      payment.providerRef = payment.id; await payment.save();
      const tampered = signedItn({ coins: 100, paymentId: payment.id }).replace(/signature=[0-9a-f]+/, 'signature=deadbeefdeadbeefdeadbeefdeadbeef');
      await assert.rejects(
        () => svc.handleWebhook({ rawBody: Buffer.from(tampered), headers: {} }),
        (err) => err.status === 403,
      );

      const payment2 = await models.Payment.create({ userId, provider: 'payfast', coins: 100, amountCents: 100, currency: 'USD', status: 'pending' });
      payment2.providerRef = payment2.id; await payment2.save();
      const cancelled = await svc.handleWebhook({ rawBody: Buffer.from(signedItn({ coins: 100, paymentId: payment2.id, status: 'CANCELLED', pfPaymentId: '998' })), headers: {} });
      assert.ok(cancelled.failed);
      assert.match(cancelled.reason, /CANCELLED/);
      assert.strictEqual((await models.Payment.findByPk(payment2.id)).status, 'failed');

      const strictProvider = buildPayfastProvider({
        ...PF,
        fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
      });
      await assert.rejects(
        () => strictProvider.parseWebhook({ rawBody: Buffer.from(signedItn({ pfPaymentId: '997' })) }),
        (err) => err.status === 503,
      );
    } finally { await sequelize.close(); }
  });

  test('validate endpoint VALID verdict passes end-to-end with a stubbed fetch', async () => {
    const { sequelize, models, userId } = await buildDb();
    try {
      const svc = buildPaymentService({
        models,
        provider: buildPayfastProvider({
          ...PF,
          fetchImpl: async (url, opts) => {
            assert.ok(String(url).includes('/eng/query/validate'), 'validate endpoint called');
            assert.ok(String(opts.body).includes('m_payment_id'), 'signed param string re-POSTed');
            return { text: async () => 'VALID' };
          },
        }),
      });
      const payment = await models.Payment.create({ userId, provider: 'payfast', coins: 500, amountCents: 500, currency: 'USD', status: 'pending' });
      payment.providerRef = payment.id; await payment.save();
      await models.Wallet.create({ userId, coins: 0 });
      const result = await svc.handleWebhook({ rawBody: Buffer.from(signedItn({ coins: 500, paymentId: payment.id, pfPaymentId: '996' })), headers: {} });
      assert.ok(result.credited);
      assert.strictEqual((await models.Wallet.findOne({ where: { userId } })).coins, 500);
    } finally { await sequelize.close(); }
  });

  test('signature helper follows PayFast published encoding rules', () => {
    const params = { b: 'x y', a: '1' };
    assert.strictEqual(pfParamString(params), 'a=1&b=x+y', 'sorted keys, + for spaces');
    const sig = pfSignature(params, 'pp');
    assert.ok(/^[0-9a-f]{32}$/.test(sig), 'lowercase md5 hex');
  });
});
