import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const TOKEN_KEY = 'ikhwezi_fcm_token';

/**
 * Request permission and register for FCM push on native platforms.
 * Safe no-op on web.
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

  await PushNotifications.addListener('registration', (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token.value);
    } catch {
      /* ignore */
    }
    console.info('[push] registered');
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
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredPushToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
