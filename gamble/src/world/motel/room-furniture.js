// Player-room furniture: the double bed (draped floral spread, rumpled sheets), nightstand with lamp,
// beige landline and an alarm clock blinking 12:00, the dresser (sliding drawers) with a flat TV,
// the mini-fridge (opening door, shelves, a few sad things inside) with a microwave on top, the
// round table by the window, the wall AC, a framed bad landscape and a dangling smoke detector.
import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { Rng } from '../../core/rng.js';
import { audio } from '../../core/audio.js';
import { RI } from './layout.js';
import { motelMats, plaqueMat } from './mats.js';
import { partsToGroup } from './doors.js';
import { movable, switcher } from './interact.js';
import { tvScreen } from './tv.js';

const FL = RI.fl;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildFurniture(ctx, room) {
  const { batch, colliders, physics } = ctx;
  const M = motelMats();
  const rng = new Rng('starlite-furniture');
  const F = {
    veneer: mat('wood', { color: 0x6a4428, wear: 0.65, dirt: 0.45, varnish: 0.6, seed: 911 }),
    sheet: mat('fabric', { color: 0xebe5d8, wear: 0.4, dirt: 0.45, seed: 912 }),
    plastic: mat('plastic', { color: 0xe4dccb, wear: 0.55, dirt: 0.6, seed: 913 }),
    black: mat('plastic', { color: 0x1c1c1e, wear: 0.4, dirt: 0.4, seed: 914 }),
    brass: mat('brass', { wear: 0.7, dirt: 0.5, seed: 915 }),
  };
  room.F = F;
  const add = (g, m, o = {}) => batch.add(g, m, { chunk: 'room', ...o });

  // ---- Bed (headboard on the west wall; 1.95 m along x, 1.4 m along z) ----------------------------
  const bx0 = RI.x0;
  const bx1 = RI.x0 + 1.95;
  const bz0 = -49.3;
  const bz1 = -47.9;
  const bcz = (bz0 + bz1) / 2;
  const top = FL + 0.58;
  add(new THREE.BoxGeometry(0.05, 1.05, 1.55).translate(bx0 + 0.025, FL + 0.55, bcz), F.veneer, {});
  add(new THREE.BoxGeometry(0.04, 0.06, 1.6).translate(bx0 + 0.06, FL + 1.08, bcz), F.veneer, { tint: 0x4a2c18 });
  add(new THREE.BoxGeometry(bx1 - bx0 - 0.05, 0.3, 1.4).translate((bx0 + bx1) / 2 + 0.025, FL + 0.2, bcz), F.sheet, { tint: 0xb7ab92 });
  add(new THREE.BoxGeometry(bx1 - bx0 - 0.08, 0.06, 1.42).translate((bx0 + bx1) / 2 + 0.04, FL + 0.04, bcz), M.galv, {});
  // Mattress + sheet: subdivided top with wrinkles, a rolled-down top sheet.
  const sheet = drape({ x0: bx0 + 0.06, x1: bx1, z0: bz0, z1: bz1, top, overhang: 0.2, amp: 0.025, seed: 1, nx: 30, nz: 22, pad: 0.004 });
  add(sheet, F.sheet, { uv: 0.4 });
  // Floral bedspread: kicked down toward the foot, hanging over the foot end and both sides.
  const spread = drape({ x0: bx0 + 0.85, x1: bx1, z0: bz0, z1: bz1, top: top + 0.02, overhang: 0.42, amp: 0.05, seed: 2, nx: 26, nz: 22, rumple: 0.14, lift: 0.07, pad: 0.06 });
  add(spread, floralMat(), { uv: 'keep' });
  // One pillow left on the bed (the other is on the floor, see room-clutter.js).
  const pillow = new THREE.SphereGeometry(0.5, 16, 10).scale(0.32, 0.12, 0.6).translate(bx0 + 0.32, top + 0.07, bcz + 0.25).rotateY(0);
  add(pillow, F.sheet, { tint: 0xf1ece0 });
  colliders.aabb(bx0, FL, bz0 - 0.05, bx1 + 0.05, top + 0.05, bz1 + 0.05);
  // Stains on the sheet.
  ctx.decals.push({ kind: 'grime', position: V(bx0 + 0.55, top + 0.04, bcz - 0.2), size: 0.35, opacity: 0.4 });
  ctx.decals.push({ kind: 'puddle', position: V(bx0 + 0.7, top + 0.04, bcz + 0.35), size: 0.3, opacity: 0.35 });

  // ---- Nightstand + lamp + phone + alarm clock ------------------------------------------------------
  const nx = RI.x0 + 0.27;
  const nz = -49.95;
  add(new THREE.BoxGeometry(0.48, 0.58, 0.44).translate(nx, FL + 0.29, nz), F.veneer, { grime: 0.4, grimeBase: FL });
  add(new THREE.BoxGeometry(0.4, 0.18, 0.01).translate(nx + 0.0, FL + 0.42, nz + 0.225), F.veneer, { tint: 0x5a3820 });
  add(new THREE.BoxGeometry(0.06, 0.015, 0.02).translate(nx, FL + 0.42, nz + 0.235), F.brass, {});
  colliders.aabb(nx - 0.24, FL, nz - 0.22, nx + 0.24, FL + 0.6, nz + 0.22);
  const ntop = FL + 0.58;
  // Ceramic lamp (gourd base) + pleated shade.
  const lampBase = new THREE.LatheGeometry([V(0, 0, 0), V(0.07, 0, 0), V(0.085, 0.06, 0), V(0.06, 0.2, 0), V(0.02, 0.26, 0), V(0.012, 0.42, 0), V(0, 0.42, 0)].map((p) => new THREE.Vector2(p.x, p.y)), 16);
  add(lampBase.translate(nx - 0.08, ntop, nz - 0.08), mat('plastic', { color: 0x7a8f6a, wear: 0.3, dirt: 0.5, seed: 916 }), {});
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc27a, emissiveIntensity: 0, transparent: true, opacity: 0.96 });
  shadeMat.name = 'lamp-shade';
  const shadeGeo = new THREE.CylinderGeometry(0.11, 0.17, 0.22, 24, 1, true);
  const sp = shadeGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const a = Math.atan2(sp.getZ(i), sp.getX(i));
    const k = 1 + Math.sin(a * 24) * 0.02;
    sp.setX(i, sp.getX(i) * k);
    sp.setZ(i, sp.getZ(i) * k);
  }
  shadeGeo.computeVertexNormals();
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  shade.position.set(nx - 0.08, ntop + 0.42, nz - 0.08);
  shade.rotation.z = 0.06; // knocked crooked
  ctx.extraMeshes.push(shade);
  const lampLight = new THREE.PointLight(0xffc27a, 0, 6, 1.8);
  lampLight.position.set(nx - 0.06, ntop + 0.42, nz - 0.06);
  ctx.extraMeshes.push(lampLight);
  const lamp = switcher({
    id: 'lamp', object: shade, physics, box: { size: [0.34, 0.24, 0.34] }, label: 'motel.it.lamp', start: false,
    onToggle: (on) => {
      lampLight.intensity = on ? 4 : 0;
      shadeMat.emissiveIntensity = on ? 0.3 : 0;
    },
  });
  ctx.interactables.push(lamp);
  room.lights.lamp = lampLight;
  room.lamp = lamp;
  // Beige landline.
  const phoneM = new THREE.Matrix4().makeRotationY(0.4).setPosition(nx + 0.1, ntop, nz + 0.07);
  add(new THREE.BoxGeometry(0.17, 0.06, 0.2).translate(0, 0.03, 0), F.plastic, { matrix: phoneM });
  add(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8).rotateZ(Math.PI / 2).translate(0, 0.085, -0.03), F.plastic, { matrix: phoneM });
  add(new THREE.PlaneGeometry(0.1, 0.08).rotateX(-Math.PI / 2 + 0.3).translate(0, 0.062, 0.05), keypadMat(), { matrix: phoneM, uv: 'keep', castShadow: false });
  // Coiled cord (helix).
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const tt = i / 80;
    pts.push(V(-0.09 + Math.cos(tt * 60) * 0.008, 0.07 - tt * 0.06 + Math.sin(tt * 60) * 0.008, -0.03 - tt * 0.08));
  }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.003, 4), F.plastic, { matrix: phoneM, castShadow: false });
  // Alarm clock blinking 12:00 (red LED digits).
  const clockTex = canvasTexture('room-alarm', 128, 48, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff2a1a';
    g.font = '400 44px "Bebas Neue", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('12:00', w / 2, h / 2 + 2);
  });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x080404, emissive: 0xffffff, emissiveMap: clockTex, emissiveIntensity: 2.2, roughness: 0.3 });
  ledMat.name = 'alarm-led';
  const clockM = new THREE.Matrix4().makeRotationY(Math.PI / 2 - 0.35).setPosition(nx + 0.05, ntop, nz - 0.14);
  add(new THREE.BoxGeometry(0.16, 0.07, 0.07).translate(0, 0.035, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.12)), F.black, { matrix: clockM });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), ledMat);
  led.applyMatrix4(new THREE.Matrix4().multiplyMatrices(clockM, new THREE.Matrix4().makeRotationX(-0.12).setPosition(0, 0.037, 0.0365)));
  ctx.extraMeshes.push(led);
  room.fx.push((dt, state, near, clock) => {
    if (!near) return;
    // Power went out at some point; it has been blinking ever since.
    const tt = performance.now() / 1000;
    ledMat.emissiveIntensity = tt % 1 < 0.55 ? 2.2 : 0.05;
    void clock;
  });

  // ---- Dresser + drawers + TV (east wall, facing the bed) -----------------------------------------
  const dx1 = RI.x1;
  const dx0 = RI.x1 - 0.5;
  const dz0 = -49.6;
  const dz1 = -47.6;
  const dh = 0.78;
  add(new THREE.BoxGeometry(0.5, dh, dz1 - dz0).translate((dx0 + dx1) / 2, FL + dh / 2, (dz0 + dz1) / 2), F.veneer, { grime: 0.3, grimeBase: FL });
  add(new THREE.BoxGeometry(0.54, 0.03, dz1 - dz0 + 0.04).translate((dx0 + dx1) / 2 - 0.02, FL + dh + 0.015, (dz0 + dz1) / 2), F.veneer, { tint: 0x8a6a4a });
  colliders.aabb(dx0 - 0.04, FL, dz0, dx1, FL + dh + 0.03, dz1);
  // 2 × 2 drawers sliding out toward -x.
  let di = 0;
  for (const row of [0, 1]) {
    for (const col of [0, 1]) {
      const w = (dz1 - dz0) / 2 - 0.04;
      const h = 0.3;
      const parts = [
        { geo: new THREE.BoxGeometry(0.02, h, w).translate(-0.01, 0, 0), mat: F.veneer, tint: 0x7a5232 },
        { geo: new THREE.BoxGeometry(0.42, 0.02, w - 0.04).translate(0.21, -h / 2 + 0.03, 0), mat: F.veneer, tint: 0x9a7a5a },
        { geo: new THREE.BoxGeometry(0.42, h - 0.06, 0.015).translate(0.21, 0, w / 2 - 0.03), mat: F.veneer, tint: 0x9a7a5a },
        { geo: new THREE.BoxGeometry(0.42, h - 0.06, 0.015).translate(0.21, 0, -w / 2 + 0.03), mat: F.veneer, tint: 0x9a7a5a },
        { geo: new THREE.BoxGeometry(0.03, 0.025, 0.12).translate(-0.03, 0.02, 0), mat: F.brass, tint: null },
      ];
      const g = partsToGroup(parts);
      g.position.set(dx0 - 0.005, FL + 0.2 + row * 0.36, dz0 + 0.02 + (col + 0.5) * (w + 0.04));
      ctx.extraMeshes.push(g);
      const it = movable({ id: `dresser-drawer-${di++}`, kind: 'slide', object: g, axis: 'x', limits: [0, -0.32], speed: 1.2, label: 'motel.it.drawer', sounds: { open: 'cage.drawer', close: 'cage.drawer' } });
      it._room = true;
      ctx.interactables.push(it);
    }
  }
  // Flat TV on a swivel stand, angled a bit toward the bed.
  const tvM = new THREE.Matrix4().makeRotationY(-Math.PI / 2 - 0.12).setPosition((dx0 + dx1) / 2, FL + dh + 0.03, (dz0 + dz1) / 2 - 0.1);
  add(new THREE.BoxGeometry(0.26, 0.02, 0.2).translate(0, 0.01, 0), F.black, { matrix: tvM });
  add(new THREE.BoxGeometry(0.05, 0.12, 0.03).translate(0, 0.07, -0.02), F.black, { matrix: tvM });
  add(new THREE.BoxGeometry(0.8, 0.48, 0.05).translate(0, 0.38, 0), F.black, { matrix: tvM });
  const tv = tvScreen('room-tv', { w: 192, h: 112, fps: 12 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.42), tv.material);
  screen.applyMatrix4(new THREE.Matrix4().multiplyMatrices(tvM, new THREE.Matrix4().makeTranslation(0, 0.385, 0.0255)));
  ctx.extraMeshes.push(screen);
  const tvLight = new THREE.PointLight(0x8fa6c8, 0, 5.5, 1.6);
  tvLight.position.copy(V(0, 0.55, 1.1).applyMatrix4(tvM));
  ctx.extraMeshes.push(tvLight);
  let staticSnd = null;
  const tvIt = switcher({
    id: 'tv', object: screen, physics, box: { size: [0.8, 0.5, 0.06] }, label: 'motel.it.tv', start: true, sound: 'ui.click',
    onToggle: (on) => {
      tv.setOn(on);
      if (on) tv.nextChannel();
      tvLight.intensity = 0;
      if (!on && staticSnd) {
        staticSnd.stop?.(0.1);
        staticSnd = null;
      }
    },
  });
  tv.setOn(true);
  tv.setChannel(1);
  ctx.interactables.push(tvIt);
  room.tv = tv;
  room.lights.tv = tvLight;
  room.fx.push((dt, state, near) => {
    tvLight.visible = near && tv.on;
    if (!near) return;
    const lvl = tv.update(dt);
    tvLight.color.copy(tv.state.glow);
    tvLight.intensity = tv.on ? 7 * lvl : 0;
    // The static channel hisses; only when someone is close enough to hear it.
    if (tv.on && tv.state.channel === 0 && !staticSnd) {
      try {
        staticSnd = audio.play('tv.static', { bus: 'sfx', loop: true, gain: 0.25, position: { x: tvLight.position.x, y: tvLight.position.y, z: tvLight.position.z } });
      } catch {
        staticSnd = { stop() {} };
      }
    } else if (staticSnd && (!tv.on || tv.state.channel !== 0)) {
      staticSnd.stop?.(0.1);
      staticSnd = null;
    }
  });

  // ---- Mini-fridge + microwave (east wall, between dresser and bathroom) ---------------------------
  fridge(ctx, room, F, { x: RI.x1 - 0.27, z: -50.15 });

  // ---- Round table by the window ---------------------------------------------------------------------
  const tx = 206.85;
  const tz = -46.25;
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 32).translate(tx, FL + 0.72, tz), mat('plastic', { color: 0xd8cdb2, wear: 0.7, dirt: 0.6, seed: 917 }), {});
  add(new THREE.CylinderGeometry(0.405, 0.405, 0.018, 32, 1, true).translate(tx, FL + 0.71, tz), M.galv, {});
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10).translate(tx, FL + 0.36, tz), M.galv, {});
  add(new THREE.CylinderGeometry(0.25, 0.27, 0.025, 20).translate(tx, FL + 0.0125, tz), M.galv, {});
  colliders.cylinder(tx, FL, tz, 0.4, 0.74);
  room.table = { x: tx, z: tz, y: FL + 0.735 };

  // ---- Wall AC (inside face) --------------------------------------------------------------------------
  const acM = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(206.55, FL + 0.55, RI.zf);
  add(new THREE.BoxGeometry(0.68, 0.44, 0.22).translate(0, 0, 0.11), F.plastic, { matrix: acM, grime: 0.5, grimeBase: FL });
  add(new THREE.PlaneGeometry(0.62, 0.3).translate(-0.04, 0.02, 0.222), acFrontMat(), { matrix: acM, uv: 'keep', castShadow: false });
  colliders.aabb(206.2, FL + 0.3, RI.zf - 0.24, 206.9, FL + 0.78, RI.zf);
  const acKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12).rotateX(Math.PI / 2), F.black);
  acKnob.position.copy(V(0.27, 0.05, 0.23).applyMatrix4(acM));
  ctx.extraMeshes.push(acKnob);
  let acSnd = null;
  const ac = switcher({
    id: 'ac', object: acKnob, physics: null, label: 'motel.it.ac', start: false, sound: 'ui.toggle',
    onToggle: (on) => {
      acKnob.rotation.z = on ? -1.2 : 0;
      if (on) {
        try {
          acSnd = audio.play('ac.rattle', { bus: 'sfx', loop: true, gain: 0.5, position: { x: acKnob.position.x, y: acKnob.position.y, z: acKnob.position.z } });
        } catch {
          acSnd = null;
        }
      } else {
        acSnd?.stop?.(0.3);
        acSnd = null;
      }
    },
  });
  ctx.interactables.push(ac);
  room.ac = ac;
  // When the AC runs, the curtains above it breathe.
  room.fx.push((dt, state, near) => {
    if (!near || !ac.on || !room.curtains) return;
    const tt = performance.now() / 1000;
    room.curtains.group.children[0].rotation.x = Math.sin(tt * 2.3) * 0.025 - 0.03;
    room.curtains.group.children[1].rotation.x = Math.sin(tt * 2.1 + 1) * 0.025 - 0.03;
  });

  // ---- Framed bad landscape over the bed ------------------------------------------------------------
  const art = new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeRotationZ(0.025)).setPosition(RI.x0 + 0.02, FL + 1.55, bcz);
  add(new THREE.BoxGeometry(0.92, 0.62, 0.03).translate(0, 0, 0.015), mat('plastic', { color: 0xb8913a, wear: 0.6, seed: 918 }), { matrix: art });
  add(new THREE.PlaneGeometry(0.84, 0.54).translate(0, 0, 0.032), landscapeMat(), { matrix: art, uv: 'keep', castShadow: false });

  // ---- Smoke detector with its battery door hanging open ---------------------------------------------
  add(new THREE.CylinderGeometry(0.07, 0.075, 0.035, 20).translate(205.3, RI.ceil - 0.018, -46.6), F.plastic, { tint: 0xf2eee4 });
  add(new THREE.BoxGeometry(0.05, 0.004, 0.035).translate(0, -0.002, 0.0175).rotateX(-1.1).translate(205.3, RI.ceil - 0.04, -46.6 - 0.035), F.plastic, { tint: 0xf2eee4 });
  void rng;
}

