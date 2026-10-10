// Unified input: keyboard + mouse (pointer lock) on PC, twin virtual joysticks + buttons (or
// tap-to-move) on phones. Gameplay code reads *actions*, never raw keys:
//
//   input.move            -> {x, y}  (-1..1, y forward)
//   input.look            -> {x, y}  accumulated look delta this frame (pixels-ish)
//   input.down('sprint')  -> held?
//   input.pressed('interact') -> went down this frame?
//   input.released('interact')
//   input.pointer         -> {x, y, ndcX, ndcY, buttons, dragging} for physical drag interactions
//   input.wheel           -> scroll delta this frame
//
// Keys are rebindable via input.bind(action, codes[]). Touch buttons map to the same actions.

import { bus } from './events.js';
import { settings } from './settings.js';
import { device } from './quality.js';
import { injectStyle } from './util.js';

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  crouch: ['KeyC', 'ControlLeft'],
  interact: ['KeyE'],
  use: ['KeyF'], // secondary use (drink, eat, light switch…)
  phone: ['KeyP', 'Tab'],
  pockets: ['KeyI'],
  emote: ['KeyG'], // hold for emote wheel
  flop: ['KeyR'], // ragdoll on purpose
  talk: ['KeyT'], // open typed chat / push-to-talk when micMode = 'push'
  voice: ['KeyV'], // push-to-talk key
  camera: ['KeyX'], // swap shoulder
  menu: ['Escape'],
  photo: ['F12'],
  replay: ['KeyB'],
  dev: ['F3'],
  // vehicle
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  handbrake: ['Space'],
  horn: ['KeyH'],
  lights: ['KeyL'],
  wipers: ['KeyJ'],
  signalLeft: ['KeyQ'],
  signalRight: ['KeyE'],
  seatbelt: ['KeyK'],
  radioNext: ['Period'],
  radioPrev: ['Comma'],
  enterExit: ['KeyF'],
};

class Input {
  constructor() {
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.keysDown = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.wheel = 0;
    this.pointer = { x: 0, y: 0, ndcX: 0, ndcY: 0, buttons: 0, dragging: false, dx: 0, dy: 0 };
    this.pointerLocked = false;
    this.wantPointerLock = false; // states set this when they need mouse-look
    this.typing = false; // true while a text field has focus — gameplay keys are ignored
    this.touch = null; // TouchControls instance on touch devices
    this.canvas = null;
    this._touchActions = new Set();
    this._touchPressed = new Set();
    this._touchReleased = new Set();
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    window.addEventListener('blur', () => {
      for (const code of this.keysDown) this._releaseCode(code);
      this.keysDown.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      this.pointer.buttons = e.buttons;
      this.pointer.dragging = true;
      if (this.wantPointerLock && !this.pointerLocked && !device.isTouch) canvas.requestPointerLock?.();
      bus.emit('input:pointerdown', { button: e.button });
    });
    window.addEventListener('mouseup', (e) => {
      this.pointer.buttons = e.buttons;
      this.pointer.dragging = false;
      bus.emit('input:pointerup', { button: e.button });
    });
    window.addEventListener('mousemove', (e) => {
      const sens = settings.get('mouseSensitivity');
      if (this.pointerLocked) {
        this.look.x += e.movementX * sens;
        this.look.y += e.movementY * sens * (settings.get('invertY') ? -1 : 1);
      }
      this.pointer.dx += e.movementX;
      this.pointer.dy += e.movementY;
      this._setPointer(e.clientX, e.clientY);
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      bus.emit('input:pointerlock', this.pointerLocked);
    });
    // Track text inputs so typing never moves the character.
    document.addEventListener('focusin', (e) => {
      this.typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;
    });
    document.addEventListener('focusout', () => {
      this.typing = false;
    });
    if (device.isTouch) this.touch = new TouchControls(this, document.getElementById('touch-root'));
  }

  bind(action, codes) {
    this.bindings[action] = codes;
  }

  _setPointer(cx, cy) {
    this.pointer.x = cx;
    this.pointer.y = cy;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.pointer.ndcX = (cx / w) * 2 - 1;
    this.pointer.ndcY = -(cy / h) * 2 + 1;
  }

  _onKey(e, isDown) {
    if (this.typing && e.code !== 'Escape' && e.code !== 'Enter') return;
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F12', 'F3'].includes(e.code)) e.preventDefault();
    if (isDown) {
      if (e.repeat) return;
      this.keysDown.add(e.code);
      this._pressCode(e.code);
    } else {
      this.keysDown.delete(e.code);
      this._releaseCode(e.code);
    }
  }

