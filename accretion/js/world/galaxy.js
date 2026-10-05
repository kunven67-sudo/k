// The galaxy: a barred spiral of star systems, clusters, nebulae, wandering
// black holes and a supermassive black hole at the centre.
// Only cheap summary data is made here; planets are generated on demand.
import { RNG, hash32, fbm3 } from '../core/rng.js';
import { M_SUN } from '../core/constants.js';
import { bodyRadius, starTemp, starLuminosity, blackbody, clamp } from '../core/phys.js';

export const GALAXY = {
  radius: 3.2e11,      // km, disk radius
  scaleLength: 9.6e10,
  thickness: 5e9,
  bulge: 3.4e10,
  arms: 2,
  pitch: 0.21,         // radians, log-spiral pitch
  systems: 6500,
};

const STAR_PREFIX = ['HD', 'GJ', 'LHS', 'Ross', 'TOI', 'HIP', 'Wolf', 'LP', 'Kepler', 'TYC', 'K2', 'BD'];

// Initial mass function (Kroupa-like): mostly red dwarfs, a few massive stars
export function sampleStarMass(rng) {
  const u = rng.next();
  if (u < 0.74) return rng.logRange(0.08, 0.5);
  if (u < 0.9) return rng.logRange(0.5, 1.0);
  if (u < 0.965) return rng.logRange(1.0, 2.0);
  if (u < 0.993) return rng.logRange(2.0, 8.0);
  return rng.logRange(8, 35);
}

