// YOUR MANSION on the California coast (master list section 13), plus the yard, pool, gate and
// street. Modern style: white stucco, big black-framed windows, oak floors, a flat roof.
//
// Layout (meters, ground floor top at y = 0, front of the house faces +Z toward the street):
//   Ground floor  x -12..12, z -8..8
//     office (NW front)   x -12..-3, z 2.4..8   - the bookshelf that opens to the lab stairs
//     game room (NW back) x -12..-3, z -8..0.8  - door to the garage
//     entry + hall        x -3..3              - main stairs up, guest bathroom at the back
//     living room (E)     x 3..12, z 0..8
//     kitchen + dining    x 3..12, z -8..0     - sliding glass door to the pool
//   Upstairs (y = 3.3)    master bedroom (E front), master bath (E back), landing, guest room (W)
//   Basement (y = -3.6)   RIFT LAB under the office/game room, x -12..-3, z -8..2.4
//   Garage                x -21..-12, z -4..8 (3 cars)
import * as THREE from 'three';
import { Kit } from './kit.js';
import { std, phys } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { Prop } from '../props/prop.js';
import { CATALOG } from '../props/catalog.js';
import '../props/furniture.js';
import { Door } from './doors.js';
import { FM } from '../props/furniture.js';
import { mergeByMaterial } from '../render/merge.js';
import { bus } from '../core/events.js';

const GF = 0; // ground floor top
const UF = 3.3; // upper floor top
const BF = -3.6; // basement floor top
const CH = 3.0; // ceiling height
const EXT = 0.3; // exterior wall thickness
const INT = 0.15; // interior wall thickness

function mats() {
  const rep = (set, r) => TX.withRepeat(set, r, r);
  const M = {};
  // Interior paint and plaster.
  const plaster = TX.plaster(0xf0ece4);
  M.paint = std({ ...plaster, color: 0xffffff, roughness: 0.92 }, { indoor: true, detail: 'plaster' });
  M.paintOffice = std({ ...TX.plaster(0x34443c), roughness: 0.9 }, { indoor: true, detail: 'plaster' });
  M.paintGame = std({ ...TX.plaster(0x2b2d33), roughness: 0.9 }, { indoor: true, detail: 'plaster' });
  M.ceiling = std({ ...TX.plaster(0xf6f4ef), roughness: 0.95 }, { indoor: true, detail: 'plaster' });
  // Exterior.
  M.stucco = std({ ...TX.plaster(0xf2efe8), roughness: 0.95, normalScale: new THREE.Vector2(2, 2) }, { detail: 'plaster' });
  M.stone = std({ ...rep(TX.concrete(0x9a948a), 0.5), roughness: 0.9 }, { detail: 'stone' });
  M.trimDark = std({ color: 0x17181b, roughness: 0.45, metalness: 0.4 }, { detail: 'metal' });
  M.wood = std({ ...rep(TX.woodFloor(0x8a6440), 0.35) }, { detail: 'wood' });
  // Floors.
  M.oak = std({ ...TX.withRepeat(TX.woodFloor(0x9a7048), 0.9, 0.9), roughness: 1 }, { indoor: true, detail: 'wood' });
  M.walnut = std({ ...TX.withRepeat(TX.woodFloor(0x5e3d26), 0.9, 0.9), roughness: 1 }, { indoor: true, detail: 'wood' });
  M.tile = std({ ...TX.withRepeat(TX.tile(0xe4e0d8, 0x9c968c, 2), 0.5, 0.5), roughness: 1 }, { indoor: true, detail: 'glass' });
  M.carpet = std({ ...rep(TX.carpet(0x9a8f80), 1.5), roughness: 1 }, { indoor: true, detail: 'carpet' });
  M.concrete = std({ ...rep(TX.concrete(0x8d8a84), 0.3), roughness: 0.95 }, { indoor: true, detail: 'stone' });
  M.concreteOut = std({ ...rep(TX.concrete(0xbcb7ad), 0.25), roughness: 0.92 }, { detail: 'stone' });
  M.asphalt = std({ ...rep(TX.concrete(0x3a3b3d), 0.2), roughness: 0.9 }, { detail: 'stone' });
  M.lawn = std({ ...rep(TX.grass(), 0.25), roughness: 1 }, { detail: 'soil' });
  M.patio = std({ ...TX.withRepeat(TX.tile(0xc9c2b4, 0xa49d8f, 1), 0.5, 0.5), roughness: 0.9 }, { detail: 'stone' });
  M.counter = phys({ color: 0xeceae6, roughness: 0.18, clearcoat: 0.4 }, { indoor: true, detail: 'stone' });
  M.cabinet = std({ color: 0x2a2d31, roughness: 0.55 }, { indoor: true, detail: 'paint' });
  M.steel = std({ color: 0xbfc3c8, metalness: 1, roughness: 0.25 }, { indoor: true, detail: 'metal' });
  M.porcelain = phys({ color: 0xf7f7f5, roughness: 0.12, clearcoat: 0.8 }, { indoor: true, detail: 'glass' });
  // Window glass: clear with sky reflections (no refraction pass: real panes barely bend light).
  M.glass = phys({ color: 0xdfe8ec, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }, { detail: 'glass' });
  M.water = phys({ color: 0x2a9fc2, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.62, envMapIntensity: 1.2, depthWrite: false }, { detail: 'glass' });
  M.poolTile = std({ ...TX.withRepeat(TX.tile(0x6fb6cf, 0x4d8da3, 4), 0.5, 0.5), roughness: 0.4 }, { detail: 'glass' });
  M.labPanel = std({ color: 0x2c313a, roughness: 0.45, metalness: 0.45 }, { indoor: true, detail: 'metal' });
  M.lightPanel = new THREE.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false });
  M.labGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2ef2ff).multiplyScalar(2), toneMapped: false });
  return M;
}

