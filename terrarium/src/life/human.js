// Realistic people. Each person is ONE smooth skinned mesh (skin, face, eyes, hair, clothes, hats)
// built from their look, bent by bones that follow the physics points of Body every frame.
// Faces: sculpted head, real eyes that look around + blink, lips that open (teeth inside),
// painted details per pixel (lips, brows, nostrils, iris, pores, fabric, denim, stains).
// Two levels of detail: close people get the full mesh, far/tiny ones a light one.
import * as THREE from 'three';

export const B = { pelvis: 0, chest: 1, neck: 2, head: 3, lUA: 4, lFA: 5, lHand: 6, rUA: 7, rFA: 8, rHand: 9, lTH: 10, lSH: 11, lFoot: 12, rTH: 13, rSH: 14, rFoot: 15, lEye: 16, rEye: 17 };
const NB = 18;
// regions (colors / roughness per region live in uniforms)
export const RG = { skin: 0, shirt: 1, pants: 2, shoes: 3, hair: 4, lid: 5, eye: 6, sole: 7, coat: 8, gloves: 9, hat: 10, frame: 11, lens: 12, nail: 13, belt: 14, trim: 15, pack: 16, ear: 17, horn: 18 };
const NR = 20;
const MORPHS = ['blink', 'smile', 'open', 'angry', 'sad', 'scared'];
// joints the body can be cut at -> blend keys
const JOINT_KEYS = ['lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee', 'neck', 'waist', 'lAnkle', 'rAnkle', 'lWrist', 'rWrist', 'neckBase'];
const JK = Object.fromEntries(JOINT_KEYS.map((k, i) => [k, i]));

// point indices (same as body.js)
const P = { head: 0, neck: 1, pelvis: 2, lSh: 3, lEl: 4, lHa: 5, rSh: 6, rEl: 7, rHa: 8, lHip: 9, lKn: 10, lFt: 11, rHip: 12, rKn: 13, rFt: 14, lToe: 15, rToe: 16 };
const REST = [
  [0, 1.585, 0], [0, 1.40, 0], [0, 0.95, 0],
  [0.215, 1.36, 0], [0.245, 1.10, -0.01], [0.26, 0.86, 0.02],
  [-0.215, 1.36, 0], [-0.245, 1.10, -0.01], [-0.26, 0.86, 0.02],
  [0.10, 0.90, 0], [0.11, 0.49, 0.02], [0.11, 0.075, -0.02],
  [-0.10, 0.90, 0], [-0.11, 0.49, 0.02], [-0.11, 0.075, -0.02],
  [0.11, 0.05, 0.14], [-0.11, 0.05, 0.14],
];

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
function table(ys, vals, y) {
  if (y <= ys[0]) return vals[0];
  for (let i = 1; i < ys.length; i++) if (y <= ys[i]) { const t = (y - ys[i - 1]) / (ys[i] - ys[i - 1]); const s = t * t * (3 - 2 * t); return lerp(vals[i - 1], vals[i], s); }
  return vals[vals.length - 1];
}

// ------------------------------------------------------------- rest pose + face shape for a look
export function restJoints(look) {
  const wf = 1 + (look.fat || 0) * 0.22;
  return REST.map((r, i) => {
    const v = V3(...r);
    if (i !== P.head && i !== P.neck && i !== P.pelvis) v.x *= wf;
    if (i === P.head) v.y = 1.40 + 0.185 * (look.headScale || 1);
    return v;
  });
}

