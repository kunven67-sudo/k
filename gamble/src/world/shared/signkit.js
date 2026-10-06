// Ready-made sign fixtures for facades and roadsides, built on signs.js.
//
//   boxSign(ctx, frame, { x, y, w, h, d, draw | text/sub/bg/fg/font, lit, key })   flat cabinet sign
//   bladeSign(ctx, frame, { x, y, w, h, text, ... })      vertical sign projecting from a facade
//   neonOnFace(ctx, frame, { x, y, z, worldW, key, lines, h, backer, flicker, color })
//   poleSign(ctx, { x, z, y, ry, h, w, signH, key, draw, neon: {lines, ...}, arrow, bulbs })
//     the classic motel/diner roadside sign: steel pole, lit cabinet, optional neon panel and a
//     bulb-chasing arrow.
// Every fixture registers a light ({kind: 'neon' | 'ad'}) for pools / wet reflections.

import * as THREE from 'three';
import { paintedSignMat, neonSign, BulbSet, fitText } from './signs.js';
import { buildingMats } from './buildings.js';
import { propMats } from './props.js';

function drawText(spec) {
  return (g, w, h) => {
    if (spec.bgGrad) {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, spec.bgGrad[0]);
      grd.addColorStop(1, spec.bgGrad[1]);
      g.fillStyle = grd;
    } else g.fillStyle = spec.bg || '#f2ece0';
    g.fillRect(0, 0, w, h);
    if (spec.border) {
      g.strokeStyle = spec.border;
      g.lineWidth = Math.max(4, h * 0.05);
      g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
    }
    g.fillStyle = spec.fg || '#9c1c1c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const font = spec.font || '"Bebas Neue"';
    const weight = spec.weight ?? 400;
    const mainH = spec.sub ? h * 0.56 : h * 0.78;
    const s = fitText(g, spec.text, w * 0.9, mainH, (z) => `${spec.style || ''} ${weight} ${z}px ${font}`);
    g.font = `${spec.style || ''} ${weight} ${s}px ${font}`;
    if (spec.shadow) {
      g.fillStyle = spec.shadow;
      g.fillText(spec.text, w / 2 + s * 0.04, (spec.sub ? h * 0.38 : h / 2) + s * 0.05);
      g.fillStyle = spec.fg || '#9c1c1c';
    }
    g.fillText(spec.text, w / 2, spec.sub ? h * 0.38 : h / 2 + s * 0.04);
    if (spec.sub) {
      g.fillStyle = spec.subFg || spec.fg || '#333';
      const s2 = fitText(g, spec.sub, w * 0.9, h * 0.2, (z) => `400 ${z}px ${spec.subFont || '"Bebas Neue"'}`);
      g.font = `400 ${s2}px ${spec.subFont || '"Bebas Neue"'}`;
      g.fillText(spec.sub, w / 2, h * 0.8);
    }
  };
}

export function boxSign(ctx, frame, o) {
  const { batch, lights } = ctx;
  const BM = buildingMats();
  const d = o.d ?? 0.22;
  const pxW = Math.min(1024, Math.round(o.w * 128));
  const pxH = Math.max(32, Math.round((pxW * o.h) / o.w));
  const m = paintedSignMat(o.key || `box-${o.text}-${o.sub || ''}`, pxW, pxH, o.draw || drawText(o), { lit: o.lit ?? 0, weather: o.weather });
  const cab = new THREE.BoxGeometry(o.w + 0.1, o.h + 0.1, d);
  cab.translate(o.x, o.y + o.h / 2, d / 2 + (o.z ?? 0));
  batch.add(cab, BM.metal, { matrix: frame.matrix, tint: o.cabinet ?? 0x2c2c2a });
  const p = new THREE.PlaneGeometry(o.w, o.h);
  p.translate(o.x, o.y + o.h / 2, d + 0.004 + (o.z ?? 0));
  batch.add(p, m, { matrix: frame.matrix, uv: 'keep', castShadow: false });
  if (o.lit) {
    const pos = new THREE.Vector3(o.x, o.y + o.h / 2, d + 0.8).applyMatrix4(frame.matrix);
    lights.push({ pos, color: o.lightColor ?? 0xfff0dc, intensity: Math.min(14, o.w * o.h * 1.4) * (o.lit / 1.5), distance: 6 + o.w, kind: 'ad', width: o.w * 0.8, groundY: o.groundY ?? frame.matrix.elements[13], realLight: o.realLight ?? false });
  }
  return m;
}

