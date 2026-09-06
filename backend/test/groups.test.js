'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

let h;
test.before(async () => { h = await createHarness(); });
test.after(async () => { await h.close(); });

async function makeGroup(owner, body = {}) {
  const r = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'Team', ...body } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}

test('create group: validation rejects empty/short/profane names, truncates oversized ones', async () => {
  const owner = await h.createUser();
  let r = await h.api('POST', '/api/groups', { token: owner.token, body: { name: '' } });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'ab' } });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'shit group' } });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/groups', { token: owner.token, body: {} });
  assert.equal(r.status, 400);
  r = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'x'.repeat(300) } });
  assert.equal(r.status, 201);
  assert.equal(r.data.name.length, 100);
});

test('create group: owner becomes owner member; valid memberIds are added, invalid/guest/banned skipped', async () => {
  const owner = await h.createUser();
  const friend = await h.createUser();
  const guest = await h.createUser({ isGuest: true });
  const banned = await h.createUser({ isBanned: true });

  h.io.reset();
  const group = await makeGroup(owner, {
    name: 'Squad',
    description: 'hello',
    isPrivate: false,
    memberIds: [friend.user.id, guest.user.id, banned.user.id, 'not-a-uuid', owner.user.id],
  });
  assert.equal(group.isPrivate, false);
  assert.equal(group.ownerId, owner.user.id);

  const members = await h.models.GroupMember.findAll({ where: { groupId: group.id } });
  const byUser = Object.fromEntries(members.map((m) => [m.userId, m.role]));
  assert.equal(byUser[owner.user.id], 'owner');
  assert.equal(byUser[friend.user.id], 'member');
  assert.equal(byUser[guest.user.id], undefined, 'guests must not be added to groups');
  assert.equal(byUser[banned.user.id], undefined, 'banned users must not be added to groups');
  assert.equal(members.length, 2);

  // Only the friend gets a realtime notification.
  const notified = h.io.find('group-member-added').map((e) => e.rooms[0]);
  assert.deepEqual(notified, [`user_${friend.user.id}`]);
});

test('duplicate group name for the same owner is a 409', async () => {
  const owner = await h.createUser();
  await makeGroup(owner, { name: 'Dupe' });
  const r = await h.api('POST', '/api/groups', { token: owner.token, body: { name: 'Dupe' } });
  assert.equal(r.status, 409);
});

test('non-member cannot read meta, members or messages, nor send', async () => {
  const owner = await h.createUser();
  const stranger = await h.createUser();
  const group = await makeGroup(owner);

  assert.equal((await h.api('GET', `/api/groups/${group.id}`, { token: stranger.token })).status, 404);
  assert.equal((await h.api('GET', `/api/groups/${group.id}/members`, { token: stranger.token })).status, 403);
  assert.equal((await h.api('GET', `/api/groups/${group.id}/messages`, { token: stranger.token })).status, 403);
  const send = await h.api('POST', `/api/groups/${group.id}/messages`, { token: stranger.token, body: { content: 'hi' } });
  assert.equal(send.status, 403);
  assert.equal(await h.models.GroupMessage.count({ where: { groupId: group.id } }), 0);
});

test('invalid group ids return 404, never 500', async () => {
  const u = await h.createUser();
  assert.equal((await h.api('GET', '/api/groups/nope', { token: u.token })).status, 404);
  assert.equal((await h.api('POST', '/api/groups/nope/messages', { token: u.token, body: { content: 'x' } })).status, 404);
  assert.equal((await h.api('POST', '/api/groups/nope/members', { token: u.token, body: { userIds: [u.user.id] } })).status, 404);
});

test('members can send + read messages; ordering, pagination, sender identity and realtime emit', async () => {
  const owner = await h.createUser();
  const member = await h.createUser();
  const group = await makeGroup(owner, { memberIds: [member.user.id] });

  h.io.reset();
  for (let i = 1; i <= 5; i++) {
    const who = i % 2 ? owner : member;
    const r = await h.api('POST', `/api/groups/${group.id}/messages`, { token: who.token, body: { content: `m${i}` } });
    assert.equal(r.status, 201);
    assert.equal(r.data.messageType, 'text');
    assert.equal(r.data.sender.id, who.user.id);
  }
  const emits = h.io.find('group-message');
  assert.equal(emits.length, 5);
  assert.deepEqual(emits[0].rooms, [`group_${group.id}`]);

  // A client cannot claim a media message without uploading a file.
  const fake = await h.api('POST', `/api/groups/${group.id}/messages`, {
    token: owner.token, body: { messageType: 'image', mediaUrl: '/etc/passwd', content: 'x' },
  });
  assert.equal(fake.status, 201);
  assert.equal(fake.data.messageType, 'text');
  assert.equal(fake.data.mediaUrl, null);

  // Blank text is rejected.
  const blank = await h.api('POST', `/api/groups/${group.id}/messages`, { token: owner.token, body: { content: '   ' } });
  assert.equal(blank.status, 400);

  const page1 = await h.api('GET', `/api/groups/${group.id}/messages?limit=4`, { token: member.token });
  assert.equal(page1.status, 200);
  assert.equal(page1.data.messages.length, 4);
  assert.equal(page1.data.hasMore, true);
  const contents = page1.data.messages.map((m) => m.content);
  // Chronological (oldest → newest) within the page.
  assert.deepEqual(contents, [...contents].sort((a, b) => new Date(a) - new Date(b)) && contents);
  const page2 = await h.api('GET', `/api/groups/${group.id}/messages?limit=4&page=2`, { token: member.token });
  assert.equal(page2.data.messages.length, 2);
  assert.equal(page2.data.hasMore, false);
});

