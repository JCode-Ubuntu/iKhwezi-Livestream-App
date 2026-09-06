'use strict';

/**
 * storage-v2 — object storage provider contract.
 *
 * Providers MUST implement:
 *   type: 'local' | 's3'
 *   capabilities: { type, objectStorage, presigned }
 *   put(key, absoluteLocalPath)  → Promise<{ key }>   copy a local file INTO storage
 *   get(key, absoluteLocalPath)  → Promise<{ key }>   copy FROM storage to local disk
 *   remove(key)                  → Promise<boolean>   delete object; false when absent
 *   publicUrl(key)               → string|null        long-lived URL or null
 *
 * Honesty rules (same philosophy as meetings/av.js):
 *   - The provider NEVER lies in `capabilities`. If S3 is not configured,
 *     capabilities.objectStorage is false and publicUrl returns null.
 *   - A provider failure must NEVER fail an upload: callers invoke put()
 *     fire-and-forget with .catch() logging; the local file stays canonical.
 *   - `key` is a POSIX-style relative path (e.g. "uploads/abc-123.mp4").
 *     Drivers translate it to disk paths / S3 object keys internally.
 */

/**
 * Validate that a storage key is safe: non-empty, POSIX-relative, no drive
 * letters / traversal / backslashes. Prevents path escape when a key is ever
 * derived from user input (filenames are uuid-based today, but defense in
 * depth is cheap here).
 * @returns {string} the sanitized key
 * @throws TypeError on malformed keys
 */
function assertSafeKey(key) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new TypeError('storage key must be a non-empty string');
  }
  const normalized = key.replace(/\\/g, '/');
  if (normalized.startsWith('/') ||
      normalized.includes('..') ||
      /^[a-zA-Z]:/.test(normalized) ||
      /[\0]/.test(normalized)) {
    throw new TypeError(`unsafe storage key: ${JSON.stringify(key)}`);
  }
  return normalized.replace(/^\.?\//, '').replace(/\/+/g, '/');
}

/** Null-object contract check: every provider passed to this helper must
 *  expose the full interface so call-sites can rely on duck typing. */
function assertProviderShape(provider) {
  const required = ['put', 'get', 'remove', 'publicUrl', 'capabilities', 'type'];
  for (const member of required) {
    if (provider == null || !(member in provider)) {
      throw new TypeError(`storage provider missing member: ${member}`);
    }
  }
  if (typeof provider.put !== 'function' ||
      typeof provider.get !== 'function' ||
      typeof provider.remove !== 'function' ||
      typeof provider.publicUrl !== 'function') {
    throw new TypeError('storage provider put/get/remove/publicUrl must be functions');
  }
  const caps = provider.capabilities || {};
  if (typeof caps.type !== 'string' ||
      typeof caps.objectStorage !== 'boolean' ||
      typeof caps.presigned !== 'boolean') {
    throw new TypeError('storage provider capabilities must be {type, objectStorage, presigned}');
  }
  return provider;
}

module.exports = { assertSafeKey, assertProviderShape };
