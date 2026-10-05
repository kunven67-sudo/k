// A Milky Way-sized barred spiral galaxy, 100,000 light-years across, with
// about a hundred billion stars. Stars are generated on demand, cell by cell,
// from the galaxy's density, so the same star is always in the same place.
// Stars age with the galaxy's clock: they swell, die, and new ones are born.
import { RNG, hash32 } from '../core/rng.js';
import { M_SUN } from '../core/constants.js';
import { clamp, blackbody } from '../core/phys.js';
import { stellarState, imfInverse } from './stellar.js';

export const LY = 9.4607e12;     // km
export const GU = 1e10;           // km; the floating origin moves in whole multiples of this
export const CELL_GU = 23650;     // star cell edge in GU (about 25 light-years)
export const CELL_KM = CELL_GU * GU;
export const CELL_LY = CELL_KM / LY;

export const GALAXY = {
  radius: 50000,        // ly
  sunR: 26000,          // where a Sun-like star sits
  Rd: 8500,             // disk scale length
  zd: 900,              // thin disk scale height
  zThick: 3000,
  Rb: 1300,             // bulge scale
  barLen: 13000,
  barWid: 3500,
  rho0: 0.004,          // stars per cubic light-year near the Sun
  pitch: 0.21,          // spiral arm pitch angle (radians)
  armStart: 5500,
  ageDisk: 10e9,        // years of star formation in the disk
  ageBulge: 11.5e9,
};

const PREFIX = ['HD', 'GJ', 'LHS', 'Ross', 'TOI', 'HIP', 'Wolf', 'LP', 'Kepler', 'TYC', 'K2', 'BD', 'Gaia DR3', 'TIC'];

export function armDensity(x, z) {
  const r = Math.hypot(x, z);
  if (r < 1) return 0;
  const theta = Math.atan2(z, x);
  const r0 = GALAXY.armStart;
  let best = 0;
  for (let k = 0; k < 4; k++) {
    const major = k < 2;
    const off = (k % 2) * Math.PI + (major ? 0 : Math.PI / 2);
    const tArm = Math.log(Math.max(r, r0) / r0) / Math.tan(GALAXY.pitch) + off;
    const d = ((theta - tArm) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const w = (major ? 0.3 : 0.2) * (0.6 + 0.4 * (r / GALAXY.radius));
    const v = Math.exp(-(d * d) / (2 * w * w)) * (major ? 1 : 0.55);
    if (v > best) best = v;
  }
  const fade = clamp((r - r0 * 0.8) / (r0 * 0.6), 0, 1) * clamp((GALAXY.radius * 1.05 - r) / (GALAXY.radius * 0.3), 0, 1);
  return best * fade;
}

// stars per cubic light-year at a point (galaxy frame, light-years)
export function stellarDensity(x, y, z, merged = 0) {
  const G = GALAXY;
  const r = Math.hypot(x, z);
  const arm = armDensity(x, z) * (1 - merged);
  const thin = Math.exp(-(r - G.sunR) / G.Rd) * Math.exp(-Math.abs(y) / G.zd);
  const thick = 0.12 * Math.exp(-(r - G.sunR) / (G.Rd * 1.2)) * Math.exp(-Math.abs(y) / G.zThick);
  const disk = G.rho0 * ((0.55 + 0.9 * arm) * thin + thick) * (1 - merged * 0.5);
  const rs = Math.hypot(x, y * 1.4, z);
  const bulge = 1.4 * Math.exp(-Math.pow(rs / G.Rb, 1.1)) * (1 + merged * 2);
  const c = Math.cos(0.45), s = Math.sin(0.45);
  const bx = x * c + z * s, bz = -x * s + z * c;
  const bar = 0.06 * Math.exp(-Math.pow(bx / G.barLen, 2) - Math.pow(bz / G.barWid, 2) - Math.pow(y / 1200, 2)) * (1 - merged);
  const halo = 2e-5 * Math.pow(1 + rs / 3000, -3);
  // after Andromeda merges, a big round glow of stars (an elliptical galaxy)
  const ell = merged * 0.02 * Math.pow(1 + rs / 9000, -3);
  return disk + bulge + bar + halo + ell;
}

// fraction of recently born stars at a point: arms form stars
export function youngFraction(x, y, z) {
  return clamp(0.02 + 0.12 * armDensity(x, z) * Math.exp(-Math.abs(y) / 600), 0, 0.3);
}

export function starName(rng) {
  const p = rng.pick(PREFIX);
  if (p === 'TYC') return `TYC ${rng.int(1000, 9999)}-${rng.int(100, 2999)}-1`;
  if (p === 'BD') return `BD${rng.sign() > 0 ? '+' : '-'}${rng.int(10, 79)} ${rng.int(100, 4999)}`;
  if (p === 'TOI' || p === 'K2' || p === 'Kepler') return `${p}-${rng.int(10, 4999)}`;
  if (p === 'LP') return `LP ${rng.int(100, 999)}-${rng.int(10, 99)}`;
  if (p === 'Gaia DR3') return `Gaia DR3 ${rng.int(1e5, 9e5)}${rng.int(1e5, 9e5)}`;
  if (p === 'TIC') return `TIC ${rng.int(1e6, 4e8)}`;
  return `${p} ${rng.int(10, p === 'HD' || p === 'HIP' ? 229999 : 4999)}`;
}

function poisson(rng, lam) {
  if (lam < 30) {
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    do { k++; p *= rng.next(); } while (p > L);
    return k - 1;
  }
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * rng.normal()));
}

