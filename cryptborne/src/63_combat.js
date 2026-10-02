
// =====================================================================
// COMBAT — attacks, damage both ways, specials, projectiles, loot.
// =====================================================================
function rollDmg(base, critBonus = 0) {
  const st = PS(), crit = chance(st.crit + critBonus);
  return [Math.max(1, Math.round(base * rand(0.9, 1.1) * (crit ? st.critMult : 1))), crit];
}
function hitEffects(o) { const st = PS(); return Object.assign({ poison: st.poison, burn: st.burn, slow: chance(st.freeze) ? 2.5 : 0 }, o); }
function hurtMon(m, dmg, o = {}) {
  if (m.dead) return;
  const p = G.p;
  if (!o.dot && p.buffs && p.buffs.smoke > 0) { dmg *= 3; p.buffs.smoke = 0; o.crit = true; statsChanged(); }
  if (m.boss && !o.dot) dmg = Math.round(dmg * PS().bossDmg);
  m.hp -= dmg; m.aggro = true; if (m.scripted) return;
  const [cx, cy] = monCenter(m);
  if (SET.dmg) addText(cx, cy - monBodyH(m) / 2 - 4, o.crit ? dmg + '!' : '' + dmg, o.dot === 'burn' ? '#ff9a3a' : o.dot ? '#9be04a' : o.crit ? '#ffd23a' : o.pet ? '#9fd0f0' : '#ffffff', o.crit);
  if (!o.dot) {
    m.flash = 0.1; m.flinch = 0.15;
    blood(cx, cy, m.d.blood || '#a3242a', o.crit ? 9 : 4);
    if (o.kb) { const a = Math.atan2(m.y - p.y, m.x - p.x); const res = m.boss ? 0.15 : (m.d.scale || 1) >= 1.5 ? 0.45 : 1; m.kbx += Math.cos(a) * 150 * o.kb * res; m.kby += Math.sin(a) * 150 * o.kb * res; }
    if (o.slow) { m.slowT = Math.max(m.slowT, o.slow); burst(cx, cy, 5, '#9fe8ff', 30); }
    if (o.poison) m.poisonT = 4; if (o.burn) m.burnT = 3;
    if (o.stun && !m.boss) { m.stun = Math.max(m.stun, o.stun); m.wind = 0; m.act = null; }
    if (o.stun && m.boss) m.stun = Math.max(m.stun, o.stun * 0.25);
    Sfx.play(o.crit ? 'crit' : 'hit', m);
    if (o.crit) { shake(2); G.hitstop = 0.035; }
    if (o.ls) { const st = PS(); if (st.lifesteal) { p.hp = Math.min(st.maxHp, p.hp + Math.max(1, dmg * st.lifesteal)); UI.hudDirty(); } }
  }
  if (m.hp <= 0) killMon(m);
}
function hurtPlayer(dmg, sx, sy, o = {}) {
  const p = G.p; if (G.dead || p.hp <= 0 || Story.active()) return;
  if ((p.dodgeT > 0 || p.dashT > 0) && !o.hazard) { if (G.time - G.dodgeTxtT > 0.4) { G.dodgeTxtT = G.time; addText(p.x, p.y - 24, 'DODGE', '#9fd0f0'); } return; }
  if (p.hurtCd > 0) return;
  const st = PS();
  if (!o.hazard && st.evade && chance(st.evade)) { addText(p.x, p.y - 24, 'MISS', '#9fd0f0'); p.hurtCd = 0.2; return; }
  if (p.blocking && !o.hazard) {
    const toSrc = Math.atan2(sy - p.y, sx - p.x);
    if (Math.abs(angDiff(p.aim, toSrc)) < 1.8) {
      if (G.time - p.blockStart <= st.parry) {
        Sfx.play('parry'); addText(p.x, p.y - 26, 'PARRY!', '#ffd23a', true); burst(p.x + Math.cos(p.aim) * 10, p.y - 10 + Math.sin(p.aim) * 10, 14, '#ffd23a', 80);
        if (o.src && !o.src.dead && o.src.d) { o.src.stun = o.src.boss ? 0.6 : 1.4; o.src.wind = 0; o.src.act = null; }
        p.sta = Math.min(p.maxSta, p.sta + 10); p.hurtCd = 0.25; G.hitstop = 0.06; return;
      }
      const cost = 10 + dmg * 0.4;
      if (p.sta >= cost) { p.sta -= cost; dmg *= 1 - st.block; Sfx.play('block'); addText(p.x, p.y - 24, 'BLOCK', '#cdc4b4'); p.staDelay = 0.6; o.eff = null; }
      else { p.sta = 0; p.blockLock = 1.2; p.blocking = false; addText(p.x, p.y - 24, 'GUARD BREAK', '#ff8a8a'); Sfx.play('error'); }
    }
  }
  dmg = Math.max(1, Math.round(dmg * (1 - st.def / (st.def + 30))));
  if (p.shieldHp > 0) { const a = Math.min(p.shieldHp, dmg); p.shieldHp -= a; dmg -= a; addText(p.x, p.y - 30, 'SHIELD', '#55a8ef'); if (dmg <= 0) { p.hurtCd = 0.3; return; } }
  p.hp -= dmg; p.hurtCd = 0.4; p.hurtT = 0.25; p.calm = 0;
  const a = Math.atan2(p.y - sy, p.x - sx); if (!o.hazard) { p.kbx += Math.cos(a) * 130; p.kby += Math.sin(a) * 130; }
  if (o.eff === 'slow') { p.slowT = 2; addText(p.x, p.y - 32, 'FROZEN', '#9fe8ff'); }
  else if (o.eff === 'poison') { p.poisonT = 4; addText(p.x, p.y - 32, 'POISONED', '#9be04a'); }
  else if (o.eff === 'web') { p.webT = 1.6; addText(p.x, p.y - 32, 'WEBBED', '#efe4cc'); }
  else if (o.eff === 'blind') p.blindT = 1.5;
  else if (o.eff === 'pull' && o.src) { const d = dist(p.x, p.y, o.src.x, o.src.y) || 1; moveEntity(p, ((o.src.x - p.x) / d) * Math.min(30, d - 14), ((o.src.y - p.y) / d) * Math.min(30, d - 14), false); }
  addText(p.x, p.y - 24, '-' + dmg, '#ff5a5a'); shake(3); Sfx.play('hurt'); blood(p.x, p.y - 10, '#a3242a', 6);
  UI.hudDirty();
  if (p.hp <= 0) playerDie();
}
function playerDie() {
  const p = G.p; p.hp = 0; G.dead = true; Sfx.play('death'); Music.set('sad');
  const lost = Math.floor(S().coins * 0.1); S().coins -= lost; G.save.stats.deaths++;
  burst(p.x, p.y - 10, 40, '#d8454a', 90);
  G.bossMon = null;
  if (DF().perma) { Store.del(G.save.id); G.save.deleted = true; }
  setTimeout(() => UI.showDeath(lost), 900);
}

