// Procedural body mesh: a sculpted smooth-union of primitives laid on the bind skeleton, turned
// into a skinned mesh with Surface Nets. Hands are polygonized separately on a much finer grid
// (fingers must hold cards and chips) and overlap the forearm with an inset ramp, so the join is
// invisible. Every vertex gets:
//   - 4 bone weights from primitive soft-min blending (smooth across elbows/knees/shoulders)
//   - a region id + limb parameter (garments use them for coverage and body culling)
//   - skin masks (redness, body-hair, knuckles, nails) for the skin shader
//
// Body sliders change primitive sizes; the head is a separate sculpted mesh (head.js) into which
// the neck tube disappears.

import * as THREE from 'three';
import { sphere, ellipsoid, cone, box, basisRot, makeField, polygonize, primitiveWeights, primDist, filterMesh } from './sdf.js';
import { FINGERS, HAND, handFrame, handToWorld, fingerChains } from './rig.js';
import { clamp, smoothstep } from '../core/util.js';

export const REGION = { torso: 0, neck: 1, 'arm.L': 2, 'arm.R': 3, 'leg.L': 4, 'leg.R': 5, 'hand.L': 6, 'hand.R': 7, 'foot.L': 8, 'foot.R': 9, 'shoulder.L': 10, 'shoulder.R': 11 };

const v3 = (v) => [v.x, v.y, v.z];
const lerp3 = (a, b, t) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t];

