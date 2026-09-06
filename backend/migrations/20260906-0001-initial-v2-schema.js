'use strict';

/**
 * INITIAL V2 SCHEMA — static, committed, dialect-portable (SQLite + PostgreSQL).
 *
 * Generated from the model definitions (core models + groups + meetings, no
 * WatchParty/WatchPartyParticipant — Watch Parties are deferred to V3) by a
 * one-time generator script; this file is the committed artifact and must stay
 * static. Table creation order is FK-dependency sorted (parents first) so both
 * SQLite and PostgreSQL accept every REFERENCES clause at CREATE time.
 *
 * FK CONSTRAINTS: emitted at full parity with what sequelize.sync() produced on
 * V1 databases (verified byte-for-byte against sqlite_master DDL): every
 * association FK column carries references/onUpdate/onDelete, e.g.
 * Likes.userId -> Users.id. Model-layer integrity and SQL-level integrity now
 * agree; inserting a Like with a bogus videoId fails with a FK violation on
 * both dialects.
 *
 * Portability: no PRAGMAs, no TINYINT literals. Enumerated columns use
 * DataTypes.ENUM (PostgreSQL receives native CREATE TYPE ... AS ENUM; SQLite
 * degrades to TEXT + app-level validation, same as sync()).
 *
 * Composite unique indexes (idx_likes_user_video etc.) mirror the indexes the
 * legacy V1 boot fixer enforceInteractionUniqueness() created on existing
 * databases, so fresh databases converge on the same shape.
 */

const { DataTypes } = require('sequelize');

