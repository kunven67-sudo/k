// Character templates: build once, reshape per person.
//
// A template is the sculpt of an average person polygonized on a fine grid (sdf.js surface nets),
// decimated to the tier's triangle budget (decimate.js) and annotated once with everything that
// depends only on topology: skin weights, body regions, limb parameters, skin masks, clusters
// for fast projection. Creating a person is then cheap:
//   1. retarget: linear-blend the template vertices from the template's bind skeleton to the
//      person's bind skeleton (handles height, limb lengths, shoulder/hip width),
//   2. project: a few bounded Newton steps onto the person's own SDF (handles fat, muscle,
//      belly, chest, face sliders) — normals come straight from the field gradient.
// Templates are cached per tier for the whole session.

import * as THREE from 'three';
import { makeField, polygonize, projectVertex, primitiveWeights } from './sdf.js';
import { decimate } from './decimate.js';
import { buildRig, handFrame, FINGERS } from './rig.js';
import { bodyPrimitives, handPrimitives, boundsOf, limbParam, REGION } from './body.js';
import { normalizeParams, defaultParams } from './schema.js';
import { clamp, smoothstep } from '../core/util.js';

// The "average person" every template is sculpted from.
export const TEMPLATE_PARAMS = normalizeParams({
  ...defaultParams(), age: 35, height: 1.75, fat: 0.35, muscle: 0.4, shoulders: 0.5, chest: 0.35, waist: 0.45,
  hips: 0.5, belly: 0.35, legs: 0.5, handSize: 0.5,
});

// Triangle budgets per tier (before garments cull covered skin).
export const BUDGET = {
  low: { body: 2800, hand: 380, head: 2000, bodyH: 0.017, handH: 0.0055, headH: 0.0046 },
  medium: { body: 5200, hand: 760, head: 3300, bodyH: 0.014, handH: 0.0046, headH: 0.004 },
  high: { body: 8000, hand: 1200, head: 4600, bodyH: 0.013, handH: 0.0040, headH: 0.0036 },
  ultra: { body: 11000, hand: 1700, head: 6400, bodyH: 0.011, handH: 0.0036, headH: 0.0031 },
};

const cache = new Map();
export function getTemplate(kind, tierName, build) {
  const key = `${kind}|${tierName}`;
  let t = cache.get(key);
  if (!t) {
    const t0 = performance.now();
    t = build(tierName);
    t.buildMs = performance.now() - t0;
    cache.set(key, t);
  }
  return t;
}

// ---- helpers ---------------------------------------------------------------------------------

/** Project every vertex onto `field` using per-cluster culled sub-fields. */
export function projectAll(field, positions, normals, clusters, { reach = 0.05, maxStep = 0.03, iters = 3, eps = 0.0004, skip = null } = {}) {
  const n = positions.length / 3;
  // Cluster centers/radii from current positions.
  const nc = clusters.count;
  const cs = new Float64Array(nc * 4);
  for (let v = 0; v < n; v++) {
    const c = clusters.id[v];
    cs[c * 4] += positions[v * 3];
    cs[c * 4 + 1] += positions[v * 3 + 1];
    cs[c * 4 + 2] += positions[v * 3 + 2];
    cs[c * 4 + 3]++;
  }
  for (let c = 0; c < nc; c++) {
    const k = cs[c * 4 + 3] || 1;
    cs[c * 4] /= k;
    cs[c * 4 + 1] /= k;
    cs[c * 4 + 2] /= k;
  }
  const rad = new Float64Array(nc);
  for (let v = 0; v < n; v++) {
    const c = clusters.id[v];
    const d = Math.hypot(positions[v * 3] - cs[c * 4], positions[v * 3 + 1] - cs[c * 4 + 1], positions[v * 3 + 2] - cs[c * 4 + 2]);
    if (d > rad[c]) rad[c] = d;
  }
  const subs = new Array(nc);
  for (let c = 0; c < nc; c++) subs[c] = field.sub ? field.sub(cs[c * 4], cs[c * 4 + 1], cs[c * 4 + 2], rad[c] + Math.min(maxStep * iters, 0.03), reach) : field;
  for (let v = 0; v < n; v++) {
    if (skip && skip[v]) continue;
    projectVertex(subs[clusters.id[v]], positions, normals, v, maxStep, iters, eps);
  }
}

