# Backup & Restore — Operations Guide

> **Audience:** the operator running iKHWEZI in production (docker compose)
> and any engineer on call when a backup must actually be restored.
> The rule this guide serves: **a backup that has not been restored is a
> hope, not a plan.**

---

## 1. What the system does automatically

`backend/jobs/backupJob.js` starts with the server on **every boot**, then
runs every `BACKUP_INTERVAL_HOURS` (default 24h).

| Artifact | SQLite (dev / single-node) | PostgreSQL (prod compose) |
|---|---|---|
| `ikhwezi-<UTC ts>.db` | **Yes** — `VACUUM INTO` snapshot + verified (see below) | **No — honest skip.** Table drift during a live dump makes a file dump untrustworthy; use the managed path (§5) |
| `uploads-<UTC ts>.tar` | **Yes** — the uploads/ tree | **Yes** |

Every DB snapshot is **verified before it counts**: the copy is opened
read-only and must pass `PRAGMA integrity_check` with a readable
`sqlite_master`. A failed verification marks the whole run failed.

### Encryption

- `BACKUP_ENCRYPTION_KEY` set **and** an `openssl` binary present → each
  artifact is piped through `openssl enc -aes-256-cbc -pbkdf2 -salt`
  (key passed via environment, never argv — it never appears in `ps`).
- Key set but **no openssl** on the host (e.g. a Windows dev box) → the
  file is written **PLAINTEXT with a `.UNENCRYPTED` suffix** and a loud
  warning. An honestly-labeled plain file beats a mislabeled "encrypted"
  one. The compose backend image (node:20-alpine) ships openssl —
  production always encrypts when the key is set.
- Key unset → plain file + info log (dev default).

### Retention (never-delete-to-zero)

- Keeps the newest `BACKUP_KEEP` files per family (DB / media), default 7.
- **`keep` is lower-bound clamped to 1** — a misconfigured `0` cannot wipe
  the backup history.
- Pruning runs **only after this run produced a verified newest file**, and
  that file is never a deletion candidate. A failed run prunes nothing.

### Audit trail

- Log lines start with `backup:` — grep the backend logs for them.
- Manual trigger, same code path: `cd backend && npm run backup`.

---

## 2. Where backups live

By default: `backend/storage/backups/` on disk.

In compose (docker-compose.yml / docker-compose.dist.yml) the backend writes
to `/app/storage/backups`, mounted from the **dedicated `backup-storage`**
volume (prod name: `backup-storage-prod`):

- A backend *data* volume failure leaves backups intact.
- Pruning backups can never delete live DB/uploads.

> [!IMPORTANT]
> A docker volume is **not off-site storage**. Schedule §6 to move encrypted
> artifacts off the host — the backup layer's retention does NOT remove an
> off-site copy.

---

## 3. Restoring SQLite (file backend)

The wipe runbook (docs/comms/v2-launch-backup-wipe-checklist.md) and this
guide use the same openssl parameters, so automated and manual backups are
interchangeable.

```bash
# 0. Stop the app first — restore-while-running is undefined.
docker compose stop backend

# 1. Pick the backup and decrypt it (skip for a .UNENCRYPTED/plain file; the
#    .enc ones need the SAME key that encrypted them).
BACKUP=ikhwezi-20260906-152301Z.db
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in  "/volumes/ikhwezi_backup/_data/$BACKUP.enc" \
  -out "/tmp/restore.db" \
  -pass env:BACKUP_ENCRYPTION_KEY

# 2. Verify the decrypted file BEFORE overwriting anything:
sqlite3 /tmp/restore.db 'PRAGMA integrity_check;'
#  → must print: ok

# 3. VACUUM INTO ensures a single self-contained file — no WAL sidecars
#    need to exist next to it, unlike the live DB. Move it in place:
mkdir -p backups
cp /tmp/restore.db storage/ikhwezi.db      # inside the backend data volume

# 4. Boot and verify against the running app:
docker compose up -d backend
curl -fsS http://localhost:3001/api/health   # status ok
# Then log in / query a couple of tables via the API you trust.
```

**Post-restore verification of retention + content:** run `npm run backup`
once — the job will verify, place a new newest file, and prune older ones;
the restored file itself is never a candidate until it ages out naturally.

---

## 4. Restoring media (uploads)

```bash
# Decrypt if needed (see §3), then unpack NEXT TO the target (paths inside
# the archive are relative — the tar was created with -C storage):
tar -xvf uploads-20260906-152301Z.tar -C storage/
# Verify a few known files exist under storage/uploads/.

# The app serves /storage/** statically — restart the backend and fetch one:
curl -fsSI "http://localhost:3001/storage/uploads/<some-file>"
```

---

## 5. PostgreSQL (compose production) — restore from managed snapshots

The backup job honestly skips DB dumps for Postgres (see the table in §1).
The real mechanisms:

- **Managed providers** (Render Postgres, RDS, etc.): restore via the
  provider's point-in-time snapshot UI/CLI. That is the only trustworthy
  path for a live-referenced database.
- **Self-hosted compose Postgres**: schedule `pg_dump`/`pg_restore` from a
  **separate** container or cron host, e.g.:

```bash
docker exec ikhwezi-postgres-prod pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "ikhwezi-pg-$(date -u +%Y%m%d-%H%M%S).sql.gz"
# ... and validate quarterly by restoring into a scratch database.
```

Media (uploads tar) still applies — §4 unchanged.

---

## 6. Drills — prove it works

- **Backup without restore is theater**: quarterly, pick the newest
  encrypted artifact, follow §3 end-to-end on a scratch machine, and record
  the result in this doc's changelog. If the drill fails, the backup is
  broken — fix it before touching anything else.
- **Key custody**: losing `BACKUP_ENCRYPTION_KEY` = losing every `.enc`
  artifact. Store it in a password manager / secrets store — never in the
  repo, never in plain env files committed anywhere.
- **Off-site copy (schedule it)**: `backup-storage` is a docker volume, not
  off-site storage. Sync the encrypted contents out of the host on an
  interval, e.g. a nightly cron on the host:

```bash
0 3 * * *  rsync -a --delete /var/lib/docker/volumes/ikhwezi_backup-storage-prod/_data/ \
  offsite-user@rsync.example.net:ikhwezi-backups/
```

---

## 7. Environment variables (quick reference)

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `backend/storage/backups` | Output directory (compose: `/app/storage/backups`) |
| `BACKUP_ENCRYPTION_KEY` | *(empty)* | Set → encrypt artifacts; empty → plain, honestly named |
| `BACKUP_KEEP` | `7` | Retention per family; **min-clamped to 1** |
| `BACKUP_INCLUDE_MEDIA` | `true` | Tar `uploads/` alongside the DB backup |
| `BACKUP_INTERVAL_HOURS` | `24` | Cadence after the boot-time run |

Related docs:

- `docs/comms/v2-launch-backup-wipe-checklist.md` — the V1→V2 wipe runbook
  (backup and comms phases reference this guide).
- `backend/jobs/backupJob.js` — source of truth for behavior documented here.
- `.env.dist` — the operator-facing variable documentation.
