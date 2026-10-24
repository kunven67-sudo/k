// Third-person camera that works from 4 mm to galaxy size.
// It orbits the spider in the spider's own "up" frame (so walking on walls/ceilings feels right), avoids walls,
// sets near/far from the size, drives depth of field (macro blur when tiny, toy-city tilt-shift when huge) and shake.
import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const Y = new THREE.Vector3(0, 1, 0);

export class CamRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0; this.pitch = 0.32;     // radians, in the up-frame
    this.zoom = 1;                       // mouse wheel multiplier
    this.frame = new THREE.Quaternion(); // smoothed "up" frame
    this.dist = 1; this.curDist = 1;
    this.target = new THREE.Vector3();
    this.shake = 0; this.shakeT = 0;
    this.fovBase = 60; this.fovKick = 0;
    this.sens = 0.0022; this.invertY = false;
    this.mode = 'orbit';                 // orbit | cinematic | inspect
    this.cine = null;
    this.uprightMode = false;            // setting: keep the horizon level on walls
  }
  look(dx, dy) {
    this.yaw -= dx * this.sens;
    this.pitch = clamp(this.pitch + (this.invertY ? -dy : dy) * this.sens, -1.15, 1.35);
  }
  // forward direction on the surface plane (where W walks)
  moveBasis(up, outF, outR) {
    // camera forward projected onto the surface
    _v.set(0, 0, -1).applyQuaternion(this.cam.quaternion);
    outF.copy(_v).addScaledVector(up, -_v.dot(up));
    if (outF.lengthSq() < 1e-6) { outF.set(0, 0, 1).applyQuaternion(this.frame).addScaledVector(up, -up.dot(_v2.set(0, 0, 1).applyQuaternion(this.frame))); }
    outF.normalize();
    outR.crossVectors(outF, up).normalize();
  }
  // up = spider's surface normal, focus = point to look at, size = spider size (zone units), dt
  update(dt, focus, up, size, collide, view = {}) {
    if (this.mode === 'cinematic' && this.cine) {
      const c = this.cine;
      this.cam.position.copy(c.pos); this.cam.up.copy(c.up || Y); this.cam.lookAt(c.look);
      this.cam.fov = c.fov || this.fovBase;
      this._clip(size, c.near, c.far, view);
      this.cam.updateProjectionMatrix();
      return;
    }
    // smooth the frame toward the spider's up (slower = less motion sickness)
    const upUse = this.uprightMode ? _v2.set(0, 1, 0) : up;
    _q.setFromUnitVectors(Y, upUse);
    // keep yaw continuity: rotate current frame's up onto the new up instead of jumping
    const curUp = _v.copy(Y).applyQuaternion(this.frame);
    const fix = new THREE.Quaternion().setFromUnitVectors(curUp, upUse);
    const want = fix.multiply(this.frame);
    this.frame.slerp(want, 1 - Math.exp(-5 * dt)).normalize();
    this.target.lerp(focus, 1 - Math.exp(-18 * dt));
    if (this.target.distanceTo(focus) > size * 30) this.target.copy(focus);
    // distance grows with size; zoom with the wheel
    this.dist = size * 5.2 * this.zoom * (view.distMul || 1);
    // spherical offset in frame space: behind (-Z) + above
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const off = _v.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(-1);
    off.y = -off.y; // positive pitch = camera above
    off.applyQuaternion(this.frame);
    // wall avoidance
    let d = this.dist;
    if (collide) {
      const hit = collide(this.target, off, this.dist + size * 0.3);
      if (hit) d = Math.max(size * 0.6, hit.distance - size * 0.25);
    }
    this.curDist = d < this.curDist ? d : damp(this.curDist, d, 4, dt);
    this.cam.position.copy(this.target).addScaledVector(off, this.curDist);
    // shake
    if (this.shake > 0.0005) {
      this.shakeT += dt * 40;
      const a = this.shake * size * 0.15;
      this.cam.position.x += Math.sin(this.shakeT * 1.3) * a; this.cam.position.y += Math.sin(this.shakeT * 1.7 + 1) * a; this.cam.position.z += Math.sin(this.shakeT * 1.1 + 2) * a;
      this.shake *= Math.exp(-dt * 5);
    }
    const camUp = _v2.copy(Y).applyQuaternion(this.frame);
    this.cam.up.copy(camUp);
    this.cam.lookAt(_v.copy(this.target).addScaledVector(camUp, size * 0.25));
    this.fovKick = damp(this.fovKick, 0, 4, dt);
    this.cam.fov = this.fovBase + this.fovKick;
    this._clip(size, null, null, view);
    this.cam.updateProjectionMatrix();
  }
  _clip(size, near, far, view) {
    const n = near || clamp(this.curDist * 0.08, size * 0.004, size * 0.35);
    this.cam.near = n;
    this.cam.far = far || Math.max(n * 2e6, view.minFar || 0);
    if (view.maxFar) this.cam.far = Math.min(this.cam.far, view.maxFar);
  }
  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }
  kick(f) { this.fovKick += f; }
}