// ---------- the hero's basic attack ----------
function playerAttack() {
  const p = G.p, w = weaponDef(), st = PS();
  p.atkCd = w.cd * st.cdMult; p.atkT = 0.2; p.swing = -p.swing || 1;
  const hx = p.x + Math.cos(p.aim) * 6, hy = p.y - 10 + Math.sin(p.aim) * 6;
  if (w.wc === 'melee') {
    Sfx.play(w.cd > 0.55 ? 'heavy' : 'swing');
    const col = { runeblade: '#5ff0ff', soul_scythe: '#b878ea', venom_dagger: '#9be04a', sun_scimitar: '#ffd27a', frost_axe: '#9fe8ff', shadow_blade: '#d8454a' }[w.id] || '#ffffff';
    G.fx.push({ kind: 'slash', x: p.x, y: p.y - 10, ang: p.aim, range: w.range, arc: (w.arc * Math.PI) / 180, life: 0.16, max: 0.16, col });
    for (const m of G.mons) {
      if (m.dead) continue; const [cx, cy] = monCenter(m); const dx = cx - p.x, dy = cy - (p.y - 10), dd = Math.hypot(dx, dy), rad = m.w / 2 + 4;
      if (dd > w.range + rad) continue;
      if (dd > rad + 4 && Math.abs(angDiff(p.aim, Math.atan2(dy, dx))) > (w.arc * Math.PI) / 360) continue;
      const [dmg, crit] = rollDmg(st.dmg); hurtMon(m, dmg, hitEffects({ kb: w.kb || 1, crit, ls: true }));
    }
    hitCrack(p.x + Math.cos(p.aim) * (w.range * 0.7), p.y - 6 + Math.sin(p.aim) * (w.range * 0.7), 1);
  } else if (w.wc === 'bow') {
    Sfx.play('shoot'); const [dmg, crit] = rollDmg(st.dmg);
    fireProj({ x: hx, y: hy, vx: Math.cos(p.aim) * w.speed, vy: Math.sin(p.aim) * w.speed, dmg, crit, from: 'p', kind: w.slow ? 'frost' : 'arrow', life: 1.4, pierce: w.pierce || 0 });
  } else if (w.wc === 'wand') {
    Sfx.play('magic'); const [dmg, crit] = rollDmg(st.dmg);
    fireProj({ x: hx, y: hy, vx: Math.cos(p.aim) * w.speed, vy: Math.sin(p.aim) * w.speed, dmg, crit, from: 'p', kind: w.poison ? 'pbolt_g' : 'pbolt', life: 1.2, r: 3 });
  } else {
    Sfx.play('magic'); const [dmg, crit] = rollDmg(st.dmg);
    fireProj({ x: hx, y: hy, vx: Math.cos(p.aim) * w.speed, vy: Math.sin(p.aim) * w.speed, dmg, crit, from: 'p', kind: 'pfire', aoe: w.aoe, life: 1.4, r: 4 });
  }
}
// cracked walls hide secret rooms: hit them to break through
function hitCrack(x, y, n) {
  const s = G.area.secret; if (!s || s.open) return false;
  const cx = s.tx * 16 + 8, cy = s.ty * 16 + 8; if (dist(x, y, cx, cy) > 18) return false;
  s.hp -= n; burst(cx, cy, 6, '#8a8c92', 40); Sfx.play('hit');
  if (s.hp <= 0) { s.open = true; G.area.map.block[s.ty * G.area.map.w + s.tx] = 0; G.area.map.flowKey = -1; burst(cx, cy, 24, '#8a8c92', 80); Sfx.play('slam'); shake(4); UI.toast('You broke through a cracked wall. A secret room!', 'gold'); }
  return true;
}
function explode(x, y, r, dmg, crit, opts = {}) {
  G.fx.push({ kind: 'ring', x, y: y + 10, r0: 4, r1: r, life: 0.3, max: 0.3, col: opts.col || '#ffb03a' }); burst(x, y, 18, opts.col || '#ff7a2a', 90); Sfx.play('explode'); shake(2);
  for (const m of G.mons) { if (m.dead) continue; const [cx, cy] = monCenter(m); if (dist(cx, cy, x, y) <= r + m.w / 2) hurtMon(m, dmg, hitEffects(Object.assign({ kb: 0.6, crit }, opts.fx || {}))); }
  hitCrack(x, y, 1);
}

