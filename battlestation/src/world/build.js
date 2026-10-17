import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from './materials.js';

// Small geometry helpers used everywhere in the house.

export function mesh(geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  if (o.parent) o.parent.add(m);
  return m;
}

// Axis-aligned box from min/max corners, UVs in meters (good for walls, shelves, counters).
export function boxMM(x0, y0, z0, x1, y1, z1, rotUV) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(g, rotUV);
}

// Centered box with world-scale UVs, optionally rounded edges.
export function box(w, h, d, radius = 0, seg = 3) {
  const g = radius > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(radius, Math.min(w, h, d) / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
  return worldUV(g);
}

export function cyl(rt, rb, h, seg = 24, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

// A flat wall face (in its own plane, x = along wall, y = up) with rectangular holes cut out.
// Returns rectangles covering the face minus the holes.
export function faceRects(w, h, holes) {
  const xs = new Set([0, w]);
  const ys = new Set([0, h]);
  for (const o of holes) { xs.add(o.x0); xs.add(o.x1); ys.add(o.y0); ys.add(o.y1); }
  const X = [...xs].filter(v => v >= 0 && v <= w).sort((a, b) => a - b);
  const Y = [...ys].filter(v => v >= 0 && v <= h).sort((a, b) => a - b);
  const rects = [];
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Y.length - 1; j++) {
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      if (holes.some(o => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1)) continue;
      rects.push({ x0: X[i], x1: X[i + 1], y0: Y[j], y1: Y[j + 1] });
    }
  }
  // merge vertical neighbours to cut triangle count
  return rects;
}

// Builds a face geometry placed in the world: origin (ox,oz), direction along the wall (dx,dz),
// normal pointing into the room. UVs in meters.
export function wallFace(ox, oz, dx, dz, w, h, holes, y0 = 0) {
  const geos = [];
  const nx = -dz, nz = dx; // left-hand normal: caller passes direction so this points into the room
  for (const r of faceRects(w, h, holes)) {
    const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0);
    // plane faces +z by default; rotate so it faces (nx, nz)
    const ang = Math.atan2(nx, nz);
    g.rotateY(ang);
    const along = (r.x0 + r.x1) / 2;
    g.translate(ox + dx * along, y0 + (r.y0 + r.y1) / 2, oz + dz * along);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      uv.setXY(i, (px - ox) * dx + (pz - oz) * dz, py);
    }
    geos.push(g);
  }
  return geos.length ? mergeGeometries(geos) : null;
}

export function merge(geos) { return mergeGeometries(geos.filter(Boolean), false); }

// Lathe helper: profile points [[r, y], ...]
export function lathe(points, seg = 32) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// Tube along points (cables).
export function tube(points, radius, seg = 64, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, radius, 8, closed);
}

// Extruded rounded-rectangle shape (for things like a mouse pad, phone, router body).
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function slab(w, d, thick, r, bevel = 0.002) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), { depth: thick - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}
