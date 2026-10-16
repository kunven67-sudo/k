// Draw sinks for bodies. InstancedSink draws every person with ~40 draw calls total.
// MeshSink draws one body with normal meshes (player model, the experiment table cut-away).
import * as THREE from 'three';
import { buildParts, PARTS, HAIR_STYLES, HATS } from './parts.js';

const PART_MULT = {
  torso: 1, half: 2, pelvis: 1, head: 1, eye: 2, pupil: 2, brow: 2, mouth: 1, nose: 1, ear: 2,
  upperArm: 2, forearm: 2, hand: 2, thigh: 2, shin: 2, foot: 2, shoulder: 2, stump: 8,
  beard: 1, mustache: 1, glasses: 1, goggles: 1, skirt: 1, coat: 1, pack: 1,
};
for (const h of HAIR_STYLES) if (h !== 'bald') PART_MULT['hair_' + h] = 1;
for (const h of HATS) PART_MULT['hat_' + h] = 1;

const SHINY = new Set(['eye', 'pupil', 'glasses', 'goggles', 'mouth']);
const NO_SHADOW = new Set(['eye', 'pupil', 'brow', 'mouth', 'nose', 'ear', 'glasses', 'mustache', 'stump']);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Parts everyone has are stored densely (slot * mult + i). Optional parts (hair styles, hats, beards,
// glasses, stumps, cut-in-half torsos...) get their own small packed list, so 40 hair styles nobody
// is wearing don't cost the GPU anything.
const DENSE = new Set(['torso', 'pelvis', 'head', 'eye', 'pupil', 'brow', 'mouth', 'nose', 'ear', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'shoulder']);

export class InstancedSink {
  constructor(scene, capacity = 96) {
    buildParts();
    this.scene = scene;
    this.cap = capacity;
    this.meshes = {};
    this.free = [];
    this.used = 0;
    this.sparse = {};   // key -> {cap, map: Map(slot*16+i -> idx), free: [], top}
    this.matte = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
    this.shiny = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.05 });
    for (const key of Object.keys(PART_MULT)) if (!DENSE.has(key)) this.sparse[key] = { cap: 16, map: new Map(), free: [], top: 0 };
    for (const key of Object.keys(PART_MULT)) this.makeMesh(key);
  }

  capOf(key) { return DENSE.has(key) ? this.cap * PART_MULT[key] : this.sparse[key].cap; }

  makeMesh(key) {
    const old = this.meshes[key];
    const n = this.capOf(key);
    const m = new THREE.InstancedMesh(PARTS[key], SHINY.has(key) ? this.shiny : this.matte, n);
    m.frustumCulled = false;
    m.castShadow = !NO_SHADOW.has(key);
    m.receiveShadow = key === 'torso' || key === 'head';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    for (let i = 0; i < n; i++) m.setMatrixAt(i, ZERO);
    if (old) {
      // copy old data into the bigger buffers
      m.instanceMatrix.array.set(old.instanceMatrix.array);
      m.instanceColor.array.set(old.instanceColor.array);
      this.scene.remove(old);
      old.dispose();
    }
    m.userData.part = key;
    m.count = 0;
    this.meshes[key] = m;
    this.scene.add(m);
  }

  alloc() {
    if (this.free.length) return this.free.pop();
    if (this.used >= this.cap) { this.cap *= 2; for (const k of DENSE) this.makeMesh(k); }
    return this.used++;
  }

  release(slot) {
    for (const key of DENSE) { const mult = PART_MULT[key]; for (let i = 0; i < mult; i++) this.meshes[key].setMatrixAt(slot * mult + i, ZERO); }
    for (const [key, sp] of Object.entries(this.sparse)) {
      for (let i = 0; i < PART_MULT[key]; i++) {
        const id = slot * 16 + i;
        const idx = sp.map.get(id);
        if (idx === undefined) continue;
        this.meshes[key].setMatrixAt(idx, ZERO);
        sp.map.delete(id); sp.free.push(idx);
      }
    }
    this.free.push(slot);
  }

  // index of (slot, i) in a mesh; optional parts get a packed index the first time they're used
  idx(key, slot, i, make) {
    if (DENSE.has(key)) return slot * PART_MULT[key] + i;
    const sp = this.sparse[key];
    if (!sp) return -1;
    const id = slot * 16 + i;
    let k = sp.map.get(id);
    if (k !== undefined || !make) return k ?? -1;
    if (sp.free.length) k = sp.free.pop();
    else {
      if (sp.top >= sp.cap) { sp.cap *= 2; this.makeMesh(key); }
      k = sp.top++;
    }
    sp.map.set(id, k);
    // a new packed instance takes this slot's color for that part
    const c = sp.colors && sp.colors.get(id);
    if (c) { this.meshes[key].setColorAt(k, c); this.meshes[key].instanceColor.needsUpdate = true; }
    return k;
  }

  set(key, slot, i, m) { const mesh = this.meshes[key]; if (!mesh) return; const k = this.idx(key, slot, i, true); if (k >= 0) mesh.setMatrixAt(k, m); }
  hide(key, slot, i) { const mesh = this.meshes[key]; if (!mesh) return; const k = this.idx(key, slot, i, false); if (k >= 0) mesh.setMatrixAt(k, ZERO); }
  color(key, slot, i, c) {
    const mesh = this.meshes[key];
    if (!mesh) return;
    const sp = this.sparse[key];
    if (sp) { (sp.colors ||= new Map()).set(slot * 16 + i, c.clone()); }
    const k = this.idx(key, slot, i, false);
    if (k >= 0) { mesh.setColorAt(k, c); mesh.instanceColor.needsUpdate = true; }
  }

  flush() {
    // only draw what's in use (empty instances would still cost vertices on the GPU)
    for (const [key, m] of Object.entries(this.meshes)) { m.count = DENSE.has(key) ? this.used * PART_MULT[key] : this.sparse[key].top; m.instanceMatrix.needsUpdate = true; }
  }

  setVisible(v) { for (const m of Object.values(this.meshes)) m.visible = v; }
}

