// The simulation: gravity, orbits, collisions, tidal disruption, heat, the
// galaxy's clock (normal, warp and deep time) and everything that happens to you.
//
// Positions are kilometres relative to a floating origin O (in whole units of GU),
// so a 6 km rock 25,000 light-years from the galactic centre still moves smoothly.
import { Body } from './body.js';
import { Field } from './field.js';
import { generateSystemDetail } from './system.js';
import { Galaxy, GU, LY } from './galaxy.js';
import { stellarState, msLifetimeYears, whiteDwarfMass, hawkingYears } from './stellar.js';
import { Hazards } from './hazards.js';
import { RNG, hash32 } from '../core/rng.js';
import {
  G, C, M_SUN, M_EARTH, AU, TIME_BASE, WARP_LEVELS, DEEP_LEVELS, DIST_COMPRESS, YEAR,
  NS_MAX_MASS, WD_MAX_MASS, BH_FROM_SN_MASS, CORE_BURN_STAGES, FORM,
} from '../core/constants.js';
import {
  clamp, rocheLimit, equilibriumTemp, escapeVelocity, circularVelocity, hillRadius, tierOf,
  mixComp, compOf,
} from '../core/phys.js';

const STAR_ACTIVATE = 1.4e12;     // km (~0.15 light-years): stars become real bodies
const PLANET_ACTIVATE = 3.0e9;    // km: their planets appear
const CORE_ACTIVATE = 60 * LY;
const MAX_FRAGMENTS = 1100;
const REBASE_AT = 1e12;

