// Body sculpt: the human body as a smooth union of a few large primitives laid on the bind
// skeleton (rig.js). Shapes are deliberately simple and broad — chunky stylised anatomy, no
// lumps — and every slider only resizes/moves primitives, so the same primitive list (same
// order, always present) describes every person. template.js polygonizes it once and later
// projects that template onto each person's own field.
//
// Every primitive carries skinning metadata (bone keys along its axis) and a region group
// ('torso', 'arm.L', 'leg.R', …) used by garments and skin masks. Hands live in their own
// canonical space (handPrimitives) because they need a much finer template.

import * as THREE from 'three';
import { sphere, ellipsoid, cone, box, basisRot } from './sdf.js';
import { FINGERS, HAND, fingerChains } from './rig.js';
import { clamp } from '../core/util.js';

export const REGION = { torso: 0, neck: 1, 'arm.L': 2, 'arm.R': 3, 'leg.L': 4, 'leg.R': 5, 'hand.L': 6, 'hand.R': 7, 'foot.L': 8, 'foot.R': 9, 'shoulder.L': 10, 'shoulder.R': 11, head: 12 };
export const REGION_NAMES = Object.keys(REGION);

const v3 = (v) => [v.x, v.y, v.z];
const lerp3 = (a, b, t) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t];

// Orientation (world→local rows) for an ellipsoid whose local Y follows `dir`.
function alongRot(dir, ref = new THREE.Vector3(0, 0, 1)) {
  const y = dir.clone().normalize();
  const z = ref.clone().addScaledVector(y, -ref.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return basisRot(v3(x), v3(y), v3(z));
}

/** Body primitives (bind pose, world space). The list layout is identical for every person. */
export function bodyPrimitives(p, rig) {
  const { j, s, hipY, shoulderY, shoulderHalf, chinY } = rig.dims;
  const B = (n) => rig.boneIndex.get(n);
  const f = p.fat;
  const m = p.muscle;
  const old = clamp((p.age - 40) / 50, 0, 1);
  const bA = clamp(p.belly * 0.6 + f * 0.55, 0, 1.15);
  const prims = [];
  const P = (prim) => (prims.push(prim), prim);

  // ---- torso: pelvis → waist → ribcage, blended wide so it reads as one soft form.
  P(ellipsoid([0, hipY + 0.03 * s, -0.012 * s], [(0.132 + 0.036 * p.hips + 0.05 * f) * s, 0.11 * s, (0.098 + 0.032 * f) * s], { bones: [[0, B('hips')]], group: 'torso', k: 0.07 * s }));
  P(ellipsoid([0, j.spine.y + 0.01 * s, -0.008 * s], [(0.112 + 0.034 * p.waist + 0.062 * f) * s, 0.14 * s, (0.088 + 0.036 * f) * s], { bones: [[0, B('spine')]], group: 'torso', k: 0.1 * s }));
  P(ellipsoid([0, j.chest.y - 0.01 * s, -0.018 * s], [(0.128 + 0.036 * p.shoulders + 0.026 * m + 0.042 * f) * s, 0.162 * s, (0.098 + 0.02 * m + 0.03 * f) * s], { bones: [[0, B('chest')]], group: 'torso', k: 0.09 * s }));
  // Belly: grows with the belly and fat sliders, sags with age. Its own bone jiggles.
  const br = (0.07 + 0.085 * bA) * s;
  P(ellipsoid([0, j.spine.y - (0.03 + 0.035 * old * bA) * s, (0.012 + 0.07 * bA) * s], [br * 1.14, br * 0.96, br], { bones: [[0, B('belly')]], group: 'torso', k: (0.11 + 0.04 * bA) * s, tau: 0.03 * s }));
  // Shoulder girdle bar gives the top of the torso its width.
  const gy = shoulderY - 0.048 * s;
  const gr = (0.06 + 0.014 * m + 0.016 * f) * s;
  P(cone([-shoulderHalf * 0.74, gy, -0.022 * s], [shoulderHalf * 0.74, gy, -0.022 * s], gr, gr, {
    bones: [[0, B('clavicle.R')], [0.32, B('chest')], [0.68, B('chest')], [1, B('clavicle.L')]], group: 'torso', k: 0.07 * s,
  }));
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = j[`upperarm.${side}`];
    // Trapezius slope from neck to shoulder.
    P(cone([sx * 0.02 * s, shoulderY + 0.03 * s, -0.04 * s], [sx * shoulderHalf * 0.8, shoulderY - 0.022 * s, -0.028 * s], (0.042 + 0.022 * m + 0.01 * f) * s, (0.04 + 0.01 * m) * s, {
      bones: [[0, B('neck')], [0.35, B('chest')], [1, B(`clavicle.${side}`)]], group: 'torso', k: 0.06 * s,
    }));
    // Deltoid cap.
    P(sphere([sh.x + sx * 0.008 * s, sh.y + 0.002 * s, sh.z - 0.004 * s], (0.058 + 0.02 * m + 0.017 * f) * s, { bones: [[0, B(`upperarm.${side}`)]], group: `shoulder.${side}`, k: 0.055 * s, tau: 0.024 * s }));
    // Pecs (muscle) and breasts (chest slider) are independent so any body is possible.
    P(ellipsoid([sx * 0.06 * s, j.chest.y + 0.03 * s, (0.05 + 0.012 * m + 0.02 * f) * s], [0.075 * s, 0.05 * s, (0.012 + 0.026 * m) * s], { bones: [[0, B('chest')]], group: 'torso', k: 0.085 * s }));
    const b = p.chest;
    const r = (0.012 + 0.072 * b + 0.022 * f * b) * s;
    const sag = (0.015 + 0.045 * old) * b * s;
    P(ellipsoid([sx * (0.072 + 0.012 * b) * s, j.chest.y - 0.008 * s - sag, (0.058 + 0.02 * f) * s + r * 0.45], [r * 1.03, r * (0.96 + 0.06 * old), r * 0.9], {
      bones: [[0, B(`breast.${side}`)]], group: 'torso', k: (0.05 + 0.025 * b) * s, tau: 0.026 * s,
    }));
    // Butt.
    P(sphere([sx * 0.066 * s, hipY + 0.008 * s, -(0.032 + 0.012 * p.hips + 0.014 * f) * s], (0.078 + 0.02 * p.hips + 0.03 * f) * s, { bones: [[0, B(`butt.${side}`)]], group: 'torso', k: 0.065 * s, tau: 0.026 * s }));
    // Love handles (grow with fat only).
    const lh = clamp((f - 0.2) / 0.8, 0, 1);
    P(ellipsoid([sx * (0.105 + 0.05 * lh) * s, hipY + 0.11 * s, -0.012 * s], [(0.03 + 0.045 * lh) * s, 0.065 * s, (0.05 + 0.025 * lh) * s], { bones: [[0, B('spine')], [0, B('hips')]], group: 'torso', k: 0.07 * s }));

    // ---- arm
    const el = j[`forearm.${side}`];
    const wr = j[`hand.${side}`];
    const dir = j[`armDir.${side}`];
    P(cone(v3(sh), v3(el), (0.058 + 0.018 * m + 0.028 * f) * s, (0.046 + 0.009 * m + 0.012 * f) * s, {
      bones: [[-0.15, B(`clavicle.${side}`)], [0.14, B(`upperarm.${side}`)], [0.78, B(`upperarm.${side}`)], [1.02, B(`forearm.${side}`)]], group: `arm.${side}`, k: 0.04 * s,
    }));
    {
      const c = lerp3(sh, el, 0.48);
      P(ellipsoid([c[0], c[1], c[2] + 0.014 * s], [0.034 * s, 0.072 * s, (0.018 + 0.028 * m) * s], { rot: alongRot(dir), bones: [[0, B(`upperarm.${side}`)]], group: `arm.${side}`, k: 0.035 * s }));
      const fl = clamp((f - 0.25) / 0.75, 0, 1);
      const c2 = lerp3(sh, el, 0.46);
      P(ellipsoid([c2[0] - sx * 0.01 * s, c2[1] - 0.012 * s, c2[2] - 0.018 * s], [(0.03 + 0.022 * fl) * s, 0.08 * s, (0.03 + 0.022 * fl) * s], { rot: alongRot(dir), bones: [[0, B(`upperarmFat.${side}`)]], group: `arm.${side}`, k: 0.045 * s }));
    }
    P(cone(v3(el), v3(wr), (0.051 + 0.013 * m + 0.015 * f) * s, (0.038 + 0.004 * m + 0.006 * f) * s, {
      bones: [[0, B(`upperarm.${side}`)], [0.15, B(`forearm.${side}`)], [0.88, B(`forearm.${side}`)], [1.04, B(`hand.${side}`)]], group: `arm.${side}`, k: 0.035 * s, forearm: side,
    }));
    {
      const c = lerp3(el, wr, 0.3);
      P(ellipsoid(c, [(0.038 + 0.01 * m) * s, 0.066 * s, (0.032 + 0.008 * m) * s], { rot: alongRot(dir), bones: [[0, B(`forearm.${side}`)]], group: `arm.${side}`, k: 0.04 * s }));
    }

    // ---- leg
    const hip = j[`thigh.${side}`];
    const kn = j[`shin.${side}`];
    const an = j[`foot.${side}`];
    P(cone(v3(hip), v3(kn), (0.096 + 0.032 * f + 0.012 * m + 0.012 * p.hips) * s, (0.063 + 0.012 * f + 0.007 * m) * s, {
      bones: [[0, B('hips')], [0.18, B(`thigh.${side}`)], [0.82, B(`thigh.${side}`)], [1.04, B(`shin.${side}`)]], group: `leg.${side}`, k: 0.05 * s,
    }));
    {
      const c = lerp3(hip, kn, 0.32);
      const fl = clamp(f, 0, 1);
      P(ellipsoid([c[0] - sx * 0.024 * s, c[1], c[2] - 0.004 * s], [(0.048 + 0.03 * fl) * s, 0.11 * s, (0.055 + 0.022 * fl) * s], { bones: [[0, B(`thigh.${side}`)]], group: `leg.${side}`, k: 0.05 * s }));
    }
    P(cone(v3(kn), v3(an), (0.06 + 0.011 * f + 0.006 * m) * s, (0.044 + 0.005 * f) * s, {
      bones: [[0, B(`thigh.${side}`)], [0.12, B(`shin.${side}`)], [0.86, B(`shin.${side}`)], [1.06, B(`foot.${side}`)]], group: `leg.${side}`, k: 0.04 * s,
    }));
    {
      const c = lerp3(kn, an, 0.3);
      P(ellipsoid([c[0], c[1], c[2] - 0.022 * s], [(0.044 + 0.006 * m + 0.006 * f) * s, 0.092 * s, (0.042 + 0.008 * m + 0.006 * f) * s], { bones: [[0, B(`shin.${side}`)]], group: `leg.${side}`, k: 0.06 * s }));
    }
    // ---- foot: chunky wedge heel → ball, a toe box, toes as soft bumps (seen only in slides).
    const heel = j[`heel.${side}`];
    const toe = j[`toe.${side}`];
    const tt = j[`toeTip.${side}`];
    P(cone([heel.x, heel.y + 0.012 * s, heel.z + 0.014 * s], [toe.x, toe.y + 0.004 * s, toe.z - 0.01 * s], 0.04 * s, 0.035 * s, {
      bones: [[0, B(`foot.${side}`)], [0.85, B(`foot.${side}`)], [1.0, B(`toe.${side}`)]], group: `foot.${side}`, k: 0.03 * s,
    }));
    P(cone(v3(an), [heel.x, heel.y + 0.032 * s, heel.z + 0.08 * s], 0.043 * s, 0.038 * s, { bones: [[0, B(`foot.${side}`)]], group: `foot.${side}`, k: 0.045 * s }));
    P(ellipsoid([toe.x - sx * 0.004 * s, 0.022 * s, (toe.z + tt.z) * 0.5 - 0.012 * s], [0.04 * s, 0.021 * s, 0.04 * s], { bones: [[0, B(`toe.${side}`)]], group: `foot.${side}`, k: 0.025 * s }));
    for (let t = 0; t < 5; t++) {
      const u = (t - 1.7) / 2.2; // big toe on the inner side
      const tr = (t === 0 ? 0.0135 : 0.0105 - t * 0.0006) * s;
      const tz = tt.z - (t === 0 ? 0.02 : 0.024 + t * 0.006) * s;
      P(sphere([toe.x - sx * u * 0.03 * s, 0.022 * s, tz], tr, { bones: [[0, B(`toe.${side}`)]], group: `foot.${side}`, k: 0.012 * s }));
    }
  }
  // ---- neck (continues into the head mesh, which overlaps it).
  P(cone([0, shoulderY - 0.03 * s, -0.03 * s], [0, chinY + 0.07 * s, -0.012 * s], (0.064 + 0.022 * f + 0.014 * m) * s, (0.054 + 0.016 * f + 0.006 * m) * s, {
    bones: [[0, B('chest')], [0.3, B('neck')], [0.72, B('neck')], [0.95, B('head')]], group: 'neck', k: 0.06 * s,
  }));
  return prims;
}

