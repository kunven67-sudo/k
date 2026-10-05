// Detailed star systems, generated on demand from each system's seed.
// Planet types follow where they form: rocky worlds inside the snow line,
// giants beyond it, icy leftovers far out.
import { RNG, hash32 } from '../core/rng.js';
import { AU, M_EARTH, M_SUN, DIST_COMPRESS } from '../core/constants.js';
import { bodyRadius, equilibriumTemp, hillRadius, clamp, circularVelocity } from '../core/phys.js';

const GREEK = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function systemNormal(sys) {
  const r = new RNG(hash32(sys.seed, 3));
  const tilt = r.range(0, 0.22);
  const az = r.range(0, Math.PI * 2);
  return { x: Math.sin(tilt) * Math.cos(az), y: Math.cos(tilt), z: Math.sin(tilt) * Math.sin(az) };
}

// two unit vectors spanning the orbital plane of a system with normal n
export function planeBasis(n) {
  // pick any vector not parallel to n
  const ax = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let e1 = cross(ax, n);
  e1 = norm(e1);
  const e2 = cross(n, e1);
  return { e1, e2 };
}

function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function norm(a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function generateSystemDetail(sys) {
  const rng = new RNG(hash32(sys.seed, 101));
  const star = sys.star;
  const L = star.lum;
  const Ms = star.mass;
  const snowReal = 2.7 * Math.sqrt(L);              // real AU
  const hzIn = 0.95 * Math.sqrt(L), hzOut = 1.67 * Math.sqrt(L);
  const normal = systemNormal(sys);
  const basis = planeBasis(normal);
  const young = sys.age === 'young';

  const detail = {
    normal, basis,
    snowLine: snowReal * AU,
    hz: [hzIn * AU, hzOut * AU],
    planets: [],
    belts: [],
    disk: null,
  };

  // planets sit from just outside the star out to ~45 AU (real)
  let aReal = Math.max(rng.logRange(0.04, 0.4) * Math.sqrt(Ms / M_SUN + 0.1), (star.radius * 3.5) / AU);
  const nPlanets = star.mass > 15 * M_SUN ? rng.int(0, 2) : rng.int(young ? 3 : 1, young ? 7 : 8);
  const tempAt = (aR) => equilibriumTemp(star.temp, star.radius, aR * AU * DIST_COMPRESS, 0.3);

  for (let i = 0; i < nPlanets && aReal < 45; i++) {
    const p = makePlanet(rng, sys, i, aReal, snowReal, hzIn, hzOut, young, tempAt(aReal));
    detail.planets.push(p);
    aReal *= rng.range(1.45, 2.3);
  }

  // planet orbits (compressed distances)
  for (const p of detail.planets) {
    p.a = p.aReal * AU;
    p.omega = circularVelocity(Ms + p.mass, p.a) / p.a;
    p.phase = rng.range(0, Math.PI * 2);
    p.inc = rng.normal() * 0.02;
    p.hill = hillRadius(p.a, p.mass, Ms);
    // moons must sit well inside the (compressed) Hill sphere
    for (const m of p.moons) {
      m.a = clamp(m.aPlanetRadii * p.radius, p.radius * 2.6, p.hill * 0.35);
      m.omega = circularVelocity(p.mass + m.mass, m.a) / m.a;
      m.phase = rng.range(0, Math.PI * 2);
    }
    p.moons = p.moons.filter((m, k) => k === 0 || m.a > p.moons[k - 1].a * 1.15);
  }

  // asteroid belt between the last rocky planet and the first giant
  // (young systems still have their whole dusty disk instead)
  const firstGiant = detail.planets.find((p) => p.giant);
  if (young) {
    // no belts yet
  } else if (firstGiant && rng.chance(0.75)) {
    detail.belts.push({ kind: 'rock', inner: firstGiant.a * 0.48, outer: firstGiant.a * 0.72, thickness: 0.06, density: rng.range(0.7, 1.3) });
  } else if (rng.chance(0.3)) {
    const a = rng.logRange(1.5, 4) * Math.sqrt(L) * AU;
    detail.belts.push({ kind: 'rock', inner: a, outer: a * 1.4, thickness: 0.06, density: rng.range(0.5, 1) });
  }
  // icy Kuiper-like belt beyond the outermost planet
  const last = detail.planets[detail.planets.length - 1];
  if (last && !young && rng.chance(0.7)) {
    detail.belts.push({ kind: 'ice', inner: last.a * 1.35, outer: last.a * 2.1, thickness: 0.12, density: rng.range(0.6, 1.2) });
  }

  if (young) {
    const outer = Math.max(45 * Math.sqrt(Ms / M_SUN) * AU, last ? last.a * 1.6 : 30 * AU);
    detail.disk = {
      inner: Math.max(star.radius * 6, 0.05 * AU),
      outer,
      thickness: 0.05,
      gaps: detail.planets.filter((p) => p.mass > 5 * M_EARTH).map((p) => ({ r: p.a, w: Math.max(p.hill * 3, p.a * 0.06) })),
      seed: hash32(sys.seed, 77),
    };
  }

  return detail;
}

function makePlanet(rng, sys, index, aReal, snowReal, hzIn, hzOut, young, temp) {
  const name = `${sys.name} ${GREEK[index] || 'z'}`;
  const beyondSnow = aReal > snowReal;
  let mass, comp, giant = false, kind;
  const roll = rng.next();

  if (young) {
    // planetary embryos still growing in the disk
    if (beyondSnow && roll < 0.45) {
      mass = rng.logRange(3, 30) * M_EARTH; giant = mass > 10 * M_EARTH;
      comp = { rock: 0.25, iron: 0.08, ice: 0.47, gas: giant ? 0.2 : 0.0 };
      kind = giant ? 'icegiant' : 'icy';
    } else {
      mass = rng.logRange(0.01, 0.4) * M_EARTH;
      comp = beyondSnow ? { rock: 0.4, iron: 0.12, ice: 0.48, gas: 0 } : { rock: 0.66, iron: 0.3, ice: 0.04, gas: 0 };
      kind = beyondSnow ? 'icy' : 'rocky';
    }
  } else if (!beyondSnow) {
    if (roll < 0.05 && aReal < 0.12) {
      mass = rng.logRange(100, 1500) * M_EARTH; giant = true; kind = 'hotjupiter';
      comp = { rock: 0.03, iron: 0.01, ice: 0.04, gas: 0.92 };
    } else {
      mass = rng.logRange(0.04, 8) * M_EARTH;
      const inHZ = aReal > hzIn && aReal < hzOut;
      const water = inHZ ? rng.range(0.01, 0.12) : rng.range(0, 0.02);
      comp = { rock: 0.66 - water * 0.5, iron: rng.range(0.22, 0.38), ice: water, gas: rng.range(0, 0.004) };
      kind = 'rocky';
    }
  } else {
    if (roll < 0.55) {
      mass = rng.logRange(40, 3500) * M_EARTH; giant = true; kind = 'gasgiant';
      comp = { rock: 0.03, iron: 0.01, ice: 0.06, gas: 0.9 };
    } else if (roll < 0.82) {
      mass = rng.logRange(8, 40) * M_EARTH; giant = true; kind = 'icegiant';
      comp = { rock: 0.2, iron: 0.05, ice: 0.6, gas: 0.15 };
    } else {
      mass = rng.logRange(0.002, 0.8) * M_EARTH; kind = 'icy';
      comp = { rock: 0.42, iron: 0.1, ice: 0.48, gas: 0 };
    }
  }

  const radius = bodyRadius(mass, normalize(comp));
  const inHZ = aReal > hzIn && aReal < hzOut;
  let life = 0;
  if (kind === 'rocky' && inHZ && comp.ice > 0.03 && mass > 0.3 * M_EARTH && mass < 6 * M_EARTH) {
    const r = rng.next();
    if (r < 0.1) life = rng.chance(0.3) ? 2 : 1;
  }

  const moons = [];
  const nMoons = giant ? rng.int(1, kind === 'icegiant' ? 4 : 6) : kind === 'rocky' && mass > 0.3 * M_EARTH ? rng.int(0, 2) : 0;
  for (let k = 0; k < nMoons; k++) {
    const mm = giant ? rng.logRange(1e19, Math.min(1.5e23, mass * 2e-4)) : rng.logRange(1e18, Math.min(8e22, mass * 0.02));
    const icy = beyondSnow && rng.chance(0.75);
    const mcomp = icy ? { rock: 0.42, iron: 0.08, ice: 0.5, gas: 0 } : { rock: 0.7, iron: 0.26, ice: 0.04, gas: 0 };
    const volcanic = !icy && giant && k === 0 && rng.chance(0.5);
    moons.push({
      name: `${name} ${ROMAN[k]}`,
      mass: mm,
      comp: mcomp,
      radius: bodyRadius(mm, mcomp),
      aPlanetRadii: giant ? rng.range(4, 30) * Math.pow(1.5, k) : rng.range(8, 40),
      volcanic,
      seed: rng.int(1, 1e9),
    });
  }
  moons.sort((a, b) => a.aPlanetRadii - b.aPlanetRadii);

  const rings = giant && rng.chance(kind === 'gasgiant' ? 0.35 : 0.22)
    ? { inner: rng.range(1.25, 1.55), outer: rng.range(2.0, 2.5), opacity: rng.range(0.35, 0.95), seed: rng.int(1, 1e9) }
    : null;

  return {
    name, kind, mass, comp: normalize(comp), radius, giant, aReal, temp, life, moons, rings,
    tilt: rng.range(0, 0.5) * (rng.chance(0.08) ? 3 : 1),
    spin: rng.range(0.4, 2.5) * (giant ? 2.2 : 1),
    seed: rng.int(1, 1e9),
    inHZ,
  };
}

function normalize(c) {
  const s = c.rock + c.iron + c.ice + c.gas;
  return { rock: c.rock / s, iron: c.iron / s, ice: c.ice / s, gas: c.gas / s };
}