// Cloth drape over a box top: vertices beyond the footprint fall straight down the sides.
function drape({ x0, x1, z0, z1, top, overhang, amp, seed, nx, nz, rumple = 0, lift = 0, pad = 0.02 }) {
  const r = new Rng(`drape${seed}`);
  const W = x1 - x0 + overhang * 2;
  const D = z1 - z0 + overhang * 2;
  const g = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  // Bake 0..1 UVs before deforming (for the floral print).
  const p = g.attributes.position;
  const ph = [r.range(0, 6), r.range(0, 6), r.range(0, 6)];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let z = p.getZ(i);
    const ox = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
    const oz = z < z0 ? z0 - z : z > z1 ? z - z1 : 0;
    const hang = Math.max(ox, oz);
    const wr = Math.sin(x * 9 + ph[0]) * Math.sin(z * 7 + ph[1]) * amp + Math.sin(x * 23 + z * 17 + ph[2]) * amp * 0.3;
    let y = top + wr + lift;
    // Rumple: a fat roll of cloth near the head end of the spread (it was kicked down).
    if (rumple) y += Math.max(0, 1 - Math.abs(x - (x0 + 0.12)) / 0.22) * rumple * (0.7 + 0.3 * Math.sin(z * 11));
    if (hang > 0) {
      x = THREE.MathUtils.clamp(x, x0 - pad, x1 + pad) + (ox ? Math.sign(x - (x0 + x1) / 2) * pad * 0.4 * Math.sin(z * 20 + ph[0]) : 0);
      z = THREE.MathUtils.clamp(z, z0 - pad, z1 + pad) + (oz ? Math.sign(z - (z0 + z1) / 2) * pad * 0.4 * Math.sin(x * 18 + ph[1]) : 0);
      y = top + lift - hang * 0.95 + wr * 0.4;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

let floral = null;
function floralMat() {
  if (floral) return floral;
  const tex = canvasTexture('room-floral', 512, 512, (g, w, h) => {
    const r = new Rng('floral');
    g.fillStyle = '#2f4a3e';
    g.fillRect(0, 0, w, h);
    // Big tropical/hibiscus blooms in salmon + mustard over teal leaves (a 1989 bedspread).
    for (let i = 0; i < 46; i++) {
      const x = r.range(0, w);
      const y = r.range(0, h);
      g.fillStyle = r.pick(['#3f6b52', '#5a7a4a', '#24402f']);
      g.beginPath();
      g.ellipse(x, y, r.range(18, 34), r.range(6, 12), r.range(0, 3.14), 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 22; i++) {
      const x = r.range(0, w);
      const y = r.range(0, h);
      const s = r.range(16, 30);
      const col = r.pick(['#e2795a', '#d9a03a', '#c94c5e', '#e8b98a']);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r.range(0, 1);
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.6, s * 0.35, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#f2e2a0';
      g.beginPath();
      g.arc(x, y, s * 0.18, 0, Math.PI * 2);
      g.fill();
    }
    // Quilting stitch lines + wash fading.
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 2;
    for (let i = 0; i < w; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, h);
      g.moveTo(0, i);
      g.lineTo(w, i);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,240,220,0.08)';
    g.fillRect(0, 0, w, h);
  }, { repeat: true });
  tex.repeat.set(2.5, 2.5);
  const base = mat('fabric', { color: 0xffffff, seed: 919 });
  floral = new THREE.MeshStandardMaterial({ map: tex, normalMap: base.normalMap, roughness: 0.95, side: THREE.DoubleSide });
  floral.name = 'bedspread';
  return floral;
}

function keypadMat() {
  return plaqueMat('phone-keypad', 64, 64, (g, w, h) => {
    g.fillStyle = '#d9cfba';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a8070';
    for (let i = 0; i < 12; i++) g.fillRect(10 + (i % 3) * 16, 8 + Math.floor(i / 3) * 13, 11, 9);
  }, { weather: false });
}

function acFrontMat() {
  return plaqueMat('ac-front', 256, 128, (g, w, h) => {
    g.fillStyle = '#d8d0bc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a655a';
    for (let x = 12; x < w - 70; x += 7) g.fillRect(x, 14, 3, h - 28);
    g.fillStyle = '#3a3630';
    g.font = '400 16px "Bebas Neue", sans-serif';
    g.fillText('COOL', w - 58, 36);
    g.fillText('FAN', w - 58, 60);
    g.fillStyle = 'rgba(100,80,40,0.35)';
    g.fillRect(0, h - 18, w, 18);
  });
}

function landscapeMat() {
  return plaqueMat('landscape', 384, 256, (g, w, h) => {
    // Sunset over a lake with mountains and an implausibly large deer — mass-produced oil look.
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, '#5b7fb0');
    sky.addColorStop(0.6, '#e8a36a');
    sky.addColorStop(1, '#f2d39a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4f6a';
    g.beginPath();
    g.moveTo(0, h * 0.55);
    g.lineTo(w * 0.2, h * 0.3);
    g.lineTo(w * 0.35, h * 0.48);
    g.lineTo(w * 0.55, h * 0.22);
    g.lineTo(w * 0.8, h * 0.5);
    g.lineTo(w, h * 0.4);
    g.lineTo(w, h * 0.6);
    g.lineTo(0, h * 0.6);
    g.fill();
    g.fillStyle = '#f4f0f0';
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.27);
    g.lineTo(w * 0.55, h * 0.22);
    g.lineTo(w * 0.6, h * 0.28);
    g.fill();
    g.fillStyle = '#3d6a8a';
    g.fillRect(0, h * 0.6, w, h * 0.2);
    g.fillStyle = 'rgba(255,210,150,0.5)';
    for (let i = 0; i < 9; i++) g.fillRect(w * 0.45 + Math.sin(i) * 10, h * 0.62 + i * 4, 40 - i * 3, 2);
    g.fillStyle = '#2f4a22';
    g.fillRect(0, h * 0.8, w, h * 0.2);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#1f3418';
      g.beginPath();
      const x = 20 + i * 16;
      g.moveTo(x, h * 0.85);
      g.lineTo(x + 8, h * 0.45 + (i % 3) * 10);
      g.lineTo(x + 16, h * 0.85);
      g.fill();
    }
    // Brush texture.
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 8, 1);
    }
  }, { weather: { grime: 0.2, fade: 0.35, rust: 0, scratches: 0.1 } });
}