/**
 * Hand primitives for the canonical LEFT hand (frame: x = palm normal, y = toward the fingers,
 * z = thumb side; meters at handScale 1). Bones are given as names (resolved by the caller).
 * Includes a wrist stub that overlaps the forearm.
 */
export function handPrimitives(p) {
  const f = p.fat;
  const prims = [];
  const rot = basisRot([1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const ph = HAND.palm.half;
  const pad = 1 + f * 0.14;
  prims.push(box([0, HAND.palm.cy, 0], [ph[0] * pad, ph[1], ph[2]], 0.019, { rot, bones: [[0, 'hand']], group: 'hand', k: 0.014 }));
  // Thenar (thumb muscle) and hypothenar pads give the soft chunky silhouette.
  prims.push(ellipsoid([0.011, 0.03, 0.021], [0.02 * pad, 0.032, 0.026], { bones: [[0, 'hand'], [0, 'thumb1']], group: 'hand', k: 0.016 }));
  prims.push(ellipsoid([0.012, 0.036, -0.022], [0.018 * pad, 0.036, 0.02], { bones: [[0, 'hand']], group: 'hand', k: 0.016 }));
  // Wrist stub tucked into the forearm.
  prims.push(cone([0, -0.07, 0], [0, 0.015, 0], 0.034, 0.033, { bones: [[0, 'forearm'], [0.62, 'forearm'], [0.88, 'hand']], group: 'hand', k: 0.022, stub: true }));
  const chains = fingerChains();
  for (const fn of [...FINGERS, 'thumb']) {
    const pts = chains[fn].map((c) => [c.x, c.y, c.z]);
    const r0 = (fn === 'thumb' ? HAND.thumb.r : HAND.fingers[fn].r) * (1 + f * 0.1);
    for (let i = 0; i < 3; i++) {
      const bone = `${fn}${i + 1}`;
      const next = i < 2 ? `${fn}${i + 2}` : bone;
      const prev = i > 0 ? `${fn}${i}` : 'hand';
      const ra = r0 * (1 - i * 0.07);
      const rb = r0 * (1 - (i + 1) * 0.07) * (i === 2 ? 0.92 : 1);
      // The fingertip ends short of the bone tip by its radius so the rounded cap lands on it.
      let b = pts[i + 1];
      if (i === 2) {
        const d = Math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1], pts[3][2] - pts[2][2]);
        const t = rb / d;
        b = [pts[3][0] + (pts[2][0] - pts[3][0]) * t, pts[3][1] + (pts[2][1] - pts[3][1]) * t, pts[3][2] + (pts[2][2] - pts[3][2]) * t];
      }
      prims.push(cone(pts[i], b, ra, rb, {
        bones: [[0, prev], [0.2, bone], [0.84, bone], [1.0, next]], group: 'hand', k: (fn === 'thumb' && i === 0 ? 0.02 : 0.0055), finger: fn, seg: i,
      }));
    }
    if (fn !== 'thumb') {
      // Knuckle bump on the back of the hand.
      const d = HAND.fingers[fn];
      prims.push(sphere([d.base[0] - 0.01, d.base[1] - 0.004, d.base[2]], d.r * 0.92, { bones: [[0, 'hand'], [0, `${fn}1`]], group: 'hand', k: 0.012 }));
    }
  }
  return prims;
}