function hashLook(look) {
  const s = JSON.stringify([look.skin, look.hairColor, look.shirt, look.pants, look.hair, look.sex, look.fat, look.height]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFrom(seed) { let s = seed || 1; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

// every face is different (stored on the look so it never changes)
export function faceOf(look) {
  if (look.face) return look.face;
  const r = rngFrom(hashLook(look));
  const f = { nose: 0.85 + r() * 0.35, noseW: 0.85 + r() * 0.35, jaw: 0.85 + r() * 0.3, cheek: r(), lips: 0.8 + r() * 0.45, eyeSpace: 0.94 + r() * 0.12, brow: r(), chin: 0.7 + r() * 0.6, ear: 0.9 + r() * 0.25, eyeTilt: (r() - 0.5) * 0.3, freckles: r() < 0.12 ? r() : 0, mole: r() < 0.2 ? [(r() - 0.5) * 0.08, -0.03 - r() * 0.05] : null };
  look.face = f;
  return f;
}

// ------------------------------------------------------------- head shape (head-local, unit person)
const MOUTH_Y = -0.052;
function headPoint(th, ph, ctx, out) {
  // th: 0 top .. PI bottom, ph: 0 front, + toward +x (the person's left)
  const { F, fem, kid } = ctx;
  const st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
  const ax = fem ? 0.071 : 0.075, az = 0.096, ayT = 0.114, ayB = fem ? 0.104 : 0.11;
  let x = st * sp * ax, y = ct * (ct > 0 ? ayT : ayB), z = st * cp * az - 0.006;
  // the lower half is boxier (jaw + chin), not an egg
  if (ct < 0) { const k = 1 + (fem ? 0.5 : 0.72) * (1 - st) * sstep(0, -0.6, ct); x *= k; z = st * cp * az * (1 + 0.35 * (1 - st) * sstep(0, -0.6, ct) * Math.max(0, cp)) - 0.006; }
  const front = sstep(0.15, 0.75, cp * st);
  // jaw narrows to the chin; chin comes forward
  const jt = sstep(-0.005, -0.105, y);
  x *= 1 - jt * 0.24 * (fem ? 1.15 : 1) / F.jaw;
  // cheeks narrow under the cheekbones
  x *= 1 - 0.07 * sstep(-0.01, -0.05, y) * Math.max(0, cp);
  z += 0.012 * jt * Math.max(0, cp) * F.chin;
  // under the jaw the skin goes back to the neck (that's what makes a jawline)
  const uc = sstep(-0.07, -0.105, y) * Math.max(0, cp);
  z -= 0.05 * uc * uc; y += 0.012 * uc;
  // back of the head tucks into the neck
  const nb = sstep(-0.03, -0.1, y) * Math.max(0, -cp);
  z *= 1 - nb * 0.45; x *= 1 - nb * 0.25;
  // flatter face, rounder skull at the back
  z -= 0.006 * front * (1 - Math.abs(x) / ax);
  z -= 0.004 * Math.max(0, cp) * sstep(0.06, 0.11, y);
  // features
  let d = 0;
  const ax_ = Math.abs(x);
  const fr = front;
  // eye sockets
  const ex = 0.032 * F.eyeSpace, ey = 0.014;
  d -= 0.0105 * fr * gauss(ax_, y, ex, ey + 0.001, 0.0155, 0.0098);
  // brow ridge
  d += (fem ? 0.0018 : 0.0038) * fr * gauss(ax_, y, 0.03, 0.036, 0.024, 0.0065);
  // nose
  const nw = F.noseW * (kid ? 0.8 : 1), nl = F.nose * (kid ? 0.7 : 1);
  const nUp = 0.022, nTip = -0.024;
  const along = sstep(nUp, nTip, y);
  const below = sstep(nTip - 0.011, nTip - 0.004, y);
  d += fr * gauss(x, y, 0, (nUp + nTip) / 2, 0.0072 * nw * (0.7 + along * 0.5), 0.032) * lerp(0.0035, 0.0185 * nl, along) * below;
  d += fr * gauss(x, y, 0, nTip + 0.001, 0.0095 * nw, 0.0075) * 0.0035 * nl;
  d += fr * gauss(ax_, y, 0.0135 * nw, nTip - 0.002, 0.0068, 0.0058) * 0.0058;
  // cheekbones + cheeks
  d += 0.004 * Math.max(0, cp) * gauss(ax_, y, 0.047, -0.012, 0.017, 0.014);
  d += (0.003 + F.cheek * 0.004 + (kid ? 0.004 : 0)) * Math.max(0, cp) * gauss(ax_, y, 0.04, -0.045, 0.021, 0.02);
  // nasolabial folds
  d -= 0.0016 * fr * gauss(ax_, y, 0.024, -0.036, 0.0045, 0.013);
  // lips
  const lw = F.lips * (fem ? 1.1 : 1);
  d += 0.0045 * fr * gauss(x, y, 0, MOUTH_Y + 0.0062, 0.021, 0.0058) * lw;
  d -= 0.0012 * fr * gauss(x, y, 0, MOUTH_Y + 0.0135, 0.0032, 0.0055);
  d += 0.0055 * fr * gauss(x, y, 0, MOUTH_Y - 0.0068, 0.0185, 0.0055) * lw;
  d -= 0.0017 * fr * gauss(x, y, 0, MOUTH_Y, 0.023, 0.0016);
  d -= 0.002 * fr * gauss(x, y, 0, MOUTH_Y - 0.0175, 0.02, 0.0042);
  // chin + jaw corners
  d += 0.005 * fr * gauss(x, y, 0, -0.088, 0.016, 0.011) * F.chin;
  if (!fem && !kid) d += 0.0045 * gauss(ax_, y, 0.055, -0.072, 0.013, 0.013) * Math.max(0, cp + 0.3);
  // temples
  d -= 0.002 * gauss(ax_, y, 0.07, 0.035, 0.012, 0.02) * Math.max(0, cp);
  // push along the outward direction
  const nx = st * sp, ny = ct, nz = st * cp;
  out.set(x + nx * d, y + ny * d, z + nz * d);
  return out;
}

// where the hair grows (0..1)
function hairMask(p, ph, style) {
  const a = Math.abs(ph);
  const front = style === 'long' || style === 'pony' || style === 'bun' ? 0.066 : 0.072;
  const hy = table([0, 0.9, 1.25, 1.55, 1.9, 2.5, Math.PI], [front, 0.055, 0.03, 0.006, -0.03, -0.07, -0.08], a);
  let m = sstep(hy - 0.006, hy + 0.007, p.y);
  // not over the ears
  const ex = Math.abs(p.x) - 0.07, ey = p.y + 0.005, ez = p.z + 0.012;
  m *= sstep(0.018, 0.03, Math.hypot(ex * 0.6, ey, ez * 0.9));
  if (style === 'mohawk') m *= sstep(0.03, 0.016, Math.abs(p.x)) * sstep(-0.05, -0.02, p.y);
  if (style === 'buzz') m *= sstep(-0.06, -0.03, p.y) * 1;
  return m;
}

function beardMask(p, ph, type) {
  const a = Math.abs(ph);
  if (type === 'mustache') return sstep(0.027, 0.02, Math.abs(p.x)) * sstep(MOUTH_Y + 0.003, MOUTH_Y + 0.007, p.y) * sstep(MOUTH_Y + 0.02, MOUTH_Y + 0.014, p.y) * sstep(0.2, 0.6, Math.cos(ph));
  let m = sstep(1.95, 1.6, a) * sstep(0.0, -0.025, p.y) * sstep(-0.15, -0.125, p.y);
  // keep the lips + under the nose clear
  const lip = ((p.x / 0.03) ** 2 + ((p.y - MOUTH_Y) / 0.014) ** 2);
  m *= sstep(0.9, 1.5, lip);
  m *= 1 - sstep(0.3, 0.0, Math.hypot(p.x / 0.03, (p.y + 0.035) / 0.012)) * sstep(0.04, 0.0, p.y + 0.045);
  return m;
}

// ------------------------------------------------------------- geometry builder
class GB {
  constructor() {
    this.pos = []; this.nrm = []; this.uv = []; this.reg = []; this.ao = []; this.hp = []; this.aux = []; this.lip = [];
    this.si = []; this.sw = []; this.idx = []; this.joint = []; this.main = [];
    this.mo = MORPHS.map(() => []);
    this.n = 0;
  }
  v(p, n, u, v, reg, bones, o = {}) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.reg.push(reg);
    this.ao.push(o.ao ?? 1);
    const h = o.hp || ZERO3; this.hp.push(h.x, h.y, h.z);
    this.aux.push(o.aux ?? 0);
    this.lip.push(o.lip ?? 1);
    // up to 4 bones
    bones = bones.filter((b) => b[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let tw = 0; for (const b of bones) tw += b[1];
    for (let i = 0; i < 4; i++) { const b = bones[i]; this.si.push(b ? b[0] : 0); this.sw.push(b ? b[1] / tw : 0); }
    this.joint.push(o.joint ?? -1);
    this.main.push(o.main ?? bones[0][0]);
    const m = o.morph;
    for (let k = 0; k < MORPHS.length; k++) { const d = m && m[k]; this.mo[k].push(d ? d.x : 0, d ? d.y : 0, d ? d.z : 0); }
    return this.n++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // quad a b c d (a-b along u, a-d along v); flip picks winding
  quad(a, b, c, d, flip) { if (flip) { this.tri(a, c, b); this.tri(a, d, c); } else { this.tri(a, b, c); this.tri(a, c, d); } }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('duv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('region', new THREE.Float32BufferAttribute(this.reg, 1));
    g.setAttribute('ao', new THREE.Float32BufferAttribute(this.ao, 1));
    g.setAttribute('hpos', new THREE.Float32BufferAttribute(this.hp, 3));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.aux, 1));
    g.setAttribute('lip', new THREE.Float32BufferAttribute(this.lip, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.morphAttributes.position = this.mo.map((arr) => new THREE.Float32BufferAttribute(arr, 3));
    g.morphTargetsRelative = true;
    g.userData.joint = Int8Array.from(this.joint);
    g.userData.main = Uint8Array.from(this.main);
    return g;
  }
}
const ZERO3 = V3();

// A parametric surface. f(u, v, out) -> point. us = periodic samples in [0,1), vs = samples.
// attr(u, v, p, n) -> {reg, bones, ao, hp, aux, lip, joint, main, morph, uvx, uvy, skip}
function surface(gb, us, vs, f, attr, opts = {}) {
  const nu = us.length, nv = vs.length;
  const grid = [];
  const p = V3(), a = V3(), b = V3(), c = V3(), d = V3(), n = V3();
  const eu = 1e-3, ev = 1e-3;
  const vmin = vs[0], vmax = vs[nv - 1];
  const center = V3();
  for (let j = 0; j < nv; j++) {
    const v = vs[j];
    const row = [];
    for (let i = 0; i < nu; i++) {
      const u = us[i];
      f(u, v, p);
      f(u + eu, v, a); f(u - eu, v, b);
      f(u, Math.min(vmax, v + ev), c); f(u, Math.max(vmin, v - ev), d);
      a.sub(b); c.sub(d);
      n.crossVectors(a, c);
      const cen = opts.axis ? (opts.axis(v, center) || center) : center;
      if (n.lengthSq() < 1e-20) n.copy(p).sub(cen);
      n.normalize();
      if (opts.axis) { if (n.dot(V3().subVectors(p, cen)) < 0) n.negate(); }
      else if (opts.flipN) n.negate();
      const at = attr(u, v, p, n);
      if (at.skip) { row.push(-1); continue; }
      row.push(gb.v(p.clone(), n.clone(), at.uvx ?? u * (opts.uvU || 1), at.uvy ?? v * (opts.uvV || 1), at.reg, at.bones, at));
    }
    grid.push(row);
  }
  // faces (wind so the triangle normal agrees with the vertex normals)
  const P_ = gb.pos, N_ = gb.nrm;
  const flipOf = (i0, i1, i3) => {
    const ax = P_[i1 * 3] - P_[i0 * 3], ay = P_[i1 * 3 + 1] - P_[i0 * 3 + 1], az = P_[i1 * 3 + 2] - P_[i0 * 3 + 2];
    const bx = P_[i3 * 3] - P_[i0 * 3], by = P_[i3 * 3 + 1] - P_[i0 * 3 + 1], bz = P_[i3 * 3 + 2] - P_[i0 * 3 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    return cx * N_[i0 * 3] + cy * N_[i0 * 3 + 1] + cz * N_[i0 * 3 + 2] < 0;
  };
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu; i++) {
      const i2 = (i + 1) % nu;
      if (!opts.closedU && i2 === 0) continue;
      const q0 = grid[j][i], q1 = grid[j][i2], q2 = grid[j + 1][i2], q3 = grid[j + 1][i];
      if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) continue;
      gb.quad(q0, q1, q2, q3, flipOf(q0, q1, q3));
    }
  }
  // caps
  const cap = (j, end) => {
    const row = grid[j];
    if (row.some((q) => q < 0)) return;
    const v = vs[j];
    const cp = V3();
    for (const q of row) cp.add(V3(P_[q * 3], P_[q * 3 + 1], P_[q * 3 + 2]));
    cp.divideScalar(row.length);
    if (opts.capPull) cp.add(opts.capPull(end));
    const an = V3(N_[row[0] * 3], N_[row[0] * 3 + 1], N_[row[0] * 3 + 2]);
    let dir = opts.axis ? (() => { const a0 = opts.axis(vs[0], V3()).clone(), a1 = opts.axis(vs[nv - 1], V3()).clone(); return a1.sub(a0); })() : an.clone();
    if (dir.lengthSq() < 1e-16) { dir = V3(); for (const q of row) dir.add(V3(N_[q * 3], N_[q * 3 + 1], N_[q * 3 + 2])); if (dir.lengthSq() < 1e-16) dir.set(0, end ? 1 : -1, 0); else dir.multiplyScalar(end ? 1 : -1); }
    dir.normalize().multiplyScalar(opts.axis && dir.lengthSq() > 0 ? 1 : 1);
    if (opts.axis) { const a0 = opts.axis(vs[0], V3()).clone(), a1 = opts.axis(vs[nv - 1], V3()).clone(); if (a1.distanceToSquared(a0) > 1e-16 && !end) dir.negate(); }
    const at = attr(0.5, v, cp, dir);
    const ci = gb.v(cp, dir, 0.5, v, at.reg, at.bones, at);
    for (let i = 0; i < nu; i++) {
      const a0 = row[i], a1 = row[(i + 1) % nu];
      if (!opts.closedU && (i + 1) % nu === 0) continue;
      // wind to face outward along dir
      const ax = P_[a1 * 3] - P_[a0 * 3], ay = P_[a1 * 3 + 1] - P_[a0 * 3 + 1], az = P_[a1 * 3 + 2] - P_[a0 * 3 + 2];
      const bx = cp.x - P_[a0 * 3], by = cp.y - P_[a0 * 3 + 1], bz = cp.z - P_[a0 * 3 + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (nx * dir.x + ny * dir.y + nz * dir.z >= 0) gb.tri(a0, a1, ci); else gb.tri(a1, a0, ci);
    }
  };
  if (opts.capStart) cap(0, false);
  if (opts.capEnd) cap(nv - 1, true);
  return grid;
}

const lin = (n, a = 0, b = 1, closed = false) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (closed ? n : n - 1));

// sample with more points where density is high
function dense(n, a, b, density) {
  const M = 400, cdf = [0];
  for (let i = 1; i <= M; i++) { const x = a + (b - a) * (i - 0.5) / M; cdf.push(cdf[i - 1] + density(x)); }
  const tot = cdf[M], out = [];
  for (let k = 0; k < n; k++) {
    const target = tot * k / (n - 1);
    let i = 1; while (i < M && cdf[i] < target) i++;
    const t = (target - cdf[i - 1]) / Math.max(1e-9, cdf[i] - cdf[i - 1]);
    out.push(a + (b - a) * (i - 1 + t) / M);
  }
  return out;
}

// ------------------------------------------------------------- bone frames
const _x = V3(), _y = V3(), _z = V3(), _t = V3(), _t2 = V3(), _q = new THREE.Quaternion(), _s = V3(), _m = new THREE.Matrix4();
function basis(out, origin, X, Y, Z, sx, sy, sz) {
  out.makeBasis(X, Y, Z);
  out.scale(_s.set(sx, sy, sz));
  out.setPosition(origin);
  return out;
}
function ortho(ref, axis, out) { out.copy(ref).addScaledVector(axis, -ref.dot(axis)); if (out.lengthSq() < 1e-12) out.set(axis.y, axis.z, axis.x); return out.normalize(); }

// writes 16 body bone matrices (eyes are done from the head)
// get(i) -> Vector3 of a point; info: {sc, headQ, halves, neckCut, seg: {lUA:[a,b],...}, rest}
function computeFrames(get, info, out) {
  const sc = info.sc;
  const pel = get(P.pelvis), neck = get(P.neck);
  const up = _t.copy(neck).sub(pel).normalize().clone();
  const sideS = ortho(_t2.copy(get(P.lSh)).sub(get(P.rSh)), up, V3());
  const sideH0 = V3().copy(get(P.lHip)).sub(get(P.rHip));
  const R = info.rest;
  // pelvis
  let upL = up, chestO, upU = up, chestLen;
  if (info.halves) {
    const wl = get(info.halves.wl), wu = get(info.halves.wu);
    upL = V3().subVectors(wl, pel); if (upL.lengthSq() < 1e-14) upL.copy(up); upL.normalize();
    chestO = wu.clone();
    upU = V3().subVectors(neck, wu); chestLen = upU.length(); if (chestLen < 1e-9) upU.copy(up); else upU.normalize();
  } else {
    chestO = V3().addVectors(pel, neck).multiplyScalar(0.5);
    chestLen = neck.distanceTo(chestO);
  }
  const sideH = ortho(sideH0, upL, V3());
  basis(out[B.pelvis], pel, sideH, upL, V3().crossVectors(sideH, upL), sc, sc, sc);
  const sideU = ortho(sideS, upU, V3());
  const stretchC = clamp(chestLen / (R.chestLen * sc), 0.6, 1.6);
  basis(out[B.chest], chestO, sideU, upU, V3().crossVectors(sideU, upU), sc, sc * stretchC, sc);
  // neck + head
  const headP = get(P.head);
  let ny = info.neckCut ? upU.clone() : V3().subVectors(headP, neck);
  if (!info.neckCut) { if (ny.lengthSq() < 1e-14) ny.copy(upU); ny.normalize(); }
  const nx = ortho(sideU, ny, V3());
  basis(out[B.neck], neck, nx, ny, V3().crossVectors(nx, ny), sc, sc, sc);
  out[B.head].compose(headP, info.headQ, _s.set(sc, sc, sc));
  // limbs
  const limb = (bone, tag, ref, restLen) => {
    const [ia, ib] = info.seg[tag];
    const a = get(ia), b = get(ib);
    const Y = V3().subVectors(b, a); const len = Y.length();
    if (len < 1e-9) Y.copy(up).negate(); else Y.divideScalar(len);
    const X = ortho(ref, Y, V3());
    const st = clamp(len / (restLen * sc), 0.5, 1.8);
    basis(out[bone], a, X, Y, V3().crossVectors(X, Y), sc, sc * st, sc);
    return { X, Y, b };
  };
  const la = limb(B.lUA, 'lUA', sideS, R.lens.lUA), lf = limb(B.lFA, 'lFA', sideS, R.lens.lFA);
  const ra = limb(B.rUA, 'rUA', sideS, R.lens.rUA), rf = limb(B.rFA, 'rFA', sideS, R.lens.rFA);
  void la; void ra;
  basis(out[B.lHand], lf.b, lf.X, lf.Y, V3().crossVectors(lf.X, lf.Y), sc, sc, sc);
  basis(out[B.rHand], rf.b, rf.X, rf.Y, V3().crossVectors(rf.X, rf.Y), sc, sc, sc);
  limb(B.lTH, 'lTH', sideH, R.lens.lTH); const ls = limb(B.lSH, 'lSH', sideH, R.lens.lSH);
  limb(B.rTH, 'rTH', sideH, R.lens.rTH); const rs = limb(B.rSH, 'rSH', sideH, R.lens.rSH);
  for (const [bone, sh, toe] of [[B.lFoot, ls, P.lToe], [B.rFoot, rs, P.rToe]]) {
    const f = sh.b, t = get(toe);
    const Y = V3().subVectors(t, f); if (Y.lengthSq() < 1e-14) Y.copy(sh.Y); Y.normalize();
    const X = ortho(sideH, Y, V3());
    basis(out[bone], f, X, Y, V3().crossVectors(X, Y), sc, sc, sc);
  }
}

// ------------------------------------------------------------- building the body for a look
const TORSO_Y = [0.80, 0.84, 0.90, 0.96, 1.02, 1.08, 1.14, 1.20, 1.26, 1.32, 1.37, 1.41, 1.45, 1.495];
const TM = { W: [0.07, 0.13, 0.162, 0.158, 0.145, 0.138, 0.145, 0.155, 0.163, 0.17, 0.17, 0.135, 0.085, 0.056], D: [0.065, 0.085, 0.1, 0.098, 0.092, 0.09, 0.096, 0.104, 0.108, 0.105, 0.095, 0.08, 0.06, 0.052] };
const TF = { W: [0.075, 0.14, 0.176, 0.168, 0.148, 0.124, 0.128, 0.138, 0.144, 0.148, 0.148, 0.122, 0.08, 0.053], D: [0.068, 0.09, 0.104, 0.1, 0.09, 0.084, 0.088, 0.094, 0.098, 0.096, 0.088, 0.076, 0.058, 0.05] };
const TZ = [-0.012, -0.014, -0.016, -0.01, 0, 0.002, 0.004, 0.006, 0.006, 0, -0.01, -0.018, -0.015, -0.012];

function buildGeometry(look, lod) {
  const hi = lod === 0;
  const gb = new GB();
  const F = faceOf(look);
  const fem = look.sex === 'f';
  const kid = (look.height || 1) < 0.75;
  const baby = (look.height || 1) < 0.4;
  const fat = look.fat || 0;
  const musc = look.muscle ? 1 : 0;
  const hs = look.headScale || 1;
  const J = restJoints(look);
  const top = look.top || 'tee', bottom = look.bottom || 'long';
  const coat = !!look.coat;
  const longSleeve = top === 'long' || top === 'hoodie' || top === 'uniform' || top === 'suit' || coat;
  const wf = 1 + fat * 0.28;
  const T = fem ? TF : TM;
  const headC = J[P.head];
  const ctx = { F, fem, kid };

  // -------- torso
  const torsoW = (y, a) => {
    let w = table(TORSO_Y, T.W, y) * (1 + fat * 0.3 * sstep(0.86, 1.05, y) * sstep(1.4, 1.2, y)) * (y > 1.25 ? 1 + musc * 0.06 : 1);
    if (baby) w *= 1.12;
    return w * (1 + fat * 0.12);
  };
  const torsoD = (y, a) => {
    let d = table(TORSO_Y, T.D, y) * (1 + fat * 0.25);
    const front = Math.max(0, Math.cos(a)), back = Math.max(0, -Math.cos(a));
    const sx = Math.sin(a);
    d += fat * 0.075 * front * gauss(0, y, 0, 1.04, 1, 0.08);           // belly
    d += (fem ? 0.034 : 0.022) * back * gauss(Math.abs(sx), y, 0.5, 0.885, 0.42, 0.055); // butt
    if (fem && !kid) d += (0.026 + fat * 0.03) * front * gauss(Math.abs(sx), y, 0.38, 1.215, 0.28, 0.06); // chest
    else if (!kid) d += (0.007 + musc * 0.01) * front * gauss(Math.abs(sx), y, 0.4, 1.27, 0.35, 0.05);    // pecs
    d -= 0.004 * back * gauss(sx, y, 0, 1.15, 0.12, 0.25); // spine
    return d;
  };
  const torsoP = (u, v, out) => {
    const y = lerp(0.80, 1.495, v);
    const a = u * Math.PI * 2;
    const s = Math.sin(a), c = Math.cos(a);
    const n = lerp(2.0, 2.6, sstep(0.95, 1.3, y));
    const W = torsoW(y, a), D = torsoD(y, a);
    out.set(Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * W, y, Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * D + table(TORSO_Y, TZ, y));
    return out;
  };
  const shirtRegion = (y, a) => {
    if (y < 0.965) return bottom === 'skirt' && y > 0.9 ? RG.pants : RG.pants;
    if (y < 0.985 && bottom !== 'skirt') return RG.belt;
    if (top === 'tank') { const sx = Math.abs(Math.sin(a)); if (y > 1.3 && sx > 0.62) return RG.skin; if (y > 1.38 && Math.cos(a) > 0.3) return RG.skin; }
    const neckline = top === 'uniform' || top === 'suit' ? 1.475 : top === 'tank' ? 1.38 : 1.445 - Math.max(0, Math.cos(a)) * 0.02;
    if (y > neckline) return RG.skin;
    return RG.shirt;
  };
  const ny = hi ? 30 : 12, nu = hi ? 28 : 12;
  surface(gb, lin(nu, 0, 1, true), dense(ny, 0, 1, (v) => 1 + 1.5 * gauss(0, v, 0, 0.75, 1, 0.12)), torsoP, (u, v, p) => {
    const a = u * Math.PI * 2;
    const y = p.y;
    let reg = shirtRegion(y, a);
    const wt = sstep(1.0, 1.12, y);
    const bones = [[B.pelvis, 1 - wt], [B.chest, wt]];
    const off = reg === RG.skin ? 0 : 0.003;
    p.x += Math.sin(a) * off; p.z += Math.cos(a) * off;
    const ao = 1 - 0.25 * gauss(Math.abs(Math.sin(a)), y, 1, 1.32, 0.2, 0.06) - 0.2 * sstep(0.84, 0.8, y);
    return { reg, bones, ao, joint: JK.waist, main: y < 1.06 ? B.pelvis : B.chest, uvx: u * 14, uvy: y * 14, aux: -1 };
  }, { closedU: true, axis: (v, o) => o.set(0, lerp(0.80, 1.495, v), 0), capStart: true });

  // -------- neck
  const neckTop = headC.y - 0.045 * hs;
  surface(gb, lin(hi ? 18 : 8, 0, 1, true), lin(hi ? 8 : 4, 0, 1), (u, v, out) => {
    const a = u * Math.PI * 2, y = lerp(1.40, neckTop, v);
    const r = (fem ? 0.047 : 0.054) * (1 + fat * 0.25) * (kid ? 0.85 : 1);
    let z = Math.cos(a) * r * 1.05 - 0.012;
    if (!fem && !kid) z += 0.004 * Math.max(0, Math.cos(a)) ** 8 * gauss(0, y, 0, 1.475, 1, 0.012);
    return out.set(Math.sin(a) * r, y, z);
  }, (u, v, p) => {
    const reg = (top === 'uniform' || top === 'suit' || top === 'hoodie') && v < 0.25 ? RG.shirt : coat && v < 0.15 ? RG.coat : RG.skin;
    return { reg, bones: [[B.chest, 1 - sstep(0, 0.4, v)], [B.neck, sstep(0, 0.4, v) * (1 - sstep(0.6, 1, v))], [B.head, sstep(0.6, 1, v)]], joint: v > 0.5 ? JK.neck : JK.neckBase, main: B.neck, ao: 0.85 + v * 0.15, uvx: u * 3, uvy: p.y * 4 };
  }, { closedU: true, axis: (v, o) => o.set(0, lerp(1.40, neckTop, v), -0.012) });

  // -------- head
  const thS = hi ? 46 : 16, phS = hi ? 52 : 18;
  let ths = dense(thS, 0.02, Math.PI - 0.02, (t) => 1 + 2.4 * gauss(0, t, 0, 1.78, 1, 0.42));
  if (hi) {
    // two rows right on the lip line (so the mouth can open into a real gap)
    const tmp = V3();
    const solve = (yt) => { let a = 1.3, b = 2.4; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; headPoint(m, 0, ctx, tmp); if (tmp.y > yt) a = m; else b = m; } return (a + b) / 2; };
    const t1 = solve(MOUTH_Y + 0.0006), t2 = solve(MOUTH_Y - 0.0006);
    ths = ths.filter((t) => Math.abs(t - t1) > 0.01 && Math.abs(t - t2) > 0.01).concat([t1, t2]).sort((x, y) => x - y);
  }
  const phs = dense(phS, -Math.PI, Math.PI, (ph) => 1 + 1.8 * Math.exp(-((ph / 0.85) ** 2))).slice(0, -1);
  const hp = V3();
  const headSurf = (u, v, out) => { headPoint(v, u, ctx, hp); return out.set(headC.x + hp.x * hs, headC.y + hp.y * hs, headC.z + hp.z * hs); };
  const headLocal = (p) => V3((p.x - headC.x) / hs, (p.y - headC.y) / hs, (p.z - headC.z) / hs);
  const mouthMorph = (h) => {
    const m = MORPHS.map(() => null);
    const fr = sstep(0.0, 0.06, h.z);
    // open: everything under the lip line drops (jaw), fading toward the ears + neck
    if (h.lipSide < 0) {
      const jaw = fr * sstep(0.072, 0.02, Math.abs(h.x)) * sstep(-0.14, -0.095, h.y);
      m[2] = V3(0, -0.017 * jaw * hs, -0.004 * jaw * hs);
    }
    // smile: corners up and back, cheeks up
    const corner = gauss(Math.abs(h.x), h.y, 0.025, MOUTH_Y, 0.012, 0.01) * fr;
    const cheek = gauss(Math.abs(h.x), h.y, 0.038, -0.027, 0.016, 0.016) * fr;
    m[1] = V3(Math.sign(h.x) * 0.0028 * corner * hs, (0.0042 * corner + 0.0018 * cheek) * hs, -0.0018 * corner * hs);
    // brows
    const brow = gauss(Math.abs(h.x), h.y, 0.03, 0.04, 0.03, 0.014) * fr;
    const inner = gauss(Math.abs(h.x), h.y, 0.012, 0.036, 0.014, 0.014) * fr;
    m[3] = V3(-Math.sign(h.x) * 0.002 * inner * hs, (-0.0048 * inner - 0.0012 * brow) * hs, 0.0008 * inner * hs);
    m[4] = V3(0, (0.0045 * inner - 0.0034 * corner) * hs, 0);
    m[5] = V3(0, 0.0055 * brow * hs, 0);
    return m;
  };
  const style = look.hair || 'short';
  surface(gb, phs.map((p) => (p + Math.PI) / (2 * Math.PI)), ths, (u, v, out) => headSurf(u * Math.PI * 2 - Math.PI, v, out), (u, v, p) => {
    const ph = u * Math.PI * 2 - Math.PI;
    const h = headLocal(p);
    const lipSide = h.y - MOUTH_Y;
    h.lipSide = Math.abs(lipSide) < 0.00065 ? Math.sign(lipSide) * 0.0006 : lipSide;
    const hm = style === 'bald' ? 0 : hairMask(h, ph, style);
    // ears are separate; fake ambient occlusion in creases
    let ao = 1 - 0.32 * gauss(Math.abs(h.x), h.y, 0.033, 0.016, 0.016, 0.012) * sstep(0, 0.05, h.z)
      - 0.18 * gauss(Math.abs(h.x), h.y, 0.017, -0.034, 0.008, 0.006) - 0.2 * sstep(-0.1, -0.13, h.y) * sstep(0.02, -0.04, h.z);
    const m = mouthMorph(h);
    return { reg: RG.skin, bones: [[B.head, 1]], ao, hp: h, aux: hm, lip: h.lipSide, morph: m, uvx: u * 10, uvy: v * 8, main: B.head };
  }, { closedU: true, axis: () => headC.clone() });

  // -------- ears: outline + rim (helix) + bowl (concha), angled out from the head
  for (const s of [1, -1]) {
    const er = F.ear * (kid ? 1.05 : 1);
    const base = V3(s * 0.066, -0.006, -0.016);
    const outA = 0.38; // how far it sticks out (radians)
    surface(gb, lin(hi ? 18 : 8, 0, 1, true), lin(hi ? 8 : 4, 0, 1), (u, v, out) => {
      const a = u * Math.PI * 2;
      // outline: taller than wide, lobe at the bottom
      const oy = Math.sin(a) * 0.03 * er, oz = Math.cos(a) * 0.0165 * er * (Math.sin(a) < 0 ? 0.85 : 1);
      // v: 0 = front face center, 0.5 = rim, 1 = back face center
      const rim = Math.sin(v * Math.PI);
      const r = v < 0.5 ? sstep(0, 0.5, v) : sstep(1, 0.5, v);
      const bowl = v < 0.5 ? -0.0045 * (1 - sstep(0.15, 0.45, v)) : 0;
      const thick = (v < 0.5 ? 0.0028 : -0.0012) * (0.6 + rim) + bowl;
      // flare: the rim sticks out from the head
      const lat = 0.004 + 0.012 * r + thick;
      const y = oy * r, z = oz * r;
      const zt = z * Math.cos(outA) - lat * Math.sin(outA) * 0.3;
      const lp = V3(base.x + s * (lat * Math.cos(outA * 0.5)), base.y + y, base.z + zt - 0.004 * r);
      return out.set(headC.x + lp.x * hs, headC.y + lp.y * hs, headC.z + lp.z * hs);
    }, (u, v, p) => {
      const front = v < 0.5;
      return { reg: RG.ear, bones: [[B.head, 1]], ao: front ? 0.55 + 0.45 * sstep(0.15, 0.45, v) : 0.9, hp: headLocal(p), main: B.head };
    }, { closedU: true, axis: () => V3(headC.x + base.x * hs, headC.y + base.y * hs, headC.z + base.z * hs) });
  }

  // -------- eyes (separate bones so they can look around) + lids
  const eyeR = 0.0122 * (baby ? 1.08 : 1);
  const eyes = [];
  for (const s of [1, -1]) {
    const ex = s * 0.032 * F.eyeSpace, ey = 0.014;
    // surface z of the face there (without the socket) -> sit the eye a bit behind it
    let zf = 0; { const t = V3(); for (let k = 0; k < 30; k++) { /* find front point at (ex, ey) */ } headPoint(Math.acos(ey / 0.112), Math.asin(clamp(ex / (0.076 * Math.sin(Math.acos(ey / 0.112))), -1, 1)), ctx, t); zf = t.z; }
    const ec = V3(ex, ey, zf - eyeR * 0.92);
    eyes.push(ec);
    const bone = s > 0 ? B.lEye : B.rEye;
    const n = hi ? 20 : 10;
    surface(gb, lin(n, 0, 1, true), lin(hi ? 14 : 7, 0.01, 0.99), (u, v, out) => {
      const th = v * Math.PI, ph = u * Math.PI * 2;
      const d = V3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      // cornea bulge
      const bulge = 1 + 0.08 * sstep(0.75, 0.95, d.z);
      return out.set(headC.x + (ec.x + d.x * eyeR * bulge) * hs, headC.y + (ec.y + d.y * eyeR * bulge) * hs, headC.z + (ec.z + d.z * eyeR * bulge) * hs);
    }, (u, v, p) => {
      const th = v * Math.PI, ph = u * Math.PI * 2;
      const d = V3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      return { reg: RG.eye, bones: [[bone, 1]], hp: d, main: bone, ao: 1 };
    }, { closedU: true, axis: () => V3(headC.x + ec.x * hs, headC.y + ec.y * hs, headC.z + ec.z * hs) });
    // upper + lower lids: shells around the eye. Blink rotates the upper one down.
    for (const upper of [true, false]) {
      const rl = eyeR * 1.055;
      const g0 = upper ? 0.1 : 2.04, g1 = upper ? 1.04 : 2.6; // angle from straight up
      const tilt = F.eyeTilt * s;
      surface(gb, lin(hi ? 12 : 6, -1, 1), lin(hi ? 6 : 3, 0, 1), (u, v, out) => {
        const be = u * 1.25;
        const ga = lerp(g0, g1, upper ? v : 1 - v);
        const d = V3(Math.sin(ga) * Math.sin(be), Math.cos(ga) + tilt * Math.sin(be) * 0.3, Math.sin(ga) * Math.cos(be));
        return out.set(headC.x + (ec.x + d.x * rl) * hs, headC.y + (ec.y + d.y * rl) * hs, headC.z + (ec.z + d.z * rl) * hs);
      }, (u, v, p) => {
        const be = u * 1.25;
        const ga = lerp(g0, g1, upper ? v : 1 - v);
        const lp = V3(Math.sin(ga) * Math.sin(be), Math.cos(ga), Math.sin(ga) * Math.cos(be)).multiplyScalar(rl);
        const morph = MORPHS.map(() => null);
        const rot = (ang) => { const q = new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), ang); return lp.clone().applyQuaternion(q).sub(lp).multiplyScalar(hs); };
        if (upper) { morph[0] = rot(1.05 * (0.25 + 0.75 * v)); morph[5] = rot(-0.22 * v); morph[3] = rot(0.18 * v); }
        else morph[0] = rot(-0.15 * v);
        const h = headLocal(p);
        return { reg: RG.lid, bones: [[B.head, 1]], aux: upper ? v : 0.6 * v, hp: h, morph, main: B.head, ao: 0.85 };
      }, { axis: () => V3(headC.x + ec.x * hs, headC.y + ec.y * hs, headC.z + ec.z * hs) });
    }
  }

  // -------- hair / beard shells over the head
  const shell = (maskFn, thick, reg, opts = {}) => {
    const t = V3();
    surface(gb, phs.map((p) => (p + Math.PI) / (2 * Math.PI)), ths, (u, v, out) => {
      const ph = u * Math.PI * 2 - Math.PI;
      headPoint(v, ph, ctx, t);
      const m = maskFn(t, ph);
      const dir = V3(Math.sin(v) * Math.sin(ph), Math.cos(v), Math.sin(v) * Math.cos(ph));
      const mt = sstep(0.22, 0.8, m);
      let th = thick(t, ph, v) * mt;
      if (opts.noise) th += opts.noise(t, ph, v) * mt;
      th = Math.max(th, 0.0004 * m);
      return out.set(headC.x + (t.x + dir.x * th) * hs, headC.y + (t.y + dir.y * th) * hs, headC.z + (t.z + dir.z * th) * hs);
    }, (u, v, p) => {
      const ph = u * Math.PI * 2 - Math.PI;
      headPoint(v, ph, ctx, t);
      const m = maskFn(t, ph);
      if (m < 0.22) return { skip: true };
      return { reg, bones: [[B.head, 1]], aux: m, hp: headLocal(p), uvx: (ph + Math.PI) * 6, uvy: v * 1.2, main: B.head, ao: 0.75 + 0.25 * m, morph: opts.morph ? mouthMorph(t) : null };
    }, { closedU: true, axis: () => headC.clone() });
  };
  const hairThick = { short: 0.009, buzz: 0.0025, long: 0.011, spiky: 0.011, bun: 0.008, pony: 0.008, afro: 0.04, mohawk: 0.03, curly: 0.017 }[style];
  if (style !== 'bald' && hairThick) {
    const hn = style === 'spiky' ? (t, ph, v) => Math.max(0, Math.sin(ph * 9) * Math.sin(v * 14)) ** 3 * 0.02 * sstep(0.04, 0.09, t.y)
      : style === 'curly' || style === 'afro' ? (t, ph, v) => (Math.sin(ph * 17) * Math.sin(v * 21) + Math.sin(ph * 11 + v * 7)) * 0.0028
        : style === 'short' ? (t, ph) => 0.003 * sstep(0.04, 0.1, t.y) * Math.max(0, Math.cos(ph)) : null;
    shell((t, ph) => hairMask(t, ph, style), (t, ph) => hairThick * (style === 'afro' ? sstep(-0.1, 0.05, t.y) * 0.6 + 0.4 : style === 'buzz' ? 1 : 0.55 + 0.6 * sstep(0.0, 0.1, t.y) + 0.15 * Math.max(0, Math.cos(ph))), RG.hair, { noise: (t, ph, v) => (hn ? hn(t, ph, v) : 0) + (style !== 'buzz' ? (Math.sin(ph * 23 + v * 5) * Math.sin(v * 31) * 0.0013) : 0) });
    const hb = [[B.head, 1]];
    if (style === 'long' || style === 'pony' || style === 'bun') {
      // hair down the back / ponytail / bun
      const len = style === 'long' ? (fem ? 0.27 : 0.2) : style === 'pony' ? 0.2 : 0;
      if (len) {
        surface(gb, lin(hi ? 16 : 7, 0, 1), lin(hi ? 10 : 5, 0, 1), (u, v, out) => {
          const a = lerp(-2.1, 2.1, u) + Math.PI;
          const wide = style === 'pony' ? 0.022 * (1 - v * 0.6) : lerp(0.082, 0.075, v);
          const r = style === 'pony' ? wide : wide;
          const y = lerp(0.02, -0.02 - len, v);
          const cz = style === 'pony' ? -0.105 - v * 0.02 : -0.02 - v * 0.035;
          const x = Math.sin(a) * r * (style === 'pony' ? 1 : 1.0);
          const z = cz + Math.cos(a) * (style === 'pony' ? r : r * 0.85);
          return out.set(headC.x + x * hs, headC.y + y * hs, headC.z + z * hs);
        }, (u, v, p) => ({ reg: RG.hair, bones: v > 0.45 ? [[B.head, 1 - (v - 0.45)], [B.neck, (v - 0.45)]] : hb, aux: 1, uvx: u * 6, uvy: v * 2, hp: headLocal(p), main: B.head, ao: 0.8 + 0.2 * (1 - v) }), { closedU: style === 'pony', axis: (v) => V3(headC.x, headC.y + lerp(0.02, -0.02 - len, v) * hs, headC.z + (style === 'pony' ? -0.105 : -0.0) * hs), capEnd: style === 'pony' });
      }
      if (style === 'bun') {
        surface(gb, lin(hi ? 14 : 7, 0, 1, true), lin(hi ? 9 : 5, 0.02, 0.98), (u, v, out) => {
          const th = v * Math.PI, ph = u * Math.PI * 2;
          return out.set(headC.x + Math.sin(th) * Math.sin(ph) * 0.034 * hs, headC.y + (0.07 + Math.cos(th) * 0.028) * hs, headC.z + (-0.085 + Math.sin(th) * Math.cos(ph) * 0.03) * hs);
        }, () => ({ reg: RG.hair, bones: hb, aux: 1, main: B.head }), { closedU: true, axis: () => V3(headC.x, headC.y + 0.07 * hs, headC.z - 0.085 * hs) });
      }
    }
  }
  if (look.beard) shell((t, ph) => beardMask(t, ph, 'beard'), () => 0.0065, RG.hair, { noise: (t, ph, v) => Math.sin(ph * 31 + v * 13) * 0.0012, morph: true });
  if (look.mustache || look.beard) shell((t, ph) => beardMask(t, ph, 'mustache'), () => 0.004, RG.hair, {});

  // -------- arms
  const R = { lens: {}, chestLen: 0 };
  const limbs = [];
  for (const s of [1, -1]) {
    const L = s > 0;
    const sh = J[L ? P.lSh : P.rSh], el = J[L ? P.lEl : P.rEl], ha = J[L ? P.lHa : P.rHa];
    const ua = L ? B.lUA : B.rUA, fa = L ? B.lFA : B.rFA, hb = L ? B.lHand : B.rHand;
    R.lens[L ? 'lUA' : 'rUA'] = sh.distanceTo(el); R.lens[L ? 'lFA' : 'rFA'] = el.distanceTo(ha);
    const fatA = 1 + fat * 0.45, mus = 1 + musc * 0.14;
    const sleeveEnd = longSleeve ? 2 : top === 'tank' ? -1 : 0.52;
    const armReg = (part, t) => {
      if (part === 'ua') { if (top === 'tank') return t < -0.08 ? RG.shirt : RG.skin; return t < sleeveEnd ? (coat ? RG.coat : RG.shirt) : RG.skin; }
      return longSleeve && t < 0.94 ? (coat ? RG.coat : RG.shirt) : RG.skin;
    };
    limbs.push({ a: sh, b: el, v0: -0.12, v1: 1.07, bone: ua, prev: B.chest, next: fa, jointA: L ? 'lShoulder' : 'rShoulder', jointB: L ? 'lElbow' : 'rElbow', side: s,
      r: (t) => table([-0.12, -0.03, 0.12, 0.45, 0.85, 1.07], [0.03, 0.043, 0.045, 0.042 * mus, 0.036, 0.034], t) * (fem ? 0.88 : 1) * fatA * (kid ? 0.9 : 1),
      ex: (t, a) => 1 + 0.06 * Math.cos(a) * gauss(0, t, 0, 0.45, 1, 0.2) * mus, reg: (t) => armReg('ua', t), blendA: 0.12, blendB: 0.1 });
    limbs.push({ a: el, b: ha, v0: -0.06, v1: 1.04, bone: fa, prev: ua, next: hb, jointA: L ? 'lElbow' : 'rElbow', jointB: L ? 'lWrist' : 'rWrist', side: s,
      r: (t) => table([-0.06, 0.2, 0.6, 0.95, 1.04], [0.035, 0.039 * mus, 0.031, 0.025, 0.024], t) * (fem ? 0.88 : 1) * (1 + fat * 0.3) * (kid ? 0.9 : 1),
      flat: (t) => lerp(1, 0.72, sstep(0.3, 1, t)), reg: (t) => armReg('fa', t), blendA: 0.12, blendB: 0.05 });
  }
  // -------- legs
  for (const s of [1, -1]) {
    const L = s > 0;
    const hp_ = J[L ? P.lHip : P.rHip], kn = J[L ? P.lKn : P.rKn], ft = J[L ? P.lFt : P.rFt];
    R.lens[L ? 'lTH' : 'rTH'] = hp_.distanceTo(kn); R.lens[L ? 'lSH' : 'rSH'] = kn.distanceTo(ft);
    const th = L ? B.lTH : B.rTH, shn = L ? B.lSH : B.rSH, fo = L ? B.lFoot : B.rFoot;
    const fatL = 1 + fat * 0.5;
    const legReg = (part, t) => {
      if (bottom === 'skirt') return RG.skin;
      if (bottom === 'shorts') return part === 'th' && t < 0.62 ? RG.pants : RG.skin;
      return part === 'th' || t < 0.975 ? RG.pants : RG.skin;
    };
    limbs.push({ a: hp_, b: kn, v0: -0.18, v1: 1.05, bone: th, prev: B.pelvis, next: shn, jointA: L ? 'lHip' : 'rHip', jointB: L ? 'lKnee' : 'rKnee', side: s,
      r: (t) => table([-0.18, 0, 0.25, 0.6, 0.9, 1.05], [0.055, 0.074, 0.074, 0.064, 0.053, 0.05], t) * (fem ? 1.06 : 1) * fatL * (1 + musc * 0.08) * (kid ? 0.88 : 1),
      ex: (t, a) => 1 + 0.07 * Math.cos(a) * gauss(0, t, 0, 0.4, 1, 0.25), reg: (t) => legReg('th', t), blendA: 0.16, blendB: 0.08, inner: true, leg: true });
    limbs.push({ a: kn, b: ft, v0: -0.06, v1: 1.03, bone: shn, prev: th, next: fo, jointA: L ? 'lKnee' : 'rKnee', jointB: L ? 'lAnkle' : 'rAnkle', side: s,
      r: (t) => table([-0.06, 0.08, 0.3, 0.7, 0.95, 1.03], [0.051, 0.05, 0.05, 0.037, 0.029, 0.029], t) * (1 + fat * 0.35) * (kid ? 0.88 : 1),
      ex: (t, a) => 1 + 0.24 * Math.max(0, -Math.cos(a)) ** 1.5 * gauss(0, t, 0, 0.3, 1, 0.18) + 0.08 * Math.max(0, Math.cos(a)) ** 4 * gauss(0, t, 0, 0.0, 1, 0.07), reg: (t) => legReg('sh', t), blendA: 0.08, blendB: 0.06, hem: bottom === 'long' ? 0.975 : null, leg: true, shin: true });
  }
  for (const lb of limbs) {
    const dir = V3().subVectors(lb.b, lb.a);
    const len = dir.length(); dir.normalize();
    const side = ortho(V3(1, 0, 0), dir, V3());
    const fwd = V3().crossVectors(side, dir);
    const nr = hi ? 16 : 8, nl = hi ? 12 : 5;
    const vals = lin(nl + 2, lb.v0, lb.v1);
    surface(gb, lin(nr, 0, 1, true), vals, (u, t, out) => {
      const a = u * Math.PI * 2;
      let r = lb.r(t) * (lb.ex ? lb.ex(t, a) : 1);
      const reg = lb.reg(t);
      if (reg !== RG.skin) r += 0.0035 + (lb.hem && t > lb.hem - 0.02 ? 0.004 : 0);
      const fl = lb.flat ? lb.flat(t) : 1;
      const c = V3().copy(lb.a).addScaledVector(dir, len * t);
      return out.copy(c).addScaledVector(side, Math.sin(a) * r * fl).addScaledVector(fwd, Math.cos(a) * r);
    }, (u, t) => {
      const wA = lb.blendA ? sstep(lb.blendA, -0.04, t) * 0.5 : 0;
      const wB = lb.blendB ? sstep(1 - lb.blendB, 1.04, t) * 0.5 : 0;
      const bones = [[lb.bone, 1 - wA - wB]];
      if (wA > 0) bones.push([lb.prev, wA]);
      if (wB > 0) bones.push([lb.next, wB]);
      const ao = 1 - 0.22 * sstep(0.08, -0.15, t) - (lb.inner ? 0.08 * Math.max(0, -Math.sin(u * Math.PI * 2) * lb.side) : 0);
      return { reg: lb.reg(t), bones, ao, joint: t < 0.5 ? JK[lb.jointA] : JK[lb.jointB], main: lb.bone, uvx: u * 6 + (lb.leg ? 0.5 : 0), uvy: t * len * 18, aux: (lb.leg ? 2 : 1) + clamp(t, 0, 0.999) };
    }, { closedU: true, axis: (t, o) => o.copy(lb.a).addScaledVector(dir, len * t), capStart: true });
  }

  // -------- hands (palm + fingers; mitten at low detail)
  for (const s of [1, -1]) {
    const L = s > 0;
    const wr = J[L ? P.lHa : P.rHa], elb = J[L ? P.lEl : P.rEl];
    const hb = L ? B.lHand : B.rHand;
    const dir = V3().subVectors(wr, elb).normalize();
    const out = ortho(V3(s, 0, 0), dir, V3()); // back of the hand faces out
    const fw = V3().crossVectors(out, dir).multiplyScalar(s); // thumb side = forward
    const reg = look.gloves ? RG.gloves : RG.skin;
    const hsz = (fem ? 0.9 : 1) * (kid ? 0.85 : 1) * (1 + fat * 0.1);
    const palmLen = 0.095 * hsz;
    surface(gb, lin(hi ? 14 : 8, 0, 1, true), lin(hi ? 7 : 4, -0.05, 1), (u, t, o) => {
      const a = u * Math.PI * 2;
      const wz = lerp(0.026, 0.041, sstep(0, 0.7, t)) * hsz, wx = lerp(0.016, 0.0125, t) * hsz;
      const n = 3;
      const sa = Math.sin(a), ca = Math.cos(a);
      const c = V3().copy(wr).addScaledVector(dir, palmLen * t);
      return o.copy(c).addScaledVector(out, Math.sign(sa) * Math.abs(sa) ** (2 / n) * wx).addScaledVector(fw, Math.sign(ca) * Math.abs(ca) ** (2 / n) * wz);
    }, (u, t) => ({ reg, bones: t < 0.15 ? [[hb, 0.6 + t * 2.6], [L ? B.lFA : B.rFA, 0.4 - t * 2.6]] : [[hb, 1]], joint: JK[L ? 'lWrist' : 'rWrist'], main: hb, uvx: u * 2, uvy: t * 2, ao: 0.95 }), { closedU: true, axis: (t, o) => o.copy(wr).addScaledVector(dir, palmLen * t), capEnd: !hi });
    if (hi) {
      const fingers = [[0.029, 0.072], [0.01, 0.08], [-0.01, 0.075], [-0.028, 0.059]];
      for (const [fz, fl] of fingers) {
        const base = V3().copy(wr).addScaledVector(dir, palmLen * 0.98).addScaledVector(fw, fz * hsz);
        const curl = 0.35;
        const pt = (t) => { const ang = curl * t * 1.6; return V3().copy(base).addScaledVector(dir, Math.cos(ang) * fl * hsz * t).addScaledVector(out, -Math.sin(ang) * fl * hsz * t * 0.6); };
        surface(gb, lin(8, 0, 1, true), lin(6, 0, 1), (u, t, o) => {
          const a = u * Math.PI * 2;
          const r = lerp(0.0088, 0.0068, t) * hsz;
          const c = pt(t);
          const d = V3().subVectors(pt(Math.min(1, t + 0.01)), pt(Math.max(0, t - 0.01))).normalize();
          const sx = ortho(fw, d, V3()), sz = V3().crossVectors(d, sx);
          return o.copy(c).addScaledVector(sx, Math.cos(a) * r).addScaledVector(sz, Math.sin(a) * r * 0.9);
        }, (u, t, p, n) => ({ reg: !look.gloves && t > 0.72 && n.dot(out) > 0.4 ? RG.nail : reg, bones: [[hb, 1]], main: hb, ao: 0.9, uvx: u, uvy: t }), { closedU: true, axis: (t, o) => o.copy(pt(t)), capEnd: true });
      }
      // thumb
      const tb = V3().copy(wr).addScaledVector(dir, palmLen * 0.32).addScaledVector(fw, 0.03 * hsz).addScaledVector(out, -0.006);
      const td = V3().copy(dir).multiplyScalar(0.55).addScaledVector(fw, 0.6).addScaledVector(out, -0.35).normalize();
      surface(gb, lin(8, 0, 1, true), lin(6, 0, 1), (u, t, o) => {
        const a = u * Math.PI * 2;
        const r = lerp(0.0108, 0.0078, t) * hsz;
        const c = V3().copy(tb).addScaledVector(td, 0.058 * hsz * t);
        const sx = ortho(out, td, V3()), sz = V3().crossVectors(td, sx);
        return o.copy(c).addScaledVector(sx, Math.cos(a) * r).addScaledVector(sz, Math.sin(a) * r);
      }, (u, t, p, n) => ({ reg: !look.gloves && t > 0.75 && n.dot(out) > 0.3 ? RG.nail : reg, bones: [[hb, 1]], main: hb, ao: 0.92, uvx: u, uvy: t }), { closedU: true, axis: (t, o) => o.copy(tb).addScaledVector(td, 0.058 * hsz * t), capEnd: true });
    }
  }

  // -------- shoes
  for (const s of [1, -1]) {
    const L = s > 0;
    const ft = J[L ? P.lFt : P.rFt], toe = J[L ? P.lToe : P.rToe];
    const fo = L ? B.lFoot : B.rFoot, shn = L ? B.lSH : B.rSH;
    const fwd = V3(toe.x - ft.x, 0, toe.z - ft.z).normalize();
    const sd = V3().crossVectors(V3(0, 1, 0), fwd).normalize();
    const fl = (kid ? 0.8 : 1) * (fem ? 0.92 : 1) * (baby ? 0.6 : 1);
    const heel = V3().copy(ft).addScaledVector(fwd, -0.05 * fl); heel.y = 0;
    const len = 0.27 * fl;
    surface(gb, lin(hi ? 16 : 8, 0, 1, true), lin(hi ? 12 : 6, 0, 1), (u, t, o) => {
      const a = u * Math.PI * 2;
      const w = table([0, 0.15, 0.6, 0.85, 1], [0.03, 0.036, 0.046, 0.04, 0.012], t) * fl;
      const hgt = table([0, 0.2, 0.42, 0.7, 1], [0.092, 0.098, 0.07, 0.04, 0.025], t) * fl;
      const cy = hgt * 0.5;
      let y = cy + Math.cos(a) * hgt * 0.5;
      const sole = 0.012 * fl;
      if (y < sole) y = lerp(0, sole, sstep(-0.3, 0, Math.cos(a) + 0.9));
      const c = V3().copy(heel).addScaledVector(fwd, len * t);
      return o.set(c.x + sd.x * Math.sin(a) * w, y, c.z + sd.z * Math.sin(a) * w);
    }, (u, t, p) => {
      const top = p.y > 0.06 * fl && t < 0.45;
      const bones = top ? [[fo, 0.6], [shn, 0.4]] : [[fo, 1]];
      return { reg: p.y < 0.0125 * fl ? RG.sole : RG.shoes, bones, joint: JK[L ? 'lAnkle' : 'rAnkle'], main: fo, ao: p.y < 0.02 ? 0.8 : 1, uvx: u * 3, uvy: t * 3, aux: t };
    }, { closedU: true, axis: (t, o) => o.copy(heel).addScaledVector(fwd, len * t).setY(0.04 * fl), capStart: true, capEnd: true });
  }

  // -------- skirt
  if (bottom === 'skirt') {
    surface(gb, lin(hi ? 24 : 10, 0, 1, true), lin(hi ? 8 : 4, 0, 1), (u, v, o) => {
      const a = u * Math.PI * 2, y = lerp(0.99, 0.56, v);
      const flare = 1 + v * 0.38;
      const W = torsoW(Math.max(0.9, y), a) * flare + 0.006, D = torsoD(Math.max(0.9, y), a) * flare + 0.006;
      return o.set(Math.sin(a) * W, y, Math.cos(a) * D + table(TORSO_Y, TZ, 0.92));
    }, (u, v) => {
      const sx = Math.sin(u * Math.PI * 2);
      const leg = 0.45 * sstep(0.2, 1, v);
      return { reg: RG.pants, bones: [[B.pelvis, 1 - leg], [sx > 0 ? B.lTH : B.rTH, leg * Math.abs(sx)], [B.lTH, leg * (1 - Math.abs(sx)) * 0.5], [B.rTH, leg * (1 - Math.abs(sx)) * 0.5]], main: B.pelvis, ao: 1 - v * 0.15, uvx: u * 6, uvy: v * 3 };
    }, { closedU: true, axis: (v, o) => o.set(0, lerp(0.99, 0.56, v), 0) });
  }

  // -------- lab coat (open front)
  if (coat) {
    surface(gb, lin(hi ? 30 : 12, 0, 1, true), dense(hi ? 18 : 8, 0, 1, (v) => 1 + gauss(0, v, 0, 0.15, 1, 0.12)), (u, v, o) => {
      const a = u * Math.PI * 2, y = lerp(1.455, 0.52, v);
      const yy = Math.max(0.86, y);
      const s = Math.sin(a), c = Math.cos(a);
      const flare = 1 + sstep(0.95, 0.52, y) * 0.16;
      const W = (torsoW(yy, a) + 0.016) * flare, D = (torsoD(yy, a) + 0.016) * flare;
      const n = 2.4;
      return o.set(Math.sign(s) * Math.abs(s) ** (2 / n) * W, y, Math.sign(c) * Math.abs(c) ** (2 / n) * D + table(TORSO_Y, TZ, yy) + 0.002);
    }, (u, v, p) => {
      const a = u * Math.PI * 2;
      const front = Math.cos(a);
      if (front > 0.985 && p.y < 1.3) return { skip: true };
      const y = p.y;
      const wt = sstep(1.0, 1.12, y);
      const sx = Math.sin(a);
      const leg = 0.35 * sstep(0.85, 0.55, y);
      const bones = [[B.pelvis, (1 - wt) * (1 - leg)], [B.chest, wt], [sx > 0 ? B.lTH : B.rTH, (1 - wt) * leg]];
      return { reg: RG.coat, bones, main: y < 1.06 ? B.pelvis : B.chest, joint: JK.waist, ao: 0.92 - 0.1 * sstep(0.7, 0.52, y), uvx: u * 14, uvy: y * 14, aux: -1 };
    }, { closedU: true, axis: (v, o) => o.set(0, lerp(1.455, 0.52, v), 0) });
  }

  // -------- hoodie hood
  if (top === 'hoodie') {
    surface(gb, lin(hi ? 14 : 6, 0, 1), lin(hi ? 8 : 4, 0, 1, true), (u, v, o) => {
      const a = lerp(Math.PI * 0.35, Math.PI * 1.65, u), b = v * Math.PI * 2;
      const R0 = 0.082, r0 = 0.026;
      return o.set(Math.sin(a) * (R0 + Math.cos(b) * r0), 1.455 + Math.sin(b) * r0 * 0.8, Math.cos(a) * (R0 + Math.cos(b) * r0) - 0.035);
    }, () => ({ reg: RG.shirt, bones: [[B.chest, 0.7], [B.neck, 0.3]], main: B.chest, ao: 0.85 }), { axis: (v, o) => o.set(0, 1.455, -0.035) });
  }

  // -------- backpack (the scientist's tool pack)
  if (look.pack) {
    const bc = V3(0, 1.17, -torsoD(1.17, Math.PI) - 0.055);
    surface(gb, lin(hi ? 16 : 8, 0, 1, true), lin(hi ? 8 : 4, 0, 1), (u, v, o) => {
      const a = u * Math.PI * 2, y = lerp(-0.17, 0.17, v);
      const sa = Math.sin(a), ca = Math.cos(a);
      const r = 1 - 0.25 * Math.abs(y / 0.17) ** 6;
      return o.set(bc.x + Math.sign(sa) * Math.abs(sa) ** 0.5 * 0.13 * r, bc.y + y, bc.z + Math.sign(ca) * Math.abs(ca) ** 0.5 * 0.055 * r);
    }, () => ({ reg: RG.pack, bones: [[B.chest, 1]], main: B.chest, ao: 0.9 }), { closedU: true, axis: (v, o) => o.set(bc.x, bc.y + lerp(-0.17, 0.17, v), bc.z), capStart: true, capEnd: true });
  }

  // -------- hats + glasses + goggles (head-local helpers)
  const H = (x, y, z) => V3(headC.x + x * hs, headC.y + y * hs, headC.z + z * hs);
  const hatBones = [[B.head, 1]];
  const hatSurf = (f, reg, nu_, nv_, opts = {}) => surface(gb, lin(nu_, 0, 1, true), lin(nv_, 0, 1), (u, v, o) => { const q = f(u * Math.PI * 2, v); return o.copy(H(q.x, q.y, q.z)); }, () => ({ reg, bones: hatBones, main: B.head, ao: opts.ao ?? 1 }), { closedU: true, axis: (v, o) => o.copy(H(0, opts.cy ? opts.cy(v) : 0.06, -0.006)), ...opts });
  const dome = (r, y0, lift = 0) => (a, v) => { const th = v * Math.PI * 0.55; return V3(Math.sin(th) * Math.sin(a) * (0.08 + r), y0 + Math.cos(th) * (0.07 + r + lift) - 0.01, Math.sin(th) * Math.cos(a) * (0.098 + r) - 0.006); };
  const hq = hi ? 1 : 0.5;
  switch (look.hat) {
    case 'cap': case 'cop':
      hatSurf(dome(0.007, 0.045), RG.hat, Math.round(20 * hq), Math.round(8 * hq));
      surface(gb, lin(Math.round(12 * hq), 0, 1), lin(3, 0, 1), (u, v, o) => { const a = lerp(-1.1, 1.1, u); const r = 0.09 + v * (look.hat === 'cop' ? 0.05 : 0.075); return o.copy(H(Math.sin(a) * r * 0.95, 0.052 - v * 0.012, Math.cos(a) * r - 0.005)); }, () => ({ reg: look.hat === 'cop' ? RG.trim : RG.hat, bones: hatBones, main: B.head }), {});
      if (look.hat === 'cop') hatSurf((a, v) => V3(Math.sin(a) * 0.1 * v, 0.125, Math.cos(a) * 0.11 * v - 0.01), RG.hat, Math.round(16 * hq), 3, { flipN: true });
      break;
    case 'hard':
      hatSurf(dome(0.018, 0.045, 0.01), RG.hat, Math.round(22 * hq), Math.round(9 * hq));
      hatSurf((a, v) => V3(Math.sin(a) * (0.1 + v * 0.025), 0.05 - v * 0.004, Math.cos(a) * (0.118 + v * 0.03) - 0.006), RG.hat, Math.round(22 * hq), 3);
      break;
    case 'beanie':
      hatSurf(dome(0.01, 0.02, 0.012), RG.hat, Math.round(20 * hq), Math.round(9 * hq));
      break;
    case 'chef':
      hatSurf((a, v) => { const r = 0.085 + Math.sin(v * Math.PI) * 0.02 * (v > 0.5 ? 1.4 : 0.3) + Math.sin(a * 8) * 0.004 * v; return V3(Math.sin(a) * r, 0.06 + v * 0.17, Math.cos(a) * r - 0.006); }, RG.hat, Math.round(22 * hq), Math.round(8 * hq), { capEnd: true });
      break;
    case 'witch':
      hatSurf((a, v) => V3(Math.sin(a) * 0.088 * (1 - v), 0.07 + v * 0.22 + (v > 0.85 ? (v - 0.85) * 0.2 : 0), Math.cos(a) * 0.098 * (1 - v) - 0.03 * v * v), RG.hat, Math.round(18 * hq), Math.round(8 * hq));
      hatSurf((a, v) => V3(Math.sin(a) * (0.09 + v * 0.09), 0.068, Math.cos(a) * (0.1 + v * 0.09)), RG.hat, Math.round(24 * hq), 3);
      break;
    case 'crown':
      hatSurf((a, v) => V3(Math.sin(a) * 0.084, 0.075 + v * (0.035 + Math.max(0, Math.cos(a * 5)) ** 6 * 0.035), Math.cos(a) * 0.095 - 0.006), RG.trim, Math.round(30 * hq), 4);
      break;
    case 'horns':
      for (const s of [1, -1]) surface(gb, lin(8, 0, 1, true), lin(Math.round(8 * hq), 0, 1), (u, v, o) => {
        const a = u * Math.PI * 2; const r = 0.016 * (1 - v);
        const c = V3(s * (0.045 + v * 0.03), 0.085 + Math.sin(v * 1.6) * 0.06, -0.01 + v * 0.02);
        return o.copy(H(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r));
      }, () => ({ reg: RG.horn, bones: hatBones, main: B.head }), { closedU: true, axis: (v, o) => o.copy(H(s * (0.045 + v * 0.03), 0.085 + Math.sin(v * 1.6) * 0.06, -0.01)), capEnd: true });
      break;
    case 'band':
      surface(gb, lin(Math.round(24 * hq), 0, 1, true), lin(5, 0, 1, true), (u, v, o) => { const a = u * Math.PI * 2, b = v * Math.PI * 2; const r = 0.004; return o.copy(H(Math.sin(a) * (0.08 + Math.cos(b) * r), 0.055 + Math.sin(b) * r * 2.5, Math.cos(a) * (0.096 + Math.cos(b) * r) - 0.006)); }, () => ({ reg: RG.hat, bones: hatBones, main: B.head }), { closedU: true, axis: () => H(0, 0.055, -0.006) });
      break;
    default: break;
  }
  if (look.glasses || look.goggles) {
    for (const s of [1, -1]) {
      const e = eyes[s > 0 ? 0 : 1];
      const gz = e.z + eyeR + (look.goggles ? 0.012 : 0.009);
      if (look.goggles) {
        surface(gb, lin(Math.round(14 * hq), 0, 1, true), lin(3, 0, 1), (u, v, o) => { const a = u * Math.PI * 2; const r = 0.02; return o.copy(H(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.85, gz - 0.012 + v * 0.014)); }, () => ({ reg: RG.frame, bones: hatBones, main: B.head }), { closedU: true, axis: () => H(e.x, e.y, gz) });
        surface(gb, lin(Math.round(14 * hq), 0, 1, true), lin(2, 0, 1), (u, v, o) => { const a = u * Math.PI * 2; const r = 0.019 * (1 - v); return o.copy(H(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.85, gz + 0.003)); }, () => ({ reg: RG.lens, bones: hatBones, main: B.head }), { flipN: false, axis: () => H(e.x, e.y, gz - 0.02) });
      } else {
        surface(gb, lin(Math.round(16 * hq), 0, 1, true), lin(4, 0, 1, true), (u, v, o) => { const a = u * Math.PI * 2, b = v * Math.PI * 2; const R0 = 0.017, r = 0.0016; return o.copy(H(e.x + Math.cos(a) * (R0 + Math.cos(b) * r) * 1.15, e.y + Math.sin(a) * (R0 + Math.cos(b) * r) * 0.82, gz + Math.sin(b) * r)); }, () => ({ reg: RG.frame, bones: hatBones, main: B.head }), { closedU: true, axis: () => H(e.x, e.y, gz) });
      }
      // arm back to the ear
      surface(gb, lin(5, 0, 1, true), lin(4, 0, 1), (u, v, o) => { const a = u * Math.PI * 2; const r = look.goggles ? 0.0045 : 0.0014; const c = V3(s * lerp(Math.abs(e.x) + 0.02, 0.079, v), e.y + (look.goggles ? 0 : 0.004) - v * 0.004, lerp(gz - 0.005, -0.03, v)); return o.copy(H(c.x, c.y + Math.cos(a) * r * (look.goggles ? 2 : 1), c.z + Math.sin(a) * r)); }, () => ({ reg: look.goggles ? RG.pack : RG.frame, bones: hatBones, main: B.head }), { closedU: true, axis: (v, o) => o.copy(H(s * lerp(Math.abs(e.x) + 0.02, 0.079, v), e.y, lerp(gz, -0.03, v))) });
    }
    if (!look.goggles) surface(gb, lin(5, 0, 1, true), lin(3, 0, 1), (u, v, o) => { const a = u * Math.PI * 2; const r = 0.0015; const e0 = eyes[1], e1 = eyes[0]; return o.copy(H(lerp(e0.x + 0.019, e1.x - 0.019, v), e0.y + 0.006 + Math.cos(a) * r, e0.z + eyeR + 0.009 + Math.sin(a) * r)); }, () => ({ reg: RG.frame, bones: hatBones, main: B.head }), { closedU: true, axis: (v, o) => o.copy(H(0, eyes[0].y, eyes[0].z + 0.02)) });
  }

  const geo = buildGeometryFinish(gb);
  R.chestLen = J[P.neck].distanceTo(V3().addVectors(J[P.pelvis], J[P.neck]).multiplyScalar(0.5));
  return { geo, rest: R, J, eyes, eyeR, headC };
}

