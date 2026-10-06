// Procedural head: sculpt, template, per-person shaping, eyelids, eyeballs, teeth and tongue.
//
// The head is one signed-distance sculpt in *head space* (origin at the head centre, +Y up, +Z
// forward, +X = the character's left, meters at scale 1 where chin→crown = HEAD_UNIT). It holds
// cranium, face planes, jaw, cheeks, brow ridge, a layered nose with real nostrils, lips with a
// mouth slit and a mouth bag behind it, eye sockets, ears and a neck stub that overlaps the body.
//
// Like the body it is polygonized once into a decimated *template*; each person is the template
// warped by facial landmarks (eye centres/size, mouth width, nose, ears) and projected onto their
// own sculpt. Topology-only data is computed once on the template:
//   - head UVs (direction from the head centre → face-magnified equirect) for the face paint,
//   - face-bone skin weights (jaw, lips, mouth corners, cheeks, brows, nose),
//   - masks (ears, mouth-bag cavity, scalp).
// Eyes sit in the sockets as separate eyeballs. Eyelids are *lid shells*: thin spherical caps
// around the eyeball whose margin is weighted to a lid bone, so blinking/tracking is a rotation
// and the shell stretches like real skin while its outer edge stays tucked into the socket.

import * as THREE from 'three';
import { makeField, polygonize, primDist } from './sdf.js';
import { HEAD_UNIT, dirToUV, faceLayout, headPrimitives, earPrimitives, findEyes, FACE_BONES, faceBonePositions, JAW_BIND_OPEN } from './headsculpt.js';
import { decimate } from './decimate.js';
import { getTemplate, projectAll, makeClusters, BUDGET, TEMPLATE_PARAMS } from './template.js';
import { clamp, smoothstep, lerp } from '../core/util.js';

const { sin, cos, atan2, sqrt, abs, PI, exp, max, min } = Math;
const D2R = PI / 180;

// ---- template ---------------------------------------------------------------------------------

export function headTemplate(tierName) {
  return getTemplate('head', tierName, buildHeadTemplate);
}

function buildHeadTemplate(tierName) {
  const budget = BUDGET[tierName] || BUDGET.high;
  const p = TEMPLATE_PARAMS;
  const L = faceLayout(p);
  findEyes(p, L);
  const prims = headPrimitives(p, L);
  const field = makeField(prims);
  const raw = polygonize(field, { min: [-0.13, -0.235, -0.16], max: [0.13, 0.175, 0.19] }, budget.headH);
  // Importance: face features first; the neck stub and the back of the skull least.
  const nr = raw.positions.length / 3;
  const imp = new Float32Array(nr);
  const eyeC = L.eyes.map((e) => e.c);
  for (let v = 0; v < nr; v++) {
    const x = raw.positions[v * 3];
    const y = raw.positions[v * 3 + 1];
    const z = raw.positions[v * 3 + 2];
    let w = 1;
    const front = smoothstep(0.02, 0.09, z);
    w += 1.0 * front * (1 - smoothstep(0.03, 0.09, abs(y + 0.04)));
    for (const c of eyeC) w += 2.0 * (1 - smoothstep(0.02, 0.036, sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + (z - c.z) ** 2)));
    w += 2.2 * (1 - smoothstep(0.02, 0.05, sqrt((x / 1.4) ** 2 + (y - L.mouthY) ** 2 + ((z - 0.1) * 0.8) ** 2)));
    w += 1.3 * (1 - smoothstep(0.012, 0.03, sqrt(x * x + (y - L.noseTipY + 0.008) ** 2 + (z - L.noseTipZ + 0.012) ** 2)));
    if (y < -0.17) w *= 0.45;
    if (z < -0.06 && y > -0.08) w *= 0.7;
    imp[v] = w;
  }
  const dec = decimate(raw.positions, raw.indices, { targetTris: budget.head, importance: imp, lengthWeight: 0.004 });
  const positions = dec.positions;
  const normals = new Float32Array(positions.length);
  const clusters = makeClusters(positions, 0.03);
  projectAll(field, positions, normals, clusters, { iters: 3, maxStep: 0.003, reach: 0.012 });
  // Drop the bottom of the neck stub (inside the body).
  const keepIdx = [];
  for (let t = 0; t < dec.indices.length; t += 3) {
    const ys = [0, 1, 2].map((k) => positions[dec.indices[t + k] * 3 + 1]);
    if (max(...ys) < -0.2) continue;
    keepIdx.push(dec.indices[t], dec.indices[t + 1], dec.indices[t + 2]);
  }
  const n = positions.length / 3;
  const group = classify(prims, positions);
  const uv = new Float32Array(n * 2);
  const flags = new Float32Array(n * 4); // face paint mask, cavity, ear, scalp
  const tmpUV = [0, 0];
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    dirToUV(x, y + 0.02, z, tmpUV);
    uv[v * 2] = tmpUV[0];
    uv[v * 2 + 1] = tmpUV[1];
    const g = group[v];
    // Cavity: inside the mouth bag / deep in the slit; depth behind the lips darkens.
    let cav = 0;
    if (g === 'bag' || g === 'slit') cav = clamp((0.108 - z) / 0.022, 0, 1);
    if (g === 'nostril') cav = 0.75;
    flags[v * 4] = 1;
    flags[v * 4 + 1] = cav;
    flags[v * 4 + 2] = 0;
    flags[v * 4 + 3] = 0;
  }
  const weights = headWeights(L, positions, group);
  const ear = earTemplate(tierName);
  const tpl = {
    kind: 'head', L, prims, positions, normals, index: new Uint32Array(keepIdx), uv, flags, group, clusters, ear,
    skinIndex: weights.skinIndex, skinWeight: weights.skinWeight, boneNames: FACE_BONES, polyTris: raw.indices.length / 3,
  };
  splitUVSeam(tpl);
  return tpl;
}

