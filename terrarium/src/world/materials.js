// Shared materials + textures drawn in code (no image files).
import * as THREE from 'three';
import { canvasTex, makeRng, makeNoise } from '../core/util.js';

const cache = new Map();

function speckle(g, w, h, base, vary, count, r = 1, seed = 1) {
  const rr = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = (rr() - 0.5) * vary;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(rr() * w, rr() * h, r * (0.5 + rr()), r * (0.5 + rr()));
  }
}

export const TEX = {};

export function makeTextures() {
  if (TEX.concrete) return TEX;
  TEX.concrete = canvasTex(512, 512, (g, w, h) => {
    speckle(g, w, h, '#77797b', 0.18, 9000, 2, 3);
    const n = makeNoise(11);
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (n.fbm(x / 90, y / 90, 4) * 26) | 0;
      const i = (y * w + x) * 4;
      img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(30,30,30,0.35)'; g.lineWidth = 1.2;
    const r = makeRng(9);
    for (let c = 0; c < 6; c++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let i = 0; i < 12; i++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(20,20,20,0.5)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  });
  TEX.block = canvasTex(512, 512, (g, w, h) => {
    speckle(g, w, h, '#8a8d8a', 0.12, 6000, 2, 5);
    g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 4;
    for (let row = 0; row < 8; row++) {
      const y = row * 64;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let c = 0; c < 4; c++) { const x = c * 128 + (row % 2) * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
    }
  });
  TEX.wood = canvasTex(512, 512, (g, w, h) => {
    const r = makeRng(21);
    for (let p = 0; p < 8; p++) {
      const y = p * 64;
      const base = 120 + r() * 30;
      g.fillStyle = `rgb(${base},${base * 0.66 | 0},${base * 0.4 | 0})`; g.fillRect(0, y, w, 64);
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(60,30,10,${0.08 + r() * 0.15})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const yy = y + r() * 64; g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + (r() - 0.5) * 12, w * 0.6, yy + (r() - 0.5) * 12, w, yy); g.stroke(); }
      g.fillStyle = 'rgba(30,15,5,0.6)'; g.fillRect(0, y, w, 2);
      g.fillRect((r() * w) | 0, y, 2, 64);
    }
  });
  TEX.metal = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f969c'; g.fillRect(0, 0, w, h);
    const r = makeRng(4);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},255,${0.03 + r() * 0.05})`; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 3); g.stroke(); }
  });
  TEX.tile = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#dcd8cf'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9b958a'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  });
  TEX.brick = canvasTex(512, 512, (g, w, h) => {
    const r = makeRng(31);
    g.fillStyle = '#7a7470'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 16; row++) for (let c = 0; c < 5; c++) {
      const x = c * 110 + (row % 2) * 55 - 20, y = row * 32;
      const k = 130 + r() * 50;
      g.fillStyle = `rgb(${k},${k * 0.45 | 0},${k * 0.35 | 0})`;
      g.fillRect(x + 3, y + 3, 104, 26);
    }
  });
  TEX.asphalt = canvasTex(512, 512, (g, w, h) => { speckle(g, w, h, '#36383b', 0.25, 16000, 2, 41); });
  TEX.sidewalk = canvasTex(256, 256, (g, w, h) => {
    speckle(g, w, h, '#a5a39d', 0.15, 5000, 2, 51);
    g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
  });
  TEX.lawn = canvasTex(512, 512, (g, w, h) => {
    const r = makeRng(61);
    g.fillStyle = '#4f7a35'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) { const k = r(); g.fillStyle = `rgba(${40 + k * 60 | 0},${90 + k * 70 | 0},${25 + k * 30 | 0},0.6)`; g.fillRect(r() * w, r() * h, 1, 3 + r() * 4); }
  });
  TEX.carpet = canvasTex(256, 256, (g, w, h) => { speckle(g, w, h, '#5b4a3c', 0.2, 9000, 1.5, 71); });
  TEX.wallpaper = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9bfa8'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(150,130,100,0.25)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h);
  });
  TEX.siding = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b8c4c9'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 21) g.fillRect(0, y, w, 3);
  });
  return TEX;
}

export function texRepeat(name, rx, ry = rx) {
  const key = `${name}:${rx}:${ry}`;
  if (cache.has('t' + key)) return cache.get('t' + key);
  const t = TEX[name].clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  cache.set('t' + key, t);
  return t;
}

export function mat(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export const std = (color, rough = 0.7, metal = 0, extra = {}) =>
  mat(`std:${color}:${rough}:${metal}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));

export const glow = (color, intensity = 1.5) =>
  mat(`glow:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.5 }));

export const glassMat = () => mat('glass', () => new THREE.MeshPhysicalMaterial({
  color: 0xdff4ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  clearcoat: 1, clearcoatRoughness: 0.05,
}));

export function texMat(name, rx, ry, color = 0xffffff, rough = 0.85, metal = 0) {
  return mat(`tex:${name}:${rx}:${ry}:${color}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ map: texRepeat(name, rx, ry), color, roughness: rough, metalness: metal }));
}

// Rounded box geometry (toy-like edges everywhere).
export function roundedBox(w, h, d, r = 0.02, seg = 2) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const p = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const cx = Math.max(-hw, Math.min(hw, v.x)), cy = Math.max(-hh, Math.min(hh, v.y)), cz = Math.max(-hd, Math.min(hd, v.z));
    const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
    const l = Math.hypot(dx, dy, dz) || 1;
    if (l > 1e-6) p.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
  }
  g.computeVertexNormals();
  return g;
}

const geoCache = new Map();
export function sharedGeo(key, make) {
  if (!geoCache.has(key)) { const g = make(); g.userData.shared = true; geoCache.set(key, g); }
  return geoCache.get(key);
}
