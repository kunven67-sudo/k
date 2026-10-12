// Creatures: bugs and animals with real bodies, real legs and reasons for what they do.
//
// A creature is built at its real size (meters) facing -Z, and scaled as a whole by the RIFT field.
// It walks on whatever is under it (floor, table, soil in a terrarium) by casting rays down, stops at
// edges and walls, and its legs really step: each foot stays planted on the ground until the body has
// moved far enough, then lifts and swings to a new spot (insects walk with alternating groups of legs).
// Its body is a kinematic physics body, so you bump into it, things land on it, and the shrink ray
// can hit it.
import * as THREE from 'three';
import { RAPIER, GROUPS } from '../core/physics.js';
import { clamp, damp, angDiff } from '../core/util.js';
import { fitsAt } from '../props/prop.js';
import { terminalVelocity } from '../props/prop.js';

const UP = new THREE.Vector3(0, 1, 0);
const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _ankle = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _seg = new THREE.Vector3();

// ---- geometry helpers ---------------------------------------------------------------------------
// A tapered segment from y = 0 to y = len (so it can be pointed from one joint to the next).
// `flat` squashes it front-to-back (z); `flatX` squashes it side-to-side (x).
export function segmentGeo(len, r0, r1, radial = 8, flat = 1, flatX = 1) {
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
  g.translate(0, len / 2, 0);
  if (flat !== 1 || flatX !== 1) g.scale(flatX, 1, flat);
  return g;
}

// Point a segment mesh (built along +Y from 0) from a to b, stretching it to fit exactly.
export function aimSegment(mesh, a, b, len) {
  _seg.subVectors(b, a);
  const d = _seg.length();
  if (d < 1e-9) return;
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(Y, _seg.divideScalar(d));
  mesh.scale.set(1, d / len, 1);
}

