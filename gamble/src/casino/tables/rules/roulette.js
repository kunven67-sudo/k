// American double-zero roulette — pure logic + the layout geometry (no three.js here), shared by
// the 3D table, the felt painter and the node self-test.
//
// Pockets are 0..37 where 37 means "00". The outcome is fairInt(0, 37) drawn at the spin; the
// ball's path is then choreographed to land in that pocket (wheel.js).
//
// Layout frame (metres, the table's local space): X runs along the layout away from the wheel
// (numbers grow toward +X), Z points to the players (+Z). The players' row is 1-4-7…34, the
// dealer's row 3-6-9…36; 0 sits on the players' half of the head, 00 on the dealer's half.

import { fairInt } from '../../../core/rng.js';

export const DOUBLE_ZERO = 37;
// Clockwise pocket order of a real American wheel.
export const WHEEL_ORDER = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const label = (n) => (n === DOUBLE_ZERO ? '00' : String(n));
export const colorOf = (n) => (n === 0 || n === DOUBLE_ZERO ? 'green' : RED.has(n) ? 'red' : 'black');
export const spinOutcome = () => fairInt(0, 37);

// ---- layout geometry --------------------------------------------------------------------------
export const L = {
  CW: 0.104, // number box width (along X)
  CH: 0.112, // number box depth (along Z)
  ZW: 0.15, // zero area width
  DH: 0.105, // dozens strip depth
  OH: 0.105, // outside (even-money) strip depth
  X0: -0.62, // left edge of the 1-2-3 column (zero area lies to its left)
  ZT: -0.33, // dealer-side edge of the number grid
};
L.XE = L.X0 + 12 * L.CW; // right edge of 34-35-36
L.ZN = L.ZT + 3 * L.CH; // players' edge of the number grid (street line)
L.ZD = L.ZN + L.DH; // dozens / outside boundary
L.ZO = L.ZD + L.OH; // outer edge of the outside bets
L.width = L.ZW + 12 * L.CW + L.CW; // zero + numbers + 2-to-1

const rowZ = (r) => L.ZN - (r + 0.5) * L.CH; // r 0 = players' row (1,4,7…)
const colX = (c) => L.X0 + (c + 0.5) * L.CW;
export const numberCell = (n) => {
  const c = Math.ceil(n / 3) - 1;
  const r = (n - 1) % 3;
  return { c, r, x: colX(c), z: rowZ(r) };
};

/**
 * Every bet on the layout: { id, kind, numbers, pays, x, z, inside, shape } where shape is
 * { rect: [x0, z0, x1, z1] } for boxes or { r } for line / corner spots (hit radius).
 */
