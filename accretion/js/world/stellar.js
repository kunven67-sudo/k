// Stellar evolution: what a star of a given mass looks like at a given age.
// Main-sequence lifetimes follow t ~ 10 Gyr x M^-2.5; Sun-like stars become red
// giants then white dwarfs; massive stars explode and leave neutron stars or
// black holes. Red dwarfs outlive the current age of the universe.
import { M_SUN, R_SUN } from '../core/constants.js';
import { interpLog, starTemp, blackbody } from '../core/phys.js';

export const YEAR = 3.15576e7; // seconds

const MS_RADIUS = [
  [0.075, 0.1], [0.1, 0.12], [0.2, 0.22], [0.5, 0.46], [0.8, 0.8], [1, 1.0],
  [1.5, 1.6], [2, 1.8], [3, 2.4], [5, 3.2], [8, 4.2], [15, 6.5], [25, 9], [40, 12], [60, 15],
];

export function msLifetimeYears(mSun) {
  return 1e10 * Math.pow(mSun, -2.5);
}

export function whiteDwarfMass(mSun) {
  return Math.min(1.33, 0.48 + 0.11 * (mSun - 0.5));
}

export function remnantOf(mSun) {
  if (mSun < 8) return { kind: 'wd', mass: whiteDwarfMass(mSun) };
  if (mSun < 22) return { kind: 'ns', mass: Math.min(2.0, 1.25 + 0.03 * (mSun - 8)) };
  return { kind: 'bh', mass: mSun * 0.3 };
}

// Summary of a star of initial mass mSun at age ageYears
export function stellarState(mSun, ageYears) {
  const tMS = msLifetimeYears(mSun);
  const giantSpan = tMS * (mSun < 8 ? 0.12 : 0.1);
  if (ageYears < 0) return null; // not born yet
  if (ageYears < tMS) {
    // main sequence: slowly brightens with age (the young Sun was ~30% dimmer)
    const f = ageYears / tMS;
    const R = interpLog(MS_RADIUS, mSun) * R_SUN * (0.9 + 0.25 * f);
    const T = starTemp(mSun * M_SUN) * (1 - 0.03 * f);
    return { phase: 'ms', mass: mSun, radius: R, temp: T, lum: lumOf(R, T), frac: f, tMS };
  }
  if (ageYears < tMS + giantSpan) {
    const f = (ageYears - tMS) / giantSpan;
    if (mSun < 8) {
      // red giant: swells to 10-200x the Sun's radius, cool and very bright
      const R = R_SUN * (3 + 180 * Math.pow(f, 2.2)) * Math.pow(mSun, 0.3);
      const T = 4800 - 1700 * f;
      return { phase: 'rg', mass: mSun * (1 - 0.35 * f), radius: R, temp: T, lum: lumOf(R, T), frac: f, tMS };
    }
    // massive stars become supergiants before exploding
    const R = R_SUN * (20 + 900 * f);
    const T = 20000 - 16000 * f;
    return { phase: 'sg', mass: mSun * (1 - 0.2 * f), radius: R, temp: T, lum: lumOf(R, T), frac: f, tMS };
  }
  const rem = remnantOf(mSun);
  const since = ageYears - tMS - giantSpan;
  if (rem.kind === 'wd') {
    // white dwarfs start ~100,000 K and cool for trillions of years
    const T = Math.max(3000, 100000 * Math.pow(1 + since / 1e7, -0.4));
    const R = 0.012 * R_SUN * Math.pow(rem.mass / 0.6, -1 / 3);
    return { phase: 'wd', mass: rem.mass, radius: R, temp: T, lum: lumOf(R, T), since, tMS };
  }
  if (rem.kind === 'ns') return { phase: 'ns', mass: rem.mass, radius: 12, temp: 1e6, lum: 0.0005, since, tMS };
  return { phase: 'bh', mass: rem.mass, radius: 0, temp: 0, lum: 0, since, tMS };
}

export function lumOf(radiusKm, T) {
  return Math.pow(radiusKm / R_SUN, 2) * Math.pow(T / 5772, 4);
}

export function phaseName(st) {
  switch (st.phase) {
    case 'ms': return st.mass < 0.5 ? 'Red dwarf' : st.mass < 0.8 ? 'Orange dwarf' : st.mass < 1.5 ? 'Yellow dwarf' : st.mass < 8 ? 'Blue-white star' : 'Blue giant';
    case 'rg': return 'Red giant';
    case 'sg': return 'Red supergiant';
    case 'wd': return 'White dwarf';
    case 'ns': return 'Neutron star';
    case 'bh': return 'Black hole';
    default: return 'Star';
  }
}

export function colorOf(st) {
  if (st.phase === 'bh') return [0, 0, 0];
  return blackbody(st.temp);
}

// Kroupa initial mass function, 0.08 - 60 solar masses
const IMF = (() => {
  // dN/dM ~ M^-1.3 (0.08-0.5), M^-2.3 (0.5-60), continuous at 0.5
  const a1 = 1.3, a2 = 2.3, m0 = 0.08, m1 = 0.5, m2 = 60;
  const k2 = Math.pow(m1, a2 - a1); // continuity factor
  const int = (a, lo, hi) => (Math.pow(hi, 1 - a) - Math.pow(lo, 1 - a)) / (1 - a);
  const n1 = int(a1, m0, m1);
  const n2 = k2 * int(a2, m1, m2);
  const tot = n1 + n2;
  return { a1, a2, m0, m1, m2, k2, n1, n2, tot, int };
})();

// fraction of stars with mass below m
export function imfCDF(m) {
  const I = IMF;
  if (m <= I.m0) return 0;
  if (m <= I.m1) return I.int(I.a1, I.m0, m) / I.tot;
  if (m >= I.m2) return 1;
  return (I.n1 + I.k2 * I.int(I.a2, I.m1, m)) / I.tot;
}

export function imfInverse(u) {
  const I = IMF;
  const target = u * I.tot;
  if (target <= I.n1) {
    const v = Math.pow(I.m0, 1 - I.a1) + target * (1 - I.a1);
    return Math.pow(v, 1 / (1 - I.a1));
  }
  const rest = (target - I.n1) / I.k2;
  const v = Math.pow(I.m1, 1 - I.a2) + rest * (1 - I.a2);
  return Math.min(I.m2, Math.pow(v, 1 / (1 - I.a2)));
}

// Hawking evaporation time for a black hole (years)
export function hawkingYears(mass) {
  return 2.1e67 * Math.pow(mass / M_SUN, 3);
}