/**
 * The head UV is an equirect that wraps at the back of the skull. Triangles spanning the wrap
 * get duplicated vertices with u + 1 (textures repeat in u), so nothing smears across the seam.
 */
function splitUVSeam(tpl) {
  const n = tpl.positions.length / 3;
  const dup = new Map();
  const extra = [];
  const I = tpl.index;
  for (let t = 0; t < I.length; t += 3) {
    const us = [0, 1, 2].map((k) => tpl.uv[I[t + k] * 2]);
    if (Math.max(...us) - Math.min(...us) < 0.5) continue;
    for (let k = 0; k < 3; k++) {
      const v = I[t + k];
      if (tpl.uv[v * 2] >= 0.5) continue;
      let d = dup.get(v);
      if (d === undefined) {
        d = n + extra.length;
        dup.set(v, d);
        extra.push(v);
      }
      I[t + k] = d;
    }
  }
  if (!extra.length) return;
  const grow = (arr, k) => {
    const out = new arr.constructor((n + extra.length) * k);
    out.set(arr);
    extra.forEach((v, i) => {
      for (let c = 0; c < k; c++) out[(n + i) * k + c] = arr[v * k + c];
    });
    return out;
  };
  tpl.positions = grow(tpl.positions, 3);
  tpl.normals = grow(tpl.normals, 3);
  tpl.uv = grow(tpl.uv, 2);
  for (let i = 0; i < extra.length; i++) tpl.uv[(n + i) * 2] += 1;
  tpl.flags = grow(tpl.flags, 4);
  tpl.skinIndex = grow(tpl.skinIndex, 4);
  tpl.skinWeight = grow(tpl.skinWeight, 4);
  tpl.clusters = { id: grow(tpl.clusters.id, 1), count: tpl.clusters.count };
  for (const v of extra) tpl.group.push(tpl.group[v]);
}

function classify(prims, positions) {
  const n = positions.length / 3;
  const group = new Array(n);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    let best = 1e9;
    let g = 'skull';
    for (const q of prims) {
      const d = abs(primDist(q, x, y, z));
      if (d < best) {
        best = d;
        g = q.group;
      }
    }
    group[v] = g;
  }
  return group;
}

