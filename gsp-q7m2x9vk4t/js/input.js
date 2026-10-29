/* One input system for keyboard + controller.
   Everything becomes an action: up / down / left / right / ok / back / options / prev / next / guide.
   Also: spatial focus helper for menus (move the white highlight to the nearest thing in that direction). */
import { press, focusedNow } from './press.js';
const handlers = [];
let paused = false;
/* while a game is on screen the menus behind it must not react to the controller */
export function setPaused(p) { paused = !!p; if (!paused) startPoll(); }
let padKind = null; /* 'ps' | 'xbox' | null */
const padListeners = new Set();

export function pushHandler(fn) { handlers.push(fn); return function () { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); }; }
export function onPadKind(fn) { padListeners.add(fn); fn(padKind); }
export function getPadKind() { return padKind; }

function fire(action, ev) {
  /* Enter / A / Cross: the highlighted thing does the console's press animation */
  const pressed = action === 'ok' ? focusedNow() : null;
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i](action, ev) !== false) { if (pressed) press(pressed); return true; }
  }
  return false;
}
export { fire };

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'ok', ' ': 'ok', Escape: 'back', Backspace: 'back', ContextMenu: 'options',
  PageUp: 'prev', PageDown: 'next'
};

document.addEventListener('keydown', function (e) {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.type !== 'range' && t.type !== 'checkbox';
  let action = KEYMAP[e.key];
  if (typing) {
    if (e.key === 'Escape') action = 'back';
    else if (e.key === 'Enter') action = 'ok';
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') action = KEYMAP[e.key];
    else return;
  }
  if (!action || paused) return;
  if (fire(action, e)) e.preventDefault();
}, true);

/* ---------- controller ---------- */
const held = {};
let lastKind = null;
function kindOf(pad) {
  const id = (pad.id || '').toLowerCase();
  if (/054c|sony|playstation|dualshock|dualsense|wireless controller/.test(id)) return 'ps';
  return 'xbox';
}
const BTN = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'ok', 1: 'back', 9: 'options', 4: 'prev', 5: 'next', 16: 'guide', 3: 'options' };
/* the controller is only checked while one is plugged in and Game System 3 is the window you're using
   (checking 60 times a second for nothing was most of its CPU use) */
let polling = false;
let idle = false;
export function setIdle(v) { idle = !!v; if (!idle) startPoll(); }
function startPoll() {
  if (polling || idle || paused) return;
  let any = false;
  try { any = navigator.getGamepads && Array.from(navigator.getGamepads()).some(Boolean); } catch (e) { any = false; }
  if (!any) return;
  polling = true;
  requestAnimationFrame(poll);
}
function poll() {
  if (idle || paused) { polling = false; for (const k of Object.keys(held)) delete held[k]; return; }
  let pads = [];
  try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { pads = []; }
  const now = performance.now();
  const down = {};
  for (const p of pads) {
    for (const k of Object.keys(BTN)) { const b = p.buttons[k]; if (b && b.pressed) down[BTN[k]] = true; }
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (ax < -0.55) down.left = true;
    if (ax > 0.55) down.right = true;
    if (ay < -0.55) down.up = true;
    if (ay > 0.55) down.down = true;
    if (p.buttons[8] && p.buttons[8].pressed && p.buttons[9] && p.buttons[9].pressed) { down.guide = true; delete down.options; }
  }
  if (!pads.length) { polling = false; return; }   /* unplugged: stop until one comes back */
  if (document.hidden) { for (const k of Object.keys(held)) delete held[k]; requestAnimationFrame(poll); return; }
  if (pads.length) {
    const k = kindOf(pads[0]);
    if (k !== lastKind) { lastKind = k; padKind = k; padListeners.forEach(function (fn) { fn(k); }); }
  }
  for (const a of ['up', 'down', 'left', 'right', 'ok', 'back', 'options', 'prev', 'next', 'guide']) {
    if (down[a]) {
      const st = held[a];
      if (!st) { held[a] = { t: now, rep: now + 380 }; fire(a, null); }
      else if (/up|down|left|right/.test(a) && now >= st.rep) { st.rep = now + 95; fire(a, null); }
    } else delete held[a];
  }
  requestAnimationFrame(poll);
}
window.addEventListener('gamepadconnected', function (e) { padKind = kindOf(e.gamepad); padListeners.forEach(function (fn) { fn(padKind); }); startPoll(); });
startPoll();

/* ---------- spatial focus inside a box ---------- */
export function focusables(root) {
  return Array.from(root.querySelectorAll('[data-f]')).filter(function (el) {
    if (el.disabled) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export function setFocus(root, el) {
  root.querySelectorAll('.focus').forEach(function (x) { if (x !== el) x.classList.remove('focus'); });
  if (!el) return null;
  el.classList.add('focus');
  if (el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox') el.focus();
  else if (document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement)) document.activeElement.blur();
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return el;
}

export function moveFocus(root, cur, dir) {
  const list = focusables(root);
  if (!list.length) return null;
  if (!cur || list.indexOf(cur) < 0) return list[0];
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    let main, cross;
    if (dir === 'up') { if (b.bottom > a.top + 2 && dy >= -2) continue; main = -dy; cross = Math.abs(dx); }
    else if (dir === 'down') { if (b.top < a.bottom - 2 && dy <= 2) continue; main = dy; cross = Math.abs(dx); }
    else if (dir === 'left') { if (b.right > a.left + 2 && dx >= -2) continue; main = -dx; cross = Math.abs(dy); }
    else { if (b.left < a.right - 2 && dx <= 2) continue; main = dx; cross = Math.abs(dy); }
    if (main <= 0) continue;
    const score = main + cross * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}
