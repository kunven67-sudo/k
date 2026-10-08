// What the feet are standing on → footstep sound family (ARCHITECTURE §5 step.* names).
//
// Colliders carry no material, and raycasting merged render meshes on every footfall is too slow
// for phones, so the surface is resolved from the world's zones plus a small table of known
// floors (all cheap box tests). Order matters: the most specific region wins.
import { ROOM, OFFICE, LOT, BACK, EAST, WALK_W } from '../world/motel/layout.js';

// [x0, x1, z0, z1, yMin, yMax, surface]
const REGIONS = [
  [ROOM.bathX0, ROOM.x1, ROOM.zBack, ROOM.zBath, -1, 2, 'tile'], // bathroom: tile-bathroom
  [ROOM.x0, ROOM.bathX0, ROOM.zBack, ROOM.zBath, -1, 2, 'carpet'], // closet nook
  [ROOM.x0, ROOM.x1, ROOM.zBath, ROOM.zDoor, -1, 2, 'carpet'], // bedroom: carpet-motel
  [OFFICE.x0, OFFICE.x1, OFFICE.z0, OFFICE.z1, -1, 3, 'tile'], // office linoleum
  [BACK.x0, BACK.x1, BACK.z1, BACK.z1 + 2.2, 2.2, 4.5, 'concrete'], // upper walkway (back)
  [EAST.x0 - 2.2, EAST.x0, EAST.z0, EAST.z1, 2.2, 4.5, 'concrete'], // upper walkway (east)
  [212.5, 218, -45, -38, 0.3, 4.5, 'metal'], // stair treads
  [BACK.x0, BACK.x1, BACK.z1, BACK.z1 + WALK_W + 0.6, -1, 1, 'concrete'], // ground walkway apron
  [EAST.x0 - WALK_W - 0.6, EAST.x0, EAST.z0, EAST.z1, -1, 1, 'concrete'],
  [LOT.x0, LOT.x1, LOT.z0, LOT.z1, -3, 1.2, 'asphalt'], // lot asphalt (pool deck is close enough)
];

/** Surface name for a foot at (x, y, z). */
export function surfaceAt(x, y, z) {
  for (const r of REGIONS) {
    if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3] && y >= r[4] && y <= r[5]) return r[6];
  }
  // City: roads at y≈0, sidewalks / lots raised by the 15 cm curb.
  if (y < 0.075) return 'asphalt';
  return 'concrete';
}
