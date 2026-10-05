// Turning raw numbers into readable real-world units.
import {
  M_SUN, M_JUP, M_EARTH, M_MOON, M_CERES, M_EVEREST, C, AU, R_SUN, R_EARTH,
} from './constants.js';

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function sci(x, digits = 2) {
  if (!isFinite(x)) return '∞';
  if (x === 0) return '0';
  const neg = x < 0;
  x = Math.abs(x);
  const e = Math.floor(Math.log10(x));
  if (e >= -2 && e < 5) return (neg ? '-' : '') + trim(x.toFixed(Math.max(0, digits - Math.max(e, 0))));
  const m = x / Math.pow(10, e);
  const exp = String(e).split('').map((ch) => SUP[ch]).join('');
  return `${neg ? '-' : ''}${m.toFixed(digits)} × 10${exp}`;
}

function trim(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function nice(x, digits = 3) {
  if (!isFinite(x)) return '∞';
  const a = Math.abs(x);
  if (a >= 1e6) return sci(x, 2);
  if (a >= 1000) return Math.round(x).toLocaleString('en-US');
  if (a >= 100) return x.toFixed(0);
  if (a >= 10) return x.toFixed(1);
  if (a >= 1) return x.toFixed(2);
  if (a >= 0.01) return x.toFixed(3);
  return sci(x, digits - 1);
}

export function massKg(m) {
  return `${sci(m, 2)} kg`;
}

// A familiar comparison for a mass
export function massFriendly(m) {
  if (m < 1e19) return `${nice(m / M_EVEREST)} × Mount Everest`;
  if (m < 7e21) return `${nice(m / M_CERES)} Ceres masses`;
  if (m < 6e23) return `${nice(m / M_MOON)} Moon masses`;
  if (m < 1.9e26) return `${nice(m / M_EARTH)} Earth masses`;
  if (m < 1.5e29) return `${nice(m / M_JUP)} Jupiter masses`;
  return `${nice(m / M_SUN)} solar masses`;
}

export function massShort(m) {
  if (m < 1e19) return `${nice(m / M_EVEREST)} Everests`;
  if (m < 7e21) return `${nice(m / M_CERES)} Ceres`;
  if (m < 6e23) return `${nice(m / M_MOON)} M☾`;
  if (m < 1.9e26) return `${nice(m / M_EARTH)} M⊕`;
  if (m < 1.5e29) return `${nice(m / M_JUP)} M♃`;
  return `${nice(m / M_SUN)} M☉`;
}

export function distance(km) {
  const a = Math.abs(km);
  if (a < 1) return `${(km * 1000).toFixed(0)} m`;
  if (a < 1e6) return `${nice(km)} km`;
  if (a < C * 120) return `${nice(km / C)} light-seconds`;
  if (a < C * 3600 * 2) return `${nice(km / (C * 60))} light-minutes`;
  return `${nice(km / (C * 3600))} light-hours`;
}

export function radius(km) {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  if (km < 2e5) return `${nice(km)} km`;
  return `${nice(km / R_SUN)} R☉ (${sci(km, 2)} km)`;
}

export function speed(kms) {
  const a = Math.abs(kms);
  if (a < 1) return `${(kms * 1000).toFixed(a < 0.01 ? 2 : 1)} m/s`;
  if (a > C * 0.01) return `${(kms / C).toFixed(3)} c`;
  return `${nice(kms)} km/s`;
}

export function temperature(k) {
  if (k >= 1e5) return `${sci(k, 1)} K`;
  return `${Math.round(k).toLocaleString('en-US')} K`;
}

export function duration(sec) {
  const s = Math.abs(sec);
  if (s < 120) return `${s.toFixed(0)} s`;
  if (s < 7200) return `${(s / 60).toFixed(0)} min`;
  if (s < 86400 * 2) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 86400 * 365 * 2) return `${(s / 86400).toFixed(0)} days`;
  return `${(s / (86400 * 365.25)).toFixed(1)} years`;
}

export function percent(x, d = 0) {
  return `${(x * 100).toFixed(d)}%`;
}

export { AU, R_EARTH };
