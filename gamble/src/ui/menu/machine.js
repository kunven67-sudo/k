// The menu's giant slot machine (cabinet, marquee, reel window, bulbs, credit meter, tray).
// Static parts are merged per material (lacquer / chrome / gold / black) to keep draw calls low.
// The button deck and lever live in deck.js; this file exposes anchor points for them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from '../../gfx/materials.js';
import { bevelBox, worldUV } from '../../gfx/geom.js';
import { canvasTexture } from '../../gfx/textures.js';
import { t } from '../../core/i18n.js';
import { createReel } from '../three/reel.js';
import { createBulbs, rectPoints } from '../three/bulbs.js';
import { drawSymbol, SYMBOL_NAMES } from '../three/symbols.js';

export const DIM = { w: 2.3, faceZ: 0.66, winY: 2.5, winW: 1.74, winH: 0.9, deckY: 1.62, topY: 3.38 };

/** Merge meshes (any mix of indexed / non-indexed) into one mesh with `material`. */
export function mergeAll(meshes, material) {
  const geos = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), material);
  mesh.castShadow = mesh.receiveShadow = true;
  geos.forEach((g) => g.dispose());
  return mesh;
}

function box(w, h, d, x, y, z, material, r = 0.03) {
  const b = bevelBox(w, h, d, material, { radius: r, segments: 3 });
  b.position.set(x, y, z);
  return b;
}
function cyl(rt, rb, h, x, y, z, material, rotX = 0, seg = 24) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  c.rotation.x = rotX;
  c.position.set(x, y, z);
  worldUV(c.geometry, 0.5);
  return c;
}

function marqueeTexture() {
  return canvasTexture('ui-menu-marquee', 1024, 420, (g, w, h) => {
    // Sunburst behind the title, like a 60s Reno marquee.
    const bg = g.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, w * 0.6);
    bg.addColorStop(0, '#5a0d1c');
    bg.addColorStop(1, '#12040a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h * 0.95);
    for (let i = 0; i < 26; i++) {
      g.rotate(Math.PI / 26);
      g.fillStyle = i % 2 ? 'rgba(255,190,90,.07)' : 'rgba(255,90,120,.05)';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-w, -30);
      g.lineTo(-w, 30);
      g.fill();
    }
    g.restore();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 168px "Monoton", "Bebas Neue", sans-serif';
    g.shadowColor = '#ff2a60';
    g.shadowBlur = 30;
    g.fillStyle = '#ffd0dc';
    g.fillText('GAMBLE', w / 2, h * 0.5);
    g.shadowBlur = 0;
    g.font = '400 34px "Bebas Neue", sans-serif';
    g.fillStyle = '#f2d688';
    g.fillText('R E N O  ·  N E V A D A', w / 2, h * 0.85);
    g.font = 'italic 400 30px "Playfair Display", serif';
    g.fillText('a Loaded Dice machine', w / 2, h * 0.14);
  });
}

