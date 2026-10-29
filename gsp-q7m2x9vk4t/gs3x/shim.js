/* Runs first inside every game on the phone (the service worker adds it): the game's own saves (kept apart from
   other games), the GameSystem save API games know from the PC, the console look for the kit, a small home button. */
(function () {
  'use strict';
  var G = window.__gs3g;
  if (!G || window.GameSystem && window.GameSystem.gs3) return;
  var ID = G.id;

  /* ---------- saves: localStorage + IndexedDB of this game only ---------- */
  var data = Object.assign({}, G.saves || {});
  /* Game System 3's own database (kept before the game's databases get their own names below) */
  var realOpen = indexedDB.open.bind(indexedDB);
  function idb() {
    return new Promise(function (res, rej) {
      var r = realOpen('gs3phone', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); r.result.createObjectStore('saves'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function putKV(store, k, v) { return idb().then(function (d) { return new Promise(function (res) { var t = d.transaction(store, 'readwrite'); t.objectStore(store).put(v, k); t.oncomplete = res; t.onerror = res; }); }).catch(function () {}); }
  var timer = null;
  function flush() { clearTimeout(timer); timer = null; return putKV('saves', ID, data); }
  function later() { if (!timer) timer = setTimeout(flush, 400); }
  var store = {
    getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[String(k)] = String(v); later(); },
    removeItem: function (k) { delete data[String(k)]; later(); },
    clear: function () { data = {}; later(); },
    key: function (i) { var ks = Object.keys(data); return i >= 0 && i < ks.length ? ks[i] : null; }
  };
  var proxy = new Proxy(store, {
    get: function (t, p) { if (p === 'length') return Object.keys(data).length; if (p in t) return t[p]; return typeof p === 'string' && Object.prototype.hasOwnProperty.call(data, p) ? data[p] : undefined; },
    set: function (t, p, v) { if (p in t) return false; data[String(p)] = String(v); later(); return true; },
    deleteProperty: function (t, p) { delete data[String(p)]; later(); return true; },
    has: function (t, p) { return p in t || Object.prototype.hasOwnProperty.call(data, p); },
    ownKeys: function () { return Object.keys(data); },
    getOwnPropertyDescriptor: function (t, p) { return Object.prototype.hasOwnProperty.call(data, p) ? { value: data[p], writable: true, enumerable: true, configurable: true } : undefined; }
  });
  try { Object.defineProperty(window, 'localStorage', { value: proxy, configurable: true }); } catch (e) { /* keep the real one */ }
  /* IndexedDB: the game's databases get its own name in front, so two games never mix their data */
  try {
    var real = window.indexedDB, pre = 'g:' + ID + ':';
    var open = real.open.bind(real), delDb = real.deleteDatabase.bind(real), list = real.databases ? real.databases.bind(real) : null;
    real.open = function (name, v) { return v === undefined ? open(pre + name) : open(pre + name, v); };
    real.deleteDatabase = function (name) { return delDb(pre + name); };
    if (list) real.databases = function () { return list().then(function (a) { return a.filter(function (d) { return d.name.indexOf(pre) === 0; }).map(function (d) { return { name: d.name.slice(pre.length), version: d.version }; }); }); };
  } catch (e) { /* fine */ }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { flush(); beat(); } });

  /* ---------- play time: a heartbeat the app adds up next time it opens ---------- */
  function beat() { putKV('kv', 'playing', { id: ID, start: G.start || Date.now(), last: Date.now() }); }
  setInterval(beat, 20000);

  /* ---------- the GameSystem API (same as on the PC) ---------- */
  var KEY = 'gs3save', getState = null, pauseFns = [], resumeFns = [];
  function write() { if (getState) { try { store.setItem(KEY, JSON.stringify(getState())); } catch (e) { /* bad state */ } } }
  function goHome() { write(); flush().then(function () { beat(); location.href = G.home; }); }
  var api = {
    gs3: true, inSystem: true, phone: true, console: G.console,
    load: function () { try { var s = store.getItem(KEY); return s == null ? null : JSON.parse(s); } catch (e) { return null; } },
    hasSave: function () { return store.getItem(KEY) !== null; },
    save: function (s) { try { store.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } },
    autoSave: function (fn, sec) { getState = fn; setInterval(write, Math.max(1, sec || 5) * 1000); return api; },
    saveNow: write,
    clear: function () { store.removeItem(KEY); },
    onPause: function (f) { if (typeof f === 'function') pauseFns.push(f); },
    onResume: function (f) { if (typeof f === 'function') resumeFns.push(f); },
    toast: function () {},
    quit: goHome,
    offerPicture: function () { return false; }
  };
  window.GameSystem = api;
  window.close = goHome;
  document.addEventListener('visibilitychange', function () { (document.hidden ? pauseFns : resumeFns).forEach(function (f) { try { f(); } catch (e) { /* game error */ } }); });
  var mark = function () { document.documentElement.setAttribute('data-gs3-console', (G.console && (G.console.skin || G.console.style)) || ''); };
  mark();
  document.addEventListener('DOMContentLoaded', mark);

  /* ---------- a small home button in the corner (fades out of the way) ---------- */
  function addHome() {
    if (!document.body || document.getElementById('__gs3home')) return;
    var b = document.createElement('button');
    b.id = '__gs3home';
    b.setAttribute('aria-label', 'Back to Game System 3');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/></svg>';
    b.style.cssText = 'position:fixed;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:2147483647;width:40px;height:40px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;background:rgba(0,0,0,.45);opacity:.9;transition:opacity .4s;cursor:pointer;-webkit-tap-highlight-color:transparent';
    var dim = function () { b.style.opacity = '.28'; };
    var t = setTimeout(dim, 3500);
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (b.dataset.armed) { goHome(); return; }
      /* first tap wakes it up, second tap goes home (so a stray tap in a game doesn't quit it) */
      b.dataset.armed = '1'; b.style.opacity = '1'; b.style.background = 'rgba(255,255,255,.9)'; b.querySelector('svg').setAttribute('stroke', '#000');
      clearTimeout(t);
      t = setTimeout(function () { delete b.dataset.armed; b.style.background = 'rgba(0,0,0,.45)'; b.querySelector('svg').setAttribute('stroke', '#fff'); dim(); }, 2500);
    });
    document.body.appendChild(b);
  }
  if (document.body) addHome(); else document.addEventListener('DOMContentLoaded', addHome);
})();
