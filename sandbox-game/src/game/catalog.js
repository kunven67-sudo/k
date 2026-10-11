// Everything you can spawn. All sizes in meters, masses in kg, based on the real objects.
import * as THREE from 'three';
import { box, bevelBox, cyl, sphere, merge, translate, rotate, worldUV, corrugatedPanel } from '../gfx/geom.js';

const PI = Math.PI;

// Shorthands for collider shapes.
const B = (hx, hy, hz) => ({ type: 'box', hx, hy, hz });
const C = (r, hh) => ({ type: 'cyl', r, hh });
const CAP = (r, hh) => ({ type: 'capsule', r, hh });
const S = (r) => ({ type: 'ball', r });

// A part = one collider + its meshes. Parts of the same object share one rigid body
// until the object breaks apart.
function part(shape, mat, meshes, extra = {}) {
  return { shape, mat, meshes, pos: [0, 0, 0], rot: [0, 0, 0], ...extra };
}
const M = (geo, mat, paint, extra = {}) => ({ geo, mat, paint, ...extra });

function lathe(points, seg = 28) {
  return worldUV(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg));
}

// ---------------------------------------------------------------- shapes
function shapeDefs() {
  return [
    { id: 'cube', name: 'Cube', tab: 'Shapes', mat: 'wood', size: 1, build: (m, s) => [part(B(s / 2, s / 2, s / 2), m, [M(bevelBox(s, s, s, 0.006), m)])] },
    { id: 'plank', name: 'Plank', tab: 'Shapes', mat: 'wood', size: 1, build: (m, s) => {
      const L = 2.4 * s, W = 0.19 * s, T = 0.038 * s;
      return [part(B(L / 2, T / 2, W / 2), m, [M(bevelBox(L, T, W, 0.003), m)])];
    } },
    { id: 'beam', name: 'Beam', tab: 'Shapes', mat: 'wood', size: 1, build: (m, s) => {
      const L = 3 * s, T = 0.2 * s;
      return [part(B(L / 2, T / 2, T / 2), m, [M(bevelBox(L, T, T, 0.005), m)])];
    } },
    { id: 'sheet', name: 'Sheet', tab: 'Shapes', mat: 'plywood', size: 1, build: (m, s) => {
      const W = 2.44 * s, D = 1.22 * s, T = 0.018 * s;
      return [part(B(W / 2, Math.max(T, 0.02) / 2, D / 2), m, [M(box(W, T, D), m)])];
    } },
    { id: 'wall', name: 'Wall', tab: 'Shapes', mat: 'concrete', size: 1, build: (m, s) => {
      const W = 3 * s, H = 2.5 * s, T = 0.2 * s;
      return [part(B(W / 2, H / 2, T / 2), m, [M(bevelBox(W, H, T, 0.01), m)])];
    } },
    { id: 'pillar', name: 'Cylinder', tab: 'Shapes', mat: 'concrete', size: 1, build: (m, s) => [part(C(0.3 * s, 0.5 * s), m, [M(cyl(0.3 * s, 0.3 * s, 1 * s, 28), m)])] },
    { id: 'ball', name: 'Ball', tab: 'Shapes', mat: 'rubber', size: 1, build: (m, s) => [part(S(0.25 * s), m, [M(sphere(0.25 * s, 28), m)])] },
    { id: 'pane', name: 'Pane', tab: 'Shapes', mat: 'glass', size: 1, build: (m, s) => {
      const W = 1.2 * s, H = 1.0 * s, T = 0.008;
      return [part(B(W / 2, H / 2, 0.008), m, [M(box(W, H, T), m)])];
    } },
  ];
}

// ---------------------------------------------------------------- construction
function concreteBarrier() {
  // Jersey barrier profile (real: 0.61 wide base, 0.15 top, 0.81 tall, 3m long, ~1.8 t)
  const prof = [[-0.305, 0], [0.305, 0], [0.305, 0.075], [0.18, 0.33], [0.075, 0.81], [-0.075, 0.81], [-0.18, 0.33], [-0.305, 0.075]];
  const shape = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
  geo.translate(0, -0.405, -1.5);
  const points = [];
  for (const [x, y] of prof) { points.push([x, y - 0.405, -1.5], [x, y - 0.405, 1.5]); }
  return [part({ type: 'hull', points }, 'concrete', [M(worldUV(geo), 'concrete')], { mass: 1800 })];
}

