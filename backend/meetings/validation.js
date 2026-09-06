'use strict';

const { isUuid, sanitizeText, containsProfanity } = require('../groups/validation');

const TITLE_MIN = 2;
const TITLE_MAX = 120;
const DESC_MAX = 500;
const MAX_SCHEDULE_AHEAD_MS = 366 * 24 * 60 * 60 * 1000; // ~1 year
const PAST_GRACE_MS = 5 * 60 * 1000; // allow small clock skew

function validateTitle(title) {
  const t = sanitizeText(title, TITLE_MAX);
  if (t.length < TITLE_MIN) return { ok: false, error: `Meeting title must be ${TITLE_MIN}–${TITLE_MAX} characters` };
  if (containsProfanity(t)) return { ok: false, error: 'Meeting title contains disallowed language' };
  return { ok: true, value: t };
}

function validateDescription(desc) {
  const d = sanitizeText(desc, DESC_MAX);
  if (containsProfanity(d)) return { ok: false, error: 'Description contains disallowed language' };
  return { ok: true, value: d || null };
}

/**
 * scheduledAt: ISO string or epoch ms. null/undefined/'' → not scheduled.
 * Must not be in the past (beyond a small grace) nor absurdly far ahead.
 */
function validateScheduledAt(raw, now = Date.now()) {
  if (raw == null || raw === '') return { ok: true, value: null };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' };
  if (d.getTime() < now - PAST_GRACE_MS) return { ok: false, error: 'Scheduled time is in the past' };
  if (d.getTime() > now + MAX_SCHEDULE_AHEAD_MS) return { ok: false, error: 'Scheduled time is too far ahead' };
  return { ok: true, value: d };
}

module.exports = {
  TITLE_MIN,
  TITLE_MAX,
  DESC_MAX,
  isUuid,
  validateTitle,
  validateDescription,
  validateScheduledAt,
};
