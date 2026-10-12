// Furniture and home stuff, real sizes and real weights. All of these are props (real physics
// objects you can push, shrink, grow and climb on when tiny). Built-ins (counters, toilets, tubs,
// stairs) are part of the house in mansion.js instead.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, phys } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { CATALOG } from './catalog.js';

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

export const FM = {
  fabric: (c) => once('ff' + c, () => {
    const t = TX.fabric(c, 70);
    return std({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95 }, { indoor: true, detail: 'fabric' });
  }),
  leather: (c) => once('lea' + c, () => std({ color: c, roughness: 0.5 }, { indoor: true, detail: 'skin' })),
  wood: (c) => once('fw' + c, () => {
    const t = woodGrain(c);
    return std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1 }, { indoor: true, detail: 'wood' });
  }),
  metal: (c, r = 0.3) => once('fm' + c + r, () => std({ color: c, metalness: 1, roughness: r }, { indoor: true, detail: 'metal' })),
  plastic: (c, r = 0.45) => once('fp' + c + r, () => std({ color: c, roughness: r }, { indoor: true, detail: 'plastic' })),
  glass: () => once('fglass', () => phys({ color: 0xe6eef2, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.18, envMapIntensity: 1.3, depthWrite: false, side: THREE.DoubleSide }, { indoor: true, detail: 'glass' })),
  screen: () => once('fscreen', () => std({ color: 0x050607, roughness: 0.08, metalness: 0.2 }, { indoor: true, detail: 'glass' })),
  ceramic: (c) => once('fc' + c, () => phys({ color: c, roughness: 0.25, clearcoat: 0.5 }, { indoor: true, detail: 'glass' })),
  soil: () => once('fsoil', () => std({ color: 0x3b2a1e, roughness: 1 }, { indoor: true, detail: 'soil' })),
  leaf: () => once('fleaf', () => std({ color: 0x2f5a2a, roughness: 0.6, side: THREE.DoubleSide }, { indoor: true, detail: 'plastic' })),
};

// Long-grain furniture wood (not floor planks).
function woodGrain(base) {
  const r = ((base >> 16) & 255) / 255, g = ((base >> 8) & 255) / 255, b = (base & 255) / 255;
  return TX.generate('grain' + base, 256, (u, v) => {
    const warp = TX.fbm(u, v * 0.2, { freq: 3, oct: 3, seed: 201 }) * 4;
    const ring = Math.sin((u * 26 + warp) * Math.PI) * 0.5 + 0.5;
    const fine = TX.fbm(u * 4, v * 0.5, { freq: 16, oct: 3, seed: 202 });
    const d = 0.78 + ring * 0.16 + fine * 0.1;
    return [r * d, g * d, b * d, ring * 0.4 + fine * 0.3, 0.42 + ring * 0.1];
  }, { normalStrength: 1.5 });
}

