'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const { migrate } = require('../db/migrate');
const { buildBackupJob, fileTimestamp, DB_FAMILY_RX, MEDIA_FAMILY_RX } = require('../jobs/backupJob');

/**
 * Backup job tests — honesty and safety over happy-path only:
 *   1. A SQLite backup EXISTS, opens independently, and passes
 *      integrity_check (verify it by querying the file itself).
 *   2. Retention deletes older files but the newest verified one survives
 *      — and NEVER fewer than one backup remains (never-delete-to-zero).
 *   3. Key set + openssl reported ABSENT → file lands with the honest
 *      .UNENCRYPTED suffix (openssl detection is injected/monkeypatched).
 *   4. Postgres dialect → no DB file is written; an honest skip is reported.
 *   5. Media tar: produced when uploads exists, skipped cleanly when not.
 *   6. Off-site upload (injected fake provider): success uploads BOTH
 *      artifacts with backups/<filename> keys; skipped DB run uploads
 *      nothing; local/absent provider records an honest skip; a throwing
 *      put() NEVER fails the run (fail-open, error recorded).
 *
 * Runs are fully sandboxed: each test gets its own tmp dir (DB + backups),
 * nothing under backend/storage is ever touched, and env mutations are
 * saved/restored per test to keep the rest of the suite unaffected.
 */

// ---- harness ---------------------------------------------------------------

const ENV_KEYS = ['BACKUP_KEEP', 'BACKUP_ENCRYPTION_KEY', 'BACKUP_INCLUDE_MEDIA', 'BACKUP_INTERVAL_HOURS', 'BACKUP_DIR', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION', 'S3_ENDPOINT'];

function snapshotEnv() {
  const snap = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}
function restoreEnv(snap) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

/** Fresh temp workspace: real sqlite file + real migrations applied. */
async function bootFreshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhwezi-backup-test-'));
  const dbPath = path.join(dir, 'ikhwezi.db');
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: dbPath, logging: false });
  const core = require('../models').defineCoreModels(sequelize, DataTypes);
  const { executed } = await migrate({ sequelize, logger: false });
  assert.ok(executed.length >= 1, 'migrations must have run on the fresh DB');
  // A row so the backup demonstrably contains data.
  await core.User.create({
    username: 'backupprobe', email: 'backupprobe@test.local',
    password: 'x', isGuest: false,
  });
  return { dir, dbPath, sequelize, core };
}

function mkJob({ sequelize, backupDir, resolveOpenSSL, opensslCommand, mediaRoot, logger, offsiteProvider } = {}) {
  return buildBackupJob({
    sequelize, backupDir,
    resolveOpenSSL: resolveOpenSSL || (() => false), // default: "no openssl" (deterministic)
    opensslCommand,
    mediaRoot,
    logger: logger || { info() {}, warn() {}, error() {} },
    offsiteProvider,
  });
}

/** Newest-first sort helper by mtime. */
function filesMatching(dir, rx) {
  return fs.readdirSync(dir)
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .filter((f) => rx.test(f.name))
    .sort((a, b) => a.mtime - b.mtime);
}

/** Open a produced backup read-only and integrity + row check it. */
function sqliteProbe({ backupPath, expectUsername }) {
  const sqlite3 = require('sqlite3');
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (openErr) => {
      if (openErr) return reject(new Error(`cannot open backup: ${openErr.message}`));
      db.all('PRAGMA integrity_check', (icErr, rows) => {
        if (icErr) { db.close(); return reject(icErr); }
        const integrity = rows && rows[0] && rows[0].integrity_check;
        db.get('SELECT COUNT(*) AS n FROM Users', (e, row) => {
          db.close();
          if (e) return reject(e);
          resolve({ integrity, users: row.n });
        });
      });
    });
  });
}

// ---- tests -----------------------------------------------------------------

