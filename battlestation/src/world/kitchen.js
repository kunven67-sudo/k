import * as THREE from 'three';
import { mesh, box, boxMM, cyl, lathe, tube } from './build.js';
import { pbr, paint, canvasTex, smudgeTex } from './materials.js';
import { model, place, clockHands } from './models.js';
import { energyCan } from './bedroom.js';

// Kitchen (x 6.94..10.94, z 0..3.6): counters along the window wall with a sink under the window,
// an electric range, a microwave, a fridge you can raid, a dining table, a clock, a trash can.
const X0 = 6.94, X1 = 10.94, Z0 = 0, Z1 = 3.6;
const DEPTH = 0.62, BASE_H = 0.87, TOP_H = 0.9;

export async function buildKitchen(ctx) {
  const scene = ctx.scene;
  const K = { tick: [], items: [] };
  const [wood, marble] = await Promise.all([
    pbr('kitchen_wood', { color: 0xe9e4dc, roughness: 0.6, normal: 0.35 }),
    pbr('marble_01', { color: 0xf2f0ec, roughness: 0.18, normal: 0.25, env: 1.2, scale: 0.8 }),
  ]);
  const steel = paint(0xc9ccd0, 0.3, 1, { roughnessMap: smudgeTex() });
  const darkSteel = paint(0x2a2c30, 0.35, 0.8);
  const handleMat = paint(0x1b1c1e, 0.32, 0.85);
  const carcass = paint(0xece9e4, 0.6);
  K.surfaces = [];

  // ---- base cabinets with doors you can open ----------------------------------------------
  const runs = [
    { x0: 7.0, x1: 7.69, kind: 'drawers' },
    { x0: 7.69, x1: 8.45, kind: 'range' },
    { x0: 8.45, x1: 9.25, kind: 'sink' },
    { x0: 9.25, x1: 9.85, kind: 'dishwasher' },
    { x0: 9.85, x1: 10.17, kind: 'door' },
  ];
  K.doors = [];
  for (const r of runs) {
    if (r.kind === 'range') continue;
    mesh(boxMM(r.x0, 0.1, Z0 + 0.02, r.x1, BASE_H, Z0 + DEPTH - 0.02), carcass, { parent: scene });
    mesh(boxMM(r.x0 + 0.01, 0, Z0 + 0.02, r.x1 - 0.01, 0.1, Z0 + DEPTH - 0.07), paint(0x1a1a1a, 0.8), { parent: scene }); // toe kick
    if (r.kind === 'drawers') {
      for (let i = 0; i < 3; i++) frontPanel(ctx, K, { x0: r.x0, x1: r.x1, y0: 0.12 + i * 0.25, y1: 0.12 + (i + 1) * 0.25 - 0.005, z: Z0 + DEPTH, wood, handleMat, drawer: true });
    } else if (r.kind === 'dishwasher') {
      mesh(boxMM(r.x0 + 0.003, 0.1, Z0 + DEPTH - 0.02, r.x1 - 0.003, BASE_H - 0.005, Z0 + DEPTH), steel, { parent: scene });
      mesh(box(r.x1 - r.x0 - 0.08, 0.012, 0.02, 0.006), darkSteel, { parent: scene, pos: [(r.x0 + r.x1) / 2, BASE_H - 0.06, Z0 + DEPTH + 0.015] });
      const led = mesh(new THREE.BoxGeometry(0.06, 0.008, 0.002), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x3bd16f, emissiveIntensity: 0.6 }), { parent: scene, cast: false });
      led.position.set(r.x1 - 0.1, BASE_H - 0.03, Z0 + DEPTH + 0.002);
    } else {
      const w = r.x1 - r.x0;
      if (r.kind === 'sink' || w > 0.5) {
        frontPanel(ctx, K, { x0: r.x0, x1: (r.x0 + r.x1) / 2, y0: 0.12, y1: BASE_H - 0.01, z: Z0 + DEPTH, wood, handleMat, hinge: -1 });
        frontPanel(ctx, K, { x0: (r.x0 + r.x1) / 2, x1: r.x1, y0: 0.12, y1: BASE_H - 0.01, z: Z0 + DEPTH, wood, handleMat, hinge: 1 });
      } else frontPanel(ctx, K, { x0: r.x0, x1: r.x1, y0: 0.12, y1: BASE_H - 0.01, z: Z0 + DEPTH, wood, handleMat, hinge: -1 });
    }
  }
  // countertop with a hole for the sink
  const sinkX0 = 8.55, sinkX1 = 9.15, sinkZ0 = 0.1, sinkZ1 = 0.52;
  for (const [a, b, c, d] of [[7.0, Z0, sinkX0, Z0 + DEPTH + 0.02], [sinkX1, Z0, 10.17, Z0 + DEPTH + 0.02], [sinkX0, Z0, sinkX1, sinkZ0], [sinkX0, sinkZ1, sinkX1, Z0 + DEPTH + 0.02]]) {
    const top = mesh(boxMM(a, BASE_H, c === sinkX0 ? b : b, c, TOP_H, d), marble, { parent: scene, name: 'counter' });
    K.surfaces.push(top); ctx.interact.block(top);
  }
  // backsplash tiles between counter and uppers
  const tileMat = new THREE.MeshStandardMaterial({ map: subwayTex(), roughness: 0.12, envMapIntensity: 1.1 });
  const bs = mesh(new THREE.PlaneGeometry(10.17 - 7.0, 0.55), tileMat, { parent: scene, pos: [(7.0 + 10.17) / 2, TOP_H + 0.275, Z0 + 0.004], cast: false });
  { const uv = bs.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (10.17 - 7.0) / 0.6, uv.getY(i) * 0.55 / 0.6); }
  // skip the tiles behind the window
  bs.geometry = splitAround(bs.geometry);
  ctx.physics.add({ x: (7.0 + 10.17) / 2, z: DEPTH / 2 + 0.01, hx: (10.17 - 7.0) / 2, hz: DEPTH / 2 + 0.01, y0: 0, y1: TOP_H });

  // ---- sink + faucet + running water -------------------------------------------------------
  const basin = new THREE.Group();
  const bw = sinkX1 - sinkX0, bd = sinkZ1 - sinkZ0, deep = 0.2;
  mesh(boxMM(sinkX0, TOP_H - deep, sinkZ0, sinkX1, TOP_H - deep + 0.004, sinkZ1), steel, { parent: basin });
  for (const [a, b, c, d] of [[sinkX0, sinkZ0, sinkX1, sinkZ0 + 0.004], [sinkX0, sinkZ1 - 0.004, sinkX1, sinkZ1], [sinkX0, sinkZ0, sinkX0 + 0.004, sinkZ1], [sinkX1 - 0.004, sinkZ0, sinkX1, sinkZ1]]) mesh(boxMM(a, TOP_H - deep, b, c, TOP_H, d), steel, { parent: basin });
  mesh(cyl(0.022, 0.022, 0.003, 24), darkSteel, { parent: basin, pos: [(sinkX0 + sinkX1) / 2, TOP_H - deep + 0.005, (sinkZ0 + sinkZ1) / 2] });
  scene.add(basin);
  void bw; void bd;
  const faucet = new THREE.Group();
  faucet.position.set((sinkX0 + sinkX1) / 2, TOP_H, 0.06);
  mesh(cyl(0.024, 0.028, 0.03, 24), steel, { parent: faucet, pos: [0, 0.015, 0] });
  mesh(tube([[0, 0.02, 0], [0, 0.3, 0], [0, 0.36, 0.06], [0, 0.32, 0.2], [0, 0.29, 0.23]], 0.013, 48), steel, { parent: faucet });
  const lever = mesh(box(0.012, 0.012, 0.09, 0.005), steel, { parent: faucet, pos: [0.035, 0.07, 0.02] });
  scene.add(faucet);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.5, depthWrite: false, envMapIntensity: 2 });
  const stream = mesh(new THREE.CylinderGeometry(0.0065, 0.0055, 1, 12, 8, true), waterMat, { parent: scene, cast: false });
  const spout = faucet.position.clone().add(new THREE.Vector3(0, 0.285, 0.23));
  const streamLen = spout.y - (TOP_H - deep);
  stream.scale.y = streamLen; stream.position.set(spout.x, spout.y - streamLen / 2, spout.z); stream.visible = false;
  K.tap = { on: false, snd: null };
  ctx.interact.add(faucet, {
    range: 1.8,
    label: () => K.tap.on ? (ctx.needs && ctx.needs.v.thirst > 0.08 ? 'Turn off the water' : 'Turn off the water') : 'Turn on the water',
    use: () => {
      K.tap.on = !K.tap.on;
      lever.rotation.x = K.tap.on ? -0.6 : 0;
      stream.visible = K.tap.on;
      if (K.tap.on && ctx.audio.ctx) K.tap.snd = ctx.audio.play('water_loop.ogg', { pos: spout, loop: true, vol: 0.4, ref: 0.6 });
      else if (K.tap.snd) { K.tap.snd.stop?.(); K.tap.snd = null; }
    },
  });
  ctx.interact.add(stream, {
    range: 1.8, label: () => 'Drink from the tap', enabled: () => K.tap.on,
    use: () => { ctx.needs?.drink(0.18, { text: 'You drink some cold water from the tap.' }); ctx.audio.burst({ pos: spout, freq: 500, q: 0.5, vol: 0.06, env: [0.05, 0.4, 0.2] }); },
  });
  K.tick.push((dt) => { if (stream.visible) stream.rotation.y += dt * 9; });

  // ---- electric range (glass top, 4 burners that glow, oven door) -------------------------------
  const rx0 = 7.69, rx1 = 8.45, rcx = (rx0 + rx1) / 2;
  mesh(boxMM(rx0 + 0.003, 0, Z0 + 0.03, rx1 - 0.003, TOP_H - 0.006, Z0 + DEPTH), steel, { parent: scene });
  const glass = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.3 });
  const cooktop = mesh(boxMM(rx0, TOP_H - 0.006, Z0 + 0.03, rx1, TOP_H + 0.002, Z0 + DEPTH), glass, { parent: scene, name: 'counter' });
  K.surfaces.push(cooktop); ctx.interact.block(cooktop);
  mesh(boxMM(rx0 + 0.04, 0.12, Z0 + DEPTH, rx1 - 0.04, 0.72, Z0 + DEPTH + 0.01), glass, { parent: scene }); // oven window door
  mesh(box(rx1 - rx0 - 0.14, 0.018, 0.018, 0.008), steel, { parent: scene, pos: [rcx, 0.69, Z0 + DEPTH + 0.04] });
  K.burners = [];
  const burnerSpots = [[-0.17, 0.17, 0.11], [0.17, 0.17, 0.085], [-0.17, 0.45, 0.085], [0.17, 0.45, 0.11]];
  burnerSpots.forEach(([dx, z, r], i) => {
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, emissive: 0xff3a10, emissiveIntensity: 0 });
    const ring = mesh(new THREE.RingGeometry(r * 0.25, r, 40, 1), ringMat, { parent: scene, cast: false, rot: [-Math.PI / 2, 0, 0] });
    ring.position.set(rcx + dx, TOP_H + 0.0025, z);
    mesh(new THREE.RingGeometry(r, r + 0.003, 48), paint(0x666666, 0.4), { parent: scene, cast: false, rot: [-Math.PI / 2, 0, 0], pos: [rcx + dx, TOP_H + 0.0026, z] });
    const knob = mesh(cyl(0.017, 0.019, 0.022, 20), darkSteel, { parent: scene, rot: [Math.PI / 2, 0, 0] });
    knob.position.set(rcx - 0.24 + i * 0.16, 0.8, Z0 + DEPTH + 0.012);
    const b = { ring, ringMat, knob, level: 0, heat: 0 };
    K.burners.push(b);
    ctx.interact.add(knob, {
      range: 1.6, label: () => b.level ? `Burner ${i + 1}: ${['off', 'low', 'medium', 'high'][b.level]} (turn)` : `Turn on burner ${i + 1}`,
      use: () => { b.level = (b.level + 1) % 4; knob.rotation.z = -b.level * 0.9; ctx.audio.beep(2400, 0.015, { vol: 0.02, type: 'square', pos: knob.position }); },
    });
  });
  K.tick.push((dt) => {
    for (const b of K.burners) {
      // electric coils take a while to glow and a while to cool
      const t = b.level / 3;
      b.heat += (t - b.heat) * Math.min(1, dt * (t > b.heat ? 0.35 : 0.18));
      b.ringMat.emissiveIntensity = Math.max(0, b.heat - 0.15) * 3.2;
    }
  });
  // range hood above
  mesh(boxMM(rx0 - 0.02, 1.62, Z0, rx1 + 0.02, 1.72, Z0 + 0.5), steel, { parent: scene });
  mesh(boxMM(rcx - 0.14, 1.72, Z0, rcx + 0.14, 2.6, Z0 + 0.25), steel, { parent: scene });

  // ---- upper cabinets (not over the window) ----------------------------------------------------
  for (const [a, b] of [[7.0, rx0 - 0.02], [9.55, 10.17]]) {
    mesh(boxMM(a, 1.45, Z0, b, 2.2, Z0 + 0.33), carcass, { parent: scene });
    const n = Math.max(1, Math.round((b - a) / 0.4));
    for (let i = 0; i < n; i++) frontPanel(ctx, K, { x0: a + (b - a) * i / n, x1: a + (b - a) * (i + 1) / n, y0: 1.455, y1: 2.195, z: Z0 + 0.33, wood, handleMat, hinge: i % 2 ? 1 : -1, upper: true });
    // dishes inside
    for (let k = 0; k < n; k++) {
      const cx = a + (b - a) * (k + 0.5) / n;
      for (let j = 0; j < 6; j++) mesh(cyl(0.11, 0.09, 0.012, 32), paint(0xf4f3f0, 0.25), { parent: scene, pos: [cx, 1.47 + j * 0.014, 0.17], cast: false });
      for (let j = 0; j < 3; j++) mesh(lathe([[0, 0], [0.032, 0], [0.036, 0.12], [0.034, 0.12], [0.03, 0.004], [0, 0.004]], 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25 }), { parent: scene, pos: [cx - 0.08 + j * 0.08, 1.85, 0.16], cast: false });
    }
  }

  // ---- microwave on the counter ----------------------------------------------------------------
  K.micro = buildMicrowave(ctx, new THREE.Vector3(7.33, TOP_H, 0.3));
  K.tick.push(dt => K.micro.update(dt));

  // ---- fridge ---------------------------------------------------------------------------------------
  K.fridge = await buildFridge(ctx, K, { x0: 10.2, x1: 10.92, z0: 0.02, z1: 0.74, h: 1.8 });
  K.tick.push(dt => K.fridge.update(dt));

  // ---- dining table + chairs + fruit -------------------------------------------------------------------
  const table = await model('dining_table');
  K.table = place(ctx, table, { x: 8.95, z: 2.55, height: 0.76 });
  K.surfaces.push(K.table);
  const tTop = K.table.userData.size.y;
  for (const [x, z, r] of [[8.45, 1.78, 0], [9.45, 1.78, 0], [8.45, 3.3, Math.PI], [9.45, 3.3, Math.PI]]) {
    const ch = await model('dining_chair_02');
    place(ctx, ch, { x, z, height: 0.97, rot: r + (Math.random() - 0.5) * 0.15, pad: -0.04 });
  }
  const bowl = mesh(lathe([[0, 0], [0.1, 0], [0.14, 0.03], [0.15, 0.08], [0.146, 0.08], [0.135, 0.032], [0.095, 0.006], [0, 0.006]], 40), paint(0xe9e2d6, 0.35), { parent: scene, pos: [8.9, tTop, 2.5] });
  void bowl;
  const ban = await model('bananas');
  ban.traverse(o => { if (o.isMesh && o.name !== 'bananas_bunch') o.visible = false; });
  place(ctx, ban, { x: 8.87, y: tTop + 0.012, z: 2.48, height: 0.13, rot: 0.6, collide: false });
  for (const [dx, dz] of [[0.06, 0.05], [-0.04, 0.07]]) {
    const ap = await model('food_apple_01');
    const w = place(ctx, ap, { x: 8.9 + dx, y: tTop + 0.03, z: 2.5 + dz, height: 0.08, rot: Math.random() * 6, collide: false });
    K.items.push(foodItem(ctx, w, { name: 'apple', eat: 0.12, text: 'Crunchy apple.' }));
  }
  const board = await model('wooden_cutting_board');
  place(ctx, board, { x: 9.6, y: TOP_H, z: 0.32, width: 0.42, rot: 0.1, collide: false });
  // wall clock above the table
  const clk = await model('wall_clock');
  const cw = place(ctx, clk, { x: 8.95, y: 1.75, z: Z1 - 0.03, width: 0.32, rot: Math.PI, collide: false });
  void cw;
  const hands = clockHands(clk, { hour: 'wall_clock_hours_hand', minute: 'wall_clock_minute_hand', second: 'wall_clock_second_hand' }, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
  K.tick.push(() => hands.set(ctx.now()));

  // ---- trash can (step on the pedal: lid opens) ----------------------------------------------------
  K.trash = buildTrash(ctx, new THREE.Vector3(10.68, 0, 1.25));
  K.tick.push(dt => K.trash.update(dt));

  // ---- pendant light over the table ---------------------------------------------------------------
  const lamp = await model('modern_ceiling_lamp_01');
  place(ctx, lamp, { x: 8.95, y: 2.6 - 0.95, z: 2.55, height: 0.95, collide: false, block: false });

  K.update = (dt) => { for (const f of K.tick) f(dt); };
  return K;
}

