// Mouse powers. They work on the fake Windows (desktop) and inside the stickman world (same rules).
import { clamp, rand, chance, lerp, toast, DPR, canvas } from './util.js';
import { audio } from './audio.js';
import { MATS } from './physics.js';
import { spawnItem, BY_ID } from './items.js';
import { SPR } from './fx.js';

export const POWERS = [
  { id: 'laser', key: '1', name: 'Laser Eyes', desc: 'Your mouse gets eyes. Hold to fire. Cuts anything in half, burns the rest.' },
  { id: 'fire', key: '2', name: 'Fire', desc: 'Hold to set things on fire. Wallpaper burns, stuff burns to ash, gas tanks blow.' },
  { id: 'freeze', key: '3', name: 'Freeze Ray', desc: 'Hold to freeze. Frozen stuff shatters when it gets hit.' },
  { id: 'blast', key: '4', name: 'Blast', desc: 'Click to blow up. Hold longer for a bigger boom.' },
  { id: 'blackhole', key: '5', name: 'Black Hole', desc: 'Click to drop one. Eats everything, rips Windows apart. Click it again to close it.' },
  { id: 'lightning', key: '6', name: 'Lightning', desc: 'Click to strike. Jumps to things close by.' },
  { id: 'telekinesis', key: '7', name: 'Telekinesis', desc: 'Hold to lift everything near the mouse. Let go to throw it all.' },
  { id: 'magnet', key: '8', name: 'Magnet', desc: 'Hold. Metal flies to your mouse.' },
  { id: 'resize', key: '9', name: 'Shrink / Grow Ray', desc: 'Left click grows, right click shrinks. Works on stickmen too.' },
  { id: 'meteor', key: '0', name: 'Meteor Shower', desc: 'Hold. Burning rocks fall from the sky where your mouse is.' },
  { id: 'tornado', key: '⇧1', name: 'Tornado', desc: 'Hold. A tornado follows your mouse and spins everything up.' },
  { id: 'acid', key: '⇧2', name: 'Acid', desc: 'Hold to drip acid. It melts holes in everything.' },
  { id: 'scream', key: '⇧3', name: 'Sonic Scream', desc: 'Hold and SCREAM into your mic. The louder, the bigger. Cracks the screen.' },
  { id: 'erase', key: '⇧4', name: 'Erase Orb', desc: 'Hold. A purple orb deletes everything it touches.' },
  { id: 'quake', key: '⇧5', name: 'Earthquake', desc: 'Click. Everything shakes loose and falls off.' },
  { id: 'gravity', key: '⇧6', name: 'Gravity', desc: 'Click to switch: normal, no gravity, upside down.' },
  { id: 'slowmo', key: 'T', name: 'Slow Time', desc: 'Click to slow everything down except you. Click again to stop.' },
];

