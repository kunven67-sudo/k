
// ---------- run state ----------
let WORLD = null;
const G = { later: [], on: false, save: null, p: null, area: null, mons: [], projs: [], picks: [], parts: [], texts: [], fx: [], time: 0, shake: 0, cam: { x: 0, y: 0 }, bossMon: null, autosaveT: 0, zoneT: 0, dead: false, invFullT: 0, noShieldT: 0, dodgeTxtT: 0 };
const FISTS = { id: null, name: 'Fists', wc: 'melee', dmg: 3, cd: 0.4, range: 17, arc: 90 };
const S = () => G.save.player;
const weaponDef = () => (S().eq.weapon ? ITEMS[S().eq.weapon] : FISTS);
const shieldDef = () => (S().eq.shield ? ITEMS[S().eq.shield] : null);
const armorDef = () => (S().eq.armor ? ITEMS[S().eq.armor] : null);
const defense = () => (armorDef() ? armorDef().def : 0);
const inTownPx = (x, y) => inTown(Math.floor(x / 16), Math.floor(y / 16));

function newSaveData(name) {
  const now = Date.now();
  const inv = new Array(INV_SIZE).fill(null);
  inv[0] = { id: 'map', n: 1 }; inv[1] = { id: 'potion', n: 3 };
  return { v: 1, fresh: true, id: 's' + now.toString(36) + Math.random().toString(36).slice(2, 7), name, created: now, lastLoaded: now, lastSaved: now,
    player: { level: 1, xp: 0, coins: 25, hp: 100, inv, eq: { weapon: 'wood_sword', shield: null, armor: null }, x: WORLD.spawn.x, y: WORLD.spawn.y },
    stats: { kills: 0, chests: 0, deaths: 0, bosses: {}, playTime: 0 } };
}
function normalizeSave(s) { // repairs saves from older/other versions instead of crashing
  const P = s.player; P.level = clamp(P.level | 0 || 1, 1, MAX_LVL); P.xp = Math.max(0, +P.xp || 0); P.coins = Math.max(0, Math.floor(+P.coins || 0));
  P.inv = (Array.isArray(P.inv) ? P.inv : []).slice(0, INV_SIZE).map((e) => (e && ITEMS[e.id] ? { id: e.id, n: clamp(e.n | 0 || 1, 1, 99) } : null));
  while (P.inv.length < INV_SIZE) P.inv.push(null);
  if (!P.inv.some((e) => e && e.id === 'map')) { const i = P.inv.indexOf(null); if (i >= 0) P.inv[i] = { id: 'map', n: 1 }; }
  P.eq = P.eq || {}; for (const k of ['weapon', 'shield', 'armor']) if (P.eq[k] && (!ITEMS[P.eq[k]] || ITEMS[P.eq[k]].type !== k)) P.eq[k] = null;
  s.stats = Object.assign({ kills: 0, chests: 0, deaths: 0, bosses: {}, playTime: 0 }, s.stats || {});
  return s;
}