export async function buildMansion(game) {
  const { scene, physics } = game;
  const M = mats();
  const kit = new Kit(game);
  const lamps = [];

  // ---------------------------------------------------------------- ground / site
  // Terrain: the ground around the house sits 2 cm below the floor.
  const groundY = -0.02;
  // Solid ground (4 m deep) everywhere except where something is dug into it: the basement lab,
  // the pool and the street (the road sits a few cm lower than the lawn).
  groundWithHoles(physics, groundY, [
    [-12, -8, -3, 2.4], // basement (RIFT LAB)
    [0, -22, 12, -12], // pool
    [-200, 32.5, 200, 42], // road
  ]);
  const lawnRects = [
    [-11.9, 8.3, -1.1, 29.7], [1.1, 8.3, 11.9, 29.7], [12.3, -30, 40, 29.7], [-40, -30, -21.2, 29.7],
    [-21.2, -30, -2.2, -8.3], [-2.2, -30, 14.2, -24.2], [-2.2, -9.8, 12.3, -8.3], [14.2, -24.2, 12.3, -9.8],
    [-21.2, -8.3, -12.3, -4.2],
  ];
  for (const [x0, z0, x1, z1] of lawnRects) {
    kit.box((x0 + x1) / 2, groundY - 0.05, (z0 + z1) / 2, Math.abs(x1 - x0), 0.1, Math.abs(z1 - z0), M.lawn, { tile: 1, noCollide: true });
    game.scatter.addSurface({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), y: groundY, kind: 'lawn' });
  }
  // Far ground out to the horizon (simple, the town replaces it in Wave 2).
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std({ ...TX.withRepeat(TX.grass(), 200, 200), roughness: 1 }, { detail: 'soil' }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = groundY - 0.11;
  far.receiveShadow = true;
  scene.add(far);
  // Driveway (garage to the street) and the front walk.
  kit.box(-16.5, -0.05, 19.1, 9.0, 0.1, 21.8, M.concreteOut, { tile: 1 });
  game.scatter.addSurface({ minX: -21, maxX: -12, minZ: 8.2, maxZ: 30, y: 0, kind: 'dirt' });
  kit.box(0, -0.04, 19.1, 2.0, 0.08, 21.8, M.patio, { tile: 1 });
  // Pool patio around the pool (x 0..12, z -22..-12).
  kit.box(6, -0.04, -11, 16.4, 0.08, 2.0, M.patio);
  kit.box(6, -0.04, -23, 16.4, 0.08, 2.0, M.patio);
  kit.box(-1, -0.04, -17, 2.0, 0.08, 10, M.patio);
  kit.box(13, -0.04, -17, 2.0, 0.08, 10, M.patio);
  // Pool: 12 x 10 m, 1.6 m deep, water 15 cm below the deck.
  kit.box(6, -1.65, -17, 12, 0.1, 10, M.poolTile);
  kit.box(6, -0.85, -12.05, 12, 1.7, 0.1, M.poolTile);
  kit.box(6, -0.85, -21.95, 12, 1.7, 0.1, M.poolTile);
  kit.box(0.05, -0.85, -17, 0.1, 1.7, 10, M.poolTile);
  kit.box(11.95, -0.85, -17, 0.1, 1.7, 10, M.poolTile);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(11.8, 9.8), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(6, -0.15, -17);
  water.receiveShadow = true;
  scene.add(water);
  game.water = [{ minX: 0.1, maxX: 11.9, minZ: -21.9, maxZ: -12.1, y: -0.15, bottom: -1.6 }];

  // Street: sidewalk, curb, road, far sidewalk.
  kit.box(0, -0.04, 31.25, 200, 0.12, 2.5, M.concreteOut);
  kit.box(0, -0.12, 37.25, 200, 0.1, 9.5, M.asphalt);
  kit.box(0, -0.04, 43.25, 200, 0.12, 2.5, M.concreteOut);
  // Lane lines.
  const lineMat = std({ color: 0xe8d36a, roughness: 0.6 }, { detail: 'paint' });
  for (let x = -96; x < 100; x += 6) kit.box(x, -0.065, 37.25, 3, 0.005, 0.12, lineMat, { noCollide: true });
  // Front wall with the gate opening (driveway) and the walk gate.
  const wallH = 1.6;
  for (const [x0, x1] of [[-30, -21.2], [-11.8, -1.2], [1.2, 30]]) kit.box((x0 + x1) / 2, wallH / 2 - 0.02, 30, x1 - x0, wallH, 0.3, M.stucco);
  for (const x of [-21.2, -11.8, -1.2, 1.2]) kit.box(x, 0.9, 30, 0.45, 1.8, 0.45, M.stone);
  // Driveway gate: a dark steel sliding gate, open (pushed to the side).
  kit.box(-27, 0.8, 29.7, 9.2, 1.4, 0.08, M.trimDark);

  // ---------------------------------------------------------------- floors and ceilings
  // Ground floor rooms (top at 0, 30 cm slab). The bottom face over the lab is the lab ceiling.
  const room = (x0, z0, x1, z1, top, mat, bottom = M.ceiling, scatter = null, scatterColor) => {
    kit.box((x0 + x1) / 2, top - 0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, [mat, mat, mat, bottom, mat, mat], { tile: 1 });
    if (scatter) game.scatter.addSurface({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: top, kind: scatter, color: scatterColor });
  };
  room(-12, 2.4, -3, 8, GF, M.walnut, M.concrete, 'woodfloor'); // office
  room(-5.2, 0.8, -3, 2.4, GF, M.concrete, M.concrete); // lab landing (behind the bookshelf)
  room(-12, -8, -3, 0.8, GF, M.oak, M.concrete, 'woodfloor'); // game room
  room(-3, -5.2, 3, 8, GF, M.oak, M.ceiling, 'woodfloor'); // entry + hall
  room(-3, -8, 0, -5.2, GF, M.tile, M.ceiling, 'tile'); // guest bath
  room(0, -8, 3, -5.2, GF, M.oak, M.ceiling, 'woodfloor'); // back hall
  room(3, 0, 12, 8, GF, M.oak, M.ceiling, 'woodfloor'); // living
  room(3, -8, 12, 0, GF, M.tile, M.ceiling, 'tile'); // kitchen
  // Upper floor (top at 3.3): ceiling of the ground floor underneath. Hole over the main stairs.
  room(3, 0, 12, 8, UF, M.carpet, M.ceiling, 'carpet', 0x9a8f80); // master bedroom
  room(3, -8, 12, 0, UF, M.tile, M.ceiling, 'tile'); // master bath
  room(-3, 0.65, 1.55, 8, UF, M.oak, M.ceiling, 'woodfloor'); // landing (left of the stair hole)
  room(1.55, 0.65, 3, 8, UF, M.oak, M.ceiling, 'woodfloor');
  room(-3, -8, 3, -4.55, UF, M.oak, M.ceiling, 'woodfloor');
  room(-3, -4.55, 1.55, 0.65, UF, M.oak, M.ceiling, 'woodfloor');
  room(-12, -8, -3, 8, UF, M.oak, M.ceiling, 'woodfloor'); // guest room
  // Roof slab (ceiling of the upstairs).
  room(-12, -8, 12, 8, 6.6, M.concreteOut, M.ceiling);
  // Basement floor.
  room(-12, -8, -3, 2.4, BF, M.concrete, M.concrete, 'tile');
  // Garage slab (10 cm lower, concrete) and roof.
  room(-21, -4, -12, 8, -0.1, M.concrete, M.concrete, 'tile');
  room(-21, -4, -12, 8, 3.4, M.concreteOut, M.ceiling);

  // ---------------------------------------------------------------- exterior walls
  const extMats = (inside) => ({ a: M.stucco, b: inside, edge: M.stucco });
  // Openings are measured from the wall base (y = -0.6): ground-floor heights + 0.6, upper + 3.9.
  const g = (o) => ({ ...o, bottom: o.bottom + 0.6, top: o.top + 0.6 });
  const u = (o) => ({ ...o, bottom: o.bottom + 3.9, top: o.top + 3.9 });
  const H = 7.7; // -0.6 .. 7.1 (with parapet)
  // Front (z = +8), walls run so the stucco faces outside.
  kit.wall(12, 8, -12, 8, -0.6, H, EXT, extMats(M.paint), [
    g({ at: 4.5, w: 4.2, bottom: 0.15, top: 2.7 }), // living window (x 7.5)
    g({ at: 12, w: 2.0, bottom: 0, top: 2.6 }), // front door (x 0)
    g({ at: 19.5, w: 3.0, bottom: 0.5, top: 2.6 }), // office window (x -7.5)
    u({ at: 4.5, w: 4.2, bottom: 0.05, top: 2.7 }), // bedroom window wall
    u({ at: 12, w: 2.0, bottom: 0.9, top: 2.5 }),
    u({ at: 19.5, w: 2.6, bottom: 0.9, top: 2.5 }),
  ]);
  // Back (z = -8).
  kit.wall(-12, -8, 12, -8, -0.6, H, EXT, extMats(M.paint), [
    g({ at: 4.5, w: 3.0, bottom: 0.9, top: 2.4 }), // game room (x -7.5)
    g({ at: 10.5, w: 0.8, bottom: 1.5, top: 2.2 }), // guest bath (x -1.5)
    g({ at: 19.5, w: 3.6, bottom: 0, top: 2.6 }), // kitchen sliding door (x 7.5)
    u({ at: 4.5, w: 2.6, bottom: 0.9, top: 2.5 }),
    u({ at: 19.5, w: 3.0, bottom: 1.2, top: 2.4 }),
  ]);
  // West (x = -12), with the door to the garage (z -2).
  kit.wall(-12, 8, -12, -8, -0.6, H, EXT, extMats(M.paint), [
    g({ at: 3, w: 2.0, bottom: 0.9, top: 2.4 }), // office side window (z 5)
    g({ at: 10, w: 0.95, bottom: 0, top: 2.1 }), // to garage (z -2)
    u({ at: 3, w: 2.0, bottom: 0.9, top: 2.5 }),
    u({ at: 12, w: 2.0, bottom: 0.9, top: 2.5 }),
  ]);
  // East (x = +12).
  kit.wall(12, -8, 12, 8, -0.6, H, EXT, extMats(M.paint), [
    g({ at: 4, w: 2.4, bottom: 1.05, top: 2.3 }), // kitchen window over the sink (z -4)
    g({ at: 12, w: 3.0, bottom: 0.3, top: 2.6 }), // living side window (z 4)
    u({ at: 4, w: 2.0, bottom: 1.2, top: 2.4 }),
    u({ at: 12, w: 3.0, bottom: 0.3, top: 2.6 }),
  ]);
  // Stone base band and dark roof trim (the look of a modern coastal house).
  kit.box(0, -0.35, 8.17, 24.6, 0.5, 0.06, M.stone, { noCollide: true });
  kit.box(0, 7.13, 8.17, 24.6, 0.08, 0.08, M.trimDark, { noCollide: true });
  kit.box(0, 7.13, -8.17, 24.6, 0.08, 0.08, M.trimDark, { noCollide: true });

  // Garage walls (x -21..-12, z -4..8), two open garage doors on the front.
  kit.wall(-12, 8, -21, 8, -0.6, 4.0, EXT, extMats(M.paint), [
    { at: 2.25, w: 2.8, bottom: 0.5, top: 3.0 },
    { at: 6.75, w: 2.8, bottom: 0.5, top: 3.0 },
  ]);
  kit.wall(-21, 8, -21, -4, -0.6, 4.0, EXT, extMats(M.paint), []);
  kit.wall(-21, -4, -12, -4, -0.6, 4.0, EXT, extMats(M.paint), []);

  // ---------------------------------------------------------------- interior walls (ground floor)
  const iw = (ax, az, bx, bz, ops = [], a = M.paint, b = M.paint, y0 = -0.3, h = CH + 0.3) => kit.wall(ax, az, bx, bz, y0, h, INT, { a, b, edge: M.paint }, ops.map((o) => ({ ...o, bottom: o.bottom + 0.3, top: o.top + 0.3 })));
  // x = -3 (west rooms | hall): office door z 5, game room door z -3.
  iw(-3, 8, -3, -8, [{ at: 3, w: 0.95, bottom: 0, top: 2.1 }, { at: 11, w: 0.95, bottom: 0, top: 2.1 }], M.paint, M.paint);
  // Office south wall z = 2.4 with the bookshelf opening at x -4.5.
  iw(-12, 2.4, -3, 2.4, [{ at: 7.5, w: 1.25, bottom: 0, top: 2.2 }], M.paint, M.paintOffice);
  // Game room north wall z = 0.8.
  iw(-3, 0.8, -12, 0.8, [], M.paint, M.paintGame);
  // Lab stairwell end (x -5.2 .. -3 landing is open to the stairs).
  // x = 3 (hall | living + kitchen): wide archways.
  iw(3, -8, 3, 8, [{ at: 5.5, w: 2.4, bottom: 0, top: 2.6 }, { at: 13, w: 2.6, bottom: 0, top: 2.6 }]);
  // z = 0 (living | kitchen): open plan with a 5 m opening.
  iw(3, 0, 12, 0, [{ at: 4.5, w: 5.0, bottom: 0, top: 2.6 }]);
  // Guest bath walls.
  iw(-3, -5.2, 0, -5.2, [{ at: 1.5, w: 0.8, bottom: 0, top: 2.05 }]);
  iw(0, -5.2, 0, -8, []);
  // ---------------------------------------------------------------- interior walls (upstairs)
  const uw = (ax, az, bx, bz, ops = []) => kit.wall(ax, az, bx, bz, UF - 0.3, CH + 0.3, INT, { a: M.paint, b: M.paint, edge: M.paint }, ops.map((o) => ({ ...o, bottom: o.bottom + 0.3, top: o.top + 0.3 })));
  uw(3, -8, 3, 8, [{ at: 10, w: 0.95, bottom: 0, top: 2.1 }]); // bedroom door z 2
  uw(3, 0, 12, 0, [{ at: 2.0, w: 0.9, bottom: 0, top: 2.1 }]); // bath door x 5
  uw(-3, 8, -3, -8, [{ at: 8, w: 0.95, bottom: 0, top: 2.1 }]); // guest room door z 0
  // Railing around the stair hole upstairs.
  kit.box(1.5, UF + 0.5, -2, 0.05, 1.0, 5.1, M.trimDark);
  kit.box(2.25, UF + 0.5, 0.67, 1.45, 1.0, 0.05, M.trimDark);

  // ---------------------------------------------------------------- basement (RIFT LAB) walls
  // Lab walls stop at the underside of the ground floor slab (-0.3), so they don't fight it for pixels.
  const lw = (ax, az, bx, bz) => kit.wall(ax, az, bx, bz, BF - 0.3, 3.6, INT * 2, { a: M.labPanel, b: M.labPanel, edge: M.labPanel }, []);
  lw(-12, -8, -3, -8);
  lw(-3, -8, -3, 2.4);
  lw(-3, 2.4, -12, 2.4);
  lw(-12, 2.4, -12, -8);
  // Lab stairs: 20 steps of 18 cm, from the lab floor (x -10.6) up to the landing (x -5.2).
  kit.stairs(-10.6, 1.6, BF, 1.3, 0.27, 0.18, 20, -Math.PI / 2, M.concrete);
  // Main stairs: 18 steps of 18.3 cm from the entry (z 0.6) up to the landing (z -4.44).
  kit.stairs(2.225, 0.6, GF, 1.25, 0.28, UF / 18, 18, 0, M.oak, { sideMat: M.paint });

  // ---------------------------------------------------------------- kitchen built-ins
  // East counter run (x 11.25, z -7.85..-1.5), island, sink, fridge.
  kit.box(11.5, 0.45, -4.7, 0.65, 0.9, 6.3, M.cabinet);
  kit.box(11.45, 0.92, -4.7, 0.75, 0.04, 6.3, M.counter);
  kit.box(7.5, 0.45, -4.2, 2.4, 0.9, 1.1, M.cabinet);
  kit.box(7.5, 0.92, -4.2, 2.6, 0.04, 1.2, M.counter);
  kit.box(11.45, 0.9, -4.0, 0.5, 0.04, 0.7, M.steel, { noCollide: true }); // sink basin rim
  kit.box(11.1, 1.0, -0.95, 0.8, 2.0, 0.8, M.steel); // fridge (static for now; appliances come in Wave 2)
  // ---------------------------------------------------------------- bathrooms
  kit.box(-2.6, 0.2, -7.55, 0.38, 0.4, 0.5, M.porcelain); // toilet base
  kit.box(-2.6, 0.55, -7.75, 0.4, 0.4, 0.18, M.porcelain); // tank
  kit.box(-0.6, 0.42, -7.6, 0.8, 0.84, 0.45, M.cabinet); // vanity
  kit.box(-0.6, 0.86, -7.6, 0.85, 0.04, 0.5, M.counter);
  kit.box(10.8, UF + 0.3, -6.8, 1.7, 0.6, 0.8, M.porcelain); // tub
  kit.box(5.0, UF + 0.42, -7.6, 1.6, 0.84, 0.5, M.cabinet); // double vanity
  kit.box(5.0, UF + 0.86, -7.6, 1.65, 0.04, 0.55, M.counter);

  // ---------------------------------------------------------------- windows (black frames + glass)
  const windowPane = (x, y, z, w, h, rotY) => {
    kit.box(x, y, z, w, h, 0.02, M.glass, { rotY, noCollide: false });
    const t = 0.05;
    const dx = Math.cos(rotY), dz = -Math.sin(rotY);
    kit.box(x, y + h / 2 - t / 2, z, w, t, 0.08, M.trimDark, { rotY, noCollide: true });
    kit.box(x, y - h / 2 + t / 2, z, w, t, 0.08, M.trimDark, { rotY, noCollide: true });
    for (const s of [-1, 1]) kit.box(x + dx * s * (w / 2 - t / 2), y, z + dz * s * (w / 2 - t / 2), t, h, 0.08, M.trimDark, { rotY, noCollide: true });
    if (w > 2.2) kit.box(x, y, z, t, h, 0.08, M.trimDark, { rotY, noCollide: true }); // mullion
  };
  windowPane(7.5, 1.425, 8, 4.2, 2.55, 0);
  windowPane(-7.5, 1.55, 8, 3.0, 2.1, 0);
  windowPane(7.5, UF + 1.375, 8, 4.2, 2.65, 0);
  windowPane(0, UF + 1.7, 8, 2.0, 1.6, 0);
  windowPane(-7.5, UF + 1.7, 8, 2.6, 1.6, 0);
  windowPane(-7.5, 1.65, -8, 3.0, 1.5, 0);
  windowPane(-1.5, 1.85, -8, 0.8, 0.7, 0);
  windowPane(-7.5, UF + 1.7, -8, 2.6, 1.6, 0);
  windowPane(7.5, UF + 1.8, -8, 3.0, 1.2, 0);
  windowPane(-12, 1.65, 5, 2.0, 1.5, Math.PI / 2);
  windowPane(-12, UF + 1.7, 5, 2.0, 1.6, Math.PI / 2);
  windowPane(-12, UF + 1.7, -4, 2.0, 1.6, Math.PI / 2);
  windowPane(12, 1.675, -4, 2.4, 1.25, Math.PI / 2);
  windowPane(12, 1.45, 4, 3.0, 2.3, Math.PI / 2);
  windowPane(12, UF + 1.8, -4, 2.0, 1.2, Math.PI / 2);
  windowPane(12, UF + 1.45, 4, 3.0, 2.3, Math.PI / 2);
  // Kitchen sliding door glass (two panels, one slid open).
  windowPane(6.6, 1.3, -8.03, 1.8, 2.6, 0);

  kit.build();

  // ---------------------------------------------------------------- doors
  const doors = [];
  const D = (o) => doors.push(new Door(game, o));
  // Each door swings INTO its room (front doors swing into the house).
  D({ name: 'Front door', hinge: [-1, 0, 8.0], width: 1.0, height: 2.6, yaw: 0, openAngle: 1.6, gap: 0.01 });
  D({ name: 'Front door', hinge: [1, 0, 8.0], width: 1.0, height: 2.6, yaw: Math.PI, openAngle: -1.6, gap: 0.01 });
  D({ name: 'Office door', hinge: [-3, 0, 5.475], width: 0.95, yaw: Math.PI / 2, openAngle: 1.6 });
  D({ name: 'Game room door', hinge: [-3, 0, -2.525], width: 0.95, yaw: Math.PI / 2, openAngle: 1.6 });
  D({ name: 'Bathroom door', hinge: [-1.9, 0, -5.2], width: 0.8, yaw: 0, openAngle: 1.6 });
  D({ name: 'Garage door', hinge: [-12, 0, -1.525], width: 0.95, yaw: Math.PI / 2, openAngle: 1.6 });
  D({ name: 'Bedroom door', hinge: [3, UF, 2.475], width: 0.95, yaw: Math.PI / 2, openAngle: -1.6 });
  D({ name: 'Bathroom door', hinge: [4.55, UF, 0], width: 0.9, yaw: 0, openAngle: 1.6 });
  D({ name: 'Guest room door', hinge: [-3, UF, 0.475], width: 0.95, yaw: Math.PI / 2, openAngle: 1.6 });
  // The secret bookshelf: pull the red book to swing it open onto the lab stairs.
  const shelf = new THREE.Group();
  const shelfInner = mergeByMaterial(bookshelfModel(1.25, 2.2, 0.32, true));
  shelfInner.position.z = -0.16; // centered on the hinge line, inside the wall opening
  shelf.add(shelfInner);
  const secret = new Door(game, {
    name: 'Bookshelf', hinge: [-5.125, 0, 2.4], width: 1.25, height: 2.2, thick: 0.32, yaw: 0, openAngle: -1.45, gap: 0.005, model: shelf,
    prompt: (d) => (d.open ? 'Push the bookshelf closed' : 'Pull the red book'),
  });
  secret.canUse = (p) => p.height > 0.5;
  doors.push(secret);
  game.doors = doors;

  // ---------------------------------------------------------------- furniture (all real props)
  const P = (id, x, y, z, ry = 0) => new Prop(game, CATALOG[id], { position: [x, y, z], rotationY: ry });
  // Living room: sofa facing the TV on the east wall.
  P('sofa', 7.0, 0, 4.2, Math.PI / 2);
  P('armchair', 8.6, 0, 6.6, Math.PI * 0.85);
  P('coffee_table', 8.7, 0, 4.2, Math.PI / 2);
  P('tv_stand', 11.5, 0, 4.2, -Math.PI / 2);
  P('tv65', 11.5, 0.5, 4.2, -Math.PI / 2);
  P('floor_lamp', 6.9, 0, 6.0);
  P('plant', 11.2, 0, 7.3);
  P('soda_can', 8.5, 0.43, 4.0);
  P('book', 8.9, 0.43, 4.4, 0.4);
  // Rug under the living area (static, flat) + carpet fibers when tiny.
  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.012, 2.4), std({ ...TX.withRepeat(TX.carpet(0x6d5d4e), 5, 4), roughness: 1 }, { indoor: true, detail: 'carpet' }));
  rug.position.set(8.4, 0.006, 4.2);
  rug.receiveShadow = true;
  scene.add(rug);
  physics.staticBox(8.4, 0.006, 4.2, 1.6, 0.006, 1.2);
  game.scatter.addSurface({ minX: 6.8, maxX: 10.0, minZ: 3.0, maxZ: 5.4, y: 0.012, kind: 'carpet', color: 0x6d5d4e });
  // Kitchen: dining table with chairs, things on the island.
  P('table', 5.4, 0, -2.2, Math.PI / 2);
  for (const [dx, dz, r] of [[-0.62, -0.5, Math.PI / 2], [-0.62, 0.5, Math.PI / 2], [0.62, -0.5, -Math.PI / 2], [0.62, 0.5, -Math.PI / 2]]) P('dining_chair', 5.4 + dx, 0, -2.2 + dz, r);
  P('mug', 7.2, 0.941, -4.1, 0.6);
  P('soda_can', 7.8, 0.941, -4.3);
  P('cookie', 7.5, 0.941, -3.9);
  for (const [x, z] of [[7.52, -3.83], [7.55, -3.86], [7.47, -3.95], [7.6, -3.8]]) P('crumb', x, 0.941, z);
  // Office: desk with the PC setup facing the window.
  P('desk', -7.5, 0, 6.6, Math.PI);
  P('office_chair', -7.5, 0, 5.8, Math.PI);
  P('monitor', -7.5, 0.75, 6.75, Math.PI);
  P('keyboard', -7.5, 0.75, 6.35, Math.PI);
  P('mouse_pc', -7.1, 0.75, 6.35, Math.PI);
  P('pc_tower', -6.6, 0, 6.7, Math.PI);
  P('plant', -11.3, 0, 7.3);
  // Static bookshelves along the office wall (around the secret one).
  const shelves = new THREE.Group();
  for (const x of [-6.6, -8.2, -9.8, -11.05]) {
    const bs = bookshelfModel(1.5, 2.3, 0.32, false);
    bs.position.set(x - 0.75, 0, 2.4 + 0.17);
    shelves.add(bs);
    physics.staticBox(x, 1.15, 2.4 + 0.17 + 0.16, 0.75, 1.15, 0.16);
  }
  scene.add(shelves);
  mergeByMaterial(shelves);
  // Game room: sofa + TV.
  P('sofa', -7.5, 0, -3.5, 0);
  P('tv_stand', -7.5, 0, -7.55, 0);
  P('tv65', -7.5, 0.5, -7.55, 0);
  P('ball', -5, 0, -1);
  // Bedroom upstairs.
  P('bed_king', 10.4, UF, 4.2, -Math.PI / 2);
  P('nightstand', 11.6, UF, 1.9, -Math.PI / 2);
  P('nightstand', 11.6, UF, 6.5, -Math.PI / 2);
  P('floor_lamp', 11.5, UF, 7.4);
  P('plant', 3.6, UF, 7.4);
  // Garage: boxes until the cars arrive (the 3 cars are built in the vehicles pass).
  P('box', -20.2, -0.1, -3.2, 0.2);
  P('box', -20.2, 0.2, -3.2, 0.25);

  // ---------------------------------------------------------------- RIFT LAB
  buildLab(game, M, kit);

  // ---------------------------------------------------------------- lights (ceiling + lamps)
  const ceilingLight = (x, y, z, intensity = 9, range = 9, color = 0xfff0dd) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 20), M.lightPanel);
    disc.position.set(x, y - 0.006, z);
    scene.add(disc);
    lamps.push(game.lighting.addLamp({ position: new THREE.Vector3(x, y - 0.02, z), color, intensity: intensity * 1.6, range, cone: 1.05 }));
  };
  for (const [x, z] of [[7.5, 2], [7.5, 6], [5, 4], [10, 4]]) ceilingLight(x, CH, z); // living
  for (const [x, z] of [[7.5, -2], [7.5, -5.5], [10.5, -4]]) ceilingLight(x, CH, z); // kitchen
  for (const [x, z] of [[-7.5, 5], [-5, 4]]) ceilingLight(x, CH, z, 7); // office
  for (const [x, z] of [[-7.5, -3.5], [-5, -6]]) ceilingLight(x, CH, z, 6, 8, 0xd8e4ff); // game room
  for (const [x, z] of [[0, 5], [0, 1], [0, -3]]) ceilingLight(x, CH, z); // entry + hall
  ceilingLight(-1.5, CH, -6.6, 6, 5); // guest bath
  for (const [x, z] of [[7.5, 4], [5, 2]]) ceilingLight(x, UF + CH, z, 8); // bedroom
  ceilingLight(7.5, UF + CH, -4, 7); // master bath
  for (const [x, z] of [[0, 4], [0, -2]]) ceilingLight(x, UF + CH, z, 6); // landing
  ceilingLight(-7.5, UF + CH, 0, 7); // guest room
  for (const [x, z] of [[-16.5, 2], [-16.5, -1.5]]) ceilingLight(x, 3.4 - 0.3, z, 7, 9, 0xe8f0ff); // garage
  ceilingLight(-4.1, CH, 1.6, 4, 5); // lab landing
  game.mansion = { doors, lamps };

  return {
    spawn: { position: [6.6, 0.02, 2.5], yaw: -1.85, pitch: -0.14 },
  };
}

