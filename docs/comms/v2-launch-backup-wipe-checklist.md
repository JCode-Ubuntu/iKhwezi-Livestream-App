# V2 Launch — Backup, Wipe & Relaunch Runbook (OPERATOR CHECKLIST)

> ## ⛔ NOTHING IN THIS RUNBOOK RUNS WITHOUT THE OWNER'S EXPLICIT GO
>
> This is a **draft operational plan**. No step in Phases 4–6 (wipe,
> verify, rollback) may be executed until the owner has explicitly said
> **"GO"** in writing, for this launch, on this date. Phases 1–3 (backup,
> export, communicate) are preparation and do not touch live data, but
> still notify the owner before running. **A launch is a person's decision,
> never a pipeline's.**
>
> Audience: the operator on shift (the person at the keyboard). Written to
> be followed mechanically, checkbox by checkbox. Do not improvise around
> a failing checkbox — stop, note it, escalate to the owner.

## Ground truth (repo facts this runbook is built on)

- Production runs via `docker-compose.yml` on AWS Lightsail (`backend`,
  `frontend`, `nginx-rtmp`, `livekit` services).
- Database: **SQLite** file at `backend/storage/ikhwezi.db` (mounted via
  the `backend-storage` Docker volume into the backend container at
  `/app/storage`). User uploads live in `backend/storage/uploads/` (shared
  image dimension in compose as `backend-storage:/app/storage`), and
  stream archives/HLS segments under `backend/storage/hls/` with the
  `hls-storage` volume in the `nginx-rtmp` container.
- Schema: backend model `sync()` creates missing tables on boot; boot-time
  SQLite fix-ups (`deduplicateUsernames`, `ensureGuestColumn`,
  `ensureLiveStatusColumns`, `enforceInteractionUniqueness`) run when the
  dialect is SQLite. This phase replaced a separate sync step with
  migrations — write wipe verification generically: **a fresh DB file must
  re-create all tables on first boot**.
- A **guest account cleanup job** exists (`backend/jobs/guestCleanup.js`),
  runs on boot then daily, deleting stale `@guest.local` guest users after
  a 14-day idle window. Post-wipe, its first run on an empty DB must exit
  cleanly.
- References may drift as the code moves: before every run, re-check
  volume mounts in `docker-compose.yml` and paths in `backend/index.js`
  (multer destinations, `sqlitePath`) — do not trust this doc's paths
  blindly over the live compose file.

---

## Phase 1 — Backup & verify (offline prep, no user impact)

**Goal: an encrypted, restorable copy of ALL V1 data exists and has been
proven restorable, before anything else happens.**

- [ ] 1.1 Notify owner: "starting Phase 1 backup" — wait for ack.
- [ ] 1.2 Confirm disk headroom on Lightsail instance AND on archive
  destination: backup needs roughly the size of the DB file + media
  dirs × 2 (copy + compress). Check with `df -h`.
- [ ] 1.3 Identify live paths (from `docker volume inspect
  <backend-storage-vol>` and compose file — do not assume `backend/storage`
  literally):
  - DB file: `[PATH]/ikhwezi.db` (+ any `-wal`/`-shm` siblings)
  - Uploads: `[PATH]/uploads/`
  - HLS/live archives: `[HLS_PATH]` (nginx-rtmp volume)
- [ ] 1.4 **Consistent snapshot:** stop backend writes cleanly before
  copying the SQLite file — copy is only guaranteed safe after
  `docker compose stop backend` (SQLite files copied live can be mid-write
  and restorable-but-corrupt in subtle ways).
- [ ] 1.5 Cold copy:
  - [ ] DB: `cp -a ikhwezi.db ikhwezi.db.pre-v2wipe.bak` (+ wal/shm)
  - [ ] Media: `tar -czf uploads-$(date +%F).tar.gz uploads/`
  - [ ] HLS: `tar -czf hls-$(date +%F).tar.gz <hls-dir>/`
- [ ] 1.6 Restart backend: `docker compose up -d backend`; verify it comes
  healthy and serves requests before continuing.
