// Keyboard + mouse. The mouse is locked to the game while you play (Esc lets it go and opens the menu).
export const keys = new Set();      // held right now (KeyboardEvent.code)
export const pressed = new Set();   // pressed since last frame
export const mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false, middle: false, leftDown: false, rightDown: false, leftUp: false, rightUp: false, locked: false };
let canvas = null;
const listeners = { lock: [] };

export function initPC(el) {
  canvas = el;
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (mouse.locked && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || (e.ctrlKey && /Key[ZSWDY]/.test(e.code)))) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });
  addEventListener('mousemove', (e) => { if (mouse.locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
  if (window.__AF_TEST) addEventListener('keydown', (e) => { if (e.code === 'Escape' && mouse.locked) unlockMouse(); });
  canvas.addEventListener('mousedown', (e) => {
    if (!mouse.locked) return;
    if (e.button === 0) { mouse.left = true; mouse.leftDown = true; }
    if (e.button === 2) { mouse.right = true; mouse.rightDown = true; }
    if (e.button === 1) { mouse.middle = true; e.preventDefault(); }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) { if (mouse.left) mouse.leftUp = true; mouse.left = false; }
    if (e.button === 2) { if (mouse.right) mouse.rightUp = true; mouse.right = false; }
    if (e.button === 1) mouse.middle = false;
  });
  addEventListener('wheel', (e) => { if (mouse.locked) { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
    if (!mouse.locked) { keys.clear(); mouse.left = mouse.right = false; }
    listeners.lock.forEach((f) => f(mouse.locked));
  });
}
export function lockMouse() {
  if (!canvas || mouse.locked) return;
  if (window.__AF_TEST) { mouse.locked = true; listeners.lock.forEach((f) => f(true)); return; } // automated tests: no real mouse lock

  try {
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(() => { try { canvas.requestPointerLock(); } catch (e) { /* not allowed right now */ } });
  } catch (e) { try { canvas.requestPointerLock(); } catch (e2) { /* not allowed right now */ } }
}
export function unlockMouse() {
  if (window.__AF_TEST) { mouse.locked = false; listeners.lock.forEach((f) => f(false)); return; }
  if (document.pointerLockElement) document.exitPointerLock();
}
export function onLock(f) { listeners.lock.push(f); }
// call once per frame after the game has read the input
export function endFrame() {
  pressed.clear();
  mouse.dx = mouse.dy = mouse.wheel = 0;
  mouse.leftDown = mouse.rightDown = mouse.leftUp = mouse.rightUp = false;
}
export const down = (c) => keys.has(c);
export const hit = (c) => pressed.has(c);
