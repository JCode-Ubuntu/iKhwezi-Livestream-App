'use strict';

/**
 * storage-v2 — env-based provider selection (mirrors meetings/av.js
 * buildAvProviderFromEnv exactly in spirit):
 *
 *   S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_REGION
 *     ALL empty  → local-disk driver (the default; uploads stay canonical on
 *                  local disk and no copy is made beyond the local tree)
 *     S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY set → S3 driver
 *     (endpoint optional for real AWS; required for R2/MinIO)
 *     S3_PUBLIC_URL → long-lived public URL base for publicUrl() (the
 *                     presigner package is not installed; see capabilities)
 *
 * Failure honesty: if the S3 driver cannot be constructed (bad env shape or
 * broken SDK install), we log LOUDLY and fall back to the local driver so
 * boot and uploads never fail because of storage config — same pattern as
 * meetings/av.js's null provider.
 */

const path = require('path');
const { buildLocalStorageProvider } = require('./local');
const { assertProviderShape } = require('./provider');

/**
 * @param {object} [opts]
 * @param {object} [opts.env] environment snapshot (defaults to process.env)
 * @param {string} [opts.localRoot] root dir for the local driver
 *                                (default: backend/storage)
 * @param {function} [opts.log] logger (default: console)
 * @param {function} [opts.buildS3] override for tests (default: s3.js builder)
 */
function buildStorageProviderFromEnv(opts = {}) {
  const {
    env = process.env,
    localRoot,
    log = opts.log || require('../lib/logger').createLogger(),
    buildS3 = require('./s3').buildS3StorageProvider,
  } = opts;

  const s3Env = pickS3Env(env);
  const root = localRoot || path.join(__dirname, '..', 'storage');
  const publicBaseUrl = squash(env.STORAGE_PUBLIC_URL || env.S3_PUBLIC_URL) || null;

  // Not configured → local disk, honestly labeled.
  if (!s3Env.bucket || !s3Env.accessKeyId || !s3Env.secretAccessKey) {
    return assertProviderShape(buildLocalStorageProvider({ root, publicBaseUrl }));
  }

  // S3/R2 configured → try to build the driver; degrade to local on any
  // construction failure (never crash the boot, never fail an upload).
  try {
    const provider = buildS3({
      bucket: s3Env.bucket,
      accessKeyId: s3Env.accessKeyId,
      secretAccessKey: s3Env.secretAccessKey,
      region: s3Env.region,
      endpoint: s3Env.endpoint,
      publicBaseUrl,
    });
    return assertProviderShape(provider);
  } catch (err) {
    log.warn?.(
      `\n${'='.repeat(78)}\n⚠️  S3_* storage env is set but the object-storage driver could not be ` +
      `built (${err?.message || err}). Falling back to LOCAL DISK storage — uploads continue to ` +
      `work but are NOT copied to object storage.\n${'='.repeat(78)}\n`
    );
    return assertProviderShape(buildLocalStorageProvider({ root, publicBaseUrl }));
  }
}

function pickS3Env(env) {
  return {
    bucket: squash(env.S3_BUCKET),
    accessKeyId: squash(env.S3_ACCESS_KEY_ID),
    secretAccessKey: squash(env.S3_SECRET_ACCESS_KEY),
    region: squash(env.S3_REGION) || 'auto',
    endpoint: squash(env.S3_ENDPOINT),
  };
}

function squash(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

module.exports = {
  buildStorageProviderFromEnv,
  // Re-exported for callers/tests that only want the pieces.
  buildLocalStorageProvider,
  buildS3StorageProvider: require('./s3').buildS3StorageProvider,
  assertSafeKey: require('./provider').assertSafeKey,
  assertProviderShape: require('./provider').assertProviderShape,
};
