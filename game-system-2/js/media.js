/* Game System 2.0 — your screenshots, recordings, drawings and photos (the Gallery).
   Everything is kept in this browser (IndexedDB "media" store) and goes into full backups.
   Built-in apps (Gallery, Video, Drawing) reach it through GameSystem.media in the Game Kit. */
(function () {
  'use strict';

  /* kind: shot (screenshot) | clip (recording) | drawing | photo (your own picture) | video (your own video) */
  var KINDS = ['shot', 'clip', 'drawing', 'photo', 'video'];
  var items = [];          /* newest first */
  var ready = null;

  function sortItems() { items.sort(function (a, b) { return (b.t || 0) - (a.t || 0); }); }

  function init() {
    if (ready) return ready;
    ready = GS2DB.getAll('media').then(function (all) {
      items = (all || []).filter(function (r) { return r && r.id && isBlob(r.b); });
      sortItems();
    }).catch(function (e) { console.warn('media store', e); items = []; });
    return ready;
  }

  /* a Blob made inside an app's window isn't "instanceof Blob" here, so check it by its shape */
  function isBlob(x) { var t = Object.prototype.toString.call(x); return t === '[object Blob]' || t === '[object File]'; }
  function isVideo(r) { return r.kind === 'clip' || r.kind === 'video' || /^video\//.test(r.mime || ''); }

  /* a small picture for the grid */
  function imageThumb(blob, max) {
    return U.resizeImage(blob, max || 420).catch(function () { return null; });
  }
  function videoThumb(blob, max) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var v = document.createElement('video');
      var done = false;
      function finish(b, info) { if (done) return; done = true; clearTimeout(timer); v.removeAttribute('src'); try { v.load(); } catch (e) { /* ignore */ } URL.revokeObjectURL(url); resolve({ thumb: b, w: info && info.w, h: info && info.h }); }
      var timer = setTimeout(function () { finish(null); }, 8000);
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.addEventListener('loadeddata', function () {
        try { v.currentTime = 0.05; } catch (e) { grab(); }
      });
      v.addEventListener('seeked', grab);
      v.addEventListener('error', function () { finish(null); });
      function grab() {
        try {
          var w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) return finish(null);
          var s = Math.min(1, (max || 420) / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * s); c.height = Math.round(h * s);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(function (b) { finish(b, { w: w, h: h }); }, 'image/jpeg', 0.8);
        } catch (e) { finish(null); }
      }
      v.src = url;
    });
  }
  function imageSize(blob) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = function () { URL.revokeObjectURL(url); resolve({}); };
      img.src = url;
    });
  }

  function niceName(kind, g, t) {
    var d = new Date(t);
    var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0') + '.' + String(d.getSeconds()).padStart(2, '0');
    var what = { shot: 'Screenshot', clip: 'Recording', drawing: 'Drawing', photo: 'Photo', video: 'Video' }[kind] || 'Media';
    return (g ? g.name + ' ' : '') + what + ' ' + stamp;
  }
  function extFor(mime) {
    if (/png/.test(mime)) return '.png';
    if (/jpe?g/.test(mime)) return '.jpg';
    if (/webp/.test(mime)) return '.webp';
    if (/gif/.test(mime)) return '.gif';
    if (/mp4/.test(mime)) return '.mp4';
    if (/webm/.test(mime)) return '.webm';
    if (/quicktime/.test(mime)) return '.mov';
    if (/ogg/.test(mime)) return '.ogv';
    return '';
  }

  /* add something: meta = { kind, g (game id), name, dur (ms), t } */
  async function add(blob, meta) {
    await init();
    meta = meta || {};
    if (!isBlob(blob) || !blob.size) throw new Error('Nothing to save.');
    if (!(blob instanceof Blob)) blob = new Blob([blob], { type: blob.type || '' });
    var kind = KINDS.indexOf(meta.kind) >= 0 ? meta.kind : (/^video\//.test(blob.type) ? 'video' : 'photo');
    var g = meta.g ? D.get(meta.g) : null;
    var t = meta.t || Date.now();
    var rec = {
      id: typeof meta.id === 'string' && /^m-[\w-]{3,40}$/.test(meta.id) ? meta.id : 'm-' + t.toString(36) + Math.random().toString(36).slice(2, 7),
      kind: kind, g: g ? g.id : null, gname: g ? g.name : (meta.gname || ''),
      name: String(meta.name || niceName(kind, g, t)).slice(0, 120),
      t: t, b: blob, mime: blob.type || '', size: blob.size, dur: Number(meta.dur) || 0, w: 0, h: 0, thumb: null
    };
    if (meta.thumb && isBlob(meta.thumb)) {
      /* restored from a backup: the small picture is already made */
      rec.thumb = meta.thumb; rec.w = Number(meta.w) || 0; rec.h = Number(meta.h) || 0;
    } else if (isVideo(rec)) {
      var vt = await videoThumb(blob);
      rec.thumb = vt.thumb; rec.w = vt.w || 0; rec.h = vt.h || 0;
    } else {
      var sz = await imageSize(blob);
      rec.w = sz.w || 0; rec.h = sz.h || 0;
      rec.thumb = blob.size > 160000 ? await imageThumb(blob) : null;
    }
    await GS2DB.put('media', rec);
    items.push(rec);
    sortItems();
    changed();
    return rec;
  }

  async function remove(id) {
    await init();
    await GS2DB.del('media', id);
    items = items.filter(function (r) { return r.id !== id; });
    changed();
  }
  async function rename(id, name) {
    await init();
    var r = get(id);
    if (!r) return null;
    r.name = String(name || '').trim().slice(0, 120) || r.name;
    await GS2DB.put('media', r);
    changed();
    return r;
  }
  function get(id) { return items.find(function (r) { return r.id === id; }) || null; }
  function list(filter) {
    filter = filter || {};
    return items.filter(function (r) {
      if (filter.kind && (Array.isArray(filter.kind) ? filter.kind.indexOf(r.kind) < 0 : r.kind !== filter.kind)) return false;
      if (filter.g && r.g !== filter.g) return false;
      return true;
    });
  }
  function stats() {
    return { count: items.length, size: items.reduce(function (s, r) { return s + (r.size || 0) + (r.thumb ? r.thumb.size : 0); }, 0) };
  }
  function download(id) {
    var r = get(id);
    if (!r) return false;
    U.downloadBlob(r.b, r.name.replace(/[\\/:*?"<>|]+/g, '-') + extFor(r.mime));
    return true;
  }

  /* tell the screens + open app windows that something changed */
  var changedSoon = null;
  function changed() {
    clearTimeout(changedSoon);
    changedSoon = setTimeout(function () {
      D.emit('media');
      if (window.Win && Win.broadcast) Win.broadcast('gs2media');
    }, 30);
  }

  /* plain copies for apps (they get the Blob itself; same origin, so that's fine) */
  function pub(r) {
    return { id: r.id, kind: r.kind, g: r.g, gname: r.gname, name: r.name, t: r.t, mime: r.mime, size: r.size, dur: r.dur, w: r.w, h: r.h, blob: r.b, thumb: r.thumb || null };
  }

  /* "open this one" for the Gallery / Video app when it starts */
  var pendingOpen = null;
  function setPending(id, app) { pendingOpen = id ? { id: id, app: app || 'gallery', t: Date.now() } : null; }

  /* ---------------- what built-in apps can ask for ---------------- */
  function forApp(appId, op, arg) {
    var app = D.get(appId);
    if (!app || !app.builtin) return Promise.reject(new Error('Only Game System apps can use the Gallery.'));
    arg = arg || {};
    return init().then(function () {
      switch (op) {
        case 'list': return list(arg).map(pub);
        case 'get': { var r = get(arg.id); return r ? pub(r) : null; }
        case 'add': {
          var blob = isBlob(arg.blob) ? arg.blob : (typeof arg.dataUrl === 'string' ? U.dataUrlToBlob(arg.dataUrl) : null);
          if (!blob) throw new Error('Nothing to save.');
          if (blob.size > 512 * 1024 * 1024) throw new Error('That file is too big (max 512 MB).');
          return add(blob, { kind: arg.kind, name: arg.name, g: arg.g, dur: arg.dur }).then(pub);
        }
        case 'remove': return remove(String(arg.id)).then(function () { return true; });
        case 'rename': return rename(String(arg.id), arg.name).then(function (r) { return r ? pub(r) : null; });
        case 'download': return download(String(arg.id));
        case 'use': {
          var u = get(arg.id);
          if (!u || isVideo(u)) return false;
          setTimeout(function () { Pics.useFor(u.b, appId); }, 0);
          return true;
        }
        case 'covers':
          return D.list().filter(function (g) { return isBlob(g.cover); }).map(function (g) {
            return { id: 'cover:' + g.id, kind: 'cover', g: g.id, gname: g.name, name: g.name + ' picture', t: g.coverT || g.created || 0, mime: g.cover.type, size: g.cover.size, blob: g.cover, thumb: null };
          });
        case 'games': return D.list().map(function (g) { return { id: g.id, name: g.name, kind: g.kind || 'game' }; });
        case 'watch': return window.Capture ? Capture.watch(String(arg.id)) : false;
        case 'stats': return stats();
        case 'pending': {
          var p = pendingOpen;
          if (!p || Date.now() - p.t > 20000 || (arg.app && p.app !== arg.app)) return null;
          pendingOpen = null;
          return { id: p.id };
        }
        default: throw new Error('Unknown request: ' + op);
      }
    });
  }

  /* ---------------- backups ---------------- */
  function exportFiles() {
    var out = [];
    items.forEach(function (r) {
      var path = 'media/' + r.id + extFor(r.mime);
      var meta = { id: r.id, kind: r.kind, g: r.g, gname: r.gname, name: r.name, t: r.t, mime: r.mime, dur: r.dur, w: r.w, h: r.h, file: path };
      out.push({ meta: meta, file: { path: path, data: r.b } });
      if (r.thumb) {
        meta.thumbFile = 'media/' + r.id + '.thumb.jpg';
        out.push({ meta: null, file: { path: meta.thumbFile, data: r.thumb } });
      }
    });
    return out;
  }
  async function importList(metas, getFile) {
    await init();
    var n = 0;
    for (var i = 0; i < (metas || []).length; i++) {
      var m = metas[i];
      if (!m || typeof m.id !== 'string' || get(m.id)) continue;
      var f = getFile(m.file);
      if (!f) continue;
      try {
        /* keeps the old id, so restoring twice doesn't make copies */
        var tf = typeof m.thumbFile === 'string' ? getFile(m.thumbFile) : null;
        await add(new Blob([f], { type: m.mime || '' }), {
          id: m.id, kind: m.kind, g: m.g, gname: m.gname, name: m.name, dur: m.dur, t: m.t,
          thumb: tf ? new Blob([tf], { type: 'image/jpeg' }) : null, w: m.w, h: m.h
        });
        n++;
      } catch (e) { /* skip broken file */ }
    }
    sortItems();
    changed();
    return n;
  }

  window.Media = {
    KINDS: KINDS,
    init: init,
    add: add,
    remove: remove,
    rename: rename,
    get: get,
    list: list,
    stats: stats,
    download: download,
    isVideo: isVideo,
    isBlob: isBlob,
    extFor: extFor,
    forApp: forApp,
    setPending: setPending,
    exportFiles: exportFiles,
    importList: importList
  };
})();
