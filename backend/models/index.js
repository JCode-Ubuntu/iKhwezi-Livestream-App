'use strict';

/**
 * Core Sequelize models for iKHWEZI.
 *
 * Extracted verbatim from backend/index.js so that:
 *  - the models can be loaded without booting the HTTP server (tests, scripts)
 *  - feature modules (groups, meetings) receive models by injection
 *
 * Model definitions and associations are unchanged from the original; only the
 * wrapping function is new. Table names, columns and defaults are identical,
 * so an existing SQLite database is fully compatible.
 */

function defineCoreModels(sequelize, DataTypes) {
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
    hostUserId: { type: DataTypes.UUID, allowNull: true },
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

  return {
    User, Video, Like, VideoSave, VideoRepost, Comment, Follow, Story, StoryView,
    StoryComment, Challenge, Star, DirectMessage,
    TextPost, PostLike, Points, Wallet, Subscription, GiftLog, LiveStatus, AuditLog,
    ProcessedStripeEvent, Ad,
  };
}

module.exports = { defineCoreModels };