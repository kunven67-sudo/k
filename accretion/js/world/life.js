// Life and civilisation on your world. It appears by itself when the conditions
// are right and evolves on geological time, roughly following Earth's history:
// microbes (~4 billion years ago), oxygen from photosynthesis (the Great
// Oxygenation, ~2.4 Gyr ago), complex cells, plants on land, animals, and
// (rarely, late) intelligence. You can't control it, only shape its world.
import { G, M_EARTH, LY, TIME_BASE } from '../core/constants.js';
import { clamp, smoothstep } from '../core/phys.js';

export const LIFE_STAGES = [
  { id: 'none', name: 'Lifeless', short: 'None' },
  { id: 'microbes', name: 'Microbes', short: 'Microbes', T: 3e8, fact: 'The first life on Earth appeared within a few hundred million years of the oceans forming, probably at hot vents on the sea floor.' },
  { id: 'oxygen', name: 'Oxygen makers', short: 'Oxygen', T: 8e8, fact: 'Cyanobacteria learned to split water with sunlight. The oxygen they made slowly filled the air: the Great Oxygenation Event.' },
  { id: 'complex', name: 'Complex cells', short: 'Complex', T: 1e9, fact: 'Cells with a nucleus, then many-celled seaweeds. On Earth this took over a billion years after oxygen.' },
  { id: 'plants', name: 'Plants on land', short: 'Plants', T: 4e8, fact: 'An ozone layer (made from oxygen) blocked ultraviolet light, so plants could leave the sea. Your continents turn green.' },
  { id: 'animals', name: 'Animals', short: 'Animals', T: 1.5e8, fact: 'With enough oxygen, animals got big and diverse in a burst called the Cambrian explosion, 540 million years ago.' },
  { id: 'intelligence', name: 'Intelligence', short: 'Minds', T: 5e8, fact: 'One species learned to make tools, talk and plan. On Earth this took about 500 million years after the first animals.' },
  { id: 'cities', name: 'Cities', short: 'Cities', T: 1.5e5, Treal: 35, civ: true, fact: 'Farming, then cities, then industry. City lights now sparkle on your night side.' },
  { id: 'space', name: 'Space age', short: 'Space', T: 300, Treal: 35, civ: true, fact: 'Satellites, space stations and telescopes. They can also push away dangerous asteroids, like NASA’s DART mission did in 2022.' },
  { id: 'colonies', name: 'Colonies', short: 'Colonies', T: 400, Treal: 50, civ: true, fact: 'Bases on moons and nearby planets. Your life is no longer on one world.' },
  { id: 'interstellar', name: 'Interstellar probes', short: 'Probes', T: 3000, Treal: 60, civ: true, fact: 'Probes sail to other stars at a tenth of light speed and send back maps.' },
  { id: 'dyson', name: 'Dyson swarm', short: 'Dyson', T: 1e5, Treal: 90, civ: true, fact: 'Trillions of solar collectors circle your star, catching a big part of its light. Physicist Freeman Dyson imagined this in 1960.' },
];
export const LIFE = Object.fromEntries(LIFE_STAGES.map((s, i) => [s.id, i]));

export class LifeModel {
  constructor(world, planet, saved = null) {
    this.key = 'life';
    this.world = world;
    this.planet = planet;
    const s = saved || {};
    this.stage = s.stage ?? 0;
    this.biomass = s.biomass ?? 0;
    this.progress = s.progress ?? 0;
    this.need = s.need ?? this.drawNeed();
    this.oxProg = s.oxProg ?? 0;
    this.radiation = 0;
    this.recovery = s.recovery ?? 0;      // boosted evolution after an extinction
    this.extinctions = s.extinctions || [];
    this.timeline = s.timeline || [];
    this.peak = s.peak ?? 0;
    this.sats = s.sats ?? 0;
    this.stations = s.stations ?? 0;
    this.deflected = s.deflected ?? 0;
    this.probeStart = s.probeStart ?? null;
    this.dyson = s.dyson ?? 0;
    this.colonies = s.colonies || [];
    this.moonLifeT = 0;
    this.ended = s.ended || null;
    this.alienFound = s.alienFound || [];
    this.stress = 0;
  }

