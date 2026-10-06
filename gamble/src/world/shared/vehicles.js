// Parked (static) vehicles for street dressing. Driving cars are a separate system; these are
// the cars that line 4th Street and sit in motel lots: sedans, pickups, old wagons, a van.
//
//   parkedCar(batch, colliders, { x, y, z, ry, type, color, dirt, seed })
//
// Bodies are extruded side profiles with real wheel-arch cut-outs and bevelled edges, a glass
// greenhouse with paint-coloured pillars and roof, wheels with tyres + rims, lights, bumpers,
// mirrors and a Nevada plate. Paint shares ONE car-paint material tinted per car through vertex
// colours, so a whole street of cars is a handful of draw calls.

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { paintedSignMat } from './signs.js';
import { propMats } from './props.js';
import { Rng } from '../../core/rng.js';

const TYPES = {
  // L length, W width, wb wheelbase, wr wheel radius, profile (side) + cabin
  sedan: { L: 4.75, W: 1.82, wb: 2.75, wr: 0.34, belt: 0.95, hoodY: 0.86, trunkY: 0.92, roofY: 1.44, ws: [0.95, 0.2], rw: [-0.95, -1.5], front: 2.375 },
  coupe: { L: 4.5, W: 1.8, wb: 2.6, wr: 0.33, belt: 0.92, hoodY: 0.82, trunkY: 0.9, roofY: 1.33, ws: [0.85, 0.05], rw: [-0.75, -1.45], front: 2.25 },
  wagon: { L: 5.2, W: 1.9, wb: 2.95, wr: 0.36, belt: 0.98, hoodY: 0.9, trunkY: 0.98, roofY: 1.46, ws: [1.0, 0.3], rw: [-2.35, -2.5], front: 2.6 },
  pickup: { L: 5.4, W: 1.95, wb: 3.3, wr: 0.39, belt: 1.12, hoodY: 1.12, trunkY: 1.12, roofY: 1.85, ws: [1.15, 0.55], rw: [-0.65, -0.7], front: 2.7, bed: true },
  van: { L: 5.0, W: 1.95, wb: 3.0, wr: 0.36, belt: 1.05, hoodY: 1.05, trunkY: 1.05, roofY: 2.0, ws: [1.65, 1.0], rw: [-2.4, -2.48], front: 2.5 },
};

export const CAR_COLORS = [0x8a1c1c, 0x1d2f4d, 0xd9d6cf, 0x2b2b2d, 0x6f7377, 0x4a5a3a, 0xa48a5c, 0x7a5a2a, 0x2f4f63, 0xbfa36a, 0x5c1f2e, 0xe4e1d8];

const geoCache = new Map();

function bodyShape(T) {
  const h = T.L / 2;
  const ax = T.wb / 2;
  const r = T.wr + 0.06;
  const s = new THREE.Shape();
  const yb = 0.3; // rocker bottom
  s.moveTo(-h + 0.05, yb + 0.05);
  // Rear arch.
  s.lineTo(-ax - r, yb);
  s.absarc(-ax, T.wr * 0.95, r, Math.PI, 0, true);
  s.lineTo(ax - r, yb);
  s.absarc(ax, T.wr * 0.95, r, Math.PI, 0, true);
  s.lineTo(h - 0.06, yb + 0.04);
  s.quadraticCurveTo(h + 0.03, yb + 0.1, h, yb + 0.3);
  s.quadraticCurveTo(h - 0.02, T.hoodY - 0.04, h - 0.25, T.hoodY);
  s.lineTo(T.ws[0] + 0.05, T.belt - 0.02 + (T.hoodY < T.belt ? 0.04 : 0));
  s.lineTo(T.rw[0] - 0.05, T.belt);
  s.lineTo(-h + 0.22, T.trunkY);
  s.quadraticCurveTo(-h - 0.02, T.trunkY - 0.04, -h, T.trunkY - 0.3);
  s.lineTo(-h + 0.05, yb + 0.05);
  return s;
}

function cabinShape(T) {
  const s = new THREE.Shape();
  const [wf, wr2] = T.ws;
  const [rf, rr] = T.rw;
  s.moveTo(wf, T.belt - 0.02);
  s.quadraticCurveTo(wr2 + 0.15, T.roofY - 0.05, wr2, T.roofY);
  s.lineTo(rf + 0.05, T.roofY);
  s.quadraticCurveTo(rr + 0.08, T.roofY - 0.04, rr, T.belt);
  s.lineTo(wf, T.belt - 0.02);
  return s;
}

