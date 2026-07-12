import { Capacitor } from '@capacitor/core';

/** Production API host for native builds and deployed web. */
export const PRODUCTION_SERVER = 'https://ikhwezi.site';

/**
 * Origin used for API, media, HLS, and Socket.IO.
 * Native apps always target production unless VITE_SERVER_URL is set.
 */
export function getServerUrl() {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, '');
  if (Capacitor.isNativePlatform()) return PRODUCTION_SERVER;
  if (import.meta.env.PROD) return '';
  return '';
}

/** REST API base — `/api` on web dev, full URL on native/production bundle. */
export function getApiBase() {
  const server = getServerUrl();
  return server ? `${server}/api` : '/api';
}

/** Resolve upload paths and relative media URLs for native + web. */
export function resolveMediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/storage/uploads/${path}`;
  const server = getServerUrl();
  return server ? `${server}${normalized}` : normalized;
}

/** Resolve HLS and other absolute-or-relative stream URLs. */
export function resolveStreamUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const server = getServerUrl();
  return server ? `${server}${normalized}` : normalized;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