// Normal meshes, one body. Same API as InstancedSink (slot is ignored).
export class MeshSink {
  constructor(parent) {
    buildParts();
    this.group = new THREE.Group();
    parent.add(this.group);
    this.meshes = new Map();
    this.colors = new Map();
    this.clip = null;
  }
  get(key, i) {
    const id = key + i;
    let m = this.meshes.get(id);
    if (!m) {
      const mat = new THREE.MeshStandardMaterial({ roughness: SHINY.has(key) ? 0.18 : 0.62, color: this.colors.get(id) || 0xffffff });
      if (this.clip && (key === 'torso' || key === 'head' || key === 'half' || key === 'pelvis' || key === 'coat' || key === 'skirt' || key.startsWith('hair_') || key.startsWith('hat_'))) {
        mat.clippingPlanes = this.clip; mat.side = THREE.DoubleSide;
      }
      m = new THREE.Mesh(PARTS[key], mat);
      m.matrixAutoUpdate = false;
      m.castShadow = !NO_SHADOW.has(key);
      m.receiveShadow = true;
      this.group.add(m);
      this.meshes.set(id, m);
    }
    return m;
  }
  alloc() { return 0; }
  release() { this.dispose(); }
  set(key, slot, i, mtx) { const m = this.get(key, i); m.matrix.copy(mtx); m.visible = true; }
  hide(key, slot, i) { const m = this.meshes.get(key + i); if (m) m.visible = false; }
  color(key, slot, i, c) { this.colors.set(key + i, c.getHex()); const m = this.meshes.get(key + i); if (m) m.material.color.copy(c); }
  flush() {}
  setClip(planes) {
    this.clip = planes;
    for (const [id, m] of this.meshes) {
      const key = id.replace(/\d+$/, '');
      if (key === 'torso' || key === 'head' || key === 'half' || key === 'pelvis' || key === 'coat' || key === 'skirt' || key.startsWith('hair_') || key.startsWith('hat_')) {
        m.material.clippingPlanes = planes; m.material.side = planes ? THREE.DoubleSide : THREE.FrontSide; m.material.needsUpdate = true;
      }
    }
  }
  dispose() {
    for (const m of this.meshes.values()) m.material.dispose();
    this.group.removeFromParent();
    this.meshes.clear();
  }
}
