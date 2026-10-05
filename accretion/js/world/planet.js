// The planet model: what is going on in and around your world.
// Interior heat, iron core and magnetic field, atmosphere (volcanoes, comets,
// star wind, impacts, weathering), greenhouse climate (snowball and runaway),
// oceans, plate tectonics, spin and tides, seasons, giant-impact moons, rings,
// and the Earth Similarity Index.
import { Body } from './body.js';
import { G, M_EARTH, R_EARTH, M_SUN, R_SUN, DIST_COMPRESS, TIME_BASE, M_JUP } from '../core/constants.js';
import { clamp, smoothstep, escapeVelocity, lerp } from '../core/phys.js';

const RHO_EARTH = 5.51; // g/cm^3

export class PlanetModel {
  constructor(world, saved = null) {
    this.key = 'planet';
    this.world = world;
    this.reset(saved);
  }

  reset(saved) {
    const s = saved || {};
    this.H = s.H ?? null;                 // interior heat, 1 = freshly formed (set from your size on first update)
    this.magma = s.magma ?? 0;            // surface melted by recent impacts (cools in a few million years)
    this.differentiated = s.differentiated ?? false;
    this.atm = s.atm || { n2: 0, o2: 0, co2: 0, h2o: 0, ch4: 0, h2: 0 };
    this.day = s.day ?? 14;               // hours per rotation
    this.drift = s.drift ?? 0;            // how far continents have drifted (radians of pattern)
    this.locked = s.locked ?? false;
    this.ring = s.ring || null;           // { mass, inner, outer } in planet radii
    this.debrisDisk = s.debrisDisk || null; // a giant impact's debris that will become a moon
    this.coolEvent = 0;                   // temporary cooling from a huge eruption (K)
    this.history = s.history || [];
    this.flags = s.flags || {};
    this.Ts = 200;
    this.P = 0;
    this.field = 0;
    this.season = 0;
    this.esi = 0;
    this.iceCover = 0;
    this.oceanState = 'none';
    this.volcanism = 0;
    this.tectonics = false;
    this.habitable = false;
  }

  serialize() {
    return { H: this.H, magma: this.magma, differentiated: this.differentiated, atm: this.atm, day: this.day, drift: this.drift, locked: this.locked, ring: this.ring, debrisDisk: this.debrisDisk, history: this.history.slice(-80), flags: this.flags };
  }

  log(text, kind = 'geo') {
    const w = this.world;
    this.history.push({ years: w.years - (w.player?.born || 0), text, kind });
    if (this.history.length > 200) this.history.shift();
    w.emit('history', { text, kind });
  }

  once(flag, text, kind) {
    if (this.flags[flag]) return;
    this.flags[flag] = true;
    this.log(text, kind);
  }

