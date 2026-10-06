// Size science: how a body of any size moves, jumps, falls and gets hurt, and
// what you're about the size of. H = your height in metres (1.8 = normal).
export const BASE_H = 1.8;
export const MIN_SCALE = 0.001;    // ~1.8 mm (a flea: dust mites are as big as dogs to you)
export const MAX_SCALE = 20;       // ~36 m (bigger than most buildings in town)

const k = (s) => s; // scale = H / BASE_H

// walking speed multiplier: small bodies keep more of their speed for their size
// (like mice and ants); big ones follow the Froude rule (sqrt)
export const moveScale = (s) => (s < 1 ? Math.pow(k(s), 0.75) : Math.sqrt(k(s)));
// jump height in metres is roughly the same for every size (Borelli's rule),
// shrinking slowly for small bodies: tiny you jumps many times its own height
export const jumpScale = (s) => Math.pow(k(s), 0.35);
// the fastest you fall: small things drift down, big things plummet
export const terminalVel = (s) => 55 * Math.sqrt(k(s));
// falls hurt by how far you fell compared to your own height (as if you were normal size):
// up to ~1.7 body heights is fine, ten body heights is like a six-storey fall
export function fallDamage(s, drop) {
  const H = BASE_H * s;
  const x = Math.max(0, drop - 1.7 * H) / H * BASE_H;
  return x > 0 ? 6 * Math.pow(x, 1.2) : 0;
}

const NAMES = [
  [0.0005, 'a dust mite'], [0.0015, 'a flea'], [0.004, 'an ant'], [0.012, 'a ladybug'], [0.03, 'a bee'],
  [0.07, 'a mouse'], [0.16, 'a rat'], [0.35, 'a cat'], [0.8, 'a dog'], [1.3, 'a kid'], [2.2, 'a person'],
  [4, 'an elephant'], [7, 'a giraffe'], [13, 'a house'], [30, 'an apartment block'], [60, 'an office tower'], [1e9, 'a skyscraper'],
];
export const sizeName = (H) => (NAMES.find((n) => H < n[0]) || NAMES[NAMES.length - 1])[1];

export function fmtLen(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
  if (m >= 1) return `${m.toFixed(m < 10 ? 2 : m < 100 ? 1 : 0)} m`;
  if (m >= 0.01) return `${(m * 100).toFixed(m < 0.1 ? 1 : 0)} cm`;
  if (m >= 0.001) return `${(m * 1000).toFixed(m < 0.01 ? 2 : 1)} mm`;
  return `${(m * 1e6).toFixed(0)} µm`;
}

// real things, and how big they look to you at your size
const THINGS = [
  [0.00003, 'A pollen grain', 'wide'], [0.0003, 'A dust mite', 'long'], [0.00008, 'A human hair', 'wide'], [0.007, 'A grain of rice', 'long'], [0.025, 'A coin', 'wide'],
  [0.15, 'A phone', 'tall'], [0.9, 'A table', 'high'], [2.0, 'A door', 'tall'], [9, 'A house', 'tall'],
  [25, 'A blue whale', 'long'], [60, 'A 20-story building', 'tall'],
];
// "A coin looks 4.0 m wide to you": how big a real thing looks at your size
export function comparison(s, pick = Math.random()) {
  const list = THINGS.filter(([m]) => { const seen = m / s; return seen > 0.01 && seen < 3000 && Math.abs(Math.log(s)) > 0.3; });
  if (!list.length) return '';
  const [m, what, dim] = list[Math.floor(pick * list.length) % list.length];
  return `${what} looks ${fmtLen(m / s)} ${dim} to you`;
}
