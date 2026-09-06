'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

let h;
test.before(async () => { h = await createHarness(); });
test.after(async () => { await h.close(); });

async function setup() {
  const owner = await h.createUser();
  const member = await h.createUser();
  const stranger = await h.createUser();
  const g = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'Meet group', memberIds: [member.user.id] } });
  assert.equal(g.status, 201);
  return { owner, member, stranger, group: g.data };
}

test('create meeting: validation (group required, title required, past schedule rejected)', async () => {
  const { owner, group } = await setup();
  let r = await h.api('POST', '/api/meetings', { token: owner.token, body: { title: 'Standup' } });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/meetings', { token: owner.token, body: { groupId: group.id } });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/meetings', {
    token: owner.token, body: { groupId: group.id, title: 'Old', scheduledAt: '2000-01-01T00:00:00Z' },
  });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/meetings', {
    token: owner.token, body: { groupId: group.id, title: 'Bad date', scheduledAt: 'not-a-date' },
  });
  assert.equal(r.status, 400);
});

test('only group members can create/see meetings; guests blocked', async () => {
  const { owner, stranger, group } = await setup();
  const guest = await h.createUser({ isGuest: true });

  let r = await h.api('POST', '/api/meetings', { token: stranger.token, body: { groupId: group.id, title: 'Sneak' } });
  assert.equal(r.status, 403);
  r = await h.api('POST', '/api/meetings', { token: guest.token, body: { groupId: group.id, title: 'Guest' } });
  assert.equal(r.status, 403);

  r = await h.api('POST', '/api/meetings', { token: owner.token, body: { groupId: group.id, title: 'Planning' } });
  assert.equal(r.status, 201);
  const meeting = r.data;
  assert.equal(meeting.status, 'scheduled');
  assert.equal(meeting.hostId, owner.user.id);
  assert.equal(meeting.capabilities.video, false, 'capabilities must honestly report no video');
  assert.equal(meeting.capabilities.presence, true);

  r = await h.api('GET', `/api/meetings/${meeting.id}`, { token: stranger.token });
  assert.equal(r.status, 403);
  r = await h.api('GET', `/api/meetings?groupId=${group.id}`, { token: stranger.token });
  assert.equal(r.status, 403);
  r = await h.api('GET', '/api/meetings/not-a-uuid', { token: owner.token });
  assert.equal(r.status, 404);
});

test('scheduled meeting posts a system message into the group chat and notifies members', async () => {
  const { owner, member, group } = await setup();
  h.io.reset();
  const r = await h.api('POST', '/api/meetings', {
    token: owner.token,
    body: { groupId: group.id, title: 'Sync', scheduledAt: new Date(Date.now() + 3600_000).toISOString() },
  });
  assert.equal(r.status, 201);
  const msgs = await h.api('GET', `/api/groups/${group.id}/messages`, { token: member.token });
  const sys = msgs.data.messages.find((m) => m.messageType === 'system');
  assert.ok(sys, 'system message should exist');
  assert.match(sys.content, /scheduled a meeting: Sync/);

  const created = h.io.find('meeting-created');
  const rooms = created.map((e) => e.rooms[0]).sort();
  assert.deepEqual(rooms, [`group_${group.id}`, `user_${member.user.id}`, `user_${owner.user.id}`].sort());
  assert.ok(h.io.find('group-message').length >= 1, 'system message pushed in realtime');
});

