// THE MASK - PC + phone + controller input (VR controllers are read in player.js).
import { G, clamp } from './game.js';
import { S } from './settings.js';

const keys = new Set();
const pressed = new Set();   // went down this frame
export const input = {
  look: { x: 0, y: 0 },      // mouse/touch look this frame (radians)
  move: { x: 0, y: 0 },      // -1..1 (x = right, y = forward)
  locked: false,
  mouse: [false, false, false], mouseDown: [false, false, false],
  pad: null,
  down(code) { return keys.has(code); },
  hit(code) { return pressed.has(code); },
  endFrame() { pressed.clear(); this.look.x = this.look.y = 0; this.mouseDown = [false, false, false]; this.padHit = {}; },
  padHit: {}
};

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (G.started && !G.paused && ['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (!G.started || G.paused || G.xr || G.touch) return;
    if (!input.locked && !G.noLock && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed */ } }
    input.mouse[e.button] = true; input.mouseDown[e.button] = true;
  });
  addEventListener('mouseup', (e) => { input.mouse[e.button] = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
  addEventListener('mousemove', (e) => {
    if (!G.started || G.paused || G.xr || G.touch) return;
    // pointer lock gives endless movement; without it (blocked) dragging with any button looks around
    if (!input.locked && !(e.buttons & 7)) return;
    const k = 0.0022 * S.sens;
    if (Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return; // browser glitch right after the lock
    input.look.x -= (e.movementX || 0) * k; input.look.y -= (e.movementY || 0) * k * (S.invertY ? -1 : 1);
  });
  addEventListener('wheel', (e) => { if (G.started && !G.paused && !G.xr) input.wheel = (input.wheel || 0) + Math.sign(e.deltaY); }, { passive: true });
}

// keyboard + gamepad -> move/look values (called every frame on PC)
const padPrev = {};
export function pollDesktop(dt) {
  let mx = 0, my = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  // a controller on the PC (Xbox / PlayStation pad)
  let pad = null;
  try { const ps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of ps) if (p && p.mapping === 'standard') { pad = p; break; } } catch (e) { /* blocked */ }
  input.pad = pad;
  if (pad) {
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    mx += dz(pad.axes[0]); my -= dz(pad.axes[1]);
    const k = 2.6 * S.sens * dt;
    input.look.x -= dz(pad.axes[2]) * k; input.look.y -= dz(pad.axes[3]) * k * (S.invertY ? -1 : 1);
    pad.buttons.forEach((b, i) => { const d = b.pressed; if (d && !padPrev[i]) input.padHit[i] = true; padPrev[i] = d; });
    input.padHeld = (i) => pad.buttons[i] && pad.buttons[i].pressed;
  } else input.padHeld = () => false;
  if (G.touch && touch.move) { mx += touch.move.x; my += touch.move.y; }
  const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
  input.move.x = mx; input.move.y = my;
}

/* ---------- phone: left thumb moves, right thumb looks, buttons on the right ---------- */
export const touch = { move: null, buttons: {} };
export function initTouch(root, actions) {
  G.touch = true;
  const ui = document.createElement('div'); ui.id = 'touch'; root.appendChild(ui);
  ui.innerHTML = `<div class="stick"><div class="knob"></div></div>
    <div class="tbtns">${actions.map((a) => `<button data-a="${a.id}" class="tbtn ${a.big ? 'big' : ''}">${a.label}</button>`).join('')}</div>`;
  const stick = ui.querySelector('.stick'), knob = ui.querySelector('.knob');
  let sid = null, sx = 0, sy = 0, lid = null, lx = 0, ly = 0;
  ui.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      const b = t.target.closest && t.target.closest('.tbtn');
      if (b) { const a = actions.find((x) => x.id === b.dataset.a); if (a) { touch.buttons[a.id] = true; a.down && a.down(); b.classList.add('on'); } continue; }
      if (t.clientX < innerWidth * 0.45 && sid === null) { sid = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.left = sx - 60 + 'px'; stick.style.top = sy - 60 + 'px'; stick.classList.add('on'); }
      else if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  ui.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === sid) {
        const dx = clamp((t.clientX - sx) / 50, -1, 1), dy = clamp((t.clientY - sy) / 50, -1, 1);
        touch.move = { x: dx, y: -dy }; knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      } else if (t.identifier === lid) {
        input.look.x -= (t.clientX - lx) * 0.006 * S.sens; input.look.y -= (t.clientY - ly) * 0.006 * S.sens * (S.invertY ? -1 : 1);
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === sid) { sid = null; touch.move = null; knob.style.transform = ''; stick.classList.remove('on'); }
      if (t.identifier === lid) lid = null;
      const b = t.target.closest && t.target.closest('.tbtn');
      if (b) { const a = actions.find((x) => x.id === b.dataset.a); if (a) { touch.buttons[a.id] = false; a.up && a.up(); } b.classList.remove('on'); }
    }
  };
  ui.addEventListener('touchend', end); ui.addEventListener('touchcancel', end);
  return ui;
}
