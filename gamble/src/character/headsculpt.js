// Head sculpt + facial layout (no template/caching here, so the rig can import it without a
// module cycle). See head.js for the template pipeline that turns this sculpt into meshes.
//
// Head space: origin at the head centre, +Y up, +Z forward, +X = the character's left, meters at
// scale 1 where chin → crown = HEAD_UNIT.

import * as THREE from 'three';
import { sphere, ellipsoid, cone, almond, makeField } from './sdf.js';
import { clamp } from '../core/util.js';

const { sin, cos, atan2, asin, sqrt, abs, PI, max, min, exp } = Math;
const D2R = PI / 180;

export const HEAD_UNIT = 0.32; // chin → crown at scale 1

// ---- head UVs: equirect around the head centre with the face magnified -------------------------
export const UV_GAMMA_U = 0.55;
export const UV_GAMMA_V = 0.78;
export function dirToUV(x, y, z, out = [0, 0]) {
  const l = sqrt(x * x + y * y + z * z) || 1;
  const th = atan2(x, z);
  const ph = asin(clamp(y / l, -1, 1));
  out[0] = 0.5 + 0.5 * Math.sign(th) * Math.pow(abs(th) / PI, UV_GAMMA_U);
  out[1] = 0.5 + 0.5 * Math.sign(ph) * Math.pow(abs(ph) / (PI / 2), UV_GAMMA_V);
  return out;
}

// ---- layout -----------------------------------------------------------------------------------

/** Facial layout (head space) derived from params. Shared by sculpt, rig, warps and paint. */
export function faceLayout(p) {
  const fw = 0.93 + 0.14 * p.faceWidth;
  const jw = 0.86 + 0.26 * p.jaw;
  const mw = 0.86 + 0.28 * p.mouthWidth;
  const old = clamp((p.age - 35) / 50, 0, 1);
  const L = {
    fw, jw, mw, old, fat: p.fat,
    eyeR: 0.0186 * (0.88 + 0.24 * p.eyeSize),
    eyeSep: (0.0395 + 0.008 * (p.eyeSpacing - 0.5)) * fw,
    eyeY: 0.004,
    tilt: (p.eyeTilt - 0.5) * 14 * D2R,
    lidUpper: (35 - 10 * p.lids - 4 * old) * D2R,
    lidLower: (25 + 3 * old) * D2R,
    lidHalfW: 60 * D2R,
    mouthY: -0.079,
    mouthHalfW: 0.0275 * mw,
    noseTipZ: 0.144 + 0.022 * p.noseSize,
    noseTipY: -0.035 - 0.012 * (0.5 - p.noseTip),
    browY: 0.043 + 0.004 * p.browRidge,
    earSize: 0.86 + 0.34 * p.ears + 0.1 * old,
    earOut: (10 + 26 * p.earsOut) * D2R,
    earRoot: [0.1 * fw, -0.012, -0.018],
    eyes: null,
  };
  return L;
}

// ---- sculpt -----------------------------------------------------------------------------------

/**
 * Head primitives. `L.eyes` must be set (findEyes) to include sockets. Groups tag what each
 * primitive is so the template can derive masks (ears, mouth cavity, nostrils).
 */
