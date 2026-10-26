// New Halvern comes alive around you: traffic on the street grid (real car models, buses, trucks), people on the
// sidewalks, pigeons, alley cats, stray dogs, raccoons and rats, ships in the harbor, and whoever comes for you:
// police, SWAT, Voss's black vans, the army (tanks, soldiers, attack helicopters), jets, a navy destroyer.
// Grow big enough and the city itself is food: cars, buses, tanks, ships, then whole buildings, bite by bite.
// Everything here uses the same interface as the bugs (pos, L, mass, hp, state, hurt, webbed, remove...), so biting,
// webbing, wrapping, feeding and the HUD all work on a bus exactly like on a fruit fly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PITCH, NB, SHORE, FAR_SHORE, CURB } from './city.js';
import { makeHelicopter } from './towerOutside.js';
import { rand, pick, clamp } from '../core/util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const S0 = PITCH / 2;                                   // street centre lines sit at 55 + 110k
const EDGE = NB * PITCH - S0;                           // last street inside the city
const LANE = 3.5;
const UP = new THREE.Vector3(0, 1, 0);

export const VEH = {
  sedan:  { name: 'Sedan', latin: 'four doors, 1.5 tonnes', L: 4.6, mass: 1500, hp: 260, speed: 11, glb: 'NormalCar1', fact: 'Steel, glass, a full tank of gas. Crunchy on the outside.' },
  hatch:  { name: 'Hatchback', latin: 'city car, 1.2 tonnes', L: 4.1, mass: 1200, hp: 220, speed: 11, glb: 'NormalCar2', fact: 'Small, light, honks a lot.' },
  suv:    { name: 'SUV', latin: '2.2 tonnes', L: 4.9, mass: 2200, hp: 320, speed: 12, glb: 'SUV', fact: 'Big tyres, big engine, still just a snack.' },
  sports: { name: 'Sports car', latin: '500 horsepower', L: 4.5, mass: 1400, hp: 240, speed: 16, glb: 'SportsCar', fact: 'Goes 0-100 in 3 seconds. Not fast enough.' },
  taxi:   { name: 'Taxi', latin: 'yellow cab', L: 4.6, mass: 1500, hp: 260, speed: 12, glb: 'Taxi', fact: 'The meter is still running.' },
  cop:    { name: 'Police cruiser', latin: 'NHPD', L: 4.9, mass: 1900, hp: 380, speed: 17, glb: 'Cop', siren: true, police: true, fact: 'Lights, siren, two officers, two pistols.' },
  bus:    { name: 'City bus', latin: '12 m, 12 tonnes', L: 12, mass: 12000, hp: 900, speed: 8, fact: 'Route 48 to the VOSS tower. Nobody is getting off there tonight.' },
  truck:  { name: 'Box truck', latin: '7 tonnes of deliveries', L: 8, mass: 7000, hp: 700, speed: 9, fact: 'Full of cardboard boxes and somebody\'s new couch.' },
  van:    { name: 'Voss black van', latin: 'VOSS BIOGENETICS', L: 5.6, mass: 2800, hp: 420, speed: 14, voss: true, fact: 'No windows. Nets, foam, tranquilizer guns in the back.' },
  tank:   { name: 'M1 tank', latin: '60 tonnes of armour', L: 9.8, mass: 60000, hp: 4200, speed: 7, army: true, fact: 'A 120 mm gun and armour plate. You can have the plate.' },
  armytruck: { name: 'Army truck', latin: 'troop transport', L: 7.2, mass: 9000, hp: 900, speed: 10, army: true, fact: 'Carries twelve soldiers who were told this was a gas leak.' },
  heli:   { name: 'Attack helicopter', latin: 'two pilots, sixteen rockets', L: 17, mass: 7000, hp: 1600, speed: 34, air: true, army: true, fact: 'Hellfire missiles, a 30 mm chain gun and a lot of noise.' },
  newsheli: { name: 'News helicopter', latin: 'Channel 9 SKY', L: 12, mass: 2500, hp: 600, speed: 26, air: true, news: true, fact: 'Live, in HD, on every TV in the country. Smile.' },
  jet:    { name: 'Fighter jet', latin: 'F-35, Mach 1.6', L: 15.7, mass: 13000, hp: 1100, speed: 170, air: true, army: true, fact: 'Supersonic, stealthy, still made of metal.' },
  ship:   { name: 'Cargo ship', latin: '4,000 containers', L: 220, mass: 5e7, hp: 60000, speed: 4, boat: true, fact: 'Sneakers, phones, frozen shrimp, a million rubber ducks.' },
  tug:    { name: 'Tugboat', latin: '3,000 horsepower', L: 28, mass: 4e5, hp: 4000, speed: 5, boat: true, fact: 'Pushes ships ten times its size. Not you.' },
  destroyer: { name: 'Navy destroyer', latin: 'guided missile destroyer', L: 155, mass: 9e6, hp: 50000, speed: 9, boat: true, army: true, fact: 'Missiles, a 5-inch gun, 300 sailors who are now swimming.' },
};
export const VEH_POWER = { tank: 'armor', destroyer: 'armor', armytruck: 'armor', heli: 'glide', newsheli: 'glide', jet: 'glide' };