  // events from the world (impacts, flares, bursts...)
  onEvent(type, e) {
    const p = this.world.player;
    if (!p || !p.alive || p.isStar || p.compact) return;
    if (type === 'impact' && !e.fragment) {
      // big hits blow air into space; comets bring water
      if (e.vrel > e.vesc && e.rel > 0.002) {
        const blow = clamp(e.rel * 6 * (e.vrel / e.vesc), 0, 0.9);
        for (const k of Object.keys(this.atm)) this.atm[k] *= 1 - blow;
      }
      // giant impact: a debris disk that will clump into a moon (how Earth got its Moon)
      if (e.rel > 0.04 && p.mass > 0.05 * M_EARTH && p.comp.gas < 0.3 && !this.debrisDisk) {
        this.debrisDisk = { mass: e.mass * 0.25 + p.mass * 0.01, t: 0, seed: (Math.random() * 1e9) | 0 };
        this.log(`Giant impact with ${e.name}. A ring of molten debris now circles you`, 'impact');
      }
      const melt = this.meltable ?? 1;
      this.H = Math.min(1.1, (this.H ?? 0.1) + e.rel * 0.6 * melt);
      this.magma = Math.min(1, this.magma + e.rel * 4 * melt * Math.min(1, e.vrel / Math.max(e.vesc, 1e-6) + 0.5));
      // comets and icy rocks bring gas: carbon dioxide and nitrogen join your air
      if (!e.fragment || e.rel > 0.002) this.deliver(e.body?.comp || {}, e.gain || e.mass);
    }
    if (type === 'magnetar-flare' || type === 'grb') {
      // radiation strips the upper air and ozone (shielded by a magnetic field)
      const shield = clamp(this.field, 0, 1.5) / 1.5;
      const hit = (type === 'grb' ? 0.25 : 0.4) * (1 - shield * 0.7);
      for (const k of Object.keys(this.atm)) this.atm[k] *= 1 - hit * 0.3;
      this.atm.o2 *= 1 - hit * 0.15;
    }
    if (type === 'stellar-flare' && e.strong) {
      // a superflare: without a magnetic field it strips away some of the air and water
      const shield = clamp(this.field / 0.4, 0, 1);
      const hit = 0.04 * (1 - shield);
      for (const k of Object.keys(this.atm)) this.atm[k] *= 1 - hit;
      if (hit > 0.01) this.log(`A superflare from ${e.name} stripped some of your air`, 'bad');
    }
    if (type === 'bombard') {
      // in deep time, the steady rain of comets brings water and buries craters
      p.comp.ice = Math.min(0.9, p.comp.ice + 1e-7 * e.n);
    }
    if (type === 'flyby' && e.deep) {
      const w = this.world;
      if (e.dist < 0.3 && w.years - (this.lastFlyLog ?? -1e12) > 4e8) {
        this.lastFlyLog = w.years;
        this.log(`A star passed only ${e.dist.toFixed(2)} light-years away and sent a shower of comets inward`, 'impact');
      }
      p.comp.ice = Math.min(0.9, p.comp.ice + 2e-5);
    }
  }

