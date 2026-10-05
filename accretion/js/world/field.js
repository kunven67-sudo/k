// The local field: bodies that spawn around you, scaled to your size.
// Real disks and belts have objects at every size (a power law), so whatever
// size you are, there are things a bit smaller (food) and a few bigger (danger).
import { Body } from './body.js';
import { stellarDensity, LY } from './galaxy.js';
import { RNG } from '../core/rng.js';
import { M_SUN, M_EARTH, M_JUP, DIST_COMPRESS, TIME_BASE } from '../core/constants.js';
import { clamp, equilibriumTemp, escapeVelocity } from '../core/phys.js';

const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXY';

export class Field {
  constructor(world) {
    this.world = world;
    this.rng = new RNG((Math.random() * 1e9) | 0);
    this.env = { kind: 'interstellar', density: 0.3 };
    this.envTimer = 0;
    this.year = 2026;
    this.serial = 1;
  }

  bodies() {
    return this.world.bodies.filter((b) => b.alive && b.role === 'field');
  }

  updateEnv() {
    const w = this.world, p = w.player;
    const [lx, ly, lz] = w.toLy(p.x, p.y, p.z);
    const starDens = stellarDensity(lx, ly, lz, w.galaxy.merged);
    const env = { kind: 'interstellar', density: 0.18 + 0.25 * Math.min(1, starDens / 0.01), sys: null, snow: 3, normal: null, label: 'Interstellar space' };
    // the Oort cloud: a huge shell of icy comets around every star, out to about a light-year
    for (const e of w.active.values()) {
      const d = Math.hypot(e.pos.x - p.x, e.pos.y - p.y, e.pos.z - p.z);
      if (d < 1.2 * LY && d > e.extent * 3) {
        env.kind = 'oort';
        env.density = 0.45;
        env.label = `Oort cloud of ${e.name}`;
      }
    }
    let bestEntry = null, bestD = Infinity;
    for (const e of w.active.values()) {
      if (!e.star || !e.star.alive) continue;
      const d = p.distTo(e.star);
      if (d < e.extent * 1.4 && d < bestD) { bestD = d; bestEntry = e; }
    }
    if (bestEntry) {
      const e = bestEntry, det = e.detail, s = e.star;
      const n = det.normal;
      const rx = p.x - s.x, ry = p.y - s.y, rz = p.z - s.z;
      const h = rx * n.x + ry * n.y + rz * n.z;
      const rr = Math.sqrt(Math.max(0, rx * rx + ry * ry + rz * rz - h * h));
      env.sys = e;
      env.normal = n;
      env.snow = rr / det.snowLine;
      env.kind = 'interplanetary';
      env.density = 0.6;
      env.label = `${e.sys.name} system`;
      if (det.disk && rr > det.disk.inner && rr < det.disk.outer && Math.abs(h) < rr * det.disk.thickness * 3) {
        let gap = 1;
        for (const g of det.disk.gaps) if (Math.abs(rr - g.r) < g.w) gap = 0.35;
        // a giant clears its own gap and starves itself of gas
        const own = w.stages?.gap;
        if (own && own.entry === e && p.mass > 30 * M_EARTH) gap = Math.min(gap, 0.45);
        env.kind = 'disk';
        env.density = 1.75 * gap * (1 - 0.5 * clamp(rr / det.disk.outer, 0, 1));
        env.label = gap < 1 ? 'Gap in the dust disk' : 'Protoplanetary disk';
      }
      for (const b of det.belts) {
        if (rr > b.inner && rr < b.outer && Math.abs(h) < rr * b.thickness * 2.5) {
          env.kind = 'belt';
          env.density = Math.max(env.density, 1.25 * b.density);
          env.label = b.kind === 'ice' ? 'Icy outer belt' : 'Asteroid belt';
        }
      }
      for (const pl of e.planets) {
        if (!pl.alive) continue;
        if (p.distTo(pl) < Math.max(pl.radius * 40, (pl.rails?.hill || 0) * 0.5)) {
          env.kind = 'planetary';
          env.density = Math.max(env.density, pl.rings ? 1.2 : 0.85);
          env.label = `Near ${pl.name}`;
        }
      }
    }
    for (const nb of w.galaxy.nebulaeNear(lx, ly, lz, 400)) {
      if (nb.massLeft <= 0.02) continue;
      if (Math.hypot(lx - nb.x, ly - nb.y, lz - nb.z) < nb.r) {
        env.kind = 'nebula';
        env.density = Math.max(env.density, 1.2);
        env.label = 'Inside a molecular cloud';
        env.nebula = nb;
      }
    }
    if (Math.hypot(lx, ly, lz) < 1500) {
      env.kind = 'core';
      env.density = Math.max(env.density, 1.5);
      env.label = 'Galactic core';
    }
    this.env = env;
  }

