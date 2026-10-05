// Sandbox tools: change yourself, spawn anything, bend time and the rules.
import { Body } from '../world/body.js';
import { Galaxy, LY } from '../world/galaxy.js';
import { M_SUN, M_EARTH, M_JUP, G } from '../core/constants.js';
import { escapeVelocity } from '../core/phys.js';
import * as F from '../core/format.js';

const $ = (id) => document.getElementById(id);

const SPAWNS = {
  rock: { name: 'Asteroid', comp: { rock: 0.65, iron: 0.3, ice: 0.05 }, rel: 0.02 },
  comet: { name: 'Comet', comp: { rock: 0.3, iron: 0.05, ice: 0.6, carbon: 0.05 }, rel: 0.02 },
  moon: { name: 'Moon', comp: { rock: 0.7, iron: 0.26, ice: 0.04 }, mass: 7.3e22 },
  earth: { name: 'Earth-like planet', comp: { rock: 0.6, iron: 0.32, ice: 0.08 }, mass: M_EARTH },
  ocean: { name: 'Ocean world', comp: { rock: 0.35, iron: 0.1, ice: 0.55 }, mass: 3 * M_EARTH },
  diamond: { name: 'Carbon world', comp: { rock: 0.35, iron: 0.15, ice: 0.05, carbon: 0.45 }, mass: 4 * M_EARTH },
  neptune: { name: 'Ice giant', comp: { rock: 0.2, iron: 0.05, ice: 0.6, gas: 0.15 }, mass: 17 * M_EARTH },
  jupiter: { name: 'Gas giant', comp: { rock: 0.03, iron: 0.01, ice: 0.06, gas: 0.9 }, mass: M_JUP },
  browndwarf: { name: 'Brown dwarf', comp: { gas: 0.97, ice: 0.02, rock: 0.01 }, mass: 40 * M_JUP },
  reddwarf: { name: 'Red dwarf', comp: { gas: 0.97, ice: 0.02, rock: 0.01 }, mass: 0.2 * M_SUN },
  sun: { name: 'Sun-like star', comp: { gas: 0.97, ice: 0.02, rock: 0.01 }, mass: M_SUN },
  bluegiant: { name: 'Blue giant', comp: { gas: 0.97, ice: 0.02, rock: 0.01 }, mass: 20 * M_SUN },
  whitedwarf: { name: 'White dwarf', compact: 'wd', comp: { carbon: 0.6, gas: 0.38, iron: 0.02 }, mass: 0.7 * M_SUN },
  neutron: { name: 'Neutron star', compact: 'ns', comp: { iron: 0.2, gas: 0.8 }, mass: 1.5 * M_SUN },
  blackhole: { name: 'Black hole', compact: 'bh', comp: { gas: 1 }, mass: 10 * M_SUN },
  smbh: { name: 'Supermassive black hole', compact: 'bh', comp: { gas: 1 }, mass: 4e6 * M_SUN },
};

const BECOME = {
  keep: null,
  planetesimal: { mass: 2.2e14, comp: { rock: 0.6, iron: 0.25, ice: 0.12, carbon: 0.03 } },
  earth: { mass: M_EARTH, comp: { rock: 0.55, iron: 0.32, ice: 0.12, carbon: 0.01 } },
  ocean: { mass: 3 * M_EARTH, comp: { rock: 0.35, iron: 0.1, ice: 0.55 } },
  iron: { mass: 0.8 * M_EARTH, comp: { rock: 0.3, iron: 0.7 } },
  diamond: { mass: 5 * M_EARTH, comp: { rock: 0.35, iron: 0.15, ice: 0.05, carbon: 0.45 } },
  jupiter: { mass: M_JUP, comp: { rock: 0.03, iron: 0.01, ice: 0.06, gas: 0.9 } },
  browndwarf: { mass: 40 * M_JUP, comp: { gas: 0.97, ice: 0.02, rock: 0.01 } },
  sun: { mass: M_SUN, comp: { gas: 0.97, ice: 0.02, rock: 0.01 } },
  massive: { mass: 25 * M_SUN, comp: { gas: 0.97, ice: 0.02, rock: 0.01 } },
  whitedwarf: { mass: 0.9 * M_SUN, compact: 'wd', comp: { carbon: 0.6, gas: 0.38, iron: 0.02 } },
  neutron: { mass: 1.5 * M_SUN, compact: 'ns', comp: { iron: 0.2, gas: 0.8 } },
  blackhole: { mass: 10 * M_SUN, compact: 'bh', comp: { gas: 1 } },
  smbh: { mass: 4e6 * M_SUN, compact: 'bh', comp: { gas: 1 } },
};

