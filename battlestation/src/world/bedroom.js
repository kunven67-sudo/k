import * as THREE from 'three';
import { mesh, box, boxMM, cyl, slab, lathe } from './build.js';
import { pbr, paint, canvasTex, smudgeTex } from './materials.js';
import { model, place, clockHands } from './models.js';
import { buildMonitor } from './monitor.js';
import { H } from './layout.js';

// The stream room's "bedroom half": bed in the south-west corner, nightstand, wardrobe,
// couch facing a wall TV with a console, coffee table on a rug, ceiling fan, plants, art.
// World frame: x east, z south (the window wall is z = 0), floor at y = 0.
export async function buildBedroom(ctx) {
  const scene = ctx.scene;
  const B = { tick: [] };

  // ---- bed ------------------------------------------------------------------------------
  const BED = { x0: 0.06, x1: 1.5, z0: 2.7, z1: 4.8, frameTop: 0.32, top: 0.56 };
  B.BED = BED;
  const [frameWood, headFab, sheet, duvetFab, pillowFab] = await Promise.all([
    pbr('white_oak_veneer', { color: 0x8c7a66, roughness: 0.8, normal: 0.5 }),
    pbr('knitted_fleece', { color: 0x4a4d53, roughness: 1, normal: 0.9, scale: 0.6 }),
    pbr('rough_linen', { color: 0xd9dadd, roughness: 1, normal: 0.7 }),
    pbr('polar_fleece', { color: 0x3e4757, roughness: 1, normal: 0.8 }),
    pbr('rough_linen', { color: 0xeeeeec, roughness: 1, normal: 0.6, scale: 0.8 }),
  ]);
  const mx0 = BED.x0 + 0.04, mx1 = BED.x1 - 0.03, mz0 = BED.z0 + 0.05, mz1 = BED.z1 - 0.09;
  // frame: rails around the mattress, legs, slats under it
  const rail = 0.035;
  mesh(boxMM(BED.x0, 0.12, BED.z0, BED.x1, BED.frameTop + 0.03, BED.z0 + rail), frameWood, { parent: scene });
  mesh(boxMM(BED.x0, 0.12, BED.z0, BED.x0 + rail, BED.frameTop + 0.03, mz1), frameWood, { parent: scene });
  mesh(boxMM(BED.x1 - rail, 0.12, BED.z0, BED.x1, BED.frameTop + 0.03, mz1), frameWood, { parent: scene });
  for (const [x, z] of [[BED.x0 + 0.03, BED.z0 + 0.03], [BED.x1 - 0.03, BED.z0 + 0.03], [BED.x0 + 0.03, mz1 - 0.03], [BED.x1 - 0.03, mz1 - 0.03]]) {
    mesh(boxMM(x - 0.03, 0, z - 0.03, x + 0.03, 0.13, z + 0.03), frameWood, { parent: scene });
  }
  mesh(boxMM(mx0, 0.29, mz0, mx1, 0.32, mz1), paint(0x2a2622, 0.9), { parent: scene });
  // upholstered headboard against the wall
  const hb = mesh(box(BED.x1 - BED.x0 + 0.04, 0.98, 0.075, 0.03, 4), headFab, { parent: scene });
  hb.position.set((BED.x0 + BED.x1) / 2, 0.12 + 0.49, BED.z1 - 0.04);
  // channel tufting lines on the headboard
  const tuftMat = paint(0x2f3135, 1);
  for (let i = 1; i < 7; i++) {
    const x = BED.x0 + (BED.x1 - BED.x0) * i / 7;
    mesh(new THREE.BoxGeometry(0.006, 0.86, 0.004), tuftMat, { parent: scene, pos: [x, 0.62, BED.z1 - 0.079], cast: false });
  }
  // mattress with a fitted sheet
  const matt = mesh(box(mx1 - mx0, BED.top - BED.frameTop, mz1 - mz0, 0.05, 4), sheet, { parent: scene });
  matt.position.set((mx0 + mx1) / 2, (BED.top + BED.frameTop) / 2, (mz0 + mz1) / 2);
  ctx.physics.add({ x: (BED.x0 + BED.x1) / 2, z: (BED.z0 + BED.z1) / 2, hx: (BED.x1 - BED.x0) / 2, hz: (BED.z1 - BED.z0) / 2, y0: 0, y1: BED.top + 0.05 });
  ctx.interact.block(matt);
  // pillows: one flat under your head, one leaning on the headboard
  const pg = pillowGeo(0.66, 0.46, 0.15);
  const p1 = mesh(pg, pillowFab, { parent: scene });
  p1.position.set(0.78, BED.top + 0.05, 4.42); p1.rotation.y = 0.04;
  const p2 = mesh(pg, pillowFab, { parent: scene });
  p2.position.set(0.8, BED.top + 0.25, 4.63); p2.rotation.set(-1.12, -0.05, 0.02);
  B.pillows = [p1, p2];
  // duvet: draped over the mattress, morphs between "you're under it" and "thrown back"
  B.pelvis = new THREE.Vector3(0.78, BED.top + 0.08, 3.66);
  const duvet = mesh(duvetGeo(BED, mx0, mx1, mz0, mz1, B.pelvis.x), duvetFab, { parent: scene });
  duvet.material = duvetFab.clone();
  duvet.material.side = THREE.DoubleSide;
  duvet.morphTargetInfluences = [1];
  B.duvet = { mesh: duvet, t: 1, target: 1 };
  B.setCovered = (on, instant) => { B.duvet.target = on ? 0 : 1; if (instant) B.duvet.t = B.duvet.target; };
  B.tick.push(dt => {
    const d = B.duvet;
    d.t += (d.target - d.t) * Math.min(1, dt * 3.2);
    duvet.morphTargetInfluences[0] = d.t;
  });

  // ---- nightstand: lamp, real-time alarm clock, an energy drink ------------------------------
  const ns = await model('side_table_01');
  place(ctx, ns, { x: 1.83, z: 4.54, height: 0.55 });
  const nsTop = 0.55;
  const clock = await model('alarm_clock_01');
  const clockW = place(ctx, clock, { x: 1.69, y: nsTop, z: 4.56, height: 0.15, rot: -2.35, collide: false });
  const hands = clockHands(clock, { hour: 'houd_hand', minute: 'minute_hand', second: 'second_hand' }, new THREE.Vector3(0, 0.065, 0), new THREE.Vector3(0, 0, 1));
  B.tick.push(() => hands.set(ctx.now()));
  void clockW;
  B.lamp = buildBedsideLamp(ctx, new THREE.Vector3(1.97, nsTop, 4.66));
  B.tick.push(dt => B.lamp.update(dt));
  B.cans = [];
  B.cans.push(await energyCan(ctx, { x: 1.86, y: nsTop, z: 4.4, flavor: 0 }));

  // ---- wardrobe with working doors -------------------------------------------------------------
  B.wardrobe = await buildWardrobe(ctx, { x0: 3.0, x1: 4.2, z0: 4.21, z1: 4.8 });
  B.tick.push(dt => B.wardrobe.update(dt));

  // ---- plant in a ceramic pot between the nightstand and wardrobe ------------------------------
  await pottedPlant(ctx, { x: 2.55, z: 4.47, variant: 'c', height: 1.05, pot: 0.17 });
  const big = await model('potted_plant_01');
  place(ctx, big, { x: 5.06, z: 0.42, height: 1.3, rot: 0.6, pad: -0.12 });
  const succ = await model('potted_plant_04');
  place(ctx, succ, { x: 3.1, y: 0.856, z: 0.12, height: 0.19, collide: false });

  // ---- couch + rug + coffee table -------------------------------------------------------------
  const rugMat = await pbr('curly_teddy_natural', { color: 0xbfb6a8, roughness: 1, normal: 0.8 });
  const rug = mesh(slab(2.05, 2.35, 0.014, 0.08, 0.004), rugMat, { parent: scene });
  rug.position.set(3.82, 0, 1.92);
  rug.receiveShadow = true; rug.castShadow = false;
  const sofa = await model('sofa_02');
  B.sofa = place(ctx, sofa, { x: 3.04, z: 1.92, width: 1.85, rot: Math.PI / 2 });
  B.sofaSeat = { x: 3.12, y: 0.47, z: 1.92, yaw: Math.PI / 2 }; // where you sit, facing the TV (+x)
  await throwPillows(ctx, B.sofa);
  const table = await model('modern_coffee_table_01');
  place(ctx, table, { x: 4.12, z: 1.92, height: 0.4 });
  B.controller = buildController(ctx);
  B.controller.group.position.set(4.06, 0.4, 2.15);
  B.controller.group.rotation.y = 1.9;
  B.controller.home = B.controller.group.position.clone();
  B.cans.push(await energyCan(ctx, { x: 4.2, y: 0.4, z: 1.55, flavor: 1 }));
  B.remote = buildRemote(ctx);
  B.remote.position.set(4.18, 0.4, 2.42); B.remote.rotation.y = 1.4;

  // ---- TV wall: media console, console, 55" TV -------------------------------------------------
  const cab = await model('modern_wooden_cabinet');
  B.cabinet = place(ctx, cab, { x: 5.2, z: 1.92, width: 1.8, rot: -Math.PI / 2 });
  const cabTop = B.cabinet.userData.size.y;
  const cons = await model('gaming_console');
  B.console = place(ctx, cons, { x: 5.18, y: cabTop, z: 2.5, width: 0.34, rot: -Math.PI / 2, collide: false });
  B.consoleLed = mesh(new THREE.BoxGeometry(0.002, 0.003, 0.03), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x2b9bff, emissiveIntensity: 0 }), { parent: scene, cast: false });
  B.consoleLed.position.set(5.0, cabTop + 0.05, 2.5);
  const tv = buildMonitor({ inches: 55, res: [1280, 720], name: 'tv', stand: false, bezel: 0.008, chinH: 0.012, depth: 0.03 });
  tv.group.position.set(5.4 - 0.065, cabTop + 0.12 + tv.sh / 2 + 0.25, 1.92);
  tv.group.rotation.y = -Math.PI / 2;
  scene.add(tv.group);
  tv.on = false; tv.signal = false;
  ctx.interact.block(tv.screen);
  B.tv = tv;
  // wall bracket hidden behind the TV
  mesh(box(0.4, 0.3, 0.035, 0.004), paint(0x111111, 0.5, 0.6), { parent: scene, pos: [5.4 - 0.02, tv.group.position.y, 1.92], rot: [0, Math.PI / 2, 0] });
  B.tick.push(dt => tv.update(dt));

  // ---- ceiling fan with a light kit + two pull chains ------------------------------------------
  B.fan = await buildFan(ctx, new THREE.Vector3(2.7, H, 2.5));
  B.tick.push(dt => B.fan.update(dt));

  // ---- wall art, dartboard, the box of spare PC parts ---------------------------------------------
  await frameArt(ctx, 'hanging_picture_frame_02', { x: 0.78, y: 1.52, z: 4.786, rot: Math.PI, width: 0.86, art: landscapeArt });
  await frameArt(ctx, 'hanging_picture_frame_01', { x: 1.42, y: 1.6, z: 0.014, rot: 0, height: 0.84, art: posterArt });
  const dart = await model('dartboard');
  place(ctx, dart, { x: 4.78, y: 1.73 - 0.225, z: 0.024, width: 0.45, collide: false });
  const pbox = await model('cardboard_box_01');
  B.partsBox = place(ctx, pbox, { x: 2.27, z: 0.32, height: 0.34, rot: 0.15 });

  B.update = (dt) => { for (const f of B.tick) f(dt); };
  return B;
}

