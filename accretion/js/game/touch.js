// Touch controls for phones and tablets: a thumbstick fires your jets, dragging
// anywhere else looks around, two fingers pinch to zoom, tapping a body locks
// onto it, and buttons stand in for the keyboard.
const $ = (id) => document.getElementById(id);

const HOLD = [
  ['Brake', 'KeyX', 'Match the local orbit'],
  ['Boost', 'ShiftLeft', 'Stronger jets, more mass lost'],
  ['Up', 'Space', 'Jets up'],
  ['Down', 'KeyC', 'Jets down'],
  ['Pull', 'KeyE', 'Pull captured moons and debris in'],
];
const TAP = [
  ['Lock', 'KeyT', 'Lock what’s under the crosshair'],
  ['Food', 'Tab', 'Lock the nearest thing you can eat'],
];
const MORE = [
  ['Info', (g) => g.toggleSheet('info')],
  ['Map', (g) => g.toggleSheet('map')],
  ['Scope', (g) => g.toggleSheet('scope')],
  ['Book', (g) => g.toggleSheet('book')],
  ['Goals', (g) => g.toggleSheet('goals')],
  ['View', (g) => g.cycleView?.()],
  ['Cutaway', (g) => g.toggleCutaway?.()],
  ['Vision', (g) => g.cycleVision?.()],
  ['Photo', (g) => g.togglePhoto?.()],
  ['HUD', (g) => g.cycleHud()],
  ['Sandbox', (g) => g.toggleSheet('sandbox'), 'sandbox'],
];

// how the keyboard hints read on a touch screen
const KEY_WORDS = { W: 'stick', X: 'Brake', T: 'Lock', E: 'Pull', '.': '»', ',': '«', I: 'Info', M: 'Map', L: 'Scope', J: 'Book', K: 'Cutaway', V: 'View', N: 'Vision', F: 'Photo', Tab: 'Food', Esc: '❚❚' };

export function touchText(html) {
  return html
    .replace('Click the view, then move the mouse to look around.', 'Drag anywhere on the view to look around. Pinch to zoom.')
    .replace(/Hold <kbd>W<\/kbd> to fire your volcanic jets forward/, 'Push the thumbstick to fire your volcanic jets')
    .replace(/<kbd>([^<]+)<\/kbd>/g, (m, k) => (KEY_WORDS[k] ? `<kbd>${KEY_WORDS[k]}</kbd>` : m));
}

function capture(el, e) {
  try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
}

