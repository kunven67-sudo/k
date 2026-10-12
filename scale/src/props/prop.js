// A Prop is any loose real-world object: a soda can, a chair, a crumb, a car.
// Rule 4: if you can see it, it's real. Every prop has a physics body whose shape matches the model,
// its real mass, a material (for sounds and breaking), and can be resized by the shrink ray.
//
// Definitions describe the object at its real size (scale 1). Shapes are in meters, local to the
// model's origin (bottom center for things that stand on the ground):
//   { t:'box', s:[hx,hy,hz], p:[x,y,z], rot:[rx,ry,rz] }  half-extents
//   { t:'cyl', r, h, p, rot }                               h = half height (axis Y)
//   { t:'ball', r, p }
//   { t:'cap', r, h, p, rot }                               capsule, h = half height of the middle
//   { t:'hull', pts:[[x,y,z],...] }
import * as THREE from 'three';
import { RAPIER, GROUPS } from '../core/physics.js';
import { clamp } from '../core/util.js';
import { mergeByMaterial } from '../render/merge.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _box = new THREE.Box3();
const _anchor = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const ZERO = new THREE.Vector3();

function shapeVolume(sh) {
  switch (sh.t) {
    case 'box': return 8 * sh.s[0] * sh.s[1] * sh.s[2];
    case 'cyl': return Math.PI * sh.r * sh.r * 2 * sh.h;
    case 'ball': return (4 / 3) * Math.PI * sh.r ** 3;
    case 'cap': return Math.PI * sh.r * sh.r * 2 * sh.h + (4 / 3) * Math.PI * sh.r ** 3;
    case 'hull': {
      const b = new THREE.Box3();
      for (const p of sh.pts) b.expandByPoint(_v.fromArray(p));
      const s = b.getSize(_v);
      return s.x * s.y * s.z * 0.5;
    }
    default: return 0;
  }
}

function makeShape(sh, s) {
  switch (sh.t) {
    case 'box': return new RAPIER.Cuboid(sh.s[0] * s, sh.s[1] * s, sh.s[2] * s);
    case 'cyl': return new RAPIER.Cylinder(sh.h * s, sh.r * s);
    case 'ball': return new RAPIER.Ball(sh.r * s);
    case 'cap': return new RAPIER.Capsule(sh.h * s, sh.r * s);
    case 'hull': {
      const f = new Float32Array(sh.pts.length * 3);
      sh.pts.forEach((p, i) => { f[i * 3] = p[0] * s; f[i * 3 + 1] = p[1] * s; f[i * 3 + 2] = p[2] * s; });
      return new RAPIER.ConvexPolyhedron(f, null);
    }
  }
  return null;
}

function makeColliderDesc(sh, s, com) {
  const d = new RAPIER.ColliderDesc(makeShape(sh, s));
  const p = sh.p || [0, 0, 0];
  d.setTranslation((p[0] - com.x) * s, (p[1] - com.y) * s, (p[2] - com.z) * s);
  const r = sh.r3 || sh.rot;
  if (r) {
    _q.setFromEuler(_e.set(r[0], r[1], r[2]));
    d.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
  }
  return d;
}

// Real terminal velocity: small and light things fall slower through air (master list section 1).
export function terminalVelocity(size, density) {
  return clamp(32 * Math.sqrt(Math.max(1e-6, size) * Math.max(0.03, density / 1000)), 0.05, 90);
}

export const MATERIALS = {
  glass: { friction: 0.4, restitution: 0.2, breakSpeed: 3.5 },
  ceramic: { friction: 0.5, restitution: 0.15, breakSpeed: 4.0 },
  metal: { friction: 0.45, restitution: 0.25 },
  aluminum: { friction: 0.4, restitution: 0.2 },
  wood: { friction: 0.6, restitution: 0.25 },
  plastic: { friction: 0.5, restitution: 0.35 },
  cardboard: { friction: 0.7, restitution: 0.1 },
  paper: { friction: 0.8, restitution: 0.05 },
  fabric: { friction: 0.9, restitution: 0.05 },
  rubber: { friction: 1.0, restitution: 0.75 },
  food: { friction: 0.8, restitution: 0.08 },
  stone: { friction: 0.7, restitution: 0.15 },
};

