// The floor plan (meters). -z is south-facing (the sun side), +x is east.
//
//   bedroom / stream room      hallway        kitchen
//   x 0..5.4  z 0..4.8         x 5.52..6.82   x 6.94..10.94  z 0..3.6
//                              z 0..6.4       bathroom
//                                             x 6.94..9.34   z 3.72..6.4
export const H = 2.6;           // ceiling height
export const T_IN = 0.12;       // interior wall thickness
export const T_OUT = 0.22;      // exterior wall thickness

export const ROOMS = {
  bedroom: { x0: 0, x1: 5.4, z0: 0, z1: 4.8, floor: 'laminate', wall: 0x8a8e94, accent: 0x34373d, ceil: 0xf2f1ee },
  hallway: { x0: 5.52, x1: 6.82, z0: 0, z1: 6.4, floor: 'laminate', wall: 0xd9d5cd, ceil: 0xf2f1ee },
  kitchen: { x0: 6.94, x1: 10.94, z0: 0, z1: 3.6, floor: 'marble', wall: 0xe4e1da, ceil: 0xf4f3f0 },
  bathroom: { x0: 6.94, x1: 9.34, z0: 3.72, z1: 6.4, floor: 'granite', wall: 0xf0efec, ceil: 0xf4f3f0 },
};

// Openings. along = distance along the wall measured from the wall's start corner (see house.js).
export const DOORS = {
  bedroom: { room: 'bedroom', wall: 'E', z0: 3.7, z1: 4.6, h: 2.1, hingeAt: 'z1', swingInto: 'bedroom', other: 'hallway' },
  bathroom: { room: 'bathroom', wall: 'W', z0: 4.5, z1: 5.3, h: 2.1, hingeAt: 'z1', swingInto: 'bathroom', other: 'hallway' },
  front: { room: 'hallway', wall: 'S', x0: 5.72, x1: 6.62, h: 2.1, locked: true },
};
export const OPENINGS = [
  { a: 'hallway', b: 'kitchen', wall: 'E', z0: 0.9, z1: 2.1, h: 2.1 }, // open doorway, no door
];
export const WINDOWS = {
  bedroom: { room: 'bedroom', wall: 'N', x0: 2.6, x1: 4.2, y0: 0.85, y1: 2.2 },
  kitchen: { room: 'kitchen', wall: 'N', x0: 8.25, x1: 9.45, y0: 1.05, y1: 2.15 },
  bathroom: { room: 'bathroom', wall: 'S', x0: 7.7, x1: 8.4, y0: 1.55, y1: 2.05, frosted: true },
};

export function roomAt(x, z) {
  for (const [k, r] of Object.entries(ROOMS)) if (x >= r.x0 - 0.06 && x <= r.x1 + 0.06 && z >= r.z0 - 0.06 && z <= r.z1 + 0.06) return k;
  return null;
}
