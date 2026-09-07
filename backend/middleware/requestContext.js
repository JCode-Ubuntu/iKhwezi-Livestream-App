'use strict';

/**
 * Request context middleware (Phase 3B).
 *
 *  - Assigns a correlation ID: `X-Correlation-Id` header if present, else
 *    crypto.randomUUID().
 *  - Binds a child logger with the correlation ID to `req.logger`.
 *  - Logs each HTTP request with method, path, status, duration, userId,
 *    and response size.
 *  - Health endpoints are logged at debug level in production (so K8s/Render
 *    probes don't drown the logs), unless LOG_REQUESTS_HEALTH=true.
 */

const { randomUUID } = require('crypto');
const { bindCorrelationId, createNoopLogger } = require('../lib/logger');

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEALTH_PATHS = new Set(['/api/health', '/api/ready', '/api/health/dependencies']);

function parseCorrelationId(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 64 && UUID_RX.test(trimmed)) return trimmed;
  // Also accept opaque short IDs from proxies/load balancers.
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) return trimmed;
  return null;
}

function buildRequestContextMiddleware({ logger = null, env = process.env } = {}) {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';
  const logHealthInProd = (env.LOG_REQUESTS_HEALTH || '').toLowerCase() === 'true';
  const baseLogger = logger || createNoopLogger();

  return function requestContext(req, res, next) {
    const headerId = parseCorrelationId(req.headers['x-correlation-id'] || req.headers['x-request-id']);
    req.id = headerId || randomUUID();
    req.logger = bindCorrelationId(baseLogger, req.id);

    const isHealth = HEALTH_PATHS.has(req.path);
    const shouldSkip = isProduction && isHealth && !logHealthInProd;

    const start = process.hrtime.bigint();

    const finish = () => {
      res.removeListener('finish', finish);
      res.removeListener('close', finish);
      if (shouldSkip) return;

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const userId = req.user?.id || null;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : (status >= 400 ? 'warn' : 'info');

      req.logger[level]('http request', {
        method: req.method,
        path: req.path,
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        userId,
        contentLength: res.getHeader('content-length') || null,
        ip: req.ip || req.socket?.remoteAddress || null,
      });
    };

    res.on('finish', finish);
    res.on('close', finish);

    next();
  };
}

module.exports = { buildRequestContextMiddleware, HEALTH_PATHS };
