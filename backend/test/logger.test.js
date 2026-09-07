'use strict';

const test = require('node:test');
const assert = require('assert');
const {
  createLogger,
  bindCorrelationId,
  createNoopLogger,
  shouldRedact,
  redact,
  REDACTED_VALUE,
} = require('../lib/logger');

function captureLogs(fn) {
  const lines = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  process.stdout.write = (chunk) => { lines.push({ stream: 'stdout', line: chunk.toString() }); return true; };
  process.stderr.write = (chunk) => { lines.push({ stream: 'stderr', line: chunk.toString() }); return true; };
  try {
    fn();
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
  return lines;
}

function parseJsonLogs(lines) {
  return lines.map((l) => {
    try {
      return JSON.parse(l.line.trim());
    } catch {
      return null;
    }
  }).filter(Boolean);
}

test.describe('logger (Phase 3B)', () => {
  test('logs JSON in production by default', () => {
    const lines = captureLogs(() => {
      const logger = createLogger({ env: { NODE_ENV: 'production', LOG_LEVEL: 'info' } });
      logger.info('hello', { foo: 'bar' });
    });
    const entries = parseJsonLogs(lines);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, 'info');
    assert.strictEqual(entries[0].message, 'hello');
    assert.strictEqual(entries[0].foo, 'bar');
  });

  test('logs human readable in development', () => {
    const lines = captureLogs(() => {
      const logger = createLogger({ env: { NODE_ENV: 'development', LOG_LEVEL: 'info' } });
      logger.info('hello', { foo: 'bar' });
    });
    const text = lines[0].line;
    assert(text.includes('[INFO]'), 'should include INFO');
    assert(text.includes('hello'), 'should include message');
  });

  test('respects LOG_LEVEL', () => {
    const lines = captureLogs(() => {
      const logger = createLogger({ env: { NODE_ENV: 'development', LOG_LEVEL: 'warn' } });
      logger.debug('hidden');
      logger.info('hidden');
      logger.warn('visible');
      logger.error('visible');
    });
    assert.strictEqual(lines.length, 2);
  });

  test('redacts sensitive keys', () => {
    const lines = captureLogs(() => {
      const logger = createLogger({ env: { NODE_ENV: 'production', LOG_LEVEL: 'info' } });
      logger.info('login attempt', { password: 'secret123', api_key: 'abc', nested: { token: 'xyz' } });
    });
    const entry = parseJsonLogs(lines)[0];
    assert.strictEqual(entry.password, REDACTED_VALUE);
    assert.strictEqual(entry.api_key, REDACTED_VALUE);
    assert.strictEqual(entry.nested.token, REDACTED_VALUE);
  });

  test('binds correlation id', () => {
    const lines = captureLogs(() => {
      const logger = createLogger({ env: { NODE_ENV: 'production', LOG_LEVEL: 'info' } });
      const child = bindCorrelationId(logger, 'corr-123');
      child.info('msg');
    });
    const entry = parseJsonLogs(lines)[0];
    assert.strictEqual(entry.correlationId, 'corr-123', `got ${JSON.stringify(entry)}`);
  });

  test('child logger merges extra fields', () => {
    const lines = captureLogs(() => {
      const logger = createLogger({ env: { NODE_ENV: 'production', LOG_LEVEL: 'info' } });
      const child = logger.child({ job: 'cleanup' });
      child.info('done', { count: 5 });
    });
    const entry = parseJsonLogs(lines)[0];
    assert.strictEqual(entry.job, 'cleanup');
    assert.strictEqual(entry.count, 5);
  });

  test('never throws on unserializable input', () => {
    const circular = {};
    circular.self = circular;
    assert.doesNotThrow(() => {
      const logger = createLogger({ env: { NODE_ENV: 'production', LOG_LEVEL: 'info' } });
      logger.info('circular', { circular });
    });
  });

  test('noop logger is safe', () => {
    const logger = createNoopLogger();
    logger.info('ignored');
    logger.child({}).error('ignored');
    assert.ok(logger);
  });

  test('shouldRedact covers exact and suffix matches', () => {
    assert.ok(shouldRedact('password'));
    assert.ok(shouldRedact('refresh_token'));
    assert.ok(shouldRedact('apiSecret'));
    assert.ok(!shouldRedact('username'));
  });
});
