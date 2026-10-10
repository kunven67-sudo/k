// Motel office (x 182..192, z -22..-13): one-storey stucco box with a flat roof and parapet, a big
// clear window, an aluminium glass door (hinged, interactable) and OFFICE neon. Inside: checker
// linoleum, fake-wood wainscot under nicotine-yellow wallpaper, a drop ceiling with water stains and
// a flickering fluorescent tube; the front desk behind scratched bulletproof glass with a pass-
// through tray and speak-hole, a bell, a bowl of mints, NO REFUNDS taped to the glass, a brochure
// rack, a TV on a shelf, the key board, the clerk's stool. spawn.clerk is behind the glass.
import * as THREE from 'three';
import { addBuilding } from '../shared/buildings.js';
import { neonOnFace } from '../shared/signkit.js';
import { propMats } from '../shared/props.js';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { Rng } from '../../core/rng.js';
import { t } from '../../core/i18n.js';
import { OFFICE, Y0 } from './layout.js';
import { motelMats, PAL, plaqueMat } from './mats.js';
import { movable } from './interact.js';
import { partsToGroup } from './doors.js';
import { tvScreen } from './tv.js';

const FLOOR = Y0 + 0.12; // office floor = apron level
const CEIL = Y0 + 2.85;
const DESK_Z = -18.3; // glass line

