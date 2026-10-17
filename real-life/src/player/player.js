// You: a first-person body. The camera sits in your head; look down and you see your own body
// (the head is hidden so it never blocks the view). Weighty KCC movement, head bob, footsteps by
// floor, crouch, and aiming at things to use them (E).
//
//   const player = new Player(engine, world, { look, age, spawn, yaw })
//   state.fixedUpdate(step) -> player.fixedUpdate(step)
//   state.update(dt)        -> player.update(dt)
//   player.focus            -> { it, dist, point } what the crosshair is on
//   player.locked = true    -> no control (cutscenes, sleeping, menus)

import * as THREE from 'three';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { bus } from '../core/events.js';
import { clamp, damp, lerp } from '../core/util.js';
import { Controller } from './controller.js';
import { Person } from '../people/person.js';
import { step as stepSound, loadSound } from './sound.js';

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

loadSound();

export class Player {
  constructor(engine, world, { look, age, spawn, yaw = 0, name = 'You' }) {
    this.engine = engine;
    this.world = world;
    this.physics = world.physics;
    this.look = look;
    this.age = age;
    this.name = name;
    this.body = new Person(look, age, { name });
    this.body.setHeadVisible(false);
    this.body.root.userData.isPlayer = true;
    world.scene.add(this.body.root);
    this.camera = new THREE.PerspectiveCamera(settings.get('fov') || 75, innerWidth / innerHeight, 0.05, 1200);
    this.yaw = yaw; // view yaw: looking along (-sin, -cos) like three's default camera
    this.pitch = 0;
    this._makeController(spawn);
    this.position = new THREE.Vector3().copy(this.controller.curr);
    this.locked = false;
    this.focus = null;
    this.reach = 2.1;
    this.sinceFixed = 0;
    this._bob = 0;
    this._bobAmp = 0;
    this._stepPhase = 0;
    this._wantJump = false;
    this._crouchK = 0;
    this.seat = null; // { at, faceYaw, pose }
    this.surface = 'carpet';
  }

  _makeController(spawn) {
    if (this.controller) this.controller.dispose();
    const h = this.body.height;
    const radius = clamp(h * 0.16, 0.14, 0.3);
    this.controller = new Controller(this.physics, { position: { ...spawn, yaw: this.yaw + Math.PI }, height: h * 0.97, radius, owner: { kind: 'player', player: this } });
    // Kids are slower, toddlers slower still.
    this.controller.speedScale = clamp(0.45 + h / 3.2, 0.55, 1);
  }

  get height() {
    return this.body.height;
  }

  /** Grow up: rebuild the body + capsule at the new size. */
  setAge(age) {
    this.age = age;
    const oldH = this.body.height;
    this.body.setAge(age);
    this.body.setHeadVisible(false);
    if (Math.abs(this.body.height - oldH) > 0.02) this._makeController({ x: this.position.x, y: this.position.y, z: this.position.z });
  }

  /** Teleport (feet). yaw = view yaw. */
  place(p, yaw = null) {
    if (yaw != null) this.yaw = yaw;
    this.controller.place(p, this.yaw + Math.PI);
    this.position.copy(this.controller.curr);
    this.seat = null;
    this.body.pose = 'stand';
  }

  forward(out) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  eye(out) {
    if (this.forceCrawl) return this.body.eyePosition(out); // crawling: eyes are out in front
    const crouch = this._crouchK * 0.35 * this.height;
    return out.copy(this.position).setY(this.position.y + this.height * 0.93 - crouch);
  }

  // -------------------------------------------------------------------------------- simulation
  fixedUpdate(step) {
    this.sinceFixed = 0;
    if (this.seat) return;
    const c = this.controller;
    const fwd = this.forward(_f);
    const rgt = _r.set(-fwd.z, 0, fwd.x);
    const mx = this.locked ? 0 : input.move.x;
    const my = this.locked ? 0 : input.move.y;
    c.fixedUpdate(step, {
      wishX: fwd.x * my + rgt.x * mx,
      wishZ: fwd.z * my + rgt.z * mx,
      wishMag: Math.hypot(mx, my),
      sprint: !this.locked && input.down('sprint'),
      crouch: !this.locked && input.down('crouch'),
      jump: this._wantJump,
      locked: this.locked,
    });
    this._wantJump = false;
  }