// A bookshelf full of books. `secret` adds the red book you pull.
function bookshelfModel(w, h, d, secret) {
  const g = new THREE.Group();
  const wood = FM.wood(0x3a2a1d);
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // Frame (origin at the left edge for the hinge; the shelf extends along +X).
  add(new THREE.BoxGeometry(0.03, h, d), wood, 0.015, h / 2, d / 2);
  add(new THREE.BoxGeometry(0.03, h, d), wood, w - 0.015, h / 2, d / 2);
  add(new THREE.BoxGeometry(w, 0.03, d), wood, w / 2, h - 0.015, d / 2);
  add(new THREE.BoxGeometry(w, 0.02, d), wood, w / 2, 0.01, d / 2);
  add(new THREE.BoxGeometry(w, h, 0.015), wood, w / 2, h / 2, 0.0075);
  const shelves = 6;
  const colors = [0x6b2a2a, 0x23395b, 0x2f4a33, 0x8a6a3a, 0x3a3a3a, 0x5a3a5a, 0xb59a6a, 0x1f2a3a, 0x7a4a2a];
  const bookMats = colors.map((c) => std({ color: c, roughness: 0.8 }, { indoor: true, detail: 'fabric' }));
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < shelves; i++) {
    const y = 0.02 + (i * (h - 0.05)) / shelves;
    if (i > 0) add(new THREE.BoxGeometry(w - 0.06, 0.025, d - 0.02), wood, w / 2, y, d / 2);
    let x = 0.04;
    while (x < w - 0.08) {
      const bw = 0.025 + r() * 0.03, bh = 0.2 + r() * 0.12;
      if (x + bw > w - 0.04) break;
      const tilt = r() < 0.06;
      const isRed = secret && i === 3 && Math.abs(x - w * 0.6) < 0.03;
      const mat = isRed ? std({ color: 0xc11a1a, roughness: 0.6 }, { indoor: true, detail: 'fabric' }) : bookMats[Math.floor(r() * bookMats.length)];
      const b = add(new THREE.BoxGeometry(bw, bh, d * 0.8), mat, x + bw / 2, y + 0.0125 + bh / 2, d * 0.55);
      if (tilt) b.rotation.z = 0.25;
      if (isRed) b.position.z += 0.02;
      x += bw + (tilt ? 0.03 : 0.002);
    }
  }
  return g;
}

