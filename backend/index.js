const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Sequelize, DataTypes, Op, QueryTypes } = require('sequelize');
const http = require('http');
const { Server } = require('socket.io');

// Phase 3B: centralized structured logger. Used throughout boot and wiring
// so console.* calls can be replaced with a log record that carries service
// context and can redact secrets.
const { createLogger, bindCorrelationId } = require('./lib/logger');
const appLogger = createLogger();

// SECURITY: this repository is public on GitHub. Previous versions of this
// file hardcoded real-looking fallback values for JWT_SECRET and ADMIN_KEY
// directly in source (e.g. 'ikhwezi_jwt_secret_2026_super_secure'), which
// meant anyone who read the public repo could forge login tokens for any
// account (including admin) or send the admin-key header to unlock every
// /api/admin/* route — ban users, read everyone's email/phone, grant
// themselves admin, start/stop the livestream, etc.
//
// Fix: require these to come from real environment variables. If an
// operator hasn't set them, generate a strong random value for this process
// lifetime instead of silently trusting a value that is now public
// knowledge, and warn loudly so it gets fixed. This intentionally still
// lets the server boot (so a missing env var doesn't take the whole app
// down) but a restart without the env var set means existing login tokens
// and the previous admin key stop working, which is the correct trade-off
// for a leaked secret.
function requireSecretOrGenerate(envVarName, { minLength = 32 } = {}) {
  const fromEnv = process.env[envVarName];
  if (fromEnv && fromEnv.length >= minLength) return fromEnv;
  if (fromEnv) {
    appLogger.warn(`${envVarName} is set but shorter than ${minLength} characters — treating as insecure and generating a random one instead.`);
  }
  const generated = crypto.randomBytes(48).toString('hex');
  appLogger.warn('SECURITY WARNING: ' + envVarName + ' is not set (or too short) in the environment.', {
    envVar: envVarName,
    disposition: 'Generated a random value for THIS PROCESS ONLY — it will change on restart. Set a persistent environment variable on the server ASAP.',
  });
  return generated;
}

// Capacitor Android/iOS WebViews call the API from https://localhost (or
// capacitor://localhost), not from ikhwezi.site — without these origins CORS
// blocks auth/feed fetches and the native app appears frozen or crash-loops.
function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  const allowed = new Set([
    'https://ikhwezi.site',
    'http://ikhwezi.site',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:8080',
    'http://localhost:3000',
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'https://app.ikhwezi.local',
    'http://app.ikhwezi.local',
  ]);
  if (allowed.has(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return false;
}

// Keep one bad promise or callback from taking the whole API down.
require('./utils/processGuards').installProcessGuards();

const app = express();
const server = http.createServer(app);

// Phase 3B: Sentry error monitoring (fail-open; no DSN = no-op).
const { createSentryHub } = require('./lib/sentry');
const sentryHub = createSentryHub({ env: process.env, logger: appLogger });

// Phase 3B: alerting hooks (fail-open; no webhook URL = loud log only).
const { createAlerter } = require('./lib/alerts');
const alerter = createAlerter({ env: process.env, logger: appLogger });

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    methods: ['GET', 'POST'],
    credentials: false,
  },
  // Allow both WebSocket and long-polling so connections survive
  // intermediate proxies that strip WebSocket upgrade headers
  transports: ['polling', 'websocket'],
  allowEIO3: true,
});
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const JWT_SECRET = requireSecretOrGenerate('JWT_SECRET');
const ADMIN_KEY = requireSecretOrGenerate('ADMIN_KEY', { minLength: 12 });
// Shared secret nginx-rtmp must send when calling on-publish webhooks.
const RTMP_WEBHOOK_SECRET = process.env.RTMP_WEBHOOK_SECRET || '';
// Accept HLS_HOST or legacy HLS_URL from docker-compose / .env.dist
const HLS_HOST = (process.env.HLS_HOST || process.env.HLS_URL || '').replace(/\/$/, '');
const RTMP_SERVER = (process.env.RTMP_SERVER || process.env.RTMP_HOST || 'rtmp://localhost:1935/live').replace(/\/$/, '');
// Public ingest URL shown in Admin / OBS (defaults to RTMP_SERVER — override when backend uses internal Docker hostname)
const RTMP_PUBLIC_SERVER = (process.env.RTMP_PUBLIC_SERVER || RTMP_SERVER).replace(/\/$/, '');
const TRUST_INTERNAL_RTMP_WEBHOOK = process.env.TRUST_INTERNAL_RTMP_WEBHOOK === '1'
  || process.env.TRUST_INTERNAL_RTMP_WEBHOOK === 'true';

// Real-money top-ups activate automatically once these are set — no code
// changes needed. Until then, /api/wallet/topup runs in dev mode and grants
// coins directly (clearly flagged in the response) so gifting/subscriptions
// are fully testable end-to-end without a payment processor.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_ENABLED = !!STRIPE_SECRET_KEY;
const stripeClient = STRIPE_ENABLED ? require('stripe')(STRIPE_SECRET_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Database setup — see ./config/database.js. SQLite by default (absolute path so
// CWD never selects the wrong DB file); DATABASE_URL switches to PostgreSQL.
const sequelize = require('./config/database').createSequelize({
  sqlitePath: path.join(__dirname, 'storage', 'ikhwezi.db'),
});

// Models — defined in ./models so they can be loaded without booting the server.
const { defineCoreModels } = require('./models');
const coreModels = defineCoreModels(sequelize, DataTypes);
const {
  User, Video, Like, VideoSave, VideoRepost, Comment, Follow, Story, StoryView,
  StoryComment, Challenge, Star, DirectMessage,
  TextPost, PostLike, Points, Wallet, Subscription, GiftLog, LiveStatus, AuditLog,
  ProcessedStripeEvent, Ad, Device,
} = coreModels;

// Public HLS playback URL — safe to expose (watch-only). Never expose streamKey/RTMP on public routes.
// nginx-rtmp writes playlists as /tmp/hls/{streamKey}.m3u8 (served at /hls/{streamKey}.m3u8).
function buildPublicHlsUrl(streamKey) {
  if (!streamKey) return null;
  const playlist = `${streamKey}.m3u8`;
  if (HLS_HOST) {
    return `${HLS_HOST}/${playlist}`;
  }
  return `/hls/${playlist}`;
}

function buildRtmpPublishUrl(streamKey) {
  if (!streamKey) return null;
  return `${RTMP_PUBLIC_SERVER}/${streamKey}`;
}

function buildRtmpIngestInfo(streamKey) {
  if (!streamKey) {
    return { rtmpServer: RTMP_PUBLIC_SERVER, streamKey: null, rtmpPublishUrl: null };
  }
  return {
    rtmpServer: RTMP_PUBLIC_SERVER,
    streamKey,
    rtmpPublishUrl: buildRtmpPublishUrl(streamKey),
  };
}

// RTMP webhook auth — see ./middleware/rtmpWebhook.js.
// internalOnly: source allow-list (Layer 1) — default ON in production, can
// be forced with RTMP_WEBHOOK_INTERNAL_ONLY=true/false.
const RTMP_WEBHOOK_INTERNAL_ONLY = process.env.RTMP_WEBHOOK_INTERNAL_ONLY === 'true'
  || process.env.RTMP_WEBHOOK_INTERNAL_ONLY === 'false'
    ? process.env.RTMP_WEBHOOK_INTERNAL_ONLY === 'true'
    : undefined;
const { requireRtmpWebhook } = require('./middleware/rtmpWebhook').buildRtmpWebhookGuard({
  secret: RTMP_WEBHOOK_SECRET,
  isProduction: IS_PRODUCTION,
  trustInternal: TRUST_INTERNAL_RTMP_WEBHOOK,
  internalOnly: RTMP_WEBHOOK_INTERNAL_ONLY,
});

function emitLiveStarted(liveStatus) {
  io.emit('livestream-started', {
    title: liveStatus.title || 'Live Stream',
    viewerCount: liveStatus.viewerCount || 0,
    startedAt: liveStatus.startedAt,
    hlsUrl: buildPublicHlsUrl(liveStatus.streamKey),
  });
}

function emitLiveStopped() {
  io.emit('livestream-stopped', { isLive: false });
  io.emit('viewer-count', { viewerCount: 0 });
}


// Middleware
// Request context FIRST so every downstream route/middleware can use
// req.id + req.logger (Phase 3B observability slice).
const { buildRequestContextMiddleware } = require('./middleware/requestContext');
app.use(buildRequestContextMiddleware({ logger: appLogger, env: process.env }));

app.use(cors({
  origin: (origin, callback) => {
    callback(null, isAllowedCorsOrigin(origin));
  },
  credentials: false,
}));

// Stripe webhook must read the raw request body for signature verification,
// so it's registered before the global JSON parser below.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!STRIPE_ENABLED) return res.status(503).json({ error: 'Stripe not configured' });
  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    req.logger?.error('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const coins = parseInt(session.metadata?.coins || '0', 10);
    if (userId && coins > 0) {
      try {
        const already = await ProcessedStripeEvent.findOne({ where: { eventId: event.id } });
        if (already) {
          return res.json({ received: true, duplicate: true });
        }
        const [wallet] = await Wallet.findOrCreate({ where: { userId }, defaults: { userId, coins: 500 } });
        wallet.coins += coins;
        await wallet.save();
        await ProcessedStripeEvent.create({
          eventId: event.id,
          sessionId: session.id,
          userId,
          coins,
        });
        io.to(`user_${userId}`).emit('wallet-updated', { coins: wallet.coins });
        await logAudit('WALLET_TOPUP_STRIPE', { userId, coins, sessionId: session.id }, null);
      } catch (err) {
        req.logger?.error('Stripe webhook wallet credit failed', { error: err.message });
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'storage/uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.webm', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

const storyUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.webm', '.avi', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type for story'));
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const adUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid ad media type'));
  }
});

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;
function detectAdMediaType(filename) {
  return VIDEO_EXT.test(filename || '') ? 'video' : 'image';
}

// Auth middleware — see ./middleware/auth.js (extracted, behaviour unchanged).
const { buildAuthMiddleware } = require('./middleware/auth');
const {
  authenticate, requireAuth, requireRegistered, socketAuth,
} = buildAuthMiddleware({ User, JWT_SECRET, ADMIN_KEY });

// ==================== RBAC (Phase 3A) ====================
// ADMIN_KEY disposition: demoted to a transition/ops key. Default
// enabled for the transition window; ADMIN_KEY_ENABLED=false hard-disables
// every remaining key path (V2-launch intent — documented in the final
// report). Built fully below once logAudit exists (needs it for auditing).
const ADMIN_KEY_ENABLED = process.env.ADMIN_KEY_ENABLED !== 'false'; // default true: transition

// Socket.IO JWT handshake — populates socket.user (null for anonymous/banned).
// Registered here, before any feature module attaches `io.on('connection')`
// handlers, so every connection handler can rely on socket.user being set.
io.use(socketAuth);

// Audit logger
const logAudit = async (action, details, ip) => {
  await AuditLog.create({ action, details: JSON.stringify(details), ip });
  const count = await AuditLog.count();
  if (count > 100) {
    const oldest = await AuditLog.findAll({ order: [['createdAt', 'ASC']], limit: count - 100 });
    await AuditLog.destroy({ where: { id: oldest.map(l => l.id) } });
  }
};

// ==================== RBAC MIDDLEWARE (Phase 3A) ====================
// Defined after logAudit so every legacy ADMIN_KEY use is audited.
// See ./middleware/rbac.js for the full design notes (fail-closed,
// DB-authoritative role checks; moderator = ban/unban only).
const { buildRbacMiddleware } = require('./middleware/rbac');
const {
  requireRole, requireModerationAccess, adminKeyMatches,
} = buildRbacMiddleware({
  User, JWT_SECRET, ADMIN_KEY, logAudit, adminKeyEnabled: ADMIN_KEY_ENABLED,
});

const normalizeCommentContent = (raw) => String(raw || '').trim().replace(/\s+/g, ' ');

