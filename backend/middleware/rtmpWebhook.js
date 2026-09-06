'use strict';

/**
 * Authentication for nginx-rtmp → backend callbacks
 * (`/api/live/on-publish`, `/api/live/on-publish-done`).
 *
 * nginx-rtmp cannot add custom headers to its on_publish notifications, but it
 * can carry a query string. The nginx image in ./nginx renders
 * `?secret=${RTMP_WEBHOOK_SECRET}` into nginx.conf at container start, and this
 * guard verifies it here (header `x-rtmp-secret` is also accepted for manual
 * tooling). Comparison is constant-time.
 *
 * Policy:
 *  - secret configured → callback must carry it (403 otherwise).
 *  - secret missing, production → 503 (misconfiguration must be loud, because a
 *    silently open webhook lets anyone flip the site "live"). The legacy
 *    TRUST_INTERNAL_RTMP_WEBHOOK private-IP bypass is still honoured for
 *    operators mid-migration, but it logs a deprecation warning at boot and
 *    should be removed from docker-compose once the secret is wired (it is,
 *    by default, in this repo's compose file).
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
  return false;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

function buildRtmpWebhookGuard({ secret, isProduction, trustInternal, logger = console }) {
  if (trustInternal) {
    logger.warn('⚠️  TRUST_INTERNAL_RTMP_WEBHOOK is enabled — any private-network caller can toggle live status. '
      + 'Wire RTMP_WEBHOOK_SECRET into nginx (see nginx/README) and remove this flag.');
  }
  if (isProduction && !secret) {
    logger.warn('⚠️  RTMP_WEBHOOK_SECRET is not set — nginx-rtmp on-publish callbacks will be rejected (503).');
  }

  /**
   * Express-style guard used inline: returns true when the request may proceed,
   * otherwise writes the error response and returns false.
   */
  function requireRtmpWebhook(req, res) {
    const remote = req.socket?.remoteAddress;
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
