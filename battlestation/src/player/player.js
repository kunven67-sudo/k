import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { Hands } from './hands.js';
import { placeRoot, sitLegs, walkLegs, spineAndHead, hangArms, lieDown } from './poses.js';
import { DESK_ROT } from '../world/desk.js';

// You. States: bed (waking up), walk, sit (at the PC), look (seated, looking around), couch.
const EYE_STAND = 1.68;
export class Player {
  constructor(game) {
    this.g = game;
    this.state = 'walk';
    this.pos = new THREE.Vector3(3, 0, 3);      // feet
    this.yaw = Math.PI;                           // camera yaw (0 = looking +z... we use -z forward)
    this.pitch = 0;
    this.bodyYaw = this.yaw;
    this.vel = new THREE.Vector3();
    this.phase = 0;
    this.stride = 0;
    this.crouch = 0;
    this.stepDist = 0;
    this.fovBase = 72;
    this.trans = null;
    this.seatLook = { yaw: 0, pitch: 0 };
  }

  async init() {
    this.avatar = await Avatar.load(this.g);
    this.hands = new Hands(this.avatar, this.g.desk);
    this.avatar.hideHead(true);
  }

  // forward vector for camera yaw/pitch (yaw 0 looks toward -z)
  dir(yaw = this.yaw, pitch = this.pitch, out = new THREE.Vector3()) {
    return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  // ------------------------------------------------------------------ states
  setState(s) {
    const prev = this.state;
    this.state = s;
    this.g.onPlayerState?.(s, prev);
  }

  standAt(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.yaw = yaw; this.bodyYaw = yaw; this.pitch = 0;
    this.setState('walk');
  }

  sitDown() {
    const chair = this.g.desk.chair;
    this.trans = { t: 0, dur: 0.9, from: this.camPose(), to: 'sit' };
    this.setState('sit');
    this.g.audio.play('chair.ogg', { pos: chair.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), vol: 0.5 });
  }

