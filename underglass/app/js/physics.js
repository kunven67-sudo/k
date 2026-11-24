// Physics: Rapier 2D. Every ripped piece / item is a Body with its own picture (texture) that can be
// broken into real pieces (Voronoi), cut in half (laser), burned, frozen, shrunk, grown, glued, pinned.
import RAPIER from '../../node_modules/@dimforge/rapier2d-compat/rapier.mjs';
import { canvas, clamp, rand, polyArea, polyCentroid, polyBounds, clipHalf, hull, pointInPoly } from './util.js';

export const MATS = {
  ui: { density: 0.55, friction: 0.55, rest: 0.12, brk: 16, snd: 'impact_plastic', brkSnd: 'tear_plastic', burn: 0.6, color: '#7a7a7a' },
  glass: { density: 0.8, friction: 0.35, rest: 0.08, brk: 11, snd: 'glass_crack', brkSnd: 'glass_shatter', burn: 0.15, color: '#cfe6f0' },
  paper: { density: 0.22, friction: 0.7, rest: 0.05, brk: 12, snd: 'tear_paper', brkSnd: 'tear_paper', burn: 1.6, color: '#d8cdb8' },
  wood: { density: 0.75, friction: 0.65, rest: 0.18, brk: 24, snd: 'impact_wood', brkSnd: 'impact_wood', burn: 0.9, color: '#8a6440' },
  metal: { density: 3.2, friction: 0.4, rest: 0.18, brk: 1e9, snd: 'impact_metal', brkSnd: 'impact_metal', burn: 0, metal: true, color: '#888' },
  rubber: { density: 0.9, friction: 0.9, rest: 0.72, brk: 1e9, snd: 'thud', brkSnd: 'pop', burn: 0.4, color: '#333' },
  stone: { density: 2.6, friction: 0.8, rest: 0.08, brk: 34, snd: 'thud', brkSnd: 'thud', burn: 0, color: '#8b8680' },
  food: { density: 0.6, friction: 0.8, rest: 0.15, brk: 14, snd: 'squelch', brkSnd: 'squelch', burn: 0.5, color: '#b0402a' },
  plastic: { density: 0.5, friction: 0.5, rest: 0.3, brk: 22, snd: 'impact_plastic', brkSnd: 'tear_plastic', burn: 0.7, color: '#666' },
  ice: { density: 0.9, friction: 0.05, rest: 0.05, brk: 6, snd: 'ice_crack', brkSnd: 'ice_shatter', burn: 0, color: '#bfe8ff' },
  world: { density: 1, friction: 0.7, rest: 0.1, brk: 12, snd: 'thud', brkSnd: 'impact_wood', burn: 0.6, color: '#777' },
};
let nextId = 1;

export class Body {
  constructor() { this.id = nextId++; this.burn = 0; this.char = 0; this.frozen = 0; this.hp = 1; this.born = performance.now(); this.alpha = 1; }
  get x() { return this.rb.translation().x * this.P.ppm; }
  get y() { return this.rb.translation().y * this.P.ppm; }
  get a() { return this.rb.rotation(); }
  get vx() { return this.rb.linvel().x * this.P.ppm; }
  get vy() { return this.rb.linvel().y * this.P.ppm; }
  mass() { return this.rb.mass(); }
  toLocal(x, y) { const c = Math.cos(-this.a), s = Math.sin(-this.a), dx = x - this.x, dy = y - this.y; return [dx * c - dy * s, dx * s + dy * c]; }
  toWorld(lx, ly) { const c = Math.cos(this.a), s = Math.sin(this.a); return [this.x + lx * c - ly * s, this.y + lx * s + ly * c]; }
  contains(x, y) { const [lx, ly] = this.toLocal(x, y); return this.r ? lx * lx + ly * ly <= this.r * this.r : pointInPoly(lx, ly, this.poly); }
  area() { return this.r ? Math.PI * this.r * this.r : Math.abs(polyArea(this.poly)); }
}

