// Keyboard + mouse with pointer lock and rebindable actions.
import { settings } from './settings.js';

export const input = {
  down: new Set(),        // physical key codes held
  pressed: new Set(),     // codes pressed this frame
  released: new Set(),
  mouse: { dx: 0, dy: 0, wheel: 0, left: false, right: false, leftPressed: false, rightPressed: false, leftReleased: false, rightReleased: false, x: 0, y: 0 },
  locked: false,
  typing: false,          // chat box / text field has focus
  canvas: null,
  onLockChange: null,
};

export const act = (name) => !input.typing && input.down.has(settings.keys[name]);
export const actPressed = (name) => !input.typing && input.pressed.has(settings.keys[name]);
export const actReleased = (name) => input.released.has(settings.keys[name]);
export const codePressed = (code) => !input.typing && input.pressed.has(code);

export function initInput(canvas) {
  input.canvas = canvas;
  addEventListener('keydown', (e) => {
    const t = e.target;
    const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    input.typing = inField;
    if (inField) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!input.down.has(e.code)) input.pressed.add(e.code);
    input.down.add(e.code);
  });
  addEventListener('keyup', (e) => {
    input.down.delete(e.code);
    input.released.add(e.code);
  });
  addEventListener('blur', () => { input.down.clear(); input.mouse.left = input.mouse.right = false; });
  addEventListener('focusin', (e) => {
    const t = e.target;
    input.typing = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
    if (input.typing) input.down.clear();
  });
  addEventListener('focusout', () => { input.typing = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouse.left = true; input.mouse.leftPressed = true; }
    if (e.button === 2) { input.mouse.right = true; input.mouse.rightPressed = true; }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0 && input.mouse.left) { input.mouse.left = false; input.mouse.leftReleased = true; }
    if (e.button === 2 && input.mouse.right) { input.mouse.right = false; input.mouse.rightReleased = true; }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    input.mouse.x = e.clientX; input.mouse.y = e.clientY;
    if (input.locked) { input.mouse.dx += e.movementX; input.mouse.dy += e.movementY; }
  });
  canvas.addEventListener('wheel', (e) => { input.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked) { input.mouse.left = input.mouse.right = false; }
    if (input.onLockChange) input.onLockChange(input.locked);
  });
}

export function lockPointer() {
  if (!input.canvas || input.locked) return;
  try {
    const p = input.canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { input.canvas.requestPointerLock(); } catch (e) { /* ignore */ } });
  } catch (e) { try { input.canvas.requestPointerLock(); } catch (e2) { /* ignore */ } }
}

export function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }

export function endFrame() {
  input.pressed.clear();
  input.released.clear();
  const m = input.mouse;
  m.dx = m.dy = 0; m.wheel = 0;
  m.leftPressed = m.rightPressed = m.leftReleased = m.rightReleased = false;
}