export class Sandbox {
  constructor(game) {
    this.game = game;
    this.built = false;
  }

  open() {
    if (!this.built) this.build();
    this.sync();
  }

  build() {
    const body = $('sandbox-body');
    const opt = (o) => Object.entries(o).map(([k, v]) => `<option value="${k}">${v ? v.name || k : 'Keep my mass'}</option>`).join('');
    body.innerHTML = `<div class="cols">
      <div class="block"><h3>Rules</h3>
        <div class="row"><label for="sb-inv">Invincible</label><input type="checkbox" id="sb-inv"></div>
        <div class="row"><label for="sb-haz">Dangers (storms, rogue planets, supernovae)</label><input type="checkbox" id="sb-haz"></div>
        <div class="row"><label for="sb-time">Time warp and deep time anywhere</label><input type="checkbox" id="sb-time"></div>
        <h3 style="margin-top:12px">Time</h3>
        <div class="menu"><button class="btn small" data-skip="1e6">+1 million years</button><button class="btn small" data-skip="1e8">+100 million</button><button class="btn small" data-skip="1e9">+1 billion</button><button class="btn small" data-skip="5e9">+5 billion</button></div>
        <p class="note" id="sb-time-note"></p>
        <h3 style="margin-top:12px">Go somewhere</h3>
        <div class="menu"><button class="btn small" data-go="home">Your birth star</button><button class="btn small" data-go="nebula">A nebula</button><button class="btn small" data-go="core">Galactic core</button></div>
      </div>
      <div class="block"><h3>Change yourself</h3>
        <div class="row"><label for="sb-become">Become</label><select id="sb-become">${Object.keys(BECOME).map((k) => `<option value="${k}">${k === 'keep' ? 'Keep my kind' : k.replace(/^./, (c) => c.toUpperCase())}</option>`).join('')}</select></div>
        <div class="row"><label for="sb-mass">Mass</label><input type="range" id="sb-mass" min="12" max="40" step="0.01"></div>
        <p class="note" id="sb-mass-out"></p>
        ${['rock', 'iron', 'ice', 'carbon', 'gas'].map((k) => `<div class="row"><label for="sb-c-${k}">${k}</label><input type="range" id="sb-c-${k}" min="0" max="1" step="0.01"></div>`).join('')}
        <div class="menu"><button class="btn small primary" id="sb-apply">Apply</button></div>
      </div>
      <div class="block"><h3>Spawn</h3>
        <div class="row"><label for="sb-what">What</label><select id="sb-what">${opt(SPAWNS)}</select></div>
        <div class="row"><label for="sb-scale">Mass ×</label><input type="range" id="sb-scale" min="-3" max="3" step="0.05" value="0"></div>
        <div class="row"><label for="sb-dist">Distance (your sizes)</label><input type="range" id="sb-dist" min="4" max="200" step="1" value="30"></div>
        <div class="row"><label for="sb-orbit">Put it in orbit around you</label><input type="checkbox" id="sb-orbit" checked></div>
        <p class="note" id="sb-spawn-out"></p>
        <div class="menu"><button class="btn small primary" id="sb-spawn">Spawn in front of you</button></div>
        <h3 style="margin-top:12px">Events</h3>
        <div class="menu"><button class="btn small" data-ev="storm">Asteroid storm</button><button class="btn small" data-ev="comets">Comet swarm</button><button class="btn small" data-ev="rogue">Rogue planet</button><button class="btn small" data-ev="sn">Nearby supernova</button><button class="btn small" data-ev="grb">Gamma-ray burst</button></div>
      </div>
    </div>`;
    const g = this.game;
    $('sb-inv').addEventListener('change', (e) => { g.world.invincible = e.target.checked; });
    $('sb-haz').addEventListener('change', (e) => { g.world.sandboxHazards = e.target.checked; });
    $('sb-time').addEventListener('change', (e) => { g.world.sandboxTime = e.target.checked; });
    for (const b of body.querySelectorAll('[data-skip]')) b.addEventListener('click', () => this.skip(+b.dataset.skip));
    for (const b of body.querySelectorAll('[data-go]')) b.addEventListener('click', () => this.go(b.dataset.go));
    for (const b of body.querySelectorAll('[data-ev]')) b.addEventListener('click', () => this.event(b.dataset.ev));
    $('sb-become').addEventListener('change', () => {
      const t = BECOME[$('sb-become').value];
      if (!t) return;
      $('sb-mass').value = Math.log10(t.mass);
      for (const k of ['rock', 'iron', 'ice', 'carbon', 'gas']) $(`sb-c-${k}`).value = t.comp[k] || 0;
      this.massText();
    });
    $('sb-mass').addEventListener('input', () => this.massText());
    $('sb-apply').addEventListener('click', () => this.apply());
    $('sb-spawn').addEventListener('click', () => this.spawn());
    for (const id of ['sb-what', 'sb-scale', 'sb-dist']) $(id).addEventListener('input', () => this.spawnText());
    for (const el of body.querySelectorAll('input,select')) el.addEventListener('keydown', (e) => e.stopPropagation());
    this.built = true;
  }

