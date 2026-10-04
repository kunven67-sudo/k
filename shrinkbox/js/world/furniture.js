// Furniture + appliances for the rest of the house. Real sizes; things with real insides
// (toilet tank, fridge, pot, microwave, washer, car engine) are hollow where they're hollow.
import * as THREE from 'three';
import { Thing, panel, tubeWall, coneWall, diskStrips, lathe, grille } from './thing.js';
import { colorMat, defMat, drawTexture } from '../core/materials.js';
import { FLOORS } from './house.js';
import { sfx, loop, vol3d } from '../core/audio.js';

const G = FLOORS.ground, B = FLOORS.base;
const C = (c, r = 0.6, m = 0) => colorMat(c, r, m);
const mk = (game, name, pos, rotY, build, o = {}) => { const t = new Thing({ name, pos, rot: [0, rotY, 0], ...o }); build(t); t.build(game.engine.scene); return t; };

// ---------------- generic furniture ----------------
function bed(t, w, l, frame = 'deskWood', sheet = 'sheet', blanket = 'blanket') {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box([0.07, 0.3, 0.07], [sx * (w / 2 - 0.035), 0.15, sz * (l / 2 - 0.035)], frame);
  t.box([w, 0.1, 0.04], [0, 0.26, l / 2 - 0.02], frame); t.box([0.04, 0.1, l], [-w / 2 + 0.02, 0.26, 0], frame); t.box([0.04, 0.1, l], [w / 2 - 0.02, 0.26, 0], frame);
  t.box([w, 1.1, 0.06], [0, 0.6, -l / 2 + 0.03], frame);
  t.rbox([w - 0.05, 0.28, l - 0.08], [0, 0.45, 0.01], 'mattress', 0.05);
  t.rbox([w, 0.025, l - 0.45], [0, 0.6, 0.2], blanket, 0.012);
  for (const sx of [-1, 1]) t.rbox([0.025, 0.26, l - 0.45], [sx * (w / 2 - 0.006), 0.48, 0.2], blanket, 0.01);
  t.rbox([w - 0.04, 0.012, 0.45], [0, 0.596, -l / 2 + 0.28], sheet, 0.005);
  for (const sx of (w > 1.6 ? [-0.45, 0.45] : [0])) t.rbox([0.62, 0.14, 0.42], [sx, 0.67, -l / 2 + 0.3], 'pillow', 0.06);
}
function table(t, w, d, h, m = 'lightWood', leg = 0.05) {
  t.box([w, 0.035, d], [0, h - 0.0175, 0], m);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box([leg, h - 0.035, leg], [sx * (w / 2 - leg), (h - 0.035) / 2, sz * (d / 2 - leg)], m);
}
function cabinet(t, w, h, d, m = 'lightWood', doors = 2) {
  t.box([w, 0.02, d], [0, h - 0.01, 0], m); t.box([w, 0.02, d], [0, 0.06, 0], m);
  t.box([0.02, h, d], [-w / 2 + 0.01, h / 2, 0], m); t.box([0.02, h, d], [w / 2 - 0.01, h / 2, 0], m);
  t.box([w, h, 0.015], [0, h / 2, -d / 2 + 0.0075], m);
  for (let i = 0; i < doors; i++) { const dw = w / doors; t.box([dw - 0.006, h - 0.08, 0.018], [-w / 2 + dw * (i + 0.5), h / 2 + 0.02, d / 2], m); t.cyl(0.008, 0.02, [-w / 2 + dw * (i + 0.5) + (i % 2 ? -1 : 1) * dw * 0.35, h * 0.7, d / 2 + 0.015], 'chrome', { rot: [Math.PI / 2, 0, 0], collide: false }); }
}
function couch(t, w, color) {
  const f = defMat('couch' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  t.rbox([w, 0.2, 0.9], [0, 0.22, 0], f, 0.05);                      // base
  t.rbox([w, 0.55, 0.2], [0, 0.55, -0.35], f, 0.08);                 // back
  t.rbox([0.18, 0.4, 0.9], [-w / 2 + 0.09, 0.45, 0], f, 0.07); t.rbox([0.18, 0.4, 0.9], [w / 2 - 0.09, 0.45, 0], f, 0.07);
  const n = Math.round((w - 0.36) / 0.62), cw = (w - 0.36) / n;
  // seat cushions with real gaps between them (coins + crumbs fall in there)
  for (let i = 0; i < n; i++) t.rbox([cw - 0.012, 0.16, 0.66], [-w / 2 + 0.18 + cw * (i + 0.5), 0.4, 0.08], f, 0.05);
  for (let i = 0; i < n; i++) t.rbox([cw - 0.02, 0.4, 0.16], [-w / 2 + 0.18 + cw * (i + 0.5), 0.66, -0.2], f, 0.07, { rot: [-0.15, 0, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.cyl(0.025, 0.12, [sx * (w / 2 - 0.08), 0.06, sz * 0.36], 'darkAlu');
}
function shelf(t, w, h, d, rows, m = 'lightWood') {
  t.box([0.02, h, d], [-w / 2 + 0.01, h / 2, 0], m); t.box([0.02, h, d], [w / 2 - 0.01, h / 2, 0], m); t.box([w, h, 0.01], [0, h / 2, -d / 2 + 0.005], m);
  for (let i = 0; i <= rows; i++) t.box([w, 0.02, d], [0, 0.04 + i * (h - 0.06) / rows, 0], m);
}
function books(t, x0, x1, y, z, d, seed = 1) {
  let x = x0, k = seed;
  const cols = [0x8a2f2f, 0x2f4f8a, 0x2f7a4a, 0xc9a227, 0x5a3a7a, 0x222222, 0xd9d2c0, 0x8a5a2f];
  while (x < x1 - 0.03) { k = (k * 9301 + 49297) % 233280; const w = 0.02 + (k % 30) / 1000, h = 0.18 + (k % 70) / 1000; t.box([w, h, d], [x + w / 2, y + h / 2, z], C(cols[k % cols.length], 0.8)); x += w + 0.002; }
}
function lamp(game, x, y, z) {
  mk(game, 'floor lamp', [x, y, z], 0, (t) => {
    t.cyl(0.14, 0.03, [0, 0.015, 0], 'darkAlu'); t.cyl(0.012, 1.5, [0, 0.77, 0], 'darkAlu');
    t.geo(lathe([[0.22, 0], [0.15, 0.3]], 32), [0, 1.45, 0], defMat('shade'), { collide: false });
  });
}

// ---------------- toilet (real tank parts) ----------------
function toilet(game, x, y, z, rotY) {
  const porcelain = 'porcelain';
  const t = mk(game, 'Toilet', [x, y, z], rotY, (t) => {
    // bowl: a real hollow bowl with the water at the bottom
    t.geo(lathe([[0.12, 0], [0.13, 0.12], [0.19, 0.3], [0.2, 0.4], [0.19, 0.41], [0.16, 0.38], [0.14, 0.3], [0.06, 0.22], [0.04, 0.12]], 40), [0, 0, 0.08], porcelain, { collide: false });
    coneWall(t, { r0: 0.13, y0: 0.0, r1: 0.2, y1: 0.4, thick: 0.02, x: 0, z: 0.08, seg: 24 });
    coneWall(t, { r0: 0.04, y0: 0.12, r1: 0.16, y1: 0.38, thick: 0.01, x: 0, z: 0.08, seg: 20 });
    t.cyl(0.11, 0.004, [0, 0.2, 0.08], defMat('toiletWater', () => new THREE.MeshPhysicalMaterial({ color: 0xd6ecf0, roughness: 0.02, transmission: 0.85, thickness: 0.05, transparent: true, opacity: 0.55 })), { collide: false });
    t.cyl(0.04, 0.12, [0, 0.06, 0.08], porcelain, { collide: false });
    // seat + lid (lid up)
    t.geo(new THREE.TorusGeometry(0.17, 0.022, 10, 36).rotateX(Math.PI / 2).scale(1, 1, 1.18), [0, 0.425, 0.1], C(0xf2f2ee, 0.3), { collide: 'hull', visual: true });
    t.rbox([0.36, 0.42, 0.02], [0, 0.65, -0.12], C(0xf2f2ee, 0.3), 0.01, { rot: [-0.15, 0, 0] });
    // tank: hollow, with the lid on top (cutter can take the lid off)
    const tw = 0.48, th = 0.36, td = 0.19, ty = 0.4;
    t.box([tw, 0.02, td], [0, ty + 0.01, -0.22], porcelain);
    t.box([tw, th, 0.02], [0, ty + th / 2, -0.22 + td / 2 - 0.01], porcelain); t.box([tw, th, 0.02], [0, ty + th / 2, -0.22 - td / 2 + 0.01], porcelain);
    t.box([0.02, th, td], [-tw / 2 + 0.01, ty + th / 2, -0.22], porcelain); t.box([0.02, th, td], [tw / 2 - 0.01, ty + th / 2, -0.22], porcelain);
    t.rbox([tw + 0.02, 0.03, td + 0.02], [0, ty + th + 0.015, -0.22], porcelain, 0.008, { cut: 'tank lid' });
    // inside the tank: water, fill valve with float cup, flapper, overflow tube, chain, handle
    t.box([tw - 0.04, 0.24, td - 0.04], [0, ty + 0.14, -0.22], defMat('toiletWater'), { collide: false });
    t.cyl(0.012, 0.3, [-0.16, ty + 0.17, -0.22], C(0x6a6f78, 0.5)); t.cyl(0.03, 0.06, [-0.16, ty + 0.22, -0.22], C(0x30343a, 0.5));
    t.cyl(0.013, 0.26, [0.06, ty + 0.15, -0.22], C(0x6a6f78, 0.5));
    t.cyl(0.04, 0.012, [0.0, ty + 0.03, -0.22], C(0xb03a2e, 0.7));
    t.box([0.003, 0.18, 0.003], [0.0, ty + 0.15, -0.22], 'steel', { collide: false });
    t.box([0.1, 0.012, 0.012], [0.16, ty + 0.3, -0.22 + td / 2 + 0.01], 'chrome', { collide: false });
  }, { surface: 'ceramic' });
  t.material = 'glass'; t.dirt = 0.7;
  game.interactables.push({ name: 'Flush', thing: t, local: new THREE.Vector3(0.18, 0.7, -0.12), radius: 0.06, use: () => { game.flush?.(t); } });
  return t;
}

// ---------------- kitchen ----------------
function counterRun(game, x0, x1, z, y, back = -1) {
  // base cabinets + a counter top (stone)
  const w = x1 - x0, d = 0.62;
  const stone = 'granite';
  mk(game, 'counter', [(x0 + x1) / 2, y, z], back > 0 ? Math.PI : 0, (t) => {
    cabinet(t, w, 0.87, d - 0.03, C(0xe9e4d8, 0.5), Math.max(1, Math.round(w / 0.5)));
    t.box([w + 0.02, 0.035, d], [0, 0.89, 0.01], stone);
    t.box([w, 0.5, 0.01], [0, 1.16, -d / 2 + 0.005], defMat('tile'), { collide: false }); // backsplash
  }, { surface: 'wood' });
}
function fridge(game, x, y, z, rotY) {
  const t = mk(game, 'Fridge', [x, y, z], rotY, (t) => {
    const W2 = 0.9, H = 1.78, D = 0.74, T = 0.04, white = C(0xe6e8ea, 0.3, 0.3);
    const liner = defMat('fridgeLiner', () => new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4, side: THREE.DoubleSide }));
    t.box([W2, T, D], [0, 0.1, 0], white); t.box([W2, T, D], [0, H - T / 2, 0], white);
    t.box([T, H, D], [-W2 / 2 + T / 2, H / 2, 0], white); t.box([T, H, D], [W2 / 2 - T / 2, H / 2, 0], white);
    t.box([W2, H, T], [0, H / 2, -D / 2 + T / 2], white);
    t.box([W2 - 2 * T, 0.03, D - T], [0, 0.62, 0], liner); // freezer floor/divider
    for (const yy of [0.95, 1.3]) t.box([W2 - 2 * T, 0.008, D - 0.1], [0, yy, -0.02], defMat('fridgeGlass', () => new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.05, transmission: 0.8, thickness: 0.004, transparent: true, opacity: 0.4 })));
    // food inside (milk jug, eggs, leftovers)
    t.box([0.1, 0.24, 0.1], [-0.25, 0.77, 0.1], C(0xf7f7f2, 0.4)); t.cyl(0.02, 0.03, [-0.25, 0.9, 0.1], C(0x2e7dd1, 0.5));
    t.box([0.26, 0.07, 0.1], [0.05, 0.99, 0.12], C(0xd9c7a4, 0.9));
    for (let i = 0; i < 6; i++) t.ball(0.022, [0.0 + (i % 3) * 0.05, 1.01, 0.1 + Math.floor(i / 3) * 0.05], C(0xf2e6d0, 0.5), { collide: false });
    t.cyl(0.08, 0.06, [0.2, 0.68, 0.05], C(0xe94b3c, 0.6));
    // compressor + condenser coil at the back bottom (behind a grille) - warm
    t.box([0.2, 0.14, 0.16], [0.18, 0.09, -D / 2 + 0.14], 'darkAlu', { hot: 0.6 });
    for (let i = 0; i < 8; i++) t.cyl(0.004, 0.7, [0, 0.05 + i * 0.012, -D / 2 + 0.05], 'copperCoil', { rot: [0, 0, Math.PI / 2], collide: false });
    grille(t, { axis: 'z', at: D / 2 - 0.01, rect: [-W2 / 2 + 0.05, 0.0, W2 / 2 - 0.05, 0.08], bar: 0.006, gap: 0.006, thick: 0.01, m: C(0x6a6c70, 0.5), cross: false });
  }, { surface: 'metal' });
  t.temp = 4;
  // the door is its own hinged thing
  const door = new Thing({ name: 'Fridge door', type: 'kinematic', pos: [x + Math.cos(rotY) * 0.45 + Math.sin(rotY) * 0.38, y, z - Math.sin(rotY) * 0.45 + Math.cos(rotY) * 0.38], rot: [0, rotY, 0], surface: 'metal' });
  door.box([0.9, 1.7, 0.05], [-0.45, 0.94, 0.025], C(0xe6e8ea, 0.3, 0.3));
  door.box([0.8, 0.02, 0.1], [-0.45, 1.0, -0.04], C(0xf4f6f8, 0.4)); door.box([0.8, 0.02, 0.1], [-0.45, 1.35, -0.04], C(0xf4f6f8, 0.4));
  door.box([0.03, 0.6, 0.03], [-0.84, 1.1, 0.07], 'chrome');
  door.build(game.engine.scene);
  door.open = 0; door.target = 0;
  door.behaviors.push({ update(d, dt) { d.open += (d.target - d.open) * Math.min(1, dt * 4); const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY + d.open * 1.7); d.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); } });
  game.interactables.push({ name: () => (door.target ? 'Close fridge' : 'Open fridge'), thing: door, local: new THREE.Vector3(-0.84, 1.1, 0.07), radius: 0.25, use: () => { door.target = door.target ? 0 : 1; sfx.thud(0.2, 2.5); } });
  t.behaviors.push({ update(f, dt, gm) {
    const p = gm.player; if (gm.elsewhere) return;
    const local = f.group.worldToLocal(p.center(new THREE.Vector3()));
    if (Math.abs(local.x) < 0.41 && local.y > 0.12 && local.y < 1.74 && local.z > -0.33 && local.z < 0.33) {
      gm.inside = f;
      if (!f._tip) { f._tip = 1; gm.ui.toast('🥶 It\'s 4°C in the fridge. Brrr! (realistic: you\'d get cold fast at this size)'); }
      f._cold = (f._cold || 0) + dt; if (f._cold > 20 && gm.time > (f._coldCd || 0)) { f._coldCd = gm.time + 3; p.hurt(4, 'freezing'); }
    } else f._cold = 0;
  } });
  return t;
}
function stove(game, x, y, z, rotY) {
  const t = mk(game, 'Stove', [x, y, z], rotY, (t) => {
    const st = C(0x1a1b1e, 0.3, 0.6);
    t.box([0.76, 0.9, 0.64], [0, 0.45, 0], C(0xd8dadc, 0.35, 0.6));
    t.box([0.76, 0.01, 0.64], [0, 0.905, 0], defMat('cooktop', () => new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.08, clearcoat: 1 })));
    t.box([0.6, 0.35, 0.02], [0, 0.45, 0.33], defMat('ovenGlass', () => new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.1, metalness: 0.4 })), { collide: false });
    t.box([0.6, 0.03, 0.03], [0, 0.72, 0.35], 'chrome', { collide: false });
    for (let i = 0; i < 4; i++) t.cyl(0.018, 0.02, [-0.27 + i * 0.18, 0.85, 0.33], st, { rot: [Math.PI / 2, 0, 0], collide: false });
    t.box([0.76, 0.12, 0.06], [0, 0.98, -0.29], C(0xd8dadc, 0.35, 0.6));
  }, { surface: 'metal' });
  // burner rings that glow red when on
  const glow = defMat('burnerGlow', () => new THREE.MeshStandardMaterial({ color: 0x220a05, emissive: 0xff3a10, emissiveIntensity: 0, roughness: 0.4 }));
  const burners = [[-0.19, -0.14], [0.19, -0.14], [-0.19, 0.14], [0.19, 0.14]];
  for (const [bx, bz] of burners) { const r = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.09, 32).rotateX(-Math.PI / 2), glow); r.position.set(bx, 0.912, bz); t.group.add(r); }
  t.on = false; t.temp = 22;
  game.interactables.push({ name: () => (t.on ? 'Turn burner off' : 'Turn burner on'), thing: t, local: new THREE.Vector3(-0.27, 0.85, 0.34), radius: 0.06, use: () => { t.on = !t.on; sfx.click(0.5); } });
  t.behaviors.push({ update(s, dt, gm) {
    s.temp += ((s.on ? 400 : 22) - s.temp) * Math.min(1, dt / (s.on ? 25 : 60));
    glow.emissiveIntensity = Math.max(0, (s.temp - 250) / 150) * 2.5;
    if (gm.elsewhere || !s.on) return;
    const local = s.group.worldToLocal(gm.player.feet.clone());
    if (local.y > 0.9 && local.y < 0.95 && Math.abs(local.x + 0.19) < 0.1 && Math.abs(local.z + 0.14) < 0.1 && s.temp > 80 && gm.time > (s._cd || 0)) {
      s._cd = gm.time + 0.4; gm.player.hurt(14, 'burn'); gm.player.vel.y += 9.81 * gm.player.s * 0.5;
      if (!s._tip) { s._tip = 1; gm.ui.toast(`🔥 The burner is ${Math.round(s.temp)}°C!`); }
    }
  } });
  return t;
}
function pot(game, x, y, z) {
  // a stock pot: hollow steel, water inside that heats up on the burner (and boils!)
  const t = new Thing({ name: 'Pot', type: 'dynamic', density: 7800, pos: [x, y, z], surface: 'metal', icon: '🍲', tags: ['enterable', 'container'] });
  const R2 = 0.11, H = 0.16;
  t.geo(lathe([[0.001, 0], [R2, 0], [R2, H], [R2 - 0.003, H], [R2 - 0.003, 0.004], [0.001, 0.004]], 48), [0, 0, 0], defMat('potSteel', () => new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.25, side: THREE.DoubleSide })), { collide: false });
  coneWall(t, { r0: R2 - 0.0015, y0: 0, r1: R2 - 0.0015, y1: H, thick: 0.003, seg: 28 });
  diskStrips(t, { r: R2, y: 0.002, thick: 0.004, strip: 0.01 });
  for (const sx of [-1, 1]) t.box([0.04, 0.012, 0.025], [sx * (R2 + 0.02), H - 0.02, 0], 'darkAlu');
  t.build(game.engine.scene);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(R2 - 0.004, R2 - 0.004, 0.09, 40), defMat('potWater', () => new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, roughness: 0.03, transmission: 0.8, thickness: 0.05, transparent: true, opacity: 0.65 })));
  water.position.y = 0.049; t.group.add(water);
  t.temp = 20; t.level = 0.094;
  t.enclosure = new THREE.Box3(new THREE.Vector3(-R2, 0, -R2), new THREE.Vector3(R2, H, R2));
  t.behaviors.push({ update(p2, dt, gm) {
    const st = gm.stoveThing;
    const onBurner = st && st.on && p2.position(new THREE.Vector3()).distanceTo(st.group.localToWorld(new THREE.Vector3(-0.19, 0.91, -0.14))) < 0.12;
    p2.temp += ((onBurner ? 100 : 20) - p2.temp) * Math.min(1, dt / 120);
    if (!p2.snd) p2.snd = loop('fizz');
    p2.snd.set(p2.temp > 90 ? vol3d(p2.position(new THREE.Vector3()).distanceTo(gm.macroFeet()), 0.3, gm.realS()) * 0.4 : 0, 0.5);
    water.position.y = 0.049 + (p2.temp > 95 ? Math.sin(gm.time * 20) * 0.001 : 0);
    if (gm.elsewhere) return;
    const pl = gm.player, local = p2.group.worldToLocal(pl.feet.clone());
    if (Math.hypot(local.x, local.z) < R2 && local.y < p2.level && local.y > 0) {
      pl.inLiquid = { swimMul: pl.height < 0.01 ? 0.3 : 0.6, drag: 3, sink: 0.1, name: 'water' };
      gm.inside = p2;
      if (p2.temp > 45 && gm.time > (p2._cd || 0)) { p2._cd = gm.time + 0.5; pl.hurt((p2.temp - 40) * 0.3, 'burn'); gm.ui.toast(`♨️ The water is ${Math.round(p2.temp)}°C! Get out!`, 2); }
    }
  } });
  return t;
}
function microwave(game, x, y, z, rotY) {
  const t = mk(game, 'Microwave', [x, y, z], rotY, (t) => {
    const W2 = 0.5, H = 0.3, D = 0.4, T = 0.015, body = C(0x202226, 0.4, 0.4), liner = C(0xd0d2d4, 0.5, 0.3);
    t.box([W2, T, D], [0, T / 2, 0], body); t.box([W2, T, D], [0, H - T / 2, 0], body);
    t.box([T, H, D], [-W2 / 2 + T / 2, H / 2, 0], body); t.box([T, H, D], [W2 / 2 - T / 2, H / 2, 0], body); t.box([W2, H, T], [0, H / 2, -D / 2 + T / 2], body);
    t.box([0.12, H - 2 * T, D - T], [W2 / 2 - 0.075, H / 2, 0], body); // control side (magnetron + transformer behind)
    t.box([0.3, H - 2 * T, 0.01], [-0.06, H / 2, -D / 2 + 0.02], liner, { collide: false });
    t.cyl(0.13, 0.006, [-0.06, T + 0.012, 0], defMat('turntable', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.7, thickness: 0.006 })), { group: 'turntable', pivot: [-0.06, T + 0.012, 0] });
    t.box([0.06, 0.02, 0.01], [W2 / 2 - 0.075, 0.22, D / 2 + 0.002], defMat('mwScreen', () => new THREE.MeshStandardMaterial({ color: 0, emissive: 0x3cff8a, emissiveIntensity: 0.6 })), { collide: false });
  }, { surface: 'metal' });
  const door = new Thing({ name: 'Microwave door', type: 'kinematic', pos: [x - Math.cos(rotY) * 0.25 + Math.sin(rotY) * 0.2, y, z + Math.sin(rotY) * 0.25 + Math.cos(rotY) * 0.2], rot: [0, rotY, 0], surface: 'glass' });
  door.box([0.37, 0.28, 0.02], [0.185, 0.15, 0.01], defMat('mwDoor', () => new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 })));
  door.build(game.engine.scene);
  door.open = 0; door.target = 0;
  door.behaviors.push({ update(d, dt) { d.open += (d.target - d.open) * Math.min(1, dt * 5); const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY - d.open * 1.6); d.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); } });
  game.interactables.push({ name: () => (door.target ? 'Close microwave' : 'Open microwave'), thing: door, local: new THREE.Vector3(0.36, 0.15, 0.02), radius: 0.12, use: () => { door.target = door.target ? 0 : 1; sfx.click(0.5); } });
  t.on = 0;
  game.interactables.push({ name: 'Start microwave (30 s)', thing: t, local: new THREE.Vector3(0.175, 0.12, 0.2), radius: 0.05, use: () => {
    if (door.target) { game.ui.toast('It won\'t start with the door open (realistic safety switch).'); return; }
    t.on = 30; sfx.beep(1200, 0.1, 0.25); } });
  t.behaviors.push({ update(m, dt, gm) {
    if (m.on > 0) { m.on -= dt; for (const mm of m.meshes?.turntable || []) mm.rotation.y += dt * 0.8; if (m.on <= 0) { for (let i = 0; i < 3; i++) setTimeout(() => sfx.beep(1600, 0.12, 0.25), i * 300); } }
    if (gm.elsewhere || m.on <= 0) return;
    const local = m.group.worldToLocal(gm.player.center(new THREE.Vector3()));
    if (local.x > -0.24 && local.x < 0.11 && local.y > 0 && local.y < 0.29 && Math.abs(local.z) < 0.19 && gm.time > (m._cd || 0)) {
      m._cd = gm.time + 0.5; gm.player.hurt(12, 'microwave'); gm.ui.toast('⚠️ Microwaves heat the water in your body. GET OUT!', 2);
    }
  } });
  return t;
}
function washer(game, x, y, z, rotY, dryer = false) {
  const t = mk(game, dryer ? 'Dryer' : 'Washing machine', [x, y, z], rotY, (t) => {
    const W2 = 0.68, H = 0.9, D = 0.7, T = 0.02, white = C(0xf0f1f2, 0.35, 0.2);
    t.box([W2, T, D], [0, T / 2, 0], white); t.box([W2, T, D], [0, H - T / 2, 0], white);
    t.box([T, H, D], [-W2 / 2 + T / 2, H / 2, 0], white); t.box([T, H, D], [W2 / 2 - T / 2, H / 2, 0], white); t.box([W2, H, T], [0, H / 2, -D / 2 + T / 2], white);
    panel(t, { axis: 'z', at: D / 2 - T / 2, rect: [-W2 / 2, 0, W2 / 2, H], thick: T, m: white, holes: [[-0.17, 0.25, 0.17, 0.59]] });
    // the drum: a perforated steel cylinder lying on its side (realistic holes)
    tubeWall(t, { r: 0.24, h: 0.5, thick: 0.004, y: 0.42, seg: 24, m: 'steel' });
    t.geo(new THREE.TorusGeometry(0.2, 0.03, 10, 32), [0, 0.42, D / 2 - 0.01], C(0x8a9097, 0.4, 0.3), { collide: false });
    t.cyl(0.19, 0.01, [0, 0.42, D / 2 + 0.004], defMat('washGlass', () => new THREE.MeshPhysicalMaterial({ color: 0xdfefff, roughness: 0.05, transmission: 0.8, thickness: 0.01, transparent: true, opacity: 0.5 })), { rot: [Math.PI / 2, 0, 0], collide: false });
    t.cyl(0.025, 0.02, [0.24, 0.8, D / 2], 'chrome', { rot: [Math.PI / 2, 0, 0], collide: false });
  }, { surface: 'metal' });
  // tubeWall is built around the y-axis: rotate the drum to lie along z
  return t;
}

