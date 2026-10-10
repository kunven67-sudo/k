// Downtown Reno slice — the shared coordinate contract (motel + casino builders use the same).
//
// Metres. +X = east, -Z = north, +Y = up. Origin = centre of N Virginia St × E/W 4th St at
// street level (y = 0). Roads sit at y = 0, sidewalks and lots are raised by the curb (0.15 m).
//
//                         N (-Z)
//        Circus Circus  |      |
//   ----- 5th St -------+------+------ (z ≈ -118)
//        Silver Legacy  |  V   |  parking garage
//   ===== 4th St =======+==i===+============ Lake St ====== Starlite ======> x = 260
//        Eldorado       |  r   |  diner, souvenirs, chapel, pawn, Fitzgeralds (closed)
//          (x -80..-12) |  g   |
//   ~~~~~ Reno Arch ~~~~+~~~~~~+  (z ≈ 106, legs on the corner sidewalks)
//   ----- Commercial Row+------+------ (z ≈ 114)
//   ##### train trench (z 124..134), Virginia crosses on a bridge #####
//                         S (+Z)

export const ROAD_HW = 7; // road half-width
export const CURB_H = 0.15;
export const WALK_W = 4; // sidewalk width (|7|..|11|)
export const SIDEWALK_OUT = ROAD_HW + WALK_W;

// Roads: axis 'x' = runs east-west (rect spans x0..x1, z = c ± hw); 'z' = north-south.
// `play` is the walkable extent; beyond it the asphalt continues for the view but construction
// barricades close the street.
export const ROADS = [
  { id: '4th', name: 'E 4th St', axis: 'x', c: 0, hw: 7, from: -150, to: 300, play: [-40, 262], lanes: '4th' },
  { id: 'virginia', name: 'N Virginia St', axis: 'z', c: 0, hw: 7, from: -235, to: 182, play: [-140, 152], lanes: 'virginia' },
  { id: 'commercial', name: 'W Commercial Row', axis: 'x', c: 114, hw: 6, from: -150, to: 150, play: [-62, 62], lanes: 'two' },
  { id: '5th', name: 'W 5th St', axis: 'x', c: -118, hw: 6, from: -150, to: 120, play: [-30, 40], lanes: 'two' },
  { id: 'lake', name: 'Lake St', axis: 'z', c: 100, hw: 6, from: -75, to: 75, play: [-40, 40], lanes: 'two' },
];

export function roadRect(r) {
  return r.axis === 'x'
    ? { x0: r.from, x1: r.to, z0: r.c - r.hw, z1: r.c + r.hw }
    : { x0: r.c - r.hw, x1: r.c + r.hw, z0: r.from, z1: r.to };
}

// World bounds of the built ground.
export const BOUNDS = { x0: -150, x1: 300, z0: -235, z1: 182 };

// Downtown train trench (Union Pacific through downtown, sunken in 2005).
export const TRENCH = { z0: 124, z1: 134, depth: 6.6 };

// Reserved volumes owned by other builders — never build inside.
export const RESERVED = {
  eldoradoInterior: { x0: -75, x1: -15, z0: 15, z1: 95, y0: 0, y1: 7 },
  starlite: { x0: 180, x1: 230, z0: -55, z1: -11 },
};

// Building footprints (for reference by other modules and the builders here).
export const FOOTPRINTS = {
  eldorado: { x0: -80, x1: -12, z0: 12, z1: 100 },
  silverLegacy: { x0: -110, x1: -12, z0: -108, z1: -12 },
  circusCircus: { x0: -135, x1: -12, z0: -215, z1: -130 },
};

export const ARCH_Z = 106;
export const ELDORADO_ENTRANCE_Z = 50;

export const SPAWN = {
  virginiaAt4th: { x: 9.2, y: 0.15, z: 13.5, yaw: Math.PI }, // SE corner sidewalk, facing south
  underArch: { x: 3.0, y: 0.0, z: ARCH_Z - 6, yaw: Math.PI },
  motelFront: { x: 205, y: 0.15, z: -9, yaw: 0 },
};