export class Galaxy {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.cells = new Map();
    this.cellOrder = [];
    this.state = new Map();      // changes you made: id -> { eaten: [...], starEaten, remnant, ... }
    this.landmarks = [];         // special stars (your birth star, rebirth stars, newborn stars)
    this.time = 0;               // galaxy clock, years since the game began
    this.merged = 0;             // 0..1 progress of the Andromeda merger
    this.core = { id: 'core', name: 'Sagittarius A*', mass: 4.15e6 * M_SUN, alive: true };
    this.andromeda = { name: 'Andromeda', mass: 1.4e8 * M_SUN, alive: true };
    this.makeHome();
  }

  // ---------------------------------------------------------------- positions

  // galaxy-frame light-years of a point given in cell + km offset
  static lyOf(ci, cj, ck, ox, oy, oz) {
    return [(ci * CELL_KM + ox) / LY, (cj * CELL_KM + oy) / LY, (ck * CELL_KM + oz) / LY];
  }

  // where a cell-based point sits relative to the floating origin (in km, exact)
  static localOf(rec, O) {
    return {
      x: (rec.ci * CELL_GU - O.x) * GU + rec.ox,
      y: (rec.cj * CELL_GU - O.y) * GU + rec.oy,
      z: (rec.ck * CELL_GU - O.z) * GU + rec.oz,
    };
  }

  // a galaxy light-year position split into cell + offset
  static cellPoint(xLy, yLy, zLy) {
    const split = (v) => {
      const km = v * LY;
      const c = Math.floor(km / CELL_KM);
      return [c, km - c * CELL_KM];
    };
    const [ci, ox] = split(xLy), [cj, oy] = split(yLy), [ck, oz] = split(zLy);
    return { ci, cj, ck, ox, oy, oz };
  }

  // ---------------------------------------------------------------- cells

  cellKey(i, j, k) {
    return `${i},${j},${k}`;
  }

  // Stars in one cell, brightest first. The same cell always gives the same stars.
  // minMass lets far cells skip their many dim stars.
  cellStars(i, j, k, minMass = 0.08, maxCount = 4000) {
    const key = this.cellKey(i, j, k);
    const c = this.cells.get(key);
    if (c && (c.complete || c.minMass <= minMass) && c.maxCount >= maxCount) return c.stars;
    const cx = (i + 0.5) * CELL_LY, cy = (j + 0.5) * CELL_LY, cz = (k + 0.5) * CELL_LY;
    const rho = stellarDensity(cx, cy, cz, this.merged);
    const lam = rho * CELL_LY * CELL_LY * CELL_LY;
    const h = hash32(hash32(this.seed, i), j, k);
    const rng = new RNG(h);
    const N = poisson(rng, lam);
    const young = youngFraction(cx, cy, cz);
    const bulge = Math.exp(-Math.hypot(cx, cy, cz) / 4000);
    const stars = [];
    // masses in descending order (order statistics), so the brightest come first
    let cdf = 1;
    let complete = true;
    for (let n = 0; n < N; n++) {
      if (stars.length >= maxCount) { complete = false; break; }
      cdf *= Math.pow(rng.next(), 1 / (N - n));
      const m = imfInverse(cdf);
      if (m < minMass) { complete = false; break; }
      const sr = new RNG(hash32(h, n + 1));
      const rec = {
        id: `${key}#${n}`,
        ci: i, cj: j, ck: k,
        ox: sr.next() * CELL_KM, oy: sr.next() * CELL_KM, oz: sr.next() * CELL_KM,
        m0: m,
        seed: hash32(h, n + 1, 7),
        // birth time (years, negative = before the game began)
        tb: sr.chance(young * (1 - bulge)) ? -sr.range(0, 1.2e8) : -(sr.range(0.15, 1) * (bulge > 0.3 ? GALAXY.ageBulge : GALAXY.ageDisk)),
        binary: sr.chance(m > 1 ? 0.5 : 0.3) ? { q: sr.range(0.1, 1), sepAU: sr.logRange(0.2, 40) } : null,
      };
      // a few stars will only be born in this galaxy's future
      if (sr.chance(0.04 * (0.3 + armDensity(cx, cz)))) rec.tb = sr.range(0, 2e10) * sr.next();
      const [x, y, z] = Galaxy.lyOf(i, j, k, rec.ox, rec.oy, rec.oz);
      rec.x = x; rec.y = y; rec.z = z;
      stars.push(rec);
    }
    this.cells.set(key, { stars, minMass, maxCount, total: N, complete });
    this.cellOrder.push(key);
    if (this.cellOrder.length > 14000) {
      const drop = this.cellOrder.splice(0, 4000);
      for (const d of drop) this.cells.delete(d);
    }
    return stars;
  }

  // every star (generated or landmark) within radiusKm of a local position
  starsNear(local, O, radiusKm, minMassFn = null, maxPerCell = 4000) {
    const out = [];
    const gx = O.x * GU + local.x, gy = O.y * GU + local.y, gz = O.z * GU + local.z;
    const ci = Math.floor(gx / CELL_KM), cj = Math.floor(gy / CELL_KM), ck = Math.floor(gz / CELL_KM);
    const n = Math.ceil(radiusKm / CELL_KM);
    const r2 = radiusKm * radiusKm;
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (let c = -n; c <= n; c++) {
      const dist = Math.max(0, Math.hypot(a, b, c) - 1.8) * CELL_KM;
      if (dist > radiusKm) continue;
      const minM = minMassFn ? minMassFn(dist) : 0.08;
      if (minM > 60) continue;
      for (const s of this.cellStars(ci + a, cj + b, ck + c, minM, maxPerCell)) {
        if (s.m0 < minM) break;
        if (this.isHidden(s)) continue;
        const p = Galaxy.localOf(s, O);
        const d2 = (p.x - local.x) ** 2 + (p.y - local.y) ** 2 + (p.z - local.z) ** 2;
        if (d2 < r2) out.push({ rec: s, x: p.x, y: p.y, z: p.z, d: Math.sqrt(d2) });
      }
    }
    for (const s of this.landmarks) {
      const p = Galaxy.localOf(s, O);
      const d = Math.hypot(p.x - local.x, p.y - local.y, p.z - local.z);
      if (d < radiusKm) out.push({ rec: s, x: p.x, y: p.y, z: p.z, d });
    }
    return out;
  }

  // generated stars too close to a landmark are skipped so systems never overlap
  isHidden(s) {
    if (s.landmark) return false;
    for (const l of this.landmarks) {
      if (Math.abs(l.x - s.x) < 0.6 && Math.abs(l.y - s.y) < 0.6 && Math.abs(l.z - s.z) < 0.6) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- star state

  // what this star looks like right now (or null if not born yet / gone)
  starNow(rec) {
    const st = this.state.get(rec.id);
    if (st && (st.starEaten || st.destroyed)) return null;
    const age = this.time - rec.tb;
    let s = stellarState(rec.m0, age);
    if (!s) return null;
    if (st && st.remnant) {
      const bh = st.remnant.compact === 'bh';
      s = { ...s, phase: bh ? 'bh' : 'ns', mass: st.remnant.mass / M_SUN, radius: bh ? 0 : 12, temp: bh ? 0 : 1e6, lum: bh ? 0 : 0.0005 };
    }
    s.age = age;
    s.young = age < 5e7;
    return s;
  }

  nameOf(rec) {
    if (rec.name) return rec.name;
    return starName(new RNG(rec.seed));
  }

  stateOf(id) {
    let s = this.state.get(id);
    if (!s) { s = {}; this.state.set(id, s); }
    return s;
  }

  // ---------------------------------------------------------------- landmarks

  makeHome() {
    // a young Sun-like star in a spiral arm, about as far out as the Sun
    const rng = new RNG(hash32(this.seed, 41));
    let best = null, bestScore = -Infinity;
    for (let t = 0; t < 2000; t++) {
      const a = rng.range(0, Math.PI * 2);
      const r = GALAXY.sunR * rng.range(0.92, 1.08);
      const x = r * Math.cos(a), z = r * Math.sin(a);
      const score = armDensity(x, z);
      if (score > bestScore) { bestScore = score; best = [x, rng.range(-30, 30), z]; }
    }
    this.home = this.addLandmark(best[0], best[1], best[2], {
      id: 'home', m0: 0.95, tb: -1.5e6, seed: hash32(this.seed, 42), isStart: true,
    });
  }

  addLandmark(xLy, yLy, zLy, props) {
    const cp = Galaxy.cellPoint(xLy, yLy, zLy);
    const rec = { ...cp, x: xLy, y: yLy, z: zLy, binary: null, landmark: true, ...props };
    if (!rec.seed) rec.seed = hash32(this.seed, this.landmarks.length + 100);
    this.landmarks.push(rec);
    return rec;
  }

  // newborn stars in a collapsing cloud, or somewhere to be reborn
  addNewborn(xLy, yLy, zLy, rng, m0 = null) {
    return this.addLandmark(xLy, yLy, zLy, {
      id: `born-${this.landmarks.length}-${rng.int(0, 1e9)}`,
      m0: m0 ?? clamp(imfInverse(rng.range(0.55, 0.995)), 0.3, 6),
      tb: this.time - rng.range(2e5, 3e6),
      seed: rng.int(1, 1e9),
    });
  }

  // ---------------------------------------------------------------- big things

  // giant molecular clouds near a galaxy point (light-years)
  nebulaeNear(xLy, yLy, zLy, radiusLy) {
    const BC = 3000;
    const out = [];
    const n = Math.ceil(radiusLy / BC);
    const bi = Math.floor(xLy / BC), bj = Math.floor(yLy / BC), bk = Math.floor(zLy / BC);
    for (let a = -n; a <= n; a++) for (let b = -1; b <= 1; b++) for (let c = -n; c <= n; c++) {
      for (const nb of this.nebulaCell(bi + a, bj + b, bk + c)) {
        const d = Math.hypot(nb.x - xLy, nb.y - yLy, nb.z - zLy);
        if (d < radiusLy + nb.r) out.push(Object.assign(nb, { d }));
      }
    }
    return out;
  }

  nebulaCell(i, j, k) {
    const key = `n${i},${j},${k}`;
    const c = this.cells.get(key);
    if (c) return c.stars;
    const BC = 3000;
    const cx = (i + 0.5) * BC, cy = (j + 0.5) * BC, cz = (k + 0.5) * BC;
    const rng = new RNG(hash32(hash32(this.seed, 9001 + i), j, k));
    const lam = (armDensity(cx, cz) * 6 + 0.3) * Math.exp(-Math.abs(cy) / 400) * Math.exp(-Math.hypot(cx, cz) / 20000) * (1 - this.merged * 0.8);
    const n = poisson(rng, lam);
    const list = [];
    for (let q = 0; q < n; q++) {
      const massSun = rng.logRange(5e3, 1e6);
      const id = `${key}#${q}`;
      const st = this.state.get(id);
      list.push({
        id, x: cx + rng.range(-0.5, 0.5) * BC, y: rng.normal() * 120, z: cz + rng.range(-0.5, 0.5) * BC,
        r: 25 * Math.pow(massSun / 1e4, 0.45) * rng.range(0.7, 1.3),
        mass: massSun * M_SUN, massLeft: st?.massLeft ?? 1, seed: rng.int(1, 1e9), emission: rng.range(0.35, 1), hue: rng.next(),
        births: st?.births || 0,
      });
    }
    this.cells.set(key, { stars: list });
    return list;
  }

  // the Andromeda galaxy: 2.5 million light-years away, falling toward us
  andromedaPos(tYears = this.time) {
    const dir = [0.58, 0.32, -0.75];
    const l = Math.hypot(...dir);
    const firstPass = 4.5e9, merge = 6.0e9;
    let d;
    if (tYears < firstPass) d = 2.5e6 * Math.pow(Math.max(0, 1 - tYears / firstPass), 0.66) + 20000;
    else d = 20000 * Math.max(0, 1 - (tYears - firstPass) / (merge - firstPass));
    return [(dir[0] / l) * d, (dir[1] / l) * d, (dir[2] / l) * d, d];
  }

  advance(years) {
    this.time += years;
    const m = clamp((this.time - 4.5e9) / 1.5e9, 0, 1);
    if (Math.abs(m - this.merged) > 0.02 || (m === 1 && this.merged !== 1)) {
      this.merged = m;
      // the shape changed: forget cached star cells so they regenerate
      for (const key of [...this.cells.keys()]) if (!key.startsWith('n')) this.cells.delete(key);
      this.cellOrder = [];
    }
  }

  // ---------------------------------------------------------------- sampling for the sky

  samplePoint(rng, armsOnly = false) {
    const R = GALAXY.radius;
    for (let tries = 0; tries < 400; tries++) {
      const r = R * Math.sqrt(rng.next()) * 1.05;
      const t = rng.range(0, Math.PI * 2);
      const x = r * Math.cos(t), z = r * Math.sin(t);
      const dens = armsOnly ? armDensity(x, z) : this.planeDensity(x, z) / 3.5;
      if (rng.next() < dens) {
        const h = (armsOnly ? 300 : GALAXY.zd) * (0.6 + 2.2 * Math.exp(-r / (GALAXY.Rb * 3)));
        return [x, rng.normal() * h, z];
      }
    }
    return [0, 0, 0];
  }

  // relative surface density of the disk seen face-on (for sampling)
  planeDensity(x, z) {
    const r = Math.hypot(x, z);
    const disk = Math.exp(-r / GALAXY.Rd) * (0.45 + 1.3 * armDensity(x, z) * (1 - this.merged));
    const bulge = 2.6 * Math.exp(-Math.pow(r / (GALAXY.Rb * 2.4), 1.2));
    const c = Math.cos(0.45), s = Math.sin(0.45);
    const bx = x * c + z * s, bz = -x * s + z * c;
    const bar = 1.3 * Math.exp(-Math.pow(bx / GALAXY.barLen, 2) - Math.pow(bz / GALAXY.barWid, 2)) * (1 - this.merged);
    return disk + bulge + bar;
  }

  // ---------------------------------------------------------------- rebirth

  // somewhere young to re-form: a newborn star in a spiral arm near where you died
  rebirthSpot(xLy, yLy, zLy, rng) {
    let x = xLy, y = yLy, z = zLy;
    for (let t = 0; t < 400; t++) {
      const a = Math.atan2(zLy, xLy) + rng.range(-0.15, 0.15);
      const r = Math.max(4000, Math.hypot(xLy, zLy) + rng.range(-2500, 2500));
      const cx = r * Math.cos(a), cz = r * Math.sin(a);
      if (rng.next() < armDensity(cx, cz)) { x = cx; z = cz; y = rng.range(-40, 40); break; }
    }
    return this.addNewborn(x, y, z, rng, rng.range(0.75, 1.25));
  }

  // ---------------------------------------------------------------- save

  serialize() {
    return {
      seed: this.seed,
      time: this.time,
      state: [...this.state.entries()].filter(([, v]) => Object.keys(v).length),
      landmarks: this.landmarks.filter((l) => l.id !== 'home').map((l) => ({ id: l.id, x: l.x, y: l.y, z: l.z, m0: l.m0, tb: l.tb, seed: l.seed })),
      core: this.core.alive ? 1 : 0,
      coreMass: this.core.mass,
      andromeda: this.andromeda.alive ? 1 : 0,
    };
  }

  restore(d) {
    this.time = 0;
    this.advance(d.time || 0);
    for (const [id, v] of d.state || []) this.state.set(id, v);
    for (const l of d.landmarks || []) this.addLandmark(l.x, l.y, l.z, l);
    this.core.alive = d.core !== 0;
    if (d.coreMass) this.core.mass = d.coreMass;
    this.andromeda.alive = d.andromeda !== 0;
  }
}

export function starColor(st) {
  return st.phase === 'bh' ? [0, 0, 0] : blackbody(st.temp);
}