// ---------------- the car (garage) ----------------
function car(game, x, y, z, rotY) {
  const paint = defMat('carPaint', () => new THREE.MeshPhysicalMaterial({ color: 0x2c3e55, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const glass = defMat('carGlass', () => new THREE.MeshPhysicalMaterial({ color: 0x1a2430, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 }));
  const t = mk(game, 'Car', [x, y, z], rotY, (t) => {
    // 4.7 m sedan. Body shell + cabin + hood that opens (cutter/E), engine bay with a real engine layout
    t.rbox([1.8, 0.55, 4.7], [0, 0.6, 0], paint, 0.12);
    t.rbox([1.6, 0.5, 2.3], [0, 1.1, -0.25], glass, 0.15);
    t.rbox([1.62, 0.06, 1.4], [0, 1.37, -0.25], paint, 0.03);
    for (const [wx, wz] of [[0.8, 1.45], [-0.8, 1.45], [0.8, -1.45], [-0.8, -1.45]]) {
      t.cyl(0.33, 0.24, [wx, 0.33, wz], 'rubber', { rot: [0, 0, Math.PI / 2], seg: 28 });
      t.cyl(0.2, 0.25, [wx, 0.33, wz], 'chrome', { rot: [0, 0, Math.PI / 2], collide: false });
    }
    for (const sx of [-0.6, 0.6]) { t.box([0.3, 0.1, 0.02], [sx, 0.75, 2.35], defMat('headlight', () => new THREE.MeshStandardMaterial({ color: 0xfafcff, emissive: 0xffffff, emissiveIntensity: 0.1 })), { collide: false }); t.box([0.3, 0.08, 0.02], [sx, 0.8, -2.35], C(0xb01818, 0.3), { collide: false }); }
    // engine bay contents (under the hood): engine block, valve cover, air box, battery, radiator + fan
    t.box([0.62, 0.42, 0.5], [0, 0.6, 1.75], 'darkAlu', { hot: 1 });
    t.box([0.5, 0.08, 0.4], [0, 0.85, 1.75], C(0x1a1a1a, 0.4));
    t.box([0.3, 0.18, 0.25], [0.55, 0.75, 1.5], C(0x222222, 0.6));
    t.box([0.26, 0.2, 0.18], [-0.55, 0.72, 1.55], C(0x1d2a1d, 0.6)); t.cyl(0.015, 0.02, [-0.5, 0.83, 1.55], C(0xc0392b, 0.5)); t.cyl(0.015, 0.02, [-0.6, 0.83, 1.55], 'black');
    t.box([1.2, 0.45, 0.04], [0, 0.62, 2.2], C(0x3a3d40, 0.5, 0.5));
    t.cyl(0.18, 0.04, [0, 0.62, 2.15], C(0x111111, 0.6), { rot: [Math.PI / 2, 0, 0], group: 'carFan', pivot: [0, 0.62, 2.15] });
  }, { surface: 'metal' });
  t.dirt = 0.5;
  return t;
}

// ---------------- the mystery box (basement) ----------------
function mysteryBox(game, x, y, z) {
  const t = mk(game, 'Old crate', [x, y, z], 0.3, (t) => {
    const w = 'deskWood', T = 0.015;
    t.box([0.6, T, 0.4], [0, T / 2, 0], w); t.box([0.6, 0.35, T], [0, 0.175, 0.2 - T / 2], w); t.box([0.6, 0.35, T], [0, 0.175, -0.2 + T / 2], w);
    t.box([T, 0.35, 0.4 - 2 * T], [0.3 - T / 2, 0.175, 0], w); t.box([T, 0.35, 0.4 - 2 * T], [-0.3 + T / 2, 0.175, 0], w);
    t.box([0.62, T, 0.42], [0.1, 0.36, -0.25], w, { rot: [0.9, 0, 0] }); // lid pried open
    // straw packing, an empty foam slot the watch came from, old papers with strange symbols
    for (let i = 0; i < 14; i++) t.box([0.12, 0.003, 0.003], [(i % 5 - 2) * 0.1, 0.06 + (i % 3) * 0.01, (i % 4 - 1.5) * 0.08], C(0xd9c27a, 0.9), { rot: [0, i, 0.2], collide: false });
    t.box([0.2, 0.05, 0.15], [0.1, 0.04, 0.0], 'foam');
    t.box([0.06, 0.02, 0.06], [0.1, 0.06, 0.0], 'black', { collide: false });
    t.box([0.21, 0.002, 0.28], [-0.15, 0.03, 0.05], defMat('oldNotes', () => new THREE.MeshStandardMaterial({ roughness: 0.9, map: drawTexture(256, 340, (c, w2, h2) => {
      c.fillStyle = '#e8dcbc'; c.fillRect(0, 0, w2, h2); c.strokeStyle = '#3a2c1c'; c.fillStyle = '#3a2c1c'; c.lineWidth = 2;
      c.font = 'italic 16px serif'; c.fillText('Prototype 7 - DO NOT', 14, 30); c.fillText('use below 1.5 µm', 14, 52);
      for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(50 + (i % 3) * 70, 100 + Math.floor(i / 3) * 70, 18, 0, 6.28); c.stroke(); c.beginPath(); c.moveTo(32 + (i % 3) * 70, 100 + Math.floor(i / 3) * 70); c.lineTo(68 + (i % 3) * 70, 100 + Math.floor(i / 3) * 70); c.stroke(); }
      c.fillText('?? ⟁ ⌬ ⍜', 70, 320);
    }, 'notesTex') })), { collide: false });
  }, { surface: 'wood' });
  game.interactables.push({ name: 'Read the old notes', thing: t, local: new THREE.Vector3(-0.15, 0.04, 0.05), radius: 0.15, use: () => game.ui.toast('📜 "Prototype 7 - DO NOT use below 1.5 µm." The rest is in symbols nobody can read...', 6) });
  return t;
}

// ---------------- place everything ----------------
export function furnishHouse(game) {
  const up = FLOORS.up;
  // bathroom
  game.toilet = toilet(game, -5.72, up, 0.62, Math.PI / 2);
  mk(game, 'vanity', [-4.8, up, 0.6], Math.PI / 2, (t) => {
    cabinet(t, 0.6, 0.82, 0.5, C(0xf3f1ec, 0.5));
    t.box([0.62, 0.03, 0.52], [0, 0.835, 0], 'granite');
    t.geo(lathe([[0.001, 0], [0.16, 0.0], [0.18, 0.12], [0.165, 0.12], [0.145, 0.012], [0.001, 0.012]], 32).scale(1, 1, 0.75), [0, 0.73, 0.04], 'porcelain', { collide: false });
    t.cyl(0.015, 0.2, [0, 0.95, -0.2], 'chrome', { collide: false });
  }, { surface: 'wood' });
  mk(game, 'bathtub', [-5.25, up, 1.42], 0, (t) => {
    const p = 'porcelain', T = 0.05;
    t.box([1.5, 0.05, 0.75], [0, 0.025, 0], p); t.box([1.5, 0.55, T], [0, 0.275, 0.375 - T / 2], p); t.box([1.5, 0.55, T], [0, 0.275, -0.375 + T / 2], p);
    t.box([T, 0.55, 0.75], [0.75 - T / 2, 0.275, 0], p); t.box([T, 0.55, 0.75], [-0.75 + T / 2, 0.275, 0], p);
    t.cyl(0.02, 0.006, [-0.6, 0.053, 0], 'chrome', { collide: false });
  }, { surface: 'glass' });
  // parents' room
  mk(game, "Parents' bed", [-7.3, up, -2.6], Math.PI / 2, (t) => bed(t, 1.93, 2.03, 'deskWood', C(0xeae6dc, 0.9), C(0x7a6a5a, 1)), { surface: 'fabric' });
  game.dresser = mk(game, 'Dresser', [-4.55, up, -2.3], -Math.PI / 2, (t) => { cabinet(t, 1.4, 0.85, 0.5, 'deskWood', 3); }, { surface: 'wood' });
  mk(game, 'nightstand', [-7.9, up, -1.35], 0, (t) => cabinet(t, 0.45, 0.55, 0.4, 'deskWood', 1), { surface: 'wood' });
  mk(game, 'nightstand', [-7.9, up, -3.85], 0, (t) => cabinet(t, 0.45, 0.55, 0.4, 'deskWood', 1), { surface: 'wood' });
  // office
  mk(game, 'office desk', [0.6, up, -4.1], 0, (t) => { table(t, 1.5, 0.7, 0.74, 'deskWood', 0.04); t.box([0.55, 0.32, 0.03], [0, 0.95, -0.2], 'plasticBlack'); t.box([0.2, 0.45, 0.42], [0.55, 0.96, -0.05], 'plasticBlack'); }, { surface: 'wood' });
  mk(game, 'bookshelf', [-1.6, up, -4.3], 0, (t) => { shelf(t, 0.8, 1.9, 0.3, 5); for (let r = 0; r < 4; r++) books(t, -0.38, 0.38, 0.06 + r * 0.368, 0, 0.2, r + 3); }, { surface: 'wood' });
  // living room
  mk(game, 'Couch', [-0.6, G, -0.45], 0, (t) => couch(t, 2.2, 0x4a5568), { surface: 'fabric' });
  mk(game, 'coffee table', [-0.6, G, 0.6], 0, (t) => table(t, 1.1, 0.6, 0.42, 'lightWood', 0.05), { surface: 'wood' });
  mk(game, 'TV console', [-0.6, G, 1.6], Math.PI, (t) => { cabinet(t, 1.8, 0.5, 0.42, 'deskWood', 3); t.box([1.45, 0.83, 0.05], [0, 0.98, 0.0], 'plasticBlack'); t.box([1.42, 0.8, 0.004], [0, 0.98, -0.027], 'screenOff', { collide: false }); }, { surface: 'wood' });
  mk(game, 'armchair', [1.4, G, 0.0], -Math.PI / 2, (t) => couch(t, 1.0, 0x6b5a4a), { surface: 'fabric' });
  lamp(game, 1.65, G, -0.75);
  mk(game, 'bookshelf', [1.85, G, 1.0], -Math.PI / 2, (t) => { shelf(t, 0.8, 1.6, 0.3, 4); for (let r = 0; r < 3; r++) books(t, -0.38, 0.38, 0.06 + r * 0.385, 0, 0.2, r + 9); }, { surface: 'wood' });
  // dining
  mk(game, 'dining table', [-0.5, G, -2.8], 0, (t) => table(t, 1.8, 0.95, 0.76, 'deskWood', 0.07), { surface: 'wood' });
  for (const [cx, cz, r] of [[-1.1, -3.45, 0], [-0.5, -3.45, 0], [0.1, -3.45, 0], [-1.1, -2.15, Math.PI], [-0.5, -2.15, Math.PI], [0.1, -2.15, Math.PI]]) {
    const ch = new Thing({ name: 'Dining chair', type: 'dynamic', density: 500, pos: [cx, G, cz], rot: [0, r, 0], surface: 'wood', icon: '🪑' });
    for (const [lx, lz] of [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]]) ch.box([0.035, 0.45, 0.035], [lx, 0.225, lz], 'deskWood');
    ch.box([0.44, 0.03, 0.44], [0, 0.465, 0], 'deskWood');
    ch.box([0.42, 0.45, 0.03], [0, 0.7, -0.2], 'deskWood');
    ch.build(game.engine.scene);
  }
  // kitchen: counters along the north wall + island, fridge, stove with a pot, microwave, sink
  counterRun(game, -7.4, -5.1, -4.17, G);
  game.fridgeThing = fridge(game, -7.85, G, -4.11, 0);
  game.stoveThing = stove(game, -4.7, G, -4.15, 0);
  counterRun(game, -8.25, -6.6, -1.4, G, 1);
  mk(game, 'kitchen island', [-6.2, G, -2.65], 0, (t) => { cabinet(t, 1.6, 0.87, 0.75, C(0x30455c, 0.5), 3); t.box([1.75, 0.035, 0.95], [0, 0.89, 0.05], 'granite'); }, { surface: 'wood' });
  mk(game, 'sink', [-6.2, G + 0.905, -4.15], 0, (t) => {
    const st = 'steel';
    t.box([0.6, 0.004, 0.4], [0, -0.2, 0], st); t.box([0.6, 0.2, 0.004], [0, -0.1, 0.2], st); t.box([0.6, 0.2, 0.004], [0, -0.1, -0.2], st); t.box([0.004, 0.2, 0.4], [0.3, -0.1, 0], st); t.box([0.004, 0.2, 0.4], [-0.3, -0.1, 0], st);
    t.cyl(0.04, 0.003, [0, -0.197, 0], 'black', { collide: false }); // drain
    t.cyl(0.015, 0.3, [0, 0.15, -0.24], 'chrome'); t.cyl(0.012, 0.18, [0, 0.29, -0.16], 'chrome', { rot: [Math.PI / 2, 0, 0] });
  }, { surface: 'metal' });
  game.potThing = pot(game, -4.89, G + 0.92, -4.29);
  microwave(game, -5.5, G + 0.905, -4.3, 0);
  // den: sofa, toy box, the basement stairs are along its north side
  mk(game, 'Sofa', [-6.2, G, 1.35], Math.PI, (t) => couch(t, 2.0, 0x7a5a4a), { surface: 'fabric' });
  // garage: the car + workbench + shelves
  car(game, 5.3, G - 0.15, -1.2, 0);
  mk(game, 'workbench', [8.0, G - 0.15, -2.6], -Math.PI / 2, (t) => { table(t, 1.8, 0.6, 0.9, 'lightWood', 0.07); t.box([1.8, 0.8, 0.02], [0, 1.4, -0.29], C(0xb08a5a, 0.9)); }, { surface: 'wood' });
  mk(game, 'garage shelf', [2.6, G - 0.15, -4.2], 0, (t) => shelf(t, 1.0, 1.8, 0.45, 4, 'steel'), { surface: 'metal' });
  // basement: washer + dryer, water heater, shelves, the crate where you found the watch
  washer(game, -7.7, B, -3.9, 0); washer(game, -6.9, B, -3.9, 0, true);
  mk(game, 'water heater', [-1.2, B, -4.0], 0, (t) => { t.cyl(0.28, 1.5, [0, 0.75, 0], C(0xe8e6de, 0.5)); t.cyl(0.03, 0.4, [0, 1.7, 0], 'copper'); }, { surface: 'metal' });
  mk(game, 'storage shelf', [-3.5, B, -4.2], 0, (t) => { shelf(t, 1.6, 1.8, 0.5, 4, 'steel'); for (let i = 0; i < 6; i++) t.box([0.45, 0.3, 0.4], [-0.5 + (i % 3) * 0.5, 0.21 + Math.floor(i / 3) * 0.44, 0], 'cardboard'); }, { surface: 'metal' });
  game.crate = mysteryBox(game, -5.0, B, -2.6);
}
