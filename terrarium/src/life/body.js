// A soft jiggly body: 17 points joined by sticks (verlet). Alive = points chase an animated pose
// with springy lag (that's the jiggle). Knocked out / dead = full floppy ragdoll.
// Limbs can be cut off at any joint: the cut point is duplicated so the limb flies away on its own.
import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';

// point indices
export const J = { head: 0, neck: 1, pelvis: 2, lSh: 3, lEl: 4, lHa: 5, rSh: 6, rEl: 7, rHa: 8, lHip: 9, lKn: 10, lFt: 11, rHip: 12, rKn: 13, rFt: 14, lToe: 15, rToe: 16 };
const BASE = 17, SPARE = 10, N = BASE + SPARE;

// rest pose for a 1.75 m person facing +Z (left side is +X)
const REST = [
  [0, 1.585, 0], [0, 1.40, 0], [0, 0.95, 0],
  [0.215, 1.36, 0], [0.245, 1.10, -0.01], [0.26, 0.86, 0.02],
  [-0.215, 1.36, 0], [-0.245, 1.10, -0.01], [-0.26, 0.86, 0.02],
  [0.10, 0.90, 0], [0.11, 0.49, 0.02], [0.11, 0.075, -0.02],
  [-0.10, 0.90, 0], [-0.11, 0.49, 0.02], [-0.11, 0.075, -0.02],
  [0.11, 0.05, 0.14], [-0.11, 0.05, 0.14],
];
const UA = 0.27, FA = 0.25, TH = 0.415, SH = 0.42;

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color();
const _basis = new THREE.Matrix4();
const _mh = new THREE.Matrix4();

function quatFromTo(dir) { return _q.setFromUnitVectors(UP, dir); }

// two-bone IK: shoulder S, target T, lengths a,b, pole hint P -> writes elbow into out
function ik(S, T, a, b, P, out) {
  _a.subVectors(T, S);
  let d = _a.length();
  const maxd = (a + b) * 0.999;
  if (d > maxd) { _a.multiplyScalar(maxd / d); d = maxd; }
  if (d < 1e-6) { out.copy(S).addScaledVector(P, a); return; }
  _a.divideScalar(d);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  _b.copy(P).addScaledVector(_a, -P.dot(_a)).normalize();
  out.copy(S).addScaledVector(_a, x).addScaledVector(_b, h);
}

export class Body {
  constructor(look, sink, opts = {}) {
    this.look = look;
    this.sink = sink;
    this.slot = sink.alloc();
    this.scale = opts.scale ?? 1;          // world size factor (1 = normal person)
    this.p = new Float32Array(N * 3);      // positions
    this.o = new Float32Array(N * 3);      // previous positions
    this.t = new Float32Array(BASE * 3);   // animation targets
    this.used = BASE;
    this.mode = 'anim';                    // anim | rag
    this.ragT = 0;
    this.getup = 0;
    this.sleepT = 0;
    this.asleep = false;
    this.cons = [];
    this.pins = new Map();
    this.cut = new Set();                  // joints that have been cut
    this.stumps = [];                      // {a: particle on body, b: particle toward the cut piece, piece:bool}
    this.segs = [];
    this.jig = 0; this.jigV = 0; this.lastPelvisVy = 0;
    this.face = { smile: 0, brow: 0, open: 0, closed: 0, blink: 0, lookX: 0, lookY: 0, angry: 0, sad: 0, scared: 0 };
    this.headQ = new THREE.Quaternion();
    this.headSpin = new THREE.Vector3();
    this.headLoose = false;
    this.halves = false;
    this.hidden = false;
    this.tint = null;
    this.radius = 0.09;
    this.groundFn = null;
    this.bounds = null;
    this.ground = 0;
    this.lastImpact = 0;
    this.build(opts.pos || new THREE.Vector3(), opts.yaw || 0);
    this.applyColors();
  }

  get sc() { return this.scale * this.look.height; }