// Fisher-Yates — `array.sort(() => Math.random() - 0.5)` (used previously)
// is a well-known broken shuffle: comparator-based sorts assume a
// transitive, consistent comparator, and a random one violates that, so the
// result is neither uniformly random nor even guaranteed to visit every
// element with V8's sort implementation. This is an actual, correct shuffle.
function shuffleArray(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Atomic viewer-count updates. The four join/leave routes below previously
// did `liveStatus.viewerCount += 1; await liveStatus.save()` — a
// read-modify-write. Two concurrent requests can both read the same value,
// both compute value+1, and both write the same result back, silently
// losing one increment (classic lost-update race). These issue a single
// `UPDATE ... SET viewerCount = viewerCount +/- 1` statement instead, which
// SQLite executes atomically, then reloads the instance to return the
// authoritative post-update count.
async function incrementViewerCount(liveStatus) {
  await liveStatus.increment('viewerCount', { by: 1 });
  await liveStatus.reload();
  return liveStatus.viewerCount;
}

async function decrementViewerCount(liveStatus) {
  await sequelize.query(
    'UPDATE LiveStatuses SET viewerCount = MAX(0, viewerCount - 1) WHERE id = :id',
    { replacements: { id: liveStatus.id }, type: QueryTypes.UPDATE }
  );
  await liveStatus.reload();
  return liveStatus.viewerCount;
}

async function resolveLiveHostUser() {
  const liveStatus = await LiveStatus.findOne({ where: { isLive: true }, order: [['startedAt', 'DESC']] });
  if (liveStatus?.hostUserId) {
    const host = await User.findByPk(liveStatus.hostUserId);
    if (host) return host;
  }
  return User.findOne({ where: { isAdmin: true }, order: [['createdAt', 'ASC']] });
}

async function assignLiveHost(liveStatus) {
  if (liveStatus.hostUserId) return liveStatus;
  const host = await User.findOne({ where: { isAdmin: true }, order: [['createdAt', 'ASC']] });
  if (host) liveStatus.hostUserId = host.id;
  return liveStatus;
}

// ── Batch video meta helper (eliminates N+1 queries) ──────────────
async function attachVideoMeta(videos, userId) {
  if (!videos.length) return [];
  const ids = videos.map(v => (typeof v.toJSON === 'function' ? v.toJSON() : v).id);

  const [likeCounts, commentCounts, starSums, repostCounts] = await Promise.all([
    Like.findAll({
      where: { videoId: ids },
      attributes: ['videoId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['videoId'],
      raw: true,
    }),
    Comment.findAll({
      where: { videoId: ids },
      attributes: ['videoId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['videoId'],
      raw: true,
    }),
    Star.findAll({
      where: { videoId: ids },
      attributes: ['videoId', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      group: ['videoId'],
      raw: true,
    }),
    VideoRepost.findAll({
      where: { videoId: ids },
      attributes: ['videoId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['videoId'],
      raw: true,
    }),
  ]);

  const likeMap = Object.fromEntries(likeCounts.map(r => [r.videoId, parseInt(r.count) || 0]));
  const commentMap = Object.fromEntries(commentCounts.map(r => [r.videoId, parseInt(r.count) || 0]));
  const starMap = Object.fromEntries(starSums.map(r => [r.videoId, parseInt(r.total) || 0]));
  const repostMap = Object.fromEntries(repostCounts.map(r => [r.videoId, parseInt(r.count) || 0]));

  let likedIds = new Set();
  let followedCreatorIds = new Set();
  let starredIds = new Set();
  let savedIds = new Set();
  let repostedIds = new Set();

  if (userId) {
    const creatorIds = [...new Set(videos.map(v => {
      const plain = typeof v.toJSON === 'function' ? v.toJSON() : v;
      return plain.userId;
    }))];
    const [userLikes, userFollows, userStars, userSaves, userReposts] = await Promise.all([
      Like.findAll({ where: { userId, videoId: ids }, attributes: ['videoId'], raw: true }),
      Follow.findAll({ where: { followerId: userId, followingId: creatorIds }, attributes: ['followingId'], raw: true }),
      Star.findAll({ where: { userId, videoId: ids }, attributes: ['videoId'], raw: true }),
      VideoSave.findAll({ where: { userId, videoId: ids }, attributes: ['videoId'], raw: true }),
      VideoRepost.findAll({ where: { userId, videoId: ids }, attributes: ['videoId'], raw: true }),
    ]);
    likedIds = new Set(userLikes.map(l => l.videoId));
    followedCreatorIds = new Set(userFollows.map(f => f.followingId));
    starredIds = new Set(userStars.map(s => s.videoId));
    savedIds = new Set(userSaves.map(s => s.videoId));
    repostedIds = new Set(userReposts.map(r => r.videoId));
  }

  return videos.map(v => {
    const plain = typeof v.toJSON === 'function' ? v.toJSON() : v;
    return {
      ...plain,
      caption: plain.description || plain.title || '',
      likeCount: likeMap[plain.id] || 0,
      commentCount: commentMap[plain.id] || 0,
      starCount: starMap[plain.id] || 0,
      repostCount: repostMap[plain.id] || 0,
      isLiked: likedIds.has(plain.id),
      isFollowing: followedCreatorIds.has(plain.userId),
      hasStarred: starredIds.has(plain.id),
      isSaved: savedIds.has(plain.id),
      isReposted: repostedIds.has(plain.id),
    };
  });
}

// ── In-memory rate limiter (no extra dependencies) ────────────────
const _rlStore = new Map();
setInterval(() => {
  const cut = Date.now() - 15 * 60 * 1000;
  for (const [k, hits] of _rlStore) {
    const fresh = hits.filter(t => t > cut);
    if (fresh.length === 0) _rlStore.delete(k); else _rlStore.set(k, fresh);
  }
}, 5 * 60 * 1000).unref();

function createRateLimiter(windowMs, max, message) {
  return (req, res, next) => {
    const key = (req.ip || req.socket?.remoteAddress || 'x') + ':' + req.path;
    const now = Date.now();
    const window = now - windowMs;
    const hits = (_rlStore.get(key) || []).filter(t => t > window);
    if (hits.length >= max) {
      return res.status(429).json({ error: message || 'Too many requests. Please slow down.' });
    }
    hits.push(now);
    _rlStore.set(key, hits);
    next();
  };
}

const authRateLimit = createRateLimiter(15 * 60 * 1000, 20, 'Too many auth attempts. Try again in 15 minutes.');
const commentRateLimit = createRateLimiter(60 * 1000, 10, 'Posting too fast. Please wait a moment.');
const interactionRateLimit = createRateLimiter(60 * 1000, 60, 'Too many actions. Please slow down.');
// RTMP webhooks are unauthenticated-by-nature (secret-bearing but
// attacker-reachable); rate-limit separately so abusers can't spam the
// DB writes / live-status flips even with a valid secret, and can't
// brute-force the secret by volume. nginx-rtmp fires one callback per
// publish/stop — generous for real traffic, tight for abuse.
const webhookRateLimit = createRateLimiter(60 * 1000, 30, 'Too many webhook calls.');
// FCM device registry: per-user device cap (roadmap "~5").
const MAX_DEVICES_PER_USER = 5;

// ==================== GROUP CHAT ====================
// Modular feature mounted as its own package. Defines its own Sequelize
// models (synced below), REST routes under /api/groups, and Socket.IO
// handlers. See backend/groups/README.md.
const groupsModule = require('./groups').mount({
  app, io, sequelize, User, DataTypes, Op,
  authenticate, requireRegistered, interactionRateLimit, logAudit,
});

// ==================== MEETINGS ====================
// Group meetings (scheduling + presence + LiveKit A/V when configured).
// Depends on the groups module for membership checks; REST under
// /api/meetings. A/V is server-gated: tokens are minted only for live
// meetings to group members (see backend/meetings/av.js). When LIVEKIT_* env
// vars are absent, meetings stay presence-only and capabilities say so.
const meetingsModule = require('./meetings').mount({
  app, io, sequelize, User, DataTypes,
  authenticate, requireRegistered, interactionRateLimit, logAudit,
  groups: groupsModule,
  env: process.env,
});

// ==================== MEDIA PIPELINE (PHASE 2: STORAGE + TRANSCODE) ====================
// Object-storage provider (local disk by default; S3/R2 when S3_* env set —
// see backend/storage-v2/). Fire-and-forget only: a provider copy failure is
// logged, the LOCAL file stays canonical and the upload itself NEVER fails.
// Transcode queue: BullMQ when REDIS_URL is set, in-process fallback
// otherwise (the default until Redis lands in compose — never blocks boot).
const mediaPipeline = (() => {
  try {
    const { buildStorageProviderFromEnv } = require('./storage-v2');
    const storageProvider = buildStorageProviderFromEnv({ env: process.env, log: appLogger });
    const { buildTranscodeService } = require('./services/transcode');
    const transcode = buildTranscodeService({ env: process.env, log: appLogger });
    const { buildTranscodeQueueFromEnv } = require('./queues');
    const transcodeQueue = buildTranscodeQueueFromEnv({
      processor: (job) => transcode.process(job),
      env: process.env,
      log: appLogger,
    });
    return { storageProvider, transcode, transcodeQueue };
  } catch (err) {
    appLogger.warn('Media pipeline could not initialize (non-fatal; uploads stay local-only)', { error: err?.message || String(err) });
    return null;
  }
})();

// Phase 3B: health/readiness service with dependency checks and short cache.
const { createHealthService } = require('./lib/health');
const healthService = createHealthService({
  sequelize,
  storageProvider: mediaPipeline?.storageProvider || null,
  env: process.env,
  logger: appLogger,
});

/** Copy an uploaded file to object storage in the background. Never throws,
 *  never blocks the HTTP response; local file remains the source of truth. */
function persistUploadToStorage(filename) {
  if (!mediaPipeline || !filename) return;
  const filePath = path.join(__dirname, 'storage', 'uploads', filename);
  Promise.resolve()
    .then(() => mediaPipeline.storageProvider.put(`uploads/${filename}`, filePath))
    .catch((err) => appLogger.error('storage-v2: background copy failed (local file stays canonical)', { filename, error: err?.message || String(err) }));
}

/** Enqueue transcode profiles for an uploaded video. Runs only after the
 *  response is sent (never in the request path); best-effort, never throws. */
function enqueueTranscode(filename) {
  if (!mediaPipeline || !filename) return;
  try {
    mediaPipeline.transcodeQueue.add('transcode', {
      filename,
      uploadsDir: path.join(__dirname, 'storage', 'uploads'),
    }).catch?.((err) => appLogger.error('transcode enqueue failed', { filename, error: err?.message || String(err) }));
  } catch (err) {
    appLogger.error('transcode enqueue failed', { filename, error: err?.message || String(err) });
  }
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  try {
    const { email, phone, password, username, displayName } = req.body;
    if (!password || !username) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone required' });
    }
    
    const existing = await User.findOne({
      where: {
        [Op.or]: [
          email ? { email } : null,
          phone ? { phone } : null,
          { username }
        ].filter(Boolean)
      }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email || null,
      phone: phone || null,
      password: hashedPassword,
      username,
      displayName: displayName || username,
      isCreator: false,
      // Only mark as guest when the server recognizes the guest email pattern —
      // never trust a client-supplied isGuest flag.
      isGuest: !!(email && String(email).endsWith('@guest.local')),
    });
    
    await Points.create({ creatorId: user.id, totalPoints: 0, lifetimePoints: 0 });
    await Wallet.create({ userId: user.id, coins: 500 });
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isCreator: user.isCreator,
        isAdmin: user.isAdmin,
        role: user.role,
        isGuest: user.isGuest
      }
    });
  } catch (err) {
    req.logger?.error('Register error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if (!password || (!email && !phone)) {
      return res.status(400).json({ error: 'Credentials required' });
    }
    
    const user = await User.findOne({
      where: email ? { email } : { phone }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account banned' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isCreator: user.isCreator,
        isAdmin: user.isAdmin,
        role: user.role,
        isGuest: user.isGuest
      }
    });
  } catch (err) {
    req.logger?.error('Login error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticate, requireAuth, async (req, res) => {
  try {
    const points = await Points.findOne({ where: { creatorId: req.user.id } });
    res.json({
      id: req.user.id,
      email: req.user.email,
      phone: req.user.phone,
      username: req.user.username,
      displayName: req.user.displayName,
      avatar: req.user.avatar,
      bio: req.user.bio,
      isCreator: req.user.isCreator,
      isAdmin: req.user.isAdmin,
      role: req.user.role,
      isGuest: req.user.isGuest,
      points: points?.totalPoints || 0
    });
  } catch (err) {
    req.logger?.error('Auth me error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ==================== FCM DEVICE REGISTRY (Phase 3A) ====================
// Server-side push-token registry: POST/DELETE /api/devices. Registry ONLY —
// SENDING pushes requires firebase-admin + the owner's service credentials
// (deliberately out of scope; documented in the final report). Owner-only:
// a device row belongs to the authenticated user; there is no admin device
// access, and tokens are never returned to any client (creator's or admin's).
// Guests: excluded (requireRegistered) — pushes target real accounts.

// Upsert a push token for the caller: same (userId, token) refreshes
// lastSeenAt; new tokens are capped at MAX_DEVICES_PER_USER (lowest-priority
// = oldest lastSeenAt pruned first) so reinstalled phones can't balloon the
// table.
app.post('/api/devices', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    if (!token || typeof token !== 'string' || token.length < 20 || token.length > 512) {
      return res.status(400).json({ error: 'Valid device token required' });
    }
    const userId = req.user.id;

    const [device, created] = await Device.findOrCreate({
      where: { userId, token },
      defaults: { userId, token, platform: typeof platform === 'string' ? platform.slice(0, 32) : null },
    });
    if (!created) {
      // Re-registration: mark fresh.
      await device.update({ lastSeenAt: new Date() });
    }

    // Cap: keep the freshest MAX_DEVICES_PER_USER, evict the stalest.
    const count = await Device.count({ where: { userId } });
    let evicted = 0;
    if (count > MAX_DEVICES_PER_USER) {
      const stale = await Device.findAll({
        where: { userId },
        order: [['lastSeenAt', 'ASC']],
        limit: count - MAX_DEVICES_PER_USER,
      });
      if (stale.length) {
        await Device.destroy({ where: { id: stale.map((d) => d.id) } });
        evicted = stale.length;
      }
    }

    res.json({ registered: true, deviceId: device.id, evicted });
  } catch (err) {
    req.logger?.error('Device registration error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Logout / sign-out: remove THIS device token only (the one the client
// holds). Idempotent — deleting an already-deleted token is a 200.
app.delete('/api/devices', authenticate, requireRegistered, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Device token required' });
    }
    const destroyed = await Device.destroy({ where: { userId: req.user.id, token } });
    res.json({ removed: destroyed > 0 });
  } catch (err) {
    req.logger?.error('Device removal error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Removal failed' });
  }
});

// ==================== VIDEO ROUTES ====================

app.get('/api/videos/feed', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    
    // Get trending videos (20%) — capped so trending + sponsored can never
    // exceed the requested page size (previously uncapped, which let
    // `randomCount` below go negative for small `limit` values; Sequelize
    // passes a negative LIMIT straight through to SQLite, which treats a
    // negative LIMIT as "no limit at all" and silently returns every
    // published video instead of respecting pagination).
    const trendingCount = Math.min(limit - 1, Math.ceil(limit * 0.2));
    const trending = trendingCount > 0 ? await Video.findAll({
      where: { isPublished: true, isTrending: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: sequelize.random(),
      limit: trendingCount
    }) : [];
    
    // Get sponsored videos (10%) - one per batch, only if there's room left
    const sponsored = (limit - trending.length) > 0 ? await Video.findAll({
      where: { isPublished: true, isSponsored: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: sequelize.random(),
      limit: 1
    }) : [];
    
    // Get random videos (70%) — clamped to 0 so a small `limit` (e.g. 1)
    // combined with trending/sponsored results can never produce a negative
    // Sequelize `limit`.
    const randomCount = Math.max(0, limit - trending.length - sponsored.length);
    const randomVideos = randomCount > 0 ? await Video.findAll({
      where: { 
        isPublished: true,
        id: { [Op.notIn]: [...trending.map(v => v.id), ...sponsored.map(v => v.id)] }
      },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: sequelize.random(),
      limit: randomCount,
      offset
    }) : [];
    
    // Mix videos with sponsor every 8-10 videos
    let allVideos = shuffleArray([...randomVideos, ...trending]);
    
    if (sponsored.length > 0) {
      const sponsorIndex = Math.floor(Math.random() * 3) + 7; // Position 7-9
      if (sponsorIndex < allVideos.length) {
        allVideos.splice(sponsorIndex, 0, ...sponsored);
      } else {
        allVideos.push(...sponsored);
      }
    }
    
    // Batch-enrich all videos in 5-6 queries total (no N+1)
    const videosWithMeta = await attachVideoMeta(allVideos, req.user?.id || null);

    const activeAds = await Ad.findAll({
      where: { isActive: true },
      order: [['priority', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json({
      videos: videosWithMeta,
      ads: activeAds,
      page,
      hasMore: randomVideos.length === randomCount,
    });
  } catch (err) {
    req.logger?.error('Feed error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

app.get('/api/ads/active', authenticate, async (req, res) => {
  try {
    const ads = await Ad.findAll({
      where: { isActive: true },
      order: [['priority', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ads' });
  }
});

app.post('/api/ads/:id/view', authenticate, async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad || !ad.isActive) return res.status(404).json({ error: 'Ad not found' });
    ad.views += 1;
    await ad.save();
    res.json({ views: ad.views });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

app.post('/api/ads/:id/click', authenticate, async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad || !ad.isActive) return res.status(404).json({ error: 'Ad not found' });
    ad.clicks += 1;
    await ad.save();
    res.json({ clicks: ad.clicks, clickUrl: ad.clickUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record click' });
  }
});

app.get('/api/videos/:id', authenticate, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }]
    });
    
    if (!video || !video.isPublished) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    video.views += 1;
    await video.save();

    const [enriched] = await attachVideoMeta([video], req.user?.id || null);
    res.json(enriched);
  } catch (err) {
    req.logger?.error('Video error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load video' });
  }
});

app.post('/api/videos', authenticate, requireRegistered, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file required' });
    }
    
    const { title, description } = req.body;
    
    const video = await Video.create({
      userId: req.user.id,
      title: title || '',
      description: description || '',
      filename: req.file.filename,
      isPublished: true
    });
    
    // Mark user as creator
    if (!req.user.isCreator) {
      req.user.isCreator = true;
      await req.user.save();
      
      // Create points record if not exists
      const existingPoints = await Points.findOne({ where: { creatorId: req.user.id } });
      if (!existingPoints) {
        await Points.create({ creatorId: req.user.id, totalPoints: 0, lifetimePoints: 0 });
      }
    }
    
    // Media pipeline (fire-and-forget, never blocks/fails the response):
    // object-storage copy + transcode enqueue for this video.
    persistUploadToStorage(req.file.filename);
    enqueueTranscode(req.file.filename);

    res.json(video);
  } catch (err) {
    req.logger?.error('Upload error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ==================== INTERACTION ROUTES ====================

app.post('/api/videos/:id/like', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    const existing = await Like.findOne({ where: { userId: req.user.id, videoId: video.id } });
    
    if (existing) {
      await existing.destroy();
      const likeCount = await Like.count({ where: { videoId: video.id } });
      return res.json({ liked: false, likeCount });
    }
    
    await Like.create({ userId: req.user.id, videoId: video.id });
    const likeCount = await Like.count({ where: { videoId: video.id } });
    res.json({ liked: true, likeCount });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const likeCount = await Like.count({ where: { videoId: req.params.id } });
      return res.json({ liked: true, likeCount });
    }
    req.logger?.error('Like error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Like failed' });
  }
});

app.post('/api/videos/:id/save', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const existing = await VideoSave.findOne({ where: { userId: req.user.id, videoId: video.id } });
    if (existing) {
      await existing.destroy();
      return res.json({ saved: false });
    }

    await VideoSave.create({ userId: req.user.id, videoId: video.id });
    res.json({ saved: true });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.json({ saved: true });
    }
    req.logger?.error('Save error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Save failed' });
  }
});