// Would a thing built from `def` at scale s, with its model origin (bottom center) at `origin` and
// turned by `quat`, overlap anything solid? Light loose things (less than a quarter of its weight)
// don't count: they'd just get pushed aside. `strict` counts everything, including you.
export function fitsAt(game, def, s, origin, quat, { excludeBody = null, mass = def.mass * s ** 3, strict = false } = {}) {
  const physics = game.physics;
  const size = (def.size || 0.1) * s;
  // Lift clears the small resting overlap physics allows between touching things.
  const lift = Math.max(size * 0.04, 4e-5);
  for (const sh of def.shapes) {
    const d = makeColliderDesc(sh, s * 0.97, ZERO);
    const p = sh.p || [0, 0, 0];
    _v.set(p[0] * s, p[1] * s, p[2] * s).applyQuaternion(quat);
    let rot = quat;
    const r = sh.r3 || sh.rot;
    if (r) rot = _q2.copy(quat).multiply(_q3.setFromEuler(_e.set(r[0], r[1], r[2])));
    const pos = { x: origin.x + _v.x, y: origin.y + _v.y + lift, z: origin.z + _v.z };
    const blockers = physics.overlaps(d.shape, pos, { x: rot.x, y: rot.y, z: rot.z, w: rot.w }, {
      excludeBody,
      predicate: (c) => {
        const o = physics.ownerOf(c);
        if (!o) return true; // static world
        if (o === game.player) return strict;
        if (o.held) return false;
        if (strict) return true;
        return o.mass === undefined || o.mass > mass * 4; // light things just get pushed
      },
    });
    if (blockers.length) return false;
  }
  return true;
}

// Center of mass of a definition (scale 1, model space), volume-weighted over its shapes.
export function defCenterOfMass(def, out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  let vol = 0;
  for (const sh of def.shapes) {
    const p = sh.p || [0, 0, 0];
    const v = shapeVolume(sh);
    out.addScaledVector(_v.set(p[0], p[1], p[2]), v);
    vol += v;
  }
  return out.divideScalar(Math.max(1e-12, vol));
}

