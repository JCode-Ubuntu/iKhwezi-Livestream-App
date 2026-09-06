'use strict';

/**
 * Automated encrypted backups.
 *
 * Why: the app's data (SQLite file + uploads) lived on a single container
 * volume with NO scheduled backups — a volume loss, an ops mistake, or a
 * host disk failure meant total data loss. Operators had to back up by
 * hand (docs/comms/v2-launch-backup-wipe-checklist.md Phase 1 is a manual
 * checklist precisely because nothing automated existed).
 *
 * What a run does:
 *   1. SQLite dialect: `VACUUM INTO` a timestamped copy into BACKUP_DIR
 *      (default storage/backups — created lazily), then verify it by
 *      opening the COPY read-only and running `PRAGMA integrity_check`
 *      plus counting sqlite_master tables. A backup that has not been
 *      verified is not a backup. VACUUM INTO takes a transactionally
 *      consistent snapshot on a dedicated connection (busy_timeout'd) —
 *      unlike "cp the live file", which the wipe runbook explicitly
 *      warns can capture a mid-write database.
 *   2. Postgres dialect: HONEST SKIP. A file dump of a live Postgres DB
 *      is not a trustworthy backup (no single snapshot moment; tables
 *      drift during the dump; FKs can point at rows that changed mid-way).
 *      Provider-managed snapshots ARE the real mechanism (compose
 *      postgres → pg_dump per docs/ops/backup-restore.md; Render Postgres
 *      → provider-managed backups). The job logs one explicit skip line
 *      per run so "it ran but produced nothing" can never be mistaken
 *      for silence. Media (uploads tar) still backs up — files, not rows.
 *   3. Encryption: when BACKUP_ENCRYPTION_KEY is set AND an openssl
 *      binary exists, every artifact is piped through
 *      `openssl enc -aes-256-cbc -pbkdf2 -salt` — the exact parameters
 *      the wipe runbook prescribes for manual archives, so automated and
 *      manual backups are interchangeable. Key set but openssl ABSENT
 *      (a Windows dev box without openssl): the file is written PLAIN
 *      with a `.UNENCRYPTED` filename suffix and a loud warning — an
 *      honestly labeled plain file beats a confidently labeled encrypted
 *      one that isn't. The compose containers (node:20-alpine) ship
 *      openssl, so production always encrypts. The key travels via
 *      environment (`-pass env:`), never in argv (kept out of `ps`).
 *   4. Retention: keep the newest BACKUP_KEEP files per family
 *      (ikhwezi-*.db* / uploads-*.tar*, default 7), delete older — but
 *      ONLY deletions happen after this run produced a VERIFIED newest
 *      file, and that file is never a deletion candidate. A failed run
 *      prunes nothing: retention can never delete the last good backup
 *      (never-delete-to-zero).
 *
 * The job never runs during tests unless started explicitly. start() runs
 * once immediately, then every BACKUP_INTERVAL_HOURS (default 24) on an
 * unref'd timer, mirroring jobs/guestCleanup.js. Manual trigger:
 * `npm run backup` (backend/scripts/backup.js).
 */

const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const HOUR_MS = 60 * 60 * 1000;

/** UTC timestamp for filenames: 20260906-152301Z (sort == chronological). */
function fileTimestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

/**
 * Backup "families" — the ONLY files retention is ever allowed to delete.
 * The optional -N suffix appears when two backups land in the same second
 * (uniquePath); .enc/.UNENCRYPTED are the encryption endings.
 */
const DB_FAMILY_RX = /^ikhwezi-\d{8}-\d{6}Z(?:-\d+)?\.db(?:\.enc|\.UNENCRYPTED)?$/;
const MEDIA_FAMILY_RX = /^uploads-\d{8}-\d{6}Z(?:-\d+)?\.tar(?:\.enc|\.UNENCRYPTED)?$/;

/**
 * Detect an accessible openssl binary (memoized per resolver instance).
 * Injectable for tests via the buildBackupJob option `resolveOpenSSL`.
 */
