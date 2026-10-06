/* Game System 2.0 — screens: Home, Library, Saves, Stats, Settings + game details + AI rules. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  function $(id) { return document.getElementById(id); }

  /* =====================================================================
     HOME
     ===================================================================== */
  var heroSaveCheck = 0;

  function renderHome() {
    var view = $('view-home');
    var games = D.list();
    if (!games.length) { view.replaceChildren(welcome()); App.setAccent(null); return; }
    var sel = D.get(D.ui.sel) || games[0];
    if (D.ui.sel !== sel.id) { D.ui.sel = sel.id; D.saveUISoon(); }

    var hero = h('section.hero');
    var rail = h('div.rail', { role: 'listbox', 'aria-label': 'Your games' });
    games.forEach(function (g) { rail.appendChild(tile(g, g.id === sel.id)); });
    rail.appendChild(h('button.tile.add', { title: 'Add games', onclick: function () { Importer.addDialog(); }, 'data-name': 'Add' },
      h('div', h('div.plus', '+'), 'ADD GAME')));
    rail.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { rail.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });

    var tipKey = U.escapeHtml(D.settings.hotkey || 'F2');
    view.replaceChildren(
      hero,
      h('div.rail-wrap',
        h('div.rail-head', h('h2', 'Your games'), h('span.count', String(games.length)),
          h('span.rail-hint', { html: '<kbd>←</kbd> <kbd>→</kbd> to pick · <kbd>Enter</kbd> to play · <kbd>' + tipKey + '</kbd> in-game menu' })),
        rail),
      homeStrip(games));
    fillHero(hero, sel);
    App.setAccentFor(sel);
    var selTile = rail.querySelector('.tile.sel');
    if (selTile) requestAnimationFrame(function () { selTile.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  }

  function tile(g, selected) {
    var t = h('button.tile' + (selected ? '.sel' : ''), {
      role: 'option',
      'aria-selected': selected ? 'true' : 'false',
      'aria-label': g.name,
      'data-name': g.name,
      'data-id': g.id,
      onclick: function () {
        if (D.ui.sel === g.id) { Player.launch(g.id); return; }
        selectGame(g.id);
      },
      ondblclick: function () { Player.launch(g.id); },
      onfocus: function () { if (D.ui.sel !== g.id) selectGame(g.id, true); },
      oncontextmenu: function (e) { e.preventDefault(); gameMenu(g.id, e.clientX, e.clientY); },
      onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); Player.launch(g.id); } }
    }, h('div.tile-in', UI.art(g, { noName: true })),
      g.fav ? h('span.fav-dot', { title: 'Favorite' }, I('starFill')) : null,
      g.source === 'site' ? h('span.site-dot', { title: 'Comes with the website' }, I('globe')) : null);
    return t;
  }

  function selectGame(id, fromFocus) {
    var g = D.get(id);
    if (!g) return;
    D.ui.sel = id;
    D.saveUISoon();
    var view = $('view-home');
    view.querySelectorAll('.tile').forEach(function (t) {
      var on = t.dataset.id === id;
      t.classList.toggle('sel', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var hero = view.querySelector('.hero');
    if (hero) fillHero(hero, g);
    App.setAccentFor(g);
    Sound.move();
    var t = view.querySelector('.tile[data-id="' + id + '"]');
    if (t && !fromFocus) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    else if (t) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function fillHero(hero, g) {
    var check = ++heroSaveCheck;
    var bg = h('div.hero-bg', g.cover ? h('img', { src: D.coverUrl(g), alt: '' }) : h('div.hb-fill', { style: { background: 'radial-gradient(circle at 70% 40%, ' + (g.color || '#00e5ff') + ', transparent 60%)' } }));
    var badges = h('div.badges',
      g.folder ? h('span.badge', I('folder'), g.folder) : null,
      g.source === 'site' ? h('span.badge.acc', I('globe'), 'On website') : null,
      g.source === 'link' ? h('span.badge', I('link'), 'Link') : null,
      !g.lastPlayed ? h('span.badge.hot', 'NEW') : null,
      g.kitAutosave ? h('span.badge.good', I('save'), 'Auto-saves') : null);
    var playLabel = h('span', 'PLAY');
    var playBtn = h('button.btn.primary.play-btn', { onclick: function () { Player.launch(g.id); }, 'data-autofocus': true }, UI.icon('play'), playLabel);
    var favBtn = h('button.icon-btn' + (g.fav ? '.fav-on' : ''), { title: g.fav ? 'Unfavorite' : 'Favorite', 'aria-label': 'Favorite', onclick: async function () {
      await D.updateGame(g.id, { fav: !g.fav });
      Sound.select();
    } }, UI.icon('star'));
    var editBtn = g.source !== 'link' ? h('button.icon-btn', { title: 'Edit code', 'aria-label': 'Edit code', onclick: function () { Editor.open(g.id); } }, UI.icon('edit')) : null;
    var moreBtn = h('button.icon-btn', { title: 'More options', 'aria-label': 'More options', onclick: function () { gameDetails(g.id); } }, UI.icon('more'));
    var artCard = h('div.art-card', UI.art(g), h('div.glare'));
    UI.tilt(artCard, 8);
    hero.replaceChildren(bg,
      h('div.hero-info',
        badges,
        h('h1.hero-title', g.name),
        g.desc ? h('p.hero-desc', g.desc) : null,
        h('div.meta',
          h('span', I('clock'), h('b', U.fmtDuration((g.playTime || 0) + (D.pendingPlay[g.id] || 0))), ' played'),
          h('span', I('gamepad'), h('b', String(g.launches || 0)), (g.launches === 1 ? ' launch' : ' launches')),
          h('span', I('calendar'), g.lastPlayed ? U.timeAgo(g.lastPlayed) : 'never played')),
        h('div.hero-actions', playBtn, favBtn, editBtn, moreBtn)),
      h('div.hero-art', artCard));
    if (g.source !== 'link') {
      D.latestSave(g.id).then(function (s) {
        if (check !== heroSaveCheck || !s) return;
        playLabel.textContent = 'CONTINUE';
        playBtn.title = 'Progress saved ' + U.timeAgo(s.t);
      });
    }
  }

  function homeStrip(games) {
    var items = [];
    var backupAge = D.settings.lastBackup ? Date.now() - D.settings.lastBackup : Infinity;
    if (D.settings.backupNag && games.length && backupAge > 7 * 86400000) {
      items.push(h('button.mini-card', { onclick: function () { Backup.exportAll(); } },
        h('span.mc-ico', I('lifebuoy')), h('div', h('b', D.settings.lastBackup ? 'Back up your games' : 'Make your first backup'),
          h('span', D.settings.lastBackup ? 'Last backup ' + U.timeAgo(D.settings.lastBackup) : 'So you never lose your games'))));
    }
    items.push(h('button.mini-card', { onclick: function () { Importer.addDialog(); } },
      h('span.mc-ico', I('plus')), h('div', h('b', 'Add games'), h('span', 'Files, zips, folders or pasted code'))));
    items.push(h('button.mini-card', { onclick: function () { aiRules(); } },
      h('span.mc-ico', I('sparkle')), h('div', h('b', 'Rules for AI games'), h('span', 'Copy this to any AI so its games work + save'))));
    items.push(h('button.mini-card', { onclick: function () { App.go('library'); } },
      h('span.mc-ico', I('library')), h('div', h('b', 'Library'), h('span', games.length + ' game' + (games.length === 1 ? '' : 's') + ' · search, folders, favorites'))));
    return h('div.home-strip', items);
  }

  function welcome() {
    var dz = h('div.dropzone', { tabindex: 0, role: 'button', onclick: function () { Importer.pickFiles(); }, onkeydown: function (e) { if (e.key === 'Enter') Importer.pickFiles(); } },
      h('div.dz-icon', I('inbox')), h('div.dz-title', 'Drop your games right here'), h('div.dz-sub', '.html files · .zip files · whole folders'));
    return h('div.welcome',
      h('h1', 'Yo ', h('span.acc', D.settings.name || 'bro'), ', welcome to', h('br'), 'Game System ', h('span.acc', '2.0')),
      h('p.lead', 'Your games, one badass system. Let\'s fill it up.'),
      dz,
      h('div.row',
        h('button.btn.primary', { onclick: function () { Importer.importOldFolder(); } }, I('folder'), 'Import my old games'),
        h('button.btn', { onclick: function () { Importer.pasteDialog(); } }, I('code'), 'Paste game code'),
        h('button.btn', { onclick: function () { aiRules(); } }, I('sparkle'), 'Rules for AI games'),
        h('button.btn', { onclick: function () { Backup.pickRestore(); } }, I('download'), 'Restore a backup')));
  }

  /* =====================================================================
     GAME DETAILS + MENUS
     ===================================================================== */
  function gameMenu(id, x, y) {
    var g = D.get(id);
    if (!g) return;
    UI.contextMenu(x, y, [
      { icon: 'play', label: 'Play', onClick: function () { Player.launch(id); } },
      g.source !== 'link' ? { icon: 'code', label: 'Edit code', onClick: function () { Editor.open(id); } } : null,
      { icon: g.fav ? 'star' : 'starFill', label: g.fav ? 'Unfavorite' : 'Favorite', onClick: function () { D.updateGame(id, { fav: !g.fav }); } },
      { icon: 'tag', label: 'Rename', onClick: function () { renameGame(id); } },
      { icon: 'folder', label: 'Move to folder', onClick: function () { moveToFolder([id]); } },
      { icon: 'more', label: 'Details & more', onClick: function () { gameDetails(id); } },
      'sep',
      { icon: 'trash', label: 'Delete', danger: true, onClick: function () { deleteGames([id]); } }
    ]);
  }

  async function renameGame(id) {
    var g = D.get(id);
    var n = await UI.prompt('Rename game', 'Name', g.name, { ok: 'Rename', max: 80 });
    if (n) await D.updateGame(id, { name: n });
  }

  async function moveToFolder(ids) {
    var folders = D.folders();
    var input = h('input.input', { placeholder: 'Folder name (leave empty for no folder)', list: 'gs2-folder-list', maxlength: 40 });
    var first = D.get(ids[0]);
    input.value = ids.length === 1 && first ? first.folder || '' : '';
    var done = false;
    return new Promise(function (resolve) {
      var m = UI.modal({
        title: 'Move to folder',
        icon: 'folder',
        body: h('div',
          folders.length ? h('div.chips', folders.map(function (f) { return h('button.chip', { onclick: function () { input.value = f.name; } }, f.name); })) : null,
          h('div.field', h('label', 'Folder'), input, h('datalist#gs2-folder-list', folders.map(function (f) { return h('option', { value: f.name }); })))),
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Move', kind: 'primary', onClick: async function () {
          done = true;
          for (var i = 0; i < ids.length; i++) await D.updateGame(ids[i], { folder: input.value.trim().slice(0, 40) });
          UI.toast(ids.length === 1 ? 'Moved!' : 'Moved ' + ids.length + ' games', { icon: 'folder', sound: false });
          resolve(true);
        } }],
        onClose: function () { if (!done) resolve(false); }
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { m.el.querySelector('.modal-foot .btn.primary').click(); } });
    });
  }

  async function deleteGames(ids) {
    var names = ids.map(function (id) { var g = D.get(id); return g ? g.name : id; });
    var ok = await UI.confirm(ids.length === 1 ? 'Delete "' + names[0] + '"?' : 'Delete ' + ids.length + ' games?',
      h('div', h('p', 'This removes ' + (ids.length === 1 ? 'the game, its saves and its stats' : 'these games, their saves and their stats') + ' from Game System. Can\'t undo!'),
        h('p.small.muted', 'Want to be safe? Make a backup first (Settings → Back up everything).')),
      { ok: 'Delete', danger: true, icon: 'trash' });
    if (!ok) return false;
    for (var i = 0; i < ids.length; i++) {
      if (Editor.currentId() === ids[i]) { await Editor.close(); }
      await D.deleteGame(ids[i]);
    }
    Sound.back();
    UI.toast(ids.length === 1 ? '"' + names[0] + '" deleted' : ids.length + ' games deleted', { icon: 'trash', sound: false });
    return true;
  }

  async function gameDetails(id) {
    var g = D.get(id);
    if (!g) return;
    var save = g.source === 'link' ? null : await D.latestSave(id);
    var keys = D.storageKeys(id);
    var isolateSw = h('label.switch', h('input', { type: 'checkbox', checked: g.isolate !== false, onchange: function (e) { D.updateGame(id, { isolate: e.target.checked }); } }), h('i'));
    var m = UI.modal({
      title: g.emoji + ' ' + g.name,
      wide: true,
      body: h('div',
        h('div.det-top',
          h('div.det-art', UI.art(g)),
          h('div',
            g.desc ? h('p', g.desc) : h('p.muted', 'No description yet.'),
            h('div.det-stats',
              stat(U.fmtDuration((g.playTime || 0) + (D.pendingPlay[id] || 0)), 'Played'),
              stat(String(g.launches || 0), 'Launches'),
              stat(g.lastPlayed ? U.timeAgo(g.lastPlayed) : 'Never', 'Last played'),
              g.source !== 'link' ? stat(U.fmtBytes(g.size), (g.fileCount || 0) + ' files') : stat('Link', g.url ? new URL(g.url).hostname : '')),
            h('p.small.muted', I('save'), ' ', save ? 'Resume point saved ' + U.timeAgo(save.t) + ' (' + U.fmtBytes(save.size || 0) + ')' : (g.kitAutosave ? 'Uses the Save Kit' : 'No resume point yet'),
              keys.length ? ' · ' + keys.length + ' saved value' + (keys.length === 1 ? '' : 's') : ''))),
        h('div.hr'),
        h('div.act-grid',
          h('button.btn.primary', { onclick: function () { m.close(); Player.launch(id); } }, UI.icon('play'), 'Play'),
          g.source !== 'link' ? h('button.btn', { onclick: function () { m.close(); Editor.open(id); } }, UI.icon('code'), 'Edit code') : null,
          h('button.btn', { onclick: function () { m.close(); renameGame(id); } }, I('tag'), 'Rename'),
          h('button.btn', { onclick: async function () { var e = await UI.pickEmoji(g.emoji); if (e) { await D.updateGame(id, { emoji: e }); m.close(); gameDetails(id); } } }, I('smile'), 'Change icon'),
          h('button.btn', { onclick: function () { pickCover(id, m); } }, UI.icon('image'), 'Change cover'),
          g.cover ? h('button.btn', { onclick: async function () { await D.setCover(id, null); m.close(); gameDetails(id); } }, I('x'), 'Remove cover') : null,
          h('button.btn', { onclick: async function () {
            var d = await UI.prompt('Description', 'What is this game about?', g.desc || '', { ok: 'Save', max: 600 });
            if (d !== null) { await D.updateGame(id, { desc: d }); m.close(); gameDetails(id); }
          } }, I('text'), 'Description'),
          h('button.btn', { onclick: function () { m.close(); moveToFolder([id]); } }, UI.icon('folder'), 'Folder'),
          h('button.btn' + (g.fav ? '.fav-on' : ''), { onclick: async function () { await D.updateGame(id, { fav: !g.fav }); m.close(); gameDetails(id); } }, I(g.fav ? 'starFill' : 'star'), g.fav ? 'Unfavorite' : 'Favorite'),
          g.source !== 'link' ? h('button.btn', { onclick: function () { m.close(); updateFiles(id); } }, UI.icon('upload'), 'Update game files') : null,
          g.source !== 'link' ? h('button.btn', { onclick: function () { downloadGame(id); } }, UI.icon('download'), 'Download game') : null,
          h('button.btn', { onclick: async function () { m.close(); var c = await D.duplicateGame(id); if (c) { D.ui.sel = c.id; App.refresh(); UI.toast('Made a copy', { icon: 'copy' }); } } }, UI.icon('copy'), 'Duplicate'),
          g.source !== 'link' ? h('button.btn', { onclick: function () { m.close(); App.go('saves'); setTimeout(function () { viewSaves(id); }, 200); } }, UI.icon('save'), 'Saves') : null,
          h('button.btn.danger', { onclick: async function () { if (await deleteGames([id])) m.close(); } }, UI.icon('trash'), 'Delete')),
        g.source !== 'link' ? h('div', h('div.hr'),
          h('div.set-row', h('div.st', h('b', I('lock'), ' Private saves'), h('span', 'Keeps this game\'s saves separate from other games. Turn off only if an old game can\'t find its saves.')), isolateSw)) : null,
        g.source === 'site' ? h('p.small.muted', { style: { marginTop: '10px' } }, I('globe'), ' This game comes with your website. If you edit it, it becomes your own copy.') : null)
    });
  }
  function stat(v, l) { return h('div.stat-box', h('div.sv', v), h('div.sl', l)); }

  function pickCover(id, m) {
    var input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', async function () {
      var f = input.files[0];
      input.remove();
      if (!f) return;
      try {
        await D.setCover(id, f);
        Sound.good();
        UI.toast('New cover set!', { type: 'good', icon: 'image', sound: false });
        if (m) { m.close(); gameDetails(id); }
      } catch (e) { UI.toast(e.message, { type: 'bad' }); }
    });
    input.click();
  }

  function updateFiles(id) {
    var g = D.get(id);
    UI.modal({
      title: 'Update "' + g.name + '"',
      icon: 'upload',
      body: h('div', h('p', 'Got a new version of this game (like a fixed file from the AI)? Pick it and I\'ll swap the files.'),
        h('p.small.muted', 'Your saves, play time and cover stay.')),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Pick a folder', icon: 'folder', onClick: function () { pick(true); } },
        { label: 'Pick file(s)', icon: 'file', kind: 'primary', onClick: function () { pick(false); } }
      ]
    });
    function pick(folder) {
      Importer.pickFiles({ folder: folder, onPick: async function (list) {
        try {
          var res = await Importer.detect(await expand(list), {});
          var game = res.games.filter(function (x) { return !x.launcher; })[0] || res.games[0];
          if (!game) { UI.alert('No game found', res.note || 'There\'s no .html file in there.'); return; }
          await D.replaceFiles(id, game.files.map(function (f) { return { p: f.path, b: f.file, t: U.mimeOf(f.path) }; }), game.entry);
          Sound.good();
          UI.toast('"' + g.name + '" updated! Saves kept.', { type: 'good', sound: false });
        } catch (e) { UI.alert('Update failed', e.message || String(e)); }
      } });
    }
    async function expand(list) {
      var out = [];
      for (var i = 0; i < list.length; i++) {
        if (/\.zip$/i.test(list[i].path)) {
          var inner = await GS2Zip.readZip(list[i].file);
          inner.forEach(function (z) { out.push({ path: z.path, file: z.blob }); });
        } else out.push(list[i]);
      }
      return out;
    }
  }

  async function downloadGame(id) {
    var g = D.get(id);
    try {
      await D.ensureLocalFiles(g);
      var files = await GS2DB.filesOf(id);
      if (files.length === 1 && U.isHtml(files[0].p)) {
        U.downloadBlob(files[0].b, U.slug(g.name) + '.html');
      } else {
        var zip = await GS2Zip.makeZip(files.map(function (f) { return { path: f.p, data: f.b }; }));
        U.downloadBlob(zip, U.slug(g.name) + '.zip');
      }
    } catch (e) { UI.alert('Download failed', e.message); }
  }

  /* =====================================================================
     LIBRARY
     ===================================================================== */
  var selectMode = false;
  var selected = new Set();

  function renderLibrary() {
    var view = $('view-library');
    var lib = D.ui.lib;
    var all = D.list();
    var sorters = {
      recent: null,
      name: function (a, b) { return a.name.localeCompare(b.name); },
      most: function (a, b) { return (b.playTime || 0) - (a.playTime || 0); },
      new: function (a, b) { return (b.created || 0) - (a.created || 0); },
      size: function (a, b) { return (b.size || 0) - (a.size || 0); }
    };
    function filtered() {
      var q = (lib.q || '').trim().toLowerCase();
      var list = all.filter(function (g) {
        if (lib.folder === 'fav' && !g.fav) return false;
        if (lib.folder === 'none' && g.folder) return false;
        if (lib.folder && lib.folder.indexOf('f:') === 0 && g.folder !== lib.folder.slice(2)) return false;
        if (q && (g.name + ' ' + (g.desc || '') + ' ' + (g.folder || '')).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      if (sorters[lib.sort]) list.sort(sorters[lib.sort]);
      return list;
    }

    var search = h('input.input', { type: 'search', placeholder: 'Search your games…', value: lib.q || '', id: 'lib-search', 'aria-label': 'Search games' });
    search.value = lib.q || '';
    search.addEventListener('input', U.debounce(function () { lib.q = search.value; D.saveUISoon(); renderGrid(); }, 120));
    var sortSel = h('select.select', { style: { width: 'auto' }, 'aria-label': 'Sort', onchange: function () { lib.sort = sortSel.value; D.saveUISoon(); renderLibrary(); } },
      h('option', { value: 'recent' }, 'Recently played'),
      h('option', { value: 'name' }, 'Name A → Z'),
      h('option', { value: 'most' }, 'Most played'),
      h('option', { value: 'new' }, 'Newest added'),
      h('option', { value: 'size' }, 'Biggest'));
    sortSel.value = lib.sort || 'recent';

    var folders = D.folders();
    var favCount = all.filter(function (g) { return g.fav; }).length;
    var noneCount = all.filter(function (g) { return !g.folder; }).length;
    function chip(key, label, n) {
      return h('button.chip' + ((lib.folder || 'all') === key ? '.on' : ''), { onclick: function () { lib.folder = key; D.saveUISoon(); renderLibrary(); } }, label, h('span.n', String(n)));
    }
    var chips = h('div.chips',
      chip('all', [I('gamepad'), 'All'], all.length),
      chip('fav', [I('star'), 'Favorites'], favCount),
      folders.map(function (f) { return chip('f:' + f.name, [I('folder'), f.name], f.count); }),
      folders.length ? chip('none', 'No folder', noneCount) : null);

    var grid = h('div.grid');
    var bulk = h('div.bulkbar', { hidden: !selectMode });

    function renderGrid() {
      var list = filtered();
      grid.replaceChildren();
      if (!list.length) {
        grid.appendChild(h('div.empty-note', { style: { gridColumn: '1 / -1' } }, h('span.big', I(all.length ? 'search' : 'gamepad')),
          all.length ? 'No games match that. Try another search.' : 'No games yet. Hit "Add" to bring some in!'));
        return;
      }
      list.forEach(function (g) { grid.appendChild(card(g)); });
    }

    function card(g) {
      var isSel = selected.has(g.id);
      var c = h('button.card' + (isSel ? '.selected' : ''), {
        'aria-label': g.name,
        onclick: function () {
          if (selectMode) { toggleSel(g.id, c); return; }
          D.ui.sel = g.id;
          Player.launch(g.id);
        },
        oncontextmenu: function (e) { e.preventDefault(); gameMenu(g.id, e.clientX, e.clientY); }
      },
        selectMode ? h('span.check', isSel ? I('check') : null) : null,
        h('div.card-flags', g.fav ? h('span', { title: 'Favorite' }, I('starFill')) : null, g.source === 'site' ? h('span', { title: 'On your website' }, I('globe')) : null, g.source === 'link' ? h('span', { title: 'Link' }, I('link')) : null),
        h('div.card-art', UI.art(g, { lazy: true, noName: true })),
        h('span.card-play', UI.icon('play')),
        h('div.card-body',
          h('div.card-name', g.name),
          h('div.card-meta', h('span', I('clock'), ' ' + U.fmtDuration((g.playTime || 0) + (D.pendingPlay[g.id] || 0))), h('span', g.lastPlayed ? U.timeAgo(g.lastPlayed) : 'new'))));
      UI.tilt(c, 6);
      c.addEventListener('mouseleave', function () { c.style.transform = ''; });
      return c;
    }

    function toggleSel(id, c) {
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      c.classList.toggle('selected', selected.has(id));
      var chk = c.querySelector('.check');
      if (chk) chk.replaceChildren(selected.has(id) ? I('check') : '');
      renderBulk();
    }
    function renderBulk() {
      bulk.hidden = !selectMode;
      var ids = Array.from(selected).filter(function (id) { return D.get(id); });
      bulk.replaceChildren(
        h('b', ids.length + ' selected'),
        h('button.btn.sm', { onclick: function () { filtered().forEach(function (g) { selected.add(g.id); }); renderLibrary(); } }, 'Select all'),
        h('div.grow'),
        h('button.btn.sm', { disabled: !ids.length, onclick: async function () { if (await moveToFolder(ids)) { renderLibrary(); } } }, I('folder'), 'Move'),
        h('button.btn.sm', { disabled: !ids.length, onclick: async function () { for (var i = 0; i < ids.length; i++) await D.updateGame(ids[i], { fav: true }); } }, I('star'), 'Favorite'),
        h('button.btn.sm', { disabled: !ids.length, onclick: function () { Backup.exportAll(ids); } }, I('lifebuoy'), 'Back up these'),
        h('button.btn.sm.danger', { disabled: !ids.length, onclick: async function () { if (await deleteGames(ids)) { selected.clear(); renderLibrary(); } } }, I('trash'), 'Delete'),
        h('button.btn.sm.ghost', { onclick: function () { selectMode = false; selected.clear(); renderLibrary(); } }, 'Done'));
    }

    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Library'),
      h('p.page-sub', all.length + ' game' + (all.length === 1 ? '' : 's') + ' · right-click a game for options'),
      h('div.lib-toolbar',
        h('div.search', UI.icon('search'), search),
        sortSel,
        h('button.btn' + (selectMode ? '.on' : ''), { onclick: function () { selectMode = !selectMode; selected.clear(); renderLibrary(); } }, I('selectAll'), 'Select'),
        h('button.btn.primary', { onclick: function () { Importer.addDialog(); } }, UI.icon('plus'), 'Add')),
      chips, grid, bulk));
    renderGrid();
    if (selectMode) renderBulk();
  }

  /* =====================================================================
     SAVES
     ===================================================================== */
  async function renderSaves() {
    var view = $('view-saves');
    var games = D.list().filter(function (g) { return g.source !== 'link'; });
    var rows = [];
    for (var i = 0; i < games.length; i++) {
      var g = games[i];
      var save = await D.latestSave(g.id);
      var keys = D.storageKeys(g.id);
      var dbs = await D.gameDatabases(g.id);
      rows.push({ g: g, save: save, keys: keys, dbs: dbs, size: (save ? save.size || 0 : 0) + keys.reduce(function (s, k) { return s + k.size; }, 0) });
    }
    var withSaves = rows.filter(function (r) { return r.save || r.keys.length || r.dbs.length; });
    var without = rows.length - withSaves.length;
    var meter = h('div');
    storageMeter(meter);

    var list = h('div');
    if (!withSaves.length) list.appendChild(h('div.empty-note', h('span.big', I('save')), 'No saves yet. Play some games and they\'ll show up here.'));
    withSaves.forEach(function (r) {
      list.appendChild(h('div.save-row',
        h('div.sr-art', UI.art(r.g, { noName: true })),
        h('div',
          h('div.sr-name', r.g.name),
          h('div.sr-info',
            r.save ? h('span', I('resume'), ' Resume point · ' + U.timeAgo(r.save.t)) : null,
            r.keys.length ? h('span', I('key'), ' ' + r.keys.length + ' saved value' + (r.keys.length === 1 ? '' : 's')) : null,
            r.dbs.length ? h('span', I('database'), ' ' + r.dbs.length + ' database' + (r.dbs.length === 1 ? '' : 's')) : null,
            h('span', I('box'), ' ' + U.fmtBytes(r.size)))),
        h('div.row',
          h('button.btn.sm', { onclick: function () { viewSaves(r.g.id); } }, I('eye'), 'View'),
          h('button.btn.sm', { onclick: function () { exportSaves(r.g.id); } }, UI.icon('download'), 'Export'),
          h('button.btn.sm.danger', { onclick: async function () {
            if (await UI.confirm('Wipe saves?', 'Delete ALL saves for "' + r.g.name + '"? The game will start from zero. Can\'t undo!', { ok: 'Wipe saves', danger: true })) {
              await D.wipeSaves(r.g.id, true);
              UI.toast('Saves wiped for ' + r.g.name, { icon: 'trash' });
              renderSaves();
            }
          } }, UI.icon('trash')))));
    });

    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Saves'),
      h('p.page-sub', 'Every game keeps its own saves. Back them up, move them, or wipe them.'),
      h('div.panel', h('h3', I('lifebuoy'), 'Backups'),
        h('p.muted', { style: { marginTop: 0 } }, 'A backup is one file with ALL your games + saves + stats. Keep it somewhere safe (Google Drive, USB stick…) so you never lose anything.'),
        meter,
        h('div.row', { style: { marginTop: '12px' } },
          h('button.btn.primary', { onclick: function () { Backup.exportAll(); } }, I('lifebuoy'), 'Back up everything'),
          h('button.btn', { onclick: function () { Backup.pickRestore(); } }, I('download'), 'Restore a backup'),
          h('button.btn', { onclick: function () { pickSaveFile(); } }, I('upload'), 'Import a save file'),
          h('span.small.muted', D.settings.lastBackup ? 'Last backup: ' + U.timeAgo(D.settings.lastBackup) : 'You haven\'t made a backup yet'))),
      h('div', { style: { height: '18px' } }),
      list,
      without ? h('p.small.muted', { style: { marginTop: '14px' } }, without + ' other game' + (without === 1 ? ' has' : 's have') + ' no saves yet.') : null));
  }

  async function storageMeter(box) {
    if (!navigator.storage || !navigator.storage.estimate) return;
    try {
      var est = await navigator.storage.estimate();
      var persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      var pct = est.quota ? Math.min(100, (est.usage / est.quota) * 100) : 0;
      box.replaceChildren(
        h('div.small.muted', I('database'), ' Using ' + U.fmtBytes(est.usage || 0) + ' of ' + U.fmtBytes(est.quota || 0) + ' your browser lets us use'),
        h('div.meter', h('i', { style: { width: Math.max(1, pct).toFixed(1) + '%' } })),
        h('div.small', persisted ? h('span', { style: { color: 'var(--good)' } }, I('lock'), ' Protected: your browser won\'t delete these games to save space.') :
          h('span.muted', I('warn'), ' Not protected yet. ', h('a', { href: '#', onclick: async function (e) {
            e.preventDefault();
            var ok = navigator.storage.persist ? await navigator.storage.persist() : false;
            UI.toast(ok ? 'Protected!' : 'Your browser said no for now. Install Game System as an app (Settings) or play more and try again.', { type: ok ? 'good' : 'warn' });
            storageMeter(box);
          } }, 'Protect my games'))));
    } catch (e) { /* ignore */ }
  }

  async function viewSaves(id) {
    var g = D.get(id);
    if (!g) return;
    var save = await D.latestSave(id);
    var keys = D.storageKeys(id);
    var table = h('table.kv-table', h('thead', h('tr', h('th', 'Name'), h('th', 'Value'), h('th', ''))));
    var tb = h('tbody');
    keys.forEach(function (k) {
      var v = localStorage.getItem(k.real) || '';
      tb.appendChild(h('tr', h('td.k', k.key), h('td.v', h('div', v.length > 300 ? v.slice(0, 300) + '…' : v)),
        h('td', h('div.row', { style: { flexWrap: 'nowrap' } },
          h('button.btn.sm', { title: 'Edit', 'aria-label': 'Edit', onclick: function () { editValue(id, k); m.close(); } }, I('edit')),
          h('button.btn.sm.danger', { title: 'Delete', 'aria-label': 'Delete', onclick: function () { localStorage.removeItem(k.real); m.close(); viewSaves(id); } }, I('trash'))))));
    });
    table.appendChild(tb);
    var m = UI.modal({
      title: g.name + ' saves',
      icon: 'save',
      wide: true,
      body: h('div',
        h('h4', I('resume'), ' Resume point (Save Kit)'),
        save ? h('div', h('p.small.muted', 'Saved ' + U.timeAgo(save.t) + ' · ' + U.fmtBytes(save.size || (save.data || '').length)),
          h('div.code-box', prettyJson(save.data).slice(0, 6000)),
          h('div.row', { style: { marginTop: '8px' } },
            h('button.btn.sm', { onclick: function () { editResume(id, save); m.close(); } }, I('edit'), 'Edit'),
            h('button.btn.sm.danger', { onclick: async function () { await D.deleteSave(id); m.close(); viewSaves(id); renderSaves(); } }, I('trash'), 'Delete resume point')))
          : h('p.muted', g.kitAutosave ? 'No resume point right now.' : 'This game doesn\'t use the Save Kit (yet).'),
        h('div.hr'),
        h('h4', I('key'), ' Saved values (the game\'s own saves)'),
        keys.length ? table : h('p.muted', 'None.')),
      actions: [{ label: 'Export', onClick: function () { exportSaves(id); return false; } }, { label: 'Import', onClick: function () { pickSaveFile(id); } }, { label: 'Close', kind: 'primary' }]
    });
  }
  function prettyJson(s) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch (e) { return String(s); } }

  function editValue(id, k) {
    var ta = h('textarea.input', { style: { minHeight: '220px' } });
    ta.value = localStorage.getItem(k.real) || '';
    UI.modal({
      title: k.key,
      icon: 'edit',
      wide: true,
      body: h('div', h('p.small.muted', 'Cheat mode: change the value and hit save. Careful, a typo can break the save!'), ta),
      actions: [{ label: 'Cancel', kind: 'ghost', onClick: function () { viewSaves(id); } }, { label: 'Save', kind: 'primary', onClick: function () {
        try { localStorage.setItem(k.real, ta.value); UI.toast('Saved. Hope you gave yourself a lot of money.', { icon: 'check' }); }
        catch (e) { UI.toast('Couldn\'t save: ' + e.message, { type: 'bad' }); }
        viewSaves(id);
      } }]
    });
  }
  function editResume(id, save) {
    var ta = h('textarea.input', { style: { minHeight: '300px' } });
    ta.value = prettyJson(save.data);
    UI.modal({
      title: 'Resume point',
      icon: 'edit',
      wide: true,
      body: h('div', h('p.small.muted', 'Cheat mode: edit the saved game state. It has to stay valid JSON.'), ta),
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async function () {
        var parsed;
        try { parsed = JSON.parse(ta.value); } catch (e) { UI.toast('That\'s not valid JSON: ' + e.message, { type: 'bad' }); return false; }
        await D.putSave(id, JSON.stringify(parsed), Date.now());
        UI.toast('Resume point updated', { type: 'good' });
        viewSaves(id);
      } }]
    });
  }

  async function exportSaves(id) {
    var g = D.get(id);
    var obj = await D.exportSaves(id);
    U.downloadBlob(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), U.slug(g ? g.name : id) + '-saves.json');
  }
  function pickSaveFile(forId) {
    var input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', async function () {
      var f = input.files[0];
      input.remove();
      if (!f) return;
      try { importSaveFile(JSON.parse(await f.text()), forId); }
      catch (e) { UI.alert('Not a save file', 'That file isn\'t a Game System save file.'); }
    });
    input.click();
  }
  function importSaveFile(obj, forId) {
    if (!obj || obj.gs2saves !== 1) { UI.alert('Not a save file', 'That file isn\'t a Game System save file.'); return; }
    var games = D.list().filter(function (g) { return g.source !== 'link'; });
    if (!games.length) { UI.alert('No games', 'Add the game first, then import its saves.'); return; }
    var sel = h('select.select', games.map(function (g) { return h('option', { value: g.id }, g.name); }));
    var guess = forId || (D.get(obj.id) ? obj.id : (D.findByName(obj.game) || {}).id);
    if (guess) sel.value = guess;
    UI.modal({
      title: 'Import saves',
      icon: 'upload',
      body: h('div', h('p', 'Saves from "' + (obj.game || '?') + '". Which game should get them?'), sel,
        h('p.small.muted', { style: { marginTop: '10px' } }, 'Existing saves with the same names get replaced.')),
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Import', kind: 'primary', onClick: async function () {
        await D.importSaves(sel.value, obj);
        UI.toast('Saves imported!', { type: 'good' });
        if (D.ui.view === 'saves') renderSaves();
      } }]
    });
  }

  /* =====================================================================
     STATS
     ===================================================================== */
  function renderStats() {
    var view = $('view-stats');
    var games = D.list();
    var total = 0, launches = 0;
    games.forEach(function (g) { total += (g.playTime || 0) + (D.pendingPlay[g.id] || 0); launches += g.launches || 0; });
    var top = games.slice().sort(function (a, b) { return ((b.playTime || 0) + (D.pendingPlay[b.id] || 0)) - ((a.playTime || 0) + (D.pendingPlay[a.id] || 0)); })
      .filter(function (g) { return (g.playTime || 0) + (D.pendingPlay[g.id] || 0) > 0; }).slice(0, 10);

    /* last 14 days */
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      var key = U.dayKey(d.getTime());
      var rec = D.days[key] || {};
      var ms = Object.keys(rec).reduce(function (s, k) { return s + rec[k]; }, 0);
      if (i === 0) Object.keys(D.pendingPlay).forEach(function (k) { ms += D.pendingPlay[k]; });
      days.push({ key: key, d: d, ms: ms, today: i === 0 });
    }
    var maxDay = Math.max.apply(null, days.map(function (x) { return x.ms; }).concat([1]));

    var streak = 0;
    for (var s = days.length - 1; s >= 0; s--) {
      if (days[s].ms > 60000) streak++;
      else if (!days[s].today) break;
    }

    var maxTop = top.length ? (top[0].playTime || 0) + (D.pendingPlay[top[0].id] || 0) : 1;
    var fav = top[0];

    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Stats'),
      h('p.page-sub', 'How much you\'ve been playing, ' + (D.settings.name || 'bro') + '.'),
      h('div.stat-hero',
        bigStat('clock', U.fmtDuration(total), 'Total play time'),
        bigStat('gamepad', String(games.length), 'Games'),
        bigStat('play', String(launches), 'Times launched'),
        bigStat('flame', streak + (streak === 1 ? ' day' : ' days'), 'Playing streak'),
        bigStat('trophy', fav ? fav.name : '—', 'Most played')),
      h('div.panel',
        h('h3', I('calendar'), 'Play time · last 14 days'),
        h('div.days', days.map(function (x) {
          var pct = x.ms ? Math.max(3, (x.ms / maxDay) * 100) : 0;
          return h('div.day' + (x.today ? '.today' : ''),
            h('div.dc' + (x.ms ? '' : '.zero'), { style: { height: (x.ms ? pct : 1.5) + '%' }, 'data-tip': x.d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + U.fmtDuration(x.ms, true), tabindex: 0, 'aria-label': x.key + ': ' + U.fmtDuration(x.ms, true) }),
            h('div.dl', x.today ? 'Today' : x.d.toLocaleDateString(undefined, { weekday: 'narrow' }) + ' ' + x.d.getDate()));
        }))),
      h('div.panel',
        h('h3', I('trophy'), 'Most played games'),
        top.length ? h('div.bars', top.map(function (g, idx) {
          var ms = (g.playTime || 0) + (D.pendingPlay[g.id] || 0);
          return h('div.bar-row',
            h('span.rank' + (idx < 3 ? '.top' : ''), '#' + (idx + 1)),
            h('span.bn', { title: g.name }, g.name),
            h('div', h('div.bt', { style: { width: Math.max(1, (ms / maxTop) * 100) + '%' }, title: g.name + ': ' + U.fmtDuration(ms, true) })),
            h('span.bvv', U.fmtDuration(ms)));
        })) : h('p.muted', 'Play some games and your top games show up here.'))));
  }
  function bigStat(ic, v, l) { return h('div.big-stat', h('div.be', I(ic)), h('div.bv', { title: v }, v), h('div.bl', l)); }

  /* =====================================================================
     SETTINGS
     ===================================================================== */
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; if (D.ui.view === 'settings') renderSettings(); });

  function seg(options, value, onPick) {
    var el = h('div.seg');
    options.forEach(function (o) {
      el.appendChild(h('button' + (o[0] === value ? '.on' : ''), {
        onclick: function () {
          el.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
          this.classList.add('on');
          Sound.select();
          onPick(o[0]);
        }
      }, o[1]));
    });
    return el;
  }
  function sw(checked, onChange) {
    return h('label.switch', h('input', { type: 'checkbox', checked: !!checked, onchange: function (e) { onChange(e.target.checked); Sound.select(); } }), h('i'));
  }
  function setRow(title, sub, control) { return h('div.set-row', h('div.st', h('b', title), sub ? h('span', sub) : null), control); }
  function set(key, val) { D.settings[key] = val; D.saveSettings(); App.applySettings(); }

  var ACCENTS = [['#00e5ff', '#ff2bd6'], ['#3dffa0', '#00b3ff'], ['#ffcc00', '#ff3d6e'], ['#b26bff', '#00e5ff'], ['#ff6a00', '#ff2bd6'], ['#ff3d6e', '#7a5cff'], ['#ffffff', '#8d93b5']];

  function renderSettings() {
    var view = $('view-settings');
    var st = D.settings;
    var nameIn = h('input.input', { value: st.name || '', maxlength: 24, style: { maxWidth: '200px' } });
    nameIn.value = st.name || '';
    nameIn.addEventListener('change', function () { set('name', nameIn.value.trim() || 'bro'); });
    var hotBtn = h('button.btn.sm', { onclick: function () { recordHotkey(hotBtn); } }, h('kbd', st.hotkey || 'F2'), ' change');
    var vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume, style: { maxWidth: '180px' } });
    vol.value = st.volume;
    vol.addEventListener('input', function () { D.settings.volume = Number(vol.value); Sound.setVolume(D.settings.volume); });
    vol.addEventListener('change', function () { D.saveSettings(); Sound.select(); });
    var autoSel = h('select.select', { style: { width: 'auto' }, onchange: function () { set('autosaveSec', Number(autoSel.value)); } },
      [3, 5, 10, 20, 30].map(function (n) { return h('option', { value: n }, 'every ' + n + ' sec'); }));
    autoSel.value = String(st.autosaveSec || 5);
    var meter = h('div');
    storageMeter(meter);

    var swatches = h('div.swatches', ACCENTS.map(function (pair) {
      var b = h('button.swatch' + (!st.accentAuto && st.accent === pair[0] ? '.on' : ''), { title: pair[0], style: { background: 'linear-gradient(135deg,' + pair[0] + ',' + pair[1] + ')' }, onclick: function () {
        D.settings.accentAuto = false; D.settings.accent = pair[0]; D.settings.accent2 = pair[1]; D.saveSettings(); App.applySettings(); renderSettings();
      } });
      return b;
    }));

    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Settings'),
      h('p.page-sub', 'Make it yours, ' + (st.name || 'bro') + '.'),
      h('div.set-grid',
        h('div',
          h('div.panel', h('h3', I('user'), 'Profile'),
            setRow('Your name', 'What Game System calls you', nameIn)),
          h('div.panel', h('h3', I('palette'), 'Look'),
            setRow('Background', 'Insane = full neon. Chill = calmer. Off = fastest for slow PCs.', seg([['insane', [I('bolt'), 'Insane']], ['chill', [I('moon'), 'Chill']], ['off', [I('power'), 'Off']]], st.bg, function (v) { set('bg', v); })),
            setRow('Colors match the game', 'The colors change to match the selected game', sw(st.accentAuto, function (v) { set('accentAuto', v); renderSettings(); })),
            !st.accentAuto ? setRow('Pick colors', null, swatches) : null,
            setRow('Scanlines', 'Retro TV lines over everything', sw(st.scanlines, function (v) { set('scanlines', v); })),
            setRow('Less motion', 'Turns off most animations', sw(st.reduceMotion, function (v) { set('reduceMotion', v); }))),
          h('div.panel', h('h3', I('volume'), 'Sound'),
            setRow('Menu sounds', null, sw(st.sounds, function (v) { set('sounds', v); })),
            setRow('Volume', null, vol)),
          h('div.panel', h('h3', I('resume'), 'Start-up & resume'),
            setRow('"Press any key" screen', 'The console-style title screen when you open Game System', sw(st.titleScreen, function (v) { set('titleScreen', v); })),
            setRow('When I come back to a game', null, seg([['popup', 'Ask me'], ['auto', 'Jump right in'], ['menu', 'Just the menu']], st.resume, function (v) { set('resume', v); })),
            setRow('Quick menu key', 'Opens the menu while playing (or move the mouse to the top edge)', hotBtn),
            setRow('Auto-save games', 'How often games with the Save Kit save', autoSel))),
        h('div',
          h('div.panel', h('h3', I('lifebuoy'), 'Your data'),
            meter,
            h('div.act-grid', { style: { marginTop: '12px' } },
              h('button.btn.primary', { onclick: function () { Backup.exportAll(); } }, I('lifebuoy'), 'Back up everything'),
              h('button.btn', { onclick: function () { Backup.pickRestore(); } }, I('download'), 'Restore a backup'),
              h('button.btn', { onclick: function () { Importer.importOldFolder(); } }, I('folder'), 'Import old games'),
              h('button.btn', { onclick: async function () { var n = await D.syncSiteGames(); UI.toast(n ? n + ' website game' + (n === 1 ? '' : 's') + ' added/updated' : 'Website games are up to date', { icon: 'globe' }); } }, I('globe'), 'Check website games')),
            setRow('Backup reminder', 'Reminds you on Home if your last backup is over a week old', sw(st.backupNag, function (v) { set('backupNag', v); }))),
          h('div.panel', h('h3', I('globe'), 'Put your games on your website'),
            h('p.muted', { style: { marginTop: 0 } }, 'Builds one folder with Game System 2.0 + all your games. Drag it onto Netlify and your games work on ANY computer.'),
            h('button.btn.primary', { onclick: function () { Backup.buildSite(); } }, I('box'), 'Build website folder')),
          h('div.panel', h('h3', I('sparkle'), 'AI games'),
            h('p.muted', { style: { marginTop: 0 } }, 'Copy these rules into ChatGPT, Claude or any AI before asking for a game. Then the game works in Game System and continues where you left off.'),
            h('button.btn', { onclick: function () { aiRules(); } }, I('sparkle'), 'Show the rules')),
          h('div.panel', h('h3', I('monitor'), 'App'),
            installPrompt ? setRow('Install as an app', 'Opens in its own window, like a real console', h('button.btn.sm.primary', { onclick: async function () { installPrompt.prompt(); try { await installPrompt.userChoice; } catch (e) { /* ignore */ } installPrompt = null; renderSettings(); } }, 'Install')) :
              setRow('Install as an app', 'In Chrome/Edge: click the install icon in the address bar (or the ⋮ menu → Install)', null),
            setRow('Version', null, h('span.tag', 'Game System ' + GS2Shared.APP_VERSION))),
          h('div.panel', h('h3', I('warn'), 'Danger zone'),
            setRow('Delete EVERYTHING', 'All games, saves, stats and settings. Make a backup first!', h('button.btn.sm.danger', { onclick: nukeAll }, 'Delete all')))))));
  }

  function recordHotkey(btn) {
    btn.replaceChildren('Press a key…');
    btn.classList.add('on');
    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (['Shift', 'Control', 'Alt', 'Meta'].indexOf(e.key) >= 0) return;
      window.removeEventListener('keydown', onKey, true);
      btn.classList.remove('on');
      if (e.key === 'Escape') { renderSettings(); return; }
      var k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      var combo = (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k;
      if (/^[A-Z0-9 ]$/.test(k) && !e.ctrlKey && !e.altKey) {
        UI.toast('A plain letter would clash with games. Use an F-key or add Ctrl/Alt.', { type: 'warn' });
        renderSettings();
        return;
      }
      set('hotkey', combo);
      UI.toast('Quick menu key is now ' + combo, { icon: 'keyboard' });
      renderSettings();
    }
    window.addEventListener('keydown', onKey, true);
  }

  async function nukeAll() {
    var input = h('input.input', { placeholder: 'Type DELETE' });
    var ok = await new Promise(function (resolve) {
      var done = false;
      UI.modal({
        title: 'Delete everything?',
        icon: 'warn',
        body: h('div', h('p', 'This deletes ALL games, saves, stats and settings from this browser. There is NO undo.'), h('p', 'Type ', h('b', 'DELETE'), ' to confirm:'), input),
        actions: [{ label: 'Cancel', kind: 'ghost', onClick: function () { done = true; resolve(false); } },
          { label: 'Delete everything', kind: 'danger', onClick: function () {
            if (input.value.trim() !== 'DELETE') { UI.toast('Type DELETE exactly', { type: 'warn' }); return false; }
            done = true; resolve(true);
          } }],
        onClose: function () { if (!done) resolve(false); }
      });
    });
    if (!ok) return;
    if (Player.isPlaying()) await Player.close({ quiet: true });
    if (Editor.isOpen()) { D.ui.editor = null; }
    await GS2DB.wipe();
    try {
      var rm = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('gs2') === 0) rm.push(k); }
      rm.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
    if (indexedDB.databases) {
      try { (await indexedDB.databases()).forEach(function (d) { if (d.name && d.name.indexOf('gs2:idb:') === 0) indexedDB.deleteDatabase(d.name); }); } catch (e) { /* ignore */ }
    }
    location.reload();
  }

  /* =====================================================================
     AI RULES
     ===================================================================== */
  async function aiRules() {
    var kitText = '';
    try { kitText = (await (await fetch('kit/save-kit.js')).text()).trim(); } catch (e) { kitText = '(could not load the Save Kit, are you offline?)'; }
    var hk = D.settings.hotkey || 'F2';
    var rules = [
      'I\'m making a game for my Game System 2.0. Follow these rules exactly:',
      '',
      '1. Put EVERYTHING in ONE single .html file (HTML + CSS + JavaScript together). No other files.',
      '2. Don\'t use image or sound files. Draw graphics with code (canvas, WebGL or CSS) and make sounds with the Web Audio API. If you need a library like three.js, load it from https://cdn.jsdelivr.net/npm/...',
      '3. SAVE & RESUME. Paste this Save Kit at the very top of the first <script>, exactly as written:',
      '',
      kitText,
      '',
      '4. When the game starts, load the save and put EVERYTHING back exactly how it was:',
      '     const saved = GameSystem.load();',
      '     if (saved) { /* restore player position, health, money, level, inventory, the world, time... */ }',
      '   Then turn on auto-save with a function that returns everything needed to continue exactly where the player was:',
      '     GameSystem.autoSave(() => ({ /* player position, health, money, level, inventory, world, time... */ }));',
      '   Only save plain data (numbers, text, true/false, arrays, objects). No functions, images or DOM elements.',
      '   When the player starts a brand new game, call GameSystem.clear().',
      '5. It must work with keyboard + mouse on a PC, fill the whole window, and handle the window being resized.',
      '6. Don\'t use alert(), confirm() or prompt(). Show messages inside the game instead.',
      '7. Don\'t use the ' + hk + ' key in the game (Game System uses it for its menu).',
      '8. Send the COMPLETE file every time. Never write "rest of the code stays the same". If it\'s too long for one message, stop at a clean spot and I\'ll say "continue".',
      '',
      'Now make this game: '
    ].join('\n');
    UI.modal({
      title: 'Rules for AI games',
      icon: 'sparkle',
      wide: true,
      body: h('div',
        h('p', 'Copy this and paste it into the AI chat ', h('b', 'before'), ' you describe your game. Then add what game you want at the end.'),
        h('ul.small.muted.checks', h('li', I('check'), 'Works as one file'), h('li', I('check'), 'Continues exactly where you left off, even after your PC turns off'), h('li', I('check'), 'No missing pictures or sounds')),
        h('div.code-box', rules)),
      actions: [
        { label: 'Copy only the Save Kit', icon: 'copy', onClick: function () { U.copyText(kitText); UI.toast('Save Kit copied', { icon: 'clipboard' }); return false; } },
        { label: 'Copy the rules', icon: 'clipboard', kind: 'primary', onClick: function () { U.copyText(rules); UI.toast('Copied! Now paste it into the AI.', { icon: 'clipboard' }); } }
      ]
    });
  }

  window.Views = {
    render: function (name) {
      if (name === 'home') renderHome();
      else if (name === 'library') renderLibrary();
      else if (name === 'saves') renderSaves();
      else if (name === 'stats') renderStats();
      else if (name === 'settings') renderSettings();
    },
    renderHome: renderHome,
    selectGame: selectGame,
    gameDetails: gameDetails,
    gameMenu: gameMenu,
    deleteGames: deleteGames,
    aiRules: aiRules,
    importSaveFile: importSaveFile,
    viewSaves: viewSaves
  };
})();
