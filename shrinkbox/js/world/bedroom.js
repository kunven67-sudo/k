// Your bedroom / gaming room (upstairs, floor at y = 0). Normal, realistic teen room.
// Coordinates: x = west(-) to east(+), z = north(-) to south(+). Front of the house faces south.
import * as THREE from 'three';
import { Thing, panel, lathe, cylUV } from './thing.js';
import { colorMat, drawTexture, defMat } from '../core/materials.js';

export const ROOM = { x0: -2, x1: 2, z0: -1.8, z1: 1.8, h: 2.5, wall: 0.12 };

export function buildBedroom(game) {
  const scene = game.engine.scene;
  const { x0, x1, z0, z1, h, wall: W } = ROOM;

  // ---------- shell ----------
  const room = new Thing({ name: 'room', surface: 'carpet' });
  room.box([x1 - x0 + 2 * W, 0.2, z1 - z0 + 2 * W], [0, -0.1, 0], 'carpet', { friction: 0.9 });
  room.box([x1 - x0 + 2 * W, 0.2, z1 - z0 + 2 * W], [0, h + 0.1, 0], 'ceiling');
  // north wall (behind the bed)
  panel(room, { axis: 'z', at: z0 - W / 2, rect: [x0 - W, -0.2, x1 + W, h + 0.2], thick: W, m: 'wall' });
  // south wall with the front window (street view)
  panel(room, { axis: 'z', at: z1 + W / 2, rect: [x0 - W, -0.2, x1 + W, h + 0.2], holes: [[-1.35, 0.9, -0.15, 2.1]], thick: W, m: 'wall' });
  // west wall with the door to the hallway
  panel(room, { axis: 'x', at: x0 - W / 2, rect: [z0, -0.2, z1, h + 0.2], holes: [[-1.62, 0, -0.76, 2.05]], thick: W, m: 'wall' });
  // east wall with the side window (fields view)
  panel(room, { axis: 'x', at: x1 + W / 2, rect: [z0, -0.2, z1, h + 0.2], holes: [[-0.6, 0.9, 0.6, 2.1]], thick: W, m: 'wall' });
  // baseboards (skip the doorway)
  const bb = (size, pos) => room.box(size, pos, 'trim');
  bb([x1 - x0, 0.09, 0.012], [0, 0.045, z0 + 0.006]);
  bb([x1 - x0, 0.09, 0.012], [0, 0.045, z1 - 0.006]);
  bb([0.012, 0.09, z1 - z0], [x1 - 0.006, 0.045, 0]);
  bb([0.012, 0.09, z1 - -0.76], [x0 + 0.006, 0.045, (z1 + -0.76) / 2]);
  bb([0.012, 0.09, -1.62 - z0], [x0 + 0.006, 0.045, (z0 + -1.62) / 2]);
  // door frame (casing)
  room.box([0.02, 2.1, 0.07], [x0 + 0.01, 1.05, -1.655], 'trim');
  room.box([0.02, 2.1, 0.07], [x0 + 0.01, 1.05, -0.725], 'trim');
  room.box([0.02, 0.07, 1.0], [x0 + 0.01, 2.085, -1.19], 'trim');
  // windows
  windowFrame(room, 'z', z1, -1.35, -0.15, 0.9, 2.1);
  windowFrame(room, 'x', x1, -0.6, 0.6, 0.9, 2.1);
  // light switch + outlets (real outlets have holes - later you can go in... carefully)
  room.box([0.07, 0.115, 0.008], [x0 + 0.004, 1.2, -0.62], 'plasticWhite', { rot: [0, Math.PI / 2, 0] });
  room.box([0.012, 0.03, 0.014], [x0 + 0.012, 1.2, -0.62], 'plasticWhite', { collide: false });
  for (const [x, z, rot] of [[-0.4, z0 + 0.004, 0], [x0 + 0.004, 1.0, Math.PI / 2], [1.9, z1 - 0.004, 0]]) {
    room.box([0.07, 0.115, 0.008], [x, 0.3, z], 'plasticWhite', { rot: [0, rot, 0] });
  }
  // ceiling light (flush dome)
  room.geo(lathe([[0, -0.07], [0.12, -0.06], [0.17, -0.02], [0.18, 0]], 32), [0, h, 0], defMat('dome', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.92 })), { collide: false });
  room.cyl(0.19, 0.012, [0, h - 0.006, 0], 'alu', { collide: false });
  // rug
  room.box([1.7, 0.012, 1.25], [0.25, 0.006, 0.55], 'rug', { friction: 1 });
  room.build(scene);
  room.material = 'carpet';
  game.room = room;

  // ceiling light source (a spotlight down + soft fill so the ceiling isn't black)
  const light = new THREE.SpotLight(0xfff0d8, 0, 9, 1.35, 0.9, 1.6);
  light.position.set(0, h - 0.09, 0); light.target.position.set(0, 0, 0);
  light.castShadow = game.engine.q.shadows;
  light.shadow.mapSize.set(game.engine.q.shadowRes / 2, game.engine.q.shadowRes / 2);
  light.shadow.bias = -0.0005; light.shadow.camera.near = 0.05;
  const fill = new THREE.PointLight(0xfff0d8, 0, 8, 1.5);
  fill.position.set(0, h - 0.25, 0);
  scene.add(light, light.target, fill);
  game.roomLight = { on: false, spot: light, fill, dome: scene.getObjectByName('room') };
  game.setRoomLight = (on) => {
    game.roomLight.on = on;
    light.intensity = on ? 22 : 0; fill.intensity = on ? 4.5 : 0;
    defMat('dome').emissiveIntensity = on ? 2.2 : 0;
  };
  game.interactables.push({
    name: 'Light switch', pos: new THREE.Vector3(x0 + 0.02, 1.2, -0.62), radius: 0.12,
    use: () => { game.setRoomLight(!game.roomLight.on); game.sfx.click(0.6); },
  });

  buildDoor(game, scene);
  buildBed(game, scene);
  buildNightstand(game, scene);
  buildDesk(game, scene);
  buildTvStand(game, scene);
  buildDecor(game, scene);
}

