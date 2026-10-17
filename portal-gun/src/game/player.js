import * as THREE from '../three.js';
import { makeBody, GRAVITY } from '../core/physics.js';
import { audio } from '../core/audio.js';
import { clamp, damp } from '../util.js';

const WALK = 4.3;
const SPRINT = 7.0;
const JUMP = 5.6;

export class Player {
  constructor(game) {
    this.game = game;
    this.body = makeBody(0.3, 1.82);
    this.yaw = 0;
    this.pitch = 0;
    this.eye = 1.72;
    this.mode = 'walk'; // walk | frozen | ship | sit
    this.camera = game.camera;
    this.bob = 0;
    this.bobAmt = 0;
    this.stepDist = 0;
    this.landDip = 0;
    this.prevGrounded = true;
    this.fallSpeed = 0;
    this.sens = 1;
    this.invertY = false;
    this.lookTarget = null; // scripted camera look-at while frozen
    this.portalCooldown = 0;
    this.lastExit = null;
    this.speed = 0;
    this.lookDX = 0;
    this.lookDY = 0;
  }

  teleport(pos, yaw = null) {
    this.body.pos.copy(pos);
    this.body.vel.set(0, 0, 0);
    if (yaw !== null) this.yaw = yaw;
    this.body.grounded = false;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt, input) {
    const b = this.body;
    this.lookDX = 0;
    this.lookDY = 0;
    if (this.mode === 'walk' || this.mode === 'sit') {
      const s = 0.0022 * this.sens;
      this.lookDX = input.mouseDX * s;
      this.lookDY = input.mouseDY * s * (this.invertY ? -1 : 1);
      this.yaw -= this.lookDX;
      this.pitch = clamp(this.pitch - this.lookDY, -1.5, 1.5);
    }
    if (this.mode === 'walk') {
      const fwd = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
      const side = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
      const sprint = input.key('ShiftLeft') || input.key('ShiftRight');
      const max = sprint ? SPRINT : WALK;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      let wx = -sy * fwd + cy * side;
      let wz = -cy * fwd - sy * side;
      const len = Math.hypot(wx, wz);
      if (len > 1) {
        wx /= len;
        wz /= len;
      }
      const accel = b.grounded ? 42 : 10;
      const tx = wx * max, tz = wz * max;
      b.vel.x += clamp(tx - b.vel.x, -accel * dt, accel * dt);
      b.vel.z += clamp(tz - b.vel.z, -accel * dt, accel * dt);
      if (b.grounded && input.hit('Space')) {
        b.vel.y = JUMP;
        b.grounded = false;
        audio.jump();
      }
    } else if (this.mode !== 'ship') {
      b.vel.x *= Math.max(0, 1 - dt * 12);
      b.vel.z *= Math.max(0, 1 - dt * 12);
    }

    if (this.mode !== 'ship' && this.mode !== 'sit') {
      b.vel.y += GRAVITY * dt;
      const vyBefore = b.vel.y;
      this.game.physics.move(b, dt);
      if (b.grounded && !this.prevGrounded && vyBefore < -5) {
        audio.land(b.surface);
        this.landDip = Math.min(0.18, -vyBefore * 0.015);
      }
      this.prevGrounded = b.grounded;
      // footsteps
      const hs = Math.hypot(b.vel.x, b.vel.z);
      this.speed = hs;
      if (b.grounded && hs > 0.5) {
        this.stepDist += hs * dt;
        const stride = hs > 5.5 ? 2.1 : 1.6;
        if (this.stepDist > stride) {
          this.stepDist = 0;
          audio.step(b.surface, hs > 5.5 ? 1.2 : 0.9);
        }
        this.bob += dt * hs * 1.9;
      }
      this.bobAmt += ((b.grounded && hs > 0.5 ? Math.min(1, hs / WALK) : 0) - this.bobAmt) * damp(8, dt);
    }
    this.landDip *= Math.max(0, 1 - dt * 8);
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
  }

  /** places the camera at the player's eyes */
  applyCamera(fovKick = 0) {
    const cam = this.camera;
    if (this.mode === 'ship') return;
    const b = this.body;
    const bobY = Math.sin(this.bob * 2) * 0.035 * this.bobAmt;
    const bobX = Math.cos(this.bob) * 0.025 * this.bobAmt;
    cam.position.set(b.pos.x, b.pos.y + this.eye + bobY - this.landDip, b.pos.z);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    cam.position.x += cy * bobX;
    cam.position.z -= sy * bobX;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.006 * this.bobAmt);
    void fovKick;
  }

  /** smoothly turn the view toward a point (used in cutscenes) */
  lookAtSmooth(p, dt, rate = 4) {
    const e = this.camera.position;
    const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    let d = yaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const k = damp(rate, dt);
    this.yaw += d * k;
    this.pitch += (pitch - this.pitch) * k;
  }
}
