// THE MASK - stuff: furniture and things you can spawn, grab, throw, shoot, freeze, grow, float, clone and feed to
// a black hole. Each one is a KayKit model (CC0) on a physics box.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { G, clamp, emit } from './game.js';
import { world, CANNON, GROUP, toV3, toQ, addStaticBox } from './physics.js';
import { toon, toonify, PAL } from './toon.js';
import { audio } from './audio.js';
import { maskStand } from './room.js';

export const CATALOG = [
  { id: 'chair', name: 'Chair', file: 'kaykit/chair_A_wood.gltf', s: 0.74 },
  { id: 'stool', name: 'Stool', file: 'kaykit/chair_stool_wood.gltf', s: 0.74 },
  { id: 'armchair', name: 'Armchair', file: 'kaykit/armchair_pillows.gltf', s: 0.74 },
  { id: 'couch', name: 'Couch', file: 'kaykit/couch_pillows.gltf', s: 0.7 },
  { id: 'table', name: 'Table', file: 'kaykit/table_small.gltf', s: 0.76 },
  { id: 'bench', name: 'Bench', file: 'kk_halloween/bench.gltf', s: 0.55 },
  { id: 'lamp', name: 'Lamp', file: 'kaykit/lamp_table.gltf', s: 0.36 },
  { id: 'floorlamp', name: 'Floor lamp', file: 'kaykit/lamp_standing.gltf', s: 0.7 },
  { id: 'books', name: 'Books', file: 'kaykit/book_set.gltf', s: 0.5 },
  { id: 'book', name: 'Book', file: 'kaykit/book_single.gltf', s: 0.55 },
  { id: 'pillow', name: 'Pillow', file: 'kaykit/pillow_A.gltf', s: 0.35 },
  { id: 'cactus', name: 'Cactus', file: 'kaykit/cactus_medium_A.gltf', s: 0.5 },
  { id: 'candles', name: 'Candles', file: 'kk_halloween/candle_triple.gltf', s: 0.3 },
  { id: 'skullcandle', name: 'Skull candle', file: 'kk_halloween/skull_candle.gltf', s: 0.35 },
  { id: 'lantern', name: 'Lantern', file: 'kk_halloween/lantern_standing.gltf', s: 0.45 },
  { id: 'pumpkin', name: 'Pumpkin', file: 'kk_halloween/pumpkin_orange_jackolantern.gltf', s: 0.45 },
  { id: 'skull', name: 'Skull', file: 'kk_halloween/skull.gltf', s: 0.4 },
  { id: 'cabinet', name: 'Cabinet', file: 'kaykit/cabinet_small_decorated.gltf', s: 0.7 },
  { id: 'ball', name: 'Ball', ball: true }
];
const byId = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
const loader = new GLTFLoader();
const cache = new Map();
let BASE = '';
export function initProps(base, manager) { BASE = base; loader.manager = manager; }

async function model(def) {
  if (def.ball) return ballModel();
  if (!cache.has(def.file)) cache.set(def.file, loader.loadAsync(BASE + 'assets/' + def.file).then((gl) => toonify(gl.scene)));
  const src = await cache.get(def.file);
  const o = src.clone(true); o.scale.setScalar(def.s);
  return o;
}
let ballTex = null;
function ballModel() {
  if (!ballTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const k = c.getContext('2d');
    const cols = ['#f1e7d0', '#2c8c87', '#e2a63b', '#c2475a', '#f1e7d0', '#2c8c87', '#e2a63b', '#c2475a'];
    cols.forEach((col, i) => { k.fillStyle = col; k.fillRect(i * 32, 0, 32, 128); });
    k.fillStyle = '#fff'; k.beginPath(); k.arc(0, 0, 18, 0, 7); k.arc(256, 0, 18, 0, 7); k.fill(); k.fillRect(0, 0, 256, 6); k.fillRect(0, 122, 256, 6);
    ballTex = new THREE.CanvasTexture(c); ballTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), toon({ map: ballTex }));
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}

const _box = new THREE.Box3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion();
let nextId = 1;

