// Shape-iteration page for the character module: raw sculpt in clay (no materials, no rig
// animation). ?n=count ?tier=high ?wire=1 ?side=1 ?seed=base ?dist=m
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { buildRig } from '../src/character/rig.js';
import { bodyTemplate, handTemplate, shapeBody, shapeHand, TEMPLATE_PARAMS } from '../src/character/template.js';
import { randomHumanParams } from '../src/character/schema.js';
import { headTemplate, shapeHead, shapeEar, faceLayout, findEyes, lidShell, teethArch, tongueGeometry, JAW_BIND_OPEN, FACE_BONES } from '../src/character/head.js';

class ShapeDev {
  constructor(e) { this.engine = e; }
  async enter(q) {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a30);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const n = +(q.n || 6);
    const tier = q.tier || 'high';
    if (q.head) return this.heads(q, scene, n, tier);
    const t0 = performance.now();
    const bt = bodyTemplate(tier);
    const ht = handTemplate(tier);
    const tTpl = performance.now() - t0;
    const info = { tpl: tTpl, tplBody: bt.buildMs, tplHand: ht.buildMs, humans: [] };
    const mat = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.55, wireframe: !!q.wire });
    for (let i = 0; i < n; i++) {
      const p = i === 0 ? TEMPLATE_PARAMS : randomHumanParams(+(q.seed || 1000) + i * 7);
      const t1 = performance.now();
      const rig = buildRig(p);
      const sb = shapeBody(bt, p, rig);
      const grp = new THREE.Group();
      const add = (pos, nrm, idx) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        grp.add(new THREE.Mesh(g, mat));
        return idx.length / 3;
      };
      let tris = add(sb.positions, sb.normals, bt.index);
      for (const side of ['L', 'R']) {
        const h = shapeHand(ht, p, rig, side, sb.prims.find((x) => x.forearm === side));
        tris += add(h.positions, h.normals, h.index);
      }
      info.humans.push({ ms: +(performance.now() - t1).toFixed(1), tris, fat: +p.fat.toFixed(2), h: +p.height.toFixed(2) });
      grp.position.x = (i - (n - 1) / 2) * 0.85;
      if (q.side) grp.rotation.y = (Math.PI / 2) * +q.side;
      scene.add(grp);
    }
    window.__info = info;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const ty = q.ty ? +q.ty : 0.9;
    const tx = q.tx ? +q.tx : 0;
    cam.position.set(tx, ty + 0.1, q.dist ? +q.dist : 7.5);
    cam.lookAt(tx, ty, 0);
    e.setView(scene, cam);
  }
  heads(q, scene, n, tier) {
    const e = this.engine;
    const t0 = performance.now();
    const ht = headTemplate(tier);
    const info = { tpl: performance.now() - t0, heads: [] };
    const skin = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.55, wireframe: !!q.wire });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.15 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.2 });
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
    const jawI = FACE_BONES.indexOf('jaw');
    const lipDI = FACE_BONES.indexOf('lip.D');
    const pivot = new THREE.Vector3(0, -0.032, -0.03);
    const close = (pos, wfn) => {
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.length / 3; i++) {
        const w = wfn(i);
        if (!w) continue;
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(pivot).applyAxisAngle(new THREE.Vector3(1, 0, 0), -JAW_BIND_OPEN * w * (q.open ? -4 : 1)).add(pivot);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      }
    };
    for (let i = 0; i < n; i++) {
      const p = i === 0 ? TEMPLATE_PARAMS : randomHumanParams(+(q.seed || 2000) + i * 13);
      const t1 = performance.now();
      const L = faceLayout(p);
      findEyes(p, L);
      const sh = shapeHead(ht, p, L, { neckR: 0.06 });
      close(sh.positions, (v) => {
        let w = 0;
        for (let k = 0; k < 4; k++) { const b = ht.skinIndex[v * 4 + k]; if (b === jawI || b === lipDI) w += ht.skinWeight[v * 4 + k]; }
        return w;
      });
      const grp = new THREE.Group();
      const add = (pos, nrm, idx, m) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        if (nrm) g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        if (!nrm) g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, m);
        grp.add(mesh);
        return mesh;
      };
      add(sh.positions, sh.normals, ht.index, skin);
      for (const side of [1, -1]) {
        const ear = shapeEar(ht.ear, L, side);
        add(ear.positions, ear.normals, ear.index, skin);
      }
      for (const ey of L.eyes) {
        const em = new THREE.Mesh(new THREE.SphereGeometry(ey.R, 32, 20), white);
        em.position.copy(ey.c);
        grp.add(em);
        const ir = new THREE.Mesh(new THREE.CircleGeometry(ey.R * 0.48, 24), iris);
        ir.position.copy(ey.c).add(new THREE.Vector3(0, 0, ey.R * 1.002));
        grp.add(ir);
        for (const which of ['upper', 'lower']) {
          const lid = lidShell(L, ey, which, tier);
          add(lid.positions, lid.normals, lid.index, skin);
        }
      }
      const up = teethArch(L, 'upper', { age: p.age, tierName: tier });
      const lo = teethArch(L, 'lower', { age: p.age, tierName: tier });
      const tg = tongueGeometry(L, tier);
      for (const t of [up, lo, tg]) {
        const m = add(t.positions, t.normals, t.index, vc);
        m.geometry.setAttribute('color', new THREE.BufferAttribute(t.colors, 3));
      }
      info.heads.push(+(performance.now() - t1).toFixed(1));
      grp.position.x = (i - (n - 1) / 2) * 0.3;
      if (q.side) grp.rotation.y = (Math.PI / 2) * +q.side;
      if (q.ry) grp.rotation.y = +q.ry;
      scene.add(grp);
    }
    window.__info = info;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const tx = q.tx ? +q.tx : 0;
    const ty = q.ty ? +q.ty : 0;
    cam.position.set(tx, ty, q.dist ? +q.dist : 1.6);
    cam.lookAt(tx, ty, 0);
    e.setView(scene, cam);
  }
  update() {}
  exit() {}
}
runState(ShapeDev);
