// The Smith house, the garage, the street, and the town around it (for flying).
import * as THREE from '../three.js';
import { G, mesh, batchStatic, LAYER_OVERLAY } from '../render/kit.js';
import { toon, glow, toonTex, paintTexture } from '../render/materials.js';
import { Builder } from './builder.js';
import { rng } from '../util.js';

const C = {
  // interior paint
  mortyWall: 0x9fb7cc,
  hallWall: 0xd9cfae,
  livingWall: 0xc9c58f,
  kitchenWall: 0xe6dfc0,
  garageWall: 0xb3b8b0,
  summerDoor: 0xe8e1d2,
  trim: 0xf6f3ea,
  ceiling: 0xf1eee4,
  wood: 0xa5713f,
  woodDark: 0x7a5232,
  carpetMorty: 0x6f86a8,
  carpetLiving: 0xb8a37e,
  tile: 0xd9d6c9,
  concrete: 0x9a9c97,
  // exterior
  siding: 0xe3d49c,
  roof: 0x6a5651,
  porch: 0xbfb6a3,
  grass: 0x79b84f,
  street: 0x56585c,
  sidewalk: 0xc4c1b6,
  driveway: 0xaeaca4,
};

function planksTexture(base, dark, w = 256, h = 256, rows = 8) {
  return (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = dark;
    g.lineWidth = 3;
    for (let i = 0; i <= rows; i++) {
      const y = (i * h) / rows;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      const off = (i % 2) * 90 + 40;
      g.beginPath();
      g.moveTo(off, y);
      g.lineTo(off, y + h / rows);
      g.moveTo(off + 128, y);
      g.lineTo(off + 128, y + h / rows);
      g.stroke();
    }
  };
}

function texturedPlane(mat, w, d, x, y, z, parent) {
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 0.5, uv.getY(i) * d * 0.5);
  return mesh(geo, mat, x, y, z, parent, { rx: -Math.PI / 2 });
}

/** long flat strip (road, sidewalk) split into short pieces: giant triangles glitch the depth buffer */
function strip(root, mat, axis, a0, a1, c, width, y0, y1, chunk = 30) {
  for (let a = a0; a < a1 - 1e-6; a += chunk) {
    const b = Math.min(a1, a + chunk);
    const len = b - a, mid = (a + b) / 2;
    if (axis === 'x') mesh(G.box(len, y1 - y0, width), mat, mid, (y0 + y1) / 2, c, root);
    else mesh(G.box(width, y1 - y0, len), mat, c, (y0 + y1) / 2, mid, root);
  }
}

/** a poster / sign texture */
function posterMat(key, draw) {
  return toonTex(key, 256, 360, draw);
}

