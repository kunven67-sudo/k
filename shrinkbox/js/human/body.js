// Builds a realistic human body from the MakeHuman data: body shape from real body-shape targets
// (gender, age, muscle, weight, ancestry, plus face/body details), the skeleton from the mesh's own
// joint markers, and skinned meshes for the body and its fitted helpers (tights, hair cap, lashes...).
import * as THREE from 'three';
import { humanData } from './data.js';

export const MODEL_H = 1.75; // every body is built this tall; callers scale the root to the real height

// MakeHuman's age slider: 0 = 1 yr, 0.1875 = 11 yrs, 0.5 = 25 yrs, 1 = 90 yrs
export function ageValue(years) {
  if (years < 11) return Math.max(0, (years - 1) / 10 * 0.1875);
  if (years < 25) return 0.1875 + (years - 11) / 14 * 0.3125;
  return Math.min(1, 0.5 + (years - 25) / 65 * 0.5);
}
const tri = (x) => (x < 0.5 ? [1 - x * 2, x * 2, 0] : [0, 2 - x * 2, x * 2 - 1]); // [min, average, max]

// weights for the macro targets (same maths as MakeHuman's macro modifiers)
function macroWeights(p) {
  const gw = { female: 1 - p.gender, male: p.gender };
  const a = ageValue(p.age);
  let child, young, old;
  if (a < 0.5) { old = 0; young = Math.max(0, (a - 0.1875) * 3.2); child = 1 - young; }
  else { child = 0; old = Math.max(0, a * 2 - 1); young = 1 - old; }
  const aw = { child, young, old };
  const [mn, ma, mx] = tri(p.muscle), [wn, wa, wx] = tri(p.weight);
  const mw = { minmuscle: mn, averagemuscle: ma, maxmuscle: mx }, ww = { minweight: wn, averageweight: wa, maxweight: wx };
  const race = p.race || { african: 1 / 3, asian: 1 / 3, caucasian: 1 / 3 };
  const rs = race.african + race.asian + race.caucasian || 1;
  const out = [];
  for (const g in gw) for (const ag in aw) {
    const ga = gw[g] * aw[ag]; if (ga < 1e-4) continue;
    for (const m in mw) for (const w in ww) { const x = ga * mw[m] * ww[w]; if (x > 1e-4) out.push([`u/${g}-${ag}-${m}-${w}`, x]); }
    for (const r of ['african', 'asian', 'caucasian']) { const x = ga * race[r] / rs; if (x > 1e-4) out.push([`r/${r}-${g}-${ag}`, x]); }
  }
  return out;
}

// ---- per-group topology shared by every character (index, uv, skin weights) ----
const topo = {};
function groupTopo(name) {
  if (topo[name]) return topo[name];
  const H = humanData();
  const [start, count] = H.groups[name];
  const idx = H.index.subarray(start, start + count);
  const local = new Map(), list = [];
  const index = new Uint16Array(count);
  for (let i = 0; i < count; i++) { const r = idx[i]; let l = local.get(r); if (l === undefined) { l = list.length; local.set(r, l); list.push(r); } index[i] = l; }
  const n = list.length, src = new Uint16Array(n), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let l = 0; l < n; l++) {
    const r = list[l], s = H.src[r]; src[l] = s;
    uv[l * 2] = H.uv[r * 2]; uv[l * 2 + 1] = H.uv[r * 2 + 1];
    for (let k = 0; k < 4; k++) { si[l * 4 + k] = H.skinIdx[s * 4 + k]; sw[l * 4 + k] = H.skinW[s * 4 + k] / 255; }
  }
  // triangles in source-vertex space (for smooth normals across uv seams)
  const stri = new Uint16Array(count); for (let i = 0; i < count; i++) stri[i] = src[index[i]];
  topo[name] = {
    n, src, stri,
    index: new THREE.BufferAttribute(index, 1),
    uv: new THREE.BufferAttribute(uv, 2),
    skinIndex: new THREE.BufferAttribute(si, 4),
    skinWeight: new THREE.BufferAttribute(sw, 4),
  };
  return topo[name];
}

let bodyVerts = null;
function bodySet() {
  if (bodyVerts) return bodyVerts;
  const t = groupTopo('body'); bodyVerts = Uint16Array.from(new Set(t.src)); return bodyVerts;
}

// smooth vertex normals in source-vertex space
export function sourceNormals(pos, stri, out) {
  for (let i = 0; i < stri.length; i += 3) {
    const a = stri[i] * 3, b = stri[i + 1] * 3, c = stri[i + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) { out[v] += nx; out[v + 1] += ny; out[v + 2] += nz; }
  }
  return out;
}

