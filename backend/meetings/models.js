'use strict';

/**
 * Meetings — Sequelize models.
 *
 * A Meeting is a scheduled or live session that belongs to a Group. Membership
 * of the group is the access boundary: only members can see, join or manage
 * the group's meetings.
 *
 * This is the persistence + presence foundation only. Real-time audio/video
 * is intentionally NOT modelled here yet — when it lands it must be an SFU
 * (mediasoup/LiveKit-style) with TURN, and it will attach to these rows via
 * a separate `MeetingSession`/media-server record rather than changing them.
 *
 * Lifecycle: scheduled → live → ended, or scheduled → cancelled.
 */

const MEETING_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'];

function defineMeetingModels({ sequelize, DataTypes, User, Group }) {
  const Meeting = sequelize.define('Meeting', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    hostId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM(...MEETING_STATUSES), allowNull: false, defaultValue: 'scheduled' },
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    endedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    indexes: [
      { fields: ['groupId', 'status'] },
      { fields: ['hostId'] },
      { fields: ['scheduledAt'] },
    ],
  });

  const MeetingParticipant = sequelize.define('MeetingParticipant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    meetingId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.ENUM('host', 'participant'), allowNull: false, defaultValue: 'participant' },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    leftAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    indexes: [
      // One row per (meeting, user); re-joining updates joinedAt/leftAt.
      { unique: true, fields: ['meetingId', 'userId'] },
      { fields: ['userId'] },
    ],
  });

  Meeting.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  Meeting.belongsTo(User, { foreignKey: 'hostId', as: 'host' });
  Meeting.hasMany(MeetingParticipant, { foreignKey: 'meetingId', as: 'participants' });
  MeetingParticipant.belongsTo(Meeting, { foreignKey: 'meetingId', as: 'meeting' });
  MeetingParticipant.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  return { Meeting, MeetingParticipant };
}

module.exports = { defineMeetingModels, MEETING_STATUSES };
