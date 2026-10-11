// Keyboard + mouse state with rebindable actions and pointer lock.
import { getSettings, setSetting } from '../settings.js';

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', jump: 'Space', crouch: 'ControlLeft', crouchToggle: 'KeyC',
  fly: 'KeyV', leanLeft: 'KeyQ', leanRight: 'KeyE', pickup: 'KeyF',
  reload: 'KeyR', spawnMenu: 'KeyB', slowmo: 'KeyT', undo: 'KeyZ', snap: 'KeyG',
};

export const ACTION_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  sprint: 'Sprint / steady scope', jump: 'Jump (x2 double jump, hold = jetpack)',
  crouch: 'Crouch (hold) / slide', crouchToggle: 'Crouch (toggle)', fly: 'Fly mode',
  leanLeft: 'Lean left', leanRight: 'Lean right', pickup: 'Pick up / throw',
  reload: 'Reload / rotate', spawnMenu: 'Spawn menu', slowmo: 'Slow motion',
  undo: 'Undo last spawn', snap: 'Snap to grid on/off',
};

export function keyLabel(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.replace('Left', ' L').replace('Right', ' R').replace('Control', 'Ctrl');
}

class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();   // actions pressed this frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, buttons: 0, pressed: 0, released: 0 };
    this.locked = false;
    this.enabled = false;       // game captures input only while playing
    this.element = null;
    this.onKeyRaw = null;       // used by key rebinding UI
    this.lockHandlers = new Set();
    if (!getSettings().bindings) setSetting('bindings', { ...DEFAULT_BINDINGS });
    else setSetting('bindings', { ...DEFAULT_BINDINGS, ...getSettings().bindings });
  }

  attach(element) {
    this.element = element;
    addEventListener('keydown', (e) => {
      if (this.onKeyRaw) { e.preventDefault(); this.onKeyRaw(e.code); return; }
      if (e.target instanceof HTMLInputElement) return;
      if (this.enabled && this.locked && (e.code === 'Tab' || e.ctrlKey || e.code === 'Space')) e.preventDefault();
      if (!this.keys.has(e.code)) this._edge(e.code, true);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._edge(e.code, false);
    });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const bit = 1 << e.button;
      this.mouse.buttons |= bit;
      this.mouse.pressed |= bit;
      this._edge('Mouse' + e.button, true);
    });
    addEventListener('mouseup', (e) => {
      const bit = 1 << e.button;
      this.mouse.buttons &= ~bit;
      this.mouse.released |= bit;
      this._edge('Mouse' + e.button, false);
    });
    addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (!this.locked) { this.keys.clear(); this.mouse.buttons = 0; }
      this.lockHandlers.forEach((fn) => fn(this.locked));
    });
  }

  _edge(code, down) {
    const b = getSettings().bindings;
    for (const action in b) {
      if (b[action] === code) (down ? this.pressed : this.released).add(action);
    }
    (down ? this.pressed : this.released).add('raw:' + code);
  }

  lock() { if (this.element && !this.locked) this.element.requestPointerLock?.(); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(action) { return this.keys.has(getSettings().bindings[action]); }
  hit(action) { return this.pressed.has(action); }
  up(action) { return this.released.has(action); }
  rawHit(code) { return this.pressed.has('raw:' + code); }
  mouseDown(btn) { return (this.mouse.buttons & (1 << btn)) !== 0; }
  mouseHit(btn) { return (this.mouse.pressed & (1 << btn)) !== 0; }
  mouseUp(btn) { return (this.mouse.released & (1 << btn)) !== 0; }

  // Call at the end of every frame.
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
    this.mouse.pressed = this.mouse.released = 0;
  }
}

export const input = new Input();
