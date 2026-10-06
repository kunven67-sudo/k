// Body cage: the low-poly "box model" of a person, built from rings around the skeleton, which
// Catmull-Clark (subdiv.js) turns into the smooth skinned body. Same idea a character artist
// uses, but driven by the body sliders.
//
// Topology (all quads):
//   torso   10 rings x 16 verts, angles at half steps so the midline is an edge, not a vertex.
//           A 3x2 face hole on each side is the arm root; the bottom ring splits into two 8-vert
//           leg roots joined by one crotch quad; the top ring is the neck seam (head continues).
//   arms    10 verts/ring (angle 0 = back of the hand), flattened into the hand: palm-base,
//           mid-palm and knuckle rings; the knuckle cap is 4 quads -> 4 fingers (4 verts/ring),
//           the thumb grows from the side quad between palm-base and mid-palm.
//   legs    8 verts/ring, bending into the foot (front of the shin becomes top of the foot), toe
//           cap of 3 quads.
// Each vertex stores [x,y,z, nail, ...dense bone weights over BODY_BONES]. Face tags encode
// part/ring/column so garments can select regions: tag = part<<16 | ring<<8 | col.

import * as THREE from 'three';
import { HAND, FINGERS, handFrame, handToWorld, fingerChains } from './rig.js';
import { fitCageToSurface, compact, orientFaces } from './subdiv.js';

export const DEBUG = {};
export const PART = { torso: 1, armL: 2, armR: 3, handL: 4, handR: 5, legL: 6, legR: 7, footL: 8, footR: 9, crotch: 10 };
export const tagPart = (t) => t >> 16;
export const tagRing = (t) => (t >> 8) & 255;
export const tagCol = (t) => t & 255;

export const BODY_BONES = [
  'hips', 'spine', 'chest', 'neck', 'head', 'belly', 'breast.L', 'breast.R', 'butt.L', 'butt.R',
  ...['L', 'R'].flatMap((s) => [
    `clavicle.${s}`, `upperarm.${s}`, `upperarmFat.${s}`, `forearm.${s}`, `hand.${s}`,
    ...[...FINGERS, 'thumb'].flatMap((f) => [1, 2, 3].map((i) => `${f}${i}.${s}`)),
    `thigh.${s}`, `shin.${s}`, `foot.${s}`, `toe.${s}`,
  ]),
];
const BI = new Map(BODY_BONES.map((n, i) => [n, i]));
export const CAGE_ATTR = 1; // channels after xyz before weights (nail mask)
export const CAGE_D = 3 + CAGE_ATTR + BODY_BONES.length;

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (d2, s) => Math.exp(-d2 / (s * s));

class CageBuilder {
  constructor() {
    this.P = []; // designed surface points (Vector3)
    this.W = []; // Map bone -> weight
    this.A = []; // extra attrs [nail]
    this.quads = [];
    this.tags = [];
  }
  v(p, w, nail = 0) {
    this.P.push(p.clone());
    this.W.push(w);
    this.A.push(nail);
    return this.P.length - 1;
  }
  quad(a, b, c, d, tag) {
    this.quads.push(a, b, c, d);
    this.tags.push(tag);
  }
  /** Quad oriented so its normal agrees with `out` (vector from inside to outside). */
  quadOut(a, b, c, d, tag, out) {
    const P = this.P;
    const n = new THREE.Vector3().subVectors(P[c], P[a]).cross(new THREE.Vector3().subVectors(P[d], P[b]));
    if (n.dot(out) < 0) this.quad(d, c, b, a, tag);
    else this.quad(a, b, c, d, tag);
  }
  /** Tube between two equal-length rings; `axisA` is a point on the tube axis near ring A. */
  tube(A, B, tagFn, axisA, axisB) {
    const n = A.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mid = this.P[A[i]].clone().add(this.P[A[j]]).add(this.P[B[i]]).add(this.P[B[j]]).multiplyScalar(0.25);
      const ax = axisA.clone().add(axisB).multiplyScalar(0.5);
      this.quadOut(A[i], A[j], B[j], B[i], tagFn(i), mid.sub(ax));
    }
  }
  /** Pack into a subdiv cage with dense weights; fit so the limit surface hits the points. */
  build() {
    const nv = this.P.length;
    const data = new Float32Array(nv * CAGE_D);
    const S = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const o = v * CAGE_D;
      data[o] = S[v * 3] = this.P[v].x;
      data[o + 1] = S[v * 3 + 1] = this.P[v].y;
      data[o + 2] = S[v * 3 + 2] = this.P[v].z;
      data[o + 3] = this.A[v];
      let sum = 0;
      for (const w of Object.values(this.W[v])) sum += w;
      for (const [name, w] of Object.entries(this.W[v])) {
        const i = BI.get(name);
        if (i === undefined) throw new Error(`cage: unknown bone ${name}`);
        data[o + 3 + CAGE_ATTR + i] += w / (sum || 1);
      }
    }
    let cage = { nv, D: CAGE_D, data, quads: Int32Array.from(this.quads), tags: Int32Array.from(this.tags) };
    const { cage: c, remap } = compact(cage, () => true);
    const S2 = new Float32Array(c.nv * 3);
    for (let v = 0; v < nv; v++) if (remap[v] >= 0) S2.set(S.subarray(v * 3, v * 3 + 3), remap[v] * 3);
    cage = fitCageToSurface(orientFaces(c), S2, 3, 0.6);
    return { cage, remap };
  }
}

