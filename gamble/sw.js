// GAMBLE service worker. Versioned caches:
//   vendor/ and assets/  → cache-first (immutable libraries, fonts, icons)
//   src/, css/, html     → stale-while-revalidate (instant start, fresh next launch)
// Bump VERSION on release to drop old caches. Registered by src/states/boot.js (not on
// localhost unless ?sw=1, so development never serves stale modules).

const VERSION = 'gamble-v1';
const STATIC = `${VERSION}-static`;
const CODE = `${VERSION}-code`;
const SHELL = ['./', './index.html', './css/game.css', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CODE)
      .then((c) => c.addAll(SHELL))
      .catch(() => null)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CODE);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) || new Response('Offline', { status: 503 });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.includes('/vendor/') || path.includes('/assets/')) event.respondWith(cacheFirst(req));
  else if (path.includes('/src/') || path.includes('/css/') || req.mode === 'navigate' || path.endsWith('.webmanifest')) event.respondWith(staleWhileRevalidate(req, event));
});