function cinderBlock() {
  const L = 0.39, H = 0.19, W = 0.19, t = 0.032;
  const g = merge([
    translate(box(L, H, t), 0, 0, W / 2 - t / 2), translate(box(L, H, t), 0, 0, -W / 2 + t / 2),
    translate(box(t, H, W - 2 * t), -L / 2 + t / 2, 0, 0), translate(box(t, H, W - 2 * t), L / 2 - t / 2, 0, 0),
    translate(box(t, H, W - 2 * t), 0, 0, 0),
  ]);
  return [part(B(L / 2, H / 2, W / 2), 'cinder', [M(g, 'cinder')], { mass: 13 })];
}

function iBeam() {
  const L = 4, D = 0.2, F = 0.2, tf = 0.012, tw = 0.008;
  const g = merge([
    translate(box(L, tf, F), 0, D / 2 - tf / 2, 0), translate(box(L, tf, F), 0, -D / 2 + tf / 2, 0),
    box(L, D - 2 * tf, tw),
  ]);
  return [part(B(L / 2, D / 2, F / 2), 'steel', [M(g, 'steel', 0x5d4636, { roughness: 0.7, metalness: 0.6 })], { mass: 195 })];
}

function lumber() {
  const L = 2.4, W = 0.089, T = 0.038;
  return [part(B(L / 2, T / 2, W / 2), 'wood', [M(bevelBox(L, T, W, 0.003), 'wood', 0xc49a63)])];
}

function pallet() {
  const parts = [];
  const paint = 0xb89366;
  for (let i = 0; i < 5; i++) {
    const z = -0.35 + i * 0.175;
    parts.push(part(B(0.6, 0.011, 0.05), 'wood', [M(box(1.2, 0.022, 0.1), 'wood', paint)], { pos: [0, 0.061, z] }));
  }
  for (const z of [-0.35, 0, 0.35]) {
    parts.push(part(B(0.6, 0.039, 0.05), 'wood', [M(box(1.2, 0.078, 0.1), 'wood', paint)], { pos: [0, 0.011, z] }));
  }
  for (const z of [-0.35, 0.35]) {
    parts.push(part(B(0.6, 0.011, 0.05), 'wood', [M(box(1.2, 0.022, 0.1), 'wood', paint)], { pos: [0, -0.061, z] }));
  }
  return parts;
}

function scaffold() {
  const parts = [];
  const r = 0.024, H = 2, W = 1.5;
  const tube = (len) => M(cyl(r, r, len, 10), 'steel', 0x9aa0a6, { roughness: 0.5 });
  for (const x of [-W / 2, W / 2]) for (const z of [-0.45, 0.45]) parts.push(part(C(r, H / 2), 'steel', [tube(H)], { pos: [x, 0, z], mass: 5.5 }));
  for (const y of [-0.9, 0, 0.9]) for (const z of [-0.45, 0.45]) parts.push(part(C(r, W / 2), 'steel', [tube(W)], { pos: [0, y, z], rot: [0, 0, PI / 2], mass: 4 }));
  // plank deck on top
  parts.push(part(B(W / 2, 0.02, 0.45), 'wood', [M(box(W, 0.04, 0.9), 'wood', 0xa98256)], { pos: [0, 0.93, 0] }));
  return parts;
}

// ---------------------------------------------------------------- containers
function crate() {
  const s = 0.8, t = 0.02, h = s / 2;
  const paint = 0xa77d4f;
  const panel = (w, hgt) => {
    // plywood panel + frame battens around the edges + a diagonal brace
    const g = [box(w, hgt, t)];
    const b = 0.07;
    g.push(translate(box(w, b, 0.02), 0, hgt / 2 - b / 2, t), translate(box(w, b, 0.02), 0, -hgt / 2 + b / 2, t));
    g.push(translate(box(b, hgt - 2 * b, 0.02), w / 2 - b / 2, 0, t), translate(box(b, hgt - 2 * b, 0.02), -w / 2 + b / 2, 0, t));
    const diag = Math.hypot(w - 2 * b, hgt - 2 * b);
    g.push(translate(rotate(box(diag * 0.95, b, 0.02), 0, 0, Math.atan2(hgt - 2 * b, w - 2 * b)), 0, 0, t));
    return merge(g);
  };
  const ps = [];
  const sides = [
    { pos: [0, 0, h - t / 2], rot: [0, 0, 0] }, { pos: [0, 0, -h + t / 2], rot: [0, PI, 0] },
    { pos: [h - t / 2, 0, 0], rot: [0, PI / 2, 0] }, { pos: [-h + t / 2, 0, 0], rot: [0, -PI / 2, 0] },
    { pos: [0, h - t / 2, 0], rot: [-PI / 2, 0, 0] }, { pos: [0, -h + t / 2, 0], rot: [PI / 2, 0, 0] },
  ];
  for (const sd of sides) ps.push(part(B(h, h, t / 2), 'plywood', [M(panel(s, s), 'plywood', paint)], { pos: sd.pos, rot: sd.rot, mass: 4.5 }));
  return ps;
}

