'use strict';

/**
 * Group Chat — validation + sanitization helpers.
 *
 * Everything here is defensive: the client is never trusted. These run as
 * Express middleware and inline guards inside the service layer.
 */

const NAME_MIN = 3;
const NAME_MAX = 100;
const DESC_MAX = 280;
const MESSAGE_MAX = 2000;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Compact profanity blocklist. Intentionally small and substring-based — good
// enough to reject the obvious cases without false-positive censorship of
// legitimate words. Not a substitute for a real moderation queue.
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'retard',
  'whore', 'slut', 'dick', 'pussy', 'asshole', 'bastard',
];

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v.trim());
}

function sanitizeText(v, max) {
  if (v == null) return '';
  return String(v).trim().slice(0, max);
}

function containsProfanity(text) {
  const lower = String(text || '').toLowerCase();
  return PROFANITY.some((w) => lower.includes(w));
}

function validateGroupName(name) {
  const n = sanitizeText(name, NAME_MAX);
  if (n.length < NAME_MIN) return { ok: false, error: `Group name must be ${NAME_MIN}–${NAME_MAX} characters` };
  if (n.length > NAME_MAX) return { ok: false, error: `Group name must be ${NAME_MAX} characters or fewer` };
  if (containsProfanity(n)) return { ok: false, error: 'Group name contains disallowed language' };
  return { ok: true, value: n };
}

function validateDescription(desc) {
  const d = sanitizeText(desc, DESC_MAX);
  if (containsProfanity(d)) return { ok: false, error: 'Description contains disallowed language' };
  return { ok: true, value: d };
}

function validateMessage(content, messageType) {
  if (messageType === 'text' || messageType == null) {
    const c = sanitizeText(content, MESSAGE_MAX);
    if (!c) return { ok: false, error: 'Message cannot be empty' };
    if (c.length > MESSAGE_MAX) return { ok: false, error: `Message too long (max ${MESSAGE_MAX} characters)` };
    return { ok: true, value: c };
  }
  if (!['image', 'video', 'system'].includes(messageType)) {
    return { ok: false, error: 'Invalid message type' };
  }
  return { ok: true, value: sanitizeText(content, MESSAGE_MAX) };
}

function parsePaging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 30));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
  NAME_MIN,
  NAME_MAX,
  DESC_MAX,
  MESSAGE_MAX,
  isUuid,
  sanitizeText,
  containsProfanity,
  validateGroupName,
  validateDescription,
  validateMessage,
  parsePaging,
};
