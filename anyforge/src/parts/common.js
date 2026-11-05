// Shared bits for part definitions: mesh helper, fixed detail materials, control choices.
import * as THREE from 'three';
import { partMaterial } from '../core/mats.js';

export function mk(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function grp(...kids) { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; }

// detail materials that do not follow the part's paint
export const M = {
  get rubber() { return partMaterial('rubber', '#3a3a3a'); },
  get tire() { return partMaterial('rubber', '#2a2a2a'); },
  get chrome() { return partMaterial('chrome'); },
  get iron() { return partMaterial('iron'); },
  get alu() { return partMaterial('alu'); },
  get dark() { return partMaterial('plastic', '#1d1f23'); },
  get red() { return partMaterial('plastic', '#c4271f'); },
  get yellow() { return partMaterial('plastic', '#e8b923'); },
  get fabric() { return partMaterial('fabric', '#3b3f46'); },
  get strap() { return partMaterial('fabric', '#202226'); }
};
export const lens = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.6 });

// what drives a part when someone sits in the build (or a Remote / Brain block takes control)
export const INPUTS = [
  ['auto', 'Auto'], ['drive', 'W / S'], ['steer', 'A / D'], ['lift', 'Space / C'], ['pitch', 'Up / Down'], ['roll', 'Q / E'],
  ['k1', 'Key 1'], ['k2', 'Key 2'], ['k3', 'Key 3'], ['k4', 'Key 4'], ['none', 'Nothing']
];
export const INPUT_NAMES = Object.fromEntries(INPUTS);
export const P = {
  input: (def = 'auto', options = INPUTS) => ({ k: 'input', label: 'Controlled by', type: 'choice', options, def }),
  on: (def = true) => ({ k: 'on', label: 'On', type: 'toggle', def }),
  invert: () => ({ k: 'invert', label: 'Reverse', type: 'toggle', def: false }),
  power: (def = 50) => ({ k: 'power', label: 'Power', type: 'slider', min: 5, max: 100, step: 5, def }),
  speed: (def = 50) => ({ k: 'speed', label: 'Speed', type: 'slider', min: 5, max: 100, step: 5, def }),
  range: (def = 15, max = 60) => ({ k: 'range', label: 'Reach (m)', type: 'slider', min: 2, max, step: 1, def }),
  color: (def) => ({ k: 'glow', label: 'Light color', type: 'swatch', def })
};

// a canvas label stuck on a part (timer digits, gate names, warning stickers)
export function labelTexture(text, { bg = '#1b1d21', fg = '#f2f2f2', w = 256, h = 128, font = 'bold 64px sans-serif', stripes = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (stripes) {
    g.save(); g.fillStyle = '#111';
    for (let x = -h; x < w + h; x += 36) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x + 18 - h, h); g.lineTo(x - h, h); g.fill(); }
    g.restore();
    g.fillStyle = bg; g.fillRect(10, h * 0.22, w - 20, h * 0.56);
  }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const UP = new THREE.Vector3(0, 1, 0);