// ---- RIFT LAB (basement) ------------------------------------------------------------------------
function buildLab(game, M, kit) {
  const { scene, physics } = game;
  const y = BF;
  const add = (geo, mat, x, yy, z, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, yy, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // The RIFT machine: a 2.6 m ring on a base, glowing core, cables on the floor.
  const ringMat = std({ color: 0x2a2e36, roughness: 0.3, metalness: 0.9 }, { indoor: true, detail: 'metal' });
  const cx = -7.5, cz = -4.5;
  add(new THREE.CylinderGeometry(1.4, 1.6, 0.3, 40), ringMat, cx, y + 0.15, cz);
  physics.staticCylinder(cx, y + 0.15, cz, 1.6, 0.15);
  const ring = add(new THREE.TorusGeometry(1.3, 0.16, 20, 64), ringMat, cx, y + 1.75, cz);
  ring.rotation.y = 0;
  const ringGlow = add(new THREE.TorusGeometry(1.3, 0.04, 10, 64), M.labGlow, cx, y + 1.75, cz - 0.17);
  ringGlow.castShadow = false;
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7af8ff).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.9 });
  const core = add(new THREE.IcosahedronGeometry(0.22, 2), coreMat, cx, y + 1.75, cz);
  core.castShadow = false;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.3, 1.7, 0.4), ringMat, cx + s * 1.35, y + 0.95, cz);
    physics.staticBox(cx + s * 1.35, y + 0.95, cz, 0.15, 0.85, 0.2);
  }
  game.updatables.add({
    t: 0,
    update(dt) {
      this.t += dt;
      core.rotation.y += dt * 0.9;
      core.rotation.x += dt * 0.5;
      core.scale.setScalar(1 + Math.sin(this.t * 3) * 0.08);
      ringGlow.material.color.setRGB(0.18, 0.95, 1).multiplyScalar(1.6 + Math.sin(this.t * 2.2) * 0.5);
    },
  });
  // Reset pad: a glowing disc set flush into the floor (so even an ant-sized you can walk onto it).
  // Step on it at any size and it brings you back to normal size (1.75 m), smoothly.
  buildResetPad(game, -4.6, y, -6.6, 0.6);
  // Workbenches along the east wall.
  for (const z of [-6.8, -4.2]) {
    add(new THREE.BoxGeometry(0.9, 0.06, 2.0), M.steel, -3.6, y + 0.93, z);
    add(new THREE.BoxGeometry(0.85, 0.85, 1.9), M.labPanel, -3.62, y + 0.45, z);
    physics.staticBox(-3.6, y + 0.48, z, 0.45, 0.48, 1.0);
  }
  // Monitor wall (glowing screens with data).
  const screenTex = labScreenTexture();
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: 0xbfdfff });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const sx = -10.6 + i * 1.25, sy = y + 1.3 + j * 0.78;
    add(new THREE.BoxGeometry(1.18, 0.7, 0.05), M.labPanel, sx, sy, -7.8);
    const scr = add(new THREE.PlaneGeometry(1.12, 0.64), screenMat, sx, sy, -7.77);
    scr.castShadow = false;
  }
  physics.staticBox(-9.35, y + 1.7, -7.8, 1.9, 0.8, 0.05);
  // Server racks with blinking lights.
  for (const x of [-11.5, -10.9]) {
    add(new THREE.BoxGeometry(0.6, 2.0, 0.9), M.labPanel, x, y + 1.0, -1.0);
    physics.staticBox(x, y + 1.0, -1.0, 0.3, 1.0, 0.45);
  }
  // Terrarium on a table (for things you shrink).
  new Prop(game, CATALOG.table, { position: [-6.5, y, 0.6], rotationY: 0 });
  new Prop(game, CATALOG.terrarium, { position: [-6.5, y + 0.76, 0.6] });
  // Lab lights: cold white strips.
  for (const [x, z] of [[-7.5, -6], [-7.5, -2], [-5, -4], [-10, -4], [-8, 1.2]]) {
    const strip = add(new THREE.BoxGeometry(1.4, 0.03, 0.12), M.lightPanel, x, -0.33, z);
    strip.castShadow = false;
    game.lighting.addLamp({ position: new THREE.Vector3(x, -0.6, z), color: 0xe6f2ff, intensity: 7, range: 9 });
  }
  game.lighting.addLamp({ position: new THREE.Vector3(cx, y + 1.75, cz - 0.3), color: 0x5ef6ff, intensity: 6, range: 6 });
  void kit;
}

