// FNF 2 - phone extras, like FNF mobile (V-Slice funkin.mobile):
//   * the real back button (backButton.png) in the bottom right corner of the menus; tap it = back
//   * Android's own back button / back swipe goes back one menu instead of closing the game
// The pause button in songs is drawn by the play screen (20-play.js) with the real pauseButton art.

// a FNF mobile button: idle frame, a 'hold' frame while your finger is on it, then its confirm animation
G.TouchButton = class {
  constructor(sheet, x, y, scale, onConfirm, opts) {
    opts = opts || {};
    const s = this.spr = new G.Sprite(x, y).loadSparrow(sheet);
    const n = G.Sparrow.load(sheet) ? G.Sparrow.load(sheet).frames.length : 0;
    s.addAnim('idle', opts.prefix, 24, false, [0]);
    s.addAnim('hold', opts.prefix, 24, false, [opts.holdFrame || 5]);
    const conf = []; for (let i = opts.confirmFrom || 6; i < Math.min(n, opts.confirmTo || n); i++) conf.push(i);
    s.addAnim('confirm', opts.prefix, 24, false, conf);
    s.play('idle', true);
    s.scale.x = s.scale.y = scale; s.updateHitbox();
    this.rest = opts.rest != null ? opts.rest : 0.3; s.alpha = this.rest;
    this.instant = !!opts.instant; this.onConfirm = onConfirm;
    this.held = null; this.busy = false; this.enabled = true;
    this.tx = null; this.slideT = 0;
    s.onFinish = name => { if (name === 'confirm') { this.busy = false; if (!this.instant && this.onConfirm) this.onConfirm(); s.play('idle', true); s.alpha = this.rest; } };
  }
  get w() { return this.spr.frameW * this.spr.scale.x; }
  get h() { return this.spr.frameH * this.spr.scale.y; }
  hit(x, y) { const s = this.spr; return x >= s.x && x <= s.x + this.w && y >= s.y && y <= s.y + this.h; }
  // slides in from the right edge (freeplay + character select)
  slideIn(toX) { this.tx = toX; this.fx = this.spr.x; this.slideT = 0; }
  pointer(type, x, y, id) {
    if (!this.enabled || this.busy) return false;
    if (type === 'down' && this.hit(x, y)) { this.held = id; this.spr.play('hold', true); this.spr.alpha = 1; if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {} return true; }
    if (this.held == null || id !== this.held) return false;
    if (type === 'move' && !this.hit(x, y)) { this.held = null; this.spr.play('idle', true); this.spr.alpha = this.rest; return true; }
    if (type === 'up') { this.held = null; this.press(); return true; }
    return type === 'move';
  }
  press() {
    this.busy = true; this.spr.alpha = 1; this.spr.play('confirm', true);
    if (this.instant && this.onConfirm) this.onConfirm();
  }
  update(dt) {
    this.spr.update(dt);
    if (this.tx != null) { this.slideT = Math.min(1, this.slideT + dt / 0.5); this.spr.x = G.lerp(this.fx, this.tx, G.ease.expoOut ? G.ease.expoOut(this.slideT) : 1 - Math.pow(1 - this.slideT, 4)); if (this.slideT >= 1) this.tx = null; }
  }
  draw(ctx) { this.spr.draw(ctx, null); }
};

