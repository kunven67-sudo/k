// Spiders: four real California species with real bodies and real ways of moving.
//
//  - Western black widow (Latrodectus hesperus): glossy black, red hourglass under the belly. Hangs
//    upside down in a messy tangle web in dark corners (garages, woodpiles). Strong venom.
//  - Garden orb weaver (Araneus diadematus): big round brown abdomen with a white cross of spots,
//    banded legs. Builds the classic wheel web and waits head-down in the middle.
//  - Red-backed jumping spider (Phidippus johnsoni): stocky, black with a red back, huge front eyes,
//    teal fangs. No catching web: it watches, stalks and pounces.
//  - Cellar spider (Pholcus phalangioides): tiny body, extremely long thin legs, pale. Messy webs in
//    ceiling corners; whirls itself into a blur when disturbed.
//
// Every spider is built at its real size (meters), facing -Z with its back up (+Y), and walks on any
// surface: floors, walls, ceilings (real spiders hold on with thousands of tiny hairs on their feet),
// and along the threads of webs. Its eight legs really step, four at a time (spiders walk with two
// alternating groups of four legs).
import * as THREE from 'three';
import { phys, std } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { clamp, damp, hash3 } from '../core/util.js';
import { Creature, Leg, segmentGeo, solveKnee, aimSegment } from './creature.js';
import { terminalVelocity } from '../props/prop.js';
import { makeThin } from '../render/thin.js';
import { latheSeg, legPiece, withHairs, plain, combDistal, combBack } from './bodyparts.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _o = new THREE.Vector3();
const _X = new THREE.Vector3();
const _Z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pole = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

// ---- textures -----------------------------------------------------------------------------------
// Abdomen textures are painted in (u, v) = (around, along): u = 0 is the belly, u = 0.5 the back;
// v = 0 is the front (by the waist), v = 1 the tip (spinnerets).
function paint(key, w, h, draw) {
  return once('tex:' + key, () => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    draw(c, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

function speckle(c, w, h, n, color, rMin, rMax, seed) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = hash3(i, 1, 0, seed) * w, y = hash3(i, 2, 0, seed) * h;
    const r = rMin + hash3(i, 3, 0, seed) * (rMax - rMin);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
}

const TEX = {
  // Black widow: glossy black all over, the red hourglass on the belly (two triangles tip to tip).
  widowAbdomen: () => paint('widowAbd', 256, 256, (c, w, h) => {
    c.fillStyle = '#0b0b0d';
    c.fillRect(0, 0, w, h);
    speckle(c, w, h, 260, 'rgba(40,40,48,0.35)', 1, 3, 901);
    c.fillStyle = '#c4122b';
    for (const cx of [0, w]) {
      const hw = w * 0.055;
      c.beginPath();
      c.moveTo(cx - hw, h * 0.36);
      c.lineTo(cx + hw, h * 0.36);
      c.lineTo(cx, h * 0.56);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(cx, h * 0.58);
      c.lineTo(cx + hw * 1.15, h * 0.8);
      c.lineTo(cx - hw * 1.15, h * 0.8);
      c.closePath();
      c.fill();
    }
  }),
  widowBody: () => paint('widowBody', 64, 64, (c, w, h) => {
    c.fillStyle = '#0d0d10';
    c.fillRect(0, 0, w, h);
    speckle(c, w, h, 40, 'rgba(45,40,40,0.4)', 0.5, 1.5, 902);
  }),
  // Garden orb weaver: brown, a darker leaf-shaped pattern (the folium) down the back, and the white
  // cross of spots it's named for (the "cross spider").
  orbAbdomen: () => paint('orbAbd', 256, 256, (c, w, h) => {
    c.fillStyle = '#9b6b3f';
    c.fillRect(0, 0, w, h);
    speckle(c, w, h, 500, 'rgba(70,45,25,0.45)', 1, 4, 911);
    // Belly: darker with two pale bands.
    c.fillStyle = 'rgba(40,26,16,0.85)';
    c.fillRect(0, 0, w * 0.18, h);
    c.fillRect(w * 0.82, 0, w * 0.18, h);
    c.fillStyle = 'rgba(220,200,160,0.7)';
    for (const x of [w * 0.06, w * 0.94]) c.fillRect(x - 3, h * 0.2, 6, h * 0.55);
    // Folium: a scalloped dark band along the back.
    c.fillStyle = '#5b3a1f';
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.05);
    for (let i = 0; i <= 10; i++) {
      const y = h * (0.08 + i * 0.085);
      const wide = (0.16 - i * 0.012) * w * (i % 2 ? 0.75 : 1);
      c.lineTo(w * 0.5 + wide, y);
    }
    c.lineTo(w * 0.5, h * 0.99);
    for (let i = 10; i >= 0; i--) {
      const y = h * (0.08 + i * 0.085);
      const wide = (0.16 - i * 0.012) * w * (i % 2 ? 0.75 : 1);
      c.lineTo(w * 0.5 - wide, y);
    }
    c.closePath();
    c.fill();
    // The white cross.
    c.fillStyle = '#f2ead8';
    const dot = (x, y, r) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };
    for (let i = 0; i < 7; i++) dot(w * 0.5, h * (0.1 + i * 0.05), 4.2 - i * 0.2);
    for (const s of [-1, 1]) for (let i = 1; i <= 3; i++) dot(w * (0.5 + s * i * 0.032), h * 0.24, 3.8 - i * 0.4);
    speckle(c, w * 0.3, h, 30, 'rgba(240,230,210,0.8)', 1, 2.2, 912);
  }),
  orbBody: () => paint('orbBody', 64, 64, (c, w, h) => {
    c.fillStyle = '#7e5634';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#4a301b';
    c.fillRect(w * 0.42, 0, w * 0.16, h);
    speckle(c, w, h, 30, 'rgba(200,170,130,0.5)', 0.5, 1.5, 913);
  }),
  // Banded legs (light and dark rings, real for orb weavers).
  orbLeg: () => paint('orbLeg', 8, 64, (c, w, h) => {
    c.fillStyle = '#a77a4c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#4a2f1a';
    for (const y of [0.18, 0.55, 0.88]) c.fillRect(0, h * y, w, h * 0.12);
  }),
  // Red-backed jumping spider (female): red back with a black stripe, black sides and belly.
  jumperAbdomen: () => paint('jumpAbd', 256, 256, (c, w, h) => {
    c.fillStyle = '#121012';
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(w * 0.28, 0, w * 0.72, 0);
    g.addColorStop(0, 'rgba(180,30,24,0)');
    g.addColorStop(0.15, '#c22a1e');
    g.addColorStop(0.85, '#c22a1e');
    g.addColorStop(1, 'rgba(180,30,24,0)');
    c.fillStyle = g;
    c.fillRect(w * 0.28, h * 0.04, w * 0.44, h * 0.92);
    c.fillStyle = '#121012';
    c.fillRect(w * 0.47, h * 0.12, w * 0.06, h * 0.84);
    speckle(c, w, h, 900, 'rgba(0,0,0,0.25)', 0.5, 1.5, 921); // hairs
    speckle(c, w * 0.4, h, 14, 'rgba(240,240,240,0.7)', 1.5, 2.5, 922);
  }),
  jumperBody: () => paint('jumpBody', 64, 64, (c, w, h) => {
    c.fillStyle = '#111013';
    c.fillRect(0, 0, w, h);
    speckle(c, w, h, 160, 'rgba(70,70,80,0.35)', 0.4, 1.0, 923);
  }),
  jumperLeg: () => paint('jumpLeg', 8, 64, (c, w, h) => {
    c.fillStyle = '#121114';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(210,210,205,0.55)';
    for (const y of [0.02, 0.92]) c.fillRect(0, h * y, w, h * 0.07);
  }),
  // Cellar spider: pale and see-through-looking, faint gray marks, dark rings at the knees.
  cellarAbdomen: () => paint('cellAbd', 128, 128, (c, w, h) => {
    c.fillStyle = '#c9bca0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(120,105,85,0.45)';
    for (let i = 0; i < 6; i++) c.fillRect(w * 0.4, h * (0.12 + i * 0.14), w * 0.2, h * 0.06);
    speckle(c, w, h, 60, 'rgba(110,95,80,0.3)', 1, 3, 931);
  }),
  cellarBody: () => paint('cellBody', 32, 32, (c, w, h) => {
    c.fillStyle = '#cdbf9f';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(100,85,70,0.55)';
    c.fillRect(w * 0.35, 0, w * 0.3, h * 0.6);
  }),
  cellarLeg: () => paint('cellLeg', 8, 128, (c, w, h) => {
    c.fillStyle = '#b9ab90';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#4d4133';
    c.fillRect(0, h * 0.9, w, h * 0.1);
    c.fillStyle = '#efe9da';
    c.fillRect(0, h * 0.84, w, h * 0.05);
  }),
};

