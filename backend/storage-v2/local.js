'use strict';

/**
 * storage-v2 local-disk driver (the default).
 *
 * Semantics: "put" COPIES the uploaded file into a mirrored tree under
 * `<root>/<key>` and "get" copies it back out. The canonical upload tree
 * (backend/storage/uploads) remains the source of truth; this driver gives
 * the rest of the code one interface to target in production where the same
 * calls go to S3 instead. capabilities.objectStorage is false — the driver
 * tells the truth about being a disk.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { assertSafeKey } = require('./provider');

/** Turn a storage key into an absolute path under root for THIS OS. */
function diskPath(root, key) {
  return path.join(root, ...assertSafeKey(key).split('/'));
}

async function ensureParent(absolutePath) {
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
}

function buildLocalStorageProvider({ root, publicBaseUrl = null } = {}) {
  if (!root) throw new TypeError('local storage provider requires a root directory');
  const resolvedRoot = path.resolve(root);

  return {
    type: 'local',

    // Truthful: disk copy only, no object storage, no presigned URLs.
    capabilities: Object.freeze({
      type: 'local',
      objectStorage: false,
      presigned: false,
    }),

    /** COPY `absoluteLocalPath` into the storage tree at `key`.
     *  If the resolved target IS the source (local-mirror default where the
     *  driver root == the canonical uploads tree), the copy is a no-op —
     *  same-file copyFile is undefined on some platforms (Linux truncates). */
    async put(key, absoluteLocalPath) {
      const target = diskPath(resolvedRoot, key);
      if (path.resolve(absoluteLocalPath) === path.resolve(target)) {
        return { key, bytes: await sizeOf(target), noop: true };
      }
      await ensureParent(target);
      await fsp.copyFile(absoluteLocalPath, target);
      return { key, bytes: await sizeOf(target) };
    },

    /** COPY the object at `key` back out to `absoluteLocalPath`. */
    async get(key, absoluteLocalPath) {
      const source = diskPath(resolvedRoot, key);
      if (!fs.existsSync(source)) {
        const err = new Error(`ENOENT: no object at key ${key}`);
        err.code = 'ENOENT';
        throw err;
      }
      await ensureParent(absoluteLocalPath);
      await fsp.copyFile(source, absoluteLocalPath);
      return { key, bytes: await sizeOf(absoluteLocalPath) };
    },

    /** Best-effort delete; resolves false when the key doesn't exist. */
    async remove(key) {
      const target = diskPath(resolvedRoot, key);
      try {
        await fsp.unlink(target);
        return true;
      } catch (err) {
        if (err?.code === 'ENOENT') return false;
        throw err;
      }
    },

    /**
     * Media is served by this backend's existing `/storage/**` static route,
     * so a long-lived public URL is just the path. null when the operator has
     * not set a base URL (dev default) — callers fall back to the local path.
     */
    publicUrl(key) {
      if (!publicBaseUrl) return null;
      const safe = assertSafeKey(key);
      return `${publicBaseUrl.replace(/\/$/, '')}/${safe}`;
    },

    /** Exposed for tests/diagnostics. */
    root() { return resolvedRoot; },

    /**
     * Contract parity with the S3 driver. The local driver has nothing to
     * presign — media is served directly from /storage/** — so this resolves
     * null and callers transparently fall back to the local path.
     */
    async presignGet() {
      return null;
    },
  };
}

async function sizeOf(absolutePath) {
  try {
    const stat = await fsp.stat(absolutePath);
    return stat.size;
  } catch {
    return null;
  }
}

module.exports = { buildLocalStorageProvider, diskPath };