/** Spatial clusters (grid cells) so projection can use culled fields. */
export function makeClusters(positions, cell) {
  const n = positions.length / 3;
  const id = new Int32Array(n);
  const map = new Map();
  for (let v = 0; v < n; v++) {
    const k = `${Math.floor(positions[v * 3] / cell)},${Math.floor(positions[v * 3 + 1] / cell)},${Math.floor(positions[v * 3 + 2] / cell)}`;
    let c = map.get(k);
    if (c === undefined) map.set(k, (c = map.size));
    id[v] = c;
  }
  return { id, count: map.size };
}

function bindMatrices(rig) {
  const out = [];
  const m = new THREE.Matrix4();
  for (const b of rig.bones) {
    m.compose(rig.worldP[b.name], rig.worldQ[b.name], new THREE.Vector3(1, 1, 1));
    out.push(m.clone());
  }
  return out;
}

/** Retarget template vertices (bind pose of `from` rig) to the bind pose of `to` rig via LBS. */
export function retarget(tpl, fromMats, toMats, out = new Float32Array(tpl.positions.length)) {
  const nb = fromMats.length;
  const M = new Float64Array(nb * 12);
  const inv = new THREE.Matrix4();
  const r = new THREE.Matrix4();
  const used = new Uint8Array(nb);
  for (let i = 0; i < tpl.skinIndex.length; i++) used[tpl.skinIndex[i]] = 1;
  for (let b = 0; b < nb; b++) {
    if (!used[b]) continue;
    inv.copy(fromMats[b]).invert();
    r.multiplyMatrices(toMats[b], inv);
    const e = r.elements;
    M.set([e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], e[12], e[13], e[14]], b * 12);
  }
  const P = tpl.positions;
  const n = P.length / 3;
  for (let v = 0; v < n; v++) {
    const x = P[v * 3];
    const y = P[v * 3 + 1];
    const z = P[v * 3 + 2];
    let ox = 0;
    let oy = 0;
    let oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = tpl.skinWeight[v * 4 + k];
      if (!w) continue;
      const o = tpl.skinIndex[v * 4 + k] * 12;
      ox += w * (M[o] * x + M[o + 3] * y + M[o + 6] * z + M[o + 9]);
      oy += w * (M[o + 1] * x + M[o + 4] * y + M[o + 7] * z + M[o + 10]);
      oz += w * (M[o + 2] * x + M[o + 5] * y + M[o + 8] * z + M[o + 11]);
    }
    out[v * 3] = ox;
    out[v * 3 + 1] = oy;
    out[v * 3 + 2] = oz;
  }
  return out;
}

function weightsFromPrims(prims, positions, tau, resolve) {
  const n = positions.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const dominant = new Int32Array(n);
  const tparam = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const w = primitiveWeights(prims, positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2], tau);
    for (let c = 0; c < 4; c++) {
      const e = w.weights[c];
      skinIndex[v * 4 + c] = e ? resolve(e[0]) : 0;
      skinWeight[v * 4 + c] = e ? e[1] : 0;
    }
    dominant[v] = w.dominant;
    tparam[v] = w.t;
  }
  return { skinIndex, skinWeight, dominant, tparam };
}

// ---- body ------------------------------------------------------------------------------------

export function bodyTemplate(tierName) {
  return getTemplate('body', tierName, buildBodyTemplate);
}