function cardboardBox() {
  const W = 0.4, H = 0.3, D = 0.3;
  return [part(B(W / 2, H / 2, D / 2), 'cardboard', [
    M(bevelBox(W, H, D, 0.004), 'cardboard'),
    M(translate(box(0.05, 0.002, D + 0.002), 0, H / 2 + 0.001, 0), 'plastic', 0xc8b48a, { roughness: 0.35 }),
  ], { mass: 1.2 })];
}

function drum(paint, mass) {
  const r = 0.286, h = 0.88;
  const body = cyl(r, r, h, 32);
  const hoops = merge([-0.15, 0.15].map((y) => translate(rotate(worldUV(new THREE.TorusGeometry(r + 0.004, 0.012, 6, 36)), PI / 2, 0, 0), 0, y * h, 0)));
  const rims = merge([-1, 1].map((sy) => translate(rotate(worldUV(new THREE.TorusGeometry(r - 0.004, 0.01, 6, 36)), PI / 2, 0, 0), 0, sy * h / 2, 0)));
  const caps = merge([translate(cyl(0.03, 0.03, 0.012, 10), 0.17, h / 2 + 0.004, 0), translate(cyl(0.02, 0.02, 0.012, 10), -0.18, h / 2 + 0.004, 0.05)]);
  return [part(C(r, h / 2), 'steel', [
    M(body, 'steel', paint, { roughness: 0.55, metalness: 0.5 }),
    M(hoops, 'steel', paint, { roughness: 0.55, metalness: 0.5 }),
    M(rims, 'steel', 0x777b80),
    M(caps, 'steel', 0x8a8d90),
  ], { mass })];
}

function propane(big) {
  // 20 lb BBQ tank (0.31m wide, 0.46m tall, 17 kg full) or 100 lb cylinder
  const r = big ? 0.19 : 0.155, hh = big ? 0.42 : 0.12;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = -PI / 2 + (i / 8) * (PI / 2); pts.push([Math.cos(a) * r, -hh + Math.sin(a) * r * 0.75]); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * (PI / 2); pts.push([Math.cos(a) * r, hh + Math.sin(a) * r * 0.75]); }
  pts[0][0] = 0.001; pts[pts.length - 1][0] = 0.001;
  const top = hh + r * 0.75;
  const collar = merge([
    translate(cyl(r * 0.62, r * 0.62, 0.12, 20, true), 0, top + 0.02, 0),
  ]);
  const foot = translate(cyl(r * 0.85, r * 0.85, 0.07, 22, true), 0, -top - 0.0, 0);
  const valve = merge([translate(cyl(0.018, 0.018, 0.06, 8), 0, top + 0.02, 0), translate(cyl(0.035, 0.035, 0.012, 12), 0, top + 0.06, 0)]);
  return [part(CAP(r, hh + 0.02), 'steel', [
    M(lathe(pts), 'steel', 0xeeeeea, { roughness: 0.4, metalness: 0.3 }),
    M(collar, 'steel', 0xe2e2dd, { roughness: 0.45, metalness: 0.3 }),
    M(foot, 'steel', 0xdcdcd6, { roughness: 0.45, metalness: 0.3 }),
    M(valve, 'steel', 0x8a8c3a, { metalness: 0.9, roughness: 0.35 }),
  ], { mass: big ? 77 : 17 })];
}