export class Prop {
  constructor(game, def, { position = [0, 0, 0], rotationY = 0, quaternion = null, scale = 1, sleeping = true } = {}) {
    this.game = game;
    this.def = def;
    this.name = def.name;
    this.kind = 'prop';
    this.scale = scale;
    this.mat = MATERIALS[def.material] || MATERIALS.plastic;
    this.volume1 = def.shapes.reduce((a, sh) => a + shapeVolume(sh), 0); // m^3 at scale 1
    // Center of mass (scale 1, model space). The physics body's origin sits exactly here, so resizing
    // never shifts it (Rapier keeps a body's center of mass fixed when its shapes change).
    this.com1 = new THREE.Vector3();
    for (const sh of def.shapes) {
      const p = sh.p || [0, 0, 0];
      this.com1.addScaledVector(_v.set(p[0], p[1], p[2]), shapeVolume(sh));
    }
    this.com1.divideScalar(Math.max(1e-12, this.volume1));
    this.density = def.mass / Math.max(1e-9, this.volume1);
    this.size1 = def.size || this._extent();

    this.object = new THREE.Group();
    this.object.name = def.id;
    this.model = def.build();
    if (!def.noMerge) mergeByMaterial(this.model);
    this.model.position.copy(this.com1).negate(); // model origin (bottom center) relative to the center of mass
    this.object.add(this.model);
    this.object.userData.prop = this;
    this.object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.castShadow !== false && !def.noShadow;
        o.receiveShadow = true;
      }
    });

    const physics = game.physics;
    if (quaternion) _q.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    else _q.setFromAxisAngle(_v.set(0, 1, 0), rotationY || 0);
    const c = _v.copy(this.com1).multiplyScalar(scale).applyQuaternion(_q);
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position[0] + c.x, position[1] + c.y, position[2] + c.z)
      .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
      .setCanSleep(true)
      .setCcdEnabled(true);
    this.body = physics.world.createRigidBody(bd);
    this.colliders = [];
    this._buildColliders();
    // Spawn safety (no-bugs rulebook): never start inside a wall, table or person. Lift until free.
    if (!this.hasRoomAt(scale, this.body.translation())) {
      const step = this.size1 * scale * 0.05;
      for (let i = 1; i <= 60; i++) {
        const t = this.body.translation();
        const up = { x: t.x, y: t.y + step, z: t.z };
        this.body.setTranslation(up, false);
        if (this.hasRoomAt(scale, up)) break;
      }
    }
    if (sleeping) this.body.sleep();

    this.prevPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.curPos = new THREE.Vector3();
    this.curQuat = new THREE.Quaternion();
    this._readBody(this.curPos, this.curQuat);
    this.prevPos.copy(this.curPos);
    this.prevQuat.copy(this.curQuat);
    this.object.position.copy(this.curPos);
    this.object.quaternion.copy(this.curQuat);
    this.object.scale.setScalar(scale);
    game.scene.add(this.object);
    physics.synced.add(this);
    game.props.add(this);
  }

  _extent() {
    const b = new THREE.Box3();
    for (const sh of this.def.shapes) {
      const p = sh.p || [0, 0, 0];
      const r = sh.t === 'box' ? Math.max(...sh.s) : sh.r + (sh.h || 0);
      b.expandByPoint(_v.set(p[0] - r, p[1] - r, p[2] - r));
      b.expandByPoint(_v.set(p[0] + r, p[1] + r, p[2] + r));
    }
    const s = b.getSize(_v);
    return Math.max(s.x, s.y, s.z);
  }

  get mass() {
    return this.def.mass * this.scale ** 3;
  }

  get size() {
    return this.size1 * this.scale;
  }

  // Resize the existing colliders in place. Rebuilding them would throw away their contacts, and a
  // collider with no contacts "falls" every step (that's how a resized can once fell through a table).
  _resizeColliders() {
    const s = this.scale;
    this.def.shapes.forEach((sh, i) => {
      const c = this.colliders[i];
      c.setShape(makeShape(sh, s));
      const p = sh.p || [0, 0, 0];
      const m = this.com1;
      c.setTranslationWrtParent({ x: (p[0] - m.x) * s, y: (p[1] - m.y) * s, z: (p[2] - m.z) * s });
    });
    this._setDamping();
  }

  _setDamping() {
    const vt = terminalVelocity(this.size, this.density);
    this.body.setLinearDamping(9.81 / vt * 0.5);
    this.body.setAngularDamping(this.size < 0.05 ? 0.6 : 0.15);
  }

  _buildColliders() {
    const physics = this.game.physics;
    for (const c of this.colliders) physics.removeCollider(c);
    this.colliders = [];
    const s = this.scale;
    for (const sh of this.def.shapes) {
      const d = makeColliderDesc(sh, s, this.com1)
        .setDensity(this.density)
        .setFriction(this.mat.friction)
        .setRestitution(this.mat.restitution)
        .setCollisionGroups(this.held ? GROUPS.held : GROUPS.prop);
      const c = physics.world.createCollider(d, this.body);
      physics.own(c, this);
      this.colliders.push(c);
    }
    this._setDamping();
  }

  setGroups(g) {
    for (const c of this.colliders) c.setCollisionGroups(g);
  }

  // Resize in place. The shape's center stays put sideways; if growing would push its lowest point
  // into what it's resting on, it's lifted by exactly that much (never pushed down: when something
  // shrinks it just settles with gravity, like it would for real). Returns false if there's no room
  // to grow (the ray stops growing it).
  setScale(s, { force = false } = {}) {
    s = clamp(s, 1e-4, 200);
    if (s === this.scale) return true;
    const t = this.body.translation();
    const obj = this.object;
    obj.position.set(t.x, t.y, t.z);
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj);
    const cx0 = (_box.min.x + _box.max.x) / 2, cz0 = (_box.min.z + _box.max.z) / 2, y0 = _box.min.y;
    const oldScale = this.scale;
    obj.scale.setScalar(s);
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj);
    const cx1 = (_box.min.x + _box.max.x) / 2, cz1 = (_box.min.z + _box.max.z) / 2, y1 = _box.min.y;
    // Resting things keep their bottom planted. Things in the air resize around their center of mass
    // and are only ever lifted, never pushed down into something.
    let resting = this.resizeResting;
    if (!this.resizing) {
      const lv = this.body.linvel();
      resting = Math.abs(lv.y) < Math.max(0.02, this.size * 0.5) && Math.hypot(lv.x, lv.z) < Math.max(0.05, this.size);
    }
    const dy = resting ? y0 - y1 : Math.max(0, y0 - y1);
    const newOrigin = _v2.set(t.x + (cx0 - cx1), t.y + dy, t.z + (cz0 - cz1));
    if (s > oldScale && !force && !this.hasRoomAt(s, newOrigin)) {
      obj.scale.setScalar(oldScale);
      obj.updateMatrixWorld(true);
      return false;
    }
    this.scale = s;
    this._resizeColliders();
    this.body.setTranslation({ x: newOrigin.x, y: newOrigin.y, z: newOrigin.z }, true);
    // Kinematic bodies move to their "next" position each step; set it too or they snap back.
    this.body.setNextKinematicTranslation({ x: newOrigin.x, y: newOrigin.y, z: newOrigin.z });
    this.curPos.copy(newOrigin);
    this.prevPos.copy(newOrigin);
    obj.position.copy(newOrigin);
    this.lastResizeStep = this.game.physics.stepCount;
    // A single resize that isn't part of a beam (spawning, loading) still needs fresh contacts.
    if (!this.resizing) {
      this.beginResize();
      this.autoEnd = true;
    }
    this.body.wakeUp();
    return true;
  }

  // The ray's field holds the object while it's resizing: kinematic (no gravity, no stale contacts),
  // bottom planted. Released back to normal physics when the beam lets go.
  beginResize() {
    if (this.resizing) return;
    const lv = this.body.linvel();
    this.resizeResting = Math.abs(lv.y) < Math.max(0.02, this.size * 0.5) && Math.hypot(lv.x, lv.z) < Math.max(0.05, this.size);
    this.resizing = true;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const t = this.body.translation();
    this.body.setNextKinematicTranslation(t);
    this.body.setNextKinematicRotation(this.body.rotation());
  }

  endResize() {
    if (!this.resizing) return;
    this.resizing = false;
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.body.wakeUp();
  }

  // Would the prop at scale s (origin at `at`) overlap anything solid it can't push?
  hasRoomAt(s, at = null) {
    const t = at || this.body.translation();
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    // Model origin = center of mass position minus the rotated center-of-mass offset.
    _origin.copy(this.com1).multiplyScalar(s).applyQuaternion(_q);
    _anchor.set(t.x - _origin.x, t.y - _origin.y, t.z - _origin.z);
    return fitsAt(this.game, this.def, s, _anchor, _q, { excludeBody: this.body, mass: this.def.mass * s ** 3 });
  }

  _readBody(pos, quat) {
    const t = this.body.translation();
    const r = this.body.rotation();
    pos.set(t.x, t.y, t.z);
    quat.set(r.x, r.y, r.z, r.w);
  }

  savePrev() {
    if (this.resizing && this.game.physics.stepCount - (this.lastResizeStep ?? 0) > 3) {
      this.endResize();
      this.autoEnd = false;
    }
    this.prevPos.copy(this.curPos);
    this.prevQuat.copy(this.curQuat);
  }

  sync(alpha) {
    this._readBody(this.curPos, this.curQuat);
    if (this.body.isSleeping()) {
      this.object.position.copy(this.curPos);
      this.object.quaternion.copy(this.curQuat);
      this.prevPos.copy(this.curPos);
      this.prevQuat.copy(this.curQuat);
      return;
    }
    this.object.position.lerpVectors(this.prevPos, this.curPos, alpha);
    this.object.quaternion.slerpQuaternions(this.prevQuat, this.curQuat, alpha);
  }

  // Safety net (no-bugs rulebook): anything that falls out of the world comes back.
  checkBounds() {
    const t = this.body.translation();
    if (t.y < -50 || !Number.isFinite(t.y)) {
      console.warn(`[scale] ${this.name} fell out of the world, putting it back`);
      this.body.setTranslation({ x: 0, y: 2, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  dispose() {
    this.game.physics.synced.delete(this);
    this.game.props.delete(this);
    this.game.physics.removeBody(this.body);
    this.object.removeFromParent();
  }
}
