/* Game System 2.0 — app data: games, settings, UI state (for resume), saves, play time, site games. */
(function () {
  'use strict';

  var DEFAULT_SETTINGS = {
    name: 'bro',
    avatar: '😎',
    bg: 'insane',          /* insane | chill | off */
    scanlines: true,
    sounds: true,
    volume: 0.55,
    titleScreen: true,
    resume: 'popup',       /* popup | auto | menu */
    hotkey: 'F2',
    autosaveSec: 5,
    accentAuto: true,
    accent: '#00e5ff',
    accent2: '#ff2bd6',
    reduceMotion: false,
    lastBackup: 0,
    backupNag: true,
    welcomed: false
  };
  var DEFAULT_UI = {
    view: 'home',
    sel: null,
    lib: { q: '', folder: 'all', sort: 'recent' },
    scroll: {},
    playing: null,
    editor: null,
    t: 0
  };

  /* first time on a phone: calmer background to save battery */
  function firstRunDefaults() {
    if (U.lsGet('gs2:settings', null)) return {};
    var phone = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
    return phone ? { bg: 'chill' } : {};
  }

  var listeners = [];
  var coverCache = new Map();

  var D = {
    games: new Map(),
    settings: Object.assign({}, DEFAULT_SETTINGS, firstRunDefaults(), U.lsGet('gs2:settings', {})),
    ui: Object.assign({}, DEFAULT_UI, U.lsGet('gs2:ui', {})),
    days: {},
    pendingPlay: {},
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
  D.ui.lib = Object.assign({}, DEFAULT_UI.lib, D.ui.lib || {});
  D.ui.scroll = D.ui.scroll || {};

  D.on = function (fn) { listeners.push(fn); };
  D.emit = function (type, payload) {
    listeners.forEach(function (fn) { try { fn(type, payload); } catch (e) { console.error(e); } });
  };

  /* ---------------- boot ---------------- */
  D.init = async function () {
    await GS2DB.open();
    var all = await GS2DB.getAll('games');
    all.forEach(function (g) { D.games.set(g.id, normalize(g)); });
    D.days = (await GS2DB.kvGet('days')) || {};

    /* play time that was still in memory when the browser closed last time */
    var pending = U.lsGet('gs2:ptPending', null);
    if (pending && typeof pending === 'object') {
      Object.keys(pending).forEach(function (id) { D.addPlayTime(id, Number(pending[id]) || 0, true); });
      try { localStorage.removeItem('gs2:ptPending'); } catch (e) { /* ignore */ }
      await D.flushPlay();
    }
    await GS2DB.kvSet('settings', D.settings);
  };

  function normalize(g) {
    return Object.assign({
      name: 'Untitled Game', desc: '', emoji: '🎮', color: null, folder: '', fav: false,
      entry: 'index.html', source: 'local', size: 0, fileCount: 0, created: Date.now(), updated: Date.now(),
      lastPlayed: 0, playTime: 0, launches: 0, isolate: true, kitAutosave: false, cover: null
    }, g);
  }
  D.normalize = normalize;

  /* ---------------- queries ---------------- */
  D.get = function (id) { return D.games.get(id) || null; };
  D.list = function () {
    return Array.from(D.games.values()).sort(function (a, b) {
      return (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.created || 0) - (a.created || 0);
    });
  };
  D.folders = function () {
    var set = {};
    D.games.forEach(function (g) { if (g.folder) set[g.folder] = (set[g.folder] || 0) + 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b); }).map(function (f) { return { name: f, count: set[f] }; });
  };
  D.findByName = function (name) {
    var n = String(name || '').trim().toLowerCase();
    var out = null;
    D.games.forEach(function (g) { if (!out && g.name.trim().toLowerCase() === n) out = g; });
    return out;
  };
  D.newId = function (name) {
    var base = U.slug(name);
    var id;
    do { id = base + '-' + U.uid(4); } while (D.games.has(id));
    return id;
  };

  /* ---------------- games ---------------- */
  /* files: [{p, b, t}] */
  D.addGame = async function (meta, files) {
    var now = Date.now();
    var g = normalize(Object.assign({}, meta, {
      id: meta.id && !D.games.has(meta.id) ? meta.id : D.newId(meta.name),
      created: now,
      updated: now
    }));
    if (!g.emoji) g.emoji = U.guessEmoji(g.name);
    if (!g.color) g.color = U.colorFor(g.name);
    if (files) {
      g.size = files.reduce(function (s, f) { return s + (f.b ? f.b.size : 0); }, 0);
      g.fileCount = files.length;
    }
    await GS2DB.saveGame(g, files || []);
    D.games.set(g.id, g);
    D.emit('games');
    return g;
  };

  D.updateGame = async function (id, patch, opts) {
    var g = D.games.get(id);
    if (!g) return null;
    var next = Object.assign({}, g, patch);
    if (opts && opts.touch) next.updated = Date.now();
    await GS2DB.put('games', next);
    D.games.set(id, next);
    D.emit('game', id);
    return next;
  };

  /* Replace all files of a game (used for "update game" and imports). Keeps saves + stats. */
  D.replaceFiles = async function (id, files, entry) {
    var g = D.games.get(id);
    if (!g) return null;
    var next = Object.assign({}, g, {
      entry: entry || g.entry,
      size: files.reduce(function (s, f) { return s + (f.b ? f.b.size : 0); }, 0),
      fileCount: files.length,
      updated: Date.now(),
      source: g.source === 'link' ? 'link' : 'local',
      siteFiles: undefined
    });
    await GS2DB.saveGame(next, files);
    D.games.set(id, next);
    D.emit('game', id);
    return next;
  };

  D.deleteGame = async function (id) {
    var g = D.games.get(id);
    if (!g) return;
    await GS2DB.deleteGame(id);
    await D.wipeSaves(id, true);
    if (g.source === 'site' || g.fromSite) {
      var tomb = (await GS2DB.kvGet('tombstones')) || {};
      tomb[id] = g.siteRev || 1;
      await GS2DB.kvSet('tombstones', tomb);
    }
    var c = coverCache.get(id);
    if (c) { URL.revokeObjectURL(c.url); coverCache.delete(id); }
    D.games.delete(id);
    if (D.ui.sel === id) D.ui.sel = null;
    if (D.ui.playing === id) D.ui.playing = null;
    D.saveUI();
    D.emit('games');
  };

  D.duplicateGame = async function (id) {
    var g = D.games.get(id);
    if (!g) return null;
    await D.ensureLocalFiles(g);
    var files = (await GS2DB.filesOf(id)).map(function (f) { return { p: f.p, b: f.b, t: f.t }; });
    var copy = Object.assign({}, g, { id: undefined, name: g.name + ' (copy)', source: g.source === 'link' ? 'link' : 'local', siteRev: undefined, siteFiles: undefined, playTime: 0, launches: 0, lastPlayed: 0, fav: false });
    return D.addGame(copy, files);
  };

  /* ---------------- covers ---------------- */
  D.coverUrl = function (g) {
    if (!g || !g.cover) return null;
    var c = coverCache.get(g.id);
    if (c && c.blob === g.cover) return c.url;
    if (c) URL.revokeObjectURL(c.url);
    var url = URL.createObjectURL(g.cover);
    coverCache.set(g.id, { blob: g.cover, url: url });
    return url;
  };
  D.setCover = async function (id, blob) {
    if (!blob) return D.updateGame(id, { cover: null });
    var small = await U.resizeImage(blob, 960);
    if (!small) throw new Error('That picture could not be opened.');
    var color = await U.avgColor(small);
    var patch = { cover: small };
    if (color) patch.color = color;
    return D.updateGame(id, patch);
  };

  /* ---------------- Save Kit resume points ---------------- */
  D.getSave = function (id) { return GS2DB.get('saves', id); };
  D.putSave = async function (id, json, t) {
    await GS2DB.put('saves', { g: id, data: json, t: t || Date.now(), size: json ? json.length : 0 });
    /* the emergency copy (written when the tab closed) is now older than the real save */
    try {
      var k = 'gs2:emerg:' + id;
      var em = JSON.parse(localStorage.getItem(k) || 'null');
      if (em && em.t <= (t || Date.now())) localStorage.removeItem(k);
    } catch (e) { /* ignore */ }
  };
  D.deleteSave = async function (id) {
    await GS2DB.del('saves', id);
    try { localStorage.removeItem('gs2:emerg:' + id); } catch (e) { /* ignore */ }
  };
  /* newest resume point (database or the emergency copy) */
  D.latestSave = async function (id) {
    var s = await D.getSave(id);
    try {
      var em = JSON.parse(localStorage.getItem('gs2:emerg:' + id) || 'null');
      if (em && em.data != null && (!s || em.t > s.t)) s = { g: id, data: em.data, t: em.t, size: em.data.length, emergency: true };
    } catch (e) { /* ignore */ }
    return s || null;
  };

  /* localStorage saves that belong to a game (Game System keeps each game's saves separate) */
  D.storageKeys = function (id) {
    var out = [];
    var pre = 'gs2:ls:' + id + ':';
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(pre) === 0) {
          var v = localStorage.getItem(k) || '';
          out.push({ key: k.slice(pre.length), real: k, size: (k.length + v.length) * 2 });
        }
      }
    } catch (e) { /* ignore */ }
    return out.sort(function (a, b) { return a.key.localeCompare(b.key); });
  };
  D.gameDatabases = async function (id) {
    if (!indexedDB.databases) return [];
    var pre = 'gs2:idb:' + id + ':';
    try {
      var list = await indexedDB.databases();
      return list.filter(function (d) { return d.name && d.name.indexOf(pre) === 0; }).map(function (d) { return d.name; });
    } catch (e) { return []; }
  };
  D.wipeSaves = async function (id, includeResume) {
    D.storageKeys(id).forEach(function (k) { try { localStorage.removeItem(k.real); } catch (e) { /* ignore */ } });
    try {
      var sp = 'gs2:ss:' + id + ':';
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var sk = sessionStorage.key(i);
        if (sk && sk.indexOf(sp) === 0) sessionStorage.removeItem(sk);
      }
    } catch (e) { /* ignore */ }
    var dbs = await D.gameDatabases(id);
    dbs.forEach(function (n) { try { indexedDB.deleteDatabase(n); } catch (e) { /* ignore */ } });
    if (includeResume !== false) await D.deleteSave(id);
  };
  D.exportSaves = async function (id) {
    var g = D.get(id);
    var ls = {};
    D.storageKeys(id).forEach(function (k) { ls[k.key] = localStorage.getItem(k.real); });
    var save = await D.latestSave(id);
    return {
      gs2saves: 1,
      game: g ? g.name : id,
      id: id,
      exported: Date.now(),
      resume: save ? { data: save.data, t: save.t } : null,
      localStorage: ls
    };
  };
  D.importSaves = async function (id, obj) {
    if (!obj || obj.gs2saves !== 1) throw new Error('That file is not a Game System save file.');
    var pre = 'gs2:ls:' + id + ':';
    var ls = obj.localStorage || {};
    Object.keys(ls).forEach(function (k) { localStorage.setItem(pre + k, String(ls[k])); });
    if (obj.resume && obj.resume.data != null) await D.putSave(id, obj.resume.data, Date.now());
  };

  /* ---------------- play time ---------------- */
  D.addPlayTime = function (id, ms, quiet) {
    if (!ms || ms < 0) return;
    D.pendingPlay[id] = (D.pendingPlay[id] || 0) + ms;
    if (!quiet) D.flushPlaySoon();
  };
  /* write play time at most every 15 seconds while playing */
  var flushTimer = null;
  D.flushPlaySoon = function () {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; D.flushPlay(); }, 15000);
  };
  D.flushPlay = async function () {
    var pend = D.pendingPlay;
    D.pendingPlay = {};
    var ids = Object.keys(pend);
    if (!ids.length) return;
    var day = U.dayKey();
    D.days[day] = D.days[day] || {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var ms = pend[id];
      D.days[day][id] = (D.days[day][id] || 0) + ms;
      var g = D.games.get(id);
      if (g) {
        g = Object.assign({}, g, { playTime: (g.playTime || 0) + ms });
        D.games.set(id, g);
        await GS2DB.put('games', g);
      }
    }
    /* keep ~120 days of history */
    var keys = Object.keys(D.days).sort();
    while (keys.length > 120) delete D.days[keys.shift()];
    await GS2DB.kvSet('days', D.days);
    D.emit('stats');
  };

  /* ---------------- settings + UI state ---------------- */
  D.saveSettings = function () {
    U.lsSet('gs2:settings', D.settings);
    GS2DB.kvSet('settings', D.settings).catch(function () {});
    D.emit('settings');
  };
  D.saveUI = function () {
    D.ui.t = Date.now();
    U.lsSet('gs2:ui', D.ui);
  };
  D.saveUISoon = U.debounce(D.saveUI, 400);

  /* When the tab closes: save UI + play time right now (localStorage is instant) */
  D.onPageHide = function () {
    D.saveUI();
    var pend = Object.assign({}, D.pendingPlay);
    if (Object.keys(pend).length) U.lsSet('gs2:ptPending', pend);
  };
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { try { localStorage.removeItem('gs2:ptPending'); } catch (err) { /* ignore */ } }
  });

  /* ---------------- games that live on the website (games/games.json) ---------------- */
  D.syncSiteGames = async function () {
    var manifest;
    try {
      var r = await fetch('games/games.json', { cache: 'no-cache' });
      if (!r.ok) return 0;
      manifest = await r.json();
    } catch (e) { return 0; }
    if (!manifest || !Array.isArray(manifest.games)) return 0;
    var tomb = (await GS2DB.kvGet('tombstones')) || {};
    var changed = 0;
    for (var i = 0; i < manifest.games.length; i++) {
      var sg = manifest.games[i];
      if (!sg || typeof sg.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(sg.id)) continue;
      var rev = Number(sg.rev) || 1;
      if (tomb[sg.id] && tomb[sg.id] >= rev) continue;
      var cur = D.games.get(sg.id);
      var isLink = typeof sg.url === 'string' && /^https?:\/\//i.test(sg.url);
      if (cur && cur.source !== 'site' && !(cur.fromSite && cur.source === 'link')) continue;
      if (cur && (cur.siteRev || 0) >= rev) continue;
      var files = !isLink && Array.isArray(sg.files) ? sg.files.filter(function (p) { return typeof p === 'string'; }) : [];
      var rec = normalize(Object.assign({}, cur || {}, {
        id: sg.id,
        name: String(sg.name || U.prettyName(sg.id)).slice(0, 80),
        desc: String(sg.desc || '').slice(0, 600),
        emoji: sg.emoji || U.guessEmoji(sg.name || sg.id),
        color: /^#[0-9a-f]{6}$/i.test(sg.color || '') ? sg.color : U.colorFor(sg.name || sg.id),
        folder: cur ? cur.folder : String(sg.folder || '').slice(0, 40),
        entry: isLink ? '' : (sg.entry || 'index.html'),
        source: isLink ? 'link' : 'site',
        url: isLink ? sg.url : undefined,
        fromSite: true,
        siteRev: rev,
        siteFiles: files,
        size: Number(sg.size) || 0,
        fileCount: files.length,
        isolate: sg.isolate !== false,
        created: cur ? cur.created : Date.now(),
        updated: Date.now()
      }));
      if (sg.cover) {
        try {
          var cr = await fetch('games/' + encodeURIComponent(sg.id) + '/' + String(sg.cover).split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' });
          if (cr.ok) rec.cover = await cr.blob();
        } catch (e) { /* no cover */ }
      }
      await GS2DB.saveGame(rec, cur ? [] : null);
      D.games.set(rec.id, rec);
      changed++;
    }
    if (changed) D.emit('games');
    return changed;
  };

  /* Download every file of a website game into the browser (needed before editing/backup/offline) */
  D.ensureLocalFiles = async function (g, onProgress) {
    if (!g || g.source !== 'site') return;
    var have = await GS2DB.fileKeys(g.id);
    var need = (g.siteFiles || []).filter(function (p) { return have.indexOf(p) < 0; });
    for (var i = 0; i < need.length; i++) {
      var p = need[i];
      var r = await fetch('games/' + encodeURIComponent(g.id) + '/' + p.split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' });
      if (!r.ok) throw new Error('Could not download "' + p + '" for ' + g.name + ' (are you offline?)');
      await GS2DB.putFile(g.id, p, await r.blob(), U.mimeOf(p));
      if (onProgress) onProgress(i + 1, need.length);
    }
  };

  D.prefetchSiteGames = async function () {
    if (navigator.connection && navigator.connection.saveData) return;
    var list = D.list().filter(function (g) { return g.source === 'site'; });
    for (var i = 0; i < list.length; i++) {
      try { await D.ensureLocalFiles(list[i]); } catch (e) { return; }
    }
  };

  window.D = D;
})();
