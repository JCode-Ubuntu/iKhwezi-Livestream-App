'use strict';

/**
 * Authentication for nginx-rtmp → backend callbacks
 * (`/api/live/on-publish`, `/api/live/on-publish-done`).
 *
 * DEFENSE LAYERS (Phase 3A — never claim more than each layer defends):
 *  1. SOURCE ALLOW-LIST (RTMP_WEBHOOK_INTERNAL_ONLY, default true in
 *     production compose): callbacks are accepted ONLY from private/
 *     loopback network IPs — the internal compose network where
 *     nginx-rtmp lives. Defense: a leaked secret alone is NOT enough from
 *     the public internet; the request must also originate inside the
 *     deployment network (X-Forwarded-For is IGNORED — only the socket's
 *     remote address counts, so header spoofing is useless).
 *  2. SHARED SECRET: nginx-rtmp cannot compute HMACs (nginx config
 *     language has no crypto), so a per-deployment secret travels as
 *     ?secret= / x-rtmp-secret and is compared in CONSTANT TIME
 *     (crypto.timingSafeEqual). Defense: containers on the same bridge
 *     network (or a misconfigured peer) cannot call the webhook.
 *  3. RATE LIMIT: enforced at the route (index.js) — 30/min per IP.
 *     Defense: volume abuse / secret brute-force.
 *  4. NOT DEFENDED (honest gap): a caller with BOTH network position AND
 *     the secret can fire publish/stop events. Closing that needs a signer
 *     (HMAC via script or a sidecar proxy) — documented as future work;
 *     the secret is long, rotated per deployment, and never logged.
 *  5. ROTATING SECRET: doc-only today (docs/ops) — rotate
 *     RTMP_WEBHOOK_SECRET via .env + container restart; nginx re-renders
 *     its config from the same value, so both sides stay in sync.
 *
 * Policy (secret layer, unchanged from before):
 *  - secret configured → callback must carry it (403 otherwise).
 *  - secret missing, production → 503 (misconfiguration must be loud).
 *    The legacy TRUST_INTERNAL_RTMP_WEBHOOK private-IP bypass is still
 *    honoured for operators mid-migration, but logs a deprecation warning.
 *  - secret missing, development → allow (local nginx testing).
 */

const crypto = require('crypto');

function isPrivateNetworkIp(ip) {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, '');
  if (normalized === '127.0.0.1' || normalized === '::1') return true;
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  // Docker's default bridge + user-defined compose networks use these subnets.
  if (parts[0] === 172 && parts[1] >= 17 && parts[1] <= 31) return true;
  return false;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

function buildRtmpWebhookGuard({ secret, isProduction, trustInternal, internalOnly, logger = console }) {
  if (trustInternal) {
    logger.warn('⚠️  TRUST_INTERNAL_RTMP_WEBHOOK is enabled — any private-network caller can toggle live status. '
      + 'Wire RTMP_WEBHOOK_SECRET into nginx (see nginx/README) and remove this flag.');
  }
  if (isProduction && !secret) {
    logger.warn('⚠️  RTMP_WEBHOOK_SECRET is not set — nginx-rtmp on-publish callbacks will be rejected (503).');
  }
  // Internal-only gating defaults ON in production, OFF in dev (so an
  // operator can hit the webhook from the host for manual testing).
  const enforceInternal = internalOnly !== undefined
    ? internalOnly !== false
    : !!isProduction;
  if (enforceInternal) {
    logger.info?.('RTMP webhooks: internal-network source enforcement is ON (RTMP_WEBHOOK_INTERNAL_ONLY).');
  }

  /**
   * Express-style guard used inline: returns true when the request may proceed,
   * otherwise writes the error response and returns false.
   */
  function requireRtmpWebhook(req, res) {
    // Layer 1: source allow-list. req.socket.remoteAddress is the actual
    // TCP peer — NOT req.ip, which trusts X-Forwarded-For when a proxy is
    // configured and would let anyone spoof "internal" with a header.
    const remote = req.socket?.remoteAddress;
    if (enforceInternal && !isPrivateNetworkIp(remote)) {
      logger.warn(`Rejected RTMP webhook from EXTERNAL source ${remote} (internal-only enforcement)`);
      res.status(403).send('Forbidden');
      return false;
    }
    if (!secret) {
      if (isProduction) {
        if (trustInternal && isPrivateNetworkIp(remote)) return true;
        logger.error('RTMP_WEBHOOK_SECRET is not set — rejecting on-publish callback in production');
        res.status(503).send('RTMP webhook not configured');
        return false;
      }
      return true; // dev: allow unauthenticated callbacks for local nginx testing
    }
    const provided = req.headers['x-rtmp-secret'] || req.query?.secret;
    if (safeEqual(provided, secret)) return true;
    if (trustInternal && isPrivateNetworkIp(remote)) return true;
    logger.warn(`Rejected RTMP webhook from ${remote}: bad or missing secret`);
    res.status(403).send('Forbidden');
    return false;
  }

  return { requireRtmpWebhook, isPrivateNetworkIp };
}

module.exports = { buildRtmpWebhookGuard, isPrivateNetworkIp, safeEqual };