  _pressCode(code) {
    for (const [action, codes] of Object.entries(this.bindings)) if (codes.includes(code)) this._pressed.add(action);
  }

  _releaseCode(code) {
    for (const [action, codes] of Object.entries(this.bindings)) if (codes.includes(code)) this._released.add(action);
  }

  down(action) {
    if (this._touchActions.has(action)) return true;
    const codes = this.bindings[action];
    if (!codes || this.typing) return false;
    for (const c of codes) if (this.keysDown.has(c)) return true;
    return false;
  }

  pressed(action) {
    return this._pressed.has(action) || this._touchPressed.has(action);
  }

  released(action) {
    return this._released.has(action) || this._touchReleased.has(action);
  }

  // Touch layer calls these.
  touchDown(action) {
    if (!this._touchActions.has(action)) this._touchPressed.add(action);
    this._touchActions.add(action);
  }

  touchUp(action) {
    if (this._touchActions.has(action)) this._touchReleased.add(action);
    this._touchActions.delete(action);
  }

  // Called by the engine at the start of each frame.
  beginFrame() {
    let x = 0;
    let y = 0;
    if (!this.typing) {
      if (this.down('forward')) y += 1;
      if (this.down('back')) y -= 1;
      if (this.down('right')) x += 1;
      if (this.down('left')) x -= 1;
    }
    if (this.touch) {
      const s = this.touch.moveStick;
      if (Math.abs(s.x) + Math.abs(s.y) > 0.01) {
        x = s.x;
        y = s.y;
      }
      this.look.x += this.touch.lookDelta.x;
      this.look.y += this.touch.lookDelta.y;
      this.touch.lookDelta.x = 0;
      this.touch.lookDelta.y = 0;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
  }

  // Called by the engine at the end of each frame.
  endFrame() {
    this._pressed.clear();
    this._released.clear();
    this._touchPressed.clear();
    this._touchReleased.clear();
    this.look.x = 0;
    this.look.y = 0;
    this.pointer.dx = 0;
    this.pointer.dy = 0;
    this.wheel = 0;
  }

  setPointerLock(want) {
    this.wantPointerLock = want;
    if (!want && document.pointerLockElement) document.exitPointerLock?.();
    if (this.touch) this.touch.setVisible(want);
  }
}

// ---- Touch: twin sticks (left move, right look) + contextual buttons --------------------------

injectStyle('touch-controls', `
  .tc-zone { position:absolute; top:0; bottom:0; pointer-events:auto; touch-action:none; }
  .tc-zone.left { left:0; width:45%; }
  .tc-zone.right { right:0; width:55%; }
  .tc-stick { position:absolute; width:120px; height:120px; margin:-60px 0 0 -60px; border-radius:50%;
    border:2px solid rgba(255,255,255,.28); background:rgba(0,0,0,.18); display:none; }
  .tc-knob { position:absolute; left:50%; top:50%; width:52px; height:52px; margin:-26px 0 0 -26px;
    border-radius:50%; background:rgba(255,255,255,.55); box-shadow:0 2px 10px rgba(0,0,0,.4); }
  .tc-buttons { position:absolute; right:calc(14px + var(--safe-right)); bottom:calc(18px + var(--safe-bottom));
    display:grid; grid-template-columns:repeat(3,64px); gap:10px; pointer-events:none; }
  .tc-btn { pointer-events:auto; width:64px; height:64px; border-radius:50%; border:2px solid rgba(255,255,255,.35);
    background:rgba(10,10,12,.35); color:#fff; font:600 11px var(--font-ui); display:grid; place-items:center;
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); touch-action:none; }
  .tc-btn.active { background:rgba(216,178,90,.55); }
  .tc-btn svg { width:26px; height:26px; fill:none; stroke:#fff; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .tc-top { position:absolute; left:calc(12px + var(--safe-left)); top:calc(12px + var(--safe-top)); display:flex; gap:10px; pointer-events:none; }
  .tc-top .tc-btn { width:48px; height:48px; }
  .tc-top .tc-btn svg { width:22px; height:22px; }
  .tc-hidden { display:none !important; }
`);

class TouchControls {
  constructor(input, root) {
    this.input = input;
    this.root = root;
    this.moveStick = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this._build();
    this.setVisible(false);
  }

