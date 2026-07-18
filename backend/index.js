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
    console.warn(`⚠️  ${envVarName} is set but shorter than ${minLength} characters — treating as insecure and generating a random one instead.`);
  }
  const generated = crypto.randomBytes(48).toString('hex');
  console.warn('\n' + '='.repeat(78));
  console.warn(`⚠️  SECURITY WARNING: ${envVarName} is not set (or too short) in the environment.`);
  console.warn(`⚠️  Generated a random value for THIS PROCESS ONLY — it will change on restart.`);
  console.warn(`⚠️  Set a persistent ${envVarName} environment variable on the server ASAP.`);
  // Never log generated secrets — they end up in persistent logs/CI output.
  console.warn('='.repeat(78) + '\n');
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

const app = express();
const server = http.createServer(app);
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
const HLS_HOST = process.env.HLS_HOST || '';

// Real-money top-ups activate automatically once these are set — no code
// changes needed. Until then, /api/wallet/topup runs in dev mode and grants
// coins directly (clearly flagged in the response) so gifting/subscriptions
// are fully testable end-to-end without a payment processor.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_ENABLED = !!STRIPE_SECRET_KEY;
const stripeClient = STRIPE_ENABLED ? require('stripe')(STRIPE_SECRET_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Database setup — absolute path so CWD never selects the wrong DB file.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'storage', 'ikhwezi.db'),
  logging: false
});

// Models
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: true },
  phone: { type: DataTypes.STRING, unique: true, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  displayName: { type: DataTypes.STRING, allowNull: true },
  avatar: { type: DataTypes.STRING, allowNull: true },
  coverImage: { type: DataTypes.STRING, allowNull: true },
  bio: { type: DataTypes.TEXT, allowNull: true },
  isCreator: { type: DataTypes.BOOLEAN, defaultValue: false },
  isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
  isBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
  isGuest: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastActive: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const Video = sequelize.define('Video', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  filename: { type: DataTypes.STRING, allowNull: false },
  thumbnail: { type: DataTypes.STRING, allowNull: true },
  duration: { type: DataTypes.FLOAT, defaultValue: 0 },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
  isSponsored: { type: DataTypes.BOOLEAN, defaultValue: false },
  isTrending: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Like = sequelize.define('Like', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  videoId: { type: DataTypes.UUID, allowNull: false }
});

const VideoSave = sequelize.define('VideoSave', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  videoId: { type: DataTypes.UUID, allowNull: false }
});

const VideoRepost = sequelize.define('VideoRepost', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  videoId: { type: DataTypes.UUID, allowNull: false }
});

const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  videoId: { type: DataTypes.UUID, allowNull: false },
  parentId: { type: DataTypes.UUID, allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: false }
});

const Follow = sequelize.define('Follow', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  followerId: { type: DataTypes.UUID, allowNull: false },
  followingId: { type: DataTypes.UUID, allowNull: false }
});

const Story = sequelize.define('Story', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('image', 'video'), allowNull: false },
  url: { type: DataTypes.STRING, allowNull: false },
  caption: { type: DataTypes.TEXT, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false }
});

const StoryView = sequelize.define('StoryView', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  storyId: { type: DataTypes.UUID, allowNull: false },
  viewerId: { type: DataTypes.UUID, allowNull: false },
});

const StoryComment = sequelize.define('StoryComment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  storyId: { type: DataTypes.UUID, allowNull: false },
  parentId: { type: DataTypes.UUID, allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: false }
});

const Challenge = sequelize.define('Challenge', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  hashtag: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy: { type: DataTypes.UUID, allowNull: false }
});

const WatchParty = sequelize.define('WatchParty', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hostId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  streamUrl: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  maxParticipants: { type: DataTypes.INTEGER, defaultValue: 8 }
});

const WatchPartyParticipant = sequelize.define('WatchPartyParticipant', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  watchPartyId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false }
});

const Star = sequelize.define('Star', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  creatorId: { type: DataTypes.UUID, allowNull: false },
  videoId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.INTEGER, defaultValue: 1 }
});

const DirectMessage = sequelize.define('DirectMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  senderId: { type: DataTypes.UUID, allowNull: false },
  receiverId: { type: DataTypes.UUID, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  mediaUrl: { type: DataTypes.STRING, allowNull: true },
  mediaType: { type: DataTypes.STRING, allowNull: true }, // 'image' | 'video'
  readAt: { type: DataTypes.DATE, allowNull: true }
});

const TextPost = sequelize.define('TextPost', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  backgroundColor: { type: DataTypes.STRING, defaultValue: '#1a1a2e' },
  textColor: { type: DataTypes.STRING, defaultValue: '#ffffff' },
  fontStyle: { type: DataTypes.STRING, defaultValue: 'normal' }, // normal | bold | italic
  likeCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  commentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
});

