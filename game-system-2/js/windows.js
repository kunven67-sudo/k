/* Game System 2.0 — app windows.
   Apps open in windows on top of the menu: drag them by the title bar, resize from the corner,
   double-click the title bar (or press the square button) to make them full size, minimize them
   to the taskbar, and open several at once. On phones they fill the screen.
   Open windows come back after a restart (apps that use the Save Kit even come back to the same spot).
   Websites that refuse to be shown inside another site open in their own popup window. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;

  var wins = new Map();
  var zTop = 10;
  var orderSeq = 0;
  var activeId = null;
  var layer = null;
  var dock = null;

  /* Big sites that block being shown inside other websites */
  var BLOCKED = /(^|\.)(youtube\.com|youtu\.be|spotify\.com|discord\.com|discord\.gg|google\.[a-z.]+|gmail\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|netflix\.com|github\.com|amazon\.[a-z.]+|twitch\.tv|roblox\.com|chatgpt\.com|openai\.com|claude\.ai|microsoft\.com|live\.com|office\.com|apple\.com|whatsapp\.com|snapchat\.com|linkedin\.com|pinterest\.com|paypal\.com)$/i;

  var DOCK_H = 64;
  function isPhone() { return window.innerWidth < 620; }
  /* the part of the screen windows can use: below the top bar, above the taskbar (and the phone tab bar) */
  function area() {
    var top = 68;
    var bar = document.querySelector('.topbar');
    if (bar) top = Math.round(bar.getBoundingClientRect().bottom) || top;
    var bottom = window.innerHeight;
    if (isPhone()) {
      var tabs = document.getElementById('tabs');
      var r = tabs && tabs.getBoundingClientRect();
      if (r && r.height && r.top > top) bottom = Math.round(r.top);
    }
    if (wins.size) bottom -= DOCK_H;
    return { x: 0, y: top, w: window.innerWidth, h: Math.max(160, bottom - top) };
  }

  function wantsPopup(g) {
    if (!g || g.source !== 'link') return false;
    if (g.linkMode === 'popup') return true;
    if (g.linkMode === 'inside') return false;
    try {
      var u = new URL(g.url);
      var host = u.hostname.replace(/^www\./, '');
      if (/(^|\.)youtube(-nocookie)?\.com$/.test(host) && u.pathname.indexOf('/embed/') === 0) return false;
      return BLOCKED.test(host);
    } catch (e) { return true; }
  }

  function openPopup(g) {
    var sw = screen.availWidth || window.innerWidth, sh = screen.availHeight || window.innerHeight;
    var w = Math.min((g.win && g.win.w) || 1200, sw - 60), hh = Math.min((g.win && g.win.h) || 820, sh - 60);
    var left = Math.max(0, Math.round((sw - w) / 2)), top = Math.max(0, Math.round((sh - hh) / 2));
    var pw = null;
    try { pw = window.open(g.url, 'gs2app-' + g.id, 'popup=yes,width=' + w + ',height=' + hh + ',left=' + left + ',top=' + top); } catch (e) { pw = null; }
    if (!pw) {
      UI.toast('Your browser blocked the popup window.', {
        type: 'warn', timeout: 9000,
        actions: [{ label: 'Open in a new tab', kind: 'primary', onClick: function () { window.open(g.url, '_blank', 'noopener'); } }]
      });
      return false;
    }
    try { pw.opener = null; } catch (e) { /* ignore */ }
    try { pw.focus(); } catch (e) { /* ignore */ }
    D.updateGame(g.id, { lastPlayed: Date.now(), launches: (g.launches || 0) + 1 });
    Sound.open();
    UI.toast('"' + g.name + '" opened in its own window.', { icon: 'popout', sound: false });
    return true;
  }

  function ensureLayer() {
    if (layer) return layer;
    layer = document.getElementById('windows');
    dock = document.getElementById('win-dock');
    window.addEventListener('resize', U.debounce(function () { wins.forEach(place); positionDock(); }, 80));
    /* clicking inside an app (an iframe) doesn't reach this page, but the page loses focus: raise that window */
    window.addEventListener('blur', function () {
      setTimeout(function () {
        var a = document.activeElement;
        if (a && a.tagName === 'IFRAME') {
          var el = a.closest('.app-win');
          if (el && wins.has(el.dataset.id)) raise(wins.get(el.dataset.id));
        }
      }, 0);
    });
    /* keep titles/pictures fresh, and close windows of apps that were deleted */
    D.on(function (type, id) {
      if (type === 'games') {
        Array.from(wins.keys()).forEach(function (wid) { if (!D.get(wid)) close(wid, { quiet: true }); });
        wins.forEach(refreshLook);
        renderDock();
      } else if (type === 'game' && wins.has(id)) {
        refreshLook(wins.get(id));
        renderDock();
      }
    });
    return layer;
  }

  function refreshLook(W) {
    var g = D.get(W.id);
    if (!g) return;
    W.g = g;
    if (W.title.textContent !== g.name) W.title.textContent = g.name;
    W.el.setAttribute('aria-label', g.name);
    var key = g.art + '|' + g.emoji + '|' + g.color + '|' + g.name;
    if (key !== W.artKey || g.cover !== W.cover) {
      W.artKey = key;
      W.cover = g.cover;
      W.ico.replaceChildren(UI.art(g, { noName: true }));
    }
  }

  function ordered() {
    return Array.from(wins.values()).sort(function (a, b) { return a.z - b.z; });
  }

  function persist() {
    D.ui.windows = ordered().map(function (W) {
      return { id: W.id, x: Math.round(W.x), y: Math.round(W.y), w: Math.round(W.w), h: Math.round(W.h), max: !!W.max, min: !!W.min };
    });
    D.saveUISoon();
  }

  function place(W) {
    var A = area();
    var el = W.el;
    var max = W.max || isPhone();
    el.classList.toggle('max', max);
    el.classList.toggle('min', !!W.min);
    if (max) {
      el.style.left = A.x + 'px';
      el.style.top = A.y + 'px';
      el.style.width = A.w + 'px';
      el.style.height = A.h + 'px';
      return;
    }
    W.w = Math.max(Math.min(300, A.w), Math.min(W.w, A.w));
    W.h = Math.max(Math.min(200, A.h), Math.min(W.h, A.h));
    /* always keep a piece of the title bar on screen so the window can be dragged back */
    W.x = Math.max(90 - W.w, Math.min(W.x, A.w - 90));
    W.y = Math.max(A.y, Math.min(W.y, A.y + A.h - 44));
    el.style.left = W.x + 'px';
    el.style.top = W.y + 'px';
    el.style.width = W.w + 'px';
    el.style.height = W.h + 'px';
  }

  function placeAll() { wins.forEach(place); }

  function raise(W) {
    if (!W) return;
    if (W.min) { W.min = false; place(W); }
    if (activeId !== W.id || W.z < zTop) {
      W.z = ++zTop;
      W.el.style.zIndex = W.z;
    }
    setActive(W);
    persist();
    phoneBack();
  }
  function setActive(W) {
    activeId = W ? W.id : null;
    wins.forEach(function (o) { o.el.classList.toggle('active', o === W); });
    renderDock();
  }
  function visibleWins() { return ordered().filter(function (W) { return !W.min; }); }

  /* after closing/minimizing the top window, the next one becomes active */
  function activateNext() {
    var list = visibleWins();
    setActive(list[list.length - 1] || null);
    phoneBack();
  }

  /* ---- phone Back button: closes (minimizes) the app on top instead of leaving the site ---- */
  var ignorePop = false;
  function phoneBack() {
    var want = isPhone() && visibleWins().length > 0;
    var st = history.state && history.state.gs2;
    if (want && !st) { try { history.pushState({ gs2: 'win' }, ''); } catch (e) { /* ignore */ } }
    else if (!want && st === 'win') { ignorePop = true; history.back(); }
  }
  window.addEventListener('popstate', function (e) {
    if (e.gs2Handled) return;
    if (ignorePop) { ignorePop = false; return; }
    if (history.state && history.state.gs2) return;
    if (UI.modalCount() || (window.Player && Player.isPlaying())) return;
    var list = visibleWins();
    if (!list.length || !isPhone()) return;
    minimize(list[list.length - 1]);
  });

  function kit(W) {
    try {
      var w = W.frame && W.frame.contentWindow;
      return w && w.GameSystem && w.GameSystem.__real ? w.GameSystem : null;
    } catch (e) { return null; }
  }

  function focusApp(W) {
    try { W.frame.focus(); } catch (e) { /* ignore */ }
    try { if (W.frame.contentWindow) W.frame.contentWindow.focus(); } catch (e) { /* cross-origin website */ }
  }

  /* opts: { restore: true } when bringing windows back after a restart, { geo } = saved position */
  async function open(id, opts) {
    opts = opts || {};
    var g = D.get(id);
    if (!g) return null;
    if (wins.has(id)) {
      var ex = wins.get(id);
      raise(ex);
      if (opts.fresh) reload(ex);
      if (!opts.restore) { Sound.open(); focusApp(ex); }
      return ex;
    }
    if (wantsPopup(g)) {
      if (!opts.restore) { openPopup(g); Trophies.event('app', { id: id, open: wins.size + 1 }); }
      return null;
    }
    ensureLayer();
    var geo = opts.geo || null;
    var dw = (g.win && g.win.w) || 900, dh = (g.win && g.win.h) || 600;
    var W = {
      id: id, g: g,
      w: geo ? Number(geo.w) || dw : dw,
      h: geo ? Number(geo.h) || dh : dh,
      max: geo ? !!geo.max : false,
      min: geo ? !!geo.min : false,
      frame: null, el: null, z: 0, artKey: '', cover: undefined, order: ++orderSeq
    };
    var n = ordered().filter(function (o) { return !o.min; }).length;
    wins.set(id, W);
    if (!opts.restore) Trophies.event('app', { id: id, open: wins.size });
    var A = area();
    if (geo && isFinite(geo.x) && isFinite(geo.y)) { W.x = Number(geo.x); W.y = Number(geo.y); }
    else {
      W.w = Math.min(W.w, A.w - 40);
      W.h = Math.min(W.h, A.h - 30);
      W.x = Math.round((A.w - W.w) / 2 + (n % 5) * 32 - 32);
      W.y = Math.round(A.y + Math.max(10, (A.h - W.h) / 2) + (n % 5) * 28 - 28);
    }
    W.logs = new Player.LogStore(function () { updateErr(W); });

    var errBtn = h('button.aw-err', { hidden: true, title: 'This app had an error', onclick: function () { showErrors(W); } }, I('warn'), h('b', '0'));
    W.title = h('span.aw-title', g.name);
    W.ico = h('div.aw-ico');
    var bar = h('div.aw-bar',
      W.ico,
      W.title,
      h('div.grow'),
      errBtn,
      g.source === 'link' ? h('button.aw-btn', { title: 'Open in its own window', 'aria-label': 'Open in its own window', onclick: function () { popOut(W); } }, I('popout')) : null,
      h('button.aw-btn', { title: 'Reload', 'aria-label': 'Reload', onclick: function () { reload(W); } }, I('reload')),
      h('button.aw-btn', { title: 'Minimize', 'aria-label': 'Minimize', onclick: function () { minimize(W); } }, I('minus')),
      h('button.aw-btn.aw-max', { title: 'Full size', 'aria-label': 'Full size', onclick: function () { toggleMax(W); } }, I('full')),
      h('button.aw-btn.aw-close', { title: 'Close', 'aria-label': 'Close', onclick: function () { close(id); } }, I('x')));
    var frame = h('iframe', { title: g.name, allow: 'autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; microphone; camera; screen-wake-lock; midi' });
    var grip = h('div.aw-grip', { title: 'Drag to resize' });
    var el = h('div.app-win', { role: 'dialog', 'aria-label': g.name, dataset: { id: id } }, bar, h('div.aw-body', frame, h('div.aw-shield')), grip);
    W.el = el;
    W.frame = frame;
    W.errBtn = errBtn;
    refreshLook(W);

    el.addEventListener('pointerdown', function () { if (!el.classList.contains('active')) raise(W); }, true);
    bar.addEventListener('dblclick', function (e) { if (!e.target.closest('button')) toggleMax(W); });
    dragger(W, bar);
    resizer(W, grip);

    W.unsink = Player.addSink(id, {
      log: function (level, text, meta) { W.logs.add(level, text, meta); },
      saved: function () {},
      kitInfo: function (info) { if (info.autosave && !(D.get(id) || {}).kitAutosave) D.updateGame(id, { kitAutosave: true }); }
    });

    layer.appendChild(el);
    placeAll();
    if (W.min) { W.z = ++zTop; el.style.zIndex = W.z; renderDock(); persist(); } else raise(W);
    if (!opts.restore) {
      Sound.open();
      D.updateGame(id, { lastPlayed: Date.now(), launches: (g.launches || 0) + 1 });
    }
    var src;
    try { src = await Player.srcFor(g); } catch (err) {
      UI.toast(err.message || String(err), { type: 'bad', title: 'Can\'t open the app' });
      close(id, { quiet: true });
      return null;
    }
    if (wins.get(id) !== W) return null;
    /* tell the app it was brought back after a restart (the Music app keeps playing then) */
    if (opts.restore && typeof src === 'string' && g.source !== 'link') src += (src.indexOf('?') < 0 ? '?' : '&') + 'gs2restore=1';
    Player.setFrameSrc(frame, src);
    if (!opts.restore) {
      frame.addEventListener('load', function onl() {
        frame.removeEventListener('load', onl);
        if (wins.get(id) === W && !W.min && activeId === id) focusApp(W);
      });
    }
    return W;
  }

  function dragger(W, bar) {
    var start = null;
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button') || W.max || isPhone()) return;
      start = { px: e.clientX, py: e.clientY, x: W.x, y: W.y };
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      layer.classList.add('dragging');
      e.preventDefault();
    });
    bar.addEventListener('pointermove', function (e) {
      if (!start) return;
      W.x = start.x + e.clientX - start.px;
      W.y = start.y + e.clientY - start.py;
      place(W);
    });
    function end() {
      if (!start) return;
      start = null;
      layer.classList.remove('dragging');
      persist();
    }
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('lostpointercapture', end);
  }

  function resizer(W, grip) {
    var start = null;
    grip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || W.max || isPhone()) return;
      start = { px: e.clientX, py: e.clientY, w: W.w, h: W.h };
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      layer.classList.add('dragging');
      e.preventDefault();
    });
    grip.addEventListener('pointermove', function (e) {
      if (!start) return;
      W.w = start.w + e.clientX - start.px;
      W.h = start.h + e.clientY - start.py;
      place(W);
    });
    function end() {
      if (!start) return;
      start = null;
      layer.classList.remove('dragging');
      persist();
    }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('lostpointercapture', end);
  }

  function toggleMax(W) {
    W.max = !W.max;
    place(W);
    raise(W);
  }

  function minimize(W) {
    if (W.min) return;
    W.min = true;
    place(W);
    Sound.back();
    try { if (W.el.contains(document.activeElement) || document.activeElement === W.frame) document.activeElement.blur(); } catch (e) { /* ignore */ }
    activateNext();
    persist();
  }

  function popOut(W) {
    var g = D.get(W.id) || W.g;
    if (openPopup(g)) close(W.id, { quiet: true });
  }

  async function reload(W) {
    flush(W);
    W.logs.clear();
    Player.blankFrame(W.frame);
    var src = await Player.srcFor(D.get(W.id) || W.g);
    setTimeout(function () { if (wins.get(W.id) === W) Player.setFrameSrc(W.frame, src); }, 30);
  }

  function flush(W) {
    var k = kit(W);
    if (!k || !k._flush) return false;
    try {
      var json = k._flush();
      if (json != null) { D.putSave(W.id, json, Date.now()).catch(function () {}); return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  function close(id, opts) {
    opts = opts || {};
    var W = wins.get(id);
    if (!W) return;
    var flushed = flush(W);
    if (W.unsink) W.unsink();
    Player.blankFrame(W.frame);
    W.el.classList.remove('active');
    W.el.classList.add('closing');
    setTimeout(function () { W.el.remove(); }, 170);
    wins.delete(id);
    if (flushed) { try { localStorage.removeItem('gs2:emerg:' + id); } catch (e) { /* ignore */ } }
    if (activeId === id || !wins.size) activateNext(); else renderDock();
    placeAll();
    persist();
    if (!opts.quiet) Sound.back();
    if (D.ui.view === 'apps') App.refresh();
  }

  /* phones: the taskbar sits right above the tab bar */
  function positionDock() {
    if (!dock) return;
    var tabs = isPhone() && document.getElementById('tabs');
    var r = tabs && tabs.getBoundingClientRect();
    dock.style.bottom = r && r.height ? Math.round(window.innerHeight - r.top + 6) + 'px' : '';
  }

  /* the taskbar at the bottom: one button per open app */
  function renderDock() {
    if (!dock) return;
    positionDock();
    var list = Array.from(wins.values());
    dock.hidden = !list.length;
    document.body.classList.toggle('has-windows', !!list.length);
    if (!list.length) { dock.replaceChildren(); return; }
    list.sort(function (a, b) { return a.order - b.order; });
    var anyShown = list.some(function (W) { return !W.min; });
    var hideAll = h('button.wd-all', {
      title: anyShown ? 'Minimize all windows' : 'Show all windows',
      'aria-label': anyShown ? 'Minimize all windows' : 'Show all windows',
      onclick: function () { if (anyShown) minimizeAll(); else showAll(); Sound.select(); }
    }, I(anyShown ? 'minus' : 'win'));
    dock.replaceChildren.apply(dock, [hideAll].concat(list.map(function (W) {
      var g = D.get(W.id) || W.g;
      var on = activeId === W.id && !W.min;
      var b = h('button.wd-item' + (on ? '.on' : '') + (W.min ? '.mini' : ''), {
        title: g.name + (W.min ? ' (minimized)' : ''),
        'aria-label': g.name + (W.min ? ' (minimized)' : ''),
        dataset: { id: W.id },
        onclick: function () {
          if (on) minimize(W);
          else { raise(W); focusApp(W); Sound.select(); }
        },
        oncontextmenu: function (e) { e.preventDefault(); dockMenu(W, e.clientX, e.clientY); }
      }, h('span.wd-art', UI.art(g, { noName: true })), h('span.wd-name', g.name));
      UI.longPress(b, function (x, y) { dockMenu(W, x, y); });
      return b;
    })));
  }
  function dockMenu(W, x, y) {
    UI.contextMenu(x, y, [
      { icon: W.min ? 'win' : 'minus', label: W.min ? 'Show' : 'Minimize', onClick: function () { if (W.min) raise(W); else minimize(W); } },
      { icon: 'reload', label: 'Reload', onClick: function () { reload(W); } },
      { icon: 'x', label: 'Close', danger: true, onClick: function () { close(W.id); } }
    ]);
  }

  /* switching screens: get full-size windows out of the way so you can see the screen */
  function uncover() {
    var any = false;
    wins.forEach(function (W) {
      if (!W.min && (W.max || isPhone())) { W.min = true; place(W); any = true; }
    });
    if (any) { activateNext(); persist(); }
  }

  /* minimize everything (the taskbar button, or clicking the tab you're already on) */
  function minimizeAll() {
    var any = false;
    wins.forEach(function (W) { if (!W.min) { W.min = true; place(W); any = true; } });
    if (any) { activateNext(); persist(); }
    return any;
  }
  function showAll() {
    var list = ordered();
    list.forEach(function (W) { if (W.min) { W.min = false; place(W); } });
    if (list.length) raise(list[list.length - 1]);
  }

  function updateErr(W) {
    var n = W.logs.errors;
    W.errBtn.hidden = !n;
    W.errBtn.querySelector('b').textContent = n;
  }

  function showErrors(W) {
    var list = h('div.con-list', { style: { maxHeight: '50vh' } });
    Player.renderConsole(list, W.logs, { filter: 'all' });
    UI.modal({
      title: (D.get(W.id) || W.g).name + ': errors',
      icon: 'bug',
      wide: true,
      body: list,
      actions: [
        { label: 'Copy errors for AI', icon: 'clipboard', onClick: async function () {
          var txt = await Player.aiReport(D.get(W.id), W.logs.rows);
          if (!txt) { UI.toast('No errors to copy.', { sound: false }); return false; }
          await U.copyText(txt);
          UI.toast('Copied! Paste it to the AI.', { icon: 'clipboard' });
          return false;
        } },
        { label: 'Close', kind: 'primary' }
      ]
    });
  }

  /* bring back the windows that were open last time (bottom one first, so the top one ends on top) */
  function restoreAll() {
    var list = (Array.isArray(D.ui.windows) ? D.ui.windows : []).filter(function (s) {
      return s && typeof s.id === 'string' && D.get(s.id);
    });
    D.ui.windows = list;
    list.forEach(function (s) { open(s.id, { restore: true, geo: s }); });
    /* the menu zooms in when it appears: measure again once it settled */
    if (list.length) setTimeout(placeAll, 900);
  }

  /* the browser/PC is closing: save every open app right now */
  function onPageHide() {
    wins.forEach(function (W) {
      var k = kit(W);
      if (!k || !k._flush) return;
      try {
        var json = k._flush();
        if (json == null) return;
        D.putSave(W.id, json, Date.now()).catch(function () {});
        if (json.length < 1500000) localStorage.setItem('gs2:emerg:' + W.id, JSON.stringify({ data: json, t: Date.now() }));
      } catch (e) { /* ignore */ }
    });
    persist();
  }

  window.Win = {
    open: open,
    close: close,
    isOpen: function (id) { return wins.has(id); },
    isMinimized: function (id) { var W = wins.get(id); return !!(W && W.min); },
    openIds: function () { return Array.from(wins.keys()); },
    count: function () { return wins.size; },
    restoreAll: restoreAll,
    wantsPopup: wantsPopup,
    uncover: uncover,
    minimizeAll: minimizeAll,
    onPageHide: onPageHide,
    flushAll: function () { wins.forEach(flush); }
  };
})();
