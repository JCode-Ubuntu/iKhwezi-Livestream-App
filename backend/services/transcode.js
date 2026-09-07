'use strict';

/**
 * transcode — FFmpeg wrapper for offline video transcoding (Phase 2 Media).
 *
 * Policies (documented in .env.dist / FINAL REPORT):
 *   - TRANSCODE_ENABLED defaults to FALSE (opt-in; stability-first — the
 *     user's dev server and production boot path must not change behavior
 *     unless the operator asks for it).
 *   - TRANSCODE_PROFILES="480p,720p,1080p" — parsed case-insensitively; the
 *     480p profile is implemented today, additional names are recognized
 *     config but map to the 480p ladder until each extra profile is added.
 *     (Keeps the knob honest: known-but-not-yet-wired names are skipped with
 *     a console notice, not silently claimed.)
 *   - Output: H.264 MP4 at ≤480p, written to storage/videos/<orig>-<profile>.mp4
 *   - DB: NO schema change. The Video row keeps its original filename — the
 *     transcoded artifact is an ADDITIONAL file next to the original; we log
 *     completion + expose transcodeStatus() for /api/health-style visibility.
 *     No `transcode_status` column was needed for this workstream.
 *
 * Honesty gate: checkFfmpeg() runs ffmpeg -version ONCE (lazily, cached) — if
 * the binary is missing or exits non-zero, transcode disables itself with a
 * LOUD warning and capabilities reports available=false. No boot crash, no
 * failed uploads.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

/** Ladder: profile name → maximum long-edge height (H.264, MP4). */
const PROFILE_HEIGHTS = Object.freeze({
  '480p': 480,
});
const DEFAULT_PROFILES = Object.freeze(['480p']);

/** Locate the ffmpeg binary: explicit override first, then ffmpeg-static. */
function resolveFfmpegPath(env = process.env) {
  if (env.FFMPEG_PATH) return env.FFMPEG_PATH;
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
}

/**
 * Probe the ffmpeg binary ONCE and cache the result in `cacheSlot`.
 * Returns { available: bool, ffmpegPath, reason }.
 */
async function checkFfmpeg({ env = process.env, cacheSlot = null } = {}) {
  const key = 'probe-result';
  if (cacheSlot && Object.prototype.hasOwnProperty.call(cacheSlot, key)) {
    return cacheSlot[key];
  }
  const result = await probeFfmpeg(resolveFfmpegPath(env));
  if (cacheSlot) cacheSlot[key] = result;
  return result;
}

async function probeFfmpeg(ffmpegPath) {
  if (!ffmpegPath) {
    return { available: false, ffmpegPath: null, reason: 'ffmpeg binary not found (ffmpeg-static missing or FFMPEG_PATH unset)' };
  }
  if (!fs.existsSync(ffmpegPath)) {
    return { available: false, ffmpegPath, reason: `ffmpeg binary missing at ${ffmpegPath}` };
  }
  const ok = await new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-version'], { windowsHide: true });
    let exited = false;
    child.on('error', () => resolve(false));
    child.on('close', (code) => { exited = true; resolve(code === 0); });
    // Safety valve for a hung binary: never let the probe wedge boot.
    setTimeout(() => { if (!exited) { child.kill(); resolve(false); } }, 5000).unref();
  });
  if (!ok) {
    return { available: false, ffmpegPath, reason: `ffmpeg -version failed (binary corrupt or not runnable): ${ffmpegPath}` };
  }
  return { available: true, ffmpegPath, reason: null };
}