  update(dt) {
    const c = this.controller;
    this.sinceFixed += dt;
    // Mouse look.
    if (!this.locked || this.lookWhileLocked) {
      const sens = (settings.get('mouseSensitivity') ?? 1) * 0.0022;
      const inv = settings.get('invertY') ? -1 : 1;
      this.yaw -= input.look.x * sens;
      this.pitch = clamp(this.pitch - input.look.y * sens * inv, -1.45, 1.45);
    }
    if (!this.locked && !this.seat && input.pressed('jump')) this._wantJump = true;
    if (this.seat && !this.locked && (input.pressed('jump') || input.move.y !== 0 || input.move.x !== 0) && this.seat.leaveOnMove !== false) this.stand();

    if (!this.seat) this.position.copy(c.renderFeet(this.sinceFixed * 60, _v));
    this._crouchK = damp(this._crouchK, c.crouch ? 1 : 0, 0.08, dt);

    // Body follows the view yaw; legs animate from ground speed.
    const body = this.body;
    if (this.seat) {
      body.root.position.copy(this.seat.at);
      body.root.rotation.y = this.seat.faceYaw;
      body.pose = this.seat.pose || 'sit';
      body.setMotion({ speed: 0 });
    } else {
      body.root.position.copy(this.position);
      body.root.rotation.y = this.yaw + Math.PI;
      body.pose = c.crouch || this.forceCrawl ? 'crawl' : body.pose === 'carry' ? 'carry' : 'stand';
      if (body.pose === 'crawl' && this.age >= 2 && !this.forceCrawl) body.pose = 'stand';
      body.setMotion({ speed: c.speed, grounded: c.grounded });
    }
    body.update(dt);

    // Camera: eye + bob.
    const moving = !this.seat && c.grounded ? clamp(c.speed / 1.4, 0, 1.6) : 0;
    this._bobAmp = damp(this._bobAmp, moving, 0.15, dt);
    const bobOn = settings.get('cameraBob') !== false;
    const stepRate = c.speed > 3 ? 2.6 : 1.9;
    this._stepPhase += dt * stepRate * Math.max(0.6, c.speed / 1.4) * (this._bobAmp > 0.05 ? 1 : 0);
    const bob = bobOn ? Math.sin(this._stepPhase * Math.PI * 2) * 0.028 * this._bobAmp * (this.height / 1.75) : 0;
    const sway = bobOn ? Math.cos(this._stepPhase * Math.PI) * 0.018 * this._bobAmp : 0;
    if (this.seat) {
      body.root.updateMatrixWorld(true);
      body.eyePosition(_v);
      this.camera.position.lerp(_v, 1 - Math.pow(0.001, dt));
    } else {
      this.eye(_v);
      _v.y += bob - (c.landDip || 0) * 0.08;
      _v.x += Math.cos(this.yaw) * sway;
      _v.z -= Math.sin(this.yaw) * sway;
      // Push the eye slightly forward so you don't see the inside of your own neck.
      this.forward(_f);
      _v.addScaledVector(_f, 0.08 * (this.height / 1.75));
      this.camera.position.copy(_v);
    }
    _e.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(_e);
    const fov = (settings.get('fov') || 75) + (c.sprinting ? 4 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.pow(0.002, dt));
      this.camera.updateProjectionMatrix();
    }

    // Footsteps: one sound each time the bob passes its low point.
    const phaseStep = Math.floor(this._stepPhase * 2);
    if (phaseStep !== this._lastStep && this._bobAmp > 0.25 && c.grounded && !this.seat) {
      this._lastStep = phaseStep;
      this.surface = this.world.surfaceAt(this.position);
      stepSound(this.surface, { gain: (c.sprinting ? 0.85 : 0.55) * (this.height / 1.75), position: this.position });
    }

    // What are we looking at?
    this.focus = this.locked ? null : this._pick();
    if (!this.locked && input.pressed('interact') && this.focus) {
      const r = this.focus.it.use?.(this);
      bus.emit('player:used', { it: this.focus.it, result: r });
    } else if (!this.locked && input.pressed('use') && this.focus?.it.useAlt) {
      this.focus.it.useAlt(this);
    }
  }

  _pick() {
    const cam = this.camera;
    cam.getWorldDirection(_f);
    const origin = cam.position;
    // Walls/furniture in between block the aim.
    const hit = this.physics.raycast(origin, _f, this.reach + 0.3, { exclude: this.controller.collider });
    const maxD = hit ? Math.min(this.reach, hit.distance + 0.35) : this.reach;
    return this.world.interact.pick(origin, _f, maxD, (it) => it.enabled !== false && (!it.only || it.only(this)));
  }

  /** Sit / lie on a seat spot. */
  sitOn(spot, pose = 'sit') {
    this.seat = { at: spot.at.clone().setY(spot.at.y - (pose === 'sit' ? 0.47 * (this.height / 1.75) : 0)), faceYaw: spot.faceYaw ?? 0, pose, spot };
    if (pose === 'lie') this.seat.at.y = spot.at.y;
    this.yaw = (spot.faceYaw ?? 0) + Math.PI;
    this.pitch = pose === 'lie' ? 0.75 : 0; // lying on your back: looking up past your feet
    this.controller.enabled = false;
  }

  stand() {
    if (!this.seat) return;
    const s = this.seat;
    this.seat = null;
    this.controller.enabled = true;
    // Step out in front of the seat.
    const fy = s.faceYaw;
    const out = s.at.clone().add(new THREE.Vector3(Math.sin(fy) * 0.55, 0, Math.cos(fy) * 0.55));
    out.y = Math.max(s.at.y, (s.spot?.floorY ?? s.at.y));
    const floor = this.physics.raycast({ x: out.x, y: out.y + 1.2, z: out.z }, { x: 0, y: -1, z: 0 }, 3, { exclude: this.controller.collider });
    if (floor) out.y = floor.point.y;
    this.controller.place(out, this.yaw + Math.PI);
    this.position.copy(this.controller.curr);
    this.body.pose = 'stand';
  }

  canUnlock(door) {
    // You can unlock doors from inside your own house (thumb-turn locks) and your bedroom door.
    if (!door) return false;
    const inside = this.world.roomAt(this.position);
    return !!inside || !!this.hasKey;
  }

  dispose() {
    this.controller.dispose();
    this.body.dispose();
  }
}
