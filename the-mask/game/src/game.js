// THE MASK - shared game state + small helpers every module uses.
import * as THREE from 'three';

export const G = {
  t: 0, dt: 0, frame: 0,
  scene: null, renderer: null, camera: null,
  xr: false,          // in VR right now
  touch: false,       // phone controls on
  started: false,     // left the title screen
  wearing: false,     // the mask is on your face (the loop runs)
  paused: false,      // a menu is open on PC/phone
  entities: new Set(),
  // filled by the modules at boot
  room: null, physics: null, props: null, people: null, gadgets: null, player: null, loop: null, fx: null,
  blood: null, audio: null, ui: null, quality: null
};

export const V = () => new THREE.Vector3();
export const Q = () => new THREE.Quaternion();
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
export const lerp = (a, b, t) => a + (b - a) * t;

// event bus: modules talk without importing each other in circles
const subs = {};
export function on(name, fn) { (subs[name] = subs[name] || []).push(fn); }
export function emit(name, ...args) { for (const f of subs[name] || []) { try { f(...args); } catch (e) { console.error(name, e); } } }

// Game System 3 trophies (does nothing outside Game System 3)
const TROPHIES = [
  { id: 'mask', name: 'Face Time', desc: 'Put on the mask.', grade: 'bronze' },
  { id: 'copy1', name: 'Hello, Me', desc: 'Make your first copy.', grade: 'bronze' },
  { id: 'copies8', name: 'Full House', desc: 'Have 8 copies of you in the room at once.', grade: 'gold' },
  { id: 'voice', name: 'Talking to Myself', desc: 'Make a copy that talks.', grade: 'bronze' },
  { id: 'punchme', name: 'Self Defense', desc: 'Punch one of your copies.', grade: 'bronze' },
  { id: 'blackhole', name: 'Event Horizon', desc: 'Feed something to a black hole.', grade: 'silver' },
  { id: 'freeze', name: 'Stop Right There', desc: 'Stop something in mid-air.', grade: 'bronze' },
  { id: 'size', name: 'Big and Small', desc: 'Make something giant, then tiny.', grade: 'bronze' },
  { id: 'clone', name: 'Copy Machine', desc: 'Clone something with the Copy Ray.', grade: 'bronze' },
  { id: 'float', name: 'No Gravity', desc: 'Make a person float.', grade: 'bronze' },
  { id: 'teamwork', name: 'Teamwork', desc: 'You and a copy hit the same person.', grade: 'silver' },
  { id: 'throw', name: 'Yeet', desc: 'Throw a person.', grade: 'bronze' }
];
const got = new Set();
export function trophiesInit() {
  try { if (window.GameSystem && GameSystem.trophies) GameSystem.trophies(TROPHIES); } catch (e) { /* not in GS3 */ }
}
export function unlock(id) {
  if (got.has(id)) return; got.add(id);
  try { if (window.GameSystem && GameSystem.unlock) GameSystem.unlock(id); } catch (e) { /* not in GS3 */ }
}

// merge every non-moving mesh under `root` that shares a material into one mesh (fewer draw calls in VR).
// Meshes marked userData.keep (moving parts like clock hands) are left alone.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.keep) return;
    let p = o.parent, kept = false;
    while (p && p !== root) { if (p.userData.keep) kept = true; p = p.parent; }
    if (kept) return;
    const k = o.material.uuid;
    if (!groups.has(k)) groups.set(k, { mat: o.material, list: [] });
    groups.get(k).list.push(o);
  });
  for (const { mat, list } of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, mat);
    mm.castShadow = list.some((m) => m.castShadow); mm.receiveShadow = true;
    for (const m of list) m.parent.remove(m);
    root.add(mm);
  }
  return root;
}