export function buildBets() {
  const bets = [];
  const add = (b) => bets.push(b);
  const inside = true;
  const nums = (...a) => a;
  // Straight ups.
  for (let n = 1; n <= 36; n++) {
    const { x, z } = numberCell(n);
    add({ id: `s${n}`, kind: 'straight', numbers: [n], pays: 35, x, z, inside, shape: { rect: [x - L.CW / 2, z - L.CH / 2, x + L.CW / 2, z + L.CH / 2] } });
  }
  const zMid = L.ZT + 1.5 * L.CH;
  add({ id: 's0', kind: 'straight', numbers: [0], pays: 35, x: L.X0 - L.ZW / 2, z: (zMid + L.ZN) / 2, inside, shape: { rect: [L.X0 - L.ZW, zMid, L.X0, L.ZN] } });
  add({ id: 's00', kind: 'straight', numbers: [DOUBLE_ZERO], pays: 35, x: L.X0 - L.ZW / 2, z: (L.ZT + zMid) / 2, inside, shape: { rect: [L.X0 - L.ZW, L.ZT, L.X0, zMid] } });
  // Splits across columns (n, n+3) and across rows (n, n+1).
  for (let n = 1; n <= 33; n++) {
    const a = numberCell(n);
    add({ id: `h${n}-${n + 3}`, kind: 'split', numbers: nums(n, n + 3), pays: 17, x: a.x + L.CW / 2, z: a.z, inside, shape: { r: 0.024 } });
  }
  for (let n = 1; n <= 36; n++) {
    if (n % 3 === 0) continue;
    const a = numberCell(n);
    add({ id: `v${n}-${n + 1}`, kind: 'split', numbers: nums(n, n + 1), pays: 17, x: a.x, z: a.z - L.CH / 2, inside, shape: { r: 0.024 } });
  }
  // Zero splits.
  add({ id: 'z0-00', kind: 'split', numbers: [0, DOUBLE_ZERO], pays: 17, x: L.X0 - L.ZW / 2, z: zMid, inside, shape: { r: 0.026 } });
  add({ id: 'z0-1', kind: 'split', numbers: [0, 1], pays: 17, x: L.X0, z: rowZ(0), inside, shape: { r: 0.024 } });
  add({ id: 'z0-2', kind: 'split', numbers: [0, 2], pays: 17, x: L.X0, z: L.ZT + 1.75 * L.CH, inside, shape: { r: 0.02 } });
  add({ id: 'z00-2', kind: 'split', numbers: [DOUBLE_ZERO, 2], pays: 17, x: L.X0, z: L.ZT + 1.25 * L.CH, inside, shape: { r: 0.02 } });
  add({ id: 'z00-3', kind: 'split', numbers: [DOUBLE_ZERO, 3], pays: 17, x: L.X0, z: rowZ(2), inside, shape: { r: 0.024 } });
  // Trios on the zero line.
  add({ id: 't0-1-2', kind: 'street', numbers: [0, 1, 2], pays: 11, x: L.X0, z: L.ZT + 2 * L.CH, inside, shape: { r: 0.02 } });
  add({ id: 't0-00-2', kind: 'street', numbers: [0, DOUBLE_ZERO, 2], pays: 11, x: L.X0, z: zMid, inside, shape: { r: 0.02 } });
  add({ id: 't00-2-3', kind: 'street', numbers: [DOUBLE_ZERO, 2, 3], pays: 11, x: L.X0, z: L.ZT + L.CH, inside, shape: { r: 0.02 } });
  // Streets and six lines on the players' edge of the grid.
  for (let c = 0; c < 12; c++) {
    const n = 3 * c + 1;
    add({ id: `st${n}`, kind: 'street', numbers: nums(n, n + 1, n + 2), pays: 11, x: colX(c), z: L.ZN, inside, shape: { r: 0.026 } });
    if (c < 11) add({ id: `sl${n}`, kind: 'sixline', numbers: nums(n, n + 1, n + 2, n + 3, n + 4, n + 5), pays: 5, x: L.X0 + (c + 1) * L.CW, z: L.ZN, inside, shape: { r: 0.024 } });
  }
  // Corners.
  for (let n = 1; n <= 32; n++) {
    if (n % 3 === 0) continue;
    const a = numberCell(n);
    add({ id: `c${n}`, kind: 'corner', numbers: nums(n, n + 1, n + 3, n + 4), pays: 8, x: a.x + L.CW / 2, z: a.z - L.CH / 2, inside, shape: { r: 0.024 } });
  }
  // Top line (0-00-1-2-3), the only five-number bet: 6:1 and the worst bet on the table.
  add({ id: 'top', kind: 'topline', numbers: [0, DOUBLE_ZERO, 1, 2, 3], pays: 6, x: L.X0, z: L.ZN, inside, shape: { r: 0.026 } });
  // Columns (2 to 1 boxes at the foot of each row).
  for (let r = 0; r < 3; r++) {
    const numbers = [];
    for (let c = 0; c < 12; c++) numbers.push(3 * c + 1 + r);
    const x = L.XE + L.CW / 2;
    add({ id: `col${r + 1}`, kind: 'column', numbers, pays: 2, x, z: rowZ(r), inside: false, shape: { rect: [L.XE, rowZ(r) - L.CH / 2, L.XE + L.CW, rowZ(r) + L.CH / 2] } });
  }
  // Dozens.
  for (let k = 0; k < 3; k++) {
    const numbers = [];
    for (let n = k * 12 + 1; n <= k * 12 + 12; n++) numbers.push(n);
    const x0 = L.X0 + k * 4 * L.CW;
    add({ id: `doz${k + 1}`, kind: 'dozen', numbers, pays: 2, x: x0 + 2 * L.CW, z: (L.ZN + L.ZD) / 2, inside: false, shape: { rect: [x0, L.ZN, x0 + 4 * L.CW, L.ZD] } });
  }
  // Even-money bets, two columns wide each.
  const even = [
    ['low', (n) => n >= 1 && n <= 18],
    ['even', (n) => n % 2 === 0],
    ['red', (n) => RED.has(n)],
    ['black', (n) => !RED.has(n)],
    ['odd', (n) => n % 2 === 1],
    ['high', (n) => n >= 19],
  ];
  even.forEach(([id, f], k) => {
    const numbers = [];
    for (let n = 1; n <= 36; n++) if (f(n)) numbers.push(n);
    const x0 = L.X0 + k * 2 * L.CW;
    add({ id, kind: 'even', numbers, pays: 1, x: x0 + L.CW, z: (L.ZD + L.ZO) / 2, inside: false, shape: { rect: [x0, L.ZD, x0 + 2 * L.CW, L.ZO] } });
  });
  for (const b of bets) b.set = new Set(b.numbers);
  return bets;
}

export const BETS = buildBets();
export const BET_BY_ID = new Map(BETS.map((b) => [b.id, b]));

/** Amount returned (stake included) for `amount` on bet `b` when `result` hits. */
export function betReturn(b, amount, result) {
  return b.set.has(result) ? amount * (b.pays + 1) : 0;
}

/**
 * Bet under a layout point (x, z): corners/lines win over boxes when the point is near them,
 * like a dealer reading where a chip sits. Returns null off the layout.
 */
export function betAt(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const b of BETS) {
    if (!b.shape.r) continue;
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.shape.r && d < bestD) {
      best = b;
      bestD = d;
    }
  }
  if (best) return best;
  for (const b of BETS) {
    const r = b.shape.rect;
    if (r && x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return b;
  }
  return null;
}

/** Exact house edge of a bet type by enumerating all 38 pockets (−EV per unit). */
export function exactEdge(b) {
  let ret = 0;
  for (let n = 0; n < 38; n++) ret += betReturn(b, 1, n);
  return 1 - ret / 38;
}
