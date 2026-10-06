/* Game System 2.0 — backups (one .zip with everything) and "Build website folder" for Netlify. */
(function () {
  'use strict';
  var h = U.h;

  function progressModal(title, ic) {
    var label = h('div.small.muted', 'Starting…');
    var bar = h('div.progress', h('i'));
    var m = UI.modal({ title: title, icon: ic, body: h('div', label, h('div', { style: { height: '10px' } }), bar), dismissible: false });
    return {
      set: function (text, frac) {
        label.textContent = text;
        if (frac != null) bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
      },
      close: function () { m.close(); }
    };
  }

  /* ---------------- backup ---------------- */
  async function exportAll(ids) {
    var games = (ids && ids.length ? ids.map(D.get) : D.list()).filter(Boolean);
    if (!games.length) { UI.toast('No games to back up yet.', { type: 'warn' }); return; }
    var full = !ids || !ids.length;
    var p = progressModal('Making a backup', 'lifebuoy');
    try {
      var files = [];
      var manifest = {
        gs2backup: 1,
        app: GS2Shared.APP_VERSION,
        created: Date.now(),
        full: full,
        settings: full ? D.settings : null,
        days: full ? D.days : null,
        layout: null,
        games: [],
        saves: [],
        storage: {}
      };
      var skipped = [];
      for (var i = 0; i < games.length; i++) {
        var g = games[i];
        p.set('Packing ' + g.name + '…', i / games.length * 0.5);
        if (g.source === 'site') {
          try { await D.ensureLocalFiles(g); } catch (e) { skipped.push(g.name); }
        }
        var recs = g.source === 'link' ? [] : await GS2DB.filesOf(g.id);
        var meta = Object.assign({}, g);
        delete meta.cover;
        meta.files = recs.map(function (r) { return r.p; });
        if (g.cover) {
          meta.coverFile = 'covers/' + g.id + (g.cover.type === 'image/png' ? '.png' : '.jpg');
          files.push({ path: meta.coverFile, data: g.cover });
        }
        recs.forEach(function (r) { files.push({ path: 'games/' + g.id + '/' + r.p, data: r.b }); });
        manifest.games.push(meta);
        var save = await D.latestSave(g.id);
        if (save) manifest.saves.push({ g: g.id, data: save.data, t: save.t });
        var keys = D.storageKeys(g.id);
        if (keys.length) {
          var ls = {};
          keys.forEach(function (k) { ls[k.key] = localStorage.getItem(k.real); });
          manifest.storage[g.id] = ls;
        }
      }
      if (full) {
        var lay = Layout.exportData();
        manifest.layout = lay.data;
        lay.covers.forEach(function (c) { files.push(c); });
        /* your trophies + profile picture */
        manifest.trophies = Trophies.exportData();
        if (D.avatar) { manifest.avatarFile = 'profile/avatar.jpg'; files.push({ path: manifest.avatarFile, data: D.avatar }); }
      }
      files.unshift({ path: 'gs2-backup.json', data: JSON.stringify(manifest) });
      files.push({ path: 'README.txt', data: 'This is a Game System 2.0 backup (' + countText(games) + ', made ' + new Date().toLocaleString() + ').\r\n\r\nTo restore it: open Game System 2.0 -> Settings -> "Restore a backup" -> pick this .zip file.\r\nYou don\'t need to unzip it.\r\n' });
      var zip = await GS2Zip.makeZip(files, function (n, total) { p.set('Zipping… ' + n + '/' + total, 0.5 + n / total * 0.5); });
      p.close();
      var name = 'game-system-backup-' + U.dayKey() + (full ? '' : '-' + games.length + '-games') + '.zip';
      U.downloadBlob(zip, name);
      if (full) { D.settings.lastBackup = Date.now(); D.saveSettings(); }
      Trophies.event('backup');
      Sound.good();
      UI.toast(h('span', 'Saved ', h('b', name), ' (' + U.fmtBytes(zip.size) + ') to your Downloads. Keep it somewhere safe!'), { type: 'good', title: 'Backup done', icon: 'lifebuoy', timeout: 9000, sound: false });
      if (skipped.length) UI.toast('Couldn\'t download these website games, so their files aren\'t in the backup: ' + skipped.join(', '), { type: 'warn' });
      if (D.ui.view === 'home') Views.render('home');
    } catch (err) {
      p.close();
      UI.alert('Backup failed', err.message || String(err));
    }
  }

  function pickRestore() {
    Importer.pickFiles({ accept: '.zip,application/zip' });
  }

  async function restoreFromEntries(entries) {
    var mf = entries.find(function (e) { return /(^|\/)gs2-backup\.json$/i.test(e.path); });
    if (!mf) return;
    var prefix = mf.path.slice(0, mf.path.length - 'gs2-backup.json'.length);
    var manifest;
    try { manifest = JSON.parse(await mf.file.text()); } catch (e) { UI.alert('Broken backup', 'The backup file is damaged.'); return; }
    if (!manifest || manifest.gs2backup !== 1 || !Array.isArray(manifest.games)) { UI.alert('Not a backup', 'That isn\'t a Game System 2.0 backup.'); return; }
    var byPath = new Map();
    entries.forEach(function (e) { byPath.set(e.path, e.file); });
    var existing = manifest.games.filter(function (g) { return D.get(g.id); }).length;

    var mode = 'replace';
    var withSettings = !!manifest.settings;
    var modeSeg = h('div.seg',
      h('button.on', { onclick: function (e) { mode = 'replace'; segOn(e.target); } }, 'Replace with backup'),
      h('button', { onclick: function (e) { mode = 'missing'; segOn(e.target); } }, 'Only add missing games'));
    function segOn(b) { modeSeg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); }
    var setCb = h('input', { type: 'checkbox', checked: withSettings, onchange: function (e) { withSettings = e.target.checked; } });

    UI.modal({
      title: 'Restore backup',
      icon: 'download',
      body: h('div',
        h('p', 'Backup from ', h('b', new Date(manifest.created).toLocaleString()), ' with ', h('b', countText(manifest.games.filter(Boolean))), '.'),
        existing ? h('div', h('p.small.muted', existing + ' of them ' + (existing === 1 ? 'is' : 'are') + ' already in your library. What should happen to those?'), modeSeg) : null,
        manifest.settings ? h('label.row', { style: { marginTop: '14px' } }, setCb, 'Also restore my settings (name, colors, etc.)') : null),
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Restore', kind: 'primary', onClick: function () { run(); } }]
    });

    async function run() {
      var p = progressModal('Restoring', 'download');
      try {
        var restoredList = [];
        var savesById = {};
        (manifest.saves || []).forEach(function (s) { savesById[s.g] = s; });
        for (var i = 0; i < manifest.games.length; i++) {
          var meta = manifest.games[i];
          if (!meta || typeof meta.id !== 'string') continue;
          var had = !!D.get(meta.id);
          if (had && mode === 'missing') continue;
          p.set('Restoring ' + meta.name + '…', i / manifest.games.length);
          var files = (meta.files || []).map(function (path) {
            var f = byPath.get(prefix + 'games/' + meta.id + '/' + path);
            return f ? { p: path, b: f, t: U.mimeOf(path) } : null;
          }).filter(Boolean);
          var rec = D.normalize(Object.assign({}, meta));
          delete rec.files;
          delete rec.coverFile;
          rec.cover = null;
          if (meta.coverFile && byPath.get(prefix + meta.coverFile)) {
            var cf = byPath.get(prefix + meta.coverFile);
            rec.cover = new Blob([cf], { type: /\.png$/i.test(meta.coverFile) ? 'image/png' : 'image/jpeg' });
          }
          if (rec.source === 'site' && files.length) { rec.source = 'local'; delete rec.siteFiles; }
          await GS2DB.saveGame(rec, rec.source === 'link' ? [] : files);
          D.games.set(rec.id, rec);
          var sv = savesById[meta.id];
          if (sv && sv.data != null) await D.putSave(meta.id, sv.data, sv.t || Date.now());
          var ls = (manifest.storage || {})[meta.id];
          if (ls) Object.keys(ls).forEach(function (k) { try { localStorage.setItem('gs2:ls:' + meta.id + ':' + k, String(ls[k])); } catch (e) { /* full */ } });
          restoredList.push(rec);
        }
        /* your order and folders */
        if (manifest.layout) {
          try { await Layout.importData(manifest.layout, function (path) { return byPath.get(prefix + path) || null; }); } catch (e) { /* keep going */ }
        }
        if (manifest.days && typeof manifest.days === 'object') {
          Object.keys(manifest.days).forEach(function (day) {
            var src = manifest.days[day] || {};
            var dst = D.days[day] = D.days[day] || {};
            Object.keys(src).forEach(function (id) { dst[id] = Math.max(dst[id] || 0, Number(src[id]) || 0); });
          });
          await GS2DB.kvSet('days', D.days);
        }
        if (manifest.trophies) Trophies.importData(manifest.trophies);
        if (manifest.avatarFile && byPath.get(prefix + manifest.avatarFile) && (withSettings || !D.avatar)) {
          try { await D.setAvatar(new Blob([byPath.get(prefix + manifest.avatarFile)], { type: 'image/jpeg' })); } catch (e) { /* keep going */ }
        }
        if (withSettings && manifest.settings) {
          var keep = D.settings.lastBackup;
          D.settings = Object.assign({}, D.DEFAULT_SETTINGS, manifest.settings, { lastBackup: Math.max(keep || 0, manifest.settings.lastBackup || 0) });
          D.saveSettings();
          App.applySettings();
        }
        p.close();
        D.emit('games');
        Sound.good();
        UI.toast(countText(restoredList) + ' restored! Welcome back.', { type: 'good', sound: false });
        App.go('home');
      } catch (err) {
        p.close();
        UI.alert('Restore failed', err.message || String(err));
      }
    }
  }

  /* "3 games and 4 apps" */
  function countText(list) {
    var apps = list.filter(D.isApp).length;
    var games = list.length - apps;
    var parts = [];
    if (games || !apps) parts.push(games + ' game' + (games === 1 ? '' : 's'));
    if (apps) parts.push(apps + ' app' + (apps === 1 ? '' : 's'));
    return parts.join(' and ');
  }

  /* ---------------- build the Netlify folder ---------------- */
  async function buildSite() {
    var games = D.list();
    var ok = await UI.confirm('Build website folder',
      h('div',
        h('p', 'I\'ll make ONE zip with Game System 2.0 + ', h('b', countText(games)), ' inside. Put it on Netlify and your games work on any computer.'),
        h('p.small.muted', 'Saves are NOT included (they stay in each browser). Use a backup to move saves.')),
      { ok: 'Build it', icon: 'box' });
    if (!ok) return;
    var p = progressModal('Building your website', 'box');
    try {
      var files = [];
      var appFiles = GS2Shared.APP_FILES;
      for (var i = 0; i < appFiles.length; i++) {
        p.set('Copying Game System files… ' + (i + 1) + '/' + appFiles.length, i / appFiles.length * 0.3);
        var r = await fetch(appFiles[i], { cache: 'no-cache' });
        if (!r.ok) throw new Error('Couldn\'t get "' + appFiles[i] + '". You need to be online (on your Netlify site) to build the website folder.');
        files.push({ path: appFiles[i], data: await r.blob() });
      }
      var list = [];
      for (var j = 0; j < games.length; j++) {
        var g = games[j];
        p.set('Adding ' + g.name + '…', 0.3 + j / games.length * 0.4);
        var item = {
          id: g.id, name: g.name, desc: g.desc || '', emoji: g.emoji, color: g.color, folder: g.folder || '',
          rev: g.source === 'site' ? (g.siteRev || 1) : Math.floor((g.updated || g.created || Date.now()) / 1000),
          isolate: g.isolate !== false
        };
        if (D.isApp(g)) item.kind = 'app';
        if (g.win) item.win = g.win;
        if (g.linkMode) item.linkMode = g.linkMode;
        if (g.builtin) item.builtin = true;
        if (g.icon) item.icon = g.icon;
        if (g.kitAutosave) item.saveKit = true;
        if (g.source === 'link') {
          item.url = g.url;
        } else {
          await D.ensureLocalFiles(g);
          var recs = await GS2DB.filesOf(g.id);
          if (!recs.length) continue;
          item.entry = g.entry || 'index.html';
          item.files = recs.map(function (r2) { return r2.p; });
          item.size = recs.reduce(function (s, r2) { return s + r2.b.size; }, 0);
          recs.forEach(function (r2) { files.push({ path: 'games/' + g.id + '/' + r2.p, data: r2.b }); });
        }
        if (g.cover) {
          item.cover = '__gs2_cover.' + (g.cover.type === 'image/png' ? 'png' : 'jpg');
          files.push({ path: 'games/' + g.id + '/' + item.cover, data: g.cover });
        }
        list.push(item);
      }
      files.push({ path: 'games/games.json', data: JSON.stringify({ gs2: 1, built: Date.now(), games: list }, null, 1) });
      var zip = await GS2Zip.makeZip(files, function (n, total) { p.set('Zipping… ' + n + '/' + total, 0.7 + n / total * 0.3); });
      p.close();
      U.downloadBlob(zip, 'game-system-2-website.zip');
      Sound.good();
      UI.modal({
        title: 'Website folder ready!',
        icon: 'check',
        wide: true,
        body: h('div',
          h('p', 'Downloaded ', h('b', 'game-system-2-website.zip'), ' (' + U.fmtBytes(zip.size) + '). Now put it online:'),
          h('ol', { style: { lineHeight: '1.9', paddingLeft: '22px' } },
            h('li', 'Open your ', h('b', 'Downloads'), ' folder and find ', h('b', 'game-system-2-website.zip'), '.'),
            h('li', h('b', 'Right-click'), ' it → ', h('b', 'Extract All…'), ' → ', h('b', 'Extract'), '. Now you have a normal folder.'),
            h('li', 'Go to ', h('b', 'app.netlify.com'), ', click your site, then the ', h('b', 'Deploys'), ' tab.'),
            h('li', 'Drag the ', h('b', 'FOLDER'), ' (not the zip!) into the box that says "drag and drop your site folder here".'),
            h('li', 'Wait ~30 seconds, then open your site. All your games are there.')),
          h('p.small.muted', 'Netlify keeps your old versions too (in Deploys), so you can always go back if something looks wrong.'))
      });
    } catch (err) {
      p.close();
      UI.alert('Couldn\'t build it', err.message || String(err));
    }
  }

  window.Backup = { exportAll: exportAll, pickRestore: pickRestore, restoreFromEntries: restoreFromEntries, buildSite: buildSite };
})();
