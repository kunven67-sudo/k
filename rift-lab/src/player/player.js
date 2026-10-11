// You: a real-size body (1.8 m), real walking/jogging/sprinting speeds, stamina,
// crouching, jumping (~45 cm like a real person), swimming, holding your breath,
// fall damage + injuries, and footsteps that sound like what you step on.

import * as THREE from 'three';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp, lerp, smoothstep } from '../core/noise.js';
import { HALF, WORLD_SIZE } from '../world/terrainGen.js';

const DEG = Math.PI / 180;
const RADIUS = 0.3;
const STAND_HALF = 0.6;   // capsule half-height: 0.6*2 + 0.3*2 = 1.8 m tall
const CROUCH_HALF = 0.25; // 1.1 m tall
const EYE_STAND = 1.66, EYE_CROUCH = 1.02;

const SPEED = { walk: 1.45, jog: 3.3, sprint: 6.1, crouch: 0.85, swim: 0.95, swimFast: 1.6 };

export class Player {
  constructor({ physics, camera, world, audio, godMode = false }) {
    this.size = 1;          // 1 = normal (1.8 m). The Rift Tool changes it.
    this.physics = physics;
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    const R = physics.RAPIER;
    this.R = R;

    const sp = world.gen.spawn;
    const y = world.terrain.height(sp.x, sp.z) + 0.05;
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(sp.x, y + this.standHalf + this.rad, sp.z));
    this.collider = physics.world.createCollider(R.ColliderDesc.capsule(this.standHalf, this.rad).setFriction(0), this.body);
    this.collider.userData = { kind: 'player' };
    this.controller = physics.world.createCharacterController(0.02);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setMaxSlopeClimbAngle(46 * DEG);
    this.controller.setMinSlopeSlideAngle(42 * DEG);
    this.controller.enableAutostep(0.38, 0.12, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(75);

    this.yaw = sp.yaw || 0;
    this.pitch = -0.05;
    this.vel = new THREE.Vector3();
    this.grounded = false;
    this.crouching = false;
    this.halfHeight = this.standHalf;
    this.eye = this.eyeStand;
    this.jogToggle = false;
    this.lean = 0;
    this.godMode = godMode;

    // body
    this.stamina = 100;
    this.exhausted = false;
    this.health = 100;
    this.breath = 45;      // seconds of air
    this.limp = 0;         // 0..1
    this.brokenLeg = 0;    // game-days left to heal
    this.swimming = false;
    this.underwater = false;
    this.wading = 0;
    this.dead = false;
    // set by your body's needs (hungry, thirsty, tired, sick): slower recovery, less in the tank, dizziness
    this.regenMul = 1;
    this.staminaCap = 100;
    this.sway = 0;       // extra camera roll (radians)
    this.swayPitch = 0;  // extra camera pitch (radians)

    this.mantle = null;   // climbing/vaulting over something
    this.stepDist = 0;
    this.bob = 0;
    this.landDip = 0;
    this.lastSurface = 'grass';
    this.prevPos = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.readPos(this.pos);
    this.prevPos.copy(this.pos);

    this.jumpQ = 0;
    this.jogQ = false;
    this.unhook = physics.onStep((h) => this.fixedStep(h));
    this.events = [];
  }

  // ---------- your size (real scaling laws) ----------
  // lengths x size, weight x size^3, strength x size^2, walking speed x sqrt(size) (pendulum legs),
  // jump height stays ~45 cm (Borelli's law), terminal velocity x sqrt(size) (tiny = slow falls)
  get rad() { return RADIUS * this.size; }
  get standHalf() { return STAND_HALF * this.size; }
  get crouchHalf() { return CROUCH_HALF * this.size; }
  get eyeStand() { return EYE_STAND * this.size; }
  get eyeCrouch() { return EYE_CROUCH * this.size; }
  get spd() {
    const k = Math.sqrt(this.size);
    if (this._spdK !== k) { this._spdK = k; this._spd = Object.fromEntries(Object.entries(SPEED).map(([n, v]) => [n, v * k])); }
    return this._spd;
  }
  get heightM() { return 1.8 * this.size; }

