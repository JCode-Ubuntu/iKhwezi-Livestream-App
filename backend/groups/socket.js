'use strict';

/**
 * Group Chat — Socket.IO handlers.
 *
 * Socket.IO allows multiple `io.on('connection')` listeners, so this mounts
 * alongside the existing connection handler in backend/index.js without
 * touching it. `socket.user` is already populated by the io.use auth middleware
 * (JWT-verified, banned users are nulled out there).
 *
 * Room convention: `group_{groupId}` — mirrors the `user_{userId}` convention
 * already used for personal rooms.
 *
 * Security:
 *  - The JWT identity on `socket.user` is authoritative; client payloads never
 *    carry a userId that we trust.
 *  - Guests (isGuest) can hold a socket but cannot join group rooms or act.
 *  - Joining a room requires an actual GroupMember row — there is no raw
 *    room-join escape hatch.
 *  - Socket sends are text-only. Media goes through the authenticated
 *    multipart REST route, so a client cannot inject an arbitrary mediaUrl.
 *
 * Events (client → server): group-join, group-leave, group-message,
 * group-typing, group-read, group-reaction.
 * Events (server → client): group-message, group-typing, group-read,
 * group-reaction, group-member-added, group-member-removed, group-updated,
 * group-deleted (the last four are emitted from the REST layer).
 */

const { isUuid, validateMessage, isValidClientMessageId } = require('./validation');

const GROUP_ROOM = (id) => `group_${id}`;

function buildGroupSocket({ io, models, service }) {
  io.on('connection', (socket) => {
    const actor = () => {
      const u = socket.user;
      if (!u || u.isBanned || u.isGuest) return null;
      return u;
    };

    socket.on('group-join', async (groupId) => {
      const user = actor();
      if (!user || !isUuid(groupId)) return;
      try {
        const membership = await service.getMembership(groupId, user.id);
        if (!membership) return; // never auto-join non-members
        socket.join(GROUP_ROOM(groupId));
      } catch (err) {
        console.warn('group-join failed:', err.message);
      }
    });

    socket.on('group-leave', (groupId) => {
      if (!isUuid(groupId)) return;
      socket.leave(GROUP_ROOM(groupId));
    });

    socket.on('group-message', async (payload, ack) => {
      const user = actor();
      if (!user) return ack?.({ error: 'Sign in to continue' });
      try {
        const { groupId, content, clientMessageId } = payload || {};
        if (!isUuid(groupId)) return ack?.({ error: 'Invalid group' });
        if (clientMessageId && !isValidClientMessageId(clientMessageId)) {
          return ack?.({ error: 'Invalid clientMessageId' });
        }
        const v = validateMessage(content, 'text');
        if (!v.ok) return ack?.({ error: v.error });
        const { message: msg, isExisting } = await service.sendMessage(groupId, user, {
          content: v.value,
          messageType: 'text',
          mediaUrl: null,
          clientMessageId,
        });
        if (!msg) return ack?.({ error: 'Not a member' });
        if (!isExisting) io.to(GROUP_ROOM(groupId)).emit('group-message', msg);
        // Ack to the sending socket specifically (replaces optimistic UI).
        socket.emit('group-message-ack', {
          groupId,
          clientMessageId,
          messageId: msg.id,
          status: 'delivered',
          wasExisting: isExisting,
        });
        return ack?.({ ok: true, message: msg });
      } catch (err) {
        if (err?.name === 'SequelizeUniqueConstraintError') {
          const existing = await models.GroupMessage.findOne({
            where: { senderId: user.id, clientMessageId: payload?.clientMessageId },
          });
          if (existing) return ack?.({ ok: true, message: existing });
        }
        if (err.status === 403) return ack?.({ error: 'Not a member' });
        console.error('socket group-message error', err);
        return ack?.({ error: 'Failed to send' });
      }
    });

    socket.on('group-typing', (payload) => {
      const user = actor();
      const { groupId, isTyping } = payload || {};
      if (!user || !isUuid(groupId)) return;
      // Only members are in the room, and `socket.to` excludes the sender.
      if (!socket.rooms.has(GROUP_ROOM(groupId))) return;
      socket.to(GROUP_ROOM(groupId)).emit('group-typing', {
        groupId,
        userId: user.id,
        username: user.username || user.displayName,
        isTyping: !!isTyping,
      });
    });

    socket.on('group-read', async (payload) => {
      const user = actor();
      const { groupId, messageId } = payload || {};
      if (!user || !isUuid(groupId)) return;
      if (messageId != null && !isUuid(messageId)) return;
      try {
        await service.setRead(groupId, user.id, messageId);
      } catch {
        return; // non-member: silently ignore
      }
      socket.to(GROUP_ROOM(groupId)).emit('group-read', {
        groupId,
        userId: user.id,
        messageId,
      });
    });

    socket.on('group-reaction', async (payload) => {
      const user = actor();
      if (!user) return;
      try {
        const { messageId, emoji } = payload || {};
        if (!isUuid(messageId)) return;
        const e = String(emoji || '').trim().slice(0, 8);
        if (!e) return;
        const result = await service.setReaction(messageId, user, e);
        const msg = await models.GroupMessage.findByPk(messageId);
        if (msg) {
          io.to(GROUP_ROOM(msg.groupId)).emit('group-reaction', {
            messageId: msg.id,
            groupId: msg.groupId,
            userId: user.id,
            emoji: result.emoji,
            removed: result.removed,
            user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar },
          });
        }
      } catch { /* permission or lookup failure — nothing to broadcast */ }
    });
  });
}

module.exports = { buildGroupSocket, GROUP_ROOM };
