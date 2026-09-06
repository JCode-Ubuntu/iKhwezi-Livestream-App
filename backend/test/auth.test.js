'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createHarness, JWT_SECRET } = require('./harness');

let h;
test.before(async () => { h = await createHarness(); });
test.after(async () => { await h.close(); });

test('unauthenticated request to a protected route is rejected with 401', async () => {
  const r = await h.api('GET', '/api/groups');
  assert.equal(r.status, 401);
  assert.ok(r.data.error);
});

test('garbage bearer token is rejected, not crashed', async () => {
  const r = await h.api('GET', '/api/groups', { token: 'not.a.jwt' });
  assert.equal(r.status, 401);
});

test('token for a deleted user is rejected', async () => {
  const { user, token } = await h.createUser();
  await user.destroy();
  const r = await h.api('GET', '/api/groups', { token });
  assert.equal(r.status, 401);
});

test('token signed with the wrong secret is rejected', async () => {
  const { user } = await h.createUser();
  const bad = jwt.sign({ id: user.id }, 'some-other-secret', { expiresIn: '1h' });
  const r = await h.api('GET', '/api/groups', { token: bad });
  assert.equal(r.status, 401);
});

test('valid token signed with the real secret is accepted', async () => {
  const { user } = await h.createUser();
  const good = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
  const r = await h.api('GET', '/api/groups', { token: good });
  assert.equal(r.status, 200);
});

test('banned user is treated as unauthenticated even with a valid token', async () => {
  // Production behaviour: `authenticate` drops banned users to req.user = null,
  // so every protected route answers 401 and the client logs the session out.
  const { token } = await h.createUser({ isBanned: true });
  const r = await h.api('GET', '/api/groups', { token });
  assert.equal(r.status, 401);
});

test('guest user cannot perform registered-only actions (create group)', async () => {
  const { token } = await h.createUser({ isGuest: true });
  const r = await h.api('POST', '/api/groups', { token, body: { name: 'Guest group' } });
  assert.equal(r.status, 403);
});

test('unknown /api path returns JSON 404 (never falls through to SPA)', async () => {
  const r = await h.api('GET', '/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.deepEqual(r.data, { error: 'Not found' });
});

test('malformed JSON body yields a JSON 400, not an HTML stack trace', async () => {
  const { token } = await h.createUser();
  const res = await fetch(`${h.base}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{"name": ',
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Malformed JSON body');
});
