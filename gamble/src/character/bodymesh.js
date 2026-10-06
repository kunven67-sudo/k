// Body mesh: subdivides the body cage, pushes it to the limit surface and packs a skinned
// BufferGeometry (position, normal, skinIndex/skinWeight with the 4 strongest bones, `aNail`).
// Garments use the same path with their own offset cages (see clothes.js).

import * as THREE from 'three';
import { subdivide, pushToLimit, triangulate, compact } from './subdiv.js';
import { BODY_BONES, CAGE_ATTR } from './bodycage.js';

/** Subdivide `levels` times (+ limit push) and return the final cage. */
export function refine(cage, levels) {
  let c = cage;
  for (let i = 0; i < levels; i++) c = subdivide(c);
  return pushToLimit(c);
}

/**
 * Pack a refined cage into a BufferGeometry. `boneIndex` maps bone name -> skeleton index.
 * `keepFace(tag)` filters faces (e.g. drop skin under clothes).
 */
export function cageToGeometry(c, boneIndex, keepFace = null, { nailAttr = true, bones = BODY_BONES } = {}) {
  let cc = c;
  if (keepFace) cc = compact(c, (fi) => keepFace(c.tags[fi])).cage;
  const { nv, D, data } = cc;
  const pos = new Float32Array(nv * 3);
  const nail = new Float32Array(nv);
  const si = new Uint16Array(nv * 4);
  const sw = new Float32Array(nv * 4);
  const wOff = 3 + CAGE_ATTR;
  const nb = bones.length;
  const boneMap = bones.map((n) => boneIndex.get(n) ?? 0);
  const top = [0, 0, 0, 0];
  const topW = [0, 0, 0, 0];
  for (let v = 0; v < nv; v++) {
    const o = v * D;
    pos[v * 3] = data[o];
    pos[v * 3 + 1] = data[o + 1];
    pos[v * 3 + 2] = data[o + 2];
    nail[v] = data[o + 3];
    topW.fill(0);
    top.fill(0);
    for (let b = 0; b < nb; b++) {
      const wv = data[o + wOff + b];
      if (wv <= topW[3]) continue;
      let k = 3;
      while (k > 0 && wv > topW[k - 1]) {
        topW[k] = topW[k - 1];
        top[k] = top[k - 1];
        k--;
      }
      topW[k] = wv;
      top[k] = b;
    }
    const sum = topW[0] + topW[1] + topW[2] + topW[3] || 1;
    for (let k = 0; k < 4; k++) {
      si[v * 4 + k] = boneMap[top[k]];
      sw[v * 4 + k] = topW[k] / sum;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (nailAttr) g.setAttribute('aNail', new THREE.BufferAttribute(nail, 1));
  g.setIndex(triangulate(cc));
  g.computeVertexNormals();
  return { geometry: g, cage: cc };
}
