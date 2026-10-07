// Player-room bathroom (x 205.8..207.9, z -53.7..-51.6) + the closet nook beside it.
// Mint 1970s wall tile with grimy grout, beige floor tile, a tub/shower with a mildewed curtain,
// toilet (seat up, of course), vanity with a cultured-marble top, a real MIRROR (Reflector on tier
// medium+, metallic fallback on low), a three-bulb vanity bar, wrapped soaps, towels, an exhaust fan
// that comes on with the light. Interactables: bathroom door, light switch, shower, faucet, flush.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { audio } from '../../core/audio.js';
import { Rng } from '../../core/rng.js';
import { RI } from './layout.js';
import { motelMats, plaqueMat } from './mats.js';
import { partsToGroup } from './doors.js';
import { movable, switcher } from './interact.js';

const FL = RI.fl;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const X0 = RI.bx; // 205.8
const X1 = RI.x1; // 207.9
const Z0 = RI.zb; // -53.7
const Z1 = RI.zp - 0.1; // -51.6

export function buildBath(ctx, room) {
  const { batch, colliders, physics, tier } = ctx;
  const M = motelMats();
  const rng = new Rng('starlite-bath');
  const add = (g, m, o = {}) => batch.add(g, m, { chunk: 'room', ...o });
  const wallTile = mat('tile-bathroom', { color: 0xbcd6c4, wear: 0.5, dirt: 0.55, count: 5, seed: 931 });
  const floorTile = mat('tile-bathroom', { color: 0xd8c9ad, wear: 0.6, dirt: 0.65, count: 10, seed: 932 });
  const enamel = mat('plastic', { color: 0xf1eee4, wear: 0.35, dirt: 0.55, seed: 933 });
  const chrome = mat('chrome', { wear: 0.6, dirt: 0.55, seed: 934 });
  const H = RI.ceil - FL;

  // ---- Floor + wall tile ----------------------------------------------------------------------------
  add(new THREE.BoxGeometry(X1 - X0, 0.02, Z1 - Z0).translate((X0 + X1) / 2, FL - 0.005, (Z0 + Z1) / 2), floorTile, { castShadow: false });
  const tileH = 1.5; // tile wainscot (higher in the tub)
  const wl = (x0, z0, x1, z1, y0, y1) => add(new THREE.BoxGeometry(Math.max(0.012, x1 - x0), y1 - y0, Math.max(0.012, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), wallTile, {});
  wl(X0, Z0, X0 + 0.012, Z1, FL, FL + tileH);
  wl(X1 - 0.012, Z0, X1, Z1, FL, FL + tileH);
  wl(X0, Z0, X1, Z0 + 0.012, FL, FL + 1.95); // tub surround
  wl(X0, Z1 - 0.012, RI.bathDoor.x0, Z1, FL, FL + tileH);
  wl(RI.bathDoor.x1, Z1 - 0.012, X1, Z1, FL, FL + tileH);
  // Tub surround runs up the side walls too.
  wl(X0, Z0, X0 + 0.014, Z0 + 0.76, FL, FL + 1.95);
  wl(X1 - 0.014, Z0, X1, Z0 + 0.76, FL, FL + 1.95);
  // Bullnose cap on the tile edge.
  for (const [x0, z0, x1, z1] of [[X0, Z0 + 0.76, X0 + 0.02, Z1], [X1 - 0.02, Z0 + 0.76, X1, Z1]]) add(new THREE.BoxGeometry(x1 - x0, 0.03, z1 - z0).translate((x0 + x1) / 2, FL + tileH, (z0 + z1) / 2), wallTile, { tint: 0xd8e8dc });
  // Painted (steamed, peeling) drywall above the tile.
  const paint = mat('drywall', { color: 0xe8e4d6, wear: 0.6, dirt: 0.7, seed: 935 });
  for (const [x0, z0, x1, z1] of [[X0, Z0 + 0.76, X0 + 0.01, Z1], [X1 - 0.01, Z0 + 0.76, X1, Z1], [X0, Z1 - 0.01, X1, Z1]]) add(new THREE.BoxGeometry(x1 - x0, H - tileH - 0.01, z1 - z0).translate((x0 + x1) / 2, FL + tileH + (H - tileH) / 2, (z0 + z1) / 2), paint, {});
  // Mildew along the grout at the tub and the floor.
  for (let i = 0; i < 6; i++) ctx.decals.push({ kind: 'grime', position: V(rng.range(X0 + 0.2, X1 - 0.2), FL + 0.003, rng.range(Z0 + 0.8, Z1 - 0.2)), size: rng.range(0.25, 0.5), opacity: 0.5 });
  ctx.decals.push({ kind: 'streak', position: V(206.9, FL + 1.6, Z0 + 0.014), normal: V(0, 0, 1), size: [0.9, 0.9], rotation: Math.PI, opacity: 0.55 });

  // ---- Tub (enamelled steel, rust ring at the drain) -------------------------------------------------
  const tz0 = Z0;
  const tz1 = Z0 + 0.75;
  const th = 0.48;
  add(new THREE.BoxGeometry(X1 - X0, th, 0.06).translate((X0 + X1) / 2, FL + th / 2, tz1 - 0.03), enamel, {});
  add(new THREE.BoxGeometry(X1 - X0, 0.05, tz1 - tz0).translate((X0 + X1) / 2, FL + 0.08, (tz0 + tz1) / 2), enamel, {});
  add(new THREE.BoxGeometry(X1 - X0, 0.04, 0.08).translate((X0 + X1) / 2, FL + th - 0.02, tz0 + 0.04), enamel, {});
  for (const x of [X0 + 0.04, X1 - 0.04]) add(new THREE.BoxGeometry(0.08, th, tz1 - tz0).translate(x, FL + th / 2, (tz0 + tz1) / 2), enamel, {});
  colliders.aabb(X0, FL, tz1 - 0.07, X1, FL + th, tz1);
  colliders.aabb(X0, FL, tz0, X1, FL + 0.1, tz1);
  ctx.decals.push({ kind: 'grime', position: V(X1 - 0.35, FL + 0.106, (tz0 + tz1) / 2), size: 0.35, opacity: 0.85 });
  ctx.decals.push({ kind: 'oil', position: V(X1 - 0.3, FL + 0.107, (tz0 + tz1) / 2), size: 0.12, opacity: 0.6 });
  // Shower: head on the east wall, valve, spout.
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8).rotateZ(Math.PI / 2).translate(X1 - 0.12, FL + 1.85, (tz0 + tz1) / 2), chrome, {});
  add(new THREE.CylinderGeometry(0.045, 0.03, 0.06, 14).rotateZ(Math.PI / 2 - 0.5).translate(X1 - 0.25, FL + 1.82, (tz0 + tz1) / 2), chrome, {});
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14).rotateZ(Math.PI / 2).translate(X1 - 0.01, FL + 1.0, (tz0 + tz1) / 2), chrome, {});
  add(new THREE.BoxGeometry(0.12, 0.03, 0.04).translate(X1 - 0.07, FL + 0.6, (tz0 + tz1) / 2), chrome, {});
  // Curtain rod + vinyl curtain, half drawn, mildew at the hem.
  add(new THREE.CylinderGeometry(0.011, 0.011, X1 - X0, 8).rotateZ(Math.PI / 2).translate((X0 + X1) / 2, FL + 1.98, tz1 - 0.12), chrome, {});
  const curtain = new THREE.PlaneGeometry(1.2, 1.55, 24, 4);
  const cp = curtain.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 26) * 0.03);
  curtain.computeVertexNormals();
  add(curtain.translate(X1 - 0.62, FL + 1.97 - 0.78, tz1 - 0.12), showerCurtainMat(), { uv: 'keep' });
  // Shower water: a cone of streaks shown while running.
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.22, 1.7, 16, 1, true), waterMat());
  water.position.set(X1 - 0.35, FL + 0.95, (tz0 + tz1) / 2);
  water.visible = false;
  ctx.extraMeshes.push(water);
  let showerSnd = null;
  const shower = switcher({
    id: 'shower', object: water, physics: null, label: 'motel.it.shower', sound: 'ui.toggle',
    onToggle: (on) => {
      water.visible = on;
      if (on) showerSnd = safePlay('amb.rain', { loop: true, gain: 0.55, rate: 1.6, position: water.position });
      else showerSnd?.stop?.(0.3);
    },
  });
  ctx.interactables.push(shower);

  // ---- Toilet (west wall, facing east; seat up) -------------------------------------------------------
  const tx = X0 + 0.02;
  const tzc = -52.25;
  const bowl = new THREE.LatheGeometry([[0.0, 0], [0.11, 0], [0.12, 0.1], [0.15, 0.28], [0.19, 0.39], [0.18, 0.41], [0.14, 0.4]].map(([a, b]) => new THREE.Vector2(a, b)), 20).scale(1.0, 1, 1.25);
  add(bowl.rotateY(Math.PI / 2).translate(tx + 0.42, FL, tzc), enamel, {});
  add(new THREE.BoxGeometry(0.2, 0.36, 0.46).translate(tx + 0.1, FL + 0.58, tzc), enamel, {});
  add(new THREE.BoxGeometry(0.22, 0.03, 0.48).translate(tx + 0.1, FL + 0.775, tzc), enamel, {});
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8).rotateZ(Math.PI / 2).translate(tx + 0.22, FL + 0.7, tzc - 0.16), chrome, {});
  // Seat + lid, both up against the tank.
  const seat = new THREE.TorusGeometry(0.15, 0.025, 6, 20).scale(1, 1.2, 1).rotateY(Math.PI / 2).translate(tx + 0.24, FL + 0.6, tzc);
  add(seat, mat('plastic', { color: 0xe9e2d0, seed: 936 }), {});
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20).scale(1, 1, 1.2).rotateZ(Math.PI / 2 - 0.15).translate(tx + 0.22, FL + 0.62, tzc), mat('plastic', { color: 0xe9e2d0, seed: 936 }), {});
  colliders.aabb(X0, FL, tzc - 0.25, X0 + 0.62, FL + 0.42, tzc + 0.25);
  colliders.aabb(X0, FL, tzc - 0.24, X0 + 0.22, FL + 0.8, tzc + 0.24);
  const handle = new THREE.Object3D();
  handle.position.set(tx + 0.22, FL + 0.7, tzc - 0.16);
  ctx.extraMeshes.push(handle);
  const flush = switcher({
    id: 'toilet-flush', object: handle, physics: null, label: 'motel.it.toilet', sound: null,
    onToggle: () => {
      safePlay('toilet.flush', { gain: 0.8, position: handle.position });
      flush.on = false; // momentary
    },
  });
  ctx.interactables.push(flush);
  // Toilet paper on the wall, three squares hanging.
  add(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 16).rotateX(Math.PI / 2).translate(X0 + 0.07, FL + 0.68, tzc + 0.38), mat('paper', { color: 0xf2efe6, seed: 937 }), {});
  add(new THREE.PlaneGeometry(0.1, 0.22).translate(0, -0.11, 0).rotateY(Math.PI / 2).translate(X0 + 0.125, FL + 0.66, tzc + 0.38), mat('paper', { color: 0xf2efe6, seed: 937 }), {});

  // ---- Vanity + sink + mirror (east wall) ---------------------------------------------------------------
  const vz = -52.25;
  const vx0 = X1 - 0.52;
  add(new THREE.BoxGeometry(0.5, 0.78, 0.72).translate(X1 - 0.26, FL + 0.39, vz), mat('wood', { color: 0x8a6a48, wear: 0.7, dirt: 0.6, seed: 938 }), { grime: 0.6, grimeBase: FL });
  const marble = mat('plastic', { color: 0xe8dcc6, wear: 0.5, dirt: 0.55, seed: 939 });
  add(new THREE.BoxGeometry(0.54, 0.035, 0.76).translate(X1 - 0.27, FL + 0.8, vz), marble, {});
  const basin = new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.5, 1.3);
  add(basin.translate(X1 - 0.26, FL + 0.815, vz), enamel, { castShadow: false });
  add(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 8).translate(X1 - 0.07, FL + 0.87, vz), chrome, {});
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8).rotateZ(Math.PI / 2).translate(X1 - 0.12, FL + 0.92, vz), chrome, {});
  for (const dz of [-0.11, 0.11]) add(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6).translate(X1 - 0.07, FL + 0.84, vz + dz), chrome, {});
  colliders.aabb(vx0, FL, vz - 0.38, X1, FL + 0.82, vz + 0.38);
  // Tiny wrapped soaps + a plastic cup.
  const soap = plaqueMat('soap-wrap', 64, 64, (g, w, h) => {
    g.fillStyle = '#f4efe2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8202a';
    g.font = '700 italic 14px "Playfair Display", serif';
    g.textAlign = 'center';
    g.fillText('Starlite', w / 2, h / 2 + 5);
  }, { weather: false });
  add(new THREE.BoxGeometry(0.06, 0.018, 0.04).translate(X1 - 0.43, FL + 0.827, vz + 0.27), soap, {});
  add(new THREE.BoxGeometry(0.06, 0.018, 0.04).rotateY(0.4).translate(X1 - 0.41, FL + 0.845, vz + 0.24), soap, {});
  add(new THREE.CylinderGeometry(0.035, 0.028, 0.09, 12, 1, true).translate(X1 - 0.43, FL + 0.862, vz - 0.27), mat('plastic', { color: 0xf0f0f0, seed: 940 }), { castShadow: false });
  // Mirror: frame + reflective plane (+ desilvered edges overlay).
  const mw = 0.62;
  const mh = 0.82;
  const my = FL + 1.42;
  add(new THREE.BoxGeometry(0.03, mh + 0.05, mw + 0.05).translate(X1 - 0.015, my, vz), chrome, {});
  let mirror;
  const res = tier?.mirrorRes ?? 0;
  if (res > 0) {
    mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: res, textureHeight: Math.round((res * mh) / mw), color: 0xa9adaa, clipBias: 0.003, multisample: 0 });
    mirror.name = 'bath-mirror';
  } else {
    mirror = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), mat('mirror', { color: 0xb9bfbd }));
  }
  mirror.position.set(X1 - 0.032, my, vz);
  mirror.rotation.y = -Math.PI / 2;
  ctx.extraMeshes.push(mirror);
  const spots = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), desilverMat());
  spots.position.set(X1 - 0.034, my, vz);
  spots.rotation.y = -Math.PI / 2;
  spots.renderOrder = 2;
  ctx.extraMeshes.push(spots);
  room.mirror = mirror;
  // Vanity bar with three globe bulbs (one dead) → the bathroom's one real light.
  add(new THREE.BoxGeometry(0.05, 0.08, 0.6).translate(X1 - 0.025, my + 0.52, vz), chrome, {});
  const globeOn = new THREE.MeshStandardMaterial({ color: 0xf6f0e2, emissive: 0xfff0d8, emissiveIntensity: 0, roughness: 0.4 });
  globeOn.name = 'vanity-globe';
  const globeDead = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.4 });
  for (const [i, dz] of [[0, -0.2], [1, 0], [2, 0.2]]) {
    const gm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), i === 2 ? globeDead : globeOn);
    gm.position.set(X1 - 0.07, my + 0.52, vz + dz);
    ctx.extraMeshes.push(gm);
  }
  const bathLight = new THREE.PointLight(0xfff0d8, 0, 5, 1.8);
  bathLight.position.set(X1 - 0.8, my + 0.4, vz);
  ctx.extraMeshes.push(bathLight);
  room.lights.bath = bathLight;
  // Exhaust fan grille in the ceiling (dusty) — runs with the light.
  add(new THREE.BoxGeometry(0.26, 0.01, 0.26).translate(206.5, RI.ceil - 0.005, -52.8), fanGrilleMat(), { uv: 'keep' });
  let fanSnd = null;
  const sw = room.switchPlates.bath;
  const setBath = (on) => {
    bathLight.intensity = on ? 5 : 0;
    globeOn.emissiveIntensity = on ? 0.8 : 0;
    sw.userData.toggle.rotation.x = on ? -0.35 : 0.35;
    if (on) fanSnd = safePlay('ac.rattle', { loop: true, gain: 0.18, rate: 1.7, position: V(206.5, RI.ceil, -52.8) });
    else fanSnd?.stop?.(0.2);
  };
  const bathSwitch = switcher({ id: 'bath-light-switch', object: sw, physics, box: { size: [0.08, 0.12, 0.03] }, label: 'motel.it.switch', start: false, onToggle: setBath });
  setBath(false);
  ctx.interactables.push(bathSwitch);
  room.switches.bath = bathSwitch;
  // Faucet.
  const faucetObj = new THREE.Object3D();
  faucetObj.position.set(X1 - 0.12, FL + 0.92, vz);
  ctx.extraMeshes.push(faucetObj);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.1, 8, 1, true), waterMat());
  stream.position.set(X1 - 0.18, FL + 0.87, vz);
  stream.visible = false;
  ctx.extraMeshes.push(stream);
  let sinkSnd = null;
  const sink = switcher({
    id: 'sink', object: faucetObj, physics: null, label: 'motel.it.sink', sound: 'ui.toggle',
    onToggle: (on) => {
      stream.visible = on;
      if (on) sinkSnd = safePlay('amb.rain', { loop: true, gain: 0.25, rate: 2.2, position: faucetObj.position });
      else sinkSnd?.stop?.(0.2);
    },
  });
  ctx.interactables.push(sink);
  // Towel bar on the partition (inside), two thin towels, one already on the floor (clutter).
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8).rotateZ(Math.PI / 2).translate(207.4, FL + 1.1, Z1 - 0.06), chrome, {});
  const towel = mat('fabric', { color: 0xf0ece2, wear: 0.6, dirt: 0.55, seed: 941 });
  const tg = new THREE.PlaneGeometry(0.42, 0.7, 4, 6);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin(tp.getX(i) * 18) * 0.008 + (tp.getY(i) > 0.3 ? 0.02 : 0));
  tg.computeVertexNormals();
  add(tg.translate(207.45, FL + 0.78, Z1 - 0.07), towel, {});

  // ---- Bathroom door (hollow-core, hinged east, swings out into the bedroom) --------------------------
  const B = RI.bathDoor;
  const bw = B.x1 - B.x0 - 0.01;
  const dparts = [
    { geo: new THREE.BoxGeometry(bw, B.h - 0.01, 0.035).translate(-bw / 2, (B.h - 0.01) / 2, 0), mat: mat('painted-wood', { color: 0xffffff, wear: 0.25, dirt: 0.45, seed: 942 }), tint: 0xe2d8c2 },
    { geo: new THREE.SphereGeometry(0.028, 12, 8).translate(-bw + 0.07, 0.98, 0.04), mat: chrome, tint: null },
    { geo: new THREE.SphereGeometry(0.028, 12, 8).translate(-bw + 0.07, 0.98, -0.04), mat: chrome, tint: null },
  ];
  const dg = partsToGroup(dparts);
  const pivot = new THREE.Group();
  pivot.position.set(B.x1 - 0.005, FL, RI.zp - 0.05);
  pivot.add(dg);
  ctx.extraMeshes.push(pivot);
  const bdoor = movable({
    id: 'bath-door', kind: 'hinge', object: pivot, axis: 'y', limits: [0, 1.45], start: 0.55, physics, speed: 2.2,
    box: { size: [bw, B.h, 0.035], offset: [-bw / 2, B.h / 2, 0] }, sounds: { open: 'door.creak', close: 'door.close' }, label: 'motel.it.bathDoor',
  });
  bdoor._room = true;
  ctx.interactables.push(bdoor);
  room.bathDoor = bdoor;

  // ---- Closet nook (x 204.1..205.7): shelf, rod, wire hangers, a spare blanket ------------------------
  const cx0 = RI.x0;
  const cx1 = RI.bx - 0.1;
  add(new THREE.BoxGeometry(cx1 - cx0, 0.02, 0.4).translate((cx0 + cx1) / 2, FL + 1.75, Z0 + 0.22), mat('wood', { color: 0xd8d0bc, seed: 943 }), {});
  add(new THREE.CylinderGeometry(0.012, 0.012, cx1 - cx0, 8).rotateZ(Math.PI / 2).translate((cx0 + cx1) / 2, FL + 1.65, Z0 + 0.3), chrome, {});
  const wire = motelMats().galv;
  for (let i = 0; i < 5; i++) {
    const hx = cx0 + 0.25 + i * 0.24 + rng.range(-0.04, 0.04);
    // Wire hanger: a triangle in the plane across the rod, hooked over it.
    const zc = Z0 + 0.3;
    const curve = new THREE.CatmullRomCurve3([V(hx, FL + 1.45, zc - 0.2), V(hx, FL + 1.6, zc), V(hx, FL + 1.45, zc + 0.2)], true, 'catmullrom', 0.1);
    add(new THREE.TubeGeometry(curve, 18, 0.002, 3, true), wire, { castShadow: false });
    add(new THREE.TorusGeometry(0.018, 0.002, 3, 8, Math.PI * 1.4).rotateY(Math.PI / 2).translate(hx, FL + 1.65, zc), wire, { castShadow: false });
  }
  add(new THREE.BoxGeometry(0.55, 0.16, 0.36).translate(cx0 + 0.45, FL + 1.84, Z0 + 0.22), mat('fabric', { color: 0x6a5a8a, seed: 944 }), {});
  // Closet light: a bare bulb on a pull chain (interactable).
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe2a8, emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), bulbMat);
  bulb.position.set((cx0 + cx1) / 2, RI.ceil - 0.08, (Z0 + Z1) / 2);
  ctx.extraMeshes.push(bulb);
  add(new THREE.CylinderGeometry(0.001, 0.001, 0.5, 3).translate((cx0 + cx1) / 2 + 0.03, RI.ceil - 0.33, (Z0 + Z1) / 2), wire, { castShadow: false });
  const closet = switcher({
    id: 'closet-light', object: bulb, physics: null, label: 'motel.it.closet', start: false,
    onToggle: (on) => {
      bulbMat.emissiveIntensity = on ? 3 : 0;
    },
  });
  ctx.interactables.push(closet);

  // ---- Runtime: the mirror only renders when someone could see it -----------------------------------
  const bathBox = new THREE.Box3(V(RI.x0 - 0.2, FL - 0.5, Z0 - 0.2), V(RI.x1 + 0.2, RI.ceil + 0.5, -48.5));
  room.fx.push((dt, state, near, clock) => {
    if (mirror.isReflector) mirror.visible = near && bathBox.containsPoint(ctx.viewer || V(0, -99, 0));
    water.visible && (water.material.map.offset.y -= dt * 3.5);
    stream.visible && (stream.material.map.offset.y -= dt * 4);
    void clock;
  });
}