  update(rs, years) {
    const w = this.world;
    const p = w.player;
    if (!p || !p.alive) return;
    const me = p.mass / M_EARTH;
    const giant = p.comp.gas >= 0.3 || p.isStar || p.compact;
    this.giant = giant;
    const vesc = escapeVelocity(p.mass, p.radius);
    const gSurf = (G * p.mass) / (p.radius * p.radius) * 1000; // m/s^2
    // only big bodies are heated much by their own formation (heat per kg goes as escape speed squared)
    const meltable = clamp(Math.pow(vesc / 4.5, 2), 0, 1);
    this.meltable = meltable;
    if (this.H == null) this.H = 0.08 + 0.92 * meltable;

    // ---- seasons and the day
    const host = w.hostSystem();
    const star = host?.star;
    let orbitAU = 0;
    if (star && star.alive) {
      const rx = p.x - star.x, ry = p.y - star.y, rz = p.z - star.z;
      const { e1, e2 } = host.detail.basis;
      const ang = Math.atan2(rx * e2.x + ry * e2.y + rz * e2.z, rx * e1.x + ry * e1.y + rz * e1.z);
      this.season = Math.sin(ang) * Math.sin(p.tilt);
      orbitAU = (Math.hypot(rx, ry, rz) * DIST_COMPRESS) / 1.496e8;
      // tidal locking: close-in worlds end up showing one face to their star
      const tLock = 1e9 * Math.pow(Math.max(orbitAU, 0.005) / 0.25, 6) * Math.pow(M_SUN / star.mass, 2) * Math.max(1, me);
      this.lockProgress = (this.lockProgress || 0) + years / tLock;
      if (!this.locked && this.lockProgress > 1 && !giant) {
        this.locked = true;
        this.log(`Tidally locked: one side always faces ${star.name}`, 'geo');
      }
      if (this.locked) {
        const aReal = Math.hypot(rx, ry, rz) * DIST_COMPRESS;
        const period = 2 * Math.PI * Math.sqrt(Math.pow(aReal, 3) / (G * star.mass));
        this.day = period / 3600;
        p.spin = Math.sign(p.spin || 1) * 0.02;
      }
    } else this.season = 0;
    // a day lasts as long as your spin says (impacts speed it up or slow it down)
    if (!this.locked) this.day = 11.2 / Math.max(Math.abs(p.spin || 0), 0.02);
    if (giant) {
      this.Ts = Math.max(p.temp, p.starTemp || 0);
      this.P = 0;
      this.field = p.compact === 'ns' ? 1e9 : p.mass > 0.3 * M_JUP ? 10 : 0;
      this.habitable = false;
      this.oceanState = 'none';
      this.esi = 0;
      this.updateMoonFormation(rs, years);
      this.updateRing(rs, years);
      return;
    }

    // ---- interior heat: radioactive decay and leftover heat, slower for big worlds
    const tau = (p.mass < 1e21 ? 2e7 : 3e9 * Math.max(0.05, p.radius / R_EARTH));
    const tidalHeat = this.tidalHeating();
    this.tidalHeat = tidalHeat;
    this.H = Math.max(0.03 + tidalHeat, this.H * Math.exp(-years / tau) + p.heat * 0.002 * rs);
    if (!this.differentiated && p.mass > 1e22 && (p.heat > 0.5 || this.H > 0.9)) {
      this.differentiated = true;
      this.log('Your iron sank to the centre and formed a core', 'geo');
    }
    // ---- magnetic field from a convecting iron core
    const spinOk = clamp(80 / Math.max(this.day, 1), 0, 1.4);
    const dynamo = this.differentiated && this.H > 0.22 && p.comp.iron > 0.06 && me > 0.03;
    const prevField = this.field;
    this.field = dynamo ? clamp(Math.sqrt(p.comp.iron / 0.32) * clamp(this.H / 0.5, 0, 1.5) * spinOk * Math.pow(me, 0.25), 0, 4) : 0;
    if (prevField < 0.15 && this.field >= 0.15) this.log('Your core started a dynamo: you have a magnetic field and auroras', 'geo');
    if (prevField >= 0.15 && this.field < 0.15 && this.flags.hadField) this.log('Your core cooled and your magnetic field died. Star wind can now strip your air.', 'bad');
    if (this.field >= 0.15) this.flags.hadField = true;

    // ---- volcanoes and plate tectonics
    this.volcanism = clamp(this.H * 1.2 + tidalHeat * 3, 0, 1.5);
    this.tectonics = me > 0.25 && me < 8 && p.comp.ice > 0.003 && this.H > 0.18 && p.comp.carbon < 0.25;
    if (this.tectonics) {
      this.drift += years * (2 * Math.PI / 6e8);
      this.once('tectonics', 'Plate tectonics began: your continents are drifting', 'geo');
    }
    // giant eruptions throw up ash and sulfur that cool the planet for a while
    if (years > 0 && w.rng.chance(1 - Math.exp(-years * 2e-8 * this.volcanism))) {
      this.coolEvent = 8 + w.rng.next() * 10;
      // (only the first in a long while makes it into your history)
      if (years > 1e4 && w.years - (this.lastVolcLog ?? -1e12) > 3e8) {
        this.lastVolcLog = w.years;
        this.log('A supervolcano erupted and plunged you into a volcanic winter', 'geo');
      }
    }
    this.coolEvent *= Math.exp(-years / 2e4) * Math.exp(-rs * 0.02);

    // ---- atmosphere: sources
    const holds = smoothstep(1.5, 4.5, vesc);
    // volcanoes breathe out carbon dioxide (Earth's rate is about 1e-7 bar a year)...
    const S = 1e-7 * this.volcanism * Math.sqrt(me) * holds;
    this.atm.n2 += 2e-10 * this.volcanism * Math.sqrt(me) * holds * years;
    this.atm.h2o += 1e-11 * this.volcanism * years * holds;
    // ...and rain on rock pulls it back out, faster when it's warm: the carbon-silicate
    // thermostat that has kept Earth's oceans liquid for 4 billion years
    const liquidNow = this.oceanState === 'liquid';
    const kW = liquidNow ? (this.tectonics ? 2.5e-6 : 2.5e-7) * clamp(Math.exp((this.Ts - 288) / 15), 0.01, 40) : 0;
    if (kW > 0) {
      const eq = S / kW;
      this.atm.co2 = eq + (this.atm.co2 - eq) * Math.exp(-kW * years);
    } else this.atm.co2 += S * years;
    // a gas envelope from what you ate
    this.atm.h2 = p.comp.gas * 400 * Math.pow(me, 0.8) * holds;
    // ---- sinks
    const F = this.flux(); // starlight relative to Earth
    // star wind strips air when there's no magnetic shield (how Mars lost its air)
    const shield = clamp(this.field / 0.4, 0, 1);
    const windLoss = 1 - Math.exp(-years * 6e-10 * F * (1 - shield) / Math.max(me, 0.05));
    // weak gravity: the air leaks away
    const leak = 1 - Math.exp(-years * (1 - holds) * 5e-5) - rs * (1 - holds) * 0.05;
    for (const k of ['n2', 'o2', 'co2', 'ch4']) {
      this.atm[k] *= Math.max(0, 1 - windLoss - Math.max(0, leak));
    }
    // light hydrogen escapes unless gravity is strong and it's cold
    // liquid water + rock pull CO2 out of the air over millions of years (Earth's thermostat)
    this.P = this.atm.n2 + this.atm.o2 + this.atm.co2 + this.atm.ch4 + Math.min(this.atm.h2, 1e5) + this.atm.h2o;
    // ---- climate
    const ice0 = this.iceCover;
    const albedo = lerp(0.3, 0.62, ice0) + (this.atm.co2 > 20 ? 0.4 : 0);
    const Teq = p.temp * Math.pow((1 - clamp(albedo, 0, 0.9)) / 0.7, 0.25);
    const liquid = this.oceanState === 'liquid';
    const vapor = this.oceanState === 'steam' ? Math.min(p.comp.ice * 300, 300) : 0;
    const tauG = 0.5 * Math.sqrt(Math.min(this.P, 1e3)) + 1.6 * Math.pow(this.atm.co2, 0.6) + (liquid ? 0.25 : 0) + 3 * Math.sqrt(vapor) + 2 * Math.sqrt(this.atm.ch4);
    // a magma ocean from recent giant impacts cools within a few million years (or a minute or two of play)
    this.magma *= Math.exp(-years / 2e6 - rs / 120);
    const internal = this.magma * 2600 * meltable;
    this.Ts = Teq * Math.pow(1 + 0.75 * tauG, 0.25) + internal + p.heat * 900 * meltable - this.coolEvent;
    // ice ages: slow wobbles of your orbit and tilt (Milankovitch cycles)
    if (ice0 > 0.05) this.Ts += 3 * Math.sin((w.years / 1e5) * 2 * Math.PI) * Math.sin(p.tilt + 0.2);
    // ---- water
    const water = p.comp.ice;
    const boil = 373 + 30 * Math.log10(Math.max(this.P, 0.01) + 1);
    // small bodies never melted enough for their ice to rise: it stays mixed into the rock under a dark crust
    this.iceExposed = smoothstep(19.5, 21.5, Math.log10(Math.max(p.mass, 1)));
    let state = 'none';
    if (water > 0.0005 && this.P > 0.006) state = this.Ts < 273 ? 'frozen' : this.Ts < boil ? 'liquid' : 'steam';
    else if (water > 0.0005 && this.iceExposed > 0.5) state = 'frozen';
    if (state !== this.oceanState) {
      if (state === 'liquid') this.once('ocean', 'Liquid water pooled into your first oceans', 'geo');
      const quiet = w.years - (this.lastClimLog ?? -1e12) < 3e8;
      if (state === 'frozen' && this.oceanState === 'liquid' && !quiet) { this.lastClimLog = w.years; this.log('Your oceans froze over: a snowball world', 'bad'); }
      if (state === 'liquid' && this.oceanState === 'frozen' && this.flags.ocean && !quiet) { this.lastClimLog = w.years; this.log('Volcanic carbon dioxide warmed you up: your oceans thawed', 'geo'); }
      if (state === 'steam' && this.oceanState === 'liquid') this.log('Runaway greenhouse: your oceans boiled into a thick steam sky', 'bad');
      this.oceanState = state;
    }
    // iron and carbon worlds have little surface water to begin with
    this.iceCover = clamp(1 - (this.Ts - 230) / 45, 0, 1) * (water > 0.0005 ? 1 : 0.3) * this.iceExposed;

    // water vapour high up is split by starlight; without a field the hydrogen escapes
    if (state === 'steam' || (this.P > 0 && this.field < 0.1 && liquid)) {
      const lossRate = (state === 'steam' ? 3e-9 : 2e-11) * F * (1 - shield * 0.8);
      p.comp.ice = Math.max(0, p.comp.ice * Math.exp(-years * lossRate));
    }
    this.habitable = state === 'liquid' && this.P > 0.05 && this.Ts > 260 && this.Ts < 340;
    // ---- Earth Similarity Index (Schulze-Makuch et al. 2011)
    const rho = p.mass / ((4 / 3) * Math.PI * Math.pow(p.radius, 3)) / 1e12;
    const term = (x, x0, wt) => Math.pow(1 - Math.abs(x - x0) / (x + x0), wt);
    this.esi = Math.pow(term(p.radius / R_EARTH, 1, 0.57) * term(rho / RHO_EARTH, 1, 1.07) * term(vesc / 11.19, 1, 0.7) * term(Math.max(this.Ts, 3), 288, 5.58), 0.25);
    this.gSurf = gSurf;
    this.updateMoonFormation(rs, years);
    this.updateRing(rs, years);
  }

