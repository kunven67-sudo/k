// Assembles one person's skinned geometry from the parts: subdivided body cage + head grid +
// eyelid patches + ears (one "skin" geometry = one draw call), eyeballs, mouth interior.
// Results are cached by the params that change the shape, so crowds of NPCs reuse work.
//
// Skin vertex attributes consumed by skin.js:
//   skinMask (r flush zones, g body-hair zones, b knuckles, a nails)
//   faceUV   (head grid UVs for the face paint; body = 0,0)
//   faceData (x is-face-paint, y mouth interior, z ear flush, w spare)

import * as THREE from 'three';
import { buildBodyCage, BODY_BONES, CAGE_ATTR, tagPart, PART } from './bodycage.js';
import { refine } from './bodymesh.js';
import { triangulate } from './subdiv.js';
import { setNeck, headSDF, HEAD_UNIT, PROJ } from './headsdf.js';
import { buildHeadGrid, HEAD_BONES } from './headmesh.js';
import { buildEyes, buildMouth, buildEars, computePartNormals } from './facefeatures.js';
import { HUMAN_PARAM_SCHEMA } from './schema.js';

export const BODY_LEVEL = { low: 0, medium: 1, high: 1, ultra: 2 };
const SHAPE_KEYS = HUMAN_PARAM_SCHEMA.filter((g) => ['body', 'face', 'eyes'].includes(g.id)).flatMap((g) => g.params.map((p) => p.key));
const cache = new Map();

export function shapeKey(p, tier) {
  return `${tier}|${SHAPE_KEYS.map((k) => (typeof p[k] === 'number' ? p[k].toFixed(3) : p[k])).join(',')}`;
}

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Dense weights (stride nb, names) -> top-4 skinIndex/skinWeight into out arrays at vertex o. */
function packWeights(dense, off, nb, names, boneIndex, si, sw, o) {
  const top = [-1, -1, -1, -1];
  const tw = [0, 0, 0, 0];
  for (let b = 0; b < nb; b++) {
    const w = dense[off + b];
    if (w <= tw[3]) continue;
    let k = 3;
    while (k > 0 && w > tw[k - 1]) {
      tw[k] = tw[k - 1];
      top[k] = top[k - 1];
      k--;
    }
    tw[k] = w;
    top[k] = b;
  }
  const sum = tw[0] + tw[1] + tw[2] + tw[3] || 1;
  for (let k = 0; k < 4; k++) {
    si[o * 4 + k] = top[k] >= 0 ? boneIndex.get(names[top[k]]) ?? 0 : 0;
    sw[o * 4 + k] = tw[k] / sum;
  }
  return top[0] >= 0 ? names[top[0]] : null;
}

/**
 * Build (or fetch) the geometry set for params p on rig. Returns a ref-counted record:
 * { skin, eyes, mouth, triTags, bodyCage, level, L, mapper, key }.
 */
export function buildHumanGeometry(p, rig, tier = 'high') {
  const key = shapeKey(p, tier);
  const hit = cache.get(key);
  if (hit) {
    hit.refs++;
    return hit;
  }
  const rec = build(p, rig, tier);
  rec.key = key;
  rec.refs = 1;
  cache.set(key, rec);
  return rec;
}

export function releaseGeometry(rec) {
  if (!rec || --rec.refs > 0) return;
  cache.delete(rec.key);
  rec.skin.dispose();
  rec.eyes.dispose();
  rec.mouth.dispose();
}