  targetCount() {
    const w = this.world;
    if (w.warp >= 100) return 0;
    const base = w.quality === 'low' ? 150 : w.quality === 'high' ? 300 : 230;
    // stars are huge and blinding: at stellar sizes space holds far fewer of them
    const p = w.player;
    const stellar = p && p.compact ? 0.16 : p && (p.isStar || p.mass > 1e28) ? 0.26 : 1;
    return Math.round(clamp(base * this.env.density * stellar, 24, 420));
  }

  update(rs, fill = false) {
    const w = this.world, p = w.player;
    if (!p || !p.alive) return;
    this.envTimer -= rs;
    if (this.envTimer <= 0 || fill) { this.updateEnv(); this.envTimer = 0.5; }
    const R = p.rEff;
    const list = this.bodies();
    let dangers = 0;
    // despawn things far behind or far too small to matter
    for (const b of list) {
      const d = p.distTo(b);
      const tooSmall = b.mass < p.mass * 4e-5 && d > R * 6;
      if (d > R * 95 || tooSmall || (w.warp >= 100 && !b.moonOf)) {
        b.fadeOut = true;
      }
      if (b.fadeOut) {
        b.fadeIn -= rs * 2;
        if (b.fadeIn <= 0) w.removeBody(b);
        continue;
      }
      if (b.mass > p.mass) dangers++;
    }
    let count = list.filter((b) => !b.fadeOut).length;
    const target = this.targetCount();
    let budget = fill ? 500 : 8;
    const maxDangers = this.env.kind === 'interstellar' ? 1 : 3;
    while (count < target && budget-- > 0) {
      const b = this.spawnOne(fill ? 9 : 26, 70, dangers < maxDangers);
      if (b && b.mass > p.mass) dangers++;
      count++;
    }
    this.dangers = dangers;
  }