/** Canonical left ear (see earPrimitives), polygonized finely and decimated. */
function earTemplate(tierName) {
  const budget = BUDGET[tierName] || BUDGET.high;
  const prims = earPrimitives(0.2);
  const field = makeField(prims);
  const raw = polygonize(field, { min: [-0.008, -0.045, -0.02], max: [0.024, 0.045, 0.04] }, tierName === 'low' ? 0.0026 : 0.0018);
  const target = { low: 120, medium: 220, high: 320, ultra: 440 }[tierName] ?? 320;
  // Keep only what is outside the head (x > -0.002); the root bridge is buried.
  const dec = decimate(raw.positions, raw.indices, { targetTris: target, lengthWeight: 0.004 });
  const positions = dec.positions;
  const normals = new Float32Array(positions.length);
  projectAll(field, positions, normals, makeClusters(positions, 0.02), { iters: 3, maxStep: 0.002, reach: 0.008 });
  const idx = [];
  for (let t = 0; t < dec.indices.length; t += 3) {
    const xs = [0, 1, 2].map((k) => positions[dec.indices[t + k] * 3]);
    if (max(...xs) < -0.006) continue;
    idx.push(dec.indices[t], dec.indices[t + 1], dec.indices[t + 2]);
  }
  return { positions, normals, index: new Uint32Array(idx) };
}

/** Place a canonical ear on the head (head space). side: +1 left, -1 right. */
export function shapeEar(tpl, L, side) {
  const fr = earFrameOf(L, side);
  const sz = L.earSize;
  const n = tpl.positions.length / 3;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const a = tpl.positions[v * 3];
    const b = tpl.positions[v * 3 + 1] * sz;
    const c = tpl.positions[v * 3 + 2] * sz;
    const ax = a * (0.85 + 0.15 * sz);
    positions[v * 3] = fr.root.x + fr.n.x * ax + fr.up.x * b + fr.back.x * c;
    positions[v * 3 + 1] = fr.root.y + fr.n.y * ax + fr.up.y * b + fr.back.y * c;
    positions[v * 3 + 2] = fr.root.z + fr.n.z * ax + fr.up.z * b + fr.back.z * c;
    const na = tpl.normals[v * 3];
    const nb = tpl.normals[v * 3 + 1];
    const nc = tpl.normals[v * 3 + 2];
    normals[v * 3] = fr.n.x * na + fr.up.x * nb + fr.back.x * nc;
    normals[v * 3 + 1] = fr.n.y * na + fr.up.y * nb + fr.back.y * nc;
    normals[v * 3 + 2] = fr.n.z * na + fr.up.z * nb + fr.back.z * nc;
  }
  let index = tpl.index;
  // Canonical ear space (x out, y up, z back) is a mirror of head space for the LEFT ear, so the
  // left ear needs its winding flipped and the right one doesn't.
  if (side > 0) {
    index = new Uint32Array(tpl.index.length);
    for (let t = 0; t < index.length; t += 3) {
      index[t] = tpl.index[t];
      index[t + 1] = tpl.index[t + 2];
      index[t + 2] = tpl.index[t + 1];
    }
  }
  return { positions, normals, index };
}

/**
 * Face-bone weights (indices into FACE_BONES). Base layer: head / jaw / neck split along the jaw
 * hinge line and the mouth slit; additive gaussian deformers on top.
 */