function build(p, rig, tier) {
  const dims = rig.dims;
  const { j } = dims;
  const boneIndex = rig.boneIndex;
  const hc = j.headCenter;
  const hsc = dims.headH / HEAD_UNIT;
  const L = dims.L;
  // ---- body
  const T0 = performance.now();
  const { cage, seam } = buildBodyCage(p, dims);
  const level = BODY_LEVEL[tier] ?? 1;
  const T1 = performance.now();
  const body = refine(cage, level);
  const T2 = performance.now();
  const bIdx = triangulate(body);
  const bTags = new Int32Array(bIdx.length / 3);
  for (let f = 0, t = 0; f < body.quads.length / 4; f++) {
    bTags[t++] = body.tags[f];
    bTags[t++] = body.tags[f];
  }
  // ---- head (unit space -> world)
  setNeck(L, { y: (seam.y - hc.y) / hsc, W: seam.W / hsc, F: seam.F / hsc, B: seam.B / hsc, cz: (seam.cz - hc.z) / hsc, ty: seam.ty / hsc });
  const head = buildHeadGrid(L, tier);
  const T3 = performance.now();
  const sdf = headSDF(L);
  const ears = buildEars(L, (y, z) => {
    // Skull surface x at (y, z): march inward from the side.
    let x = 0.16;
    for (let i = 0; i < 60; i++) {
      const d = sdf(x, y, z);
      if (d < 1e-4) break;
      x -= Math.max(d * 0.8, 2e-4);
    }
    return x - 0.003;
  }, tier === 'low' ? 14 : 20, tier === 'low' ? 4 : 6);
  computePartNormals(ears);
  // ---- merge skin
  const nb = body.nv;
  const nh = head.nv;
  const ne = ears.nv;
  const N = nb + nh + ne;
  const pos = new Float32Array(N * 3);
  const si = new Uint16Array(N * 4);
  const sw = new Float32Array(N * 4);
  const mask = new Float32Array(N * 4);
  const fuv = new Float32Array(N * 2);
  const fdat = new Float32Array(N * 4);
  const nrm = new Float32Array(N * 3);
  const D = body.D;
  const wOff = 3 + CAGE_ATTR;
  // Landmarks for masks.
  const jointsKnuckle = [];
  for (const s of ['L', 'R']) for (const f of ['index', 'middle', 'ring', 'pinky']) for (const k of [1, 2, 3]) jointsKnuckle.push(rig.worldP[`${f}${k}.${s}`]);
  const elbows = ['L', 'R'].map((s) => rig.worldP[`forearm.${s}`]);
  const knees = ['L', 'R'].map((s) => rig.worldP[`shin.${s}`]);
  const hairZone = { 'forearm.L': 1, 'forearm.R': 1, 'shin.L': 1, 'shin.R': 1, 'thigh.L': 0.55, 'thigh.R': 0.55, 'upperarm.L': 0.35, 'upperarm.R': 0.35, 'upperarmFat.L': 0.3, 'upperarmFat.R': 0.3, 'hand.L': 0.3, 'hand.R': 0.3, chest: 0.45, 'breast.L': 0.35, 'breast.R': 0.35, belly: 0.35, spine: 0.25 };
  const dens = body.data;
  const g = (d, r) => Math.exp(-(d * d) / (r * r));
  for (let v = 0; v < nb; v++) {
    const o = v * D;
    pos[v * 3] = dens[o];
    pos[v * 3 + 1] = dens[o + 1];
    pos[v * 3 + 2] = dens[o + 2];
    const top = packWeights(dens, o + wOff, BODY_BONES.length, BODY_BONES, boneIndex, si, sw, v);
    const P = new THREE.Vector3(dens[o], dens[o + 1], dens[o + 2]);
    let kn = 0;
    for (const q of jointsKnuckle) kn = Math.max(kn, g(P.distanceTo(q), 0.011 * dims.s));
    let fl = kn * 0.8;
    for (const q of elbows) fl = Math.max(fl, g(P.distanceTo(q), 0.05 * dims.s) * (P.z < q.z ? 1 : 0.4));
    for (const q of knees) fl = Math.max(fl, g(P.distanceTo(q), 0.065 * dims.s) * (P.z > q.z ? 0.8 : 0.3));
    let hz = hairZone[top] ?? 0;
    if (top === 'chest' || top === 'belly' || top === 'spine') hz *= P.z > 0 ? 1 : 0.35;
    fdat[v * 4 + 3] = 1;
    mask[v * 4] = fl;
    mask[v * 4 + 1] = hz;
    mask[v * 4 + 2] = kn;
    mask[v * 4 + 3] = dens[o + 3];
  }
  // Body normals from the body triangles only.
  {
    const gtmp = new THREE.BufferGeometry();
    gtmp.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, nb * 3), 3));
    gtmp.setIndex(bIdx);
    gtmp.computeVertexNormals();
    nrm.set(gtmp.attributes.normal.array, 0);
    gtmp.dispose();
  }
  const NBh = HEAD_BONES.length;
  for (let v = 0; v < nh; v++) {
    const o = nb + v;
    const x = head.pos[v * 3];
    const y = head.pos[v * 3 + 1];
    const z = head.pos[v * 3 + 2];
    pos[o * 3] = hc.x + x * hsc;
    pos[o * 3 + 1] = hc.y + y * hsc;
    pos[o * 3 + 2] = hc.z + z * hsc;
    nrm.set(head.nrm.subarray(v * 3, v * 3 + 3), o * 3);
    packWeights(head.weights, v * NBh, NBh, HEAD_BONES, boneIndex, si, sw, o);
    fuv[o * 2] = head.uv[v * 2];
    fuv[o * 2 + 1] = head.uv[v * 2 + 1];
    const inner = sstep(0.005, 0.0, Math.abs(y - L.mouthY)) * sstep(L.mouthZ - 0.003, L.mouthZ - 0.01, z) * (Math.abs(x) < L.mouthHalfW ? 1 : 0);
    fdat[o * 4] = 1;
    fdat[o * 4 + 1] = inner * 0.2;
    fdat[o * 4 + 3] = headAO(sdf, x, y, z, head.nrm, v);
    mask[o * 4] = g(Math.hypot(x, y - L.noseTipY, z - L.noseTipZ), 0.012) * 0.35;
  }
  for (let v = 0; v < ne; v++) {
    const o = nb + nh + v;
    pos[o * 3] = hc.x + ears.pos[v * 3] * hsc;
    pos[o * 3 + 1] = hc.y + ears.pos[v * 3 + 1] * hsc;
    pos[o * 3 + 2] = hc.z + ears.pos[v * 3 + 2] * hsc;
    nrm.set(ears.nrm.slice(v * 3, v * 3 + 3), o * 3);
    si[o * 4] = boneIndex.get('head');
    sw[o * 4] = 1;
    fdat[o * 4 + 2] = 1;
    fdat[o * 4 + 3] = 0.82 + 0.18 * Math.min(1, Math.abs(ears.pos[v * 3]) * 8 - 0.7);
    mask[o * 4] = 0.55;
  }
  const index = new Uint32Array(bIdx.length + head.index.length + ears.idx.length);
  index.set(bIdx, 0);
  for (let i = 0; i < head.index.length; i++) index[bIdx.length + i] = head.index[i] + nb;
  for (let i = 0; i < ears.idx.length; i++) index[bIdx.length + head.index.length + i] = ears.idx[i] + nb + nh;
  const triTags = new Int32Array(index.length / 3).fill(-1);
  triTags.set(bTags, 0);
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  skin.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  skin.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  skin.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  skin.setAttribute('skinMask', new THREE.BufferAttribute(mask, 4));
  skin.setAttribute('faceUV', new THREE.BufferAttribute(fuv, 2));
  skin.setAttribute('faceData', new THREE.BufferAttribute(fdat, 4));
  skin.setIndex(new THREE.BufferAttribute(index, 1));
  skin.computeBoundingSphere();
  // ---- eyes and mouth
  const eyes = partGeometry(buildEyes(L, tier === 'low' ? 14 : 24), hc, hsc, boneIndex);
  const mouth = partGeometry(buildMouth(L, tier === 'low' ? 10 : 16), hc, hsc, boneIndex, true);
  // ---- face paint mapper (unit-space front point -> canvas px)
  const toUV = head.info.toUV;
  const frontZ = (x, y) => {
    let z = 0.2;
    for (let i = 0; i < 80; i++) {
      const d = sdf(x, y, z);
      if (d < 2e-4) break;
      z -= Math.max(d * 0.8, 2e-4);
    }
    return z;
  };
  const mapper = {
    L: { ...L, eyes: L.eyes.map((e) => ({ c: { x: e.c[0], y: e.c[1], z: e.c[2] } })) },
    uvOf(x, y, zOverride) {
      const z = zOverride ?? frontZ(x, y);
      const qx = x - PROJ[0];
      const qy = y - PROJ[1];
      const qz = z - PROJ[2];
      return toUV(Math.atan2(qx, qz), Math.atan2(qy, Math.hypot(qx, qz)));
    },
  };
  const T4 = performance.now();
  const timing = { cage: T1 - T0, subdiv: T2 - T1, head: T3 - T2, rest: T4 - T3 };
  return { skin, eyes, mouth, triTags, bodyCage: cage, level, L, mapper, seam, bodyVerts: nb, timing };
}

