/* Game System 2.0 — the game player: launching, quick menu, errors/console, play time, resume. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  function el(id) { return document.getElementById(id); }

  var TIPS = [
    'Press <kbd>{key}</kbd> or move your mouse to the very top for the quick menu.',
    'Games that use the Save Kit continue exactly where you left off, even after your PC turns off.',
    'If a game breaks, a red badge shows up in the corner. Click it to see what went wrong.',
    'Drop a picture onto Game System to make it the cover of the selected game.',
    'Back up your games in Settings so you never lose them.',
    'Use "Paste code" to add AI-made games. I\'ll tell you if the AI\'s code got cut off.',
    'In the quick menu, "Use screenshot as cover" snaps the game for its cover art.',
    'Arrow keys or a controller work everywhere in the menus.'
  ];

  /* ---------------- who receives messages from the game kit ---------------- */
  var sinks = new Map();
  function addSink(id, sink) {
    var arr = sinks.get(id) || [];
    arr.push(sink);
    sinks.set(id, arr);
    return function () {
      var a = sinks.get(id) || [];
      var i = a.indexOf(sink);
      if (i >= 0) a.splice(i, 1);
      if (!a.length) sinks.delete(id);
    };
  }
  function sinkFor(id) { var a = sinks.get(id); return a && a.length ? a[a.length - 1] : null; }

  var Host = {
    save: function (id, json, t, kind) {
      var sk = sinkFor(id);
      if (!sk || sk.blocked || typeof json !== 'string') return;
      D.putSave(id, json, t).then(function () {
        var s = sinkFor(id);
        if (s && s.saved) s.saved(t, kind);
      }).catch(function (err) {
        ptoast('Couldn\'t save progress: ' + (err && err.message), 'bad');
      });
    },
    clearSave: function (id) { if (sinkFor(id)) D.deleteSave(id); },
    log: function (id, level, text, meta) {
      var s = sinkFor(id);
      if (s) s.log(String(level || 'log'), String(text == null ? '' : text), meta || {});
    },
    menu: function (id) { if (cur && cur.id === id) toggleMenu(); },
    edge: function (id) { if (cur && cur.id === id) showPill(); },
    toast: function (id, msg) { if (cur && cur.id === id) ptoast(String(msg)); else UI.toast(String(msg)); },
    quit: function (id) {
      if (id && window.Win && Win.isOpen(id)) { setTimeout(function () { Win.close(id); }, 0); return; }
      if (cur && (!id || cur.id === id)) setTimeout(function () { close(); }, 0);
    },
    /* an app (like Drawing) offers a picture to use as a game/app picture */
    picture: function (id, dataUrl) {
      if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl) || dataUrl.length > 12000000) return false;
      if (!sinkFor(id)) return false;
      setTimeout(function () { Pics.useFor(U.dataUrlToBlob(dataUrl), id); }, 0);
      return true;
    },
    ready: function (id, info) { var s = sinkFor(id); if (s && s.ready) s.ready(info || {}); },
    kitInfo: function (id, info) { var s = sinkFor(id); if (s && s.kitInfo) s.kitInfo(info || {}); }
  };
  window.__GS2_HOST = Host;

  /* ---------------- log store (shared by the player + editor preview) ---------------- */
  function LogStore(onChange) {
    this.rows = [];
    this.errors = 0;
    this.onChange = onChange;
    this.recentMissing = {};
  }
  LogStore.prototype.add = function (level, text, meta) {
    meta = meta || {};
    if (meta.kind === 'resource' && meta.file) {
      var now = Date.now();
      if (this.recentMissing[meta.file] && now - this.recentMissing[meta.file] < 4000) return null;
      this.recentMissing[meta.file] = now;
      level = 'error';
    }
    var last = this.rows[this.rows.length - 1];
    if (last && last.level === level && last.text === text && last.file === meta.file && last.line === meta.line) {
      last.count++;
      last.t = Date.now();
      if (this.onChange) this.onChange(last, false);
      return last;
    }
    var row = { level: level, text: text, file: meta.file || '', line: meta.line || 0, col: meta.col || 0, stack: meta.stack || '', kind: meta.kind || 'console', count: 1, t: Date.now() };
    this.rows.push(row);
    if (this.rows.length > 600) this.rows.splice(0, this.rows.length - 600);
    if (level === 'error') this.errors++;
    if (this.onChange) this.onChange(row, true);
    return row;
  };
  LogStore.prototype.clear = function () { this.rows = []; this.errors = 0; this.recentMissing = {}; if (this.onChange) this.onChange(null, false); };

  /* render a console list into a container */
  function renderConsole(container, store, opts) {
    opts = opts || {};
    var filter = opts.filter || 'all';
    var rows = store.rows.filter(function (r) {
      if (filter === 'errors') return r.level === 'error' || r.level === 'warn';
      return true;
    });
    container.replaceChildren();
    if (!rows.length) {
      container.appendChild(h('div.con-empty', filter === 'errors' ? 'No errors. Nice!' : 'Nothing here yet. Messages from the game show up here.'));
      return;
    }
    var ICON = { error: 'alert', warn: 'warn', info: 'info', log: 'next' };
    rows.forEach(function (r) {
      var where = r.file && !/^https?:/.test(r.file) ? r.file + (r.line ? ':' + r.line : '') : (r.file ? r.file.replace(/^https?:\/\//, '').slice(0, 60) : '');
      var row = h('div.con-row.' + r.level,
        h('span.lv', I(ICON[r.level] || 'next')),
        h('span.tx', r.text, r.stack && opts.stacks !== false ? h('span.stack', cleanStack(r.stack)) : null),
        r.count > 1 ? h('span.cnt', '×' + r.count) : null,
        where ? h('span.where', {
          title: opts.onJump ? 'Open in the code editor' : '',
          onclick: function () { if (opts.onJump && r.file && !/^https?:/.test(r.file)) opts.onJump(r.file, r.line, r.col); }
        }, where) : null);
      container.appendChild(row);
    });
    container.scrollTop = container.scrollHeight;
  }
  function cleanStack(stack) {
    return String(stack).split('\n').slice(0, 6).map(function (l) {
      return l.replace(/https?:\/\/[^\s)]*?\/play\/[^/]+\//g, '').replace(/blob:[^\s)]*?(?=:\d+:\d+)/g, 'game');
    }).join('\n');
  }

  /* text to paste into an AI chat so it can fix the bug */
  async function aiReport(game, rows) {
    var errs = rows.filter(function (r) { return r.level === 'error' || r.level === 'warn'; }).slice(-12);
    if (!errs.length) return '';
    var fileCache = {};
    async function lineOf(file, line) {
      if (!file || !line || !game) return '';
      if (!(file in fileCache)) {
        var rec = await GS2DB.getFile(game.id, file);
        fileCache[file] = rec ? (await rec.b.text()).split('\n') : null;
      }
      var lines = fileCache[file];
      return lines && lines[line - 1] != null ? lines[line - 1].trim().slice(0, 200) : '';
    }
    var out = ['My web game "' + (game ? game.name : 'game') + '" has these errors in the browser:', ''];
    for (var i = 0; i < errs.length; i++) {
      var r = errs[i];
      out.push((i + 1) + '. ' + r.text + (r.count > 1 ? '  (happened ' + r.count + ' times)' : ''));
      if (r.file) out.push('   in ' + r.file + (r.line ? ' at line ' + r.line : ''));
      var code = await lineOf(r.file, r.line);
      if (code) out.push('   that line is: ' + code);
    }
    out.push('', 'Please fix these and send me the COMPLETE fixed file (the whole thing, not just the changed part).');
    return out.join('\n');
  }

  /* ---------------- the current game ---------------- */
  var cur = null;
  var pillTimer = null;
  var isTouch = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  /* The phone/browser Back button: first press opens the game menu, second press goes back to Game System. */
  var ignorePop = false;
  function pushGameState() {
    if (!(history.state && history.state.gs2 === 'game')) { try { history.pushState({ gs2: 'game' }, ''); } catch (e) { /* ignore */ } }
  }
  function popGameState() {
    if (history.state && history.state.gs2 === 'game') { ignorePop = true; history.back(); }
  }
  window.addEventListener('popstate', function (e) {
    if (ignorePop) { ignorePop = false; e.gs2Handled = true; return; }
    if (!cur) return;
    e.gs2Handled = true;
    if (!el('console-drawer').hidden) { Player.closeConsole(); pushGameState(); return; }
    if (cur.menuOpen) { close(); return; }
    openMenu();
    pushGameState();
  });
  var toastGate = 0;

  function ptoast(msg, type, action, ic) {
    var wrap = el('player-toasts');
    while (wrap.children.length >= 3) wrap.firstChild.remove();
    var t = h('div.ptoast' + (type ? '.' + type : ''), I(ic || (type === 'bad' ? 'alert' : 'info')), h('span.ptm', msg),
      action ? h('button.btn.sm', { onclick: function () { t.remove(); action.onClick(); } }, action.label) : null);
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, type === 'bad' ? 6000 : 2600);
  }

  function showPill() {
    if (!cur || cur.menuOpen) return;
    var p = el('edge-pill');
    el('edge-key').textContent = D.settings.hotkey || 'F2';
    p.hidden = false;
    clearTimeout(pillTimer);
    pillTimer = setTimeout(function () { p.hidden = true; }, 2800);
  }

  function updateBadge() {
    var b = el('err-badge');
    if (!cur || !cur.logs.errors) { b.hidden = true; return; }
    b.hidden = false;
    el('err-count').textContent = cur.logs.errors;
  }

  function encodePath(p) { return String(p || '').split('/').map(encodeURIComponent).join('/'); }

  async function srcFor(g) {
    if (g.source === 'link') return g.url;
    if (await App.swReady()) return 'play/' + encodeURIComponent(g.id) + '/' + encodePath(g.entry || 'index.html');
    return fallbackSrc(g);
  }

  /* No service worker (for example the app was opened straight from a file):
     build ONE page with every file packed inside it as data: URLs. Works for most games. */
  function b64(u8) {
    var out = '';
    for (var i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(out);
  }
  async function dataUrl(blob, type) {
    return 'data:' + (type || 'application/octet-stream') + ';base64,' + b64(new Uint8Array(await blob.arrayBuffer()));
  }
  async function fallbackSrc(g) {
    await D.ensureLocalFiles(g);
    var files = await GS2DB.filesOf(g.id);
    var byPath = new Map();
    files.forEach(function (f) { byPath.set(f.p, f); byPath.set(f.p.toLowerCase(), f); });
    var cache = new Map();
    function dir(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
    function lookup(fromDir, ref) {
      if (/^(data:|blob:|https?:|\/\/|#|mailto:|javascript:)/i.test(ref)) return null;
      var clean = ref.split('#')[0].split('?')[0];
      try { clean = decodeURIComponent(clean); } catch (e) { /* keep */ }
      var p = GS2Zip.cleanPath((clean.charAt(0) === '/' ? '' : (fromDir ? fromDir + '/' : '')) + clean);
      return byPath.get(p) || byPath.get(p.toLowerCase()) || null;
    }
    async function urlFor(f) {
      if (cache.has(f.p)) return cache.get(f.p);
      var type = f.t || U.mimeOf(f.p);
      var u;
      if (/\.css$/i.test(f.p)) u = await dataUrl(new Blob([await rewrite(await f.b.text(), dir(f.p), true)]), 'text/css');
      else u = await dataUrl(f.b, type);
      cache.set(f.p, u);
      return u;
    }
    async function replaceAsync(text, re, fn) {
      var parts = [];
      var last = 0;
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        parts.push(text.slice(last, m.index), fn(m));
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      parts.push(text.slice(last));
      var done = await Promise.all(parts);
      return done.join('');
    }
    async function rewrite(text, fromDir, cssOnly) {
      text = await replaceAsync(text, /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, async function (m) {
        var f = lookup(fromDir, m[2]);
        return f && !U.isHtml(f.p) ? 'url(' + m[1] + await urlFor(f) + m[1] + ')' : m[0];
      });
      if (cssOnly) return text;
      return replaceAsync(text, /\b(src|href|poster|data-src)\s*=\s*(["'])([^"']+)\2/gi, async function (m) {
        var f = lookup(fromDir, m[3]);
        return f && !U.isHtml(f.p) ? m[1] + '=' + m[2] + await urlFor(f) + m[2] : m[0];
      });
    }
    var entry = files.find(function (f) { return f.p === g.entry; }) || files.find(function (f) { return U.isHtml(f.p); });
    if (!entry) throw new Error('This game has no .html file.');
    var save = await D.latestSave(g.id);
    var kitText = window.__GS2_KIT_SRC || '';
    if (!kitText) { try { kitText = await (await fetch('kit/gs2-kit.js')).text(); } catch (e) { kitText = ''; } }
    var boot = {
      id: g.id, name: g.name, entry: entry.p, isolate: g.isolate !== false, hotkey: D.settings.hotkey,
      autosave: D.settings.autosaveSec, resume: save ? { data: save.data, t: save.t } : null
    };
    var bootUrl = await dataUrl(new Blob([GS2Shared.bootScript(boot, kitText)]), 'text/javascript');
    var html = await rewrite(await entry.b.text(), dir(entry.p), false);
    var bytes = GS2Shared.injectTag(new TextEncoder().encode(html), '<script src="' + bootUrl + '"></script>');
    return { srcdoc: new TextDecoder().decode(bytes) };
  }

  async function launch(id, opts) {
    opts = opts || {};
    var g = D.get(id);
    if (!g) { UI.toast('That game is gone.', { type: 'warn' }); return; }
    /* apps open in a window instead */
    if (D.isApp(g) && !opts.fullscreen) { await Win.open(id, { fresh: opts.fresh }); return; }
    if (cur) await close({ quiet: true, keepHistory: true });
    if (UI.modalCount()) document.querySelectorAll('.modal-back').forEach(function (b) { b.remove(); });
    UI.closeMenu();
    Sound.launch();

    var player = el('player');
    cur = {
      id: id, game: g, start: Date.now(), activeMs: 0, lastTick: performance.now(),
      kitReady: false, autosave: !!g.kitAutosave, lastSaveT: 0, menuOpen: false,
      logs: null, frame: null, tick: null, gp: null
    };
    var c = cur;
    c.logs = new LogStore(function (row, isNew) {
      updateBadge();
      if (!el('console-drawer').hidden && c.consoleRender) c.consoleRender();
      if (row && isNew && row.level === 'error' && c === cur) {
        var now = Date.now();
        if (now - toastGate > 6000) {
          toastGate = now;
          ptoast(row.text.slice(0, 140) + (row.line ? ' (line ' + row.line + ')' : ''), 'bad', { label: 'See', onClick: function () { openConsole(); } });
        }
      }
    });
    c.sink = {
      blocked: false,
      log: function (level, text, meta) { c.logs.add(level, text, meta); },
      saved: function (t, kind) {
        c.lastSaveT = t;
        if (kind === 'manual') ptoast('Progress saved', null, null, 'save');
        refreshMenuSave();
      },
      ready: function () { c.kitReady = true; },
      kitInfo: function (info) {
        if (info.autosave && !c.autosave) {
          c.autosave = true;
          if (!g.kitAutosave) D.updateGame(id, { kitAutosave: true });
        }
      }
    };
    c.unsink = addSink(id, c.sink);

    D.ui.playing = id;
    D.ui.sel = id;
    D.saveUI();
    var launches = (g.launches || 0) + 1;
    D.updateGame(id, { lastPlayed: Date.now(), launches: launches });

    App.setAccentFor(g);
    var plArt = el('pl-art');
    plArt.replaceChildren(UI.art(g, { noName: true }));
    el('pl-name').textContent = g.name;
    el('pl-tip').innerHTML = '<b>TIP</b> ' + TIPS[Math.floor(Math.random() * TIPS.length)].replace('{key}', U.escapeHtml(D.settings.hotkey || 'F2'));
    el('player-loading').classList.remove('done');
    el('err-badge').hidden = true;
    el('edge-pill').hidden = true;
    el('quick-menu').hidden = true;
    el('console-drawer').hidden = true;
    el('player-toasts').replaceChildren();
    player.hidden = false;
    el('touch-menu').hidden = !isTouch;
    pushGameState();
    BG.pause();
    document.getElementById('app').classList.add('behind');

    var src;
    try { src = await srcFor(g); } catch (err) {
      UI.toast(err.message || String(err), { type: 'bad', title: 'Can\'t start the game' });
      close({ quiet: true });
      return;
    }
    if (c !== cur) return;

    var frame = h('iframe', {
      title: g.name,
      allow: 'autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; accelerometer; gyroscope; xr-spatial-tracking; screen-wake-lock; midi'
    });
    c.frame = frame;
    var loadedAt = 0;
    var minShow = 650;
    frame.addEventListener('load', function () {
      if (c !== cur) return;
      if (loadedAt) return;
      loadedAt = Date.now();
      var wait = Math.max(0, minShow - (loadedAt - c.start));
      setTimeout(function () {
        if (c !== cur) return;
        el('player-loading').classList.add('done');
        focusGame();
        if (g.source !== 'link' && opts.resumed) {
          ptoast(c.autosave || g.kitAutosave ? 'Welcome back! Continuing where you left off' : 'Welcome back!', null, null, 'resume');
        }
      }, wait);
    });
    setTimeout(function () { if (c === cur && !loadedAt) { el('player-loading').classList.add('done'); focusGame(); } }, 15000);
    setFrameSrc(frame, src);
    el('player-stage').replaceChildren(frame);

    c.tick = setInterval(function () {
      var now = performance.now();
      var dt = Math.min(now - c.lastTick, 2500);
      c.lastTick = now;
      if (document.visibilityState === 'visible' && !c.menuOpen) {
        c.activeMs += dt;
        D.addPlayTime(id, dt);
      }
    }, 1000);

    /* controller "home" button opens the quick menu */
    var gpPrev = false;
    c.gp = setInterval(function () {
      if (!navigator.getGamepads) return;
      var pads = navigator.getGamepads();
      var pressed = false;
      for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        if (p && p.buttons && p.buttons[16] && p.buttons[16].pressed) pressed = true;
      }
      if (pressed && !gpPrev) toggleMenu();
      gpPrev = pressed;
    }, 150);
  }

  function blankFrame(frame) {
    if (!frame) return;
    try { frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; } catch (e) { /* ignore */ }
  }
  function setFrameSrc(frame, src) {
    if (src && typeof src === 'object' && src.srcdoc != null) { frame.removeAttribute('src'); frame.srcdoc = src.srcdoc; }
    else { frame.removeAttribute('srcdoc'); frame.src = src; }
  }

  function focusGame() {
    if (!cur || !cur.frame) return;
    try { cur.frame.focus(); } catch (e) { /* ignore */ }
    try { if (cur.frame.contentWindow) cur.frame.contentWindow.focus(); } catch (e) { /* cross-origin link game */ }
  }

  function kit() {
    try {
      var w = cur && cur.frame && cur.frame.contentWindow;
      return w && w.GameSystem && w.GameSystem.__real ? w.GameSystem : null;
    } catch (e) { return null; }
  }

  async function flushSave() {
    var k = kit();
    if (!k || !k._flush) return false;
    try {
      var json = k._flush();
      if (json != null) { await D.putSave(cur.id, json, Date.now()); cur.lastSaveT = Date.now(); return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  async function close(opts) {
    opts = opts || {};
    if (!cur) return;
    var c = cur;
    var flushed = await flushSave();
    clearInterval(c.tick);
    clearInterval(c.gp);
    var now = performance.now();
    if (document.visibilityState === 'visible' && !c.menuOpen) D.addPlayTime(c.id, Math.min(now - c.lastTick, 2500), true);
    cur = null;
    if (c.unsink) c.unsink();
    blankFrame(c.frame);
    if (c.frame) c.frame.remove();
    if (flushed) { try { localStorage.removeItem('gs2:emerg:' + c.id); } catch (e) { /* ignore */ } }
    el('quick-menu').hidden = true;
    el('console-drawer').hidden = true;
    el('edge-pill').hidden = true;
    el('touch-menu').hidden = true;
    el('err-badge').hidden = true;
    el('player').hidden = true;
    if (!opts.keepHistory) popGameState();
    document.getElementById('app').classList.remove('behind');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    BG.resume();
    D.ui.playing = null;
    D.ui.sel = c.id;
    D.saveUI();
    D.flushPlay();
    if (!opts.quiet) {
      Sound.back();
      App.refresh();
      App.go(D.ui.view === 'editor' ? 'editor' : (D.ui.view || 'home'), { noSound: true });
    }
  }

  /* ---------------- quick menu ---------------- */
  function refreshMenuSave() {
    var box = document.querySelector('#quick-menu .qm-save');
    if (!box || !cur) return;
    box.className = 'qm-save';
    if (cur.game.source === 'link') {
      box.replaceChildren(I('link'), h('span', 'This is a website link. It saves things by itself (if it can).'));
    } else if (cur.autosave || cur.game.kitAutosave) {
      box.classList.add('ok');
      box.replaceChildren(I('save'), h('span', cur.lastSaveT ? 'Progress saved ' + U.timeAgo(cur.lastSaveT) + '. You can turn off your PC and continue later.' : 'This game saves your progress automatically.'));
    } else {
      box.classList.add('no');
      var gid = cur.id;
      box.replaceChildren(I('warn'), h('div',
        h('span', 'This game doesn\'t use the Save Kit, so next time it starts at its own title screen.'),
        h('button.btn.sm', { style: { marginTop: '8px', display: 'flex' }, onclick: function () { close({ quiet: true }).then(function () { App.go('home', { noSound: true }); Upgrade.open(gid); }); } }, I('resume'), 'Fix this')));
    }
  }

  function menuItem(icon, label, onClick, opts) {
    opts = opts || {};
    return h('button.qm-item' + (opts.danger ? '.danger' : ''), { onclick: function () { Sound.select(); onClick(); } },
      h('span.qi', I(icon)), label, opts.key ? h('kbd', opts.key) : null);
  }

  function openMenu() {
    if (!cur || cur.menuOpen) return;
    cur.menuOpen = true;
    el('touch-menu').hidden = true;
    var k = kit();
    if (k) { try { k._pause(); } catch (e) { /* ignore */ } }
    flushSave().then(refreshMenuSave);
    el('edge-pill').hidden = true;
    Sound.open();
    var g = D.get(cur.id) || cur.game;
    var qm = el('quick-menu');
    var isLink = g.source === 'link';
    var side = h('div.qm-side',
      h('div.qm-game', h('div.qa', UI.art(g, { noName: true })),
        h('div', h('h2', g.name), h('div.qs', 'Playing for ' + U.fmtDuration(cur.activeMs, true) + ' · total ' + U.fmtDuration((g.playTime || 0) + (D.pendingPlay[g.id] || 0))))),
      h('div.qm-save'),
      menuItem('play', 'Resume', closeMenu, { key: 'Esc' }),
      !isLink && (cur.autosave || g.kitAutosave) ? menuItem('save', 'Save now', async function () { var ok = await flushSave(); ptoast(ok ? 'Progress saved' : 'Nothing new to save', null, null, 'save'); refreshMenuSave(); }) : null,
      menuItem('full', document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen', function () { toggleFullscreen(); closeMenu(); }, { key: 'F11' }),
      !isLink ? menuItem('camera', 'Use screenshot as cover', screenshotCover) : null,
      menuItem('bug', 'Errors & console' + (cur.logs.errors ? ' (' + cur.logs.errors + ')' : ''), function () { closeMenu(true); openConsole(); }),
      !isLink ? menuItem('code', 'Edit code', function () { var id = cur.id; close({ quiet: true }).then(function () { Editor.open(id); }); }) : null,
      h('div.qm-sep'),
      menuItem('reload', 'Reload game', reload),
      !isLink && (cur.autosave || g.kitAutosave) ? menuItem('restart', 'Start over (deletes progress)', startOver, { danger: true }) : null,
      isLink ? menuItem('link', 'Open in new tab', function () { window.open(g.url, '_blank', 'noopener'); }) : null,
      h('div.qm-sep'),
      menuItem('exit', 'Quit to menu', function () { close(); }, { danger: true })
    );
    qm.replaceChildren(side, h('div', { onclick: closeMenu, style: { cursor: 'pointer' } }));
    qm.hidden = false;
    refreshMenuSave();
    setTimeout(function () { var b = side.querySelector('.qm-item'); if (b) b.focus(); }, 30);
  }

  function closeMenu(keepPaused) {
    if (!cur || !cur.menuOpen) return;
    cur.menuOpen = false;
    cur.lastTick = performance.now();
    el('quick-menu').hidden = true;
    el('touch-menu').hidden = !isTouch;
    if (keepPaused !== true) {
      var k = kit();
      if (k) { try { k._resume(); } catch (e) { /* ignore */ } }
      focusGame();
    }
  }
  function toggleMenu() { if (!cur) return; if (cur.menuOpen) closeMenu(); else openMenu(); }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else el('player').requestFullscreen().catch(function () { ptoast('Fullscreen was blocked by the browser', 'bad'); });
  }

  async function screenshotCover() {
    var k = kit();
    if (!k || !k._screenshot) { ptoast('Can\'t grab a screenshot from this game', 'bad'); return; }
    closeMenu(true);
    el('quick-menu').hidden = true;
    var data = await k._screenshot();
    if (!data) { ptoast('This game doesn\'t draw on a canvas, so I can\'t screenshot it. Add a picture instead.', 'bad'); openMenu(); return; }
    var blob = U.dataUrlToBlob(data);
    var blank = await isBlank(blob);
    if (blank) { ptoast('The screenshot came out blank. Try again when there\'s more on screen!', 'bad'); openMenu(); return; }
    await D.setCover(cur.id, blob);
    cur.game = D.get(cur.id);
    App.setAccentFor(cur.game);
    Sound.good();
    ptoast('New cover set!', null, null, 'image');
    openMenu();
  }
  function isBlank(blob) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = c.height = 16;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0, 16, 16);
        var d = x.getImageData(0, 0, 16, 16).data;
        var min = 255, max = 0;
        for (var i = 0; i < d.length; i += 4) { var v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); }
        URL.revokeObjectURL(url);
        resolve(max - min < 12);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(true); };
      img.src = url;
    });
  }

  async function reload() {
    if (!cur) return;
    await flushSave();
    var id = cur.id;
    closeMenu(true);
    var c = cur;
    c.logs.clear();
    el('player-loading').classList.remove('done');
    var src = await srcFor(c.game);
    c.start = Date.now();
    var frame = c.frame;
    var done = false;
    frame.addEventListener('load', function onl() {
      frame.removeEventListener('load', onl);
      if (done) return;
      done = true;
      setTimeout(function () { el('player-loading').classList.add('done'); focusGame(); }, 400);
    });
    blankFrame(frame);
    setTimeout(function () { if (cur && cur.id === id) setFrameSrc(frame, src); }, 30);
  }

  async function startOver() {
    if (!cur) return;
    var g = cur.game;
    if (!(await UI.confirm('Start over?', 'This deletes your progress in "' + g.name + '" and starts from the beginning. Can\'t undo!', { ok: 'Start over', danger: true }))) return;
    var id = cur.id;
    var c = cur;
    closeMenu(true);
    c.sink.blocked = true;
    blankFrame(c.frame);
    await U.sleep(120);
    await D.wipeSaves(id, true);
    c.lastSaveT = 0;
    c.sink.blocked = false;
    if (cur === c) reload();
  }

  /* ---------------- console drawer ---------------- */
  function openConsole() {
    if (!cur) return;
    var c = cur;
    var drawer = el('console-drawer');
    var filter = 'all';
    var list = h('div.con-list');
    var seg = h('div.seg',
      h('button.on', { onclick: function (e) { setF('all', e.target); } }, 'All'),
      h('button', { onclick: function (e) { setF('errors', e.target); } }, 'Errors'));
    function setF(f, b) { filter = f; seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); render(); }
    function render() {
      renderConsole(list, c.logs, {
        filter: filter,
        onJump: function (file, line) { var id = c.id; close({ quiet: true }).then(function () { Editor.open(id, { file: file, line: line }); }); }
      });
    }
    c.consoleRender = render;
    el('player-toasts').replaceChildren();
    drawer.replaceChildren(
      h('div.con-head', h('span.ttl', I('bug'), ' ERRORS & CONSOLE'), seg, h('div.grow'),
        h('button.btn.sm', { onclick: async function () {
          var txt = await aiReport(D.get(c.id), c.logs.rows);
          if (!txt) { ptoast('No errors to copy. Nice!'); return; }
          await U.copyText(txt);
          ptoast('Copied! Paste it to the AI and it\'ll know what to fix.', null, null, 'clipboard');
        } }, I('clipboard'), 'Copy errors for AI'),
        h('button.btn.sm.ghost', { onclick: function () { c.logs.clear(); render(); } }, I('trash'), 'Clear'),
        h('button.icon-btn.sm', { 'aria-label': 'Close', onclick: function () { drawer.hidden = true; focusGame(); var k = kit(); if (k) k._resume(); } }, UI.icon('x'))),
      list);
    drawer.hidden = false;
    render();
  }

  /* ---------------- resume after the PC/browser was closed ---------------- */
  async function offerResume(id) {
    var g = D.get(id);
    if (!g) { D.ui.playing = null; D.saveUI(); return; }
    var save = g.source === 'link' ? null : await D.latestSave(id);
    var mode = D.settings.resume || 'popup';
    if (mode === 'menu') { D.ui.playing = null; D.saveUI(); return; }
    if (mode === 'auto') { launch(id, { resumed: true, fullscreen: true }); return; }
    var art = h('div.det-art', { style: { width: '100%', marginBottom: '14px' } }, UI.art(g));
    var always = h('input', { type: 'checkbox', onchange: function () {
      D.settings.resume = always.checked ? 'auto' : 'popup';
      D.saveSettings();
    } });
    UI.modal({
      title: 'Continue?',
      icon: 'resume',
      body: h('div', art,
        h('p', 'You were playing ', h('b', g.name), ' ' + U.timeAgo(g.lastPlayed) + '.'),
        save ? h('p.small.muted', I('save'), ' Your progress was saved ' + U.timeAgo(save.t) + '. You\'ll be right back where you were.') :
          h('p.small.muted', 'Jump back in?'),
        h('label.check-row.small', always, h('span', 'Always jump straight in next time (you can change this in Settings)'))),
      actions: [
        { label: 'Not now', kind: 'ghost', onClick: function () { D.ui.playing = null; D.saveUI(); } },
        { label: 'CONTINUE', icon: 'play', kind: 'primary', autofocus: true, onClick: function () { launch(id, { resumed: true, fullscreen: true }); } }
      ],
      onClose: function (reason) { if (reason !== 'action') { D.ui.playing = null; D.saveUI(); } }
    });
  }

  /* When the browser/PC is closing: save everything we can right now */
  function onPageHide() {
    if (!cur) return;
    try {
      var k = kit();
      if (k && k._flush) {
        var json = k._flush();
        if (json != null) {
          D.putSave(cur.id, json, Date.now()).catch(function () {});
          if (json.length < 1500000) localStorage.setItem('gs2:emerg:' + cur.id, JSON.stringify({ data: json, t: Date.now() }));
        }
      }
    } catch (e) { /* ignore */ }
    var now = performance.now();
    if (!cur.menuOpen) D.addPlayTime(cur.id, Math.min(now - cur.lastTick, 2500), true);
    cur.lastTick = now;
  }

  function onSwMessage(msg) {
    if (msg && msg.type === 'missing' && msg.id) {
      Host.log(msg.id, 'error', 'Missing file: "' + msg.path + '". The game asked for it, but it isn\'t in the game\'s files.', { kind: 'resource', file: msg.path });
    }
  }

  window.Player = {
    launch: launch,
    close: close,
    isPlaying: function () { return !!cur; },
    currentId: function () { return cur ? cur.id : null; },
    menuOpen: function () { return !!(cur && cur.menuOpen); },
    toggleMenu: toggleMenu,
    closeMenu: closeMenu,
    consoleOpen: function () { return !el('console-drawer').hidden; },
    closeConsole: function () { el('console-drawer').hidden = true; focusGame(); var k = kit(); if (k) k._resume(); },
    offerResume: offerResume,
    onPageHide: onPageHide,
    onSwMessage: onSwMessage,
    toggleFullscreen: toggleFullscreen,
    addSink: addSink,
    LogStore: LogStore,
    renderConsole: renderConsole,
    aiReport: aiReport,
    srcFor: srcFor,
    setFrameSrc: setFrameSrc,
    blankFrame: blankFrame
  };
})();