function extrudeCentered(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function plateMat(text) {
  return paintedSignMat(`plate-${text}`, 256, 128, (g, w, h) => {
    g.fillStyle = '#f1f0ea';
    g.fillRect(0, 0, w, h);
    // Mountains silhouette in blue across the bottom.
    g.fillStyle = '#9fb9d8';
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.72 - Math.abs(Math.sin(x * 0.05)) * 22 - (x % 48 === 0 ? 8 : 0));
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = '#1c3a7a';
    g.font = '400 30px "Bebas Neue"';
    g.textAlign = 'center';
    g.fillText('NEVADA', w / 2, 30);
    g.font = '400 66px "Bebas Neue"';
    g.fillText(text, w / 2, 96);
    g.strokeStyle = '#1c3a7a';
    g.lineWidth = 4;
    g.strokeRect(3, 3, w - 6, h - 6);
  }, { weather: { grime: 0.5, fade: 0.2 } });
}

function carParts(type) {
  if (geoCache.has(type)) return geoCache.get(type);
  const T = TYPES[type];
  const W = T.W;
  const parts = { paint: [], glass: [], dark: [], chrome: [], rubber: [], lights: [], tail: [], plastic: [] };
  parts.paint.push(extrudeCentered(bodyShape(T), W - 0.12, 0.06));
  // Greenhouse: glass slightly narrower, roof skin + pillars in paint.
  const cab = cabinShape(T);
  parts.glass.push(extrudeCentered(cab, W - 0.32, 0.05));
  const roof = new THREE.Shape();
  roof.moveTo(T.ws[1] + 0.06, T.roofY - 0.02);
  roof.lineTo(T.rw[0] + 0.02, T.roofY - 0.02);
  roof.lineTo(T.rw[0] - 0.02, T.roofY + 0.035);
  roof.lineTo(T.ws[1] + 0.02, T.roofY + 0.035);
  parts.paint.push(extrudeCentered(roof, W - 0.26, 0.04));
  const mid = (T.ws[1] + T.rw[0]) / 2;
  for (const s of [-1, 1]) {
    // B pillar + A/C pillar strips on both sides.
    parts.paint.push(new THREE.BoxGeometry(0.1, T.roofY - T.belt, 0.05).translate(mid, (T.roofY + T.belt) / 2, s * (W / 2 - 0.135)));
    // Mirrors.
    parts.paint.push(new THREE.BoxGeometry(0.12, 0.1, 0.18).translate(T.ws[0] - 0.12, T.belt + 0.08, s * (W / 2 + 0.04)));
    // Door handles + seam.
    parts.chrome.push(new THREE.BoxGeometry(0.16, 0.03, 0.02).translate(mid + 0.35, T.belt - 0.12, s * (W / 2 + 0.005)));
    parts.dark.push(new THREE.BoxGeometry(0.012, T.belt - 0.38, 0.01).translate(mid - 0.02, (T.belt + 0.38) / 2, s * (W / 2 + 0.001)));
    parts.dark.push(new THREE.BoxGeometry(0.012, T.belt - 0.38, 0.01).translate(T.ws[0] - 0.05, (T.belt + 0.38) / 2, s * (W / 2 + 0.001)));
  }
  // Pickups get a tonneau-covered bed (the body runs flat at belt height) + a rail on top.
  if (T.bed) {
    for (const s2 of [-1, 1]) parts.chrome.push(new THREE.BoxGeometry(T.rw[1] + T.L / 2 - 0.1, 0.03, 0.03).translate((T.rw[1] - T.L / 2) / 2, T.belt + 0.07, s2 * (W / 2 - 0.12)));
  }
  // Bumpers.
  const bumper = (x) => new THREE.BoxGeometry(0.16, 0.2, W - 0.05).translate(x, 0.48, 0);
  parts[type === 'wagon' || type === 'pickup' ? 'chrome' : 'plastic'].push(bumper(T.L / 2 + 0.02), bumper(-T.L / 2 - 0.02));
  // Lights.
  for (const s of [-1, 1]) {
    parts.lights.push(new THREE.BoxGeometry(0.06, 0.12, 0.34).translate(T.L / 2 - 0.02, T.hoodY - 0.2, s * (W / 2 - 0.3)));
    parts.tail.push(new THREE.BoxGeometry(0.06, 0.14, 0.32).translate(-T.L / 2 + 0.01, T.trunkY - 0.25, s * (W / 2 - 0.28)));
  }
  // Grille.
  parts.dark.push(new THREE.BoxGeometry(0.05, 0.16, W * 0.45).translate(T.L / 2 + 0.005, T.hoodY - 0.24, 0));
  // Wheels: tyre (lathe ring) + rim + hub.
  const tyre = new THREE.LatheGeometry([
    [T.wr * 0.62, -0.11], [T.wr * 0.92, -0.115], [T.wr, -0.09], [T.wr, 0.09], [T.wr * 0.92, 0.115], [T.wr * 0.62, 0.11],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 20).rotateX(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(T.wr * 0.64, T.wr * 0.64, 0.2, 18).rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(T.wr * 0.42, T.wr * 0.5, 0.05, 14).rotateX(Math.PI / 2);
  for (const ax of [-T.wb / 2, T.wb / 2]) {
    for (const s of [-1, 1]) {
      const z = s * (W / 2 - 0.16);
      parts.rubber.push(tyre.clone().translate(ax, T.wr, z));
      parts.dark.push(rim.clone().translate(ax, T.wr, z));
      parts.chrome.push(hub.clone().translate(ax, T.wr, z + s * 0.09));
    }
  }
  // Undercarriage shadow-catcher.
  parts.dark.push(new THREE.BoxGeometry(T.L - 0.6, 0.16, W - 0.4).translate(0, 0.3, 0));
  const out = { T, parts };
  geoCache.set(type, out);
  return out;
}

let CM = null;
function carMats() {
  if (CM) return CM;
  const P = propMats();
  CM = {
    paint: mat('car-paint', { color: 0xffffff, wear: 0.35, dirt: 0.45 }),
    glass: P.darkGlass,
    dark: mat('rubber', { color: 0x141414 }),
    chrome: mat('chrome', { wear: 0.4, dirt: 0.4 }),
    rubber: mat('rubber', { color: 0x1a1a1a }),
    plastic: mat('plastic', { color: 0x262626, wear: 0.5, dirt: 0.5 }),
    lights: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.1, metalness: 0.3, name: 'headlight' }),
    tail: new THREE.MeshStandardMaterial({ color: 0x7a0b0b, roughness: 0.2, metalness: 0, name: 'taillight' }),
  };
  return CM;
}

