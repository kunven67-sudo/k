// The info screen: everything about your world, live.
import * as F from '../core/format.js';
import { FORM, M_EARTH, M_SUN, R_EARTH, G, DIST_COMPRESS, AU_REAL, YEAR, COMP_COLORS, COMP_KEYS } from '../core/constants.js';
import { escapeVelocity, clamp } from '../core/phys.js';
import { probe } from '../world/planet.js';
import { LIFE_STAGES, LIFE } from '../world/life.js';
import { msLifetimeYears } from '../world/stellar.js';
import { drawLifeTimeline, drawCrossSection, drawSpectrum } from './charts.js';

const $ = (id) => document.getElementById(id);
const TABS = [['overview', 'Overview'], ['inside', 'Inside'], ['air', 'Air & climate'], ['life', 'Life'], ['moons', 'Moons'], ['history', 'History']];

export class InfoSheet {
  constructor(game) {
    this.game = game;
    this.tab = 'overview';
    this.el = $('sheet-info');
    this.body = $('info-body');
    this.probeF = 0.5;
    this.timer = 0;
    const tabs = $('info-tabs');
    for (const [id, name] of TABS) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = name;
      b.dataset.tab = id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      tabs.appendChild(b);
    }
  }

  open() {
    this.render();
  }

  update(dt) {
    this.timer -= dt;
    this.anim = (this.anim || 0) + dt;
    if (this.tab === 'inside' && this.cross) drawCrossSection(this.cross, this.struct, this.probeF, this.anim);
    if (this.timer > 0) return;
    this.timer = 1;
    if (this.tab !== 'moons' && this.tab !== 'inside') this.render(true);
  }

  render(soft = false) {
    const g = this.game, w = g.world, p = w.player;
    for (const b of document.querySelectorAll('#info-tabs .tab')) b.classList.toggle('on', b.dataset.tab === this.tab);
    $('info-title').textContent = p.name || 'Your world';
    $('info-eyebrow').textContent = `${FORM[p.form]?.name || p.typeLabel} · age ${F.years(Math.max(0, w.years - (p.born || 0)))}`;
    const scroll = this.body.scrollTop;
    const fn = this[`tab_${this.tab}`];
    this.cross = null;
    this.body.innerHTML = fn ? fn.call(this, g, w, p) : '';
    this.after?.();
    this.after = null;
    if (soft) this.body.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- tabs

  tab_overview(g, w, p) {
    const pm = w.planet;
    const host = w.hostSystem();
    const star = host?.star;
    const R = p.radius;
    const rho = p.mass / ((4 / 3) * Math.PI * R * R * R) / 1e12;
    const gs = (G * p.mass) / (R * R) * 1000;
    const rows = [
      ['Mass', `${F.massFriendly(p.mass)} (${F.sci(p.mass, 2)} kg)`],
      ['Radius', p.compact === 'bh' ? `${F.radius(R)} (event horizon)` : F.radius(R)],
    ];
    if (p.compact !== 'bh') {
      rows.push(['Density', `${F.nice(rho)} g/cm³`], ['Surface gravity', `${F.nice(gs / 9.81)} × Earth`], ['Escape speed', F.speed(escapeVelocity(p.mass, R))]);
    }
    if (p.isStar) {
      rows.push(['Brightness', `${F.nice(p.lum)} × the Sun`], ['Surface', F.temperature(p.starTemp)]);
      if (!p.phase && !p.compact) rows.push(['Hydrogen left', `${F.percent(1 - (p.fuel || 0))} · about ${F.years((1 - (p.fuel || 0)) * msLifetimeYears(p.mass / M_SUN))}`]);
    } else if (!p.compact) {
      rows.push(['Surface', `${F.temperature(pm.giant ? p.temp : pm.Ts)} (${F.nice((pm.giant ? p.temp : pm.Ts) - 273.15)} °C)`]);
    }
    if (p.compact === 'ns') rows.push(['Spin', `${F.nice(p.nsSpin || 1)} turns a second${(p.nsSpin || 0) > 100 ? ' (millisecond pulsar)' : ''}`], ['Magnetar', p.magnetar ? 'Yes' : 'No']);
    if (p.compact === 'bh') rows.push(['Spin', `${F.nice(p.bhSpin || 0)} of the maximum`], ['Hawking lifetime', F.years(2.1e67 * Math.pow(p.mass / M_SUN, 3))]);
    const orbit = [];
    if (star && star.alive && star !== p) {
      const d = p.distTo(star);
      const dReal = d * DIST_COMPRESS;
      const yr = (2 * Math.PI * Math.sqrt(Math.pow(dReal, 3) / (G * (star.mass + p.mass)))) / YEAR;
      orbit.push(['Star', `${star.name} (${star.typeLabel.toLowerCase()})`], ['Distance', `${F.nice(dReal / AU_REAL)} AU`], ['Year', yr < 2 ? `${F.nice(yr * 365.25)} days` : F.years(yr)]);
      if (!pm.giant) {
        orbit.push(['Day', pm.locked ? 'Tidally locked (one face to the star)' : `${F.nice(pm.day)} hours`]);
        orbit.push(['Axis tilt', `${F.nice((p.tilt * 180) / Math.PI)}°${p.tilt > 0.17 && p.tilt < 2.9 ? ' · has seasons' : ' · hardly any seasons'}`]);
      }
    } else orbit.push(['Star', 'None: you drift between the stars']);
    orbit.push(['Where', w.field.env.label]);
    const comp = COMP_KEYS.map((k) => [k, p.comp[k] || 0]);
    const diet = COMP_KEYS.map((k) => [k, (p.diet || p.comp)[k] || 0]);
    const bar = (parts) => `<div style="display:flex;height:8px;background:var(--faint)">${parts.map(([k, f]) => `<span style="width:${(f * 100).toFixed(2)}%;background:${COMP_COLORS[k]}"></span>`).join('')}</div>
      <div class="note">${parts.filter(([, f]) => f > 0.004).map(([k, f]) => `${k} ${F.percent(f, f < 0.1 ? 1 : 0)}`).join(' · ')}</div>`;
    const esi = !pm.giant ? `<div class="block"><h3>Earth Similarity Index</h3><div class="meter"><i style="width:${(pm.esi * 100).toFixed(1)}%"></i></div><p class="note">${pm.esi.toFixed(2)} of 1.00. Earth is 1.00, Mars 0.70, Venus 0.44. It compares your size, density, escape speed and temperature with Earth’s.${pm.habitable ? ' Liquid water can last on your surface.' : ''}</p></div>` : '';
    const field = !p.compact && !p.isStar ? `<dt>Magnetic field</dt><dd>${pm.field > 0.05 ? `${F.nice(pm.field / 1.26)} × Earth’s` : 'None'}</dd>` : '';
    return `<div class="cols">
      <div class="block"><h3>Body</h3><dl class="kv">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}${field}</dl></div>
      <div class="block"><h3>Orbit</h3><dl class="kv">${orbit.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></div>
      <div class="block"><h3>What you're made of</h3>${bar(comp)}<h3 style="margin-top:10px">What you've been eating</h3>${bar(diet)}<p class="note">${esc(g.hud.dietText(p, null))}</p></div>
      ${esi}
    </div>`;
  }

  tab_inside(g, w, p) {
    const pm = w.planet;
    const s = pm.structure();
    this.struct = s;
    const pr = probe(p, pm, this.probeF);
    const lay = s.layers.slice().reverse().map((L) => `<div><i style="background:rgb(${L.color.map((c) => Math.round(c * 255)).join(',')})"></i><span>${esc(L.name)}${L.note ? `<br><small class="note">${esc(L.note)}</small>` : ''}</span><span class="note">${F.radius(L.r1 * p.radius)}</span></div>`).join('');
    this.after = () => {
      this.cross = $('info-cross');
      const sl = $('info-probe');
      sl.addEventListener('input', () => {
        this.probeF = 1 - +sl.value;
        const q = probe(p, pm, this.probeF);
        $('info-probe-out').innerHTML = probeRows(q, p);
      });
      drawCrossSection(this.cross, s, this.probeF, this.anim || 0);
    };
    return `<div class="cols">
      <div class="block"><h3>Cross-section</h3><canvas class="chart" id="info-cross" style="height:300px"></canvas>
        <h3 style="margin-top:8px">Depth probe</h3><input type="range" id="info-probe" min="0" max="1" step="0.001" value="${(1 - this.probeF).toFixed(3)}" style="width:100%;accent-color:var(--info)" aria-label="Probe depth">
        <dl class="kv" id="info-probe-out">${probeRows(pr, p)}</dl></div>
      <div class="block"><h3>Layers, outside in</h3><div class="layer-legend">${lay}</div>
        <p class="note">Centre: about ${F.temperature(s.center.T)}, ${isFinite(s.center.P) ? `${F.sci(s.center.P, 1)} bar` : 'infinite density'}. Press K to see your inside in 3D.</p></div>
    </div>`;
  }

  tab_air(g, w, p) {
    const pm = w.planet;
    if (pm.giant) {
      const gasLine = p.isStar ? 'You are a ball of hot plasma: hydrogen and helium, with no surface at all.' : p.compact ? 'Nothing here could be called air.' : 'Your air goes all the way down: hydrogen and helium getting hotter and denser until it turns into a liquid metal.';
      return `<div class="cols"><div class="block"><h3>Atmosphere</h3><p class="prose">${gasLine}</p></div></div>`;
    }
    const a = pm.atm;
    const gases = [['n2', 'Nitrogen'], ['o2', 'Oxygen'], ['co2', 'Carbon dioxide'], ['h2o', 'Water vapour'], ['ch4', 'Methane'], ['h2', 'Hydrogen']];
    const P = Math.max(pm.P, 1e-12);
    const rows = gases.map(([k, n]) => {
      const v = Math.min(a[k] || 0, k === 'h2' ? 1e5 : 1e9);
      const f = v / P;
      return `<dt>${n}</dt><dd>${v > 0.0001 ? `${F.nice(v)} bar` : v > 0 ? `${F.sci(v, 1)} bar` : '—'}${f > 0.001 ? ` · ${F.percent(f, f < 0.1 ? 1 : 0)}` : ''}</dd>`;
    }).join('');
    const Teq = p.temp;
    const gh = pm.Ts - Teq;
    const ocean = { liquid: 'Liquid oceans', frozen: 'Frozen solid', steam: 'Boiled into the air', none: 'No water' }[pm.oceanState];
    const climate = pm.iceCover > 0.9 ? 'Snowball: ice from pole to pole' : pm.oceanState === 'steam' ? 'Runaway greenhouse' : pm.iceCover > 0.4 ? 'Ice age' : pm.Ts > 320 ? 'Hothouse' : pm.oceanState === 'liquid' ? 'Temperate' : pm.P < 0.01 ? 'Airless' : 'Frozen desert';
    this.after = () => {
      const ab = { h2o: Math.min(1, Math.sqrt(a.h2o / 0.01) * 0.6), co2: Math.min(1.2, Math.log10(1 + a.co2 * 3000) / 3), ch4: Math.min(1, Math.log10(1 + a.ch4 * 1e6) / 4), o2: Math.min(1, a.o2 / 0.21), o3: Math.min(1, a.o2 / 0.1) * 0.8 };
      drawSpectrum($('info-spec'), ab, { haze: pm.oceanState === 'steam' ? 0.7 : 0, seed: p.seed % 97 });
    };
    const bio = w.life?.biosignature() ? '<p class="note" style="color:var(--life)">Oxygen and methane together: a sign of life that a distant astronomer could spot.</p>' : '';
    return `<div class="cols">
      <div class="block"><h3>Air</h3><dl class="kv"><dt>Surface pressure</dt><dd>${F.nice(pm.P)} bar${pm.P > 0.001 ? ` · ${F.nice(pm.P)} × Earth` : ''}</dd>${rows}</dl></div>
      <div class="block"><h3>Climate</h3><dl class="kv"><dt>State</dt><dd>${climate}</dd><dt>Surface</dt><dd>${F.temperature(pm.Ts)} (${F.nice(pm.Ts - 273.15)} °C)</dd><dt>Without air it'd be</dt><dd>${F.temperature(Teq)}</dd><dt>Greenhouse warming</dt><dd>${gh > 0 ? '+' : ''}${F.nice(gh)} K</dd><dt>Water</dt><dd>${ocean}</dd><dt>Ice cover</dt><dd>${F.percent(pm.iceCover)}</dd><dt>Volcanoes</dt><dd>${pm.volcanism > 0.8 ? 'Very active' : pm.volcanism > 0.35 ? 'Active' : pm.volcanism > 0.12 ? 'Quiet' : 'Dead'}</dd><dt>Plate tectonics</dt><dd>${pm.tectonics ? 'Yes: continents drift' : 'No'}</dd></dl>
        <p class="note">Volcanoes add gas; rain and rock pull carbon dioxide back out. Without a magnetic field, the star’s wind slowly strips the air away, like on Mars.</p></div>
      <div class="block"><h3>Your spectrum, as a distant telescope would see it</h3><canvas class="chart" id="info-spec"></canvas>${bio}</div>
    </div>`;
  }

  tab_life(g, w, p) {
    const life = w.life;
    const pm = w.planet;
    const age = Math.max(1, w.years - (p.born || 0));
    this.after = () => drawLifeTimeline($('info-tl'), life, age);
    let now;
    if (life.stage > 0) now = `<p class="prose"><b>${esc(life.name)}</b>. ${esc(LIFE_STAGES[life.stage].fact || '')}</p>`;
    else if (life.ended) now = `<p class="prose">Life once reached <b>${esc(life.ended.peak)}</b> here. It ended ${F.years(age - life.ended.years)} ago: ${esc(life.ended.why)}.</p>`;
    else if (pm.giant) now = '<p class="prose">Nothing can live on you now. Your icy moons might still hide oceans warmed by your tides.</p>';
    else if (pm.habitable) now = '<p class="prose">Your oceans could support life. On Earth it took a few hundred million years to appear. Deep time (keep pressing . past ×10,000) lets you wait.</p>';
    else now = `<p class="prose">Life needs liquid water, some air and a mild temperature. ${pm.oceanState === 'none' ? 'You have no water: eat icy bodies.' : pm.oceanState === 'frozen' ? 'Your water is frozen: you need more warmth or more greenhouse gas.' : pm.oceanState === 'steam' ? 'You are too hot: your water is steam.' : pm.P < 0.01 ? 'Your air is too thin: you need more gravity or more volcanoes.' : ''}</p>`;
    const next = life.stage > 0 && life.stage < LIFE_STAGES.length - 1 ? LIFE_STAGES[life.stage + 1] : null;
    const civ = life.stage >= LIFE.cities ? `<div class="block"><h3>Civilisation</h3><dl class="kv">
      <dt>Satellites</dt><dd>${Math.round(life.sats).toLocaleString('en-US')}</dd><dt>Space stations</dt><dd>${life.stations}</dd>
      <dt>Colonies</dt><dd>${life.colonies.length ? life.colonies.map((c) => esc(c.name)).join(', ') : 'None yet'}</dd>
      <dt>Probes have reached</dt><dd>${life.probeStart != null ? `${F.nice(life.probeReachLy())} light-years` : 'Not launched'}</dd>
      <dt>Dyson swarm</dt><dd>${life.dyson > 0 ? `${F.percent(life.dyson)} of the star wrapped` : 'Not started'}</dd>
      <dt>Asteroids deflected</dt><dd>${life.deflected}</dd></dl>
      <p class="note">They defend you from impacts big enough to end them. Lock a target with T to let it through.</p></div>` : '';
    const moonsLife = w.bodies.filter((b) => b.alive && b.moonOf === p && b.life);
    return `<div class="cols">
      <div class="block" style="grid-column:1/-1"><h3>Life over time</h3><canvas class="chart" id="info-tl" style="height:220px"></canvas><p class="note">Red lines are mass extinctions.</p></div>
      <div class="block"><h3>Now</h3>${now}<dl class="kv"><dt>Biomass</dt><dd>${F.percent(life.biomass)}</dd><dt>Oxygen in the air</dt><dd>${F.nice(pm.atm.o2)} bar</dd>${next ? `<dt>Next step</dt><dd>${esc(next.name)}</dd>` : ''}<dt>Mass extinctions</dt><dd>${life.extinctions.length}</dd></dl>
        ${moonsLife.length ? `<p class="note" style="color:var(--life)">Life on your moons: ${moonsLife.map((b) => esc(b.name)).join(', ')}</p>` : ''}</div>
      ${civ}
      <div class="block"><h3>Extinctions</h3><ul class="hist">${life.extinctions.slice().reverse().slice(0, 12).map((x) => `<li class="extinct"><b>${F.yearsShort(x.years)}</b><span>${Math.round(x.k * 100)}% · ${esc(x.cause)}</span></li>`).join('') || '<li><b></b><span class="note">None yet</span></li>'}</ul></div>
    </div>`;
  }

  tab_moons(g, w, p) {
    const moons = w.bodies.filter((b) => b.alive && b.moonOf === p);
    const pm = w.planet;
    this.after = () => {
      for (const inp of this.body.querySelectorAll('input[data-moon]')) {
        inp.addEventListener('change', () => {
          const b = moons.find((m) => String(m.id) === inp.dataset.moon);
          const v = inp.value.trim().slice(0, 28);
          if (b && v) { b.name = v; b.moonName = v; g.hud.log(`Moon renamed to ${v}`, 'info'); }
        });
        inp.addEventListener('keydown', (e) => e.stopPropagation());
      }
    };
    const rows = moons.map((b) => {
      const d = p.distTo(b);
      const per = 2 * Math.PI * Math.sqrt(Math.pow(d * DIST_COMPRESS, 3) / (G * p.mass)) / 86400;
      return `<div class="slot"><div><input class="field" data-moon="${b.id}" value="${esc(b.name)}" maxlength="28" aria-label="Moon name"><div class="meta">${F.massShort(b.mass)} · ${F.distance(d)} away (${F.nice(d / p.radius)} of your radii) · orbit ${F.nice(per)} days${b.colony ? ' · colony' : b.life ? ' · life' : ''}${b.bornMoon ? ' · born from a giant impact' : ''}</div></div></div>`;
    }).join('');
    const ring = pm.ring ? `<p class="note">You have a ring of ${F.massShort(pm.ring.mass)} of debris from shredded moons. It is slowly raining down onto you.</p>` : '';
    return `<div class="cols"><div class="block"><h3>Your moons</h3>${rows || '<p class="note">No moons. Capture passing bodies inside your Hill sphere, or survive a giant impact: the debris can clump into a moon.</p>'}${ring}</div>
      <div class="block"><h3>About moons</h3><p class="prose">Moons raise tides on you, steady your tilt and can heat each other from the inside. If one comes inside your Roche limit, your gravity tears it into a ring.</p></div></div>`;
  }

  tab_history(g, w) {
    const h = w.planet.history.slice().reverse();
    return `<div class="block"><h3>What has happened to you</h3><ul class="hist">${h.map((x) => `<li class="${x.kind}"><b>${F.yearsShort(Math.max(0, x.years))}</b><span>${esc(x.text)}</span></li>`).join('') || '<li><b></b><span class="note">Nothing yet. Give it time.</span></li>'}</ul></div>`;
  }
}

function probeRows(q, p) {
  return `<dt>Depth</dt><dd>${F.distance(q.depthKm)}</dd><dt>Layer</dt><dd>${esc(q.layer.name)}</dd><dt>Temperature</dt><dd>${F.temperature(q.T)}</dd><dt>Pressure</dt><dd>${q.P > 1e4 ? `${F.sci(q.P, 1)} bar` : `${F.nice(q.P)} bar`}</dd>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export { esc, clamp, M_EARTH, R_EARTH };
