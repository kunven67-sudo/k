// World builder: walls, floors, boxes and static models get merged into one mesh per material,
// so a whole furnished house costs a few dozen draw calls instead of thousands (GT 1030 rule).
// Collision boxes go straight into Rapier.
//
//   const B = new Builder(world, parentGroup)
//   B.box(cx, cy, cz, sx, sy, sz, mat | [px, nx, py, ny, pz, nz], { rotY, collide, shadow })
//   B.wall(x0, z0, x1, z1, { y, h, t, matA, matB, ends, openings: [{ at, w, h, sill }] })
//   B.model(kit, name, { x, y, z, rotY, scale, collide, dynamic })  // static ones merge
//   B.finish()                                                       // merge + add meshes
//
// Coordinates are world metres. rotY turns around the box centre.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from '../gfx/geom.js';
import { assets } from '../gfx/assets.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Face order matches BoxGeometry groups: +x, -x, +y, -y, +z, -z.
const FACES = [
  { n: [1, 0, 0], rot: [0, Math.PI / 2, 0], size: (s) => [s[2], s[1]], off: (s) => [s[0] / 2, 0, 0] },
  { n: [-1, 0, 0], rot: [0, -Math.PI / 2, 0], size: (s) => [s[2], s[1]], off: (s) => [-s[0] / 2, 0, 0] },
  { n: [0, 1, 0], rot: [-Math.PI / 2, 0, 0], size: (s) => [s[0], s[2]], off: (s) => [0, s[1] / 2, 0] },
  { n: [0, -1, 0], rot: [Math.PI / 2, 0, 0], size: (s) => [s[0], s[2]], off: (s) => [0, -s[1] / 2, 0] },
  { n: [0, 0, 1], rot: [0, 0, 0], size: (s) => [s[0], s[1]], off: (s) => [0, 0, s[2] / 2] },
  { n: [0, 0, -1], rot: [0, Math.PI, 0], size: (s) => [s[0], s[1]], off: (s) => [0, 0, -s[2] / 2] },
];

