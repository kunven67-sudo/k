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

  // keep the room you're in fresh; others refresh lazily. One cube face per frame so it never hitches.
  update(room, dirty) {
    if (dirty) this.queue = [room, ...Object.keys(ROOMS).filter(k => k !== room)];
    if (!this.job) {
      if (this.queue.length) this.job = { room: this.queue.shift(), face: 0 };
      else if (room && performance.now() - (this.age[room] || 0) > 20000) this.job = { room, face: 0 };
    }
    if (this.job) this.step();
    return this.envs[room] || this.envs.bedroom;
  }

  step() {
    const j = this.job, r = this.renderer, cam = this.cam, R = ROOMS[j.room];
    if (j.face === 0) { cam.position.set((R.x0 + R.x1) / 2, 1.35, (R.z0 + R.z1) / 2); cam.updateMatrixWorld(true); }
    const prevRT = r.getRenderTarget(), prevEnv = this.scene.environment, au = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false; // shadows from the last real frame are fine for a bounce snapshot
    this.scene.environment = this.envs[j.room] || null;
    r.setRenderTarget(this.rt, j.face);
    r.render(this.scene, cam.children[j.face]);
    r.setRenderTarget(prevRT);
    r.shadowMap.autoUpdate = au;
    this.scene.environment = prevEnv;
    if (++j.face === 6) {
      const old = this.envs[j.room];
      this.envs[j.room] = this.pmrem.fromCubemap(this.rt.texture).texture;
      old?.dispose();
      this.age[j.room] = performance.now();
      this.job = null;
    }
  }
}
