// Named material library. All geometry in the game uses UVs measured in METERS, so a texture's
// `tile` value says how many meters one copy of the texture covers. That keeps wood grain,
// carpet fibres etc. the same real size on every object.
import * as THREE from 'three';
import { surface, drawTexture } from './textures.js';

const mats = new Map();

function withTile(set, tile) {
  const out = {};
  for (const k in set) { const t = set[k].clone(); t.repeat.set(1 / tile, 1 / tile); t.needsUpdate = true; out[k] = t; }
  return out;
}

const DEFS = {
  // room
  wall: () => std({ ...withTile(surface('paint', { color: 0xd8d2c4 }), 1.2), roughness: 0.9, normalScale: new THREE.Vector2(0.35, 0.35) }),
  ceiling: () => std({ ...withTile(surface('paint', { color: 0xeeebe4 }), 0.8), roughness: 0.95, normalScale: new THREE.Vector2(0.6, 0.6) }),
  carpet: () => std({ ...withTile(surface('carpet', { color: 0x5d6570 }), 0.35), roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) }),
  rug: () => std({ ...withTile(surface('carpet', { color: 0x7a3438 }), 0.3), roughness: 1 }),
  floorWood: () => std({ ...withTile(surface('planks'), 2.4), roughness: 0.55 }),
  trim: () => std({ ...withTile(surface('paint', { color: 0xf3f1ec }), 1), roughness: 0.5 }),
  deskWood: () => std({ ...withTile(surface('wood', { a: 0x3d2b1f, b: 0x22170f }), 0.9), roughness: 0.45 }),
  lightWood: () => std({ ...withTile(surface('wood', { a: 0xc19a6b, b: 0x96703f }), 0.8), roughness: 0.5 }),
  doorWood: () => std({ ...withTile(surface('paint', { color: 0xf1efe9 }), 1), roughness: 0.4 }),
  sheet: () => std({ ...withTile(surface('fabric', { color: 0x2e4a74 }), 0.25), roughness: 0.95 }),
  blanket: () => std({ ...withTile(surface('fabric', { color: 0x464c55 }), 0.2), roughness: 1 }),
  pillow: () => std({ ...withTile(surface('fabric', { color: 0xe8e6e0 }), 0.2), roughness: 0.95 }),
  mattress: () => std({ ...withTile(surface('fabric', { color: 0xdfe3e8 }), 0.2), roughness: 0.95 }),
  chairFabric: () => std({ ...withTile(surface('fabric', { color: 0x1d1f24 }), 0.15), roughness: 0.9 }),
  concrete: () => std({ ...withTile(surface('concrete'), 1.5), roughness: 0.95 }),
  granite: () => std({ color: 0x3b3936, roughness: 0.25, metalness: 0.1 }),
  porcelain: () => phys({ color: 0xf6f6f2, roughness: 0.12, clearcoat: 0.8, side: THREE.DoubleSide }),
  // plastics & metals
  xboxBlack: () => std({ ...withTile(surface('plastic', { color: 0x141518 }), 0.12), roughness: 0.62 }),
  plasticBlack: () => std({ ...withTile(surface('plastic', { color: 0x1b1c1f }), 0.1), roughness: 0.5 }),
  plasticGray: () => std({ ...withTile(surface('plastic', { color: 0x55595f }), 0.1), roughness: 0.55 }),
  plasticWhite: () => std({ ...withTile(surface('plastic', { color: 0xe9e9e6 }), 0.1), roughness: 0.45 }),
  plasticGreen: () => std({ ...withTile(surface('plastic', { color: 0x1e7a3c }), 0.1), roughness: 0.45 }),
  rubber: () => std({ color: 0x18191b, roughness: 0.95 }),
  rubberGray: () => std({ color: 0x3a3c40, roughness: 0.9 }),
  alu: () => std({ ...withTile(surface('metal', { color: 0xc4c8cd }), 0.15), metalness: 1, roughness: 0.32 }),
  darkAlu: () => std({ ...withTile(surface('metal', { color: 0x5b6067 }), 0.15), metalness: 1, roughness: 0.38 }),
  steel: () => std({ ...withTile(surface('metal', { color: 0x9a9fa6 }), 0.1), metalness: 1, roughness: 0.4 }),
  chrome: () => std({ color: 0xe8eaee, metalness: 1, roughness: 0.08 }),
  copper: () => std({ ...withTile(surface('metal', { color: 0xc98652 }), 0.05), metalness: 1, roughness: 0.3 }),
  gold: () => std({ color: 0xd9b25a, metalness: 1, roughness: 0.25 }),
  solder: () => std({ color: 0xc9ccd0, metalness: 1, roughness: 0.25 }),
  pcb: () => std({ ...withTile(surface('pcb'), 0.06), roughness: 0.5 }),
  chip: () => std({ color: 0x15161a, roughness: 0.6 }),
  ceramic: () => std({ color: 0xb7a58a, roughness: 0.5 }),
  capBlue: () => std({ color: 0x1f3c8a, roughness: 0.35 }),
  copperCoil: () => std({ color: 0xb0612f, metalness: 1, roughness: 0.25 }),
  // glass & screens
  glass: () => phys({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.004, ior: 1.5, transparent: true, opacity: 1 }),
  windowGlass: () => phys({ color: 0xeaf4ff, roughness: 0.03, transparent: true, opacity: 0.12, depthWrite: false }),
  screenOff: () => std({ color: 0x050607, roughness: 0.12, metalness: 0.2 }),
  lens: () => phys({ color: 0x0a0d18, roughness: 0.02, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 }),
  // misc
  paper: () => std({ color: 0xf2efe6, roughness: 0.9 }),
  cardboard: () => std({ color: 0xb08a5a, roughness: 0.95 }),
  foam: () => std({ color: 0x2a2b2e, roughness: 1 }),
  ledWhite: () => std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }),
  ledGreen: () => std({ color: 0x40ff70, emissive: 0x40ff70, emissiveIntensity: 2 }),
  ledBlue: () => std({ color: 0x4090ff, emissive: 0x4090ff, emissiveIntensity: 2 }),
  bulb: () => std({ color: 0xfff6e0, emissive: 0xfff1d0, emissiveIntensity: 3 }),
  black: () => std({ color: 0x050505, roughness: 0.9 }),
  pumpkin: () => std({ color: 0xe26a12, roughness: 0.6 }),
  stem: () => std({ color: 0x4a5a24, roughness: 0.8 }),
  dust: () => std({ color: 0x9a948a, roughness: 1 }),
};

function std(p) { return new THREE.MeshStandardMaterial(p); }
function phys(p) { return new THREE.MeshPhysicalMaterial(p); }

export function mat(name) {
  if (mats.has(name)) return mats.get(name);
  const def = DEFS[name];
  if (!def) throw new Error('no material ' + name);
  const m = def(); m.name = name; mats.set(name, m);
  return m;
}

// Register a one-off material (labels, screens) under a name.
export function defMat(name, make) { if (!mats.has(name)) { const m = make(); m.name = name; mats.set(name, m); } return mats.get(name); }
export function colorMat(hexColor, rough = 0.6, metal = 0) {
  return defMat(`c${hexColor}_${rough}_${metal}`, () => std({ color: hexColor, roughness: rough, metalness: metal }));
}
export { drawTexture };
