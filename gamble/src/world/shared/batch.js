// Static geometry batching for world builders.
//
// Everything static in a city block goes through a StaticBatch: geometry is transformed to world
// space, gets world-scale UVs for its material, an optional per-vertex tint (so 30 stucco
// buildings can share ONE stucco texture/material and still be 30 colours) and a ground-contact
// grime gradient (walls darken in the bottom ~60 cm, like real splash-back and dirt). At build()
// time geometry is merged per (chunk, material) into one mesh each → a handful of draw calls per
// city chunk, frustum-culled by chunk and hidden beyond tier.drawDistance.
//
//   const batch = new StaticBatch({ chunkSize: 64 });
//   batch.add(geo, material, { matrix, tint: 0xd8c9a8, grime: 0.6, uv: 'world' });
//   const { group, chunks } = batch.build();
//   ... every frame: batch.cull(camera.position, tier.drawDistance)
//
// Materials passed with a tint are swapped for a cached clone with vertexColors enabled.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from '../../gfx/geom.js';
import { RAPIER, GROUPS } from '../../core/physics.js';

const tintedCache = new WeakMap();

// Clone of `material` that multiplies by vertex colours (cached per source material).
export function tinted(material) {
  if (material.vertexColors) return material;
  let m = tintedCache.get(material);
  if (!m) {
    m = material.clone();
    m.vertexColors = true;
    m.name = `${material.name || 'mat'}+vc`;
    m.userData = { ...material.userData };
    tintedCache.set(material, m);
  }
  return m;
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();

function prepGeometry(geo) {
  // Keep only the attributes every merged geometry shares; ensure indexed.
  for (const name of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
  }
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  geo.morphAttributes = {};
  geo.clearGroups();
  return geo;
}

export class StaticBatch {
  constructor({ chunkSize = 64, name = 'static' } = {}) {
    this.chunkSize = chunkSize;
    this.name = name;
    this.buckets = new Map(); // key → { material, geos: [], chunk, shadow }
    this.chunks = []; // built
  }

  /**
   * @param {THREE.BufferGeometry} geometry  local geometry (cloned, never mutated)
   * @param {THREE.Material} material
   * @param {object} o
   *   matrix      Matrix4 local→world
   *   tint        hex / Color multiplier via vertex colours (null = no vertex colours)
   *   grime       0..1 darkening near y = grimeBase (needs tint or uses white)
   *   grimeBase   world y of the ground under this piece (default 0)
   *   grimeHeight metres (default 0.7)
   *   uv          'world' (default: box-projected in world space with material tileMeters),
   *               'keep' (use the geometry's own UVs), or a number (tile metres override)
   *   cast/receive shadow flags; chunk: explicit chunk key (e.g. 'landmark' never culls)
   */
  add(geometry, material, o = {}) {
    const g = geometry.clone();
    if (o.matrix) g.applyMatrix4(o.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.uv !== 'keep') {
      const tile = typeof o.uv === 'number' ? o.uv : material.userData?.tileMeters ?? 1;
      worldUV(g, tile);
    } else if (!g.attributes.uv) {
      worldUV(g, 1);
    }
    let mat = material;
    if (o.tint != null || o.grime) {
      mat = tinted(material);
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      _c.set(o.tint ?? 0xffffff);
      const gr = o.grime || 0;
      const gb = o.grimeBase ?? 0;
      const gh = o.grimeHeight ?? 0.7;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) - gb;
        const t = gr ? 1 - gr * 0.55 * (1 - smooth(Math.max(0, y) / gh)) : 1;
        col[i * 3] = _c.r * t;
        col[i * 3 + 1] = _c.g * t;
        col[i * 3 + 2] = _c.b * t * (gr ? 0.985 + 0.015 * t : 1);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    } else if (material.vertexColors && !g.attributes.color) {
      const col = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    prepGeometry(g);
    let chunk = o.chunk;
    if (!chunk) {
      g.computeBoundingBox();
      g.boundingBox.getCenter(_v);
      chunk = `${Math.floor(_v.x / this.chunkSize)},${Math.floor(_v.z / this.chunkSize)}`;
    }
    const cast = o.castShadow ?? true;
    const recv = o.receiveShadow ?? true;
    const key = `${chunk}|${mat.uuid}|${cast ? 1 : 0}${recv ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { material: mat, geos: [], chunk, cast, recv, renderOrder: o.renderOrder ?? 0 };
      this.buckets.set(key, b);
    }
    b.geos.push(g);
    return g;
  }

  // Convenience: box centred at (x,y,z) with size (w,h,d), rotated by ry around Y.
  box(x, y, z, w, h, d, material, o = {}) {
    const geo = o.geometry || new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry || 0),
      new THREE.Vector3(1, 1, 1)
    );
    if (o.matrix) m.premultiply(o.matrix);
    return this.add(geo, material, { ...o, matrix: m });
  }

  build() {
    const group = new THREE.Group();
    group.name = this.name;
    const byChunk = new Map();
    for (const b of this.buckets.values()) {
      if (!b.geos.length) continue;
      const geo = mergeGeometries(b.geos, false);
      if (!geo) {
        console.warn('[batch] merge failed for', b.material.name);
        continue;
      }
      for (const g of b.geos) g.dispose();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.recv;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = b.renderOrder;
      mesh.name = `${this.name}:${b.chunk}:${b.material.name}`;
      group.add(mesh);
      let c = byChunk.get(b.chunk);
      if (!c) {
        c = { key: b.chunk, meshes: [], box: new THREE.Box3() };
        byChunk.set(b.chunk, c);
      }
      c.meshes.push(mesh);
      c.box.union(geo.boundingBox);
    }
    this.buckets.clear();
    this.chunks = [...byChunk.values()];
    for (const c of this.chunks) {
      c.center = c.box.getCenter(new THREE.Vector3());
      c.radius = c.box.getSize(new THREE.Vector3()).length() / 2;
      c.landmark = c.key === 'landmark';
      c.visible = true;
    }
    this.group = group;
    return { group, chunks: this.chunks };
  }

  // Hide chunks beyond the draw distance (fog hides the cut). Landmarks always stay.
  cull(viewer, drawDistance) {
    for (const c of this.chunks) {
      if (c.landmark) continue;
      const vis = c.center.distanceTo(viewer) - c.radius < drawDistance;
      if (vis !== c.visible) {
        c.visible = vis;
        for (const m of c.meshes) m.visible = vis;
      }
    }
  }

  dispose() {
    this.group?.traverse((o) => o.geometry?.dispose());
  }
}

function smooth(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// ---- Colliders ---------------------------------------------------------------------------------

// Thin wrapper so builders can add exact static colliders in one line and the dev tools can count
// / visualise them.
export class Colliders {
  constructor(physics) {
    this.physics = physics;
    this.count = 0;
    this.debug = []; // [cx,cy,cz, sx,sy,sz, ry]
  }

  box(cx, cy, cz, sx, sy, sz, ry = 0, opts = {}) {
    if (!this.physics) return null;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    this.count++;
    this.debug.push([cx, cy, cz, sx, sy, sz, ry]);
    return this.physics.addStaticBox({ x: cx, y: cy, z: cz }, { x: sx, y: sy, z: sz }, q, opts);
  }

  // Axis-aligned box from min/max corners.
  aabb(x0, y0, z0, x1, y1, z1, opts) {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, opts);
  }

  // Box given in a local frame (matrix) — for rotated building parts.
  local(matrix, cx, cy, cz, sx, sy, sz, opts) {
    const p = new THREE.Vector3(cx, cy, cz).applyMatrix4(matrix);
    const q = new THREE.Quaternion();
    matrix.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    if (!this.physics) return null;
    this.count++;
    return this.physics.addStaticBox({ x: p.x, y: p.y, z: p.z }, { x: sx, y: sy, z: sz }, q, opts);
  }

  // Vertical cylinder (poles, hydrants, bollards) standing on y0.
  cylinder(x, y0, z, radius, height, opts = {}) {
    if (!this.physics) return null;
    this.count++;
    const desc = RAPIER.ColliderDesc.cylinder(height / 2, radius)
      .setTranslation(x, y0 + height / 2, z)
      .setFriction(opts.friction ?? 0.8)
      .setCollisionGroups(opts.groups ?? GROUPS.static);
    const col = this.physics.world.createCollider(desc);
    if (opts.owner) this.physics.setOwner(col, opts.owner);
    return col;
  }

  trimesh(mesh, opts) {
    if (!this.physics) return null;
    this.count++;
    return this.physics.addStaticTrimesh(mesh, opts);
  }
}