  // volatiles from a meal that stay as air (needs enough gravity to hold them)
  deliver(comp, m) {
    const p = this.world.player;
    if (!p || p.comp.gas >= 0.3 || p.isStar || p.compact) return;
    const vesc = escapeVelocity(p.mass, p.radius);
    const holds = smoothstep(1.5, 4.5, vesc);
    if (holds <= 0 || !(m > 0)) return;
    const Rm = p.radius * 1000;
    const gS = (G * p.mass) / (p.radius * p.radius) * 1000;
    const barPerKg = gS / (4 * Math.PI * Rm * Rm) / 1e5;
    const ice = (comp.ice || 0) * m, carbon = (comp.carbon || 0) * m, gas = (comp.gas || 0) * m;
    // most of it is lost in the impact or locked in rock: only a trace stays in the air
    this.atm.co2 += (ice * 3e-5 + carbon * 6e-5) * barPerKg * holds;
    this.atm.n2 += (ice * 1e-5 + gas * 2e-4) * barPerKg * holds;
  }

  // starlight at your position relative to what Earth gets
  flux() {
    const w = this.world, p = w.player;
    let F = 0;
    for (const s of w.stars) {
      if (!s.alive) continue;
      const d = p.distTo(s);
      const dReal = s.radius + Math.max(0, d - s.radius) * DIST_COMPRESS;
      F += (s.lum || 0) / Math.pow(dReal / 1.496e8, 2);
    }
    return F;
  }

