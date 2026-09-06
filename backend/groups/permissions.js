'use strict';

/**
 * Group Chat — role + permission helpers.
 *
 * Roles: owner > admin > member. The owner is the only role that can transfer
 * ownership, delete the group, or demote admins. Admins manage members and
 * edit details. Members can only chat.
 *
 * Every check here is server-side. The client UI hides/disables actions based
 * on the same role, but that is purely cosmetic — these guards are the
 * actual security boundary.
 */

const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

function rank(role) {
  return ROLE_RANK[role] ?? -1;
}

function canManageMembers(membership) {
  return membership && rank(membership.role) >= rank('admin');
}

function canEditGroup(membership) {
  return membership && rank(membership.role) >= rank('admin');
}

function canRemove(membership, targetRole) {
  // Cannot remove someone of equal or higher rank.
  return membership && rank(membership.role) > rank(targetRole);
}

function canPromote(membership, targetRole, newRole) {
  if (!membership) return false;
  // Only owner can create/demote admins.
  if (newRole === 'admin' && membership.role !== 'owner') return false;
  // Cannot promote someone above your own rank.
  if (rank(newRole) >= rank(membership.role)) return false;
  // Cannot act on someone above your own rank.
  if (rank(targetRole) >= rank(membership.role)) return false;
  return true;
}

function canDeleteGroup(membership) {
  return membership && membership.role === 'owner';
}

function canTransferOwnership(membership) {
  return membership && membership.role === 'owner';
}

module.exports = {
  ROLE_RANK,
  rank,
  canManageMembers,
  canEditGroup,
  canRemove,
  canPromote,
  canDeleteGroup,
  canTransferOwnership,
};