// A cabinet door or drawer front. Doors swing on hinges, drawers slide out.
function frontPanel(ctx, K, o) {
  const scene = ctx.scene;
  const w = o.x1 - o.x0 - 0.004, h = o.y1 - o.y0;
  const g = new THREE.Group();
  const panel = mesh(box(w, h, 0.018, 0.003), o.wood, { parent: g });
  // handle: bar pull
  const hl = o.drawer ? 0.16 : 0.12;
  const hx = o.drawer ? 0 : (o.hinge < 0 ? w / 2 - 0.045 : -w / 2 + 0.045);
  const hy = o.drawer ? h / 2 - 0.05 : (o.upper ? -h / 2 + 0.08 : h / 2 - 0.08);
  const bar = mesh(o.drawer ? box(hl, 0.011, 0.011, 0.005) : box(0.011, hl, 0.011, 0.005), o.handleMat, { parent: g, pos: [hx, hy, 0.025] });
  void bar;
  const d = { g, open: 0, target: 0, o };
  if (o.drawer) { g.position.set((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, o.z + 0.009); }
  else {
    // pivot on the hinge edge
    const px = o.hinge < 0 ? o.x0 + 0.002 : o.x1 - 0.002;
    g.position.set(px, (o.y0 + o.y1) / 2, o.z + 0.009);
    panel.position.x = o.hinge < 0 ? w / 2 : -w / 2;
    bar.position.x = o.hinge < 0 ? w - 0.045 : -w + 0.045;
  }
  scene.add(g);
  K.doors.push(d);
  ctx.interact.add(g, {
    range: 1.9, label: () => d.target ? (o.drawer ? 'Close drawer' : 'Close cabinet') : (o.drawer ? 'Open drawer' : 'Open cabinet'),
    use: () => { d.target = d.target ? 0 : 1; ctx.audio.play(d.target ? 'door_open.ogg' : 'door_close.ogg', { pos: g.position, vol: 0.25, rate: 1.5 }); },
  });
  K.tick.push((dt) => {
    d.open += (d.target - d.open) * Math.min(1, dt * 7);
    if (o.drawer) g.position.z = o.z + 0.009 + d.open * 0.38;
    else g.rotation.y = (o.hinge < 0 ? -1 : 1) * d.open * 1.6;
  });
  return d;
}

function subwayTex() {
  const t = canvasTex(512, 512, (c, W, Hh) => {
    c.fillStyle = '#bdbab3'; c.fillRect(0, 0, W, Hh);
    const tw = W / 4, th = Hh / 8;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      const ox = (y % 2) * tw / 2;
      const v = 238 + Math.random() * 8;
      c.fillStyle = `rgb(${v},${v},${v - 2})`;
      c.fillRect(x * tw + ox + 2, y * th + 2, tw - 4, th - 4);
    }
  });
  return t;
}

