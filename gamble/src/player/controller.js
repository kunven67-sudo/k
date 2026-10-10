// Weighty character controller on Rapier's kinematic character controller (KCC).
//
// Feel (DESIGN §38): a body with mass, not a cursor. Speed and heading are integrated separately:
//   - speed eases toward the target with acceleration / braking curves (starts take a beat, stops
//     carry a little momentum), sprint has its own slower build-up and drains stamina,
//   - heading turns toward the wish direction at a rate that falls with speed (tight turns when
//     walking, wide arcs when running); a hard reverse at speed brakes before turning,
//   - jumping has anticipation (a short crouch dip) before take-off, gravity is a bit heavier than
//     real so hops don't float, landings dip the body.
// Curbs/steps are handled by the KCC autostep; slopes by its max-climb angle + snap-to-ground.
//
//   const c = new Controller(physics, { position, height, radius });
//   c.fixedUpdate(step, { wishX, wishZ, wishMag, sprint, crouch, jump, locked })
//   c.feet → THREE.Vector3 (bottom of the capsule, interpolated for rendering via c.renderFeet(alpha))
import * as THREE from 'three';
import { RAPIER } from '../core/physics.js';
import { clamp, lerp, wrapAngle } from '../core/util.js';

const GRAVITY = -9.81 * 1.55;
export const SPEEDS = { walk: 1.45, jog: 2.6, sprint: 5.2, crouch: 0.85, hungover: 1.05 };

export class Controller {
  constructor(physics, { position, height = 1.75, radius = 0.3, owner } = {}) {
    this.physics = physics;
    this.radius = radius;
    this.height = Math.max(1.3, height);
    this.char = physics.createCharacter({ radius, height: this.height, position: { x: position.x, y: position.y + this.height / 2 + 0.02, z: position.z }, owner });
    this.halfTotal = this.char.halfHeight + radius; // centre → feet
    this.speed = 0; // horizontal ground speed (m/s), along `heading`
    this.heading = position.yaw ?? 0; // body facing / travel heading (rad, dir = (sin, cos))
    this.vy = 0;
    this.grounded = true;
    this.airTime = 0;
    this.stamina = 1;
    this.sprinting = false;
    this.crouch = false;
    this.jumpTimer = -1; // anticipation countdown
    this.landDip = 0; // 0..1 spring the camera / body can read after a landing
    this.turnRate = 0;
    this.speedCap = Infinity; // set by moods (hangover) and carried weight
    this.enabled = true;
    this.excludeCollider = null; // e.g. the prop in the hands
    this.prev = new THREE.Vector3();
    this.curr = new THREE.Vector3();
    this._read(this.curr);
    this.prev.copy(this.curr);
    this.vel = new THREE.Vector3();
  }

  get collider() {
    return this.char.collider;
  }

  _read(out) {
    const p = this.char.body.translation();
    return out.set(p.x, p.y - this.halfTotal, p.z);
  }

  /** Teleport (feet position). */
  place(p, yaw) {
    this.char.body.setTranslation({ x: p.x, y: p.y + this.halfTotal + 0.02, z: p.z }, true);
    this.char.body.setNextKinematicTranslation({ x: p.x, y: p.y + this.halfTotal + 0.02, z: p.z });
    this._read(this.curr);
    this.prev.copy(this.curr);
    if (yaw != null) this.heading = yaw;
    this.speed = 0;
    this.vy = 0;
  }

  /** Interpolated feet position for rendering. */
  renderFeet(alpha, out) {
    return out.lerpVectors(this.prev, this.curr, clamp(alpha, 0, 1));
  }