// The ground as a few big boxes around rectangular holes [x0, z0, x1, z1]. Cells are merged into
// long strips so it stays a handful of colliders.
function groundWithHoles(physics, top, holes, half = 200) {
  const xs = new Set([-half, half]), zs = new Set([-half, half]);
  for (const [x0, z0, x1, z1] of holes) {
    xs.add(Math.max(-half, Math.min(half, x0))).add(Math.max(-half, Math.min(half, x1)));
    zs.add(Math.max(-half, Math.min(half, z0))).add(Math.max(-half, Math.min(half, z1)));
  }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const inHole = (x, z) => holes.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  for (let i = 0; i < X.length - 1; i++) {
    const x0 = X[i], x1 = X[i + 1];
    if (x1 - x0 < 1e-6) continue;
    let start = null;
    for (let j = 0; j <= Z.length - 1; j++) {
      const solid = j < Z.length - 1 && Z[j + 1] - Z[j] > 1e-6 && !inHole((x0 + x1) / 2, (Z[j] + Z[j + 1]) / 2);
      if (solid && start === null) start = Z[j];
      if (!solid && start !== null) {
        physics.staticBox((x0 + x1) / 2, top - 2, (start + Z[j]) / 2, (x1 - x0) / 2, 2, (Z[j] - start) / 2);
        start = null;
      }
    }
  }
}

