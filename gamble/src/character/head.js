// Procedural head: a sculpted signed-distance head (cranium, jaw, cheeks, brow ridge, nose,
// muzzle, lips, eyelid shells) sampled along rays from the head centre.
//
// Topology is built in *direction space*: feature edge loops (eyelid margins, lip contact line)
// plus blue-noise fill whose density follows the features. Points on the unit sphere → convex
// hull = spherical Delaunay triangulation, so the eye openings and the mouth slit are exact holes
// with clean loops around them, and triangle density is spent where the face needs it.
//
// Expressions and visemes are *spatial warp functions* of the neutral head-space position. They
// are evaluated for every vertex (skin, brow cards, lashes, beard shells) and stored as relative
// morph targets, so everything attached to the face moves together. The jaw is a bone.
//
// Head space: origin at the head centre, +Y up, +Z forward, +X = character's left, meters at
// scale 1 (multiplied by `hs` when written into world bind space).

import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { sphere, ellipsoid, cone, makeField, polygonize } from './sdf.js';
import { Rng } from '../core/rng.js';
import { clamp, smoothstep, lerp } from '../core/util.js';

const { sin, cos, atan2, asin, sqrt, abs, PI, exp, max, min } = Math;
const D2R = PI / 180;

// UV warp: equirect with the face magnified (front gets more texels than the back of the head).
export const UV_GAMMA_U = 0.72;
export const UV_GAMMA_V = 0.85;
export function dirToUV(x, y, z) {
  const th = atan2(x, z);
  const ph = asin(clamp(y, -1, 1));
  const u = 0.5 + 0.5 * Math.sign(th) * Math.pow(abs(th) / PI, UV_GAMMA_U);
  const v = 0.5 + 0.5 * Math.sign(ph) * Math.pow(abs(ph) / (PI / 2), UV_GAMMA_V);
  return [u, v];
}
export function uvToDir(u, v, out = [0, 0, 0]) {
  const du = u - 0.5;
  const dv = v - 0.5;
  const th = Math.sign(du) * PI * Math.pow(abs(du) * 2, 1 / UV_GAMMA_U);
  const ph = Math.sign(dv) * (PI / 2) * Math.pow(abs(dv) * 2, 1 / UV_GAMMA_V);
  out[0] = sin(th) * cos(ph);
  out[1] = sin(ph);
  out[2] = cos(th) * cos(ph);
  return out;
}

export const MORPHS = [
  'blink.L', 'blink.R', 'lidUp.L', 'lidUp.R', 'squint.L', 'squint.R',
  'browInnerUp.L', 'browInnerUp.R', 'browOuterUp.L', 'browOuterUp.R', 'browDown.L', 'browDown.R',
  'smile.L', 'smile.R', 'frown.L', 'frown.R', 'mouthWide', 'pucker', 'funnel',
  'upperLipUp', 'lowerLipDown', 'lowerLipIn', 'lipsPress', 'cheekPuff', 'sneer',
];

/** Facial layout (head space) derived from params. Shared with texture painting. */
export function faceLayout(p) {
  const fw = 0.94 + 0.12 * p.faceWidth;
  const jw = 0.88 + 0.22 * p.jaw;
  const mw = 0.88 + 0.24 * p.mouthWidth;
  const old = clamp((p.age - 35) / 50, 0, 1);
  const L = {
    fw, jw, mw, old,
    eyeR: 0.0172 * (0.88 + 0.26 * p.eyeSize),
    eyeSep: (0.0375 + 0.009 * (p.eyeSpacing - 0.5)) * fw,
    eyeY: 0.006,
    tilt: (p.eyeTilt - 0.5) * 14 * D2R,
    lidUpper: (27 - 8 * p.lids - 3 * old) * D2R,
    lidLower: (21 + 2 * old) * D2R,
    lidHalfW: 52 * D2R,
    mouthY: -0.083,
    mouthHalfW: 0.026 * mw,
    noseTipZ: 0.142 + 0.02 * p.noseSize,
    noseTipY: -0.036 - 0.01 * (0.5 - p.noseTip),
    browY: 0.046 + 0.004 * p.browRidge,
  };
  return L;
}

