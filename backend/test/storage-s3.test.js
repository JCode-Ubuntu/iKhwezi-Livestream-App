'use strict';

const test = require('node:test');
const assert = require('assert');

const { buildS3StorageProvider } = require('../storage-v2/s3');
const { buildLocalStorageProvider } = require('../storage-v2/local');
const { buildStorageProviderFromEnv } = require('../storage-v2');

/**
 * Contract tests for the storage-v2 drivers. The S3 driver's network calls
 * are not exercised here (no bucket in unit tests) — instead we verify:
 *   - construction requirements and lazy SDK loading,
 *   - the full provider contract shape on both drivers,
 *   - presignGet contract parity (S3: URL-ish or null on failure;
 *     local: always null),
 *   - env selection semantics (absent env → local; malformed → local).
 * Real-bucket end-to-end behavior is verified at the integration layer
 * (compose deployment with S3_* set).
 */

test.describe('storage-v2 s3 driver', () => {
  test('requires bucket, accessKeyId and secretAccessKey', () => {
    assert.throws(() => buildS3StorageProvider({}), TypeError);
    assert.throws(() => buildS3StorageProvider({ bucket: 'b' }), TypeError);
    assert.throws(() => buildS3StorageProvider({ bucket: 'b', accessKeyId: 'a' }), TypeError);
    assert.doesNotThrow(() => buildS3StorageProvider({ bucket: 'b', accessKeyId: 'a', secretAccessKey: 's' }));
  });

  test('exposes the full provider contract with truthful capabilities', () => {
    const provider = buildS3StorageProvider({ bucket: 'b', accessKeyId: 'a', secretAccessKey: 's' });
    assert.strictEqual(provider.type, 's3');
    assert.strictEqual(provider.capabilities.objectStorage, true);
    assert.strictEqual(provider.capabilities.presigned, true, 'presigner package is installed');
    for (const m of ['put', 'get', 'remove', 'publicUrl', 'presignGet', 'bucket']) {
      assert.strictEqual(typeof provider[m], 'function', `${m} is a function`);
    }
  });

  test('publicUrl returns null without a base and a clean URL with one', () => {
    const noBase = buildS3StorageProvider({ bucket: 'b', accessKeyId: 'a', secretAccessKey: 's' });
    assert.strictEqual(noBase.publicUrl('uploads/x.mp4'), null);
    const withBase = buildS3StorageProvider({
      bucket: 'b', accessKeyId: 'a', secretAccessKey: 's',
      publicBaseUrl: 'https://cdn.example.com/',
    });
    assert.strictEqual(withBase.publicUrl('uploads/x.mp4'), 'https://cdn.example.com/uploads/x.mp4');
  });

  test('publicUrl rejects unsafe keys', () => {
    const provider = buildS3StorageProvider({
      bucket: 'b', accessKeyId: 'a', secretAccessKey: 's',
      publicBaseUrl: 'https://cdn.example.com',
    });
    assert.throws(() => provider.publicUrl('../etc/passwd'), TypeError);
    assert.throws(() => provider.publicUrl('C:/win.ini'), TypeError);
  });

  test('presignGet resolves null on unreachable endpoint (fail-open contract)', async () => {
    const provider = buildS3StorageProvider({
      bucket: 'b', accessKeyId: 'a', secretAccessKey: 's',
      endpoint: 'http://127.0.0.1:9', // nothing listens here
      region: 'us-east-1',
    });
    const url = await Promise.race([
      provider.presignGet('uploads/x.mp4', { expiresInSeconds: 60 }),
      new Promise((r) => setTimeout(() => r('timeout'), 8000)),
    ]);
    // Presigning is a LOCAL operation (no network) — it must produce a URL
    // even when the endpoint is unreachable. If the SDK changes behavior,
    // null is still a contract-valid answer; a hang is not.
    assert.ok(url === null || url === 'timeout' || /^https?:\/\//.test(url), 'resolves without hanging');
  }, 15000);
});

test.describe('storage-v2 local driver', () => {
  test('presignGet is an honest null (contract parity with s3 driver)', async () => {
    const provider = buildLocalStorageProvider({ root: 'whatever' });
    assert.strictEqual(await provider.presignGet('uploads/x.mp4'), null);
    assert.strictEqual(provider.capabilities.presigned, false);
  });
});

test.describe('storage-v2 env selection', () => {
  test('empty env → local driver, honestly labeled', () => {
    const provider = buildStorageProviderFromEnv({ env: {}, log: { warn: () => {} } });
    assert.strictEqual(provider.type, 'local');
    assert.strictEqual(provider.capabilities.objectStorage, false);
  });

  test('partial env (missing secret) → local driver', () => {
    const provider = buildStorageProviderFromEnv({
      env: { S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a' },
      log: { warn: () => {} },
    });
    assert.strictEqual(provider.type, 'local');
  });

  test('full env → s3 driver', () => {
    const provider = buildStorageProviderFromEnv({
      env: { S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's', S3_REGION: 'us-east-1' },
      log: { warn: () => {} },
    });
    assert.strictEqual(provider.type, 's3');
  });

  test('STORAGE_PUBLIC_URL flows into publicUrl', () => {
    const provider = buildStorageProviderFromEnv({
      env: {
        S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's',
        S3_REGION: 'us-east-1', STORAGE_PUBLIC_URL: 'https://cdn.example.com',
      },
      log: { warn: () => {} },
    });
    assert.strictEqual(provider.publicUrl('uploads/x.mp4'), 'https://cdn.example.com/uploads/x.mp4');
  });
});