  setSize(s) {
    s = clamp(s, 0.03, 8);
    if (Math.abs(s - this.size) < 1e-5) return;
    const feet = this.pos.clone();
    this.size = s;
    this.halfHeight = this.crouching ? this.crouchHalf : this.standHalf;
    this.collider.setRadius(this.rad);
    this.collider.setHalfHeight(this.halfHeight);
    this.body.setTranslation({ x: feet.x, y: feet.y + this.halfHeight + this.rad, z: feet.z }, true);
    this.body.setNextKinematicTranslation({ x: feet.x, y: feet.y + this.halfHeight + this.rad, z: feet.z });
    this.eye = this.crouching ? this.eyeCrouch : this.eyeStand;
    this.controller.setOffset?.(Math.max(0.0008, 0.02 * s));
    this.controller.enableAutostep(0.38 * s, 0.12 * s, true);
    this.controller.enableSnapToGround(0.4 * s);
    this.controller.setCharacterMass(75 * s * s * s);
    // the camera's near plane follows your eyes so tiny you can still see things right in front of you
    this.camera.near = clamp(0.05 * s, 0.004, 0.05);
    this.camera.updateProjectionMatrix();
  }

  // is there room for a bigger you right here? (no growing through ceilings or into trees)
  roomFor(s) {
    const t = this.body.translation();
    const top = this.pos.y + 1.8 * this.size;
    const need = 1.8 * (s - this.size) + 0.05 * s;
    if (need <= 0) return true;
    const up = this.physics.castRay({ x: t.x, y: top - 0.01 * this.size, z: t.z }, { x: 0, y: 1, z: 0 }, need, this.collider);
    if (up) return false;
    const r = RADIUS * s;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.physics.castRay({ x: t.x, y: this.pos.y + Math.min(1.2 * s, top - this.pos.y), z: t.z }, { x: dx, y: 0, z: dz }, r, this.collider)) return false;
    }
    return true;
  }

  readPos(out) {
    const t = this.body.translation();
    return out.set(t.x, t.y - this.halfHeight - this.rad, t.z); // feet
  }

  get feet() { return this.pos; }

  // Key presses are caught every frame and used by the next physics step (so none get lost).
  pollInput() {
    if (input.actionPressed('jump')) this.jumpQ = 0.15;
    if (input.actionPressed('jogToggle')) this.jogQ = true;
  }

  handleLook() {
    const s = 0.0022 * settings.mouseSensitivity;
    this.yaw -= input.mouseDX * s;
    this.pitch -= input.mouseDY * s * (settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.53, 1.53);
  }

  fixedStep(h) {
    if (this.dead) return;
    this.prevPos.copy(this.pos);
    if (this.mantle) { this.stepMantle(h); return; }
    const world = this.world;
    const feet = this.pos;
    const waterY = world.waterAt(feet.x, feet.z);
    const depth = waterY - feet.y;
    this.wading = clamp(depth / (1.2 * this.size), 0, 1);
    this.swimming = depth > 1.25 * this.size;
    const eyeY = feet.y + this.eye;
    this.underwater = waterY > eyeY - 0.02;

    // --- wanted direction ---
    let fx = 0, fz = 0;
    const awake = !this.asleep;
    if (awake && input.action('forward')) fz -= 1;
    if (awake && input.action('back')) fz += 1;
    if (awake && input.action('left')) fx -= 1;
    if (awake && input.action('right')) fx += 1;
    if (!awake) this.jumpQ = 0;
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const dirX = fx * cy + fz * sy;
    const dirZ = -fx * sy + fz * cy;

    if (this.jogQ) { this.jogToggle = !this.jogToggle; this.jogQ = false; }
    const jumpNow = this.jumpQ > 0;
    if (this.jumpQ > 0) this.jumpQ -= h;
    const wantCrouch = (input.action('crouch') || !!this.asleep) && !this.swimming;
    this.setCrouch(wantCrouch);

    const moving = len > 0;
    const wantSprint = awake && input.action('sprint') && moving && !this.crouching && fz < 0.2;
    let speed;
    if (this.swimming) speed = wantSprint && !this.exhausted ? this.spd.swimFast : this.spd.swim;
    else if (this.crouching) speed = this.spd.crouch;
    else if (wantSprint && !this.exhausted && this.brokenLeg <= 0) speed = this.spd.sprint;
    else if (this.jogToggle || (wantSprint && this.exhausted)) speed = this.spd.jog;
    else speed = this.spd.walk;
    // injuries + water slow you down
    speed *= 1 - this.limp * 0.55;
    if (this.brokenLeg > 0) speed = Math.min(speed, 0.9);
    if (!this.swimming) speed *= 1 - this.wading * 0.55;
    if (fz > 0.5) speed *= 0.8; // walking backwards is slower
    const carrying = this.carry ? this.carry() : 0;
    if (carrying > 0) speed *= 1 - Math.min(0.65, carrying / (90 * this.size * this.size)); // heavy things slow you down (strength x size^2)
    this.moveMode = !moving ? 'idle' : this.swimming ? 'swim' : speed >= this.spd.sprint * 0.8 ? 'sprint' : speed >= this.spd.jog * 0.8 ? 'jog' : this.crouching ? 'crouch' : 'walk';

    // --- stamina ---
    const drain = this.swimming ? (moving ? (speed > 1.2 ? 9 : 3) : 1.2) : this.moveMode === 'sprint' ? 9 : this.moveMode === 'jog' ? 1.6 : 0;
    if (this.godMode) this.stamina = 100;
    else if (drain > 0) this.stamina = Math.max(0, this.stamina - drain * h);
    else this.stamina = Math.min(this.staminaCap, this.stamina + (moving ? 7 : 13) * this.regenMul * h);
    if (this.stamina > this.staminaCap) this.stamina = Math.max(this.staminaCap, this.stamina - 20 * h);
    if (this.stamina < 4) this.exhausted = true;
    if (this.exhausted && this.stamina > 35) this.exhausted = false;

    // --- velocity ---
    const tx = dirX * speed, tz = dirZ * speed;
    const accel = this.swimming ? 2.2 : this.grounded ? (moving ? 9 : 12) : 1.6;
    this.vel.x += clamp(tx - this.vel.x, -accel * h, accel * h);
    this.vel.z += clamp(tz - this.vel.z, -accel * h, accel * h);

    if (this.swimming) {
      // float with your head just above the water; space swims up, crouch dives
      const target = waterY - 1.42 * this.size;
      let vy = (target - feet.y) * 2.2;
      if (input.action('jump')) vy = 1.0;
      if (input.action('crouch')) vy = -1.1;
      if (this.underwater && !input.action('jump') && !input.action('crouch')) vy = Math.max(vy, 0.35); // you float back up
      this.vel.y += clamp(vy - this.vel.y, -3 * h, 3 * h);
    } else {
      if (this.grounded) {
        if (this.vel.y < 0) this.vel.y = -1.5 * Math.sqrt(this.size); // stick to slopes
        if (jumpNow && this.tryMantle(dirX, dirZ, moving)) {
          this.jumpQ = 0; // climbing instead of jumping
        } else if (jumpNow && !this.crouching && this.brokenLeg <= 0) {
          this.jumpQ = 0;
          const jumpV = Math.sqrt(2 * 9.81 * 0.45) * (this.exhausted ? 0.7 : 1) * (1 - this.limp * 0.5);
          this.vel.y = jumpV;
          if (!this.godMode) this.stamina = Math.max(0, this.stamina - 6);
          this.events.push({ type: 'jump' });
        }
      } else {
        this.vel.y -= 9.81 * h;
        // air drag -> real terminal velocity (~55 m/s belly down)
        // (tiny you has a lot more air drag for your weight: terminal velocity x sqrt(size))
        this.vel.y -= Math.sign(this.vel.y) * this.vel.y * this.vel.y * (0.0032 / this.size) * h;
      }
    }

    // --- move with collisions ---
    const wasGrounded = this.grounded;
    const fallSpeed = -this.vel.y;
    const desired = { x: this.vel.x * h, y: this.vel.y * h, z: this.vel.z * h };
    this.controller.computeColliderMovement(this.collider, desired, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded() && !this.swimming;
    const t = this.body.translation();
    let nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z;
    // the far mountains are real ground too, but keep you on this planet's map
    const lim = HALF + 2600;
    nx = clamp(nx, -lim, lim); nz = clamp(nz, -lim, lim);
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    // hit something: lose that part of the velocity
    if (Math.abs(mv.x) < Math.abs(desired.x) * 0.5) this.vel.x *= 0.5;
    if (Math.abs(mv.z) < Math.abs(desired.z) * 0.5) this.vel.z *= 0.5;
    if (desired.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0; // bumped your head

    this.pos.set(nx, ny - this.halfHeight - this.rad, nz);

    // --- landing ---
    if (!wasGrounded && this.grounded && fallSpeed > 2) {
      this.landDip = Math.min(0.35, fallSpeed * 0.035) * this.size;
      this.events.push({ type: 'land', speed: fallSpeed / Math.sqrt(this.size) });
      // small bodies shrug off falls, giants break under their own weight
      const tol = Math.pow(this.size, -0.4);
      if (fallSpeed > 6.8 * tol && !this.godMode) this.takeFall(fallSpeed / tol);
    }
    if (this.swimming && !wasGrounded && fallSpeed > 4) this.events.push({ type: 'splash', speed: fallSpeed });

    // --- breath ---
    if (this.underwater && !this.godMode) {
      this.breath -= h;
      if (this.breath < 0) this.damage(9 * h, 'drowning');
    } else this.breath = Math.min(45, this.breath + h * 6);

    // --- footsteps ---
    const hs = Math.hypot(mv.x, mv.z);
    if ((this.grounded || this.wading > 0.05) && hs > 0.0005) {
      this.stepDist += hs;
      const stride = (this.moveMode === 'sprint' ? 1.55 : this.moveMode === 'jog' ? 1.1 : this.crouching ? 0.55 : 0.74) * this.size;
      this.bob += (hs / stride) * Math.PI;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        this.events.push({ type: 'step', surface: this.surfaceUnder(), mode: this.moveMode, wading: this.wading });
      }
    } else if (this.swimming && hs > 0.0005) {
      this.stepDist += hs;
      if (this.stepDist > 1.2) { this.stepDist = 0; this.events.push({ type: 'stroke' }); }
    }

    // injuries heal slowly (limp fades over a few game days; a broken leg takes weeks)
    const gameDays = (h * world.clock.rate) / 86400;
    this.limp = Math.max(0, this.limp - gameDays / 4);
    if (this.brokenLeg > 0) { this.brokenLeg = Math.max(0, this.brokenLeg - gameDays); this.limp = Math.max(this.limp, 0.6); }
    if (!this.godMode && this.health < 100) this.health = Math.min(100, this.health + gameDays * 25);
  }

  // Climb onto or vault over something in front of you (logs, rocks, fences, walls up to ~1.5 m).
  tryMantle(dirX, dirZ, moving) {
    if (this.swimming || this.brokenLeg > 0) return false;
    // look where you're facing (or moving)
    let fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    if (moving) { const l = Math.hypot(dirX, dirZ); fx = dirX / l; fz = dirZ / l; }
    const f = this.pos, S = this.size;
    let wall = null;
    for (const hh of [0.25 * S, 0.5 * S, 0.8 * S, 1.1 * S, 1.4 * S]) {
      const hit = this.physics.castRay({ x: f.x, y: f.y + hh, z: f.z }, { x: fx, y: 0, z: fz }, this.rad + 0.6 * S, this.collider);
      if (hit && (!wall || hit.timeOfImpact < wall)) wall = hit.timeOfImpact;
    }
    if (wall == null) return false;
    // find the top of the thing, then what's behind it
    const probe = (dist) => {
      const x = f.x + fx * dist, z = f.z + fz * dist;
      const hit = this.physics.castRay({ x, y: f.y + 2.2 * S, z }, { x: 0, y: -1, z: 0 }, 3.5 * S, this.collider);
      return hit ? { x, z, y: f.y + 2.2 * S - hit.timeOfImpact } : null;
    };
    const top = probe(wall + 0.12 * S);
    if (!top) return false;
    const rise = top.y - f.y;
    if (rise < 0.3 * S || rise > 1.55 * S) return false;
    // thin obstacle (log, fence)? land on the far side. Thick (boulder, wall top)? stand on top.
    let target = null;
    for (const extra of [0.55 * S, 0.85 * S, 1.15 * S]) {
      const beyond = probe(wall + extra + this.rad);
      if (beyond && beyond.y < top.y - 0.25 * S && beyond.y > f.y - 1.6 * S) { target = { ...beyond, over: true }; break; }
    }
    if (!target) {
      const onTop = probe(wall + this.rad + 0.15 * S);
      if (!onTop || Math.abs(onTop.y - top.y) > 0.3 * S) return false;
      target = { ...onTop, over: false };
    }
    // room for your body there?
    const head = this.physics.castRay({ x: target.x, y: target.y + 0.05 * S, z: target.z }, { x: 0, y: 1, z: 0 }, 1.75 * S, this.collider);
    if (head) return false;
    const peak = Math.max(top.y, target.y) + 0.15 * S;
    const dur = (0.45 + rise / S * 0.35) * Math.sqrt(S) * (this.exhausted ? 1.4 : 1);
    this.mantle = { t: 0, dur, from: this.pos.clone(), peak, to: new THREE.Vector3(target.x, target.y + 0.02 * S, target.z), over: target.over };
    this.vel.set(0, 0, 0);
    if (!this.godMode) this.stamina = Math.max(0, this.stamina - 6 - rise / S * 6);
    this.events.push({ type: 'climb', rise: rise / S });
    return true;
  }

  stepMantle(h) {
    const m = this.mantle;
    m.t += h / m.dur;
    const t = Math.min(m.t, 1);
    // up first, then forward + down (like pulling yourself over)
    const up = Math.min(1, t / 0.55);
    const fwd = smoothstep(0.25, 1, t);
    const x = lerp(m.from.x, m.to.x, fwd), z = lerp(m.from.z, m.to.z, fwd);
    const yUp = lerp(m.from.y, m.peak, 1 - (1 - up) * (1 - up));
    const y = t < 0.6 ? yUp : lerp(m.peak, m.to.y, smoothstep(0.6, 1, t));
    this.pos.set(x, y, z);
    this.body.setNextKinematicTranslation({ x, y: y + this.halfHeight + this.rad, z });
    this.bob += h * 6;
    if (m.t >= 1) {
      this.mantle = null;
      this.grounded = true;
      this.events.push({ type: 'step', surface: this.surfaceUnder(), mode: 'walk', wading: 0 });
    }
  }

  setCrouch(want) {
    if (want === this.crouching) return;
    if (!want) {
      // only stand up if there is room above your head
      const t = this.body.translation();
      const hit = this.physics.castRay({ x: t.x, y: t.y + this.crouchHalf + this.rad - 0.05 * this.size, z: t.z }, { x: 0, y: 1, z: 0 }, (this.standHalf - this.crouchHalf) * 2 + 0.1 * this.size, this.collider);
      if (hit) return;
    }
    const newHalf = want ? this.crouchHalf : this.standHalf;
    const t = this.body.translation();
    const dy = newHalf - this.halfHeight;
    this.collider.setHalfHeight(newHalf);
    this.body.setTranslation({ x: t.x, y: t.y + dy, z: t.z }, true);
    this.halfHeight = newHalf;
    this.crouching = want;
  }

  takeFall(v) {
    const dmg = Math.pow(v - 6.5, 2) * 2.3;
    this.damage(dmg, 'fall');
    if (dmg > 18) this.limp = Math.min(1, this.limp + dmg / 60);
    if (dmg > 42 && !this.dead) {
      this.brokenLeg = 42; // about six weeks of game time, like a real fracture
      this.events.push({ type: 'injury', what: 'broken leg' });
    }
  }

  damage(amount, cause) {
    if (this.godMode || this.dead) return;
    this.health -= amount;
    this.events.push({ type: 'hurt', amount, cause });
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.events.push({ type: 'death', cause });
    }
  }

  surfaceUnder() {
    if (this.wading > 0.08) return 'water';
    const t = this.body.translation();
    const hit = this.physics.castRay({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 }, this.halfHeight + this.rad + 0.4 * this.size, this.collider);
    const surf = hit?.collider?.userData?.surface;
    if (surf && surf !== 'ground') return surf;
    return this.world.surfaceAt(this.pos.x, this.pos.z);
  }

  // camera follows the eyes; called every rendered frame
  updateCamera(dt, alpha) {
    const p = this.prevPos.clone().lerp(this.pos, alpha);
    const targetEye = this.crouching ? this.eyeCrouch : this.eyeStand;
    this.eye = lerp(this.eye, targetEye, 1 - Math.exp(-dt * 10));
    this.landDip = lerp(this.landDip, 0, 1 - Math.exp(-dt * 7));
    let bobY = 0, bobX = 0;
    if (settings.headBob && this.grounded) {
      const amp = this.moveMode === 'sprint' ? 0.045 : this.moveMode === 'jog' ? 0.03 : this.moveMode === 'idle' ? 0 : 0.018;
      bobY = (Math.abs(Math.sin(this.bob)) * amp - amp * 0.5) * this.size;
      bobX = Math.cos(this.bob) * amp * 0.6 * this.size;
    }
    // breathing (heavy when out of breath)
    const tired = 1 - this.stamina / 100;
    const breathAmp = 0.004 + tired * tired * 0.02;
    const bt = performance.now() / 1000 * (1.4 + tired * 1.6);
    const breathY = Math.sin(bt * 2) * breathAmp * this.size;
    // lean around corners
    const wantLean = (input.action('leanRight') ? 1 : 0) - (input.action('leanLeft') ? 1 : 0);
    this.lean = lerp(this.lean, this.swimming ? 0 : wantLean, 1 - Math.exp(-dt * 9));
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
    const leanOff = this.lean * 0.38 * this.size;
    this.camera.position.set(
      p.x + rightX * (bobX + leanOff),
      p.y + this.eye + bobY + breathY - this.landDip,
      p.z + rightZ * (bobX + leanOff),
    );
    // limp: a little dip every other step
    if (this.limp > 0 && this.grounded && this.moveMode !== 'idle') this.camera.position.y -= Math.max(0, Math.sin(this.bob * 0.5)) * 0.05 * this.limp * this.size;
    this.camera.rotation.set(this.pitch + this.swayPitch, this.yaw, -this.lean * 0.12 + this.sway, 'YXZ');
  }

  dispose() {
    this.unhook();
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeRigidBody(this.body);
  }
}

export { SPEED, WORLD_SIZE };