export function boundsOf(prims, pad) {
  const mn = [1e9, 1e9, 1e9];
  const mx = [-1e9, -1e9, -1e9];
  const ext = (x, y, z, r) => {
    mn[0] = Math.min(mn[0], x - r);
    mn[1] = Math.min(mn[1], y - r);
    mn[2] = Math.min(mn[2], z - r);
    mx[0] = Math.max(mx[0], x + r);
    mx[1] = Math.max(mx[1], y + r);
    mx[2] = Math.max(mx[2], z + r);
  };
  for (const p of prims) {
    if (p.sub) continue;
    if (p.type === 'cone') {
      ext(p.ax, p.ay, p.az, p.r1);
      ext(p.bx, p.by, p.bz, p.r2);
    } else if (p.type === 'sphere') ext(p.cx, p.cy, p.cz, p.r);
    else if (p.type === 'ellipsoid') ext(p.cx, p.cy, p.cz, Math.max(p.rx, p.ry, p.rz));
    else ext(p.cx, p.cy, p.cz, Math.hypot(p.hx, p.hy, p.hz) + p.r);
  }
  return { min: mn.map((v) => v - pad), max: mx.map((v) => v + pad) };
}

/** Limb parameter for region queries: 0 at the shoulder/hip, 0.5 elbow/knee, 1 wrist/ankle. */
export function limbParam(j, group, x, y, z) {
  const side = group.slice(-1);
  let a;
  let b;
  let c;
  if (group.startsWith('arm') || group.startsWith('shoulder')) {
    a = j[`upperarm.${side}`];
    b = j[`forearm.${side}`];
    c = j[`hand.${side}`];
  } else if (group.startsWith('leg') || group.startsWith('foot')) {
    a = j[`thigh.${side}`];
    b = j[`shin.${side}`];
    c = j[`foot.${side}`];
  } else return 0;
  const proj = (p0, p1) => {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = p1.z - p0.z;
    const l2 = dx * dx + dy * dy + dz * dz;
    return ((x - p0.x) * dx + (y - p0.y) * dy + (z - p0.z) * dz) / l2;
  };
  const t1 = proj(a, b);
  if (t1 < 1) return t1 * 0.5;
  return 0.5 + proj(b, c) * 0.5;
}
