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
  if (a < C * 3600 * 24 * 3) return `${nice(km / (C * 3600))} light-hours`;
  if (a < C * 86400 * 200) return `${nice(km / (C * 86400))} light-days`;
  return `${nice(km / 9.4607e12)} light-years`;
}

// a span of years in words: "4.2 million years"
export function years(y) {
  const a = Math.abs(y);
  if (!isFinite(a)) return 'forever';
  if (a < 1) return `${(a * 365.25).toFixed(0)} days`;
  if (a < 1e4) return `${a < 10 ? a.toFixed(1) : Math.round(a).toLocaleString('en-US')} years`;
  if (a < 1e6) return `${trim((a / 1e3).toFixed(a < 1e5 ? 1 : 0))} thousand years`;
  if (a < 1e9) return `${trim((a / 1e6).toFixed(a < 1e8 ? 1 : 0))} million years`;
  if (a < 1e12) return `${trim((a / 1e9).toFixed(2))} billion years`;
  if (a < 1e15) return `${trim((a / 1e12).toFixed(1))} trillion years`;
  return `10${String(Math.floor(Math.log10(a))).split('').map((ch) => SUP[ch]).join('')} years`;
}

// short form for the HUD: "4.2 Myr"
export function yearsShort(y) {
  const a = Math.abs(y);
  if (a < 1e3) return `${a < 10 ? a.toFixed(2) : Math.round(a)} yr`;
  if (a < 1e6) return `${trim((a / 1e3).toFixed(1))} kyr`;
  if (a < 1e9) return `${trim((a / 1e6).toFixed(1))} Myr`;
  if (a < 1e12) return `${trim((a / 1e9).toFixed(2))} Gyr`;
  return `10${String(Math.floor(Math.log10(a))).split('').map((ch) => SUP[ch]).join('')} yr`;
}

// real playing time: "1:02:33"
export function clock(sec) {
  const s = Math.floor(sec % 60), m = Math.floor((sec / 60) % 60), h = Math.floor(sec / 3600);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
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
  if (s >= 86400 * 365.25 * 1000) return years(s / (86400 * 365.25));
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