function speciesMats(key) {
  return once('mats:' + key, () => {
    const M = speciesMatsRaw(key);
    // Skin and hairs use per-vertex brightness; legs can be thinner than a pixel (cellar spiders).
    for (const m of [M.abd, M.body, M.leg, M.hairBody, M.hairAbd, M.hairLeg]) m.vertexColors = true;
    makeThin(M.leg);
    return M;
  });
}

// Fine combed-hair bumps (for hairy species) and pitted armor (for glossy ones), as normal maps.
const HAIR_NORMAL = () => TX.generate('setaeN', 256, (u, v) => {
  const streak = TX.fbm(u * 18, v * 2.2, { freq: 6, oct: 3, seed: 951 });
  return [0.5, 0.5, 0.5, streak, 0.6];
}, { normalStrength: 2.5 });
const CHITIN_NORMAL = () => TX.generate('chitinN', 256, (u, v) => {
  const n = TX.fbm(u, v, { freq: 22, oct: 3, seed: 952 });
  return [0.5, 0.5, 0.5, n, 0.3];
}, { normalStrength: 0.8 });

function speciesMatsRaw(key) {
  const eye = phys({ color: 0x030304, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }, { detail: 'glass' });
  const fang = phys({ color: 0x1a120c, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15 }, { detail: 'chitin' });
  const hairN = HAIR_NORMAL().normalMap, chitN = CHITIN_NORMAL().normalMap;
  // Hairy: soft velvet sheen at the edges (light catching thousands of fine hairs).
  const fuzz = (o, sheenColor) => ({ roughness: 0.62, sheen: 0.9, sheenRoughness: 0.45, sheenColor: new THREE.Color(sheenColor), normalMap: hairN, normalScale: new THREE.Vector2(0.6, 0.6), ...o });
  switch (key) {
    case 'widow': {
      // Glossy black armor (a widow is shiny, with very little hair).
      const shine = { roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.14, normalMap: chitN, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.85 };
      const hair = phys({ color: 0x18181c, roughness: 0.5 }, { detail: 'chitin' });
      return { abd: phys({ map: TEX.widowAbdomen(), ...shine }, { detail: 'chitin' }), body: phys({ map: TEX.widowBody(), ...shine }, { detail: 'chitin' }), leg: phys({ color: 0x0c0b0e, ...shine }, { detail: 'chitin' }), hairBody: hair, hairAbd: hair, hairLeg: hair, eye, fang };
    }
    case 'orb':
      return {
        abd: phys(fuzz({ map: TEX.orbAbdomen() }, 0xd9c2a0), { detail: 'chitin' }),
        body: phys(fuzz({ map: TEX.orbBody() }, 0xc9b090), { detail: 'chitin' }),
        leg: phys(fuzz({ map: TEX.orbLeg(), roughness: 0.5 }, 0xc8ad88), { detail: 'chitin' }),
        hairBody: phys({ map: TEX.orbBody(), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xe8d8c0) }, { detail: 'chitin' }),
        hairAbd: phys({ map: TEX.orbAbdomen(), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xe8d8c0) }, { detail: 'chitin' }),
        hairLeg: phys({ map: TEX.orbLeg(), roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xe0cca8) }, { detail: 'chitin' }),
        eye, fang,
      };
    case 'jumper':
      return {
        abd: phys(fuzz({ map: TEX.jumperAbdomen(), roughness: 0.7 }, 0xff8a70), { detail: 'fabric' }),
        body: phys(fuzz({ map: TEX.jumperBody(), roughness: 0.66 }, 0x9a9aa8), { detail: 'fabric' }),
        leg: phys(fuzz({ map: TEX.jumperLeg(), roughness: 0.66 }, 0xb0b0bc), { detail: 'fabric' }),
        hairBody: phys({ map: TEX.jumperBody(), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xd0d0dc) }, { detail: 'fabric' }),
        hairAbd: phys({ map: TEX.jumperAbdomen(), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xffb0a0) }, { detail: 'fabric' }),
        hairLeg: phys({ map: TEX.jumperLeg(), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xe0e0e8) }, { detail: 'fabric' }),
        // Big front eyes: dark amber glass you can see a little way into.
        eye: phys({ color: 0x120a05, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 1.8 }, { detail: 'glass' }),
        // Their fangs (chelicerae) are a shiny metallic teal-green, a real and famous detail.
        fang: phys({ color: 0x1fa58a, metalness: 0.65, roughness: 0.22, clearcoat: 0.8, iridescence: 0.8, iridescenceIOR: 1.6 }, { detail: 'chitin' }),
      };
    default: {
      // Cellar spider: pale, a little see-through looking (soft sheen, lighter edges).
      const pale = { roughness: 0.4, sheen: 0.5, sheenRoughness: 0.3, sheenColor: new THREE.Color(0xfff4e0), normalMap: chitN, normalScale: new THREE.Vector2(0.2, 0.2) };
      const hair = phys({ color: 0xe0d8c8, roughness: 0.5 }, { detail: 'chitin' });
      return { abd: phys({ map: TEX.cellarAbdomen(), ...pale }, { detail: 'chitin' }), body: phys({ map: TEX.cellarBody(), ...pale }, { detail: 'chitin' }), leg: phys({ map: TEX.cellarLeg(), ...pale }, { detail: 'chitin' }), hairBody: hair, hairAbd: hair, hairLeg: hair, eye, fang };
    }
  }
}

