'use strict';

/**
 * Group Chat — REST routes.
 * Mounted under /api/groups. Reuses the same storage/uploads directory and
 * uuid+ext naming as the rest of iKHWEZI so media resolves via resolveMediaUrl.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { validateGroupName, validateDescription, validateMessage, parsePaging, isUuid, isValidClientMessageId } = require('./validation');

function buildGroupRoutes({ app, models, service, io, authenticate, requireRegistered, interactionRateLimit, logAudit }) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'storage', 'uploads');
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  const avatarUpload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true); else cb(new Error('Only image files are allowed for group avatar'));
    },
  });

  const mediaUpload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', '.m4v'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true); else cb(new Error('Invalid media type'));
    },
  });

  const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;
  const detectMediaType = (filename) => (VIDEO_EXT.test(filename || '') ? 'video' : 'image');
  // Multipart bodies arrive as strings ("true"/"false"); JSON bodies as booleans.
  const parseBool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
  };
  const groupRoom = (id) => `group_${id}`;
  const emitToGroup = (groupId, event, payload) => io.to(groupRoom(groupId)).emit(event, payload);

  /**
   * Membership gate that runs BEFORE multer so a non-member can never make the
   * server write an upload to disk. Populates req.groupMembership.
   */
  const requireMembership = async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Group not found' });
      const membership = await service.getMembership(req.params.id, req.user.id);
      if (!membership) return res.status(403).json({ error: 'Not a member' });
      req.groupMembership = membership;
      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to verify membership' });
    }
  };

  /** Admin/owner gate (also pre-multer for the avatar PATCH). */
  const requireGroupAdmin = async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Group not found' });
      const membership = await service.getMembership(req.params.id, req.user.id);
      if (!membership) return res.status(404).json({ error: 'Group not found' });
      if (!['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Not allowed to edit this group' });
      }
      req.groupMembership = membership;
      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to verify membership' });
    }
  };

  // List the current user's groups (threads with last message + unread).
  app.get('/api/groups', authenticate, requireRegistered, async (req, res) => {
    try {
      res.json(await service.listGroupThreads(req.user.id));
    } catch (err) {
      console.error('list groups error', err);
      res.status(500).json({ error: 'Failed to load groups' });
    }
  });

  // Create a group (multipart: avatar optional + fields).
  app.post('/api/groups', authenticate, requireRegistered, avatarUpload.single('avatar'), async (req, res) => {
    try {
      const nameV = validateGroupName(req.body.name);
      if (!nameV.ok) return res.status(400).json({ error: nameV.error });
      const descV = validateDescription(req.body.description || '');
      if (!descV.ok) return res.status(400).json({ error: descV.error });

      // Accept both multipart (stringified) and JSON (native) bodies.
      let memberIds = req.body.memberIds;
      if (typeof memberIds === 'string') {
        try { memberIds = JSON.parse(memberIds || '[]'); } catch { memberIds = []; }
      }
      memberIds = Array.isArray(memberIds) ? memberIds.filter(isUuid).slice(0, 100) : [];

      const { group, addedMemberIds } = await service.createGroup(req.user, {
        name: nameV.value,
        description: descV.value,
        avatar: req.file ? `/storage/uploads/${req.file.filename}` : null,
        isPrivate: parseBool(req.body.isPrivate, true),
        memberIds,
      });
      await logAudit('GROUP_CREATE', { groupId: group.id, name: group.name }, req.ip);

      // Only users who actually became members are notified.
      for (const mid of addedMemberIds) {
        io.to(`user_${mid}`).emit('group-member-added', {
          groupId: group.id,
          userId: mid,
          group: { id: group.id, name: group.name, avatar: group.avatar },
          addedBy: { id: req.user.id, username: req.user.username },
        });
      }
      res.status(201).json(group);
    } catch (err) {
      if (err.message === 'DUPLICATE_NAME') return res.status(409).json({ error: 'You already have a group with that name' });
      if (/image|file/i.test(err.message || '')) return res.status(400).json({ error: err.message });
      console.error('create group error', err);
      res.status(500).json({ error: 'Failed to create group' });
    }
  });

  // Group meta for the current user.
  app.get('/api/groups/:id', authenticate, requireRegistered, async (req, res) => {
    try {
      const meta = await service.getGroupMeta(req.params.id, req.user.id);
      if (!meta) return res.status(404).json({ error: 'Group not found' });
      res.json(meta);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load group' });
    }
  });

  // Update group details (admin/owner).
  app.patch('/api/groups/:id', authenticate, requireRegistered, requireGroupAdmin, avatarUpload.single('avatar'), async (req, res) => {
    try {
      const patch = {};
      if (req.body.name != null) {
        const v = validateGroupName(req.body.name);
        if (!v.ok) return res.status(400).json({ error: v.error });
        patch.name = v.value;
      }
      if (req.body.description != null) {
        const v = validateDescription(req.body.description);
        if (!v.ok) return res.status(400).json({ error: v.error });
        patch.description = v.value;
      }
      if (req.file) patch.avatar = `/storage/uploads/${req.file.filename}`;
      if (req.body.isPrivate != null) patch.isPrivate = parseBool(req.body.isPrivate, true);

      const group = await service.updateGroup(req.params.id, req.user, patch);
      emitToGroup(group.id, 'group-updated', { group });
      await logAudit('GROUP_UPDATE', { groupId: group.id }, req.ip);
      res.json(group);
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not allowed to edit this group' });
      if (err.status === 404) return res.status(404).json({ error: 'Group not found' });
      res.status(500).json({ error: 'Failed to update group' });
    }
  });

  // Delete group (owner only).
  app.delete('/api/groups/:id', authenticate, requireRegistered, async (req, res) => {
    try {
      const { group } = await service.getGroupForUser(req.params.id, req.user.id);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const members = await service.listMembers(req.params.id, req.user.id);
      const memberIds = members.map((m) => m.userId);
      await service.deleteGroup(req.params.id, req.user);
      emitToGroup(req.params.id, 'group-deleted', { groupId: req.params.id });
      for (const mid of memberIds) io.to(`user_${mid}`).emit('group-deleted', { groupId: req.params.id });
      await logAudit('GROUP_DELETE', { groupId: req.params.id }, req.ip);
      res.json({ deleted: true });
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Only the owner can delete this group' });
      res.status(500).json({ error: 'Failed to delete group' });
    }
  });

  // Members list.
  app.get('/api/groups/:id/members', authenticate, requireRegistered, async (req, res) => {
    try {
      res.json(await service.listMembers(req.params.id, req.user.id));
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not a member' });
      res.status(500).json({ error: 'Failed to load members' });
    }
  });

  // Messages (paginated).
  app.get('/api/groups/:id/messages', authenticate, requireRegistered, async (req, res) => {
    try {
      const paging = parsePaging(req.query);
      res.json(await service.listMessages(req.params.id, req.user.id, paging));
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not a member' });
      res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  // Send message (text or media).
  app.post('/api/groups/:id/messages', authenticate, requireRegistered, interactionRateLimit, requireMembership, mediaUpload.single('media'), async (req, res) => {
    try {
      // The message type is derived from what was actually uploaded — a client
      // cannot declare an "image" message without attaching a file.
      let messageType = 'text';
      let content = req.body.content;
      let mediaUrl = null;
      if (req.file) {
        mediaUrl = `/storage/uploads/${req.file.filename}`;
        messageType = detectMediaType(req.file.filename);
        content = req.body.caption || null;
      }
      const v = validateMessage(content, messageType);
      if (!v.ok && messageType === 'text') return res.status(400).json({ error: v.error });

      const clientMessageId = req.body.clientMessageId || null;
      if (clientMessageId && !isValidClientMessageId(clientMessageId)) {
        return res.status(400).json({ error: 'Invalid clientMessageId' });
      }

      const { message: msg, isExisting } = await service.sendMessage(req.params.id, req.user, {
        content: messageType === 'text' ? v.value : content,
        messageType,
        mediaUrl,
        clientMessageId,
      });
      if (!msg) return res.status(403).json({ error: 'Not a member' });
      if (!isExisting) emitToGroup(req.params.id, 'group-message', msg);
      // Sender ack (targeted delivery guarantees the sender can reconcile
      // optimistic state even if broadcast fails).
      io.to(`user_${req.user.id}`).emit('group-message-ack', {
        groupId: req.params.id,
        clientMessageId,
        messageId: msg.id,
        status: 'delivered',
        wasExisting: isExisting,
      });
      res.status(isExisting ? 200 : 201).json(msg);
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        const existing = await models.GroupMessage.findOne({
          where: { senderId: req.user.id, clientMessageId: req.body?.clientMessageId },
        });
        if (existing) return res.json(existing);
      }
      if (err.status === 403) return res.status(403).json({ error: 'Not a member' });
      console.error('send group message error', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Join / accept invite.
  app.post('/api/groups/:id/join', authenticate, requireRegistered, async (req, res) => {
    try {
      const { created, membership } = await service.joinGroup(req.params.id, req.user);
      if (created) {
        emitToGroup(req.params.id, 'group-member-added', {
          groupId: req.params.id,
          userId: req.user.id,
          user: { id: req.user.id, username: req.user.username, displayName: req.user.displayName, avatar: req.user.avatar },
        });
      }
      res.json({ joined: true, created, role: membership.role });
    } catch (err) {
      if (err.message === 'BANNED') return res.status(403).json({ error: 'You are banned from this group' });
      if (err.message === 'INVITE_REQUIRED') return res.status(403).json({ error: 'You need an invite to join this group' });
      if (err.status === 404) return res.status(404).json({ error: 'Group not found' });
      res.status(500).json({ error: 'Failed to join group' });
    }
  });

  // Leave.
  app.post('/api/groups/:id/leave', authenticate, requireRegistered, async (req, res) => {
    try {
      const { left } = await service.leaveGroup(req.params.id, req.user);
      if (left) {
        emitToGroup(req.params.id, 'group-member-removed', { groupId: req.params.id, userId: req.user.id });
        io.to(`user_${req.user.id}`).emit('group-member-removed', { groupId: req.params.id, userId: req.user.id });
      }
      res.json({ left });
    } catch (err) {
      if (err.message === 'OWNER_CANNOT_LEAVE') return res.status(400).json({ error: 'Transfer ownership before leaving' });
      res.status(500).json({ error: 'Failed to leave group' });
    }
  });

  // Invite.
  app.post('/api/groups/:id/invite', authenticate, requireRegistered, async (req, res) => {
    try {
      const targetUserId = req.body.userId;
      if (!isUuid(targetUserId)) return res.status(400).json({ error: 'Invalid user' });
      const { invite, created } = await service.invite(req.params.id, req.user, targetUserId);
      if (created) {
        io.to(`user_${targetUserId}`).emit('group-invite', {
          groupId: req.params.id,
          inviteId: invite.id,
          invitedBy: { id: req.user.id, username: req.user.username },
        });
      }
      res.json({ invite, created });
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not allowed to invite' });
      res.status(500).json({ error: 'Failed to invite' });
    }
  });

  // Promote / demote.
  app.post('/api/groups/:id/promote', authenticate, requireRegistered, async (req, res) => {
    try {
      const { userId, role: newRole } = req.body;
      if (!isUuid(userId)) return res.status(400).json({ error: 'Invalid user' });
      const membership = await service.promoteMember(req.params.id, req.user, userId, newRole);
      emitToGroup(req.params.id, 'group-updated', { groupId: req.params.id, member: { userId, role: membership.role } });
      res.json({ membership });
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not allowed' });
      if (err.status === 404) return res.status(404).json({ error: 'Member not found' });
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  // Add members directly (admin/owner). Body: { userIds: [uuid] } or { userId }.
  app.post('/api/groups/:id/members', authenticate, requireRegistered, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Group not found' });
      const raw = Array.isArray(req.body.userIds) ? req.body.userIds : [req.body.userId];
      const userIds = raw.filter(isUuid).slice(0, 100);
      if (!userIds.length) return res.status(400).json({ error: 'No valid users supplied' });

      const { added, skipped } = await service.addMembers(req.params.id, req.user, userIds);
      if (added.length) {
        const users = await models.User.findAll({
          where: { id: added }, attributes: ['id', 'username', 'displayName', 'avatar'],
        });
        const group = await models.Group.findByPk(req.params.id, { attributes: ['id', 'name', 'avatar'] });
        for (const u of users) {
          const payload = {
            groupId: req.params.id,
            userId: u.id,
            user: u,
            group,
            addedBy: { id: req.user.id, username: req.user.username },
          };
          emitToGroup(req.params.id, 'group-member-added', payload);
          io.to(`user_${u.id}`).emit('group-member-added', payload);
        }
        await logAudit('GROUP_MEMBERS_ADD', { groupId: req.params.id, count: added.length }, req.ip);
      }
      res.json({ added, skipped });
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not allowed to add members' });
      console.error('add group members error', err);
      res.status(500).json({ error: 'Failed to add members' });
    }
  });

  async function handleRemoveMember(req, res, targetUserId) {
    try {
      if (!isUuid(targetUserId)) return res.status(400).json({ error: 'Invalid user' });
      const { removed } = await service.removeMember(req.params.id, req.user, targetUserId);
      if (removed) {
        emitToGroup(req.params.id, 'group-member-removed', { groupId: req.params.id, userId: targetUserId });
        io.to(`user_${targetUserId}`).emit('group-member-removed', { groupId: req.params.id, userId: targetUserId });
      }
      return res.json({ removed });
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not allowed to remove this member' });
      if (err.message === 'CANNOT_REMOVE_OWNER') return res.status(400).json({ error: 'Cannot remove the owner' });
      return res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  // Remove a member (RESTful form).
  app.delete('/api/groups/:id/members/:userId', authenticate, requireRegistered, (req, res) =>
    handleRemoveMember(req, res, req.params.userId));

  // Remove a member (legacy body form, kept for API compatibility).
  app.post('/api/groups/:id/remove', authenticate, requireRegistered, (req, res) =>
    handleRemoveMember(req, res, req.body.userId));

  // Transfer ownership.
  app.post('/api/groups/:id/transfer', authenticate, requireRegistered, async (req, res) => {
    try {
      const targetUserId = req.body.userId;
      if (!isUuid(targetUserId)) return res.status(400).json({ error: 'Invalid user' });
      const group = await service.transferOwnership(req.params.id, req.user, targetUserId);
      emitToGroup(req.params.id, 'group-updated', { group });
      await logAudit('GROUP_TRANSFER', { groupId: group.id, newOwnerId: targetUserId }, req.ip);
      res.json({ group });
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Only the owner can transfer ownership' });
      if (err.status === 404) return res.status(404).json({ error: 'Member not found' });
      res.status(500).json({ error: 'Failed to transfer ownership' });
    }
  });

  // Mute / unmute (self).
  app.post('/api/groups/:id/mute', authenticate, requireRegistered, async (req, res) => {
    try {
      const muted = req.body.muted !== false;
      res.json(await service.setMute(req.params.id, req.user, muted));
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not a member' });
      res.status(500).json({ error: 'Failed to update mute' });
    }
  });

  // React to a message.
  app.post('/api/groups/messages/:messageId/reaction', authenticate, requireRegistered, interactionRateLimit, async (req, res) => {
    try {
      const emoji = String(req.body.emoji || '').trim().slice(0, 8);
      if (!emoji) return res.status(400).json({ error: 'Invalid reaction' });
      const result = await service.setReaction(req.params.messageId, req.user, emoji);
      const msg = await models.GroupMessage.findByPk(req.params.messageId);
      if (msg) {
        emitToGroup(msg.groupId, 'group-reaction', {
          messageId: msg.id,
          groupId: msg.groupId,
          userId: req.user.id,
          emoji: result.emoji,
          removed: result.removed,
          user: { id: req.user.id, username: req.user.username, displayName: req.user.displayName, avatar: req.user.avatar },
        });
      }
      res.json(result);
    } catch (err) {
      if (err.status === 403) return res.status(403).json({ error: 'Not a member' });
      if (err.status === 404) return res.status(404).json({ error: 'Message not found' });
      res.status(500).json({ error: 'Failed to react' });
    }
  });
}

module.exports = { buildGroupRoutes };