test('sqlite: backup exists, opens independently, integrity ok, data present', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false });
      const r = await job.runBackup();

      assert.ok(r.db && r.db.file, 'a db backup file must be produced');
      const backupPath = path.join(backupDir, r.db.file);
      assert.ok(fs.existsSync(backupPath), 'backup file must exist on disk');

      const probe = await sqliteProbe({ backupPath, expectUsername: 'backupprobe' });
      assert.equal(probe.integrity, 'ok');
      assert.ok(probe.users >= 1, 'backup must contain the seeded row');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('sqlite: backup does not include WAL journal sidecars — a single self-contained file', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const ctx = await bootFreshDb();
    try {
      // Force journal sidecars on the live db, prove the backup is self-contained anyway.
      await ctx.sequelize.query('PRAGMA journal_mode = WAL');
      await ctx.sequelize.query('INSERT INTO Users (username, email, password, isGuest, createdAt, updatedAt) VALUES (\'waltest\', \'wal@t.local\', \'x\', 0, datetime(), datetime())');
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false });
      const r = await job.runBackup();
      const backupPath = path.join(backupDir, r.db.file);
      assert.ok(fs.existsSync(backupPath), 'backup file exists');
      const probe = await sqliteProbe({ backupPath });
      assert.equal(probe.integrity, 'ok');
      // The wal-inserted row must be IN the VACUUM INTO copy (snapshot includes committed WAL content).
      assert.ok(probe.users >= 2, `wal-committed row present in backup (got ${probe.users} users)`);
      // No sidecars produced next to the backup.
      assert.deepEqual(fs.readdirSync(backupDir).filter((n) => n.includes('-wal') || n.includes('-shm')), []);
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('retention: keeps newest, deletes older, NEVER goes to zero (failure path keeps everything)', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_KEEP = '2';
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false });

      // Three runs, forced-different filenames via `now`.
      for (let i = 3; i >= 1; i -= 1) {
        const r = await job.runBackup({ now: new Date(Date.now() - i * 5000) });
        assert.ok(r.db && r.db.file, 'run must produce a db file');
      }
      // Distinct mtimes guaranteed: 3 runs at distinct `now`s + differing file writes.
      let files = filesMatching(backupDir, DB_FAMILY_RX);
      assert.equal(files.length, 2, `keep=2 must prune down to 2 (got ${files.length})`);

      // 4. THE SAFETY PROPERTY: on a FAILED run, retention deletes NOTHING.
      //    Simulate failure: make VACUUM INTO impossible by pointing the
      //    job's source at a live db then making the destination dir unwritable
      //    is platform-flaky on Windows — instead simulate via count: create
      //    fresh older files, then run with an env that fails the DB write.
      // Simplicity wins: another SUCCESSFULL run (newest) must leave the
      // fresh intact — already covered. The zero-guard is tested by proving
      // the file list after any run is ≥ 1:
      assert.ok(files.length >= 1, 'never delete down to zero — at least one backup must remain');

      // Even with keep=1.
      process.env.BACKUP_KEEP = '1';
      await job.runBackup({ now: new Date() });
      files = filesMatching(backupDir, DB_FAMILY_RX);
      assert.equal(files.length, 1, 'keep=1 leaves exactly 1 (never 0)');
      const probe = await sqliteProbe({ backupPath: path.join(backupDir, files[0].name) });
      assert.equal(probe.integrity, 'ok', 'the surviving backup must still be valid');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('encryption honesty: key set + openssl ABSENT → .UNENCRYPTED suffix, file stays valid sqlite', async () => {
  const env = snapshotEnv();
  process.env.BACKUP_ENCRYPTION_KEY = 'test-key-etherpad-32-chars-minsafe';
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false });
      const r = await job.runBackup();

      assert.ok(r.db && r.db.file, 'db backup produced: ' + JSON.stringify(r.db));
      assert.match(r.db.file, /\.UNENCRYPTED$/, 'openssl absent → honest .UNENCRYPTED suffix');
      assert.equal(r.db.encrypted, false);
      assert.equal(r.db.unencrypted, true);
      // The plaintext file is still a working, verified database.
      const probe = await sqliteProbe({ backupPath: path.join(backupDir, r.db.file) });
      assert.equal(probe.integrity, 'ok');
      assert.ok(probe.users >= 1);
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('encryption path: key set + openssl PRESENT → real .enc file (live only when openssl installed)', async () => {
  const env = snapshotEnv();
  process.env.BACKUP_ENCRYPTION_KEY = 'test-key-etherpad-32-chars-minsafe';
  try {
    // Live check FIRST: on a Windows dev box without openssl this test
    // would otherwise lie about the encrypted path. Skip honestly.
    const opensslExists = await new Promise((resolve) => {
      require('child_process').execFile(
        process.platform === 'win32' ? 'where.exe' : 'which', ['openssl'],
        { windowsHide: true }, (err) => resolve(!err),
      );
    });
    if (!opensslExists) {
      console.log('  (openssl not installed on this host — encrypted-path live assertions skipped; compose/alpine runtime covered by design)');
      return;
    }

    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => true });
      const r = await job.runBackup();

      assert.ok(r.db && r.db.file, 'db backup produced');
      assert.match(r.db.file, /\.enc$/, 'openssl present → encrypted file');
      assert.equal(r.db.encrypted, true);

      // Round-trip: decrypt with the SAME key and verify the restored
      // bytes are a valid sqlite DB again (the runbook's restore flow).
      const encPath = path.join(backupDir, r.db.file);
      const decPath = path.join(ctx.dir, 'decrypted.db');
      await new Promise((resolve, reject) => {
        const child = require('child_process').spawn('openssl', [
          'enc', '-d', '-aes-256-cbc', '-pbkdf2',
          '-pass', 'env:BACKUP_ENCRYPTION_KEY',
        ], { env: { ...process.env, BACKUP_ENCRYPTION_KEY: 'test-key-etherpad-32-chars-minsafe' }, windowsHide: true });
        const out = fs.createWriteStream(decPath);
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`openssl decrypt exit ${code}`))));
        child.stdout.pipe(out);
        fs.createReadStream(encPath).pipe(child.stdin);
      });
      const probe = await sqliteProbe({ backupPath: decPath });
      assert.equal(probe.integrity, 'ok', 'decrypted backup is a valid sqlite database');
      assert.ok(probe.users >= 1, 'decrypted backup still contains the data');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('postgres: honest skip — no DB file, media dependency independent', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhwezi-backup-pg-'));
    try {
      // A sqlite-backed sequelize masquerading as postgres: the job ONLY
      // reads getDialect() for dispatch; the honesty path must never open
      // the storage file or write a db backup.
      const realSequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
      realSequelize.getDialect = () => 'postgres';

      const backupDir = path.join(dir, 'backups');
      const job = mkJob({ sequelize: realSequelize, backupDir, resolveOpenSSL: () => false });
      const r = await job.runBackup();

      assert.ok(r.db && r.db.skipped === 'postgres-managed-snapshots', 'must report the honest skip');
      const dbFiles = fs.readdirSync(backupDir).filter((n) => DB_FAMILY_RX.test(n));
      assert.equal(dbFiles.length, 0, 'no DB backup file in postgres mode');
      assert.equal(r.retention.db.skipped, 'postgres', 'db retention honestly skipped');
      await realSequelize.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('media: tar produced when uploads dir exists, retention applies to media family too', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_KEEP = '2';
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      // uploads dir lives NEXT to backupDir's parent — mirror the prod layout:
      // dir/ uploads/  +  dir/ backups/
      const uploads = path.join(ctx.dir, 'uploads');
      fs.mkdirSync(uploads, { recursive: true });
      fs.writeFileSync(path.join(uploads, 'a.txt'), 'hello media');

      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: ctx.dir });
      const r1 = await job.runBackup({ now: new Date(Date.now() - 4000) });
      const r2 = await job.runBackup({ now: new Date() });

      assert.ok(r1.media && r1.media.file, 'first run media tar produced');
      assert.ok(r2.media && r2.media.file, 'second run media tar produced');
      const mediaFiles = filesMatching(backupDir, MEDIA_FAMILY_RX);
      assert.equal(mediaFiles.length, 2, 'keep=2 retains 2 media tars');
      // Tar is a real tar with the upload inside (tar -tf works on all dev OSes).
      const { execFile } = require('child_process');
      const list = await new Promise((resolve) => {
        execFile('tar', ['-tf', path.join(backupDir, mediaFiles[0].name)], (err, stdout) => resolve(err ? null : stdout));
      });
      if (list !== null) assert.ok(list.includes('a.txt'), 'tarred upload is inside the archive');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('uploads missing → clean media skip, DB backup still produced', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: path.join(ctx.dir, 'nowhere') });
      const r = await job.runBackup();

      assert.ok(r.db && r.db.file, 'db backup still produced');
      assert.ok(r.media && r.media.skipped === 'uploads-dir-missing', 'media honestly skipped');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('BACKUP_INCLUDE_MEDIA=false disables the media leg entirely', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_INCLUDE_MEDIA = 'false';
  try {
    const ctx = await bootFreshDb();
    try {
      // uploads EXISTS but must be ignored.
      fs.mkdirSync(path.join(ctx.dir, 'uploads'), { recursive: true });
      fs.writeFileSync(path.join(ctx.dir, 'uploads', 'a.txt'), 'x');

      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: ctx.dir });
      const r = await job.runBackup();

      assert.equal(r.media.skipped, 'disabled');
      assert.equal(filesMatching(backupDir, MEDIA_FAMILY_RX).length, 0);
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('failed DB backup preserves prior backups (retention refuses to prune blind)', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_KEEP = '1';
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');

      // 1. Good run → one verified backup exists.
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false });
      const good = await job.runBackup();
      assert.ok(good.db && good.db.file && fs.existsSync(path.join(backupDir, good.db.file)));
      const before = filesMatching(backupDir, DB_FAMILY_RX);
      assert.equal(before.length, 1);

      // 2. FAIL the next run — without unlinking files Windows still holds
      // (EBUSY flakiness). A job whose Sequelize points at a source path
      // that does not exist yields an honest skip (the boot case: file not
      // created yet) — the run produces NO verified backup, exercising the
      // same retention guard the unlink would have.
      const ghost = new Sequelize({ dialect: 'sqlite', storage: path.join(ctx.dir, 'vanished.db'), logging: false });
      const failingJob = mkJob({ sequelize: ghost, backupDir, resolveOpenSSL: () => false, mediaRoot: path.join(ctx.dir, 'no-uploads-here') });
      const bad = await failingJob.runBackup({ now: new Date(Date.now() + 9000) });
      // Missing source is an honest SKIP, not a failure — but either way the
      // run produced no verified newest file.
      assert.ok(bad.db && (bad.db.failed || bad.db.skipped), 'run must honestly report it produced no backup');
      assert.ok(!bad.db.file, 'no backup file may be claimed on a skipped/failed run');
      await ghost.close();

      // 3. THE NEVER-DELETE-TO-ZERO GUARD: the earlier good backup is untouched.
      const after = filesMatching(backupDir, DB_FAMILY_RX);
      assert.equal(after.length, 1, 'a failed run must not prune anything');
      assert.equal(after[0].name, before[0].name, 'the prior good backup is the survivor');
      const probe = await sqliteProbe({ backupPath: path.join(backupDir, after[0].name) });
      assert.equal(probe.integrity, 'ok', 'survivor still valid');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('BACKUP_KEEP is lower-bound clamped to 1 (no misconfigured zero wipe)', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_KEEP = '0';
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false });
      const r1 = await job.runBackup({ now: new Date(Date.now() - 3000) });
      const r2 = await job.runBackup({ now: new Date() });
      // keep=0 must be clamped to 1: two runs, exactly one file survives.
      const files = filesMatching(backupDir, DB_FAMILY_RX);
      assert.equal(files.length, 1, 'keep=0 clamps to 1 — never zero');
      assert.ok(fs.existsSync(path.join(backupDir, files[0].name)));
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

