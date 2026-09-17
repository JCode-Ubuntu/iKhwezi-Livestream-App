# INCIDENT: production unresponsive after deploy 35203203975

## Timeline (UTC)
- 09:05 push 6c1f5a0 (migration 0005 hot-path indexes) → deploy started
- 09:06 quality gate PASS (47s)
- 09:07:45-09:07:59 postgres/redis/rtmp/backend/frontend recreated OK (per deploy log)
- 09:08:00 `docker compose up -d livekit` → docker daemon read timeout (60s)
- 09:09+ deploy step retried/hung until 25m command_timeout → job FAILED
- 09:33+ https://ikhwezi.site/api/health and / TIME OUT from outside
- 09:38+ direct SSH to 13.62.54.198 hangs (no banner within 3 min)

## Key evidence
- TCP ports 443/80/22 ACCEPT connections (Test-NetConnection true) but no
  protocol response → host is up, userland is not answering, or the daemon
  is wedged again (same class of failure as the local Windows wedge:
  docker daemon API unresponsive after livekit start).
- The deploy log shows the failure signature "UnixHTTPConnectionPool ...
  Read timed out (read timeout=60)" — the SERVER-side docker daemon
  stopped answering during/after the livekit container start.

## Most likely causes (ranked)
1. Server docker daemon wedged OOM/CPU: livekit start on a small Lightsail
   instance + 5 concurrent --no-cache builds exhausted memory; the daemon
   or the node is swapping to death. (Builds of 3 images at once on a
   t3.small-class box is the likely killer.)
2. Host-level OOM killing dockerd / SSHd children; ports accept but
   nothing serves.
3. Network path issue (unlikely — TCP connect succeeds).

## Required actions (owner; I have no Lightsail/SSH access)
1. AWS Console → Lightsail → instance → Connect (browser SSH) or
   reboot instance.
2. If shell obtained:
   - `sudo dmesg | grep -i oom | tail` — confirm OOM
   - `sudo systemctl restart docker` (or reboot)
   - `cd ~/iKhwezi-Livestream-App && docker compose up -d` (backend runs
     migrations incl. 0005 on boot; livekit last)
3. Consider upsizing the instance (2GB → 4GB) — 3 parallel --no-cache
   docker builds + livekit + postgres + redis + node exceeds 2GB.
   Mitigation already possible in repo: serialize builds in deploy.yml
   (build one image per step) to cap peak memory.

## Repo-side fix to apply once host is back (I can do this)
- deploy.yml: replace `$COMPOSE build --no-cache frontend backend nginx-rtmp`
  (parallel builds) with three sequential `build` invocations, and add
  `COMPOSE_HTTP_TIMEOUT=300` env for the livekit start. Both are
  safe, surgical changes that reduce peak memory + tolerate slow starts.

---

# UPDATE 2 — 2026-09-17 ~18:00 UTC (build-on-runner era, third outage)

## What changed between UPDATE 1 and now
The pipeline was rebuilt to eliminate on-server builds entirely
(commit `5bc5e76`): GitHub Actions builds all three images on the 16GB
runner, ships them as gzipped tarballs over scp, and the server only runs
`docker load` + `docker compose up -d`.

## Third outage timeline (UTC)
- 14:42 owner reboots the host (per UPDATE 1 request)
- 15:22 run 35239767019 — the OLD build-on-server workflow (pre-`5bc5e76`)
  starts Docker builds on the server again before being CANCELLED
  mid-run. Cancelled ≠ harmless: half-built image layers + docker build
  activity on the 2GB host re-trigger the same OOM/wedge class.
- 15:51 run 35242891160 — the NEW pipeline: quality gate PASS ✅, runner
  image builds PASS ✅, then scp fails: `dial tcp :22: connection
  timed out`.
- 17:52 external probe: ICMP ping FAIL, TCP 22 FAIL, TCP 443 FAIL →
  **the host itself is down at the OS/network level**, not the app.

## Root cause (evidence-based)
The host was already dead BEFORE the new pipeline touched it — killed by
the cancelled-but-mid-build old workflow at 15:22. The new pipeline is
exonerated by run 35242891160: it never got past scp because there was
nothing to connect to.

## Required action (owner, unchanged)
AWS Console → Lightsail → instance (Stockholm) → **Reboot**. After the
reboot, ONLY the new pipeline (build-on-runner) will deploy to this host —
the 15:22 failure class (on-server builds) no longer exists in the repo.

## Post-reboot verification plan (mine)
1. `gh run watch` the next deploy run end-to-end.
2. `curl https://ikhwezi.site/api/ready` → 200 with dependencies ok.
3. Record image SHA tags running on the server for the rollback ledger.