function M(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const RB = (w, h, d, r = 0.03, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

function def(d) {
  CATALOG[d.id] = d;
  return d;
}

// ---- living room -------------------------------------------------------------------------------
// 3-seat sofa: 2.2 m wide, 0.95 deep, 0.85 tall back, seat at 0.45. About 60 kg.
def({
  id: 'sofa', name: 'Sofa', category: 'Furniture', material: 'fabric', mass: 60, size: 2.2,
  build({ color = 0x5d6670 } = {}) {
    const g = new THREE.Group();
    const f = FM.fabric(color);
    const legs = FM.wood(0x3b2516);
    M(RB(2.2, 0.22, 0.92, 0.04), f, g, 0, 0.26, 0); // base
    for (let i = -1; i <= 1; i++) M(RB(0.68, 0.17, 0.72, 0.06), f, g, i * 0.69, 0.455, 0.06); // seat cushions
    M(RB(2.2, 0.5, 0.2, 0.05), f, g, 0, 0.6, -0.36); // back
    for (let i = -1; i <= 1; i++) M(RB(0.66, 0.42, 0.16, 0.07), f, g, i * 0.69, 0.66, -0.22).rotation.x = -0.12; // back cushions
    for (const s of [-1, 1]) M(RB(0.18, 0.4, 0.92, 0.06), f, g, s * 1.01, 0.47, 0); // arms
    for (const [x, z] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) M(new THREE.CylinderGeometry(0.025, 0.018, 0.15, 10), legs, g, x, 0.075, z);
    return g;
  },
  shapes: [
    { t: 'box', s: [1.1, 0.19, 0.46], p: [0, 0.34, 0] },
    { t: 'box', s: [1.1, 0.25, 0.1], p: [0, 0.6, -0.36] },
    { t: 'box', s: [0.09, 0.2, 0.46], p: [-1.01, 0.47, 0] },
    { t: 'box', s: [0.09, 0.2, 0.46], p: [1.01, 0.47, 0] },
    { t: 'box', s: [1.05, 0.075, 0.42], p: [0, 0.075, 0] },
  ],
});

def({
  id: 'armchair', name: 'Armchair', category: 'Furniture', material: 'fabric', mass: 28, size: 0.95,
  build({ color = 0x8a5a3c } = {}) {
    const g = new THREE.Group();
    const f = FM.leather(color);
    M(RB(0.9, 0.24, 0.88, 0.05), f, g, 0, 0.27, 0);
    M(RB(0.62, 0.15, 0.7, 0.06), f, g, 0, 0.45, 0.06);
    M(RB(0.9, 0.5, 0.18, 0.06), f, g, 0, 0.6, -0.35);
    for (const s of [-1, 1]) M(RB(0.15, 0.38, 0.88, 0.06), f, g, s * 0.375, 0.46, 0);
    const legs = FM.metal(0x1d1d1f, 0.4);
    for (const [x, z] of [[-0.38, -0.36], [0.38, -0.36], [-0.38, 0.36], [0.38, 0.36]]) M(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8), legs, g, x, 0.075, z);
    return g;
  },
  shapes: [
    { t: 'box', s: [0.45, 0.19, 0.44], p: [0, 0.34, 0] },
    { t: 'box', s: [0.45, 0.25, 0.09], p: [0, 0.6, -0.35] },
    { t: 'box', s: [0.42, 0.075, 0.4], p: [0, 0.075, 0] },
  ],
});

// Coffee table: walnut frame, 1.2 x 0.6 m, 42 cm tall, 18 kg.
def({
  id: 'coffee_table', name: 'Coffee table', category: 'Furniture', material: 'wood', mass: 18, size: 1.2,
  build() {
    const g = new THREE.Group();
    const w = FM.wood(0x5a3a22);
    M(RB(1.2, 0.04, 0.6, 0.01), w, g, 0, 0.4, 0);
    M(RB(1.1, 0.02, 0.5, 0.005), w, g, 0, 0.12, 0); // lower shelf
    for (const [x, z] of [[-0.56, -0.26], [0.56, -0.26], [-0.56, 0.26], [0.56, 0.26]]) M(RB(0.04, 0.38, 0.04, 0.008), w, g, x, 0.19, z);
    return g;
  },
  shapes: [
    { t: 'box', s: [0.6, 0.02, 0.3], p: [0, 0.4, 0] },
    { t: 'box', s: [0.55, 0.01, 0.25], p: [0, 0.12, 0] },
    { t: 'box', s: [0.02, 0.19, 0.02], p: [-0.56, 0.19, -0.26] },
    { t: 'box', s: [0.02, 0.19, 0.02], p: [0.56, 0.19, -0.26] },
    { t: 'box', s: [0.02, 0.19, 0.02], p: [-0.56, 0.19, 0.26] },
    { t: 'box', s: [0.02, 0.19, 0.02], p: [0.56, 0.19, 0.26] },
  ],
});

// 65-inch TV: 1.45 x 0.83 m screen, 25 kg, on its own stand feet.
def({
  id: 'tv65', name: '65" TV', category: 'Electronics', material: 'plastic', mass: 25, size: 1.45,
  build() {
    const g = new THREE.Group();
    const body = FM.plastic(0x101114, 0.35);
    M(RB(1.45, 0.84, 0.045, 0.008), body, g, 0, 0.5, 0);
    const scr = M(new THREE.PlaneGeometry(1.43, 0.81), FM.screen(), g, 0, 0.5, 0.0235);
    scr.name = 'screen';
    for (const s of [-1, 1]) {
      const foot = M(RB(0.05, 0.08, 0.26, 0.01), body, g, s * 0.6, 0.04, 0.02);
      foot.rotation.y = s * 0.3;
    }
    return g;
  },
  shapes: [
    { t: 'box', s: [0.725, 0.42, 0.023], p: [0, 0.5, 0] },
    { t: 'box', s: [0.65, 0.04, 0.12], p: [0, 0.04, 0.02] },
  ],
});

def({
  id: 'tv_stand', name: 'TV stand', category: 'Furniture', material: 'wood', mass: 35, size: 1.8,
  build() {
    const g = new THREE.Group();
    const w = FM.wood(0x6b4a30);
    M(RB(1.8, 0.48, 0.42, 0.01), w, g, 0, 0.26, 0);
    const dark = FM.plastic(0x18181b, 0.6);
    for (let i = 0; i < 3; i++) M(new THREE.BoxGeometry(0.55, 0.36, 0.01), dark, g, -0.6 + i * 0.6, 0.26, 0.211);
    for (const [x, z] of [[-0.85, -0.17], [0.85, -0.17], [-0.85, 0.17], [0.85, 0.17]]) M(new THREE.CylinderGeometry(0.02, 0.015, 0.02, 8), FM.metal(0x222222), g, x, 0.01, z);
    return g;
  },
  shapes: [{ t: 'box', s: [0.9, 0.24, 0.21], p: [0, 0.26, 0] }],
});

def({
  id: 'floor_lamp', name: 'Floor lamp', category: 'Home', material: 'metal', mass: 6, size: 1.65,
  light: { y: 1.5, color: 0xffd9a8, intensity: 6, range: 6 },
  build() {
    const g = new THREE.Group();
    const met = FM.metal(0x26272b, 0.35);
    M(new THREE.CylinderGeometry(0.15, 0.16, 0.025, 28), met, g, 0, 0.0125, 0);
    M(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 10), met, g, 0, 0.74, 0);
    const shadeMat = once('shade', () => std({ color: 0xf2e6d2, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }, { indoor: true, detail: 'fabric' }));
    M(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 28, 1, true), shadeMat, g, 0, 1.5, 0);
    const bulb = M(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), g, 0, 1.47, 0);
    bulb.castShadow = false;
    return g;
  },
  shapes: [
    { t: 'cyl', r: 0.16, h: 0.0125, p: [0, 0.0125, 0] },
    { t: 'cyl', r: 0.015, h: 0.72, p: [0, 0.74, 0] },
    { t: 'cyl', r: 0.2, h: 0.14, p: [0, 1.5, 0] },
  ],
});

