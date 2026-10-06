// Rigid accessories riding on bones: hats (cap, beanie, cowboy, fedora), glasses (round,
// square, aviator, reading, sunglasses), dealer bow tie, hearing aid. Built in head unit
// space from measurements of the person's own head SDF so everything fits, then converted to
// world bind space and parented to the bone (no skinning cost).
//
//   buildAccessories(human) -> [{ mesh, bone }]; hats also return a hair clip ellipsoid.

import * as THREE from 'three';
import { headSDF } from './headsdf.js';
import { CLOTH_COLORS } from './schema.js';
import { createClothMaterial } from './clothmat.js';

const { sin, cos, PI, max, min, abs, hypot } = Math;

/** Head half-extent along direction (dx, dz) at height y (unit space), by marching inward. */
function headRadius(sdf, y, dx, dz) {
  let r = 0.25;
  for (let i = 0; i < 80; i++) {
    const d = sdf(dx * r, y, dz * r - 0.01);
    if (d < 1e-4) break;
    r -= max(d * 0.8, 2e-4);
  }
  return r;
}

/** Lathe-like ring stack: rings[k] = {y, rx, rz, cz, sx?} -> BufferGeometry (closed top). */
function ringStack(rings, seg = 40, cap = true) {
  const pos = [];
  const idx = [];
  for (const r of rings) {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * PI * 2;
      let x = sin(a) * r.rx;
      let z = cos(a) * r.rz + (r.cz || 0);
      let y = r.y;
      if (r.curl) y += r.curl * (abs(sin(a)) ** 2);
      if (r.dip) y -= r.dip * max(0, cos(a)) ** 2;
      if (r.pinch) x *= 1 - r.pinch * max(0, cos(a)) ** 4;
      pos.push(x, y, z);
    }
  }
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < seg; i++) {
      const a = k * (seg + 1) + i;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  if (cap) {
    const last = rings[rings.length - 1];
    const c = pos.length / 3;
    pos.push(0, last.y + (last.top || 0), last.cz || 0);
    const o = (rings.length - 1) * (seg + 1);
    for (let i = 0; i < seg; i++) idx.push(o + i, c, o + i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function hatGeometry(kind, sdf) {
  // Band height and head radii there.
  const yb = 0.06;
  const rx = headRadius(sdf, yb, 1, 0) + 0.006;
  const rzF = headRadius(sdf, yb, 0, 1) + 0.006;
  const rzB = headRadius(sdf, yb, 0, -1) + 0.006;
  const rz = (rzF + rzB) * 0.5;
  const cz = (rzF - rzB) * 0.5 - 0.01;
  const top = headRadius(sdf, 0, 0, 0); // unused guard
  void top;
  const dome = (h, k = 1) => {
    const rings = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = t * PI * 0.5;
      rings.push({ y: yb + sin(a) * h, rx: rx * cos(a) * k + rx * (1 - k) * (1 - t), rz: rz * cos(a) * k + rz * (1 - k) * (1 - t), cz });
    }
    return rings;
  };
  const parts = [];
  if (kind === 'cap') {
    parts.push({ g: ringStack(dome(0.105), 40), fabric: 'twill' });
    // Brim: a curved visor in front.
    const pos = [];
    const idx = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = -1.15 + (2.3 * i) / n;
      for (let k = 0; k <= 3; k++) {
        const r = 1 + (k / 3) * 0.75 * (1 - (a / 1.25) ** 2) ** 0.5;
        const x = sin(a) * rx * r * 0.98;
        const z = cos(a) * rz * r + cz;
        const y = yb - 0.004 - (k / 3) * 0.012 - abs(sin(a)) * 0.006;
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      const a = i * 4 + k;
      idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push({ g, fabric: 'twill', double: true });
  } else if (kind === 'beanie') {
    const rings = dome(0.12, 0.96).map((r) => ({ ...r, y: r.y - 0.03 }));
    rings.unshift({ y: yb - 0.035, rx: rx + 0.005, rz: rz + 0.005, cz });
    rings.unshift({ y: yb - 0.06, rx: rx + 0.004, rz: rz + 0.004, cz });
    parts.push({ g: ringStack(rings, 40), fabric: 'fleece' });
  } else if (kind === 'cowboy' || kind === 'fedora') {
    const big = kind === 'cowboy';
    const h = big ? 0.13 : 0.11;
    const rings = [
      { y: yb - 0.005, rx: rx + 0.006, rz: rz + 0.006, cz },
      { y: yb + h * 0.5, rx: rx * 0.98, rz: rz * 0.98, cz },
      { y: yb + h * 0.9, rx: rx * 0.88, rz: rz * 0.9, cz, dip: big ? 0.02 : 0.015, pinch: 0.25 },
      { y: yb + h, rx: rx * 0.55, rz: rz * 0.65, cz, dip: 0.025, top: -0.012 },
    ];
    parts.push({ g: ringStack(rings, 40), fabric: big ? 'leather' : 'wool' });
    const W = big ? 0.085 : 0.05;
    const brim = [
      { y: yb - 0.004, rx: rx + 0.004, rz: rz + 0.004, cz },
      { y: yb - 0.006, rx: rx + W * 0.5, rz: rz + W * 0.5, cz, curl: big ? 0.015 : 0.004 },
      { y: yb - 0.004, rx: rx + W, rz: rz + W, cz, curl: big ? 0.04 : 0.01, dip: big ? 0.0 : 0.012 },
    ];
    parts.push({ g: ringStack(brim, 48, false), fabric: big ? 'leather' : 'wool', double: true });
    // Band.
    parts.push({ g: ringStack([{ y: yb, rx: rx + 0.007, rz: rz + 0.007, cz }, { y: yb + 0.016, rx: rx + 0.006, rz: rz + 0.006, cz }], 40, false), fabric: 'satin', band: true, double: true });
  }
  return { parts, clip: { cy: yb + 0.06, rx: rx + 0.004, ry: 0.11, rz: rz + 0.004, cz, below: yb - 0.01 } };
}

function glassesGeometry(kind, L) {
  const lens = kind === 'aviator' ? [0.024, 0.021] : kind === 'square' || kind === 'reading' ? [0.023, 0.015] : kind === 'sunglasses' ? [0.025, 0.019] : [0.019, 0.019];
  const z = L.eyes[0].c[2] + L.eyeR + 0.017;
  const y = L.eyeY + (kind === 'reading' ? -0.012 : 0.0);
  const frame = [];
  const lenses = [];
  const tube = (pts, r, closed) => {
    const pos = [];
    const idx = [];
    const m = 6;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n] || pts[i];
      const pp = pts[(i - 1 + n) % n] || pts[i];
      const tx = q[0] - pp[0];
      const ty = q[1] - pp[1];
      const tz = q[2] - pp[2];
      const tl = hypot(tx, ty, tz) || 1;
      // Frame normal ~ (0,0,1) × tangent.
      let nx = -ty / tl;
      let ny = tx / tl;
      const nl = hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      for (let k = 0; k < m; k++) {
        const a = (k / m) * PI * 2;
        pos.push(p[0] + nx * cos(a) * r, p[1] + ny * cos(a) * r, p[2] + sin(a) * r);
      }
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) for (let k = 0; k < m; k++) {
      const a = i * m + k;
      const b = ((i + 1) % n) * m + k;
      const a2 = i * m + ((k + 1) % m);
      const b2 = ((i + 1) % n) * m + ((k + 1) % m);
      idx.push(a, b, a2, a2, b, b2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const thick = kind === 'reading' || kind === 'round' ? 0.0011 : 0.0016;
  for (const e of L.eyes) {
    const cx = e.c[0];
    const pts = [];
    const lp = [[cx, y, z + 0.001]];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * PI * 2;
      let sx = cos(a);
      let sy = sin(a);
      if (kind === 'square' || kind === 'reading' || kind === 'sunglasses') {
        const p = 4;
        sx = Math.sign(sx) * abs(sx) ** (2 / p);
        sy = Math.sign(sy) * abs(sy) ** (2 / p);
      }
      if (kind === 'aviator') sy *= sy < 0 ? 1.15 : 0.8;
      const px = cx + sx * lens[0];
      const py = y + sy * lens[1] - (kind === 'aviator' && sy < 0 ? 0.004 * abs(sx) : 0);
      const pz = z - abs(sx) * 0.004 * e.side * Math.sign(sx) * e.side;
      pts.push([px, py, pz]);
      lp.push([px, py, pz + 0.0005]);
    }
    frame.push(tube(pts, thick, true));
    // Lens fan.
    const pos = [];
    const idx = [];
    for (const p of lp) pos.push(...p);
    for (let i = 1; i <= 28; i++) idx.push(0, i, (i % 28) + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    lenses.push(g);
    // Temple arm back to the ear.
    const ex = e.side * (L.eyeSep + lens[0] + 0.002);
    frame.push(tube([[ex, y + 0.004, z - 0.002], [e.side * 0.098 * L.fw, y + 0.006, -0.005], [e.side * 0.096 * L.fw, y - 0.01, -0.03]], thick * 0.9, false));
  }
  // Bridge.
  frame.push(tube([[L.eyeSep - lens[0], y + 0.004, z], [0, y + 0.008, z + 0.004], [-L.eyeSep + lens[0], y + 0.004, z]], thick * 0.9, false));
  return { frame, lenses };
}

/** Build the accessories for a human. Returns [{ mesh, boneName }] and an optional hair clip. */
export function buildAccessories(human) {
  const p = human.params;
  const L = human.geo.L;
  const sdf = headSDF(L);
  const out = [];
  let clip = null;
  const hc = human.rig.dims.j.headCenter;
  const k = human.hsc;
  const toWorld = (g) => g.scale(k, k, k).translate(hc.x, hc.y, hc.z);
  const tierName = human.tierName;
  if (p.hat && p.hat !== 'none') {
    const hg = hatGeometry(p.hat, sdf);
    clip = hg.clip;
    const color = CLOTH_COLORS[p.hatColor] ?? 0x8a1a1a;
    for (const part of hg.parts) {
      const m = createClothMaterial({ fabric: part.fabric, color: part.band ? 0x1c1a18 : color, tierName, wear: p.wear, dirt: p.dirtiness * 0.6, seed: p.seed + 3 });
      if (part.double) m.side = THREE.DoubleSide;
      out.push({ geometry: toWorld(part.g), material: m, bone: 'head', cloth: true });
    }
  }
  if (p.glasses && p.glasses !== 'none') {
    const gg = glassesGeometry(p.glasses, L);
    const metal = p.glasses === 'aviator' || p.glasses === 'round';
    const fm = new THREE.MeshPhysicalMaterial({ color: metal ? 0xc9a75a : p.glasses === 'reading' ? 0x5a3a26 : 0x151515, metalness: metal ? 1 : 0, roughness: metal ? 0.3 : 0.35, clearcoat: metal ? 0 : 0.8 });
    const lm = new THREE.MeshPhysicalMaterial({ color: p.glasses === 'sunglasses' || p.glasses === 'aviator' ? 0x1a2420 : 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: p.glasses === 'sunglasses' || p.glasses === 'aviator' ? 0.82 : 0.12, side: THREE.DoubleSide, depthWrite: false });
    for (const g of gg.frame) out.push({ geometry: toWorld(g), material: fm, bone: 'head' });
    for (const g of gg.lenses) out.push({ geometry: toWorld(g), material: lm, bone: 'head', noShadow: true });
  }
  if (p.top === 'dealer') {
    // Bow tie at the collar front.
    const seam = human.geo.seam;
    const y = seam.y + seam.ty * 1.0 + 0.01 * human.rig.dims.s;
    const z = seam.cz + seam.F + 0.012 * human.rig.dims.s;
    const g = new THREE.BufferGeometry();
    const w = 0.045 * human.rig.dims.s;
    const h = 0.022 * human.rig.dims.s;
    const pos = [0, 0, 0.004, w, h * 0.5, -0.002, w, -h * 0.5, -0.002, -w, h * 0.5, -0.002, -w, -h * 0.5, -0.002, 0, h * 0.25, 0.006, 0, -h * 0.25, 0.006];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex([0, 1, 2, 0, 4, 3, 5, 1, 0, 0, 2, 6, 5, 0, 3, 6, 4, 0]);
    g.computeVertexNormals();
    g.translate(0, y, z);
    const m = createClothMaterial({ fabric: 'satin', color: 0x111014, tierName, seed: p.seed });
    m.side = THREE.DoubleSide;
    out.push({ geometry: g, material: m, bone: 'neck', cloth: true });
  }
  if (p.hearingAid) {
    const g = new THREE.CapsuleGeometry(0.004, 0.012, 4, 8).rotateX(0.5);
    const ex = (0.098 * L.fw + 0.004) * k;
    g.translate(hc.x + ex, hc.y + 0.0 * k, hc.z - 0.03 * k);
    out.push({ geometry: g, material: new THREE.MeshPhysicalMaterial({ color: 0xd8bfa4, roughness: 0.4, clearcoat: 0.5 }), bone: 'head' });
  }
  return { items: out, clip };
}

void min;