// ---- geometry helpers -----------------------------------------------------------------------------
// A body part shaped by its profile r(t) along +Z (t 0 = front .. 1 = back), with an oval cross-section.
function pod(len, r, { segs = 26, radial = 18, flatY = 1, flatX = 1 } = {}) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector2(Math.max(1e-6, r(t)), t * len));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  g.rotateX(Math.PI / 2); // +Y -> +Z, and the start of the lathe (u = 0) ends up underneath
  g.scale(flatX, flatY, 1);
  g.computeVertexNormals();
  return g;
}

// A boxy rounded shape (jumping spider carapace): a sphere pushed toward a box.
function superEllipsoid(rx, ry, rz, e = 0.55, w = 22, h = 16) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, Math.sign(x) * Math.abs(x) ** e * rx, Math.sign(y) * Math.abs(y) ** e * ry, Math.sign(z) * Math.abs(z) ** e * rz);
  }
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---- species (real sizes, meters) -----------------------------------------------------------------
// L: body length. car/abd: half sizes (x wide, y tall, z long) and center z. ride: carapace center
// height. legs: total length of legs I..IV, legR: leg thickness (radius). Eyes in each family's real
// arrangement.
export const SPECIES = {
  widow: {
    id: 'black_widow', name: 'Western black widow', sci: 'Latrodectus hesperus', mats: 'widow', price: 12.99,
    L: 0.0095, mass: 0.0009, ride: 0.0022,
    car: { w: 0.0014, h: 0.0007, l: 0.0018, z: -0.0026 }, abd: { w: 0.00275, h: 0.0025, l: 0.0065, z: -0.0006, lift: 0.0011, shape: 'globe' },
    legs: [0.022, 0.0155, 0.0112, 0.0182], legR: 0.00022, spread: 0.6,
    eyes: 'rows', speed: 0.05, venom: 'neurotoxic',
  },
  orb: {
    id: 'orb_weaver', name: 'Garden orb weaver', sci: 'Araneus diadematus', mats: 'orb', price: 9.99,
    L: 0.014, mass: 0.0012, ride: 0.0028,
    car: { w: 0.002, h: 0.001, l: 0.0025, z: -0.0042 }, abd: { w: 0.004, h: 0.0035, l: 0.0095, z: -0.0017, lift: 0.0016, shape: 'shield' },
    legs: [0.018, 0.0165, 0.0105, 0.015], legR: 0.00032, spread: 0.58,
    eyes: 'rows', speed: 0.06, venom: 'mild',
  },
  jumper: {
    id: 'jumping_spider', name: 'Red-backed jumping spider', sci: 'Phidippus johnsoni', mats: 'jumper', price: 14.99,
    L: 0.012, mass: 0.0003, ride: 0.0024,
    car: { w: 0.0021, h: 0.0013, l: 0.0026, z: -0.0032, boxy: true }, abd: { w: 0.0023, h: 0.0018, l: 0.0068, z: -0.0006, lift: 0.0002, shape: 'egg' },
    legs: [0.0105, 0.0088, 0.0088, 0.0104], legR: 0.00045, spread: 0.55,
    eyes: 'jumper', speed: 0.12, venom: 'mild',
  },
  cellar: {
    id: 'cellar_spider', name: 'Cellar spider', sci: 'Pholcus phalangioides', mats: 'cellar', price: 6.99,
    L: 0.008, mass: 0.00006, ride: 0.0065,
    car: { w: 0.0011, h: 0.0005, l: 0.0011, z: -0.0024 }, abd: { w: 0.0011, h: 0.0012, l: 0.006, z: -0.0013, lift: 0.0004, shape: 'tube' },
    legs: [0.048, 0.034, 0.026, 0.031], legR: 0.00006, spread: 0.58,
    eyes: 'cellar', speed: 0.05, venom: 'mild',
  },
};

// Leg directions (angle from straight ahead, radians) for the hips and for where each foot rests.
const HIP_ANG = [0.45, 1.05, 1.75, 2.45];
const REST_ANG = [0.5, 1.15, 1.95, 2.65];

