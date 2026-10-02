
// =====================================================================
// THE HERO — movement, footsteps, hazards, and the per-frame world tick.
// =====================================================================
function updatePlayer(dt) {
  const p = G.p; if (G.dead) return;
  const st = PS(), A = G.area, map = A.map;
  p.atkCd -= dt; p.atkT = Math.max(0, p.atkT - dt); p.castT = Math.max(0, (p.castT || 0) - dt); p.dodgeCd -= dt; p.hurtCd -= dt; p.hurtT = Math.max(0, p.hurtT - dt);
  p.blockLock -= dt; p.staDelay -= dt; p.webT -= dt; p.slowT -= dt; p.blindT -= dt; p.burnCd -= dt; p.calm += dt;
  for (let i = 0; i < 4; i++) p.cds[i] = Math.max(0, p.cds[i] - dt);
  for (const k in p.buffs) if (p.buffs[k] > 0) { p.buffs[k] -= dt; if (p.buffs[k] <= 0) { p.buffs[k] = 0; statsChanged(); if (k === 'shield') p.shieldHp = 0; } }
  if (p.poisonT > 0) { p.poisonT -= dt; p.poisonAcc += dt; if (p.poisonAcc >= 0.5) { p.poisonAcc = 0; const d = Math.max(1, Math.round(st.maxHp * 0.015)); p.hp -= d; addText(p.x, p.y - 24, '-' + d, '#9be04a'); UI.hudDirty(); if (p.hp <= 0) { playerDie(); return; } } }
  let mx = 0, my = 0;
  if (Input.down('a') || Input.down('arrowleft')) mx -= 1; if (Input.down('d') || Input.down('arrowright')) mx += 1;
  if (Input.down('w') || Input.down('arrowup')) my -= 1; if (Input.down('s') || Input.down('arrowdown')) my += 1;
  if (Input.stick.on) { mx = Input.stick.x; my = Input.stick.y; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  if (Input.touchMode) { const t = nearestMon(150); if (t) { const [cx, cy] = monCenter(t); p.aim = Math.atan2(cy - (p.y - 10), cx - p.x); } else if (ml > 0.2) p.aim = Math.atan2(my, mx); }
  else p.aim = Math.atan2(Input.my + G.cam.y - (p.y - 10), Input.mx + G.cam.x - p.x);
  p.face = Math.cos(p.aim) < 0 ? -1 : 1;
  // block (F) needs a shield
  const want = Input.down('f') || Input.tBlock, tap = Input.take('blockTap');
  if (want && !shieldDef() && !p.noShieldMsg) { p.noShieldMsg = true; UI.toast('You need a shield to block! Brom sells them at the forge.', 'bad'); Sfx.play('error'); }
  if (!want) p.noShieldMsg = false;
  const blk = !!(want && shieldDef() && p.blockLock <= 0 && p.dodgeT <= 0 && p.dashT <= 0);
  if (blk && (!p.blocking || tap)) p.blockStart = G.time;
  p.blocking = blk;
  // dodge roll (C)
  if (Input.take('dodge')) {
    if (p.dodgeT <= 0 && p.dodgeCd <= 0 && p.sta >= st.dodgeCost && p.dashT <= 0) {
      const dl = Math.hypot(mx, my); p.dvx = dl > 0.1 ? mx / dl : Math.cos(p.aim); p.dvy = dl > 0.1 ? my / dl : Math.sin(p.aim);
      p.dodgeT = 0.3; p.dodgeCd = 0.55; p.sta -= st.dodgeCost; p.staDelay = 0.5; p.blocking = false; Sfx.play('dodge'); for (let i = 0; i < 7; i++) G.parts.push({ x: p.x + rand(-4, 4), y: p.y - rand(0, 3), vx: -p.dvx * rand(20, 50) + rand(-15, 15), vy: rand(-18, -4), life: rand(0.3, 0.5), max: 0.5, col: '#d8ccb0', size: 2, grav: 0 });
    } else if (p.sta < st.dodgeCost && p.dodgeT <= 0) addText(p.x, p.y - 26, 'TOO TIRED', '#e9d35a');
  }
  const tile = tileAt(map, Math.floor(p.x / 16), Math.floor(p.y / 16));
  let spd = st.speed * (SPEED_T[tile] || 1) * Weather.slow();
  if (p.blocking) spd *= 0.45; if (p.atkT > 0 && weaponDef().wc === 'melee') spd *= 0.75; if (p.webT > 0) spd *= 0.4; if (p.slowT > 0) spd *= 0.55;
  const ox = p.x, oy = p.y;
  if (p.dashT > 0) {
    p.dashT -= dt; moveEntity(p, p.dvx * 320 * dt, p.dvy * 320 * dt, false); p.moving = true; p.walk += dt * 18;
    for (const m of G.mons) if (!m.dead && !p.dashHit.includes(m) && dist(m.x, m.y, p.x, p.y) < m.w / 2 + 12) { p.dashHit.push(m); const [d, c] = rollDmg(p.dashDmg); hurtMon(m, d, hitEffects({ crit: c, kb: p.dashKb || 1.5 })); }
    if (chance(0.7)) G.parts.push({ x: p.x + rand(-3, 3), y: p.y - rand(0, 14), vx: -p.dvx * 30, vy: -p.dvy * 30, life: 0.25, max: 0.25, col: '#f2e6c8', size: 1, grav: 0 });
  } else if (p.dodgeT > 0) {
    p.dodgeT -= dt; moveEntity(p, p.dvx * 215 * dt, p.dvy * 215 * dt, false); p.moving = true; p.walk += dt * 16;
    if (chance(0.6)) G.parts.push({ x: p.x + rand(-4, 4), y: p.y - rand(0, 2), vx: -p.dvx * 25, vy: rand(-12, -3), life: 0.35, max: 0.35, col: '#d8ccb0', size: 2, grav: 0 });
  } else if (tile === T.ICE) { // slippery
    p.vx += (mx * spd - p.vx) * Math.min(1, dt * 1.6); p.vy += (my * spd - p.vy) * Math.min(1, dt * 1.6);
    if (moveEntity(p, p.vx * dt, p.vy * dt, false)) { p.vx *= 0.3; p.vy *= 0.3; }
    p.moving = Math.hypot(p.vx, p.vy) > 8; if (p.moving) p.walk += dt * 9;
  } else if (ml > 0.05) { p.vx = mx * spd; p.vy = my * spd; moveEntity(p, mx * spd * dt, my * spd * dt, false); p.moving = true; p.walk += dt * 10 * (spd / 80); }
  else { p.moving = false; p.vx = p.vy = 0; }
  if (p.kbx || p.kby) { moveEntity(p, p.kbx * dt, p.kby * dt, false); const k = Math.pow(0.002, dt); p.kbx *= k; p.kby *= k; if (Math.abs(p.kbx) + Math.abs(p.kby) < 4) p.kbx = p.kby = 0; }
  // footsteps
  p.stepT += dist(ox, oy, p.x, p.y);
  if (p.stepT > 15) {
    p.stepT = 0; let surf = SURFACE[tile] || 'stone'; if (A.kind === 'dungeon' && A.def.theme.planks && tile === T.FLOOR) surf = 'wood';
    Sfx.play('st_' + surf, { vol: 0.9 });
    if (surf === 'water') { G.fx.push({ kind: 'ripple', x: p.x, y: p.y, life: 0.6, max: 0.6 }); for (let i = 0; i < 4; i++) G.parts.push({ x: p.x + rand(-4, 4), y: p.y - 2, vx: rand(-30, 30), vy: rand(-60, -30), life: 0.35, max: 0.35, col: tile === T.BOG ? '#6a8a3a' : '#bfe4ff', size: 1, grav: 260 }); }
    else if (surf !== 'water') { const dc = { grass: '#c8d8a0', stone: '#cfc6b4', wood: '#c8a878', mud: '#8a7a5a' }[surf] || '#d8ccb0'; G.parts.push({ x: p.x + rand(-2, 2), y: p.y - 1, vx: -p.vx * 0.08 + rand(-6, 6), vy: rand(-10, -4), life: 0.32, max: 0.32, col: dc, size: 2, grav: 0 }); }
    if (surf === 'snow' || surf === 'sand') for (let i = 0; i < 2; i++) G.parts.push({ x: p.x + rand(-3, 3), y: p.y, vx: rand(-12, 12), vy: rand(-18, -6), life: 0.35, max: 0.35, col: surf === 'snow' ? '#ffffff' : '#e8d4a0', size: 1, grav: 60 });
  }
  if (!p.blocking && p.dodgeT <= 0 && p.staDelay <= 0) p.sta = Math.min(p.maxSta, p.sta + 34 * dt);
  if ((Input.mouseDown || Input.tAtk) && p.atkCd <= 0 && p.dodgeT <= 0 && p.dashT <= 0 && !p.blocking) playerAttack();
  // hazards
  const tier = areaTier();
  if (tile === T.LAVA && p.dodgeT <= 0 && p.burnCd <= 0) { p.burnCd = 0.5; hurtPlayer(6 + tier * 4, p.x, p.y, { hazard: true }); burst(p.x, p.y - 4, 6, '#ff7a2a', 40); }
  if (tile === T.BOG && p.dodgeT <= 0) p.poisonT = Math.max(p.poisonT, 1.1);
  for (const t of A.traps) { t.cd -= dt; if (t.cd <= 0 && spikeUp(t) && p.dodgeT <= 0 && Math.abs(p.x - t.x) < 9 && Math.abs(p.y - 2 - t.y) < 9) { t.cd = 0.9; hurtPlayer(8 + tier * 5, p.x, p.y, { hazard: true }); } }
  // healing: fountain, armor/skills, and slow rest out of combat
  const mxh = st.maxHp;
  if (A.fountain && dist(p.x, p.y, A.fountain.x, A.fountain.y) < 38) { if (p.hp < mxh) { p.hp = Math.min(mxh, p.hp + mxh * 0.12 * dt); if (chance(dt * 8)) G.parts.push({ x: p.x + rand(-6, 6), y: p.y - rand(0, 16), vx: 0, vy: -20, life: 0.6, max: 0.6, col: '#7dff8a', size: 1, grav: 0 }); UI.hudDirty(); } }
  if (p.hp < mxh) p.hp = Math.min(mxh, p.hp + (st.regen + (p.calm > 5 ? 1.5 : 0)) * dt);
  if (map.explored) { const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16); for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 7; x <= tx + 7; x++) if (x >= 0 && y >= 0 && x < map.w && y < map.h) map.explored[y * map.w + x] = 1; }
}
const spikeUp = (t) => (G.time + t.ph) % 2.4 < 0.9;
function separateMons() {
  const L = G.mons;
  for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.dead || a.d.ghost) continue;
    for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.dead || b.d.ghost) continue; const dx = b.x - a.x, dy = b.y - a.y, r = (a.w + b.w) / 2; if (Math.abs(dx) > r || Math.abs(dy) > r) continue; const d = Math.hypot(dx, dy) || 0.1; if (d < r) { const push = (r - d) / 2, ux = dx / d, uy = dy / d; if (!a.boss) moveEntity(a, -ux * push, -uy * push, true); if (!b.boss) moveEntity(b, ux * push, uy * push, true); } } }
}
function updateParticles(dt) {
  for (const q of G.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= 0.96; q.vy *= 0.97;
    if (q.floor && q.y >= q.floor) { if (G.stains.length > 160) G.stains.shift(); G.stains.push({ x: q.x, y: q.floor, col: q.col, t: 0, s: q.size }); q.life = 0; }
  }
  G.parts = G.parts.filter((q) => q.life > 0);
  for (const s of G.stains) s.t += dt; if (G.stains.length && G.stains[0].t > 25) G.stains.shift();
}
function updateWorld(dt) {
  G.time += dt; G.save.stats.playTime += dt;
  for (let i = G.later.length - 1; i >= 0; i--) if (G.time >= G.later[i].t) { const f = G.later[i].fn; G.later.splice(i, 1); f(); }
  Clock.tick(dt);
  Weather.tick(dt);
  Story.update(dt);
  const cam = () => { const [tx, ty] = camTarget(), k = 1 - Math.pow(0.0001, dt); G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k; };
  if (Story.active()) { updateNPCs(dt); updateParticles(dt); for (const f of G.fx) f.life -= dt; G.fx = G.fx.filter((f) => f.life > 0); if (G.area.finn) G.area.finn.t += dt; cam(); return; }
  updatePlayer(dt);
  if (!G.on) return; // the save was deleted (hardcore death) or the game was left
  checkGates(dt); areaTick(dt);
  updateFlow();
  for (const m of G.mons) if (!m.dead) updateMon(m, dt);
  separateMons();
  G.mons = G.mons.filter((m) => !m.dead);
  updateCorpses(dt); updateProjs(dt); updatePicks(dt); Pets.update(dt); updateNPCs(dt); updateParticles(dt);
  for (const t of G.texts) { t.life -= dt; t.y -= 18 * dt; }
  G.texts = G.texts.filter((t) => t.life > 0);
  for (const f of G.fx) f.life -= dt;
  G.fx = G.fx.filter((f) => f.life > 0);
  if (G.area.kind !== 'dungeon') for (const pr of G.area.props) if (pr.smoke && chance(dt * 3)) G.parts.push({ x: pr.x + (pr.img.chimney ? pr.img.chimney.x : pr.w - 12) + rand(-2, 2), y: pr.y - pr.h + 2, vx: rand(-4, 4) - Weather.wind * 8, vy: -14, life: 1.6, max: 1.6, col: '#8f897c', size: 2, grav: 0 });
  G.shake = Math.max(0, G.shake - dt * 18); G.flash = Math.max(0, G.flash - dt * 1.5);
  cam();
  G.autosaveT += dt; if (G.autosaveT > 45) { G.autosaveT = 0; saveGame(true); }
}
