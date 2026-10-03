/* AI Play - shared helpers + saving stuff in the browser (IndexedDB + localStorage). */
'use strict';
window.AIP = window.AIP || {};

AIP.util = (function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => {
    if (n == null || !isFinite(n)) return '-';
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return Math.round(n * 10) / 10 + '';
  };
  // A random number from a bell-ish curve between 0 and 1 (most AIs are "normal", a few are extreme).
  const bell = () => clamp((Math.random() + Math.random() + Math.random()) / 3 + rand(-0.12, 0.12), 0.02, 0.98);
  const stripEmoji = (s) => String(s).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\s+/g, ' ').trim();
  const timeAgo = (t) => {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' days ago';
  };
  // Seeded random (so a brain's "random eyes" stay the same every time it loads).
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  return { clamp, lerp, rand, randi, pick, chance, uid, sleep, esc, fmt, bell, stripEmoji, timeAgo, seeded, hashStr };
})();

/* ---------------- IndexedDB (big stuff: games, AIs, brains, diary) ---------------- */
AIP.db = (function () {
  const NAME = 'ai-play';
  const VERSION = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(NAME, VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('games')) db.createObjectStore('games', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('ais')) db.createObjectStore('ais', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('brains')) db.createObjectStore('brains', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('replays')) db.createObjectStore('replays', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('diary')) {
          const s = db.createObjectStore('diary', { keyPath: 'id' });
          s.createIndex('aiId', 'aiId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  function run(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const s = tx.objectStore(store);
      let out;
      const r = fn(s);
      if (r) r.onsuccess = () => { out = r.result; };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }
  return {
    open,
    get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
    put: (store, val) => run(store, 'readwrite', (s) => s.put(val)),
    del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
    all: (store) => run(store, 'readonly', (s) => s.getAll()),
    byIndex: (store, index, key) => run(store, 'readonly', (s) => s.index(index).getAll(key)),
    // Deletes every record whose key starts with a prefix (like all brains of one AI).
    delPrefix: (store, prefix) => open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (String(c.key).indexOf(prefix) === 0) c.delete();
        c.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    })),
  };
})();

/* ---------------- Settings (YOUR stuff only - never the AI's mind) ---------------- */
AIP.settings = (function () {
  const KEY = 'aiplay.settings.v1';
  const defaults = { painMode: false, voice: true, volume: 0.8, layout: 'side' };
  let cur = Object.assign({}, defaults);
  try { const raw = localStorage.getItem(KEY); if (raw) cur = Object.assign(cur, JSON.parse(raw)); } catch (e) { /* storage blocked - defaults are fine */ }
  const subs = [];
  return {
    get: () => cur,
    set(k, v) {
      cur[k] = v;
      try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* ignore */ }
      subs.forEach((f) => f(k, v));
    },
    on: (f) => subs.push(f),
  };
})();