  spawnOne(rMinR, rMaxR, allowDanger) {
    const w = this.world, p = w.player, rng = this.rng, env = this.env;
    const R = p.rEff;
    // which way to put it: biased toward where we're heading
    const fr = w.referenceFrame(p.x, p.y, p.z);
    const rvx = p.vx - fr.vx, rvy = p.vy - fr.vy, rvz = p.vz - fr.vz;
    const vrel = Math.hypot(rvx, rvy, rvz);
    const vReal = (vrel * TIME_BASE) / R; // in body-radii per real second
    const u = rng.unitVector();
    const bias = clamp(vReal / 8, 0, 2.5);
    if (vrel > 0) {
      u.x += (rvx / vrel) * bias; u.y += (rvy / vrel) * bias; u.z += (rvz / vrel) * bias;
    }
    let dist = rng.range(rMinR, rMaxR) * R;
    // flatten the spawn region in disks and belts
    let dx = u.x, dy = u.y, dz = u.z;
    if (env.normal && (env.kind === 'disk' || env.kind === 'belt' || env.kind === 'interplanetary' || env.kind === 'planetary')) {
      const n = env.normal;
      const h = dx * n.x + dy * n.y + dz * n.z;
      const flat = env.kind === 'interplanetary' ? 0.6 : 0.3;
      dx -= n.x * h * (1 - flat); dy -= n.y * h * (1 - flat); dz -= n.z * h * (1 - flat);
    }
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const x = p.x + dx * dist, y = p.y + dy * dist, z = p.z + dz * dist;

    // don't spawn inside planets or stars
    for (const b of w.attractors) {
      if (b === p) continue;
      if (Math.hypot(b.x - x, b.y - y, b.z - z) < b.rEff * 3 + R * 4) return null;
    }

    // mass relative to the player
    let mRel;
    const roll = rng.next();
    if (allowDanger && roll < 0.06 && dist > R * 34) mRel = rng.logRange(1.3, 5);
    else if (roll < 0.26) mRel = rng.powerLaw(0.15, 0.8, 1.2);
    else mRel = rng.powerLaw(0.003, 0.15, 1.35);
    // around a star, rogue planets and comets drift by: things it can keep as planets
    if (p.isStar && !p.compact && rng.chance(0.4)) mRel = rng.logRange(1e-7, 4e-3);
    // compact objects meet other compact objects now and then
    if (p.compact && rng.chance(0.05) && dist > R * 30) {
      const bh = p.compact === 'bh' ? rng.chance(0.6) : rng.chance(0.3);
      const m = bh ? Math.min(p.mass * rng.logRange(0.05, 0.8), Math.max(p.mass * 0.05, rng.range(5, 30) * M_SUN)) : rng.range(1.2, 2.0) * M_SUN;
      const frame0 = w.referenceFrame(x, y, z);
      const vesc0 = escapeVelocity(p.mass, p.rEff);
      const dv0 = rng.unitVector();
      const cb = new Body({
        role: 'field', compact: bh ? 'bh' : 'ns', mass: m, comp: { iron: 0.1, gas: 0.9 }, x, y, z,
        vx: frame0.vx + dv0.x * vesc0 * 0.2, vy: frame0.vy + dv0.y * vesc0 * 0.2, vz: frame0.vz + dv0.z * vesc0 * 0.2,
        name: bh ? `XTE J${rng.int(1000, 2359)}${rng.sign() > 0 ? '+' : '-'}${rng.int(100, 899)}` : `PSR J${rng.int(1000, 2359)}${rng.sign() > 0 ? '+' : '-'}${rng.int(10, 89)}`,
        seed: rng.int(1, 1e9), fadeIn: 0,
      });
      cb.nsSpin = rng.range(1, 400);
      cb.bhSpin = rng.next() * 0.9;
      w.addBody(cb);
      return cb;
    }
    let mass = p.mass * mRel;
    // among stars, small dim red dwarfs vastly outnumber big bright ones (the initial mass function)
    if (mass > 0.08 * M_SUN && !(allowDanger && mRel > 1)) {
      const imf = rng.powerLaw(0.08, 20, 2.35) * M_SUN;
      if (imf < mass) mass = Math.max(imf, p.mass * 0.0015);
    }

    const comp = this.pickComp(mass);
    const temp = this.tempAt(x, y, z);
    const frame = w.referenceFrame(x, y, z);
    // gentle random drift relative to the local orbit
    const vesc = escapeVelocity(p.mass, p.rEff);
    const sig = vesc * rng.range(0.12, 0.45);
    const dv = rng.unitVector();
    const b = new Body({
      role: 'field',
      name: this.nameFor(mass, comp),
      mass, comp,
      x, y, z,
      vx: frame.vx + dv.x * sig, vy: frame.vy + dv.y * sig, vz: frame.vz + dv.z * sig,
      spin: rng.range(0.3, 3) * rng.sign(),
      tilt: rng.range(0, 1.4),
      temp,
      seed: rng.int(1, 1e9),
      fadeIn: 0,
      kind: this.kindFor(mass, comp, temp),
    });
    if (b.kind === 'rocky' && comp.ice > 0.05 && temp > 260 && temp < 340 && mass > 0.3 * M_EARTH && mass < 5 * M_EARTH && rng.chance(0.05)) {
      b.life = rng.chance(0.25) ? 2 : 1;
    }
    if (mass > 30 * M_EARTH && mass < 13 * M_JUP && comp.gas > 0.4 && rng.chance(0.12)) {
      b.rings = { inner: rng.range(1.25, 1.55), outer: rng.range(2.0, 2.5), opacity: rng.range(0.3, 0.9), seed: rng.int(1, 1e9) };
    }
    w.addBody(b);
    return b;
  }