def({
  id: 'plant', name: 'Potted fiddle-leaf fig', category: 'Garden', material: 'ceramic', mass: 9, size: 1.3,
  build() {
    const g = new THREE.Group();
    M(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 24), FM.ceramic(0xd9d4ca), g, 0, 0.16, 0);
    M(new THREE.CylinderGeometry(0.155, 0.155, 0.02, 24), FM.soil(), g, 0, 0.3, 0);
    M(new THREE.CylinderGeometry(0.012, 0.016, 0.9, 6), FM.wood(0x5a4030), g, 0, 0.75, 0);
    const leafGeo = new THREE.SphereGeometry(0.11, 10, 6);
    leafGeo.scale(1, 0.12, 0.7);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4, h = 0.55 + (i / 26) * 0.7;
      const l = M(leafGeo, FM.leaf(), g, Math.cos(a) * (0.12 + Math.sin(i) * 0.04), h, Math.sin(a) * (0.12 + Math.cos(i) * 0.04));
      l.rotation.set(0.5 * Math.sin(i * 1.3), a, -0.6 - 0.2 * Math.cos(i));
    }
    return g;
  },
  shapes: [{ t: 'cyl', r: 0.17, h: 0.16, p: [0, 0.16, 0] }, { t: 'cyl', r: 0.25, h: 0.35, p: [0, 0.95, 0] }],
});

