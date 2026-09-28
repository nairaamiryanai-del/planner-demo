// Обработчик push-уведомлений (подключается к service worker через importScripts).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Planner';
  const options = {
    body: data.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || undefined,
    // Повторное уведомление с тем же tag (например, ежедневное лекарство)
    // должно звучать, а не молча заменять вчерашнее
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          const p = client.focus();
          // Открываем нужный раздел и в уже открытом окне
          if ('navigate' in client) return p.then((c) => c.navigate(url)).catch(() => {});
          return p;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
