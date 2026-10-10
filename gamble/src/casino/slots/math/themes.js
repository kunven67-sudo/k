// PAR sheets for the three video themes (Silverlode Gaming, invented maker). Reel strips are
// built deterministically from the symbol counts below (math/engine.js buildStrip), so the game
// and `tools/slot-sim.mjs` spin exactly the same reels. Verified RTP / hit rate / volatility are
// recorded in ../PROGRESS.md (≥ 10 M simulated spins each).
//
// Units: line games pay per credit bet on a line; 243-ways pays are credits at the 25-credit
// base bet (waysUnit); scatter, coin and jackpot awards are multiples of the total bet.

const LINES_30 = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2],
  [0, 2, 1, 2, 0], [2, 0, 1, 0, 2], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 0, 1, 0, 1],
];

const LOWS = [
  { key: 'A', role: 'low' },
  { key: 'K', role: 'low' },
  { key: 'Q', role: 'low' },
  { key: 'J', role: 'low' },
  { key: 'T', role: 'low' },
];

/** counts helper: [W, S, H1, H2, H3, H4, A, K, Q, J, T] (+ C for the dragon). */
const row = (keys, nums) => Object.fromEntries(keys.map((k, i) => [k, nums[i]]).filter(([, n]) => n > 0));
const K11 = ['W', 'S', 'H1', 'H2', 'H3', 'H4', 'A', 'K', 'Q', 'J', 'T'];
const K12 = [...K11, 'C'];

// ---- Wild West Gold — "Bounty Gulch Gold": 25 lines, sticky-wild free spins -----------------------
export const WEST = {
  id: 'wild-west',
  title: 'Bounty Gulch Gold',
  kind: 'lines',
  lines: LINES_30.slice(0, 25),
  lineChoices: [1, 5, 10, 15, 20, 25],
  betChoices: [1, 2, 3, 4, 5, 10],
  symbols: [
    { key: 'W', role: 'wild' }, // sheriff's star
    { key: 'S', role: 'scatter' }, // wanted poster
    { key: 'H1', role: 'high' }, // golden revolver
    { key: 'H2', role: 'high' }, // cowboy hat
    { key: 'H3', role: 'high' }, // boot with spur
    { key: 'H4', role: 'high' }, // horseshoe
    ...LOWS,
  ],
  pays: {
    W: [0, 0, 0, 50, 250, 1000],
    H1: [0, 0, 0, 50, 200, 750],
    H2: [0, 0, 0, 40, 150, 500],
    H3: [0, 0, 0, 30, 100, 300],
    H4: [0, 0, 0, 25, 75, 200],
    A: [0, 0, 0, 10, 40, 150],
    K: [0, 0, 0, 10, 40, 125],
    Q: [0, 0, 0, 5, 25, 100],
    J: [0, 0, 0, 5, 20, 100],
    T: [0, 0, 0, 5, 15, 80],
  },
  scatter: { pays: { 3: 2, 4: 10, 5: 50 }, spins: { 3: 8, 4: 12, 5: 20 }, retrigger: { 3: 5, 4: 5, 5: 5 }, freeScatterPay: true, maxFree: 60 },
  feature: { type: 'sticky' },
  stacks: { all: { H1: 3, H2: 3 } },
  reels: {
    base: [
      row(K11, [1, 1, 6, 6, 4, 4, 5, 5, 6, 6, 6]),
      row(K11, [2, 2, 6, 6, 4, 5, 5, 5, 5, 6, 6]),
      row(K11, [1, 1, 6, 6, 4, 4, 5, 5, 6, 5, 6]),
      row(K11, [2, 2, 6, 6, 5, 4, 5, 5, 5, 6, 6]),
      row(K11, [1, 1, 6, 6, 4, 4, 5, 5, 6, 6, 6]),
    ],
    free: [
      row(K11, [0, 1, 6, 6, 4, 4, 5, 5, 6, 6, 6]),
      row(K11, [2, 2, 6, 6, 4, 5, 5, 5, 5, 6, 6]),
      row(K11, [3, 1, 6, 6, 4, 4, 5, 5, 6, 5, 6]),
      row(K11, [3, 2, 6, 6, 5, 4, 5, 5, 5, 6, 6]),
      row(K11, [2, 1, 6, 6, 4, 4, 5, 5, 6, 6, 6]),
    ],
  },
  volatility: 'medium-high',
};