// ------------------------------------------------------------------------------------------------
// A puffy pillow: a subdivided box whose thickness falls off toward the edges, corners pinched.
function pillowGeo(w, d, t) {
  const g = new THREE.BoxGeometry(w, t, d, 24, 4, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (w / 2), nz = p.getZ(i) / (d / 2);
    const fx = Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(nx)), 3)), fz = Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(nz)), 3));
    const prof = Math.max(0.1, Math.pow(fx, 0.6) * Math.pow(fz, 0.6));
    p.setY(i, p.getY(i) * prof + Math.sin(nx * 5.1 + nz * 3.3) * 0.004);
    p.setX(i, p.getX(i) * (1 - 0.07 * nz * nz));
    p.setZ(i, p.getZ(i) * (1 - 0.06 * nx * nx));
  }
  g.computeVertexNormals();
  // UVs in meters for the fabric
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + p.getY(i) * 0.3, p.getZ(i) + p.getY(i) * 0.3);
  return g;
}

// Smooth value noise for fabric wrinkles.
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

// The duvet: a cloth sheet draped over the mattress. Morph 0 = pulled up to your chest with your
// body making a lump under it; morph 1 = thrown back into a fold at the foot of the bed.
function duvetGeo(BED, mx0, mx1, mz0, mz1, bodyX) {
  const NU = 56, NV = 64;
  const top = BED.top + 0.012, rc = 0.05;
  const hangW = 0.07, hangE = 0.3, hangFoot = 0.2;
  const width = (mx1 - mx0) + hangW + hangE + Math.PI * rc; // arc length across
  const L = (4.08 - mz0) + hangFoot + Math.PI * rc / 2;     // arc length from foot hem to top edge
  const drape = (e) => { // e = arc length past the mattress edge -> [out, down]
    if (e <= 0) return [e, 0];
    if (e < Math.PI * rc / 2) { const a = e / rc; return [rc * Math.sin(a), rc * (1 - Math.cos(a))]; }
    return [rc, rc + (e - Math.PI * rc / 2)];
  };
  const posA = [], posB = [], uvs = [], idx = [];
  const cx = (mx0 + mx1) / 2, hw = (mx1 - mx0) / 2;
  const bodyH = (z) => { // how tall your body is under the covers along the bed
    const k = [[2.72, 0.05], [2.8, 0.17], [2.9, 0.12], [3.1, 0.12], [3.4, 0.15], [3.7, 0.19], [3.95, 0.22], [4.1, 0.2]];
    if (z <= k[0][0]) return 0;
    for (let i = 1; i < k.length; i++) if (z <= k[i][0]) { const t = (z - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t; }
    return 0.2;
  };
  for (let j = 0; j <= NV; j++) {
    const s = j / NV * L; // arc length from the hem at the foot
    for (let i = 0; i <= NU; i++) {
      const a = i / NU * width - (hangW + Math.PI * rc / 2) - hw; // signed arc length across from the center
      // across: drape over both long edges
      let x, dropX;
      if (a < -hw) { const [o, d] = drape(-a - hw); x = cx - hw - o; dropX = d; } else if (a > hw) { const [o, d] = drape(a - hw); x = cx + hw + o; dropX = d; } else { x = cx + a; dropX = 0; }
      const wr = (noise2(x * 7, s * 5) - 0.5) * 0.02 + (noise2(x * 18 + 3, s * 14) - 0.5) * 0.006;
      // ---- A: covering you
      {
        const e = (hangFoot + Math.PI * rc / 2) - s; // past the foot edge
        let z, dropZ;
        if (e > 0) { const [o, d] = drape(e); z = mz0 - o; dropZ = d; } else { z = mz0 - e; dropZ = 0; }
        const bx = Math.exp(-Math.pow((x - bodyX) / 0.2, 2));
        const lift = dropX === 0 && dropZ === 0 ? bodyH(z) * bx : 0;
        let y = top - Math.max(dropX, dropZ) + lift + wr * (1 + lift * 4);
        // top edge folds over a little (sheet showing)
        posA.push(x, Math.max(y, 0.2), z);
      }
      // ---- B: thrown back, folded at ~z 3.4
      {
        const sFold = (hangFoot + Math.PI * rc / 2) + 0.66, rf = 0.045;
        const e = (hangFoot + Math.PI * rc / 2) - s;
        let z, y0, dropZ = 0;
        if (e > 0) { const [o, d] = drape(e); z = mz0 - o; dropZ = d; y0 = top; } else if (s < sFold) { z = mz0 - e; y0 = top; } else if (s < sFold + Math.PI * rf) { const t = (s - sFold) / rf; z = mz0 + (sFold - (hangFoot + Math.PI * rc / 2)) + rf * Math.sin(t); y0 = top + rf * (1 - Math.cos(t)); } else { z = mz0 + (sFold - (hangFoot + Math.PI * rc / 2)) - (s - sFold - Math.PI * rf); y0 = top + 2 * rf; }
        const bunch = Math.exp(-Math.pow((z - (mz0 + 0.66)) / 0.12, 2)) * 0.03;
        const y = y0 - Math.max(dropX, dropZ) * (y0 > top + 0.01 ? 0.15 : 1) + wr * 1.6 + bunch;
        posB.push(x, Math.max(y, 0.2), z);
      }
      uvs.push(a, s);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const gb = new THREE.BufferGeometry();
  gb.setIndex(idx);
  gb.setAttribute('position', new THREE.Float32BufferAttribute(posB, 3));
  gb.computeVertexNormals();
  g.morphAttributes.position = [gb.attributes.position];
  g.morphAttributes.normal = [gb.attributes.normal];
  g.morphTargetsRelative = false;
  return g;
}

// ------------------------------------------------------------------------------------------------
function buildBedsideLamp(ctx, at) {
  const g = new THREE.Group();
  g.position.copy(at);
  ctx.scene.add(g);
  const ceramic = paint(0x2c2e33, 0.32, 0, { roughnessMap: smudgeTex() });
  mesh(lathe([[0, 0], [0.055, 0], [0.06, 0.01], [0.07, 0.06], [0.072, 0.12], [0.055, 0.18], [0.02, 0.2], [0.012, 0.215], [0, 0.215]], 40), ceramic, { parent: g });
  mesh(cyl(0.004, 0.004, 0.09, 8), paint(0xb8a07a, 0.3, 1), { parent: g, pos: [0, 0.26, 0] });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveIntensity: 0 });
  const shade = mesh(cyl(0.085, 0.12, 0.16, 40, true), shadeMat, { parent: g, pos: [0, 0.31, 0] });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd7a0, emissiveIntensity: 0 });
  mesh(new THREE.SphereGeometry(0.025, 16, 12), bulbMat, { parent: g, pos: [0, 0.3, 0], cast: false });
  const light = new THREE.PointLight(0xffc68a, 0, 5, 2);
  light.position.set(0, 0.3, 0);
  g.add(light);
  const L = { group: g, on: false, level: 0, light };
  L.set = (on) => { L.on = on; ctx.envDirty = true; };
  L.update = (dt) => {
    L.level += ((L.on ? 1 : 0) - L.level) * Math.min(1, dt * 18);
    light.intensity = L.level * 2.6;
    shadeMat.emissiveIntensity = L.level * 0.55;
    bulbMat.emissiveIntensity = L.level * 6;
  };
  ctx.interact.add(shade, { label: () => L.on ? 'Turn off lamp' : 'Turn on lamp', range: 2.3, use: () => { L.set(!L.on); ctx.audio.play('switch_on.ogg', { pos: at, vol: 0.35, rate: 1.4 }); } });
  return L;
}