// The backsplash plane minus the window opening (x 8.25..9.45 above y ~1.05).
function splitAround(geo) {
  void geo;
  const parts = [];
  const add = (x0, x1, y0, y1) => { const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0); parts.push(g); };
  const y0 = TOP_H, y1 = TOP_H + 0.55;
  add(7.0, 8.2, y0, y1); add(9.5, 10.17, y0, y1); add(8.2, 9.5, y0, 1.03);
  const g = parts.reduce((a, b) => { a = a || b; return a; }, null);
  const merged = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  let off = 0;
  for (const p of parts) {
    const P = p.attributes.position;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), 0); uv.push(P.getX(i) / 0.6, P.getY(i) / 0.6); }
    const I = p.index.array;
    for (const k of I) idx.push(k + off);
    off += P.count;
  }
  void g;
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  merged.setIndex(idx);
  merged.computeVertexNormals();
  // the mesh sits at its own position: undo it so these world coords land right
  merged.translate(-(7.0 + 10.17) / 2, -(TOP_H + 0.275), 0);
  return merged;
}

function buildMicrowave(ctx, at) {
  const g = new THREE.Group();
  g.position.copy(at);
  ctx.scene.add(g);
  const W = 0.48, Hh = 0.28, D = 0.36;
  const body = paint(0x1c1d20, 0.4, 0.3);
  // shell (open front) + inside
  mesh(boxMM(-W / 2, 0, -D / 2, W / 2, 0.012, D / 2), body, { parent: g });
  mesh(boxMM(-W / 2, Hh - 0.012, -D / 2, W / 2, Hh, D / 2), body, { parent: g });
  mesh(boxMM(-W / 2, 0, -D / 2, -W / 2 + 0.012, Hh, D / 2), body, { parent: g });
  mesh(boxMM(W / 2 - 0.13, 0, -D / 2, W / 2, Hh, D / 2), body, { parent: g });
  mesh(boxMM(-W / 2, 0, -D / 2, W / 2, Hh, -D / 2 + 0.01), body, { parent: g });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.6, emissive: 0xffe2b0, emissiveIntensity: 0 });
  mesh(boxMM(-W / 2 + 0.013, 0.013, -D / 2 + 0.011, W / 2 - 0.131, 0.014, D / 2 - 0.02), innerMat, { parent: g });
  mesh(boxMM(-W / 2 + 0.013, 0.013, -D / 2 + 0.011, W / 2 - 0.131, Hh - 0.013, -D / 2 + 0.012), innerMat, { parent: g });
  const plate = mesh(cyl(0.12, 0.12, 0.006, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.5 }), { parent: g, pos: [-0.06, 0.02, 0] });
  // door on the left hinge with a dark window
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-W / 2, 0, D / 2);
  g.add(doorPivot);
  const doorW = W - 0.13;
  mesh(boxMM(0, 0.005, 0, doorW, Hh - 0.005, 0.02), body, { parent: doorPivot });
  mesh(boxMM(0.03, 0.04, 0.0205, doorW - 0.03, Hh - 0.04, 0.0215), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, transparent: true, opacity: 0.82 }), { parent: doorPivot, cast: false });
  // control panel: green clock display
  const disp = canvasTex(128, 48, () => {});
  disp.wrapS = disp.wrapT = THREE.ClampToEdgeWrapping;
  mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshStandardMaterial({ map: disp, emissiveMap: disp, emissive: 0xffffff, emissiveIntensity: 1.2, color: 0x000000 }), { parent: g, pos: [W / 2 - 0.065, Hh - 0.06, D / 2 + 0.001], cast: false });
  const btn = mesh(box(0.08, 0.1, 0.006, 0.004), paint(0x2b2c30, 0.5), { parent: g, pos: [W / 2 - 0.065, Hh / 2 - 0.04, D / 2 + 0.003] });
  const light = new THREE.PointLight(0xffd9a0, 0, 0.8, 2);
  light.position.set(-0.06, Hh * 0.6, 0);
  g.add(light);
  const M = { g, doorPivot, open: 0, target: 0, running: 0, food: null, hum: null, t: 0, dispTex: disp, done: false };
  const drawDisp = (txt) => {
    const c = disp.image.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, 128, 48);
    c.fillStyle = '#5dff7a'; c.font = 'bold 34px "Courier New", monospace'; c.textAlign = 'center'; c.fillText(txt, 64, 36);
    disp.needsUpdate = true;
  };
  M.drawDisp = drawDisp;
  const pos = at.clone().add(new THREE.Vector3(0, 0.14, 0));
  ctx.interact.add(doorPivot, {
    range: 1.9, label: () => M.target ? 'Close microwave' : 'Open microwave',
    use: () => {
      if (M.running) { M.running = 0; M.stop(); }
      M.target = M.target ? 0 : 1;
      ctx.audio.play(M.target ? 'microwave_open.ogg' : 'microwave_close.ogg', { pos, vol: 0.45 });
    },
  });
  ctx.interact.add(btn, {
    range: 1.9,
    label: () => M.running ? `Stop (${Math.ceil(M.running)}s)` : M.target ? 'Close the door first' : M.food ? 'Start (1:00)' : 'Start (it\'s empty)',
    use: () => {
      ctx.audio.beep(2600, 0.06, { vol: 0.03, pos });
      if (M.running) { M.running = 0; M.stop(); return; }
      if (M.target) return;
      M.running = 60; M.done = false;
      if (ctx.audio.ctx) M.hum = ctx.audio.noiseLoop({ freq: 120, q: 2, filter: 'bandpass', pos, ref: 0.5 });
      M.hum?.setVolume(0.08);
    },
  });
  M.stop = () => { M.hum?.setVolume(0, 0.05); const h = M.hum; setTimeout(() => h?.src.stop(), 300); M.hum = null; };
  M.update = (dt) => {
    M.open += (M.target - M.open) * Math.min(1, dt * 6);
    doorPivot.rotation.y = -M.open * 1.75;
    const lit = M.running || M.open > 0.05 ? 1 : 0;
    light.intensity = lit * 0.6; innerMat.emissiveIntensity = lit * 0.35;
    if (M.running) {
      M.running = Math.max(0, M.running - dt);
      plate.rotation.y += dt * 0.6;
      const s = Math.ceil(M.running);
      drawDisp(`0:${String(s).padStart(2, '0')}`);
      if (M.running === 0) {
        M.stop(); M.done = true;
        for (let i = 0; i < 3; i++) ctx.audio.beep(2400, 0.35, { vol: 0.04, pos, delay: i * 0.6, type: 'square' });
        if (M.food) M.food.hot = true;
      }
    } else {
      const now = ctx.now();
      const t = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (t !== M._t) { M._t = t; drawDisp(t); }
    }
  };
  M.inside = new THREE.Vector3(-0.06, 0.026, 0).add(at);
  drawDisp('12:00');
  return M;
}