function windowFrame(room, axis, at, a0, a1, y0, y1) {
  const d = 0.12, fw = 0.05;
  const put = (size, pos) => {
    if (axis === 'z') room.box(size, pos, 'trim');
    else room.box([size[2], size[1], size[0]], [pos[2], pos[1], pos[0]], 'trim');
  };
  const c = (a0 + a1) / 2, w = a1 - a0;
  const zz = (off) => at + off; // position along the wall normal
  put([w + 0.1, fw, d + 0.06], [c, y0 - fw / 2, zz(-0.01)]);        // sill
  put([w + 0.1, fw, d], [c, y1 + fw / 2, zz(0)]);                  // head
  put([fw, y1 - y0 + 2 * fw, d], [a0 - fw / 2, (y0 + y1) / 2, zz(0)]);
  put([fw, y1 - y0 + 2 * fw, d], [a1 + fw / 2, (y0 + y1) / 2, zz(0)]);
  // sashes (two panes, top + bottom) with real glass you can't walk through
  const mid = (y0 + y1) / 2;
  put([w, 0.04, 0.05], [c, mid, zz(0.02)]);
  for (const [ya, yb, off] of [[y0, mid, 0.035], [mid, y1, 0.005]]) {
    put([w, 0.035, 0.035], [c, ya + 0.0175, zz(off)]);
    put([w, 0.035, 0.035], [c, yb - 0.0175, zz(off)]);
    put([0.035, yb - ya, 0.035], [a0 + 0.0175, (ya + yb) / 2, zz(off)]);
    put([0.035, yb - ya, 0.035], [a1 - 0.0175, (ya + yb) / 2, zz(off)]);
    const g = axis === 'z' ? [w - 0.06, yb - ya - 0.06, 0.004] : [0.004, yb - ya - 0.06, w - 0.06];
    const gp = axis === 'z' ? [c, (ya + yb) / 2, zz(off)] : [zz(off), (ya + yb) / 2, c];
    room.box(g, gp, 'windowGlass', { shadow: false });
  }
}

function buildDoor(game, scene) {
  const { x0 } = ROOM;
  // door leaf hinged at the north side of the doorway. Real 1.2 cm gap under it!
  const hinge = new THREE.Vector3(x0 + 0.02, 0, -1.6);
  const door = new Thing({ name: 'door', type: 'kinematic', pos: [hinge.x, 0, hinge.z], surface: 'paint' });
  door.box([0.04, 2.02, 0.82], [0, 0.012 + 1.01, 0.42], 'doorWood');
  door.cyl(0.028, 0.06, [0.05, 1.0, 0.76], 'chrome', { rot: [0, 0, Math.PI / 2] });
  door.cyl(0.028, 0.06, [-0.05, 1.0, 0.76], 'chrome', { rot: [0, 0, Math.PI / 2] });
  door.build(scene);
  door.open = 0; door.target = 0;
  door.behaviors.push({
    update(t, dt) {
      t.open += (t.target - t.open) * Math.min(1, dt * 4);
      const a = -t.open * 1.6; // swings into the room
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      t.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    },
  });
  game.interactables.push({
    name: 'Door', thing: door, radius: 0.5,
    pos: new THREE.Vector3(x0 + 0.05, 1.0, -0.86),
    use: () => { door.target = door.target ? 0 : 1; game.sfx.thud(0.3, 2); },
  });
  game.door = door;
}

