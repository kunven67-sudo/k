// What makes each stage of your life different, beyond its size:
// gas giants migrate and carve gaps, stars gather planets, share gas with a
// companion and throw flares; neutron stars spin up, sweep pulsar beams and
// flare as magnetars; black holes spaghettify stars, merge and blaze as quasars.
// Nebulae you pass through collapse into new stars.
import { Body } from './body.js';
import { LY } from './galaxy.js';
import { G, C, M_SUN, M_EARTH, M_JUP, TIME_BASE, AU, DIST_COMPRESS } from '../core/constants.js';
import { clamp, escapeVelocity } from '../core/phys.js';

export class StageFX {
  constructor(world, saved = null) {
    this.key = 'stages';
    this.world = world;
    const s = saved || {};
    this.flags = s.flags || {};
    this.flareT = 20;
    this.magT = 40;
    this.birthT = 0;
    this.outbreak = 0;
    this.outbreakT = 60 + Math.random() * 90;
    this.quasar = 0;
    this.gold = s.gold || 0;
    this.transfer = 0;
    this.gwT = -1;
  }

  serialize() {
    return { flags: this.flags, gold: this.gold };
  }

  once(flag, fn) {
    if (this.flags[flag]) return;
    this.flags[flag] = true;
    fn();
  }

  onEvent(type, e) {
    const w = this.world, p = w.player;
    if (!p || !p.alive) return;
    if (type === 'impact' && !e.fragment && e.compact) {
      // two neutron stars: a kilonova that forges gold
      if (p.compact === 'ns' && e.compact === 'ns' || (p.compact === 'bh' && e.compact === 'ns' && p.mass < 20 * M_SUN)) {
        const gold = (0.01 * (e.mass + p.mass) * 0.03) / M_EARTH;
        this.gold += gold;
        w.emit('kilonova', { x: p.x, y: p.y, z: p.z, gold });
      }
      if (e.compact === 'bh' && p.compact === 'bh') {
        // black holes merging: a burst of gravitational waves carries away a few percent of the mass
        const lost = Math.min(e.mass, p.mass) * 0.05;
        p.mass -= lost;
        p.bhSpin = clamp(0.69 + (Math.random() - 0.5) * 0.1, 0, 0.998);
        p.updateRadius();
        this.gwT = 0;
        w.emit('bh-merger', { mass: e.mass, lost, x: p.x, y: p.y, z: p.z });
      }
    }
    if (type === 'disrupt' && p.compact === 'bh' && e.body && (e.body.isStar || e.body.mass > p.mass * 1e-4)) {
      w.emit('tde', { body: e.body, name: e.name, star: e.body.isStar });
    }
  }

  update(rs, years) {
    const w = this.world, p = w.player;
    if (!p || !p.alive) return;
    if (w.deep) { this.deep(years); return; }
    const k = rs * w.warp;
    if (!p.isStar && !p.compact && p.comp.gas >= 0.3 && p.mass > 10 * M_EARTH) this.giant(rs, k);
    else this.gap = null;
    if (p.isStar && !p.compact) this.star(rs, k);
    if (p.compact === 'ns') this.neutron(rs, k);
    if (p.compact === 'bh') this.blackHole(rs, k);
    if (!p.isStar && !p.compact) this.hostFlares(rs);
    this.nebula(rs);
    this.wanderers(rs);
    if (this.gwT >= 0) { this.gwT += rs; if (this.gwT > 6) this.gwT = -1; }
  }

  // ---------------------------------------------------------------- gas giants