export function headPrimitives(p, L, { neckR = 0.06 } = {}) {
  const f = p.fat;
  const P = [];
  const { fw, jw, mw } = L;
  const add = (prim, group = 'skull') => (prim.group = group, P.push(prim), prim);
  // Cranium and skull back.
  add(ellipsoid([0, 0.038, -0.024], [0.108 * fw, 0.13, 0.13], { k: 0 }));
  add(sphere([0, 0.03, -0.075], 0.09, { k: 0.08 }));
  // Face mass: the plane of the cheeks/eyes, softly blended into the cranium.
  add(ellipsoid([0, -0.012, 0.036], [0.09 * fw, 0.084, 0.082], { k: 0.06 }));
  // Jaw and its angles.
  add(ellipsoid([0, -0.074, 0.022], [0.074 * jw * fw, 0.08, 0.084], { k: 0.07 }));
  for (const sx of [1, -1]) {
    add(sphere([sx * 0.058 * jw * fw, -0.098, -0.02], 0.028 * (0.8 + 0.4 * p.jaw) + 0.009 * f, { k: 0.05 }));
    // Soft cheeks (fat, youth) and cheekbones.
    add(sphere([sx * 0.05 * fw, -0.046, 0.062], 0.026 + 0.02 * p.cheeks + 0.012 * f, { k: 0.055 }));
    add(ellipsoid([sx * 0.06 * fw, -0.008, 0.066], [0.03 * (0.6 + 0.8 * p.cheekbones), 0.018, 0.024], { k: 0.032 }));
    // Brow ridge: two angled tubes meeting above the nose.
    add(cone([sx * 0.012, L.browY - 0.007, 0.103], [sx * 0.064 * fw, L.browY - 0.001, 0.082], 0.014 + 0.008 * p.browRidge, 0.011 + 0.005 * p.browRidge, { k: 0.032 }));
  }
  const chinP = p.chin - 0.5;
  add(ellipsoid([0, -0.128 - 0.008 * chinP, 0.07 + 0.024 * chinP], [0.03 + 0.008 * p.jaw, 0.026, 0.028], { k: 0.04 }));
  {
    const dc = clamp((f - 0.35) / 0.65, 0, 1);
    add(ellipsoid([0, -0.13 - 0.016 * dc, 0.01 + 0.012 * dc], [0.03 + 0.045 * dc, 0.008 + 0.03 * dc, 0.04 + 0.02 * dc], { k: 0.03 + 0.03 * dc }));
  }
  // Muzzle + lips.
  add(ellipsoid([0, L.mouthY - 0.004, 0.077], [0.043 * mw, 0.04, 0.041], { k: 0.035 }));
  const lp = p.lips;
  add(ellipsoid([0, L.mouthY + 0.0088, 0.1165], [0.03 * mw, 0.0088 + 0.0042 * lp, 0.0105 + 0.0034 * lp], { k: 0.008 }), 'lipU');
  add(ellipsoid([0, L.mouthY - 0.0102, 0.1135], [0.027 * mw, 0.0102 + 0.0056 * lp, 0.0108 + 0.0044 * lp], { k: 0.008 }), 'lipD');
  // Nose.
  const ns = p.noseSize;
  const nw = p.noseWidth;
  const tipZ = L.noseTipZ;
  const tipY = L.noseTipY;
  add(cone([0, 0.026, 0.104], [0, tipY + 0.008, tipZ - 0.01], 0.0075 + 0.005 * p.noseBridge, 0.0105 + 0.005 * ns, { k: 0.02 }), 'nose');
  add(sphere([0, (0.026 + tipY) * 0.5 + 0.006, 0.12 + 0.016 * p.noseBridge + 0.008 * ns], 0.0068 + 0.003 * p.noseBridge, { k: 0.016 }), 'nose');
  add(sphere([0, tipY, tipZ - 0.006], 0.0128 + 0.008 * ns, { k: 0.016 }), 'nose');
  for (const sx of [1, -1]) {
    add(sphere([sx * (0.012 + 0.008 * nw) * (0.9 + 0.2 * ns), tipY - 0.008, tipZ - 0.022], 0.0096 + 0.0035 * nw + 0.003 * ns, { k: 0.014 }), 'nose');
  }
  // Neck stub (overlaps the body's neck; the body mesh takes over below).
  add(cone([0, -0.1, -0.038], [0, -0.215, -0.042], neckR + 0.002, neckR - 0.0035, { k: 0.028 }), 'neck');
  // ---- carving (subtractions come last so they cut through everything above).
  // Mouth slit between the lips and the mouth bag behind it.
  add(ellipsoid([0, L.mouthY, 0.1], [L.mouthHalfW, 0.0046, 0.034], { k: 0.0035, sub: true }), 'slit');
  add(ellipsoid([0, L.mouthY - 0.003, 0.064], [0.032 * mw, 0.027, 0.045], { k: 0.008, sub: true }), 'bag');
  for (const sx of [1, -1]) {
    add(ellipsoid([sx * 0.0078, tipY - 0.0195, tipZ - 0.019], [0.0042 + 0.0012 * nw, 0.0034, 0.0058], { k: 0.006, sub: true }), 'nostril');
  }
  if (L.eyes) {
    for (const e of L.eyes) {
      // Almond-shaped socket hugging the lid opening; the lid shells bury into the solid face
      // just beyond its edge.
      const m = new THREE.Matrix4().makeRotationFromQuaternion(e.qi).elements;
      const rot = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
      add(almond([e.c.x, e.c.y, e.c.z], rot, e.side, e.R + 0.0034, { halfW: L.lidHalfW, up: L.lidUpper, lo: L.lidLower, mU: 0.27, mL: 0.2, mA: 0.13 }, { k: 0.007, sub: true }), 'socket');
    }
  }
  return P;
}

/**
 * Ear sculpt (helix rim, lobe, antihelix, tragus, concha bowl) in canonical ear space for the
 * LEFT ear: x = outward from the head, y = up, z = toward the back; origin at the ear root.
 * Size 1 = template ear. Polygonized once on a fine grid (ears are thin) and placed per person.
 */
