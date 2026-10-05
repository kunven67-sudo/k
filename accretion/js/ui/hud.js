// Heads-up display: telemetry in real units, target brackets, warnings, fact cards.
import * as F from '../core/format.js';
import { FORM, COMP_COLORS, COMP_KEYS, TIME_BASE, M_SUN, CORE_BURN_STAGES, NS_MAX_MASS, WD_MAX_MASS } from '../core/constants.js';
import { forecast, escapeVelocity, clamp, rocheLimit } from '../core/phys.js';
import { msLifetimeYears } from '../world/stellar.js';
import { LIFE_STAGES } from '../world/life.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      eyebrow: $('stage-eyebrow'),
      forecast: $('forecast'),
      lifeline: $('lifeline'),
      age: $('r-age'),
      play: $('r-play'),
      view: $('r-view'),
      stage: $('stage-name'),
      blurb: $('stage-blurb'),
      bar: $('stage-bar-fill'),
      next: $('stage-next'),
      mass: $('t-mass'),
      massF: $('t-mass-f'),
      radius: $('t-radius'),
      density: $('t-density'),
      gravity: $('t-gravity'),
      vesc: $('t-vesc'),
      temp: $('t-temp'),
      speed: $('t-speed'),
      where: $('t-where'),
      comp: $('comp-bar'),
      compLegend: $('comp-legend'),
      time: $('r-time'),
      jets: $('r-jets'),
      moons: $('r-moons'),
      target: $('r-target'),
      feed: $('feed'),
      warn: $('warn'),
      card: $('card'),
      cardStage: $('card-stage'),
      cardTitle: $('card-title'),
      cardFacts: $('card-facts'),
      core: $('core'),
      overlay: $('overlay'),
    };
    this.ctx = this.el.overlay.getContext('2d');
    this.feedItems = [];
    this.timer = 0;
    this.cardTimer = 0;
    this.aim = null;
    this.mode = 'full';
    this.readColors();
    this.resize();
  }

  readColors() {
    const cs = getComputedStyle(document.body);
    const get = (k, d) => (cs.getPropertyValue(k) || d).trim() || d;
    this.col = { food: get('--food', '#7fe0b0'), danger: get('--danger', '#ff5a4e'), amber: get('--amber', '#ffb24a'), life: get('--life', '#9be37a') };
  }

  // full, minimal or off
  setMode(mode) {
    this.mode = mode;
    this.el.hud.classList.toggle('minimal', mode === 'minimal');
    this.show(mode !== 'off');
  }

  resize() {
    const c = this.el.overlay;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    c.style.width = `${window.innerWidth}px`;
    c.style.height = `${window.innerHeight}px`;
    this.dpr = dpr;
  }

  show(on) {
    this.el.hud.hidden = !on;
    this.el.overlay.hidden = !on;
  }

  log(text, kind = '') {
    const li = document.createElement('li');
    li.textContent = text;
    if (kind) li.className = kind;
    this.el.feed.prepend(li);
    this.feedItems.push({ li, t: 0 });
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
  }

  showCard(formId, extraTitle) {
    const s = FORM[formId];
    if (!s) return;
    this.cardRaw(extraTitle || 'New stage', s.name, s.facts, false);
  }

  showLifeCard(stage) {
    const s = LIFE_STAGES[stage];
    if (!s || !s.fact) return;
    this.cardRaw('Life on your world', s.name, [s.fact], true);
  }

  cardRaw(eyebrow, title, facts, life) {
    this.el.card.classList.toggle('life', !!life);
    this.el.cardStage.textContent = eyebrow;
    this.el.cardTitle.textContent = title;
    this.el.cardFacts.innerHTML = '';
    for (const f of facts) {
      const li = document.createElement('li');
      li.textContent = f;
      this.el.cardFacts.appendChild(li);
    }
    this.el.card.hidden = false;
    this.el.card.classList.remove('out');
    this.cardTimer = 16;
  }

  hideCard() {
    this.el.card.classList.add('out');
    this.cardTimer = 0;
    setTimeout(() => { if (this.cardTimer <= 0) this.el.card.hidden = true; }, 600);
  }

  update(dt, world, game) {
    for (const f of this.feedItems) {
      f.t += dt;
      if (f.t > 7) f.li.classList.add('old');
    }
    this.feedItems = this.feedItems.filter((f) => f.t < 9 && f.li.isConnected);
    if (this.cardTimer > 0) {
      this.cardTimer -= dt;
      if (this.cardTimer <= 0) this.hideCard();
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.12;
    const p = world.player;
    if (!p) return;
    const e = this.el;
    const formId = p.form;
    const st = FORM[formId] || { name: p.typeLabel, blurb: '' };
    e.stage.textContent = st.name;
    e.eyebrow.textContent = p.name ? p.name : 'You are';
    const life = world.life;
    e.blurb.textContent = life && life.stage >= 7 ? 'Home to a civilisation' : life && life.stage > 0 ? `Home to ${life.name.toLowerCase()}` : st.blurb;
    this.progress(world, game, p, formId);
    e.mass.textContent = F.massKg(p.mass);
    e.massF.textContent = F.massFriendly(p.mass);
    if (p.compact === 'bh') e.radius.textContent = `${F.radius(p.radius)} event horizon`;
    else e.radius.textContent = F.radius(p.radius);
    const rhoGcc = p.mass / ((4 / 3) * Math.PI * Math.pow(p.radius, 3)) / 1e12;
    e.density.textContent = p.compact === 'bh' ? '—' : `${F.nice(rhoGcc)} g/cm³`;
    const g = (6.674e-20 * p.mass) / (p.radius * p.radius) * 1000;
    e.gravity.textContent = p.compact === 'bh' ? '∞' : `${F.nice(g / 9.81)} g`;
    e.vesc.textContent = p.compact === 'bh' ? 'faster than light' : F.speed(escapeVelocity(p.mass, p.radius));
    const surfT = p.isStar || p.starTemp ? p.starTemp : Math.max(p.temp, 40 + p.heat * 1500);
    e.temp.textContent = p.compact === 'bh' ? '—' : F.temperature(p.compact === 'ns' ? 1e6 : surfT);
    const fr = game.frame;
    const v = Math.hypot(p.vx - fr.vx, p.vy - fr.vy, p.vz - fr.vz);
    e.speed.textContent = `${F.speed(v)} · ${(v * TIME_BASE / p.rEff).toFixed(1)} radii/s`;
    const peb = world.pebbleRate > 0 ? ` \u00b7 pebbles +${F.percent(world.pebbleRate, 2)}/s` : '';
    e.where.textContent = world.field.env.label + peb;
    // composition
    const c = p.comp;
    const parts = COMP_KEYS.map((k) => [k, c[k] || 0]).filter(([k, f]) => f > 0.0005 || k !== 'carbon');
    e.comp.innerHTML = parts.map(([k, f]) => `<span style="width:${(f * 100).toFixed(2)}%;background:${COMP_COLORS[k]}"></span>`).join('');
    e.compLegend.innerHTML = parts.map(([k, f]) => `<span><i style="background:${COMP_COLORS[k]}"></i>${k} ${(f * 100).toFixed(f < 0.1 ? 1 : 0)}%</span>`).join('');
    // right side
    const age = world.years - (p.born || 0);
    e.age.textContent = `Age ${F.yearsShort(Math.max(age, 0))} · universe ${F.yearsShort(13.8e9 + world.years)}`;
    if (world.deep) {
      e.time.textContent = `Deep time · 1 s = ${F.years(world.deepRate())}`;
    } else {
      const rate = TIME_BASE * world.warp;
      e.time.textContent = world.warp > 1 ? `Warp ×${world.warp} · 1 s = ${F.duration(rate)}` : `1 s = ${F.duration(rate)}`;
    }
    e.time.classList.toggle('hot', world.warp > 1 && !world.deep);
    e.time.classList.toggle('deep', !!world.deep);
    e.play.textContent = `Played ${F.clock(world.stats.timePlayed)}`;
    e.view.textContent = game.viewLabel ? game.viewLabel() : '';
    this.lifeLine(world, p);
    const jet = world.thrustLoss;
    const jetName = p.compact ? 'Relativistic jets' : p.isStar ? 'Plasma jets' : p.comp.gas > 0.4 ? 'Gas vents' : 'Volcanic jets';
    e.jets.textContent = jet > 0 ? `${jetName}: losing ${F.percent(jet, 2)} mass/s` : `${jetName}: idle`;
    e.moons.textContent = world.moonCount ? `${world.moonCount} captured moon${world.moonCount > 1 ? 's' : ''}` : 'No moons';
    const tg = game.target;
    if (tg && tg.alive) {
      const d = p.distTo(tg) - p.rEff - tg.rEff;
      e.target.textContent = `Locked: ${tg.name || tg.typeLabel} · ${F.distance(Math.max(d, 0))}`;
    } else e.target.textContent = 'T: lock target';

    // warnings
    const warns = [];
    if (world.tidalStress > 0) warns.push(`Tidal stress ${F.percent(world.tidalStress / 0.7)} — ${world.tidalSource?.name || 'something big'} is tearing you apart`);
    if (world.heatLoss > 0.003) warns.push(`${world.heatLoss > 0.02 ? 'Boiling away' : 'Evaporating'}: losing ${F.percent(world.heatLoss, 1)}/s to starlight`);
    if (game.stormWarn > 0) warns.push(game.stormText);
    if (game.snWarn > 0) warns.push(game.snText);
    if (world.hazards?.pending && world.hazards.pending.reason) warns.push(world.hazards.pending.reason);
    e.warn.innerHTML = warns.map((w) => `<div>${w}</div>`).join('');
    e.warn.hidden = !warns.length;

    if (world.core) {
      const cs = world.core;
      const s = CORE_BURN_STAGES[cs.stage];
      let left = s.dur - cs.t;
      for (let i = cs.stage + 1; i < CORE_BURN_STAGES.length; i++) left += CORE_BURN_STAGES[i].dur;
      e.core.hidden = false;
      e.core.innerHTML = `<b>Core: ${s.el} burning</b><span>Collapse in ${left.toFixed(0)} s · ${p.mass >= 22 * M_SUN ? 'heavy enough for a black hole' : `reach 22 M☉ for a black hole (now ${F.nice(p.mass / M_SUN)})`}</span>`;
    } else e.core.hidden = true;
  }

  // the bar under your name and the forecast of what you'll become
  progress(world, game, p, formId) {
    const e = this.el;
    let t = 0, next = '', fc = '';
    if (p.isStar && !p.compact) {
      const ms = p.mass / M_SUN;
      if (!p.phase) {
        t = clamp(p.fuel || 0, 0, 1);
        const left = Math.max(0, (1 - (p.fuel || 0)) * msLifetimeYears(ms));
        next = `Core hydrogen ${F.percent(t, 0)} burned`;
        fc = `Hydrogen runs out in <b>${F.years(left)}</b> \u2192 ${ms >= 8 ? 'red supergiant' : 'red giant'}`;
      } else {
        t = clamp(p.giantT || 0, 0, 1);
        next = p.phase === 'rg' ? 'Swelling, shedding your outer layers' : 'Burning heavier elements';
        fc = p.phase === 'rg' ? '\u2192 <b>white dwarf</b> and a planetary nebula' : `\u2192 <b>supernova</b>, leaving a ${p.mass >= 22 * M_SUN ? 'black hole' : 'neutron star'}`;
      }
    } else if (p.compact === 'wd') {
      t = clamp(p.mass / WD_MAX_MASS, 0, 1);
      next = `${F.nice(p.mass / M_SUN)} of 1.38 M\u2609 (Chandrasekhar limit)`;
      fc = 'Past the limit \u2192 <b>Type Ia supernova</b>, nothing left';
    } else if (p.compact === 'ns') {
      t = clamp(p.mass / NS_MAX_MASS, 0, 1);
      next = `${F.nice(p.mass / M_SUN)} of 2.3 M\u2609 \u00b7 spinning ${F.nice(p.nsSpin || 1)} times a second`;
      fc = 'Past 2.3 M\u2609 \u2192 <b>black hole</b>';
    } else {
      const f = forecast(p.mass, p.comp, p.diet, p.compact, { phase: p.phase, temp: p.temp });
      const m0 = game.formStart && game.formStart.form === formId ? game.formStart.mass : p.mass * 0.5;
      if (f && f.mass > m0) {
        t = clamp(Math.log(p.mass / m0) / Math.log(f.mass / m0), 0, 1);
        next = `${FORM[f.form]?.name || f.form} at ${F.massShort(f.mass)}`;
      } else if (f) {
        t = 1;
        next = FORM[f.form]?.name || f.form;
      } else {
        t = 1;
        next = world.core ? 'Core collapse ahead' : 'Keep growing';
      }
      fc = this.dietText(p, f);
    }
    e.bar.style.width = `${(t * 100).toFixed(1)}%`;
    e.next.textContent = next;
    e.forecast.innerHTML = fc;
  }

  dietText(p, f) {
    const d = p.diet || p.comp;
    const ranked = COMP_KEYS.map((k) => [k, d[k] || 0]).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0.12).slice(0, 2);
    const words = { rock: 'rock', iron: 'iron', ice: 'ice', carbon: 'carbon', gas: 'gas' };
    const eat = ranked.map(([k]) => words[k]).join(' & ') || 'a bit of everything';
    if (!f) return `Eating mostly ${eat}`;
    return `Eating mostly ${eat} \u2192 <b>${FORM[f.form]?.name || f.form}</b>`;
  }

  lifeLine(world, p) {
    const e = this.el;
    const pm = world.planet, life = world.life;
    if (!pm || pm.giant) {
      if (life && life.ended && life.ended.years > 0) {
        e.lifeline.hidden = false;
        e.lifeline.textContent = `Life once reached: ${life.ended.peak}`;
      } else e.lifeline.hidden = true;
      return;
    }
    const parts = [];
    if (life && life.stage > 0) parts.push(`Life: ${life.name}`);
    else if (pm.habitable) parts.push('Habitable');
    if (pm.esi > 0.05) parts.push(`ESI ${pm.esi.toFixed(2)}`);
    if (pm.P > 0.001) parts.push(`air ${F.nice(pm.P)} bar`);
    if (life && life.sats > 10) parts.push(`${Math.round(life.sats).toLocaleString('en-US')} satellites`);
    e.lifeline.hidden = !parts.length;
    e.lifeline.textContent = parts.join(' \u00b7 ');
  }

  // brackets on targets, edge arrows for threats
  draw(world, game, project) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = this.el.overlay.width, H = this.el.overlay.height;
    ctx.clearRect(0, 0, W, H);
    const p = world.player;
    if (!p || !p.alive) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.lineWidth = 1.25;
    ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';

    const items = game.markers || [];
    for (const m of items) {
      const b = m.body;
      if (!b.alive) continue;
      const s = project(b.x, b.y, b.z);
      if (!s) continue;
      const big = b.mass > p.mass || (b.compact && !p.compact);
      const col = big ? this.col.danger : this.col.food;
      const r = Math.max(8, Math.min((m.r || 0) + 6, 160));
      if (s.on) {
        if (m.kind === 'aim' || m.kind === 'lock') {
          drawBracket(ctx, s.x, s.y, r, m.kind === 'lock' ? this.col.amber : col, m.kind === 'lock' ? 9 : 7);
          const ratio = b.mass / p.mass;
          const d = p.distTo(b) - p.rEff - b.rEff;
          const vrel = Math.hypot(b.vx - p.vx, b.vy - p.vy, b.vz - p.vz);
          const vesc = escapeVelocity(p.mass + b.mass, p.rEff + b.rEff);
          const verdict = big ? (b.compact ? 'DANGER · will swallow you' : 'DANGER · bigger than you') : ratio < 2.5e-4 ? 'Crumbs' : 'Edible';
          const lines = [
            `${b.name || b.typeLabel}`,
            `${b.typeLabel} · ${F.sci(b.mass, 2)} kg`,
            `${ratio >= 1 ? F.nice(ratio) + '× your mass' : F.percent(ratio, ratio < 0.01 ? 2 : 0) + ' of your mass'}`,
            `${F.distance(Math.max(d, 0))} · closing ${F.speed(vrel)}${!big ? (vrel > vesc * 2 ? ' — too fast, will hurt' : ' — safe') : ''}`,
          ];
          if (b.colony) lines.push('Your colony');
          else if (b.life) lines.push(b.life === 2 ? 'Signs of a civilisation' : 'Signs of life');
          let tx = s.x + r + 10, ty = s.y - r;
          if (tx > w - 260) tx = s.x - r - 250;
          ctx.fillStyle = col;
          ctx.fillText(verdict.toUpperCase(), tx, ty);
          ctx.fillStyle = 'rgba(233,237,243,0.92)';
          lines.forEach((l, i) => ctx.fillText(l, tx, ty + 15 + i * 14));
          // show the Roche zone of something big
          if (big && !p.compact) {
            const dR = rocheLimit(b.mass, p.mass, p.radius);
            const rr = (m.r || 0) * (dR / (m.vr || b.rEff));
            if (rr > (m.r || 0) + 4 && rr < 4000) {
              ctx.setLineDash([3, 5]);
              ctx.strokeStyle = 'rgba(255,90,78,0.45)';
              ctx.beginPath();
              ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        } else {
          // small corner ticks on notable bodies
          ctx.strokeStyle = big ? 'rgba(255,90,78,0.7)' : 'rgba(127,224,176,0.55)';
          tick(ctx, s.x, s.y, Math.max(5, Math.min(r, 40)));
        }
      } else if (m.kind !== 'tick' || big) {
        // off-screen arrow
        edgeArrow(ctx, s, w, h, m.kind === 'lock' ? this.col.amber : big ? this.col.danger : this.col.food, m.label);
      }
    }
    // the reticle
    ctx.strokeStyle = 'rgba(233,237,243,0.5)';
    const cx = w / 2, cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBracket(ctx, x, y, r, col, len) {
  ctx.strokeStyle = col;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = x + sx * r, py = y + sy * r;
    ctx.moveTo(px - sx * len, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py - sy * len);
  }
  ctx.stroke();
}

function tick(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r + 4); ctx.lineTo(x - r, y - r); ctx.lineTo(x - r + 4, y - r);
  ctx.moveTo(x + r, y + r - 4); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - 4, y + r);
  ctx.stroke();
}

function edgeArrow(ctx, s, w, h, col, label) {
  const cx = w / 2, cy = h / 2;
  let dx = s.dx, dy = s.dy;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l; dy /= l;
  const m = 34;
  const tx = (dx > 0 ? (w - m - cx) : (m - cx)) / (dx || 1e-6);
  const ty = (dy > 0 ? (h - m - cy) : (m - cy)) / (dy || 1e-6);
  const t = Math.min(Math.abs(tx), Math.abs(ty));
  const x = cx + dx * t, y = cy + dy * t;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + dx * 10, y + dy * 10);
  ctx.lineTo(x - dy * 6 - dx * 4, y + dx * 6 - dy * 4);
  ctx.lineTo(x + dy * 6 - dx * 4, y - dx * 6 - dy * 4);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.fillStyle = col;
    ctx.textAlign = dx > 0.3 ? 'right' : dx < -0.3 ? 'left' : 'center';
    ctx.fillText(label, x - dx * 16, y - dy * 16 + (dy > 0 ? -14 : 4));
    ctx.textAlign = 'left';
  }
}