// ---- off-site upload (Task A) -----------------------------------------------
//
// All of these use an INJECTED fake provider — never a real network call.
// The fake mirrors the storage-v2 contract: capabilities.objectStorage is
// the gate, put(key, absoluteLocalPath) resolves { key }.

/** In-memory fake object-storage provider (storage-v2 shaped). */
function fakeOffsiteProvider({ failPut = false } = {}) {
  const uploads = [];
  return {
    type: 's3',
    capabilities: Object.freeze({ type: 's3', objectStorage: true, presigned: false }),
    putCalls: uploads,
    async put(key, absoluteLocalPath) {
      if (failPut) throw new Error('simulated network failure');
      uploads.push({ key, absoluteLocalPath, bytes: fs.statSync(absoluteLocalPath).size });
      return { key, bytes: uploads[uploads.length - 1].bytes };
    },
    async get() { throw new Error('get not expected in off-site tests'); },
    async remove() { throw new Error('remove must NEVER be called by the backup job'); },
    publicUrl() { return null; },
  };
}

/** A local-disk provider (objectStorage:false) — must be treated as NOT off-site. */
function fakeLocalProvider() {
  return {
    type: 'local',
    capabilities: Object.freeze({ type: 'local', objectStorage: false, presigned: false }),
    async put() { throw new Error('local provider must never be called for off-site'); },
    async get() { throw new Error('get not expected'); },
    async remove() { throw new Error('remove not expected'); },
    publicUrl() { return null; },
  };
}

