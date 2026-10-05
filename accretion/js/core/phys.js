// Real-world physics relations: mass to radius, star properties, Roche limits.
import {
  G, C, M_SUN, R_SUN, M_EARTH, R_EARTH, M_JUP, RHO, T_SUN,
  NS_MAX_MASS, IMBH_MIN, SMBH_MIN, STAGES, STAGE_INDEX,
} from './constants.js';

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const logStep = (a, b, x) => smoothstep(Math.log(a), Math.log(b), Math.log(Math.max(x, 1e-300)));

// log-log interpolation in a table of [x, y]
export function interpLog(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) {
    // extrapolate with the last segment's slope
    const [x0, y0] = table[n - 2], [x1, y1] = table[n - 1];
    const k = Math.log(y1 / y0) / Math.log(x1 / x0);
    return y1 * Math.pow(x / x1, k);
  }
  for (let i = 1; i < n; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      const t = Math.log(x / x0) / Math.log(x1 / x0);
      return Math.exp(lerp(Math.log(y0), Math.log(y1), t));
    }
  }
  return table[n - 1][1];
}

// Radius (Earth radii) of a gas-rich body versus mass (Earth masses).
// Based on Neptune, Saturn, Jupiter, brown dwarfs and main-sequence stars.
const GAS_RADIUS = [
  [2, 1.9], [5, 2.4], [10, 3.0], [17, 3.88], [50, 6.6], [95, 9.45], [318, 11.2],
  [1000, 11.6], [4130, 11.0], [25400, 10.3], [33300, 13.1], [66600, 23.9],
  [166000, 50.2], [266000, 87], [333000, 109.2], [500000, 174], [666000, 196],
  [1000000, 262], [1666000, 349], [2664000, 458], [4995000, 708], [8325000, 982],
  [13300000, 1310],
];

// Main-sequence effective temperature (K) versus mass (solar masses)
const STAR_TEMP = [
  [0.075, 2300], [0.1, 2700], [0.2, 3150], [0.5, 3800], [0.8, 5000], [1, 5772],
  [1.5, 6800], [2, 8600], [3, 11000], [5, 15200], [8, 20000], [15, 30000],
  [25, 36000], [40, 42000], [60, 45000],
];

export function solidDensity(comp, mass) {
  const solid = comp.rock + comp.iron + comp.ice + 1e-9;
  const inv = (comp.rock / RHO.rock + comp.iron / RHO.iron + comp.ice / RHO.ice) / solid;
  let rho = 1 / inv;
  // small bodies are porous rubble piles
  rho *= lerp(0.55, 1.0, logStep(1e14, 1e21, mass));
  // big rocky planets are squeezed by their own gravity
  rho *= 1 + 0.47 * Math.pow(Math.max(mass, 0) / M_EARTH, 0.4) * logStep(1e21, 1e23, mass);
  return rho;
}

export function isStellarMass(mass) {
  return mass >= 0.075 * M_SUN;
}

export function starTemp(mass) {
  return interpLog(STAR_TEMP, mass / M_SUN);
}

export function bodyRadius(mass, comp, compact = null) {
  if (compact === 'bh') return schwarzschild(mass);
  if (compact === 'ns') return 12 - 1.6 * (mass / M_SUN - 1.4);
  const rhoS = solidDensity(comp, mass);
  const rSolid = Math.cbrt((3 * mass) / (4 * Math.PI * rhoS));
  const me = mass / M_EARTH;
  // above 13 Jupiter masses a body is basically all gas whatever it ate
  const gasW = Math.max(smoothstep(0.03, 0.5, comp.gas), logStep(30, 300, me));
  if (gasW <= 0 || me < 1) return rSolid;
  const rGas = interpLog(GAS_RADIUS, Math.max(me, 2)) * R_EARTH;
  return Math.exp(lerp(Math.log(rSolid), Math.log(Math.max(rGas, rSolid)), gasW));
}

export function schwarzschild(mass) {
  return (2 * G * mass) / (C * C);
}

// How far a compact object reaches when eating stars (km).
// The real horizon is tiny, so gameplay uses the distance where it tears a Sun-like star apart.
export function compactReach(mass) {
  return 0.38 * R_SUN * Math.cbrt(mass / M_SUN);
}

export function starLuminosity(mass, radius) {
  const T = starTemp(mass);
  return Math.pow(radius / R_SUN, 2) * Math.pow(T / T_SUN, 4); // in L_sun
}

// Fluid Roche limit: where a big body (M) tears apart a small one (m, r)
export function rocheLimit(M, m, r) {
  return 2.44 * r * Math.cbrt(M / m);
}

export function hillRadius(a, m, M) {
  return a * Math.cbrt(m / (3 * M));
}

export function escapeVelocity(M, R) {
  return Math.sqrt((2 * G * M) / Math.max(R, 1e-6));
}

export function circularVelocity(M, r) {
  return Math.sqrt((G * M) / Math.max(r, 1e-6));
}

// Planet equilibrium temperature (K) from star temperature, radius and REAL distance (km)
export function equilibriumTemp(Tstar, Rstar, dReal, albedo = 0.3) {
  return Tstar * Math.sqrt(Rstar / (2 * Math.max(dReal, Rstar))) * Math.pow(1 - albedo, 0.25);
}

// How lumpy/irregular a small body is: 1 = potato, 0 = round
export function lumpiness(mass) {
  return 1 - logStep(3e18, 8e20, mass);
}

// Blackbody colour in linear RGB, normalised so the max channel is 1
export function blackbody(T) {
  const t = clamp(T, 1000, 40000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const toLin = (v) => {
    const c = clamp(v, 0, 255) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const out = [toLin(r), toLin(g), toLin(b)];
  const m = Math.max(out[0], out[1], out[2]);
  return [out[0] / m, out[1] / m, out[2] / m];
}

// Which stage a body of this mass is at (non-compact branch)
export function stageForMass(mass, compact = null) {
  if (compact === 'ns') return STAGE_INDEX.neutron;
  if (compact === 'bh') {
    if (mass >= SMBH_MIN) return STAGE_INDEX.smbh;
    if (mass >= IMBH_MIN) return STAGE_INDEX.imbh;
    return STAGE_INDEX.stellarbh;
  }
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (!STAGES[i].compact && mass >= STAGES[i].min) idx = i;
  }
  return idx;
}

export function nextStageMass(mass, compact) {
  if (compact === 'ns') return NS_MAX_MASS;
  if (compact === 'bh') return mass < IMBH_MIN ? IMBH_MIN : mass < SMBH_MIN ? SMBH_MIN : 4.1e6 * M_SUN;
  const i = stageForMass(mass);
  const next = STAGES[i + 1];
  return next && !next.compact ? next.min : null;
}

export function stageFloorMass(mass, compact) {
  if (compact === 'ns') return 1.2 * M_SUN;
  if (compact === 'bh') return mass < IMBH_MIN ? 3 * M_SUN : mass < SMBH_MIN ? IMBH_MIN : SMBH_MIN;
  const i = stageForMass(mass);
  return Math.max(STAGES[i].min, 1e13);
}

export function normalizeComp(c) {
  const s = c.rock + c.iron + c.ice + c.gas || 1;
  c.rock /= s; c.iron /= s; c.ice /= s; c.gas /= s;
  return c;
}

export function mixComp(a, ma, b, mb) {
  const t = ma + mb;
  return {
    rock: (a.rock * ma + b.rock * mb) / t,
    iron: (a.iron * ma + b.iron * mb) / t,
    ice: (a.ice * ma + b.ice * mb) / t,
    gas: (a.gas * ma + b.gas * mb) / t,
  };
}

export { M_JUP };
