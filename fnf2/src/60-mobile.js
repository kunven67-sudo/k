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
    if (G.screenName === 'play') { if (scr.paused) scr.onAction('back', true, false); else if (scr.openPause && scr.started && !scr.gameOver) scr.openPause(); else scr.onAction('back', true, false); return; }
    G.mobileUI.back();
  });
})();
