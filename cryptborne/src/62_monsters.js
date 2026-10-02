
// =====================================================================
// MONSTERS — movement, AI, bosses, deaths.
// =====================================================================
const REGION_TIER = { vale: 1, mirefen: 6, frostpeak: 7, sunscar: 8, saltmarrow: 9, home: 1 };
const inTownPx = (x, y) => G.area && G.area.safe ? G.area.safe.some((r) => inRect(r, Math.floor(x / 16), Math.floor(y / 16))) : false;
const inTown = (tx, ty) => G.area && G.area.safe ? G.area.safe.some((r) => inRect(r, tx, ty)) : false;

// ---------- movement & collision ----------
function blockedBox(e, x, y, isMon) {
  const m = G.area.map;
  const x0 = Math.floor((x - e.w / 2) / 16), x1 = Math.floor((x + e.w / 2 - 0.01) / 16), y0 = Math.floor((y - e.h / 2) / 16), y1 = Math.floor((y + e.h / 2 - 0.01) / 16);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (solidAt(m, tx, ty)) return true;
    if (isMon) { if (inTown(tx, ty)) return true; const t = tileAt(m, tx, ty); if (!e.d.fly && (t === T.LAVA || t === T.SPRING)) return true; }
  }
  return false;
}
function moveEntity(e, dx, dy, isMon) {
  if (isMon && e.d.ghost) { const m = G.area.map; e.x = clamp(e.x + dx, 24, m.w * 16 - 24); e.y = clamp(e.y + dy, 24, m.h * 16 - 24); return false; }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3)), sx = dx / steps, sy = dy / steps; let hit = false;
  for (let i = 0; i < steps; i++) {
    if (!blockedBox(e, e.x + sx, e.y, isMon)) e.x += sx; else hit = true;
    if (!blockedBox(e, e.x, e.y + sy, isMon)) e.y += sy; else hit = true;
  }
  return hit;
}
function los(x0, y0, x1, y1) {
  const m = G.area.map, d = dist(x0, y0, x1, y1), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); if (solidAt(m, Math.floor(x / 16), Math.floor(y / 16))) return false; }
  return true;
}
function nearestMon(range, from) {
  const p = from || G.p; let best = null, bd = range;
  for (const m of G.mons) { if (m.dead || m.hidden) continue; const d = dist(m.x, m.y, p.x, p.y); if (d < bd && los(p.x, p.y - 8, m.x, m.y - 8)) { bd = d; best = m; } }
  return best;
}
function updateFlow() {
  const m = G.area.map, p = G.p, W = m.w; const ptx = Math.floor(p.x / 16), pty = Math.floor(p.y / 16), key = pty * W + ptx;
  if (key === m.flowKey) return; m.flowKey = key;
  const f = m.flow; f.fill(-1); if (solidAt(m, ptx, pty)) return;
  f[key] = 0; const q = [key];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], dv = f[i]; if (dv >= 30) continue; const x = i % W, y = (i / W) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue; const j = ny * W + nx;
      if (f[j] !== -1 || solidAt(m, nx, ny) || m.t[j] === T.LAVA || m.t[j] === T.SPRING || inTown(nx, ny)) continue;
      f[j] = dv + 1; q.push(j);
    }
  }
}
function chaseDir(m, tx0, ty0) {
  const map = G.area.map, W = map.w; const gx0 = tx0 - m.x, gy0 = ty0 - m.y, d = Math.hypot(gx0, gy0) || 1;
  if (m.d.ghost || d < 26 || tx0 !== G.p.x) return [gx0 / d, gy0 / d];
  const tx = Math.floor(m.x / 16), ty = Math.floor(m.y / 16), f = map.flow, cur = f[ty * W + tx];
  if (cur < 0) return [gx0 / d, gy0 / d];
  let best = cur, bx = 0, by = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
    const v = f[ny * W + nx]; if (v < 0 || v >= best) continue;
    if (dx && dy && (f[ty * W + nx] < 0 || f[ny * W + tx] < 0)) continue;
    best = v; bx = dx; by = dy;
  }
  if (best === cur) return [gx0 / d, gy0 / d];
  const gx = (tx + bx) * 16 + 8 - m.x, gy = (ty + by) * 16 + 8 - m.y, L = Math.hypot(gx, gy) || 1;
  return [gx / L, gy / L];
}

