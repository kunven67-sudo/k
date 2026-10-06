// The Reno Arch — "THE BIGGEST LITTLE CITY IN THE WORLD" — spanning N Virginia St.
//
// Original design in the spirit of the real 1987 arch: two clad legs with bulb channels, a
// curved box-section arch outlined top and bottom with chasing marquee bulbs on both faces,
// curved slogan lettering in the band, and giant extruded R-E-N-O channel letters on a sign beam
// at the crown, each letter outlined with bulbs traced from the glyph contours. By day it is
// silver-white enamel, red letter faces and gold trim; at night the letters glow, the slogan
// lights up warm white and the bulbs chase — and every light source is registered with the night
// light manager so the arch spills colour onto the street and smears across wet asphalt.

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { textShapes, textGeometryParts, splitGroups } from '../shared/text3d.js';
import { BulbSet, SIGNS } from '../shared/signs.js';
import { glowMat, propMats } from '../shared/props.js';
import { ARCH_Z } from './layout.js';
import { t } from '../../core/i18n.js';

const LEG_X = 9.6;
const SPRING_Y = 8.6; // where the arch leaves the legs
const RISE = 3.0;
const BAND = 1.5; // radial depth of the curved band
const DEPTH = 0.9; // thickness front-to-back

export function buildArch(ctx) {
  const { batch, colliders, lights } = ctx;
  const z0 = ARCH_Z;
  const P = propMats();
  const M = {
    enamel: mat('metal-painted', { color: 0xe4e2dc, wear: 0.25, dirt: 0.35, seed: 81 }),
    trim: mat('gold', { wear: 0.35, dirt: 0.3, seed: 82 }),
    steel: mat('aluminum', { wear: 0.3, dirt: 0.35, seed: 83 }),
    base: mat('concrete', { color: 0x9c968c, seed: 84, dirt: 0.5 }),
    red: letterFaceMat(),
    slogan: sloganMat(),
  };

  // ---- Arch geometry (circle through both springing points with the given rise) ----
  const c = LEG_X * 2;
  const R = (c * c / 4 + RISE * RISE) / (2 * RISE);
  const cy = SPRING_Y + RISE - R;
  const a0 = Math.asin(LEG_X / R); // half-angle of the span
  const Rin = R - BAND;
  const arcPt = (r, ang) => new THREE.Vector2(Math.sin(ang) * r, cy + Math.cos(ang) * r);

  // Band: annular segment extruded through the depth. Slightly overshoot into the legs.
  const span = a0 + 0.03;
  const shape = new THREE.Shape();
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const p = arcPt(R, -span + (2 * span * i) / N);
    i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y);
  }
  for (let i = N; i >= 0; i--) {
    const p = arcPt(Rin, -span + (2 * span * i) / N);
    shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  const bandGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 1 });
  bandGeo.translate(0, 0, z0 - DEPTH / 2);
  batch.add(bandGeo, M.enamel, { chunk: 'landmark', castShadow: true });
  // Gold edge trims along the outer and inner arcs (both faces).
  for (const r of [R + 0.02, Rin - 0.02]) {
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const p = arcPt(r, -span + (2 * span * i) / N);
        pts.push(new THREE.Vector3(p.x, p.y, z0 + s * (DEPTH / 2 + 0.05)));
      }
      batch.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.06, 6, false), M.trim, { chunk: 'landmark' });
    }
  }
  // Recessed slogan panel (dark blue enamel) on both faces between the bulb rows.
  for (const s of [-1, 1]) {
    const ps = new THREE.Shape();
    const r1 = R - 0.32;
    const r0 = Rin + 0.32;
    const sp = a0 - 0.02;
    for (let i = 0; i <= N; i++) {
      const p = arcPt(r1, -sp + (2 * sp * i) / N);
      i === 0 ? ps.moveTo(p.x, p.y) : ps.lineTo(p.x, p.y);
    }
    for (let i = N; i >= 0; i--) {
      const p = arcPt(r0, -sp + (2 * sp * i) / N);
      ps.lineTo(p.x, p.y);
    }
    const pg = new THREE.ShapeGeometry(ps);
    if (s < 0) pg.rotateY(Math.PI); // the band is symmetric, so this just turns it to face north
    pg.translate(0, 0, z0 + s * (DEPTH / 2 + 0.045));
    batch.add(pg, panelMat(), { chunk: 'landmark', castShadow: false });
  }

  // ---- Slogan letters (3D, curved) on both faces ----
  const slogan = t('reno.arch.slogan');
  const rs = (R + Rin) / 2 - 0.36;
  const capH = 0.62;
  const { glyphs } = textShapes(slogan, { font: '"Bebas Neue"', height: capH, align: 'center', tracking: 0.08 });
  for (const s of [1, -1]) {
    for (const g of glyphs) {
      if (g.char === ' ') continue;
      const mid = (g.x0 + g.x1) / 2;
      // South face (s = 1) reads left→right from the south; the north face mirrors the order.
      const ang = (s > 0 ? mid : -mid) / rs;
      const parts = textGeometryParts(g.char, { font: '"Bebas Neue"', height: capH, depth: 0.06, align: 'center', tracking: 0 });
      const m = new THREE.Matrix4()
        .makeTranslation(Math.sin(ang) * rs, cy + Math.cos(ang) * rs, z0 + s * (DEPTH / 2 + 0.05))
        .multiply(new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI))
        .multiply(new THREE.Matrix4().makeRotationZ(s > 0 ? -ang : ang));
      batch.add(parts.face, M.slogan, { matrix: m, chunk: 'landmark', uv: 'keep', castShadow: false });
      batch.add(parts.side, M.trim, { matrix: m, chunk: 'landmark', uv: 0.5, castShadow: false });
    }
  }

  // ---- Legs ----
  for (const sx of [-1, 1]) {
    const x = sx * LEG_X;
    // Plinth with a granite-like cap.
    batch.add(new THREE.BoxGeometry(1.6, 1.0, 1.6).translate(x, 0.15 + 0.5, z0), M.base, { chunk: 'landmark', grime: 0.5, grimeBase: 0.15 });
    batch.add(new THREE.BoxGeometry(1.7, 0.12, 1.7).translate(x, 1.21, z0), M.trim, { chunk: 'landmark' });
    // Tapered clad column up into the arch.
    const col = new THREE.CylinderGeometry(0.48, 0.62, SPRING_Y + 1.2 - 1.27, 4, 1).rotateY(Math.PI / 4);
    col.translate(x, 1.27 + (SPRING_Y + 1.2 - 1.27) / 2, z0);
    batch.add(col, M.enamel, { chunk: 'landmark' });
    // Vertical gold ribs at the corners.
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const rib = new THREE.CylinderGeometry(0.04, 0.04, SPRING_Y - 1.3, 6);
      rib.translate(x + dx * 0.5, 1.27 + (SPRING_Y - 1.3) / 2, z0 + dz * 0.5);
      batch.add(rib, M.trim, { chunk: 'landmark' });
    }
    colliders.box(x, 0.15 + 0.6, z0, 1.7, 1.2, 1.7);
    colliders.box(x, 1.2 + (SPRING_Y - 1.2) / 2, z0, 1.2, SPRING_Y - 1.2, 1.2);
  }

  // ---- RENO letters on a sign beam at the crown ----
  const crownY = cy + R;
  const beamY = crownY + 0.1;
  batch.add(new THREE.BoxGeometry(9.4, 0.45, 0.7).translate(0, beamY + 0.225, z0), M.enamel, { chunk: 'landmark' });
  batch.add(new THREE.BoxGeometry(9.6, 0.08, 0.8).translate(0, beamY + 0.49, z0), M.trim, { chunk: 'landmark' });
  for (const bx of [-3.6, -1.2, 1.2, 3.6]) {
    const yArc = cy + Math.sqrt(R * R - bx * bx);
    const h = beamY - yArc + 0.1;
    if (h > 0.05) batch.add(new THREE.BoxGeometry(0.3, h, 0.5).translate(bx, yArc + h / 2 - 0.05, z0), M.enamel, { chunk: 'landmark' });
  }
  const H = 2.9;
  const reno = t('reno.arch.name');
  const letterOpts = { font: '"Playfair Display"', weight: 700, height: H, depth: 0.2, bevel: 0.05, align: 'center', tracking: 0.12 };
  const letters = textGeometryParts(reno, letterOpts);
  // Two single-faced letter sets back to back so RENO reads correctly from north and south.
  const faces = [
    new THREE.Matrix4().makeTranslation(0, beamY + 0.55, z0 + 0.03),
    new THREE.Matrix4().makeTranslation(0, beamY + 0.55, z0 - 0.03).multiply(new THREE.Matrix4().makeRotationY(Math.PI)),
  ];
  for (const lm of faces) {
    batch.add(letters.face, M.red, { matrix: lm, chunk: 'landmark', uv: 'keep' });
    batch.add(letters.side, M.trim, { matrix: lm, chunk: 'landmark', uv: 0.6 });
  }

  // ---- Bulbs ----
  const chase = new BulbSet({ radius: 0.075, pattern: 'chase', speed: 7, intensity: 9, dayIntensity: 0.25 });
  const warm = 0xffd18a;
  for (const s of [-1, 1]) {
    for (const r of [R - 0.15, Rin + 0.15]) {
      const n = Math.round((2 * a0 * r) / 0.32);
      for (let i = 0; i <= n; i++) {
        const ang = -a0 + (2 * a0 * i) / n;
        const p = arcPt(r, ang);
        chase.add([p.x, p.y, z0 + s * (DEPTH / 2 + 0.09)], s > 0 ? i : n - i, warm);
      }
    }
    // Leg bulb channels (two columns per face).
    for (const sx of [-1, 1]) {
      for (const dx of [-0.22, 0.22]) {
        for (let y = 1.6, k = 0; y < SPRING_Y - 0.2; y += 0.34, k++) chase.add([sx * LEG_X + dx, y, z0 + s * 0.56], 200 - k, warm);
      }
      for (const dz of [-0.22, 0.22]) {
        for (let y = 1.6, k = 0; y < SPRING_Y - 0.2; y += 0.34, k++) chase.add([sx * (LEG_X + 0.56), y, z0 + dz], 200 - k, warm);
      }
    }
  }
  // RENO letter outlines: bulbs sampled along the traced glyph contours, on both faces.
  const outline = new BulbSet({ radius: 0.06, pattern: 'wave', speed: 3.2, intensity: 10, dayIntensity: 0.2 });
  const { shapes } = textShapes(reno, { ...letterOpts });
  let k = 0;
  for (const sh of shapes) {
    for (const path of [sh, ...sh.holes]) {
      const pts = path.getSpacedPoints(Math.max(8, Math.round(path.getLength() / 0.22)));
      for (const p of pts) {
        // Inset slightly from the contour so bulbs sit on the face, not hanging off the edge.
        const y = beamY + 0.55 + p.y;
        outline.add([p.x, y, z0 + 0.03 + 0.27], k, 0xfff1d0);
        outline.add([-p.x, y, z0 - 0.03 - 0.27], k, 0xfff1d0);
        k++;
      }
    }
  }
  const bulbMeshes = [chase.build('arch-bulbs'), outline.build('reno-bulbs')];
  for (const b of bulbMeshes) ctx.extraMeshes.push(b);

  // ---- Lights for the night manager (pools, reflections, nearest real lights) ----
  for (let i = 0; i <= 6; i++) {
    const ang = -a0 + (2 * a0 * i) / 6;
    const p = arcPt(R - BAND / 2, ang);
    for (const s of [-1, 1]) {
      lights.push({
        pos: new THREE.Vector3(p.x, p.y - 0.6, z0 + s * 0.8),
        color: 0xffc77a,
        intensity: 14,
        distance: 18,
        kind: 'neon',
        width: 2.6,
        reflectK: 1.2,
        poolK: 0.7,
        groundY: 0,
      });
    }
  }
  for (const s of [-1, 1]) {
    lights.push({ pos: new THREE.Vector3(0, beamY + 2, z0 + s * 0.6), color: 0xff4a4a, intensity: 24, distance: 26, kind: 'neon', width: 6, reflectK: 1.5, poolK: 0.6, groundY: 0, realLight: false });
  }
  for (const sx of [-1, 1]) {
    lights.push({ pos: new THREE.Vector3(sx * LEG_X, 4, z0 + 0.9), color: 0xffd090, intensity: 8, distance: 10, kind: 'neon', width: 1.2, groundY: 0.15 });
  }
  return { z: z0, legX: LEG_X, crownY, bulbs: bulbMeshes };
}

// Red enamel channel-letter faces: glossy by day, internally lit (pink-red) at night.
function letterFaceMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xb3121c, roughness: 0.32, metalness: 0.05, emissive: 0xff2a3a });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = SIGNS.uNight;
    sh.uniforms.uTime = SIGNS.uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // Letters pulse very gently, like old neon transformers under load.
        totalEmissiveRadiance *= uNight * (3.2 + 0.25 * sin(uTime * 1.3));`);
  };
  m.customProgramCacheKey = () => 'arch-letter-face';
  m.name = 'arch-letters';
  return m;
}

function sloganMat() {
  return glowMat(0xfff0c8, 4.2, 0.0);
}

let panel = null;
function panelMat() {
  if (!panel) panel = mat('metal-painted', { color: 0x1d3156, wear: 0.2, dirt: 0.3, seed: 85 });
  return panel;
}

void splitGroups;
void propMats;
