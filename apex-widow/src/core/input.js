// Keyboard + mouse with rebindable actions and pointer lock.
export const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', jump: 'Space', eat: 'KeyE', swing: 'KeyF', lock: 'KeyQ', vision: 'KeyV',
  molt: 'KeyM', lair: 'KeyL', rest: 'KeyR', map: 'Tab', babies: 'KeyB', dodge: 'KeyC', drop: 'KeyX',
  p1: 'Digit1', p2: 'Digit2', p3: 'Digit3', p4: 'Digit4', pause: 'Escape', cam: 'KeyH',
};
export const BIND_NAMES = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', sprint: 'Sprint',
  jump: 'Jump / pounce', eat: 'Eat / wrap', swing: 'Web swing / zip', lock: 'Lock on', vision: 'Hunter vision',
  molt: 'Molt', lair: 'Make lair here', rest: 'Rest + save (at lair)', map: 'Map + evolution tree', babies: 'Command babies',
  dodge: 'Dodge roll', drop: 'Drop on a silk line', p1: 'Power 1', p2: 'Power 2', p3: 'Power 3', p4: 'Power 4', cam: 'Inspect cam',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();   // went down this frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, l: false, r: false, lPressed: false, rPressed: false, lReleased: false, rReleased: false, x: 0, y: 0 };
    this.locked = false;
    this.enabled = true;
    this.sens = 1; this.invertY = false;
    this.binds = { ...DEFAULT_BINDS };
    try { Object.assign(this.binds, JSON.parse(localStorage.getItem('aw.binds') || '{}')); } catch (e) {}
    this.capture = null; // rebind callback
    addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const c = this.capture; this.capture = null; c(e.code); return; }
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.mouse.l = this.mouse.r = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.l = true; this.mouse.lPressed = true; }
      if (e.button === 2) { this.mouse.r = true; this.mouse.rPressed = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.mouse.l) { this.mouse.l = false; this.mouse.lReleased = true; }
      if (e.button === 2 && this.mouse.r) { this.mouse.r = false; this.mouse.rReleased = true; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (!this.locked) return;
      // ignore the giant jumps some browsers send right after locking
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
    });
    addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (this.onLockChange) this.onLockChange(this.locked); });
  }
  lock() { if (!this.locked && this.canvas.requestPointerLock) { try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) {} }); } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) {} } } }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
  is(action) { return this.down.has(this.binds[action]) || (action === 'sprint' && this.down.has('ShiftRight')); }
  hit(action) { return this.pressed.has(this.binds[action]); }
  up(action) { return this.released.has(this.binds[action]); }
  setBind(action, code) { this.binds[action] = code; try { localStorage.setItem('aw.binds', JSON.stringify(this.binds)); } catch (e) {} }
  resetBinds() { this.binds = { ...DEFAULT_BINDS }; try { localStorage.removeItem('aw.binds'); } catch (e) {} }
  // call at the very end of each frame
  endFrame() {
    this.pressed.clear(); this.released.clear();
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
    this.mouse.lPressed = this.mouse.rPressed = this.mouse.lReleased = this.mouse.rReleased = false;
  }
}