// A drink can you can pick up and drink. Label drawn on a canvas.
const FLAVORS = [
  { name: 'VOLT', sub: 'ENERGY', col: '#151618', acc: '#7dff3a' },
  { name: 'NOVA', sub: 'BERRY ENERGY', col: '#f2f2f2', acc: '#ff2e63' },
  { name: 'FROST', sub: 'ZERO SUGAR', col: '#1f6fd1', acc: '#ffffff' },
];
const canTex = [];
export async function energyCan(ctx, o) {
  const f = FLAVORS[o.flavor % FLAVORS.length];
  if (!canTex[o.flavor]) {
    canTex[o.flavor] = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = f.col; c.fillRect(0, 0, w, h);
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.15)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.save(); c.translate(w * 0.26, h / 2); c.rotate(-Math.PI / 2);
      c.fillStyle = f.acc; c.font = '900 64px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(f.name, 0, 0);
      c.font = '700 18px Arial, sans-serif'; c.fillText(f.sub, 0, 46);
      c.restore();
      c.strokeStyle = f.acc; c.lineWidth = 6;
      c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.78 + Math.sin(x / 40) * 10); c.stroke();
      c.fillStyle = f.col === '#f2f2f2' ? '#333' : '#ccc'; c.font = '600 11px Arial'; c.fillText('355 mL  •  160 mg caffeine', w * 0.58, h * 0.92);
    });
    canTex[o.flavor].wrapS = THREE.RepeatWrapping; canTex[o.flavor].repeat.set(1, 1);
  }
  const g = new THREE.Group();
  const r = 0.033, hgt = 0.122;
  const metal = paint(0xd8d8dc, 0.25, 1);
  const body = new THREE.MeshStandardMaterial({ map: canTex[o.flavor], roughness: 0.28, metalness: 0.65 });
  const side = mesh(new THREE.CylinderGeometry(r, r, hgt * 0.84, 40, 1, true), body, { parent: g, pos: [0, hgt / 2, 0] });
  void side;
  mesh(lathe([[0, hgt * 0.92], [r * 0.82, hgt * 0.92], [r * 0.86, hgt * 0.995], [r * 0.8, hgt], [r * 0.8, hgt * 0.985], [r, hgt * 0.92 - 0.004], [r, hgt * 0.92 - 0.012]], 40), metal, { parent: g });
  mesh(lathe([[r, 0.012], [r, 0.01], [r * 0.85, 0.002], [r * 0.75, 0], [r * 0.6, 0.006], [0, 0.008]], 40), metal, { parent: g });
  mesh(new THREE.CylinderGeometry(r, r, 0.012, 40, 1, true), metal, { parent: g, pos: [0, hgt * 0.92 - 0.006 - 0.004, 0] });
  // pull tab
  mesh(box(0.012, 0.0015, 0.02, 0.0007), metal, { parent: g, pos: [0, hgt * 0.925, 0.006] });
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.rot ?? Math.random() * 6;
  ctx.scene.add(g);
  const can = { group: g, flavor: f, sips: 6, open: false };
  return can;
}