app.post('/api/videos/:id/repost', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const existing = await VideoRepost.findOne({ where: { userId: req.user.id, videoId: video.id } });
    if (existing) {
      await existing.destroy();
      const repostCount = await VideoRepost.count({ where: { videoId: video.id } });
      return res.json({ reposted: false, repostCount });
    }

    await VideoRepost.create({ userId: req.user.id, videoId: video.id });
    const repostCount = await VideoRepost.count({ where: { videoId: video.id } });
    res.json({ reposted: true, repostCount });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const repostCount = await VideoRepost.count({ where: { videoId: req.params.id } });
      return res.json({ reposted: true, repostCount });
    }
    req.logger?.error('Repost error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Repost failed' });
  }
});

app.post('/api/videos/:id/star', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (!video.isPublished) return res.status(403).json({ error: 'Video is not published' });

    if (video.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot star your own video' });
    }

    const amount = Math.max(1, Math.min(100, parseInt(req.body.amount, 10) || 1));
    const coinCost = amount * STAR_COINS_PER_UNIT;

    await getOrCreateWallet(req.user.id);

    const txResult = await sequelize.transaction(async (t) => {
      const existing = await Star.findOne({
        where: { userId: req.user.id, videoId: video.id },
        transaction: t,
      });
      if (existing) {
        return { error: 'Already starred this video', status: 400 };
      }

      const wallet = await Wallet.findOne({
        where: { userId: req.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!wallet || wallet.coins < coinCost) {
        return {
          error: 'Not enough coins',
          status: 402,
          coins: wallet?.coins ?? 0,
          required: coinCost,
        };
      }

      wallet.coins -= coinCost;
      await wallet.save({ transaction: t });

      await Star.create(
        {
          userId: req.user.id,
          creatorId: video.userId,
          videoId: video.id,
          amount,
        },
        { transaction: t }
      );

      let creatorPoints = await Points.findOne({
        where: { creatorId: video.userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!creatorPoints) {
        creatorPoints = await Points.create(
          {
            creatorId: video.userId,
            totalPoints: coinCost,
            lifetimePoints: coinCost,
          },
          { transaction: t }
        );
      } else {
        creatorPoints.totalPoints += coinCost;
        creatorPoints.lifetimePoints += coinCost;
        await creatorPoints.save({ transaction: t });
      }

      const starCount = (await Star.sum('amount', { where: { videoId: video.id }, transaction: t })) || 0;
      return { starCount, creatorPoints, coinsRemaining: wallet.coins };
    });

    if (txResult?.error) {
      if (txResult.status === 400) {
        const starCount = await Star.sum('amount', { where: { videoId: video.id } }) || 0;
        return res.status(400).json({ error: txResult.error, starCount });
      }
      return res.status(txResult.status || 402).json({
        error: txResult.error,
        coins: txResult.coins,
        required: txResult.required,
      });
    }

    const { starCount, creatorPoints, coinsRemaining } = txResult;

    res.json({
      starred: true,
      starCount,
      coinsSpent: coinCost,
      coinsRemaining,
      pointsAwarded: coinCost,
      creatorTotalPoints: creatorPoints.totalPoints,
    });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const starCount = await Star.sum('amount', { where: { videoId: req.params.id } }) || 0;
      return res.status(400).json({ error: 'Already starred this video', starCount });
    }
    req.logger?.error('Star error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Star failed' });
  }
});

app.post('/api/users/:id/follow', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    const existing = await Follow.findOne({
      where: { followerId: req.user.id, followingId: req.params.id }
    });
    
    if (existing) {
      await existing.destroy();
      const followerCount = await Follow.count({ where: { followingId: req.params.id } });
      return res.json({ following: false, followerCount });
    }
    
    await Follow.create({ followerId: req.user.id, followingId: req.params.id });
    const followerCount = await Follow.count({ where: { followingId: req.params.id } });
    res.json({ following: true, followerCount });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const followerCount = await Follow.count({ where: { followingId: req.params.id } });
      return res.json({ following: true, followerCount });
    }
    req.logger?.error('Follow error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Follow failed' });
  }
});

// ==================== COMMENT ROUTES ====================

