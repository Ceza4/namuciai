// Namučiai service worker: keeps the app shell available offline and shows push notifications.
const CACHE = 'namuciai-__V__';
const SHELL = ['./', './index.html', './app.js?v=__V__', './styles.css?v=__V__', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // network first so updates land straight away, cache when offline
  // always ask the server (GitHub Pages caches for 10 minutes otherwise), fall back to the cache offline
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Namučiai', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Namučiai', {
    body: d.body || '',
    tag: d.tag,
    renotify: !!d.tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope);
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ nav: target.hash.slice(1) });
        return c.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
