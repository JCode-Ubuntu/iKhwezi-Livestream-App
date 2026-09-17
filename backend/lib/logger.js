'use strict';

/**
 * Centralized structured logger (Phase 3B — Security, Operations & Reliability).
 *
 * Design standards:
 *   - fail-open: a broken logger NEVER throws; malformed objects fall back to
 *     plain text so a logging bug cannot crash a request or a boot.
 *   - single-line JSON in production, human-readable in development.
 *   - automatic redaction of sensitive fields (keep keys, replace values).
 *   - correlationId binding for request tracing.
 *   - no external npm dependency (uses only Node built-ins).
 */

const { createHash, randomUUID } = require('crypto');
const { inspect } = require('util');

const LEVELS = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
});

const LEVEL_NAMES = Object.freeze(Object.keys(LEVELS));

/**
 * Module-constant list of sensitive keys.
 *
 * Exact-match keys + any nested key ending in one of the SUFFIXES below are
 * redacted. Keeping the key present (value = [REDACTED]) lets operators know
 * the field existed without leaking its contents.
 */
const REDACTED_KEYS = Object.freeze(new Set([
  'token',
  'password',
  'secret',
  'key',
  'authorization',
  'cookie',
  'creditCard',
  'apiKey',
  'api_key',
  'x-admin-key',
  'x-rtmp-secret',
  'jwt',
  // SECURITY REMEDIATION (audit C4): request URLs are redacted wholesale —
  // nginx cannot compute HMACs so the RTMP webhook secret legitimately
  // travels as ?secret= on the callback URL, and full URLs end up in
  // request-log extras. Redacting the `url` key keeps the secret out of
  // logs; structured fields (method/path/status) carry the debugging value.
  'url',
]));

const REDACTED_SUFFIXES = Object.freeze([
  '_key',
  '_secret',
  '_token',
  '_password',
  'key',
  'secret',
  'token',
  'password',
]);

const REDACTED_VALUE = '[REDACTED]';

function shouldRedact(key) {
  if (typeof key !== 'string') return false;
  const lower = key.toLowerCase();
  if (REDACTED_KEYS.has(lower)) return true;
  return REDACTED_SUFFIXES.some((suffix) => lower.endsWith(suffix) || lower.includes(suffix));
}

function redactValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return REDACTED_VALUE;
  if (typeof value === 'number') return REDACTED_VALUE;
  if (typeof value === 'boolean') return REDACTED_VALUE;
  if (typeof value === 'bigint') return REDACTED_VALUE;
  if (Buffer.isBuffer(value)) return REDACTED_VALUE;
  // Keep arrays/objects for recursive redaction.
  return value;
}

function redact(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[circular]';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, seen));
  }

  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (shouldRedact(key)) {
      out[key] = redactValue(value);
    } else if (value && typeof value === 'object') {
      out[key] = redact(value, seen);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function safeStringify(obj, fallback) {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      return inspect(obj, { depth: 4, breakLength: Infinity });
    } catch {
      return fallback || '[unserializable]';
    }
  }
}

function formatHuman(entry) {
  const ts = entry.timestamp ? entry.timestamp.slice(11, 23) : '';
  const corr = entry.correlationId ? ` ${entry.correlationId.slice(0, 8)}` : '';
  const extras = { ...entry };
  delete extras.timestamp;
  delete extras.level;
  delete extras.service;
  delete extras.message;
  delete extras.correlationId;

  let extra = '';
  if (Object.keys(extras).length) {
    extra = ' ' + safeStringify(extras, '').replace(/\n/g, ' ');
  }
  return `${ts} [${entry.level.toUpperCase()}]${corr} ${entry.service}: ${entry.message}${extra}`;
}

function formatJson(entry) {
  return safeStringify(entry, JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'ikhwezi-backend',
    message: '[logger failed to serialize entry]',
  }));
}

function createLogger({ env = process.env, service = 'ikhwezi-backend' } = {}) {
  const envLevel = (env.LOG_LEVEL || '').toLowerCase();
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';
  const levelName = LEVEL_NAMES.includes(envLevel) ? envLevel : (isProduction ? 'info' : 'debug');
  const minLevel = LEVELS[levelName];
  const outputJson = env.LOG_FORMAT === 'json' || (isProduction && env.LOG_FORMAT !== 'human');

  const baseFields = {
    service,
  };

  function log(level, message, extra = {}) {
    if (LEVELS[level] > minLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...baseFields,
      message,
      ...redact(extra),
    };

    const line = outputJson ? formatJson(entry) : formatHuman(entry);

    // Use the appropriate stream but never throw.
    try {
      const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
      stream.write(line + '\n');
    } catch {
      /* deliberate swallow: logging must never crash the process */
    }
  }

  return {
    error: (msg, extra) => log('error', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    info: (msg, extra) => log('info', msg, extra),
    debug: (msg, extra) => log('debug', msg, extra),
    child: (moreFields = {}) => createChildLogger({ parent: { log }, service, moreFields }),
  };
}

function createChildLogger({ parent, service, moreFields }) {
  const log = (level, msg, extra) => {
    if (typeof parent.log === 'function') {
      parent.log(level, msg, { ...moreFields, ...extra });
    } else {
      const fn = parent[level];
      if (typeof fn === 'function') fn.call(parent, msg, { ...moreFields, ...extra });
    }
  };
  return {
    error: (msg, extra) => log('error', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    info: (msg, extra) => log('info', msg, extra),
    debug: (msg, extra) => log('debug', msg, extra),
    child: (evenMoreFields = {}) => createChildLogger({
      parent,
      service,
      moreFields: { ...moreFields, ...evenMoreFields },
    }),
  };
}

function bindCorrelationId(logger, correlationId) {
  if (!logger) return createNoopLogger();
  const hasLog = typeof logger.log === 'function';
  const hasLevels = ['error', 'warn', 'info', 'debug'].every((l) => typeof logger[l] === 'function');
  if (!hasLog && !hasLevels) return createNoopLogger();
  return createChildLogger({ parent: logger, service: logger.service || 'ikhwezi-backend', moreFields: { correlationId } });
}

function createNoopLogger() {
  return {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    child: () => createNoopLogger(),
  };
}

// Stable export of the redaction set for tests/inspectors.
module.exports = {
  createLogger,
  bindCorrelationId,
  createNoopLogger,
  noopLogger: createNoopLogger(),
  LEVELS,
  LEVEL_NAMES,
  REDACTED_KEYS,
  REDACTED_SUFFIXES,
  REDACTED_VALUE,
  shouldRedact,
  redact,
};