function gasCan() {
  const W = 0.165, H = 0.345, D = 0.47;
  const body = bevelBox(D, H, W, 0.02);
  const handles = merge([0, -0.12, 0.12].map((z) => translate(box(0.03, 0.025, 0.04), z, H / 2 + 0.03, 0)));
  const rail = translate(box(0.3, 0.02, 0.03), 0, H / 2 + 0.055, 0);
  const spout = translate(rotate(cyl(0.025, 0.025, 0.06, 12), 0, 0, -0.6), D / 2 - 0.05, H / 2 + 0.02, 0);
  return [part(B(D / 2, H / 2 + 0.03, W / 2), 'plastic', [
    M(body, 'plastic', 0xb3191c, { roughness: 0.45 }),
    M(merge([handles, rail]), 'plastic', 0xb3191c, { roughness: 0.45 }),
    M(spout, 'plastic', 0x222222),
  ], { mass: 18 })];
}

function shippingContainer(paint) {
  // 20 ft ISO container: 6.06 x 2.59 x 2.44, ~2.3 t empty
  const L = 6.06, H = 2.59, W = 2.44;
  const side = corrugatedPanel(L - 0.3, H - 0.3);
  const end = corrugatedPanel(W - 0.3, H - 0.3);
  const sides = merge([
    translate(side.clone(), 0, 0, W / 2 - 0.04), translate(rotate(side.clone(), 0, PI, 0), 0, 0, -W / 2 + 0.04),
    translate(rotate(end.clone(), 0, PI / 2, 0), -L / 2 + 0.04, 0, 0),
    translate(box(L - 0.3, 0.02, W - 0.1), 0, H / 2 - 0.08, 0), translate(box(L - 0.3, 0.12, W - 0.1), 0, -H / 2 + 0.1, 0),
  ]);
  const frame = [];
  for (const x of [-L / 2 + 0.08, L / 2 - 0.08]) for (const z of [-W / 2 + 0.08, W / 2 - 0.08]) frame.push(translate(box(0.16, H, 0.16), x, 0, z));
  for (const y of [-H / 2 + 0.08, H / 2 - 0.08]) for (const z of [-W / 2 + 0.08, W / 2 - 0.08]) frame.push(translate(box(L, 0.16, 0.16), 0, y, z));
  for (const y of [-H / 2 + 0.08, H / 2 - 0.08]) for (const x of [-L / 2 + 0.08, L / 2 - 0.08]) frame.push(translate(box(0.16, 0.16, W), x, y, 0));
  // doors with 4 vertical lock bars
  const doors = merge([translate(box(0.03, H - 0.3, W - 0.3), L / 2 - 0.05, 0, 0)]);
  const bars = merge([-0.85, -0.35, 0.35, 0.85].map((z) => translate(cyl(0.017, 0.017, H - 0.25, 8), L / 2 - 0.0, 0, z)));
  return [part(B(L / 2, H / 2, W / 2), 'steel', [
    M(sides, 'steel', paint, { roughness: 0.6, metalness: 0.45 }),
    M(merge(frame), 'steel', paint, { roughness: 0.6, metalness: 0.45 }),
    M(doors, 'steel', paint, { roughness: 0.6, metalness: 0.45 }),
    M(bars, 'steel', 0x8d9196),
  ], { mass: 2300 })];
}

// ---------------------------------------------------------------- everyday
function sodaCan() {
  const r = 0.033, h = 0.122;
  const pts = [[0.001, -h / 2], [r * 0.78, -h / 2], [r, -h / 2 + 0.012], [r, h / 2 - 0.014], [r * 0.82, h / 2 - 0.002], [r * 0.82, h / 2], [0.001, h / 2 - 0.003]];
  return [part(C(r, h / 2), 'aluminum', [
    M(lathe(pts, 24), 'aluminum', 0xb5121b, { roughness: 0.25, metalness: 0.7 }),
    M(translate(cyl(r * 0.8, r * 0.8, 0.002, 20), 0, h / 2 - 0.002, 0), 'aluminum'),
  ], { mass: 0.37 })];
}

function bottle() {
  const pts = [[0.001, -0.15], [0.034, -0.15], [0.036, -0.145], [0.036, 0.03], [0.03, 0.07], [0.014, 0.11], [0.013, 0.14], [0.015, 0.145], [0.015, 0.15], [0.001, 0.15]];
  return [part(C(0.036, 0.15), 'glass', [M(lathe(pts, 22), 'glass', 0x5d8a5c)], { mass: 0.75 })];
}

