// Geometry collection for cabinets. A cabinet builder adds geometries to a PartBag under a
// material key ('body', 'chrome', 'black'…) in the machine's local space; the bank later
// transforms every machine's bag into bank space and merges each key into ONE mesh, so a bank of
// eight machines costs a handful of draw calls instead of hundreds.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from '../../../gfx/geom.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

export function matrixOf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p.clone(), _q.clone(), _s.clone());
}

/** Strip a geometry down to position / normal / uv, non-indexed, so everything merges. */
export function normalizeGeo(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g === geo) g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}

export class PartBag {
  constructor() {
    this.parts = new Map(); // key → [{ geo, matrix, uvTile }]
  }

  /** Add geometry under `key` with a local transform. uvTile: re-project UVs to world scale (m per tile). */
  add(key, geo, matrix = null, { uvTile = null } = {}) {
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push({ geo, matrix: matrix ? matrix.clone() : new THREE.Matrix4(), uvTile });
    return this;
  }

  box(key, w, h, d, x, y, z, { r = 0.006, rx = 0, ry = 0, rz = 0, uvTile = 0.6, seg = 2 } = {}) {
    const geo = r > 0.0005 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.05, h / 2.05, d / 2.05)) : new THREE.BoxGeometry(w, h, d);
    return this.add(key, geo, matrixOf(x, y, z, rx, ry, rz), { uvTile });
  }

  cyl(key, rt, rb, h, x, y, z, { rx = 0, ry = 0, rz = 0, seg = 20, open = false, uvTile = null } = {}) {
    return this.add(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), matrixOf(x, y, z, rx, ry, rz), { uvTile });
  }

  /** Merge every key into a geometry in `space` (a matrix applied on top of the local ones). */
  static mergeAll(bags, spaces) {
    const byKey = new Map();
    bags.forEach((bag, i) => {
      const S = spaces[i];
      for (const [key, list] of bag.parts) {
        if (!byKey.has(key)) byKey.set(key, []);
        for (const p of list) {
          const g = normalizeGeo(p.geo);
          _m.multiplyMatrices(S, p.matrix);
          g.applyMatrix4(_m);
          if (p.uvTile) worldUV(g, p.uvTile);
          byKey.get(key).push(g);
        }
      }
    });
    const out = new Map();
    for (const [key, geos] of byKey) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      out.set(key, merged);
    }
    return out;
  }
}

/** Extrude a side profile (points in (z, y)) into a panel `t` thick along X, outer face at x = x0. */
export function sideProfileGeo(points, t, { bevel = 0.005, curve = null } = {}) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  if (curve) curve(shape);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
  // shape (x=z, y=y), extrusion along +Z → rotate so extrusion runs along −X, shape x → +Z
  geo.rotateY(-Math.PI / 2);
  geo.translate(-bevel, 0, 0);
  return geo;
}

/** A flat panel lying on the segment (z0,y0)→(z1,y1), width w along X, centred at x. */
export function slopedPanel(w, z0, y0, z1, y1, thick, x = 0, push = 0) {
  const len = Math.hypot(z1 - z0, y1 - y0);
  const ang = Math.atan2(z1 - z0, y1 - y0); // tilt from vertical toward +z
  const geo = new THREE.BoxGeometry(w, len, thick);
  // Rotating +Y about X by `ang` lays it along the segment; the box's +Z face becomes the front,
  // with normal (0, −sin, cos). The front face sits on the segment line, pushed out by `push`.
  const nz = Math.cos(ang);
  const ny = -Math.sin(ang);
  const off = push - thick / 2;
  const m = matrixOf(x, (y0 + y1) / 2 + ny * off, (z0 + z1) / 2 + nz * off, ang, 0, 0);
  return { geo, matrix: m, len, ang, normal: new THREE.Vector3(0, ny, nz) };
}
