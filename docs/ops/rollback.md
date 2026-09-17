# Rollback — Operations Guide

> **Audience:** the operator on call when a deploy breaks production.
> Rule this guide serves: **a failed deploy must never destroy the last
> known-good release — and restoring it must be one command.**

---

## 1. What exists automatically

Every successful deploy (`.github/workflows/deploy.yml`) leaves behind:

| Artifact | Location on server | Purpose |
|---|---|---|
| `previous-nginx-rtmp.tar.gz` / `previous-backend.tar.gz` / `previous-frontend.tar.gz` | `~/ikhwezi-releases/` | Full image set of the LAST **readiness-verified** release |
| `previous-release.sha` | `~/ikhwezi-releases/` | Exact git SHA of that release (audit trail) |

Key properties:

- **Rotation happens only AFTER the readiness gate passes.** A deploy that
  fails `curl /api/ready` exits before touching `~/ikhwezi-releases/` —
  the previous artifacts always describe the last healthy release.
- **Images are immutable and SHA-tagged.** Every build is tagged
  `ikhwezi-<service>:<short-sha>` in addition to `:latest`, so a restored
  release is bit-identical to what ran when it was deployed.
- **The server never builds.** Rollback re-loads retained tarballs — no
  build step can OOM the Lightsail host mid-rollback (incident
  2026-09-17, twice).

## 2. How to roll back

```bash
gh workflow run rollback.yml -f confirm=ROLLBACK
# or: GitHub → Actions → "Rollback production" → Run workflow → confirm: ROLLBACK
```

The workflow (`.github/workflows/rollback.yml`) will:

1. `docker load` the three retained images (re-pins `:latest` to the
   previous SHA tag).
2. `docker compose up -d frontend backend nginx-rtmp` on those images.
3. Gate on `/api/ready` exactly like the deploy workflow — a rollback that
   cannot reach readiness reports FAILURE, not success.

livekit is intentionally untouched: it is a prebuilt upstream image whose
config comes from `.env` only, and meetings already degrade to
presence-only if it is unreachable.

## 3. Verification after rollback

```bash
ssh <server> 'cat ~/ikhwezi-releases/previous-release.sha'   # expected SHA
curl -fsS https://ikhwezi.site/api/ready | jq .status        # "ok"
curl -fsS https://ikhwezi.site/api/health | jq .status       # "ok"
```

Then exercise one real user path (login + feed) before declaring the
incident over.

## 4. Limits (honesty)

- **One release deep.** Retention holds exactly the previous release
  (`previous-*`). Rolling back twice in a row requires re-running the
  deploy pipeline for the older SHA (re-run the `deploy` workflow on that
  commit — the pipeline is deterministic from git history).
- **Schema/migrations are not automatically reverted.** Backward-compatible
  migrations are the standard here; if a deploy shipped a destructive
  migration, rollback restores the CODE but not the schema — restore the
  database from backups (`docs/ops/backup-restore.md`) instead.
- **`.env` is not rolled back.** Operator-managed secrets stay as-is; that
  is almost always correct.

Related docs:

- `.github/workflows/deploy.yml` — release retention logic
- `.github/workflows/rollback.yml` — the rollback workflow
- `docs/ops/backup-restore.md` — data-level recovery (complementary, not a substitute)
