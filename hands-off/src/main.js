/* HANDS OFF: the game itself. States, the hands-off guard, the HUD (drawn into a canvas the GPU bends),
   the reset (crack, shatter, rewind, roast), temptations, reality events, menus, saves and the tab lock. */
(function () {
  'use strict';
  const H = window.HO, G = window.HOGLYPH;
  const AU = window.HOAUDIO || { init() {}, resume() {}, suspend() {}, setVolumes() {}, update() {}, beat() { return null; }, sfx() {} };
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const eOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const nowMs = () => Date.now();
  const mq = (q) => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
  const reduced = mq('(prefers-reduced-motion: reduce)');
  const coarse = mq('(pointer: coarse)') || mq('(hover: none)');

  const FD = '"Unbounded", "Arial Black", "Segoe UI", system-ui, sans-serif';
  const FM = '"JetBrains Mono", ui-monospace, Consolas, "Courier New", monospace';
  const font = (w, px, fam) => w + ' ' + Math.max(1, Math.round(px)) + 'px ' + fam;
  try { ['900 80px Unbounded', '800 40px Unbounded', '700 20px Unbounded', '400 16px "JetBrains Mono"', '700 16px "JetBrains Mono"', '800 16px "JetBrains Mono"']
    .forEach((f) => document.fonts && document.fonts.load(f)); } catch (e) { /* offline: fallback fonts */ }

  const C = { ink: '#f3f1ff', muted: 'rgba(214,210,240,0.72)', dim: 'rgba(170,165,210,0.5)', cyan: '#3df2e6', magenta: '#ff3fb4', orange: '#ff8a3d', red: '#ff3b5c', void: '#05030b' };
  const KIND_COL = { mult: C.cyan, tempo: C.orange, resonance: C.magenta };

  const el = {
    gl: $('gl'), shatter: $('shatter'), fallback: $('fallback'), menu: $('menu'),
    runCard: $('runCard'), runTime: $('runTime'), runGain: $('runGain'),
    start: $('startBtn'), trop: $('tropBtn'), tropCount: $('tropCount'), set: $('setBtn'), records: $('records'),
    tropPanel: $('tropPanel'), tropGrid: $('tropGrid'), setPanel: $('setPanel'), qualitySeg: $('qualitySeg'),
    music: $('musicVol'), sfx: $('sfxVol'), flash: $('flashSw'), wipe: $('wipeBtn'), wipeConfirm: $('wipeConfirm'), wipeYes: $('wipeYes'), wipeNo: $('wipeNo'),
    exit: $('exitScreen'), exitRun: $('exitRun'), back: $('backBtn'), lock: $('lockScreen'), take: $('takeBtn'), sr: $('sr'),
  };

  // ---------------------------------------------------------------- renderer + HUD canvas
  // the real renderer (WebGL2: light bending, 3D chrome, real glass) first; the old one if this device can't run it
  let R = null;
  function freshCanvas() { const c = el.gl.cloneNode(false); el.gl.replaceWith(c); el.gl = c; return c; }
  function oldRenderer(fresh) { return window.HOGFX ? window.HOGFX.create(fresh ? freshCanvas() : el.gl) : { ok: false, error: 'renderer missing' }; }
  if (window.HOGFX2 && !/[?&]old\b/.test(location.search)) {
    R = window.HOGFX2.create(el.gl);
    if (!R.ok) R = oldRenderer(true);
  } else R = oldRenderer(false);
  const useReal = () => !!(R.real && R.ok && R.ready);
  const rq = (q) => (R.real ? q : q === 'max' ? 'insane' : q);
  function hookReal() {
    if (!R.real) return;
    R.onShardHit = (v, size, pan) => AU.sfx('tinkle', { v, size, pan });
    R.onSplash = () => AU.sfx('drip');
  }
  hookReal();
  function realFailed() { // the real shaders didn't build on this GPU: switch to the old renderer for good
    R = oldRenderer(true);
    if (R.ok) R.setQuality(rq(save.set.quality));
  }
  const hud = document.createElement('canvas');
  const hx = hud.getContext('2d');
  hud.setAttribute('aria-hidden', 'true');
  hud.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;display:none;z-index:1';
  document.body.appendChild(hud);
  let use2d = null;
  function applyFallback() {
    const want = !R.ok || (R.real && !R.ready);
    if (want === use2d) return;
    use2d = want;
    hud.style.display = use2d ? 'block' : 'none';
    el.fallback.hidden = !use2d;
    el.gl.style.visibility = use2d ? 'hidden' : 'visible';
  }
  applyFallback();
  function hudSize() {
    if (R.ok) return R.resize();
    const s = Math.min(window.devicePixelRatio || 1, 1.5);
    return [Math.max(2, Math.round(window.innerWidth * s)), Math.max(2, Math.round(window.innerHeight * s))];
  }

  // ---------------------------------------------------------------- save + tab lock
  const KEY = 'handsoff.save.v1', LOCK_KEY = 'handsoff.lock.v1';
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* no storage */ } }

  let save = H.parse(lsGet(KEY)) || H.newSave(nowMs());
  let runClock = save.savedAt; // wall-clock ms the run was last moved forward to

  const TAB = Math.random().toString(36).slice(2) + nowMs().toString(36);
  let owner = false;
  function readLock() { try { return JSON.parse(lsGet(LOCK_KEY) || 'null'); } catch (e) { return null; } }
  function heartbeat() { if (owner) lsSet(LOCK_KEY, JSON.stringify({ id: TAB, t: nowMs() })); }
  function tryOwn() {
    const l = readLock();
    if (!l || l.id === TAB || nowMs() - (+l.t || 0) > 4500) { owner = true; heartbeat(); return true; }
    return false;
  }
  function checkLock() { const l = readLock(); if (owner && l && l.id !== TAB) loseLock(); }
  window.addEventListener('storage', (e) => { if (e.key === LOCK_KEY) checkLock(); });
  setInterval(() => { checkLock(); heartbeat(); }, 1500);

  function saveNow() {
    if (!owner) return;
    const l = readLock();
    if (l && l.id !== TAB) { loseLock(); return; }
    save.savedAt = runClock;
    lsSet(KEY, H.serialize(save));
  }
  function loseLock() {
    owner = false;
    pend = null; rs = null; lostFocus = null;
    clearShatter();
    setState('lock');
    AU.suspend();
  }
  function takeOver() {
    owner = true; heartbeat();
    save = H.parse(lsGet(KEY)) || save; // the other tab saved last
    runClock = save.savedAt;
    awayReport = catchUp();
    if (R.ok) R.setQuality(rq(save.set.quality));
    applyVolumes();
    goMenu();
  }

  // ---------------------------------------------------------------- the run
  function advance(now) {
    const dt = (now - runClock) / 1000;
    runClock = now;
    if (!(dt > 0) || !save.run) return null; // a clock that went backwards just loses nothing
    save.rec.totalTime += dt;
    return H.step(save.run, dt);
  }
  // move the run up to now, keep records + trophies current, and play whatever happened
  function tick() {
    if (!owner || state === 'lock' || state === 'boot') return;
    const out = advance(nowMs());
    if (save.run) { recUpdate(); checkTrophies(); }
    if (out) onStep(out);
  }
  function recUpdate() {
    const r = save.run, rec = save.rec;
    if (r.t > rec.bestTime) rec.bestTime = r.t;
    if (r.maxLog > rec.bestLog) rec.bestLog = r.maxLog;
    if (r.level > rec.bestLevel) rec.bestLevel = r.level;
    const w = H.worldOf(r.level);
    if (w > rec.bestWorld) rec.bestWorld = w;
  }
  const toastQ = [];
  function grant(id) {
    if (save.tro[id] || !H.TRO[id]) return false;
    save.tro[id] = nowMs();
    toastQ.push(id);
    return true;
  }
  function checkTrophies() {
    const r = save.run;
    if (!r) return;
    for (let i = 0; i < H.TIME_SECS.length; i++) if (r.t >= H.TIME_SECS[i]) grant('time' + i); else break;
    for (let i = 0; i < 7; i++) { const t = H.TRO['num' + i]; if (r.maxLog >= t.log) grant(t.id); else break; }
    const w = H.worldOf(r.level);
    for (let i = 0; i < 4; i++) { const t = H.TRO['world' + i]; if (w >= t.world) grant(t.id); else break; }
  }
  function runSnap() {
    const r = save.run;
    return r ? { at: nowMs(), t: r.t, earned: r.earned, level: r.level, tier: r.maxTier, tro: Object.keys(save.tro).length } : { at: nowMs(), t: 0, earned: H.ZERO, level: 0, tier: 0, tro: Object.keys(save.tro).length };
  }
  function reportSince(b) {
    const r = save.run;
    if (!r || !b) return null;
    const gone = (nowMs() - b.at) / 1000;
    if (gone < 4) return null;
    return { gone, earned: b.earned === H.ZERO ? r.earned : H.L.sub(r.earned, b.earned), levels: r.level - b.level, milestones: r.maxTier - b.tier, trophies: Object.keys(save.tro).length - b.tro };
  }
  let awayReport = null;
  function catchUp() {
    const b = runSnap();
    b.at = runClock;
    const out = advance(nowMs());
    if (!save.run) return null;
    recUpdate(); checkTrophies();
    lastWorld = H.worldOf(save.run.level);
    return out ? reportSince(b) : null;
  }

  // world looks: chrome, glitch, black hole weights + extras (index = world % 6)
  const LOOK = [
    { mix: [1.0, 0.3, 0.0], glitch: 0.03, melt: 0 },     // CHROME
    { mix: [0.35, 1.0, 0.0], glitch: 0.14, melt: 0 },    // SIGNAL
    { mix: [0.0, 0.3, 1.0], glitch: 0.04, melt: 0 },     // HORIZON
    { mix: [1.0, 0.5, 0.3], glitch: 0.06, melt: 0.22 },  // MELT
    { mix: [1.0, 0.35, 1.0], glitch: 0.05, melt: 0 },    // ORBIT
    { mix: [1.0, 1.0, 1.0], glitch: 0.26, melt: 0.06 },  // COLLAPSE
  ];
  const ATTRACT = { mix: [0.85, 0.55, 0.8], glitch: 0.07, melt: 0 };
  function lookOf(w) {
    const i = ((w % 6) + 6) % 6, lap = Math.floor(w / 6), b = LOOK[i];
    return { mix: b.mix, glitch: b.glitch + Math.min(0.2, lap * 0.04), melt: b.melt, hue: lap * 0.17 + i * 0.035, folds: (i === 3 || i === 5) && lap >= 1 ? Math.min(9, 3 + lap) : 0 };
  }
  function stillness(r) { return r ? Math.min(1.5, 0.5 * Math.log10(1 + r.t / 10) + 0.025 * Math.min(12, H.worldOf(r.level))) : 0.45; }
  // music builds slower than the picture: hum, phonk at ~35s, breakcore at ~7 min, full chaos at 1 hour
  function musicIntensity(r) { return r ? clamp(Math.log10(1 + r.t / 15) / Math.log10(241), 0, 1) : 0; }

  // ---------------------------------------------------------------- state
  let state = 'boot';
  let liveT = 0;            // seconds live in this sitting
  let pend = null;          // the 0.6s between touching something and the reset
  let rs = null;            // the reset sequence
  let lostFocus = null;     // snapshot of the run when the window lost focus mid-run
  let lastWorld = 0;
  let runBestAtStart = 0;
  let recordSaid = false;

  function inGame(s) { s = s || state; return s === 'arming' || s === 'live' || s === 'pending' || s === 'reset'; }
  function setState(s) {
    state = s;
    document.body.classList.toggle('live', inGame(s));
    wantWake(inGame(s));
    el.menu.hidden = s !== 'menu';
    el.exit.hidden = s !== 'exit';
    el.lock.hidden = s !== 'lock';
  }

  const ARM = 3;
  const arm = { left: ARM, shake: 0, nope: 0, again: false, lastDigit: 4 };
  let welcome = null;       // { rep, t } "you were gone" card
  function startArming(opts) {
    opts = opts || {};
    arm.left = ARM; arm.shake = 0; arm.again = !!opts.again; arm.lastDigit = 4;
    welcome = opts.welcome ? { rep: opts.welcome, t: 0 } : null;
    pend = null;
    clearShatter();
    setState('arming');
    mx = null; padBase = null;
  }
  function goLive() {
    if (!save.run) {
      const now = nowMs();
      save.run = H.newRun(now);
      runClock = now;
      save.rec.runs++;
      lastWorld = 0;
      runBestAtStart = save.rec.bestTime;
      recordSaid = false;
      resetRunFx();
    } else {
      if (!runBestAtStart) runBestAtStart = save.rec.bestTime;
      if (save.run.t >= save.rec.bestTime - 1) recordSaid = true; // already the record, nothing new to say
    }
    liveT = 0;
    setState('live');
    padBase = null;
    fx.shock = 0; fx.pulse = Math.max(fx.pulse, 0.6); fx.glitch = Math.max(fx.glitch, 0.5);
    numPop = 1;
    AU.sfx('armed');
    saveNow();
  }
  function goMenu() {
    setState('menu');
    el.tropPanel.hidden = true; el.setPanel.hidden = true; el.wipeConfirm.hidden = true;
    refreshMenu();
    clearShatter();
  }
  function safeExit() {
    if (!inGame()) return;
    if (state === 'pending') pend = null;
    if (state === 'reset') rs = null;
    if (R.real) R.shatterStop();
    clearShatter();
    saveNow();
    setState('exit');
    refreshExit();
    AU.sfx('ui');
    try { window.close(); } catch (e) { /* only works for windows a script opened */ }
  }

  // ---------------------------------------------------------------- the hands-off guard
  let mx = null, my = null, moveAcc = 0, moveAt = 0;
  let padSeen = false, padBase = null;
  const MODS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'OS', 'AltGraph', 'Hyper', 'Super', 'Fn']);
  function hasFocus() { if (document.hidden) return false; try { return document.hasFocus(); } catch (e) { return true; } }
  function guardOn() { return (state === 'arming' || state === 'live' || state === 'pending') && hasFocus(); }

  function keyName(e) {
    const k = e.key || e.code || '?';
    const map = { ' ': 'SPACE', Escape: 'ESC', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Control: 'CTRL', Meta: 'THE WINDOWS KEY', OS: 'THE WINDOWS KEY', Backspace: 'BACKSPACE', Enter: 'ENTER', Tab: 'TAB' };
    const s = map[k] || (k.length === 1 ? k.toUpperCase() : k.toUpperCase());
    return s.length > 16 ? 'A KEY' : s;
  }
  function trigger(reason, x, y, extra) {
    if (state === 'arming') {
      arm.left = ARM; arm.shake = 1; arm.lastDigit = 3;
      const t = performance.now();
      if (t - arm.nope > 450) { arm.nope = t; AU.sfx('nope'); }
      return;
    }
    if (state === 'live') { startPending(reason, x, y, extra); return; }
    if (state === 'pending' && pend) {
      // still touching: the crack keeps spreading (it lands 0.6s after you stop, 1.5s at most)
      pend.last = pend.t;
      pend.more = Math.min(1, pend.more + 0.25);
      // you made it to the button (or the bait) in time: that's what you get roasted for
      if ((reason === 'push' || reason === 'bait' || reason === 'error') && pend.reason !== reason && typeof x === 'number') {
        const dpr = shatterDpr();
        pend.old.push(pend.cracks);
        pend.reason = reason; pend.mod = false; pend.cursor = true;
        pend.ix = x * dpr; pend.iy = y * dpr;
        pend.cracks = makeCracks(pend.ix, pend.iy); pend.crackT = pend.t;
        if (reason === 'push') pushPress = 1;
        AU.sfx('crack');
      }
    }
  }
  function hotspot(cx, cy) {
    if (!LY) return null;
    let x = cx * LY.k, y = cy * LY.k;
    // what you see is what you click, even upside down
    if (evIs('flip') && evEnv() > 0.5) { x = LY.W - x; y = LY.H - y; }
    if (evIs('mirror') && evEnv() > 0.5) x = LY.W - x;
    const p = LY.push;
    if (pushAlpha > 0.2 && Math.hypot(x - p.x, y - p.y) <= p.r * 1.15) return 'push';
    for (const it of tempt.items) {
      const b = temptRect(it);
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return it.kind;
    }
    return null;
  }
  function exitBtnHit(cx, cy) {
    if (!coarse || !LY) return false;
    const b = LY.exitBtn;
    return Math.hypot(cx * LY.k - b.x, cy * LY.k - b.y) <= b.r * 1.7;
  }

  window.addEventListener('mousemove', (e) => {
    if (!e.isTrusted) return;
    const x = e.clientX, y = e.clientY;
    if (!guardOn() || mx === null) { mx = x; my = y; return; }
    const d = Math.abs(x - mx) + Math.abs(y - my);
    mx = x; my = y;
    if (d <= 0) return; // browsers send fake moves when the page changes under a still mouse
    const t = performance.now();
    if (t - moveAt > 400) moveAcc = 0;
    moveAt = t; moveAcc += d;
    if (moveAcc >= 3) { moveAcc = 0; trigger('mouse', x, y); }
  }, { capture: true, passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted) return;
    if (e.pointerType === 'touch' && inGame() && exitBtnHit(e.clientX, e.clientY)) { e.preventDefault(); safeExit(); return; }
    if (!guardOn()) return;
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    const spot = hotspot(e.clientX, e.clientY);
    trigger(spot || (e.pointerType === 'touch' ? 'touch' : 'click'), e.clientX, e.clientY);
  }, { capture: true, passive: false });

  if (!window.PointerEvent) {
    window.addEventListener('touchstart', (e) => {
      if (!e.isTrusted || !e.touches.length) return;
      const t = e.touches[0];
      if (inGame() && exitBtnHit(t.clientX, t.clientY)) { e.preventDefault(); safeExit(); return; }
      if (!guardOn()) return;
      e.preventDefault();
      trigger(hotspot(t.clientX, t.clientY) || 'touch', t.clientX, t.clientY);
    }, { capture: true, passive: false });
    window.addEventListener('mousedown', (e) => {
      if (!e.isTrusted || !guardOn()) return;
      e.preventDefault();
      trigger(hotspot(e.clientX, e.clientY) || 'click', e.clientX, e.clientY);
    }, { capture: true });
  } else {
    // touching the screen during a run must never scroll or zoom the page
    window.addEventListener('touchstart', (e) => { if (inGame()) e.preventDefault(); }, { capture: true, passive: false });
  }
  window.addEventListener('touchmove', (e) => { if (inGame()) e.preventDefault(); }, { capture: true, passive: false });
  window.addEventListener('contextmenu', (e) => { if (inGame()) e.preventDefault(); }, { capture: true });
  window.addEventListener('wheel', (e) => {
    if (!e.isTrusted) return;
    if (inGame()) e.preventDefault();
    if (guardOn()) trigger('scroll', mx, my);
  }, { capture: true, passive: false });

  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted) return;
    const k = e.key || '';
    const isX = (e.code === 'KeyX' || k === 'x' || k === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (state === 'menu') { if (k === 'Escape') closePanels(); return; }
    if (!inGame()) return;
    if (isX) {
      // X is the safe way out. It can still rescue a stray Shift/Ctrl, not a mouse that already moved.
      if (state === 'pending' && !(pend && pend.reason === 'key' && pend.mod)) { e.preventDefault(); return; }
      e.preventDefault(); safeExit(); return;
    }
    const mod = MODS.has(k);
    // tab-switch and close-tab shortcuts stay with the browser; the reset waits and is cancelled if the page goes away
    if (!mod && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    if (!guardOn()) return;
    trigger('key', null, null, { name: keyName(e), mod, esc: k === 'Escape' });
  }, { capture: true });

  window.addEventListener('gamepadconnected', () => { padSeen = true; padBase = null; });
  function readPads() { try { return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { return []; } }
  function padCheck() {
    if (!guardOn()) { padBase = null; return; }
    const cur = readPads().map((p) => ({ id: p.index, b: p.buttons.map((b) => b.pressed || b.value > 0.5), a: Array.from(p.axes) }));
    if (!padBase) { padBase = cur; return; }
    for (const p of cur) {
      const b = padBase.find((q) => q.id === p.id);
      if (!b) { padBase = cur; return; }
      let hit = false;
      for (let i = 0; i < p.b.length; i++) if (p.b[i] && !b.b[i]) hit = true;
      for (let i = 0; i < p.a.length; i++) if (Math.abs(p.a[i] - (b.a[i] || 0)) > 0.3) hit = true;
      if (hit) { padBase = cur; trigger('pad', null, null); return; }
    }
  }

  // PC only: keep the screen awake during a run, so waking it up with the mouse can't reset you.
  // Phones are allowed to sleep (screen off = the run keeps going like a closed tab).
  let wake = null, wakeWant = false;
  function wantWake(on) {
    if (coarse || !navigator.wakeLock) return;
    wakeWant = on;
    if (on && !wake && !document.hidden) {
      navigator.wakeLock.request('screen').then((w) => {
        if (!wakeWant) { w.release().catch(() => {}); return; }
        wake = w; w.addEventListener('release', () => { wake = null; });
      }).catch(() => {});
    } else if (!on && wake) { wake.release().catch(() => {}); wake = null; }
  }
  let rollSnap = null, rollT = 0; // the run a second ago, for "you were gone" after the computer froze or slept

  // leaving is always safe: losing focus or hiding the page cancels a reset that hasn't landed yet
  function onAway() {
    if (state === 'pending') cancelPending();
    if (inGame() && owner && !lostFocus) lostFocus = runSnap();
    saveNow();
    if (document.hidden) AU.suspend();
  }
  function onBack() {
    if (document.hidden) return;
    AU.resume();
    if (inGame()) wantWake(true);
    if (!hasFocus()) return;
    if (lostFocus && (state === 'live' || state === 'arming')) {
      tick(); // catch up first, so "you were gone" shows what you really got
      const rep = reportSince(lostFocus);
      lostFocus = null;
      startArming({ welcome: rep });
    } else lostFocus = null;
  }
  window.addEventListener('blur', onAway);
  window.addEventListener('focus', onBack);
  document.addEventListener('visibilitychange', () => (document.hidden ? onAway() : onBack()));
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);

  // ---------------------------------------------------------------- pending + reset
  function startPending(reason, x, y, extra) {
    const dpr = shatterDpr();
    const hasPos = typeof x === 'number' && typeof y === 'number';
    const ix = hasPos ? x * dpr : window.innerWidth * dpr / 2;
    const iy = hasPos ? y * dpr : (LY ? LY.cy / LY.k : window.innerHeight * 0.465) * dpr;
    pend = {
      t: 0, reason, mod: !!(extra && extra.mod), key: extra && extra.name, esc: !!(extra && extra.esc),
      ix, iy, cursor: hasPos && (reason === 'mouse' || reason === 'click' || reason === 'push' || reason === 'bait' || reason === 'error'),
      cracks: makeCracks(ix, iy), old: [], crackT: 0, last: 0, more: 0, commit: false, runT: save.run ? save.run.t : 0,
      frozen: liveVals(),
    };
    setState('pending');
    fx.shake = Math.max(fx.shake, 0.7); fx.glitch = Math.max(fx.glitch, 0.7);
    if (reason === 'push') pushPress = 1;
    AU.sfx('crack');
  }
  function cancelPending() {
    pend = null;
    clearShatter();
    setState('live');
  }
  function updPending(dt) {
    pend.t += dt;
    // lands right after this frame is drawn (the shatter needs a picture of it)
    if (pend.t - pend.last >= 0.6 || pend.t >= 1.5) pend.commit = true;
  }

  const REASON = {
    mouse: 'YOU MOVED THE MOUSE.', click: 'YOU CLICKED.', scroll: 'YOU SCROLLED.', touch: 'YOU TOUCHED THE SCREEN.', pad: 'YOU TOUCHED THE CONTROLLER.',
    push: 'IT SAID PUSH. YOU LISTENED.', bait: 'THERE WAS NOTHING FREE.', error: 'IT WASN\'T BROKEN. NOW IT IS.',
  };
  function roastTitle(n, quick) {
    if (n === 1) return 'WHY WOULD YOU DO SOMETHING?';
    if (n === 10) return 'AGAIN??';
    if (n === 50) return 'BRO.';
    if (n === 100) return 'YOU HAD ONE JOB';
    if (quick) return pick(['TOO SOON.', 'NOT EVEN CLOSE.', 'NOPE.', 'INSTANTLY.', 'THAT WAS FAST.']);
    if (n <= 5) return pick(['YOU HAD IT.', 'AGAIN??', 'THE ONE RULE.', 'SERIOUSLY?']);
    if (n <= 20) return pick(['BRO.', 'WHY ARE YOU LIKE THIS', 'IT SAID HANDS OFF.', 'INCREDIBLE.']);
    return pick(['YOU HAD ONE JOB', 'NOTHING. YOU HAD TO DO NOTHING.', 'PUT IT DOWN.', 'WE BOTH KNEW.', 'EVERY TIME.', 'AND THERE IT GOES.']);
  }
  function commitReset() {
    const p = pend; pend = null;
    const r = save.run;
    if (!r) { startArming({ again: true }); return; }
    const rec = save.rec;
    rec.resets++;
    const lost = { log: r.logC, maxLog: r.maxLog, level: r.level, world: H.worldOf(r.level), t: r.t, tier: r.maxTier, money: H.moneyName(r.maxTier), ups: r.ups };
    [[1, 'reset1'], [10, 'reset10'], [50, 'reset50'], [100, 'reset100']].forEach(([n, id]) => { if (rec.resets >= n) grant(id); });
    if (Math.min(r.t, p.runT === undefined ? r.t : p.runT) < 1) grant('flinch');   // the first twitch counts, not when the glass gives
    if (r.maxLog >= 2) { const f = r.maxLog / 3 - Math.floor(r.maxLog / 3 + 1e-12); if (f >= 0.88) grant('close'); }
    const tro = { push: 'push', bait: 'bait', error: 'error', key: 'keys', touch: 'touch', scroll: 'scroll', pad: 'pad' }[p.reason];
    if (tro) grant(tro);
    save.run = null;
    saveNow();
    const quick = lost.t < 2;
    let line = p.reason === 'key' ? (p.esc ? 'ESC DOESN\'T SAVE YOU. X DOES.' : 'YOU PRESSED ' + (p.key || 'A KEY') + '.') : REASON[p.reason] || 'YOU DID SOMETHING.';
    rs = {
      t: 0, quick, lost, reason: p.reason, line,
      title: roastTitle(rec.resets, quick), n: rec.resets,
      slamAt: quick ? 0.05 : 1.75, endAt: quick ? 1.9 : 5.2, slammed: false,
      ix: p.ix, iy: p.iy, cursor: p.cursor,
    };
    setState('reset');
    if (!quick && useReal()) {
      R.shatterStart({ w: sh.w, h: sh.h, ix: p.ix, iy: p.iy, angles: p.cracks.angles, crackCanvas: el.shatter });
      clearShatter();
      rs.real = true; rs.slamAt = R.SHATTER.slamAt; rs.endAt = R.SHATTER.endAt; rs.rewAt = R.SHATTER.rewStart;
      AU.sfx('shatter', { big: true });
    } else if (!quick) { buildShards(p); AU.sfx('shatter'); AU.sfx('rewind'); }
    else { fx.shake = Math.max(fx.shake, 0.8); AU.sfx('nope'); }
    announce(rs.title + ' ' + line + ' Everything reset.');
    // the next run starts clean
    tempt.items.length = 0; tempt.cursor = null; ev.cur = null;
  }
  function updReset(dt) {
    rs.t += dt;
    if (rs.real && !rs.rewSaid && rs.t >= rs.rewAt) { rs.rewSaid = true; AU.sfx('rewind'); }
    if (!rs.slammed && rs.t >= rs.slamAt) {
      rs.slammed = true; rs.slamT = 0;
      fx.shake = Math.max(fx.shake, 1); fx.glitch = 1;
      fx.flash = flashesOK() ? 0.25 : 0.06; fx.flashCol = [1, 0.15, 0.45];
      AU.sfx('slam');
    }
    if (rs.slammed) rs.slamT += dt;
    if (rs.t >= rs.endAt) { rs = null; clearShatter(); if (R.real) R.shatterStop(); startArming({ again: true }); }
  }

  // ---------------------------------------------------------------- effects state
  const fx = { pulse: 0, shock: 1, flash: 0, flashCol: [1, 1, 1], shake: 0, glitch: 0, hue: 0, hs: 0, spin: 0, mix: [0.85, 0.55, 0.8], baseGlitch: 0.05, melt: 0, folds: 0 };
  let sceneT = 0, stillNow = 0.45, growNow = 0, numPop = 0, pushPress = 0, pushAlpha = 0;
  let bigWord = null, morph = null, worldSweep = null;
  function flashesOK() { return save.set.flashes && !reduced; }
  const FLASH_COLS = [[0.24, 0.95, 0.9], [1, 0.25, 0.7], [1, 0.55, 0.24], [0.85, 0.8, 1]];
  function resetRunFx() {
    tempt.items.length = 0; tempt.cursor = null; tempt.next = rnd(14, 22); tempt.cursorNext = rnd(70, 110);
    ev.cur = null; ev.next = rnd(35, 50);
    ring.list.length = 0; feed.length = 0; bigWord = null; morph = null; worldSweep = null;
    voice.t = 99;
  }
  function milestoneFx(tier, count) {
    fx.pulse = 1; fx.shock = 0; fx.shake = Math.max(fx.shake, reduced ? 0.2 : 0.85);
    fx.flash = flashesOK() ? 0.5 : 0.08; fx.flashCol = FLASH_COLS[tier % FLASH_COLS.length];
    fx.glitch = Math.max(fx.glitch, 0.55);
    bigWord = { text: (H.tierName(tier) || '').toUpperCase(), t: 0 };
    morph = { from: H.moneyName(Math.max(0, tier - 1)), to: H.moneyName(tier), fi: Math.max(0, tier - 1), ti: tier, t: 0 };
    numPop = 1;
    if (R.real) R.kick('milestone', 1);
    if (LY) burst(LY.cx, LY.cy, 150, tier);
    const name = H.tierName(tier);
    feedPush('1 ' + name.toUpperCase() + (count > 1 ? '  (+' + (count - 1) + ')' : ''), 'MONEY IS NOW ' + H.moneyName(tier), C.cyan, { money: tier });
    AU.sfx('milestone', { tier });
    announce('1 ' + name + '. Money is now ' + H.moneyName(tier) + '.');
    if (Math.random() < 0.3 && !ev.cur && state === 'live') startEvent('glitchstorm');
  }
  function worldFx(w) {
    worldSweep = { w, name: H.worldName(w), t: 0 };
    if (R.real) R.dive(w);
    fx.glitch = 1; fx.shock = 0; fx.pulse = Math.max(fx.pulse, 0.7);
    feedPush('WORLD ' + (w + 1), H.worldName(w), C.magenta, null);
    AU.sfx('world', { w });
    announce('World ' + (w + 1) + ': ' + H.worldName(w));
  }
  function upDesc(u) {
    if (u.kind === 'tempo') return 'LEVELS ' + Math.round(u.speed * 100) + '% FASTER';
    if (u.kind === 'resonance') return 'GROWS WITH YOUR LEVEL';
    return 'x' + Math.pow(10, u.mult).toFixed(1) + ' MONEY';
  }
  function boughtFx(ks) {
    const show = ks.slice(-6);
    for (const k of show) ringAdd(H.upgrade(k));
    const u = H.upgrade(ks[ks.length - 1]);
    feedPush('+ ' + u.name, upDesc(u), KIND_COL[u.kind], { sigil: u }, 'up', ks.length);
    AU.sfx('buy', { kind: u.kind });
    if (R.real) R.kick('buy');
  }
  function onStep(out) {
    if (!(state === 'live' || state === 'pending' || state === 'arming')) return;
    if (out.milestones.length) milestoneFx(out.milestones[out.milestones.length - 1], out.milestones.length);
    if (out.bought.length) boughtFx(out.bought);
    if (out.levels) { levelPing = 1; if (out.levels > 1 || save.run.level % 5 === 0) AU.sfx('level'); if (R.real) R.kick('level'); }
  }
  let levelPing = 0;
  function worldCheck() {
    const r = save.run;
    if (!r) return;
    const w = H.worldOf(r.level);
    if (w !== lastWorld) { if (w > lastWorld) worldFx(w); lastWorld = w; }
  }

  // ---------------------------------------------------------------- feed, ring of upgrades, particles, toasts
  const feed = [];
  function feedPush(a, b, col, icon, key, n) {
    const last = feed[feed.length - 1];
    if (key && last && last.key === key && last.t < 0.9) {
      last.n += n || 1; last.a = '+' + last.n + ' UPGRADES'; last.b = a.replace(/^\+ /, '') + ' · ' + b; last.icon = icon; last.col = col; last.t = Math.min(last.t, 0.3);
      return;
    }
    feed.push({ a: key === 'up' && (n || 1) > 1 ? '+' + n + ' UPGRADES' : a, b, col, icon, key, n: n || 1, t: 0 });
    while (feed.length > 5) feed.shift();
  }
  const ring = { list: [], rot: 0 };
  const RING_N = 40;
  function ringAdd(u) {
    ring.list.push({ u, p: null, arrive: 0 });
    while (ring.list.length > RING_N) ring.list.shift();
  }
  const parts = [];
  function burst(x, y, n, tier) {
    const S = LY ? LY.S : 1;
    for (let i = 0; i < n && parts.length < 420; i++) {
      const a = Math.random() * TAU, sp = rnd(250, 1300) * S;
      parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, life: 0, max: rnd(0.5, 1.2), col: pick([C.cyan, C.magenta, C.orange, '#ffffff']), w: rnd(1.2, 3) * S });
    }
    for (let i = 0; i < 18 && parts.length < 440; i++) {
      const a = Math.random() * TAU, sp = rnd(120, 520) * S;
      parts.push({ kind: 'glyph', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rnd(0.9, 1.6), col: pick([C.cyan, '#ffffff', C.magenta]), size: rnd(7, 13) * S, idx: tier, rot: rnd(0, TAU), vr: rnd(-4, 4) });
    }
  }
  function streamIn(dt, inten) {
    if (!LY) return;
    streamAcc += dt * (1.2 + 7 * inten);
    while (streamAcc >= 1 && parts.length < 420) {
      streamAcc -= 1;
      const a = Math.random() * TAU;
      const sx = LY.cx + Math.cos(a) * LY.W * 0.62, sy = LY.cy + Math.sin(a) * LY.H * 0.62;
      parts.push({ kind: 'in', x: sx, y: sy, sx, sy, life: 0, max: rnd(1.1, 2.0), col: Math.random() < 0.7 ? C.cyan : '#ffffff', size: rnd(4, 8) * LY.S, idx: save.run ? save.run.maxTier : 0, rot: rnd(0, TAU), vr: rnd(-2, 2) });
    }
  }
  let streamAcc = 0;
  function updParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.kind === 'in') continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = Math.exp(-dt * 2.2);
      p.vx *= drag; p.vy *= drag;
      if (p.kind === 'glyph') { p.vy += 120 * dt * (LY ? LY.S : 1); p.rot += p.vr * dt; }
    }
  }
  const toast = { cur: null };
  function updToasts(dt) {
    if (!toast.cur && toastQ.length && (state === 'live' || state === 'arming')) {
      const id = toastQ.shift();
      toast.cur = { id, t: 0 };
      AU.sfx('toast');
      announce('Trophy: ' + H.TRO[id].name);
    }
    if (toast.cur) { toast.cur.t += dt * (toastQ.length > 2 ? 1.8 : 1); if (toast.cur.t > 3.8) toast.cur = null; }
  }

  // ---------------------------------------------------------------- temptations
  const tempt = { next: 18, items: [], cursor: null, cursorNext: 90 };
  const BAITS = [
    ['FREE x10 BOOST', 'CLICK TO CLAIM'], ['DOUBLE EVERYTHING', 'ONE CLICK. NO CATCH.'], ['SKIP 1 HOUR', 'CLICK TO SKIP'],
    ['YOU WON', 'CLICK TO COLLECT'], ['CLAIM {BIG}', 'EXPIRES SOON'], ['SPEED x100', 'TAP HERE'], ['+50 LEVELS', 'FREE. CLICK.'],
  ];
  const ERRS = [
    ['ERROR 0x7F', 'INCOME STALLED', 'FIX'], ['SAVE FAILED', 'YOUR RUN IS NOT SAVING', 'RETRY'], ['CURSOR LOST', 'MOVE MOUSE TO FIND IT', 'FIND'],
    ['NUMBER OVERFLOW', 'CLICK TO CLEAR', 'CLEAR'], ['REALITY.DLL', 'NOT RESPONDING', 'END TASK'], ['LOW MEMORY', 'CLOSE SOMETHING', 'OK'],
  ];
  function temptBox(L) { return { w: Math.min(L.W * 0.44, 270 * L.S), h: 82 * L.S }; }
  function temptRect(it) {
    if (!LY) return null;
    const b = temptBox(LY);
    return { x: it.fx * LY.W, y: it.fy * LY.H, w: b.w, h: b.h };
  }
  function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function spawnTempt(crazy) {
    if (!LY) return;
    const L = LY, b = temptBox(L);
    const kind = Math.random() < 0.55 ? 'bait' : 'error';
    for (let tries = 0; tries < 40; tries++) {
      const x = rnd(L.pad, L.W - L.pad - b.w), y = rnd(L.pad + 60 * L.S, L.H - L.pad - b.h - 60 * L.S);
      const box = { x: x - 10 * L.S, y: y - 10 * L.S, w: b.w + 20 * L.S, h: b.h + 20 * L.S };
      if (L.keep.some((k) => overlaps(box, k))) continue;
      if (tempt.items.some((it) => overlaps(box, temptRect(it)))) continue;
      const src = kind === 'bait' ? pick(BAITS) : pick(ERRS);
      const big = save.run && save.run.logC > 3 ? H.short(save.run.logC + 3) : '1 million';
      tempt.items.push({ kind, fx: x / L.W, fy: y / L.H, t: 0, dur: rnd(5.5, 8), a: src[0].replace('{BIG}', big.toUpperCase()), b: src[1], btn: src[2] || '', seed: Math.random() * 1000, wob: 0.4 + crazy });
      AU.sfx(kind === 'bait' ? 'bait' : 'error');
      return;
    }
  }
  function startFakeCursor() {
    if (!LY) return;
    const side = Math.floor(Math.random() * 3);
    const sx = side === 0 ? rnd(0.2, 0.6) : side === 1 ? -0.03 : rnd(0.3, 0.7), sy = side === 0 ? -0.04 : side === 1 ? rnd(0.3, 0.8) : 1.04;
    tempt.cursor = { sx, sy, t: 0, dur: 6.4, clicked: false };
  }
  function updTempt(dt, r) {
    for (const it of tempt.items) it.t += dt;
    for (let i = tempt.items.length - 1; i >= 0; i--) if (tempt.items[i].t >= tempt.items[i].dur) tempt.items.splice(i, 1);
    if (liveT < 12) return;
    tempt.next -= dt;
    if (tempt.next <= 0) {
      const crazy = clamp(r.t / 1800, 0, 1);
      if (tempt.items.length < 1 + Math.floor(crazy * 2)) spawnTempt(crazy);
      tempt.next = rnd(9, 24) * (1 - 0.5 * crazy);
    }
    tempt.cursorNext -= dt;
    if (!tempt.cursor && tempt.cursorNext <= 0 && liveT > 60) { startFakeCursor(); tempt.cursorNext = rnd(90, 170); }
    if (tempt.cursor) {
      const c = tempt.cursor;
      c.t += dt;
      if (!c.clicked && c.t >= 4.3) { c.clicked = true; pushPress = 1; AU.sfx('fakeclick'); voice.line = '...JUST KIDDING.'; voice.t = 0; voice.dur = 3; }
      if (c.t >= c.dur) tempt.cursor = null;
    }
  }

  // the PUSH button talks: cold first, unhinged the longer you hold out
  const VOICE = [
    [45, ['TOUCH ME.', 'ONE CLICK.', 'IT\'S RIGHT THERE.', 'GO ON.']],
    [300, ['YOU WANT TO.', 'NOBODY WOULD KNOW.', 'JUST ONCE.', 'WHAT DOES IT DO?', 'YOU\'RE CURIOUS.']],
    [1800, ['PUSH IT.', 'I CAN WAIT.', 'YOUR HAND IS SHAKING.', 'DO SOMETHING.', 'THIS IS BORING. RIGHT?', 'I KNOW YOU\'RE THERE.']],
    [7200, ['PUSH PUSH PUSH', 'WHY ARE YOU STILL HERE', 'I AM THE ONLY THING LEFT', 'IT WILL BE FUN', 'ONE. CLICK.']],
    [Infinity, ['YOU ARE NOT REAL', 'NOTHING IS HAPPENING. TOUCH ME.', 'I COUNTED EVERY SECOND', 'PLEASE', 'LET ME OUT']],
  ];
  const voice = { line: '', t: 99, dur: 0, tier: 0 };
  function updVoice(dt, r) {
    voice.t += dt;
    if (voice.t < voice.dur) return;
    let tier = 0;
    while (r.t >= VOICE[tier][0]) tier++;
    voice.tier = tier;
    const list = VOICE[tier][1];
    let line = pick(list);
    for (let i = 0; i < 4 && line === voice.line; i++) line = pick(list);
    voice.line = line; voice.t = 0; voice.dur = Math.max(3, rnd(4.5, 6.5) - tier * 0.4);
  }

  // ---------------------------------------------------------------- reality events (never cover the view for long)
  const EVENTS = {
    flip: { dur: 5.5, label: 'FLIPPED' }, mirror: { dur: 4.5, label: 'MIRRORED' }, slowmo: { dur: 5, label: 'SLOWED' }, freeze: { dur: 1.8, label: 'STOPPED' },
    invert: { dur: 2.6, label: 'INVERTED', flashy: true }, scramble: { dur: 2.6, label: 'SCRAMBLED' }, melt: { dur: 5, label: 'MELTING' }, kaleido: { dur: 6, label: 'FOLDED' },
    huestorm: { dur: 5, label: 'RECOLORED' }, glitchstorm: { dur: 2.2, label: 'CORRUPTED' }, double: { dur: 4, label: 'DOUBLED' }, drift: { dur: 6, label: 'LOOSE' }, spin: { dur: 4, label: 'SPINNING' },
  };
  const ev = { next: 40, cur: null };
  function startEvent(name) {
    const d = EVENTS[name];
    if (!d) return;
    ev.cur = { name, t: 0, dur: d.dur };
    if (name !== 'glitchstorm') feedPush('REALITY: ' + d.label, '', C.magenta, null);
    AU.sfx('event', { name });
  }
  function endEvent() {
    const e = ev.cur;
    ev.cur = null;
    if (e && e.name === 'freeze') { fx.shock = 0; fx.glitch = 1; AU.sfx('glitch'); }
  }
  function updEvents(dt) {
    if (ev.cur) {
      ev.cur.t += dt;
      const en = evEnv();
      if (ev.cur.name === 'huestorm') { fx.hue += dt * 1.6 * en; fx.hs += dt * 2.4 * en; }
      if (ev.cur.name === 'spin') fx.spin += dt * 5 * en;
      if (ev.cur.t >= ev.cur.dur) endEvent();
      return;
    }
    ev.next -= dt;
    if (ev.next <= 0 && liveT > 25) {
      const names = Object.keys(EVENTS).filter((n) => !(EVENTS[n].flashy && !flashesOK()) && !(reduced && (n === 'flip' || n === 'mirror' || n === 'spin')));
      startEvent(pick(names));
      ev.next = rnd(18, 50) * (1 - 0.4 * clamp(stillNow / 1.5, 0, 1));
    }
  }
  function evEnv() {
    const e = ev.cur;
    if (!e) return 0;
    const a = Math.min(0.8, e.dur * 0.25);
    return sstep(Math.min(e.t / a, (e.dur - e.t) / a, 1));
  }
  function evIs(n) { return ev.cur && ev.cur.name === n; }
  function timeScale() {
    if (state === 'pending') return 0.3;
    if (evIs('freeze')) return 0;
    if (evIs('slowmo')) return 1 - 0.85 * evEnv();
    return 1;
  }

  // ---------------------------------------------------------------- update
  let menuTimer = 0;
  function update(dt) {
    sceneT += dt * timeScale();
    const r = save.run;
    const playing = inGame() && r;
    stillNow = lerp(stillNow, playing ? stillness(r) : 0.45, 1 - Math.exp(-dt * 1.2));
    growNow = lerp(growNow, playing ? clamp(r.maxTier / 30, 0, 1) : 0.3, 1 - Math.exp(-dt * 0.8));
    // look of the current world
    const look = playing ? lookOf(H.worldOf(r.level)) : state === 'reset' ? null : { mix: ATTRACT.mix, glitch: ATTRACT.glitch, melt: 0, hue: 0, folds: 0 };
    if (look) {
      const k = 1 - Math.exp(-dt * 0.9);
      for (let i = 0; i < 3; i++) fx.mix[i] = lerp(fx.mix[i], look.mix[i], k);
      fx.baseGlitch = lerp(fx.baseGlitch, look.glitch, k);
      fx.melt = lerp(fx.melt, look.melt, k);
      fx.folds = look.folds;
      fx.hueBase = look.hue;
    }
    fx.hue += dt * 0.004;
    if (!evIs('huestorm')) fx.hs = lerp(fx.hs, Math.round(fx.hs / TAU) * TAU, 1 - Math.exp(-dt * 2));
    fx.pulse *= Math.exp(-dt * 2.2);
    fx.shock = Math.min(1, fx.shock + dt * 0.8);
    fx.flash *= Math.exp(-dt * 4.5);
    fx.shake *= Math.exp(-dt * 4);
    fx.glitch *= Math.exp(-dt * 2.5);
    numPop *= Math.exp(-dt * 5);
    pushPress *= Math.exp(-dt * 6);
    levelPing *= Math.exp(-dt * 4);
    if (bigWord && (bigWord.t += dt) > 1.8) bigWord = null;
    if (morph && (morph.t += dt) > 1.2) morph = null;
    if (worldSweep && (worldSweep.t += dt) > 2.4) worldSweep = null;
    if (welcome) welcome.t += dt;
    arm.shake *= Math.exp(-dt * 6);

    if (state === 'arming') {
      if (hasFocus()) arm.left -= dt;
      const d = Math.ceil(arm.left);
      if (d < arm.lastDigit && d >= 1) { arm.lastDigit = d; AU.sfx('tick', { n: d }); }
      if (arm.left <= 0) goLive();
    } else if (state === 'live') {
      liveT += dt;
      rollT += dt;
      if (rollT > 1 || !rollSnap) { rollT = 0; rollSnap = runSnap(); }
      worldCheck();
      updTempt(dt, r);
      updEvents(dt);
      updVoice(dt, r);
      streamIn(dt, clamp(stillNow / 1.5, 0, 1));
      if (!recordSaid && runBestAtStart > 30 && r.t > runBestAtStart) { recordSaid = true; feedPush('NEW RECORD', 'LONGEST HANDS-OFF EVER', C.cyan, null); AU.sfx('toast'); }
    } else if (state === 'pending') updPending(dt);
    else if (state === 'reset') updReset(dt);
    pushAlpha = lerp(pushAlpha, state === 'live' && liveT > 2 ? 1 : state === 'pending' ? pushAlpha : 0, 1 - Math.exp(-dt * 3));
    if (padSeen) padCheck();
    updParticles(dt);
    for (const it of ring.list) it.arrive = Math.min(1, it.arrive + dt / 0.8);
    ring.rot = (ring.rot + dt * 0.006) % 1;
    for (const f of feed) f.t += dt;
    while (feed.length && feed[0].t > 8) feed.shift();
    updToasts(dt);
    AU.update(dt, { mode: state, intensity: musicIntensity(r), slow: 1 - timeScale(), world: r ? H.worldOf(r.level) : 0 });
    if (state === 'menu' || state === 'exit') {
      menuTimer += dt;
      if (menuTimer > 0.5) { menuTimer = 0; if (state === 'menu') { refreshRunCard(); refreshRecords(); } else refreshExit(); }
    }
  }

  // ---------------------------------------------------------------- layout
  let LY = null;
  function layout(W, Hh) {
    const S = Math.min(W, Hh * 1.7) / 1000;
    const k = W / Math.max(1, window.innerWidth);
    const narrow = W < Hh * 0.9;
    const pad = Math.max(16 * S, Math.min(W, Hh) * 0.03);
    const cx = W / 2, cy = Hh / 2 - 0.035 * Math.min(W, Hh); // same spot as the center of the 3D scene
    const numSize = Math.min(122 * S, W * (narrow ? 0.21 : 0.16));
    const pr = Math.max(26 * k, (narrow ? 40 : 50) * S);
    const push = { x: W - pad - pr * 1.25, y: Hh - pad - pr * 1.25, r: pr };
    const exitBtn = { x: W - pad - 14 * k, y: pad + 14 * k, r: 13 * k };
    const barY = cy + numSize * 1.5; // level + hands-off timer sit right under the number
    const centerW = Math.max(LY && LY.numW ? LY.numW * 1.12 : 0, Math.min(W * 0.7, 520 * S));
    const keep = [
      { x: 0, y: 0, w: 300 * S + pad, h: 74 * S + pad },
      { x: W - 270 * S - pad, y: 0, w: 270 * S + pad, h: 74 * S + pad },
      { x: 0, y: Hh - 150 * S - pad, w: Math.min(W * 0.42, 400 * S) + pad, h: 150 * S + pad },
      { x: push.x - pr * 1.4 - 300 * S, y: push.y - pr * 1.5 - 44 * S, w: W - (push.x - pr * 1.4 - 300 * S), h: Hh - (push.y - pr * 1.5 - 44 * S) },
      { x: cx - Math.max(centerW, 480 * S) / 2, y: cy - numSize * 0.85, w: Math.max(centerW, 480 * S), h: numSize * 2.35 + 60 * S },
    ];
    return { W, H: Hh, S, k, narrow, pad, cx, cy, cyUv: 1 - cy / Hh, numSize, push, exitBtn, barY, keep, numW: LY ? LY.numW : 0 };
  }

  // ---------------------------------------------------------------- HUD drawing
  const GLITCH_CH = '#%&/\\|<>[]{}=+*?!01';
  let scrAmt = 0, scrSeed = 0;
  function scr(s, amt, seed) {
    amt = Math.max(amt || 0, scrAmt);
    if (amt <= 0 || !s) return s;
    seed = seed === undefined ? scrSeed : seed;
    let o = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      o += ch !== ' ' && H.hash(seed * 131 + i * 17) < amt ? GLITCH_CH[Math.floor(H.hash(seed * 7 + i * 3 + 1) * GLITCH_CH.length)] : ch;
    }
    return o;
  }
  function spacing(c, px) { if ('letterSpacing' in c) c.letterSpacing = Math.round(px) + 'px'; }
  function text(c, s, x, y, f, col, align, base) {
    c.font = f; c.fillStyle = col; c.textAlign = align || 'left'; c.textBaseline = base || 'alphabetic';
    c.fillText(s, x, y);
  }
  function chromeText(c, s, x, y, size, alpha, split) {
    c.font = font(900, size, FD); c.textAlign = 'center'; c.textBaseline = 'middle';
    const off = size * (0.014 + (split || 0));
    c.globalAlpha = alpha * 0.8;
    c.fillStyle = C.magenta; c.fillText(s, x - off, y);
    c.fillStyle = C.cyan; c.fillText(s, x + off, y);
    c.globalAlpha = alpha;
    c.lineJoin = 'round';
    c.lineWidth = Math.max(2, size * 0.05); c.strokeStyle = 'rgba(5,3,11,0.6)'; c.strokeText(s, x, y);
    const g = c.createLinearGradient(0, y - size * 0.42, 0, y + size * 0.42);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.44, '#e1e5ff'); g.addColorStop(0.5, '#8a87b6'); g.addColorStop(0.57, '#f8f5ff'); g.addColorStop(1, '#a6f3ff');
    c.fillStyle = g; c.fillText(s, x, y);
    c.globalAlpha = 1;
  }
  function fitFont(c, s, weight, fam, size, maxW) {
    c.font = font(weight, size, fam);
    const w = c.measureText(s).width;
    return w > maxW ? size * maxW / w : size;
  }
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function liveVals() {
    const r = save.run;
    if (!r) return null;
    const p = H.parts(r.logC);
    let num = p.num, word = p.word.toUpperCase();
    if (word.length > 26) { num = H.short(r.logC); word = 'TOO BIG TO NAME'; }
    return { num, word, money: H.moneyName(r.maxTier), tier: r.maxTier, inc: H.short(H.incomeLog(r)), level: r.level, lp: r.lp, t: r.t, w: H.worldOf(r.level), speed: r.speed };
  }

  function drawScrim(c, L, a) {
    const rw = Math.max(L.numW * 0.75, 300 * L.S), rh = L.numSize * 1.75;
    c.save();
    c.translate(L.cx, L.cy + L.numSize * 0.5);
    c.scale(1, rh / rw);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rw);
    g.addColorStop(0, 'rgba(3,1,10,' + (0.5 * a) + ')'); g.addColorStop(0.6, 'rgba(3,1,10,' + (0.28 * a) + ')'); g.addColorStop(1, 'rgba(3,1,10,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rw, 0, TAU); c.fill();
    c.restore();
  }

  function perim(L, u) {
    const m = L.pad * 0.55;
    const x0 = m, y0 = m, x1 = L.W - m, y1 = L.H - m;
    const w = x1 - x0, h = y1 - y0, total = 2 * (w + h);
    let d = (((u % 1) + 1) % 1) * total;
    if (d < w) return [x0 + d, y0];
    d -= w; if (d < h) return [x1, y0 + d];
    d -= h; if (d < w) return [x1 - d, y1];
    d -= w; return [x0, y1 - d];
  }
  function drawRing(c, L) {
    const n = ring.list.length;
    if (!n) return;
    const size = Math.max(5, 8 * L.S);
    for (let i = 0; i < n; i++) {
      const it = ring.list[i];
      const target = (i / RING_N + ring.rot) % 1;
      if (it.p === null) it.p = target;
      let d = target - it.p; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
      it.p = (it.p + d * 0.06 + 1) % 1;
      let [x, y] = perim(L, it.p);
      let a = 1;
      const pt = { x: x - size, y: y - size, w: size * 2, h: size * 2 };
      if (L.keep.some((k) => overlaps(pt, k))) a = 0.12;
      const ar = eOut(it.arrive);
      if (ar < 1) {
        // flies out of the number to its place on the edge
        const fx0 = L.cx, fy0 = L.cy;
        for (let g = 3; g >= 1; g--) {
          const tg = eOut(Math.max(0, it.arrive - g * 0.05));
          c.globalAlpha = 0.18 * (1 - ar);
          G.sigil(c, it.u.seed, lerp(fx0, x, tg), lerp(fy0, y, tg), size * (1 + (1 - tg) * 1.6), KIND_COL[it.u.kind], it.u.kind);
        }
        x = lerp(fx0, x, ar); y = lerp(fy0, y, ar);
        a = Math.max(a, 1 - ar);
      }
      c.globalAlpha = a * (0.55 + 0.45 * (i / n));
      G.sigil(c, it.u.seed, x, y, size * (1 + (1 - ar) * 1.6), KIND_COL[it.u.kind], it.u.kind);
    }
    c.globalAlpha = 1;
  }

  function drawParticles(c, L) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const life = p.life / p.max;
      if (p.kind === 'spark') {
        c.globalAlpha = (1 - life) * 0.9;
        c.strokeStyle = p.col; c.lineWidth = p.w;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
      } else if (p.kind === 'glyph') {
        c.globalAlpha = (1 - life) * 0.9;
        G.money(c, p.idx, p.x, p.y, p.size, p.col);
      } else if (p.kind === 'in') {
        const e = sstep(life);
        const x = lerp(p.sx, L.cx, e * e), y = lerp(p.sy, L.cy, e * e);
        c.globalAlpha = Math.sin(life * Math.PI) * 0.5;
        G.money(c, p.idx, x, y, p.size * (1 - e * 0.6), p.col);
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  function drawNumberBlock(c, L, v, alpha) {
    const dr = evIs('drift') ? evEnv() : 0;
    const t = ev.cur ? ev.cur.t : 0;
    const cx = L.cx + Math.sin(t * 1.3) * L.W * 0.16 * dr, cy = L.cy + Math.cos(t * 0.9) * L.H * 0.1 * dr;
    const pop = 1 + numPop * 0.14;
    const maxW = L.W * 0.86;
    let size = fitFont(c, v.num, 900, FD, L.numSize * pop, maxW);
    c.font = font(900, size, FD);
    L.numW = c.measureText(v.num).width;
    if (LY) LY.numW = L.numW;
    const split = fx.glitch * 0.03 + (state === 'pending' ? 0.04 : 0);
    const real3d = useReal();
    // milestone: the giant word behind the number (the 3D version does the camera pull-back + star burst instead)
    if (bigWord && bigWord.text && !useReal()) {
      const e = bigWord.t / 1.8;
      const bs = fitFont(c, bigWord.text, 900, FD, L.numSize * 1.9, L.W * 0.98) * (0.85 + 0.35 * eOut(e));
      c.globalAlpha = (1 - e) * 0.32 * alpha;
      c.font = font(900, bs, FD); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = C.cyan; c.fillText(bigWord.text, cx - bs * 0.03, cy);
      c.fillStyle = C.magenta; c.fillText(bigWord.text, cx + bs * 0.03, cy);
      c.globalAlpha = 1;
    }
    if (real3d) {
      R.setNumber({ text: v.num, cx, cy, size, alpha, hot: numPop * 0.6 + fx.glitch * 0.2, mode: state === 'pending' || evIs('freeze') ? 'freeze' : 'live', wobble: state === 'pending' ? 1 : 0 });
      L.numW = Math.max(L.numW, R.numberWidth());
      if (LY) LY.numW = L.numW;
    } else chromeText(c, scr(v.num, state === 'pending' ? 0.18 : 0), cx, cy, size, alpha, split);
    // illion word
    const wy = cy + size * 0.68;
    let ws = 0;
    if (v.word) {
      ws = fitFont(c, v.word, 800, FD, L.numSize * 0.3, L.W * 0.86);
      c.globalAlpha = alpha;
      spacing(c, ws * 0.12);
      text(c, scr(v.word), cx, wy, font(800, ws, FD), C.ink, 'center', 'middle');
      spacing(c, 0);
    }
    // money line: icon + name + income
    const my2 = wy + (v.word ? ws * 0.95 : 0) + L.numSize * 0.16;
    const ms = Math.max(11, 15 * L.S);
    let name = v.money, idx = v.tier;
    let ga = 1;
    if (morph) {
      const e = morph.t / 1.2;
      if (e < 0.55) { name = scr(e < 0.27 ? morph.from : morph.to, 0.75 - e, Math.floor(sceneT * 30)); idx = e < 0.27 ? morph.fi : morph.ti; ga = Math.abs(e - 0.27) / 0.27; }
    }
    const line = name + '   +' + v.inc + ' /s';
    spacing(c, ms * 0.18);
    c.font = font(700, ms, FM);
    const lw = c.measureText(line).width;
    const gx = cx - lw / 2 - ms * 1.1;
    c.globalAlpha = alpha * clamp(ga, 0.2, 1);
    G.money(c, idx, gx, my2, ms * 0.62 * (morph ? 1 + (1 - clamp(ga, 0, 1)) * 0.6 : 1), C.cyan, sceneT);
    c.globalAlpha = alpha;
    text(c, scr(line), cx + ms * 0.2, my2, font(700, ms, FM), C.cyan, 'center', 'middle');
    spacing(c, 0);
    c.globalAlpha = 1;
  }

  function drawTopLeft(c, L, v) {
    const s = Math.max(13, 22 * L.S);
    const x = L.pad, y = L.pad + s * 0.85;
    c.font = font(900, s, FD); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const g = c.createLinearGradient(0, y - s, 0, y);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#8d8ab8'); g.addColorStop(0.62, '#f4f0ff'); g.addColorStop(1, '#9fe9ff');
    const tear = H.hash(Math.floor(sceneT * 9)) < 0.08 + fx.glitch * 0.3;
    if (tear) { c.globalAlpha = 0.8; c.fillStyle = C.magenta; c.fillText('HANDS OFF', x - s * 0.08, y); c.fillStyle = C.cyan; c.fillText('HANDS OFF', x + s * 0.06, y); c.globalAlpha = 1; }
    c.fillStyle = g; c.fillText('HANDS OFF', x, y);
    if (v) {
      const ws = Math.max(10, 12 * L.S);
      spacing(c, ws * 0.22);
      text(c, scr('WORLD ' + (v.w + 1) + ' · ' + H.worldName(v.w)), x, y + ws * 1.9, font(700, ws, FM), C.muted, 'left', 'alphabetic');
      spacing(c, 0);
    }
  }
  function drawTopRight(c, L, v) {
    const ws = Math.max(10, 12 * L.S);
    const right = coarse ? L.exitBtn.x - L.exitBtn.r - ws : L.W - L.pad;
    let y = L.pad + ws;
    spacing(c, ws * 0.2);
    if (coarse) {
      const b = L.exitBtn;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU);
      c.fillStyle = 'rgba(10,7,22,0.7)'; c.fill();
      c.lineWidth = Math.max(1, b.r * 0.1); c.strokeStyle = 'rgba(214,210,240,0.55)'; c.stroke();
      const q = b.r * 0.38;
      c.beginPath(); c.moveTo(b.x - q, b.y - q); c.lineTo(b.x + q, b.y + q); c.moveTo(b.x + q, b.y - q); c.lineTo(b.x - q, b.y + q); c.stroke();
      text(c, 'LEAVE', right, y + ws * 0.15, font(700, ws * 0.9, FM), C.dim, 'right', 'middle');
    } else {
      // keycap X + hint
      c.font = font(700, ws * 0.95, FM);
      const kx = right - c.measureText('LEAVE SAFELY').width - ws * 0.9, kh = ws * 1.7, kw = ws * 1.6;
      rrect(c, kx - kw, y - kh * 0.52, kw, kh, ws * 0.3);
      c.lineWidth = Math.max(1, ws * 0.1); c.strokeStyle = 'rgba(214,210,240,0.6)'; c.stroke();
      text(c, 'X', kx - kw / 2, y + ws * 0.08, font(800, ws, FM), C.ink, 'center', 'middle');
      text(c, 'LEAVE SAFELY', right, y + ws * 0.08, font(700, ws * 0.95, FM), C.muted, 'right', 'middle');
    }
    if (v) {
      y += ws * 2.3;
      if (coarse) y = Math.max(y, L.exitBtn.y + L.exitBtn.r + ws * 1.1);
      const best = save.rec.bestTime;
      const isBest = save.rec.runs > 1 && v.t >= best - 0.05 && v.t > 1;
      text(c, scr((isBest ? 'BEST  THIS RUN  ' : 'BEST  ') + H.fmtTime(best)), L.W - L.pad, y, font(700, ws, FM), isBest ? C.cyan : C.muted, 'right', 'middle');
    }
    spacing(c, 0);
  }
  function drawBottomBar(c, L, v, alpha) {
    const s = Math.max(10, 13 * L.S);
    const bw = Math.min(L.W * 0.62, 340 * L.S), bh = Math.max(3, 4 * L.S);
    const x0 = L.cx - bw / 2, y = L.barY;
    c.globalAlpha = alpha;
    text(c, scr('LV ' + v.level), x0 - s * 0.8, y + bh / 2, font(800, s * 1.25, FD), C.ink, 'right', 'middle');
    rrect(c, x0, y, bw, bh, bh / 2); c.fillStyle = 'rgba(214,210,240,0.16)'; c.fill();
    const g = c.createLinearGradient(x0, 0, x0 + bw, 0);
    g.addColorStop(0, C.cyan); g.addColorStop(1, C.magenta);
    rrect(c, x0, y, Math.max(bh, bw * v.lp), bh, bh / 2); c.fillStyle = g; c.fill();
    if (levelPing > 0.02) { c.globalAlpha = alpha * levelPing; c.fillStyle = '#ffffff'; rrect(c, x0, y - bh, bw, bh * 3, bh); c.fill(); c.globalAlpha = alpha; }
    const next = (1 - v.lp) * H.LEVEL_REQ(v.level) / v.speed;
    text(c, next < 10 ? next.toFixed(1) + 's' : Math.round(next) + 's', x0 + bw + s * 0.8, y + bh / 2, font(700, s, FM), C.dim, 'left', 'middle');
    spacing(c, s * 0.25);
    text(c, 'HANDS OFF  ', L.cx, y + s * 2.2, font(700, s, FM), C.muted, 'right', 'middle');
    text(c, scr(H.fmtTime(v.t)), L.cx, y + s * 2.2, font(800, s * 1.15, FM), C.ink, 'left', 'middle');
    spacing(c, 0);
    c.globalAlpha = 1;
  }
  function drawFeed(c, L) {
    const s = Math.max(10, 12 * L.S);
    const x = L.pad, lh = s * 2.6;
    let y = L.H - L.pad - s * 0.6;
    const maxW = Math.min(L.W * 0.42, 400 * L.S);
    for (let i = feed.length - 1; i >= 0; i--) {
      const f = feed[i];
      const a = Math.min(1, f.t / 0.2) * (f.t > 6.5 ? Math.max(0, 1 - (f.t - 6.5) / 1.5) : 1) * (0.55 + 0.45 * (i / Math.max(1, feed.length - 1)));
      if (a <= 0.01) { y -= lh; continue; }
      const slide = (1 - eOut(f.t / 0.3)) * -30 * L.S;
      c.globalAlpha = a;
      if (f.icon && f.icon.sigil) G.sigil(c, f.icon.sigil.seed, x + s * 0.7 + slide, y - s * 0.75, s * 0.6, f.col, f.icon.sigil.kind);
      else if (f.icon && f.icon.money !== undefined) G.money(c, f.icon.money, x + s * 0.7 + slide, y - s * 0.75, s * 0.62, f.col);
      else { c.fillStyle = f.col; c.fillRect(x + s * 0.45 + slide, y - s * 1.0, s * 0.5, s * 0.5); }
      spacing(c, s * 0.12);
      c.font = font(800, s, FM);
      let a1 = scr(f.a);
      text(c, a1, x + s * 1.8 + slide, y - s * 0.75 - (f.b ? s * 0.45 : 0), font(800, s, FM), f.col, 'left', 'middle');
      if (f.b) {
        let b1 = scr(f.b);
        c.font = font(400, s * 0.85, FM);
        while (b1.length > 4 && c.measureText(b1).width > maxW) b1 = b1.slice(0, -2);
        text(c, b1, x + s * 1.8 + slide, y - s * 0.75 + s * 0.65, font(400, s * 0.85, FM), C.muted, 'left', 'middle');
      }
      spacing(c, 0);
      y -= lh;
    }
    c.globalAlpha = 1;
  }

  function drawPush(c, L, r) {
    if (pushAlpha < 0.01) return;
    const p = L.push;
    const life = r ? clamp(r.t / 1800, 0, 1) : 0;
    const breathe = 0.5 + 0.5 * Math.sin(sceneT * (2.2 + life * 4));
    const near = tempt.cursor ? clamp(1 - Math.hypot(...fakeCursorPos(L).map((v, i) => v - (i ? p.y : p.x))) / (p.r * 3), 0, 1) : 0;
    const sc = (1 + 0.04 * breathe + near * 0.06) * (1 - pushPress * 0.12);
    const R0 = p.r * sc;
    c.save();
    c.globalAlpha = pushAlpha;
    // glow
    const gl = c.createRadialGradient(p.x, p.y, R0 * 0.6, p.x, p.y, R0 * (1.9 + life * 0.8));
    gl.addColorStop(0, 'rgba(255,40,90,' + (0.35 + 0.25 * breathe) + ')'); gl.addColorStop(1, 'rgba(255,40,90,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(p.x, p.y, R0 * (1.9 + life * 0.8), 0, TAU); c.fill();
    // body
    const g = c.createRadialGradient(p.x - R0 * 0.3, p.y - R0 * 0.35, R0 * 0.1, p.x, p.y, R0);
    g.addColorStop(0, '#ff8aa8'); g.addColorStop(0.45, '#ff2a5f'); g.addColorStop(1, '#5c0420');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y + pushPress * R0 * 0.06, R0, 0, TAU); c.fill();
    c.lineWidth = Math.max(1.5, R0 * 0.07); c.strokeStyle = 'rgba(255,220,230,0.85)'; c.stroke();
    c.beginPath(); c.arc(p.x, p.y, R0 * 1.18, 0, TAU); c.lineWidth = Math.max(1, R0 * 0.03); c.strokeStyle = 'rgba(255,120,160,' + (0.3 + 0.4 * breathe) + ')'; c.stroke();
    const label = H.hash(Math.floor(sceneT * 2.3) + 77) < 0.06 + life * 0.1 ? 'FREE' : 'PUSH';
    text(c, label, p.x, p.y + pushPress * R0 * 0.06, font(900, R0 * 0.42, FD), '#ffffff', 'center', 'middle');
    // voice
    if (voice.line && state === 'live') {
      const vt = voice.t, va = Math.min(1, vt / 0.25) * clamp((voice.dur - 0.5 - vt) / 0.4, 0, 1);
      if (va > 0) {
        const s = Math.max(11, 14 * L.S);
        const unh = voice.tier >= 3 ? 0.1 + 0.05 * (voice.tier - 3) : 0;
        const shown = scr(voice.line, unh, Math.floor(sceneT * 14));
        c.globalAlpha = pushAlpha * va;
        spacing(c, s * (voice.tier >= 3 ? 0.35 : 0.2));
        const jit = voice.tier >= 3 ? (H.hash(Math.floor(sceneT * 20)) - 0.5) * s * 0.3 : 0;
        const tx = Math.min(p.x + R0, L.W - L.pad), ty = p.y - R0 * 1.55;
        const fs = fitFont(c, shown, 800, FM, s, tx - L.pad - Math.abs(jit));
        shade(c, L, true);
        if (voice.tier >= 3) { c.globalAlpha = pushAlpha * va * 0.6; text(c, shown, tx + jit + fs * 0.1, ty, font(800, fs, FM), C.cyan, 'right', 'middle'); c.globalAlpha = pushAlpha * va; }
        text(c, shown, tx + jit, ty, font(800, fs, FM), voice.tier >= 2 ? C.red : '#ffb3c8', 'right', 'middle');
        shade(c, L, false);
        spacing(c, 0);
      }
    }
    c.restore();
  }
  function fakeCursorPos(L) {
    const cu = tempt.cursor;
    if (!cu) return [0, 0];
    const p = L.push;
    const e = sstep(cu.t / 4.1);
    const sx = cu.sx * L.W, sy = cu.sy * L.H;
    const tx = p.x + p.r * 0.1, ty = p.y + p.r * 0.05;
    // curves a little, hesitates near the end
    const bend = Math.sin(e * Math.PI) * L.H * 0.08;
    return [lerp(sx, tx, e) + bend * 0.5, lerp(sy, ty, e) - bend];
  }
  function drawFakeCursor(c, L) {
    const cu = tempt.cursor;
    if (!cu) return;
    const [x, y] = fakeCursorPos(L);
    const a = Math.min(1, cu.t / 0.4) * clamp((cu.dur - cu.t) / 0.8, 0, 1);
    c.globalAlpha = a;
    const sz = Math.max(16, 22 * L.S) * (cu.clicked && cu.t < 4.5 ? 0.9 : 1);
    G.cursor(c, x, y, sz, '#ffffff', '#000000');
    if (cu.clicked && cu.t < 5) { c.globalAlpha = a * (1 - (cu.t - 4.3) / 0.7); c.beginPath(); c.arc(x, y, sz * (0.5 + (cu.t - 4.3) * 3), 0, TAU); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke(); }
    c.globalAlpha = 1;
  }
  function drawTempt(c, L) {
    for (const it of tempt.items) {
      const b = temptRect(it);
      const a = Math.min(1, it.t / 0.3) * clamp((it.dur - it.t) / 0.4, 0, 1);
      if (a <= 0) continue;
      const slide = (1 - eOut(it.t / 0.35)) * (it.fx < 0.5 ? -1 : 1) * 60 * L.S;
      const wob = Math.sin(it.t * 7 + it.seed) * 0.012 * it.wob;
      c.save();
      c.globalAlpha = a;
      c.translate(b.x + b.w / 2 + slide, b.y + b.h / 2);
      c.rotate(wob);
      const x = -b.w / 2, y = -b.h / 2, s = b.h / 82;
      if (it.kind === 'bait') {
        rrect(c, x, y, b.w, b.h, 12 * s);
        c.fillStyle = 'rgba(10,7,24,0.86)'; c.fill();
        const g = c.createLinearGradient(x, y, x + b.w, y + b.h);
        const ph = (sceneT * 0.7 + it.seed) % 1;
        g.addColorStop(0, C.cyan); g.addColorStop(clamp(ph, 0.05, 0.95), C.magenta); g.addColorStop(1, C.orange);
        c.lineWidth = Math.max(1.5, 2 * s); c.strokeStyle = g; c.stroke();
        G.money(c, save.run ? save.run.maxTier : 0, x + 34 * s, 0, 15 * s, C.cyan, sceneT * 3);
        spacing(c, 1.5 * s);
        const ts = fitFont(c, it.a, 800, FD, 17 * s, b.w - 80 * s);
        text(c, scr(it.a), x + 62 * s, -9 * s, font(800, ts, FD), C.ink, 'left', 'middle');
        text(c, scr(it.b), x + 62 * s, 14 * s, font(700, 11 * s, FM), C.cyan, 'left', 'middle');
        spacing(c, 0);
        const left = 1 - it.t / it.dur;
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x + 62 * s, 28 * s, b.w - 80 * s, 3 * s);
        c.fillStyle = C.magenta; c.fillRect(x + 62 * s, 28 * s, (b.w - 80 * s) * left, 3 * s);
      } else {
        rrect(c, x, y, b.w, b.h, 4 * s);
        c.fillStyle = 'rgba(14,6,12,0.9)'; c.fill();
        c.lineWidth = Math.max(1, 1.5 * s); c.strokeStyle = 'rgba(255,59,92,0.8)'; c.stroke();
        c.fillStyle = 'rgba(255,59,92,0.85)'; c.fillRect(x, y, b.w, 18 * s);
        text(c, 'HANDS_OFF.EXE', x + 8 * s, y + 9.5 * s, font(700, 10 * s, FM), '#140408', 'left', 'middle');
        c.strokeStyle = '#140408'; c.lineWidth = 1.5 * s;
        c.beginPath(); c.moveTo(x + b.w - 14 * s, y + 5 * s); c.lineTo(x + b.w - 6 * s, y + 13 * s); c.moveTo(x + b.w - 6 * s, y + 5 * s); c.lineTo(x + b.w - 14 * s, y + 13 * s); c.stroke();
        // warning triangle
        c.beginPath(); c.moveTo(x + 22 * s, y + 30 * s); c.lineTo(x + 36 * s, y + 56 * s); c.lineTo(x + 8 * s, y + 56 * s); c.closePath();
        c.strokeStyle = C.red; c.lineWidth = 2 * s; c.stroke();
        text(c, '!', x + 22 * s, y + 47 * s, font(900, 13 * s, FD), C.red, 'center', 'middle');
        const ts = fitFont(c, it.a, 800, FM, 13 * s, b.w - 120 * s);
        text(c, scr(it.a, 0.04, Math.floor(sceneT * 8)), x + 48 * s, y + 36 * s, font(800, ts, FM), '#ffd0da', 'left', 'middle');
        const bs = fitFont(c, it.b, 400, FM, 10.5 * s, b.w - 120 * s);
        text(c, scr(it.b), x + 48 * s, y + 54 * s, font(400, bs, FM), C.muted, 'left', 'middle');
        const bw = 64 * s, bx = x + b.w - bw - 10 * s, by = y + b.h - 30 * s;
        rrect(c, bx, by, bw, 22 * s, 3 * s); c.strokeStyle = '#ffd0da'; c.lineWidth = 1.5 * s; c.stroke();
        text(c, it.btn, bx + bw / 2, by + 11 * s, font(800, 10 * s, FM), '#ffd0da', 'center', 'middle');
        if (H.hash(Math.floor(sceneT * 12) + it.seed) < 0.15) { c.globalAlpha = a * 0.5; c.fillStyle = C.cyan; c.fillRect(x, y + H.hash(Math.floor(sceneT * 30)) * b.h, b.w, 2 * s); }
      }
      c.restore();
    }
    c.globalAlpha = 1;
  }

  function drawToast(c, L) {
    const tc = toast.cur;
    if (!tc) return;
    const t = H.TRO[tc.id];
    const e = Math.min(eOut(tc.t / 0.35), clamp((3.8 - tc.t) / 0.4, 0, 1));
    const s = Math.max(10, 12 * L.S);
    const w = Math.min(L.W * 0.86, 420 * L.S), h = s * 4.4;
    const x = L.cx - w / 2, y = L.pad * 0.6 + (e - 1) * h * 1.6 + (L.narrow ? 60 * L.S : 0);
    c.globalAlpha = e;
    rrect(c, x, y, w, h, h * 0.25); c.fillStyle = 'rgba(10,7,22,0.85)'; c.fill();
    c.lineWidth = Math.max(1, 1.5 * L.S); c.strokeStyle = t.group === 'roast' ? C.magenta : C.cyan; c.stroke();
    G.trophy(c, t.group, t.id, x + h * 0.55, y + h / 2, h * 0.28, t.group === 'roast' ? C.magenta : C.cyan);
    spacing(c, s * 0.25);
    text(c, t.group === 'roast' ? 'ROAST TROPHY' : 'TROPHY', x + h * 1.1, y + h * 0.33, font(700, s * 0.85, FM), C.muted, 'left', 'middle');
    spacing(c, 0);
    const ns = fitFont(c, t.name, 800, FD, s * 1.3, w - h * 1.4);
    text(c, t.name, x + h * 1.1, y + h * 0.66, font(800, ns, FD), C.ink, 'left', 'middle');
    c.globalAlpha = 1;
  }
  function drawWelcome(c, L, alpha) {
    if (!welcome || !welcome.rep) return;
    const rep = welcome.rep;
    const s = Math.max(10, 12 * L.S);
    const a = alpha * Math.min(1, welcome.t / 0.4) * (state === 'live' ? clamp((6 - welcome.t) / 0.8, 0, 1) : 1);
    if (a <= 0) return;
    const l1 = 'YOU WERE GONE ' + H.fmtTime(rep.gone);
    const l2 = '+' + H.short(rep.earned) + ' ' + (save.run ? H.moneyName(save.run.maxTier) : '') + '  ·  +' + rep.levels + (rep.levels === 1 ? ' LEVEL' : ' LEVELS') + (rep.trophies > 0 ? '  ·  +' + rep.trophies + (rep.trophies === 1 ? ' TROPHY' : ' TROPHIES') : '');
    const y = L.narrow ? L.H * 0.17 : L.H * 0.15;
    c.globalAlpha = a;
    spacing(c, s * 0.25);
    text(c, l1, L.cx, y, font(800, s * 1.2, FM), C.ink, 'center', 'middle');
    const s2 = fitFont(c, l2, 700, FM, s, L.W * 0.9);
    text(c, l2, L.cx, y + s * 1.9, font(700, s2, FM), C.cyan, 'center', 'middle');
    spacing(c, 0);
    c.globalAlpha = 1;
  }
  function drawWorldSweep(c, L) {
    const ws = worldSweep;
    if (!ws) return;
    const e = ws.t / 2.4;
    const a = Math.sin(Math.PI * clamp(e, 0, 1));
    // the big title sweeps through BEHIND the number, see-through, so nothing gets covered
    // (in 3D the dive is the show, so only the name label stays)
    const title = 'WORLD ' + (ws.w + 1);
    if (!useReal()) {
      const s = fitFont(c, title, 900, FD, L.numSize * 1.6, L.W * 0.95);
      const x = lerp(L.W * 1.25, -L.W * 0.25, e * 0.35 + sstep(e) * 0.65);
      for (let i = 4; i >= 0; i--) {
        c.globalAlpha = a * (i ? 0.06 : 0.3);
        text(c, title, x + i * s * 0.3, L.cy, font(900, s, FD), i ? C.magenta : '#ffffff', 'center', 'middle');
      }
    }
    // its name gets a clean spot above the number
    const ns = Math.max(12, 18 * L.S);
    c.globalAlpha = a;
    spacing(c, ns * 0.5);
    text(c, scr(ws.name, Math.max(0, 0.6 - e * 2), Math.floor(sceneT * 20)), L.cx, L.cy - L.numSize * 0.92, font(800, ns, FM), C.cyan, 'center', 'middle');
    spacing(c, 0);
    c.globalAlpha = 1;
  }

  function drawBands(c, L) {
    const top = c.createLinearGradient(0, 0, 0, 130 * L.S + L.pad);
    top.addColorStop(0, 'rgba(3,1,10,0.62)'); top.addColorStop(1, 'rgba(3,1,10,0)');
    c.fillStyle = top; c.fillRect(0, 0, L.W, 130 * L.S + L.pad);
    const bh = 190 * L.S + L.pad;
    const bot = c.createLinearGradient(0, L.H - bh, 0, L.H);
    bot.addColorStop(0, 'rgba(3,1,10,0)'); bot.addColorStop(1, 'rgba(3,1,10,0.62)');
    c.fillStyle = bot; c.fillRect(0, L.H - bh, L.W, bh);
  }
  function shade(c, L, on) {
    c.shadowColor = on ? 'rgba(0,0,0,0.9)' : 'transparent';
    c.shadowBlur = on ? Math.max(3, 6 * L.S) : 0;
  }
  function drawLiveHud(c, L, alpha) {
    const r = save.run;
    let v = state === 'pending' && pend ? pend.frozen : liveVals();
    if (evIs('freeze') && frozenVals) v = frozenVals; else if (!evIs('freeze')) frozenVals = v;
    if (!v) return;
    drawBands(c, L);
    drawRing(c, L);
    if (!useReal()) drawScrim(c, L, alpha);
    drawWorldSweep(c, L);
    drawParticles(c, L);
    drawNumberBlock(c, L, v, alpha);
    shade(c, L, true);
    drawTopLeft(c, L, v);
    drawTopRight(c, L, v);
    drawBottomBar(c, L, v, alpha);
    drawFeed(c, L);
    shade(c, L, false);
    drawTempt(c, L);
    drawPush(c, L, r);
    drawFakeCursor(c, L);
    drawWelcome(c, L, 1);
    drawToast(c, L);
    if (liveT < 7 && save.rec.runs <= 2 && state === 'live') {
      const s = Math.max(10, 12 * L.S);
      c.globalAlpha = Math.sin(Math.PI * clamp(liveT / 7, 0, 1));
      spacing(c, s * 0.4);
      text(c, 'DO NOTHING.', L.cx, L.H * 0.2, font(800, s * 1.3, FM), C.ink, 'center', 'middle');
      spacing(c, 0);
      c.globalAlpha = 1;
    }
  }
  let frozenVals = null;

  function drawArming(c, L) {
    const r = save.run;
    const v = liveVals();
    drawBands(c, L);
    shade(c, L, true);
    drawTopLeft(c, L, v);
    drawTopRight(c, L, v);
    shade(c, L, false);
    const left = Math.max(0, arm.left);
    const p = 1 - left / ARM;
    const sh = arm.shake * 14 * L.S;
    const cx = L.cx + (Math.random() - 0.5) * sh, cy = L.cy + (Math.random() - 0.5) * sh;
    const rad = Math.min(L.W, L.H) * (L.narrow ? 0.2 : 0.15);
    c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, rad, 0, TAU); c.lineWidth = Math.max(2, 4 * L.S); c.strokeStyle = 'rgba(214,210,240,0.15)'; c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + i / 60 * TAU, on = i / 60 < p;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * rad * 1.08, cy + Math.sin(a) * rad * 1.08); c.lineTo(cx + Math.cos(a) * rad * (i % 5 ? 1.13 : 1.18), cy + Math.sin(a) * rad * (i % 5 ? 1.13 : 1.18));
      c.lineWidth = Math.max(1, 1.5 * L.S); c.strokeStyle = on ? C.cyan : 'rgba(214,210,240,0.2)'; c.stroke();
    }
    const g = c.createLinearGradient(cx - rad, cy, cx + rad, cy);
    g.addColorStop(0, C.cyan); g.addColorStop(1, C.magenta);
    c.beginPath(); c.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + p * TAU); c.lineWidth = Math.max(3, 6 * L.S); c.strokeStyle = g; c.stroke();
    c.lineCap = 'butt';
    const digit = String(Math.max(1, Math.ceil(left)));
    const frac = left - Math.floor(left);
    chromeText(c, digit, cx, cy, rad * (0.95 + 0.12 * (frac > 0.8 ? (frac - 0.8) * 5 : 0)), 1, arm.shake * 0.05);
    const s = Math.max(11, 14 * L.S);
    spacing(c, s * 0.4);
    const touching = arm.shake > 0.15;
    text(c, touching ? 'STILL TOUCHING' : arm.again ? 'AGAIN. LET GO.' : 'LET GO.', cx, cy - rad * 1.45, font(800, s * 1.2, FM), touching ? C.red : C.ink, 'center', 'middle');
    text(c, 'IT STARTS WHEN YOU STOP', cx, cy + rad * 1.42, font(700, s * 0.85, FM), C.muted, 'center', 'middle');
    if (r) {
      const line = 'YOUR RUN  ' + H.fmtTime(r.t) + '  ·  ' + H.short(r.logC) + ' ' + H.moneyName(r.maxTier);
      const ls = fitFont(c, line, 700, FM, s * 0.95, L.W * 0.9);
      text(c, line, cx, cy + rad * 1.42 + s * 2.2, font(700, ls, FM), C.cyan, 'center', 'middle');
    }
    if (save.rec.runs === 0) {
      text(c, 'DON\'T TOUCH ANYTHING.', cx, L.H * (L.narrow ? 0.8 : 0.84), font(800, s, FM), C.ink, 'center', 'middle');
      text(c, coarse ? 'THE TINY X LEAVES SAFELY.' : 'PRESS X TO LEAVE SAFELY.', cx, L.H * (L.narrow ? 0.8 : 0.84) + s * 2, font(700, s * 0.9, FM), C.muted, 'center', 'middle');
    }
    spacing(c, 0);
    drawWelcome(c, L, 1);
    drawToast(c, L);
  }

  function wrapFit(c, s, weight, fam, maxSize, maxW) {
    let size = fitFont(c, s, weight, fam, maxSize, maxW);
    if (size >= maxSize * 0.6 || s.indexOf(' ') < 0) return { lines: [s], size };
    const words = s.split(' ');
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      c.font = font(weight, maxSize, fam);
      const w = Math.max(c.measureText(a).width, c.measureText(b).width);
      if (!best || w < best.w) best = { a, b, w };
    }
    size = Math.min(maxSize, maxSize * maxW / best.w);
    return { lines: [best.a, best.b], size };
  }
  function drawReset(c, L) {
    const t = rs.t, lost = rs.lost;
    drawBands(c, L);
    drawTopLeft(c, L, null);
    drawTopRight(c, L, null);
    const s = Math.max(11, 14 * L.S);
    if (rs.real && !rs.slammed && t < rs.rewAt) return;   // the glass is in pieces: nothing on it
    if (!rs.quick && !rs.slammed) {
      // rewind: everything rolls back to zero
      const e = rs.real ? sstep((t - rs.rewAt) / (rs.slamAt - rs.rewAt - 0.05)) : sstep(t / 1.6);
      const dl = lost.log === H.ZERO || e > 0.97 ? H.ZERO : lost.log * (1 - e);
      const p = H.parts(dl);
      const num = p.word.length > 26 ? H.short(dl) : p.num;
      const size = fitFont(c, num, 900, FD, L.numSize, L.W * 0.86);
      if (useReal()) R.setNumber({ text: num, cx: L.cx, cy: L.cy, size, alpha: 1, mode: 'rewind' });
      else chromeText(c, num, L.cx, L.cy, size, 1, 0.03 + 0.03 * Math.sin(t * 40));
      if (p.word && p.word.length <= 26) text(c, p.word.toUpperCase(), L.cx, L.cy + size * 0.68, font(800, L.numSize * 0.26, FD), C.ink, 'center', 'middle');
      const blink = Math.floor(t * 4) % 2 === 0;
      if (blink) {
        const x = L.cx - s * 4.2, y = L.cy - size * 0.95;
        c.fillStyle = C.ink;
        for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(x + k * s * 0.9, y); c.lineTo(x + k * s * 0.9 + s * 0.9, y - s * 0.55); c.lineTo(x + k * s * 0.9 + s * 0.9, y + s * 0.55); c.closePath(); c.fill(); }
        spacing(c, s * 0.3);
        text(c, 'REWIND', x + s * 2.3, y, font(800, s, FM), C.ink, 'left', 'middle');
        spacing(c, 0);
      }
      spacing(c, s * 0.2);
      text(c, 'LV ' + Math.round(lost.level * (1 - e)) + '   ' + H.fmtTime(lost.t * (1 - e)), L.cx, L.barY, font(800, s * 1.2, FM), C.muted, 'center', 'middle');
      spacing(c, 0);
      return;
    }
    // the roast
    const st = rs.slamT || 0;
    const slam = 1 + Math.max(0, 1 - st / 0.18) * 0.7;
    const maxSize = (rs.quick ? 70 : 96) * L.S;
    const wf = wrapFit(c, rs.title, 900, FD, maxSize, L.W * 0.9);
    const size = wf.size * slam;
    const ty = L.H * (rs.quick ? 0.4 : 0.32);
    wf.lines.forEach((ln, i) => {
      const y = ty + (i - (wf.lines.length - 1) / 2) * size * 1.08;
      const jit = (Math.random() - 0.5) * size * 0.06 * Math.max(0, 1 - st / 0.6);
      c.globalAlpha = clamp(st / 0.08, 0, 1);
      c.font = font(900, size, FD); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = C.cyan; c.fillText(ln, L.cx - size * 0.025 + jit, y);
      c.fillStyle = C.magenta; c.fillText(ln, L.cx + size * 0.025 - jit, y);
      c.lineWidth = Math.max(2, size * 0.05); c.strokeStyle = 'rgba(5,3,11,0.7)'; c.strokeText(ln, L.cx, y);
      c.fillStyle = '#ffffff'; c.fillText(ln, L.cx, y);
    });
    c.globalAlpha = 1;
    // why
    const ly = ty + (wf.lines.length / 2) * size * 1.08 + s * 1.8;
    const shown = rs.line.slice(0, Math.floor(clamp((st - 0.25) / 0.6, 0, 1) * rs.line.length));
    spacing(c, s * 0.25);
    const lsz = fitFont(c, rs.line, 800, FM, s * 1.25, L.W * 0.9);
    text(c, shown, L.cx, ly, font(800, lsz, FM), C.red, 'center', 'middle');
    spacing(c, 0);
    // what you lost
    const ca = clamp((st - 0.55) / 0.35, 0, 1);
    if (ca > 0) {
      c.globalAlpha = ca;
      const w = Math.min(L.W * 0.9, 560 * L.S), h = s * 8.4;
      const x = L.cx - w / 2, y = ly + s * 2.2 + (1 - eOut(ca)) * 20 * L.S;
      rrect(c, x, y, w, h, s * 1.2); c.fillStyle = 'rgba(10,7,22,0.78)'; c.fill();
      c.lineWidth = Math.max(1, 1.5 * L.S); c.strokeStyle = 'rgba(255,63,180,0.5)'; c.stroke();
      spacing(c, s * 0.3);
      text(c, 'YOU LOST', L.cx, y + s * 1.5, font(700, s * 0.85, FM), C.muted, 'center', 'middle');
      spacing(c, 0);
      if (lost.t < 2) {
        const msg = 'ALL ' + lost.t.toFixed(1) + ' SECONDS OF IT';
        text(c, msg, L.cx, y + s * 4, font(800, fitFont(c, msg, 800, FD, s * 1.9, w * 0.9), FD), C.ink, 'center', 'middle');
      } else {
        const amount = (lost.log === H.ZERO ? '0' : H.short(lost.log)) + ' ' + lost.money;
        text(c, amount, L.cx, y + s * 4, font(800, fitFont(c, amount, 800, FD, s * 2.1, w * 0.9), FD), C.ink, 'center', 'middle');
      }
      spacing(c, s * 0.2);
      const stats = 'LV ' + lost.level + '  ·  WORLD ' + (lost.world + 1) + '  ·  ' + H.fmtTime(lost.t) + ' HANDS OFF  ·  ' + lost.ups + ' UPGRADES';
      const fs = fitFont(c, stats, 700, FM, s * 0.9, w * 0.92);
      if (fs >= s * 0.72) text(c, stats, L.cx, y + s * 6.5, font(700, fs, FM), C.cyan, 'center', 'middle');
      else {
        const a1 = 'LV ' + lost.level + '  ·  WORLD ' + (lost.world + 1), a2 = H.fmtTime(lost.t) + ' HANDS OFF  ·  ' + lost.ups + ' UPGRADES';
        const f2 = Math.min(fitFont(c, a1, 700, FM, s * 0.9, w * 0.92), fitFont(c, a2, 700, FM, s * 0.9, w * 0.92));
        text(c, a1, L.cx, y + s * 6.0, font(700, f2, FM), C.cyan, 'center', 'middle');
        text(c, a2, L.cx, y + s * 7.3, font(700, f2, FM), C.cyan, 'center', 'middle');
      }
      spacing(c, 0);
      c.globalAlpha = 1;
    }
    if (t > rs.endAt - 0.9) {
      c.globalAlpha = clamp((t - (rs.endAt - 0.9)) / 0.3, 0, 1);
      spacing(c, s * 0.4);
      text(c, 'STRAIGHT BACK IN', L.cx, L.H * 0.88, font(800, s, FM), C.ink, 'center', 'middle');
      spacing(c, 0);
      c.globalAlpha = 1;
    }
  }

  function drawHud(c, L) {
    if (R.real) R.setNumber(null);
    scrAmt = evIs('scramble') ? 0.45 * evEnv() : 0;
    scrSeed = Math.floor(sceneT * 12);
    if (state === 'live' || state === 'pending') drawLiveHud(c, L, 1);
    else if (state === 'arming') drawArming(c, L);
    else if (state === 'reset' && rs) drawReset(c, L);
    if (evIs('double') && state === 'live') {
      c.globalAlpha = 0.35 * evEnv();
      c.drawImage(hud, 14 * L.S, -8 * L.S);
      c.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- the glass: cracks + shatter (separate canvas on top)
  const sh = { c: el.shatter.getContext('2d'), w: 0, h: 0, dpr: 1, snap: null, shards: [], bits: [], dirty: false, t: 0 };
  function shatterDpr() { return Math.min(window.devicePixelRatio || 1, 1.5); }
  function sizeShatter() {
    const dpr = shatterDpr();
    const w = Math.max(2, Math.round(window.innerWidth * dpr)), h = Math.max(2, Math.round(window.innerHeight * dpr));
    if (el.shatter.width !== w || el.shatter.height !== h) { el.shatter.width = w; el.shatter.height = h; }
    sh.w = w; sh.h = h; sh.dpr = dpr;
  }
  function clearShatter() {
    sh.shards.length = 0; sh.bits.length = 0;
    if (sh.dirty) { sh.c.setTransform(1, 0, 0, 1, 0, 0); sh.c.clearRect(0, 0, el.shatter.width, el.shatter.height); sh.dirty = false; }
  }
  function crackLine(x, y, a, len, depth, dpr) {
    const pts = [[x, y, 0]], branches = [];
    let d = 0, px = x, py = y, ang = a;
    while (d < len) {
      const s = rnd(10, 26) * dpr;
      ang += rnd(-0.3, 0.3);
      px += Math.cos(ang) * s; py += Math.sin(ang) * s; d += s;
      pts.push([px, py, d]);
      if (depth > 0 && Math.random() < 0.09) { const b = crackLine(px, py, ang + rnd(-0.9, 0.9), (len - d) * rnd(0.3, 0.6), depth - 1, dpr); b.at = d; branches.push(b); }
    }
    return { pts, len, branches, at: 0 };
  }
  function makeCracks(ix, iy) {
    sizeShatter();
    const dpr = sh.dpr, diag = Math.hypot(sh.w, sh.h);
    const n = 10 + Math.floor(Math.random() * 5), a0 = Math.random() * TAU;
    const lines = [], angles = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + rnd(-0.2, 0.2);
      angles.push(a);
      lines.push(crackLine(ix, iy, a, diag * rnd(0.12, 0.34), 1, dpr));
    }
    const rings = [rnd(18, 28) * dpr, rnd(46, 70) * dpr].map((rr) => {
      const pts = [];
      for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU; const q = rr * rnd(0.85, 1.15); pts.push([ix + Math.cos(a) * q, iy + Math.sin(a) * q]); }
      return pts;
    });
    return { lines, rings, angles, x: ix, y: iy };
  }
  function strokeCrack(c, ln, prog) {
    const upto = prog * ln.len;
    if (upto <= 0) return;
    c.beginPath();
    c.moveTo(ln.pts[0][0], ln.pts[0][1]);
    for (let i = 1; i < ln.pts.length; i++) {
      const p = ln.pts[i], q = ln.pts[i - 1];
      if (p[2] <= upto) c.lineTo(p[0], p[1]);
      else { const f = (upto - q[2]) / (p[2] - q[2]); c.lineTo(lerp(q[0], p[0], f), lerp(q[1], p[1], f)); break; }
    }
    c.stroke();
    for (const b of ln.branches) strokeCrack(c, b, clamp((upto - b.at) / b.len, 0, 1));
  }
  function drawCracks(c, cr, prog, dpr) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const pass of [0, 1]) {
      c.lineWidth = (pass ? 1.3 : 3.2) * dpr;
      c.strokeStyle = pass ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)';
      for (const ln of cr.lines) strokeCrack(c, ln, prog);
      if (prog > 0.25) {
        c.globalAlpha = clamp((prog - 0.25) / 0.4, 0, 1);
        for (const rg of cr.rings) { c.beginPath(); rg.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
        c.globalAlpha = 1;
      }
    }
    // light splitting inside the break: a faint rainbow fringe either side of each crack
    c.lineWidth = 1 * dpr;
    for (const [dx, col] of [[1.4, 'rgba(120,220,255,0.35)'], [-1.4, 'rgba(255,150,210,0.3)']]) {
      c.save(); c.translate(dx * dpr, dx * 0.5 * dpr); c.strokeStyle = col;
      for (const ln of cr.lines) strokeCrack(c, ln, prog);
      c.restore();
    }
    // white dust at the hit point
    const g = c.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, 26 * dpr);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.55 * prog) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cr.x, cr.y, 26 * dpr, 0, TAU); c.fill();
  }
  function cursorSize() { return 22 * sh.dpr; }
  function makeSnap() {
    sizeShatter();
    if (!sh.snap) sh.snap = document.createElement('canvas');
    const s = sh.snap;
    if (s.width !== sh.w || s.height !== sh.h) { s.width = sh.w; s.height = sh.h; }
    const c = s.getContext('2d');
    c.fillStyle = C.void; c.fillRect(0, 0, s.width, s.height);
    try { c.drawImage(use2d ? hud : el.gl, 0, 0, s.width, s.height); } catch (e) { /* tainted or lost: plain glass */ }
    if (pend) {
      for (const o of pend.old) drawCracks(c, o, 1, sh.dpr);
      drawCracks(c, pend.cracks, 1, sh.dpr);
      if (pend.cursor) G.cursor(c, pend.ix, pend.iy, cursorSize(), '#ffffff', '#000000');
    }
  }
  function buildShards(p) {
    const ix = p.ix, iy = p.iy;
    const diag = Math.hypot(sh.w, sh.h), dpr = sh.dpr;
    const angs = p.cracks.angles.slice().sort((a, b) => a - b);
    const radii = [0, 0.05, 0.12, 0.22, 0.38, 0.62, 1.6];
    const pts = angs.map((a) => radii.map((r, j) => { const q = r * diag * (j ? rnd(0.86, 1.14) : 0); return [ix + Math.cos(a) * q, iy + Math.sin(a) * q]; }));
    sh.shards.length = 0;
    for (let i = 0; i < angs.length; i++) {
      const A = pts[i], B = pts[(i + 1) % angs.length];
      for (let j = 0; j < radii.length - 1; j++) {
        const poly = j === 0 ? [A[0], B[1], A[1]] : [A[j], B[j], B[j + 1], A[j + 1]];
        let cx = 0, cy = 0; for (const q of poly) { cx += q[0]; cy += q[1]; } cx /= poly.length; cy /= poly.length;
        const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
        const bx = Math.max(0, Math.floor(Math.min(...xs))), by = Math.max(0, Math.floor(Math.min(...ys)));
        const bx2 = Math.min(sh.w, Math.ceil(Math.max(...xs))), by2 = Math.min(sh.h, Math.ceil(Math.max(...ys)));
        if (bx2 - bx < 2 || by2 - by < 2) continue;
        const dx = cx - ix, dy = cy - iy, dist = Math.hypot(dx, dy) || 1;
        const sp = (1300 / (1 + dist / (0.18 * diag)) + rnd(80, 300)) * dpr;
        sh.shards.push({ poly, cx, cy, bx, by, bw: bx2 - bx, bh: by2 - by, ox: 0, oy: 0, rot: 0,
          vx: dx / dist * sp + rnd(-60, 60) * dpr, vy: dy / dist * sp * 0.8 - rnd(150, 520) * dpr, vr: rnd(-5, 5) * (1 + 1 / (1 + j)), delay: (dist / diag) * 0.22 });
      }
    }
    sh.bits.length = 0;
    if (p.cursor) for (const side of [0, 1]) sh.bits.push({ side, x: ix, y: iy, vx: (side ? 260 : -220) * dpr, vy: -rnd(300, 500) * dpr, rot: 0, vr: side ? 5 : -4 });
    sh.t = 0;
  }
  function drawShatter(dt) {
    const c = sh.c;
    if (state === 'pending' && pend) {
      sizeShatter();
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sh.w, sh.h);
      const prog = eOut((pend.t - pend.crackT) / 0.32);
      for (const o of pend.old) drawCracks(c, o, 1, sh.dpr);
      drawCracks(c, pend.cracks, Math.min(1, prog + pend.more * 0.2), sh.dpr);
      if (pend.cursor) {
        const j = (Math.random() - 0.5) * 3 * sh.dpr;
        G.cursor(c, pend.ix + j, pend.iy, cursorSize(), '#ffffff', '#000000');
        c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.2 * sh.dpr;
        c.beginPath(); c.moveTo(pend.ix + 2 * sh.dpr, pend.iy + cursorSize() * 0.15); c.lineTo(pend.ix + cursorSize() * 0.32, pend.iy + cursorSize() * 0.55); c.lineTo(pend.ix + cursorSize() * 0.22, pend.iy + cursorSize() * 0.95); c.stroke();
      }
      sh.dirty = true;
      return;
    }
    if (state === 'reset' && rs && !rs.quick && sh.shards.length && sh.snap) {
      sh.t += dt;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sh.w, sh.h);
      const g = 2600 * sh.dpr;
      let alive = 0;
      const fade = clamp(1 - (sh.t - 0.9) / 0.6, 0, 1);
      for (const s of sh.shards) {
        const tt = Math.max(0, sh.t - s.delay);
        s.ox = s.vx * tt; s.oy = s.vy * tt + 0.5 * g * tt * tt; s.rot = s.vr * tt;
        if (s.cy + s.oy - s.bh > sh.h + 50) continue;
        alive++;
        c.save();
        c.globalAlpha = fade;
        c.translate(s.cx + s.ox, s.cy + s.oy); c.rotate(s.rot); c.translate(-s.cx, -s.cy);
        c.beginPath(); s.poly.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
        c.save(); c.clip();
        c.drawImage(sh.snap, s.bx, s.by, s.bw, s.bh, s.bx, s.by, s.bw, s.bh);
        c.fillStyle = 'rgba(255,255,255,' + (0.05 + 0.08 * Math.abs(Math.sin(s.rot))) + ')'; c.fill();
        c.restore();
        c.lineWidth = 1.2 * sh.dpr; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke();
        c.restore();
      }
      for (const b of sh.bits) {
        const tt = sh.t;
        const x = b.x + b.vx * tt, y = b.y + b.vy * tt + 0.5 * g * tt * tt;
        c.save();
        c.globalAlpha = fade;
        c.translate(x, y); c.rotate(b.vr * tt); c.translate(-b.x, -b.y);
        c.beginPath();
        const z = cursorSize();
        if (b.side) { c.moveTo(b.x - z, b.y - z); c.lineTo(b.x + z * 2, b.y - z); c.lineTo(b.x + z * 2, b.y + z * 2); c.lineTo(b.x + z * 0.3, b.y + z * 0.5); c.closePath(); }
        else { c.moveTo(b.x - z, b.y - z); c.lineTo(b.x + z * 0.3, b.y + z * 0.5); c.lineTo(b.x + z * 2, b.y + z * 2); c.lineTo(b.x - z, b.y + z * 2); c.closePath(); }
        c.clip();
        G.cursor(c, b.x, b.y, z, '#ffffff', '#000000');
        c.restore();
      }
      sh.dirty = true;
      if (!alive && sh.t > 0.5) { sh.shards.length = 0; clearShatter(); }
      return;
    }
    if (sh.dirty) clearShatter();
  }

  // ---------------------------------------------------------------- render
  let lastRender = 0;
  const perf = { hud: 0, gl: 0, n: 0 };
  function uniforms() {
    const en = evEnv();
    const inv = evIs('invert') && flashesOK() ? (ev.cur.t < 1.1 ? (Math.sin(ev.cur.t * 22) > 0.2 ? 1 : 0) : en > 0.5 ? 1 : 0) : 0;
    let rewind = state === 'reset' && rs && !rs.quick ? clamp(1 - (rs.t - 1.5) / 0.4, 0, 1) : 0;
    if (rs && rs.real) rewind = clamp((rs.t - rs.rewAt) / 0.1, 0, 1) * clamp((rs.slamAt + 0.05 - rs.t) / 0.15, 0, 1);
    let glitch = fx.baseGlitch + stillNow * 0.05 + fx.glitch * 0.6 + (evIs('glitchstorm') ? 0.85 * en : 0) + (state === 'pending' ? 0.35 : 0);
    if (reduced) glitch *= 0.5;
    const beat = AU.beat();
    const fakeBeat = Math.exp(-((sceneT * 2.33) % 1) * 6) * (0.25 + 0.5 * clamp(stillNow / 1.5, 0, 1));
    const u = {
      u_time: sceneT, u_still: stillNow, u_mix: fx.mix, u_hue: (fx.hueBase || 0) + fx.hue, u_folds: evIs('kaleido') && en > 0.05 ? 6 : fx.folds,
      u_pulse: fx.pulse, u_grow: growNow, u_beat: beat === null || beat === undefined ? fakeBeat : beat, u_spin: fx.spin,
      u_glitch: clamp(glitch, 0, 1.4), u_lens: [0.5, LY ? LY.cyUv : 0.535, fx.mix[2] * (0.35 + 0.3 * growNow)], u_shock: [0.5, LY ? LY.cyUv : 0.535, fx.shock],
      u_rewind: rewind, u_flash: fx.flash, u_flashCol: fx.flashCol,
      u_flip: evIs('flip') ? en : 0, u_mirror: evIs('mirror') ? en : 0, u_melt: fx.melt + (evIs('melt') ? 0.9 * en : 0),
      u_invert: inv, u_uiWarp: 0.45 + (ev.cur ? 0.4 * en : 0), u_scan: 0.22 + stillNow * 0.1, u_shake: reduced ? fx.shake * 0.25 : fx.shake,
    };
    if (R.real) {
      // the world you're in (the one you lost stays up until the roast lands)
      u.u_world = rs && !rs.slammed ? rs.lost.world : save.run ? H.worldOf(save.run.level) : 0;
      u.u_timeScale = timeScale();
      u.u_shatterT = rs && rs.real ? rs.t : 0;
      u.u_uiOn = rs && rs.real && rs.t < rs.rewAt ? 0 : 1;
      u.u_hue = fx.hs;
      u.u_lens = [0.5, LY ? LY.cyUv : 0.535, 0.2];
      u.u_scan = 0.12 + stillNow * 0.06;
      u.u_glitch = clamp(glitch * 0.8, 0, 1.3);
      u.u_flashOK = flashesOK();
    }
    return u;
  }
  function render(ts, dtMs) {
    applyFallback();
    const [W, Hh] = hudSize();
    if (hud.width !== W || hud.height !== Hh) { hud.width = W; hud.height = Hh; }
    LY = layout(W, Hh);
    hx.setTransform(1, 0, 0, 1, 0, 0);
    hx.globalAlpha = 1; hx.globalCompositeOperation = 'source-over';
    hx.clearRect(0, 0, W, Hh);
    const t0 = performance.now();
    drawHud(hx, LY);
    const t1 = performance.now();
    if (R.real && R.failed) { realFailed(); applyFallback(); }
    if (R.ok && !use2d) R.uploadUI(hud);
    if (R.ok) R.draw(uniforms(), dtMs);
    applyFallback();
    const t2 = performance.now();
    perf.hud += t1 - t0; perf.gl += t2 - t1; perf.n++;
    if (pend && pend.commit && state === 'pending') { if (!useReal()) makeSnap(); commitReset(); }
    const dt = lastRender ? Math.min(0.1, (ts - lastRender) / 1000) : 0.016;
    lastRender = ts;
    drawShatter(dt);
  }

  // ---------------------------------------------------------------- main loop
  let lastTs = 0, saveTimer = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const gap = lastTs ? ts - lastTs : 0;
    const dtMs = lastTs ? clamp(gap, 0, 250) : 16;
    lastTs = ts;
    // no frames for 3+ seconds while visible = the computer slept or froze: treat it like you left,
    // so the wiggle that wakes the screen up can't count as touching
    const froze = gap > 3000 && (state === 'live' || state === 'pending' || state === 'arming');
    if (froze && state === 'pending') cancelPending();
    tick();
    if (froze) {
      const rep = reportSince(lostFocus || rollSnap);
      lostFocus = null;
      startArming({ welcome: rep });
    }
    const dt = dtMs / 1000;
    update(dt);
    saveTimer += dt;
    if (saveTimer > 4) { saveTimer = 0; if (save.run) saveNow(); }
    // idle screens don't need 60 frames a second
    const cap = state === 'exit' || state === 'lock' ? 100 : state === 'menu' ? 33 : 0;
    if (cap && ts - lastRender < cap) return;
    render(ts, cap ? 0 : dtMs);
  }

  // ---------------------------------------------------------------- menus
  function applyVolumes() { AU.setVolumes(save.set.music, save.set.sfx); }
  function closePanels() { el.tropPanel.hidden = true; el.setPanel.hidden = true; el.wipeConfirm.hidden = true; }
  function refreshRunCard() {
    const r = save.run;
    el.runCard.hidden = !r;
    el.start.textContent = r ? 'CONTINUE' : 'START';
    if (!r) return;
    el.runTime.textContent = H.fmtTime(r.t);
    let s = H.short(r.logC) + ' ' + H.moneyName(r.maxTier) + '  ·  LV ' + r.level + '  ·  WORLD ' + (H.worldOf(r.level) + 1);
    if (awayReport) s += '\n+' + H.short(awayReport.earned) + ' while you were gone (' + H.fmtTime(awayReport.gone) + ')';
    el.runGain.textContent = s;
  }
  function refreshRecords() {
    const r = save.rec;
    const rows = [
      ['BEST HANDS-OFF', r.bestTime > 0 ? H.fmtTime(r.bestTime) : '--'],
      ['BIGGEST NUMBER', r.bestLog === H.ZERO ? '0' : H.short(r.bestLog)],
      ['FURTHEST', 'LV ' + r.bestLevel + ' · W' + (r.bestWorld + 1)],
      ['RESETS', String(r.resets)],
      ['TIME DOING NOTHING', H.fmtTime(r.totalTime)],
    ];
    // the run keeps counting on the menu, so this runs twice a second: only touch what changed
    if (el.records.children.length !== rows.length) {
      el.records.textContent = '';
      for (const [k] of rows) {
        const d = document.createElement('div'); d.className = 'rec';
        const a = document.createElement('dt'); a.textContent = k;
        d.append(a, document.createElement('dd')); el.records.appendChild(d);
      }
    }
    rows.forEach(([, v], i) => { const dd = el.records.children[i].lastChild; if (dd.textContent !== v) dd.textContent = v; });
  }
  function refreshMenu() {
    refreshRunCard();
    refreshRecords();
    el.tropCount.textContent = Object.keys(save.tro).length + '/' + H.TROPHIES.length;
  }
  function refreshExit() {
    const r = save.run;
    el.exitRun.textContent = r ? 'RUN ' + H.fmtTime(r.t) + '  ·  ' + H.short(r.logC) + ' ' + H.moneyName(r.maxTier) : '';
  }
  function buildTrophies() {
    el.tropGrid.textContent = '';
    const groups = [['time', 'HANDS OFF FOR'], ['number', 'BIG NUMBERS'], ['world', 'WORLDS'], ['roast', 'ROASTS']];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const [g, title] of groups) {
      const h = document.createElement('div'); h.className = 'group-title'; h.textContent = title;
      el.tropGrid.appendChild(h);
      for (const t of H.TROPHIES) {
        if (t.group !== g) continue;
        const got = save.tro[t.id];
        const card = document.createElement('div'); card.className = 'trophy ' + (got ? 'got' : 'locked');
        const cv = document.createElement('canvas'); cv.width = cv.height = Math.round(52 * dpr);
        const c = cv.getContext('2d'); c.scale(dpr, dpr);
        G.trophy(c, t.group, t.id, 26, 26, 17, got ? (g === 'roast' ? C.magenta : C.cyan) : '#5b5680');
        const box = document.createElement('div');
        const n = document.createElement('div'); n.className = 'tn'; n.textContent = t.name;
        const d = document.createElement('div'); d.className = 'td';
        d.textContent = t.desc + (got ? ' · ' + new Date(got).toLocaleDateString() : '');
        box.append(n, d);
        card.append(cv, box);
        el.tropGrid.appendChild(card);
      }
    }
  }
  function refreshSettings() {
    for (const b of el.qualitySeg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.q === save.set.quality));
    el.music.value = String(Math.round(save.set.music * 100));
    el.sfx.value = String(Math.round(save.set.sfx * 100));
    el.flash.setAttribute('aria-checked', String(save.set.flashes));
  }
  el.start.addEventListener('click', () => {
    if (state !== 'menu') return;
    AU.init(); AU.resume(); applyVolumes();
    const rep = awayReport;
    awayReport = null;
    startArming({ welcome: rep });
  });
  el.trop.addEventListener('click', () => { buildTrophies(); el.tropPanel.hidden = false; el.tropPanel.querySelector('[data-close]').focus(); });
  el.set.addEventListener('click', () => { refreshSettings(); el.setPanel.hidden = false; el.setPanel.querySelector('[data-close]').focus(); });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { closePanels(); refreshMenu(); }));
  el.qualitySeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    save.set.quality = b.dataset.q;
    if (R.ok) R.setQuality(rq(save.set.quality));
    refreshSettings(); saveNow();
  });
  el.music.addEventListener('input', () => { save.set.music = clamp(+el.music.value / 100, 0, 1); applyVolumes(); });
  el.sfx.addEventListener('input', () => { save.set.sfx = clamp(+el.sfx.value / 100, 0, 1); applyVolumes(); });
  el.sfx.addEventListener('change', () => { AU.init(); AU.resume(); AU.sfx('toast'); saveNow(); });
  el.music.addEventListener('change', saveNow);
  el.flash.addEventListener('click', () => { save.set.flashes = !save.set.flashes; refreshSettings(); saveNow(); });
  el.wipe.addEventListener('click', () => { el.wipeConfirm.hidden = false; el.wipeNo.focus(); });
  el.wipeNo.addEventListener('click', () => { el.wipeConfirm.hidden = true; });
  el.wipeYes.addEventListener('click', () => {
    const set = save.set;
    save = H.newSave(nowMs());
    save.set = set;
    runClock = nowMs();
    awayReport = null;
    lsDel(KEY);
    saveNow();
    closePanels();
    refreshMenu();
  });
  el.back.addEventListener('click', () => { if (state !== 'exit') return; AU.init(); AU.resume(); startArming({}); });
  el.take.addEventListener('click', takeOver);

  let lastSay = 0;
  function announce(s) {
    const t = performance.now();
    if (t - lastSay < 1500) return;
    lastSay = t;
    el.sr.textContent = s;
  }

  // ---------------------------------------------------------------- boot
  if (coarse) {
    const li = $('ruleLeave');
    if (li) li.textContent = 'Leaving is safe: tap the tiny X in the corner, close the tab, or let your phone sleep. It keeps counting while it\'s closed.';
  }
  // PCs get the real thing at full power; phones pick their own quality
  if (!coarse && save.set.quality === 'auto' && !lsGet('handsoff.real.v1')) { save.set.quality = 'max'; lsSet('handsoff.real.v1', '1'); }
  if (R.ok) R.setQuality(rq(save.set.quality));
  applyVolumes();
  if (!tryOwn()) setState('lock');
  else { awayReport = catchUp(); goMenu(); }
  requestAnimationFrame(frame);
  // test hook: lets the browser tests look inside without touching anything
  window.__HO_DEBUG = { get state() { return state; }, get save() { return save; }, get pend() { return pend; }, get rs() { return rs; }, get ev() { return ev; }, get tempt() { return tempt; }, get sweep() { return worldSweep; }, get welcome() { return welcome; }, get pushAlpha() { return pushAlpha; }, startEvent, R, perf };
})();
