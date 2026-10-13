// Rapier physics wrapper. Units are meters and kilograms. One world, stepped at a fixed 60 Hz.
//
// Size-awareness: Rapier's internal tolerances (how much objects may overlap, contact distances)
// follow `world.lengthUnit`. We keep it tied to the player's size so a 2 mm player and the crumbs
// around them are simulated as precisely as a 1.75 m player and a chair.
import RAPIER from 'rapier';
import * as THREE from 'three';

export { RAPIER };

const grp = (membership, filter) => ((membership & 0xffff) << 16) | (filter & 0xffff);
export const LAYER = { STATIC: 1, PROP: 2, PLAYER: 4, CREATURE: 8, SENSOR: 16, CAMERA: 32, HELD: 64 };
const ALL = 0xffff;
export const GROUPS = {
  static: grp(LAYER.STATIC | LAYER.CAMERA, ALL),
  prop: grp(LAYER.PROP, ALL),
  // Held items don't push the player who carries them.
  held: grp(LAYER.HELD, ALL & ~LAYER.PLAYER),
  player: grp(LAYER.PLAYER, ALL & ~LAYER.SENSOR & ~LAYER.HELD),
  creature: grp(LAYER.CREATURE, ALL),
  sensor: grp(LAYER.SENSOR, LAYER.PLAYER | LAYER.CREATURE),
  // For queries: what the camera must not pass through.
  cameraQuery: grp(ALL, LAYER.STATIC | LAYER.PROP),
};

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init();
  return ready;
}

const STEP = 1 / 60;
const _q = new THREE.Quaternion();

export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.acc = 0;
    this.alpha = 1;
    this.owners = new Map(); // collider handle -> owner object
    this.synced = new Set(); // owners with { body, object3d } that need transform sync
    this.stepCount = 0;
  }

  setLengthUnit(u) {
    const v = Math.min(10, Math.max(1e-4, u));
    if (Math.abs(this.world.lengthUnit - v) / v > 0.05) this.world.lengthUnit = v;
  }

  // Advance by real dt in fixed steps. Returns the number of steps taken.
  update(dt, beforeStep) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 4) {
      for (const o of this.synced) o.savePrev?.();
      beforeStep?.(STEP);
      this.world.step();
      this.acc -= STEP;
      n++;
      this.stepCount++;
    }
    if (n === 4) this.acc = 0; // too slow: drop time instead of spiraling
    this.alpha = this.acc / STEP;
    for (const o of this.synced) o.sync?.(this.alpha);
    return n;
  }

  // Run the world for a while with every loose object awake, then put the ones at rest to sleep.
  settle(props, steps = 90) {
    for (const p of props) p.body.wakeUp();
    for (let i = 0; i < steps; i++) this.world.step();
    for (const p of props) {
      p._readBody(p.curPos, p.curQuat);
      p.prevPos.copy(p.curPos);
      p.prevQuat.copy(p.curQuat);
      p.object.position.copy(p.curPos);
      p.object.quaternion.copy(p.curQuat);
      const v = p.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) < 0.02) p.body.sleep();
    }
  }

  own(collider, owner) {
    this.owners.set(collider.handle, owner);
    return collider;
  }

  ownerOf(collider) {
    return collider ? this.owners.get(collider.handle) : null;
  }

  removeCollider(c) {
    this.owners.delete(c.handle);
    this.world.removeCollider(c, false);
  }

  removeBody(body) {
    const n = body.numColliders();
    for (let i = 0; i < n; i++) this.owners.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
  }

  // A fixed (never moving) box: walls, floors, counters.
  staticBox(cx, cy, cz, hx, hy, hz, owner = null, rotY = 0, friction = 0.7) {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz).setCollisionGroups(GROUPS.static).setFriction(friction);
    if (rotY) {
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      d.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    return this.own(this.world.createCollider(d), owner);
  }

  staticCylinder(cx, cy, cz, r, hh, owner = null) {
    const d = RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(cx, cy, cz).setCollisionGroups(GROUPS.static);
    return this.own(this.world.createCollider(d), owner);
  }

  // Exact triangle collider for odd static shapes (stair stringers, sculpted terrain).
  // `inside`: the surface is walked on from the inside (tunnels, rooms in the ground). Triangles only
  // stop things on their front side, so their winding is flipped to face in.
  staticTrimesh(geometry, matrixWorld, owner = null, { inside = false } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    // The physics engine does its math in 32-bit floats, which near x = 10 m are only good to ~1
    // micrometer: as big as the gap a 1 mm you keeps from walls. So the triangles are stored around
    // their own center (small numbers, ~0.004 micrometer precision) and the collider is placed there.
    const box = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld));
    const c = box.getCenter(new THREE.Vector3());
    const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
      verts[i * 3] = v.x - c.x;
      verts[i * 3 + 1] = v.y - c.y;
      verts[i * 3 + 2] = v.z - c.z;
    }
    const idx = new Uint32Array(pos.count);
    for (let i = 0; i < pos.count; i += 3) {
      idx[i] = i;
      idx[i + 1] = inside ? i + 2 : i + 1;
      idx[i + 2] = inside ? i + 1 : i + 2;
    }
    // FIX_INTERNAL_EDGES stops things that roll or slide across the surface (props, balls) from catching
    // on the seams between its triangles. (Your own tiny movement uses rays, see Player._tinyVertical.)
    const d = RAPIER.ColliderDesc.trimesh(verts, idx, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(c.x, c.y, c.z).setCollisionGroups(GROUPS.static);
    return this.own(this.world.createCollider(d), owner);
  }

  // Ray query. Returns { dist, point, normal, collider, owner } or null.
  raycast(origin, dir, maxDist, { groups = 0xffffffff, exclude = null, excludeBody = null, solid = true, predicate } = {}) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, solid, undefined, groups, exclude, excludeBody, predicate);
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      dist: t,
      point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      collider: hit.collider,
      owner: this.ownerOf(hit.collider),
    };
  }

  // Sphere sweep (camera collision, generous pickup aiming).
  sphereCast(origin, dir, radius, maxDist, { groups = 0xffffffff, exclude = null, excludeBody = null, predicate } = {}) {
    const shape = new RAPIER.Ball(radius);
    const hit = this.world.castShape(origin, { x: 0, y: 0, z: 0, w: 1 }, dir, shape, 0, maxDist, true, undefined, groups, exclude, excludeBody, predicate);
    if (!hit) return null;
    // Shape casts report `time_of_impact` (rays use `timeOfImpact`).
    const d = hit.time_of_impact ?? hit.timeOfImpact;
    if (!Number.isFinite(d)) return null;
    return { dist: d, collider: hit.collider, owner: this.ownerOf(hit.collider) };
  }

  // All colliders overlapping a shape. Used for "is there room to grow?".
  overlaps(shape, pos, rot = { x: 0, y: 0, z: 0, w: 1 }, { groups = 0xffffffff, exclude = null, excludeBody = null, predicate } = {}) {
    const out = [];
    this.world.intersectionsWithShape(pos, rot, shape, (c) => {
      out.push(c);
      return true;
    }, undefined, groups, exclude, excludeBody, predicate);
    return out;
  }
}