async function pottedPlant(ctx, o) {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.z);
  ctx.scene.add(g);
  const r = o.pot, h = r * 1.65;
  const potMat = paint(0xe7e3da, 0.42, 0, { roughnessMap: smudgeTex() });
  mesh(lathe([[0, 0.004], [r * 0.7, 0.004], [r * 0.74, 0], [r * 0.78, 0.01], [r, h - 0.02], [r * 1.04, h - 0.015], [r * 1.04, h], [r * 0.95, h], [r * 0.92, h - 0.03], [r * 0.7, 0.03], [0, 0.03]], 48), potMat, { parent: g });
  const soil = mesh(new THREE.CircleGeometry(r * 0.93, 32), paint(0x2b2018, 1), { parent: g, pos: [0, h - 0.035, 0], rot: [-Math.PI / 2, 0, 0] });
  void soil;
  const pl = await model('pachira_aquatica_01');
  const keep = new Set(['pachira_aquatica_01_bark_' + o.variant, 'pachira_aquatica_01_leaves_' + o.variant]);
  const kill = [];
  pl.traverse(n => { if (n.isMesh && !keep.has(n.name)) kill.push(n); });
  for (const n of kill) n.parent.remove(n);
  place(ctx, pl, { x: 0, y: h - 0.04, z: 0, height: o.height, parent: g, collide: false, block: false });
  ctx.physics.add({ x: o.x, z: o.z, hx: r, hz: r, y0: 0, y1: h });
  ctx.interact.block(g);
}

