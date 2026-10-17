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
      // the scans' glass shares the opaque body texture, so it would hide what's behind it
      if (m && /glass/i.test(m.name)) { o.material = glassMat(); o.castShadow = false; }
    }
  });
  return s;
}

let _glass;
export function glassMat() {
  return _glass ||= new THREE.MeshStandardMaterial({ name: 'glass', color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.6 });
}

// Real-time clock hands on a scanned clock. Works out where each hand points right now so we
// can turn it to any time: hands turn clockwise around the face normal seen from the front.
export function clockHands(root, names, pivot, normal) {
  const hands = [];
  root.updateMatrixWorld(true);
  for (const [key, name] of Object.entries(names)) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    const parent = node.parent;
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    // farthest vertex from the pivot = the tip
    let best = 0; const tip = new THREE.Vector3(), v = new THREE.Vector3();
    node.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        const d = v.clone().sub(pivot); d.addScaledVector(normal, -d.dot(normal));
        if (d.lengthSq() > best) { best = d.lengthSq(); tip.copy(d); }
      }
    });
    const up = new THREE.Vector3(0, 1, 0), right = up.clone().cross(normal);
    const a0 = Math.atan2(tip.dot(right), tip.dot(up));
    // rotate around the pivot: wrap the hand in a pivot group
    const pg = new THREE.Group();
    pg.position.copy(pivot);
    parent.add(pg);
    node.position.sub(pivot);
    pg.add(node);
    hands.push({ key, pg, a0 });
  }
  const q = new THREE.Quaternion();
  return {
    set(date) {
      const s = date.getSeconds() + date.getMilliseconds() / 1000, m = date.getMinutes() + s / 60, h = (date.getHours() % 12) + m / 60;
      const ang = { hour: h / 12, minute: m / 60, second: Math.floor(s) / 60 };
      for (const hd of hands) {
        const a = ang[hd.key] * Math.PI * 2;
        hd.pg.quaternion.copy(q.setFromAxisAngle(normal, -(a - hd.a0)));
      }
    },
  };
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
