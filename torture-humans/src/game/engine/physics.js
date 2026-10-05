// Physics with Rapier (Rust/WASM): fixed 60 Hz steps, colliders that follow the
// real shape of things (triangle meshes for the static world, convex hulls for
// props), a capsule character controller that climbs steps and slides along walls.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const STEP = 1 / 60;

// collision groups: (membership << 16) | filter
export const GROUP = {
  WORLD: 1 << 0,
  PROP: 1 << 1,
  PLAYER: 1 << 2,
  NPC: 1 << 3,
  TINY: 1 << 4,
  TRIGGER: 1 << 5,
  RAGDOLL: 1 << 6,
};
export const groups = (member, filter = 0xffff) => ((member & 0xffff) << 16) | (filter & 0xffff);

let ready = null;
export function initPhysics() {
  ready ??= RAPIER.init();
  return ready;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

// Collects world-space triangles from a mesh tree (skips anything marked noCollide).
export function collectTriangles(root, { filter = () => true } = {}) {
  const vertices = [];
  const indices = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.noCollide || !filter(o)) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    if (!pos) return;
    const base = vertices.length / 3;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      vertices.push(_v.x, _v.y, _v.z);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(base + i);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

// convex hull points of a mesh in its own local frame (scale baked in)
function hullPoints(mesh) {
  const pos = mesh.geometry.attributes.position;
  mesh.updateMatrixWorld(true);
  mesh.matrixWorld.decompose(_v, _q, _s);
  const pts = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    pts[i * 3] = pos.getX(i) * _s.x;
    pts[i * 3 + 1] = pos.getY(i) * _s.y;
    pts[i * 3 + 2] = pos.getZ(i) * _s.z;
  }
  return pts;
}

