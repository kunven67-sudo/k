// House building kit: floors, walls with door/window openings, ceilings, stairs, trim.
//
// Everything static is merged per material at the end (a whole house = a handful of draw calls),
// with UVs in real meters so textures never stretch. Every visible solid gets a matching collider
// (Rule 4). Walls are boxes whose two big faces can use different materials (painted inside,
// stucco outside).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// A box with UVs in world meters (divided by `tile`) on every face.
function worldBox(w, h, d, matrix, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(matrix);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, x / tile, z / tile);
    else if (nx >= nz) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  return g;
}

export class Kit {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.parts = new Map(); // material -> [geometry]
    this.group = new THREE.Group();
    this.group.name = 'house';
    game.scene.add(this.group);
  }

  // Add geometry (already in world space) under a material.
  add(geo, mat) {
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo);
  }

  // A solid box: centered at (x,y,z), size (w,h,d), rotated around Y. One material, or an array of
  // six materials in BoxGeometry face order [+x,-x,+y,-y,+z,-z]. Adds a collider unless noCollide.
  box(x, y, z, w, h, d, mat, { rotY = 0, tile = 1, noCollide = false, friction } = {}) {
    _q.setFromAxisAngle(UP, rotY);
    _m.compose(_v.set(x, y, z), _q, _s.set(1, 1, 1));
    const g = worldBox(w, h, d, _m, tile);
    if (Array.isArray(mat)) {
      // Split the box's 6 face groups into separate materials.
      for (let f = 0; f < 6; f++) {
        const sub = g.clone();
        const idx = g.index.array.slice(f * 6, f * 6 + 6);
        sub.setIndex(Array.from(idx));
        this.add(sub, mat[f]);
      }
    } else {
      this.add(g, mat);
    }
    if (!noCollide) this.physics.staticBox(x, y, z, w / 2, h / 2, d / 2, null, rotY, friction);
  }

  // Horizontal slab with its TOP at y.
  floor(x0, z0, x1, z1, y, mat, { thick = 0.3, tile = 1, scatter = null, scatterColor } = {}) {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    this.box((x0 + x1) / 2, y - thick / 2, (z0 + z1) / 2, w, thick, d, mat, { tile });
    if (scatter) this.game.scatter.addSurface({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), y, kind: scatter, color: scatterColor });
  }

  // A wall from A to B (on the ground plane), from height y0 up `h`, thickness t.
  // openings: [{ at: distance from A to the opening's center, w, bottom, top }] (heights above y0)
  // mats: material or { a: side to the left of A->B, b: right side, edge }
  wall(ax, az, bx, bz, y0, h, t, mats, openings = []) {
    const len = Math.hypot(bx - ax, bz - az);
    const dirX = (bx - ax) / len, dirZ = (bz - az) / len;
    const rotY = -Math.atan2(dirZ, dirX);
    // Face order for a box whose local X runs along the wall and Z across it.
    const m = mats.a ? mats : { a: mats, b: mats, edge: mats };
    const faceMats = [m.edge, m.edge, m.edge, m.edge, m.b, m.a];
    const seg = (s0, s1, yb, yt) => {
      if (s1 - s0 < 1e-3 || yt - yb < 1e-3) return;
      const c = (s0 + s1) / 2;
      const cx = ax + dirX * c, cz = az + dirZ * c;
      this.box(cx, y0 + (yb + yt) / 2, cz, s1 - s0, yt - yb, t, faceMats, { rotY });
    };
    // Split the wall into columns at every opening edge. In each column, the solid parts are the
    // full height minus every opening that covers that column (windows stacked on two floors, a door
    // under a window, etc. all work).
    const cuts = new Set([0, len]);
    for (const o of openings) {
      cuts.add(Math.max(0, Math.min(len, o.at - o.w / 2)));
      cuts.add(Math.max(0, Math.min(len, o.at + o.w / 2)));
    }
    const xs = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const s0 = xs[i], s1 = xs[i + 1];
      if (s1 - s0 < 1e-4) continue;
      const mid = (s0 + s1) / 2;
      const holes = openings.filter((o) => mid > o.at - o.w / 2 && mid < o.at + o.w / 2).map((o) => [o.bottom, o.top]).sort((a, b) => a[0] - b[0]);
      let y = 0;
      for (const [b, t] of holes) {
        if (b > y) seg(s0, s1, y, b);
        y = Math.max(y, t);
      }
      if (y < h) seg(s0, s1, y, h);
    }
    return { len, dirX, dirZ, rotY };
  }

  // Straight stairs: from (x,z) going in direction dir (radians, 0 = -Z), `steps` steps.
  stairs(x, z, y0, width, run, rise, steps, dir, mat, { sideMat = null } = {}) {
    const fx = -Math.sin(dir), fz = -Math.cos(dir);
    for (let i = 0; i < steps; i++) {
      const top = y0 + rise * (i + 1);
      const cx = x + fx * run * (i + 0.5), cz = z + fz * run * (i + 0.5);
      // Each step is a solid block down to the floor (no gaps to fall through).
      const h = top - y0;
      this.box(cx, y0 + h / 2, cz, width, h, run, [sideMat || mat, sideMat || mat, mat, mat, mat, mat], { rotY: dir });
    }
  }

  // Merge everything added so far into a few meshes.
  build({ castShadow = true, receiveShadow = true } = {}) {
    for (const [mat, geos] of this.parts) {
      const nonIndexed = geos.map((g) => (g.index ? g : g));
      const merged = mergeGeometries(nonIndexed, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow && !mat.transparent;
      mesh.receiveShadow = receiveShadow;
      this.group.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.parts.clear();
    return this.group;
  }
}
