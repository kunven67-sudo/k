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

  // which physical key makes this character (so typed text looks like real key presses)
  const PUNCT = { '-': ['Minus', 189], '_': ['Minus', 189, 1], '=': ['Equal', 187], '+': ['Equal', 187, 1], '.': ['Period', 190], ',': ['Comma', 188], '/': ['Slash', 191], '?': ['Slash', 191, 1],
    "'": ['Quote', 222], '"': ['Quote', 222, 1], ';': ['Semicolon', 186], ':': ['Semicolon', 186, 1], '!': ['Digit1', 49, 1], '@': ['Digit2', 50, 1], '#': ['Digit3', 51, 1], '$': ['Digit4', 52, 1],
    '%': ['Digit5', 53, 1], '&': ['Digit7', 55, 1], '*': ['Digit8', 56, 1], '(': ['Digit9', 57, 1], ')': ['Digit0', 48, 1], '<': ['Comma', 188, 1], '>': ['Period', 190, 1] };
  function charKey(ch) {
    if (ch === ' ') return { code: 'Space', keyCode: 32 };
    if (/^[a-z]$/i.test(ch)) { const up = ch.toUpperCase(); return { code: 'Key' + up, keyCode: up.charCodeAt(0), shift: ch !== ch.toLowerCase() }; }
    if (/^[0-9]$/.test(ch)) return { code: 'Digit' + ch, keyCode: 48 + Number(ch) };
    const p = PUNCT[ch];
    return p ? { code: p[0], keyCode: p[1], shift: !!p[2] } : { code: '', keyCode: 0 };
  }
  // fat-finger typos hit a key right next to the right one
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  function neighbor(ch) {
    const lo = ch.toLowerCase();
    for (const r of ROWS) { const i = r.indexOf(lo); if (i >= 0) { const n = r[i + (i === 0 ? 1 : i === r.length - 1 ? -1 : Math.random() < 0.5 ? -1 : 1)]; return ch === lo ? n : n.toUpperCase(); } }
    return ch;
  }

  class Hands {
    constructor(cursorEl) {
      this.cursorEl = cursorEl;
      this.held = new Set();
      this.repeatAt = {};
      this.mx = 0.5; this.my = 0.5; // cursor, 0..1 of the game view
      this.mouseDown = false;
      this.win = null;
    }
    attach(win) { this.stopTyping(); this.win = win; this.held.clear(); this.mouseDown = false; this.mx = 0.5; this.my = 0.5; this.drawCursor(); }
    get doc() { try { return this.win && this.win.document; } catch (e) { return null; } }

    keyTarget() {
      const d = this.doc;
      if (!d) return null;
      let ae = d.activeElement;
      // a hidden text box still holding the keyboard would swallow every key - let go of it
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !this.typeJob) {
        let hidden = false;
        try { const r = ae.getBoundingClientRect(); hidden = !ae.getClientRects().length || r.width < 2 || r.bottom <= 0 || r.top >= this.win.innerHeight || r.right <= 0 || r.left >= this.win.innerWidth || this.win.getComputedStyle(ae).visibility === 'hidden'; } catch (e) { /* ignore */ }
        if (hidden) { try { ae.blur(); } catch (e) { /* ignore */ } ae = d.activeElement; }
      }
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

    /* ---------- ⌨️ typing real text ---------- */
    // Types text letter by letter like a person. el = the text box (null = just the keyboard, for typing games).
    // opts: { delay: ms per letter, typo: chance of a typo (it fixes it with Backspace), clear: empty the box first }
    typeText(text, el, opts) {
      opts = opts || {};
      this.stopTyping();
      const job = this.typeJob = { cancelled: false, i: 0, typos: 0 };
      const chars = [...String(text)];
      return new Promise((resolve) => {
        const finish = (ok) => { if (this.typeJob === job) this.typeJob = null; resolve(ok ? job : null); };
        if (!this.win) { finish(false); return; }
        if (el) { this.clickElement(el); if (opts.clear) this.clearField(el); }
        let fixTypo = false;
        const later = (mul) => setTimeout(step, (opts.delay || 110) * (mul || 1) * (0.6 + Math.random() * 0.8));
        const step = () => {
          if (job.cancelled || !this.win || (el && !el.isConnected)) { finish(false); return; }
          if (fixTypo) { fixTypo = false; this.typeKey('Backspace', el); later(1.2); return; }
          if (job.i >= chars.length) { finish(true); return; }
          const ch = chars[job.i];
          if (el && opts.typo && /[a-z]/i.test(ch) && Math.random() < opts.typo) { this.typeChar(neighbor(ch), el); job.typos++; fixTypo = true; later(2.2); return; }
          this.typeChar(ch, el);
          job.i++;
          later();
        };
        later(2.5);
      });
    }
    stopTyping() { if (this.typeJob) this.typeJob.cancelled = true; this.typeJob = null; }
    get typing() { return !!this.typeJob; }

    keyEvent(type, ch, k, t, extra) {
      const w = this.win;
      const ev = new w.KeyboardEvent(type, Object.assign({ key: ch, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true, composed: true, view: w, shiftKey: !!k.shift }, extra || {}));
      t.dispatchEvent(ev);
      return !ev.defaultPrevented;
    }
    // one letter: keydown -> keypress -> (the letter shows up in the box) -> keyup.
    // If the game blocks the key (preventDefault), the letter doesn't go in - just like a real browser.
    typeChar(ch, el) {
      const k = charKey(ch), t = el || this.keyTarget();
      if (!this.win || !t) return;
      try {
        let ok = this.keyEvent('keydown', ch, k, t);
        const cc = ch.charCodeAt(0);
        if (ok) ok = this.keyEvent('keypress', ch, k, t, { keyCode: cc, which: cc, charCode: cc });
        if (ok && el) this.insertText(el, ch);
        this.keyEvent('keyup', ch, k, t);
      } catch (e) { /* game gone */ }
    }
    // special keys while typing (Backspace / Enter / Tab) aimed at the text box
    typeKey(code, el) {
      const K = KEYS[code], t = el || this.keyTarget();
      if (!K || !this.win || !t) return false;
      let ok = false;
      try {
        ok = this.keyEvent('keydown', K.key, K, t);
        if (ok && code === 'Enter') ok = this.keyEvent('keypress', 'Enter', K, t, { charCode: 13 });
        if (ok && el && code === 'Backspace') this.deleteBack(el);
        this.keyEvent('keyup', K.key, K, t);
      } catch (e) { /* ignore */ }
      return ok;
    }
    // press Enter in the box. A box inside a <form> gets "submitted" like a real browser does
    // (as an event only - the page never actually navigates away).
    submit(el) {
      const ok = this.typeKey('Enter', el);
      if (ok && el && el.form && el.tagName === 'INPUT') {
        try { const w = this.win; const ev = w.SubmitEvent ? new w.SubmitEvent('submit', { bubbles: true, cancelable: true }) : new w.Event('submit', { bubbles: true, cancelable: true }); el.form.dispatchEvent(ev); } catch (e) { /* ignore */ }
      }
      return ok;
    }
    setValue(el, v) {
      const w = this.win;
      const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
      const d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d && d.set) d.set.call(el, v); else el.value = v; // (the real setter, so React-style games notice too)
    }
    insertText(el, str) {
      const w = this.win;
      try {
        if (!el.dispatchEvent(new w.InputEvent('beforeinput', { inputType: 'insertText', data: str, bubbles: true, cancelable: true, composed: true }))) return;
        if (el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.appendChild(el.ownerDocument.createTextNode(str));
        else {
          const cur = String(el.value || '');
          if (el.maxLength > 0 && cur.length >= el.maxLength) return;
          this.setValue(el, cur + str);
        }
        el.dispatchEvent(new w.InputEvent('input', { inputType: 'insertText', data: str, bubbles: true, composed: true }));
      } catch (e) { /* ignore */ }
    }
    deleteBack(el) {
      const w = this.win;
      try {
        if (!el.dispatchEvent(new w.InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true, composed: true }))) return;
        if (el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = (el.textContent || '').slice(0, -1);
        else this.setValue(el, String(el.value || '').slice(0, -1));
        el.dispatchEvent(new w.InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true, composed: true }));
      } catch (e) { /* ignore */ }
    }
    clearField(el) {
      const w = this.win;
      try {
        const has = el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' ? (el.textContent || '') : String(el.value || '');
        if (!has) return;
        if (el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = '';
        else this.setValue(el, '');
        el.dispatchEvent(new w.InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true, composed: true }));
      } catch (e) { /* ignore */ }
    }

    /* ---------- mouse ---------- */
    px() { const w = this.win; return { x: this.mx * (w ? w.innerWidth : 1), y: this.my * (w ? w.innerHeight : 1) }; }
    mouseTarget(x, y) {
      const d = this.doc;
      if (!d) return null;
      const lock = this.win.__aip && this.win.__aip.lockEl;
      const at = d.elementFromPoint(clamp(x, 0, this.win.innerWidth - 1), clamp(y, 0, this.win.innerHeight - 1)) || d.body;
      if (lock && lock.isConnected) {
        // mouse "captured" by the 3D view - but a real menu button on top still gets the click
        const ui = at && at !== lock && !lock.contains(at) && at.closest && at.closest('button,a[href],[role="button"],input,select,textarea,label,[onclick],.btn,.button,[data-act],[data-go],[data-tab],[data-action]');
        return ui || lock;
      }
      return at;
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
      // (moving the pointer to a spot shouldn't spin a 3D camera - turning is look()'s job)
      const locked = !!(this.win && this.win.__aip && this.win.__aip.lockEl);
      const extra = locked ? { movementX: 0, movementY: 0 } : { movementX: Math.round(p.x - before.x), movementY: Math.round(p.y - before.y) };
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