export class World {
  constructor(galaxy, opts = {}) {
    this.galaxy = galaxy;
    this.O = { x: 0, y: 0, z: 0 };     // floating origin, in GU
    this.time = 0;                      // seconds since the game began
    this.bodies = [];
    this.attractors = [];
    this.stars = [];
    this.active = new Map();
    this.coreBody = null;
    this.events = [];
    this.warpIndex = 0;
    this.warp = 1;
    this.deep = 0;                      // 0 = off, 1..4 = DEEP_LEVELS, 5 = cosmic
    this.quality = opts.quality || 'high';
    this.sandbox = !!opts.sandbox;
    this.invincible = false;
    this.rng = new RNG((Math.random() * 1e9) | 0);
    this.field = new Field(this);
    this.hazards = new Hazards(this);
    this.blasts = [];
    this.player = null;
    this.input = { thrust: { x: 0, y: 0, z: 0 }, level: 0, boost: false, brake: false, pull: false, target: null };
    this.tidalStress = 0;
    this.heatLoss = 0;
    this.thrustLoss = 0;
    this.stats = { eaten: 0, biggestMeal: 0, peakMass: 0, deaths: 0, systemsEaten: 0, lifeFound: 0, timePlayed: 0, formsSeen: [], kinds: {} };
    this.systemTimer = 0;
    this.lastForm = null;
    this.core = null;                   // final core-collapse countdown of a massive star
    this.ringNormal = { x: 0, y: 1, z: 0 };
    this.modules = [];                  // planet model, life... each has update(dtReal, years)
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

  get years() {
    return this.galaxy.time;
  }

  // galaxy-frame light-years of a local point
  toLy(x, y, z) {
    return [(this.O.x * GU + x) / LY, (this.O.y * GU + y) / LY, (this.O.z * GU + z) / LY];
  }

  // ---------------------------------------------------------------- setup

  spawnPlayer(state) {
    const g = this.galaxy;
    const p = new Body({
      role: 'player',
      name: state?.name || null,
      mass: state?.mass ?? 2.2e14,
      comp: state?.comp ?? { rock: 0.6, iron: 0.25, ice: 0.12, carbon: 0.03, gas: 0 },
      compact: state?.compact ?? null,
      spin: state?.spin ?? 0.8,
      tilt: state?.tilt ?? 0.35,
      seed: state?.seed ?? 4242,
      phase: state?.phase ?? null,
    });
    p.heat = state?.heat || 0;
    p.life = 0;
    p.fuel = state?.fuel ?? 0;
    p.diet = compOf(state?.diet || p.comp);
    p.born = state?.born ?? this.years;
    p.wdTemp = state?.wdTemp;
    p.nsSpin = state?.nsSpin;
    p.bhSpin = state?.bhSpin ?? 0;
    p.giantT = state?.giantT ?? 0;
    p.updateRadius();
    this.player = p;
    this.addBody(p);
    if (state?.O) {
      this.O = { ...state.O };
      Object.assign(p, state.pos);
    } else {
      const rec = state?.starRec || g.home;
      this.O = World.originNear(rec);
      const sp = Galaxy.localOf(rec, this.O);
      this.placeAround(p, rec, sp, state?.orbitAU ?? 1.0);
    }
    this.refreshActiveSystems();
    if (!p.name) p.name = this.catalogName(p);
    this.rebuildAttractors();
    if (!state?.O) this.circularize(p);
    this.field.update(0, true);
    this.lastForm = p.form;
    this.stats.peakMass = Math.max(this.stats.peakMass, p.mass);
    this.seeForm(p.form);
    return p;
  }

  static originNear(rec) {
    const gx = rec.ci * 23650 * GU + rec.ox, gy = rec.cj * 23650 * GU + rec.oy, gz = rec.ck * 23650 * GU + rec.oz;
    return { x: Math.round(gx / GU), y: Math.round(gy / GU), z: Math.round(gz / GU) };
  }

  // catalogue-style name from where you formed, like "Kepler-442 b"
  catalogName(p) {
    const host = this.hostSystem();
    const base = host ? host.name : `PSO J${Math.abs(Math.round(p.x / 1e6)) % 360}`;
    const used = new Set((host?.detail.planets || []).map((b) => b.name));
    for (const l of 'bcdefghijk') if (!used.has(`${base} ${l}`)) return `${base} ${l}`;
    return `${base} z`;
  }

  placeAround(b, rec, starPos, au) {
    const sys = this.systemInfo(rec);
    const detail = generateSystemDetail(sys);
    const { e1, e2 } = detail.basis;
    const a = au * AU;
    const th = this.rng.range(0, Math.PI * 2);
    b.x = starPos.x + a * (Math.cos(th) * e1.x + Math.sin(th) * e2.x);
    b.y = starPos.y + a * (Math.cos(th) * e1.y + Math.sin(th) * e2.y);
    b.z = starPos.z + a * (Math.cos(th) * e1.z + Math.sin(th) * e2.z);
    b.vx = b.vy = b.vz = 0;
  }

  circularize(b) {
    const f = this.referenceFrame(b.x, b.y, b.z, b);
    b.vx = f.vx; b.vy = f.vy; b.vz = f.vz;
  }

  // ---------------------------------------------------------------- floating origin

  rebaseIfNeeded() {
    const p = this.player;
    if (Math.abs(p.x) < REBASE_AT && Math.abs(p.y) < REBASE_AT && Math.abs(p.z) < REBASE_AT) return;
    const sx = Math.round(p.x / GU), sy = Math.round(p.y / GU), sz = Math.round(p.z / GU);
    const dx = sx * GU, dy = sy * GU, dz = sz * GU;
    this.O.x += sx; this.O.y += sy; this.O.z += sz;
    for (const b of this.bodies) { b.x -= dx; b.y -= dy; b.z -= dz; }
    for (const bl of this.blasts) { bl.x -= dx; bl.y -= dy; bl.z -= dz; }
    for (const e of this.active.values()) { e.pos.x -= dx; e.pos.y -= dy; e.pos.z -= dz; }
    this.emit('rebase', { dx, dy, dz });
  }

  // ---------------------------------------------------------------- systems

  systemInfo(rec) {
    const g = this.galaxy;
    const st = g.starNow(rec) || stellarState(rec.m0, 1e8);
    const young = st.phase === 'ms' && st.age < 1e7;
    const prog = stellarState(rec.m0, 1e6) || st;
    const crng = new RNG(hash32(rec.seed, 55));
    return {
      id: rec.id,
      seed: rec.seed,
      name: g.nameOf(rec),
      star: { mass: st.mass * M_SUN, radius: st.radius || 12, temp: st.temp || 1e4, lum: Math.max(st.lum, 1e-6) },
      progenitor: { mass: prog.mass * M_SUN, radius: prog.radius, lum: Math.max(prog.lum, 1e-4) },
      age: young ? 'young' : 'mature',
      phase: st.phase,
      binary: rec.binary ? { mass: rec.m0 * rec.binary.q * M_SUN, sepAU: rec.binary.sepAU, q: rec.binary.q } : null,
      carbonRich: crng.chance(0.07),
      isStart: !!rec.isStart,
      st,
    };
  }

  refreshActiveSystems() {
    const p = this.player;
    const g = this.galaxy;
    const near = g.starsNear(p, this.O, STAR_ACTIVATE);
    const seen = new Set();
    for (const s of near) {
      seen.add(s.rec.id);
      const e = this.active.get(s.rec.id);
      const st = g.starNow(s.rec);
      if (!st) { if (e) { this.deactivateSystem(e); this.active.delete(s.rec.id); } continue; }
      if (!e) { this.activateSystem(s.rec, s); continue; }
      // the star aged into a new phase (deep time): rebuild the system
      const ageClass = st.phase === 'ms' && st.age < 1e7 ? 'young' : 'mature';
      if (e.phase !== st.phase || e.ageClass !== ageClass) {
        this.deactivateSystem(e);
        this.active.delete(s.rec.id);
        this.activateSystem(s.rec, s);
        this.emit('system-changed', { name: e.name, from: e.phase, to: st.phase, ageClass });
      }
    }
    for (const [id, e] of this.active) {
      const d = Math.hypot(e.pos.x - p.x, e.pos.y - p.y, e.pos.z - p.z);
      if (!seen.has(id) || d > STAR_ACTIVATE * 1.25) {
        this.deactivateSystem(e);
        this.active.delete(id);
        continue;
      }
      if (!e.planetsActive && d < PLANET_ACTIVATE) this.activatePlanets(e);
      else if (e.planetsActive && d > PLANET_ACTIVATE * 1.3) this.deactivatePlanets(e);
    }
    // the supermassive black hole at the centre of the galaxy
    const core = g.core;
    const cx = -this.O.x * GU, cy = -this.O.y * GU, cz = -this.O.z * GU;
    const dc = Math.hypot(cx - p.x, cy - p.y, cz - p.z);
    if (core.alive && !this.coreBody && dc < CORE_ACTIVATE) {
      this.coreBody = this.addBody(new Body({ role: 'compact', compact: 'bh', name: core.name, mass: core.mass, static: true, x: cx, y: cy, z: cz, comp: { gas: 1 } }));
      this.coreBody.isCore = true;
      this.coreBody.bhSpin = 0.7;
    } else if (this.coreBody && (dc > CORE_ACTIVATE * 1.3 || !core.alive)) {
      if (this.coreBody.alive) { core.mass = this.coreBody.mass; this.removeBody(this.coreBody); }
      this.coreBody = null;
    }
  }

  activateSystem(rec, where) {
    const g = this.galaxy;
    const sys = this.systemInfo(rec);
    const st = sys.st;
    const detail = generateSystemDetail(sys);
    const entry = {
      id: rec.id, rec, sys, detail, star: null, companion: null, planets: [], planetsActive: false,
      pos: { x: where.x, y: where.y, z: where.z }, phase: st.phase, ageClass: sys.age, name: sys.name,
    };
    let extent = 3 * AU;
    for (const pl of detail.planets) extent = Math.max(extent, pl.a * 1.5);
    for (const b of detail.belts) extent = Math.max(extent, b.outer * 1.2);
    if (detail.disk) extent = Math.max(extent, detail.disk.outer);
    entry.extent = extent;
    const state = g.state.get(rec.id) || {};
    let star;
    if (st.phase === 'bh' || st.phase === 'ns') {
      star = new Body({ role: 'compact', compact: st.phase, mass: st.mass * M_SUN, name: sys.name, x: where.x, y: where.y, z: where.z, static: true, comp: { iron: 0.1, gas: 0.9 }, seed: rec.seed % 100000 });
      // young neutron stars stay magnetars for about 10,000 years
      if (st.phase === 'ns') star.magnetar = (st.since ?? 1e9) < 1e4 * (1 + (rec.seed % 3));
      star.nsSpin = st.phase === 'ns' ? 0.5 + (rec.seed % 50) : 0;
      star.bhSpin = st.phase === 'bh' ? (rec.seed % 90) / 100 : 0;
    } else if (st.phase === 'wd') {
      star = new Body({ role: 'compact', compact: 'wd', mass: st.mass * M_SUN, name: sys.name, x: where.x, y: where.y, z: where.z, static: true, comp: { carbon: 0.5, iron: 0.1, gas: 0.4 }, seed: rec.seed % 100000 });
      star.wdTemp = st.temp;
      star.updateRadius();
    } else {
      star = new Body({
        role: 'star', name: sys.name, mass: st.mass * M_SUN, x: where.x, y: where.y, z: where.z, static: true,
        comp: { rock: 0.01, iron: 0.005, ice: 0.015, gas: 0.97 }, seed: rec.seed % 100000, spin: 0.2, stellar: st,
      });
    }
    star.system = entry;
    star.persistentKey = 'star';
    entry.star = this.addBody(star);
    if (detail.companion && !state.companionEaten) {
      const c = detail.companion;
      const st2 = stellarState(rec.m0 * sys.binary.q, st.age) || st;
      const comp = new Body({
        role: 'rails', name: `${sys.name} B`, mass: c.mass, comp: { rock: 0.01, iron: 0.005, ice: 0.015, gas: 0.97 },
        stellar: st2.phase === 'ms' || st2.phase === 'rg' ? st2 : null, seed: (rec.seed % 1000) + 7,
        system: entry, persistentKey: 'companion',
      });
      comp.rails = { parent: entry.star, a: c.a, omega: c.omega, phase: c.phase, e1: detail.basis.e1, e2: detail.basis.e2, hill: c.a * 0.4 };
      comp.isCompanion = true;
      entry.companion = this.addBody(comp);
    }
    this.active.set(rec.id, entry);
    this.updateRails();
    this.emit('system-near', { name: sys.name, phase: st.phase, entry });
    return entry;
  }

  activatePlanets(e) {
    const st = this.galaxy.state.get(e.id) || {};
    const eaten = new Set(st.eaten || []);
    const { e1, e2 } = e.detail.basis;
    const parent = e.star;
    if (!parent || !parent.alive) { e.planetsActive = true; return; }
    e.detail.planets.forEach((pl, i) => {
      const key = `p${i}`;
      if (eaten.has(key)) return;
      const b = this.addBody(new Body({
        role: 'rails', name: pl.name, mass: pl.mass, comp: pl.comp, kind: pl.kind, life: pl.life,
        rings: pl.rings, tilt: pl.tilt, spin: pl.spin, seed: pl.seed, temp: pl.temp,
        system: e, persistentKey: key,
      }));
      b.alienLife = pl.life;
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
    if (e.star && e.star.alive && e.star !== this.player) this.removeBody(e.star);
    if (e.companion && e.companion.alive) this.removeBody(e.companion);
  }

  markEaten(b) {
    const e = b.system;
    if (!e || !b.persistentKey) return;
    const st = this.galaxy.stateOf(e.id);
    if (b.persistentKey === 'star') {
      st.starEaten = true;
      this.stats.systemsEaten++;
      for (const pl of e.planets) if (pl.alive && pl.rails) this.freeBody(pl);
      if (e.companion && e.companion.alive) this.freeBody(e.companion);
    } else if (b.persistentKey === 'companion') {
      st.companionEaten = true;
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

  hostSystem() {
    const p = this.player;
    if (!p) return null;
    let best = null, bd = Infinity;
    for (const e of this.active.values()) {
      const d = Math.hypot(e.pos.x - p.x, e.pos.y - p.y, e.pos.z - p.z);
      if (d < e.extent * 2.5 && d < bd) { bd = d; best = e; }
    }
    return best;
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
    let frameBody = best;
    const normal = hostStar ? hostStar.detail.normal : { x: 0, y: 1, z: 0 };
    if (hostStar) {
      for (const pl of hostStar.planets) {
        if (!pl.alive || pl === exclude || !pl.rails) continue;
        const h = pl.rails.hill || pl.radius * 10;
        if (Math.hypot(pl.x - x, pl.y - y, pl.z - z) < h * 0.6) frameBody = pl;
      }
    }
    for (const b of this.attractors) {
      if (b === exclude || b.role === 'player') continue;
      if (b.compact === 'bh' && b.mass > 50 * M_SUN) {
        const d = Math.hypot(b.x - x, b.y - y, b.z - z);
        if (d < b.rEff * 400 && (!frameBody || b.mass / (d * d) > bestScore)) frameBody = b;
      }
    }
    if (!frameBody) return { vx: 0, vy: 0, vz: 0, body: null };
    const rx = x - frameBody.x, ry = y - frameBody.y, rz = z - frameBody.z;
    const r = Math.hypot(rx, ry, rz) || 1;
    const vc = circularVelocity(frameBody.mass, Math.max(r, frameBody.rEff * 1.5));
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
    const t = this.time;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.bodies) {
        if (!b.alive || !b.rails) continue;
        const r = b.rails, par = r.parent;
        const isMoon = !!par.rails;
        if ((pass === 0) === isMoon) continue;
        if (!par.alive) { this.freeBody(b); continue; }
        const th = (r.phase + ((r.omega * t) % (Math.PI * 2))) % (Math.PI * 2);
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

  // ---------------------------------------------------------------- time warp

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
    if (this.sandbox && this.sandboxTime) return WARP_LEVELS.length - 1;
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

  // Deep time is only possible when you're calm: not thrusting, not in danger,
  // nothing heading your way. Returns '' if allowed, else the reason.
  deepBlockReason() {
    const p = this.player;
    if (!p || !p.alive) return 'No world';
    if (this.sandbox && this.sandboxTime) return '';
    if (this.input.level > 0.01) return 'Your jets are firing';
    if (this.tidalStress > 0) return 'Tidal stress';
    if (this.heatLoss > 0.004) return 'A star is cooking you';
    if (this.core) return 'Your core is collapsing';
    if (this.hazards.pending) return this.hazards.pending.reason;
    for (const b of this.bodies) {
      if (!b.alive || b === p || b.moonOf === p || b.role === 'rails' || b.static || b.role === 'fragment') continue;
      const d = p.distTo(b);
      if ((b.mass > p.mass && d < p.rEff * 20) || (b.storm && d < p.rEff * 60)) return `${b.name || 'Something'} is close`;
    }
    for (const e of this.active.values()) {
      const s = e.star;
      if (!s || !s.alive) continue;
      if (p.distTo(s) < s.rEff * 3) return `Too close to ${s.name}`;
    }
    return '';
  }

  setDeep(level) {
    level = clamp(level, 0, DEEP_LEVELS.length + 1);
    if (level > 0) {
      const why = this.deepBlockReason();
      if (why) { this.emit('deep-blocked', { reason: why }); return; }
      if (!this.deep) this.enterDeep();
    }
    if (level === 0 && this.deep) this.exitDeep();
    if (level !== this.deep) {
      this.deep = level;
      this.emit('deep', { level, rate: this.deepRate() });
    }
  }

  deepRate() {
    if (!this.deep) return 0;
    if (this.deep > DEEP_LEVELS.length) return Math.max(1e9, this.years * 0.6); // cosmic: time grows exponentially
    return DEEP_LEVELS[this.deep - 1];
  }

  // lock you into a calm orbit (or a straight coast through empty space)
  enterDeep() {
    const p = this.player;
    this.setWarp(0);
    this.sweepForWarp();
    for (const b of this.bodies) if (b.role === 'field' && b.moonOf !== p) b.alive = false;
    this.flushDead();
    const host = this.hostSystem();
    if (host && host.star && host.star.alive) {
      const s = host.star;
      const rx = p.x - s.x, ry = p.y - s.y, rz = p.z - s.z;
      const n = host.detail.normal, { e1, e2 } = host.detail.basis;
      const h = rx * n.x + ry * n.y + rz * n.z;
      const px = rx - n.x * h, py = ry - n.y * h, pz = rz - n.z * h;
      const r = Math.max(Math.hypot(px, py, pz), s.rEff * 4);
      const ang = Math.atan2(px * e2.x + py * e2.y + pz * e2.z, px * e1.x + py * e1.y + pz * e1.z);
      this.deepOrbit = { host: s, entry: host, r, ang, e1, e2, M: s.mass };
    } else {
      this.deepOrbit = { host: null };
    }
  }

  exitDeep() {
    this.deepOrbit = null;
    this.refreshActiveSystems();
    this.rebuildAttractors();
    this.field.update(0, true);
  }

  update(dtReal) {
    const p = this.player;
    if (!p) return;
    dtReal = Math.min(dtReal, 0.05);
    this.stats.timePlayed += dtReal;
    if (!p.alive) { this.flushDead(); return; }
    if (this.deep) { this.deepStep(dtReal); return; }

    // thrust cancels time warp
    if (this.input.level > 0.01 && this.warp > 1) this.setWarp(0);
    const maxW = this.maxWarpIndex();
    if (this.warpIndex > maxW) {
      this.warpIndex = maxW;
      this.warp = WARP_LEVELS[maxW];
      this.emit('warp', { level: this.warp, auto: true, reason: this.warpBlockReason });
      if (this.warp < 100) this.field.update(0, true);
    }

    const dtSim = dtReal * TIME_BASE * this.warp;
    const rs = dtReal;
    this.rebuildAttractors();

    // substeps keep close orbits around you stable
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
    this.galaxy.advance(dtSim / YEAR);
    if (!p.alive) { this.flushDead(); return; }

    this.tidal(rs);
    this.accretionDisk(rs);
    this.thermal(rs);
    this.nebulaFeed(rs);
    this.gasCapture(rs);
    this.updateBlasts();
    this.evolve(rs, dtSim / YEAR);
    for (const m of this.modules) m.update?.(rs, dtSim / YEAR);

    this.systemTimer -= rs;
    if (this.systemTimer <= 0) {
      this.refreshActiveSystems();
      this.systemTimer = this.warp >= 100 ? 0.15 : 0.6;
    }
    this.field.update(rs);
    this.hazards.update(rs, dtSim / YEAR);
    for (const b of this.bodies) {
      if (b.fadeIn < 1 && !b.fadeOut) b.fadeIn = Math.min(1, b.fadeIn + rs * 1.5);
      b.age += rs;
      b.rot += b.spin * rs * 0.12;
      if (b.heat > 0) b.heat = Math.max(0, b.heat - rs * (b === p ? 0.02 : 0.05));
    }
    p.heat = Math.max(p.heat, clamp(this.tidalStress * 1.3, 0, 1) * clamp(escapeVelocity(p.mass, p.radius) / 2, 0.15, 1));
    this.stats.peakMass = Math.max(this.stats.peakMass, p.mass);
    this.rebaseIfNeeded();
    this.flushDead();
  }

  // ---------------------------------------------------------------- deep time

  deepStep(dtReal) {
    const p = this.player;
    let years = this.deepRate() * dtReal;
    // the end of everything: a black hole evaporates by Hawking radiation
    if (p.compact === 'bh') {
      const tEnd = hawkingYears(p.mass);
      if (this.years + years >= tEnd) {
        this.galaxy.advance(Math.max(0, tEnd - this.years));
        this.emit('evaporated', {});
        return;
      }
    }
    const secs = years * YEAR;
    const o = this.deepOrbit;
    if (o && o.host) {
      const s = o.host;
      if (!s.alive) { this.setDeep(0); return; }
      // a star losing mass lets its planets drift outward
      if (s.mass !== o.M) { o.r *= o.M / Math.max(s.mass, 1); o.M = s.mass; }
      const w = Math.sqrt((G * (s.mass + p.mass)) / Math.pow(o.r, 3));
      o.ang = (o.ang + ((w * Math.min(secs, 1e13)) % (Math.PI * 2))) % (Math.PI * 2);
      const c = Math.cos(o.ang), sn = Math.sin(o.ang);
      const ox = p.x, oy = p.y, oz = p.z;
      p.x = s.x + o.r * (c * o.e1.x + sn * o.e2.x);
      p.y = s.y + o.r * (c * o.e1.y + sn * o.e2.y);
      p.z = s.z + o.r * (c * o.e1.z + sn * o.e2.z);
      const v = o.r * w;
      p.vx = s.vx + v * (-sn * o.e1.x + c * o.e2.x);
      p.vy = s.vy + v * (-sn * o.e1.y + c * o.e2.y);
      p.vz = s.vz + v * (-sn * o.e1.z + c * o.e2.z);
      for (const b of this.bodies) if (b.moonOf === p) { b.x += p.x - ox; b.y += p.y - oy; b.z += p.z - oz; b.vx = p.vx; b.vy = p.vy; b.vz = p.vz; }
      // swallowed by a swelling red giant?
      if (s.rEff > o.r * 0.9 && !this.invincible) {
        this.setDeep(0);
        this.killPlayer(`Swallowed by ${s.name} as it swelled into a red giant`, s);
        return;
      }
    } else {
      // coasting between the stars in straight lines while the galaxy changes
      const ox = p.x, oy = p.y, oz = p.z;
      p.x += p.vx * secs; p.y += p.vy * secs; p.z += p.vz * secs;
      for (const b of this.bodies) if (b.moonOf === p) { b.x += p.x - ox; b.y += p.y - oy; b.z += p.z - oz; }
      const step = Math.hypot(p.vx, p.vy, p.vz) * secs;
      if (step > 0) {
        const near = this.galaxy.starsNear(p, this.O, Math.max(STAR_ACTIVATE * 1.5, step * 2));
        for (const s of near) {
          if (s.d < STAR_ACTIVATE * 1.2 && this.galaxy.starNow(s.rec)) {
            this.setDeep(0);
            this.emit('arrive', { name: this.galaxy.nameOf(s.rec), d: s.d });
            break;
          }
        }
      }
    }
    this.time += secs;
    this.galaxy.advance(years);
    this.evolve(dtReal, years);
    for (const m of this.modules) m.update?.(dtReal, years);
    this.hazards.update(dtReal, years);
    this.systemTimer -= dtReal;
    if (this.systemTimer <= 0) {
      this.refreshActiveSystems();
      this.rebuildAttractors();
      this.systemTimer = 0.25;
      if (this.deepOrbit?.host && !this.deepOrbit.host.alive) this.setDeep(0);
    }
    for (const b of this.bodies) if (b.heat > 0) b.heat = Math.max(0, b.heat * Math.exp(-years / 2e5));
    this.rebaseIfNeeded();
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
    // an advanced civilisation's planet-moving engines add thrust
    const engines = 1 + (this.civThrust || 0);
    const aReal = 5.5 * boost * engines;
    const a = ((aReal * p.rEff) / (TIME_BASE * TIME_BASE)) * level;
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    const limit = clamp(1 - sp / (0.3 * C), 0, 1);
    p.tax = dx * a * limit; p.tay = dy * a * limit; p.taz = dz * a * limit;
    // jets throw away a little of you (black holes power theirs from what falls in)
    const cost = (inp.boost ? 0.0075 : 0.0016) * level;
    if (p.compact !== 'bh' && !this.invincible) {
      p.mass -= p.mass * cost * rs;
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
    const px = dx - vx * h, py = dy - vy * h, pz = dz - vz * h;
    let t = -(px * vx + py * vy + pz * vz) / vv;
    t = clamp(t, 0, h);
    const cx = px + vx * t, cy = py + vy * t, cz = pz + vz * t;
    return cx * cx + cy * cy + cz * cz < rad * rad;
  }

  // who wins a collision: neutron stars and black holes beat anything that isn't one; otherwise bigger wins
  beats(a, b) {
    const ca = a.compact === 'ns' || a.compact === 'bh', cb = b.compact === 'ns' || b.compact === 'bh';
    if (ca && !cb) return true;
    if (cb && !ca) return false;
    return a.mass >= b.mass;
  }

  collisions(h) {
    const p = this.player;
    const at = this.attractors;
    for (const b of this.bodies) {
      if (!b.alive || b === p) continue;
      const rad = p.rEff + b.rEff;
      const dx = b.x - p.x, dy = b.y - p.y, dz = b.z - p.z;
      const near = dx * dx + dy * dy + dz * dz;
      const reach = rad + Math.hypot(b.vx - p.vx, b.vy - p.vy, b.vz - p.vz) * h;
      if (near < reach * reach && this.sweptHit(p, b, h, rad)) {
        if (this.beats(p, b) || this.invincible) this.playerEats(b);
        else { this.killPlayer(`Swallowed by ${b.name || b.typeLabel}`, b); return; }
        continue;
      }
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
    if (!p.compact && !p.isStar && !this.invincible) {
      // slow impacts stick; fast ones blast material back into space
      const excess = Math.max(0, (vrel / vesc) * (vrel / vesc) - 4);
      ejecta = Math.min(m * 0.06 * excess, m * 2.5, p.mass * 0.4);
    }
    // black holes radiate part of what they swallow (more if they spin fast)
    let radiated = 0;
    if (p.compact === 'bh') radiated = m * (0.057 + 0.25 * Math.pow(p.bhSpin || 0, 3));
    const M0 = p.mass;
    p.absorbComp(b, m);
    p.mass = Math.max(p.mass + m - ejecta - radiated, 1e12);
    // what you eat steers what you become
    p.diet = mixComp(p.diet || p.comp, M0 * 0.5, b.comp, m);
    // momentum is conserved
    p.vx = (p.vx * M0 + b.vx * m) / (M0 + m);
    p.vy = (p.vy * M0 + b.vy * m) / (M0 + m);
    p.vz = (p.vz * M0 + b.vz * m) / (M0 + m);
    const energy = (m / M0) * Math.pow(vrel / Math.max(vesc, 1e-9), 2);
    // impact heat per kilogram goes as velocity squared: a 3 km rock barely warms,
    // a Mars-sized body (escape speed ~5 km/s) can melt into a magma ocean
    const meltable = clamp(Math.pow(vesc / 4.5, 2), 0, 1);
    p.heat = clamp(p.heat + (energy * 0.9 + (m / M0) * 0.5) * meltable, 0, 1);
    // fresh hydrogen dilutes a star's spent core
    if (p.fuel && b.comp.gas > 0.3) p.fuel *= M0 / p.mass;
    // infalling matter spins up neutron stars and black holes
    if (p.compact === 'ns') p.nsSpin = Math.min(700, (p.nsSpin || 1) + (m / M0) * 4000);
    if (p.compact === 'bh') p.bhSpin = clamp((p.bhSpin || 0) + (m / M0) * 0.6, 0, 0.998);
    // a big hit changes how fast you spin and how tilted you are
    const dl = Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) || 1;
    const rx = (b.x - p.x) / dl, ry = (b.y - p.y) / dl, rz = (b.z - p.z) / dl;
    const kick = clamp((m / M0) * (vrel / Math.max(escapeVelocity(M0, p.radius), 1e-9)), 0, 2);
    if (!p.compact && !p.isStar) {
      p.spin = clamp(p.spin + (this.rng.next() - 0.45) * kick * 3, -6, 6);
      p.tilt = clamp(p.tilt + (this.rng.next() - 0.5) * kick * 0.8, 0, Math.PI);
    }
    p.updateRadius();
    this.removeBody(b);
    if (b.persistentKey) this.markEaten(b);
    if (b.role !== 'fragment') {
      this.stats.eaten++;
      this.stats.biggestMeal = Math.max(this.stats.biggestMeal, m);
      const kind = b.typeLabel;
      this.stats.kinds[kind] = (this.stats.kinds[kind] || 0) + 1;
    }
    if (b.life || b.alienLife) this.stats.lifeFound++;
    this.emit('impact', {
      body: b, mass: m, gain: m - ejecta - radiated, ejecta, rel: m / M0, energy,
      dir: { x: rx, y: ry, z: rz }, vrel, vesc, kick,
      fragment: b.role === 'fragment', life: b.life || b.alienLife, name: b.name, label: b.typeLabel,
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
      // you tear apart smaller things
      if (this.beats(p, b) && b.role !== 'fragment') {
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
          const k = Math.min(Math.ceil(b.mass / chunk), Math.max(4, MAX_FRAGMENTS - fragCount));
          const each = b.mass / k;
          for (let i = 0; i < k; i++) this.spawnFragment(b, each, p, 1.0);
          fragCount += k;
          if (b.persistentKey) this.markEaten(b);
          this.emit('shatter', { body: b, name: b.name, label: b.typeLabel, mass: m0, star: b.isStar });
          this.removeBody(b);
        } else {
          b.updateRadius();
        }
        continue;
      }
      // bigger things (and anything compact) tear YOU apart
      if (!this.beats(p, b) && !(p.compact === 'ns' || p.compact === 'bh') && b.role !== 'fragment' && !this.invincible) {
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
    if (gasDrag > 0 && !p.isStar && !p.compact && p.mass < 6e25) {
      const gain = p.mass * 0.0035 * gasDrag * rs;
      const pc = env.snow > 1 ? { rock: 0.38, iron: 0.1, ice: 0.48, carbon: 0.04, gas: 0 } : { rock: 0.63, iron: 0.3, ice: 0.04, carbon: 0.03, gas: 0 };
      p.absorbComp(pc, gain);
      p.mass += gain;
      p.updateRadius();
      this.pebbleRate = 0.0035 * gasDrag;
    } else this.pebbleRate = 0;
    // frame dragging: a spinning black hole swirls nearby matter its way
    const drag = p.compact === 'bh' ? (p.bhSpin || 0) * 0.6 : 0;
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
            if (b.capt > 1.5) {
              b.moonOf = p;
              b.moonName = b.moonName || `${p.name} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][moons] || 'M'}`;
              b.name = b.moonName;
              this.emit('moon', { body: b });
            }
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
      const inspiral = (isMoon ? 0.004 : 0.035) * pull * (p.compact ? 1.5 : 1);
      const ux = rx / d, uy = ry / d, uz = rz / d;
      let tx = n.y * uz - n.z * uy, ty = n.z * ux - n.x * uz, tz = n.x * uy - n.y * ux;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      let sgn = vx * tx + vy * ty + vz * tz >= 0 ? 1 : -1;
      if (drag > 0 && d < p.rEff * 6) sgn = 1;
      const h = rx * n.x + ry * n.y + rz * n.z;
      const sp = 0.98 * (1 + drag * 0.15);
      const tvx = sgn * tx * vc * sp - ux * vc * inspiral - n.x * (h / d) * vc * 0.5;
      const tvy = sgn * ty * vc * sp - uy * vc * inspiral - n.y * (h / d) * vc * 0.5;
      const tvz = sgn * tz * vc * sp - uz * vc * inspiral - n.z * (h / d) * vc * 0.5;
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
      best = Math.min(best, hillRadius(p.distTo(b), p.mass, b.mass));
    }
    return Math.min(best, p.rEff * 60);
  }

  // A big enough rocky core inside a gas disk pulls the gas in faster and faster.
  gasCapture(rs) {
    const p = this.player;
    const env = this.field.env;
    this.gasRate = 0;
    if (p.compact || p.isStar || env.kind !== 'disk') return;
    const me = p.mass / M_EARTH;
    if (me < 10) return;
    const rate = 0.012 * Math.min(1, (me - 10) / 10 + 0.15) * Math.min(env.density, 1.5);
    const gain = p.mass * rate * rs;
    p.absorbComp({ gas: 0.98, ice: 0.02 }, gain);
    p.mass += gain;
    p.diet = mixComp(p.diet || p.comp, p.mass * 0.4, { gas: 0.98, ice: 0.02 }, gain * 3);
    p.updateRadius();
    this.gasRate = rate;
    if (!this.gasWarned) { this.gasWarned = true; this.emit('gas-capture', {}); }
  }

  // ---------------------------------------------------------------- heat

  thermal(rs) {
    const p = this.player;
    let T = 3, hottest = null;
    for (const s of this.stars) {
      if (!s.alive) continue;
      const d = p.distTo(s);
      const dReal = s.radius + Math.max(0, d - s.radius) * DIST_COMPRESS;
      const t = equilibriumTemp(s.starTemp, s.radius, dReal, 0.3);
      if (t > T) { T = t; hottest = s; }
    }
    p.temp = Math.max(T, 3);
    this.heatLoss = 0;
    this.heatSource = hottest;
    if (p.isStar || p.compact || !hottest || this.invincible) return;
    let loss = 0;
    const c = p.comp;
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
    const ice = c.ice * p.mass - iceDm;
    p.mass -= dm;
    c.ice = clamp(ice / p.mass, 0, 1);
    const rest = c.rock + c.iron + c.gas + c.carbon;
    if (rest > 0) {
      const k = (1 - c.ice) / rest;
      c.rock *= k; c.iron *= k; c.gas *= k; c.carbon *= k;
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
    p.absorbComp({ rock: 0.01, ice: 0.02, gas: 0.97 }, gain);
    p.mass += gain;
    nb.massLeft = Math.max(0, nb.massLeft - gain / nb.mass);
    this.galaxy.stateOf(nb.id).massLeft = nb.massLeft;
    p.updateRadius();
    this.emit('nebula-feed', { gain });
  }

  // ---------------------------------------------------------------- evolution

  evolve(rs, years) {
    const p = this.player;
    const Ms = p.mass / M_SUN;
    // neutron stars that get too heavy collapse
    if (p.compact === 'ns' && p.mass > NS_MAX_MASS) {
      p.compact = 'bh';
      p.bhSpin = Math.min(0.9, (p.bhSpin || 0) + 0.5);
      p.updateRadius();
      this.emit('collapse', { to: 'bh' });
    }
    // white dwarfs over the Chandrasekhar limit explode completely
    if (p.compact === 'wd' && p.mass > WD_MAX_MASS && !this.invincible) {
      this.blasts.push({ x: p.x, y: p.y, z: p.z, t0: this.time, speed: 10000, energy: 1e44, hit: new Set([p.id]), r: 0, sysName: 'your white dwarf' });
      this.emit('supernova', { self: true, ia: true, x: p.x, y: p.y, z: p.z, toBH: false });
      this.killPlayer('You crossed the Chandrasekhar limit (1.4 Suns) and exploded as a Type Ia supernova. Nothing was left.', null, true);
      return;
    }
    // a hydrogen-poor body too heavy for electron pressure collapses
    if (!p.compact && !p.isStar && p.mass > WD_MAX_MASS && p.comp.gas < 0.5) {
      p.compact = 'ns';
      p.nsSpin = 30;
      p.updateRadius();
      this.emit('collapse', { to: 'ns', rock: true });
    }
    if (p.compact === 'wd') {
      p.wdTemp = Math.max(3000, (p.wdTemp || 30000) * Math.exp(-years / 3e9));
      p.updateRadius();
    }
    if (p.compact === 'ns') p.nsSpin = Math.max(0.2, (p.nsSpin || 1) * Math.exp(-years / 1e8));
    // stars burn their core hydrogen; how long depends steeply on mass
    if (p.isStar && !p.compact) {
      const tMS = msLifetimeYears(Ms);
      if (!p.phase) {
        p.fuel = (p.fuel || 0) + years / tMS;
        if (p.fuel >= 1) {
          p.phase = Ms >= 8 ? 'sg' : 'rg';
          p.giantT = 0;
          this.emit('giant', { super: Ms >= 8 });
        }
      } else {
        p.giantT = (p.giantT || 0) + years / (tMS * 0.12);
        if (p.phase === 'rg') {
          p.swell = 3 + 120 * Math.pow(Math.min(p.giantT, 1), 2);
          if (p.giantT >= 1) this.becomeWhiteDwarf();
        } else if (p.phase === 'sg') {
          p.swell = 3 + 60 * Math.min(p.giantT, 1);
          if (p.giantT >= 1 && !this.core) { this.core = { stage: 0, t: 0 }; this.emit('core-start', {}); this.setDeep(0); }
        }
        p.updateRadius();
      }
    }
    // the last stages of a massive core, in real time
    if (this.core) {
      const st = CORE_BURN_STAGES[this.core.stage];
      this.core.t += rs;
      if (this.core.t >= st.dur) {
        this.core.t = 0;
        this.core.stage++;
        if (this.core.stage >= CORE_BURN_STAGES.length) {
          this.playerSupernova();
          this.core = null;
        } else this.emit('core-stage', { el: CORE_BURN_STAGES[this.core.stage].el, real: CORE_BURN_STAGES[this.core.stage].real });
      }
    }
    const form = p.form;
    if (form !== this.lastForm) {
      const up = tierOf(form) > tierOf(this.lastForm) || FORM[form]?.compact;
      this.emit('stage', { from: this.lastForm, to: form, up });
      this.lastForm = form;
      this.seeForm(form);
    }
  }

  seeForm(form) {
    if (!this.stats.formsSeen.includes(form)) this.stats.formsSeen.push(form);
  }

  becomeWhiteDwarf() {
    const p = this.player;
    const wd = whiteDwarfMass(p.mass / M_SUN) * M_SUN;
    const lost = p.mass - wd;
    p.phase = null;
    p.swell = 1;
    p.mass = wd;
    p.compact = 'wd';
    p.wdTemp = 100000;
    p.comp = { rock: 0, iron: 0.02, ice: 0, carbon: 0.6, gas: 0.38 };
    p.updateRadius();
    this.emit('planetary-nebula', { lost, x: p.x, y: p.y, z: p.z });
  }

  playerSupernova() {
    const p = this.player;
    const M = p.mass;
    const toBH = M >= BH_FROM_SN_MASS;
    const remnant = toBH ? M * 0.32 : Math.min(2.1, 1.35 + 0.025 * (M / M_SUN - 8)) * M_SUN;
    this.blasts.push({ x: p.x, y: p.y, z: p.z, t0: this.time, speed: 9000, energy: 1e44, owner: p, hit: new Set([p.id]), r: 0 });
    p.mass = remnant;
    p.compact = toBH ? 'bh' : 'ns';
    p.phase = null;
    p.swell = 1;
    p.nsSpin = toBH ? 0 : 60;
    p.bhSpin = toBH ? 0.3 : 0;
    p.magnetar = !toBH && this.rng.chance(0.35);
    p.comp = { iron: 0.2, gas: 0.8, rock: 0, ice: 0, carbon: 0 };
    p.heat = 1;
    p.updateRadius();
    for (let i = 0; i < 90; i++) {
      const v = this.rng.unitVector();
      const d = p.rEff * this.rng.range(5, 40);
      const sp = this.rng.range(0.4, 1.4) * Math.sqrt((G * p.mass) / d);
      const f = this.addBody(new Body({
        role: 'fragment', name: 'Supernova ejecta', mass: ((M - remnant) * 0.15) / 90,
        comp: { rock: 0.05, iron: 0.1, gas: 0.85 }, kind: 'plasma',
        x: p.x + v.x * d, y: p.y + v.y * d, z: p.z + v.z * d,
        vx: p.vx + v.x * sp, vy: p.vy + v.y * sp, vz: p.vz + v.z * sp,
      }));
      f.hot = 1; f.fromStar = true; f.lifetime = 0;
    }
    this.emit('supernova', { self: true, x: p.x, y: p.y, z: p.z, toBH, remnant });
  }

  // a star in the galaxy explodes (called by hazards)
  systemSupernova(entry, ia = false) {
    const s = entry.star;
    const M = s.mass;
    const toBH = !ia && M >= BH_FROM_SN_MASS;
    const remnant = toBH ? M * 0.3 : 1.4 * M_SUN;
    this.blasts.push({ x: s.x, y: s.y, z: s.z, t0: this.time, speed: 9000, energy: 1e44, hit: new Set([s.id]), r: 0, sysName: entry.name });
    const st = this.galaxy.stateOf(entry.id);
    if (ia) st.destroyed = true;
    else st.remnant = { compact: toBH ? 'bh' : 'ns', mass: remnant };
    for (const pl of entry.planets) {
      if (!pl.alive) continue;
      for (let i = 0; i < 6; i++) this.spawnFragment(pl, pl.mass / 6, s, 1);
      this.removeBody(pl);
    }
    entry.planets = [];
    this.emit('supernova', { self: false, x: s.x, y: s.y, z: s.z, name: entry.name, toBH, ia });
    if (ia) this.removeBody(s);
    else {
      s.compact = toBH ? 'bh' : 'ns';
      s.stellar = null;
      s.mass = remnant;
      s.role = 'compact';
      s.magnetar = !toBH;
      s.updateRadius();
      s.name = `${entry.name} remnant`;
    }
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
          const dReal = d * (d < 1e11 ? DIST_COMPRESS : 1) * 1000; // metres
          const Rm = p.radius * 1000;
          const caught = (bl.energy * Rm * Rm) / (4 * dReal * dReal);
          const bind = (0.6 * 6.674e-11 * p.mass * p.mass) / Math.max(Rm, 1);
          let frac = p.compact || this.invincible ? 0 : clamp(0.12 * Math.pow(caught / bind, 0.35), 0, 0.95);
          if (p.isStar) frac *= 0.3;
          const ux = (p.x - bl.x) / d, uy = (p.y - bl.y) / d, uz = (p.z - bl.z) / d;
          const push = Math.min(bl.speed * 0.05, (2 * caught) / (bl.speed * 1000 * p.mass) / 1000);
          p.vx += ux * push; p.vy += uy * push; p.vz += uz * push;
          if (frac > 0) {
            p.mass *= 1 - frac;
            p.updateRadius();
            p.heat = 1;
          }
          this.emit('blast-hit', { frac, sysName: bl.sysName, dist: d });
          if (frac > 0.9) { this.killPlayer(`Vaporised by the supernova of ${bl.sysName || 'your own star'}`); return; }
        }
      }
    }
    this.blasts = this.blasts.filter((bl) => bl.r < 5e10);
  }

  // ---------------------------------------------------------------- death

  killPlayer(cause, killer = null, total = false) {
    const p = this.player;
    if (!p.alive || this.invincible) return;
    p.alive = false;
    this.deep = 0;
    this.deepOrbit = null;
    this.stats.deaths++;
    if (killer && killer.alive) killer.mass += p.mass;
    this.emit('death', { cause, mass: p.mass, x: p.x, y: p.y, z: p.z, total });
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
    this.hazards.reset();
    const mass = clamp(prevMass * 2e-4, 2.2e14, 8e28);
    const [lx, ly, lz] = this.toLy(old.x, old.y, old.z);
    const rec = g.rebirthSpot(lx, ly, lz, rng);
    const comp = mass > 30 * M_EARTH ? { rock: 0.05, iron: 0.02, ice: 0.08, gas: 0.85 } : { rock: 0.58, iron: 0.27, ice: 0.12, carbon: 0.03, gas: 0 };
    for (const [id, e] of this.active) { this.deactivateSystem(e); this.active.delete(id); }
    if (this.coreBody) { this.coreBody.alive = false; this.coreBody = null; }
    this.flushDead();
    this.player = null;
    const au = mass > 30 * M_EARTH ? rng.range(4, 9) : rng.range(0.85, 1.3);
    const p = this.spawnPlayer({ mass, comp, starRec: rec, orbitAU: au, seed: old.seed + 1 });
    this.warpIndex = 0; this.warp = 1;
    this.emit('reborn', { sys: g.nameOf(rec), mass });
    return p;
  }

  // ---------------------------------------------------------------- save

  serialize() {
    const p = this.player;
    return {
      v: 2,
      galaxy: this.galaxy.serialize(),
      time: this.time,
      O: { ...this.O },
      player: {
        mass: p.mass, comp: { ...p.comp }, compact: p.compact, name: p.name, seed: p.seed, phase: p.phase,
        fuel: p.fuel, diet: p.diet, born: p.born, spin: p.spin, tilt: p.tilt, heat: p.heat,
        wdTemp: p.wdTemp, nsSpin: p.nsSpin, bhSpin: p.bhSpin, giantT: p.giantT,
        pos: { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz },
      },
      modules: Object.fromEntries(this.modules.filter((m) => m.serialize).map((m) => [m.key, m.serialize()])),
      stats: { ...this.stats },
    };
  }
}
