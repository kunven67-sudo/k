// Real scanned materials (CC0 photos of metal, wood, rubber, concrete...) + how each one acts in physics.
import * as THREE from 'three';
import { assetURL, track } from './assets.js';
import { renderer } from './render.js';

// density = kg per cubic meter (lighter than real life so builds stay fun), strength = how hard a hit it takes to rip it off
export const MATS = {
  steel: { name: 'Painted Steel', tex: 'paint', color: '#8d939b', metal: 0.55, rough: 1, density: 1600, friction: 0.6, bounce: 0.1, strength: 7, sound: 'metal', paint: true },
  alu: { name: 'Aluminum', tex: 'alu', color: '#d6dbe0', metal: 1, rough: 0.9, density: 700, friction: 0.5, bounce: 0.12, strength: 5, sound: 'metal', paint: true },
  iron: { name: 'Dark Iron', tex: 'iron', color: '#ffffff', metal: 0.9, rough: 1, density: 2600, friction: 0.65, bounce: 0.05, strength: 9, sound: 'metal' },
  tread: { name: 'Tread Plate', tex: 'tread', color: '#ffffff', metal: 1, rough: 1, density: 2000, friction: 0.9, bounce: 0.05, strength: 8, sound: 'metal' },
  planks: { name: 'Wood Planks', tex: 'planks', color: '#ffffff', metal: 0, rough: 1, density: 450, friction: 0.7, bounce: 0.15, strength: 3, sound: 'wood', paint: true },
  plywood: { name: 'Plywood', tex: 'plywood', color: '#ffffff', metal: 0, rough: 1, density: 400, friction: 0.7, bounce: 0.15, strength: 2.5, sound: 'wood', paint: true },
  plastic: { name: 'Plastic', tex: 'plastic', color: '#e8e8e8', metal: 0, rough: 1, density: 300, friction: 0.45, bounce: 0.3, strength: 3, sound: 'soft', paint: true },
  rubber: { name: 'Rubber', tex: 'rubber', color: '#ffffff', metal: 0, rough: 1, density: 600, friction: 1.4, bounce: 0.55, strength: 10, sound: 'soft', paint: true },
  concrete: { name: 'Concrete', tex: 'concrete', color: '#ffffff', metal: 0, rough: 1, density: 1500, friction: 0.9, bounce: 0.05, strength: 3.5, sound: 'heavy' },
  brick: { name: 'Brick', tex: 'brick', color: '#ffffff', metal: 0, rough: 1, density: 1300, friction: 0.85, bounce: 0.05, strength: 2.2, sound: 'heavy' },
  fabric: { name: 'Fabric', tex: 'fabric', color: '#4b4f57', metal: 0, rough: 1, density: 150, friction: 0.9, bounce: 0.1, strength: 4, sound: 'soft', paint: true },
  glass: { name: 'Glass', tex: null, color: '#cfe6ee', metal: 0, rough: 0.04, density: 700, friction: 0.35, bounce: 0.1, strength: 0.7, sound: 'glass', glass: true, fragile: true },
  ice: { name: 'Ice', tex: null, color: '#bfe3f5', metal: 0, rough: 0.12, density: 500, friction: 0.02, bounce: 0.05, strength: 1.2, sound: 'glass', glass: true, fragile: true },
  gold: { name: 'Gold', tex: 'alu', color: '#e8b04a', metal: 1, rough: 0.45, density: 3000, friction: 0.5, bounce: 0.1, strength: 5, sound: 'metal' },
  chrome: { name: 'Chrome', tex: null, color: '#ffffff', metal: 1, rough: 0.06, density: 1600, friction: 0.4, bounce: 0.15, strength: 7, sound: 'metal' },
  neon: { name: 'Glowing', tex: 'plastic', color: '#38d6ff', metal: 0, rough: 0.6, density: 300, friction: 0.45, bounce: 0.2, strength: 3, sound: 'soft', paint: true, glow: true },
  bouncy: { name: 'Bouncy Rubber', tex: 'rubber', color: '#d84a3a', metal: 0, rough: 0.9, density: 400, friction: 1.0, bounce: 0.92, strength: 10, sound: 'soft', paint: true }
};
export const MAT_ORDER = Object.keys(MATS);

export const PAINT = ['#8d939b', '#e8e8e8', '#2b2d31', '#c8332b', '#e5762a', '#f2c230', '#5aa339', '#2f8f83', '#2f6fd1', '#6c4bc7',
  '#d65a9b', '#7a4a2a', '#f4efe4', '#38d6ff', '#ff4fd8', '#9cff3d'];

const texCache = {};
let aniso = 4;
function loadTex(file, srgb) {
  if (texCache[file]) return texCache[file];
  const t = new THREE.TextureLoader().load(assetURL('tex/' + file));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  texCache[file] = t;
  return t;
}
export function texSet(name) {
  return { map: loadTex(name + '_c.jpg', true), normalMap: loadTex(name + '_n.jpg', false), arm: loadTex(name + '_a.jpg', false) };
}
export function preloadTextures() {
  const names = new Set(Object.values(MATS).map((m) => m.tex).filter(Boolean));
  ['grass', 'pad', 'asphalt'].forEach((n) => names.add(n));
  const all = [];
  for (const n of names) {
    for (const [suffix, srgb] of [['_c.jpg', true], ['_n.jpg', false], ['_a.jpg', false]]) {
      const file = n + suffix;
      all.push(track(new Promise((res) => {
        const t = new THREE.TextureLoader().load(assetURL('tex/' + file), res, undefined, res);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = aniso;
        texCache[file] = t;
      })));
    }
  }
  return Promise.all(all);
}
export function setAnisotropy(a) {
  aniso = Math.min(a, renderer.capabilities.getMaxAnisotropy());
  for (const t of Object.values(texCache)) { t.anisotropy = aniso; t.needsUpdate = true; }
}

const matCache = new Map();
export function partMaterial(key, color, glowOn = true) {
  const m = MATS[key] || MATS.steel;
  const c = color || m.color;
  const id = key + c + (m.glow ? glowOn : '');
  let mat = matCache.get(id);
  if (mat) return mat;
  const p = { color: new THREE.Color(c), metalness: m.metal, roughness: m.rough };
  if (m.tex) {
    const t = texSet(m.tex);
    Object.assign(p, { map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, metalnessMap: m.metal > 0 ? t.arm : null, aoMap: t.arm, aoMapIntensity: 0.6 });
    if (key === 'gold') { p.map = null; p.roughnessMap = t.arm; }
  }
  if (m.glass) Object.assign(p, { transparent: true, opacity: key === 'ice' ? 0.55 : 0.28, depthWrite: false, envMapIntensity: 1.6 });
  if (m.glow) Object.assign(p, { emissive: new THREE.Color(c), emissiveIntensity: glowOn ? 2.2 : 0 });
  mat = new THREE.MeshStandardMaterial(p);
  if (m.metal > 0 && m.tex && key !== 'gold') mat.metalness = 1; // the packed map's blue channel holds the real metal mask
  if (key === 'steel') mat.metalness = 0.6;
  mat.userData.key = key;
  matCache.set(id, mat);
  return mat;
}

// see-through blue/red "ghost" for where a part will go
export const ghostOK = new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.38, depthWrite: false });
export const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5a4f, transparent: true, opacity: 0.38, depthWrite: false });
export const highlight = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