- [ ] 1.7 Encrypt archive: `gpg --symmetric --cipher-algo AES256` (or
  `openssl enc -aes-256-cbc -pbkdf2`) each archive → `.gpg`/`.enc` files.
- [ ] 1.8 **Verification: test-restore.** On the server (or any scratch
  machine):
  - [ ] Copy the encrypted archive off-site first (see 1.9), restore on
    **scratch path** — never over live paths.
  - [ ] Decrypt to scratch: scratch dir clearly named
    `~/wipe-rehearsal-$(date +%F)/`.
  - [ ] Copy `ikhwezi.db` from the archive into the scratch copy of the
    backend container / a temporary sqlite3 CLI: run one alignment query
    like `SELECT COUNT(*) FROM Users;` and one content query. Boot the
    backend once against the restored file (`SQLITE_PATH` env override to
    the scratch copy — it reads env `SQLITE_PATH`) and hit one API
    endpoint; then stop it.
  - [ ] Confirm row counts match pre-backup counts recorded in 1.5.
- [ ] 1.9 **Archive location ticket — fill every field in the launch
  ticket:**
  - Archive host/destination: [ __________ ]
  - Archive path(s) + filenames: [ __________ ]
  - SHA-256 checksums of each archive: [ __________ ]
  - Encryption method + passphrase custody (who holds it, where): [
    __________ ]
  - Copy completion date: [ __________ ]
  - Second (off-site) copy confirmed:
    - [ ] Yes, location: [ __________ ]
    - [ ] No — ABORT, do not proceed to Phase 4 without off-site copy.
- [ ] 1.10 Checksum + listing: `sha256sum` all archives; store listing in
  the ticket. Two independent hashes (compute then re-verify after
  transfer) for the DB archive.

**Phase 1 exit criteria:** encrypted archives exist, checksums recorded,
test-restore passed once, ticket fields complete, off-site copy confirmed.
**No wipe may run until all boxes above are ticked.**

---

## Phase 2 — User data export for comms (offline prep)

**Goal: reach V1 users with the retirement notice, without creating a new
PII sprawl.**

- [ ] 2.1 Extract minimal contact fields for outreach: user ID, email,
  phone (whichever exist), created date, purchase-flag. **POPIA note:**
  this export is personal information — store it **encrypted, access
  limited to the operator sending comms, and delete it no later than 30
  days after the send** (send date + 30 days = hard deletion deadline;
  record that date in the ticket now).
- [ ] 2.2 Export method: query the (backed-up) DB — `SELECT id, email,
  phone FROM Users WHERE isGuest = 0` against the **backup copy**, not
  live, to avoid load on production (guests get no retirement email).
- [ ] 2.3 Save as `v1-comms-export-$(date +%F).csv`, encrypt immediately
  (`gpg --symmetric`), record SHA-256 in the ticket.
- [ ] 2.4 Record planned deletion date (send date + 30 days) in the
  ticket: [ __________ ].
- [ ] 2.5 Push reachability: pull FCM token count (if token store exists)
  for the T-72h push reminder; if reach is poor, plan banner+email to
  carry the reminder (comms doc variant (c) notes this).
- [ ] 2.6 **Owner decision required before sending anything** — see "Open
  Decisions" in `v1-retirement-announcement.md` (purchase honouring,
  launch date). Do not schedule comms until the owner signs off copy +
  decisions.

---

## Phase 3 — Communication schedule (uses `v1-retirement-announcement.md`)

**Goal: every user who can be reached, has been reached, before their data
is deleted.**

| When | Channel | Checklist |
|---|---|---|
| T-14 days | In-app banner (variant a) + email (variant b) | [ ] banner live and dismissible-but-persistent; [ ] email sent to full Phase 2 export; [ ] spot-check 3 inboxes (incl. one purchase-flagged) |
| T-72 hours | Push reminder (variant c); email re-send (shortened) | [ ] push sent to token list; [ ] reminder email out; [ ] banner still live & updated with "3 days" phrasing if template allows |
| T-0 (launch) | Outage/switch notice (variant b skeleton) on V1 → V2 cutover | [ ] status/notice posted on [LINK] channel of record; [ ] Play Store listing (variant d) updated with V2 What's-new; [ ] final push if scheduled |

