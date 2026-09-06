'use strict';

/**
 * Meetings — REST routes (mounted under /api/meetings).
 *
 *   POST   /api/meetings                  { groupId, title, description?, scheduledAt?, startNow? }
 *   GET    /api/meetings?groupId=          list visible meetings (all my groups, or one)
 *   GET    /api/meetings/:id
 *   PATCH  /api/meetings/:id              { title?, description?, scheduledAt? }  (scheduled only)
 *   POST   /api/meetings/:id/start
 *   POST   /api/meetings/:id/end
 *   POST   /api/meetings/:id/cancel
 *   POST   /api/meetings/:id/join         (meeting must be live)
 *   POST   /api/meetings/:id/leave
 *   GET    /api/meetings/:id/participants
 *   POST   /api/meetings/:id/media-token  (SFU join credential; 501 when A/V
 *                                          is not configured on this server)
 *
 * Realtime (Socket.IO, emitted to the group room `group_{groupId}` and, for
 * notification-worthy events, to each member's `user_{id}` room):
 *   meeting-created, meeting-updated (any lifecycle change), meeting-participant
 *   ({ meetingId, groupId, userId, action: 'joined'|'left', participantCount }).
 * A `group-message` (system type) is also emitted because the service writes a
 * system message into the group history for create/start/end/cancel.
 */

const { validateTitle, validateDescription, validateScheduledAt, isUuid } = require('./validation');

