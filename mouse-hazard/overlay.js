// Overlay: runs the effects, moves/locks the real mouse, draws everything over the screen.
'use strict';
const { ipcRenderer } = require('electron');
const Win = require('./win32')();
const TEST = !!window.__MH_TEST;

const canvas = document.getElementById('c');
const timerEl = document.getElementById('timer');
let W = 1920, H = 1080, display = null, floorY = 1040, quality = 1;
const M = { virt: { x: 960, y: 540 }, last: { x: 960, y: 540 }, vel: { x: 0, y: 0 }, acc: { x: 0, y: 0 }, init: false, clipped: false, shape: 'arrow', push: { x: 0, y: 0 } };
let active = [], hidden = false, lingerUntil = 0, running = false, lastT = 0, handles = {}, settings = { volume: 0.8, stack: true };
let frameTimes = [], qualityChecked = 0;

function setup(disp) {
  display = disp;
  const pw = disp ? disp.phys.width : (TEST ? 1920 : screen.width * devicePixelRatio), ph = disp ? disp.phys.height : (TEST ? 1080 : screen.height * devicePixelRatio);
  if (pw === W && ph === H && canvas.width === W) { floorY = disp ? disp.floor : H - 48; Parts.floorY = floorY; Liquid.floorY = floorY; return; }
  W = Math.round(pw); H = Math.round(ph);
  canvas.width = W; canvas.height = H; canvas.style.width = '100vw'; canvas.style.height = '100vh';
  floorY = disp ? Math.min(H, disp.floor) : H - 48;
  Render.init(W, H); Fluid.init(W, H, quality); Liquid.init(W, H); Shapes.init(W, H);
  Parts.floorY = floorY; Parts.screenW = W; Liquid.floorY = floorY;
}

GLX.init(canvas, { preserve: TEST });
Parts.init();
setup(null);
Sfx.init(settings.volume);

// their real cursor pictures (taken by the main process), or a drawn arrow when not on Windows
function fallbackArrow() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d');
  g.beginPath(); const pts = [[1, 1], [1, 22], [6, 17], [10, 26], [13, 25], [9, 16], [16, 16]];
  g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.closePath();
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 2; g.shadowOffsetX = 1; g.shadowOffsetY = 1;
  g.fillStyle = '#fff'; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 1.2; g.strokeStyle = '#000'; g.stroke();
  const d = g.getImageData(0, 0, 32, 32).data; return { w: 32, h: 32, hx: 1, hy: 1, rgba: new Uint8Array(d) };
}
async function loadCursors() {
  let pics = {};
  try { pics = await ipcRenderer.invoke('get-cursors'); handles = await ipcRenderer.invoke('cursor-handles') || {}; } catch (e) {}
  const out = {};
  for (const k in pics) { const p = pics[k]; out[k] = { w: p.w, h: p.h, hx: p.hx, hy: p.hy, rgba: Uint8Array.from(atob(p.rgba), ch => ch.charCodeAt(0)) }; }
  if (!out.arrow) out.arrow = fallbackArrow();
  Render.setCursors(out);
  const a = out.arrow; Liquid.setMask(a.rgba, a.w, a.h, a.hx, a.hy, 1);
}
loadCursors();

