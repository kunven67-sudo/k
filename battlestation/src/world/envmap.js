import * as THREE from 'three';
import { ROOMS } from './layout.js';

// Fake bounce light: snapshot each room from its middle into a cube map and use that as the
// room's environment. Light from the window then bounces off walls/floor like in real life.
export class RoomEnv {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    this.cam = new THREE.CubeCamera(0.05, 40, this.rt);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envs = {};
    this.queue = [];
    this.age = {};
  }

  capture(room, bounces = 2) {
    const r = ROOMS[room];
    this.cam.position.set((r.x0 + r.x1) / 2, 1.35, (r.z0 + r.z1) / 2);
    const prevEnv = this.scene.environment;
    for (let b = 0; b < bounces; b++) {
      this.scene.environment = this.envs[room] || null;
      this.cam.update(this.renderer, this.scene);
      const old = this.envs[room];
      this.envs[room] = this.pmrem.fromCubemap(this.rt.texture).texture;
      old?.dispose();
    }
    this.scene.environment = prevEnv;
    this.age[room] = performance.now();
  }

  all() { for (const k of Object.keys(ROOMS)) this.capture(k, 2); }

  // keep the room you're in fresh; others refresh lazily
  update(room, dirty) {
    if (dirty) this.queue = [room, ...Object.keys(ROOMS).filter(k => k !== room)];
    if (this.queue.length) this.capture(this.queue.shift(), 1);
    else if (room && performance.now() - (this.age[room] || 0) > 20000) this.capture(room, 1);
    return this.envs[room] || this.envs.bedroom;
  }
}
