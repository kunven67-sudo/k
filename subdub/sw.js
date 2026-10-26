// SUBDUB service worker:
// 1) adds cross-origin isolation headers (lets the brains use all CPU cores),
// 2) keeps the app files so SUBDUB opens even without internet (models are cached separately).
const APP = 'subdub-app-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  h.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  e.respondWith((async () => {
    const cache = await caches.open(APP);
    try {
      const res = await fetch(req);
      if (res.ok && !url.pathname.includes('/test-out/')) cache.put(req, res.clone()).catch(() => {});
      return isolate(res);
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return isolate(hit);
      throw err;
    }
  })());
});
