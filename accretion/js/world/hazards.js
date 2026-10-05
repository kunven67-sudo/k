// Dangers from the wider galaxy. Rates are real astronomical rates per year,
// so in normal play they're rare and in deep time they happen often.
import { Body } from './body.js';
import { LY } from './galaxy.js';
import { escapeVelocity } from '../core/phys.js';
import { M_SUN, M_EARTH, TIME_BASE } from '../core/constants.js';

const SN_RANGE = 50 * LY;

export class Hazards {
  constructor(world) {
    this.world = world;
    this.reset();
  }

  reset() {
    this.stormTimer = 70;
    this.rogueTimer = 240;
    this.scanTimer = 0;
    this.pending = null;      // something about to happen (blocks deep time)
    this.watch = new Map();   // nearby massive stars we keep an eye on: id -> phase
  }

  update(rs, years) {
    const w = this.world;
    const p = w.player;
    if (!p || !p.alive) return;
    if (w.deep) this.deepHazards(rs, years);
    else this.normalHazards(rs);
    // something scheduled is due
    if (this.pending && w.time >= this.pending.at) {
      const ev = this.pending;
      this.pending = null;
      ev.fire();
    }
    this.scanTimer -= rs;
    if (this.scanTimer <= 0) {
      this.scanTimer = w.deep ? 0.3 : 3;
      this.scanStars(years);
    }
  }

  // ---------------------------------------------------------------- normal time

  normalHazards(rs) {
    const w = this.world;
    if (w.warp > 1 || w.sandbox && !w.sandboxHazards) return;
    this.stormTimer -= rs;
    if (this.stormTimer <= 0) {
      this.stormTimer = w.rng.range(80, 170);
      const env = w.field.env.kind;
      if (env !== 'interstellar' || w.rng.chance(0.35)) this.spawnStorm(w.rng.chance(0.55));
    }
    this.rogueTimer -= rs;
    if (this.rogueTimer <= 0) {
      this.rogueTimer = w.rng.range(200, 420);
      this.spawnRogue();
    }
    // magnetars nearby throw giant flares now and then
    for (const b of w.attractors) {
      if (!b.magnetar || b === w.player) continue;
      const d = w.player.distTo(b);
      if (d < 3 * LY && w.rng.chance(rs / 45)) this.magnetarFlare(b, d);
    }
  }

  // ---------------------------------------------------------------- deep time

  // In deep time, events happen in the background at their real rates.
  // They shape your world (bombardments, extinctions) without stopping the clock.
  deepHazards(rs, years) {
    const w = this.world;
    if (w.sandbox && !w.sandboxHazards) return;
    const rng = w.rng;
    // gamma-ray bursts: a damaging one hits a given world maybe every half a billion years
    const nGrb = this.count(years / 5e8, rng);
    for (let i = 0; i < Math.min(nGrb, 3); i++) w.emit('grb', { dist: rng.logRange(2000, 8000), deep: true });
    // stars passing close shake comets loose from the edge of your system
    if (w.hostSystem()) {
      const nFly = this.count(years / 2.5e7, rng);
      for (let i = 0; i < Math.min(nFly, 3); i++) w.emit('flyby', { dist: rng.range(0.1, 0.8), deep: true });
    }
    // ordinary asteroid and comet impacts on your world, sized by how often they happen
    const nImp = this.count(years / 1e5, rng);
    if (nImp > 0) w.emit('bombard', { n: nImp, years });
    void rs;
  }

  // how many events with this expected count happen (Poisson)
  count(lam, rng) {
    if (lam <= 0) return 0;
    if (lam > 30) return Math.round(lam + Math.sqrt(lam) * rng.normal());
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    do { k++; p *= rng.next(); } while (p > L);
    return k - 1;
  }

  schedule(reason, seconds, fire) {
    this.pending = { reason, at: this.world.time + seconds * TIME_BASE, fire };
  }

  // ---------------------------------------------------------------- the living galaxy

  // Massive stars nearby age; when one finishes, it explodes.
  scanStars(years) {
    const w = this.world;
    const g = w.galaxy;
    const p = w.player;
    const near = g.starsNear(p, w.O, SN_RANGE, (d) => (d < 2 * LY ? 0.5 : 7.5), 400);
    for (const s of near) {
      const st = g.starNow(s.rec);
      const id = s.rec.id;
      const prev = this.watch.get(id);
      const phase = st ? st.phase : 'gone';
      this.watch.set(id, phase);
      if (!prev || prev === phase) {
        // in normal time, a supergiant at the very end gets a neutrino warning
        if (!w.deep && st && st.phase === 'sg' && st.frac > 0.995 && !this.pending) {
          const e = w.active.get(id);
          const name = g.nameOf(s.rec);
          w.emit('sn-warning', { name, dist: s.d });
          this.schedule(`Neutrinos from ${name}: a supernova is coming`, 18, () => {
            if (e && e.star && e.star.alive) w.systemSupernova(e);
            else this.distantSupernova(s.rec, name, s.d);
            g.stateOf(id).remnant = { compact: s.rec.m0 >= 22 ? 'bh' : 'ns', mass: (s.rec.m0 >= 22 ? s.rec.m0 * 0.3 : 1.4) * M_SUN };
          });
        }
        continue;
      }
      // it just died
      if ((prev === 'sg' || prev === 'ms') && (phase === 'ns' || phase === 'bh')) {
        const e = w.active.get(id);
        if (e && e.star && e.star.alive && !e.star.compact) w.systemSupernova(e);
        else this.distantSupernova(s.rec, g.nameOf(s.rec), s.d);
      } else if (prev === 'rg' && phase === 'wd') {
        w.emit('star-died', { name: g.nameOf(s.rec), kind: 'planetary nebula', dist: s.d });
      }
    }
    void years;
  }

