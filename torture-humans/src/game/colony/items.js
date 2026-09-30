// Things tiny people handle, at their real size in the terrarium (meters).
// To a 9 cm person a 10 cm skewer-thin stick is a 2 m pole, a 1 cm pebble is a
// 20 cm building stone and a bread crumb is a loaf. The tools are made by you
// (the mad scientist) at exactly 1/20 scale: a 4.5 mm axe is their 90 cm axe.
import * as THREE from 'three';
import { pbr } from '../engine/assets.js';

export const K = 0.05; // tiny people are 1/20 size

export const POLE = { length: 0.1, radius: 0.0018 };

// UVs in meters by box projection (textures keep their real size on any shape)
function meterUVs(g, scale = 1) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i) * scale, y = p.getY(i) * scale, z = p.getZ(i) * scale;
    if (ax >= ay && ax >= az) uv.set([z, y], i * 2);
    else if (ay >= az) uv.set([x, z], i * 2);
    else uv.set([x, y], i * 2);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(uv.slice(), 2));
  return g;
}

// seeded random so every pebble variant is the same between runs
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// lumpy rounded shape: a sphere pushed in and out by smooth bumps, then squashed
function lumpy(detail, seed, squash, bumps = 0.22) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const r = rng(seed);
  const dirs = Array.from({ length: 7 }, () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize());
  const amp = dirs.map(() => (r() - 0.5) * 2 * bumps);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let k = 1;
    for (let j = 0; j < dirs.length; j++) k += amp[j] * Math.pow(Math.max(0, v.dot(dirs[j])), 3);
    v.multiplyScalar(k).multiply(squash);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---- shared geometry + materials (made once, on first use)
let shared = null;
function lib() {
  if (shared) return shared;
  // a straight-ish stick with a slight bend and knots, length along X
  const pole = new THREE.CylinderGeometry(POLE.radius * 0.85, POLE.radius, POLE.length, 8, 10, false);
  pole.rotateZ(Math.PI / 2);
  {
    const p = pole.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / POLE.length; // -0.5..0.5
      p.setY(i, p.getY(i) + (0.25 - x * x) * 0.004 + Math.sin(x * 23) * 0.00015);
      p.setZ(i, p.getZ(i) + Math.sin(x * 9 + 1) * 0.0004);
    }
    pole.computeVertexNormals();
  }
  meterUVs(pole);
  const stones = [];
  for (let i = 0; i < 6; i++) {
    const g = lumpy(2, 11 + i * 7, new THREE.Vector3(1, 0.62 + (i % 3) * 0.08, 0.85 + (i % 2) * 0.1), 0.28);
    meterUVs(g, 0.01); // a 1 cm stone shows 1 cm of rock texture
    stones.push(g);
  }
  const crumbs = [];
  for (let i = 0; i < 4; i++) {
    const g = lumpy(1, 51 + i * 5, new THREE.Vector3(1, 0.7, 0.8), 0.35);
    meterUVs(g, 0.004);
    crumbs.push(g);
  }
  const bark = pbr('bark_brown_02', { size: 0.012 });
  const wood = pbr('fine_grained_wood', { size: 0.01, color: 0xd9c4a0 });
  const stone = pbr('rocks_ground_02', { size: 0.004 });
  const crust = new THREE.MeshStandardMaterial({ color: 0xa8702f, roughness: 0.85 });
  const metal = pbr('rusty_metal_02', { size: 0.002, metalness: 0.9, roughness: 0.55, color: 0x9a9da3 });
  const handle = pbr('fine_grained_wood', { size: 0.003, color: 0xc99a62 });
  shared = { pole, stones, crumbs, bark, wood, stone, crust, metal, handle };
  return shared;
}

// Tool: handle along +Y from the end (origin) to the head; the blade/pick points +Z.
// Real proportions of a 90 cm felling axe / pickaxe, then scaled 1/20.
function toolMesh(kind) {
  const L = lib();
  const g = new THREE.Group();
  const len = 0.9 * K;
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * K, 0.019 * K, len, 8), L.handle);
  h.position.y = len / 2;
  g.add(h);
  if (kind === 'axe') {
    // side profile of an axe head (Y up, Z = toward the edge), extruded to its thickness
    const s = new THREE.Shape();
    s.moveTo(-0.045, -0.035);
    s.lineTo(0.02, -0.03);
    s.quadraticCurveTo(0.07, -0.06, 0.13, -0.085);
    s.quadraticCurveTo(0.15, 0, 0.13, 0.075);
    s.quadraticCurveTo(0.07, 0.05, 0.02, 0.03);
    s.lineTo(-0.045, 0.035);
    s.lineTo(-0.045, -0.035);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
    geo.translate(0, 0, -0.012);
    geo.rotateY(-Math.PI / 2); // shape X -> +Z (edge forward), extrusion -> X (thickness)
    geo.scale(K, K, K);
    const head = new THREE.Mesh(geo, L.metal);
    head.position.y = len - 0.045 * K;
    g.add(head);
  } else {
    // pickaxe: a curved steel bar across the handle top, pointed at both ends
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.06, -0.3), new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, -0.06, 0.3));
    const geo = new THREE.TubeGeometry(curve, 16, 0.02, 6, false);
    // taper to points toward both ends
    const p = geo.attributes.position;
    const c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / 7) / 16;
      curve.getPoint(t, c);
      const k = 0.25 + 0.75 * Math.sin(Math.PI * t);
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
    }
    geo.computeVertexNormals();
    geo.scale(K, K, K);
    const head = new THREE.Mesh(geo, L.metal);
    head.position.y = len - 0.02 * K;
    g.add(head);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A piece of something (wood, stone, food, axe, pickaxe) as a mesh.
// userData.size = its longest extent; userData.rest = how high its center sits when lying down.
export function pieceMesh(kind, variant = Math.random()) {
  const L = lib();
  let m;
  if (kind === 'wood') {
    m = new THREE.Mesh(L.pole, [L.bark, L.wood, L.wood]);
    m.userData.rest = POLE.radius;
    m.userData.size = POLE.length;
  } else if (kind === 'stone') {
    const size = 0.0045 + variant * 0.0025; // 9-14 cm building stones to them
    m = new THREE.Mesh(L.stones[Math.floor(variant * 997) % L.stones.length], L.stone);
    m.scale.setScalar(size);
    m.userData.rest = size * 0.6;
    m.userData.size = size * 2;
  } else if (kind === 'food') {
    const size = 0.0022 + variant * 0.001;
    m = new THREE.Mesh(L.crumbs[Math.floor(variant * 991) % L.crumbs.length], L.crust);
    m.scale.setScalar(size);
    m.userData.rest = size * 0.65;
    m.userData.size = size * 2;
  } else {
    m = toolMesh(kind);
    m.userData.rest = 0.02 * K;
    m.userData.size = 0.9 * K;
  }
  m.name = `tiny-${kind}`;
  m.userData.kind = kind;
  m.userData.noCollide = true; // pieces get their own small colliders when they settle
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return m;
}

// A short stick for a campfire (a pole broken in quarters)
export function firewoodMesh() {
  const m = pieceMesh('wood');
  m.scale.set(0.25, 0.9, 0.9);
  return m;
}
