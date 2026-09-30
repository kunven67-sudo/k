// Input: keyboard + mouse (pointer lock) + gamepads, through named actions.
// Every action can be rebound in settings (controls.bindings = { action: ['KeyW', ...] }).

export const ACTIONS = {
  moveForward: { label: 'Move forward', keys: ['KeyW', 'ArrowUp'] },
  moveBack: { label: 'Move back', keys: ['KeyS', 'ArrowDown'] },
  moveLeft: { label: 'Move left', keys: ['KeyA', 'ArrowLeft'] },
  moveRight: { label: 'Move right', keys: ['KeyD', 'ArrowRight'] },
  sprint: { label: 'Sprint', keys: ['ShiftLeft'], pad: ['LS'] },
  crouch: { label: 'Crouch', keys: ['ControlLeft', 'KeyC'], pad: ['RS'] },
  jump: { label: 'Jump', keys: ['Space'], pad: ['A'] },
  interact: { label: 'Use / grab', keys: ['KeyE'], pad: ['X'] },
  shrinkSelf: { label: 'Shrink into cage', keys: ['KeyF'], pad: ['Y'] },
  camera: { label: 'Switch 1st/3rd person', keys: ['KeyV'], pad: ['Back'] },
  primary: { label: 'Use gadget (hold to charge)', keys: ['Mouse0'], pad: ['RT'] },
  secondary: { label: 'Aim / alt fire', keys: ['Mouse2'], pad: ['LT'] },
  reload: { label: 'Reload', keys: ['KeyR'], pad: ['B'] },
  nextItem: { label: 'Next item', keys: ['WheelDown', 'KeyQ'], pad: ['RB'] },
  prevItem: { label: 'Previous item', keys: ['WheelUp'], pad: ['LB'] },
  talk: { label: 'Talk (hold for mic)', keys: ['KeyT'], pad: ['DUp'] },
  chat: { label: 'Type a message', keys: ['Enter'] },
  phone: { label: 'Phone', keys: ['KeyP'], pad: ['DDown'] },
  inventory: { label: 'Inventory', keys: ['Tab', 'KeyI'], pad: ['DLeft'] },
  map: { label: 'Map', keys: ['KeyM'], pad: ['DRight'] },
  pause: { label: 'Pause menu', keys: ['Escape'], pad: ['Start'] },
  item1: { label: 'Hotbar 1', keys: ['Digit1'] },
  item2: { label: 'Hotbar 2', keys: ['Digit2'] },
  item3: { label: 'Hotbar 3', keys: ['Digit3'] },
  item4: { label: 'Hotbar 4', keys: ['Digit4'] },
  item5: { label: 'Hotbar 5', keys: ['Digit5'] },
  quickSave: { label: 'Quick save', keys: ['F5'] },
  quickLoad: { label: 'Quick load', keys: ['F9'] },
};

// standard gamepad mapping (https://w3c.github.io/gamepad/#remapping)
const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'DUp', 'DDown', 'DLeft', 'DRight', 'Home'];

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return {
    Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
    WheelUp: 'Wheel up', WheelDown: 'Wheel down', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', Space: 'Space', Escape: 'Esc',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  }[code] || code;
}

export class Input {
  constructor(target, settings) {
    this.target = target;
    this.settings = settings;
    this.down = new Set();        // raw codes held now
    this.pressedCodes = new Set(); // raw codes pressed since last frame
    this.releasedCodes = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.padState = { buttons: new Set(), pressed: new Set(), released: new Set(), lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };
    this.lastDevice = 'keyboard';
    this.enabled = true;          // false while typing in chat / menus take over
    this.listening = null;        // rebinding capture callback
    this.onKeyDown = (e) => this.handleKey(e, true);
    this.onKeyUp = (e) => this.handleKey(e, false);
    this.onMouseDown = (e) => this.press(`Mouse${e.button}`, true, e);
    this.onMouseUp = (e) => this.press(`Mouse${e.button}`, false, e);
    this.onMouseMove = (e) => {
      if (document.pointerLockElement !== this.target) return;
      // ignore the huge spikes some browsers send right after locking
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
      this.lastDevice = 'keyboard';
    };
    this.onWheel = (e) => {
      const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
      this.press(code, true, e);
      // wheel has no "up" event: release next frame
      this.wheelRelease = code;
    };
    this.onBlur = () => this.clear();
    this.onContextMenu = (e) => e.preventDefault();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.target.removeEventListener('wheel', this.onWheel);
    this.target.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
  }

  handleKey(e, isDown) {
    // typing in a text box (chat, save names) never moves the player
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (isDown && e.repeat) { e.preventDefault(); return; }
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F5', 'F9'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
    this.press(e.code, isDown, e);
  }