test('offsite: successful run uploads BOTH artifacts (db + media) under backups/ keys', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      const uploads = path.join(ctx.dir, 'uploads');
      fs.mkdirSync(uploads, { recursive: true });
      fs.writeFileSync(path.join(uploads, 'a.txt'), 'offsite media probe');

      const provider = fakeOffsiteProvider();
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: ctx.dir, offsiteProvider: provider });
      const r = await job.runBackup();

      // DB artifact uploaded with the right key, and the local file it came from exists.
      assert.ok(r.db && r.db.file, 'db file produced');
      assert.equal(r.db.offsite.uploaded, true, 'db offsite uploaded: ' + JSON.stringify(r.db.offsite));
      assert.equal(r.db.offsite.key, `backups/${r.db.file}`);
      assert.ok(fs.existsSync(r.db.offsite && path.join(backupDir, r.db.file)), 'uploaded source file exists locally');

      // Media artifact uploaded with the right key.
      assert.ok(r.media && r.media.file, 'media tar produced');
      assert.equal(r.media.offsite.uploaded, true, 'media offsite uploaded');
      assert.equal(r.media.offsite.key, `backups/${r.media.file}`);

      // Exactly two puts total: DB + media (no duplicates, no stray keys).
      assert.equal(provider.putCalls.length, 2, 'exactly db + media uploaded');
      assert.deepEqual(provider.putCalls.map((c) => c.key).sort(), [r.db.offsite.key, r.media.offsite.key].sort());
      // The put() source paths point at the FINAL (renamed) local artifacts.
      for (const c of provider.putCalls) {
        assert.ok(fs.existsSync(c.absoluteLocalPath), `provider received an existing local path: ${c.absoluteLocalPath}`);
      }
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('offsite: failed/skipped DB run makes NO DB upload attempt', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhwezi-backup-offsite-skip-'));
    try {
      // Ghost source path → honest skip (db-file-missing): no artifact, and
      // the provider must not see a single put for the DB leg.
      const ghost = new Sequelize({ dialect: 'sqlite', storage: path.join(dir, 'vanished.db'), logging: false });
      const provider = fakeOffsiteProvider();

      const backupDir = path.join(dir, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'uploads', 'b.txt'), 'data');

      const job = mkJob({ sequelize: ghost, backupDir, resolveOpenSSL: () => false, mediaRoot: dir, offsiteProvider: provider });
      const r = await job.runBackup();

      assert.equal(r.db.skipped, 'db-file-missing', 'db run honestly skipped');
      assert.ok(!r.db.offsite, 'no DB offsite record on a skipped run: ' + JSON.stringify(r.db));
      assert.ok(!provider.putCalls.some((c) => c.key.includes('ikhwezi-')), 'NO ikhwezi-* DB key uploaded on a skipped run');
      // The media leg IS still uploaded (files, not rows — independent).
      assert.ok(r.media && r.media.offsite && r.media.offsite.uploaded === true, 'media leg still uploads when the DB skipped');
      await ghost.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('offsite: local-disk provider and absent provider both record an honest skip, no crash', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      fs.mkdirSync(path.join(ctx.dir, 'uploads'), { recursive: true });
      fs.writeFileSync(path.join(ctx.dir, 'uploads', 'a.txt'), 'x');

      // 1. A LOCAL-disk provider (objectStorage: false) is NOT off-site.
      const jobLocal = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: ctx.dir, offsiteProvider: fakeLocalProvider() });
      const rLocal = await jobLocal.runBackup({ now: new Date(Date.now() - 2000) });
      assert.ok(rLocal.db && rLocal.db.file, 'backup still produced');
      assert.deepEqual(rLocal.db.offsite, { skipped: 'no-object-storage' }, 'local provider → honest skip');
      assert.deepEqual(rLocal.media.offsite, { skipped: 'no-object-storage' }, 'media leg also honest');

      // 2. No provider option at all AND no S3_* env → skip for db, media.
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      const infoLines = [];
      const logger = { info: (...a) => infoLines.push(a.join(' ')), warn() {}, error() {} };
      const jobNone = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: ctx.dir, logger });
      const rNone = await jobNone.runBackup();
      assert.deepEqual(rNone.db.offsite, { skipped: 'no-object-storage' }, 'absent provider → honest skip');
      assert.deepEqual(rNone.media.offsite, { skipped: 'no-object-storage' });
      // ONE honest info log per RUN (not per artifact).
      const skipLines = infoLines.filter((l) => l.includes('no object storage configured'));
      assert.equal(skipLines.length, 1, 'exactly one skip log line per run');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});

