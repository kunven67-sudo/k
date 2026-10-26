// Global keyboard/mouse hook (uiohook). Used only to *react* to presses:
// play a typing sound, draw click effects, and push-to-talk. Nothing is
// recorded or saved.
let hook = null;
let keyCodes = null;
try {
  const mod = require('uiohook-napi');
  hook = mod.uIOhook;
  keyCodes = mod.UiohookKey;
} catch (err) {
  console.error('[input] global hook unavailable:', err.message);
}

// A held key repeats keydown every ~30ms; a gap this long means a new press
// (covers a keyup we never saw, e.g. after a UAC prompt).
const REPEAT_GAP_MS = 1100;

class InputHook {
  constructor(handlers) {
    this.h = handlers; // { key(kind, code), keyUp(code), mouse(button), pttKey(down, code, isMouse) }
    this.running = false;
    this.down = new Map();
    if (!hook) return;
    hook.on('keydown', (e) => {
      const now = Date.now();
      const last = this.down.get(e.keycode);
      this.down.set(e.keycode, now);
      this.h.ptt?.(true, e.keycode, false);
      if (last !== undefined && now - last < REPEAT_GAP_MS) return;
      this.h.key?.(classify(e.keycode), e.keycode);
    });
    hook.on('keyup', (e) => {
      this.down.delete(e.keycode);
      this.h.ptt?.(false, e.keycode, false);
      this.h.keyUp?.(classify(e.keycode), e.keycode);
    });
    hook.on('mousedown', (e) => {
      this.h.ptt?.(true, e.button, true);
      this.h.mouse?.(e.button);
    });
    hook.on('mouseup', (e) => this.h.ptt?.(false, e.button, true));
  }

  get available() { return !!hook; }

  setRunning(on) {
    if (!hook || on === this.running) return;
    try {
      if (on) hook.start(); else hook.stop();
      this.running = on;
      if (!on) this.down.clear();
    } catch (err) {
      console.error('[input] could not', on ? 'start' : 'stop', 'hook:', err.message);
    }
  }
}

function classify(code) {
  if (!keyCodes) return 'key';
  if (code === keyCodes.Space) return 'space';
  if (code === keyCodes.Enter || code === 3612 /* numpad enter */) return 'enter';
  if (code === keyCodes.Backspace) return 'backspace';
  if ([keyCodes.Shift, keyCodes.ShiftRight, keyCodes.Ctrl, keyCodes.CtrlRight, keyCodes.Alt, keyCodes.AltRight, keyCodes.Meta, keyCodes.MetaRight].includes(code)) return 'modifier';
  return 'key';
}

// Key names for the push-to-talk picker.
function keyName(code) {
  if (!keyCodes) return `Key ${code}`;
  for (const [name, c] of Object.entries(keyCodes)) if (c === code) return name;
  return `Key ${code}`;
}

module.exports = { InputHook, keyName };
