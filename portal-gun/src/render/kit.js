import * as THREE from '../three.js';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';

export const LAYER_WORLD = 0; // outlined
export const LAYER_OVERLAY = 1; // drawn after outlines (portals, glass, particles)
export const LAYER_SKY = 2; // background, no outlines

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export const G = {
  box: (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r = 0.05, s = 2) => cached(`rb${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, r)),
  cyl: (rt, rb, h, seg = 16, open = false) => cached(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  sphere: (r, ws = 16, hs = 12) => cached(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
  cone: (r, h, seg = 12) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  capsule: (r, len, cs = 6, rs = 12) => cached(`p${r},${len},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs)),
  torus: (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => cached(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  plane: (w, h) => cached(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
};

/** mesh(geometry, material, [x,y,z], parent, {rx,ry,rz,sx,sy,sz}) */
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, o = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o) {
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    if (o.s !== undefined) m.scale.setScalar(o.s);
    if (o.sx !== undefined) m.scale.x = o.sx;
    if (o.sy !== undefined) m.scale.y = o.sy;
    if (o.sz !== undefined) m.scale.z = o.sz;
    if (o.order) m.rotation.order = o.order;
  }
  if (parent) parent.add(m);
  return m;
}

export function setLayer(obj, layer) {
  obj.traverse((o) => o.layers.set(layer));
  return obj;
}

/**
 * Merges every static mesh under `root` into one mesh per material so a whole
 * house costs a handful of draw calls instead of thousands.
 */
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (o.userData.dynamic) return;
    let p = o.parent;
    while (p && p !== root) {
      if (p.userData.dynamic) return;
      p = p.parent;
    }
    const mat = o.material;
    if (Array.isArray(mat) || mat.transparent) return;
    const g = o.geometry;
    if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    const key = `${mat.uuid}|${g.index ? 'i' : 'n'}|${o.layers.mask}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat, layers: o.layers.mask, geos: [] }));
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const clone = new THREE.BufferGeometry();
    clone.setAttribute('position', g.attributes.position.clone());
    clone.setAttribute('normal', g.attributes.normal.clone());
    clone.setAttribute('uv', g.attributes.uv.clone());
    if (g.index) clone.setIndex(g.index.clone());
    clone.applyMatrix4(mtx);
    b.geos.push(clone);
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  let count = 0;
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, b.mat);
    m.layers.mask = b.layers;
    m.matrixAutoUpdate = false;
    root.add(m);
    count++;
  }
  return count;
}
