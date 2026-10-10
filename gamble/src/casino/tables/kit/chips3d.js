// Physical casino chips: 39 mm × 3.3 mm clay chips in Nevada colours with edge spots and a printed
// Eldorado inlay, all chips of a table in ONE instanced mesh (kind per instance; roulette wheel
// chips are tinted per instance). Piles stack chips with the small offsets real stacks have.
//
//   const chipMesh = new ChipMeshes({ capacity: 600 });  group.add(chipMesh.mesh)
//   const pile = new Pile(chipMesh, x, z, feltY);  pile.push(kindOf(25));  pile.pop()
//
// Kinds: 0..6 = DENOMS order ($1, $2.50, $5, $25, $100, $500, $1000), 7 = roulette wheel chip.

import * as THREE from 'three';
import { DENOMS, CHIP_RADIUS, CHIP_THICKNESS } from '../../chips.js';

export const WHEEL_KIND = 7;
export const kindOf = (v) => DENOMS.findIndex((d) => d.v === v);
export const valueOfKind = (k) => DENOMS[k]?.v ?? 0;
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const R = CHIP_RADIUS;
const T = CHIP_THICKNESS;

// ---- art ---------------------------------------------------------------------------------------

function denomLabel(v) {
  if (v === 2.5) return '2½';
  if (v >= 1000) return `${v / 1000}K`;
  return String(v);
}