export class Prop {
  constructor(def, mdl, { pos, quat, spawned = true, sphere = false } = {}) {
    this.kind = 'prop'; this.uid = nextId++; this.def = def; this.spawned = spawned;
    this.size = 1; this.floating = false; this.frozen = 0; this.held = null; this.removed = false; this.eating = 0;
    // measure the model with no turn, center it on its box
    const q0 = mdl.quaternion.clone(); mdl.quaternion.identity(); mdl.position.set(0, 0, 0); mdl.updateMatrixWorld(true);
    _box.setFromObject(mdl);
    const c = _box.getCenter(new THREE.Vector3());
    this.half = _box.getSize(new THREE.Vector3()).multiplyScalar(0.5).max(new THREE.Vector3(0.025, 0.025, 0.025));
    this.obj = new THREE.Group(); this.obj.name = 'prop-' + (def.id || 'thing');
    mdl.position.copy(c).negate(); this.obj.add(mdl); this.model = mdl;
    this.obj.userData.ent = this;
    if (pos) this.obj.position.copy(pos);
    this.obj.quaternion.copy(quat || q0);
    this.sphere = sphere;
    this.baseMass = def.mass || clamp(8 * this.half.x * this.half.y * this.half.z * 70, 0.25, 45);
    this.body = new CANNON.Body({
      mass: this.baseMass, material: undefined, linearDamping: 0.04, angularDamping: 0.08, allowSleep: true,
      sleepSpeedLimit: 0.12, sleepTimeLimit: 0.5, collisionFilterGroup: GROUP.PROP, collisionFilterMask: GROUP.ROOM | GROUP.PROP | GROUP.PERSON | GROUP.HAND
    });
    this.setShape(1);
    this.body.position.set(this.obj.position.x, this.obj.position.y, this.obj.position.z);
    this.body.quaternion.set(this.obj.quaternion.x, this.obj.quaternion.y, this.obj.quaternion.z, this.obj.quaternion.w);
    this.body.ent = this;
    let last = 0;
    this.body.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.4 && G.t - last > 0.09) { last = G.t; audio.play(this.baseMass < 1 ? 'tap' : 'thud', this.obj.position, clamp(v / 7, 0.12, 1) * clamp(this.baseMass / 6, 0.35, 1)); }
      emit('impact', this, e.body && e.body.ent, v);
    });
    this.attach();
  }
  get pos() { return this.obj.position; }
  get radius() { return Math.max(this.half.x, this.half.y, this.half.z) * this.size; }
  setShape(s) {
    const b = this.body;
    while (b.shapes.length) b.removeShape(b.shapes[0]);
    if (this.sphere) b.addShape(new CANNON.Sphere(this.half.x * s));
    else b.addShape(new CANNON.Box(new CANNON.Vec3(this.half.x * s, this.half.y * s, this.half.z * s)));
    b.mass = clamp(this.baseMass * s * s * s, 0.08, 400);
    b.updateMassProperties(); b.aabbNeedsUpdate = true;
  }
  attach() { if (!this.obj.parent) G.scene.add(this.obj); if (!this.body.world) world.addBody(this.body); this.removed = false; G.entities.add(this); }
  detach() { if (this.obj.parent) this.obj.parent.remove(this.obj); if (this.body.world) world.removeBody(this.body); this.removed = true; G.entities.delete(this); }
  sync() {
    if (this.removed) return;
    const b = this.body;
    if (this.held) return; // the hand moves it
    toV3(b.interpolatedPosition || b.position, this.obj.position); toQ(b.interpolatedQuaternion || b.quaternion, this.obj.quaternion);
    if (this.obj.position.y < -2) { b.position.set(0, 1.2, 0); b.velocity.setZero(); } // fell out of the world somehow
  }
  wake() { this.body.wakeUp(); }
  impulse(dir, k, point) {
    if (this.frozen || this.held) return;
    this.body.wakeUp();
    const rp = point ? new CANNON.Vec3(point.x - this.body.position.x, point.y - this.body.position.y, point.z - this.body.position.z) : new CANNON.Vec3();
    this.body.applyImpulse(new CANNON.Vec3(dir.x * k, dir.y * k, dir.z * k), rp);
  }
  // hand control
  grab(hand) {
    this.held = hand; this.body.type = CANNON.Body.KINEMATIC; this.body.velocity.setZero(); this.body.angularVelocity.setZero(); this.body.wakeUp();
    if (this.frozen) this.frozen = 0;
    this.body.collisionFilterMask = GROUP.ROOM | GROUP.PROP | GROUP.PERSON;
    this.body.collisionFilterGroup = GROUP.HAND; // still shoves things, but your own shots fly through it
  }
  holdAt(pos, quat, vel) {
    this.obj.position.copy(pos); this.obj.quaternion.copy(quat);
    this.body.position.set(pos.x, pos.y, pos.z); this.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    if (vel) this.body.velocity.set(vel.x, vel.y, vel.z);
  }
  release(vel, ang) {
    this.held = null; this.body.type = CANNON.Body.DYNAMIC; this.body.updateMassProperties();
    this.body.collisionFilterMask = GROUP.ROOM | GROUP.PROP | GROUP.PERSON | GROUP.HAND; this.body.collisionFilterGroup = GROUP.PROP;
    if (vel) this.body.velocity.set(vel.x, vel.y, vel.z);
    if (ang) this.body.angularVelocity.set(ang.x, ang.y, ang.z);
    this.body.wakeUp();
  }
  // gadgets
  freeze(sec = 8) {
    if (this.held) return;
    if (!this.frozen) { this.saved = { v: this.body.velocity.clone(), w: this.body.angularVelocity.clone() }; this.body.type = CANNON.Body.KINEMATIC; this.body.velocity.setZero(); this.body.angularVelocity.setZero(); }
    this.frozen = sec; tint(this.obj, 0x9fd8ff, 0.35);
  }
  unfreeze() {
    if (!this.frozen) return; this.frozen = 0; tint(this.obj, 0, 0);
    this.body.type = CANNON.Body.DYNAMIC; this.body.updateMassProperties();
    if (this.saved) { this.body.velocity.copy(this.saved.v); this.body.angularVelocity.copy(this.saved.w); }
    this.body.wakeUp(); audio.play('unfreeze', this.obj.position, 0.6);
  }
  setSize(s) {
    const old = this.size; this.size = s; this.obj.scale.setScalar(s); this.setShape(s);
    if (s > old) this.body.position.y += (s - old) * this.half.y;
    this.body.wakeUp();
  }
  setFloat(on) { this.floating = on; this.body.wakeUp(); if (!on) this.body.linearDamping = 0.04; else this.body.linearDamping = 0.6; }
  update(dt) {
    if (this.frozen) { this.frozen -= dt; if (this.frozen <= 0) { this.frozen = 0.0001; this.unfreeze(); } }
  }
  snapshot() {
    const b = this.body;
    return { present: !this.removed, p: b.position.clone(), q: b.quaternion.clone(), v: b.velocity.clone(), w: b.angularVelocity.clone(), size: this.size, floating: this.floating, sleeping: b.sleepState === CANNON.Body.SLEEPING };
  }
  restore(s) {
    if (this.held) return;
    if (this.frozen) this.unfreeze();
    if (!s.present) { this.detach(); return; }
    this.attach(); this.eating = 0; this.model.visible = true;
    if (this.size !== s.size) this.setSize(s.size);
    this.setFloat(s.floating);
    const b = this.body; b.type = CANNON.Body.DYNAMIC; b.updateMassProperties();
    b.position.copy(s.p); b.quaternion.copy(s.q); b.velocity.copy(s.v); b.angularVelocity.copy(s.w);
    b.previousPosition.copy(s.p); b.interpolatedPosition.copy(s.p); b.interpolatedQuaternion.copy(s.q);
    if (s.sleeping) b.sleep(); else b.wakeUp();
    this.sync();
  }
}

