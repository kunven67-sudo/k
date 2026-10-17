// Rick's Space Cruiser: the junky flying car in the garage. Forward is -Z.
import * as THREE from '../three.js';
import { G, mesh, LAYER_OVERLAY } from '../render/kit.js';
import { toon, glow } from '../render/materials.js';
import { audio } from '../core/audio.js';
import { clamp, damp } from '../util.js';

export class Cruiser {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.userData.dynamic = true;
    this.model = new THREE.Group();
    this.group.add(this.model);
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = 0;
    this.roll = 0;
    this.throttle = 0;
    this.radius = 1.5;
    this.engine = null;
    this.flying = false;
    this.camPitch = 0;
    this.camYaw = 0;
    this._build();
    game.scene.add(this.group);
  }

  _build() {
    const M = this.model;
    const hull = toon(0xb9c2c8);
    const hullDark = toon(0x7f8991);
    const trim = toon(0xd94b3a);
    // main body: a rounded tub
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), hull);
    body.scale.set(1.15, 0.55, 2.2);
    body.position.y = 0.75;
    M.add(body);
    // flat floor so it sits nicely
    mesh(G.box(1.9, 0.3, 3.6), hullDark, 0, 0.42, 0, M);
    // cockpit: dark tub cut into the top
    mesh(G.rbox(1.7, 0.4, 1.6, 0.15), toon(0x3b4046), 0, 1.02, 0.15, M);
    // seats
    const seat = toon(0x8f5b3a);
    for (const x of [-0.42, 0.42]) {
      mesh(G.rbox(0.62, 0.22, 0.55, 0.08), seat, x, 1.1, 0.35, M);
      mesh(G.rbox(0.62, 0.6, 0.18, 0.08), seat, x, 1.38, 0.68, M, { rx: -0.15 });
    }
    // dashboard + yoke
    mesh(G.rbox(1.5, 0.2, 0.3, 0.07), hullDark, 0, 1.2, -0.75, M, { rx: 0.45 });
    const screen = mesh(G.plane(0.3, 0.12), glow(0x56e3ff, 1.3), -0.42, 1.29, -0.83, M, { rx: -1.1 });
    screen.userData.dynamic = true;
    const screen2 = mesh(G.plane(0.26, 0.11), glow(0x9dff6a, 1.3), 0.38, 1.29, -0.83, M, { rx: -1.1 });
    screen2.userData.dynamic = true;
    mesh(G.cyl(0.02, 0.02, 0.3, 6), hullDark, -0.42, 1.2, -0.52, M, { rx: 1.0 });
    mesh(G.torus(0.13, 0.025, 6, 16), toon(0x2b2f33), -0.42, 1.3, -0.42, M, { rx: 1.0 });
    // windshield
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 24, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    glass.rotation.y = Math.PI;
    glass.position.set(0, 1.42, -0.05);
    glass.scale.set(0.95, 0.75, 0.75);
    glass.layers.set(LAYER_OVERLAY);
    M.add(glass);
    mesh(G.torus(0.9, 0.03, 6, 24, Math.PI * 0.84), hullDark, 0, 1.61, -0.08, M, { rx: Math.PI / 2, rz: Math.PI * 0.08 + Math.PI, sy: 0.75 });
    // nose + headlights
    mesh(G.sphere(0.5, 18, 12), hull, 0, 0.72, -2.0, M, { sx: 1.4, sy: 0.6 });
    for (const x of [-0.5, 0.5]) {
      mesh(G.cyl(0.14, 0.14, 0.08, 14), hullDark, x, 0.78, -2.24, M, { rx: Math.PI / 2 });
      const l = mesh(G.sphere(0.11, 12, 8), glow(0xfff2a8, 2.2), x, 0.78, -2.28, M, { sz: 0.5 });
      l.userData.dynamic = true;
    }
    // red stripe
    mesh(G.box(2.32, 0.08, 3.4), trim, 0, 0.76, 0, M);
    // engines at the back
    for (const x of [-0.55, 0.55]) {
      mesh(G.cyl(0.32, 0.38, 0.9, 16), hullDark, x, 0.8, 2.1, M, { rx: Math.PI / 2 });
      mesh(G.cyl(0.36, 0.36, 0.1, 16), hull, x, 0.8, 1.7, M, { rx: Math.PI / 2 });
      const flame = mesh(G.cone(0.26, 0.9, 14), glow(0x6ff0ff, 2.6), x, 0.8, 2.95, M, { rx: Math.PI / 2 });
      flame.userData.dynamic = true;
      (this.flames ||= []).push(flame);
    }
    // tail fins
    for (const s of [-1, 1]) {
      mesh(G.box(0.08, 0.7, 0.9), hull, s * 1.0, 1.25, 1.75, M, { rz: s * 0.4 });
    }
    // junk Rick bolted on
    mesh(G.cyl(0.06, 0.06, 2.4, 8), toon(0xa86d3d), 1.12, 0.95, 0.3, M, { rx: Math.PI / 2 });
    mesh(G.box(0.4, 0.25, 0.3), toon(0x5e7d4f), -0.95, 1.1, 1.3, M);
    // hover glow underneath
    for (const [x, z] of [[-0.6, -1.2], [0.6, -1.2], [-0.6, 1.2], [0.6, 1.2]]) {
      const pad = mesh(G.cyl(0.25, 0.25, 0.04, 14), glow(0x7cff6a, 1.6), x, 0.27, z, M);
      pad.userData.dynamic = true;
    }
    this.seatDriver = new THREE.Vector3(-0.42, 1.0, 0.35);
    this.seatPassenger = new THREE.Vector3(0.42, 1.0, 0.35);
  }

  place(pos, yaw) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.vel.set(0, 0, 0);
    this.group.rotation.set(0, yaw, 0);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  board() {
    this.flying = true;
    this.camPitch = 0;
    this.camYaw = 0;
    this.pitch = 0;
    this.engine = audio.loop('engine');
    this.engine?.gain(0.35, 0.3);
  }

  leave() {
    this.flying = false;
    this.engine?.stop();
    this.engine = null;
    this.throttle = 0;
    this.vel.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    // settle on the ground
    const g = this.game.physics.floorBelow(this.pos.x, this.pos.y + 0.5, this.pos.z, 200);
    this.pos.y = Math.max(g, 0);
    this.group.rotation.set(0, this.yaw, 0);
  }

  /** world position of a seat (for the camera / Morty) */
  seatWorld(local, out = new THREE.Vector3()) {
    return out.copy(local).applyMatrix4(this.group.matrixWorld);
  }

  altitude() {
    return this.pos.y - Math.max(0, this.game.physics.floorBelow(this.pos.x, this.pos.y + 0.2, this.pos.z, 300));
  }

  update(dt, input, sens = 1) {
    if (!this.flying) {
      for (const f of this.flames) f.scale.setScalar(0.25);
      this.group.updateMatrixWorld();
      return;
    }
    // steering with the mouse
    const s = 0.0018 * sens;
    this.yaw -= input.mouseDX * s;
    this.pitch = clamp(this.pitch - input.mouseDY * s * 0.8, -0.6, 0.6);
    const fwdIn = input.axis('KeyS', 'KeyW');
    const side = input.axis('KeyA', 'KeyD');
    const vert = (input.key('Space') ? 1 : 0) - (input.key('KeyC') || input.key('ControlLeft') ? 1 : 0);
    const boost = input.key('ShiftLeft') || input.key('ShiftRight');
    this.throttle += (fwdIn - this.throttle) * damp(3, dt);
    const maxSpeed = boost ? 48 : 26;
    const fwd = this.forward();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const accel = new THREE.Vector3().addScaledVector(fwd, this.throttle * (boost ? 34 : 20)).addScaledVector(right, side * 10).add(new THREE.Vector3(0, vert * 12, 0));
    this.vel.addScaledVector(accel, dt);
    // drag + gentle hover
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 0.9));
    const sp = this.vel.length();
    if (sp > maxSpeed) this.vel.multiplyScalar(maxSpeed / sp);
    this.pos.addScaledVector(this.vel, dt);
    this._collide();
    // limits
    this.pos.x = clamp(this.pos.x, -440, 440);
    this.pos.z = clamp(this.pos.z, -440, 440);
    if (this.pos.y > 160) {
      this.pos.y = 160;
      this.vel.y = Math.min(0, this.vel.y);
    }
    // looks: bank into turns
    const targetRoll = clamp(-input.mouseDX * 0.02 - side * 0.25, -0.6, 0.6);
    this.roll += (targetRoll - this.roll) * damp(4, dt);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.set(this.pitch * 0.6, this.yaw, this.roll);
    this.group.updateMatrixWorld();
    const t = performance.now() / 1000;
    for (const f of this.flames) f.scale.set(1, 0.6 + Math.abs(this.throttle) * 1.4 + (boost ? 0.6 : 0) + Math.sin(t * 40) * 0.08, 1);
    if (this.engine) {
      this.engine.params.throttle?.(clamp(Math.abs(this.throttle) + (boost ? 0.4 : 0), 0, 1));
      this.engine.gain(0.25 + Math.abs(this.throttle) * 0.25);
    }
  }

  _collide() {
    const p = this.pos;
    const r = this.radius;
    // ground
    const ground = this.game.physics.groundY + 0.35;
    if (p.y < ground) {
      p.y = ground;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    const cands = this.game.physics.query(p.x - r, p.z - r, p.x + r, p.z + r);
    for (const c of cands) {
      if (!c.solid || c.tag === 'walkLimit') continue;
      const cx = clamp(p.x, c.min.x, c.max.x);
      const cy = clamp(p.y + 0.6, c.min.y, c.max.y);
      const cz = clamp(p.z, c.min.z, c.max.z);
      const dx = p.x - cx, dy = p.y + 0.6 - cy, dz = p.z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      const push = r - d;
      p.x += nx * push;
      p.y += ny * push;
      p.z += nz * push;
      const vn = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
      if (vn < 0) {
        this.vel.x -= vn * nx;
        this.vel.y -= vn * ny;
        this.vel.z -= vn * nz;
        if (vn < -8) audio.thud();
      }
    }
  }

  /** camera sits in the driver's seat; look around a bit with the mouse held by the ship */
  applyCamera(camera) {
    const eye = this.seatWorld(new THREE.Vector3(-0.42, 1.95, 0.42));
    camera.position.copy(eye);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(this.pitch * 0.6 - 0.06, this.yaw, this.roll);
  }
}