- [ ] 3.1 All three sends recorded in the ticket with date, recipient
  count, bounce/failure count.
- [ ] 3.2 Outage notice copy on T-0: reuse variant (b) subject/body,
  stating V1 is now closed and new-account signup is live at [LINK].
- [ ] 3.3 After each send: keep the 30-day PII deletion deadline (Phase 2)
  in view — set a calendar reminder now: [ __________ ].

**Gate: Phase 4 requires the owner's explicit GO — after confirming Phases
1–3 all complete. The GO must reference the ticket ID.**

---

## Phase 4 — Wipe procedure (DESTRUCTIVE — owner GO mandatory)

> **⛔ Stop. Before touching anything below: locate the owner's written
> GO with the ticket ID and date, and the completed Phase 1–3 exit
> criteria above. If any Phase 1–3 checkbox is empty, ABORT here.**

**Goal: remove all V1 data per the roadmap's "complete wipe" directive,
ordered and reversible-by-backup only.**

- [ ] 4.1 Re-verify Phase 1 archive integrity: `sha256sum` each archive
  against ticket checksums — **fresh re-hash now, not the memory of
  hashes from 1.10** — any mismatch: ABORT.
- [ ] 4.2 Notify owner: "beginning wipe at $(date)", wait for ack if
  online.
- [ ] 4.3 **Stop the stack:**
  - [ ] `docker compose stop backend nginx-rtmp frontend` (stop app
    containers; keep the docker daemon/volumes intact)
  - [ ] Verify: `docker compose ps` shows app services stopped/exited.
- [ ] 4.4 **Datestamped cold backup (final safety net):**
  `mv`/`cp -a` DB file and the media/hls dirs to
  `<path>/v1-final-backup-$(date +%F)/` OUTSIDE the live volume paths —
  this is the copy rollback restores from, so it must be complete and
  checksummed:
- [ ] 4.5 Checksum the final backup; add to ticket: [ __________ ].
- [ ] 4.6 **Remove V1 data:** delete per "complete wipe": remove the
  SQLite DB file (+ `-wal`/`-shm`), remove `uploads/` and other
  `storage/` media dirs, remove the `hls-storage` contents (or the whole
  volume if the compose file still names it: `docker volume rm
  hls-storage` — **re-read compose first**, see Ground truth). Do the
  removal with the containers still stopped. List each path actually
  removed in the ticket: [ __________ ].
- [ ] 4.7 **Bring the stack up fresh:** `docker compose up -d backend
  nginx-rtmp frontend` then livekit per the deploy scripts. **Migrations
  run fresh on first boot** (sync creates tables; boot fix-ups run on
  SQLite) — do NOT manually pre-create tables; let the backend do it.
- [ ] 4.8 Watch first boot: `docker compose logs -f backend` until you see
  the sync/migration lines pass and the listen line — capture to ticket.
- [ ] 4.9 Verification checklist (all must pass before Phase 5):
  - [ ] `/health`-style endpoint (or a known GET route) returns 200 from
    the frontend proxy
  - [ ] DB file re-created, `SELECT COUNT(*) FROM Users` → 0
  - [ ] `docker compose ps` — all intended services up/healthy

**Abort conditions mid-phase: any error in 4.3–4.8 → stop, do NOT retry
blindly, restore is Phase 6 path.**

---

## Phase 5 — Post-wipe verification

**Goal: prove the fresh stack is healthy and empty-and-clean, mechanically.**

- [ ] 5.1 Fresh boot log checks: scan backend log for clean sync line
  ("Database synchronized (sqlite)"), absence of errors/warnings that were
  not present pre-wipe (compare against a saved pre-wipe boot log).
