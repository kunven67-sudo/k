// First-person player: Rapier kinematic character controller + camera rig.
import * as THREE from 'three';
import { R, world, GROUPS, G, groups } from '../engine/physics.js';
import { input } from '../engine/input.js';
import { getSettings } from '../settings.js';
import { ctx } from './ctx.js';

const RADIUS = 0.3;
const STAND_HH = 0.55;   // capsule half-height -> 1.7 m tall
const CROUCH_HH = 0.2;   // -> 1.0 m tall
const EYE_STAND = 1.62;
const EYE_CROUCH = 0.95;
const GRAV = 9.81;

const SPEED = { walk: 3.4, sprint: 6.6, crouch: 1.7, fly: 12, flyFast: 32 };
const JUMP_V = 4.3;
const JET_ACCEL = 17;
const JET_FUEL = 3.2;

const _v = new THREE.Vector3();
const _shake = new THREE.Vector3();

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.grounded = false;
    this.crouching = false;
    this.crouchToggled = false;
    this.sliding = 0;
    this.flying = false;
    this.jumpsUsed = 0;
    this.jumpHeld = 0;
    this.fuel = JET_FUEL;
    this.jetting = false;
    this.lean = 0;
    this.bob = 0;
    this.bobAmp = 0;
    this.land = 0;
    this.landVel = 0;
    this.fatigue = 0;
    this.eyeH = EYE_STAND;
    this.noSnap = 0;
    this.airTime = 0;
    this.lookLocked = false; // tools (physics gun rotate) can take over the mouse
    this.prevPos = new THREE.Vector3(0, 2, 0);

    const desc = R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0);
    this.body = world.createRigidBody(desc);
    this.collider = world.createCollider(
      R.ColliderDesc.capsule(STAND_HH, RADIUS).setCollisionGroups(GROUPS.player).setFriction(0),
      this.body,
    );
    this.cc = world.createCharacterController(0.02);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.enableAutostep(0.4, 0.15, false);
    this.cc.enableSnapToGround(0.35);
    this.cc.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    this.cc.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.cc.setCharacterMass(80);
    this.halfHeight = STAND_HH;
  }

  get feet() { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y - this.halfHeight - RADIUS, t.z); }
  get eye() { return this.camera.position; }

  teleport(feetPos, yaw = this.yaw) {
    this.body.setTranslation({ x: feetPos.x, y: feetPos.y + this.halfHeight + RADIUS + 0.02, z: feetPos.z }, true);
    this.body.setNextKinematicTranslation({ x: feetPos.x, y: feetPos.y + this.halfHeight + RADIUS + 0.02, z: feetPos.z });
    this.vel.set(0, 0, 0);
    this.prevPos.set(feetPos.x, feetPos.y + this.halfHeight + RADIUS + 0.02, feetPos.z);
    this.yaw = yaw;
    this.pitch = 0;
  }

  look() {
    if (this.lookLocked) return;
    const s = 0.0022 * getSettings().sensitivity;
    this.yaw -= input.mouse.dx * s;
    this.pitch -= input.mouse.dy * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.55, 1.55);
  }

  // Explosion shove. Explosions launch you (rocket-jump style).
  blast(center, power, radius) {
    const eye = this.camera.position;
    const feet = this.feet;
    const mid = feet.clone().lerp(eye, 0.5);
    const d = mid.distanceTo(center);
    const k = Math.cbrt(power);
    // camera shake + ear ringing reach much farther than the push
    ctx.fx.addTrauma(Math.max(0, 1.1 - d / (radius * 3.5)) * Math.min(1, 0.4 + k * 0.5));
    if (d < radius * 0.6) ctx.fx.blur = Math.min(1, ctx.fx.blur + (1 - d / (radius * 0.6)));
    ctx.onPlayerBlast?.(d, radius, power);
    if (this.flying || d > radius) return;
    // line of sight: walls shield you
    const dir = mid.clone().sub(center);
    const len = dir.length();
    if (len > 0.6) {
      const hit = world.castRay(new R.Ray(center, dir.clone().normalize()), len - 0.4, true, undefined, groups(0xffff, G.STATIC));
      if (hit) return;
    }
    const strength = 15 * k * Math.max(0, 1 - d / radius);
    const n = len > 1e-3 ? dir.normalize() : new THREE.Vector3(0, 1, 0);
    n.y = Math.max(n.y, 0.25) + 0.3;
    n.normalize();
    this.vel.addScaledVector(n, Math.min(strength, 34));
    this.noSnap = 0.2;
    this.grounded = false;
  }

  setCrouch(want) {
    if (want === this.crouching) return;
    const t = this.body.translation();
    if (!want) {
      // only stand up if there is room above the head
      const shape = new R.Capsule(STAND_HH, RADIUS - 0.02);
      const center = { x: t.x, y: t.y - CROUCH_HH + STAND_HH + 0.03, z: t.z };
      let blocked = false;
      world.intersectionsWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, shape, () => { blocked = true; return false; }, undefined, groups(0xffff, G.STATIC | G.OBJECT), this.collider);
      if (blocked) return;
      this.collider.setHalfHeight(STAND_HH);
      this.body.setTranslation({ x: t.x, y: t.y + (STAND_HH - CROUCH_HH), z: t.z }, true);
      this.halfHeight = STAND_HH;
    } else {
      this.collider.setHalfHeight(CROUCH_HH);
      this.body.setTranslation({ x: t.x, y: t.y - (STAND_HH - CROUCH_HH), z: t.z }, true);
      this.halfHeight = CROUCH_HH;
    }
    this.crouching = want;
  }

  // Fixed-step movement.
  step(dt, realDt) {
    const cur = this.body.translation();
    this.prevPos.set(cur.x, cur.y, cur.z);
    const fwd = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
    const side = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const wish = new THREE.Vector3(side, 0, -fwd);
    if (wish.lengthSq() > 0) wish.normalize();
    wish.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    if (this.flying) return this.stepFly(dt, wish);

    // crouch / slide
    const sprintKey = input.down('sprint');
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const wantCrouch = input.down('crouch') || this.crouchToggled;
    if (wantCrouch && !this.crouching && this.grounded && sprintKey && horizSpeed > 5) {
      this.sliding = 1;
      const boost = Math.min(9.5, horizSpeed * 1.25);
      this.vel.x *= boost / horizSpeed; this.vel.z *= boost / horizSpeed;
    }
    this.setCrouch(wantCrouch || this.sliding > 0);

    const sprinting = sprintKey && fwd > 0 && !this.crouching && this.grounded;
    this.fatigue = THREE.MathUtils.clamp(this.fatigue + (sprinting ? dt * 0.12 : -dt * 0.08), 0, 1);
    const target = this.crouching ? SPEED.crouch : sprinting ? SPEED.sprint : SPEED.walk;

    if (this.sliding > 0) {
      // keep momentum, slow down with friction; downhill keeps you going
      const sp = Math.hypot(this.vel.x, this.vel.z);
      const ns = Math.max(0, sp - 4.2 * dt);
      if (sp > 1e-3) { this.vel.x *= ns / sp; this.vel.z *= ns / sp; }
      if (ns < 2.4 || !this.grounded) this.sliding = 0;
    } else if (this.grounded) {
      const accel = 45;
      const tx = wish.x * target, tz = wish.z * target;
      this.vel.x += THREE.MathUtils.clamp(tx - this.vel.x, -accel * dt, accel * dt);
      this.vel.z += THREE.MathUtils.clamp(tz - this.vel.z, -accel * dt, accel * dt);
    } else {
      // limited air control, momentum mostly kept (rocket jumps carry you)
      const air = 7;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.vel.x += wish.x * air * dt;
      this.vel.z += wish.z * air * dt;
      const ns = Math.hypot(this.vel.x, this.vel.z);
      const cap = Math.max(sp, SPEED.walk);
      if (ns > cap) { this.vel.x *= cap / ns; this.vel.z *= cap / ns; }
    }

    // jump / double jump / jetpack
    if (input.hit('jump')) {
      this.jumpHeld = 0;
      if (this.grounded && !this.crouching) { this.vel.y = JUMP_V; this.jumpsUsed = 1; this.noSnap = 0.15; this.grounded = false; }
      else if (!this.grounded && this.jumpsUsed < 2) { this.vel.y = Math.max(this.vel.y, JUMP_V * 0.92); this.jumpsUsed = 2; }
      else if (this.crouching && this.grounded) { this.crouchToggled = false; }
    }
    this.jetting = false;
    if (input.down('jump')) {
      this.jumpHeld += dt;
      if (!this.grounded && this.jumpHeld > 0.28 && this.fuel > 0) {
        this.vel.y = Math.min(this.vel.y + (JET_ACCEL + GRAV) * dt, 7.5);
        this.fuel = Math.max(0, this.fuel - dt);
        this.jetting = true;
      }
    }
    if (this.grounded) this.fuel = Math.min(JET_FUEL, this.fuel + dt * 0.9);

    this.vel.y -= GRAV * dt;
    if (this.grounded && this.vel.y < 0 && this.noSnap <= 0) this.vel.y = -1;
    this.noSnap -= dt;

    const desired = this.vel.clone().multiplyScalar(dt);
    if (this.noSnap > 0) this.cc.disableSnapToGround(); else this.cc.enableSnapToGround(0.35);
    this.cc.computeColliderMovement(this.collider, desired, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(0xffff, G.STATIC | G.OBJECT));
    const mv = this.cc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z });

    // collisions kill the velocity in that direction
    if (dt > 0) {
      const realV = new THREE.Vector3(mv.x, mv.y, mv.z).divideScalar(dt);
      if (Math.abs(realV.y) < Math.abs(this.vel.y) * 0.5 && (this.vel.y > 0 || this.grounded)) this.vel.y = this.grounded ? Math.min(0, this.vel.y) : realV.y;
      if (Math.abs(realV.x) < Math.abs(this.vel.x) * 0.7) this.vel.x = realV.x;
      if (Math.abs(realV.z) < Math.abs(this.vel.z) * 0.7) this.vel.z = realV.z;
    }
    if (this.grounded) {
      if (!wasGrounded) {
        const impact = -this.prevVy;
        if (impact > 2) { this.landVel = -Math.min(impact * 0.035, 0.22); }
        ctx.onLand?.(impact);
      }
      this.jumpsUsed = 0;
      this.airTime = 0;
    } else this.airTime += dt;
    this.prevVy = this.vel.y;
  }

  stepFly(dt, wish) {
    const fast = input.down('sprint');
    const sp = fast ? SPEED.flyFast : SPEED.fly;
    const up = (input.down('jump') ? 1 : 0) - (input.down('crouch') ? 1 : 0);
    // fly where you look
    const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const fwd = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
    const sideV = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const side = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const target = look.multiplyScalar(fwd).addScaledVector(sideV, side).add(new THREE.Vector3(0, up, 0));
    if (target.lengthSq() > 1) target.normalize();
    target.multiplyScalar(sp);
    this.vel.lerp(target, Math.min(1, dt * 8));
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + this.vel.x * dt, y: Math.max(0.9, t.y + this.vel.y * dt), z: t.z + this.vel.z * dt });
    this.grounded = false;
  }

  toggleFly() {
    this.flying = !this.flying;
    this.collider.setEnabled(!this.flying);
    if (this.flying) { this.setCrouch(false); this.sliding = 0; }
    else this.vel.set(this.vel.x * 0.3, 0, this.vel.z * 0.3);
    return this.flying;
  }

  // Per-frame camera rig (head bob, lean, landing dip, breathing sway, shake).
  updateCamera(realDt, alpha) {
    const c = this.body.translation();
    const t = { x: this.prevPos.x + (c.x - this.prevPos.x) * alpha, y: this.prevPos.y + (c.y - this.prevPos.y) * alpha, z: this.prevPos.z + (c.z - this.prevPos.z) * alpha };
    const feetY = t.y - this.halfHeight - RADIUS;
    const targetEye = this.flying ? EYE_STAND : this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, realDt * 12);

    // landing dip spring
    this.landVel += (-this.land * 160 - this.landVel * 18) * realDt;
    this.land += this.landVel * realDt;

    const hs = Math.hypot(this.vel.x, this.vel.z);
    const moving = this.grounded && hs > 0.5 && this.sliding <= 0;
    this.bobAmp += ((moving ? Math.min(1, hs / SPEED.sprint) : 0) - this.bobAmp) * Math.min(1, realDt * 8);
    if (moving) this.bob += realDt * hs * 1.75;
    const bobY = Math.abs(Math.sin(this.bob)) * 0.045 * this.bobAmp;
    const bobX = Math.cos(this.bob) * 0.03 * this.bobAmp;

    // lean (Q/E), blocked by walls
    const leanTarget = (input.down('leanRight') ? 1 : 0) - (input.down('leanLeft') ? 1 : 0);
    this.lean += (leanTarget - this.lean) * Math.min(1, realDt * 9);
    let leanOff = this.lean * 0.38;
    if (Math.abs(leanOff) > 0.01) {
      const sideDir = new THREE.Vector3(Math.sign(leanOff), 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const from = { x: t.x, y: feetY + this.eyeH, z: t.z };
      const hit = world.castRay(new R.Ray(from, sideDir), Math.abs(leanOff) + 0.15, true, undefined, groups(0xffff, G.STATIC | G.OBJECT), this.collider);
      if (hit) leanOff = Math.sign(leanOff) * Math.max(0, hit.timeOfImpact - 0.15);
    }

    // breathing sway after sprinting
    const tt = performance.now() / 1000;
    const breathe = this.fatigue * 0.012;
    ctx.fx.shake(_shake);

    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.camera.position.set(t.x, feetY + this.eyeH + bobY + this.land + Math.sin(tt * 1.6) * breathe, t.z)
      .addScaledVector(right, bobX + leanOff);
    this.camera.rotation.set(
      this.pitch + _shake.x + Math.sin(tt * 1.6 + 1) * breathe * 0.5,
      this.yaw + _shake.y,
      -this.lean * 0.2 + _shake.z + bobX * 0.15,
      'YXZ',
    );
  }

  get forward() { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); }
}
