// What tiny people can build, and the 3D models (human-size models drawn at tiny scale).
import * as THREE from 'three';
import { std, glow } from '../world/materials.js';
import { textTexture } from '../world/builder.js';

// r and h are in "person meters" (multiply by TINY for world size)
export const BUILD = {
  stockpile: { label: 'Stockpile', tech: 0, cost: {}, r: 1.3, h: 0.5, work: 2 },
  campfire: { label: 'Campfire', tech: 0, cost: { wood: 3, stone: 2 }, r: 0.8, h: 0.4, work: 6, warm: true, light: true },
  leanto: { label: 'Lean-to shelter', tech: 0, cost: { wood: 6, fiber: 4 }, r: 1.3, h: 1.6, work: 12, shelter: 2, solid: true },
  workbench: { label: 'Workbench', tech: 0, cost: { wood: 4, stone: 2 }, r: 0.8, h: 0.9, work: 10, craft: true, solid: true },
  latrine: { label: 'Latrine', tech: 0, cost: { wood: 4 }, r: 0.6, h: 2, work: 8, solid: true, toilet: true },
  hut: { label: 'Hut', tech: 1, cost: { wood: 10, fiber: 6 }, r: 1.7, h: 2.6, work: 20, shelter: 3, solid: true, door: true },
  farm: { label: 'Farm plot', tech: 1, cost: { wood: 2 }, r: 2.2, h: 0.3, work: 10, farm: true },
  well: { label: 'Well', tech: 1, cost: { stone: 10 }, r: 0.9, h: 1.2, work: 14, water: true, solid: true },
  wall: { label: 'Wall', tech: 1, cost: { wood: 3 }, r: 0.8, h: 1.8, work: 6, solid: true },
  tower: { label: 'Watchtower', tech: 1, cost: { wood: 12 }, r: 1.0, h: 4.2, work: 22, solid: true },
  statue: { label: 'Statue of the Giant', tech: 1, cost: { stone: 12 }, r: 0.9, h: 3, work: 26, worship: true, solid: true },
  effigy: { label: 'Burned effigy of the Giant', tech: 0, cost: { wood: 6 }, r: 0.8, h: 2.4, work: 10, hate: true, solid: true },
  shrine: { label: 'Church', tech: 1, cost: { wood: 10, stone: 8 }, r: 2.0, h: 3.4, work: 30, worship: true, solid: true, door: true },
  house: { label: 'House', tech: 1, cost: { wood: 16, stone: 8 }, r: 2.2, h: 3, work: 30, shelter: 4, solid: true, door: true },
  market: { label: 'Market stall', tech: 1, cost: { wood: 8, fiber: 4 }, r: 1.3, h: 2.2, work: 14, market: true, solid: true },
  jail: { label: 'Jail', tech: 2, cost: { wood: 8, metal: 3 }, r: 1.4, h: 2.2, work: 22, jail: true, solid: true },
  hospital: { label: 'Hospital', tech: 2, cost: { wood: 12, stone: 8 }, r: 2.0, h: 2.8, work: 30, heal: true, solid: true, door: true },
  forge: { label: 'Forge', tech: 2, cost: { stone: 12, clay: 4 }, r: 1.0, h: 1.6, work: 20, craft: true, warm: true, solid: true },
  arena: { label: 'Arena', tech: 2, cost: { stone: 16 }, r: 3.2, h: 0.8, work: 30, arena: true },
  lamp: { label: 'Street lamp', tech: 4, cost: { metal: 1, electric: 1 }, r: 0.2, h: 3, work: 6, light: true },
  lab: { label: 'Tiny lab', tech: 4, cost: { metal: 6, electric: 3, wood: 6 }, r: 1.8, h: 2.6, work: 40, craft: true, research: true, solid: true, door: true },
  grave: { label: 'Grave', tech: 0, cost: { stone: 1 }, r: 0.45, h: 0.6, work: 6, grave: true },
  flag: { label: 'Tribe flag', tech: 0, cost: { wood: 2, fiber: 1 }, r: 0.15, h: 3, work: 4 },
};

const M = {};
const mat = (c, r = 0.85, m = 0) => (M[c + r + m] ||= std(c, r, m));
const WOOD = 0x7a5232, LOG = 0x6a4a2c, STONE = 0x8a8780, THATCH = 0xc2a65a, CLOTH = 0xd8cbb0;

function mesh(geo, m, x, y, z, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o; }
const cyl = (r, h, s = 8) => new THREE.CylinderGeometry(r, r, h, s);

