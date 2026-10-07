/* Game System 2.0 — service worker.
   - Serves games from the browser's storage at  <site>/play/<gameId>/<file>
     (so games made of many files — images, sounds, scripts in folders — just work)
   - Adds the Game Kit to every game page (Save Kit, private saves, error reporting)
   - Keeps the app working offline */
importScripts('js/db.js', 'js/shared.js');

var VERSION = GS2Shared.APP_VERSION + '-2';
var CACHE = 'gs2-shell-' + VERSION;
var SHELL = ['./'].concat(GS2Shared.APP_FILES.filter(function (f) { return f !== 'sw.js' && f !== '_headers'; }));

var SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(SHELL.map(function (u) {
      return cache.add(new Request(u, { cache: 'reload' })).catch(function () { /* missing file: keep going */ });
    }));
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf('gs2-shell-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (e) { /* ignore */ }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', function (event) {
  var d = event.data || {};
  if (d.type === 'ping' && event.source) event.source.postMessage({ gs2sw: 'pong', version: VERSION });
  if (d.type === 'claim') event.waitUntil(self.clients.claim());
  if (d.type === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(SCOPE_PATH) !== 0) return;
  var rel = url.pathname.slice(SCOPE_PATH.length);

  if (rel.indexOf('play/') === 0) { event.respondWith(servePlay(req, url, rel)); return; }
  if (rel === '__gs2/boot.js') { event.respondWith(serveBoot(url)); return; }
  if (rel === '__gs2/ping') { event.respondWith(new Response('pong ' + VERSION, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })); return; }
  if (req.method !== 'GET') return;
  event.respondWith(networkFirst(req, rel));
});

/* ---------- app files: network first (always fresh), cache when offline ---------- */
async function networkFirst(req, rel) {
  var cache = await caches.open(CACHE);
  try {
    var res = await fetchWithTimeout(req, 6000);
    if (res && res.ok && res.type === 'basic' && !/^games\//.test(rel)) {
      cache.put(req, res.clone()).catch(function () {});
    }
    return res;
  } catch (err) {
    var hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      hit = await cache.match('index.html') || await cache.match('./');
      if (hit) return hit;
    }
    return new Response('Offline and this file is not saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

function fetchWithTimeout(req, ms) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms);
    fetch(req).then(function (r) {
      if (done) return;
      done = true; clearTimeout(t); resolve(r);
    }, function (e) {
      if (done) return;
      done = true; clearTimeout(t); reject(e);
    });
  });
}

/* ---------- games ---------- */
function decodePath(p) {
  return p.split('/').map(function (s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }).join('/');
}

async function findFile(game, path) {
  var rec = await GS2DB.getFile(game.id, path);
  if (rec) return rec;

  /* Windows doesn't care about UPPER/lower case in file names but websites do. Be forgiving. */
  var keys = await GS2DB.fileKeys(game.id);
  var low = path.toLowerCase();
  var alt = keys.find(function (k) { return k.toLowerCase() === low; });
  if (!alt && !/\.[a-z0-9]+$/i.test(path)) {
    alt = keys.find(function (k) { var kl = k.toLowerCase(); return kl === low + '.html' || kl === low + '/index.html'; });
  }
  if (alt) return GS2DB.getFile(game.id, alt);

  /* Games that live on the website (games/<id>/...) are downloaded the first time they're used */
  if (game.source === 'site') {
    var list = Array.isArray(game.siteFiles) ? game.siteFiles : [];
    var real = list.indexOf(path) >= 0 ? path : list.find(function (k) { return k.toLowerCase() === low; });
    if (!real && !/\.[a-z0-9]+$/i.test(path)) {
      real = list.find(function (k) { var kl = k.toLowerCase(); return kl === low + '.html' || kl === low + '/index.html'; });
    }
    if (!real && list.length) return null;
    path = real || path;
    var siteUrl = new URL('games/' + encodeURIComponent(game.id) + '/' + path.split('/').map(encodeURIComponent).join('/'), self.registration.scope);
    try {
      var r = await fetch(siteUrl.href, { cache: 'no-cache' });
      if (r.ok) {
        var blob = await r.blob();
        var type = GS2Shared.mimeOf(path);
        await GS2DB.putFile(game.id, path, blob, type);
        return { g: game.id, p: path, b: blob, t: type };
      }
    } catch (e) { /* offline */ }
  }
  return null;
}