function safePlay(name, o) {
  try {
    const p = o.position;
    return audio.play(name, { bus: 'sfx', ...o, position: p ? { x: p.x, y: p.y, z: p.z } : undefined });
  } catch {
    return null;
  }
}

function showerCurtainMat() {
  const tex = canvasTexture('shower-curtain', 256, 256, (g, w, h) => {
    g.fillStyle = 'rgba(232,236,232,0.92)';
    g.fillRect(0, 0, w, h);
    // Seashell print, faded.
    g.fillStyle = 'rgba(110,170,180,0.55)';
    for (let i = 0; i < 18; i++) {
      const x = (i % 5) * 56 + ((i / 5) | 0) % 2 * 28;
      const y = ((i / 5) | 0) * 64 + 20;
      g.beginPath();
      g.arc(x, y, 12, Math.PI, 0);
      g.lineTo(x, y + 12);
      g.fill();
    }
    // Mildew creeping up from the hem.
    const grd = g.createLinearGradient(0, h, 0, h * 0.7);
    grd.addColorStop(0, 'rgba(70,60,40,0.75)');
    grd.addColorStop(1, 'rgba(70,60,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, h * 0.7, w, h * 0.3);
    // Grommets.
    g.fillStyle = 'rgba(160,160,160,1)';
    for (let x = 10; x < w; x += 24) g.fillRect(x, 4, 6, 6);
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, side: THREE.DoubleSide, depthWrite: false });
  m.name = 'shower-curtain';
  return m;
}

function waterMat() {
  const tex = canvasTexture('water-streaks', 64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(220,235,255,${Math.random() * 0.6})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1, 6 + Math.random() * 30);
    }
  }, { repeat: true });
  const m = new THREE.MeshBasicMaterial({ map: tex.clone(), transparent: true, depthWrite: false, opacity: 0.6, side: THREE.DoubleSide });
  m.map.needsUpdate = true;
  m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
  m.name = 'water';
  return m;
}