function mapError(res, err, fallback) {
  const map = {
    FORBIDDEN: [403, 'Not allowed'],
    NOT_FOUND: [404, 'Meeting not found'],
    GROUP_NOT_FOUND: [404, 'Group not found'],
    NOT_LIVE: [409, 'This meeting is not live'],
    INVALID_STATE: [409, 'Meeting is not in a state that allows this action'],
    NOT_EDITABLE: [409, 'Only scheduled meetings can be edited'],
    FEATURE_DISABLED: [501, 'Audio/video is not enabled on this server'],
  };
  const hit = map[err?.message];
  if (hit) return res.status(hit[0]).json({ error: hit[1] });
  if (err?.status === 403) return res.status(403).json({ error: 'Not allowed' });
  if (err?.status === 404) return res.status(404).json({ error: 'Not found' });
  console.error(`${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

function buildMeetingRoutes({ app, io, service, groups, authenticate, requireRegistered, interactionRateLimit, logAudit }) {
  const guards = [authenticate, requireRegistered];
  const groupRoom = (groupId) => `group_${groupId}`;

  const latestSystemMessage = async (groupId) => groups.models.GroupMessage.findOne({
    where: { groupId, messageType: 'system' },
    order: [['createdAt', 'DESC']],
    include: [{ model: groups.models.User, as: 'sender', attributes: ['id', 'username', 'displayName', 'avatar'] }],
  });

  /** Broadcast a lifecycle change to the group room (+ user rooms when notify). */
  async function broadcast(event, meeting, { notify = false } = {}) {
    const payload = { meetingId: meeting.id, groupId: meeting.groupId, meeting };
    io.to(groupRoom(meeting.groupId)).emit(event, payload);
    // The service writes a system message for lifecycle events; push it so open
    // chats render it without a refetch.
    const sys = await latestSystemMessage(meeting.groupId).catch(() => null);
    if (sys) io.to(groupRoom(meeting.groupId)).emit('group-message', sys);
    if (notify) {
      const memberIds = await service.groupMemberIds(meeting.groupId).catch(() => []);
      for (const uid of memberIds) io.to(`user_${uid}`).emit(event, payload);
    }
  }

  app.post('/api/meetings', ...guards, interactionRateLimit, async (req, res) => {
    try {
      const { groupId, description, scheduledAt } = req.body || {};
      const startNow = req.body?.startNow === true || req.body?.startNow === 'true';
      if (!isUuid(groupId)) return res.status(400).json({ error: 'Select a group for this meeting' });
      const t = validateTitle(req.body?.title);
      if (!t.ok) return res.status(400).json({ error: t.error });
      const d = validateDescription(description);
      if (!d.ok) return res.status(400).json({ error: d.error });
      const s = validateScheduledAt(scheduledAt);
      if (!s.ok) return res.status(400).json({ error: s.error });

      const meeting = await service.createMeeting(req.user, {
        groupId, title: t.value, description: d.value, scheduledAt: s.value, startNow,
      });
      await logAudit('MEETING_CREATE', { meetingId: meeting.id, groupId, startNow }, req.ip);
      await broadcast('meeting-created', meeting, { notify: true });
      return res.status(201).json(meeting);
    } catch (err) {
      return mapError(res, err, 'Failed to create meeting');
    }
  });

  app.get('/api/meetings', ...guards, async (req, res) => {
    try {
      const groupId = req.query.groupId ? String(req.query.groupId) : undefined;
      return res.json(await service.listMeetings(req.user, { groupId }));
    } catch (err) {
      return mapError(res, err, 'Failed to load meetings');
    }
  });

  app.get('/api/meetings/:id', ...guards, async (req, res) => {
    try {
      return res.json(await service.getMeeting(req.params.id, req.user));
    } catch (err) {
      return mapError(res, err, 'Failed to load meeting');
    }
  });

  app.patch('/api/meetings/:id', ...guards, async (req, res) => {
    try {
      const patch = {};
      if (req.body?.title != null) {
        const t = validateTitle(req.body.title);
        if (!t.ok) return res.status(400).json({ error: t.error });
        patch.title = t.value;
      }
      if (req.body?.description !== undefined) {
        const d = validateDescription(req.body.description);
        if (!d.ok) return res.status(400).json({ error: d.error });
        patch.description = d.value;
      }
      if (req.body?.scheduledAt !== undefined) {
        const s = validateScheduledAt(req.body.scheduledAt);
        if (!s.ok) return res.status(400).json({ error: s.error });
        patch.scheduledAt = s.value;
      }
      const meeting = await service.updateMeeting(req.params.id, req.user, patch);
      await broadcast('meeting-updated', meeting);
      return res.json(meeting);
    } catch (err) {
      return mapError(res, err, 'Failed to update meeting');
    }
  });

  const lifecycle = (action, fn, { notify = false, audit } = {}) => async (req, res) => {
    try {
      const meeting = await fn(req.params.id, req.user);
      if (audit) await logAudit(audit, { meetingId: meeting.id }, req.ip);
      await broadcast('meeting-updated', meeting, { notify });
      return res.json(meeting);
    } catch (err) {
      return mapError(res, err, `Failed to ${action} meeting`);
    }
  };

  app.post('/api/meetings/:id/start', ...guards, lifecycle('start', service.startMeeting, { notify: true, audit: 'MEETING_START' }));
  app.post('/api/meetings/:id/end', ...guards, lifecycle('end', service.endMeeting, { audit: 'MEETING_END' }));
  app.post('/api/meetings/:id/cancel', ...guards, lifecycle('cancel', service.cancelMeeting, { audit: 'MEETING_CANCEL' }));

  const presence = (action, fn) => async (req, res) => {
    try {
      const meeting = await fn(req.params.id, req.user);
      io.to(groupRoom(meeting.groupId)).emit('meeting-participant', {
        meetingId: meeting.id,
        groupId: meeting.groupId,
        userId: req.user.id,
        user: { id: req.user.id, username: req.user.username, displayName: req.user.displayName, avatar: req.user.avatar },
        action,
        participantCount: meeting.participantCount,
      });
      return res.json(meeting);
    } catch (err) {
      return mapError(res, err, `Failed to ${action === 'joined' ? 'join' : 'leave'} meeting`);
    }
  };

  app.post('/api/meetings/:id/join', ...guards, interactionRateLimit, presence('joined', service.joinMeeting));
  app.post('/api/meetings/:id/leave', ...guards, presence('left', service.leaveMeeting));

  app.get('/api/meetings/:id/participants', ...guards, async (req, res) => {
    try {
      return res.json(await service.listParticipants(req.params.id, req.user));
    } catch (err) {
      return mapError(res, err, 'Failed to load participants');
    }
  });

  /**
   * Join credential for the SFU (LiveKit). Authz is fully server-side: only a
   * registered member of the meeting's group, for a LIVE meeting, may mint.
   * 501 when the operator has not configured LiveKit — the client then keeps
   * the presence-only UX (capabilities already said audio/video unavailable).
   */
  app.post('/api/meetings/:id/media-token', ...guards, interactionRateLimit, async (req, res) => {
    try {
      const grant = await service.grantMediaAccess(req.params.id, req.user);
      await logAudit('MEETING_MEDIA_TOKEN', { meetingId: req.params.id }, req.ip);
      return res.json(grant);
    } catch (err) {
      if (err?.message === 'FEATURE_DISABLED') {
        return res.status(501).json({ error: 'Audio/video is not enabled on this server' });
      }
      return mapError(res, err, 'Failed to join meeting media');
    }
  });
}

module.exports = { buildMeetingRoutes };