// Head SDF primitives (scale 1). Eyes are inserted after the face surface is known.
function headPrims(p, L) {
  const f = p.fat;
  const P = [];
  const { fw, jw, mw } = L;
  P.push(ellipsoid([0, 0.03, -0.016], [0.108 * fw, 0.128, 0.127], { k: 0 }));
  P.push(sphere([0, 0.012, -0.075], 0.088, { k: 0.08 }));
  P.push(ellipsoid([0, -0.05, 0.022], [0.093 * jw * fw, 0.104, 0.097], { k: 0.07 }));
  for (const sx of [1, -1]) {
    P.push(sphere([sx * 0.07 * jw * fw, -0.09, -0.014], 0.036 * (0.8 + 0.4 * p.jaw) + 0.008 * f, { k: 0.05 }));
    P.push(sphere([sx * 0.054 * fw, -0.042, 0.064], 0.031 + 0.026 * p.cheeks + 0.012 * f, { k: 0.05 }));
    P.push(ellipsoid([sx * 0.058 * fw, -0.006, 0.07], [0.03 * (0.6 + 0.8 * p.cheekbones), 0.019, 0.025], { k: 0.03 }));
    // Brow ridge: two angled tubes meeting above the nose.
    P.push(cone([sx * 0.012, L.browY - 0.006, 0.102], [sx * 0.064 * fw, L.browY, 0.083], 0.015 + 0.009 * p.browRidge, 0.012 + 0.005 * p.browRidge, { k: 0.03 }));
  }
  const chinP = p.chin - 0.5;
  P.push(sphere([0, -0.126 - 0.008 * chinP, 0.062 + 0.024 * chinP], 0.034 + 0.008 * p.jaw, { k: 0.045 }));
  if (f > 0.3) {
    const dc = (f - 0.3) / 0.7;
    P.push(ellipsoid([0, -0.138, 0.018], [0.06 + 0.02 * dc, 0.026 + 0.02 * dc, 0.06], { k: 0.05 }));
  }
  // Muzzle + lips.
  P.push(ellipsoid([0, -0.079, 0.077], [0.046 * mw, 0.04, 0.045], { k: 0.035 }));
  const lp = p.lips;
  P.push(ellipsoid([0, -0.0745, 0.1105], [0.029 * mw, 0.0082 + 0.0045 * lp, 0.0115 + 0.0035 * lp], { k: 0.012 }));
  P.push(ellipsoid([0, -0.0905, 0.1075], [0.025 * mw, 0.0092 + 0.0055 * lp, 0.0115 + 0.0045 * lp], { k: 0.012 }));
  // Nose.
  const ns = p.noseSize;
  const nw = p.noseWidth;
  const tipZ = L.noseTipZ;
  const tipY = L.noseTipY;
  P.push(cone([0, 0.026, 0.103], [0, tipY + 0.008, tipZ - 0.012], 0.0085 + 0.005 * p.noseBridge, 0.012 + 0.006 * ns, { k: 0.02 }));
  P.push(sphere([0, (0.026 + tipY) * 0.5 + 0.006, 0.122 + 0.016 * p.noseBridge + 0.008 * ns], 0.0075 + 0.003 * p.noseBridge, { k: 0.016 }));
  P.push(sphere([0, tipY, tipZ - 0.004], 0.0165 + 0.009 * ns, { k: 0.018 }));
  for (const sx of [1, -1]) {
    P.push(sphere([sx * (0.0135 + 0.009 * nw) * (0.9 + 0.2 * ns), tipY - 0.008, tipZ - 0.024], 0.0115 + 0.004 * nw + 0.003 * ns, { k: 0.016 }));
    P.push(sphere([sx * 0.0072, tipY - 0.019, tipZ - 0.011], 0.0045 + 0.0015 * nw, { k: 0.005, sub: true }));
  }
  return P;
}

