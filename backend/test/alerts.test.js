'use strict';

const test = require('node:test');
const assert = require('assert');
const http = require('http');
const { createAlerter, signPayload } = require('../lib/alerts');

test.describe('alerter (Phase 3B)', () => {
  test('logs loudly when no webhook is configured', async () => {
    const errors = [];
    const logger = { error: (msg, details) => errors.push({ msg, details }) };
    const alerter = createAlerter({ env: {}, logger });
    const result = await alerter.triggerAlert({ type: 'test', message: 'hello', severity: 'critical' });
    assert.strictEqual(result.sent, false);
    assert.ok(errors[0].msg.includes('ALERT'));
    assert.strictEqual(errors[0].details.type, 'test');
  });

  test('signs payload with HMAC-SHA256', () => {
    const sig = signPayload('secret', 'body');
    assert.strictEqual(typeof sig, 'string');
    assert.strictEqual(sig.length, 64);
  });

  test('sends signed POST to webhook and returns sent=true', async () => {
    let received = null;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        received = { headers: req.headers, body };
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const alerter = createAlerter({ env: { ALERT_WEBHOOK_URL: `http://127.0.0.1:${port}/hook`, ALERT_WEBHOOK_SECRET: 'shh' } });
      const result = await alerter.triggerAlert({ type: 'disk', message: 'low', severity: 'warning' });
      assert.strictEqual(result.sent, true);
      assert.strictEqual(result.status, 200);
      assert.ok(received.headers['x-alert-signature'].startsWith('sha256='));
      const parsed = JSON.parse(received.body);
      assert.strictEqual(parsed.type, 'disk');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('returns sent=false on non-2xx webhook', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(500);
      res.end('err');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const alerter = createAlerter({ env: { ALERT_WEBHOOK_URL: `http://127.0.0.1:${port}/hook`, ALERT_WEBHOOK_SECRET: 'shh' } });
      const result = await alerter.triggerAlert({ type: 'x', message: 'y' });
      assert.strictEqual(result.sent, false);
      assert.strictEqual(result.status, 500);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