function buildBodyTemplate(tierName) {
  const budget = BUDGET[tierName] || BUDGET.high;
  const p = TEMPLATE_PARAMS;
  const rig = buildRig(p);
  const { j, s } = rig.dims;
  const prims = bodyPrimitives(p, rig);
  const field = makeField(prims);
  const raw = polygonize(field, boundsOf(prims, 0.03), budget.bodyH);

  // Importance: joints keep more loops (they bend), toes are small features, the wrist region
  // under the hand stub is hidden.
  const nr = raw.positions.length / 3;
  const imp = new Float32Array(nr).fill(1);
  const near = (x, y, z, q, r) => 1 - smoothstep(r * 0.5, r, Math.hypot(x - q.x, y - q.y, z - q.z));
  for (let v = 0; v < nr; v++) {
    const x = raw.positions[v * 3];
    const y = raw.positions[v * 3 + 1];
    const z = raw.positions[v * 3 + 2];
    let w = 1;
    for (const side of ['L', 'R']) {
      w += 0.8 * near(x, y, z, j[`forearm.${side}`], 0.1 * s);
      w += 0.8 * near(x, y, z, j[`shin.${side}`], 0.12 * s);
      w += 0.5 * near(x, y, z, j[`upperarm.${side}`], 0.12 * s);
      w += 0.5 * near(x, y, z, j[`thigh.${side}`], 0.14 * s);
      if (y < 0.05 * s) w += 1.2;
    }
    w += 0.4 * near(x, y, z, j.neck, 0.1 * s);
    imp[v] = w;
  }
  const dec = decimate(raw.positions, raw.indices, { targetTris: budget.body, importance: imp });
  const positions = dec.positions;
  const normals = new Float32Array(positions.length);
  const clusters = makeClusters(positions, 0.08);
  projectAll(field, positions, normals, clusters, { iters: 3, maxStep: 0.01 });

  // Drop what lies past the wrist: the hand mesh (with its own forearm stub) takes over there.
  const frames = { L: handFrame(rig.dims, 'L'), R: handFrame(rig.dims, 'R') };
  const along = (fr, x, y, z) => (x - fr.origin.x) * fr.y.x + (y - fr.origin.y) * fr.y.y + (z - fr.origin.z) * fr.y.z;
  const WRIST_CUT = -0.02 * s;
  const inHand = (v) => {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    for (const fr of [frames.L, frames.R]) {
      if (Math.hypot(x - fr.origin.x, y - fr.origin.y, z - fr.origin.z) < 0.16 * s && along(fr, x, y, z) > WRIST_CUT) return true;
    }
    return false;
  };
  const idx = [];
  for (let t = 0; t < dec.indices.length; t += 3) {
    const a = dec.indices[t];
    const b = dec.indices[t + 1];
    const c = dec.indices[t + 2];
    if (inHand(a) && inHand(b) && inHand(c)) continue;
    idx.push(a, b, c);
  }

  const B = (i) => i; // body prims store bone indices already
  const W = weightsFromPrims(prims, positions, 0.022 * s, B);
  const n = positions.length / 3;
  const region = new Uint8Array(n);
  const limb = new Float32Array(n);
  const mask = new Float32Array(n * 4); // redness, body hair, knuckles, nails
  const torsoH = new Float32Array(n); // 0 at the hip joints, 1 at the shoulder joints
  const angle = new Float32Array(n); // around the vertical axis, 0 = front
  const hipY = rig.dims.hipY;
  const shY = j['upperarm.L'].y;
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const dom = prims[W.dominant[v]];
    const g = dom ? dom.group : 'torso';
    region[v] = REGION[g] ?? 0;
    limb[v] = limbParam(j, g, x, y, z);
    torsoH[v] = (y - hipY) / (shY - hipY);
    angle[v] = Math.atan2(x, z);
    let red = 0;
    let hair = 0;
    if (g.startsWith('leg')) {
      const kn = j[`shin.${g.slice(-1)}`];
      red = Math.max(0, 1 - Math.hypot(x - kn.x, y - kn.y, z - kn.z - 0.05 * s) / (0.065 * s)) * 0.6;
      hair = smoothstep(0.3, 0.6, limb[v]) * 0.8 + 0.25;
    } else if (g.startsWith('arm')) {
      const el = j[`forearm.${g.slice(-1)}`];
      red = Math.max(0, 1 - Math.hypot(x - el.x, y - el.y, z - el.z + 0.04 * s) / (0.05 * s)) * 0.5;
      hair = smoothstep(0.5, 0.68, limb[v]) * clamp(0.6 - normals[v * 3 + 2] * 0.6, 0, 1);
    } else if (g === 'torso') {
      const cx = Math.abs(x);
      hair = (1 - smoothstep(0.03 * s, 0.13 * s, cx)) * smoothstep(0, 0.4, normals[v * 3 + 2]) * (y > j.spine.y - 0.1 * s ? 1 : 0.65);
    } else if (g.startsWith('foot')) {
      hair = 0.2;
    }
    mask[v * 4] = red;
    mask[v * 4 + 1] = hair;
  }
  const tpl = {
    kind: 'body', rig, prims, positions, normals, index: new Uint32Array(idx), skinIndex: W.skinIndex, skinWeight: W.skinWeight,
    region, limb, mask, torsoH, angle, clusters, bind: bindMatrices(rig), polyTris: raw.indices.length / 3,
  };
  return tpl;
}

