'use strict';

/**
 * Group Chat — Sequelize models.
 *
 * Defined against the SAME Sequelize instance the rest of iKHWEZI uses, so
 * `sequelize.sync()` in backend/index.js creates these tables automatically
 * on boot (no separate migration runner required for the SQLite dev DB).
 *
 * Design notes:
 *  - Uniqueness is enforced at the DB layer (unique composite indexes) so a
 *    race in the service layer can never produce duplicate memberships,
 *    reactions, or mutes.
 *  - `GroupMember.lastReadMessageId` is the hot path for unread counts. A full
 *    per-message-per-user read ledger (GroupMessageRead) is also kept for
 *    detailed "read by" receipts, but counts are computed from lastRead.
 *  - `expiresAt` on Group is reserved for the Watch-Party temporary-group
 *    future capability (nullable = permanent).
 */

function defineGroupModels({ sequelize, DataTypes, User }) {
  const Group = sequelize.define('Group', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    avatar: { type: DataTypes.STRING, allowNull: true },
    ownerId: { type: DataTypes.UUID, allowNull: false },
    isPrivate: { type: DataTypes.BOOLEAN, defaultValue: true },
    // Creator-economy hook: a group linked to a creator whose subscribers
    // are auto-added. Null for normal groups.
    linkedCreatorId: { type: DataTypes.UUID, allowNull: true },
    // Watch-party hook: temporary groups auto-archive after this time.
    expiresAt: { type: DataTypes.DATE, allowNull: true },
  });

  const GroupMember = sequelize.define('GroupMember', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'admin', 'member'), allowNull: false, defaultValue: 'member' },
    lastReadMessageId: { type: DataTypes.UUID, allowNull: true },
    joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    indexes: [
      { unique: true, fields: ['groupId', 'userId'] },
      { fields: ['userId'] },
    ],
  });

  const GroupMessage = sequelize.define('GroupMessage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    senderId: { type: DataTypes.UUID, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: true },
    messageType: { type: DataTypes.ENUM('text', 'image', 'video', 'system'), allowNull: false, defaultValue: 'text' },
    mediaUrl: { type: DataTypes.STRING, allowNull: true },
  }, {
    indexes: [
      { fields: ['groupId', 'createdAt'] },
      { fields: ['senderId'] },
    ],
  });

  const GroupMessageRead = sequelize.define('GroupMessageRead', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    messageId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    readAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    indexes: [
      { unique: true, fields: ['messageId', 'userId'] },
    ],
  });

  const GroupInvite = sequelize.define('GroupInvite', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    invitedBy: { type: DataTypes.UUID, allowNull: false },
    invitedUserId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'accepted', 'declined'), allowNull: false, defaultValue: 'pending' },
  }, {
    indexes: [
      { unique: true, fields: ['groupId', 'invitedUserId'] },
    ],
  });

  const GroupMute = sequelize.define('GroupMute', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
  }, {
    indexes: [
      { unique: true, fields: ['groupId', 'userId'] },
    ],
  });

  const GroupBan = sequelize.define('GroupBan', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    bannedBy: { type: DataTypes.UUID, allowNull: false },
  }, {
    indexes: [
      { unique: true, fields: ['groupId', 'userId'] },
    ],
  });

  // One reaction per (message, user). Toggling replaces the emoji.
  const GroupReaction = sequelize.define('GroupReaction', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    messageId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    emoji: { type: DataTypes.STRING, allowNull: false },
  }, {
    indexes: [
      { unique: true, fields: ['messageId', 'userId'] },
      { fields: ['messageId'] },
    ],
  });

  // ---- Associations ----
  Group.hasMany(GroupMember, { foreignKey: 'groupId', as: 'members' });
  GroupMember.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  Group.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  Group.hasMany(GroupMessage, { foreignKey: 'groupId', as: 'messages' });
  GroupMessage.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  GroupMessage.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

  GroupMessage.hasMany(GroupMessageRead, { foreignKey: 'messageId', as: 'reads' });
  GroupMessageRead.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  GroupMessage.hasMany(GroupReaction, { foreignKey: 'messageId', as: 'reactions' });
  GroupReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Group.hasMany(GroupInvite, { foreignKey: 'groupId', as: 'invites' });
  GroupInvite.belongsTo(User, { foreignKey: 'invitedUserId', as: 'invitee' });

  User.hasMany(GroupMember, { foreignKey: 'userId', as: 'groupMemberships' });
  GroupMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  return {
    Group,
    GroupMember,
    GroupMessage,
    GroupMessageRead,
    GroupInvite,
    GroupMute,
    GroupBan,
    GroupReaction,
  };
}

module.exports = { buildGroupModels: defineGroupModels };