  serialize() {
    return {
      stage: this.stage, biomass: this.biomass, progress: this.progress, need: this.need, oxProg: this.oxProg,
      recovery: this.recovery, extinctions: this.extinctions.slice(-40), timeline: this.timeline, peak: this.peak,
      sats: this.sats, stations: this.stations, deflected: this.deflected, probeStart: this.probeStart,
      dyson: this.dyson, colonies: this.colonies, ended: this.ended, alienFound: this.alienFound,
    };
  }

  // the random waiting time for the next step, in units of its mean (exponential)
  drawNeed() {
    return Math.max(0.05, -Math.log(1 - Math.random() * 0.98));
  }

  get name() {
    return LIFE_STAGES[this.stage].name;
  }

  get civ() {
    return this.stage >= LIFE.cities;
  }

  // the age of your world in years
  age() {
    const w = this.world;
    return w.years - (w.player?.born || 0);
  }

  log(text, kind = 'life') {
    this.planet.log(text, kind);
  }

  setStage(s, why = null) {
    const w = this.world;
    const prev = this.stage;
    if (s === prev) return;
    this.stage = s;
    this.progress = 0;
    this.need = this.drawNeed();
    this.peak = Math.max(this.peak, s);
    this.timeline.push({ years: this.age(), stage: s });
    if (this.timeline.length > 120) this.timeline.splice(1, 1);
    const st = LIFE_STAGES[s];
    if (s > prev) {
      this.log(why || `${st.name} appeared`, 'life');
      w.emit('life', { stage: s, id: st.id, name: st.name, fact: st.fact });
      // when minds appear, the clock slows so you can watch them build
      if (s === LIFE.intelligence && w.deep) {
        w.setDeep(0);
        w.emit('life-wake', {});
      }
    } else {
      w.emit('life-lost', { stage: s, from: prev, why });
    }
  }

  // ---------------------------------------------------------------- events

  onEvent(type, e) {
    const w = this.world, p = w.player;
    if (!p || !p.alive || this.stage === 0) {
      if (type === 'impact' && e.life && !e.fragment) this.alienMeal(e);
      return;
    }
    if (type === 'impact') {
      if (e.life && !e.fragment) this.alienMeal(e);
      // impact energy in joules, softened for bigger worlds
      const E = 0.5 * e.mass * e.vrel * e.vrel * 1e6 / Math.pow(Math.max(p.mass / M_EARTH, 0.05), 0.8);
      if (E > 1e21) this.impactExtinction(E, e.name);
    } else if (type === 'grb') {
      const d = e.dist ?? 5000;
      const k = 0.1 + 0.5 * clamp((8000 - d) / 6000, 0, 1);
      this.extinction(k, `A gamma-ray burst ${Math.round(d).toLocaleString('en-US')} light-years away stripped your ozone layer`, { landOnly: true });
    } else if (type === 'distant-supernova' && e.ly < 50) {
      const k = 0.1 + 0.4 * clamp(1 - e.ly / 50, 0, 1);
      this.extinction(k, `${e.name} exploded ${e.ly.toFixed(0)} light-years away and its radiation hit you`, { landOnly: true });
    } else if (type === 'blast-hit' && e.frac > 0.0001) {
      this.extinction(clamp(0.4 + e.frac * 10, 0, 1), `The blast wave of ${e.sysName || 'a supernova'} swept over you`);
    } else if (type === 'magnetar-flare') {
      if (this.planet.field < 0.15) this.extinction(0.12, `A giant flare from the magnetar ${e.name}`, { landOnly: true });
    } else if (type === 'stellar-flare' && e.strong) {
      if (this.planet.field < 0.15) this.extinction(0.08, 'A superflare from your star', { landOnly: true });
    } else if (type === 'bombard') {
      // in deep time: now and then a big asteroid strikes (about every 100 million years on Earth)
      const big = w.rng.chance(1 - Math.exp(-e.years / 1e8));
      if (big) {
        if (this.stage >= LIFE.space && w.rng.chance(this.defendChance())) {
          this.deflected++;
          this.log('Your civilisation spotted a 10 km asteroid and pushed it off course', 'civ');
          w.emit('deflect', { name: 'an asteroid', deep: true });
        } else {
          const E = w.rng.logRange(5e22, 2e24);
          this.impactExtinction(E, 'a 10 km asteroid');
        }
      }
    }
  }

  // eating a world that was alive: it's remembered
  alienMeal(e) {
    this.log(e.life === 2 ? `You swallowed ${e.name}, a world with a civilisation` : `You swallowed ${e.name}, a world with life`, 'alien');
  }