// Ray from outside toward the origin; returns the outermost surface distance along `d`.
function castIn(field, dx, dy, dz, tMax = 0.34) {
  let t = tMax;
  let d = field(dx * t, dy * t, dz * t);
  let it = 0;
  while (d > 1e-5 && t > 0.005 && it++ < 160) {
    t -= max(d * 0.9, 0.0002);
    d = field(dx * t, dy * t, dz * t);
  }
  // Bisection refine between t (inside) and t + step (outside).
  let lo = t;
  let hi = t + 0.003;
  for (let i = 0; i < 16; i++) {
    const m = (lo + hi) * 0.5;
    if (field(dx * m, dy * m, dz * m) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) * 0.5;
}

// ---- eye-local helpers ------------------------------------------------------------------------

class EyeFrame {
  constructor(L, side) {
    this.side = side; // +1 left, -1 right
    this.c = new THREE.Vector3();
    this.R = L.eyeR;
    // Outer corner raised by tilt: rotate about local z by side*tilt.
    this.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * L.tilt);
    this.qi = this.q.clone().invert();
    this.L = L;
  }
  // world (head space) → local spherical (az: + toward the outer corner, el: + up)
  toLocal(x, y, z, out) {
    const v = _v.set(x - this.c.x, y - this.c.y, z - this.c.z).applyQuaternion(this.qi);
    const r = v.length();
    out.r = r;
    out.az = atan2(v.x * this.side, v.z);
    out.el = asin(clamp(v.y / max(r, 1e-9), -1, 1));
    return out;
  }
  fromLocal(r, az, el, out = new THREE.Vector3()) {
    out.set(this.side * sin(az) * cos(el) * r, sin(el) * r, cos(az) * cos(el) * r).applyQuaternion(this.q).add(this.c);
    return out;
  }
  upper(az) {
    const u = clamp(az / this.L.lidHalfW, -1, 1);
    return this.L.lidUpper * Math.pow(1 - u * u, 0.6) * (1 - 0.1 * u);
  }
  lower(az) {
    const u = clamp(az / this.L.lidHalfW, -1, 1);
    return -this.L.lidLower * Math.pow(1 - u * u, 0.75) * (1 + 0.14 * u);
  }
}
const _v = new THREE.Vector3();

/**
 * Spatial warp library. Each returns the displacement (head space, scale 1) of a neutral point
 * for a morph at full weight. Used for skin vertices, brow cards, lashes and beard shells.
 */