export function buildOffice(ctx) {
  const { batch, colliders, physics, lights } = ctx;
  const M = motelMats();
  const PM = propMats();
  const rng = new Rng('starlite-office');
  const O = OFFICE;
  const lx = (x) => x - O.x0; // world x → S-face local x
  const door0 = O.doorX - 0.48;
  const door1 = O.doorX + 0.48;

  // ---- Shell -------------------------------------------------------------------------------------
  const b = addBuilding(ctx, {
    x0: O.x0, x1: O.x1, z0: O.z0, z1: O.z1, h: O.h, y: Y0, tint: PAL.office, wall: M.stucco, parapet: 0.6, collide: false, grime: 0.65,
    faces: {
      S: {
        openings: [
          { kind: 'shop', x0: lx(182.5), x1: lx(186.0), y0: 0.75, y1: 2.6, style: 'clear', frame: 0x2a2a2a },
          { kind: 'void', x0: lx(door0), x1: lx(door1), y0: 0.12, y1: 2.32 },
          { kind: 'shop', x0: lx(188.1), x1: lx(191.5), y0: 0.95, y1: 2.6, style: 'clear', frame: 0x2a2a2a },
        ],
        bands: [{ y: 2.95, h: 0.3, d: 0.12, mat: M.trim, tint: PAL.trim }],
      },
      W: { openings: [{ kind: 'window', x0: 3.0, x1: 5.0, y0: 1.1, y1: 2.3, style: 'clear', frame: 0x2a2a2a }] },
      E: { openings: [{ kind: 'window', x0: 5.2, x1: 6.6, y0: 1.2, y1: 2.3, style: 'room', glassTint: 0x8e9a94, frame: 0x2a2a2a }], bands: [{ y: 2.95, h: 0.3, d: 0.12, mat: M.trim, tint: PAL.trim }] },
    },
    roof: { hvac: 1 },
    seed: 'starlite-office',
  });
  // Wall colliders (hollow box with the door gap).
  const T = 0.3;
  const top = Y0 + O.h + 0.6;
  colliders.aabb(O.x0, Y0, O.z1 - T, door0, top, O.z1);
  colliders.aabb(door1, Y0, O.z1 - T, O.x1, top, O.z1);
  colliders.aabb(door0, Y0 + 2.32, O.z1 - T, door1, top, O.z1);
  colliders.aabb(O.x0, Y0, O.z0, O.x1, top, O.z0 + T);
  colliders.aabb(O.x0, Y0, O.z0, O.x0 + T, top, O.z1);
  colliders.aabb(O.x1 - T, Y0, O.z0, O.x1, top, O.z1);
  colliders.aabb(O.x0, Y0 + O.h - 0.4, O.z0, O.x1, Y0 + O.h, O.z1); // roof
  neonOnFace(ctx, b.frames.S, { key: 'starlite-office', x: lx(O.doorX), y: 2.62, z: 0.1, worldW: 1.3, w: 512, h: 160, lines: [{ text: t('motel.office'), font: '400 120px "Bebas Neue"', size: 120, color: '#ff6a3a', y: 84 }], color: 0xff6a3a, backer: 0x1a1a1a, lightK: 4 });

  payphone(ctx, O.x1, -16.2);

  // ---- Interior surfaces (own chunk: index.js hides it when the viewer is far away) ------------------
  const batchAdd = batch.add;
  batch.add = (g, m, o = {}) => batchAdd.call(batch, g, m, { chunk: 'office', ...o });
  const ix0 = O.x0 + T;
  const ix1 = O.x1 - T;
  const iz0 = O.z0 + T;
  const iz1 = O.z1 - T;
  const lino = mat('linoleum', { color: 0xcfc4aa, color2: 0x7a5a4a, wear: 0.75, dirt: 0.75, seed: 871 });
  batch.add(new THREE.BoxGeometry(ix1 - ix0, 0.12, iz1 - iz0).translate((ix0 + ix1) / 2, Y0 + 0.06, (iz0 + iz1) / 2), lino, { castShadow: false });
  colliders.aabb(ix0, Y0, iz0, ix1, FLOOR, iz1);
  const paper = mat('wallpaper', { color: 0xc9b47c, color2: 0x9b8452, pattern: 'stripe', wear: 0.6, dirt: 0.7, seed: 872 });
  const panel = mat('wood', { color: 0x6b4527, wear: 0.5, dirt: 0.4, seed: 873 });
  // Liners on the inside of the four walls: wainscot to 1.0 m, wallpaper above (skip openings).
  const liner = (x0, z0, x1, z1, y0, y1, m, holes = []) => {
    const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const a0 = horiz ? x0 : z0;
    const a1 = horiz ? x1 : z1;
    const cuts = holes.filter((h) => h.y1 > y0 && h.y0 < y1).sort((p, q) => p.a0 - q.a0);
    let a = a0;
    const piece = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      const g = horiz ? new THREE.BoxGeometry(p1 - p0, q1 - q0, 0.02).translate((p0 + p1) / 2, (q0 + q1) / 2, z0) : new THREE.BoxGeometry(0.02, q1 - q0, p1 - p0).translate(x0, (q0 + q1) / 2, (p0 + p1) / 2);
      batch.add(g, m, { castShadow: false });
    };
    for (const h of cuts) {
      piece(a, h.a0, y0, y1);
      piece(h.a0, h.a1, y0, Math.max(y0, h.y0));
      piece(h.a0, h.a1, Math.min(y1, h.y1), y1);
      a = h.a1;
    }
    piece(a, a1, y0, y1);
  };
  const southHoles = [
    { a0: 182.5, a1: 186.0, y0: Y0 + 0.75, y1: Y0 + 2.6 },
    { a0: door0, a1: door1, y0: Y0, y1: Y0 + 2.32 },
    { a0: 188.1, a1: 191.5, y0: Y0 + 0.95, y1: Y0 + 2.6 },
  ];
  const westHoles = [{ a0: O.z0 + 3.0, a1: O.z0 + 5.0, y0: Y0 + 1.1, y1: Y0 + 2.3 }];
  for (const [y0, y1, m] of [[FLOOR, FLOOR + 1.0, panel], [FLOOR + 1.0, CEIL, paper]]) {
    liner(ix0, iz1 - 0.01, ix1, iz1 - 0.01, y0, y1, m, southHoles);
    liner(ix0, iz0 + 0.01, ix1, iz0 + 0.01, y0, y1, m);
    liner(ix0 + 0.01, iz0, ix0 + 0.01, iz1, y0, y1, m, westHoles);
    liner(ix1 - 0.01, iz0, ix1 - 0.01, iz1, y0, y1, m);
  }
  // Chair rail + baseboard.
  for (const [cx, cz, sx, sz] of [[(ix0 + ix1) / 2, iz0 + 0.03, ix1 - ix0, 0.04], [ix0 + 0.03, (iz0 + iz1) / 2, 0.04, iz1 - iz0], [ix1 - 0.03, (iz0 + iz1) / 2, 0.04, iz1 - iz0]]) {
    batch.add(new THREE.BoxGeometry(sx, 0.05, sz).translate(cx, FLOOR + 1.0, cz), panel, { tint: 0x5a3a20 });
    batch.add(new THREE.BoxGeometry(sx, 0.1, sz).translate(cx, FLOOR + 0.05, cz), panel, { tint: 0x3a2614 });
  }
  // Drop ceiling: 2×4 tiles with a few water stains, one tile missing.
  const ceil = new THREE.MeshStandardMaterial({ map: ceilingTex(), roughness: 0.95 });
  ceil.name = 'office-ceiling';
  const cg = new THREE.PlaneGeometry(ix1 - ix0, iz1 - iz0).rotateX(Math.PI / 2).translate((ix0 + ix1) / 2, CEIL, (iz0 + iz1) / 2);
  const cuv = cg.attributes.uv;
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * ((ix1 - ix0) / 2.44), cuv.getY(i) * ((iz1 - iz0) / 2.44));
  batch.add(cg, ceil, { uv: 'keep', castShadow: false });

  // ---- Front desk: laminate counter, bulletproof glass, pass-through tray ------------------------
  const lam = mat('wood', { color: 0x8a6a48, wear: 0.6, dirt: 0.45, seed: 874 });
  const formica = mat('plastic', { color: 0xd7cdb5, wear: 0.6, dirt: 0.55, seed: 875 });
  const cx0 = ix0;
  const cx1 = 190.6;
  const cz = DESK_Z;
  batch.add(new THREE.BoxGeometry(cx1 - cx0, 1.05, 0.62).translate((cx0 + cx1) / 2, FLOOR + 0.525, cz), lam, { grime: 0.5, grimeBase: FLOOR });
  batch.add(new THREE.BoxGeometry(cx1 - cx0 + 0.04, 0.04, 0.72).translate((cx0 + cx1) / 2, FLOOR + 1.07, cz + 0.05), formica, {});
  // Kick scuffs on the laminate front.
  for (let i = 0; i < 5; i++) ctx.decals.push({ kind: 'grime', position: new THREE.Vector3(rng.range(cx0 + 0.5, cx1 - 0.5), FLOOR + 0.2, cz + 0.312), normal: new THREE.Vector3(0, 0, 1), size: [0.5, 0.25], rotation: 0, opacity: 0.3 });
  // Glass partition from the counter to the ceiling, aluminium mullions every 1.4 m.
  const glassH = CEIL - (FLOOR + 1.09);
  const scratched = scratchedGlass();
  const gy = FLOOR + 1.09 + glassH / 2;
  const slotX = 186.2;
  // Glass panes, leaving a 0.12 m slot at the bottom around the pass-through.
  batch.add(new THREE.PlaneGeometry(slotX - 0.3 - cx0, glassH).translate((cx0 + slotX - 0.3) / 2, gy, cz - 0.05), scratched, { uv: 'keep', castShadow: false });
  batch.add(new THREE.PlaneGeometry(cx1 - slotX - 0.3, glassH).translate((slotX + 0.3 + cx1) / 2, gy, cz - 0.05), scratched, { uv: 'keep', castShadow: false });
  batch.add(new THREE.PlaneGeometry(0.6, glassH - 0.12).translate(slotX, gy + 0.06, cz - 0.05), scratched, { uv: 'keep', castShadow: false });
  for (let x = cx0 + 0.02; x <= cx1; x += (cx1 - cx0) / 6) batch.add(new THREE.BoxGeometry(0.05, glassH, 0.07).translate(x, gy, cz - 0.05), M.galv, {});
  batch.add(new THREE.BoxGeometry(cx1 - cx0, 0.06, 0.08).translate((cx0 + cx1) / 2, CEIL - 0.03, cz - 0.05), M.galv, {});
  // Pass-through tray (scooped steel) and the speak-hole rosette.
  batch.add(new THREE.BoxGeometry(0.5, 0.03, 0.42).translate(slotX, FLOOR + 1.06, cz - 0.05), PM.steel, {});
  batch.add(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 20).rotateX(Math.PI / 2).translate(slotX, FLOOR + 1.62, cz - 0.04), PM.steel, {});
  colliders.aabb(cx0, FLOOR, cz - 0.31, cx1, CEIL, cz + 0.4);
  // Clerk's side door + a strip of wall to the east wall.
  batch.add(new THREE.BoxGeometry(ix1 - cx1, CEIL - FLOOR, 0.12).translate((cx1 + ix1) / 2, (FLOOR + CEIL) / 2, cz - 0.05), M.stucco, { tint: 0xd9cfb6 });
  batch.add(new THREE.BoxGeometry(0.82, 2.0, 0.04).translate((cx1 + ix1) / 2, FLOOR + 1.0, cz + 0.03), M.doorMetal, { tint: 0x7a6a58 });
  batch.add(new THREE.SphereGeometry(0.03, 10, 8).translate((cx1 + ix1) / 2 + 0.3, FLOOR + 0.98, cz + 0.08), mat('brass', { seed: 876 }), {});
  colliders.aabb(cx1, FLOOR, cz - 0.11, ix1, CEIL, cz + 0.07);

  // ---- Desk-top props -----------------------------------------------------------------------------
  const chrome = mat('chrome', { wear: 0.5, dirt: 0.4, seed: 877 });
  const ctop = FLOOR + 1.09;
  // Service bell.
  batch.add(new THREE.SphereGeometry(0.05, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(185.2, ctop + 0.02, cz + 0.2), chrome, {});
  batch.add(new THREE.CylinderGeometry(0.055, 0.06, 0.02, 18).translate(185.2, ctop + 0.01, cz + 0.2), PM.black, {});
  batch.add(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 6).translate(185.2, ctop + 0.075, cz + 0.2), chrome, {});
  // Bowl of mints (pressed glass bowl, red-and-white mints).
  const bowl = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.05, 0.002), new THREE.Vector2(0.085, 0.045), new THREE.Vector2(0.09, 0.05)], 18);
  const bowlMesh = new THREE.Mesh(bowl.translate(187.2, ctop, cz + 0.2), PM.glass);
  ctx.extraMeshes.push(bowlMesh);
  const mint = new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10);
  const mintMat = plaqueMat('mint', 64, 64, (g, w, h) => {
    g.fillStyle = '#f4f0ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8242a';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.arc(w / 2, h / 2, w / 2, (i / 6) * Math.PI * 2, ((i + 0.5) / 6) * Math.PI * 2);
      g.fill();
    }
  }, { weather: false });
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, 0.06);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rng.range(-0.4, 0.4), 0, rng.range(-0.4, 0.4))).setPosition(187.2 + Math.cos(a) * r, ctop + 0.012 + r * 0.4 + (i > 9 ? 0.012 : 0), cz + 0.2 + Math.sin(a) * r);
    batch.add(mint, mintMat, { matrix: m, uv: 'keep', castShadow: false });
  }
  // NO REFUNDS + house rules taped to the glass (customer side).
  const rules = plaqueMat('no-refunds', 300, 220, (g, w, h) => {
    g.fillStyle = '#fbf8ef';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c1121c';
    g.font = '400 64px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('motel.noRefunds'), w / 2, 52);
    g.fillStyle = '#1b1b1b';
    g.font = '400 17px "Special Elite", monospace';
    t('motel.noRefundsSmall').split(' · ').forEach((ln, i) => g.fillText(ln, w / 2, 112 + i * 30));
    g.fillStyle = 'rgba(222,205,150,0.85)';
    g.fillRect(-6, 4, 54, 16);
    g.fillRect(w - 48, 4, 54, 16);
  });
  batch.add(new THREE.PlaneGeometry(0.34, 0.25).rotateZ(0.03).translate(187.35, FLOOR + 1.62, cz - 0.04 + 0.012), rules, { uv: 'keep', castShadow: false });
  const ring = plaqueMat('ring-bell', 200, 70, (g, w, h) => {
    g.fillStyle = '#fbf8ef';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1b1b';
    g.font = '400 34px "Special Elite", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('motel.ring'), w / 2, h / 2 + 2);
  });
  batch.add(new THREE.PlaneGeometry(0.2, 0.07).translate(185.2, FLOOR + 1.3, cz - 0.04 + 0.012), ring, { uv: 'keep', castShadow: false });

  // ---- Lobby: brochure rack, two plastic chairs, a dead ficus -------------------------------------
  brochureRack(ctx, ix0 + 0.12, -15.2);
  const chairMat = mat('plastic', { color: 0xd28a3a, wear: 0.5, dirt: 0.5, seed: 878 });
  for (const [x, z, ry] of [[ix1 - 0.4, -15.4, -Math.PI / 2 + 0.1], [ix1 - 0.4, -16.3, -Math.PI / 2 - 0.08]]) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, FLOOR, z);
    batch.add(new THREE.BoxGeometry(0.46, 0.04, 0.44).translate(0, 0.45, 0), chairMat, { matrix: m });
    batch.add(new THREE.BoxGeometry(0.46, 0.42, 0.04).rotateX(-0.12).translate(0, 0.7, -0.21), chairMat, { matrix: m });
    for (const [a, c] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) batch.add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6).translate(a, 0.225, c), M.galv, { matrix: m });
    colliders.box(x, FLOOR + 0.45, z, 0.5, 0.9, 0.5, ry);
  }
  const pot = new THREE.CylinderGeometry(0.2, 0.15, 0.36, 16).translate(ix0 + 0.35, FLOOR + 0.18, iz1 - 0.4);
  batch.add(pot, mat('plastic', { color: 0x5a3a2a, seed: 879 }), {});
  colliders.cylinder(ix0 + 0.35, FLOOR, iz1 - 0.4, 0.2, 0.36);
  const twig = mat('wood', { color: 0x4a3420, seed: 880 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.CylinderGeometry(0.006, 0.012, rng.range(0.6, 1.1), 5).translate(0, 0.45, 0).rotateZ(rng.range(-0.35, 0.35)).rotateY(rng.range(0, 6.28));
    batch.add(g.translate(ix0 + 0.35, FLOOR + 0.3, iz1 - 0.4), twig, {});
  }
  ctx.decals.push({ kind: 'grime', position: new THREE.Vector3(ix0 + 0.6, FLOOR + 0.003, iz1 - 0.6), size: 0.8, opacity: 0.5 });
  ctx.decals.push({ kind: 'grime', position: new THREE.Vector3(O.doorX, FLOOR + 0.003, iz1 - 0.7), size: [1.4, 1.0], rotation: 0, opacity: 0.6 });

  // ---- Clerk side: key board, stool, a shelf with the TV ------------------------------------------
  const keyBoard = plaqueMat('key-board', 256, 160, (g, w, h) => {
    g.fillStyle = '#5d3a22';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e2c37a';
    g.font = '400 13px "Bebas Neue", sans-serif';
    for (let i = 0; i < 32; i++) {
      const x = 14 + (i % 8) * 30;
      const y = 18 + Math.floor(i / 8) * 36;
      g.fillText(String(i + 1), x - 4, y - 4);
      g.fillStyle = '#b8a070';
      g.fillRect(x, y, 3, 4);
      if ((i * 7) % 5) {
        // A key on the hook with a diamond fob.
        g.fillStyle = ['#c23a2a', '#2a5ea8', '#d8b13a', '#3a8a5a'][i % 4];
        g.save();
        g.translate(x + 2, y + 16);
        g.rotate(Math.PI / 4);
        g.fillRect(-6, -6, 12, 12);
        g.restore();
      }
      g.fillStyle = '#e2c37a';
    }
  });
  batch.add(new THREE.BoxGeometry(0.8, 0.5, 0.03).translate(185.0, FLOOR + 1.55, iz0 + 0.03), lam, { tint: 0x5a3a22 });
  batch.add(new THREE.PlaneGeometry(0.78, 0.48).translate(185.0, FLOOR + 1.55, iz0 + 0.046), keyBoard, { uv: 'keep', castShadow: false });
  const stoolM = new THREE.Matrix4().setPosition(186.0, FLOOR, -19.4);
  batch.add(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 18).translate(0, 0.72, 0), mat('leather', { color: 0x5a1a1a, wear: 0.7, seed: 881 }), { matrix: stoolM });
  batch.add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8).translate(0, 0.35, 0), M.galv, { matrix: stoolM });
  batch.add(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 5).translate(0, 0.02, 0), M.galv, { matrix: stoolM });
  colliders.cylinder(186.0, FLOOR, -19.4, 0.22, 0.76);
  // Shelf + TV in the north-east corner, angled toward the lobby.
  const shelfM = new THREE.Matrix4().makeRotationY(-0.6).setPosition(ix1 - 0.45, FLOOR + 2.0, iz0 + 0.5);
  batch.add(new THREE.BoxGeometry(0.6, 0.03, 0.5).translate(0, 0, 0), lam, { matrix: shelfM });
  batch.add(new THREE.BoxGeometry(0.5, 0.36, 0.38).translate(0, 0.2, -0.03), mat('plastic', { color: 0x2a2826, seed: 882 }), { matrix: shelfM });
  const tv = tvScreen('office-tv', { w: 128, h: 96, fps: 10 });
  tv.setOn(true);
  tv.setChannel(2);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), tv.material);
  screen.applyMatrix4(new THREE.Matrix4().multiplyMatrices(shelfM, new THREE.Matrix4().makeTranslation(0, 0.2, 0.161)));
  ctx.extraMeshes.push(screen);
  ctx.updaters.push((dt) => tv.update(dt));
  // Back-office desk with a ledger and a desk fan.
  batch.add(new THREE.BoxGeometry(1.4, 0.75, 0.65).translate(189.3, FLOOR + 0.375, iz0 + 0.4), lam, { tint: 0x7a5a3a });
  colliders.aabb(188.6, FLOOR, iz0, 190.0, FLOOR + 0.75, iz0 + 0.75);
  batch.add(new THREE.BoxGeometry(0.42, 0.04, 0.3).translate(189.1, FLOOR + 0.77, iz0 + 0.42), mat('paper', { color: 0x3a2a1c, seed: 883 }), {});

  batch.add = batchAdd;

  // ---- Fluorescent tube: one real light, flickering ------------------------------------------------
  const fx = 187.0;
  const fz = -16.0;
  batch.add(new THREE.BoxGeometry(1.25, 0.08, 0.32).translate(fx, CEIL - 0.04, fz), M.metal, { tint: 0xd9d6cc });
  const diffMat = new THREE.MeshStandardMaterial({ color: 0xf2f4ee, emissive: 0xe8f4ff, emissiveIntensity: 2.2, roughness: 0.5 });
  diffMat.name = 'office-fluoro';
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.02, 0.26), diffMat);
  diffuser.position.set(fx, CEIL - 0.085, fz);
  ctx.extraMeshes.push(diffuser);
  const light = new THREE.PointLight(0xe4f0ff, 14, 9, 1.6);
  light.position.set(fx, CEIL - 0.25, fz);
  light.castShadow = false;
  ctx.extraMeshes.push(light);
  // Fluorescent stutter: mostly steady, every few seconds a burst of 2-6 blinks.
  const fl = { next: 3, burst: 0 };
  ctx.updaters.push((dt, clock, o, viewer, state) => {
    fl.next -= dt;
    let k = 1;
    if (fl.next < 0) {
      fl.burst = rng.range(0.25, 0.9);
      fl.next = rng.range(3, 9);
    }
    if (fl.burst > 0) {
      fl.burst -= dt;
      k = Math.sin(fl.burst * 90) > 0.2 ? 1 : 0.08;
    }
    const near = viewer.distanceTo(light.position) < 45;
    light.visible = near;
    light.intensity = 14 * k;
    diffMat.emissiveIntensity = 2.2 * k + 0.1;
    void state;
  });
  lights.push({ pos: new THREE.Vector3(O.doorX, Y0 + 1.6, O.z1 + 1.2), color: 0xdce8ff, intensity: 3, distance: 6, kind: 'lamp', groundY: Y0 + 0.12, realLight: false, width: 2.5 });

  // ---- Office door: aluminium frame + glass, hinged on the west jamb, opens outward ---------------
  const dw = door1 - door0 - 0.04;
  const dh = 2.18;
  const parts = [];
  const fr = 0.06;
  const add = (sx, sy, sz, x, y, z, m) => parts.push({ geo: new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), mat: m, tint: null });
  add(dw, fr, 0.05, dw / 2, fr / 2, 0, M.galv);
  add(dw, 0.2, 0.05, dw / 2, 0.1, 0, M.galv);
  add(dw, fr, 0.05, dw / 2, dh - fr / 2, 0, M.galv);
  add(fr, dh, 0.05, fr / 2, dh / 2, 0, M.galv);
  add(fr, dh, 0.05, dw - fr / 2, dh / 2, 0, M.galv);
  add(dw * 0.7, 0.035, 0.05, dw / 2, 1.02, 0.045, PM.steel);
  const door = partsToGroup(parts);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(dw - 2 * fr, dh - 0.2 - fr), PM.glass);
  pane.position.set(dw / 2, 0.2 + (dh - 0.2 - fr) / 2, 0);
  door.add(pane);
  // Hours decal on the glass.
  const hours = plaqueMat('office-hours', 200, 120, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = '400 30px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.fillText(t('motel.office'), w / 2, 40);
    g.font = '400 22px "Bebas Neue", sans-serif';
    g.fillText('24 HRS · RING BELL', w / 2, 80);
  }, { transparent: true, weather: false });
  const hm = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.24), hours);
  hm.position.set(dw / 2, 1.45, 0.03);
  door.add(hm);
  const pivot = new THREE.Group();
  pivot.position.set(door0 + 0.02, FLOOR, O.z1 - 0.06);
  pivot.add(door);
  ctx.extraMeshes.push(pivot);
  pivot.updateMatrixWorld(true);
  const it = movable({
    id: 'office-door', kind: 'hinge', object: pivot, axis: 'y', limits: [0, -1.45], physics, speed: 2.2,
    box: { size: [dw, dh, 0.06], offset: [dw / 2, dh / 2, 0] }, sounds: { open: 'door.open', close: 'door.close', shut: 'door.close' }, label: 'motel.it.officeDoor',
  });
  ctx.interactables.push(it);
  ctx.updaters.push((dt) => it.update(dt));
}

