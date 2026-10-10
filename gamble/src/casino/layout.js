// Eldorado casino floor — the coordinate contract for everything inside the shell (lane A).
//
// World metres, same frame as src/world/reno/layout.js (+X east, -Z north, +Y up). The exterior
// shell (src/world/reno/eldorado.js) has its inner wall faces at x ∈ [-79.6, -12.4],
// z ∈ [12.4, 99.6] with a 5 m chamfer at the 4th & Virginia corner, and the first-floor slab
// underside at y ≈ 7.15. Everything here lives inside that box.
//
//               N (4th St, z 12.4)          4th St door x -47.5..-42.5
//   elevators ┌───────────────────────────────────────────────┐╲ chamfer door
//   (NW)      │  slots (wild west)   esc.   slots (space)  classic│
//             │                                               │ Virginia St
//   cage (W)  │        ( fountain under the dome )     foyer ◄─┤ main doors
//   kiosks/ATM│                                               │ (z 44.6–55.4)
//             │          table pit (BJ, BJ, roulette)  slots   │
//   restrooms │                                    bar (SE)   │
//             └───────────────────────────────────────────────┘
//                              S (Commercial Row)

export const FLOOR_Y = 0.16; // carpet surface = floor collider top (sidewalk is 0.15)
export const CEIL_H = 4.2; // dropped coffered ceiling, beam bottoms
export const CEIL_Y = FLOOR_Y + CEIL_H;
export const COFFER_DEPTH = 0.34; // recess of the coffer panels above the beams
export const SLAB_Y = 7.15; // first-floor slab underside (shell)

// Inner faces of the shell walls; our finish walls sit SKIN metres inside them.
export const SHELL = { x0: -79.6, x1: -12.4, z0: 12.4, z1: 99.6 };
export const SKIN = 0.03;
// Chamfer inner face (outer face (-12,17)→(-17,12), wall 0.4 thick), clipped to the inner faces.
export const CHAMFER = { a: [-12.4, 17.166], b: [-17.166, 12.4] };

// Door openings cut through the shell (see eldorado.js; y from the sidewalk 0.15 to 3.35).
export const DOOR_TOP = 3.35;
export const DOORS = {
  // Virginia St: three glass door pairs, each 2.6 m wide, wall plane x -12.4 … -12.0.
  virginia: [
    { z0: 45.4, z1: 48.0 },
    { z0: 48.7, z1: 51.3 },
    { z0: 52.0, z1: 54.6 },
  ],
  // 4th St side door under the skyway, wall plane z 12.0 … 12.4.
  fourth: { x0: -47.5, x1: -42.5 },
  // Chamfer corner door: along the face from (-12, 17) to (-17, 12), local x 1.4 … 5.67.
  chamfer: { from: 1.4, to: 5.6711 },
};

// ---- Areas -----------------------------------------------------------------------------------
export const FOYER = { x0: -21.0, x1: -12.4, z0: 41.0, z1: 59.0 };
export const PODIUM = { x: -17.3, z: 44.2 }; // security podium (guard stands west of it)
export const PLAYERS = { x0: -20.4, x1: -15.2, z: 58.4 }; // players club desk along the foyer's south side

export const FOUNTAIN = { x: -46, z: 50, basinR: 4.6, ringR: 9.2, domeR: 9.5, colR: 10.4 };

export const PIT = { x: -46, z: 73.5 };

export const CAGE = { x0: -79.6, x1: -74.2, z0: 43.0, z1: 59.0, front: -74.25 };
export const CAGE_WINDOWS = [45.0, 48.3, 51.6, 54.9]; // window centres (z) along the counter
export const KIOSKS = [{ x: -74.0, z: 41.2 }, { x: -74.0, z: 60.8 }];
export const ATM = { x: -74.0, z: 62.4 };

export const BAR = { x0: -40.0, x1: -16.0, z0: 86.0, z1: 99.6, front: 91.6, back: 98.75 };

export const RESTROOMS = { x0: -79.6, x1: -76.2, z0: 84.0, z1: 99.6 };
export const ELEVATORS = { x0: -79.6, x1: -73.0, z0: 14.0, z1: 29.0, doors: [16.4, 19.6, 22.8, 26.0] };

