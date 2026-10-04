// The hidden village inside the bedroom's north wall. Real wall construction: drywall on both
// sides, 2x4 studs every 41 cm, a bottom plate on the floor and holes drilled through the
// studs for wires. The tiny people cut a little door through the baseboard (left of the
// nightstand) and built their homes on the bottom plate: kitchen matchboxes with playing-card
// roofs, bottle-cap tables, thread-spool stools, a craft-stick upper floor with a matchstick
// ladder, a stolen LED fairy-light string for light, and a stash of crumbs + a sugar cube.
import * as THREE from 'three';
import { Thing, panel } from './thing.js';
import { colorMat, defMat } from '../core/materials.js';
import { ROOM } from './bedroom.js';
import { Person } from './people.js';

export const WALL = { dw: 0.0127, cav: 0.089 };  // drywall thickness, cavity depth
export const STUDS = [-2.12, -1.56, -1.15, -0.74, -0.33, -0.05];
export const DOOR = { x0: -0.985, x1: -0.962, y0: 0.038, y1: 0.064 }; // the tiny door

export function buildWallShell(room) {
  const { x0, h } = ROOM, z0 = ROOM.z0, dw = WALL.dw, cav = WALL.cav;
  const zIn = z0 - dw / 2, zCav = z0 - dw - cav / 2, zOut = z0 - dw - cav - dw / 2;
  const xr = -0.05; // hollow part ends here (the rest of the wall, behind the bed, stays solid)
  panel(room, { axis: 'z', at: zIn, rect: [x0 - ROOM.wall, -0.2, xr, h + 0.2], thick: dw, m: 'wall', holes: [[DOOR.x0, DOOR.y0, DOOR.x1, DOOR.y1]] });
  room.box([xr - x0 + ROOM.wall, h + 0.4, dw], [(x0 - ROOM.wall + xr) / 2, h / 2, zOut], 'wall');
  // studs (with wire holes drilled through them) + bottom & top plates
  const wood = 'lightWood';
  for (const sx of STUDS) {
    if (sx < x0 - 0.1) continue;
    panel(room, { axis: 'x', at: sx, rect: [z0 - dw - cav, 0.038, z0 - dw, h - 0.038], thick: 0.038, m: wood, holes: [[zCav - 0.011, 0.25, zCav + 0.011, 0.272]] });
  }
  room.box([xr - x0 + 0.1, 0.038, cav], [(x0 + xr) / 2, 0.019, zCav], wood);
  room.box([xr - x0 + 0.1, 0.038, cav], [(x0 + xr) / 2, h - 0.019, zCav], wood);
  // the wall behind the bed (solid as before)
  panel(room, { axis: 'z', at: z0 - ROOM.wall / 2, rect: [xr, -0.2, ROOM.x1 + ROOM.wall, h + 0.2], thick: ROOM.wall, m: 'wall' });
}