  // squeezing by a big neighbour heats your insides (like Jupiter's moon Io)
  tidalHeating() {
    const w = this.world, p = w.player;
    let heat = 0;
    for (const b of w.attractors) {
      if (b === p || b.mass < p.mass * 10 || b.isStar) continue;
      const d = p.distTo(b);
      heat += clamp(Math.pow((b.radius * 8) / d, 4) * Math.cbrt(b.mass / (M_EARTH * 300)), 0, 0.6);
    }
    return heat;
  }

  // a giant impact's debris ring clumps into a moon outside the Roche limit
  updateMoonFormation(rs, years) {
    const dd = this.debrisDisk;
    if (!dd) return;
    const w = this.world, p = w.player;
    dd.t += rs + years / 1000;
    if (dd.t < 40) return;
    this.debrisDisk = null;
    const m = dd.mass * 0.5;
    const r = p.radius * w.rng.range(3.6, 5.5);
    const v = Math.sqrt((G * p.mass) / r);
    const n = w.ringNormal;
    const ax = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let e1 = { x: ax.y * n.z - ax.z * n.y, y: ax.z * n.x - ax.x * n.z, z: ax.x * n.y - ax.y * n.x };
    const l = Math.hypot(e1.x, e1.y, e1.z);
    e1 = { x: e1.x / l, y: e1.y / l, z: e1.z / l };
    const e2 = { x: n.y * e1.z - n.z * e1.y, y: n.z * e1.x - n.x * e1.z, z: n.x * e1.y - n.y * e1.x };
    const moon = new Body({
      role: 'field', name: `${p.name} I`, mass: m, comp: { ...p.comp, iron: p.comp.iron * 0.3, rock: p.comp.rock + p.comp.iron * 0.7 },
      x: p.x + e1.x * r, y: p.y + e1.y * r, z: p.z + e1.z * r,
      vx: p.vx + e2.x * v, vy: p.vy + e2.y * v, vz: p.vz + e2.z * v,
      seed: dd.seed, temp: p.temp, heat: 0.6, fadeIn: 0,
    });
    moon.moonOf = p;
    moon.moonName = moon.name;
    moon.bornMoon = true;
    w.addBody(moon);
    this.log(`The debris clumped together into a new moon: ${moon.name}`, 'moon');
    w.emit('moon', { body: moon, born: true });
  }