// ---------- mouse ----------
function toLocal(p) { return display ? { x: p.x - display.phys.x, y: p.y - display.phys.y } : p; }
function toScreen(x, y) { return display ? { x: display.phys.x + x, y: display.phys.y + y } : { x, y }; }
function mouseTick(dt) {
  const lp = toLocal(Win.getPos());
  if (!M.init) { M.virt = { x: lp.x, y: lp.y }; M.last = { x: lp.x, y: lp.y }; M.init = true; }
  const m = { dx: lp.x - M.last.x, dy: lp.y - M.last.y, fx: 0, fy: 0, pin: null, clip: null, margin: 0, raw: { x: lp.x, y: lp.y } };
  const prev = { x: M.virt.x, y: M.virt.y };
  for (const e of active) { if (!e.ending && e.def.mouse) e.def.mouse(e, m, dt); else if (e.ending && e.def.mouseEnd) e.def.mouseEnd(e, m, dt); }
  M.virt.x += m.dx + m.fx * dt; M.virt.y += m.dy + m.fy * dt;
  if (m.pin) { M.virt.x = m.pin.x; M.virt.y = m.pin.y; }
  M.push = { x: 0, y: 0 };
  if (m.clip) {
    const c = m.clip; const nx = Math.min(c.x + c.w, Math.max(c.x, M.virt.x)), ny = Math.min(c.y + c.h, Math.max(c.y, M.virt.y));
    M.push = { x: M.virt.x - nx, y: M.virt.y - ny }; M.virt.x = nx; M.virt.y = ny;
  }
  M.virt.x = Math.min(W - 1, Math.max(0, M.virt.x)); M.virt.y = Math.min(H - 1, Math.max(0, M.virt.y));
  const nv = { x: (M.virt.x - prev.x) / Math.max(dt, 1e-3), y: (M.virt.y - prev.y) / Math.max(dt, 1e-3) };
  M.acc = { x: (nv.x - M.vel.x) / Math.max(dt, 1e-3), y: (nv.y - M.vel.y) / Math.max(dt, 1e-3) };
  M.vel = { x: M.vel.x * 0.4 + nv.x * 0.6, y: M.vel.y * 0.4 + nv.y * 0.6 };
  const rx = Math.round(M.virt.x), ry = Math.round(M.virt.y);
  if (m.clip) { const mg = m.margin || 0; const s = toScreen(m.clip.x - mg, m.clip.y - mg); Win.clip({ x: s.x, y: s.y, w: m.clip.w + mg * 2, h: m.clip.h + mg * 2 }); M.clipped = true; }
  else if (M.clipped) { Win.clip(null); M.clipped = false; }
  if (rx !== lp.x || ry !== lp.y) { const s = toScreen(rx, ry); Win.setPos(s.x, s.y); }
  M.last = { x: rx, y: ry };
  // which cursor shape Windows wants right now (arrow, text beam, hand...)
  if (!TEST) { try { const h = Win.currentCursor().handle; for (const k in handles) if (handles[k] === h) { M.shape = k; break; } } catch (e) {} }
}

// ---------- effects ----------
const ctx = {
  get W() { return W; }, get H() { return H; }, get floor() { return floorY; }, M, get quality() { return quality; },
  linger(s) { lingerUntil = Math.max(lingerUntil, performance.now() / 1000 + s); },
  rand: (a, b) => a + Math.random() * (b - a),
  pan: x => (x / W) * 2 - 1,
  timer(on, x, y, secs) { if (!on) { timerEl.style.display = 'none'; return; } timerEl.style.display = 'block'; timerEl.style.left = (x / W * 100) + 'vw'; timerEl.style.top = (y / H * 100) + 'vh'; timerEl.textContent = Math.max(0, secs).toFixed(1); },
};

function startEffect(id, seconds) {
  const def = Effects[id]; if (!def) return;
  const same = active.find(e => e.id === id && !e.ending);
  if (same) { same.dur = same.t + seconds; return report(); }
  if (!settings.stack) active.forEach(e => endEffect(e));
  const e = { id, def, t: 0, dur: seconds, ending: false, te: 0, s: {} };
  active.push(e);
  if (def.fluid) Fluid.use(1);
  try { def.start(e, ctx); } catch (err) { console.error(err); }
  if (!hidden) { hidden = true; ipcRenderer.send('cursor-hide'); }
  running = true; report();
  if (!rafOn) { rafOn = true; lastT = performance.now(); requestAnimationFrame(frame); }
}
function endEffect(e, hard) {
  if (!e.ending) { e.ending = true; e.te = 0; try { e.def.end && e.def.end(e, ctx); } catch (err) { console.error(err); } }
  if (hard) e.te = 999;
}
function report() { ipcRenderer.send('effect-state', active.filter(e => !e.ending).map(e => ({ id: e.id, left: Math.max(0, e.dur - e.t), dur: e.dur }))); }