  giant(rs, k) {
    const w = this.world, p = w.player;
    const env = w.field.env;
    const host = env.sys;
    const s = host?.star;
    if (!s || !s.alive) { this.gap = null; return; }
    const rx = p.x - s.x, ry = p.y - s.y, rz = p.z - s.z;
    const r = Math.hypot(rx, ry, rz);
    const hill = r * Math.cbrt(p.mass / (3 * s.mass));
    // a giant clears a gap in the dust around its orbit
    this.gap = { entry: host, r, w: Math.max(hill * 3, r * 0.05) };
    if (env.kind === 'disk' || this.gapDisk) {
      // and the disk's gas slowly drags it inward (Type II migration)
      const vt = { x: p.vx - s.vx, y: p.vy - s.vy, z: p.vz - s.vz };
      const f = 1 - Math.exp(-k * 0.0025 * Math.min(env.density || 1, 1.5));
      p.vx -= vt.x * f * 0.5; p.vy -= vt.y * f * 0.5; p.vz -= vt.z * f * 0.5;
      this.once('migrate', () => w.emit('migration', {}));
      const aReal = (r * DIST_COMPRESS) / 1.496e8;
      if (aReal < 0.1) this.once('hotjup', () => w.emit('hot-jupiter', {}));
    }
    // now and then a huge storm boils up through the clouds (like Saturn's Great White Spots)
    this.outbreakT -= rs;
    if (this.outbreakT <= 0) {
      this.outbreakT = 90 + Math.random() * 150;
      this.outbreak = 1;
      w.emit('giant-storm', {});
    }
    this.outbreak = Math.max(0, this.outbreak - rs / 60);
  }

  // ---------------------------------------------------------------- stars

  star(rs, k) {
    const w = this.world, p = w.player;
    // flares: red dwarfs flare often and violently
    this.flareT -= rs * (p.mass < 0.5 * M_SUN ? 2.5 : 1);
    if (this.flareT <= 0) {
      this.flareT = 25 + Math.random() * 50;
      const strong = Math.random() < (p.mass < 0.5 * M_SUN ? 0.4 : 0.15);
      const d = randUnit();
      this.flare = { dir: d, t: 0, strong };
      w.emit('self-flare', { dir: d, strong, cme: strong || Math.random() < 0.4 });
    }
    if (this.flare) { this.flare.t += rs; if (this.flare.t > 5) this.flare = null; }
    // a close companion star: gas flows from whichever one overflows its Roche lobe
    this.transfer = 0;
    for (const s of w.stars) {
      if (!s.alive || s === p || !s.isStar) continue;
      const a = p.distTo(s);
      if (a > (p.rEff + s.rEff) * 12) continue;
      const q = s.mass / p.mass;
      const rlS = a * eggleton(q), rlP = a * eggleton(1 / q);
      let from = null, to = null;
      if (s.radius > rlS * 0.9) { from = s; to = p; } else if (p.radius > rlP * 0.9) { from = p; to = s; }
      if (!from) continue;
      const rate = from.mass * 0.004 * Math.min(k, 40) * clamp(from.radius / (from === s ? rlS : rlP) - 0.9, 0.05, 1);
      const dm = Math.min(rate, from.mass * 0.2);
      from.mass -= dm;
      to.mass += dm;
      if (to === p) p.absorbComp({ gas: 0.98, ice: 0.01, rock: 0.01 }, dm);
      from.updateRadius?.(); to.updateRadius?.();
      this.transfer = to === p ? 1 : -1;
      this.stream = { from, to };
      this.once(`stream-${s.id}`, () => w.emit('mass-transfer', { name: s.name, gaining: to === p }));
    }
    if (!this.transfer) this.stream = null;
  }

  // the star you orbit throws flares too; red dwarf flares can strip a planet's air
  hostFlares(rs) {
    const w = this.world, p = w.player;
    const host = w.hostSystem();
    const s = host?.star;
    if (!s || !s.alive || !s.isStar) return;
    const dReal = (p.distTo(s) * DIST_COMPRESS) / 1.496e8;
    if (dReal > 1.5) return;
    const red = s.mass < 0.5 * M_SUN;
    this.flareT -= rs * (red ? 1.5 : 0.4);
    if (this.flareT <= 0) {
      this.flareT = 30 + Math.random() * 60;
      const strong = Math.random() < (red ? 0.35 : 0.08) && dReal < 0.6;
      w.emit('stellar-flare', { name: s.name, strong, star: s });
    }
  }