  // shredded moons make rings that slowly rain down on you
  addRing(mass) {
    const p = this.world.player;
    if (!this.ring) this.ring = { mass: 0, inner: 1.25, outer: 2.2, seed: (Math.random() * 1e9) | 0 };
    this.ring.mass += mass;
    this.ring.outer = Math.min(2.6, 1.8 + Math.sqrt(this.ring.mass / p.mass) * 6);
  }

  updateRing(rs, years) {
    const r = this.ring;
    const p = this.world.player;
    if (!r) {
      if (p.rings && p.rings.fromModel) p.rings = null;
      return;
    }
    // rings rain down over a few hundred million years (Saturn's are doing this now)
    const fall = r.mass * (1 - Math.exp(-years / 3e8 - rs / 3000));
    r.mass -= fall;
    p.mass += fall;
    if (r.mass < p.mass * 1e-10 || p.isStar || p.compact) this.ring = null;
    // what the renderer draws: thin rings are faint, massive ones opaque like Saturn's
    const op = clamp((Math.log10(Math.max(r.mass / p.mass, 1e-12)) + 9.5) / 3, 0.05, 0.95);
    p.rings = this.ring ? { inner: r.inner, outer: r.outer, opacity: op, seed: r.seed, fromModel: true } : null;
  }

  // what's inside you, for the cutaway view: layers from the centre out
  structure() {
    return structureOf(this.world.player, this);
  }
}

// ---------------------------------------------------------------- interior structure

