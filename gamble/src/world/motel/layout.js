// Starlite Motel coordinate contract. Meters, +X east, -Z north, y = 0 at street level.
// The whole parcel sits on the raised lot level (curb height) like every lot on E 4th St.
//
//            z=-55 ┌──────────────── back wing (rooms face S) ────────────────┐
//                  │ 1   2   3   4   5  [6=player]  7   8   ice │ corner    │
//            z=-45 └───────────────────────────────────────────┬──┤ east wing │
//                    pool (fenced)          stairs (214..218.5) │  │ rooms     │
//                                                               │  │ face W    │
//            z=-22 office ┐                                     │  │ 9..14     │
//            z=-13 ───────┘ pole sign (196,-14)   dumpster(226,-15)            │
//            z=-11 ─────────────────── E 4th St north sidewalk (city) ──────────
//                 x=180                                                     x=230

export const Y0 = 0.15; // lot surface (curb height)
export const LOT = { x0: 180, x1: 230, z0: -55, z1: -11 };
export const DRIVE = { x0: 196, x1: 206 };

export const FLOOR_H = 2.9; // storey height
export const WALK_W = 1.5; // upper walkway depth
export const WALL_T = 0.3;

export const OFFICE = { x0: 182, x1: 192, z0: -22, z1: -13, h: 3.4, doorX: 187 };
export const SIGN = { x: 196, z: -14, h: 9 };

export const BACK = { x0: 184, x1: 228, z0: -54, z1: -45 }; // rooms face south (z1 façade)
export const EAST = { x0: 219, x1: 228, z0: -45, z1: -20 }; // rooms face west (x0 façade)
export const STAIR = { x0: 214, x1: 218.5, z0: -44.5, z1: -42 };

export const POOL = { x0: 184, x1: 194, z0: -42, z1: -31, shallow: 0.3, deep: 2.2 };
export const POOL_FENCE = { x0: 183, x1: 195, z0: -43, z1: -30 };

export const ROOM_W = 4;

// Player room (ground floor, back wing). Bedroom at the front, bathroom + closet at the back.
export const ROOM = {
  x0: 204, x1: 208,
  zDoor: -45, // façade plane (door faces south)
  zBack: -54,
  zBath: -51.5, // bedroom / bathroom partition
  bathX0: 205.8, // bathroom x∈[205.8, 208], closet nook x∈[204, 205.8]
  ceil: 2.5,
};

// Room door slots on both floors. `slot.player` marks the player's door. Numbers: ground floor
// back wing west→east, then east wing north→south; upper floor continues from 17 the same way.
export function doorSlots() {
  const slots = [];
  const backRooms = [184, 188, 192, 196, 200, 204, 208, 212]; // room x0 along the back wing
  const eastRooms = [-44.5, -40.5, -36.5, -32.5, -28.5, -24.5]; // room z0 along the east wing
  for (let f = 0; f < 2; f++) {
    let n = f === 0 ? 1 : 17;
    for (const x0 of backRooms) {
      slots.push({ wing: 'back', floor: f, x0, x1: x0 + ROOM_W, num: n++, player: f === 0 && x0 === ROOM.x0 });
    }
    for (const z0 of eastRooms) {
      slots.push({ wing: 'east', floor: f, z0, z1: z0 + ROOM_W, num: n++, player: false });
    }
  }
  return slots;
}

// Player-room interior frame (derived): finished floor, ceiling, inner wall faces.
export const RI = {
  fl: Y0 + 0.12, // carpet / tile top (same as the walkway apron, so the door sill is flush)
  ceil: Y0 + 0.12 + ROOM.ceil,
  x0: 204.1, // inner face of the west party wall
  x1: 207.9, // inner face of the east party wall
  zf: -45.3, // inner face of the façade
  zb: -53.7, // inner face of the rear wall
  zp: -51.5, // bedroom side of the bedroom / bathroom partition (0.1 m thick → -51.6)
  bx: 205.8, // bathroom side of the closet / bathroom wall (0.1 m thick → 205.7)
  door: { x0: 204.3, x1: 205.2, h: 2.08 }, // entry door hole
  win: { x0: 205.65, x1: 207.45, y0: Y0 + 1.07, y1: Y0 + 2.27 },
  bathDoor: { x0: 206.15, x1: 206.9, h: 2.0 },
};
