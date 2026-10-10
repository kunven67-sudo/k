// Casino dice: rounded cube, translucent-looking ruby body, engraved white pips. One shared
// material: all six faces live in one atlas texture (+ a matching bump map for the engraving).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from '../../gfx/textures.js';

// BoxGeometry face order: +x, -x, +y, -y, +z, -z. Opposite faces sum to 7.
export const FACE_VALUES = [3, 4, 6, 1, 2, 5];
export const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

// Pip layouts in a 3x3 grid (0..8).
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function drawAtlas(g, W, H, bump) {
  const S = H;
  for (let f = 0; f < 6; f++) {
    const x0 = f * S;
    if (bump) {
      g.fillStyle = '#fff';
      g.fillRect(x0, 0, S, S);
    } else {
      // Ruby body: deeper toward the edges, a warm glow in the middle (fake subsurface).
      const gr = g.createRadialGradient(x0 + S * 0.45, S * 0.42, S * 0.05, x0 + S / 2, S / 2, S * 0.75);
      gr.addColorStop(0, '#b8101f');
      gr.addColorStop(0.55, '#7d0713');
      gr.addColorStop(1, '#3d0309');
      g.fillStyle = gr;
      g.fillRect(x0, 0, S, S);
      // Faint casino serial etched on the 1-face... and tiny scratches everywhere.
      g.strokeStyle = 'rgba(255,220,220,0.05)';
      g.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const x = x0 + Math.random() * S;
        const y = Math.random() * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
        g.stroke();
      }
    }
    const v = FACE_VALUES[f];
    const r = v === 1 ? S * 0.12 : S * 0.085;
    for (const p of PIPS[v]) {
      const cx = x0 + S * (0.24 + (p % 3) * 0.26);
      const cy = S * (0.24 + Math.floor(p / 3) * 0.26);
      if (bump) {
        const gr = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.05);
        gr.addColorStop(0, '#000');
        gr.addColorStop(0.8, '#444');
        gr.addColorStop(1, '#fff');
        g.fillStyle = gr;
      } else {
        const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
        gr.addColorStop(0, '#d9d2c4');
        gr.addColorStop(0.7, '#fbf8f0');
        gr.addColorStop(1, '#8c7f72');
        g.fillStyle = gr;
      }
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
}

let shared = null;
export function diceAssets() {
  if (shared) return shared;
  const S = 256;
  const map = canvasTexture('ui-dice-atlas', S * 6, S, (g, w, h) => drawAtlas(g, w, h, false));
  const bump = canvasTexture('ui-dice-bump', S * 6, S, (g, w, h) => drawAtlas(g, w, h, true), { srgb: false });
  const material = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 2.2,
    roughness: 0.1,
    envMapIntensity: 1.6,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    emissive: new THREE.Color(0x1a0104),
    emissiveIntensity: 1,
    specularIntensity: 0.9,
  });
  shared = { material };
  return shared;
}

/** Rounded die geometry of edge `size`, UVs remapped into the 6-face atlas. */
export function diceGeometry(size = 1) {
  const geo = new RoundedBoxGeometry(size, size, size, 4, size * 0.12);
  const uv = geo.attributes.uv;
  for (const grp of geo.groups) {
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const idx = geo.index ? geo.index.getX(i) : i;
      // Each vertex belongs to exactly one face group; remap once.
      if (uv.__done?.[idx]) continue;
      (uv.__done ||= [])[idx] = true;
      uv.setX(idx, (uv.getX(idx) + grp.materialIndex) / 6);
    }
  }
  delete uv.__done;
  geo.clearGroups();
  return geo;
}

/** Which face index points up for a world quaternion. */
export function topFace(q) {
  let best = 0;
  let bestY = -2;
  const v = new THREE.Vector3();
  FACE_NORMALS.forEach((n, i) => {
    const y = v.copy(n).applyQuaternion(q).y;
    if (y > bestY) {
      bestY = y;
      best = i;
    }
  });
  return { face: best, value: FACE_VALUES[best], flatness: bestY };
}
