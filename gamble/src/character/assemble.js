// Mesh assembly: turns templates + a person's params + their rig into skinned geometry.
//
//   skin   body + hands + head + ears + eyelid shells, one geometry (one draw call)
//   eyes   both eyeballs (atlas UVs: left eye in u∈[0,.5], right eye in u∈[.5,1])
//   mouth  upper teeth/gums (head), lower teeth/gums + tongue (jaw)
//
// Geometry depends only on shape params + tier, so it is cached by a hash of those and shared
// between identical people. Bone indices refer to the order produced by rig.buildRig().

import * as THREE from 'three';
import { bodyTemplate, handTemplate, shapeBody, shapeHand } from './template.js';
import { headTemplate, shapeHead, shapeEar, lidShell, eyeballGeometry, teethArch, tongueGeometry, FACE_BONES, JAW_BIND_OPEN, dirToUV } from './head.js';
import { faceBonePositions } from './headsculpt.js';
import { primitiveWeights } from './sdf.js';

// Params that change geometry (everything else is materials/attachments).
export const SHAPE_KEYS = [
  'age', 'height', 'fat', 'muscle', 'shoulders', 'chest', 'waist', 'hips', 'belly', 'legs', 'handSize',
  'faceWidth', 'jaw', 'chin', 'cheeks', 'cheekbones', 'noseSize', 'noseWidth', 'noseBridge', 'noseTip', 'ears', 'earsOut',
  'browRidge', 'lips', 'mouthWidth', 'eyeSize', 'eyeSpacing', 'eyeTilt', 'lids',
];

export function shapeHash(p, tierName) {
  return `${tierName}|${SHAPE_KEYS.map((k) => (+p[k]).toFixed(3)).join(',')}`;
}

const geoCache = new Map();

/** Build (or reuse) the skinned geometries for a person. */
export function assembleGeometry(p, rig, tierName) {
  const key = shapeHash(p, tierName);
  const hit = geoCache.get(key);
  if (hit) {
    hit.refs++;
    return hit;
  }
  const out = {
    key,
    refs: 1,
    skin: buildSkin(p, rig, tierName),
    eyes: buildEyes(rig, tierName),
    mouth: buildMouth(p, rig, tierName),
  };
  geoCache.set(key, out);
  return out;
}

export function releaseGeometry(g) {
  if (!g || --g.refs > 0) return;
  geoCache.delete(g.key);
  g.skin.geometry.dispose();
  g.eyes.dispose();
  g.mouth.dispose();
}

// Accumulates mesh parts into big typed arrays.
class SkinBuilder {
  constructor() {
    this.parts = [];
    this.nv = 0;
    this.ni = 0;
  }
  add(part) {
    this.parts.push(part);
    this.nv += part.positions.length / 3;
    this.ni += part.index.length;
  }
  build() {
    const { nv, ni } = this;
    const position = new Float32Array(nv * 3);
    const normal = new Float32Array(nv * 3);
    const skinIndex = new Uint16Array(nv * 4);
    const skinWeight = new Float32Array(nv * 4);
    const skinMask = new Float32Array(nv * 4);
    const faceUV = new Float32Array(nv * 2);
    const faceData = new Float32Array(nv * 4);
    const region = new Uint8Array(nv);
    const index = new Uint32Array(ni);
    let vo = 0;
    let io = 0;
    const ranges = {};
    for (const pt of this.parts) {
      const n = pt.positions.length / 3;
      position.set(pt.positions, vo * 3);
      normal.set(pt.normals, vo * 3);
      for (let i = 0; i < n * 4; i++) {
        skinIndex[vo * 4 + i] = pt.skinIndex[i];
        skinWeight[vo * 4 + i] = pt.skinWeight[i];
      }
      if (pt.mask) skinMask.set(pt.mask, vo * 4);
      if (pt.uv) faceUV.set(pt.uv, vo * 2);
      if (pt.faceData) faceData.set(pt.faceData, vo * 4);
      if (pt.region !== undefined) {
        if (typeof pt.region === 'number') region.fill(pt.region, vo, vo + n);
        else region.set(pt.region, vo);
      }
      for (let i = 0; i < pt.index.length; i++) index[io + i] = pt.index[i] + vo;
      ranges[pt.name] = { v0: vo, v1: vo + n, i0: io, i1: io + pt.index.length };
      vo += n;
      io += pt.index.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    g.setAttribute('skinMask', new THREE.BufferAttribute(skinMask, 4));
    g.setAttribute('faceUV', new THREE.BufferAttribute(faceUV, 2));
    g.setAttribute('faceData', new THREE.BufferAttribute(faceData, 4));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -0.4, -1.2), new THREE.Vector3(1.2, 2.4, 1.2));
    return { geometry: g, region, ranges, fullIndex: index };
  }
}