  distantSupernova(rec, name, dist) {
    const w = this.world;
    w.emit('distant-supernova', { name, dist, ly: dist / LY });
    if (w.deep && dist < 30 * LY) w.setDeep(0);
  }

  // ---------------------------------------------------------------- spawns

  spawnStorm(comet, scale = 1) {
    const w = this.world;
    const p = w.player, rng = w.rng;
    const n = Math.round(rng.int(18, 40) * scale);
    const dir = rng.unitVector();
    const R = p.rEff;
    const frame = w.referenceFrame(p.x, p.y, p.z, p);
    const vesc = escapeVelocity(p.mass, p.rEff);
    const speed = vesc * rng.range(3.5, 7);
    const cx = p.x + dir.x * R * 75, cy = p.y + dir.y * R * 75, cz = p.z + dir.z * R * 75;
    const off = rng.unitVector();
    for (let i = 0; i < n; i++) {
      const j = rng.unitVector();
      const spread = R * rng.range(2, 16);
      const mass = p.mass * rng.powerLaw(0.003, 0.12, 1.6);
      const comp = comet ? { rock: 0.28, iron: 0.06, ice: 0.6, carbon: 0.06 } : { rock: 0.62, iron: 0.3, ice: 0.04, carbon: 0.04 };
      const b = new Body({
        role: 'field', name: comet ? `C/${2026 + Math.floor(w.years)} ${'ABCDEFGHJK'[rng.int(0, 9)]}${rng.int(1, 9)}` : `Swarm rock ${i + 1}`,
        mass, comp, kind: comet ? 'icy' : 'rocky',
        x: cx + j.x * spread + off.x * R * 5, y: cy + j.y * spread + off.y * R * 5, z: cz + j.z * spread + off.z * R * 5,
        vx: frame.vx - dir.x * speed + j.x * speed * 0.05,
        vy: frame.vy - dir.y * speed + j.y * speed * 0.05,
        vz: frame.vz - dir.z * speed + j.z * speed * 0.05,
        seed: rng.int(1, 1e9), spin: rng.range(-3, 3), temp: p.temp, fadeIn: 0,
      });
      b.storm = true;
      b.comet = comet;
      w.addBody(b);
    }
    w.emit('storm', { comet, n, dir });
  }

  // a lone planet with no star, drifting through
  spawnRogue(fromDeep = false) {
    const w = this.world;
    const p = w.player, rng = w.rng;
    // rogue planets are planets: they only matter once you're at least moon-sized
    if (p.mass < 5e22 || p.isStar || p.compact) return;
    const mass = Math.max(p.mass * rng.logRange(0.3, 4), 0.05 * M_EARTH);
    const R = Math.max(p.rEff, 1);
    const gas = mass > 20 * M_EARTH;
    const dir = rng.unitVector();
    const side = rng.unitVector();
    const frame = w.referenceFrame(p.x, p.y, p.z, p);
    const speed = escapeVelocity(p.mass, p.rEff) * rng.range(2, 5);
    const far = R * 80 + Math.cbrt(mass / p.mass) * R * 6;
    const b = new Body({
      role: 'field', name: `PSO J${rng.range(0, 359).toFixed(1)}${rng.sign() > 0 ? '+' : '-'}${rng.int(10, 89)}`,
      mass, comp: gas ? { rock: 0.04, iron: 0.01, ice: 0.08, gas: 0.87 } : { rock: 0.55, iron: 0.25, ice: 0.18, carbon: 0.02 },
      x: p.x + dir.x * far + side.x * R * 8, y: p.y + dir.y * far + side.y * R * 8, z: p.z + dir.z * far + side.z * R * 8,
      vx: frame.vx - dir.x * speed, vy: frame.vy - dir.y * speed, vz: frame.vz - dir.z * speed,
      temp: 40, seed: rng.int(1, 1e9), fadeIn: 0, kind: gas ? 'gasgiant' : 'icy',
    });
    b.rogue = true;
    w.addBody(b);
    w.emit('rogue', { name: b.name, bigger: mass > p.mass, fromDeep });
  }

  magnetarFlare(src, dist) {
    const w = this.world;
    w.emit('magnetar-flare', { name: src.name, dist });
  }
}

export { M_SUN };
