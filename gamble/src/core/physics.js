// Rapier physics wrapper. One world per loaded scene; the engine steps it at a fixed 60 Hz.
//
// Collision quality is a dealbreaker (design bible §33): every visible solid thing gets a
// collider that matches its shape. Use the helpers below so colliders stay consistent:
//   physics.addStaticBox(mesh)            – tight oriented box around a mesh's geometry
//   physics.addStaticTrimesh(mesh)        – exact triangle collider (walls, counters, props)
//   physics.addDynamicBox(mesh, opts)     – a physics prop synced back to the mesh each frame
//   physics.createCharacter({radius,height}) – capsule + Rapier kinematic character controller
// Collision groups are in GROUPS; pass them via opts.groups.

import RAPIER from 'rapier';
import * as THREE from 'three';

export { RAPIER };

// Bit layout: membership (high 16) | filter (low 16).
const g = (membership, filter) => ((membership & 0xffff) << 16) | (filter & 0xffff);
export const LAYER = {
  STATIC: 1 << 0,
  DYNAMIC: 1 << 1,
  CHARACTER: 1 << 2,
  VEHICLE: 1 << 3,
  TRIGGER: 1 << 4,
  RAGDOLL: 1 << 5,
  CAMERA_BLOCK: 1 << 6,
};
const ALL = 0xffff;
export const GROUPS = {
  static: g(LAYER.STATIC | LAYER.CAMERA_BLOCK, ALL),
  dynamic: g(LAYER.DYNAMIC, ALL),
  character: g(LAYER.CHARACTER, ALL & ~LAYER.TRIGGER),
  vehicle: g(LAYER.VEHICLE, ALL),
  trigger: g(LAYER.TRIGGER, LAYER.CHARACTER),
  ragdoll: g(LAYER.RAGDOLL, LAYER.STATIC | LAYER.DYNAMIC | LAYER.VEHICLE),
  // Thin decorative things the player can pass a hand through but the camera must not clip.
  cameraOnly: g(LAYER.CAMERA_BLOCK, 0),
};

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init();
  return ready;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _box = new THREE.Box3();

export class PhysicsWorld {
  constructor({ gravity = -9.81 } = {}) {
    this.world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
    this.world.timestep = 1 / 60;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.synced = []; // { body, object3d }
    this.colliderOwners = new Map(); // collider.handle -> any (userData for raycasts / interactions)
    this.contactHandlers = new Map(); // collider.handle -> fn(otherHandle, started)
  }