function makeWarps(L, eyes, mouthLine) {
  const loc = { r: 0, az: 0, el: 0 };
  const g = (dx, dy, dz, s) => exp(-(dx * dx + dy * dy + dz * dz) / (2 * s * s));
  const out = new THREE.Vector3();
  // Rotate a point about its eye centre by changing elevation (keeps az, r).
  const lidMove = (eye, x, y, z, fnTarget, region) => {
    eye.toLocal(x, y, z, loc);
    const R = eye.R;
    const wr = 1 - smoothstep(R + 0.0045, R + 0.016, loc.r);
    if (wr <= 0) return out.set(0, 0, 0);
    const u = loc.az / L.lidHalfW;
    const wa = 1 - smoothstep(0.95, 1.45, abs(u));
    if (wa <= 0) return out.set(0, 0, 0);
    const up = eye.upper(loc.az);
    const lo = eye.lower(loc.az);
    const mid = (up + lo) * 0.5;
    let dEl = 0;
    if (region !== 'lower' && loc.el >= mid) {
      const w = 1 - smoothstep(up, up + 0.75, loc.el);
      dEl = fnTarget(up, lo, 'upper') * w;
    } else if (region !== 'upper' && loc.el < mid) {
      const w = 1 - smoothstep(-lo, -lo + 0.6, -loc.el);
      dEl = fnTarget(up, lo, 'lower') * w;
    }
    if (!dEl) return out.set(0, 0, 0);
    const p2 = eye.fromLocal(loc.r, loc.az, loc.el + dEl * wr * wa, _w);
    return out.set(p2.x - x, p2.y - y, p2.z - z);
  };
  const _w = new THREE.Vector3();
  const lipSide = (x, y) => (y - mouthLine(x) >= 0 ? 1 : -1); // +1 upper lip, -1 lower lip
  const mouthC = [0, L.mouthY, 0.108];
  const W = {};
  for (const [side, sx, eye] of [['L', 1, eyes[0]], ['R', -1, eyes[1]]]) {
    W[`blink.${side}`] = (x, y, z) =>
      lidMove(eye, x, y, z, (up, lo, part) => {
        const close = lo * 0.72 + up * 0.28;
        return part === 'upper' ? close - up : close - lo;
      });
    W[`lidUp.${side}`] = (x, y, z) => lidMove(eye, x, y, z, (up, lo, part) => (part === 'upper' ? 0.2 : -0.07));
    W[`squint.${side}`] = (x, y, z) => {
      const a = lidMove(eye, x, y, z, (up, lo, part) => (part === 'upper' ? -0.06 : (up - lo) * 0.35)).clone();
      // Cheek pushes up under the eye.
      const c = g(x - sx * 0.045, y + 0.03, z - 0.075, 0.018);
      return out.set(a.x, a.y + c * 0.004, a.z + c * 0.002);
    };
    const bx = sx * L.eyeSep;
    const above = (y) => smoothstep(L.eyeY + 0.006, L.eyeY + 0.026, y);
    W[`browInnerUp.${side}`] = (x, y, z) => {
      const w = g(x - sx * 0.017, y - L.browY, (z - 0.1) * 0.6, 0.017) * above(y) * (sx * x > -0.004 ? 1 : 0.4);
      return out.set(0, 0.0085 * w, 0.001 * w);
    };
    W[`browOuterUp.${side}`] = (x, y, z) => {
      const w = g(x - sx * 0.06, y - L.browY, (z - 0.08) * 0.6, 0.019) * above(y);
      return out.set(0, 0.0075 * w, 0);
    };
    W[`browDown.${side}`] = (x, y, z) => {
      const w = g((x - bx) * 0.7, y - L.browY, (z - 0.095) * 0.6, 0.02) * smoothstep(L.eyeY + 0.0, L.eyeY + 0.02, y) * (sx * x > 0 ? 1 : 0.3);
      const inner = 1 - smoothstep(0.01, 0.05, abs(x));
      return out.set(-sx * 0.004 * inner * w, -0.0065 * w, 0.0025 * w * inner);
    };
    const cx = sx * L.mouthHalfW;
    W[`smile.${side}`] = (x, y, z) => {
      const wc = g(x - cx, y - L.mouthY, (z - 0.095) * 0.7, 0.019);
      const wk = g(x - sx * 0.046, y + 0.038, z - 0.07, 0.022);
      const lipUp = g(x - sx * 0.012, y - L.mouthY - 0.006, z - 0.11, 0.012) * (lipSide(x, y) > 0 ? 1 : 0);
      return out.set(sx * 0.0045 * wc, 0.0085 * wc + 0.0055 * wk + 0.0015 * lipUp, -0.004 * wc + 0.0035 * wk);
    };
    W[`frown.${side}`] = (x, y, z) => {
      const wc = g(x - cx, y - L.mouthY, (z - 0.095) * 0.7, 0.018);
      const chin = g(x - sx * 0.01, y + 0.105, z - 0.09, 0.016);
      return out.set(sx * 0.002 * wc, -0.0075 * wc + 0.002 * chin, 0.001 * wc + 0.002 * chin);
    };
  }
  const lipsW = (x, y, z, s = 0.016) => g(x * 0.75, y - L.mouthY, (z - 0.1) * 0.6, s);
  W.mouthWide = (x, y, z) => {
    const w = lipsW(x, y, z, 0.022);
    const lat = clamp(x / L.mouthHalfW, -1.4, 1.4);
    return out.set(lat * 0.0075 * w, 0, -abs(lat) * 0.003 * w);
  };
  W.pucker = (x, y, z) => {
    const w = lipsW(x, y, z, 0.02);
    const ls = lipSide(x, y);
    const dy = y - mouthLine(x);
    return out.set(-x * 0.32 * w, -dy * 0.25 * w + ls * 0.0005 * w, 0.011 * w);
  };
  W.funnel = (x, y, z) => {
    const w = lipsW(x, y, z, 0.019);
    const ls = lipSide(x, y);
    return out.set(-x * 0.18 * w, ls * 0.0035 * w * (1 - smoothstep(0.6, 1.2, abs(x) / L.mouthHalfW)), 0.007 * w);
  };
  W.upperLipUp = (x, y, z) => {
    const w = g(x * 0.8, y - L.mouthY - 0.008, z - 0.105, 0.014) * (lipSide(x, y) > 0 ? 1 : 0);
    return out.set(0, 0.0045 * w, -0.0005 * w);
  };
  W.lowerLipDown = (x, y, z) => {
    const w = g(x * 0.8, y - L.mouthY + 0.01, z - 0.1, 0.014) * (lipSide(x, y) < 0 ? 1 : 0);
    return out.set(0, -0.0045 * w, 0.0008 * w);
  };
  W.lowerLipIn = (x, y, z) => {
    const w = g(x * 0.8, y - L.mouthY + 0.009, z - 0.104, 0.012) * (lipSide(x, y) < 0 ? 1 : 0);
    return out.set(0, 0.0035 * w, -0.006 * w);
  };
  W.lipsPress = (x, y, z) => {
    const w = lipsW(x, y, z, 0.015);
    const dy = y - mouthLine(x);
    return out.set(0, -dy * 0.35 * w, -0.0028 * w);
  };
  W.cheekPuff = (x, y, z) => {
    const w = g(abs(x) - 0.05, y + 0.06, z - 0.06, 0.022);
    return out.set(Math.sign(x) * 0.008 * w, 0, 0.006 * w);
  };
  W.sneer = (x, y, z) => {
    const w = g(abs(x) - 0.017, y - L.noseTipY + 0.008, z - (L.noseTipZ - 0.02), 0.013);
    const u = g(abs(x) - 0.012, y - L.mouthY - 0.008, z - 0.105, 0.012) * (lipSide(x, y) > 0 ? 1 : 0);
    return out.set(0, 0.004 * w + 0.004 * u, 0.0015 * w);
  };
  return W;
}

