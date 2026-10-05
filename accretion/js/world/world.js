// The simulation: gravity, orbits, collisions, tidal disruption, heat,
// hazards, and everything that happens to you as you grow.
import { Body } from './body.js';
import { Field } from './field.js';
import { generateSystemDetail } from './system.js';
import { RNG } from '../core/rng.js';
import {
  G, C, M_SUN, M_EARTH, M_JUP, AU, TIME_BASE, WARP_LEVELS, DIST_COMPRESS,
  NS_MAX_MASS, CORE_COLLAPSE_MASS, BH_FROM_SN_MASS, CORE_BURN_STAGES, STAGES,
} from '../core/constants.js';
import {
  clamp, rocheLimit, equilibriumTemp, escapeVelocity, circularVelocity, hillRadius,
  stageForMass, lerp,
} from '../core/phys.js';

const STAR_ACTIVATE = 9e9;
const PLANET_ACTIVATE = 2.2e9;
const BH_ACTIVATE = 2.5e10;
const CORE_ACTIVATE = 1.2e11;
const MAX_FRAGMENTS = 1100;

export class World {
  constructor(galaxy, opts = {}) {
    this.galaxy = galaxy;
    this.time = 0;
    this.bodies = [];
    this.attractors = [];
    this.stars = [];
    this.active = new Map();
    this.activeBH = new Map();
    this.coreBody = null;
    this.events = [];
    this.warpIndex = 0;
    this.warp = 1;
    this.quality = opts.quality || 'medium';
    this.rng = new RNG((Math.random() * 1e9) | 0);
    this.field = new Field(this);
    this.blasts = [];
    this.player = null;
    this.input = { thrust: { x: 0, y: 0, z: 0 }, level: 0, boost: false, brake: false, pull: false, target: null };
    this.tidalStress = 0;
    this.heatLoss = 0;
    this.thrustLoss = 0;
    this.stats = { eaten: 0, biggestMeal: 0, peakMass: 0, deaths: 0, systemsEaten: 0, lifeFound: 0, timePlayed: 0 };
    this.hazardTimer = 40;
    this.snTimer = 30;
    this.systemTimer = 0;
    this.lastStage = -1;
    this.core = null;  // core-collapse countdown while a massive star
    this.ringNormal = { x: 0, y: 1, z: 0 };
  }

  // ---------------------------------------------------------------- bodies

  addBody(b) {
    this.bodies.push(b);
    return b;
  }

