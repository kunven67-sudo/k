// Keyboard + mouse. Key bindings are named actions so they can be rebound later.

export const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jogToggle: ['CapsLock'],
  crouch: ['ControlLeft', 'KeyC'],
  leanLeft: ['KeyQ'],
  leanRight: ['KeyE'],
  watch: ['KeyT'],
  phone: ['Tab'],
  pause: ['Escape'],
  fastForward: ['KeyF'],
  build: ['KeyB'],
  undo: ['KeyZ'],
  flashlight: ['KeyL'],
};

class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();   // pressed this frame
    this.released = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttons = 0;
    this.buttonsPressed = 0;
    this.locked = false;
    this.enabled = true;
    this.canvas = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.enabled) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (this.locked && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.buttons = 0; });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.buttons |= 1 << e.button;
      this.buttonsPressed |= 1 << e.button;
    });
    window.addEventListener('mouseup', (e) => { this.buttons &= ~(1 << e.button); });
    window.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.down.clear(); this.buttons = 0; }
    });
  }

  lock() {
    if (!this.canvas || this.locked) return;
    const quiet = (p) => { if (p && p.catch) p.catch(() => {}); };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { quiet(this.canvas.requestPointerLock()); } catch { /* needs a click */ } });
    } catch { try { quiet(this.canvas.requestPointerLock()); } catch { /* needs a click */ } }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  action(name) { return BINDINGS[name].some((c) => this.down.has(c)); }
  actionPressed(name) { return BINDINGS[name].some((c) => this.pressed.has(c)); }
  mouse(btn) { return (this.buttons & (1 << btn)) !== 0; }
  mousePressed(btn) { return (this.buttonsPressed & (1 << btn)) !== 0; }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttonsPressed = 0;
  }
}

export const input = new Input();
