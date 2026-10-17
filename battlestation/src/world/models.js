import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getBuffer } from '../core/assets.js';

const loader = new GLTFLoader();
const cache = new Map();

// Loads a GLB from the embedded assets. Returns a fresh copy each time (shares geometry/materials).
export async function model(name) {
  if (!cache.has(name)) {
    cache.set(name, getBuffer(name.endsWith('.glb') ? name : `models/${name}.glb`).then(buf =>
      new Promise((res, rej) => loader.parse(buf, '', res, rej))));
  }
  const gltf = await cache.get(name);
  const s = gltf.scene.clone(true);
  s.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (m && m.map) m.map.anisotropy = 8;
    }
  });
  return s;
}

export async function gltfRaw(name) {
  if (!cache.has(name)) cache.set(name, getBuffer(name).then(buf => new Promise((res, rej) => loader.parse(buf, '', res, rej))));
  return cache.get(name);
}

// Place a model: scale it so its biggest horizontal size (or height) matches the real-life size,
// stand it on y, rotate, and optionally add a collision box + make it block the use-ray.
export function place(ctx, obj, o) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  let s = 1;
  if (o.height) s = o.height / size.y;
  else if (o.width) s = o.width / Math.max(size.x, size.z);
  else if (o.scale) s = o.scale;
  obj.scale.multiplyScalar(s);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  wrap.add(obj);
  obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  wrap.position.set(o.x, o.y ?? 0, o.z);
  wrap.rotation.y = o.rot || 0;
  (o.parent || ctx.scene).add(wrap);
  wrap.updateMatrixWorld(true);
  if (o.collide !== false) {
    const sz = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    // collision box in the model's own rotation (sizes before rotation)
    const ls = new THREE.Vector3(size.x * s, size.y * s, size.z * s);
    const pad = o.pad ?? 0;
    ctx.physics.add({ x: o.x, z: o.z, hx: ls.x / 2 + pad, hz: ls.z / 2 + pad, y0: o.y ?? 0, y1: (o.y ?? 0) + ls.y, rot: o.rot || 0 });
    void sz;
  }
  if (o.block !== false) ctx.interact.block(wrap);
  wrap.userData.size = new THREE.Vector3(size.x * s, size.y * s, size.z * s);
  return wrap;
}
