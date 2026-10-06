// Character dev page (work in progress).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { createHuman, randomHumanParams } from '../src/character/index.js';

class CharacterDev {
  constructor(e) { this.engine = e; }
  async enter(q) {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x30343a);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
    sun.position.set(3, 5, 6);
    sun.castShadow = e.tier.shadows;
    sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
    sun.shadow.bias = -0.0004;
    scene.add(sun, new THREE.HemisphereLight(0xcfe0ff, 0x6b5a48, 0.5));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const n = +(q.n || 4);
    this.humans = [];
    const info = [];
    for (let i = 0; i < n; i++) {
      const p = randomHumanParams(+(q.seed || 3000) + i * 17);
      const t0 = performance.now();
      const h = createHuman(p, { tier: e.tier, hero: !!q.hero });
      info.push({ ms: +(performance.now() - t0).toFixed(1), t: Object.fromEntries(Object.entries(h.timing).map(([k, v]) => [k, +v.toFixed(1)])), age: p.age, fat: +p.fat.toFixed(2) });
      h.root.position.x = (i - (n - 1) / 2) * 0.9;
      scene.add(h.root);
      this.humans.push(h);
    }
    window.__info = info;
    window.__humans = this.humans;
    const cam = new THREE.PerspectiveCamera(q.fov ? +q.fov : 30, 1, 0.01, 100);
    const ty = q.ty ? +q.ty : 0.95;
    const tx = q.tx ? +q.tx : 0;
    cam.position.set(tx + (q.cx ? +q.cx : 0), ty + (q.cy ? +q.cy : 0.15), q.dist ? +q.dist : 6);
    cam.lookAt(tx, ty, 0);
    e.setView(scene, cam);
    this.walk = !!q.walk;
  }
  update(dt) {
    for (const [i, h] of this.humans.entries()) {
      if (this.walk && i % 2 === 0) {
        h.root.position.z += dt * 1.3;
        if (h.root.position.z > 3) h.root.position.z = -3;
      }
      h.update(dt);
    }
  }
  exit() {}
}
runState(CharacterDev);