// Orientation (world→local rows) for an ellipsoid whose local Y follows `dir`.
function alongRot(dir, ref = new THREE.Vector3(0, 0, 1)) {
  const y = dir.clone().normalize();
  const z = ref.clone().addScaledVector(y, -ref.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return basisRot(v3(x), v3(y), v3(z));
}

/** Body primitives (bind pose, world space). `B(name)` resolves bone indices. */
export function bodyPrimitives(p, rig) {
  const { j, s, hipY, shoulderY, shoulderHalf, chinY } = rig.dims;
  const B = (n) => rig.boneIndex.get(n);
  const f = p.fat;
  const m = p.muscle;
  const old = clamp((p.age - 40) / 50, 0, 1);
  const bellyAmt = clamp(p.belly * 0.55 + f * 0.6, 0, 1.1);
  const prims = [];
  const P = (prim) => (prims.push(prim), prim);

  // --- torso
  P(ellipsoid([0, hipY + 0.035 * s, -0.012 * s], [(0.128 + 0.04 * p.hips + 0.05 * f) * s, 0.105 * s, (0.1 + 0.035 * f) * s], { bones: [[0, B('hips')]], group: 'torso', k: 0.05 * s }));
  P(ellipsoid([0, j.spine.y, -0.008 * s], [(0.118 + 0.035 * p.waist + 0.055 * f) * s, 0.125 * s, (0.09 + 0.032 * f) * s], { bones: [[0, B('spine')]], group: 'torso', k: 0.08 * s }));
  const br = (0.06 + 0.09 * bellyAmt) * s;
  P(ellipsoid([0, j.spine.y - (0.03 + 0.03 * old * bellyAmt) * s, (0.015 + 0.075 * bellyAmt) * s], [br * 1.18, br * 0.98, br], { bones: [[0, B('belly')]], group: 'torso', k: (0.07 + 0.03 * bellyAmt) * s, tau: 0.03 }));
  P(ellipsoid([0, j.chest.y - 0.005 * s, -0.012 * s], [(0.128 + 0.04 * p.shoulders + 0.03 * m + 0.045 * f) * s, 0.155 * s, (0.1 + 0.022 * m + 0.032 * f) * s], { bones: [[0, B('chest')]], group: 'torso', k: 0.07 * s }));
  // Shoulder girdle bar: gives the torso its width at the top.
  const gy = shoulderY - 0.045 * s;
  P(cone([-shoulderHalf * 0.78, gy, -0.018 * s], [shoulderHalf * 0.78, gy, -0.018 * s], (0.062 + 0.016 * m + 0.016 * f) * s, (0.062 + 0.016 * m + 0.016 * f) * s, {
    bones: [[0, B('clavicle.R')], [0.3, B('chest')], [0.7, B('chest')], [1, B('clavicle.L')]], group: 'torso', k: 0.06 * s,
  }));
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = j[`upperarm.${side}`];
    // Trapezius slope from neck to shoulder.
    P(cone([sx * 0.02 * s, shoulderY + 0.025 * s, -0.035 * s], [sx * shoulderHalf * 0.82, shoulderY - 0.02 * s, -0.025 * s], (0.045 + 0.022 * m + 0.01 * f) * s, (0.042 + 0.01 * m) * s, {
      bones: [[0, B('neck')], [0.35, B('chest')], [1, B(`clavicle.${side}`)]], group: 'torso', k: 0.05 * s,
    }));
    // Deltoid cap.
    P(sphere([sh.x + sx * 0.01 * s, sh.y + 0.004 * s, sh.z], (0.06 + 0.022 * m + 0.018 * f) * s, { bones: [[0, B(`upperarm.${side}`)]], group: `shoulder.${side}`, k: 0.045 * s, tau: 0.022 }));
    // Pecs (muscle) and breasts (chest slider) are independent so any body type is possible.
    if (m > 0.25) {
      const pm = (m - 0.25) / 0.75;
      P(ellipsoid([sx * 0.066 * s, j.chest.y + 0.035 * s, (0.05 + 0.02 * pm + 0.02 * f) * s], [0.07 * s, 0.05 * s, (0.03 + 0.02 * pm) * s], { bones: [[0, B('chest')]], group: 'torso', k: 0.05 * s }));
    }
    const b = p.chest;
    if (b > 0.05) {
      const r = (0.022 + 0.072 * b + 0.02 * f * b) * s;
      const sag = (0.02 + 0.04 * old) * b * s;
      P(ellipsoid([sx * (0.073 + 0.012 * b) * s, j.chest.y - 0.012 * s - sag, (0.06 + 0.02 * f) * s + r * 0.5], [r * 1.02, r * (0.95 + 0.05 * old), r * 0.9], {
        bones: [[0, B(`breast.${side}`)]], group: 'torso', k: (0.035 + 0.025 * b) * s, tau: 0.025,
      }));
    }
    // Butt.
    P(sphere([sx * 0.066 * s, hipY + 0.012 * s, -(0.03 + 0.012 * p.hips + 0.012 * f) * s], (0.078 + 0.022 * p.hips + 0.03 * f) * s, { bones: [[0, B(`butt.${side}`)]], group: 'torso', k: 0.055 * s, tau: 0.025 }));
    if (f > 0.25) {
      const lh = (f - 0.25) / 0.75;
      P(ellipsoid([sx * (0.11 + 0.05 * lh) * s, hipY + 0.11 * s, -0.01 * s], [(0.045 + 0.035 * lh) * s, 0.06 * s, 0.07 * s], { bones: [[0, B('spine')]], group: 'torso', k: 0.06 * s }));
    }

    // --- arm
    const el = j[`forearm.${side}`];
    const wr = j[`hand.${side}`];
    const dir = j[`armDir.${side}`];
    P(cone(v3(sh), v3(el), (0.06 + 0.02 * m + 0.03 * f) * s, (0.047 + 0.01 * m + 0.012 * f) * s, {
      bones: [[-0.12, B(`clavicle.${side}`)], [0.12, B(`upperarm.${side}`)], [0.78, B(`upperarm.${side}`)], [1.02, B(`forearm.${side}`)]], group: `arm.${side}`, k: 0.035 * s,
    }));
    if (m > 0.15) {
      const c = lerp3(sh, el, 0.5);
      P(ellipsoid([c[0], c[1], c[2] + 0.018 * s], [0.035 * s, 0.07 * s, (0.02 + 0.03 * m) * s], { rot: alongRot(dir), bones: [[0, B(`upperarm.${side}`)]], group: `arm.${side}`, k: 0.03 * s }));
    }
    if (f > 0.3) {
      const c = lerp3(sh, el, 0.48);
      const fl = (f - 0.3) / 0.7;
      P(ellipsoid([c[0] - sx * 0.012 * s, c[1] - 0.012 * s, c[2] - 0.02 * s], [(0.035 + 0.02 * fl) * s, 0.08 * s, (0.035 + 0.02 * fl) * s], { rot: alongRot(dir), bones: [[0, B(`upperarmFat.${side}`)]], group: `arm.${side}`, k: 0.04 * s }));
    }
    P(cone(v3(el), v3(wr), (0.05 + 0.014 * m + 0.016 * f) * s, (0.036 + 0.004 * m + 0.006 * f) * s, {
      bones: [[0, B(`upperarm.${side}`)], [0.14, B(`forearm.${side}`)], [0.9, B(`forearm.${side}`)], [1.04, B(`hand.${side}`)]], group: `arm.${side}`, k: 0.03 * s, forearm: side,
    }));
    {
      const c = lerp3(el, wr, 0.28);
      P(ellipsoid(c, [(0.036 + 0.01 * m) * s, 0.06 * s, (0.03 + 0.008 * m) * s], { rot: alongRot(dir), bones: [[0, B(`forearm.${side}`)]], group: `arm.${side}`, k: 0.03 * s }));
    }

    // --- leg
    const hip = j[`thigh.${side}`];
    const kn = j[`shin.${side}`];
    const an = j[`foot.${side}`];
    P(cone(v3(hip), v3(kn), (0.095 + 0.032 * f + 0.014 * m + 0.012 * p.hips) * s, (0.064 + 0.013 * f + 0.008 * m) * s, {
      bones: [[0, B('hips')], [0.16, B(`thigh.${side}`)], [0.84, B(`thigh.${side}`)], [1.03, B(`shin.${side}`)]], group: `leg.${side}`, k: 0.04 * s,
    }));
    if (f > 0.2) {
      const c = lerp3(hip, kn, 0.3);
      P(ellipsoid([c[0] - sx * 0.025 * s, c[1], c[2]], [(0.05 + 0.03 * f) * s, 0.1 * s, (0.055 + 0.02 * f) * s], { bones: [[0, B(`thigh.${side}`)]], group: `leg.${side}`, k: 0.04 * s }));
    }
    P(sphere([kn.x, kn.y + 0.01 * s, kn.z + 0.008 * s], (0.05 + 0.01 * f) * s, { bones: [[0, B(`thigh.${side}`)], [0, B(`shin.${side}`)]], group: `leg.${side}`, k: 0.03 * s }));
    P(cone(v3(kn), v3(an), (0.062 + 0.012 * f + 0.008 * m) * s, (0.041 + 0.005 * f) * s, {
      bones: [[0, B(`thigh.${side}`)], [0.1, B(`shin.${side}`)], [0.88, B(`shin.${side}`)], [1.05, B(`foot.${side}`)]], group: `leg.${side}`, k: 0.035 * s,
    }));
    {
      const c = lerp3(kn, an, 0.3);
      P(ellipsoid([c[0], c[1], c[2] - 0.02 * s], [(0.046 + 0.006 * m) * s, 0.09 * s, (0.044 + 0.008 * m) * s], { bones: [[0, B(`shin.${side}`)]], group: `leg.${side}`, k: 0.05 * s }));
    }
    // Foot: a chunky wedge from heel to toes (lives inside shoes almost always).
    const heel = j[`heel.${side}`];
    const tt = j[`toeTip.${side}`];
    P(cone([heel.x, heel.y + 0.008 * s, heel.z + 0.01 * s], [tt.x, tt.y, tt.z - 0.02 * s], 0.036 * s, 0.032 * s, {
      bones: [[0, B(`foot.${side}`)], [0.62, B(`foot.${side}`)], [0.8, B(`toe.${side}`)]], group: `foot.${side}`, k: 0.03 * s,
    }));
    P(cone(v3(an), [heel.x, heel.y + 0.025 * s, heel.z + 0.07 * s], 0.038 * s, 0.036 * s, { bones: [[0, B(`foot.${side}`)]], group: `foot.${side}`, k: 0.035 * s }));
  }
  // --- neck (disappears into the head mesh).
  P(cone([0, shoulderY - 0.03 * s, -0.028 * s], [0, chinY + 0.06 * s, -0.012 * s], (0.064 + 0.022 * f + 0.014 * m) * s, (0.056 + 0.016 * f + 0.006 * m) * s, {
    bones: [[0, B('chest')], [0.3, B('neck')], [0.72, B('neck')], [0.95, B('head')]], group: 'neck', k: 0.055 * s,
  }));
  return prims;
}

