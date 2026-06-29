self.addEventListener('push', function(event) {
  let data = { title: 'Summer Sips', body: 'You have a new order!' };
  try { data = event.data.json(); } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/summer-sips/logo192.png',
      badge: '/summer-sips/logo192.png',
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/summer-sips'));
});