function fridge(ctx, room, F, { x, z }) {
  const { batch, colliders, physics } = ctx;
  const add = (g, m, o = {}) => batch.add(g, m, { chunk: 'room', ...o });
  const W = 0.5; // along z
  const D = 0.5; // along x (door faces -x)
  const H = 0.84;
  const white = mat('metal-painted', { color: 0xe8e4da, wear: 0.4, dirt: 0.55, seed: 920 });
  const liner = mat('plastic', { color: 0xf1efe8, wear: 0.4, dirt: 0.5, seed: 921 });
  const x0 = x - D / 2 + 0.03;
  // Body: back, sides, top, bottom (open front so the interior shows when the door opens).
  add(new THREE.BoxGeometry(0.03, H, W).translate(x + D / 2 - 0.015, FL + H / 2, z), white, {});
  add(new THREE.BoxGeometry(D - 0.03, H, 0.03).translate(x, FL + H / 2, z - W / 2 + 0.015), white, {});
  add(new THREE.BoxGeometry(D - 0.03, H, 0.03).translate(x, FL + H / 2, z + W / 2 - 0.015), white, {});
  add(new THREE.BoxGeometry(D - 0.03, 0.04, W).translate(x, FL + H - 0.02, z), white, {});
  add(new THREE.BoxGeometry(D - 0.03, 0.06, W).translate(x, FL + 0.03, z), white, {});
  add(new THREE.BoxGeometry(D - 0.08, H - 0.12, W - 0.08).translate(x + 0.02, FL + H / 2, z), liner, {});
  // Wire shelves + freezer box + contents.
  for (const y of [0.32, 0.56]) {
    for (let k = 0; k < 9; k++) add(new THREE.CylinderGeometry(0.003, 0.003, D - 0.1, 4).rotateZ(Math.PI / 2).translate(x, FL + y, z - 0.19 + k * 0.0475), motelMats().galv, {});
  }
  add(new THREE.BoxGeometry(D - 0.12, 0.12, W - 0.1).translate(x + 0.02, FL + H - 0.14, z), liner, { tint: 0xd8e2e6 });
  const can = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 12);
  const canMat = mat('aluminum', { color: 0xc8202a, wear: 0.3, seed: 922 });
  add(can.clone().translate(x - 0.05, FL + 0.32 + 0.062, z - 0.12), canMat, {});
  add(can.clone().translate(x + 0.02, FL + 0.32 + 0.062, z - 0.12), canMat, {});
  add(new THREE.BoxGeometry(0.16, 0.08, 0.14).translate(x, FL + 0.56 + 0.04, z + 0.08), mat('cardboard', { color: 0xf0ece0, seed: 923 }), {});
  add(new THREE.BoxGeometry(0.06, 0.18, 0.06).translate(x - 0.06, FL + 0.32 + 0.09, z + 0.12), mat('plastic', { color: 0xb8291c, seed: 924 }), {});
  colliders.aabb(x - D / 2, FL, z - W / 2, x + D / 2, FL + H, z + W / 2);
  // Interior light (on when the door is open).
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0 }));
  bulb.position.set(x + 0.15, FL + H - 0.25, z - W / 2 + 0.06);
  ctx.extraMeshes.push(bulb);
  // Door: hinged on the north edge, opens toward the room.
  const parts = [
    { geo: new THREE.BoxGeometry(0.05, H - 0.02, W).translate(-0.025, 0, W / 2), mat: white, tint: null },
    { geo: new THREE.BoxGeometry(0.02, H - 0.14, W - 0.08).translate(0.01, 0, W / 2), mat: liner, tint: 0xe2e0d8 },
    { geo: new THREE.BoxGeometry(0.03, 0.2, 0.025).translate(-0.065, 0.12, W - 0.04), mat: F.black, tint: null },
    // Door shelf with a mustard bottle.
    { geo: new THREE.BoxGeometry(0.06, 0.05, W - 0.1).translate(0.05, -0.15, W / 2), mat: liner, tint: 0xd8d6cc },
    { geo: new THREE.CylinderGeometry(0.022, 0.025, 0.14, 10).translate(0.05, -0.08, W / 2 - 0.1), mat: mat('plastic', { color: 0xe8b520, seed: 925 }), tint: null },
  ];
  const door = partsToGroup(parts);
  const pivot = new THREE.Group();
  pivot.position.set(x0 - 0.03, FL + H / 2, z - W / 2);
  pivot.add(door);
  ctx.extraMeshes.push(pivot);
  const it = movable({
    id: 'fridge-door', kind: 'hinge', object: pivot, axis: 'y', limits: [0, -1.75], physics, speed: 2.6,
    box: { size: [0.05, H - 0.02, W], offset: [-0.025, 0, W / 2] }, sounds: { open: 'fridge.open', close: 'fridge.close' }, label: 'motel.it.fridge',
    onChange: (v) => {
      bulb.material.emissiveIntensity = v > 0.05 ? 2.5 : 0;
    },
  });
  it._room = true;
  ctx.interactables.push(it);
  room.fridge = it;
  // Microwave on top.
  const mwM = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(x + 0.02, FL + H, z);
  add(new THREE.BoxGeometry(0.46, 0.27, 0.34).translate(0, 0.135, 0), white, { matrix: mwM, tint: 0xd8d4ca });
  add(new THREE.PlaneGeometry(0.3, 0.2).translate(-0.06, 0.135, 0.171), mat('plastic', { color: 0x15130f, wear: 0.3, seed: 926 }), { matrix: mwM });
  add(new THREE.PlaneGeometry(0.08, 0.2).translate(0.17, 0.135, 0.171), keypadMat(), { matrix: mwM, uv: 'keep' });
  colliders.aabb(x - 0.17, FL + H, z - 0.23, x + 0.21, FL + H + 0.27, z + 0.23);
}