// ------------------------------------------------------------------ models (length 1 along +Z, wheels on y = 0)
const MC = {};
function M(key, o) { return MC[key] || (MC[key] = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, ...o })); }
function bx(g, w, h, d, x, y, z, m, ry = 0, rx = 0) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0); g.add(mesh); return mesh; }
function cy(g, r, h, x, y, z, m, rx = 0, rz = 0, seg = 14) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); g.add(mesh); return mesh; }
// merge every mesh of a model by material: a car = 3-6 draw calls instead of dozens
function mergeByMaterial(obj) {
  obj.updateMatrixWorld(true);
  const byMat = new Map();
  obj.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    // dequantize (int16 positions) by converting to float
    for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k]; if (!(a.array instanceof Float32Array) || a.normalized) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
    g.applyMatrix4(o.matrixWorld);
    if (mats.length > 1 && g.groups.length) {
      for (const gr of g.groups) { const part = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k]; part.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize)); } const m = mats[gr.materialIndex]; (byMat.get(m) || byMat.set(m, []).get(m)).push(part); }
    } else (byMat.get(mats[0]) || byMat.set(mats[0], []).get(mats[0])).push(g);
  });
  const out = new THREE.Group();
  for (const [m, geos] of byMat) { const mesh = new THREE.Mesh(mergeGeometries(geos), m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.matName = m.name; out.add(mesh); }
  return out;
}
// scale to length 1 along +Z (front = headlights), wheels at y = 0
function normalize(obj, frontHint = null) {
  obj.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3());
  const holder = new THREE.Group(); holder.add(obj);
  if (sz.x > sz.z) obj.rotation.y = Math.PI / 2;
  holder.updateMatrixWorld(true);
  // which end are the headlights on?
  let head = null, tail = null;
  holder.traverse(o => { if (!o.isMesh) return; const n = (o.userData.matName || (o.material && o.material.name) || ''); const b = new THREE.Box3().setFromObject(o); if (/head/i.test(n)) head = b.getCenter(new THREE.Vector3()); if (/tail/i.test(n)) tail = b.getCenter(new THREE.Vector3()); });
  if (head && tail && head.z < tail.z) obj.rotation.y += Math.PI;
  holder.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(holder); sz = bb.getSize(new THREE.Vector3());
  const k = 1 / Math.max(sz.z, 1e-6);
  obj.scale.multiplyScalar(k);
  holder.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(holder);
  obj.position.x -= (bb.min.x + bb.max.x) / 2; obj.position.z -= (bb.min.z + bb.max.z) / 2; obj.position.y -= bb.min.y;
  return holder;
}
function wheels(g, n, w, r, mat, y = r) { for (let i = 0; i < n; i++) { const z = -0.38 + i * (0.76 / Math.max(1, n - 1)); for (const s of [-1, 1]) cy(g, r, 0.025, s * w, y, z, mat, 0, Math.PI / 2, 14); } }
const PROC = {
  bus() {
    const g = new THREE.Group(), paint = M('busPaint', { color: 0x1d5a9a, roughness: 0.35, metalness: 0.3 }), white = M('busWhite', { color: 0xe8e8e4, roughness: 0.4 });
    const glass = M('busGlass', { color: 0x15202a, roughness: 0.05, metalness: 0.4, emissive: 0xffe0a0, emissiveIntensity: 0.25 });
    bx(g, 0.21, 0.24, 1, 0, 0.145, 0, paint); bx(g, 0.212, 0.04, 0.98, 0, 0.27, 0, white);
    bx(g, 0.214, 0.075, 0.84, 0, 0.19, -0.03, glass); bx(g, 0.2, 0.1, 0.012, 0, 0.19, 0.497, glass);
    bx(g, 0.12, 0.022, 0.006, 0, 0.245, 0.503, M('busSign', { color: 0x000000, emissive: 0xff8a10, emissiveIntensity: 2 }));
    wheels(g, 2, 0.1, 0.042, M('tyre', { color: 0x111111, roughness: 0.9 }));
    return g;
  },
  truck() {
    const g = new THREE.Group(), cab = M('truckCab', { color: 0xc8c8c4, roughness: 0.35, metalness: 0.3 }), box = M('truckBox', { color: 0xf0f0ec, roughness: 0.7 });
    bx(g, 0.28, 0.4, 0.68, 0, 0.27, -0.14, box); bx(g, 0.28, 0.28, 0.26, 0, 0.2, 0.36, cab);
    bx(g, 0.282, 0.11, 0.1, 0, 0.27, 0.42, M('truckGlass', { color: 0x10161c, roughness: 0.05, metalness: 0.5 }));
    wheels(g, 2, 0.13, 0.06, M('tyre', { color: 0x111111, roughness: 0.9 }));
    return g;
  },
  van() {
    const g = new THREE.Group(), blk = M('vanBlack', { color: 0x07080a, roughness: 0.25, metalness: 0.6 });
    bx(g, 0.36, 0.36, 0.86, 0, 0.23, -0.06, blk); bx(g, 0.35, 0.2, 0.16, 0, 0.17, 0.42, blk);
    bx(g, 0.352, 0.11, 0.12, 0, 0.32, 0.36, M('vanGlass', { color: 0x020203, roughness: 0.02, metalness: 0.8 }));
    for (const s of [-1, 1]) bx(g, 0.004, 0.05, 0.3, s * 0.182, 0.26, -0.05, M('vossRed', { color: 0x000000, emissive: 0xc01010, emissiveIntensity: 1.5 }));
    wheels(g, 2, 0.17, 0.07, M('tyre', { color: 0x111111, roughness: 0.9 }));
    return g;
  },
  tank() {
    const g = new THREE.Group(), olive = M('tankOlive', { color: 0x5a5a3c, roughness: 0.75, metalness: 0.3 }), dark = M('tankDark', { color: 0x262620, roughness: 0.9 });
    bx(g, 0.36, 0.12, 0.8, 0, 0.13, 0, olive); bx(g, 0.34, 0.06, 0.18, 0, 0.12, 0.42, olive, 0, -0.4);
    for (const s of [-1, 1]) { bx(g, 0.09, 0.13, 0.9, s * 0.19, 0.075, 0, dark); for (let i = 0; i < 7; i++) cy(g, 0.04, 0.08, s * 0.19, 0.045, -0.36 + i * 0.12, dark, 0, Math.PI / 2, 10); }
    const tur = new THREE.Group(); tur.name = 'turret'; tur.position.set(0, 0.2, -0.05); g.add(tur);
    bx(tur, 0.3, 0.09, 0.4, 0, 0.045, 0, olive);
    const gun = cy(tur, 0.016, 0.6, 0, 0.05, 0.45, dark, Math.PI / 2, 0, 10); g.userData.gun = gun;
    return g;
  },
  armytruck() {
    const g = new THREE.Group(), olive = M('tankOlive', { color: 0x5a5a3c, roughness: 0.75, metalness: 0.3 }), canvas = M('canvas', { color: 0x6a6a48, roughness: 0.95 });
    bx(g, 0.32, 0.26, 0.3, 0, 0.24, 0.32, olive); bx(g, 0.34, 0.34, 0.62, 0, 0.32, -0.17, canvas);
    wheels(g, 3, 0.15, 0.07, M('tyre', { color: 0x111111, roughness: 0.9 }));
    return g;
  },
  jet() {
    const g = new THREE.Group(), grey = M('jetGrey', { color: 0x6a7078, roughness: 0.45, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.8, 10), grey); body.rotation.x = Math.PI / 2; body.position.set(0, 0.06, -0.05); g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 10), grey); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.06, 0.45); g.add(nose);
    const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0.34, 0, -0.18, 0.34, 0, -0.26, 0, 0, -0.3, -0.34, 0, -0.26, -0.34, 0, -0.18], 3)); wingG.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]); wingG.computeVertexNormals();
    const wings = new THREE.Mesh(wingG, M('jetWing', { color: 0x5a6068, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide })); wings.position.y = 0.05; g.add(wings);
    for (const s of [-1, 1]) bx(g, 0.006, 0.12, 0.12, s * 0.06, 0.13, -0.38, grey, 0, 0).rotation.z = s * 0.3;
    bx(g, 0.04, 0.03, 0.12, 0, 0.1, 0.25, M('canopy', { color: 0x302010, roughness: 0.05, metalness: 0.9 }));
    bx(g, 0.03, 0.03, 0.02, 0, 0.06, -0.45, M('burner', { color: 0x000000, emissive: 0xff7a20, emissiveIntensity: 4 }));
    return g;
  },
  ship() {
    const g = new THREE.Group(), hull = M('shipHull', { color: 0x2a2a30, roughness: 0.7 }), red = M('shipRed', { color: 0x7a1a14, roughness: 0.8 }), white = M('shipWhite', { color: 0xe8e8e2, roughness: 0.6 });
    const hg = new THREE.BoxGeometry(0.15, 0.06, 1, 1, 1, 6); const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > 0.35) p.setX(i, p.getX(i) * (1 - (z - 0.35) / 0.15 * 0.95)); }
    hg.computeVertexNormals(); const h = new THREE.Mesh(hg, hull); h.position.y = 0.03; g.add(h);
    bx(g, 0.148, 0.012, 0.98, 0, 0.004, 0, red);
    bx(g, 0.12, 0.07, 0.07, 0, 0.095, -0.4, white); bx(g, 0.02, 0.05, 0.02, 0, 0.15, -0.43, M('funnel', { color: 0xc8a018 }));
    const cols = [0xa83a2a, 0x2a5a9a, 0x3a7a3a, 0xc8a018, 0x8a8a8a, 0x5a3a7a];
    for (let row = 0; row < 11; row++) for (let st = 0; st < 3; st++) bx(g, 0.13, 0.016, 0.06, 0, 0.068 + st * 0.017, -0.3 + row * 0.064, M('cont' + ((row * 3 + st) % 6), { color: cols[(row * 3 + st) % 6], roughness: 0.7, metalness: 0.4 }));
    return g;
  },
  tug() {
    const g = new THREE.Group(), red = M('tugRed', { color: 0x9a2018, roughness: 0.6 }), black = M('tugBlack', { color: 0x151515, roughness: 0.7 }), white = M('shipWhite', { color: 0xe8e8e2, roughness: 0.6 });
    bx(g, 0.34, 0.14, 1, 0, 0.07, 0, black); bx(g, 0.34, 0.04, 1, 0, 0.16, 0, red);
    bx(g, 0.22, 0.14, 0.3, 0, 0.25, 0.05, white); bx(g, 0.06, 0.12, 0.06, 0, 0.36, -0.15, M('funnel', { color: 0xc8a018 }));
    return g;
  },
  destroyer() {
    const g = new THREE.Group(), grey = M('navyGrey', { color: 0x6a7078, roughness: 0.6, metalness: 0.3 });
    const hg = new THREE.BoxGeometry(0.13, 0.06, 1, 1, 1, 6); const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > 0.3) p.setX(i, p.getX(i) * (1 - (z - 0.3) / 0.2 * 0.95)); }
    hg.computeVertexNormals(); const h = new THREE.Mesh(hg, grey); h.position.y = 0.03; g.add(h);
    bx(g, 0.08, 0.07, 0.25, 0, 0.095, -0.02, grey); bx(g, 0.05, 0.08, 0.08, 0, 0.17, 0.0, grey);
    cy(g, 0.004, 0.14, 0, 0.27, 0.0, grey, 0, 0, 6);
    const tur = new THREE.Group(); tur.name = 'turret'; tur.position.set(0, 0.07, 0.3); g.add(tur);
    cy(tur, 0.025, 0.02, 0, 0.0, 0, grey); cy(tur, 0.004, 0.1, 0, 0.01, 0.05, grey, Math.PI / 2, 0, 6);
    return g;
  },
};