  removeBody(b) {
    b.alive = false;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  // ---------------------------------------------------------------- setup

  spawnPlayer(state) {
    const g = this.galaxy;
    let sys = g.startSystem;
    if (state?.sysId != null) sys = g.systems[state.sysId] || sys;
    const p = new Body({
      role: 'player',
      name: state?.name || 'You',
      mass: state?.mass ?? 2.2e14,
      comp: state?.comp ?? { rock: 0.62, iron: 0.26, ice: 0.12, gas: 0 },
      compact: state?.compact ?? null,
      spin: 0.8,
      tilt: 0.35,
      seed: state?.seed ?? 4242,
    });
    p.heat = 0;
    p.life = state?.life || 0;
    this.player = p;
    this.addBody(p);
    if (state?.pos) {
      Object.assign(p, state.pos);
    } else {
      this.placeInSystem(p, sys, state?.orbitAU ?? 1.0);
    }
    this.refreshActiveSystems();
    this.rebuildAttractors();
    if (!state?.pos) this.circularize(p);
    this.field.update(0, true);
    this.lastStage = p.stage;
    this.stats.peakMass = Math.max(this.stats.peakMass, p.mass);
    return p;
  }

  // put a body on a circular orbit around a system's star at `au` game-AU
  placeInSystem(b, sys, au) {
    const tmp = { sys, detail: generateSystemDetail(sys) };
    const { e1, e2 } = tmp.detail.basis;
    const a = au * AU;
    const th = this.rng.range(0, Math.PI * 2);
    b.x = sys.x + a * (Math.cos(th) * e1.x + Math.sin(th) * e2.x);
    b.y = sys.y + a * (Math.cos(th) * e1.y + Math.sin(th) * e2.y);
    b.z = sys.z + a * (Math.cos(th) * e1.z + Math.sin(th) * e2.z);
    b.vx = b.vy = b.vz = 0;
  }

  circularize(b) {
    const f = this.referenceFrame(b.x, b.y, b.z, b);
    b.vx = f.vx; b.vy = f.vy; b.vz = f.vz;
  }

  // ---------------------------------------------------------------- systems

  refreshActiveSystems() {
    const p = this.player;
    const g = this.galaxy;
    const near = g.systemsNear(p.x, p.y, p.z, STAR_ACTIVATE);
    for (const sys of near) {
      if (this.active.has(sys.id) || sys.state?.destroyed) continue;
      this.activateSystem(sys);
    }
    for (const [id, e] of this.active) {
      const d = Math.hypot(e.sys.x - p.x, e.sys.y - p.y, e.sys.z - p.z);
      if (d > STAR_ACTIVATE * 1.3) {
        this.deactivateSystem(e);
        this.active.delete(id);
        continue;
      }
      if (!e.planetsActive && d < PLANET_ACTIVATE) this.activatePlanets(e);
      else if (e.planetsActive && d > PLANET_ACTIVATE * 1.3) this.deactivatePlanets(e);
    }
    // wandering black holes
    for (const bh of g.blackHoles) {
      if (!bh.alive) continue;
      const d = Math.hypot(bh.x - p.x, bh.y - p.y, bh.z - p.z);
      const body = this.activeBH.get(bh.id);
      if (!body && d < BH_ACTIVATE) {
        const b = new Body({ role: 'compact', compact: 'bh', name: bh.name, mass: bh.mass, x: bh.x, y: bh.y, z: bh.z, vx: bh.vx, vy: bh.vy, vz: bh.vz, comp: { rock: 0, iron: 0, ice: 0, gas: 1 } });
        b.galaxyBH = bh;
        this.addBody(b);
        this.activeBH.set(bh.id, b);
      } else if (body && (d > BH_ACTIVATE * 1.3 || !body.alive)) {
        if (body.alive) {
          Object.assign(bh, { x: body.x, y: body.y, z: body.z, vx: body.vx, vy: body.vy, vz: body.vz, mass: body.mass });
          this.removeBody(body);
        }
        this.activeBH.delete(bh.id);
      }
    }
    // supermassive black hole in the core
    const core = g.core;
    if (core.alive) {
      const d = Math.hypot(core.x - p.x, core.y - p.y, core.z - p.z);
      if (!this.coreBody && d < CORE_ACTIVATE) {
        this.coreBody = this.addBody(new Body({ role: 'compact', compact: 'bh', name: 'Sagittarius A*', mass: core.mass, static: true, comp: { rock: 0, iron: 0, ice: 0, gas: 1 } }));
        this.coreBody.isCore = true;
      } else if (this.coreBody && d > CORE_ACTIVATE * 1.3) {
        this.removeBody(this.coreBody);
        this.coreBody = null;
      }
    }
  }

  activateSystem(sys) {
    const detail = generateSystemDetail(sys);
    const st = sys.state || {};
    const entry = { sys, detail, star: null, planets: [], planetsActive: false };
    let extent = 0;
    for (const pl of detail.planets) extent = Math.max(extent, pl.a * 1.5);
    for (const b of detail.belts) extent = Math.max(extent, b.outer * 1.2);
    if (detail.disk) extent = Math.max(extent, detail.disk.outer);
    entry.extent = Math.max(extent, 3 * AU);

    if (st.remnant) {
      entry.star = this.addBody(new Body({
        role: 'compact', compact: st.remnant.compact, mass: st.remnant.mass, name: `${sys.name} remnant`,
        x: sys.x, y: sys.y, z: sys.z, static: true, comp: { rock: 0, iron: 0.1, ice: 0, gas: 0.9 },
      }));
    } else if (!st.starEaten) {
      const s = sys.star;
      entry.star = this.addBody(new Body({
        role: 'star', name: sys.name, mass: s.mass, x: sys.x, y: sys.y, z: sys.z, static: true,
        comp: { rock: 0.01, iron: 0.005, ice: 0.015, gas: 0.97 }, seed: sys.seed % 100000, spin: 0.2,
      }));
      if (sys.isStart || sys.age === 'young') entry.star.swell = s.radius / entry.star.radius;
      entry.star.updateRadius();
    }
    if (entry.star) {
      entry.star.system = entry;
      entry.star.persistentKey = 'star';
    }
    this.active.set(sys.id, entry);
    return entry;
  }

  activatePlanets(e) {
    const st = e.sys.state || {};
    const eaten = new Set(st.eaten || []);
    const { e1, e2 } = e.detail.basis;
    const parent = e.star;
    if (!parent) { e.planetsActive = true; return; }
    e.detail.planets.forEach((pl, i) => {
      const key = `p${i}`;
      if (eaten.has(key)) return;
      const b = this.addBody(new Body({
        role: 'rails', name: pl.name, mass: pl.mass, comp: pl.comp, kind: pl.kind, life: pl.life,
        rings: pl.rings, tilt: pl.tilt, spin: pl.spin, seed: pl.seed, temp: pl.temp,
        system: e, persistentKey: key,
      }));
      b.rails = { parent, a: pl.a, omega: pl.omega, phase: pl.phase, e1, e2, hill: pl.hill };
      e.planets.push(b);
      pl.moons.forEach((m, k) => {
        const mk = `${key}m${k}`;
        if (eaten.has(mk)) return;
        const mb = this.addBody(new Body({
          role: 'rails', name: m.name, mass: m.mass, comp: m.comp, kind: m.volcanic ? 'lava' : (m.comp.ice > 0.3 ? 'icy' : 'rocky'),
          seed: m.seed, temp: pl.temp, system: e, persistentKey: mk, spin: 0.3, tilt: 0.05,
        }));
        mb.volcanic = m.volcanic;
        mb.rails = { parent: b, a: m.a, omega: m.omega, phase: m.phase, e1, e2, hill: 0 };
        e.planets.push(mb);
      });
    });
    e.planetsActive = true;
    this.updateRails();
  }

  deactivatePlanets(e) {
    for (const b of e.planets) if (b.alive) this.removeBody(b);
    e.planets = [];
    e.planetsActive = false;
  }

  deactivateSystem(e) {
    this.deactivatePlanets(e);
    if (e.star && e.star.alive) this.removeBody(e.star);
  }

  markEaten(b) {
    const e = b.system;
    if (!e || !b.persistentKey) return;
    const st = (e.sys.state ||= {});
    if (b.persistentKey === 'star') {
      st.starEaten = true;
      st.destroyed = true;
      this.stats.systemsEaten++;
      // whatever is left of the system drifts free
      for (const pl of e.planets) if (pl.alive && pl.rails) this.freeBody(pl);
    } else {
      (st.eaten ||= []).push(b.persistentKey);
    }
  }

  freeBody(b) {
    if (!b.rails) return;
    b.rails = null;
    b.role = b.role === 'rails' ? 'free' : b.role;
    b.static = false;
  }

  // ---------------------------------------------------------------- frames

  // The velocity of "standing still" at a point: a circular orbit around
  // whatever dominates gravity there (a planet, a star, or nothing).
  referenceFrame(x, y, z, exclude = null) {
    let best = null, bestScore = 0, hostStar = null;
    for (const e of this.active.values()) {
      const s = e.star;
      if (!s || !s.alive) continue;
      const d = Math.hypot(s.x - x, s.y - y, s.z - z);
      if (d < e.extent * 2.2 && s !== exclude) {
        const score = s.mass / (d * d);
        if (score > bestScore) { bestScore = score; best = s; hostStar = e; }
      }
    }
    let frameBody = best, normal = hostStar ? hostStar.detail.normal : { x: 0, y: 1, z: 0 };
    if (hostStar) {
      for (const pl of hostStar.planets) {
        if (!pl.alive || pl === exclude || !pl.rails) continue;
        const h = pl.rails.hill || pl.radius * 10;
        if (Math.hypot(pl.x - x, pl.y - y, pl.z - z) < h * 0.6) frameBody = pl;
      }
    }
    // in deep space: the nearest heavy compact object can also host orbits
    for (const b of this.attractors) {
      if (b === exclude || b.role === 'player') continue;
      if (b.compact && b.mass > 50 * M_SUN) {
        const d = Math.hypot(b.x - x, b.y - y, b.z - z);
        if (d < b.rEff * 400 && (!frameBody || b.mass / (d * d) > bestScore)) frameBody = b;
      }
    }
    if (!frameBody) return { vx: 0, vy: 0, vz: 0, body: null };
    const rx = x - frameBody.x, ry = y - frameBody.y, rz = z - frameBody.z;
    const r = Math.hypot(rx, ry, rz) || 1;
    const vc = circularVelocity(frameBody.mass, Math.max(r, frameBody.rEff * 1.5));
    // tangent = normal x r
    let tx = normal.y * rz - normal.z * ry, ty = normal.z * rx - normal.x * rz, tz = normal.x * ry - normal.y * rx;
    const tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-9 * r) return { vx: frameBody.vx, vy: frameBody.vy, vz: frameBody.vz, body: frameBody };
    tx /= tl; ty /= tl; tz /= tl;
    return { vx: frameBody.vx + tx * vc, vy: frameBody.vy + ty * vc, vz: frameBody.vz + tz * vc, body: frameBody };
  }

  // ---------------------------------------------------------------- update

  rebuildAttractors() {
    const p = this.player;
    this.attractors = this.bodies.filter((b) => b.alive && (
      b.isStar || b.compact || b.role === 'rails' || b.role === 'player' || b.role === 'free' || b.role === 'star' ||
      (p && b.role === 'field' && b.mass > p.mass * 0.4 && p.distTo(b) < p.rEff * 45)
    ));
    this.stars = this.bodies.filter((b) => b.alive && b.starTemp > 0 && b.role !== 'player');
  }