/** Parse TRANSCODE_PROFILES into known profile names (unknown → warning list). */
function parseProfiles(envValue) {
  const raw = (envValue || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const wanted = raw.length ? raw : [...DEFAULT_PROFILES];
  const implemented = Object.keys(PROFILE_HEIGHTS);
  const known = wanted.filter((p) => implemented.includes(p));
  const skipped = wanted.filter((p) => !implemented.includes(p));
  return { wanted, known, skipped };
}

/**
 * Build the transcode service from env. Synchronous + safe: never throws,
 * never touches the network, never spawns a process at build time.
 *
 * @param {object} opts
 * @param {object} [opts.env]          env snapshot (default process.env)
 * @param {string} [opts.videosDir]    output dir (default backend/storage/videos)
 * @param {function} [opts.log]        logger (default console)
 * @param {object} [opts.ffmpegProbeCache] shared mutable cache slot for the probe result
 */
function buildTranscodeService(opts = {}) {
  const {
    env = process.env,
    videosDir = path.join(__dirname, '..', 'storage', 'videos'),
    log = opts.log || require('../lib/logger').createLogger(),
    ffmpegProbeCache = {},
  } = opts;

  const enabledFlag = (env.TRANSCODE_ENABLED || '').trim().toLowerCase();
  const enabled = enabledFlag === 'true' || enabledFlag === '1' || enabledFlag === 'yes';
  const { known: profiles, skipped } = parseProfiles(env.TRANSCODE_PROFILES);

  if (skipped.length) {
    log.warn?.(
      `[transcode] TRANSCODE_PROFILES contains names not implemented yet (${skipped.join(', ')}); ` +
      `known profiles: ${Object.keys(PROFILE_HEIGHTS).join(', ')}`
    );
  }

  // capabilities reflects the CURRENT honest state: disabled stayed false
  // until enabled AND the binary probe passes (checked lazily on first use).
  const state = {
    requested: enabled,
    ffmpeg: null, // filled by first ensureReady()
    active: false, // true when enabled AND binary OK
  };

  async function ensureReady() {
    if (state.ffmpeg) return state.ffmpeg;
    const probe = await checkFfmpeg({ env, cacheSlot: ffmpegProbeCache });
    state.ffmpeg = probe;
    if (!probe.available) {
      log.warn?.(
        `\n${'='.repeat(78)}\n⚠️  TRANSCODE_ENABLED=${enabled} but FFmpeg is NOT usable: ${probe.reason}. ` +
        `Video transcoding is DISABLED for this process — uploads still succeed, originals stay canonical.\n${'='.repeat(78)}\n`
      );
    } else if (enabled) {
      state.active = true;
    }
    return probe;
  }

  const service = {
    capabilities: {
      get enabled() { return state.active; },
      get requested() { return state.requested; },
      get profiles() { return profiles; },
      get ffmpegAvailable() { return !!state.ffmpeg?.available; },
    },

    /**
     * Transcode one uploaded video into every configured profile.
     * @param {object} job { name, data: { filename, uploadsDir } }
     * Never throws — returns { ok, outputs, errors }.
     */
    async process(job) {
      const { filename } = job?.data || {};
      if (!filename) return { ok: false, errors: ['transcode: job missing filename'] };
      if (!enabled) return { ok: false, skipped: 'transcode disabled (TRANSCODE_ENABLED not true)' };
      const probe = await ensureReady();
      if (!probe.available) return { ok: false, skipped: `transcode unavailable: ${probe.reason}` };

      const sourcePath = job.data.sourcePath
        || (job.data.uploadsDir ? path.join(job.data.uploadsDir, filename) : null);
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return { ok: false, errors: [`transcode: source not found (${sourcePath || 'no source path'})`] };
      }

      await fsp.mkdir(videosDir, { recursive: true });
      const outputs = [];
      const errors = [];
      for (const profile of profiles) {
        const height = PROFILE_HEIGHTS[profile];
        const base = path.basename(filename, path.extname(filename));
        const outPath = path.join(videosDir, `${base}-${profile}.mp4`);
        try {
          await runFfmpeg(probe.ffmpegPath, sourcePath, outPath, height);
          outputs.push(outPath);
          log.log?.(`[transcode] ✓ ${profile} → ${outPath}`);
        } catch (err) {
          errors.push(`${profile}: ${err?.message || err}`);
          log.error?.(`[transcode] ${profile} failed for ${filename}: ${err?.message || err}`);
        }
      }
      return { ok: errors.length === 0, outputs, errors };
    },

    /** Output path for a given source filename + profile (for tests/smoke). */
    outputPathFor(filename, profile) {
      const base = path.basename(filename, path.extname(filename));
      return path.join(videosDir, `${base}-${profile}.mp4`);
    },
  };

  return service;
}

/** Run one ffmpeg invocation (H.264 MP4, long edge scaled to the profile
 *  height, original audio copied through when present). */
function runFfmpeg(ffmpegPath, sourcePath, outPath, height) {
  return new Promise((resolve, reject) => {
    // Lazy require keeps index.js boot cost flat when transcode is disabled.
    const ffmpeg = require('fluent-ffmpeg');
    // -2 keeps the height exactly at the profile while width auto-divides by 2
    // (h264 yuv420p needs even dimensions); scale never upscales.
    const command = ffmpeg(sourcePath)
      .setFfmpegPath(ffmpegPath)
      .videoFilters(`scale=-2:'min(${height},ih)'`)
      .videoCodec('libx264')
      .format('mp4')
      .output(outPath)
      // Don't re-encode audio we don't need to touch (AAC passthrough when
      // the source has a stream; silently skipped when it has none).
      .outputOptions(['-c:a copy']);
    command.on('error', (err) => reject(new Error(`ffmpeg error: ${err?.message || err}`)));
    command.on('end', () => resolve(outPath));
    command.run();
  });
}

module.exports = {
  buildTranscodeService,
  checkFfmpeg,
  resolveFfmpegPath,
  parseProfiles,
  PROFILE_HEIGHTS,
  DEFAULT_PROFILES,
};