  build(pos, yaw) {
    const sc = this.sc, wf = 1 + this.look.fat * 0.22;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let i = 0; i < BASE; i++) {
      let [x, y, z] = REST[i];
      if (i !== J.head && i !== J.neck && i !== J.pelvis) x *= wf;
      if (i === J.head) y = 1.40 + (0.185 * this.look.headScale);
      const wx = (x * cy + z * sy) * sc + pos.x, wz = (-x * sy + z * cy) * sc + pos.z, wy = y * sc + pos.y;
      this.p[i * 3] = this.o[i * 3] = wx; this.p[i * 3 + 1] = this.o[i * 3 + 1] = wy; this.p[i * 3 + 2] = this.o[i * 3 + 2] = wz;
    }
    this.cons.length = 0;
    const rigid = [J.neck, J.pelvis, J.lSh, J.rSh, J.lHip, J.rHip];
    for (let i = 0; i < rigid.length; i++) for (let k = i + 1; k < rigid.length; k++) this.link(rigid[i], rigid[k], 1, 'torso');
    this.link(J.head, J.neck, 1, 'neck'); this.link(J.head, J.lSh, 0.5, 'neck'); this.link(J.head, J.rSh, 0.5, 'neck');
    this.link(J.lSh, J.lEl, 1, 'lUA'); this.link(J.lEl, J.lHa, 1, 'lFA');
    this.link(J.rSh, J.rEl, 1, 'rUA'); this.link(J.rEl, J.rHa, 1, 'rFA');
    this.link(J.lHip, J.lKn, 1, 'lTH'); this.link(J.lKn, J.lFt, 1, 'lSH'); this.link(J.lFt, J.lToe, 1, 'lFT'); this.link(J.lKn, J.lToe, 0.4, 'lFT');
    this.link(J.rHip, J.rKn, 1, 'rTH'); this.link(J.rKn, J.rFt, 1, 'rSH'); this.link(J.rFt, J.rToe, 1, 'rFT'); this.link(J.rKn, J.rToe, 0.4, 'rFT');
    // soft limits so ragdolls don't fold into a ball
    this.link(J.lHa, J.lSh, 0.05, 'lFA', 0.5); this.link(J.rHa, J.rSh, 0.05, 'rFA', 0.5);
    this.link(J.lFt, J.lHip, 0.05, 'lSH', 0.6); this.link(J.rFt, J.rHip, 0.05, 'rSH', 0.6);
    this.link(J.head, J.pelvis, 0.08, 'neck', 0.85);
    // render segments: [part, side, a, b]
    this.segs = [
      ['upperArm', 0, J.lSh, J.lEl, 'lUA'], ['forearm', 0, J.lEl, J.lHa, 'lFA'],
      ['upperArm', 1, J.rSh, J.rEl, 'rUA'], ['forearm', 1, J.rEl, J.rHa, 'rFA'],
      ['thigh', 0, J.lHip, J.lKn, 'lTH'], ['shin', 0, J.lKn, J.lFt, 'lSH'],
      ['thigh', 1, J.rHip, J.rKn, 'rTH'], ['shin', 1, J.rKn, J.rFt, 'rSH'],
    ].map(([part, side, a, b, tag]) => ({ part, side, a, b, tag }));
    this.hand = [J.lHa, J.rHa];
    this.feet = [[J.lFt, J.lToe], [J.rFt, J.rToe]];
    this.headIdx = J.head;
  }

  // minFrac: one-sided stick (only stops getting closer than len*minFrac)
  link(a, b, k, tag, minFrac = 0) {
    const dx = this.p[a * 3] - this.p[b * 3], dy = this.p[a * 3 + 1] - this.p[b * 3 + 1], dz = this.p[a * 3 + 2] - this.p[b * 3 + 2];
    const len = Math.hypot(dx, dy, dz);
    this.cons.push({ a, b, len: minFrac ? len * minFrac : len, k, tag, min: !!minFrac });
  }

  // ------------------------------------------------------------- colors
  applyColors() {
    const L = this.look, s = this.sink, sl = this.slot;
    const c = (hex) => {
      _col.set(hex);
      if (this.tint) _col.lerp(_col.clone().set(this.tint.color), this.tint.amt);
      return _col;
    };
    const longSleeve = L.top === 'long' || L.top === 'hoodie' || L.top === 'uniform' || L.top === 'suit' || L.top === 'coat';
    const tank = L.top === 'tank';
    s.color('torso', sl, 0, c(L.shirt));
    s.color('half', sl, 0, c(L.shirt)); s.color('half', sl, 1, c(L.pants));
    s.color('pelvis', sl, 0, c(L.pants));
    s.color('head', sl, 0, c(L.skin));
    s.color('nose', sl, 0, c(new THREE.Color(L.skin).multiplyScalar(0.92).getHex()));
    for (let i = 0; i < 2; i++) {
      s.color('eye', sl, i, c(0xf8f8f4)); s.color('pupil', sl, i, c(L.eyes));
      s.color('brow', sl, i, c(L.hairColor)); s.color('ear', sl, i, c(L.skin));
      s.color('upperArm', sl, i, c(tank ? L.skin : L.shirt)); s.color('forearm', sl, i, c(longSleeve ? L.shirt : L.skin));
      s.color('hand', sl, i, c(L.gloves || L.skin));
      s.color('thigh', sl, i, c(L.bottom === 'skirt' ? L.skin : L.pants));
      s.color('shin', sl, i, c(L.bottom === 'long' ? L.pants : L.skin));
      s.color('foot', sl, i, c(L.shoes));
      s.color('shoulder', sl, i, c(tank ? L.skin : L.shirt));
    }
    s.color('mouth', sl, 0, c(0x6a1d22));
    for (let i = 0; i < 8; i++) s.color('stump', sl, i, c(0xa3121b));
    if (L.hair !== 'bald') s.color('hair_' + L.hair, sl, 0, c(L.hairColor));
    if (L.beard) s.color('beard', sl, 0, c(L.hairColor));
    if (L.mustache) s.color('mustache', sl, 0, c(L.hairColor));
    if (L.glasses) s.color('glasses', sl, 0, c(0x1a1a1a));
    if (L.goggles) s.color('goggles', sl, 0, c(0x2b6e5e));
    if (L.hat) s.color('hat_' + L.hat, sl, 0, c(L.hatColor || 0x222222));
    if (L.bottom === 'skirt') s.color('skirt', sl, 0, c(L.pants));
    if (L.coat) s.color('coat', sl, 0, c(L.coat));
    if (L.pack) s.color('pack', sl, 0, c(L.pack));
  }

  setTint(color, amt) {
    const nt = color == null ? null : { color, amt };
    if (JSON.stringify(nt) === JSON.stringify(this.tint)) return;
    this.tint = nt; this.applyColors();
  }

  // ------------------------------------------------------------- simulation
  P(i, v) { return v.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); }
  setP(i, x, y, z) { this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; }
  center(v) { return this.P(J.pelvis, v); }

  ragdoll(time = 2) {
    this.mode = 'rag';
    this.ragT = Math.max(this.ragT, time);
    this.wake();
  }

  wake() { this.asleep = false; this.sleepT = 0; }

  // push points near `at` (world) with velocity vel (m/s)
  impulse(at, vel, radius, dt = 1 / 60) {
    this.wake();
    const r2 = radius * radius;
    for (let i = 0; i < this.used; i++) {
      const dx = this.p[i * 3] - at.x, dy = this.p[i * 3 + 1] - at.y, dz = this.p[i * 3 + 2] - at.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const f = d2 < r2 ? 1 : Math.max(0, 1 - (Math.sqrt(d2) - radius) / (radius * 3)) * 0.6;
      if (f <= 0) continue;
      this.o[i * 3] -= vel.x * dt * f; this.o[i * 3 + 1] -= vel.y * dt * f; this.o[i * 3 + 2] -= vel.z * dt * f;
    }
  }

  // whole-body velocity (throwing, explosions)
  push(vel, dt = 1 / 60) {
    this.wake();
    for (let i = 0; i < this.used; i++) { this.o[i * 3] -= vel.x * dt; this.o[i * 3 + 1] -= vel.y * dt; this.o[i * 3 + 2] -= vel.z * dt; }
  }

  velocity(i, out, dt = 1 / 60) {
    return out.set((this.p[i * 3] - this.o[i * 3]) / dt, (this.p[i * 3 + 1] - this.o[i * 3 + 1]) / dt, (this.p[i * 3 + 2] - this.o[i * 3 + 2]) / dt);
  }

  pin(i, pos) { this.pins.set(i, pos.clone()); this.wake(); }
  unpin() { this.pins.clear(); }

  teleport(dx, dy, dz) {
    for (let i = 0; i < this.used; i++) {
      this.p[i * 3] += dx; this.p[i * 3 + 1] += dy; this.p[i * 3 + 2] += dz;
      this.o[i * 3] += dx; this.o[i * 3 + 1] += dy; this.o[i * 3 + 2] += dz;
    }
  }

  // change world size around the pelvis (shrink ray). Keeps the pose.
  rescale(newScale) {
    const k = newScale / this.scale;
    if (!isFinite(k) || k === 1) return;
    const cx = this.p[J.pelvis * 3], cz = this.p[J.pelvis * 3 + 2];
    const gy = this.ground;
    for (let i = 0; i < this.used; i++) {
      for (const arr of [this.p, this.o]) {
        arr[i * 3] = cx + (arr[i * 3] - cx) * k;
        arr[i * 3 + 1] = gy + (arr[i * 3 + 1] - gy) * k;
        arr[i * 3 + 2] = cz + (arr[i * 3 + 2] - cz) * k;
      }
    }
    for (const c of this.cons) c.len *= k;
    this.scale = newScale;
    this.wake();
  }

  // dt is already scaled by game speed. g = gravity for this size.
  simulate(dt, g, animRate) {
    if (this.asleep && !this.pins.size) return;
    const rag = this.mode === 'rag';
    const n = this.used;
    const p = this.p, o = this.o, t = this.t;
    const dt2 = dt * dt;
    let maxV = 0;
    const loose = this.loosePoints;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const free = rag || i >= BASE || (loose && loose.has(i));
      const damp = free ? 0.992 : 0.9;
      const vx = (p[i3] - o[i3]) * damp, vy = (p[i3 + 1] - o[i3 + 1]) * damp, vz = (p[i3 + 2] - o[i3 + 2]) * damp;
      o[i3] = p[i3]; o[i3 + 1] = p[i3 + 1]; o[i3 + 2] = p[i3 + 2];
      const follow = !rag && i < BASE && !(loose && loose.has(i));
      if (follow) {
        // springy chase of the animation target = jiggle
        const k = 1 - Math.exp(-animRate * dt);
        p[i3] += vx * 0.35 + (t[i3] - p[i3]) * k;
        p[i3 + 1] += vy * 0.35 + (t[i3 + 1] - p[i3 + 1]) * k;
        p[i3 + 2] += vz * 0.35 + (t[i3 + 2] - p[i3 + 2]) * k;
      } else {
        p[i3] += vx; p[i3 + 1] += vy - g * dt2; p[i3 + 2] += vz;
      }
      const v2 = vx * vx + vy * vy + vz * vz;
      if (v2 > maxV) maxV = v2;
    }
    const iters = rag ? 6 : 2;
    for (let it = 0; it < iters; it++) {
      for (const c of this.cons) {
        const a3 = c.a * 3, b3 = c.b * 3;
        const dx = p[b3] - p[a3], dy = p[b3 + 1] - p[a3 + 1], dz = p[b3 + 2] - p[a3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        if (c.min && d >= c.len) continue;
        const diff = ((d - c.len) / d) * 0.5 * c.k;
        p[a3] += dx * diff; p[a3 + 1] += dy * diff; p[a3 + 2] += dz * diff;
        p[b3] -= dx * diff; p[b3 + 1] -= dy * diff; p[b3 + 2] -= dz * diff;
      }
      for (const [i, pos] of this.pins) { p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z; }
      this.collide(rag, loose);
    }
    // landing squash for the jiggle
    const vy = (p[J.pelvis * 3 + 1] - o[J.pelvis * 3 + 1]) / Math.max(dt, 1e-4);
    const acc = (vy - this.lastPelvisVy) / Math.max(this.sc, 0.01);
    this.lastPelvisVy = vy;
    this.jigV += clamp(acc * 0.0025, -0.4, 0.4);
    this.jigV += (-this.jig * 160 - this.jigV * 9) * dt;
    this.jig = clamp(this.jig + this.jigV * dt, -0.18, 0.18);
    if (rag && !this.pins.size) {
      const rel = Math.sqrt(maxV) / Math.max(dt, 1e-4) / Math.max(this.sc, 0.005);
      if (rel < 0.25) { this.sleepT += dt; if (this.sleepT > 1.2 && this.dead) this.asleep = true; } else this.sleepT = 0;
    }
  }

  collide(ragAll, loose) {
    const p = this.p, o = this.o;
    const gf = this.groundFn;
    const r = this.radius * this.sc;
    let impact = 0;
    for (let i = 0; i < this.used; i++) {
      const i3 = i * 3;
      const rr = i === J.pelvis || i === J.neck ? r * 1.6 : i === J.head ? r * 1.7 * this.look.headScale : r;
      if (this.bounds) {
        const b = this.bounds;
        if (p[i3] < b.x0 + rr) p[i3] = b.x0 + rr; else if (p[i3] > b.x1 - rr) p[i3] = b.x1 - rr;
        if (p[i3 + 2] < b.z0 + rr) p[i3 + 2] = b.z0 + rr; else if (p[i3 + 2] > b.z1 - rr) p[i3 + 2] = b.z1 - rr;
        if (b.y1 != null && p[i3 + 1] > b.y1 - rr) p[i3 + 1] = b.y1 - rr;
      }
      const gy = gf ? gf(p[i3], p[i3 + 2], p[i3 + 1] + rr * 2) : 0;
      if (p[i3 + 1] < gy + rr) {
        const vy = o[i3 + 1] - p[i3 + 1];
        if (vy > impact) impact = vy;
        p[i3 + 1] = gy + rr;
        if (ragAll || (loose && loose.has(i)) || i >= BASE) {
          // ground friction
          o[i3] = lerp(o[i3], p[i3], 0.35); o[i3 + 2] = lerp(o[i3 + 2], p[i3 + 2], 0.35);
          if (o[i3 + 1] < p[i3 + 1]) o[i3 + 1] = p[i3 + 1] + vy * 0.25;
        }
      }
    }
    if (impact > this.lastImpact) this.lastImpact = impact;
  }

  // ------------------------------------------------------------- cutting
  // joints: neck, lShoulder, rShoulder, lElbow, rElbow, lHip, rHip, lKnee, rKnee, waist
  canCut(joint) { return !this.cut.has(joint) && !this.isGone(joint); }

  isGone(joint) {
    const parents = { lElbow: 'lShoulder', rElbow: 'rShoulder', lKnee: 'lHip', rKnee: 'rHip' };
    return parents[joint] ? this.cut.has(parents[joint]) : false;
  }

  dup(i) {
    if (this.used >= N) return -1;
    const k = this.used++;
    for (const arr of [this.p, this.o]) { arr[k * 3] = arr[i * 3]; arr[k * 3 + 1] = arr[i * 3 + 1]; arr[k * 3 + 2] = arr[i * 3 + 2]; }
    return k;
  }

  // Cut a limb off. Returns the list of points that flew away (for blood + physics).
  sever(joint) {
    if (!this.canCut(joint)) return null;
    this.cut.add(joint);
    this.wake();
    const repoint = (tag, from, to) => {
      for (const c of this.cons) if (c.tag === tag) { if (c.a === from) c.a = to; if (c.b === from) c.b = to; }
      for (const s of this.segs) if (s.tag === tag) { if (s.a === from) s.a = to; if (s.b === from) s.b = to; }
    };
    const dropTags = (tags) => { this.cons = this.cons.filter((c) => !(tags.includes(c.tag) && c.min)); };
    let k = -1, base = -1, loose = [], aIn = -1, bIn = -1;
    switch (joint) {
      case 'lShoulder': case 'rShoulder': {
        const L = joint[0] === 'l'; const sh = L ? J.lSh : J.rSh;
        k = this.dup(sh); if (k < 0) return null; base = sh;
        repoint(L ? 'lUA' : 'rUA', sh, k); dropTags([L ? 'lFA' : 'rFA']);
        loose = [k, L ? J.lEl : J.rEl, L ? J.lHa : J.rHa];
        if (this.cut.has(L ? 'lElbow' : 'rElbow')) loose.length = 2;
        aIn = L ? J.rSh : J.lSh; bIn = L ? J.lEl : J.rEl;
        break;
      }
      case 'lElbow': case 'rElbow': {
        const L = joint[0] === 'l'; const el = L ? J.lEl : J.rEl;
        k = this.dup(el); if (k < 0) return null; base = el;
        repoint(L ? 'lFA' : 'rFA', el, k); dropTags([L ? 'lFA' : 'rFA']);
        loose = [k, L ? J.lHa : J.rHa];
        aIn = L ? J.lSh : J.rSh; bIn = L ? J.lHa : J.rHa;
        break;
      }
      case 'lHip': case 'rHip': {
        const L = joint[0] === 'l'; const hp = L ? J.lHip : J.rHip;
        k = this.dup(hp); if (k < 0) return null; base = hp;
        repoint(L ? 'lTH' : 'rTH', hp, k); dropTags([L ? 'lSH' : 'rSH']);
        loose = [k, L ? J.lKn : J.rKn, L ? J.lFt : J.rFt, L ? J.lToe : J.rToe];
        if (this.cut.has(L ? 'lKnee' : 'rKnee')) loose.length = 2;
        aIn = J.neck; bIn = L ? J.lKn : J.rKn;
        break;
      }
      case 'lKnee': case 'rKnee': {
        const L = joint[0] === 'l'; const kn = L ? J.lKn : J.rKn;
        k = this.dup(kn); if (k < 0) return null; base = kn;
        repoint(L ? 'lSH' : 'rSH', kn, k); repoint(L ? 'lFT' : 'rFT', kn, k); dropTags([L ? 'lSH' : 'rSH']);
        loose = [k, L ? J.lFt : J.rFt, L ? J.lToe : J.rToe];
        aIn = L ? J.lHip : J.rHip; bIn = L ? J.lFt : J.rFt;
        break;
      }
      case 'neck': {
        this.cons = this.cons.filter((c) => c.tag !== 'neck');
        base = J.neck; k = J.head; loose = [J.head];
        aIn = J.pelvis; bIn = J.head;
        this.headLoose = true;
        this.headSpin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        break;
      }
      case 'waist': {
        const wu = this.dup(J.pelvis), wl = this.dup(J.pelvis); if (wl < 0) return null;
        // put both new points in the middle of the torso
        for (const w of [wu, wl]) for (const arr of [this.p, this.o]) for (let a = 0; a < 3; a++) arr[w * 3 + a] = (arr[J.neck * 3 + a] + arr[J.pelvis * 3 + a]) / 2;
        const upper = [J.neck, J.lSh, J.rSh], lower = [J.pelvis, J.lHip, J.rHip];
        this.cons = this.cons.filter((c) => !(c.tag === 'torso' && ((upper.includes(c.a) && lower.includes(c.b)) || (upper.includes(c.b) && lower.includes(c.a)))));
        this.cons = this.cons.filter((c) => !(c.tag === 'neck' && c.min));
        for (const u of upper) this.link(u, wu, 1, 'torsoU');
        this.link(J.lSh, wu, 1, 'torsoU'); this.link(J.rSh, wu, 1, 'torsoU');
        for (const l of lower) this.link(l, wl, 1, 'torsoL');
        this.halves = { wu, wl };
        this.stumps.push({ a: wu, aIn: J.neck, b: wl, bIn: J.pelvis, flip: true });
        this.ragdoll(99);
        return { base: wu, piece: wl, loose: [wl, J.pelvis, J.lHip, J.rHip] };
      }
      default: return null;
    }
    this.stumps.push({ a: base, aIn, b: k, bIn, joint });
    if (!this.loosePoints) this.loosePoints = new Set();
    for (const i of loose) this.loosePoints.add(i);
    return { base, piece: k, loose };
  }

  limbOK(side, which) {
    // which: 'hand' | 'leg'
    if (which === 'hand') return !this.cut.has(side + 'Shoulder') && !this.cut.has(side + 'Elbow');
    return !this.cut.has(side + 'Hip') && !this.cut.has(side + 'Knee');
  }

  // ------------------------------------------------------------- rendering
  render(time) {
    const s = this.sink, sl = this.slot;
    if (this.hidden) { this.hideAll(); return; }
    const sc = this.sc, L = this.look;
    const wf = 1 + L.fat * 0.35;
    const p = this.p;
    const v = (i, out) => out.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);

    // torso basis
    const neck = v(J.neck, _a.clone()), pel = v(J.pelvis, _b.clone());
    const up = _c.subVectors(neck, pel); const tl = up.length() || 1e-6; up.divideScalar(tl);
    const side = v(J.lSh, _d).sub(v(J.rSh, _e)).normalize();
    const fwd = new THREE.Vector3().crossVectors(side, up).normalize();
    side.crossVectors(up, fwd).normalize();
    _basis.makeBasis(side, up, fwd);
    const torsoQ = new THREE.Quaternion().setFromRotationMatrix(_basis);
    this.fwd = fwd;
    const jg = this.jig * (0.6 + L.fat);

    if (!this.halves) {
      _p.addVectors(neck, pel).multiplyScalar(0.5);
      _s.set(sc * 1.25 * wf * (1 - jg * 0.5), (tl / 0.45) * (1 + jg), sc * 0.95 * (1 + L.fat * 0.4) * (1 - jg * 0.4));
      _m.compose(_p, torsoQ, _s); s.set('torso', sl, 0, _m);
      s.hide('half', sl, 0); s.hide('half', sl, 1);
    } else {
      s.hide('torso', sl, 0);
      const parts = [[J.neck, this.halves.wu, 0], [this.halves.wl, J.pelvis, 1]];
      for (const [a, b, i] of parts) {
        v(a, _p); v(b, _e);
        const dir = _e.clone().sub(_p); const l = dir.length() || 1e-6; dir.divideScalar(l);
        _p.add(_e).multiplyScalar(0.5);
        _s.set(sc * 1.25 * wf, l / 0.22, sc * 0.95 * (1 + L.fat * 0.4));
        _m.compose(_p, quatFromTo(dir), _s); s.set('half', sl, i, _m);
      }
    }
    // pelvis / hips
    _p.copy(pel).addScaledVector(up, -0.02 * sc);
    _s.set(sc * 1.08 * wf, sc * 0.75, sc * (0.95 + L.fat * 0.3));
    _m.compose(_p, torsoQ, _s); s.set('pelvis', sl, 0, _m);

    // shoulders
    for (let i = 0; i < 2; i++) {
      const sh = i === 0 ? J.lSh : J.rSh;
      v(sh, _p);
      _s.setScalar(sc * (1 + L.fat * 0.25) * (L.muscle ? 1.15 : 1));
      _m.compose(_p, torsoQ, _s); s.set('shoulder', sl, i, _m);
    }

    // limbs
    const limbW = sc * (1 + L.fat * 0.3) * (L.muscle ? 1.12 : 1);
    for (const sg of this.segs) {
      v(sg.a, _p); v(sg.b, _e);
      const dir = _e.clone().sub(_p); const l = dir.length() || 1e-6; dir.divideScalar(l);
      const base = sg.part === 'upperArm' ? 0.15 + 0.136 : sg.part === 'forearm' ? 0.14 + 0.12 : sg.part === 'thigh' ? 0.26 + 0.176 : 0.27 + 0.152;
      _p.add(_e).multiplyScalar(0.5);
      _s.set(limbW, (l + base * 0.35 * sc) / (base * 1.0) * 0.9 + 0.0, limbW);
      _s.y = Math.max(_s.y, sc * 0.4);
      _m.compose(_p, quatFromTo(dir), _s); s.set(sg.part, sl, sg.side, _m);
    }
    // hands
    for (let i = 0; i < 2; i++) {
      const fa = this.segs[i === 0 ? 1 : 3];
      v(fa.b, _p); v(fa.a, _e);
      const dir = _p.clone().sub(_e).normalize();
      _m.compose(_p, quatFromTo(dir), _s.setScalar(sc * (L.gloves ? 1.08 : 1)));
      s.set('hand', sl, i, _m);
    }
    // feet
    for (let i = 0; i < 2; i++) {
      const sg = this.segs[i === 0 ? 5 : 7];
      const ft = sg.b, toe = i === 0 ? J.lToe : J.rToe;
      v(ft, _p); v(toe, _e);
      const f = _e.clone().sub(_p); f.y *= 0.3; if (f.lengthSq() < 1e-12) f.copy(fwd); f.normalize();
      const sd = new THREE.Vector3().crossVectors(UP, f).normalize();
      const u = new THREE.Vector3().crossVectors(f, sd);
      _basis.makeBasis(sd, u, f);
      _q.setFromRotationMatrix(_basis);
      _m.compose(_p, _q, _s.setScalar(sc)); s.set('foot', sl, i, _m);
    }

    // head
    const hs = sc * L.headScale;
    v(J.head, _p);
    if (this.headLoose) {
      _q.setFromEuler(new THREE.Euler(this.headSpin.x * 0.016, this.headSpin.y * 0.016, this.headSpin.z * 0.016));
      if (!this.asleep) { this.headQ.multiply(_q); this.headSpin.multiplyScalar(0.985); }
    } else {
      const hu = _e.copy(_p).sub(neck).normalize();
      const hf = fwd.clone();
      if (this.mode === 'anim' && this.lookYaw) hf.applyAxisAngle(hu, this.lookYaw);
      hf.addScaledVector(hu, -hf.dot(hu)).normalize();
      if (this.lookPitch) hf.addScaledVector(hu, -this.lookPitch * 0.6).normalize();
      const hsd = new THREE.Vector3().crossVectors(hu, hf).normalize();
      const hu2 = new THREE.Vector3().crossVectors(hf, hsd);
      _basis.makeBasis(hsd, hu2, hf);
      this.headQ.setFromRotationMatrix(_basis);
    }
    _m.compose(_p, this.headQ, _s.set(hs, hs * (1 + jg * 0.6), hs));
    s.set('head', sl, 0, _m);
    _mh.copy(_m);
    this.renderFace(_mh, hs, time);

    // stumps (red cut ends with a bit of bone): each cap points out of the piece it belongs to
    let si = 0;
    const cap = (at, from, size) => {
      if (si >= 8) return;
      v(at, _p); v(from, _e);
      const d = _p.clone().sub(_e); const l = d.length();
      if (l < 1e-7) d.copy(UP); else d.divideScalar(l);
      _m.compose(_p, quatFromTo(d), _s.set(size * sc, sc * 0.05, size * sc));
      s.set('stump', sl, si++, _m);
    };
    for (const st of this.stumps) {
      const size = st.joint === 'neck' || st.flip ? 0.11 : st.joint && st.joint.includes('Hip') ? 0.09 : 0.07;
      cap(st.a, st.aIn, size);
      if (st.joint === 'neck') {
        if (si < 8) {
          _e.set(0, -1, 0).applyQuaternion(this.headQ);
          v(J.head, _p).addScaledVector(_e, 0.15 * hs);
          _m.compose(_p, quatFromTo(_e), _s.set(0.09 * sc, sc * 0.05, 0.09 * sc));
          s.set('stump', sl, si++, _m);
        }
      } else cap(st.b, st.bIn, size);
    }
    for (; si < 8; si++) s.hide('stump', sl, si);

    // extras attached to body
    if (L.bottom === 'skirt') { _m.compose(pel, torsoQ, _s.set(sc * wf, sc, sc * wf)); s.set('skirt', sl, 0, _m); }
    if (L.coat) {
      _p.copy(neck).addScaledVector(up, -0.02 * sc);
      _m.compose(_p, torsoQ, _s.set(sc * 1.2 * wf, sc * 1.05, sc * 1.05 * (1 + L.fat * 0.4))); s.set('coat', sl, 0, _m);
    }
    if (L.pack) {
      _p.addVectors(neck, pel).multiplyScalar(0.5).addScaledVector(fwd, -0.19 * sc * (1 + L.fat * 0.3));
      _m.compose(_p, torsoQ, _s.setScalar(sc)); s.set('pack', sl, 0, _m);
    }
  }

  renderFace(headM, hs, time) {
    const s = this.sink, sl = this.slot, F = this.face, L = this.look;
    // blink
    F.blink -= 0.016;
    if (F.blink < -3 - Math.random() * 3) F.blink = 0.12;
    const closed = Math.max(F.closed, F.blink > 0 ? 1 : 0);
    const eyeH = 1 - closed * 0.9;
    const put = (key, i, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) => {
      _q.setFromEuler(new THREE.Euler(0, 0, rz));
      _m2.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
      _m.multiplyMatrices(headM, _m2);
      s.set(key, sl, i, _m);
    };
    const es = L.eyeSize || 1;
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? 1 : -1;
      put('eye', i, sx * 0.062, 0.03, 0.135, es, eyeH * es, es * 0.8);
      if (closed > 0.6) s.hide('pupil', sl, i);
      else put('pupil', i, sx * 0.062 + F.lookX * 0.018, 0.03 + F.lookY * 0.015, 0.162, es * (F.scared ? 0.7 : 1), es * (F.scared ? 0.7 : 1), 0.6);
      // brows: angry = slanted down to the middle, sad = up in the middle, scared = high
      const tilt = (F.angry * 0.5 - F.sad * 0.45) * sx;
      const by = 0.095 + F.scared * 0.02 + F.sad * 0.006 - F.angry * 0.012;
      put('brow', i, sx * 0.064, by, 0.15, 1, 1 + (L.thickBrows ? 0.6 : 0), 1, tilt);
      put('ear', i, sx * 0.163, 0.0, -0.005, 1, 1, 1);
    }
    // mouth: smile widens + curves (approximated by scale), open = taller
    const open = clamp(F.open, 0, 1);
    const w = 1 + F.smile * 0.35 - open * 0.25;
    put('mouth', 0, 0, -0.062 + F.smile * 0.004, 0.15, w, 1 + open * 3.2, 1, 0);
    put('nose', 0, 0, -0.005, 0.165, 1, 1, 1);
    if (L.hair !== 'bald') put('hair_' + L.hair, 0, 0, 0, 0);
    if (L.beard) put('beard', 0, 0, 0, 0); else s.hide('beard', sl, 0);
    if (L.mustache) put('mustache', 0, 0, 0, 0); else s.hide('mustache', sl, 0);
    if (L.glasses) put('glasses', 0, 0, 0, 0); else s.hide('glasses', sl, 0);
    if (L.goggles) put('goggles', 0, 0, 0, 0); else s.hide('goggles', sl, 0);
    if (L.hat) put('hat_' + L.hat, 0, 0, 0, 0);
  }

  hideAll() {
    const s = this.sink, sl = this.slot;
    for (const k of ['torso', 'pelvis', 'head', 'mouth', 'nose', 'beard', 'mustache', 'glasses', 'goggles', 'skirt', 'coat', 'pack']) s.hide(k, sl, 0);
    for (const k of ['half', 'eye', 'pupil', 'brow', 'ear', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'shoulder']) { s.hide(k, sl, 0); s.hide(k, sl, 1); }
    for (let i = 0; i < 8; i++) s.hide('stump', sl, i);
    if (this.look.hair !== 'bald') s.hide('hair_' + this.look.hair, sl, 0);
    if (this.look.hat) s.hide('hat_' + this.look.hat, sl, 0);
  }

  // When the look changes (hair, hat) clear the old optional parts.
  relook(newLook) {
    this.hideAll();
    this.look = newLook;
    this.applyColors();
  }

  dispose() { this.hideAll(); this.sink.release(this.slot); }
}

