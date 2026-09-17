'use strict';

/**
 * storage-v2 S3-compatible driver (AWS S3 / Cloudflare R2).
 *
 * Uses @aws-sdk/client-s3 (PutObject/GetObject/DeleteObject) plus
 * @aws-sdk/s3-request-presigner for short-lived private reads (presignGet).
 * publicUrl() serves the long-lived public base URL (R2 custom domain /
 * CDN / public bucket) when STORAGE_PUBLIC_URL is configured, else null.
 *
 * Secondary fallback: if S3_* env is set but the S3 client itself cannot be
 * constructed (bad install), buildS3StorageProvider throws — the env
 * selector (index.js) catches that and falls back to the local driver with
 * a loud warning rather than failing boot.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { assertSafeKey } = require('./provider');

function buildS3StorageProvider({
  bucket,
  accessKeyId,
  secretAccessKey,
  region = 'auto',
  endpoint = null,
  publicBaseUrl = null,
} = {}) {
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new TypeError('S3 storage provider requires bucket, accessKeyId and secretAccessKey');
  }

  // Lazy require so requiring this module never pulls AWS SDK cost when the
  // local driver is in play, and a broken SDK install surfaces at build time.
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint, forcePathStyle: !!endpoint.match(/r2\.cloudflarestorage\.com|localhost|127\.0\.0\.1/) } : {}),
  });

  return {
    type: 's3',

    // Truthful: real object storage; presigned GET URLs available when the
    // presigner package is installed (it is, since the S3-activation phase) —
    // used for short-lived private reads. publicUrl() still serves the
    // long-lived public base URL path (R2 custom domain / CDN / public bucket).
    capabilities: Object.freeze({
      type: 's3',
      objectStorage: true,
      presigned: true,
    }),

    /** COPY the local file at `absoluteLocalPath` into the bucket at `key`. */
    async put(key, absoluteLocalPath, { contentType } = {}) {
      const safe = assertSafeKey(key);
      const body = await fsp.readFile(absoluteLocalPath);
      const params = { Bucket: bucket, Key: safe, Body: body };
      // Content-type is metadata hygiene (correct rendering + future CDN
      // correctness); omitting it leaves S3's default octet-stream. Extension
      // inference keeps the driver self-contained; explicit contentType wins.
      params.ContentType = contentType || inferContentType(safe);
      await client.send(new PutObjectCommand(params));
      return { key: safe, bytes: Buffer.byteLength(body) };
    },

    /** COPY the object at `key` out to `absoluteLocalPath` (streamed to disk). */
    async get(key, absoluteLocalPath) {
      const safe = assertSafeKey(key);
      const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: safe }));
      if (out?.Body == null) {
        const err = new Error(`ENOENT: no object at key ${key}`);
        err.code = 'ENOENT';
        throw err;
      }
      await ensureParent(absoluteLocalPath);
      await writeStreamToFile(out.Body, absoluteLocalPath);
      const bytes = fs.existsSync(absoluteLocalPath) ? (await fsp.stat(absoluteLocalPath)).size : null;
      return { key: safe, bytes };
    },

    /** Delete the object; resolves false when it doesn't exist. */
    async remove(key) {
      const safe = assertSafeKey(key);
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: safe }));
        return true;
      } catch (err) {
        if (err?.$metadata?.httpStatusCode === 404) return false;
        throw err;
      }
    },

    /**
     * Long-lived public URL from S3_PUBLIC_URL (e.g. an R2 custom domain or a
     * CDN in front of the bucket), else null. When no public base is
     * configured, use get() + presignGet() for short-lived private reads.
     */
    publicUrl(key) {
      if (!publicBaseUrl) return null;
      const safe = assertSafeKey(key);
      return `${publicBaseUrl.replace(/\/$/, '')}/${safe}`;
    },

    /**
     * Short-lived presigned GET URL (~1h default) for private buckets — the
     * production read path when no public CDN base is configured. Returns
     * null rather than throwing when presigning cannot be built, so callers
     * can fall back to their local-file path.
     */
    async presignGet(key, { expiresInSeconds = 3600 } = {}) {
      try {
        const safe = assertSafeKey(key);
        return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: safe }), { expiresIn: expiresInSeconds });
      } catch (err) {
        return null;
      }
    },

    bucket() { return bucket; },
  };
}

// Minimal extension→MIME map for the media types iKHWEZI actually stores.
// Explicit contentType passed to put() always wins over this inference.
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
};

function inferContentType(key) {
  const ext = path.extname(key).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

async function ensureParent(absolutePath) {
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
}

/** Pipe an SDK body stream (web ReadableStream or Node stream) into a file. */
async function writeStreamToFile(body, absolutePath) {
  // Node 20+: the SDK may hand back a web ReadableStream
  if (typeof body?.getReader === 'function') {
    const reader = body.getReader();
    await writeWebStreamToFile(reader, absolutePath);
    return;
  }
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(absolutePath);
    body.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    body.pipe(ws);
  });
}

async function writeWebStreamToFile(reader, absolutePath) {
  const handle = await fsp.open(absolutePath, 'w');
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await handle.write(value);
    }
  } finally {
    await handle.close();
  }
}

module.exports = { buildS3StorageProvider };