function ceilingTex() {
  const tex = canvasTexture('office-ceiling', 512, 512, (g, w, h) => {
    const r = new Rng('ceil');
    g.fillStyle = '#e9e5da';
    g.fillRect(0, 0, w, h);
    // Fissured tile texture.
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(150,140,120,${r.range(0.08, 0.3)})`;
      g.fillRect(r.range(0, w), r.range(0, h), r.range(1, 4), 1);
    }
    // Two water stains with darker rings.
    for (const [x, y, s] of [[150, 340, 70], [380, 120, 45]]) {
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = `rgba(150,110,50,${0.18 + k * 0.08})`;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y, s * (1 - k * 0.18), s * 0.7 * (1 - k * 0.18), 0.4, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(180,140,70,0.18)';
      g.beginPath();
      g.ellipse(x, y, s, s * 0.7, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    // T-bar grid (2 × 4 ft tiles: the texture spans 2.44 m).
    g.fillStyle = '#f4f2ec';
    for (let i = 0; i <= 4; i++) g.fillRect((i * w) / 4 - 3, 0, 6, h);
    for (let i = 0; i <= 2; i++) g.fillRect(0, (i * h) / 2 - 3, w, 6);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i <= 4; i++) g.fillRect((i * w) / 4 + 3, 0, 1, h);
  }, { repeat: true });
  return tex;
}

function scratchedGlass() {
  const tex = canvasTexture('bulletproof-scratches', 512, 512, (g, w, h) => {
    const r = new Rng('scratch');
    g.fillStyle = 'rgba(200,215,220,0.16)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 45; i++) {
      g.lineWidth = r.range(0.5, 1.4);
      g.beginPath();
      const x = r.range(0, w);
      const y = r.range(h * 0.3, h);
      g.moveTo(x, y);
      g.quadraticCurveTo(x + r.range(-60, 60), y + r.range(-30, 30), x + r.range(-120, 120), y + r.range(-50, 50));
      g.stroke();
    }
    // Hand smudges around the speak hole height and at the tray.
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(230,225,210,${r.range(0.02, 0.05)})`;
      g.beginPath();
      g.ellipse(r.range(w * 0.2, w * 0.8), r.range(h * 0.55, h * 0.95), r.range(10, 30), r.range(14, 36), r.range(0, 3), 0, Math.PI * 2);
      g.fill();
    }
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.08, metalness: 0, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  m.name = 'bulletproof-glass';
  return m;
}

function brochureRack(ctx, x, z) {
  const { batch, colliders } = ctx;
  const M = motelMats();
  const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x, FLOOR, z);
  batch.add(new THREE.BoxGeometry(0.6, 1.3, 0.04).translate(0, 0.65 + 0.2, 0), M.metal, { matrix: m, tint: 0x2a2a28 });
  const covers = plaqueMat('brochures', 512, 256, (g, w, h) => {
    const cols = ['#e04a2a', '#2a8ad8', '#f2c230', '#3aa860', '#d8448a', '#7a4ad8', '#f08a2a', '#2ac0c0'];
    const titles = ['LAKE TAHOE', 'GOLF', 'BUFFET', 'VIRGINIA CITY', 'PAWN', 'RAFTING', 'SHOWS', 'CASINO'];
    for (let i = 0; i < 8; i++) {
      const x0 = (i % 4) * (w / 4);
      const y0 = Math.floor(i / 4) * (h / 2);
      g.fillStyle = cols[i];
      g.fillRect(x0 + 4, y0 + 4, w / 4 - 8, h / 2 - 8);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(x0 + 10, y0 + 40, w / 4 - 20, 50);
      g.fillStyle = '#111';
      g.font = '400 22px "Bebas Neue", sans-serif';
      g.textAlign = 'center';
      g.fillText(titles[i], x0 + w / 8, y0 + 28);
    }
  });
  // Three tiers of pockets, each holding 4 brochures (atlas halves alternate).
  for (let row = 0; row < 3; row++) {
    const y = 0.45 + row * 0.38;
    batch.add(new THREE.BoxGeometry(0.58, 0.02, 0.12).translate(0, y, 0.07), M.galv, { matrix: m });
    batch.add(new THREE.BoxGeometry(0.58, 0.12, 0.01).translate(0, y + 0.06, 0.13), M.galv, { matrix: m });
    const g = new THREE.PlaneGeometry(0.56, 0.24).rotateX(-0.12).translate(0, y + 0.13, 0.08);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5 + (row % 2) * 0.5);
    batch.add(g, covers, { matrix: m, uv: 'keep', castShadow: false });
  }
  const sign = plaqueMat('see-reno', 256, 64, (g, w, h) => {
    g.fillStyle = '#f2c230';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1a1a';
    g.font = '400 46px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('motel.brochures'), w / 2, h / 2 + 3);
  });
  batch.add(new THREE.PlaneGeometry(0.58, 0.14).translate(0, 1.55, 0.025), sign, { matrix: m, uv: 'keep', castShadow: false });
  const p = new THREE.Vector3(0, 0.8, 0.06).applyMatrix4(m);
  colliders.box(p.x, p.y, p.z, 0.62, 1.6, 0.18, Math.PI / 2);
}