function buildGeometryFinish(gb) { return gb.build(); }

// ------------------------------------------------------------- the shared detail texture
let DETAIL = null;
function detailTexture() {
  if (DETAIL) return DETAIL;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  const r = rngFrom(1234);
  const noise = new Float32Array(S * S); for (let i = 0; i < noise.length; i++) noise[i] = r();
  const smooth = (arr, k) => { const o = new Float32Array(arr.length); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let s = 0, n = 0; for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) { s += arr[((j + dj + S) % S) * S + ((i + di + S) % S)]; n++; } o[j * S + i] = s / n; } return o; };
  const n1 = smooth(noise, 1), n3 = smooth(noise, 3);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = j * S + i;
    // R: woven fabric (over-under threads)
    const wx = Math.sin((i / S) * Math.PI * 2 * 48), wy = Math.sin((j / S) * Math.PI * 2 * 48);
    const weave = ((Math.floor(i / (S / 48)) + Math.floor(j / (S / 48))) % 2 ? Math.abs(wx) : Math.abs(wy));
    // G: skin pores (tiny dark dots) + soft unevenness
    const pore = noise[k] > 0.965 ? 0.0 : 1.0;
    const skin = 0.55 + (n3[k] - 0.5) * 0.9 - (1 - pore) * 0.35 + (n1[k] - 0.5) * 0.25;
    // B: hair strands (streaks along v)
    let st = 0; for (let q = 0; q < 3; q++) st += noise[((j * 3 + q * 7) % S) * 0 + ((i + q * 31) % S)];
    const hair = 0.25 + st / 3 * 0.75 + (n1[(j % S) * S + i] - 0.5) * 0.2;
    img.data[k * 4] = clamp(weave * 0.8 + n1[k] * 0.2, 0, 1) * 255;
    img.data[k * 4 + 1] = clamp(skin, 0, 1) * 255;
    img.data[k * 4 + 2] = clamp(hair, 0, 1) * 255;
    img.data[k * 4 + 3] = clamp(n3[k] * 1.6 - 0.3, 0, 1) * 255;
  }
  x.putImageData(img, 0, 0);
  DETAIL = new THREE.CanvasTexture(c);
  DETAIL.wrapS = DETAIL.wrapT = THREE.RepeatWrapping;
  DETAIL.colorSpace = THREE.NoColorSpace;
  DETAIL.anisotropy = 4;
  return DETAIL;
}

