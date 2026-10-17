// The parts of a store you stop noticing until they're missing: the ceiling, the lights, the
// rubber base along the walls, and the big department letters up high.
//   Walmort  -> a white drop ceiling (2x2 ft tiles) with recessed 2x4 light panels
//   Best Bye + IKEO -> an open warehouse ceiling: steel girders + joists, a big silver air duct,
//                      red sprinkler pipe and long hanging LED strips
//
//   fitOut(B, root, def)   // called once per store from buildStore()

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/textures.js';
import { CURB } from './layout.js';

const H = 5.6;
const FY = CURB + 0.02;

let _tile = null;
function ceilingTileMat() {
  if (_tile) return _tile;
  // One 1.2 m texture = 2x2 tiles: fissured mineral fibre in a thin white T-bar grid.
  const tex = canvasTexture('ceiling-tile', 256, 256, (c, w, h) => {
    c.fillStyle = '#ecebe6';
    c.fillRect(0, 0, w, h);
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = `rgba(120,118,110,${0.08 + rnd() * 0.18})`;
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1);
    }
    c.fillStyle = '#d6d5d0';
    for (const k of [0, w / 2]) {
      c.fillRect(k, 0, 3, h);
      c.fillRect(0, k, w, 3);
    }
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (const k of [3, w / 2 + 3]) {
      c.fillRect(k, 0, 2, h);
      c.fillRect(0, k, w, 2);
    }
  }, { repeat: true });
  _tile = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  _tile.userData.tileMeters = 1.2;
  return _tile;
}

let _troffer = null;
function trofferMat() {
  if (_troffer) return _troffer;
  // Prismatic diffuser: bright centre, a hint of the lamp tubes, darker metal rim.
  const tex = canvasTexture('troffer', 128, 64, (c, w, h) => {
    c.fillStyle = '#9a9a96';
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 4, 0, h - 4);
    g.addColorStop(0, '#f2f4f6');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(1, '#f2f4f6');
    c.fillStyle = g;
    c.fillRect(4, 4, w - 8, h - 8);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (const y of [h * 0.32, h * 0.68]) c.fillRect(8, y - 2, w - 16, 4);
  });
  _troffer = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.5, roughness: 1 });
  return _troffer;
}

function wallLetters(root, text, x, y, z, yaw, { color = '#1a5fb4', height = 0.7 } = {}) {
  const font = 'bold 120px Inter, Arial, sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const tw = Math.ceil(probe.measureText(text).width) + 40;
  const tex = canvasTexture(`wall-letters-${text}-${color}`, tw, 160, (c, w, h) => {
    c.font = font;
    c.textBaseline = 'middle';
    // A soft shadow under the letters reads as mounted 3D lettering, not a sticker.
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillText(text, 26, h / 2 + 8);
    c.fillStyle = color;
    c.fillText(text, 20, h / 2 + 2);
  });
  const w = (height * tw) / 160;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  root.add(m);
}