// ---------- inventory ----------
const inv = () => S().inv;
function invAdd(id, n = 1) {
  const it = ITEMS[id], I = inv(); let left = n;
  if (STACKS(it)) for (let i = 0; i < INV_SIZE && left > 0; i++) { const s = I[i]; if (s && s.id === id && s.n < 99) { const k = Math.min(99 - s.n, left); s.n += k; left -= k; } }
  for (let i = 0; i < INV_SIZE && left > 0; i++) if (!I[i]) { const k = STACKS(it) ? Math.min(99, left) : 1; I[i] = { id, n: k }; left -= k; }
  if (left !== n) UI.invDirty();
  return left;
}
const invCount = (id) => inv().reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
function invTakeAt(i, n = 1) { const s = inv()[i]; if (!s) return; s.n -= n; if (s.n <= 0) inv()[i] = null; UI.invDirty(); }
function equipFrom(i) {
  const s = inv()[i]; if (!s) return; const it = ITEMS[s.id], kind = it.type;
  if (kind !== 'weapon' && kind !== 'shield' && kind !== 'armor') return;
  if (S().level < it.lvl) { UI.toast(`${it.name} needs level ${it.lvl}`, 'bad'); Sfx.play('error'); return; }
  const old = S().eq[kind]; S().eq[kind] = s.id; inv()[i] = old ? { id: old, n: 1 } : null;
  UI.toast(`Equipped ${it.name}`, 'good'); Sfx.play('pickup'); UI.invDirty();
}
function unequip(kind) {
  const id = S().eq[kind]; if (!id) return;
  const i = inv().indexOf(null); if (i < 0) { UI.toast('Bag is full', 'bad'); Sfx.play('error'); return; }
  inv()[i] = { id, n: 1 }; S().eq[kind] = null; UI.toast(`Unequipped ${ITEMS[id].name}`); UI.invDirty();
}
function drinkAt(i) {
  const s = inv()[i]; if (!s) return; const it = ITEMS[s.id]; const p = G.p, mx = maxHpFor(S().level);
  if (p.hp >= mx && !(it.stam && p.sta < p.maxSta)) { UI.toast('Already at full health'); return; }
  p.hp = Math.min(mx, p.hp + it.heal); if (it.stam) p.sta = p.maxSta;
  invTakeAt(i); Sfx.play('drink'); addText(p.x, p.y - 26, '+' + Math.min(it.heal, 999) + ' HP', '#7dff8a');
  burst(p.x, p.y - 10, 10, '#ff9a9a', 50);
}
function quickPotion() {
  const missing = maxHpFor(S().level) - G.p.hp; const I = inv(); let best = -1, bestHeal = 0;
  for (let i = 0; i < INV_SIZE; i++) { const s = I[i]; if (!s || ITEMS[s.id].type !== 'potion') continue; const h = ITEMS[s.id].heal;
    if (best < 0 || (bestHeal < missing ? h > bestHeal : h >= missing && h < bestHeal)) { best = i; bestHeal = h; } }
  if (best < 0) { UI.toast('No potions! Buy some from Mara.', 'bad'); Sfx.play('error'); return; }
  drinkAt(best);
}
function useSlot(i) {
  const s = inv()[i]; if (!s) return; const it = ITEMS[s.id];
  if (it.type === 'map') UI.openMap();
  else if (it.type === 'potion') drinkAt(i);
  else if (it.type === 'weapon' || it.type === 'shield' || it.type === 'armor') equipFrom(i);
  else UI.toast(`${it.name}: sell it at a shop for ${sellPrice(s.id)} coins`, 'gold');
}
function gainCoins(n) { S().coins += n; UI.hudDirty(); }
function gainXp(n) {
  const P = S(); if (P.level >= MAX_LVL) return;
  P.xp += n;
  while (P.level < MAX_LVL && P.xp >= xpNeed(P.level)) {
    P.xp -= xpNeed(P.level); P.level++;
    G.p.hp = maxHpFor(P.level); G.p.sta = G.p.maxSta;
    UI.toast(`LEVEL UP! You are level ${P.level}`, 'gold big'); Sfx.play('level');
    burst(G.p.x, G.p.y - 10, 30, '#f2c13a', 90);
    for (const d of DUNGEONS) if (d.lvl === P.level) UI.toast(`New dungeon unlocked: ${d.name}`, 'good');
    saveGame();
  }
  if (P.level >= MAX_LVL) P.xp = 0;
  UI.hudDirty();
}

// ---------- effects ----------
function addText(x, y, txt, col, big) { if (G.texts.length > 60) G.texts.shift(); G.texts.push({ x: x + rand(-4, 4), y, txt, col, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big }); }
function burst(x, y, n, col, spd = 60, grav = 0) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(spd * 0.3, spd); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, col, size: chance(0.3) ? 2 : 1, grav }); } if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500); }
function shake(a) { if (SET.shake) G.shake = Math.max(G.shake, a); }