/**
 * Body shape. p = { gender 0..1 (0 = female), age (years), muscle 0..1, weight 0..1,
 *   race: { african, asian, caucasian }, details: { 'd/nose-hump-incr': 0.4, ... } }
 * Returns positions (model units: MODEL_H tall, feet at y = 0) and joint centers.
 */
export function bodyShape(p) {
  const H = humanData();
  const pos = Float32Array.from(H.base);
  const apply = (name, w) => {
    const t = H.target(name); if (!t || !w) return;
    const { idx, d } = t;
    for (let i = 0; i < idx.length; i++) { const v = idx[i] * 3; pos[v] += d[i * 3] * w; pos[v + 1] += d[i * 3 + 1] * w; pos[v + 2] += d[i * 3 + 2] * w; }
  };
  for (const [n, w] of macroWeights(p)) apply(n, w);
  for (const [n, w] of Object.entries(p.details || {})) apply(n, w);
  // feet on the floor, normalized height
  let y0 = Infinity, y1 = -Infinity;
  for (const v of bodySet()) { const y = pos[v * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const k = MODEL_H / (y1 - y0);
  for (let i = 0; i < pos.length; i += 3) { pos[i] *= k; pos[i + 1] = (pos[i + 1] - y0) * k; pos[i + 2] *= k; }
  const joints = H.joints.map((list) => {
    const c = new THREE.Vector3();
    for (const v of list) c.x += pos[v * 3], c.y += pos[v * 3 + 1], c.z += pos[v * 3 + 2];
    return c.multiplyScalar(1 / list.length);
  });
  return { pos, joints, k, naturalHeight: (y1 - y0) / 10, params: p };
}

/** A skeleton with axis-aligned bones (rest rotation = identity), so rotations are in model space. */
export function buildSkeleton(shape) {
  const H = humanData();
  const bones = [], byName = {};
  H.bones.forEach((b, i) => {
    const bone = new THREE.Bone(); bone.name = b.name;
    const head = shape.joints[b.head], tail = shape.joints[b.tail];
    if (b.parent < 0) bone.position.copy(head);
    else bone.position.copy(head).sub(shape.joints[H.bones[b.parent].head]);
    // rest axes (model space): y along the bone, x = normal of its rotation plane (the hinge axis)
    const [pa, pb, pc] = b.plane.map((j) => shape.joints[j]);
    const y = tail.clone().sub(head).normalize();
    const nrm = pb.clone().sub(pa).cross(pc.clone().sub(pa)).normalize();
    const x = nrm.clone().addScaledVector(y, -nrm.dot(y)).normalize();
    const z = x.clone().cross(y);
    bone.userData = { head: head.clone(), tail: tail.clone(), len: tail.distanceTo(head), x, y, z, index: i };
    bones.push(bone); byName[b.name] = bone;
    if (b.parent >= 0) bones[b.parent].add(bone);
  });
  const skeleton = new THREE.Skeleton(bones);
  const anchors = {};
  for (const [n, a] of Object.entries(H.anchors)) anchors[n] = { head: shape.joints[a.head].clone(), tail: shape.joints[a.tail].clone() };
  return { skeleton, root: bones[0], byName, anchors };
}

/** Geometry for one mesh group (body, tights, skirt, hair, lashL, lashR, tongue, teethUp, teethLo, eyeL, eyeR). */
export function groupGeometry(shape, name, { offset = 0 } = {}) {
  const t = groupTopo(name);
  const H = humanData();
  const nrm = sourceNormals(shape.pos, t.stri, new Float32Array(H.nv * 3));
  const n = t.n, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let l = 0; l < n; l++) {
    const s = t.src[l] * 3;
    let nx = nrm[s], ny = nrm[s + 1], nz = nrm[s + 2]; const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
    N[l * 3] = nx; N[l * 3 + 1] = ny; N[l * 3 + 2] = nz;
    P[l * 3] = shape.pos[s] + nx * offset; P[l * 3 + 1] = shape.pos[s + 1] + ny * offset; P[l * 3 + 2] = shape.pos[s + 2] + nz * offset;
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(t.index);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', t.uv);
  g.setAttribute('skinIndex', t.skinIndex);
  g.setAttribute('skinWeight', t.skinWeight);
  g.userData.src = t.src;
  return g;
}

export function topology(name) { return groupTopo(name); }