/**
 * Stamp a parked car into the batch with a box collider.
 * ry = 0 → car points along +X.
 */
export function parkedCar(batch, colliders, { x, y = 0, z, ry = 0, type = 'sedan', color = null, seed = 1 }) {
  const rng = new Rng(seed);
  const { T, parts } = carParts(type);
  const M = carMats();
  const tint = color ?? rng.pick(CAR_COLORS);
  // Slight random settle: a car is never perfectly level.
  const mtx = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.006, 0.006), ry, rng.range(-0.008, 0.008), 'YXZ')),
    new THREE.Vector3(1, 1, 1)
  );
  for (const [k, list] of Object.entries(parts)) {
    for (const g of list) {
      batch.add(g, M[k], {
        matrix: mtx,
        tint: k === 'paint' ? tint : undefined,
        grime: k === 'paint' ? 0.35 : 0,
        grimeHeight: 0.6,
        grimeBase: y,
        castShadow: true,
        uv: k === 'paint' ? 2 : undefined,
      });
    }
  }
  // Plates.
  const plate = new THREE.PlaneGeometry(0.31, 0.155);
  const txt = `${rng.int(100, 999)}${String.fromCharCode(65 + rng.int(0, 25), 65 + rng.int(0, 25), 65 + rng.int(0, 25))}`;
  const pm = plateMat(txt);
  batch.add(plate.clone().rotateY(-Math.PI / 2).translate(-T.L / 2 - 0.105, 0.62, 0), pm, { matrix: mtx, uv: 'keep', castShadow: false });
  batch.add(plate.clone().rotateY(Math.PI / 2).translate(T.L / 2 + 0.105, 0.5, 0), pm, { matrix: mtx, uv: 'keep', castShadow: false });
  // Collider: body box + cabin box.
  const c = new THREE.Vector3(0, (0.25 + T.belt) / 2, 0).applyMatrix4(mtx);
  colliders.box(c.x, c.y, c.z, T.L + 0.1, T.belt - 0.25 + 0.1, T.W, ry);
  const cabMid = new THREE.Vector3((T.ws[0] + T.rw[1]) / 2, (T.belt + T.roofY) / 2, 0).applyMatrix4(mtx);
  colliders.box(cabMid.x, cabMid.y, cabMid.z, T.ws[0] - T.rw[1], T.roofY - T.belt, T.W - 0.3, ry);
  return { length: T.L, width: T.W };
}