function headWeights(L, positions, group) {
  const n = positions.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const FB = faceBonePositions(L);
  const bi = (name) => FACE_BONES.indexOf(name);
  const g3 = (x, y, z, c, sx, sy, sz) => exp(-(((x - c[0]) / sx) ** 2 + ((y - c[1]) / sy) ** 2 + ((z - c[2]) / sz) ** 2) * 0.5);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const gr = group[v];
    // Jaw region: below a line from the mouth slit back to the jaw hinge under the ear.
    const hingeY = -0.04;
    const line = lerp(L.mouthY, hingeY, smoothstep(0.1, -0.03, z));
    let jaw = smoothstep(0.004, -0.008, y - line);
    if (gr === 'lipD') jaw = 1;
    if (gr === 'lipU') jaw = 0;
    if (gr === 'slit' || gr === 'bag') jaw = y < L.mouthY - 0.001 ? 1 : 0;
    // Cheeks stretch between skull and jaw.
    jaw *= 1 - 0.45 * (1 - smoothstep(0.03, 0.06, abs(abs(x) - 0.06))) * smoothstep(-0.06, -0.1, y) * 0;
    // Neck stub: blend to the neck bone below the jaw line at the back/underside.
    const neck = gr === 'neck' || (y < -0.15 && z < 0.0) ? smoothstep(-0.13, -0.22, y + 0.08 * smoothstep(0.0, 0.06, z)) : 0;
    jaw *= 1 - neck;
    // Under-chin skin only follows the jaw partly (it stretches toward the neck).
    if (y < -0.13 && z < 0.04) jaw *= smoothstep(-0.04, 0.04, z) * 0.6 + 0.4;
    const W = new Map();
    const addW = (name, w) => {
      if (w > 1e-3) W.set(bi(name), (W.get(bi(name)) || 0) + w);
    };
    const face = [];
    const ear = gr.startsWith('ear');
    if (!ear && gr !== 'neck') {
      const upper = jaw < 0.5;
      // Lips.
      if (upper) face.push(['lip.U', 0.95 * g3(x, y, z, FB['lip.U'], 0.016, 0.009, 0.014) * (y > L.mouthY - 0.002 ? 1 : 0)]);
      else face.push(['lip.D', 0.95 * g3(x, y, z, FB['lip.D'], 0.015, 0.01, 0.014) * (y < L.mouthY + 0.002 ? 1 : 0)]);
      for (const s of ['L', 'R']) {
        face.push([`corner.${s}`, 0.9 * g3(x, y, z, FB[`corner.${s}`], 0.012, 0.012, 0.016)]);
        face.push([`cheek.${s}`, 0.7 * g3(x, y, z, FB[`cheek.${s}`], 0.022, 0.02, 0.02)]);
        if (y > L.eyeY + 0.012) {
          face.push([`brow.in.${s}`, 0.9 * g3(x, y, z, FB[`brow.in.${s}`], 0.013, 0.014, 0.03) * (s === 'L' ? smoothstep(-0.006, 0.004, x) : smoothstep(0.006, -0.004, x))]);
          face.push([`brow.out.${s}`, 0.9 * g3(x, y, z, FB[`brow.out.${s}`], 0.017, 0.015, 0.03)]);
        }
      }
      face.push(['nose', 0.85 * g3(x, y, z, FB.nose, 0.016, 0.01, 0.014)]);
    }
    let fsum = 0;
    for (const [, w] of face) fsum += w;
    const fscale = fsum > 0.92 ? 0.92 / fsum : 1;
    for (const [name, w] of face) addW(name, w * fscale);
    const rest = 1 - min(0.92, fsum);
    addW('head', rest * (1 - jaw) * (1 - neck));
    addW('jaw', rest * jaw);
    addW('neck', rest * neck);
    const arr = [...W.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    let sum = 0;
    for (const e of arr) sum += e[1];
    for (let k = 0; k < 4; k++) {
      skinIndex[v * 4 + k] = arr[k] ? arr[k][0] : 0;
      skinWeight[v * 4 + k] = arr[k] ? arr[k][1] / sum : 0;
    }
  }
  return { skinIndex, skinWeight };
}

// ---- per person -------------------------------------------------------------------------------

/**
 * Warp the template to a person's landmarks, then project onto their sculpt. Ears, the mouth bag
 * and the slit are warp-only (their thin/concave shapes must not snap across). Returns head-space
 * positions + normals.
 */
