'use strict';

/**
 * Sentry error monitoring — fail-open (Phase 3B).
 *
 * Behavior:
 *   - SENTRY_DSN unset / empty → no-op hub. No request ever fails because
 *     Sentry isn't configured.
 *   - SENTRY_DSN set but @sentry/node not installed → loud warning at first
 *     use, then no-op. This lets operators set the DSN later without needing
 *     a code change; installing @sentry/node is a one-command deploy step.
 *   - SENTRY_DSN set and package present → real Sentry init.
 *
 * No npm dependency is added by default. If the operator wants live
 * monitoring, they install @sentry/node and set SENTRY_DSN.
 */

const crypto = require('crypto');
const { URL } = require('url');

function looksLikeDsn(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.host.length > 0;
  } catch {
    return false;
  }
}

function createSentryHub({ env = process.env, logger = null } = {}) {
  const dsn = (env.SENTRY_DSN || '').trim();
  const environment = env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'development';
  const release = env.SENTRY_RELEASE || env.npm_package_version || null;
  const log = logger || { warn: () => {}, info: () => {}, error: () => {} };

  if (!looksLikeDsn(dsn)) {
    return {
      enabled: false,
      captureException: () => null,
      captureMessage: () => null,
    };
  }

  let sentry = null;
  let warnedMissing = false;

  function init() {
    if (sentry) return sentry;
    try {
      // eslint-disable-next-line global-require
      const Sentry = require('@sentry/node');
      Sentry.init({ dsn, environment, release });
      sentry = Sentry;
      log.info?.('Sentry initialized', { environment, release });
      return sentry;
    } catch (err) {
      if (!warnedMissing) {
        warnedMissing = true;
        log.warn?.(
          `SENTRY_DSN is set but @sentry/node could not be loaded (${err?.message || err}). ` +
          'Install it with: npm install @sentry/node',
        );
      }
      return null;
    }
  }

  function safeScope(scopeFn) {
    const Sentry = init();
    if (!Sentry) return null;
    try {
      return Sentry.withScope(scopeFn);
    } catch (err) {
      log.error?.('Sentry withScope failed:', err?.message || err);
      return null;
    }
  }

  return {
    enabled: true,
    captureException(err, context = {}) {
      const { req, extra } = context;
      return safeScope((scope) => {
        if (req?.id) scope.setTag('correlationId', String(req.id));
        if (req?.user?.id) scope.setUser({ id: String(req.user.id) });
        if (extra && typeof extra === 'object') {
          for (const [key, value] of Object.entries(extra)) {
            scope.setExtra(key, value);
          }
        }
        return Sentry.captureException(err);
      });
    },
    captureMessage(message, level = 'info', context = {}) {
      const { req, extra } = context;
      return safeScope((scope) => {
        if (req?.id) scope.setTag('correlationId', String(req.id));
        if (extra && typeof extra === 'object') {
          for (const [key, value] of Object.entries(extra)) {
            scope.setExtra(key, value);
          }
        }
        scope.setLevel(level);
        return Sentry.captureMessage(message);
      });
    },
  };
}

module.exports = { createSentryHub, looksLikeDsn };
