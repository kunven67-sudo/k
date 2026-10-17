// Kenney CC0 model kits (assets/models/<kit>/<name>.glb). Every kit shares one small palette
// texture (Textures/colormap.png), so hundreds of models cost almost nothing to draw.
//
//   await assets.preload([['people', 'character-male-a'], ['furniture', 'bedSingle']], onProgress)
//   const obj = assets.model('furniture', 'bedSingle')    // a fresh clone, real-world scale applied
//   assets.clips('people', 'character-male-a')            // AnimationClip[]
//
// Kits are modelled at different scales; KIT_SCALE brings each to metres (people are sized by
// the Person class instead, from their age and genes).

import * as THREE from 'three';
import { realify } from './realmat.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = './assets/models/';

export const KIT_SCALE = {
  people: 1,
  humans: 1,
  home: 0.5,
  autos: 1,
  furniture: 2,
  market: 2.25,
  suburban: 8,
  commercial: 7.5,
  roads: 8,
  cars: 1.5,
  food: 0.42,
  nature: 5,
  building: 1,
};

// Items in a kit that don't follow the kit's scale (metres per model unit).
const ITEM_SCALE = {
  'furniture/bedSingle': 1.8,
  'furniture/bedDouble': 1.8,
  'furniture/bedBunk': 1.8,
};

const loader = new GLTFLoader();
const cache = new Map(); // "kit/name" -> Promise<gltf>
const ready = new Map(); // "kit/name" -> gltf

function key(kit, name) {
  return `${kit}/${name}`;
}

// Kenney's nature kit is pastel cartoon (teal leaves, pink bark). Real-life colours instead.
const RECOLOR = {
  nature: {
    leafsGreen: '#5a8a34',
    leafsDark: '#355f26',
    leafsFall: '#c8692a',
    woodBark: '#5c4434',
    woodBarkDark: '#4b382b',
    woodBirch: '#5c4434',
    grass: '#4d7a2f',
    dirt: '#7a6a58',
    stone: '#8d8a84',
  },
};

function prepare(gltf, kit, name) {
  const recolor = RECOLOR[kit];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (recolor) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) if (recolor[m.name]) m.color.set(recolor[m.name]);
    }
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        // The palette is made of flat colour strips: nearest filtering keeps them crisp.
        m.map.magFilter = THREE.NearestFilter;
        m.map.minFilter = THREE.NearestMipmapLinearFilter;
        m.map.anisotropy = 1;
        m.map.needsUpdate = true;
      }
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.55);
      if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0, 0.15);
      if ('envMapIntensity' in m) m.envMapIntensity = 0.7;
    }
  });
  // Flat-coloured furniture / house / car kits get real textured materials (gfx/realmat.js).
  realify(kit, name, gltf.scene);
  let skinned = false;
  gltf.scene.traverse((o) => {
    if (o.isSkinnedMesh) skinned = true;
  });
  const box = new THREE.Box3().setFromObject(gltf.scene);
  gltf.userData = { box, size: box.getSize(new THREE.Vector3()), skinned };
  return gltf;
}

export const assets = {
  KIT_SCALE,

  load(kit, name) {
    const k = key(kit, name);
    if (!cache.has(k)) {
      const p = loader
        .loadAsync(`${BASE}${kit}/${name}.glb`)
        .then((g) => {
          prepare(g, kit, name);
          ready.set(k, g);
          return g;
        })
        .catch((err) => {
          console.warn(`[assets] ${k} failed`, err);
          cache.delete(k);
          throw err;
        });
      cache.set(k, p);
    }
    return cache.get(k);
  },

  /** Load many [kit, name] pairs. Missing files are skipped (logged), never fatal. */
  async preload(list, onProgress) {
    let done = 0;
    const uniq = [...new Set(list.map(([k, n]) => key(k, n)))].map((s) => s.split('/'));
    await Promise.all(
      uniq.map(([kit, name]) =>
        assets
          .load(kit, name)
          .catch(() => null)
          .finally(() => onProgress?.(++done / uniq.length)),
      ),
    );
  },

  has(kit, name) {
    return ready.has(key(kit, name));
  },

  scaleOf(kit, name) {
    return ITEM_SCALE[key(kit, name)] ?? KIT_SCALE[kit] ?? 1;
  },

  /** Fresh copy of a loaded model, wrapped in a group with the real-world scale applied. */
  model(kit, name, { scale = null } = {}) {
    const g = ready.get(key(kit, name));
    if (!g) {
      console.warn(`[assets] ${kit}/${name} used before it loaded`);
      return new THREE.Group();
    }
    const skinned = g.userData.skinned;
    const inner = skinned ? SkeletonUtils.clone(g.scene) : g.scene.clone(true);
    const wrap = new THREE.Group();
    wrap.name = name;
    wrap.add(inner);
    wrap.scale.setScalar(scale ?? assets.scaleOf(kit, name));
    wrap.userData.kit = kit;
    wrap.userData.model = name;
    return wrap;
  },

  clips(kit, name) {
    return ready.get(key(kit, name))?.animations || [];
  },

  /** Model-space size (before the kit scale). */
  size(kit, name) {
    return ready.get(key(kit, name))?.userData.size.clone() || new THREE.Vector3(1, 1, 1);
  },

  box(kit, name) {
    return ready.get(key(kit, name))?.userData.box.clone() || new THREE.Box3();
  },
};
