/* Game System 3 on the phone: what the PC app does for the screens (window.gs), done inside the phone's browser.
   Games, covers and the console sound pack live in Cache Storage (the service worker hands them out), the game
   list, settings and saves live in IndexedDB. Anything that only makes sense on a PC answers "not here". */
(function () {
  'use strict';
  var VERSION = '3.5.0';
  var DB = null;
  function db() {
    if (DB) return DB;
    DB = new Promise(function (res, rej) {
      var r = indexedDB.open('gs3phone', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('kv'); d.createObjectStore('saves'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return DB;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out;
        var q = fn(s);
        if (q) q.onsuccess = function () { out = q.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  var get = function (store, k) { return tx(store, 'readonly', function (s) { return s.get(k); }); };
  var put = function (store, k, v) { return tx(store, 'readwrite', function (s) { s.put(v, k); }); };
  var del = function (store, k) { return tx(store, 'readwrite', function (s) { s.delete(k); }); };

  var DEFAULTS = { quickResume: false, menuSounds: 0.7, homeMusic: true, homeMusicVolume: 0.35, bootSound: true, reduceMotion: false,
    textSize: 115, boldText: false, firstRun: true, homeStyle: 'gs3', homeBackground: 'style', buttonSounds: 'style', startupSound: 'style',
    gameStartSound: 'style', menuMusic: 'style', holidaysOff: [], lastVersion: '' };
  var listeners = {};
  function emit(ch, payload) { (listeners[ch] || []).slice().forEach(function (f) { try { f(payload); } catch (e) { console.error(e); } }); }

  function settings() { return get('kv', 'settings').then(function (s) { return Object.assign({}, DEFAULTS, s || {}); }); }
  function lib() { return get('kv', 'lib').then(function (l) { return l || { games: {}, layout: [], prefs: { sort: 'recent', hiddenOpen: false } }; }); }
  function saveLib(l) { return put('kv', 'lib', l); }

  /* a game as the screens want it (like the PC's gameOut) */
  function out(g) {
    var enc = function (p) { return String(p).split('/').map(encodeURIComponent).join('/'); };
    return {
      id: g.id, name: g.name, kind: g.kind || 'game', url: g.url || null, entry: g.entry || 'index.html', dir: null,
      added: g.added || 0, updated: g.updated || 0, lastPlayed: g.lastPlayed || 0, playTime: g.playTime || 0, launches: g.launches || 0,
      cover: g.coverAt ? 'covers/' + encodeURIComponent(g.id) + '.img?v=' + g.coverAt : null,
      coverClean: g.coverAt ? 'covers/' + encodeURIComponent(g.id) + '.img?v=' + g.coverAt : null,
      coverKind: 'phone', logo: g.logo || null,
      music: g.music && !g.url ? 'play/' + encodeURIComponent(g.id) + '/' + enc(g.music) : null,
      hidden: !!g.hidden, oldVersions: 0, tags: g.tags || [], boost: 'never'
    };
  }
  /* Layout: every game exactly once (same rule as the PC) */
  function reconcile(l) {
    var seen = {};
    l.layout = (l.layout || []).map(function (e) {
      if (typeof e === 'string') { if (!l.games[e] || seen[e]) return null; seen[e] = 1; return e; }
      if (!e || !Array.isArray(e.items)) return null;
      e.items = e.items.filter(function (x) { if (!l.games[x] || seen[x]) return false; seen[x] = 1; return true; });
      return e.items.length ? e : null;
    }).filter(Boolean);
    Object.keys(l.games).forEach(function (id) { if (!seen[id]) l.layout.push(id); });
    return l;
  }
  function changed() { emit('lib:changed'); }

  /* what's playing: the game page writes a heartbeat, the next start of the app adds the time */
  function closeSession() {
    return get('kv', 'playing').then(function (p) {
      if (!p || !p.id) return;
      return lib().then(function (l) {
        var g = l.games[p.id];
        if (g) {
          var ms = Math.max(0, Math.min((p.last || p.start) - p.start, 12 * 3600 * 1000));
          g.playTime = (g.playTime || 0) + ms;
          g.lastPlayed = Math.max(g.lastPlayed || 0, p.last || p.start);
        }
        return saveLib(l);
      }).then(function () { return del('kv', 'playing'); });
    });
  }

  var TAGS = ['3D', '2D', 'FNF', 'Shooter', 'Racing', 'Horror', 'Clicker', 'Sandbox', 'Platformer', 'Puzzle', 'Rhythm', 'Multiplayer', 'Retro', 'Cute'];
  var NOT_HERE = { ok: false, error: 'That only works on the PC.' };

  var H = {
    'app:info': function () { return { version: VERSION, now: null, root: '', games: '', captures: '', backups: '', platform: 'phone', startup: false, packaged: true }; },
    'app:whatsnew': function () { return { last: '', now: VERSION }; },
    'settings:get': settings,
    'settings:set': function (patch) {
      return settings().then(function (s) {
        Object.assign(s, patch || {});
        return put('kv', 'settings', s).then(function () { emit('settings:changed', s); return s; });
      });
    },
    'lib:list': function () {
      return lib().then(function (l) {
        reconcile(l);
        return { games: Object.keys(l.games).map(function (id) { return out(l.games[id]); }), layout: l.layout, prefs: l.prefs || { sort: 'recent' }, missing: [] };
      });
    },
    'lib:get': function (id) { return lib().then(function (l) { return l.games[id] ? out(l.games[id]) : null; }); },
    'lib:layout': function (layout) { return lib().then(function (l) { l.layout = layout; reconcile(l); return saveLib(l); }).then(function () { changed(); return true; }); },
    'lib:prefs': function (p) { return lib().then(function (l) { l.prefs = Object.assign(l.prefs || {}, p || {}); return saveLib(l); }).then(function () { return true; }); },
    'lib:rename': function (id, name) { return lib().then(function (l) { if (l.games[id]) l.games[id].name = String(name).slice(0, 80); return saveLib(l); }).then(function () { changed(); return true; }); },
    'lib:hide': function (id, on) { return lib().then(function (l) { if (l.games[id]) l.games[id].hidden = !!on; return saveLib(l); }).then(function () { changed(); return true; }); },
    'lib:tag': function (id, tag, on) {
      var tags = null;
      return lib().then(function (l) {
        var g = l.games[id];
        if (!g || TAGS.indexOf(tag) < 0) return;
        g.tags = (g.tags || []).filter(function (t) { return t !== tag; });
        if (on) g.tags.push(tag);
        tags = g.tags;
        return saveLib(l);
      }).then(function () { changed(); return tags; });
    },
    'lib:tagnames': function () { return TAGS; },
    'lib:remove': function (id, withSaves) {
      return lib().then(function (l) {
        delete l.games[id];
        reconcile(l);
        return saveLib(l);
      }).then(function () { return GS3Files.removeGame(id); })
        .then(function () { return withSaves ? del('saves', id) : null; })
        .then(function () { changed(); return { ok: true }; });
    },
    'games:state': function () { return { active: null, running: [] }; },
    'games:launch': function (id) {
      return lib().then(function (l) {
        var g = l.games[id];
        if (!g) return { ok: false, error: 'missing' };
        g.launches = (g.launches || 0) + 1;
        g.lastPlayed = Date.now();
        return saveLib(l).then(function () {
          if (g.url) { location.href = g.url; return { ok: true }; }
          return put('kv', 'playing', { id: id, start: Date.now(), last: Date.now() }).then(function () {
            location.href = 'play/' + encodeURIComponent(id) + '/' + String(g.entry || 'index.html').split('/').map(encodeURIComponent).join('/');
            return { ok: true };
          });
        });
      });
    },
    'games:home': function () { return true; },
    'games:close': function () { return true; },
    'games:crashes': function () { return []; },
    'saves:info': function (id) { return get('saves', id).then(function (s) { var n = s ? JSON.stringify(s).length : 0; return { size: n, changed: 0, backups: [] }; }); },
    'saves:all': function () { return lib().then(function (l) { return Promise.all(Object.keys(l.games).map(function (id) { return get('saves', id).then(function (s) { return { id: id, size: s ? JSON.stringify(s).length : 0 }; }); })); }); },
    'saves:remove': function (id) { return del('saves', id).then(function () { return { ok: true }; }); },
    'music:list': function () { return []; },
    'booster:memory': function () { return { always: [], never: [] }; },
    'storage:drives': function () { return []; },
    'storage:gs3': function () { return { inOneDrive: false }; },
    'overlay:toast': function () { return true; },
    'win:fullscreen': function () {
      if (document.fullscreenElement) return document.exitFullscreen().then(function () { return true; }, function () { return false; });
      return document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(function () {
        try { var o = screen.orientation.lock('landscape'); if (o && o.catch) o.catch(function () {}); } catch (e) { /* fine */ }
        return true;
      }, function () { return false; });
    },
    /* Add to home screen: opens like an app, and Chrome never clears an installed app's games to free up space */
    'win:install': function () {
      if (!installEv) return false;
      var ev = installEv;
      ev.prompt();
      return ev.userChoice.then(function (c) { installEv = null; return !!(c && c.outcome === 'accepted'); }, function () { return false; });
    },
    'power:restart': function () { location.reload(); return true; },
    'shell:open': function () { return true; }
  };

  var installEv = null;
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEv = e; dispatchEvent(new Event('gs3:installable')); });
  addEventListener('appinstalled', function () { installEv = null; try { navigator.storage.persist().catch(function () {}); } catch (e) { /* fine */ } });

  window.gs = {
    platform: 'phone',
    canInstall: function () { return !!installEv; },
    invoke: function (ch) {
      var args = Array.prototype.slice.call(arguments, 1);
      var fn = H[ch];
      if (!fn) return Promise.resolve(NOT_HERE);
      try { return Promise.resolve(fn.apply(null, args)); } catch (e) { return Promise.reject(e); }
    },
    send: function () {},
    on: function (ch, fn) {
      (listeners[ch] = listeners[ch] || []).push(fn);
      return function () { var a = listeners[ch] || []; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
    },
    pathOf: function () { return ''; }
  };

  /* shared with receive.js + the game pages */
  window.GS3Phone = { db: db, get: get, put: put, del: del, lib: lib, saveLib: saveLib, settings: settings, reconcile: reconcile, emit: emit, version: VERSION };
  window.GS3Files = {
    removeGame: function (id) {
      if (!window.caches) return Promise.resolve();
      return caches.open('gs3-games').then(function (c) {
        return c.keys().then(function (keys) {
          var pre = new URL('play/' + encodeURIComponent(id) + '/', location.href).href;
          return Promise.all(keys.filter(function (k) { return k.url.indexOf(pre) === 0; }).map(function (k) { return c.delete(k); }));
        });
      }).then(function () { return caches.open('gs3-covers'); }).then(function (c) { return c.delete(new URL('covers/' + encodeURIComponent(id) + '.img', location.href).href, { ignoreSearch: true }); });
    }
  };
  closeSession().catch(function () {});

  /* the app works offline and serves the games: the service worker */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('sw', e); });
  document.documentElement.classList.add('phone');
})();