const PostLike = sequelize.define('PostLike', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  postId: { type: DataTypes.UUID, allowNull: false },
});

const Points = sequelize.define('Points', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  creatorId: { type: DataTypes.UUID, allowNull: false, unique: true },
  totalPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
  lifetimePoints: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// In-app currency wallet. Coins are spent on gifts + subscriptions and are
// credited via /api/wallet/topup — either instantly in dev mode, or through a
// real Stripe Checkout session once STRIPE_SECRET_KEY is configured.
const Wallet = sequelize.define('Wallet', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  coins: { type: DataTypes.INTEGER, defaultValue: 500 }
});

const Subscription = sequelize.define('Subscription', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  subscriberId: { type: DataTypes.UUID, allowNull: false },
  creatorId: { type: DataTypes.UUID, allowNull: false },
  tier: { type: DataTypes.STRING, defaultValue: 'supporter' },
  expiresAt: { type: DataTypes.DATE, allowNull: false }
});

const GiftLog = sequelize.define('GiftLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fromUserId: { type: DataTypes.UUID, allowNull: false },
  toUserId: { type: DataTypes.UUID, allowNull: false },
  giftId: { type: DataTypes.STRING, allowNull: false },
  coins: { type: DataTypes.INTEGER, allowNull: false },
  roomId: { type: DataTypes.STRING, allowNull: true }
});

const LiveStatus = sequelize.define('LiveStatus', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  streamKey: { type: DataTypes.STRING, allowNull: false },
  isLive: { type: DataTypes.BOOLEAN, defaultValue: false },
  title: { type: DataTypes.STRING, allowNull: true },
  viewerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  startedAt: { type: DataTypes.DATE, allowNull: true }
});

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT, allowNull: true },
  ip: { type: DataTypes.STRING, allowNull: true }
});

// Idempotency guard for Stripe webhook retries — prevents double-crediting coins.
const ProcessedStripeEvent = sequelize.define('ProcessedStripeEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  eventId: { type: DataTypes.STRING, unique: true, allowNull: false },
  sessionId: { type: DataTypes.STRING, allowNull: true },
  userId: { type: DataTypes.UUID, allowNull: true },
  coins: { type: DataTypes.INTEGER, allowNull: true },
});

// Admin-managed tailored ads (image or video) shown inline in the main feed.
const Ad = sequelize.define('Ad', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, defaultValue: '' },
  caption: { type: DataTypes.TEXT, defaultValue: '' },
  filename: { type: DataTypes.STRING, allowNull: false },
  mediaType: { type: DataTypes.STRING, defaultValue: 'image' },
  clickUrl: { type: DataTypes.STRING, defaultValue: '' },
  ctaLabel: { type: DataTypes.STRING, defaultValue: 'Learn more' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  placement: { type: DataTypes.STRING, defaultValue: 'feed' },
  priority: { type: DataTypes.INTEGER, defaultValue: 0 },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  clicks: { type: DataTypes.INTEGER, defaultValue: 0 },
});

// Associations
User.hasMany(Video, { foreignKey: 'userId', as: 'videos' });
Video.belongsTo(User, { foreignKey: 'userId', as: 'creator' });

User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });
Video.hasMany(Like, { foreignKey: 'videoId' });
Like.belongsTo(Video, { foreignKey: 'videoId' });

User.hasMany(VideoSave, { foreignKey: 'userId' });
VideoSave.belongsTo(User, { foreignKey: 'userId' });
Video.hasMany(VideoSave, { foreignKey: 'videoId' });
VideoSave.belongsTo(Video, { foreignKey: 'videoId' });

User.hasMany(VideoRepost, { foreignKey: 'userId' });
VideoRepost.belongsTo(User, { foreignKey: 'userId' });
Video.hasMany(VideoRepost, { foreignKey: 'videoId' });
VideoRepost.belongsTo(Video, { foreignKey: 'videoId' });

User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' });
Video.hasMany(Comment, { foreignKey: 'videoId' });
Comment.belongsTo(Video, { foreignKey: 'videoId' });
Comment.hasMany(Comment, { foreignKey: 'parentId', as: 'replies' });
Comment.belongsTo(Comment, { foreignKey: 'parentId', as: 'parent' });

User.hasMany(Star, { foreignKey: 'userId' });
Star.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Points, { foreignKey: 'creatorId', as: 'points' });
Points.belongsTo(User, { foreignKey: 'creatorId' });