// ------------------------------------------------------------- material
const VERT_HEAD = /* glsl */`
attribute float region; attribute float ao; attribute vec3 hpos; attribute float aux; attribute float lip; attribute vec2 duv;
varying float vRegion; varying float vAo; varying vec3 vHpos; varying float vAux; varying float vLip; varying vec2 vDuv;
`;
const FRAG_HEAD = /* glsl */`
uniform vec3 uCols[${NR}]; uniform float uRough[${NR}]; uniform float uMetal[${NR}];
uniform vec3 uTint; uniform float uTintAmt; uniform sampler2D uDetail; uniform float uPupil; uniform float uOpen;
uniform float uStubble; uniform float uStains; uniform float uDenim; uniform float uScale; uniform float uFreckles; uniform vec3 uLipCol;
varying float vRegion; varying float vAo; varying vec3 vHpos; varying float vAux; varying float vLip; varying vec2 vDuv;
float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hHash(i), hHash(i + vec2(1, 0)), f.x), mix(hHash(i + vec2(0, 1)), hHash(i + vec2(1, 1)), f.x), f.y); }
`;
const FRAG_COLOR = /* glsl */`
int ri = int(vRegion + 0.5);
vec3 base = uCols[ri];
float hRough = uRough[ri];
float hMetal = uMetal[ri];
float hBump = 0.0;
vec4 det = texture2D(uDetail, vDuv);
vec3 hp = vHpos;
if (ri == 0 || ri == 5 || ri == 17) {
  // skin: pores, blush, lips, brows, nostrils, stubble, freckles
  float pore = det.g;
  base *= 0.93 + pore * 0.14;
  hBump = (pore - 0.5) * 0.00025;
  float blush = exp(-pow((abs(hp.x) - 0.042) / 0.018, 2.0) - pow((hp.y + 0.03) / 0.02, 2.0)) * step(0.0, hp.z);
  blush += exp(-pow(hp.x / 0.012, 2.0) - pow((hp.y + 0.022) / 0.012, 2.0)) * 0.6 * step(0.04, hp.z);
  if (ri == 17) blush += 0.5;
  base = mix(base, base * vec3(1.08, 0.82, 0.8), clamp(blush, 0.0, 1.0) * 0.35);
  float tz = exp(-pow(hp.x / 0.02, 2.0) - pow((hp.y - 0.0) / 0.05, 2.0)) * step(0.03, hp.z) + exp(-pow(hp.x / 0.04, 2.0) - pow((hp.y - 0.06) / 0.025, 2.0)) * step(0.03, hp.z) * 0.6;
  hRough -= clamp(tz, 0.0, 1.0) * 0.16;
  if (ri == 0 && hp.z > 0.02) {
    float ly = hp.y + 0.052;
    float ax = abs(hp.x);
    float wn = clamp(ax / 0.0235, 0.0, 1.0);
    float hu = 0.0072 * pow(max(0.0, 1.0 - wn * wn), 0.55) - 0.0016 * exp(-pow(ax / 0.0045, 2.0)) + 0.0009 * exp(-pow((ax - 0.0075) / 0.004, 2.0));
    float hl = 0.0088 * pow(max(0.0, 1.0 - pow(clamp(ax / 0.022, 0.0, 1.0), 2.0)), 0.75);
    float upper = smoothstep(-0.0002, 0.0007, ly) * (1.0 - smoothstep(hu - 0.0009, hu + 0.0004, ly));
    float lower = smoothstep(-0.0002, 0.0007, -ly) * (1.0 - smoothstep(hl - 0.0012, hl + 0.0004, -ly));
    float lipW = 1.0 - smoothstep(0.021, 0.025, ax);
    float lipM = clamp(max(upper, lower), 0.0, 1.0);
    base = mix(base, uLipCol, lipM * 0.85);
    hRough = mix(hRough, 0.32, lipM);
    // the gap between the lips (dark, teeth when the mouth opens)
    float gap = 1.0 - smoothstep(0.00045, 0.00062, abs(vLip));
    gap *= lipW * step(0.03, hp.z);
    vec3 inside = mix(vec3(0.13, 0.03, 0.03), vec3(0.88, 0.86, 0.8), smoothstep(0.00022, 0.00042, vLip) * step(0.08, uOpen));
    inside = mix(inside, vec3(0.8, 0.78, 0.72), smoothstep(-0.0004, -0.00052, vLip) * step(0.2, uOpen));
    base = mix(base, inside, gap);
    hRough = mix(hRough, 0.25, gap);
    // nostrils
    float nos = exp(-pow((ax - 0.009) / 0.0035, 2.0) - pow((hp.y + 0.034) / 0.0022, 2.0));
    base *= 1.0 - nos * 0.75;
    // eyebrows (follow the brow skin when expressions move it)
    float bx = ax - 0.012;
    float arch = 0.036 + 0.006 * sin(clamp(bx / 0.042, 0.0, 1.0) * 3.0) - 0.002;
    float bw = mix(0.0042, 0.0022, clamp(bx / 0.042, 0.0, 1.0)) * (1.0 + uStubble * 0.25);
    float brow = smoothstep(bw, bw * 0.4, abs(hp.y - arch)) * step(0.0, bx) * (1.0 - smoothstep(0.038, 0.05, bx));
    brow *= 0.55 + 0.45 * hNoise(vec2(hp.x * 2400.0, hp.y * 400.0));
    base = mix(base, uCols[4] * 0.85, clamp(brow, 0.0, 1.0) * 0.92);
    // stubble on the jaw (grown men)
    float jaw = smoothstep(-0.02, -0.04, hp.y) * smoothstep(-0.14, -0.11, hp.y) * (1.0 - lipM);
    base = mix(base, base * mix(vec3(1.0), uCols[4] * 1.6 + 0.1, 0.5), jaw * uStubble * (0.3 + 0.7 * step(0.55, hNoise(hp.xy * 3000.0))) * 0.35);
    // freckles + a mole
    float fr = step(0.82, hNoise(hp.xy * 900.0)) * exp(-pow((abs(hp.x) - 0.03) / 0.03, 2.0) - pow((hp.y + 0.01) / 0.025, 2.0));
    base = mix(base, base * vec3(0.72, 0.55, 0.42), fr * uFreckles);
  }
  // scalp under the hair takes the hair color
  if (ri == 0 && dot(hp, hp) > 1e-6) base = mix(base, uCols[4] * 0.62, smoothstep(0.05, 0.3, vAux + (hNoise(hp.xz * 900.0) - 0.5) * 0.12));
  // eyelash line on the lid edge
  if (ri == 5) { base = mix(base, base * 0.85, smoothstep(0.4, 0.85, vAux)); base = mix(base, uCols[4] * 0.25, smoothstep(0.86, 0.97, vAux)); }
}
else if (ri == 6) {
  // the eye: white, iris with streaks, pupil (size changes with fear)
  float rr = length(hp.xy) * step(0.0, hp.z);
  float ang = atan(hp.y, hp.x);
  vec3 white = vec3(0.93, 0.9, 0.86) * (1.0 - 0.18 * smoothstep(0.6, 1.0, rr)) + vec3(0.06, -0.03, -0.03) * smoothstep(0.75, 1.0, rr);
  float irisR = 0.47;
  float streak = 0.75 + 0.5 * hNoise(vec2(ang * 18.0, rr * 9.0));
  vec3 iris = uCols[19] * streak * (1.0 - 0.5 * smoothstep(irisR * 0.75, irisR, rr)) * (1.0 + 0.4 * smoothstep(uPupil * 1.6, uPupil, rr));
  base = mix(white, iris, 1.0 - smoothstep(irisR - 0.03, irisR + 0.01, rr));
  base = mix(base, vec3(0.01), 1.0 - smoothstep(uPupil - 0.02, uPupil + 0.015, rr));
  // little highlight is done by the wet roughness
  hRough = 0.04;
}
else if (ri == 4) {
  // hair strands
  float s = texture2D(uDetail, vec2(vDuv.x * 3.0, vDuv.y * 0.15)).b;
  base *= 0.55 + s * 0.75;
  hBump = (s - 0.5) * 0.0006;
  hRough = 0.38 + (1.0 - s) * 0.2;
}
else if (ri == 1 || ri == 2 || ri == 8 || ri == 16) {
  // fabric: weave + slight unevenness; denim; lab coat stains
  float w = det.r;
  base *= 0.94 + w * 0.06 + (det.a - 0.5) * 0.1;
  hBump = (w - 0.5) * 0.00018;
  if (ri == 2 && uDenim > 0.5) {
    float tw = texture2D(uDetail, vec2(vDuv.x * 3.0 + vDuv.y * 3.0, vDuv.y * 3.0 - vDuv.x * 3.0)).r;
    base = mix(base, base * (0.75 + tw * 0.5), 0.6);
    base = mix(base, base + vec3(0.12, 0.14, 0.16), smoothstep(0.55, 0.85, det.a) * 0.6);
  }
  if (ri == 8) {
    float stain = smoothstep(0.62, 0.7, hNoise(vDuv * 9.0 + 3.1)) * uStains;
    base = mix(base, base * vec3(0.82, 0.74, 0.55), stain);
    float pocket = step(abs(vAux - 0.88), 0.06) * step(0.15, abs(hp.x));
    base *= 1.0 - pocket * 0.0;
  }
  // cloth wrinkles: aux = 1 + t on arms, 2 + t on legs (t = 0 top .. 1 bottom of the limb segment)
  if (vAux > 0.5) {
    float t = fract(vAux);
    float ang = vDuv.x * 6.2831 / 6.0;
    float wob = hNoise(vec2(vDuv.x * 4.0, t * 6.0)) * 6.0;
    float elbow = smoothstep(0.7, 0.97, t) + smoothstep(0.25, 0.0, t) * 0.6;   // bunching at both ends of each segment
    float ankle = step(1.5, vAux) * smoothstep(0.78, 1.0, t);
    float wr = sin(t * 95.0 + wob + sin(ang * 3.0) * 1.5) * (elbow + ankle * 1.5);
    hBump += wr * 0.00045;
    base *= 1.0 - max(0.0, -wr) * 0.07;
  }
}
else if (ri == 3) { base *= 0.85 + det.a * 0.3; hBump = (det.g - 0.5) * 0.0002; }
diffuseColor.rgb = base * vAo;
diffuseColor.rgb = mix(diffuseColor.rgb, uTint, uTintAmt);
`;
const FRAG_BUMP = /* glsl */`
{
  float bh = hBump * uScale;
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(bh), dhy = dFdy(bh);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float dt = dot(dpdx, r1);
  vec3 grad = sign(dt) * (dhx * r1 + dhy * r2);
  if (abs(dt) > 1e-20) normal = normalize(abs(dt) * normal - grad);
}
`;

