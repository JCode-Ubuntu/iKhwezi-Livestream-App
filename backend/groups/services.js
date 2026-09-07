'use strict';

/**
 * Group Chat — service layer.
 *
 * Pure business logic. No Express, no Socket.IO — routes and socket handlers
 * call into this and translate the results to HTTP/socket responses. This is
 * what keeps the route files thin and makes the logic unit-testable.
 *
 * Security invariants enforced here (not in routes):
 *  - A user only sees groups they are a member of (no enumeration).
 *  - Only members can read messages or post.
 *  - Role checks via permissions.js before any mutation.
 *  - Banned users cannot rejoin or act.
 */

const { Op } = require('sequelize');
const { isUuid } = require('./validation');
const perms = require('./permissions');

const USER_ATTRS = ['id', 'username', 'displayName', 'avatar'];

function buildGroupService(models) {
  const {
    Group, GroupMember, GroupMessage, GroupMessageRead,
    GroupInvite, GroupMute, GroupBan, GroupReaction,
    User,
  } = models;

  const sequelize = Group.sequelize;

  // Other feature modules (meetings) register cleanup that must run inside the
  // same transaction as a group deletion.
  const groupDeletedHooks = [];
  function onGroupDeleted(fn) {
    if (typeof fn === 'function') groupDeletedHooks.push(fn);
  }

  async function getMembership(groupId, userId) {
    if (!isUuid(groupId) || !isUuid(userId)) return null;
    return GroupMember.findOne({ where: { groupId, userId } });
  }

  /**
   * Resolve a list of candidate user ids to the subset that can actually be
   * added to a group: valid UUIDs, existing, not banned, not guest sessions.
   * Prevents dangling GroupMember rows that point at deleted or guest users.
   */
  async function resolveAddableUserIds(candidateIds, { exclude = [] } = {}) {
    const wanted = [...new Set((candidateIds || []).filter(isUuid))]
      .filter((id) => !exclude.includes(id));
    if (!wanted.length) return [];
    const users = await User.findAll({
      where: { id: wanted, isBanned: false, isGuest: false },
      attributes: ['id'],
    });
    return users.map((u) => u.id);
  }

  async function isBanned(groupId, userId) {
    if (!isUuid(groupId) || !isUuid(userId)) return false;
    return !!(await GroupBan.findOne({ where: { groupId, userId } }));
  }

  async function assertMember(groupId, userId) {
    const m = await getMembership(groupId, userId);
    if (!m) return null;
    return m;
  }

  // ---- Listing / discovery ----

  async function listGroupsForUser(userId, { search } = {}) {
    const memberships = await GroupMember.findAll({
      where: { userId },
      include: [{
        model: Group,
        as: 'group',
        required: true,
        where: search ? { name: { [Op.like]: `%${search}%` } } : undefined,
      }],
      order: [['joinedAt', 'DESC']],
    });
    return memberships.map((m) => m.group);
  }

  async function getGroupForUser(groupId, userId) {
    const membership = await getMembership(groupId, userId);
    if (!membership) return { group: null, membership: null };
    const group = await Group.findByPk(groupId);
    return { group, membership };
  }

  /**
   * Unread count for one membership: messages from others newer than the
   * member's lastRead pointer. A dangling pointer (message deleted) counts
   * everything from others as unread, which is the safe direction.
   */
  async function countUnread(groupId, userId, lastReadMessageId) {
    const base = { groupId, senderId: { [Op.ne]: userId } };
    if (!lastReadMessageId) return GroupMessage.count({ where: base });
    const lastRead = await GroupMessage.findByPk(lastReadMessageId, { attributes: ['id', 'createdAt'] });
    if (!lastRead) return GroupMessage.count({ where: base });
    return GroupMessage.count({ where: { ...base, createdAt: { [Op.gt]: lastRead.createdAt } } });
  }

  async function buildMeta(group, membership, userId) {
    const groupId = group.id;
    const [memberCount, lastMessage, unread, memberPreview, mute] = await Promise.all([
      GroupMember.count({ where: { groupId } }),
      GroupMessage.findOne({
        where: { groupId },
        order: [['createdAt', 'DESC']],
        include: [{ model: User, as: 'sender', attributes: USER_ATTRS }],
      }),
      countUnread(groupId, userId, membership?.lastReadMessageId),
      // First few members (with user) for avatar mosaic previews in lists.
      GroupMember.findAll({
        where: { groupId },
        include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
        order: [['role', 'DESC'], ['joinedAt', 'ASC']],
        limit: 4,
      }),
      GroupMute.findOne({ where: { groupId, userId }, attributes: ['id'] }),
    ]);

    return {
      group,
      membership,
      memberCount,
      members: memberPreview,
      unread,
      lastMessage,
      muted: !!mute,
    };
  }

  async function getGroupMeta(groupId, userId) {
    // Group + member count + last message + unread count for one user.
    const { group, membership } = await getGroupForUser(groupId, userId);
    if (!group) return null;
    return buildMeta(group, membership, userId);
  }

  /**
   * Conversations-style list: every group the user is in, with last message +
   * unread count. Used by the Messages screen "Groups" filter.
   */
  async function listGroupThreads(userId) {
    const memberships = await GroupMember.findAll({
      where: { userId },
      include: [{ model: Group, as: 'group', required: true }],
    });
    const threads = await Promise.all(
      memberships.map((m) => buildMeta(m.group, m, userId)),
    );
    // Newest activity first.
    threads.sort((a, b) => {
      const at = a.lastMessage?.createdAt || a.group.createdAt;
      const bt = b.lastMessage?.createdAt || b.group.createdAt;
      return new Date(bt) - new Date(at);
    });
    return threads;
  }

  // ---- Creation ----

  async function createGroup(owner, { name, description, avatar, isPrivate, memberIds = [] }) {
    // Duplicate-name check scoped to the same owner.
    const existing = await Group.findOne({
      where: { ownerId: owner.id, name: { [Op.like]: name } },
    });
    if (existing) {
      const err = new Error('DUPLICATE_NAME');
      err.status = 409;
      throw err;
    }

    // Only real, active accounts become members — never guests, banned or
    // non-existent ids (which would otherwise leave dangling membership rows).
    const addable = await resolveAddableUserIds(memberIds, { exclude: [owner.id] });

    // Group + owner membership + initial members are one atomic unit: a crash
    // between the inserts must never leave an owner-less group behind.
    const group = await sequelize.transaction(async (transaction) => {
      const created = await Group.create({
        name,
        description: description || null,
        avatar: avatar || null,
        ownerId: owner.id,
        isPrivate: isPrivate !== false,
      }, { transaction });

      await GroupMember.create(
        { groupId: created.id, userId: owner.id, role: 'owner' },
        { transaction },
      );

      if (addable.length) {
        await GroupMember.bulkCreate(
          addable.map((userId) => ({ groupId: created.id, userId, role: 'member' })),
          { ignoreDuplicates: true, transaction },
        );
      }
      return created;
    });

    return { group, addedMemberIds: addable };
  }

  // ---- Membership ops ----

  async function joinGroup(groupId, user) {
    if (await isBanned(groupId, user.id)) {
      const err = new Error('BANNED'); err.status = 403; throw err;
    }
    // Already a member? Idempotent no-op.
    const existing = await GroupMember.findOne({ where: { groupId, userId: user.id } });
    if (existing) return { membership: existing, created: false };
    const group = await Group.findByPk(groupId);
    if (!group) { const err = new Error('NOT_FOUND'); err.status = 404; throw err; }
    // Private groups require a pending invite (or an admin to add directly
    // via addMember). This prevents anyone from self-joining a private group
    // by guessing its UUID.
    if (group.isPrivate) {
      const invite = await GroupInvite.findOne({
        where: { groupId, invitedUserId: user.id, status: 'pending' },
      });
      if (!invite) {
        const err = new Error('INVITE_REQUIRED'); err.status = 403; throw err;
      }
      invite.status = 'accepted';
      await invite.save();
    }
    const membership = await GroupMember.create({ groupId, userId: user.id, role: 'member' });
    return { membership, created: true };
  }

  async function leaveGroup(groupId, user) {
    const membership = await getMembership(groupId, user.id);
    if (!membership) return { left: false };
    if (membership.role === 'owner') {
      const err = new Error('OWNER_CANNOT_LEAVE'); err.status = 400; throw err;
    }
    await membership.destroy();
    return { left: true };
  }

  /**
   * Admin/owner adds one or more users directly. Returns the ids that were
   * actually added (skips: non-members of the platform, guests, banned-from-
   * group users, existing members). Idempotent under the unique index.
   */
  async function addMembers(groupId, actor, targetUserIds) {
    const actorM = await assertMember(groupId, actor.id);
    if (!perms.canManageMembers(actorM)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    const candidates = await resolveAddableUserIds(targetUserIds, { exclude: [actor.id] });
    if (!candidates.length) return { added: [], skipped: [...new Set(targetUserIds || [])] };

    const existing = await GroupMember.findAll({ where: { groupId, userId: candidates }, attributes: ['userId'] });
    const already = new Set(existing.map((m) => m.userId));
    const toAdd = candidates.filter((id) => !already.has(id));

    if (toAdd.length) {
      // An explicit re-add by an admin lifts a previous kick (GroupBan is what
      // stops a removed user from silently re-joining a public group).
      await GroupBan.destroy({ where: { groupId, userId: toAdd } });
      await GroupMember.bulkCreate(
        toAdd.map((userId) => ({ groupId, userId, role: 'member' })),
        { ignoreDuplicates: true },
      );
      // A direct add supersedes any pending invite for the same user.
      await GroupInvite.update(
        { status: 'accepted' },
        { where: { groupId, invitedUserId: toAdd, status: 'pending' } },
      ).catch(() => {});
    }

    const skipped = [...new Set(targetUserIds || [])].filter((id) => !toAdd.includes(id));
    return { added: toAdd, skipped };
  }

  // Back-compat single-user wrapper.
  async function addMember(groupId, actor, targetUserId) {
    const { added } = await addMembers(groupId, actor, [targetUserId]);
    const membership = await getMembership(groupId, targetUserId);
    return { membership, created: added.includes(targetUserId) };
  }

  async function removeMember(groupId, actor, targetUserId) {
    const actorM = await assertMember(groupId, actor.id);
    const targetM = await getMembership(groupId, targetUserId);
    if (!targetM) return { removed: false };
    if (targetM.role === 'owner') {
      const err = new Error('CANNOT_REMOVE_OWNER'); err.status = 400; throw err;
    }
    if (!perms.canRemove(actorM, targetM.role)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    // Removing a member is a kick: record a ban so they cannot simply re-join a
    // public group. An admin can lift it by explicitly re-adding them.
    await sequelize.transaction(async (transaction) => {
      await targetM.destroy({ transaction });
      await GroupBan.findOrCreate({
        where: { groupId, userId: targetUserId },
        defaults: { groupId, userId: targetUserId, bannedBy: actor.id },
        transaction,
      });
    });
    return { removed: true };
  }

  async function promoteMember(groupId, actor, targetUserId, newRole) {
    const actorM = await assertMember(groupId, actor.id);
    const targetM = await getMembership(groupId, targetUserId);
    if (!targetM) { const err = new Error('NOT_MEMBER'); err.status = 404; throw err; }
    if (!['admin', 'member'].includes(newRole)) {
      const err = new Error('INVALID_ROLE'); err.status = 400; throw err;
    }
    if (!perms.canPromote(actorM, targetM.role, newRole)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    targetM.role = newRole;
    await targetM.save();
    return targetM;
  }

  async function transferOwnership(groupId, actor, targetUserId) {
    const actorM = await assertMember(groupId, actor.id);
    if (!perms.canTransferOwnership(actorM)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    const targetM = await getMembership(groupId, targetUserId);
    if (!targetM) { const err = new Error('NOT_MEMBER'); err.status = 404; throw err; }
    const group = await Group.findByPk(groupId);
    if (!group) { const err = new Error('NOT_FOUND'); err.status = 404; throw err; }
    // Demote old owner, promote target, move ownership pointer — atomically,
    // so a failure can never leave a group with zero or two owners.
    await sequelize.transaction(async (transaction) => {
      actorM.role = 'admin';
      await actorM.save({ transaction });
      targetM.role = 'owner';
      await targetM.save({ transaction });
      group.ownerId = targetUserId;
      await group.save({ transaction });
    });
    return group;
  }

  // ---- Invites ----

  async function invite(groupId, actor, targetUserId) {
    const actorM = await assertMember(groupId, actor.id);
    if (!perms.canManageMembers(actorM)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    if (await isBanned(groupId, targetUserId)) {
      const err = new Error('BANNED'); err.status = 403; throw err;
    }
    const [invite, created] = await GroupInvite.findOrCreate({
      where: { groupId, invitedUserId: targetUserId },
      defaults: { groupId, invitedBy: actor.id, invitedUserId: targetUserId, status: 'pending' },
    });
    return { invite, created };
  }

  // ---- Group update / delete ----

  async function updateGroup(groupId, actor, patch) {
    const actorM = await assertMember(groupId, actor.id);
    if (!perms.canEditGroup(actorM)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    const group = await Group.findByPk(groupId);
    if (!group) { const err = new Error('NOT_FOUND'); err.status = 404; throw err; }
    if (patch.name != null) group.name = patch.name;
    if (patch.description != null) group.description = patch.description;
    if (patch.avatar != null) group.avatar = patch.avatar;
    if (patch.isPrivate != null) group.isPrivate = patch.isPrivate;
    await group.save();
    return group;
  }

  async function deleteGroup(groupId, actor) {
    const actorM = await assertMember(groupId, actor.id);
    if (!perms.canDeleteGroup(actorM)) {
      const err = new Error('FORBIDDEN'); err.status = 403; throw err;
    }
    // Explicit, transactional cleanup of every child table (message reads and
    // reactions hang off messages, so they are collected first). We don't rely
    // on FK cascades because SQLite only honours them when PRAGMA foreign_keys
    // is on, which differs between environments.
    await sequelize.transaction(async (transaction) => {
      const messageIds = (await GroupMessage.findAll({
        where: { groupId }, attributes: ['id'], transaction,
      })).map((m) => m.id);
      if (messageIds.length) {
        await GroupReaction.destroy({ where: { messageId: messageIds }, transaction });
        await GroupMessageRead.destroy({ where: { messageId: messageIds }, transaction });
      }
      await GroupMessage.destroy({ where: { groupId }, transaction });
      await GroupMember.destroy({ where: { groupId }, transaction });
      await GroupInvite.destroy({ where: { groupId }, transaction });
      await GroupMute.destroy({ where: { groupId }, transaction });
      await GroupBan.destroy({ where: { groupId }, transaction });
      for (const hook of groupDeletedHooks) await hook(groupId, transaction);
      await Group.destroy({ where: { id: groupId }, transaction });
    });
    return true;
  }

  // ---- Messages ----

  async function listMessages(groupId, userId, { page, limit, offset }) {
    const m = await assertMember(groupId, userId);
    if (!m) { const err = new Error('FORBIDDEN'); err.status = 403; throw err; }
    const { rows, count } = await GroupMessage.findAndCountAll({
      where: { groupId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: User, as: 'sender', attributes: USER_ATTRS },
        { model: GroupReaction, as: 'reactions', include: [{ model: User, as: 'user', attributes: USER_ATTRS }] },
      ],
    });
    // Mark messages from others as read by this user (ledger), and advance
    // lastRead pointer — but ONLY when loading the newest page. When paging
    // older messages (offset > 0), advancing lastRead to an older message
    // would rewind unread state and re-mark already-read messages as unread.
    if (rows.length && offset === 0) {
      const newest = rows[0]; // DESC order → rows[0] is newest
      m.lastReadMessageId = newest.id;
      await m.save();
    }
    // Best-effort read ledger for every page (idempotent).
    if (rows.length) {
      await GroupMessageRead.bulkCreate(
        rows.filter((r) => r.senderId !== userId).map((r) => ({ messageId: r.id, userId })),
        { ignoreDuplicates: true },
      ).catch(() => {});
    }
    return {
      messages: rows.reverse(), // chronological for the client
      hasMore: offset + rows.length < count,
      total: count,
    };
  }

  async function sendMessage(groupId, sender, { content, messageType, mediaUrl, clientMessageId = null }) {
    const m = await assertMember(groupId, sender.id);
    if (!m) { const err = new Error('FORBIDDEN'); err.status = 403; throw err; }

    let msg;
    if (clientMessageId) {
      const existing = await GroupMessage.findOne({
        where: { senderId: sender.id, clientMessageId },
      });
      if (existing) msg = existing;
    }

    const isExisting = !!msg;
    if (!msg) {
      msg = await GroupMessage.create({
        groupId,
        senderId: sender.id,
        content: messageType === 'text' ? content : content || null,
        messageType: messageType || 'text',
        mediaUrl: mediaUrl || null,
        clientMessageId,
      });
      // Sender has implicitly read their own message only on first create.
      m.lastReadMessageId = msg.id;
      await m.save();
    }

    const full = await GroupMessage.findByPk(msg.id, {
      include: [
        { model: User, as: 'sender', attributes: USER_ATTRS },
        { model: GroupReaction, as: 'reactions', include: [{ model: User, as: 'user', attributes: USER_ATTRS }] },
      ],
    });
    return { message: full, isExisting };
  }

  async function setRead(groupId, userId, messageId) {
    const m = await assertMember(groupId, userId);
    if (!m) { const err = new Error('FORBIDDEN'); err.status = 403; throw err; }
    if (messageId) {
      const target = await GroupMessage.findByPk(messageId);
      if (target && target.groupId === groupId) {
        m.lastReadMessageId = messageId;
        await m.save();
        await GroupMessageRead.findOrCreate({
          where: { messageId, userId },
          defaults: { messageId, userId },
        }).catch(() => {});
      }
    }
    return m;
  }

  // ---- Reactions ----

  async function setReaction(messageId, user, emoji) {
    const msg = await GroupMessage.findByPk(messageId);
    if (!msg) { const err = new Error('NOT_FOUND'); err.status = 404; throw err; }
    const m = await assertMember(msg.groupId, user.id);
    if (!m) { const err = new Error('FORBIDDEN'); err.status = 403; throw err; }
    const existing = await GroupReaction.findOne({ where: { messageId, userId: user.id } });
    if (existing && existing.emoji === emoji) {
      // Same emoji again → toggle off.
      await existing.destroy();
      return { emoji, removed: true };
    }
    if (existing) {
      existing.emoji = emoji;
      await existing.save();
    } else {
      await GroupReaction.create({ messageId, userId: user.id, emoji });
    }
    return { emoji, removed: false };
  }

  // ---- Members listing ----

  async function listMembers(groupId, userId) {
    const m = await assertMember(groupId, userId);
    if (!m) { const err = new Error('FORBIDDEN'); err.status = 403; throw err; }
    const members = await GroupMember.findAll({
      where: { groupId },
      include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
      order: [['role', 'DESC'], ['joinedAt', 'ASC']],
    });
    return members;
  }

  // ---- Mute ----

  async function setMute(groupId, user, muted) {
    const m = await assertMember(groupId, user.id);
    if (!m) { const err = new Error('FORBIDDEN'); err.status = 403; throw err; }
    if (muted) {
      await GroupMute.findOrCreate({ where: { groupId, userId: user.id }, defaults: { groupId, userId: user.id } });
    } else {
      await GroupMute.destroy({ where: { groupId, userId: user.id } });
    }
    return { muted: !!muted };
  }

  async function isMuted(groupId, userId) {
    return !!(await GroupMute.findOne({ where: { groupId, userId } }));
  }

  return {
    onGroupDeleted,
    getMembership,
    isBanned,
    assertMember,
    listGroupsForUser,
    getGroupForUser,
    getGroupMeta,
    listGroupThreads,
    createGroup,
    joinGroup,
    leaveGroup,
    addMember,
    addMembers,
    resolveAddableUserIds,
    removeMember,
    promoteMember,
    transferOwnership,
    invite,
    updateGroup,
    deleteGroup,
    listMessages,
    sendMessage,
    setRead,
    setReaction,
    listMembers,
    setMute,
    isMuted,
  };
}

module.exports = { buildGroupService };
