// Browser push + service-worker plumbing.
import { VAPID_PUBLIC_KEY } from './config.js';

export const pushSupported =
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/cpap/sw.js', { scope: '/cpap/' });
}

export function permissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function getExistingSubscription() {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Request permission (if needed) and create a push subscription.
// Returns the subscription JSON, or throws with a friendly message.
export async function subscribe() {
  if (!pushSupported) throw new Error('This browser does not support notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error(
      perm === 'denied'
        ? 'Notifications are blocked. Enable them in your browser settings for this site.'
        : 'Notification permission was not granted.'
    );
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return sub.toJSON();
}