export function makeHumanMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  const u = {
    uCols: { value: Array.from({ length: NR }, () => new THREE.Color(1, 1, 1)) },
    uRough: { value: new Array(NR).fill(0.6) },
    uMetal: { value: new Array(NR).fill(0) },
    uTint: { value: new THREE.Color(0, 0, 0) }, uTintAmt: { value: 0 },
    uDetail: { value: detailTexture() }, uPupil: { value: 0.2 }, uOpen: { value: 0 },
    uStubble: { value: 0 }, uStains: { value: 0 }, uDenim: { value: 0 }, uScale: { value: 1 }, uFreckles: { value: 0 },
    uLipCol: { value: new THREE.Color(0.6, 0.3, 0.3) },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = region; vAo = ao; vHpos = hpos; vAux = aux; vLip = lip; vDuv = duv;');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = hRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = hMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_BUMP)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nif (ri == 0 || ri == 5 || ri == 17) reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.07, 0.02, 0.012);');
  };
  mat.customProgramCacheKey = () => 'terrarium-human-1';
  return mat;
}

const _c = new THREE.Color();
function setRegionColors(mat, look, tint) {
  const u = mat.userData.u;
  const C = u.uCols.value, Rf = u.uRough.value, Mt = u.uMetal.value;
  const set = (r, hex, rough = 0.6, metal = 0) => { C[r].set(hex); Rf[r] = rough; Mt[r] = metal; };
  const skin = look.skin ?? 0xe0b090;
  set(RG.skin, skin, 0.52); set(RG.lid, skin, 0.5); set(RG.ear, skin, 0.55);
  set(RG.shirt, look.shirt ?? 0x888888, look.top === 'suit' ? 0.6 : 0.88);
  set(RG.pants, look.pants ?? 0x333333, 0.86);
  set(RG.shoes, look.shoes ?? 0x222222, 0.42);
  set(RG.sole, 0x2a2a2a, 0.9);
  set(RG.hair, look.hairColor ?? 0x332211, 0.42);
  set(RG.eye, 0xffffff, 0.05);
  set(RG.coat, look.coat ?? 0xe9ecdf, 0.82);
  set(RG.gloves, look.gloves ?? skin, look.gloves ? 0.32 : 0.52);
  set(RG.hat, look.hatColor ?? 0x222222, look.hat === 'hard' ? 0.35 : 0.75);
  set(RG.frame, 0x1a1a1a, 0.3, 0.2);
  set(RG.lens, 0x1d3b3a, 0.05, 0.3);
  set(RG.nail, new THREE.Color(skin).lerp(new THREE.Color(0xffd8d0), 0.5).getHex(), 0.3);
  set(RG.belt, 0x2a1d14, 0.45);
  set(RG.trim, look.hat === 'cop' ? 0x1a1a1a : 0xd8b04a, 0.25, look.hat === 'crown' ? 1 : 0);
  set(RG.pack, look.pack ?? 0x5a4030, 0.7);
  set(RG.horn, 0xe8e0c8, 0.4);
  C[19].set(look.eyes ?? 0x3d2914); // iris
  u.uLipCol.value.copy(_c.set(skin).multiply(new THREE.Color(0.85, 0.52, 0.5)));
  const pc = new THREE.Color(look.pants ?? 0);
  const hsl = {}; pc.getHSL(hsl);
  u.uDenim.value = hsl.h > 0.52 && hsl.h < 0.7 && hsl.s > 0.18 ? 1 : 0;
  u.uStubble.value = look.sex === 'm' && (look.height || 1) > 0.75 && !look.beard ? 0.6 : 0;
  u.uStains.value = look.coat ? 0.7 : 0;
  u.uFreckles.value = look.face && look.face.freckles ? look.face.freckles : 0;
  if (tint) { u.uTint.value.set(tint.color); u.uTintAmt.value = tint.amt; } else u.uTintAmt.value = 0;
}

