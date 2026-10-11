// Geometry helpers shared by props, fracture and the arena.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _n = new THREE.Vector3();
const _p = new THREE.Vector3();

// Box-projected UVs in meters, so textures keep the same real-world scale on every object
// (a 3m wall shows three tiles of a 1m texture, a soda can shows a small piece).
export function worldUV(geo, metersPerTile = 1) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    let u, v;
    if (ax >= ay && ax >= az) { u = _p.z * Math.sign(_n.x); v = _p.y; }
    else if (ay >= az) { u = _p.x; v = _p.z * Math.sign(_n.y); }
    else { u = -_p.x * Math.sign(_n.z); v = _p.y; }
    uv[i * 2] = u / metersPerTile;
    uv[i * 2 + 1] = v / metersPerTile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function box(w, h, d, segs = 1) {
  return worldUV(new THREE.BoxGeometry(w, h, d, segs, segs, segs));
}

// Box with slightly rounded/beveled edges: real objects never have razor-sharp edges,
// and the bevel catches light, which reads as "real" more than anything else.
export function bevelBox(w, h, d, r = 0.01, segs = 2) {
  const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const pos = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i);
    const cx = THREE.MathUtils.clamp(_p.x, -hw, hw);
    const cy = THREE.MathUtils.clamp(_p.y, -hh, hh);
    const cz = THREE.MathUtils.clamp(_p.z, -hd, hd);
    _n.set(_p.x - cx, _p.y - cy, _p.z - cz);
    if (_n.lengthSq() > 1e-12) {
      _n.normalize().multiplyScalar(r);
      pos.setXYZ(i, cx + _n.x, cy + _n.y, cz + _n.z);
    }
  }
  g.computeVertexNormals();
  return worldUV(g);
}

export function cyl(rTop, rBottom, h, seg = 24, open = false) {
  return worldUV(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open));
}

export function sphere(r, seg = 20) {
  return worldUV(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)));
}

export function translate(geo, x, y, z) { geo.translate(x, y, z); return geo; }
export function rotate(geo, x, y, z) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z)));
  return geo;
}

// Merge geometries that share one material into a single draw call.
export function merge(list) {
  const clean = list.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    return x;
  });
  return mergeGeometries(clean, false);
}

// Corrugated steel sheet (shipping containers): a plane whose surface follows a trapezoid wave.
export function corrugatedPanel(w, h, pitch = 0.28, depth = 0.035) {
  const segs = Math.max(8, Math.round((w / pitch) * 4));
  const g = new THREE.PlaneGeometry(w, h, segs, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w / 2;
    const t = (x / pitch) % 1;
    // trapezoid: flat-up, ramp, flat-down, ramp
    const z = t < 0.35 ? 1 : t < 0.5 ? 1 - (t - 0.35) / 0.15 * 2 : t < 0.85 ? -1 : -1 + (t - 0.85) / 0.15 * 2;
    pos.setZ(i, (z * depth) / 2);
  }
  g.computeVertexNormals();
  return worldUV(g);
}

// Convex hull points of common collider shapes (used by fracture).
export function boxPoints(hx, hy, hz) {
  const pts = [];
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
}
export function cylPoints(r, hh, seg = 12) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, -hh, Math.sin(a) * r));
    pts.push(new THREE.Vector3(Math.cos(a) * r, hh, Math.sin(a) * r));
  }
  return pts;
}
export function ballPoints(r) {
  const pts = [];
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i));
  return pts;
}