/** Shape the body template for a person. Returns world-bind-space positions + normals. */
export function shapeBody(tpl, p, rig) {
  const prims = bodyPrimitives(p, rig);
  const field = makeField(prims);
  const positions = retarget(tpl, tpl.bind, bindMatrices(rig));
  const normals = new Float32Array(positions.length);
  projectAll(field, positions, normals, tpl.clusters, { iters: 3, maxStep: 0.04, reach: 0.03 });
  return { positions, normals, prims, field };
}

// ---- hands -----------------------------------------------------------------------------------

export function handTemplate(tierName) {
  return getTemplate('hand', tierName, buildHandTemplate);
}

const HAND_BONES = ['forearm', 'hand', ...[...FINGERS, 'thumb'].flatMap((f) => [1, 2, 3].map((i) => `${f}${i}`))];

function buildHandTemplate(tierName) {
  const budget = BUDGET[tierName] || BUDGET.high;
  const p = TEMPLATE_PARAMS;
  const prims = handPrimitives(p);
  const field = makeField(prims);
  const bnd = boundsOf(prims, 0.01);
  bnd.min[1] = Math.max(bnd.min[1], -0.075);
  const raw = polygonize(field, bnd, budget.handH);
  const nr = raw.positions.length / 3;
  const imp = new Float32Array(nr);
  for (let v = 0; v < nr; v++) {
    const y = raw.positions[v * 3 + 1];
    // Fingers matter most; the stub (inside the forearm) least.
    imp[v] = y < -0.01 ? 0.5 : y > 0.085 ? 1.6 : 1.1;
  }
  const dec = decimate(raw.positions, raw.indices, { targetTris: budget.hand, importance: imp });
  const positions = dec.positions;
  const normals = new Float32Array(positions.length);
  projectAll(field, positions, normals, makeClusters(positions, 0.03), { iters: 3, maxStep: 0.003 });
  // Remove the stub's far end (it is fully inside the forearm).
  const idx = [];
  for (let t = 0; t < dec.indices.length; t += 3) {
    const ys = [0, 1, 2].map((k) => positions[dec.indices[t + k] * 3 + 1]);
    if (Math.max(...ys) < -0.062) continue;
    idx.push(dec.indices[t], dec.indices[t + 1], dec.indices[t + 2]);
  }
  const W = weightsFromPrims(prims, positions, 0.0055, (name) => HAND_BONES.indexOf(name));
  const n = positions.length / 3;
  const mask = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const dom = prims[W.dominant[v]];
    let knuckle = 0;
    let nail = 0;
    if (x < -0.004) knuckle = clamp(1 - Math.abs(y - 0.092) / 0.024, 0, 1) * clamp(1 - Math.abs(z) / 0.05, 0, 1);
    const hair = x < -0.008 && y < 0.075 && y > -0.02 ? 0.5 : 0;
    const red = clamp((y - 0.13) / 0.06, 0, 1) * 0.35 + knuckle * 0.25;
    if (dom && dom.finger && dom.seg === 2) {
      const t = W.tparam[v];
      // Nail plate: dorsal (-x) side of the distal segment.
      nail = smoothstep(0.3, 0.6, t) * smoothstep(0.35, 0.7, -normals[v * 3]);
      if (dom.finger === 'thumb') nail = smoothstep(0.3, 0.6, t) * smoothstep(0.3, 0.7, -normals[v * 3] * 0.7 + normals[v * 3 + 2] * 0.5);
    }
    mask[v * 4] = red;
    mask[v * 4 + 1] = hair;
    mask[v * 4 + 2] = knuckle;
    mask[v * 4 + 3] = nail;
  }
  return { kind: 'hand', prims, positions, normals, index: new Uint32Array(idx), skinIndex: W.skinIndex, skinWeight: W.skinWeight, boneNames: HAND_BONES, mask, polyTris: raw.indices.length / 3 };
}