// Hair (setae) per species, real sizes: how many, how long, how thick, how flat they lie.
const HAIR = {
  widow: { leg: { perMm: 9, len: [0.00012, 0.00026], th: 0.000012, lean: 0.75 }, spines: null, car: { n: 40, len: [0.00008, 0.00016], th: 0.000009, lean: 0.85 }, abd: { n: 60, len: [0.0001, 0.0002], th: 0.00001, lean: 0.85 } },
  orb: { leg: { perMm: 22, len: [0.0002, 0.00045], th: 0.000016, lean: 0.7 }, spines: { perSeg: 7, len: [0.0006, 0.0011], th: 0.000035, lean: 0.3 }, car: { n: 380, len: [0.00015, 0.00035], th: 0.000012, lean: 0.75 }, abd: { n: 900, len: [0.0002, 0.0004], th: 0.000013, lean: 0.7 } },
  jumper: { leg: { perMm: 34, len: [0.00015, 0.00035], th: 0.000016, lean: 0.72 }, spines: { perSeg: 3, len: [0.0003, 0.0005], th: 0.00003, lean: 0.4 }, car: { n: 700, len: [0.00012, 0.0003], th: 0.000013, lean: 0.75 }, abd: { n: 1100, len: [0.00015, 0.00032], th: 0.000013, lean: 0.8 } },
  cellar: { leg: { perMm: 4, len: [0.00006, 0.00014], th: 0.000005, lean: 0.8 }, spines: null, car: { n: 30, len: [0.00006, 0.0001], th: 0.000006, lean: 0.8 }, abd: { n: 80, len: [0.00008, 0.00016], th: 0.000006, lean: 0.8 } },
};

// Carapace: narrow at the head, widest behind the middle, the head region raised, a small dent (the
// fovea, where muscles attach inside) on top, flatter underneath.
function carapaceGeo(c) {
  if (c.boxy) return superEllipsoid(c.w, c.h, c.l, 0.6);
  const g = new THREE.SphereGeometry(1, 30, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const zf = (z + 1) / 2; // 0 = front .. 1 = back
    const w = 0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, 0.22 + zf * 0.85));
    let h = y > 0 ? 1 + 0.22 * Math.exp(-(((zf - 0.25) / 0.2) ** 2)) : 0.55;
    const dent = y > 0 ? 0.14 * Math.exp(-(x * x + (z - 0.25) ** 2) / 0.025) : 0;
    p.setXYZ(i, x * c.w * w, y * c.h * h - dent * c.h, z * c.l);
  }
  g.computeVertexNormals();
  return g;
}

// Abdomen; orb weavers get the two "shoulder humps" at the front of theirs.
function abdomenGeo(a, prof, humps) {
  const g = pod(a.l, (t) => prof(t) * a.w, { flatY: a.h / a.w, segs: 30, radial: 24 });
  if (humps) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = z / a.l;
      const k = 0.2 * Math.exp(-(((t - 0.22) / 0.1) ** 2)) * Math.exp(-(((Math.abs(x) / a.w - 0.55) / 0.25) ** 2)) * Math.exp(-(((y / a.h - 0.6) / 0.35) ** 2));
      const l = Math.hypot(x, y) || 1;
      p.setXYZ(i, x + (x / l) * k * a.w, y + (y / l) * k * a.w, z);
    }
    g.computeVertexNormals();
  }
  return g;
}

// A body part with a near version (with hairs) and a far one (without): swapped by how big it looks.
function lodMesh(geoLo, geoHi, mats, parent, lods, kind, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geoLo, mats);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  lods.push({ mesh: m, lo: geoLo, hi: geoHi, kind });
  return m;
}

function grouped(g) {
  const out = plain(g);
  out.clearGroups();
  out.addGroup(0, out.attributes.position.count, 0);
  return out;
}