  step() {
    this.world.step(this.eventQueue);
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const a = this.contactHandlers.get(h1);
      const b = this.contactHandlers.get(h2);
      if (a) a(h2, started);
      if (b) b(h1, started);
    });
  }

  // Copy dynamic body transforms back to their Object3Ds (call after step, before render).
  sync(alpha = 1) {
    for (const s of this.synced) {
      if (s.body.isSleeping() && s._slept) continue;
      const t = s.body.translation();
      const r = s.body.rotation();
      s.object3d.position.set(t.x, t.y, t.z);
      s.object3d.quaternion.set(r.x, r.y, r.z, r.w);
      if (s.object3d.parent && s.object3d.parent.type !== 'Scene') {
        s.object3d.parent.worldToLocal(s.object3d.position);
      }
      s._slept = s.body.isSleeping();
    }
  }

  setOwner(collider, owner) {
    this.colliderOwners.set(collider.handle, owner);
  }

  ownerOf(handle) {
    return this.colliderOwners.get(handle);
  }

  onContact(collider, fn) {
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.contactHandlers.set(collider.handle, fn);
  }

  // ---- static helpers ----

  addStaticBox(objOrCenter, size, rotation, opts = {}) {
    let center, half, rot;
    if (objOrCenter && objOrCenter.isObject3D) {
      const obj = objOrCenter;
      obj.updateWorldMatrix(true, false);
      const geo = obj.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      geo.boundingBox.getCenter(_v);
      geo.boundingBox.getSize(_s);
      obj.matrixWorld.decompose(new THREE.Vector3(), _q, new THREE.Vector3());
      const scale = new THREE.Vector3();
      obj.getWorldScale(scale);
      center = _v.clone().applyMatrix4(obj.matrixWorld);
      half = { x: Math.max(0.005, (_s.x * Math.abs(scale.x)) / 2), y: Math.max(0.005, (_s.y * Math.abs(scale.y)) / 2), z: Math.max(0.005, (_s.z * Math.abs(scale.z)) / 2) };
      rot = _q.clone();
    } else {
      center = objOrCenter;
      half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
      rot = rotation || new THREE.Quaternion();
    }
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
      .setFriction(opts.friction ?? 0.8)
      .setRestitution(opts.restitution ?? 0.05)
      .setCollisionGroups(opts.groups ?? GROUPS.static);
    if (opts.sensor) desc.setSensor(true);
    const col = this.world.createCollider(desc);
    if (opts.owner) this.setOwner(col, opts.owner);
    return col;
  }

  addStaticTrimesh(mesh, opts = {}) {
    mesh.updateWorldMatrix(true, false);
    const geo = mesh.geometry.index ? mesh.geometry : mesh.geometry.clone();
    const pos = geo.attributes.position;
    const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      verts[i * 3] = _v.x;
      verts[i * 3 + 1] = _v.y;
      verts[i * 3 + 2] = _v.z;
    }
    let indices;
    if (geo.index) indices = new Uint32Array(geo.index.array);
    else {
      indices = new Uint32Array(pos.count);
      for (let i = 0; i < pos.count; i++) indices[i] = i;
    }
    const desc = RAPIER.ColliderDesc.trimesh(verts, indices)
      .setFriction(opts.friction ?? 0.8)
      .setCollisionGroups(opts.groups ?? GROUPS.static);
    const col = this.world.createCollider(desc);
    if (opts.owner) this.setOwner(col, opts.owner);
    return col;
  }

  addGround(y = 0, size = 2000, opts = {}) {
    return this.addStaticBox({ x: 0, y: y - 0.5, z: 0 }, { x: size, y: 1, z: size }, null, opts);
  }

  // ---- dynamic helpers ----

  addDynamicBox(mesh, opts = {}) {
    mesh.updateWorldMatrix(true, false);
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    _box.copy(geo.boundingBox);
    _box.getSize(_s);
    const scale = new THREE.Vector3();
    mesh.getWorldScale(scale);
    const center = new THREE.Vector3();
    _box.getCenter(center);
    mesh.getWorldPosition(_v);
    mesh.getWorldQuaternion(_q);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(_v.x, _v.y, _v.z)
      .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
      .setLinearDamping(opts.linearDamping ?? 0.05)
      .setAngularDamping(opts.angularDamping ?? 0.1)
      .setCanSleep(true)
      .setCcdEnabled(opts.ccd ?? false);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid((_s.x * scale.x) / 2, (_s.y * scale.y) / 2, (_s.z * scale.z) / 2)
      .setTranslation(center.x * scale.x, center.y * scale.y, center.z * scale.z)
      .setDensity(opts.density ?? 500)
      .setFriction(opts.friction ?? 0.6)
      .setRestitution(opts.restitution ?? 0.1)
      .setCollisionGroups(opts.groups ?? GROUPS.dynamic);
    const col = this.world.createCollider(colDesc, body);
    if (opts.owner) this.setOwner(col, opts.owner);
    this.synced.push({ body, object3d: mesh });
    return { body, collider: col };
  }

  removeBody(body) {
    this.synced = this.synced.filter((s) => s.body !== body);
    this.world.removeRigidBody(body);
  }

  // ---- character ----

  createCharacter({ radius = 0.32, height = 1.75, position = { x: 0, y: 1, z: 0 }, owner } = {}) {
    const halfHeight = Math.max(0.05, height / 2 - radius);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z)
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(GROUPS.character).setFriction(0),
      body
    );
    if (owner) this.setOwner(collider, owner);
    const controller = this.world.createCharacterController(0.02);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    controller.enableAutostep(0.32, 0.18, true); // curbs & single stairs
    controller.enableSnapToGround(0.3);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(75);
    return { body, collider, controller, radius, halfHeight };
  }

  // ---- queries ----

  raycast(origin, dir, maxToi = 100, { groups, exclude } = {}) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      groups,
      exclude,
      undefined
    );
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return {
      point: new THREE.Vector3(p.x, p.y, p.z),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: hit.timeOfImpact,
      collider: hit.collider,
      owner: this.ownerOf(hit.collider.handle),
    };
  }

  // Sphere cast used by the camera to avoid clipping through walls.
  sphereCast(origin, dir, radius, maxToi, { groups, exclude } = {}) {
    const shape = new RAPIER.Ball(radius);
    const hit = this.world.castShape(
      origin,
      { x: 0, y: 0, z: 0, w: 1 },
      dir,
      shape,
      0,
      maxToi,
      true,
      undefined,
      groups,
      exclude
    );
    return hit ? hit.time_of_impact ?? hit.toi ?? hit.timeOfImpact : null;
  }

  dispose() {
    this.world.free();
    this.eventQueue.free();
    this.synced.length = 0;
    this.colliderOwners.clear();
    this.contactHandlers.clear();
  }
}