/** Copy a (possibly quantized / interleaved) geometry into plain float attributes. */
export function floatGeometry(src, keepUV) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', ...(keepUV ? ['uv'] : [])]) {
    const a = src.attributes[name];
    if (!a) continue;
    const n = a.count;
    const size = a.itemSize;
    const arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      arr[i * size] = a.getX(i);
      if (size > 1) arr[i * size + 1] = a.getY(i);
      if (size > 2) arr[i * size + 2] = a.getZ(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  if (src.index) g.setIndex(Array.from(src.index.array));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

function matKey(m) {
  const c = m.color ? m.color.getHexString() : '-';
  const e = m.emissive ? m.emissive.getHexString() + (m.emissiveIntensity ?? 1) : '-';
  return `${m.type}|${c}|${e}|${m.map?.uuid || ''}|${(m.roughness ?? 1).toFixed(2)}|${(m.metalness ?? 0).toFixed(2)}|${m.transparent ? m.opacity : 1}`;
}

const sharedMats = new Map();
/** One material instance per look, shared by every merged model piece. */
function shareMaterial(m) {
  const k = matKey(m);
  let s = sharedMats.get(k);
  if (!s) {
    s = m.clone();
    if ('roughness' in s) s.roughness = Math.max(s.roughness, 0.45);
    if ('metalness' in s) s.metalness = Math.min(s.metalness, 0.2);
    sharedMats.set(k, s);
  }
  return s;
}

export class Builder {
  constructor(world, parent) {
    this.world = world;
    this.physics = world.physics;
    this.parent = parent;
    this.buckets = new Map(); // key -> { mat, geos: [], cast, receive }
    this.colliders = [];
  }

  _bucket(mat, cast, uv) {
    const key = `${mat.uuid}|${cast ? 1 : 0}|${uv ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { mat, geos: [], cast, uv };
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Static collider box (centre, size, rotY). */
  collider(cx, cy, cz, sx, sy, sz, rotY = 0, opts = {}) {
    _q.setFromAxisAngle(UP, rotY);
    const col = this.physics.addStaticBox({ x: cx, y: cy, z: cz }, { x: sx, y: sy, z: sz }, _q.clone(), opts);
    this.colliders.push(col);
    return col;
  }

  /**
   * Box with one material or six (null = face skipped). World-scale UVs.
   * opts: rotY, collide (default true), shadow (default true), tile (override tile metres).
   */
  box(cx, cy, cz, sx, sy, sz, mat, { rotY = 0, collide = true, shadow = true, collideOpts } = {}) {
    const mats = Array.isArray(mat) ? mat : [mat, mat, mat, mat, mat, mat];
    _m.compose(_v.set(cx, cy, cz), _q.setFromAxisAngle(UP, rotY), _s.set(1, 1, 1));
    const s = [sx, sy, sz];
    for (let f = 0; f < 6; f++) {
      const m = mats[f];
      if (!m) continue;
      const F = FACES[f];
      const [w, h] = F.size(s);
      if (w < 1e-4 || h < 1e-4) continue;
      const g = new THREE.PlaneGeometry(w, h);
      const fm = new THREE.Matrix4().compose(new THREE.Vector3(...F.off(s)), new THREE.Quaternion().setFromEuler(new THREE.Euler(...F.rot)), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(fm).applyMatrix4(_m);
      worldUV(g, m.userData?.tileMeters ?? 1);
      this._bucket(m, shadow, true).geos.push(g);
    }
    if (collide) this.collider(cx, cy, cz, sx, sy, sz, rotY, collideOpts);
  }

  /**
   * Straight wall from (x0,z0) to (x1,z1). matA covers the +z side of a wall running along +x
   * (for a wall running along +z that is the -x side); matB the other side. Openings are
   * measured from the start along the wall: { at (centre), w, h, sill }.
   */
  wall(x0, z0, x1, z1, { y = 0, h = 2.6, t = 0.12, matA, matB, matEdge, openings = [], collide = true } = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const dx = (x1 - x0) / len;
    const dz = (z1 - z0) / len;
    const rotY = Math.atan2(-dz, dx); // local +x along the wall
    const edge = matEdge || matA;
    const at = (s, yy, hh, ww, endL, endR) => {
      const c = s + ww / 2;
      const cx = x0 + dx * c;
      const cz = z0 + dz * c;
      const f = [endR ? edge : null, endL ? edge : null, edge, yy > y + 0.01 ? edge : null, matA, matB];
      this.box(cx, yy + hh / 2, cz, ww, hh, t, f, { rotY, collide });
    };
    const ops = [...openings].sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const o of ops) {
      const a = o.at - o.w / 2;
      const b = o.at + o.w / 2;
      if (a > cursor + 0.001) at(cursor, y, h, a - cursor, cursor === 0, true);
      const sill = o.sill || 0;
      if (sill > 0) at(a, y, sill, o.w, false, false);
      const top = sill + o.h;
      if (top < h - 0.001) at(a, y + top, h - top, o.w, false, false);
      cursor = b;
    }
    if (cursor < len - 0.001) at(cursor, y, h, len - cursor, cursor === 0, true);
    return { len, dx, dz, rotY };
  }

  /** Floor/ceiling slab (top surface at y). */
  slab(x0, z0, x1, z1, y, mat, { thick = 0.1, under = null, collide = true, shadow = false } = {}) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    this.box(cx, y - thick / 2, cz, Math.abs(x1 - x0), thick, Math.abs(z1 - z0), [null, null, mat, under, null, null], { collide, shadow });
  }

  /**
   * A model from a kit. Static (default): merged into the buckets. dynamic: true returns a live
   * Object3D added to the parent instead (doors, fridge, anything that moves or gets picked up).
   * collide: 'box' (bounding box, default for static), 'none', or a [sx, sy, sz] override.
   */
  model(kit, name, { x = 0, y = 0, z = 0, rotY = 0, scale = null, stretch = null, collide = 'box', dynamic = false, shadow = true, tint = null } = {}) {
    const obj = assets.model(kit, name, scale != null ? { scale } : {});
    if (stretch) obj.scale.multiply(new THREE.Vector3(...stretch));
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (collide !== 'none' && !box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      if (Array.isArray(collide)) this.collider(c.x, c.y, c.z, collide[0], collide[1], collide[2], rotY);
      else {
        // Box3 of a rotated model is axis-aligned; recompute in the model's own frame.
        const probe = assets.model(kit, name, scale != null ? { scale } : {});
        if (stretch) probe.scale.multiply(new THREE.Vector3(...stretch));
        const local = new THREE.Box3().setFromObject(probe);
        const ls = local.getSize(new THREE.Vector3());
        const lc = local.getCenter(new THREE.Vector3()).applyAxisAngle(UP, rotY).add(obj.position);
        this.collider(lc.x, lc.y, lc.z, ls.x, ls.y, ls.z, rotY);
        void size;
        void c;
      }
    }
    if (tint) {
      obj.traverse((o) => {
        if (o.isMesh && tint[o.material.name]) {
          o.material = o.material.clone();
          o.material.color.set(tint[o.material.name]);
        }
      });
    }
    if (dynamic) {
      this.parent.add(obj);
      return obj;
    }
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const m = shareMaterial(o.material);
      const uv = !!m.map;
      const g = floatGeometry(o.geometry, uv);
      g.applyMatrix4(o.matrixWorld);
      this._bucket(m, shadow, uv).geos.push(g);
    });
    return box;
  }

  /** Add an arbitrary mesh (already placed in world space) to the merge. */
  mesh(mesh, { shadow = true } = {}) {
    mesh.updateMatrixWorld(true);
    const m = mesh.material;
    const g = floatGeometry(mesh.geometry, false);
    g.applyMatrix4(mesh.matrixWorld);
    worldUV(g, m.userData?.tileMeters ?? 1);
    this._bucket(m, shadow, true).geos.push(g);
  }

  finish() {
    const out = [];
    for (const b of this.buckets.values()) {
      if (!b.geos.length) continue;
      for (const g of b.geos) {
        if (b.uv && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!b.uv && g.attributes.uv) g.deleteAttribute('uv');
        if (g.index) continue;
      }
      // mergeGeometries needs all-indexed or all-non-indexed.
      const anyIndexed = b.geos.some((g) => g.index);
      const geos = anyIndexed ? b.geos.map((g) => (g.index ? g : indexify(g))) : b.geos;
      const merged = mergeGeometries(geos, false);
      for (const g of b.geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.parent.add(mesh);
      out.push(mesh);
    }
    this.buckets.clear();
    return out;
  }
}

function indexify(g) {
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}
