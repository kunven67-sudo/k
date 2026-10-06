// Street trees and weeds.
//
// Trees are a tapered trunk + recursive branch tubes, with foliage made of alpha-cut leaf-cluster
// cards. Card normals are bent to point away from the canopy centre so the crown shades like a
// soft volume instead of a pile of flat planes (the usual game-foliage trick). Leaf colour
// follows the real calendar: Reno's honey locusts and pears turn yellow/orange in October and
// are bare in winter.
//
//   addTree(batch, colliders, { x, y, z, height, spread, seed, month, kind: 'locust'|'pear' })
//   addWeeds(batch, { x0, z0, x1, z1, y, n, seed })     dry weeds / grass tufts in lots & cracks

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { Rng } from '../../core/rng.js';

let leafMatCache = null;
function leafMaterial() {
  if (leafMatCache) return leafMatCache;
  const tex = canvasTexture('leaf-cluster', 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = new Rng(77);
    // Twigs.
    g.strokeStyle = 'rgba(70,52,36,1)';
    g.lineWidth = 2.2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(w / 2, h);
      g.quadraticCurveTo(r.range(0.2, 0.8) * w, h * 0.6, r.range(0.1, 0.9) * w, r.range(0.1, 0.4) * h);
      g.stroke();
    }
    // Leaflets (honey-locust-like small ovals) in a circular cluster.
    for (let i = 0; i < 170; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = Math.sqrt(r.next()) * w * 0.44;
      const x = w / 2 + Math.cos(a) * d;
      const y = h / 2 + Math.sin(a) * d * 0.9;
      const l = r.range(9, 17);
      const shade = r.range(0.72, 1.0);
      const c = Math.round(235 * shade);
      g.fillStyle = `rgb(${c},${c},${c})`;
      g.save();
      g.translate(x, y);
      g.rotate(r.range(0, Math.PI * 2));
      g.beginPath();
      g.ellipse(0, 0, l, l * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(0,0,0,0.18)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-l, 0);
      g.lineTo(l, 0);
      g.stroke();
      g.restore();
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0,
    color: 0xffffff,
  });
  m.name = 'leaves';
  leafMatCache = m;
  return m;
}

// Foliage palette by month (1..12) → array of [hex, weight].
function palette(month, kind) {
  const green = [[0x4d6b2a, 3], [0x5f7d31, 3], [0x3f5a25, 2]];
  const yellow = [[0xb59a2a, 3], [0xc9a52f, 2], [0x9a8a2c, 2]];
  const orange = [[0xb8642a, 2], [0x9a3b22, 1], [0xc98a2c, 2]];
  if (month >= 4 && month <= 8) return green;
  if (month === 9) return [...green, [0x8a8a2c, 2]];
  if (month === 10) return kind === 'pear' ? [...orange, [0x6f7a2c, 2]] : [...yellow, [0x6f7a2c, 3], ...green.slice(0, 1)];
  if (month === 11) return kind === 'pear' ? orange : yellow;
  return null; // bare
}

