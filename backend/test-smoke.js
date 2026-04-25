/**
 * iKHWEZI Backend Smoke Test
 * Run: node test-smoke.js  (backend must be running on PORT or 3101)
 */
'use strict';
const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3101}`;
let passed = 0;
let failed = 0;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'localhost',
      port: process.env.PORT || 3101,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log(`\niKHWEZI Smoke Tests -> ${BASE}\n`);

  // 1. Health
  const health = await req('GET', '/api/health');
  assert('GET /api/health returns 200', health.status === 200);
  assert('Health body has status:ok', health.body.status === 'ok');

  // 2. Register (unique username per run)
  const ts = Date.now();
  const testUser = { username: `smokeuser_${ts}`, password: 'Test1234!', email: `smoke_${ts}@test.com` };
  const reg = await req('POST', '/api/auth/register', testUser);
  assert('POST /api/auth/register returns 200', reg.status === 200 || reg.status === 201);
  const token = reg.body.token;
  assert('Register returns a JWT token', typeof token === 'string' && token.length > 10);

  // 3. Login
  const login = await req('POST', '/api/auth/login', { email: testUser.email, password: testUser.password });
  assert('POST /api/auth/login returns 200', login.status === 200);
  assert('Login returns a JWT token', typeof login.body.token === 'string');
  const loginToken = login.body.token;

  // 4. Wrong password → 401
  const badLogin = await req('POST', '/api/auth/login', { email: testUser.email, password: 'wrongpassword' });
  assert('Login with wrong password returns 401', badLogin.status === 401);

  // 5. Feed (unauthenticated)
  const feed = await req('GET', '/api/videos/feed');
  assert('GET /api/videos/feed returns 200', feed.status === 200);
  assert('Feed returns videos array', Array.isArray(feed.body.videos));

  // 6. Feed (authenticated)
  const feedAuth = await req('GET', '/api/videos/feed', null, loginToken);
  assert('GET /api/videos/feed (authenticated) returns 200', feedAuth.status === 200);

  // 7. Comment on non-existent video → 404
  const noVidComment = await req('POST', '/api/videos/999999/comments', { content: 'hello' }, loginToken);
  assert('Comment on missing video returns 404', noVidComment.status === 404);

  // 8. Comment without auth → 401
  const noAuthComment = await req('POST', '/api/videos/1/comments', { content: 'hello' });
  assert('Comment without auth returns 401', noAuthComment.status === 401);

  // 9. Comment too long → 400
  const longContent = 'x'.repeat(281);
  const longComment = await req('POST', '/api/videos/1/comments', { content: longContent }, loginToken);
  assert('Comment over 280 chars returns 400 or 404', [400, 404].includes(longComment.status));

  // 10. Empty comment → 400
  const emptyComment = await req('POST', '/api/videos/1/comments', { content: '   ' }, loginToken);
  assert('Empty/whitespace comment returns 400 or 404', [400, 404].includes(emptyComment.status));

  // 11. Like without auth → 401
  const noAuthLike = await req('POST', '/api/videos/1/like', {});
  assert('Like without auth returns 401', noAuthLike.status === 401);

  // 12. Follow without auth → 401
  const noAuthFollow = await req('POST', '/api/users/1/follow', {});
  assert('Follow without auth returns 401', noAuthFollow.status === 401);

  // 13. Star own video — need to get our own userId first
  const me = await req('GET', '/api/auth/me', null, loginToken);
  if (me.status === 200 && me.body.id) {
    const selfStar = await req('POST', `/api/videos/999999/star`, { amount: 1 }, loginToken);
    assert('Star non-existent video returns 404', selfStar.status === 404);
  } else {
    assert('GET /api/auth/me returns current user', false, `status ${me.status}`);
  }

  // 14. Rate limit — comment endpoint is 10/min; fire 11 rapid requests to trigger 429
  // Using the comment rate limiter (1-min window) avoids polluting the 15-min auth window
  let hit429 = false;
  for (let i = 0; i <= 11; i++) {
    const r = await req('POST', '/api/videos/999999/comments', { content: `rl test ${i}` }, loginToken);
    if (r.status === 429) { hit429 = true; break; }
  }
  assert('Comment rate limiter triggers 429 after excess requests', hit429);

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  const printable = err && err.message ? err.message : JSON.stringify(err);
  console.error('Smoke test runner error:', printable);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