app.get('/api/videos/:id/comments', authenticate, async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { videoId: req.params.id, parentId: null },
      include: [
        { model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] },
        {
          model: Comment,
          as: 'replies',
          include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }]
        }
      ],
      order: [['createdAt', 'DESC'], [{ model: Comment, as: 'replies' }, 'createdAt', 'ASC']]
    });
    
    res.json(comments);
  } catch (err) {
    req.logger?.error('Comments error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.post('/api/videos/:id/comments', authenticate, requireRegistered, commentRateLimit, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    const normalizedContent = normalizeCommentContent(content);

    if (!normalizedContent) {
      return res.status(400).json({ error: 'Comment content required' });
    }
    if (normalizedContent.length > 280) {
      return res.status(400).json({ error: 'Comment must be 280 characters or less' });
    }
    
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    if (parentId) {
      const parent = await Comment.findByPk(parentId);
      if (!parent || parent.videoId !== video.id) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }
    
    const duplicateWindowStart = new Date(Date.now() - 8000);
    const duplicate = await Comment.findOne({
      where: {
        userId: req.user.id,
        videoId: video.id,
        parentId: parentId || null,
        content: normalizedContent,
        createdAt: { [Op.gte]: duplicateWindowStart },
      },
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });

    if (duplicate) {
      return res.status(409).json({ error: 'Duplicate comment detected. Please wait a moment.', comment: duplicate });
    }

    const comment = await Comment.create({
      userId: req.user.id,
      videoId: video.id,
      parentId: parentId || null,
      content: normalizedContent
    });
    
    const commentWithAuthor = await Comment.findByPk(comment.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }]
    });
    
    res.json(commentWithAuthor);
  } catch (err) {
    req.logger?.error('Comment error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ==================== USER PROFILE ROUTES ====================

app.get('/api/users/search', authenticate, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const users = await User.findAll({
      where: {
        isBanned: false,
        isGuest: false,
        // Never offer the caller their own account (used by DM / group pickers).
        ...(req.user?.id ? { id: { [Op.ne]: req.user.id } } : {}),
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { displayName: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'username', 'displayName', 'avatar'],
      limit,
    });
    res.json(users);
  } catch (err) {
    req.logger?.error('User search error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'displayName', 'avatar', 'coverImage', 'bio', 'isCreator', 'isAdmin', 'createdAt']
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const videoCount = await Video.count({ where: { userId: user.id, isPublished: true } });
    const followerCount = await Follow.count({ where: { followingId: user.id } });
    const followingCount = await Follow.count({ where: { followerId: user.id } });
    const points = await Points.findOne({ where: { creatorId: user.id } });

    let isFollowing = false;
    let isSubscribed = false;
    if (req.user) {
      isFollowing = await Follow.findOne({
        where: { followerId: req.user.id, followingId: user.id }
      }) !== null;
      isSubscribed = await Subscription.findOne({
        where: { subscriberId: req.user.id, creatorId: user.id, expiresAt: { [Op.gt]: new Date() } }
      }) !== null;
    }

    const subscriberCount = await Subscription.count({
      where: { creatorId: user.id, expiresAt: { [Op.gt]: new Date() } }
    });

    const payload = {
      ...user.toJSON(),
      videoCount,
      followerCount,
      followingCount,
      subscriberCount,
      totalPoints: points?.totalPoints || 0,
      isFollowing,
      isSubscribed,
    };

    if (req.user?.isAdmin) {
      payload.isBanned = user.isBanned;
    }

    res.json(payload);
  } catch (err) {
    req.logger?.error('User error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// Update the current user's own profile — real photos only, no default avatars.
app.patch('/api/users/me', authenticate, requireRegistered, imageUpload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]), async (req, res) => {
  try {
    const { displayName, bio } = req.body;
    if (displayName !== undefined) req.user.displayName = displayName.trim().slice(0, 60);
    if (bio !== undefined) req.user.bio = bio.trim().slice(0, 200);
    if (req.files?.avatar?.[0]) {
      req.user.avatar = `/storage/uploads/${req.files.avatar[0].filename}`;
      persistUploadToStorage(req.files.avatar[0].filename);
    }
    if (req.files?.cover?.[0]) {
      req.user.coverImage = `/storage/uploads/${req.files.cover[0].filename}`;
      persistUploadToStorage(req.files.cover[0].filename);
    }
    await req.user.save();

    res.json({
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatar: req.user.avatar,
      coverImage: req.user.coverImage,
      bio: req.user.bio,
    });
  } catch (err) {
    req.logger?.error('Profile update error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== WALLET / GIFTS / SUBSCRIPTIONS ====================

const GIFT_CATALOG = {
  rose: { coins: 10, char: '🌹', label: 'Rose' },
  gem: { coins: 50, char: '💎', label: 'Gem' },
  crown: { coins: 200, char: '👑', label: 'Crown' },
  star: { coins: 500, char: '🌟', label: 'Supernova' },
};
const SUBSCRIPTION_COST_PER_MONTH = 500;
// Each star unit costs coins and awards the same amount to creator points (was free — exploit).
const STAR_COINS_PER_UNIT = 10;

async function getOrCreateWallet(userId) {
  const [wallet] = await Wallet.findOrCreate({ where: { userId }, defaults: { userId, coins: 500 } });
  return wallet;
}

app.get('/api/wallet/me', authenticate, requireAuth, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user.id);
    res.json({ coins: wallet.coins, giftCatalog: GIFT_CATALOG, stripeEnabled: STRIPE_ENABLED });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load wallet' });
  }
});

// Top up coins. In dev mode (no Stripe keys configured) coins are granted
// instantly so the gifting/subscription economy is fully testable. Once
// STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are set, this creates a real
// Checkout session instead and coins are granted by the webhook above.
app.post('/api/wallet/topup', authenticate, requireRegistered, async (req, res) => {
  try {
    const coins = Math.min(10000, Math.max(1, parseInt(req.body.coins, 10) || 0));
    if (!coins) return res.status(400).json({ error: 'coins must be a positive number' });

    if (STRIPE_ENABLED) {
      const priceUsd = (coins / 100).toFixed(2); // 100 coins = $1
      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `${coins} iKHWEZI Coins` },
            unit_amount: Math.round(priceUsd * 100),
          },
          quantity: 1,
        }],
        metadata: { userId: req.user.id, coins: String(coins) },
        success_url: `${FRONTEND_URL}/profile/${req.user.id}?topup=success`,
        cancel_url: `${FRONTEND_URL}/profile/${req.user.id}?topup=cancelled`,
      });
      return res.json({ checkoutUrl: session.url, devMode: false });
    }

    // Dev-mode instant grant — blocked in production to prevent free unlimited coins.
    if (IS_PRODUCTION) {
      return res.status(503).json({ error: 'Payment processor not configured' });
    }

    const wallet = await getOrCreateWallet(req.user.id);
    wallet.coins += coins;
    await wallet.save();
    res.json({ coins: wallet.coins, devMode: true });
  } catch (err) {
    req.logger?.error('Wallet topup error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to top up wallet' });
  }
});