/** Blend helper: two-bone weights with fraction t toward b. */
const bl = (a, b, t) => (t <= 0 ? { [a]: 1 } : t >= 1 ? { [b]: 1 } : { [a]: 1 - t, [b]: t });

/**
 * Build the body cage for params `p` and rig dims (rig.js computeJoints/buildRig output).
 * Returns { cage, neckRing: [cage vert ids of the top boundary in angle order], dims }.
 */
export function buildBodyCage(p, dims) {
  const { j, s } = dims;
  const f = p.fat;
  const m = p.muscle;
  const c = p.chest;
  const w = p.waist;
  const h = p.hips;
  const b = p.belly;
  const sh = p.shoulders;
  const old = Math.max(0, (p.age - 50) / 40);
  const B = new CageBuilder();
  const hipY = dims.hipY;
  const shY = dims.shoulderY;

  // ---------------- torso rings ----------------
  // y, half width W, front depth F, back depth Bk, center z, squareness n (2 = ellipse).
  const neckR = (0.058 + 0.012 * f + 0.008 * m + 0.004 * sh) * s;
  const R = [
    { y: hipY - 0.07 * s, W: 0.132 + 0.03 * h + 0.05 * f, F: 0.068 + 0.03 * f, Bk: 0.085 + 0.02 * h + 0.03 * f, n: 2.3 },
    { y: hipY + 0.045 * s, W: 0.17 + 0.035 * h + 0.06 * f, F: 0.083 + 0.04 * f + 0.02 * b, Bk: 0.105 + 0.03 * h + 0.045 * f, n: 2.4 },
    { y: hipY + 0.1 * s, W: 0.162 + 0.022 * h + 0.07 * f + 0.02 * b, F: 0.088 + 0.05 * f + 0.075 * b, Bk: 0.09 + 0.015 * h + 0.03 * f, n: 2.3 },
    { y: hipY + 0.15 * s, W: 0.148 + 0.02 * w + 0.075 * f + 0.025 * b, F: 0.092 + 0.05 * f + 0.085 * b, Bk: 0.083 + 0.03 * f, n: 2.25 },
    { y: hipY + 0.225 * s, W: 0.14 + 0.035 * w + 0.065 * f + 0.012 * m, F: 0.09 + 0.045 * f + 0.055 * b, Bk: 0.08 + 0.028 * f, n: 2.3 },
    { y: hipY + 0.3 * s, W: 0.152 + 0.02 * c + 0.055 * f + 0.025 * m + 0.012 * sh, F: 0.095 + 0.03 * f + 0.02 * b + 0.01 * m, Bk: 0.083 + 0.025 * f + 0.012 * m, n: 2.4 },
    // a: armpit row (bottom of the arm hole)
    { y: shY - 0.105 * s, W: 0.16 + 0.03 * sh + 0.045 * f + 0.035 * m, F: 0.1 + 0.025 * f + 0.02 * m, Bk: 0.088 + 0.02 * f + 0.018 * m, n: 2.6 },
    // a+1: middle of the shoulder
    { y: shY - 0.03 * s, W: 0.15 + 0.03 * sh + 0.03 * f + 0.03 * m, F: 0.088 + 0.015 * f + 0.012 * m, Bk: 0.083 + 0.015 * f + 0.015 * m, n: 2.7 },
    // a+2: top of the shoulder (acromion line)
    { y: shY + 0.04 * s, W: 0.13 + 0.025 * sh + 0.02 * f + 0.02 * m, F: 0.066 + 0.01 * f, Bk: 0.07 + 0.012 * f + 0.012 * m, n: 2.5 },
    // neck seam
    { y: shY + 0.07 * s - old * 0.01 * s, W: neckR / s + 0.006, F: neckR / s - 0.004, Bk: neckR / s + 0.004, n: 2.0, ty: -0.03 },
  ];
  // The crotch ring must reach the outside of the thighs or the hips get a ledge.
  R[0].W = Math.max(R[0].W, dims.hipHalf / s + 0.088 + 0.035 * f + 0.018 * m + 0.012 * h - 0.004);
  for (const r of R) {
    r.W *= s;
    r.F *= s;
    r.Bk *= s;
    r.cz = -0.012 * s;
  }
  R[9].cz = -0.022 * s - old * 0.015 * s; // head forward posture in old age shows in the neck
  const NA = 6; // armpit ring index
  const NT = 16;
  const theta = (k) => ((k + 0.5) / NT) * Math.PI * 2;
  const bustA = (0.004 + 0.075 * c * c + 0.02 * c * f) * s; // breasts / pecs
  const pecA = (0.01 * m + 0.006 * f) * s * (1 - c);
  const bustY = R[5].y * 0.45 + R[6].y * 0.55;
  const bustX = (0.088 + 0.012 * f) * s;
  const buttA = (0.012 + 0.03 * h + 0.02 * f) * s;
  const torsoW = (y, x, z, front) => {
    // Bone weights by height, with soft-tissue jiggle bones layered on top.
    const wt = {};
    const add = (n, v) => {
      if (v > 1e-4) wt[n] = (wt[n] || 0) + v;
    };
    const t1 = sstep(hipY + 0.03 * s, hipY + 0.2 * s, y);
    const t2 = sstep(hipY + 0.2 * s, hipY + 0.34 * s, y);
    add('hips', 1 - t1);
    add('spine', t1 * (1 - t2));
    add('chest', t1 * t2);
    if (front) {
      const gb = gauss((x * x) / (s * s), 0.1) * gauss(((y - (hipY + 0.11 * s)) / s) ** 2, 0.09);
      add('belly', gb * (0.25 + 0.75 * Math.max(b, f)));
      for (const [sd, sx] of [['L', 1], ['R', -1]]) {
        const gs = gauss(((x - sx * bustX) / s) ** 2 + ((y - bustY) / s) ** 2, 0.075);
        add(`breast.${sd}`, gs * (0.15 + 0.85 * c));
      }
    } else {
      for (const [sd, sx] of [['L', 1], ['R', -1]]) {
        const gs = gauss(((x - sx * 0.075 * s) / s) ** 2 + ((y - (hipY - 0.02 * s)) / s) ** 2, 0.08);
        add(`butt.${sd}`, gs * 0.6);
      }
    }
    // Shoulder sides follow clavicle/upper arm.
    for (const [sd, sx] of [['L', 1], ['R', -1]]) {
      const sp = j[`upperarm.${sd}`];
      const d = Math.hypot(x - sp.x, y - sp.y, (z - sp.z) * 0.8) / s;
      const k = (1 - sstep(0.04, 0.16, d)) * (sx * x > 0 ? 1 : 0);
      if (k > 0) {
        add(`clavicle.${sd}`, 0.45 * k);
        add(`upperarm.${sd}`, 0.55 * k * sstep(shY - 0.16 * s, shY, y));
      }
    }
    if (y > shY + 0.05 * s) add('neck', 0.5);
    return wt;
  };
  const thighR0 = (0.088 + 0.035 * f + 0.018 * m + 0.012 * h) * s;
  const rings = [];
  for (let r = 0; r < R.length; r++) {
    const ring = [];
    const Rr = R[r];
    for (let k = 0; k < NT; k++) {
      // Hole interiors are never referenced (dropped by compact()).
      const th = theta(k);
      const sn = Math.sin(th);
      const cs = Math.cos(th);
      const e = 2 / Rr.n;
      let x = Rr.W * Math.sign(sn) * Math.abs(sn) ** e;
      let z = Rr.cz + (cs >= 0 ? Rr.F : Rr.Bk) * Math.sign(cs) * Math.abs(cs) ** e;
      let y = Rr.y + (Rr.ty ? Rr.ty * s * (cs > 0 ? cs : cs * 0.35) : 0);
      if (cs > 0 && r >= 4 && r <= 7) {
        // Bust/pecs: forward bumps (with a little sag that grows with size and age).
        const gb = gauss(((Math.abs(x) - bustX) / s) ** 2 + ((y - bustY) / s) ** 2, 0.085);
        z += (bustA + pecA) * gb * cs;
        if (r === 5) y -= bustA * 0.35 * gb * (0.6 + old);
      }
      if (cs < 0 && r >= 1 && r <= 2) {
        const gb = gauss(((Math.abs(x) - 0.075 * s) / s) ** 2 + ((y - (hipY - 0.01 * s)) / s) ** 2, 0.085);
        z -= buttA * gb * -cs;
      }
      if (r >= NA && r <= NA + 2) {
        // Shoulder row: sides blend toward a circle around the shoulder joint (arm root).
        const sd = sn > 0 ? 'L' : 'R';
        const sp = j[`upperarm.${sd}`];
        const side = Math.abs(sn);
        const kk = sstep(0.55, 0.95, side);
        const ry = [-0.085, 0, 0.06][r - NA] * s;
        const tx = sp.x - Math.sign(sn) * [0.03, 0.005, 0.02][r - NA] * s;
        x = x + (tx - x) * kk * 0.85;
        y = y + (sp.y + ry - y) * kk * (r === NA + 1 ? 0 : 0.6);
      }
      if (r === 0) {
        // Crotch ring = the tops of both thighs (figure-8), so the legs grow out cleanly.
        const sd = k < 8 ? 'L' : 'R';
        const sx2 = k < 8 ? 1 : -1;
        const kk2 = k < 8 ? k : 15 - k; // mirror: right side runs back->front
        const al = THREE.MathUtils.degToRad(-58 + kk2 * (296 / 7));
        const hc = j[`thigh.${sd}`];
        const tr = thighR0;
        x = sx2 * (Math.abs(hc.x) - 0.004 * s) + sx2 * Math.sin(al) * tr * 1.04;
        z = 0.004 * s + Math.cos(al) * tr * (Math.cos(al) > 0 ? 0.9 : 1.08);
        // Pubic front fills the notch between the thighs; the leg line rises diagonally to
        // the outer hip (inguinal crease), so there is no horizontal "shorts hem".
        if (kk2 === 0) z = Math.max(z, R[1].F * 0.82 + R[1].cz);
        if (kk2 === 1) z = Math.max(z, R[1].F * 0.9 + R[1].cz);
        y += Math.max(0, Math.sin(al)) * (R[1].y - y) * 0.3 + (Math.cos(al) < 0 ? Math.max(0, Math.sin(al)) * 0.0 : 0);
        if (Math.cos(al) < 0) z -= buttA * 0.5 * gauss(((Math.abs(x) - 0.075 * s) / s) ** 2, 0.08) * -Math.cos(al);
      }
      const pos = V3(x, y, z);
      ring.push(B.v(pos, torsoW(y, x, z, cs > 0.1)));
    }
    rings.push(ring);
  }
  const ax = (r) => V3(0, R[r].y, R[r].cz);
  const holeL = (r, k) => r >= NA && r < NA + 2 && k >= 2 && k <= 4;
  const holeR = (r, k) => r >= NA && r < NA + 2 && k >= 10 && k <= 12;
  for (let r = 0; r < R.length - 1; r++) {
    for (let k = 0; k < NT; k++) {
      if (holeL(r, k) || holeR(r, k)) continue;
      const k2 = (k + 1) % NT;
      const a = rings[r][k];
      const bq = rings[r][k2];
      const cq = rings[r + 1][k2];
      const d = rings[r + 1][k];
      const mid = B.P[a].clone().add(B.P[cq]).multiplyScalar(0.5);
      B.quadOut(a, bq, cq, d, (PART.torso << 16) | (r << 8) | k, mid.sub(ax(r)).setY(0));
    }
  }
  // Crotch strip.
  B.quadOut(rings[0][0], rings[0][15], rings[0][8], rings[0][7], (PART.crotch << 16), V3(0, -1, 0));

  // ---------------- arms + hands ----------------
  const hs = dims.handScale;
  const chains = fingerChains();
  for (const [sd, sx] of [['L', 1], ['R', -1]]) {
    const sp = j[`upperarm.${sd}`];
    const el = j[`forearm.${sd}`];
    const wr = j[`hand.${sd}`];
    const hf = handFrame(dims, sd);
    const aDir = el.clone().sub(sp).normalize();
    const fDir = wr.clone().sub(el).normalize();
    const Pv = hf.palm.clone().negate(); // back of the hand / top of the arm
    const Zv = hf.z.clone();
    const ortho = (dir) => {
      const P2 = Pv.clone().addScaledVector(dir, -Pv.dot(dir)).normalize();
      const Z2 = new THREE.Vector3().crossVectors(dir, P2).normalize();
      if (Z2.dot(Zv) < 0) Z2.negate();
      return [P2, Z2];
    };
    const NAR = 10;
    const phi = (i) => (i / NAR) * Math.PI * 2;
    let armAngles = null; // per-slot angles for the first rings (blend from the root loop)
    const armRing = (center, dir, rP, rZ, wts, n = 2, extra = null) => {
      const [P2, Z2] = ortho(dir);
      const ids = [];
      for (let i = 0; i < NAR; i++) {
        const a = armAngles ? armAngles[i] : phi(i);
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const e = 2 / n;
        let rp = rP * Math.sign(cs) * Math.abs(cs) ** e;
        const rz = rZ * Math.sign(sn) * Math.abs(sn) ** e;
        if (extra) rp += extra(cs, sn);
        ids.push(B.v(center.clone().addScaledVector(P2, rp).addScaledVector(Z2, rz), typeof wts === 'function' ? wts(cs, sn) : wts));
      }
      return { ids, center, dir };
    };
    // Root loop from the torso hole, re-ordered to match ring angles.
    const kk = sd === 'L' ? [2, 3, 4, 5] : [10, 11, 12, 13];
    const loop = [
      rings[NA][kk[0]], rings[NA][kk[1]], rings[NA][kk[2]], rings[NA][kk[3]], rings[NA + 1][kk[3]],
      rings[NA + 2][kk[3]], rings[NA + 2][kk[2]], rings[NA + 2][kk[1]], rings[NA + 2][kk[0]], rings[NA + 1][kk[0]],
    ];
    const rootC = loop.reduce((acc, id) => acc.add(B.P[id]), V3(0, 0, 0)).multiplyScalar(1 / loop.length);
    const root = alignLoop(B, loop, rootC, V3(sx, 0, 0), Pv, Zv, NAR);
    const rootAng = loopAngles(B, root, rootC, V3(sx, 0, 0), Pv, Zv);
    const upLen = el.distanceTo(sp);
    const foLen = wr.distanceTo(el);
    const at = (t) => sp.clone().addScaledVector(aDir, t * upLen);
    const atF = (t) => el.clone().addScaledVector(fDir, t * foLen);
    const U = `upperarm.${sd}`;
    const F = `forearm.${sd}`;
    const H = `hand.${sd}`;
    const fatW = (cs) => (cs < -0.2 ? { [U]: 1 - 0.55 * f * -cs, [`upperarmFat.${sd}`]: 0.55 * f * -cs } : { [U]: 1 });
    const ar = [];
    armAngles = blendAngles(rootAng, NAR, 0, 0.55);
    ar.push(armRing(at(0.06).addScaledVector(Pv, 0.012 * s), aDir, (0.072 + 0.02 * m + 0.035 * f) * s, (0.068 + 0.02 * m + 0.03 * f) * s, { [U]: 0.8, [`clavicle.${sd}`]: 0.2 }, 2.2));
    armAngles = blendAngles(rootAng, NAR, 0, 0.9);
    ar.push(armRing(at(0.32), aDir, (0.059 + 0.016 * m + 0.034 * f) * s, (0.061 + 0.02 * m + 0.03 * f) * s, fatW, 2, (cs) => (cs < 0 ? -cs * 0.012 * f * s : 0)));
    armAngles = null;
    ar.push(armRing(at(0.64), aDir, (0.053 + 0.014 * m + 0.026 * f) * s, (0.056 + 0.018 * m + 0.026 * f) * s, fatW));
    ar.push(armRing(at(0.9), aDir, (0.046 + 0.006 * m + 0.017 * f) * s, (0.049 + 0.008 * m + 0.018 * f) * s, { [U]: 0.85, [F]: 0.15 }));
    ar.push(armRing(el.clone(), aDir.clone().add(fDir).normalize(), (0.045 + 0.005 * m + 0.014 * f) * s, (0.047 + 0.006 * m + 0.015 * f) * s, { [U]: 0.5, [F]: 0.5 }));
    ar.push(armRing(atF(0.18), fDir, (0.047 + 0.012 * m + 0.014 * f) * s, (0.051 + 0.013 * m + 0.015 * f) * s, { [F]: 0.88, [U]: 0.12 }));
    ar.push(armRing(atF(0.55), fDir, (0.039 + 0.007 * m + 0.01 * f) * s, (0.044 + 0.008 * m + 0.011 * f) * s, { [F]: 1 }));
    ar.push(armRing(atF(0.93), fDir, (0.026 + 0.004 * f) * s, (0.036 + 0.004 * f) * s, { [F]: 0.75, [H]: 0.25 }, 2.3));
    let prev = { ids: root, center: rootC, dir: aDir };
    const armPart = sd === 'L' ? PART.armL : PART.armR;
    ar.forEach((rg, i) => {
      B.tube(prev.ids, rg.ids, (col) => (armPart << 16) | (i << 8) | col, prev.center, rg.center);
      prev = rg;
    });
    // Hand: palm base, mid palm, knuckles. Canonical hand coords (palm, along, thumb) * hs.
    const hp = HAND.palm.half;
    const handPt = (pc, al, th) => handToWorld(hf, hs, [pc, al, th]);
    const handPart = sd === 'L' ? PART.handL : PART.handR;
    const knuckZ = [-0.041, -0.0185, 0.0005, 0.0202, 0.0425];
    const handRing = (al, thick, widthScale, zs, wts, pad = 0) => {
      const ids = [];
      for (let i = 0; i < NAR; i++) {
        const a = phi(i);
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        let th;
        if (zs) {
          // Back row i = 8,9,0,1,2 and palm row i = 7..3 sit on explicit finger boundaries.
          const backIdx = [8, 9, 0, 1, 2].indexOf(i);
          const palmIdx = [7, 6, 5, 4, 3].indexOf(i);
          th = zs[backIdx >= 0 ? backIdx : palmIdx];
        } else {
          th = hp[2] * widthScale * Math.sign(sn) * Math.abs(sn) ** 0.6;
        }
        const back = cs >= 0;
        const edge = Math.abs(th) / (hp[2] * 1.0);
        let pc = (back ? -1 : 1) * thick * (1 - 0.35 * edge * edge) * (Math.abs(cs) ** 0.35);
        if (!back) pc += pad * (1 - edge * edge);
        ids.push(B.v(handPt(pc, al, th), wts));
      }
      return ids;
    };
    const hA = handRing(0.012, hp[0] * 1.02, 0.8, null, { [H]: 0.8, [F]: 0.2 });
    const hB = handRing(0.05, hp[0] * 1.05, 1.0, null, { [H]: 1 }, 0.004);
    const hC = handRing(0.088, hp[0] * 0.92, 1.0, knuckZ, { [H]: 1 });
    const hcA = handPt(0, 0.012, 0);
    const hcB = handPt(0, 0.05, 0);
    const hcC = handPt(0, 0.088, 0);
    B.tube(prev.ids, hA, (col) => (handPart << 16) | (0 << 8) | col, prev.center, hcA);
    // Hand tube A->B except the thumb root face (between i=2 and i=3).
    for (let i = 0; i < NAR; i++) {
      const i2 = (i + 1) % NAR;
      if (i === 2) continue;
      const mid = B.P[hA[i]].clone().add(B.P[hB[i2]]).multiplyScalar(0.5);
      B.quadOut(hA[i], hA[i2], hB[i2], hB[i], (handPart << 16) | (1 << 8) | i, mid.sub(hcA.clone().lerp(hcB, 0.5)));
    }
    B.tube(hB, hC, (col) => (handPart << 16) | (2 << 8) | col, hcB, hcC);
    // Fingers.
    const backRow = [8, 9, 0, 1, 2].map((i) => hC[i]);
    const palmRow = [7, 6, 5, 4, 3].map((i) => hC[i]);
    const order = ['pinky', 'ring', 'middle', 'index'];
    order.forEach((fname, fj) => {
      const rootQ = [backRow[fj], backRow[fj + 1], palmRow[fj + 1], palmRow[fj]];
      const fd = HAND.fingers[fname];
      buildDigit(B, sd, fname, rootQ, chains[fname], fd.r, hf, hs, handPart, 3 + fj, s);
    });
    const thumbRoot = [hA[2], hB[2], hB[3], hA[3]];
    buildDigit(B, sd, 'thumb', thumbRoot, chains.thumb, HAND.thumb.r, hf, hs, handPart, 7, s);
    void sx;
  }

  // ---------------- legs + feet ----------------
  for (const [sd, sx] of [['L', 1], ['R', -1]]) {
    const hipJ = j[`thigh.${sd}`];
    const knee = j[`shin.${sd}`];
    const ank = j[`foot.${sd}`];
    const T = `thigh.${sd}`;
    const S = `shin.${sd}`;
    const Fo = `foot.${sd}`;
    const To = `toe.${sd}`;
    const legPart = sd === 'L' ? PART.legL : PART.legR;
    const footPart = sd === 'L' ? PART.footL : PART.footR;
    const Xo = V3(sx, 0, 0); // outward
    const NL = 8;
    let legAngles = null;
    const legRing = (center, dir, rF, rX, wts, opts = {}) => {
      const Fv = new THREE.Vector3().crossVectors(dir, V3(1, 0, 0)).normalize();
      const ids = [];
      for (let i = 0; i < NL; i++) {
        const a = legAngles ? legAngles[i] : ((i + 0.5) / NL) * Math.PI * 2;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        let rf = (cs >= 0 ? rF : opts.rB ?? rF) * cs;
        let rx = (sn >= 0 ? rX : opts.rIn ?? rX) * sn;
        if (opts.shift) rf += opts.shift(cs, sn);
        const pt = center.clone().addScaledVector(Fv, rf).addScaledVector(Xo, rx);
        if (opts.post) opts.post(pt, cs, sn);
        ids.push(B.v(pt, typeof wts === 'function' ? wts(cs, sn) : wts));
      }
      return { ids, center, dir };
    };
    const tDir = knee.clone().sub(hipJ).normalize();
    const sDir = ank.clone().sub(knee).normalize();
    const tLen = knee.distanceTo(hipJ);
    const sLen = ank.distanceTo(knee);
    const atT = (t) => hipJ.clone().addScaledVector(tDir, t * tLen);
    const atS = (t) => knee.clone().addScaledVector(sDir, t * sLen);
    const thighR = (0.088 + 0.035 * f + 0.018 * m + 0.012 * h) * s;
    const L = [];
    const crotchY = R[0].y;
    const half = sd === 'L' ? [0, 1, 2, 3, 4, 5, 6, 7] : [8, 9, 10, 11, 12, 13, 14, 15];
    const loopIds = half.map((k) => rings[0][k]);
    const lc = loopIds.reduce((acc, id) => acc.add(B.P[id]), V3(0, 0, 0)).multiplyScalar(1 / 8);
    const Fdown = new THREE.Vector3().crossVectors(tDir, V3(1, 0, 0)).normalize();
    const rootIds = alignLoop(B, loopIds, lc, V3(0, -1, 0), Fdown, Xo, NL, 0.5);
    const legRootAng = loopAngles(B, rootIds, lc, V3(0, -1, 0), Fdown, Xo);
    legAngles = blendAngles(legRootAng, NL, 0.5, 0.35);
    const t0 = (crotchY - 0.05 * s - hipJ.y) / (knee.y - hipJ.y);
    L.push(legRing(atT(t0).add(V3(-sx * 0.004 * s, 0, 0)), tDir, thighR * 0.98, thighR * 1.04, { [T]: 0.85, hips: 0.15 }, { rB: thighR * 1.1, rIn: thighR * 0.95 }));
    legAngles = blendAngles(legRootAng, NL, 0.5, 0.75);
    L.push(legRing(atT(t0 + (1 - t0) * 0.36), tDir, thighR * 0.9, thighR * 0.88, { [T]: 1 }, { rB: thighR * 0.92 }));
    legAngles = null;
    L.push(legRing(atT(t0 + (1 - t0) * 0.72), tDir, (0.064 + 0.024 * f + 0.012 * m) * s, (0.064 + 0.022 * f + 0.01 * m) * s, { [T]: 1 }));
    L.push(legRing(atT(0.93), tDir, (0.056 + 0.013 * f) * s, (0.055 + 0.014 * f) * s, { [T]: 0.8, [S]: 0.2 }, { rB: (0.05 + 0.01 * f) * s }));
    L.push(legRing(knee.clone().add(V3(0, 0, 0.006 * s)), tDir.clone().add(sDir).normalize(), (0.056 + 0.01 * f) * s, (0.054 + 0.012 * f) * s, { [T]: 0.5, [S]: 0.5 }, { rB: (0.046 + 0.008 * f) * s }));
    L.push(legRing(atS(0.17), sDir, (0.047 + 0.008 * f) * s, (0.054 + 0.012 * f + 0.006 * m) * s, { [S]: 0.85, [T]: 0.15 }, { rB: (0.06 + 0.014 * f + 0.012 * m) * s }));
    L.push(legRing(atS(0.38), sDir, (0.042 + 0.006 * f) * s, (0.05 + 0.012 * f + 0.006 * m) * s, { [S]: 1 }, { rB: (0.062 + 0.014 * f + 0.012 * m) * s }));
    L.push(legRing(atS(0.7), sDir, (0.035 + 0.004 * f) * s, (0.038 + 0.007 * f) * s, { [S]: 1 }, { rB: (0.038 + 0.006 * f) * s }));
    L.push(legRing(atS(0.93), sDir, (0.031 + 0.003 * f) * s, (0.034 + 0.004 * f) * s, { [S]: 0.65, [Fo]: 0.35 }, { rB: 0.03 * s }));
    // Foot: bent tube. Heel ring tilts, then cross-sections along the foot.
    const fx = ank.x;
    const fw = (0.044 + 0.006 * f) * s * (p.height < 1.62 ? 0.95 : 1);
    L.push(legRing(V3(fx, 0.048 * s, -0.012 * s), V3(0, -0.55, 0.835).normalize(), 0.045 * s, fw * 0.92, { [Fo]: 1 }, {
      rB: 0.052 * s,
      post: (pt, cs) => {
        if (cs < 0) pt.z -= 0.02 * s * -cs;
      },
    }));
    L.push(legRing(V3(fx + sx * 0.003 * s, 0.038 * s, 0.065 * s), V3(0, -0.12, 1).normalize(), 0.031 * s, fw * 1.02, { [Fo]: 1 }, { rB: 0.03 * s, rIn: fw * 0.95 }));
    L.push(legRing(V3(fx + sx * 0.004 * s, 0.028 * s, 0.132 * s), V3(0, -0.05, 1).normalize(), 0.022 * s, fw * 1.1, { [Fo]: 0.5, [To]: 0.5 }, { rB: 0.024 * s }));
    L.push(legRing(V3(fx + sx * 0.002 * s, 0.022 * s, 0.185 * s), V3(0, 0, 1), 0.016 * s, fw * 0.98, { [To]: 1 }, { rB: 0.019 * s, rIn: fw * 0.92 }));
    if (sd === 'L') DEBUG.leg = { root: rootIds.map((id) => B.P[id].toArray().map((v) => +v.toFixed(3))), ring1: L[0].ids.map((id) => B.P[id].toArray().map((v) => +v.toFixed(3))), ring2: L[1].ids.map((id) => B.P[id].toArray().map((v) => +v.toFixed(3))) };
    let prev = { ids: rootIds, center: lc, dir: tDir };
    L.forEach((rg, i) => {
      const part = i >= 9 ? footPart : legPart;
      B.tube(prev.ids, rg.ids, (col) => (part << 16) | ((i >= 9 ? i - 9 : i) << 8) | col, prev.center, rg.center);
      prev = rg;
    });
    // Toe cap (3 quads across the width).
    const cI = prev.ids;
    const tipOut = prev.dir.clone();
    const tagT = (footPart << 16) | (9 << 8);
    B.quadOut(cI[0], cI[1], cI[2], cI[3], tagT, tipOut);
    B.quadOut(cI[7], cI[0], cI[3], cI[4], tagT, tipOut);
    B.quadOut(cI[4], cI[5], cI[6], cI[7], tagT, tipOut);
  }

  const { cage, remap } = B.build();
  const neckRing = rings[R.length - 1].map((id) => remap[id]);
  const top = R[R.length - 1];
  return { cage, neckRing, rings: R, seam: { y: top.y, W: top.W, F: top.F, B: top.Bk, cz: top.cz, ty: top.ty * s } };
}