// ---- office ------------------------------------------------------------------------------------
def({
  id: 'desk', name: 'Desk', category: 'Furniture', material: 'wood', mass: 32, size: 1.6,
  build() {
    const g = new THREE.Group();
    const w = FM.wood(0x2e2a26);
    M(RB(1.6, 0.04, 0.75, 0.008), w, g, 0, 0.73, 0);
    const met = FM.metal(0x1b1c1f, 0.45);
    for (const s of [-1, 1]) {
      M(new THREE.BoxGeometry(0.05, 0.71, 0.05), met, g, s * 0.74, 0.355, -0.3);
      M(new THREE.BoxGeometry(0.05, 0.71, 0.05), met, g, s * 0.74, 0.355, 0.3);
      M(new THREE.BoxGeometry(0.05, 0.05, 0.65), met, g, s * 0.74, 0.03, 0);
    }
    M(RB(0.42, 0.55, 0.6, 0.01), w, g, 0.52, 0.42, 0.02); // drawer unit
    return g;
  },
  shapes: [
    { t: 'box', s: [0.8, 0.02, 0.375], p: [0, 0.73, 0] },
    { t: 'box', s: [0.025, 0.355, 0.33], p: [-0.74, 0.355, 0] },
    { t: 'box', s: [0.21, 0.275, 0.3], p: [0.52, 0.42, 0.02] },
  ],
});

def({
  id: 'office_chair', name: 'Office chair', category: 'Furniture', material: 'plastic', mass: 14, size: 1.15,
  build() {
    const g = new THREE.Group();
    const mesh = FM.fabric(0x1f2126);
    const blk = FM.plastic(0x141518, 0.5);
    M(RB(0.5, 0.08, 0.48, 0.03), mesh, g, 0, 0.48, 0);
    M(RB(0.46, 0.62, 0.06, 0.03), mesh, g, 0, 0.86, 0.24).rotation.x = 0.12;
    M(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 12), FM.metal(0x8a8f96), g, 0, 0.3, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = M(new THREE.BoxGeometry(0.04, 0.03, 0.3), blk, g, Math.sin(a) * 0.15, 0.075, Math.cos(a) * 0.15);
      leg.rotation.y = a;
      M(new THREE.SphereGeometry(0.03, 10, 8), blk, g, Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29);
    }
    for (const s of [-1, 1]) M(RB(0.05, 0.03, 0.26, 0.012), blk, g, s * 0.27, 0.68, 0.02);
    return g;
  },
  shapes: [
    { t: 'box', s: [0.25, 0.04, 0.24], p: [0, 0.48, 0] },
    { t: 'box', s: [0.23, 0.31, 0.03], p: [0, 0.86, 0.24] },
    { t: 'cyl', r: 0.03, h: 0.18, p: [0, 0.27, 0] },
    { t: 'cyl', r: 0.3, h: 0.04, p: [0, 0.05, 0] },
  ],
});

def({
  id: 'pc_tower', name: 'Gaming PC', category: 'Electronics', material: 'metal', mass: 11, size: 0.48,
  build() {
    const g = new THREE.Group();
    M(RB(0.22, 0.48, 0.46, 0.01), FM.metal(0x17181b, 0.4), g, 0, 0.24, 0);
    const side = M(new THREE.PlaneGeometry(0.4, 0.4), FM.glass(), g, 0.111, 0.25, 0);
    side.rotation.y = Math.PI / 2;
    const rgb = new THREE.MeshBasicMaterial({ color: 0x7a5cff, toneMapped: false });
    for (let i = 0; i < 3; i++) M(new THREE.TorusGeometry(0.05, 0.006, 6, 20), rgb, g, 0.0, 0.12 + i * 0.12, 0.225).castShadow = false;
    return g;
  },
  shapes: [{ t: 'box', s: [0.11, 0.24, 0.23], p: [0, 0.24, 0] }],
});