// Send a gift — spends coins, credits the recipient's creator points, and
// broadcasts the moment in real-time (used by the Live chat + DM gift button).
app.post('/api/wallet/gift', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const { toUserId, giftId, roomId } = req.body;
    const gift = GIFT_CATALOG[giftId];
    if (!gift) return res.status(400).json({ error: 'Unknown gift' });
    if (!toUserId || toUserId === req.user.id) return res.status(400).json({ error: 'Invalid recipient' });

    const recipient = await User.findByPk(toUserId);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    await getOrCreateWallet(req.user.id);

    const txResult = await sequelize.transaction(async (t) => {
      const wallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (!wallet || wallet.coins < gift.coins) {
        return { error: 'Not enough coins', status: 402, coins: wallet?.coins ?? 0, required: gift.coins };
      }
      wallet.coins -= gift.coins;
      await wallet.save({ transaction: t });

      let creatorPoints = await Points.findOne({ where: { creatorId: toUserId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!creatorPoints) {
        creatorPoints = await Points.create(
          { creatorId: toUserId, totalPoints: gift.coins, lifetimePoints: gift.coins },
          { transaction: t }
        );
      } else {
        creatorPoints.totalPoints += gift.coins;
        creatorPoints.lifetimePoints += gift.coins;
        await creatorPoints.save({ transaction: t });
      }

      await GiftLog.create(
        { fromUserId: req.user.id, toUserId, giftId, coins: gift.coins, roomId: roomId || null },
        { transaction: t }
      );

      return { wallet };
    });

    if (txResult?.error) {
      return res.status(txResult.status || 402).json({
        error: txResult.error,
        coins: txResult.coins,
        required: txResult.required,
      });
    }

    const { wallet } = txResult;

    const payload = {
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      toUserId,
      giftId,
      char: gift.char,
      label: gift.label,
      coins: gift.coins,
      timestamp: new Date(),
    };
    io.to(`user_${toUserId}`).emit('gift-received', payload);
    if (roomId) io.to(roomId).emit('gift-received', payload);

    res.json({ sent: true, coinsRemaining: wallet.coins, ...payload });
  } catch (err) {
    req.logger?.error('Gift error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Live gifts always target the current broadcasting admin — resolved
// server-side so the client never has to (and can't spoof) the recipient.
app.post('/api/live/gift', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const { giftId } = req.body;
    const gift = GIFT_CATALOG[giftId];
    if (!gift) return res.status(400).json({ error: 'Unknown gift' });

    const admin = await resolveLiveHostUser();
    if (!admin) return res.status(404).json({ error: 'No live host configured' });
    if (admin.id === req.user.id) return res.status(400).json({ error: 'Cannot gift yourself' });

    await getOrCreateWallet(req.user.id);

    const result = await sequelize.transaction(async (t) => {
      const wallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (!wallet || wallet.coins < gift.coins) {
        return { error: 'Not enough coins', status: 402, coins: wallet?.coins ?? 0, required: gift.coins };
      }
      wallet.coins -= gift.coins;
      await wallet.save({ transaction: t });

      let creatorPoints = await Points.findOne({ where: { creatorId: admin.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (!creatorPoints) {
        creatorPoints = await Points.create(
          { creatorId: admin.id, totalPoints: gift.coins, lifetimePoints: gift.coins },
          { transaction: t }
        );
      } else {
        creatorPoints.totalPoints += gift.coins;
        creatorPoints.lifetimePoints += gift.coins;
        await creatorPoints.save({ transaction: t });
      }

      await GiftLog.create(
        { fromUserId: req.user.id, toUserId: admin.id, giftId, coins: gift.coins, roomId: 'live-stream' },
        { transaction: t }
      );

      return { wallet, admin };
    });

    if (result?.error) {
      return res.status(result.status || 402).json({
        error: result.error,
        coins: result.coins,
        required: result.required,
      });
    }

    const { wallet, admin: host } = result;
    const payload = {
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      toUserId: host.id,
      giftId,
      char: gift.char,
      label: gift.label,
      coins: gift.coins,
      timestamp: new Date(),
    };
    io.to('live-stream').emit('gift-received', payload);
    io.to(`user_${host.id}`).emit('gift-received', payload);

    res.json({ sent: true, coinsRemaining: wallet.coins, ...payload });
  } catch (err) {
    req.logger?.error('Live gift error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

app.get('/api/users/:id/subscription', authenticate, requireAuth, async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      where: { subscriberId: req.user.id, creatorId: req.params.id, expiresAt: { [Op.gt]: new Date() } },
      order: [['expiresAt', 'DESC']],
    });
    res.json({ active: !!sub, expiresAt: sub?.expiresAt || null, tier: sub?.tier || null, costPerMonth: SUBSCRIPTION_COST_PER_MONTH });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load subscription' });
  }
});

app.post('/api/users/:id/subscribe', authenticate, requireRegistered, async (req, res) => {
  try {
    const creatorId = req.params.id;
    if (creatorId === req.user.id) return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    const creator = await User.findByPk(creatorId);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const months = Math.max(1, parseInt(req.body.months) || 1);
    const cost = SUBSCRIPTION_COST_PER_MONTH * months;

    const txResult = await sequelize.transaction(async (t) => {
      await getOrCreateWallet(req.user.id);
      const wallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (!wallet || wallet.coins < cost) {
        return { error: 'Not enough coins', status: 402, coins: wallet?.coins ?? 0, required: cost };
      }
      wallet.coins -= cost;
      await wallet.save({ transaction: t });

      const existing = await Subscription.findOne({
        where: { subscriberId: req.user.id, creatorId, expiresAt: { [Op.gt]: new Date() } },
        transaction: t,
      });
      const base = existing ? new Date(existing.expiresAt) : new Date();
      const expiresAt = new Date(base);
      expiresAt.setMonth(expiresAt.getMonth() + months);

      let sub;
      if (existing) {
        existing.expiresAt = expiresAt;
        await existing.save({ transaction: t });
        sub = existing;
      } else {
        sub = await Subscription.create({ subscriberId: req.user.id, creatorId, expiresAt }, { transaction: t });
      }

      let creatorPoints = await Points.findOne({ where: { creatorId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!creatorPoints) {
        creatorPoints = await Points.create(
          { creatorId, totalPoints: cost, lifetimePoints: cost },
          { transaction: t }
        );
      } else {
        creatorPoints.totalPoints += cost;
        creatorPoints.lifetimePoints += cost;
        await creatorPoints.save({ transaction: t });
      }

      return { sub, wallet };
    });

    if (txResult?.error) {
      return res.status(txResult.status || 402).json({
        error: txResult.error,
        coins: txResult.coins,
        required: txResult.required,
      });
    }

    const { sub, wallet } = txResult;

    io.to(`user_${creatorId}`).emit('new-subscriber', {
      subscriberId: req.user.id,
      username: req.user.username,
      months,
      timestamp: new Date(),
    });

    res.json({ subscribed: true, expiresAt: sub.expiresAt, coinsRemaining: wallet.coins });
  } catch (err) {
    req.logger?.error('Subscribe error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

app.get('/api/users/:id/videos', authenticate, async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: { userId: req.params.id, isPublished: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']]
    });

    const videosWithMeta = await attachVideoMeta(videos, req.user?.id || null);
    res.json(videosWithMeta);
  } catch (err) {
    req.logger?.error('User videos error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load videos' });
  }
});

// ==================== LIVE STREAMING ROUTES ====================

app.get('/api/live/status', async (req, res) => {
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({
        streamKey: uuidv4(),
        isLive: false,
        viewerCount: 0
      });
    }
    
    res.json({
      isLive: liveStatus.isLive,
      title: liveStatus.title,
      viewerCount: liveStatus.viewerCount,
      startedAt: liveStatus.startedAt,
      hlsUrl: liveStatus.isLive ? buildPublicHlsUrl(liveStatus.streamKey) : null,
    });
  } catch (err) {
    req.logger?.error('Live status error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to get live status' });
  }
});

app.post('/api/live/join', authenticate, async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      const viewerCount = await incrementViewerCount(liveStatus);
      io.emit('viewer-count', { viewerCount });
      res.json({ viewerCount });
    } else {
      res.json({ viewerCount: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to join live' });
  }
});

app.post('/api/live/leave', authenticate, async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      const viewerCount = await decrementViewerCount(liveStatus);
      io.emit('viewer-count', { viewerCount });
      res.json({ viewerCount });
    } else {
      res.json({ viewerCount: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave live' });
  }
});

// ==================== STORY ROUTES ====================

// GET /api/stories — grouped by user, each with their active stories
app.get('/api/stories', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const stories = await Story.findAll({
      where: { expiresAt: { [Op.gt]: now } },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] },
        { model: StoryView, as: 'views', attributes: ['viewerId'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    const storyIds = stories.map((story) => story.id);
    const commentCounts = storyIds.length
      ? await StoryComment.findAll({
          attributes: [
            'storyId',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          where: { storyId: storyIds },
          group: ['storyId'],
          raw: true,
        })
      : [];
    const commentCountByStoryId = new Map(
      commentCounts.map((entry) => [entry.storyId, Number(entry.count) || 0])
    );

    // Group by userId
    const grouped = {};
    for (const story of stories) {
      const uid = story.userId;
      if (!grouped[uid]) {
        grouped[uid] = {
          user: story.creator,
          stories: [],
          hasUnviewed: false,
        };
      }
      const viewerIds = story.views.map(v => v.viewerId);
      const viewed = req.user ? viewerIds.includes(req.user.id) : false;
      grouped[uid].stories.push({
        id: story.id,
        type: story.type,
        url: story.url,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewCount: story.views.length,
        commentCount: commentCountByStoryId.get(story.id) || 0,
        viewed,
      });
      if (!viewed) grouped[uid].hasUnviewed = true;
    }

    // Sort: unviewed first, then own profile
    const result = Object.values(grouped).sort((a, b) => {
      if (req.user) {
        const aOwn = a.user.id === req.user.id ? -1 : 0;
        const bOwn = b.user.id === req.user.id ? -1 : 0;
        if (aOwn !== bOwn) return aOwn - bOwn;
      }
      return (b.hasUnviewed ? 1 : 0) - (a.hasUnviewed ? 1 : 0);
    });

    res.json(result);
  } catch (err) {
    req.logger?.error('Stories fetch error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

app.post('/api/stories', authenticate, requireRegistered, storyUpload.single('story'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Story file required' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.webm', '.avi'].includes(ext);
    const { caption } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      userId: req.user.id,
      type: isVideo ? 'video' : 'image',
      url: `/storage/uploads/${req.file.filename}`,
      caption: caption || '',
      expiresAt,
    });

    // Media pipeline (fire-and-forget, never blocks/fails the response).
    persistUploadToStorage(req.file.filename);

    const full = await Story.findByPk(story.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
    });
    res.json(full);
  } catch (err) {
    req.logger?.error('Story creation error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to create story' });
  }
});

app.post('/api/stories/:id/view', authenticate, requireRegistered, async (req, res) => {
  // Phase 3A guest bloat reduction: story view-count rows are FK-bearing
  // writes; guests were the last un-gated writers. Now a registered-only
  // mutation (403 + 'Sign in to continue' for guests — the FE already
  // surfaces this). Viewers without a StoryView no longer inflate counts.
  try {
    const story = await Story.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (new Date() > story.expiresAt) return res.status(410).json({ error: 'Story expired' });

    // Only record once per viewer
    const existing = await StoryView.findOne({
      where: { storyId: story.id, viewerId: req.user.id },
    });
    if (!existing) {
      await StoryView.create({ storyId: story.id, viewerId: req.user.id });
    }
    const viewCount = await StoryView.count({ where: { storyId: story.id } });
    res.json({ viewed: true, viewCount });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const viewCount = await StoryView.count({ where: { storyId: req.params.id } });
      return res.json({ viewed: true, viewCount });
    }
    req.logger?.error('Story view error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to record view' });
  }
});

app.get('/api/stories/:id/comments', authenticate, async (req, res) => {
  try {
    const story = await Story.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (new Date() > story.expiresAt) return res.status(410).json({ error: 'Story expired' });

    const comments = await StoryComment.findAll({
      where: { storyId: story.id, parentId: null },
      include: [
        { model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] },
        {
          model: StoryComment,
          as: 'replies',
          include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }]
        }
      ],
      order: [['createdAt', 'DESC'], [{ model: StoryComment, as: 'replies' }, 'createdAt', 'ASC']]
    });

    res.json(comments);
  } catch (err) {
    req.logger?.error('Story comments error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.post('/api/stories/:id/comments', authenticate, requireRegistered, commentRateLimit, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    const normalizedContent = normalizeCommentContent(content);

    if (!normalizedContent) {
      return res.status(400).json({ error: 'Comment content required' });
    }
    if (normalizedContent.length > 280) {
      return res.status(400).json({ error: 'Comment must be 280 characters or less' });
    }

    const story = await Story.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (new Date() > story.expiresAt) return res.status(410).json({ error: 'Story expired' });

    if (parentId) {
      const parent = await StoryComment.findByPk(parentId);
      if (!parent || parent.storyId !== story.id) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    const duplicateWindowStart = new Date(Date.now() - 8000);
    const duplicate = await StoryComment.findOne({
      where: {
        userId: req.user.id,
        storyId: story.id,
        parentId: parentId || null,
        content: normalizedContent,
        createdAt: { [Op.gte]: duplicateWindowStart },
      },
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });

    if (duplicate) {
      return res.status(409).json({ error: 'Duplicate comment detected. Please wait a moment.', comment: duplicate });
    }

    const comment = await StoryComment.create({
      userId: req.user.id,
      storyId: story.id,
      parentId: parentId || null,
      content: normalizedContent
    });

    const commentWithAuthor = await StoryComment.findByPk(comment.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }]
    });

    res.json(commentWithAuthor);
  } catch (err) {
    req.logger?.error('Story comment error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

app.delete('/api/stories/:id', authenticate, requireRegistered, async (req, res) => {
  try {
    const story = await Story.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.userId !== req.user.id) return res.status(403).json({ error: 'Not your story' });

    // Delete file from disk
    const filePath = path.join(__dirname, 'storage/uploads', path.basename(story.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await StoryComment.destroy({ where: { storyId: story.id } });
    await StoryView.destroy({ where: { storyId: story.id } });
    await story.destroy();
    res.json({ deleted: true });
  } catch (err) {
    req.logger?.error('Story delete error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// ==================== CHALLENGE ROUTES ====================

app.get('/api/challenges', authenticate, async (req, res) => {
  try {
    const challenges = await Challenge.findAll({
      where: { isActive: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(challenges);
  } catch (err) {
    req.logger?.error('Challenges fetch error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

app.post('/api/challenges', authenticate, requireRegistered, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const hashtag = String(req.body.hashtag || '').trim().replace(/^#/, '');
    if (!title || !hashtag) {
      return res.status(400).json({ error: 'Title and hashtag are required' });
    }

    const challenge = await Challenge.create({
      title,
      description,
      hashtag,
      createdBy: req.user.id
    });
    
    res.json(challenge);
  } catch (err) {
    req.logger?.error('Challenge creation error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// ==================== ADMIN ROUTES ====================
// Phase 3A: these routes authorize via per-user roles (RBAC) — a logged-in
// admin account's JWT. The old shared x-admin-key flow is retired from the
// frontend; the key survives ONLY in the bootstrap grant + the ban-toggle
// transition guard during the migration window (see middleware/rbac.js).

// Session probe for the admin panel: confirms the caller's JWT carries an
// admin/moderator role (DB-checked). Response includes the role so the FE
// can render moderator-appropriate UI.
app.post('/api/admin/verify', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    await logAudit('ADMIN_LOGIN', { success: true, role: req.user.role, userId: req.user.id }, req.ip);
  } catch (err) {
    req.logger?.error('Admin audit log failed', { error: err?.message || String(err) });
  }
  res.json({ valid: true, role: req.user.role });
});

// ONE-TIME ADMIN BOOTSTRAP (Phase 3A). The only remaining privileged use of
// the shared ADMIN_KEY: promote the FIRST accountable admin account.
// Operators run this once (curl with x-admin-key), log in as that admin,
// then set ADMIN_KEY_ENABLED=false - after which this route 501s and the
// key is dead code. No session needed: deliberate ops-key auth.
// Rate-limited: the key is checked here, so volume brute-force must not be
// possible even though the comparison is constant-time.
app.post('/api/admin/bootstrap/grant', authRateLimit, async (req, res) => {
  if (!ADMIN_KEY_ENABLED) {
    return res.status(501).json({ error: 'Admin key disabled - bootstrap via an existing admin account' });
  }
  if (!adminKeyMatches(req.headers['x-admin-key'])) {
    // Constant-time compare (rbac adminKeyMatches) + rate limit above.
    return res.status(403).json({ error: 'Bootstrap key rejected' });
  }
  try {
    const { userId } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId required' });
    }
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isBanned) return res.status(400).json({ error: 'Cannot grant admin to a banned account' });
    if (user.role === 'admin') {
      return res.json({ alreadyAdmin: true, userId: user.id });
    }
    await user.update({ role: 'admin', isAdmin: true });
    await logAudit('ADMIN_BOOTSTRAP_GRANT', { userId: user.id, username: user.username }, req.ip);
    req.logger?.warn('[ADMIN BOOTSTRAP] granted admin role via shared key - now set ADMIN_KEY_ENABLED=false.');
    res.json({ granted: true, userId: user.id });
  } catch (err) {
    req.logger?.error('Bootstrap grant error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Bootstrap failed' });
  }
});

app.get('/api/admin/stream-key', authenticate, requireRole('admin'), async (req, res) => {
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({ streamKey: uuidv4(), isLive: false });
    }
    const ingest = buildRtmpIngestInfo(liveStatus.streamKey);
    res.json({
      streamKey: ingest.streamKey,
      isLive: liveStatus.isLive,
      rtmpServer: ingest.rtmpServer,
      rtmpPublishUrl: ingest.rtmpPublishUrl,
      hlsPlaybackUrl: buildPublicHlsUrl(liveStatus.streamKey),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stream key' });
  }
});

app.post('/api/admin/stream-key/rotate', authenticate, requireRole('admin'), async (req, res) => {
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({ streamKey: uuidv4(), isLive: false });
    } else {
      liveStatus.streamKey = uuidv4();
      await liveStatus.save();
    }
    await logAudit('STREAM_KEY_ROTATED', {}, req.ip);
    const ingest = buildRtmpIngestInfo(liveStatus.streamKey);
    res.json({
      streamKey: ingest.streamKey,
      rtmpServer: ingest.rtmpServer,
      rtmpPublishUrl: ingest.rtmpPublishUrl,
      hlsPlaybackUrl: buildPublicHlsUrl(liveStatus.streamKey),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rotate stream key' });
  }
});

// ==================== DIRECT MESSAGES ====================
// Extracted to ./routes/messages.js (same API surface, receiver validation added).
require('./routes/messages').buildMessageRoutes({
  app, io, sequelize, Op, User, DirectMessage, authenticate, requireRegistered, interactionRateLimit,
});

// ==================== TEXT POSTS ====================

app.get('/api/posts', authenticate, async (req, res) => {
  try {
    // Unvalidated page/limit previously let a non-numeric or out-of-range
    // query string (e.g. ?limit=abc or ?limit=999999999) reach Sequelize as
    // NaN or an unbounded value — NaN made SQLite throw (surfaced as a
    // generic 500), and a huge limit had no upper bound at all. Clamped the
    // same way `/api/videos/feed` already does.
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const posts = await TextPost.findAll({
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    let liked = new Set();
    if (req.user) {
      const myLikes = await PostLike.findAll({ where: { userId: req.user.id, postId: posts.map((p) => p.id) } });
      liked = new Set(myLikes.map((l) => l.postId));
    }
    res.json(posts.map((p) => ({ ...p.toJSON(), isLiked: liked.has(p.id) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

app.post('/api/posts/:id/like', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
  try {
    const post = await TextPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await PostLike.findOne({ where: { userId: req.user.id, postId: post.id } });
    if (existing) {
      await existing.destroy();
      post.likeCount = Math.max(0, post.likeCount - 1);
      await post.save();
      return res.json({ liked: false, likeCount: post.likeCount });
    }

    await PostLike.create({ userId: req.user.id, postId: post.id });
    post.likeCount += 1;
    await post.save();
    res.json({ liked: true, likeCount: post.likeCount });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const post = await TextPost.findByPk(req.params.id);
      return res.json({ liked: true, likeCount: post?.likeCount || 0 });
    }
    req.logger?.error('Post like error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Like failed' });
  }
});

app.post('/api/posts', authenticate, requireRegistered, async (req, res) => {
  try {
    const { content, backgroundColor, textColor, fontStyle } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    if (content.trim().length > 500) return res.status(400).json({ error: 'Max 500 characters' });
    const post = await TextPost.create({
      userId: req.user.id,
      content: content.trim(),
      backgroundColor: backgroundColor || '#1a1a2e',
      textColor: textColor || '#ffffff',
      fontStyle: fontStyle || 'normal',
    });
    const withAuthor = await TextPost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
    });
    res.status(201).json(withAuthor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.delete('/api/posts/:id', authenticate, requireRegistered, async (req, res) => {
  try {
    const post = await TextPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await post.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ==================== VIDEO EDIT ====================

app.put('/api/videos/:id', authenticate, requireRegistered, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { title, description, caption } = req.body;
    const nextDescription = caption !== undefined
      ? String(caption).trim()
      : description !== undefined
        ? String(description).trim()
        : undefined;
    await video.update({
      ...(title !== undefined && { title: title.trim() }),
      ...(nextDescription !== undefined && { description: nextDescription }),
    });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update video' });
  }
});

app.delete('/api/videos/:id', authenticate, requireRegistered, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const filePath = path.join(__dirname, 'storage/uploads', video.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await video.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Auto-triggered by nginx-rtmp when OBS starts streaming
app.post('/api/live/on-publish', webhookRateLimit, async (req, res) => {
  if (!requireRtmpWebhook(req, res)) return;
  try {
    const publishedName = (req.body?.name || req.query?.name || '').trim();
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({
        streamKey: publishedName || uuidv4(),
        isLive: true,
        title: 'Live Stream',
        startedAt: new Date(),
        viewerCount: 0,
      });
      await assignLiveHost(liveStatus);
      await liveStatus.save();
    } else {
      if (publishedName && liveStatus.streamKey !== publishedName) {
        req.logger?.warn('Rejected RTMP publish: key mismatch', { expected: liveStatus.streamKey, got: publishedName });
        // nginx-rtmp treats non-2xx as publish rejection — 403 stops wrong-key ingest
        return res.status(403).send('Invalid stream key');
      }
      if (publishedName && !liveStatus.streamKey) {
        liveStatus.streamKey = publishedName;
      }
      liveStatus.isLive = true;
      liveStatus.startedAt = new Date();
      liveStatus.viewerCount = 0;
      if (!liveStatus.title) liveStatus.title = 'Live Stream';
      await assignLiveHost(liveStatus);
      await liveStatus.save();
    }
    emitLiveStarted(liveStatus);
    req.logger?.info('Stream started via on_publish', { streamKey: liveStatus.streamKey });
    res.status(200).send('OK');
  } catch (err) {
    req.logger?.error('on_publish error', { error: err?.message || String(err) });
    res.status(200).send('OK'); // Always 200 or nginx-rtmp will reject the stream
  }
});

// Auto-triggered by nginx-rtmp when OBS stops streaming
app.post('/api/live/on-publish-done', webhookRateLimit, async (req, res) => {
  if (!requireRtmpWebhook(req, res)) return;
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      liveStatus.isLive = false;
      liveStatus.viewerCount = 0;
      await liveStatus.save();
    }
    emitLiveStopped();
    req.logger?.info('Stream ended via on_publish_done');
    res.status(200).send('OK');
  } catch (err) {
    req.logger?.error('on_publish_done error', { error: err?.message || String(err) });
    res.status(200).send('OK');
  }
});

app.post('/api/admin/live/start', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { title } = req.body;
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({
        streamKey: uuidv4(),
        isLive: true,
        title: title || 'Live Stream',
        startedAt: new Date(),
        viewerCount: 0
      });
      await assignLiveHost(liveStatus);
      await liveStatus.save();
    } else {
      liveStatus.isLive = true;
      liveStatus.title = title || 'Live Stream';
      liveStatus.startedAt = new Date();
      liveStatus.viewerCount = 0;
      await assignLiveHost(liveStatus);
      await liveStatus.save();
    }
    
    await logAudit('LIVE_STARTED', { title }, req.ip);
    emitLiveStarted(liveStatus);
    const ingest = buildRtmpIngestInfo(liveStatus.streamKey);
    res.json({
      success: true,
      isLive: true,
      hlsUrl: buildPublicHlsUrl(liveStatus.streamKey),
      rtmpServer: ingest.rtmpServer,
      streamKey: ingest.streamKey,
      rtmpPublishUrl: ingest.rtmpPublishUrl,
      hlsPlaybackUrl: buildPublicHlsUrl(liveStatus.streamKey),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start live' });
  }
});

app.post('/api/admin/live/stop', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      liveStatus.isLive = false;
      liveStatus.viewerCount = 0;
      liveStatus.startedAt = null;
      await liveStatus.save();
    }
    await logAudit('LIVE_STOPPED', {}, req.ip);
    emitLiveStopped();
    res.json({ success: true, isLive: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop live' });
  }
});

app.post('/api/admin/videos', authenticate, requireRole('admin'), upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file required' });
    }
    
    const { title, description, isSponsored, isTrending } = req.body;
    
    // Create admin user if not exists
    let adminUser = await User.findOne({ where: { username: 'ikhwezi_admin' } });
    if (!adminUser) {
      adminUser = await User.create({
        username: 'ikhwezi_admin',
        displayName: 'iKHWEZI',
        password: await bcrypt.hash(uuidv4(), 10),
        isCreator: true
      });
      await Points.create({ creatorId: adminUser.id, totalPoints: 0, lifetimePoints: 0 });
    }
    
    const video = await Video.create({
      userId: adminUser.id,
      title: title || '',
      description: description || '',
      filename: req.file.filename,
      isPublished: true,
      isSponsored: isSponsored === 'true',
      isTrending: isTrending === 'true'
    });
    
    await logAudit('VIDEO_UPLOADED', { videoId: video.id, title }, req.ip);
    res.json(video);
  } catch (err) {
    req.logger?.error('Admin upload error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/admin/videos', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const videos = await Video.findAll({
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load videos' });
  }
});

app.patch('/api/admin/videos/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    const { isPublished, isSponsored, isTrending, title, description } = req.body;
    
    if (isPublished !== undefined) video.isPublished = isPublished;
    if (isSponsored !== undefined) video.isSponsored = isSponsored;
    if (isTrending !== undefined) video.isTrending = isTrending;
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    
    await video.save();
    await logAudit('VIDEO_UPDATED', { videoId: video.id, changes: req.body }, req.ip);
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update video' });
  }
});

app.delete('/api/admin/videos/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const filePath = path.join(__dirname, 'storage/uploads', video.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await video.destroy();
    await logAudit('VIDEO_DELETED', { videoId: req.params.id }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// ==================== ADMIN TAILORED ADS ====================

app.get('/api/admin/ads', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const ads = await Ad.findAll({ order: [['priority', 'DESC'], ['createdAt', 'DESC']] });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ads' });
  }
});

app.post('/api/admin/ads', authenticate, requireRole('admin'), adUpload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ad media file required' });

    const { title, caption, clickUrl, ctaLabel, placement, priority, isActive } = req.body;
    const mediaType = detectAdMediaType(req.file.filename);

    const ad = await Ad.create({
      title: title || '',
      caption: caption || '',
      filename: req.file.filename,
      mediaType,
      clickUrl: clickUrl || '',
      ctaLabel: ctaLabel || 'Learn more',
      placement: placement || 'feed',
      priority: parseInt(priority, 10) || 0,
      isActive: isActive !== 'false',
    });

    // Media pipeline (fire-and-forget, never blocks/fails the response).
    persistUploadToStorage(req.file.filename);

    await logAudit('AD_CREATED', { adId: ad.id, title: ad.title }, req.ip);
    res.json(ad);
  } catch (err) {
    req.logger?.error('Admin ad upload error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Ad upload failed' });
  }
});

app.patch('/api/admin/ads/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const { title, caption, clickUrl, ctaLabel, placement, priority, isActive } = req.body;
    if (title !== undefined) ad.title = title;
    if (caption !== undefined) ad.caption = caption;
    if (clickUrl !== undefined) ad.clickUrl = clickUrl;
    if (ctaLabel !== undefined) ad.ctaLabel = ctaLabel;
    if (placement !== undefined) ad.placement = placement;
    if (priority !== undefined) ad.priority = parseInt(priority, 10) || 0;
    if (isActive !== undefined) ad.isActive = !!isActive;

    await ad.save();
    await logAudit('AD_UPDATED', { adId: ad.id, changes: req.body }, req.ip);
    res.json(ad);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

app.delete('/api/admin/ads/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const filePath = path.join(__dirname, 'storage/uploads', ad.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ad.destroy();
    await logAudit('AD_DELETED', { adId: req.params.id }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

app.get('/api/admin/users', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'phone', 'username', 'displayName', 'isCreator', 'isAdmin', 'role', 'isBanned', 'lastActive', 'createdAt'],
      include: [{ model: Points, as: 'points', attributes: ['totalPoints', 'lifetimePoints'] }],
      order: [['createdAt', 'DESC']]
    });
    // Moderators get PII-free listings — email/phone are contact channels used
    // for account ops (admin-only), not ban decisions. Honest least-privilege.
    const redact = (u) => (req.user.role === 'admin' ? u : { ...u, email: null, phone: null });
    res.json(users.map((u) => ({ ...u.toJSON(), ...redact({ email: u.email, phone: u.phone }) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.patch('/api/admin/users/:id/ban', authenticate, requireModerationAccess, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.user && user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot block your own account' });
    }

    // Only a full admin (not a moderator) may ban another admin; the legacy
    // operator key keeps that power during transition (it always had it).
    if (user.role === 'admin' && req.user?.role !== 'admin' && !adminKeyMatches(req.headers['x-admin-key'])) {
      return res.status(403).json({ error: 'Only an admin can block another admin account' });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    await logAudit(user.isBanned ? 'USER_BANNED' : 'USER_UNBANNED', {
      userId: user.id,
      username: user.username,
      by: req.user?.id || 'legacy_admin_key',
    }, req.ip);
    res.json({ isBanned: user.isBanned });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Grant/revoke broadcast (Go Live) rights - the app's single-admin model:
// only the RBAC 'admin' role may broadcast. Phase 3A: gated by per-user
// role (logged-in admin), no longer the shared ADMIN_KEY. The legacy isAdmin
// BOOLEAN is kept in sync with role==='admin' so live-host resolution
// (resolveLiveHostUser/assignLiveHost) and older FE builds stay truthful.
app.patch('/api/admin/users/:id/admin', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own admin role here - ask another admin' });
    }
    if (user.isBanned) {
      return res.status(400).json({ error: 'Cannot grant admin to a banned account' });
    }

    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    // Single atomic update keeps role/isAdmin consistent even on crash.
    await user.update({ role: nextRole, isAdmin: nextRole === 'admin' });

    await logAudit(user.isAdmin ? 'USER_MADE_ADMIN' : 'USER_REVOKED_ADMIN', {
      userId: user.id, username: user.username, by: req.user.id,
    }, req.ip);
    res.json({ isAdmin: user.isAdmin, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/api/admin/analytics', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const totalUsers = await User.count();
    const newUsersToday = await User.count({ where: { createdAt: { [Op.gte]: dayAgo } } });
    const newUsersWeek = await User.count({ where: { createdAt: { [Op.gte]: weekAgo } } });
    const activeUsers = await User.count({ where: { lastActive: { [Op.gte]: dayAgo } } });
    const totalVideos = await Video.count();
    const totalViews = await Video.sum('views') || 0;
    const totalStars = await Star.sum('amount') || 0;
    const totalPoints = await Points.sum('totalPoints') || 0;
    
    // Top creators by points
    const topCreators = await Points.findAll({
      include: [{ model: User, attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['totalPoints', 'DESC']],
      limit: 10
    });
    
    // Activity by hour
    const hourlyActivity = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now - i * 60 * 60 * 1000);
      const hourEnd = new Date(now - (i - 1) * 60 * 60 * 1000);
      const count = await User.count({
        where: { lastActive: { [Op.between]: [hourStart, hourEnd] } }
      });
      hourlyActivity.push({ hour: hourStart.getHours(), count });
    }
    
    res.json({
      totalUsers,
      newUsersToday,
      newUsersWeek,
      activeUsers,
      totalVideos,
      totalViews,
      totalStars,
      totalPoints,
      topCreators,
      hourlyActivity
    });
  } catch (err) {
    req.logger?.error('Analytics error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

app.get('/api/admin/audit-log', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// ==================== HEALTH CHECKS (Phase 3B) ====================
// Liveness: always returns 200 with dependency status JSON.
app.get('/api/health', async (req, res) => {
  try {
    const result = await healthService.health();
    res.json(result);
  } catch (err) {
    req.logger?.error('health check failed', { error: err?.message || String(err) });
    // Never let the probe itself 500; report degraded honestly.
    res.status(503).json({ status: 'degraded', healthy: false, timestamp: new Date().toISOString(), error: 'health probe internal error' });
  }
});

// Readiness: 200 only when all required dependencies are healthy.
app.get('/api/ready', async (req, res) => {
  try {
    const { ok, result } = await healthService.ready();
    res.status(ok ? 200 : 503).json(result);
  } catch (err) {
    req.logger?.error('readiness check failed', { error: err?.message || String(err) });
    res.status(503).json({ status: 'degraded', healthy: false, timestamp: new Date().toISOString(), error: 'readiness probe internal error' });
  }
});

// Detailed dependency probe (same data, explicit URL for operators).
app.get('/api/health/dependencies', async (req, res) => {
  try {
    const result = await healthService.health();
    res.json(result);
  } catch (err) {
    req.logger?.error('dependency check failed', { error: err?.message || String(err) });
    res.status(503).json({ status: 'degraded', healthy: false, timestamp: new Date().toISOString(), error: 'dependency probe internal error' });
  }
});

// ==================== V3 INSTAGRAM ROUTES ====================

// V3 POST/FEED ROUTES
app.post('/api/v3/posts', authenticate, requireRegistered, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file required' });
    }
    
    const { caption } = req.body;
    
    const video = await Video.create({
      userId: req.user.id,
      title: caption || 'Post',
      description: caption || '',
      filename: req.file.filename,
      isPublished: true
    });
    
    const [enriched] = await attachVideoMeta([video], req.user.id);
    
    // Emit real-time feed update via socket.io
    io.emit('new-post', enriched);
    
    res.json(enriched);
  } catch (err) {
    req.logger?.error('Post creation error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// V3 AUTH ALIASES (forward to existing auth endpoints)
app.post('/api/v3/auth/login', authRateLimit, async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const identifier = username || email || phone;
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: 'Username, email or phone required' });
    }

    const whereClause = username
      ? { username: username.trim() }
      : email ? { email: email.trim() } : { phone: phone.trim() };

    const user = await User.findOne({ where: whereClause });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBanned) return res.status(403).json({ error: 'Account banned' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, isCreator: user.isCreator }
    });
  } catch (err) {
    req.logger?.error('V3 Login error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/v3/auth/register', authRateLimit, async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const exists = await User.findOne({ where: { username } });
    if (exists) return res.status(409).json({ error: 'Username already taken' });

    if (email) {
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) return res.status(409).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      displayName: displayName || username,
      email: email || null,
      password: hashed,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isCreator: false,
      isGuest: false,
      isBanned: false,
    });

    await Points.create({ creatorId: user.id, totalPoints: 0, lifetimePoints: 0 });
    await Wallet.create({ userId: user.id, coins: 500 });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, isCreator: user.isCreator }
    });
  } catch (err) {
    req.logger?.error('V3 Register error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/v3/auth/me', authenticate, requireAuth, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    avatar: req.user.avatar,
    isCreator: req.user.isCreator,
  });
});

// V3 DEBUG SEED ENDPOINT — development only; never mount in production.
if (!IS_PRODUCTION) {
app.get('/api/v3/debug/seed', async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== ADMIN_KEY) {
      return res.status(403).json({ error: 'Invalid key' });
    }

    let user = await User.findOne({ where: { username: 'creator' } });
    if (!user) {
      const bcrypt = require('bcryptjs');
      user = await User.create({
        username: 'creator',
        email: 'creator@ikhwezi.com',
        password: await bcrypt.hash('Password123!', 10),
        displayName: 'Creator Vibes',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
        isCreator: true,
        isGuest: false,
        isBanned: false,
      });
    }

    const existing = await Video.count({ where: { userId: user.id } });
    if (existing > 0) {
      return res.json({ message: `Already seeded with ${existing} posts`, userId: user.id });
    }

    const posts = [
      { title: 'Sunset Magic', description: 'Golden hour at the beach, absolutely breathtaking! 🌅' },
      { title: 'Mountain Adventure', description: 'Peak hike with an amazing view. Nature is healing! 🏔️' },
      { title: 'City Lights', description: 'Nighttime urban vibes in the heart of the city 🌃' },
      { title: 'Morning Coffee', description: 'Starting the day right with perfect coffee ☕' },
      { title: 'Going Live!', description: 'Join me for tonight\'s live stream! 🔴' }
    ];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      await Video.create({
        userId: user.id,
        title: post.title,
        description: post.description,
        isPublished: true,
        views: Math.floor(Math.random() * 500),
        filename: DEMO_MEDIA_URLS[i % DEMO_MEDIA_URLS.length],
      });
    }

    res.json({ message: `Seeded ${posts.length} posts`, userId: user.id });
  } catch (err) {
    req.logger?.error('Seed error', { error: err?.message || String(err) });
    res.status(500).json({ error: err.message });
  }
});
}

app.get('/api/v3/feed', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;
    
    const videos = await Video.findAll({
      where: { isPublished: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
    
    const videosWithMeta = await attachVideoMeta(videos, req.user?.id || null);
    
    res.json({
      posts: videosWithMeta,
      page,
      hasMore: videos.length === limit
    });
  } catch (err) {
    req.logger?.error('V3 Feed error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// V3 LIVESTREAM CONTROL (ADMIN ONLY)
app.post('/api/v3/livestream/start', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { title = 'iKHWEZI Live' } = req.body;
    
    // NOTE: previously queried `where: { isLive: false }` instead of "the
    // most recent row" (the pattern every other live-status route uses).
    // If the current row already had isLive:true — e.g. this route firing
    // right after /api/admin/live/start — this would either grab a stale
    // older row or create a brand-new LiveStatus with a different
    // streamKey, splitting stream state across two rows and pointing
    // viewers at the wrong HLS URL. Matched to the same "latest row" lookup
    // used by /api/admin/live/start and /api/live/status.
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({
        streamKey: uuidv4(),
        isLive: true,
        title,
        viewerCount: 0,
        startedAt: new Date()
      });
      await assignLiveHost(liveStatus);
      await liveStatus.save();
    } else {
      liveStatus.isLive = true;
      liveStatus.title = title;
      liveStatus.startedAt = new Date();
      liveStatus.viewerCount = 0;
      await assignLiveHost(liveStatus);
      await liveStatus.save();
    }
    
    // Emit live start event — never broadcast streamKey to all clients.
    io.emit('livestream-started', {
      title,
      viewerCount: 0,
      startedAt: liveStatus.startedAt,
      hlsUrl: buildPublicHlsUrl(liveStatus.streamKey),
    });
    
    res.json({
      success: true,
      isLive: true,
      title,
      streamKey: liveStatus.streamKey,
      rtmpUrl: process.env.RTMP_HOST
        ? `${process.env.RTMP_HOST.replace(/\/$/, '')}/${liveStatus.streamKey}`
        : null,
    });
  } catch (err) {
    req.logger?.error('Livestream start error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to start livestream' });
  }
});

app.post('/api/v3/livestream/stop', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    
    if (!liveStatus) {
      return res.status(400).json({ error: 'No active livestream' });
    }
    
    liveStatus.isLive = false;
    await liveStatus.save();
    
    // Emit live end event
    io.emit('livestream-stopped', {
      title: liveStatus.title,
      totalViewers: liveStatus.viewerCount,
      stoppedAt: new Date()
    });
    
    res.json({
      success: true,
      isLive: false,
      totalViewers: liveStatus.viewerCount
    });
  } catch (err) {
    req.logger?.error('Livestream stop error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to stop livestream' });
  }
});

app.get('/api/v3/livestream/status', async (req, res) => {
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({
        streamKey: uuidv4(),
        isLive: false,
        viewerCount: 0
      });
    }
    
    res.json({
      isLive: liveStatus.isLive,
      title: liveStatus.title || 'iKHWEZI Live',
      viewerCount: liveStatus.viewerCount,
      startedAt: liveStatus.startedAt,
      hlsUrl: liveStatus.isLive ? buildPublicHlsUrl(liveStatus.streamKey) : null,
    });
  } catch (err) {
    req.logger?.error('V3 Livestream status error', { error: err?.message || String(err) });
    res.status(500).json({ error: 'Failed to get livestream status' });
  }
});

app.post('/api/v3/livestream/viewers/join', authenticate, async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      await incrementViewerCount(liveStatus);
      io.emit('viewer-count', { viewerCount: liveStatus.viewerCount });
    }
    res.json({ viewerCount: liveStatus?.viewerCount || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join livestream' });
  }
});

app.post('/api/v3/livestream/viewers/leave', authenticate, async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      await decrementViewerCount(liveStatus);
      io.emit('viewer-count', { viewerCount: liveStatus.viewerCount });
    }
    res.json({ viewerCount: liveStatus?.viewerCount || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave livestream' });
  }
});

// ==================== SOCKET.IO REAL-TIME ====================

const isValidSocketRoomId = (roomId) => {
  if (roomId == null || typeof roomId !== 'string') return false;
  const id = roomId.trim();
  if (!id || id.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
};

io.on('connection', (socket) => {
  socket.logger?.info('User connected', { socketId: socket.id });

  // Every authenticated socket is placed in its personal room straight away so
  // DM / group / wallet notifications reach the user wherever they are in the
  // app (not only while the Messages page is mounted). The identity comes from
  // the verified JWT (socket.user), never from the client.
  if (socket.user?.id && !socket.user.isBanned) {
    socket.join(`user_${socket.user.id}`);
  }

  // Legacy explicit join — still honoured, but only for the caller's own id.
  socket.on('join-user-room', (userId) => {
    if (!socket.user?.id || String(socket.user.id) !== String(userId)) return;
    socket.join(`user_${userId}`);
  });

  // Join a room for a specific video/stream — requires authenticated JWT (guests may listen).
  socket.on('join-room', (roomId) => {
    if (!socket.user || socket.user.isBanned || !isValidSocketRoomId(roomId)) return;
    socket.join(String(roomId).trim());
    socket.logger?.info('User joined room', { userId: socket.user.id, roomId });
  });

  // Leave a room
  socket.on('leave-room', (roomId) => {
    if (!socket.user || !isValidSocketRoomId(roomId)) return;
    socket.leave(String(roomId).trim());
  });

  // Handle live chat messages
  socket.on('chat-message', async (data) => {
    const { roomId, message } = data || {};
    if (!socket.user || socket.user.isGuest || !isValidSocketRoomId(roomId) || !String(message || '').trim()) return;

    io.to(String(roomId).trim()).emit('chat-message', {
      id: uuidv4(),
      message: String(message).trim(),
      userId: socket.user.id,
      username: socket.user.username || socket.user.displayName,
      timestamp: new Date()
    });
  });

  socket.on('reaction', (data) => {
    const { roomId, reaction } = data || {};
    if (!socket.user || socket.user.isGuest || !isValidSocketRoomId(roomId) || !reaction) return;

    io.to(String(roomId).trim()).emit('reaction', {
      reaction,
      userId: socket.user.id,
      username: socket.user.username || socket.user.displayName,
      timestamp: new Date()
    });
  });

  // Handle duet requests (legacy UI — still require auth to prevent spam)
  socket.on('duet-request', (data) => {
    const { roomId } = data || {};
    if (!socket.user || socket.user.isGuest || !isValidSocketRoomId(roomId)) return;

    io.to(String(roomId).trim()).emit('duet-request', {
      userId: socket.user.id,
      username: socket.user.username || socket.user.displayName,
      timestamp: new Date(),
    });
  });

  // Handle co-host invites
  socket.on('co-host-invite', (data) => {
    const { roomId } = data || {};
    if (!socket.user || socket.user.isGuest || !isValidSocketRoomId(roomId)) return;

    io.to(String(roomId).trim()).emit('co-host-invite', {
      userId: socket.user.id,
      username: socket.user.username || socket.user.displayName,
      timestamp: new Date(),
    });
  });

  // WebRTC 1:1 voice/video call signaling — a thin relay. The client packs
  // { toUserId, type: 'invite'|'accept'|'reject'|'offer'|'answer'|'ice-candidate'|'end', payload, from }
  // and we forward it verbatim to the target user's personal room.
  socket.on('call-signal', (data) => {
    const { toUserId } = data || {};
    if (!socket.user || socket.user.isGuest || !toUserId) return;
    io.to(`user_${toUserId}`).emit('call-signal', {
      ...data,
      from: {
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName,
        avatar: socket.user.avatar,
      },
      timestamp: new Date(),
    });
  });

  socket.on('disconnect', () => {
    socket.logger?.info('User disconnected', { socketId: socket.id });
  });
});

// ==================== INITIALIZE ====================

// The four fixups below are LEGACY V1 SQLite repairs (PRAGMA / ALTER TABLE
// ADD COLUMN / duplicate-row cleanup on old pre-migration files). They are
// dead code for migration-built databases — those are created with the full
// column set and composite unique indexes from day one (see
// migrations/20260906-0001-initial-v2-schema.js). initialize() runs them
// ONLY when the migrator baseline-adopts an existing legacy database.

const ensureLiveStatusColumns = async () => {
  // On a fresh database the table does not exist yet — the initial migration
  // creates it with the full column set, so there is nothing to repair.
  // (Previously this threw "no such table" and crash-looped every fresh deploy.)
  const [columns] = await sequelize.query('PRAGMA table_info(LiveStatuses)');
  if (!columns || columns.length === 0) return;
  const existing = new Set(columns.map((col) => String(col.name || '').toLowerCase()));
  if (!existing.has('hostuserid')) {
    await sequelize.query('ALTER TABLE LiveStatuses ADD COLUMN hostUserId VARCHAR(255)');
    appLogger.info('Schema migration: added LiveStatuses.hostUserId');
  }
};

const deduplicateUsernames = async () => {
  try {
    const tableExists = await sequelize.getQueryInterface().showAllTables();
    if (!tableExists.map((name) => name.toLowerCase()).includes('users')) {
      return;
    }

    const duplicates = await sequelize.query(
      'SELECT username, COUNT(*) as count FROM Users GROUP BY username HAVING COUNT(*) > 1',
      { type: QueryTypes.SELECT }
    );

    for (const duplicate of duplicates) {
      const users = await sequelize.query(
        'SELECT id, username, createdAt FROM Users WHERE username = :username ORDER BY createdAt ASC',
        {
          replacements: { username: duplicate.username },
          type: QueryTypes.SELECT
        }
      );

      for (let i = 1; i < users.length; i++) {
        const user = users[i];
        const suffix = String(user.id).replace(/-/g, '').slice(0, 6);
        let candidate = `${user.username}_${suffix}`;
        let counter = 1;

        while (true) {
          const exists = await sequelize.query(
            'SELECT id FROM Users WHERE username = :username LIMIT 1',
            {
              replacements: { username: candidate },
              type: QueryTypes.SELECT
            }
          );

          if (exists.length === 0) {
            break;
          }

          candidate = `${user.username}_${suffix}${counter}`;
          counter += 1;
        }

        await sequelize.query(
          'UPDATE Users SET username = :newUsername WHERE id = :id',
          {
            replacements: { newUsername: candidate, id: user.id },
            type: QueryTypes.UPDATE
          }
        );
      }
    }
  } catch (err) {
    appLogger.warn('Username deduplication skipped', { error: err?.message || String(err) });
  }
};

const ensureGuestColumn = async () => {
  const tables = await sequelize.getQueryInterface().showAllTables();
  const normalized = tables.map((name) => String(name).toLowerCase());
  if (!normalized.includes('users')) {
    return;
  }

  const columns = await sequelize.query("PRAGMA table_info('Users')", {
    type: QueryTypes.SELECT
  });
  const existing = new Set(columns.map((column) => String(column.name).toLowerCase()));

  const migrations = [
    { name: 'isguest', sql: 'ALTER TABLE Users ADD COLUMN isGuest TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'isadmin', sql: 'ALTER TABLE Users ADD COLUMN isAdmin TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'coverimage', sql: 'ALTER TABLE Users ADD COLUMN coverImage VARCHAR(255)' },
    { name: 'bio', sql: 'ALTER TABLE Users ADD COLUMN bio TEXT' },
    { name: 'lastactive', sql: 'ALTER TABLE Users ADD COLUMN lastActive DATETIME' },
  ];

  for (const migration of migrations) {
    if (!existing.has(migration.name)) {
      await sequelize.query(migration.sql);
      console.log(`Schema migration: added Users.${migration.name}`);
    }
  }
};

const enforceInteractionUniqueness = async () => {
  const dedupeTables = [
    { table: 'Likes', keys: ['userId', 'videoId'] },
    { table: 'Follows', keys: ['followerId', 'followingId'] },
    { table: 'Stars', keys: ['userId', 'videoId'] },
    { table: 'StoryViews', keys: ['storyId', 'viewerId'] },
    { table: 'VideoSaves', keys: ['userId', 'videoId'] },
    { table: 'VideoReposts', keys: ['userId', 'videoId'] },
    { table: 'PostLikes', keys: ['userId', 'postId'] },
  ];

  for (const item of dedupeTables) {
    const partitionBy = item.keys.map((key) => `"${key}"`).join(', ');
    const duplicateIds = await sequelize.query(
      `
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY ${partitionBy}
                 ORDER BY datetime(createdAt) ASC, id ASC
               ) AS rn
        FROM "${item.table}"
      ) t
      WHERE rn > 1
      `,
      { type: QueryTypes.SELECT }
    );

    if (duplicateIds.length > 0) {
      await sequelize.query(
        `DELETE FROM "${item.table}" WHERE id IN (:ids)`,
        {
          replacements: { ids: duplicateIds.map((row) => row.id) },
          type: QueryTypes.DELETE,
        }
      );
    }
  }

  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_video ON "Likes"("userId", "videoId")');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_pair ON "Follows"("followerId", "followingId")');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_stars_user_video ON "Stars"("userId", "videoId")');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_storyviews_story_viewer ON "StoryViews"("storyId", "viewerId")');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_videosaves_user_video ON "VideoSaves"("userId", "videoId")');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_videoreposts_user_video ON "VideoReposts"("userId", "videoId")');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_postlikes_user_post ON "PostLikes"("userId", "postId")');
};