User.hasMany(Story, { foreignKey: 'userId', as: 'stories' });
Story.belongsTo(User, { foreignKey: 'userId', as: 'creator' });
Story.hasMany(StoryView, { foreignKey: 'storyId', as: 'views' });
StoryView.belongsTo(Story, { foreignKey: 'storyId' });
StoryView.belongsTo(User, { foreignKey: 'viewerId', as: 'viewer' });
User.hasMany(StoryComment, { foreignKey: 'userId' });
StoryComment.belongsTo(User, { foreignKey: 'userId', as: 'author' });
Story.hasMany(StoryComment, { foreignKey: 'storyId', as: 'comments' });
StoryComment.belongsTo(Story, { foreignKey: 'storyId' });
StoryComment.hasMany(StoryComment, { foreignKey: 'parentId', as: 'replies' });
StoryComment.belongsTo(StoryComment, { foreignKey: 'parentId', as: 'parent' });

User.hasMany(Challenge, { foreignKey: 'createdBy', as: 'challenges' });
Challenge.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(WatchParty, { foreignKey: 'hostId', as: 'watchParties' });
WatchParty.belongsTo(User, { foreignKey: 'hostId', as: 'host' });
WatchParty.hasMany(WatchPartyParticipant, { foreignKey: 'watchPartyId', as: 'participants' });
WatchPartyParticipant.belongsTo(WatchParty, { foreignKey: 'watchPartyId' });
WatchPartyParticipant.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(TextPost, { foreignKey: 'userId', as: 'textPosts' });
TextPost.belongsTo(User, { foreignKey: 'userId', as: 'author' });
TextPost.hasMany(PostLike, { foreignKey: 'postId', as: 'likes' });
PostLike.belongsTo(TextPost, { foreignKey: 'postId' });
PostLike.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Subscription, { foreignKey: 'subscriberId', as: 'subscriptions' });
User.hasMany(Subscription, { foreignKey: 'creatorId', as: 'subscribers' });
Subscription.belongsTo(User, { foreignKey: 'subscriberId', as: 'subscriber' });
Subscription.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });

// Public HLS playback URL — safe to expose (watch-only). Never expose streamKey/RTMP on public routes.
function buildPublicHlsUrl(streamKey) {
  if (HLS_HOST) {
    return `${HLS_HOST.replace(/\/$/, '')}/hls/${streamKey}/index.m3u8`;
  }
  return `/hls/${streamKey}.m3u8`;
}

function requireRtmpWebhook(req, res) {
  if (!RTMP_WEBHOOK_SECRET) {
    if (IS_PRODUCTION) {
      console.error('RTMP_WEBHOOK_SECRET is not set — rejecting on-publish callback in production');
      res.status(503).send('RTMP webhook not configured');
      return false;
    }
    return true; // dev: allow unauthenticated callbacks for local nginx testing
  }
  const provided = req.headers['x-rtmp-secret'] || req.query.secret;
  if (provided !== RTMP_WEBHOOK_SECRET) {
    res.status(403).send('Forbidden');
    return false;
  }
  return true;
}

// Middleware
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
    console.error('Stripe webhook signature verification failed:', err.message);
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
        console.error('Stripe webhook wallet credit failed:', err);
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());
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

// Auth middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (user && !user.isBanned) {
      req.user = user;
      // Keep requests authenticated even if optional activity tracking write fails.
      user.lastActive = new Date();
      user.save().catch((saveErr) => {
        console.warn('Last active update failed:', saveErr.message);
      });
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
};

const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  // Constant-time comparison — a plain !== leaks how many leading characters
  // matched via response timing, which matters more now that this is the
  // only gate in front of user PII, bans, and admin grants.
  const provided = Buffer.from(String(adminKey || ''));
  const expected = Buffer.from(ADMIN_KEY);
  const match = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!match) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  next();
};

/** Admin panel secret key OR logged-in owner account (isAdmin). */
const requireAdminAccess = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const provided = Buffer.from(String(adminKey || ''));
  const expected = Buffer.from(ADMIN_KEY);
  const keyMatch = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (keyMatch || req.user?.isAdmin) return next();
  return res.status(403).json({ error: 'Admin access denied' });
};

// Audit logger
const logAudit = async (action, details, ip) => {
  await AuditLog.create({ action, details: JSON.stringify(details), ip });
  const count = await AuditLog.count();
  if (count > 100) {
    const oldest = await AuditLog.findAll({ order: [['createdAt', 'ASC']], limit: count - 100 });
    await AuditLog.destroy({ where: { id: oldest.map(l => l.id) } });
  }
};

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
        isGuest: user.isGuest
      }
    });
  } catch (err) {
    console.error('Register error:', err);
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
        isGuest: user.isGuest
      }
    });
  } catch (err) {
    console.error('Login error:', err);
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
      isGuest: req.user.isGuest,
      points: points?.totalPoints || 0
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
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
    console.error('Feed error:', err);
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
    console.error('Video error:', err);
    res.status(500).json({ error: 'Failed to load video' });
  }
});