function vendingMachine() {
  const W = 0.9, H = 1.83, D = 0.85;
  const bodyGeo = merge([
    translate(box(W, H, D - 0.05), 0, 0, -0.025),
    translate(box(0.27, H - 0.1, 0.05), W / 2 - 0.135, 0, D / 2 - 0.025),
    translate(box(W, 0.35, 0.05), 0, -H / 2 + 0.175, D / 2 - 0.025),
    translate(box(W, 0.08, 0.05), 0, H / 2 - 0.04, D / 2 - 0.025),
  ]);
  const cans = [];
  for (let row = 0; row < 6; row++) for (let i = 0; i < 5; i++) cans.push(translate(cyl(0.032, 0.032, 0.12, 10), -0.38 + i * 0.105, -0.5 + row * 0.22, D / 2 - 0.12));
  const shelves = merge(Array.from({ length: 6 }, (_, row) => translate(box(0.6, 0.01, 0.4), -0.17, -0.565 + row * 0.22, D / 2 - 0.25)));
  return [
    part(B(W / 2, H / 2, D / 2 - 0.03), 'steel', [
      M(bodyGeo, 'steel', 0xb42a26, { roughness: 0.45, metalness: 0.4 }),
      M(merge(cans), 'aluminum', 0x2f63b8),
      M(shelves, 'steel', 0x9a9a9a),
      M(translate(box(0.16, 0.1, 0.01), W / 2 - 0.135, 0.25, D / 2 + 0.002), 'plastic', 0x111111, { emissive: 0x34c46a, emissiveIntensity: 0.6 }),
    ], { mass: 300 }),
    part(B(0.31, 0.68, 0.005), 'tempered', [M(box(0.62, 1.36, 0.008), 'tempered')], { pos: [-0.135, 0.12, D / 2 - 0.02], mass: 12 }),
  ];
}

function tv() {
  const W = 1.23, H = 0.71, T = 0.05;
  return [
    part(B(W / 2, H / 2, T / 2), 'plastic', [
      M(bevelBox(W, H, T, 0.006), 'plastic', 0x101113, { roughness: 0.4 }),
      M(translate(box(0.06, 0.12, 0.03), -0.4, -H / 2 - 0.06, 0), 'plastic', 0x101113),
      M(translate(box(0.06, 0.12, 0.03), 0.4, -H / 2 - 0.06, 0), 'plastic', 0x101113),
      M(translate(box(0.2, 0.012, 0.22), -0.4, -H / 2 - 0.12, 0), 'plastic', 0x101113),
      M(translate(box(0.2, 0.012, 0.22), 0.4, -H / 2 - 0.12, 0), 'plastic', 0x101113),
    ], { mass: 13 }),
    part(B(W / 2 - 0.012, H / 2 - 0.012, 0.003), 'glass', [M(box(W - 0.024, H - 0.024, 0.004), 'plastic', 0x050608, { roughness: 0.08, metalness: 0.2 })], { pos: [0, 0, T / 2 + 0.003], mass: 2 }),
  ];
}

function pcTower() {
  const W = 0.21, H = 0.45, D = 0.45;
  const fans = merge([0.1, -0.06].map((y) => translate(rotate(worldUV(new THREE.TorusGeometry(0.055, 0.006, 6, 24)), 0, PI / 2, 0), -D / 2 + 0.01, y, 0)));
  const gpu = translate(box(0.28, 0.12, 0.04), 0.0, -0.05, 0.04);
  return [
    part(B(D / 2, H / 2, W / 2), 'steel', [
      M(merge([translate(box(D, H, 0.008), 0, 0, -W / 2 + 0.004), translate(box(D, 0.008, W), 0, H / 2 - 0.004, 0), translate(box(D, 0.008, W), 0, -H / 2 + 0.004, 0), translate(box(0.008, H, W), D / 2 - 0.004, 0, 0), translate(box(0.008, H, W), -D / 2 + 0.004, 0, 0)]), 'steel', 0x18191b, { roughness: 0.5, metalness: 0.6 }),
      M(fans, 'plastic', 0x111111, { emissive: 0x7a3cff, emissiveIntensity: 1.2 }),
      M(gpu, 'plastic', 0x2a2d31, { roughness: 0.4 }),
      M(translate(box(0.2, 0.25, 0.01), 0.05, 0.08, -W / 2 + 0.015), 'plastic', 0x1f4a2a),
    ], { mass: 9 }),
    part(B(D / 2 - 0.01, H / 2 - 0.01, 0.002), 'tempered', [M(box(D - 0.02, H - 0.02, 0.004), 'tempered')], { pos: [0, 0, W / 2 - 0.002], mass: 1.6 }),
  ];
}

