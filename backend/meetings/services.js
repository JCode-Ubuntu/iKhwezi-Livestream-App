'use strict';

/**
 * Meetings — service layer (business rules, no Express / Socket.IO).
 *
 * Access model (all enforced here, never in the UI):
 *  - You must be a member of the meeting's group to see or join it.
 *  - Any group member may create a meeting for the group.
 *  - Host, or a group admin/owner, may update / start / end / cancel it.
 *  - Joining requires the meeting to be live.
 *
 * `CAPABILITIES` is returned with every meeting payload so the client can show
 * exactly what this release supports. Presence (who is in the meeting) is real;
 * audio/video/screen share are not — they must arrive via an SFU + TURN
 * architecture, not a naive peer mesh.
 */

const { Op } = require('sequelize');
const { isUuid } = require('./validation');

const USER_ATTRS = ['id', 'username', 'displayName', 'avatar'];
const RECENT_ENDED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function buildMeetingService({ Meeting, MeetingParticipant, User, groups, av }) {
  const { models: groupModels, service: groupService } = groups;
  const { Group, GroupMessage } = groupModels;
  const sequelize = Meeting.sequelize;

  // Server-driven capability reporting: the A/V provider decides what is real.
  const CAPABILITIES = av?.capabilities || (() => {
    throw new Error('buildMeetingService requires an av provider (see backend/meetings/av.js)');
  })();

  const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

  async function requireMembership(groupId, userId) {
    const m = await groupService.getMembership(groupId, userId);
    if (!m) throw httpError('FORBIDDEN', 403);
    return m;
  }

  function canManage(meeting, membership, userId) {
    if (meeting.hostId === userId) return true;
    return (ROLE_RANK[membership?.role] ?? -1) >= ROLE_RANK.admin;
  }

  async function loadMeeting(meetingId) {
    if (!isUuid(meetingId)) throw httpError('NOT_FOUND', 404);
    const meeting = await Meeting.findByPk(meetingId, {
      include: [
        { model: User, as: 'host', attributes: USER_ATTRS },
        { model: Group, as: 'group', attributes: ['id', 'name', 'avatar'] },
      ],
    });
    if (!meeting) throw httpError('NOT_FOUND', 404);
    return meeting;
  }

  async function activeParticipants(meetingId) {
    return MeetingParticipant.findAll({
      where: { meetingId, leftAt: null },
      include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
      order: [['role', 'ASC'], ['joinedAt', 'ASC']],
    });
  }

  /** Serialise a meeting for the client, including the viewer's own state. */
  async function present(meeting, userId, membership) {
    const participants = await activeParticipants(meeting.id);
    const plain = typeof meeting.toJSON === 'function' ? meeting.toJSON() : meeting;
    return {
      ...plain,
      participantCount: participants.length,
      participants,
      viewer: {
        isHost: meeting.hostId === userId,
        canManage: canManage(meeting, membership, userId),
        isJoined: participants.some((p) => p.userId === userId),
      },
      capabilities: CAPABILITIES,
    };
  }

  async function postSystemMessage(groupId, senderId, content, transaction) {
    // System messages are part of the group's message history so meeting
    // events appear inline in the conversation.
    await GroupMessage.create({
      groupId, senderId, content, messageType: 'system', mediaUrl: null,
    }, { transaction });
  }

  function describeWhen(date) {
    if (!date) return '';
    try {
      return ` for ${new Date(date).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}`;
    } catch {
      return '';
    }
  }

  // ---- Create / list / read ----

  async function createMeeting(host, { groupId, title, description, scheduledAt, startNow }) {
    if (!isUuid(groupId)) throw httpError('GROUP_NOT_FOUND', 404);
    const membership = await requireMembership(groupId, host.id);
    const group = await Group.findByPk(groupId);
    if (!group) throw httpError('GROUP_NOT_FOUND', 404);

    const now = new Date();
    const meeting = await sequelize.transaction(async (transaction) => {
      const created = await Meeting.create({
        groupId,
        hostId: host.id,
        title,
        description: description || null,
        status: startNow ? 'live' : 'scheduled',
        scheduledAt: startNow ? null : scheduledAt,
        startedAt: startNow ? now : null,
      }, { transaction });

      if (startNow) {
        await MeetingParticipant.create({
          meetingId: created.id, userId: host.id, role: 'host', joinedAt: now,
        }, { transaction });
      }

      const who = host.displayName || host.username;
      const text = startNow
        ? `${who} started a meeting: ${title}`
        : `${who} scheduled a meeting: ${title}${describeWhen(scheduledAt)}`;
      await postSystemMessage(groupId, host.id, text, transaction);
      return created;
    });

    const full = await loadMeeting(meeting.id);
    return present(full, host.id, membership);
  }

  /**
   * Meetings visible to the user: across all their groups, or one group.
   * Returns live first, then upcoming, then recently ended (7 days).
   */
  async function listMeetings(user, { groupId } = {}) {
    let groupIds;
    if (groupId) {
      if (!isUuid(groupId)) throw httpError('GROUP_NOT_FOUND', 404);
      await requireMembership(groupId, user.id);
      groupIds = [groupId];
    } else {
      const memberships = await groupModels.GroupMember.findAll({
        where: { userId: user.id }, attributes: ['groupId'],
      });
      groupIds = memberships.map((m) => m.groupId);
      if (!groupIds.length) return [];
    }

    const since = new Date(Date.now() - RECENT_ENDED_WINDOW_MS);
    const rows = await Meeting.findAll({
      where: {
        groupId: groupIds,
        [Op.or]: [
          { status: ['live', 'scheduled'] },
          { status: 'ended', endedAt: { [Op.gte]: since } },
        ],
      },
      include: [
        { model: User, as: 'host', attributes: USER_ATTRS },
        { model: Group, as: 'group', attributes: ['id', 'name', 'avatar'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    const rank = { live: 0, scheduled: 1, ended: 2 };
    rows.sort((a, b) => {
      const r = rank[a.status] - rank[b.status];
      if (r !== 0) return r;
      if (a.status === 'scheduled') {
        // Unscheduled ("start any time") entries sink below dated ones.
        const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
        const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
        return at - bt;
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // Participant counts in one grouped query (no N+1).
    const counts = await MeetingParticipant.findAll({
      where: { meetingId: rows.map((m) => m.id), leftAt: null },
      attributes: ['meetingId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['meetingId'],
      raw: true,
    });
    const countMap = Object.fromEntries(counts.map((c) => [c.meetingId, parseInt(c.count, 10) || 0]));

    return rows.map((m) => ({
      ...m.toJSON(),
      participantCount: countMap[m.id] || 0,
      capabilities: CAPABILITIES,
    }));
  }

  async function getMeeting(meetingId, user) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, user.id);
    return present(meeting, user.id, membership);
  }

  // ---- Lifecycle ----

  async function updateMeeting(meetingId, actor, patch) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, actor.id);
    if (!canManage(meeting, membership, actor.id)) throw httpError('FORBIDDEN', 403);
    if (meeting.status !== 'scheduled') throw httpError('NOT_EDITABLE', 409);
    if (patch.title != null) meeting.title = patch.title;
    if (patch.description !== undefined) meeting.description = patch.description;
    if (patch.scheduledAt !== undefined) meeting.scheduledAt = patch.scheduledAt;
    await meeting.save();
    return present(meeting, actor.id, membership);
  }

  async function startMeeting(meetingId, actor) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, actor.id);
    if (!canManage(meeting, membership, actor.id)) throw httpError('FORBIDDEN', 403);
    if (meeting.status === 'live') return present(meeting, actor.id, membership); // idempotent
    if (meeting.status !== 'scheduled') throw httpError('INVALID_STATE', 409);

    const now = new Date();
    await sequelize.transaction(async (transaction) => {
      meeting.status = 'live';
      meeting.startedAt = now;
      await meeting.save({ transaction });
      await upsertParticipant(meeting.id, actor.id, actor.id === meeting.hostId ? 'host' : 'participant', now, transaction);
      await postSystemMessage(meeting.groupId, actor.id, `${actor.displayName || actor.username} started the meeting: ${meeting.title}`, transaction);
    });
    return present(meeting, actor.id, membership);
  }

  async function endMeeting(meetingId, actor) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, actor.id);
    if (!canManage(meeting, membership, actor.id)) throw httpError('FORBIDDEN', 403);
    if (meeting.status === 'ended') return present(meeting, actor.id, membership); // idempotent
    if (meeting.status !== 'live') throw httpError('INVALID_STATE', 409);

    const now = new Date();
    await sequelize.transaction(async (transaction) => {
      meeting.status = 'ended';
      meeting.endedAt = now;
      await meeting.save({ transaction });
      await MeetingParticipant.update({ leftAt: now }, { where: { meetingId: meeting.id, leftAt: null }, transaction });
      await postSystemMessage(meeting.groupId, actor.id, `Meeting ended: ${meeting.title}`, transaction);
    });
    // DB is the record of truth; tearing down the SFU room is best-effort so
    // voices can't linger after lifecycle flip. Never awaited in the request
    // path — a slow/unreachable SFU must not fail the "end" that already
    // committed.
    if (av?.enabled) {
      Promise.resolve(av.onMeetingEnded(meeting.id)).catch(() => {});
    }
    return present(meeting, actor.id, membership);
  }

  async function cancelMeeting(meetingId, actor) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, actor.id);
    if (!canManage(meeting, membership, actor.id)) throw httpError('FORBIDDEN', 403);
    if (meeting.status === 'cancelled') return present(meeting, actor.id, membership);
    if (meeting.status !== 'scheduled') throw httpError('INVALID_STATE', 409);
    await sequelize.transaction(async (transaction) => {
      meeting.status = 'cancelled';
      await meeting.save({ transaction });
      await postSystemMessage(meeting.groupId, actor.id, `Meeting cancelled: ${meeting.title}`, transaction);
    });
    return present(meeting, actor.id, membership);
  }

  // ---- Presence ----

  async function upsertParticipant(meetingId, userId, role, now, transaction) {
    const [row, created] = await MeetingParticipant.findOrCreate({
      where: { meetingId, userId },
      defaults: { meetingId, userId, role, joinedAt: now, leftAt: null },
      transaction,
    });
    if (!created) {
      row.joinedAt = now;
      row.leftAt = null;
      if (role === 'host') row.role = 'host';
      await row.save({ transaction });
    }
    return row;
  }

  async function joinMeeting(meetingId, user) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, user.id);
    if (meeting.status !== 'live') throw httpError('NOT_LIVE', 409);
    await upsertParticipant(meeting.id, user.id, user.id === meeting.hostId ? 'host' : 'participant', new Date());
    return present(meeting, user.id, membership);
  }

  async function leaveMeeting(meetingId, user) {
    const meeting = await loadMeeting(meetingId);
    const membership = await requireMembership(meeting.groupId, user.id);
    await MeetingParticipant.update(
      { leftAt: new Date() },
      { where: { meetingId: meeting.id, userId: user.id, leftAt: null } },
    );
    return present(meeting, user.id, membership);
  }

  async function listParticipants(meetingId, user) {
    const meeting = await loadMeeting(meetingId);
    await requireMembership(meeting.groupId, user.id);
    return activeParticipants(meeting.id);
  }

  /**
   * Mint a single-room, short-lived SFU join credential for a member of a
   * LIVE meeting. Every check that gates joining also gates media access —
   * membership, registered (non-guest) and status==live. The client ends up
   * with { token, url, room }; the API secret never leaves this process.
   */
  async function grantMediaAccess(meetingId, user) {
    if (!av?.enabled) throw httpError('FEATURE_DISABLED', 501);
    const meeting = await loadMeeting(meetingId);
    await requireMembership(meeting.groupId, user.id);
    if (meeting.status !== 'live') throw httpError('NOT_LIVE', 409);
    const grant = await av.mintJoinToken({ meeting, user });
    return { meeting: await present(meeting, user.id, null), ...grant };
  }

  /** Cascade used when a group is deleted. */
  async function deleteForGroup(groupId, transaction) {
    const ids = (await Meeting.findAll({ where: { groupId }, attributes: ['id'], transaction })).map((m) => m.id);
    if (!ids.length) return 0;
    await MeetingParticipant.destroy({ where: { meetingId: ids }, transaction });
    await Meeting.destroy({ where: { id: ids }, transaction });
    // Best-effort SFU cleanup of any live rooms (never fails the group delete).
    if (av?.enabled) {
      for (const id of ids) {
        Promise.resolve(av.onMeetingEnded(id)).catch(() => {});
      }
    }
    return ids.length;
  }

  /** Member ids of the meeting's group — used by the route layer for notifications. */
  async function groupMemberIds(groupId) {
    const rows = await groupModels.GroupMember.findAll({ where: { groupId }, attributes: ['userId'] });
    return rows.map((r) => r.userId);
  }

  return {
    CAPABILITIES,
    createMeeting,
    listMeetings,
    getMeeting,
    updateMeeting,
    startMeeting,
    endMeeting,
    cancelMeeting,
    joinMeeting,
    leaveMeeting,
    listParticipants,
    grantMediaAccess,
    deleteForGroup,
    groupMemberIds,
  };
}

module.exports = { buildMeetingService };