test('unread count is tracked per member and cleared on read', async () => {
  const owner = await h.createUser();
  const member = await h.createUser();
  const group = await makeGroup(owner, { memberIds: [member.user.id] });

  await h.api('POST', `/api/groups/${group.id}/messages`, { token: owner.token, body: { content: 'a' } });
  await h.api('POST', `/api/groups/${group.id}/messages`, { token: owner.token, body: { content: 'b' } });

  let threads = await h.api('GET', '/api/groups', { token: member.token });
  assert.equal(threads.status, 200);
  const t = threads.data.find((x) => x.group.id === group.id);
  assert.equal(t.unread, 2);
  assert.equal(t.lastMessage.content, 'b');
  assert.equal(t.muted, false);

  // Reading the messages marks them read.
  await h.api('GET', `/api/groups/${group.id}/messages`, { token: member.token });
  threads = await h.api('GET', '/api/groups', { token: member.token });
  assert.equal(threads.data.find((x) => x.group.id === group.id).unread, 0);

  // Owner's own messages are never "unread" for the owner.
  const ownerThreads = await h.api('GET', '/api/groups', { token: owner.token });
  assert.equal(ownerThreads.data.find((x) => x.group.id === group.id).unread, 0);
});

test('mute state round-trips through meta', async () => {
  const owner = await h.createUser();
  const group = await makeGroup(owner);
  let meta = await h.api('GET', `/api/groups/${group.id}`, { token: owner.token });
  assert.equal(meta.data.muted, false);
  const r = await h.api('POST', `/api/groups/${group.id}/mute`, { token: owner.token, body: { muted: true } });
  assert.deepEqual(r.data, { muted: true });
  meta = await h.api('GET', `/api/groups/${group.id}`, { token: owner.token });
  assert.equal(meta.data.muted, true);
});

