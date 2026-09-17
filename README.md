# iKHWEZI 3.0

**Stream the night. Shine the signal.**

A production-grade short-video creator economy platform with TikTok-style UX, live streaming, and star-based monetization.

## Quick Start

### Docker (full stack)

```bash
docker compose up --build
```

### Local (terminal, no Docker)

**Terminal 1 — API**

```bash
cd backend
npm install
npm start
```

**Terminal 2 — web app**

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:3000**). The API runs on **http://localhost:3001** (proxied by Vite in dev).

## Access Points

### Live (Production)
- **User App**: https://ikhwezi.site
- **Admin Panel**: https://ikhwezi.site/admin (requires an account with the
  `admin` role — RBAC is the authoritative authorization; the legacy shared
  ADMIN_KEY is disabled by default and only used for one-time bootstrap)
- **Server IP**: 13.62.54.198 (AWS Lightsail — Stockholm)

### Local (Development)
- **User App**: http://localhost:8080
- **Admin Panel**: http://localhost:8080/admin
- **API**: http://localhost:3001
- **HLS Stream**: http://localhost:8080/hls/stream.m3u8

## OBS Streaming Setup

1. Open OBS Studio
2. Settings → Stream
3. Service: Custom
4. Server: `rtmp://13.62.54.198:1935/live` (live) or `rtmp://localhost:1935/live` (local)
5. Stream Key: (Get from Admin Panel)

## Features

### User Features
- Full-screen horizontal swipe video feed
- Star creators (1 star = 10 points)
- Like, comment, share, follow
- Watch live streams
- Guest mode with upgrade path

### Admin Features
- RTMP stream key management
- Go live / stop live controls
- Video upload & management
- User management & bans
- Analytics dashboard
- Audit logging

## Architecture

- **Frontend**: React + Vite (Capacitor for Android/iOS)
- **Backend**: Node.js + Express (modular: `routes/`, `middleware/`,
  `services/`, `jobs/`, `queues/`, `lib/`, feature packages `groups/`,
  `meetings/`, `storage-v2/`)
- **Database**: PostgreSQL in production (via `DATABASE_URL`), SQLite for
  local dev. Schema is managed by **versioned migrations**
  (`backend/migrations/`, run on boot via `backend/db/migrate.js`)
- **Queue / rate limiting**: BullMQ + Redis when `REDIS_URL` is set;
  in-process/in-memory fallbacks otherwise (single-server default)
- **Streaming**: nginx-rtmp (RTMP → HLS), authenticated publish webhooks
- **Meetings A/V**: LiveKit SFU + coturn TURN relay (presence-only when
  unconfigured)
- **Storage**: local disk by default; S3/R2 object-storage copy in the
  background when `S3_*` is set
- **Backups**: automated, encrypted, optionally off-site to the S3 bucket
  (`backend/jobs/backupJob.js`)
- **Auth**: JWT tokens + per-user RBAC roles (`admin` / `moderator`)

## Environment Variables

See `.env.dist` for the complete, documented list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| JWT_SECRET | (auto-generated) | JWT signing secret — set a persistent value in production |
| ADMIN_KEY | (auto-generated) | Legacy bootstrap key — **disabled by default** (`ADMIN_KEY_ENABLED=false`); set `ADMIN_KEY_ENABLED=true` explicitly only for a one-time admin bootstrap grant |
| DATABASE_URL | *(empty → SQLite)* | `postgresql://…` switches the backend to PostgreSQL |
| REDIS_URL | *(empty → in-process)* | `redis://…` enables BullMQ queues + Redis rate limiting |
| RTMP_WEBHOOK_SECRET | *(required by compose)* | Shared secret for nginx-rtmp publish callbacks |

## Creator Economy

- Stars given by users convert to points
- 1 Star = 10 Points
- Points stored per creator
- Admin cannot modify creator earnings
- Ready for future cash-out integration

---

Built with 💜 for creators

## Credits

- UI motion & interaction inspiration: [Emil Kowalski](https://emilkowal.ski/)