function drawTop(g, k, x0, y0, S) {
  const d = DENOMS[k];
  const cx = x0 + S / 2;
  const cy = y0 + S / 2;
  const rr = S / 2 - 1;
  const base = d ? hex(d.color) : '#f2f2f2';
  const spot = d ? hex(d.stripe) : '#ffffff';
  const ink = d ? hex(d.ink) : '#3a3a3a';
  g.save();
  g.fillStyle = base;
  g.fillRect(x0, y0, S, S);
  // Edge spots (6 inserts) running onto the top face.
  g.fillStyle = spot;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.arc(cx, cy, rr + 2, a - 0.2, a + 0.2);
    g.arc(cx, cy, rr * 0.8, a + 0.2, a - 0.2, true);
    g.closePath();
    g.fill();
  }
  // Small dashes between spots (molded "denticle" ring).
  g.strokeStyle = d && d.v === 1000 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.55)';
  g.lineWidth = S * 0.012;
  for (let i = 0; i < 6; i++) {
    for (let j = 1; j <= 3; j++) {
      const a = ((i + j / 4) / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * rr * 0.83, cy + Math.sin(a) * rr * 0.83);
      g.lineTo(cx + Math.cos(a) * rr * 0.93, cy + Math.sin(a) * rr * 0.93);
      g.stroke();
    }
  }
  // Molded ring and inlay.
  g.beginPath();
  g.arc(cx, cy, rr * 0.63, 0, Math.PI * 2);
  g.strokeStyle = spot;
  g.lineWidth = S * 0.018;
  g.stroke();
  const inlayR = rr * 0.55;
  const ig = g.createRadialGradient(cx - inlayR * 0.3, cy - inlayR * 0.3, inlayR * 0.1, cx, cy, inlayR);
  if (k === WHEEL_KIND) {
    ig.addColorStop(0, '#ffffff');
    ig.addColorStop(1, '#e4e4e4');
  } else {
    ig.addColorStop(0, '#fbf6e8');
    ig.addColorStop(1, '#e8dcc0');
  }
  g.beginPath();
  g.arc(cx, cy, inlayR, 0, Math.PI * 2);
  g.fillStyle = ig;
  g.fill();
  g.lineWidth = S * 0.01;
  g.strokeStyle = ink;
  g.stroke();
  if (k === WHEEL_KIND) {
    // Roulette chips carry no value: a little wheel print.
    g.strokeStyle = '#555';
    g.lineWidth = S * 0.012;
    for (const r of [0.5, 0.32, 0.12]) {
      g.beginPath();
      g.arc(cx, cy, inlayR * r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * inlayR * 0.32, cy + Math.sin(a) * inlayR * 0.32);
      g.lineTo(cx + Math.cos(a) * inlayR * 0.5, cy + Math.sin(a) * inlayR * 0.5);
      g.stroke();
    }
    g.restore();
    return;
  }
  // Curved house text around the inlay.
  g.fillStyle = ink;
  g.font = `700 ${S * 0.056}px "Playfair Display", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = 'ELDORADO · RENO NEVADA · ';
  const chars = [...text];
  const rt = inlayR * 0.79;
  for (let i = 0; i < chars.length; i++) {
    const a = -Math.PI / 2 + (i / chars.length) * Math.PI * 2;
    g.save();
    g.translate(cx + Math.cos(a) * rt, cy + Math.sin(a) * rt);
    g.rotate(a + Math.PI / 2);
    g.fillText(chars[i], 0, 0);
    g.restore();
  }
  // Denomination.
  const label = denomLabel(d.v);
  g.font = `700 ${S * (label.length > 2 ? 0.18 : 0.22)}px "Playfair Display", Georgia, serif`;
  g.fillStyle = d.v === 1 ? '#22396e' : d.v === 1000 ? '#3a2a06' : hex(d.color === 0x1b1b1d ? 0x1b1b1d : d.color);
  g.fillText(label, cx, cy + S * 0.012);
  g.restore();
}

function drawSide(g, k, y0, H) {
  const d = DENOMS[k];
  const base = d ? hex(d.color) : '#f2f2f2';
  const spot = d ? hex(d.stripe) : '#ffffff';
  g.fillStyle = base;
  g.fillRect(0, y0, 1024, H);
  g.fillStyle = spot;
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * 1024 - 0.4 * 46;
    g.fillRect(x, y0, 46 * 0.8, H);
    if (i === 0) g.fillRect(1024 + x, y0, 46 * 0.8, H);
  }
  // Rounded edge shading top & bottom.
  const sh = g.createLinearGradient(0, y0, 0, y0 + H);
  sh.addColorStop(0, 'rgba(0,0,0,.28)');
  sh.addColorStop(0.18, 'rgba(0,0,0,0)');
  sh.addColorStop(0.82, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = sh;
  g.fillRect(0, y0, 1024, H);
}

function grime(g, w, h) {
  // Handling wear: faint speckle so no chip reads as fresh plastic.
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalAlpha = 0.07;
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
    g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
  }
  g.globalAlpha = 1;
}

let chipTex = null;
function chipTexture() {
  if (chipTex) return chipTex;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const paint = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#888';
    g.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 8; k++) drawTop(g, k, (k % 4) * 256, Math.floor(k / 4) * 256, 256);
    for (let k = 0; k < 8; k++) drawSide(g, k, 512 + k * 48, 48);
    grime(g, 1024, 1024);
  };
  paint();
  chipTex = new THREE.CanvasTexture(c);
  chipTex.colorSpace = THREE.SRGBColorSpace;
  chipTex.anisotropy = 8;
  chipTex.canvas = c;
  if (document.fonts?.load) {
    document.fonts.load('700 20px "Playfair Display"').then(() => {
      paint();
      chipTex.needsUpdate = true;
    }).catch(() => {});
  }
  return chipTex;
}

// ---- geometry ----------------------------------------------------------------------------------

function chipGeometry(seg = 28) {
  const pos = [];
  const nor = [];
  const uv = [];
  const part = [];
  const idx = [];
  const b = 0.00045; // edge round-over
  const push = (x, y, z, nx, ny, nz, u, v, p) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(u, v);
    part.push(p);
    return pos.length / 3 - 1;
  };
  // Faces: centre fan.
  for (const [y, ny, p] of [[T, 1, 0], [0, -1, 1]]) {
    const c = push(0, y, 0, 0, ny, 0, 0.5, 0.5, p);
    const ring = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.cos(a) * (R - b);
      const z = Math.sin(a) * (R - b);
      ring.push(push(x, y, z, 0, ny, 0, 0.5 + (x / R) * 0.5, 0.5 - (z / R) * 0.5 * ny, p));
    }
    for (let i = 0; i < seg; i++) {
      if (ny > 0) idx.push(c, ring[i + 1], ring[i]);
      else idx.push(c, ring[i], ring[i + 1]);
    }
  }
  // Side band with rounded rims: profile rows (radius, y, normal y).
  const prof = [
    [R - b, T, 0.7],
    [R, T - b, 0.0],
    [R, b, 0.0],
    [R - b, 0, -0.7],
  ];
  const rows = prof.map(([r, y, nyy]) => {
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const l = Math.hypot(1, nyy);
      row.push(push(nx * r, y, nz * r, nx / l, nyy / l, nz / l, i / seg, y / T, 2));
    }
    return row;
  });
  for (let k = 0; k < rows.length - 1; k++) {
    for (let i = 0; i < seg; i++) {
      const a = rows[k][i];
      const bb = rows[k][i + 1];
      const c = rows[k + 1][i + 1];
      const d = rows[k + 1][i];
      idx.push(a, bb, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  // Orient side triangles outward.
  const P = g.attributes.position.array;
  const N = g.attributes.normal.array;
  const I = g.index.array;
  for (let t = 0; t < I.length; t += 3) {
    const [a, bq, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    const ux = P[bq] - P[a], uy = P[bq + 1] - P[a + 1], uz = P[bq + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const nx = N[a] + N[bq] + N[c], ny = N[a + 1] + N[bq + 1] + N[c + 1], nz = N[a + 2] + N[bq + 2] + N[c + 2];
    if (gx * nx + gy * ny + gz * nz < 0) {
      const tmp = I[t + 1];
      I[t + 1] = I[t + 2];
      I[t + 2] = tmp;
    }
  }
  return g;
}

function chipMaterial() {
  const tex = chipTexture();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uChipTex = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aKind;
        attribute float aPart;
        varying vec2 vChipUv;
        varying float vPart;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        if (aPart < 1.5) {
          float col = mod(aKind, 4.0);
          float row = floor(aKind / 4.0 + 0.001);
          vChipUv = vec2((col + uv.x) * 0.25, 1.0 - (row + 1.0 - uv.y) * 0.25);
        } else {
          vChipUv = vec2(uv.x, 1.0 - (512.0 + aKind * 48.0 + (1.0 - uv.y) * 47.0 + 0.5) / 1024.0);
        }
        vPart = aPart;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uChipTex;
        varying vec2 vChipUv;
        varying float vPart;`)
      .replace('#include <map_fragment>', `diffuseColor *= texture2D(uChipTex, vChipUv);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = vPart < 1.5 ? 0.42 : 0.55;`);
  };
  m.customProgramCacheKey = () => 'gamble-chip-v1';
  return m;
}