async function throwPillows(ctx, sofa) {
  const src = await model('throw_pillows_01');
  const mk = (name) => {
    const n = src.getObjectByName(name);
    const c = n.clone(true);
    c.position.set(0, 0, 0);
    return c;
  };
  // couch local frame: front = +z, width along x, seat height ~0.45
  const a = mk('throw_pillows_01_pillow01'), b = mk('throw_pillows_01_pillow02');
  for (const [obj, x, ry] of [[a, -0.62, 0.35], [b, 0.66, -0.4]]) {
    const w = new THREE.Group();
    w.add(obj);
    const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
    w.scale.setScalar(0.85);
    w.position.set(x, 0.43, -0.08);
    w.rotation.set(-0.42, ry, 0);
    sofa.add(w);
  }
}

// Wardrobe: oak cabinet, two doors on real hinges, hoodies on a rail, folded stuff on shelves.
async function buildWardrobe(ctx, o) {
  const scene = ctx.scene;
  const wood = await pbr('white_oak_veneer', { color: 0xc9b9a3, roughness: 0.7, normal: 0.4 });
  const inner = await pbr('white_oak_veneer', { color: 0xa69580, roughness: 0.85, normal: 0.3 });
  const t = 0.018, h = 2.1;
  const { x0, x1, z0, z1 } = o;
  const W = { doors: [], update: null };
  mesh(boxMM(x0, 0, z0 + 0.02, x0 + t, h, z1), wood, { parent: scene });
  mesh(boxMM(x1 - t, 0, z0 + 0.02, x1, h, z1), wood, { parent: scene });
  mesh(boxMM(x0, h - t, z0 + 0.02, x1, h, z1), wood, { parent: scene });
  mesh(boxMM(x0 + t, 0, z0 + 0.03, x1 - t, 0.08, z1), inner, { parent: scene });
  mesh(boxMM(x0 + t, 0.08, z1 - 0.008, x1 - t, h - t, z1), inner, { parent: scene });
  mesh(boxMM(x0 + t, 1.78, z0 + 0.04, x1 - t, 1.78 + t, z1 - 0.008), inner, { parent: scene });
  mesh(boxMM(x0 + t, 0.42, z0 + 0.04, (x0 + x1) / 2, 0.42 + t, z1 - 0.008), inner, { parent: scene });
  ctx.physics.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2 + 0.01, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 - 0.01, y0: 0, y1: h });
  // hanging rail + hoodies
  const chrome = paint(0xd0d0d4, 0.2, 1);
  const rail = mesh(cyl(0.012, 0.012, x1 - x0 - 2 * t, 16), chrome, { parent: scene, pos: [(x0 + x1) / 2, 1.68, (z0 + z1) / 2 + 0.02], rot: [0, 0, Math.PI / 2] });
  void rail;
  const fleece = await pbr('knitted_fleece', { roughness: 1, normal: 0.7, scale: 0.7 });
  const cols = [0x26272b, 0x4b5563, 0x7a2e2e, 0x1f3a5f, 0xb8b2a6, 0x2f4f3a];
  let x = x0 + 0.1;
  for (let i = 0; i < 6; i++) {
    const m = fleece.clone(); m.color = new THREE.Color(cols[i]);
    const hood = new THREE.Group();
    mesh(new THREE.TorusGeometry(0.2, 0.004, 6, 24, Math.PI), chrome, { parent: hood, pos: [0, -0.04, 0], rot: [0, Math.PI / 2, Math.PI] });
    const bodyG = new THREE.CylinderGeometry(0.2, 0.22, 0.66, 20, 6);
    bodyG.scale(1, 1, 0.22);
    const p = bodyG.attributes.position;
    for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setX(k, p.getX(k) * (1 + 0.06 * Math.sin(yy * 9 + i))); }
    bodyG.computeVertexNormals();
    mesh(bodyG, m, { parent: hood, pos: [0, -0.4, 0], rot: [0, Math.PI / 2, 0] });
    hood.position.set(x, 1.68, (z0 + z1) / 2 + 0.02);
    hood.rotation.y = (Math.random() - 0.5) * 0.15;
    scene.add(hood);
    x += 0.17;
  }
  // folded shirts on the lower shelf + a shoe box
  for (let i = 0; i < 4; i++) {
    const m = fleece.clone(); m.color = new THREE.Color(cols[(i + 2) % cols.length]);
    mesh(box(0.3, 0.05, 0.28, 0.02), m, { parent: scene, pos: [x0 + 0.2, 0.44 + 0.025 + i * 0.052, (z0 + z1) / 2 + 0.03], rot: [0, (Math.random() - 0.5) * 0.12, 0] });
  }
  mesh(box(0.34, 0.12, 0.22, 0.004), paint(0xd24b2a, 0.7), { parent: scene, pos: [x1 - 0.25, 0.08 + 0.06, (z0 + z1) / 2 + 0.05] });
  // doors, hinged on the outer edges, opening out into the room (-z)
  const handle = paint(0x151515, 0.35, 0.8);
  const dw = (x1 - x0) / 2;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side < 0 ? x0 : x1, 0, z0 + 0.01);
    scene.add(pivot);
    const leaf = mesh(box(dw - 0.003, h - 0.006, 0.02, 0.003), wood, { parent: pivot });
    leaf.position.set(-side * dw / 2, h / 2, 0);
    mesh(box(0.012, 0.32, 0.012, 0.004), handle, { parent: pivot, pos: [-side * (dw - 0.05), 1.05, -0.022] });
    const d = { pivot, open: 0, target: 0, side };
    W.doors.push(d);
    ctx.interact.add(leaf, {
      label: () => d.target ? 'Close wardrobe' : 'Open wardrobe', range: 2.2,
      use: () => { d.target = d.target ? 0 : 1; ctx.audio.play(d.target ? 'door_open.ogg' : 'door_close.ogg', { pos: pivot.position.clone().setY(1), vol: 0.35, rate: 1.25 }); },
    });
  }
  W.update = (dt) => {
    for (const d of W.doors) {
      d.open += (d.target - d.open) * Math.min(1, dt * 4.5);
      d.pivot.rotation.y = -d.side * d.open * 1.75;
    }
  };
  return W;
}

