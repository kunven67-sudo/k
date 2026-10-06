// Light versions of detailed models, for when you can't see the detail anyway.
// The terrarium's rocks, logs and plants are photo scans (up to ~25,000 triangles
// for a pebble). From normal size you look at them from a meter away, where a
// few percent of that looks the same, so each one swaps to a simplified copy
// (made once per model with meshoptimizer) unless the camera is right up close
// (you, shrunk into the tank). Colliders and the tiny people's walking map are
// built from the detailed shapes before any swapping happens.
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';

const made = new Map(); // detailed geometry -> light geometry

function positionsOf(geo) {
  const a = geo.attributes.position;
  if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && a.itemSize === 3 && !a.normalized) return a.array;
  const out = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); }
  return out;
}

// the same mesh with fewer triangles (shares the vertex data; only the triangle list is new)
export function simplified(geo, { ratio = 0.08, error = 0.04 } = {}) {
  if (made.has(geo)) return made.get(geo);
  let lo = geo;
  try {
    if (geo.index && geo.index.count > 1500) {
      const indices = geo.index.array instanceof Uint32Array ? geo.index.array : new Uint32Array(geo.index.array);
      const target = Math.max(300, Math.floor((indices.length * ratio) / 3) * 3);
      const [idx] = MeshoptSimplifier.simplify(indices, positionsOf(geo), 3, target, error);
      if (idx.length && idx.length < indices.length * 0.8) {
        lo = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(geo.attributes)) lo.setAttribute(name, attr);
        lo.setIndex(new THREE.BufferAttribute(idx, 1));
        lo.boundingBox = geo.boundingBox;
        lo.boundingSphere = geo.boundingSphere;
        if (!lo.boundingSphere) lo.computeBoundingSphere();
      }
    }
  } catch (e) {
    console.warn('[lod] could not simplify', e.message);
  }
  made.set(geo, lo);
  return lo;
}

// Swaps a set of objects between their detailed and light meshes by distance.
export class DetailSwitch {
  static async create(objects, opts) {
    await MeshoptSimplifier.ready;
    return new DetailSwitch(objects, opts);
  }

  constructor(objects, { ratio, error, near = 0.3 } = {}) {
    this.near = near;
    this.items = [];
    for (const o of objects) {
      const meshes = [];
      o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && m.geometry?.index) meshes.push({ m, hi: m.geometry, lo: simplified(m.geometry, { ratio, error }) }); });
      if (!meshes.length || meshes.every((x) => x.lo === x.hi)) continue;
      const box = new THREE.Box3().setFromObject(o);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      this.items.push({ o, meshes, center: o.parent.worldToLocal(sphere.center.clone()), radius: sphere.radius, detailed: true });
    }
    this.t = 0;
  }

  get triangles() {
    let hi = 0, lo = 0;
    for (const it of this.items) for (const x of it.meshes) { hi += x.hi.index.count / 3; lo += x.lo.index.count / 3; }
    return { hi, lo };
  }

  // eye: the camera position (world). Checked a few times a second.
  update(eye, dt = 1 / 60, force = false) {
    this.t -= dt;
    if (this.t > 0 && !force) return;
    this.t = 0.2;
    const w = new THREE.Vector3();
    for (const it of this.items) {
      w.copy(it.center);
      it.o.parent.localToWorld(w);
      const d = w.distanceTo(eye) - it.radius;
      // (a little hysteresis so nothing flickers at the edge)
      const want = it.detailed ? d < this.near * 1.25 : d < this.near;
      if (want === it.detailed) continue;
      it.detailed = want;
      for (const x of it.meshes) x.m.geometry = want ? x.hi : x.lo;
    }
  }
}