// Escalators to the skyway level (rise to the first floor at y ≈ 7.6): bottom landing south,
// climbing north into a well in the ceiling. Not usable yet (stanchions at the bottom).
export const ESCALATOR = { x0: -57.0, x1: -52.6, zBottom: 35.0, zFoot: 33.6, slope: Math.tan((30 * Math.PI) / 180), well: { x0: -57.4, x1: -52.2, z0: 18.6, z1: 28.4 } };

// Columns (marble shafts with gilded capitals). The dome ring is added from FOUNTAIN.
export const COLUMNS = [
  [-21.6, 40.6], [-21.6, 59.4], // foyer entrance pair
  [-39.2, 64.6], [-52.8, 64.6], [-39.2, 82.2], [-52.8, 82.2], // pit corners
  [-74.2, 40.6], [-74.2, 61.4], // cage ends
  [-63.0, 50.0], [-29.0, 50.0], // E-W axis through the fountain
  [-63.0, 37.5], [-29.0, 37.5], [-63.0, 66.0], [-29.0, 66.0],
  [-41.0, 89.8], [-16.0, 86.8], // bar ends
  [-65.0, 84.0], [-46.0, 37.8],
];

// ---- Stations -----------------------------------------------------------------------------
// Tables: local +Z is the player side, so yaw points the player side away from the pit centre.
const ring = (ang, r) => ({ x: PIT.x + Math.sin(ang) * r, z: PIT.z + Math.cos(ang) * r, yaw: ang });
export const TABLES = [
  { id: 'bj-5', kind: 'blackjack', limits: { min: 5, max: 500 }, ...ring(-2.1, 6.0) },
  { id: 'roulette-1', kind: 'roulette', limits: { min: 5, max: 500, insideMin: 1 }, ...ring(Math.PI, 5.9) },
  { id: 'bj-25', kind: 'blackjack', limits: { min: 25, max: 2000 }, ...ring(2.1, 6.0) },
];
// Covered tables for games that come later (closed today).
export const CLOSED_TABLES = [
  { id: 'craps-1', kind: 'craps', ...ring(0, 6.1) },
  { id: 'baccarat-1', kind: 'baccarat', ...ring(-1.05, 6.0) },
  { id: 'three-card-1', kind: 'three-card', ...ring(1.05, 6.0) },
];
export const PIT_PODIUM = { x: PIT.x, z: PIT.z + 0.4 };

// Slot banks. Bank `position` is the centre of the machine row(s); arrangement 'row' backs onto
// a wall or rail, 'back-to-back' is an island with machines on both sides. Pitch 0.78 m.
// Aisles between banks are ≥ 2.4 m (checked in dev: __casino.checkAisles()).
export const SLOT_BANKS = [
  // North-west block — Wild West Gold (islands of 2×4).
  { id: 'ww-a1', theme: 'wild-west', count: 8, arrangement: 'back-to-back', x: -67.2, z: 21.2, yaw: 0, denom: 0.25 },
  { id: 'ww-a2', theme: 'wild-west', count: 8, arrangement: 'back-to-back', x: -61.2, z: 21.2, yaw: 0, denom: 0.25 },
  { id: 'ww-b1', theme: 'wild-west', count: 8, arrangement: 'back-to-back', x: -67.2, z: 28.0, yaw: 0, denom: 1 },
  { id: 'ww-b2', theme: 'wild-west', count: 8, arrangement: 'back-to-back', x: -61.2, z: 28.0, yaw: 0, denom: 0.25 },
  // North-east block — Space & Aliens.
  { id: 'sp-a1', theme: 'space', count: 8, arrangement: 'back-to-back', x: -38.2, z: 21.2, yaw: 0, denom: 0.01 },
  { id: 'sp-a2', theme: 'space', count: 8, arrangement: 'back-to-back', x: -32.2, z: 21.2, yaw: 0, denom: 0.01 },
  { id: 'sp-b1', theme: 'space', count: 8, arrangement: 'back-to-back', x: -38.2, z: 28.0, yaw: 0, denom: 0.05 },
  { id: 'sp-b2', theme: 'space', count: 8, arrangement: 'back-to-back', x: -32.2, z: 28.0, yaw: 0, denom: 0.01 },
  // North wall rows (backs to the wall, players stand south of them).
  { id: 'dr-n1', theme: 'dragon', count: 6, arrangement: 'row', x: -65.0, z: 13.45, yaw: 0, denom: 0.01 },
  { id: 'dr-n2', theme: 'dragon', count: 6, arrangement: 'row', x: -36.0, z: 13.45, yaw: 0, denom: 0.01 },
  // Classic corner (lever machines) by the chamfer door.
  { id: 'cl-1', theme: 'classic-fruit', count: 6, arrangement: 'back-to-back', x: -24.6, z: 24.4, yaw: 0, denom: 1 },
  { id: 'cl-2', theme: 'classic-fruit', count: 6, arrangement: 'back-to-back', x: -24.6, z: 31.2, yaw: 0, denom: 0.25 },
  // East strip, between the foyer and the bar — Dragon & Fortune.
  { id: 'dr-e1', theme: 'dragon', count: 8, arrangement: 'back-to-back', x: -25.4, z: 68.0, yaw: Math.PI / 2, denom: 0.01 },
  { id: 'dr-e2', theme: 'dragon', count: 8, arrangement: 'back-to-back', x: -25.4, z: 77.4, yaw: Math.PI / 2, denom: 0.05 },
  // Along the Virginia St wall, south of the foyer (backs to the wall, players face west).
  { id: 'ww-e1', theme: 'wild-west', count: 6, arrangement: 'row', x: -13.45, z: 72.0, yaw: -Math.PI / 2, denom: 1 },
];

