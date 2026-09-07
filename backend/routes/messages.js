'use strict';

/**
 * Direct messages (1:1) — REST routes.
 *
 * API surface:
 *   GET  /api/messages/conversations
 *   GET  /api/messages/:userId
 *   POST /api/messages/:userId   { content, clientMessageId? }
 *
 * Hardening:
 *  - :userId must be a UUID and resolve to a real, non-guest, non-banned user.
 *  - A user cannot message themselves.
 *  - Conversation list is computed with one grouped query for unread counts
 *    instead of filtering the full message history in JS per conversation.
 *  - clientMessageId makes retries idempotent: the same (sender, id) pair
 *    returns the existing row instead of creating a duplicate.
 *  - After persistence the server emits 'dm-ack' to the sender and 'new-dm'
 *    to the receiver so both sides can reconcile optimistic UI state.
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const MESSAGE_MAX = 1000;
const CLIENT_MSG_ID_MAX = 64;
const USER_ATTRS = ['id', 'username', 'displayName', 'avatar'];

function isValidClientMessageId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= CLIENT_MSG_ID_MAX && /^[a-zA-Z0-9_-]+$/.test(v);
}

function buildMessageRoutes({ app, io, sequelize, Op, User, DirectMessage, authenticate, requireRegistered, interactionRateLimit, logger = null }) {
  const guards = [authenticate, requireRegistered];
  const sendGuards = interactionRateLimit ? [...guards, interactionRateLimit] : guards;
  const log = logger || { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };

  /** Resolve the other party or answer the request with the right error. */
  async function resolveCounterpart(req, res) {
    const other = req.params.userId;
    if (!isUuid(other)) {
      res.status(404).json({ error: 'User not found' });
      return null;
    }
    if (other === req.user.id) {
      res.status(400).json({ error: 'You cannot message yourself' });
      return null;
    }
    const target = await User.findByPk(other, { attributes: [...USER_ATTRS, 'isGuest', 'isBanned'] });
    if (!target || target.isGuest || target.isBanned) {
      res.status(404).json({ error: 'User not found' });
      return null;
    }
    return target;
  }

  // Get all conversations for the current user
  app.get('/api/messages/conversations', ...guards, async (req, res) => {
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
      if (!otherIds.length) return res.json([]);

      const [others, unreadRows] = await Promise.all([
        User.findAll({ where: { id: otherIds }, attributes: USER_ATTRS }),
        DirectMessage.findAll({
          where: { receiverId: userId, senderId: otherIds, readAt: null },
          attributes: ['senderId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group: ['senderId'],
          raw: true,
        }),
      ]);
      const otherMap = Object.fromEntries(others.map((u) => [u.id, u]));
      const unreadMap = Object.fromEntries(unreadRows.map((r) => [r.senderId, parseInt(r.count, 10) || 0]));

      // Skip conversations whose counterpart no longer exists (deleted user).
      const conversations = otherIds
        .filter((id) => otherMap[id])
        .map((id) => ({
          user: otherMap[id],
          lastMessage: convMap.get(id),
          unread: unreadMap[id] || 0,
        }));
      return res.json(conversations);
    } catch (err) {
      req.logger?.error('conversations error', { error: err?.message || String(err) });
      return res.status(500).json({ error: 'Failed to load conversations' });
    }
  });

  // Get messages between current user and another user
  app.get('/api/messages/:userId', ...guards, async (req, res) => {
    try {
      const target = await resolveCounterpart(req, res);
      if (!target) return undefined;
      const me = req.user.id;
      const other = target.id;
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
      return res.json(messages);
    } catch (err) {
      req.logger?.error('load messages error', { error: err?.message || String(err) });
      return res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  // Send a message
  app.post('/api/messages/:userId', ...sendGuards, async (req, res) => {
    try {
      const target = await resolveCounterpart(req, res);
      if (!target) return undefined;
      const me = req.user.id;
      const content = String(req.body?.content ?? '').trim();
      if (!content) return res.status(400).json({ error: 'Message cannot be empty' });
      if (content.length > MESSAGE_MAX) {
        return res.status(400).json({ error: `Message too long (max ${MESSAGE_MAX} characters)` });
      }
      const clientMessageId = req.body?.clientMessageId || null;
      if (clientMessageId && !isValidClientMessageId(clientMessageId)) {
        return res.status(400).json({ error: 'Invalid clientMessageId' });
      }

      let msg;
      let wasExisting = false;
      if (clientMessageId) {
        const existing = await DirectMessage.findOne({
          where: { senderId: me, clientMessageId },
        });
        if (existing) {
          msg = existing;
          wasExisting = true;
        }
      }

      if (!msg) {
        msg = await DirectMessage.create({
          senderId: me,
          receiverId: target.id,
          content,
          clientMessageId,
        });
      }

      const payload = { ...msg.toJSON(), senderId: me };
      // Receiver gets the message if online (only on first create; a retry
      // would be a duplicate broadcast).
      if (!wasExisting) {
        io.to(`user_${target.id}`).emit('new-dm', payload);
      }
      // Sender gets a delivery ack with their client id so optimistic UI can
      // be replaced reliably.
      io.to(`user_${me}`).emit('dm-ack', {
        receiverId: target.id,
        clientMessageId,
        messageId: msg.id,
        status: 'delivered',
        wasExisting,
      });
      return res.status(wasExisting ? 200 : 201).json(msg);
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        // Another request with the same clientMessageId won the race. Return
        // the persisted row so the client still gets a canonical id.
        const existing = await DirectMessage.findOne({
          where: { senderId: req.user.id, clientMessageId: req.body?.clientMessageId },
        });
        if (existing) return res.json(existing);
      }
      req.logger?.error('send message error', { error: err?.message || String(err) });
      return res.status(500).json({ error: 'Failed to send message' });
    }
  });
}

module.exports = { buildMessageRoutes, isUuid, isValidClientMessageId };
