import { parseJsonResponse } from '../utils/apiFetch';

/**
 * Meetings — REST client for /api/meetings.
 *
 * Mirrors services/groups.js: takes `fetchWithAuth` as a dependency so it stays
 * testable and free of circular imports. Obtain an instance via
 * `useMeetingsApi()` (memoized) rather than calling this in a component body.
 *
 * Every meeting payload carries `capabilities` — the client must read that to
 * decide what to render. A/V appears ONLY when the server says so (the SFU is
 * configured); otherwise meetings are presence-only.
 */
function buildMeetingsApi(fetchWithAuth) {
  async function call(path, options = {}) {
    const res = await fetchWithAuth(path, options);
    const data = await parseJsonResponse(res).catch(() => ({}));
    return { res, data };
  }

  function fail(data, fallback) {
    return new Error(data?.error || fallback);
  }

  async function create({ groupId, title, description, scheduledAt, startNow }) {
    const { res, data } = await call('/meetings', {
      method: 'POST',
      body: JSON.stringify({ groupId, title, description, scheduledAt, startNow: !!startNow }),
    });
    if (!res.ok) throw fail(data, 'Failed to create meeting');
    return data;
  }

  async function list({ groupId } = {}) {
    const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    const { res, data } = await call(`/meetings${qs}`);
    if (!res.ok) throw fail(data, 'Failed to load meetings');
    return Array.isArray(data) ? data : [];
  }

  async function get(id) {
    const { res, data } = await call(`/meetings/${id}`);
    if (!res.ok) throw fail(data, 'Failed to load meeting');
    return data;
  }

  async function update(id, patch) {
    const { res, data } = await call(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (!res.ok) throw fail(data, 'Failed to update meeting');
    return data;
  }

  const lifecycle = (action, fallback) => async (id) => {
    const { res, data } = await call(`/meetings/${id}/${action}`, { method: 'POST' });
    if (!res.ok) throw fail(data, fallback);
    return data;
  };

  /**
   * Mint a join credential from the backend. Server-side authz: membership +
   * live-status are checked there; the API secret never reaches this code.
   * 501 = A/V not configured on this server → the caller keeps presence-only UX.
   */
  async function mediaToken(id) {
    const { res, data } = await call(`/meetings/${id}/media-token`, { method: 'POST' });
    if (!res.ok) throw fail(data, 'Failed to join meeting media');
    return data; // { token, url, room, meeting }
  }

  return {
    create,
    list,
    get,
    update,
    start: lifecycle('start', 'Failed to start meeting'),
    end: lifecycle('end', 'Failed to end meeting'),
    cancel: lifecycle('cancel', 'Failed to cancel meeting'),
    join: lifecycle('join', 'Failed to join meeting'),
    leave: lifecycle('leave', 'Failed to leave meeting'),
    mediaToken,
  };
}

export { buildMeetingsApi };
