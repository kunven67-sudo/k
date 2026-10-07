/* Game System 2.0 — screens: Home, Library, Saves, Stats, Settings + game details + AI rules. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  function $(id) { return document.getElementById(id); }

  /* =====================================================================
     HOME — three layouts (Settings → Home & Library):
       console: big showcase + rows (Jump back in, Favorites, New, Apps, Folders) you can drag around
       games:   big showcase + every game below
       steam:   list of games on the left, the selected game big on the right
     ===================================================================== */
  var heroSaveCheck = 0;
  var ROWS = {
    recent: { title: 'Jump back in', icon: 'resume' },
    favorites: { title: 'Favorites', icon: 'star' },
    new: { title: 'New', icon: 'sparkle' },
    apps: { title: 'Apps', icon: 'apps' },
    folders: { title: 'Folders', icon: 'folder' },
    trophies: { title: 'Trophies', icon: 'trophy' }
  };
  var ROW_ORDER = ['recent', 'favorites', 'new', 'apps', 'folders', 'trophies'];
  function homeRows() {
    var saved = Array.isArray(D.ui.homeRows) ? D.ui.homeRows.filter(function (r) { return ROWS[r]; }) : [];
    ROW_ORDER.forEach(function (r) { if (saved.indexOf(r) < 0) saved.push(r); });
    return saved;
  }
  function byRecent(a, b) { return (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.created || 0) - (a.created || 0); }

  function renderHome() {
    var view = $('view-home');
    var games = D.list('game');
    if (!games.length) { view.replaceChildren(welcome()); App.setAccent(null); return; }
    var sel = D.get(D.ui.sel);
    if (!sel || D.isApp(sel)) sel = games[0];
    if (D.ui.sel !== sel.id) { D.ui.sel = sel.id; D.saveUISoon(); }
    var layout = D.settings.homeLayout || 'console';
    var v = Layout.view('home');

    if (layout === 'steam') {
      view.replaceChildren(steamHome(games, sel, v));
    } else {
      var hero = h('section.hero');
      var parts = [hero, homeControls(v)];
      if (layout === 'games') {
        var all = games.slice().sort(byRecent);
        var host = h('div.home-all');
        Grid.render(host, { screen: null, nodes: all.map(function (g) { return { kind: 'item', key: 'g:' + g.id, g: g }; }), mode: v.mode, size: v.size, onOpen: homeOpen, onMenu: function (g, x, y) { gameMenu(g.id, x, y); } });
        parts.push(h('section.hrow', h('header.hrow-head', h('h2', I('gamepad'), 'All games'), h('span.count', String(all.length))), host));
      } else {
        parts.push(rowsEl(games, v));
      }
      parts.push(homeStrip(games));
      view.replaceChildren.apply(view, parts);
      fillHero(hero, sel);
    }
    App.setAccentFor(sel);
    markSelected(sel.id, true);
  }
  /* clicking a game on Home: first click shows it big, second click plays (apps just open) */
  function homeOpen(g) {
    if (D.isApp(g)) { Player.launch(g.id); return; }
    if (D.ui.sel === g.id) { Player.launch(g.id); return; }
    selectGame(g.id);
  }

  function homeControls(v) {
    return h('div.home-ctl', h('div.grow'), viewControl('home', v, function () { renderHome(); }));
  }

  /* the look switcher: small icons / big cards / list + a size slider */
  function viewControl(screen, v, onChange) {
    var seg = h('div.seg.view-seg', { role: 'group', 'aria-label': 'How it looks' });
    [['icons', 'viewIcons', 'Small icons'], ['cards', 'viewCards', 'Big cards'], ['list', 'viewList', 'List']].forEach(function (m) {
      seg.appendChild(h('button' + (v.mode === m[0] ? '.on' : ''), {
        title: m[2], 'aria-label': m[2], 'aria-pressed': v.mode === m[0] ? 'true' : 'false',
        onclick: function () { Layout.setView(screen, { mode: m[0] }); Sound.select(); onChange(); }
      }, I(m[1])));
    });
    var range = h('input', { type: 'range', min: 0.6, max: 1.6, step: 0.05, value: v.size, 'aria-label': 'Size', title: 'Size' });
    range.value = v.size;
    range.addEventListener('input', function () {
      Layout.setView(screen, { size: Number(range.value) });
      document.querySelectorAll('#view-' + (screen === 'home' ? 'home' : screen) + ' .gs-grid, #view-' + screen + ' .hrow-rail').forEach(function (gr) { gr.style.setProperty('--gs', range.value); });
    });
    return h('div.view-ctl', seg, h('label.size-ctl', { title: 'Size' }, I('viewIcons', 'sm'), range, I('viewIcons', 'lg')));
  }

  function rowsEl(games, v) {
    var wrap = h('div.home-rows');
    homeRows().forEach(function (key) {
      var row = homeRow(key, games, v);
      if (row) wrap.appendChild(row);
    });
    enableRowDrag(wrap);
    return wrap;
  }
  function rowItems(key, games) {
    if (key === 'recent') {
      var played = games.filter(function (g) { return g.lastPlayed; }).sort(byRecent);
      return (played.length ? played : games.slice().sort(byRecent)).slice(0, 30);
    }
    if (key === 'favorites') return D.list().filter(function (g) { return g.fav; }).sort(byRecent);
    if (key === 'new') return games.filter(function (g) { return !g.lastPlayed; }).sort(function (a, b) { return (b.created || 0) - (a.created || 0); }).slice(0, 30);
    if (key === 'apps') return Layout.flat('apps');
    return [];
  }
  function homeRow(key, games, v) {
    var meta = ROWS[key];
    var rail = h('div.hrow-rail.mode-' + v.mode, { role: 'list', 'aria-label': meta.title });
    rail.style.setProperty('--gs', v.size);
    var count = 0;
    if (key === 'trophies') {
      var ti = Trophies.info();
      count = ti.got + ' / ' + ti.total;
      rail.className = 'hrow-rail tr-rail';
      Trophies.homeCards().forEach(function (c) { rail.appendChild(c); });
    } else if (key === 'folders') {
      var folders = Layout.tree('library').filter(function (n) { return n.kind === 'folder'; });
      if (!folders.length) return null;
      count = folders.length;
      folders.forEach(function (n) {
        var tile = h('button.gi.gi-folder' + (v.mode === 'list' ? '.gi-row' : (v.mode === 'icons' ? '.gi-icon' : '.gi-card')), {
          'data-fid': n.f.f, 'aria-label': 'Folder ' + n.f.name,
          onclick: function () { D.ui.lib.folder = 'all'; D.ui.libOpen = n.f.f; App.go('library'); }
        }, h('span.gi-art.fa', folderMini(n)), h('span.gi-name', n.f.name));
        rail.appendChild(tile);
      });
    } else {
      var items = rowItems(key, games);
      if (!items.length && key !== 'recent') return null;
      count = items.length;
      if (v.mode === 'list') items = items.slice(0, 8);
      items.forEach(function (g) {
        var el = Grid.itemEl(g, { mode: v.mode, appBadge: key === 'favorites' });
        el.addEventListener('click', function () { homeOpen(g); });
        el.addEventListener('dblclick', function () { if (!D.isApp(g)) Player.launch(g.id); });
        el.addEventListener('focus', function () { if (!D.isApp(g) && D.ui.sel !== g.id) selectGame(g.id, true); });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); gameMenu(g.id, e.clientX, e.clientY); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (D.isApp(g)) Player.launch(g.id); else Player.launch(g.id); } });
        UI.longPress(el, function (x, y) { gameMenu(g.id, x, y); });
        rail.appendChild(el);
      });
      if (key === 'recent' || key === 'apps') {
        var add = h('button.gi.gi-add' + (v.mode === 'list' ? '.gi-row' : (v.mode === 'icons' ? '.gi-icon' : '.gi-card')), {
          'aria-label': key === 'apps' ? 'Add an app' : 'Add games',
          onclick: function () { Importer.addDialog(key === 'apps' ? { kind: 'app' } : null); }
        }, h('span.gi-art', I('plus')), h('span.gi-name', key === 'apps' ? 'Add app' : 'Add games'));
        rail.appendChild(add);
      }
    }
    if (v.mode !== 'list' || key === 'trophies') {
      rail.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && rail.scrollWidth > rail.clientWidth) { rail.scrollLeft += e.deltaY; e.preventDefault(); }
      }, { passive: false });
    }
    var seeAll = key === 'apps' ? function () { App.go('apps'); } : key === 'trophies' ? function () { Trophies.open(); } : function () { App.go('library'); };
    return h('section.hrow', { 'data-row': key },
      h('header.hrow-head',
        h('button.hrow-grip', { title: 'Drag to move this row', 'aria-label': 'Move the ' + meta.title + ' row' }, I('grip')),
        h('h2', I(meta.icon), meta.title),
        h('span.count', String(count)),
        h('div.grow'),
        h('button.hrow-all', { onclick: seeAll }, key === 'apps' ? 'All apps' : key === 'trophies' ? 'Trophy room' : 'See all', I('next'))),
      rail);
  }
  function folderMini(n) {
    if (n.f.cover) { var url = URL.createObjectURL(n.f.cover); return h('img', { src: url, alt: '', onload: function () { setTimeout(function () { URL.revokeObjectURL(url); }, 1000); } }); }
    var box = h('span.fa-grid');
    n.games.slice(0, 4).forEach(function (g) { box.appendChild(h('span.fa-cell', UI.art(g, { noName: true, lazy: true }))); });
    for (var i = n.games.length; i < 4; i++) box.appendChild(h('span.fa-cell.fa-empty'));
    return box;
  }

  /* drag a row by its handle to put the rows in any order */
  function enableRowDrag(wrap) {
    wrap.addEventListener('pointerdown', function (e) {
      var grip = e.target.closest('.hrow-grip');
      if (!grip) return;
      e.preventDefault();
      var row = grip.closest('.hrow');
      var sc = wrap.closest('.view');
      row.classList.add('hrow-dragging');
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      function move(ev) {
        var rows = Array.prototype.slice.call(wrap.querySelectorAll('.hrow'));
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i].getBoundingClientRect();
          if (rows[i] !== row && ev.clientY > r.top && ev.clientY < r.bottom) {
            var after = ev.clientY > r.top + r.height / 2;
            var ref = after ? rows[i].nextElementSibling : rows[i];
            if (ref !== row && ref !== row.nextElementSibling) {
              var before = rows.map(function (x) { return x.getBoundingClientRect().top; });
              wrap.insertBefore(row, ref);
              rows.forEach(function (x, k) { var d = before[k] - x.getBoundingClientRect().top; if (d && x.animate) x.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }); });
            }
            break;
          }
        }
        if (sc) { var sr = sc.getBoundingClientRect(); if (ev.clientY < sr.top + 60) sc.scrollTop -= 12; else if (ev.clientY > sr.bottom - 60) sc.scrollTop += 12; }
      }
      function up() {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        row.classList.remove('hrow-dragging');
        var order = Array.prototype.map.call(wrap.querySelectorAll('.hrow'), function (x) { return x.dataset.row; });
        homeRows().forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
        D.ui.homeRows = order;
        D.saveUISoon();
        Sound.select();
      }
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  }

  /* Steam-style Home: list on the left, the picked game big on the right */
  function steamHome(games, sel, v) {
    var q = h('input.input', { type: 'search', placeholder: 'Search your games…', 'aria-label': 'Search games' });
    var list = h('div.steam-list', { role: 'list' });
    var detail = h('section.hero.steam-detail');
    var all = games.slice().sort(byRecent);
    function fill() {
      var t = q.value.trim().toLowerCase();
      list.replaceChildren();
      all.filter(function (g) { return !t || g.name.toLowerCase().indexOf(t) >= 0; }).forEach(function (g) {
        var el = Grid.itemEl(g, { mode: 'list' });
        el.classList.add('steam-row');
        el.addEventListener('click', function () { if (D.ui.sel === g.id) Player.launch(g.id); else selectGame(g.id); });
        el.addEventListener('dblclick', function () { Player.launch(g.id); });
        el.addEventListener('focus', function () { if (D.ui.sel !== g.id) selectGame(g.id, true); });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); gameMenu(g.id, e.clientX, e.clientY); });
        UI.longPress(el, function (x, y) { gameMenu(g.id, x, y); });
        list.appendChild(el);
      });
      markSelected(D.ui.sel, true);
    }
    q.addEventListener('input', U.debounce(fill, 100));
    fill();
    fillHero(detail, sel);
    return h('div.steam',
      h('aside.steam-side', h('div.steam-q', I('search'), q), list),
      detail);
  }

  function markSelected(id, scroll) {
    var view = $('view-home');
    var first = null;
    view.querySelectorAll('.gi[data-id]').forEach(function (t) {
      var on = t.dataset.id === id;
      t.classList.toggle('sel', on);
      if (on && !first) first = t;
    });
    if (first && scroll) requestAnimationFrame(function () { first.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  }

  function selectGame(id, fromFocus) {
    var g = D.get(id);
    if (!g) return;
    D.ui.sel = id;
    D.saveUISoon();
    var hero = $('view-home').querySelector('.hero');
    if (hero) fillHero(hero, g);
    App.setAccentFor(g);
    Sound.move();
    markSelected(id, !fromFocus);
  }

  /* the big showcase: CONTINUE / PLAY, New game, status words, "Make it continue" */
  function fillHero(hero, g) {
    var check = ++heroSaveCheck;
    var bg = h('div.hero-bg', g.cover ? h('img', { src: D.coverUrl(g), alt: '' }) : h('div.hb-fill', { style: { background: 'radial-gradient(circle at 70% 40%, ' + (g.color || '#00e5ff') + ', transparent 60%)' } }));
    var kind = D.resumeKind(g);
    var savedT = D.saveIndex[g.id];
    var badges = h('div.badges',
      g.folder ? h('span.badge', I('folder'), g.folder) : null,
      g.source === 'site' ? h('span.badge.acc', I('globe'), 'On website') : null,
      g.source === 'link' ? h('span.badge', I('link'), 'Website') : null,
      !g.lastPlayed ? h('span.badge.hot', 'NEW') : null,
      g.fav ? h('span.badge', I('starFill'), 'Favorite') : null);
    var status = h('div.hero-status.st-' + kind,
      I(kind === 'save' ? 'save' : (kind === 'web' ? 'globe' : (kind === 'app' ? 'win' : 'restart'))),
      h('span', D.statusText(g)),
      kind === 'save' && savedT ? h('em', 'Saved ' + U.timeAgo(savedT)) : null);
    var hasSave = kind !== 'web' && !!savedT;
    var playBtn = h('button.btn.primary.play-btn', { onclick: function () { Player.launch(g.id); }, 'data-autofocus': true }, UI.icon('play'), h('span', hasSave ? 'CONTINUE' : 'PLAY'));
    if (hasSave) playBtn.title = 'Progress saved ' + U.timeAgo(savedT);
    var newBtn = hasSave ? h('button.btn.ghost.new-btn', { onclick: function () { newGame(g.id); }, title: 'Start from the beginning (deletes the saved progress)' }, I('restart'), 'New game') : null;
    var fixBtn = kind === 'title' ? h('button.btn.fix-btn', { onclick: function () { Upgrade.open(g.id); }, title: 'Let an AI upgrade this game so it continues where you left off' }, I('sparkle'), 'Make it continue') : null;
    var moreBtn = h('button.icon-btn', { title: 'More options', 'aria-label': 'More options', onclick: function (e) { var r = e.currentTarget.getBoundingClientRect(); gameMenu(g.id, r.left, r.bottom + 6); } }, UI.icon('more'));
    var artCard = h('div.art-card', { title: 'Change picture', style: { cursor: 'pointer' }, onclick: function () { Pics.open(g.id); } }, UI.art(g), h('div.glare'));
    UI.tilt(artCard, 8);
    hero.replaceChildren(bg,
      h('div.hero-info',
        badges,
        h('h1.hero-title', g.name),
        status,
        g.desc ? h('p.hero-desc', g.desc) : null,
        h('div.meta',
          h('span', I('clock'), h('b', U.fmtDuration((g.playTime || 0) + (D.pendingPlay[g.id] || 0))), ' played'),
          h('span', I('gamepad'), h('b', String(g.launches || 0)), (g.launches === 1 ? ' launch' : ' launches')),
          h('span', I('calendar'), g.lastPlayed ? U.timeAgo(g.lastPlayed) : 'never played')),
        h('div.hero-actions', playBtn, newBtn, fixBtn, moreBtn)),
      h('div.hero-art', artCard));
    /* the emergency copy (made when the tab closed) can be newer than what we know */
    if (kind !== 'web') {
      D.latestSave(g.id).then(function (s) {
        if (check !== heroSaveCheck || !s || savedT) return;
        D.saveIndex[g.id] = s.t;
        fillHero(hero, g);
      });
    }
  }

  async function newGame(id) {
    var g = D.get(id);
    if (!g) return;
    var ok = await UI.confirm('Start a new game?', h('div',
      h('p', 'This deletes your saved progress in ', h('b', g.name), ' and starts from the beginning.'),
      h('p.small.muted', 'Want to keep it? Make a backup first (Saves → Back up everything).')), { ok: 'New game', danger: true, icon: 'restart' });
    if (!ok) return;
    await D.wipeSaves(id, true);
    Player.launch(id);
  }

  function homeStrip(games) {
    var items = [];
    items.push(h('button.mini-card', { onclick: function () { Importer.addDialog(); } },
      h('span.mc-ico', I('plus')), h('div', h('b', 'Add games'), h('span', 'Files, zips, folders or pasted code'))));
    items.push(h('button.mini-card', { onclick: function () { aiRules(); } },
      h('span.mc-ico', I('sparkle')), h('div', h('b', 'Rules for AI games'), h('span', 'Copy this to any AI so its games work + save'))));
    items.push(h('button.mini-card', { onclick: function () { App.go('library'); } },
      h('span.mc-ico', I('library')), h('div', h('b', 'Library'), h('span', games.length + ' game' + (games.length === 1 ? '' : 's') + ' · your order, folders, favorites'))));
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
        h('button.btn', { onclick: function () { Backup.pickRestore(); } }, I('download'), 'Restore a backup'),
        D.list('app').length ? h('button.btn', { onclick: function () { App.go('apps'); } }, I('apps'), 'Try the apps') : null));
  }

  /* =====================================================================
     GAME DETAILS + MENUS
     ===================================================================== */
  function noun(g) { return D.isApp(g) ? 'app' : 'game'; }
  /* "games", "apps", or "games and apps" for a bunch of ids */
  function nounFor(ids) {
    var apps = ids.filter(function (id) { return D.isApp(D.get(id)); }).length;
    return apps === ids.length ? 'apps' : (apps ? 'games and apps' : 'games');
  }

  /* the options menu (right-click, hold on a phone, or the "..." button). ctx: { screen, key } when it came from a grid */
  function gameMenu(id, x, y, ctx) {
    var g = D.get(id);
    if (!g) return;
    ctx = ctx || {};
    var app = D.isApp(g);
    var simple = D.simple();
    var hasSave = g.source !== 'link' && !!D.saveIndex[id];
    var inFolder = ctx.screen ? Layout.folderOf(ctx.screen, id) : null;
    var full = app && !Win.wantsPopup(g);
    UI.contextMenu(x, y, [
      app ? { icon: 'win', label: Win.isOpen(id) ? 'Show window' : 'Open in a window', onClick: function () { D.updateGame(id, { openMode: 'window' }); Player.launch(id, { window: true }); } }
        : { icon: 'play', label: hasSave ? 'Continue' : 'Play', onClick: function () { Player.launch(id); } },
      full ? { icon: 'full', label: 'Open full screen', onClick: function () { D.updateGame(id, { openMode: 'full' }); if (Win.isOpen(id)) Win.close(id, { quiet: true }); Player.launch(id, { fullscreen: true }); } } : null,
      app && Win.isOpen(id) ? { icon: 'x', label: 'Close window', onClick: function () { Win.close(id); } } : null,
      hasSave ? { icon: 'restart', label: 'New game (start over)', onClick: function () { newGame(id); } } : null,
      D.resumeKind(g) === 'title' ? { icon: 'sparkle', label: 'Make it continue where I left off', onClick: function () { Upgrade.open(id); } } : null,
      'sep',
      { icon: g.fav ? 'star' : 'starFill', label: g.fav ? 'Unfavorite' : 'Favorite', onClick: function () { D.updateGame(id, { fav: !g.fav }); } },
      { icon: 'tag', label: 'Rename', onClick: function () { renameGame(id); } },
      { icon: 'image', label: 'Change picture', onClick: function () { Pics.open(id); } },
      ctx.screen && ctx.key ? { icon: 'move', label: 'Move', onClick: function () { Grid.startMove(ctx.screen, ctx.key); } } : null,
      inFolder ? { icon: 'ungroup', label: 'Take out of "' + inFolder.name + '"', onClick: function () { Layout.takeOut(ctx.screen, id); } } : null,
      !inFolder || ctx.screen !== 'library' ? { icon: 'folder', label: 'Put in a folder', onClick: function () { moveToFolder([id]); } } : null,
      { icon: app ? 'gamepad' : 'apps', label: app ? 'Move to Games' : 'Move to Apps', onClick: function () { setKind(id, app ? 'game' : 'app'); } },
      g.source !== 'link' && !simple ? { icon: 'code', label: 'Edit code', onClick: function () { Editor.open(id); } } : null,
      { icon: 'more', label: 'Details & more', onClick: function () { gameDetails(id); } },
      'sep',
      { icon: 'trash', label: 'Delete', danger: true, onClick: function () { deleteGames([id]); } }
    ]);
  }

  /* games open full screen, apps open in a window */
  async function setKind(id, kind) {
    var g = D.get(id);
    if (!g || (kind === 'app') === D.isApp(g)) return;
    if (kind === 'game' && Win.isOpen(id)) Win.close(id, { quiet: true });
    await D.updateGame(id, { kind: kind, kindSet: true });
    Sound.select();
    UI.toast('"' + g.name + '" moved to ' + (kind === 'app' ? 'Apps' : 'Games') + '.', {
      icon: kind === 'app' ? 'apps' : 'gamepad', sound: false,
      actions: [{ label: 'Go there', onClick: function () { App.go(kind === 'app' ? 'apps' : 'library'); } }]
    });
  }

  async function renameGame(id) {
    var g = D.get(id);
    var n = await UI.prompt('Rename ' + noun(g), 'Name', g.name, { ok: 'Rename', max: 80 });
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
    var what = ids.length === 1 ? noun(D.get(ids[0])) : nounFor(ids);
    var ok = await UI.confirm(ids.length === 1 ? 'Delete "' + names[0] + '"?' : 'Delete ' + ids.length + ' ' + what + '?',
      h('div', h('p', 'This removes ' + (ids.length === 1 ? 'the ' + what + ', its saves and its stats' : 'these ' + what + ', their saves and their stats') + ' from Game System. Can\'t undo!'),
        h('p.small.muted', 'Want to be safe? Make a backup first (Settings → Back up everything).')),
      { ok: 'Delete', danger: true, icon: 'trash' });
    if (!ok) return false;
    for (var i = 0; i < ids.length; i++) {
      if (Editor.currentId() === ids[i]) { await Editor.close(); }
      if (Win.isOpen(ids[i])) Win.close(ids[i], { quiet: true });
      await D.deleteGame(ids[i]);
    }
    Sound.back();
    UI.toast(ids.length === 1 ? '"' + names[0] + '" deleted' : ids.length + ' ' + what + ' deleted', { icon: 'trash', sound: false });
    return true;
  }

  async function gameDetails(id) {
    var g = D.get(id);
    if (!g) return;
    var app = D.isApp(g);
    var isLink = g.source === 'link';
    var save = isLink ? null : await D.latestSave(id);
    var keys = D.storageKeys(id);
    var isolateSw = h('label.switch', h('input', { type: 'checkbox', checked: g.isolate !== false, onchange: function (e) { D.updateGame(id, { isolate: e.target.checked }); } }), h('i'));
    function reopen() { m.close(); gameDetails(id); }
    var kindSeg = seg([['game', [I('gamepad'), 'Game']], ['app', [I('apps'), 'App']]], app ? 'app' : 'game', async function (k) {
      await setKind(id, k);
      reopen();
    });
    var linkSeg = isLink && app ? seg([['auto', 'Automatic'], ['inside', 'Inside a window'], ['popup', 'Its own popup']], g.linkMode || 'auto', function (k) {
      D.updateGame(id, { linkMode: k === 'auto' ? undefined : k });
    }) : null;
    var host = '';
    try { host = isLink ? new URL(g.url).hostname : ''; } catch (e) { host = ''; }
    var m = UI.modal({
      title: g.name,
      icon: app ? 'win' : 'gamepad',
      wide: true,
      body: h('div',
        h('div.det-top',
          h('div.det-art', UI.art(g)),
          h('div',
            g.desc ? h('p', g.desc) : h('p.muted', 'No description yet.'),
            h('div.det-stats',
              app ? null : stat(U.fmtDuration((g.playTime || 0) + (D.pendingPlay[id] || 0)), 'Played'),
              stat(String(g.launches || 0), app ? 'Times opened' : 'Launches'),
              stat(g.lastPlayed ? U.timeAgo(g.lastPlayed) : 'Never', app ? 'Last opened' : 'Last played'),
              !isLink ? stat(U.fmtBytes(g.size), (g.fileCount || 0) + ' file' + (g.fileCount === 1 ? '' : 's')) : stat('Website', host)),
            h('p.small.muted', I('save'), ' ', save ? 'Resume point saved ' + U.timeAgo(save.t) + ' (' + U.fmtBytes(save.size || 0) + ')' : (g.kitAutosave ? 'Uses the Save Kit' : 'No resume point yet'),
              keys.length ? ' · ' + keys.length + ' saved value' + (keys.length === 1 ? '' : 's') : ''))),
        h('div.hr'),
        h('div.act-grid',
          h('button.btn.primary', { onclick: function () { m.close(); Player.launch(id); } }, UI.icon(app ? 'win' : 'play'), app ? 'Open' : 'Play'),
          app && !Win.wantsPopup(g) ? h('button.btn', { onclick: function () { m.close(); D.updateGame(id, { openMode: 'full' }); if (Win.isOpen(id)) Win.close(id, { quiet: true }); Player.launch(id, { fullscreen: true }); } }, I('full'), 'Open full screen') : null,
          !isLink ? h('button.btn.adv', { onclick: function () { m.close(); Editor.open(id); } }, UI.icon('code'), 'Edit code') : null,
          h('button.btn', { onclick: function () { m.close(); renameGame(id); } }, I('tag'), 'Rename'),
          h('button.btn', { onclick: function () { m.close(); Pics.open(id); } }, I('image'), 'Change picture'),
          g.cover ? h('button.btn', { onclick: async function () { await D.setCover(id, null); reopen(); } }, I('x'), g.icon ? 'Use the app icon' : 'Remove picture') : null,
          h('button.btn', { onclick: async function () {
            var d = await UI.prompt('Description', 'What is this ' + noun(g) + ' about?', g.desc || '', { ok: 'Save', max: 600 });
            if (d !== null) { await D.updateGame(id, { desc: d }); reopen(); }
          } }, I('text'), 'Description'),
          app ? null : h('button.btn', { onclick: function () { m.close(); moveToFolder([id]); } }, UI.icon('folder'), 'Folder'),
          app ? null : h('button.btn' + (g.fav ? '.fav-on' : ''), { onclick: async function () { await D.updateGame(id, { fav: !g.fav }); reopen(); } }, I(g.fav ? 'starFill' : 'star'), g.fav ? 'Unfavorite' : 'Favorite'),
          !isLink && !g.kitAutosave ? h('button.btn.good', { onclick: function () { m.close(); Upgrade.open(id); } }, I('resume'), 'Make it continue where I left off') : null,
          !isLink ? h('button.btn', { onclick: function () { m.close(); updateFiles(id); } }, UI.icon('upload'), 'Update ' + noun(g) + ' files') : null,
          !isLink ? h('button.btn', { onclick: function () { downloadGame(id); } }, UI.icon('download'), 'Download ' + noun(g)) : null,
          h('button.btn', { onclick: async function () { m.close(); var c = await D.duplicateGame(id); if (c) { if (!D.isApp(c)) D.ui.sel = c.id; App.refresh(); UI.toast('Made a copy', { icon: 'copy' }); } } }, UI.icon('copy'), 'Duplicate'),
          !isLink ? h('button.btn', { onclick: function () { m.close(); App.go('saves'); setTimeout(function () { viewSaves(id); }, 200); } }, UI.icon('save'), 'Saves') : null,
          h('button.btn.danger', { onclick: async function () { if (await deleteGames([id])) m.close(); } }, UI.icon('trash'), 'Delete')),
        h('div.hr'),
        h('div.set-row', h('div.st', h('b', 'This is a…'), h('span', 'Games open full screen. Apps open in a window, so you can use a few at once.')), kindSeg),
        linkSeg ? h('div.set-row', h('div.st', h('b', 'Open this website'), h('span', 'Some websites (like YouTube or Google) refuse to show up inside other sites. Those open in their own popup window.')), linkSeg) : null,
        !isLink ? h('div.set-row.adv', h('div.st', h('b', I('lock'), ' Private saves'), h('span', 'Keeps this ' + noun(g) + '\'s saves separate from everything else. Turn off only if an old game can\'t find its saves.')), isolateSw) : null,
        g.source === 'site' ? h('p.small.muted', { style: { marginTop: '10px' } }, I('globe'), ' This ' + noun(g) + ' comes with your website. If you edit it, it becomes your own copy.') : null)
    });
  }
  function stat(v, l) { return h('div.stat-box', h('div.sv', v), h('div.sl', l)); }

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
     LIBRARY — every game AND app, in your own order, with phone-style folders
     ===================================================================== */
  var selectMode = false;
  var selected = new Set();
  var FILTERS = ['all', 'games', 'apps', 'fav'];

  function renderLibrary() {
    var view = $('view-library');
    var lib = D.ui.lib;
    var everything = D.list();
    var folders = D.folders();
    if (FILTERS.indexOf(lib.folder) < 0 && !(String(lib.folder || '').indexOf('f:') === 0 && folders.some(function (f) { return 'f:' + f.name === lib.folder; }))) lib.folder = 'all';
    var v = Layout.view('library');
    var gamesN = everything.filter(function (g) { return !D.isApp(g); }).length;
    var appsN = everything.length - gamesN;
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    var search = h('input.input', { type: 'search', placeholder: 'Search games and apps…', id: 'lib-search', 'aria-label': 'Search games and apps' });
    search.value = lib.q || '';
    search.addEventListener('input', U.debounce(function () { lib.q = search.value; D.saveUISoon(); renderGrid(); }, 120));

    function chip(key, label, n) {
      return h('button.chip' + ((lib.folder || 'all') === key ? '.on' : ''), { onclick: function () { lib.folder = key; D.saveUISoon(); renderLibrary(); } }, label, h('span.n', String(n)));
    }
    var chips = h('div.chips',
      chip('all', [I('viewIcons'), 'All'], everything.length),
      chip('games', [I('gamepad'), 'Games'], gamesN),
      appsN ? chip('apps', [I('apps'), 'Apps'], appsN) : null,
      chip('fav', [I('star'), 'Favorites'], everything.filter(function (g) { return g.fav; }).length),
      folders.map(function (f) { return chip('f:' + f.name, [I('folder'), f.name], f.count); }));

    var gridHost = h('div.lib-grid');
    var bulk = h('div.bulkbar', { hidden: !selectMode });

    function current() {
      var q = (lib.q || '').trim().toLowerCase();
      var f = lib.folder || 'all';
      if (!q && f === 'all') return { nodes: Layout.tree('library'), drag: true, plain: true };
      var list = Layout.flat('library').filter(function (g) {
        if (f === 'games' && D.isApp(g)) return false;
        if (f === 'apps' && !D.isApp(g)) return false;
        if (f === 'fav' && !g.fav) return false;
        if (f.indexOf('f:') === 0 && g.folder !== f.slice(2)) return false;
        if (q && (g.name + ' ' + (g.desc || '') + ' ' + (g.folder || '')).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      return { nodes: list.map(function (g) { return { kind: 'item', key: 'g:' + g.id, g: g }; }), drag: false, plain: false };
    }
    function renderGrid() {
      var r = current();
      Grid.render(gridHost, {
        screen: r.drag && !selectMode ? 'library' : null,
        nodes: r.nodes,
        mode: v.mode,
        size: v.size,
        appBadge: true,
        expanded: D.ui.libOpen || null,
        onExpand: function (fid) { D.ui.libOpen = fid; D.saveUISoon(); },
        onOpen: function (g, el) {
          if (selectMode) { toggleSel(g.id, el); return; }
          if (!D.isApp(g)) D.ui.sel = g.id;
          Player.launch(g.id);
        },
        onMenu: function (g, x, y, ctx) { gameMenu(g.id, x, y, ctx); },
        addTile: r.plain && !selectMode ? { label: 'Add', onClick: function () { Importer.addDialog(); } } : null,
        emptyEl: h('div.empty-note', h('span.big', I(everything.length ? 'search' : 'gamepad')),
          everything.length ? 'Nothing matches that. Try another search.' : 'Nothing here yet. Hit "Add" to bring some in!')
      });
      if (selectMode) gridHost.querySelectorAll('.gi[data-id]').forEach(function (el) { el.classList.toggle('selected', selected.has(el.dataset.id)); });
    }

    function toggleSel(id, el) {
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      if (el) el.classList.toggle('selected', selected.has(id));
      renderBulk();
    }
    function renderBulk() {
      bulk.hidden = !selectMode;
      var ids = Array.from(selected).filter(function (id) { return D.get(id); });
      bulk.replaceChildren(
        h('b', ids.length + ' selected'),
        h('button.btn.sm', { onclick: function () { current().nodes.forEach(function (n) { if (n.kind === 'item') selected.add(n.g.id); else n.games.forEach(function (g) { selected.add(g.id); }); }); renderLibrary(); } }, 'Select all'),
        h('div.grow'),
        h('button.btn.sm', { disabled: !ids.length, onclick: async function () { if (await moveToFolder(ids)) { renderLibrary(); } } }, I('folder'), 'Put in folder'),
        h('button.btn.sm', { disabled: !ids.length, onclick: async function () { for (var i = 0; i < ids.length; i++) await D.updateGame(ids[i], { fav: true }); } }, I('star'), 'Favorite'),
        h('button.btn.sm', { disabled: !ids.length, onclick: function () { Backup.exportAll(ids); } }, I('lifebuoy'), 'Back up these'),
        h('button.btn.sm.danger', { disabled: !ids.length, onclick: async function () { if (await deleteGames(ids)) { selected.clear(); renderLibrary(); } } }, I('trash'), 'Delete'),
        h('button.btn.sm.ghost', { onclick: function () { selectMode = false; selected.clear(); renderLibrary(); } }, 'Done'));
    }

    var more = h('button.btn', { title: 'More', onclick: function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      UI.contextMenu(r.left, r.bottom + 6, [
        { icon: 'selectAll', label: selectMode ? 'Stop selecting' : 'Select several', onClick: function () { selectMode = !selectMode; selected.clear(); renderLibrary(); } },
        'sep',
        { icon: 'text', label: 'Arrange by name', onClick: function () { arrangeConfirm('library', 'name'); } },
        { icon: 'clock', label: 'Arrange by most played', onClick: function () { arrangeConfirm('library', 'played'); } },
        { icon: 'sparkle', label: 'Arrange by newest', onClick: function () { arrangeConfirm('library', 'new'); } },
        { icon: 'gamepad', label: 'Games first, then apps', onClick: function () { arrangeConfirm('library', 'kind'); } },
        { icon: 'move', label: 'How to move things', onClick: function () { moveHelp(); } }
      ]);
    } }, I('more'), h('span', 'More'));

    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Library'),
      h('p.page-sub', gamesN + ' game' + (gamesN === 1 ? '' : 's') + (appsN ? ' · ' + appsN + ' app' + (appsN === 1 ? '' : 's') : '') + ' · ' +
        (touch ? 'hold and drag to move things, hold to see options' : 'drag to move things, drop one on another to make a folder, right-click for options')),
      h('div.lib-toolbar',
        h('div.search', UI.icon('search'), search),
        viewControl('library', v, function () { renderLibrary(); }),
        more,
        h('button.btn.primary', { onclick: function () { Importer.addDialog(); } }, UI.icon('plus'), h('span', 'Add'))),
      chips, gridHost, bulk));
    renderGrid();
    if (selectMode) renderBulk();
  }

  async function arrangeConfirm(screen, how) {
    var names = { name: 'by name (A → Z)', played: 'by most played', new: 'newest first', kind: 'games first, then apps' };
    if (await UI.confirm('Arrange everything ' + names[how] + '?', 'This puts things in that order once. You can still drag them around after.', { ok: 'Arrange', icon: 'move' })) {
      Layout.arrange(screen, how);
      Sound.good();
    }
  }
  function moveHelp() {
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    UI.alert('Moving things around', h('div',
      h('ol.steps',
        h('li', touch ? 'Hold your finger on a game, then drag it to a new spot.' : 'Click and drag a game to a new spot.'),
        h('li', 'Drop it right on top of another game (wait for the glow) to make a folder, like on a phone.'),
        h('li', 'Click a folder to open it right there. Drag things out of it to take them out.'),
        h('li', 'Keyboard or controller: open the options (right-click / hold / X button) and pick ', h('b', 'Move'), ', then use the arrows.')),
      h('p.small.muted', 'Search and the Games / Apps / Favorites filters show things without folders, so moving works on "All".')), 'Got it', 'move');
  }

  /* =====================================================================
     APPS (like a phone home screen; apps open in windows)
     ===================================================================== */
  var appsQ = '';
  function renderApps() {
    var view = $('view-apps');
    var all = D.list('app');
    var v = Layout.view('apps');
    var search = all.length > 8 ? h('input.input', { type: 'search', placeholder: 'Search your apps…', 'aria-label': 'Search apps' }) : null;
    var gridHost = h('div.apps-grid-host');
    if (search) {
      search.value = appsQ;
      search.addEventListener('input', U.debounce(function () { appsQ = search.value; fill(); }, 100));
    }
    function fill() {
      var q = (appsQ || '').trim().toLowerCase();
      var nodes = q
        ? Layout.flat('apps').filter(function (g) { return (g.name + ' ' + (g.desc || '')).toLowerCase().indexOf(q) >= 0; }).map(function (g) { return { kind: 'item', key: 'g:' + g.id, g: g }; })
        : Layout.tree('apps');
      Grid.render(gridHost, {
        screen: q ? null : 'apps',
        nodes: nodes,
        mode: v.mode,
        size: v.size,
        expanded: D.ui.appsOpen || null,
        onExpand: function (fid) { D.ui.appsOpen = fid; D.saveUISoon(); },
        onOpen: function (g) { Player.launch(g.id); },
        onMenu: function (g, x, y, ctx) { gameMenu(g.id, x, y, ctx); },
        addTile: q ? null : { label: 'Add app', onClick: function () { Importer.addDialog({ kind: 'app' }); } },
        emptyEl: q ? h('div.empty-note', h('span.big', I('search')), 'No apps match that.') : null
      });
    }
    fill();

    var missing = D.missingBuiltins();
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var more = h('button.btn', { title: 'More', onclick: function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      UI.contextMenu(r.left, r.bottom + 6, [
        { icon: 'text', label: 'Arrange by name', onClick: function () { arrangeConfirm('apps', 'name'); } },
        { icon: 'sparkle', label: 'Arrange by newest', onClick: function () { arrangeConfirm('apps', 'new'); } },
        { icon: 'clock', label: 'Arrange by most used', onClick: function () { arrangeConfirm('apps', 'recent'); } },
        { icon: 'move', label: 'How to move things', onClick: function () { moveHelp(); } }
      ]);
    } }, I('more'), h('span', 'More'));
    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Apps'),
      h('p.page-sub', all.length
        ? 'Apps open in a window, so you can use a few at once (music keeps playing while you game). ' + (touch ? 'Hold and drag to move them, hold for options.' : 'Drag to move them, drop one on another to make a folder.')
        : 'Apps open in a window, so you can use a few at once. Add your own app files, or any website.'),
      h('div.lib-toolbar',
        search ? h('div.search', I('search'), search) : h('div.grow'),
        viewControl('apps', v, function () { renderApps(); }),
        more,
        h('button.btn', { onclick: function () { Importer.linkDialog({ kind: 'app' }); } }, I('globe'), h('span', 'Add a website')),
        h('button.btn.primary', { onclick: function () { Importer.addDialog({ kind: 'app' }); } }, I('plus'), h('span', 'Add app'))),
      gridHost,
      missing.length ? h('div.panel.builtin-back',
        h('div', h('b', 'Want the built-in apps back?'), h('span.muted', ' ' + missing.map(function (b) { return b.name; }).join(', '))),
        h('button.btn.sm', { onclick: async function (e) {
          e.currentTarget.disabled = true;
          var n = await D.restoreBuiltins();
          UI.toast(n ? 'Built-in apps are back!' : 'Couldn\'t get them. Are you offline?', { type: n ? 'good' : 'warn', icon: 'apps' });
          App.refresh();
        } }, I('restart'), 'Bring them back')) : null));
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
          h('button.btn.sm.adv', { onclick: function () { viewSaves(r.g.id); } }, I('eye'), 'View'),
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
    var games = D.list('game');
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
      Trophies.room(),
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
  /* advanced rows are hidden in Simple mode */
  function setRow(title, sub, control, advanced) { return h('div.set-row' + (advanced ? '.adv' : ''), h('div.st', h('b', title), sub ? h('span', sub) : null), control); }
  function set(key, val) { D.settings[key] = val; D.saveSettings(); App.applySettings(); }


  var SET_SECTIONS = [
    ['profile', 'user', 'Profile'],
    ['look', 'palette', 'Look'],
    ['home', 'home', 'Home & Library'],
    ['mode', 'sliders', 'Simple or Pro'],
    ['startup', 'resume', 'Start-up & games'],
    ['sound', 'volume', 'Sound'],
    ['capture', 'camera', 'Screenshots & recording'],
    ['vex', 'sparkle', 'VEX (your helper)'],
    ['notices', 'bell', 'Notifications'],
    ['data', 'lifebuoy', 'Backups & data'],
    ['website', 'globe', 'Website folder'],
    ['ai', 'sparkle', 'AI games'],
    ['app', 'monitor', 'App'],
    ['danger', 'warn', 'Danger zone']
  ];
  var setQuery = '';

  function renderSettings() {
    var view = $('view-settings');
    var st = D.settings;
    var nameIn = h('input.input', { value: st.name || '', maxlength: 24, style: { maxWidth: '200px' }, 'aria-label': 'Your name' });
    nameIn.value = st.name || '';
    nameIn.addEventListener('change', function () { set('name', nameIn.value.trim() || 'bro'); Trophies.event('name', { name: D.settings.name }); });
    var hotBtn = h('button.btn.sm', { onclick: function () { recordHotkey(hotBtn); } }, h('kbd', st.hotkey || 'F2'), ' change');
    var vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume, style: { maxWidth: '180px' }, 'aria-label': 'Volume' });
    vol.value = st.volume;
    vol.addEventListener('input', function () { D.settings.volume = Number(vol.value); Sound.setVolume(D.settings.volume); });
    vol.addEventListener('change', function () { D.saveSettings(); Sound.select(); });
    var autoSel = h('select.select', { style: { width: 'auto' }, 'aria-label': 'Auto-save', onchange: function () { set('autosaveSec', Number(autoSel.value)); } },
      [3, 5, 10, 20, 30].map(function (n) { return h('option', { value: n }, 'every ' + n + ' sec'); }));
    autoSel.value = String(st.autosaveSec || 5);
    var maxSel = h('select.select', { style: { width: 'auto' }, 'aria-label': 'Max recording length', onchange: function () { set('recMax', Number(maxSel.value)); } },
      [[1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [0, 'No limit']].map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    maxSel.value = String(st.recMax == null ? 10 : st.recMax);
    var meter = h('div');
    storageMeter(meter);

    function panel(id, rows) {
      var meta = SET_SECTIONS.find(function (x) { return x[0] === id; });
      return h('section.panel.set-sec', { id: 'set-' + id, 'data-sec': id }, h('h3', I(meta[1]), meta[2]), rows);
    }
    var sections = h('div.set-main',
      panel('profile', [
        setRow('Your name', 'What Game System (and VEX) calls you', nameIn),
        setRow('Picture and level', 'Upload a picture, make one with the AI or draw it. Your level and trophies are here too.',
          h('button.btn.sm.pf-open', { onclick: function () { Trophies.profile(); } }, Trophies.profileBadge(26), 'Open profile')),
        setRow('Trophies', Trophies.info().got + ' of ' + Trophies.info().total + ' unlocked · Level ' + Trophies.info().level,
          h('button.btn.sm', { onclick: function () { Trophies.open(); } }, I('trophy'), 'Trophy room'))
      ]),
      panel('look', [
        themePicker(),
        setRow('Moving background', 'Full = everything moves. Calm = slower, saves battery. Off = fastest for slow PCs.', seg([['insane', [I('bolt'), 'Full']], ['chill', [I('moon'), 'Calm']], ['off', [I('power'), 'Off']]], st.bg, function (v) { set('bg', v); })),
        setRow('Colors follow the game', 'On Home, the colors change to match the selected game\'s picture (on top of your theme)', sw(st.accentAuto, function (v) { set('accentAuto', v); })),
        setRow('Scanlines', 'Retro TV lines over everything', sw(st.scanlines, function (v) { set('scanlines', v); })),
        setRow('Less motion', 'Turns off most animations', sw(st.reduceMotion, function (v) { set('reduceMotion', v); }))
      ]),
      panel('home', [
        setRow('Home layout', 'How the Home screen is set up', seg([['console', 'Console'], ['games', 'All games'], ['steam', 'List + details']], st.homeLayout || 'console', function (v) { set('homeLayout', v); })),
        h('div.layout-previews',
          layoutPreview('console', 'Console', 'Big showcase + rows (Jump back in, Favorites, Apps…). Drag the rows into any order.'),
          layoutPreview('games', 'All games', 'Big showcase + every game below it.'),
          layoutPreview('steam', 'List + details', 'All your games in a list on the left, the picked one big on the right.')),
        setRow('Reset the row order', 'Put the Home rows back in the normal order', h('button.btn.sm', { onclick: function () { D.ui.homeRows = null; D.saveUI(); UI.toast('Rows reset', { icon: 'check' }); } }, I('restart'), 'Reset')),
        setRow('How things look', 'Each screen remembers its own look (small icons, big cards or a list). Change it with the buttons at the top of Home, Library and Apps.', null)
      ]),
      panel('mode', [
        setRow('Simple mode', 'Hides the code editor, the error console, raw save data and advanced settings. Turn it off for everything (Pro).', sw(D.simple(), function (v) { set('mode', v ? 'simple' : 'pro'); renderSettings(); }))
      ]),
      panel('startup', [
        setRow('"Press any key" screen', 'The console-style title screen when you open Game System', sw(st.titleScreen, function (v) { set('titleScreen', v); })),
        setRow('When I come back to a game', null, seg([['popup', 'Ask me'], ['auto', 'Jump right in'], ['menu', 'Just the menu']], st.resume, function (v) { set('resume', v); })),
        setRow('Quick menu key', 'Opens the menu while playing (or move the mouse to the top edge)', hotBtn, true),
        setRow('Auto-save games', 'How often games with the Save Kit save', autoSel, true)
      ]),
      panel('sound', [
        setRow('Menu sounds', 'The clicks and swooshes (they change with your theme)', sw(st.sounds, function (v) { set('sounds', v); })),
        setRow('Menu music', 'Chill background music in the menus, made to match your theme. It stops while you play a game or use the Music app.', sw(st.menuMusic, function (v) { set('menuMusic', v); })),
        setRow('Volume', null, vol)
      ]),
      panel('capture', [
        setRow('Screenshot key', 'Takes a screenshot anytime, in games too. Pick your own (like F8).', keyPicker('shotKey', 'Screenshot')),
        setRow('Record key', 'Press once to start recording, again to stop. Pick your own (like F9).', keyPicker('recKey', 'Record')),
        setRow('Sound in recordings', 'Game sound, game sound + your mic, or no sound', seg([['game', [I('volume'), 'Game']], ['mic', [I('mic'), 'Game + mic']], ['none', [I('x'), 'None']]], st.recSound || 'game', function (v) { set('recSound', v); renderSettings(); })),
        st.recSound === 'mic' ? setRow('Hear yourself', 'Hear your mic while recording. Use headphones, or it echoes!', sw(st.recMonitor, function (v) { set('recMonitor', v); })) : null,
        setRow('Quality', 'Higher = sharper and smoother, but bigger files. Now: about ' + Capture.mbPerMin(st.recQuality || 'med') + ' MB per minute (at most).', seg(Object.keys(Capture.QUALITY).map(function (k) { return [k, Capture.QUALITY[k].label]; }), st.recQuality || 'med', function (v) { set('recQuality', v); renderSettings(); })),
        setRow('Max length', 'A recording stops by itself after this long', maxSel),
        setRow('Screenshots to Downloads', 'They always go to the Gallery app. This also saves a copy in your Downloads.', sw(st.shotDownload, function (v) { set('shotDownload', v); })),
        setRow('Recordings to Downloads', 'Same, for videos', sw(st.recDownload, function (v) { set('recDownload', v); })),
        setRow('Floating camera button', 'A round button you can drag anywhere. Tap = screenshot, hold = record.', seg([['phone', 'Phones'], ['always', 'In games'], ['rec', 'While recording'], ['off', 'Off']], st.capFloat || 'phone', function (v) { set('capFloat', v); })),
        setRow('Controller', 'View/Select button: tap = screenshot, hold = record', sw(st.padCapture !== false, function (v) { set('padCapture', v); })),
        setRow('Gallery', 'All your screenshots, recordings and drawings', h('button.btn.sm', { onclick: function () { Capture.openGallery(); } }, I('image'), 'Open Gallery'))
      ]),
      panel('vex', vexRows()),
      panel('notices', [
        setRow('Backup reminder', 'The bell reminds you if your last backup is over a week old', sw(st.backupNag, function (v) { set('backupNag', v); }))
      ]),
      panel('data', [
        meter,
        h('div.act-grid', { style: { marginTop: '12px' }, 'data-text': 'backup restore import old games website check' },
          h('button.btn.primary', { onclick: function () { Backup.exportAll(); } }, I('lifebuoy'), 'Back up everything'),
          h('button.btn', { onclick: function () { Backup.pickRestore(); } }, I('download'), 'Restore a backup'),
          h('button.btn', { onclick: function () { Importer.importOldFolder(); } }, I('folder'), 'Import old games'),
          h('button.btn', { onclick: async function () { var n = await D.syncSiteGames(); UI.toast(n ? n + ' thing' + (n === 1 ? '' : 's') + ' from your website added/updated' : 'Website games are up to date', { icon: 'globe' }); } }, I('globe'), 'Check website games'))
      ]),
      panel('website', [
        h('p.muted', { style: { marginTop: 0 }, 'data-text': 'website netlify build folder' }, 'Builds one folder with Game System 2.0 + all your games and apps. Drag it onto Netlify and they work on ANY computer.'),
        h('button.btn.primary', { onclick: function () { Backup.buildSite(); }, 'data-text': 'build website folder netlify' }, I('box'), 'Build website folder')
      ]),
      panel('ai', [
        h('p.muted', { style: { marginTop: 0 }, 'data-text': 'ai rules chatgpt claude' }, 'Copy these rules into ChatGPT, Claude or any AI before asking for a game. Then the game works in Game System and continues where you left off.'),
        h('button.btn', { onclick: function () { aiRules(); }, 'data-text': 'ai rules show' }, I('sparkle'), 'Show the rules')
      ]),
      panel('app', [
        installPrompt ? setRow('Install as an app', 'Opens in its own window, like a real console', h('button.btn.sm.primary', { onclick: async function () { installPrompt.prompt(); try { await installPrompt.userChoice; } catch (e) { /* ignore */ } installPrompt = null; renderSettings(); } }, 'Install')) :
          setRow('Install as an app', 'In Chrome/Edge: click the install icon in the address bar (or the ⋮ menu → Install)', null),
        setRow('Version', null, h('span.tag', 'Game System ' + GS2Shared.APP_VERSION)),
        setRow('Updates', 'Game System checks by itself every time you open it. Press this to check right now.', h('button.btn.sm', { onclick: function () { App.checkUpdate(); } }, I('reload'), 'Check for updates'))
      ]),
      panel('danger', [
        setRow('Delete EVERYTHING', 'All games, saves, stats and settings. Make a backup first!', h('button.btn.sm.danger', { onclick: nukeAll }, 'Delete all'))
      ]));

    var q = h('input.input', { type: 'search', placeholder: 'Search settings…', 'aria-label': 'Search settings' });
    q.value = setQuery;
    var nav = h('nav.set-nav', { 'aria-label': 'Settings sections' },
      h('div.set-q', I('search'), q),
      SET_SECTIONS.map(function (x) {
        return h('button.set-link', { 'data-sec': x[0], onclick: function () {
          var el = document.getElementById('set-' + x[0]);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          nav.querySelectorAll('.set-link').forEach(function (b) { b.classList.toggle('on', b.dataset.sec === x[0]); });
        } }, I(x[1]), x[2]);
      }));
    function filter() {
      setQuery = q.value;
      var t = q.value.trim().toLowerCase();
      sections.querySelectorAll('.set-sec').forEach(function (sec) {
        var any = false;
        var title = sec.querySelector('h3').textContent.toLowerCase();
        sec.querySelectorAll('.set-row, [data-text], .layout-previews, .storage-meter').forEach(function (row) {
          var text = (row.textContent + ' ' + (row.dataset.text || '')).toLowerCase();
          var show = !t || text.indexOf(t) >= 0 || title.indexOf(t) >= 0;
          row.hidden = !show;
          if (show) any = true;
        });
        sec.hidden = !!t && !any && title.indexOf(t) < 0;
      });
      nav.querySelectorAll('.set-link').forEach(function (b) {
        var sec = document.getElementById('set-' + b.dataset.sec);
        b.hidden = !!(sec && sec.hidden);
      });
      empty.hidden = !t || sections.querySelector('.set-sec:not([hidden])');
    }
    var empty = h('div.empty-note', { hidden: true }, h('span.big', I('search')), 'No setting matches that.');
    q.addEventListener('input', filter);

    view.replaceChildren(h('div.page',
      h('h1.page-title', 'Settings'),
      h('p.page-sub', 'Make it yours, ' + (st.name || 'bro') + '.'),
      h('div.set-layout', nav, h('div', sections, empty))));
    if (setQuery) filter();
  }

  /* ---------------- themes ---------------- */
  function themeCard(th) {
    var on = (D.settings.theme || 'neon') === th.id;
    if (th.locked) on = false;
    var card = h('button.th-card' + (on ? '.on' : '') + (th.locked ? '.locked' : '') + (th.rainbow ? '.th-rainbow' : ''), {
      'aria-pressed': on ? 'true' : 'false', title: th.locked ? 'Unlocks at level ' + th.level : th.desc,
      onclick: function () {
        if (th.locked && !Trophies.hasLevel(th.level)) {
          Sound.error();
          UI.toast('Reach level ' + th.level + ' to unlock ' + th.name + '. You\'re level ' + Trophies.info().level + '. Get trophies to level up!', { icon: 'lock', type: 'warn', sound: false, actions: [{ label: 'Trophies', onClick: function () { Trophies.open(); } }] });
          return;
        }
        D.settings.theme = th.id;
        D.saveSettings();
        App.applySettings();
        Sound.sample();
        Trophies.event('theme', { id: th.id });
        renderSettings();
      }
    },
      h('span.th-pic.th-' + th.scene, { style: { '--a': th.accent, '--b': th.accent2, '--base': th.base } }, h('i'), h('i'), h('i'),
        th.locked ? h('span.th-lock', I('lock'), 'Level ' + th.level) : null),
      h('b', th.name),
      h('span', th.desc || ''),
      th.custom ? h('span.th-del', { role: 'button', tabindex: 0, title: 'Delete this theme', 'aria-label': 'Delete ' + th.name, onclick: async function (e) {
        e.stopPropagation();
        if (await UI.confirm('Delete "' + th.name + '"?', 'This removes the theme you made.', { ok: 'Delete', danger: true })) { Themes.remove(th.id); App.applySettings(); renderSettings(); }
      } }, I('x')) : null);
    return card;
  }
  function themePicker() {
    return h('div.th-wrap', { 'data-text': 'theme themes hacker lava ice neon colors' },
      h('div.th-head', h('b', 'Theme'), h('span', 'Changes the colors, the moving background, the letters, the sounds and the title screen.')),
      h('div.th-grid',
        Themes.list().map(themeCard),
        h('button.th-card.th-new', { onclick: function () { themeMaker(); } },
          h('span.th-pic', I('sparkle')), h('b', 'Make your own'), h('span', 'Describe it, or use a picture'))));
  }
  /* make a theme from words or a picture */
  function themeMaker() {
    var tab = 'words';
    var result = null;
    var before = D.settings.theme || 'neon';
    var desc = h('input.input', { placeholder: 'Like "purple galaxy with pink stars" or "toxic green hacker"', maxlength: 200, 'aria-label': 'Describe your theme' });
    var note = h('p.small.muted', { style: { minHeight: '20px', margin: '8px 0 0' } });
    var preview = h('div.tm-preview');
    var nameIn = h('input.input', { placeholder: 'Theme name', maxlength: 24, 'aria-label': 'Theme name' });
    var useAI = h('input', { type: 'checkbox', checked: true });
    var body = h('div');
    function show(t) {
      result = t;
      nameIn.value = t.name;
      var th = Themes.fromCustom(Object.assign({ id: 'preview' }, t));
      preview.replaceChildren(
        h('span.th-pic.th-' + th.scene, { style: { '--a': th.accent, '--b': th.accent2, '--base': th.base } }, h('i'), h('i'), h('i')),
        h('div.tm-info',
          h('div.tm-sw', [th.accent, th.accent2, th.base].map(function (c) { return h('span', { style: { background: c }, title: c }); })),
          h('span', 'Background: ' + ({ synth: 'retro sun', matrix: 'falling code', embers: 'lava + embers', snow: 'snow', stars: 'galaxy', waves: 'ocean waves' }[th.scene]) + ' · Letters: ' + ({ neon: 'neon', mono: 'terminal', soft: 'soft' }[th.font]))));
      /* try it on for real while the window is open */
      var root = document.documentElement;
      Object.keys(th.vars).forEach(function (k) { root.style.setProperty('--' + k, th.vars[k]); });
      BG.setScene(th.scene, th.base);
      App.setAccent(th.accent, th.accent2);
      saveBtn.disabled = false;
    }
    async function makeFromWords() {
      var d = desc.value.trim();
      if (!d) { UI.toast('Describe your theme first', { type: 'warn' }); return false; }
      note.style.color = '';
      note.textContent = useAI.checked ? 'The AI is thinking…' : '';
      makeBtn.disabled = true;
      var t = Themes.fromWords(d);
      if (useAI.checked) {
        try { t = await Themes.fromAI(d); note.textContent = 'Made by the AI. Like it? Save it. Not quite? Make another.'; }
        catch (e) { note.textContent = 'The AI didn\'t answer, so I made it myself from your words.'; }
      } else note.textContent = 'Made from your words.';
      makeBtn.disabled = false;
      show(t);
      return false;
    }
    function pickPicture(file) {
      if (!file) return;
      Themes.fromPicture(file, 'From a picture').then(function (t) { note.textContent = 'Made from your picture\'s colors.'; show(t); }, function (e) { note.textContent = e.message; });
    }
    function render() {
      body.replaceChildren(
        h('div.seg', { style: { marginBottom: '12px' } },
          h('button' + (tab === 'words' ? '.on' : ''), { onclick: function () { tab = 'words'; render(); } }, I('text'), ' Describe it'),
          h('button' + (tab === 'pic' ? '.on' : ''), { onclick: function () { tab = 'pic'; render(); } }, I('image'), ' From a picture')),
        tab === 'words'
          ? h('div', h('div.row', h('div.grow', desc), makeBtn), h('label.check-row.small', useAI, h('span', 'Let the free AI help (what you type is sent to Pollinations). Off = made right here, offline.')))
          : h('div', h('div.row',
              h('button.btn', { onclick: function () {
                var input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
                document.body.appendChild(input);
                input.addEventListener('change', function () { var f = input.files[0]; input.remove(); pickPicture(f); });
                input.click();
              } }, I('upload'), 'Pick a picture'),
              D.ui.sel && D.get(D.ui.sel) && D.get(D.ui.sel).cover ? h('button.btn', { onclick: function () { pickPicture(D.get(D.ui.sel).cover); } }, I('image'), 'Use "' + D.get(D.ui.sel).name + '" picture') : null)),
        note, preview, h('div.field', { style: { marginTop: '12px' } }, h('label', 'Name'), nameIn));
    }
    var makeBtn = h('button.btn.primary', { onclick: makeFromWords }, I('sparkle'), 'Make it');
    desc.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); makeFromWords(); } });
    var saved = false;
    var m = UI.modal({
      title: 'Make your own theme',
      icon: 'sparkle',
      wide: true,
      body: body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Save theme', icon: 'check', kind: 'primary', id: 'btn-save-theme', onClick: function () {
          if (!result) return false;
          result.name = nameIn.value.trim() || result.name;
          Themes.save(result);
          saved = true;
          Trophies.event('theme-make');
          App.applySettings();
          Sound.good();
          UI.toast('Theme "' + result.name + '" is on!', { type: 'good', icon: 'palette', sound: false });
          renderSettings();
        } }
      ],
      onClose: function () {
        if (!saved) { D.settings.theme = before; App.applySettings(); }
      }
    });
    var saveBtn = m.el.querySelector('#btn-save-theme');
    saveBtn.disabled = true;
    render();
    setTimeout(function () { desc.focus(); }, 60);
  }

  function layoutPreview(id, name, text) {
    var on = (D.settings.homeLayout || 'console') === id;
    return h('button.lp' + (on ? '.on' : ''), { onclick: function () { set('homeLayout', id); renderSettings(); }, 'aria-pressed': on ? 'true' : 'false' },
      h('span.lp-pic.lp-' + id, h('i'), h('i'), h('i'), h('i')),
      h('b', name), h('span', text));
  }

  /* ---------------- VEX settings ---------------- */
  function vexRows() {
    var st = D.settings;
    var rows = [setRow('VEX', 'Your helper orb. Click it, use your keys, or say its name.', sw(st.vexOn !== false, function (v) { set('vexOn', v); renderSettings(); }))];
    if (st.vexOn === false) return rows;
    var canHear = Vex.canHear();
    var wake = st.vexMicOk ? (st.vexWake || 'off') : 'off';
    rows.push(
      setRow('When nobody is talking', 'Show the little orb, or hide VEX until you call it', seg([['orb', 'Show the orb'], ['hidden', 'Hide until called']], st.vexIdle || 'orb', function (v) { set('vexIdle', v); })),
      setRow('Listen for its name', canHear ? 'After you allow the mic, just say "VEX" (or "Hey VEX") and it answers. Your browser\'s voice service hears what the mic hears while this is on.' : 'Your browser can\'t do voice (Chrome and Edge can). You can still type to VEX.',
        canHear ? seg([['off', 'Off'], ['name', '"VEX"'], ['hey', '"Hey VEX"']], wake, function (v) {
          if (v !== 'off' && !D.settings.vexMicOk) { Vex.allowMic().then(function (ok) { if (ok) { set('vexWake', v); } renderSettings(); }); return; }
          set('vexWake', v); Vex.setListening(v !== 'off');
        }) : null),
      setRow('Hold-to-talk key', 'Hold it down, talk, let go. Works in games too.', keyPicker('vexTalkKey', 'Talk to VEX')),
      setRow('Chat key', 'Opens and closes the VEX chat', keyPicker('vexChatKey', 'VEX chat')),
      setRow('Talk out loud', 'VEX reads its answers out loud', sw(st.vexSpeak !== false, function (v) { set('vexSpeak', v); renderSettings(); }))
    );
    if (st.vexSpeak !== false && window.speechSynthesis) {
      var voices = speechSynthesis.getVoices();
      var cur = Vex.pickVoice();
      var vsel = h('select.select', { style: { maxWidth: '230px' }, 'aria-label': 'VEX voice', onchange: function () { set('vexVoice', vsel.value); Vex.speak('Yo, this is my new voice!'); } },
        voices.length ? voices.map(function (v) { return h('option', { value: v.voiceURI }, v.name + ' (' + v.lang + ')'); }) : [h('option', { value: '' }, 'Default voice')]);
      if (cur) vsel.value = cur.voiceURI;
      if (!voices.length) setTimeout(function () { if (speechSynthesis.getVoices().length && D.ui.view === 'settings') renderSettings(); }, 800);
      var rate = h('input', { type: 'range', min: 0.7, max: 1.6, step: 0.05, value: st.vexRate || 1.05, 'aria-label': 'Speed', style: { maxWidth: '150px' } });
      rate.value = st.vexRate || 1.05;
      rate.addEventListener('change', function () { set('vexRate', Number(rate.value)); Vex.speak('This is how fast I talk.'); });
      var pitch = h('input', { type: 'range', min: 0.5, max: 1.7, step: 0.05, value: st.vexPitch || 1, 'aria-label': 'Pitch', style: { maxWidth: '150px' } });
      pitch.value = st.vexPitch || 1;
      pitch.addEventListener('change', function () { set('vexPitch', Number(pitch.value)); Vex.speak('This is how high or low I sound.'); });
      rows.push(setRow('Voice', 'Pick the voice you like (the list comes from your device)', vsel), setRow('Speed', null, rate), setRow('Pitch', null, pitch));
    }
    rows.push(
      setRow('Personality', 'How VEX talks to you', seg([['hype', 'Hype'], ['calm', 'Calm'], ['sarcastic', 'Sarcastic'], ['pro', 'Pro']], st.vexPersonality || 'hype', function (v) { set('vexPersonality', v); })),
      setRow('Ask before doing stuff', 'Big stuff = deleting, fixing or making games, sorting folders. Deleting always asks.', seg([['always', 'Always'], ['big', 'Big stuff'], ['never', 'Never']], st.vexAsk || 'big', function (v) { set('vexAsk', v); })),
      setRow('Brain', 'Simple stuff ("play Snake", "timer 5 min") always works without AI. For questions and making or fixing games: the free AI (what you ask, your name and your game names are sent to Pollinations), your own key (smarter; sent to the company you pick), or no AI.',
        seg([['free', 'Free AI'], ['key', 'My own key'], ['off', 'No AI']], st.vexBrain || 'free', function (v) { set('vexBrain', v); renderSettings(); }))
    );
    if (st.vexBrain === 'key') rows.push(vexKeyForm());
    var colors = [['neon', 'Neon'], ['plasma', Trophies.hasLevel(7) ? 'Plasma' : [I('lock'), 'Plasma (Lv 7)']], ['gold', Trophies.hasLevel(11) ? 'Gold' : [I('lock'), 'Gold (Lv 11)']]];
    rows.push(
      setRow('Orb color', 'More colors unlock as you level up', seg(colors, st.vexColor || 'neon', function (v) {
        if ((v === 'plasma' && !Trophies.hasLevel(7)) || (v === 'gold' && !Trophies.hasLevel(11))) { UI.toast('Level up to unlock that color! You\'re level ' + Trophies.info().level + '.', { type: 'warn', icon: 'lock' }); renderSettings(); return; }
        set('vexColor', v); Vex.repaint();
      })),
      setRow('Memory', Vex.memories().length + ' thing' + (Vex.memories().length === 1 ? '' : 's') + ' VEX remembers (say "remember that…")', h('div.row', { style: { gap: '6px' } },
        h('button.btn.sm', { onclick: vexMemoryDialog }, I('eye'), 'See'),
        h('button.btn.sm.ghost', { onclick: async function () { if (await UI.confirm('Forget everything?', 'VEX forgets all the things you told it to remember.', { ok: 'Forget', danger: true })) { Vex.forget(); renderSettings(); } } }, I('trash'), 'Forget all'))),
      setRow('Chat history', Vex.history().length + ' messages, kept forever', h('button.btn.sm.ghost', { onclick: async function () { if (await UI.confirm('Clear the chat?', 'Deletes all your messages with VEX.', { ok: 'Clear', danger: true })) { Vex.clearHistory(); renderSettings(); } } }, I('trash'), 'Clear')),
      setRow('Tour', 'Let VEX show you around again', h('button.btn.sm', { onclick: function () { Vex.tour(); } }, I('sparkle'), 'Show me around'))
    );
    return rows;
  }
  function vexKeyForm() {
    var k = VexBrain.keyInfo() || { provider: 'anthropic', key: '', model: '' };
    var names = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI', gemini: 'Google Gemini', openrouter: 'OpenRouter', custom: 'Other (OpenAI-style)' };
    /* a model name only works with its own company, so switching clears it */
    var prov = h('select.select', { 'aria-label': 'AI provider', onchange: function () { model.value = ''; model.placeholder = VexBrain.DEFAULT_MODELS[prov.value] || 'model name'; urlRow.hidden = prov.value !== 'custom'; } },
      Object.keys(names).map(function (p) { return h('option', { value: p }, names[p]); }));
    prov.value = k.provider || 'anthropic';
    var key = h('input.input', { type: 'password', placeholder: 'Paste your API key', autocomplete: 'off', 'aria-label': 'API key' });
    key.value = k.key || '';
    var model = h('input.input', { placeholder: VexBrain.DEFAULT_MODELS[prov.value] || 'model name', 'aria-label': 'Model' });
    model.value = k.model || '';
    var url = h('input.input', { placeholder: 'https://… (the part before /chat/completions)', 'aria-label': 'API address' });
    url.value = k.url || '';
    var urlRow = h('label.vk-wide', { hidden: prov.value !== 'custom' }, 'Address', url);
    function save() {
      U.lsSet('gs2:vexKey', { provider: prov.value, key: key.value.trim(), model: model.value.trim(), url: url.value.trim() });
    }
    return h('div.panel.vex-key', { 'data-text': 'api key claude openai gemini openrouter model' },
      h('div.vk-grid', h('label', 'Provider', prov), h('label', 'Model (empty = best default)', model), h('label.vk-wide', 'API key', key), urlRow),
      h('p.small.muted', 'Your key is saved only in this browser. It is NOT put in backups or in your website folder.'),
      h('div.row', { style: { gap: '6px' } },
        h('button.btn.sm.primary', { onclick: function () { save(); UI.toast('Key saved (only in this browser).', { type: 'good', icon: 'key' }); } }, I('check'), 'Save'),
        h('button.btn.sm', { onclick: async function () {
          save();
          var t = UI.toast('Testing…', { timeout: 0, sound: false });
          try { var r = await VexBrain.ai([{ role: 'user', content: 'Reply with exactly: VEX is online.' }], { system: 'You are a connection test. Follow the instruction exactly.', max: 300 }); t.close(); UI.toast('It works! The AI said: "' + String(r).trim().slice(0, 80) + '"', { type: 'good' }); }
          catch (e) { t.close(); UI.toast('Didn\'t work: ' + (e.message === 'busy' ? 'the AI is busy, try again soon' : e.message || e), { type: 'bad' }); }
        } }, I('bolt'), 'Test it'),
        h('button.btn.sm.ghost', { onclick: function () { U.lsSet('gs2:vexKey', null); renderSettings(); UI.toast('Key removed.', { icon: 'trash' }); } }, I('trash'), 'Remove key')));
  }
  function vexMemoryDialog() {
    var list = Vex.memories();
    UI.modal({
      title: 'What VEX remembers',
      icon: 'sparkle',
      body: list.length ? h('div.vex-mem', list.map(function (m) {
        return h('div.vm-row', h('span', m.text), h('em', U.timeAgo(m.t)), h('button.icon-btn.sm', { 'aria-label': 'Forget this', title: 'Forget this', onclick: function () { Vex.forget(m.text, true); this.closest('.vm-row').remove(); } }, I('x')));
      })) : h('p.muted', 'Nothing yet. Tell VEX "remember that I like racing games".'),
      actions: [{ label: 'Done', kind: 'primary' }]
    });
  }

  /* pick a key for screenshots / recording */
  function keyPicker(key, label) {
    var cur = D.settings[key] || '';
    var btn = h('button.btn.sm' + (cur ? '' : '.ghost'), { onclick: function () { listen(); } }, cur ? h('kbd', cur) : 'Pick a key');
    var clear = cur ? h('button.icon-btn.sm', { title: 'No key', 'aria-label': 'Remove the ' + label + ' key', onclick: function () { set(key, ''); renderSettings(); } }, I('x')) : null;
    function listen() {
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
        if (/^[A-Z0-9 ]$/.test(k) && !e.ctrlKey && !e.altKey) { UI.toast('A plain letter would clash with games. Use an F-key (like F8) or add Ctrl/Alt.', { type: 'warn' }); renderSettings(); return; }
        if (/^(F5|F11|F12|Tab|Enter|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(combo)) { UI.toast(combo + ' is used by the browser or menus. Pick another one.', { type: 'warn' }); renderSettings(); return; }
        var taken = [['hotkey', 'the quick menu'], ['shotKey', 'screenshots'], ['recKey', 'recording'], ['vexTalkKey', 'talking to VEX'], ['vexChatKey', 'the VEX chat']].find(function (o) { return o[0] !== key && String(D.settings[o[0]] || (o[0] === 'hotkey' ? 'F2' : '')).toLowerCase() === combo.toLowerCase(); });
        if (taken) { UI.toast(combo + ' is already the key for ' + taken[1] + '.', { type: 'warn' }); renderSettings(); return; }
        set(key, combo);
        UI.toast(label + ' key is now ' + combo, { icon: 'keyboard' });
        renderSettings();
      }
      window.addEventListener('keydown', onKey, true);
    }
    return h('div.row', { style: { gap: '6px' } }, btn, clear);
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
      if ([D.settings.shotKey, D.settings.recKey, D.settings.vexTalkKey, D.settings.vexChatKey].some(function (k) { return k && k.toLowerCase() === combo.toLowerCase(); })) {
        UI.toast(combo + ' is already used for screenshots, recording or VEX.', { type: 'warn' });
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
    var kitText = await Upgrade.kitSnippet();
    var hk = D.settings.hotkey || 'F2';
    var rules = [
      'I\'m making a game for my Game System 2.0. Follow these rules exactly:',
      '',
      '1. Put EVERYTHING in ONE single .html file (HTML + CSS + JavaScript together). No other files.',
      '2. Don\'t use image or sound files. Draw graphics with code (canvas, WebGL or CSS) and make sounds with the Web Audio API. If you need a library like three.js, load it from https://cdn.jsdelivr.net/npm/...'
    ].concat(Upgrade.saveRules(kitText, 3)).concat([
      '7. It must work with keyboard + mouse on a PC AND with touch on a phone (add on-screen buttons when the device has a touch screen). Fill the whole window and handle the window being resized.',
      '8. Don\'t use alert(), confirm() or prompt(). Show messages inside the game instead.',
      '9. Don\'t use the ' + hk + ' key in the game (Game System uses it for its menu).',
      '10. Send the COMPLETE file every time. Never write "rest of the code stays the same". If it\'s too long for one message, stop at a clean spot and I\'ll say "continue".',
      '',
      'Now make this game: '
    ]).join('\n');
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

  /* first start: Simple or Pro? */
  function askMode() {
    return new Promise(function (resolve) {
      var picked = false;
      function pick(mode) {
        picked = true;
        D.settings.mode = mode;
        D.saveSettings();
        App.applySettings();
        Sound.good();
        m.close();
        UI.toast(mode === 'simple' ? 'Simple mode on. You can switch to Pro anytime in Settings.' : 'Pro mode: everything is on.', { icon: 'sliders', sound: false });
        resolve(mode);
      }
      var m = UI.modal({
        title: 'How do you want it?',
        icon: 'sliders',
        wide: true,
        dismissible: false,
        body: h('div',
          h('p', 'Pick how much stuff you want to see. You can change it anytime in Settings.'),
          h('div.mode-pick',
            h('button.mode-card', { onclick: function () { pick('simple'); } },
              h('span.mc-big', I('smile')), h('b', 'Simple'),
              h('span', 'Just play. Fewer buttons, no code stuff. Perfect for most people.')),
            h('button.mode-card', { onclick: function () { pick('pro'); } },
              h('span.mc-big', I('code')), h('b', 'Pro'),
              h('span', 'Everything: code editor, error console, raw saves, advanced settings.')))),
        onClose: function () { if (!picked) resolve(null); }
      });
    });
  }

  window.Views = {
    askMode: askMode,
    render: function (name) {
      if (name === 'home') renderHome();
      else if (name === 'library') renderLibrary();
      else if (name === 'apps') renderApps();
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