function buildBed(game, scene) {
  const bx = 0.95, bz = -0.8, L = 2.0, Wd = 1.42;
  const bed = new Thing({ name: 'bed', pos: [bx, 0, bz], surface: 'fabric' });
  // frame: legs, rails, headboard
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bed.box([0.06, 0.32, 0.06], [sx * (Wd / 2 - 0.03), 0.16, sz * (L / 2 - 0.03)], 'deskWood');
  bed.box([Wd, 0.1, 0.03], [0, 0.27, L / 2 - 0.015], 'deskWood');
  bed.box([0.03, 0.1, L], [-Wd / 2 + 0.015, 0.27, 0], 'deskWood');
  bed.box([0.03, 0.1, L], [Wd / 2 - 0.015, 0.27, 0], 'deskWood');
  bed.box([Wd, 0.95, 0.04], [0, 0.6, -L / 2 + 0.02], 'deskWood');
  for (let i = 0; i < 9; i++) bed.box([Wd - 0.06, 0.02, 0.07], [0, 0.31, -L / 2 + 0.12 + i * 0.22], 'lightWood');
  // mattress + sheet
  bed.rbox([Wd - 0.04, 0.24, L - 0.06], [0, 0.44, 0.01], 'mattress', 0.05, { friction: 0.95 });
  bed.rbox([Wd - 0.02, 0.02, L - 0.4], [0, 0.565, 0.18], 'blanket', 0.01, { friction: 1 });
  bed.rbox([0.02, 0.22, L - 0.4], [-Wd / 2 + 0.005, 0.47, 0.18], 'blanket', 0.008, { friction: 1 });
  bed.rbox([0.02, 0.22, L - 0.4], [Wd / 2 - 0.005, 0.47, 0.18], 'blanket', 0.008, { friction: 1 });
  bed.rbox([Wd - 0.03, 0.012, 0.42], [0, 0.562, -L / 2 + 0.25], 'sheet', 0.005);
  bed.build(scene);
  bed.material = 'fabric';
  bed.dirt = 0.5;
  // pillows you can throw around
  for (const sx of [-0.33, 0.33]) {
    const p = new Thing({ name: 'pillow', type: 'dynamic', density: 60, pos: [bx + sx, 0.64, bz - L / 2 + 0.28], surface: 'fabric', icon: '🛏️', spawnId: 'pillow' });
    p.rbox([0.6, 0.13, 0.4], [0, 0, 0], 'pillow', 0.06, { friction: 1 });
    p.build(scene);
  }
}

function buildNightstand(game, scene) {
  const ns = new Thing({ name: 'nightstand', pos: [-0.06, 0, -1.55], surface: 'wood' });
  ns.box([0.46, 0.025, 0.4], [0, 0.56, 0], 'lightWood');
  ns.box([0.02, 0.56, 0.4], [-0.22, 0.28, 0], 'lightWood');
  ns.box([0.02, 0.56, 0.4], [0.22, 0.28, 0], 'lightWood');
  ns.box([0.42, 0.56, 0.015], [0, 0.28, -0.19], 'lightWood');
  ns.box([0.42, 0.02, 0.38], [0, 0.04, 0], 'lightWood');
  ns.box([0.42, 0.18, 0.02], [0, 0.45, 0.19], 'lightWood'); // drawer front
  ns.cyl(0.012, 0.02, [0, 0.45, 0.205], 'chrome', { rot: [Math.PI / 2, 0, 0] });
  // lamp
  ns.cyl(0.065, 0.02, [0.1, 0.583, -0.07], 'darkAlu');
  ns.cyl(0.008, 0.3, [0.1, 0.74, -0.07], 'darkAlu');
  ns.geo(lathe([[0.1, 0], [0.075, 0.17]], 32), [0.1, 0.8, -0.07], defMat('shade', () => new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveIntensity: 0 })), { collide: false });
  ns.ball(0.03, [0.1, 0.86, -0.07], 'bulb', { collide: false });
  ns.build(scene);
  const lamp = new THREE.PointLight(0xffc98a, 0, 5, 1.8);
  lamp.position.set(-0.06 + 0.1, 0.86, -1.55 - 0.07);
  scene.add(lamp);
  game.lamp = { on: false, light: lamp };
  const setLamp = (on) => { game.lamp.on = on; lamp.intensity = on ? 2.5 : 0; defMat('shade').emissiveIntensity = on ? 0.7 : 0; };
  game.setLamp = setLamp;
  game.interactables.push({ name: 'Lamp', pos: lamp.position.clone(), radius: 0.2, use: () => { setLamp(!game.lamp.on); game.sfx.click(0.4); } });
}