async function up({ context }) {
  const createTable = context.createTable.bind(context);
  const addIndex = context.addIndex.bind(context);
  const sequelize = context.sequelize;
  await sequelize.transaction(async (transaction) => {

    // Ad
    await createTable('Ads', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      title: { type: DataTypes.STRING(255), defaultValue: "" },
      caption: { type: DataTypes.TEXT, defaultValue: "" },
      filename: { type: DataTypes.STRING(255), allowNull: false },
      mediaType: { type: DataTypes.STRING(255), defaultValue: "image" },
      clickUrl: { type: DataTypes.STRING(255), defaultValue: "" },
      ctaLabel: { type: DataTypes.STRING(255), defaultValue: "Learn more" },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      placement: { type: DataTypes.STRING(255), defaultValue: "feed" },
      priority: { type: DataTypes.INTEGER, defaultValue: 0 },
      views: { type: DataTypes.INTEGER, defaultValue: 0 },
      clicks: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // AuditLog
    await createTable('AuditLogs', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      action: { type: DataTypes.STRING(255), allowNull: false },
      details: { type: DataTypes.TEXT },
      ip: { type: DataTypes.STRING(255) },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // User
    await createTable('Users', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: { type: DataTypes.STRING(255), unique: true },
      phone: { type: DataTypes.STRING(255), unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      username: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      displayName: { type: DataTypes.STRING(255) },
      avatar: { type: DataTypes.STRING(255) },
      coverImage: { type: DataTypes.STRING(255) },
      bio: { type: DataTypes.TEXT },
      isCreator: { type: DataTypes.BOOLEAN, defaultValue: false },
      isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
      isBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
      isGuest: { type: DataTypes.BOOLEAN, defaultValue: false },
      lastActive: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Challenge
    await createTable('Challenges', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT },
      hashtag: { type: DataTypes.STRING(255), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdBy: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Video
    await createTable('Videos', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      title: { type: DataTypes.STRING(255) },
      description: { type: DataTypes.TEXT },
      filename: { type: DataTypes.STRING(255), allowNull: false },
      thumbnail: { type: DataTypes.STRING(255) },
      duration: { type: DataTypes.FLOAT, defaultValue: 0 },
      views: { type: DataTypes.INTEGER, defaultValue: 0 },
      isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
      isSponsored: { type: DataTypes.BOOLEAN, defaultValue: false },
      isTrending: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Comment
    await createTable('Comments', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      videoId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Videos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      parentId: { type: DataTypes.UUID, references: { model: 'Comments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      content: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // DirectMessage
    await createTable('DirectMessages', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      senderId: { type: DataTypes.UUID, allowNull: false },
      receiverId: { type: DataTypes.UUID, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      mediaUrl: { type: DataTypes.STRING(255) },
      mediaType: { type: DataTypes.STRING(255) },
      readAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Follow
    await createTable('Follows', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      followerId: { type: DataTypes.UUID, allowNull: false },
      followingId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GiftLog
    await createTable('GiftLogs', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      fromUserId: { type: DataTypes.UUID, allowNull: false },
      toUserId: { type: DataTypes.UUID, allowNull: false },
      giftId: { type: DataTypes.STRING(255), allowNull: false },
      coins: { type: DataTypes.INTEGER, allowNull: false },
      roomId: { type: DataTypes.STRING(255) },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Group
    await createTable('Groups', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT },
      avatar: { type: DataTypes.STRING(255) },
      ownerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      isPrivate: { type: DataTypes.BOOLEAN, defaultValue: true },
      linkedCreatorId: { type: DataTypes.UUID },
      expiresAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupBan
    await createTable('GroupBans', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      groupId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      bannedBy: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupInvite
    await createTable('GroupInvites', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      groupId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      invitedBy: { type: DataTypes.UUID, allowNull: false },
      invitedUserId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      status: { type: DataTypes.ENUM("pending", "accepted", "declined"), allowNull: false, defaultValue: "pending" },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupMember
    await createTable('GroupMembers', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      groupId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      role: { type: DataTypes.ENUM("owner", "admin", "member"), allowNull: false, defaultValue: "member" },
      lastReadMessageId: { type: DataTypes.UUID },
      joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupMessage
    await createTable('GroupMessages', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      groupId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      senderId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      content: { type: DataTypes.TEXT },
      messageType: { type: DataTypes.ENUM("text", "image", "video", "system"), allowNull: false, defaultValue: "text" },
      mediaUrl: { type: DataTypes.STRING(255) },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupMessageRead
    await createTable('GroupMessageReads', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      messageId: { type: DataTypes.UUID, allowNull: false, references: { model: 'GroupMessages', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      readAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupMute
    await createTable('GroupMutes', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      groupId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // GroupReaction
    await createTable('GroupReactions', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      messageId: { type: DataTypes.UUID, allowNull: false, references: { model: 'GroupMessages', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      emoji: { type: DataTypes.STRING(255), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Like
    await createTable('Likes', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      videoId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Videos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // LiveStatus
    await createTable('LiveStatuses', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      streamKey: { type: DataTypes.STRING(255), allowNull: false },
      isLive: { type: DataTypes.BOOLEAN, defaultValue: false },
      title: { type: DataTypes.STRING(255) },
      hostUserId: { type: DataTypes.UUID },
      viewerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      startedAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Meeting
    await createTable('Meetings', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      groupId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      hostId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("scheduled", "live", "ended", "cancelled"), allowNull: false, defaultValue: "scheduled" },
      scheduledAt: { type: DataTypes.DATE },
      startedAt: { type: DataTypes.DATE },
      endedAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // MeetingParticipant
    await createTable('MeetingParticipants', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      meetingId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Meetings', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      role: { type: DataTypes.ENUM("host", "participant"), allowNull: false, defaultValue: "participant" },
      joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      leftAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Points
    await createTable('Points', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      creatorId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      totalPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
      lifetimePoints: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // TextPost
    await createTable('TextPosts', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      content: { type: DataTypes.TEXT, allowNull: false },
      backgroundColor: { type: DataTypes.STRING(255), defaultValue: "#1a1a2e" },
      textColor: { type: DataTypes.STRING(255), defaultValue: "#ffffff" },
      fontStyle: { type: DataTypes.STRING(255), defaultValue: "normal" },
      likeCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      commentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // PostLike
    await createTable('PostLikes', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      postId: { type: DataTypes.UUID, allowNull: false, references: { model: 'TextPosts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // ProcessedStripeEvent
    await createTable('ProcessedStripeEvents', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      eventId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      sessionId: { type: DataTypes.STRING(255) },
      userId: { type: DataTypes.UUID },
      coins: { type: DataTypes.INTEGER },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Star
    await createTable('Stars', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      creatorId: { type: DataTypes.UUID, allowNull: false },
      videoId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.INTEGER, defaultValue: 1 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Story
    await createTable('Stories', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      type: { type: DataTypes.ENUM("image", "video"), allowNull: false },
      url: { type: DataTypes.STRING(255), allowNull: false },
      caption: { type: DataTypes.TEXT },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // StoryComment
    await createTable('StoryComments', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      storyId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Stories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      parentId: { type: DataTypes.UUID, references: { model: 'StoryComments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      content: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // StoryView
    await createTable('StoryViews', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      storyId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Stories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      viewerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'NO ACTION' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Subscription
    await createTable('Subscriptions', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      subscriberId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      creatorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      tier: { type: DataTypes.STRING(255), defaultValue: "supporter" },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // VideoRepost
    await createTable('VideoReposts', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      videoId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Videos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // VideoSave
    await createTable('VideoSaves', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      videoId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Videos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // Wallet
    await createTable('Wallets', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      coins: { type: DataTypes.INTEGER, defaultValue: 500 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    // ---- indexes ----

    await addIndex('GroupBans', ["groupId", "userId"], { unique: true, name: 'group_bans_group_id_user_id', transaction });

    await addIndex('GroupInvites', ["groupId", "invitedUserId"], { unique: true, name: 'group_invites_group_id_invited_user_id', transaction });

    await addIndex('GroupMembers', ["groupId", "userId"], { unique: true, name: 'group_members_group_id_user_id', transaction });

    await addIndex('GroupMembers', ["userId"], { name: 'group_members_user_id', transaction });

    await addIndex('GroupMessages', ["groupId", "createdAt"], { name: 'group_messages_group_id_created_at', transaction });

    await addIndex('GroupMessages', ["senderId"], { name: 'group_messages_sender_id', transaction });

    await addIndex('GroupMessageReads', ["messageId", "userId"], { unique: true, name: 'group_message_reads_message_id_user_id', transaction });

    await addIndex('GroupMutes', ["groupId", "userId"], { unique: true, name: 'group_mutes_group_id_user_id', transaction });

    await addIndex('GroupReactions', ["messageId", "userId"], { unique: true, name: 'group_reactions_message_id_user_id', transaction });

    await addIndex('GroupReactions', ["messageId"], { name: 'group_reactions_message_id', transaction });

    await addIndex('Meetings', ["groupId", "status"], { name: 'meetings_group_id_status', transaction });

    await addIndex('Meetings', ["hostId"], { name: 'meetings_host_id', transaction });

    await addIndex('Meetings', ["scheduledAt"], { name: 'meetings_scheduled_at', transaction });

    await addIndex('MeetingParticipants', ["meetingId", "userId"], { unique: true, name: 'meeting_participants_meeting_id_user_id', transaction });

    await addIndex('MeetingParticipants', ["userId"], { name: 'meeting_participants_user_id', transaction });

    await addIndex('Likes', ["userId", "videoId"], { unique: true, name: 'idx_likes_user_video', transaction });

    await addIndex('Follows', ["followerId", "followingId"], { unique: true, name: 'idx_follows_pair', transaction });

    await addIndex('Stars', ["userId", "videoId"], { unique: true, name: 'idx_stars_user_video', transaction });

    await addIndex('StoryViews', ["storyId", "viewerId"], { unique: true, name: 'idx_storyviews_story_viewer', transaction });

    await addIndex('VideoSaves', ["userId", "videoId"], { unique: true, name: 'idx_videosaves_user_video', transaction });

    await addIndex('VideoReposts', ["userId", "videoId"], { unique: true, name: 'idx_videoreposts_user_video', transaction });

    await addIndex('PostLikes', ["userId", "postId"], { unique: true, name: 'idx_postlikes_user_post', transaction });


  });
}

async function down({ context }) {
  const dropTable = context.dropTable.bind(context);
  const sequelize = context.sequelize;
  await sequelize.transaction(async (transaction) => {
    await dropTable('Wallets', { transaction, cascade: true });
    await dropTable('VideoSaves', { transaction, cascade: true });
    await dropTable('VideoReposts', { transaction, cascade: true });
    await dropTable('Subscriptions', { transaction, cascade: true });
    await dropTable('StoryViews', { transaction, cascade: true });
    await dropTable('StoryComments', { transaction, cascade: true });
    await dropTable('Stories', { transaction, cascade: true });
    await dropTable('Stars', { transaction, cascade: true });
    await dropTable('ProcessedStripeEvents', { transaction, cascade: true });
    await dropTable('PostLikes', { transaction, cascade: true });
    await dropTable('TextPosts', { transaction, cascade: true });
    await dropTable('Points', { transaction, cascade: true });
    await dropTable('MeetingParticipants', { transaction, cascade: true });
    await dropTable('Meetings', { transaction, cascade: true });
    await dropTable('LiveStatuses', { transaction, cascade: true });
    await dropTable('Likes', { transaction, cascade: true });
    await dropTable('GroupReactions', { transaction, cascade: true });
    await dropTable('GroupMutes', { transaction, cascade: true });
    await dropTable('GroupMessageReads', { transaction, cascade: true });
    await dropTable('GroupMessages', { transaction, cascade: true });
    await dropTable('GroupMembers', { transaction, cascade: true });
    await dropTable('GroupInvites', { transaction, cascade: true });
    await dropTable('GroupBans', { transaction, cascade: true });
    await dropTable('Groups', { transaction, cascade: true });
    await dropTable('GiftLogs', { transaction, cascade: true });
    await dropTable('Follows', { transaction, cascade: true });
    await dropTable('DirectMessages', { transaction, cascade: true });
    await dropTable('Comments', { transaction, cascade: true });
    await dropTable('Videos', { transaction, cascade: true });
    await dropTable('Challenges', { transaction, cascade: true });
    await dropTable('Users', { transaction, cascade: true });
    await dropTable('AuditLogs', { transaction, cascade: true });
    await dropTable('Ads', { transaction, cascade: true });
    // PostgreSQL: also remove the ENUM types CREATE TABLE created inline.
    if (sequelize.getDialect() === 'postgres') {
      const enumTypes = [
        'enum_Stories_type',
        'enum_GroupInvites_status',
        'enum_GroupMembers_role',
        'enum_GroupMessages_messageType',
        'enum_Meetings_status',
        'enum_MeetingParticipants_role',
      ];
      for (const enumType of enumTypes) {
        await sequelize.query(`DROP TYPE IF EXISTS "${enumType}"`, { transaction });
      }
    }
  });
}

module.exports = { up, down };