// ---- instanced chips ---------------------------------------------------------------------------

const _m = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _white = new THREE.Color(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);

class Chip {
  constructor(set, id) {
    this.set = set;
    this.id = id;
    this.kind = 0;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.alive = false;
  }

  setYaw(a) {
    this.quat.setFromAxisAngle(Y, a);
    return this;
  }

  commit() {
    if (!this.alive) return;
    this.set.mesh.setMatrixAt(this.id, _m.compose(this.pos, this.quat, _one));
    this.set.mesh.instanceMatrix.needsUpdate = true;
  }

  get value() {
    return valueOfKind(this.kind);
  }
}

export class ChipMeshes {
  constructor({ capacity = 600, seg = 28 } = {}) {
    const geo = chipGeometry(seg);
    this.kindAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geo.setAttribute('aKind', this.kindAttr);
    this.mesh = new THREE.InstancedMesh(geo, chipMaterial(), capacity);
    this.mesh.name = 'chips';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 3.2);
    this.chips = [];
    this.freeIds = [];
    for (let i = capacity - 1; i >= 0; i--) {
      this.mesh.setMatrixAt(i, _zero);
      this.mesh.setColorAt(i, _white);
      this.freeIds.push(i);
      this.chips[i] = new Chip(this, i);
    }
    this.capacity = capacity;
  }

  spawn(kind, pos, yaw = Math.random() * Math.PI * 2, tint = null) {
    const id = this.freeIds.pop();
    if (id === undefined) return null;
    const c = this.chips[id];
    c.alive = true;
    c.kind = kind;
    this.kindAttr.setX(id, kind);
    this.kindAttr.needsUpdate = true;
    this.mesh.setColorAt(id, tint || _white);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    c.pos.copy(pos);
    c.setYaw(yaw);
    c.commit();
    return c;
  }

  free(c) {
    if (!c || !c.alive) return;
    c.alive = false;
    this.mesh.setMatrixAt(c.id, _zero);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.freeIds.push(c.id);
  }

  get used() {
    return this.capacity - this.freeIds.length;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}