// Serve the built frontend, if present — registered last, after every /api
// route above, so it only ever catches real SPA navigation paths. It used to
// sit near the top of the file (before the API routes were even defined),
// which meant it silently swallowed every GET /api/* request and returned
// index.html instead of JSON — broken feeds, live status, profiles, wallet,
// everything. Moving it here (and still guarding /api + /storage) fixes that
// for good, in both local dev and production.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /invalid|only image|file type/i.test(err?.message || '')) {
    return res.status(400).json({ error: err.message || 'Invalid upload' });
  }
  next(err);
});

// Unknown /api paths must answer JSON, never fall through to the SPA shell.
app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

// Final JSON error handler. Without this, Express's default handler returned an
// HTML stack trace (leaking file paths in production) for any error that
// escaped a route's try/catch — e.g. malformed JSON bodies (400 from the body
// parser) or an exception thrown synchronously inside a handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return;
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) {
    req.logger?.error('[http] Unhandled route error', { error: err?.message || String(err), stack: err?.stack });
    sentryHub.captureException(err, { req, extra: { url: req.originalUrl, method: req.method } });
  }
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed') });
});

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/storage/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(404).json({ error: 'Not found' });
  });
}

// Demo media URLs used when seed posts reference missing local files.
const DEMO_MEDIA_URLS = [
  'https://picsum.photos/seed/ikhwezi-sunset/800/1200',
  'https://picsum.photos/seed/ikhwezi-mountain/800/1200',
  'https://picsum.photos/seed/ikhwezi-city/800/1200',
  'https://picsum.photos/seed/ikhwezi-coffee/800/1200',
  'https://picsum.photos/seed/ikhwezi-live/800/1200',
];