/**
 * Re-order a loop of existing vertices so index i lines up with ring angle i of a tube whose axis
 * is `dir`, with angle 0 along `P0` and 90° along `Z0` (matching the next ring's layout).
 */
function alignLoop(B, loop, center, dir, P0, Z0, n, phase = 0) {
  const P = P0.clone().addScaledVector(dir, -P0.dot(dir)).normalize();
  const Z = new THREE.Vector3().crossVectors(dir, P).normalize();
  if (Z.dot(Z0) < 0) Z.negate();
  const ang = loop.map((id) => {
    const d = B.P[id].clone().sub(center);
    let a = Math.atan2(d.dot(Z), d.dot(P));
    if (a < 0) a += Math.PI * 2;
    return a;
  });
  let best = null;
  for (const dirSign of [1, -1]) {
    const seq = dirSign > 0 ? loop.map((_, i) => i) : loop.map((_, i) => (loop.length - i) % loop.length);
    for (let shift = 0; shift < n; shift++) {
      let err = 0;
      for (let i = 0; i < n; i++) {
        const li = seq[(i + shift) % n];
        const target = ((i + phase) / n) * Math.PI * 2;
        let d = Math.abs(ang[li] - target);
        d = Math.min(d, Math.PI * 2 - d);
        err += d * d;
      }
      if (!best || err < best.err) best = { err, ids: Array.from({ length: n }, (_, i) => loop[seq[(i + shift) % n]]) };
    }
  }
  return best.ids;
}