function buildResetPad(game, px, py, pz, R) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.translate(256, 256);
  const ring = (r, w, col, blur) => {
    c.shadowColor = col;
    c.shadowBlur = blur;
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
  };
  c.fillStyle = '#0a1016';
  c.beginPath();
  c.arc(0, 0, 254, 0, Math.PI * 2);
  c.fill();
  ring(246, 8, '#2ef2ff', 18);
  ring(200, 3, '#2ef2ff', 8);
  ring(120, 2, '#1aa6b8', 4);
  c.shadowBlur = 0;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const l = i % 6 === 0 ? 22 : 10;
    c.strokeStyle = i % 6 === 0 ? '#9ff8ff' : '#1d7f8c';
    c.lineWidth = i % 6 === 0 ? 3 : 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * (236 - l), Math.sin(a) * (236 - l));
    c.lineTo(Math.cos(a) * 236, Math.sin(a) * 236);
    c.stroke();
  }
  c.fillStyle = '#bffaff';
  c.font = 'bold 54px Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('1 : 1', 0, -18);
  c.font = '600 24px Arial, sans-serif';
  c.fillStyle = '#5fd9e6';
  c.fillText('RESET  ·  1.75 m', 0, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), mat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(px, py + 0.0004, pz);
  disc.renderOrder = 1;
  game.scene.add(disc);
  game.resetPad = { x: px, y: py, z: pz, r: R };
  // Armed when you step on; disarms until you step off again (so you can shrink while standing on it).
  const pad = { armed: true, active: false, t: 0 };
  game.updatables.add({
    update(dt) {
      const pl = game.player;
      if (!pl) return;
      pad.t += dt;
      const dx = pl.feet.x - px, dz = pl.feet.z - pz;
      const on = dx * dx + dz * dz < R * R && Math.abs(pl.feet.y - py) < 0.3 && pl.grounded;
      if (!on) {
        pad.armed = true;
        pad.active = false;
      } else if (pad.armed) {
        pad.armed = false;
        if (Math.abs(Math.log(pl.scale)) > 0.01) {
          pad.active = true;
          pl.resizeTarget = 1;
          bus.emit('toast', 'Reset pad: back to normal size');
        }
      }
      if (pad.active && pl.resizeTarget === null) pad.active = false;
      // Brighter and pulsing while it's working.
      const k = pad.active ? 1.5 + Math.sin(pad.t * 14) * 0.5 : 1 + Math.sin(pad.t * 2) * 0.08;
      mat.color.setScalar(k);
    },
  });
}

function labScreenTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = '#06121a';
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = '#2ef2ff';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x < 256; x += 4) g.lineTo(x, 80 + Math.sin(x * 0.08) * 30 * Math.sin(x * 0.013));
  g.stroke();
  g.fillStyle = '#ff2e88';
  for (let i = 0; i < 18; i++) g.fillRect(12 + i * 13, 150 - (i * 37) % 60, 8, (i * 37) % 60);
  g.fillStyle = '#9fd8ff';
  g.font = '12px monospace';
  g.fillText('RIFT FIELD  0.9997', 10, 18);
  g.fillText('SCALE  x0.0030', 10, 34);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
