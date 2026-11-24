/* Game System 2.0 — the app: boot, title screen, switching screens, keyboard + controller,
   remembering exactly where you were, service worker. */
(function () {
  'use strict';
  var h = U.h;
  function $(id) { return document.getElementById(id); }

  var VIEWS = ['home', 'library', 'apps', 'saves', 'stats', 'settings', 'editor'];
  var started = false;
  var swState = null; /* null = unknown, false = not available */
  /* only our own service worker counts (the OLD Game System's one being replaced is not an "update") */
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller && /\/sw\.js(\?|$)/.test(navigator.serviceWorker.controller.scriptURL || ''));

  /* ---------------- colors ---------------- */
  function hexToHsl(hex) {
    var rgb = U.hexToRgb(hex).map(function (v) { return v / 255; });
    var max = Math.max.apply(null, rgb), min = Math.min.apply(null, rgb);
    var l = (max + min) / 2, s = 0, hh = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rgb[0]) hh = (rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0);
      else if (max === rgb[1]) hh = (rgb[2] - rgb[0]) / d + 2;
      else hh = (rgb[0] - rgb[1]) / d + 4;
      hh *= 60;
    }
    return [hh, s * 100, l * 100];
  }
  /* keep accents bright + punchy so dark text on them is always readable */
  function neon(hex) {
    var hsl = hexToHsl(hex);
    return U.hslToHex(hsl[0], Math.max(75, hsl[1]), Math.min(70, Math.max(56, hsl[2])));
  }
  function partner(hex) {
    var hsl = hexToHsl(hex);
    return U.hslToHex((hsl[0] + 140) % 360, 90, 60);
  }

  var lastAccent = null;
  function setAccent(a, b) {
    if (!D.settings.accentAuto || !a) { var th = Themes.current(); a = th.accent; b = th.accent2; }
    else { a = neon(a); b = b ? neon(b) : partner(a); }
    var key = a + b;
    if (key === lastAccent) return;
    lastAccent = key;
    var root = document.documentElement.style;
    root.setProperty('--accent', a);
    root.setProperty('--accent-rgb', U.hexToRgb(a).join(', '));
    root.setProperty('--accent2', b);
    root.setProperty('--accent2-rgb', U.hexToRgb(b).join(', '));
    BG.setColors(a, b);
  }
  function setAccentFor(g) { setAccent(g ? (g.color || U.colorFor(g.name)) : null); }

  function applySettings() {
    var st = D.settings;
    Sound.setEnabled(st.sounds);
    Sound.setVolume(st.volume);
    Themes.apply();
    Sound.setMusic(!!st.menuMusic);
    BG.setMode(st.bg);
    document.body.classList.toggle('no-scanlines', !st.scanlines);
    document.body.classList.toggle('reduce-motion', !!st.reduceMotion);
    document.body.classList.toggle('simple', D.simple());
    paintProfile();
    lastAccent = null;
    var g = D.get(D.ui.sel);
    setAccentFor(D.ui.view === 'home' ? g : null);
  }

  /* your name, picture and level in the top bar */
  function paintProfile() {
    var st = D.settings;
    var av = $('avatar');
    $('pname').textContent = st.name || 'bro';
    if (D.avatarUrl) av.replaceChildren(U.h('img', { src: D.avatarUrl, alt: '' }));
    else av.textContent = ((st.name || 'bro').trim().charAt(0) || 'B').toUpperCase();
    var inf = Trophies.info();
    av.className = 'avatar tier-' + Trophies.tier(inf.level) + (D.avatarUrl ? ' has-img' : '');
    var lv = $('plv');
    if (lv) lv.textContent = 'Lv ' + inf.level;
    $('btn-profile').title = 'Your profile · Level ' + inf.level + ' · ' + inf.title;
  }

  /* secret stuff: the old-school code and the logo button masher */
  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  var konamiAt = 0;
  function konamiKey(e) {
    if (!started || !$('player').hidden || UI.isTyping()) { konamiAt = 0; return; }
    var k = (e.key || '').toLowerCase();
    if (k === KONAMI[konamiAt]) {
      konamiAt++;
      if (konamiAt === KONAMI.length) {
        konamiAt = 0;
        Trophies.event('konami');
        document.body.classList.add('konami');
        Sound.good();
        setTimeout(function () { document.body.classList.remove('konami'); }, 2600);
      }
    } else konamiAt = k === KONAMI[0] ? 1 : 0;
  }
  var logoHits = [];
  function logoHit() {
    var now = Date.now();
    logoHits = logoHits.filter(function (t) { return now - t < 3000; });
    logoHits.push(now);
    if (logoHits.length >= 10) {
      logoHits = [];
      Trophies.event('logo');
      var b = $('brand');
      b.classList.remove('spin');
      void b.offsetWidth;
      b.classList.add('spin');
      setTimeout(function () { b.classList.remove('spin'); }, 900);
    }
  }

  /* ---------------- switching screens ---------------- */
  function moveGlow() {
    var glow = document.querySelector('.tab-glow');
    var active = document.querySelector('.tab.active');
    if (!glow) return;
    if (!active || active.hidden) { glow.style.width = '0px'; return; }
    glow.style.left = active.offsetLeft + 10 + 'px';
    glow.style.width = Math.max(0, active.offsetWidth - 20) + 'px';
  }

  function go(name, opts) {
    opts = opts || {};
    if (VIEWS.indexOf(name) < 0) name = 'home';
    if (name === 'editor' && !Editor.isOpen()) name = 'home';
    var prev = D.ui.view;
    var prevEl = $('view-' + prev);
    if (prevEl && prev !== name) { D.ui.scroll[prev] = prevEl.scrollTop; }
    /* full-size app windows step aside so you can see the screen you picked */
    if (started && prev !== name) Win.uncover();
    D.ui.view = name;
    D.saveUISoon();
    VIEWS.forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.classList.toggle('active', v === name);
    });
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name); });
    moveGlow();
    if (name !== 'editor') Views.render(name);
    else Editor.refresh();
    if (name !== 'home') setAccent(null);
    var el = $('view-' + name);
    if (el && name !== 'editor') {
      var y = D.ui.scroll[name] || 0;
      requestAnimationFrame(function () { el.scrollTop = y; });
    }
    if (!opts.noSound && prev !== name) Sound.select();
    if (name === 'home' && !opts.noFocus) {
      requestAnimationFrame(function () {
        if (UI.modalCount() || !$('player').hidden) return;
        var t = document.querySelector('#view-home .gi.sel') || document.querySelector('#view-home [data-autofocus]');
        if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      });
    }
  }

  /* re-render the current screen but keep keyboard focus where it was */
  function refresh() {
    if (!started) return;
    var v = D.ui.view;
    if (v === 'editor') return;
    var a = document.activeElement;
    var key = null;
    if (a && a.dataset && a.dataset.id) key = '[data-id="' + a.dataset.id + '"]';
    else if (a && a.closest && a.closest('.hero-actions')) key = '.hero-actions > :nth-child(' + (Array.prototype.indexOf.call(a.parentNode.children, a) + 1) + ')';
    var el = $('view-' + v);
    var y = el ? el.scrollTop : 0;
    Views.render(v);
    if (el) el.scrollTop = y;
    if (key) {
      var t = el && el.querySelector(key);
      if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
  }
  var refreshSoon = U.debounce(refresh, 60);

  /* ---------------- service worker ---------------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') { swState = false; return; }
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      swState = false;
      console.warn('Game System: service worker failed to start', err);
    });
    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.gs2sw && d.type === 'missing') Player.onSwMessage(d);
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (Player.isPlaying()) return;
      Notify.add({ key: 'update', icon: 'sparkle', title: 'Update ready', text: 'Game System got an update. Reload to use it.', action: { label: 'Reload now', run: 'reload' } });
      UI.toast('Game System just got an update. Reload to use the new version.', {
        icon: 'sparkle', timeout: 0, title: 'Update ready',
        actions: [{ label: 'Reload now', kind: 'primary', onClick: function () { location.reload(); } }]
      });
    });
  }

  /* Settings → "Check for updates": ask the website for a newer Game System right now */
  var checking = false;
  async function checkUpdate() {
    if (checking) return;
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      UI.toast('Updates only work when Game System is on your website (like Netlify).', { type: 'warn' });
      return;
    }
    checking = true;
    var t = UI.toast('Checking for updates…', { icon: 'reload', timeout: 0, sound: false });
    try {
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) throw new Error('not set up yet, reload the page once');
      await reg.update();
      var nw = reg.installing || reg.waiting;
      t.close();
      if (nw) {
        /* a new version is coming in: the "Update ready" popup shows up when it's done */
        UI.toast('Found an update! Getting it ready…', { icon: 'sparkle', sound: false });
        if (nw.state === 'installed' && reg.waiting) reg.waiting.postMessage({ type: 'skip' });
      } else {
        UI.toast('You have the newest Game System (' + GS2Shared.APP_VERSION + ').', { type: 'good', icon: 'check' });
      }
    } catch (e) {
      t.close();
      UI.toast('Couldn\'t check for updates (' + (navigator.onLine === false ? 'you\'re offline' : (e.message || 'no answer')) + ').', { type: 'warn' });
    } finally {
      checking = false;
    }
  }

  async function swReady() {
    if (swState === false || !('serviceWorker' in navigator)) return false;
    try {
      var reg = await Promise.race([navigator.serviceWorker.ready, U.sleep(5000).then(function () { return null; })]);
      if (!reg || !reg.active) return false;
      if (!navigator.serviceWorker.controller) {
        /* first visit, or a hard refresh (Ctrl+Shift+R): ask the worker to take over this page */
        reg.active.postMessage({ type: 'claim' });
        await new Promise(function (resolve) {
          var t = setTimeout(resolve, 2000);
          navigator.serviceWorker.addEventListener('controllerchange', function () { clearTimeout(t); resolve(); }, { once: true });
        });
      }
      if (!navigator.serviceWorker.controller) return false;
      if (swState === true) return true;
      var r = await fetch('__gs2/ping', { cache: 'no-store' });
      swState = r.ok && /^pong/.test(await r.text());
      return swState;
    } catch (e) { return false; }
  }

  /* ---------------- keyboard ---------------- */
  function hotkeyMatch(e) {
    var hk = String(D.settings.hotkey || 'F2').toLowerCase().split('+');
    var key = hk.pop();
    return (e.key || '').toLowerCase() === key &&
      e.ctrlKey === (hk.indexOf('ctrl') >= 0) && e.altKey === (hk.indexOf('alt') >= 0) && e.shiftKey === (hk.indexOf('shift') >= 0);
  }

  var TAB_ORDER = ['home', 'library', 'apps', 'saves', 'stats'];
  function cycleTab(dir) {
    var list = TAB_ORDER.concat(Editor.isOpen() ? ['editor'] : []);
    var i = list.indexOf(D.ui.view);
    if (i < 0) i = 0;
    go(list[(i + dir + list.length) % list.length]);
  }

  function back() {
    if (UI.modalCount()) { var m = UI.topModal(); if (m && m.dismissible) { Sound.back(); m.close('back'); } return; }
    if (!$('player').hidden) {
      if (Player.consoleOpen()) Player.closeConsole();
      else if (Player.menuOpen()) Player.closeMenu();
      else Player.toggleMenu();
      return;
    }
    if (D.ui.view !== 'home' && D.ui.view !== 'editor') { Sound.back(); go('home', { noSound: true }); }
  }

  function onKey(e) {
    if (!started) {
      if ($('title-screen') && !$('title-screen').hidden && !['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) { e.preventDefault(); enterFromTitle(); }
      return;
    }
    /* a timer or alarm is ringing: Esc / Enter = OK */
    if (Timers.ringing() && (e.key === 'Escape' || (e.key === 'Enter' && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.ring-pop')))) && !UI.isTyping()) {
      e.preventDefault();
      Timers.dismissTop();
      return;
    }
    /* your VEX keys, then your screenshot / record keys */
    if (!e.repeat && !UI.isTyping()) {
      if (Vex.keyAction(e)) { e.preventDefault(); return; }
      var cap = Capture.keyAction(e);
      if (cap) { e.preventDefault(); Capture.run(cap); return; }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key || '').toLowerCase() === 's' && !e.defaultPrevented) {
      /* Ctrl+S anywhere in the editor saves (and never opens the browser's "save page" box) */
      if (D.ui.view === 'editor' && Editor.isOpen() && $('player').hidden && !UI.modalCount()) { e.preventDefault(); Editor.save(); return; }
    }
    if (!$('player').hidden) {
      if (hotkeyMatch(e)) { e.preventDefault(); Player.toggleMenu(); return; }
      if (e.key === 'Escape') {
        if (Player.consoleOpen()) { e.preventDefault(); Player.closeConsole(); return; }
        if (Player.menuOpen()) { e.preventDefault(); Player.closeMenu(); return; }
      }
      if (Player.menuOpen() || UI.modalCount()) {
        var dirP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
        if (dirP && !UI.isTyping()) { e.preventDefault(); UI.moveFocus(dirP); }
      }
      return;
    }
    if (Grid.isMoving() && !UI.modalCount()) {
      var mk = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok', Escape: 'cancel' }[e.key];
      if (mk) { e.preventDefault(); Grid.handleMoveKey(mk); return; }
    }
    if (UI.isTyping()) {
      if (e.key === 'Escape' && !UI.modalCount() && document.activeElement && !document.activeElement.closest('.CodeMirror')) document.activeElement.blur();
      return;
    }
    if ((e.key === '/' && !e.ctrlKey) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      if (UI.modalCount()) return;
      e.preventDefault();
      openSearch();
      return;
    }
    var dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (dir) {
      if (UI.moveFocus(dir)) e.preventDefault();
      return;
    }
    if (UI.modalCount()) return;
    if (e.key === 'Escape' || (e.key === 'Backspace' && !e.ctrlKey)) { if (D.ui.view !== 'home' && D.ui.view !== 'editor') { e.preventDefault(); back(); } return; }
    if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); cycleTab(-1); }
    else if (e.key === ']' || e.key === 'PageDown') { e.preventDefault(); cycleTab(1); }
  }

  function openSearch() {
    go('library');
    setTimeout(function () { var s = $('lib-search'); if (s) { s.focus(); s.select(); } }, 60);
  }

  /* ---------------- controller (gamepad) ---------------- */
  var pads = { prev: {}, held: {}, next: {} };
  var padLoop = 0;
  function pollPads(now) {
    padLoop = 0;
    var list = navigator.getGamepads ? navigator.getGamepads() : [];
    var any = false;
    var state = {};
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      any = true;
      var b = function (n) { return !!(p.buttons[n] && p.buttons[n].pressed); };
      var ax = p.axes || [];
      state.up = state.up || b(12) || ax[1] < -0.55;
      state.down = state.down || b(13) || ax[1] > 0.55;
      state.left = state.left || b(14) || ax[0] < -0.55;
      state.right = state.right || b(15) || ax[0] > 0.55;
      state.a = state.a || b(0);
      state.b = state.b || b(1);
      state.x = state.x || b(2);
      state.lb = state.lb || b(4);
      state.rb = state.rb || b(5);
      state.start = state.start || b(9);
    }
    var playing = !$('player').hidden && !Player.menuOpen() && !UI.modalCount();
    if (any && !playing && document.hasFocus()) {
      ['up', 'down', 'left', 'right'].forEach(function (d) {
        if (state[d]) {
          if (!pads.prev[d]) { pads.next[d] = now + 380; fire(d); }
          else if (now >= pads.next[d]) { pads.next[d] = now + 110; fire(d); }
        }
      });
      ['a', 'b', 'x', 'lb', 'rb', 'start'].forEach(function (k) { if (state[k] && !pads.prev[k]) fire(k); });
    }
    pads.prev = state;
    if (any) padLoop = requestAnimationFrame(pollPads);
  }
  function fire(k) {
    if (!started) { if (k === 'a') enterFromTitle(); return; }
    if (Grid.isMoving() && !UI.modalCount()) {
      var mv = { up: 'up', down: 'down', left: 'left', right: 'right', a: 'ok', b: 'cancel' }[k];
      if (mv) { Grid.handleMoveKey(mv); return; }
    }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { UI.moveFocus(k); return; }
    if (k === 'a') {
      var a = document.activeElement;
      if (a && a !== document.body && typeof a.click === 'function') { a.click(); Sound.select(); }
      else UI.moveFocus('down');
      return;
    }
    if (k === 'b') { if (Timers.ringing()) Timers.dismissTop(); else back(); return; }
    if (k === 'x') {
      var f = document.activeElement;
      if (f && f.classList && f.classList.contains('gi')) {
        var r = f.getBoundingClientRect();
        f.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        return;
      }
      if (D.ui.view === 'home' && D.ui.sel) { Views.gameDetails(D.ui.sel); return; }
    }
    if (k === 'lb') cycleTab(-1);
    if (k === 'rb') cycleTab(1);
    /* Start: jump between open app windows */
    if (k === 'start' && !UI.modalCount()) { if (!Win.cycle()) UI.toast('No app windows open', { icon: 'win', sound: false }); }
  }
  window.addEventListener('gamepadconnected', function (e) {
    if (!padLoop) padLoop = requestAnimationFrame(pollPads);
    if (started) UI.toast('Controller connected: ' + (e.gamepad.id || '').replace(/\(.*\)/, '').trim().slice(0, 40), { icon: 'gamepad', sound: false });
  });

  /* ---------------- title screen ---------------- */
  function showTitle() {
    var ts = $('title-screen');
    ts.hidden = false;
    var playing = D.ui.playing && D.get(D.ui.playing);
    if (playing) $('ts-sub').textContent = playing.name + ' is waiting for you';
    ts.addEventListener('click', enterFromTitle);
  }
  function enterFromTitle() {
    if (started) return;
    Sound.unlock();
    Sound.boot();
    var ts = $('title-screen');
    ts.classList.add('leaving');
    setTimeout(function () { ts.hidden = true; }, 800);
    enterApp();
  }

  function enterApp() {
    if (started) return;
    started = true;
    $('app').hidden = false;
    var v = D.ui.view || 'home';
    if (v === 'editor' && D.ui.editor && D.get(D.ui.editor.id)) {
      go('home', { noSound: true, noFocus: true });
      Editor.open(D.ui.editor.id, { quiet: true });
    } else {
      go(v === 'editor' ? 'home' : v, { noSound: true });
    }
    requestAnimationFrame(moveGlow);
    /* the app windows that were open last time */
    Win.restoreAll();
    /* first start: Simple or Pro? (then the "continue?" popup) */
    var resume = function () { if (D.ui.playing) setTimeout(function () { Player.offerResume(D.ui.playing); }, 300); };
    /* first start: "Simple or Pro?", then VEX shows you around (once) */
    var tourNext = function () { if (!U.lsGet('gs2:vexTour', 0) && D.settings.vexOn !== false) setTimeout(function () { if (!UI.modalCount() && $('player').hidden) Vex.tour(); }, 600); };
    /* the old Game System's games still in this browser? offer to bring them over (once) */
    var oldOnes = function () { return window.OldGS ? OldGS.offer(true).catch(function () { /* never block start-up */ }) : Promise.resolve(); };
    if (!D.settings.mode) setTimeout(function () { Views.askMode().then(oldOnes).then(function () { tourNext(); resume(); }); }, 500);
    else setTimeout(function () { oldOnes().then(resume); }, 300);
  }

  /* ---------------- boot ---------------- */
  function fatal(msg) {
    $('title-screen').hidden = true;
    var app = $('app');
    app.hidden = false;
    app.replaceChildren(h('div.welcome', h('h1', 'Uh oh'), h('p.lead', msg),
      h('p.muted', 'Tip: Game System can\'t save games in private/incognito windows. Open it in a normal window.'),
      h('button.btn.primary', { onclick: function () { location.reload(); } }, 'Try again')));
  }

  async function boot() {
    /* reloaded while a game was open: forget the extra Back-button step */
    if (history.state && history.state.gs2) { try { history.replaceState(null, ''); } catch (e) { /* ignore */ } }
    applyEarly();
    BG.init($('bg'), D.settings.bg);
    Themes.apply();
    registerSW();
    try {
      await D.init();
    } catch (err) {
      console.error(err);
      fatal('Your browser blocked Game System from saving stuff (' + (err && err.message || err) + ').');
      return;
    }
    await Layout.init();
    Trophies.init();
    Media.init();
    Capture.init();
    Timers.init();
    Vex.init();
    applySettings();

    D.on(function (type) {
      if (type === 'games' || type === 'game' || type === 'layout') refreshSoon();
      else if (type === 'stats' && D.ui.view === 'stats') refreshSoon();
      else if (type === 'trophies') {
        paintProfile();
        if (D.ui.view === 'stats' || (D.ui.view === 'home' && (D.settings.homeLayout || 'console') === 'console')) refreshSoon();
      } else if (type === 'settings') paintProfile();
    });

    Importer.setupDrop();
    wireTopbar();
    Notify.init();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', konamiKey, true);
    window.addEventListener('resize', U.debounce(moveGlow, 100));
    VIEWS.forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.addEventListener('scroll', U.debounce(function () { if (D.ui.view === v) { D.ui.scroll[v] = el.scrollTop; D.saveUISoon(); } }, 250), { passive: true });
    });
    window.addEventListener('pagehide', function () { Player.onPageHide(); Win.onPageHide(); D.onPageHide(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { D.saveUI(); D.flushPlay(); }
    });
    tickClock();
    setInterval(tickClock, 10000);
    if (navigator.getGamepads && Array.prototype.some.call(navigator.getGamepads(), Boolean)) padLoop = requestAnimationFrame(pollPads);

    if (location.protocol === 'file:') {
      setTimeout(function () {
        UI.toast('You opened Game System as a file. Single-file games work, but games made of many files work best once it\'s on your website (Netlify).', { type: 'warn', timeout: 12000, title: 'Running from a file' });
      }, 2500);
    }
    if (D.settings.titleScreen) showTitle();
    else { $('title-screen').hidden = true; enterApp(); }

    /* games that come with the website */
    D.syncSiteGames().then(function () {
      var ns = D.lastSyncNews || { games: 0, apps: 0 };
      var parts = [];
      if (ns.games) parts.push(ns.games + ' game' + (ns.games === 1 ? '' : 's'));
      if (ns.apps) parts.push(ns.apps + ' app' + (ns.apps === 1 ? '' : 's'));
      if (parts.length) {
        var msg = parts.join(' and ') + ' from your website ' + (ns.games + ns.apps === 1 ? 'is' : 'are') + ' ready';
        if (started) UI.toast(msg, { icon: 'globe', sound: false });
        Notify.add({ key: 'site-' + Date.now(), icon: 'globe', title: 'New from your website', text: msg, action: { label: 'See them', run: 'go:library' } });
      }
      setTimeout(function () { D.prefetchSiteGames(); }, 5000);
    });
  }

  function applyEarly() {
    document.body.classList.toggle('no-scanlines', !D.settings.scanlines);
    document.body.classList.toggle('reduce-motion', !!D.settings.reduceMotion);
  }

  function tickClock() {
    var d = new Date();
    $('clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function wireTopbar() {
    $('brand').addEventListener('click', function () { logoHit(); go('home'); });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        /* clicking the tab you're already on tucks the app windows away */
        if (D.ui.view === t.dataset.view && Win.minimizeAll()) { Sound.back(); return; }
        go(t.dataset.view);
      });
    });
    $('btn-search').addEventListener('click', openSearch);
    $('btn-add').addEventListener('click', function () { Importer.addDialog(D.ui.view === 'apps' ? { kind: 'app' } : null); });
    $('btn-settings').addEventListener('click', function () { go('settings'); });
    $('btn-profile').addEventListener('click', function () { Trophies.profile(); });
    $('err-badge').addEventListener('click', function () { if (D.simple()) Player.problemDialog(); else Player.toggleMenu(); });
    $('touch-menu').addEventListener('click', function () { Player.toggleMenu(); });
    $('edge-pill').addEventListener('click', function () { Player.toggleMenu(); });
    document.addEventListener('mouseover', function (e) {
      var b = e.target.closest && e.target.closest('.gi, .btn, .tab, .qm-item, .chip, .mini-card');
      if (b && !b.contains(e.relatedTarget)) Sound.hover();
    });
  }

  window.App = {
    go: go,
    refresh: refresh,
    setAccent: setAccent,
    setAccentFor: setAccentFor,
    applySettings: applySettings,
    swReady: swReady,
    checkUpdate: checkUpdate
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
