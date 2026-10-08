// Over-the-shoulder camera (right shoulder by default, X swaps sides).
//
// - Orbit yaw/pitch from mouse / touch look; the pivot follows the character's upper chest with
//   critically damped smoothing so footfalls never shake the frame (no head-bob).
// - A sphere cast from the pivot to the desired position keeps the lens inside walls: in the tight
//   motel room the camera pulls in hard and quickly, then eases back out slowly once clear.
//   The shoulder offset is cast separately so the camera never pokes through a door jamb.
// - When the camera has to come very close (< 0.55 m) the body fades into a near-first-person
//   framing rather than filling the screen with a back.
// - Field of view widens a touch with sprint speed; landings and the hangover add a small roll.
import * as THREE from 'three';
import { LAYER } from '../core/physics.js';
import { clamp, damp, dampAngle, lerp } from '../core/util.js';

const CAM_GROUPS = ((0xffff & 0xffff) << 16) | (LAYER.STATIC | LAYER.CAMERA_BLOCK);
const _v = new THREE.Vector3();
const _back = new THREE.Vector3();
const _side = new THREE.Vector3();

export class ShoulderCamera {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;
    this.yaw = 0; // camera looks along (-sin yaw, -cos yaw)
    this.pitch = -0.12;
    this.side = 1; // +1 right shoulder, -1 left
    this.sideSmooth = 1;
    this.dist = 2.15; // boom length when clear
    this.curDist = 2.15;
    this.pivot = new THREE.Vector3();
    this.pivotSmooth = new THREE.Vector3();
    this.fovBase = 62;
    this.fovKick = 0;
    this.roll = 0;
    this.closeness = 0; // 0 = full third person, 1 = camera at the head
    this.exclude = null;
    this.override = null; // { position, target, weight } cinematic blend (opening, sleep)
    this.inited = false;
  }

  swapShoulder() {
    this.side = -this.side;
  }

  addLook(dx, dy) {
    this.yaw -= dx * 0.0024;
    this.pitch = clamp(this.pitch - dy * 0.0021, -1.15, 0.95);
  }

  /** Forward (XZ) of the camera, for camera-relative movement. */
  forward(out) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt, { head, speed = 0, sprint = false, landDip = 0, crouch = 0, sway = 0 }) {
    // Pivot: just above the shoulders. Vertical smoothing is slower than horizontal so stairs and
    // curbs glide instead of jolting.
    this.pivot.copy(head);
    this.pivot.y -= 0.05 + crouch * 0.05;
    if (!this.inited) {
      this.pivotSmooth.copy(this.pivot);
      this.inited = true;
    }
    this.pivotSmooth.x = damp(this.pivotSmooth.x, this.pivot.x, 0.045, dt);
    this.pivotSmooth.z = damp(this.pivotSmooth.z, this.pivot.z, 0.045, dt);
    this.pivotSmooth.y = damp(this.pivotSmooth.y, this.pivot.y - landDip * 0.08, 0.11, dt);
    this.sideSmooth = damp(this.sideSmooth, this.side, 0.12, dt);

    const pitch = this.pitch;
    _back.set(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    _side.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const p = this.pivotSmooth;
    const opts = { groups: CAM_GROUPS, exclude: this.exclude };

    // 1. shoulder offset (cast sideways so it never goes through a jamb).
    const shoulder = 0.42 * this.sideSmooth;
    const dirS = _v.copy(_side).multiplyScalar(Math.sign(shoulder) || 1);
    const tS = this.physics.sphereCast(p, dirS, 0.14, Math.abs(shoulder), opts);
    const sOff = tS != null ? Math.max(0, tS - 0.04) * Math.sign(shoulder) : shoulder;
    const base = new THREE.Vector3().copy(p).addScaledVector(_side, sOff);
    // 2. boom (cast backwards from the shoulder point). Looking down pulls the boom in slightly.
    const want = this.dist * (sprint ? 1.12 : 1) * lerp(1, 0.82, clamp(-pitch, 0, 1)) + (pitch > 0.3 ? -0.4 * (pitch - 0.3) : 0);
    const toi = this.physics.sphereCast(base, _back, 0.17, want, opts);
    const allowed = toi != null ? Math.max(0.05, toi - 0.06) : want;
    // Pull in fast (never clip), ease out slowly.
    this.curDist = allowed < this.curDist ? damp(this.curDist, allowed, 0.02, dt) : damp(this.curDist, allowed, 0.35, dt);
    if (this.curDist > allowed) this.curDist = allowed;
    const cam = this.camera;
    cam.position.copy(base).addScaledVector(_back, this.curDist);
    this.closeness = clamp(1 - (this.curDist - 0.25) / 0.5, 0, 1);

    // FOV kick + roll.
    this.fovKick = damp(this.fovKick, clamp((speed - 2.5) / 3, 0, 1) * 7, 0.4, dt);
    const fov = this.fovBase + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.roll = damp(this.roll, sway, 0.3, dt);
    cam.rotation.set(pitch, this.yaw, this.roll, 'YXZ');

    // Cinematic override (opening / sleep) blends position + look target.
    const o = this.override;
    if (o && o.weight > 0.001) {
      const w = clamp(o.weight, 0, 1);
      const q0 = cam.quaternion.clone();
      cam.position.lerp(o.position, w);
      const m = new THREE.Matrix4().lookAt(cam.position, o.target, new THREE.Vector3(0, 1, 0));
      const q1 = new THREE.Quaternion().setFromRotationMatrix(m);
      if (o.roll) q1.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), o.roll));
      cam.quaternion.copy(q0.slerp(q1, w));
    }
  }

  /** Make the orbit look the same way the camera currently does (after an override ends). */
  syncFromCamera() {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = e.y;
    this.pitch = clamp(e.x, -1.15, 0.95);
  }
}

export { dampAngle };
