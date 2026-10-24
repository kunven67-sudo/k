// Collision world: static triangle soups (world space) with a BVH each, filtered by the spider's size so a 2 m
// spider doesn't climb on pens and a 4 mm one doesn't ignore them. Also dynamic "solids" (spheres) for creatures.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const _ray = new THREE.Ray();
const _tA = new THREE.Vector3(), _tB = new THREE.Vector3(), _tC = new THREE.Vector3();
const _hitTarget = {};

export class CollisionWorld {
  constructor() {
    this.layers = [];      // { geo, bvh, minSize, maxSize, tag, enabled, box }
    this.analytic = [];    // { probe(origin, dir, far) } e.g. planet spheres
  }
  clear() { this.layers.length = 0; this.analytic.length = 0; }

  // geometry must already be in world space (apply matrices before)
  addStatic(geo, { minSize = 0, maxSize = Infinity, tag = '' } = {}) {
    if (!geo || !geo.attributes.position || geo.attributes.position.count < 3) return null;
    const g = geo.index ? geo : geo.clone();
    if (!g.index) { // BVH wants an index
      const n = g.attributes.position.count, idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    const bvh = new MeshBVH(g, { targetLeafSize: 8 });
    g.computeBoundingBox();
    const L = { geo: g, bvh, minSize, maxSize, tag, enabled: true, box: g.boundingBox.clone() };
    this.layers.push(L);
    return L;
  }

  // a layer is used when the spider's size (zone units) is between minSize and maxSize:
  // e.g. a pen layer has maxSize 0.05 -> only spiders smaller than 5 cm walk on pens
  _ok(L, size) { return L.enabled && size >= L.minSize && size <= L.maxSize; }

  raycast(origin, dir, far, size = 0) {
    let best = null;
    _ray.origin.copy(origin); _ray.direction.copy(dir);
    for (const L of this.layers) {
      if (!this._ok(L, size)) continue;
      if (!_ray.intersectsBox(L.box)) continue;
      const h = L.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
      if (h && h.distance <= far && (!best || h.distance < best.distance)) {
        // geometric normal of the hit triangle, facing back toward the ray
        const f = h.face;
        const n = new THREE.Vector3().copy(f.normal);
        if (n.dot(dir) > 0) n.negate();
        best = { point: h.point.clone(), normal: n, distance: h.distance, tag: L.tag };
      }
    }
    for (const A of this.analytic) {
      const h = A.probe(origin, dir, far, size);
      if (h && (!best || h.distance < best.distance)) best = h;
    }
    return best;
  }
  // quick test: is anything solid inside this sphere (for spawning, line of sight etc.)
  blocked(o, d, far, size = 0) { return !!this.raycast(o, d, far, size); }

  // nearest surface point within maxDist (for pushing bodies out of walls)
  closest(point, maxDist, size = 0) {
    let best = null;
    for (const L of this.layers) {
      if (!this._ok(L, size)) continue;
      if (L.box.distanceToPoint(point) > maxDist) continue;
      const r = L.bvh.closestPointToPoint(point, _hitTarget, 0, maxDist);
      if (r && r.distance <= maxDist && (!best || r.distance < best.distance)) {
        // normal of that triangle
        const i = r.faceIndex * 3, idx = L.geo.index, pos = L.geo.attributes.position;
        _tA.fromBufferAttribute(pos, idx.getX(i)); _tB.fromBufferAttribute(pos, idx.getX(i + 1)); _tC.fromBufferAttribute(pos, idx.getX(i + 2));
        const n = new THREE.Vector3().subVectors(_tC, _tB).cross(_tA.sub(_tB)).normalize();
        const toP = new THREE.Vector3().subVectors(point, r.point);
        if (n.dot(toP) < 0) n.negate();
        best = { point: r.point.clone(), normal: n, distance: r.distance };
      }
    }
    for (const A of this.analytic) {
      if (!A.closest) continue;
      const h = A.closest(point, maxDist, size);
      if (h && (!best || h.distance < best.distance)) best = h;
    }
    return best;
  }
}

// Moving / removable axis-aligned boxes (elevator cars, sliding doors, city buildings that can be crushed).
// box: { min: Vector3, max: Vector3, maxSize, minSize, obj, on }
const _inv = new THREE.Vector3();
export class DynBoxes {
  constructor() { this.boxes = []; }
  add(min, max, opts = {}) { const b = { min: min.clone(), max: max.clone(), maxSize: opts.maxSize ?? Infinity, minSize: opts.minSize ?? 0, obj: opts.obj || null, on: true, tag: opts.tag || '' }; this.boxes.push(b); return b; }
  remove(b) { const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); }
  probe(o, d, far, size) {
    let best = null;
    _inv.set(1 / (d.x || 1e-12), 1 / (d.y || 1e-12), 1 / (d.z || 1e-12));
    for (const b of this.boxes) {
      if (!b.on || size > b.maxSize || size < b.minSize) continue;
      let t0 = 0, t1 = far, ax = -1, sgn = 1;
      for (let k = 0; k < 3; k++) {
        const c = k === 0 ? 'x' : k === 1 ? 'y' : 'z';
        let ta = (b.min[c] - o[c]) * _inv[c], tb = (b.max[c] - o[c]) * _inv[c];
        let s = -1;
        if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
        if (ta > t0) { t0 = ta; ax = k; sgn = s; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ax = -2; break; }
      }
      if (ax < 0) continue; // started inside (ax -1) or missed (-2)
      if (best && t0 >= best.distance) continue;
      const n = new THREE.Vector3(); n.setComponent(ax, sgn);
      best = { point: new THREE.Vector3().copy(o).addScaledVector(d, t0), normal: n, distance: t0, tag: b.tag, obj: b.obj, box: b };
    }
    return best;
  }
  closest(p, maxD, size) {
    let best = null;
    for (const b of this.boxes) {
      if (!b.on || size > b.maxSize || size < b.minSize) continue;
      const q = new THREE.Vector3(Math.max(b.min.x, Math.min(p.x, b.max.x)), Math.max(b.min.y, Math.min(p.y, b.max.y)), Math.max(b.min.z, Math.min(p.z, b.max.z)));
      const dist = q.distanceTo(p);
      if (dist > maxD || (best && dist >= best.distance)) continue;
      let n;
      if (dist > 1e-9) n = new THREE.Vector3().subVectors(p, q).divideScalar(dist);
      else { // inside: push out through the nearest face
        const dx0 = p.x - b.min.x, dx1 = b.max.x - p.x, dy0 = p.y - b.min.y, dy1 = b.max.y - p.y, dz0 = p.z - b.min.z, dz1 = b.max.z - p.z;
        const m = Math.min(dx0, dx1, dy0, dy1, dz0, dz1);
        n = new THREE.Vector3(m === dx0 ? -1 : m === dx1 ? 1 : 0, m === dy0 ? -1 : m === dy1 ? 1 : 0, m === dz0 ? -1 : m === dz1 ? 1 : 0);
      }
      best = { point: q, normal: n, distance: dist, obj: b.obj };
    }
    return best;
  }
}

// merge a list of meshes into one world-space geometry (position only) for a collision layer
export function bakeColliders(meshes) {
  const parts = [];
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', m.geometry.attributes.position.clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(m.matrixWorld);
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  if (!parts.length) return null;
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const arr = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { arr.set(p.attributes.position.array, o); o += p.attributes.position.array.length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return g;
}