test('lifecycle: start → join → leave → end; permissions and state machine', async () => {
  const { owner, member, group } = await setup();
  const created = await h.api('POST', '/api/meetings', { token: owner.token, body: { groupId: group.id, title: 'Standup' } });
  const id = created.data.id;

  // Cannot join a meeting that is not live.
  let r = await h.api('POST', `/api/meetings/${id}/join`, { token: member.token });
  assert.equal(r.status, 409);

  // Plain member (not host, not admin) cannot start.
  r = await h.api('POST', `/api/meetings/${id}/start`, { token: member.token });
  assert.equal(r.status, 403);

  // Host starts; host auto-joins.
  r = await h.api('POST', `/api/meetings/${id}/start`, { token: owner.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'live');
  assert.equal(r.data.participantCount, 1);
  assert.equal(r.data.viewer.isHost, true);
  assert.equal(r.data.viewer.isJoined, true);

  // Start is idempotent.
  r = await h.api('POST', `/api/meetings/${id}/start`, { token: owner.token });
  assert.equal(r.status, 200);

  // Cannot edit once live.
  r = await h.api('PATCH', `/api/meetings/${id}`, { token: owner.token, body: { title: 'Renamed' } });
  assert.equal(r.status, 409);

  // Member joins (twice → still one participant row).
  h.io.reset();
  r = await h.api('POST', `/api/meetings/${id}/join`, { token: member.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.participantCount, 2);
  assert.equal(r.data.viewer.isJoined, true);
  assert.equal(r.data.viewer.canManage, false);
  r = await h.api('POST', `/api/meetings/${id}/join`, { token: member.token });
  assert.equal(r.data.participantCount, 2);
  assert.equal(await h.models.MeetingParticipant.count({ where: { meetingId: id } }), 2);
  assert.equal(h.io.find('meeting-participant').length, 2);

  // Participants list is member-only.
  const stranger = await h.createUser();
  r = await h.api('GET', `/api/meetings/${id}/participants`, { token: stranger.token });
  assert.equal(r.status, 403);
  r = await h.api('GET', `/api/meetings/${id}/participants`, { token: member.token });
  assert.equal(r.data.length, 2);

  // Leave.
  r = await h.api('POST', `/api/meetings/${id}/leave`, { token: member.token });
  assert.equal(r.data.participantCount, 1);
  assert.equal(r.data.viewer.isJoined, false);

  // Member cannot end; host ends; participants closed out.
  r = await h.api('POST', `/api/meetings/${id}/end`, { token: member.token });
  assert.equal(r.status, 403);
  r = await h.api('POST', `/api/meetings/${id}/end`, { token: owner.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'ended');
  assert.equal(r.data.participantCount, 0);
  assert.equal(await h.models.MeetingParticipant.count({ where: { meetingId: id, leftAt: null } }), 0);

  // Cannot join/start/cancel an ended meeting.
  assert.equal((await h.api('POST', `/api/meetings/${id}/join`, { token: member.token })).status, 409);
  assert.equal((await h.api('POST', `/api/meetings/${id}/start`, { token: owner.token })).status, 409);
  assert.equal((await h.api('POST', `/api/meetings/${id}/cancel`, { token: owner.token })).status, 409);
});

test('group admin (non-host) can manage; cancel works only from scheduled; startNow goes live immediately', async () => {
  const { owner, member, group } = await setup();
  const created = await h.api('POST', '/api/meetings', { token: member.token, body: { groupId: group.id, title: 'Member-hosted' } });
  assert.equal(created.status, 201);
  const id = created.data.id;

  // Owner of the group is not the host but can manage.
  let r = await h.api('PATCH', `/api/meetings/${id}`, { token: owner.token, body: { title: 'Adjusted' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.title, 'Adjusted');
  r = await h.api('POST', `/api/meetings/${id}/cancel`, { token: owner.token });
  assert.equal(r.data.status, 'cancelled');

  // startNow.
  r = await h.api('POST', '/api/meetings', { token: owner.token, body: { groupId: group.id, title: 'Now', startNow: true } });
  assert.equal(r.status, 201);
  assert.equal(r.data.status, 'live');
  assert.equal(r.data.participantCount, 1);
  assert.ok(r.data.startedAt);
});

test('listing: live first, then scheduled, then recently ended; excludes cancelled', async () => {
  const { owner, group } = await setup();
  const mk = (title, extra = {}) => h.api('POST', '/api/meetings', { token: owner.token, body: { groupId: group.id, title, ...extra } });
  const ended = (await mk('Ended', { startNow: true })).data;
  await h.api('POST', `/api/meetings/${ended.id}/end`, { token: owner.token });
  const cancelled = (await mk('Cancelled')).data;
  await h.api('POST', `/api/meetings/${cancelled.id}/cancel`, { token: owner.token });
  await mk('Scheduled', { scheduledAt: new Date(Date.now() + 86400_000).toISOString() });
  await mk('Live', { startNow: true });

  const r = await h.api('GET', `/api/meetings?groupId=${group.id}`, { token: owner.token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.map((m) => m.title), ['Live', 'Scheduled', 'Ended']);
  assert.equal(r.data[0].participantCount, 1);
  assert.equal(r.data[0].group.id, group.id);

  // Cross-group listing (no groupId) includes this group's meetings.
  const all = await h.api('GET', '/api/meetings', { token: owner.token });
  assert.ok(all.data.some((m) => m.title === 'Live'));
});

test('deleting a group cascades its meetings and participants', async () => {
  const { owner, group } = await setup();
  const m = (await h.api('POST', '/api/meetings', { token: owner.token, body: { groupId: group.id, title: 'Doomed', startNow: true } })).data;
  assert.equal(await h.models.Meeting.count({ where: { groupId: group.id } }), 1);
  const r = await h.api('DELETE', `/api/groups/${group.id}`, { token: owner.token });
  assert.deepEqual(r.data, { deleted: true });
  assert.equal(await h.models.Meeting.count({ where: { groupId: group.id } }), 0);
  assert.equal(await h.models.MeetingParticipant.count({ where: { meetingId: m.id } }), 0);
});
