/* Game System 2.0 — IndexedDB storage.
   Shared by the app (window) and the service worker (self), so no DOM in here.

   Stores:
     games  {id, name, ...}             one record per game
     files  {g, p, b, t}                game files: g = game id, p = path, b = Blob, t = mime type
     saves  {g, data, t, size}          Save Kit resume points (data is a JSON string)
     kv     {k, v}                      settings mirror, stats, misc */
(function (root) {
  'use strict';

  var NAME = 'gs2';
  var VERSION = 1;
  var dbPromise = null;

  function upgrade(db) {
    if (!db.objectStoreNames.contains('games')) db.createObjectStore('games', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('files')) {
      var files = db.createObjectStore('files', { keyPath: ['g', 'p'] });
      files.createIndex('g', 'g', { unique: false });
    }
    if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves', { keyPath: 'g' });
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try {
        req = indexedDB.open(NAME, VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = function () { upgrade(req.result); };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        db.onclose = function () { dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { dbPromise = null; reject(req.error); };
      req.onblocked = function () { /* another tab is upgrading; onsuccess fires when it is done */ };
    });
    return dbPromise;
  }

  function reqPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Transaction aborted')); };
    });
  }

  /* Run fn(tx) inside one transaction and wait for it to commit.
     fn may return a value (or a request whose result we want). */
  function run(stores, mode, fn) {
    return open().then(function (db) {
      var tx = db.transaction(stores, mode);
      var out;
      var ret = fn(tx);
      if (ret && typeof ret === 'object' && 'onsuccess' in ret && 'readyState' in ret) {
        ret.onsuccess = function () { out = ret.result; };
      } else {
        out = ret;
      }
      return txDone(tx).then(function () { return out; });
    });
  }

  function get(store, key) {
    return run([store], 'readonly', function (tx) { return tx.objectStore(store).get(key); });
  }
  function getAll(store) {
    return run([store], 'readonly', function (tx) { return tx.objectStore(store).getAll(); });
  }
  function put(store, value) {
    return run([store], 'readwrite', function (tx) { tx.objectStore(store).put(value); });
  }
  function del(store, key) {
    return run([store], 'readwrite', function (tx) { tx.objectStore(store).delete(key); });
  }

  /* ---------- files ---------- */

  function fileKeys(gameId) {
    return run(['files'], 'readonly', function (tx) {
      return tx.objectStore('files').index('g').getAllKeys(gameId);
    }).then(function (keys) { return (keys || []).map(function (k) { return k[1]; }); });
  }
  function filesOf(gameId) {
    return run(['files'], 'readonly', function (tx) {
      return tx.objectStore('files').index('g').getAll(gameId);
    });
  }
  function getFile(gameId, path) { return get('files', [gameId, path]); }

  function deleteFilesOf(gameId, tx) {
    var idx = tx.objectStore('files').index('g');
    var cursorReq = idx.openKeyCursor(IDBKeyRange.only(gameId));
    cursorReq.onsuccess = function () {
      var c = cursorReq.result;
      if (!c) return;
      tx.objectStore('files').delete(c.primaryKey);
      c.continue();
    };
  }

  /* Replace a game's record and (optionally) all of its files in one go.
     files: [{p, b, t}] or null to leave files untouched. */
  function saveGame(game, files) {
    return run(['games', 'files'], 'readwrite', function (tx) {
      tx.objectStore('games').put(game);
      if (files) {
        deleteFilesOf(game.id, tx);
        var fs = tx.objectStore('files');
        files.forEach(function (f) { fs.put({ g: game.id, p: f.p, b: f.b, t: f.t || '' }); });
      }
    });
  }

  function putFile(gameId, path, blob, type) {
    return put('files', { g: gameId, p: path, b: blob, t: type || '' });
  }
  function deleteFile(gameId, path) { return del('files', [gameId, path]); }

  function deleteGame(gameId) {
    return run(['games', 'files', 'saves'], 'readwrite', function (tx) {
      tx.objectStore('games').delete(gameId);
      tx.objectStore('saves').delete(gameId);
      deleteFilesOf(gameId, tx);
    });
  }

  /* ---------- kv ---------- */

  function kvGet(k) {
    return get('kv', k).then(function (r) { return r ? r.v : undefined; });
  }
  function kvSet(k, v) { return put('kv', { k: k, v: v }); }
  function kvDel(k) { return del('kv', k); }

  /* Wipe everything Game System 2.0 stores in IndexedDB. */
  function wipe() {
    return run(['games', 'files', 'saves', 'kv'], 'readwrite', function (tx) {
      ['games', 'files', 'saves', 'kv'].forEach(function (s) { tx.objectStore(s).clear(); });
    });
  }

  root.GS2DB = {
    NAME: NAME,
    VERSION: VERSION,
    open: open,
    run: run,
    reqPromise: reqPromise,
    get: get,
    getAll: getAll,
    put: put,
    del: del,
    fileKeys: fileKeys,
    filesOf: filesOf,
    getFile: getFile,
    putFile: putFile,
    deleteFile: deleteFile,
    saveGame: saveGame,
    deleteGame: deleteGame,
    kvGet: kvGet,
    kvSet: kvSet,
    kvDel: kvDel,
    wipe: wipe
  };
})(typeof self !== 'undefined' ? self : this);