function isRemoteMediaUrl(filename) {
  return /^https?:\/\//i.test(filename || '');
}

function localUploadExists(filename) {
  if (!filename || isRemoteMediaUrl(filename)) return !!filename;
  const filePath = path.join(__dirname, 'storage/uploads', path.basename(filename));
  return fs.existsSync(filePath);
}

async function ensureDemoMedia() {
  try {
    const videos = await Video.findAll({ where: { isPublished: true } });
    let fixed = 0;
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const filename = video.filename || '';
      const needsFix = !filename
        || filename === 'placeholder.jpg'
        || /^test[a-z0-9-]*\.jpg$/i.test(filename)
        || !localUploadExists(filename);
      if (!needsFix) continue;
      await video.update({
        filename: DEMO_MEDIA_URLS[i % DEMO_MEDIA_URLS.length],
        thumbnail: null,
      });
      fixed++;
    }
    if (fixed > 0) {
      appLogger.info('Repaired feed posts with missing demo media', { fixed });
    }
  } catch (err) {
    appLogger.error('ensureDemoMedia error', { error: err?.message || String(err) });
  }
}

const initialize = async () => {
  try {
    await sequelize.authenticate();
    const isSqlite = sequelize.getDialect() === 'sqlite';

    // Versioned migrations replace sequelize.sync(). The runner
    // (db/migrate.js) creates the full schema on fresh databases and
    // BASELINE-ADOPTs legacy pre-migration databases (records the migration
    // into SequelizeMeta without re-running DDL, so old dev files stay
    // bootable). See backend/migrations/ and db/migrate.js.
    const { migrate } = require('./db/migrate');
    const { executed, adoptedBaseline } = await migrate({
      sequelize,
      logger: { info: () => {}, warn: console.warn, error: console.error },
    });

    // Legacy V1 SQLite repair fixups. On migration-built databases these are
    // obsolete — the initial migration already creates every table with the
    // full column set, deduped uniqueness enforced by composite indexes, and
    // no duplicate-prone rows can exist in an empty file. They only still
    // matter for basesline-adopted legacy SQLite files old dev/production
    // machines may carry, so they run ONLY on that path (guarded inside the
    // adopt branch of the migrator outcome).
    if (isSqlite && adoptedBaseline) {
      await deduplicateUsernames();
      await ensureGuestColumn();
      await ensureLiveStatusColumns();
      await enforceInteractionUniqueness();
    }
    if (executed.length) {
      console.log(`Migrations applied (${sequelize.getDialect()}): ${executed.join(', ')}`);
    } else {
      console.log(`Database up to date (${sequelize.getDialect()}, migrations verified)`);
    }

    // Guest-account hygiene: purge stale @guest.local rows (inactive 14+ days,
    // no owned content) with their Wallet/Points companions, or idle rows
    // accumulate forever — one triplet per install that ever opened the app.
    // Runs once now, then daily (unref'd timer, never blocks shutdown).
    try {
      const { buildGuestCleanupJob } = require('./jobs/guestCleanup');
      const cleanup = buildGuestCleanupJob({
        sequelize,
        models: { ...coreModels, ...groupsModule.models, ...meetingsModule.models },
      });
      cleanup.start({
        idleDays: parseInt(process.env.GUEST_IDLE_DAYS, 10) || 14,
      });
    } catch (err) {
      appLogger.warn('Guest cleanup could not start (non-fatal)', { error: err?.message || String(err) });
    }

    // Automated encrypted backups: SQLite VACUUM INTO + integrity verify, or
    // an honest skip line on Postgres (managed snapshots own that job).
    // backend/jobs/backupJob.js — see docs/ops/backup-restore.md.
    try {
      const { buildBackupJob } = require('./jobs/backupJob');
      buildBackupJob({ sequelize, logger: console }).start();
    } catch (err) {
      appLogger.warn('Backup job could not start (non-fatal)', { error: err?.message || String(err) });
    };
    
    // Ensure storage directories exist
    const dirs = ['storage/videos', 'storage/uploads', 'storage/hls'];
    dirs.forEach(dir => {
      const fullPath = path.join(__dirname, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });

    await ensureDemoMedia();
    
    // Create default live status
    const liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      await LiveStatus.create({ streamKey: uuidv4(), isLive: false, viewerCount: 0 });
    }
    
    server.listen(PORT, () => {
      console.log(`iKHWEZI Backend running on port ${PORT}`);
    });
  } catch (err) {
    appLogger.error('Initialization error', { error: err?.message || String(err), stack: err?.stack });
    process.exit(1);
  }
};

initialize();
