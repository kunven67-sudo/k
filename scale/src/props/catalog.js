// The object catalog: every spawnable real-world thing, at real size and real weight.
// (Wave 1 starter set; the shopping app reads this list.)
import * as THREE from 'three';
import { std, phys } from '../render/materials.js';
import * as TX from '../render/textures.js';

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

// ---- shared materials ---------------------------------------------------------------------------
const M = {
  alu: () => once('alu', () => std({ color: 0xc9ccd1, metalness: 1, roughness: 0.28 })),
  ceramic: (c) => once('cer' + c, () => phys({ color: c, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1 })),
  wood: (c) => once('wood' + c, () => {
    const t = TX.woodFloor(c);
    return std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1 });
  }),
  cardboard: () => once('cardboard', () => {
    const t = TX.generate('cardboard', 256, (u, v) => {
      const f = TX.fbm(u, v, { freq: 12, oct: 4, seed: 101 });
      const fl = Math.sin(v * 256 * Math.PI) * 0.5 + 0.5;
      const d = 0.8 + f * 0.2;
      return [0.66 * d, 0.5 * d, 0.33 * d, f * 0.5 + fl * 0.2, 0.95];
    });
    return std({ map: t.map, normalMap: t.normalMap, roughness: 0.95 });
  }),
  cookie: () => once('cookie', () => {
    const t = TX.generate('cookie', 256, (u, v) => {
      const f = TX.fbm(u, v, { freq: 6, oct: 5, seed: 111 });
      const chip = TX.fbm(u, v, { freq: 5, oct: 2, seed: 112 }) > 0.68;
      if (chip) return [0.18, 0.1, 0.05, 0.9, 0.5];
      const d = 0.75 + f * 0.35;
      return [0.78 * d, 0.55 * d, 0.3 * d, f, 0.9];
    }, { normalStrength: 5 });
    return std({ map: t.map, normalMap: t.normalMap, roughness: 0.85 });
  }),
  rubber: (c) => once('rub' + c, () => std({ color: c, roughness: 0.55 })),
  paper: (c) => once('paper' + c, () => std({ color: c, roughness: 0.9 })),
};

// Soda can label: drawn on a canvas, wraps around the can body.
function canLabel(brand, c1, c2) {
  return once('label' + brand, () => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 256;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = 'bold 74px Arial Black, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(128, 128);
    g.rotate(-Math.PI / 2);
    g.fillText(brand, 0, 0);
    g.restore();
    g.save();
    g.translate(384, 128);
    g.rotate(-Math.PI / 2);
    g.fillText(brand, 0, 0);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 20; i++) g.fillRect(0, 20 + i * 11, 512, 2);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return std({ map: t, metalness: 0.65, roughness: 0.3 });
  });
}

// ---- definitions --------------------------------------------------------------------------------
export const CATALOG = {};
function def(d) {
  CATALOG[d.id] = d;
  return d;
}

// 12 oz can: 12.2 cm tall, 6.6 cm wide, 14 g empty + 355 ml of soda = about 0.38 kg.
def({
  id: 'soda_can', name: 'Soda can', category: 'Food & drink', material: 'aluminum', mass: 0.383, size: 0.122,
  build() {
    const g = new THREE.Group();
    const R = 0.033;
    const prof = [[0.0, 0], [0.025, 0.0], [0.027, 0.003], [0.026, 0.006], [R, 0.012], [R, 0.108], [0.0295, 0.116], [0.027, 0.1205], [0.0272, 0.122], [0.025, 0.1215], [0.0, 0.1205]];
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), 40), M.alu());
    const label = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.002, R * 1.002, 0.094, 40, 1, true), canLabel('FIZZ', '#c4121f', '#7a0610'));
    label.position.y = 0.06;
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0008, 0.02), M.alu());
    tab.position.set(0, 0.1215, 0.004);
    g.add(body, label, tab);
    return g;
  },
  shapes: [{ t: 'cyl', r: 0.033, h: 0.061, p: [0, 0.061, 0] }],
});

// Coffee mug: about 9.5 cm tall, 8 cm wide, 0.35 kg (ceramic).
def({
  id: 'mug', name: 'Coffee mug', category: 'Kitchen', material: 'ceramic', mass: 0.35, size: 0.11,
  build() {
    const g = new THREE.Group();
    const outer = [[0, 0], [0.036, 0], [0.04, 0.004], [0.04, 0.095], [0.036, 0.095], [0.036, 0.008], [0, 0.008]];
    const body = new THREE.Mesh(new THREE.LatheGeometry(outer.map((p) => new THREE.Vector2(p[0], p[1])), 36), M.ceramic(0x2f5d8c));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 10, 24, Math.PI), M.ceramic(0x2f5d8c));
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.04, 0.048, 0);
    g.add(body, handle);
    return g;
  },
  shapes: [{ t: 'cyl', r: 0.04, h: 0.0475, p: [0, 0.0475, 0] }, { t: 'box', s: [0.014, 0.026, 0.006], p: [0.055, 0.048, 0] }],
});