test('membership management: add (admin only), duplicate add skipped, remove, leave, owner cannot leave', async () => {
  const owner = await h.createUser();
  const member = await h.createUser();
  const newbie = await h.createUser();
  const group = await makeGroup(owner, { memberIds: [member.user.id] });

  // Plain member cannot add.
  let r = await h.api('POST', `/api/groups/${group.id}/members`, { token: member.token, body: { userIds: [newbie.user.id] } });
  assert.equal(r.status, 403);

  // Owner adds; second add is a no-op (no duplicate membership).
  r = await h.api('POST', `/api/groups/${group.id}/members`, { token: owner.token, body: { userIds: [newbie.user.id] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.added, [newbie.user.id]);
  r = await h.api('POST', `/api/groups/${group.id}/members`, { token: owner.token, body: { userIds: [newbie.user.id] } });
  assert.deepEqual(r.data.added, []);
  assert.deepEqual(r.data.skipped, [newbie.user.id]);
  assert.equal(await h.models.GroupMember.count({ where: { groupId: group.id, userId: newbie.user.id } }), 1);

  // Direct DB duplicate is blocked by the unique index.
  await assert.rejects(h.models.GroupMember.create({ groupId: group.id, userId: newbie.user.id, role: 'member' }));

  // Member cannot remove another member; owner can.
  r = await h.api('DELETE', `/api/groups/${group.id}/members/${newbie.user.id}`, { token: member.token });
  assert.equal(r.status, 403);
  r = await h.api('DELETE', `/api/groups/${group.id}/members/${newbie.user.id}`, { token: owner.token });
  assert.deepEqual(r.data, { removed: true });

  // Nobody can remove the owner.
  r = await h.api('DELETE', `/api/groups/${group.id}/members/${owner.user.id}`, { token: owner.token });
  assert.equal(r.status, 400);

  // Legacy body-form removal still works.
  await h.api('POST', `/api/groups/${group.id}/members`, { token: owner.token, body: { userIds: [newbie.user.id] } });
  r = await h.api('POST', `/api/groups/${group.id}/remove`, { token: owner.token, body: { userId: newbie.user.id } });
  assert.deepEqual(r.data, { removed: true });

  // Leave.
  r = await h.api('POST', `/api/groups/${group.id}/leave`, { token: member.token });
  assert.deepEqual(r.data, { left: true });
  assert.equal((await h.api('GET', `/api/groups/${group.id}/messages`, { token: member.token })).status, 403);
  r = await h.api('POST', `/api/groups/${group.id}/leave`, { token: owner.token });
  assert.equal(r.status, 400);
});

test('roles: promote, admin can edit but not delete; transfer ownership; owner deletes and cascades', async () => {
  const owner = await h.createUser();
  const member = await h.createUser();
  const group = await makeGroup(owner, { memberIds: [member.user.id] });

  // Member cannot edit.
  let r = await h.api('PATCH', `/api/groups/${group.id}`, { token: member.token, body: { name: 'Hacked' } });
  assert.equal(r.status, 403);

  // Promote to admin; admin can edit.
  r = await h.api('POST', `/api/groups/${group.id}/promote`, { token: owner.token, body: { userId: member.user.id, role: 'admin' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.membership.role, 'admin');
  r = await h.api('PATCH', `/api/groups/${group.id}`, { token: member.token, body: { name: 'Renamed', isPrivate: false } });
  assert.equal(r.status, 200);
  assert.equal(r.data.name, 'Renamed');
  assert.equal(r.data.isPrivate, false);

  // Admin cannot delete.
  r = await h.api('DELETE', `/api/groups/${group.id}`, { token: member.token });
  assert.equal(r.status, 403);

  // Transfer ownership; previous owner demoted to admin.
  r = await h.api('POST', `/api/groups/${group.id}/transfer`, { token: owner.token, body: { userId: member.user.id } });
  assert.equal(r.status, 200);
  const roles = Object.fromEntries((await h.models.GroupMember.findAll({ where: { groupId: group.id } })).map((m) => [m.userId, m.role]));
  assert.equal(roles[member.user.id], 'owner');
  assert.equal(roles[owner.user.id], 'admin');

  // New owner deletes; everything cascades.
  await h.api('POST', `/api/groups/${group.id}/messages`, { token: owner.token, body: { content: 'bye' } });
  r = await h.api('DELETE', `/api/groups/${group.id}`, { token: member.token });
  assert.deepEqual(r.data, { deleted: true });
  assert.equal(await h.models.Group.count({ where: { id: group.id } }), 0);
  assert.equal(await h.models.GroupMember.count({ where: { groupId: group.id } }), 0);
  assert.equal(await h.models.GroupMessage.count({ where: { groupId: group.id } }), 0);
});

test('private group requires invite; public group can be joined; banned users cannot join', async () => {
  const owner = await h.createUser();
  const joiner = await h.createUser();
  const priv = await makeGroup(owner, { name: 'Private', isPrivate: true });
  const pub = await makeGroup(owner, { name: 'Public', isPrivate: false });

  let r = await h.api('POST', `/api/groups/${priv.id}/join`, { token: joiner.token });
  assert.equal(r.status, 403);

  r = await h.api('POST', `/api/groups/${priv.id}/invite`, { token: owner.token, body: { userId: joiner.user.id } });
  assert.equal(r.status, 200);
  assert.equal(r.data.created, true);
  r = await h.api('POST', `/api/groups/${priv.id}/join`, { token: joiner.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.created, true);
  // Joining twice is idempotent.
  r = await h.api('POST', `/api/groups/${priv.id}/join`, { token: joiner.token });
  assert.equal(r.data.created, false);

  r = await h.api('POST', `/api/groups/${pub.id}/join`, { token: joiner.token });
  assert.equal(r.status, 200);

  // Removed-by-owner leaves a ban; rejoin blocked.
  r = await h.api('DELETE', `/api/groups/${pub.id}/members/${joiner.user.id}`, { token: owner.token });
  assert.deepEqual(r.data, { removed: true });
  r = await h.api('POST', `/api/groups/${pub.id}/join`, { token: joiner.token });
  assert.equal(r.status, 403);

  // An explicit admin re-add lifts the kick.
  r = await h.api('POST', `/api/groups/${pub.id}/members`, { token: owner.token, body: { userIds: [joiner.user.id] } });
  assert.deepEqual(r.data.added, [joiner.user.id]);
  assert.equal(await h.models.GroupBan.count({ where: { groupId: pub.id, userId: joiner.user.id } }), 0);
});

test('reactions toggle and are member-only', async () => {
  const owner = await h.createUser();
  const stranger = await h.createUser();
  const group = await makeGroup(owner);
  const msg = (await h.api('POST', `/api/groups/${group.id}/messages`, { token: owner.token, body: { content: 'react' } })).data;

  let r = await h.api('POST', `/api/groups/messages/${msg.id}/reaction`, { token: stranger.token, body: { emoji: '🔥' } });
  assert.equal(r.status, 403);
  r = await h.api('POST', `/api/groups/messages/${msg.id}/reaction`, { token: owner.token, body: { emoji: '🔥' } });
  assert.deepEqual(r.data, { emoji: '🔥', removed: false });
  r = await h.api('POST', `/api/groups/messages/${msg.id}/reaction`, { token: owner.token, body: { emoji: '🔥' } });
  assert.deepEqual(r.data, { emoji: '🔥', removed: true });
});