  tempAt(x, y, z) {
    const w = this.world;
    let T = 30;
    for (const s of w.stars) {
      const d = Math.hypot(s.x - x, s.y - y, s.z - z);
      const dReal = s.radius + Math.max(0, d - s.radius) * DIST_COMPRESS;
      T = Math.max(T, equilibriumTemp(s.starTemp, s.radius, dReal, 0.3));
    }
    return T;
  }

  pickComp(mass) {
    const rng = this.rng, env = this.env;
    if (mass >= 13 * M_JUP) return { rock: 0.01, iron: 0.005, ice: 0.015, gas: 0.97 };
    if (mass >= 30 * M_EARTH) return { rock: 0.04, iron: 0.015, ice: 0.08, gas: rng.range(0.7, 0.9) };
    if (mass >= 8 * M_EARTH && rng.chance(0.6)) return { rock: 0.2, iron: 0.06, ice: 0.54, gas: rng.range(0.12, 0.3) };
    if (env.kind === 'nebula' && rng.chance(0.5)) return { rock: 0.1, iron: 0.03, ice: 0.3, gas: 0.57 };
    if (env.kind === 'oort') return { rock: 0.28, iron: 0.06, ice: 0.6, carbon: 0.06 };
    // carbon-rich systems make carbon-rich rubble
    if (env.sys?.sys?.carbonRich && rng.chance(0.7)) return { rock: 0.35, iron: 0.15, ice: 0.1, carbon: rng.range(0.3, 0.5) };
    if (rng.chance(0.06)) return { rock: 0.45, iron: 0.15, ice: 0.12, carbon: rng.range(0.25, 0.4) }; // carbonaceous
    const cold = env.snow > 1 || env.kind === 'interstellar' && rng.chance(0.6);
    const r = rng.next();
    if (r < 0.08) return { rock: 0.25, iron: 0.72, ice: 0.0, gas: 0 };          // metallic
    if (!cold && r < 0.13) return { rock: 0.3, iron: 0.08, ice: 0.62, gas: 0 };  // stray comet
    if (cold) return { rock: rng.range(0.3, 0.45), iron: rng.range(0.06, 0.14), ice: rng.range(0.4, 0.62), gas: 0 };
    return { rock: rng.range(0.6, 0.72), iron: rng.range(0.2, 0.34), ice: rng.range(0, 0.06), gas: 0 };
  }

  kindFor(mass, comp, temp) {
    if (mass >= 13 * M_JUP) return 'star';
    if (comp.gas > 0.5) return temp > 1000 ? 'hotjupiter' : 'gasgiant';
    if (comp.gas > 0.1) return 'icegiant';
    if (comp.iron > 0.55) return 'metal';
    if (temp > 900) return 'lava';
    if (comp.ice > 0.35) return 'icy';
    return 'rocky';
  }

  nameFor(mass, comp) {
    const rng = this.rng;
    const L = () => LETTERS[rng.int(0, LETTERS.length - 1)];
    const n = this.serial++;
    if (mass >= 0.075 * M_SUN) return `2MASS J${rng.int(1000, 2359)}${rng.int(1000, 9999)}${rng.sign() > 0 ? '+' : '-'}${rng.int(1000, 8999)}`;
    if (mass >= 13 * M_JUP) return `WISE J${rng.int(1000, 2359)}${rng.sign() > 0 ? '+' : '-'}${rng.int(1000, 8999)}`;
    if (mass >= 0.5 * M_EARTH) return `PSO J${rng.range(0, 359).toFixed(1)}${rng.sign() > 0 ? '+' : '-'}${rng.int(10, 89)}`;
    if (mass >= 1e21) return `(${rng.int(10000, 590000)}) ${L()}${L().toLowerCase()}${L().toLowerCase()}${rng.pick(['ia', 'os', 'ea', 'on', 'us'])}`;
    if (comp.ice > 0.45) return `C/${this.year} ${L()}${rng.int(1, 9)}`;
    if (mass >= 1e17) return `${this.year} ${L()}${L()}${rng.int(1, 99)}`;
    return `Planetesimal ${n}`;
  }
}
