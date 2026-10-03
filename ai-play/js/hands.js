/* AI Play - the AI's HANDS. Presses keys and moves/clicks the mouse inside the game. */
'use strict';

AIP.KEYS = (function () {
  const K = {};
  const add = (code, key, keyCode, label) => { K[code] = { code, key, keyCode, label: label || key.toUpperCase() }; };
  for (let i = 0; i < 26; i++) { const c = String.fromCharCode(65 + i); add('Key' + c, c.toLowerCase(), 65 + i, c); }
  for (let i = 0; i < 10; i++) add('Digit' + i, String(i), 48 + i, String(i));
  add('ArrowLeft', 'ArrowLeft', 37, '←'); add('ArrowUp', 'ArrowUp', 38, '↑'); add('ArrowRight', 'ArrowRight', 39, '→'); add('ArrowDown', 'ArrowDown', 40, '↓');
  add('Space', ' ', 32, 'Space'); add('Enter', 'Enter', 13, 'Enter'); add('Escape', 'Escape', 27, 'Esc'); add('Tab', 'Tab', 9, 'Tab');
  add('ShiftLeft', 'Shift', 16, 'Shift'); add('ControlLeft', 'Control', 17, 'Ctrl'); add('Backspace', 'Backspace', 8, '⌫');
  // The order a curious newbie would try keys in: the usual game keys first, weird ones last.
  const order = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter', 'KeyZ', 'KeyX', 'KeyJ', 'KeyK', 'KeyE', 'KeyQ',
    'KeyF', 'KeyR', 'ShiftLeft', 'KeyC', 'KeyL', 'Digit1', 'Digit2', 'Digit3', 'KeyV', 'KeyI', 'KeyP', 'KeyM', 'KeyH', 'KeyT', 'KeyG', 'KeyB', 'KeyN', 'KeyO', 'KeyU', 'KeyY',
    'Digit4', 'Digit5', 'ControlLeft', 'Tab', 'Escape', 'Backspace', 'Digit0', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
  Object.keys(K).forEach((c) => { if (order.indexOf(c) < 0) order.push(c); });
  // "type a key name" -> code (used by chat tips)
  const alias = { space: 'Space', spacebar: 'Space', enter: 'Enter', return: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', shift: 'ShiftLeft', ctrl: 'ControlLeft', control: 'ControlLeft',
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', 'left arrow': 'ArrowLeft', 'right arrow': 'ArrowRight', 'up arrow': 'ArrowUp', 'down arrow': 'ArrowDown',
    'arrow left': 'ArrowLeft', 'arrow right': 'ArrowRight', 'arrow up': 'ArrowUp', 'arrow down': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown', backspace: 'Backspace' };
  function fromName(name) {
    const n = String(name).toLowerCase().trim();
    if (alias[n]) return alias[n];
    if (/^[a-z]$/.test(n)) return 'Key' + n.toUpperCase();
    if (/^[0-9]$/.test(n)) return 'Digit' + n;
    const direct = Object.keys(K).find((c) => c.toLowerCase() === n);
    return direct || null;
  }
  return { map: K, order, fromName, label: (c) => (K[c] ? K[c].label : c) };
})();

AIP.Hands = (function () {
  const { clamp } = AIP.util;
  const KEYS = AIP.KEYS.map;

  class Hands {
    constructor(cursorEl) {
      this.cursorEl = cursorEl;
      this.held = new Set();
      this.repeatAt = {};
      this.mx = 0.5; this.my = 0.5; // cursor, 0..1 of the game view
      this.mouseDown = false;
      this.win = null;
    }
    attach(win) { this.win = win; this.held.clear(); this.mouseDown = false; this.mx = 0.5; this.my = 0.5; this.drawCursor(); }
    get doc() { try { return this.win && this.win.document; } catch (e) { return null; } }

    keyTarget() {
      const d = this.doc;
      if (!d) return null;
      const ae = d.activeElement;
      if (ae && ae !== d.body && ae !== d.documentElement && ae.tagName !== 'IFRAME') return ae;
      return d.body || d.documentElement;
    }
    fireKey(type, code, repeat) {
      const k = KEYS[code], w = this.win, t = this.keyTarget();
      if (!k || !w || !t) return;
      try {
        const ev = new w.KeyboardEvent(type, {
          key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, charCode: type === 'keypress' ? k.key.charCodeAt(0) : 0,
          bubbles: true, cancelable: true, composed: true, repeat: !!repeat, view: w,
          shiftKey: this.held.has('ShiftLeft'), ctrlKey: this.held.has('ControlLeft'),
        });
        t.dispatchEvent(ev);
      } catch (e) { /* game gone */ }
    }
    // Hold exactly these keys (press new ones, let go of the rest).
    setKeys(codes) {
      const want = new Set(codes || []);
      for (const c of [...this.held]) if (!want.has(c)) { this.held.delete(c); this.fireKey('keyup', c); }
      const now = performance.now();
      for (const c of want) if (!this.held.has(c)) {
        this.held.add(c);
        this.fireKey('keydown', c, false);
        if (KEYS[c] && KEYS[c].key.length === 1) this.fireKey('keypress', c, false);
        this.repeatAt[c] = now + 420;
      }
    }
    // Real keyboards repeat a held key - some games need that.
    tick() {
      const now = performance.now();
      for (const c of this.held) if (now >= (this.repeatAt[c] || 0)) { this.fireKey('keydown', c, true); this.repeatAt[c] = now + 60; }
    }
    tap(code) { this.fireKey('keydown', code, false); setTimeout(() => this.fireKey('keyup', code), 70); }
    releaseAll() {
      this.setKeys([]);
      if (this.mouseDown) this.mouseUp();
    }

    /* ---------- mouse ---------- */
    px() { const w = this.win; return { x: this.mx * (w ? w.innerWidth : 1), y: this.my * (w ? w.innerHeight : 1) }; }
    mouseTarget(x, y) {
      const d = this.doc;
      if (!d) return null;
      const lock = this.win.__aip && this.win.__aip.lockEl;
      if (lock && lock.isConnected) return lock;
      return d.elementFromPoint(clamp(x, 0, this.win.innerWidth - 1), clamp(y, 0, this.win.innerHeight - 1)) || d.body;
    }
    fireMouse(type, x, y, extra) {
      const w = this.win, t = this.mouseTarget(x, y);
      if (!w || !t) return null;
      const init = Object.assign({ bubbles: true, cancelable: true, composed: true, view: w, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: this.mouseDown ? 1 : 0 }, extra || {});
      try {
        if (type.indexOf('pointer') === 0) t.dispatchEvent(new w.PointerEvent(type, Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, init)));
        else t.dispatchEvent(new w.MouseEvent(type, init));
      } catch (e) { /* ignore */ }
      return t;
    }
    moveTo(fx, fy) {
      const before = this.px();
      this.mx = clamp(fx, 0, 1); this.my = clamp(fy, 0, 1);
      const p = this.px();
      const extra = { movementX: Math.round(p.x - before.x), movementY: Math.round(p.y - before.y) };
      this.fireMouse('pointermove', p.x, p.y, extra);
      this.fireMouse('mousemove', p.x, p.y, extra);
      this.drawCursor();
    }
    // Turn the camera in 3D games (mouse moves without the cursor going anywhere).
    look(dx, dy) {
      const p = this.px();
      const extra = { movementX: Math.round(dx), movementY: Math.round(dy) };
      this.fireMouse('pointermove', p.x, p.y, extra);
      this.fireMouse('mousemove', p.x, p.y, extra);
    }
    mouseDownNow() {
      if (this.mouseDown) return;
      const p = this.px();
      this.mouseDown = true;
      this.fireMouse('pointerdown', p.x, p.y, { buttons: 1 });
      const t = this.fireMouse('mousedown', p.x, p.y, { buttons: 1 });
      this.downTarget = t;
      try { if (t && t.focus && (t.tabIndex >= 0 || /^(BUTTON|INPUT|A|SELECT|TEXTAREA)$/.test(t.tagName))) t.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      this.drawCursor(true);
    }
    mouseUp() {
      if (!this.mouseDown) return;
      const p = this.px();
      this.mouseDown = false;
      this.fireMouse('pointerup', p.x, p.y, { buttons: 0 });
      const t = this.fireMouse('mouseup', p.x, p.y, { buttons: 0 });
      if (t && this.downTarget && (t === this.downTarget || t.contains(this.downTarget) || this.downTarget.contains(t))) this.fireMouse('click', p.x, p.y, { buttons: 0, detail: 1 });
      this.drawCursor(false);
    }
    click() { this.mouseDownNow(); setTimeout(() => this.mouseUp(), 60); }
    clickAt(fx, fy) { this.moveTo(fx, fy); this.click(); }
    clickElement(el) {
      try {
        const r = el.getBoundingClientRect();
        const w = this.win;
        this.clickAt((r.left + r.width / 2) / w.innerWidth, (r.top + r.height / 2) / w.innerHeight);
      } catch (e) { /* gone */ }
    }

    drawCursor(pressed) {
      const c = this.cursorEl;
      if (!c) return;
      c.style.left = (this.mx * 100) + '%';
      c.style.top = (this.my * 100) + '%';
      if (pressed === true) { c.classList.add('down'); c.classList.remove('ripple'); void c.offsetWidth; c.classList.add('ripple'); }
      if (pressed === false) c.classList.remove('down');
    }
  }
  return Hands;
})();