// Two-bone IK: the knee position for a leg from hip to target with segment lengths a and b,
// bending toward `pole` (a direction). Unreachable targets get the leg stretched straight.
export function solveKnee(hip, target, a, b, pole, out) {
  _v.subVectors(target, hip);
  let d = _v.length();
  const u = d > 1e-9 ? _v.divideScalar(d) : _v.set(0, -1, 0);
  d = clamp(d, Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  // Bend direction: the pole minus its part along the leg.
  _v2.copy(pole).addScaledVector(u, -pole.dot(u));
  if (_v2.lengthSq() < 1e-12) _v2.set(0, 1, 0);
  _v2.normalize();
  return out.copy(hip).addScaledVector(u, a * cosA).addScaledVector(_v2, a * sinA);
}

// ---- legs -------------------------------------------------------------------------------------
// One walking leg: hip on the body, femur + tibia solved with IK, tarsus (the foot) lying on the ground.
export class Leg {
  constructor({ hip, rest, femur, tibia, tarsus, side, group, mats, radius = [0.0006, 0.0004, 0.00025] }) {
    this.hip = new THREE.Vector3().fromArray(hip); // model space (scale 1)
    this.rest = new THREE.Vector3().fromArray(rest); // where the foot likes to be (model space, on the ground)
    this.len = [femur, tibia, tarsus];
    this.side = side;
    this.group = group;
    this.foot = new THREE.Vector3(); // planted foot (world)
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.t = 1; // step progress, 1 = planted
    this.dur = 0.1;
    this.lift = 0;
    this.meshes = [
      new THREE.Mesh(segmentGeo(femur, radius[0], radius[0] * 0.8, 8, 0.85), mats.leg),
      new THREE.Mesh(segmentGeo(tibia, radius[1], radius[1] * 0.7, 7), mats.leg),
      new THREE.Mesh(segmentGeo(tarsus, radius[2], radius[2] * 0.6, 6), mats.leg),
    ];
    for (const m of this.meshes) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.knee = new THREE.Vector3();
    this.footL = new THREE.Vector3();
  }
}

export class Creature {
  constructor(game, species, { position = [0, 0, 0], yaw = 0, scale = 1 } = {}) {
    this.game = game;
    this.species = species;
    this.def = species; // for the shop/spawn code (shapes, size, mass)
    this.kind = 'creature';
    this.name = species.name;
    this.scale = scale;
    this.pos = new THREE.Vector3().fromArray(position); // ground point under the body center
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.speed = 0; // current forward speed (m/s)
    this.wantSpeed = 0;
    this.velY = 0;
    this.airborne = false;
    this.alive = true;
    this.blocked = 0; // seconds since the path ahead was blocked (wall, edge)
    this.t = 0;

    this.object = new THREE.Group();
    this.object.name = species.id;
    this.object.userData.creature = this;
    this.model = species.build(this);
    this.object.add(this.model);
    this.legs = this.model.userData.legs || [];
    for (const l of this.legs) for (const m of l.meshes) this.model.add(m);
    game.scene.add(this.object);

    // Physics: kinematic body (it moves itself), colliders from the species shapes.
    const physics = game.physics;
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, this.pos.y, this.pos.z));
    this.colliders = [];
    for (const sh of species.shapes) {
      const c = physics.world.createCollider(this._colliderDesc(sh, scale), this.body);
      physics.own(c, this);
      this.colliders.push(c);
    }
    this._syncBody(true);
    this._place(true);
    game.creatures.add(this);
    game.updatables.add(this);
  }

  get size() {
    return this.species.size * this.scale; // body length (m)
  }

  get mass() {
    return this.species.mass * this.scale ** 3;
  }

  _shape(sh, s) {
    switch (sh.t) {
      case 'box': return new RAPIER.Cuboid(sh.s[0] * s, sh.s[1] * s, sh.s[2] * s);
      case 'ball': return new RAPIER.Ball(sh.r * s);
      case 'cap': return new RAPIER.Capsule(sh.h * s, sh.r * s);
      default: return new RAPIER.Ball((sh.r || 0.005) * s);
    }
  }

  _colliderDesc(sh, s) {
    const d = new RAPIER.ColliderDesc(this._shape(sh, s)).setCollisionGroups(GROUPS.creature).setFriction(0.8);
    const p = sh.p || [0, 0, 0];
    d.setTranslation(p[0] * s, p[1] * s, p[2] * s);
    if (sh.rot) {
      _q.setFromEuler(_e.set(sh.rot[0], sh.rot[1], sh.rot[2]));
      d.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    return d;
  }

  _syncBody(teleport = false) {
    _q.setFromAxisAngle(UP, this.yaw);
    const t = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    const r = { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
    if (teleport) {
      this.body.setTranslation(t, true);
      this.body.setRotation(r, true);
    }
    this.body.setNextKinematicTranslation(t);
    this.body.setNextKinematicRotation(r);
  }

  // Resize (the shrink ray). Growing needs room, like everything else.
  setScale(s, { force = false } = {}) {
    s = clamp(s, 0.002, 400);
    if (s === this.scale) return true;
    if (s > this.scale && !force) {
      _q.setFromAxisAngle(UP, this.yaw);
      if (!fitsAt(this.game, this.species, s, _v3.copy(this.pos).addScaledVector(UP, this.size * 0.02), _q, { excludeBody: this.body, mass: this.species.mass * s ** 3 })) return false;
    }
    this.scale = s;
    this.species.shapes.forEach((sh, i) => {
      const c = this.colliders[i];
      c.setShape(this._shape(sh, s));
      const p = sh.p || [0, 0, 0];
      c.setTranslationWrtParent({ x: p[0] * s, y: p[1] * s, z: p[2] * s });
    });
    this._place(true);
    this.onResize?.();
    return true;
  }

  // The physics shape of one of this animal's colliders (at its current size).
  shapeOf(c) {
    const i = this.colliders.indexOf(c);
    return i < 0 ? null : this._shape(this.species.shapes[i], this.scale);
  }

  beginResize() {}
  endResize() {}

  // ---- senses ---------------------------------------------------------------------------------
  // Can this creature see a point? Vision depends on how big the thing looks (its size over its
  // distance), whether it moves, and whether anything solid is in the way.
  canSee(from, point, targetSize, moving, { fov = 2.6, still = 0.12, motion = 0.015 } = {}) {
    const d = from.distanceTo(point);
    if (d < 1e-9) return true;
    _v.subVectors(point, from).divideScalar(d);
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const ang = Math.acos(clamp((_v.x * fwdX + _v.z * fwdZ) / Math.max(1e-6, Math.hypot(_v.x, _v.z)), -1, 1));
    if (ang > fov) return false;
    const angular = targetSize / d;
    if (angular < (moving ? motion : still)) return false;
    const physics = this.game.physics;
    const hit = physics.raycast(from, _v, d * 0.98, {
      excludeBody: this.body,
      predicate: (c) => {
        const o = physics.ownerOf(c);
        if (o === this.game.player) return false;
        // Glass doesn't block sight (windows, terrarium walls).
        if (o && (o.seeThrough || o.def?.material === 'glass')) return false;
        return !(o && o.held);
      },
    });
    return !hit;
  }

  // ---- movement -------------------------------------------------------------------------------
  update(dt) {
    if (!this.alive || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.think?.(dt);
    this._move(dt);
    this._place(false, dt);
    this._legs(dt);
    this.animate?.(dt);
    this._syncBody();
  }

  _move(dt) {
    const s = this.scale;
    const L = this.size;
    const physics = this.game.physics;
    // Turn (insects turn on the spot quickly), then walk.
    const turn = (this.turnRate ?? 3.5) * dt;
    const dy = angDiff(this.yaw, this.targetYaw);
    this.yaw += clamp(dy, -turn, turn);
    this.speed = damp(this.speed, this.wantSpeed, 10, dt);
    if (this.airborne) return;
    if (Math.abs(this.speed) < 1e-7) return;
    const dir = _v3.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(Math.sign(this.speed));
    const step = Math.abs(this.speed) * dt;
    const center = _v.copy(this.pos).addScaledVector(UP, this.species.ride * s);
    // Something solid ahead? (walls, props, you)
    const hit = physics.sphereCast(center, dir, L * 0.12, step + L * 0.3, { excludeBody: this.body, predicate: (c) => !(physics.ownerOf(c)?.held) });
    if (hit) {
      this.blocked += dt;
      this.speed = 0;
      return;
    }
    // Ground ahead? Insects don't walk off table edges (they'd climb down; that comes later).
    const next = _v2.copy(this.pos).addScaledVector(dir, step + L * 0.25);
    const down = physics.raycast(_v.set(next.x, this.pos.y + L * 0.3, next.z), { x: 0, y: -1, z: 0 }, L * 0.65, { excludeBody: this.body });
    if (!down || down.normal.y < 0.6) {
      this.blocked += dt;
      this.speed = 0;
      return;
    }
    this.blocked = Math.max(0, this.blocked - dt * 2);
    this.pos.addScaledVector(dir, step);
  }

  // Stand on whatever is under the body; fall if there's nothing (real terminal velocity for its size).
  _place(snap, dt = 0) {
    const s = this.scale;
    const L = this.size;
    const physics = this.game.physics;
    const from = _v.copy(this.pos).addScaledVector(UP, L * 0.25);
    const hit = physics.raycast(from, { x: 0, y: -1, z: 0 }, snap ? L * 50 + 2 : L * 0.25 + Math.max(L * 0.1, -this.velY * dt * 2), { excludeBody: this.body, predicate: (c) => physics.ownerOf(c) !== this.game.player });
    if (hit && hit.normal.y > 0.5) {
      if (this.airborne && this.velY < -1) this.onLand?.(-this.velY);
      this.airborne = false;
      this.velY = 0;
      this.pos.y = snap ? hit.point.y : damp(this.pos.y, hit.point.y, 30, dt);
    } else if (!snap) {
      this.airborne = true;
      const vt = terminalVelocity(L, 400);
      this.velY -= 9.81 * dt;
      this.velY -= Math.sign(this.velY) * 9.81 * (this.velY / vt) ** 2 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y < -60) this.respawnSafe();
    }
    this.object.position.copy(this.pos);
    this.object.rotation.set(0, this.yaw, 0);
    this.object.scale.setScalar(s);
    this.object.updateMatrixWorld(true);
    if (snap) for (const l of this.legs) this._plant(l, true);
  }

  respawnSafe() {
    this.pos.set(0, 1, 0);
    this.velY = 0;
  }

  // Where a foot wants to be right now (world), on the ground under its rest spot.
  _ideal(l, out) {
    out.copy(l.rest);
    this.model.localToWorld(out);
    out.y = this.pos.y;
    return out;
  }

  _plant(l, instant) {
    this._ideal(l, l.foot);
    l.from.copy(l.foot);
    l.to.copy(l.foot);
    l.t = 1;
  }

  _legs(dt) {
    if (!this.legs.length) return;
    const s = this.scale;
    const moving = Math.abs(this.speed) > 1e-5 || Math.abs(angDiff(this.yaw, this.targetYaw)) > 0.05;
    // Steps take about a tenth of a second at real size (faster for smaller animals, Froude-ish).
    const dur = clamp(0.11 * Math.sqrt(s) * (this.stepTime ?? 1), 0.02, 1.5);
    const stepping = [false, false];
    for (const l of this.legs) if (l.t < 1) stepping[l.group] = true;
    for (const l of this.legs) {
      if (l.t < 1) {
        l.t = Math.min(1, l.t + dt / l.dur);
        const k = l.t * l.t * (3 - 2 * l.t);
        l.foot.lerpVectors(l.from, l.to, k);
        l.foot.y += Math.sin(Math.PI * l.t) * l.lift;
        continue;
      }
      if (this.airborne) {
        this._ideal(l, l.foot);
        l.foot.y -= this.size * 0.05;
        continue;
      }
      const ideal = this._ideal(l, _v2);
      const far = l.foot.distanceTo(ideal) > (this.stepLen ?? 0.22) * l.len[1] * s;
      const other = stepping[1 - l.group];
      if ((far || (!moving && l.foot.distanceTo(ideal) > 0.06 * l.len[1] * s)) && !other) {
        // Step to where the foot will want to be a little ahead (so it doesn't fall behind).
        l.from.copy(l.foot);
        l.to.copy(ideal);
        if (this.speed) l.to.addScaledVector(_v3.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), this.speed * dur * 0.9);
        l.dur = dur;
        l.lift = l.len[1] * s * 0.35;
        l.t = 0;
        stepping[l.group] = true;
      }
    }
    // Solve each leg in model space (scale 1 units).
    for (const l of this.legs) {
      const footL = this.model.worldToLocal(l.footL.copy(l.foot));
      const hip = l.hip;
      // Insect knees point up and outward.
      const pole = _pole.set(l.side * 0.6, 1, 0).normalize();
      // The tarsus lies on the ground pointing out from the body; the tibia ends where it starts.
      const outX = footL.x - hip.x, outZ = footL.z - hip.z;
      const ol = Math.hypot(outX, outZ) || 1;
      const ankle = _ankle.set(footL.x - (outX / ol) * l.len[2] * 0.75, footL.y + l.len[2] * 0.25, footL.z - (outZ / ol) * l.len[2] * 0.75);
      solveKnee(hip, ankle, l.len[0], l.len[1], pole, l.knee);
      aimSegment(l.meshes[0], hip, l.knee, l.len[0]);
      aimSegment(l.meshes[1], l.knee, ankle, l.len[1]);
      aimSegment(l.meshes[2], ankle, footL, l.len[2]);
    }
  }

  // Short readable status for the crosshair prompt.
  describe() {
    return this.name;
  }

  dispose() {
    this.alive = false;
    this.game.creatures.delete(this);
    this.game.updatables.delete(this);
    this.game.physics.removeBody(this.body);
    this.object.removeFromParent();
  }
}