function buildDesk(game, scene) {
  const desk = new Thing({ name: 'desk', pos: [-1.65, 0, 0.45], surface: 'wood' });
  desk.box([0.7, 0.03, 1.6], [0, 0.735, 0], 'deskWood');
  for (const sz of [-1, 1]) {
    desk.box([0.6, 0.03, 0.03], [0, 0.02, sz * 0.76], 'darkAlu');
    desk.box([0.04, 0.7, 0.04], [0, 0.37, sz * 0.76], 'darkAlu');
  }
  desk.box([0.02, 0.04, 1.5], [0.25, 0.7, 0], 'darkAlu');
  desk.box([0.6, 0.004, 0.9], [0.08, 0.752, 0.15], colorMat(0x1a1b1f, 0.95), { friction: 1 }); // mouse pad
  desk.build(scene);

  // monitor (27") facing east
  const mon = new Thing({ name: 'monitor', pos: [-1.88, 0.75, 0.45], surface: 'plastic' });
  mon.box([0.22, 0.01, 0.26], [0, 0.005, 0], 'plasticBlack');
  mon.box([0.04, 0.33, 0.06], [-0.02, 0.17, 0], 'plasticBlack');
  mon.box([0.035, 0.36, 0.62], [0.02, 0.4, 0], 'plasticBlack');
  mon.box([0.002, 0.34, 0.6], [0.0385, 0.4, 0], 'screenOff', { collide: false, mesh: true, name: 'screen' });
  mon.build(scene);
  game.monitor = mon;

  // keyboard (with real keys) + mouse
  const kb = new Thing({ name: 'keyboard', type: 'dynamic', density: 900, pos: [-1.5, 0.77, 0.3], rot: [0, Math.PI / 2, 0], surface: 'plastic', icon: '⌨️', spawnId: 'keyboard' });
  kb.rbox([0.44, 0.022, 0.135], [0, 0, 0], 'plasticBlack', 0.004);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) {
    if (r === 4 && c > 3 && c < 11) continue;
    kb.rbox([0.0175, 0.008, 0.0175], [-0.2 + c * 0.0195 + 0.006, 0.015, -0.044 + r * 0.021], 'plasticGray', 0.002, { collide: r % 2 === 0 });
  }
  kb.rbox([0.13, 0.008, 0.0175], [0, 0.015, 0.04], 'plasticGray', 0.002);
  kb.build(scene);
  const mouse = new Thing({ name: 'mouse', type: 'dynamic', density: 500, pos: [-1.5, 0.77, 0.66], surface: 'plastic', icon: '🖱️', spawnId: 'mouse' });
  mouse.capsule(0.03, 0.06, [0, 0.012, 0], 'plasticBlack', { rot: [Math.PI / 2, 0, 0] });
  mouse.build(scene);
}

function buildTvStand(game, scene) {
  const st = new Thing({ name: 'tv stand', pos: [1.1, 0, 1.59], surface: 'wood' });
  st.box([1.5, 0.03, 0.42], [0, 0.485, 0], 'deskWood');
  st.box([1.5, 0.025, 0.42], [0, 0.06, 0], 'deskWood');
  st.box([0.025, 0.47, 0.42], [-0.7375, 0.27, 0], 'deskWood');
  st.box([0.025, 0.47, 0.42], [0.7375, 0.27, 0], 'deskWood');
  st.box([0.025, 0.42, 0.42], [0.1, 0.27, 0], 'deskWood');
  st.box([1.5, 0.43, 0.015], [0, 0.27, 0.2], 'deskWood');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) st.box([0.04, 0.05, 0.04], [sx * 0.7, 0.025, sz * 0.18], 'black');
  st.build(scene);
}