function desilverMat() {
  const tex = canvasTexture('mirror-desilver', 256, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = new Rng('desilver');
    // Black spots creeping in from the edges + toothpaste flecks + a hazy wipe mark.
    for (let i = 0; i < 90; i++) {
      const edge = r.int(0, 3);
      const x = edge === 0 ? r.range(0, 14) : edge === 1 ? w - r.range(0, 14) : r.range(0, w);
      const y = edge === 2 ? h - r.range(0, 18) : edge === 3 ? r.range(0, 10) : r.range(0, h);
      g.fillStyle = `rgba(20,18,14,${r.range(0.2, 0.8)})`;
      g.beginPath();
      g.arc(x, y, r.range(0.8, 3.2), 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 22; i++) {
      g.fillStyle = `rgba(240,240,235,${r.range(0.12, 0.35)})`;
      g.beginPath();
      g.arc(r.range(w * 0.3, w * 0.7), r.range(h * 0.55, h * 0.95), r.range(0.8, 2), 0, Math.PI * 2);
      g.fill();
    }
  });
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  m.name = 'mirror-desilver';
  return m;
}

function fanGrilleMat() {
  return plaqueMat('fan-grille', 128, 128, (g, w, h) => {
    g.fillStyle = '#e8e4da';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a463e';
    for (let y = 14; y < h - 10; y += 8) g.fillRect(12, y, w - 24, 4);
    g.fillStyle = 'rgba(90,80,60,0.6)';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  });
}