// ---------- special attacks (R, T, G, V) ----------
const SPECIAL_KEYS = ['R', 'T', 'G', 'V'];
function aimPoint() { // where targeted specials land
  const p = G.p;
  if (Input.touchMode) { const t = nearestMon(180); return t ? [t.x, t.y - 6] : [p.x + Math.cos(p.aim) * 70, p.y + Math.sin(p.aim) * 70]; }
  const wx = Input.mx + G.cam.x, wy = Input.my + G.cam.y, d = dist(wx, wy, p.x, p.y), max = 170;
  return d > max ? [p.x + ((wx - p.x) / d) * max, p.y + ((wy - p.y) / d) * max] : [wx, wy];
}
function useSpecial(slot) {
  const p = G.p, id = S().specials[slot]; if (!id || G.dead) return;
  const sp = SPECIALS[id], st = PS();
  if (p.cds[slot] > 0) { addText(p.x, p.y - 28, Math.ceil(p.cds[slot]) + 's', '#cdc4b4'); return; }
  p.cds[slot] = sp.cd * st.cdr; p.cdMax[slot] = p.cds[slot];
  const base = st.dmg * (sp.mul || 1) * st.special, aim = p.aim;
  Sfx.play('special');
  const forEach = (fn) => { for (const m of G.mons) if (!m.dead) fn(m); };
  switch (sp.kind) {
    case 'aoe':
      G.fx.push({ kind: 'ring', x: p.x, y: p.y, r0: 6, r1: sp.r, life: 0.35, max: 0.35, col: sp.fx === 'ice' ? '#9fe8ff' : '#ffffff' });
      if (sp.fx === 'ice') { Sfx.play('freeze'); burst(p.x, p.y - 8, 30, '#c8eeff', 110); } else G.fx.push({ kind: 'spin', x: p.x, y: p.y - 10, r: sp.r, life: 0.3, max: 0.3 });
      forEach((m) => { if (dist(m.x, m.y, p.x, p.y) <= sp.r + m.w / 2) { const [d, c] = rollDmg(base); hurtMon(m, d, hitEffects({ crit: c, kb: sp.kb || 0.5, stun: sp.stun, slow: sp.slow })); } });
      hitCrack(p.x, p.y, 2); if (sp.shake) shake(sp.shake);
      break;
    case 'cone':
      G.fx.push({ kind: 'slash', x: p.x, y: p.y - 10, ang: aim, range: sp.r, arc: sp.arc * 2, life: 0.2, max: 0.2, col: '#ffd27a' }); Sfx.play('block');
      forEach((m) => { const [cx, cy] = monCenter(m); if (dist(cx, cy, p.x, p.y - 10) <= sp.r + m.w / 2 && Math.abs(angDiff(aim, Math.atan2(cy - p.y + 10, cx - p.x))) <= sp.arc) { const [d, c] = rollDmg(base); hurtMon(m, d, hitEffects({ crit: c, kb: 1.5, stun: sp.stun })); } });
      break;
    case 'buff':
      p.buffs[sp.buff] = sp.t; statsChanged();
      if (sp.buff === 'warcry') { Sfx.play('slam'); Sfx.play('bell'); shake(4); G.fx.push({ kind: 'ring', x: p.x, y: p.y, r0: 6, r1: 60, life: 0.4, max: 0.4, col: '#d8454a' }); forEach((m) => { if (dist(m.x, m.y, p.x, p.y) < 60 && !m.boss) { const a = Math.atan2(m.y - p.y, m.x - p.x); m.kbx += Math.cos(a) * 200; m.kby += Math.sin(a) * 200; } }); }
      if (sp.buff === 'smoke') { burst(p.x, p.y - 8, 40, '#6a6c72', 70); Sfx.play('dodge'); for (const m of G.mons) if (!m.boss) { m.aggro = false; m.wind = 0; } }
      if (sp.buff === 'shield') { p.shieldHp = st.maxHp * 0.5; Sfx.play('heal'); }
      if (sp.buff === 'eagle') Sfx.play('level');
      break;
    case 'heal': p.hp = Math.min(st.maxHp, p.hp + st.maxHp * sp.heal); p.sta = p.maxSta; Sfx.play('heal'); burst(p.x, p.y - 10, 24, '#7dff8a', 60); addText(p.x, p.y - 28, 'SECOND WIND', '#7dff8a'); break;
    case 'dash': p.dashT = 0.32; p.dvx = Math.cos(aim); p.dvy = Math.sin(aim); p.dashHit = []; p.dashDmg = base; p.dashKb = sp.kb; Sfx.play('dodge'); break;
    case 'volley': case 'rollshot': {
      if (sp.kind === 'rollshot') { p.dodgeT = 0.3; p.dvx = -Math.cos(aim); p.dvy = -Math.sin(aim); Sfx.play('dodge'); }
      const fire = () => { for (let i = 0; i < sp.n; i++) { const a = aim + (sp.n > 1 ? (i / (sp.n - 1) - 0.5) * sp.spread * 2 : 0); const [d, c] = rollDmg(base); fireProj({ x: p.x + Math.cos(a) * 6, y: p.y - 10 + Math.sin(a) * 6, vx: Math.cos(a) * (sp.speed || 260), vy: Math.sin(a) * (sp.speed || 260), dmg: d, crit: c, from: 'p', kind: sp.big ? 'bigarrow' : 'arrow', life: 1.5, pierce: sp.pierce || 0, r: sp.big ? 5 : 3 }); } Sfx.play('shoot'); };
      if (sp.kind === 'rollshot') later(0.2, fire); else fire();
      break;
    }
    case 'rain': {
      const [tx, ty] = aimPoint(); G.fx.push({ kind: 'target', x: tx, y: ty, r: sp.r, life: sp.delay + 1.6, max: sp.delay + 1.6, col: '#ffd27a' });
      for (let k = 0; k < sp.hits; k++) later(sp.delay + k * 0.2, () => { for (let i = 0; i < 5; i++) G.parts.push({ x: tx + rand(-sp.r, sp.r), y: ty - 60 + rand(-10, 10), vx: -20, vy: 380, life: 0.16, max: 0.16, col: '#cdc4b4', size: 1, grav: 0, streak: 1 }); Sfx.play('shoot', { x: tx, y: ty }); for (const m of G.mons) if (!m.dead && dist(m.x, m.y, tx, ty) <= sp.r + m.w / 2) { const [d, c] = rollDmg(base); hurtMon(m, d, { crit: c }); } });
      break;
    }
    case 'trap': G.traps2.push({ x: p.x, y: p.y, r: sp.r, dmg: base, t: 20, arm: 0.5 }); Sfx.play('freeze'); break;
    case 'bolt': { const [d, c] = rollDmg(base); fireProj({ x: p.x + Math.cos(aim) * 6, y: p.y - 10 + Math.sin(aim) * 6, vx: Math.cos(aim) * sp.speed, vy: Math.sin(aim) * sp.speed, dmg: d, crit: c, from: 'p', kind: 'bigfire', aoe: sp.aoe, burn: true, life: 1.6, r: 6 }); Sfx.play('magic'); break; }
    case 'chain': {
      let from = { x: p.x, y: p.y - 10 }, range = 170; const hit = [], pts = [[from.x, from.y]];
      for (let j = 0; j <= sp.jumps; j++) {
        let best = null, bd = range;
        for (const m of G.mons) { if (m.dead || hit.includes(m)) continue; const [cx, cy] = monCenter(m); const d = dist(cx, cy, from.x, from.y); if (d < bd) { bd = d; best = m; } }
        if (!best) break; hit.push(best); const [cx, cy] = monCenter(best); pts.push([cx, cy]);
        const [d, c] = rollDmg(base); hurtMon(best, d, { crit: c, stun: 0.3 }); from = { x: cx, y: cy }; range = 100;
      }
      G.fx.push({ kind: 'bolt', pts, life: 0.25, max: 0.25 }); Sfx.play('zap');
      if (!hit.length) addText(p.x, p.y - 28, 'NO TARGET', '#cdc4b4');
      break;
    }
    case 'blink': {
      const [tx, ty] = aimPoint(); const d = Math.min(sp.d, dist(tx, ty, p.x, p.y)), ux = (tx - p.x) / (dist(tx, ty, p.x, p.y) || 1), uy = (ty - p.y) / (dist(tx, ty, p.x, p.y) || 1);
      explode(p.x, p.y - 8, 34, base, false, { col: '#b878ea' });
      let bx = p.x, by = p.y; for (let s = 4; s <= d; s += 4) { const nx = p.x + ux * s, ny = p.y + uy * s; if (blockedBox(p, nx, ny, false)) break; bx = nx; by = ny; }
      burst(p.x, p.y - 10, 14, '#b878ea', 60); p.x = bx; p.y = by; p.dodgeT = 0.15; burst(bx, by - 10, 14, '#b878ea', 60); Sfx.play('portal');
      break;
    }
    case 'meteor': {
      const [tx, ty] = aimPoint(); G.fx.push({ kind: 'meteor', x: tx, y: ty, r: sp.r, life: sp.delay, max: sp.delay });
      later(sp.delay, () => { const [d, c] = rollDmg(base); explode(tx, ty - 6, sp.r, d, c, { col: '#ff7a2a', fx: { burn: true } }); shake(8); Sfx.play('slam'); });
      break;
    }
    case 'ring': for (let i = 0; i < sp.n; i++) { const a = (i / sp.n) * TAU; const [d, c] = rollDmg(base); fireProj({ x: p.x, y: p.y - 10, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, dmg: d, crit: c, from: 'p', kind: 'knife', poisonHit: true, life: 0.7 }); } Sfx.play('swing'); break;
    case 'step': {
      const t = nearestMon(160);
      if (t) { const a = Math.atan2(t.y - p.y, t.x - p.x), bx = t.x + Math.cos(a) * 14, by = t.y + Math.sin(a) * 14; burst(p.x, p.y - 10, 12, '#3a3440', 50); if (!blockedBox(p, bx, by, false)) { p.x = bx; p.y = by; } p.aim = a + Math.PI; const [d] = rollDmg(base, 1); hurtMon(t, d, hitEffects({ crit: true })); burst(p.x, p.y - 10, 12, '#3a3440', 50); }
      else { const [tx, ty] = aimPoint(); const d = dist(tx, ty, p.x, p.y) || 1; const nx = p.x + ((tx - p.x) / d) * Math.min(80, d), ny = p.y + ((ty - p.y) / d) * Math.min(80, d); if (!blockedBox(p, nx, ny, false)) { p.x = nx; p.y = ny; } }
      p.dodgeT = 0.15; Sfx.play('dodge');
      break;
    }
    case 'cloud': { const [tx, ty] = aimPoint(); G.clouds.push({ x: tx, y: ty, r: sp.r, t: sp.t, tick: 0, dmg: base }); Sfx.play('magic'); break; }
    case 'flurry':
      for (let k = 0; k < sp.hits; k++) later(k * 0.1, () => { G.fx.push({ kind: 'slash', x: p.x, y: p.y - 10, ang: p.aim + rand(-0.4, 0.4), range: sp.r, arc: 1.2, life: 0.1, max: 0.1, col: '#ffffff' }); Sfx.play('swing'); forEach((m) => { const [cx, cy] = monCenter(m); if (dist(cx, cy, p.x, p.y - 10) <= sp.r + m.w / 2 && Math.abs(angDiff(p.aim, Math.atan2(cy - p.y + 10, cx - p.x))) <= sp.arc) { const [d, c] = rollDmg(base); hurtMon(m, d, hitEffects({ crit: c })); } }); });
      break;
    case 'assassinate': {
      const t = nearestMon(200); if (!t) { addText(p.x, p.y - 28, 'NO TARGET', '#cdc4b4'); p.cds[slot] = 1; break; }
      const a = Math.atan2(t.y - p.y, t.x - p.x), bx = t.x - Math.cos(a) * 14, by = t.y - Math.sin(a) * 14;
      if (!blockedBox(p, bx, by, false)) { p.x = bx; p.y = by; } p.aim = a; p.dodgeT = 0.2;
      const [d] = rollDmg(base * (t.boss ? 0.5 : 1), 1); hurtMon(t, d, hitEffects({ crit: true })); G.hitstop = 0.1; shake(5); Sfx.play('crit');
      break;
    }
  }
}
// ---------- projectiles, traps, clouds ----------
function updateProjs(dt) {
  const map = G.area.map, p = G.p;
  for (const b of G.projs) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (['fire', 'pfire', 'soul', 'bigfire', 'poison', 'shadow', 'ice', 'pbolt', 'pbolt_g'].includes(b.kind) && chance(0.5)) G.parts.push({ x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.25, max: 0.25, col: PROJ_COL[b.kind] || '#ffb03a', size: 1, grav: 0 });
    const tx = Math.floor(b.x / 16), ty = Math.floor((b.y + 8) / 16);
    if (solidAt(map, tx, ty)) {
      b.life = 0;
      if (b.from === 'p') hitCrack(b.x, b.y + 8, 1);
      if (b.aoe) explode(b.x, b.y, b.aoe, b.dmg, b.crit, { fx: { burn: b.burn } }); else burst(b.x, b.y, 4, '#cdc4b4', 30);
      continue;
    }
    if (b.from === 'm') {
      if (!G.dead && dist(b.x, b.y, p.x, p.y - 10) < b.r + 6) { b.life = 0; hurtPlayer(b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05, { src: b.src, eff: b.eff }); }
    } else {
      for (const m of G.mons) {
        if (m.dead || b.hit.includes(m)) continue; const [cx, cy] = monCenter(m);
        if (dist(b.x, b.y, cx, cy) < b.r + m.w / 2 + 3) {
          if (b.aoe) { b.life = 0; explode(b.x, b.y, b.aoe, b.dmg, b.crit, { fx: { burn: b.burn } }); break; }
          hurtMon(m, b.dmg, b.pet ? { pet: true, burn: b.burn } : hitEffects({ kb: 0.5, crit: b.crit, poison: b.poisonHit || PS().poison, slow: b.kind === 'frost' ? 2.5 : chance(PS().freeze) ? 2.5 : 0 })); b.hit.push(m);
          if (b.pierce-- <= 0) { b.life = 0; break; }
        }
      }
    }
  }
  G.projs = G.projs.filter((b) => b.life > 0);
  for (const t of G.traps2) {
    t.t -= dt; t.arm -= dt; if (t.arm > 0) continue;
    for (const m of G.mons) if (!m.dead && dist(m.x, m.y, t.x, t.y) < t.r * 0.5) {
      t.t = 0; G.fx.push({ kind: 'ring', x: t.x, y: t.y, r0: 4, r1: t.r, life: 0.35, max: 0.35, col: '#9fe8ff' }); Sfx.play('freeze', t); burst(t.x, t.y - 6, 26, '#c8eeff', 90);
      for (const o of G.mons) if (!o.dead && dist(o.x, o.y, t.x, t.y) <= t.r) { const [d, c] = rollDmg(t.dmg); hurtMon(o, d, { crit: c, slow: 3.5 }); }
      break;
    }
  }
  G.traps2 = G.traps2.filter((t) => t.t > 0);
  for (const c of G.clouds) {
    c.t -= dt; c.tick -= dt; if (chance(0.6)) G.parts.push({ x: c.x + rand(-c.r, c.r) * 0.8, y: c.y + rand(-c.r, c.r) * 0.5, vx: rand(-6, 6), vy: -8, life: 0.8, max: 0.8, col: '#7be06a', size: 2, grav: 0 });
    if (c.tick <= 0) { c.tick = 0.5; for (const m of G.mons) if (!m.dead && dist(m.x, m.y, c.x, c.y) <= c.r + m.w / 2) hurtMon(m, Math.max(1, Math.round(c.dmg)), { dot: 'poison' }); }
  }
  G.clouds = G.clouds.filter((c) => c.t > 0);
}
const PROJ_COL = { fire: '#ffb03a', pfire: '#ffb03a', bigfire: '#ff7a2a', soul: '#7ff8ff', poison: '#9be04a', shadow: '#b878ea', ice: '#c8eeff', pbolt: '#9fd0ff', pbolt_g: '#9be04a', sand: '#e8c87a' };

