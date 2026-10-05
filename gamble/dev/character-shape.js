// Temporary shape-iteration page for the character module (raw sculpt, no materials).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { buildRig } from '../src/character/rig.js';
import { buildBody, bodyGeometry } from '../src/character/body.js';
import { buildHead, buildEar } from '../src/character/head.js';
import { randomHumanParams, defaultParams } from '../src/character/schema.js';

class ShapeDev {
  constructor(e) { this.engine = e; }
  async enter(q) {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a30);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.5);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const n = +(q.n || 5);
    const t0 = performance.now();
    const info = [];
    for (let i = 0; i < n; i++) {
      const p = i === 0 ? defaultParams() : randomHumanParams(1000 + i * 7);
      const mat = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.6, wireframe: !!q.wire, side: q.ds ? THREE.DoubleSide : THREE.FrontSide });
      const grp = new THREE.Group();
      if (q.head) {
        const h = buildHead(p, { tier: q.tier || 'high' });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(h.skin.positions, 3));
        g.setIndex(h.skin.index);
        g.computeVertexNormals();
        grp.add(new THREE.Mesh(g, mat));
        for (const side of [1, -1]) {
          const ear = buildEar(p, h.L, side, 'high');
          const eg = new THREE.BufferGeometry();
          eg.setAttribute('position', new THREE.BufferAttribute(ear.positions, 3));
          eg.setAttribute('normal', new THREE.BufferAttribute(ear.normals, 3));
          eg.setIndex(new THREE.BufferAttribute(ear.indices, 1));
          grp.add(new THREE.Mesh(eg, mat));
        }
        for (const ey of h.eyes) {
          const em = new THREE.Mesh(new THREE.SphereGeometry(ey.R, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
          em.position.copy(ey.c);
          grp.add(em);
        }
        info.push(h.skin.index.length / 3);
        grp.scale.setScalar(1);
        grp.position.set((i - (n - 1) / 2) * 0.3, 0, 0);
      } else {
        const rig = buildRig(p);
        const raw = buildBody(p, rig, { tier: { name: q.tier || 'high' } });
        const g = bodyGeometry(raw);
        info.push(g.index.count / 3);
        grp.add(new THREE.Mesh(g, mat));
        grp.position.x = (i - (n - 1) / 2) * 0.9;
      }
      if (q.side) grp.rotation.y = Math.PI / 2 * (+q.side);
      scene.add(grp);
    }
    window.__info = { ms: performance.now() - t0, tris: info };
    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    if (q.head) { const tx = q.tx ? +q.tx : 0, ty = q.ty ? +q.ty : 0; cam.position.set(tx, ty, q.dist ? +q.dist : 1.6); cam.lookAt(tx, ty, 0); }
    else { cam.position.set(0, 1.0, q.dist ? +q.dist : 6.5); cam.lookAt(0, 0.9, 0); }
    e.setView(scene, cam);
  }
  update() {}
  exit() {}
}
runState(ShapeDev);
