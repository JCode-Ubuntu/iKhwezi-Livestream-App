import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getApiBase } from '../config/appConfig';

// TRANSIENT HANDOFF ONLY (Phase 3A): the authoritative push-token registry
// lives server-side (POST/DELETE /api/devices). localStorage carries the
// token from the FCM 'registration' event (fires independently of auth
// state) to the next authenticated sync — nothing else reads it as truth.
// Do NOT treat this key as the source of truth anywhere in the app.
const TOKEN_KEY = 'ikhwezi_fcm_token';

let serverRegisteredToken = null; // last token we successfully POSTed

async function doServerSync(method, url, token) {
  const authToken = localStorage.getItem('ikhwezi_token');
  if (!authToken) return false; // not signed in — sync deferred until auth
  try {
    const res = await fetch(`${getApiBase()}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: Capacitor.getPlatform?.() || 'unknown' }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[push] device-registry sync failed:', err?.message || err);
    return false;
  }
}

/**
 * Request permission and register for FCM push on native platforms.
 * Safe no-op on web. The FCM token is forwarded to the backend device
 * registry whenever the user is signed in (registry-only — the backend does
 * not send pushes yet; see backend /api/devices routes).
 */
export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return null;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    console.warn('[push] permission not granted:', perm.receive);
    return null;
  }

  await PushNotifications.addListener('registration', async (token) => {
    try {
      // Transient handoff: FCM init can complete before/after auth exists.
      localStorage.setItem(TOKEN_KEY, token.value);
    } catch {
      /* ignore */
    }
    console.info('[push] FCM token received');
    // Best-effort server registration when already authenticated; if the
    // user wasn't signed in yet, syncPushTokenOnAuth below picks it up.
    await syncPushTokenToServer(token.value);
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] registration error', err);
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.info('[push] received in foreground', notification?.title || '');
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.info('[push] opened from notification', action?.notification?.title || '');
  });

  await PushNotifications.register();
  // Legacy return contract: callers may expect the stored token.
  return getStoredPushToken();
}

/** POST the current token to the server registry (upsert by user+token). */
export async function syncPushTokenToServer(tokenArg) {
  const token = tokenArg || getStoredPushToken();
  if (!token || !Capacitor.isNativePlatform()) return false;
  const ok = await doServerSync('POST', '/api/devices', token);
  if (ok) serverRegisteredToken = token;
  return ok;
}

/**
 * Call when the user becomes authenticated (login/refresh) so a token that
 * arrived during a signed-out window is still picked up once.
 * Safe no-op on web or with no token yet.
 */
export async function syncPushTokenOnAuth() {
  return syncPushTokenToServer(getStoredPushToken());
}

/**
 * Call on logout: DELETE this device token from the server registry.
 * Local FCM registration is left in place (the app may next run as guest —
 * notifications shouldn't follow the account once signed out).
 */
export async function removePushTokenFromServer(tokenArg) {
  const token = tokenArg || getStoredPushToken();
  if (!token) return false;
  const ok = await doServerSync('DELETE', '/api/devices', token);
  if (ok) serverRegisteredToken = null;
  return ok;
}

/** Last token successfully handed to the server registry (diagnostics). */
export function getServerRegisteredToken() {
  return serverRegisteredToken;
}

export function getStoredPushToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
