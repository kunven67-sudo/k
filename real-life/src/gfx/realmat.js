// Real materials for the flat-coloured model kits. Every named colour in the furniture / house /
// car models becomes the real thing it stands for, at real-world texture scale (triplanar):
// "Wood" -> varnished wood grain, "Couch_Blue" -> blue upholstery fabric, "LightMetal" ->
// brushed aluminium, bathroom "White" -> glossy ceramic, a car's body colour -> clear-coated
// car paint, "Windows" -> tinted glass. The original colour is kept as the tint.
//
//   realMaterial(kit, modelName, material) -> replacement material or null (keep it)

import * as THREE from 'three';
import { mat } from './materials.js';
import { triplanar } from './triplanar.js';

const hex = (m) => (m.color ? m.color.getHex() : 0xffffff);

function tuned(src, { roughness, metalness, env } = {}) {
  const m = src.clone();
  if (roughness != null) m.roughness = roughness;
  if (metalness != null) m.metalness = metalness;
  if (env != null) m.envMapIntensity = env;
  m.userData = { ...src.userData };
  return m;
}

const tunedCache = new Map();
function tri(kind, opts, tune) {
  const base = mat(kind, opts);
  if (!tune) return triplanar(base);
  const k = `${base.uuid}|${JSON.stringify(tune)}`;
  let t = tunedCache.get(k);
  if (!t) {
    t = triplanar(tuned(base, tune));
    tunedCache.set(k, t);
  }
  return t;
}

// Colours come in as linear floats; quantise so near-identical colours share one material.
const q = (c) => {
  const col = new THREE.Color(c);
  const r = Math.round(col.r * 24) / 24;
  const g = Math.round(col.g * 24) / 24;
  const b = Math.round(col.b * 24) / 24;
  return new THREE.Color(r, g, b).getHex();
};

function homeKit(model, m) {
  const n = m.name.replace(/\.\d+$/, '');
  const c = q(hex(m));
  const bath = /^Bathroom/.test(model);
  const appliance = /Fridge|Oven|WashingMachine/.test(model);
  const lamp = /^Light_/.test(model);
  if (/^Wood/.test(n) || n === 'Brown') return tri('wood', { color: c, wear: 0.25, dirt: 0.15, varnish: 0.6 });
  if (/^Curtains/.test(model) && !/Metal/.test(n)) return tri('fabric', { color: c, dirt: 0.1, wear: 0.1, weave: 'plain' });
  if (/^Couch|Cushin/.test(n)) return tri('fabric', { color: c, dirt: 0.2, wear: 0.2 });
  if (n === 'Glass') return null; // the kit's glass already reads fine (and lamps glow through it)
  if (n === 'Mirror') return mat('mirror');
  if (n === 'Gold') return tri('brass', {});
  if (n === 'LightMetal') return tri('aluminum', { color: c, wear: 0.15, dirt: 0.1 });
  if (n === 'Metal' || n === 'DarkMetal') return tri('steel', { color: c, wear: 0.2, dirt: 0.15 });
  if (n === 'KitchenTop' || n === 'Marble') return tri('plastic', { color: c, wear: 0.05, dirt: 0.05 }, { roughness: 0.28 }); // laminate / polished stone
  if (n === 'Kitchen') return tri('painted-wood', { color: c, wear: 0.12, dirt: 0.1 });
  if (/^Carpet/.test(model)) return tri('carpet', { color: c });
  if (lamp || /Plant/.test(n)) return null;
  if (bath && /White|Light/.test(n)) return tri('plastic', { color: c, wear: 0.02, dirt: 0.05 }, { roughness: 0.12, env: 1.1 }); // glazed ceramic
  if (appliance && /White|Grey|Black/.test(n)) return tri('metal-painted', { color: c, wear: 0.05, dirt: 0.1 }, { roughness: 0.3 });
  if (n === 'Black' && /TV|Laptop|Computer/.test(model)) return tri('plastic', { color: c, wear: 0.05 });
  if (/White|Grey|Black|Light|Red|DarkRed|LightOrange|DarkGreen|Orange|Blue/.test(n)) return tri('painted-wood', { color: c, wear: 0.15, dirt: 0.12 });
  return null;
}

function furnitureKit(model, m) {
  const n = m.name;
  const c = q(hex(m));
  if (/^wood/.test(n)) return tri('wood', { color: c, wear: 0.25, dirt: 0.15, varnish: 0.5 });
  if (/^carpet|^fur/.test(n)) return tri('fabric', { color: c, dirt: 0.2, wear: 0.2 });
  if (n === 'metalDark') return tri('steel', { color: c, wear: 0.2, dirt: 0.2 });
  if (/^metal/.test(n)) return tri('aluminum', { color: c, wear: 0.15, dirt: 0.1 });
  return null;
}

function autoKit(model, m, biggest) {
  const n = m.name;
  const c = hex(m);
  if (n === 'Windows') return mat('glass', { color: 0x1d262c, tint: 0.85, dirt: 0.15 });
  if (n === 'Black') return tri('rubber', {});
  if (n === 'Grey') return tri('aluminum', { color: 0xb8bcc2, wear: 0.1, dirt: 0.3 });
  if (m === biggest) {
    const p = carPaint(c);
    return p;
  }
  return null;
}

/** Clear-coated car paint in any colour (also used to repaint traffic). */
export function carPaint(color) {
  const t = tri('car-paint', { color: q(color), wear: 0.15, dirt: 0.2 });
  t.userData.carPaint = true;
  return t;
}

/** Rocks from the nature kit: flat-coloured low-poly -> weathered stone texture. */
function natureKit(model, m) {
  if (!/^(rock|stone|cliff)/i.test(model)) return null;
  return tri('concrete', { color: q(hex(m)), wear: 0.7, dirt: 0.6 }, { roughness: 0.95 });
}

/** Replace a whole loaded model's materials (called once per model when it loads). */
export function realify(kit, model, root) {
  if (!['home', 'furniture', 'autos', 'nature'].includes(kit)) return;
  // The car body = the material covering the most triangles that isn't glass/lights/tyres.
  let biggest = null;
  if (kit === 'autos') {
    let best = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (/Windows|Black|Grey|Lights|Headlights|TailLights/.test(m.name)) return;
      const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      if (tris > best) {
        best = tris;
        biggest = m;
      }
    });
  }
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      const r = kit === 'home' ? homeKit(model, m) : kit === 'furniture' ? furnitureKit(model, m) : kit === 'nature' ? natureKit(model, m) : autoKit(model, m, biggest);
      return r || m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}