  press(code, isDown, e) {
    if (this.listening && isDown) {
      const fn = this.listening;
      this.listening = null;
      e?.preventDefault?.();
      fn(code === 'Escape' ? null : code);
      return;
    }
    this.lastDevice = 'keyboard';
    if (isDown) {
      if (!this.down.has(code)) this.pressedCodes.add(code);
      this.down.add(code);
    } else {
      if (this.down.has(code)) this.releasedCodes.add(code);
      this.down.delete(code);
    }
  }

  clear() {
    for (const c of this.down) this.releasedCodes.add(c);
    this.down.clear();
  }

  // rebinding: resolves with the next key/mouse code pressed (null = cancelled with Esc)
  captureNext() {
    return new Promise((resolve) => { this.listening = resolve; });
  }

  keysFor(action) {
    const custom = this.settings?.get('controls.bindings')?.[action];
    return Array.isArray(custom) ? custom : ACTIONS[action]?.keys || [];
  }

  isDown(action) {
    if (!this.enabled) return false;
    if (this.keysFor(action).some((k) => this.down.has(k))) return true;
    return (ACTIONS[action]?.pad || []).some((b) => this.padState.buttons.has(b));
  }

  pressed(action) {
    if (!this.enabled) return false;
    if (this.keysFor(action).some((k) => this.pressedCodes.has(k))) return true;
    return (ACTIONS[action]?.pad || []).some((b) => this.padState.pressed.has(b));
  }

  released(action) {
    if (this.keysFor(action).some((k) => this.releasedCodes.has(k))) return true;
    return (ACTIONS[action]?.pad || []).some((b) => this.padState.released.has(b));
  }

  // -1..1 movement from keys or the left stick
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    let y = (this.isDown('moveForward') ? 1 : 0) - (this.isDown('moveBack') ? 1 : 0);
    const p = this.padState;
    if (Math.hypot(p.lx, p.ly) > 0) { x = p.lx; y = -p.ly; }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  // camera look delta in radians for this frame
  lookDelta(dt) {
    const c = this.settings?.get('controls') || {};
    const mouse = 0.0022 * (c.mouseSensitivity ?? 1);
    let dx = this.mouseDX * mouse;
    let dy = this.mouseDY * mouse;
    const pad = 3.2 * (c.gamepadSensitivity ?? 1) * dt;
    dx += this.padState.rx * pad;
    dy += this.padState.ry * pad;
    if (c.invertY) dy = -dy;
    return this.enabled ? { x: dx, y: dy } : { x: 0, y: 0 };
  }

  pollGamepads() {
    const p = this.padState;
    const prev = p.buttons;
    const now = new Set();
    p.lx = p.ly = p.rx = p.ry = p.lt = p.rt = 0;
    const dead = this.settings?.get('controls.gamepadDeadzone') ?? 0.15;
    const axis = (v) => (Math.abs(v) < dead ? 0 : Math.sign(v) * (Math.abs(v) - dead) / (1 - dead));
    for (const gp of navigator.getGamepads?.() || []) {
      if (!gp || !gp.connected) continue;
      const [lx = 0, ly = 0, rx = 0, ry = 0] = gp.axes;
      if (Math.abs(axis(lx)) + Math.abs(axis(ly)) > Math.abs(p.lx) + Math.abs(p.ly)) { p.lx = axis(lx); p.ly = axis(ly); }
      if (Math.abs(axis(rx)) + Math.abs(axis(ry)) > Math.abs(p.rx) + Math.abs(p.ry)) { p.rx = axis(rx); p.ry = axis(ry); }
      gp.buttons.forEach((b, i) => {
        const name = PAD_BUTTONS[i];
        if (!name) return;
        const v = typeof b === 'object' ? b.value : b;
        if (name === 'LT') p.lt = Math.max(p.lt, v);
        if (name === 'RT') p.rt = Math.max(p.rt, v);
        if (b.pressed || v > 0.5) now.add(name);
      });
    }
    p.pressed = new Set([...now].filter((b) => !prev.has(b)));
    p.released = new Set([...prev].filter((b) => !now.has(b)));
    p.buttons = now;
    if (now.size || p.lx || p.ly || p.rx || p.ry) this.lastDevice = 'gamepad';
  }

  // call once per frame BEFORE game logic
  beginFrame() {
    this.pollGamepads();
  }

  // call once per frame AFTER game logic
  endFrame() {
    this.pressedCodes.clear();
    this.releasedCodes.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    if (this.wheelRelease) {
      this.down.delete(this.wheelRelease);
      this.wheelRelease = null;
    }
  }

  lockPointer() {
    if (document.pointerLockElement !== this.target) this.target.requestPointerLock?.()?.catch?.(() => {});
  }
}
