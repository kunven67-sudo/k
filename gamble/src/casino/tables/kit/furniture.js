// Table furniture shared by blackjack and roulette: swept padded rails and wooden aprons, casino
// chairs, felt material with a printed layout, acrylic placards, colliders. Everything static is
// built as plain meshes and merged per material by the table builders (mergeByMaterial).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from '../../../gfx/materials.js';
import { RAPIER, GROUPS } from '../../../core/physics.js';

// ---- paths & sweeps ----------------------------------------------------------------------------

/** Points along an arc around (cx, cz) from angle a0 to a1 (angle 0 = +Z, positive toward +X). */
export function arcPath(cx, cz, r, a0, a1, n = 64) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, nx: Math.sin(a), nz: Math.cos(a) });
  }
  return pts;
}

/**
 * A rounded rectangle path (counter-clockwise seen from above), outward normals. Used for the
 * roulette rail. corner radius rc, segments per corner n.
 */
export function roundRectPath(x0, z0, x1, z1, rc, n = 10) {
  const pts = [];
  const corners = [
    [x1 - rc, z1 - rc, 0], // +X+Z corner, angles from +Z (0) to +X (π/2)
    [x1 - rc, z0 + rc, Math.PI / 2],
    [x0 + rc, z0 + rc, Math.PI],
    [x0 + rc, z1 - rc, Math.PI * 1.5],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n);
      pts.push({ x: cx + Math.sin(a) * rc, z: cz + Math.cos(a) * rc, nx: Math.sin(a), nz: Math.cos(a) });
    }
  }
  return pts;
}

/**
 * Sweep a 2D profile [[outwardOffset, y], …] along a path of {x, z, nx, nz}. UVs: u = distance
 * along the path / tile, v = distance along the profile / tile. Optional end caps.
 */
