// =====================================================================
// COMBAT — sword combos and heavy swings, blocking and parrying, the bow,
// fire / lightning / ice, finishers, dismemberment, and getting hurt.
// =====================================================================
function swordItem() { return ITEMS[G.save.player.eq.sword] || ITEMS.rusty_sword; }
// ---------- melee ----------
function playerAttack() {
  const p = G.p; if (!p || p.dead || UI.blocking() || p.swim || p.drawing || p.drinkT > 0 || p.stagger > 0 || p.dodgeT > 0) return;
  if (p.atk) { if (p.atk.t > p.atk.dur * 0.45) p.queued = true; return; }
  startSwing('light');
}
function startSwing(kind) {
  const p = G.p, cost = kind === 'heavy' ? 26 : 11; if (p.stam < 4) { UI.toast('Too tired.'); Sfx.play('error'); return; }
  const step = kind === 'heavy' ? 2 : p.combo % 3;
  p.atk = { kind, t: 0, dur: kind === 'heavy' ? 0.95 : step === 2 ? 0.6 : 0.48, step, struck: false, cost };
  p.stam = Math.max(0, p.stam - cost); p.block = false; p.combo++; p.comboT = 1.1; p.queued = false;
}
function updateAttack(dt, inMenu) {
  const p = G.p, a = p.atk; if (!a) return;
  a.t += dt;
  // keep holding the button during a first swing's wind-up for a heavy attack
  if (a.kind === 'light' && a.step === 0 && !a.charged && a.t > 0.17 && a.t < 0.3 && (MOUSE.l || TOUCH.atkHeld) && p.stam >= 14) { a.kind = 'heavy'; a.charged = true; a.dur = 0.95; a.t = 0.3; a.step = 2; p.stam = Math.max(0, p.stam - 15); Sfx.play('swing_heavy', { vol: 0.4 }); }
  const strikeAt = a.kind === 'heavy' ? 0.58 : 0.45;
  if (!a.struck && a.t >= a.dur * strikeAt) { a.struck = true; meleeStrike(a); }
  if (a.t >= a.dur) { p.atk = null; if (p.queued && !inMenu) { p.queued = false; startSwing('light'); } }
}
function meleeStrike(a) {
  const p = G.p, sw = swordItem(), heavy = a.kind === 'heavy', reach = (sw.dmg > 30 ? 2.9 : 2.6) + (heavy ? 0.4 : 0) + (p.mounted ? 0.6 : 0), cone = heavy ? 1.15 : 0.95;
  Sfx.play(heavy ? 'swing_heavy' : 'swing'); const hits = [];
  for (const t of ACTORS) {
    if (t.dead || t.kind === 'npc' || t.kind === 'horse' || t.indoors) continue;
    const [cx, cy, cz] = actorCenter(t), dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz);
    if (d > reach + t.r || Math.abs(cy - (p.y + 1.1)) > 1.6 + t.h * 0.4) continue;
    if (Math.abs(angDiff(p.yaw, Math.atan2(dx, dz))) > cone + (d < 1.2 ? 0.8 : 0)) continue;
    hits.push([d, t]);
  }
  hits.sort((x, y) => x[0] - y[0]);
  let n = 0; const [fx, fz] = fwdOf(p.yaw);
  for (const [d, t] of hits) {
    if (n >= (heavy ? 4 : 2)) break; n++;
    let dmg = sw.dmg * (1 + 0.08 * sk('edge')) * (heavy ? 1.9 * (1 + 0.15 * sk('heavy')) : a.step === 2 ? 1.3 : 1) * (0.92 + Math.random() * 0.16);
    const crit = chance(heavy ? 0.15 : 0.08); if (crit) dmg *= 1.5;
    // finisher: a heavy swing on something nearly dead
    const fin = heavy && !t.d.boss && t.rig && t.rig.limbs && (t.hp - dmg <= 0 || t.hp < t.maxHp * 0.22);
    if (fin) dmg = t.hp + 1;
    damageActor(t, dmg, { melee: true, heavy, crit, finisher: fin, silver: sw.silver, demon: sw.demon, steal: sw.steal, dir: [fx, fz] });
  }
  if (n) { G.hitstop = heavy ? 0.09 : 0.05; shakeCam(heavy ? 0.35 : 0.18); }
  else { // hit a wall or rock?
    const e = { x: p.x + fx * 1.4, z: p.z + fz * 1.4 }; if (collideCircle(e, 0.3, p.y + 0.5, 1)) { Sfx.play('clang', { vol: 0.6 }); Gore.sparks(e.x, p.y + 1.2, e.z, 8); shakeCam(0.15); }
  }
}
// ---------- damage to monsters ----------
function damageActor(a, dmg, o = {}) {
  if (a.dead || !a.d) return 0; const d = a.d, P = G.save.player;
  if (o.silver && d.silver) dmg *= d.silver;
  if (o.fire && d.fire) dmg *= d.fire; if (o.ice && d.ice) dmg *= d.ice;
  if (o.demon && a.type === 'azgoreth') dmg *= 3;
  if ((o.melee || o.bow) && P.oil && P.oil.hits > 0 && (P.oil.vs === d.family || (P.oil.vs === 'beast' && d.model === 'wolf'))) { dmg *= 1.5; if (o.melee) { P.oil.hits--; if (P.oil.hits <= 0) { UI.toast('Your blade oil has worn off.'); P.oil = null; } } }
  if (a.type === 'azgoreth' && !invCount('morwen_charm') && G.area === 'shrine') dmg *= 0.75;
  dmg = Math.max(1, dmg); a.hp -= dmg; a.hitT = 0.2; a.aggro = true; a.lastDmg = G.time;
  const [cx, cy, cz] = actorCenter(a), [dx, dz] = o.dir || [0, 0];
  if (!o.dot) {
    if (d.family === 'animal' || d.family === 'beast' || d.family === 'ogroid' || d.model === 'wyvern') Gore.blood(cx, cy, cz, dx, 0.3, dz, o.heavy ? 22 : 12, o.heavy ? 1.3 : 1);
    else if (d.family === 'cursed') Gore.blood(cx, cy, cz, dx, 0.3, dz, 12, 1, true);
    else if (d.family === 'drowned') Gore.ichor(cx, cy, cz, 0x2a5a3a, 12); else Gore.ichor(cx, cy, cz, 0xff5010, 14);
    if (o.melee || o.bow) Sfx.play(o.crit ? 'crit' : 'hit_flesh', { x: cx, y: cy, z: cz });
    if (o.crit) UI.hitMark('crit'); else UI.hitMark();
    if (o.steal) G.p.hp = Math.min(G.p.maxHp, G.p.hp + dmg * o.steal);
    if (hasMut('vampire') && o.melee) G.p.hp = Math.min(G.p.maxHp, G.p.hp + dmg * 0.04);
    // stagger smaller things, push everything a little
    if (!d.boss && a.atkT > 0 && (o.heavy || chance(d.model === 'troll' ? 0.1 : 0.35))) { a.atkT = 0; a.struck = true; a.atkCd = 0.6; a.leap = null; }
    if (!d.boss && d.model !== 'troll' && (o.melee || o.bow)) { const k = o.heavy ? 0.9 : 0.35; stepActor(a, dx * k * 30, dz * k * 30, 1 / 30); }
  }
  if (d.family === 'animal' && !a.dead) { a.fleeT = 6; }
  if (a.hp <= 0) killActor(a, o);
  else if (d.boss) Hud.boss(a);
  return dmg;
}
function killActor(a, o = {}) {
  if (a.dead) return; a.dead = true; a.deadT = 0; a.hp = 0; a.atkT = 0; a.anim.attack = -1; a.anim.fallDir = chance(0.5) ? 1 : -1;
  const d = a.d, P = G.save.player, [cx, cy, cz] = actorCenter(a), [dx, dz] = o.dir || [rand(-1, 1), rand(-1, 1)];
  if (d.voice && d.family !== 'animal') Sfx.voice(d.voice, 0.7, { x: cx, y: cy, z: cz });
  // gore
  if (a.rig && a.rig.limbs && Gore.on()) {
    if (o.finisher || (o.heavy && chance(0.7))) { Gore.dismember(a, 'head', [dx, dz]); if (sk('butcher') && chance(0.3 * sk('butcher'))) Gore.dismember(a, pick(['shoulderL', 'shoulderR']), [dx, dz]); }
    else if (o.melee && chance(0.35 + sk('butcher') * 0.1)) Gore.dismember(a, pick(['shoulderL', 'shoulderR', 'head', 'thighL']), [dx, dz]);
    if (o.fire || o.big) Gore.chunk(cx, cy, cz, 6);
  }
  if (o.finisher) { G.slowmo = 0.3; G.slowT = 0.7; Sfx.play('finisher'); shakeCam(0.6); UI.flash('#600', 0.35); if (sk('butcher')) { G.p.hp = Math.min(G.p.maxHp, G.p.hp + G.p.maxHp * 0.08 * sk('butcher')); } P.stats.finishers = (P.stats.finishers || 0) + 1; }
  if (d.boss) { G.slowmo = 0.25; G.slowT = 1.6; Hud.boss(null); }
  Gore.blood(cx, cy, cz, dx, 0.5, dz, 26, 1.3, d.family === 'cursed');
  if (a.fly) { a.vy = 0; }
  // rewards: coins now, items on the body (loot with E)
  const df = DIFF[G.save.diff] || DIFF.normal;
  const coins = randi(d.coins[0], d.coins[1]);
  if (coins) { P.coins += coins; Sfx.play('coin'); }
  a.loot = []; for (const [id, ch] of d.drops) if (chance(Math.min(1, ch * (df.loot || 1)))) a.loot.push(id);
  if (Clock.bloodMoon() && !d.boss && d.family !== 'animal' && chance(0.12)) a.loot.push('blood_shard');
  if (a.named) a.loot.push(...(a.named.loot || []));
  giveXP(Math.round(d.xp * (a.blood ? 1.5 : 1) * (a.big ? 2 : 1)));
  P.stats.kills = (P.stats.kills || 0) + 1; P.stats.byType = P.stats.byType || {}; P.stats.byType[a.type] = (P.stats.byType[a.type] || 0) + 1;
  Contracts.onKill(a); Story.onKill(a);
  if (d.trophy) addTrophy(d.trophy);
}
// ---------- getting hurt ----------
function hurtPlayer(dmg, src, o = {}) {
  const p = G.p; if (!p || p.dead || G.god || G.cine) return;
  if (p.iframe > 0 && !o.dot && !o.fall) { if (!o.proj) UI.toast('Dodged!', 'small'); return; }
  const srcA = src && src.x != null ? src : null;
  if (p.block && !o.dot && !o.fall && !o.unblockable) {
    const ang = srcA ? Math.abs(angDiff(p.yaw, Math.atan2(srcA.x - p.x, srcA.z - p.z))) : o.x != null ? Math.abs(angDiff(p.yaw, Math.atan2(o.x - p.x, o.z - p.z))) : 0;
    if (ang < 1.25) {
      const win = 0.22 + sk('riposte') * 0.06;
      if (p.blockT < win && srcA && !o.proj) { // parry!
        Sfx.play('parry'); Gore.sparks(p.x + Math.sin(p.yaw), p.y + 1.3, p.z + Math.cos(p.yaw), 18); shakeCam(0.25); G.hitstop = 0.12;
        srcA.stun = srcA.d && srcA.d.boss ? 0.7 : 1.4; srcA.atkT = 0; srcA.leap = null; UI.toast('Parry!', 'small');
        if (sk('riposte') && srcA.d) damageActor(srcA, swordItem().dmg * 0.6 * sk('riposte'), { melee: true, silver: swordItem().silver, dir: fwdOf(p.yaw) });
        return;
      }
      const sh = ITEMS[G.save.player.eq.shield], absorb = sh ? sh.block : 0.35;
      p.stam -= dmg * (sh ? 0.9 : 1.4); Sfx.play('block'); Gore.sparks(p.x + Math.sin(p.yaw) * 0.8, p.y + 1.2, p.z + Math.cos(p.yaw) * 0.8, 6); shakeCam(0.15);
      dmg *= 1 - absorb;
      if (p.stam <= 0) { p.stam = 0; p.block = false; p.stagger = 0.7; Sfx.play('clang'); UI.toast('Guard broken!', 'bad'); }
    }
  }
  const st = pStats(), df = DIFF[G.save.diff] || DIFF.normal;
  if (!o.fall) dmg *= 40 / (40 + st.def);
  if (!o.dot && !o.fall) dmg *= df.dmgIn;
  dmg = Math.max(o.dot ? 0.5 : 1, dmg);
  p.hp -= dmg; p.lastHit = G.time;
  if (!o.dot) {
    p.hurtT = 0.4; UI.hurt(Math.min(1, dmg / 30)); Sfx.play('hurt'); shakeCam(Math.min(0.7, 0.2 + dmg / 40)); if (Gore.on()) Gore.blood(p.x + Math.sin(p.yaw) * 0.4, p.y + 1.3, p.z + Math.cos(p.yaw) * 0.4, 0, 0.2, 0, 6, 0.6);
    if (o.knock && srcA && !p.mounted) { const dx = p.x - srcA.x, dz = p.z - srcA.z, l = Math.hypot(dx, dz) || 1; p.vx += (dx / l) * o.knock; p.vz += (dz / l) * o.knock; if (o.knock > 6) { p.stagger = 0.5; p.atk = null; p.drawing = false; p.draw = -1; } }
    if (p.drawing && dmg > 8) { p.drawing = false; p.draw = -1; }
  }
  if (o.burn) p.burn = 3; if (o.poison) { p.poison = 8; UI.toast('Poisoned!', 'bad'); }
  if (p.hp <= 0) playerDie(srcA);
  else if (p.hp < p.maxHp * 0.25 && !p.lowWarn) { p.lowWarn = true; UI.toast('Low health — press Q to drink a potion.', 'bad'); } else if (p.hp > p.maxHp * 0.5) p.lowWarn = false;
}
function playerDie(src) {
  const p = G.p; if (p.dead) return; p.dead = true; p.deadT = 0; p.hp = 0; p.atk = null; p.drawing = false; if (p.mounted) { p.mounted = null; Body.ride(false); }
  Sfx.play('death'); Music.set('sad'); shakeCam(0.8); G.save.player.stats.deaths = (G.save.player.stats.deaths || 0) + 1;
  later(2.4, () => UI.death(src && src.d ? src.d.name : null));
}
// ---------- the bow ----------
function updateBow(dt, inMenu) {
  const p = G.p, P = G.save.player, bow = ITEMS[P.eq.bow];
  const want = !inMenu && (MOUSE.r || TOUCH.bowHeld) && bow && !p.atk && !p.swim && p.drinkT <= 0 && p.stagger <= 0 && p.dodgeT <= 0;
  if (want && !p.drawing) { if (invCount(P.eq.arrow) <= 0) { if (!p.noArrowT || G.time - p.noArrowT > 2) { p.noArrowT = G.time; UI.toast('No ' + ITEMS[P.eq.arrow || 'arrow'].name.toLowerCase() + ' left. Press 2 to switch arrows.'); Sfx.play('error'); } return; } p.drawing = true; p.draw = 0; p.block = false; Sfx.play('bow_draw'); }
  if (p.drawing) {
    if (want) p.draw = Math.min(1, p.draw + dt / (bow.draw * (1 - 0.12 * sk('draw'))));
    else { if (p.draw > 0.25 && !inMenu) shootArrow(); p.drawing = false; p.draw = -1; }
  }
}
function shootArrow() {
  const p = G.p, P = G.save.player, bow = ITEMS[P.eq.bow], aid = P.eq.arrow || 'arrow', ai = ITEMS[aid]; if (!invTake(aid, 1)) return;
  _camF.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const tx = camera.position.x + _camF.x * 80, ty = camera.position.y + _camF.y * 80, tz = camera.position.z + _camF.z * 80;
  const sx = CAM.third ? p.x + Math.sin(p.yaw) * 0.5 : camera.position.x + _camF.x * 0.4, sy = CAM.third ? p.y + 1.5 : camera.position.y - 0.08, sz = CAM.third ? p.z + Math.cos(p.yaw) * 0.5 : camera.position.z + _camF.z * 0.4;
  const pow = 0.3 + 0.7 * p.draw;
  fireProj({ from: 'player', x: sx, y: sy, z: sz, tx, ty, tz, speed: 28 + 52 * p.draw, grav: 6, kind: 'arrow', item: aid, dmg: bow.dmg * pow * (1 + 0.1 * sk('aim')), silver: ai.silver, fire: ai.fire, life: 5 });
  Sfx.play('bow_release'); P.stats.arrows = (P.stats.arrows || 0) + 1;
}
function playerArrowHit(t, pr, head) {
  let dmg = pr.dmg * (head ? 1.6 * (1 + 0.25 * sk('head')) : 1); if (head) UI.toast('Headshot!', 'small');
  damageActor(t, dmg, { bow: true, silver: pr.silver, fire: pr.fire, crit: head, dir: [pr.vx / 60, pr.vz / 60] });
  if (pr.fire && !t.dead) t.burn = 4;
}
function cycleArrows() {
  const P = G.save.player, kinds = ['arrow', 'silver_arrow', 'fire_arrow'].filter((k) => invCount(k) > 0); if (!kinds.length) { UI.toast('You have no arrows.'); return; }
  const i = kinds.indexOf(P.eq.arrow); P.eq.arrow = kinds[(i + 1) % kinds.length]; UI.toast(ITEMS[P.eq.arrow].name + ': ' + invCount(P.eq.arrow)); VM.rebuild(); Sfx.play('click');
}
// ---------- magic ----------
function castSpell(id) {
  const p = G.p, S = SPELLS[id]; if (!p || p.dead || UI.blocking() || p.swim || p.atk || p.drawing || p.stagger > 0) return;
  if (p.cd[id] > 0) return; if (p.mana < S.mana) { UI.toast('Not enough mana.'); Sfx.play('error'); return; }
  p.mana -= S.mana; p.cd[id] = S.cd; p.castT = 0.4; p.lastSpell = id; G.save.player.stats.spells = (G.save.player.stats.spells || 0) + 1;
  _camF.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const hx = camera.position.x + _camF.x * 0.6 - Math.cos(p.yaw) * 0.15, hy = camera.position.y - 0.15 + _camF.y * 0.6, hz = camera.position.z + _camF.z * 0.6 + Math.sin(p.yaw) * 0.15;
  if (id === 'fire') { Sfx.play('fire_cast'); fireProj({ from: 'player', x: hx, y: hy, z: hz, dir: [_camF.x, _camF.y, _camF.z], speed: 30, grav: 1.5, kind: 'fire', dmg: S.dmg * (1 + 0.12 * sk('kindle')) * (1 + (G.save.player.level - 1) * 0.04), life: 3 }); return; }
  if (id === 'lightning') {
    Sfx.play('lightning'); const first = aimTarget(42, 0.22), hit = new Set(); let from = [hx, hy, hz], tgt = first, n = 1 + (1 + sk('storm'));
    if (!tgt) { const end = [hx + _camF.x * 30, hy + _camF.y * 30, hz + _camF.z * 30]; const gy = floorAt(end[0], end[2], end[1]); if (end[1] < gy) end[1] = gy; boltFX(from, end); Gore.sparks(end[0], end[1], end[2], 10, [0.7, 0.85, 1]); return; }
    while (tgt && n-- > 0) {
      hit.add(tgt); const c = actorCenter(tgt); boltFX(from, c); Gore.sparks(c[0], c[1], c[2], 14, [0.7, 0.85, 1]);
      damageActor(tgt, S.dmg * (1 + (G.save.player.level - 1) * 0.04) * (hit.size > 1 ? 0.7 : 1), { lightning: true, dir: fwdOf(p.yaw) }); if (!tgt.dead) tgt.stun = Math.max(tgt.stun, 1);
      from = c; let best = null, bd = 9; for (const a of ACTORS) { if (a.dead || hit.has(a) || a.kind !== 'monster') continue; const cc = actorCenter(a), d = Math.hypot(cc[0] - c[0], cc[2] - c[2]); if (d < bd) { bd = d; best = a; } } tgt = best;
    }
    G.flash = 0.25; return;
  }
  if (id === 'ice') {
    Sfx.play('ice_cast'); const range = 9, cone = 0.62, lvl = 1 + (G.save.player.level - 1) * 0.04;
    for (let i = 0; i < 40; i++) { const a = p.yaw + rand(-cone, cone), s = rand(8, 16); emit(Gore.glow, hx, hy, hz, Math.sin(a) * s, _camF.y * s + rand(-1, 1), Math.cos(a) * s, rand(0.4, 0.65), 0.16, 0.05, 0.6, 0.85, 1, 1, 2, 1.5); }
    for (const a of ACTORS) {
      if (a.dead || a.kind !== 'monster') continue; const c = actorCenter(a), dx = c[0] - p.x, dz = c[2] - p.z, d = Math.hypot(dx, dz);
      if (d > range + a.r || Math.abs(angDiff(p.yaw, Math.atan2(dx, dz))) > cone + 0.15 || Math.abs(c[1] - p.y - 1) > 4) continue;
      const frozen = a.slow > 0; damageActor(a, S.dmg * lvl * (frozen ? 1.4 : 1), { ice: true, dir: [dx / d, dz / d] });
      if (!a.dead) { a.slow = 4 + sk('winter'); if (frozen || chance(0.25)) { a.stun = Math.max(a.stun, (a.d.boss ? 0.6 : 1.5) + sk('winter') * 0.5); Sfx.play('ice_shatter', { x: c[0], y: c[1], z: c[2] }); Gore.magic(c[0], c[1], c[2], 0xc0f0ff, 16, 2); } }
    }
  }
}
function playerFireball(x, y, z, pr) {
  Sfx.play('boom', { x, y, z }); Gore.magic(x, y, z, 0xff7020, 30, 6); for (let i = 0; i < 16; i++) Gore.flame(x + rand(-1, 1), y, z + rand(-1, 1), 1.4); Gore.smoke(x, y, z, 10, 0.2); shakeCam(0.3);
  const L = addLightSource({ x, y: y + 1, z, color: 0xff7020, intensity: 14, range: 16, kind: 'magic', size: 3, always: true, area: G.area, parent: scene }); later(0.35, () => { scene.remove(L.glow); const k = WORLD.lights.indexOf(L); if (k >= 0) WORLD.lights.splice(k, 1); });
  for (const a of ACTORS) {
    if (a.dead || a.kind !== 'monster') continue; const c = actorCenter(a), d = Math.hypot(c[0] - x, c[1] - y, c[2] - z); if (d > 3.8 + a.r) continue;
    damageActor(a, pr.dmg * (1 - (d / (4 + a.r)) * 0.5), { fire: true, dir: [(c[0] - x) / (d || 1), (c[2] - z) / (d || 1)] }); if (!a.dead) a.burn = 4;
  }
  if (G.p && Math.hypot(G.p.x - x, G.p.z - z) < 2) hurtPlayer(pr.dmg * 0.3, null, { burn: true, x, z });
}
// lightning bolt: a jagged line that fades fast
const BOLTS = [];
function boltFX(a, b) {
  const pts = [], n = 10; for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : 0.5; pts.push(new THREE.Vector3(lerp(a[0], b[0], t) + rand(-j, j), lerp(a[1], b[1], t) + rand(-j, j), lerp(a[2], b[2], t) + rand(-j, j))); }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xd8e8ff, transparent: true, opacity: 1, fog: false })); scene.add(line); BOLTS.push({ line, t: 0.22 });
  const L = addLightSource({ x: b[0], y: b[1] + 0.5, z: b[2], color: 0xa0c8ff, intensity: 16, range: 22, kind: 'magic', size: 2.5, always: true, area: G.area, parent: scene }); later(0.15, () => { scene.remove(L.glow); const k = WORLD.lights.indexOf(L); if (k >= 0) WORLD.lights.splice(k, 1); });
}
function updateBolts(dt) { for (let i = BOLTS.length - 1; i >= 0; i--) { const B = BOLTS[i]; B.t -= dt; B.line.material.opacity = Math.max(0, B.t / 0.22); if (B.t <= 0) { scene.remove(B.line); B.line.geometry.dispose(); BOLTS.splice(i, 1); } } }
// the monster nearest the crosshair
function aimTarget(range, cone) {
  _camF.set(0, 0, -1).applyQuaternion(camera.quaternion); let best = null, bs = 1e9;
  for (const a of ACTORS) {
    if (a.dead || a.kind === 'npc' || a.kind === 'horse' || a.indoors) continue; const c = actorCenter(a), dx = c[0] - camera.position.x, dy = c[1] - camera.position.y, dz = c[2] - camera.position.z, d = Math.hypot(dx, dy, dz);
    if (d > range || d < 0.5) continue; const dot = (dx * _camF.x + dy * _camF.y + dz * _camF.z) / d, ang = Math.acos(clamp(dot, -1, 1)); if (ang > cone + Math.atan2(a.r, d)) continue;
    const score = ang * 10 + d * 0.02; if (score < bs) { bs = score; best = a; }
  }
  return best;
}
// ---------- potions, food, hunter sense ----------
function quickPotion() {
  const p = G.p; if (!p || p.dead || UI.blocking() || p.drinkT > 0) return;
  const miss = p.maxHp - p.hp, order = miss > 100 ? ['greater_draught', 'draught'] : ['draught', 'greater_draught'], id = order.find((k) => invCount(k) > 0);
  if (!id) { UI.toast('No healing potions! Craft them from bloodroot at a camp, or buy them from Old Maud.', 'bad'); Sfx.play('error'); return; }
  useItem(id);
}
const SENSE = { on: false, t: 0 };
function hunterSense() {
  const p = G.p; if (!p || p.dead || UI.blocking()) return;
  if (SENSE.on) { SENSE.on = false; SENSE.t = 0; return; }
  SENSE.on = true; SENSE.t = 9 + sk('eye') * 4; Sfx.play('sense'); Story.onSense(); Contracts.onSense();
}
function updateSense(dt) { if (SENSE.on) { SENSE.t -= dt; if (SENSE.t <= 0) SENSE.on = false; } Clues.update(dt); }
