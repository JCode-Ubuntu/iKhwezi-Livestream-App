const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Sequelize, DataTypes, Op, QueryTypes } = require('sequelize');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'ikhwezi_jwt_secret_2026_super_secure';
const ADMIN_KEY = process.env.ADMIN_KEY || 'ikhwezi_admin_26';

// Database setup
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './storage/ikhwezi.db',
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
  bio: { type: DataTypes.TEXT, allowNull: true },
  isCreator: { type: DataTypes.BOOLEAN, defaultValue: false },
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

const Points = sequelize.define('Points', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  creatorId: { type: DataTypes.UUID, allowNull: false, unique: true },
  totalPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
  lifetimePoints: { type: DataTypes.INTEGER, defaultValue: 0 }
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

// Associations
User.hasMany(Video, { foreignKey: 'userId', as: 'videos' });
Video.belongsTo(User, { foreignKey: 'userId', as: 'creator' });

User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });
Video.hasMany(Like, { foreignKey: 'videoId' });
Like.belongsTo(Video, { foreignKey: 'videoId' });

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

User.hasMany(Challenge, { foreignKey: 'createdBy', as: 'challenges' });
Challenge.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(WatchParty, { foreignKey: 'hostId', as: 'watchParties' });
WatchParty.belongsTo(User, { foreignKey: 'hostId', as: 'host' });
WatchParty.hasMany(WatchPartyParticipant, { foreignKey: 'watchPartyId', as: 'participants' });
WatchPartyParticipant.belongsTo(WatchParty, { foreignKey: 'watchPartyId' });
WatchPartyParticipant.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(TextPost, { foreignKey: 'userId', as: 'textPosts' });
TextPost.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// Middleware
app.use(cors());
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
      user.lastActive = new Date();
      await user.save();
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
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  next();
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

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
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
      isCreator: true,
      isGuest: req.body.isGuest || false
    });
    
    await Points.create({ creatorId: user.id, totalPoints: 0, lifetimePoints: 0 });
    
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
        isGuest: user.isGuest
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
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
        isGuest: user.isGuest
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticate, requireAuth, async (req, res) => {
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
    isGuest: req.user.isGuest,
    points: points?.totalPoints || 0
  });
});

// ==================== VIDEO ROUTES ====================

app.get('/api/videos/feed', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get trending videos (20%)
    const trendingCount = Math.ceil(limit * 0.2);
    const trending = await Video.findAll({
      where: { isPublished: true, isTrending: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: sequelize.random(),
      limit: trendingCount
    });
    
    // Get sponsored videos (10%) - one per batch
    const sponsored = await Video.findAll({
      where: { isPublished: true, isSponsored: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: sequelize.random(),
      limit: 1
    });
    
    // Get random videos (70%)
    const randomCount = limit - trending.length - sponsored.length;
    const randomVideos = await Video.findAll({
      where: { 
        isPublished: true,
        id: { [Op.notIn]: [...trending.map(v => v.id), ...sponsored.map(v => v.id)] }
      },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: sequelize.random(),
      limit: randomCount,
      offset
    });
    
    // Mix videos with sponsor every 8-10 videos
    let allVideos = [...randomVideos, ...trending];
    allVideos = allVideos.sort(() => Math.random() - 0.5);
    
    if (sponsored.length > 0) {
      const sponsorIndex = Math.floor(Math.random() * 3) + 7; // Position 7-9
      if (sponsorIndex < allVideos.length) {
        allVideos.splice(sponsorIndex, 0, ...sponsored);
      } else {
        allVideos.push(...sponsored);
      }
    }
    
    // Add like/follow status for authenticated users
    const videosWithMeta = await Promise.all(allVideos.map(async (video) => {
      const likeCount = await Like.count({ where: { videoId: video.id } });
      const commentCount = await Comment.count({ where: { videoId: video.id } });
      const starCount = await Star.sum('amount', { where: { videoId: video.id } }) || 0;
      
      let isLiked = false;
      let isFollowing = false;
      let hasStarred = false;
      
      if (req.user) {
        isLiked = await Like.findOne({ where: { userId: req.user.id, videoId: video.id } }) !== null;
        isFollowing = await Follow.findOne({ where: { followerId: req.user.id, followingId: video.userId } }) !== null;
        hasStarred = await Star.findOne({ where: { userId: req.user.id, videoId: video.id } }) !== null;
      }
      
      return {
        ...video.toJSON(),
        likeCount,
        commentCount,
        starCount,
        isLiked,
        isFollowing,
        hasStarred
      };
    }));
    
    res.json({ videos: videosWithMeta, page, hasMore: randomVideos.length === randomCount });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
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
    
    const likeCount = await Like.count({ where: { videoId: video.id } });
    const commentCount = await Comment.count({ where: { videoId: video.id } });
    const starCount = await Star.sum('amount', { where: { videoId: video.id } }) || 0;
    
    let isLiked = false;
    let isFollowing = false;
    let hasStarred = false;
    
    if (req.user) {
      isLiked = await Like.findOne({ where: { userId: req.user.id, videoId: video.id } }) !== null;
      isFollowing = await Follow.findOne({ where: { followerId: req.user.id, followingId: video.userId } }) !== null;
      hasStarred = await Star.findOne({ where: { userId: req.user.id, videoId: video.id } }) !== null;
    }
    
    res.json({
      ...video.toJSON(),
      likeCount,
      commentCount,
      starCount,
      isLiked,
      isFollowing,
      hasStarred
    });
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

app.post('/api/videos/:id/like', authenticate, requireAuth, async (req, res) => {
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
    console.error('Like error:', err);
    res.status(500).json({ error: 'Like failed' });
  }
});

app.post('/api/videos/:id/star', authenticate, requireAuth, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    // Check if already starred this video
    const existing = await Star.findOne({ where: { userId: req.user.id, videoId: video.id } });
    if (existing) {
      return res.status(400).json({ error: 'Already starred this video' });
    }
    
    const amount = parseInt(req.body.amount) || 1;
    
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
    console.error('Star error:', err);
    res.status(500).json({ error: 'Star failed' });
  }
});

