// Keyboard + mouse. Keys are tracked by `code` so WASD works on any layout.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.buttons = new Set();
    this.clicked = new Set();
    this.wheel = 0;
    this.locked = false;
    this.enabled = false;
    this.dragLook = false; // fallback when pointer lock keeps getting refused
    this.lockErrors = 0;
    this._dragging = false;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => {
      this.down.clear();
      this.buttons.clear();
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.dragLook) {
        this.requestLock();
        return;
      }
      this.buttons.add(e.button);
      this.clicked.add(e.button);
      if (this.dragLook) this._dragging = true;
    });
    addEventListener('mouseup', (e) => {
      this.buttons.delete(e.button);
      this._dragging = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || (this.dragLook && this._dragging)) {
        // some browsers report giant spikes right after locking
        if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) {
        this.dragLook = false;
        this.lockErrors = 0;
      }
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      // Browsers refuse a re-lock for a moment after Esc; only give up on
      // pointer lock (and look by dragging) if it keeps failing.
      this.lockErrors++;
      if (this.lockErrors >= 3) this.dragLook = true;
      this.onLockError?.();
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          try {
            // older browsers don't take options
            const p2 = this.canvas.requestPointerLock();
            p2?.catch?.(() => {});
          } catch {
            /* the pointerlockerror handler takes it from here */
          }
        });
      }
    } catch {
      if (!this.canvas.requestPointerLock) this.dragLook = true;
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  key(code) {
    return this.down.has(code);
  }
  hit(code) {
    return this.pressed.has(code);
  }
  axis(neg, pos) {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }

  /** call at the end of every frame */
  endFrame() {
    this.pressed.clear();
    this.clicked.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