export function buildHouse(game) {
  const { physics, interact } = game;
  const root = new THREE.Group();
  root.name = 'house';
  const b = new Builder(root, physics, interact);
  const M = (c) => toon(c);
  const anchors = {};

  // ------------------------------------------------------------ materials
  const floorWood = toonTex('floorWood', 256, 256, planksTexture('#b07a46', '#8a5a30'), { repeat: [1, 1] });
  floorWood.map.wrapS = floorWood.map.wrapT = THREE.RepeatWrapping;
  const kitchenTile = toonTex('kitchenTile', 128, 128, (g) => {
    g.fillStyle = '#e4e0d2';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#c9c3ad';
    g.fillRect(0, 0, 64, 64);
    g.fillRect(64, 64, 64, 64);
  });
  kitchenTile.map.wrapS = kitchenTile.map.wrapT = THREE.RepeatWrapping;
  const carpetM = M(C.carpetMorty);
  const carpetL = M(C.carpetLiving);
  const concrete = M(C.concrete);
  const trim = M(C.trim);
  const ceil = M(C.ceiling);
  const wallMorty = M(C.mortyWall);
  const wallHall = M(C.hallWall);
  const wallLiving = M(C.livingWall);
  const wallKitchen = M(C.kitchenWall);
  const wallGarage = M(C.garageWall);
  const siding = toonTex('siding', 128, 128, (g) => {
    g.fillStyle = '#e3d49c';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#c7b77e';
    g.lineWidth = 3;
    for (let y = 0; y <= 128; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(128, y);
      g.stroke();
    }
  });
  siding.map.wrapS = siding.map.wrapT = THREE.RepeatWrapping;
  siding.map.repeat.set(1, 1);
  const doorMat = M(0xf1ece0);
  const extTrim = M(0xf7f4ec);
  const roofM = M(C.roof);

  const T = 0.2; // exterior wall thickness
  const t = 0.14; // interior wall thickness
  const H1 = 2.9; // ground floor ceiling
  const F2 = 3.1; // second floor height
  const H2 = 5.9; // second floor ceiling

  // ------------------------------------------------------------ floors
  // ground floor surfaces (visual; the physics ground is y=0 everywhere)
  texturedPlane(floorWood, 12.4, 5.4, 1.2, 0.002, 1.3, root); // living room
  texturedPlane(kitchenTile, 14, 6.6, 2, 0.002, -4.7, root); // kitchen
  texturedPlane(floorWood, 1.6, 5.4, 8.2, 0.002, 1.3, root); // under stairs strip
  mesh(G.box(7.5, 0.04, 12), concrete, -8.75, 0.0, -2, root); // garage slab
  // walkable floor surfaces (for footstep sounds); thin boxes just under the visuals
  physics.box(-5, -0.2, -1.4, 9, 0.002, 4, { surface: 'wood' });
  physics.box(-5, -0.2, -8, 9, 0.002, -1.4, { surface: 'tile' });
  physics.box(-12.5, -0.2, -8, -5, 0.002, 4, { surface: 'concrete' });
  physics.box(-11.8, -0.2, 4, -5.7, 0.002, 15, { surface: 'concrete' });
  physics.box(5.5, -0.2, 4, 6.7, 0.002, 14, { surface: 'concrete' });
  physics.box(-450, -0.2, 14, 450, 0.002, 24.6, { surface: 'concrete' });
  physics.box(-5, F2 - 0.02, -1.4, 1.5, F2 + 0.001, 4, { surface: 'carpet' });
  // living room rug
  mesh(G.box(3.4, 0.02, 2.3), M(0x8a3b3b), 0.6, 0.012, 1.4, root);
  mesh(G.box(3.0, 0.022, 1.9), M(0xb35a4a), 0.6, 0.014, 1.4, root);

  // second floor slab (with the stair hole at x 7.4..9, z -0.9..3.9)
  // the visible ceiling is three flat panels that share whole edges (no cracks);
  // the slabs that you walk on upstairs sit just above them
  const ceilPanel = (x0, z0, x1, z1) => mesh(G.plane(x1 - x0, z1 - z0), ceil, (x0 + x1) / 2, H1, (z0 + z1) / 2, root, { rx: Math.PI / 2 });
  ceilPanel(-5, -8, 7.4, -1.4);
  ceilPanel(7.4, -8, 9, -1.4);
  ceilPanel(-5, -1.4, 7.4, 2.9);
  ceilPanel(-5, 2.9, 7.4, 4);
  ceilPanel(7.4, 2.9, 9, 4);
  b.box(-5, H1 + 0.02, -8, 9, F2, -1.4, ceil, { collide: false });
  b.box(-5, H1 + 0.02, -1.4, 7.4, F2, 4, ceil, { collide: false });
  b.box(7.4, H1 + 0.02, 2.9, 9, F2, 4, ceil, { collide: false });
  physics.box(-5, H1, -8, 9, F2, -1.4, { surface: 'wood' });
  physics.box(-5, H1, -1.4, 7.4, F2, 4, { surface: 'wood' });
  physics.box(7.4, H1, 2.9, 9, F2, 4, { surface: 'wood' });
  // upstairs floor coverings
  texturedPlane(carpetM, 6.5, 5.4, -1.75, F2 + 0.003, 1.3, root);
  texturedPlane(floorWood, 14, 1.8, 2, F2 + 0.003, -2.3, root);
  texturedPlane(M(0xd7c7d6), 5.9, 5.4, 4.45, F2 + 0.003, 1.3, root); // summer's room
  // upstairs ceiling
  b.box(-5, H2, -8, 9, H2 + 0.1, 4, ceil);
  // garage ceiling
  b.box(-12.5, 3.2, -8, -5, 3.3, 4, M(0xc9cbc4));

  // ------------------------------------------------------------ exterior walls
  const sideMat = siding;
  // front wall (z = 4): front door at 5.6..6.6, living windows, upstairs windows
  b.wallX(4, -5, 9, 0, H1, T, wallLiving, sideMat, [
    { a: 5.6, b: 6.6, y0: 0, y1: 2.15 },
    { a: -3.6, b: -1.6, y0: 0.9, y1: 2.1 },
    { a: 1.4, b: 3.4, y0: 0.9, y1: 2.1 },
  ], { trim: extTrim });
  b.wallX(4, -5, 1.5, H1, H2 + 0.1, T, wallMorty, sideMat, [{ a: -3.3, b: -1.7, y0: F2 + 1.0, y1: F2 + 2.1 }], { trim: extTrim });
  b.wallX(4, 1.5, 9, H1, H2 + 0.1, T, M(0xd7b8cf), sideMat, [{ a: 3.8, b: 5.4, y0: F2 + 1.0, y1: F2 + 2.1 }], { trim: extTrim });
  // back wall (z = -8)
  b.wallX(-8, -5, 9, 0, H1, T, sideMat, wallKitchen, [{ a: -1.5, b: 1.5, y0: 1.2, y1: 2.2 }, { a: 4, b: 6, y0: 1.0, y1: 2.2 }], { trim: extTrim });
  b.wallX(-8, -5, 9, H1, H2 + 0.1, T, sideMat, wallHall, [{ a: -2.5, b: -1, y0: F2 + 1.0, y1: F2 + 2.1 }, { a: 5.6, b: 6.6, y0: F2 + 1.2, y1: F2 + 2.0 }], { trim: extTrim });
  // right wall (x = 9)
  b.wallZ(9, -8, 4, 0, H1, T, wallKitchen, sideMat, [{ a: -5.5, b: -3.5, y0: 1.0, y1: 2.1 }], { trim: extTrim });
  b.wallZ(9, -8, 4, H1, H2 + 0.1, T, wallHall, sideMat, [], {});
  // left wall (x = -5) shared with the garage below; door kitchen<->garage at z -6.2..-5.2
  b.wallZ(-5, -8, 4, 0, 3.2, T, wallGarage, wallKitchen, [{ a: -6.2, b: -5.2, y0: 0, y1: 2.1 }], { trim: trim });
  b.wallZ(-5, -8, 4, 3.2, H2 + 0.1, T, sideMat, wallMorty, [{ a: 0.6, b: 2.2, y0: F2 + 1.0, y1: F2 + 2.1 }], { trim: extTrim });

  // ------------------------------------------------------------ ground floor interior walls
  // living <-> kitchen wall at z=-1.4, wide archway 0.5..4.5
  b.wallX(-1.4, -5, 7.4, 0, H1, t, wallKitchen, wallLiving, [{ a: 0.5, b: 4.5, y0: 0, y1: 2.3 }], { trim });
  // wall along the side of the stairs (you get on them at the front, by the front door)
  b.wallZ(7.4, -1.4, 2.75, 0, H1, t, wallLiving, wallHall, [], {});
  b.box(7.33, 0, 2.75, 7.47, H1, 2.85, trim, { collide: false });
  // stairwell back wall (behind the bottom of the stairs, x 7.4..9 at z=-1.4 is the kitchen wall)
  b.wallX(-1.4, 7.4, 9, 0, H1, t, wallKitchen, wallHall, [], {});

  // ------------------------------------------------------------ stairs
  const stairMat = M(C.wood);
  const steps = 16;
  const rise = F2 / steps;
  const run = 0.28;
  for (let i = 0; i < steps; i++) {
    const z1 = 3.08 - i * run;
    const z0 = z1 - run;
    b.box(7.45, 0, z0, 8.95, rise * (i + 1), z1, stairMat, { surface: 'wood' });
    mesh(G.box(1.5, 0.03, run), M(0x8d5d34), 8.2, rise * (i + 1) + 0.015, (z0 + z1) / 2, root);
  }

  // ------------------------------------------------------------ second floor interior walls
  // hall front wall (z=-1.4): Morty's door -1.6..-0.6, Summer's door 4..5
  b.wallX(-1.4, -5, 7.4, F2, H2, t, wallHall, wallMorty, [{ a: -1.6, b: -0.6, y0: F2, y1: F2 + 2.1 }, { a: 4.0, b: 5.0, y0: F2, y1: F2 + 2.1 }], { trim });
  // Morty <-> Summer wall
  b.wallZ(1.5, -1.4, 4, F2, H2, t, wallMorty, M(0xd7b8cf), [], {});
  // Summer's room <-> stairwell
  b.wallZ(7.4, -1.4, 4, F2, H2, t, M(0xd7b8cf), wallHall, [], {});
  // hall back wall (z=-3.2): parents' door 0.5..1.5, bathroom door 5.5..6.5
  b.wallX(-3.2, -5, 9, F2, H2, t, M(0xcfc4b8), wallHall, [{ a: 0.5, b: 1.5, y0: F2, y1: F2 + 2.1 }, { a: 5.5, b: 6.5, y0: F2, y1: F2 + 2.1 }], { trim });
  b.wallZ(3.5, -8, -3.2, F2, H2, t, M(0xcfc4b8), M(0xc4dde0), [], {});

  // ------------------------------------------------------------ garage walls
  // front (z=4) with the big door opening -11.8..-5.7
  b.wallX(4, -12.5, -5, 0, 3.3, T, wallGarage, sideMat, [{ a: -11.8, b: -5.7, y0: 0, y1: 2.7 }], { trim: extTrim });
  b.wallX(-8, -12.5, -5, 0, 3.3, T, sideMat, wallGarage, [{ a: -11, b: -10, y0: 1.4, y1: 2.3 }], { trim: extTrim });
  b.wallZ(-12.5, -8, 4, 0, 3.3, T, sideMat, wallGarage, [{ a: -3, b: -1.6, y0: 1.3, y1: 2.3 }], { trim: extTrim });

  // ------------------------------------------------------------ windows (glass)
  b.glass('x', 4, -3.6, -1.6, 0.9, 2.1);
  b.glass('x', 4, 1.4, 3.4, 0.9, 2.1);
  b.glass('x', 4, -3.3, -1.7, F2 + 1.0, F2 + 2.1);
  b.glass('x', 4, 3.8, 5.4, F2 + 1.0, F2 + 2.1);
  b.glass('x', -8, -1.5, 1.5, 1.2, 2.2);
  b.glass('x', -8, 4, 6, 1.0, 2.2);
  b.glass('x', -8, -2.5, -1, F2 + 1.0, F2 + 2.1);
  b.glass('x', -8, 5.6, 6.6, F2 + 1.2, F2 + 2.0);
  b.glass('z', 9, -5.5, -3.5, 1.0, 2.1);
  b.glass('z', -5, 0.6, 2.2, F2 + 1.0, F2 + 2.1);
  b.glass('x', -8, -11, -10, 1.4, 2.3);
  b.glass('z', -12.5, -3, -1.6, 1.3, 2.3);

  // ------------------------------------------------------------ doors
  const lockedLine = (lines) => () => game.say(lines);
  const mortyDoor = b.door({ axis: 'x', c: -1.4, a: -1.6, b: -0.6, y0: F2, y1: F2 + 2.1, hinge: 'a', swing: -1, mat: doorMat, label: "Morty's door" });
  const summerSign = posterMat('summerSign', (g) => {
    g.fillStyle = '#ffd1e8';
    g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#d6246e';
    g.font = 'bold 64px sans-serif';
    g.textAlign = 'center';
    g.fillText('KEEP', 128, 120);
    g.fillText('OUT', 128, 200);
    g.font = 'bold 30px sans-serif';
    g.fillText('ESPECIALLY', 128, 260);
    g.fillText('MORTY', 128, 300);
  });
  b.door({ axis: 'x', c: -1.4, a: 4.0, b: 5.0, y0: F2, y1: F2 + 2.1, hinge: 'b', swing: 1, mat: M(C.summerDoor), label: "Summer's door", sign: summerSign, locked: lockedLine([['summer', 'Ugh, get OUT, Grandpa! Knock first!'], ['rick', "Relax, I'm not going in there. It smells like body spray and teen angst."]]) });
  b.door({ axis: 'x', c: -3.2, a: 0.5, b: 1.5, y0: F2, y1: F2 + 2.1, hinge: 'a', swing: 1, mat: doorMat, label: "Beth and Jerry's door", locked: lockedLine([['rick', "Nope. Not opening that door. I don't need to see Jerry's sad little life up close."]]) });
  b.door({ axis: 'x', c: -3.2, a: 5.5, b: 6.5, y0: F2, y1: F2 + 2.1, hinge: 'b', swing: 1, mat: doorMat, label: 'bathroom door', locked: lockedLine([['jerry', "Occupied! Give me a minute, I'm... reading."], ['rick', 'For the love of... *burp* ...light a match, Jerry.']]) });
  const garageDoor = b.door({ axis: 'z', c: -5, a: -6.2, b: -5.2, y0: 0, y1: 2.1, hinge: 'a', swing: 1, mat: doorMat, label: 'garage door', open: true });
  const frontDoor = b.door({ axis: 'x', c: 4, a: 5.6, b: 6.6, y0: 0, y1: 2.15, hinge: 'b', swing: -1, mat: M(0x9b3b2e), label: 'front door' });
  void garageDoor;
  void frontDoor;

  // big roll-up garage door
  const gd = new THREE.Group();
  gd.userData.dynamic = true;
  const gdPanel = mesh(G.box(6.1, 2.7, 0.08), M(0xf2f0e8), 0, 1.35, 0, gd);
  gdPanel.userData.dynamic = true;
  for (let i = 0; i < 4; i++) {
    const p = mesh(G.box(6.0, 0.03, 0.1), M(0xcfccc2), 0, 0.67 * i + 0.66, 0, gd);
    p.userData.dynamic = true;
  }
  gd.position.set(-8.75, 0, 3.98);
  root.add(gd);
  const garageColl = physics.box(-11.8, 0, 3.9, -5.7, 2.7, 4.06, { portalable: true, surface: 'metal' });
  const garage = {
    open: false,
    t: 0,
    set(o) {
      if (o === this.open) return;
      this.open = o;
      garageColl.enabled = !o;
      game.audio.whoosh(0.15);
    },
    update(dt) {
      this.t += ((this.open ? 1 : 0) - this.t) * Math.min(1, dt * 1.6);
      // rolls up and tucks under the ceiling
      gd.position.y = this.t * 2.6;
      gd.position.z = 3.98 - this.t * 1.2;
      gd.rotation.x = -this.t * (Math.PI / 2) * 0.98;
    },
  };
  interact.add({
    pos: new THREE.Vector3(-5.3, 1.3, 3.6),
    radius: 0.5,
    label: () => (garage.open ? 'Close the garage door' : 'Open the garage door'),
    use: () => garage.set(!garage.open),
  });
  // button panel next to the garage door
  b.box(-5.36, 1.1, 3.45, -5.24, 1.5, 3.75, M(0xd8d5cc), { collide: false });
  mesh(G.cyl(0.04, 0.04, 0.04, 10), glow(0xff5544, 1.5), -5.38, 1.3, 3.6, root, { rz: Math.PI / 2 });

  // ------------------------------------------------------------ Morty's room furniture
  const blanket = M(0x5a8fd0);
  // bed against the left wall, head at the back
  b.box(-4.9, F2, 0, -3.3, F2 + 0.45, 2.1, M(C.woodDark), { tag: 'bed' });
  mesh(G.box(1.5, 0.18, 1.95), M(0xf3f3ee), -4.1, F2 + 0.52, 1.07, root);
  mesh(G.box(1.56, 0.12, 1.5), blanket, -4.1, F2 + 0.6, 1.33, root);
  mesh(G.box(0.7, 0.14, 0.4), M(0xffffff), -4.1, F2 + 0.66, 0.3, root);
  b.box(-4.95, F2, -0.05, -3.25, F2 + 1.1, 0.07, M(C.woodDark));
  anchors.mortyBed = new THREE.Vector3(-4.1, F2 + 0.62, 1.1);
  // desk + chair + computer
  b.box(-1.2, F2 + 0.72, 3.3, 0.9, F2 + 0.78, 3.85, M(C.wood));
  for (const x of [-1.15, 0.85]) b.box(x - 0.04, F2, 3.35, x + 0.04, F2 + 0.72, 3.8, M(C.woodDark), { collide: false });
  physics.box(-1.2, F2, 3.3, 0.9, F2 + 0.78, 3.85, { surface: 'wood' });
  mesh(G.box(0.55, 0.4, 0.06), M(0x3a3d44), -0.3, F2 + 1.06, 3.68, root);
  const monitorScreen = mesh(G.plane(0.48, 0.32), glow(0x7fb6ff, 0.9), -0.3, F2 + 1.07, 3.645, root, { ry: Math.PI });
  monitorScreen.userData.dynamic = true;
  mesh(G.box(0.08, 0.2, 0.08), M(0x3a3d44), -0.3, F2 + 0.86, 3.7, root);
  mesh(G.box(0.4, 0.03, 0.16), M(0x2f3238), -0.3, F2 + 0.795, 3.45, root);
  b.box(-0.55, F2, 2.6, -0.05, F2 + 0.48, 3.05, M(0x3b5f9a));
  b.box(-0.55, F2 + 0.48, 3.0, -0.05, F2 + 1.05, 3.08, M(0x3b5f9a), { collide: false });
  // dresser
  b.box(-4.95, F2, 2.7, -4.35, F2 + 1.0, 3.8, M(C.wood));
  for (const y of [0.25, 0.55, 0.85]) mesh(G.box(0.02, 0.22, 0.95), M(0x8f5f36), -4.34, F2 + y, 3.25, root);
  // lamp on dresser
  mesh(G.cyl(0.05, 0.08, 0.3, 10), M(0x444851), -4.6, F2 + 1.15, 3.5, root);
  const mortyLamp = mesh(G.cone(0.16, 0.2, 14, true), M(0xf3e7b4), -4.6, F2 + 1.38, 3.5, root);
  mortyLamp.userData.dynamic = true;
  // posters (original art)
  const planetPoster = posterMat('planetPoster', (g) => {
    g.fillStyle = '#1d1b3a';
    g.fillRect(0, 0, 256, 360);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = '#fff';
      g.fillRect((i * 97) % 256, (i * 53) % 360, 2, 2);
    }
    g.fillStyle = '#f08a3c';
    g.beginPath();
    g.arc(128, 160, 70, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffd38a';
    g.lineWidth = 10;
    g.beginPath();
    g.ellipse(128, 160, 115, 26, -0.3, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#9ff';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.fillText('SPACE', 128, 300);
  });
  mesh(G.plane(0.7, 0.98), planetPoster, -4.88, F2 + 1.75, 2.0, root, { ry: Math.PI / 2 });
  const bandPoster = posterMat('bandPoster', (g) => {
    g.fillStyle = '#e8463a';
    g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#111';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.fillText('GEAR', 128, 90);
    g.fillText('HEADZ', 128, 150);
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineTo(128 + Math.cos(a) * (i % 2 ? 60 : 80), 250 + Math.sin(a) * (i % 2 ? 60 : 80));
    }
    g.fill();
    g.fillStyle = '#e8463a';
    g.beginPath();
    g.arc(128, 250, 28, 0, Math.PI * 2);
    g.fill();
  });
  mesh(G.plane(0.62, 0.86), bandPoster, 0.4, F2 + 1.7, -1.32, root);
  // dirty laundry
  mesh(G.sphere(0.2, 10, 8), M(0xf5df4d), -2.2, F2 + 0.06, 2.9, root, { sy: 0.3, sx: 1.4 });
  mesh(G.sphere(0.18, 10, 8), M(0x3d64ac), -2.6, F2 + 0.05, 3.2, root, { sy: 0.3, sx: 1.6 });
  // trash can
  b.box(0.98, F2, 3.5, 1.3, F2 + 0.4, 3.8, M(0x8fa0b0));

  // ------------------------------------------------------------ hallway decor
  const familyPhoto = posterMat('familyPhoto', (g) => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#bfe0f0';
    g.fillRect(16, 16, 224, 328);
    const heads = [['#f0b25b', 70], ['#6b4a2e', 120], ['#e8742f', 170], ['#6e4426', 95]];
    heads.forEach(([c, x], i) => {
      g.fillStyle = '#f5d0aa';
      g.beginPath();
      g.arc(x + (i === 3 ? 50 : 0), i === 3 ? 230 : 160, i === 3 ? 30 : 26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c;
      g.beginPath();
      g.arc(x + (i === 3 ? 50 : 0), i === 3 ? 215 : 145, i === 3 ? 26 : 22, Math.PI, 0);
      g.fill();
    });
    g.fillStyle = '#333';
    g.font = '22px sans-serif';
    g.textAlign = 'center';
    g.fillText('THE SMITHS', 128, 320);
  });
  mesh(G.plane(0.5, 0.7), familyPhoto, -2.5, F2 + 1.6, -3.12, root);
  mesh(G.plane(0.5, 0.7), familyPhoto, 7.0, 1.55, -1.32, root);
  // hall runner rug
  mesh(G.box(9, 0.02, 0.8), M(0x7d5a8a), 1.5, F2 + 0.012, -2.3, root);

  // ------------------------------------------------------------ living room
  const couchC = M(0x8b4a46);
  const couchD = M(0x6e3633);
  // couch faces the TV on the left (-x) wall
  const cx = 1.6, cz = 1.4;
  b.box(cx - 0.45, 0, cz - 1.25, cx + 0.45, 0.45, cz + 1.25, couchC);
  b.box(cx + 0.3, 0.45, cz - 1.25, cx + 0.55, 1.05, cz + 1.25, couchD);
  b.box(cx - 0.45, 0.45, cz - 1.45, cx + 0.45, 0.75, cz - 1.25, couchD);
  b.box(cx - 0.45, 0.45, cz + 1.25, cx + 0.45, 0.75, cz + 1.45, couchD);
  for (const dz of [-0.62, 0.62]) mesh(G.rbox(0.8, 0.16, 1.15, 0.06), couchC, cx - 0.02, 0.52, cz + dz, root);
  for (const dz of [-0.62, 0.62]) mesh(G.rbox(0.2, 0.55, 1.1, 0.06), couchC, cx + 0.32, 0.86, cz + dz, root, { rz: 0.1 });
  anchors.couchSeats = [new THREE.Vector3(cx, 0, cz - 0.75), new THREE.Vector3(cx, 0, cz), new THREE.Vector3(cx, 0, cz + 0.75)];
  // coffee table
  b.box(-0.6, 0.38, 0.8, 0.4, 0.45, 2.0, M(C.wood));
  for (const [x, z] of [[-0.55, 0.85], [0.35, 0.85], [-0.55, 1.95], [0.35, 1.95]]) mesh(G.box(0.05, 0.38, 0.05), M(C.woodDark), x, 0.19, z, root);
  physics.box(-0.6, 0, 0.8, 0.4, 0.45, 2.0, { surface: 'wood' });
  mesh(G.cyl(0.05, 0.04, 0.1, 10), M(0xf2f2f2), -0.2, 0.5, 1.2, root);
  // TV stand + TV on the left wall
  b.box(-4.9, 0, 0.4, -4.3, 0.6, 2.4, M(C.woodDark));
  const tvBody = mesh(G.box(0.3, 0.95, 1.55), M(0x2b2d33), -4.55, 1.12, 1.4, root);
  tvBody.userData.dynamic = true;
  physics.box(-4.7, 0.6, 0.62, -4.4, 1.6, 2.18, { portalable: false });
  anchors.tvScreen = { pos: new THREE.Vector3(-4.395, 1.13, 1.4), w: 1.38, h: 0.8 };
  // armchair
  b.box(-1.9, 0, 3.0, -1.0, 0.45, 3.8, couchC);
  b.box(-1.9, 0.45, 3.6, -1.0, 1.05, 3.85, couchD);
  // floor lamp
  mesh(G.cyl(0.02, 0.02, 1.5, 6), M(0x3a3a3a), 3.6, 0.75, 3.6, root);
  mesh(G.cyl(0.18, 0.18, 0.04, 12), M(0x3a3a3a), 3.6, 0.02, 3.6, root);
  const floorLamp = mesh(G.cyl(0.14, 0.25, 0.32, 14, true), M(0xf3e2b2), 3.6, 1.6, 3.6, root);
  floorLamp.userData.dynamic = true;
  // bookshelf
  // open-front bookshelf against the kitchen wall
  const shelfM = M(C.woodDark);
  b.box(4.2, 0, -1.33, 5.8, 1.9, -1.29, shelfM, { collide: false });
  for (const x of [4.2, 5.76]) b.box(x, 0, -1.33, x + 0.04, 1.9, -0.95, shelfM, { collide: false });
  for (const y of [0, 0.62, 1.24, 1.86]) b.box(4.2, y, -1.33, 5.8, y + 0.04, -0.95, shelfM, { collide: false });
  physics.box(4.2, 0, -1.33, 5.8, 1.9, -0.95, { surface: 'wood' });
  const bookColors = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22];
  for (let sh = 0; sh < 3; sh++) for (let i = 0; i < 8; i++) {
    const hgt = 0.36 + ((i * 7 + sh * 3) % 5) * 0.04;
    mesh(G.box(0.13, hgt, 0.26), M(bookColors[(i + sh * 2) % 6]), 4.36 + i * 0.17, 0.04 + sh * 0.62 + hgt / 2, -1.13, root, { rz: i === 6 ? 0.18 : 0 });
  }
  // wall art
  const art = posterMat('livingArt', (g) => {
    g.fillStyle = '#5a3d2b';
    g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#8fc7e8';
    g.fillRect(14, 14, 228, 332);
    g.fillStyle = '#5c9a4a';
    g.beginPath();
    g.moveTo(14, 260);
    g.quadraticCurveTo(128, 180, 242, 250);
    g.lineTo(242, 346);
    g.lineTo(14, 346);
    g.fill();
    g.fillStyle = '#7a5a3a';
    g.fillRect(150, 150, 24, 110);
    g.fillStyle = '#3f7a3a';
    g.beginPath();
    g.arc(162, 140, 50, 0, Math.PI * 2);
    g.fill();
  });
  mesh(G.plane(1.1, 0.8), art, 1.8, 1.7, 3.89, root, { ry: Math.PI });
  mesh(G.plane(0.5, 0.7), familyPhoto, -2.2, 1.65, -1.32, root);
  mesh(G.plane(0.4, 0.55), planetPoster, -0.9, 1.75, -1.32, root);

  // ------------------------------------------------------------ kitchen
  const cab = M(0x9c6b3f);
  const counterTop = M(0xe9e4d8);
  // counter along the back wall
  b.box(-4.9, 0, -7.9, 3.4, 0.88, -7.25, cab);
  b.box(-4.95, 0.88, -7.95, 3.45, 0.94, -7.2, counterTop, { collide: false });
  for (let x = -4.6; x < 3.4; x += 0.75) mesh(G.box(0.66, 0.7, 0.05), M(0xaf7d4e), x + 0.32, 0.45, -7.22, root);
  // upper cabinets
  b.box(-4.9, 1.6, -7.9, -2.0, 2.4, -7.5, cab, { collide: false });
  b.box(2.2, 1.6, -7.9, 3.4, 2.4, -7.5, cab, { collide: false });
  // sink
  mesh(G.box(0.8, 0.05, 0.45), M(0xb8c4cc), 0, 0.93, -7.55, root);
  mesh(G.cyl(0.02, 0.02, 0.3, 6), M(0xc0c8cf), 0, 1.08, -7.8, root);
  // stove
  b.box(-3.9, 0, -7.9, -3.1, 0.92, -7.25, M(0xeeeeee));
  for (const [x, z] of [[-3.7, -7.45], [-3.3, -7.45], [-3.7, -7.75], [-3.3, -7.75]]) mesh(G.cyl(0.09, 0.09, 0.02, 12), M(0x333333), x, 0.94, z, root);
  // fridge
  b.box(4.0, 0, -7.9, 4.9, 2.0, -7.15, M(0xf4f4f0));
  mesh(G.box(0.03, 0.5, 0.04), M(0x999999), 4.1, 1.3, -7.12, root);
  // kitchen table + chairs (breakfast!)
  const tableC = new THREE.Vector3(2.5, 0, -4.5);
  b.box(tableC.x - 1.0, 0.72, tableC.z - 0.6, tableC.x + 1.0, 0.78, tableC.z + 0.6, M(C.wood));
  for (const [dx, dz] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) mesh(G.box(0.06, 0.72, 0.06), M(C.woodDark), tableC.x + dx, 0.36, tableC.z + dz, root);
  physics.box(tableC.x - 1.0, 0, tableC.z - 0.6, tableC.x + 1.0, 0.78, tableC.z + 0.6, { surface: 'wood' });
  anchors.tableTop = tableC.clone().setY(0.78);
  anchors.chairs = [];
  const chairM = M(0x8a5a35);
  const chairSpots = [[-1.45, 0, Math.PI / 2], [1.45, 0, -Math.PI / 2], [-0.4, -1.0, 0], [0.4, 1.0, Math.PI]];
  for (const [dx, dz, yaw] of chairSpots) {
    const x = tableC.x + dx, z = tableC.z + dz;
    mesh(G.box(0.45, 0.05, 0.45), chairM, x, 0.45, z, root);
    const back = new THREE.Vector3(-Math.sin(yaw) * 0.21, 0, -Math.cos(yaw) * 0.21);
    mesh(G.box(Math.abs(back.x) > 0.1 ? 0.05 : 0.45, 0.55, Math.abs(back.z) > 0.1 ? 0.05 : 0.45), chairM, x + back.x, 0.75, z + back.z, root);
    for (const [ex, ez] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) mesh(G.box(0.04, 0.45, 0.04), M(C.woodDark), x + ex, 0.225, z + ez, root);
    physics.box(x - 0.24, 0, z - 0.24, x + 0.24, 0.48, z + 0.24, { surface: 'wood' });
    anchors.chairs.push({ pos: new THREE.Vector3(x, 0, z), yaw });
  }
  // breakfast stuff
  for (const [dx, dz] of [[-0.6, 0], [0.6, 0], [0, -0.35], [0, 0.35]]) {
    mesh(G.cyl(0.13, 0.11, 0.025, 16), M(0xffffff), tableC.x + dx, 0.79, tableC.z + dz, root);
  }
  mesh(G.cyl(0.04, 0.035, 0.12, 10), M(0xffffff), tableC.x + 0.25, 0.84, tableC.z - 0.15, root);
  const butterDish = mesh(G.box(0.14, 0.05, 0.08), M(0xfff1a1), tableC.x - 0.25, 0.81, tableC.z + 0.12, root);
  butterDish.userData.dynamic = true;
  anchors.butter = butterDish;

  // ------------------------------------------------------------ garage interior
  const benchTop = M(0x8a6a48);
  // workbench along the back wall
  b.box(-12.3, 0.88, -7.85, -7.6, 0.96, -6.9, benchTop, { surface: 'wood' });
  for (const x of [-12.2, -9.95, -7.7]) b.box(x - 0.05, 0, -7.8, x + 0.05, 0.88, -6.95, M(0x5c5f63), { collide: false });
  physics.box(-12.3, 0, -7.85, -7.6, 0.96, -6.9, { surface: 'wood' });
  // pegboard + tools
  const peg = toonTex('pegboard', 128, 128, (g) => {
    g.fillStyle = '#c8a77a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#8a6a48';
    for (let y = 8; y < 128; y += 16) for (let x = 8; x < 128; x += 16) {
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  });
  mesh(G.plane(4.2, 1.3), peg, -10.0, 1.85, -7.88, root);
  const toolM = M(0x6b7178);
  mesh(G.box(0.05, 0.4, 0.03), toolM, -11.5, 1.8, -7.85, root);
  mesh(G.box(0.18, 0.06, 0.04), M(0xd23c2c), -11.5, 2.0, -7.84, root);
  mesh(G.box(0.04, 0.35, 0.03), toolM, -11.0, 1.85, -7.85, root, { rz: 0.3 });
  mesh(G.torus(0.12, 0.025, 6, 14), M(0xe0a020), -10.4, 1.9, -7.84, root);
  mesh(G.box(0.3, 0.05, 0.03), toolM, -9.6, 2.2, -7.85, root);
  mesh(G.box(0.05, 0.3, 0.03), M(0x2f6fbf), -9.0, 1.7, -7.85, root, { rz: -0.4 });
  // junk on the bench
  mesh(G.box(0.4, 0.25, 0.3), M(0x5e7d4f), -11.6, 1.09, -7.4, root);
  mesh(G.cyl(0.1, 0.1, 0.3, 10), M(0xb04a3a), -11.1, 1.11, -7.2, root);
  mesh(G.box(0.5, 0.06, 0.35), M(0x30343a), -10.3, 0.99, -7.3, root);
  for (let i = 0; i < 5; i++) mesh(G.cyl(0.015, 0.015, 0.12, 6), M(0xc0a050), -10.5 + i * 0.08, 1.06, -7.2, root, { rz: 1.2 });
  anchors.workbench = new THREE.Vector3(-8.6, 1.0, -7.2);
  // portal fluid refiner: tanks of green goo
  const refiner = new THREE.Group();
  refiner.position.set(-8.4, 0.96, -7.45);
  root.add(refiner);
  mesh(G.box(0.9, 0.12, 0.5), M(0x52565c), 0, 0.06, 0, refiner);
  for (const dx of [-0.28, 0, 0.28]) {
    mesh(G.cyl(0.11, 0.11, 0.5, 14), M(0xd0d6d2), dx, 0.37, 0, refiner);
    const goo = mesh(G.cyl(0.09, 0.09, 0.44, 14), glow(0x7cff4a, 2.2), dx, 0.37, 0, refiner);
    goo.scale.set(1.03, 1, 1.03);
    mesh(G.cyl(0.115, 0.115, 0.04, 14), M(0x52565c), dx, 0.64, 0, refiner);
  }
  mesh(G.torus(0.18, 0.02, 6, 16, Math.PI), M(0x52565c), 0.14, 0.7, 0, refiner);
  anchors.refiner = refiner;
  // shelves on the left wall
  for (const y of [0.1, 0.8, 1.5, 2.2]) b.box(-12.4, y, -1, -11.8, y + 0.05, 2.6, M(0x7a7d80), { collide: false });
  for (const z of [-0.95, 2.55]) b.box(-12.4, 0, z - 0.04, -11.8, 2.3, z + 0.04, M(0x7a7d80), { collide: false });
  physics.box(-12.4, 0, -1, -11.8, 2.3, 2.6, { surface: 'metal' });
  const r = rng(7);
  const junkC = [0xc0392b, 0x2e86c1, 0x7f8c8d, 0xd35400, 0x16a085, 0x95a5a6];
  for (let i = 0; i < 18; i++) {
    const y = [0.15, 0.85, 1.55, 2.25][i % 4];
    const z = -0.7 + r() * 3.0;
    const s = 0.15 + r() * 0.25;
    if (r() < 0.5) mesh(G.box(0.35, s, s), M(junkC[i % 6]), -12.1, y + s / 2, z, root);
    else mesh(G.cyl(s * 0.4, s * 0.4, s, 10), M(junkC[(i + 3) % 6]), -12.1, y + s / 2, z, root);
  }
  // washer + dryer
  for (const [z, c] of [[-7.4, 0xf2f2ef], [-6.6, 0xe9e9e6]]) {
    b.box(-5.9, 0, z - 0.38, -5.2, 0.95, z + 0.38, M(c));
    mesh(G.cyl(0.22, 0.22, 0.02, 18), M(0x8fa0aa), -5.9, 0.5, z, root, { rz: Math.PI / 2 });
  }
  // fluorescent tubes
  for (const z of [-4, 1]) {
    mesh(G.box(0.25, 0.06, 1.6), M(0xdddddd), -8.75, 3.16, z, root);
    const tube = mesh(G.box(0.12, 0.04, 1.5), glow(0xf4ffff, 1.15), -8.75, 3.12, z, root);
    tube.userData.dynamic = true;
  }

  // ------------------------------------------------------------ ceiling lights in the house
  const lampSpots = [[1.2, H1, 1.3], [2.5, H1, -4.5], [-1.7, H2, 1.3], [2, H2, -2.3]];
  const ceilingLamps = [];
  for (const [x, y, z] of lampSpots) {
    mesh(G.cyl(0.25, 0.3, 0.06, 16), M(0xeeeeee), x, y - 0.03, z, root);
    const bulb = mesh(G.sphere(0.2, 16, 8), glow(0xfff1c8, 1.2), x, y - 0.07, z, root, { sy: 0.4 });
    bulb.userData.dynamic = true;
    ceilingLamps.push(bulb);
  }

  // ------------------------------------------------------------ outside: house shell + roof
  // roof over the main house (gable along x)
  const roofGeo = new THREE.BufferGeometry();
  {
    const x0 = -5.4, x1 = 9.4, z0 = -8.6, z1 = 4.6, y0 = H2 + 0.1, y1 = H2 + 3.2;
    const zm = (z0 + z1) / 2;
    const v = [
      // two sloped planes
      x0, y0, z1, x1, y0, z1, x1, y1, zm, x0, y0, z1, x1, y1, zm, x0, y1, zm,
      x1, y0, z0, x0, y0, z0, x0, y1, zm, x1, y0, z0, x0, y1, zm, x1, y1, zm,
    ];
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((v.length / 3) * 2).fill(0), 2));
    roofGeo.computeVertexNormals();
  }
  const roofMesh = new THREE.Mesh(roofGeo, roofM);
  root.add(roofMesh);
  // gable walls are siding colored: recolor by drawing two triangles in siding paint
  const gable = new THREE.BufferGeometry();
  {
    const x0 = -5.08, x1 = 9.08, z0 = -8, z1 = 4, y0 = H2 + 0.1, y1 = H2 + 2.6, zm = -2;
    const v = [x0, y0, z0, x0, y0, z1, x0, y1, zm, x1, y0, z1, x1, y0, z0, x1, y1, zm];
    gable.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    gable.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1], 2));
    gable.computeVertexNormals();
  }
  root.add(new THREE.Mesh(gable, M(C.siding)));
  // garage roof (lower, sloped toward front)
  b.box(-12.8, 3.3, -8.3, -4.9, 3.5, 4.4, roofM, { surface: 'wood' });
  // chimney
  b.box(6.5, H2, -6, 7.4, H2 + 3.6, -5.1, M(0xa0584a));
  // porch
  b.box(5.0, 0, 4.1, 7.2, 0.12, 5.3, M(C.porch), { surface: 'concrete' });
  b.box(4.95, 2.4, 4.1, 7.25, 2.5, 5.4, roofM, { collide: false });
  for (const x of [5.1, 7.1]) b.box(x - 0.06, 0.12, 5.15, x + 0.06, 2.4, 5.27, extTrim);
  // shutters
  for (const [x, y] of [[-3.85, 1.5], [-1.35, 1.5], [1.15, 1.5], [3.65, 1.5], [-3.55, F2 + 1.55], [-1.45, F2 + 1.55], [3.55, F2 + 1.55], [5.65, F2 + 1.55]]) {
    mesh(G.box(0.3, 1.2, 0.05), M(0x4f6b4a), x, y, 4.14, root);
  }
  // mailbox
  mesh(G.cyl(0.04, 0.04, 1.1, 8), M(0x6b4a2e), -2.5, 0.55, 14.2, root);
  mesh(G.rbox(0.25, 0.25, 0.5, 0.08), M(0x3d5f9a), -2.5, 1.2, 14.2, root);
  const mailSign = toonTex('mailbox', 128, 64, (g) => {
    g.fillStyle = '#3d5f9a';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#fff';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.fillText('SMITH', 64, 44);
  });
  mesh(G.plane(0.45, 0.22), mailSign, -2.37, 1.2, 14.2, root, { ry: Math.PI / 2 });
  physics.box(-2.6, 0, 14.1, -2.4, 1.35, 14.3, { portalable: false });

  // ------------------------------------------------------------ yard, street, neighbors
  const grassM = M(C.grass);
  const groundGeo = new THREE.PlaneGeometry(960, 960, 32, 32);
  mesh(groundGeo, grassM, 0, -0.012, 0, root, { rx: -Math.PI / 2 });
  mesh(G.box(6.1, 0.03, 11), M(C.driveway), -8.75, 0.0, 9.5, root);
  mesh(G.box(1.2, 0.03, 9.6), M(C.sidewalk), 6.1, 0.0, 9.6, root); // path to the door
  physics.groundSurface = 'grass';

  const town = new THREE.Group();
  root.add(town);
  buildTown(town, physics, b);

  // ------------------------------------------------------------ boundaries for walking (flying ignores them)
  const lim = { x0: -70, x1: 70, z0: -40, z1: 75 };
  b.barrier(lim.x0 - 1, 0, lim.z0, lim.x0, 30, lim.z1);
  b.barrier(lim.x1, 0, lim.z0, lim.x1 + 1, 30, lim.z1);
  b.barrier(lim.x0, 0, lim.z0 - 1, lim.x1, 30, lim.z0);
  b.barrier(lim.x0, 0, lim.z1, lim.x1, 30, lim.z1 + 1);
  for (const c of physics.colliders.slice(-4)) c.tag = 'walkLimit';

  // things that need per-frame updates
  const flicker = { t: 0 };
  return {
    root,
    builder: b,
    anchors,
    garage,
    mortyDoor,
    frontDoor,
    monitorScreen,
    ceilingLamps,
    mortyLamp,
    floorLamp,
    spawn: {
      intro: { pos: new THREE.Vector3(-1.1, F2, -2.6), yaw: Math.PI },
      kitchen: { pos: new THREE.Vector3(5.6, 0, -3.2), yaw: Math.PI / 2 },
      garage: { pos: new THREE.Vector3(-7.0, 0, -4.8), yaw: Math.PI * 0.6 },
      yard: { pos: new THREE.Vector3(2, 0, 9), yaw: Math.PI },
    },
    update(dt) {
      b.update(dt);
      garage.update(dt);
      flicker.t += dt;
    },
    static() {
      batchStatic(root);
    },
  };
}

