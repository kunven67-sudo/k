// The Starlite's roadside pole sign at (196, -14): a 9 m teal pipe pole carrying a Googie
// parallelogram cabinet — hot-pink neon "STARLITE" over cyan "MOTEL", yellow neon stars — a
// twinkling bulb starburst on top and a VACANCY box below (the "NO" tube died years ago).
//
// At night the R of STARLITE and the T of MOTEL are burnt out: their tubes sit on their own
// flicker channel that is dead most of the time and stutters back to life now and then, so the
// sign reads "STA LITE MO EL" with a buzz.
import * as THREE from 'three';
import { neonSign, BulbSet } from '../shared/signs.js';
import { propMats } from '../shared/props.js';
import { SIGN, Y0 } from './layout.js';
import { motelMats, PAL, plaqueMat } from './mats.js';
import { t } from '../../core/i18n.js';

const FONT = (px) => `400 ${px}px "Bebas Neue", "Arial Narrow", sans-serif`;

export async function buildSign(ctx) {
  const { batch, colliders, lights } = ctx;
  const M = motelMats();
  const PM = propMats();
  try {
    await document.fonts.load(FONT(200));
  } catch {
    // Fallback font metrics are fine.
  }
  const x = SIGN.x;
  const z = SIGN.z;
  const H = SIGN.h;
  // The sign faces the street both ways (east- and westbound traffic): rotate so faces point ±X?
  // No — 4th St runs along X, so the cabinet stands perpendicular to the street (faces ±X) and is
  // read by drivers coming from either direction.
  const ry = Math.PI / 2;
  const mtx = new THREE.Matrix4().makeRotationY(ry).setPosition(x, Y0, z);

  // ---- Pole + footing ----------------------------------------------------------------------------
  batch.add(new THREE.CylinderGeometry(0.17, 0.2, H, 16).translate(0, H / 2, 0), M.metal, { matrix: mtx, tint: PAL.trim, grime: 0.6, grimeBase: Y0 });
  batch.add(new THREE.CylinderGeometry(0.45, 0.5, 0.5, 16).translate(0, 0.25, 0), M.concrete, { matrix: mtx });
  colliders.cylinder(x, Y0, z, 0.22, H);
  colliders.cylinder(x, Y0, z, 0.5, 0.5);
  // Bollards painted yellow so cars stop hitting the pole (one already got bent).
  for (const [bx, bz, lean] of [[-0.9, 0.6, 0], [0.9, -0.6, 0.12]]) {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 12).translate(0, 0.5, 0).rotateZ(lean).translate(bx, 0, bz);
    batch.add(g, M.metal, { matrix: mtx, tint: 0xd9b13a, grime: 0.7, grimeBase: Y0 });
    const p = new THREE.Vector3(bx, 0, bz).applyMatrix4(mtx);
    colliders.cylinder(p.x, Y0, p.z, 0.11, 1.0);
  }

  // ---- Main cabinet: slanted parallelogram, 5 m × 2.4 m, 0.5 m deep -----------------------------
  const CW = 5.0;
  const CH = 2.5;
  const slant = 0.55;
  const cy = H - 2.2; // cabinet centre height
  const shape = new THREE.Shape();
  shape.moveTo(-CW / 2, -CH / 2);
  shape.lineTo(CW / 2 - slant, -CH / 2);
  shape.lineTo(CW / 2, CH / 2);
  shape.lineTo(-CW / 2 + slant, CH / 2);
  shape.closePath();
  const cab = new THREE.ExtrudeGeometry(shape, { depth: 0.46, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  cab.translate(0, cy, -0.23);
  batch.add(cab, M.metal, { matrix: mtx, tint: 0x1d4f4d });
  // Painted face: dark teal with a cream border band, shared by both sides (lit by the neon).
  const face = plaqueMat('pole-face', 512, 256, (g, w, h) => {
    g.fillStyle = '#123a39';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#efe3c8';
    g.lineWidth = 14;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.strokeRect(22, 22, w - 44, h - 44);
  });
  for (const s of [1, -1]) {
    const g = new THREE.ShapeGeometry(shape);
    // ShapeGeometry UVs are in shape units; normalise to 0..1 over the bounding box.
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + CW / 2) / CW, (uv.getY(i) + CH / 2) / CH);
    if (s < 0) g.rotateY(Math.PI);
    g.translate(0, cy, s * 0.275);
    batch.add(g, face, { matrix: mtx, uv: 'keep', castShadow: false });
  }
  // Neon (per-letter placement so the dead letters can sit on their own channel).
  const W = 1024;
  const Hc = 512;
  const lines = [];
  const placeWord = (word, size, y, color, cx, deadIdx) => {
    const g = document.createElement('canvas').getContext('2d');
    g.font = FONT(size);
    const track = size * 0.06;
    const widths = [...word].map((c) => g.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + track * (word.length - 1);
    let xx = cx - total / 2;
    [...word].forEach((c, i) => {
      lines.push({ text: c, font: FONT(size), size, color, y, x: xx, align: 'left', channel: i === deadIdx ? 1 : 0 });
      xx += widths[i] + track;
    });
  };
  placeWord('STARLITE', 250, 190, '#ff3f9e', W / 2 + 28, 3);
  placeWord('MOTEL', 150, 400, '#4fe3ff', W / 2 - 40, 2);
  for (const [sx, sy, ss] of [[118, 92, 90], [930, 300, 70], [895, 420, 54], [70, 410, 60]]) {
    lines.push({ text: '★', font: `400 ${ss}px "DejaVu Sans", sans-serif`, size: ss, color: '#ffe27a', y: sy, x: sx, channel: 3 });
  }
  const neonW = CW - 0.35;
  for (const s of [1, -1]) {
    const n = neonSign('starlite-main', lines, { w: W, h: Hc, worldW: neonW, backer: null, flicker: { broken: [1], deadMostly: true }, intensity: 3.2 });
    n.group.applyMatrix4(new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeRotationY(s < 0 ? Math.PI : 0).setPosition(0, cy, s * 0.29)));
    ctx.extraMeshes.push(n.group);
  }

  // ---- VACANCY box under the cabinet ------------------------------------------------------------
  const vy = cy - CH / 2 - 0.75;
  batch.add(new THREE.BoxGeometry(2.6, 0.75, 0.3).translate(-0.6, vy, 0), M.metal, { matrix: mtx, tint: 0x1a1a1a });
  batch.add(new THREE.BoxGeometry(0.08, 0.5, 0.08).translate(-1.4, vy + 0.6, 0), M.metal, { matrix: mtx, tint: PAL.trim });
  batch.add(new THREE.BoxGeometry(0.08, 0.5, 0.08).translate(0.2, vy + 0.6, 0), M.metal, { matrix: mtx, tint: PAL.trim });
  const vac = [
    { text: t('motel.vacancy'), font: FONT(150), size: 150, color: '#ff3a2e', y: 132, x: 640, channel: 0 },
  ];
  // The dead "NO" tube: painted glass only (drawn on the backer), never lit.
  const noBacker = plaqueMat('no-backer', 512, 128, (g, w, h) => {
    g.fillStyle = '#141212';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,70,60,0.75)';
    g.lineWidth = 7;
    g.font = FONT(108);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText(t('motel.no'), 64, h / 2 + 4);
  });
  for (const s of [1, -1]) {
    const n = neonSign('starlite-vacancy', vac, { w: 1024, h: 256, worldW: 2.45, backerMat: noBacker, flicker: {}, intensity: 4.5 });
    n.group.applyMatrix4(new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeRotationY(s < 0 ? Math.PI : 0).setPosition(-0.6, vy, s * 0.165)));
    ctx.extraMeshes.push(n.group);
  }

  // ---- Starburst on top: chrome spikes with bulb tips (twinkling) --------------------------------
  const top = new THREE.Vector3(1.3, cy + CH / 2 + 0.75, 0);
  batch.add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8).translate(top.x, top.y - 0.4, 0), M.metal, { matrix: mtx, tint: PAL.trim });
  batch.add(new THREE.SphereGeometry(0.16, 16, 12).translate(top.x, top.y, 0), PM.lampWarm, { matrix: mtx, castShadow: false });
  const bulbs = new BulbSet({ radius: 0.055, pattern: 'twinkle', speed: 3, intensity: 4, dayIntensity: 0.1 });
  const spikes = 14;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const len = i % 2 ? 0.75 : 1.25;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const g = new THREE.CylinderGeometry(0.018, 0.03, len, 6).translate(0, len / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(a - Math.PI / 2)).translate(top.x, top.y, 0);
    batch.add(g, PM.steel, { matrix: mtx });
    bulbs.add(top.clone().addScaledVector(dir, len + 0.05).applyMatrix4(mtx), i, 0xfff0c0);
  }
  ctx.extraMeshes.push(bulbs.build('starlite-burst'));

  // Night light contribution (pink spill on the lot, the office and through the room curtains).
  const center = new THREE.Vector3(0, cy, 0).applyMatrix4(mtx);
  lights.push({ pos: center.clone().add(new THREE.Vector3(0, -1.5, 0)), color: 0xff4fa8, intensity: 18, distance: 22, kind: 'neon', width: CW * 0.8, groundY: Y0, flicker: true, realLight: true });
  ctx.signCenter = center;
}
