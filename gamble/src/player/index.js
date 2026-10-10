// The player: one Human driven by a weighty KCC controller, an over-the-shoulder camera, footsteps
// and prompt-less physical interaction (ARCHITECTURE §6 "player", DESIGN §3, §38, §39).
//
//   const player = new Player(engine, world, { human, spawn, camera });
//   scene.add(player.root);
//   state.fixedUpdate(step) → player.fixedUpdate(step)
//   state.update(dt)        → player.update(dt)
//
// player.locked = true freezes control (cutscenes, sleeping); player.cinematic drives the camera
// override. player.position is the feet position (interpolated).
import * as THREE from 'three';
import { input } from '../core/input.js';
import { bus } from '../core/events.js';
import { clamp, damp, lerp } from '../core/util.js';
import { Controller } from './controller.js';
import { ShoulderCamera } from './camera.js';
import { Interactor } from './interact.js';
import { surfaceAt } from './surface.js';
import { loadSound, step } from './sound.js';

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

loadSound();

export class Player {
  constructor(engine, world, { human, spawn, camera }) {
    this.engine = engine;
    this.world = world;
    this.physics = engine.physics;
    this.human = human;
    this.root = new THREE.Group();
    this.root.name = 'player';
    this.root.add(human.root);
    this.camera = camera;
    // Capsule sized from the body (bind pose bounds).
    const box = new THREE.Box3().setFromObject(human.root);
    this.height = clamp(box.max.y - box.min.y || 1.75, 1.45, 2.1);
    this.controller = new Controller(this.physics, { position: { ...spawn, yaw: (spawn.yaw ?? 0) + Math.PI }, height: this.height * 0.97, radius: 0.28, owner: { kind: null, player: this } });
    this.cam = new ShoulderCamera(camera, this.physics);
    this.cam.exclude = this.controller.collider;
    this.cam.yaw = spawn.yaw ?? 0; // spawn yaw = view direction (-sin, -cos), like the dev cameras
    this.interact = new Interactor(this);
    this.position = new THREE.Vector3().copy(this.controller.curr);
    this.locked = false;
    this.hideBody = false; // POV moments (waking up on the floor)
    this.hangover = 0; // 0..1, slows and sways
    this.sinceFixed = 0;
    this.focus = null;
    this._feetSwing = { L: false, R: false };
    this._stepClock = 0;
    this._viewport = { w: innerWidth, h: innerHeight };
    this._wantJump = false;
    this._clickCandidate = false;
    this.surface = 'carpet';

    // Feet plant on whatever is under them.
    const ex = this.controller.collider;
    human.setFootIK?.((x, y, z) => {
      const hit = this.physics.raycast({ x, y: y + 0.45, z }, { x: 0, y: -1, z: 0 }, 1.1, { exclude: ex });
      return hit ? { y: hit.point.y, normal: hit.normal } : null;
    });

    this._offs = [
      bus.on('input:pointerdown', (e) => this._pointerDown(e)),
      bus.on('input:pointerup', (e) => this._pointerUp(e)),
    ];
    this._touchTap = (e) => this._tap(e);
    window.addEventListener('pointerdown', this._touchTap, { passive: true });
    window.addEventListener('pointerup', this._touchTap, { passive: true });
    this._syncRoot(0);
  }

  // ---- geometry helpers -------------------------------------------------------------------------
  facing(out) {
    const h = this.controller.heading;
    return out.set(Math.sin(h), 0, Math.cos(h));
  }
  right(out) {
    const h = this.controller.heading;
    return out.set(-Math.cos(h), 0, Math.sin(h));
  }
  chest(out) {
    return out.copy(this.position).setY(this.position.y + this.height * 0.72);
  }
  head(out) {
    return out.copy(this.position).setY(this.position.y + this.height * 0.93);
  }

  /** Teleport. `yaw` uses the view convention of spawns (looking along (-sin, -cos)). */
  place(p, yaw) {
    this.controller.place(p, yaw != null ? yaw + Math.PI : null);
    this.position.copy(this.controller.curr);
    if (yaw != null) this.cam.yaw = yaw;
    this.cam.inited = false;
    this._syncRoot(0);
  }

  // ---- input ------------------------------------------------------------------------------------
  _canAct() {
    return !this.locked && (input.pointerLocked || input.touch);
  }

  _pointerDown(e) {
    if (e.button !== 0 || !this._canAct() || input.touch) return;
    if (this.interact.carry) {
      this.interact.throw(this.cam.forward(_v).setY(Math.sin(this.cam.pitch)).normalize());
      return;
    }
    if (this.focus && this.interact.beginDrag(this.focus)) return;
    this._clickCandidate = !!this.focus;
  }

  _pointerUp(e) {
    if (e.button !== 0) return;
    if (this.interact.drag) this.interact.endDrag();
    else if (this._clickCandidate && this.focus && this.focus.it.kind !== 'prop') this.interact.activate(this.focus);
    this._clickCandidate = false;
  }