// A game controller (made from scratch: no scan exists that matches).
function buildController(ctx) {
  const g = new THREE.Group();
  const plastic = paint(0x16171a, 0.55, 0, { roughnessMap: smudgeTex() });
  const grip = paint(0x111214, 0.8);
  const bodyG = new THREE.SphereGeometry(1, 40, 20);
  const p = bodyG.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const wing = Math.max(0, Math.abs(x) - 0.25);
    z += wing * wing * 0.9; // grips sweep back toward you
    y *= 1 - 0.25 * wing;
    p.setXYZ(i, x * 0.078, y * 0.022, z * 0.045);
  }
  bodyG.computeVertexNormals();
  mesh(bodyG, plastic, { parent: g, pos: [0, 0.03, 0] });
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(0.019, 0.04, 6, 16), grip, { parent: g, pos: [s * 0.058, 0.022, 0.048], rot: [Math.PI / 2 - 0.3, 0, s * 0.35] });
    // sticks
    mesh(cyl(0.006, 0.006, 0.014, 16), grip, { parent: g, pos: [s * 0.03 - 0.008, 0.055, s < 0 ? -0.005 : 0.018] });
    mesh(cyl(0.012, 0.011, 0.005, 24), grip, { parent: g, pos: [s * 0.03 - 0.008, 0.063, s < 0 ? -0.005 : 0.018] });
    // shoulder buttons
    mesh(box(0.03, 0.01, 0.012, 0.004), plastic, { parent: g, pos: [s * 0.055, 0.04, -0.04] });
  }
  const cols = [0x2ecc71, 0xe74c3c, 0x3498db, 0xf1c40f];
  [[0.057, -0.012], [0.07, -0.0], [0.044, 0], [0.057, 0.012]].forEach(([x, z], i) => {
    mesh(cyl(0.0045, 0.0045, 0.004, 16), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, emissive: cols[i], emissiveIntensity: 0.15, roughness: 0.3 }), { parent: g, pos: [x, 0.052, z - 0.005] });
  });
  // d-pad
  mesh(box(0.016, 0.004, 0.005, 0.001), grip, { parent: g, pos: [-0.03, 0.051, 0.019] });
  mesh(box(0.005, 0.004, 0.016, 0.001), grip, { parent: g, pos: [-0.03, 0.051, 0.019] });
  const led = mesh(box(0.02, 0.002, 0.004, 0.001), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x2b9bff, emissiveIntensity: 0 }), { parent: g, pos: [0, 0.052, -0.02] });
  ctx.scene.add(g);
  return { group: g, led };
}

