// Service worker for the Stadium workout PWA.
// Strategy: network-first for navigations (so updates land when online),
// cache-first for hashed assets (JS bundle, fonts) so the app works fully
// offline at the gym after one online visit.

const CACHE = 'stadium-v1';
const BASE = '/workout-app';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then(c =>
        c.addAll([
          `${BASE}/`,
          `${BASE}/index.html`,
          `${BASE}/manifest.json`,
          `${BASE}/icon.png`,
        ]),
      )
      .catch(() => {}),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(r => r || caches.match(`${BASE}/index.html`)),
        ),
    );
    return;
  }

  // Everything else: cache-first, populate on miss.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
