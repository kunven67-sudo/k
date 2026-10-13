// Garden things: shrubs and a firewood pile (real places spiders live).
//
// Shrubs: woody stems that branch, and about a thousand real leaves each (an elliptical leaf with a
// midrib and side veins, lighter underneath), angled toward the light. Their solid parts for physics
// are the stems plus the outer shell of leaves (what a spider glues its web to, what you bump into).
// Firewood: split and round logs stacked in rows against a wall, bark on the sides, rings on the ends.
import * as THREE from 'three';
import { RAPIER, GROUPS } from '../core/physics.js';
import { std } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { hash3 } from '../core/util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
let M = null;

function leafTexture() {
  const W = 128, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  // Leaf blade: pointed oval.
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#2f5a1f');
  g.addColorStop(0.5, '#4a7d2c');
  g.addColorStop(1, '#2f5a1f');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(W / 2, 4);
  c.bezierCurveTo(W * 1.02, H * 0.25, W * 0.92, H * 0.78, W / 2, H - 4);
  c.bezierCurveTo(W * 0.08, H * 0.78, -W * 0.02, H * 0.25, W / 2, 4);
  c.fill();
  // Midrib and side veins.
  c.strokeStyle = 'rgba(190,220,150,0.55)';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(W / 2, 6);
  c.lineTo(W / 2, H - 6);
  c.stroke();
  c.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const y = H * (0.12 + i * 0.085);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(W / 2, y);
      c.quadraticCurveTo(W / 2 + s * W * 0.2, y - H * 0.03, W / 2 + s * W * 0.38, y - H * 0.08);
      c.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function mats() {
  if (M) return M;
  const bark = TX.generate('bark', 256, (u, v) => {
    const furrow = Math.abs(Math.sin((u * 14 + TX.fbm(u, v * 0.3, { freq: 4, oct: 3, seed: 71 }) * 3) * Math.PI));
    const n = TX.fbm(u, v, { freq: 12, oct: 4, seed: 72 });
    const d = 0.35 + furrow * 0.35 + n * 0.2;
    return [0.36 * d, 0.27 * d, 0.2 * d, furrow * 0.7 + n * 0.3, 0.9];
  }, { normalStrength: 3 });
  const rings = TX.generate('logEnd', 256, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2;
    const ring = Math.sin(r * 38 + TX.fbm(u, v, { freq: 6, oct: 2, seed: 73 }) * 4) * 0.5 + 0.5;
    const crack = Math.abs(Math.atan2(dy, dx) - 0.7) < 0.02 && r < 0.8 ? 0.4 : 0;
    const d = r > 0.92 ? 0.35 : 0.72 + ring * 0.18 - crack;
    return [0.78 * d, 0.6 * d, 0.4 * d, ring * 0.3, 0.85];
  }, { normalStrength: 1.5 });
  M = {
    bark: std({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95 }, { detail: 'wood' }),
    logEnd: std({ map: rings.map, normalMap: rings.normalMap, roughness: 0.9 }, { detail: 'wood' }),
    stem: std({ map: bark.map, normalMap: bark.normalMap, color: 0x9a8a78, roughness: 0.9 }, { detail: 'wood' }),
    leaf: std({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.62, color: 0xffffff }, { detail: 'plastic' }),
  };
  return M;
}

function staticShape(game, desc, owner) {
  const c = game.physics.world.createCollider(desc.setCollisionGroups(GROUPS.static));
  game.physics.own(c, owner);
  return c;
}

