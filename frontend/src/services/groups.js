import { getApiBase, resolveMediaUrl } from '../config/appConfig';
import { parseJsonResponse } from '../utils/apiFetch';

/**
 * Group Chat — REST client.
 * All calls go through the authenticated fetch from AuthContext, so this
 * module takes `fetchWithAuth` as a dependency rather than importing a global.
 * That keeps it testable and avoids a circular import with AuthContext.
 *
 * Consumers should obtain an instance via `useGroupsApi()` (memoized) rather
 * than calling `buildGroupsApi` in a component body.
 */

function buildGroupsApi(fetchWithAuth) {
  const base = getApiBase();

  async function call(path, options = {}) {
    const res = await fetchWithAuth(path, options);
    const data = await parseJsonResponse(res).catch(() => ({}));
    return { res, data };
  }

  // Multipart requests must NOT carry a JSON Content-Type header, so they
  // bypass fetchWithAuth's default headers and attach the bearer token directly.
  async function multipart(path, method, form) {
    const token = localStorage.getItem('ikhwezi_token');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await parseJsonResponse(res).catch(() => ({}));
    return { res, data };
  }

  function fail(data, fallback) {
    return new Error(data?.error || fallback);
  }

  async function listThreads() {
    const { res, data } = await call('/groups');
    if (!res.ok) throw fail(data, 'Failed to load groups');
    return Array.isArray(data) ? data : [];
  }

  async function getGroup(id) {
    const { res, data } = await call(`/groups/${id}`);
    if (!res.ok) throw fail(data, 'Failed to load group');
    return data;
  }

  async function listMembers(id) {
    const { res, data } = await call(`/groups/${id}/members`);
    if (!res.ok) throw fail(data, 'Failed to load members');
    return Array.isArray(data) ? data : [];
  }

  async function listMessages(id, { page = 1, limit = 30 } = {}) {
    const { res, data } = await call(`/groups/${id}/messages?page=${page}&limit=${limit}`);
    if (!res.ok) throw fail(data, 'Failed to load messages');
    return { messages: data.messages || [], hasMore: !!data.hasMore, total: data.total || 0 };
  }

  async function sendText(id, content) {
    const { res, data } = await call(`/groups/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType: 'text' }),
    });
    if (!res.ok) throw fail(data, 'Failed to send');
    return data;
  }

  async function sendMedia(id, file, caption = '') {
    const form = new FormData();
    form.append('media', file);
    if (caption) form.append('caption', caption);
    const { res, data } = await multipart(`/groups/${id}/messages`, 'POST', form);
    if (!res.ok) throw fail(data, 'Failed to upload');
    return data;
  }

  async function createGroup({ name, description, avatarFile, isPrivate, memberIds }) {
    const form = new FormData();
    form.append('name', name);
    if (description) form.append('description', description);
    form.append('isPrivate', isPrivate ? 'true' : 'false');
    form.append('memberIds', JSON.stringify(memberIds || []));
    if (avatarFile) form.append('avatar', avatarFile);
    const { res, data } = await multipart('/groups', 'POST', form);
    if (!res.ok) throw fail(data, 'Failed to create group');
    return data;
  }

  async function updateGroup(id, { name, description, avatarFile, isPrivate }) {
    const form = new FormData();
    if (name != null) form.append('name', name);
    if (description != null) form.append('description', description);
    if (isPrivate != null) form.append('isPrivate', isPrivate ? 'true' : 'false');
    if (avatarFile) form.append('avatar', avatarFile);
    const { res, data } = await multipart(`/groups/${id}`, 'PATCH', form);
    if (!res.ok) throw fail(data, 'Failed to update group');
    return data;
  }

  async function deleteGroup(id) {
    const { res, data } = await call(`/groups/${id}`, { method: 'DELETE' });
    if (!res.ok) throw fail(data, 'Failed to delete group');
    return data;
  }

  async function leaveGroup(id) {
    const { res, data } = await call(`/groups/${id}/leave`, { method: 'POST' });
    if (!res.ok) throw fail(data, 'Failed to leave group');
    return data;
  }

  /** Admin/owner adds members directly (no invite round-trip). */
  async function addMembers(id, userIds) {
    const { res, data } = await call(`/groups/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
    if (!res.ok) throw fail(data, 'Failed to add members');
    return data;
  }

  async function removeMember(id, userId) {
    const { res, data } = await call(`/groups/${id}/members/${userId}`, { method: 'DELETE' });
    if (!res.ok) throw fail(data, 'Failed to remove member');
    return data;
  }

  async function promoteMember(id, userId, role) {
    const { res, data } = await call(`/groups/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) throw fail(data, 'Failed to update role');
    return data;
  }

  async function transferOwnership(id, userId) {
    const { res, data } = await call(`/groups/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw fail(data, 'Failed to transfer ownership');
    return data;
  }

  async function setMute(id, muted) {
    const { res, data } = await call(`/groups/${id}/mute`, {
      method: 'POST',
      body: JSON.stringify({ muted }),
    });
    if (!res.ok) throw fail(data, 'Failed to update mute');
    return data;
  }

  async function react(messageId, emoji) {
    const { res, data } = await call(`/groups/messages/${messageId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) throw fail(data, 'Failed to react');
    return data;
  }

  return {
    listThreads, getGroup, listMembers, listMessages,
    sendText, sendMedia, createGroup, updateGroup, deleteGroup,
    leaveGroup, addMembers, removeMember, promoteMember, transferOwnership, setMute, react,
  };
}

export { buildGroupsApi };
export { resolveMediaUrl };