  impactExtinction(E, what) {
    const k = clamp((Math.log10(E) - 21) / 3.6, 0, 1);
    const sterilise = E > 3e27;
    if (k < 0.05 && !sterilise) return;
    const tnt = E / 4.184e15; // megatons... per joule
    const desc = tnt > 1e9 ? `${(tnt / 1e9).toPrecision(2)} billion megatons` : tnt > 1e6 ? `${(tnt / 1e6).toPrecision(2)} million megatons` : `${Math.round(tnt).toLocaleString('en-US')} megatons`;
    this.extinction(sterilise ? 1 : k, `Impact of ${what} (${desc})`, { sterilise });
  }

  // k: fraction of species killed
  extinction(k, cause, opt = {}) {
    if (this.stage === 0 || k <= 0.02) return;
    const w = this.world;
    let kk = k;
    if (opt.landOnly && this.stage < LIFE.plants) kk *= 0.25;
    this.biomass *= 1 - kk * 0.9;
    const pct = Math.round(kk * 100);
    const prev = this.stage;
    let lost = false;
    if (opt.sterilise) {
      // a world-melting impact: only microbes deep in the rock might survive, and only sometimes
      if (w.rng.chance(0.3) && this.stage >= LIFE.microbes) {
        this.setStage(LIFE.microbes, null);
        this.biomass = 0.02;
        cause += '. Only microbes deep in the rock survived';
      } else {
        this.endLife(`${cause}. Your surface melted and every living thing died.`);
        return;
      }
      lost = true;
    } else if (this.stage >= LIFE.cities && kk > 0.32) {
      // civilisations are fragile
      this.setStage(LIFE.animals, null);
      cause += '. Your civilisation collapsed';
      lost = true;
    } else if (this.stage === LIFE.intelligence && kk > 0.55) {
      this.setStage(LIFE.animals, null);
      cause += '. The thinking species died out';
      lost = true;
    } else if (kk > 0.93 && this.stage > LIFE.complex) {
      this.setStage(LIFE.complex, null);
      cause += '. Only sea life survived';
      lost = true;
    }
    if (kk > 0.12 || lost) {
      this.extinctions.push({ years: this.age(), k: kk, cause, stage: prev });
      this.log(`Mass extinction: ${pct}% of species died. ${cause}`, 'extinct');
      w.emit('extinction', { k: kk, cause, pct });
      // evolution is set back, but survivors fill the empty niches fast
      this.progress *= 1 - kk;
      this.recovery = Math.max(this.recovery, kk);
    }
  }

  endLife(why) {
    if (this.stage === 0) return;
    const w = this.world;
    const prev = this.stage;
    this.extinctions.push({ years: this.age(), k: 1, cause: why, stage: prev });
    this.ended = { years: this.age(), why, peak: LIFE_STAGES[this.peak].name };
    this.stage = 0;
    this.biomass = 0;
    this.progress = 0;
    this.need = this.drawNeed();
    this.oxProg = 0;
    this.sats = 0;
    this.stations = 0;
    this.dyson = 0;
    this.timeline.push({ years: this.age(), stage: 0 });
    for (const c of this.colonies) {
      const b = this.world.bodies.find((x) => x.alive && x.id === c.id);
      if (b && b.colony) { b.colony = false; b.life = c.native ? 1 : 0; }
    }
    this.colonies = [];
    this.log(`Life ended: ${why}`, 'extinct');
    w.emit('life-lost', { stage: 0, from: prev, why, end: true });
  }

  // ---------------------------------------------------------------- update