function buildDecor(game, scene) {
  // posters (realistic paper posters, made-up game art)
  const poster = (key, w, hgt, draw) => defMat(key, () => new THREE.MeshStandardMaterial({ map: drawTexture(512, Math.round(512 * hgt / w), draw, key), roughness: 0.8 }));
  const p1 = poster('poster1', 0.6, 0.9, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1b3a'); g.addColorStop(1, '#ff5a36'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(w * 0.5, h * 0.55, w * 0.25, 0, 7); c.fill();
    c.fillStyle = '#081022'; for (let i = 0; i < 9; i++) { const bw = w / 9; c.fillRect(i * bw, h * (0.6 + Math.sin(i * 1.7) * 0.08), bw - 4, h); }
    c.fillStyle = '#fff'; c.font = `bold ${w * 0.13}px sans-serif`; c.textAlign = 'center'; c.fillText('NEON', w / 2, h * 0.15); c.fillText('RUNNERS', w / 2, h * 0.27);
  });
  const p2 = poster('poster2', 0.6, 0.9, (c, w, h) => {
    c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b3d2f'; c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.35, h * 0.35); c.lineTo(w * 0.6, h * 0.65); c.lineTo(w * 0.8, h * 0.45); c.lineTo(w, h); c.fill();
    c.fillStyle = '#c23b22'; c.font = `900 ${w * 0.16}px sans-serif`; c.textAlign = 'center'; c.fillText('SUMMIT', w / 2, h * 0.17);
    c.fillStyle = '#1b3d2f'; c.font = `bold ${w * 0.06}px sans-serif`; c.fillText('THE CLIMB · 2026', w / 2, h * 0.25);
  });
  const deco = new Thing({ name: 'decor', surface: 'paper' });
  deco.box([0.002, 0.9, 0.6], [ROOM.x0 + 0.003, 1.55, 0.25], p1, { collide: false });
  deco.box([0.6, 0.9, 0.002], [-0.9, 1.6, ROOM.z0 + 0.003], p2, { collide: false });
  // Halloween (it's October for real): paper bats on the window, a fake web in the corner
  const bat = defMat('bat', () => new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9, side: THREE.DoubleSide, alphaMap: drawTexture(128, 64, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath();
    c.moveTo(w / 2, h * 0.3); c.quadraticCurveTo(w * 0.3, 0, 0, h * 0.2); c.quadraticCurveTo(w * 0.15, h * 0.5, w * 0.1, h * 0.8); c.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.45, h * 0.85);
    c.lineTo(w / 2, h * 0.7); c.lineTo(w * 0.55, h * 0.85); c.quadraticCurveTo(w * 0.7, h * 0.55, w * 0.9, h * 0.8); c.quadraticCurveTo(w * 0.85, h * 0.5, w, h * 0.2); c.quadraticCurveTo(w * 0.7, 0, w / 2, h * 0.3); c.fill();
  }, 'batAlpha'), transparent: true, alphaTest: 0.5 }));
  const month = new Date().getMonth();
  if (month === 9) {
    for (const [x, y, s] of [[-1.1, 1.85, 0.16], [-0.6, 1.95, 0.12], [-0.85, 1.6, 0.1], [-0.35, 1.7, 0.14]]) {
      deco.box([s, s / 2, 0.001], [x, y, ROOM.z1 - 0.02], bat, { collide: false });
    }
  }
  deco.build(scene);
  if (month === 9) {
    // real pumpkin on the desk
    const pk = new Thing({ name: 'pumpkin', type: 'dynamic', density: 450, pos: [-1.75, 0.83, 1.05], surface: 'food', icon: '🎃', spawnId: 'pumpkin' });
    const pg = lathe(Array.from({ length: 13 }, (_, i) => { const a = -Math.PI / 2 + (i / 12) * Math.PI; return [Math.max(0.001, Math.cos(a) * 0.11), Math.sin(a) * 0.08]; }), 40);
    const pos = pg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.cos(a * 10); pos.setX(i, x * k); pos.setZ(i, z * k); }
    pg.computeVertexNormals();
    pk.geo(pg, [0, 0, 0], 'pumpkin', { collide: false });
    pk.ball(0.095, [0, 0, 0], 'pumpkin', { visual: false });
    pk.cyl(0.012, 0.05, [0, 0.095, 0], 'stem', { rot: [0.2, 0, 0.1] });
    pk.build(scene);
  }
}
void cylUV;