function tint(obj, color, k) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; o.userData.emis = o.material.emissive.clone(); }
    o.material.emissive.copy(o.userData.emis).lerp(new THREE.Color(color), k);
  });
}
export { tint };

/* ---------- the list of all props ---------- */
export const props = {
  list: [],
  async spawn(id, pos, yaw = 0, opts = {}) {
    const def = byId[id]; if (!def) return null;
    const mdl = await model(def);
    const p = new Prop(def, mdl, { pos, quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), sphere: !!def.ball, ...opts });
    this.list.push(p);
    return p;
  },
  // wrap the room's own furniture
  adopt(obj, def, opts = {}) {
    obj.parent && obj.parent.remove(obj);
    const pos = obj.position.clone(), q = obj.quaternion.clone();
    const p = new Prop(def, obj, { spawned: false, ...opts });
    // put it back exactly where it stood
    p.obj.quaternion.copy(q);
    const c = p.model.position.clone().negate().applyQuaternion(q);
    p.obj.position.copy(pos).add(c);
    p.body.position.set(p.obj.position.x, p.obj.position.y, p.obj.position.z);
    p.body.quaternion.set(q.x, q.y, q.z, q.w);
    p.body.sleep();
    this.list.push(p);
    return p;
  },
  remove(p) { p.detach(); this.list = this.list.filter((x) => x !== p); },
  clearSpawned() { for (const p of this.list.slice()) if (p.spawned && !p.held && !p.special) this.remove(p); },
  update(dt) { for (const p of this.list) { p.update(dt); p.sync(); } },
  async clone(p) {
    if (!p.def.id) return null;
    const q = p.obj.position.clone().add(new THREE.Vector3(0, p.half.y * p.size + 0.15, 0));
    const c = await this.spawn(p.def.id, q, 0);
    if (c) { c.obj.quaternion.copy(p.obj.quaternion); c.body.quaternion.copy(p.body.quaternion); if (p.size !== 1) c.setSize(p.size); c.body.velocity.set((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2); }
    return c;
  }
};

// the room: furniture that moves gets a body, the rest becomes invisible walls
export function setupRoomProps(room) {
  for (const [id, obj] of Object.entries(room.furniture)) {
    const f = obj.userData.furniture;
    if (f.dynamic) props.adopt(obj, { id: f.id === 'candles' ? 'candles' : f.id, file: f.file, s: f.s, mass: f.id === 'armchair' ? 30 : undefined });
    else if (f.fixed) {
      obj.updateMatrixWorld(true);
      const r = obj.rotation.y; obj.rotation.y = 0; obj.updateMatrixWorld(true);
      _box.setFromObject(obj); obj.rotation.y = r; obj.updateMatrixWorld(true);
      const c = _box.getCenter(new THREE.Vector3()), h = _box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      const off = c.clone().sub(obj.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), r);
      addStaticBox(obj.position.clone().add(off), h, r);
    }
  }
  // the grandfather clock stands in the corner
  addStaticBox(new THREE.Vector3(-3 + 0.22, 1.12, -1.3), new THREE.Vector3(0.2, 1.12, 0.32), 0);
  // the mask's brass stand on the table
  const stand = maskStand(); stand.position.set(-0.17, 0.76, -0.52); stand.rotation.y = -0.42; stand.updateMatrixWorld(true);
  const sp = props.adopt(stand, { id: 'stand', mass: 1.2 });
  sp.special = true;
  return sp;
}