app.post('/api/users/:id/follow', authenticate, requireAuth, async (req, res) => {
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

app.post('/api/videos/:id/comments', authenticate, requireAuth, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content required' });
    }
    
    const video = await Video.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    if (parentId) {
      const parent = await Comment.findByPk(parentId);
      if (!parent || parent.videoId !== video.id) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }
    
    const comment = await Comment.create({
      userId: req.user.id,
      videoId: video.id,
      parentId: parentId || null,
      content: content.trim()
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

app.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'displayName', 'avatar', 'bio', 'isCreator', 'createdAt']
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const videoCount = await Video.count({ where: { userId: user.id, isPublished: true } });
    const followerCount = await Follow.count({ where: { followingId: user.id } });
    const followingCount = await Follow.count({ where: { followerId: user.id } });
    const points = await Points.findOne({ where: { creatorId: user.id } });
    
    let isFollowing = false;
    if (req.user) {
      isFollowing = await Follow.findOne({
        where: { followerId: req.user.id, followingId: user.id }
      }) !== null;
    }
    
    res.json({
      ...user.toJSON(),
      videoCount,
      followerCount,
      followingCount,
      totalPoints: points?.totalPoints || 0,
      isFollowing
    });
  } catch (err) {
    console.error('User error:', err);
    res.status(500).json({ error: 'Failed to load user' });
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
      startedAt: liveStatus.startedAt
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
      liveStatus.viewerCount += 1;
      await liveStatus.save();
      res.json({ viewerCount: liveStatus.viewerCount });
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
    if (liveStatus && liveStatus.viewerCount > 0) {
      liveStatus.viewerCount -= 1;
      await liveStatus.save();
      res.json({ viewerCount: liveStatus.viewerCount });
    } else {
      res.json({ viewerCount: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave live' });
  }
});

// ==================== STORY ROUTES ====================

app.get('/api/stories', authenticate, async (req, res) => {
  try {
    const stories = await Story.findAll({
      where: {
        expiresAt: {
          [Op.gt]: new Date()
        }
      },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(stories);
  } catch (err) {
    console.error('Stories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

app.post('/api/stories', authenticate, requireAuth, upload.single('story'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Story file required' });
    }
    
    const { type, caption } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const story = await Story.create({
      userId: req.user.id,
      type: type || 'image',
      url: `/storage/uploads/${req.file.filename}`,
      caption: caption || '',
      expiresAt
    });
    
    res.json(story);
  } catch (err) {
    console.error('Story creation error:', err);
    res.status(500).json({ error: 'Failed to create story' });
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
  await logAudit('ADMIN_LOGIN', { success: true }, req.ip);
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
app.get('/api/messages/conversations', requireAuth, async (req, res) => {
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
app.get('/api/messages/:userId', requireAuth, async (req, res) => {
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
app.post('/api/messages/:userId', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
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
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const posts = await TextPost.findAll({
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load posts' });
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
    await video.update({
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(caption !== undefined && { caption: caption.trim() }),
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
    
    // Delete file
    const filePath = path.join(__dirname, 'storage/uploads', video.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    await video.destroy();
    await logAudit('VIDEO_DELETED', { videoId: req.params.id }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'phone', 'username', 'displayName', 'isCreator', 'isBanned', 'lastActive', 'createdAt'],
      include: [{ model: Points, as: 'points', attributes: ['totalPoints', 'lifetimePoints'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.patch('/api/admin/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.isBanned = !user.isBanned;
    await user.save();
    
    await logAudit(user.isBanned ? 'USER_BANNED' : 'USER_UNBANNED', { userId: user.id, username: user.username }, req.ip);
    res.json({ isBanned: user.isBanned });
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
  const hasGuest = columns.some((column) => String(column.name).toLowerCase() === 'isguest');

  if (!hasGuest) {
    await sequelize.query('ALTER TABLE Users ADD COLUMN isGuest TINYINT(1) NOT NULL DEFAULT 0');
  }
};

const initialize = async () => {
  try {
    await sequelize.authenticate();
    await deduplicateUsernames();
    await ensureGuestColumn();
    await sequelize.sync();
    console.log('Database synchronized');
    
    // Ensure storage directories exist
    const dirs = ['storage/videos', 'storage/uploads', 'storage/hls'];
    dirs.forEach(dir => {
      const fullPath = path.join(__dirname, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
    
    // Create default live status
    const liveStatus = await LiveStatus.findOne();
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