function chair() {
  const paint = 0x8a5a33;
  const ps = [];
  const legH = 0.45, seatT = 0.03, S2 = 0.21;
  for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) ps.push(part(B(0.02, legH / 2, 0.02), 'wood', [M(box(0.04, legH, 0.04), 'wood', paint)], { pos: [x, -0.2, z] }));
  ps.push(part(B(S2, seatT / 2, S2), 'wood', [M(bevelBox(0.42, seatT, 0.42, 0.006), 'wood', paint)], { pos: [0, 0.04, 0] }));
  for (const x of [-0.18, 0.18]) ps.push(part(B(0.02, 0.24, 0.02), 'wood', [M(box(0.04, 0.48, 0.04), 'wood', paint)], { pos: [x, 0.295, -0.18] }));
  for (const y of [0.3, 0.45]) ps.push(part(B(0.16, 0.035, 0.01), 'wood', [M(box(0.32, 0.07, 0.02), 'wood', paint)], { pos: [0, y, -0.18] }));
  return ps;
}

function table() {
  const paint = 0x7b5434;
  const ps = [part(B(0.75, 0.02, 0.45), 'wood', [M(bevelBox(1.5, 0.04, 0.9, 0.008), 'wood', paint)], { pos: [0, 0.355, 0] })];
  for (const x of [-0.68, 0.68]) for (const z of [-0.38, 0.38]) ps.push(part(B(0.03, 0.335, 0.03), 'wood', [M(box(0.06, 0.67, 0.06), 'wood', paint)], { pos: [x, 0, z] }));
  return ps;
}

function fridge() {
  const W = 0.7, H = 1.75, D = 0.7;
  return [
    part(B(W / 2, H / 2, D / 2 - 0.03), 'steel', [M(bevelBox(W, H, D - 0.06, 0.02), 'steel', 0xe6e6e3, { roughness: 0.3, metalness: 0.2 })], { mass: 70, pos: [0, 0, -0.03] }),
    part(B(W / 2, 0.55, 0.03), 'steel', [
      M(bevelBox(W, 1.1, 0.06, 0.015), 'steel', 0xeaeae7, { roughness: 0.3, metalness: 0.2 }),
      M(translate(box(0.025, 0.4, 0.03), W / 2 - 0.07, -0.2, 0.045), 'steel', 0xb7babd),
    ], { pos: [0, H / 2 - 0.55, D / 2 - 0.03], mass: 12 }),
    part(B(W / 2, 0.315, 0.03), 'steel', [
      M(bevelBox(W, 0.63, 0.06, 0.015), 'steel', 0xeaeae7, { roughness: 0.3, metalness: 0.2 }),
      M(translate(box(0.025, 0.25, 0.03), W / 2 - 0.07, 0.15, 0.045), 'steel', 0xb7babd),
    ], { pos: [0, -H / 2 + 0.315, D / 2 - 0.03], mass: 8 }),
  ];
}

function boombox() {
  const W = 0.5, H = 0.25, D = 0.15;
  const grilles = merge([-0.15, 0.15].map((x) => translate(rotate(cyl(0.075, 0.075, 0.01, 24), PI / 2, 0, 0), x, -0.01, D / 2)));
  const handle = merge([translate(box(0.36, 0.025, 0.03), 0, H / 2 + 0.07, 0), translate(box(0.025, 0.07, 0.03), -0.17, H / 2 + 0.035, 0), translate(box(0.025, 0.07, 0.03), 0.17, H / 2 + 0.035, 0)]);
  return [part(B(W / 2, H / 2 + 0.04, D / 2), 'plastic', [
    M(translate(bevelBox(W, H, D, 0.015), 0, 0, 0), 'plastic', 0x2b2d30),
    M(grilles, 'steel', 0x55585c, { roughness: 0.6 }),
    M(handle, 'plastic', 0x1a1b1d),
    M(translate(box(0.12, 0.05, 0.01), 0, 0.06, D / 2 + 0.002), 'plastic', 0x0a0a0a, { emissive: 0x3aa0ff, emissiveIntensity: 0.6 }),
  ], { mass: 3, pos: [0, -0.04, 0] })];
}