// ---- point distribution on the direction sphere ------------------------------------------------

function poissonSphere(rng, spacingFn, seeds, baseSpacing) {
  // Greedy blue noise on the unit sphere with variable spacing (spatial hash on a cube grid).
  const pts = [];
  const cell = baseSpacing * 0.5;
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const insert = (p) => {
    const k = key(p.x, p.y, p.z);
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(p);
    pts.push(p);
  };
  const near = (p, r) => {
    const cr = Math.ceil(r / cell);
    const ix = Math.floor(p.x / cell);
    const iy = Math.floor(p.y / cell);
    const iz = Math.floor(p.z / cell);
    const r2 = r * r;
    for (let a = -cr; a <= cr; a++)
      for (let b = -cr; b <= cr; b++)
        for (let c = -cr; c <= cr; c++) {
          const arr = grid.get(`${ix + a},${iy + b},${iz + c}`);
          if (!arr) continue;
          for (const q of arr) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2 < r2) return true;
        }
    return false;
  };
  for (const s of seeds) insert(s);
  // Candidates: Fibonacci sphere at the finest spacing, shuffled for blue noise.
  const minS = 0.022;
  const n = Math.round((4 * PI) / (minS * minS * 0.9));
  const cand = [];
  const ga = PI * (3 - sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = sqrt(1 - y * y);
    const th = ga * i;
    cand.push(new THREE.Vector3(cos(th) * r, y, sin(th) * r));
  }
  rng.shuffle(cand);
  // Sort coarse-to-fine-ish: first pass with probability so large-spacing regions are uniform.
  for (const c of cand) {
    const s = spacingFn(c);
    if (!near(c, s * 0.82)) insert(c);
  }
  return pts;
}

// ---- main builder ----------------------------------------------------------------------------

/**
 * Build the head. Returns geometry parts (skin, cards, mouth) in head space (scale 1) plus layout
 * info; human.js converts to world bind space and adds skin weights for its rig.
 */