  update(rs, years) {
    const w = this.world, p = w.player, pl = this.planet;
    if (!p || !p.alive) return;
    // giants, stars and stellar remnants can't hold life on themselves
    if (pl.giant) {
      if (this.stage > 0) {
        const why = p.compact ? 'your world collapsed into a stellar remnant'
          : p.isStar ? 'you ignited as a star'
            : 'you swallowed so much gas that your surface became crushing hydrogen';
        this.endLife(why);
      }
      this.moonLife(rs, years);
      this.applyLook();
      return;
    }
    // hard limits: a magma ocean, boiled or vanished oceans
    if (this.stage > 0) {
      if (p.heat > 0.55) this.endLife('impacts melted your surface into a magma ocean');
      else if (pl.oceanState === 'steam' || pl.Ts > 400) this.endLife('your oceans boiled away');
      else if (pl.oceanState === 'none' || p.comp.ice < 0.0003) this.endLife('your water was lost to space');
    }
    const h = this.habitability();
    this.hab = h;
    // ---- climate stress on complex life (slow killers)
    if (this.stage >= LIFE.complex) {
      const hot = pl.Ts > 325, snowball = pl.iceCover > 0.9 && pl.oceanState === 'frozen';
      this.stress = hot || snowball ? this.stress + years / 2e5 + rs / 20 : Math.max(0, this.stress - years / 1e6);
      if (this.stress > 1) {
        this.stress = 0;
        this.extinction(hot ? 0.85 : 0.8, hot ? 'Your climate grew too hot' : 'A snowball glaciation froze your oceans', {});
        if (this.stage > LIFE.oxygen) this.setStage(LIFE.oxygen, null);
      }
    }
    // ---- abiogenesis and evolution
    if (this.stage === 0) {
      if (h.micro > 0) {
        this.progress += (years * h.micro) / LIFE_STAGES[1].T;
        if (this.progress >= this.need) this.setStage(LIFE.microbes, h.subsurface ? 'Microbes appeared in your hidden ocean' : 'Life began: microbes in your oceans');
      }
    } else if (this.stage < LIFE_STAGES.length - 1) {
      const next = LIFE_STAGES[this.stage + 1];
      const ok = this.canAdvance(this.stage + 1, h);
      if (ok > 0) {
        const boost = 1 + this.recovery * 2;
        this.progress += ((years * ok * boost) / next.T) + (next.Treal ? (rs * ok) / next.Treal : 0);
        if (this.progress >= this.need) this.setStage(this.stage + 1);
      }
    }
    this.recovery = Math.max(0, this.recovery - years / 3e7 - rs / 600);
    // ---- biomass grows toward what the world can support
    const K = this.stage === 0 ? 0 : clamp(h.complex * (this.stage >= LIFE.plants ? 1 : 0.35) + 0.15, 0.05, 1);
    const g = 1 - Math.exp(-(years / 3e6) - rs / 25);
    this.biomass += (K - this.biomass) * g;
    // ---- life changes the air
    this.updateAir(years, rs);
    // ---- civilisation
    if (this.civ) this.updateCiv(rs, years);
    this.moonLife(rs, years);
    this.applyLook();
  }

  // how good your world is for life right now (0..1 for microbes and for complex life)
  habitability() {
    const w = this.world, p = w.player, pl = this.planet;
    const out = { micro: 0, complex: 0, subsurface: false };
    const liquid = pl.oceanState === 'liquid';
    if (liquid && pl.P > 0.006) {
      out.micro = smoothstep(240, 270, pl.Ts) * (1 - smoothstep(370, 395, pl.Ts));
      out.complex = smoothstep(255, 280, pl.Ts) * (1 - smoothstep(310, 325, pl.Ts)) * (1 - pl.iceCover * 0.8);
    } else if (p.comp.ice > 0.1 && (pl.H > 0.35 || pl.tidalHeat > 0.05) && p.mass > 1e21) {
      // an ocean under the ice, kept warm from inside (like Europa or Enceladus)
      out.micro = 0.35;
      out.subsurface = true;
    }
    return out;
  }

  canAdvance(s, h) {
    const pl = this.planet;
    const o2 = pl.atm.o2;
    if (h.subsurface) return s <= LIFE.microbes ? h.micro : 0;
    switch (s) {
      case LIFE.oxygen: return h.micro;
      case LIFE.complex: return o2 > 0.01 ? h.micro : 0;
      case LIFE.plants: return o2 > 0.03 ? h.complex : 0;
      case LIFE.animals: return o2 > 0.08 ? h.complex : 0;
      case LIFE.intelligence: return o2 > 0.1 ? h.complex * (pl.coolEvent > 2 ? 0.3 : 1) : 0;
      default: return h.complex > 0.1 ? 1 : 0.4; // civilisations shield themselves
    }
  }

