// Starlite Motel material set. Few materials, shared everywhere: walls/trim/metal reuse the city's
// tintable building materials (one material, many colours via vertex tint in the StaticBatch), and
// the handful of motel-specific surfaces (breeze block, number plates, stall paint) live here.
import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { buildingMats } from '../shared/buildings.js';
import { propMats } from '../shared/props.js';
import { paintedSignMat, weatherCanvas } from '../shared/signs.js';
import { Rng } from '../../core/rng.js';
import './kinds.js';

// Palette: a 1961 motel repainted on a budget in 1994 and left alone since.
export const PAL = {
  wall: 0xecd6b6, // sun-bleached peach stucco
  wallShade: 0xd9c19f,
  trim: 0x2a7b78, // faded teal
  trimDark: 0x1f5653,
  doors: [0xb8553b, 0xd09a3a, 0x2a7b78], // coral / mustard / teal, cycling
  rail: 0xe7e2d6,
  railRust: 0x6c5a48,
  breeze: 0xf0e6d2,
  roofFascia: 0x6a4a36,
  office: 0xf2e2c8,
};

let MM = null;
export function motelMats() {
  if (MM) return MM;
  const BM = buildingMats();
  const PM = propMats();
  MM = {
    stucco: BM.stucco, // white base → tinted per piece
    trim: BM.trim,
    metal: BM.metal,
    concrete: BM.concrete,
    roof: BM.roof,
    doorMetal: mat('metal-painted', { color: 0xffffff, wear: 0.3, dirt: 0.55, seed: 811 }),
    asphalt: mat('lot-asphalt', { seed: 812 }),
    poolPlaster: mat('pool-plaster', { seed: 814 }),
    plaster: mat('concrete', { color: 0xe8e4da, wear: 0.7, dirt: 0.75, seed: 813, tileMeters: 2.5 }),
    galv: PM.galv,
    rubber: PM.rubber,
    black: PM.black,
    breeze: breezeMat(),
    stall: stallMat(),
    numbers: numberAtlas().material,
  };
  return MM;
}

// ---- Breeze block -------------------------------------------------------------------------------
// The classic mid-century "Fleur" screen block: cast concrete with a pierced quatrefoil pattern.
// Alpha-tested so sun and neon actually come through the holes and cast patterned shadows.
function breezeMat() {
  const tex = canvasTexture('motel-breeze', 256, 256, (g, w, h) => {
    const r = new Rng('breeze');
    g.fillStyle = '#e9dfca';
    g.fillRect(0, 0, w, h);
    // Concrete speckle + grime runs.
    for (let i = 0; i < 2200; i++) {
      const v = 190 + r.int(-40, 30);
      g.fillStyle = `rgba(${v},${v - 6},${v - 18},${r.range(0.15, 0.45)})`;
      g.fillRect(r.range(0, w), r.range(0, h), r.range(1, 3), r.range(1, 3));
    }
    // Mortar joint border.
    g.strokeStyle = 'rgba(120,110,95,0.85)';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    // Pierced quatrefoil: four lobes + a centre diamond cut out (alpha 0).
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    const c = w / 2;
    const lob = (x, y, rx, ry) => {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };
    lob(c, 52, 34, 30);
    lob(c, h - 52, 34, 30);
    lob(52, c, 30, 34);
    lob(w - 52, c, 30, 34);
    // Corner quarter-holes (complete across neighbouring blocks).
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) lob(x, y, 30, 30);
    g.beginPath();
    g.moveTo(c, c - 26);
    g.lineTo(c + 26, c);
    g.lineTo(c, c + 26);
    g.lineTo(c - 26, c);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }, { repeat: true });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xffffff });
  m.name = 'breeze-block';
  m.userData.tileMeters = 0.4;
  return m;
}

// Worn white stall paint, decal-style (polygon offset so it never z-fights the asphalt).
function stallMat() {
  const tex = canvasTexture('motel-stall-paint', 64, 512, (g, w, h) => {
    const r = new Rng('stall');
    g.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      // Paint survives in patches: tyre paths scrubbed it off.
      const k = 0.35 + 0.65 * Math.abs(Math.sin(y * 0.021 + 1.3)) * r.range(0.6, 1);
      for (let x = 0; x < w; x += 2) {
        if (r.next() < k) {
          g.fillStyle = `rgba(232,228,214,${r.range(0.5, 0.95)})`;
          g.fillRect(x, y, 2, 2);
        }
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  m.name = 'motel-stall-paint';
  return m;
}

// ---- Room number plates ---------------------------------------------------------------------------
// One canvas atlas (8 × 4 cells) holds every door's number, so all 28 plates are one merged mesh
// and setRoomNumber() only redraws the canvas. Plates are brass digits on a dark oval.
let ATLAS = null;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
export function numberAtlas() {
  if (ATLAS) return ATLAS;
  const cw = 128;
  const ch = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cw * ATLAS_COLS;
  canvas.height = ch * ATLAS_ROWS;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.35 });
  material.name = 'motel-room-numbers';
  const draw = (nums) => {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    nums.forEach((n, i) => {
      const x = (i % ATLAS_COLS) * cw;
      const y = Math.floor(i / ATLAS_COLS) * ch;
      g.save();
      g.translate(x, y);
      // Plate: dark brown oval with a thin brass rim.
      g.fillStyle = '#5a4630';
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#2a1f17';
      g.beginPath();
      g.ellipse(cw / 2, ch / 2, cw / 2 - 4, ch / 2 - 4, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#b8924a';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#d9b25a';
      g.font = '400 46px "Bebas Neue", "Arial Narrow", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), cw / 2, ch / 2 + 3);
      // Tarnish: a darker streak where hands touch the door frame.
      g.fillStyle = 'rgba(40,30,20,0.25)';
      g.fillRect(0, ch * 0.7, cw, ch * 0.3);
      g.restore();
    });
    weatherCanvas(g, canvas.width, canvas.height, { seed: 55, grime: 0.35, fade: 0.15, rust: 0, scratches: 0.4 });
    tex.needsUpdate = true;
  };
  // UVs of cell i for a plane's default 0..1 UVs.
  const cellUV = (geo, i) => {
    const uv = geo.attributes.uv;
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, (col + uv.getX(k)) / ATLAS_COLS, 1 - (row + 1 - uv.getY(k)) / ATLAS_ROWS);
    }
    return geo;
  };
  ATLAS = { material, draw, cellUV, texture: tex };
  return ATLAS;
}

// Small painted signs (OUT OF ORDER, ICE, POOL CLOSED …) share one helper so they all weather alike.
export function plaqueMat(key, w, h, draw, opts = {}) {
  return paintedSignMat(`motel-${key}`, w, h, draw, { weather: { grime: 0.5, fade: 0.3, rust: 0.25, scratches: 0.35 }, ...opts });
}
