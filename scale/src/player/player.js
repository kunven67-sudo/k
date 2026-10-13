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
import { settings as _settings } from '../core/settings.js';
import { createGlitch } from './glitch.js';
import { Hands } from './hands.js';
import { ShrinkRay, Phone } from './tools.js';

export const BASE_HEIGHT = 1.75;
export const MIN_SCALE = 0.0008; // 1.4 mm (Wave 1 floor; the micro world goes further later)
export const MAX_SCALE = 10; // 17.5 m
const G = 9.81;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const _sv = new THREE.Vector3();
const _sd = new THREE.Vector3();
const TINY = 0.1; // under 10 cm tall, up/down movement uses exact rays (see _tinyVertical)
const TINY_RAYS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const DOWN = { x: 0, y: -1, z: 0 };
const UPV = { x: 0, y: 1, z: 0 };

export class Player {
  constructor(game, { position = [0, 0, 0], yaw = 0, scale = 1, model = null } = {}) {
    this.game = game;
    this.kind = 'player';
    this.name = 'You';
    // Rays for tiny movement ignore you, what you're holding, and animals (handled on their own).
    this._rayFilter = (c) => {
      const o = game.physics.ownerOf(c);
      return !(o && (o === this || o.held || o.kind === 'creature'));
    };
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
    this.dead = false;
    this.deadT = 0;
    this.heldBy = null; // a creature holding you (mantis claws, a spider...)
    this.struggle = 0; // 0..1, how close you are to getting free
    this.camDist = 2.4; // body heights
    this.firstPerson = settings.get('firstPerson');
    this.crouching = false;
    this.lastImpact = 0;
    this.jumpBuffer = 0; // a jump press waits up to 0.12 s for the next physics step / landing
    this.resizeTarget = null; // set by machines (the lab's reset pad): smoothly go to this scale

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
    this.hands = new Hands(this, game);
    this.hands.addTool('ray', new ShrinkRay(game, this));
    this.hands.addTool('phone', new Phone(game, this));
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
    // The controller's anti-sticking nudge is a fixed 0.1 mm by default: fine at 1.75 m, but 7% of your
    // height at 1.4 mm (you'd float, and get pushed through thin floors). Scale it with you.
    this.kcc.setNormalNudgeFactor(1e-4 * (H / BASE_HEIGHT));
    this.kcc.enableAutostep(0.22 * H, 0.04 * H, false);
    // When tiny, standing/landing/slopes are done with exact rays instead (see _tinyVertical).
    if (H < TINY) this.kcc.disableSnapToGround();
    else this.kcc.enableSnapToGround(0.18 * H);
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
        if (o && o === this.heldBy) return false;
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
    if (this.dead) {
      // Lying there. You come back after a few seconds (or the world ends, with permadeath on).
      this.deadT += dt;
      this.sizeRate = 0;
      if (this.deadT > 4.5 && !_settings.get('permadeath')) this.respawn();
      return;
    }
    const s = this.scale;
    const H = this.height;

    // Watch: hold to shrink / grow, smooth like a zoom. Shift = faster.
    const dir = (input.down('grow') ? 1 : 0) - (input.down('shrink') ? 1 : 0);
    if (dir) this.resizeTarget = null; // your own watch always wins over a machine
    const want = dir * (input.down('sprint') ? 2.4 : 0.9);
    if (this.resizeTarget !== null && !dir) {
      // Machine resize: ease toward the target size (fast when far, gentle at the end).
      const gap = Math.log(this.resizeTarget / s);
      const rate = clamp(gap * 5, -2.4, 2.4);
      this.sizeRate = Math.sign(rate) * Math.max(Math.abs(rate), 0.05);
      if (Math.abs(gap) < 0.01 || Math.abs(this.sizeRate * dt) >= Math.abs(gap)) {
        if (this.tryResize(this.resizeTarget, false)) bus.emit('player:resized', this.resizeTarget);
        else bus.emit('player:blocked');
        this.resizeTarget = null;
        this.sizeRate = 0;
      }
    } else this.sizeRate = dir ? damp(this.sizeRate, want, 5, dt) : damp(this.sizeRate, 0, 14, dt);
    if (Math.abs(this.sizeRate) > 1e-4) {
      const ns = clamp(s * Math.exp(this.sizeRate * dt), MIN_SCALE, MAX_SCALE);
      if (!this.tryResize(ns, input.down('force'))) {
        this.sizeRate = 0;
        this.resizeTarget = null;
        this.blockedT = 1.5;
        bus.emit('player:blocked');
      }
    }

    if (this.heldBy) {
      this.vel.set(0, 0, 0);
      this.grounded = false;
      this.airTime = 0;
      if (this.blockedT > 0) this.blockedT -= dt;
      return;
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
    // Aiming the ray (or charging a throw) turns your body to face where you look.
    const aiming = this.hands && ((this.hands.slots.right?.kind === 'tool' && this.hands.slots.right.ref.id === 'ray') || this.hands.charge > 0);
    if (aiming) this.facing += angDiff(this.facing, this.yaw) * (1 - Math.exp(-14 * dt));
    else if (Math.hypot(wx, wz) > 0.1) this.facing += angDiff(this.facing, Math.atan2(-wx, -wz)) * (1 - Math.exp(-12 * dt));

    // Gravity with air drag (terminal velocity ~ sqrt(size)). The step uses the average speed over the
    // step (exact for constant gravity), so a tiny you doesn't drop twice as far in the first frame.
    const vt = 55 * Math.sqrt(this.scale);
    let vyStart = this.vel.y;
    this.vel.y -= G * dt;
    this.vel.y -= Math.sign(this.vel.y) * G * (this.vel.y / vt) ** 2 * dt;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.grounded && this.jumpBuffer > 0) {
      this.jumpBuffer = 0;
      const jumpH = 0.45 * (this.scale < 1 ? Math.pow(this.scale, 0.3) : Math.pow(this.scale, 0.15));
      this.vel.y = Math.sqrt(2 * G * jumpH);
      vyStart = this.vel.y; // a jump starts at full speed
      this.grounded = false;
    }

    // Character controller: slide along walls, step up stairs, snap to the ground.
    const desired = { x: this.vel.x * dt, y: (vyStart + this.vel.y) * 0.5 * dt, z: this.vel.z * dt };
    // Animals are left out of the controller: it pushes you away from any self-moving body from about
    // 5 cm before you touch it, which is nothing at normal size but 10 body lengths when you're tiny.
    // Bumping into animals is handled right after, exactly.
    const filter = (c) => {
      const o = this.game.physics.ownerOf(c);
      return !(o && (o.held || o.kind === 'creature'));
    };
    // When you're tiny (under 10 cm) the physics engine's character mover can't be trusted with up and
    // down: pressing down on a curved floor made of many small triangles (a tunnel, a crumb) it slips
    // through, more often the smaller you are. So when tiny:
    //  - sideways moves still use it (sliding along walls, stepping up), in sub-moves of at most ~0.3
    //    body heights, with no push down;
    //  - standing, landing, slopes, ledges and ceilings use exact rays (_tinyVertical).
    const world = this.game.physics.world;
    const m = { x: 0, y: 0, z: 0 };
    let subGrounded = false;
    const move = (dx, dy, dz) => {
      if (m.x || m.y || m.z) {
        this.body.setTranslation({ x: this.feet.x + m.x, y: this.feet.y + H / 2 + m.y, z: this.feet.z + m.z }, false);
        world.propagateModifiedBodyPositionsToColliders();
      }
      this.kcc.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.player, filter);
      const sm = this.kcc.computedMovement();
      m.x += sm.x;
      m.y += sm.y;
      m.z += sm.z;
      return this.kcc.computedGrounded();
    };
    if (H < TINY) {
      const subs = Math.min(12, Math.max(1, Math.ceil(Math.hypot(desired.x, desired.z) / (0.3 * H))));
      if (desired.x || desired.z) for (let i = 0; i < subs; i++) move(desired.x / subs, 0, desired.z / subs);
      // Back to where the body was this step, so its real motion (and what it pushes) is the whole move.
      this.body.setTranslation({ x: this.feet.x, y: this.feet.y + H / 2, z: this.feet.z }, false);
      world.propagateModifiedBodyPositionsToColliders();
      this._tinyWalls(m);
      subGrounded = this._tinyVertical(m, desired.y);
    } else subGrounded = move(desired.x, desired.y, desired.z);
    const wasGrounded = this.grounded;
    this.grounded = subGrounded;
    const vyBefore = this.vel.y;
    if (this.grounded && this.vel.y < 0) {
      if (!wasGrounded && this.airTime > 0.15) this._land(-vyBefore);
      this.vel.y = 0;
    }
    if (!this.grounded && desired.y > 0 && m.y < desired.y * 0.5) this.vel.y = Math.min(0, this.vel.y); // bonked a ceiling
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    const oldFeet = _v3.copy(this.feet);
    this.feet.x += m.x;
    this.feet.y += m.y;
    this.feet.z += m.z;
    if (H < TINY) this._tinySafety(oldFeet, dt);
    this._pushOutOfCreatures();
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + H / 2, z: this.feet.z });

    // Safety net: never fall out of the world.
    if (this.feet.y < -60 || !Number.isFinite(this.feet.y)) this.respawn();
    if (this.blockedT > 0) this.blockedT -= dt;
  }

  // Walls when you're tiny: the sideways move is checked with rays at knee, waist and head height (from
  // where you were toward where the controller put you). Anything too steep to stand on stops you there.
  // Knee height is above the step-up height, so you still step onto crumbs and bumps.
  _tinyWalls(m) {
    const dh = Math.hypot(m.x, m.z);
    if (dh < 1e-9) return;
    const physics = this.game.physics;
    const H = this.height, r = this.radius;
    const eps = Math.max(1e-6, 0.004 * H);
    const opts = { excludeBody: this.body, predicate: this._rayFilter };
    _sd.set(m.x / dh, 0, m.z / dh);
    let keep = dh;
    for (const h of [0.3, 0.55, 0.85]) {
      _sv.set(this.feet.x, this.feet.y + Math.max(0, m.y) + H * h, this.feet.z);
      const hit = physics.raycast(_sv, _sd, dh + r, opts);
      if (hit && hit.normal.y < 0.5 && hit.normal.y > -0.5) keep = Math.min(keep, Math.max(0, hit.dist - r - eps));
    }
    if (keep < dh) {
      m.x = _sd.x * keep;
      m.z = _sd.z * keep;
    }
  }

  // Up and down when you're tiny, with exact rays (they work the same at any size). `m` is this step's
  // move so far (sideways); its y gets set here. Five rays under your feet (middle and around) find the
  // highest walkable surface: you land on it, stand on it, step up onto small bumps (up to a quarter of
  // your height) and follow it down slopes while walking. Ceilings stop you going up.
  // Returns whether you're standing on something.
  _tinyVertical(m, dy) {
    const physics = this.game.physics;
    const H = this.height, r = this.radius;
    const opts = { excludeBody: this.body, predicate: this._rayFilter };
    const x = this.feet.x + m.x, z = this.feet.z + m.z, y0 = this.feet.y + m.y;
    const eps = Math.max(1e-6, 0.004 * H);
    const up = 0.25 * H;
    const follow = this.grounded && dy <= 0 ? Math.hypot(m.x, m.z) * 1.2 + 0.03 * H : 0; // down a slope up to 50 degrees
    const reach = up + Math.max(0, -dy) + follow;
    let ground = -Infinity, block = -Infinity, bn = null;
    const k = r * 0.7;
    for (const [ox, oz] of TINY_RAYS) {
      _sv.set(x + ox * k, y0 + up, z + oz * k);
      const hit = physics.raycast(_sv, DOWN, reach, opts);
      if (!hit) continue;
      if (hit.normal.y > 0.5) ground = Math.max(ground, hit.point.y);
      else if (hit.point.y > block) {
        block = hit.point.y; // too steep to stand on, but you can't fall through it either
        bn = hit.normal;
      }
    }
    let ny = y0 + dy;
    let grounded = false;
    if (ground > -Infinity && (ny <= ground + eps || follow > 0)) {
      ny = ground + eps;
      grounded = true;
    } else if (block > -Infinity && ny <= block + eps && dy < 0) {
      // Landed on a steep surface: you slide off it (down and away), like real life.
      ny = block + eps;
      const slide = Math.min(0.3 * H, -dy * 0.7);
      const hl = Math.hypot(bn.x, bn.z) || 1;
      m.x += (bn.x / hl) * slide;
      m.z += (bn.z / hl) * slide;
    }
    if (ny > y0) {
      // Going up: stop at a ceiling.
      _sv.set(x, y0 + H * 0.6, z);
      const hit = physics.raycast(_sv, UPV, H * 0.4 + (ny - y0), opts);
      if (hit && hit.normal.y < -0.3) {
        ny = Math.min(ny, Math.max(y0, hit.point.y - H - eps));
        if (!grounded) this.vel.y = Math.min(0, this.vel.y);
      }
    }
    m.y = ny - this.feet.y;
    return grounded;
  }

  // Safety net when you're tiny: the character controller can slip through triangle surfaces (tunnels,
  // sculpted ground) when you're a few millimeters tall. Rays are exact at any size, so the move is
  // checked with rays and stopped at any surface they find: walls, floors, ceilings.
  _tinySafety(oldFeet, dt) {
    const physics = this.game.physics;
    const H = this.height, r = this.radius;
    const pred = (c) => {
      const o = physics.ownerOf(c);
      return !(o && (o === this || o.held || o.kind === 'creature'));
    };
    const opts = { excludeBody: this.body, predicate: pred };
    const off = Math.max(2e-6, 0.004 * H);
    // Sideways: from the old middle of your body toward the new one.
    const c0 = _sv.set(oldFeet.x, oldFeet.y + H * 0.5, oldFeet.z);
    const dx = this.feet.x - oldFeet.x, dz = this.feet.z - oldFeet.z;
    const dh = Math.hypot(dx, dz);
    if (dh > 1e-9) {
      const dir = _sd.set(dx / dh, 0, dz / dh);
      const hit = physics.raycast(c0, dir, dh + r, opts);
      if (hit && Math.abs(hit.normal.y) < 0.7) {
        const keep = Math.max(0, hit.dist - r - off);
        this.feet.x = oldFeet.x + dir.x * keep;
        this.feet.z = oldFeet.z + dir.z * keep;
      }
    }
    // Up: don't push your head through a ceiling.
    if (this.feet.y > oldFeet.y) {
      const hit = physics.raycast(c0, { x: 0, y: 1, z: 0 }, H * 0.5 + (this.feet.y - oldFeet.y), opts);
      if (hit && hit.normal.y < -0.3) {
        this.feet.y = Math.min(this.feet.y, hit.point.y - H - off);
        this.vel.y = Math.min(0, this.vel.y);
      }
    }
    // Down: if you sank into the floor (or through it), stand back on top of it.
    const mid = _sv.set(this.feet.x, Math.max(this.feet.y, oldFeet.y) + H * 0.5, this.feet.z);
    const down = physics.raycast(mid, { x: 0, y: -1, z: 0 }, mid.y - this.feet.y + H * 0.02, opts);
    if (down && down.normal.y > 0.6 && down.point.y > this.feet.y - H * 0.002) {
      this.feet.y = down.point.y + off;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    }
  }

  // If you're overlapping an animal's body, get pushed straight out of it by exactly the overlap.
  _pushOutOfCreatures() {
    if (!this.game.creatures?.size) return;
    const physics = this.game.physics;
    const H = this.height, r = this.radius;
    const shape = new RAPIER.Capsule(Math.max(1e-6, H / 2 - r), r);
    const rot = { x: 0, y: 0, z: 0, w: 1 };
    for (let iter = 0; iter < 2; iter++) {
      const pos = { x: this.feet.x, y: this.feet.y + H / 2, z: this.feet.z };
      let moved = false;
      for (const c of physics.overlaps(shape, pos, rot, { predicate: (c) => physics.ownerOf(c)?.kind === 'creature' })) {
        const o = physics.ownerOf(c);
        const sh = o.shapeOf?.(c);
        if (!sh) continue;
        const ct = shape.contactShape(pos, rot, sh, c.translation(), c.rotation(), 0);
        if (!ct || ct.distance >= 0) continue;
        // normal1 points from you toward the animal; move the other way (never down into the floor).
        const d = -ct.distance + Math.max(1e-6, H * 0.002);
        this.feet.x -= ct.normal1.x * d;
        this.feet.z -= ct.normal1.z * d;
        if (ct.normal1.y < 0) this.feet.y -= ct.normal1.y * d;
        moved = true;
      }
      if (!moved) break;
    }
  }

  // Impact damage depends on absolute impact speed (tissue stress ~ v^2, size-independent).
  // Small bodies are safe because their terminal velocity is low.
  _land(speed) {
    this.lastImpact = speed;
    if (speed > 7.5) {
      const dmg = Math.round((speed - 7.5) ** 1.6 * 4);
      this.hurt(dmg, { cause: speed > 20 ? 'Hit the ground way too hard' : 'Fell too hard', at: this.feet.clone(), dir: new THREE.Vector3(0, 1, 0), gore: dmg > 25 });
    }
  }

  // Getting hurt by anything (falls, bites, hits). With gore on, you bleed: The Glitch bleeds dark,
  // with glitching cyan bits.
  hurt(amount, { cause = 'Hurt', at = null, dir = null, gore = false } = {}) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFx = 1;
    bus.emit('player:hurt', { amount, cause });
    if (gore && this.game.gore) {
      const p = at || this.feet.clone().addScaledVector(UP, this.height * 0.55);
      this.game.gore.burst(p, dir || UP, this.height, 6 + Math.min(14, amount * 0.4), { glitch: true });
    }
    if (this.health <= 0) this.die(cause);
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.health = 0;
    this.resizeTarget = null;
    bus.emit('player:died', { cause, permadeath: !!_settings.get('permadeath') });
  }

  // A creature caught you (mantis claws, a spider's bite and wrap).
  grabbed(by) {
    this.heldBy = by;
    this.struggle = 0;
    this.vel.set(0, 0, 0);
    this.resizeTarget = null;
  }

  released(by, vel = null) {
    if (this.heldBy !== by) return;
    this.heldBy = null;
    this.struggle = 0;
    if (vel) this.vel.copy(vel);
    this.grounded = false;
  }

  // Held at a point (your middle), moved there by whatever is holding you.
  holdAt(point) {
    this.feet.copy(point).addScaledVector(UP, -this.height * 0.5);
    // Never pushed into the ground: if you're bigger than the gap under the claws (you grew), your
    // feet rest on the ground and the claws hold you higher up.
    const physics = this.game.physics;
    const hit = physics.raycast({ x: point.x, y: point.y, z: point.z }, { x: 0, y: -1, z: 0 }, this.height * 2, {
      excludeBody: this.body,
      predicate: (c) => {
        const o = physics.ownerOf(c);
        return !(o && (o === this.heldBy || o.kind === 'creature' || o.held));
      },
    });
    if (hit && this.feet.y < hit.point.y + this.height * 0.01) this.feet.y = hit.point.y + this.height * 0.01;
    this.prevFeet.copy(this.feet);
    this.renderFeet.copy(this.feet);
    const c = { x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z };
    this.body.setTranslation(c, true);
    this.body.setNextKinematicTranslation(c);
    this._syncObject();
  }

  // Put your feet at a point (no fall, no momentum).
  teleport(point) {
    this.feet.copy(point);
    this.prevFeet.copy(this.feet);
    this.renderFeet.copy(this.feet);
    this.vel.set(0, 0, 0);
    const c = { x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z };
    this.body.setTranslation(c, true);
    this.body.setNextKinematicTranslation(c);
    this._syncObject();
  }

  respawn() {
    if (this.heldBy) this.released(this.heldBy);
    this.dead = false;
    this.deadT = 0;
    this.resizeTarget = null;
    this.sizeRate = 0;
    this.jumpBuffer = 0;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    bus.emit('player:respawn');
    const sp = this.game.spawn;
    this.feet.fromArray(sp.position);
    this.prevFeet.copy(this.feet);
    this.vel.set(0, 0, 0);
    this.scale = 1;
    this._configureForScale();
    this.body.setTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z }, true);
    this.health = 100;
  }

  // Called once per frame before the physics steps: remember presses so none get lost on frames
  // that happen to have no physics step (fast monitors run more frames than physics steps).
  latchInput() {
    if (input.pressed('jump')) this.jumpBuffer = 0.12;
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
    const R = this.hands?.slots.right, L = this.hands?.slots.left;
    const poseR = !R ? null : R.kind === 'tool' ? (R.ref.id === 'ray' ? 'aim' : 'hold') : R.two ? 'carry2' : 'hold';
    const poseL = !L ? null : L.kind === 'tool' ? (L.ref.id === 'phone' ? 'phone' : 'hold') : L.two ? 'carry2' : 'hold';
    this.model.userData.animate?.(dt, { speed: this.dead || this.heldBy ? 0 : hs, grounded: this.grounded || !!this.heldBy, vy: this.vel.y / Math.sqrt(this.scale), crouch: this.crouching, scaleRate: this.sizeRate, scale: this.scale, hurt: this.hurtFx, poseR, poseL, aimPitch: this.pitch, held: !!this.heldBy && !this.dead, dead: this.dead });
    // Dead and not held: the body falls over backwards and lies on the ground.
    const lie = this.dead && !this.heldBy ? 1 : 0;
    this._lie = damp(this._lie || 0, lie, lie ? 5 : 20, dt);
    this.model.rotation.x = this._lie * 1.5;
    this.model.position.y = this._lie * 0.12;
  }

  // Third-person camera with collision, or first-person.
  updateCamera(camera, dt) {
    if (this.showcase) return this._showcaseCamera(camera, dt);
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

// Title-screen shot: the camera in front of you, a little to the side, slowly drifting, with you on
// the right of the frame (the menu is on the left). Never inside a wall.
Player.prototype._showcaseCamera = function (camera, dt) {
  const H = this.height;
  const physics = this.game.physics;
  this._showT = (this._showT || 0) + dt;
  const f = this.facing + Math.sin(this._showT * 0.12) * 0.18;
  const front = new THREE.Vector3(-Math.sin(f), 0, -Math.cos(f));
  const side = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f)); // your right
  const chest = this.renderFeet.clone().addScaledVector(UP, H * 0.7);
  const want = front.clone().multiplyScalar(1.65 * H).addScaledVector(side, -0.5 * H).addScaledVector(UP, 0.05 * H);
  const dist = want.length();
  const dir = want.clone().divideScalar(dist);
  const hit = physics.sphereCast(chest, dir, H * 0.08, dist, {
    excludeBody: this.body,
    predicate: (c) => {
      const o = physics.ownerOf(c);
      return !(o && (o === this || (o.mass !== undefined && o.size < H * 0.4)));
    },
  });
  const d = hit ? Math.max(H * 0.5, hit.dist - H * 0.05) : dist;
  camera.position.copy(chest).addScaledVector(dir, d);
  // Aim to the left of you so you stand in the right part of the picture.
  const camRight = new THREE.Vector3().crossVectors(dir.clone().negate(), UP).normalize();
  const look = chest.clone().addScaledVector(UP, H * 0.02).addScaledVector(camRight, -0.5 * H * (d / dist));
  camera.up.set(0, 1, 0);
  camera.lookAt(look);
  camera.near = Math.max(1e-6, H * 0.03);
  camera.far = clamp(H * 4000, 80, 4000);
  camera.fov = settings.get('fov');
  camera.updateProjectionMatrix();
  this.model.visible = true;
};

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