export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.events = new RAPIER.EventQueue(true);
    this.accumulator = 0;
    this.bodies = new Map(); // rigid body handle -> { body, object, onContact }
    this.alpha = 0;          // interpolation factor for rendering
    this.owners = new Map(); // collider handle -> game object (humans, bugs...)
  }

  // Static world geometry as an exact triangle mesh (floors, walls, stairs, terrain).
  addStaticMesh(root, { friction = 0.8, group = GROUP.WORLD, filter } = {}) {
    const { vertices, indices } = collectTriangles(root, { filter });
    if (!indices.length) return null;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setFriction(friction)
      .setCollisionGroups(groups(group));
    const collider = this.world.createCollider(desc, body);
    return { body, collider };
  }

  // A movable prop: convex hull of its own mesh (or several meshes = compound shape).
  addDynamic(object, { mass = 1, friction = 0.6, restitution = 0.1, group = GROUP.PROP, ccd = false, kinematic = false, linearDamping = 0.05, angularDamping = 0.1 } = {}) {
    object.updateMatrixWorld(true);
    object.matrixWorld.decompose(_v, _q, _s);
    const desc = (kinematic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic())
      .setTranslation(_v.x, _v.y, _v.z)
      .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
      .setLinearDamping(linearDamping)
      .setAngularDamping(angularDamping)
      .setCcdEnabled(ccd);
    const body = this.world.createRigidBody(desc);
    const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const meshes = [];
    object.traverse((o) => { if (o.isMesh && !o.userData.noCollide) meshes.push(o); });
    let totalVerts = 0;
    for (const m of meshes) totalVerts += m.geometry.attributes.position.count;
    for (const m of meshes) {
      // hull in the body's frame
      const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      const pos = m.geometry.attributes.position;
      const pts = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(local).multiply(_s);
        pts.set([_v.x, _v.y, _v.z], i * 3);
      }
      const cd = RAPIER.ColliderDesc.convexHull(pts);
      if (!cd) continue;
      cd.setFriction(friction).setRestitution(restitution).setCollisionGroups(groups(group))
        .setMass(mass * (pos.count / Math.max(1, totalVerts)))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
      this.world.createCollider(cd, body);
    }
    const rec = { body, object, prev: { p: _v.clone().set(0, 0, 0), q: new THREE.Quaternion() }, scale: _s.clone() };
    rec.prev.p.copy(body.translation());
    rec.prev.q.copy(body.rotation());
    this.bodies.set(body.handle, rec);
    object.userData.body = body;
    return body;
  }

  // A body that follows something moved by code (a walking human): other things
  // collide with it, rays hit it, and ownerOf(collider) says who it belongs to.
  addKinematicCapsule(owner, { radius = 0.28, height = 1.8, position = { x: 0, y: 0, z: 0 }, group = GROUP.NPC } = {}) {
    const half = Math.max(0.005, height / 2 - radius);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y + height / 2, position.z));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(half, radius).setCollisionGroups(groups(group)), body);
    this.owners.set(collider.handle, owner);
    return { body, collider, radius, height };
  }

  // move a kinematic capsule so its feet are at p
  placeCapsule(cap, p) {
    cap.body.setNextKinematicTranslation({ x: p.x, y: p.y + cap.height / 2, z: p.z });
  }

  setCapsuleGroup(cap, group) {
    cap.collider.setCollisionGroups(groups(group));
  }

  resizeCapsule(cap, height, radius) {
    cap.collider.setHalfHeight(Math.max(0.005, height / 2 - radius));
    cap.collider.setRadius(radius);
    cap.height = height;
    cap.radius = radius;
  }

  removeCapsule(cap) {
    this.owners.delete(cap.collider.handle);
    this.world.removeRigidBody(cap.body);
  }

  ownerOf(collider) {
    return collider ? this.owners.get(collider.handle ?? collider) ?? null : null;
  }

  remove(body) {
    if (!body) return;
    this.bodies.delete(body.handle);
    this.world.removeRigidBody(body);
  }

  // Capsule character controller: walks up steps, slides on walls, snaps to ground.
  createCharacter({ radius = 0.3, height = 1.8, position = { x: 0, y: 1, z: 0 }, group = GROUP.PLAYER, stepHeight = 0.35, maxSlope = 50 } = {}) {
    const half = Math.max(0.01, height / 2 - radius);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y + height / 2, position.z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, radius).setCollisionGroups(groups(group, ~GROUP.TRIGGER & 0xffff)),
      body,
    );
    const ctrl = this.world.createCharacterController(0.02);
    ctrl.setUp({ x: 0, y: 1, z: 0 });
    ctrl.setSlideEnabled(true);
    ctrl.enableAutostep(stepHeight, radius * 0.5, false);
    ctrl.enableSnapToGround(stepHeight);
    ctrl.setMaxSlopeClimbAngle((maxSlope * Math.PI) / 180);
    ctrl.setMinSlopeSlideAngle(((maxSlope + 5) * Math.PI) / 180);
    ctrl.setApplyImpulsesToDynamicBodies(true);
    ctrl.setCharacterMass(75);
    return { body, collider, ctrl, radius, height, half };
  }

  // Moves a character by a desired offset; returns the real movement + grounded.
  // filter: which groups block you (e.g. full-size you walks through - onto - tiny people)
  moveCharacter(ch, desired, { filter = GROUP.WORLD | GROUP.PROP | GROUP.NPC } = {}) {
    ch.ctrl.computeColliderMovement(ch.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(GROUP.PLAYER, filter));
    const m = ch.ctrl.computedMovement();
    const t = ch.body.translation();
    ch.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    return { x: m.x, y: m.y, z: m.z, grounded: ch.ctrl.computedGrounded() };
  }

  // resize the capsule (crouching, shrinking) keeping the feet where they are
  resizeCharacter(ch, height, radius = ch.radius) {
    const t = ch.body.translation();
    const feet = t.y - ch.height / 2;
    const half = Math.max(0.01, height / 2 - radius);
    ch.collider.setHalfHeight(half);
    ch.collider.setRadius(radius);
    ch.height = height;
    ch.radius = radius;
    ch.half = half;
    ch.body.setTranslation({ x: t.x, y: feet + height / 2, z: t.z }, true);
  }

  // would a capsule of this height fit here (standing up under a table)?
  // would a capsule of this height and radius fit where the character stands (feet stay put)?
  fitsCapsule(ch, height, radius) {
    const t = ch.body.translation();
    const feet = t.y - ch.height / 2;
    const half = Math.max(0.0005, height / 2 - radius);
    const shape = new RAPIER.Capsule(half, radius * 0.95);
    let hit = false;
    this.world.intersectionsWithShape(
      { x: t.x, y: feet + height / 2 + radius * 0.1, z: t.z }, { x: 0, y: 0, z: 0, w: 1 }, shape,
      () => { hit = true; return false; },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP), ch.collider,
    );
    return !hit;
  }

  fits(ch, height) {
    const t = ch.body.translation();
    const feet = t.y - ch.height / 2;
    const half = Math.max(0.01, height / 2 - ch.radius);
    const shape = new RAPIER.Capsule(half, ch.radius * 0.95);
    let hit = false;
    this.world.intersectionsWithShape(
      { x: t.x, y: feet + height / 2 + 0.02, z: t.z }, { x: 0, y: 0, z: 0, w: 1 }, shape,
      () => { hit = true; return false; },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP), ch.collider,
    );
    return !hit;
  }

  raycast(origin, dir, maxToi = 100, { exclude, filterGroups } = {}) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxToi, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, filterGroups, exclude);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return { point: new THREE.Vector3(p.x, p.y, p.z), normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), distance: hit.timeOfImpact, collider: hit.collider, owner: this.ownerOf(hit.collider) };
  }

  // Fixed-step update; returns the number of steps taken.
  update(dt, beforeStep) {
    this.accumulator += Math.min(Math.max(0, dt), 0.25); // never backwards; don't spiral after a long stall
    let steps = 0;
    while (this.accumulator >= STEP) {
      for (const rec of this.bodies.values()) {
        rec.prev.p.copy(rec.body.translation());
        rec.prev.q.copy(rec.body.rotation());
      }
      beforeStep?.(STEP);
      this.world.step(this.events);
      this.accumulator -= STEP;
      steps++;
    }
    this.alpha = this.accumulator / STEP;
    this.sync();
    return steps;
  }

  // copy body transforms to their objects, interpolated for smooth motion at any FPS
  sync() {
    for (const rec of this.bodies.values()) {
      const { body, object, prev } = rec;
      if (body.isSleeping()) continue;
      const t = body.translation();
      const r = body.rotation();
      _v.set(t.x, t.y, t.z);
      _q.set(r.x, r.y, r.z, r.w);
      object.position.lerpVectors(prev.p, _v, this.alpha);
      object.quaternion.slerpQuaternions(prev.q, _q, this.alpha);
      if (object.parent && !object.parent.isScene) {
        // bodies live in world space; convert if the object has a transformed parent
        object.parent.updateMatrixWorld(true);
        _m.copy(object.parent.matrixWorld).invert();
        object.position.applyMatrix4(_m);
        object.quaternion.premultiply(_q.setFromRotationMatrix(_m));
      }
    }
  }
}

export { RAPIER, hullPoints };