function buildSkin(p, rig, tierName) {
  const bt = bodyTemplate(tierName);
  const ht = handTemplate(tierName);
  const hd = headTemplate(tierName);
  const { L, hsc, headToWorld } = rig.dims;
  const sb = new SkinBuilder();

  // Body.
  const body = shapeBody(bt, p, rig);
  const nb = body.positions.length / 3;
  sb.add({
    name: 'body', positions: body.positions, normals: body.normals, index: bt.index, skinIndex: bt.skinIndex, skinWeight: bt.skinWeight,
    mask: bt.mask, region: bt.region,
  });
  // Hands.
  for (const side of ['L', 'R']) {
    const fa = body.prims.find((q) => q.forearm === side);
    const h = shapeHand(ht, p, rig, side, fa);
    const n = h.positions.length / 3;
    const si = new Uint16Array(n * 4);
    for (let i = 0; i < n * 4; i++) si[i] = h.boneMap[ht.skinIndex[i]];
    sb.add({ name: `hand.${side}`, positions: h.positions, normals: h.normals, index: h.index, skinIndex: si, skinWeight: ht.skinWeight, mask: ht.mask, region: side === 'L' ? 6 : 7 });
  }
  // Head (head space → world bind space).
  const neckPrim = body.prims.find((q) => q.group === 'neck');
  const head = shapeHead(hd, p, L, { neckR: neckPrim.r2 / hsc });
  const nh = head.positions.length / 3;
  const hp = new Float32Array(nh * 3);
  const c = rig.dims.j.headCenter;
  for (let v = 0; v < nh; v++) {
    hp[v * 3] = c.x + head.positions[v * 3] * hsc;
    hp[v * 3 + 1] = c.y + head.positions[v * 3 + 1] * hsc;
    hp[v * 3 + 2] = c.z + head.positions[v * 3 + 2] * hsc;
  }
  const faceMap = FACE_BONES.map((b) => rig.boneIndex.get(b));
  const hsi = new Uint16Array(nh * 4);
  for (let i = 0; i < nh * 4; i++) hsi[i] = faceMap[hd.skinIndex[i]];
  const hsw = new Float32Array(hd.skinWeight);
  // Below the jaw the head mesh overlaps the body's neck: blend toward the neck primitive's own
  // weights there so both surfaces bend identically (the hidden one never pokes through).
  for (let v = 0; v < nh; v++) {
    const y = head.positions[v * 3 + 1];
    const z = head.positions[v * 3 + 2];
    let k = Math.min(1, Math.max(0, (-0.118 - y) / 0.05)) * (z < 0.05 ? 1 : 0.2);
    if (hd.group[v] === 'neck') k = Math.max(k, 0.6);
    if (k <= 0) continue;
    const w = primitiveWeights([neckPrim], hp[v * 3], hp[v * 3 + 1], hp[v * 3 + 2]).weights;
    const acc = new Map();
    for (let q = 0; q < 4; q++) if (hsw[v * 4 + q] > 0) acc.set(hsi[v * 4 + q], (acc.get(hsi[v * 4 + q]) || 0) + hsw[v * 4 + q] * (1 - k));
    for (const [b, ww] of w) acc.set(b, (acc.get(b) || 0) + ww * k);
    const arr = [...acc.entries()].sort((x, y2) => y2[1] - x[1]).slice(0, 4);
    const sum = arr.reduce((s, e) => s + e[1], 0) || 1;
    for (let q = 0; q < 4; q++) {
      hsi[v * 4 + q] = arr[q] ? arr[q][0] : 0;
      hsw[v * 4 + q] = arr[q] ? arr[q][1] / sum : 0;
    }
  }
  sb.add({ name: 'head', positions: hp, normals: head.normals, index: hd.index, skinIndex: hsi, skinWeight: hsw, uv: hd.uv, faceData: hd.flags, region: 12 });
  // Ears (head bone).
  const headBone = rig.boneIndex.get('head');
  for (const side of [1, -1]) {
    const e = shapeEar(hd.ear, L, side);
    const n = e.positions.length / 3;
    for (let v = 0; v < n; v++) {
      e.positions[v * 3] = c.x + e.positions[v * 3] * hsc;
      e.positions[v * 3 + 1] = c.y + e.positions[v * 3 + 1] * hsc;
      e.positions[v * 3 + 2] = c.z + e.positions[v * 3 + 2] * hsc;
    }
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const fd = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      si[v * 4] = headBone;
      sw[v * 4] = 1;
      fd[v * 4 + 2] = 1; // ear flag → redness, no face paint
    }
    sb.add({ name: side > 0 ? 'ear.L' : 'ear.R', positions: e.positions, normals: e.normals, index: e.index, skinIndex: si, skinWeight: sw, faceData: fd, region: 12 });
  }
  // Eyelid shells.
  for (const [k, side] of [[0, 'L'], [1, 'R']]) {
    for (const which of ['upper', 'lower']) {
      const lid = lidShell(L, L.eyes[k], which, tierName);
      const n = lid.positions.length / 3;
      for (let v = 0; v < n; v++) {
        lid.positions[v * 3] = c.x + lid.positions[v * 3] * hsc;
        lid.positions[v * 3 + 1] = c.y + lid.positions[v * 3 + 1] * hsc;
        lid.positions[v * 3 + 2] = c.z + lid.positions[v * 3 + 2] * hsc;
      }
      const lb = rig.boneIndex.get(`${which === 'upper' ? 'lidU' : 'lidD'}.${side}`);
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      const fd = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) {
        si[v * 4] = lb;
        sw[v * 4] = lid.lidWeight[v];
        si[v * 4 + 1] = headBone;
        sw[v * 4 + 1] = 1 - lid.lidWeight[v];
        fd[v * 4] = 1;
        fd[v * 4 + 3] = 1; // lid flag
      }
      sb.add({ name: `lid.${which}.${side}`, positions: lid.positions, normals: lid.normals, index: lid.index, skinIndex: si, skinWeight: sw, uv: lid.uv, faceData: fd, region: 12, lashLine: lid.lashLine });
    }
  }
  const built = sb.build();
  built.bodyCount = nb;
  built.eyeUV = L.eyes.map((e) => {
    const uv = dirToUV(e.c.x, e.c.y + 0.02, e.c.z + e.R);
    return uv;
  });
  return built;
}