G.mobileUI = {
  // the screens that get the back button, and where it sits (V-Slice: most menus W-230, H-200; freeplay +
  // character select slide it in from the right edge at 30% opacity)
  SCREENS: { mainMenu: { rest: 1 }, storyMenu: { y: -170, rest: 0.7 }, freeplay: { slide: true, rest: 0.3, instant: true }, charSelect: { slide: true, rest: 0.3, instant: true }, options: { rest: 1 }, credits: { rest: 0.7 } },
  btn: null, forScreen: null,
  on() { return !!G.touchMode && !!G.screen && !(G.trans && G.trans.active); },
  ensure() {
    const name = G.screenName, cfg = this.SCREENS[name];
    if (G.screen !== this.forScreen) {
      this.forScreen = G.screen; this.btn = null;
      if (cfg && G.A.has('preload/images/backButton.png')) {
        const b = this.btn = new G.TouchButton('preload/images/backButton', cfg.slide ? G.W : G.W - 230, G.H + (cfg.y || -200), 0.7, () => this.back(), { prefix: 'back', rest: cfg.rest, instant: cfg.instant, confirmFrom: 6, confirmTo: 23 });
        if (cfg.slide) b.slideIn(G.W - 230);
      }
    }
    return this.btn;
  },
  // what the screen does with its own 'back' (Esc / Backspace)
  back() {
    const scr = G.screen; if (!scr) return;
    if (scr.mobileBack) { scr.mobileBack(); return; }
    if (scr.onAction) { try { scr.onAction('back', true, false); scr.onAction('back', false, false); } catch (e) { G.reportError(e, 'mobile back'); } }
  },
  pointer(type, x, y, id) {
    if (!this.on()) return false;
    const b = this.ensure();
    if (!b || (G.screen.hideMobileBack && G.screen.hideMobileBack())) return false;
    return b.pointer(type, x, y, id);
  },
  draw(ctx, dt) {
    if (!this.on()) return;
    const b = this.ensure();
    if (!b || (G.screen.hideMobileBack && G.screen.hideMobileBack())) return;
    b.update(dt); b.draw(ctx);
  },
};

// Android's back button (and the back swipe) moves the browser back a page, which would close the game: keep one
// extra page in the history, and when the browser goes back to it, put it back and do an in-game back instead
(function () {
  if (!G.isTouchDevice || !window.history || !history.pushState) return;
  try { history.pushState({ fnf2: 1 }, ''); } catch (e) { return; }
  window.addEventListener('popstate', () => {
    try { history.pushState({ fnf2: 1 }, ''); } catch (e) {}
    const scr = G.screen; if (!scr) return;
    if (G.screenName === 'play') { if (scr.paused) scr.onAction('back', true, false); else if (scr.openPause && (scr.started || (scr.cutscene && !scr.cutscene.done)) && !scr.gameOver) scr.openPause(); else scr.onAction('back', true, false); return; }
    G.mobileUI.back();
  });
})();

// ---------------------------------------------------------------- phones: sideways only, app mode, the phone update
// FNF mobile only runs sideways. Held upright, a card asks you to turn the phone (and a song pauses).
(function () {
  if (!G.isTouchDevice) return;
  const card = document.createElement('div');
  card.id = 'turnPhone';
  card.style.cssText = 'position:fixed;inset:0;z-index:50;background:#000;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6vh;color:#fff;font:bold 6vw VCR,monospace;text-align:center';
  card.innerHTML = '<div style="width:22vw;height:38vw;border:1.6vw solid #fff;border-radius:3.5vw;animation:fnf2turn 2s ease-in-out infinite"></div><div>TURN YOUR PHONE<br>SIDEWAYS</div>';
  const st = document.createElement('style');
  st.textContent = '@keyframes fnf2turn{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}';
  document.head.appendChild(st); document.body.appendChild(card);
  const check = () => {
    const up = window.innerHeight > window.innerWidth * 1.05;
    card.style.display = up ? 'flex' : 'none';
    if (up && !G._upright && G.screen && G.screen.onBlur) try { G.screen.onBlur(); } catch (e) {}
    G._upright = up;
  };
  window.addEventListener('resize', check); window.addEventListener('orientationchange', check);
  setTimeout(check, 0);
})();

// App mode (Options > Preferences): full screen, no browser bars, locked sideways, like the FNF app. A browser only
// allows full screen right after a tap, so it's asked for again on the next tap whenever it was left (back swipe...)
G.appMode = {
  want() { return !!(G.settings && G.settings.appMode) && G.isTouchDevice; },
  installed() { try { return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } },
  enter() {
    const d = document.documentElement;
    if (!document.fullscreenElement && d.requestFullscreen) {
      d.requestFullscreen({ navigationUI: 'hide' }).then(() => this.lock(), () => {});
    } else this.lock();
  },
  lock() { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} },
  exit() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  },
};
window.addEventListener('pointerdown', () => { if (G.appMode.want() && !document.fullscreenElement && !G.appMode.installed()) G.appMode.enter(); }, true);

