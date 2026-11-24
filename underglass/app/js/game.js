// The desktop game: rip the fake Windows apart, grab + throw, spawn stuff, stickmen, tools, powers.
import { ipc, clamp, rand, pick, chance, loadImage, canvas, DPR, toast, polyCentroid, hull, lerp } from './util.js';
import { Phys, drawBody, MATS, RAPIER } from './physics.js';
import { FX } from './fx.js';
import { audio } from './audio.js';
import { ITEMS, BY_ID, spawnItem, DESK_PPM, spriteImg, itemSize } from './items.js';
import { Stick, COLORS, J } from './stick.js';
import { Powers } from './powers.js';
import { firstName } from './names.js';

const RIP_MAT = { win: 'glass', start: 'glass', fly: 'glass', taskbar: 'ui', tbtn: 'ui', tray: 'ui', clock: 'ui', mic: 'ui', icon: 'ui' };
const RIP_R = { win: 8, start: 8, fly: 8, tbtn: 4, tray: 4, clock: 4, mic: 4 };

export class Game {
  constructor(desk, look) {
    this.desk = desk; this.look = look; desk.game = this;
    this.cv = document.getElementById('phys'); this.c = this.cv.getContext('2d');
    this.cur = document.getElementById('cursor'); this.cc = this.cur.getContext('2d');
    this.P = new Phys({ ppm: 70, gravity: 20 }); this.fx = new FX(); this.sticks = [];
    this.tool = 'hand'; this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, vx: 0, vy: 0 }; this.held = null; this.solids = new Map();
    this.timeScale = 1; this.spawnSize = 1; this.micOn = false;
    this.gravity = 20 * 70; this.deadlySpeed = 1500; // scene info for stickmen
    this.powers = new Powers(this);
    this.P.onImpact = (b, dv, other) => this.impact(b, dv, other);
    this.P.onBreak = (b, kids, x, y, how) => this.broke(b, kids, x, y, how);
    this.P.onDust = (b, p) => { const c = polyCentroid(p); const [wx, wy] = b.toWorld(c[0], c[1]); this.fx.bits(wx, wy, 3, b.mat === 'glass' ? ['#e8f4ff', '#bcd'] : ['#999', '#666'], 140, 2); };
    this.walls();
    this.resize(); addEventListener('resize', () => this.resize());
    this.bindInput();
  }
  resize() {
    const d = DPR();
    for (const c of [this.cv, this.cur]) { c.width = innerWidth * d; c.height = innerHeight * d; }
    if (this.floor) { this.P.removeStatic(this.floor); this.P.removeStatic(this.wl); this.P.removeStatic(this.wr); }
    this.walls();
  }
  walls() {
    const W = innerWidth, H = innerHeight;
    this.floor = this.P.addStaticBox(W / 2, H + 200, W + 2000, 400, 0, 'floor');
    this.wl = this.P.addStaticBox(-200, H / 2 - 1500, 400, H + 3000, 0, 'wall');
    this.wr = this.P.addStaticBox(W + 200, H / 2 - 1500, 400, H + 3000, 0, 'wall');
  }
  // ---------- solid parts of the fake Windows (taskbar, open windows, Start) ----------
  syncSolids() {
    const want = new Map();
    const tb = this.desk.tb; if (!tb.classList.contains('ripped') && tb.style.display !== 'none') want.set(tb, tb.getBoundingClientRect());
    for (const w of this.desk.wins) if (!w.closed && !w.min && !w.el.classList.contains('ripped')) want.set(w.el, w.el.getBoundingClientRect());
    if (this.desk.start.classList.contains('open') && !this.desk.start.classList.contains('ripped')) want.set(this.desk.start, this.desk.start.getBoundingClientRect());
    for (const [el, s] of this.solids) if (!want.has(el)) { this.P.world.removeRigidBody(s.rb); this.P.byCol.delete(s.col.handle); this.solids.delete(el); }
    for (const [el, r] of want) {
      let s = this.solids.get(el);
      if (s && (Math.abs(s.w - r.width) > 1 || Math.abs(s.h - r.height) > 1)) { this.P.world.removeRigidBody(s.rb); this.P.byCol.delete(s.col.handle); this.solids.delete(el); s = null; }
      if (!s) {
        const rb = this.P.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation((r.left + r.width / 2) / 70, (r.top + r.height / 2) / 70));
        const col = this.P.world.createCollider(RAPIER.ColliderDesc.cuboid(r.width / 140, r.height / 140).setFriction(0.8), rb);
        s = { rb, col, w: r.width, h: r.height, el, tag: 'ui' }; this.solids.set(el, s); this.P.byCol.set(col.handle, s);
        if (el === tb) col.setCollisionGroups(0x0002FFFF);
      } else s.rb.setNextKinematicTranslation({ x: (r.left + r.width / 2) / 70, y: (r.top + r.height / 2) / 70 });
    }
  }
  // ---------- scene functions the stickmen use ----------
  groundAt(x, yFrom, who) {
    const P = this.P, ray = new RAPIER.Ray({ x: x / 70, y: yFrom / 70 }, { x: 0, y: 1 });
    const hit = P.world.castRay(ray, 60, true, undefined, undefined, undefined, undefined, (col) => { const b = P.byCol.get(col.handle); return !(b && b.isStickPart); });
    if (!hit) return innerHeight; return yFrom + hit.timeOfImpact * 70;
  }
  collidePoint(x, y, r) {
    let out = null;
    if (y > innerHeight - r) { y = innerHeight - r; out = [x, y]; }
    if (x < r) { x = r; out = [x, y]; } else if (x > innerWidth - r) { x = innerWidth - r; out = [x, y]; }
    const pr = this.P.world.projectPoint({ x: x / 70, y: y / 70 }, false);
    if (pr) {
      const px = pr.point.x * 70, py = pr.point.y * 70; const dx = x - px, dy = y - py, d = Math.hypot(dx, dy) || 1e-4;
      if (pr.isInside) { return [px - dx / d * r, py - dy / d * r]; }
      if (d < r) return [px + dx / d * r, py + dy / d * r];
    }
    return out;
  }
  clampX(x) { return clamp(x, 10, innerWidth - 10); }
  get timeScaleNow() { return this.timeScale; }
  onDeath(s, cause) { audio.play('poof', { x: s.x, vol: 0.7 }); }
  // ---------- spawning ----------
  spawn(id, x, y, o = {}) {
    if (id === 'stickman' || id === 'kid') return this.spawnStick(x, y, id === 'kid');
    if (id === 'worldball') return this.spawnWorldBall(x, y);
    const it = BY_ID[id]; if (!it) return null;
    const b = spawnItem(this.P, it, x, y, { size: this.spawnSize, ...o });
    if (b) { audio.play('whoosh', { x, vol: 0.25, rate: 1.6 }); this.fx.dust(x, y + 10, 4, 0.6); }
    return b;
  }
  spawnStick(x, y, kid) {
    const sex = Math.random() < 0.5 ? 'm' : 'f';
    const s = new Stick({ scene: this, x, y, h: kid ? rand(68, 82) : rand(108, 126), kid, age: kid ? 8 : 25, sex, name: firstName(sex) });
    s.ground = this.groundAt(x, y - 10); s.knock(0, 0); this.sticks.push(s); s.brain = { t: rand(0.5, 2) };
    audio.play('pop', { x, vol: 0.4, rate: 1.3 });
    return s;
  }
  async spawnWorldBall(x, y) { if (this.worlds) return this.worlds.spawnBall(x, y); }
  // ---------- ripping the fake Windows apart ----------
  async rip(el, gx, gy, o = {}) {
    if (!el || el._ripping || el.classList.contains('ripped')) return null;
    el._ripping = true;
    const kind = el.dataset.rip; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) { el._ripping = false; return null; }
    let tex = null;
    if (kind === 'icon') tex = await this.iconTexture(el, r);
    else {
      if (kind === 'taskbar') this.desk.closeFlyouts();
      const url = await ipc.invoke('capture', { x: r.left, y: r.top, w: r.width, h: r.height });
      const im = url ? await loadImage(url) : null;
      if (im) {
        const d = DPR(); tex = canvas(r.width * d, r.height * d); const t = tex.getContext('2d');
        const rad = (RIP_R[kind] || 0) * d; t.beginPath(); t.roundRect(0, 0, tex.width, tex.height, rad); t.clip(); t.drawImage(im, 0, 0, tex.width, tex.height);
      }
    }
    if (!tex) { el._ripping = false; return null; }
    // gone from the fake Windows
    el.classList.add('ripped'); el._ripping = false;
    if (kind === 'win') { const w = this.desk.wins.find(q => q.el === el); if (w) this.desk.closeWin(w, true); }
    if (kind === 'start' || kind === 'fly') { this.desk.closeFlyouts(); }
    if (kind === 'taskbar') this.desk.tb.style.display = 'none';
    const w = r.width, h = r.height;
    const poly = kind === 'icon' ? tex._hull : [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const b = this.P.addPoly(poly, r.left + w / 2, r.top + h / 2, 0, { tex, tox: kind === 'icon' ? tex._ox : -w / 2, toy: kind === 'icon' ? tex._oy : -h / 2, tw: kind === 'icon' ? tex._w : w, th: kind === 'icon' ? tex._h : h, mat: RIP_MAT[kind] || 'ui', kind: 'piece', label: kind, density: kind === 'taskbar' ? 0.35 : undefined });
    b.ripKind = kind;
    // pieces that came out of the taskbar must not get stuck inside it
    if (['tbtn', 'tray', 'clock', 'mic'].includes(kind) || r.bottom > innerHeight - 50) { b.col.setCollisionGroups(0x0001FFFD); b.ghostTB = true; }
    audio.play(kind === 'icon' ? 'tear_paper' : 'tear_plastic', { x: gx, vol: kind === 'taskbar' || kind === 'win' ? 0.9 : 0.55, rate: kind === 'icon' ? 1.3 : rand(0.9, 1.1) });
    this.fx.bits(gx, gy, kind === 'taskbar' ? 18 : 6, kind === 'win' ? ['#ddd', '#aaa', '#fff'] : ['#333', '#555', '#888'], 160, 2);
    if (o.grab !== false && this.mouse.down) this.grab(b, gx, gy);
    if (o.vx || o.vy) this.P.setVel(b, o.vx || 0, o.vy || 0);
    return b;
  }
  async iconTexture(el, r) { // a desktop icon becomes just its picture + name (no wallpaper behind it)
    const img = el.querySelector('img'), lbl = el.querySelector('.lbl')?.textContent || '';
    const d = DPR(), W = 76, H = 74; const c = canvas(W * d, H * d), x = c.getContext('2d'); x.scale(d, d);
    if (img && img.complete) x.drawImage(img, 14, 2, 48, 48);
    else { x.fillStyle = '#333'; x.beginPath(); x.roundRect(14, 2, 48, 48, 6); x.fill(); }
    x.font = '12px "Segoe UI Variable Text","Segoe UI",sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff';
    x.shadowColor = 'rgba(0,0,0,0.95)'; x.shadowBlur = 3; x.shadowOffsetY = 1;
    const words = lbl.split(' '); let line = '', lines = [];
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > 70 && line) { lines.push(line); line = wd; } else line = t; } if (line) lines.push(line);
    lines = lines.slice(0, 2); lines.forEach((l, i) => x.fillText(l.length > 14 && i === 1 ? l.slice(0, 12) + '…' : l, 38, 64 + i * 14));
    const used = 52 + lines.length * 14 + 2;
    c._hull = [[-24, -used / 2], [24, -used / 2], [34, -used / 2 + 50], [34, used / 2], [-34, used / 2], [-34, -used / 2 + 50]];
    c._ox = -38; c._oy = -used / 2 - 0; c._w = W; c._h = H;
    return c;
  }
  // hold on the wallpaper, then pull: tear a piece of it off
  onWallHold(x, y) {
    if (this.tool !== 'hand') return;
    const poly = jagged(x, y, rand(80, 140));
    const { tex, bb } = this.desk.tearWall(poly);
    const cx = bb.x0 + bb.w / 2, cy = bb.y0 + bb.h / 2;
    const hp = hull(poly).map(p => [p[0] - cx, p[1] - cy]);
    const b = this.P.addPoly(hp, cx, cy, 0, { tex, tox: bb.x0 - cx, toy: bb.y0 - cy, tw: bb.w, th: bb.h, mat: 'paper', kind: 'piece', label: 'wallpaper' });
    audio.play('tear_paper', { x, vol: 0.9 });
    this.fx.bits(x, y, 10, ['#ddd', '#bbb', '#fff'], 120, 2);
    if (this.mouse.down) this.grab(b, x, y);
  }
  blowWall(x, y, r) { // explosion makes a hole in the wallpaper and throws the torn bits
    if (this.desk.wallAlphaAt(x, y) < 10 && chance(0.6)) return;
    const poly = jagged(x, y, r); const { tex, bb } = this.desk.tearWall(poly);
    const cx = bb.x0 + bb.w / 2, cy = bb.y0 + bb.h / 2;
    const b = this.P.addPoly(hull(poly).map(p => [p[0] - cx, p[1] - cy]), cx, cy, 0, { tex, tox: bb.x0 - cx, toy: bb.y0 - cy, tw: bb.w, th: bb.h, mat: 'paper', kind: 'piece', label: 'wallpaper' });
    this.P.fracture(b, x, y, 6);
  }
  yankWindow(win, m) { this.rip(win.el, m.clientX, m.clientY, { vx: this.mouse.vx, vy: this.mouse.vy }); }
  ripNear(x, y, r, push) { // everything of the fake Windows near a blast comes off
    const els = document.querySelectorAll('[data-rip]');
    for (const el of els) {
      if (el.classList.contains('ripped') || el.offsetParent === null && el !== this.desk.tb) continue;
      if (el.dataset.rip === 'taskbar') continue; // the bar itself only comes off if the blast is close
      const rr = el.getBoundingClientRect(); if (!rr.width) continue;
      const cx = clamp(x, rr.left, rr.right), cy = clamp(y, rr.top, rr.bottom); const d = Math.hypot(cx - x, cy - y);
      if (d < r) { const k = 1 - d / r; const ex = rr.left + rr.width / 2 - x, ey = rr.top + rr.height / 2 - y, l = Math.hypot(ex, ey) || 1; this.rip(el, rr.left + rr.width / 2, rr.top + rr.height / 2, { grab: false, vx: ex / l * push * k, vy: ey / l * push * k - push * 0.3 * k }); }
    }
    const tb = this.desk.tb.getBoundingClientRect();
    if (!this.desk.tb.classList.contains('ripped') && y > tb.top - r * 0.45 && x > -r) {
      const d = Math.max(0, tb.top - y);
      if (d < r * 0.45) this.rip(this.desk.tb, x, tb.top + 24, { grab: false, vx: rand(-100, 100), vy: -push * 0.5 });
    }
  }
  // ---------- explosions ----------
  explode(x, y, power = 1, o = {}) {
    const r = 210 * power, f = 900 * power;
    this.P.explode(x, y, r, f, { fire: o.fire !== false });
    this.ripNear(x, y, r * 0.9, 900 * power);
    if (o.wall !== false) this.blowWall(x, y, 70 * power);
    this.desk.burnWall(x, y, 60 * power, 0.9);
    for (const s of this.sticks) {
      const [cx, cy] = s.center(); const d = Math.hypot(cx - x, cy - y); if (d > r * 1.1) continue;
      const k = 1 - d / (r * 1.1); s.knock((cx - x) / (d || 1) * 1400 * k * power, (cy - y) / (d || 1) * 1400 * k * power - 600 * k);
      if (k > 0.45) s.die('explosion'); else s.hurt(k * 1.5, 'explosion');
    }
    this.fx.flash(0.35 * Math.min(1.5, power), '255,230,190'); this.fx.shake(14 * power, 0.5);
    this.fx.ring(x, y, r * 1.3, '255,220,170', 0.4, 10);
    for (let i = 0; i < 26 * power; i++) this.fx.fire(x + rand(-40, 40) * power, y + rand(-40, 40) * power, 2.2 * power, 1);
    this.fx.smoke(x, y, 2.5 * power, Math.round(10 * power)); this.fx.spark(x, y, Math.round(30 * power), 900 * power);
    this.fx.glowAt(x, y, 260 * power, 'fire', 0.5);
    audio.play(power > 1.6 ? 'big_boom' : 'explosion', { x, vol: clamp(0.6 + power * 0.3, 0.6, 1.4), rate: rand(0.85, 1.05) / Math.max(0.8, Math.min(1.2, power)), gap: 0.05 });
  }
  // ---------- physics callbacks ----------
  impact(b, dv, other) {
    if (dv > 2.2) {
      const now = performance.now(); if (now - (b.lastSnd || 0) > 90) { b.lastSnd = now; const m = MATS[b.mat]; audio.play(b.def?.squeak ? 'pop' : m.snd, { x: b.x, vol: clamp(dv / 14, 0.08, 0.9), rate: rand(0.85, 1.15) * (b.area() < 2000 ? 1.25 : 1), gap: 0.02 }); }
      if (dv > 6) this.fx.dust(b.x, b.y + b.radius() * 0.5, 2, 0.5);
    }
    const d = b.def;
    if (d && d.hitExplode && dv > d.hitExplode) b.boom = true;
    if (b.frozen > 0.6 && dv > 3.5) b.breakNow = true;
    if (b.boomOnHit && dv > 3 && performance.now() - b.born > 120) b.boom = true;
  }
  broke(b, kids, x, y, how) {
    const m = MATS[b.mat];
    if (how !== 'slice') audio.play(m.brkSnd, { x, vol: clamp(Math.sqrt(b.area()) / 120, 0.3, 1), rate: rand(0.9, 1.1), gap: 0.04 });
    this.fx.bits(x, y, Math.min(24, 4 + Math.sqrt(b.area()) / 10), b.mat === 'glass' ? ['#eaf6ff', '#cfe6f2', '#fff'] : b.mat === 'wood' ? ['#7a5634', '#a07548'] : b.mat === 'food' ? ['#c33', '#e9c46a'] : ['#555', '#888', '#bbb'], 200, 2.5);
    if (b.def?.sparks) { this.fx.spark(x, y, 18, 500); audio.play('electric', { x, vol: 0.5, dur: 0.5 }); }
    if (b.def?.fuel) { for (const k of kids) k.burn = Math.max(k.burn, 0.01); }
    if (b.def?.explosive && !b.exploded) { b.exploded = true; this.explode(b.x, b.y, b.def.explosive); }
    if (b.def?.use === 'spray') this.spray = { x: b.x, y: b.y, t: 6 };
    if (b.def?.drink) audio.play('water_splash', { x, vol: 0.5 });
  }
  // ---------- grabbing + throwing ----------
  grab(b, x, y) {
    const [lx, ly] = b.toLocal(x, y); this.held = { b, lx, ly }; b.held = true; b.rb.wakeUp();
    if (b.pinned) this.P.pin(b, false);
  }
  release() {
    if (!this.held) return;
    if (this.held.b) { const b = this.held.b; b.held = false; const v = b.rb.linvel(); const sp = Math.hypot(v.x, v.y); if (sp > 60) b.rb.setLinvel({ x: v.x / sp * 60, y: v.y / sp * 60 }, true); }
    if (this.held.s) this.held.s.release(this.mouse.vx, this.mouse.vy);
    this.held = null;
  }
  updateHeld(dt) {
    const H = this.held; if (!H) return;
    if (H.s) { H.s.holdX = this.mouse.x; H.s.holdY = this.mouse.y; if (H.s.gone) this.held = null; return; }
    const b = H.b; if (b.dead) { this.held = null; return; }
    const [ax, ay] = b.toWorld(H.lx, H.ly);
    const m = b.mass(), v = b.rb.linvel(), ppm = 70;
    const tx = (this.mouse.x - ax) / ppm * 14, ty = (this.mouse.y - ay) / ppm * 14; // wanted velocity (m/s)
    const k = Math.min(1, 0.45 * 60 * dt);
    b.rb.applyImpulseAtPoint({ x: (tx - v.x) * m * k, y: (ty - v.y - this.P.g * dt) * m * k }, { x: ax / ppm, y: ay / ppm }, true);
    b.rb.setAngvel(b.rb.angvel() * 0.92, true);
  }
  // ---------- input ----------
  bindInput() {
    let lastT = performance.now();
    addEventListener('pointermove', (e) => {
      const t = performance.now(), dt = Math.max(1, t - lastT) / 1000; lastT = t;
      const nvx = (e.clientX - this.mouse.x) / dt, nvy = (e.clientY - this.mouse.y) / dt;
      this.mouse.vx = lerp(this.mouse.vx, nvx, 0.5); this.mouse.vy = lerp(this.mouse.vy, nvy, 0.5);
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.pendingRip && this.mouse.down) {
        const pr = this.pendingRip; if (Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 12) { this.pendingRip = null; this.rip(pr.el, pr.x, pr.y); }
      }
    }, true);
    addEventListener('pointerdown', (e) => this.down(e), true);
    addEventListener('pointerup', (e) => { if (e.button === 0) { this.mouse.down = false; this.pendingRip = null; this.release(); this.powers.up(e); } }, true);
    addEventListener('contextmenu', (e) => { if (this.inGameUI(e.target)) return; if (this.placing) { e.preventDefault(); e.stopPropagation(); this.placing = null; return; } if (this.powers.active === 'resize' && !this.worldsOpen()) { e.preventDefault(); e.stopPropagation(); this.powers.resizeAt(e.clientX, e.clientY, 0.74); return; } const b = this.P.bodyAt(e.clientX, e.clientY); if (b || this.tool !== 'hand' || this.powers.active) { e.preventDefault(); e.stopPropagation(); if (b && this.tool === 'hand') this.use(b); } }, true);
    addEventListener('keydown', (e) => this.key(e));
    addEventListener('wheel', (e) => { if (this.held?.b && !this.worldsOpen()) { this.held.b.rb.setAngvel(this.held.b.rb.angvel() + Math.sign(e.deltaY) * 2.5, true); } }, { passive: true });
  }
  inGameUI(t) { return !!(t && t.closest && (t.closest('#hud') || t.closest('#hud-handle') || t.closest('#world-ui'))); }
  worldsOpen() { return this.worlds && this.worlds.inside; }
  down(e) {
    audio.resume();
    if (this.inGameUI(e.target) || this.worldsOpen()) return;
    if (e.button !== 0) return;
    this.mouse.down = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    const x = e.clientX, y = e.clientY;
    if (this.placing) { e.preventDefault(); e.stopPropagation(); this.spawn(this.placing, x, y); if (!e.shiftKey) this.placing = null; return; }
    if (this.powers.active) { e.preventDefault(); e.stopPropagation(); this.powers.down(e); return; }
    const b = this.P.bodyAt(x, y);
    const s = this.stickAt(x, y);
    const domEl = e.target.closest && e.target.closest('[data-rip]');
    if (this.tool === 'hand') {
      if (s && (!b || s.dist < 14)) { e.preventDefault(); e.stopPropagation(); this.held = { s: s.s }; s.s.hold(s.j, x, y); audio.play('punch', { x, vol: 0.15, rate: 1.5 }); return; }
      if (b) { e.preventDefault(); e.stopPropagation(); this.grab(b, x, y); if (e.detail >= 2) this.use(b); return; }
      if (domEl && !domEl.classList.contains('ripped')) {
        const k = domEl.dataset.rip;
        if (k === 'win' && e.target.closest('.title') && !e.target.closest('.cap')) return; // title bar = normal move (yank it fast to rip)
        if (k === 'win' && e.target.closest('textarea,input')) return;
        this.pendingRip = { el: domEl, x, y };
      }
      return;
    }
    // other tools work on anything under the mouse (Windows bits get ripped off first)
    e.preventDefault(); e.stopPropagation();
    const target = b || (s ? null : null);
    const act = async (tb) => { if (tb) this.applyTool(tb, x, y); };
    if (s && this.tool === 'delete') { s.s.die('deleted'); return; }
    if (s && this.tool === 'clone') { const c = this.spawnStick(x + 30, y - 20, s.s.kid); c.color = s.s.color; return; }
    if (target) return act(target);
    if (domEl && !domEl.classList.contains('ripped')) { this.rip(domEl, x, y, { grab: false }).then(nb => act(nb)); return; }
    if (this.tool === 'delete' && this.desk.wallAlphaAt(x, y) > 10) { const poly = jagged(x, y, 60); this.desk.tearWall(poly, false); audio.play('poof', { x, vol: 0.4 }); }
  }
  applyTool(b, x, y) {
    if (!b || b.dead) return;
    const t = this.tool;
    if (t === 'delete') { this.fx.glowAt(b.x, b.y, b.radius() * 1.4, 'white', 0.3); this.fx.bits(b.x, b.y, 10, ['#fff', '#ddd'], 160, 2); audio.play('poof', { x, vol: 0.5 }); this.P.remove(b); }
    else if (t === 'clone') { const nb = this.cloneBody(b); if (nb) { audio.play('pop', { x, vol: 0.4 }); } }
    else if (t === 'pin') { this.P.pin(b, !b.pinned); audio.play(b.pinned ? 'impact_metal' : 'pop', { x, vol: 0.4, rate: 1.4 }); this.fx.ring(x, y, 30, '159,231,255', 0.3, 3); }
    else if (t === 'glue') {
      if (!this.glueA || this.glueA.dead) { this.glueA = b; b.selected = true; toast('Now click the thing to glue it to'); }
      else if (this.glueA !== b) { this.P.glue(this.glueA, b); this.glueA.selected = false; this.glueA = null; audio.play('squelch', { x, vol: 0.5 }); this.fx.ring(x, y, 26, '255,230,120', 0.3, 3); }
    }
    else if (t === 'grow' || t === 'shrink') { const nb = this.P.rescale(b, t === 'grow' ? 1.35 : 0.74); audio.play('shimmer', { x, vol: 0.35, rate: t === 'grow' ? 0.7 : 1.6 }); return nb; }
  }
  cloneBody(b) {
    const o = { tex: b.tex, tox: b.tox, toy: b.toy, tw: b.tw, th: b.th, mat: b.mat, kind: b.kind, def: b.def, label: b.label, scale: b.scale, brk: b.brk };
    const nb = b.r ? this.P.addCircle(b.r, b.x + 20, b.y - 30, b.a, o) : this.P.addPoly(b.poly.map(p => p.slice()), b.x + 20, b.y - 30, b.a, o);
    nb.item = b.item; if (b.eternal) { nb.burn = 2; nb.eternal = true; } return nb;
  }
  stickAt(x, y) {
    let best = null;
    for (const s of this.sticks) { if (!s.alive || s.gone) continue; const [j, d] = s.nearestJoint(x, y); if (d < Math.max(16, s.h * 0.14) && (!best || d < best.dist)) best = { s, j, dist: d }; }
    return best;
  }
  use(b) { // right-click / double-click an item
    if (b.universe && this.worlds) { this.worlds.enter(b); return; }
    const u = b.def?.use; const x = b.x, y = b.y;
    if (u === 'pin') { if (!b.fuse) { b.fuse = 4; audio.play('beep', { x, vol: 0.5, rate: 1.6 }); toast('Pin pulled. 4 seconds.'); } }
    else if (u === 'shoot') this.powers.shootFrom(b);
    else if (u === 'cannon') this.powers.cannonFire(b);
    else if (u === 'valve') { b.rocket = b.rocket ? 0 : 6; audio.play('steam', { x, vol: 0.7 }); }
    else if (u === 'pour' || u === 'spray') { b.pour = 3; }
    else if (b.def?.glow) { b.lit = !b.lit; audio.play('pop_click', { x, vol: 0.4 }); }
    else if (b.def?.squeak) { audio.play('pop', { x, vol: 0.7, rate: 2.2 }); this.P.impulse(b, 0, -b.mass() * 300); }
  }
  key(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Tab') { e.preventDefault(); this.hud.toggle(); return; }
    if (e.key === 'Escape') { this.placing = null; if (this.worldsOpen()) return; if (this.powers.active || this.tool !== 'hand') { this.setTool('hand'); this.powers.set(null); } return; }
    if (this.worldsOpen()) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { const b = this.P.bodyAt(this.mouse.x, this.mouse.y); if (b) { const t = this.tool; this.tool = 'delete'; this.applyTool(b, this.mouse.x, this.mouse.y); this.tool = t; } }
    if (e.key.toLowerCase() === 'e') { const b = this.P.bodyAt(this.mouse.x, this.mouse.y); if (b) this.use(b); }
    if (e.key.toLowerCase() === 'q') this.hud.open('spawn');
    if (e.key.toLowerCase() === 't') { const a = this.powers.active; this.powers.active = 'slowmo'; this.powers.down({ button: 0 }); this.powers.held = false; this.powers.active = a; }
    if (e.key.toLowerCase() === 'r' && this.hud.lastSpawn) this.spawn(this.hud.lastSpawn, this.mouse.x, this.mouse.y);
    if (e.key === 'Meta') { this.desk.toggleStart(); }
    const n = parseInt(e.key); if (!isNaN(n)) this.powers.hotkey(n, e.shiftKey);
  }
  setTool(t) { this.tool = t; if (this.glueA) { this.glueA.selected = false; this.glueA = null; } if (t !== 'hand') this.powers.set(null); if (this.hud) this.hud.refresh(); }
  // ---------- clock bomb (double-click the clock) ----------
  armClockBomb(clockEl) {
    if (clockEl._bomb !== undefined) return;
    clockEl._bomb = 10; audio.play('beep', { vol: 0.6 }); toast('The clock is a bomb now. Run.');
    const t = setInterval(() => {
      if (clockEl.classList.contains('ripped')) { clearInterval(t); delete clockEl._bomb; return; }
      clockEl._bomb--; audio.play('beep', { vol: 0.5, rate: clockEl._bomb < 4 ? 1.5 : 1.1 }); this.desk.tick();
      clockEl.style.color = clockEl._bomb % 2 ? '#ff4d4d' : '';
      if (clockEl._bomb <= 0) { clearInterval(t); const r = clockEl.getBoundingClientRect(); delete clockEl._bomb; clockEl.style.color = ''; this.explode(r.left + r.width / 2, r.top + r.height / 2, 2.2); }
    }, 1000);
  }
  // ---------- power menu in the fake Start ----------
  async power(a) {
    const boot = document.getElementById('boot');
    if (a === 'shutdown') { audio.win('shutdown'); boot.classList.add('on'); boot.querySelector('.boot-logo').style.display = 'none'; await sleep(2600); this.save(); ipc.send('quit'); }
    else if (a === 'restart') { boot.classList.add('on'); boot.querySelector('.boot-logo').style.display = 'grid'; await sleep(900); this.repair(); await sleep(2600); boot.classList.remove('on'); audio.win('logon'); }
    else if (a === 'sleep' || a === 'lock') { boot.classList.add('on'); boot.querySelector('.boot-logo').style.display = 'none'; boot.querySelector('.boot-dots').style.display = 'none'; const wake = () => { boot.classList.remove('on'); boot.querySelector('.boot-dots').style.display = ''; removeEventListener('pointerdown', wake, true); removeEventListener('keydown', wake, true); audio.win('unlock'); }; setTimeout(() => { addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true); }, 400); }
  }
  repair() { // put the whole fake Windows back together (stuff you spawned stays only if it is not a ripped piece)
    for (const b of this.P.bodies.slice()) if (b.kind === 'piece') this.P.remove(b);
    for (const [el, s] of this.solids) { this.P.world.removeRigidBody(s.rb); } this.solids.clear();
    this.fx.cracks = []; this.desk.rebuild();
  }
  save() { if (this.worlds) this.worlds.saveAll(); }
  // ---------- main update + draw ----------
  update(dt) {
    if (this.worldsOpen()) { this.powers.update(dt); this.worlds.update(dt); return; }
    this.syncSolids(); this.updateHeld(dt);
    this.P.timeScale = this.timeScale; this.fx.timeScale = this.timeScale;
    this.P.step(dt);
    this.powers.update(dt);
    const ts = this.timeScale, d = dt * ts;
    for (const b of this.P.bodies.slice()) {
      if (b.dead) continue;
      if (b.y > innerHeight + 600 || b.x < -800 || b.x > innerWidth + 800) { this.P.remove(b); continue; }
      if (b.fading) { b.alpha -= dt * 0.8; if (b.alpha <= 0) { this.P.remove(b); continue; } }
      if (b.flash > 0) b.flash -= dt * 3;
      if (b.ghostTB && b.y + b.radius() < innerHeight - 52) { b.ghostTB = false; b.col.setCollisionGroups(0xFFFFFFFF); }
      if (b.breakNow) { b.breakNow = false; this.P.fracture(b, b.x, b.y, 6); continue; }
      if (b.boom && !b.exploded) { b.exploded = true; const p = b.def?.explosive || (typeof b.boomOnHit === 'number' ? b.boomOnHit : 1); const x = b.x, y = b.y; this.P.remove(b); this.explode(x, y, p); continue; }
      // fire
      const m = MATS[b.mat];
      if (b.burn > 0) {
        if (m.burn < 0.3 && !b.def?.fireExplode && !b.eternal) { b.burn = 0; continue; }
        const r = b.radius(); const n = clamp(Math.round(Math.sqrt(b.area()) / 70), 1, 4);
        for (let i = 0; i < n; i++) { if (Math.random() < 0.55 * ts) { const p = b.r ? [rand(-r, r) * 0.5, rand(-r, r) * 0.5] : b.poly[Math.floor(Math.random() * b.poly.length)]; const [px, py] = b.toWorld(p[0] * 0.8, p[1] * 0.8); this.fx.fire(px, py, clamp(r / 60, 0.6, 1.6), 1); } }
        if (!b.eternal) {
          b.char = Math.min(1, b.char + d * 0.12 * (m.burn || 0.3));
          if (m.burn > 0) b.burn += d * 0.15; else b.burn -= d * 0.3;
          if (b.char > 0.95 && m.burn > 0.5 && chance(d * 0.5)) { this.fx.smoke(b.x, b.y, 1.5, 5); this.fx.bits(b.x, b.y, 12, ['#222', '#3a2a20', '#555'], 80, 3); this.P.remove(b); continue; }
          if (b.def?.fireExplode && b.burn > (b.def.burnTime || 3)) b.boom = true;
        }
        if (Math.random() < d * 2) this.spreadFire(b);
        if (b.y < innerHeight - 30 && this.desk.wallAlphaAt(b.x, b.y) > 0 && chance(d * 3)) this.desk.burnWall(b.x, b.y, b.radius() * 0.6, 0.35);
        audio.loop('fire_loop', Math.min(0.7, 0.2 + this.P.bodies.filter(q => q.burn > 0).length * 0.04), 'fire');
      }
      if (b.frozen > 0 && b.burn > 0) { b.frozen = Math.max(0, b.frozen - d); b.burn = Math.max(0, b.burn - d * 2); this.fx.smoke(b.x, b.y, 0.6, 1, true); }
      if (b.fuse > 0) { b.fuse -= d; if (Math.random() < 0.5) this.fx.spark(...b.toWorld(0, -b.radius() * 0.8), 1, 120); if (b.fuse <= 0) { b.fuse = 0; b.boom = true; } }
      if (b.rocket > 0) { b.rocket -= d; const [ax, ay] = b.toWorld(0, b.radius() * 0.7); const fx = -Math.sin(b.a), fy = Math.cos(b.a); this.P.impulse(b, -fx * b.mass() * 2600 * d, -fy * b.mass() * 2600 * d, ax, ay); for (let i = 0; i < 2; i++) this.fx.fire(ax, ay, 0.8, 1); audio.loop('steam', 0.5, 'rocket' + b.id); if (b.rocket <= 0) audio.killLoop('rocket' + b.id); }
      if (b.pour > 0) { b.pour -= d; const [ax, ay] = b.toWorld(b.radius() * 0.4, -b.radius() * 0.3); this.fx.bits(ax, ay, 2, b.def?.fuel ? ['#c9a227', '#8a6d10'] : ['#7fc8ff', '#c9ecff'], 90, 2); if (b.def?.fuel) for (const q of this.P.bodies) if (Math.abs(q.x - ax) < 90 && q.y > ay && q.y < ay + 400 && MATS[q.mat].burn > 0 && chance(d)) q.fuel = (q.fuel || 0) + 1; }
      if (b.lit || (b.def?.glow && b.lit === undefined && b.def.id === 'street_lamp')) this.fx.glowAt(b.x, b.y - (b.def?.id === 'street_lamp' ? b.radius() * 0.8 : 0), 70, 'fire', 0.06);
    }
    if (!this.P.bodies.some(q => q.burn > 0)) audio.stopLoop('fire');
    // stickmen
    for (const s of this.sticks) { s.update(dt); this.stickBrain(s, dt); }
    this.sticks = this.sticks.filter(s => !s.gone);
    this.fx.update(dt);
    if (this.worlds) this.worlds.update(dt);
  }
  spreadFire(b) {
    for (const q of this.P.bodies) {
      if (q === b || q.burn > 0 || (MATS[q.mat].burn < 0.3 && !q.def?.fireExplode)) continue;
      const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < (q.radius() + b.radius()) * 0.9) { q.burn = 0.01 + (q.fuel ? 1 : 0); }
    }
    for (const s of this.sticks) { if (!s.alive) continue; const [cx, cy] = s.center(); if (Math.hypot(cx - b.x, cy - b.y) < b.radius() + s.h * 0.4) s.onFire = (s.onFire || 0) + 0.5; }
  }
  stickBrain(s, dt) { // desktop stickmen: wander, look at stuff, run from danger, burn, freeze
    if (!s.alive || s.gone) return;
    if (s.onFire > 0) {
      s.onFire += dt; s.burnLook = Math.min(1, s.onFire / 5); const [cx, cy] = s.center(); this.fx.fire(cx, cy, s.h / 90, 1);
      if (s.mode === 'stand') { s.act = 'panic'; if (s.target === null) s.target = clamp(s.x + rand(-400, 400), 20, innerWidth - 20); }
      if (s.onFire > 4.5) { s.die('fire'); return; }
    }
    if (s.mode !== 'stand') return;
    // danger check: something fast coming or fire close
    const br = s.brain;
    br.t -= dt;
    let danger = null;
    for (const b of this.P.bodies) { if (b.burn > 0 || b.fuse > 0) { const d = Math.abs(b.x - s.x); if (d < 260 && Math.abs(b.y - s.ground) < 300) { danger = b; break; } } }
    if (danger && s.act !== 'panic') { s.act = 'run'; s.target = clamp(s.x + Math.sign(s.x - danger.x || 1) * rand(300, 500), 20, innerWidth - 20); br.t = 2.5; return; }
    // getting hit by moving stuff = ragdoll (and maybe death)
    for (const b of this.P.bodies) {
      const sp = Math.hypot(b.vx, b.vy); if (sp < 380) continue;
      const [cx, cy] = s.center(); const d = Math.hypot(b.x - cx, b.y - cy); if (d > b.radius() + s.h * 0.35) continue;
      s.knock(b.vx * 0.8, b.vy * 0.8 - 200); const hit = sp * Math.sqrt(b.mass()) / 1600; s.hurt(hit, 'hit'); audio.play('punch', { x: s.x, vol: 0.5 }); return;
    }
    if (br.t <= 0) {
      if (s.act === 'run' || s.act === 'panic') s.act = 'idle';
      const r = Math.random();
      if (r < 0.5) { s.act = 'walk'; s.target = clamp(s.x + rand(-350, 350), 20, innerWidth - 20); br.t = rand(3, 7); }
      else if (r < 0.62) { s.act = 'dance'; s.target = null; br.t = rand(2, 4); }
      else if (r < 0.7) { s.act = 'cheer'; br.t = rand(1, 2); }
      else { s.act = 'idle'; s.target = null; br.t = rand(1.5, 4); s.headTilt = rand(-0.25, 0.25); }
    }
    if (s.act === 'walk' && s.target === null) s.act = 'idle';
  }
  draw() {
    const c = this.c, d = DPR(), W = innerWidth, H = innerHeight;
    if (this.worldsOpen()) { document.body.style.transform = ''; const cc = this.cc; cc.setTransform(d, 0, 0, d, 0, 0); cc.clearRect(0, 0, W, H); this.powers.drawCursor(cc); if (this.placing) this.drawGhost(cc); return; }
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    const [sx, sy] = this.fx.shakeOffset();
    c.translate(sx, sy);
    document.body.style.transform = sx || sy ? `translate(${sx * 0.6}px,${sy * 0.6}px)` : '';
    const bodies = this.P.bodies;
    for (const b of bodies) if (b.layer <= 0) drawBody(c, b);
    for (const s of this.sticks) s.draw(c);
    for (const b of bodies) if (b.layer > 0) drawBody(c, b);
    this.powers.drawWorld(c);
    this.fx.draw(c, W, H);
    c.setTransform(d, 0, 0, d, 0, 0); this.fx.drawCracks(c); this.fx.drawFlash(c, W, H);
    // cursor layer (powers draw their own mouse)
    const cc = this.cc; cc.setTransform(d, 0, 0, d, 0, 0); cc.clearRect(0, 0, W, H);
    this.powers.drawCursor(cc);
    if (this.placing) this.drawGhost(cc);
  }
  drawGhost(cc) {
    const id = this.placing, x = this.mouse.x, y = this.mouse.y; cc.save(); cc.globalAlpha = 0.55;
    const it = BY_ID[id];
    if (it && it.meta) { const im = spriteImg(id); const { w, h } = itemSize(it, this.worldsOpen() ? this.worlds.scene.itemPPM * this.worlds.scene.cam.z : DESK_PPM, this.spawnSize); if (im) cc.drawImage(im, x - w / 2, y - h / 2, w, h); }
    else { cc.strokeStyle = '#9fe7ff'; cc.lineWidth = 2; cc.setLineDash([5, 4]); cc.beginPath(); cc.arc(x, y, id === 'worldball' ? 34 : 22, 0, 7); cc.stroke(); }
    cc.restore();
  }
}
export function jagged(x, y, r) { const n = Math.round(rand(10, 15)), out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rand(-0.15, 0.15); const rr = r * rand(0.6, 1.15); out.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * rand(0.75, 1)]); } return out; }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