// Bell-style payphone on the office's east wall: steel housing, armoured cord, a phone book chained
// underneath with half its pages gone.
function payphone(ctx, x, z) {
  const { batch, colliders } = ctx;
  const M = motelMats();
  const PM = propMats();
  const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x, Y0 + 0.12, z);
  batch.add(new THREE.BoxGeometry(0.62, 0.95, 0.06).translate(0, 1.45, 0.03), M.metal, { matrix: m, tint: 0x8a8d8a, grime: 0.5 });
  batch.add(new THREE.BoxGeometry(0.62, 0.08, 0.3).translate(0, 1.95, 0.15), M.metal, { matrix: m, tint: 0x2a5ea8 });
  batch.add(new THREE.BoxGeometry(0.24, 0.48, 0.12).translate(0, 1.4, 0.12), PM.steel, { matrix: m });
  batch.add(new THREE.BoxGeometry(0.05, 0.22, 0.05).translate(-0.17, 1.42, 0.2), PM.black, { matrix: m });
  batch.add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6).translate(-0.17, 1.1, 0.19), PM.steel, { matrix: m });
  batch.add(new THREE.BoxGeometry(0.42, 0.04, 0.26).translate(0, 0.98, 0.15), M.metal, { matrix: m, tint: 0x8a8d8a });
  batch.add(new THREE.BoxGeometry(0.28, 0.05, 0.2).rotateX(0.2).translate(0, 0.94, 0.16), mat('paper', { color: 0xe8d66a, seed: 884 }), { matrix: m });
  const label = plaqueMat('payphone', 128, 40, (g, w, h) => {
    g.fillStyle = '#2a5ea8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.font = '400 30px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TELEPHONE', w / 2, h / 2 + 2);
  });
  batch.add(new THREE.PlaneGeometry(0.58, 0.075).translate(0, 1.95, 0.302), label, { matrix: m, uv: 'keep', castShadow: false });
  const p = new THREE.Vector3(0, 1.4, 0.15).applyMatrix4(m);
  colliders.box(p.x, p.y, p.z, 0.3, 1.1, 0.62, Math.PI / 2);
}