// ---- piles -------------------------------------------------------------------------------------

let pileSeed = 1;
const prand = () => {
  pileSeed = (pileSeed * 16807) % 2147483647;
  return pileSeed / 2147483647;
};

/** A stack of chips at (x, z) on a surface at height y (table space). */
export class Pile {
  constructor(set, x, z, y, { tint = null, neat = 1 } = {}) {
    this.set = set;
    this.base = new THREE.Vector3(x, y, z);
    this.chips = [];
    this.tint = tint;
    this.neat = neat; // 1 = dealer-neat, 2 = player-messy
  }

  get height() {
    return this.chips.length * T;
  }

  get value() {
    let v = 0;
    for (const c of this.chips) v += c.value;
    return Math.round(v * 100) / 100;
  }

  /** Where the next chip lands (for animations). */
  slot(i = this.chips.length, out = new THREE.Vector3()) {
    const j = this.neat * 0.00055;
    // Deterministic per-level jitter so the stack doesn't shimmer when re-laid out.
    const a = Math.sin(i * 12.9898 + this.base.x * 78.2) * 43758.5453;
    const b = Math.sin(i * 39.346 + this.base.z * 11.13) * 24634.6345;
    return out.set(this.base.x + (a - Math.floor(a) - 0.5) * 2 * j, this.base.y + i * T, this.base.z + (b - Math.floor(b) - 0.5) * 2 * j);
  }

  /** Add a new chip of `kind` on top (instantly). */
  push(kind, tint = this.tint) {
    const p = this.slot();
    const c = this.set.spawn(kind, p, prand() * Math.PI * 2, tint);
    if (c) this.chips.push(c);
    return c;
  }

  /** Put an existing (animated) chip on top. */
  adopt(c) {
    this.slot(this.chips.length, c.pos);
    c.commit();
    this.chips.push(c);
    return c;
  }

  pop() {
    return this.chips.pop() || null;
  }

  /** Move the whole pile (re-lays every chip). */
  moveTo(x, z, y = this.base.y) {
    this.base.set(x, y, z);
    this.relayout();
  }

  relayout() {
    this.chips.forEach((c, i) => {
      this.slot(i, c.pos);
      c.commit();
    });
  }

  clear() {
    for (const c of this.chips) this.set.free(c);
    this.chips = [];
  }

  /** Sort so big chips sit at the bottom (how dealers and players build stacks). */
  sortBig() {
    this.chips.sort((a, b) => b.value - a.value);
    this.relayout();
  }

  counts() {
    const o = {};
    for (const c of this.chips) if (c.kind !== WHEEL_KIND) o[c.value] = (o[c.value] || 0) + 1;
    return o;
  }
}

/** The chip texture canvas (dev preview). */
export function chipCanvas() {
  return chipTexture().canvas;
}