export function sweep(path, profile, { closed = false, tile = 0.6, caps = false } = {}) {
  const pos = [];
  const uv = [];
  const idx = [];
  const np = profile.length;
  let dist = 0;
  const vdist = [0];
  for (let j = 1; j < np; j++) vdist.push(vdist[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  const rows = closed ? path.length + 1 : path.length;
  for (let i = 0; i < rows; i++) {
    const p = path[i % path.length];
    if (i > 0) {
      const q = path[(i - 1) % path.length];
      dist += Math.hypot(p.x - q.x, p.z - q.z);
    }
    for (let j = 0; j < np; j++) {
      const [d, y] = profile[j];
      pos.push(p.x + p.nx * d, y, p.z + p.nz * d);
      uv.push(dist / tile, vdist[j] / tile);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < np - 1; j++) {
      const a = i * np + j;
      const b = (i + 1) * np + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (caps && !closed) {
    for (const [i, flip] of [[0, true], [path.length - 1, false]]) {
      const base = pos.length / 3;
      const p = path[i];
      let cx = 0;
      let cy = 0;
      for (const [d, y] of profile) {
        cx += d;
        cy += y;
      }
      cx /= np;
      cy /= np;
      pos.push(p.x + p.nx * cx, cy, p.z + p.nz * cx);
      uv.push(0, 0);
      for (let j = 0; j < np; j++) {
        const [d, y] = profile[j];
        pos.push(p.x + p.nx * d, y, p.z + p.nz * d);
        uv.push(d / tile, y / tile);
      }
      for (let j = 0; j < np - 1; j++) {
        if (flip) idx.push(base, base + 1 + j, base + 2 + j);
        else idx.push(base, base + 2 + j, base + 1 + j);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flip faces so they point away from `inside` (a point inside the solid). */
export function orientOutward(g, inside) {
  const P = g.attributes.position.array;
  const I = g.index.array;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (P[a] + P[b] + P[c]) / 3 - inside.x;
    const my = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - inside.y;
    const mz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - inside.z;
    if (nx * mx + ny * my + nz * mz < 0) {
      const tmp = I[t + 1];
      I[t + 1] = I[t + 2];
      I[t + 2] = tmp;
    }
  }
  g.computeVertexNormals();
  return g;
}

// ---- merging -----------------------------------------------------------------------------------

/**
 * Merge a list of { geo, mat, matrix? } parts into one mesh per material (static draw calls).
 * Geometries are normalised to position/normal/uv (uv1 kept when every part has it).
 */
export function mergeByMaterial(parts, { castShadow = true, receiveShadow = true } = {}) {
  const groups = new Map();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!groups.has(p.mat)) groups.set(p.mat, []);
    groups.get(p.mat).push(g);
  }
  const meshes = [];
  for (const [m, list] of groups) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.name = `static:${m.name || m.type}`;
    meshes.push(mesh);
  }
  return meshes;
}

/** World-scale UVs on a geometry (box projection) so procedural materials keep real scale. */
export function boxUV(g, tile = 1) {
  const p = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = p.getX(i);
      v = p.getZ(i);
    } else if (ax >= az) {
      u = p.getZ(i);
      v = p.getY(i);
    } else {
      u = p.getX(i);
      v = p.getY(i);
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function roundedBox(w, h, d, r = 0.01, seg = 2) {
  return new RoundedBox(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
/** Matrix from position + Euler rotation (+ optional scale). */
export function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}

// ---- materials ---------------------------------------------------------------------------------

export const M = {
  leather: () => mat('leather', { color: 0x2a1310, wear: 0.35, dirt: 0.25, seed: 3 }),
  wood: () => mat('wood', { color: 0x5b2c17, varnish: 0.75, wear: 0.35, dirt: 0.2, seed: 5 }),
  woodDark: () => mat('wood', { color: 0x2e170c, varnish: 0.6, wear: 0.3, dirt: 0.3, seed: 8 }),
  brass: () => mat('brass', { wear: 0.25, dirt: 0.2 }),
  chairFabric: () => mat('fabric', { color: 0x5a1420, wear: 0.35, dirt: 0.3, seed: 11 }),
  base: () => mat('metal-painted', { color: 0x1c1a19, wear: 0.4, dirt: 0.5 }),
};

/**
 * Felt with a printed layout: `print` (CanvasTexture, uv channel 0 in layout space) over the felt
 * kind's fibre normal/roughness maps on uv channel 1 (world-scale tiling).
 */
export function printedFelt(print, color = 0x0f5a3a) {
  const base = mat('felt', { color, dirt: 0.12, wear: 0.2, seed: 21 });
  const m = base.clone();
  m.map = print;
  m.color = new THREE.Color(0xffffff);
  for (const k of ['normalMap', 'roughnessMap', 'aoMap']) {
    if (!base[k]) continue;
    const t = base[k].clone();
    t.channel = 1;
    t.needsUpdate = true;
    m[k] = t;
  }
  m.metalnessMap = null;
  m.metalness = 0;
  m.aoMapIntensity = 0.6;
  m.name = 'felt-print';
  return m;
}

/** Add uv1 = world-scale coords (x/tile, z/tile) to a flat geometry for the fibre maps. */
export function addUv1(g, tile = 0.5) {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / tile;
    uv[i * 2 + 1] = p.getZ(i) / tile;
  }
  g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---- chairs ------------------------------------------------------------------------------------

/**
 * One casino table chair as parts (local: seat centre at origin on the floor, facing +Z; the
 * sitter's back is at −Z). seatH = cushion top height.
 */
export function chairParts(seatH = 0.5, { fabric, wood, brass }) {
  const parts = [];
  const cushion = roundedBox(0.44, 0.075, 0.42, 0.03, 3);
  parts.push({ geo: boxUV(cushion, 0.4), mat: fabric, matrix: trs(0, seatH - 0.0375, 0) });
  // Seat pan (wood) under the cushion.
  parts.push({ geo: boxUV(roundedBox(0.42, 0.03, 0.4, 0.01), 0.6), mat: wood, matrix: trs(0, seatH - 0.09, 0) });
  // Backrest: padded panel on two wooden posts, slightly reclined.
  const back = roundedBox(0.42, 0.3, 0.06, 0.028, 3);
  parts.push({ geo: boxUV(back, 0.4), mat: fabric, matrix: trs(0, seatH + 0.3, -0.2, -0.12) });
  parts.push({ geo: boxUV(roundedBox(0.44, 0.04, 0.05, 0.015), 0.6), mat: wood, matrix: trs(0, seatH + 0.46, -0.215, -0.12) });
  for (const sx of [-1, 1]) {
    parts.push({ geo: boxUV(roundedBox(0.035, 0.42, 0.035, 0.008), 0.6), mat: wood, matrix: trs(sx * 0.185, seatH + 0.14, -0.2, -0.12) });
  }
  // Four legs, slightly splayed, with a brass foot ring.
  const legH = seatH - 0.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    parts.push({ geo: boxUV(roundedBox(0.04, legH, 0.04, 0.008), 0.6), mat: wood, matrix: trs(sx * 0.18, legH / 2, sz * 0.17, sz * -0.04, 0, sx * 0.04) });
    parts.push({ geo: new THREE.CylinderGeometry(0.018, 0.02, 0.012, 10), mat: brass, matrix: trs(sx * 0.188, 0.006, sz * 0.178) });
  }
  const ring = new THREE.TorusGeometry(0.205, 0.008, 6, 28);
  parts.push({ geo: ring, mat: brass, matrix: trs(0, 0.2, 0, Math.PI / 2) });
  return parts;
}

/** Transform a list of parts by a matrix (placing a chair). */
export function placeParts(parts, matrix) {
  return parts.map((p) => ({ ...p, matrix: p.matrix ? matrix.clone().multiply(p.matrix) : matrix.clone() }));
}

// ---- colliders ---------------------------------------------------------------------------------

/** Convex hull collider from local points of `group` (world-transformed). */
export function addHull(physics, group, localPts, { owner = null } = {}) {
  if (!physics?.world || !RAPIER?.ColliderDesc) return null;
  group.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  const arr = new Float32Array(localPts.length * 3);
  localPts.forEach((p, i) => {
    v.copy(p).applyMatrix4(group.matrixWorld);
    arr[i * 3] = v.x;
    arr[i * 3 + 1] = v.y;
    arr[i * 3 + 2] = v.z;
  });
  const desc = RAPIER.ColliderDesc.convexHull(arr);
  if (!desc) return null;
  desc.setFriction(0.8).setRestitution(0.05).setCollisionGroups(GROUPS.static);
  const col = physics.world.createCollider(desc);
  if (owner) physics.setOwner?.(col, owner);
  return col;
}

/** Prism points: a 2D outline [{x,z}] extruded from y0 to y1. */
export function prism(outline, y0, y1) {
  const pts = [];
  for (const p of outline) {
    pts.push(new THREE.Vector3(p.x, y0, p.z), new THREE.Vector3(p.x, y1, p.z));
  }
  return pts;
}

/** Oriented box collider in the group's local frame. */
export function addLocalBox(physics, group, cx, cy, cz, w, h, d, yaw = 0, opts = {}) {
  const pts = [];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = (sx * w) / 2;
    const lz = (sz * d) / 2;
    pts.push(new THREE.Vector3(cx + lx * c + lz * s, cy + (sy * h) / 2, cz - lx * s + lz * c));
  }
  return addHull(physics, group, pts, opts);
}

// ---- canvas helpers ----------------------------------------------------------------------------

/** Characters along an arc (canvas space), letters upright toward the centre. */
export function arcText(g, text, cx, cy, r, midAngle, { font, color, spacing = 1, outline = null } = {}) {
  g.save();
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const widths = [...text].map((ch) => g.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = midAngle - total / r / 2;
  for (let i = 0; i < widths.length; i++) {
    const ch = text[i];
    const half = widths[i] / 2 / r;
    a += half;
    g.save();
    g.translate(cx + Math.sin(a) * r, cy + Math.cos(a) * r);
    g.rotate(-a);
    if (outline) {
      g.strokeStyle = outline;
      g.lineWidth = 2;
      g.strokeText(ch, 0, 0);
    }
    g.fillText(ch, 0, 0);
    g.restore();
    a += half;
  }
  g.restore();
}

/** Fibre noise + light pool + wear, painted over a felt base colour. */
export function paintFeltBase(g, w, h, color, { pool = [0.5, 0.45], seed = 1 } = {}) {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Mottling (dye lots, brushing direction).
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 20 + rnd() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.025 + rnd() * 0.03;
    gr.addColorStop(0, rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine fibre speckle.
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // Pool of light from the fixture above (the edges fall off into shadow).
  const gr = g.createRadialGradient(w * pool[0], h * pool[1], Math.min(w, h) * 0.15, w * pool[0], h * pool[1], Math.max(w, h) * 0.75);
  gr.addColorStop(0, 'rgba(255,240,200,0.05)');
  gr.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

/** A drink ring / stain (never too clean). */
export function stain(g, x, y, r, a = 0.08) {
  g.save();
  g.strokeStyle = `rgba(30,20,10,${a})`;
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(30,20,10,${a * 0.4})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

export function canvasTex(w, h, paint, { anisotropy = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.canvas = c;
  t.repaint = () => {
    paint(c.getContext('2d'), w, h);
    t.needsUpdate = true;
  };
  if (document.fonts?.load) {
    Promise.all(['700 30px "Playfair Display"', 'italic 400 30px "Playfair Display"', '30px "Bebas Neue"'].map((f) => document.fonts.load(f)))
      .then(() => t.repaint())
      .catch(() => {});
  }
  return t;
}
