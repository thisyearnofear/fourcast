/* Fourcast receipt push. Served from /sw.js so the scope is the whole origin. */
const SW_VERSION = 'receipt-push-1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'A receipt changed';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Open Fourcast and check the receipt.',
    tag: data.tag || SW_VERSION,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((win) => new URL(win.url).origin === target.origin);
      if (open) {
        open.navigate?.(target.href);
        return open.focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
