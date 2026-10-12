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

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

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

function makeColliderDesc(sh, s) {
  let d;
  switch (sh.t) {
    case 'box': d = RAPIER.ColliderDesc.cuboid(sh.s[0] * s, sh.s[1] * s, sh.s[2] * s); break;
    case 'cyl': d = RAPIER.ColliderDesc.cylinder(sh.h * s, sh.r * s); break;
    case 'ball': d = RAPIER.ColliderDesc.ball(sh.r * s); break;
    case 'cap': d = RAPIER.ColliderDesc.capsule(sh.h * s, sh.r * s); break;
    case 'hull': {
      const f = new Float32Array(sh.pts.length * 3);
      sh.pts.forEach((p, i) => { f[i * 3] = p[0] * s; f[i * 3 + 1] = p[1] * s; f[i * 3 + 2] = p[2] * s; });
      d = RAPIER.ColliderDesc.convexHull(f);
      break;
    }
  }
  const p = sh.p || [0, 0, 0];
  d.setTranslation(p[0] * s, p[1] * s, p[2] * s);
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

export class Prop {
  constructor(game, def, { position = [0, 0, 0], rotationY = 0, quaternion = null, scale = 1, sleeping = true } = {}) {
    this.game = game;
    this.def = def;
    this.name = def.name;
    this.kind = 'prop';
    this.scale = scale;
    this.mat = MATERIALS[def.material] || MATERIALS.plastic;
    this.volume1 = def.shapes.reduce((a, sh) => a + shapeVolume(sh), 0); // m^3 at scale 1
    this.density = def.mass / Math.max(1e-9, this.volume1);
    this.size1 = def.size || this._extent();

    this.object = new THREE.Group();
    this.object.name = def.id;
    this.model = def.build();
    this.object.add(this.model);
    this.object.userData.prop = this;
    this.object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.castShadow !== false && !def.noShadow;
        o.receiveShadow = true;
      }
    });

    const physics = game.physics;
    const bd = RAPIER.RigidBodyDesc.dynamic().setTranslation(position[0], position[1], position[2]).setCanSleep(true).setCcdEnabled(true);
    if (quaternion) bd.setRotation(quaternion);
    else if (rotationY) {
      _q.setFromAxisAngle(_v.set(0, 1, 0), rotationY);
      bd.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    this.body = physics.world.createRigidBody(bd);
    this.colliders = [];
    this._buildColliders();
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

  _buildColliders() {
    const physics = this.game.physics;
    for (const c of this.colliders) physics.removeCollider(c);
    this.colliders = [];
    const s = this.scale;
    for (const sh of this.def.shapes) {
      const d = makeColliderDesc(sh, s)
        .setDensity(this.density)
        .setFriction(this.mat.friction)
        .setRestitution(this.mat.restitution)
        .setCollisionGroups(this.held ? GROUPS.held : GROUPS.prop);
      const c = physics.world.createCollider(d, this.body);
      physics.own(c, this);
      this.colliders.push(c);
    }
    const vt = terminalVelocity(this.size, this.density);
    this.body.setLinearDamping(9.81 / vt * 0.5);
    this.body.setAngularDamping(this.size < 0.05 ? 0.6 : 0.15);
  }

  setGroups(g) {
    for (const c of this.colliders) c.setCollisionGroups(g);
  }

  // Resize around the model origin. Returns false if there's no room (the ray stops growing it).
  setScale(s, { force = false } = {}) {
    s = clamp(s, 1e-4, 200);
    if (s === this.scale) return true;
    if (s > this.scale && !force && !this.hasRoomAt(s)) return false;
    this.scale = s;
    this.object.scale.setScalar(s);
    this._buildColliders();
    this.body.wakeUp();
    return true;
  }

  // Would the prop at scale s overlap anything solid it can't push? (walls, floors, heavy stuff)
  hasRoomAt(s) {
    const physics = this.game.physics;
    const t = this.body.translation();
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    for (const sh of this.def.shapes) {
      const d = makeColliderDesc(sh, s * 0.98);
      const p = sh.p || [0, 0, 0];
      _v.set(p[0] * s, p[1] * s, p[2] * s).applyQuaternion(_q);
      // A tiny lift so resting contact with the floor doesn't count as "no room".
      const pos = { x: t.x + _v.x, y: t.y + _v.y + this.size * s * 0.01, z: t.z + _v.z };
      const blockers = physics.overlaps(d.shape, pos, r, {
        excludeBody: this.body,
        predicate: (c) => {
          const o = physics.ownerOf(c);
          if (!o) return true; // static world
          if (o === this.game.player) return false;
          return o.mass === undefined || o.mass > this.mass * 4; // light things just get pushed
        },
      });
      if (blockers.length) return false;
    }
    return true;
  }

  _readBody(pos, quat) {
    const t = this.body.translation();
    const r = this.body.rotation();
    pos.set(t.x, t.y, t.z);
    quat.set(r.x, r.y, r.z, r.w);
  }

  savePrev() {
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