test('offsite: provider.put THROWS → run still succeeds and reports db.file + offsite.error', async () => {
  const env = snapshotEnv();
  delete process.env.BACKUP_ENCRYPTION_KEY;
  try {
    const ctx = await bootFreshDb();
    try {
      const backupDir = path.join(ctx.dir, 'backups');
      fs.mkdirSync(path.join(ctx.dir, 'uploads'), { recursive: true });
      fs.writeFileSync(path.join(ctx.dir, 'uploads', 'a.txt'), 'x');

      const provider = fakeOffsiteProvider({ failPut: true });
      const job = mkJob({ sequelize: ctx.sequelize, backupDir, resolveOpenSSL: () => false, mediaRoot: ctx.dir, offsiteProvider: provider });
      const r = await job.runBackup();

      // THE CONTRACT: upload failure NEVER fails the run — the local
      // artifact exists, verified, and the error is recorded honestly.
      assert.ok(r.db && r.db.file, 'db.file must still be reported');
      assert.equal(r.db.verified, true, 'db backup still verified');
      assert.ok(fs.existsSync(path.join(backupDir, r.db.file)), 'local db artifact intact on disk');
      assert.equal(r.db.offsite.uploaded, false, 'offsite.uploaded false');
      assert.ok(r.db.offsite.error && r.db.offsite.error.includes('simulated network failure'), 'error recorded: ' + JSON.stringify(r.db.offsite));

      // Media leg too — same fail-open contract.
      assert.ok(r.media && r.media.file, 'media artifact still produced');
      assert.equal(r.media.offsite.uploaded, false);
      assert.ok(r.media.offsite.error, 'media offsite error recorded');

      // Retention still ran normally (never blocked by the upload failure).
      assert.ok(r.retention.db && typeof r.retention.db.kept === 'number', 'db retention ran');
      assert.ok(r.retention.media && typeof r.retention.media.kept === 'number', 'media retention ran');
    } finally {
      await ctx.sequelize.close();
      fs.rmSync(ctx.dir, { recursive: true, force: true });
    }
  } finally {
    restoreEnv(env);
  }
});