/**
 * Place the canonical hand template on a person's side. The wrist stub is refitted to the
 * person's forearm: it starts just inside the forearm surface and ends just outside it, so the
 * crossing line sits at the wrist crease and the body's cut edge is hidden.
 */
export function shapeHand(tpl, p, rig, side, forearmPrim) {
  const fr = handFrame(rig.dims, side);
  const hs = rig.dims.handScale;
  const n = tpl.positions.length / 3;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const fatPad = (p.fat - TEMPLATE_PARAMS.fat) * 0.0012;
  // Forearm radius along the hand axis (a = signed distance from the wrist joint, world m).
  const L = Math.sqrt(forearmPrim.l2);
  const forearmR = (a) => {
    const t = clamp((L + a) / L, 0, 1);
    return forearmPrim.r1 + (forearmPrim.r2 - forearmPrim.r1) * t;
  };
  const stubR0 = (a) => 0.034 + (0.033 - 0.034) * ((a + 0.07) / 0.085); // template stub radius (canonical)
  const flip = side === 'R';
  for (let v = 0; v < n; v++) {
    let x = tpl.positions[v * 3];
    let y = tpl.positions[v * 3 + 1];
    let z = tpl.positions[v * 3 + 2];
    const nx = tpl.normals[v * 3];
    const ny = tpl.normals[v * 3 + 1];
    const nz = tpl.normals[v * 3 + 2];
    x += nx * fatPad / hs;
    y += ny * fatPad / hs;
    z += nz * fatPad / hs;
    if (y < 0.012) {
      // Stub refit (canonical radial distance from the y axis).
      const a = y * hs;
      const rho = Math.hypot(x, z);
      const target = forearmR(Math.min(a, 0)) / hs + (-0.0016 + 0.0028 * smoothstep(-0.07, -0.018, a)) / hs;
      const k = 1 + (target / stubR0(y) - 1) * (1 - smoothstep(-0.004, 0.012, y));
      if (rho > 1e-6) {
        x *= k;
        z *= k;
      }
    }
    positions[v * 3] = fr.origin.x + (fr.palm.x * x + fr.y.x * y + fr.z.x * z) * hs;
    positions[v * 3 + 1] = fr.origin.y + (fr.palm.y * x + fr.y.y * y + fr.z.y * z) * hs;
    positions[v * 3 + 2] = fr.origin.z + (fr.palm.z * x + fr.y.z * y + fr.z.z * z) * hs;
    normals[v * 3] = fr.palm.x * nx + fr.y.x * ny + fr.z.x * nz;
    normals[v * 3 + 1] = fr.palm.y * nx + fr.y.y * ny + fr.z.y * nz;
    normals[v * 3 + 2] = fr.palm.z * nx + fr.y.z * ny + fr.z.z * nz;
  }
  // Mirrored frame → flip winding so faces still point outward.
  let index = tpl.index;
  if (flip) {
    index = new Uint32Array(tpl.index.length);
    for (let t = 0; t < index.length; t += 3) {
      index[t] = tpl.index[t];
      index[t + 1] = tpl.index[t + 2];
      index[t + 2] = tpl.index[t + 1];
    }
  }
  const map = tpl.boneNames.map((b) => rig.boneIndex.get(`${b}.${side}`));
  return { positions, normals, index, boneMap: map };
}