def({
  id: 'monitor', name: '27" monitor', category: 'Electronics', material: 'plastic', mass: 5.5, size: 0.62,
  build() {
    const g = new THREE.Group();
    const blk = FM.plastic(0x121315, 0.4);
    M(RB(0.62, 0.37, 0.03, 0.006), blk, g, 0, 0.36, 0);
    M(new THREE.PlaneGeometry(0.6, 0.34), FM.screen(), g, 0, 0.36, 0.016).name = 'screen';
    M(new THREE.BoxGeometry(0.05, 0.2, 0.03), blk, g, 0, 0.13, -0.04);
    M(RB(0.24, 0.015, 0.18, 0.005), blk, g, 0, 0.0075, -0.02);
    return g;
  },
  shapes: [{ t: 'box', s: [0.31, 0.185, 0.015], p: [0, 0.36, 0] }, { t: 'box', s: [0.12, 0.008, 0.09], p: [0, 0.008, -0.02] }, { t: 'box', s: [0.025, 0.1, 0.015], p: [0, 0.13, -0.04] }],
});

def({
  id: 'keyboard', name: 'Mechanical keyboard', category: 'Electronics', material: 'plastic', mass: 0.9, size: 0.44,
  build() {
    const g = new THREE.Group();
    M(RB(0.44, 0.03, 0.14, 0.006), FM.plastic(0x1a1b1e, 0.5), g, 0, 0.015, 0);
    const key = FM.plastic(0x2a2c31, 0.55);
    const kg = RB(0.016, 0.012, 0.016, 0.003, 2);
    const keys = new THREE.InstancedMesh(kg, key, 15 * 5);
    let n = 0;
    const mtx = new THREE.Matrix4();
    for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) keys.setMatrixAt(n++, mtx.makeTranslation(-0.2 + c * 0.0285, 0.036, -0.054 + r * 0.027));
    keys.castShadow = true;
    keys.receiveShadow = true;
    g.add(keys);
    return g;
  },
  shapes: [{ t: 'box', s: [0.22, 0.02, 0.07], p: [0, 0.02, 0] }],
});

def({
  id: 'mouse_pc', name: 'Computer mouse', category: 'Electronics', material: 'plastic', mass: 0.08, size: 0.12,
  build() {
    const geo = new THREE.SphereGeometry(0.032, 18, 12);
    geo.scale(1, 0.55, 1.85);
    geo.translate(0, 0.012, 0);
    return new THREE.Mesh(geo, FM.plastic(0x1c1d21, 0.4));
  },
  shapes: [{ t: 'box', s: [0.031, 0.017, 0.058], p: [0, 0.017, 0] }],
});

// ---- bedroom -----------------------------------------------------------------------------------
def({
  id: 'bed_king', name: 'King bed', category: 'Furniture', material: 'wood', mass: 95, size: 2.25,
  build() {
    const g = new THREE.Group();
    const w = FM.wood(0x4a3424);
    M(RB(2.05, 0.3, 2.2, 0.02), w, g, 0, 0.2, 0);
    M(RB(2.05, 0.9, 0.08, 0.02), FM.fabric(0x3a3f47), g, 0, 0.75, -1.08); // headboard
    M(RB(1.95, 0.28, 2.05, 0.06), FM.fabric(0xf3f1ec), g, 0, 0.49, 0.03); // mattress
    M(RB(1.97, 0.1, 1.5, 0.05), FM.fabric(0x5d6e83), g, 0, 0.66, 0.3); // duvet
    for (const s of [-1, 1]) M(RB(0.75, 0.16, 0.45, 0.07), FM.fabric(0xffffff), g, s * 0.48, 0.71, -0.75);
    return g;
  },
  shapes: [
    { t: 'box', s: [1.025, 0.3, 1.1], p: [0, 0.33, 0] },
    { t: 'box', s: [1.025, 0.45, 0.04], p: [0, 0.75, -1.08] },
  ],
});