let rafOn = false, reportT = 0, simTime = 0;
function frame(now) {
  const realDt = Math.min(0.25, Math.max(0.001, (now - lastT) / 1000)); // the clock: seconds stay real seconds even if a frame is slow
  const dt = window.__MH_FIXED ? 1 / 60 : Math.min(0.05, realDt); lastT = now; simTime += dt;
  const clk = window.__MH_FIXED ? dt : realDt;
  const time = now / 1000;
  try { mouseTick(dt); } catch (e) { console.error(e); }
  // update effects
  Render.resetScreen(); Parts.wind = 0;
  for (const e of active) {
    if (!e.ending) { e.t += clk; if (e.t >= e.dur) endEffect(e); } else e.te += clk;
    try { e.def.update && e.def.update(e, ctx, dt, time); } catch (err) { console.error(err); }
  }
  for (let i = active.length - 1; i >= 0; i--) { const e = active[i]; if (e.ending && e.te >= (e.def.outro == null ? 1 : e.def.outro)) {
    try { e.def.cleanup && e.def.cleanup(e, ctx); } catch (err) {} if (e.def.fluid) { Fluid.use(-1); ctx.linger(4); } active.splice(i, 1); report(); } }
  const controlling = active.length > 0;
  if (!controlling && hidden) { hidden = false; ipcRenderer.send('cursor-show'); Win.clip(null); M.clipped = false; ctx.timer(false); }
  if ((reportT += dt) > 0.2) { reportT = 0; report(); }

  // physics
  const cursorShown = hidden;
  const look = { x: M.virt.x, y: M.virt.y, key: M.shape, rot: 0, sx: 1, sy: 1, scale: 1, alpha: 1, tint: [1, 1, 1], catchable: true, extra: [], hide: false };
  const lk = {};
  for (const e of active) e.def.cursor && e.def.cursor(e, look, lk, ctx);
  Liquid.update(dt, { x: look.x, y: look.y, vx: M.vel.x, vy: M.vel.y, ax: M.acc.x, ay: M.acc.y, on: cursorShown && !look.hide, catchable: look.catchable });
  Parts.update(dt, time);
  if (Fluid.active > 0 || time < lingerUntil) {
    const f = { buoy: 900, vort: 30, wind: [Parts.wind * 2, 0] };
    for (const e of active) e.def.fluidParams && e.def.fluidParams(e, f);
    Fluid.active = Math.max(Fluid.active, 0.0001); Fluid.step(dt, f); if (!active.some(e => e.def.fluid) && time >= lingerUntil) Fluid.active = 0;
  }

  // draw
  Render.begin();
  for (const e of active) e.def.under && e.def.under(e, ctx, time);
  Render.screenPass(Fluid.active > 0 || time < lingerUntil ? Fluid.dye : null);
  for (const e of active) e.def.back && e.def.back(e, ctx, time);
  if (Fluid.active > 0 || time < lingerUntil) Effects._drawFluid(ctx);
  Liquid.draw(Render.scene, Render.screenTex, Render.hasScreen, time);
  Parts.draw(Render.scene);
  for (const e of active) e.def.mid && e.def.mid(e, ctx, time);
  if (cursorShown && !look.hide) Render.drawCursors([look].concat(look.extra), lk);
  for (const e of active) e.def.front && e.def.front(e, ctx, time);
  Render.finish();

  // auto quality: keep it smooth without telling anyone
  frameTimes.push(dt); if (frameTimes.length > 90) frameTimes.shift();
  if (quality === 1 && time - qualityChecked > 3 && frameTimes.length >= 90) { qualityChecked = time; const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > 0.028) { quality = 0; Fluid.init(W, H, 0); } }

  const busy = active.length || Liquid.count || Parts.count || time < lingerUntil;
  if (!busy) { rafOn = false; running = false; GLX.clear(null); Fluid.clear(); Shapes.oilClear(); ipcRenderer.send('overlay-idle'); return; }
  requestAnimationFrame(frame);
}

ipcRenderer.on('screen', (ev, img) => { if (img && img.bgra) Render.setScreen(img); else if (!TEST) Render.setScreen(null); });
ipcRenderer.on('start', (ev, m) => {
  if (m.display) setup(m.display);
  settings.stack = m.stack; if (m.volume != null) { settings.volume = m.volume; Sfx.init(m.volume); }
  if (!active.length) { const lp = toLocal(Win.getPos()); M.virt = { x: lp.x, y: lp.y }; M.last = { x: lp.x, y: lp.y }; M.vel = { x: 0, y: 0 }; M.init = true; }
  startEffect(m.id, m.seconds);
});
ipcRenderer.on('stop', (ev, m) => {
  active.forEach(e => endEffect(e, true));
  Win.clip(null); M.clipped = false; Sfx.stopAll(); ctx.timer(false);
  if (m && m.hard) { Liquid.clear(); Parts.clear(); Fluid.clear(); Shapes.oilClear(); lingerUntil = 0; }
});
ipcRenderer.on('settings', (ev, s) => { settings.stack = s.stack; settings.volume = s.volume; Sfx.setVolume(s.volume); });
window.MH = { get simTime() { return simTime; }, startEffect, M, ctx, get active() { return active; }, setup, Render, Liquid, Parts };
ipcRenderer.send('overlay-ready');