export function prefersTouch() {
  try {
    return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  } catch {
    return false;
  }
}

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.stick = { x: 0, y: 0 };
    this.stickId = null;
    this.looks = new Map(); // pointerId -> { x, y, x0, y0, t0, moved }
    this.pinch = 0;
    this.build();
    if (prefersTouch()) this.enable();
    // a touch screen on a laptop: switch over the first time it's used
    window.addEventListener('touchstart', () => this.enable(), { passive: true, once: true });
  }

  enable() {
    if (this.on) return;
    this.on = true;
    document.body.classList.add('touch');
    $('card-hint').textContent = 'Tap to dismiss';
    this.game.hud?.resize?.();
  }

  build() {
    const g = this.game;
    const root = document.createElement('div');
    root.id = 'touch';
    root.hidden = true;
    root.innerHTML = `
      <div class="t-stick" id="t-stick" aria-label="Jets: push to fire"><div class="t-knob" id="t-knob"></div></div>
      <div class="t-pad" id="t-pad"></div>
      <div class="t-side" id="t-side">
        <button class="t-btn" id="t-pause" aria-label="Pause">❚❚</button>
        <button class="t-btn" id="t-slower" aria-label="Slow down time">«</button>
        <button class="t-btn" id="t-faster" aria-label="Speed up time">»</button>
        <button class="t-btn" id="t-more" aria-label="More tools" aria-expanded="false">☰</button>
      </div>
      <div class="t-more" id="t-more-menu" hidden></div>
      <div class="t-rotate" id="t-rotate">Turn your phone sideways for the best view</div>`;
    document.body.appendChild(root);
    this.root = root;
    this.knob = $('t-knob');
    const pad = $('t-pad');
    for (const [label, code, title] of HOLD) {
      const b = this.button(label, title);
      const press = (e) => { e.preventDefault(); capture(b, e); g.input.keys.add(code); b.classList.add('on'); };
      const release = () => { g.input.keys.delete(code); b.classList.remove('on'); };
      b.addEventListener('pointerdown', press);
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('lostpointercapture', release);
      pad.appendChild(b);
    }
    for (const [label, code, title] of TAP) {
      const b = this.button(label, title);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); g.input.pressed.add(code); });
      pad.appendChild(b);
    }
    const menu = $('t-more-menu');
    for (const [label, fn, only] of MORE) {
      const b = this.button(label, label);
      if (only) b.dataset.only = only;
      b.addEventListener('click', () => { this.showMore(false); fn(g); });
      menu.appendChild(b);
    }
    $('t-pause').addEventListener('click', () => g.pause());
    $('t-faster').addEventListener('click', () => g.timeFaster());
    $('t-slower').addEventListener('click', () => g.timeSlower());
    $('t-more').addEventListener('click', () => this.showMore(menu.hidden));
    $('card').addEventListener('click', () => g.hud.hideCard());
    this.bindStick();
    this.bindView();
  }

  button(label, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 't-btn';
    b.textContent = label;
    b.title = title;
    return b;
  }

  showMore(open) {
    const menu = $('t-more-menu');
    menu.hidden = !open;
    $('t-more').setAttribute('aria-expanded', String(open));
    for (const b of menu.children) b.hidden = b.dataset.only === 'sandbox' && this.game.mode !== 'sandbox';
  }

  bindStick() {
    const el = $('t-stick');
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const R = r.width / 2;
      let x = (e.clientX - (r.left + R)) / R, y = (e.clientY - (r.top + R)) / R;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.stick.x = x;
      this.stick.y = y;
      this.knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      capture(el, e);
      set(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) set(e); });
    const end = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stick.x = this.stick.y = 0;
      this.knob.style.transform = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  // one finger looks around, two fingers pinch to zoom, a quick tap locks onto a body
  bindView() {
    const cv = this.game.canvas;
    cv.style.touchAction = 'none';
    const pinchDist = () => {
      const p = [...this.looks.values()];
      return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.enable();
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      this.pinch = pinchDist();
    });
    cv.addEventListener('pointermove', (e) => {
      const t = this.looks.get(e.pointerId);
      if (!t) return;
      const dx = e.clientX - t.x, dy = e.clientY - t.y;
      t.x = e.clientX;
      t.y = e.clientY;
      const g = this.game;
      if (this.looks.size >= 2) {
        const d = pinchDist();
        if (this.pinch > 0 && d > 0) {
          const steps = -Math.log(d / this.pinch) / Math.log(1.15);
          if (g.mapOpen) g.map.dist = Math.min(300000, Math.max(3, g.map.dist * Math.pow(1.15, steps)));
          else if (g.state === 'playing') g.input.wheel += steps;
        }
        this.pinch = d;
        return;
      }
      // the map handles its own one-finger drag
      if (g.mapOpen || g.state !== 'playing') return;
      g.input.mouseDX += dx * 1.25;
      g.input.mouseDY += dy * 1.25;
    });
    const end = (e) => {
      const t = this.looks.get(e.pointerId);
      if (!t) return;
      this.looks.delete(e.pointerId);
      this.pinch = pinchDist();
      const tap = performance.now() - t.t0 < 300 && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < 12;
      if (tap && e.type === 'pointerup' && this.looks.size === 0) this.tapAt(e.clientX, e.clientY);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  tapAt(x, y) {
    const g = this.game;
    if (g.state !== 'playing' || g.mapOpen || g.sheet || g.photoOn) return;
    if (!$('card').hidden) { g.hud.hideCard(); return; }
    const p = g.world.player;
    let best = null, bd = 44;
    for (const b of g.world.bodies) {
      if (!b.alive || b === p) continue;
      const s = g.project(b.x, b.y, b.z);
      if (!s.on) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      g.target = g.target === best ? null : best;
      g.audio.blip?.();
    }
  }

  // thrust direction from the stick, in screen terms (up on the stick is forward)
  thrust() {
    const s = this.stick;
    const l = Math.hypot(s.x, s.y);
    return l > 0.18 ? { right: s.x, forward: -s.y } : null;
  }

  update() {
    if (!this.on) return;
    const g = this.game;
    const show = g.state === 'playing' && !g.sheet && !g.photoOn && !g.mapOpen;
    if (this.root.hidden === show) this.root.hidden = !show;
    if (!show && !$('t-more-menu').hidden) this.showMore(false);
  }
}