// Fridge + freezer, with a light that comes on and real food + drinks inside.
async function buildFridge(ctx, K, o) {
  const scene = ctx.scene;
  const { x0, x1, z0, z1, h } = o;
  const steel = paint(0xd2d5d8, 0.28, 1, { roughnessMap: smudgeTex() });
  const white = paint(0xf3f3f1, 0.45);
  const W = x1 - x0, D = z1 - z0, split = 1.18;
  // cabinet with an open front
  mesh(boxMM(x0, 0, z0, x0 + 0.02, h, z1 - 0.04), steel, { parent: scene });
  mesh(boxMM(x1 - 0.02, 0, z0, x1, h, z1 - 0.04), steel, { parent: scene });
  mesh(boxMM(x0, h - 0.02, z0, x1, h, z1 - 0.04), steel, { parent: scene });
  mesh(boxMM(x0, 0, z0, x1, 0.06, z1 - 0.04), paint(0x1a1a1a, 0.7), { parent: scene });
  mesh(boxMM(x0 + 0.02, 0.06, z0, x1 - 0.02, h - 0.02, z0 + 0.03), white, { parent: scene });
  mesh(boxMM(x0 + 0.02, split - 0.025, z0 + 0.03, x1 - 0.02, split + 0.015, z1 - 0.04), white, { parent: scene });
  mesh(boxMM(x0 + 0.02, 0.06, z0 + 0.03, x1 - 0.02, 0.07, z1 - 0.04), white, { parent: scene });
  ctx.physics.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: W / 2, hz: D / 2, y0: 0, y1: h });
  // glass shelves
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xe8f0f4, roughness: 0.05, transparent: true, opacity: 0.35 });
  const shelves = [0.42, 0.74, 1.4];
  for (const y of shelves) mesh(boxMM(x0 + 0.025, y, z0 + 0.04, x1 - 0.025, y + 0.006, z1 - 0.06), shelfMat, { parent: scene, cast: false });
  // inside light
  const lightF = new THREE.PointLight(0xeaf4ff, 0, 1.4, 2);
  lightF.position.set((x0 + x1) / 2, 1.05, z0 + 0.25);
  scene.add(lightF);
  // doors hinge on the right (east, near the wall), open toward the room
  const doors = [];
  for (const [y0, y1, name] of [[0.07, split - 0.008, 'fridge'], [split + 0.008, h - 0.005, 'freezer']]) {
    const piv = new THREE.Group();
    piv.position.set(x1, 0, z1 - 0.04);
    scene.add(piv);
    mesh(boxMM(-W, y0, 0, 0, y1, 0.05), steel, { parent: piv });
    // door shelves with bottles
    mesh(boxMM(-W + 0.05, y0 + 0.2, -0.09, -0.05, y0 + 0.21, -0.002), white, { parent: piv, cast: false });
    mesh(boxMM(-W + 0.05, y0 + 0.21, -0.09, -0.05, y0 + 0.27, -0.087), shelfMat, { parent: piv, cast: false });
    // vertical bar handle on the free (left) edge
    mesh(box(0.016, Math.min(0.6, (y1 - y0) * 0.7), 0.016, 0.007), paint(0x9aa0a6, 0.25, 1), { parent: piv, pos: [-W + 0.04, name === 'fridge' ? y1 - 0.35 : y0 + 0.2, 0.08] });
    const d = { piv, open: 0, target: 0, name };
    doors.push(d);
    ctx.interact.add(piv, {
      range: 2.0, label: () => d.target ? `Close the ${name}` : `Open the ${name}`,
      use: () => { d.target = d.target ? 0 : 1; ctx.audio.play(d.target ? 'door_open.ogg' : 'door_close.ogg', { pos: piv.position.clone().setY((y0 + y1) / 2), vol: 0.3, rate: 1.7 }); },
    });
  }
  // contents: drinks + food (things you can take and use)
  const cx = (x0 + x1) / 2;
  const items = [];
  for (let i = 0; i < 4; i++) {
    const can = await energyCan(ctx, { x: x0 + 0.1 + i * 0.075, y: shelves[0] + 0.006, z: z0 + 0.42, flavor: i % 3, rot: 0 });
    items.push(can);
  }
  // water bottles
  for (let i = 0; i < 3; i++) {
    const b = waterBottle(ctx);
    b.position.set(x0 + 0.12 + i * 0.09, 0.075, z0 + 0.4);
    scene.add(b);
    K.items.push(drinkItem(ctx, b, { name: 'water bottle', sips: 5, per: 0.09, text: 'Cold water.' }));
  }
  // milk carton
  const milk = new THREE.Group();
  mesh(box(0.075, 0.2, 0.075, 0.004), new THREE.MeshStandardMaterial({ map: cartonTex(), roughness: 0.55 }), { parent: milk, pos: [0, 0.1, 0] });
  mesh(new THREE.CylinderGeometry(0.0, 0.053, 0.04, 4, 1).rotateY(Math.PI / 4), white, { parent: milk, pos: [0, 0.22, 0] });
  milk.position.set(x1 - 0.14, shelves[1] + 0.006, z0 + 0.3);
  scene.add(milk);
  K.items.push(drinkItem(ctx, milk, { name: 'milk', sips: 8, per: 0.07, eat: 0.04, text: 'Cold milk.' }));
  // leftover pizza box with slices
  const pz = new THREE.Group();
  mesh(box(0.34, 0.04, 0.34, 0.004), paint(0xc9a173, 0.85), { parent: pz, pos: [0, 0.02, 0] });
  pz.position.set(cx, shelves[1] + 0.006, z0 + 0.3);
  scene.add(pz);
  for (let i = 0; i < 3; i++) {
    const s = pizzaSlice();
    s.position.set(cx - 0.08 + i * 0.08, shelves[1] + 0.05, z0 + 0.3 + (i % 2) * 0.04);
    scene.add(s);
    K.items.push(foodItem(ctx, s, { name: 'pizza slice', eat: 0.28, bites: 3, text: 'Cold pizza. Still good.', hotText: 'Hot pizza. Way better.', micro: true }));
  }
  // freezer: ice cream tub
  const ice = new THREE.Group();
  mesh(cyl(0.065, 0.055, 0.12, 32), new THREE.MeshStandardMaterial({ map: iceTex(), roughness: 0.5 }), { parent: ice, pos: [0, 0.06, 0] });
  mesh(cyl(0.067, 0.067, 0.015, 32), paint(0xf0e6d2, 0.4), { parent: ice, pos: [0, 0.125, 0] });
  ice.position.set(cx + 0.12, split + 0.02, z0 + 0.35);
  scene.add(ice);
  K.items.push(foodItem(ctx, ice, { name: 'ice cream', eat: 0.15, bites: 4, text: 'Ice cream straight from the tub.', sugar: 0.3, cold: true }));
  void items;
  const F = { doors, light: lightF, hum: null };
  F.update = (dt) => {
    let anyOpen = 0;
    for (const d of doors) { d.open += (d.target - d.open) * Math.min(1, dt * 5); d.piv.rotation.y = -d.open * 1.9; anyOpen = Math.max(anyOpen, d.open); }
    lightF.intensity = doors[0].open > 0.05 ? 1.2 : 0;
    const a = ctx.audio;
    if (a.ctx && !F.hum) { F.hum = a.play('fridge_loop.ogg', { pos: new THREE.Vector3(cx, 1.6, z0 + 0.3), loop: true, vol: 0.18, ref: 0.6, bus: 'ambient' }); }
    // open too long: real fridges beep at you
    F.openT = anyOpen > 0.3 ? (F.openT || 0) + dt : 0;
    if (F.openT > 45 && Math.floor(F.openT) % 3 === 0 && Math.floor(F.openT - dt) % 3 !== 0) a.beep(1800, 0.25, { vol: 0.03, pos: new THREE.Vector3(cx, 1.4, z1) });
  };
  return F;
}