// ------------------------------------------------------------- stump caps
let stumpMat = null, stumpGeo = null;
function stumpAssets() {
  if (stumpMat) return;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, '#f2ead8'); g.addColorStop(0.16, '#e8dcc0'); g.addColorStop(0.2, '#7a0d14'); g.addColorStop(0.7, '#a3121b'); g.addColorStop(0.86, '#d8b48a'); g.addColorStop(1, '#c08a6a');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${90 + Math.random() * 80},0,10,${Math.random() * 0.5})`; x.beginPath(); x.arc(64 + (Math.random() - 0.5) * 90, 64 + (Math.random() - 0.5) * 90, Math.random() * 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  stumpMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 });
  stumpGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
  stumpGeo.scale(1, 0.5, 1);
}

// ------------------------------------------------------------- one person's mesh
const BIND_CACHE = new Map();
export class HumanMesh {
  static camera = null;
  constructor(look, parent) {
    this.parent = parent;
    this.look = look;
    this.mats = [];
    this.build();
    this.stumpMeshes = [];
    this.visible = true;
    this.lod = 1;
  }

  build() {
    const look = this.look;
    faceOf(look);
    // two levels of detail, generated once per look (the detailed one only when someone gets close)
    const key = JSON.stringify(look);
    let pack = BIND_CACHE.get(key);
    if (!pack) {
      const lo = buildGeometry(look, 1);
      pack = { hi: null, lo, users: 0, key };
      if (BIND_CACHE.size > 160) for (const [k, v] of BIND_CACHE) { if (!v.users) { if (v.hi) v.hi.geo.dispose(); v.lo.geo.dispose(); BIND_CACHE.delete(k); } if (BIND_CACHE.size < 120) break; }
      BIND_CACHE.set(key, pack);
    }
    pack.users++;
    this.pack = pack;
    this.restInfo = pack.lo.rest;
    this.eyes = pack.lo.eyes;
    this.headC = pack.lo.headC;
    // bind matrices from the rest pose
    const J = pack.lo.J;
    const bind = Array.from({ length: NB }, () => new THREE.Matrix4());
    const seg = { lUA: [P.lSh, P.lEl], lFA: [P.lEl, P.lHa], rUA: [P.rSh, P.rEl], rFA: [P.rEl, P.rHa], lTH: [P.lHip, P.lKn], lSH: [P.lKn, P.lFt], rTH: [P.rHip, P.rKn], rSH: [P.rKn, P.rFt] };
    computeFrames((i) => J[i], { sc: 1, headQ: new THREE.Quaternion(), seg, rest: this.restInfo }, bind);
    const hs = look.headScale || 1;
    this.eyeRel = this.eyes.map((e) => new THREE.Matrix4().makeTranslation(e.x * hs, e.y * hs, e.z * hs));
    for (let k = 0; k < 2; k++) bind[B.lEye + k].copy(bind[B.head]).multiply(this.eyeRel[k]);
    this.bones = bind.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; return b; });
    const inv = bind.map((m) => m.clone().invert());
    this.skeleton = new THREE.Skeleton(this.bones, inv);
    // per-person geometry copies only when a cut changes the weights (shared until then)
    this.geos = [null, pack.lo.geo];
    this.meshes = [null, this.makeMesh(pack.lo.geo)];
    this.frames = Array.from({ length: NB }, () => new THREE.Matrix4());
    this.ownGeo = false;
  }

  makeMesh(geo) {
    const mat = makeHumanMaterial();
    setRegionColors(mat, this.look, this.tint);
    if (this.clip) { mat.clippingPlanes = this.clip; mat.side = THREE.DoubleSide; }
    this.mats.push(mat);
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.castShadow = true; m.receiveShadow = true;
    m.boundingSphere = new THREE.Sphere(V3(), 1);
    m.morphTargetInfluences = new Array(MORPHS.length).fill(0);
    this.parent.add(m);
    return m;
  }

  // the detailed mesh is made the first time this person is seen up close
  ensureHi() {
    if (this.meshes[0]) return;
    const pack = this.pack;
    if (!pack.hi) pack.hi = buildGeometry(this.look, 0);
    let geo = pack.hi.geo;
    if (this.ownGeo) { geo = geo.clone(); for (const j of this.cuts || []) this.cutGeo(geo, j); }
    this.geos[0] = geo;
    this.meshes[0] = this.makeMesh(geo);
  }

  setColors(look, tint) {
    this.tint = tint;
    for (const m of this.mats) setRegionColors(m, look, tint);
  }

  // hard split the skin at a joint so a cut limb doesn't stretch
  cut(joint) {
    if (JK[joint] === undefined) return;
    (this.cuts ||= []).push(joint);
    if (!this.ownGeo) { this.geos = this.geos.map((g) => (g ? g.clone() : null)); this.meshes.forEach((m, i) => { if (m) m.geometry = this.geos[i]; }); this.ownGeo = true; }
    for (const g of this.geos) if (g) this.cutGeo(g, joint);
  }

  cutGeo(g, joint) {
    const jk = JK[joint];
    const ji = g.userData.joint, mi = g.userData.main;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    let changed = false;
    for (let i = 0; i < si.count; i++) {
      if (ji[i] !== jk) continue;
      si.setXYZW(i, mi[i], 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); changed = true;
    }
    if (changed) { si.needsUpdate = true; sw.needsUpdate = true; }
  }

  setClip(planes) { this.clip = planes; for (const m of this.mats) { m.clippingPlanes = planes; m.side = planes ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true; } }

  setVisible(v) {
    if (this.visible === v) return;
    this.visible = v;
    if (!v) { for (const m of this.meshes) if (m) m.visible = false; for (const s of this.stumpMeshes) s.visible = false; }
  }

  // body = Body (points, segs, headQ, face, cut, stumps, halves)
  update(body, time, camera) {
    if (!this.visible) return;
    const p = body.p;
    const pts = this._pts || (this._pts = Array.from({ length: 32 }, () => V3()));
    const get = (i) => pts[i].set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    const seg = this._seg || (this._seg = {});
    for (const s of body.segs) seg[s.tag] = [s.a, s.b];
    const sc = body.sc;
    computeFrames(get, { sc, headQ: body.headQ, halves: body.halves || null, neckCut: body.cut.has('neck'), seg, rest: this.restInfo }, this.frames);
    // eyes look around (a little lag makes them feel alive)
    const F = body.face;
    const gx = clamp((F.lookX || 0) * 0.35, -0.4, 0.4), gy = clamp((F.lookY || 0) * 0.25, -0.3, 0.3);
    const gq = this._gq || (this._gq = new THREE.Quaternion());
    gq.setFromEuler(this._ge || (this._ge = new THREE.Euler()).set(-gy, gx, 0));
    for (let k = 0; k < 2; k++) this.frames[B.lEye + k].copy(this.frames[B.head]).multiply(this.eyeRel[k]).multiply(_m.makeRotationFromQuaternion(gq));
    for (let i = 0; i < NB; i++) this.bones[i].matrixWorld.copy(this.frames[i]);
    // face
    F.blink = (F.blink ?? 0) - 0.016;
    if (F.blink < -2.5 - Math.random() * 4) F.blink = 0.13;
    const closed = Math.max(F.closed || 0, F.blink > 0 ? 1 : 0);
    const inf = [closed, clamp(F.smile, 0, 1), clamp(F.open, 0, 1), clamp(F.angry, 0, 1), clamp(Math.max(F.sad, -F.smile * 0.6), 0, 1), clamp(F.scared, 0, 1)];
    for (const m of this.meshes) if (m) for (let k = 0; k < inf.length; k++) m.morphTargetInfluences[k] = inf[k];
    for (const mt of this.mats) { const u = mt.userData.u; u.uOpen.value = inf[2]; u.uPupil.value = 0.17 + F.scared * 0.1; u.uScale.value = sc; }
    // level of detail by size on screen
    const c = get(P.pelvis);
    const H = 1.75 * sc;
    let lod = 1;
    if (camera) {
      const d = camera.position.distanceTo(c);
      const px = (H / Math.max(d, 1e-6)) * (innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360)));
      lod = px > (this.lod === 0 ? 140 : 170) ? 0 : 1;
    }
    if (this.forceHi) lod = 0;
    if (lod === 0) this.ensureHi();
    this.lod = lod;
    for (let i = 0; i < 2; i++) {
      const m = this.meshes[i];
      if (!m) continue;
      m.visible = i === lod;
      m.boundingSphere.center.copy(c);
      m.boundingSphere.radius = H * (body.halves || body.cut.size ? 1.6 : 0.75);
    }
    // stump caps
    let si = 0;
    const cap = (at, from, size) => {
      stumpAssets();
      let s = this.stumpMeshes[si];
      if (!s) { s = new THREE.Mesh(stumpGeo, stumpMat); s.castShadow = true; this.parent.add(s); this.stumpMeshes.push(s); }
      s.visible = true;
      const a = get(at), b = V3(p[from * 3], p[from * 3 + 1], p[from * 3 + 2]);
      const d = V3().subVectors(a, b); const l = d.length(); if (l < 1e-9) d.set(0, 1, 0); else d.divideScalar(l);
      s.position.copy(a); s.quaternion.setFromUnitVectors(V3(0, 1, 0), d); s.scale.setScalar(size * sc);
      si++;
    };
    for (const st of body.stumps || []) {
      const size = st.joint === 'neck' || st.flip ? 0.075 : st.joint && st.joint.includes('Hip') ? 0.075 : st.joint && st.joint.includes('Knee') ? 0.05 : st.joint && st.joint.includes('Shoulder') ? 0.045 : 0.035;
      cap(st.a, st.aIn, size);
      if (st.joint !== 'neck') cap(st.b, st.bIn, size);
    }
    for (let k = si; k < this.stumpMeshes.length; k++) this.stumpMeshes[k].visible = false;
    void time;
  }

  dispose() {
    for (const m of this.meshes) if (m) m.removeFromParent();
    for (const s of this.stumpMeshes) s.removeFromParent();
    for (const m of this.mats) m.dispose();
    if (this.ownGeo) for (const g of this.geos) if (g) g.dispose();
    this.pack.users--;
    this.skeleton.dispose();
  }
}

export { MORPHS };
