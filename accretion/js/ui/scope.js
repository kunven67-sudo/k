// The telescope: study worlds around nearby stars. Transits give light curves
// and spectra of their air; close systems can be imaged directly.
import * as F from '../core/format.js';
import { LY, M_EARTH, M_JUP, R_SUN, R_EARTH, AU, AU_REAL, DIST_COMPRESS, G, YEAR } from '../core/constants.js';
import { generateSystemDetail } from '../world/system.js';
import { phaseName } from '../world/stellar.js';
import { hash32 } from '../core/rng.js';
import { computeLook } from '../render/look.js';
import { drawSpectrum, drawLightCurve, drawBlurryWorld } from './charts.js';
import { esc } from './info.js';

const $ = (id) => document.getElementById(id);
const RANGE_LY = 60;

export class Scope {
  constructor(game) {
    this.game = game;
    this.sel = null;
    this.filter = 'all';
    const tabs = $('scope-tabs');
    for (const [id, name] of [['all', 'All'], ['life', 'Possible life'], ['marked', 'Marked']]) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = name;
      b.dataset.tab = id;
      b.addEventListener('click', () => { this.filter = id; this.renderList(); });
      tabs.appendChild(b);
    }
  }

  open() {
    this.game.book?.see('transit');
    this.scan();
    this.renderList();
    this.renderDetail();
  }

  // nearby systems with planets, nearest first
  scan() {
    const w = this.game.world, g = w.galaxy, p = w.player;
    const near = g.starsNear(p, w.O, RANGE_LY * LY, (dKm) => (dKm < 15 * LY ? 0.08 : 0.3), 2000);
    near.sort((a, b) => a.d - b.d);
    const systems = [];
    for (const s of near) {
      if (systems.length >= 36) break;
      const st = g.starNow(s.rec);
      if (!st) continue;
      const sys = w.systemInfo(s.rec);
      const det = generateSystemDetail(sys);
      const state = g.state.get(s.rec.id) || {};
      const eaten = new Set(state.eaten || []);
      const planets = det.planets.map((pl, i) => ({ ...pl, key: `p${i}` })).filter((pl) => !eaten.has(pl.key));
      if (!planets.length) continue;
      systems.push({ rec: s.rec, d: s.d, st, sys, det, planets, name: g.nameOf(s.rec), marked: !!state.marked });
    }
    this.systems = systems;
  }

  renderList() {
    for (const b of document.querySelectorAll('#scope-tabs .tab')) b.classList.toggle('on', b.dataset.tab === this.filter);
    const list = $('scope-list');
    list.innerHTML = '';
    const know = this.game.profile.scopeLife || {};
    let shown = 0;
    for (const s of this.systems) {
      if (this.filter === 'marked' && !s.marked) continue;
      const plist = s.planets.filter((pl) => this.filter !== 'life' || (pl.life && know[`${s.rec.id}/${pl.key}`]) || (pl.inHZ && !pl.giant));
      if (this.filter === 'life' && !plist.length) continue;
      const h = document.createElement('div');
      h.className = 'eyebrow';
      h.style.margin = '12px 0 4px 10px';
      h.innerHTML = `${esc(s.name)} · ${F.nice(s.d / LY)} ly · ${esc(phaseName(s.st))}${s.marked ? ' <span class="tag mark">Marked</span>' : ''}`;
      list.appendChild(h);
      for (const pl of plist) {
        const id = `${s.rec.id}/${pl.key}`;
        const b = document.createElement('button');
        b.className = `item${this.sel && this.sel.id === id ? ' on' : ''}`;
        const kind = pl.giant ? (pl.kind === 'hotjupiter' ? 'Hot Jupiter' : pl.kind === 'icegiant' ? 'Ice giant' : 'Gas giant') : pl.kind === 'icy' ? 'Icy world' : 'Rocky world';
        b.innerHTML = `${esc(pl.name)}<small>${kind} · ${F.massShort(pl.mass)}${pl.inHZ ? ' · habitable zone' : ''}${know[id] ? ' · signs of life' : ''}</small>`;
        b.addEventListener('click', () => { this.sel = { id, sys: s, pl }; this.renderList(); this.renderDetail(); });
        list.appendChild(b);
        shown++;
      }
    }
    if (!shown) list.innerHTML = `<p class="note" style="padding:10px">${this.filter === 'marked' ? 'No marked systems.' : `No planets found within ${RANGE_LY} light-years.`}</p>`;
  }

  // does this planet transit from where we are? (a fixed answer per planet)
  transits(pl, s) {
    return (hash32(s.rec.seed, pl.seed % 100000) % 1000) / 1000 < 0.35;
  }

  renderDetail() {
    const det = $('scope-detail');
    if (!this.sel) {
      det.innerHTML = `<p class="prose">Pick a world on the left. The telescope sees every planet within ${RANGE_LY} light-years.</p><p class="note">When a planet crosses its star (a transit), the star dims a little, and starlight passing through the planet’s air reveals what it’s made of.</p>`;
      return;
    }
    const { sys: s, pl } = this.sel;
    const star = s.sys.star;
    const transit = this.transits(pl, s);
    const close = s.d / LY < 25;
    const depth = Math.pow(pl.radius / star.radius, 2);
    const aReal = pl.a * DIST_COMPRESS;
    const per = (2 * Math.PI * Math.sqrt(Math.pow(aReal, 3) / (G * star.mass))) / YEAR;
    const hours = (per * 365.25 * 24 * star.radius) / (Math.PI * aReal);
    const look = computeLook({ mass: pl.mass, comp: pl.comp, temp: pl.temp, kind: pl.kind, seed: pl.seed, life: pl.life, rings: pl.rings, radius: pl.radius });
    const ab = this.abundances(pl);
    const canSpec = transit || close;
    const bio = canSpec && (ab.o2 > 0.2 && ab.ch4 > 0.1);
    const radio = pl.life === 2 && (close || transit);
    const know = this.game.profile.scopeLife = this.game.profile.scopeLife || {};
    if (bio && !know[this.sel.id]) {
      know[this.sel.id] = Date.now();
      this.game.saves.setProfile(this.game.profile);
      this.game.onEvent?.({ type: 'biosignature', name: pl.name });
    }
    const rows = [
      ['Star', `${esc(s.name)} · ${esc(phaseName(s.st))} · ${F.nice(star.mass / 1.989e30)} M☉`],
      ['Distance', F.distance(s.d)],
      ['Orbit', `${F.nice(aReal / AU_REAL)} AU · year of ${per < 2 ? `${F.nice(per * 365.25)} days` : F.years(per)}`],
      ['Mass', planetMass(pl.mass)],
      ['Radius', transit ? `${F.nice(pl.radius / R_EARTH)} Earths` : 'Unknown (no transit)'],
      ['Temperature', `about ${F.temperature(pl.temp)}`],
      ['Moons', pl.moons?.length ? `${pl.moons.length}` : 'None seen'],
    ];
    det.innerHTML = `<div class="cols">
      <div class="block"><h3>${esc(pl.name)}</h3><canvas class="chart" id="scope-img" style="height:200px"></canvas><p class="note">${close ? 'Direct image: a few pixels of light, with the star blocked out.' : 'Too far for a direct image. This is the best guess from its colour.'}</p></div>
      <div class="block"><h3>Measurements</h3><dl class="kv">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
        <div class="menu" style="margin-top:8px"><button class="btn small" id="scope-mark">${s.marked ? 'Unmark system' : 'Mark system'}</button></div>
        <p class="note">Marked systems show on your map and as arrows on your screen.</p></div>
      <div class="block"><h3>Transit light curve</h3>${transit ? '<canvas class="chart" id="scope-lc"></canvas>' : '<p class="note">Its orbit is tilted, so it never crosses its star from here.</p>'}</div>
      <div class="block"><h3>Spectrum of its air</h3>${canSpec ? '<canvas class="chart" id="scope-spec"></canvas>' : '<p class="note">No transit and too far for a direct image: no spectrum.</p>'}
        ${bio ? '<p class="note" style="color:var(--life)">Oxygen and methane together. Something on this world is alive.</p>' : canSpec && pl.inHZ && !pl.giant ? '<p class="note">No sign of life in this air.</p>' : ''}
        ${radio ? '<p class="note" style="color:var(--info)">Radio signals leak from this world. Someone is there.</p>' : ''}</div>
    </div>`;
    drawBlurryWorld($('scope-img'), look, pl.seed, { pixels: close ? 22 : 10, size: close ? 1.1 : 0.8, coronagraph: close });
    if (transit) drawLightCurve($('scope-lc'), depth, { hours, seed: pl.seed % 97 });
    if (canSpec) drawSpectrum($('scope-spec'), ab, { haze: pl.giant ? 0.15 : ab.haze || 0, seed: pl.seed % 89, noise: close ? 0.03 : 0.06, rayleigh: pl.giant ? 0.8 : 0.5 });
    $('scope-mark').addEventListener('click', () => {
      const st = this.game.galaxy.stateOf(s.rec.id);
      st.marked = !st.marked;
      s.marked = st.marked;
      this.renderList();
      this.renderDetail();
    });
  }

  // what its air is made of, from what kind of world it is
  abundances(pl) {
    const T = pl.temp;
    if (pl.giant) {
      if (T > 1000) return { na: 0.9, h2o: 0.6, co: 0.5, haze: 0.1 };
      if (pl.kind === 'icegiant') return { ch4: 1, h2o: 0.2, nh3: 0.1 };
      return { ch4: 0.7, h2o: 0.3, nh3: T < 200 ? 0.5 : 0.1, haze: 0.2 };
    }
    if (pl.mass < 0.1 * M_EARTH) return {};
    if (pl.life) return { h2o: 0.7, o2: 0.9, o3: 0.6, ch4: 0.35, co2: 0.15 };
    if (T > 380) return { co2: 1.2, h2o: 0.05, haze: 0.6 };
    if (pl.inHZ && pl.comp.ice > 0.02) return { h2o: 0.6, co2: 0.5 };
    if (T < 200 && pl.comp.ice > 0.2) return { ch4: 0.3, haze: 0.5 };
    return { co2: 0.4 };
  }
}

function planetMass(m) {
  return m > 0.1 * M_JUP ? `${F.nice(m / M_JUP)} Jupiters` : `${F.nice(m / M_EARTH)} Earths`;
}

export { R_SUN, AU };
