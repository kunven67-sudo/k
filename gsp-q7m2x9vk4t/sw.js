/* Game System 3 on the phone: works with no internet, and hands out the games, covers and the console sound pack
   from the phone's own storage. Every game page gets a small helper added (its own saves, a home button). */
const VERSION = '3.5.0';
const SHELL = 'gs3-shell-' + VERSION;
const FILES = ["./","css/app.css","css/skin-ps4.css","css/skin-ps5.css","css/skin-switch.css","css/skin-xbox.css","css/styles.css","fonts/anton-latin-400-normal.woff2","fonts/biz-udpgothic-latin-400-normal.woff2","fonts/biz-udpgothic-latin-700-normal.woff2","fonts/black-ops-one-latin-400-normal.woff2","fonts/bungee-latin-400-normal.woff2","fonts/cinzel-latin-900-normal.woff2","fonts/creepster-latin-400-normal.woff2","fonts/exo-2-latin-500-normal.woff2","fonts/exo-2-latin-700-italic.woff2","fonts/fredoka-latin-700-normal.woff2","fonts/inter-latin-wght-normal.woff2","fonts/m-plus-1p-latin-300-normal.woff2","fonts/m-plus-1p-latin-400-normal.woff2","fonts/m-plus-rounded-1c-latin-400-normal.woff2","fonts/m-plus-rounded-1c-latin-700-normal.woff2","fonts/nunito-sans-latin-300-normal.woff2","fonts/nunito-sans-latin-400-normal.woff2","fonts/nunito-sans-latin-600-normal.woff2","fonts/open-sans-latin-300-normal.woff2","fonts/open-sans-latin-400-normal.woff2","fonts/open-sans-latin-600-normal.woff2","fonts/orbitron-latin-900-normal.woff2","fonts/press-start-2p-latin-400-normal.woff2","fonts/racing-sans-one-latin-400-normal.woff2","gs3x/shim.js","img/icon-192.png","img/icon-512.png","img/icon.png","index.html","js/addgames.js","js/app.js","js/backpack.js","js/bg.js","js/booster-ui.js","js/covermaker.js","js/dom.js","js/gameopts.js","js/holidays.js","js/home.js","js/icons.js","js/iconsets.js","js/input.js","js/layouts/blades.js","js/layouts/common.js","js/layouts/dreamcast.js","js/layouts/nxe.js","js/layouts/ps2.js","js/layouts/ps4.js","js/layouts/steam.js","js/layouts/switch.js","js/layouts/threeds.js","js/layouts/waves.js","js/layouts/wii.js","js/layouts/xbox.js","js/layouts/xmb.js","js/library.js","js/modal.js","js/music.js","js/overlay.js","js/ownmusic.js","js/phonecopy.js","js/pickers.js","js/press.js","js/saved.js","js/settings.js","js/sound.js","js/state.js","js/styles.js","js/taskmgr.js","js/toast.js","manifest.webmanifest","phone/gs.js","phone/phone.css","phone/receive.js"];
const SCOPE = self.registration.scope;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('gs3-shell-') === 0 && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function idb() {
  return new Promise(function (res, rej) {
    const r = indexedDB.open('gs3phone', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); r.result.createObjectStore('saves'); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}
function idbGet(store, k) {
  return idb().then(function (d) {
    return new Promise(function (res) {
      const q = d.transaction(store, 'readonly').objectStore(store).get(k);
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { res(undefined); };
    });
  }).catch(function () { return undefined; });
}

const notFound = function () { return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } }); };

/* Range requests (music + videos inside games seek with them) */
async function ranged(req, res) {
  const range = req.headers.get('range');
  if (!range || !res || res.status !== 200) return res;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
  start = Math.max(0, start); end = Math.min(size - 1, end);
  if (start > end) return new Response('', { status: 416, headers: { 'content-range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'content-type': res.headers.get('content-type') || 'application/octet-stream',
    'content-range': 'bytes ' + start + '-' + end + '/' + size, 'content-length': String(end - start + 1), 'accept-ranges': 'bytes' } });
}

function escapeJson(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }

async function gameFile(req, rel) {
  const cache = await caches.open('gs3-games');
  let url = SCOPE + rel;
  let res = await cache.match(url, { ignoreSearch: true });
  if (!res && /\/$/.test(rel)) { url = SCOPE + rel + 'index.html'; res = await cache.match(url); }
  if (!res) {
    /* a game written on a Mac/phone may ask for "Music.ogg" when the file is "music.ogg" */
    const lower = (SCOPE + rel).toLowerCase();
    const keys = await cache.keys();
    const k = keys.find(function (x) { return x.url.toLowerCase() === lower; });
    if (k) res = await cache.match(k);
  }
  if (!res) return notFound();
  const isPage = (req.mode === 'navigate' || req.destination === 'document' || req.destination === 'iframe') && /text\/html/.test(res.headers.get('content-type') || '');
  if (!isPage) return ranged(req, res);
  /* the game's page: add its saves + the helper (own saves, GameSystem, home button) before its own code */
  const id = decodeURIComponent(rel.split('/')[1] || '');
  const [saves, settings, playing] = await Promise.all([idbGet('saves', id), idbGet('kv', 'settings'), idbGet('kv', 'playing')]);
  const look = settings && settings.homeStyle ? settings.homeStyle : 'gs3';
  const SKIN = { ps5: 'ps5', ps4: 'ps4', xbox: 'xbox', xboxone: 'xbox', switch: 'switch' };
  const info = { id: id, home: SCOPE, saves: saves || {}, console: { style: look, skin: SKIN[look] || '', name: look }, start: playing && playing.id === id ? playing.start : Date.now() };
  const tag = '<script>window.__gs3g=' + escapeJson(info) + ';</script><script src="' + SCOPE + 'gs3x/shim.js"></script>';
  let html = await res.text();
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + tag; });
  else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, function (m) { return m + tag; });
  else if (/<!doctype[^>]*>/i.test(html)) html = html.replace(/<!doctype[^>]*>/i, function (m) { return m + tag; });
  else html = tag + html;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function fromCache(name, req) {
  const c = await caches.open(name);
  return (await c.match(req, { ignoreSearch: true })) || null;
}

async function shell(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try { return await fetch(req); } catch (e) { return notFound(); }
}

self.addEventListener('fetch', function (e) {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || u.href.indexOf(SCOPE) !== 0 || e.request.method !== 'GET') return;
  const rel = u.href.slice(SCOPE.length).split('#')[0].split('?')[0];
  if (rel.indexOf('play/') === 0) { e.respondWith(gameFile(e.request, rel)); return; }
  if (rel.indexOf('covers/') === 0) { e.respondWith(fromCache('gs3-covers', e.request).then(function (r) { return r || notFound(); })); return; }
  if (rel.indexOf('sounds/') === 0 || rel === 'img/ps5-bg.jpg' || rel.indexOf('img/styles/') === 0) {
    /* the private console sounds + PS5 background came from the PC; without them the app just stays quiet */
    e.respondWith(fromCache('gs3-pack', e.request).then(function (r) { return r ? ranged(e.request, r) : notFound(); }));
    return;
  }
  e.respondWith(shell(e.request));
});
