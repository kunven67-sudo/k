// Real-world physics relations: mass to radius, star properties, Roche limits,
// and what a body *is* given its mass and what it is made of.
import {
  G, C, M_SUN, R_SUN, M_EARTH, R_EARTH, M_JUP, RHO, T_SUN, NS_MAX_MASS, WD_MAX_MASS,
  IMBH_MIN, SMBH_MIN, FORM, COMP_KEYS,
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

// Radius (Earth radii) of a gas-rich body versus mass (Earth masses):
// Neptune, Saturn, Jupiter, brown dwarfs and main-sequence stars.
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

export function compOf(c) {
  return { rock: c.rock || 0, iron: c.iron || 0, ice: c.ice || 0, carbon: c.carbon || 0, gas: c.gas || 0 };
}

export function normalizeComp(c) {
  for (const k of COMP_KEYS) if (!(c[k] >= 0)) c[k] = 0;
  const s = c.rock + c.iron + c.ice + c.carbon + c.gas || 1;
  for (const k of COMP_KEYS) c[k] /= s;
  return c;
}

export function mixComp(a, ma, b, mb) {
  const t = ma + mb;
  const out = {};
  for (const k of COMP_KEYS) out[k] = ((a[k] || 0) * ma + (b[k] || 0) * mb) / t;
  return out;
}

export function solidDensity(comp, mass) {
  const solid = comp.rock + comp.iron + comp.ice + (comp.carbon || 0) + 1e-9;
  const inv = (comp.rock / RHO.rock + comp.iron / RHO.iron + comp.ice / RHO.ice + (comp.carbon || 0) / RHO.carbon) / solid;
  let rho = 1 / inv;
  // small bodies are porous rubble piles
  rho *= lerp(0.55, 1.0, logStep(1e14, 1e21, mass));
  // big rocky planets are squeezed by their own gravity
  rho *= 1 + 0.47 * Math.pow(Math.min(Math.max(mass, 0) / M_EARTH, 300), 0.4) * logStep(1e21, 1e23, mass);
  return rho;
}

export function isStellarMass(mass) {
  return mass >= 0.075 * M_SUN;
}

export function starTemp(mass) {
  return interpLog(STAR_TEMP, mass / M_SUN);
}

// how hydrogen-rich you must be to burn as a star
export const STAR_GAS_MIN = 0.5;

export function canFuse(mass, comp) {
  return mass >= 0.075 * M_SUN && comp.gas >= STAR_GAS_MIN;
}

export function whiteDwarfRadius(mass) {
  // Earth-sized at 0.6 Msun, shrinking toward the Chandrasekhar limit
  const m = mass / M_SUN;
  return 0.0126 * R_SUN * Math.pow(m / 0.6, -1 / 3) * Math.sqrt(Math.max(0.05, 1 - Math.pow(m / 1.44, 4 / 3))) / Math.sqrt(1 - Math.pow(0.6 / 1.44, 4 / 3));
}

export function bodyRadius(mass, comp, compact = null) {
  if (compact === 'bh') return schwarzschild(mass);
  if (compact === 'ns') return 12 - 1.6 * (mass / M_SUN - 1.4);
  if (compact === 'wd') return whiteDwarfRadius(mass);
  const rhoS = solidDensity(comp, mass);
  let rSolid = Math.cbrt((3 * mass) / (4 * Math.PI * rhoS));
  // past a few hundred Earth masses solid matter turns degenerate and shrinks as it grows
  const deg = 300 * M_EARTH;
  if (mass > deg) {
    const r0 = Math.cbrt((3 * deg) / (4 * Math.PI * solidDensity(comp, deg)));
    rSolid = r0 * Math.pow(mass / deg, -1 / 3);
    rSolid = Math.max(rSolid, whiteDwarfRadius(Math.min(mass, 1.37 * M_SUN)) * 0.6);
  }
  const me = mass / M_EARTH;
  const gasW = smoothstep(0.03, 0.5, comp.gas);
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

// ---------------------------------------------------------------- what am I?

// The form a body takes from its mass, makeup, temperature and life stage.
// opts.phase: 'rg' | 'sg' for evolved stars
export function classify(mass, comp, compact = null, opts = {}) {
  if (compact === 'bh') return mass >= SMBH_MIN ? 'smbh' : mass >= IMBH_MIN ? 'imbh' : 'stellarbh';
  if (compact === 'ns') return 'neutron';
  if (compact === 'wd') return 'whitedwarf';
  if (opts.phase === 'rg') return 'redgiant';
  if (opts.phase === 'sg') return 'massive';
  const me = mass / M_EARTH;
  const gasRich = comp.gas >= 0.3;
  if (mass >= 0.075 * M_SUN && comp.gas >= STAR_GAS_MIN) {
    const ms = mass / M_SUN;
    return ms < 0.5 ? 'reddwarf' : ms < 1.5 ? 'sunlike' : ms < 8 ? 'bluestar' : 'massive';
  }
  if (mass >= 13 * M_JUP && comp.gas >= STAR_GAS_MIN) return 'browndwarf';
  if (gasRich && me >= 6) return comp.gas < 0.6 && me < 60 ? 'icegiant' : 'gasgiant';
  if (comp.gas >= 0.12 && me >= 8) return 'icegiant';
  if (mass < 1e17) return 'planetesimal';
  if (mass < 1e20) return 'asteroid';
  if (mass < 3e22) return 'dwarf';
  if (mass < 3e23) return 'protoplanet';
  if (me >= 1.5 * 318) return 'degenerate';
  const T = opts.temp ?? 280;
  if ((comp.carbon || 0) >= 0.25) return me >= 3 ? 'diamondworld' : 'carbonworld';
  if (comp.iron >= 0.55) return 'ironworld';
  if (comp.ice >= 0.25 && me >= 0.3) return T < 235 ? 'iceworld' : 'oceanworld';
  if (me < 2) return 'terrestrial';
  if (me < 10) return 'superearth';
  return 'megaearth';
}

export function tierOf(form) {
  return FORM[form]?.tier ?? 0;
}

// mass thresholds that matter, used for the progress bar
const STEPS = [1e17, 1e20, 3e22, 3e23, 2 * M_EARTH, 10 * M_EARTH, 60 * M_EARTH, 13 * M_JUP, 0.075 * M_SUN, 0.5 * M_SUN, 1.5 * M_SUN, 8 * M_SUN];

// What will I turn into if I keep eating like this?
// diet: average makeup of recent meals. Returns { form, mass } or null.
export function forecast(mass, comp, diet, compact, opts = {}) {
  const now = classify(mass, comp, compact, opts);
  if (compact === 'ns') return { form: 'stellarbh', mass: NS_MAX_MASS };
  if (compact === 'wd') return { form: 'supernova', mass: WD_MAX_MASS };
  if (compact === 'bh') {
    const next = mass < IMBH_MIN ? IMBH_MIN : mass < SMBH_MIN ? SMBH_MIN : null;
    return next ? { form: classify(next * 1.01, comp, 'bh'), mass: next } : null;
  }
  const d = diet || comp;
  for (const f of [1.25, 1.6, 2, 3, 5, 8, 13, 20, 35, 60, 100, 200, 500, 1000, 3000, 1e4, 3e4, 1e5]) {
    const m = mass * f;
    const c = mixComp(comp, mass, d, m - mass);
    const form = classify(m, c, null, opts);
    if (form !== now) {
      // refine to the threshold
      let lo = mass, hi = m;
      for (let i = 0; i < 24; i++) {
        const mid = Math.sqrt(lo * hi);
        if (classify(mid, mixComp(comp, mass, d, mid - mass), null, opts) === now) lo = mid; else hi = mid;
      }
      return { form, mass: hi };
    }
  }
  return null;
}

// floor of the current form, for the progress bar
export function formFloor(mass) {
  let f = 1e13;
  for (const s of STEPS) if (mass >= s) f = s;
  return f;
}

export { M_JUP, M_EARTH, M_SUN, R_EARTH, WD_MAX_MASS };
