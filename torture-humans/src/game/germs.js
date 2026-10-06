// The germ world: shrink small enough (under ~2 cm) and the floor around you
// fills with the things that were always there, too small to see: dust mites
// crawling (0.3 mm), hairs like fallen logs, clothing fibers, skin flakes,
// pollen grains, and dust drifting in the air. Everything is real size, so the
// smaller you get the bigger it looms.
import * as THREE from 'three';
import { GROUP, groups } from './engine/physics.js';

const FLOOR = groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP);
const rand = (a, b) => a + Math.random() * (b - a);

function mite() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xe9dcc3, roughness: 0.45 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.00015, 16, 10), body);
  b.scale.set(0.8, 0.55, 1.1);
  b.position.y = 0.0001;
  g.add(b);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.00005, 10, 8), body);
  head.position.set(0, 0.0001, 0.00017);
  g.add(head);
  const legGeo = new THREE.CylinderGeometry(0.000008, 0.000012, 0.00016, 5).translate(0, -0.00008, 0);
  g.userData.legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const leg = new THREE.Mesh(legGeo, body);
    leg.position.set(side * 0.0001, 0.0001, 0.0001 - k * 0.00007);
    leg.rotation.set(0, 0, side * 0.9);
    leg.userData = { side, phase: k * Math.PI / 2 + (side > 0 ? Math.PI : 0), k };
    g.add(leg);
    g.userData.legs.push(leg);
  }
  // hairs (setae) on the back
  const hairGeo = new THREE.CylinderGeometry(0.000003, 0.000005, 0.00012, 3).translate(0, 0.00006, 0);
  for (let i = 0; i < 10; i++) {
    const h = new THREE.Mesh(hairGeo, body);
    h.position.set(rand(-0.0001, 0.0001), 0.00018, rand(-0.00012, 0.00012));
    h.rotation.set(rand(-0.6, 0.6), 0, rand(-0.6, 0.6));
    g.add(h);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noCollide = true; } });
  return g;
}

function strand(len, radius, color, bend = 0.3) {
  const pts = [];
  const n = 8;
  let a = rand(0, Math.PI * 2);
  const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    pts.push(p.clone());
    a += rand(-bend, bend);
    p.add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(len / n));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
  m.position.y = radius;
  m.castShadow = m.receiveShadow = true;
  return m;
}