/** Angles of loop verts around a tube axis (same convention as alignLoop). */
function loopAngles(B, ids, center, dir, P0, Z0) {
  const P = P0.clone().addScaledVector(dir, -P0.dot(dir)).normalize();
  const Z = new THREE.Vector3().crossVectors(dir, P).normalize();
  if (Z.dot(Z0) < 0) Z.negate();
  return ids.map((id) => {
    const d = B.P[id].clone().sub(center);
    return Math.atan2(d.dot(Z), d.dot(P));
  });
}

/** Blend loop angles toward the uniform layout (t = 1 -> uniform), unwrapping around slots. */
function blendAngles(loopAng, n, phase, t) {
  return loopAng.map((a, i) => {
    const u = ((i + phase) / n) * Math.PI * 2;
    let d = a - u;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return u + d * (1 - t);
  });
}

/** One finger/thumb: tube of 4-vert rings along the joint chain, capped at the tip. */
function buildDigit(B, sd, fname, rootQ, chainCanon, rad, hf, hs, handPart, col, s) {
  const pts = chainCanon.map((cpt) => handToWorld(hf, hs, [cpt.x, cpt.y, cpt.z]));
  const bones = [1, 2, 3].map((i) => `${fname}${i}.${sd}`);
  const H = `hand.${sd}`;
  const r = rad * hs;
  const palm = hf.palm;
  const ringAt = (pt, dir, rs, wts, nailBack = 0) => {
    // Corners in the same order as the root quad: back-pinky, back-thumb, palm-thumb, palm-pinky.
    const back = palm.clone().negate().addScaledVector(dir, palm.dot(dir)).normalize();
    const side = new THREE.Vector3().crossVectors(dir, back).normalize();
    if (side.dot(hf.z) < 0) side.negate();
    const k = 0.74 * rs;
    const c = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ];
    return c.map(([zs, bs]) => B.v(pt.clone().addScaledVector(side, zs * k * 1.05).addScaledVector(back, bs * k * (bs > 0 ? 0.92 : 1.0)), wts, bs > 0 ? nailBack : 0));
  };
  const rootC = rootQ.reduce((a, id) => a.add(B.P[id]), V3(0, 0, 0)).multiplyScalar(0.25);
  const d0 = pts[1].clone().sub(pts[0]).normalize();
  const segs = [];
  const lerpPt = (a, bb, t) => pts[a].clone().lerp(pts[bb], t);
  const dirOf = (a) => pts[Math.min(a + 1, 3)].clone().sub(pts[Math.min(a, 2)]).normalize();
  const isThumb = fname === 'thumb';
  const rs = isThumb ? [1.25, 1.12, 1.0, 1.02, 0.98, 0.9] : [1.05, 1.02, 0.96, 0.96, 0.9, 0.86];
  const wt = (a, t) => (t <= 0 ? { [a[0]]: 1 } : { [a[0]]: 1 - t, [a[1]]: t });
  segs.push(ringAt(lerpPt(0, 1, isThumb ? 0.45 : 0.35), d0, r * rs[0], isThumb ? { [bones[0]]: 0.8, [H]: 0.2 } : { [bones[0]]: 1 }));
  segs.push(ringAt(pts[1].clone(), dirOf(0).add(dirOf(1)).normalize(), r * rs[1], wt([bones[0], bones[1]], 0.5)));
  segs.push(ringAt(lerpPt(1, 2, 0.5), dirOf(1), r * rs[2], { [bones[1]]: 1 }));
  segs.push(ringAt(pts[2].clone(), dirOf(1).add(dirOf(2)).normalize(), r * rs[3], wt([bones[1], bones[2]], 0.5)));
  segs.push(ringAt(lerpPt(2, 3, 0.45), dirOf(2), r * rs[4], { [bones[2]]: 1 }, 0.6));
  segs.push(ringAt(lerpPt(2, 3, 0.82), dirOf(2), r * rs[5], { [bones[2]]: 1 }, 1));
  // Match the root quad's corners to the first ring's corners (best rotation/direction).
  let best = null;
  for (const dirS of [1, -1]) {
    for (let sh = 0; sh < 4; sh++) {
      const ids = [0, 1, 2, 3].map((i) => rootQ[(((dirS * i + sh) % 4) + 4) % 4]);
      const err = ids.reduce((e, id, i) => e + B.P[id].distanceToSquared(B.P[segs[0][i]]), 0);
      if (!best || err < best.err) best = { err, ids };
    }
  }
  const root = best.ids;
  let prev = root;
  let prevC = rootC;
  segs.forEach((ring, i) => {
    const c = ring.reduce((a, id) => a.add(B.P[id]), V3(0, 0, 0)).multiplyScalar(0.25);
    B.tube(prev, ring, () => (handPart << 16) | ((3 + i) << 8) | col, prevC, c);
    prev = ring;
    prevC = c;
  });
  // Tip: a smaller ring pulled to the fingertip, then a cap quad.
  const tipDir = dirOf(2);
  const tip = ringAt(pts[3].clone().addScaledVector(tipDir, -r * 0.25), tipDir, r * 0.55, { [bones[2]]: 1 }, 0.7);
  const tc = ring4c(B, tip);
  B.tube(prev, tip, () => (handPart << 16) | (9 << 8) | col, prevC, tc);
  B.quadOut(tip[0], tip[1], tip[2], tip[3], (handPart << 16) | (10 << 8) | col, tipDir);
  void s;
}

function ring4c(B, ids) {
  return ids.reduce((a, id) => a.add(B.P[id]), V3(0, 0, 0)).multiplyScalar(1 / ids.length);
}
