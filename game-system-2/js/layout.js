/* Game System 2.0 — how your stuff is arranged.
   Your own order of games and apps, phone-style folders, and how each screen looks
   (small icons, big cards or a list, plus a size slider).

   Library: every game and app. Its folders are the same as each game's "folder" name, so imports,
   backups and the website folder keep working. Apps tab: only apps, with its own folders. */
(function () {
  'use strict';

  var KEY = 'layout';
  var SCREENS = ['library', 'apps'];
  var VIEW_DEFAULTS = {
    home: { mode: 'cards', size: 1 },
    library: { mode: 'cards', size: 1 },
    apps: { mode: 'icons', size: 1 }
  };
  var MODES = ['icons', 'cards', 'list'];

  /* entries are 'g:<id>' strings or folders: { f: 'f-…', name, items: [ids], cover: Blob|null } */
  var L = { library: [], apps: [] };

  function uid() { return 'f-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function belongs(screen, g) { return !!g && (screen === 'library' || D.isApp(g)); }
  function isFolder(e) { return e && typeof e === 'object' && typeof e.f === 'string'; }
  function cleanEntry(e) {
    if (typeof e === 'string' && e.indexOf('g:') === 0) return e;
    if (isFolder(e)) {
      return {
        f: e.f,
        name: String(e.name || 'Folder').slice(0, 40),
        items: Array.isArray(e.items) ? e.items.filter(function (x) { return typeof x === 'string'; }) : [],
        cover: e.cover instanceof Blob ? e.cover : null
      };
    }
    return null;
  }
  function lc(s) { return String(s || '').trim().toLowerCase(); }

  /* ---------------- load + keep in step with the games ---------------- */
  async function init() {
    var saved = null;
    try { saved = await GS2DB.kvGet(KEY); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
      SCREENS.forEach(function (s) { if (Array.isArray(saved[s])) L[s] = saved[s].map(cleanEntry).filter(Boolean); });
    } else {
      /* first time: start from "recently played first" */
      L.library = D.list().map(function (g) { return 'g:' + g.id; });
      L.apps = D.list('app').map(function (g) { return 'g:' + g.id; });
    }
    reconcile();
    D.on(function (type) { if (type === 'games' || type === 'game') reconcileSoon(); });
  }

  /* while a change is half done (renaming a folder updates every game in it), don't tidy up yet */
  var hold = 0;
  var recTimer = 0;
  function reconcileSoon() {
    clearTimeout(recTimer);
    recTimer = setTimeout(function () { if (!hold && reconcile()) emit(); }, 0);
  }
  function held(fn) {
    return async function () {
      hold++;
      try { return await fn.apply(null, arguments); }
      finally { hold--; if (!hold) reconcileSoon(); }
    };
  }

  /* new games/apps get added, deleted ones removed, folders follow each game's folder name. Returns true if anything changed. */
  function reconcile() {
    var before = JSON.stringify(snapshotKeys());
    SCREENS.forEach(function (s) {
      var seen = {};
      var top = [];
      var folders = {};
      L[s].forEach(function (e) {
        if (typeof e === 'string') {
          var id = e.slice(2), g = D.get(id);
          if (belongs(s, g) && !seen[id]) { seen[id] = 1; top.push(e); }
        } else {
          e.items = e.items.filter(function (id) {
            var g = D.get(id);
            if (!belongs(s, g) || seen[id]) return false;
            seen[id] = 1;
            return true;
          });
          top.push(e);
          folders[lc(e.name)] = folders[lc(e.name)] || e;
        }
      });
      /* anything new goes at the end (oldest first, so a batch keeps its order) */
      D.list().filter(function (g) { return belongs(s, g) && !seen[g.id]; })
        .sort(function (a, b) { return (a.created || 0) - (b.created || 0); })
        .forEach(function (g) { top.push('g:' + g.id); });

      if (s === 'library') {
        /* Library folders = each game's folder name */
        var out = [];
        var moveIn = [];
        top.forEach(function (e) {
          if (typeof e === 'string') {
            var g = D.get(e.slice(2));
            if (g.folder) moveIn.push(g); else out.push(e);
          } else {
            var keep = [];
            e.items.forEach(function (id) {
              var g = D.get(id);
              if (lc(g.folder) === lc(e.name)) keep.push(id);
              else if (!g.folder) out.push('g:' + id);
              else moveIn.push(g);
            });
            e.items = keep;
            out.push(e);
          }
        });
        moveIn.forEach(function (g) {
          var f = folders[lc(g.folder)];
          if (!f) {
            f = { f: uid(), name: String(g.folder).slice(0, 40), items: [], cover: null };
            folders[lc(g.folder)] = f;
            out.push(f);
          }
          if (f.items.indexOf(g.id) < 0) f.items.push(g.id);
        });
        top = out;
      }
      /* empty folders disappear */
      L[s] = top.filter(function (e) { return typeof e === 'string' || e.items.length; });
    });
    var changed = JSON.stringify(snapshotKeys()) !== before;
    if (changed) saveSoon();
    return changed;
  }
  function snapshotKeys() {
    var o = {};
    SCREENS.forEach(function (s) { o[s] = L[s].map(function (e) { return typeof e === 'string' ? e : [e.f, e.name, e.items.join(',')]; }); });
    return o;
  }

  var saveTimer = 0;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }
  function save() {
    clearTimeout(saveTimer);
    return GS2DB.kvSet(KEY, { library: L.library, apps: L.apps }).catch(function () {});
  }
  function emit() { D.emit('layout'); }

  /* ---------------- reading ---------------- */
  function findFolder(screen, fid) {
    var list = L[screen] || [];
    for (var i = 0; i < list.length; i++) if (isFolder(list[i]) && list[i].f === fid) return list[i];
    return null;
  }
  function folderOf(screen, id) {
    var list = L[screen] || [];
    for (var i = 0; i < list.length; i++) if (isFolder(list[i]) && list[i].items.indexOf(id) >= 0) return list[i];
    return null;
  }
  /* [{ kind: 'item', key, g } | { kind: 'folder', key, f, games: [g] }] */
  function tree(screen) {
    return (L[screen] || []).map(function (e) {
      if (typeof e === 'string') {
        var g = D.get(e.slice(2));
        return g ? { kind: 'item', key: e, g: g } : null;
      }
      return { kind: 'folder', key: 'f:' + e.f, f: e, games: e.items.map(D.get).filter(Boolean) };
    }).filter(Boolean);
  }
  /* everything in order with folders opened up */
  function flat(screen) {
    var out = [];
    tree(screen).forEach(function (n) { if (n.kind === 'item') out.push(n.g); else out.push.apply(out, n.games); });
    return out;
  }

  /* ---------------- changing ---------------- */
  function setFolderName(screen, id, name) {
    if (screen !== 'library') return Promise.resolve();
    var g = D.get(id);
    if (!g || (g.folder || '') === (name || '')) return Promise.resolve();
    return D.updateGame(id, { folder: name || '' });
  }
  function removeEverywhere(screen, key) {
    var list = L[screen];
    var id = key.indexOf('g:') === 0 ? key.slice(2) : null;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (typeof e === 'string' && e === key) list.splice(i, 1);
      else if (id && isFolder(e)) { var j = e.items.indexOf(id); if (j >= 0) e.items.splice(j, 1); }
      else if (isFolder(e) && key === 'f:' + e.f) list.splice(i, 1);
    }
  }

  /* The grid was rearranged: keys = new order of a container ('top' or a folder id). */
  async function applyOrder(screen, container, keys, movedKey) {
    var list = L[screen];
    if (!list) return;
    var was = JSON.stringify(snapshotKeys());
    if (container === 'top') {
      var byKey = {};
      list.forEach(function (e) { byKey[typeof e === 'string' ? e : 'f:' + e.f] = e; });
      if (movedKey && !byKey[movedKey]) {
        /* dragged out of a folder onto the main grid */
        var f = folderOf(screen, movedKey.slice(2));
        if (f) f.items.splice(f.items.indexOf(movedKey.slice(2)), 1);
        byKey[movedKey] = movedKey;
        await setFolderName(screen, movedKey.slice(2), '');
      }
      var seen = {};
      var next = keys.map(function (k) { seen[k] = 1; return byKey[k]; }).filter(Boolean);
      list.forEach(function (e) { var k = typeof e === 'string' ? e : 'f:' + e.f; if (!seen[k]) next.push(e); });
      L[screen] = next.filter(function (e) { return typeof e === 'string' || e.items.length; });
    } else {
      var folder = findFolder(screen, container);
      if (!folder) return;
      var ids = keys.map(function (k) { return k.slice(2); });
      if (movedKey && folder.items.indexOf(movedKey.slice(2)) < 0) {
        removeEverywhere(screen, movedKey);
        await setFolderName(screen, movedKey.slice(2), folder.name);
      }
      folder.items = ids.filter(function (id, i) { return D.get(id) && ids.indexOf(id) === i; });
      L[screen] = L[screen].filter(function (e) { return typeof e === 'string' || e.items.length; });
    }
    if (JSON.stringify(snapshotKeys()) !== was) Trophies.event('moved');
    saveSoon();
    emit();
  }

  /* drop one thing onto another: makes a folder, or adds to the folder */
  async function merge(screen, dragKey, targetKey) {
    if (dragKey === targetKey || dragKey.indexOf('g:') !== 0) return null;
    var id = dragKey.slice(2);
    var list = L[screen];
    if (targetKey.indexOf('f:') === 0) {
      var f = findFolder(screen, targetKey.slice(2));
      if (!f) return null;
      removeEverywhere(screen, dragKey);
      if (f.items.indexOf(id) < 0) f.items.push(id);
      await setFolderName(screen, id, f.name);
      cleanup(screen);
      saveSoon(); emit();
      return f;
    }
    var tid = targetKey.slice(2);
    var existing = folderOf(screen, tid);
    if (existing) return merge(screen, dragKey, 'f:' + existing.f);
    var at = list.indexOf(targetKey);
    if (at < 0) return null;
    var folder = { f: uid(), name: suggestName(screen, [D.get(tid), D.get(id)]), items: [tid, id], cover: null };
    removeEverywhere(screen, dragKey);
    at = L[screen].indexOf(targetKey);
    L[screen].splice(at, 1, folder);
    await setFolderName(screen, tid, folder.name);
    await setFolderName(screen, id, folder.name);
    cleanup(screen);
    saveSoon(); emit();
    Trophies.event('folder');
    return folder;
  }
  function cleanup(screen) { L[screen] = L[screen].filter(function (e) { return typeof e === 'string' || e.items.length; }); }

  /* a name that isn't taken yet: "Apps", "Games", "Folder 2"… */
  function suggestName(screen, games) {
    var allApps = games.every(D.isApp), allGames = games.every(function (g) { return !D.isApp(g); });
    var base = allApps && screen === 'library' ? 'Apps' : (allGames && screen === 'library' ? 'Games' : 'Folder');
    var taken = {};
    (L[screen] || []).forEach(function (e) { if (isFolder(e)) taken[lc(e.name)] = 1; });
    if (screen === 'library') Object.keys(D.folders().reduce(function (o, f) { o[lc(f.name)] = 1; return o; }, {})).forEach(function (k) { taken[k] = 1; });
    if (!taken[lc(base)]) return base;
    for (var n = 2; n < 999; n++) if (!taken[lc(base + ' ' + n)]) return base + ' ' + n;
    return base;
  }

  async function renameFolder(screen, fid, name) {
    var f = findFolder(screen, fid);
    name = String(name || '').trim().slice(0, 40);
    if (!f || !name || name === f.name) return;
    var other = (L[screen] || []).find(function (e) { return isFolder(e) && e !== f && lc(e.name) === lc(name); });
    if (other) {
      /* same name as another folder: put them together */
      other.items = other.items.concat(f.items.filter(function (id) { return other.items.indexOf(id) < 0; }));
      L[screen] = L[screen].filter(function (e) { return e !== f; });
      for (var i = 0; i < other.items.length; i++) await setFolderName(screen, other.items[i], other.name);
    } else {
      f.name = name;
      for (var j = 0; j < f.items.length; j++) await setFolderName(screen, f.items[j], name);
    }
    saveSoon(); emit();
  }
  /* take everything out of the folder (keeps the spot) */
  async function ungroup(screen, fid) {
    var f = findFolder(screen, fid);
    if (!f) return;
    var at = L[screen].indexOf(f);
    var items = f.items.slice();
    L[screen].splice.apply(L[screen], [at, 1].concat(items.map(function (id) { return 'g:' + id; })));
    for (var i = 0; i < items.length; i++) await setFolderName(screen, items[i], '');
    saveSoon(); emit();
  }
  async function takeOut(screen, id) {
    var f = folderOf(screen, id);
    if (!f) return;
    var at = L[screen].indexOf(f);
    f.items.splice(f.items.indexOf(id), 1);
    L[screen].splice(at + 1, 0, 'g:' + id);
    await setFolderName(screen, id, '');
    cleanup(screen);
    saveSoon(); emit();
  }
  async function setFolderCover(screen, fid, blob) {
    var f = findFolder(screen, fid);
    if (!f) return;
    f.cover = blob ? await U.resizeImage(blob, 480) : null;
    saveSoon(); emit();
  }
  /* "Arrange by name / most played / newest": rewrites your order once */
  function arrange(screen, how) {
    var sorters = {
      name: function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); },
      played: function (a, b) { return ((b.playTime || 0) - (a.playTime || 0)) || ((b.launches || 0) - (a.launches || 0)); },
      recent: function (a, b) { return (b.lastPlayed || 0) - (a.lastPlayed || 0); },
      new: function (a, b) { return (b.created || 0) - (a.created || 0); },
      kind: function (a, b) { return (D.isApp(a) - D.isApp(b)) || a.name.localeCompare(b.name); }
    };
    var fn = sorters[how];
    if (!fn) return;
    function keyGame(e) { return typeof e === 'string' ? D.get(e.slice(2)) : { name: e.name, playTime: 0, lastPlayed: 0, created: 0, kind: '' }; }
    L[screen].sort(function (a, b) {
      if (isFolder(a) !== isFolder(b)) return isFolder(a) ? -1 : 1;
      return fn(keyGame(a), keyGame(b));
    });
    L[screen].forEach(function (e) { if (isFolder(e)) e.items.sort(function (x, y) { return fn(D.get(x), D.get(y)); }); });
    saveSoon(); emit();
  }
  /* move one step (keyboard / controller "Move") */
  function nudge(screen, key, delta) {
    var list = L[screen];
    var i = list.indexOf(key);
    if (i < 0) {
      var f = folderOf(screen, key.slice(2));
      if (!f) return false;
      var j = f.items.indexOf(key.slice(2));
      var nj = Math.max(0, Math.min(f.items.length - 1, j + delta));
      if (nj === j) return false;
      f.items.splice(nj, 0, f.items.splice(j, 1)[0]);
    } else {
      var ni = Math.max(0, Math.min(list.length - 1, i + delta));
      if (ni === i) return false;
      list.splice(ni, 0, list.splice(i, 1)[0]);
    }
    Trophies.event('moved');
    saveSoon(); emit();
    return true;
  }

  /* ---------------- how each screen looks ---------------- */
  function view(screen) {
    var all = D.ui.views || (D.ui.views = {});
    var v = Object.assign({}, VIEW_DEFAULTS[screen] || VIEW_DEFAULTS.library, all[screen] || {});
    if (MODES.indexOf(v.mode) < 0) v.mode = (VIEW_DEFAULTS[screen] || VIEW_DEFAULTS.library).mode;
    v.size = Math.min(1.6, Math.max(0.6, Number(v.size) || 1));
    return v;
  }
  function setView(screen, patch) {
    var all = D.ui.views || (D.ui.views = {});
    all[screen] = Object.assign(view(screen), patch);
    D.saveUISoon();
  }

  /* ---------------- backups ---------------- */
  function exportData() {
    var covers = [];
    var data = {};
    SCREENS.forEach(function (s) {
      data[s] = L[s].map(function (e) {
        if (typeof e === 'string') return e;
        var o = { f: e.f, name: e.name, items: e.items.slice() };
        if (e.cover) { o.coverFile = 'covers/folder-' + s + '-' + e.f + '.jpg'; covers.push({ path: o.coverFile, data: e.cover }); }
        return o;
      });
    });
    return { data: data, covers: covers };
  }
  async function importData(data, fileFor) {
    if (!data || typeof data !== 'object') return;
    SCREENS.forEach(function (s) {
      if (!Array.isArray(data[s])) return;
      L[s] = data[s].map(function (e) {
        if (isFolder(e) && e.coverFile && fileFor) {
          var f = fileFor(e.coverFile);
          e = Object.assign({}, e, { cover: f ? new Blob([f], { type: 'image/jpeg' }) : null });
        }
        return cleanEntry(e);
      }).filter(Boolean);
    });
    reconcile();
    await save();
    emit();
  }

  window.Layout = {
    init: init,
    tree: tree,
    flat: flat,
    findFolder: findFolder,
    folderOf: folderOf,
    applyOrder: held(applyOrder),
    merge: held(merge),
    renameFolder: held(renameFolder),
    ungroup: held(ungroup),
    takeOut: held(takeOut),
    setFolderCover: setFolderCover,
    arrange: arrange,
    nudge: nudge,
    view: view,
    setView: setView,
    MODES: MODES,
    exportData: exportData,
    importData: importData,
    reconcile: function () { if (reconcile()) emit(); }
  };
})();