  updateAir(years, rs) {
    const pl = this.planet;
    const atm = pl.atm;
    if (this.stage >= LIFE.microbes && this.stage < LIFE.oxygen) {
      // methane-making microbes warmed the early Earth under a faint young Sun
      atm.ch4 += (0.002 * this.biomass - atm.ch4) * (1 - Math.exp(-years / 1e7));
    }
    if (this.stage >= LIFE.oxygen) {
      // oxygen first rusts the rocks and oceans; only later does it build up in the air
      const before = this.oxProg;
      this.oxProg += years / 4e8 + rs / 400;
      if (before < 1 && this.oxProg >= 1) this.log('The Great Oxygenation: oxygen is building up in your air', 'life');
      const target = 0.21 * clamp(this.biomass * 1.4, 0, 1) * smoothstep(0.8, 2.2, this.oxProg) * clamp(Math.sqrt(Math.max(pl.P, 0.01)), 0.3, 2);
      atm.o2 += (target - atm.o2) * (1 - Math.exp(-years / 2e7 - rs / 30));
      // oxygen destroys methane
      atm.ch4 *= Math.exp(-years / 3e6 * clamp(atm.o2 * 10, 0, 1));
      atm.ch4 = Math.max(atm.ch4, 2e-6 * this.biomass);
      // plants pull down CO2
      if (this.stage >= LIFE.plants) atm.co2 *= Math.exp(-years / 4e8);
    } else if (this.stage === 0) {
      atm.o2 *= Math.exp(-years / 1e7);
      atm.ch4 *= Math.exp(-years / 1e7);
    }
  }

  defendChance() {
    return this.stage >= LIFE.interstellar ? 0.97 : this.stage >= LIFE.colonies ? 0.85 : 0.6;
  }

  updateCiv(rs, years) {
    const w = this.world, p = w.player;
    const prog = clamp(this.progress / Math.max(this.need, 0.05), 0, 1);
    // satellites and stations
    if (this.stage >= LIFE.space) {
      const target = this.stage === LIFE.space ? 400 + 2600 * prog : 3000 + (this.stage - LIFE.space) * 1500;
      this.sats += (target - this.sats) * (1 - Math.exp(-rs / 8 - years / 100));
      this.stations = this.stage === LIFE.space ? (prog > 0.5 ? 1 : 0) : Math.min(4, this.stage - LIFE.space + 1);
    }
    // colonies: moons first, then other planets in the system
    if (this.stage >= LIFE.colonies) {
      const want = this.stage === LIFE.colonies ? Math.ceil(prog * 3) : 6;
      if (this.colonies.length < want && w.rng.chance(1 - Math.exp(-rs / 6 - years / 200))) this.foundColony();
    }
    // interstellar probes at a tenth of light speed
    if (this.stage >= LIFE.interstellar && this.probeStart == null) {
      this.probeStart = w.years;
      this.log('The first interstellar probes have launched', 'civ');
    }
    // Dyson swarm
    if (this.stage >= LIFE.dyson) {
      this.dyson = Math.min(0.95, this.dyson + rs / 120 + years / 1e5);
      w.civThrust = 1.2;
    } else {
      w.civThrust = 0;
    }
    // planetary defence: push away incoming planet-killers (unless you've locked onto them)
    if (this.stage >= LIFE.space) this.defend();
  }

  // how far (in light-years) the probes have reached
  probeReachLy() {
    if (this.probeStart == null) return 0;
    return Math.max(0, (this.world.years - this.probeStart) * 0.1);
  }

  foundColony() {
    const w = this.world, p = w.player;
    const host = w.hostSystem();
    const cands = [];
    for (const b of w.bodies) {
      if (!b.alive || b === p || b.colony || b.isStar || b.compact) continue;
      if (b.moonOf === p) cands.push([0, b]);
      else if (b.rails && host && b.system === host && !b.rails.parent.isStar) cands.push([1, b]);
      else if (b.rails && host && b.system === host && b.mass > 1e22 && b.comp.gas < 0.3) cands.push([2 + p.distTo(b) / 1e9, b]);
    }
    if (!cands.length) return;
    cands.sort((a, b) => a[0] - b[0]);
    const b = cands[0][1];
    b.colony = true;
    const native = b.life || 0;
    b.life = 2;
    this.colonies.push({ id: b.id, name: b.name, key: b.persistentKey || null, native });
    this.log(`A colony was founded on ${b.name}`, 'civ');
    w.emit('colony', { name: b.name, body: b });
  }