export function buildHead(p, { tier = 'high', rng = new Rng(p.seed) } = {}) {
  const L = faceLayout(p);
  const prims = headPrims(p, L);
  // Base face field (no eyes) to find where the eyeballs sit.
  const baseField = makeField(prims);
  const eyes = [new EyeFrame(L, 1), new EyeFrame(L, -1)];
  for (const e of eyes) {
    const ex = e.side * L.eyeSep;
    // Surface depth in front of the eye.
    let zs = 0.2;
    while (baseField(ex, L.eyeY, zs) > 0 && zs > 0) zs -= 0.0005;
    e.c.set(ex, L.eyeY, zs - L.eyeR * 0.56);
  }
  // Sockets and lid shells.
  const full = [...prims];
  for (const e of eyes) {
    full.push(sphere([e.c.x, e.c.y, e.c.z], e.R + 0.0075, { k: 0.012, sub: true }));
  }
  for (const e of eyes) {
    full.push(sphere([e.c.x, e.c.y, e.c.z], e.R + 0.0023 + 0.0006 * p.lids, { k: 0.009 }));
    // Heavy upper lid fold.
    full.push(sphere([e.c.x, e.c.y + 0.0035 + 0.002 * p.lids, e.c.z + 0.001], e.R + 0.0015 + 0.0016 * p.lids, { k: 0.006 }));
  }
  const field = makeField(full);

  // Mouth line (center of the slit) as a function of x; corners curl up slightly.
  const hw = L.mouthHalfW;
  const mouthLine = (x) => L.mouthY + 0.0022 * (x / hw) ** 2 - 0.0006;
  const lensGap = (x) => 0.0009 * sqrt(max(0, 1 - (x / hw) ** 2));

  // --- edge loops (directions) ---
  const seeds = [];
  const tags = []; // per seed: {kind:'eye'|'mouth', id, ring}
  const pushSeed = (pt, tag) => {
    const d = pt.clone().normalize();
    d.userData = tag;
    seeds.push(d);
  };
  const lidRings = [0, 0.0016, 0.0042, 0.0082];
  const NE = tier === 'low' ? 22 : 34;
  for (let ei = 0; ei < 2; ei++) {
    const e = eyes[ei];
    for (let ri = 0; ri < lidRings.length; ri++) {
      const off = lidRings[ri];
      const grow = off / e.R; // angular growth of the almond
      const n = NE + ri * 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * PI * 2;
        // Parametrise the almond: angle a walks the contour (upper half for a in [0, π]).
        const u = cos(a);
        const az = u * (L.lidHalfW + grow * 0.9 + (ri ? 0.04 : 0));
        let el = a < PI ? e.upper(az) : e.lower(az);
        el += Math.sign(PI - a) * grow * 0.9 * (a < PI ? 1 : 1);
        const r = ri === 0 ? e.R + 0.0004 : e.R + 0.0023;
        const pt = e.fromLocal(r, az, el);
        pushSeed(pt, { kind: 'eye', id: ei, ring: ri, az, el, upper: a < PI });
      }
    }
  }
  const mouthRings = [0, 0.0016, 0.0042, 0.0075, 0.012];
  const NM = tier === 'low' ? 26 : 40;
  for (let ri = 0; ri < mouthRings.length; ri++) {
    const off = mouthRings[ri];
    const n = NM + ri * 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * PI * 2;
      const xx = cos(a) * (hw + off * 0.8);
      const upper = sin(a) >= 0;
      const xc = clamp(xx, -hw, hw);
      const yy = mouthLine(xc) + (upper ? 1 : -1) * (lensGap(xc) + off) * abs(sin(a)) ** (ri === 0 ? 1 : 0.6);
      // Find the lip surface depth along +z at (xx, yy).
      let zz = 0.16;
      while (field(xx, yy, zz) > 0 && zz > 0.02) zz -= 0.0004;
      pushSeed(new THREE.Vector3(xx, yy, zz), { kind: 'mouth', ring: ri, upper, x: xx });
    }
  }

  // --- blue-noise fill ---
  const lowMul = tier === 'low' ? 1.65 : tier === 'medium' ? 1.25 : 1;
  const featureDirs = [eyes[0].c.clone().normalize(), eyes[1].c.clone().normalize(), new THREE.Vector3(0, L.mouthY, 0.11).normalize(), new THREE.Vector3(0, L.noseTipY, L.noseTipZ).normalize()];
  const spacingFn = (d) => {
    let s = 0.075;
    if (d.z < -0.2) s = 0.1;
    // Face front gets finer, features finest.
    s = lerp(s, 0.045, smoothstep(0.2, 0.7, d.z));
    const fd = min(d.distanceTo(featureDirs[0]), d.distanceTo(featureDirs[1]));
    const md = d.distanceTo(featureDirs[2]);
    const nd = d.distanceTo(featureDirs[3]);
    s = min(s, lerp(0.022, 0.06, smoothstep(0.15, 0.4, fd)));
    s = min(s, lerp(0.022, 0.06, smoothstep(0.16, 0.42, md)));
    s = min(s, lerp(0.024, 0.06, smoothstep(0.1, 0.35, nd)));
    return s * lowMul;
  };
  // Keep fill points away from ring zones: rings define those regions.
  const ringFree = (d) => {
    for (const e of eyes) {
      const l = e.toLocal(d.x * 0.12, d.y * 0.12, d.z * 0.12, { r: 0, az: 0, el: 0 });
      void l;
    }
    return true;
  };
  void ringFree;
  const pts = poissonSphere(rng, (d) => {
    // Inside eye/mouth zones only the rings exist: forbid fill points there via huge spacing check.
    return spacingFn(d);
  }, seeds, 0.1);
  // Remove fill points that fall inside the holes or between rings (they'd break loops).
  const keep = [];
  for (const d of pts) {
    if (d.userData) {
      keep.push(d);
      continue;
    }
    let bad = false;
    for (let ei = 0; ei < 2; ei++) {
      const e = eyes[ei];
      // Direction → point on lid sphere to test almond membership.
      const t = rayHitSphere(d, e.c, e.R + 0.0023);
      if (t > 0) {
        const pt = d.clone().multiplyScalar(t);
        const l = e.toLocal(pt.x, pt.y, pt.z, { r: 0, az: 0, el: 0 });
        const u = abs(l.az) / (L.lidHalfW + 0.12);
        if (u < 1) {
          const up = e.upper(l.az) + 0.1;
          const lo = e.lower(l.az) - 0.1;
          if (l.el < up && l.el > lo) bad = true;
        }
      }
    }
    {
      const pt = d.clone().multiplyScalar(0.115 / max(0.3, d.z));
      if (abs(pt.x) < hw + 0.014 && abs(pt.y - mouthLine(clamp(pt.x, -hw, hw))) < 0.0135) bad = true;
    }
    if (!bad) keep.push(d);
  }

  // --- spherical Delaunay ---
  const hull = new ConvexHull().setFromPoints(keep);
  const indexOf = new Map(keep.map((v, i) => [v, i]));
  let tris = [];
  for (const face of hull.faces) {
    const a = indexOf.get(face.edge.tail().point);
    const b = indexOf.get(face.edge.head().point);
    const c = indexOf.get(face.edge.next.head().point);
    // Drop faces spanning a hole: all three on the same ring-0 loop.
    const ta = keep[a].userData;
    const tb = keep[b].userData;
    const tc = keep[c].userData;
    if (ta && tb && tc && ta.ring === 0 && tb.ring === 0 && tc.ring === 0 && ta.kind === tb.kind && tb.kind === tc.kind && (ta.kind === 'mouth' || (ta.id === tb.id && tb.id === tc.id))) {
      // Mouth: upper and lower loop points joined across the slit → hole.
      if (ta.kind === 'eye' || !(ta.upper === tb.upper && tb.upper === tc.upper)) continue;
      // Three upper (or lower) points: hole only if centroid lies inside the lens.
      continue;
    }
    tris.push(a, b, c);
  }

  // --- surface positions ---
  const N = keep.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const d = keep[i];
    const tag = d.userData;
    let x;
    let y;
    let z;
    if (tag && tag.kind === 'eye' && tag.ring === 0) {
      const e = eyes[tag.id];
      const pt = e.fromLocal(e.R + 0.0004, tag.az, tag.el);
      x = pt.x;
      y = pt.y;
      z = pt.z;
    } else {
      const t = castIn(field, d.x, d.y, d.z);
      x = d.x * t;
      y = d.y * t;
      z = d.z * t;
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  // Lip roll: the contact loop tucks into the mouth; the next loop rounds the lip edge.
  for (let i = 0; i < N; i++) {
    const tag = keep[i].userData;
    if (!tag || tag.kind !== 'mouth') continue;
    const corner = smoothstep(0.75, 1.0, abs(tag.x) / hw);
    if (tag.ring === 0) {
      pos[i * 3 + 2] -= 0.0065 * (1 - corner * 0.6);
      pos[i * 3 + 1] += (tag.upper ? -1 : 1) * 0.0005;
    } else if (tag.ring === 1) {
      pos[i * 3 + 2] -= 0.0022 * (1 - corner * 0.5);
    }
  }

  const skin = { positions: pos, index: tris, tags: keep.map((d) => d.userData || null), dirs: keep };
  const warps = makeWarps(L, eyes, mouthLine);
  return { L, eyes, field, prims: full, skin, warps, mouthLine, lensGap };
}

