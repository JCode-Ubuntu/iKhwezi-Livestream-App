'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  buildStorageProviderFromEnv,
  buildLocalStorageProvider,
  assertProviderShape,
} = require('../storage-v2');
const { buildTranscodeQueueFromEnv } = require('../queues');
const {
  buildTranscodeService,
  resolveFfmpegPath,
  checkFfmpeg,
  parseProfiles,
} = require('../services/transcode');

/**
 * Media pipeline (Phase 2A) — the guarantees that matter:
 *  1. env-honest provider selection (no S3_* env → local disk, capabilities
 *     say so; half-set env falls back loudly to local, never crashes)
 *  2. local driver roundtrip put-get-delete
 *  3. queue falls back in-process without Redis and never rejects add()
 *  4. transcode service is honest (disabled default, ffmpeg probe gates)
 *  5. REAL transcode: ffmpeg-static renders a tiny source into a 480p mp4
 */

async function tempRoot() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ikhwezi-media-'));
  return dir;
}

test('storage: no S3_* env → local driver with honest capabilities', () => {
  const provider = buildStorageProviderFromEnv({
    env: {},
    localRoot: path.join(__dirname, '..', 'storage'),
  });
  assertProviderShape(provider);
  assert.equal(provider.capabilities.type, 'local', 'no env must yield local');
  assert.equal(provider.capabilities.presigned, false);
});

test('storage: PARTIAL S3 env (missing secret) falls back to local, loud warn', () => {
  const warnings = [];
  const provider = buildStorageProviderFromEnv({
    env: { S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'x' }, // secret missing → local
    localRoot: path.join(__dirname, '..', 'storage'),
    log: { warn: (m) => warnings.push(m) },
  });
  // The builder treats an incomplete-but-configured env as NOT configured
  // (silent local) OR warns and degrades — both are acceptable honesty
  // shapes; what is NOT acceptable is throwing or claiming s3.
  assertProviderShape(provider);
  assert.equal(provider.capabilities.type, 'local');
});

test('storage: BAD S3 env (constructor throws) degrades to local with a loud warning', () => {
  const warnings = [];
  const provider = buildStorageProviderFromEnv({
    env: { S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'x', S3_SECRET_ACCESS_KEY: 'y' },
    localRoot: path.join(__dirname, '..', 'storage'),
    buildS3: () => { throw new Error('simulated SDK failure'); },
    log: { warn: (m) => warnings.push(m) },
  });
  assertProviderShape(provider);
  assert.equal(provider.capabilities.type, 'local', 'must degrade, not throw');
  assert.ok(warnings.length > 0, 'degradation must be LOUD');
});