export function shapeHead(tpl, p, L, { neckR }) {
  const L0 = tpl.L;
  const n = tpl.positions.length / 3;
  const pos = new Float32Array(n * 3);
  const P0 = tpl.positions;
  const eyes0 = L0.eyes;
  const eyes1 = L.eyes;
  const mouthC = [0, L0.mouthY, 0.1];
  const mwRatio = L.mouthHalfW / L0.mouthHalfW;
  const fwr = L.fw / L0.fw - 1;
  const g = (d2, s) => exp(-d2 / (2 * s * s));
  for (let v = 0; v < n; v++) {
    const x = P0[v * 3];
    const y = P0[v * 3 + 1];
    const z = P0[v * 3 + 2];
    let dx = x * fwr + x * (L.jw / L0.jw - 1) * smoothstep(-0.03, -0.09, y);
    let dy = 0;
    let dz = 0;
    // Eyes: follow the eye centre, scale with the eye radius.
    for (let k = 0; k < 2; k++) {
      const c0 = eyes0[k].c;
      const c1 = eyes1[k].c;
      const d2 = (x - c0.x) ** 2 + (y - c0.y) ** 2 + (z - c0.z) ** 2;
      const w = g(d2, 0.017);
      const sc = eyes1[k].R / eyes0[k].R - 1;
      dx += w * (c1.x - c0.x - x * fwr + (x - c0.x) * sc);
      dy += w * (c1.y - c0.y + (y - c0.y) * sc);
      dz += w * (c1.z - c0.z + (z - c0.z) * sc);
    }
    // Mouth width (everything around the slit and bag).
    {
      const d2 = (x / 1.5) ** 2 + (y - mouthC[1]) ** 2 + (z - mouthC[2]) ** 2;
      dx += g(d2, 0.024) * x * (mwRatio - 1 - fwr);
    }
    // Nose tip follows the nose size/tip sliders.
    {
      const d2 = x * x + (y - L0.noseTipY) ** 2 + (z - L0.noseTipZ) ** 2;
      const w = g(d2, 0.015);
      dy += w * (L.noseTipY - L0.noseTipY);
      dz += w * (L.noseTipZ - L0.noseTipZ);
    }
    pos[v * 3] = x + dx;
    pos[v * 3 + 1] = y + dy;
    pos[v * 3 + 2] = z + dz;
  }
  const prims = headPrimitives(p, L, { neckR });
  const field = makeField(prims);
  const normals = new Float32Array(n * 3);
  const skip = new Uint8Array(n);
  for (let v = 0; v < n; v++) if (tpl.group[v] === 'slit') skip[v] = 1;
  projectAll(field, pos, normals, tpl.clusters, { iters: 3, maxStep: 0.008, reach: 0.012, skip, eps: 0.0002 });
  for (let v = 0; v < n; v++) {
    if (!skip[v]) continue;
    normals[v * 3] = tpl.normals[v * 3];
    normals[v * 3 + 1] = tpl.normals[v * 3 + 1];
    normals[v * 3 + 2] = tpl.normals[v * 3 + 2];
  }
  return { positions: pos, normals, field };
}

function earFrameOf(L, side) {
  const out = L.earOut;
  const root = new THREE.Vector3(side * L.earRoot[0], L.earRoot[1], L.earRoot[2]);
  const n = new THREE.Vector3(side, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), side * -out).normalize();
  const up = new THREE.Vector3(0, 1, 0.22).normalize();
  const back = new THREE.Vector3().crossVectors(n, up).multiplyScalar(-side).normalize();
  return { root, n, up, back };
}

// ---- eyelids ----------------------------------------------------------------------------------

/**
 * Lid shell for one eye ('upper' | 'lower'), head space. Rows: a rounded margin (touching the
 * eyeball, then the lid front edge where lashes grow) followed by skin rows that flare outward
 * until they are buried in the socket wall. Weight 1 → lid bone at the margin, fading to the head
 * at the buried edge so the shell stretches instead of sliding.
 * Returns {positions, normals, uv, lidWeight, index, lashLine: [Vector3...]} in head space.
 */