function createOpenSSLResolver() {
  let cached;
  return () => {
    if (cached !== undefined) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const probe = process.platform === 'win32' ? 'where.exe' : 'which';
      execFile(probe, ['openssl'], { windowsHide: true }, (err) => {
        cached = !err;
        resolve(cached);
      });
    });
  };
}

/**
 * `VACUUM INTO` sourcePath → destPath on a dedicated, busy-timeout'd
 * connection. destPath must not exist (caller guarantees via uniquePath).
 * Resolves when the file is complete and the handle closed.
 */
function sqliteBackup({ sourcePath, destPath }) {
  const sqlite3 = require('sqlite3'); // backend dependency (Sequelize uses it)
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sourcePath, sqlite3.OPEN_READWRITE, (openErr) => {
      if (openErr) return reject(new Error(`cannot open source db ${sourcePath}: ${openErr.message}`));
      db.run('PRAGMA busy_timeout = 5000', (pragmaErr) => {
        if (pragmaErr) { db.close(); return reject(new Error(`busy_timeout failed: ${pragmaErr.message}`)); }
        db.run(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`, (vacErr) => {
          if (vacErr) { db.close(); return reject(new Error(`VACUUM INTO failed: ${vacErr.message}`)); }
          db.close(() => resolve(true));
        });
      });
    });
  });
}

/**
 * Open the produced copy read-only and PROVE it: integrity_check must be
 * 'ok' and sqlite_master must be readable (both a page-level corruption
 * gate and a "this really is a sqlite database" smoke read).
 */
function verifySQLiteBackup({ backupPath }) {
  const sqlite3 = require('sqlite3');
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (openErr) => {
      if (openErr) return reject(new Error(`verify: cannot open ${backupPath}: ${openErr.message}`));
      db.all('PRAGMA integrity_check', (icErr, icRows) => {
        if (icErr) {
          db.close(() => reject(new Error(`verify: integrity_check failed: ${icErr.message}`)));
          return;
        }
        if (!Array.isArray(icRows) || icRows.length !== 1 || icRows[0].integrity_check !== 'ok') {
          db.close(() => reject(new Error(`verify: integrity_check != ok: ${JSON.stringify(icRows)}`)));
          return;
        }
        db.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'", (tcErr, row) => {
          // WAIT FOR CLOSE before resolving: on Windows the sqlite handle is
          // released asynchronously — resolving while it is open lets the
          // caller's rename (finalizeArtifact) race the release → EBUSY.
          db.close((closeErr) => {
            if (tcErr) return reject(new Error(`verify: sqlite_master read failed: ${tcErr.message}`));
            if (closeErr) return reject(new Error(`verify: close failed: ${closeErr.message}`));
            resolve({ integrity: 'ok', tables: row.n });
          });
        });
      });
    });
  });
}

/**
 * Stream-encrypt fromPath → toPath with `openssl enc -aes-256-cbc -pbkdf2
 * -salt -pass env:BACKUP_ENCRYPTION_KEY` (key via env, never argv).
 * On failure the partial output is removed and { ok:false } returns —
 * the caller keeps the verified plaintext, honestly renamed .UNENCRYPTED.
 */
function opensslEncryptTo({ opensslCommand = 'openssl', fromPath, toPath, key }) {
  return new Promise((resolve) => {
    let settled = false;
    let childClosed = false;
    let childCode = null;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };

    const out = fs.createWriteStream(toPath);
    let stderrTail = '';

    const child = spawn(opensslCommand, [
      'enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-pass', 'env:BACKUP_ENCRYPTION_KEY',
    ], { env: { ...process.env, BACKUP_ENCRYPTION_KEY: key }, windowsHide: true });

    child.stderr?.on('data', (c) => { stderrTail = (stderrTail + c).slice(-500); });
    child.on('error', (e) => { out.destroy(); done({ ok: false, error: e, stderr: stderrTail }); });
    child.on('close', (code) => {
      childClosed = true;
      childCode = code;
      if (code !== 0) {
        // openssl failed: the output file is garbage — destroy and fail.
        out.destroy();
        done({ ok: false, error: new Error(`openssl exit ${code}`), stderr: stderrTail });
      }
      // code === 0: wait for `out.finish` (below) — bytes may still be
      // flushing from the child's stdout pipe into the file. Success is
      // only reported once every encrypted byte is ON DISK.
    });

    const inp = fs.createReadStream(fromPath);
    inp.on('error', (e) => { child.kill(); out.destroy(); done({ ok: false, error: e, stderr: stderrTail }); });
    out.on('error', (e) => { child.kill(); done({ ok: false, error: e, stderr: stderrTail }); });
    out.once('finish', () => {
      if (childClosed) {
        if (childCode === 0) done({ ok: true, stderr: stderrTail });
        // code !== 0 was already failed in the close handler.
      } else {
        // Bytes are on disk but the child's close event hasn't fired yet
        // (it is imminent: stdout ended means openssl exited). Await it
        // before declaring success — exit code IS the verdict.
        child.once('close', (code) => {
          if (code === 0) done({ ok: true, stderr: stderrTail });
          // Non-zero was failed by the primary close handler already.
        });
      }
    });
    out.once('close', () => {
      // Stream closed WITHOUT finish (destroy after failure or premature
      // end). If nothing settled yet and openssl was fine, fail loud:
      // partial files must never look like valid backups.
      if (!settled && childClosed && childCode === 0) {
        done({ ok: false, error: new Error('output stream closed before all bytes were written'), stderr: stderrTail });
      }
    });

    inp.pipe(child.stdin);
    child.stdout?.pipe(out);
  }).then((result) => {
    if (!result.ok) { try { fs.unlinkSync(toPath); } catch { /* already gone */ } }
    return result;
  });
}

/** tar the uploads dir → destPath (paths inside the archive stay relative). */
function tarUploads({ destPath, uploadsPath }) {
  return new Promise((resolve) => {
    execFile(
      'tar',
      ['-cf', destPath, '-C', path.dirname(uploadsPath), path.basename(uploadsPath)],
      { windowsHide: true },
      (err, _out, stderr) => resolve({ ok: !err, error: err, stderr: stderr ? String(stderr) : '' }),
    );
  });
}

/** Avoid same-second collisions: ikhwezi-<ts>-1.db, -2.db, … */
function uniquePath(dir, base) {
  let p = path.join(dir, base);
  let n = 1;
  while (fs.existsSync(p)) {
    p = path.join(dir, base.replace(/(\.[^.]*)$/, `-${n}$1`));
    n += 1;
  }
  return p;
}

/**
 * buildBackupJob({ sequelize, logger, backupDir, mediaRoot, resolveOpenSSL,
 *                  opensslCommand }) — mirrors jobs/guestCleanup.js.
 *
 *  sequelize      live app connection (dialect dispatch; SQLite source path)
 *  backupDir      BACKUP_DIR override (default backend/storage/backups)
 *  mediaRoot      dir whose uploads/ gets tarred; defaults to the PARENT of
 *                 backupDir so overriding BACKUP_DIR to /x/storage/backups
 *                 keeps media discovery (/x/storage/uploads) working. When
 *                 that derived dir has no uploads/, the app default
 *                 backend/storage/uploads is the fallback candidate.
 *  resolveOpenSSL / opensslCommand — test injection points.
 */
function buildBackupJob({
  sequelize,
  logger = console,
  backupDir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'storage', 'backups'),
  mediaRoot = path.dirname(backupDir),
  resolveOpenSSL = createOpenSSLResolver(),
  opensslCommand = 'openssl',
} = {}) {
  const log = (...a) => { const fn = logger.info || logger.log; if (fn) fn.apply(logger, a); };
  const warn = (...a) => { const fn = logger.warn || logger.error || logger.log; if (fn) fn.apply(logger, a); };

  // The default media root = backupDir's PARENT (storage/backups → storage),
  // so an explicit BACKUP_DIR override keeps sibling-uploads discovery. A
  // mediaRoot that differs from this default is an EXPLICIT contract (see
  // runBackup's media candidate logic): honor it and skip honestly when its
  // uploads/ is absent — never silently archive the app default tree.
  const defaultMediaRoot = path.dirname(backupDir);

  const cfg = () => ({
    backupDir,
    keep: Math.max(1, (v => Number.isFinite(v) ? v : 7)(parseInt(process.env.BACKUP_KEEP, 10))),
    includeMedia: (process.env.BACKUP_INCLUDE_MEDIA ?? 'true') !== 'false',
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || '',
    intervalHours: (v => Math.max(1, Number.isFinite(v) ? v : 24))(parseInt(process.env.BACKUP_INTERVAL_HOURS, 10)),
  });

  /** wanting (key set) + able (openssl present) → attempt. Else honest paths. */
  const encryptionDecision = async () => {
    const { encryptionKey } = cfg();
    if (!encryptionKey) return { wanted: false, encrypt: false, reason: 'no-key' };
    if (!(await Promise.resolve(resolveOpenSSL()))) return { wanted: true, encrypt: false, reason: 'no-openssl' };
    return { wanted: true, encrypt: true, reason: 'ok' };
  };

  /**
   * Turn a written-and-verified plaintext artifact into its final, honestly
   * named form:
   *   attempt encryption → success: <name>.enc
   *   wanted encryption but UNAVAILABLE (no openssl / openssl failed):
   *       <name>.UNENCRYPTED + loud warn   ← the honesty path
   *   no key configured: keep <name> plain + info log
   */
  const finalizeArtifact = async ({ kind, plainPath, plainName, wanted, encrypt, key, failureNotes }) => {
    if (encrypt) {
      const encPath = `${plainPath}.enc`;
      const res = await opensslEncryptTo({ opensslCommand, fromPath: plainPath, toPath: encPath, key });
      if (res.ok) {
        fs.unlinkSync(plainPath);
        return { file: `${plainName}.enc`, encrypted: true };
      }
      failureNotes.push(`encryption failed (${res.error?.message}${res.stderr ? `: ${res.stderr}` : ''})`);
    }
    if (wanted) {
      // Wanted encryption, could not get it (openssl missing, or failed).
      const renamed = `${plainPath}.UNENCRYPTED`;
      fs.renameSync(plainPath, renamed);
      warn(`backup: ${kind} backup NOT encrypted — wrote PLAINTEXT as ${path.basename(renamed)}`);
      if (!encrypt) warn('backup:   (openssl not found on PATH — set BACKUP_ENCRYPTION_KEY and ensure openssl exists, or run inside the compose backend container; see docs/ops/backup-restore.md)');
      return { file: `${plainName}.UNENCRYPTED`, encrypted: false, unencrypted: true };
    }
    log(`backup: ${kind} backup written PLAINTEXT (${plainName}) — set BACKUP_ENCRYPTION_KEY to encrypt; see docs/ops/backup-restore.md`);
    return { file: plainName, encrypted: false, plaintext: true };
  };

  /** List family files, newest-first by mtime. Missing dir → []. */
  const listBackups = (dir, rx) => {
    try {
      return fs.readdirSync(dir)
        .map((name) => {
          const p = path.join(dir, name);
          const st = fs.statSync(p);
          return { name, path: p, mtime: st.mtimeMs, size: st.size };
        })
        .filter((f) => rx.test(f.name))
        .sort((a, b) => b.mtime - a.mtime);
    } catch { return []; }
  };

  /**
   * Retention — the safety core:
   *   • keep >= 1 always (Math.max in cfg) — never delete down to zero.
   *   • deletes ONLY when this run produced a verified newest file
   *     (failed run → verifiedNewestPath null → prune nothing).
   *   • that verified file is excluded from deletion candidates.
   */
  const applyRetention = ({ dir, keep, familyRx, verifiedNewestPath }) => {
    const files = listBackups(dir, familyRx);
    const noop = (extra) => ({ deleted: 0, kept: files.length, totalNow: files.length, ...extra });
    if (files.length <= keep) return noop();
    if (!verifiedNewestPath) return noop({ skipped: 'no-verified-newest-this-run' });
    if (!files.some((f) => f.path === verifiedNewestPath)) {
      return noop({ skipped: 'verified-newest-missing' });
    }
    const excess = files.slice(keep);
    let deleted = 0;
    for (const f of excess) {
      if (f.path === verifiedNewestPath) continue;
      try { fs.unlinkSync(f.path); deleted += 1; } catch (e) { warn(`backup: retention could not delete ${f.name}: ${e.message}`); }
    }
    return { deleted, kept: files.length - deleted, totalNow: files.length - deleted };
  };

  /**
   * ONE backup run. Config/run-level problems are reported inside the
   * result object; only programmer errors (missing sequelize) throw.
   */
  async function runBackup({ now = new Date() } = {}) {
    const c = cfg();
    const result = {
      dialect: sequelize && sequelize.getDialect ? sequelize.getDialect() : 'unknown',
      ts: fileTimestamp(now), db: null, media: null, retention: {},
    };
    fs.mkdirSync(c.backupDir, { recursive: true });
    const decision = await encryptionDecision();

    // ---- database ---------------------------------------------------------
    if (result.dialect === 'sqlite') {
      const sourcePath = sequelize.options && sequelize.options.storage;
      if (!sourcePath || sourcePath === ':memory:') {
        log('backup: SQLite database is transient (:memory:) — nothing on disk to back up, skipping DB backup');
        result.db = { skipped: 'in-memory' };
      } else if (!fs.existsSync(sourcePath)) {
        log(`backup: SQLite file ${sourcePath} not present yet — skipping DB backup (nothing to back up)`);
        result.db = { skipped: 'db-file-missing' };
      } else {
        const plainPath = uniquePath(c.backupDir, `ikhwezi-${result.ts}.db`);
        const plainName = path.basename(plainPath);
        const notes = [];
        try {
          await sqliteBackup({ sourcePath, destPath: plainPath });
          const verify = await verifySQLiteBackup({ backupPath: plainPath });
          const final = await finalizeArtifact({
            kind: 'DB', plainPath, plainName,
            wanted: decision.wanted, encrypt: decision.encrypt, key: c.encryptionKey, failureNotes: notes,
          });
          result.db = {
            file: final.file, encrypted: !!final.encrypted,
            unencrypted: !!final.unencrypted, plaintext: !!final.plaintext,
            verified: true, integrity: verify.integrity, tables: verify.tables, notes,
          };
          log(`backup: DB backup ${final.file} verified (integrity ok, ${verify.tables} tables${final.encrypted ? ', encrypted' : ''})`);
        } catch (e) {
          warn(`backup: DB backup FAILED: ${e.message}`);
          try { if (fs.existsSync(plainPath)) fs.unlinkSync(plainPath); } catch { /* best effort */ }
          result.db = { file: null, failed: true, error: e.message, notes };
        }
        result.retention.db = applyRetention({
          dir: c.backupDir, keep: c.keep, familyRx: DB_FAMILY_RX,
          verifiedNewestPath: result.db && result.db.file ? path.join(c.backupDir, result.db.file) : null,
        });
      }
    } else if (result.dialect === 'postgres') {
      // HONESTY PATH: no file dump of a live PostgreSQL database.
      log("backup: dialect is postgres — SKIPPING file DB dump: database snapshots are the managed provider's job (compose: pg_dump per docs/ops/backup-restore.md, Render Postgres: provider-managed backups). Media backup (if enabled) still runs.");
      result.db = { skipped: 'postgres-managed-snapshots' };
      result.retention.db = { deleted: 0, kept: 0, totalNow: 0, skipped: 'postgres' };
    } else {
      warn(`backup: unknown dialect "${result.dialect}" — no DB backup attempted`);
      result.db = { skipped: `unknown-dialect-${result.dialect}` };
      result.retention.db = { deleted: 0, kept: 0, totalNow: 0, skipped: 'unknown-dialect' };
    }

    // ---- media ------------------------------------------------------------
    if (c.includeMedia) {
      // Candidate uploads dirs. An EXPLICIT mediaRoot is a CONTRACT from
      // the caller/operator (tests, BACKUP_DIR overrides): when it has no
      // uploads/, skip honestly — never silently fall back to archiving
      // the app default tree (that could archive a developer's real
      // uploads when the operator pointed elsewhere). The app-default
      // candidate exists ONLY when mediaRoot was left at its default
      // value (derived from BACKUP_DIR hierarchy).
      const explicitRoot = mediaRoot !== defaultMediaRoot;
      const candidates = [
        path.join(mediaRoot, 'uploads'),
        ...(explicitRoot ? [] : [path.join(__dirname, '..', 'storage', 'uploads')]),
      ];
      const uploadsPath = candidates.find((p) => {
        try { return fs.statSync(p).isDirectory(); } catch { return false; }
      });
      if (!uploadsPath) {
        log(`backup: no uploads dir found (tried ${candidates.join(', ')}) — media backup skipped`);
        result.media = { skipped: 'uploads-dir-missing' };
        result.retention.media = { deleted: 0, kept: 0, totalNow: 0 };
      } else {
        const plainTar = uniquePath(c.backupDir, `uploads-${result.ts}.tar`);
        const plainTarName = path.basename(plainTar);
        const notes = [];
        const tar = await tarUploads({ destPath: plainTar, uploadsPath });
        if (tar.ok && fs.existsSync(plainTar)) {
          const final = await finalizeArtifact({
            kind: 'media', plainPath: plainTar, plainName: plainTarName,
            wanted: decision.wanted, encrypt: decision.encrypt, key: c.encryptionKey, failureNotes: notes,
          });
          result.media = {
            file: final.file, encrypted: !!final.encrypted,
            unencrypted: !!final.unencrypted, plaintext: !!final.plaintext, notes,
          };
          log(`backup: media backup ${final.file} written (${(fs.statSync(path.join(c.backupDir, final.file)).size / 1024).toFixed(1)} KiB)`);
          result.retention.media = applyRetention({
            dir: c.backupDir, keep: c.keep, familyRx: MEDIA_FAMILY_RX,
            verifiedNewestPath: path.join(c.backupDir, final.file),
          });
        } else {
          warn(`backup: media tar FAILED: ${tar.error?.message || tar.stderr || 'tar produced nothing'}`);
          try { if (fs.existsSync(plainTar)) fs.unlinkSync(plainTar); } catch { /* best effort */ }
          result.media = { file: null, failed: true, notes };
          result.retention.media = applyRetention({ dir: c.backupDir, keep: c.keep, familyRx: MEDIA_FAMILY_RX, verifiedNewestPath: null });
        }
      }
    } else {
      result.media = { skipped: 'disabled' };
      result.retention.media = { deleted: 0, kept: 0, totalNow: 0 };
    }

    return result;
  }

  /** Run now, then every BACKUP_INTERVAL_HOURS. Unref'd — never blocks shutdown. */
  function start({ intervalMs = cfg().intervalHours * HOUR_MS } = {}) {
    runBackup().catch((e) => logger.error?.('backup job failed on boot:', e.message));
    const timer = setInterval(() => {
      runBackup().catch((e) => logger.error?.('backup job failed:', e.message));
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  return { runBackup, start };
}

module.exports = {
  buildBackupJob, fileTimestamp, uniquePath,
  DB_FAMILY_RX, MEDIA_FAMILY_RX,
  createOpenSSLResolver, sqliteBackup, verifySQLiteBackup, opensslEncryptTo, tarUploads,
};