function buildSpider(sp) {
  const M = speciesMats(sp.mats);
  const H = HAIR[sp.mats];
  // Geometry is the same for every spider of a species: built once.
  const G = once('geo:' + sp.id, () => {
    const c = sp.car, a = sp.abd;
    const prof = {
      globe: (t) => Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.02)) ** 0.62,
      shield: (t) => (t < 0.35 ? Math.sin((t / 0.35) * Math.PI * 0.5) ** 0.55 : Math.cos(((t - 0.35) / 0.65) * Math.PI * 0.5) ** 0.75),
      egg: (t) => Math.sin(Math.PI * t) ** 0.7 * (1 - 0.15 * t),
      tube: (t) => Math.sin(Math.PI * t) ** 0.35,
    }[a.shape];
    const car = carapaceGeo(c);
    const abd = abdomenGeo(a, prof, sp.mats === 'orb');
    const hairy = (geo, h, comb, seed, spines) => withHairs(geo, { count: h.n ?? 0, len: h.len, th: h.th, lean: h.lean, comb, seed, spines });
    const legs = sp.legs.map((len, k) => {
      const lens = [len * 0.32, len * 0.53, len * 0.15];
      const rs = [sp.legR, sp.legR * 0.95, sp.legR * 0.85];
      const pieces = ['femur', 'shank', 'tarsus'].map((kind, i) => legPiece(kind, lens[i], rs[i]));
      return pieces.map((pc, i) => ({
        lo: grouped(pc),
        hi: withHairs(pc, {
          count: Math.round(H.leg.perMm * lens[i] * 1000), len: H.leg.len, th: H.leg.th, lean: H.leg.lean, comb: combDistal, seed: 100 + k * 10 + i,
          spines: H.spines && i < 2 ? { count: H.spines.perSeg, len: H.spines.len, th: H.spines.th, lean: H.spines.lean } : null,
        }),
      }));
    });
    const palp = [legPiece('femur', c.l * 0.55, sp.legR * 0.8), legPiece('shank', c.l * 0.6, sp.legR * (sp.mats === 'jumper' ? 1.15 : 0.75))];
    return {
      car: { lo: grouped(car), hi: hairy(car, H.car, combBack, 11) },
      abd: { lo: grouped(abd), hi: hairy(abd, H.abd, combBack, 12) },
      legs,
      palp: palp.map((pc, i) => withHairs(pc, { count: Math.round(H.leg.perMm * 0.7 * c.l * 1000), len: H.leg.len, th: H.leg.th, lean: 0.6, comb: combDistal, seed: 300 + i })),
    };
  });

  const root = new THREE.Group();
  root.name = sp.id;
  const body = new THREE.Group(); // bobs and tilts as it walks
  root.add(body);
  const lods = [];
  const c = sp.car, a = sp.abd;
  lodMesh(G.car.lo, G.car.hi, [M.body, M.hairBody], body, lods, 'body', 0, sp.ride, c.z);
  // Waist (pedicel).
  const ped = mesh(plain(segmentGeo(c.l * 0.35, c.w * 0.18, c.w * 0.16, 6)), M.body, body, 0, sp.ride, c.z + c.l * 0.85);
  ped.rotation.x = Math.PI / 2;
  const abdomen = new THREE.Group();
  abdomen.position.set(0, sp.ride + a.lift, a.z);
  body.add(abdomen);
  lodMesh(G.abd.lo, G.abd.hi, [M.abd, M.hairAbd], abdomen, lods, 'body');
  // Spinnerets at the tip.
  for (let i = 0; i < 3; i++) {
    const sn = mesh(plain(new THREE.ConeGeometry(a.w * 0.08, a.l * 0.07, 6)), M.body, abdomen, (i - 1) * a.w * 0.09, -a.h * 0.15 - (i === 1 ? a.h * 0.05 : 0), a.l * 0.985);
    sn.rotation.x = Math.PI / 2;
  }
  // Fangs (chelicerae: thick bases pointing down, curved fangs folded under) and palps.
  const front = c.z - c.l * 0.92;
  for (const s of [-1, 1]) {
    const chGeo = once('chel:' + sp.id, () => latheSeg(c.h * 1.4, (t) => c.w * (0.21 - 0.08 * t) * (t > 0.9 ? 1 - (t - 0.9) * 4 : 1), { segs: 10, radial: 10 }));
    const ch = mesh(chGeo, M.fang, body, s * c.w * 0.22, sp.ride - c.h * 0.1, front);
    ch.rotation.x = Math.PI - 0.35;
    const tooth = mesh(new THREE.ConeGeometry(c.w * 0.06, c.h * 0.6, 6), M.fang, ch, 0, c.h * 1.45, -c.w * 0.04);
    tooth.rotation.set(0.9, 0, s * -0.6);
    const p1 = new THREE.Mesh(G.palp[0], [M.leg, M.hairLeg]);
    p1.position.set(s * c.w * 0.45, sp.ride - c.h * 0.2, front + c.l * 0.1);
    p1.rotation.set(-0.9, 0, s * -0.35);
    body.add(p1);
    const p2 = new THREE.Mesh(G.palp[1], [M.leg, M.hairLeg]);
    p2.position.set(0, c.l * 0.55, 0);
    p2.rotation.set(1.5, 0, 0);
    p1.add(p2);
  }
  // Eyes.
  const eyes = [];
  const eye = (x, y, z, r) => {
    const e = mesh(new THREE.SphereGeometry(r, 14, 10), M.eye, body, x, y, z);
    eyes.push(e);
    return e;
  };
  const ey = sp.ride + c.h * 0.7, ez = c.z - c.l * 0.78;
  if (sp.eyes === 'rows') {
    // Two rows of four small eyes at the front of the head (cobweb and orb weaver spiders).
    for (const s of [-1, 1]) {
      eye(s * c.w * 0.12, ey, ez, c.w * 0.07);
      eye(s * c.w * 0.32, ey - c.h * 0.08, ez + c.l * 0.05, c.w * 0.06);
      eye(s * c.w * 0.14, ey + c.h * 0.22, ez + c.l * 0.13, c.w * 0.065);
      eye(s * c.w * 0.36, ey + c.h * 0.08, ez + c.l * 0.17, c.w * 0.055);
    }
  } else if (sp.eyes === 'jumper') {
    // Two huge front eyes (sharp, color vision), two smaller beside them, two tiny and two medium on top.
    const fz = c.z - c.l * 0.97;
    for (const s of [-1, 1]) {
      const big = eye(s * c.w * 0.27, sp.ride + c.h * 0.25, fz, c.w * 0.25);
      big.scale.z = 0.7;
      eye(s * c.w * 0.68, sp.ride + c.h * 0.4, fz + c.l * 0.1, c.w * 0.12);
      eye(s * c.w * 0.82, sp.ride + c.h * 0.8, c.z - c.l * 0.45, c.w * 0.04);
      eye(s * c.w * 0.78, sp.ride + c.h * 0.86, c.z + c.l * 0.05, c.w * 0.11);
    }
  } else {
    // Cellar spiders: two groups of three eyes on little bumps, and a tiny pair between them.
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) eye(s * c.w * (0.22 + i * 0.07), ey + c.h * (0.15 + (i === 1 ? 0.1 : 0)), ez + c.l * 0.05 * i, c.w * 0.07);
    for (const s of [-1, 1]) eye(s * c.w * 0.06, ey - c.h * 0.05, ez - c.l * 0.04, c.w * 0.04);
  }
  // Legs: hips around the edge of the carapace, four pairs, jointed and hairy.
  const legs = [];
  for (let k = 0; k < 4; k++) {
    for (const s of [-1, 1]) {
      const len = sp.legs[k];
      const ha = HIP_ANG[k], ra = REST_ANG[k];
      const hip = [s * Math.sin(ha) * c.w * 0.85, sp.ride - c.h * 0.15, c.z - Math.cos(ha) * c.l * 0.75];
      const reach = len * sp.spread;
      const rest = [hip[0] + s * Math.sin(ra) * reach, 0, hip[2] - Math.cos(ra) * reach];
      const l = new Leg({ hip, rest, femur: len * 0.32, tibia: len * 0.53, tarsus: len * 0.15, side: s, group: (k + (s > 0 ? 1 : 0)) % 2, mats: M, radius: [sp.legR, sp.legR * 0.82, sp.legR * 0.55] });
      l.pair = k;
      l.meshes.forEach((m, i) => {
        m.geometry.dispose();
        m.geometry = G.legs[k][i].lo;
        m.material = [M.leg, M.hairLeg];
        lods.push({ mesh: m, lo: G.legs[k][i].lo, hi: G.legs[k][i].hi, kind: 'leg' });
      });
      legs.push(l);
    }
  }
  root.userData.legs = legs;
  root.userData.body = body;
  root.userData.abdomen = abdomen;
  root.userData.eyes = eyes;
  root.userData.lods = lods;
  return root;
}