export class Phys {
  static async init() { if (!Phys.ready) { await RAPIER.init(); Phys.ready = true; } }
  constructor({ ppm = 70, gravity = 20, maxBodies = 700 } = {}) {
    this.R = RAPIER; this.ppm = ppm; this.g = gravity;
    this.world = new RAPIER.World({ x: 0, y: gravity });
    this.world.integrationParameters.numSolverIterations = 6;
    this.events = new RAPIER.EventQueue(true);
    this.bodies = []; this.byCol = new Map(); this.statics = []; this.maxBodies = maxBodies;
    this.acc = 0; this.timeScale = 1; this.dt = 1 / 60;
    this.onImpact = null; this.onBreak = null; this.onRemove = null; this.onCreate = null;
    this.impactQueue = [];
  }
  m(px) { return px / this.ppm; }
  // ---------- static walls ----------
  addStaticBox(x, y, w, h, angle = 0, tag = 'wall') {
    const rb = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(this.m(x), this.m(y)).setRotation(angle));
    const col = this.world.createCollider(RAPIER.ColliderDesc.cuboid(this.m(w / 2), this.m(h / 2)).setFriction(0.8), rb);
    const s = { rb, col, tag, x, y, w, h }; this.statics.push(s); this.byCol.set(col.handle, s); return s;
  }
  addStaticPolyline(points, tag = 'ground') { // points in px
    const v = new Float32Array(points.length * 2); points.forEach((p, i) => { v[i * 2] = this.m(p[0]); v[i * 2 + 1] = this.m(p[1]); });
    const rb = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const col = this.world.createCollider(RAPIER.ColliderDesc.polyline(v).setFriction(0.9), rb);
    const s = { rb, col, tag }; this.statics.push(s); this.byCol.set(col.handle, s); return s;
  }
  removeStatic(s) { if (!s) return; this.byCol.delete(s.col.handle); this.world.removeRigidBody(s.rb); this.statics = this.statics.filter(q => q !== s); }
  // ---------- dynamic bodies ----------
  // poly: local points in px around (0,0) = centre of mass. tex: canvas drawn with its top-left at (tox,toy) local px, size tw x th px
  addPoly(poly, x, y, angle, o = {}) {
    const mat = MATS[o.mat || 'ui'];
    const v = new Float32Array(poly.length * 2); poly.forEach((p, i) => { v[i * 2] = this.m(p[0]); v[i * 2 + 1] = this.m(p[1]); });
    let cd = RAPIER.ColliderDesc.convexHull(v);
    if (!cd) { const b = polyBounds(poly); cd = RAPIER.ColliderDesc.cuboid(Math.max(0.01, this.m(b.w / 2)), Math.max(0.01, this.m(b.h / 2))); }
    return this._make(cd, x, y, angle, o, mat, (b) => { b.poly = poly; });
  }
  addCircle(r, x, y, angle, o = {}) {
    const mat = MATS[o.mat || 'rubber'];
    return this._make(RAPIER.ColliderDesc.ball(this.m(r)), x, y, angle, o, mat, (b) => { b.r = r; });
  }
  _make(cd, x, y, angle, o, mat, setShape) {
    cd.setDensity((o.density ?? mat.density) * (o.densityMul || 1)).setFriction(o.friction ?? mat.friction).setRestitution(o.rest ?? mat.rest)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(o.eventForce ?? 2);
    if (o.groups !== undefined) cd.setCollisionGroups(o.groups);
    const rd = RAPIER.RigidBodyDesc.dynamic().setTranslation(this.m(x), this.m(y)).setRotation(angle || 0)
      .setLinvel(this.m(o.vx || 0), this.m(o.vy || 0)).setAngvel(o.av || 0).setLinearDamping(o.damp ?? 0.05).setAngularDamping(o.adamp ?? 0.15).setCanSleep(true);
    if (o.ccd) rd.setCcdEnabled(true);
    const rb = this.world.createRigidBody(rd);
    const col = this.world.createCollider(cd, rb);
    const b = new Body(); b.P = this; b.rb = rb; b.col = col; setShape(b);
    b.tex = o.tex || null; b.tox = o.tox ?? 0; b.toy = o.toy ?? 0; b.tw = o.tw ?? 0; b.th = o.th ?? 0;
    b.mat = o.mat || 'ui'; b.kind = o.kind || 'piece'; b.def = o.def || null; b.layer = o.layer ?? 0; b.flags = o.flags || {};
    b.scale = o.scale || 1; b.src = o.src || null; b.label = o.label || '';
    b.brk = (o.brk ?? mat.brk);
    this.bodies.push(b); this.byCol.set(col.handle, b);
    if (this.bodies.length > this.maxBodies) this.trim();
    if (this.onCreate) this.onCreate(b);
    return b;
  }
  trim() { // too many bodies: fade out the oldest small shards
    const shards = this.bodies.filter(b => b.kind === 'piece' && !b.fading && !b.held).sort((a, b) => a.area() - b.area() || a.born - b.born);
    const n = this.bodies.length - this.maxBodies + 20;
    for (let i = 0; i < n && i < shards.length; i++) shards[i].fading = 1;
  }
  remove(b) {
    if (!b || b.dead) return; b.dead = true;
    if (b.joints) for (const j of b.joints) { try { this.world.removeImpulseJoint(j.j, true); } catch (e) { } const o = j.other; if (o && o.joints) o.joints = o.joints.filter(q => q.j !== j.j); }
    this.byCol.delete(b.col.handle); this.world.removeRigidBody(b.rb);
    const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1);
    if (this.onRemove) this.onRemove(b);
  }
  clear() { for (const b of this.bodies.slice()) this.remove(b); }
  // ---------- queries ----------
  bodyAt(x, y) { // top-most (newest) body under a point
    for (let i = this.bodies.length - 1; i >= 0; i--) { const b = this.bodies[i]; if (!b.dead && !b.noGrab && b.contains(x, y)) return b; }
    return null;
  }
  inRadius(x, y, r) { const out = []; for (const b of this.bodies) { const d = Math.hypot(b.x - x, b.y - y); if (d < r + b.radius()) out.push(b); } return out; }
  // ---------- forces ----------
  impulse(b, ix, iy, px, py) { // ix,iy in px*kg/s style units (scaled)
    if (px !== undefined) b.rb.applyImpulseAtPoint({ x: ix / this.ppm, y: iy / this.ppm }, { x: px / this.ppm, y: py / this.ppm }, true);
    else b.rb.applyImpulse({ x: ix / this.ppm, y: iy / this.ppm }, true);
  }
  setVel(b, vx, vy) { b.rb.setLinvel({ x: vx / this.ppm, y: vy / this.ppm }, true); }
  explode(x, y, radius, force, o = {}) {
    const hit = [];
    for (const b of this.bodies.slice()) {
      if (b.dead || b.pinned) continue;
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1;
      const reach = radius + b.radius() * 0.5; if (d > reach) continue;
      const k = 1 - d / reach, m = b.mass();
      const imp = force * k * Math.min(m, 4 + m * 0.3);
      this.impulse(b, dx / d * imp, dy / d * imp - imp * 0.25, b.x - dx / d * 4, b.y - dy / d * 4);
      b.rb.applyTorqueImpulse(rand(-1, 1) * imp * 0.004 * m, true);
      hit.push({ b, k });
      if (o.fire && (MATS[b.mat].burn >= 0.3 || b.def?.fireExplode) && k > 0.3) b.burn = Math.max(b.burn, 0.4 + k);
      if (o.shatter !== false && k > 0.45 && b.brk < 1e8 && !b.unbreakable && b.area() > 400) this.queueBreak(b, x, y, Math.round(3 + k * 6));
    }
    return hit;
  }
  queueBreak(b, x, y, n) { if (!b.breakQ) { b.breakQ = { x, y, n }; this.impactQueue.push(b); } }
  // ---------- step ----------
  step(dt) {
    this.acc = Math.min(this.acc + dt * this.timeScale, 0.1);
    const h = this.dt; let n = 0;
    this.world.timestep = h;
    while (this.acc >= h && n < 4) {
      this.world.step(this.events);
      this.events.drainContactForceEvents(e => {
        const f = e.totalForceMagnitude();
        const a = this.byCol.get(e.collider1()), b = this.byCol.get(e.collider2());
        for (const q of [a, b]) {
          if (!q || !(q instanceof Body) || q.dead) continue;
          const other = q === a ? b : a;
          const per = f / Math.max(0.05, q.mass()) * h; // velocity change of this body (m/s)
          if (this.onImpact) this.onImpact(q, per, other);
          const brk = q.brk * (q.frozen > 0.5 ? 0.3 : 1);
          if (per > brk && q.brk < 1e8 && !q.unbreakable && q.area() > 1400 && !q.held && performance.now() - q.born > 150) this.queueBreak(q, q.x, q.y, clamp(Math.round(1 + per / brk * 1.2 + (q.mat === 'glass' ? 2 : 0)), 2, q.mat === 'glass' ? 9 : 5));
        }
      });
      this.acc -= h; n++;
    }
    // breaks happen after the step (can't change the world during it)
    const q = this.impactQueue; this.impactQueue = [];
    for (const b of q) { if (!b.dead && b.breakQ) { const k = b.breakQ; b.breakQ = null; this.fracture(b, k.x, k.y, k.n); } }
  }
  // ---------- breaking ----------
  shapeOf(b) { // polygon of a body (circles become 18-gons)
    if (b.poly) return b.poly;
    const out = []; for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2; out.push([Math.cos(t) * b.r, Math.sin(t) * b.r]); } return out;
  }
  // make child bodies from local polygons of a parent (texture follows)
  spawnChildren(b, polys, o = {}) {
    const out = []; const minA = o.minArea ?? 140;
    const vx = b.vx, vy = b.vy, av = b.rb.angvel(), a = b.a;
    for (const p of polys) {
      if (p.length < 3) continue;
      const area = Math.abs(polyArea(p)); if (area < minA) { if (o.dust) o.dust(b, p); continue; }
      const c = polyCentroid(p); const lp = p.map(q => [q[0] - c[0], q[1] - c[1]]);
      const bb = polyBounds(p);
      let tex = null, tox = 0, toy = 0, tw = 0, th = 0;
      if (b.tex) {
        const sc = b.tex.width / Math.max(1, b.tw);
        tex = canvas(bb.w * sc + 2, bb.h * sc + 2); const x = tex.getContext('2d');
        x.scale(sc, sc); x.translate(-bb.x0, -bb.y0);
        x.beginPath(); p.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.clip();
        x.drawImage(b.tex, b.tox, b.toy, b.tw, b.th);
        tox = bb.x0 - c[0]; toy = bb.y0 - c[1]; tw = tex.width / sc; th = tex.height / sc;
      }
      const [wx, wy] = b.toWorld(c[0], c[1]);
      const kick = o.kick || 0, kd = Math.hypot(c[0], c[1]) || 1;
      const ca = Math.cos(a), sa = Math.sin(a), dxw = (c[0] * ca - c[1] * sa) / kd, dyw = (c[0] * sa + c[1] * ca) / kd;
      const nb = this.addPoly(lp, wx, wy, a, {
        tex, tox, toy, tw, th, mat: b.mat, kind: b.kind === 'item' ? 'piece' : b.kind, label: b.label, layer: b.layer, def: null, flags: { ...b.flags, explosive: false },
        vx: vx + dxw * kick + rand(-20, 20), vy: vy + dyw * kick + rand(-20, 20), av: av + rand(-2, 2), brk: (b.brk || 1) * 1.8, scale: b.scale,
      });
      nb.burn = b.burn; nb.char = b.char; nb.frozen = b.frozen; nb.parentId = b.parentId || b.id; nb.fromItem = b.fromItem || (b.kind === 'item' ? b.def?.id : null);
      out.push(nb);
    }
    return out;
  }
  fracture(b, x, y, n = 5) {
    if (b.dead) return [];
    const poly = this.shapeOf(b), bb = polyBounds(poly);
    if (Math.abs(polyArea(poly)) < 500) { return []; }
    const [lx, ly] = b.toLocal(x, y);
    const seeds = []; let tries = 0;
    while (seeds.length < n && tries++ < 200) {
      // more seeds near the hit point = small pieces there, big ones far away (like real breaking)
      const near = Math.random() < 0.55;
      const sx = near ? lx + rand(-1, 1) * bb.w * 0.35 : rand(bb.x0, bb.x1), sy = near ? ly + rand(-1, 1) * bb.h * 0.35 : rand(bb.y0, bb.y1);
      if (pointInPoly(sx, sy, poly)) seeds.push([sx, sy]);
    }
    if (seeds.length < 2) return [];
    const cells = seeds.map((s, i) => {
      let cell = poly.slice();
      for (let j = 0; j < seeds.length; j++) { if (i === j) continue; const t = seeds[j]; cell = clipHalf(cell, (s[0] + t[0]) / 2, (s[1] + t[1]) / 2, t[0] - s[0], t[1] - s[1]); if (cell.length < 3) break; }
      return cell;
    });
    const kids = this.spawnChildren(b, cells, { kick: 60, minArea: 90, dust: this.onDust });
    if (this.onBreak) this.onBreak(b, kids, x, y);
    this.remove(b);
    return kids;
  }
  // cut along the line through world points a,b (laser). returns the new halves (or [] if the line misses)
  slice(b, ax, ay, bx, by) {
    if (b.dead || b.noSlice) return [];
    const poly = this.shapeOf(b);
    const [l1x, l1y] = b.toLocal(ax, ay), [l2x, l2y] = b.toLocal(bx, by);
    const nx = -(l2y - l1y), ny = l2x - l1x;
    const A = clipHalf(poly, l1x, l1y, nx, ny), B = clipHalf(poly, l1x, l1y, -nx, -ny);
    if (A.length < 3 || B.length < 3 || Math.abs(polyArea(A)) < 60 || Math.abs(polyArea(B)) < 60) return [];
    const kids = this.spawnChildren(b, [A, B], { kick: 25, minArea: 40 });
    if (this.onBreak) this.onBreak(b, kids, (ax + bx) / 2, (ay + by) / 2, 'slice');
    this.remove(b);
    return kids;
  }
  // rebuild a body at a new size (shrink / grow ray)
  rescale(b, k) {
    const s = clamp(b.scale * k, 0.15, 6); k = s / b.scale; if (Math.abs(k - 1) < 0.01) return b;
    const o = { tex: b.tex, tox: b.tox * k, toy: b.toy * k, tw: b.tw * k, th: b.th * k, mat: b.mat, kind: b.kind, def: b.def, label: b.label, layer: b.layer, flags: b.flags,
      vx: b.vx, vy: b.vy, av: b.rb.angvel(), scale: s, brk: b.brk };
    const nb = b.r ? this.addCircle(b.r * k, b.x, b.y, b.a, o) : this.addPoly(b.poly.map(p => [p[0] * k, p[1] * k]), b.x, b.y, b.a, o);
    for (const key of ['burn', 'char', 'frozen', 'fuse', 'item', 'fromItem', 'pinned', 'cracked']) nb[key] = b[key];
    if (b.pinned) nb.rb.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    this.remove(b); return nb;
  }
  pin(b, on) { b.pinned = on; b.rb.setBodyType(on ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic, true); }
  glue(a, b) { // weld two bodies where they are now
    const pa = a.rb.translation(), pb = b.rb.translation();
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const la = this._local(a, mid), lb = this._local(b, mid);
    const jd = RAPIER.JointData.fixed(la, 0, lb, b.a - a.a);
    const j = this.world.createImpulseJoint(jd, a.rb, b.rb, true);
    (a.joints = a.joints || []).push({ j, other: b }); (b.joints = b.joints || []).push({ j, other: a });
    return j;
  }
  _local(b, p) { const t = b.rb.translation(), r = b.rb.rotation(), c = Math.cos(-r), s = Math.sin(-r), dx = p.x - t.x, dy = p.y - t.y; return { x: dx * c - dy * s, y: dx * s + dy * c }; }
}
Body.prototype.radius = function () { if (this.r) return this.r; if (this._rad === undefined || this._radPoly !== this.poly) { let m = 0; for (const p of this.poly) m = Math.max(m, Math.hypot(p[0], p[1])); this._rad = m; this._radPoly = this.poly; } return this._rad; };