/** Hand primitives for one side (world space). Includes a forearm stub for the overlap. */
export function handPrimitives(p, rig, side, forearmPrim) {
  const dims = rig.dims;
  const hf = handFrame(dims, side);
  const hs = dims.handScale;
  const B = (n) => rig.boneIndex.get(n);
  const W = (c) => v3(handToWorld(hf, hs, c));
  const f = p.fat;
  const prims = [];
  const hb = B(`hand.${side}`);
  const rot = basisRot(v3(hf.palm), v3(hf.y), v3(hf.z));
  const ph = HAND.palm.half;
  const fatPad = 1 + f * 0.12;
  prims.push(box(W([0, HAND.palm.cy, 0]), [ph[0] * hs * fatPad, ph[1] * hs, ph[2] * hs], 0.018 * hs, { rot, bones: [[0, hb]], group: `hand.${side}`, k: 0.012 * hs }));
  // Heel of the palm and thenar (thumb muscle) pads give the chunky, soft hand silhouette.
  prims.push(ellipsoid(W([0.01, 0.03, 0.02]), [0.02 * hs * fatPad, 0.03 * hs, 0.026 * hs], { rot, bones: [[0, hb], [0, B(`thumb1.${side}`)]], group: `hand.${side}`, k: 0.015 * hs }));
  prims.push(ellipsoid(W([0.012, 0.035, -0.022]), [0.018 * hs * fatPad, 0.035 * hs, 0.02 * hs], { rot, bones: [[0, hb]], group: `hand.${side}`, k: 0.015 * hs }));
  // Wrist bridge into the forearm.
  prims.push(cone(W([0, -0.03, 0]), W([0, 0.02, 0]), forearmPrim.r2 * 1.0, forearmPrim.r2 * 1.04, { bones: [[0, B(`forearm.${side}`)], [0.6, hb]], group: `hand.${side}`, k: 0.02 * hs }));
  prims.push({ ...forearmPrim, group: `arm.${side}` });
  const chains = fingerChains();
  for (const fn of [...FINGERS, 'thumb']) {
    const pts = chains[fn].map((c) => W([c.x, c.y, c.z]));
    const r0 = (fn === 'thumb' ? HAND.thumb.r : HAND.fingers[fn].r) * hs * (1 + f * 0.1);
    for (let i = 0; i < 3; i++) {
      const bone = B(`${fn}${i + 1}.${side}`);
      const next = i < 2 ? B(`${fn}${i + 2}.${side}`) : bone;
      const prev = i > 0 ? B(`${fn}${i}.${side}`) : hb;
      const ra = r0 * (1 - i * 0.07);
      const rb = r0 * (1 - (i + 1) * 0.07) * (i === 2 ? 0.92 : 1);
      // The fingertip ends short of the bone tip by its radius so the rounded cap lands on it.
      let b = pts[i + 1];
      if (i === 2) b = lerp3({ x: pts[3][0], y: pts[3][1], z: pts[3][2] }, { x: pts[2][0], y: pts[2][1], z: pts[2][2] }, rb / Math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1], pts[3][2] - pts[2][2]));
      prims.push(cone(pts[i], b, ra, rb, {
        bones: [[0, prev], [0.18, bone], [0.85, bone], [1.0, next]], group: `hand.${side}`, k: (fn === 'thumb' && i === 0 ? 0.018 : 0.005) * hs, finger: fn, seg: i,
      }));
    }
    if (fn !== 'thumb') {
      // Knuckle bump on the back of the hand.
      const kb = handToWorld(hf, hs, [HAND.fingers[fn].base[0] - 0.011, HAND.fingers[fn].base[1] - 0.004, HAND.fingers[fn].base[2]]);
      prims.push(sphere(v3(kb), HAND.fingers[fn].r * hs * 0.9, { bones: [[0, hb], [0, B(`${fn}1.${side}`)]], group: `hand.${side}`, k: 0.012 * hs }));
    }
  }
  return { prims, frame: hf };
}