function waterBottle() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xdcecff, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 1.5 });
  mesh(lathe([[0, 0], [0.032, 0], [0.034, 0.02], [0.033, 0.15], [0.03, 0.17], [0.014, 0.2], [0.014, 0.21], [0, 0.21]], 28), mat, { parent: g, cast: false });
  mesh(cyl(0.0155, 0.0155, 0.018, 20), paint(0x2c6fd1, 0.4), { parent: g, pos: [0, 0.218, 0] });
  mesh(cyl(0.0345, 0.0345, 0.06, 28, true), paint(0x2c6fd1, 0.5), { parent: g, pos: [0, 0.09, 0], cast: false });
  return g;
}

function pizzaSlice() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(-0.045, 0.14); s.quadraticCurveTo(0, 0.155, 0.045, 0.14); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 0.07);
  const top = canvasTex(64, 64, (c) => {
    c.fillStyle = '#d9a43a'; c.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 9; i++) { c.fillStyle = '#9e2a1c'; c.beginPath(); c.arc(Math.random() * 64, Math.random() * 64, 5, 0, 7); c.fill(); }
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,240,180,${Math.random() * 0.5})`; c.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  });
  mesh(geo, new THREE.MeshStandardMaterial({ map: top, roughness: 0.6 }), { parent: g });
  mesh(new THREE.CapsuleGeometry(0.008, 0.08, 4, 8).rotateZ(Math.PI / 2), paint(0xc8873f, 0.8), { parent: g, pos: [0, 0.008, -0.068] });
  return g;
}

function cartonTex() {
  return canvasTex(256, 256, (c, W, Hh) => {
    c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#2b62c8'; c.fillRect(0, Hh * 0.62, W, Hh * 0.38);
    c.fillStyle = '#2b62c8'; c.font = '900 52px Arial'; c.textAlign = 'center'; c.fillText('MILK', W / 2, Hh * 0.42);
    c.fillStyle = '#fff'; c.font = '700 22px Arial'; c.fillText('2% REDUCED FAT', W / 2, Hh * 0.8);
  });
}
function iceTex() {
  return canvasTex(256, 128, (c, W, Hh) => {
    c.fillStyle = '#5a2e1a'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#f2d9b0'; c.font = '700 30px Georgia'; c.textAlign = 'center'; c.fillText('Double Chocolate', W / 2, Hh * 0.55);
    c.font = '14px Arial'; c.fillText('ICE CREAM  •  1.5 QT', W / 2, Hh * 0.8);
  });
}

// food you can pick up and eat (bite by bite). Microwave-able items get better when hot.
export function foodItem(ctx, obj, o) {
  const item = { obj, name: o.name, kind: 'food', bites: o.bites || 1, hot: false, useTime: 1.4 };
  item.onUse = () => {
    item.bites--;
    ctx.needs?.eat(o.eat / (o.bites || 1) * (item.hot ? 1.3 : 1), item.bites <= 0 ? (item.hot ? o.hotText || o.text : o.text) : null);
    if (o.sugar) ctx.needs && (ctx.needs.sugar = Math.min(1, ctx.needs.sugar + o.sugar / (o.bites || 1)));
    ctx.audio.burst({ pos: ctx.camera.position, freq: 1400, q: 0.7, vol: 0.05, env: [0.01, 0.06, 0.12] });
    ctx.audio.burst({ pos: ctx.camera.position, freq: 900, q: 0.7, vol: 0.04, env: [0.01, 0.05, 0.1], delay: 0.25 });
    obj.scale.multiplyScalar(item.bites > 0 ? 0.82 : 1);
    return item.bites <= 0;
  };
  ctx.interact.add(obj, {
    range: 2.0, label: () => `Take ${o.name === 'ice cream' ? 'the' : 'a'} ${o.name}${item.hot ? ' (hot)' : ''}`,
    enabled: () => !!ctx.held && ctx.held.item !== item,
    use: () => ctx.held.take(item),
  });
  return item;
}

export function drinkItem(ctx, obj, o) {
  const item = { obj, name: o.name, kind: 'drink', sips: o.sips, useTime: 1.7 };
  item.onUse = () => {
    if (item.sips <= 0) { ctx.toast('It\'s empty.'); return false; }
    item.sips--;
    ctx.needs?.drink(o.per, { text: item.sips ? null : `Finished the ${o.name}.` });
    if (o.eat) ctx.needs?.eat(o.eat);
    ctx.audio.burst({ pos: ctx.camera.position, freq: 600, q: 0.5, vol: 0.06, env: [0.08, 0.3, 0.2] });
    return false; // empty containers stay in your hand: throw them away or put them down
  };
  ctx.interact.add(obj, {
    range: 2.0, label: () => `Take the ${o.name}`, enabled: () => !!ctx.held && ctx.held.item !== item,
    use: () => ctx.held.take(item),
  });
  return item;
}

function buildTrash(ctx, at) {
  const g = new THREE.Group();
  g.position.copy(at);
  ctx.scene.add(g);
  const steel = paint(0xb8bcc0, 0.3, 1, { roughnessMap: smudgeTex() });
  mesh(lathe([[0, 0], [0.13, 0], [0.135, 0.02], [0.14, 0.6], [0, 0.6]], 40), steel, { parent: g });
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.61, -0.14);
  g.add(lidPivot);
  mesh(cyl(0.142, 0.142, 0.02, 40), steel, { parent: lidPivot, pos: [0, 0.0, 0.14] });
  mesh(box(0.08, 0.015, 0.06, 0.005), paint(0x1b1b1b, 0.6), { parent: g, pos: [0, 0.03, 0.15] });
  ctx.physics.add({ x: at.x, z: at.z, hx: 0.14, hz: 0.14, y0: 0, y1: 0.62 });
  const T = { open: 0, target: 0, lidPivot };
  ctx.interact.add(g, {
    range: 1.8, label: () => ctx.held?.item ? `Throw away the ${ctx.held.item.name}` : 'Trash can',
    use: () => {
      T.target = 1; T.closeAt = performance.now() + 1100;
      ctx.audio.play('microwave_open.ogg', { pos: at.clone().setY(0.6), vol: 0.25, rate: 0.7 });
      const it = ctx.held?.item;
      if (it) { ctx.held.item = null; ctx.scene.remove(it.obj); ctx.audio.play('pickup.ogg', { pos: at.clone().setY(0.4), vol: 0.35, rate: 0.6 }); }
    },
  });
  T.update = (dt) => {
    if (T.closeAt && performance.now() > T.closeAt) { T.target = 0; T.closeAt = 0; ctx.audio.play('microwave_close.ogg', { pos: at.clone().setY(0.6), vol: 0.3, rate: 0.8 }); }
    T.open += (T.target - T.open) * Math.min(1, dt * 10);
    lidPivot.rotation.x = -T.open * 1.2;
  };
  return T;
}