  defend() {
    const w = this.world, p = w.player;
    const lock = w.input.target;
    for (const b of w.bodies) {
      if (!b.alive || b === p || b.dartChecked || b.moonOf === p || b === lock) continue;
      if (b.role !== 'field' && b.role !== 'free') continue;
      const rx = b.x - p.x, ry = b.y - p.y, rz = b.z - p.z;
      const vx = b.vx - p.vx, vy = b.vy - p.vy, vz = b.vz - p.vz;
      const d = Math.hypot(rx, ry, rz);
      if (d > p.rEff * 40) continue;
      const vv = vx * vx + vy * vy + vz * vz;
      if (vv <= 0) continue;
      const tc = -(rx * vx + ry * vy + rz * vz) / vv;  // seconds of sim time to closest approach
      if (tc <= 0 || tc > TIME_BASE * 6) continue;
      const cx = rx + vx * tc, cy = ry + vy * tc, cz = rz + vz * tc;
      const miss = Math.hypot(cx, cy, cz);
      // gravity focusing pulls near misses in
      const vInf = Math.sqrt(vv);
      const vesc = Math.sqrt((2 * G * p.mass) / p.rEff);
      const capture = p.rEff * Math.sqrt(1 + (vesc * vesc) / (vInf * vInf));
      if (miss > capture * 1.05) continue;
      // big enough to matter?
      const E = 0.5 * b.mass * (vv + vesc * vesc) * 1e6 / Math.pow(Math.max(p.mass / M_EARTH, 0.05), 0.8);
      if (E < 3e22) continue;
      b.dartChecked = true;
      if (!w.rng.chance(this.defendChance())) {
        w.emit('deflect-failed', { name: b.name });
        continue;
      }
      // push it sideways so it misses by a safe margin
      let ux = cx, uy = cy, uz = cz;
      let ul = Math.hypot(ux, uy, uz);
      if (ul < 1e-6) {
        const t = { x: -vy, y: vx, z: 0 };
        ux = t.x; uy = t.y; uz = t.z; ul = Math.hypot(ux, uy, uz) || 1;
      }
      ux /= ul; uy /= ul; uz /= ul;
      const dv = (capture * 2.6 - miss) / tc;
      b.vx += ux * dv; b.vy += uy * dv; b.vz += uz * dv;
      b.deflected = true;
      this.deflected++;
      this.log(`Your civilisation deflected ${b.name}`, 'civ');
      w.emit('deflect', { name: b.name, body: b });
    }
  }

  // moons can grow life of their own in oceans under their ice, warmed by tides
  moonLife(rs, years) {
    const w = this.world, p = w.player;
    if (years <= 0) return;
    for (const b of w.bodies) {
      if (!b.alive || b.moonOf !== p || b.life) continue;
      if (b.comp.ice < 0.15 || b.mass < 5e20) continue;
      const d = p.distTo(b);
      const tide = clamp(Math.pow((p.radius * 12) / d, 3) * Math.cbrt(p.mass / (M_EARTH * 50)), 0, 1);
      if (tide < 0.05) continue;
      if (w.rng.chance(1 - Math.exp(-(years * tide) / 1.5e9))) {
        b.life = 1;
        b.nativeLife = true;
        this.log(`Microbes appeared in the hidden ocean of ${b.name}, warmed by your tides`, 'life');
        w.emit('moon-life', { name: b.name, body: b });
      }
    }
  }

  // how life shows on your surface (read by the renderer)
  applyLook() {
    const p = this.world.player;
    const green = this.stage >= LIFE.plants ? clamp(this.biomass * 1.3, 0, 1) : this.stage >= LIFE.complex ? 0.12 * this.biomass : 0;
    const city = this.stage >= LIFE.cities ? clamp(0.25 + (this.stage - LIFE.cities) * 0.2 + clamp(this.progress / this.need, 0, 1) * 0.2, 0, 1) : 0;
    this.green = green;
    this.city = city;
    p.life = city > 0 ? 2 : green > 0.2 ? 1 : 0;
  }

  // what a spectrum of your air shows (for the telescope and info screen)
  biosignature() {
    const a = this.planet.atm;
    return a.o2 > 0.01 && a.ch4 > 1e-7;
  }

  // ---------------------------------------------------------------- summary

  summary() {
    return {
      stage: this.stage, name: this.name, biomass: this.biomass, o2: this.planet.atm.o2,
      sats: Math.round(this.sats), stations: this.stations, colonies: this.colonies.length,
      probes: this.probeReachLy(), dyson: this.dyson, deflected: this.deflected, extinctions: this.extinctions.length,
    };
  }
}

export { LY };