// ---------- movement & collision ----------
function blockedBox(e, x, y, isMon) {
  const m = G.area.map;
  const x0 = Math.floor((x - e.w / 2) / 16), x1 = Math.floor((x + e.w / 2 - 0.01) / 16), y0 = Math.floor((y - e.h / 2) / 16), y1 = Math.floor((y + e.h / 2 - 0.01) / 16);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (solidAt(m, tx, ty)) return true;
    if (isMon) { if (G.area.kind === 'overworld' && inTown(tx, ty)) return true; if (!e.d.fly && tileAt(m, tx, ty) === T.LAVA) return true; }
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
function updateFlow() {
  const m = G.area.map, p = G.p, W = m.w; const ptx = Math.floor(p.x / 16), pty = Math.floor(p.y / 16), key = pty * W + ptx;
  if (key === m.flowKey) return; m.flowKey = key;
  const f = m.flow; f.fill(-1); if (solidAt(m, ptx, pty)) return;
  const ow = G.area.kind === 'overworld'; f[key] = 0; const q = [key];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], dv = f[i]; if (dv >= 30) continue; const x = i % W, y = (i / W) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue; const j = ny * W + nx;
      if (f[j] !== -1 || solidAt(m, nx, ny) || m.t[j] === T.LAVA || (ow && inTown(nx, ny))) continue;
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

// ---------- monsters ----------
const _mf = {};
function monFrames(type) {
  if (_mf[type]) return _mf[type]; const d = MON[type];
  return (_mf[type] = d.art === 'human' ? buildHumanoid(d.look) : CREATURE_T[d.art].map((rows) => spr(rows, Object.assign({ k: OUT }, d.pal))));
}
function monBodyH(m) { const d = m.d, sc = d.scale || 1; return d.art === 'human' ? 18 * sc : d.art === 'slime' ? 9 * sc : d.art === 'bat' ? 8 : 9 * sc; }
function monLift(m) { return m.d.art === 'bat' ? 10 + Math.sin(m.t * 6) * 2 : m.d.fly && m.d.art === 'human' ? 4 + Math.sin(m.t * 3) * 2 : 0; }
function monCenter(m) { return [m.x, m.y - monLift(m) - monBodyH(m) / 2]; }
function spawnMon(type, x, y, o = {}) {
  const d = MON[type], tier = G.area.def ? G.area.def.tier : 1, mult = d.boss ? 1 : 1 + 0.25 * Math.max(0, tier - d.t), sc = d.scale || 1;
  const hp = Math.round(d.hp * mult);
  const m = { type, d, x, y, hp, maxHp: hp, dmg: Math.round(d.dmg * mult), w: Math.min(15, (d.w || 9) * sc), h: Math.min(12, (d.h || 6) * sc), kbx: 0, kby: 0, face: 1, t: rand(0, 5), atkCd: rand(0.6, 1.6), wind: 0, act: null, actT: 0, flash: 0, stun: 0, slowT: 0, poisonT: 0, poisonAcc: 0, walk: 0, moving: false, aggro: !!o.aggro, room: o.room || null, zone: o.zone || null, boss: !!d.boss, mi: 0, hopT: 0, hvx: 0, hvy: 0, contactCd: 0, wx: x, wy: y, wanderT: rand(0, 2), summoned: !!o.summoned, dead: false, lungeHit: false };
  if (m.boss) m.actT = 1.2;
  G.mons.push(m); return m;
}
function inRoom(x, y, r) { if (!r) return false; const tx = Math.floor(x / 16), ty = Math.floor(y / 16); return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h; }
function bossWake(m) {
  G.bossMon = m; Sfx.play('boss'); shake(4); UI.toast(`${m.d.name.toUpperCase()} AWAKENS!`, 'bad big');
}
function fireProj(o) { G.projs.push(Object.assign({ life: 3, r: 3, pierce: 0, hit: [] }, o)); }
function monShoot(m, kind, ang, spd, dmgMul = 1) {
  const [cx, cy] = monCenter(m);
  fireProj({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: Math.round(m.dmg * dmgMul), from: 'm', kind, src: m, r: kind === 'fire' || kind === 'soul' ? 4 : 3 });
}
function monStrike(m, reach, mul = 1, aoe = false) {
  const p = G.p, d = dist(m.x, m.y, p.x, p.y);
  if (aoe) { G.fx.push({ kind: 'ring', x: m.x, y: m.y, r0: 6, r1: reach, life: 0.35, max: 0.35, col: '#ffcf8a' }); shake(3); Sfx.play('slam'); }
  if (d <= reach + 6) hurtPlayer(Math.round(m.dmg * mul), m.x, m.y, { src: m });
}
function teleportNear(m, minD, maxD, room) {
  const p = G.p, map = G.area.map;
  for (let k = 0; k < 30; k++) {
    const a = rand(0, TAU), r = rand(minD, maxD), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (room && !inRoom(x, y, room)) continue;
    if (!blockedBox(m, x, y, true) && tileAt(map, Math.floor(x / 16), Math.floor(y / 16)) !== T.LAVA) { burst(m.x, m.y - 10, 12, '#b878ea', 50); m.x = x; m.y = y; burst(x, y - 10, 12, '#b878ea', 50); return true; }
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
function updateMon(m, dt) {
  const p = G.p, d = m.d; m.t += dt; m.flash = Math.max(0, m.flash - dt); m.atkCd -= dt; m.contactCd -= dt;
  if (m.kbx || m.kby) { moveEntity(m, m.kbx * dt, m.kby * dt, true); const k = Math.pow(0.0015, dt); m.kbx *= k; m.kby *= k; if (Math.abs(m.kbx) + Math.abs(m.kby) < 4) m.kbx = m.kby = 0; }
  if (m.poisonT > 0) { m.poisonT -= dt; m.poisonAcc += dt; if (m.poisonAcc >= 0.5) { m.poisonAcc -= 0.5; hurtMon(m, Math.max(2, Math.round(m.maxHp * (m.boss ? 0.004 : 0.03))), { dot: true }); if (m.dead) return; } }
  if (m.stun > 0) { m.stun -= dt; m.moving = false; return; }
  const slow = m.slowT > 0 ? 0.5 : 1; m.slowT -= dt;
  const enr = m.boss && m.hp < m.maxHp * 0.5 ? 1.25 : 1;
  const spd = d.spd * slow * enr;
  const dx = p.x - m.x, dy = p.y - m.y, dd = Math.hypot(dx, dy) || 1;
  m.moving = false;
  // wake up / give up
  if (!m.aggro) {
    if (G.dead) return;
    const wake = m.boss ? inRoom(p.x, p.y, m.room) : dd < 115 && !(G.area.kind === 'overworld' && inTownPx(p.x, p.y));
    if (wake) { m.aggro = true; if (m.boss) bossWake(m); else m.atkCd = Math.max(m.atkCd, 0.5); }
    else { // idle wander
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = rand(1.5, 4); const a = rand(0, TAU); m.wx = m.x + Math.cos(a) * 30; m.wy = m.y + Math.sin(a) * 30; }
      const wx = m.wx - m.x, wy = m.wy - m.y, wd = Math.hypot(wx, wy);
      if (wd > 3 && d.ai !== 'hop') { if (moveEntity(m, (wx / wd) * spd * 0.35 * dt, (wy / wd) * spd * 0.35 * dt, true)) m.wx = m.x; m.moving = true; m.face = wx < 0 ? -1 : 1; m.walk += dt * 8; }
      return;
    }
  }
  if (G.dead || (!m.boss && (dd > 380 || (G.area.kind === 'overworld' && inTownPx(p.x, p.y))))) { m.aggro = false; m.wind = 0; m.act = null; return; }
  if (Math.abs(dx) > 2 && m.wind <= 0) m.face = dx < 0 ? -1 : 1;
  const step = (vx, vy, mul = 1) => { moveEntity(m, vx * spd * mul * dt, vy * spd * mul * dt, true); m.moving = true; m.walk += dt * 9 * mul; };
  const chase = (mul = 1) => { const [vx, vy] = chaseDir(m, p.x, p.y); step(vx, vy, mul); };
  const touching = dd < m.w / 2 + 8;
  const contact = (mul = 1) => { if (touching && m.contactCd <= 0) { m.contactCd = 0.8; hurtPlayer(Math.round(m.dmg * mul), m.x, m.y, { src: m }); } };
  // windup -> strike (shared by melee-style attacks)
  if (m.wind > 0) {
    m.wind -= dt;
    if (m.wind <= 0) {
      const a = m.pending; m.pending = null;
      if (a === 'melee') monStrike(m, (d.reach || 18) * (d.scale || 1) * 0.8 + 6, 1, !!d.slam);
      else if (a === 'shoot') monShoot(m, d.proj, Math.atan2(p.y - 10 - (m.y - monBodyH(m) / 2), p.x - m.x), d.projSpd);
      else if (a === 'lunge') { m.act = 'lunging'; m.actT = 0.32; m.hvx = dx / dd; m.hvy = dy / dd; m.lungeHit = false; }
      else if (a) bossAct(m, a);
    }
    return;
  }
  if (m.act === 'lunging') {
    m.actT -= dt; step(m.hvx, m.hvy, 4.2);
    if (!m.lungeHit && touching) { m.lungeHit = true; hurtPlayer(m.dmg, m.x, m.y, { src: m }); }
    if (m.actT <= 0) m.act = null;
    return;
  }
  if (m.boss) { updateBoss(m, dt, spd, dd, chase, step, contact); return; }
  switch (d.ai) {
    case 'hop':
      m.hopT -= dt;
      if (m.hopT > 0.55) step(m.hvx, m.hvy, 2.4);
      if (m.hopT <= 0) { m.hopT = rand(0.9, 1.3) / enr; const [vx, vy] = chaseDir(m, p.x, p.y); m.hvx = vx; m.hvy = vy; }
      contact();
      break;
    case 'flutter': {
      const [vx, vy] = chaseDir(m, p.x, p.y); const wob = Math.sin(m.t * 7) * 0.8;
      if (m.contactCd > 0.3) step(-vx, -vy, 0.8); else step(vx - vy * wob, vy + vx * wob, 1);
      contact();
      break;
    }
    case 'melee': {
      const reach = (d.reach || 18) * (d.scale || 1) * 0.8;
      if (dd < reach + 6 && m.atkCd <= 0) { m.wind = d.windup; m.pending = 'melee'; m.atkCd = rand(1.0, 1.5); }
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
function updateBoss(m, dt, spd, dd, chase, step, contact) {
  const d = m.d, mv = d.moves[m.mi % d.moves.length], [name, arg] = mv.split(':');
  m.actT -= dt;
  if (name === 'hop') {
    m.hopT -= dt;
    if (m.hopT > 0.5) step(m.hvx, m.hvy, 2.6);
    if (m.hopT <= 0) { if (m.hvx || m.hvy) { G.fx.push({ kind: 'ring', x: m.x, y: m.y, r0: 8, r1: 46, life: 0.3, max: 0.3, col: '#b8f5a8' }); shake(2); if (dd < 46) hurtPlayer(m.dmg, m.x, m.y, { src: m }); } m.hopT = 1.0; const [vx, vy] = chaseDir(m, G.p.x, G.p.y); m.hvx = vx; m.hvy = vy; }
    contact();
  } else if (name === 'chase') {
    const reach = (d.reach || 18) * (d.scale || 1) * 0.55 + 8;
    if (dd < reach + 6 && m.atkCd <= 0) { m.wind = 0.5; m.pending = 'melee'; m.atkCd = 1.1; } else if (dd > reach - 2) chase(1.1);
  } else if (name === 'lunge') {
    if (m.atkCd <= 0) { m.wind = 0.45; m.pending = 'lunge'; m.atkCd = 1.2; } else if (dd > 30) chase(); else contact(0.6);
  } else if (m.actT > 0) {
    if (name === 'slam' && dd > 30) chase(0.9);
  }
  if (m.actT <= 0) { // start the next move
    if (['charge', 'slam', 'ring', 'volley', 'summon', 'blink'].includes(name) && !m.started) {
      m.started = true; m.wind = name === 'blink' ? 0.25 : name === 'summon' ? 0.8 : 0.7; m.pending = mv; m.actT = 0.1;
      if (name === 'charge') { m.cvx = (G.p.x - m.x) / (dd || 1); m.cvy = (G.p.y - m.y) / (dd || 1); }
      return;
    }
    m.started = false; m.mi++; const nx = d.moves[m.mi % d.moves.length].split(':')[0];
    m.actT = nx === 'hop' || nx === 'chase' || nx === 'lunge' ? 3.2 : nx === 'slam' ? 1.2 : 0.4;
  }
}
function bossAct(m, mv) {
  const [name, arg] = mv.split(':'), p = G.p; const a0 = Math.atan2(p.y - 10 - (m.y - monBodyH(m) / 2), p.x - m.x);
  const enr = m.hp < m.maxHp * 0.5;
  if (name === 'charge') { m.act = 'lunging'; m.actT = 0.55; m.hvx = m.cvx; m.hvy = m.cvy; m.lungeHit = false; Sfx.play('dodge'); }
  else if (name === 'slam') monStrike(m, 52, 1.3, true);
  else if (name === 'ring') { const n = enr ? 18 : 12; for (let i = 0; i < n; i++) monShoot(m, arg, (i / n) * TAU + m.t, arg === 'slime' ? 80 : 100, 0.7); if (enr) later(0.4, () => { if (!m.dead) for (let i = 0; i < n; i++) monShoot(m, arg, (i / n) * TAU + 0.17, 90, 0.7); }); Sfx.play('magic'); }
  else if (name === 'volley') { const waves = enr ? 4 : 3; for (let w = 0; w < waves; w++) later(w * 0.38, () => { if (m.dead) return; const a = Math.atan2(G.p.y - 10 - (m.y - monBodyH(m) / 2), G.p.x - m.x); for (let k = -2; k <= 2; k++) monShoot(m, arg, a + k * 0.2, arg === 'web' ? 110 : 135, 0.6); Sfx.play('shoot'); }); }
  else if (name === 'summon') { summonAround(m, arg, enr ? 3 : 2); Sfx.play('portal'); }
  else if (name === 'blink') { teleportNear(m, 70, 120, m.room); later(0.25, () => { if (!m.dead) for (let k = -1; k <= 1; k++) monShoot(m, 'soul', Math.atan2(G.p.y - m.y, G.p.x - m.x) + k * 0.25, 140, 0.6); }); }
  void a0;
}

// ---------- combat ----------
function hurtMon(m, dmg, o = {}) {
  if (m.dead) return;
  m.hp -= dmg; m.flash = 0.12; m.aggro = true;
  const [cx, cy] = monCenter(m);
  if (SET.dmg) addText(cx, cy - monBodyH(m) / 2 - 4, (o.crit ? dmg + '!' : '' + dmg), o.dot ? '#9be04a' : o.crit ? '#ffd23a' : '#ffffff', o.crit);
  if (!o.dot) {
    burst(cx, cy, o.crit ? 10 : 5, m.d.art === 'slime' ? '#5cc46e' : m.d.art === 'human' && (m.d.look.skull) ? '#efe4cc' : '#d8454a', 50);
    if (o.kb) { const a = Math.atan2(m.y - G.p.y, m.x - G.p.x); const res = m.boss ? 0.15 : m.d.scale >= 1.5 ? 0.45 : 1; m.kbx += Math.cos(a) * 150 * o.kb * res; m.kby += Math.sin(a) * 150 * o.kb * res; }
    if (o.slow) m.slowT = 2.5; if (o.poison) m.poisonT = 4;
    Sfx.play(o.crit ? 'crit' : 'hit');
    if (o.crit) shake(2);
  }
  if (m.hp <= 0) killMon(m);
}
function dropItem(id, n, x, y) { const a = rand(0, TAU), s = rand(20, 55); G.picks.push({ kind: 'item', id, n, x, y, z: 4, vz: rand(60, 100), vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0 }); }
function dropCoins(total, x, y) { if (total <= 0) return; const n = Math.min(8, total); let left = total; for (let i = 0; i < n; i++) { const v = i === n - 1 ? left : Math.max(1, Math.floor(total / n)); left -= v; const a = rand(0, TAU), s = rand(20, 60); G.picks.push({ kind: 'coin', value: v, x, y, z: 4, vz: rand(60, 110), vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0 }); if (left <= 0) break; } }
function killMon(m) {
  m.dead = true; const d = m.d; G.save.stats.kills++;
  const [cx, cy] = monCenter(m);
  burst(cx, cy, m.boss ? 60 : 16, d.art === 'slime' ? '#5cc46e' : '#efe4cc', m.boss ? 140 : 70);
  Sfx.play('kill');
  if (!m.summoned || chance(0.5)) {
    dropCoins(randi(d.coins[0], d.coins[1]), m.x, m.y);
    for (const [id, c] of d.drops || []) if (chance(c)) dropItem(id, 1, m.x, m.y);
    if (chance(0.04)) dropItem('potion', 1, m.x, m.y);
  }
  gainXp(m.summoned ? Math.ceil(d.xp / 3) : d.xp);
  if (m.boss) {
    const def = G.area.def; G.bossMon = null; shake(8);
    UI.toast(`${d.name.toUpperCase()} DEFEATED!`, 'gold big'); Sfx.play('level');
    G.save.stats.bosses[def.id] = true;
    for (const c of G.area.chests) c.locked = false;
    for (const o of G.mons) if (o.summoned && !o.dead) { o.dead = true; burst(o.x, o.y - 8, 10, '#b878ea', 40); }
    G.area.portals.push({ x: G.area.boss.cx * 16 + 8, y: (G.area.boss.cy + 3) * 16, kind: 'exit' });
    UI.toast('The golden chest is unlocked. A portal home opened.', 'good');
    if (DUNGEONS.every((x) => G.save.stats.bosses[x.id])) setTimeout(() => UI.toast('ALL SIX DUNGEONS CONQUERED. You are a legend of Emberfall!', 'gold big'), 1500);
    saveGame();
  }
}
function hurtPlayer(dmg, sx, sy, o = {}) {
  const p = G.p; if (G.dead || p.hp <= 0) return;
  if (p.dodgeT > 0 && !o.hazard) { if (G.time - G.dodgeTxtT > 0.4) { G.dodgeTxtT = G.time; addText(p.x, p.y - 24, 'DODGE', '#9fd0f0'); } return; }
  if (p.hurtCd > 0) return;
  if (p.blocking && !o.hazard) {
    const sh = shieldDef(); const toSrc = Math.atan2(sy - p.y, sx - p.x);
    if (Math.abs(angDiff(p.aim, toSrc)) < 1.8) {
      if (G.time - p.blockStart <= (sh.parry || 0.2)) {
        Sfx.play('parry'); addText(p.x, p.y - 26, 'PARRY!', '#ffd23a', true); burst(p.x + Math.cos(p.aim) * 10, p.y - 10 + Math.sin(p.aim) * 10, 14, '#ffd23a', 80);
        if (o.src && !o.src.dead) { o.src.stun = o.src.boss ? 0.6 : 1.4; o.src.wind = 0; o.src.act = null; }
        p.sta = Math.min(p.maxSta, p.sta + 10); p.hurtCd = 0.25; return;
      }
      const cost = 10 + dmg * 0.6;
      if (p.sta >= cost) { p.sta -= cost; dmg *= 1 - sh.block; Sfx.play('block'); addText(p.x, p.y - 24, 'BLOCK', '#cdc4b4'); p.staDelay = 0.6; }
      else { p.sta = 0; p.blockLock = 1.2; p.blocking = false; addText(p.x, p.y - 24, 'GUARD BREAK', '#ff8a8a'); Sfx.play('error'); }
    }
  }
  const def = defense(); dmg = Math.max(1, Math.round(dmg * (1 - def / (def + 30))));
  p.hp -= dmg; p.hurtCd = 0.4; p.hurtT = 0.25;
  const a = Math.atan2(p.y - sy, p.x - sx); if (!o.hazard) { p.kbx += Math.cos(a) * 130; p.kby += Math.sin(a) * 130; }
  addText(p.x, p.y - 24, '-' + dmg, '#ff5a5a'); shake(3); Sfx.play('hurt'); burst(p.x, p.y - 10, 6, '#d8454a', 50);
  UI.hudDirty();
  if (p.hp <= 0) playerDie();
}
function playerDie() {
  const p = G.p; p.hp = 0; G.dead = true; Sfx.play('death');
  const lost = Math.floor(S().coins * 0.1); S().coins -= lost; G.save.stats.deaths++;
  burst(p.x, p.y - 10, 40, '#d8454a', 90);
  G.bossMon = null;
  setTimeout(() => UI.showDeath(lost), 700);
}
function playerAttack() {
  const p = G.p, w = weaponDef(), mult = dmgMultFor(S().level);
  p.atkCd = w.cd; p.atkT = 0.2; p.swing = -p.swing || 1;
  const roll = () => { const crit = chance(0.12); return [Math.max(1, Math.round(w.dmg * mult * rand(0.9, 1.1) * (crit ? 1.8 : 1))), crit]; };
  const hx = p.x + Math.cos(p.aim) * 6, hy = p.y - 10 + Math.sin(p.aim) * 6;
  if (w.wc === 'melee') {
    Sfx.play('swing');
    G.fx.push({ kind: 'slash', x: p.x, y: p.y - 10, ang: p.aim, range: w.range, arc: (w.arc * Math.PI) / 180, life: 0.16, max: 0.16, col: w.id === 'runeblade' ? '#5ff0ff' : w.id === 'soul_scythe' ? '#b878ea' : w.id === 'venom_dagger' ? '#9be04a' : '#ffffff' });
    let hits = 0;
    for (const m of G.mons) {
      if (m.dead) continue; const [cx, cy] = monCenter(m); const dx = cx - p.x, dy = cy - (p.y - 10), dd = Math.hypot(dx, dy), rad = m.w / 2 + 4;
      if (dd > w.range + rad) continue;
      if (dd > rad + 4 && Math.abs(angDiff(p.aim, Math.atan2(dy, dx))) > (w.arc * Math.PI) / 360) continue;
      const [dmg, crit] = roll(); hurtMon(m, dmg, { kb: w.kb || 1, crit, poison: w.poison, slow: w.slow }); hits++;
      if (w.lifesteal) { const h = Math.max(1, Math.round(dmg * w.lifesteal)); p.hp = Math.min(maxHpFor(S().level), p.hp + h); }
    }
    if (hits) UI.hudDirty();
  } else if (w.wc === 'bow') {
    Sfx.play('shoot'); const [dmg, crit] = roll();
    fireProj({ x: hx, y: hy, vx: Math.cos(p.aim) * w.speed, vy: Math.sin(p.aim) * w.speed, dmg, crit, from: 'p', kind: w.slow ? 'frost' : 'arrow', slow: w.slow, life: 1.4, pierce: w.slow ? 1 : 0 });
  } else {
    Sfx.play('magic'); const [dmg, crit] = roll();
    fireProj({ x: hx, y: hy, vx: Math.cos(p.aim) * w.speed, vy: Math.sin(p.aim) * w.speed, dmg, crit, from: 'p', kind: 'pfire', aoe: w.aoe, life: 1.4, r: 4 });
  }
}
function explode(x, y, r, dmg, crit) {
  G.fx.push({ kind: 'ring', x, y: y + 10, r0: 4, r1: r, life: 0.3, max: 0.3, col: '#ffb03a' }); burst(x, y, 18, '#ff7a2a', 90); Sfx.play('explode'); shake(2);
  for (const m of G.mons) { if (m.dead) continue; const [cx, cy] = monCenter(m); if (dist(cx, cy, x, y) <= r + m.w / 2) hurtMon(m, dmg, { kb: 0.6, crit }); }
}
function updateProjs(dt) {
  const map = G.area.map, p = G.p;
  for (const b of G.projs) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.kind === 'fire' || b.kind === 'pfire' || b.kind === 'soul') if (chance(0.5)) G.parts.push({ x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.25, max: 0.25, col: b.kind === 'soul' ? '#7ff8ff' : '#ffb03a', size: 1, grav: 0 });
    if (solidAt(map, Math.floor(b.x / 16), Math.floor((b.y + 8) / 16))) { b.life = 0; if (b.aoe) explode(b.x, b.y, b.aoe, b.dmg, b.crit); else burst(b.x, b.y, 4, '#cdc4b4', 30); continue; }
    if (b.from === 'm') {
      if (!G.dead && dist(b.x, b.y, p.x, p.y - 10) < b.r + 6) {
        b.life = 0;
        if (b.kind === 'web' && p.dodgeT <= 0) { p.webT = 1.6; addText(p.x, p.y - 30, 'WEBBED', '#efe4cc'); }
        hurtPlayer(b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05, { src: b.src });
      }
    } else {
      for (const m of G.mons) {
        if (m.dead || b.hit.includes(m)) continue; const [cx, cy] = monCenter(m);
        if (dist(b.x, b.y, cx, cy) < b.r + m.w / 2 + 3) {
          if (b.aoe) { b.life = 0; explode(b.x, b.y, b.aoe, b.dmg, b.crit); break; }
          hurtMon(m, b.dmg, { kb: 0.5, crit: b.crit, slow: b.slow }); b.hit.push(m);
          if (b.pierce-- <= 0) { b.life = 0; break; }
        }
      }
    }
  }
  G.projs = G.projs.filter((b) => b.life > 0);
}
function updatePicks(dt) {
  const p = G.p;
  for (const k of G.picks) {
    k.t += dt;
    if (k.z > 0 || k.vz > 0) { k.vz -= 300 * dt; k.z += k.vz * dt; if (k.z <= 0) { k.z = 0; k.vz = k.vz < -40 ? -k.vz * 0.35 : 0; } const e = { x: k.x, y: k.y, w: 4, h: 4 }; moveEntity(e, k.vx * dt, k.vy * dt, false); k.x = e.x; k.y = e.y; k.vx *= 0.92; k.vy *= 0.92; }
    if (G.dead || k.t < 0.35) continue;
    const dd = dist(k.x, k.y, p.x, p.y - 4), mag = k.kind === 'coin' ? 52 : k.blocked ? 0 : 38;
    if (dd < mag && dd > 1) { const s = (1 - dd / mag) * 260 + 60; k.x += ((p.x - k.x) / dd) * s * dt; k.y += ((p.y - 4 - k.y) / dd) * s * dt; }
    if (dd < 10) {
      if (k.kind === 'coin') { gainCoins(k.value); k.done = true; Sfx.play('coin'); if (k.value >= 5) addText(p.x, p.y - 26, '+' + k.value, '#ffe08a'); }
      else { const left = invAdd(k.id, k.n); if (left < k.n) { addText(p.x, p.y - 30, '+' + ITEMS[k.id].name, RCOL[ITEMS[k.id].rarity]); Sfx.play('pickup'); }
        if (left === 0) k.done = true; else { k.n = left; k.blocked = true; if (G.time - G.invFullT > 3) { G.invFullT = G.time; UI.toast('Bag is full! Sell loot at a shop.', 'bad'); } } }
    } else if (k.blocked && dd > 30) k.blocked = false;
  }
  G.picks = G.picks.filter((k) => !k.done);
}
function openChest(c) {
  if (c.open) return;
  if (c.locked) { UI.toast('Locked. Defeat the boss first!', 'bad'); Sfx.play('error'); return; }
  c.open = true; G.save.stats.chests++; Sfx.play('chest'); burst(c.x, c.y - 10, 20, '#f2c13a', 70);
  const tier = G.area.def.tier;
  if (c.kind === 'gold') {
    const L = BOSS_LOOT[tier]; dropCoins(randi(L.coins[0], L.coins[1]), c.x, c.y + 6);
    for (const id of L.items) dropItem(id, 1, c.x, c.y + 6);
    dropItem(pick(L.pick), 1, c.x, c.y + 6);
    dropItem(tier >= 5 ? 'elixir' : tier >= 3 ? 'big_potion' : 'potion', 2, c.x, c.y + 6);
    UI.toast('Boss treasure!', 'gold');
  } else {
    dropCoins(randi(tier * 10, tier * 28), c.x, c.y + 6);
    const n = chance(0.4) ? 2 : 1; for (let i = 0; i < n; i++) { const id = weighted(CHEST_LOOT[tier]); dropItem(id, STACKS(ITEMS[id]) && ITEMS[id].type === 'loot' ? randi(1, 3) : 1, c.x, c.y + 6); }
  }
  saveGame();
}

// ---------- areas ----------
function later(sec, fn) { G.later.push({ t: G.time + sec, fn }); }
function resetEntities() { G.later = []; G.mons = []; G.projs = []; G.picks = []; G.parts = []; G.texts = []; G.fx = []; G.bossMon = null; }
function enterOverworld(x, y) {
  resetEntities();
  G.area = { kind: 'overworld', map: WORLD.map, props: WORLD.props, npcs: WORLD.npcs, entrances: WORLD.entrances, zones: WORLD.zones, chests: [], torches: [], traps: [], decos: [], portals: [], def: null, name: 'Emberfall Vale' };
  WORLD.map.flowKey = -1;
  const p = G.p; p.x = x; p.y = y; p.kbx = p.kby = 0;
  for (const z of WORLD.zones) for (let i = 0; i < z.max; i++) zoneSpawn(z, true);
  snapCam(); UI.areaChanged();
}
function zoneSpawn(z, initial) {
  const map = G.area.map;
  for (let k = 0; k < 20; k++) {
    const tx = randi(z.x0, z.x1), ty = randi(z.y0, z.y1);
    if (solidAt(map, tx, ty) || inTown(tx, ty)) continue;
    const x = tx * 16 + 8, y = ty * 16 + 10; if (dist(x, y, G.p.x, G.p.y) < (initial ? 140 : 200)) continue;
    spawnMon(weighted(z.types), x, y, { zone: z }); return;
  }
}
function enterDungeon(def) {
  const D = buildDungeon(def); resetEntities();
  G.area = Object.assign({ kind: 'dungeon', npcs: [], entrances: [], zones: [], portals: [{ x: D.exit.x, y: D.exit.y, kind: 'exit' }], name: def.name }, D);
  for (const s of D.spawns) spawnMon(s.type, s.x, s.y, { room: s.room });
  const p = G.p; p.x = D.entry.x; p.y = D.entry.y; p.kbx = p.kby = 0;
  snapCam(); UI.areaChanged(); Sfx.play('portal');
  UI.toast(`${def.name}`, 'gold big');
  UI.toast(G.save.stats.bosses[def.id] ? 'Cleared before. The boss is back for revenge.' : `Find the boss: the ${MON[def.boss].name}`);
}
function tryEnter(def) {
  if (S().level < def.lvl) { UI.toast(`${def.name} requires level ${def.lvl}. You are level ${S().level}.`, 'bad'); Sfx.play('error'); return false; }
  saveGame(); enterDungeon(def); return true;
}
function leaveDungeon(toTown) {
  const def = G.area.def; const e = WORLD.entrances.find((x) => x.d === def);
  if (toTown || !e) enterOverworld(WORLD.spawn.x, WORLD.spawn.y); else enterOverworld(e.x, e.y + 14);
  Sfx.play('portal'); saveGame();
}
function respawn() {
  G.dead = false; const p = G.p; p.hp = maxHpFor(S().level); p.sta = p.maxSta;
  enterOverworld(WORLD.spawn.x, WORLD.spawn.y); saveGame();
}
function makeRuntimePlayer() {
  const P = S();
  return { x: P.x || WORLD.spawn.x, y: P.y || WORLD.spawn.y, w: 9, h: 6, face: 1, aim: 0, walk: 0, moving: false, hp: clamp(P.hp || maxHpFor(P.level), 1, maxHpFor(P.level)), sta: 100, maxSta: 100,
    atkCd: 0, atkT: 0, swing: 1, dodgeT: 0, dodgeCd: 0, dvx: 0, dvy: 0, blocking: false, blockStart: -9, blockLock: 0, hurtCd: 0, hurtT: 0, kbx: 0, kby: 0, staDelay: 0, webT: 0, burnCd: 0 };
}