app.post('/api/videos', authenticate, requireAuth, upload.single('video'), async (req, res) => {
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
    
    res.json(video);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ==================== INTERACTION ROUTES ====================

app.post('/api/videos/:id/like', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
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
    console.error('Like error:', err);
    res.status(500).json({ error: 'Like failed' });
  }
});

app.post('/api/videos/:id/save', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
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
    console.error('Save error:', err);
    res.status(500).json({ error: 'Save failed' });
  }
});

app.post('/api/videos/:id/repost', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
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
    console.error('Repost error:', err);
    res.status(500).json({ error: 'Repost failed' });
  }
});

app.post('/api/videos/:id/star', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (video.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot star your own video' });
    }
    
    // Check if already starred this video
    const existing = await Star.findOne({ where: { userId: req.user.id, videoId: video.id } });
    if (existing) {
      return res.status(400).json({ error: 'Already starred this video' });
    }
    
    const amount = Math.max(1, Math.min(100, parseInt(req.body.amount, 10) || 1));
    
    // Create star record
    await Star.create({
      userId: req.user.id,
      creatorId: video.userId,
      videoId: video.id,
      amount
    });
    
    // Update creator points (1 star = 10 points)
    const pointsToAdd = amount * 10;
    let creatorPoints = await Points.findOne({ where: { creatorId: video.userId } });
    
    if (!creatorPoints) {
      creatorPoints = await Points.create({
        creatorId: video.userId,
        totalPoints: pointsToAdd,
        lifetimePoints: pointsToAdd
      });
    } else {
      creatorPoints.totalPoints += pointsToAdd;
      creatorPoints.lifetimePoints += pointsToAdd;
      await creatorPoints.save();
    }
    
    const starCount = await Star.sum('amount', { where: { videoId: video.id } }) || 0;
    
    res.json({
      starred: true,
      starCount,
      pointsAwarded: pointsToAdd,
      creatorTotalPoints: creatorPoints.totalPoints
    });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const starCount = await Star.sum('amount', { where: { videoId: req.params.id } }) || 0;
      return res.status(400).json({ error: 'Already starred this video', starCount });
    }
    console.error('Star error:', err);
    res.status(500).json({ error: 'Star failed' });
  }
});