function tire() {
  const R = 0.32, w = 0.2;
  const g = worldUV(new THREE.TorusGeometry(R - 0.07, 0.085, 14, 36));
  g.scale(1, 1, w / 0.17);
  const rim = rotate(cyl(0.2, 0.2, 0.16, 24), PI / 2, 0, 0);
  return [part(C(R, w / 2), 'rubber', [M(rotate(g, PI / 2, 0, 0), 'rubber', 0x1b1b1c), M(rotate(rim, -PI / 2, 0, 0), 'steel', 0xa7abaf, { roughness: 0.3 })], { mass: 10 })];
}

function iceBlock() {
  return [part(B(0.25, 0.25, 0.25), 'ice', [M(bevelBox(0.5, 0.5, 0.5, 0.02), 'ice')])];
}

function windowPane() {
  return [part(B(0.6, 0.5, 0.006), 'glass', [M(box(1.2, 1.0, 0.006), 'glass')], { mass: 18 })];
}
function glassWall() {
  return [part(B(1, 1.25, 0.008), 'tempered', [M(box(2, 2.5, 0.012), 'tempered')], { mass: 150 })];
}

// ---------------------------------------------------------------- explosives
function tntBundle() {
  const sticks = [];
  const r = 0.02, h = 0.22;
  const pos = [[-0.021, -0.012], [0.021, -0.012], [0, 0.024], [-0.042, 0.024], [0.042, 0.024], [0, -0.048]];
  for (const [x, y] of pos) sticks.push(translate(rotate(cyl(r, r, h, 14), 0, 0, PI / 2), 0, y, x));
  const tape = merge([-0.06, 0.06].map((x) => translate(rotate(cyl(0.068, 0.068, 0.03, 18, true), 0, 0, PI / 2), x, -0.005, 0)));
  const fuse = translate(rotate(cyl(0.003, 0.003, 0.14, 6), 0, 0, PI / 2 - 0.3), h / 2 + 0.06, 0.03, 0);
  return [part(B(0.11, 0.045, 0.065), 'tnt', [
    M(merge(sticks), 'tnt'),
    M(tape, 'plastic', 0x6f6f6a, { roughness: 0.7 }),
    M(fuse, 'plastic', 0x3b2a1a),
  ], { mass: 1.2 })];
}

function c4() {
  const W = 0.28, H = 0.05, D = 0.06;
  return [part(B(W / 2, H / 2, D / 2), 'tnt', [
    M(bevelBox(W, H, D, 0.004), 'plastic', 0x4d5435, { roughness: 0.85 }),
    M(translate(box(0.05, 0.02, 0.03), 0.05, H / 2 + 0.01, 0), 'plastic', 0x1c1c1c),
    M(translate(box(0.012, 0.012, 0.012), 0.06, H / 2 + 0.026, 0), 'plastic', 0x220000, { emissive: 0xff2200, emissiveIntensity: 2 }),
  ], { mass: 1.25 })];
}

// ---------------------------------------------------------------- catalog
export const TABS = ['Shapes', 'Construction', 'Containers', 'Everyday', 'Glass', 'Explosives', 'Weapons', 'Tools'];