export function lidShell(L, eye, which, tierName) {
  const up = which === 'upper';
  const R = eye.R;
  const cols = tierName === 'low' ? 14 : tierName === 'medium' ? 20 : 28;
  const azMax = L.lidHalfW + 0.32;
  // Row profile: [radius offset, elevation offset from the margin (rad), lid weight]
  // The socket hole edge sits ~0.27 rad (upper) / 0.2 rad (lower) beyond the margin; rows past
  // it are buried in solid face, and their falling weights let the lid stretch when it closes.
  const rows = [
    [0.0004, -0.02, 1],
    [0.0012, 0.0, 1],
    [0.0024, 0.035, 1],
    [0.003, 0.11, 1],
    [0.0034, 0.2, 0.92],
    [0.0038, 0.29, 0.62],
    [0.0048, 0.4, 0.35],
    [0.006, 0.55, 0.14],
    [0.0072, 0.72, 0],
  ];
  if (!up) {
    rows.length = 0;
    rows.push([0.0004, -0.02, 1], [0.0012, 0, 1], [0.0023, 0.035, 1], [0.0029, 0.11, 0.95], [0.0034, 0.21, 0.6], [0.0045, 0.32, 0.3], [0.006, 0.46, 0.1], [0.0072, 0.6, 0]);
  }
  const nr = rows.length;
  const positions = new Float32Array(nr * (cols + 1) * 3);
  const lidWeight = new Float32Array(nr * (cols + 1));
  const lashLine = [];
  const P = new THREE.Vector3();
  for (let i = 0; i < nr; i++) {
    const [dr, del, w] = rows[i];
    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * 2 - 1;
      const az = Math.sign(u) * Math.pow(abs(u), 0.85) * azMax;
      const inside = abs(az) <= L.lidHalfW;
      let m = up ? eye.upper(az) : eye.lower(az);
      if (!inside) m = 0;
      // Beyond the corners the two shells meet at el = 0 and keep covering the socket.
      const el = up ? m + del : m - del;
      // Corners: radius grows a little so upper and lower don't z-fight where they overlap.
      const cornerLift = smoothstep(0.85, 1.25, abs(az) / L.lidHalfW) * 0.0012 * (up ? 1 : 0);
      eye.fromLocal(R + dr + cornerLift, az, el, P);
      const k = i * (cols + 1) + c;
      positions[k * 3] = P.x;
      positions[k * 3 + 1] = P.y;
      positions[k * 3 + 2] = P.z;
      // Weight fades toward the canthi so corners stay anchored.
      const cornerFix = 1 - smoothstep(0.75, 1.15, abs(az) / L.lidHalfW);
      lidWeight[k] = w * cornerFix;
      if (i === 2 && abs(az) < L.lidHalfW * 0.96) lashLine.push({ p: P.clone(), az, k });
    }
  }
  const index = [];
  for (let i = 0; i < nr - 1; i++) {
    for (let c = 0; c < cols; c++) {
      const a = i * (cols + 1) + c;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      // Winding: faces point away from the eyeball centre.
      if (up === (eye.side > 0)) index.push(a, d, b, b, d, e);
      else index.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // Make sure normals point outward from the eye centre (winding conventions are easy to flip).
  const nrm = g.attributes.normal.array;
  let flip = 0;
  for (let k = 0; k < positions.length / 3; k++) {
    const ox = positions[k * 3] - eye.c.x;
    const oy = positions[k * 3 + 1] - eye.c.y;
    const oz = positions[k * 3 + 2] - eye.c.z;
    flip += ox * nrm[k * 3] + oy * nrm[k * 3 + 1] + oz * nrm[k * 3 + 2];
  }
  let idx = index;
  if (flip < 0) {
    idx = [];
    for (let t = 0; t < index.length; t += 3) idx.push(index[t], index[t + 2], index[t + 1]);
    for (let k = 0; k < nrm.length; k++) nrm[k] = -nrm[k];
  }
  const uv = new Float32Array((positions.length / 3) * 2);
  const t = [0, 0];
  for (let k = 0; k < positions.length / 3; k++) {
    dirToUV(positions[k * 3], positions[k * 3 + 1] + 0.02, positions[k * 3 + 2], t);
    uv[k * 2] = t[0];
    uv[k * 2 + 1] = t[1];
  }
  return { positions, normals: new Float32Array(nrm), uv, lidWeight, index: new Uint32Array(idx), lashLine, rows: nr, cols };
}

// ---- eyeballs, teeth, tongue ------------------------------------------------------------------

/**
 * Unit eyeball (radius 1, looking down +Z) with a cornea bulge. UV: planar front projection so
 * the iris texture is centred (u,v = 0.5 + x/2, 0.5 + y/2). Cached.
 */
let eyeGeoCache = new Map();
export function eyeballGeometry(tierName) {
  if (eyeGeoCache.has(tierName)) return eyeGeoCache.get(tierName);
  const seg = tierName === 'low' ? 14 : tierName === 'medium' ? 20 : 28;
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75), 0, PI * 2, 0, PI * 0.82);
  g.rotateX(PI / 2); // pole → +Z
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Cornea: a gentle bulge over the iris.
    const rr = sqrt(x * x + y * y);
    if (z > 0) {
      const bulge = 0.09 * (1 - smoothstep(0.32, 0.6, rr));
      const k = 1 + bulge;
      x *= k;
      y *= k;
      z *= k;
    }
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, 0.5 + x * 0.5, 0.5 + y * 0.5);
  }
  g.computeVertexNormals();
  eyeGeoCache.set(tierName, g);
  return g;
}

/**
 * Teeth + gums for one arch ('upper' | 'lower') in head space: individual rounded teeth on a
 * parabolic arch behind the lips. Returns arrays with a per-vertex color.
 */
