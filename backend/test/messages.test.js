'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

let h;
test.before(async () => { h = await createHarness(); });
test.after(async () => { await h.close(); });

test('DM: cannot message self, guest, banned, or non-existent user', async () => {
  const u = await h.createUser();
  const guest = await h.createUser({ isGuest: true });
  const banned = await h.createUser({ isBanned: true });

  assert.equal((await h.api('POST', `/api/messages/${u.user.id}`, { token: u.token, body: { content: 'x' } })).status, 400);
  assert.equal((await h.api('POST', `/api/messages/${guest.user.id}`, { token: u.token, body: { content: 'x' } })).status, 404);
  assert.equal((await h.api('POST', `/api/messages/${banned.user.id}`, { token: u.token, body: { content: 'x' } })).status, 404);
  assert.equal((await h.api('POST', '/api/messages/not-a-uuid', { token: u.token, body: { content: 'x' } })).status, 404);
});

test('DM: send, receive, and mark read', async () => {
  const a = await h.createUser();
  const b = await h.createUser();

  h.io.reset();
  const send = await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'hello' } });
  assert.equal(send.status, 201);
  assert.equal(send.data.content, 'hello');
  assert.equal(send.data.senderId, a.user.id);
  assert.equal(send.data.receiverId, b.user.id);

  const emits = h.io.find('new-dm');
  assert.equal(emits.length, 1);
  assert.deepEqual(emits[0].rooms, [`user_${b.user.id}`]);

  const acks = h.io.find('dm-ack');
  assert.equal(acks.length, 1);
  assert.equal(acks[0].rooms[0], `user_${a.user.id}`);
  assert.equal(acks[0].payload.status, 'delivered');

  // B's conversation list
  const convs = await h.api('GET', '/api/messages/conversations', { token: b.token });
  assert.equal(convs.status, 200);
  assert.equal(convs.data.length, 1);
  assert.equal(convs.data[0].unread, 1);

  // B loads messages -> unread cleared
  const msgs = await h.api('GET', `/api/messages/${a.user.id}`, { token: b.token });
  assert.equal(msgs.status, 200);
  assert.equal(msgs.data.length, 1);
  const cleared = await h.api('GET', '/api/messages/conversations', { token: b.token });
  assert.equal(cleared.data[0].unread, 0);
});

test('DM: idempotent retry with clientMessageId', async () => {
  const a = await h.createUser();
  const b = await h.createUser();
  const clientMessageId = 'msg-id-1';

  const r1 = await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'hi', clientMessageId } });
  assert.equal(r1.status, 201);

  h.io.reset();
  const r2 = await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'hi', clientMessageId } });
  assert.equal(r2.status, 200);
  assert.equal(r2.data.id, r1.data.id);

  // No duplicate broadcast on retry.
  assert.equal(h.io.find('new-dm').length, 0);

  const count = await h.models.DirectMessage.count({ where: { senderId: a.user.id, receiverId: b.user.id } });
  assert.equal(count, 1);
});

test('DM: invalid clientMessageId rejected', async () => {
  const a = await h.createUser();
  const b = await h.createUser();
  const r = await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'hi', clientMessageId: 'bad id!' } });
  assert.equal(r.status, 400);
});

test('Group message: idempotent retry with clientMessageId', async () => {
  const owner = await h.createUser();
  const member = await h.createUser();
  const group = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'Squad', memberIds: [member.user.id] } });
  assert.equal(group.status, 201);
  const clientMessageId = 'gmsg-1';

  const r1 = await h.api('POST', `/api/groups/${group.data.id}/messages`, { token: owner.token, body: { content: 'hi', clientMessageId } });
  assert.equal(r1.status, 201);

  h.io.reset();
  const r2 = await h.api('POST', `/api/groups/${group.data.id}/messages`, { token: owner.token, body: { content: 'hi', clientMessageId } });
  assert.equal(r2.status, 200);
  assert.equal(r2.data.id, r1.data.id);

  assert.equal(h.io.find('group-message').length, 0);
  const count = await h.models.GroupMessage.count({ where: { groupId: group.data.id } });
  assert.equal(count, 1);
});

test('Group message: non-member cannot send', async () => {
  const owner = await h.createUser();
  const stranger = await h.createUser();
  const group = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'Private' } });
  assert.equal(group.status, 201);
  const r = await h.api('POST', `/api/groups/${group.data.id}/messages`, { token: stranger.token, body: { content: 'hi' } });
  assert.equal(r.status, 403);
});