  // ---------------------------------------------------------------- neutron stars

  neutron(rs, k) {
    const w = this.world, p = w.player;
    this.once('ns', () => {});
    // magnetars throw giant flares from starquakes
    if (p.magnetar) {
      this.magT -= rs;
      if (this.magT <= 0) {
        this.magT = 35 + Math.random() * 60;
        w.emit('magnetar-self', { x: p.x, y: p.y, z: p.z });
        // the blast pushes light things away
        for (const b of w.bodies) {
          if (!b.alive || b === p || b.role === 'star' || b.static) continue;
          const d = p.distTo(b);
          if (d > p.rEff * 120) continue;
          const push = (escapeVelocity(p.mass, p.rEff) * 0.08 * p.rEff) / Math.max(d, p.rEff);
          b.vx += ((b.x - p.x) / d) * push; b.vy += ((b.y - p.y) / d) * push; b.vz += ((b.z - p.z) / d) * push;
          b.heat = Math.max(b.heat || 0, 0.5);
        }
      }
    }
    // pulsar beams sweep around and heat whatever they cross
    const ax = this.beamAxis(p);
    for (const b of w.bodies) {
      if (!b.alive || b === p || b.compact || b.role === 'fragment') continue;
      const dx = b.x - p.x, dy = b.y - p.y, dz = b.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > p.rEff * 600) continue;
      const cos = Math.abs((dx * ax.x + dy * ax.y + dz * ax.z) / d);
      if (cos > 0.985) {
        b.heat = Math.min(1, (b.heat || 0) + rs * 2);
        if (!b.isStar && b.mass < p.mass * 1e-3) {
          const dm = b.mass * 0.02 * Math.min(k, 20) * (p.rEff * 100 / Math.max(d, p.rEff));
          b.mass = Math.max(b.mass - dm, b.mass * 0.5);
          b.updateRadius();
        }
        b.beamLit = 0.3;
      }
    }
  }

  // the beam direction: the magnetic axis, tilted from the spin axis, turning with the star
  beamAxis(p) {
    const spin = Math.min(p.nsSpin || 1, 6);
    const t = (this.world.time / TIME_BASE) * spin * 0.35 + (p.seed % 10);
    const tilt = 0.5;
    const sx = Math.sin(p.tilt), sy = Math.cos(p.tilt);
    // perpendiculars to the spin axis
    let ux = sy, uy = -sx, uz = 0;
    const vx = sx * 0 - 0, vy = 0, vz = 1;
    const c = Math.cos(t), s = Math.sin(t);
    ux = ux * c + vx * s; uy = uy * c + vy * s; uz = uz * c + vz * s;
    return norm({ x: sx * Math.cos(tilt) + ux * Math.sin(tilt), y: sy * Math.cos(tilt) + uy * Math.sin(tilt), z: uz * Math.sin(tilt) });
  }

  // ---------------------------------------------------------------- black holes

  blackHole(rs, k) {
    const w = this.world, p = w.player;
    // feeding fast and big: a quasar
    const feeding = w.recentFeed || 0;
    const q = p.mass > 1e5 * M_SUN ? clamp(feeding * 4, 0, 1) : clamp(feeding * 2, 0, 0.5);
    this.quasar += (q - this.quasar) * Math.min(1, rs * 0.8);
    if (this.quasar > 0.6 && p.mass > 1e5 * M_SUN) this.once('quasar', () => w.emit('quasar', {}));
    void k;
  }

  // ---------------------------------------------------------------- nebulae

  // passing through a molecular cloud squeezes it: new stars are born around you
  nebula(rs) {
    const w = this.world, p = w.player;
    const env = w.field.env;
    if (env.kind !== 'nebula' || !env.nebula) return;
    this.birthT -= rs * (p.mass > 1e29 ? 2 : 0.6);
    if (this.birthT > 0) return;
    this.birthT = 40 + Math.random() * 60;
    const nb = env.nebula;
    if (nb.massLeft < 0.1) return;
    const [lx, ly, lz] = w.toLy(p.x, p.y, p.z);
    const n = 1 + Math.floor(Math.random() * 3);
    const names = [];
    for (let i = 0; i < n; i++) {
      const v = randUnit();
      const d = 0.4 + Math.random() * 1.2;
      const rec = w.galaxy.addNewborn(lx + v.x * d, ly + v.y * d * 0.5, lz + v.z * d, w.rng);
      names.push(w.galaxy.nameOf(rec));
    }
    nb.massLeft = Math.max(0, nb.massLeft - 0.01 * n);
    w.galaxy.stateOf(nb.id).massLeft = nb.massLeft;
    w.emit('star-birth', { names });
  }

  // ---------------------------------------------------------------- wanderers

  // rarely, a black hole or neutron star drifts through
  wanderers(rs) {
    const w = this.world, p = w.player;
    if (w.warp > 1 || (w.sandbox && !w.sandboxHazards)) return;
    this.wanderT = (this.wanderT ?? 600 + Math.random() * 900) - rs;
    if (this.wanderT > 0) return;
    this.wanderT = 900 + Math.random() * 1500;
    const big = p.compact === 'bh' || p.mass > 2 * M_SUN;
    const bh = big ? Math.random() < 0.7 : Math.random() < 0.6;
    const mass = (bh ? 5 + Math.random() * 25 : 1.3 + Math.random() * 0.6) * M_SUN * (p.compact === 'bh' && p.mass > 100 * M_SUN ? p.mass / (30 * M_SUN) * Math.random() : 1);
    const dir = randUnit(), side = randUnit();
    const R = Math.max(p.rEff, 1e5);
    const frame = w.referenceFrame(p.x, p.y, p.z, p);
    const speed = Math.max(escapeVelocity(p.mass, p.rEff) * 1.5, 40) ;
    const b = new Body({
      role: 'field', compact: bh ? 'bh' : 'ns', mass, name: bh ? `Wandering black hole ${w.rng.int(100, 999)}` : `PSR J${w.rng.int(1000, 2359)}${w.rng.sign() > 0 ? '+' : '-'}${w.rng.int(10, 89)}`,
      comp: { gas: 1 }, x: p.x + dir.x * R * 120 + side.x * R * 12, y: p.y + dir.y * R * 120 + side.y * R * 12, z: p.z + dir.z * R * 120 + side.z * R * 12,
      vx: frame.vx - dir.x * speed, vy: frame.vy - dir.y * speed, vz: frame.vz - dir.z * speed, fadeIn: 0, seed: w.rng.int(1, 1e9),
    });
    b.bhSpin = Math.random() * 0.8;
    b.nsSpin = 1 + Math.random() * 30;
    b.wanderer = true;
    w.addBody(b);
    w.emit('wanderer', { name: b.name, bh, bigger: !w.beats(p, b) });
  }

  // ---------------------------------------------------------------- deep time

  deep(years) {
    const w = this.world, p = w.player;
    // a star in deep time still flares, and a giant still migrates (slowly)
    if (p.compact === 'ns') p.nsSpin = Math.max(0.2, (p.nsSpin || 1) * Math.exp(-years / 3e8));
    void C; void LY; void M_JUP; void AU;
  }
}

function eggleton(q) {
  const q23 = Math.pow(q, 2 / 3);
  return (0.49 * q23) / (0.6 * q23 + Math.log(1 + Math.cbrt(q)));
}

function randUnit() {
  const z = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(t), y: z, z: r * Math.sin(t) };
}

function norm(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export { G };
