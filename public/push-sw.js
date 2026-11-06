/* Push handlers, imported into the generated service worker. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'Reminder' };
  }
  const title = data.title || 'Calisthenics';
  const jobs = [
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: 'icon-192.png',
      data: { url: data.url || './' },
    }),
  ];
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    jobs.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(jobs).catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.registration.scope)) {
          return w.focus().then(() => w.navigate(url)).catch(() => w.focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