function taperedTube(points, r0, r1, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.max(3, points.length * 2);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  // Scale each ring around its centre so the branch tapers.
  const pos = g.attributes.position;
  const ringSize = radial + 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    for (let k = 0; k < ringSize; k++) {
      const idx = i * ringSize + k;
      const v = new THREE.Vector3().fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A street tree.
 * @returns {{canopy: THREE.Vector3, radius: number}}
 */
export function addTree(batch, colliders, { x, y = 0, z, height = 6.5, spread = 2.6, seed = 1, month = 10, kind = 'locust' }) {
  const r = new Rng(seed);
  const bark = mat('wood', { color: 0x4a3c30, wear: 0.8, dirt: 0.6, varnish: 0, seed: 9 });
  const trunkH = height * 0.42;
  const base = new THREE.Vector3(x, y, z);
  const lean = new THREE.Vector3(r.range(-0.15, 0.15), 0, r.range(-0.15, 0.15));
  const top = base.clone().add(new THREE.Vector3(lean.x, trunkH, lean.z));
  batch.add(taperedTube([base, base.clone().lerp(top, 0.5).add(new THREE.Vector3(r.range(-0.05, 0.05), 0, r.range(-0.05, 0.05))), top], 0.13, 0.08, 8), bark, { castShadow: true, uv: 'keep' });
  // Root flare.
  batch.add(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 8).translate(x, y + 0.12, z), bark, { castShadow: false });
  const tips = [];
  const branches = [];
  const grow = (from, dir, len, rad, depth) => {
    const end = from.clone().addScaledVector(dir, len);
    const mid = from.clone().lerp(end, 0.5).add(new THREE.Vector3(r.range(-0.15, 0.15), r.range(-0.05, 0.1), r.range(-0.15, 0.15)));
    branches.push(taperedTube([from, mid, end], rad, rad * 0.55, 5));
    if (depth >= 2) {
      tips.push(end);
      return;
    }
    const n = depth === 0 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3(r.range(-0.7, 0.7), r.range(-0.1, 0.5), r.range(-0.7, 0.7))).normalize();
      grow(end, d, len * r.range(0.55, 0.75), rad * 0.6, depth + 1);
    }
    tips.push(end.clone().lerp(from, 0.3));
  };
  const nMain = r.int(4, 5);
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * Math.PI * 2 + r.range(-0.3, 0.3);
    const dir = new THREE.Vector3(Math.cos(a) * 0.75, r.range(0.7, 1.0), Math.sin(a) * 0.75).normalize();
    grow(top.clone().add(new THREE.Vector3(0, r.range(-0.4, 0.2), 0)), dir, height * 0.3, 0.06, 0);
  }
  for (const b of branches) batch.add(b, bark, { castShadow: true, uv: 'keep' });

  const canopy = top.clone().add(new THREE.Vector3(0, height * 0.28, 0));
  const pal = palette(month, kind);
  if (pal) {
    const leaves = leafMaterial();
    const cards = [];
    for (const tip of tips) {
      const nCards = 3;
      for (let k = 0; k < nCards; k++) {
        const s = r.range(1.0, 1.6) * (spread / 2.6);
        const g = new THREE.PlaneGeometry(s, s);
        g.rotateY(r.range(0, Math.PI));
        g.rotateX(r.range(-0.6, 0.6));
        g.translate(tip.x + r.range(-0.35, 0.35), tip.y + r.range(-0.25, 0.3), tip.z + r.range(-0.35, 0.35));
        // Bend normals outward from the canopy centre (soft volumetric shading).
        const p = g.attributes.position;
        const n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          const v = new THREE.Vector3(p.getX(i) - canopy.x, (p.getY(i) - canopy.y) * 1.3, p.getZ(i) - canopy.z).normalize();
          n.setXYZ(i, v.x, v.y + 0.25, v.z);
        }
        cards.push({ g, tint: r.weighted(pal) });
      }
    }
    for (const { g, tint } of cards) {
      // Darken cards deeper inside the crown (cheap ambient occlusion).
      const p = g.attributes.position;
      let d = 0;
      for (let i = 0; i < p.count; i++) d += Math.hypot(p.getX(i) - canopy.x, p.getZ(i) - canopy.z);
      d /= p.count;
      const ao = 0.65 + 0.35 * Math.min(1, d / spread);
      const c = new THREE.Color(tint).multiplyScalar(ao);
      batch.add(g, leaves, { tint: c, uv: 'keep', castShadow: true });
    }
  }
  colliders?.cylinder(x, y, z, 0.15, trunkH);
  return { canopy, radius: spread };
}

let weedMat = null;
/** Dry weed tufts (crossed alpha cards) scattered over a rectangle. */
export function addWeeds(batch, { x0, z0, x1, z1, y = 0, n = 30, seed = 3, avoid } = {}) {
  if (!weedMat) {
    const tex = canvasTexture('weed-tuft', 128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = new Rng(5);
      for (let i = 0; i < 40; i++) {
        const x = w / 2 + r.range(-w * 0.35, w * 0.35);
        const t = r.range(0.35, 0.95);
        g.strokeStyle = `rgb(${r.int(150, 215)},${r.int(140, 190)},${r.int(80, 120)})`;
        g.lineWidth = r.range(1, 2.4);
        g.beginPath();
        g.moveTo(w / 2 + r.range(-6, 6), h);
        g.quadraticCurveTo(x, h * (1 - t * 0.5), x + r.range(-14, 14), h * (1 - t));
        g.stroke();
      }
    });
    weedMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
    weedMat.name = 'weeds';
  }
  const r = new Rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const z = r.range(z0, z1);
    if (avoid && avoid(x, z)) continue;
    const s = r.range(0.25, 0.7);
    const a = r.range(0, Math.PI);
    for (const da of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(s, s).translate(0, s / 2, 0).rotateY(a + da).translate(x, y, z);
      // Upward normals so tufts take light like the ground they sit on.
      const nn = g.attributes.normal;
      for (let k = 0; k < nn.count; k++) nn.setXYZ(k, 0, 1, 0);
      batch.add(g, weedMat, { uv: 'keep', castShadow: false, tint: new THREE.Color().setHSL(0.11 + r.range(-0.03, 0.04), 0.35, r.range(0.4, 0.7)) });
    }
  }
}