/** The credit meter: red seven-segment-style LED text on black glass. Redrawn on change. */
function makeMeter() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (left, right) => {
    g.fillStyle = '#080404';
    g.fillRect(0, 0, 512, 64);
    g.font = '400 40px "Bebas Neue", monospace';
    g.textBaseline = 'middle';
    g.fillStyle = '#2a0606';
    g.textAlign = 'left';
    g.fillText('88888888', 16, 34);
    g.textAlign = 'right';
    g.fillText('8888888', 496, 34);
    g.shadowColor = '#ff2020';
    g.shadowBlur = 12;
    g.fillStyle = '#ff4a3a';
    g.textAlign = 'left';
    g.fillText(left, 16, 34);
    g.textAlign = 'right';
    g.fillText(right, 496, 34);
    g.shadowBlur = 0;
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

export function buildMachine(scene, { tier, options }) {
  const group = new THREE.Group();
  scene.add(group);
  const lacquer = mat('car-paint', { color: 0x6b0c16, wear: 0.25, dirt: 0.2 });
  const chrome = mat('chrome');
  const gold = mat('gold');
  const black = mat('plastic', { color: 0x141113, wear: 0.4, dirt: 0.3 });
  const { w, faceZ, winY, winW, winH, topY } = DIM;
  const d = 1.3;
  const meterY = winY + winH / 2 + 0.31; // LED credit meter between the window bulbs and the top box

  // --- cabinet shell
  const L = [];
  const C = [];
  const Gd = [];
  const B = [];
  L.push(box(w, 2.4, d, 0, 0.98 + 1.2, 0, lacquer, 0.08)); // main body (y 0.98..3.38)
  L.push(box(w - 0.18, 1.05, d - 0.25, 0, topY + 0.52, -0.1, lacquer, 0.1)); // top box
  B.push(box(w + 0.16, 0.98, d + 0.2, 0, 0.49, 0.02, black, 0.05)); // pedestal
  C.push(box(w + 0.2, 0.08, d + 0.24, 0, 0.94, 0.02, chrome, 0.03)); // pedestal cap
  C.push(box(w + 0.2, 0.06, d + 0.24, 0, 0.03, 0.02, chrome, 0.02)); // kick plate
  // Chrome edge trims down both front corners and across the top.
  for (const s of [-1, 1]) C.push(cyl(0.045, 0.045, 2.42, s * (w / 2 + 0.005), 2.18, faceZ - 0.01, chrome, 0, 12));
  // Gold pinstripes framing the face.
  for (const s of [-1, 1]) Gd.push(box(0.025, 2.2, 0.02, s * (w / 2 - 0.13), 2.2, faceZ + 0.005, gold, 0.008));
  // Reel window bezel (chrome) + credit meter frame.
  const bz = 0.07;
  C.push(box(winW + 0.22, bz, 0.2, 0, winY + winH / 2 + bz / 2, faceZ + 0.06, chrome, 0.03));
  C.push(box(winW + 0.22, bz, 0.2, 0, winY - winH / 2 - bz / 2, faceZ + 0.06, chrome, 0.03));
  for (const s of [-1, 1]) C.push(box(bz, winH + 0.14, 0.2, s * (winW / 2 + 0.075), winY, faceZ + 0.06, chrome, 0.03));
  // Thin chrome dividers between the reels.
  for (const x of [-0.4, 0.4]) C.push(box(0.02, winH, 0.14, x, winY, faceZ + 0.04, chrome, 0.008));
  B.push(box(1.5, 0.16, 0.04, 0, meterY, faceZ + 0.02, black, 0.02)); // meter glass
  Gd.push(box(1.56, 0.2, 0.025, 0, meterY, faceZ + 0.005, gold, 0.02));
  // Coin tray: chrome scoop on the pedestal.
  C.push(box(1.0, 0.04, 0.36, 0, 1.0, faceZ + 0.18, chrome, 0.015));
  C.push(box(1.0, 0.11, 0.035, 0, 1.05, faceZ + 0.35, chrome, 0.015));
  for (const s of [-1, 1]) C.push(box(0.035, 0.11, 0.36, s * 0.48, 1.05, faceZ + 0.18, chrome, 0.012));
  B.push(box(0.42, 0.16, 0.04, 0, 1.17, faceZ + 0.01, black, 0.03)); // coin chute mouth
  // Brass maker's plaque on the pedestal.
  Gd.push(box(0.9, 0.16, 0.03, 0, 0.55, faceZ + 0.12, gold, 0.02));
  for (const [list, m] of [[L, lacquer], [C, chrome], [Gd, gold], [B, black]]) {
    list.forEach((x) => group.add(x));
    const merged = mergeAll(list, m);
    list.forEach((x) => {
      group.remove(x);
      x.geometry.dispose();
    });
    group.add(merged);
  }

  // --- marquee (self-lit glass panel) + its bulb ring
  const marqMat = new THREE.MeshBasicMaterial({ map: marqueeTexture(), color: new THREE.Color(1.5, 1.5, 1.5) });
  const marq = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.76), marqMat);
  marq.position.set(0, topY + 0.52, -0.1 + (d - 0.25) / 2 + 0.006); // on the top box's face
  group.add(marq);
  const marqBulbs = createBulbs(rectPoints(0, topY + 0.52, 1.98, 0.9, 0.13, marq.position.z + 0.01), { radius: 0.03 });
  group.add(marqBulbs.group);
  // Bulbs around the reel window.
  const winBulbs = createBulbs(rectPoints(0, winY, winW + 0.42, winH + 0.36, 0.14, faceZ + 0.01), { radius: 0.032 });
  group.add(winBulbs.group);

  // --- reels: symbol | menu option | symbol
  const reelZ = faceZ - Math.sqrt(1 - (winH / 2) ** 2) + 0.03;
  const symbolReel = (k) => {
    const r = createReel({ key: `menu-sym-${k}`, count: 12, radius: 1, width: 0.36, cellW: 200, cellH: 200, draw: (g, i, cw, ch) => drawSymbol(g, SYMBOL_NAMES[(i * 5 + k * 3) % SYMBOL_NAMES.length], cw, ch) });
    r.mesh.position.set(k ? 0.6 : -0.6, winY, reelZ);
    r.setIndex(k ? 4 : 7);
    group.add(r.mesh);
    return r;
  };
  const left = symbolReel(0);
  const right = symbolReel(1);
  let center = null;
  const makeCenter = () => {
    const idx = center ? center.index : 0;
    if (center) {
      group.remove(center.mesh);
      center.mesh.geometry.dispose();
      center.material.dispose();
    }
    const lang = t('ui.menu.play');
    center = createReel({
      key: `menu-opts-${lang}-${options.map((o) => o.id).join()}`,
      count: options.length * 2, // each option twice around the drum, so it reads as a reel
      radius: 1,
      width: 0.76,
      cellW: 420,
      cellH: 300,
      draw: (g, i, cw, ch) => drawOption(g, options[i % options.length], cw, ch),
    });
    center.mesh.position.set(0, winY, reelZ);
    center.setIndex(idx);
    group.add(center.mesh);
    machine.center = center;
  };

  // Glass over the window: faint, just enough to catch a highlight.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.1 }));
  glass.position.set(0, winY, faceZ + 0.1);
  group.add(glass);
  const payline = new THREE.Mesh(new THREE.PlaneGeometry(winW, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.3, 0.3), transparent: true, opacity: 0.5 }));
  payline.position.set(0, winY, faceZ + 0.095);
  group.add(payline);

  // Credit meter.
  const meter = makeMeter();
  const meterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.18), new THREE.MeshBasicMaterial({ map: meter.tex, color: new THREE.Color(1.4, 1.4, 1.4) }));
  meterMesh.position.set(0, meterY, faceZ + 0.042);
  group.add(meterMesh);

  const machine = {
    group,
    left,
    right,
    center: null,
    marqBulbs,
    winBulbs,
    rebuildLabels: () => makeCenter(),
    setMeter: (a, b) => meter.draw(a, b),
    update(dt, time) {
      left.update(dt);
      right.update(dt);
      machine.center.update(dt);
      marqBulbs.update(time);
      winBulbs.update(time);
    },
    dispose() {
      for (const x of [marqMat, glass.material, payline.material, meterMesh.material, meter.tex, left.material, right.material, machine.center.material]) x.dispose();
      marqBulbs.dispose();
      winBulbs.dispose();
    },
  };
  makeCenter();
  return machine;
}

/** One menu option printed on the center reel: big title + small line under it. */
function drawOption(g, o, w, h) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const title = o.label().toUpperCase();
  let size = 96;
  g.font = `400 ${size}px "Bebas Neue", sans-serif`;
  while (g.measureText(title).width > w * 0.86 && size > 40) g.font = `400 ${(size -= 4)}px "Bebas Neue", sans-serif`;
  g.fillStyle = o.color;
  g.strokeStyle = '#d6a945';
  g.lineWidth = 3;
  g.strokeText(title, w / 2, h * 0.47);
  g.fillText(title, w / 2, h * 0.47);
  g.fillStyle = '#6b5a3c';
  g.font = '400 22px "Bebas Neue", sans-serif';
  g.fillText('★  ★  ★', w / 2, h * 0.16);
  g.fillText('★  ★  ★', w / 2, h * 0.8);
}