// ---- Spawns (feet, view yaw = looking along (-sin, -cos)) -------------------------------------
export const SPAWNS = {
  entrance: { x: -9.6, y: 0.15, z: 50, yaw: Math.PI / 2 }, // outside on Virginia St, facing the doors
  foyer: { x: -15.2, y: FLOOR_Y, z: 50, yaw: Math.PI / 2 }, // just inside, facing west
  fountain: { x: -33.5, y: FLOOR_Y, z: 50, yaw: Math.PI / 2 },
  pit: { x: -46, y: FLOOR_Y, z: 63.2, yaw: Math.PI },
  cage: { x: -71.4, y: FLOOR_Y, z: 51.6, yaw: Math.PI / 2 },
  slots: { x: -49.6, y: FLOOR_Y, z: 24.6, yaw: -Math.PI / 2 },
  classic: { x: -20.2, y: FLOOR_Y, z: 27.8, yaw: -Math.PI / 2 },
  bar: { x: -28, y: FLOOR_Y, z: 86.4, yaw: Math.PI },
  fourth: { x: -45, y: FLOOR_Y, z: 15.0, yaw: Math.PI },
};

// ---- Zones (audio room + venue; smallest box wins in world.zonesAt) ---------------------------
export const ZONES = [
  { id: 'eldorado-floor', box: [SHELL.x0, -0.5, SHELL.z0, SHELL.x1, SLAB_Y, SHELL.z1] },
  { id: 'eldorado-foyer', box: [FOYER.x0, -0.5, FOYER.z0, SHELL.x1, SLAB_Y, FOYER.z1] },
  { id: 'eldorado-bar', box: [BAR.x0, -0.5, BAR.z0, BAR.x1, SLAB_Y, BAR.z1] },
  { id: 'eldorado-cage', box: [SHELL.x0, -0.5, CAGE.z0, -70.0, SLAB_Y, CAGE.z1] },
  { id: 'eldorado-restrooms', box: [RESTROOMS.x0, -0.5, RESTROOMS.z0, RESTROOMS.x1, SLAB_Y, RESTROOMS.z1] },
];

/** True when p (x, z) is inside the shell's floor area (chamfer excluded). */
export function insideShell(x, z, pad = 0) {
  if (x < SHELL.x0 + pad || x > SHELL.x1 - pad || z < SHELL.z0 + pad || z > SHELL.z1 - pad) return false;
  // Chamfer: the line x - z = -29.566 (through the inner corner points); inside is x - z < that.
  return x - z < CHAMFER.a[0] - CHAMFER.a[1] - pad * Math.SQRT2;
}