  sync() {
    const g = this.game, w = g.world, p = w.player;
    $('sb-inv').checked = !!w.invincible;
    $('sb-haz').checked = !!w.sandboxHazards;
    $('sb-time').checked = !!w.sandboxTime;
    $('sb-become').value = 'keep';
    $('sb-mass').value = Math.log10(p.mass);
    for (const k of ['rock', 'iron', 'ice', 'carbon', 'gas']) $(`sb-c-${k}`).value = p.comp[k] || 0;
    this.massText();
    this.spawnText();
    $('sb-time-note').textContent = `Universe age: ${F.years(13.8e9 + w.years)}`;
  }

  massText() {
    const m = Math.pow(10, +$('sb-mass').value);
    $('sb-mass-out').textContent = `${F.massFriendly(m)} (${F.sci(m, 2)} kg)`;
  }

  spawnText() {
    const t = SPAWNS[$('sb-what').value];
    const p = this.game.world.player;
    const m = (t.mass || p.mass * t.rel) * Math.pow(10, +$('sb-scale').value);
    $('sb-spawn-out').textContent = `${t.name}: ${F.massFriendly(m)} · ${m > p.mass ? 'bigger than you' : 'smaller than you'}`;
  }

  apply() {
    const g = this.game, w = g.world, p = w.player;
    const key = $('sb-become').value;
    const t = BECOME[key];
    const comp = {};
    for (const k of ['rock', 'iron', 'ice', 'carbon', 'gas']) comp[k] = +$(`sb-c-${k}`).value;
    const sum = Object.values(comp).reduce((a, b) => a + b, 0) || 1;
    for (const k of Object.keys(comp)) comp[k] /= sum;
    g.become(Math.pow(10, +$('sb-mass').value), { comp, compact: t ? t.compact ?? null : p.compact });
    if (t?.compact === 'ns') { p.nsSpin = 30; }
    if (t?.compact === 'bh') { p.bhSpin = 0.3; }
    if (t?.compact === 'wd') { p.wdTemp = 30000; p.updateRadius(); }
    p.fuel = 0;
    g.formStart = { form: p.form, mass: p.mass };
    g.hud.log(`You are now ${F.massFriendly(p.mass)}`, 'info');
    this.sync();
  }

  spawn() {
    const g = this.game, w = g.world, p = w.player;
    const t = SPAWNS[$('sb-what').value];
    const m = (t.mass || p.mass * t.rel) * Math.pow(10, +$('sb-scale').value);
    const fwd = g.cam.forward;
    const d = +$('sb-dist').value * p.rEff;
    const x = p.x + fwd.x * d, y = p.y + fwd.y * d, z = p.z + fwd.z * d;
    let vx = p.vx, vy = p.vy, vz = p.vz;
    if ($('sb-orbit').checked) {
      const up = g.cam.up;
      const tx = fwd.y * up.z - fwd.z * up.y, ty = fwd.z * up.x - fwd.x * up.z, tz = fwd.x * up.y - fwd.y * up.x;
      const tl = Math.hypot(tx, ty, tz) || 1;
      const v = Math.sqrt((G * (p.mass + m)) / d);
      vx += (tx / tl) * v; vy += (ty / tl) * v; vz += (tz / tl) * v;
    }
    const b = new Body({ role: 'field', name: `${t.name} ${w.rng.int(100, 999)}`, mass: m, comp: { rock: 0, iron: 0, ice: 0, carbon: 0, gas: 0, ...t.comp }, compact: t.compact || null, x, y, z, vx, vy, vz, seed: w.rng.int(1, 1e9), fadeIn: 0, temp: p.temp });
    if (t.compact === 'wd') { b.wdTemp = 20000; b.updateRadius(); }
    if (t.compact === 'bh') b.bhSpin = 0.5;
    if (t.compact === 'ns') b.nsSpin = 40;
    b.sandbox = true;
    w.addBody(b);
    w.rebuildAttractors();
    g.hud.log(`Spawned ${t.name.toLowerCase()} (${F.massShort(m)})`, 'info');
  }

