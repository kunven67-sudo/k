// Input: keyboard + mouse (pointer lock) + touch. Game code reads actions, never raw keys,
// so every control can be rebound and touch buttons drive the same actions.
import { settings } from './settings.js';
import { device } from './quality.js';

export const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  shrink: ['KeyZ'],
  grow: ['KeyX'],
  force: ['KeyF'],
  interact: ['KeyE'],
  drop: ['KeyG'],
  phone: ['Tab'],
  view: ['KeyT'],
  pause: ['Escape', 'KeyP'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  fire: ['Mouse0'],
  alt: ['Mouse2'],
  debug: ['F3'],
};

class Input {
  constructor() {
    this.held = new Set(); // codes held
    this.edgeDown = new Set(); // codes pressed this frame
    this.edgeUp = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.touch = { moveX: 0, moveY: 0, held: new Set(), down: new Set() };
    this.canvas = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    const kd = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'F3') e.preventDefault();
      if (!this.held.has(e.code)) this.edgeDown.add(e.code);
      this.held.add(e.code);
    };
    const ku = (e) => {
      this.held.delete(e.code);
      this.edgeUp.add(e.code);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', () => {
      for (const c of this.held) this.edgeUp.add(c);
      this.held.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && !device.isTouch && this.enabled) this.requestLock();
      const c = 'Mouse' + e.button;
      if (!this.held.has(c)) this.edgeDown.add(c);
      this.held.add(c);
    });
    window.addEventListener('mouseup', (e) => {
      const c = 'Mouse' + e.button;
      this.held.delete(c);
      this.edgeUp.add(c);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const k = 0.0022 * settings.get('sensitivity');
      this.lookX += e.movementX * k;
      this.lookY += e.movementY * k * (settings.get('invertY') ? -1 : 1);
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        for (const c of this.held) if (c.startsWith('Mouse')) this.edgeUp.add(c);
        for (const c of [...this.held]) if (c.startsWith('Mouse')) this.held.delete(c);
      }
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => this.canvas.requestPointerLock?.());
    } catch {
      /* not allowed right now */
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _any(set, action) {
    for (const c of BINDINGS[action] || []) if (set.has(c)) return true;
    return false;
  }

  down(action) {
    return this.enabled && (this._any(this.held, action) || this.touch.held.has(action));
  }

  pressed(action) {
    return this.enabled && (this._any(this.edgeDown, action) || this.touch.down.has(action));
  }

  released(action) {
    return this._any(this.edgeUp, action);
  }

  // Movement intent in [-1,1]^2 (x = right, y = forward).
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0) + this.touch.moveX;
    let y = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0) + this.touch.moveY;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  consumeLook() {
    const r = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return this.enabled ? r : { x: 0, y: 0 };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return this.enabled ? w : 0;
  }

  endFrame() {
    this.edgeDown.clear();
    this.edgeUp.clear();
    this.touch.down.clear();
  }
}

export const input = new Input();
