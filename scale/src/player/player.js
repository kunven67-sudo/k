// The player: body, movement, the RIFT watch (size), and the third/first-person camera.
//
// Size physics (master list section 1):
//  - Walking/running speed follows real leg physics (Froude scaling): speed ~ sqrt(height).
//  - Gravity is real (9.81 m/s^2). Air drag gives a terminal velocity ~ sqrt(height), so a tiny
//    you falls slowly and survives big drops while a giant hits hard.
//  - Jump height shrinks slower than your body (small animals jump many body lengths).
//  - Growing checks for room first; the watch stops you instead of putting you inside a wall.
import * as THREE from 'three';
import { RAPIER, GROUPS, LAYER } from '../core/physics.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp, damp, angDiff } from '../core/util.js';
import { bus } from '../core/events.js';
import { createGlitch } from './glitch.js';

export const BASE_HEIGHT = 1.75;
export const MIN_SCALE = 0.0008; // 1.4 mm (Wave 1 floor; the micro world goes further later)
export const MAX_SCALE = 10; // 17.5 m
const G = 9.81;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(game, { position = [0, 0, 0], yaw = 0, scale = 1, model = null } = {}) {
    this.game = game;
    this.kind = 'player';
    this.name = 'You';
    this.scale = scale;
    this.feet = new THREE.Vector3().fromArray(position);
    this.prevFeet = this.feet.clone();
    this.renderFeet = this.feet.clone();
    this.vel = new THREE.Vector3();
    this.yaw = yaw; // camera yaw
    this.pitch = -0.15;
    this.facing = yaw; // body facing
    this.grounded = false;
    this.airTime = 0;
    this.sizeRate = 0;
    this.blockedT = 0;
    this.health = 100;
    this.camDist = 2.4; // body heights
    this.firstPerson = settings.get('firstPerson');
    this.crouching = false;
    this.lastImpact = 0;

    const physics = game.physics;
    const H = this.height;
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.feet.x, this.feet.y + H / 2, this.feet.z)
    );
    const r = this.radius;
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(Math.max(1e-6, H / 2 - r), r).setCollisionGroups(GROUPS.player).setFriction(0.0),
      this.body
    );
    physics.own(this.collider, this);
    this.kcc = physics.world.createCharacterController(0.01);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this._configureForScale();

    this.object = new THREE.Group();
    this.object.name = 'player';
    this.model = model || createGlitch();
    this.object.add(this.model);
    this.object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    game.scene.add(this.object);
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.camDistM = this.camDist * this.height; // actual camera distance in meters (after collision)
    this._syncObject();
  }

  get height() {
    return BASE_HEIGHT * this.scale;
  }

  get radius() {
    return 0.13 * this.height;
  }

  get mass() {
    return 70 * this.scale ** 3;
  }

  get eyeHeight() {
    return this.height * 0.93;
  }

  // Everything that depends on body size.
  _configureForScale() {
    const H = this.height;
    const r = this.radius;
    this.collider.setRadius(r);
    this.collider.setHalfHeight(Math.max(1e-6, H / 2 - r));
    this.kcc.setOffset(Math.max(2e-6, 0.004 * H));
    this.kcc.enableAutostep(0.22 * H, 0.04 * H, false);
    this.kcc.enableSnapToGround(0.18 * H);
    this.kcc.setCharacterMass(this.mass);
    this.game.physics.setLengthUnit(H * 0.5);
  }

  // --- size -------------------------------------------------------------------------------------
  // Is there room for the body at scale s with the feet where they are now?
  roomAt(s, feet = this.feet) {
    const H = BASE_HEIGHT * s;
    const r = 0.13 * H;
    const shape = new RAPIER.Capsule(Math.max(1e-6, H / 2 - r) * 0.98, r * 0.98);
    const lift = H * 0.02;
    const physics = this.game.physics;
    const hits = physics.overlaps(shape, { x: feet.x, y: feet.y + H / 2 + lift, z: feet.z }, undefined, {
      excludeCollider: this.collider,
      exclude: this.collider,
      predicate: (c) => {
        const o = physics.ownerOf(c);
        if (o === this) return false;
        if (o && o.held) return false;
        if (o && o.mass !== undefined) return o.mass > this.mass * 0.25 * (s / this.scale) ** 3; // light things get pushed aside
        return true; // walls, floors, ceilings
      },
    });
    return hits.length === 0;
  }

  // Try to resize to s. Feet stay planted. If growing would hit something, look for a nearby
  // spot with room (sliding away from a wall) before giving up.
  tryResize(s, force = false) {
    s = clamp(s, MIN_SCALE, MAX_SCALE);
    if (s === this.scale) return true;
    if (s > this.scale && !force && !this.roomAt(s)) {
      const step = (0.13 * BASE_HEIGHT) * (s - this.scale) * 1.6;
      let moved = false;
      for (let i = 0; i < 8 && !moved; i++) {
        const a = (i / 8) * Math.PI * 2;
        _v.set(this.feet.x + Math.cos(a) * step, this.feet.y, this.feet.z + Math.sin(a) * step);
        if (this.roomAt(s, _v)) {
          this.feet.copy(_v);
          moved = true;
        }
      }
      if (!moved) return false;
    }
    this.scale = s;
    this._configureForScale();
    this.body.setTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z }, true);
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z });
    bus.emit('player:size', s);
    return true;
  }

  // --- per fixed step ---------------------------------------------------------------------------
  fixedUpdate(dt) {
    this.prevFeet.copy(this.feet);
    const s = this.scale;
    const H = this.height;

    // Watch: hold to shrink / grow, smooth like a zoom. Shift = faster.
    const dir = (input.down('grow') ? 1 : 0) - (input.down('shrink') ? 1 : 0);
    const want = dir * (input.down('sprint') ? 2.4 : 0.9);
    this.sizeRate = dir ? damp(this.sizeRate, want, 5, dt) : damp(this.sizeRate, 0, 14, dt);
    if (Math.abs(this.sizeRate) > 1e-4) {
      const ns = clamp(s * Math.exp(this.sizeRate * dt), MIN_SCALE, MAX_SCALE);
      if (!this.tryResize(ns, input.down('force'))) {
        this.sizeRate = 0;
        this.blockedT = 1.5;
        bus.emit('player:blocked');
      }
    }

    // Movement intent relative to camera yaw.
    const mv = input.moveVector();
    this.crouching = input.down('crouch');
    const sprint = input.down('sprint') && !dir;
    const legs = Math.sqrt(this.scale);
    const speed = (this.crouching ? 1.1 : sprint ? 6.2 : 3.2) * legs;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Camera looks along -Z when yaw = 0.
    const wx = mv.x * cos - mv.y * sin;
    const wz = -mv.x * sin - mv.y * cos;
    const k = this.grounded ? 12 : 2.5;
    this.vel.x = damp(this.vel.x, wx * speed, k, dt);
    this.vel.z = damp(this.vel.z, wz * speed, k, dt);
    if (Math.hypot(wx, wz) > 0.1) this.facing += angDiff(this.facing, Math.atan2(-wx, -wz)) * (1 - Math.exp(-12 * dt));

    // Gravity with air drag (terminal velocity ~ sqrt(size)).
    const vt = 55 * Math.sqrt(this.scale);
    this.vel.y -= G * dt;
    this.vel.y -= Math.sign(this.vel.y) * G * (this.vel.y / vt) ** 2 * dt;
    if (this.grounded && input.pressed('jump')) {
      const jumpH = 0.45 * (this.scale < 1 ? Math.pow(this.scale, 0.3) : Math.pow(this.scale, 0.15));
      this.vel.y = Math.sqrt(2 * G * jumpH);
      this.grounded = false;
    }

    // Character controller: slide along walls, step up stairs, snap to the ground.
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.kcc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.player, (c) => {
      const o = this.game.physics.ownerOf(c);
      return !(o && o.held);
    });
    const m = this.kcc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    const vyBefore = this.vel.y;
    if (this.grounded && this.vel.y < 0) {
      if (!wasGrounded && this.airTime > 0.15) this._land(-vyBefore);
      this.vel.y = 0;
    }
    if (!this.grounded && desired.y > 0 && m.y < desired.y * 0.5) this.vel.y = Math.min(0, this.vel.y); // bonked a ceiling
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this.feet.x += m.x;
    this.feet.y += m.y;
    this.feet.z += m.z;
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + H / 2, z: this.feet.z });

    // Safety net: never fall out of the world.
    if (this.feet.y < -60 || !Number.isFinite(this.feet.y)) this.respawn();
    if (this.blockedT > 0) this.blockedT -= dt;
  }

  // Impact damage depends on absolute impact speed (tissue stress ~ v^2, size-independent).
  // Small bodies are safe because their terminal velocity is low.
  _land(speed) {
    this.lastImpact = speed;
    if (speed > 7.5) {
      const dmg = Math.round((speed - 7.5) ** 1.6 * 4);
      this.health = Math.max(0, this.health - dmg);
      this.hurtFx = 1;
      bus.emit('player:hurt', { amount: dmg, cause: 'fall', speed });
    }
  }

  respawn() {
    const sp = this.game.spawn;
    this.feet.fromArray(sp.position);
    this.prevFeet.copy(this.feet);
    this.vel.set(0, 0, 0);
    this.scale = 1;
    this._configureForScale();
    this.body.setTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z }, true);
    this.health = 100;
  }

  // --- per frame --------------------------------------------------------------------------------
  update(dt, alpha) {
    const look = input.consumeLook();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch - look.y, -1.45, 1.35);
    const wheel = input.consumeWheel();
    if (wheel) this.camDist = clamp(this.camDist * Math.pow(1.15, wheel), 1.0, 7);
    if (input.pressed('view')) {
      this.firstPerson = !this.firstPerson;
      settings.set('firstPerson', this.firstPerson);
    }
    this.renderFeet.lerpVectors(this.prevFeet, this.feet, alpha);
    this._syncObject();
    this._animate(dt);
  }

  _syncObject() {
    this.object.position.copy(this.renderFeet);
    this.object.rotation.set(0, this.facing, 0);
    this.object.scale.setScalar(this.scale);
  }

  _animate(dt) {
    const hs = Math.hypot(this.vel.x, this.vel.z) / Math.sqrt(this.scale);
    this.hurtFx = Math.max(0, (this.hurtFx || 0) - dt);
    this.model.userData.animate?.(dt, { speed: hs, grounded: this.grounded, vy: this.vel.y / Math.sqrt(this.scale), crouch: this.crouching, scaleRate: this.sizeRate, scale: this.scale, hurt: this.hurtFx });
  }

  // Third-person camera with collision, or first-person.
  updateCamera(camera, dt) {
    const H = this.height;
    const physics = this.game.physics;
    const fp = this.firstPerson;
    const pivot = _v.copy(this.renderFeet).addScaledVector(UP, fp ? this.eyeHeight : H * 0.82);
    _q.setFromAxisAngle(UP, this.yaw);
    const fwd = _v2.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch).applyQuaternion(_q);
    let dist = 0;
    if (!fp) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(_q);
      pivot.addScaledVector(right, H * 0.22);
      const want = this.camDist * H;
      const back = fwd.clone().negate();
      const hit = physics.sphereCast(pivot, back, H * 0.06, want, {
        excludeBody: this.body,
        predicate: (c) => {
          const o = physics.ownerOf(c);
          if (o && (o.held || o === this)) return false;
          if (o && o.mass !== undefined && o.size < H * 0.4) return false; // small loose stuff doesn't block the camera
          return true;
        },
      });
      dist = hit ? Math.max(H * 0.15, hit.dist - H * 0.02) : want;
      // Pull in fast, ease back out. Size changes rescale the remembered distance.
      if (this._camH && this._camH !== H) this.camDistM *= H / this._camH;
      this._camH = H;
      this.camDistM = dist < this.camDistM ? dist : damp(this.camDistM, dist, 6, dt);
      dist = Math.min(dist, this.camDistM);
      camera.position.copy(pivot).addScaledVector(back, dist);
    } else {
      camera.position.copy(pivot).addScaledVector(fwd, H * 0.06);
    }
    camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    camera.near = Math.max(1e-6, H * (fp ? 0.02 : 0.03));
    camera.far = clamp(H * 4000, 80, 4000);
    camera.fov = settings.get('fov');
    camera.updateProjectionMatrix();
    // Hide your own body when the camera is inside it.
    this.model.visible = !fp && dist > H * 0.35;
  }
}

// Temporary body until The Glitch model is in (a capsule with a visor so you can see facing).
function placeholderModel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.75 - 0.44, 6, 16), mat);
  body.position.y = 1.75 / 2;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 3 }));
  visor.position.set(0, 1.58, -0.2);
  g.add(body, visor);
  return g;
}
