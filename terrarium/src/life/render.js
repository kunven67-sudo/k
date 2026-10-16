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

export class InstancedSink {
  constructor(scene, capacity = 96) {
    buildParts();
    this.scene = scene;
    this.cap = capacity;
    this.meshes = {};
    this.free = [];
    this.used = 0;
    this.matte = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
    this.shiny = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.05 });
    this.build();
  }

  build() {
    for (const [key, mult] of Object.entries(PART_MULT)) {
      const old = this.meshes[key];
      const m = new THREE.InstancedMesh(PARTS[key], SHINY.has(key) ? this.shiny : this.matte, this.cap * mult);
      m.frustumCulled = false;
      m.castShadow = !NO_SHADOW.has(key);
      m.receiveShadow = key === 'torso' || key === 'head';
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const col = new Float32Array(this.cap * mult * 3).fill(1);
      m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
      for (let i = 0; i < this.cap * mult; i++) m.setMatrixAt(i, ZERO);
      if (old) {
        // copy old data into the bigger buffers
        m.instanceMatrix.array.set(old.instanceMatrix.array);
        m.instanceColor.array.set(old.instanceColor.array);
        this.scene.remove(old);
        old.dispose();
      }
      m.userData.part = key;
      this.meshes[key] = m;
      this.scene.add(m);
    }
  }

  alloc() {
    if (this.free.length) return this.free.pop();
    if (this.used >= this.cap) { this.cap *= 2; this.build(); }
    return this.used++;
  }

  release(slot) {
    for (const [key, mult] of Object.entries(PART_MULT)) for (let i = 0; i < mult; i++) this.meshes[key].setMatrixAt(slot * mult + i, ZERO);
    this.free.push(slot);
  }

  set(key, slot, i, m) { const mesh = this.meshes[key]; if (mesh) mesh.setMatrixAt(slot * PART_MULT[key] + i, m); }
  hide(key, slot, i) { const mesh = this.meshes[key]; if (mesh) mesh.setMatrixAt(slot * PART_MULT[key] + i, ZERO); }
  color(key, slot, i, c) { const mesh = this.meshes[key]; if (mesh) { mesh.setColorAt(slot * PART_MULT[key] + i, c); mesh.instanceColor.needsUpdate = true; } }

  flush() {
    // only draw the slots that are in use (empty slots would still cost vertices on the GPU)
    for (const [key, m] of Object.entries(this.meshes)) { m.count = this.used * PART_MULT[key]; m.instanceMatrix.needsUpdate = true; }
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