export function teethArch(L, which, { age = 35, tierName = 'high' } = {}) {
  const upper = which === 'upper';
  const parts = [];
  const mw = L.mw;
  const frontZ = 0.094;
  const halfW = 0.02 * mw;
  const depth = 0.03;
  const archAt = (t) => {
    // t in [-1, 1] along the arch; parabola z = front - depth * t².
    const x = t * halfW * (1 + 0.15 * t * t);
    const z = frontZ - depth * t * t;
    return [x, z];
  };
  const yEdge = L.mouthY + (upper ? -0.0015 : -0.001);
  const teeth = [
    [0.07, 0.0052, 0.0105], [0.21, 0.0045, 0.0095], [0.36, 0.0046, 0.0098], [0.52, 0.0046, 0.0085], [0.68, 0.005, 0.008], [0.86, 0.0058, 0.0075],
  ];
  const yellow = clamp((age - 30) / 60, 0, 1);
  const toothCol = new THREE.Color().setRGB(0.93 - yellow * 0.08, 0.9 - yellow * 0.1, 0.82 - yellow * 0.2, THREE.SRGBColorSpace);
  const gumCol = new THREE.Color().setRGB(0.78, 0.38, 0.42, THREE.SRGBColorSpace);
  const seg = tierName === 'low' ? 4 : 6;
  for (const sx of [1, -1]) {
    for (const [t, hw, h] of teeth) {
      const tt = sx * t;
      const [x, z] = archAt(tt);
      const [x2, z2] = archAt(tt + 0.01 * sx);
      const ang = atan2(x2 - x, z2 - z);
      const height = (upper ? h : h * 0.82) * (t > 0.6 ? 0.85 : 1);
      const width = hw * (upper ? 1 : 0.86);
      const g = new THREE.CapsuleGeometry(width * 0.5, max(0.0005, height - width), 2, seg);
      g.scale(1, 1, 0.55);
      g.rotateY(ang + PI / 2);
      g.translate(x, yEdge + (upper ? height * 0.5 : -height * 0.5), z);
      parts.push({ g, col: toothCol });
    }
  }
  // Gum strip along the arch.
  const n = 16;
  const gumPts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 - 1;
    const [x, z] = archAt(t * 0.95);
    gumPts.push(new THREE.Vector3(x, yEdge + (upper ? 0.0105 : -0.0088), z - 0.001));
  }
  const curve = new THREE.CatmullRomCurve3(gumPts);
  const gum = new THREE.TubeGeometry(curve, 20, 0.0048, 6, false);
  gum.scale(1, 0.8, 1);
  parts.push({ g: gum, col: gumCol });
  return mergeColored(parts);
}

/** Tongue resting on the floor of the mouth (head space). */
export function tongueGeometry(L, tierName = 'high') {
  const seg = tierName === 'low' ? 8 : 14;
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    // Central groove on top, flattened.
    if (y > 0) y *= 1 - 0.35 * exp(-x * x * 18);
    pos.setXYZ(i, x * 0.019 * L.mw, y * 0.0075, z * 0.03);
  }
  g.translate(0, L.mouthY - 0.0125, 0.068);
  g.computeVertexNormals();
  const col = new THREE.Color().setRGB(0.78, 0.36, 0.38, THREE.SRGBColorSpace);
  return mergeColored([{ g, col }]);
}

function mergeColored(parts) {
  let nv = 0;
  let ni = 0;
  for (const { g } of parts) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(nv * 3);
  const normals = new Float32Array(nv * 3);
  const colors = new Float32Array(nv * 3);
  const index = new Uint32Array(ni);
  let vo = 0;
  let io = 0;
  for (const { g, col } of parts) {
    const c = g.attributes.position.count;
    positions.set(g.attributes.position.array, vo * 3);
    normals.set(g.attributes.normal.array, vo * 3);
    for (let i = 0; i < c; i++) {
      colors[(vo + i) * 3] = col.r;
      colors[(vo + i) * 3 + 1] = col.g;
      colors[(vo + i) * 3 + 2] = col.b;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.array[i] + vo;
    else for (let i = 0; i < c; i++) index[io + i] = vo + i;
    vo += c;
    io += g.index ? g.index.count : c;
    g.dispose();
  }
  return { positions, normals, colors, index };
}

export { HEAD_UNIT, dirToUV, faceLayout, headPrimitives, earPrimitives, findEyes, FACE_BONES, faceBonePositions, JAW_BIND_OPEN };