// ---- Space & Aliens — "Saucer Stampede": 243 ways, expanding UFO wilds -----------------------------
export const SPACE = {
  id: 'space',
  title: 'Saucer Stampede',
  kind: 'ways',
  waysUnit: 25,
  betChoices: [1, 2, 3, 4, 5, 8, 10], // × 25 credits
  symbols: [
    { key: 'W', role: 'wild' }, // flying saucer (reels 2–4, beam expands over the reel)
    { key: 'S', role: 'scatter' }, // ringed planet (reels 1, 3, 5)
    { key: 'H1', role: 'high' }, // alien
    { key: 'H2', role: 'high' }, // abducted cow
    { key: 'H3', role: 'high' }, // rocket
    { key: 'H4', role: 'high' }, // ray gun
    ...LOWS,
  ],
  pays: {
    H1: [0, 0, 0, 40, 120, 400],
    H2: [0, 0, 0, 30, 80, 250],
    H3: [0, 0, 0, 20, 60, 160],
    H4: [0, 0, 0, 15, 40, 120],
    A: [0, 0, 0, 8, 20, 80],
    K: [0, 0, 0, 8, 20, 80],
    Q: [0, 0, 0, 4, 15, 60],
    J: [0, 0, 0, 4, 12, 50],
    T: [0, 0, 0, 4, 10, 40],
  },
  scatter: { pays: { 3: 3 }, spins: { 3: 10 }, retrigger: { 3: 10 }, freeScatterPay: true, maxFree: 60 },
  feature: { type: 'expand', base: true, reels: [1, 2, 3], freeMultPerReel: [1, 2, 3, 4] },
  reels: {
    base: [
      row(K11, [0, 3, 4, 4, 5, 5, 7, 7, 8, 8, 8]),
      row(K11, [1, 0, 4, 4, 5, 5, 7, 7, 7, 8, 8]),
      row(K11, [1, 4, 4, 4, 5, 5, 7, 7, 8, 7, 8]),
      row(K11, [1, 0, 4, 4, 5, 5, 7, 7, 7, 8, 8]),
      row(K11, [0, 3, 4, 4, 5, 5, 7, 7, 8, 8, 8]),
    ],
    free: [
      row(K11, [0, 3, 4, 4, 5, 5, 7, 7, 8, 8, 8]),
      row(K11, [2, 0, 4, 4, 5, 5, 7, 7, 7, 8, 8]),
      row(K11, [2, 3, 4, 4, 5, 5, 7, 7, 8, 7, 8]),
      row(K11, [2, 0, 4, 4, 5, 5, 7, 7, 7, 8, 8]),
      row(K11, [0, 3, 4, 4, 5, 5, 7, 7, 8, 8, 8]),
    ],
  },
  volatility: 'medium',
};

// ---- Dragon & Fortune — "Golden Pearl Dragon": 30 lines, hold & spin pearls, fixed jackpots ---------
export const DRAGON_JACKPOTS = { mini: 15, minor: 50, major: 500 };
export const DRAGON = {
  id: 'dragon',
  title: 'Golden Pearl Dragon',
  kind: 'lines',
  lines: LINES_30,
  lineChoices: [1, 10, 20, 30],
  betChoices: [1, 2, 3, 5, 8, 10],
  symbols: [
    { key: 'W', role: 'wild' }, // golden dragon medallion (reels 2–5)
    { key: 'S', role: 'scatter' }, // gold ingot (reels 2–4)
    { key: 'H1', role: 'high' }, // koi
    { key: 'H2', role: 'high' }, // red lantern
    { key: 'H3', role: 'high' }, // firecrackers
    { key: 'H4', role: 'high' }, // golden fan
    ...LOWS,
    { key: 'C', role: 'coin' }, // flaming pearl
  ],
  pays: {
    H1: [0, 0, 0, 50, 200, 750],
    H2: [0, 0, 0, 40, 150, 500],
    H3: [0, 0, 0, 30, 100, 300],
    H4: [0, 0, 0, 25, 75, 200],
    A: [0, 0, 0, 10, 40, 150],
    K: [0, 0, 0, 10, 40, 125],
    Q: [0, 0, 0, 5, 25, 100],
    J: [0, 0, 0, 5, 20, 100],
    T: [0, 0, 0, 5, 15, 80],
  },
  scatter: { pays: { 3: 5 }, spins: { 3: 8 }, retrigger: null, freeScatterPay: false, maxFree: 8 },
  feature: {
    type: 'holdspin',
    trigger: 6,
    // Coin values × total bet; jackpot coins carry a label.
    values: [
      { x: 0.5, w: 30 },
      { x: 1, w: 26 },
      { x: 1.5, w: 14 },
      { x: 2, w: 12 },
      { x: 3, w: 7 },
      { x: 5, w: 4 },
      { x: 8, w: 2 },
      { x: 10, w: 1.2 },
      { x: DRAGON_JACKPOTS.mini, w: 1.4, label: 'mini' },
      { x: DRAGON_JACKPOTS.minor, w: 0.25, label: 'minor' },
    ],
    fullScreen: DRAGON_JACKPOTS.major,
    // chance that an empty cell lands a pearl on a respin, by pearls already held (0..15)
    cellChance: Array(16).fill(0.08),
  },
  stacks: { all: { H1: 3, H2: 3, C: 3 } },
  reels: {
    base: [
      row(K12, [0, 0, 6, 6, 4, 4, 5, 5, 6, 6, 6, 6]),
      row(K12, [2, 3, 6, 6, 4, 5, 5, 5, 5, 6, 6, 3]),
      row(K12, [3, 3, 6, 6, 4, 4, 5, 5, 6, 5, 6, 3]),
      row(K12, [2, 3, 6, 6, 5, 4, 5, 5, 5, 6, 6, 3]),
      row(K12, [2, 0, 6, 6, 4, 4, 5, 5, 6, 6, 6, 3]),
    ],
    free: [
      row(K12, [0, 0, 6, 6, 4, 4, 5, 5, 6, 6, 6, 9]),
      row(K12, [3, 2, 6, 6, 4, 5, 5, 5, 5, 6, 6, 9]),
      row(K12, [3, 2, 6, 6, 4, 4, 5, 5, 6, 5, 6, 9]),
      row(K12, [3, 2, 6, 6, 5, 4, 5, 5, 5, 6, 6, 9]),
      row(K12, [3, 0, 6, 6, 4, 4, 5, 5, 6, 6, 6, 9]),
    ],
  },
  volatility: 'high',
};

export const VIDEO_PARS = { 'wild-west': WEST, space: SPACE, dragon: DRAGON };
