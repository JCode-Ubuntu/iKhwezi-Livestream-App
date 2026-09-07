'use strict';

/**
 * Alerting hooks (Phase 3B).
 *
 *  - If ALERT_WEBHOOK_URL is set, POST a JSON payload signed with
 *    HMAC-SHA256(ALERT_WEBHOOK_SECRET, body) in the X-Alert-Signature header.
 *  - If no webhook is configured, log the alert loudly.
 *  - Never throws: alert delivery failure is itself logged but does not fail
 *    the calling operation.
 */

const crypto = require('crypto');

function signPayload(secret, body) {
  return crypto.createHmac('sha256', String(secret || '')).update(body).digest('hex');
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{}';
  }
}

function createAlerter({ env = process.env, logger = null } = {}) {
  const webhookUrl = (env.ALERT_WEBHOOK_URL || '').trim();
  const webhookSecret = (env.ALERT_WEBHOOK_SECRET || '').trim();
  const log = logger || { error: () => {}, warn: () => {}, info: () => {} };

  async function triggerAlert({ type, message, severity = 'warning', details = {} } = {}) {
    const payload = {
      ts: new Date().toISOString(),
      type: type || 'unknown',
      message: message || '',
      severity,
      details,
    };
    const body = safeStringify(payload);

    if (!webhookUrl) {
      log.error?.(`ALERT: [${severity}] ${type}: ${message}`, { type, severity, details });
      return { sent: false, reason: 'no webhook configured' };
    }

    try {
      const url = new URL(webhookUrl);
      const headers = {
        'Content-Type': 'application/json',
        'X-Alert-Signature': `sha256=${signPayload(webhookSecret, body)}`,
      };
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
      });
      if (!res.ok) {
        log.warn?.(`Alert webhook returned ${res.status}: ${type} - ${message}`);
        return { sent: false, status: res.status };
      }
      return { sent: true, status: res.status };
    } catch (err) {
      log.warn?.(`Alert webhook failed: ${err?.message || err}`);
      return { sent: false, error: err?.message || String(err) };
    }
  }

  return { triggerAlert };
}

module.exports = { createAlerter, signPayload };
