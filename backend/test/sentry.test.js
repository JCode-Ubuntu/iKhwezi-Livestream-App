'use strict';

const test = require('node:test');
const assert = require('assert');
const { createSentryHub, looksLikeDsn } = require('../lib/sentry');

test.describe('sentry hub (Phase 3B)', () => {
  test('is no-op when SENTRY_DSN is unset', () => {
    const hub = createSentryHub({ env: {} });
    assert.strictEqual(hub.enabled, false);
    assert.strictEqual(hub.captureException(new Error('x')), null);
    assert.strictEqual(hub.captureMessage('x'), null);
  });

  test('valid DSN looks like a URL', () => {
    assert.ok(looksLikeDsn('https://abc@example.com/1'));
    assert.ok(!looksLikeDsn(''));
    assert.ok(!looksLikeDsn('not-a-url'));
  });

  test('warns and becomes no-op when @sentry/node is missing', () => {
    const warnings = [];
    const logger = {
      warn: (msg) => warnings.push(msg),
      info: () => {},
      error: () => {},
    };
    const hub = createSentryHub({ env: { SENTRY_DSN: 'https://abc@example.com/1' }, logger });
    assert.strictEqual(hub.enabled, true);
    const result = hub.captureException(new Error('boom'));
    assert.strictEqual(result, null);
    assert(warnings.some((w) => w.includes('@sentry/node')), 'should warn about missing package');
  });
});