function spiky(r, color) {
  const g = new THREE.IcosahedronGeometry(r, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const spike = Math.pow(Math.abs(Math.sin(n.x * 9) * Math.sin(n.y * 9) * Math.sin(n.z * 9)), 4) * 0.5;
    v.copy(n).multiplyScalar(r * (1 + spike));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
}

export class Germs {
  constructor({ scene, player, physics }) {
    Object.assign(this, { scene, player, physics });
    this.group = new THREE.Group();
    this.group.name = 'germ-world';
    this.group.visible = false;
    scene.add(this.group);
    this.center = null;
    this.mites = [];
  }

  get active() { return this.player.scale < 0.012; }

  build(at) {
    for (const c of [...this.group.children]) { this.group.remove(c); c.traverse?.((o) => o.geometry?.dispose()); }
    this.mites = [];
    const hit = this.physics.raycast(at.clone().setY(at.y + 0.01), { x: 0, y: -1, z: 0 }, 0.05, { filterGroups: FLOOR, exclude: this.player.body.collider });
    const y = hit ? hit.point.y : at.y;
    this.center = new THREE.Vector3(at.x, y, at.z);
    const R = 0.02; // a 4 cm circle around you: a whole landscape at this size
    // more of everything close to you
    const spot = (near = 1) => { const r = R * Math.pow(Math.random(), 1.6) * near, a = rand(0, Math.PI * 2); return new THREE.Vector3(at.x + Math.cos(a) * r, y + 0.000002, at.z + Math.sin(a) * r); };
    // hairs (70 um thick, a couple of cm long) and fibers (15 um, colored)
    for (let i = 0; i < 4; i++) { const h = strand(rand(0.01, 0.025), 0.000035, [0x2b1d14, 0x5a3b22, 0x1a1410, 0xb48a5a][i % 4], 0.15); h.position.add(spot()); this.group.add(h); }
    for (let i = 0; i < 22; i++) { const f = strand(rand(0.002, 0.007), 0.000008, [0x3a5fa8, 0xd9d4c8, 0x9b2d2d, 0x2e2e2e, 0x6a8a3a][i % 5], 0.5); f.position.add(spot()); this.group.add(f); }
    // skin flakes: thin pale plates (30-80 um)
    const flakeMat = new THREE.MeshStandardMaterial({ color: 0xf0e2cf, roughness: 0.8, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const flakes = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2), flakeMat, 60);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < 60; i++) {
      q.setFromEuler(new THREE.Euler(rand(-0.2, 0.2), rand(0, 6.3), rand(-0.2, 0.2)));
      const s = rand(0.00003, 0.00008);
      sc.set(s, 1, s * rand(0.6, 1));
      m4.compose(spot().setY(y + 0.000003), q, sc);
      flakes.setMatrixAt(i, m4);
    }
    flakes.receiveShadow = true;
    this.group.add(flakes);
    // pollen: spiky yellow balls (30 um)
    const pollenProto = spiky(0.000015, 0xe8c23a);
    const pollen = new THREE.InstancedMesh(pollenProto.geometry, pollenProto.material, 40);
    for (let i = 0; i < 40; i++) { m4.compose(spot().setY(y + 0.000016), q.random(), sc.setScalar(rand(0.8, 1.4))); pollen.setMatrixAt(i, m4); }
    pollen.castShadow = true;
    this.group.add(pollen);
    // dust mites, crawling around
    for (let i = 0; i < 7; i++) {
      const m = mite();
      let q = spot(0.3);
      for (let k = 0; k < 10 && Math.hypot(q.x - at.x, q.z - at.z) < 0.002; k++) q = spot(0.3);
      m.position.copy(q).setY(y);
      m.rotation.y = rand(0, 6.3);
      this.group.add(m);
      this.mites.push({ m, t: rand(0, 5), turn: 0, speed: rand(0.0003, 0.0007) });
    }
    // dust drifting in the air
    const N = 300;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos.set([at.x + rand(-R, R) * 0.4, y + rand(0, 0.01), at.z + rand(-R, R) * 0.4], i * 3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff6e0, size: 0.00002, transparent: true, opacity: 0.6, depthWrite: false }));
    this.group.add(this.dust);
    this.group.traverse((o) => { o.userData.noCollide = true; });
  }

  update(dt) {
    const on = this.active;
    this.group.visible = on;
    if (!on) { this.center = null; return; }
    const f = this.player.feet;
    if (!this.center || Math.hypot(f.x - this.center.x, f.z - this.center.z) > 0.012 || Math.abs(f.y - this.center.y) > 0.01) this.build(f);
    // mites wander (8 legs in a wave gait), and come to look at you
    for (const mt of this.mites) {
      mt.t += dt;
      const m = mt.m;
      const toYou = new THREE.Vector3(f.x - m.position.x, 0, f.z - m.position.z);
      const curious = toYou.length() < 0.003 && toYou.length() > 0.0005;
      if (Math.random() < dt * 0.5) mt.turn = rand(-1.5, 1.5);
      if (curious) mt.turn = Math.atan2(Math.sin(Math.atan2(toYou.x, toYou.z) - m.rotation.y), Math.cos(Math.atan2(toYou.x, toYou.z) - m.rotation.y)) * 2;
      m.rotation.y += mt.turn * dt;
      const go = toYou.length() < 0.0006 ? 0 : mt.speed;
      m.position.x += Math.sin(m.rotation.y) * go * dt;
      m.position.z += Math.cos(m.rotation.y) * go * dt;
      for (const leg of m.userData.legs) leg.rotation.x = Math.sin(mt.t * 14 + leg.userData.phase) * 0.4 * (go ? 1 : 0.1);
    }
    // the dust drifts
    if (this.dust) this.dust.rotation.y += dt * 0.02;
  }
}
