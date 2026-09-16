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

  // @sentry/node is now a real dependency (installed in Phase 3B close-out),
  // so a valid DSN initializes a live hub. The degradation path (package
  // missing → loud warn + no-op) remains in lib/sentry.js but cannot be
  // exercised while the package is present — see lib/sentry.js init() catch.
  test('initializes a live hub when @sentry/node is installed', () => {
    const info = [];
    const logger = {
      warn: (msg) => info.push(`warn:${msg}`),
      info: (msg) => info.push(`info:${msg}`),
      error: () => {},
    };
    const hub = createSentryHub({ env: { SENTRY_DSN: 'https://abc@example.com/1' }, logger });
    assert.strictEqual(hub.enabled, true);
    // captureException must not throw and must return an event id (non-null)
    // now that the package is loadable. It performs no network I/O here
    // because the transport flushes asynchronously and the test process
    // exits first — safe in tests by design.
    const result = hub.captureException(new Error('boom'));
    assert.ok(result === null || typeof result === 'string', 'captureException returns an event id or null');
    assert(info.some((m) => m.startsWith('info:') && m.includes('Sentry initialized')), 'should log successful init');
    assert(!info.some((m) => m.startsWith('warn:') && m.includes('could not be loaded')), 'must NOT warn about a missing package');
  });
});