// draw one body (texture + burn/ice looks)
export function drawBody(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  if (b.alpha < 1) ctx.globalAlpha = b.alpha;
  if (b.tex) ctx.drawImage(b.tex, b.tox, b.toy, b.tw, b.th);
  else { ctx.fillStyle = MATS[b.mat].color; path(ctx, b); ctx.fill(); }
  if (b.char > 0.02 || b.frozen > 0.02 || b.flash > 0) {
    path(ctx, b); ctx.save(); ctx.clip();
    if (b.char > 0.02) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(30,22,18,${Math.min(0.92, b.char)})`; ctx.fillRect(-2000, -2000, 4000, 4000); ctx.globalCompositeOperation = 'source-over'; }
    if (b.frozen > 0.02) {
      ctx.fillStyle = `rgba(170,220,255,${0.45 * b.frozen})`; ctx.fillRect(-2000, -2000, 4000, 4000);
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * b.frozen})`; ctx.lineWidth = 2; path(ctx, b); ctx.stroke();
    }
    if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${b.flash})`; ctx.fillRect(-2000, -2000, 4000, 4000); }
    ctx.restore();
  }
  if (b.selected) { ctx.strokeStyle = 'rgba(159,231,255,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); path(ctx, b); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
}
export function path(ctx, b) {
  ctx.beginPath();
  if (b.r) ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  else { const p = b.poly; ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }
}
export { RAPIER, hull };