  // Touch: a short tap without travel interacts with what is under the finger.
  _tap(e) {
    if (e.pointerType !== 'touch' || this.locked) return;
    if (e.type === 'pointerdown') {
      this._tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      return;
    }
    const s = this._tapStart;
    this._tapStart = null;
    if (!s || performance.now() - s.t > 280 || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const f = this.interact.pick(ray.ray.origin, ray.ray.direction, this.chest(_v));
    if (this.interact.carry) this.interact.throw(ray.ray.direction.clone());
    else if (f) this.interact.activate(f);
  }

  // ---- simulation -------------------------------------------------------------------------------
  fixedUpdate(step) {
    this.sinceFixed = 0;
    const c = this.controller;
    const fwd = this.cam.forward(_f);
    const rgt = _r.set(-fwd.z, 0, fwd.x);
    const mx = input.move.x;
    const my = input.move.y;
    const wx = fwd.x * my + rgt.x * mx;
    const wz = fwd.z * my + rgt.z * mx;
    c.speedCap = lerp(99, 1.15, this.hangover) * (this.interact.carry ? 0.85 : 1);
    c.fixedUpdate(step, {
      wishX: wx,
      wishZ: wz,
      wishMag: Math.hypot(mx, my),
      sprint: input.down('sprint'),
      crouch: input.down('crouch'),
      jump: this._wantJump,
      locked: this.locked || this.interact.drag != null,
    });
    this._wantJump = false;
  }

  update(dt) {
    const c = this.controller;
    this.sinceFixed += dt;
    if (!this.locked && input.pressed('jump')) this._wantJump = true;
    if (!this.locked && input.pressed('camera')) this.cam.swapShoulder();
    this._viewport.w = innerWidth;
    this._viewport.h = innerHeight;

    // Look, or drag a door with the same motion.
    if (this.interact.drag) {
      this.interact.dragMove(input.pointer.dx || input.look.x, input.pointer.dy || input.look.y, this.camera, this._viewport);
      if (!input.pointer.dragging && !input.touch) this.interact.endDrag();
    } else if (!this.locked || this.lookWhileLocked) this.cam.addLook(input.look.x, input.look.y);

    this.position.copy(c.renderFeet(this.sinceFixed * 60, _v));
    this._syncRoot(dt);

    // Camera.
    const sway = this.hangover * 0.035 * Math.sin(performance.now() * 0.0007) + (c.landDip > 0 ? c.landDip * 0.01 : 0);
    this.cam.update(dt, { head: this.head(_v), speed: c.speed, sprint: c.sprinting, landDip: c.landDip, crouch: c.crouch ? 1 : 0, sway });
    // Too close (tight corners): fade the body out instead of filling the frame with a shirt.
    const show = !this.hideBody && (this.cam.closeness < 0.85 || this.cam.override?.weight > 0.5);
    if (this.human.root.visible !== show) this.human.root.visible = show;

    // Focus + interaction.
    if (!this.locked) {
      const cam = this.camera;
      cam.getWorldDirection(_f);
      this.focus = this.interact.drag ? this.focus : this.interact.pick(cam.position, _f, this.chest(_r));
      if (input.pressed('interact')) this.interact.activate(this.focus);
      // The head turns toward what you're about to touch (that's the only "prompt").
      if (this.focus && !this.interact.carry) this.human.lookAt?.(this.focus.point);
      else this.human.lookAt?.(this._lookAhead());
    } else this.focus = null;
    this.interact.update(dt);
    this.human.update(dt);
    this._footsteps(dt);
  }

  // Far point along the view so the head follows the camera a little.
  _lookAhead() {
    const cam = this.camera;
    cam.getWorldDirection(_f);
    if (_f.dot(this.facing(_r)) < 0.1) return null;
    return _v.copy(cam.position).addScaledVector(_f, 12);
  }

  _syncRoot() {
    const c = this.controller;
    const root = this.human.root;
    root.position.copy(this.position);
    root.rotation.y = c.heading;
    this.human.setLocomotion?.({
      speed: c.speed,
      turnRate: c.turnRate,
      grounded: c.grounded,
      crouch: c.crouch || c.jumpTimer >= 0 || c.landDip > 0.4,
      sprint: c.sprinting,
    });
  }

  _footsteps(dt) {
    const loco = this.human.animator?.loco;
    const c = this.controller;
    const fire = (pos) => {
      const s = surfaceAt(pos.x, pos.y, pos.z);
      this.surface = s;
      const gain = clamp(0.35 + c.speed * 0.16, 0.3, 1.1) * (c.crouch ? 0.45 : 1);
      step(s, { bus: 'sfx', gain, position: { x: pos.x, y: pos.y, z: pos.z }, refDistance: 2 });
    };
    if (loco?.feet) {
      for (const k of ['L', 'R']) {
        const f = loco.feet[k];
        if (!f) continue;
        if (this._feetSwing[k] && !f.swing && c.grounded) fire(f.plant || this.position);
        this._feetSwing[k] = !!f.swing;
      }
      return;
    }
    // Fallback cadence when the gait isn't exposed.
    if (c.speed > 0.3 && c.grounded) {
      this._stepClock += dt * (0.9 + c.speed * 0.55);
      if (this._stepClock > 1) {
        this._stepClock = 0;
        fire(this.position);
      }
    }
  }

  dispose() {
    this._offs.forEach((off) => off?.());
    window.removeEventListener('pointerdown', this._touchTap);
    window.removeEventListener('pointerup', this._touchTap);
    this.interact.dispose();
    this.controller.dispose();
    this.human.dispose?.();
    this.root.removeFromParent();
  }
}

export { damp };