  skip(years) {
    const g = this.game, w = g.world;
    w.skipYears(years);
    g.forceSky = true;
    g.processEvents();
    g.hud.log(`Skipped ahead ${F.years(years)}`, 'info');
    this.sync();
  }

  // jump somewhere far away (a fresh orbit, nothing else changes)
  go(where) {
    const g = this.game, w = g.world, gal = w.galaxy, p = w.player;
    let rec;
    if (where === 'home') rec = gal.home;
    else if (where === 'core') {
      const a = Math.random() * Math.PI * 2;
      rec = gal.addNewborn(1200 * Math.cos(a), 10, 1200 * Math.sin(a), w.rng, 1);
    } else {
      const [lx, ly, lz] = w.toLy(p.x, p.y, p.z);
      const nbs = gal.nebulaeNear(lx, ly, lz, 6000).filter((n) => n.massLeft > 0.2).sort((a, b) => a.d - b.d);
      if (!nbs.length) { g.hud.log('No nebula within 6,000 light-years', 'info'); return; }
      const nb = nbs[0];
      rec = gal.addNewborn(nb.x + nb.r * 0.3, nb.y, nb.z, w.rng, 0.8);
    }
    for (const b of w.bodies) if (b !== p && b.role !== 'player') b.alive = false;
    w.flushDead();
    w.active.clear();
    w.coreBody = null;
    w.O = WorldOrigin(rec);
    const sp = Galaxy.localOf(rec, w.O);
    w.placeAround(p, rec, sp, 3);
    w.refreshActiveSystems();
    w.rebuildAttractors();
    w.circularize(p);
    w.field.update(0, true);
    g.forceSky = true;
    g.snapCamera();
    g.hud.log(`Moved to ${gal.nameOf(rec)}${where === 'core' ? `, ${F.nice(Math.hypot(rec.x, rec.y, rec.z))} light-years from the centre` : ''}`, 'info');
    g.closeSheet();
  }

  event(kind) {
    const g = this.game, w = g.world, h = w.hazards;
    const was = w.sandboxHazards;
    w.sandboxHazards = true;
    if (kind === 'storm') h.spawnStorm(false);
    if (kind === 'comets') h.spawnStorm(true);
    if (kind === 'rogue') h.spawnRogue();
    if (kind === 'grb') w.emit('grb', { dist: 2500 + Math.random() * 3000 });
    if (kind === 'sn') {
      const p = w.player;
      const d = p.rEff * 400;
      const v = { x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 };
      const l = Math.hypot(v.x, v.y, v.z);
      const s = new Body({ role: 'field', name: 'Doomed supergiant', mass: 18 * M_SUN, comp: { gas: 0.97, rock: 0.03 }, x: p.x + (v.x / l) * d, y: p.y + (v.y / l) * d, z: p.z + (v.z / l) * d, vx: p.vx, vy: p.vy, vz: p.vz, fadeIn: 1 });
      w.addBody(s);
      w.blasts.push({ x: s.x, y: s.y, z: s.z, t0: w.time, speed: 9000, energy: 1e44, hit: new Set([s.id]), r: 0, sysName: s.name });
      w.emit('supernova', { self: false, x: s.x, y: s.y, z: s.z, name: s.name, toBH: false });
      s.compact = 'ns'; s.mass = 1.4 * M_SUN; s.updateRadius(); s.name = 'Supernova remnant';
    }
    w.sandboxHazards = was;
    g.closeSheet();
  }
}

function WorldOrigin(rec) {
  const GU = 1e10;
  const CELL = 23650 * GU;
  return { x: Math.round((rec.ci * CELL + rec.ox) / GU), y: Math.round((rec.cj * CELL + rec.oy) / GU), z: Math.round((rec.ck * CELL + rec.oz) / GU) };
}

export { LY, escapeVelocity };
