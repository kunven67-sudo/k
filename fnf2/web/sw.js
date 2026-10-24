// FNF 2 play page: works with no internet. The page itself (code only, ~1 MB) + its icons are kept on the phone;
// the game's pictures + songs already live in the phone's storage (the zip you picked once). Online, the newest page
// is fetched first (so updates still come in); offline, or when the network is very slow, the kept copy opens.
const CACHE = 'fnf2-page-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('fnf2-page-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (u.pathname.includes('/fnf2-data/')) return;          // (the PC build's data files: not part of this page)
  e.respondWith(fresh(e, r));
});
async function fresh(e, r) {
  const c = await caches.open(CACHE);
  const nav = r.mode === 'navigate';
  const key = nav ? './' : r;
  const got = fetch(r, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) { const copy = res.clone(); e.waitUntil(c.put(key, copy).catch(() => {})); }
    return res;
  });
  const kept = () => c.match(key, { ignoreSearch: true }).then(h => h || (nav ? c.match('index.html', { ignoreSearch: true }) : null));
  // (a very slow network: after 5 s the kept page opens and the new one is stored for next time)
  const slow = new Promise(res => setTimeout(() => res('slow'), 5000));
  try {
    const first = await Promise.race([got, slow]);
    if (first !== 'slow') return first.ok ? first : ((await kept()) || first);
    const h = await kept(); if (h) { e.waitUntil(got.catch(() => {})); return h; }
    return await got;
  } catch (err) {
    const h = await kept(); if (h) return h;
    throw err;
  }
}