def({
  id: 'nightstand', name: 'Nightstand', category: 'Furniture', material: 'wood', mass: 12, size: 0.55,
  build() {
    const g = new THREE.Group();
    const w = FM.wood(0x4a3424);
    M(RB(0.5, 0.52, 0.4, 0.01), w, g, 0, 0.29, 0);
    M(new THREE.BoxGeometry(0.44, 0.2, 0.01), FM.wood(0x3e2c1e), g, 0, 0.4, 0.201);
    M(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), FM.metal(0xb79a5b), g, 0, 0.4, 0.215).rotation.z = Math.PI / 2;
    return g;
  },
  shapes: [{ t: 'box', s: [0.25, 0.26, 0.2], p: [0, 0.29, 0] }],
});

def({
  id: 'dining_chair', name: 'Dining chair', category: 'Furniture', material: 'wood', mass: 6, size: 0.9,
  build() {
    const g = new THREE.Group();
    const w = FM.wood(0x7a5634);
    M(RB(0.45, 0.04, 0.44, 0.01), w, g, 0, 0.46, 0);
    for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) M(new THREE.CylinderGeometry(0.018, 0.015, 0.45, 8), w, g, x, 0.225, z);
    for (const s of [-1, 1]) M(new THREE.BoxGeometry(0.03, 0.46, 0.03), w, g, s * 0.19, 0.7, -0.2);
    M(RB(0.42, 0.14, 0.025, 0.008), w, g, 0, 0.84, -0.2);
    return g;
  },
  shapes: [
    { t: 'box', s: [0.225, 0.02, 0.22], p: [0, 0.46, 0] },
    { t: 'box', s: [0.21, 0.23, 0.02], p: [0, 0.7, -0.2] },
    { t: 'box', s: [0.02, 0.225, 0.02], p: [-0.19, 0.225, -0.19] },
    { t: 'box', s: [0.02, 0.225, 0.02], p: [0.19, 0.225, -0.19] },
    { t: 'box', s: [0.02, 0.225, 0.02], p: [-0.19, 0.225, 0.19] },
    { t: 'box', s: [0.02, 0.225, 0.02], p: [0.19, 0.225, 0.19] },
  ],
});

def({
  id: 'terrarium', name: 'Glass terrarium', category: 'Containers', material: 'glass', mass: 14, size: 0.9,
  build() {
    const g = new THREE.Group();
    const frame = FM.metal(0x1a1b1e, 0.4);
    const W = 0.9, H = 0.45, D = 0.45;
    M(new THREE.BoxGeometry(W, 0.02, D), frame, g, 0, 0.01, 0);
    M(new THREE.BoxGeometry(W - 0.02, 0.03, D - 0.02), FM.soil(), g, 0, 0.035, 0);
    for (const [x, z, w, d] of [[0, D / 2, W, 0.006], [0, -D / 2, W, 0.006], [W / 2, 0, 0.006, D], [-W / 2, 0, 0.006, D]]) M(new THREE.BoxGeometry(w, H, d), FM.glass(), g, x, H / 2, z).castShadow = false;
    for (const [x, z] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) M(new THREE.BoxGeometry(0.015, H, 0.015), frame, g, x, H / 2, z);
    return g;
  },
  // Open-top glass box: floor + 4 walls, so things (and people) inside stay inside.
  shapes: [
    { t: 'box', s: [0.45, 0.025, 0.225], p: [0, 0.025, 0] },
    { t: 'box', s: [0.45, 0.225, 0.004], p: [0, 0.225, 0.225] },
    { t: 'box', s: [0.45, 0.225, 0.004], p: [0, 0.225, -0.225] },
    { t: 'box', s: [0.004, 0.225, 0.225], p: [0.45, 0.225, 0] },
    { t: 'box', s: [0.004, 0.225, 0.225], p: [-0.45, 0.225, 0] },
  ],
});