export function bladeSign(ctx, frame, o) {
  const { batch, lights } = ctx;
  const BM = buildingMats();
  const P = propMats();
  const w = o.w ?? 1.2; // projection from the wall
  const h = o.h ?? 4;
  const d = o.d ?? 0.3;
  const out = o.out ?? 0.35;
  const pxH = Math.min(1024, Math.round(h * 110));
  const pxW = Math.max(32, Math.round((pxH * w) / h));
  const m = paintedSignMat(o.key || `blade-${o.text}`, pxW, pxH, o.draw || ((g, W, H) => {
    g.fillStyle = o.bg || '#1a1a1a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = o.fg || '#ff3b3b';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = [...o.text];
    const step = H / (chars.length + 0.6);
    const s = Math.min(step * 0.92, W * 0.82);
    g.font = `400 ${s}px ${o.font || '"Bebas Neue"'}`;
    chars.forEach((c, i) => g.fillText(c, W / 2, step * (i + 0.8)));
    if (o.border) {
      g.strokeStyle = o.border;
      g.lineWidth = W * 0.06;
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
    }
  }), { lit: o.lit ?? 0, weather: o.weather });
  // Cabinet perpendicular to the wall (local z out), both faces textured.
  const mtx = new THREE.Matrix4().multiplyMatrices(frame.matrix, new THREE.Matrix4().makeTranslation(o.x, o.y, out));
  batch.add(new THREE.BoxGeometry(d, h, w).translate(0, h / 2, w / 2), BM.metal, { matrix: mtx, tint: o.cabinet ?? 0x262626 });
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(w - 0.08, h - 0.08).rotateY((s * Math.PI) / 2).translate(s * (d / 2 + 0.004), h / 2, w / 2);
    // Mirror UVs on the -X face so the text reads correctly from both sides.
    if (s < 0) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    batch.add(g, m, { matrix: mtx, uv: 'keep', castShadow: false });
  }
  // Brackets.
  for (const yy of [0.2, h - 0.2]) batch.add(new THREE.BoxGeometry(0.06, 0.06, out + 0.1).translate(0, yy, -out / 2), P.iron, { matrix: mtx });
  if (o.bulbs) {
    for (let y = 0.15, k = 0; y < h; y += 0.3, k++) {
      for (const s of [-1, 1]) o.bulbs.add(new THREE.Vector3(s * (d / 2 + 0.05), y, w - 0.05).applyMatrix4(mtx), k, o.bulbColor ?? 0xffe0a0);
    }
  }
  if (o.lit || o.neon) {
    const pos = new THREE.Vector3(0, h / 2, w / 2).applyMatrix4(mtx);
    lights.push({ pos, color: o.lightColor ?? 0xff6a5a, intensity: 10, distance: 10, kind: 'neon', width: 0.8, groundY: frame.matrix.elements[13] });
  }
}

/** Neon sign (signs.neonSign) mounted on a facade frame. Returns the neon object. */
export function neonOnFace(ctx, frame, o) {
  const n = neonSign(o.key, o.lines, { w: o.w ?? 1024, h: o.h ?? 256, worldW: o.worldW, backer: o.backer, backerMat: o.backerMat, flicker: o.flicker, intensity: o.intensity });
  n.group.applyMatrix4(new THREE.Matrix4().multiplyMatrices(frame.matrix, new THREE.Matrix4().makeTranslation(o.x, o.y, o.z ?? 0.08)));
  if (o.rotY) n.group.rotateY(o.rotY);
  ctx.extraMeshes.push(n.group);
  const pos = new THREE.Vector3(o.x, o.y, (o.z ?? 0.08) + 0.6).applyMatrix4(frame.matrix);
  ctx.lights.push({ pos, color: o.color ?? 0xff4a6a, intensity: o.lightK ?? 9, distance: 8, kind: 'neon', width: n.worldW * 0.8, groundY: frame.matrix.elements[13], realLight: o.realLight ?? true, flicker: !!o.flicker?.broken });
  return n;
}

/**
 * Roadside pole sign (motel / diner / liquor). Local frame: pole at origin, sign faces ±Z
 * (double-sided), so ry = 0 reads from north and south — set ry to face the traffic.
 */