const PROPS = [
  { id: 'barrier', name: 'Concrete Barrier', tab: 'Construction', build: concreteBarrier },
  { id: 'cblock', name: 'Concrete Block', tab: 'Construction', build: () => [part(B(0.8, 0.4, 0.4), 'concrete', [M(bevelBox(1.6, 0.8, 0.8, 0.015), 'concrete')])] },
  { id: 'cinder', name: 'Cinder Block', tab: 'Construction', build: cinderBlock },
  { id: 'ibeam', name: 'Steel I-Beam', tab: 'Construction', build: iBeam },
  { id: 'lumber', name: '2x4 Lumber', tab: 'Construction', build: lumber },
  { id: 'pallet', name: 'Pallet', tab: 'Construction', build: pallet },
  { id: 'scaffold', name: 'Scaffolding', tab: 'Construction', build: scaffold },
  { id: 'crate', name: 'Wooden Crate', tab: 'Containers', build: crate },
  { id: 'cardboard', name: 'Cardboard Box', tab: 'Containers', build: cardboardBox },
  { id: 'drum', name: 'Oil Drum (full)', tab: 'Containers', build: () => drum(0x1d4f8f, 190), explosive: { kind: 'fuel', power: 2.5, leak: true } },
  { id: 'drumEmpty', name: 'Steel Drum (empty)', tab: 'Containers', build: () => drum(0x6a6e72, 18) },
  { id: 'propane', name: 'Propane Tank', tab: 'Containers', build: () => propane(false), explosive: { kind: 'propane', power: 1.2, rocket: true } },
  { id: 'propaneBig', name: 'Propane Cylinder', tab: 'Containers', build: () => propane(true), explosive: { kind: 'propane', power: 3.0, rocket: true } },
  { id: 'gascan', name: 'Gas Can', tab: 'Containers', build: gasCan, explosive: { kind: 'fuel', power: 0.8, leak: true } },
  { id: 'container', name: 'Shipping Container', tab: 'Containers', build: () => shippingContainer(0x8e2b22) },
  { id: 'soda', name: 'Soda Can', tab: 'Everyday', build: sodaCan },
  { id: 'vending', name: 'Vending Machine', tab: 'Everyday', build: vendingMachine },
  { id: 'tv', name: 'TV', tab: 'Everyday', build: tv },
  { id: 'pc', name: 'PC Tower', tab: 'Everyday', build: pcTower },
  { id: 'chair', name: 'Chair', tab: 'Everyday', build: chair },
  { id: 'table', name: 'Table', tab: 'Everyday', build: table },
  { id: 'fridge', name: 'Fridge', tab: 'Everyday', build: fridge },
  { id: 'boombox', name: 'Boombox', tab: 'Everyday', build: boombox },
  { id: 'tire', name: 'Tire', tab: 'Everyday', build: tire },
  { id: 'ice', name: 'Ice Block', tab: 'Everyday', build: iceBlock },
  { id: 'window', name: 'Window Pane', tab: 'Glass', build: windowPane },
  { id: 'glasswall', name: 'Glass Wall (tempered)', tab: 'Glass', build: glassWall },
  { id: 'bottle', name: 'Glass Bottle', tab: 'Glass', build: bottle },
  { id: 'tnt', name: 'TNT Bundle', tab: 'Explosives', build: tntBundle, explosive: { kind: 'tnt', power: 1.0, remote: true, fuse: true } },
  { id: 'c4', name: 'C4 Charge', tab: 'Explosives', build: c4, explosive: { kind: 'c4', power: 0.76, remote: true, timer: true } },
];

// Explosive barrels/tanks also show in the Explosives tab.
const ALSO_EXPLOSIVES = ['drum', 'propane', 'propaneBig', 'gascan'];

// Hotbar tools / weapons (not physical objects).
export const TOOLS = [
  { id: 'physgun', name: 'Physics Gun', tab: 'Tools', tool: true, desc: 'Grab, move, rotate (R), freeze (RMB)' },
  { id: 'remover', name: 'Remover', tab: 'Tools', tool: true, desc: 'LMB delete · RMB freeze/unfreeze' },
  { id: 'weld', name: 'Connector Tool', tab: 'Tools', tool: true, desc: 'Weld / glue / nail / hinge two things' },
  { id: 'painter', name: 'Material Tool', tab: 'Tools', tool: true, desc: 'Change what something is made of' },
  { id: 'detonator', name: 'Detonator', tab: 'Tools', tool: true, desc: 'LMB blow all remote charges · RMB light fuse / start timer' },
  { id: 'grenade', name: 'Frag Grenade', tab: 'Weapons', tool: true, desc: 'Hold LMB to wind up · RMB to cook' },
  { id: 'rpg', name: 'Rocket Launcher', tab: 'Weapons', tool: true, desc: 'RPG · LMB fire · R reload' },
  { id: 'c4tool', name: 'C4 Placer', tab: 'Weapons', tool: true, desc: 'Stick C4 to anything' },
];

export const CATALOG = [...shapeDefs(), ...PROPS];
export const BY_ID = Object.fromEntries([...CATALOG, ...TOOLS].map((d) => [d.id, d]));

export function itemsForTab(tab) {
  if (tab === 'Explosives') return CATALOG.filter((d) => d.tab === 'Explosives' || ALSO_EXPLOSIVES.includes(d.id));
  if (tab === 'Weapons' || tab === 'Tools') return TOOLS.filter((t) => t.tab === tab);
  return CATALOG.filter((d) => d.tab === tab);
}

// Build the parts of a catalog item. `mat` overrides the material of Shapes.
export function buildParts(def, mat, size = 1) {
  if (def.tab === 'Shapes') return def.build(mat || def.mat, size);
  return def.build();
}
