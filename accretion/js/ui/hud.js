// Heads-up display: telemetry in real units, target brackets, warnings, fact cards.
import * as F from '../core/format.js';
import { STAGES, COMP_COLORS, TIME_BASE, M_SUN, CORE_BURN_STAGES } from '../core/constants.js';
import { nextStageMass, stageFloorMass, escapeVelocity, clamp, rocheLimit } from '../core/phys.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
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
    this.resize();
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

  showCard(stageIdx, extraTitle) {
    const s = STAGES[stageIdx];
    this.el.cardStage.textContent = extraTitle || 'New stage';
    this.el.cardTitle.textContent = s.name;
    this.el.cardFacts.innerHTML = '';
    for (const f of s.facts) {
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
    const st = STAGES[p.stage];
    e.stage.textContent = st.name;
    e.blurb.textContent = p.life === 2 ? 'Home to a civilisation' : p.life === 1 ? 'Life has taken hold' : st.blurb;
    // progress through this stage on a log scale
    const nxt = nextStageMass(p.mass, p.compact);
    const floor = stageFloorMass(p.mass, p.compact);
    if (nxt) {
      const t = clamp(Math.log(p.mass / floor) / Math.log(nxt / floor), 0, 1);
      e.bar.style.width = `${(t * 100).toFixed(1)}%`;
      const nextName = p.compact === 'ns' ? 'Black hole' : p.compact === 'bh' ? (p.mass < 100 * M_SUN ? 'Intermediate black hole' : p.mass < 1e5 * M_SUN ? 'Supermassive black hole' : 'Mass of Sagittarius A*') : STAGES[p.stage + 1]?.name;
      e.next.textContent = `${nextName} at ${F.sci(nxt, 1)} kg`;
    } else {
      e.bar.style.width = '100%';
      e.next.textContent = world.core ? 'Core collapse ahead' : 'Keep growing';
    }
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
    const parts = [['rock', c.rock], ['iron', c.iron], ['ice', c.ice], ['gas', c.gas]];
    e.comp.innerHTML = parts.map(([k, f]) => `<span style="width:${(f * 100).toFixed(2)}%;background:${COMP_COLORS[k]}"></span>`).join('');
    e.compLegend.innerHTML = parts.map(([k, f]) => `<span><i style="background:${COMP_COLORS[k]}"></i>${k} ${(f * 100).toFixed(f < 0.1 ? 1 : 0)}%</span>`).join('');
    // right side
    const rate = TIME_BASE * world.warp;
    e.time.textContent = world.warp > 1 ? `Time warp ×${world.warp} (1 s = ${F.duration(rate)})` : `1 s = ${F.duration(rate)}`;
    e.time.classList.toggle('hot', world.warp > 1);
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
      const col = big ? '#ff5a4e' : '#7fe0b0';
      const r = Math.max(8, Math.min((m.r || 0) + 6, 160));
      if (s.on) {
        if (m.kind === 'aim' || m.kind === 'lock') {
          drawBracket(ctx, s.x, s.y, r, m.kind === 'lock' ? '#ffb547' : col, m.kind === 'lock' ? 9 : 7);
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
          if (b.life) lines.push(b.life === 2 ? 'Signs of a civilisation' : 'Signs of life');
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
        edgeArrow(ctx, s, w, h, m.kind === 'lock' ? '#ffb547' : big ? '#ff5a4e' : '#7fe0b0', m.label);
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