function rayHitSphere(d, c, r) {
  // Ray from origin along d; returns nearest positive t (or -1).
  const b = d.x * c.x + d.y * c.y + d.z * c.z;
  const cc = c.x * c.x + c.y * c.y + c.z * c.z - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = b - sqrt(disc);
  return t > 0 ? t : b + sqrt(disc);
}

// ---- ears ------------------------------------------------------------------------------------

/** Ear mesh (head space, scale 1) as an SDF sculpt: helix rim, antihelix, concha bowl, lobe. */
export function buildEar(p, L, side, tier) {
  const sz = 0.85 + 0.35 * p.ears + 0.12 * L.old;
  const out = (12 + 26 * p.earsOut) * D2R;
  // Ear frame: origin at the ear root on the side of the head.
  const root = new THREE.Vector3(side * 0.103 * L.fw, -0.012, -0.012);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, side * (PI / 2 - out) * 0, side * out, 'XYZ'));
  void q;
  // Local axes: n = outward normal of the ear plane, up, back.
  const n = new THREE.Vector3(side, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), side * -out * 0.9).normalize();
  const up = new THREE.Vector3(0, 1, 0.12).normalize();
  const back = new THREE.Vector3().crossVectors(n, up).multiplyScalar(-side).normalize();
  const W = (a, b, c) => [root.x + n.x * a + up.x * b + back.x * c, root.y + n.y * a + up.y * b + back.y * c, root.z + n.z * a + up.z * b + back.z * c];
  const H = 0.03 * sz;
  const Wd = 0.018 * sz;
  const prims = [];
  // Ear body: thin disc offset outward from the root.
  prims.push(ellipsoid(W(0.008, 0, 0.012 * sz), [0.0075, H, Wd], { k: 0, rot: rotRows(n, up, back) }));
  // Helix rim: capsules around the outline (top/back), thicker.
  const rim = [];
  for (let i = 0; i <= 12; i++) {
    const a = (-0.15 + (i / 12) * 1.25) * PI; // from front-top over the back to the lobe
    rim.push(W(0.01, sin(a + PI / 2) * H * 0.98, 0.012 * sz + cos(a + PI / 2) * -Wd * 0.98));
  }
  for (let i = 0; i < rim.length - 1; i++) prims.push(cone(rim[i], rim[i + 1], 0.0036 * sz, 0.0036 * sz, { k: 0.004 }));
  // Lobe.
  prims.push(sphere(W(0.008, -H * 0.82, 0.01 * sz), 0.0085 * sz + 0.002 * L.old, { k: 0.006 }));
  // Concha bowl carved into the front face.
  prims.push(sphere(W(0.017, -H * 0.12, 0.009 * sz), 0.0105 * sz, { k: 0.004, sub: true }));
  prims.push(sphere(W(0.016, H * 0.35, 0.011 * sz), 0.0072 * sz, { k: 0.004, sub: true }));
  // Root bridge into the head.
  prims.push(ellipsoid(W(-0.004, -0.004, 0.006 * sz), [0.009, H * 0.7, Wd * 0.55], { k: 0.008, rot: rotRows(n, up, back) }));
  // Tragus.
  prims.push(sphere(W(0.006, -H * 0.15, -0.006 * sz), 0.004 * sz, { k: 0.003 }));
  const f = makeField(prims);
  const pad = 0.006;
  const pts = [W(0, 0, 0), W(0.02, H, 0.03 * sz), W(0.02, -H * 1.1, -0.01), W(-0.01, H, 0.03 * sz), W(0.02, -H * 1.1, 0.03 * sz)];
  const mn = [1, 1, 1];
  const mx = [-1, -1, -1];
  for (const q2 of pts) for (let i = 0; i < 3; i++) {
    mn[i] = min(mn[i], q2[i] - 0.012);
    mx[i] = max(mx[i], q2[i] + 0.012);
  }
  const h = tier === 'low' ? 0.0042 : 0.0026;
  const mesh = polygonize(f, { min: mn.map((v) => v - pad), max: mx.map((v) => v + pad) }, h);
  return mesh;
}

function rotRows(x, y, z) {
  return [x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z];
}