// Static leg pose (for shop photos): feet on the ground at their rest spots.
function poseLegsStatic(root) {
  for (const d of root.userData.lods) d.mesh.geometry = d.hi; // product photo: full detail
  for (const l of root.userData.legs) {
    for (const m of l.meshes) root.add(m);
    const foot = l.rest.clone();
    const out = new THREE.Vector3(foot.x - l.hip.x, 0, foot.z - l.hip.z).normalize();
    const ankle = foot.clone().addScaledVector(out, -l.len[2] * 0.75);
    ankle.y += l.len[2] * 0.3;
    const knee = solveKnee(l.hip, ankle, l.len[0], l.len[1], new THREE.Vector3(l.side * 0.3, 1, 0).normalize(), new THREE.Vector3());
    aimSegment(l.meshes[0], l.hip, knee.clone(), l.len[0]);
    aimSegment(l.meshes[1], knee, ankle, l.len[1]);
    aimSegment(l.meshes[2], ankle, foot, l.len[2]);
  }
}

// Shop/catalog definitions (one per species).
export function spiderDef(key, cls) {
  const sp = SPECIES[key];
  return {
    id: sp.id, name: sp.name, brand: sp.sci, category: 'Pets & bugs', material: 'chitin',
    size: sp.L, mass: sp.mass, ride: sp.ride, price: sp.price, spec: sp,
    // Body colliders: carapace + abdomen.
    shapes: [
      { t: 'ball', r: Math.max(sp.car.w, sp.car.l) * 0.9, p: [0, sp.ride, sp.car.z] },
      { t: 'ball', r: Math.max(sp.abd.w, sp.abd.h) * 0.95, p: [0, sp.ride + sp.abd.lift, sp.abd.z + sp.abd.l * 0.5] },
    ],
    build: () => {
      const m = buildSpider(sp);
      if (!cls) poseLegsStatic(m);
      return m;
    },
    buildLive: () => buildSpider(sp),
    spawn: cls ? (game, opts) => new cls(game, opts) : null,
  };
}

// ---- the living spider -----------------------------------------------------------------------------
// Moves on any surface: `up` is the surface's normal under it, `fwd` its heading along the surface.
export class Spider extends Creature {
  constructor(game, def, opts = {}) {
    const live = { ...def, build: def.buildLive };
    super(game, live, opts);
    this.sp = def.spec;
    this.up = this.up || new THREE.Vector3(0, 1, 0);
    this.fwd = this.fwd || new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (opts.up) this.up.fromArray(opts.up).normalize();
    if (opts.fwd) this._setFwd(_v.fromArray(opts.fwd));
    this.mode = 'surface';
    this.turnRate = opts.turnRate ?? 5;
    this.stepTime = 0.75;
    this.stepLen = 0.18;
    this.targetDir = null; // world direction it wants to head (projected on the surface)
    this.renderQ = new THREE.Quaternion();
    this.bodyG = this.model.userData.body;
    this.abdomenG = this.model.userData.abdomen;
    this._place(true);
    this.renderQ.copy(this._basisQ(_q));
  }

  // Heading along the surface (keeps it at right angles to `up`).
  _setFwd(d) {
    this.fwd.copy(d).addScaledVector(this.up, -d.dot(this.up));
    if (this.fwd.lengthSq() < 1e-10) this.fwd.set(1, 0, 0).addScaledVector(this.up, -this.up.x);
    this.fwd.normalize();
  }

  _basisQ(out) {
    // Model space: back = +Y (up), head = -Z (fwd).
    _Z.copy(this.fwd).negate();
    _X.crossVectors(this.up, _Z).normalize();
    _Z.crossVectors(_X, this.up).normalize();
    _m.makeBasis(_X, this.up, _Z);
    return out.setFromRotationMatrix(_m);
  }

  _syncBody(teleport = false) {
    if (!this.up) return super._syncBody(teleport);
    const q = this._basisQ(_q);
    const t = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    const r = { x: q.x, y: q.y, z: q.z, w: q.w };
    if (teleport) {
      this.body.setTranslation(t, true);
      this.body.setRotation(r, true);
    }
    this.body.setNextKinematicTranslation(t);
    this.body.setNextKinematicRotation(r);
  }

  _rayOpts() {
    const physics = this.game.physics;
    return {
      excludeBody: this.body,
      predicate: (c) => {
        const o = physics.ownerOf(c);
        return !(o && (o === this.game.player || o.kind === 'creature' || o.held));
      },
    };
  }

