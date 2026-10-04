// One input system for keyboard + mouse, Xbox/PS controllers and touch screens.
// Game code asks for actions ("jump", "shrink") and axes, never raw keys.

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', KeyC: 'crouch',
  KeyF: 'shrink', KeyG: 'grow', KeyE: 'use', KeyV: 'camera', KeyQ: 'spawn', KeyL: 'light',
  KeyR: 'rotate', KeyX: 'drop', KeyZ: 'undo', KeyP: 'phone', Tab: 'phone', Escape: 'pause',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5',
  F3: 'debug', KeyT: 'freeze',
};

class Input {
  constructor() {
    this.down = new Set();      // actions held right now
    this.pressedSet = new Set(); // actions that went down this frame
    this.releasedSet = new Set();
    this.look = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.scroll = 0;
    this.locked = false;
    this.mode = 'kbm';          // kbm | pad | touch
    this.enabled = false;       // false while menus are open
    this.touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
    this.padPrev = [];
    this.target = null;
  }

  attach(el) {
    this.target = el;
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const a = KEYMAP[e.code];
      if (a) { if (a === 'phone' || a === 'pause' || e.code === 'Space') e.preventDefault(); this._press(a); this.mode = 'kbm'; }
    });
    addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) this._release(a); });
    addEventListener('blur', () => { for (const a of [...this.down]) this._release(a); });
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.isTouch()) { this.requestLock(); return; }
      if (e.button === 0) this._press('fire');
      if (e.button === 2) this._press('alt');
      if (e.button === 1) this._press('grab');
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this._release('fire');
      if (e.button === 2) this._release('alt');
      if (e.button === 1) this._release('grab');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.x += e.movementX; this.look.y += e.movementY; this.mode = 'kbm';
    });
    addEventListener('wheel', (e) => { if (this.locked) this.scroll += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.target;
      if (!this.locked) { for (const a of [...this.down]) this._release(a); if (this.onUnlock) this.onUnlock(); }
    });
  }

  isTouch() { return this.mode === 'touch' || matchMedia('(pointer: coarse)').matches; }
  requestLock() { if (this.isTouch()) return; try { this.target.requestPointerLock(); } catch { /* not allowed */ } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  _press(a) { if (!this.down.has(a)) { this.down.add(a); this.pressedSet.add(a); } }
  _release(a) { if (this.down.has(a)) { this.down.delete(a); this.releasedSet.add(a); } }
  // called by the touch UI
  touchPress(a) { this.mode = 'touch'; this._press(a); }
  touchRelease(a) { this._release(a); }

  held(a) { return this.enabled && this.down.has(a); }
  pressed(a) { return this.enabled && this.pressedSet.has(a); }
  released(a) { return this.releasedSet.has(a); }
  // menu keys work even while the game input is disabled
  pressedAny(a) { return this.pressedSet.has(a); }

  // Called once per frame BEFORE game logic.
  poll(dt) {
    this.pollPad(dt);
    let mx = 0, my = 0;
    if (this.down.has('fwd')) my += 1;
    if (this.down.has('back')) my -= 1;
    if (this.down.has('right')) mx += 1;
    if (this.down.has('left')) mx -= 1;
    mx += this.touch.move.x + (this.pad ? this.pad.mx : 0);
    my += this.touch.move.y + (this.pad ? this.pad.my : 0);
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = this.enabled ? mx : 0; this.move.y = this.enabled ? my : 0;
    this.look.x += this.touch.look.x; this.look.y += this.touch.look.y;
    this.touch.look.x = 0; this.touch.look.y = 0;
  }

  // Called once per frame AFTER game logic.
  endFrame() {
    this.pressedSet.clear(); this.releasedSet.clear();
    this.look.x = 0; this.look.y = 0; this.scroll = 0;
  }

  pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const g of pads) if (g && g.connected) { p = g; break; }
    if (!p) { this.pad = null; return; }
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const ax = p.axes;
    const mx = dz(ax[0] || 0), my = -dz(ax[1] || 0), lx = dz(ax[2] || 0), ly = dz(ax[3] || 0);
    this.pad = { mx, my };
    const speed = 900 * dt;
    if (lx || ly) { this.look.x += Math.sign(lx) * lx * lx * speed; this.look.y += Math.sign(ly) * ly * ly * speed; }
    // standard mapping
    const map = {
      0: 'jump', 1: 'crouch', 2: 'use', 3: 'spawn', 4: 'shrink', 5: 'grow', 6: 'alt', 7: 'fire',
      8: 'phone', 9: 'pause', 10: 'sprint', 11: 'camera', 14: 'slotPrev', 15: 'slotNext',
    };
    const btn = p.buttons;
    let any = false;
    for (const i in map) {
      const b = btn[i]; if (!b) continue;
      const on = b.pressed || b.value > 0.4;
      if (on) any = true;
      if (on && !this.padPrev[i]) this._press(map[i]);
      if (!on && this.padPrev[i]) this._release(map[i]);
      this.padPrev[i] = on;
    }
    if (btn[12] && btn[12].pressed && !this.padPrev[12]) this.scroll -= 1;
    if (btn[13] && btn[13].pressed && !this.padPrev[13]) this.scroll += 1;
    this.padPrev[12] = btn[12] && btn[12].pressed; this.padPrev[13] = btn[13] && btn[13].pressed;
    if (any || mx || my || lx || ly) this.mode = 'pad';
  }
}

export const input = new Input();
