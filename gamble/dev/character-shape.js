// Character shape lab: clay renders of the raw body cage / subdivided body (no materials, no
// animation) for judging proportions. ?n=6&seed=..&level=1&cage=1&ty=..&dist=..&rot=deg
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { randomHumanParams, normalizeParams } from '../src/character/schema.js';
import { computeJoints } from '../src/character/rig.js';
import { buildBodyCage } from '../src/character/bodycage.js';
import { refine } from '../src/character/bodymesh.js';
import { triangulate, topology } from '../src/character/subdiv.js';

class ShapeLab {
  constructor(e) { this.engine = e; }
  async enter(q) {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2d33);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.4);
    sun.position.set(2, 4, 5);
    scene.add(sun, new THREE.HemisphereLight(0xcfe0ff, 0x6b5a48, 0.6));
    const n = +(q.n || 6);
    const level = q.level != null ? +q.level : 1;
    const clay = new THREE.MeshStandardMaterial({ color: 0xc9a58c, roughness: 0.55 });
    const wire = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, wireframe: true, transparent: true, opacity: 0.35 });
    const info = [];
    const presets = [
      { sex: 'm', fat: 0.15, muscle: 0.5 }, { sex: 'f', fat: 0.3 }, { sex: 'm', fat: 0.85, belly: 0.9 },
      { sex: 'f', fat: 0.75, chest: 0.85 }, { sex: 'm', age: 82, fat: 0.35 }, { sex: 'f', age: 24, fat: 0.1 },
      { sex: 'x', fat: 0.5 }, { sex: 'm', muscle: 0.95, fat: 0.2, shoulders: 0.9 },
    ];
    for (let i = 0; i < n; i++) {
      const pr = presets[i % presets.length];
      const p = normalizeParams({ ...randomHumanParams(+(q.seed || 11) + i * 7, { sex: pr.sex }), ...pr });
      const t0 = performance.now();
      const dims = computeJoints(p);
      const { cage } = buildBodyCage(p, dims);
      const t1 = performance.now();
      const c = refine(cage, level);
      const t2 = performance.now();
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(c.nv * 3);
      for (let v = 0; v < c.nv; v++) pos.set(c.data.subarray(v * c.D, v * c.D + 3), v * 3);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(triangulate(c));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, clay);
      const x = (i - (n - 1) / 2) * 0.75;
      mesh.position.x = x;
      mesh.rotation.y = THREE.MathUtils.degToRad(+(q.rot || 0));
      scene.add(mesh);
      if (q.cage) {
        const cg = new THREE.BufferGeometry();
        const cp = new Float32Array(cage.nv * 3);
        for (let v = 0; v < cage.nv; v++) cp.set(cage.data.subarray(v * cage.D, v * cage.D + 3), v * 3);
        cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
        cg.setIndex(triangulate(cage));
        const cm = new THREE.Mesh(cg, wire);
        cm.position.x = x;
        cm.rotation.y = mesh.rotation.y;
        scene.add(cm);
      }
      const T = topology(cage);
      let bnd = 0;
      const bverts = [];
      for (let e = 0; e < T.ne; e++) if (T.ef[e * 2 + 1] < 0) { bnd++; bverts.push(T.ev[e * 2]); }
      const cnt = new Map();
      for (let q4 = 0; q4 < cage.quads.length; q4 += 4) for (let k = 0; k < 4; k++) {
        const a = cage.quads[q4 + k], b = cage.quads[q4 + ((k + 1) & 3)];
        const key = a + ',' + b;
        cnt.set(key, (cnt.get(key) || 0) + 1);
      }
      let flips = 0;
      for (const [key] of cnt) { const [a, b] = key.split(','); if (cnt.has(a + ',' + b) && cnt.get(a + ',' + b) > 1) flips++; if (cnt.has(b + ',' + a) === false) {} }
      let sameDir = 0;
      const sd = [];
      for (const [key] of cnt) { const [a, b] = key.split(',').map(Number); if (cnt.get(key) > 1) { sameDir++; sd.push([a, b].map((v) => [cage.data[v * cage.D], cage.data[v * cage.D + 1], cage.data[v * cage.D + 2]].map((x) => +x.toFixed(3)))); } }
      const und = new Map();
      for (const [key, c2] of cnt) { const [a, b] = key.split(',').map(Number); const k2 = Math.min(a, b) + ',' + Math.max(a, b); und.set(k2, (und.get(k2) || 0) + c2); }
      window.__nm = [...und].filter(([, c2]) => c2 > 2).map(([k2, c2]) => [k2, c2]);
      window.__sd = sd;
      info.push({ bnd, sameDir, bpts: bverts.slice(0, 40).map((v) => [cage.data[v * cage.D], cage.data[v * cage.D + 1], cage.data[v * cage.D + 2]].map((x) => +x.toFixed(3))) });
      info.push({ cageMs: +(t1 - t0).toFixed(1), subMs: +(t2 - t1).toFixed(1), tris: g.index.count / 3, cageV: cage.nv });
    }
    window.__info = info;
    const cam = new THREE.PerspectiveCamera(+(q.fov || 30), 1, 0.01, 100);
    let ty = +(q.ty || 0.95);
    let tx = +(q.tx || 0);
    let tz = 0;
    if (q.focus) {
      // Focus on a joint of the first figure, e.g. focus=hand.L
      const p0 = normalizeParams({ ...randomHumanParams(+(q.seed || 11), { sex: presets[0].sex }), ...presets[0] });
      const fj = computeJoints(p0).j[q.focus];
      tx = fj.x + (0 - (n - 1) / 2) * 0.75;
      ty = fj.y;
      tz = fj.z;
    }
    cam.position.set(tx + +(q.cx || 0), ty + +(q.cy || 0.1), tz + +(q.dist || 6.5));
    cam.lookAt(tx, ty, tz);
    e.setView(scene, cam);
  }
  update() {}
  exit() {}
}
runState(ShapeLab);
