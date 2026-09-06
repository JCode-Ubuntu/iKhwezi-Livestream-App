'use strict';

/**
 * Manual backup trigger — same logic the scheduled job runs
 * (backend/jobs/backupJob.js), on demand:
 *
 *   cd backend && npm run backup            → one backup run, now
 *
 * Useful before risky operations (wipes, migrations, server moves) and
 * as the "make a fresh one right now" button between intervals. Reads
 * the same env knobs as the scheduled job (BACKUP_DIR, BACKUP_KEEP,
 * BACKUP_ENCRYPTION_KEY, BACKUP_INCLUDE_MEDIA).
 */

const { createSequelize } = require('../config/database');
const { migrate } = require('../db/migrate');
const { buildBackupJob } = require('../jobs/backupJob');

async function main() {
  const sequelize = createSequelize({});
  try {
    await sequelize.authenticate();
    // The scheduled boot path runs migrations before starting jobs; a manual
    // backup should not run against a schema the boot path would reject.
    const { pending } = await require('../db/migrate').status({ sequelize });
    if (pending.length) {
      console.log(`migrations: ${pending.length} pending — running up() before backup`);
      await migrate({ sequelize, logger: false });
    }

    const job = buildBackupJob({ sequelize, logger: console });
    const result = await job.runBackup();

    console.log('\nBackup run result:');
    console.log(`  dialect : ${result.dialect}`);
    if (result.db && result.db.skipped) {
      console.log(`  db      : SKIPPED (${result.db.skipped})`);
    } else if (result.db && result.db.failed) {
      console.log(`  db      : FAILED — ${result.db.error}`);
    } else if (result.db) {
      console.log(`  db      : ${result.db.file} (verified: integrity ${result.db.integrity}, ${result.db.tables} tables${result.db.encrypted ? ', encrypted' : ''})`);
    }
    if (result.media && result.media.skipped) {
      console.log(`  media   : SKIPPED (${result.media.skipped})`);
    } else if (result.media && result.media.failed) {
      console.log(`  media   : FAILED`);
    } else if (result.media) {
      console.log(`  media   : ${result.media.file}${result.media.encrypted ? ' (encrypted)' : ''}`);
    }
    for (const [family, r] of Object.entries(result.retention)) {
      console.log(`  retention[${family}]: kept ${r.kept}, deleted ${r.deleted}, now ${r.totalNow}${r.skipped ? `, skipped (${r.skipped})` : ''}`);
    }
    if (result.db && result.db.failed) process.exitCode = 1;
    if (result.media && result.media.failed) process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
