// Mouse + keyboard. The real mouse is pointer-locked, so we only ever get movement deltas,
// which is exactly what a real mouse sliding on a desk gives you.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.buttons = 0;
    this.locked = false;
    this.handlers = { key: [], mouse: [], wheel: [], lock: [] };
    this.enabled = false;

    addEventListener('keydown', e => this.key(e, true), { capture: true });
    addEventListener('keyup', e => this.key(e, false), { capture: true });
    addEventListener('blur', () => { for (const c of [...this.keys]) this.emitKey({ code: c, key: '', repeat: false, synthetic: true }, false); this.keys.clear(); this.buttons = 0; });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      // Chrome sometimes reports a huge jump right after locking; ignore those.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.dx += e.movementX; this.dy += e.movementY;
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      this.buttons |= 1 << e.button;
      for (const f of this.handlers.mouse) f(e.button, true);
      e.preventDefault();
    });
    document.addEventListener('mouseup', e => {
      if (!(this.buttons & (1 << e.button))) return;
      this.buttons &= ~(1 << e.button);
      for (const f of this.handlers.mouse) f(e.button, false);
    });
    document.addEventListener('wheel', e => {
      if (!this.locked) return;
      const steps = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100;
      this.wheel += steps;
      for (const f of this.handlers.wheel) f(steps);
    }, { passive: true });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.buttons = 0; }
      for (const f of this.handlers.lock) f(this.locked);
    });
  }

  on(type, f) { this.handlers[type].push(f); }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* ignored */ } });
    } catch (e) { /* ignored */ }
  }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  key(e, down) {
    if (!this.enabled) return;
    // Let the browser keep a few keys for itself.
    if (['F5', 'F11', 'F12'].includes(e.code) && !e.ctrlKey) return;
    if (e.code === 'F1') e.preventDefault(); // the game menu, not the browser's help page
    if (this.locked || document.fullscreenElement) e.preventDefault();
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    this.emitKey(e, down);
  }

  emitKey(e, down) {
    for (const f of this.handlers.key) if (f(e, down) === true) break;
  }

  down(code) { return this.keys.has(code); }

  take() {
    const d = { dx: this.dx, dy: this.dy, wheel: this.wheel };
    this.dx = 0; this.dy = 0; this.wheel = 0;
    return d;
  }
}