  update(dt) {
    if (!this.alive || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.think?.(dt);
    if (this.mode === 'surface') this._crawl(dt);
    else if (this.mode === 'air') this._fall(dt);
    else this.moveOther?.(dt);
    this._pose(dt);
    this._legs(dt);
    this.animate?.(dt);
    this._syncBody();
  }

  // ---- walking on surfaces -----------------------------------------------------------------------
  _crawl(dt) {
    const L = this.size;
    // Turn toward where it wants to go (spiders turn on the spot).
    if (this.targetDir) {
      _v.copy(this.targetDir).addScaledVector(this.up, -this.targetDir.dot(this.up));
      if (_v.lengthSq() > 1e-12) {
        _v.normalize();
        const ang = Math.acos(clamp(this.fwd.dot(_v), -1, 1));
        const maxT = this.turnRate * dt;
        if (ang > 1e-4) {
          const sgn = Math.sign(_v2.crossVectors(this.fwd, _v).dot(this.up)) || 1;
          _q.setFromAxisAngle(this.up, sgn * Math.min(ang, maxT));
          this.fwd.applyQuaternion(_q);
          this._setFwd(this.fwd);
        }
      }
    }
    this.speed = damp(this.speed, this.wantSpeed, 12, dt);
    const step = Math.abs(this.speed) * dt;
    if (step > 1e-9) {
      const n = Math.min(8, Math.ceil(step / (L * 0.25)));
      for (let i = 0; i < n; i++) if (!this._crawlStep(step / n)) break;
    }
    this._settle(dt);
  }

  // One small move along the surface. Handles walls ahead (climb onto them) and edges (go around).
  _crawlStep(d) {
    const physics = this.game.physics;
    const L = this.size;
    const h = this.sp.ride * this.scale;
    const opts = this._rayOpts();
    // 1. A surface ahead (a wall, the underside of something): climb onto it.
    _o.copy(this.pos).addScaledVector(this.up, h * 0.6);
    const wall = physics.raycast(_o, this.fwd, d + L * 0.35, opts);
    if (wall && wall.normal.dot(this.up) < 0.55) {
      const oldUp = _v3.copy(this.up);
      this.pos.copy(wall.point);
      this.up.copy(wall.normal);
      this._setFwd(oldUp);
      this.blocked = 0;
      return false;
    }
    // 2. Move, then find the surface under the new spot.
    _v.copy(this.pos).addScaledVector(this.fwd, d);
    _o.copy(_v).addScaledVector(this.up, h);
    _n.copy(this.up).negate();
    const under = physics.raycast(_o, _n, h * 2.2, opts);
    if (under && under.normal.dot(this.up) > 0.3) {
      this.pos.copy(under.point);
      this.up.lerp(under.normal, 0.5).normalize();
      this._setFwd(this.fwd);
      this.blocked = Math.max(0, this.blocked - 0.02);
      return true;
    }
    // 3. An edge: the surface turns away. Look back under the edge for the face around it.
    _o.copy(_v).addScaledVector(this.up, -h * 0.5);
    _n.copy(this.fwd).negate();
    const around = physics.raycast(_o, _n, d + L * 0.5, opts);
    if (around && around.normal.dot(this.up) < 0.6) {
      const oldUp = _v3.copy(this.up).negate();
      this.pos.copy(around.point);
      this.up.copy(around.normal);
      this._setFwd(oldUp);
      return false;
    }
    // 4. Nothing to hold on to: stop (it turns around in its own time).
    this.blocked += 0.05;
    this.speed = 0;
    return false;
  }

  // Stay on the surface (things move, get shrunk...); fall if it's gone.
  _settle(dt) {
    const physics = this.game.physics;
    const h = this.sp.ride * this.scale;
    _o.copy(this.pos).addScaledVector(this.up, h);
    _n.copy(this.up).negate();
    const hit = physics.raycast(_o, _n, h * 1.6, this._rayOpts());
    if (hit) {
      this.pos.copy(hit.point);
      this.up.lerp(hit.normal, Math.min(1, dt * 20)).normalize();
      this._setFwd(this.fwd);
    } else {
      this.mode = 'air';
      this.velY = 0;
    }
  }

  // Falling (world gravity, real terminal velocity for its size); lands on whatever it hits.
  _fall(dt) {
    const physics = this.game.physics;
    const L = this.size;
    const vt = terminalVelocity(L, 300);
    this.velY -= 9.81 * dt;
    this.velY -= Math.sign(this.velY) * 9.81 * (this.velY / vt) ** 2 * dt;
    const dy = this.velY * dt;
    const hit = physics.raycast(_o.copy(this.pos).addScaledVector(UP, L * 0.2), DOWN, -dy + L * 0.2, this._rayOpts());
    // Turn upright while falling (spiders right themselves in the air).
    this.up.lerp(UP, Math.min(1, dt * 6)).normalize();
    this._setFwd(this.fwd);
    if (hit && hit.normal.y > 0.3) {
      this.pos.copy(hit.point);
      this.up.copy(hit.normal);
      this._setFwd(this.fwd);
      this.mode = 'surface';
      this.velY = 0;
      this.onLand?.();
    } else {
      this.pos.y += dy;
      if (this.pos.y < -60) this.respawnSafe();
    }
  }

  // Put the model where the body is (orientation eases a little so corners look smooth).
  _pose(dt) {
    this.yaw = Math.atan2(-this.fwd.x, -this.fwd.z); // heading as an angle (what eyesight checks use)
    const q = this._basisQ(_q);
    this.renderQ.slerp(q, Math.min(1, dt * 18));
    this.object.position.copy(this.pos);
    this.object.quaternion.copy(this.renderQ);
    this.object.scale.setScalar(this.scale);
    this.object.updateMatrixWorld(true);
  }

  _place(snap) {
    if (!this.up) return super._place(snap);
    if (snap) {
      // Find the surface under it (along its own down).
      const physics = this.game.physics;
      const h = this.sp ? this.sp.ride * this.scale : this.size * 0.2;
      _n.copy(this.up).negate();
      const hit = physics.raycast(_o.copy(this.pos).addScaledVector(this.up, h), _n, this.size * 50 + 2, this._rayOpts());
      if (hit) {
        this.pos.copy(hit.point);
        this.up.copy(hit.normal);
        this._setFwd(this.fwd);
      }
    }
    this._pose(1);
    if (snap) for (const l of this.legs) this._plant(l, true);
  }

  // ---- on a web --------------------------------------------------------------------------------------
  // On its web a spider walks along the threads (the dry ones when it can: it doesn't get stuck in its
  // own spiral). An orb weaver sits flat against its web; cobweb and cellar spiders hang upside down.
  enterWeb(web, node) {
    this.mode = 'web';
    this.web = web;
    this.wNode = node;
    this.path = null;
    this.wT = 0;
    this.pos.copy(web.nodes[node]);
    this.webSide = 1;
  }

  webGo(target) {
    if (!this.web || target < 0) return false;
    if (target === this.wNode) {
      this.path = null;
      return true;
    }
    this.path = this.web.path(this.wNode, target, { avoidSticky: true });
    this.wT = 0;
    return !!this.path;
  }

  get webArrived() {
    return !this.path;
  }

  moveOther(dt) {
    if (this.mode === 'web') return this._webMove(dt);
    if (this.mode === 'dangle') return this._dangle?.(dt);
    if (this.mode === 'leap') return this._leap?.(dt);
  }

  _webMove(dt) {
    const w = this.web;
    let moving = false;
    _v3.set(0, 0, 0);
    if (this.path && this.path.length > 1) {
      this.speed = damp(this.speed, this.wantSpeed, 12, dt);
      let a = w.nodes[this.path[0]], b = w.nodes[this.path[1]];
      this.wT += (this.speed * dt) / Math.max(1e-6, a.distanceTo(b));
      while (this.wT >= 1 && this.path.length > 1) {
        this.wT -= 1;
        this.path.shift();
        this.wNode = this.path[0];
        if (this.path.length > 1) {
          a = w.nodes[this.path[0]];
          b = w.nodes[this.path[1]];
        }
      }
      if (this.path.length <= 1) {
        this.path = null;
        this.wT = 0;
        this.pos.copy(w.nodes[this.wNode]);
      } else {
        this.pos.lerpVectors(a, b, Math.min(1, this.wT));
        _v3.subVectors(b, a).normalize();
        moving = true;
      }
    } else {
      this.speed = 0;
      this.pos.copy(w.nodes[this.wNode]);
    }
    // Which way is "up" for its back: off the web's face (orb), or toward the floor (hanging).
    if (w.plane) _n.copy(w.plane.normal).multiplyScalar(this.webSide);
    else _n.set(0, -1, 0);
    this.up.lerp(_n, Math.min(1, dt * 10)).normalize();
    // Facing: where it's going; resting on an orb it hangs head-down (like real orb weavers).
    if (moving) _v.copy(_v3);
    else if (w.plane) _v.copy(w.plane.ay).negate();
    else _v.copy(this.fwd);
    _v2.copy(this.fwd).lerp(_v, Math.min(1, dt * 10));
    this._setFwd(_v2);
  }

  // ---- legs -------------------------------------------------------------------------------------------
  // Where a foot wants to be right now: its rest spot on the body's plane.
  _ideal(l, out) {
    out.copy(l.rest);
    return this.model.localToWorld(out);
  }

  // Where it actually lands: on the real surface under that spot (or a web thread, see subclasses).
  _footTarget(l, out) {
    this._ideal(l, out);
    if (this.mode === 'web' && this.web) {
      // Feet hold the nearest threads within reach (the hip-to-foot reach of that leg).
      const reach = (l.len[0] + l.len[1]) * this.scale * 0.9;
      const p = this.web.pointOnThreads(out, reach, _o);
      if (p) out.copy(p);
      return out;
    }
    if (this.footOn) return this.footOn(l, out);
    const physics = this.game.physics;
    const reach = l.len[1] * this.scale;
    _o.copy(out).addScaledVector(this.up, reach * 0.5);
    _n.copy(this.up).negate();
    const hit = physics.raycast(_o, _n, reach * 1.2, this._rayOpts());
    if (hit) out.copy(hit.point);
    return out;
  }

  _plant(l) {
    if (!this.up) this._ideal(l, l.foot); // still being set up
    else this._footTarget(l, l.foot);
    l.from.copy(l.foot);
    l.to.copy(l.foot);
    l.t = 1;
  }

  _legs(dt) {
    if (!this.legs.length || !this.legsVisible) return;
    const s = this.scale;
    const moving = Math.abs(this.speed) > 1e-5;
    const dur = clamp(0.08 * Math.sqrt(s) * this.stepTime, 0.02, 1.5);
    const stepping = [false, false];
    for (const l of this.legs) if (l.t < 1) stepping[l.group] = true;
    for (const l of this.legs) {
      if (l.t < 1) {
        l.t = Math.min(1, l.t + dt / l.dur);
        const k = l.t * l.t * (3 - 2 * l.t);
        l.foot.lerpVectors(l.from, l.to, k).addScaledVector(this.up, Math.sin(Math.PI * l.t) * l.lift);
        continue;
      }
      if (this.mode === 'air') {
        this._ideal(l, l.foot);
        continue;
      }
      const ideal = this._ideal(l, _v2);
      const dist = l.foot.distanceTo(ideal);
      const far = dist > this.stepLen * l.len[1] * s * 1.6;
      if ((far || (!moving && dist > 0.12 * l.len[1] * s)) && !stepping[1 - l.group]) {
        l.from.copy(l.foot);
        this._footTarget(l, l.to);
        if (this.speed) l.to.addScaledVector(this.fwd, this.speed * dur * 0.8);
        l.dur = dur;
        l.lift = l.len[1] * s * 0.18;
        l.t = 0;
        stepping[l.group] = true;
      }
    }
    // Solve each leg in model space: knees high above the body, like a real spider's.
    for (const l of this.legs) {
      const footL = this.model.worldToLocal(l.footL.copy(l.foot));
      const hip = l.hip;
      const pole = _pole.set(l.side * 0.3, 1, 0).normalize();
      const outX = footL.x - hip.x, outZ = footL.z - hip.z;
      const ol = Math.hypot(outX, outZ) || 1;
      const ankle = _ankle.set(footL.x - (outX / ol) * l.len[2] * 0.7, footL.y + l.len[2] * 0.35, footL.z - (outZ / ol) * l.len[2] * 0.7);
      solveKnee(hip, ankle, l.len[0], l.len[1], pole, l.knee);
      aimSegment(l.meshes[0], hip, l.knee, l.len[0]);
      aimSegment(l.meshes[1], l.knee, ankle, l.len[1]);
      aimSegment(l.meshes[2], ankle, footL, l.len[2]);
    }
  }

  // Detail by how big it looks: tiny on screen = no legs drawn (saves work), a speck = not drawn.
  _lod() {
    const cam = this.game.camera.position;
    const ang = (this.sp.legs[0] * this.scale) / Math.max(1e-9, cam.distanceTo(this.pos));
    const show = ang > 0.002;
    this.object.visible = ang > 0.0006;
    if (show !== this.legsVisible) {
      this.legsVisible = show;
      for (const l of this.legs) for (const m of l.meshes) m.visible = show;
      if (show) for (const l of this.legs) this._plant(l);
    }
    // Hairs only when they'd actually show (a leg at least about a pixel thick, the body big enough).
    const d = Math.max(1e-9, cam.distanceTo(this.pos));
    const legHair = (this.sp.legR * this.scale) / d > 0.0012;
    const bodyHair = (this.sp.car.w * this.scale) / d > 0.012;
    if (legHair !== this._legHair || bodyHair !== this._bodyHair) {
      this._legHair = legHair;
      this._bodyHair = bodyHair;
      for (const x of this.model.userData.lods) x.mesh.geometry = (x.kind === 'leg' ? legHair : bodyHair) ? x.hi : x.lo;
    }
  }

  animate(dt) {
    this._lod();
    // Breathing-slow abdomen pulse (book lungs) and a tiny bob in step with the legs.
    const b = this.bodyG;
    b.position.y = Math.sin(this.t * 9) * this.sp.ride * 0.02 * Math.min(1, Math.abs(this.speed) * 50);
    this.abdomenG.rotation.x = Math.sin(this.t * 1.3) * 0.015;
  }

  respawnSafe() {
    this.dispose();
  }
}
