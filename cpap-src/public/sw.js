/* CPAP Reminders service worker: handles web-push display + click, plus a
   minimal offline app-shell cache. Scope: /cpap/ */
const CACHE = 'cpap-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Incoming push from the notifier Lambda.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'CPAP Reminders';
  const options = {
    body: data.body || '',
    tag: data.tag || 'cpap',
    icon: '/cpap/icon-192.png',
    badge: '/cpap/icon-192.png',
    data: { url: data.url || 'https://brandonburtner.com/cpap/' },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus or open the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url)
    || 'https://brandonburtner.com/cpap/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes('/cpap') && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