/** Suburb blocks around the Smith house so flying around has somewhere to go. */
function buildTown(root, physics, b) {
  const r = rng(1337);
  const M = (c) => toon(c);
  const asphalt = M(C.street);
  const walk = M(C.sidewalk);
  const sidings = [0xe8c9a0, 0xb9d3e6, 0xd8e3b0, 0xf0d7d7, 0xd9c7e8, 0xc9e0cf, 0xf1e3b8, 0xbfc9d9];
  const roofs = [0x6a5651, 0x5b6470, 0x7a4a3a, 0x4f5b4a, 0x6b6b6b];
  const windowLit = [];
  const lots = [[-13, -10, 10, 26]]; // keep trees out of buildings (x0, z0, x1, z1)
  const freeSpot = (x, z) => !lots.some(([a, c, bb, d]) => x > a - 3 && x < bb + 3 && z > c - 3 && z < d + 3);

  // main street in front of the house, plus a grid
  const roadZ = 19.25;
  strip(root, asphalt, 'x', -450, 450, roadZ, 7.5, -0.025, 0.004);
  strip(root, walk, 'x', -450, 450, 14.8, 1.6, -0.025, 0.03);
  strip(root, walk, 'x', -450, 450, 23.8, 1.6, -0.025, 0.03);
  for (let x = -440; x < 440; x += 6) mesh(G.box(2.2, 0.05, 0.18), M(0xf2d14b), x, 0.005, roadZ, root);
  const avenues = [-150, -75, 75, 150, 225, -225, 300, -300];
  for (const x of avenues) strip(root, asphalt, 'z', -450, 450, x, 7.5, -0.024, 0.003);
  const streets = [-90, 100, 180, -170, 260, -250];
  for (const z of streets) strip(root, asphalt, 'x', -450, 450, z, 7.5, -0.024, 0.002);

  const house = (x, z, face) => {
    // face: +1 front toward +z, -1 toward -z
    const w = 10 + r() * 4, d = 9 + r() * 3, h = r() < 0.5 ? 5.6 : 3.0;
    if (avenues.some((ax) => Math.abs(x - ax) < w / 2 + 5) || streets.some((sz) => Math.abs(z - sz) < d / 2 + 5) || Math.abs(z - roadZ) < d / 2 + 6) return;
    if (!freeSpot(x, z)) return;
    lots.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    const sc = sidings[(r() * sidings.length) | 0];
    const rc = roofs[(r() * roofs.length) | 0];
    b.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, M(sc), { surface: 'wood' });
    // pitched roof (cheap prism made from a rotated box pair)
    const rh = 2.4;
    const rg = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1);
    const roof = mesh(rg, M(rc), x, h + rh / 2, z, root, { ry: Math.PI / 4 });
    roof.scale.set((w / Math.SQRT2) * 1.12, rh, (d / Math.SQRT2) * 1.12);
    // windows (glow at night through emissive material swap)
    const fz = z + (face * d) / 2 + face * 0.02;
    for (const wx of [-w / 3, w / 3]) {
      for (const wy of h > 4 ? [1.5, 4.2] : [1.5]) {
        const wm = mesh(G.box(1.3, 1.0, 0.06), M(0x9cc9e0), x + wx, wy, fz, root);
        windowLit.push(wm);
      }
    }
    mesh(G.box(1.0, 2.1, 0.08), M(0x7a4a3a), x, 1.05, fz, root);
    // little lawn tree
    if (r() < 0.7) {
      const tx = x + (r() < 0.5 ? -1 : 1) * (w / 2 + 2.5), tz = z + face * (d / 2 + 3);
      if (freeSpot(tx, tz)) tree(root, physics, tx, tz, r);
    }
  };

  // neighbors on Smith street
  for (const x of [-34, -60, -88, 30, 56, 84, -116, 112, -144, 140]) house(x, -1, 1);
  for (const x of [-48, -20, 8, 36, 64, -76, 92, -104, 120, -132]) house(x, 33, -1);
  // more blocks further out
  for (let bx = -400; bx <= 400; bx += 75) {
    for (let bz = -380; bz <= 380; bz += 90) {
      if (Math.abs(bx) < 120 && bz > -60 && bz < 60) continue;
      if (r() < 0.25) continue;
      house(bx + 18 + r() * 8, bz + 20, 1);
      if (r() < 0.6) house(bx + 48 + r() * 6, bz + 22, 1);
      if (r() < 0.5) house(bx + 20 + r() * 8, bz + 58, -1);
    }
  }
  // the high school (a big building down the road)
  b.box(158, 0, 40, 218, 9, 75, M(0xc98a62), { surface: 'concrete' });
  lots.push([158, 40, 218, 75]);
  b.box(173, 9, 50, 203, 11, 65, M(0xa86f50));
  mesh(G.box(20, 2, 0.3), M(0xf4f0e0), 188, 7, 39.8, root);
  const schoolSign = toonTex('schoolSign', 512, 64, (g) => {
    g.fillStyle = '#f4f0e0';
    g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#7a2a2a';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.fillText('HARRY HERPSON HIGH SCHOOL', 256, 46);
  });
  mesh(G.plane(19.5, 1.8), schoolSign, 188, 7, 39.63, root, { ry: Math.PI });
  // water tower for flying landmarks
  mesh(G.cyl(5, 5, 6, 20), M(0xb7c7d4), -220, 30, -150, root);
  mesh(G.cone(5.4, 3, 20), M(0x8fa3b5), -220, 34.5, -150, root);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) mesh(G.cyl(0.3, 0.3, 27, 6), M(0x7a8a99), -220 + dx, 13.5, -150 + dz, root);
  // trees everywhere
  for (let i = 0; i < 260; i++) {
    const x = (r() - 0.5) * 860, z = (r() - 0.5) * 860;
    if (Math.abs(x) < 20 && z > -15 && z < 30) continue;
    if (Math.abs(z - roadZ) < 6 || !freeSpot(x, z)) continue;
    if (avenues.some((ax) => Math.abs(x - ax) < 6) || streets.some((sz) => Math.abs(z - sz) < 6)) continue;
    tree(root, physics, x, z, r);
  }
  // street lamps along Smith street
  const lamps = [];
  for (let x = -120; x <= 120; x += 30) {
    for (const z of [14.2, 24.4]) {
      mesh(G.cyl(0.08, 0.1, 5, 8), M(0x50555c), x, 2.5, z, root);
      mesh(G.box(0.9, 0.08, 0.15), M(0x50555c), x, 5, z + (z < 20 ? 0.4 : -0.4), root);
      const bulb = mesh(G.box(0.4, 0.12, 0.25), M(0xdddddd), x, 4.92, z + (z < 20 ? 0.8 : -0.8), root);
      bulb.userData.dynamic = true;
      lamps.push(bulb);
      physics.box(x - 0.12, 0, z - 0.12, x + 0.12, 5, z + 0.12, { portalable: false });
    }
  }
  // hills ring on the horizon
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const R = 470 + r() * 30;
    mesh(G.sphere(60 + r() * 50, 16, 10), M(0x6aa64a), Math.cos(a) * R, -20, Math.sin(a) * R, root, { sy: 0.45 });
  }
  root.userData.windowLit = windowLit;
  root.userData.lamps = lamps;
}

function tree(root, physics, x, z, r) {
  const trunkH = 2 + r() * 1.5;
  mesh(G.cyl(0.18, 0.26, trunkH, 8), toon(0x7a5232), x, trunkH / 2, z, root);
  const green = [0x4f9a3f, 0x5aa846, 0x468a38][(r() * 3) | 0];
  const s = 1.6 + r() * 1.2;
  mesh(G.sphere(s, 12, 9), toon(green), x, trunkH + s * 0.7, z, root);
  mesh(G.sphere(s * 0.75, 10, 8), toon(green), x + s * 0.6, trunkH + s * 0.4, z + 0.2, root);
  mesh(G.sphere(s * 0.7, 10, 8), toon(green), x - s * 0.55, trunkH + s * 0.5, z - 0.3, root);
  physics.box(x - 0.25, 0, z - 0.25, x + 0.25, trunkH + s * 1.4, z + 0.25, { surface: 'wood', portalable: true });
}

export { paintTexture };