- [ ] 5.2 **Guest-cleanup job:** confirm the guest cleanup job fires clean
  on the empty DB (log line "guest cleanup: purged 0 stale guest
  account(s)" or equivalent success), and no exception in log —
  `backend/jobs/guestCleanup.js` runs on boot, empty DB must be a no-op
  success.
- [ ] 5.3 **First e2e signup:** register a test account through the
  frontend (real flow, e.g. `vusigeorgejiyane@gmail.com` style test
  identity or scratch email), confirm login, profile save, and that the
  account shows as expected (non-guest). Log user ID in ticket.
- [ ] 5.4 Confirm old V1 accounts cannot log in (pick one known V1
  credential, expect clean auth failure, not a 500).
- [ ] 5.5 **Lint config check:** verify livekit token-minting config
  (LIVEKIT_* env) and secrets present/absent as intended in the relaunched
  stack — `docker compose exec backend env | grep LIVEKIT` (presence
  matches compose/LIVEKIT decision; absence means meetings degrade to
  presence-only, which is valid but must be known).
- [ ] 5.6 Media upload smoke: upload one small test image/video via the
  test account; confirm file lands in fresh `uploads/`, and HLS dir
  re-creates if used.
- [ ] 5.7 Confirm banner/status: the V1-retirement banner/push states now
  *resolve* — new users should see no stale V1 warnings (banner off).

**Phase 5 exit: all boxes ticked → report complete and healthy to owner
with the ticket.**

---

## Phase 6 — Rollback plan

**Goal: know exactly when to abort vs restore, and rehearse the restore
before you need it.**

**When to ABORT (stop, don't wipe anything else, don't retry):**
- Any Phase 1–3 gate empty at Phase 4 entry; or owner GO missing.
- Archive checksum mismatch at 4.1 (archive is corrupt — everything stops
  until a verified backup exists).
- Boot failures during 4.7–4.8 that repeat after one careful retry with
  fresh logs read.

**When to RESTORE (put V1 back, postpone launch):**
- Post-wipe verification (Phase 5) fails on a blocker >2 times, or data
  integrity is suspect (e.g. DB restores but counts wrong).
- Owner calls it: at any time, before or after wipe, the owner can say
  restore — operator executes without argument.

**Restore procedure (rehearse!):**

- [ ] 6.1 Stop app services (as 4.3).
- [ ] 6.2 Remove any partially-wiped/failed fresh DB file and partial
  media dirs created after 4.7 — clean the live paths.
- [ ] 6.3 Copy the **Phase 4.4 datestamped final backup** (not the Phase 1
  archive, which is pre-comms state) back into the live volume paths.
- [ ] 6.4 `docker compose up -d backend nginx-rtmp frontend` (+ livekit
  per deploy script).
- [ ] 6.5 Verify same checklist as Phase 5 but with V1 expectations: old
  user can log in, uploads browse, `SELECT COUNT(*) FROM Users` matches
  ticket.
- [ ] 6.6 Notify owner: "restored V1 at $(date), launch postponed",
  attach logs.

- [ ] 6.7 **Restore rehearsal (do this DURING Phase 1, before any wipe):**
  the test-restore in 1.8 *is* the rehearsal — record in the ticket that a
  rehearsal was performed, with path and boot result. **No wipe without a
  recorded, passed rehearsal.**

---

## Appendix — Abbreviated one-page command sheet

```bash
# Phase 1 (backup) core loop
docker compose stop backend
cp -a <vol>/ikhwezi.db <vol>/ikhwezi.db.pre-v2wipe.bak
tar -czf uploads-$(date +%F).tar.gz <vol>/uploads/
# Phase 4 (wipe) core loop — OWNER GO REQUIRED
docker compose stop backend nginx-rtmp frontend
mkdir -p ~/v1-final-backup-$(date +%F)
cp -a <vol>/ikhwezi.db ~/v1-final-backup-$(date +%F)/
rm <vol>/ikhwezi.db && rm -rf <vol>/uploads/ <vol>/hls/
docker compose up -d backend nginx-rtmp frontend
docker compose logs -f backend
```

*(Paths intentionally `<vol>`-placeholdered: resolve from `docker volume
inspect` against the live compose file at run time — see Ground truth.)*