function boundsOf(prims, pad) {
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

/** Limb parameter for region queries: 0 at the shoulder/hip, 1 at the wrist/ankle. */
export function limbParam(rig, group, x, y, z) {
  const { j } = rig.dims;
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

const GROUP_IDS = REGION;

/**
 * Build the raw body: geometry arrays + per-vertex region data. Cached per human; garments
 * later choose which triangles stay visible (`cullBody`).
 */
export function buildBody(p, rig, { tier }) {
  const prims = bodyPrimitives(p, rig);
  const s = rig.dims.s;
  const h = ({ low: 0.03, medium: 0.022, high: 0.017, ultra: 0.014 }[tier.name] ?? 0.018) * s;
  const field = makeField(prims);
  const bodyMesh = polygonize(field, boundsOf(prims, 0.03), h);

  const parts = [];
  // Body: drop what lies past the wrist cut (hands are separate, finer meshes).
  const cut = 0.03 * rig.dims.handScale;
  const frames = { L: handFrame(rig.dims, 'L'), R: handFrame(rig.dims, 'R') };
  const along = (fr, x, y, z) => (x - fr.origin.x) * fr.y.x + (y - fr.origin.y) * fr.y.y + (z - fr.origin.z) * fr.y.z;
  {
    const P = bodyMesh.positions;
    const beyond = (i) => {
      const x = P[i * 3];
      const y = P[i * 3 + 1];
      const z = P[i * 3 + 2];
      const near = (fr) => Math.hypot(x - fr.origin.x, y - fr.origin.y, z - fr.origin.z) < 0.16 * s;
      return (near(frames.L) && along(frames.L, x, y, z) > -cut) || (near(frames.R) && along(frames.R, x, y, z) > -cut);
    };
    const res = filterMesh(bodyMesh.indices, P.length / 3, { position: { array: bodyMesh.positions, itemSize: 3 }, normal: { array: bodyMesh.normals, itemSize: 3 } }, (a, b, c) => !(beyond(a) && beyond(b) && beyond(c)));
    parts.push({ positions: res.attrs.position.array, normals: res.attrs.normal.array, indices: res.indices, prims, hand: null });
  }
  // Hands.
  const hh = ({ low: 0.009, medium: 0.0068, high: 0.0056, ultra: 0.0048 }[tier.name] ?? 0.006) * rig.dims.handScale;
  for (const side of ['L', 'R']) {
    const forearm = prims.find((q) => q.forearm === side);
    const { prims: hp, frame } = handPrimitives(p, rig, side, forearm);
    const hfField = makeField(hp);
    const bnd = boundsOf(hp.filter((q) => q !== hp[4]), 0.02);
    const mesh = polygonize(hfField, bnd, hh);
    const P = mesh.positions;
    const N = mesh.normals;
    const lo = -0.055 * rig.dims.handScale;
    const res = filterMesh(mesh.indices, P.length / 3, { position: { array: P, itemSize: 3 }, normal: { array: N, itemSize: 3 } }, (a, b, c) => {
      const ok = (i) => along(frame, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) > lo;
      return ok(a) && ok(b) && ok(c);
    });
    const RP = res.attrs.position.array;
    const RN = res.attrs.normal.array;
    // Inset ramp: the forearm stub sinks under the body's forearm surface.
    for (let i = 0; i < res.count; i++) {
      const a = along(frame, RP[i * 3], RP[i * 3 + 1], RP[i * 3 + 2]);
      const t = smoothstep(-cut, lo, a);
      const inset = t * 0.0035 * s;
      RP[i * 3] -= RN[i * 3] * inset;
      RP[i * 3 + 1] -= RN[i * 3 + 1] * inset;
      RP[i * 3 + 2] -= RN[i * 3 + 2] * inset;
    }
    parts.push({ positions: RP, normals: RN, indices: res.indices, prims: hp, hand: side, frame });
  }

  // Merge parts and compute per-vertex skin data.
  let vcount = 0;
  let icount = 0;
  for (const pt of parts) {
    vcount += pt.positions.length / 3;
    icount += pt.indices.length;
  }
  const position = new Float32Array(vcount * 3);
  const normal = new Float32Array(vcount * 3);
  const skinIndex = new Uint16Array(vcount * 4);
  const skinWeight = new Float32Array(vcount * 4);
  const mask = new Float32Array(vcount * 4); // redness, body hair, knuckles, nails
  const region = new Uint8Array(vcount);
  const limb = new Float32Array(vcount);
  const index = new Uint32Array(icount);
  let vo = 0;
  let io = 0;
  const { j } = rig.dims;
  for (const pt of parts) {
    const n = pt.positions.length / 3;
    position.set(pt.positions, vo * 3);
    normal.set(pt.normals, vo * 3);
    for (let i = 0; i < pt.indices.length; i++) index[io + i] = pt.indices[i] + vo;
    for (let i = 0; i < n; i++) {
      const x = pt.positions[i * 3];
      const y = pt.positions[i * 3 + 1];
      const z = pt.positions[i * 3 + 2];
      const w = primitiveWeights(pt.prims, x, y, z, pt.hand ? 0.006 * s : 0.02 * s);
      const vi = vo + i;
      for (let c = 0; c < 4; c++) {
        const e = w.weights[c];
        skinIndex[vi * 4 + c] = e ? e[0] : 0;
        skinWeight[vi * 4 + c] = e ? e[1] : 0;
      }
      const dom = pt.prims[w.dominant];
      const g = dom ? dom.group : 'torso';
      region[vi] = GROUP_IDS[g] ?? 0;
      limb[vi] = limbParam(rig, g, x, y, z);
      // Skin masks.
      let red = 0;
      let hair = 0;
      let knuckle = 0;
      let nail = 0;
      if (g.startsWith('leg')) {
        const kn = j[`shin.${g.slice(-1)}`];
        red = Math.max(0, 1 - Math.hypot(x - kn.x, y - kn.y, z - kn.z - 0.05 * s) / (0.06 * s)) * 0.6;
        hair = smoothstep(0.35, 0.6, limb[vi]) * 0.9 + 0.2;
      } else if (g.startsWith('arm')) {
        const el = j[`forearm.${g.slice(-1)}`];
        red = Math.max(0, 1 - Math.hypot(x - el.x, y - el.y, z - el.z + 0.04 * s) / (0.05 * s)) * 0.5;
        // Hair on the back/outer forearm.
        hair = smoothstep(0.5, 0.65, limb[vi]) * clamp(0.5 - pt.normals[i * 3 + 2] * 0.6, 0, 1);
      } else if (g === 'torso') {
        const cx = Math.abs(x);
        hair = (1 - smoothstep(0.03 * s, 0.12 * s, cx)) * smoothstep(0, 0.4, pt.normals[i * 3 + 2]) * (y > j.spine.y - 0.1 * s ? 1 : 0.6);
      }
      if (pt.hand) {
        const fr = pt.frame;
        const hs = rig.dims.handScale;
        const dx = x - fr.origin.x;
        const dy = y - fr.origin.y;
        const dz = z - fr.origin.z;
        const cp = (dx * fr.palm.x + dy * fr.palm.y + dz * fr.palm.z) / hs;
        const cy = (dx * fr.y.x + dy * fr.y.y + dz * fr.y.z) / hs;
        const cz = (dx * fr.z.x + dy * fr.z.y + dz * fr.z.z) / hs;
        // Knuckles: back of hand around the MCP joints.
        if (cp < -0.004) knuckle = clamp(1 - Math.abs(cy - 0.095) / 0.025, 0, 1) * clamp(1 - Math.abs(cz) / 0.05, 0, 1);
        hair = cp < -0.008 && cy < 0.08 ? 0.5 : 0;
        red = clamp((cy - 0.13) / 0.06, 0, 1) * 0.35 + knuckle * 0.25;
        if (dom && dom.finger && dom.seg === 2) {
          // Nail plate: dorsal side of the distal segment.
          const t = w.t;
          const nN = pt.normals;
          const nd = -(nN[i * 3] * fr.palm.x + nN[i * 3 + 1] * fr.palm.y + nN[i * 3 + 2] * fr.palm.z);
          nail = smoothstep(0.35, 0.65, t) * smoothstep(0.35, 0.7, nd);
        }
      }
      mask[vi * 4] = red;
      mask[vi * 4 + 1] = hair;
      mask[vi * 4 + 2] = knuckle;
      mask[vi * 4 + 3] = nail;
    }
    vo += n;
    io += pt.indices.length;
  }
  return { position, normal, skinIndex, skinWeight, mask, region, limb, index, prims, field };
}

/** Create the THREE geometry with a chosen subset of triangles (body culling under garments). */
export function bodyGeometry(raw, keepVertex) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(raw.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(raw.normal, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(raw.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(raw.skinWeight, 4));
  g.setAttribute('skinMask', new THREE.BufferAttribute(raw.mask, 4));
  const idx = [];
  const I = raw.index;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t];
    const b = I[t + 1];
    const c = I[t + 2];
    // A triangle disappears only when all its corners are covered → the visible edge always
    // sits under the garment hem.
    if (keepVertex && !keepVertex(a) && !keepVertex(b) && !keepVertex(c)) continue;
    idx.push(a, b, c);
  }
  g.setIndex(idx);
  return g;
}

export { primDist };
