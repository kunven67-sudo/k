// One tiny universe: a 2D side-view Earth with land, a lake, forests, a town that grows, and stickmen living their lives.
import { clamp, lerp, rand, rng, pick, chance, canvas, DPR, asset, loadImage, hull } from '../util.js';
import { Phys, drawBody, MATS, RAPIER } from '../physics.js';
import { FX, SPR } from '../fx.js';
import { audio } from '../audio.js';
import { spriteImg, spriteMeta, spawnItem, BY_ID } from '../items.js';
import { BT, ERAS, drawBuilding, pattern, floorY, buildingTop, tex } from './town.js';
import { Sim } from './people.js';

export const WPPM = 36; // world: pixels per metre at zoom 1
const HALF = 230; // world goes from -230 m to +230 m
const STEP = 2; // terrain point every 2 m
let SKY = null;
export async function loadSky() { if (SKY) return SKY; SKY = {}; await Promise.all(['day', 'sunrise', 'dusk', 'night'].map(async k => { SKY[k] = await loadImage(asset('sky/' + k + '.webp')); })); return SKY; }

export class WorldScene {
  constructor(game, data) {
    this.game = game; this.id = data.id; this.seed = data.seed; this.R = rng(this.seed);
    this.ppm = WPPM; this.itemPPM = WPPM; this.itemScale = 1;
    this.P = new Phys({ ppm: WPPM, gravity: 12, maxBodies: 600 }); this.baseGravity = 12 * WPPM; this.gravity = this.baseGravity; this.deadlySpeed = 23 * WPPM;
    this.fx = new FX(); this.fx.max = 2200; this.sticks = []; this.buildings = []; this.trees = []; this.rocks = [];
    this.cam = { x: 0, y: -3 * WPPM, z: 1.3, tx: 0, ty: -3 * WPPM, tz: 1.3 }; this.timeScale = 1; this.speed = 1;
    this.feed = []; this.sel = null;
    this.P.onImpact = (b, dv) => this.impact(b, dv);
    this.P.onBreak = (b, kids, x, y) => { audio.play(MATS[b.mat].brkSnd, { vol: this.volAt(x) * 0.8, gap: 0.05 }); this.fx.bits(x, y, 8, ['#777', '#999', '#5a4630'], 160, 2); if (b.def?.explosive && !b.exploded) { b.exploded = true; this.explode(b.x, b.y, b.def.explosive); } };
    this.genTerrain(data);
    this.sim = new Sim(this, data);
  }
  // ---------- land ----------
  genTerrain(data) {
    const R = rng(this.seed + 7);
    const n = Math.round(HALF * 2 / STEP) + 1; this.n = n;
    this.hts = data.hts ? Float32Array.from(data.hts) : new Float32Array(n);
    const o1 = R() * 100, o2 = R() * 100, o3 = R() * 100;
    this.lake = { x0: 46 * WPPM, x1: 74 * WPPM, level: 0 };
    if (!data.hts) for (let i = 0; i < n; i++) {
      const xm = -HALF + i * STEP; const town = clamp((Math.abs(xm) - 70) / 50, 0, 1);
      let h = Math.sin(xm * 0.021 + o1) * 3.2 + Math.sin(xm * 0.057 + o2) * 1.4 + Math.sin(xm * 0.13 + o3) * 0.35;
      h = lerp(h * 0.12, h, town);
      if (xm > 40 && xm < 80) { const t = (xm - 40) / 40; h = lerp(h, -0.2, 0.7) + Math.sin(t * Math.PI) * 4.2; } // the lake
      if (xm < -HALF + 12) h -= (12 - (xm + HALF)) * 1.4; if (xm > HALF - 12) h -= (12 - (HALF - xm)) * 1.4; // hills at the ends
      this.hts[i] = h * WPPM;
    }
    // water level: a bit below the lake shores
    const li0 = this.idx(40 * WPPM), li1 = this.idx(80 * WPPM); this.lake.level = Math.min(this.hts[li0], this.hts[li1]) + 0.55 * WPPM;
    this.rebuildGround();
    // trees (forests on both sides), rocks for stone
    if (data.trees) this.trees = data.trees;
    else {
      const kinds = ['tree_island', 'tree_small', 'tree_fir', 'tree_pine', 'tree_island', 'shrub2'];
      for (let xm = -HALF + 8; xm < HALF - 8; xm += rand(3, 9)) {
        const forest = Math.abs(xm) > 95 && !(xm > 36 && xm < 84);
        if (xm > 36 && xm < 84) continue;
        if (!forest && !(Math.abs(xm) > 22 && chance(0.28))) continue;
        const k = xm < -150 ? pick(['tree_fir', 'tree_pine', 'tree_fir']) : pick(kinds);
        this.trees.push({ x: xm * WPPM, k, s: rand(0.75, 1.2), hp: 1, flip: chance(0.5), grow: 1 });
      }
      for (let xm = -114; xm < -98; xm += rand(1.5, 4)) this.rocks.push({ x: xm * WPPM, s: rand(1.5, 4), hp: 1 });
    }
    if (data.rocks) this.rocks = data.rocks;
    this.mtn = [0, 1].map(k => { // smooth ridges: a few big waves + small detail, then blurred
      const r = rng(this.seed + 11 + k); const ph = [r() * 6, r() * 6, r() * 6, r() * 6]; const raw = [];
      for (let i = 0; i <= 260; i++) { const t = i / 260 * Math.PI * 2; raw.push((Math.sin(t * 3 + ph[0]) * 0.5 + Math.sin(t * 7 + ph[1]) * 0.3 + Math.sin(t * 17 + ph[2]) * 0.14 + Math.sin(t * 41 + ph[3]) * 0.05) * (k ? 26 : 42) + (r() - 0.5) * 3); }
      const pts = raw.map((v, i) => (raw[(i + 259) % 260] + v * 2 + raw[(i + 1) % 260]) / 4); return pts; });
  }
  idx(x) { return clamp(Math.round((x / WPPM + HALF) / STEP), 0, this.n - 1); }
  terrainY(x) { const f = (x / WPPM + HALF) / STEP; const i = clamp(Math.floor(f), 0, this.n - 2); const t = clamp(f - i, 0, 1); return lerp(this.hts[i], this.hts[i + 1], t); }
  rebuildGround() {
    if (this.groundCol) this.P.removeStatic(this.groundCol);
    const pts = []; for (let i = 0; i < this.n; i++) pts.push([(-HALF + i * STEP) * WPPM, this.hts[i]]);
    this.groundCol = this.P.addStaticPolyline(pts, 'ground');
    if (!this.edgeL) { this.edgeL = this.P.addStaticBox(-HALF * WPPM - 50, -2000, 100, 6000); this.edgeR = this.P.addStaticBox(HALF * WPPM + 50, -2000, 100, 6000); }
  }
  flatten(x0, x1) { // make the land flat under a new building
    const i0 = this.idx(x0) - 1, i1 = this.idx(x1) + 1; let s = 0, c = 0; for (let i = i0; i <= i1; i++) { s += this.hts[i]; c++; }
    const h = s / c; for (let i = i0; i <= i1; i++) this.hts[i] = h;
    for (let k = 1; k <= 3; k++) { const a = i0 - k, b = i1 + k; if (a >= 0) this.hts[a] = lerp(this.hts[a], h, 1 - k / 4); if (b < this.n) this.hts[b] = lerp(this.hts[b], h, 1 - k / 4); }
    this.groundDirty = true; return h;
  }
  crater(x, r, depth) { const i0 = this.idx(x - r), i1 = this.idx(x + r); for (let i = i0; i <= i1; i++) { const xm = (-HALF + i * STEP) * WPPM; const k = 1 - Math.abs(xm - x) / r; if (k <= 0) continue; if (this.buildingAt(xm)) continue; this.hts[i] += depth * k * k; } this.groundDirty = true; }
  buildingAt(x) { return this.buildings.find(b => x >= b.x - 0.5 * WPPM && x <= b.x + b.w * WPPM + 0.5 * WPPM && !b.gone); }
  inLake(x) { return x > this.lake.x0 && x < this.lake.x1 && this.terrainY(x) > this.lake.level; }
  // ---------- building colliders ----------
  addBuildingCols(b) {
    this.removeBuildingCols(b); const T = BT[b.type]; b.cols = [];
    if (!T.fl) return; const fh = T.fh * WPPM, w = b.w * WPPM;
    for (let f = 1; f <= T.fl; f++) b.cols.push(this.P.addStaticBox(b.x + w / 2, b.y - f * fh + 0.12 * WPPM, w, 0.25 * WPPM, 0, 'floor'));
    const wallH = T.fl * fh - 2.1 * WPPM; if (wallH > 0) for (const wx of [b.x, b.x + w]) b.cols.push(this.P.addStaticBox(wx, b.y - 2.1 * WPPM - wallH / 2, 0.28 * WPPM, wallH, 0, 'wall'));
    for (const c of b.cols) c.building = b;
  }
  removeBuildingCols(b) { if (b.cols) for (const c of b.cols) this.P.removeStatic(c); b.cols = null; }
  // ---------- stickman scene functions ----------
  groundAt(x, yFrom, who) {
    const t = this.terrainY(x); if (yFrom > t) return t;
    const ray = new RAPIER.Ray({ x: x / WPPM, y: yFrom / WPPM }, { x: 0, y: 1 });
    const hit = this.P.world.castRay(ray, (t - yFrom) / WPPM + 0.01, true);
    if (hit) return Math.min(t, yFrom + hit.timeOfImpact * WPPM);
    return t;
  }
  collidePoint(x, y, r) {
    let out = null; const t = this.terrainY(x);
    if (y > t - r) { y = t - r; out = [x, y]; }
    if (x < -HALF * WPPM + r) { x = -HALF * WPPM + r; out = [x, y]; } else if (x > HALF * WPPM - r) { x = HALF * WPPM - r; out = [x, y]; }
    const pr = this.P.world.projectPoint({ x: x / WPPM, y: y / WPPM }, false);
    if (pr) {
      const s = this.P.byCol.get(pr.collider.handle);
      if (!(s && s.tag === 'ground')) {
        const px = pr.point.x * WPPM, py = pr.point.y * WPPM; const dx = x - px, dy = y - py, d = Math.hypot(dx, dy) || 1e-4;
        if (pr.isInside) return [px - dx / d * r, py - dy / d * r];
        if (d < r) return [px + dx / d * r, py + dy / d * r];
      }
    }
    return out;
  }
  clampX(x) { return clamp(x, (-HALF + 3) * WPPM, (HALF - 3) * WPPM); }
  onDeath(s, cause) { audio.play('poof', { vol: this.volAt(s.x) * 0.8, gap: 0.05 }); this.sim.died(s, cause); }
  stickAt(x, y) { let best = null; for (const s of this.sticks) { if (!s.alive || s.gone) continue; const [j, d] = s.nearestJoint(x, y); if (d < Math.max(10, s.h * 0.22) && (!best || d < best.dist)) best = { s, j, dist: d }; } return best; }
  mouseWorld() { return this.toWorld(this.game.mouse.x, this.game.mouse.y); }
  toWorld(sx, sy) { return [(sx - innerWidth / 2) / this.cam.z + this.cam.x, (sy - innerHeight / 2) / this.cam.z + this.cam.y]; }
  toScreen(x, y) { return [(x - this.cam.x) * this.cam.z + innerWidth / 2, (y - this.cam.y) * this.cam.z + innerHeight / 2]; }
  skyY() { return this.cam.y - innerHeight / 2 / this.cam.z - 80; }
  volAt(x) { const d = Math.abs(x - this.cam.x) * this.cam.z / innerWidth; return this.game.worlds.inside === this ? clamp(1.2 - d, 0, 1) * clamp(this.cam.z * 1.2, 0.25, 1) : 0; }
  // ---------- damage ----------
  explode(x, y, power = 1, o = {}) {
    const r = 6 * WPPM * power, f = 1100 * power;
    this.P.explode(x, y, r, f, { fire: o.fire !== false });
    for (const s of this.sticks) { const [cx, cy] = s.center(); const d = Math.hypot(cx - x, cy - y); if (d > r * 1.2) continue; const k = 1 - d / (r * 1.2); s.knock((cx - x) / (d || 1) * 900 * k * power, (cy - y) / (d || 1) * 900 * k * power - 400 * k); if (k > 0.35) s.die('explosion'); else s.hurt(k * 1.6, 'explosion'); }
    for (const b of this.buildings) { if (b.gone) continue; const cx = b.x + b.w * WPPM / 2, cy = (b.y + buildingTop(b, WPPM)) / 2; const d = Math.max(0, Math.hypot(cx - x, cy - y) - b.w * WPPM * 0.4); if (d < r) { const k = 1 - d / r; b.hp -= k * 0.8 * power; b.char = Math.min(1, (b.char || 0) + k * 0.4); if (k > 0.3 && o.fire !== false) b.burn = Math.max(b.burn || 0, 0.3); } }
    for (const t of this.trees) { if (Math.abs(t.x - x) < r * 0.8) { t.burn = Math.max(t.burn || 0, 0.5); if (Math.abs(t.x - x) < r * 0.35) t.hp = 0; } }
    if (Math.abs(this.terrainY(x) - y) < r * 0.6) this.crater(x, r * 0.75, Math.min(3.5 * WPPM, 1.4 * WPPM * power));
    this.fx.flash(0.3 * Math.min(1.5, power), '255,230,190'); this.fx.shake(10 * power * clamp(this.cam.z, 0.3, 1), 0.5); this.fx.ring(x, y, r * 1.3, '255,220,170', 0.4, 6);
    for (let i = 0; i < 22 * power; i++) this.fx.fire(x + rand(-1, 1) * r * 0.3, y + rand(-1, 1) * r * 0.3, 1.4 * power, 1);
    this.fx.smoke(x, y, 2 * power, Math.round(10 * power)); this.fx.spark(x, y, Math.round(24 * power), 600 * power); this.fx.glowAt(x, y, r * 1.4, 'fire', 0.5);
    this.fx.dust(x, this.terrainY(x), Math.round(8 * power), 2 * power);
    audio.play(power > 1.6 ? 'big_boom' : 'explosion', { vol: clamp((0.6 + power * 0.3) * (this.volAt(x) * 0.8 + 0.2), 0, 1.4), gap: 0.05 });
    this.sim.event('bad', `An explosion went off ${this.placeName(x)}.`, x);
  }
  placeName(x) { const b = this.buildingAt(x); if (b) return 'at the ' + (BT[b.type].name.toLowerCase()); if (this.inLake(x)) return 'at the lake'; if (Math.abs(x) < 80 * WPPM) return 'in town'; return x < 0 ? 'in the west woods' : 'in the east woods'; }
  burnAt(x, y, r, amt) { const b = this.buildingAt(x); if (b && y > buildingTop(b, WPPM) - 3 * WPPM && y < b.y + 10) b.burn = Math.max(b.burn || 0, 0.2); for (const t of this.trees) if (Math.abs(t.x - x) < r + 20 && y > this.terrainY(t.x) - this.treeH(t) && y < this.terrainY(t.x) + 10) t.burn = Math.max(t.burn || 0, 0.3); }
  laserAt(ex, ey, bx, by, x, y, dt) { this.burnAt(x, y, 10, dt); const b = this.buildingAt(x); if (b && y > buildingTop(b, WPPM) && y < b.y) b.hp -= dt * 0.3; }
  eraseAt(x, y, R) { const b = this.buildingAt(x); if (b && y > buildingTop(b, WPPM) - 3 * WPPM && y < b.y + 5) b.hp -= 0.08; for (const t of this.trees) if (Math.abs(t.x - x) < R && y > this.terrainY(t.x) - this.treeH(t)) t.hp = 0, t.erased = true; if (y > this.terrainY(x) - R) this.crater(x, R * 1.2, R * 0.12); }
  frostAt(x, y, dt) { const b = this.buildingAt(x); if (b) { b.frost = Math.min(1, (b.frost || 0) + dt); b.burn = 0; } for (const t of this.trees) if (Math.abs(t.x - x) < 60) { t.frost = Math.min(1, (t.frost || 0) + dt); t.burn = 0; } }
  strikeGround(x, y) { this.burnAt(x, y, 30, 1); const b = this.buildingAt(x); if (b) { b.hp -= 0.25; b.burn = Math.max(b.burn || 0, 0.4); } }
  acidGround(p) { if (p.y >= this.terrainY(p.x) - 2) { if (chance(0.3)) this.crater(p.x, 0.8 * WPPM, 0.06 * WPPM); return true; } const b = this.buildingAt(p.x); if (b && p.y > buildingTop(b, WPPM) && p.y < b.y) { b.hp -= 0.02; b.char = Math.min(1, (b.char || 0) + 0.02); return chance(0.5); } return false; }
  quakeWorld(dt) { for (const b of this.buildings) if (!b.gone && chance(dt * 0.6)) b.hp -= rand(0.02, 0.12) * (b.era >= 3 ? 0.5 : 1); }
  treeH(t) { const m = spriteMeta(t.k); return m ? m.h * WPPM * t.s * (t.grow ?? 1) : 4 * WPPM; }
  collapse(b) { // a building falls apart into real pieces (people inside get thrown)
    b.gone = true; this.removeBuildingCols(b); const T = BT[b.type];
    const top = buildingTop(b, WPPM) - (T.fl ? 3 * WPPM : 1 * WPPM), w = b.w * WPPM, h = b.y - top;
    const c = canvas(Math.max(8, w * 0.6), Math.max(8, h * 0.6)), x = c.getContext('2d'); x.scale(0.6, 0.6); x.translate(-b.x, -top);
    drawBuilding(x, { ...b, built: 1, char: Math.max(0.2, b.char || 0) }, w, false, WPPM);
    const body = this.P.addPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], b.x + w / 2, top + h / 2, 0, { tex: c, tox: -w / 2, toy: -h / 2, tw: w, th: h, mat: b.era >= 3 ? 'stone' : b.era >= 1 ? 'stone' : 'wood', kind: 'piece' });
    const kids = this.P.fracture(body, b.x + w / 2, b.y - h * 0.3, Math.round(clamp(b.w * T.fl * 0.7, 6, 14)));
    for (const k of kids) { k.debris = true; k.burn = b.burn > 0.3 ? 0.4 : 0; }
    audio.play('big_boom', { vol: this.volAt(b.x) * 0.7 + 0.1, rate: 0.6 }); audio.play('rumble', { vol: this.volAt(b.x) });
    this.fx.dust(b.x + w / 2, b.y - h * 0.3, 30, 3); this.fx.shake(8 * this.cam.z, 0.6);
    for (const s of this.sticks) { if (s.alive && s.x > b.x - 20 && s.x < b.x + w + 20 && s.ground < b.y + 5) { s.knock(rand(-200, 200), -rand(100, 300)); if (s.ground < b.y - 2 * WPPM || chance(0.45)) s.die('collapse'); } }
    this.sim.buildingLost(b);
  }
  // ---------- physics / items ----------
  impact(b, dv) {
    if (dv > 2.5) { const now = performance.now(); if (now - (b.lastSnd || 0) > 100) { b.lastSnd = now; audio.play(MATS[b.mat].snd, { vol: clamp(dv / 16, 0.05, 0.8) * this.volAt(b.x), gap: 0.03 }); } }
    if (b.def?.hitExplode && dv > b.def.hitExplode) b.boom = true;
    if (b.boomOnHit && dv > 3 && performance.now() - b.born > 120) b.boom = true;
    if (b.frozen > 0.6 && dv > 3.5) b.breakNow = true;
    // heavy things falling on houses hurt them
    if (dv > 8 && b.mass() > 3) { const bb = this.buildingAt(b.x); if (bb && b.y > buildingTop(bb, WPPM) - 40 && b.y < bb.y) bb.hp -= dv * b.mass() * 0.0015; }
  }
  // ---------- per frame ----------
  update(dt, active) {
    const rdt = dt; dt = dt * this.speed;
    this.timeScale = this.game.timeScale;
    if (this.groundDirty) { this.groundDirty = false; this.rebuildGround(); }
    this.P.timeScale = this.timeScale * Math.min(this.speed, 3); this.P.step(rdt);
    this.fx.timeScale = this.timeScale; this.fx.update(rdt);
    const ts = this.timeScale;
    for (const b of this.P.bodies.slice()) {
      if (b.dead) continue;
      if (b.y > this.terrainY(b.x) + 30 * WPPM) { this.P.remove(b); continue; }
      if (b.fading) { b.alpha -= rdt * 0.5; if (b.alpha <= 0) { this.P.remove(b); continue; } }
      if (b.debris && performance.now() - b.born > 40000 && !b.fading) b.fading = 1;
      if (b.breakNow) { b.breakNow = false; this.P.fracture(b, b.x, b.y, 5); continue; }
      if (b.boom && !b.exploded) { b.exploded = true; const p = b.def?.explosive || (typeof b.boomOnHit === 'number' ? b.boomOnHit : 1); const x = b.x, y = b.y; this.P.remove(b); this.explode(x, y, p); continue; }
      if (b.burn > 0) {
        if (chance(0.5 * ts)) { const r = b.radius(); this.fx.fire(b.x + rand(-r, r) * 0.4, b.y + rand(-r, r) * 0.3, clamp(r / 30, 0.4, 1.6), 1); }
        if (!b.eternal) { b.char = Math.min(1, b.char + rdt * ts * 0.1); if (MATS[b.mat].burn > 0) b.burn += rdt * 0.1; else b.burn -= rdt * 0.3; if (b.char > 0.95 && MATS[b.mat].burn > 0.5 && chance(rdt)) { this.fx.smoke(b.x, b.y, 1, 4); this.P.remove(b); continue; } if (b.def?.fireExplode && b.burn > (b.def.burnTime || 3)) b.boom = true; }
        if (chance(rdt)) { const bb = this.buildingAt(b.x); if (bb && b.y > buildingTop(bb, WPPM) - 20) bb.burn = Math.max(bb.burn || 0, 0.15); }
        for (const s of this.sticks) if (s.alive && Math.abs(s.x - b.x) < b.radius() + 10 && Math.abs(s.center()[1] - b.y) < s.h * 0.6) s.onFire = Math.max(s.onFire || 0, 0.1);
      }
      if (b.fuse > 0) { b.fuse -= rdt * ts; if (chance(0.5)) this.fx.spark(b.x, b.y - b.radius(), 1, 80); if (b.fuse <= 0) b.boom = true; }
      if (b.rocket > 0) { b.rocket -= rdt * ts; const [ax, ay] = b.toWorld(0, b.radius() * 0.7); const fx = -Math.sin(b.a), fy = Math.cos(b.a); this.P.impulse(b, -fx * b.mass() * 1400 * rdt, -fy * b.mass() * 1400 * rdt, ax, ay); this.fx.fire(ax, ay, 0.5, 1); }
      if (b.flash > 0) b.flash -= rdt * 3;
    }
    // buildings: fire, damage, collapse
    for (const b of this.buildings) {
      if (b.gone) continue;
      if (b.burn > 0) {
        b.burn += rdt * ts * 0.08; b.char = Math.min(1, (b.char || 0) + rdt * ts * 0.02); b.hp -= rdt * ts * 0.012 * b.burn;
        const top = buildingTop(b, WPPM); const n = Math.min(4, Math.round(b.burn * 2));
        for (let i = 0; i < n; i++) if (chance(0.5 * ts)) this.fx.fire(b.x + rand(0, b.w * WPPM), lerp(b.y, top, rand(0.2, 1)), 1.5, 1);
        if (chance(rdt * 0.2 * b.burn)) for (const o of this.buildings) if (o !== b && !o.gone && Math.abs(o.x - b.x) < (b.w + o.w) * WPPM * 0.75) o.burn = Math.max(o.burn || 0, 0.1);
        if (b.burn > 6 && chance(rdt * 0.05)) b.burn = 0; // fire burns out
      }
      if (b.frost > 0) b.frost = Math.max(0, b.frost - rdt * 0.02);
      if (b.hp <= 0) this.collapse(b);
    }
    for (const t of this.trees) {
      if (t.burn > 0) { t.burn += rdt * 0.1; const h = this.treeH(t); if (chance(0.4 * ts)) this.fx.fire(t.x + rand(-0.3, 0.3) * h * 0.4, this.terrainY(t.x) - h * rand(0.2, 0.9), 1.3, 1); t.char = Math.min(1, (t.char || 0) + rdt * 0.05); if (t.char > 0.9) t.hp = 0; if (chance(rdt * 0.08)) for (const o of this.trees) if (o !== t && Math.abs(o.x - t.x) < 5 * WPPM) o.burn = Math.max(o.burn || 0, 0.05); }
      if (t.hp <= 0 && !t.down) { t.down = true; t.burn = 0; if (!t.erased) { this.fx.dust(t.x, this.terrainY(t.x), 6, 1.4); audio.play('impact_wood', { vol: this.volAt(t.x) * 0.6, rate: 0.6 }); } t.regrow = 0; }
      if (t.down) { t.regrow += dt / 3600 / 6; if (t.regrow > 1) { t.down = false; t.hp = 1; t.char = 0; t.erased = false; t.grow = 0.2; } }
      if (t.grow < 1) t.grow = Math.min(1, t.grow + dt / 3600 / 4);
    }
    this.sim.update(dt, rdt);
    this.walkMul = Math.max(1, this.speed / Math.min(this.speed, 2));
    for (const s of this.sticks) s.update(rdt * Math.min(this.speed, 2));
    this.sticks = this.sticks.filter(s => { if (s.gone) { this.sim.removed(s); return false; } return true; });
    if (active) this.updateCam(rdt);
  }
  // ---------- camera ----------
  updateCam(dt) {
    const c = this.cam; const k = Math.min(1, dt * 10);
    if (this.follow && this.follow.alive) { c.tx = this.follow.x; c.ty = this.follow.pts[2][1] - 40 / c.tz; }
    c.x = lerp(c.x, c.tx, k); c.y = lerp(c.y, c.ty, k); c.z = lerp(c.z, c.tz, k);
    const lim = HALF * WPPM; c.tx = clamp(c.tx, -lim, lim); c.x = clamp(c.x, -lim, lim);
  }
  // ---------- drawing ----------
  draw(ctx, W, H) {
    const c = this.cam; const hour = this.sim.hour();
    const light = dayLight(hour);
    this.drawSky(ctx, W, H, hour, light);
    const [sx, sy] = this.fx.shakeOffset();
    ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
    const vx0 = c.x - W / 2 / c.z - 50, vx1 = c.x + W / 2 / c.z + 50, vyBot = c.y + H / 2 / c.z + 50;
    // trees behind buildings
    for (const t of this.trees) if (!t.down && t.x > vx0 - 600 && t.x < vx1 + 600) this.drawTree(ctx, t);
    for (const r of this.rocks) if (r.hp > 0 && r.x > vx0 && r.x < vx1) { const im = spriteImg('boulder'), m = spriteMeta('boulder'); const w = m.w * WPPM * r.s * 0.5 * r.hp, h = m.h * WPPM * r.s * 0.5 * r.hp; ctx.drawImage(im, r.x - w / 2, this.terrainY(r.x) - h * 0.85, w, h); }
    // buildings
    const night = light < 0.45;
    for (const b of this.buildings) if (!b.gone && b.x + b.w * WPPM > vx0 && b.x < vx1) drawBuilding(ctx, b, W, night, WPPM);
    // lake
    this.drawLake(ctx, vx0, vx1, light);
    // land
    this.drawGround(ctx, vx0, vx1, vyBot, light);
    // bodies, people, effects
    for (const b of this.P.bodies) if (b.x > vx0 - 200 && b.x < vx1 + 200) drawBody(ctx, b);
    for (const s of this.sticks) if (s.x > vx0 - 100 && s.x < vx1 + 100) s.draw(ctx);
    if (this.sel && !this.sel.gone) { const s = this.sel; const p = s.pts[0]; ctx.strokeStyle = '#9fe7ff'; ctx.lineWidth = 2 / c.z; ctx.beginPath(); ctx.moveTo(p[0] - 5, p[1] - s.L.head - 12); ctx.lineTo(p[0], p[1] - s.L.head - 5); ctx.lineTo(p[0] + 5, p[1] - s.L.head - 12); ctx.stroke(); }
    this.game.powers.drawFx(ctx);
    this.fx.draw(ctx, W, H);
    // names over heads when zoomed in
    if (c.z > 1.6) { ctx.font = `${12 / c.z * 1.2}px "UG Text", sans-serif`; ctx.textAlign = 'center'; for (const s of this.sticks) if (s.alive && s.person && s.x > vx0 && s.x < vx1) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; const p = s.pts[0]; ctx.fillText(s.person.name, p[0] + 0.6 / c.z, p[1] - s.L.head - 6 / c.z + 0.6 / c.z); ctx.fillStyle = '#fff'; ctx.fillText(s.person.name, p[0], p[1] - s.L.head - 6 / c.z); } }
    ctx.restore();
    this.drawLight(ctx, W, H, light, vx0, vx1);
    this.fx.drawFlash(ctx, W, H);
  }
  drawSky(ctx, W, H, hour, light) {
    const sk = SKY; const wts = skyWeights(hour);
    ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, W, H);
    const c = this.cam; const par = -c.x * 0.03;
    for (const [k, w] of Object.entries(wts)) {
      if (w <= 0.001 || !sk[k]) continue; const im = sk[k]; const s = Math.max(W * 1.25 / im.width, H * 1.05 / im.height);
      const iw = im.width * s, ih = im.height * s; let x0 = ((par % iw) + iw) % iw - iw;
      ctx.globalAlpha = w; for (let x = x0; x < W; x += iw) ctx.drawImage(im, x, (H - ih) * 0.3 - (c.y + 200) * 0.02, iw, ih);
    }
    ctx.globalAlpha = 1;
    if (wts.night > 0) { ctx.fillStyle = `rgba(2,4,12,${wts.night * 0.4})`; ctx.fillRect(0, 0, W, H); }
    // sun + moon
    const sunA = (hour - 6) / 12 * Math.PI; const sx = W / 2 - Math.cos(sunA) * W * 0.42, syy = H * 0.75 - Math.sin(sunA) * H * 0.62;
    if (hour > 5 && hour < 19.5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(Math.sin(sunA) * 2, 0, 1); ctx.drawImage(SPR.fire, sx - 160, syy - 160, 320, 320); ctx.drawImage(SPR.white, sx - 26, syy - 26, 52, 52); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    const mA = ((hour + 12) % 24 - 6) / 12 * Math.PI; if (hour > 18.5 || hour < 6.5) { const mx = W / 2 - Math.cos(mA) * W * 0.4, my = H * 0.75 - Math.sin(mA) * H * 0.6; ctx.fillStyle = 'rgba(235,238,245,0.95)'; ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(180,185,200,0.35)'; ctx.beginPath(); ctx.arc(mx - 4, my - 3, 4, 0, 7); ctx.arc(mx + 5, my + 4, 3, 0, 7); ctx.fill(); }
    // mountains far away
    for (let k = 0; k < 2; k++) {
      const p = this.mtn[k], f = k ? 0.12 : 0.06, base = H * (k ? 0.66 : 0.6) - (c.y + 216) * (k ? 0.05 : 0.025) * c.z;
      const l = 0.22 + light * 0.78; const top = base - (k ? 130 : 230);
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let sx2 = -40; sx2 <= W + 40; sx2 += 20) { const wx = sx2 + c.x * f; const i = ((Math.floor(wx / 40) % 260) + 260) % 260; const t = smoothT((wx / 40) - Math.floor(wx / 40)); const yy = lerp(p[i], p[(i + 1) % 260], t); ctx.lineTo(sx2, base + yy * (k ? 1.4 : 2.2) - (k ? 30 : 90)); }
      ctx.lineTo(W + 40, H); ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, base + 60);
      if (k) { g.addColorStop(0, `rgb(${78 * l | 0},${92 * l | 0},${86 * l | 0})`); g.addColorStop(1, `rgb(${48 * l | 0},${62 * l | 0},${52 * l | 0})`); }
      else { g.addColorStop(0, `rgb(${168 * l | 0},${182 * l | 0},${204 * l | 0})`); g.addColorStop(0.35, `rgb(${120 * l | 0},${136 * l | 0},${160 * l | 0})`); g.addColorStop(1, `rgb(${98 * l | 0},${114 * l | 0},${136 * l | 0})`); }
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip(); ctx.globalAlpha = k ? 0.22 : 0.16; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pattern(ctx, 'dark_rock', k ? 0.9 : 0.6); ctx.translate(-c.x * f % 512, 0); ctx.fillRect(-600, top - 100, W + 1200, H); ctx.restore();
    }
    // far haze band
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H); g.addColorStop(0, `rgba(${180 * light | 0},${195 * light | 0},${215 * light | 0},0)`); g.addColorStop(1, `rgba(${150 * light | 0},${170 * light | 0},${190 * light | 0},0.35)`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
  }
  drawTree(ctx, t) {
    const im = spriteImg(t.k), m = spriteMeta(t.k); if (!im) return;
    const h = m.h * WPPM * t.s * (t.grow ?? 1), w = m.w * WPPM * t.s * (t.grow ?? 1); const y = this.terrainY(t.x);
    ctx.save(); if (t.flip) { ctx.translate(t.x * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(im, t.x - w / 2, y - h + 0.15 * WPPM, w, h);
    if (t.char > 0.05 || t.frost > 0.05) { ctx.globalCompositeOperation = 'source-atop'; } ctx.restore();
    if (t.char > 0.05) { ctx.save(); ctx.globalAlpha = Math.min(0.85, t.char); ctx.filter = 'brightness(0)'; if (t.flip) { ctx.translate(t.x * 2, 0); ctx.scale(-1, 1); } ctx.drawImage(im, t.x - w / 2, y - h + 0.15 * WPPM, w, h); ctx.restore(); }
  }
  drawLake(ctx, vx0, vx1, light) {
    const L = this.lake; if (L.x1 < vx0 || L.x0 > vx1) return;
    ctx.save(); ctx.beginPath(); const y = L.level; ctx.moveTo(L.x0, y);
    for (let x = L.x0; x <= L.x1; x += STEP * WPPM / 2) ctx.lineTo(x, Math.max(y, this.terrainY(x)));
    ctx.lineTo(L.x1, y); ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + 4 * WPPM); g.addColorStop(0, `rgba(${60 * light + 10 | 0},${110 * light + 15 | 0},${140 * light + 25 | 0},0.92)`); g.addColorStop(1, `rgba(${15 * light + 5 | 0},${40 * light + 8 | 0},${60 * light + 14 | 0},0.97)`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.2 * light})`; ctx.lineWidth = 1.5; ctx.beginPath(); const t = performance.now() / 1000;
    for (let x = L.x0; x <= L.x1; x += 8) { const yy = y + Math.sin(x * 0.05 + t * 1.4) * 1.2; if (x === L.x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    ctx.restore();
  }
  drawGround(ctx, vx0, vx1, vyBot, light) {
    const i0 = Math.max(0, this.idx(vx0) - 1), i1 = Math.min(this.n - 1, this.idx(vx1) + 1);
    const ts = 3 * WPPM / 512;
    ctx.beginPath(); ctx.moveTo((-HALF + i0 * STEP) * WPPM, vyBot + 4000);
    for (let i = i0; i <= i1; i++) ctx.lineTo((-HALF + i * STEP) * WPPM, this.hts[i]);
    ctx.lineTo((-HALF + i1 * STEP) * WPPM, vyBot + 4000); ctx.closePath();
    ctx.fillStyle = pattern(ctx, 'brown_mud_dry', ts); ctx.fill();
    ctx.save(); ctx.clip();
    // deeper = rock, darker
    ctx.fillStyle = pattern(ctx, 'dark_rock', ts); ctx.beginPath(); ctx.moveTo((-HALF + i0 * STEP) * WPPM, vyBot + 4000); for (let i = i0; i <= i1; i++) ctx.lineTo((-HALF + i * STEP) * WPPM, this.hts[i] + 7 * WPPM); ctx.lineTo((-HALF + i1 * STEP) * WPPM, vyBot + 4000); ctx.fill();
    const g = ctx.createLinearGradient(0, this.cam.y - 400, 0, this.cam.y + 1200); g.addColorStop(0, 'rgba(0,0,0,0.02)'); g.addColorStop(1, 'rgba(0,0,0,0.32)'); ctx.fillStyle = g; ctx.fillRect(vx0, this.cam.y - 2000, vx1 - vx0, 8000);
    ctx.restore();
    // top soil + grass
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,28,18,0.55)'; ctx.lineWidth = 0.45 * WPPM; ctx.beginPath();
    for (let i = i0; i <= i1; i++) { const x = (-HALF + i * STEP) * WPPM; i === i0 ? ctx.moveTo(x, this.hts[i] + 0.18 * WPPM) : ctx.lineTo(x, this.hts[i] + 0.18 * WPPM); } ctx.stroke();
    ctx.strokeStyle = '#4f7a2c'; ctx.lineWidth = 0.14 * WPPM; ctx.beginPath();
    for (let i = i0; i <= i1; i++) { const x = (-HALF + i * STEP) * WPPM; if (this.inLake(x) || this.paved(x)) { ctx.moveTo(x, this.hts[i]); continue; } ctx.lineTo(x, this.hts[i]); } ctx.stroke();
    if (this.cam.z > 0.32) {
      const ga = spriteImg('grass_a'), gc = spriteImg('grass_c'), dd = spriteImg('dandelion'); const ma = spriteMeta('grass_a');
      const step = 0.55 * WPPM; const s0 = Math.floor(vx0 / step), s1 = Math.ceil(vx1 / step);
      for (let s = s0; s <= s1; s++) {
        const x = s * step; if (this.inLake(x) || this.paved(x)) continue; const h = hash(s);
        const im = h < 0.08 && dd ? dd : h < 0.3 && gc ? gc : ga; if (!im) continue;
        const sc = 0.8 + hash(s + 99) * 0.7; const w = (im === ga ? ma.w : 0.3) * WPPM * sc, hh = w * im.height / im.width;
        ctx.drawImage(im, x - w / 2 + hash(s + 7) * 10, this.terrainY(x) - hh + 0.06 * WPPM, w, hh);
      }
    }
  }
  paved(x) { const b = this.buildingAt(x); return b && BT[b.type].fl > 0; }
  drawLight(ctx, W, H, light, vx0, vx1) {
    const dark = clamp((1 - light) * 0.8, 0, 0.66); if (dark < 0.04) return;
    const d = 0.5; if (!this.lm) { this.lm = canvas(W * d, H * d); }
    if (this.lm.width !== Math.ceil(W * d)) { this.lm.width = W * d; this.lm.height = H * d; }
    const L = this.lm.getContext('2d'); L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, this.lm.width, this.lm.height);
    L.fillStyle = `rgba(4,8,22,${dark})`; L.fillRect(0, 0, this.lm.width, this.lm.height);
    L.globalCompositeOperation = 'destination-out';
    const c = this.cam; const lights = [];
    for (const b of this.buildings) { if (b.gone || b.built < 1 || !BT[b.type].fl || b.x > vx1 || b.x + b.w * WPPM < vx0) continue; const T = BT[b.type]; const occupied = this.sticks.some(s => s.alive && s.x > b.x && s.x < b.x + b.w * WPPM && s.ground <= b.y + 2); if (!occupied && b.type !== 'bar' && b.type !== 'police' && b.type !== 'hospital') continue; for (let f = 0; f < T.fl; f++) lights.push([b.x + b.w * WPPM / 2, b.y - (f + 0.55) * T.fh * WPPM, b.w * WPPM * 0.75, 0.95]); }
    if (this.sim.era >= 3) for (let x = Math.ceil(vx0 / (18 * WPPM)) * 18 * WPPM; x < vx1; x += 18 * WPPM) if (Math.abs(x) < 90 * WPPM && !this.inLake(x)) lights.push([x, this.terrainY(x) - 3.6 * WPPM, 7 * WPPM, 0.9]);
    for (const p of this.fx.p) if (p.t === 'fire' && chance(0.25)) lights.push([p.x, p.y, 90, 0.5]);
    for (const b of this.P.bodies) if (b.burn > 0 || b.def?.glow) lights.push([b.x, b.y, 140, 0.8]);
    for (const [x, y, r, a] of lights) { const [sx, sy] = this.toScreen(x, y); const rr = r * c.z * d; if (sx < -rr * 2 || sx > W + rr * 2) continue; const g = L.createRadialGradient(sx * d, sy * d, 0, sx * d, sy * d, rr); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.fillRect(sx * d - rr, sy * d - rr, rr * 2, rr * 2); }
    ctx.drawImage(this.lm, 0, 0, W, H);
    // warm glow on top
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = dark * 0.35;
    for (const [x, y, r] of lights) { const [sx, sy] = this.toScreen(x, y); const rr = r * c.z * 0.8; if (sx < -rr || sx > W + rr) continue; ctx.drawImage(SPR.fire, sx - rr, sy - rr, rr * 2, rr * 2); }
    ctx.restore();
  }
  // ---------- saving ----------
  toJSON() { return { id: this.id, seed: this.seed, hts: Array.from(this.hts, v => Math.round(v * 10) / 10), trees: this.trees.map(t => ({ x: t.x, k: t.k, s: t.s, hp: t.hp, flip: t.flip, grow: t.grow, down: t.down, regrow: t.regrow })), rocks: this.rocks, ...this.sim.toJSON() }; }
}
function smoothT(t) { return t * t * (3 - 2 * t); }
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function dayLight(h) { if (h < 5 || h > 20.5) return 0.12; if (h < 7) return lerp(0.12, 1, (h - 5) / 2); if (h > 18.5) return lerp(1, 0.12, (h - 18.5) / 2); return 1; }
function skyWeights(h) {
  const w = { day: 0, sunrise: 0, dusk: 0, night: 0 };
  if (h < 4.5 || h >= 21) w.night = 1;
  else if (h < 6) { const t = (h - 4.5) / 1.5; w.night = 1 - t; w.sunrise = t; }
  else if (h < 8.5) { const t = (h - 6) / 2.5; w.sunrise = 1 - t; w.day = t; }
  else if (h < 17) w.day = 1;
  else if (h < 19) { const t = (h - 17) / 2; w.day = 1 - t; w.dusk = t; }
  else { const t = (h - 19) / 2; w.dusk = 1 - t; w.night = t; }
  return w;
}
