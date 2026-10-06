/* Game System 2.0 — Game Kit
   This runs at the very top of every game page (Game System 2.0 adds it automatically).
   It gives the game:
     - window.GameSystem  → the Save Kit (load / save / autoSave) so games resume where you left off
     - its own private localStorage / sessionStorage / IndexedDB (games can't mess up each other's saves)
     - error + console reporting to the Game System (so you can see what's broken)
     - the quick menu hotkey and the screenshot-to-cover button */
(function gs2Kit() {
  'use strict';
  if (!window.__GS2_BOOT) {
    /* Loaded by the Game System app itself (not inside a game): just keep a copy of this code,
       so games can still get the kit when the app is opened straight from a file. */
    window.__GS2_KIT_SRC = '(' + gs2Kit.toString() + ')();';
    return;
  }
  if (window.__GS2_KIT_LOADED) return;
  window.__GS2_KIT_LOADED = true;

  var BOOT = window.__GS2_BOOT;
  var gameId = BOOT.id || null;
  var isolate = !!gameId && BOOT.isolate !== false;

  /* ---------- find the Game System window that is running us ---------- */
  var host = null;
  var directChild = false;
  try {
    var w = window;
    for (var depth = 0; depth < 6 && w !== w.parent; depth++) {
      w = w.parent;
      if (w.__GS2_HOST) { host = w.__GS2_HOST; directChild = depth === 0; break; }
    }
  } catch (e) { host = null; }

  function call(name) {
    if (!host || typeof host[name] !== 'function') return undefined;
    var args = [gameId];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    try { return host[name].apply(host, args); } catch (e) { return undefined; }
  }

  /* ---------- private storage per game ---------- */
  function memoryStorage() {
    var m = new Map();
    return {
      getItem: function (k) { k = String(k); return m.has(k) ? m.get(k) : null; },
      setItem: function (k, v) { m.set(String(k), String(v)); },
      removeItem: function (k) { m.delete(String(k)); },
      key: function (i) { var ks = Array.from(m.keys()); return i < ks.length ? ks[i] : null; },
      clear: function () { m.clear(); },
      get length() { return m.size; }
    };
  }

  function probe(name) {
    try {
      var s = window[name];
      s.getItem('__gs2_probe__');
      return s;
    } catch (e) { return null; }
  }
  var realLS = probe('localStorage');
  var realSS = probe('sessionStorage');
  var storageBroken = !realLS;

  function makeStorage(real, prefix) {
    function keys() {
      var out = [];
      for (var i = 0; i < real.length; i++) {
        var k = real.key(i);
        if (k != null && k.indexOf(prefix) === 0) out.push(k.slice(prefix.length));
      }
      return out;
    }
    var api = {
      getItem: function (k) { return real.getItem(prefix + String(k)); },
      setItem: function (k, v) {
        try { real.setItem(prefix + String(k), String(v)); }
        catch (err) {
          call('log', 'error', 'Storage is full! The game could not save "' + String(k) + '". Clear some saves in Game System → Saves.', { kind: 'storage' });
          throw err;
        }
      },
      removeItem: function (k) { real.removeItem(prefix + String(k)); },
      clear: function () { keys().forEach(function (k) { real.removeItem(prefix + k); }); },
      key: function (i) { var ks = keys(); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    return new Proxy({}, {
      get: function (t, p) {
        if (p === 'length') return keys().length;
        if (typeof p === 'symbol') return p === Symbol.toStringTag ? 'Storage' : undefined;
        if (Object.prototype.hasOwnProperty.call(api, p)) return api[p];
        if (p === 'toString' || p === 'valueOf' || p === 'constructor' || p === 'hasOwnProperty') return Object.prototype[p];
        var v = real.getItem(prefix + p);
        return v === null ? undefined : v;
      },
      set: function (t, p, v) {
        if (typeof p === 'symbol' || Object.prototype.hasOwnProperty.call(api, p) || p === 'length') return true;
        api.setItem(p, v);
        return true;
      },
      has: function (t, p) {
        if (typeof p === 'symbol') return false;
        return Object.prototype.hasOwnProperty.call(api, p) || p === 'length' || real.getItem(prefix + p) !== null;
      },
      deleteProperty: function (t, p) { if (typeof p !== 'symbol') real.removeItem(prefix + p); return true; },
      ownKeys: function () { return keys(); },
      getOwnPropertyDescriptor: function (t, p) {
        if (typeof p === 'symbol') return undefined;
        var v = real.getItem(prefix + p);
        if (v === null) return undefined;
        return { value: v, writable: true, enumerable: true, configurable: true };
      }
    });
  }

  function replaceGlobal(name, value) {
    try {
      Object.defineProperty(window, name, { configurable: true, enumerable: true, get: function () { return value; } });
      return true;
    } catch (e) { return false; }
  }

  var lsBase = realLS || memoryStorage();
  var ssBase = realSS || memoryStorage();
  if (isolate) {
    replaceGlobal('localStorage', makeStorage(lsBase, 'gs2:ls:' + gameId + ':'));
    replaceGlobal('sessionStorage', makeStorage(ssBase, 'gs2:ss:' + gameId + ':'));
  } else {
    if (!realLS) replaceGlobal('localStorage', lsBase);
    if (!realSS) replaceGlobal('sessionStorage', ssBase);
  }

  var realIDB = null;
  try { realIDB = window.indexedDB; } catch (e) { realIDB = null; }
  if (isolate && realIDB) {
    var IDBP = 'gs2:idb:' + gameId + ':';
    var origOpen = realIDB.open;
    var origDelete = realIDB.deleteDatabase;
    var origDatabases = realIDB.databases;
    try {
      realIDB.open = function (name, version) {
        return arguments.length > 1 && version !== undefined
          ? origOpen.call(realIDB, IDBP + name, version)
          : origOpen.call(realIDB, IDBP + name);
      };
      realIDB.deleteDatabase = function (name) { return origDelete.call(realIDB, IDBP + name); };
      if (origDatabases) {
        realIDB.databases = function () {
          return origDatabases.call(realIDB).then(function (list) {
            return list.filter(function (d) { return d.name && d.name.indexOf(IDBP) === 0; })
              .map(function (d) { return { name: d.name.slice(IDBP.length), version: d.version }; });
          });
        };
      }
    } catch (e) { /* leave IndexedDB as is */ }
  }

  /* ---------- paths (for nicer error messages) ---------- */
  var playBase = '';
  var m = /^(.*?\/play\/[^\/]+\/)/.exec(location.pathname);
  if (m) playBase = m[1];
  function relPath(url) {
    if (!url) return '';
    try {
      var u = new URL(url, location.href);
      if (u.protocol === 'blob:' || u.href === 'about:srcdoc') return BOOT.entry || 'index.html';
      if (u.protocol === 'data:') return '(a file inside the game)';
      if (u.origin === location.origin && playBase && u.pathname.indexOf(playBase) === 0) {
        return decodeURIComponent(u.pathname.slice(playBase.length));
      }
      return u.href;
    } catch (e) { return String(url); }
  }

  /* ---------- console + errors ---------- */
  function fmt(v) {
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
    if (typeof v === 'bigint') return v + 'n';
    if (typeof v !== 'object') return String(v);
    if (v instanceof Error) return (v.name || 'Error') + ': ' + v.message;
    if (v.nodeType === 1) return '<' + String(v.tagName).toLowerCase() + (v.id ? '#' + v.id : '') + '>';
    try {
      var seen = [];
      var s = JSON.stringify(v, function (k, x) {
        if (typeof x === 'object' && x !== null) {
          if (seen.indexOf(x) >= 0) return '[circular]';
          seen.push(x);
          if (seen.length > 300) return '…';
        }
        if (typeof x === 'function') return 'ƒ';
        if (typeof x === 'bigint') return x + 'n';
        return x;
      });
      if (s === undefined) s = Object.prototype.toString.call(v);
      return s.length > 2000 ? s.slice(0, 2000) + '…' : s;
    } catch (e) { return Object.prototype.toString.call(v); }
  }
  function fmtArgs(args) {
    var list = Array.prototype.slice.call(args);
    if (typeof list[0] === 'string' && list[0].indexOf('%c') >= 0) {
      var n = (list[0].match(/%c/g) || []).length;
      list[0] = list[0].replace(/%c/g, '');
      list.splice(1, n);
    }
    var s = list.map(fmt).join(' ');
    return s.length > 4000 ? s.slice(0, 4000) + '…' : s;
  }

  var budget = 0, budgetStart = 0, dropped = 0;
  function log(level, text, meta) {
    if (!host) return;
    var now = Date.now();
    if (now - budgetStart > 1000) {
      if (dropped) call('log', 'warn', '(' + dropped + ' more messages were hidden because the game is printing too fast)', { kind: 'console' });
      budgetStart = now; budget = 0; dropped = 0;
    }
    if (++budget > 80 && level !== 'error') { dropped++; return; }
    call('log', level, text, meta || { kind: 'console' });
  }

  if (host) {
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (lvl) {
      var orig = console[lvl];
      if (typeof orig !== 'function') return;
      console[lvl] = function () {
        try { log(lvl === 'debug' ? 'log' : lvl, fmtArgs(arguments)); } catch (e) { /* never break the game */ }
        return orig.apply(console, arguments);
      };
    });

    window.addEventListener('error', function (e) {
      try {
        if (typeof ErrorEvent !== 'undefined' && e instanceof ErrorEvent) {
          var msg = e.message || 'Unknown error';
          if (/^Script error\.?$/.test(msg) && !e.filename) {
            msg = 'A script from another website crashed (the browser hides the details for scripts from other sites).';
          }
          log('error', msg, {
            kind: 'error',
            file: relPath(e.filename),
            line: e.lineno || 0,
            col: e.colno || 0,
            stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 4000) : ''
          });
        } else {
          var t = e.target;
          if (t && t !== window && t.tagName) {
            var url = t.currentSrc || t.src || t.href || '';
            if (url) {
              log('warn', 'Could not load ' + String(t.tagName).toLowerCase() + ' file: ' + relPath(url), { kind: 'resource', file: relPath(url) });
            }
          }
        }
      } catch (err) { /* ignore */ }
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
      try {
        var r = e.reason;
        var msg = r instanceof Error ? (r.name + ': ' + r.message) : fmt(r);
        log('error', 'Uncaught (in promise) ' + msg, { kind: 'error', stack: r && r.stack ? String(r.stack).slice(0, 4000) : '' });
      } catch (err) { /* ignore */ }
    });
  }

  /* ---------- Save Kit ---------- */
  var EMERG = 'gs2:emerg:' + gameId;
  var resume = BOOT.resume && BOOT.resume.data != null ? BOOT.resume : null;
  if (gameId && realLS) {
    try {
      var em = JSON.parse(realLS.getItem(EMERG) || 'null');
      if (em && em.data != null && (!resume || em.t > resume.t)) resume = em;
    } catch (e) { /* ignore */ }
  }

  var getter = null;
  var autoTimer = null;
  var autoSec = Math.max(1, Number(BOOT.autosave) || 5);
  var lastJson = resume ? resume.data : null;
  var pauseFns = [];
  var resumeFns = [];

  function persist(json, kind) {
    var t = Date.now();
    lastJson = json;
    if (host) call('save', json, t, kind);
    else writeEmergency(json, t);
    return t;
  }
  function writeEmergency(json, t) {
    if (!gameId || !realLS || json == null || json.length > 1500000) return;
    try { realLS.setItem(EMERG, JSON.stringify({ data: json, t: t || Date.now() })); } catch (e) { /* full */ }
  }
  /* reason: 'auto' (the timer: a slightly old state is OK), or 'manual' / 'exit' / 'flush' (must be up to date) */
  function snapshot(reason) {
    if (!getter) return null;
    var s;
    try { s = getter(reason || 'flush'); } catch (e) {
      log('error', 'Save Kit: your autoSave() function crashed: ' + (e && e.message), { kind: 'error', stack: e && e.stack ? String(e.stack) : '' });
      return null;
    }
    if (s === undefined) return null;
    try { return JSON.stringify(s); } catch (e) {
      log('error', 'Save Kit: could not save the game state (' + (e && e.message) + '). Only save plain data like numbers, text, arrays and objects.', { kind: 'error' });
      return null;
    }
  }
  function tick(kind) {
    var json = snapshot(kind || 'auto');
    if (json != null && json !== lastJson) persist(json, kind || 'auto');
  }

  function onHide() {
    if (!getter) return;
    var json = snapshot('exit');
    if (json == null) json = lastJson;
    if (json == null) return;
    if (json !== lastJson) persist(json, 'exit');
    writeEmergency(json, Date.now());
  }
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onHide();
  });
  document.addEventListener('freeze', onHide);

  var GameSystem = {
    __real: true,
    version: '2.0',
    inSystem: !!host,
    gameId: gameId,
    name: BOOT.name || '',

    /* Returns your saved state (whatever you saved last), or null if there is none. */
    load: function () {
      if (!resume || resume.data == null) return null;
      try { return JSON.parse(resume.data); } catch (e) { return null; }
    },
    hasSave: function () { return !!(resume && resume.data != null); },

    /* Save right now. state = any plain data (numbers, text, arrays, objects). */
    save: function (state) {
      var json;
      try { json = JSON.stringify(state); } catch (e) {
        log('error', 'Save Kit: could not save (' + (e && e.message) + ')', { kind: 'error' });
        return false;
      }
      if (json === undefined) return false;
      resume = { data: json, t: Date.now() };
      persist(json, 'manual');
      return true;
    },

    /* Give the kit a function that returns your game state. It gets saved every few seconds,
       when you switch tabs, when you open the quick menu, and when the game closes. */
    autoSave: function (getState, seconds) {
      if (typeof getState !== 'function') throw new TypeError('GameSystem.autoSave needs a function that returns your game state');
      getter = getState;
      if (seconds) autoSec = Math.max(1, Number(seconds) || 5);
      clearInterval(autoTimer);
      autoTimer = setInterval(function () { tick('auto'); }, autoSec * 1000);
      call('kitInfo', { autosave: true });
      return GameSystem;
    },
    saveNow: function () { tick('manual'); },

    /* Delete the save (e.g. on game over / new game). */
    clear: function () {
      resume = null;
      lastJson = null;
      call('clearSave');
      try { if (realLS) realLS.removeItem(EMERG); } catch (e) { /* ignore */ }
    },

    onPause: function (fn) { if (typeof fn === 'function') pauseFns.push(fn); },
    onResume: function (fn) { if (typeof fn === 'function') resumeFns.push(fn); },
    toast: function (msg) { call('toast', String(msg)); },
    quit: function () { onHide(); call('quit'); },
    /* Offer a picture (a data: URL from canvas.toDataURL) to use as the picture of a game or app.
       Game System asks the player which one. Returns false outside Game System. */
    offerPicture: function (dataUrl) { return call('picture', String(dataUrl || '')) === true; },

    /* ---- used by the Game System itself ---- */
    _flush: function () {
      var json = snapshot('flush');
      if (json != null) { lastJson = json; return json; }
      return null;
    },
    _pause: function () {
      try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* ignore */ }
      pauseFns.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
      try { window.dispatchEvent(new Event('gs2pause')); } catch (e) { /* ignore */ }
    },
    _resume: function () {
      resumeFns.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
      try { window.dispatchEvent(new Event('gs2resume')); } catch (e) { /* ignore */ }
    },
    _screenshot: function () {
      return new Promise(function (resolve) {
        var list = Array.prototype.slice.call(document.querySelectorAll('canvas')).filter(function (c) {
          return c.width > 32 && c.height > 32 && c.offsetParent !== null;
        });
        if (!list.length) return resolve(null);
        list.sort(function (a, b) { return b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight; });
        var c = list[0];
        requestAnimationFrame(function () {
          try {
            var s = Math.min(1, 720 / c.width);
            var out = document.createElement('canvas');
            out.width = Math.max(1, Math.round(c.width * s));
            out.height = Math.max(1, Math.round(c.height * s));
            var x = out.getContext('2d');
            x.fillStyle = '#000';
            x.fillRect(0, 0, out.width, out.height);
            x.drawImage(c, 0, 0, out.width, out.height);
            resolve(out.toDataURL('image/jpeg', 0.86));
          } catch (e) { resolve(null); }
        });
      });
    }
  };
  try {
    Object.defineProperty(window, 'GameSystem', { value: GameSystem, writable: true, configurable: true, enumerable: false });
  } catch (e) { window.GameSystem = GameSystem; }

  /* ---------- quick menu hotkey, top-edge reveal, links ---------- */
  if (host && directChild) {
    var hk = String(BOOT.hotkey || 'F2');
    var parts = hk.toLowerCase().split('+');
    var hkKey = parts.pop();
    var want = { ctrl: parts.indexOf('ctrl') >= 0, alt: parts.indexOf('alt') >= 0, shift: parts.indexOf('shift') >= 0 };
    window.addEventListener('keydown', function (e) {
      if (!e.key) return;
      if (e.key.toLowerCase() !== hkKey && String(e.code).toLowerCase() !== hkKey) return;
      if (e.ctrlKey !== want.ctrl || e.altKey !== want.alt || e.shiftKey !== want.shift) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      call('menu');
    }, true);

    var lastEdge = 0;
    window.addEventListener('mousemove', function (e) {
      if (e.clientY > 6 || document.pointerLockElement) return;
      var now = Date.now();
      if (now - lastEdge < 400) return;
      lastEdge = now;
      call('edge');
    }, true);

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      if (u.origin !== location.origin) {
        var tg = (a.getAttribute('target') || '').toLowerCase();
        if (!tg || tg === '_self' || tg === '_top' || tg === '_parent') {
          e.preventDefault();
          window.open(u.href, '_blank', 'noopener');
        }
        return;
      }
      if (playBase && u.pathname.indexOf(playBase) !== 0) {
        /* a "back to menu" link from an old game → go back to the Game System menu */
        e.preventDefault();
        GameSystem.quit();
      } else if (/^_(top|parent)$/i.test(a.getAttribute('target') || '')) {
        e.preventDefault();
        location.href = u.href;
      }
    });
  }

  if (storageBroken && host) {
    log('warn', 'This browser is blocking saving for this page, so progress is only kept until you close the game.', { kind: 'storage' });
  }
  call('ready', { url: location.href, kit: '2.0' });
})();