export function buildVillage(game) {
  const z0 = ROOM.z0, dw = WALL.dw, cav = WALL.cav;
  const zC = z0 - dw - cav / 2, floorY = 0.038;
  const v = new Thing({ name: 'wall village', surface: 'wood', dirt: 0.5 });
  const card = defMat('playingCard', () => new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.6 }));
  const cardBack = defMat('cardBack', () => new THREE.MeshStandardMaterial({ color: 0xb3262c, roughness: 0.6 }));
  const matchbox = defMat('matchbox', () => new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.8 }));
  // a matchstick ramp from the carpet up to the tiny door
  for (let i = 0; i < 9; i++) v.box([0.022, 0.002, 0.004], [(DOOR.x0 + DOOR.x1) / 2, 0.003 + i * 0.0043, z0 + 0.012 - i * 0.0038], defMat('matchstick', () => new THREE.MeshStandardMaterial({ color: 0xe0c48a, roughness: 0.8 })), { rot: [0.85, 0, 0] });
  v.box([0.004, 0.004, 0.004], [(DOOR.x0 + DOOR.x1) / 2, 0.0, z0 + 0.03], colorMat(0xb5291f, 0.6), { collide: false }); // match head
  // matchbox houses (hollow, with a door) + playing-card roofs
  const house = (x, z, w, d, hgt) => {
    const t = 0.0012;
    v.box([w, t, d], [x, floorY + t / 2, z], matchbox);
    v.box([t, hgt, d], [x - w / 2 + t / 2, floorY + hgt / 2, z], matchbox); v.box([t, hgt, d], [x + w / 2 - t / 2, floorY + hgt / 2, z], matchbox);
    v.box([w, hgt, t], [x, floorY + hgt / 2, z - d / 2 + t / 2], matchbox);
    panel(v, { axis: 'z', at: z + d / 2 - t / 2, rect: [x - w / 2, floorY, x + w / 2, floorY + hgt], thick: t, m: matchbox, holes: [[x - 0.005, floorY, x + 0.005, floorY + 0.017], [x + w / 4 - 0.004, floorY + hgt * 0.55, x + w / 4 + 0.004, floorY + hgt * 0.75]] });
    v.box([w + 0.006, 0.0006, d * 0.62], [x, floorY + hgt + 0.007, z - d * 0.22], card, { rot: [0.5, 0, 0] });
    v.box([w + 0.006, 0.0006, d * 0.62], [x, floorY + hgt + 0.007, z + d * 0.22], cardBack, { rot: [-0.5, 0, 0] });
    v.box([w * 0.6, 0.004, d * 0.4], [x - w * 0.15, floorY + 0.003, z - d * 0.2], colorMat(0xe3d36a, 0.95)); // sponge bed
  };
  house(-1.09, zC, 0.06, 0.045, 0.05);
  house(-0.8, zC, 0.06, 0.045, 0.05);
  // the square: bottle-cap table, thread-spool stools, crumbs + a sugar cube, a water cap
  v.cyl(0.0145, 0.007, [-0.945, floorY + 0.0035, zC], colorMat(0xc0392b, 0.4, 0.4), { seg: 21 });
  v.cyl(0.004, 0.009, [-0.927, floorY + 0.0045, zC + 0.012], colorMat(0xd8c7a0, 0.7));
  v.cyl(0.004, 0.009, [-0.963, floorY + 0.0045, zC - 0.01], colorMat(0xd8c7a0, 0.7));
  v.box([0.012, 0.012, 0.012], [-1.035, floorY + 0.006, zC - 0.03], colorMat(0xf6f4ee, 0.9)); // sugar cube
  for (let i = 0; i < 6; i++) v.box([0.003, 0.002, 0.003], [-1.03 + (i % 3) * 0.005, floorY + 0.001, zC + 0.028 + Math.floor(i / 3) * 0.005], colorMat(0xd2a066, 0.95), { collide: false });
  v.cyl(0.0145, 0.006, [-0.88, floorY + 0.003, zC + 0.028], colorMat(0x2e7dd1, 0.4, 0.3), { seg: 21 });
  v.cyl(0.0125, 0.0002, [-0.88, floorY + 0.0055, zC + 0.028], defMat('capWater', () => new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.02, transmission: 0.9, thickness: 0.002, transparent: true, opacity: 0.6 })), { collide: false });
  // upper floor: craft sticks across the cavity + a matchstick ladder
  const up = 0.12;
  for (let i = 0; i < 9; i++) v.box([0.018, 0.002, cav - 0.002], [-1.12 + 0.012 + i * 0.019, up, zC], 'lightWood');
  for (let i = 0; i < 6; i++) v.box([0.012, 0.0015, 0.002], [-0.92, floorY + 0.012 + i * 0.014, zC + cav / 2 - 0.006], 'lightWood');
  v.box([0.0015, up - floorY + 0.01, 0.0015], [-0.927, (floorY + up) / 2, zC + cav / 2 - 0.006], 'lightWood');
  v.box([0.0015, up - floorY + 0.01, 0.0015], [-0.913, (floorY + up) / 2, zC + cav / 2 - 0.006], 'lightWood');
  // LED fairy lights strung along the bay
  const ledMat = defMat('fairy', () => new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc96a, emissiveIntensity: 2.5 }));
  for (let i = 0; i < 10; i++) v.ball(0.0018, [-1.12 + i * 0.038, 0.095 + Math.sin(i * 0.9) * 0.004, zC - cav / 2 + 0.006], ledMat, { collide: false });
  v.box([0.37, 0.0004, 0.0004], [-0.945, 0.096, zC - cav / 2 + 0.006], colorMat(0x1d6b2e, 0.6), { collide: false });
  v.box([0.0105, 0.0145, 0.0145], [-1.12, floorY + 0.007, zC - 0.02], colorMat(0x222222, 0.5)); // coin battery pack
  v.build(game.engine.scene);
  // the wall cavity counts as "inside" (dark, muffled, echoey)
  const cavBox = new THREE.Box3(new THREE.Vector3(ROOM.x0 - 0.12, 0, z0 - dw - cav), new THREE.Vector3(-0.05, ROOM.h, z0 - dw));
  v.behaviors.push({ update(t, dt, gm) { if (!gm.micro && cavBox.containsPoint(gm.player.center(new THREE.Vector3()))) { gm.inside = v; gm.insideEcho = 0.5; } } });
  for (const x of [-1.04, -0.85]) {
    game.lightPool.add({ kind: 'point', color: 0xffc98a, intensity: 0.05, distance: 0.35, decay: 2, pos: new THREE.Vector3(x, 0.09, zC - 0.02) });
  }
  // the villagers
  game.people = game.people || [];
  const spots = [[-1.06, zC + 0.03], [-0.98, zC - 0.025], [-0.945, zC + 0.03], [-0.9, zC - 0.03], [-0.84, zC + 0.035], [-1.11, zC + 0.035], [-0.96, zC], [-1.0, zC + 0.03]];
  const names = ['Pip', 'Wren', 'Milo', 'Tansy', 'Bram', 'Juniper', 'Odo', 'Fern'];
  spots.forEach(([x, z], i) => {
    const p = new Person(game, { pos: [x, i === 7 ? up + 0.002 : floorY + 0.001, z], seed: 1000 + i * 77, name: names[i], height: 0.0125 + (i % 3) * 0.0015 });
    if (i === 7) p.home.y = up + 0.002;
    game.people.push(p);
  });
  return v;
}