// ------------------------------------------------------------- animation
// Writes targets for an animated pose. st: {pos, yaw, phase, speed, action, at, crouch, lying, sit, limp}
const L = REST.map((r) => new THREE.Vector3(...r));
const tmp = [...Array(BASE)].map(() => new THREE.Vector3());
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3();

export function poseTargets(body, st) {
  const look = body.look;
  const wf = 1 + look.fat * 0.22;
  const ph = st.phase || 0;
  const spd = st.speed || 0; // 0 idle, 1 walk, 2 run
  const act = st.action;
  const at = st.at || 0;
  const amp = Math.min(1.2, spd * 0.55);
  const bob = Math.abs(Math.sin(ph)) * 0.035 * Math.min(spd, 1.6);
  const crouch = st.crouch || 0;
  const pts = tmp;
  for (let i = 0; i < BASE; i++) pts[i].copy(L[i]);
  for (const i of [J.lSh, J.lEl, J.lHa, J.rSh, J.rEl, J.rHa, J.lHip, J.lKn, J.lFt, J.rHip, J.rKn, J.rFt, J.lToe, J.rToe]) pts[i].x *= wf;
  pts[J.head].y = 1.40 + 0.185 * look.headScale;

  // body height / lean
  let drop = bob * 0.6 + crouch * 0.3;
  let lean = spd > 1.3 ? 0.15 : 0.04 * spd;
  if (act === 'cower') { drop += 0.35; lean = 0.35; }
  if (act === 'chop' || act === 'mine' || act === 'dig') lean = 0.12 + Math.max(0, Math.sin(at * 6)) * 0.12;
  if (act === 'bandage' || act === 'kneel' || act === 'pray' || act === 'paint') drop += 0.42;
  if (act === 'worship') { drop += 0.4; lean = -0.05 + Math.sin(at * 3) * 0.25 + 0.25; }
  if (act === 'dance') drop += Math.abs(Math.sin(at * 7)) * 0.08;
  if (act === 'sit') drop += 0.45;
  for (const i of [J.head, J.neck, J.pelvis, J.lSh, J.rSh, J.lEl, J.rEl, J.lHa, J.rHa, J.lHip, J.rHip]) pts[i].y -= drop;
  // lean forward around the pelvis
  if (lean) for (const i of [J.head, J.neck, J.lSh, J.rSh, J.lEl, J.rEl, J.lHa, J.rHa]) {
    const dy = pts[i].y - pts[J.pelvis].y;
    pts[i].z += Math.sin(lean) * dy; pts[i].y = pts[J.pelvis].y + Math.cos(lean) * dy;
  }
  if (act === 'dance') { const sway = Math.sin(at * 3.5) * 0.08; for (let i = 0; i < BASE; i++) if (pts[i].y > 0.6) pts[i].x += sway * (pts[i].y - 0.6); }

  // legs
  for (let s = 0; s < 2; s++) {
    const hip = s === 0 ? J.lHip : J.rHip, kn = s === 0 ? J.lKn : J.rKn, ft = s === 0 ? J.lFt : J.rFt, toe = s === 0 ? J.lToe : J.rToe;
    const lph = ph + (s === 0 ? 0 : Math.PI);
    let a = Math.sin(lph) * 0.5 * amp;                 // hip swing
    let kb = Math.max(0, Math.cos(lph)) * 0.9 * amp;    // knee bend on the lifting leg
    if (st.limp === s && spd > 0) { a *= 0.4; kb *= 0.3; }
    const H = pts[hip];
    if (act === 'sit') { a = 1.45; kb = 1.5; }
    else if (act === 'bandage' || act === 'kneel' || act === 'pray' || act === 'worship' || act === 'paint') { a = s === 0 ? 0.25 : 1.3; kb = s === 0 ? 2.3 : 1.45; if (act === 'worship') { a = 0.35; kb = 2.4; } }
    else if (act === 'cower') { a = 0.9; kb = 1.9; }
    else if (act === 'struggle') { a = Math.sin(at * 14 + s * 2) * 0.7; kb = 0.5 + Math.sin(at * 14 + s) * 0.5; }
    else if (act === 'dance') { a += Math.sin(at * 7 + s * Math.PI) * 0.25; kb += Math.max(0, Math.sin(at * 7 + s * Math.PI)) * 0.4; }
    else if (crouch) { a = 0.6 * crouch; kb = 1.2 * crouch; }
    const thL = TH * Math.min(1, look.legLen || 1), shL = SH * Math.min(1, look.legLen || 1);
    pts[kn].set(H.x + (s === 0 ? 0.01 : -0.01), H.y - Math.cos(a) * thL, H.z + Math.sin(a) * thL);
    const b = a - kb;
    pts[ft].set(H.x + (s === 0 ? 0.01 : -0.01), pts[kn].y - Math.cos(b) * shL, pts[kn].z + Math.sin(b) * shL);
    if (!st.air && act !== 'struggle' && act !== 'sit' && pts[ft].y < 0.075) pts[ft].y = 0.075;
    const lift = st.air ? 0 : Math.max(0, -Math.sin(lph)) * 0.06 * amp;
    if (act !== 'sit' && act !== 'struggle' && act !== 'kneel' && act !== 'pray' && act !== 'worship' && act !== 'bandage' && act !== 'paint' && act !== 'cower') pts[ft].y += lift;
    pts[toe].set(pts[ft].x, pts[ft].y - 0.025, pts[ft].z + 0.155);
  }

  // arms
  const armSwing = amp * 0.55;
  const hands = [null, null]; // local targets for hands (null = swing)
  const t = at;
  const reachZ = 0.42;
  switch (act) {
    case 'chop': case 'mine': case 'dig': case 'build': case 'hammer': {
      const k = (Math.sin(t * (act === 'build' || act === 'hammer' ? 9 : 6)) + 1) / 2;
      const hy = act === 'build' || act === 'hammer' ? lerp(1.15, 0.85, k) : lerp(1.75, 0.8, k);
      const hz = lerp(0.1, 0.48, k);
      hands[1] = [-0.06, hy - drop, hz]; hands[0] = act === 'build' || act === 'hammer' ? [0.2, 0.9 - drop, 0.3] : [0.02, hy - drop - 0.08, hz - 0.04];
      break;
    }
    case 'swing': { const k = clamp(t * 3.5, 0, 1); const ang = lerp(-1.2, 1.4, Math.sin(k * Math.PI / 2)); hands[1] = [-0.15 + Math.sin(ang) * 0.35, 1.35 - k * 0.35, 0.2 + Math.cos(ang) * 0.3]; hands[0] = [0.25, 1.0, 0.15]; break; }
    case 'stab': case 'punch': { const k = Math.max(0, Math.sin(clamp(t * 4, 0, 1) * Math.PI)); hands[1] = [-0.12, 1.3, lerp(0.15, 0.62, k)]; hands[0] = [0.15, 1.3, 0.25]; break; }
    case 'shoot': hands[1] = [-0.05, 1.32, 0.5]; hands[0] = [0.06, 1.3, 0.42]; break;
    case 'aim': hands[1] = [-0.05, 1.32, 0.5]; hands[0] = [0.06, 1.3, 0.42]; break;
    case 'throw': { const k = clamp(t * 3, 0, 1); hands[1] = k < 0.4 ? [-0.25, 1.6, -0.2] : [-0.1, 1.3, 0.6]; break; }
    case 'eat': case 'drink': { const k = (Math.sin(t * 5) + 1) / 2; hands[1] = [-0.05, lerp(1.2, 1.5, k), lerp(0.3, 0.17, k)]; hands[0] = [0.1, 1.15, 0.28]; break; }
    case 'wave': hands[1] = [-0.36 + Math.sin(t * 8) * 0.1, 1.85, 0.12]; break;
    case 'point': hands[1] = [-0.15, 1.4, 0.7]; break;
    case 'talk': hands[1] = [-0.2 + Math.sin(t * 3) * 0.06, 1.05 + Math.sin(t * 4.3) * 0.08, 0.3]; break;
    case 'worship': case 'pray': { const k = Math.sin(t * 3); hands[0] = act === 'pray' ? [0.03, 1.3 - drop, 0.3] : [0.28, 1.9 - drop * 0.5 + k * 0.08, 0.3]; hands[1] = act === 'pray' ? [-0.03, 1.3 - drop, 0.3] : [-0.28, 1.9 - drop * 0.5 + k * 0.08, 0.3]; break; }
    case 'cower': case 'cry': hands[0] = [0.1, 1.55 - drop, 0.18]; hands[1] = [-0.1, 1.55 - drop, 0.18]; break;
    case 'bang': { const k = Math.sin(t * 9); hands[0] = [0.18, 1.6, reachZ + Math.max(0, k) * 0.12]; hands[1] = [-0.18, 1.6, reachZ + Math.max(0, -k) * 0.12]; break; }
    case 'carry': hands[0] = [0.17, 1.0, 0.33]; hands[1] = [-0.17, 1.0, 0.33]; break;
    case 'hold': hands[0] = [0.2, 1.9, 0.05]; hands[1] = [-0.2, 1.9, 0.05]; break;
    case 'dance': hands[0] = [0.4 + Math.sin(t * 7) * 0.1, 1.6 + Math.sin(t * 7) * 0.25, 0.1]; hands[1] = [-0.4 - Math.sin(t * 7) * 0.1, 1.6 - Math.sin(t * 7) * 0.25, 0.1]; break;
    case 'struggle': case 'flail': hands[0] = [0.4 + Math.sin(t * 13) * 0.2, 1.4 + Math.cos(t * 11) * 0.35, Math.sin(t * 9) * 0.25]; hands[1] = [-0.4 - Math.sin(t * 12) * 0.2, 1.4 + Math.cos(t * 13) * 0.35, Math.cos(t * 10) * 0.25]; break;
    case 'bandage': case 'paint': hands[0] = [0.1, 0.75 + Math.sin(t * 6) * 0.05, 0.45]; hands[1] = [-0.1, 0.75 + Math.cos(t * 6) * 0.05, 0.45]; break;
    case 'drum': hands[0] = [0.15, 0.95 + Math.max(0, Math.sin(t * 10)) * 0.15, 0.4]; hands[1] = [-0.15, 0.95 + Math.max(0, -Math.sin(t * 10)) * 0.15, 0.4]; break;
    case 'hug': hands[0] = [0.05, 1.25, 0.38]; hands[1] = [-0.05, 1.25, 0.38]; break;
    case 'sleep': break;
    default: break;
  }
  for (let s = 0; s < 2; s++) {
    const sh = s === 0 ? J.lSh : J.rSh, el = s === 0 ? J.lEl : J.rEl, ha = s === 0 ? J.lHa : J.rHa;
    const sx = s === 0 ? 1 : -1;
    const S = pts[sh];
    if (hands[s]) {
      _T.set(hands[s][0] * wf, hands[s][1], hands[s][2]);
      _P.set(sx * 0.6, -0.8, -0.5).normalize();
      ik(S, _T, UA, FA, _P, _E);
      pts[el].copy(_E);
      _T.sub(_E); const fl = _T.length(); if (fl > FA) _T.multiplyScalar(FA / fl);
      pts[ha].copy(_E).add(_T);
    } else {
      const sw = -Math.sin(ph + (s === 0 ? 0 : Math.PI)) * armSwing + (act === 'sleep' ? 0 : 0);
      const roll = 0.1 + (look.fat * 0.12) + (crouch * 0.1);
      const dU = _T.set(sx * Math.sin(roll), -Math.cos(roll) * Math.cos(sw), Math.cos(roll) * Math.sin(sw));
      pts[el].copy(S).addScaledVector(dU, UA);
      const eb = sw + 0.25 + spd * 0.35;
      const dF = _E.set(sx * Math.sin(roll) * 0.6, -Math.cos(eb), Math.sin(eb)).normalize();
      pts[ha].copy(pts[el]).addScaledVector(dF, FA);
    }
  }

  // lying / sleeping: rotate the whole pose flat on the back
  if (st.lying) {
    const piv = pts[J.pelvis].y;
    for (let i = 0; i < BASE; i++) {
      const y = pts[i].y - piv, z = pts[i].z;
      pts[i].y = 0.13 + z * 0.9 + 0.0;
      pts[i].z = -y;
      pts[i].y = Math.max(0.06, pts[i].y + (i === J.head ? 0.05 : 0));
    }
  }

  // to world
  const sc = body.sc;
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
  const base = st.pos;
  const T = body.t;
  for (let i = 0; i < BASE; i++) {
    const q = pts[i];
    T[i * 3] = base.x + (q.x * cy + q.z * sy) * sc;
    T[i * 3 + 1] = base.y + q.y * sc;
    T[i * 3 + 2] = base.z + (-q.x * sy + q.z * cy) * sc;
  }
}

// After a ragdoll, blend back to standing from where the body lies.
export function bodyRestYaw(body) {
  const f = body.fwd;
  if (!f) return 0;
  return Math.atan2(f.x, f.z);
}
