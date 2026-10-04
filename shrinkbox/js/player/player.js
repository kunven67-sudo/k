// The player: a normal person who can be ANY size. Everything about how you move scales with
// your size (walk speed, jump, gravity you feel), so tiny-you moves like a normal person in a
// giant world - and a fall off a chair feels like jumping off a skyscraper (no damage when small).
import * as THREE from 'three';
import { R, world, groups, G, handleToThing } from '../core/physics.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { sfx } from '../core/audio.js';
import { Mover } from './mover.js';

export const BASE_H = 1.75;     // meters at size 1
const BASE_R = 0.24;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

export class Player {
  constructor(game, spawn) {
    this.game = game;
    this.s = 1;
    this.feet = new THREE.Vector3(...spawn.pos);
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw || 0;
    this.pitch = 0;
    this.view = 'first';
    this.health = 100;
    this.grounded = false;
    this.crouch = false;
    this.crouchT = 0;
    this.airTime = 0;
    this.fallStartY = this.feet.y;
    this.minVy = 0;
    this.stepAcc = 0;
    this.headBob = 0;
    this.groundThing = null;
    this.sticky = 0;     // soda makes you sticky
    this.inLiquid = null;
    this.extForce = new THREE.Vector3(); // wind, bubbles, etc. (m/s^2, already in world units)
    this.shake = 0;
    this.camPos = new THREE.Vector3();
    this.camDist = 0;

    const { r, half } = this.dims(this.s);
    const bd = R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.feet.x, this.feet.y + half, this.feet.z);
    this.body = world.createRigidBody(bd);
    // the player's own collider only touches sensors; movement is done by the Mover with casts
    const cd = R.ColliderDesc.cylinder(half, r).setCollisionGroups(groups(G.PLAYER, G.SENSOR));
    this.collider = world.createCollider(cd, this.body);
    this.moveGroups = groups(G.PLAYER, G.WORLD | G.PROP | G.CREATURE | G.SKIN);
    this.mover = new Mover(this.collider, this.moveGroups);
    this.touching = [];
    this.applyScaleToController();
  }

  // body cylinder: radius + half-height, for a given size (crouch-aware)
  dims(s, crouchAmt = this.crouchT) {
    const h = BASE_H * s * (1 - 0.38 * crouchAmt);
    return { r: BASE_R * s, half: h / 2, h };
  }
  get height() { return this.dims(this.s).h; }
  get eyeHeight() { return this.dims(this.s).h * 0.93; }

  applyScaleToController() {
    const { r, half } = this.dims(this.s);
    this.collider.setRadius(r);
    this.collider.setHalfHeight(half);
  }

  center(out = new THREE.Vector3()) { const { half } = this.dims(this.s); return out.set(this.feet.x, this.feet.y + half, this.feet.z); }
  head(out = new THREE.Vector3()) { return out.set(this.feet.x, this.feet.y + this.eyeHeight, this.feet.z); }

  // Does a body of size s (feet at current feet) fit without hitting anything solid?
  fits(s, feet = this.feet, crouchAmt = this.crouchT) {
    const { r, half } = this.dims(s, crouchAmt);
    const pos = { x: feet.x, y: feet.y + half + 0.01 * half, z: feet.z };
    const hit = this.mover.overlaps(pos, half, r, true);
    if (hit) this.lastBlock = hit;
    return !hit;
  }

  setScale(s) {
    this.s = s;
    this.applyScaleToController();
    const c = this.center();
    this.body.setTranslation({ x: c.x, y: c.y, z: c.z }, true);
    this.body.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z });
  }

  look(dt) {
    const sens = 0.0022 * settings.sensitivity;
    this.yaw -= input.look.x * sens;
    this.pitch -= input.look.y * sens * (settings.invertY ? -1 : 1);
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
  }

  update(dt) {
    const s = this.s;
    this.look(dt);
    if (input.pressed('camera')) this.view = this.view === 'first' ? 'third' : 'first';

    // crouch (needs room to stand back up)
    const wantCrouch = input.held('crouch') || (this.crouchT > 0 && !this.fits(s, this.feet, Math.max(0, this.crouchT - 0.1)));
    this.crouchT = Math.max(0, Math.min(1, this.crouchT + (wantCrouch ? 1 : -1) * dt * 6));
    if (this.crouchT !== this._lastCrouch) { this._lastCrouch = this.crouchT; this.applyScaleToController(); }

    // ---- movement (all speeds scale with size) ----
    const sprint = input.held('sprint') && !this.crouchT;
    const stickyMul = 1 - Math.min(0.75, this.sticky);
    let speed = (sprint ? 5.2 : 2.4) * s * (1 - 0.55 * this.crouchT) * stickyMul;
    if (this.inLiquid) speed *= this.inLiquid.swimMul ?? 0.5;
    const fwd = tmp.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = tmp2.set(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, input.move.y).addScaledVector(right, input.move.x);
    if (wish.lengthSq() > 1) wish.normalize();
    const accel = (this.grounded ? 14 : this.inLiquid ? 4 : 3);
    const target = wish.multiplyScalar(speed);
    this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);

    // gravity you FEEL scales with your size -> slow, long falls when tiny
    const g = 9.81 * s;
    if (this.inLiquid) {
      const L = this.inLiquid;
      this.vel.y += (-g * (L.sink ?? 0.15) + this.extForce.y) * dt;
      if (input.held('jump')) this.vel.y += g * 1.1 * dt;
      if (input.held('crouch')) this.vel.y -= g * 0.8 * dt;
      const drag = L.drag ?? 3;
      this.vel.multiplyScalar(Math.max(0, 1 - drag * dt));
    } else {
      this.vel.y -= g * dt;
      this.vel.x += this.extForce.x * dt; this.vel.z += this.extForce.z * dt; this.vel.y += this.extForce.y * dt;
      const term = 55 * s; // terminal velocity, scaled
      if (this.vel.y < -term) this.vel.y = -term;
    }
    if (this.grounded && input.pressed('jump') && !this.inLiquid) {
      this.vel.y = Math.sqrt(2 * g * 0.55 * s) * stickyMul;
      sfx.step(0.1 * Math.min(1, s * 2 + 0.3), 0.3);
    }

    // ---- collide & move with the character controller ----
    const desired = this.vel.clone().multiplyScalar(dt);
    // ride moving things (a tossed controller, a spinning disc...)
    if (this.grounded && this.groundBody && !this.groundBody.isFixed()) {
      const lv = this.groundBody.linvel();
      desired.x += lv.x * dt; desired.y += Math.min(0, lv.y) * dt; desired.z += lv.z * dt;
    }
    const { r, h } = this.dims(s);
    const before = this.feet.clone();
    const res = this.mover.move(this.feet, desired, {
      r, h, grounded: this.grounded, snap: this.grounded && this.vel.y <= 0.01 * s,
      stepH: 0.22 * BASE_H * s, maxSlopeCos: Math.cos(50 * Math.PI / 180),
    });
    const mv = this.feet.clone().sub(before);
    const pos = this.center(new THREE.Vector3());
    const wasGrounded = this.grounded;
    this.grounded = res.grounded;
    // what did we touch? (for heat, zaps, pushing things)
    this.groundBody = res.groundCollider ? res.groundCollider.parent() : null;
    this.touching = this.mover.hits.map((h) => h.collider);
    if (res.hitCeiling && this.vel.y > 0) this.vel.y = 0; // bonk head
    // push light things you walk into (a tiny you can't move a soda can, a normal you can)
    for (const h of this.mover.hits) {
      const b = h.collider.parent();
      if (!b || !b.isDynamic() || h.normal.y > 0.7) continue;
      const myMass = 70 * s * s * s;
      const push = Math.max(0, -this.vel.dot(h.normal)) * myMass * 0.6;
      if (push > 0) b.applyImpulseAtPoint({ x: -h.normal.x * push, y: 0, z: -h.normal.z * push }, pos, true);
    }
    if (dt > 0) {
      // actual achieved horizontal speed (stops sliding into walls building up speed)
      const ax = mv.x / dt, az = mv.z / dt;
      if (Math.abs(ax) < Math.abs(this.vel.x)) this.vel.x = ax;
      if (Math.abs(az) < Math.abs(this.vel.z)) this.vel.z = az;
    }
    if (this.grounded) {
      if (!wasGrounded) this.land();
      if (this.vel.y < 0) this.vel.y = 0;
      this.airTime = 0; this.fallStartY = this.feet.y;
    } else {
      this.airTime += dt;
      this.minVy = Math.min(this.minVy, this.vel.y);
    }
    const c = this.center();
    this.body.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z });

    // footsteps
    const hs = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-4) / s;
    if (this.grounded && hs > 0.3) {
      this.stepAcc += hs * dt;
      this.headBob += hs * dt * 4.2;
      if (this.stepAcc > (sprint ? 0.95 : 0.75)) { this.stepAcc = 0; sfx.step(0.08 + Math.min(0.12, s * 0.12), this.game.surfaceSoftness?.(this) ?? 0.5); }
    }
    this.sticky = Math.max(0, this.sticky - dt * 0.012);
    this.extForce.set(0, 0, 0);
    this.minVy = this.grounded ? 0 : this.minVy;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.feet.y < -60) this.respawnFall();
  }

  land() {
    // only hurts at normal size or bigger (tiny-you floats down like a feather)
    const v = -this.minVy / this.s; // impact speed in "body sizes per second"
    const loud = Math.min(1, v / 10);
    sfx.thud(0.15 + loud * 0.5, 1 / Math.max(0.5, Math.min(2, this.s ** 0.15)));
    if (this.s >= 0.8 && v > 7.5) {
      const dmg = (v - 7.5) * 11;
      this.hurt(dmg, 'fall');
      this.shake = Math.min(1, dmg / 40);
    }
    this.minVy = 0;
  }

  hurt(amount, why) {
    if (amount <= 0 || this.game.dead) return;
    this.health = Math.max(0, this.health - amount);
    this.game.ui.hurtFlash(Math.min(1, amount / 40));
    sfx.hurt();
    if (this.health <= 0) this.game.knockedOut(why);
  }

  respawnFall() {
    this.feet.set(...this.game.spawn.pos); this.vel.set(0, 0, 0);
  }

  // ---- camera ----
  updateCamera(cam, dt) {
    const s = this.s;
    const eye = this.head(new THREE.Vector3());
    const bob = this.view === 'first' ? Math.sin(this.headBob) * 0.025 * s * (this.grounded ? 1 : 0) : 0;
    eye.y += bob;
    const sh = this.shake * this.shake;
    const shakeV = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(sh * 0.06 * s);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.03, this.yaw + (Math.random() - 0.5) * sh * 0.03, 0);
    if (this.view === 'first') {
      cam.position.copy(eye).add(shakeV);
      this.camDist = 0;
    } else {
      // over-the-shoulder; pulled in when something is in the way (inside an Xbox, etc.)
      const back = new THREE.Vector3(0, 0, 1).applyEuler(cam.rotation);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(cam.rotation);
      const pivot = eye.clone().addScaledVector(right, 0.32 * s).add(new THREE.Vector3(0, 0.08 * s, 0));
      let want = 2.3 * s;
      const ray = new R.Ray(pivot, back);
      const hit = world.castRay(ray, want + 0.2 * s, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(G.PLAYER, G.WORLD | G.PROP), this.collider);
      if (hit) want = Math.max(0.15 * s, hit.timeOfImpact - 0.18 * s);
      this.camDist += (want - this.camDist) * Math.min(1, dt * (want < this.camDist ? 30 : 5));
      cam.position.copy(pivot).addScaledVector(back, this.camDist).add(shakeV);
    }
    // the camera's near plane shrinks with you so you can get right up to things
    const near = Math.max(1e-7, 0.035 * s * (this.view === 'third' ? 1.5 : 1));
    if (Math.abs(cam.near - near) / near > 0.01 || cam.fov !== settings.fov) {
      cam.near = near; cam.far = Math.max(400, 400 * s); cam.fov = settings.fov; cam.updateProjectionMatrix();
    }
  }

  // What you're looking at (for using / grabbing / shrinker)
  aim(maxDist) {
    const cam = this.game.engine.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const from = cam.position.clone();
    const ray = new R.Ray(from, dir);
    const hit = world.castRayAndGetNormal(ray, maxDist, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(G.PLAYER, G.WORLD | G.PROP | G.CREATURE), this.collider);
    if (!hit) return null;
    const point = from.clone().addScaledVector(dir, hit.timeOfImpact);
    return { point, normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), dist: hit.timeOfImpact, collider: hit.collider, thing: handleToThing.get(hit.collider.handle), dir };
  }
}