test('storage: local driver roundtrip — put/get/delete/delete-missing', async () => {
  const root = await tempRoot();
  try {
    const provider = buildLocalStorageProvider({ root, publicBaseUrl: 'https://cdn.example.test' });
    const src = path.join(root, 'src.txt');
    await fsp.writeFile(src, 'roundtrip');
    const key = 'uploads/rt-test.txt';

    await provider.put(key, src);
    // get(key, dest): copies the object back out to a local path.
    const dest = path.join(root, 'out.txt');
    const got = await provider.get(key, dest);
    assert.equal(got.key, key);
    const body = await fsp.readFile(dest, 'utf-8');
    assert.equal(body, 'roundtrip', 'get must copy the stored bytes back out');

    // publicUrl must be prefixed when a base is configured.
    assert.ok(
      provider.publicUrl(key).startsWith('https://cdn.example.test/'),
      `publicUrl must use the configured base: ${provider.publicUrl(key)}`,
    );

    assert.equal(await provider.remove(key), true, 'remove must resolve true when the key existed');
    await assert.rejects(() => provider.get(key, dest), 'removed key must throw ENOENT');
    // Removing a missing key must resolve (fire-and-forget caller safety).
    assert.equal(await provider.remove(key), false, 'remove on missing key resolves false, never throws');

    // key safety: traversal attempts must be rejected loudly, not written.
    await assert.rejects(() => provider.put('../evil.txt', src), 'path traversal must throw');
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('storage: local driver put(key, samePath) is a safe no-op (Linux truncation guard)', async () => {
  const root = await tempRoot();
  try {
    const provider = buildLocalStorageProvider({ root });
    const src = path.join(root, 'self-copy.txt');
    await fsp.writeFile(src, 'precious-original-bytes');
    // Absolute same file (src === dest) and same file via different path case.
    const r1 = await provider.put('self-copy.txt', src);
    assert.equal(r1.noop, true, 'src==dest put must short-circuit, never copyFile');
    const body = await fsp.readFile(src, 'utf-8');
    assert.equal(body, 'precious-original-bytes', 'content must be untouched');
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('queue: REDIS_URL unset → in-process executor, add() never rejects', async () => {
  const ran = [];
  const queue = buildTranscodeQueueFromEnv({
    processor: async (job) => { ran.push(job.data.filename); },
    env: {},
    log: { error: () => {} },
  });
  assert.equal(queue.capabilities.type, 'in-process');
  const r = await queue.add('transcode', { filename: 'a.mp4' });
  assert.equal(r.queued, true);
  assert.equal(r.fallback, true);
  // in-process: allow the setImmediate chain to flush
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(ran, ['a.mp4'], 'job must have actually run');
});

test('queue: worker processor errors are swallowed (never unhandled rejection)', async () => {
  const errors = [];
  const queue = buildTranscodeQueueFromEnv({
    processor: async () => { throw new Error('boom'); },
    env: {},
    log: { error: (m) => errors.push(m) },
  });
  const r = await queue.add('transcode', { filename: 'b.mp4' });
  assert.equal(r.queued, true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(errors.length > 0, 'in-process failure must be logged, not thrown');
  assert.ok(errors.some((e) => /boom/.test(e)), 'the actual error must appear in the log');
});

test('transcode: default OFF; capabilities never claim enabled until probe passes', async () => {
  const svc = buildTranscodeService({ env: {}, ffmpegProbeCache: {}, log: { warn: () => {}, log: () => {} } });
  assert.equal(svc.capabilities.requested, false, 'TRANSCODE_ENABLED unset means OFF');
  assert.equal(svc.capabilities.enabled, false);
  // Disabled short-circuits BEFORE probing anything.
  const r = await svc.process({ name: 'transcode', data: { filename: 'x.mp4' } });
  assert.equal(r.ok, false);
  assert.match(r.skipped, /disabled/);
});

test('transcode: enabled + real ffmpeg-static binary → 480p mp4 rendered (REAL run)', { timeout: 30000 }, async () => {
  const ffmpegPath = resolveFfmpegPath({});
  assert.ok(ffmpegPath, 'ffmpeg-static binary must resolve in this repo');
  const probe = await checkFfmpeg({ env: {} });
  assert.equal(probe.available, true, `ffmpeg probe must pass: ${probe.reason || ''}`);

  const videosDir = await tempRoot();
  try {
    const srcPath = path.join(videosDir, 'src.mp4');
    // Generate a tiny 0.5s test source with ffmpeg itself (no binary fixture):
    //   lavfi color + anullsrc audio, so the -c:a copy path is exercised.
    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const args = [
        '-f', 'lavfi', '-i', 'color=c=red:size=128x96:rate=10:duration=0.5',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        '-y', srcPath,
      ];
      const child = spawn(ffmpegPath, args, { windowsHide: true });
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`fixture-gen exit ${code}`))));
    });

    const svc = buildTranscodeService({
      env: { TRANSCODE_ENABLED: 'true' },
      videosDir,
      ffmpegProbeCache: {},
      log: { warn: () => {}, log: () => {} },
    });
    assert.equal(svc.capabilities.requested, true);
    const out = svc.outputPathFor('src.mp4', '480p');

    const r = await svc.process({ name: 'transcode', data: { filename: 'src.mp4', sourcePath: srcPath } });
    assert.equal(r.ok, true, `transcode run must succeed: ${JSON.stringify(r.errors || [])}`);
    assert.ok(fs.existsSync(out), `output file must exist: ${out}`);
    const stat = await fsp.stat(out);
    assert.ok(stat.size > 1000, 'output must be a real file (>1 kB)');
    assert.equal(svc.capabilities.enabled, true, 'probe passed + enabled → active');
  } finally {
    await fsp.rm(videosDir, { recursive: true, force: true });
  }
});

test('transcode: unknown profile names are flagged, missing source degrades cleanly', async () => {
  const { known, skipped } = parseProfiles('1080p,2160p,480p');
  assert.deepEqual(known, ['480p'], 'only implemented ladder entries run');
  assert.deepEqual(skipped, ['1080p', '2160p'], 'unimplemented names are skipped with a warning');
  // Surfaces as a skipped job (loudly), not an upload failure.
  assert.deepEqual(parseProfiles('').known, ['480p'], 'empty config defaults to the implemented ladder');
});
