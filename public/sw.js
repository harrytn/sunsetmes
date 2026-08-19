// public/sw.js
// Sunset Messages — Service Worker
// Handles Web Push events and notification click routing.

const APP_NAME = 'Sunset Messages';
const DEFAULT_URL = '/';

// ── Install: activate immediately without waiting ─────────────────────────────
self.addEventListener('install', (event) => {
  // eslint-disable-next-line no-undef
  event.waitUntil(self.skipWaiting());
});

// ── Activate: claim all open clients immediately ──────────────────────────────
self.addEventListener('activate', (event) => {
  // eslint-disable-next-line no-undef
  event.waitUntil(self.clients.claim());
});

// ── Push: show a notification ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: APP_NAME, body: event.data.text(), url: DEFAULT_URL };
  }

  const {
    title = APP_NAME,
    body = 'You have a new message.',
    icon = '/icons/icon-192.png',
    badge = '/icons/badge-72.png',
    tag = 'sunset-messages',
    url = DEFAULT_URL,
    letterId = null,
  } = data;

  // Store url / letterId in the notification data for the click handler
  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url, letterId },
  };

  event.waitUntil(
    // eslint-disable-next-line no-undef
    self.registration.showNotification(title, notificationOptions),
  );
});

// ── Notification click: open or focus the target letter ──────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? DEFAULT_URL;

  event.waitUntil(
    // eslint-disable-next-line no-undef
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open on the correct URL, focus it
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname === target.pathname && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        // eslint-disable-next-line no-undef
        if (self.clients.openWindow) {
          // eslint-disable-next-line no-undef
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