// A rounded shrub (pittosporum-like hedge shrub, common in California gardens).
export function shrub(game, { at, radius = 0.45, height = 1.1, seed = 1 }) {
  const m = mats();
  const owner = { kind: 'plant', name: 'Shrub', def: { material: 'wood' } };
  const stems = [];
  const leafMats = [];
  const center = new THREE.Vector3(at[0], at[1] + height * 0.55, at[2]);
  // Stems: a few from the base, each splitting twice, reaching into the leafy shell.
  const tips = [];
  const grow = (from, dir, len, r, depth, k) => {
    const to = from.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(r * 0.75, r, len, 6, 1, false);
    g.translate(0, len / 2, 0);
    _q.setFromUnitVectors(UP, dir);
    g.applyQuaternion(_q);
    g.translate(from.x, from.y, from.z);
    stems.push(g);
    if (depth >= 2) {
      tips.push(to);
      return;
    }
    for (let b = 0; b < 2; b++) {
      const a = hash3(k, b, depth, seed * 13) * Math.PI * 2;
      const nd = dir.clone().add(new THREE.Vector3(Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.55)).normalize();
      grow(to, nd, len * 0.72, r * 0.62, depth + 1, k * 3 + b + 1);
    }
  };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + hash3(i, seed, 1, 21) * 0.6;
    const dir = new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize();
    grow(new THREE.Vector3(at[0] + Math.cos(a) * 0.03, at[1], at[2] + Math.sin(a) * 0.03), dir, height * 0.42, 0.014, 0, i + 1);
  }
  const stemMesh = new THREE.Mesh(mergeGeometries(stems), m.stem);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  game.scene.add(stemMesh);
  // Leaves: on an ellipsoid shell (where light reaches), facing out and up, each a little different.
  const N = 1100;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * ((i + 0.5) / N);
    const rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
    const depth = 0.82 + 0.2 * hash3(i, seed, 2, 22); // some deeper inside
    const p = new THREE.Vector3(Math.cos(a) * rr * radius * depth, y * height * 0.48 * depth, Math.sin(a) * rr * radius * depth).add(center);
    if (p.y < at[1] + 0.12) continue; // no leaves on the dirt
    const out = p.clone().sub(center).normalize().add(new THREE.Vector3(0, 0.6, 0)).normalize();
    const L = 0.045 + hash3(i, seed, 3, 22) * 0.025;
    // Leaf plane: tilted out from the stem, spun around its own axis.
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
    const spin = new THREE.Quaternion().setFromAxisAngle(out, hash3(i, seed, 4, 22) * Math.PI * 2);
    _q.premultiply(spin);
    leafMats.push(new THREE.Matrix4().compose(p, _q, _s.set(L * 0.45, L, 1)));
  }
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const leaves = new THREE.InstancedMesh(leafGeo, m.leaf, leafMats.length);
  leafMats.forEach((mm, i) => leaves.setMatrixAt(i, mm));
  // A little color variation leaf to leaf (young leaves lighter, old ones darker).
  const col = new THREE.Color();
  for (let i = 0; i < leafMats.length; i++) leaves.setColorAt(i, col.setHSL(0.27 + (hash3(i, seed, 5, 23) - 0.5) * 0.04, 0.45, 0.42 + hash3(i, seed, 6, 23) * 0.22));
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  game.scene.add(leaves);
  // Physics: the main stems, and the leafy shell as a set of balls (you brush against it, webs hang on it).
  for (const g of stems.slice(0, 5)) {
    g.computeBoundingBox();
  }
  for (let i = 0; i < 9; i++) {
    const y = 1 - 2 * ((i + 0.5) / 9), rr = Math.sqrt(1 - y * y), a = i * 2.39996;
    const p = new THREE.Vector3(Math.cos(a) * rr * radius * 0.55, y * height * 0.28, Math.sin(a) * rr * radius * 0.55).add(center);
    staticShape(game, RAPIER.ColliderDesc.ball(radius * 0.48).setTranslation(p.x, p.y, p.z), owner);
  }
  return { center, radius, height, owner };
}

// Firewood stacked against a wall: rows of logs, ends showing. `along`: x direction of the row.
export function woodpile(game, { at, length = 1.2, rows = 6, logLen = 0.4, seed = 5 }) {
  const m = mats();
  const owner = { kind: 'prop-static', name: 'Firewood', def: { material: 'wood' } };
  const sides = [], ends = [];
  let y = at[1];
  // Two rails on the ground (logs kept off the dirt): the gap under them is where widows love to live.
  for (const z of [at[2] - logLen * 0.3, at[2] + logLen * 0.3]) {
    const g = new THREE.BoxGeometry(length + 0.05, 0.07, 0.07);
    g.translate(at[0], y + 0.035, z);
    sides.push(g);
    staticShape(game, RAPIER.ColliderDesc.cuboid((length + 0.05) / 2, 0.035, 0.035).setTranslation(at[0], y + 0.035, z), owner);
  }
  y += 0.07;
  for (let row = 0; row < rows; row++) {
    let x = at[0] - length / 2;
    let k = 0;
    let top = 0;
    while (x < at[0] + length / 2 - 0.05) {
      const r = 0.045 + hash3(row, k, seed, 31) * 0.03;
      const cx = x + r;
      const cy = y + r;
      const g = new THREE.CylinderGeometry(r, r * (0.95 + hash3(row, k, seed, 32) * 0.08), logLen * (0.92 + hash3(row, k, seed, 33) * 0.16), 12, 1, true);
      g.rotateX(Math.PI / 2);
      g.rotateZ((hash3(row, k, seed, 34) - 0.5) * 0.08);
      g.translate(cx, cy, at[2] + (hash3(row, k, seed, 35) - 0.5) * 0.04);
      sides.push(g);
      for (const s of [-1, 1]) {
        const e = new THREE.CircleGeometry(r * 0.98, 12);
        if (s < 0) e.rotateY(Math.PI);
        e.translate(cx, cy, at[2] + s * logLen * 0.47);
        ends.push(e);
      }
      _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      staticShape(game, RAPIER.ColliderDesc.cylinder(logLen * 0.47, r).setTranslation(cx, cy, at[2]).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }), owner);
      x += r * 2 + 0.002;
      top = Math.max(top, r * 2);
      k++;
    }
    y += top * 0.86; // logs settle into the gaps of the row below
  }
  const s = new THREE.Mesh(mergeGeometries(sides.map((g) => g.toNonIndexed())), m.bark);
  const e = new THREE.Mesh(mergeGeometries(ends.map((g) => g.toNonIndexed())), m.logEnd);
  for (const mm of [s, e]) {
    mm.castShadow = true;
    mm.receiveShadow = true;
    game.scene.add(mm);
  }
  return { owner };
}