export function makeBuildingMesh(type, opts = {}) {
  const g = new THREE.Group();
  const add = (o) => { g.add(o); return o; };
  switch (type) {
    case 'stockpile':
      for (let i = 0; i < 4; i++) add(mesh(cyl(0.1, 1.2), mat(LOG), -0.3 + i * 0.2, 0.1, -0.4, 0, 0, Math.PI / 2));
      for (let i = 0; i < 3; i++) add(mesh(new THREE.DodecahedronGeometry(0.16), mat(STONE), 0.35 + (i % 2) * 0.25, 0.14, 0.35 + i * 0.12));
      break;
    case 'campfire':
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; add(mesh(new THREE.DodecahedronGeometry(0.13), mat(STONE), Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55)); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; add(mesh(cyl(0.05, 0.8), mat(LOG), 0, 0.15, 0, 0.6, a, 0)); }
      g.userData.flame = add(mesh(new THREE.ConeGeometry(0.25, 0.6, 8), glow(0xff7a20, 2.5), 0, 0.4, 0));
      break;
    case 'leanto':
      for (let i = 0; i < 9; i++) add(mesh(cyl(0.04, 2.2), mat(WOOD), -1 + i * 0.25, 0.75, 0.1, -0.75, 0, 0));
      add(mesh(cyl(0.05, 2.4), mat(LOG), 0, 1.45, -0.45, 0, 0, Math.PI / 2));
      for (const x of [-1.1, 1.1]) add(mesh(cyl(0.05, 1.5), mat(LOG), x, 0.75, -0.5));
      add(mesh(new THREE.BoxGeometry(2.2, 0.06, 1.2), mat(THATCH), 0, 0.03, 0.2));
      break;
    case 'workbench':
      add(mesh(new THREE.BoxGeometry(1.4, 0.1, 0.7), mat(WOOD), 0, 0.85, 0));
      for (const [x, z] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]]) add(mesh(cyl(0.05, 0.85), mat(LOG), x, 0.42, z));
      add(mesh(new THREE.DodecahedronGeometry(0.12), mat(STONE), 0.3, 1.0, 0));
      add(mesh(cyl(0.03, 0.6), mat(WOOD), -0.3, 0.93, 0.1, 0, 0, Math.PI / 2));
      break;
    case 'latrine':
      add(mesh(new THREE.BoxGeometry(1.0, 2.0, 1.0), mat(WOOD), 0, 1.0, 0));
      add(mesh(new THREE.BoxGeometry(1.15, 0.08, 1.15), mat(LOG), 0, 2.04, 0));
      add(mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), mat(0x3a2a1a), 0, 1.6, 0.51));
      break;
    case 'hut': {
      add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 1.6, 12, 1, true), mat(WOOD), 0, 0.8, 0)).material.side = THREE.DoubleSide;
      add(mesh(new THREE.ConeGeometry(1.95, 1.4, 12), mat(THATCH), 0, 2.2, 0));
      add(mesh(new THREE.BoxGeometry(0.6, 1.2, 0.08), mat(0x3a2a1a), 0, 0.6, 1.56));
      break;
    }
    case 'house': {
      add(mesh(new THREE.BoxGeometry(3.2, 2.2, 2.6), mat(STONE, 0.9), 0, 1.1, 0));
      add(mesh(new THREE.BoxGeometry(3.6, 0.15, 1.7), mat(0x7a3a2a), 0, 2.6, -0.65, 0.55, 0, 0));
      add(mesh(new THREE.BoxGeometry(3.6, 0.15, 1.7), mat(0x7a3a2a), 0, 2.6, 0.65, -0.55, 0, 0));
      add(mesh(new THREE.BoxGeometry(0.7, 1.4, 0.06), mat(0x5a3a22), 0, 0.7, 1.31));
      for (const x of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), glow(0xffd890, 0.4), x, 1.4, 1.31));
      break;
    }
    case 'farm': {
      add(mesh(new THREE.BoxGeometry(3.6, 0.12, 3.6), mat(0x5e3f22, 1), 0, 0.06, 0));
      for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { const p = add(mesh(new THREE.ConeGeometry(0.14, 0.4, 5), mat(0x5aa03a), -1.5 + c * 0.6, 0.3, -1.4 + r * 0.7)); p.userData.crop = true; }
      for (const s of [-1, 1]) for (let i = 0; i < 7; i++) add(mesh(cyl(0.035, 0.7), mat(WOOD), -1.8 + i * 0.6, 0.35, s * 1.85));
      break;
    }
    case 'well':
      add(mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.9, 14, 1, true), mat(STONE), 0, 0.45, 0)).material.side = THREE.DoubleSide;
      add(mesh(new THREE.CircleGeometry(0.75, 14), new THREE.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.1 }), 0, 0.6, 0, -Math.PI / 2));
      for (const x of [-0.8, 0.8]) add(mesh(cyl(0.06, 1.8), mat(WOOD), x, 0.9, 0));
      add(mesh(new THREE.ConeGeometry(1.1, 0.6, 4), mat(0x7a3a2a), 0, 2.0, 0, 0, Math.PI / 4, 0));
      break;
    case 'wall':
      for (let i = 0; i < 6; i++) add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8 + (i % 2) * 0.2, 7), mat(LOG), -0.65 + i * 0.26, 0.9, 0));
      for (let i = 0; i < 6; i++) add(mesh(new THREE.ConeGeometry(0.12, 0.25, 7), mat(LOG), -0.65 + i * 0.26, 1.95 + (i % 2) * 0.1, 0));
      break;
    case 'tower':
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) add(mesh(cyl(0.08, 4), mat(LOG), x, 2, z));
      add(mesh(new THREE.BoxGeometry(1.6, 0.12, 1.6), mat(WOOD), 0, 3.4, 0));
      add(mesh(new THREE.ConeGeometry(1.2, 0.9, 4), mat(THATCH), 0, 4.3, 0, 0, Math.PI / 4, 0));
      for (let i = 0; i < 6; i++) add(mesh(cyl(0.035, 1.2), mat(WOOD), 0.6, 0.4 + i * 0.5, 0.6, 0, 0, Math.PI / 2));
      break;
    case 'statue': {
      // a crude stone giant scientist (goggles + coat) the worshippers carve of you
      add(mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), mat(STONE), 0, 0.2, 0));
      add(mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.4, 10), mat(0xa8a49c), 0, 1.1, 0));
      add(mesh(new THREE.SphereGeometry(0.33, 12, 10), mat(0xa8a49c), 0, 2.1, 0));
      for (const x of [-0.12, 0.12]) add(mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), mat(0x6a6a6a), x, 2.15, 0.29));
      for (const s of [-1, 1]) add(mesh(cyl(0.1, 1.0), mat(0xa8a49c), s * 0.45, 1.6, 0, 0, 0, s * 0.9));
      g.userData.worship = true;
      break;
    }
    case 'effigy': {
      add(mesh(cyl(0.06, 2.6), mat(LOG), 0, 1.3, 0));
      add(mesh(cyl(0.05, 1.4), mat(LOG), 0, 1.9, 0, 0, 0, Math.PI / 2));
      add(mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0x3a2a1a), 0, 2.45, 0));
      g.userData.flame = add(mesh(new THREE.ConeGeometry(0.4, 0.9, 8), glow(0xff6a10, 2), 0, 2.6, 0));
      break;
    }
    case 'shrine': {
      add(mesh(new THREE.BoxGeometry(3.0, 2.2, 3.4), mat(0xe8e0d0, 0.9), 0, 1.1, 0));
      add(mesh(new THREE.BoxGeometry(3.4, 0.15, 2.1), mat(0x6a3a2a), 0, 2.7, -0.8, 0.6, 0, 0));
      add(mesh(new THREE.BoxGeometry(3.4, 0.15, 2.1), mat(0x6a3a2a), 0, 2.7, 0.8, -0.6, 0, 0));
      add(mesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), mat(WOOD), 0, 3.7, 1.0));
      add(mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), mat(WOOD), 0, 3.95, 1.0));
      add(mesh(new THREE.BoxGeometry(0.8, 1.5, 0.06), mat(0x5a3a22), 0, 0.75, 1.71));
      break;
    }
    case 'market': {
      add(mesh(new THREE.BoxGeometry(2.2, 0.9, 0.9), mat(WOOD), 0, 0.45, 0));
      for (const x of [-1, 1]) add(mesh(cyl(0.05, 2.2), mat(WOOD), x, 1.1, -0.4));
      add(mesh(new THREE.BoxGeometry(2.4, 0.06, 1.4), mat(0xc04040), 0, 2.2, -0.1, 0.2, 0, 0));
      for (let i = 0; i < 5; i++) add(mesh(new THREE.SphereGeometry(0.1, 8, 6), mat([0xc0182c, 0xe0a020, 0x3a8a3a][i % 3]), -0.8 + i * 0.4, 0.98, 0.1));
      break;
    }
    case 'jail': {
      add(mesh(new THREE.BoxGeometry(2.6, 0.15, 2.6), mat(STONE), 0, 0.07, 0));
      for (let i = 0; i < 10; i++) for (const s of [-1, 1]) {
        add(mesh(cyl(0.035, 2.0), mat(0x5a5a5a, 0.4, 0.8), -1.2 + i * 0.27, 1.05, s * 1.25));
        add(mesh(cyl(0.035, 2.0), mat(0x5a5a5a, 0.4, 0.8), s * 1.25, 1.05, -1.2 + i * 0.27));
      }
      add(mesh(new THREE.BoxGeometry(2.7, 0.15, 2.7), mat(WOOD), 0, 2.1, 0));
      break;
    }
    case 'hospital': {
      add(mesh(new THREE.BoxGeometry(3.4, 2.2, 2.8), mat(0xf2f2f2, 0.8), 0, 1.1, 0));
      add(mesh(new THREE.BoxGeometry(3.6, 0.2, 3.0), mat(0x9a9a9a), 0, 2.3, 0));
      add(mesh(new THREE.BoxGeometry(0.7, 0.2, 0.05), mat(0xd02020), 0, 1.8, 1.42));
      add(mesh(new THREE.BoxGeometry(0.2, 0.7, 0.05), mat(0xd02020), 0, 1.8, 1.42));
      add(mesh(new THREE.BoxGeometry(0.8, 1.4, 0.06), mat(0x6a8aa8), 0, 0.7, 1.41));
      break;
    }
    case 'forge': {
      add(mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.2, 10), mat(STONE), 0, 0.6, 0));
      add(mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.0, 8), mat(0x6a6a6a), 0, 1.6, 0));
      g.userData.flame = add(mesh(new THREE.SphereGeometry(0.35, 10, 8), glow(0xff5a10, 2.4), 0, 0.9, 0.5));
      add(mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), mat(0x3a3a3a, 0.4, 0.8), 1.2, 0.4, 0));
      break;
    }
    case 'arena': {
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; add(mesh(new THREE.BoxGeometry(0.8, 0.6 + (i % 2) * 0.2, 0.4), mat(STONE), Math.cos(a) * 3, 0.35, Math.sin(a) * 3, 0, -a, 0)); }
      add(mesh(new THREE.CircleGeometry(2.8, 24), mat(0xc2a87a, 1), 0, 0.02, 0, -Math.PI / 2));
      break;
    }
    case 'lamp':
      add(mesh(cyl(0.06, 3), mat(0x2a2a2a, 0.4, 0.8), 0, 1.5, 0));
      add(mesh(new THREE.SphereGeometry(0.2, 10, 8), glow(0xfff2d0, 2.5), 0, 3.05, 0));
      break;
    case 'lab': {
      add(mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), mat(0x8a9aa0, 0.4, 0.6), 0, 1.2, 0));
      add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12), mat(0x3a4a4a, 0.4, 0.6), 1.0, 2.8, 0));
      add(mesh(new THREE.SphereGeometry(0.25, 10, 8), glow(0x63e6be, 2), 1.0, 3.3, 0));
      add(mesh(new THREE.BoxGeometry(0.8, 1.6, 0.06), mat(0x2a3a3a), 0, 0.8, 1.31));
      break;
    }
    case 'grave': {
      add(mesh(new THREE.BoxGeometry(0.7, 0.2, 1.6), mat(0x5e3f22, 1), 0, 0.1, 0));
      if (opts.cross) { add(mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), mat(WOOD), 0, 0.6, -0.8)); add(mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), mat(WOOD), 0, 0.85, -0.8)); }
      else add(mesh(new THREE.BoxGeometry(0.6, 0.8, 0.15), mat(STONE), 0, 0.45, -0.8));
      break;
    }
    case 'flag': {
      add(mesh(cyl(0.04, 3.2), mat(WOOD), 0, 1.6, 0));
      const tex = textTexture(opts.symbol || '*', { w: 128, h: 96, size: 64, bg: opts.color || '#c03030', color: '#ffffff' });
      add(mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }), 0.5, 2.8, 0));
      break;
    }
    default:
      add(mesh(new THREE.BoxGeometry(1, 1, 1), mat(WOOD), 0, 0.5, 0));
  }
  return g;
}

// scaffolding while it's being built
export function makeScaffold(r, h) {
  const g = new THREE.Group();
  const m = mat(0x9a7a4a);
  for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]]) g.add(mesh(cyl(0.04, h), m, x * 0.7, h / 2, z * 0.7));
  for (let y = 0.4; y < h; y += 0.8) {
    g.add(mesh(cyl(0.03, r * 1.4), m, 0, y, -r * 0.7, 0, 0, Math.PI / 2));
    g.add(mesh(cyl(0.03, r * 1.4), m, 0, y, r * 0.7, 0, 0, Math.PI / 2));
  }
  return g;
}
