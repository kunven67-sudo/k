/* Getting everything from the PC: the PC's page (opened by scanning its code) opened this page, and hands over every
   game file, cover, save and the sound pack through the browser. Only runs with #from-pc in the address. */
(function () {
  'use strict';
  if (!/from-pc/.test(location.hash)) return;
  var SCOPE = new URL('./', location.href).href;
  var MIME = { html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', xml: 'application/xml', svg: 'image/svg+xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg',
    weba: 'audio/webm', mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', m4v: 'video/mp4', wasm: 'application/wasm', ttf: 'font/ttf', otf: 'font/otf',
    woff: 'font/woff', woff2: 'font/woff2', glb: 'model/gltf-binary', gltf: 'model/gltf+json', zip: 'application/zip', csv: 'text/csv', webmanifest: 'application/manifest+json' };
  var mime = function (p) { var m = /\.([a-z0-9]+)$/i.exec(p); return (m && MIME[m[1].toLowerCase()]) || 'application/octet-stream'; };
  var enc = function (p) { return String(p).split('/').map(encodeURIComponent).join('/'); };
  var mb = function (n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1048576)) + ' MB'; };

  /* the screen */
  var css = 'position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:24px;background:radial-gradient(90% 60% at 80% 0%,rgba(52,66,104,.45),transparent 70%),#06070a;color:#f3f4f7;font-family:system-ui,"Segoe UI",Roboto,sans-serif;text-align:center';
  var box = document.createElement('div');
  box.id = 'gs3-receive';
  box.style.cssText = css;
  box.innerHTML = '<div style="width:100%;max-width:560px">' +
    '<div style="display:inline-flex;align-items:center;gap:14px;margin-bottom:26px"><div style="display:flex;flex-direction:column;font-weight:300;letter-spacing:.5em;font-size:12px;line-height:1.6;text-align:left"><span>GAME</span><span>SYSTEM</span></div><div style="font-weight:200;font-size:48px;line-height:1;padding-left:14px;border-left:1px solid rgba(255,255,255,.3)">3</div></div>' +
    '<h1 id="rx-t" style="font-size:24px;margin:0 0 10px">Getting your games from the PC…</h1>' +
    '<div style="height:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin:18px 0 10px"><i id="rx-f" style="display:block;height:100%;width:0;background:#fff;border-radius:inherit;transition:width .3s"></i></div>' +
    '<div id="rx-s" style="font-size:14px;color:rgba(243,244,247,.6);min-height:20px">Connecting…</div>' +
    '<button id="rx-i" hidden style="margin-top:26px;width:100%;height:58px;border:2px solid rgba(255,255,255,.5);border-radius:99px;background:transparent;color:#fff;font:700 18px system-ui,sans-serif">Add to home screen</button>' +
    '<div id="rx-is" hidden style="font-size:13px;color:rgba(243,244,247,.5);margin-top:8px">Opens like an app, and your phone won\'t clear your games to free up space.</div>' +
    '<button id="rx-b" hidden style="margin-top:14px;width:100%;height:58px;border:0;border-radius:99px;background:#fff;color:#0b0c10;font:700 18px system-ui,sans-serif">Open Game System 3</button></div>';
  var show = function () { (document.body || document.documentElement).appendChild(box); };
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  var $ = function (id) { return document.getElementById(id); };
  var say = function (t, s) { if ($('rx-t')) { if (t) $('rx-t').textContent = t; if (s != null) $('rx-s').textContent = s; } };

  var pc = window.opener;
  if (!pc) {
    var blocked = /blocked/.test(location.hash);
    setTimeout(function () { say(blocked ? 'Almost there' : 'Scan the code on your PC', blocked ? 'Your phone blocked the second tab. Go back to the PC\'s page and tap "Copy to my phone" again.' : 'On your PC: Settings > System > Copy to my phone. Then point this phone\'s camera at the code.'); }, 50);
    return;
  }
  var n = 0, waiting = {}, started = false;
  function ask(path, as) {
    return new Promise(function (res, rej) {
      var id = ++n;
      waiting[id] = { res: res, rej: rej, t: setTimeout(function () { delete waiting[id]; rej(new Error('The PC stopped answering')); }, 180000) };
      pc.postMessage({ kind: 'get', n: id, path: path, as: as || 'buf' }, '*');
    });
  }
  window.addEventListener('message', function (e) {
    if (e.source !== pc || !e.data) return;
    var m = e.data;
    if (m.kind === 'hello' && !started) { started = true; run().catch(function (er) { say('Copying stopped', String(er && er.message || er) + '. Scan the code on the PC again: it picks up where it stopped.'); }); }
    if (m.kind === 'got' && waiting[m.n]) {
      var w = waiting[m.n]; delete waiting[m.n]; clearTimeout(w.t);
      if (m.error) w.rej(new Error(m.error)); else w.res(m.json !== undefined ? m.json : m.buf);
    }
  });
  var hi = setInterval(function () { if (started) { clearInterval(hi); return; } try { pc.postMessage({ kind: 'ready' }, '*'); } catch (e) { /* closed */ } }, 700);
  try { pc.postMessage({ kind: 'ready' }, '*'); } catch (e) { /* closed */ }

  /* keep the screen on while copying (a sleeping phone stops everything) */
  var lock = null, copying = false;
  function keepAwake() { try { if (navigator.wakeLock && copying) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {}); } catch (e) { /* fine */ } }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') keepAwake(); });

  /* a file that's already here and the same as on the PC (size + changed time) isn't copied again: a copy that
     stopped picks up where it was, and copying again only brings what's new */
  var ver = function (f) { return f.s + ':' + (f.m || 0); };

  async function run() {
    copying = true; keepAwake();
    try { return await copyAll(); } finally { copying = false; try { if (lock) lock.release(); } catch (e) { /* fine */ } }
  }
  async function copyAll() {
    var m = await ask('list', 'json');
    var P = window.GS3Phone;
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* fine */ }
    var total = m.games.reduce(function (s, g) { return s + g.bytes; }, 0) + m.pack.reduce(function (s, p) { return s + p.s; }, 0);
    var gamesC = await caches.open('gs3-games'), coversC = await caches.open('gs3-covers'), packC = await caches.open('gs3-pack');
    /* what's missing or changed */
    say('Checking what\'s already on this phone…');
    var have = 0;
    for (var pi = 0; pi < m.pack.length; pi++) {
      var hp = await packC.match(SCOPE + m.pack[pi].name);
      m.pack[pi].skip = !!(hp && hp.headers.get('x-size') === String(m.pack[pi].s));
      if (m.pack[pi].skip) have += m.pack[pi].s;
    }
    for (var gj = 0; gj < m.games.length; gj++) {
      var gg = m.games[gj];
      if (gg.url) continue;
      var gbase = SCOPE + 'play/' + encodeURIComponent(gg.id) + '/';
      gg.want = {};
      for (var fi = 0; fi < gg.files.length; fi++) {
        var ff = gg.files[fi], fu = new URL(gbase + enc(ff.p)).href;
        gg.want[fu] = 1;
        var hf = await gamesC.match(fu);
        ff.skip = !!(hf && hf.headers.get('x-v') === ver(ff));
        if (ff.skip) have += ff.s;
      }
    }
    try {
      var est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      if (est && est.quota && est.quota - est.usage < (total - have) * 1.1) throw new Error('Not enough room on this phone (needs ' + mb(total - have) + ' more)');
    } catch (e) { if (/room/.test(e.message)) throw e; }
    var done = have;
    var tell = function (name) {
      $('rx-f').style.width = Math.round(done / Math.max(1, total) * 100) + '%';
      say(null, (name ? name + ' · ' : '') + mb(done) + ' of ' + mb(total));
      try { pc.postMessage({ kind: 'progress', done: done, total: total, name: name }, '*'); } catch (e) { /* closed */ }
    };
    tell('');
    /* the console sound pack */
    say('Getting your console sounds…');
    for (var i = 0; i < m.pack.length; i++) {
      var p = m.pack[i];
      if (p.skip) continue;
      var b = await ask('pack/' + enc(p.name));
      await packC.put(SCOPE + p.name, new Response(b, { headers: { 'content-type': mime(p.name), 'x-size': String(p.s) } }));
      done += p.s; tell('Console sounds');
    }
    var lib = await P.lib();
    var keys = await gamesC.keys();
    for (var gi = 0; gi < m.games.length; gi++) {
      var g = m.games[gi];
      say('Copying ' + g.name + '…');
      if (!g.url) {
        var base = SCOPE + 'play/' + encodeURIComponent(g.id) + '/';
        /* files the PC's copy of the game doesn't have any more */
        await Promise.all(keys.filter(function (k) { return k.url.indexOf(base) === 0 && !g.want[k.url]; }).map(function (k) { return gamesC.delete(k); }));
        var files = g.files.filter(function (f) { return !f.skip; });
        /* 4 at a time */
        await Promise.all([0, 1, 2, 3].map(async function () {
          while (files.length) {
            var f = files.shift();
            var buf = await ask('file/' + encodeURIComponent(g.id) + '/' + enc(f.p));
            await gamesC.put(base + enc(f.p), new Response(buf, { headers: { 'content-type': mime(f.p), 'x-v': ver(f) } }));
            done += f.s; tell(g.name);
          }
        }));
      }
      var coverAt = 0;
      if (g.cover) {
        try {
          var cb = await ask(g.cover);
          await coversC.put(SCOPE + 'covers/' + encodeURIComponent(g.id) + '.img', new Response(cb, { headers: { 'content-type': 'image/jpeg' } }));
          coverAt = Date.now();
        } catch (e) { /* no cover then */ }
      }
      /* saves: whichever was played last wins (PC or this phone). The one that loses is kept aside, never thrown away */
      var had = lib.games[g.id] || {};
      var sv = await ask('save/' + encodeURIComponent(g.id), 'json');
      var old = await P.get('saves', g.id);
      var phoneNewer = old && Object.keys(old).length && (had.lastPlayed || 0) > (g.lastPlayed || 0);
      if (phoneNewer) { if (sv && Object.keys(sv).length) await P.put('kv', 'savesFromPc:' + g.id, { at: Date.now(), data: sv }); }
      else {
        if (old && Object.keys(old).length) await P.put('kv', 'savesBefore:' + g.id, { at: Date.now(), data: old });
        if (sv && Object.keys(sv).length) await P.put('saves', g.id, sv);
      }
      lib.games[g.id] = {
        id: g.id, name: g.name, kind: g.kind, entry: g.entry, url: g.url, tags: g.tags, hidden: g.hidden, logo: g.logo, music: g.music,
        added: g.added || Date.now(), playTime: Math.max(g.playTime || 0, had.playTime || 0), lastPlayed: Math.max(g.lastPlayed || 0, had.lastPlayed || 0),
        launches: had.launches || 0, coverAt: coverAt || had.coverAt || 0
      };
    }
    /* the PC's order + folders, then anything only this phone has */
    lib.layout = (m.layout || []).concat(lib.layout || []);
    P.reconcile(lib);
    await P.saveLib(lib);
    var s = await P.settings();
    Object.assign(s, m.settings || {}, { firstRun: false });
    await P.put('kv', 'settings', s);
    done = total; tell('');
    say('All done!', m.games.length + (m.games.length === 1 ? ' game is' : ' games are') + ' on your phone, with their saves.');
    try { pc.postMessage({ kind: 'finished', games: m.games.length }, '*'); } catch (e) { /* closed */ }
    $('rx-b').hidden = false;
    $('rx-b').onclick = function () { location.replace(location.pathname); };
    /* offer Add to home screen when Chrome allows it (now or a bit later) */
    var offer = function () {
      if (!(window.gs && window.gs.canInstall && window.gs.canInstall())) return;
      $('rx-i').hidden = false; $('rx-is').hidden = false;
      $('rx-i').onclick = function () { window.gs.invoke('win:install').then(function (ok) { if (ok) { $('rx-i').hidden = true; $('rx-is').textContent = 'Added. Open Game System 3 from your home screen.'; } }); };
    };
    offer();
    addEventListener('gs3:installable', offer);
  }
})();