const LAYER_COLORS = {
  innerCore: [1.0, 0.85, 0.55], outerCore: [1.0, 0.55, 0.2], mantle: [0.75, 0.28, 0.12], crust: [0.42, 0.34, 0.28],
  ocean: [0.08, 0.25, 0.55], ice: [0.75, 0.86, 0.95], hpIce: [0.45, 0.62, 0.8], magma: [1.0, 0.42, 0.1],
  graphite: [0.25, 0.25, 0.27], diamond: [0.82, 0.92, 1.0], metalH: [0.62, 0.66, 0.78], molH: [0.85, 0.72, 0.5],
  iceMantle: [0.3, 0.55, 0.75], clouds: [0.95, 0.88, 0.75], fusion: [1.0, 0.98, 0.85], radiative: [1.0, 0.75, 0.35],
  convective: [1.0, 0.5, 0.15], degenerate: [0.85, 0.9, 1.0], neutron: [0.6, 0.7, 1.0], nCrust: [0.75, 0.75, 0.82],
  atmosphere: [0.45, 0.65, 1.0], heCore: [1.0, 0.95, 0.9],
};

export function structureOf(p, model) {
  const M = p.mass, R = p.radius;
  const me = M / M_EARTH;
  const c = p.comp;
  const L = [];
  const add = (key, name, r1, note) => L.push({ key, name, r1, color: LAYER_COLORS[key], note });
  if (p.compact === 'bh') {
    return { kind: 'bh', layers: [{ key: 'bh', name: 'Event horizon', r1: 1, color: [0, 0, 0], note: 'Inside, every path leads to the centre. Nothing comes back out.' }], center: { T: 0, P: Infinity } };
  }
  if (p.compact === 'ns') {
    add('neutron', 'Neutron superfluid core', 0.9, 'Neutrons packed tighter than an atomic nucleus');
    add('nCrust', 'Iron-nuclei crust', 1.0, 'A crystal of nuclei about 1 km thick');
    return { kind: 'ns', layers: L, center: { T: 1e9, P: 1e29 } };
  }
  if (p.compact === 'wd') {
    add('degenerate', 'Carbon-oxygen core (crystallising)', 0.98, 'Electron pressure holds it up; it slowly freezes into a diamond-like crystal');
    add('atmosphere', 'Thin helium-hydrogen skin', 1.0, 'Only about 100 km thick');
    return { kind: 'wd', layers: L, center: { T: 1e7, P: 1e21 } };
  }
  if (p.isStar) {
    const ms = M / M_SUN;
    if (p.phase === 'rg') {
      add('heCore', 'Helium core', 0.002, 'Tiny, dense and hot: about the size of Earth');
      add('fusion', 'Hydrogen-burning shell', 0.01, '');
      add('convective', 'Huge convective envelope', 1.0, 'Boiling gas up to hundreds of Suns wide');
      return { kind: 'star', layers: L, center: { T: 1e8, P: 1e17 } };
    }
    const coreR = ms < 0.35 ? 0.3 : 0.25;
    add('fusion', 'Fusion core', coreR, 'Hydrogen fuses into helium here');
    if (ms < 0.35) add('convective', 'Fully convective body', 1.0, 'Red dwarfs stir all the way through');
    else if (ms < 1.3) { add('radiative', 'Radiative zone', 0.7, 'Light takes over 100,000 years to cross this'); add('convective', 'Convective zone', 1.0, 'Hot gas rises and sinks like boiling soup'); }
    else { add('convective', 'Convective core', coreR + 0.08, ''); add('radiative', 'Radiative envelope', 1.0, ''); }
    return { kind: 'star', layers: L, center: { T: 1.57e7 * Math.pow(ms, 0.5), P: 2.5e11 * Math.pow(ms, -0.5) } };
  }
  if (c.gas >= 0.3 && me >= 6) {
    const coreFrac = clamp(Math.cbrt((c.rock + c.iron + c.ice * 0.3) * 0.4), 0.06, 0.35);
    add('crust', 'Rock and iron core', coreFrac, '');
    if (me > 60) {
      add('metalH', 'Metallic hydrogen', 0.78, 'Hydrogen squeezed so hard it conducts electricity like a metal');
      add('molH', 'Molecular hydrogen and helium', 0.985, '');
    } else {
      add('iceMantle', 'Hot water-ammonia-methane mantle', 0.75, 'Called "ice" but actually a hot dense fluid');
      add('molH', 'Hydrogen-helium envelope', 0.985, '');
    }
    add('clouds', 'Cloud decks', 1.0, 'Ammonia, water and sulfur clouds');
    return { kind: 'giant', layers: L, center: { T: me > 60 ? 2.4e4 : 7000, P: me > 60 ? 4e7 : 8e6 } };
  }
  // rocky (and icy, iron, carbon) worlds
  const coreR = clamp(Math.sqrt(Math.max(c.iron, 0.01)) * (model?.differentiated ? 1 : 0.4), 0.05, 0.85);
  const molten = ((model?.magma ?? 0) > 0.35 || p.heat > 0.5) && (model?.meltable ?? 1) > 0.3;
  if (model?.differentiated) {
    add('innerCore', 'Solid inner core', coreR * ((model?.H ?? 0.5) < 0.6 ? 0.38 : 0.12), 'Solid iron, squeezed solid despite the heat');
    add('outerCore', model?.field > 0.15 ? 'Liquid outer core (dynamo)' : 'Iron outer core', coreR, model?.field > 0.15 ? 'Swirling liquid iron makes your magnetic field' : '');
  }
  if (c.carbon >= 0.25 && me >= 1) add('diamond', 'Diamond layer', coreR + (1 - coreR) * 0.45, 'Carbon crushed into diamond');
  const iceFrac = c.ice;
  const rockTop = 1 - clamp(iceFrac * 0.9, 0, 0.6);
  if (molten) add('magma', 'Magma ocean', rockTop, 'Your surface is molten rock');
  else add('mantle', 'Rocky mantle', rockTop * 0.985, 'Slowly flowing hot rock');
  if (!molten) add(c.carbon >= 0.25 ? 'graphite' : 'crust', c.carbon >= 0.25 ? 'Graphite crust' : 'Crust', rockTop, '');
  if (iceFrac > 0.15 && me > 0.5) add('hpIce', 'High-pressure ice', rockTop + (1 - rockTop) * 0.55, 'Water ice forms that only exist under huge pressure');
  if (iceFrac > 0.002) {
    const st = model?.oceanState;
    add(st === 'liquid' ? 'ocean' : 'ice', st === 'liquid' ? 'Ocean' : 'Ice shell', 1.0, st === 'liquid' ? '' : 'Frozen water');
  }
  if (L[L.length - 1].r1 < 1) L[L.length - 1].r1 = 1;
  // centre conditions: rough scaling from Earth (about 5,500 K and 3.6 million bar)
  return { kind: 'rocky', layers: L, center: { T: Math.max(model?.Ts || p.temp, 5500 * Math.pow(Math.max(me, 1e-6), 0.3)), P: 3.6e6 * Math.pow(Math.max(me, 1e-9), 1.5) * Math.pow(R_EARTH / Math.max(R, 1), 2) } };
}

// temperature (K) and pressure (bar) at a fraction f of the radius (0 = centre)
export function probe(p, model, f) {
  const s = structureOf(p, model);
  const Tc = s.center.T, Pc = s.center.P;
  const Tsurf = p.isStar ? p.starTemp : p.compact ? (p.compact === 'wd' ? p.wdTemp || 1e4 : 1e6) : model?.Ts ?? p.temp;
  const Psurf = model?.P ?? 0;
  const k = 1 - f * f;
  const T = Tsurf + (Tc - Tsurf) * Math.pow(Math.max(k, 0), 0.7);
  const P = Psurf + (Pc - Psurf) * Math.pow(Math.max(k, 0), 1.6);
  let layer = s.layers[s.layers.length - 1];
  for (const l of s.layers) if (f <= l.r1) { layer = l; break; }
  return { T, P, layer, depthKm: (1 - f) * p.radius };
}

export { TIME_BASE, R_SUN };
