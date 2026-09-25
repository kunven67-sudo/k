// Keyboard / mouse state with per-frame "pressed" edges, pointer lock and button mashing detection.
import { getSettings } from './settings.js';

const down = new Set();
const pressed = new Set();
const released = new Set();
const counts = new Map();
let mouseDX = 0, mouseDY = 0, wheel = 0;
let mouseDown = [false, false, false];
let mousePressed = [false, false, false];
let mouseReleased = [false, false, false];
let canvasEl = null;
let lockWanted = false;
const lockListeners = new Set();
const mashTimes = [];

export const input = {
  get locked() { return document.pointerLockElement === canvasEl; },
  enabled: true,

  init(canvas) {
    canvasEl = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = norm(e);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(k) && document.activeElement === document.body) e.preventDefault();
      if (!down.has(k)) pressed.add(k);
      counts.set(k, (counts.get(k) || 0) + 1);
      down.add(k);
      if (k === 'KeyE') { mashTimes.push(performance.now()); if (mashTimes.length > 20) mashTimes.shift(); }
    });
    window.addEventListener('keyup', (e) => { const k = norm(e); down.delete(k); released.add(k); });
    window.addEventListener('blur', () => { down.clear(); mouseDown = [false, false, false]; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvasEl) { mouseDX += e.movementX; mouseDY += e.movementY; }
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button < 3) { mouseDown[e.button] = true; mousePressed[e.button] = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) { mouseDown[e.button] = false; mouseReleased[e.button] = true; }
    });
    window.addEventListener('wheel', (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('contextmenu', (e) => { if (document.pointerLockElement === canvasEl) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => lockListeners.forEach((fn) => fn(input.locked)));
  },

  requestLock() {
    lockWanted = true;
    if (canvasEl && document.pointerLockElement !== canvasEl) {
      try {
        const p = canvasEl.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* not allowed right now */ }
    }
  },
  exitLock() { lockWanted = false; if (document.pointerLockElement) document.exitPointerLock(); },
  onLockChange(fn) { lockListeners.add(fn); return () => lockListeners.delete(fn); },

  isDown(code) { return this.enabled && down.has(code); },
  wasPressed(code) { return this.enabled && pressed.has(code); },
  // Number of separate key presses since last frame (for button mashing at any frame rate).
  pressCount(code) { return this.enabled ? (counts.get(code) || 0) : 0; },
  wasReleased(code) { return released.has(code); },
  mouse(btn = 0) { return this.enabled && mouseDown[btn]; },
  mousePressed(btn = 0) { return this.enabled && mousePressed[btn]; },
  mouseReleased(btn = 0) { return mouseReleased[btn]; },

  // Look deltas already scaled by the sensitivity setting (radians).
  look() {
    const s = getSettings();
    const k = 0.0022 * s.sensitivity;
    return { x: mouseDX * k, y: mouseDY * k * (s.invertY ? -1 : 1) };
  },
  wheel() { return wheel; },

  axis() {
    if (!this.enabled) return { x: 0, z: 0 };
    let x = 0, z = 0;
    if (down.has('KeyW') || down.has('ArrowUp')) z += 1;
    if (down.has('KeyS') || down.has('ArrowDown')) z -= 1;
    if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
    return { x, z };
  },

  // E presses per second over the last `windowMs` - drives the button-mash climbs.
  mashRate(windowMs = 1000) {
    const now = performance.now();
    let n = 0;
    for (const t of mashTimes) if (now - t < windowMs) n++;
    return n / (windowMs / 1000);
  },

  endFrame() {
    pressed.clear(); released.clear(); counts.clear();
    mouseDX = 0; mouseDY = 0; wheel = 0;
    mousePressed = [false, false, false];
    mouseReleased = [false, false, false];
  },

  clear() { down.clear(); pressed.clear(); mouseDown = [false, false, false]; },
  get lockWanted() { return lockWanted; },
};

function norm(e) {
  if (e.code) return e.code;
  return e.key;
}