// ------------------------------------------------------------------ a vehicle (also prey)
let VID = 1;
export class Vehicle {
  constructor(sys, kind, o) {
    const d = VEH[kind];
    this.sys = sys; this.id = VID++; this.kind = kind;
    this.def = { ...d, move: d.air ? 'air' : d.boat ? 'boat' : 'car', passive: !d.army };
    this.L = d.L * (o.scale || rand(0.96, 1.04)); this.mass = d.mass * (this.L / d.L) ** 3;
    this.hp = this.maxHp = d.hp;
    this.pos = o.pos.clone(); this.up = new THREE.Vector3(0, 1, 0); this.yaw = o.yaw || 0;
    this.speed = o.speed ?? 0; this.vmax = d.speed * rand(0.85, 1.1);
    this.state = o.state || 'drive'; this.mode = 'drive';
    this.stuck = 0; this.wrapped = false; this.venom = 0; this.eatenFrac = 0;
    this.lane = o.lane || null; this.turn = null; this.cd = rand(2, 5); this.t = rand(0, 10); this.alarm = 0;
    this.root = new THREE.Group();
    this.model = { root: sys.makeModel(kind), anim() {} };
    this.root.add(this.model.root);
    this.root.scale.setScalar(this.L);
    sys.scene.add(this.root);
    if (!d.air) this.box = sys.zone.dyn.add(new THREE.Vector3(), new THREE.Vector3(), { minSize: 0, maxSize: this.L * 1.5, obj: this, tag: 'vehicle' });
    if (d.air) { this.alt = o.alt || 80; this.orbitA = rand(0, 6.28); this.orbitR = o.orbitR || 120; }
    this.place();
  }
  get alive() { return this.state !== 'dead' && this.state !== 'eaten'; }
  get helpless() { return this.wrapped || this.stuck > 0 || this.state === 'dead' || this.state === 'paralyzed' || (!this.def.army && this.speed < 0.6 && !this.def.air); }
  hurt(dmg, venom = 0) {
    if (this.state === 'eaten' || this.state === 'dead') return;
    this.hp -= dmg + venom * 0.2;
    const G = this.sys.game;
    if (this.hp <= 0) { this.state = 'dead'; this.hp = 0; this.speed = 0; G.fx.shockwave(this.pos.clone().add(_v.set(0, this.L * 0.1, 0)), this.L * 0.25, [1, 0.6, 0.25, 0.7]); G.audio.at && G.audio.at('crash', this.pos); if (this.def.air) this.falling = true; return; }
    if (!this.def.army && !this.def.air) { this.state = 'crashed'; this.alarm = 8; G.audio.at && G.audio.at('carAlarm', this.pos); }
    if (this.def.army && this.state !== 'attack') this.state = 'attack';
  }
  webbed(amount) { this.stuck = Math.max(this.stuck, amount); if (this.def.air) this.falling = true; }
  remove() {
    this.state = 'eaten'; this.root.removeFromParent();
    if (this.box) this.sys.zone.dyn.remove(this.box);
    this.sys.removed(this);
  }
  place() {
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.pitch || 0, this.yaw, this.roll || 0);
    if (this.box) {
      const hw = this.L * (this.def.boat ? 0.075 : 0.11), hl = this.L * 0.5, hh = this.L * (this.def.boat ? 0.1 : this.kind === 'bus' ? 0.27 : this.kind === 'truck' ? 0.5 : 0.32);
      const c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw));
      const ex = hw * c + hl * s, ez = hl * c + hw * s;
      this.box.min.set(this.pos.x - ex, this.pos.y, this.pos.z - ez); this.box.max.set(this.pos.x + ex, this.pos.y + hh, this.pos.z + ez);
    }
  }
  fwd(out = _v2) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  update(dt, P) {
    this.t += dt;
    if (this.state === 'eaten') return;
    if (this.stuck > 0) { this.stuck = Math.max(0, this.stuck - dt * 0.08); this.speed = 0; }
    const before = _v3.copy(this.pos);
    if (this.def.air) this.updateAir(dt, P);
    else if (this.def.boat) this.updateBoat(dt, P);
    else this.updateCar(dt, P);
    // anything standing on it rides along
    if (P && this.box && P.groundBox === this.box && P.mode === 'ground') P.pos.add(_v.subVectors(this.pos, before));
    this.place();
  }
  // ---- cars: drive the street grid, turn at crossings, stop behind each other, panic when you're huge
  updateCar(dt, P) {
    const G = this.sys.game;
    if (this.state === 'dead' || this.wrapped || this.state === 'paralyzed') { this.speed = 0; if (this.state === 'dead' && Math.random() < dt * 4) G.fx.steam(this.pos.clone().add(_v.set(0, this.L * 0.25, 0)), this.L * 0.3); return; }
    if (this.state === 'crashed') { this.speed = Math.max(0, this.speed - dt * 12); this.alarm -= dt; if (this.alarm < 0 && P && P.sizeM < this.L * 1.5 && !this.def.police) { this.state = 'drive'; } return; }
    if (this.state === 'parked') return;
    let want = this.vmax;
    const dP = P ? this.pos.distanceTo(P.pos) : 1e9;
    // police drive to you, stop, the officers get out
    if (this.def.police || this.def.voss || this.kind === 'armytruck' || this.kind === 'tank') {
      if (P && this.state !== 'flee') {
        if (dP < Math.max(26, P.sizeM * 4)) { want = 0; if (!this.unloaded && this.speed < 0.5) { this.unloaded = true; this.sys.unload(this); } if (this.kind === 'tank') this.tankFire(dt, P); }
      }
    }
    // a giant spider in the road: stop, reverse, flee
    if (P && !this.def.army && !this.def.police && P.sizeM > 3 && dP < P.sizeM * 10 && this.state !== 'flee') { this.state = 'flee'; this.vmax = VEH[this.kind].speed * 1.6; if (this.lane) { this.lane.dir *= -1; this.reLane(); } }
    // run over a little spider
    if (P && P.sizeM < this.L * 0.25 && this.speed > 2 && P.mode === 'ground' && P.pos.y < this.pos.y + 1.2) {
      const f = this.fwd(), rel = _v.subVectors(P.pos, this.pos), along = rel.dot(f), side = rel.x * f.z - rel.z * f.x;
      if (Math.abs(along) < this.L * 0.45 && Math.abs(side) < this.L * 0.12) P.hurt(this.speed * 6 / Math.max(0.2, P.sizeM), 'run over by a ' + this.def.name.toLowerCase());
    }
    // traffic ahead in my lane
    if (this.lane) for (const o of this.sys.vehicles) {
      if (o === this || !o.lane || o.lane.axis !== this.lane.axis || o.lane.dir !== this.lane.dir || Math.abs(o.lane.c - this.lane.c) > 1) continue;
      const ahead = (this.lane.axis === 'z' ? o.pos.z - this.pos.z : o.pos.x - this.pos.x) * this.lane.dir;
      if (ahead > 0 && ahead < (this.L + o.L) * 0.6 + 4 + this.speed) want = Math.min(want, Math.max(0, ahead - (this.L + o.L) * 0.6) * 0.9);
    }
    if (this.waitT > 0) { this.waitT -= dt; want = 0; }
    this.speed += clamp(want - this.speed, -dt * 9, dt * 4);
    if (this.turn) { // gliding into the new lane through the crossing
      const T = this.turn; T.t += dt / T.dur;
      const k = Math.min(1, T.t), e = k * k * (3 - 2 * k);
      this.pos.lerpVectors(T.from, T.to, e); let dy = T.yaw1 - T.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw = T.yaw0 + dy * e;
      if (k >= 1) this.turn = null;
      return;
    }
    if (!this.lane) return;
    const L = this.lane, f = this.fwd();
    const along0 = L.axis === 'z' ? this.pos.z : this.pos.x;
    this.pos.addScaledVector(f, this.speed * dt);
    // keep to the lane
    if (L.axis === 'z') this.pos.x += (L.c - LANE * L.dir - this.pos.x) * Math.min(1, dt * 3); else this.pos.z += (L.c + LANE * L.dir - this.pos.z) * Math.min(1, dt * 3);
    const along1 = L.axis === 'z' ? this.pos.z : this.pos.x;
    // crossing passed? (centre of the next street)
    const k0 = Math.floor((along0 - S0) / PITCH), k1 = Math.floor((along1 - S0) / PITCH);
    if (k0 !== k1) this.atCrossing(S0 + Math.max(k0, k1) * PITCH);
  }
  reLane() { const L = this.lane; this.yaw = L.axis === 'z' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
  atCrossing(cc) {
    const L = this.lane;
    const inCity = (axis, v) => Math.abs(v) <= EDGE && !(axis === 'x' && v > SHORE - 70);
    const opts = [];
    if (inCity(L.axis, cc + L.dir * PITCH)) opts.push({ axis: L.axis, c: L.c, dir: L.dir, w: 3 });
    const nAxis = L.axis === 'z' ? 'x' : 'z';
    for (const d of [-1, 1]) if (inCity(nAxis, L.c + d * PITCH)) opts.push({ axis: nAxis, c: cc, dir: d, w: 1 });
    if (Math.random() < 0.18 && this.state !== 'flee' && !this.def.police) this.waitT = rand(1, 4); // red light
    let tot = 0; for (const o of opts) tot += o.w;
    let r = Math.random() * tot, ch = null;
    for (const o of opts) { r -= o.w; if (r <= 0) { ch = o; break; } }
    if (!ch) { L.dir *= -1; this.reLane(); return; }           // dead end: U-turn
    if (ch.axis === L.axis) return;                              // straight on
    // turn onto the cross street: glide from here into its lane, just past the crossing
    const to = ch.axis === 'x' ? new THREE.Vector3(L.c + ch.dir * 9, this.pos.y, cc + LANE * ch.dir) : new THREE.Vector3(cc - LANE * ch.dir, this.pos.y, L.c + ch.dir * 9);
    const yaw1 = ch.axis === 'z' ? (ch.dir > 0 ? 0 : Math.PI) : (ch.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.turn = { from: this.pos.clone(), to, t: 0, dur: 1.3, yaw0: this.yaw, yaw1 };
    this.lane = { axis: ch.axis, c: ch.c, dir: ch.dir };
  }
  tankFire(dt, P) {
    const G = this.sys.game;
    const tur = this.model.root.userData.turret;
    const to = _v.subVectors(P.pos, this.pos); const yawTo = Math.atan2(to.x, to.z);
    if (tur) tur.rotation.y = yawTo - this.yaw;
    this.cd -= dt;
    if (this.cd > 0) return;
    this.cd = rand(4, 7);
    const muzzle = this.pos.clone().add(_v2.set(Math.sin(yawTo) * this.L * 0.5, this.L * 0.26, Math.cos(yawTo) * this.L * 0.5));
    G.fx.muzzle(muzzle, yawTo); G.audio.at && G.audio.at('cannon', muzzle);
    this.sys.shell(muzzle, P, 'tank shell', clamp(400 / Math.max(1, P.sizeM), 2, 80));
  }
  // ---- helicopters + jets
  updateAir(dt, P) {
    const G = this.sys.game;
    if (this.falling || this.state === 'dead') {
      // spin down and crash
      this.vy = (this.vy || 0) - 9.81 * dt; this.pos.y += this.vy * dt; this.yaw += dt * 3; this.roll = Math.sin(this.t * 3) * 0.4;
      if (this.wrapped) { this.vy = 0; }
      const ground = this.sys.groundY(this.pos);
      if (this.pos.y <= ground) { this.pos.y = ground; if (!this.crashed) { this.crashed = true; this.state = 'dead'; G.fx.shockwave(this.pos, this.L * 0.3, [1, 0.6, 0.2, 0.8]); G.audio.at && G.audio.at('crash', this.pos); } this.vy = 0; this.roll = 0.4; }
      return;
    }
    if (!P) return;
    const s = Math.max(P.sizeM, 2);
    if (this.kind === 'jet') {
      // strafing runs: fly past, fire, swing round
      if (!this.run) this.run = { dir: new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(), t: 0 };
      this.run.t += dt;
      const tgt = P.pos.clone().addScaledVector(UP, Math.max(60, s * 2));
      const to = _v.subVectors(tgt, this.pos); const d = to.length();
      if (d > 1200) this.run.dir.copy(to).normalize();
      else if (this.run.t > 6) { this.run.dir.lerp(to.normalize(), 0.5).normalize(); this.run.t = 0; }
      this.pos.addScaledVector(this.run.dir, this.vmax * dt);
      this.yaw = Math.atan2(this.run.dir.x, this.run.dir.z); this.pos.y += (tgt.y - this.pos.y) * Math.min(1, dt * 0.5);
      this.cd -= dt;
      if (this.cd <= 0 && d < 900 && this.fwd().dot(_v2.subVectors(P.pos, this.pos).normalize()) > 0.6) { this.cd = rand(3, 5); this.sys.missile(this.pos.clone(), P, clamp(300 / Math.max(1, P.sizeM), 2, 60)); }
      return;
    }
    // helicopters circle you at a distance
    this.orbitA += dt * (this.def.news ? 0.12 : 0.22);
    const R = Math.max(this.orbitR, s * 6), alt = Math.max(this.alt, s * 2.2);
    const want = _v.set(P.pos.x + Math.cos(this.orbitA) * R, Math.max(P.pos.y, 0) + alt, P.pos.z + Math.sin(this.orbitA) * R);
    const to = _v2.subVectors(want, this.pos); const d = to.length();
    const sp = Math.min(this.vmax, d * 0.8);
    if (d > 0.01) this.pos.addScaledVector(to.normalize(), sp * dt);
    const look = _v3.subVectors(P.pos, this.pos); this.yaw = Math.atan2(look.x, look.z); this.pitch = 0.12;
    const rot = this.model.root.userData.rotor; if (rot) rot.rotation.y += dt * 30;
    if (this.def.army) {
      this.cd -= dt;
      if (this.cd <= 0) { this.cd = rand(2.5, 4.5); this.sys.missile(this.pos.clone().add(_v.set(0, -this.L * 0.1, 0)), P, clamp(220 / Math.max(1, P.sizeM), 2, 45)); }
    }
  }
  // ---- boats sail up and down the harbor
  updateBoat(dt, P) {
    if (this.state === 'dead' || this.wrapped || this.stuck > 0) { this.speed = 0; return; }
    if (!this.lane) this.lane = { axis: 'z', c: this.pos.x, dir: Math.random() < 0.5 ? 1 : -1 };
    this.speed += (this.vmax - this.speed) * Math.min(1, dt * 0.3);
    this.yaw = this.lane.dir > 0 ? 0 : Math.PI;
    this.pos.z += this.lane.dir * this.speed * dt;
    if (Math.abs(this.pos.z) > 2600) this.lane.dir *= -1;
    this.pos.y = -2.5 + Math.sin(this.t * 0.6 + this.id) * 0.15;
    this.roll = Math.sin(this.t * 0.4 + this.id) * 0.015;
    if (this.kind === 'destroyer' && P && this.pos.distanceTo(P.pos) < 2500) {
      this.cd -= dt;
      if (this.cd <= 0) { this.cd = rand(3, 5); this.sys.missile(this.pos.clone().add(_v.set(0, this.L * 0.1, 0)), P, clamp(600 / Math.max(1, P.sizeM), 3, 90)); }
    }
  }
}

// ------------------------------------------------------------------ a building you can eat (a proxy for one instance)
class BuildingPrey {
  constructor(sys, b) {
    this.sys = sys; this.b = b; this.kind = 'building';
    const floors = Math.max(1, Math.round(b.h / b.fh));
    const nm = b.style === 0 ? 'Glass office tower' : b.style === 1 ? 'Brick apartment block' : 'Concrete office block';
    this.def = { name: nm, latin: floors + ' floors, ' + Math.round(b.h) + ' m', fact: 'Mostly air, steel and concrete. Everybody inside already ran.', passive: true, chunk: true, move: 'none' };
    this.L = Math.max(b.w, b.d);
    this.mass = 300 * b.w * b.d * b.h;
    this.hp = this.maxHp = 1; this.state = 'idle'; this.mode = 'idle'; this.stuck = 0; this.wrapped = false; this.venom = 0; this.eatenFrac = 0;
    this.pos = new THREE.Vector3(b.x, b.y0 + b.h / 2, b.z); this.up = new THREE.Vector3(0, 1, 0);
    this.root = new THREE.Group(); this.model = { root: new THREE.Group(), anim() {} }; this.root.add(this.model.root);
  }
  get alive() { return this.state !== 'eaten'; }
  get helpless() { return true; }
  hurt(d) { this.sys.game.fx.dust(this.pos, UP, Math.max(1, this.L * 0.05), 0.6); }
  webbed() {}
  update(dt, P) { if (P) this.pos.y = clamp(P.pos.y, this.b.y0, this.b.y0 + this.b.h); }
  takeChunk(m) {
    const b = this.b, before = this.mass;
    this.mass = Math.max(0, this.mass - m);
    if (this.mass < before * 0.06 || b.h * this.mass / before < 3) { this.remove(); return true; }
    b.h *= this.mass / before;
    this.sys.city.setBuilding(b);
    this.sys.game.fx.dust(new THREE.Vector3(b.x, b.y0 + b.h, b.z), UP, b.w * 0.3, 1);
    return false;
  }
  remove() { this.state = 'eaten'; this.sys.city.removeBuilding(this.b); this.sys.removedBuilding(this); }
}

// ------------------------------------------------------------------ the city life manager
export class CityLife {
  constructor(zone) {
    this.zone = zone; this.game = zone.game; this.scene = zone.scene; this.city = zone.city;
    this.vehicles = []; this.groups = []; this.peds = []; this.bprey = new Map(); this.shells = [];
    this.spawnT = 0; this.respT = 0; this.timer = 0;
    this.models = {};
  }
  async build() {
    // car models: merged by material, normalised to length 1, front = +Z
    const src = this.city.carModels || {};
    for (const [kind, d] of Object.entries(VEH)) {
      if (d.glb && src[d.glb]) this.models[kind] = normalize(mergeByMaterial(src[d.glb].clone(true)));
      else if (PROC[kind]) this.models[kind] = PROC[kind]();
      else if (kind === 'heli' || kind === 'newsheli') { const h = makeHelicopter(); if (h.userData.rotor) h.userData.rotor.name = 'rotor'; this.models[kind] = normalize(h); }
    }
    // the parked cars become prey you can eat
    for (const car of this.city.parked || []) {
      const kind = /Taxi/.test(car.name || '') ? 'taxi' : pick(['sedan', 'hatch', 'suv', 'sedan']);
      const v = new Vehicle(this, kind, { pos: new THREE.Vector3(car.position.x, 0, car.position.z), yaw: car.rotation.y, state: 'parked' });
      car.removeFromParent();
      for (const b of this.city.grid.all) if (b.car === car) b.gone = true;
      this.add(v);
    }
    this.city.parked = [];
    // ships in the harbor
    for (let i = 0; i < 3; i++) this.add(new Vehicle(this, 'ship', { pos: new THREE.Vector3(SHORE + 220 + i * 280, -2.5, rand(-2000, 2000)), speed: 3 }));
    for (let i = 0; i < 4; i++) this.add(new Vehicle(this, 'tug', { pos: new THREE.Vector3(SHORE + rand(80, 1000), -2.5, rand(-1500, 1500)), speed: 4 }));
  }
  makeModel(kind) {
    const m = this.models[kind];
    const c = m ? m.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 1), M('fallback', { color: 0x888888 }));
    c.userData.rotor = c.getObjectByName('rotor'); c.userData.turret = c.getObjectByName('turret');
    return c;
  }
  add(v) { this.vehicles.push(v); this.zone.creatures.list.push(v); return v; }
  removed(v) { const i = this.vehicles.indexOf(v); if (i >= 0) this.vehicles.splice(i, 1); }
  removedBuilding(bp) { this.bprey.delete(bp.b); }
  groundY(p) { return p.x > SHORE && p.x < FAR_SHORE ? -2.5 : 0; }
  // spawn a car on a random street somewhere around (not too close to) the player
  spawnCar(kind, near, minD = 140, maxD = 360, toward = false) {
    for (let tries = 0; tries < 12; tries++) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const across = (axis === 'z' ? near.x : near.z) + rand(-maxD, maxD);
      const c = Math.round((across - S0) / PITCH) * PITCH + S0;
      if (Math.abs(c) > EDGE || (axis === 'z' && c > SHORE - 70)) continue;
      const alongC = (axis === 'z' ? near.z : near.x) + rand(-maxD, maxD);
      const along = clamp(alongC, -EDGE, axis === 'x' ? Math.min(EDGE, SHORE - 80) : EDGE);
      const dir = toward ? Math.sign((axis === 'z' ? near.z : near.x) - along) || 1 : (Math.random() < 0.5 ? 1 : -1);
      const pos = axis === 'z' ? new THREE.Vector3(c - LANE * dir, 0, along) : new THREE.Vector3(along, 0, c + LANE * dir);
      const d = pos.distanceTo(near);
      if (d < minD || d > maxD * 1.5) continue;
      if (Math.abs(pos.x) < 30 && Math.abs(pos.z) < 30) continue;
      const v = new Vehicle(this, kind, { pos, lane: { axis, c, dir }, speed: VEH[kind].speed * 0.8 });
      v.reLane();
      return this.add(v);
    }
    return null;
  }
  // police / SWAT / Voss / soldiers get out when they arrive
  unload(v) {
    const H = this.zone.humans; if (!H) return;
    const role = v.def.voss ? 'hazmat' : v.kind === 'armytruck' ? 'soldier' : this.game.wanted.level >= 4 ? 'swat' : 'police';
    const n = v.kind === 'armytruck' ? 6 : v.def.voss ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar((i % 2 ? 1 : -1) * (v.L * 0.18 + 0.6));
      const p = v.pos.clone().add(side).addScaledVector(v.fwd(), (Math.floor(i / 2) - 0.5) * 1.6);
      const h = H.spawn({ role, x: p.x, y: 0, z: p.z, rot: v.yaw, outside: true });
      if (h) { h.noticed = true; h.state = role === 'hazmat' ? 'catch' : 'shoot'; h.timer = 60; this.peds.push(h); }
    }
  }
  // a shell / missile flying at you (fast, visible, dodgeable when you're small)
  shell(from, P, cause, dmg) { this.shells.push({ p: from.clone(), v: _v.subVectors(P.pos, from).normalize().multiplyScalar(220).clone(), life: 6, cause, dmg, kind: 'shell' }); }
  missile(from, P, dmg) { this.shells.push({ p: from.clone(), v: _v.subVectors(P.pos, from).normalize().multiplyScalar(90).clone(), life: 10, cause: 'missile', dmg, kind: 'missile', target: P }); this.game.audio.at && this.game.audio.at('missile', from); }
  updateShells(dt) {
    const G = this.game, P = G.player;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const S = this.shells[i]; S.life -= dt;
      if (S.kind === 'missile' && P) { const want = _v.subVectors(P.pos, S.p).normalize().multiplyScalar(S.v.length() * 1.02); S.v.lerp(want, Math.min(1, dt * 1.5)); }
      S.p.addScaledVector(S.v, dt);
      G.fx.add(S.p, _v.set(0, 0, 0), S.kind === 'missile' ? 1.2 : 0.25, S.kind === 'missile' ? 0.9 : 0.35, S.kind === 'missile' ? [0.85, 0.85, 0.85, 0.35] : [1, 0.8, 0.4, 0.9], { grow: 2, drag: 1 });
      const hitR = P ? Math.max(2, P.s * 0.6) : 2;
      let boom = S.life <= 0 || S.p.y < this.groundY(S.p);
      if (P && S.p.distanceTo(P.pos) < hitR) { boom = true; P.hurt(S.dmg, S.cause === 'missile' ? 'blown up by a missile' : 'hit by a tank shell'); G.cam.addShake(0.5); }
      if (boom) { G.fx.shockwave(S.p, 3, [1, 0.6, 0.2, 0.8]); G.fx.sparks(S.p, 1.5, 30, [1, 0.6, 0.2, 1]); G.audio.at && G.audio.at('explosion', S.p); this.shells.splice(i, 1); }
    }
  }
  update(dt) {
    const G = this.game, P = G.player && G.state !== 'dead' ? G.player : null;
    this.updateShells(dt);
    if (!P) return;
    const Z = this.zone;
    const outside = !Z.inside(P.pos) || P.pos.y < 9;
    const s = P.sizeM;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    // ---- traffic around you (only outside, while cars still matter at your size)
    const cars = this.vehicles.filter(v => !v.def.boat && !v.def.air && v.state !== 'parked');
    const wantCars = outside && s < 600 ? Math.round((G.renderer.q.crowd || 1) * 14) : 0;
    for (const v of cars) if (v.pos.distanceTo(P.pos) > Math.max(520, s * 40) && v.state !== 'dead' && !v.wrapped) { v.remove(); v.state = 'eaten'; }
    if (cars.length < wantCars) { const kind = Math.random() < 0.1 ? 'bus' : Math.random() < 0.12 ? 'truck' : pick(['sedan', 'sedan', 'hatch', 'suv', 'taxi', 'taxi', 'sports']); this.spawnCar(kind, P.pos, 120 + s * 3, 380 + s * 8); }
    // ---- people on the sidewalks
    this.peds = this.peds.filter(h => h.state !== 'gone' && h.state !== 'eaten');
    for (const h of this.peds) if (h.pos.distanceTo(P.pos) > Math.max(150, s * 30) && !h.helpless) h.leave();
    const wantPeds = outside && s < 250 ? Math.round((G.renderer.q.crowd || 1) * 10) : 0;
    if (this.peds.filter(h => h.role === 'citizen').length < wantPeds) this.spawnPed(P.pos);
    // ---- animals
    this.groups = this.groups.filter(g => {
      const far = Math.hypot(g.x - P.pos.x, g.z - P.pos.z) > 260;
      if (far) { for (const c of g.alive) if (c.state !== 'eaten') { c.root.removeFromParent(); c.state = 'eaten'; } const gi = Z.creatures.groups.indexOf(g); if (gi >= 0) Z.creatures.groups.splice(gi, 1); }
      return !far;
    });
    if (outside && s < 40 && this.groups.length < 4) this.spawnAnimals(P.pos);
    // ---- who's coming for you
    this.respond(P, outside);
    // ---- buildings become food when you're big
    this.buildingPrey(P);
  }
  spawnPed(near) {
    const H = this.zone.humans; if (!H || !H.ready) return;
    const ang = rand(0, Math.PI * 2), d = rand(40, 110);
    const bi = Math.round((near.x + Math.cos(ang) * d) / PITCH), bj = Math.round((near.z + Math.sin(ang) * d) / PITCH);
    const cx = bi * PITCH, cz = bj * PITCH; if (cx + 45 > SHORE || Math.abs(bi) > NB || Math.abs(bj) > NB) return;
    const r = 43.4, cw = Math.random() < 0.5;
    const ring = [[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]]; if (cw) ring.reverse();
    const k = Math.floor(rand(0, 4)), t = rand(0, 1);
    const a = ring[k], b = ring[(k + 1) % 4];
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    const path = []; for (let i = 1; i <= 4; i++) path.push(ring[(k + i) % 4]);
    const h = H.spawn({ role: 'citizen', x, y: CURB, z, rot: Math.atan2(b[0] - a[0], b[1] - a[1]), path, outside: true });
    if (h) { h.pathI = 0; this.peds.push(h); }
  }
  spawnAnimals(near) {
    const Z = this.zone, night = !Z.sky || Z.sky.dayAmount < 0.3;
    const ang = rand(0, Math.PI * 2), d = rand(25, 70);
    const x = near.x + Math.cos(ang) * d, z = near.z + Math.sin(ang) * d;
    if (x > SHORE - 10 || (Math.abs(x) < 23 && Math.abs(z) < 23)) return;
    const r = Math.random();
    const g = r < 0.4 ? { kind: 'pigeon', n: 6 + Math.floor(rand(0, 8)), r: 4 } : r < 0.6 ? { kind: 'rat', n: 3, r: 3 } : r < 0.75 ? { kind: night ? 'raccoon' : 'cat', n: 1 + Math.floor(rand(0, 2)), r: 3 } : r < 0.9 ? { kind: 'cat', n: 1, r: 2 } : { kind: 'dog', n: 1, r: 4 };
    Object.assign(g, { x, y: CURB, z });
    Z.creatures.spawnGroup(g);
    this.groups.push(Z.creatures.groups[Z.creatures.groups.length - 1]);
  }
  respond(P, outside) {
    const W = this.game.wanted, lv = W.level, s = P.sizeM;
    if (!outside) return;
    const count = (k) => this.vehicles.filter(v => v.kind === k && v.state !== 'dead' && v.state !== 'eaten').length;
    this.respT -= 0.5;
    if (this.respT > 0) return;
    this.respT = 6;
    if (lv >= 2 && count('van') < 1 && s < 30) this.spawnCar('van', P.pos, 150, 320, true);
    if (lv >= 3 && count('cop') < 2 + (lv >= 4 ? 2 : 0) && s < 80) this.spawnCar('cop', P.pos, 150, 320, true);
    if (lv >= 5 && count('tank') < 2 && s > 3 && s < 400) this.spawnCar('tank', P.pos, 180, 360, true);
    if (lv >= 5 && count('armytruck') < 1 && s < 200) this.spawnCar('armytruck', P.pos, 180, 360, true);
    if (lv >= 5 && count('heli') < 2 && s > 2) this.add(new Vehicle(this, 'heli', { pos: P.pos.clone().add(new THREE.Vector3(rand(-400, 400), 150, rand(-400, 400))), alt: 60, orbitR: 140 }));
    if (lv >= 6 && count('jet') < 2 && s > 10) this.add(new Vehicle(this, 'jet', { pos: P.pos.clone().add(new THREE.Vector3(rand(-1500, 1500), 300, rand(-1500, 1500))), alt: 200 }));
    if (lv >= 5 && count('destroyer') < 1 && s > 20) this.add(new Vehicle(this, 'destroyer', { pos: new THREE.Vector3(SHORE + 500, -2.5, rand(-1500, 1500)), speed: 6 }));
    if (lv >= 3 && count('newsheli') < 1 && s > 1) this.add(new Vehicle(this, 'newsheli', { pos: P.pos.clone().add(new THREE.Vector3(rand(-300, 300), 120, rand(-300, 300))), alt: 90, orbitR: 220 }));
  }
  buildingPrey(P) {
    const s = P.sizeM;
    if (s < 12 || !this.city.blds) { for (const bp of this.bprey.values()) this.dropProxy(bp); return; }
    const reach = s * 2.5;
    // drop proxies that are far away now
    for (const bp of [...this.bprey.values()]) { const b = bp.b; if (Math.hypot(b.x - P.pos.x, b.z - P.pos.z) > Math.max(b.w, b.d) / 2 + reach * 1.5) this.dropProxy(bp); }
    for (const b of this.city.blds) {
      if (b.gone || this.bprey.has(b)) continue;
      if (Math.hypot(b.x - P.pos.x, b.z - P.pos.z) > Math.max(b.w, b.d) / 2 + reach) continue;
      if (this.bprey.size > 10) break;
      const bp = new BuildingPrey(this, b); this.bprey.set(b, bp); this.zone.creatures.list.push(bp);
    }
  }
  dropProxy(bp) { this.bprey.delete(bp.b); const L = this.zone.creatures.list, i = L.indexOf(bp); if (i >= 0) L.splice(i, 1); }
}