async function notify(msg) {
  var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.forEach(function (c) {
    if (c.frameType === 'top-level' || c.frameType === undefined) c.postMessage(Object.assign({ gs2sw: true }, msg));
  });
}

function htmlPage(title, body, status) {
  var page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title +
    '</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07080d;color:#e8ecff;font:16px system-ui,sans-serif;text-align:center}' +
    'div{max-width:520px;padding:24px}h1{font-size:22px;margin:0 0 10px}p{opacity:.8;line-height:1.5}code{background:#ffffff14;padding:2px 6px;border-radius:6px}</style></head><body><div>' +
    body + '</div></body></html>';
  return new Response(page, { status: status || 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

async function servePlay(req, url, rel) {
  var parts = rel.split('/');
  var id = decodePath(parts[1] || '');
  var path = decodePath(parts.slice(2).join('/'));
  var game = id ? await GS2DB.get('games', id) : null;

  if (!game) {
    if (req.mode === 'navigate') {
      /* Something inside a game tried to go "back to the menu" (old-style link) */
      return htmlPage('Back to menu', '<h1>Going back to the menu…</h1><script>try{var h=parent.__GS2_HOST;if(h)h.quit(null)}catch(e){}</script>');
    }
    return new Response('Game not found', { status: 404 });
  }

  if (!path || path.slice(-1) === '/') path = path ? path + 'index.html' : (game.entry || 'index.html');

  var rec = await findFile(game, path);
  if (!rec) {
    notify({ type: 'missing', id: game.id, path: path });
    if (req.mode === 'navigate') {
      return htmlPage('Missing file', '<h1>Missing file</h1><p>This game tried to open <code>' + esc(path) +
        '</code> but that file isn\'t in the game.</p><p>If the game has more files, add the whole folder (or a .zip) instead of just one file.</p>', 404);
    }
    return new Response('Missing file: ' + path, { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  }

  var type = rec.t || GS2Shared.mimeOf(path);
  var headers = { 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };

  if (GS2Shared.isHtml(path) || /^text\/html/.test(type)) {
    var u8 = new Uint8Array(await rec.b.arrayBuffer());
    var tag = '<script src="' + SCOPE_PATH + '__gs2/boot.js?g=' + encodeURIComponent(game.id) + '"></script>';
    var out = GS2Shared.injectTag(u8, tag);
    headers['Content-Type'] = GS2Shared.isUtf8(u8) ? 'text/html; charset=utf-8' : 'text/html';
    return new Response(out, { headers: headers });
  }

  var blob = rec.b;
  headers['Content-Type'] = GS2Shared.isTextMime(type) ? type + '; charset=utf-8' : type;

  var range = req.headers.get('Range');
  if (range) {
    var mm = /bytes=(\d*)-(\d*)/.exec(range);
    if (mm) {
      var size = blob.size;
      var start = mm[1] === '' ? Math.max(0, size - Number(mm[2])) : Number(mm[1]);
      var end = mm[1] !== '' && mm[2] !== '' ? Math.min(Number(mm[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      }
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
      headers['Content-Length'] = String(end - start + 1);
      return new Response(blob.slice(start, end + 1), { status: 206, headers: headers });
    }
  }
  headers['Content-Length'] = String(blob.size);
  return new Response(blob, { headers: headers });
}

async function serveBoot(url) {
  var id = url.searchParams.get('g') || '';
  var game = id ? await GS2DB.get('games', id) : null;
  var save = id ? await GS2DB.get('saves', id) : null;
  var settings = (await GS2DB.kvGet('settings')) || {};
  var kitRes = await caches.match('kit/gs2-kit.js', { ignoreSearch: true });
  if (!kitRes) {
    try { kitRes = await fetch('kit/gs2-kit.js', { cache: 'no-cache' }); } catch (e) { kitRes = null; }
  }
  var kit = kitRes && kitRes.ok ? await kitRes.text() : 'console.warn("Game System kit missing")';
  var boot = {
    id: id,
    name: game ? game.name : '',
    entry: game ? game.entry : 'index.html',
    isolate: game ? game.isolate !== false : true,
    hotkey: settings.hotkey || 'F2',
    autosave: settings.autosaveSec || 5,
    resume: save ? { data: save.data, t: save.t } : null
  };
  return new Response(GS2Shared.bootScript(boot, kit), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