export function earPrimitives(old = 0.2) {
  const W = (a, b, c) => [a, b, c];
  const H = 0.031;
  const Wd = 0.019;
  const prims = [];
  prims.push(ellipsoid(W(0.008, 0, 0.012), [0.0042, H * 0.97, Wd * 0.97], { k: 0.003 }));
  for (let i = 0; i < 11; i++) {
    const a0 = (-0.12 + (i / 11) * 1.18) * PI;
    const a1 = (-0.12 + ((i + 1) / 11) * 1.18) * PI;
    const r0 = 0.0044 * (1 - 0.15 * (i / 11));
    prims.push(cone(W(0.0095, sin(a0 + PI / 2) * H, 0.012 - cos(a0 + PI / 2) * Wd), W(0.0095, sin(a1 + PI / 2) * H, 0.012 - cos(a1 + PI / 2) * Wd), r0, r0 * 0.985, { k: 0.004 }));
  }
  prims.push(sphere(W(0.008, -H * 0.8, 0.0105), 0.009 + 0.002 * old, { k: 0.007 }));
  prims.push(cone(W(0.011, -H * 0.35, 0.015), W(0.012, H * 0.55, 0.012), 0.003, 0.0024, { k: 0.004 }));
  prims.push(sphere(W(0.0065, -H * 0.15, -0.006), 0.0044, { k: 0.004 }));
  // Root bridge (buried in the head).
  prims.push(ellipsoid(W(-0.004, -0.004, 0.008), [0.009, H * 0.6, Wd * 0.5], { k: 0.012 }));
  prims.push(sphere(W(0.0178, -H * 0.12, 0.0085), 0.0098, { k: 0.004, sub: true }));
  prims.push(sphere(W(0.017, H * 0.4, 0.0115), 0.0066, { k: 0.004, sub: true }));
  for (const q of prims) q.group = 'ear';
  return prims;
}

class EyeFrame {
  constructor(L, side) {
    this.side = side; // +1 left, -1 right
    this.c = new THREE.Vector3();
    this.R = L.eyeR;
    // Outer corner raised by tilt: rotate about the forward axis.
    this.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * L.tilt);
    this.qi = this.q.clone().invert();
    this.L = L;
  }
  /** Spherical (az: + toward the outer corner, el: + up) → head space. */
  fromLocal(r, az, el, out = new THREE.Vector3()) {
    return out.set(this.side * sin(az) * cos(el) * r, sin(el) * r, cos(az) * cos(el) * r).applyQuaternion(this.q).add(this.c);
  }
  toLocal(x, y, z, out = {}) {
    const v = _v.set(x - this.c.x, y - this.c.y, z - this.c.z).applyQuaternion(this.qi);
    out.r = v.length();
    out.az = atan2(v.x * this.side, v.z);
    out.el = asin(clamp(v.y / max(out.r, 1e-9), -1, 1));
    return out;
  }
  upper(az) {
    const u = clamp(az / this.L.lidHalfW, -1, 1);
    return this.L.lidUpper * Math.pow(1 - u * u, 0.55) * (1 - 0.12 * u);
  }
  lower(az) {
    const u = clamp(az / this.L.lidHalfW, -1, 1);
    return -this.L.lidLower * Math.pow(1 - u * u, 0.8) * (1 + 0.16 * u);
  }
}
const _v = new THREE.Vector3();

/** Place the eyeballs: just behind the face surface, protruding ~45% of their radius. */
export function findEyes(p, L) {
  const base = makeField(headPrimitives(p, { ...L, eyes: null }));
  L.eyes = [new EyeFrame(L, 1), new EyeFrame(L, -1)];
  for (const e of L.eyes) {
    const ex = e.side * L.eyeSep;
    let zs = 0.2;
    while (base(ex, L.eyeY, zs) > 0 && zs > 0) zs -= 0.0004;
    e.c.set(ex, L.eyeY, zs - L.eyeR * 0.96);
  }
  return L.eyes;
}

export const FACE_BONES = ['head', 'neck', 'jaw', 'lip.U', 'lip.D', 'corner.L', 'corner.R', 'cheek.L', 'cheek.R', 'brow.in.L', 'brow.in.R', 'brow.out.L', 'brow.out.R', 'nose'];

/** Head-space positions of the face bones (also used as the warp/weight landmarks). */
export function faceBonePositions(L) {
  const P = {};
  P.jaw = [0, -0.032, -0.03];
  P['lip.U'] = [0, L.mouthY + 0.01, 0.113];
  P['lip.D'] = [0, L.mouthY - 0.012, 0.109];
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    P[`corner.${s}`] = [sx * L.mouthHalfW, L.mouthY + 0.001, 0.098];
    P[`cheek.${s}`] = [sx * 0.05 * L.fw, -0.035, 0.075];
    P[`brow.in.${s}`] = [sx * 0.02, L.browY - 0.002, 0.104];
    P[`brow.out.${s}`] = [sx * 0.056 * L.fw, L.browY + 0.002, 0.088];
  }
  P.nose = [0, L.noseTipY - 0.006, L.noseTipZ - 0.02];
  return P;
}

// The mouth is sculpted slightly open (clean topology between the lips); the jaw's rest pose
// rotates it closed by this angle about the jaw bone's local X.
export const JAW_BIND_OPEN = 3.2 * D2R;