  updateRails() {
    // stars first (static or free), then planets, then moons
    const t = this.time;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.bodies) {
        if (!b.alive || !b.rails) continue;
        const r = b.rails, par = r.parent;
        const isMoon = !!par.rails;
        if ((pass === 0) === isMoon) continue;
        if (!par.alive) { this.freeBody(b); continue; }
        const th = r.phase + r.omega * t;
        const c = Math.cos(th), s = Math.sin(th);
        b.x = par.x + r.a * (c * r.e1.x + s * r.e2.x);
        b.y = par.y + r.a * (c * r.e1.y + s * r.e2.y);
        b.z = par.z + r.a * (c * r.e1.z + s * r.e2.z);
        const v = r.a * r.omega;
        b.vx = par.vx + v * (-s * r.e1.x + c * r.e2.x);
        b.vy = par.vy + v * (-s * r.e1.y + c * r.e2.y);
        b.vz = par.vz + v * (-s * r.e1.z + c * r.e2.z);
      }
    }
  }

  setWarp(index) {
    index = clamp(index, 0, WARP_LEVELS.length - 1);
    const allowed = this.maxWarpIndex();
    if (index > allowed) {
      this.emit('warp-blocked', { reason: this.warpBlockReason });
      index = allowed;
    }
    if (index !== this.warpIndex) {
      const was = this.warp;
      this.warpIndex = index;
      this.warp = WARP_LEVELS[index];
      this.emit('warp', { level: this.warp, was });
      if (this.warp < 100 && was >= 100) this.field.update(0, true);
      if (this.warp >= 100 && was < 100) this.sweepForWarp();
    }
  }

  // before time races ahead, nearby debris is swallowed and the rest left behind
  sweepForWarp() {
    const p = this.player;
    for (const b of this.bodies) {
      if (!b.alive || b.role !== 'fragment') continue;
      if (p.distTo(b) < p.rEff * 15) { p.absorbComp(b, b.mass); p.mass += b.mass; }
      this.removeBody(b);
    }
    p.updateRadius();
  }

  maxWarpIndex() {
    const p = this.player;
    if (!p) return 0;
    this.warpBlockReason = '';
    if (this.tidalStress > 0) { this.warpBlockReason = 'Tidal stress'; return 0; }
    if (this.heatLoss > 0.004) { this.warpBlockReason = 'Too close to a star'; return 0; }
    if (this.core) { this.warpBlockReason = 'Core collapse under way'; return 1; }
    const need = [0, 5, 60, 600, 4000];
    let allowed = WARP_LEVELS.length - 1;
    for (const b of this.attractors) {
      if (b === p) continue;
      const surf = p.distTo(b) - b.rEff - p.rEff;
      const big = b.mass > p.mass * 0.05 || b.isStar || b.compact;
      if (!big) continue;
      const scale = Math.max(p.rEff, b.rEff * 0.6);
      while (allowed > 0 && surf < need[allowed] * scale) allowed--;
      if (allowed === 0) { this.warpBlockReason = `Too close to ${b.name}`; break; }
    }
    return allowed;
  }

  update(dtReal) {
    const p = this.player;
    if (!p) return;
    dtReal = Math.min(dtReal, 0.05);
    this.stats.timePlayed += dtReal;

    // thrust cancels time warp
    if (this.input.level > 0.01 && this.warp > 1) this.setWarp(0);
    // warp limits follow you around
    const maxW = this.maxWarpIndex();
    if (this.warpIndex > maxW) {
      this.warpIndex = maxW;
      this.warp = WARP_LEVELS[maxW];
      this.emit('warp', { level: this.warp, auto: true, reason: this.warpBlockReason });
      if (this.warp < 100) this.field.update(0, true);
    }

    const dtSim = dtReal * TIME_BASE * this.warp;
    const rs = dtReal; // "real seconds" for gameplay rates
    this.rebuildAttractors();

    // substeps: keep close orbits around you stable
    const tDyn = Math.sqrt(Math.pow(p.rEff, 3) / (G * p.mass));
    let hMax = this.warp < 100 ? 0.07 * tDyn : Infinity;
    for (const b of this.attractors) {
      if (b === p || b.mass < p.mass) continue;
      const d = Math.max(p.distTo(b), b.rEff * 1.2);
      hMax = Math.min(hMax, 0.02 * Math.sqrt((d * d * d) / (G * b.mass)));
    }
    let n = Math.ceil(dtSim / hMax);
    if (n > 40) {
      n = 40;
      if (this.warp > 1) this.setWarp(this.warpIndex - 1);
    }
    n = Math.max(1, n);
    const h = dtSim / n;

    this.computeThrust(rs);
    for (let i = 0; i < n; i++) {
      this.time += h;
      this.updateRails();
      this.integrate(h);
      this.collisions(h);
      if (!p.alive) break;
    }
    if (!p.alive) { this.flushDead(); return; }

    this.tidal(rs);
    this.accretionDisk(rs);
    this.thermal(rs);
    this.nebulaFeed(rs);
    this.updateBlasts();
    this.evolve(rs);
    this.moveGalaxyObjects(dtSim);

    this.systemTimer -= rs;
    if (this.systemTimer <= 0) {
      this.refreshActiveSystems();
      this.systemTimer = this.warp >= 100 ? 0.15 : 0.6;
    }
    this.field.update(rs);
    this.hazards(rs);
    for (const b of this.bodies) {
      if (b.fadeIn < 1 && !b.fadeOut) b.fadeIn = Math.min(1, b.fadeIn + rs * 1.5);
      b.age += rs;
      b.rot += b.spin * rs * 0.12;
      if (b.heat > 0) b.heat = Math.max(0, b.heat - rs * (b === p ? 0.02 : 0.05));
    }
    p.heat = Math.max(p.heat, clamp(this.tidalStress * 1.3, 0, 1) * clamp(escapeVelocity(p.mass, p.radius) / 2, 0.15, 1));
    this.stats.peakMass = Math.max(this.stats.peakMass, p.mass);
    this.flushDead();
  }

  flushDead() {
    if (this.bodies.some((b) => !b.alive)) this.bodies = this.bodies.filter((b) => b.alive);
  }

  // ---------------------------------------------------------------- player thrust

  computeThrust(rs) {
    const p = this.player, inp = this.input;
    p.tax = p.tay = p.taz = 0;
    this.thrustLoss = 0;
    let level = inp.level;
    let dx = inp.thrust.x, dy = inp.thrust.y, dz = inp.thrust.z;
    if (inp.brake) {
      // fire the jets against your motion relative to the local frame (or target)
      const fr = inp.target && inp.target.alive ? inp.target : this.referenceFrame(p.x, p.y, p.z, p);
      const rvx = p.vx - fr.vx, rvy = p.vy - fr.vy, rvz = p.vz - fr.vz;
      const v = Math.hypot(rvx, rvy, rvz);
      const vReal = (v * TIME_BASE) / p.rEff;
      if (vReal > 0.02) {
        dx = -rvx / v; dy = -rvy / v; dz = -rvz / v;
        level = Math.min(1, vReal / 2);
      } else level = 0;
    }
    if (level <= 0) return;
    const boost = inp.boost ? 2.4 : 1;
    // acceleration in body-radii per real second squared, converted to sim units
    const aReal = 5.5 * boost;
    const a = (aReal * p.rEff) / (TIME_BASE * TIME_BASE) * level;
    // nothing outruns light
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    const limit = clamp(1 - sp / (0.3 * C), 0, 1);
    p.tax = dx * a * limit; p.tay = dy * a * limit; p.taz = dz * a * limit;
    // volcanic jets throw away a little of you
    const cost = (inp.boost ? 0.0075 : 0.0016) * level;
    if (!p.compact) {
      const dm = p.mass * cost * rs;
      p.mass -= dm;
      this.thrustLoss = cost;
      p.updateRadius();
    }
    this.emit('jet', { x: -dx, y: -dy, z: -dz, level, boost: inp.boost });
  }

  // ---------------------------------------------------------------- gravity

  integrate(h) {
    const at = this.attractors;
    const p = this.player;
    const n = at.length;
    const aMinField = (1e-5 * G * p.mass) / (p.rEff * p.rEff);
    const nrm = this.ringNormal;
    for (const b of this.bodies) {
      if (!b.alive || b.rails || b.static) continue;
      if (b.moonOf === p && this.warp >= 100) {
        // keep moons on their orbit analytically while time races
        const rx = b.x - p.x, ry = b.y - p.y, rz = b.z - p.z;
        const d = Math.hypot(rx, ry, rz) || 1;
        const w = Math.sqrt((G * p.mass) / (d * d * d)) * h;
        const c = Math.cos(w), sn = Math.sin(w);
        // rotate r around the ring normal (Rodrigues)
        const kx = nrm.y * rz - nrm.z * ry, ky = nrm.z * rx - nrm.x * rz, kz = nrm.x * ry - nrm.y * rx;
        const kd = nrm.x * rx + nrm.y * ry + nrm.z * rz;
        const nx = rx * c + kx * sn + nrm.x * kd * (1 - c);
        const ny = ry * c + ky * sn + nrm.y * kd * (1 - c);
        const nz = rz * c + kz * sn + nrm.z * kd * (1 - c);
        b.x = p.x + p.vx * h + nx; b.y = p.y + p.vy * h + ny; b.z = p.z + p.vz * h + nz;
        b.vx = p.vx; b.vy = p.vy; b.vz = p.vz;
        continue;
      }
      let ax = 0, ay = 0, az = 0;
      const small = b.role === 'fragment' || b.role === 'field';
      for (let j = 0; j < n; j++) {
        const o = at[j];
        if (o === b || !o.alive) continue;
        const dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
        let r2 = dx * dx + dy * dy + dz * dz;
        const mu = G * o.mass;
        if (small && mu < aMinField * r2) continue;
        const soft = o.rEff * o.rEff;
        if (r2 < soft) r2 = soft;
        const inv = mu / (r2 * Math.sqrt(r2));
        ax += dx * inv; ay += dy * inv; az += dz * inv;
      }
      if (b === p) { ax += p.tax || 0; ay += p.tay || 0; az += p.taz || 0; }
      b.vx += ax * h; b.vy += ay * h; b.vz += az * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      b.ax = ax; b.ay = ay; b.az = az;
    }
  }

  // ---------------------------------------------------------------- collisions

  sweptHit(a, b, h, rad) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const vx = b.vx - a.vx, vy = b.vy - a.vy, vz = b.vz - a.vz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < rad * rad) return true;
    const vv = vx * vx + vy * vy + vz * vz;
    if (vv === 0) return false;
    // previous relative position is d - v h; closest approach on the segment
    const px = dx - vx * h, py = dy - vy * h, pz = dz - vz * h;
    let t = -(px * vx + py * vy + pz * vz) / vv;
    t = clamp(t, 0, h);
    const cx = px + vx * t, cy = py + vy * t, cz = pz + vz * t;
    return cx * cx + cy * cy + cz * cz < rad * rad;
  }

  collisions(h) {
    const p = this.player;
    const at = this.attractors;
    for (const b of this.bodies) {
      if (!b.alive || b === p) continue;
      // against the player
      const rad = p.rEff + b.rEff;
      const dx = b.x - p.x, dy = b.y - p.y, dz = b.z - p.z;
      const near = dx * dx + dy * dy + dz * dz;
      const reach = rad + Math.hypot(b.vx - p.vx, b.vy - p.vy, b.vz - p.vz) * h;
      if (near < reach * reach && this.sweptHit(p, b, h, rad)) {
        const playerWins = p.compact ? (!b.compact || b.mass <= p.mass) : (!b.compact && b.mass <= p.mass);
        if (playerWins) this.playerEats(b);
        else { this.killPlayer(`Swallowed by ${b.name || b.typeLabel}`, b); return; }
        continue;
      }
      // small stuff falling into planets and stars
      if (b.role === 'fragment' || b.role === 'field') {
        for (const o of at) {
          if (o === p || o === b || !o.alive || o.mass < b.mass) continue;
          const r = o.rEff + b.rEff;
          const ex = b.x - o.x, ey = b.y - o.y, ez = b.z - o.z;
          if (ex * ex + ey * ey + ez * ez < r * r * 1.0001) {
            o.mass += b.mass;
            this.removeBody(b);
            break;
          }
        }
      }
    }
  }

  playerEats(b) {
    const p = this.player;
    const m = b.mass;
    const rvx = b.vx - p.vx, rvy = b.vy - p.vy, rvz = b.vz - p.vz;
    const vrel = Math.hypot(rvx, rvy, rvz);
    const vesc = escapeVelocity(p.mass + m, p.rEff + b.rEff);
    let ejecta = 0;
    if (!p.compact && !p.isStar) {
      // slow impacts stick; fast ones blast material back into space
      const excess = Math.max(0, (vrel / vesc) * (vrel / vesc) - 4);
      ejecta = Math.min(m * 0.06 * excess, m * 2.5, p.mass * 0.4);
    }
    // life bonus: living worlds are special finds
    const bonus = b.life ? m * (b.life === 2 ? 0.35 : 0.2) : 0;
    p.absorbComp(b, m);
    const M0 = p.mass;
    p.mass = Math.max(p.mass + m + bonus - ejecta, 1e12);
    // momentum is conserved
    p.vx = (p.vx * M0 + b.vx * m) / (M0 + m);
    p.vy = (p.vy * M0 + b.vy * m) / (M0 + m);
    p.vz = (p.vz * M0 + b.vz * m) / (M0 + m);
    const energy = (m / M0) * Math.pow(vrel / Math.max(vesc, 1e-9), 2);
    // impact heat per kilogram goes as velocity squared: a 3 km rock barely warms,
    // a Mars-sized body (escape speed ~5 km/s) can melt into a magma ocean
    const meltable = clamp(Math.pow(vesc / 4.5, 2), 0, 1);
    p.heat = clamp(p.heat + (energy * 0.9 + (m / M0) * 0.5) * meltable, 0, 1);
    p.updateRadius();
    this.removeBody(b);
    if (b.persistentKey) this.markEaten(b);
    if (b.role !== 'fragment') {
      this.stats.eaten++;
      this.stats.biggestMeal = Math.max(this.stats.biggestMeal, m);
    }
    if (b.life) this.stats.lifeFound++;
    // direction of impact (from the player's centre)
    const dl = Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) || 1;
    this.emit('impact', {
      body: b, mass: m, gain: m + bonus - ejecta, ejecta, rel: m / M0, energy,
      dir: { x: (b.x - p.x) / dl, y: (b.y - p.y) / dl, z: (b.z - p.z) / dl },
      fragment: b.role === 'fragment', life: b.life, name: b.name, label: b.typeLabel,
      star: b.isStar, compact: b.compact,
    });
  }

  // ---------------------------------------------------------------- tides

  tidal(rs) {
    const p = this.player;
    this.tidalStress = 0;
    this.tidalSource = null;
    let fragCount = 0;
    for (const b of this.bodies) if (b.role === 'fragment' && b.alive) fragCount++;

    for (const b of this.bodies) {
      if (!b.alive || b === p) continue;
      const d = p.distTo(b);
      // the player tears apart smaller things
      if (b.mass < p.mass && b.role !== 'fragment' && !(b.compact && !p.compact)) {
        if (b.mass < p.mass * 2.5e-4) continue;
        const dR = rocheLimit(p.mass, b.mass, b.radius);
        if (dR <= p.rEff + b.rEff * 0.3 || d > dR) {
          if (b.disrupt > 0 && d > dR * 1.15) b.disrupt = 0;
          continue;
        }
        const depth = clamp((dR - d) / Math.max(dR - p.rEff, 1e-6), 0, 1);
        if (b.disrupt === 0) {
          b.disruptMass0 = b.mass;
          b.stripAcc = 0;
          if (b.rails) this.freeBody(b);
          if (b.mass > p.mass * 0.01) this.emit('disrupt', { body: b, name: b.name, label: b.typeLabel });
        }
        b.disrupt += rs * (0.3 + 2.4 * depth * depth);
        const m0 = b.disruptMass0;
        const strip = Math.min(b.mass, m0 * (0.12 + 1.6 * depth * depth) * rs);
        const nChunks = clamp(Math.round(10 + 50 * Math.sqrt(m0 / p.mass)), 10, 60);
        const chunk = m0 / nChunks;
        b.stripAcc += strip;
        while (b.stripAcc >= chunk && b.mass > chunk * 1.01 && fragCount < MAX_FRAGMENTS) {
          this.spawnFragment(b, chunk, p, 0.6);
          b.mass -= chunk;
          b.stripAcc -= chunk;
          fragCount++;
        }
        if (b.mass < m0 * 0.18 || depth > 0.72) {
          // the rest shatters into a stream
          const k = Math.min(Math.ceil(b.mass / chunk), Math.max(4, MAX_FRAGMENTS - fragCount));
          const each = b.mass / k;
          for (let i = 0; i < k; i++) this.spawnFragment(b, each, p, 1.0);
          fragCount += k;
          if (b.persistentKey) this.markEaten(b);
          this.emit('shatter', { body: b, name: b.name, label: b.typeLabel, mass: m0 });
          this.removeBody(b);
        } else {
          b.updateRadius();
        }
        continue;
      }
      // bigger things tear YOU apart
      if ((b.mass > p.mass || b.compact) && !p.compact && b.role !== 'fragment') {
        const dR = rocheLimit(b.mass, p.mass, p.radius);
        if (dR <= b.rEff + p.rEff * 0.3 || d > dR) continue;
        const depth = clamp((dR - d) / Math.max(dR - b.rEff, 1e-6), 0, 1);
        if (depth > this.tidalStress) { this.tidalStress = depth; this.tidalSource = b; }
        const frac = (0.06 + 0.9 * depth * depth) * rs;
        const dm = p.mass * frac;
        p.mass -= dm;
        b.mass += dm;
        p.updateRadius();
        this.emit('stripped', { from: b, amount: dm, depth });
        if (depth > 0.7) {
          this.killPlayer(`Torn apart by the tides of ${b.name || b.typeLabel}`, b);
          return;
        }
      }
    }
  }

  spawnFragment(src, mass, toward, spread) {
    const rng = this.rng;
    const dx = toward.x - src.x, dy = toward.y - src.y, dz = toward.z - src.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / d, uy = dy / d, uz = dz / d;
    // material leaves from the near side (toward you) and the far side
    const side = rng.chance(0.62) ? 1 : -1;
    const r = src.radius * rng.range(1.15, 1.5) + Math.cbrt(mass / Math.max(src.mass, mass)) * src.radius;
    const j = rng.unitVector();
    const ox = ux * side * r + j.x * src.radius * 0.5 * spread;
    const oy = uy * side * r + j.y * src.radius * 0.5 * spread;
    const oz = uz * side * r + j.z * src.radius * 0.5 * spread;
    const vs = Math.sqrt((G * Math.max(src.mass, mass)) / Math.max(src.radius, 1e-6)) * rng.range(0.2, 0.7);
    const f = new Body({
      role: 'fragment', name: `Debris of ${src.name || src.typeLabel}`, mass, comp: src.comp,
      x: src.x + ox, y: src.y + oy, z: src.z + oz,
      vx: src.vx + ux * side * vs + j.x * vs * 0.4,
      vy: src.vy + uy * side * vs + j.y * vs * 0.4,
      vz: src.vz + uz * side * vs + j.z * vs * 0.4,
      seed: rng.int(1, 1e9), spin: rng.range(-4, 4), temp: Math.max(src.temp, src.starTemp || 0),
      kind: src.isStar || src.compact ? 'plasma' : src.kind,
    });
    f.hot = src.isStar ? 1 : clamp(src.heat || 0, 0, 1);
    f.fromStar = !!src.isStar;
    f.lifetime = 0;
    this.addBody(f);
    return f;
  }

  // Debris near you settles into a flat, swirling disk and spirals in.
  // (Collisions between grains do this in real accretion disks.)
  accretionDisk(rs) {
    const p = this.player;
    this.ringNormal = { x: Math.sin(p.tilt), y: Math.cos(p.tilt), z: 0 };
    const n = this.ringNormal;
    const pull = this.input.pull ? 5 : 1;
    let moons = 0;
    const hill = this.playerHill();
    const env = this.field.env;
    const gasDrag = env.kind === 'disk' ? 1.6 * Math.min(env.density, 1.5) : env.kind === 'nebula' ? 0.9 : 0;
    // unresolved pebbles too small to draw still rain onto you in a gas-rich disk
    if (gasDrag > 0 && !p.isStar && !p.compact && p.mass < 1e26) {
      const gain = p.mass * 0.0035 * gasDrag * rs;
      const pc = env.snow > 1 ? { rock: 0.4, iron: 0.1, ice: 0.5, gas: 0 } : { rock: 0.66, iron: 0.3, ice: 0.04, gas: 0 };
      p.absorbComp(pc, gain);
      p.mass += gain;
      p.updateRadius();
      this.pebbleRate = 0.0035 * gasDrag;
    } else this.pebbleRate = 0;
    for (const b of this.bodies) {
      if (!b.alive || b === p) continue;
      if (b.role !== 'fragment' && b.role !== 'field') continue;
      const rx = b.x - p.x, ry = b.y - p.y, rz = b.z - p.z;
      const d = Math.hypot(rx, ry, rz);
      let vx = b.vx - p.vx, vy = b.vy - p.vy, vz = b.vz - p.vz;
      const vc = Math.sqrt((G * p.mass) / d);
      if (b.role === 'field' && gasDrag > 0 && b.mass < p.mass * 0.08 && d < p.rEff * 7 && b.moonOf !== p) {
        // pebble accretion: gas drag bleeds off their speed and they settle onto you
        const k = Math.min(1, gasDrag * rs * (1 - d / (p.rEff * 7)));
        const vin = -Math.sqrt((2 * G * p.mass) / d) * 0.35;
        vx += (rx / d * vin - vx) * k; vy += (ry / d * vin - vy) * k; vz += (rz / d * vin - vz) * k;
        b.vx = p.vx + vx; b.vy = p.vy + vy; b.vz = p.vz + vz;
        continue;
      }
      if (b.role === 'field') {
        // capture as a moon: bound, inside your Hill sphere, outside Roche
        if (b.moonOf !== p) {
          const bound = 0.5 * (vx * vx + vy * vy + vz * vz) - (G * p.mass) / d < 0;
          if (bound && d < hill * 0.5 && b.mass < p.mass * 0.3 && b.mass > p.mass * 0.003 && moons < 6) {
            b.capt = (b.capt || 0) + rs;
            if (b.capt > 1.5) { b.moonOf = p; b.name = b.name.startsWith('Moon') ? b.name : `Moon of ${p.name}`; this.emit('moon', { body: b }); }
          } else b.capt = 0;
          continue;
        }
        moons++;
        if (d > hill * 0.9) { b.moonOf = null; continue; }
      }
      if (b.role === 'fragment') {
        b.lifetime += rs;
        if (d > p.rEff * 120 || b.lifetime > 150) { this.removeBody(b); continue; }
        if (d > p.rEff * 14) continue;
      }
      const isMoon = b.moonOf === p;
      const rate = (isMoon ? 0.12 : 1.1) * rs;
      const inspiral = (isMoon ? 0.004 : 0.035) * pull * (this.player.compact ? 1.5 : 1);
      // radial unit, tangent in the ring plane
      const ux = rx / d, uy = ry / d, uz = rz / d;
      let tx = n.y * uz - n.z * uy, ty = n.z * ux - n.x * uz, tz = n.x * uy - n.y * ux;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      // keep the sense of rotation the debris already has
      const sgn = vx * tx + vy * ty + vz * tz >= 0 ? 1 : -1;
      const h = rx * n.x + ry * n.y + rz * n.z;
      const tvx = sgn * tx * vc * 0.98 - ux * vc * inspiral - n.x * (h / d) * vc * 0.5;
      const tvy = sgn * ty * vc * 0.98 - uy * vc * inspiral - n.y * (h / d) * vc * 0.5;
      const tvz = sgn * tz * vc * 0.98 - uz * vc * inspiral - n.z * (h / d) * vc * 0.5;
      const k = Math.min(1, rate);
      vx += (tvx - vx) * k; vy += (tvy - vy) * k; vz += (tvz - vz) * k;
      b.vx = p.vx + vx; b.vy = p.vy + vy; b.vz = p.vz + vz;
    }
    this.moonCount = moons;
  }

  playerHill() {
    const p = this.player;
    let best = Infinity;
    for (const b of this.attractors) {
      if (b === p || b.mass < p.mass * 3) continue;
      const d = p.distTo(b);
      best = Math.min(best, hillRadius(d, p.mass, b.mass));
    }
    return Math.min(best, p.rEff * 60);
  }

  // ---------------------------------------------------------------- heat

  thermal(rs) {
    const p = this.player;
    let T = 40, hottest = null;
    for (const s of this.stars) {
      if (!s.alive) continue;
      const d = p.distTo(s);
      const dReal = s.radius + Math.max(0, d - s.radius) * DIST_COMPRESS;
      const t = equilibriumTemp(s.starTemp, s.radius, dReal, 0.3);
      if (t > T) { T = t; hottest = s; }
    }
    p.temp = T;
    this.heatLoss = 0;
    this.heatSource = hottest;
    if (p.isStar || p.compact || !hottest) return;
    let loss = 0;
    const c = p.comp;
    // strong gravity holds on to hot material; small bodies lose it freely
    const vesc = escapeVelocity(p.mass, p.radius);
    const hold = clamp(3 / Math.max(vesc, 0.01), 0.08, 1);
    if (T > 1500) loss += 0.016 * Math.pow((T - 1500) / 800, 2) * hold;
    if (c.gas > 0.2 && T > 1300) loss += 0.006 * Math.pow((T - 1300) / 900, 2) * c.gas * hold;
    loss = Math.min(loss, 0.35);
    // ice boils away from small airless bodies (this is what makes comet tails);
    // planets keep their water because the vapour can't reach escape speed
    let iceLoss = 0;
    const freeIce = 1 - clamp((vesc - 0.4) / 1.6, 0, 1);
    if (c.ice > 0.004 && T > 165 && freeIce > 0) iceLoss = Math.min(0.2, 0.005 * ((T - 165) / 110)) * c.ice * freeIce;
    const total = loss + iceLoss;
    if (total <= 0) return;
    const dm = p.mass * total * rs;
    const iceDm = p.mass * iceLoss * rs;
    // remove ice first from the composition
    const ice = c.ice * p.mass - iceDm;
    p.mass -= dm;
    c.ice = clamp(ice / p.mass, 0, 1);
    const rest = c.rock + c.iron + c.gas;
    if (rest > 0) {
      const k = (1 - c.ice) / rest;
      c.rock *= k; c.iron *= k; c.gas *= k;
    }
    p.updateRadius();
    this.heatLoss = total;
    this.emit('ablate', { rate: total, ice: iceLoss, source: hottest });
  }

  nebulaFeed(rs) {
    const p = this.player;
    const env = this.field.env;
    if (env.kind !== 'nebula' || !env.nebula) return;
    if (p.mass < 1e27) return;
    const nb = env.nebula;
    const left = nb.mass * nb.massLeft;
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    const gain = Math.min(left * 0.0025, p.mass * (p.compact ? 0.02 : 0.008)) * rs * clamp(0.3 + sp / 200, 0.3, 1.5);
    if (gain <= 0) return;
    p.absorbComp({ rock: 0.01, iron: 0, ice: 0.02, gas: 0.97 }, gain);
    p.mass += gain;
    nb.massLeft = Math.max(0, nb.massLeft - gain / nb.mass);
    p.updateRadius();
    this.emit('nebula-feed', { gain });
  }

  // ---------------------------------------------------------------- evolution

  evolve(rs) {
    const p = this.player;
    // neutron stars that get too heavy collapse
    if (p.compact === 'ns' && p.mass > NS_MAX_MASS) {
      p.compact = 'bh';
      p.updateRadius();
      this.emit('collapse', { to: 'bh' });
    }
    // massive stars burn through their core and explode
    if (!p.compact && p.mass >= CORE_COLLAPSE_MASS) {
      if (!this.core) {
        this.core = { stage: 0, t: 0 };
        this.emit('core-start', {});
      }
      const st = CORE_BURN_STAGES[this.core.stage];
      this.core.t += rs;
      if (this.core.t >= st.dur) {
        this.core.t = 0;
        this.core.stage++;
        if (this.core.stage >= CORE_BURN_STAGES.length) {
          this.playerSupernova();
          this.core = null;
        } else this.emit('core-stage', { el: CORE_BURN_STAGES[this.core.stage].el });
      }
      if (this.core) {
        // the star swells into a supergiant as the core runs out of fuel
        const total = CORE_BURN_STAGES.reduce((s, x) => s + x.dur, 0);
        let done = 0;
        for (let i = 0; i < this.core.stage; i++) done += CORE_BURN_STAGES[i].dur;
        const prog = (done + this.core.t) / total;
        p.swell = 1 + 5 * Math.pow(prog, 1.6);
        p.updateRadius();
      }
    } else if (this.core && !p.compact) {
      this.core = null;
      p.swell = 1;
      p.updateRadius();
    }
    const st = p.stage;
    if (st !== this.lastStage) {
      const up = st > this.lastStage || STAGES[st].compact;
      this.emit('stage', { from: this.lastStage, to: st, up });
      this.lastStage = st;
    }
    // life can appear on a wet, temperate rocky world of the right size
    if (!p.compact && !p.isStar && !p.life && p.mass > 0.3 * M_EARTH && p.mass < 8 * M_EARTH && p.comp.ice > 0.04 && p.temp > 225 && p.temp < 320 && p.heat < 0.2 && p.comp.gas < 0.08) {
      this.lifeClock = (this.lifeClock || 0) + rs;
      if (this.lifeClock > 45) { p.life = 1; this.emit('life', { level: 1 }); }
    } else if (p.life && (p.temp > 400 || p.heat > 0.6 || p.isStar || p.mass > 12 * M_EARTH)) {
      p.life = 0;
      this.lifeClock = 0;
      this.emit('life-lost', {});
    }
    if (p.life === 1) {
      this.lifeClock += rs;
      if (this.lifeClock > 150) { p.life = 2; this.emit('life', { level: 2 }); }
    }
  }

  playerSupernova() {
    const p = this.player;
    const M = p.mass;
    const toBH = M >= BH_FROM_SN_MASS;
    const remnant = toBH ? M * 0.32 : Math.min(2.1, 1.35 + 0.025 * (M / M_SUN - 8)) * M_SUN;
    this.blasts.push({ x: p.x, y: p.y, z: p.z, t0: this.time, speed: 9000, energy: 1e44, owner: p, hit: new Set([p.id]), r: 0 });
    p.mass = remnant;
    p.compact = toBH ? 'bh' : 'ns';
    p.swell = 1;
    p.comp = { rock: 0, iron: 0.2, ice: 0, gas: 0.8 };
    p.heat = 1;
    p.updateRadius();
    // ejected gas becomes debris you can pull back in
    for (let i = 0; i < 90; i++) {
      const v = this.rng.unitVector();
      const d = p.rEff * this.rng.range(5, 40);
      const sp = this.rng.range(0.4, 1.4) * Math.sqrt((G * p.mass) / d);
      const f = this.addBody(new Body({
        role: 'fragment', name: 'Supernova ejecta', mass: ((M - remnant) * 0.15) / 90,
        comp: { rock: 0.05, iron: 0.1, ice: 0, gas: 0.85 }, kind: 'plasma',
        x: p.x + v.x * d, y: p.y + v.y * d, z: p.z + v.z * d,
        vx: p.vx + v.x * sp, vy: p.vy + v.y * sp, vz: p.vz + v.z * sp,
      }));
      f.hot = 1; f.fromStar = true; f.lifetime = 0;
    }
    this.emit('supernova', { self: true, x: p.x, y: p.y, z: p.z, toBH, remnant });
  }

  // a nearby star explodes
  systemSupernova(entry) {
    const s = entry.star;
    const sys = entry.sys;
    const M = s.mass;
    const toBH = M >= BH_FROM_SN_MASS;
    const remnant = toBH ? M * 0.3 : 1.4 * M_SUN;
    this.blasts.push({ x: s.x, y: s.y, z: s.z, t0: this.time, speed: 9000, energy: 1e44, hit: new Set([s.id]), r: 0, sysName: sys.name });
    const st = (sys.state ||= {});
    st.remnant = { compact: toBH ? 'bh' : 'ns', mass: remnant };
    sys.snCandidate = false;
    s.compact = toBH ? 'bh' : 'ns';
    s.mass = remnant;
    s.role = 'compact';
    s.updateRadius();
    s.name = `${sys.name} remnant`;
    // planets in the system are blasted apart
    for (const pl of entry.planets) {
      if (!pl.alive) continue;
      for (let i = 0; i < 6; i++) this.spawnFragment(pl, pl.mass / 6, s, 1);
      this.removeBody(pl);
    }
    entry.planets = [];
    this.emit('supernova', { self: false, x: s.x, y: s.y, z: s.z, name: sys.name, toBH });
  }

  updateBlasts() {
    const p = this.player;
    for (const bl of this.blasts) {
      bl.r = bl.speed * (this.time - bl.t0);
      if (!bl.hit.has(p.id)) {
        const d = Math.hypot(p.x - bl.x, p.y - bl.y, p.z - bl.z);
        if (bl.r >= d) {
          bl.hit.add(p.id);
          // energy caught by your cross-section vs. your gravitational binding energy
          const dReal = d * DIST_COMPRESS * 1000; // metres
          const Rm = p.radius * 1000;
          const caught = (bl.energy * Rm * Rm) / (4 * dReal * dReal);
          const bind = (0.6 * 6.674e-11 * p.mass * p.mass) / Math.max(Rm, 1);
          let frac = p.compact ? 0 : clamp(0.12 * Math.pow(caught / bind, 0.35), 0, 0.95);
          if (p.isStar) frac *= 0.3;
          const ux = (p.x - bl.x) / d, uy = (p.y - bl.y) / d, uz = (p.z - bl.z) / d;
          // momentum of the ejecta that hits you: p = 2E / v
          const push = Math.min(bl.speed * 0.05, (2 * caught) / (bl.speed * 1000 * p.mass) / 1000);
          p.vx += ux * push; p.vy += uy * push; p.vz += uz * push;
          if (frac > 0) {
            p.mass *= 1 - frac;
            p.updateRadius();
            p.heat = 1;
          }
          this.emit('blast-hit', { frac, sysName: bl.sysName });
          if (frac > 0.9) { this.killPlayer(`Vaporised by the supernova of ${bl.sysName || 'your own star'}`); return; }
        }
      }
    }
    this.blasts = this.blasts.filter((bl) => bl.r < 3e10);
  }

  moveGalaxyObjects(dtSim) {
    for (const bh of this.galaxy.blackHoles) {
      if (this.activeBH.has(bh.id)) continue;
      bh.x += bh.vx * dtSim; bh.y += bh.vy * dtSim; bh.z += bh.vz * dtSim;
    }
  }

  // ---------------------------------------------------------------- hazards

  hazards(rs) {
    const p = this.player;
    if (this.warp > 1) return;
    this.hazardTimer -= rs;
    if (this.hazardTimer <= 0) {
      this.hazardTimer = this.rng.range(70, 160);
      if (this.field.env.kind !== 'interstellar' || this.rng.chance(0.4)) this.spawnStorm();
    }
    // old massive stars nearby may explode
    this.snTimer -= rs;
    if (this.snTimer <= 0) {
      this.snTimer = 5;
      if (this.pendingSN) {
        if (this.time >= this.pendingSN.at) {
          const e = this.pendingSN.entry;
          this.pendingSN = null;
          if (e.star && e.star.alive && !e.star.compact) this.systemSupernova(e);
        }
      } else {
        for (const e of this.active.values()) {
          if (!e.sys.snCandidate || !e.star || !e.star.alive || e.star.compact) continue;
          const d = p.distTo(e.star);
          if (d < 6e9 && this.rng.chance(0.06)) {
            this.pendingSN = { entry: e, at: this.time + 18 * TIME_BASE };
            this.emit('sn-warning', { name: e.sys.name, dist: d });
            break;
          }
        }
      }
    }
  }

  spawnStorm() {
    const p = this.player, rng = this.rng;
    const comet = rng.chance(0.55);
    const n = rng.int(18, 40);
    const dir = rng.unitVector();
    const R = p.rEff;
    const frame = this.referenceFrame(p.x, p.y, p.z, p);
    const vesc = escapeVelocity(p.mass, p.rEff);
    const speed = vesc * rng.range(3.5, 7);
    const cx = p.x + dir.x * R * 75, cy = p.y + dir.y * R * 75, cz = p.z + dir.z * R * 75;
    // aim to pass near you, not straight through
    const off = rng.unitVector();
    for (let i = 0; i < n; i++) {
      const j = rng.unitVector();
      const spread = R * rng.range(2, 16);
      const mass = p.mass * rng.powerLaw(0.003, 0.12, 1.6);
      const comp = comet ? { rock: 0.3, iron: 0.06, ice: 0.64, gas: 0 } : { rock: 0.66, iron: 0.3, ice: 0.04, gas: 0 };
      const b = new Body({
        role: 'field', name: comet ? `C/${2026 + rng.int(0, 3)} ${'ABCDEFGHJK'[rng.int(0, 9)]}${rng.int(1, 9)}` : `Swarm rock ${i + 1}`,
        mass, comp, kind: comet ? 'icy' : 'rocky',
        x: cx + j.x * spread + off.x * R * 5, y: cy + j.y * spread + off.y * R * 5, z: cz + j.z * spread + off.z * R * 5,
        vx: frame.vx - dir.x * speed + j.x * speed * 0.05,
        vy: frame.vy - dir.y * speed + j.y * speed * 0.05,
        vz: frame.vz - dir.z * speed + j.z * speed * 0.05,
        seed: rng.int(1, 1e9), spin: rng.range(-3, 3), temp: p.temp, fadeIn: 0,
      });
      b.storm = true;
      b.comet = comet;
      this.addBody(b);
    }
    this.emit('storm', { comet, n, dir });
  }

  // ---------------------------------------------------------------- death

  killPlayer(cause, killer = null) {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    this.stats.deaths++;
    if (killer && killer.alive) killer.mass += p.mass;
    this.emit('death', { cause, mass: p.mass, x: p.x, y: p.y, z: p.z });
  }

  // reborn as a chunk of your old self somewhere else in the galaxy
  rebirth(prevMass) {
    const rng = this.rng;
    const g = this.galaxy;
    const old = this.player;
    for (const b of this.bodies) if (b.role === 'fragment' || b.role === 'field') b.alive = false;
    this.flushDead();
    this.core = null;
    this.blasts = [];
    this.pendingSN = null;
    const mass = clamp(prevMass * 2e-4, 2.2e14, 8e28);
    const sys = g.findRebirthSystem(old.x, old.y, old.z, rng);
    // a chunk of you that ate rock, ice or gas
    const comp = mass > 30 * M_EARTH ? { rock: 0.05, iron: 0.02, ice: 0.08, gas: 0.85 } : { rock: 0.6, iron: 0.28, ice: 0.12, gas: 0 };
    for (const [id, e] of this.active) { this.deactivateSystem(e); this.active.delete(id); }
    for (const [id, b] of this.activeBH) { b.alive = false; this.activeBH.delete(id); }
    if (this.coreBody) { this.coreBody.alive = false; this.coreBody = null; }
    this.flushDead();
    this.player = null;
    // pick a sensible orbit: inside the snow line for rocky chunks, out by the giants for gassy ones
    const au = mass > 30 * M_EARTH ? rng.range(4, 9) : rng.range(0.8, 2.2);
    const p = this.spawnPlayer({ mass, comp, sysId: sys.id, orbitAU: au, name: old.name, seed: old.seed + 1 });
    this.lastStage = p.stage;
    this.warpIndex = 0; this.warp = 1;
    this.emit('reborn', { sys: sys.name, mass });
    return p;
  }

  // ---------------------------------------------------------------- save

  serialize() {
    const p = this.player;
    const sysStates = {};
    for (const s of this.galaxy.systems) if (s.state) sysStates[s.id] = { ...s.state, eaten: s.state.eaten ? [...s.state.eaten] : undefined };
    return {
      v: 1,
      seed: this.galaxy.seed,
      time: this.time,
      player: {
        mass: p.mass, comp: { ...p.comp }, compact: p.compact, life: p.life, name: p.name, seed: p.seed,
        pos: { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz },
      },
      sysStates,
      bh: this.galaxy.blackHoles.map((b) => [b.x, b.y, b.z, b.mass, b.alive ? 1 : 0]),
      core: this.galaxy.core.alive ? 1 : 0,
      nebulae: this.galaxy.nebulae.map((n) => n.massLeft),
      stats: { ...this.stats },
    };
  }

  static restoreGalaxyState(galaxy, data) {
    for (const [id, st] of Object.entries(data.sysStates || {})) {
      const s = galaxy.systems[id];
      if (s) s.state = st;
    }
    (data.bh || []).forEach((v, i) => {
      const b = galaxy.blackHoles[i];
      if (!b) return;
      b.x = v[0]; b.y = v[1]; b.z = v[2]; b.mass = v[3]; b.alive = !!v[4];
    });
    galaxy.core.alive = data.core !== 0;
    (data.nebulae || []).forEach((m, i) => { if (galaxy.nebulae[i]) galaxy.nebulae[i].massLeft = m; });
  }
}

export { M_JUP, lerp, stageForMass };