function buildRemote(ctx) {
  const g = new THREE.Group();
  const m = paint(0x18191b, 0.5);
  mesh(box(0.045, 0.018, 0.17, 0.008), m, { parent: g, pos: [0, 0.009, 0] });
  const bm = paint(0x2a2b2e, 0.6);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) mesh(cyl(0.004, 0.004, 0.003, 12), bm, { parent: g, pos: [(c - 1) * 0.012, 0.019, 0.02 + r * 0.013], cast: false });
  mesh(cyl(0.005, 0.005, 0.003, 12), paint(0x6b1a1a, 0.5), { parent: g, pos: [0.013, 0.019, -0.065], cast: false });
  ctx.scene.add(g);
  return g;
}

async function buildFan(ctx, at) {
  const fan = await model('ceiling_fan');
  const g = new THREE.Group();
  g.position.copy(at);
  g.add(fan);
  ctx.scene.add(g);
  fan.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const blades = fan.getObjectByName('ceiling_fan_blades');
  // light kit: frosted glass bowl under the motor
  const bowl = mesh(new THREE.SphereGeometry(0.11, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5, emissive: 0xfff2dc, emissiveIntensity: 0 }), { parent: g, pos: [0, -0.52, 0], cast: false });
  bowl.scale.y = 0.6;
  // two pull chains: fan speed + light
  const chainMat = paint(0x55565a, 0.45, 0.9);
  const chains = [];
  for (const [i, x] of [[0, 0.135], [1, -0.135]]) {
    const ch = new THREE.Group();
    ch.position.set(x, -0.45, 0.02);
    mesh(cyl(0.0012, 0.0012, 0.3, 4), chainMat, { parent: ch, pos: [0, -0.15, 0], cast: false });
    const pull = mesh(cyl(0.006, 0.009, 0.03, 12), paint(0x2a2a2c, 0.5, 0.2), { parent: ch, pos: [0, -0.315, 0], cast: false });
    g.add(ch);
    chains.push({ ch, pull, yank: 0, i });
  }
  const F = { group: g, speed: 0, target: 0, level: 0, glow: bowl, angle: 0, snd: null };
  const names = ['Off', 'Low', 'Medium', 'High'];
  ctx.interact.add(chains[0].pull, {
    label: () => `Pull fan chain (${names[(F.level + 1) % 4]})`, range: 2.4,
    use: () => { F.level = (F.level + 1) % 4; F.target = [0, 1.1, 2.0, 3.0][F.level]; chains[0].yank = 1; ctx.audio.play('switch_off.ogg', { pos: at.clone().setY(2), vol: 0.25, rate: 1.6 }); },
  });
  ctx.interact.add(chains[1].pull, {
    label: () => ctx.lights?.rooms.bedroom.on ? 'Pull light chain (off)' : 'Pull light chain (on)', range: 2.4,
    use: () => { const L = ctx.lights; L.setRoom('bedroom', !L.rooms.bedroom.on); chains[1].yank = 1; ctx.audio.play('switch_on.ogg', { pos: at.clone().setY(2), vol: 0.25, rate: 1.6 }); },
  });
  F.update = (dt) => {
    F.speed += (F.target - F.speed) * Math.min(1, dt * (F.target > F.speed ? 0.6 : 0.25));
    F.angle += F.speed * Math.PI * 2 * dt;
    blades.rotation.y = F.angle;
    g.rotation.z = Math.sin(F.angle * 0.5) * 0.002 * F.speed; // a little wobble like a real fan
    for (const c of chains) {
      c.yank = Math.max(0, c.yank - dt * 4);
      c.ch.position.y = -0.45 - Math.sin(c.yank * Math.PI) * 0.02;
      c.ch.rotation.x = Math.sin(performance.now() / 600 + c.i) * 0.03 * (0.3 + F.speed);
    }
    const a = ctx.audio;
    if (a.ctx && !F.snd) F.snd = a.noiseLoop({ freq: 220, q: 0.5, filter: 'lowpass', pos: at.clone().setY(2.2), ref: 1, rolloff: 1 });
    if (F.snd) F.snd.setVolume(Math.min(1, F.speed / 3) * 0.06);
  };
  return F;
}

