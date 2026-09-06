'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

let h;
test.before(async () => { h = await createHarness(); });
test.after(async () => { await h.close(); });

test('DM: send/receive, ordering, unread + read receipts, realtime emit to receiver only', async () => {
  const a = await h.createUser();
  const b = await h.createUser();

  h.io.reset();
  let r = await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'hello' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.senderId, a.user.id);
  assert.equal(r.data.receiverId, b.user.id);
  r = await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'again' } });
  assert.equal(r.status, 201);

  const dms = h.io.find('new-dm');
  assert.equal(dms.length, 2);
  assert.deepEqual(dms[0].rooms, [`user_${b.user.id}`]);

  // B sees the conversation with 2 unread.
  r = await h.api('GET', '/api/messages/conversations', { token: b.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].user.id, a.user.id);
  assert.equal(r.data[0].unread, 2);
  assert.equal(r.data[0].lastMessage.content, 'again');

  // Opening the thread returns chronological messages and marks them read.
  r = await h.api('GET', `/api/messages/${a.user.id}`, { token: b.token });
  assert.deepEqual(r.data.map((m) => m.content), ['hello', 'again']);
  r = await h.api('GET', '/api/messages/conversations', { token: b.token });
  assert.equal(r.data[0].unread, 0);

  // Sender's own view has zero unread.
  r = await h.api('GET', '/api/messages/conversations', { token: a.token });
  assert.equal(r.data[0].unread, 0);
});

test('DM: recipient validation — self, unknown, invalid id, guest, banned', async () => {
  const a = await h.createUser();
  const guest = await h.createUser({ isGuest: true });
  const banned = await h.createUser({ isBanned: true });

  assert.equal((await h.api('POST', `/api/messages/${a.user.id}`, { token: a.token, body: { content: 'me' } })).status, 400);
  assert.equal((await h.api('POST', '/api/messages/not-a-uuid', { token: a.token, body: { content: 'x' } })).status, 404);
  assert.equal((await h.api('POST', '/api/messages/00000000-0000-4000-8000-000000000000', { token: a.token, body: { content: 'x' } })).status, 404);
  assert.equal((await h.api('POST', `/api/messages/${guest.user.id}`, { token: a.token, body: { content: 'x' } })).status, 404);
  assert.equal((await h.api('POST', `/api/messages/${banned.user.id}`, { token: a.token, body: { content: 'x' } })).status, 404);
  assert.equal(await h.models.DirectMessage.count({ where: { senderId: a.user.id } }), 0);
});

test('DM: content validation and guest sender blocked', async () => {
  const a = await h.createUser();
  const b = await h.createUser();
  const guest = await h.createUser({ isGuest: true });

  assert.equal((await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: '   ' } })).status, 400);
  assert.equal((await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: {} })).status, 400);
  assert.equal((await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'x'.repeat(5000) } })).status, 400);
  assert.equal((await h.api('POST', `/api/messages/${b.user.id}`, { token: guest.token, body: { content: 'hi' } })).status, 403);
  assert.equal((await h.api('GET', '/api/messages/conversations', { token: guest.token })).status, 403);
});

test('DMs and group messages do not leak into each other', async () => {
  const a = await h.createUser();
  const b = await h.createUser();
  const g = (await h.api('POST', '/api/groups', { token: a.token, body: { name: 'Isolated', memberIds: [b.user.id] } })).data;

  await h.api('POST', `/api/groups/${g.id}/messages`, { token: a.token, body: { content: 'group only' } });
  await h.api('POST', `/api/messages/${b.user.id}`, { token: a.token, body: { content: 'dm only' } });

  const dm = await h.api('GET', `/api/messages/${a.user.id}`, { token: b.token });
  assert.deepEqual(dm.data.map((m) => m.content), ['dm only']);
  const gm = await h.api('GET', `/api/groups/${g.id}/messages`, { token: b.token });
  assert.deepEqual(gm.data.messages.map((m) => m.content), ['group only']);
  const convs = await h.api('GET', '/api/messages/conversations', { token: b.token });
  assert.equal(convs.data.length, 1);
});