export function fitOut(B, root, def) {
  const { x0, x1, z0, z1 } = def;
  const zc = (z0 + z1) / 2;
  const iz0 = z0 + 0.15;
  const iz1 = z1 - 0.15;
  const ix0 = x0 + 0.15;
  const ix1 = x1 - 0.15;

  // Rubber cove base along every inside wall (not across the glass front).
  const base = mat('rubber', { color: def.id === 'electronics' ? 0x18191c : 0x3b3d40 });
  B.box((ix0 + ix1) / 2, FY + 0.05, iz0 + 0.01, ix1 - ix0, 0.1, 0.02, base, { collide: false, shadow: false });
  B.box((ix0 + ix1) / 2, FY + 0.05, iz1 - 0.01, ix1 - ix0, 0.1, 0.02, base, { collide: false, shadow: false });
  B.box(ix1 - 0.01, FY + 0.05, zc, 0.02, 0.1, iz1 - iz0, base, { collide: false, shadow: false });

  if (def.id === 'grocery') {
    // Drop ceiling + recessed 2x4 troffers snapped to the tile grid.
    B.slab(ix0, iz0, ix1, iz1, H - 0.3, null, { thick: 0.05, under: ceilingTileMat(), collide: false });
    const snap = (v, off) => Math.round((v - off) / 0.6) * 0.6 + off;
    for (let x = x0 + 3; x < x1 - 2; x += 3.6)
      for (let z = z0 + 3; z < z1 - 2; z += 3.6) B.box(snap(x, 0), H - 0.355, snap(z, 0.3), 1.18, 0.01, 0.58, trofferMat(), { collide: false, shadow: false });
    wallLetters(root, 'DAIRY & FROZEN', ix1 - 0.02, FY + 3.4, zc, -Math.PI / 2);
    wallLetters(root, 'FRESH BAKERY', x0 + 6, FY + 3.0, iz1 - 0.02, Math.PI, { color: '#b5651d' });
    wallLetters(root, 'DRINKS', (x0 + 12 + x1 - 6) / 2, FY + 3.2, iz0 + 0.02, 0);
    return;
  }

  // Open ceiling: everything up there painted one dark colour, like a real big-box store.
  const deck = mat('metal-painted', { color: def.id === 'electronics' ? 0x15161a : 0x33363b, wear: 0.05, dirt: 0.2 });
  B.slab(ix0, iz0, ix1, iz1, H - 0.05, null, { thick: 0.05, under: deck, collide: false });
  const steel = mat('metal-painted', { color: def.id === 'electronics' ? 0x202227 : 0x44474d, wear: 0.1, dirt: 0.2 });
  // Two I-beam girders along x, joists across them every 1.5 m.
  for (const gz of [z0 + (z1 - z0) / 3, z0 + (2 * (z1 - z0)) / 3]) {
    B.box((ix0 + ix1) / 2, H - 0.12, gz, ix1 - ix0, 0.03, 0.2, steel, { collide: false, shadow: false });
    B.box((ix0 + ix1) / 2, H - 0.32, gz, ix1 - ix0, 0.4, 0.02, steel, { collide: false, shadow: false });
    B.box((ix0 + ix1) / 2, H - 0.52, gz, ix1 - ix0, 0.03, 0.2, steel, { collide: false, shadow: false });
  }
  for (let x = x0 + 1.5; x < x1 - 0.5; x += 1.5) {
    B.box(x, H - 0.1, zc, 0.04, 0.03, iz1 - iz0, steel, { collide: false, shadow: false });
    B.box(x, H - 0.25, zc, 0.04, 0.03, iz1 - iz0, steel, { collide: false, shadow: false });
  }
  // Big round supply duct + hangers, red sprinkler main beside it.
  const len = ix1 - ix0 - 0.6;
  const dz = zc + 2.2;
  const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, len, 20, 1, true), mat('aluminum', { wear: 0.1, dirt: 0.15 }));
  duct.rotation.z = Math.PI / 2;
  duct.position.set((ix0 + ix1) / 2, H - 1.0, dz);
  root.add(duct);
  for (let x = ix0 + 1.2; x < ix1 - 1; x += 2.4) B.box(x, H - 0.33, dz, 0.015, 0.57, 0.015, steel, { collide: false, shadow: false });
  const red = mat('metal-painted', { color: 0xa3201c, wear: 0.1 });
  B.box((ix0 + ix1) / 2, H - 0.7, dz - 1.2, ix1 - ix0, 0.07, 0.07, red, { collide: false, shadow: false });
  // Long LED strip fixtures hanging on cables.
  const housing = mat('metal-painted', { color: 0xdedfe0, wear: 0.05 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.7, roughness: 1 });
  for (let x = x0 + 2.5; x < x1 - 3; x += 3.2)
    for (let z = z0 + 2.5; z < z1 - 2; z += 4) {
      B.box(x, H - 1.5, z, 2.4, 0.06, 0.16, housing, { collide: false, shadow: false });
      B.box(x, H - 1.535, z, 2.3, 0.01, 0.1, lens, { collide: false, shadow: false });
      for (const s of [-1, 1]) B.box(x + s * 1.0, H - 0.9, z, 0.01, 1.15, 0.01, steel, { collide: false, shadow: false });
    }
  if (def.id === 'electronics') {
    wallLetters(root, 'TV & HOME THEATER', ix1 - 0.02, FY + 3.6, zc, -Math.PI / 2, { color: '#ffe000' });
    wallLetters(root, 'TECH HELP', x0 + 3, FY + 2.6, iz1 - 0.02, Math.PI, { color: '#ffffff', height: 0.45 });
  } else {
    wallLetters(root, 'SELF SERVE', ix1 - 0.02, FY + 4.3, zc, -Math.PI / 2, { color: '#ffda1a' });
  }
}