// Chocolate chip cookie: 7.5 cm across, 1 cm thick, 15 g.
def({
  id: 'cookie', name: 'Chocolate chip cookie', category: 'Food & drink', material: 'food', mass: 0.015, size: 0.075,
  build() {
    const geo = new THREE.CylinderGeometry(0.0375, 0.036, 0.01, 28, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const n = Math.sin(x * 220) * Math.cos(z * 190) * 0.0012 + Math.sin(Math.atan2(z, x) * 7) * 0.0012;
      p.setXYZ(i, x * (1 + n * 8), p.getY(i) + (p.getY(i) > 0 ? n : 0) + 0.005, z * (1 + n * 8));
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, M.cookie());
  },
  shapes: [{ t: 'cyl', r: 0.037, h: 0.005, p: [0, 0.005, 0] }],
});

// A crumb: 2-4 mm bit of cookie or chip. Real things this small weigh a few milligrams.
def({
  id: 'crumb', name: 'Crumb', category: 'Food & drink', material: 'food', mass: 0.000006, size: 0.003, noShadow: false,
  build() {
    const geo = new THREE.IcosahedronGeometry(0.0015, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.25), p.getY(i) * 0.7, p.getZ(i) * (1 + Math.cos(i * 2.3) * 0.25));
    geo.computeVertexNormals();
    geo.translate(0, 0.001, 0);
    return new THREE.Mesh(geo, M.cookie());
  },
  shapes: [{ t: 'ball', r: 0.0012, p: [0, 0.0011, 0] }],
});

// Moving box: 45 x 30 x 30 cm, 0.6 kg empty.
def({
  id: 'box', name: 'Cardboard box', category: 'Containers', material: 'cardboard', mass: 0.6, size: 0.45,
  build() {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.3), M.cardboard());
    m.position.y = 0.15;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.452, 0.002, 0.05), std({ color: 0xc8a96b, roughness: 0.4 }));
    tape.position.y = 0.301;
    const g = new THREE.Group();
    g.add(m, tape);
    return g;
  },
  shapes: [{ t: 'box', s: [0.225, 0.15, 0.15], p: [0, 0.15, 0] }],
});

// Playground rubber ball: 22 cm, 0.4 kg.
def({
  id: 'ball', name: 'Rubber ball', category: 'Toys', material: 'rubber', mass: 0.4, size: 0.22,
  build() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), M.rubber(0xd2452c));
    m.position.y = 0.11;
    return m;
  },
  shapes: [{ t: 'ball', r: 0.11, p: [0, 0.11, 0] }],
});

// Hardcover book: 24 x 16 x 3 cm, 0.7 kg.
def({
  id: 'book', name: 'Hardcover book', category: 'Home', material: 'paper', mass: 0.7, size: 0.24,
  build() {
    const g = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.24), M.paper(0x23395b));
    cover.position.y = 0.015;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.026, 0.232), M.paper(0xf1ead8));
    pages.position.set(0.005, 0.015, 0);
    g.add(cover, pages);
    return g;
  },
  shapes: [{ t: 'box', s: [0.08, 0.015, 0.12], p: [0, 0.015, 0] }],
});

// Kitchen table: 150 x 90 cm top, 75 cm tall, about 30 kg (solid wood).
def({
  id: 'table', name: 'Wood table', category: 'Furniture', material: 'wood', mass: 30, size: 1.5,
  build() {
    const g = new THREE.Group();
    const w = M.wood(0x7a4c2c);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.9), w);
    top.position.y = 0.73;
    g.add(top);
    for (const [x, z] of [[-0.68, -0.38], [0.68, -0.38], [-0.68, 0.38], [0.68, 0.38]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.71, 0.06), w);
      leg.position.set(x, 0.355, z);
      g.add(leg);
    }
    const apron = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.8), w);
    apron.position.y = 0.67;
    g.add(apron);
    return g;
  },
  // Legs are separate shapes so a tiny you can walk between them under the table.
  shapes: [
    { t: 'box', s: [0.75, 0.02, 0.45], p: [0, 0.73, 0] },
    { t: 'box', s: [0.7, 0.04, 0.4], p: [0, 0.67, 0] },
    { t: 'box', s: [0.03, 0.355, 0.03], p: [-0.68, 0.355, -0.38] },
    { t: 'box', s: [0.03, 0.355, 0.03], p: [0.68, 0.355, -0.38] },
    { t: 'box', s: [0.03, 0.355, 0.03], p: [-0.68, 0.355, 0.38] },
    { t: 'box', s: [0.03, 0.355, 0.03], p: [0.68, 0.355, 0.38] },
  ],
});