  fixedUpdate(dt, cmd) {
    this.prev.copy(this.curr);
    const c = this.char;
    const grounded = this.grounded;
    const locked = !this.enabled || cmd.locked;

    // ---- wish ----
    let mag = locked ? 0 : clamp(cmd.wishMag, 0, 1);
    const wishHeading = Math.atan2(cmd.wishX, cmd.wishZ);
    this.crouch = !locked && !!cmd.crouch;
    // Sprint needs forward intent, ground and breath; it releases with hysteresis.
    const wantSprint = !locked && cmd.sprint && mag > 0.5 && !this.crouch;
    if (wantSprint && this.stamina > (this.sprinting ? 0.02 : 0.18)) this.sprinting = true;
    else if (!wantSprint || this.stamina <= 0.02) this.sprinting = false;
    this.stamina = clamp(this.stamina + (this.sprinting && this.speed > 3 ? -dt / 9 : dt / (this.speed > 2 ? 14 : 6)), 0, 1);

    let target = this.crouch ? SPEEDS.crouch : this.sprinting ? SPEEDS.sprint : mag > 0.75 ? lerp(SPEEDS.walk, SPEEDS.jog, cmd.jog ? 1 : 0) : SPEEDS.walk;
    target = Math.min(target, this.speedCap) * (mag > 0.05 ? Math.max(mag, 0.35) : 0);
    if (mag < 0.05) target = 0;

    // ---- heading: slower turning at speed; hard reversals brake first ----
    let diff = 0;
    if (target > 0) {
      diff = wrapAngle(wishHeading - this.heading);
      const maxTurn = lerp(10.5, 2.4, clamp((this.speed - 0.4) / (SPEEDS.sprint - 0.4), 0, 1)) * (grounded ? 1 : 0.25);
      const turn = clamp(diff, -maxTurn * dt, maxTurn * dt);
      this.heading = wrapAngle(this.heading + turn);
      this.turnRate = turn / dt;
      // Moving away from where we face: shed speed instead of strafing.
      const align = Math.cos(diff);
      if (this.speed > 2.2 && align < -0.2) target = 0;
      else target *= clamp(0.35 + 0.65 * align, 0.2, 1);
    } else this.turnRate *= 0.8;

    // ---- speed: acceleration and braking curves ----
    if (target > this.speed) {
      // Push-off is strongest from standstill and fades near top speed (weight).
      const base = this.sprinting ? 3.4 : 2.9;
      const accel = base * (1.25 - 0.75 * clamp(this.speed / Math.max(target, 0.1), 0, 1));
      this.speed = Math.min(target, this.speed + accel * dt * (grounded ? 1 : 0.15));
    } else {
      const brake = target === 0 ? lerp(5.5, 7.5, clamp(this.speed / SPEEDS.sprint, 0, 1)) : 3.5;
      this.speed = Math.max(target, this.speed - brake * dt * (grounded ? 1 : 0.1));
    }

    // ---- vertical ----
    if (!locked && cmd.jump && grounded && this.jumpTimer < 0 && !this.crouch) this.jumpTimer = this.speed > 3 ? 0.08 : 0.14;
    if (this.jumpTimer >= 0) {
      this.jumpTimer -= dt;
      if (this.jumpTimer < 0) {
        this.vy = 4.1 + 0.15 * this.speed;
        this.jumpedAt = performance.now();
      }
    }
    if (grounded && this.vy <= 0) this.vy = -1.2;
    else this.vy = Math.max(-30, this.vy + GRAVITY * dt);

    // ---- move ----
    this.vel.set(Math.sin(this.heading) * this.speed, this.vy, Math.cos(this.heading) * this.speed);
    const desired = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
    const ex = this.excludeCollider;
    c.controller.computeColliderMovement(c.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, ex ? (col) => col.handle !== ex.handle : undefined);
    const m = c.controller.computedMovement();
    const p = c.body.translation();
    c.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    const wasAir = !grounded;
    this.grounded = c.controller.computedGrounded();
    if (this.grounded && this.vy > 0 && performance.now() - (this.jumpedAt || 0) < 150) this.grounded = false;
    if (!this.grounded) this.airTime += dt;
    else {
      if (wasAir && this.airTime > 0.25) this.landDip = clamp(this.airTime * 1.4, 0.25, 1);
      this.airTime = 0;
      if (this.vy > 0) this.vy = 0;
    }
    if (this.vy > 0 && m.y < desired.y * 0.5) this.vy = 0; // head hit the ceiling
    // Blocked by a wall: lose the speed we could not use (no moonwalking into walls).
    const hm = Math.hypot(m.x, m.z) / dt;
    if (this.speed > 0.2 && hm < this.speed * 0.6) this.speed = Math.max(hm, this.speed - 8 * dt);
    this.landDip = Math.max(0, this.landDip - dt * 2.5);
    this.curr.set(p.x + m.x, p.y + m.y - this.halfTotal, p.z + m.z);
  }

  dispose() {
    const w = this.physics.world;
    try {
      w.removeCharacterController(this.char.controller);
      w.removeRigidBody(this.char.body);
    } catch {
      /* world already freed */
    }
  }
}
