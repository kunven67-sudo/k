// Loading the CC0 (Poly Haven) textures, models and HDR skies, with caching.
// Textures are scanned PBR sets: color + normal + ARM (R = ambient occlusion,
// G = roughness, B = metalness). Surfaces get UVs in meters, so a texture that
// covers 1 m of real concrete always shows 1 m, whatever the size of the wall.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const BASE = 'assets/cc0/';
const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const texCache = new Map();
const modelCache = new Map();
let index = null;

export async function loadIndex() {
  if (!index) {
    try {
      index = await (await fetch(`${BASE}index.json`)).json();
    } catch {
      index = { textures: {}, hdris: {}, models: {} };
      console.warn('[assets] no CC0 asset index; using plain materials');
    }
  }
  return index;
}

// Loads a texture once; copies (own repeat per material) all refresh when the image arrives.
function tex(path, { srgb = false, repeat = 1 } = {}) {
  const key = `${path}|${srgb}`;
  let entry = texCache.get(key);
  if (!entry) {
    entry = { base: null, copies: [], loaded: false };
    entry.base = texLoader.load(BASE + path, () => {
      entry.loaded = true;
      for (const c of entry.copies) c.needsUpdate = true;
    }, undefined, () => console.warn(`[assets] missing texture ${path}`));
    entry.base.wrapS = entry.base.wrapT = THREE.RepeatWrapping;
    entry.base.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    entry.base.anisotropy = 8;
    texCache.set(key, entry);
  }
  const c = entry.base.clone();
  c.repeat.set(repeat, repeat);
  if (entry.loaded) c.needsUpdate = true;
  entry.copies.push(c);
  return c;
}

// A scanned material. `size` = how many meters one copy of the texture covers.
// Options tint the color, tweak roughness/metalness, and mirror the maps.
export function pbr(id, { size = 2, color, roughness = 1, metalness, normalScale = 1, envMapIntensity = 1, side } = {}) {
  const set = index?.textures?.[id];
  const mat = new THREE.MeshStandardMaterial({ roughness, envMapIntensity, side: side ?? THREE.FrontSide });
  mat.name = id;
  if (!set) {
    mat.color.set(color ?? 0x888888);
    return mat;
  }
  const r = 1 / size;
  mat.map = tex(set.color, { srgb: true, repeat: r });
  if (color !== undefined) mat.color.set(color);
  if (set.normal) {
    mat.normalMap = tex(set.normal, { repeat: r });
    mat.normalScale.set(normalScale, normalScale);
  }
  if (set.arm) {
    const arm = tex(set.arm, { repeat: r });
    mat.aoMap = arm;
    mat.roughnessMap = arm;
    mat.aoMapIntensity = 0.8;
    if (set.metal || metalness !== undefined) {
      mat.metalnessMap = arm;
      mat.metalness = metalness ?? 1;
    } else mat.metalness = 0;
  } else if (set.rough) {
    mat.roughnessMap = tex(set.rough, { repeat: r });
  }
  if (metalness !== undefined && !set.arm) mat.metalness = metalness;
  return mat;
}

// ---- geometry with UVs in meters (textures never stretch)

// A box whose faces are UV-mapped in meters.
export function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (nx > 0.5) uv.setXY(i, z, y);
    else if (ny > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  g.setAttribute('uv1', uv.clone()); // aoMap in older three versions reads uv1
  return g;
}

// A floor/ceiling rectangle (XZ) with UVs in meters.
export function plane(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  g.setAttribute('uv1', uv.clone());
  return g;
}

// ---- models

export async function model(id) {
  await loadIndex();
  if (!modelCache.has(id)) {
    const entry = index.models?.[id];
    const url = entry ? BASE + entry.gltf : null;
    modelCache.set(id, url ? gltfLoader.loadAsync(url).then((g) => {
      g.scene.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      return g.scene;
    }).catch((e) => { console.warn(`[assets] model ${id}: ${e.message}`); return null; }) : Promise.resolve(null));
  }
  const src = await modelCache.get(id);
  if (!src) {
    // missing model: a neutral placeholder the size of a small box, so nothing breaks
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    m.userData.placeholder = id;
    return m;
  }
  return src.clone(true);
}

// Places a model so its bottom sits at y, centered on x/z, optionally scaled to a height/width.
export async function place(parent, id, { x = 0, y = 0, z = 0, rotY = 0, height, width, scale = 1 } = {}) {
  const m = await model(id);
  m.rotation.y = rotY;
  m.scale.setScalar(scale);
  m.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(m);
  const size = bb.getSize(new THREE.Vector3());
  if (height && size.y > 0) m.scale.multiplyScalar(height / size.y);
  else if (width && Math.max(size.x, size.z) > 0) m.scale.multiplyScalar(width / Math.max(size.x, size.z));
  m.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(m);
  const c = bb.getCenter(new THREE.Vector3());
  m.position.set(x - c.x, y - bb.min.y, z - c.z);
  m.name = m.name || id;
  m.userData.asset = id;
  parent.add(m);
  return m;
}

// ---- skies

export async function hdri(renderer, id) {
  await loadIndex();
  const entry = index.hdris?.[id];
  if (!entry) return null;
  const t = await new HDRLoader().loadAsync(BASE + entry.file);
  t.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(t).texture;
  pmrem.dispose();
  return { background: t, environment: env };
}