// ---------- loot ----------
function dropItem(id, n, x, y, g) { const a = rand(0, TAU), s = rand(20, 55); G.picks.push({ kind: 'item', id, n, g, x, y, z: 4, vz: rand(60, 100), vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0 }); }
function dropCoins(total, x, y) { if (total <= 0) return; const n = Math.min(8, total); let left = total; for (let i = 0; i < n; i++) { const v = i === n - 1 ? left : Math.max(1, Math.floor(total / n)); left -= v; const a = rand(0, TAU), s = rand(20, 60); G.picks.push({ kind: 'coin', value: v, x, y, z: 4, vz: rand(60, 110), vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0 }); if (left <= 0) break; } }
function updatePicks(dt) {
  const p = G.p, slime = G.pet && G.pet.id === 'slime';
  for (const k of G.picks) {
    k.t += dt;
    if (k.z > 0 || k.vz > 0) { k.vz -= 300 * dt; k.z += k.vz * dt; if (k.z <= 0) { k.z = 0; k.vz = k.vz < -40 ? -k.vz * 0.35 : 0; } const e = { x: k.x, y: k.y, w: 4, h: 4 }; moveEntity(e, k.vx * dt, k.vy * dt, false); k.x = e.x; k.y = e.y; k.vx *= 0.92; k.vy *= 0.92; }
    if (G.dead || k.t < 0.35) continue;
    const dd = dist(k.x, k.y, p.x, p.y - 4), mag = (k.kind === 'coin' || k.kind === 'key' ? 52 : k.blocked ? 0 : 38) * (slime ? 2.2 : 1);
    if (dd < mag && dd > 1) { const s = (1 - dd / mag) * 260 + 60; k.x += ((p.x - k.x) / dd) * s * dt; k.y += ((p.y - 4 - k.y) / dd) * s * dt; }
    if (dd < 10) {
      if (k.kind === 'coin') { gainCoins(k.value); k.done = true; Sfx.play('coin'); if (k.value >= 5) addText(p.x, p.y - 26, '+' + k.value, '#ffe08a'); }
      else if (k.kind === 'key') { G.run.key = true; k.done = true; Sfx.play('unlock'); addText(p.x, p.y - 30, 'BOSS KEY', '#f2c13a', true); UI.toast('You have the boss key. Find the locked door!', 'gold'); }
      else {
        const left = invAdd(k.id, k.n, k.g); if (left < k.n) { addText(p.x, p.y - 30, '+' + ITEMS[k.id].name, RCOL[ITEMS[k.id].rarity]); Sfx.play('pickup'); }
        if (left === 0) k.done = true; else { k.n = left; k.blocked = true; if (G.time - G.invFullT > 3) { G.invFullT = G.time; UI.toast('Bag is full! Sell loot at a shop.', 'bad'); } }
      }
    } else if (k.blocked && dd > 30) k.blocked = false;
  }
  G.picks = G.picks.filter((k) => !k.done);
}
function openChest(c) {
  if (c.open) return;
  if (c.locked) { UI.toast('Locked. Defeat the boss first!', 'bad'); Sfx.play('error'); return; }
  c.open = true; G.save.stats.chests++; Sfx.play('chest'); burst(c.x, c.y - 10, 20, '#f2c13a', 70);
  const def = G.area.def, tier = def.tier, st = PS(), at = (fn) => fn(c.x, c.y + 6);
  if (c.kind === 'gold') {
    const L = def.secret ? BOSS_LOOT.mirror : BOSS_LOOT[tier]; at((x, y) => dropCoins(Math.round(randi(L.coins[0], L.coins[1]) * st.coins), x, y));
    for (const id of L.items) at((x, y) => dropItem(id, 1, x, y));
    at((x, y) => dropItem(pick(L.pick), 1, x, y));
    at((x, y) => dropItem(tier >= 7 ? 'super_potion' : tier >= 5 ? 'elixir' : tier >= 3 ? 'big_potion' : 'potion', 2, x, y));
    UI.toast('Boss treasure!', 'gold');
  } else {
    const t2 = c.rich ? Math.min(10, tier + 1) : tier;
    at((x, y) => dropCoins(Math.round(randi(tier * 10, tier * 28) * (c.rich ? 2 : 1) * st.coins), x, y));
    const n = c.rich ? 3 : chance(0.4) ? 2 : 1;
    for (let i = 0; i < n; i++) { const id = weighted(CHEST_LOOT[t2]); at((x, y) => dropItem(id, STACKS(ITEMS[id]) && ITEMS[id].type === 'loot' ? randi(1, 3) : 1, x, y)); }
    if (c.rich) at((x, y) => dropItem(pick(['ruby', 'emerald', 'sapphire', 'topaz', 'pearl', 'onyx']), 1, x, y));
  }
  saveGame(true);
}