export function poleSign(ctx, o) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const P = propMats();
  const y = o.y ?? 0.15;
  const H = o.h ?? 9;
  const W = o.w ?? 4;
  const SH = o.signH ?? 2.4;
  const mtx = new THREE.Matrix4().makeRotationY(o.ry ?? 0).setPosition(o.x, y, o.z);
  const poles = o.twin ? [-W * 0.3, W * 0.3] : [0];
  for (const px of poles) {
    batch.add(new THREE.CylinderGeometry(0.14, 0.17, H, 14).translate(px, H / 2, 0), P.galv, { matrix: mtx, grime: 0.5, grimeBase: y });
    batch.add(new THREE.CylinderGeometry(0.4, 0.45, 0.45, 14).translate(px, 0.2, 0), BM.concrete, { matrix: mtx });
    const pp = new THREE.Vector3(px, 0, 0).applyMatrix4(mtx);
    colliders.cylinder(pp.x, y, pp.z, 0.18, H);
  }
  // Main cabinet (double-sided).
  const sy = H - SH;
  const d = 0.45;
  batch.add(new THREE.BoxGeometry(W + 0.12, SH + 0.12, d).translate(0, sy + SH / 2, 0), BM.metal, { matrix: mtx, tint: o.cabinet ?? 0x2b2b2b });
  if (o.draw) {
    const pxW = Math.min(1024, Math.round(W * 140));
    const m = paintedSignMat(o.key, pxW, Math.round((pxW * SH) / W), o.draw, { lit: o.lit ?? 1.6, weather: o.weather });
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(W, SH);
      if (s < 0) g.rotateY(Math.PI);
      g.translate(0, sy + SH / 2, s * (d / 2 + 0.005));
      batch.add(g, m, { matrix: mtx, uv: 'keep', castShadow: false });
    }
  }
  const neons = [];
  if (o.neon) {
    // A neon panel below (or above) the cabinet, on both faces.
    const nW = o.neon.worldW ?? W * 0.9;
    for (const s of [-1, 1]) {
      const n = neonSign(`${o.key}-neon`, o.neon.lines, { w: o.neon.w ?? 1024, h: o.neon.h ?? 256, worldW: nW, backer: o.neon.backer ?? 0x161412, flicker: o.neon.flicker, intensity: o.neon.intensity });
      const ny = o.neon.y ?? sy - (nW * (o.neon.h ?? 256)) / (o.neon.w ?? 1024) / 2 - 0.25;
      n.group.applyMatrix4(new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeRotationY(s < 0 ? Math.PI : 0).setPosition(0, ny, s * 0.12)));
      ctx.extraMeshes.push(n.group);
      neons.push(n);
    }
    const nh = nW * (o.neon.h ?? 256) / (o.neon.w ?? 1024);
    const ny = o.neon.y ?? sy - nh / 2 - 0.25;
    batch.add(new THREE.BoxGeometry(nW + 0.1, nh + 0.1, 0.2).translate(0, ny, 0), BM.metal, { matrix: mtx, tint: 0x1c1c1c });
  }
  // Arrow with chasing bulbs (points along local -X by default; flip with arrow: 1).
  if (o.arrow) {
    const dir = o.arrow.dir ?? -1;
    const ay = o.arrow.y ?? sy - 0.4;
    const len = o.arrow.len ?? W * 0.9;
    const bulbs = new BulbSet({ radius: 0.06, pattern: 'chase', speed: o.arrow.speed ?? 7, intensity: 9, dayIntensity: 0.15 });
    const shape = new THREE.Shape();
    const ah = 0.55;
    shape.moveTo(0, -ah / 2);
    shape.lineTo(len - 0.9, -ah / 2);
    shape.lineTo(len - 0.9, -ah);
    shape.lineTo(len, 0);
    shape.lineTo(len - 0.9, ah);
    shape.lineTo(len - 0.9, ah / 2);
    shape.lineTo(0, ah / 2);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
    g.translate(0, 0, -0.11);
    if (dir < 0) g.rotateY(Math.PI);
    g.translate(dir < 0 ? W / 2 - 0.2 : -W / 2 + 0.2, ay, 0);
    batch.add(g, BM.metal, { matrix: mtx, tint: o.arrow.tint ?? 0xd8b13a });
    const pts = shape.getSpacedPoints(Math.round(len * 5));
    pts.forEach((p, i) => {
      for (const s of [-1, 1]) {
        const lx = (dir < 0 ? W / 2 - 0.2 - p.x : -W / 2 + 0.2 + p.x);
        bulbs.add(new THREE.Vector3(lx, ay + p.y * 0.85, s * 0.14).applyMatrix4(mtx), dir < 0 ? pts.length - i : i, o.arrow.bulb ?? 0xffe6a0);
      }
    });
    ctx.extraMeshes.push(bulbs.build(`${o.key}-arrow`));
  }
  const center = new THREE.Vector3(0, sy + SH / 2, 0).applyMatrix4(mtx);
  lights.push({ pos: center, color: o.lightColor ?? 0xffa060, intensity: 16, distance: 16, kind: 'neon', width: W * 0.8, groundY: y, flicker: !!o.neon?.flicker?.broken, realLight: o.realLight ?? true });
  return { neons, top: H, center };
}