/**
 * Ambient occlusion of a head vertex from the sculpt SDF (classic "distance along the normal"
 * estimate): eye sockets, lash line, nostrils, mouth corners, under the nose and jaw darken,
 * which gives the face its definition under flat light. 1 = open.
 */
function headAO(sdf, x, y, z, nrm, v) {
  const nx = nrm[v * 3];
  const ny = nrm[v * 3 + 1];
  const nz = nrm[v * 3 + 2];
  let occ = 0;
  let wsum = 0;
  for (let i = 1; i <= 5; i++) {
    const h = 0.0035 * i;
    const d = sdf(x + nx * h, y + ny * h, z + nz * h);
    const w = 1 / (1 << i);
    occ += w * Math.max(0, h - d) / h;
    wsum += w;
  }
  return Math.max(0.45, 1 - 1.0 * (occ / wsum));
}

function partGeometry(part, hc, hsc, boneIndex, colors = false) {
  const n = part.nv;
  const pos = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    pos[v * 3] = hc.x + part.pos[v * 3] * hsc;
    pos[v * 3 + 1] = hc.y + part.pos[v * 3 + 1] * hsc;
    pos[v * 3 + 2] = hc.z + part.pos[v * 3 + 2] * hsc;
    si[v * 4] = boneIndex.get(part.bone[v]) ?? 0;
    sw[v * 4] = 1 - part.w2[v];
    if (part.bone2[v]) {
      si[v * 4 + 1] = boneIndex.get(part.bone2[v]) ?? 0;
      sw[v * 4 + 1] = part.w2[v];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.nrm), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(part.uv), 2));
  if (colors) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(part.col), 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(part.idx);
  g.computeBoundingSphere();
  return g;
}

/** Index buffer of the skin with body triangles hidden where `hidden(tag)` is true. */
export function skinIndex(rec, hidden) {
  const src = rec.skin.index.array;
  const out = [];
  for (let t = 0; t < rec.triTags.length; t++) {
    const tag = rec.triTags[t];
    if (tag >= 0 && hidden(tag)) continue;
    out.push(src[t * 3], src[t * 3 + 1], src[t * 3 + 2]);
  }
  return out;
}
export { tagPart, PART };
