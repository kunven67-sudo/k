// ---------- saving ----------
// Extension: chrome.storage (big, survives clearing the site's data).
// Bookmark / downloaded page: the site's own IndexedDB (falls back to localStorage).

var store = (function () {
  if (KIND === 'extension') {
    var cs = function () { return chrome.storage.local; };
    return {
      get: function (k) {
        return new Promise(function (res) {
          try { cs().get(k, function (o) { res(o && o[k] || null); }); } catch (e) { res(null); }
        });
      },
      set: function (k, v) {
        return new Promise(function (res, rej) {
          var o = {}; o[k] = v;
          try { cs().set(o, function () { var er = chrome.runtime.lastError; er ? rej(er) : res(); }); } catch (e) { rej(e); }
        });
      },
      del: function (k) {
        return new Promise(function (res) { try { cs().remove(k, function () { res(); }); } catch (e) { res(); } });
      },
      list: function () {
        return new Promise(function (res) {
          try {
            cs().get(null, function (all) {
              res(Object.keys(all || {}).filter(function (k) { return k.indexOf('ew:') === 0; }).map(function (k) { return all[k]; }));
            });
          } catch (e) { res([]); }
        });
      }
    };
  }

  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open('edit-website', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('p'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
        r.onblocked = function () { rej(new Error('blocked')); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('p', mode), r = fn(t.objectStore('p'));
        t.oncomplete = function () { res(r ? r.result : undefined); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var ls = {
    get: function (k) { try { return Promise.resolve(JSON.parse(localStorage.getItem(k) || 'null')); } catch (e) { return Promise.resolve(null); } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return Promise.resolve(); } catch (e) { return Promise.reject(e); } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} return Promise.resolve(); },
    list: function () {
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('ew:') === 0) out.push(JSON.parse(localStorage.getItem(k))); } } catch (e) {}
      return Promise.resolve(out);
    }
  };
  return {
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }).then(function (v) { return v || ls.get(k); }, function () { return ls.get(k); }); },
    set: function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }).catch(function () { return ls.set(k, v); }); },
    del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }).catch(function () {}).then(function () { return ls.del(k); }); },
    list: function () {
      return tx('readonly', function (s) { return s.getAll(); }).catch(function () { return []; }).then(function (a) {
        return ls.list().then(function (b) { return (a || []).concat(b); });
      });
    }
  };
})();