export function armDensity(x, z) {
  const r = Math.hypot(x, z);
  if (r < 1) return 1;
  const theta = Math.atan2(z, x);
  const r0 = GALAXY.bulge * 0.9;
  let best = 0;
  for (let k = 0; k < 4; k++) {
    const major = k < 2;
    const off = (k % 2) * Math.PI + (major ? 0 : Math.PI / 2);
    const tArm = Math.log(Math.max(r, r0) / r0) / Math.tan(GALAXY.pitch) + off;
    let d = ((theta - tArm) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const w = (major ? 0.32 : 0.22) * (0.6 + 0.4 * (r / GALAXY.radius));
    const v = Math.exp(-(d * d) / (2 * w * w)) * (major ? 1 : 0.55);
    if (v > best) best = v;
  }
  // arms fade toward the centre (the bar takes over) and at the rim
  const fade = clamp((r - GALAXY.bulge * 0.7) / GALAXY.bulge, 0, 1) * clamp((GALAXY.radius * 1.05 - r) / (GALAXY.radius * 0.3), 0, 1);
  return best * fade;
}

// Overall stellar density (unnormalised) at a point in the plane
export function diskDensity(x, z) {
  const r = Math.hypot(x, z);
  const disk = Math.exp(-r / GALAXY.scaleLength);
  const bulge = 2.4 * Math.exp(-Math.pow(r / GALAXY.bulge, 1.4));
  // bar along the x axis, rotated a little
  const c = Math.cos(0.45), s = Math.sin(0.45);
  const bx = x * c + z * s, bz = -x * s + z * c;
  const bar = 1.4 * Math.exp(-Math.pow(bx / (GALAXY.bulge * 2.3), 2) - Math.pow(bz / (GALAXY.bulge * 0.55), 2));
  return disk * (0.35 + 1.4 * armDensity(x, z)) + bulge + bar;
}

export function starName(rng) {
  const p = rng.pick(STAR_PREFIX);
  if (p === 'TYC') return `TYC ${rng.int(1000, 9999)}-${rng.int(100, 2999)}-1`;
  if (p === 'BD') return `BD${rng.sign() > 0 ? '+' : '-'}${rng.int(10, 79)} ${rng.int(100, 4999)}`;
  if (p === 'TOI' || p === 'K2' || p === 'Kepler') return `${p}-${rng.int(10, 4999)}`;
  if (p === 'LP') return `LP ${rng.int(100, 999)}-${rng.int(10, 99)}`;
  return `${p} ${rng.int(10, p === 'HD' || p === 'HIP' ? 229999 : 4999)}`;
}

function bhName(rng) {
  const ra = `${String(rng.int(0, 23)).padStart(2, '0')}${String(rng.int(0, 59)).padStart(2, '0')}`;
  const dec = `${rng.sign() > 0 ? '+' : '-'}${String(rng.int(0, 89)).padStart(2, '0')}${rng.int(0, 9)}`;
  return `${rng.pick(['XTE J', 'Swift J', 'MAXI J', 'GRS ', 'GRO J'])}${ra}${dec}`;
}

export function makeStarSummary(rng, mass, extra = {}) {
  const m = mass * M_SUN;
  const comp = { rock: 0.01, iron: 0.005, ice: 0.015, gas: 0.97 };
  const radius = bodyRadius(m, comp);
  const temp = starTemp(m);
  const lum = starLuminosity(m, radius);
  return { mass: m, radius, temp, lum, color: blackbody(temp), ...extra };
}

export class Galaxy {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.rng = new RNG(hash32(this.seed, 1));
    this.systems = [];
    this.nebulae = [];
    this.blackHoles = [];
    this.clusters = [];
    this.generate();
  }

  generate() {
    const rng = this.rng;
    const R = GALAXY.radius;

    // open clusters first, so some systems can be placed in them
    for (let i = 0; i < 46; i++) {
      const p = this.samplePoint(rng, true);
      this.clusters.push({ id: i, x: p.x, y: p.y, z: p.z, r: rng.range(1.2e9, 3e9), count: rng.int(12, 30), globular: false });
    }
    // globular clusters in the halo
    for (let i = 0; i < 8; i++) {
      const d = rng.range(0.25, 0.8) * R;
      const v = rng.unitVector();
      this.clusters.push({ id: 100 + i, x: v.x * d, y: v.y * d * 0.6, z: v.z * d, r: rng.range(2e9, 4e9), count: rng.int(60, 100), globular: true });
    }

    let id = 0;
    const addSystem = (x, y, z, opts = {}) => {
      const srng = new RNG(hash32(this.seed, 7, id));
      const mass = opts.mass ?? sampleStarMass(srng);
      const star = makeStarSummary(srng, mass);
      const ageRoll = srng.next();
      let age = opts.age ?? (ageRoll < 0.06 ? 'young' : ageRoll < 0.9 ? 'mature' : 'old');
      if (mass > 8 && !opts.age) age = srng.chance(0.4) ? 'old' : 'mature';
      const sys = {
        id,
        seed: hash32(this.seed, 11, id),
        x, y, z,
        name: starName(srng),
        star,
        age,
        cluster: opts.cluster ?? -1,
        snCandidate: mass >= 8 && age === 'old',
        state: null,    // filled in once the player has changed it (eaten bodies, supernova...)
      };
      this.systems.push(sys);
      id++;
      return sys;
    };

    for (const c of this.clusters) {
      const crng = new RNG(hash32(this.seed, 21, c.id));
      for (let k = 0; k < c.count; k++) {
        const v = crng.unitVector();
        const d = c.r * Math.pow(crng.next(), 0.6);
        addSystem(c.x + v.x * d, c.y + v.y * d * (c.globular ? 1 : 0.5), c.z + v.z * d, {
          cluster: c.id,
          age: c.globular ? 'old' : (crng.chance(0.25) ? 'young' : 'mature'),
          mass: c.globular ? crng.logRange(0.1, 0.85) : undefined,
        });
      }
    }

    while (this.systems.length < GALAXY.systems) {
      const p = this.samplePoint(rng, false);
      addSystem(p.x, p.y, p.z);
    }

    // a dense swarm of stars around the central black hole
    for (let k = 0; k < 160; k++) {
      const v = rng.unitVector();
      const d = rng.logRange(6e8, 1.6e10);
      addSystem(v.x * d, v.y * d * 0.7, v.z * d, { age: 'old', mass: rng.logRange(0.3, 12) });
    }

    // giant molecular clouds and glowing nebulae along the arms
    for (let i = 0; i < 64; i++) {
      const p = this.samplePoint(rng, true);
      const massSun = rng.logRange(3e3, 4e5);
      this.nebulae.push({
        id: i,
        x: p.x, y: p.y * 0.4, z: p.z,
        r: 3.5e9 * Math.pow(massSun / 1e4, 0.4) * rng.range(0.7, 1.3),
        mass: massSun * M_SUN,
        massLeft: 1,
        seed: hash32(this.seed, 31, i),
        hue: rng.next(),
        emission: rng.range(0.35, 1),
      });
    }

    // wandering stellar black holes
    for (let i = 0; i < 34; i++) {
      const p = this.samplePoint(rng, false);
      const v = rng.unitVector();
      const sp = rng.range(20, 90);
      this.blackHoles.push({
        id: i,
        name: bhName(rng),
        x: p.x, y: p.y, z: p.z,
        vx: v.x * sp, vy: v.y * sp * 0.3, vz: v.z * sp,
        mass: rng.logRange(5, 60) * M_SUN,
        alive: true,
      });
    }

    // the central supermassive black hole
    this.core = { name: 'Galactic core', mass: 4.1e6 * M_SUN, x: 0, y: 0, z: 0, alive: true };

    this.pickStartSystem();
  }

  samplePoint(rng, armsOnly) {
    const R = GALAXY.radius;
    for (let tries = 0; tries < 400; tries++) {
      const r = R * Math.sqrt(rng.next()) * 1.05;
      const t = rng.range(0, Math.PI * 2);
      const x = r * Math.cos(t), z = r * Math.sin(t);
      const dens = armsOnly ? armDensity(x, z) : diskDensity(x, z) / 3.2;
      if (rng.next() < dens) {
        const h = GALAXY.thickness * (0.4 + 1.6 * Math.exp(-r / GALAXY.bulge));
        return { x, y: rng.normal() * h * 0.5, z };
      }
    }
    return { x: rng.range(-R, R) * 0.5, y: 0, z: rng.range(-R, R) * 0.5 };
  }

  pickStartSystem() {
    // a young Sun-like star with a dusty disk, about 60% of the way out, in an arm
    const rng = new RNG(hash32(this.seed, 41));
    let best = null, bestScore = -1;
    for (let i = 0; i < 600; i++) {
      const s = this.systems[rng.int(0, this.systems.length - 1)];
      const r = Math.hypot(s.x, s.z);
      const score = armDensity(s.x, s.z) - Math.abs(r / GALAXY.radius - 0.58) * 3 + (s.cluster >= 0 ? -1 : 0);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    best.age = 'young';
    best.star = makeStarSummary(rng, 0.92);
    best.star.radius *= 1.6; // young stars are puffed up while still contracting
    best.snCandidate = false;
    best.isStart = true;
    this.startSystem = best;
  }

  // young systems where a reborn player can restart, near a given point
  findRebirthSystem(x, y, z, rng) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < 400; i++) {
      const s = this.systems[rng.int(0, this.systems.length - 1)];
      if (s.state?.destroyed || s.star.mass > 3 * M_SUN) continue;
      const d = Math.hypot(s.x - x, s.y - y, s.z - z) * rng.range(0.6, 1.4);
      if (d > 4e9 && d < bestD) { bestD = d; best = s; }
    }
    return best || this.startSystem;
  }

  // grid index for fast nearest-system lookups
  buildIndex() {
    this.cell = 8e9;
    this.grid = new Map();
    for (const s of this.systems) {
      const k = this.key(s.x, s.y, s.z);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(s);
    }
  }

  key(x, y, z) {
    const c = this.cell;
    return `${Math.floor(x / c)},${Math.floor(y / c)},${Math.floor(z / c)}`;
  }

  systemsNear(x, y, z, radius, out = []) {
    if (!this.grid) this.buildIndex();
    const c = this.cell;
    const n = Math.ceil(radius / c);
    const cx = Math.floor(x / c), cy = Math.floor(y / c), cz = Math.floor(z / c);
    const r2 = radius * radius;
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        for (let k = -n; k <= n; k++) {
          const list = this.grid.get(`${cx + i},${cy + j},${cz + k}`);
          if (!list) continue;
          for (const s of list) {
            const dx = s.x - x, dy = s.y - y, dz = s.z - z;
            if (dx * dx + dy * dy + dz * dz < r2) out.push(s);
          }
        }
      }
    }
    return out;
  }

  // How crowded is space here? Used to set the local debris density.
  environment(x, y, z) {
    const dens = diskDensity(x, z) * Math.exp(-Math.abs(y) / (GALAXY.thickness * 2));
    return clamp(dens / 1.2, 0.05, 2);
  }
}

// Haze colour of the galaxy band at a point (used for the sky)
export function hazeColor(x, z, rng) {
  const r = Math.hypot(x, z) / GALAXY.radius;
  const arm = armDensity(x, z);
  const n = fbm3(x / 1.5e10, 0, z / 1.5e10, 3, 5);
  // old yellow light in the middle, young blue-white light in the arms
  const warm = [1.0, 0.78, 0.55];
  const cool = [0.62, 0.74, 1.0];
  const t = clamp(arm * 1.2 + r * 0.4 - 0.25, 0, 1);
  const c = warm.map((w, i) => w + (cool[i] - w) * t);
  const dust = clamp(n * 1.6 - 0.45, 0, 1) * clamp(arm * 2, 0, 1);
  return { color: c, dust };
}