  _build() {
    const left = document.createElement('div');
    left.className = 'tc-zone left';
    const right = document.createElement('div');
    right.className = 'tc-zone right';
    const stick = document.createElement('div');
    stick.className = 'tc-stick';
    const knob = document.createElement('div');
    knob.className = 'tc-knob';
    stick.appendChild(knob);
    left.appendChild(stick);
    this.root.append(left, right);
    this.zones = [left, right];

    let moveId = null;
    let origin = null;
    left.addEventListener('pointerdown', (e) => {
      moveId = e.pointerId;
      origin = { x: e.clientX, y: e.clientY };
      stick.style.display = 'block';
      stick.style.left = `${e.clientX}px`;
      stick.style.top = `${e.clientY - left.getBoundingClientRect().top}px`;
      left.setPointerCapture(e.pointerId);
    });
    left.addEventListener('pointermove', (e) => {
      if (e.pointerId !== moveId) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      const max = 52;
      const len = Math.min(max, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * len;
      const ky = Math.sin(ang) * len;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      this.moveStick.x = kx / max;
      this.moveStick.y = -ky / max;
      // Push the stick far to sprint, like mobile shooters.
      if (len >= max * 0.98) this.input.touchDown('sprint');
      else this.input.touchUp('sprint');
    });
    const endMove = (e) => {
      if (e.pointerId !== moveId) return;
      moveId = null;
      stick.style.display = 'none';
      knob.style.transform = '';
      this.moveStick.x = 0;
      this.moveStick.y = 0;
      this.input.touchUp('sprint');
    };
    left.addEventListener('pointerup', endMove);
    left.addEventListener('pointercancel', endMove);

    let lookId = null;
    let last = null;
    right.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      right.setPointerCapture(e.pointerId);
    });
    right.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      const sens = 1.6 * settings.get('mouseSensitivity');
      this.lookDelta.x += (e.clientX - last.x) * sens;
      this.lookDelta.y += (e.clientY - last.y) * sens * (settings.get('invertY') ? -1 : 1);
      last = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e) => {
      if (e.pointerId === lookId) lookId = null;
    };
    right.addEventListener('pointerup', endLook);
    right.addEventListener('pointercancel', endLook);

    // Stroked 24×24 icons (no emoji in the game's art).
    const ICON = {
      phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z M10.5 18.5h3 M13 6.5l-2.5 4 M14.5 9l-2 3',
      emote: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4a1.5 1.5 0 0 1 3 0v6 M14 10V5.5a1.5 1.5 0 0 1 3 0V12 M17 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4.3 14.6a1.6 1.6 0 0 1 2.6-1.8L8 14',
      jump: 'M12 20V5 M6 11l6-6 6 6 M5 21h14',
      crouch: 'M12 4v15 M6 13l6 6 6-6 M5 3h14',
      use: 'M9 11V6a3 3 0 0 1 6 0v5 M6 11h12l-1 9H7z M12 14v3',
      interact: 'M7 11V5.5a1.5 1.5 0 0 1 3 0V12 M10 11V4a1.5 1.5 0 0 1 3 0v7 M13 11V5.5a1.5 1.5 0 0 1 3 0V13 M16 10a1.5 1.5 0 0 1 3 0v4.5A6.5 6.5 0 0 1 12.5 21h-.8a5.5 5.5 0 0 1-4.6-2.5L4 14a1.5 1.5 0 0 1 2.5-1.6L7 13',
      menu: 'M4 7h16 M4 12h16 M4 17h16',
      pockets: 'M5 4h14v9a7 7 0 0 1-14 0z M5 8h14 M9.5 4v4',
    };
    const make = (action, parent) => {
      const b = document.createElement('button');
      b.className = 'tc-btn';
      b.setAttribute('aria-label', action);
      b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${ICON[action]}"/></svg>`;
      b.dataset.action = action;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        b.classList.add('active');
        this.input.touchDown(action);
      });
      const up = () => {
        b.classList.remove('active');
        this.input.touchUp(action);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      parent.appendChild(b);
    };
    const buttons = document.createElement('div');
    buttons.className = 'tc-buttons';
    for (const action of ['phone', 'emote', 'jump', 'crouch', 'use', 'interact']) make(action, buttons);
    const top = document.createElement('div');
    top.className = 'tc-top';
    for (const action of ['menu', 'pockets']) make(action, top);
    this.root.appendChild(top);
    this.top = top;
    this.root.appendChild(buttons);
    this.buttons = buttons;
  }

  setVisible(v) {
    for (const z of this.zones) z.classList.toggle('tc-hidden', !v);
    this.buttons.classList.toggle('tc-hidden', !v);
    this.top?.classList.toggle('tc-hidden', !v);
  }
}

export const input = new Input();
