// Motel room door kit: painted hollow-metal door slab with a kick plate, knob + deadbolt, peephole,
// in a steel jamb. Built as a list of parts in DOOR-LOCAL space (hinge edge at x = 0, slab spans
// x 0..w, bottom at y = 0, outer face toward +z), so the same parts are either stamped into the
// static batch (every other room) or merged into a hinged Object3D (the player's door).
import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from '../../gfx/geom.js';
import { motelMats, PAL } from './mats.js';
import { tinted } from '../shared/batch.js';

export const DOOR = { w: 0.9, h: 2.08, t: 0.045 };

let KM = null;
function kitMats() {
  if (KM) return KM;
  KM = {
    brass: mat('brass', { wear: 0.6, dirt: 0.5, seed: 851 }),
    alu: mat('aluminum', { wear: 0.7, dirt: 0.6, seed: 852 }),
    black: mat('rubber', { seed: 853 }),
  };
  return KM;
}

/** Parts of a door slab. `inside` adds the interior hardware (chain, deadbolt thumb turn). */
export function doorParts({ w = DOOR.w, h = DOOR.h, tint = PAL.doors[0], inside = false } = {}) {
  const M = motelMats();
  const K = kitMats();
  const T = DOOR.t;
  const parts = [];
  const box = (sx, sy, sz, x, y, z, material, o = {}) => parts.push({ geo: new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), mat: material, tint: o.tint ?? null, grime: o.grime });
  const cyl = (r, l, x, y, z, material, axis = 'z', seg = 14) => {
    const g = new THREE.CylinderGeometry(r, r, l, seg);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    parts.push({ geo: g.translate(x, y, z), mat: material, tint: null });
  };
  // Slab with a slight inset panel line (two stacked boxes give the flush-door edge reveal).
  box(w - 0.006, h - 0.006, T, w / 2, h / 2, 0, M.doorMetal, { tint, grime: 0.7 });
  // Kick plate (outside) — scuffed aluminium.
  box(w - 0.08, 0.25, 0.004, w / 2, 0.15, T / 2 + 0.002, K.alu);
  // Knob + rose, deadbolt above, peephole at eye height.
  const kx = w - 0.075;
  for (const s of [1, -1]) {
    const z = s * (T / 2 + 0.012);
    cyl(0.03, 0.012, kx, 0.98, z, K.brass);
    const knob = new THREE.SphereGeometry(0.03, 14, 10).scale(1, 1, 0.8).translate(kx, 0.98, s * (T / 2 + 0.055));
    parts.push({ geo: knob, mat: K.brass, tint: null });
    cyl(0.011, 0.05, kx, 0.98, s * (T / 2 + 0.03), K.brass);
    cyl(0.028, 0.012, kx, 1.18, z, K.brass);
  }
  cyl(0.012, T + 0.02, w / 2, 1.55, 0, K.brass);
  cyl(0.006, T + 0.024, w / 2, 1.55, 0, K.black);
  if (inside) {
    // Deadbolt thumb turn + security chain track (the chain itself hangs from it).
    box(0.012, 0.035, 0.02, kx, 1.18, -T / 2 - 0.022, K.brass);
    box(0.12, 0.022, 0.012, w - 0.12, 1.38, -T / 2 - 0.007, K.brass);
    // Chain: a few links drooping toward the jamb.
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = w - 0.06 + t * 0.1;
      const y = 1.38 - Math.sin(t * Math.PI) * 0.06;
      const link = new THREE.TorusGeometry(0.008, 0.002, 4, 8).rotateY(i % 2 ? Math.PI / 2 : 0).translate(x, y, -T / 2 - 0.016);
      parts.push({ geo: link, mat: K.brass, tint: null });
    }
  }
  return parts;
}

/** Steel jamb (frame) parts in the same local space; `depth` = wall thickness (into -z). */
export function jambParts({ w = DOOR.w, h = DOOR.h, depth = 0.3, tint = PAL.trimDark } = {}) {
  const M = motelMats();
  const parts = [];
  const f = 0.055;
  const box = (sx, sy, sz, x, y, z) => parts.push({ geo: new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), mat: M.metal, tint });
  box(f, h + f, depth + 0.02, -f / 2, (h + f) / 2, -depth / 2 + 0.01);
  box(f, h + f, depth + 0.02, w + f / 2, (h + f) / 2, -depth / 2 + 0.01);
  box(w + 2 * f, f, depth + 0.02, w / 2, h + f / 2, -depth / 2 + 0.01);
  // Aluminium threshold.
  parts.push({ geo: new THREE.BoxGeometry(w + 0.1, 0.02, depth + 0.06).translate(w / 2, 0.01, -depth / 2), mat: kitMats().alu, tint: null });
  return parts;
}

/** Stamp parts into a StaticBatch with a local→world matrix. */
export function stampParts(batch, parts, matrix, o = {}) {
  for (const p of parts) batch.add(p.geo, p.mat, { matrix, tint: p.tint ?? undefined, grime: p.grime, grimeBase: o.grimeBase, uv: p.uv, castShadow: o.castShadow });
}

/** Merge parts into a Group of one mesh per material (vertex-tinted when needed). */
export function partsToGroup(parts, { castShadow = true, receiveShadow = true } = {}) {
  const byMat = new Map();
  for (const p of parts) {
    const g = p.geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    worldUV(g, p.mat.userData?.tileMeters ?? 1);
    const c = new THREE.Color(p.tint ?? 0xffffff);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) {
      col[i] = c.r;
      col[i + 1] = c.g;
      col[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!byMat.has(p.mat)) byMat.set(p.mat, []);
    byMat.get(p.mat).push(g);
  }
  const group = new THREE.Group();
  for (const [m, geos] of byMat) {
    const vc = vcMat(m);
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), vc);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    group.add(mesh);
  }
  return group;
}

// Same vertex-colour clone the StaticBatch uses, so the hinged door shares its materials.
const vcMat = (m) => tinted(m);