app.post('/api/users/:id/follow', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
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
    console.error('Follow error:', err);
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
    console.error('Comments error:', err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.post('/api/videos/:id/comments', authenticate, requireAuth, commentRateLimit, async (req, res) => {
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
    console.error('Comment error:', err);
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
    console.error('User search error:', err);
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
    console.error('User error:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// Update the current user's own profile — real photos only, no default avatars.
app.patch('/api/users/me', authenticate, requireAuth, imageUpload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]), async (req, res) => {
  try {
    const { displayName, bio } = req.body;
    if (displayName !== undefined) req.user.displayName = displayName.trim().slice(0, 60);
    if (bio !== undefined) req.user.bio = bio.trim().slice(0, 200);
    if (req.files?.avatar?.[0]) req.user.avatar = `/storage/uploads/${req.files.avatar[0].filename}`;
    if (req.files?.cover?.[0]) req.user.coverImage = `/storage/uploads/${req.files.cover[0].filename}`;
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
    console.error('Profile update error:', err);
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
app.post('/api/wallet/topup', authenticate, requireAuth, async (req, res) => {
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
    console.error('Wallet topup error:', err);
    res.status(500).json({ error: 'Failed to top up wallet' });
  }
});

// Send a gift — spends coins, credits the recipient's creator points, and
// broadcasts the moment in real-time (used by the Live chat + DM gift button).
app.post('/api/wallet/gift', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
  try {
    const { toUserId, giftId, roomId } = req.body;
    const gift = GIFT_CATALOG[giftId];
    if (!gift) return res.status(400).json({ error: 'Unknown gift' });
    if (!toUserId || toUserId === req.user.id) return res.status(400).json({ error: 'Invalid recipient' });

    const recipient = await User.findByPk(toUserId);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const wallet = await getOrCreateWallet(req.user.id);
    if (wallet.coins < gift.coins) {
      return res.status(402).json({ error: 'Not enough coins', coins: wallet.coins, required: gift.coins });
    }
    wallet.coins -= gift.coins;
    await wallet.save();

    let creatorPoints = await Points.findOne({ where: { creatorId: toUserId } });
    if (!creatorPoints) {
      creatorPoints = await Points.create({ creatorId: toUserId, totalPoints: gift.coins, lifetimePoints: gift.coins });
    } else {
      creatorPoints.totalPoints += gift.coins;
      creatorPoints.lifetimePoints += gift.coins;
      await creatorPoints.save();
    }

    await GiftLog.create({ fromUserId: req.user.id, toUserId, giftId, coins: gift.coins, roomId: roomId || null });

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
    console.error('Gift error:', err);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Live gifts always target the current broadcasting admin — resolved
// server-side so the client never has to (and can't spoof) the recipient.
app.post('/api/live/gift', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
  try {
    const { giftId } = req.body;
    const gift = GIFT_CATALOG[giftId];
    if (!gift) return res.status(400).json({ error: 'Unknown gift' });

    const admin = await User.findOne({ where: { isAdmin: true } });
    if (!admin) return res.status(404).json({ error: 'No live host configured' });
    if (admin.id === req.user.id) return res.status(400).json({ error: 'Cannot gift yourself' });

    const wallet = await getOrCreateWallet(req.user.id);
    if (wallet.coins < gift.coins) {
      return res.status(402).json({ error: 'Not enough coins', coins: wallet.coins, required: gift.coins });
    }
    wallet.coins -= gift.coins;
    await wallet.save();

    let creatorPoints = await Points.findOne({ where: { creatorId: admin.id } });
    if (!creatorPoints) {
      creatorPoints = await Points.create({ creatorId: admin.id, totalPoints: gift.coins, lifetimePoints: gift.coins });
    } else {
      creatorPoints.totalPoints += gift.coins;
      creatorPoints.lifetimePoints += gift.coins;
      await creatorPoints.save();
    }

    await GiftLog.create({ fromUserId: req.user.id, toUserId: admin.id, giftId, coins: gift.coins, roomId: 'live-stream' });

    const payload = {
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      toUserId: admin.id,
      giftId,
      char: gift.char,
      label: gift.label,
      coins: gift.coins,
      timestamp: new Date(),
    };
    io.to('live-stream').emit('gift-received', payload);
    io.to(`user_${admin.id}`).emit('gift-received', payload);

    res.json({ sent: true, coinsRemaining: wallet.coins, ...payload });
  } catch (err) {
    console.error('Live gift error:', err);
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

app.post('/api/users/:id/subscribe', authenticate, requireAuth, async (req, res) => {
  try {
    const creatorId = req.params.id;
    if (creatorId === req.user.id) return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    const creator = await User.findByPk(creatorId);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const months = Math.max(1, parseInt(req.body.months) || 1);
    const cost = SUBSCRIPTION_COST_PER_MONTH * months;

    const wallet = await getOrCreateWallet(req.user.id);
    if (wallet.coins < cost) {
      return res.status(402).json({ error: 'Not enough coins', coins: wallet.coins, required: cost });
    }
    wallet.coins -= cost;
    await wallet.save();

    const existing = await Subscription.findOne({
      where: { subscriberId: req.user.id, creatorId, expiresAt: { [Op.gt]: new Date() } },
    });
    const base = existing ? new Date(existing.expiresAt) : new Date();
    const expiresAt = new Date(base.setMonth(base.getMonth() + months));

    let sub;
    if (existing) {
      existing.expiresAt = expiresAt;
      await existing.save();
      sub = existing;
    } else {
      sub = await Subscription.create({ subscriberId: req.user.id, creatorId, expiresAt });
    }

    let creatorPoints = await Points.findOne({ where: { creatorId } });
    if (!creatorPoints) {
      creatorPoints = await Points.create({ creatorId, totalPoints: cost, lifetimePoints: cost });
    } else {
      creatorPoints.totalPoints += cost;
      creatorPoints.lifetimePoints += cost;
      await creatorPoints.save();
    }

    io.to(`user_${creatorId}`).emit('new-subscriber', {
      subscriberId: req.user.id,
      username: req.user.username,
      months,
      timestamp: new Date(),
    });

    res.json({ subscribed: true, expiresAt: sub.expiresAt, coinsRemaining: wallet.coins });
  } catch (err) {
    console.error('Subscribe error:', err);
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
    
    res.json(videos);
  } catch (err) {
    console.error('User videos error:', err);
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
    console.error('Live status error:', err);
    res.status(500).json({ error: 'Failed to get live status' });
  }
});

app.post('/api/live/join', authenticate, async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      res.json({ viewerCount: await incrementViewerCount(liveStatus) });
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
      res.json({ viewerCount: await decrementViewerCount(liveStatus) });
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
    console.error('Stories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

app.post('/api/stories', authenticate, requireAuth, storyUpload.single('story'), async (req, res) => {
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

    const full = await Story.findByPk(story.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
    });
    res.json(full);
  } catch (err) {
    console.error('Story creation error:', err);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

app.post('/api/stories/:id/view', authenticate, requireAuth, async (req, res) => {
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
    console.error('Story view error:', err);
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
    console.error('Story comments error:', err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.post('/api/stories/:id/comments', authenticate, requireAuth, commentRateLimit, async (req, res) => {
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
    console.error('Story comment error:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

app.delete('/api/stories/:id', authenticate, requireAuth, async (req, res) => {
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
    console.error('Story delete error:', err);
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
    console.error('Challenges fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

app.post('/api/challenges', authenticate, requireAuth, async (req, res) => {
  try {
    const { title, description, hashtag } = req.body;
    
    const challenge = await Challenge.create({
      title,
      description,
      hashtag,
      createdBy: req.user.id
    });
    
    res.json(challenge);
  } catch (err) {
    console.error('Challenge creation error:', err);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// ==================== WATCH PARTY ROUTES ====================

app.get('/api/watch-parties', authenticate, async (req, res) => {
  try {
    const watchParties = await WatchParty.findAll({
      where: { isActive: true },
      include: [
        { model: User, as: 'host', attributes: ['id', 'username', 'displayName', 'avatar'] },
        { model: WatchPartyParticipant, as: 'participants', include: [{ model: User, attributes: ['id', 'username'] }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(watchParties);
  } catch (err) {
    console.error('Watch parties fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch watch parties' });
  }
});

app.post('/api/watch-parties', authenticate, requireAuth, async (req, res) => {
  try {
    const { name, streamUrl, maxParticipants } = req.body;
    
    const watchParty = await WatchParty.create({
      hostId: req.user.id,
      name,
      streamUrl,
      maxParticipants: maxParticipants || 8
    });
    
    res.json(watchParty);
  } catch (err) {
    console.error('Watch party creation error:', err);
    res.status(500).json({ error: 'Failed to create watch party' });
  }
});

app.post('/api/watch-parties/:id/join', authenticate, requireAuth, async (req, res) => {
  try {
    const watchParty = await WatchParty.findByPk(req.params.id);
    if (!watchParty || !watchParty.isActive) {
      return res.status(404).json({ error: 'Watch party not found' });
    }
    
    const existing = await WatchPartyParticipant.findOne({
      where: { watchPartyId: watchParty.id, userId: req.user.id }
    });
    
    if (existing) {
      return res.json({ message: 'Already joined' });
    }
    
    const participantCount = await WatchPartyParticipant.count({
      where: { watchPartyId: watchParty.id }
    });
    
    if (participantCount >= watchParty.maxParticipants) {
      return res.status(400).json({ error: 'Watch party is full' });
    }
    
    await WatchPartyParticipant.create({
      watchPartyId: watchParty.id,
      userId: req.user.id
    });
    
    res.json({ message: 'Joined watch party' });
  } catch (err) {
    console.error('Join watch party error:', err);
    res.status(500).json({ error: 'Failed to join watch party' });
  }
});

// ==================== ADMIN ROUTES ====================

app.post('/api/admin/verify', requireAdmin, async (req, res) => {
  try {
    await logAudit('ADMIN_LOGIN', { success: true }, req.ip);
  } catch (err) {
    console.error('Admin audit log failed:', err);
  }
  res.json({ valid: true });
});

app.get('/api/admin/stream-key', requireAdmin, async (req, res) => {
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({ streamKey: uuidv4(), isLive: false });
    }
    res.json({ streamKey: liveStatus.streamKey, isLive: liveStatus.isLive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stream key' });
  }
});

app.post('/api/admin/stream-key/rotate', requireAdmin, async (req, res) => {
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({ streamKey: uuidv4(), isLive: false });
    } else {
      liveStatus.streamKey = uuidv4();
      await liveStatus.save();
    }
    await logAudit('STREAM_KEY_ROTATED', {}, req.ip);
    res.json({ streamKey: liveStatus.streamKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rotate stream key' });
  }
});

// ==================== DIRECT MESSAGES ====================

// Get all conversations for the current user
app.get('/api/messages/conversations', authenticate, requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const msgs = await DirectMessage.findAll({
      where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] },
      order: [['createdAt', 'DESC']],
    });
    // Group by the other user, pick latest message per conversation
    const convMap = new Map();
    for (const m of msgs) {
      const otherId = m.senderId === userId ? m.receiverId : m.senderId;
      if (!convMap.has(otherId)) convMap.set(otherId, m);
    }
    const otherIds = [...convMap.keys()];
    const others = await User.findAll({ where: { id: otherIds }, attributes: ['id', 'username', 'displayName', 'avatar'] });
    const otherMap = Object.fromEntries(others.map(u => [u.id, u]));
    const conversations = otherIds.map(id => ({
      user: otherMap[id],
      lastMessage: convMap.get(id),
      unread: msgs.filter(m => m.senderId === id && m.receiverId === userId && !m.readAt).length,
    }));
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// Get messages between current user and another user
app.get('/api/messages/:userId', authenticate, requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;
    const messages = await DirectMessage.findAll({
      where: {
        [Op.or]: [
          { senderId: me, receiverId: other },
          { senderId: other, receiverId: me },
        ],
      },
      order: [['createdAt', 'ASC']],
    });
    // Mark as read
    await DirectMessage.update({ readAt: new Date() }, {
      where: { senderId: other, receiverId: me, readAt: null },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Send a message
app.post('/api/messages/:userId', authenticate, requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
    if (content.trim().length > 1000) return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    const msg = await DirectMessage.create({
      senderId: me,
      receiverId: other,
      content: content.trim(),
    });
    // Real-time notification via socket
    io.to(`user_${other}`).emit('new-dm', { ...msg.toJSON(), senderId: me });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
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

app.post('/api/posts/:id/like', authenticate, requireAuth, interactionRateLimit, async (req, res) => {
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
    console.error('Post like error:', err);
    res.status(500).json({ error: 'Like failed' });
  }
});

app.post('/api/posts', authenticate, requireAuth, async (req, res) => {
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

app.delete('/api/posts/:id', authenticate, requireAuth, async (req, res) => {
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

app.put('/api/videos/:id', authenticate, requireAuth, async (req, res) => {
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

app.delete('/api/videos/:id', authenticate, requireAuth, async (req, res) => {
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
app.post('/api/live/on-publish', async (req, res) => {
  if (!requireRtmpWebhook(req, res)) return;
  try {
    let liveStatus = await LiveStatus.findOne({ order: [['createdAt', 'DESC']] });
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({ streamKey: uuidv4(), isLive: true, title: 'Live Stream', startedAt: new Date(), viewerCount: 0 });
    } else {
      liveStatus.isLive = true;
      liveStatus.startedAt = new Date();
      liveStatus.viewerCount = 0;
      if (!liveStatus.title) liveStatus.title = 'Live Stream';
      await liveStatus.save();
    }
    console.log('Stream started via on_publish');
    res.status(200).send('OK');
  } catch (err) {
    console.error('on_publish error:', err);
    res.status(200).send('OK'); // Always 200 or nginx-rtmp will reject the stream
  }
});

// Auto-triggered by nginx-rtmp when OBS stops streaming
app.post('/api/live/on-publish-done', async (req, res) => {
  if (!requireRtmpWebhook(req, res)) return;
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      liveStatus.isLive = false;
      liveStatus.viewerCount = 0;
      await liveStatus.save();
    }
    console.log('Stream ended via on_publish_done');
    res.status(200).send('OK');
  } catch (err) {
    console.error('on_publish_done error:', err);
    res.status(200).send('OK');
  }
});

app.post('/api/admin/live/start', requireAdmin, async (req, res) => {
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
    } else {
      liveStatus.isLive = true;
      liveStatus.title = title || 'Live Stream';
      liveStatus.startedAt = new Date();
      liveStatus.viewerCount = 0;
      await liveStatus.save();
    }
    
    await logAudit('LIVE_STARTED', { title }, req.ip);
    res.json({ success: true, isLive: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start live' });
  }
});

app.post('/api/admin/live/stop', requireAdmin, async (req, res) => {
  try {
    const liveStatus = await LiveStatus.findOne({ where: { isLive: true } });
    if (liveStatus) {
      liveStatus.isLive = false;
      liveStatus.viewerCount = 0;
      liveStatus.startedAt = null;
      await liveStatus.save();
    }
    await logAudit('LIVE_STOPPED', {}, req.ip);
    res.json({ success: true, isLive: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop live' });
  }
});

app.post('/api/admin/videos', requireAdmin, upload.single('video'), async (req, res) => {
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
    console.error('Admin upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/admin/videos', requireAdmin, async (req, res) => {
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

app.patch('/api/admin/videos/:id', requireAdmin, async (req, res) => {
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

app.delete('/api/admin/videos/:id', requireAdmin, async (req, res) => {
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

app.get('/api/admin/ads', requireAdmin, async (req, res) => {
  try {
    const ads = await Ad.findAll({ order: [['priority', 'DESC'], ['createdAt', 'DESC']] });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ads' });
  }
});

app.post('/api/admin/ads', requireAdmin, adUpload.single('media'), async (req, res) => {
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

    await logAudit('AD_CREATED', { adId: ad.id, title: ad.title }, req.ip);
    res.json(ad);
  } catch (err) {
    console.error('Admin ad upload error:', err);
    res.status(500).json({ error: 'Ad upload failed' });
  }
});

app.patch('/api/admin/ads/:id', requireAdmin, async (req, res) => {
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

app.delete('/api/admin/ads/:id', requireAdmin, async (req, res) => {
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

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'phone', 'username', 'displayName', 'isCreator', 'isAdmin', 'isBanned', 'lastActive', 'createdAt'],
      include: [{ model: Points, as: 'points', attributes: ['totalPoints', 'lifetimePoints'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.patch('/api/admin/users/:id/ban', authenticate, requireAdminAccess, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.user && user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot block your own account' });
    }

    if (user.isAdmin && !req.headers['x-admin-key']) {
      return res.status(403).json({ error: 'Use admin panel to block another admin account' });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    await logAudit(user.isBanned ? 'USER_BANNED' : 'USER_UNBANNED', { userId: user.id, username: user.username }, req.ip);
    res.json({ isBanned: user.isBanned });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Grant/revoke broadcast (Go Live) rights — the app's single-admin model:
// only users flagged isAdmin are permitted to broadcast, gated here behind
// the same secret ADMIN_KEY used for the rest of the admin panel.
app.patch('/api/admin/users/:id/admin', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isAdmin = !user.isAdmin;
    await user.save();

    await logAudit(user.isAdmin ? 'USER_MADE_ADMIN' : 'USER_REVOKED_ADMIN', { userId: user.id, username: user.username }, req.ip);
    res.json({ isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
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
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

app.get('/api/admin/audit-log', requireAdmin, async (req, res) => {
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

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== V3 INSTAGRAM ROUTES ====================

// V3 POST/FEED ROUTES
app.post('/api/v3/posts', authenticate, requireAuth, imageUpload.single('image'), async (req, res) => {
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
    console.error('Post creation error:', err);
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
    console.error('V3 Login error:', err);
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
    console.error('V3 Register error:', err);
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
    console.error('Seed error:', err);
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
    console.error('V3 Feed error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// V3 LIVESTREAM CONTROL (ADMIN ONLY)
app.post('/api/v3/livestream/start', requireAdmin, async (req, res) => {
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
    } else {
      liveStatus.isLive = true;
      liveStatus.title = title;
      liveStatus.startedAt = new Date();
      liveStatus.viewerCount = 0;
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
    console.error('Livestream start error:', err);
    res.status(500).json({ error: 'Failed to start livestream' });
  }
});

app.post('/api/v3/livestream/stop', requireAdmin, async (req, res) => {
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
    console.error('Livestream stop error:', err);
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
    console.error('V3 Livestream status error:', err);
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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join personal user room for DM notifications
  socket.on('join-user-room', (userId) => {
    if (userId) socket.join(`user_${userId}`);
  });

  // Join a room for a specific video/stream
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Leave a room
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  // Handle live chat messages
  socket.on('chat-message', async (data) => {
    const { roomId, message, userId, username } = data;
    
    // Broadcast to all users in the room
    io.to(roomId).emit('chat-message', {
      id: uuidv4(),
      message,
      userId,
      username,
      timestamp: new Date()
    });
  });

  // Handle reactions
  socket.on('reaction', (data) => {
    const { roomId, reaction, userId, username } = data;
    
    // Broadcast reaction to room
    io.to(roomId).emit('reaction', {
      reaction,
      userId,
      username,
      timestamp: new Date()
    });
  });

  // Handle duet requests
  socket.on('duet-request', (data) => {
    const { roomId, userId, username } = data;
    
    // Notify host/moderators
    io.to(roomId).emit('duet-request', {
      userId,
      username,
      timestamp: new Date()
    });
  });

  // Handle co-host invites
  socket.on('co-host-invite', (data) => {
    const { roomId, userId, username } = data;
    
    // Send invite to specific user
    io.to(roomId).emit('co-host-invite', {
      userId,
      username,
      timestamp: new Date()
    });
  });

  // WebRTC 1:1 voice/video call signaling — a thin relay. The client packs
  // { toUserId, type: 'invite'|'accept'|'reject'|'offer'|'answer'|'ice-candidate'|'end', payload, from }
  // and we forward it verbatim to the target user's personal room.
  socket.on('call-signal', (data) => {
    const { toUserId } = data || {};
    if (!toUserId) return;
    io.to(`user_${toUserId}`).emit('call-signal', { ...data, timestamp: new Date() });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ==================== INITIALIZE ====================

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
    console.warn('Username deduplication skipped:', err.message);
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
      console.log(`✓ Repaired ${fixed} feed posts with missing demo media`);
    }
  } catch (err) {
    console.error('ensureDemoMedia error:', err.message);
  }
}

const initialize = async () => {
  try {
    await sequelize.authenticate();
    await deduplicateUsernames();
    await ensureGuestColumn();
    await sequelize.sync();
    await enforceInteractionUniqueness();
    console.log('Database synchronized');
    
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
    console.error('Initialization error:', err);
    process.exit(1);
  }
};

initialize();
