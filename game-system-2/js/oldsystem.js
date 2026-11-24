/* Game System 2.0 — bring over the OLD Game System (the app that was on this same website before).
   The old one kept everything in this browser:
   - games + apps: IndexedDB "game-system-db", store "entries": {id, type: 'game'|'app', name, icon: data URL, files: [{name, blob}]}
   - its own menu song: store "music", id "custom": {name, blob}
   Its games saved their progress straight into this website's storage, so the games come over with
   "Private saves" OFF: they find their progress right where it was. Nothing old is ever changed or deleted. */
(function () {
  'use strict';
  var h = U.h;
  var OLD_DB = 'game-system-db';
  var STATE = 'gs2:oldGs';   /* 'done' or 'later' once you answered the popup */
  var SONG = 'gs2:oldSong';  /* the old menu song is already in Music */
  /* the old app's own settings (not game saves) */
  var OLD_KEYS = ['gs_music_track', 'gs_installed', 'gs_never_prompt', 'gs_last_playing'];

  function isBlob(x) { var t = Object.prototype.toString.call(x); return t === '[object Blob]' || t === '[object File]'; }
  function isHtml(n) { return /\.html?$/i.test(n || ''); }
  function cleanPath(n) { return String(n || '').replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '').trim(); }

  /* ---------------- reading the old database (never creates or changes it) ---------------- */
  async function exists() {
    if (!window.indexedDB) return false;
    if (indexedDB.databases) {
      try { return (await indexedDB.databases()).some(function (d) { return d && d.name === OLD_DB; }); } catch (e) { /* can't list: just try to open it */ }
    }
    return true;
  }
  function read() {
    return new Promise(function (resolve) {
      var req, isNew = false;
      try { req = indexedDB.open(OLD_DB); } catch (e) { resolve(null); return; }
      /* it wasn't there: stop, so we don't leave an empty one behind */
      req.onupgradeneeded = function () { isNew = true; try { req.transaction.abort(); } catch (e) { /* ignore */ } };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
      req.onsuccess = function () {
        var db = req.result;
        if (isNew || !db.objectStoreNames.contains('entries')) { db.close(); resolve(null); return; }
        var out = { entries: [], music: null };
        try {
          var stores = db.objectStoreNames.contains('music') ? ['entries', 'music'] : ['entries'];
          var tx = db.transaction(stores, 'readonly');
          var r1 = tx.objectStore('entries').getAll();
          r1.onsuccess = function () { out.entries = r1.result || []; };
          if (stores.length > 1) { var r2 = tx.objectStore('music').get('custom'); r2.onsuccess = function () { out.music = r2.result || null; }; }
          tx.oncomplete = function () { db.close(); resolve(out); };
          tx.onerror = tx.onabort = function () { db.close(); resolve(out.entries.length ? out : null); };
        } catch (e) { db.close(); resolve(null); }
      };
    });
  }

  /* what's in there: things that can run (they have an .html file), already brought over or not */
  async function scan() {
    if (!(await exists())) return null;
    var raw = await read();
    if (!raw) return null;
    var have = {};
    D.list().forEach(function (g) { if (g.oldId) have[g.oldId] = g; });
    var items = raw.entries.filter(function (e) { return e && e.id != null && Array.isArray(e.files); }).map(function (e) {
      var files = e.files.filter(function (f) { return f && f.name && isBlob(f.blob); });
      return { e: e, files: files, ok: files.some(function (f) { return isHtml(f.name); }), here: have[String(e.id)] || null };
    });
    var music = raw.music && isBlob(raw.music.blob) ? raw.music : null;
    if (!items.length && !music) return null;
    return { items: items, music: music, musicHere: !!music && U.lsGet(SONG, '') === songKey(music) };
  }

  /* the old square picture (a PNG, or a 24×24 SVG) → a wide cover: the picture in the middle, a blurry glow of it behind */
  function iconBlob(dataUrl) {
    return new Promise(function (resolve) {
      if (!/^data:image\//i.test(dataUrl || '')) { resolve(null); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var W = 960, H = 540, S = 380;
          var c = document.createElement('canvas');
          c.width = W; c.height = H;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#0c0a1a';
          ctx.fillRect(0, 0, W, H);
          /* the glow: the picture stretched over everything, blurred and darker */
          ctx.save();
          ctx.filter = 'blur(36px) saturate(1.3)';
          ctx.globalAlpha = 0.75;
          ctx.drawImage(img, -80, -(W - H) / 2 - 80, W + 160, W + 160);
          ctx.restore();
          ctx.fillStyle = 'rgba(8,6,20,.35)';
          ctx.fillRect(0, 0, W, H);
          /* the picture itself, with round corners and a shadow */
          var x = (W - S) / 2, y = (H - S) / 2, r = 46;
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,.55)';
          ctx.shadowBlur = 40;
          ctx.shadowOffsetY = 14;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, S, S, r); else ctx.rect(x, y, S, S);
          ctx.fillStyle = '#1e1a3a';
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, S, S, r); else ctx.rect(x, y, S, S);
          ctx.clip();
          /* small pixel-art pictures stay sharp */
          ctx.imageSmoothingEnabled = (img.naturalWidth || 0) >= 128 || /^data:image\/svg/i.test(dataUrl);
          ctx.drawImage(img, x, y, S, S);
          ctx.restore();
          c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.9);
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  /* one old game → a new one */
  async function bringOne(it) {
    var e = it.e;
    var used = {};
    var files = it.files.map(function (f) {
      var p = cleanPath(f.name) || 'file';
      while (used[p.toLowerCase()]) p = p.replace(/(\.[^.\/]*)?$/, '-2$1');
      used[p.toLowerCase()] = true;
      return { p: p, b: f.blob, t: f.blob.type || GS2Shared.mimeOf(p) };
    });
    var main = files.find(function (f) { return isHtml(f.p); });
    var g = await D.addGame({
      name: String(e.name || '').trim().slice(0, 80) || 'Old game',
      entry: main.p,
      kind: e.type === 'app' ? 'app' : 'game',
      kindSet: true,
      isolate: false,          /* uses the same save space as before, so the old progress is there */
      oldId: String(e.id)
    }, files);
    if (e.icon) {
      var pic = await iconBlob(e.icon);
      if (pic) { try { await D.setCover(g.id, pic); } catch (err) { /* keeps its letter picture */ } }
    }
    return g;
  }

  /* the old menu song → the Music app (once) */
  function songKey(m) { return String(m.name || '') + ':' + (m.blob ? m.blob.size : 0); }
  function duration(blob) {
    return new Promise(function (resolve) {
      var a = new Audio(), url = URL.createObjectURL(blob), t = setTimeout(function () { end(0); }, 6000);
      function end(d) { clearTimeout(t); URL.revokeObjectURL(url); resolve(isFinite(d) && d > 0 ? d : 0); }
      a.preload = 'metadata';
      a.onloadedmetadata = function () { end(a.duration); };
      a.onerror = function () { end(0); };
      a.src = url;
    });
  }
  function musicDb() {
    /* the Music app's own storage (built-in apps keep theirs private: gs2:idb:<app>:<name>) */
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open('gs2:idb:gs2-music:music', 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('tracks')) r.result.createObjectStore('tracks', { keyPath: 'id' }); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  async function bringMusic(m) {
    if (!D.get('gs2-music')) return false;
    var db = await musicDb();
    try {
      var all = await new Promise(function (res) { var q = db.transaction('tracks').objectStore('tracks').getAll(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; });
      var name = String(m.name || 'My old menu song');
      if (all.some(function (t) { return t.file === name && t.size === m.blob.size; })) { U.lsSet(SONG, songKey(m)); return false; }
      var d = await duration(m.blob);
      var title = name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').trim() || 'My old menu song';
      var t = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: title, artist: 'From my old Game System', file: name, type: m.blob.type, size: m.blob.size, duration: d, added: Date.now(), blob: m.blob };
      await new Promise(function (res, rej) { var tx = db.transaction('tracks', 'readwrite'); tx.objectStore('tracks').put(t); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; });
      U.lsSet(SONG, songKey(m));
      return true;
    } finally { db.close(); }
  }

  /* ---------------- the popup ---------------- */
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function countText(list) {
    var g = list.filter(function (x) { return x.e.type !== 'app'; }).length, a = list.length - g;
    return [g ? plural(g, 'game') : '', a ? plural(a, 'app') : ''].filter(Boolean).join(' and ') || 'nothing';
  }
  /* auto: the popup at start-up (only once, and only if there's something new). Returns a promise for when it's closed. */
  async function offer(auto) {
    if (auto && U.lsGet(STATE, '')) return;
    var found = null;
    try { found = await scan(); } catch (e) { found = null; }
    if (!found) {
      if (!auto) UI.alert('Nothing found', 'There\'s no old Game System in this browser. It only works on the same website (and in the same browser) you used the old one in.');
      return;
    }
    var fresh = found.items.filter(function (x) { return x.ok && !x.here; });
    if (auto && !fresh.length) return;
    return new Promise(function (resolve) { showList(found, auto, resolve); });
  }
  function showList(found, auto, resolve) {
    var picks = new Map();
    var rows = found.items.map(function (it) {
      var on = it.ok && !it.here;
      if (on) picks.set(it, true);
      var cb = h('input', { type: 'checkbox', checked: on, disabled: !it.ok || !!it.here, onchange: function (ev) { if (ev.target.checked) picks.set(it, true); else picks.delete(it); paint(); } });
      return h('label.og-row' + (on ? '' : '.off'),
        cb,
        h('img.og-pic', { src: /^data:image\//i.test(it.e.icon || '') ? it.e.icon : 'icons/icon.svg', alt: '' }),
        h('span.og-name', String(it.e.name || 'Untitled')),
        h('span.og-tag', it.here ? 'already here' : !it.ok ? 'can\'t run in a browser' : it.e.type === 'app' ? 'app' : 'game'));
    });
    var musicCb = found.music && !found.musicHere && D.get('gs2-music') ? h('input', { type: 'checkbox', checked: true }) : null;
    var btnLabel = h('span');
    var m = UI.modal({
      title: 'Found your old Game System!',
      icon: 'sparkle',
      body: h('div.og',
        h('p', 'Your old games are still in this browser. Bring them over? ', h('b', 'Your progress comes with them.'), ' Nothing in the old one gets deleted.'),
        h('div.og-list', rows),
        musicCb ? h('label.row.og-music', musicCb, 'Also put my old menu song ("' + String(found.music.name || 'song') + '") in the Music app') : null),
      dismissible: !auto,
      actions: [
        { label: auto ? 'Not now' : 'Cancel', kind: 'ghost', onClick: function () { if (auto) U.lsSet(STATE, 'later'); } },
        { label: btnLabel, kind: 'primary', onClick: function () { go(); return false; } }
      ],
      /* when bringing them over, the popup closes first: we're done once they're all here */
      onClose: function () { if (!running) resolve(); }
    });
    function paint() {
      btnLabel.textContent = picks.size ? 'Bring over ' + countText(Array.from(picks.keys())) : (musicCb && musicCb.checked ? 'Bring over the song' : 'Bring them over');
    }
    var running = false;
    paint();
    if (musicCb) musicCb.addEventListener('change', paint);
    async function go() {
      if (running) return;
      var list = Array.from(picks.keys());
      var song = musicCb && musicCb.checked;
      if (!list.length && !song) { m.close(); return; }
      running = true;
      m.close();
      var label = h('div.small.muted', 'Starting…');
      var bar = h('div.progress', h('i'));
      var pm = UI.modal({ title: 'Bringing your stuff over', icon: 'download', body: h('div', label, h('div', { style: { height: '10px' } }), bar), dismissible: false });
      var made = [], failed = [], songDone = false;
      for (var i = 0; i < list.length; i++) {
        label.textContent = 'Bringing over ' + (list[i].e.name || 'a game') + '… (' + (i + 1) + '/' + list.length + ')';
        bar.firstChild.style.width = Math.round(i / Math.max(1, list.length) * 100) + '%';
        try { made.push(await bringOne(list[i])); } catch (e) { failed.push(String(list[i].e.name || '?')); }
      }
      if (song) { label.textContent = 'Adding your old menu song to Music…'; try { songDone = await bringMusic(found.music); } catch (e) { songDone = false; } }
      bar.firstChild.style.width = '100%';
      pm.close();
      U.lsSet(STATE, 'done');
      /* your old games first, in the same order as the old app */
      if (made.length && window.Layout && Layout.toFront) {
        try {
          await Layout.toFront('library', made.map(function (g) { return g.id; }));
          await Layout.toFront('apps', made.filter(D.isApp).map(function (g) { return g.id; }));
        } catch (e) { /* the order is just looks */ }
      }
      if (made.length) {
        Sound.good();
        var games = made.filter(function (g) { return !D.isApp(g); }).length, apps = made.length - games;
        UI.toast(h('span', 'Brought over ', h('b', [games ? plural(games, 'game') : '', apps ? plural(apps, 'app') : ''].filter(Boolean).join(' and ')), '! Your old progress is in them.' + (songDone ? ' Your old menu song is in Music.' : '')), { type: 'good', title: 'Welcome back', icon: 'sparkle', timeout: 9000, sound: false });
        App.go(games ? 'library' : 'apps');
      } else if (songDone) {
        UI.toast('Your old menu song is in the Music app.', { type: 'good', icon: 'music' });
      }
      if (failed.length) UI.toast('Couldn\'t bring these over: ' + failed.join(', '), { type: 'warn', timeout: 9000 });
      resolve();
    }
  }

  /* the progress old games saved in this website's shared space (for backups) */
  function sharedSaves() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('gs2') === 0 || OLD_KEYS.indexOf(k) >= 0) continue;
        out[k] = localStorage.getItem(k);
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  window.OldGS = {
    scan: scan,
    offer: offer,
    sharedSaves: sharedSaves,
    /* any games using the shared save space? (then backups carry it) */
    anyShared: function () { return D.list().some(function (g) { return g.isolate === false; }); }
  };
})();