async function frameArt(ctx, name, o) {
  const fr = await model(name);
  let art;
  fr.traverse(n => { if (n.isMesh && /artwork/i.test(n.material.name)) art = n; });
  const w = place(ctx, fr, { x: o.x, y: 0, z: o.z, rot: o.rot, width: o.width, height: o.height, collide: false });
  // stand it on its edge against the wall at the right height
  const sz = w.userData.size;
  w.position.y = o.y - sz.y / 2;
  // it was modeled lying flat or standing? make sure the thin side faces out of the wall
  if (art) {
    const t = canvasTex(1024, 1024, o.art);
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    art.material = art.material.clone();
    art.material.map = t;
    art.material.roughness = 0.6;
  }
  return w;
}

// Art: a dusk landscape print (layered hills, sun, grain).
function landscapeArt(c, w, h) {
  const sky = c.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#1d2b4a'); sky.addColorStop(0.55, '#c86b5a'); sky.addColorStop(1, '#f2b880');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,236,200,0.9)'; c.beginPath(); c.arc(w * 0.66, h * 0.52, w * 0.07, 0, Math.PI * 2); c.fill();
  const layers = ['#7a4a55', '#55344a', '#3a2540', '#24182c', '#150f1c'];
  layers.forEach((col, k) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
    const base = h * (0.5 + k * 0.1), amp = h * (0.08 - k * 0.008);
    for (let x = 0; x <= w; x += 4) c.lineTo(x, base - amp * (Math.sin(x / (90 + k * 30) + k * 2) * 0.6 + Math.sin(x / (37 + k * 11) + k) * 0.25 + Math.sin(x / 13 + k * 5) * 0.05));
    c.lineTo(w, h); c.closePath(); c.fill();
  });
  grain(c, w, h, 14);
}

// Art: a minimal print for the in-game shooter DUSTLINE.
function posterArt(c, w, h) {
  c.fillStyle = '#e9e1d0'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#c4572e'; c.beginPath(); c.arc(w / 2, h * 0.42, w * 0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1e1b18';
  c.beginPath(); c.moveTo(0, h * 0.62);
  for (let x = 0; x <= w; x += 6) c.lineTo(x, h * 0.62 - Math.max(0, Math.sin(x / 60) * 30 + Math.sin(x / 17) * 6));
  c.lineTo(w, h * 0.68); c.lineTo(0, h * 0.68); c.fill();
  c.fillRect(0, h * 0.68, w, h * 0.004);
  c.font = '900 120px "Arial Black", Arial, sans-serif'; c.textAlign = 'center';
  c.fillText('DUSTLINE', w / 2, h * 0.82);
  c.font = '600 26px Arial, sans-serif'; c.fillStyle = '#4b4540';
  c.fillText('HOLD THE LINE  •  SEASON ONE', w / 2, h * 0.88);
  grain(c, w, h, 18);
}

function grain(c, w, h, amt) {
  const im = c.getImageData(0, 0, w, h);
  for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - 0.5) * amt; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
  c.putImageData(im, 0, 0);
}
