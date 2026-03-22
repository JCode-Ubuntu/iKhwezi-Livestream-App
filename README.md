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

- **User App**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin (Key: `ikhwezi_admin_26`)
- **API**: http://localhost:3001
- **HLS Stream**: http://localhost:8080/hls/stream.m3u8

## OBS Streaming Setup

1. Open OBS Studio
2. Settings → Stream
3. Service: Custom
4. Server: `rtmp://localhost:1935/live`
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

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + SQLite
- **Streaming**: nginx-rtmp (RTMP → HLS)
- **Auth**: JWT tokens

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| ADMIN_KEY | ikhwezi_admin_26 | Admin access key |
| JWT_SECRET | (auto-generated) | JWT signing secret |
| PORT | 3001 | Backend port |

## Creator Economy

- Stars given by users convert to points
- 1 Star = 10 Points
- Points stored per creator
- Admin cannot modify creator earnings
- Ready for future cash-out integration

---

Built with 💜 for creators