// ---------- spawning ----------
const _mf = {};
function monFrames(type) {
  if (_mf[type]) return _mf[type];
  if (type === 'lich_face') return (_mf[type] = buildHumanoid(Object.assign({}, MON.lich.look, { hood: null, hair: '#e8e0d8', hairStyle: 1 })));
  const d = MON[type];
  if (d.art === 'human') return (_mf[type] = buildHumanoid(d.look));
  if (d.art === 'hero') return (_mf[type] = buildHumanoid(Object.assign({}, heroLook(), { eyes: '#d8454a', weapon: 'sword' })).map(darkOf));
  if (d.art === 'wisp') return (_mf[type] = []);
  if (CREATURE_PAINT[d.art]) return (_mf[type] = CREATURE_PAINT[d.art](d.pal));
  return (_mf[type] = CREATURE_T[d.art].map((rows) => spr(rows, Object.assign({ k: OUT }, d.pal))));
}
const BODY_H = { human: 24, hero: 24, slime: 12, frog: 11, bat: 10, wisp: 8, wyrm: 18, wolf: 13, spider: 12, scorpion: 12, crab: 12, crystal: 22 };
function monBodyH(m) { const d = m.d, sc = d.art === 'bat' || d.art === 'wisp' ? 1 : d.scale || 1; return (BODY_H[d.art] || 10) * sc; }
function monLift(m) { const d = m.d; return d.art === 'bat' ? 10 + Math.sin(m.t * 6) * 2 : d.art === 'wisp' ? 12 + Math.sin(m.t * 3) * 3 : d.art === 'crystal' ? 5 + Math.sin(m.t * 2) * 2 : d.fly && d.art === 'human' ? 4 + Math.sin(m.t * 3) * 2 : 0; }
function monCenter(m) { return [m.x, m.y - monLift(m) - monBodyH(m) / 2]; }
function areaTier() { return G.area.def ? G.area.def.tier : REGION_TIER[G.area.id] || 1; }
function spawnMon(type, x, y, o = {}) {
  const d = MON[type], sc = d.scale || 1, [hm, dm] = d.boss || d.mini ? [1, 1] : tierMult(d.t, areaTier());
  const night = G.area.kind === 'overworld' && Clock.isNight() ? 1.2 : 1, df = DF();
  const hp = Math.round(d.hp * hm * night * df.hp * (d.art === 'hero' ? Math.max(1, PS().maxHp / 400) : 1));
  const m = { type, d, x, y, hp, maxHp: hp, dmg: Math.round(d.dmg * dm * night * df.dmg), w: Math.min(22, (d.w || 9) * sc * (d.art !== 'human' && d.art !== 'hero' ? 1.3 : 1)), h: Math.min(14, (d.h || 6) * sc),
    kbx: 0, kby: 0, face: 1, t: rand(0, 5), atkCd: rand(0.6, 1.6), wind: 0, act: null, actT: 0, flash: 0, flinch: 0, stun: 0, slowT: 0, poisonT: 0, burnT: 0, dotAcc: 0,
    walk: 0, moving: false, aggro: !!o.aggro, room: o.room || null, zone: o.zone || null, boss: !!d.boss, mini: !!d.mini, mi: 0, hopT: 0, hvx: 0, hvy: 0, contactCd: 0,
    wx: x, wy: y, wanderT: rand(0, 2), summoned: !!o.summoned, dead: false, lungeHit: false, voiced: false, strikeT: 0, scripted: !!o.scripted, summonT: 6 };
  if (m.boss) m.actT = 1.2;
  G.mons.push(m); return m;
}
function inRoomPx(x, y, r) { if (!r) return false; const tx = Math.floor(x / 16), ty = Math.floor(y / 16); return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h; }
function bossWake(m) {
  G.bossMon = m; Sfx.play('boss'); Sfx.voice(m.d.voice[0], m.d.voice[1], m); shake(4); UI.toast(`${m.d.name.toUpperCase()} AWAKENS!`, 'bad big');
}
function fireProj(o) { G.projs.push(Object.assign({ life: 3, r: 3, pierce: 0, hit: [] }, o)); }
const PROJ_HIT = { poison: 'poison', ice: 'slow', web: 'web', tongue: 'pull', sand: 'blind' };
function monShoot(m, kind, ang, spd, dmgMul = 1) {
  const [cx, cy] = monCenter(m);
  fireProj({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: Math.round(m.dmg * dmgMul), from: 'm', kind, src: m, r: ['fire', 'soul', 'poison', 'ice', 'shadow'].includes(kind) ? 4 : 3, life: kind === 'tongue' ? 0.45 : 3, eff: PROJ_HIT[kind] });
}
function monStrike(m, reach, mul = 1, aoe = false) {
  const p = G.p, d = dist(m.x, m.y, p.x, p.y);
  m.strikeT = 0.18;
  if (aoe) { G.fx.push({ kind: 'ring', x: m.x, y: m.y, r0: 6, r1: reach, life: 0.35, max: 0.35, col: '#ffcf8a' }); shake(3); Sfx.play('slam', m); }
  else { const a = Math.atan2(p.y - m.y, p.x - m.x); G.fx.push({ kind: 'slash', x: m.x, y: m.y - monBodyH(m) / 2, ang: a, range: reach, arc: 1.6, life: 0.14, max: 0.14, col: '#ff8a8a' }); Sfx.play('swing', m); }
  if (d <= reach + 6) hurtPlayer(Math.round(m.dmg * mul), m.x, m.y, { src: m, eff: m.d.hit });
}
function teleportNear(m, minD, maxD, room) {
  const p = G.p, map = G.area.map;
  for (let k = 0; k < 30; k++) {
    const a = rand(0, TAU), r = rand(minD, maxD), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (room && !inRoomPx(x, y, room)) continue;
    if (!blockedBox(m, x, y, true) && tileAt(map, Math.floor(x / 16), Math.floor(y / 16)) !== T.LAVA) { burst(m.x, m.y - 10, 12, '#b878ea', 50); m.x = x; m.y = y; burst(x, y - 10, 12, '#b878ea', 50); Sfx.play('magic', m); return true; }
  }
  return false;
}
function summonAround(m, type, n) {
  const live = G.mons.filter((o) => o.summoned && !o.dead).length; n = Math.min(n, 6 - live);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 12; k++) { const a = rand(0, TAU), r = rand(20, 44), x = m.x + Math.cos(a) * r, y = m.y + Math.sin(a) * r; const tmp = { w: 9, h: 6, d: MON[type] };
      if (!blockedBox(tmp, x, y, true)) { const s = spawnMon(type, x, y, { aggro: true, summoned: true, room: m.room }); s.atkCd = 1.2; burst(x, y - 8, 10, '#b878ea', 40); break; } }
  }
}
// ---------- per-frame AI ----------
function updateMon(m, dt) {
  const p = G.p, d = m.d; m.t += dt; m.flash = Math.max(0, m.flash - dt); m.flinch = Math.max(0, m.flinch - dt); m.strikeT = Math.max(0, m.strikeT - dt); m.atkCd -= dt; m.contactCd -= dt;
  if (m.kbx || m.kby) { moveEntity(m, m.kbx * dt, m.kby * dt, true); const k = Math.pow(0.0015, dt); m.kbx *= k; m.kby *= k; if (Math.abs(m.kbx) + Math.abs(m.kby) < 4) m.kbx = m.kby = 0; }
  if (m.poisonT > 0 || m.burnT > 0) {
    m.poisonT -= dt; m.burnT -= dt; m.dotAcc += dt;
    if (m.dotAcc >= 0.5) { m.dotAcc -= 0.5; const frac = m.boss ? 0.004 : 0.03, burn = m.burnT > 0; hurtMon(m, Math.max(2, Math.round(m.maxHp * frac * (burn && m.poisonT > 0 ? 1.6 : 1))), { dot: burn ? 'burn' : 'poison' }); if (m.dead) return; if (burn) burst(m.x, m.y - 10, 3, '#ff8a2a', 20); }
  }
  if (m.stun > 0) { m.stun -= dt; m.moving = false; return; }
  const slow = m.slowT > 0 ? 0.5 : 1; m.slowT -= dt;
  const enr = m.boss && m.hp < m.maxHp * 0.5 ? 1.25 : 1;
  const spd = d.spd * slow * enr;
  const dx = p.x - m.x, dy = p.y - m.y, dd = Math.hypot(dx, dy) || 1;
  const hidden = G.p.buffs && G.p.buffs.smoke > 0;
  m.moving = false;
  // waking up and giving up
  if (!m.aggro) {
    if (G.dead || hidden || m.scripted) return wander(m, dt, spd);
    const range = m.mini ? 150 : 115;
    const wake = m.boss ? inRoomPx(p.x, p.y, m.room) : dd < range && !inTownPx(p.x, p.y) && (dd < 50 || los(m.x, m.y - 8, p.x, p.y - 8));
    if (wake) { m.aggro = true; if (m.boss) bossWake(m); else { m.atkCd = Math.max(m.atkCd, 0.5); if (!m.voiced) { m.voiced = true; Sfx.voice(d.voice[0], d.voice[1] * rand(0.9, 1.1), m); } } }
    else return wander(m, dt, spd);
  }
  if (G.dead || hidden || (!m.boss && (dd > 380 || inTownPx(p.x, p.y)))) { m.aggro = false; m.wind = 0; m.act = null; return; }
  if (Math.abs(dx) > 2 && m.wind <= 0) m.face = dx < 0 ? -1 : 1;
  const step = (vx, vy, mul = 1) => { moveEntity(m, vx * spd * mul * dt, vy * spd * mul * dt, true); m.moving = true; m.walk += dt * 9 * mul; };
  const chase = (mul = 1) => { const [vx, vy] = chaseDir(m, p.x, p.y); step(vx, vy, mul); };
  const touching = dd < m.w / 2 + 8;
  const contact = (mul = 1) => { if (touching && m.contactCd <= 0) { m.contactCd = 0.8; hurtPlayer(Math.round(m.dmg * mul), m.x, m.y, { src: m, eff: d.hit }); } };
  if (m.wind > 0) {
    m.wind -= dt;
    if (m.wind <= 0) {
      const a = m.pending; m.pending = null;
      if (a === 'melee') monStrike(m, (d.reach || 18) * (d.scale || 1) * 0.8 + 6, 1, !!d.slam);
      else if (a === 'shoot') { monShoot(m, d.proj, Math.atan2(p.y - 10 - (m.y - monBodyH(m) / 2), p.x - m.x), d.projSpd); Sfx.play(d.proj === 'arrow' || d.proj === 'shot' ? 'shoot' : 'magic', m); }
      else if (a === 'tongue') { monShoot(m, 'tongue', Math.atan2(p.y - 8 - (m.y - 4), p.x - m.x), 230, 0.8); }
      else if (a === 'lunge') { m.act = 'lunging'; m.actT = 0.32; m.hvx = dx / dd; m.hvy = dy / dd; m.lungeHit = false; Sfx.voice(d.voice[0], d.voice[1], m); }
      else if (a) bossAct(m, a);
    }
    return;
  }
  if (m.act === 'lunging') {
    m.actT -= dt; step(m.hvx, m.hvy, 4.2);
    if (!m.lungeHit && touching) { m.lungeHit = true; hurtPlayer(m.dmg, m.x, m.y, { src: m, eff: d.hit }); }
    if (m.actT <= 0) m.act = null;
    return;
  }
  if (m.boss) { updateBoss(m, dt, spd, dd, chase, step, contact); return; }
  if (d.summon && m.mini) { m.summonT -= dt; if (m.summonT <= 0) { m.summonT = 8; summonAround(m, d.summon, 2); } }
  switch (d.ai) {
    case 'hop':
      m.hopT -= dt;
      if (m.hopT > 0.55) step(m.hvx, m.hvy, 2.4);
      if (m.hopT <= 0) {
        m.hopT = rand(0.9, 1.3) / enr; const [vx, vy] = chaseDir(m, p.x, p.y); m.hvx = vx; m.hvy = vy;
        if (d.proj === 'tongue' && dd > 30 && dd < 80 && m.atkCd <= 0 && los(m.x, m.y - 4, p.x, p.y - 8)) { m.wind = 0.3; m.pending = 'tongue'; m.atkCd = 2.2; m.hopT = 0.8; m.hvx = m.hvy = 0; }
        else if (chance(0.25)) Sfx.voice(d.voice[0], d.voice[1] * 1.2, m);
      }
      contact();
      break;
    case 'flutter': {
      const [vx, vy] = chaseDir(m, p.x, p.y); const wob = Math.sin(m.t * 7) * 0.8;
      if (m.contactCd > 0.3) step(-vx, -vy, 0.8); else step(vx - vy * wob, vy + vx * wob, 1);
      contact();
      break;
    }
    case 'wisp': { // drifts in, then pops when it touches you
      const [vx, vy] = chaseDir(m, p.x, p.y); const wob = Math.sin(m.t * 3) * 0.6; step(vx - vy * wob, vy + vx * wob, 1);
      if (touching) { explodeMon(m); return; }
      break;
    }
    case 'melee': {
      const reach = (d.reach || 18) * (d.scale || 1) * 0.8;
      if (dd < reach + 6 && m.atkCd <= 0) { m.wind = d.windup; m.pending = 'melee'; m.atkCd = rand(1.0, 1.5); if (chance(0.35)) Sfx.voice(d.voice[0], d.voice[1], m); }
      else if (dd > reach - 2) chase();
      break;
    }
    case 'ranged': case 'caster': {
      m.blinkT = (m.blinkT == null ? rand(3, 5) : m.blinkT) - dt;
      if (d.blink && m.blinkT <= 0) { m.blinkT = rand(3.5, 5.5); if (teleportNear(m, 70, 110, m.room)) m.atkCd = Math.min(m.atkCd, 0.5); }
      const see = los(m.x, m.y - 8, p.x, p.y - 8);
      if (dd > d.range || !see) chase(); else if (dd < 64) step(-dx / dd, -dy / dd, 0.8); else step((-dy / dd) * Math.sin(m.t), (dx / dd) * Math.sin(m.t), 0.4);
      if (see && dd < d.range + 20 && m.atkCd <= 0) { m.wind = 0.4; m.pending = 'shoot'; m.atkCd = d.rate; }
      break;
    }
    case 'lunge':
      if (dd < 80 && m.atkCd <= 0) { m.wind = 0.45; m.pending = 'lunge'; m.atkCd = rand(1.4, 2); } else if (dd > 22) chase(); else contact(0.6);
      break;
  }
}
function wander(m, dt, spd) {
  m.wanderT -= dt;
  if (m.wanderT <= 0) { m.wanderT = rand(1.5, 4); const a = rand(0, TAU); m.wx = m.x + Math.cos(a) * 30; m.wy = m.y + Math.sin(a) * 30; }
  const wx = m.wx - m.x, wy = m.wy - m.y, wd = Math.hypot(wx, wy);
  if (wd > 3 && m.d.ai !== 'hop' && !m.boss) { if (moveEntity(m, (wx / wd) * spd * 0.35 * dt, (wy / wd) * spd * 0.35 * dt, true)) m.wx = m.x; m.moving = true; m.face = wx < 0 ? -1 : 1; m.walk += dt * 8; }
}
function explodeMon(m) {
  G.fx.push({ kind: 'ring', x: m.x, y: m.y, r0: 4, r1: 40, life: 0.3, max: 0.3, col: m.d.glow || '#ffffff' }); burst(m.x, m.y - 10, 20, m.d.glow || '#ffffff', 90); Sfx.play('explode', m);
  if (dist(m.x, m.y, G.p.x, G.p.y) < 40) hurtPlayer(m.dmg, m.x, m.y, { src: m });
  m.hp = 0; killMon(m, true);
}
function updateBoss(m, dt, spd, dd, chase, step, contact) {
  const d = m.d, mv = d.moves[m.mi % d.moves.length], name = mv.split(':')[0];
  m.actT -= dt;
  if (name === 'hop') {
    m.hopT -= dt;
    if (m.hopT > 0.5) step(m.hvx, m.hvy, 2.6);
    if (m.hopT <= 0) { if (m.hvx || m.hvy) { G.fx.push({ kind: 'ring', x: m.x, y: m.y, r0: 8, r1: 46, life: 0.3, max: 0.3, col: '#b8f5a8' }); shake(2); Sfx.play('slam', m); if (dd < 46) hurtPlayer(m.dmg, m.x, m.y, { src: m }); } m.hopT = 1.0; const [vx, vy] = chaseDir(m, G.p.x, G.p.y); m.hvx = vx; m.hvy = vy; }
    contact();
  } else if (name === 'chase') {
    const reach = (d.reach || 18) * (d.scale || 1) * 0.55 + 8;
    if (dd < reach + 6 && m.atkCd <= 0) { m.wind = 0.5; m.pending = 'melee'; m.atkCd = 1.1; } else if (dd > reach - 2) chase(1.1);
  } else if (name === 'lunge') {
    if (m.atkCd <= 0) { m.wind = 0.45; m.pending = 'lunge'; m.atkCd = 1.2; } else if (dd > 30) chase(); else contact(0.6);
  } else if (m.actT > 0 && name === 'slam' && dd > 30) chase(0.9);
  if (m.actT <= 0) {
    if (['charge', 'slam', 'ring', 'volley', 'summon', 'blink'].includes(name) && !m.started) {
      m.started = true; m.wind = name === 'blink' ? 0.25 : name === 'summon' ? 0.8 : 0.7; m.pending = mv; m.actT = 0.1;
      if (name === 'charge') { m.cvx = (G.p.x - m.x) / (dd || 1); m.cvy = (G.p.y - m.y) / (dd || 1); }
      if (name !== 'blink') Sfx.voice(d.voice[0], d.voice[1], m);
      return;
    }
    m.started = false; m.mi++; const nx = d.moves[m.mi % d.moves.length].split(':')[0];
    m.actT = nx === 'hop' || nx === 'chase' || nx === 'lunge' ? 3.2 : nx === 'slam' ? 1.2 : 0.4;
  }
}
function bossAct(m, mv) {
  const [name, arg] = mv.split(':');
  const enr = m.hp < m.maxHp * 0.5, spd = { slime: 80, ice: 110, shot: 190, web: 110, poison: 100, fire: 110, soul: 120, shadow: 130, sand: 130 }[arg] || 110;
  if (name === 'charge') { m.act = 'lunging'; m.actT = 0.55; m.hvx = m.cvx; m.hvy = m.cvy; m.lungeHit = false; Sfx.play('dodge', m); }
  else if (name === 'slam') monStrike(m, 52, 1.3, true);
  else if (name === 'ring') { const n = enr ? 18 : 12; for (let i = 0; i < n; i++) monShoot(m, arg, (i / n) * TAU + m.t, spd * 0.75, 0.7); if (enr) later(0.4, () => { if (!m.dead) for (let i = 0; i < n; i++) monShoot(m, arg, (i / n) * TAU + 0.17, spd * 0.7, 0.7); }); Sfx.play('magic', m); }
  else if (name === 'volley') { const waves = enr ? 4 : 3; for (let w = 0; w < waves; w++) later(w * 0.38, () => { if (m.dead) return; const a = Math.atan2(G.p.y - 10 - (m.y - monBodyH(m) / 2), G.p.x - m.x); for (let k = -2; k <= 2; k++) monShoot(m, arg, a + k * 0.2, spd, 0.6); Sfx.play('shoot', m); }); }
  else if (name === 'summon') { summonAround(m, arg, enr ? 3 : 2); Sfx.play('portal', m); }
  else if (name === 'blink') { teleportNear(m, 70, 120, m.room); later(0.25, () => { if (!m.dead) for (let k = -1; k <= 1; k++) monShoot(m, 'soul', Math.atan2(G.p.y - m.y, G.p.x - m.x) + k * 0.25, 140, 0.6); }); }
}
// ---------- death ----------
function killMon(m, silent) {
  if (m.dead && m.corpsed) return;
  m.dead = true; m.corpsed = true; const d = m.d; const SV = G.save;
  SV.stats.kills++; SV.stats.byType[m.type] = (SV.stats.byType[m.type] || 0) + 1;
  const [cx, cy] = monCenter(m);
  G.corpses.push({ type: m.type, d, x: m.x, y: m.y, face: m.face, t: 0, anim: d.death || 'fall', lift: monLift(m) });
  blood(cx, cy, d.blood || '#a3242a', m.boss ? 30 : 10);
  if (!silent) Sfx.play('kill', m);
  Sfx.voice(d.voice[0], d.voice[1] * 0.8, m);
  const st = PS();
  if (!m.summoned || chance(0.5)) {
    dropCoins(Math.round(randi(d.coins[0], d.coins[1]) * st.coins), m.x, m.y);
    for (const [id, c] of d.drops || []) if (chance(c * st.drops)) dropItem(id, 1, m.x, m.y);
    if (chance(0.04 * st.drops)) dropItem(areaTier() >= 6 ? 'big_potion' : 'potion', 1, m.x, m.y);
  }
  gainXp(m.summoned ? Math.ceil(d.xp / 3) : d.xp);
  if (st.bloodlust) { G.p.hp = Math.min(st.maxHp, G.p.hp + st.maxHp * st.bloodlust); }
  Quests.onKill(m.type); Pets.onKill(d.xp);
  if (m.mini) { G.picks.push({ kind: 'key', x: m.x, y: m.y, z: 4, vz: 90, vx: 0, vy: 0, t: 0 }); UI.toast('The mini-boss dropped the BOSS KEY!', 'gold'); Sfx.play('quest'); }
  if (m.boss) Story.onBossDead(m);
}
function updateCorpses(dt) {
  for (const c of G.corpses) c.t += dt;
  G.corpses = G.corpses.filter((c) => c.t < (c.anim === 'bones' ? 4 : 1.6));
}