// The phone's update: new pictures for the phone version come in small zips next to the big one (packs that the
// code needs). Missing on this phone: a little box on the title screen with the same two buttons as the first time.
// (GitHub takes files up to 100 MB, so the packs are split over a few zips: the box only asks for the ones it needs)
G.phoneUpdate = {
  BASE: 'https://github.com/kunven67-sudo/fnf2-private/raw/main/',
  ZIPS: { 'fnf2-phone-update.zip': ['mobile', 'videosongs', 'jordus'], 'fnf2-phone-impostor.zip': ['impostor', 'impostor-w1'],
    'fnf2-phone-impostor-w2.zip': ['impostor-w2'], 'fnf2-phone-impostor-w3.zip': ['impostor-w3'] },
  NEED: { mobile: 2, videosongs: 2, jordus: 4, impostor: 2, 'impostor-w1': 3, 'impostor-w2': 2, 'impostor-w3': 1 },   // (pack -> the version the code needs: mobile v2 = + the PRO MODE menu
            // word, videosongs v2 = Into Our Lives remade (real-time video, talk on the sides), jordus v2 = her own player, v3 = her own animations)
  saved: {},            // (packs picked just now: the zips on GitHub always hold the newest ones)
  old(id) { return !this.saved[id] && (!G.Packs.has(id) || (G.Packs.all[id].v || 1) < this.NEED[id]); },
  missing() { return G.isTouchDevice && G.HAS_FNF && !G.dataMissing && Object.keys(this.NEED).some(id => this.old(id)); },
  zips() { return Object.keys(this.ZIPS).filter(z => this.ZIPS[z].some(id => id in this.NEED && this.old(id))); },
  show(note) {
    if (this.box || this.closed || !this.missing()) return;
    const zips = this.zips();
    const d = this.box = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;bottom:4%;transform:translateX(-50%);z-index:30;background:rgba(0,0,0,.88);border:.5vmin solid #fff;border-radius:2vmin;padding:2.5vmin 4vmin;color:#fff;font:bold 4vmin VCR,monospace;text-align:center;max-width:92vw';
    const msg = document.createElement('div'); msg.textContent = note || 'PHONE UPDATE: VS IMPOSTOR week 3 (AIRSHIP ATROCITIES) + week 1-2 fixes';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:3vmin;justify-content:center;margin-top:2vmin;flex-wrap:wrap';
    const btn = (txt, bg, tag) => { const e = document.createElement(tag); e.textContent = txt; e.style.cssText = 'padding:2vmin 4vmin;border-radius:1.5vmin;color:#000;text-decoration:none;cursor:pointer;background:' + bg; return e; };
    const gets = zips.map((z, i) => {
      const get = btn(zips.length > 1 ? 'GET PART ' + (i + 1) : '1  GET IT', '#9CF', 'a'); get.href = this.BASE + z; get.target = '_blank'; get.rel = 'noopener';
      get.onclick = () => { msg.textContent = zips.length > 1 ? 'Downloading... get every part, then tap PICK THEM and pick them all' : 'Downloading... then come back and tap PICK IT'; };
      return get;
    });
    const pick = btn(zips.length > 1 ? 'PICK THEM' : '2  PICK IT', '#FFE45C', 'label');
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.style.display = 'none'; pick.appendChild(inp);
    inp.onchange = async () => {
      const files = [...(inp.files || [])]; if (!files.length) return;
      msg.textContent = 'Taking it out of the zip...';
      const got = await G.Packs.save(files);
      for (const m of got) if (m.part === 'head') this.saved[m.id] = true;
      if (!this.missing()) { msg.textContent = 'Done! Starting again...'; setTimeout(() => location.reload(), 600); }
      else if (got.some(m => m.id in this.NEED)) { this.hide(); this.show('Got it! One more: tap GET, then PICK IT'); }
      else msg.textContent = 'That is not a phone update zip. Tap GET, then PICK IT.';
    };
    const x = btn('LATER', '#888', 'span'); x.onclick = () => { this.closed = true; this.hide(); };
    // (taps on the box don't reach the game under it)
    d.addEventListener('pointerdown', e => e.stopPropagation());
    row.append(...gets, pick, x); d.append(msg, row); document.body.appendChild(d);
  },
  hide() { if (this.box) this.box.remove(); this.box = null; },
  tick() { if (G.screenName === 'title' && !G.trans.active) this.show(); else this.hide(); },
};
setInterval(() => { try { G.phoneUpdate.tick(); } catch (e) {} }, 500);
