// Maple Hollow map layout (metres). x = east, z = south, y = up. Ground at y = 0, road surface
// sits 12 cm lower (real curb). Everything that needs to know "where is the street" reads this.

export const CURB = 0.12;

export const MAPLE = { z: 0, x0: -72, x1: 66, half: 3.75 }; // Maple Street (east-west)
export const ELM = { x: 70, z0: -96, z1: 96, half: 4 }; // Elm Avenue (north-south)
export const CULDESAC = { x: -72, z: 0, r: 11 };

export const SIDEWALK = {
  mapleN: { z0: -6.9, z1: -5.4 },
  mapleS: { z0: 5.4, z1: 6.9 },
  elmW: { x0: 62.6, x1: 64.1 },
  elmE: { x0: 75.9, x1: 77.4 },
};

// Lots: centre x, side (-1 north of the street, +1 south). The family lives on the north side.
export const FAMILY_LOT = { x0: -16, zf: -17 }; // house origin (front-left corner) + front wall z
export const LOTS = [
  { id: 'n1', x: -54, side: -1, address: '101 Maple St' },
  { id: 'n2', x: -31, side: -1, address: '105 Maple St' },
  { id: 'home', x: -6.5, side: -1, address: '109 Maple St', family: true },
  { id: 'n4', x: 18, side: -1, address: '113 Maple St' },
  { id: 'n5', x: 42, side: -1, address: '117 Maple St' },
  { id: 's1', x: -54, side: 1, address: '102 Maple St' },
  { id: 's2', x: -31, side: 1, address: '106 Maple St' },
  { id: 's3', x: -7, side: 1, address: '110 Maple St' },
  { id: 's4', x: 18, side: 1, address: '114 Maple St' },
  { id: 's5', x: 42, side: 1, address: '118 Maple St' },
];
export const LOT_DEPTH = { front: 7.2, back: 44 }; // from the street centre line

export const PARK = { x0: -132, x1: -84, z0: -42, z1: 42 };
export const PLAZA = { x0: 80, x1: 162, z0: -82, z1: 22 };
export const SCHOOL = { x0: 82, x1: 148, z0: 34, z1: 90 };
export const BOUNDS = { x0: -142, x1: 172, z0: -98, z1: 98 }; // perimeter fence

// Stores face west (towards Elm Ave + the parking lot). open/close in game hours.
export const STORES = {
  grocery: { id: 'grocery', name: 'Walmort', x0: 124, x1: 156, z0: -76, z1: -46, open: 7, close: 23 },
  electronics: { id: 'electronics', name: 'Best Bye', x0: 130, x1: 156, z0: -38, z1: -16, open: 10, close: 21 },
  furniture: { id: 'furniture', name: 'IKEO', x0: 126, x1: 156, z0: -9, z1: 18, open: 10, close: 21 },
};
