// Spawnable everyday things, all at their REAL sizes, with real-shape collisions.
// (LEGO bricks are hollow underneath with real studs, boxes are hollow, balls are round...)
import * as THREE from 'three';
import { Thing, lathe, coneWall, diskStrips } from '../thing.js';
import { defMat, colorMat, drawTexture } from '../../core/materials.js';

const M = (c, r = 0.6, m = 0) => colorMat(c, r, m);

export const ITEMS = {
  // ---------------- food & drinks ----------------
  apple: { cat: 'food', icon: '🍎', name: 'Apple', build(t) {
    const g = lathe(Array.from({ length: 14 }, (_, i) => { const a = -Math.PI / 2 + i / 13 * Math.PI; const r = Math.cos(a) * 0.04 * (1 + 0.12 * Math.sin(a)); return [Math.max(0.0005, r), Math.sin(a) * 0.037 + (i === 13 || i === 0 ? (i ? -0.006 : 0.004) : 0)]; }), 32);
    t.geo(g, [0, 0, 0], defMat('appleSkin', () => new THREE.MeshPhysicalMaterial({ color: 0xb3161c, roughness: 0.35, clearcoat: 0.6 })), { collide: 'hull' });
    t.cyl(0.002, 0.016, [0, 0.038, 0], M(0x4b3621), { rot: [0.2, 0, 0.1], collide: false }); t.density = 800; t.material = 'food';
  } },
  banana: { cat: 'food', icon: '🍌', name: 'Banana', build(t) {
    for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.18; t.cyl(0.017 - Math.abs(i - 2.5) * 0.0015, 0.034, [Math.sin(a) * 0.1, Math.cos(a) * 0.1 - 0.1, 0], M(0xf2d03b, 0.6), { rot: [0, 0, -a + Math.PI / 2], seg: 7 }); }
    t.density = 900; t.material = 'food';
  } },
  cookie: { cat: 'food', icon: '🍪', name: 'Cookie', build(t) {
    t.cyl(0.035, 0.01, [0, 0, 0], defMat('cookie', () => new THREE.MeshStandardMaterial({ color: 0xc58b4a, roughness: 0.95 })), { seg: 24 });
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.008 + (i % 3) * 0.008; t.box([0.007, 0.004, 0.006], [Math.cos(a) * r, 0.005, Math.sin(a) * r], M(0x3b2314, 0.8), { collide: false, rot: [0, a, 0] }); }
    t.density = 700; t.material = 'food';
  } },
  pizza: { cat: 'food', icon: '🍕', name: 'Pizza slice', build(t) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(-0.07, 0.17); shape.quadraticCurveTo(0, 0.19, 0.07, 0.17); shape.lineTo(0, 0);
    const base = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false }); base.rotateX(Math.PI / 2); base.translate(0, 0.008, -0.09);
    t.geo(base, [0, 0, 0], M(0xd9a35b, 0.9), { collide: 'hull' });
    const top = new THREE.ShapeGeometry(shape); top.rotateX(-Math.PI / 2); top.translate(0, 0.0085, 0.09); top.scale(0.9, 1, 0.9);
    t.geo(top, [0, 0, 0], M(0xd8452b, 0.7), { collide: false });
    for (let i = 0; i < 5; i++) t.cyl(0.011, 0.002, [(i % 2 - 0.5) * 0.04, 0.0095, -0.04 + i * 0.022], M(0x9e2a1f, 0.6), { collide: false });
    t.cyl(0.012, 0.016, [0, 0.008, -0.085], M(0xc8893f, 0.95), { rot: [0, 0, Math.PI / 2], rTop: 0.012 });
    t.density = 600; t.material = 'food';
  } },
  chips: { cat: 'food', icon: '🥔', name: 'Bag of chips', build(t) {
    const bag = defMat('chipsBag', () => new THREE.MeshStandardMaterial({ map: drawTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#f2b51d'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4161c'; c.fillRect(0, h * 0.3, w, h * 0.3);
      c.fillStyle = '#fff'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.fillText('CRUNCH', w / 2, h * 0.52); c.font = '20px sans-serif'; c.fillText('SEA SALT', w / 2, h * 0.75);
    }, 'chipsTex'), metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }));
    // open-top bag: four walls + bottom, chips inside
    t.box([0.2, 0.004, 0.06], [0, 0.002, 0], bag); t.box([0.2, 0.24, 0.003], [0, 0.12, 0.03], bag); t.box([0.2, 0.24, 0.003], [0, 0.12, -0.03], bag);
    t.box([0.003, 0.24, 0.06], [0.1, 0.12, 0], bag); t.box([0.003, 0.24, 0.06], [-0.1, 0.12, 0], bag);
    for (let i = 0; i < 14; i++) t.box([0.035, 0.002, 0.03], [(i % 5 - 2) * 0.035, 0.008 + Math.floor(i / 5) * 0.012, (i % 2 - 0.5) * 0.02], M(0xe8c065, 0.8), { rot: [i * 0.7, i, i * 0.3], density: 500 });
    t.density = 120; t.material = 'food';
  } },
  water: { cat: 'food', icon: '💧', name: 'Water bottle', build(t) {
    t.geo(lathe([[0.001, 0], [0.032, 0.002], [0.033, 0.16], [0.02, 0.19], [0.014, 0.2], [0.014, 0.215]], 32), [0, 0, 0], defMat('bottle', () => new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0.05, transmission: 0.9, thickness: 0.002, transparent: true, opacity: 0.6 })), { collide: false });
    t.cyl(0.033, 0.2, [0, 0.1, 0], 'glass', { visual: false });
    t.cyl(0.015, 0.016, [0, 0.222, 0], M(0x2c63c9, 0.4));
    t.box([0.066, 0.05, 0.001], [0, 0.09, 0.033], M(0x3d8fe0, 0.4), { collide: false });
    t.density = 900; t.material = 'plastic';
  } },
  candy: { cat: 'food', icon: '🍫', name: 'Candy bar', build(t) {
    t.rbox([0.13, 0.012, 0.035], [0, 0.006, 0], M(0x6b3e24, 0.4), 0.003);
    for (let i = 0; i < 6; i++) t.box([0.018, 0.003, 0.03], [-0.052 + i * 0.021, 0.0135, 0], M(0x5a3220, 0.4), { collide: false });
    t.density = 1300; t.material = 'food';
  } },

  // ---- cut pieces (made by the cutter) ----
  appleHalf: { hidden: true, cat: 'food', icon: '🍎', name: 'Apple half', build(t) {
    const g = lathe(Array.from({ length: 14 }, (_, i) => { const a = -Math.PI / 2 + i / 13 * Math.PI; return [Math.max(0.0005, Math.cos(a) * 0.04), Math.sin(a) * 0.037]; }), 32, 0, Math.PI);
    t.geo(g, [0, 0, 0], defMat('appleSkin'), { collide: 'hull' });
    const face = new THREE.CircleGeometry(0.039, 32); face.scale(1, 0.93, 1); face.rotateY(-Math.PI / 2);
    t.geo(face, [-0.0002, 0, 0], M(0xf3e7c4, 0.8), { collide: false });
    t.ball(0.004, [-0.001, 0.004, 0.008], M(0x3b2314, 0.6), { collide: false }); t.ball(0.004, [-0.001, 0.004, -0.008], M(0x3b2314, 0.6), { collide: false });
    t.density = 800; t.material = 'food';
  } },
  cookieHalf: { hidden: true, cat: 'food', icon: '🍪', name: 'Half cookie', build(t) {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16, 1, false, 0, Math.PI);
    t.geo(g, [0, 0, 0], defMat('cookie'), { collide: 'hull' }); t.density = 700; t.material = 'food';
  } },
  candyHalf: { hidden: true, cat: 'food', icon: '🍫', name: 'Half candy bar', build(t) { t.rbox([0.065, 0.012, 0.035], [0, 0.006, 0], M(0x6b3e24, 0.4), 0.003); t.density = 1300; t.material = 'food'; } },
  bananaHalf: { hidden: true, cat: 'food', icon: '🍌', name: 'Banana piece', build(t) {
    for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.18; t.cyl(0.016, 0.034, [Math.sin(a) * 0.1, Math.cos(a) * 0.1 - 0.1, 0], M(0xf2d03b, 0.6), { rot: [0, 0, -a + Math.PI / 2], seg: 7 }); }
    t.cyl(0.014, 0.001, [0.052, -0.004, 0], M(0xf5efd2, 0.8), { rot: [0, 0, Math.PI / 2 - 0.27], collide: false });
    t.density = 900; t.material = 'food';
  } },

  // ---------------- toys & balls ----------------
  tennis: { cat: 'toys', icon: '🎾', name: 'Tennis ball', build(t) { t.ball(0.0335, [0, 0, 0], defMat('tennis', () => new THREE.MeshStandardMaterial({ color: 0xd4ec2a, roughness: 1 })), { bounce: 0.75 }); t.density = 400; } },
  basketball: { cat: 'toys', icon: '🏀', name: 'Basketball', build(t) {
    t.ball(0.12, [0, 0, 0], defMat('bball', () => new THREE.MeshStandardMaterial({ roughness: 0.8, map: drawTexture(512, 256, (c, w, h) => {
      c.fillStyle = '#d4631f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1a1008'; c.lineWidth = 5;
      for (const x of [w / 4, w / 2, w * 3 / 4]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    }, 'bballTex') })), { bounce: 0.8, seg: 32 }); t.density = 75;
  } },
  soccer: { cat: 'toys', icon: '⚽', name: 'Soccer ball', build(t) {
    const g = new THREE.IcosahedronGeometry(0.11, 3);
    t.geo(g, [0, 0, 0], M(0xf4f4f4, 0.5), { collide: false }); t.ball(0.11, [0, 0, 0], 'black', { visual: false, bounce: 0.6 });
    const pent = new THREE.IcosahedronGeometry(0.1105, 0); const pos = pent.attributes.position;
    for (let i = 0; i < pos.count; i += 3) { const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize().multiplyScalar(0.1102); t.cyl(0.02, 0.002, v.toArray(), M(0x111111, 0.5), { collide: false, rot: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()).toArray() }); }
    t.density = 80;
  } },
  lego: { cat: 'toys', icon: '🧱', name: 'LEGO brick 2x4', build(t) {
    // real dimensions: 31.8 x 9.6 x 15.8 mm, hollow underneath with tubes, 8 studs on top
    const red = defMat('legoRed', () => new THREE.MeshPhysicalMaterial({ color: 0xc4281c, roughness: 0.25, clearcoat: 0.5 }));
    const L = 0.0318, W = 0.0158, H = 0.0096, wt = 0.0012;
    t.box([L, wt, W], [0, H - wt / 2, 0], red);
    t.box([L, H - wt, wt], [0, (H - wt) / 2, W / 2 - wt / 2], red); t.box([L, H - wt, wt], [0, (H - wt) / 2, -W / 2 + wt / 2], red);
    t.box([wt, H - wt, W - 2 * wt], [L / 2 - wt / 2, (H - wt) / 2, 0], red); t.box([wt, H - wt, W - 2 * wt], [-L / 2 + wt / 2, (H - wt) / 2, 0], red);
    for (let i = 0; i < 3; i++) t.cyl(0.00325, H - wt, [-0.008 + i * 0.008, (H - wt) / 2, 0], red, { seg: 16 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) t.cyl(0.0024, 0.0017, [-0.012 + i * 0.008, H + 0.00085, -0.004 + j * 0.008], red, { seg: 16 });
    t.density = 1050; t.material = 'plastic';
  } },
  block: { cat: 'toys', icon: '🟫', name: 'Wood block', build(t) { t.box([0.05, 0.05, 0.05], [0, 0.025, 0], 'lightWood'); t.density = 650; t.material = 'wood'; } },
  plank: { cat: 'toys', icon: '🪵', name: 'Wood plank', build(t) { t.box([0.3, 0.012, 0.05], [0, 0.006, 0], 'lightWood'); t.density = 650; t.material = 'wood'; } },
  duck: { cat: 'toys', icon: '🦆', name: 'Rubber duck', build(t) {
    const y = defMat('duck', () => new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.4 }));
    t.ball(0.035, [0, 0.03, 0], y); t.ball(0.022, [0.025, 0.07, 0], y); t.cyl(0.006, 0.02, [0.05, 0.068, 0], M(0xf26a1b, 0.5), { rot: [0, 0, Math.PI / 2], rTop: 0.004 });
    for (const z of [-0.008, 0.008]) t.ball(0.0035, [0.04, 0.078, z], 'black', { collide: false });
    t.density = 150; t.material = 'plastic';
  } },
  car: { cat: 'toys', icon: '🚗', name: 'Toy car', build(t) {
    const body = M(0x1f58c9, 0.3, 0.4);
    t.rbox([0.075, 0.018, 0.035], [0, 0.016, 0], body, 0.006); t.rbox([0.04, 0.014, 0.03], [-0.005, 0.03, 0], M(0x9fc4e8, 0.1, 0.3), 0.005);
    for (const [x, z] of [[0.024, 0.017], [-0.024, 0.017], [0.024, -0.017], [-0.024, -0.017]]) t.cyl(0.008, 0.006, [x, 0.008, z], 'rubber', { rot: [Math.PI / 2, 0, 0], seg: 16 });
    t.density = 1500; t.material = 'metal';
  } },

  // ---------------- electronics ----------------
  remote: { cat: 'electronics', icon: '📟', name: 'TV remote', build(t) {
    t.rbox([0.045, 0.02, 0.17], [0, 0.01, 0], 'plasticBlack', 0.006);
    for (let i = 0; i < 12; i++) t.cyl(0.004, 0.003, [(i % 3 - 1) * 0.012, 0.0205, -0.03 + Math.floor(i / 3) * 0.015], 'rubberGray', { collide: false });
    t.cyl(0.006, 0.003, [0.012, 0.0205, -0.065], M(0xc8282a, 0.5), { collide: false });
    t.density = 700; t.material = 'plastic';
  } },
  battery: { cat: 'electronics', icon: '🔋', name: 'AA battery', build(t) {
    t.cyl(0.0072, 0.05, [0, 0.0072, 0], defMat('aaGold', () => new THREE.MeshStandardMaterial({ color: 0xc28a2c, metalness: 0.6, roughness: 0.3 })), { rot: [0, 0, Math.PI / 2] });
    t.cyl(0.0025, 0.0015, [0.0257, 0.0072, 0], 'chrome', { rot: [0, 0, Math.PI / 2], collide: false });
    t.density = 2300; t.material = 'metal';
  } },

  // ---------------- furniture ----------------
  box: { cat: 'furniture', icon: '📦', name: 'Cardboard box', build(t) {
    // hollow, open top, flaps: you can climb inside when small
    const c = 'cardboard', T = 0.004;
    t.box([0.4, T, 0.3], [0, T / 2, 0], c);
    t.box([0.4, 0.3, T], [0, 0.15, 0.15 - T / 2], c); t.box([0.4, 0.3, T], [0, 0.15, -0.15 + T / 2], c);
    t.box([T, 0.3, 0.3 - 2 * T], [0.2 - T / 2, 0.15, 0], c); t.box([T, 0.3, 0.3 - 2 * T], [-0.2 + T / 2, 0.15, 0], c);
    t.box([0.4, T, 0.14], [0, 0.3, 0.215], c, { rot: [0.5, 0, 0], cut: 'flaps' }); t.box([0.4, T, 0.14], [0, 0.3, -0.215], c, { rot: [-0.5, 0, 0], cut: 'flaps' });
    t.density = 500; t.material = 'paper';
  } },
  chair: { cat: 'furniture', icon: '🪑', name: 'Wooden chair', build(t) {
    for (const [x, z] of [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]]) t.box([0.035, 0.45, 0.035], [x, 0.225, z], 'lightWood');
    t.box([0.44, 0.03, 0.44], [0, 0.465, 0], 'lightWood');
    t.box([0.035, 0.45, 0.035], [0.19, 0.7, -0.19], 'lightWood'); t.box([0.035, 0.45, 0.035], [-0.19, 0.7, -0.19], 'lightWood');
    for (let i = 0; i < 3; i++) t.box([0.38, 0.05, 0.02], [0, 0.6 + i * 0.12, -0.19], 'lightWood');
    t.density = 650; t.material = 'wood';
  } },
  table: { cat: 'furniture', icon: '🪵', name: 'Small table', build(t) {
    t.box([0.8, 0.03, 0.5], [0, 0.735, 0], 'lightWood');
    for (const [x, z] of [[0.36, 0.21], [-0.36, 0.21], [0.36, -0.21], [-0.36, -0.21]]) t.box([0.04, 0.72, 0.04], [x, 0.36, z], 'lightWood');
    t.density = 650; t.material = 'wood';
  } },
  stool: { cat: 'furniture', icon: '🪑', name: 'Stool', build(t) {
    t.cyl(0.16, 0.03, [0, 0.45, 0], 'lightWood'); for (let i = 0; i < 3; i++) { const a = i * 2.094; t.cyl(0.015, 0.45, [Math.cos(a) * 0.11, 0.225, Math.sin(a) * 0.11], 'lightWood', { rot: [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12] }); }
    t.density = 650; t.material = 'wood';
  } },
  cup: { cat: 'furniture', icon: '☕', name: 'Mug', build(t) {
    const m = defMat('mug', () => new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.25, side: THREE.DoubleSide }));
    t.geo(lathe([[0.001, 0], [0.04, 0], [0.042, 0.095], [0.037, 0.095], [0.035, 0.006], [0.001, 0.006]], 40), [0, 0, 0], m, { collide: false });
    coneWall(t, { r0: 0.036, y0: 0.004, r1: 0.039, y1: 0.095, thick: 0.004, seg: 20 });
    diskStrips(t, { r: 0.04, y: 0.003, thick: 0.006, strip: 0.008 });
    const handle = new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI); handle.rotateZ(-Math.PI / 2);
    t.geo(handle, [0.045, 0.05, 0], m, { collide: 'hull' });
    t.density = 2300; t.material = 'ceramic';
  } },
};

export const CATEGORIES = [
  ['food', '🍔 Food & drinks'], ['electronics', '🔌 Electronics'], ['furniture', '🪑 Furniture'], ['toys', '⚽ Toys & balls'],
];

// what the cutter turns food into
export const CUT_INTO = { apple: 'appleHalf', cookie: 'cookieHalf', candy: 'candyHalf', banana: 'bananaHalf', appleHalf: null };

export function buildItem(game, id, pos, rotY = 0) {
  const def = ITEMS[id];
  const t = new Thing({ name: def.name, type: 'dynamic', pos, rot: [0, rotY, 0], icon: def.icon, spawnId: id, surface: 'plastic' });
  def.build(t);
  t.build(game.engine.scene);
  return t;
}