function buildEyes(rig, tierName) {
  const { L, hsc } = rig.dims;
  const c = rig.dims.j.headCenter;
  const unit = eyeballGeometry(tierName);
  const parts = [];
  for (const [k, side] of [[0, 'L'], [1, 'R']]) {
    const e = L.eyes[k];
    const g = unit.clone();
    // Eye tilt is in the lids; the eyeball itself looks straight ahead in bind pose.
    g.scale(e.R * hsc, e.R * hsc, e.R * hsc);
    g.translate(c.x + e.c.x * hsc, c.y + e.c.y * hsc, c.z + e.c.z * hsc);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + k * 0.5);
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const b = rig.boneIndex.get(`eye.${side}`);
    for (let i = 0; i < n; i++) {
      si[i * 4] = b;
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  }
  const merged = mergeIndexed(parts);
  merged.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
  return merged;
}

function buildMouth(p, rig, tierName) {
  const { L, hsc } = rig.dims;
  const c = rig.dims.j.headCenter;
  const FB = faceBonePositions(L);
  const pivot = new THREE.Vector3(...FB.jaw);
  const open = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), JAW_BIND_OPEN);
  const parts = [];
  const add = (geo, boneName, rotateOpen) => {
    const n = geo.positions.length / 3;
    const v = new THREE.Vector3();
    const nv = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromArray(geo.positions, i * 3);
      nv.fromArray(geo.normals, i * 3);
      // Lower parts are modelled closed; the bind pose has the jaw slightly open.
      if (rotateOpen) {
        v.sub(pivot).applyQuaternion(open).add(pivot);
        nv.applyQuaternion(open);
      }
      geo.positions[i * 3] = c.x + v.x * hsc;
      geo.positions[i * 3 + 1] = c.y + v.y * hsc;
      geo.positions[i * 3 + 2] = c.z + v.z * hsc;
      geo.normals[i * 3] = nv.x;
      geo.normals[i * 3 + 1] = nv.y;
      geo.normals[i * 3 + 2] = nv.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3));
    g.setAttribute('color', new THREE.BufferAttribute(geo.colors, 3));
    g.setIndex(new THREE.BufferAttribute(geo.index, 1));
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const b = rig.boneIndex.get(boneName);
    for (let i = 0; i < n; i++) {
      si[i * 4] = b;
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  };
  add(teethArch(L, 'upper', { age: p.age, tierName }), 'head', false);
  add(teethArch(L, 'lower', { age: p.age, tierName }), 'jaw', true);
  add(tongueGeometry(L, tierName), 'tongue', true);
  const merged = mergeIndexed(parts);
  merged.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
  merged.userData.frontZ = c.z + 0.1 * hsc;
  merged.userData.depth = 0.045 * hsc;
  return merged;
}

/** Merge indexed geometries that share the same attribute set. */
export function mergeIndexed(geos) {
  const names = Object.keys(geos[0].attributes);
  let nv = 0;
  let ni = 0;
  for (const g of geos) {
    nv += g.attributes.position.count;
    ni += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const a0 = geos[0].attributes[name];
    const arr = new a0.array.constructor(nv * a0.itemSize);
    let o = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized));
  }
  const idx = new Uint32Array(ni);
  let io = 0;
  let vo = 0;
  for (const g of geos) {
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    io += g.index.count;
    vo += g.attributes.position.count;
    g.dispose();
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