export class Powers {
  constructor(g) { this.g = g; this.active = null; this.holes = []; this.held = false; this.t = 0; this.tornado = null; this.gravMode = 0; this.mic = null; this.micLevel = 0; this.lastCut = new Map(); }
  scene() { return this.g.worlds && this.g.worlds.inside ? this.g.worlds.scene : this.g; }
  set(id) {
    if (this.active === 'slowmo' && id !== 'slowmo') { /* slow time keeps running until clicked off */ }
    this.active = id; this.held = false; document.body.classList.toggle('no-cursor', !!id);
    if (id === 'scream' || (id && this.g.micOn)) this.ensureMic();
    audio.stopLoop('laser'); audio.stopLoop('wind'); audio.stopLoop('pfire');
    if (this.g.hud) this.g.hud.refresh();
    if (id) toast(POWERS.find(p => p.id === id).name + '  (Esc = normal mouse)', 1800);
  }
  hotkey(n, shift) {
    const k = shift ? '⇧' + n : String(n); const p = POWERS.find(q => q.key === k);
    if (p) this.set(this.active === p.id ? null : p.id);
  }
  mouse() { const s = this.scene(); return s.mouseWorld ? s.mouseWorld() : [this.g.mouse.x, this.g.mouse.y]; }
  down(e) {
    const s = this.scene(); const [x, y] = this.mouse(); this.held = true; this.t = 0; this.charge = 0;
    const id = this.active;
    if (id === 'laser') { this.eye = [x - 26, y - 30]; audio.loop('laser', 0.6, 'laser'); }
    if (id === 'blackhole') {
      const near = this.holes.find(h => Math.hypot(h.x - x, h.y - y) < 40);
      if (near) { near.closing = true; audio.play('shimmer', { vol: 0.6, rate: 0.5 }); }
      else { this.holes.push({ x, y, r: 6, grow: 1, t: 0, scene: s }); audio.play('rumble', { vol: 0.8 }); audio.loop('field_hum', 0.5, 'hole'); }
    }
    if (id === 'lightning') this.strike(x, y);
    if (id === 'resize') this.resizeAt(x, y, e.button === 2 ? 0.74 : 1.35);
    if (id === 'quake') { this.quakeT = 3.2; audio.play('rumble', { vol: 1, rate: 0.8 }); }
    if (id === 'gravity') { this.gravMode = (this.gravMode + 1) % 3; this.applyGravity(); }
    if (id === 'slowmo') { const on = this.g.timeScale > 0.5; this.g.timeScale = on ? 0.18 : 1; if (this.g.worlds) this.g.worlds.slow = this.g.timeScale; audio.slow = on ? 0.6 : 1; audio.play('whoosh', { vol: 0.7, rate: on ? 0.5 : 1.4, noSlow: true }); toast(on ? 'Time is slow. Everything but you.' : 'Time is normal again'); }
    if (id === 'fire') audio.loop('fire_loop', 0.5, 'pfire');
    if (id === 'tornado') { this.tornado = { x, y, t: 0 }; audio.loop('blizzard', 0.8, 'wind'); }
  }
  up() {
    if (!this.held) return; this.held = false; const s = this.scene(); const [x, y] = this.mouse();
    if (this.active === 'laser') { audio.stopLoop('laser'); this.eye = null; }
    if (this.active === 'blast') s.explode(x, y, 0.6 + Math.min(3, this.charge) * 0.9);
    if (this.active === 'telekinesis') { for (const b of s.P.bodies) if (b.tk) { b.tk = false; s.P.setVel(b, this.g.mouse.vx * 0.9 + rand(-60, 60), this.g.mouse.vy * 0.9 + rand(-60, 60)); } }
    if (this.active === 'tornado') { this.tornado = null; audio.stopLoop('wind'); }
    if (this.active === 'fire') audio.stopLoop('pfire');
    if (this.active === 'scream' && this.charge > 0.2 && !this.mic) this.shock(x, y, Math.min(2.5, this.charge));
  }
  applyGravity() {
    const s = this.scene(); const g = [s.P.g, 0, -s.P.g][this.gravMode];
    for (const sc of [this.g, this.g.worlds?.scene].filter(Boolean)) { sc.P.world.gravity = { x: 0, y: [sc.P.g, 0, -sc.P.g][this.gravMode] }; for (const b of sc.P.bodies) b.rb.wakeUp(); sc.gravity = [Math.abs(sc.gravity), 0.0001, -Math.abs(sc.gravity)][this.gravMode] || sc.gravity; }
    audio.play('whoosh', { vol: 0.6, rate: 0.7 }); toast(['Gravity: normal', 'Gravity: none', 'Gravity: upside down'][this.gravMode]);
    if (this.gravMode === 0) { this.g.gravity = 1400; if (this.g.worlds?.scene) this.g.worlds.scene.gravity = this.g.worlds.scene.baseGravity; }
  }
  // ---------- per frame ----------
  update(dt) {
    this.updateMic(dt);
    const s = this.scene(); const [x, y] = this.mouse(); const P = s.P; const id = this.active;
    this.t += dt;
    for (const h of this.holes) this.updateHole(h, dt);
    this.holes = this.holes.filter(h => !h.dead);
    if (!this.holes.length) audio.stopLoop('hole');
    if (this.quakeT > 0) {
      this.quakeT -= dt; s.fx.shake(10, 0.2);
      for (const b of P.bodies) if (chance(dt * 4)) { b.rb.wakeUp(); s.P.impulse(b, rand(-1, 1) * b.mass() * 120, -b.mass() * rand(0, 200)); }
      if (s === this.g && chance(dt * 6)) { const els = [...document.querySelectorAll('[data-rip]:not(.ripped)')].filter(e => e.offsetParent || e === this.g.desk.tb); const el = els[Math.floor(Math.random() * els.length)]; if (el && el !== this.g.desk.tb) { const r = el.getBoundingClientRect(); if (r.width) this.g.rip(el, r.left + r.width / 2, r.top + r.height / 2, { grab: false, vx: rand(-80, 80), vy: rand(-200, 0) }); } }
      if (s.quakeWorld) s.quakeWorld(dt);
      for (const st of s.sticks) if (st.mode === 'stand' && chance(dt * 0.8)) st.knock(rand(-200, 200), -rand(50, 250));
    }
    if (!id || !this.held) return;
    this.charge += dt;
    if (id === 'laser') this.laser(s, x, y, dt);
    if (id === 'fire') {
      for (let i = 0; i < 3; i++) s.fx.fire(x + rand(-14, 14), y + rand(-10, 10), 1.4, 1);
      for (const b of P.bodies) if (b.contains(x, y) || Math.hypot(b.x - x, b.y - y) < b.radius() * 0.6 + 30) { if (MATS[b.mat].burn > 0 || b.def?.fireExplode) b.burn = Math.max(b.burn, 0.3); if (b.frozen > 0) b.frozen = Math.max(0, b.frozen - dt * 2); }
      for (const st of s.sticks) { const [cx, cy] = st.center(); if (Math.hypot(cx - x, cy - y) < st.h * 0.5 + 20) st.onFire = Math.max(st.onFire || 0, 0.1); }
      if (s.burnAt) s.burnAt(x, y, 28, dt * 1.6);
    }
    if (id === 'freeze') {
      if (chance(0.7)) s.fx.add({ t: 'spark', x: x + rand(-20, 20), y: y + rand(-20, 20), vx: rand(-40, 40), vy: rand(-40, 40), life: rand(0.4, 0.9), age: 0, r: rand(3, 6), add: true, spr: SPR.blue });
      for (const b of P.bodies) if (Math.hypot(b.x - x, b.y - y) < b.radius() + 50) { b.frozen = Math.min(1, b.frozen + dt * 1.5); b.burn = 0; if (b.frozen > 0.95 && !b.iced) { b.iced = true; b.brk = Math.min(b.brk, 5); b.col.setFriction(0.05); audio.play('ice_freeze', { x, vol: 0.4 }); } }
      for (const st of s.sticks) { const [cx, cy] = st.center(); if (Math.hypot(cx - x, cy - y) < st.h * 0.55 + 40) { st.frozen = Math.min(1, st.frozen + dt * 1.2); st.onFire = 0; } }
      if (s.frostAt) s.frostAt(x, y, dt);
      audio.loop('blizzard', 0.3, 'wind');
    }
    if (id === 'telekinesis') {
      for (const b of P.bodies) {
        const d = Math.hypot(b.x - x, b.y - y); if (d > 260 && !b.tk) continue; b.tk = true;
        const tx = x + Math.cos(this.t * 2 + b.id) * 60, ty = y + Math.sin(this.t * 2 + b.id) * 40;
        P.setVel(b, (tx - b.x) * 6, (ty - b.y) * 6); b.rb.setAngvel(b.rb.angvel() * 0.9 + 0.2, true);
      }
      for (const st of s.sticks) { const [cx, cy] = st.center(); if (Math.hypot(cx - x, cy - y) < 240) { if (st.mode !== 'held') st.hold(1, cx, cy); st.holdX = lerp(st.holdX, x + Math.cos(this.t * 3 + st.id) * 70, 0.2); st.holdY = lerp(st.holdY, y + Math.sin(this.t * 3 + st.id) * 50, 0.2); st.tk = true; } }
    }
    if (id === 'magnet') {
      for (const b of P.bodies) { if (!MATS[b.mat].metal && !b.def?.metal) continue; const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1; if (d > 700) continue; const f = b.mass() * 2600 / Math.max(60, d) * dt * 60; P.impulse(b, dx / d * f * dt, dy / d * f * dt); }
      if (chance(0.3)) s.fx.ring(x, y, 60, '255,80,80', 0.4, 2);
    }
    if (id === 'meteor' && chance(dt * 5)) {
      const it = BY_ID.rock; const mx = x + rand(-160, 160), my = (s.skyY ? s.skyY() : -60);
      const b = spawnItem(P, it, mx, my, { size: rand(0.8, 1.6) * (s.itemScale || 1), ppm: s.itemPPM, vx: rand(-200, 200), vy: 900, armed: false });
      if (b) { b.burn = 1; b.eternal = true; b.meteor = true; b.boomOnHit = true; audio.play('incoming', { vol: 0.35, rate: rand(1.1, 1.5) }); }
    }
    if (id === 'tornado' && this.tornado) {
      const T = this.tornado; T.x = lerp(T.x, x, 0.08); T.y = lerp(T.y, y, 0.08); T.t += dt;
      for (const b of P.bodies) { const dx = T.x - b.x, dy = T.y - b.y, d = Math.hypot(dx, dy) || 1; if (d > 380) continue; const m = b.mass(); P.impulse(b, (dx / d * 0.4 - dy / d) * m * 900 * dt * 4, (dy / d * 0.4 + dx / d - 0.8) * m * 900 * dt * 4); }
      for (const st of s.sticks) { const [cx, cy] = st.center(); if (Math.hypot(cx - T.x, cy - T.y) < 300 && st.mode === 'stand') st.knock(rand(-300, 300), -500); }
      for (let i = 0; i < 3; i++) s.fx.add({ t: 'dust', x: T.x + rand(-30, 30), y: T.y + rand(-200, 120), vx: rand(-200, 200), vy: rand(-150, -40), life: rand(0.4, 0.9), age: 0, r: rand(20, 40), grow: 1, spr: SPR.dust });
      if (s === this.g && chance(dt * 4)) this.g.ripNear(T.x, T.y, 160, 500);
    }
    if (id === 'acid' && chance(dt * 18)) s.fx.add({ t: 'acid', x: x + rand(-8, 8), y: y + 6, vx: rand(-20, 20), vy: 60, g: 1500, life: 3, age: 0, r: rand(3, 5), add: true, spr: SPR.green, acid: true });
    if (id === 'scream') {
      const lv = this.mic ? this.micLevel : 0;
      if (this.mic) { if (lv > 0.18 && chance(dt * 10)) this.shock(x, y, lv * 2.2); if (lv > 0.55 && chance(dt * 3)) s.fx.crack(x + rand(-200, 200), y + rand(-150, 150), lv); }
      else if (chance(0.2)) s.fx.ring(x, y, 30 + this.charge * 60, '255,255,255', 0.3, 2);
    }
    if (id === 'erase') {
      const R = 46;
      for (const b of P.bodies.slice()) if (Math.hypot(b.x - x, b.y - y) < R + b.radius() * 0.5) { s.fx.glowAt(b.x, b.y, b.radius(), 'purple', 0.3); P.remove(b); audio.play('glitch', { vol: 0.2, gap: 0.08, dur: 0.15 }); }
      for (const st of s.sticks) { const [cx, cy] = st.center(); if (Math.hypot(cx - x, cy - y) < R + st.h * 0.3) st.die('erased'); }
      if (s.eraseAt) s.eraseAt(x, y, R);
      if (s === this.g) { this.g.desk.tearWall([[x - R, y], [x, y - R], [x + R, y], [x, y + R]].map((p, i) => { const a = i / 4 * Math.PI * 2; return [x + Math.cos(a) * R, y + Math.sin(a) * R]; }).concat([]), false); const el = document.elementFromPoint(x, y)?.closest('[data-rip]'); if (el && el !== this.g.desk.tb) { el.classList.add('ripped'); if (el.dataset.rip === 'win') { const w = this.g.desk.wins.find(q => q.el === el); if (w) this.g.desk.closeWin(w, true); } } }
      s.fx.add({ t: 'spark', x: x + rand(-R, R), y: y + rand(-R, R), vx: 0, vy: 0, life: 0.3, age: 0, r: rand(6, 14), add: true, spr: SPR.purple });
    }
  }
  // acid drops land and eat things (checked from FX particles)
  acidTick(s) {
    for (const p of s.fx.p) {
      if (!p.acid) continue;
      const b = s.P.bodyAt(p.x, p.y);
      if (b) { p.age = p.life; this.dissolve(s, b, p.x, p.y); continue; }
      for (const st of s.sticks) { if (!st.alive) continue; const [cx, cy] = st.center(); if (Math.hypot(cx - p.x, cy - p.y) < st.h * 0.4) { p.age = p.life; st.hurt(0.35, 'acid'); st.burnLook = (st.burnLook || 0) + 0.2; s.fx.smoke(p.x, p.y, 0.5, 2, true); } }
      if (s.acidGround && s.acidGround(p)) { p.age = p.life; }
    }
  }
  dissolve(s, b, x, y) {
    audio.play('sizzle', { x, vol: 0.4, gap: 0.06 }); s.fx.smoke(x, y, 0.6, 2, true); s.fx.bits(x, y, 3, ['#9f6', '#6c3'], 60, 2);
    b.acid = (b.acid || 0) + 1;
    if (b.area() < 1800 || b.acid > 5) { s.P.remove(b); return; }
    if (b.acid % 2 === 0) { const kids = s.P.fracture(b, x, y, 4); const near = kids.sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0]; if (near) s.P.remove(near); }
  }
  laser(s, x, y, dt) {
    const [ex, ey] = this.eye || [x - 26, y - 30];
    let dx = x - ex, dy = y - ey; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const far = 4000; const bx = ex + dx * far, by = ey + dy * far;
    this.beam = [ex, ey, bx, by];
    // cut everything the beam passes through (each thing at most every 0.3 s)
    const now = performance.now();
    for (const b of s.P.bodies.slice()) {
      if (b.dead) continue;
      const t = (b.x - ex) * dx + (b.y - ey) * dy; if (t < 0) continue;
      const px = ex + dx * t, py = ey + dy * t; if (Math.hypot(b.x - px, b.y - py) > b.radius()) continue;
      b.char = Math.min(0.6, b.char + dt * 0.8);
      const last = this.lastCut.get(b.id) || 0; if (now - last < 300 || now - b.born < 250) continue;
      const kids = s.P.slice(b, ex, ey, bx, by);
      if (kids.length) { for (const k of kids) { this.lastCut.set(k.id, now); k.flash = 0.6; } s.fx.spark(px, py, 10, 300); audio.play('sizzle', { x: px, vol: 0.5, gap: 0.05 }); }
    }
    for (const st of s.sticks) { if (!st.alive) continue; const [cx, cy] = st.center(); const t = (cx - ex) * dx + (cy - ey) * dy; if (t < 0) continue; if (Math.hypot(cx - (ex + dx * t), cy - (ey + dy * t)) < st.h * 0.3) { st.burnLook = 1; st.die('laser'); s.fx.spark(cx, cy, 14, 300); } }
    if (s.laserAt) s.laserAt(ex, ey, bx, by, x, y, dt);
    if (s === this.g) {
      this.g.desk.scorchLine(this.lastBeam ? this.lastBeam[0] : x, this.lastBeam ? this.lastBeam[1] : y, x, y, 4);
      const el = document.elementFromPoint(x, y)?.closest('[data-rip]');
      if (el && !el.classList.contains('ripped')) this.g.rip(el, x, y, { grab: false });
    }
    this.lastBeam = [x, y];
    s.fx.spark(x, y, 2, 220); s.fx.glowAt(x, y, 40, 'red', 0.08);
  }
  strike(x, y) {
    const s = this.scene(); const top = s.skyY ? s.skyY() : -20;
    s.fx.bolt(x + rand(-80, 80), top, x, y, '210,230,255', 0.3, 4); s.fx.flash(0.45, '220,235,255'); s.fx.glowAt(x, y, 120, 'blue', 0.3);
    audio.play('thunder', { x, vol: 1 }); audio.play('electric', { x, vol: 0.6, dur: 0.4 });
    const targets = [];
    for (const b of s.P.bodies) { const d = Math.hypot(b.x - x, b.y - y); if (d < 260) targets.push({ x: b.x, y: b.y, b, d }); }
    for (const st of s.sticks) { if (!st.alive) continue; const [cx, cy] = st.center(); const d = Math.hypot(cx - x, cy - y); if (d < 260) targets.push({ x: cx, y: cy, st, d }); }
    targets.sort((a, b) => a.d - b.d);
    let px = x, py = y;
    for (const t of targets.slice(0, 5)) {
      s.fx.bolt(px, py, t.x, t.y, '200,225,255', 0.25, 2); px = t.x; py = t.y; s.fx.spark(t.x, t.y, 8, 300, SPR.blue);
      if (t.b) { if (MATS[t.b.mat].burn > 0) t.b.burn = Math.max(t.b.burn, 0.5); s.P.impulse(t.b, rand(-1, 1) * t.b.mass() * 300, -t.b.mass() * 400); t.b.char = Math.min(1, t.b.char + 0.3); if (t.b.def?.explosive) t.b.boom = true; }
      if (t.st) { t.st.knock(rand(-300, 300), -400); t.st.burnLook = 0.8; t.st.die('lightning'); }
    }
    if (s === this.g) { this.g.ripNear(x, y, 90, 400); this.g.desk.burnWall(x, y, 40, 0.7); }
    if (s.strikeGround) s.strikeGround(x, y);
  }
  shock(x, y, k) {
    const s = this.scene(); s.fx.ring(x, y, 220 * k, '255,255,255', 0.5, 8); s.fx.shake(8 * k, 0.3);
    s.P.explode(x, y, 200 * k, 700 * k, { fire: false, shatter: k > 1.2 });
    for (const st of s.sticks) { const [cx, cy] = st.center(); const d = Math.hypot(cx - x, cy - y); if (d < 220 * k) st.knock((cx - x) / (d || 1) * 900 * k, -300 * k); }
    if (s === this.g) { this.g.ripNear(x, y, 140 * k, 700 * k); if (k > 1.3) s.fx.crack(x, y, k * 0.6); }
    audio.play('feedback', { vol: Math.min(1, 0.3 * k), gap: 0.2 });
  }
  resizeAt(x, y, k) {
    const s = this.scene(); const b = s.P.bodyAt(x, y);
    if (b) { s.P.rescale(b, k); audio.play('shimmer', { vol: 0.4, rate: k > 1 ? 0.7 : 1.6 }); s.fx.ring(x, y, 40, k > 1 ? '120,255,160' : '255,160,120', 0.3, 3); return; }
    const hit = s.stickAt ? s.stickAt(x, y) : null;
    if (hit) { const st = hit.s; st.setSize(clamp(st.h * k, 18, 900)); st.ground = s.groundAt(st.x, st.pts[2][1] - st.h * 0.4, st); audio.play('shimmer', { vol: 0.4, rate: k > 1 ? 0.7 : 1.6 }); return; }
    if (s === this.g) { const el = document.elementFromPoint(x, y)?.closest('[data-rip]'); if (el) this.g.rip(el, x, y, { grab: false }).then(nb => nb && this.g.P.rescale(nb, k)); }
  }
  updateHole(h, dt) {
    const s = h.scene; h.t += dt;
    if (h.closing) { h.r -= dt * 80; if (h.r <= 0) { h.dead = true; s.fx.flash(0.3, '200,160,255'); } return; }
    h.r = Math.min(70, h.r + dt * 18);
    const reach = h.r * 9;
    for (const b of s.P.bodies.slice()) {
      const dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy) || 1; if (d > reach) continue;
      if (d < h.r * 0.9) { s.fx.glowAt(b.x, b.y, b.radius(), 'purple', 0.25); s.P.remove(b); h.r = Math.min(90, h.r + 1.5); continue; }
      const m = b.mass(); const f = m * 9000 * h.r / Math.max(40, d) / 60;
      s.P.impulse(b, (dx / d * 1 + -dy / d * 0.35) * f * dt * 6, (dy / d * 1 + dx / d * 0.35) * f * dt * 6);
      if (d < h.r * 3 && b.area() > 3000 && chance(dt * 3)) s.P.fracture(b, b.x, b.y, 4);
    }
    for (const st of s.sticks) {
      if (!st.alive && st.vanish <= 0) continue; const [cx, cy] = st.center(); const d = Math.hypot(h.x - cx, h.y - cy);
      if (d < reach * 0.8) { if (st.mode !== 'held') st.hold(J_PEL, cx, cy); st.holdX = lerp(st.holdX, h.x, dt * 1.6); st.holdY = lerp(st.holdY, h.y, dt * 1.6); if (d < h.r * 1.2) st.die('black hole'); }
    }
    if (s === this.g) {
      if (chance(dt * 5)) this.g.ripNear(h.x, h.y, h.r * 5, 300);
      if (chance(dt * 2)) { const a = rand(0, 6.28), rr = h.r * rand(1.4, 3.5); this.g.blowWall(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, rand(30, 60)); }
    }
    for (let i = 0; i < 2; i++) { const a = rand(0, 6.28), rr = h.r * rand(2, 5); s.fx.add({ t: 'spark', x: h.x + Math.cos(a) * rr, y: h.y + Math.sin(a) * rr, vx: -Math.sin(a) * 200 - Math.cos(a) * 80, vy: Math.cos(a) * 200 - Math.sin(a) * 80, life: 0.6, age: 0, r: rand(2, 4), add: true, spr: SPR.purple }); }
  }
  shootFrom(b) { // pistol: shoots where the barrel points
    const s = this.scene(); const dir = Math.cos(b.a) >= 0 ? 1 : -1;
    const [mx, my] = b.toWorld(b.radius() * 0.9 * dir, -b.radius() * 0.25);
    const dx = Math.cos(b.a) * dir, dy = Math.sin(b.a) * dir;
    audio.play('gunshot', { x: mx, vol: 0.8 }); s.fx.glowAt(mx, my, 40, 'fire', 0.08); s.fx.spark(mx, my, 6, 300);
    s.P.impulse(b, -dx * b.mass() * 200, -dy * b.mass() * 200);
    // the bullet: first thing on the line
    let best = null, bt = 3000;
    for (const q of s.P.bodies) { if (q === b) continue; const t = (q.x - mx) * dx + (q.y - my) * dy; if (t < 0 || t > bt) continue; if (Math.hypot(q.x - (mx + dx * t), q.y - (my + dy * t)) < q.radius() * 0.7) { bt = t; best = { q }; } }
    for (const st of s.sticks) { if (!st.alive) continue; const [cx, cy] = st.center(); const t = (cx - mx) * dx + (cy - my) * dy; if (t < 0 || t > bt) continue; if (Math.hypot(cx - (mx + dx * t), cy - (my + dy * t)) < st.h * 0.25) { bt = t; best = { st }; } }
    const hx = mx + dx * bt, hy = my + dy * bt;
    s.fx.add({ t: 'tracer', x: mx, y: my, x2: hx, y2: hy, life: 0.08, age: 0, vx: 0, vy: 0, r: 1 });
    if (best?.q) { s.P.impulse(best.q, dx * 500, dy * 500, hx, hy); s.fx.spark(hx, hy, 6, 260); if (best.q.def?.explosive) best.q.boom = true; else if (best.q.brk < 30) s.P.queueBreak(best.q, hx, hy, 3); }
    if (best?.st) { best.st.knock(dx * 500, dy * 500 - 100); best.st.die('shot'); }
    if (s === this.g && !best) { this.g.desk.burnWall(hx, hy, 6, 0.9); this.g.fx.crack(hx, hy, 0.25); }
  }
  cannonFire(b) {
    const s = this.scene(); const dir = Math.cos(b.a) >= 0 ? -1 : 1; // the barrel points left in the picture
    const [mx, my] = b.toWorld(b.radius() * 0.95 * dir, -b.radius() * 0.25);
    const ball = s.P.addCircle(9 * (b.scale || 1) * (s.itemScale || 1), mx, my, 0, { mat: 'metal', kind: 'item', density: 6, vx: Math.cos(b.a) * dir * 2400, vy: Math.sin(b.a) * dir * 2400 - 100, ccd: true });
    ball.tex = null; ball.boomOnHit = 0.6; ball.born = performance.now();
    s.P.impulse(b, -dir * b.mass() * 300, 0); audio.play('big_boom', { x: mx, vol: 0.5, rate: 1.6, dur: 1.2 }); s.fx.smoke(mx, my, 1.2, 8, true); s.fx.glowAt(mx, my, 90, 'fire', 0.12);
  }
  // ---------- microphone ----------
  async ensureMic() {
    if (this.mic || this.micAsk) return; this.micAsk = true;
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const src = audio.ctx.createMediaStreamSource(st); const an = audio.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      this.mic = { st, an, buf: new Float32Array(1024) };
    } catch (e) { toast('No microphone found. Sonic Scream will use how long you hold instead.'); }
  }
  stopMic() { if (this.mic) { this.mic.st.getTracks().forEach(t => t.stop()); this.mic = null; } this.micAsk = false; this.micLevel = 0; }
  updateMic(dt) {
    if (!this.mic) { this.g.desk.setMic(false); return; }
    this.mic.an.getFloatTimeDomainData(this.mic.buf); let s = 0; for (const v of this.mic.buf) s += v * v; const rms = Math.sqrt(s / this.mic.buf.length);
    const lv = clamp((20 * Math.log10(rms + 1e-6) + 52) / 40, 0, 1); this.micLevel = lerp(this.micLevel, lv, 0.35);
    this.g.desk.setMic(true, this.micLevel);
    // "my mic blew it up": a real yell makes the mic icon on the taskbar explode
    if (this.g.micOn && this.micLevel > 0.82 && !this.micBoomT) {
      this.micBoomT = 3; const m = this.g.desk.micInd; const r = m && !m.classList.contains('ripped') ? m.getBoundingClientRect() : null;
      if (r && r.width) { this.g.explode(r.left + r.width / 2, r.top + r.height / 2, 1.3); this.g.fx.crack(r.left + r.width / 2, r.top - 40, 1.2); }
    }
    if (this.micBoomT > 0) { this.micBoomT -= dt; if (this.micBoomT <= 0) this.micBoomT = 0; }
  }
  // ---------- drawing ----------
  drawWorld(c) {
    const s = this.scene(); if (s !== this.g) return; this.drawFx(c);
  }
  drawFx(c) {
    for (const h of this.holes) {
      if (h.scene !== this.scene()) continue;
      const g = c.createRadialGradient(h.x, h.y, h.r * 0.6, h.x, h.y, h.r * 4.2);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.25, 'rgba(40,10,70,0.65)'); g.addColorStop(0.5, 'rgba(140,60,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, h.r * 4.2, 0, 7); c.fill();
      c.save(); c.translate(h.x, h.y); c.rotate(h.t * 2.2); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { c.rotate(2.1); c.strokeStyle = `rgba(${180 + i * 25},${120 + i * 30},255,0.35)`; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, h.r * (1.6 + i * 0.45), h.r * (0.5 + i * 0.12), 0, 0, 5.2); c.stroke(); }
      c.restore(); c.fillStyle = '#000'; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill();
    }
    if (this.active === 'laser' && this.held && this.beam) {
      const [ex, ey, bx, by] = this.beam; c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const off of [-7, 7]) for (const [w, a] of [[16, 0.12], [7, 0.4], [2.5, 1]]) { c.strokeStyle = a === 1 ? 'rgba(255,235,235,1)' : `rgba(255,30,20,${a})`; c.lineWidth = w; c.beginPath(); c.moveTo(ex + off, ey); c.lineTo(bx, by); c.stroke(); }
      c.restore();
    }
    if (this.tornado) { const T = this.tornado; c.save(); c.globalAlpha = 0.35; c.strokeStyle = '#bbb'; for (let i = 0; i < 14; i++) { const yy = T.y - 260 + i * 30, w = 30 + i * 9; c.lineWidth = 3; c.beginPath(); c.ellipse(T.x + Math.sin(T.t * 4 + i) * 12, yy, w, 8, 0, T.t * 6 + i, T.t * 6 + i + 4.5); c.stroke(); } c.restore(); }
    for (const p of this.scene().fx.p) if (p.t === 'tracer') { c.strokeStyle = 'rgba(255,240,180,0.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x2, p.y2); c.stroke(); }
    this.acidTick(this.scene());
  }
  drawCursor(c) {
    if (!this.active) return; const [x, y] = [this.g.mouse.x, this.g.mouse.y];
    const id = this.active;
    const img = this.g.cursorImg;
    if (id === 'laser') { // the mouse gets eyes
      const ex = this.held && this.eye && this.scene() === this.g ? this.eye[0] : x - 26, ey = this.held && this.eye && this.scene() === this.g ? this.eye[1] : y - 30;
      for (const o of [-7, 7]) { c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(ex + o, ey, 6, 8, 0, 0, 7); c.fill(); c.stroke(); const dx = x - ex, dy = y - ey, d = Math.hypot(dx, dy) || 1; c.fillStyle = this.held ? '#ff2a1a' : '#111'; c.beginPath(); c.arc(ex + o + dx / d * 2.5, ey + dy / d * 3, 3, 0, 7); c.fill(); if (this.held) { c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(SPR.red, ex + o - 12, ey - 12, 24, 24); c.restore(); } }
    }
    if (img) c.drawImage(img, x - this.g.cursorHot[0], y - this.g.cursorHot[1]);
    else { c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 17); c.lineTo(x + 4.5, y + 13); c.lineTo(x + 8, y + 20); c.lineTo(x + 10.5, y + 19); c.lineTo(x + 7, y + 12); c.lineTo(x + 12, y + 12); c.closePath(); c.fill(); c.stroke(); }
    c.save(); c.globalCompositeOperation = 'lighter';
    if (id === 'fire') { c.drawImage(SPR.fire, x - 10, y - 18, 28, 28); }
    if (id === 'freeze') { c.drawImage(SPR.blue, x - 8, y - 8, 28, 28); }
    if (id === 'erase') { c.globalAlpha = this.held ? 0.9 : 0.5; c.drawImage(SPR.purple, x - 46, y - 46, 92, 92); }
    if (id === 'blackhole') { c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.beginPath(); c.arc(x + 16, y + 22, 6, 0, 7); c.fill(); c.strokeStyle = 'rgba(180,120,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x + 16, y + 22, 9, 0, 7); c.stroke(); }
    if (id === 'blast') { const k = this.held ? Math.min(3, this.charge) : 0; c.globalCompositeOperation = 'source-over'; c.strokeStyle = `rgba(255,${200 - k * 50},80,0.9)`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 14 + k * 30, 0, 7); c.stroke(); }
    if (id === 'scream') { const lv = this.mic ? this.micLevel : (this.held ? Math.min(1, this.charge / 2) : 0); c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; for (let i = 1; i <= 3; i++) { c.globalAlpha = lv; c.beginPath(); c.arc(x + 14, y + 10, 8 * i + lv * 14, -0.7, 0.7); c.stroke(); } }
    if (id === 'telekinesis' && this.held) { c.globalAlpha = 0.4; c.drawImage(SPR.blue, x - 60, y - 60, 120, 120); }
    if (id === 'magnet') { c.globalCompositeOperation = 'source-over'; c.strokeStyle = '#e33'; c.lineWidth = 4; c.beginPath(); c.arc(x + 18, y + 22, 7, Math.PI, 0); c.stroke(); }
    c.restore();
  }
}
const J_PEL = 2;