  standUp() {
    const chair = this.g.desk.chair;
    // step out to the side of the chair, toward the room
    const p = chair.basePos.clone().add(new THREE.Vector3(0.55, 0, 0.05));
    this.trans = { t: 0, dur: 0.8, from: this.camPose(), to: 'walk' };
    this.pos.copy(p);
    this.yaw = Math.PI / 2 + 0.3; this.pitch = -0.15; this.bodyYaw = this.yaw;
    this.setState('walk');
    this.g.audio.play('chair.ogg', { pos: chair.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), vol: 0.45, rate: 1.1 });
  }

  camPose() { const c = this.g.camera; return { p: c.position.clone(), q: c.quaternion.clone(), fov: c.fov }; }

  // ------------------------------------------------------------------ per frame
  update(dt, input) {
    const g = this.g;
    const d = input.take();
    if (this.state === 'walk') this.updateWalk(dt, d, input);
    else if (this.state === 'look') this.updateLook(dt, d);
    else if (this.state === 'sit') this.updateSit(dt, d);
    else if (this.state === 'bed') this.updateBed(dt, d);
    this.pose(dt);
    this.camera(dt);
    void g;
  }

  updateWalk(dt, d, input) {
    const sens = (this.g.settings?.sens ?? 1) * 0.0022;
    this.yaw -= d.dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - d.dy * sens, -1.45, 1.4);
    let mx = 0, mz = 0;
    if (input.down('KeyW')) mz -= 1;
    if (input.down('KeyS')) mz += 1;
    if (input.down('KeyA')) mx -= 1;
    if (input.down('KeyD')) mx += 1;
    const fast = input.down('ShiftLeft') || input.down('ShiftRight');
    const crouching = input.down('ControlLeft') || input.down('KeyC');
    this.crouch += ((crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);
    const speed = (fast ? 2.2 : 1.35) * (1 - this.crouch * 0.55);
    const len = Math.hypot(mx, mz);
    const want = new THREE.Vector3();
    if (len > 0) {
      mx /= len; mz /= len;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      want.set(mx * c + mz * s, 0, -mx * s + mz * c).multiplyScalar(speed);
    }
    // a little acceleration so walking has weight
    this.vel.lerp(want, Math.min(1, dt * (len > 0 ? 9 : 12)));
    const before = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);
    this.g.physics.resolve(this.pos, 0.22, 0.12, 1.75 - this.crouch * 0.6);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.stride += ((moved / Math.max(dt, 1e-4) > 0.2 ? 1 : 0) - this.stride) * Math.min(1, dt * 8);
    this.phase += moved / 0.62 * Math.PI;
    this.stepDist += moved;
    if (this.stepDist > (fast ? 0.78 : 0.68)) { this.stepDist = 0; this.g.footstep(this.pos, fast); }
    // body follows the camera, with a little lag (shoulders turn after the head)
    let dy = this.yaw - this.bodyYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (this.stride > 0.3 || Math.abs(dy) > 0.9) this.bodyYaw += dy * Math.min(1, dt * 7);
  }

  updateSit(dt, d) {
    // seated: the real mouse moves the in-game cursor (handled by the PC), not your head
    this.g.pcMouse?.(d.dx, d.dy, d.wheel);
  }

  updateLook(dt, d) {
    const sens = 0.0022;
    this.seatLook.yaw = THREE.MathUtils.clamp(this.seatLook.yaw - d.dx * sens, -2.2, 2.2);
    this.seatLook.pitch = THREE.MathUtils.clamp(this.seatLook.pitch - d.dy * sens, -1.3, 1.1);
  }

  updateBed(dt, d) {
    const sens = 0.0016;
    this.seatLook.yaw = THREE.MathUtils.clamp(this.seatLook.yaw - d.dx * sens, -1.1, 1.1);
    this.seatLook.pitch = THREE.MathUtils.clamp(this.seatLook.pitch - d.dy * sens, -0.6, 0.9);
  }

  // ------------------------------------------------------------------ body
  pose(dt) {
    const av = this.avatar;
    av.reset();
    if (this.state === 'walk') {
      const bodyY = this.bodyYaw + Math.PI; // avatar faces +z at 0, our yaw 0 looks -z
      const bob = Math.abs(Math.sin(this.phase)) * 0.018 * this.stride;
      const pelvis = new THREE.Vector3(this.pos.x, av.restPelvis.y - 0.015 - this.crouch * 0.42 + bob, this.pos.z);
      // pelvis slightly behind the eyes so you see your feet when you look down
      pelvis.addScaledVector(new THREE.Vector3(Math.sin(bodyY), 0, Math.cos(bodyY)), -0.04);
      placeRoot(av, pelvis, bodyY);
      walkLegs(av, bodyY, this.phase, this.stride);
      if (this.crouch > 0.05) this.crouchLegs(bodyY);
      spineAndHead(av, bodyY, 0.04 + this.crouch * 0.3, this.dir(), 1);
      hangArms(av, bodyY, this.phase, this.stride);
    } else if (this.state === 'sit' || this.state === 'look') {
      const chair = this.g.desk.chair;
      const bodyY = DESK_ROT + Math.PI + Math.PI / 2 * 0; // face the desk (world -x)
      const yaw = -Math.PI / 2;
      const seat = chair.group.position.clone().add(new THREE.Vector3(0, chair.seatY + 0.075, 0)).add(new THREE.Vector3(0.06, 0, 0));
      placeRoot(av, seat, yaw);
      sitLegs(av, yaw, 0);
      const look = this.state === 'look' ? this.lookDir() : this.screenLook();
      spineAndHead(av, yaw, 0.16, look, 0.85);
      // clavicles forward a touch (reaching for keyboard/mouse)
      this.hands.update(dt, yaw);
      void bodyY;
    } else if (this.state === 'bed') {
      const b = this.g.bed;
      lieDown(av, b.pelvis, b.headDir);
      for (const s of ['l', 'r']) av.relaxFingers(s, 0.5);
      spineAndHead(av, Math.atan2(b.headDir.x, b.headDir.z) + Math.PI, 0, this.lookDir(), 0.6);
    }
    av.root.updateMatrixWorld(true);
  }

  crouchLegs(yaw) {
    // bend knees deeper when crouching
    const av = this.avatar;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    for (const side of ['l', 'r']) {
      const hip = av.pos('thigh_' + side);
      const knee = hip.clone().addScaledVector(fwd, 0.3 * this.crouch).add(new THREE.Vector3(0, -0.32, 0));
      av.pointBone('thigh_' + side, knee.clone().sub(hip));
      const k = av.pos('calf_' + side);
      av.pointBone('calf_' + side, new THREE.Vector3(k.x, 0.08, k.z).addScaledVector(fwd, -0.12 * this.crouch).sub(k));
    }
  }

  lookDir() {
    if (this.state === 'bed') {
      // lying on your back: start looking at the ceiling, tilt toward your feet / turn left-right
      const b = this.g.bed;
      const up = new THREE.Vector3(0, 1, 0);
      const toes = b.headDir.clone().negate();
      const axis = new THREE.Vector3().crossVectors(up, toes).normalize();
      return up.applyAxisAngle(axis, -this.seatLook.pitch + 0.15).applyAxisAngle(b.headDir, this.seatLook.yaw).normalize();
    }
    // seated: yaw around the desk direction (world -x)
    const base = -Math.PI / 2 + Math.PI; // camera yaw that looks at -x
    return this.dir(base + this.seatLook.yaw, this.seatLook.pitch - 0.1);
  }

  // where your eyes go while using the PC: the screen, drifting toward the cursor
  screenLook() {
    const pc = this.g.pc;
    const eye = this.avatar.eyeWorld(new THREE.Vector3());
    let target;
    if (pc && pc.cursorWorld) target = pc.cursorWorld(0.3);
    else target = this.g.desk.monitors[0].screen.getWorldPosition(new THREE.Vector3());
    return target.sub(eye).normalize();
  }

  // ------------------------------------------------------------------ camera
  camera(dt) {
    const cam = this.g.camera;
    const av = this.avatar;
    const eye = av.eyeWorld(new THREE.Vector3());
    let q = new THREE.Quaternion();
    let fov = this.fovBase;
    if (this.state === 'walk') {
      q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      // a hint of head bob
      eye.y += Math.sin(this.phase * 2) * 0.006 * this.stride;
    } else if (this.state === 'sit') {
      const look = this.screenLook();
      q.setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, eye.clone().add(look), new THREE.Vector3(0, 1, 0)));
      fov = this.g.settings?.seatFov ?? 52;
    } else {
      const look = this.lookDir();
      const up = this.state === 'bed' ? this.g.bed.headDir.clone() : new THREE.Vector3(0, 1, 0);
      q.setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, eye.clone().add(look), up));
    }
    // the eye moves with the head bone; push the camera a hair forward so you never see inside your face
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    eye.addScaledVector(fwd, 0.035);
    if (this.trans) {
      const t = this.trans;
      t.t += dt;
      const k = THREE.MathUtils.smootherstep(Math.min(1, t.t / t.dur), 0, 1);
      cam.position.lerpVectors(t.from.p, eye, k);
      cam.quaternion.slerpQuaternions(t.from.q, q, k);
      cam.fov = THREE.MathUtils.lerp(t.from.fov, fov, k);
      if (t.t >= t.dur) this.trans = null;
    } else {
      cam.position.copy(eye);
      cam.quaternion.copy(q);
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 6);
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }
}
void EYE_STAND;
