#!/usr/bin/env node
/**
 * Auth fix verification — run: node scripts/verify-auth-fix.mjs
 * Logs concrete CORS + login API evidence for web vs Capacitor origins.
 */
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'https://ikhwezi.site/api';
const body = JSON.stringify({ email: 'creator@ikhwezi.com', password: 'Password123!' });

async function corsPreflight(origin) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  return {
    origin,
    status: res.status,
    allowOrigin: res.headers.get('access-control-allow-origin'),
  };
}

async function loginPost(origin) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: origin,
    },
    body,
  });
  const text = await res.text();
  let token = null;
  try {
    token = JSON.parse(text).token?.slice(0, 20) ?? null;
  } catch {
    token = null;
  }
  return {
    origin,
    status: res.status,
    allowOrigin: res.headers.get('access-control-allow-origin'),
    tokenPrefix: token,
    bodyPreview: text.slice(0, 80),
  };
}

console.log('=== iKhwezi auth verification ===\n');

for (const origin of ['https://ikhwezi.site', 'https://localhost', 'https://app.ikhwezi.local']) {
  const pre = await corsPreflight(origin);
  console.log(`CORS preflight ${origin}:`, pre);
}

console.log('');

for (const origin of ['https://ikhwezi.site', 'https://localhost']) {
  const post = await loginPost(origin);
  console.log(`POST login ${origin}:`, post);
}

console.log('\nInterpretation:');
console.log('- Web origin must have allowOrigin matching origin on OPTIONS');
console.log('- Capacitor origins need allowOrigin OR CapacitorHttp enabled in android assets');
console.log('- Browser WebView blocks reading response when allowOrigin is missing');
