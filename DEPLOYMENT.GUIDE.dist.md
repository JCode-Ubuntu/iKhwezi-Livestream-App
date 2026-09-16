# iKHWEZI Deployment Guide

> **This guide was retired on 2026-09-16.**
> The instructions below predate the Phase 1–6 architecture migration and
> had drifted dangerously out of date — among other things, they documented
> the OLD SQLite database (production is PostgreSQL), a manual `cp` backup
> procedure that bypasses the automated encrypted backup job, and a
> `export $(cat .env | xargs)` idiom that silently corrupts quoted env
> values. Following them against the current stack would mislead an
> operator at exactly the moments that matter (restore, incident response).
>
> The current, authoritative sources are listed below. Nothing was deleted:
> the previous version of this file remains in git history
> (`git log -- DEPLOYMENT.GUIDE.dist.md`).

## Current authoritative documentation

| Topic | Source |
|---|---|
| Local development & stack overview | [`README.md`](README.md) |
| Every environment variable, documented | [`.env.dist`](.env.dist) |
| Production compose (Postgres, Redis, LiveKit, coturn, backups) | [`docker-compose.dist.yml`](docker-compose.dist.yml) |
| Dev compose (host ports for Android tests) | [`docker-compose.yml`](docker-compose.yml) |
| Backup, encryption, restore, off-site sync, drills | [`docs/ops/backup-restore.md`](docs/ops/backup-restore.md) |
| V1→V2 launch runbook (owner-GO-gated) | [`docs/comms/v2-launch-backup-wipe-checklist.md`](docs/comms/v2-launch-backup-wipe-checklist.md) |
| CI quality gate + SSH deploy | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) |
| Mobile (Android/iOS) store deployment | [`MOBILE_STORE_DEPLOY.md`](MOBILE_STORE_DEPLOY.md) |

## Deployment model (summary)

1. **Push to `master`** → GitHub Actions runs the quality gate (backend
   tests, frontend tests, frontend build) → SSH-deploys to the Lightsail
   host, rebuilds and recreates the compose services. One deploy at a
   time; queued stale runs collapse to the latest.
2. **Secrets live in the server's `.env`** next to `docker-compose.yml`
   (never in the repo): `JWT_SECRET`, `ADMIN_KEY`, `RTMP_WEBHOOK_SECRET`
   (required — compose refuses to start without it), `POSTGRES_PASSWORD`,
   optional `BACKUP_ENCRYPTION_KEY`, `S3_*`, `LIVEKIT_*`, `SENTRY_DSN`.
3. **Database**: PostgreSQL in production (`DATABASE_URL`), versioned
   migrations run automatically on boot. SQLite remains the local-dev
   default when `DATABASE_URL` is unset.
4. **Backups** are automatic (`backend/jobs/backupJob.js`): encrypted when
   `BACKUP_ENCRYPTION_KEY` is set, kept on a dedicated `backup-storage`
   volume, and mirrored off-site to the S3 bucket when `S3_*` is set.
   Restore procedures: `docs/ops/backup-restore.md`.
