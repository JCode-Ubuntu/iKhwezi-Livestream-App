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
