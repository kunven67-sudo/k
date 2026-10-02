// =====================================================================
// SYSTEMS — inventory, items, levels and skills, mutations, survival
// (hunger, sleep, cold), contracts and tracking, trophies, crafting,
// shops, camps, fast travel, sleeping and saving.
// =====================================================================
// ---------- inventory ----------
function invCount(id) { if (!G.save || !id) return 0; const e = G.save.player.inv.find((e) => e.id === id); return e ? e.n : 0; }
function invAdd(id, n = 1, quiet) {
  if (!ITEMS[id] || n <= 0) return; const inv = G.save.player.inv, e = inv.find((e) => e.id === id);
  if (e) e.n += n; else inv.push({ id, n });
  if (!quiet) UI.toast('+ ' + (n > 1 ? n + ' ' : '') + ITEMS[id].name, 'item');
}
function invTake(id, n = 1) { const inv = G.save.player.inv, e = inv.find((e) => e.id === id); if (!e || e.n < n) return false; e.n -= n; if (e.n <= 0) inv.splice(inv.indexOf(e), 1); return true; }
const itemValue = (it) => it.value || it.price || 1;
// ---------- using things ----------
function useItem(id) {
  const it = ITEMS[id], p = G.p, P = G.save.player, sv = G.save.surv; if (!it || !invCount(id)) return false;
  switch (it.type) {
    case 'sword': case 'bow': case 'shield': case 'armor': case 'arrow': return equip(id);
    case 'potion':
      if (p.drinkT > 0) return false; invTake(id); p.drinkT = 0.7; Sfx.play('drink');
      if (it.heal) { p.hp = Math.min(p.maxHp, p.hp + it.heal); UI.flash('#2a0', 0.12); }
      if (it.stam) { p.stam = p.maxStam; p.stamBoost = 60; } if (it.mana) p.mana = p.maxMana;
      if (it.warm) { sv.warmth = Math.min(100, sv.warmth + 40); sv.warmT = 240; } if (it.cure) { p.poison = 0; p.burn = 0; UI.toast('The poison fades.'); }
      if (it.owl) { sv.owlT = 300; UI.toast('Your eyes sharpen. The dark looks grey now.'); } if (it.holy) { P.corruption = Math.max(0, P.corruption - 25); UI.toast('Corruption: ' + Math.round(P.corruption)); }
      P.stats.potions = (P.stats.potions || 0) + 1; return true;
    case 'food':
      invTake(id); Sfx.play('eat'); sv.hunger = Math.min(100, sv.hunger + it.food); if (it.heal) p.hp = Math.min(p.maxHp, p.hp + it.heal); if (it.warm) sv.warmth = Math.min(100, sv.warmth + it.warm);
      if (it.raw && !sk('stomach') && chance(0.35)) { p.poison = 6; UI.toast('That raw meat was a bad idea. Cook it at a fire next time.', 'bad'); } else UI.toast('You eat the ' + it.name.toLowerCase() + '.');
      return true;
    case 'oil': invTake(id); P.oil = { vs: it.vs, hits: 40, name: it.name }; Sfx.play('craft'); UI.toast(it.name + ' applied to your blade (40 hits).'); return true;
    case 'mutagen': UI.confirmMutagen(id); return true;
    case 'mat': if (id === 'firewood') return lightFire(); UI.toast(it.desc || 'A crafting material.'); return false;
    default: UI.toast(it.desc || it.name); return false;
  }
}
function equip(id) {
  const it = ITEMS[id], P = G.save.player; if (!it) return false;
  if (it.lvl && P.level < it.lvl) { UI.toast('You need level ' + it.lvl + ' for that.', 'bad'); Sfx.play('error'); return false; }
  P.eq[it.type] = id; Sfx.play('pickup'); refreshStats(); UI.toast('Equipped ' + it.name); return true;
}
function eatBest() { const foods = G.save.player.inv.filter((e) => ITEMS[e.id].type === 'food').sort((a, b) => (ITEMS[a.id].raw ? 1 : 0) - (ITEMS[b.id].raw ? 1 : 0) || ITEMS[b.id].food - ITEMS[a.id].food); if (!foods.length) { UI.toast('You have nothing to eat.'); Sfx.play('error'); return; } useItem(foods[0].id); }
function applyMutagen(id) {
  const it = ITEMS[id], P = G.save.player, m = MUTATIONS[it.mut]; if (!invTake(id)) return;
  if (P.muts.includes(it.mut)) { P.corruption = Math.min(100, P.corruption + 5); UI.toast('Your body already carries ' + m.name + '. It burns anyway.', 'bad'); return; }
  P.muts.push(it.mut); P.corruption = Math.min(100, P.corruption + m.corr); Sfx.play('mutate'); shakeCam(0.5); UI.flash('#400', 0.6);
  UI.toast('MUTATION: ' + m.name + ' — ' + m.desc, 'blood big'); refreshStats();
  if (P.corruption >= 60) UI.toast('People stare at your eyes now. Shopkeepers charge you more.', 'bad');
}
const priceMul = () => (G.save.player.corruption >= 60 ? 1.3 : 1);
// ---------- levels and skills ----------
function giveXP(n) {
  const P = G.save.player; if (P.level >= MAX_LVL) return; P.xp += n; let up = false;
  while (P.level < MAX_LVL && P.xp >= xpNeed(P.level)) { P.xp -= xpNeed(P.level); P.level++; P.skillPts++; up = true; }
  if (up) { refreshStats(); G.p.hp = G.p.maxHp; G.p.mana = G.p.maxMana; Sfx.play('level'); UI.toast('LEVEL ' + P.level + ' — you have a skill point (K)', 'gold big'); }
}
function branchPts(br) { const P = G.save.player; let n = 0; for (const s of SKILLS) if (s.br === br) n += P.skills[s.id] || 0; return n; }
function canBuySkill(id) { const s = SKILL_BY[id], P = G.save.player; return P.skillPts > 0 && (P.skills[id] || 0) < 3 && branchPts(s.br) >= s.row * 2; }
function buySkill(id) { if (!canBuySkill(id)) { Sfx.play('error'); return false; } const P = G.save.player; P.skills[id] = (P.skills[id] || 0) + 1; P.skillPts--; Sfx.play('level'); refreshStats(); return true; }
// ---------- trophies ----------
function addTrophy(id) { const P = G.save.player; if (P.trophies[id]) return; P.trophies[id] = Clock.W().day; Sfx.play('trophy'); UI.toast('TROPHY: ' + TROPHIES[id].name + ' — it hangs on the wall at home now.', 'gold'); Interiors.dirty = true; }
// ---------- survival ----------
const Survival = {
  fireNear() { const p = G.p; if (G.area !== 'outside') return true; for (const f of WORLD.fires || []) if (Math.hypot(f.x - p.x, f.z - p.z) < 7) return true; for (const f of G.tmpFires) if (Math.hypot(f.x - p.x, f.z - p.z) < 6) return true; return false; },
  tick(dt, mins) {
    const sv = G.save.surv, p = G.p; if (!p || p.dead) return;
    sv.hunger = Math.max(0, sv.hunger - mins * 0.07 * (sk('stomach') ? 0.8 : 1));
    sv.fatigue = Math.min(100, sv.fatigue + mins * 0.083 * (p.sprinting ? 1.5 : 1));
    sv.warmT = Math.max(0, sv.warmT - mins); sv.owlT = Math.max(0, sv.owlT - dt);
    // how warm should you be right now?
    let target = Clock.isNight() ? 45 : 72; const out = G.area === 'outside';
    if (out) { target -= Weather.rainK() * 18 + Weather.stormK() * 10; if (p.y > 115) target -= 38; else if (p.y > 85) target -= 14; if (p.swim) target -= 40; else if (p.y < waterLevelAt(p.x, p.z) - 0.4) target -= 15; if (Clock.bloodMoon()) target -= 5; }
    else target = 85;
    if (this.fireNear()) target += 55; if (out && inTown(p.x, p.z) && !Clock.isNight()) target += 10;
    target += pStats().warm * 6 + (sv.warmT > 0 ? 40 : 0); target = clamp(target, 0, 100);
    const rate = target < sv.warmth ? 0.9 * (1 - 0.2 * sk('cold')) * (p.swim ? 3 : 1) : 2.5;
    sv.warmth = clamp(sv.warmth + clamp(target - sv.warmth, -rate * mins, rate * mins), 0, 100);
    // what it does to you
    if (sv.hunger <= 0) { p.hp -= dt * 0.35; this.warnOnce('hungry', 'You are starving. Eat something (1).'); } else if (sv.hunger < 20) this.warnOnce('peckish', 'You are hungry.');
    if (sv.warmth < 10) { p.hp -= dt * 0.5; this.warnOnce('freeze', 'You are freezing! Find a fire, get indoors, or drink brandy.'); } else if (sv.warmth < 25) this.warnOnce('cold', 'You are getting cold.');
    if (sv.fatigue > 85) this.warnOnce('tired', 'You are exhausted. Sleep at home, the inn or a camp.');
    if (p.hp <= 0 && !p.dead) playerDie(null);
  },
  warned: {},
  warnOnce(k, msg) { if (this.warned[k] && G.time - this.warned[k] < 120) return; this.warned[k] = G.time; UI.toast(msg, 'bad'); },
};
function lightFire() {
  const p = G.p; if (G.area !== 'outside' || p.swim || waterDepthAt(p.x, p.z) > 0.1) { UI.toast("You can't light a fire here."); return false; }
  if (Weather.rainK() > 0.5) { UI.toast('It is raining too hard to light a fire.'); return false; }
  invTake('firewood'); const x = p.x + Math.sin(p.yaw) * 1.6, z = p.z + Math.cos(p.yaw) * 1.6, y = floorAt(x, z, p.y + 1);
  const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), MAT.wood); l.rotation.set(Math.PI / 2, i * 0.8, 0); l.position.y = 0.08; g.add(l); } g.position.set(x, y, z); scene.add(g);
  const L = addLightSource({ x, y: y + 0.6, z, color: 0xff7a30, intensity: 8, range: 14, kind: 'fire', size: 1.5, always: true, parent: scene });
  const F = { x, y, z, g, L, mins: 240 }; G.tmpFires.push(F); addInteract(F.it = { x, y, z, r: 2.8, label: 'Campfire: rest and cook', kind: 'fire', fire: F });
  Sfx.play('fire_crackle'); UI.toast('You light a small fire. Rest or cook here.'); return true;
}
function updateTmpFires(mins) {
  for (let i = G.tmpFires.length - 1; i >= 0; i--) { const F = G.tmpFires[i]; F.mins -= mins; if (chance(0.3)) Gore.ember(F.x, F.y + 0.3, F.z); if (chance(0.15)) Gore.smoke(F.x, F.y + 0.8, F.z, 1, 0.3); if (F.mins <= 0) removeTmpFire(F); }
}
function removeTmpFire(F) { scene.remove(F.g); scene.remove(F.L.glow); WORLD.lights.splice(WORLD.lights.indexOf(F.L), 1); const k = WORLD.interact.indexOf(F.it); if (k >= 0) WORLD.interact.splice(k, 1); G.tmpFires.splice(G.tmpFires.indexOf(F), 1); }
// ---------- clues and tracks (seen with hunter sense) ----------
const Clues = {
  list: [],
  geo: null,
  add(o) { // {x, z, y?, kind:'blood'|'claw'|'track', id, label, onFind, auto, wall}
    if (!this.geo) { this.geo = new THREE.CircleGeometry(0.5, 10); this.geo.rotateX(-Math.PI / 2); this.mat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.85, depthWrite: false, fog: false }); }
    const y = o.y != null ? o.y : floorAt(o.x, o.z) + 0.05, c = Object.assign({ y, found: false }, o);
    c.mesh = new THREE.Group(); c.mesh.position.set(c.x, y, c.z); scene.add(c.mesh);
    if (c.kind === 'track') { for (const s of [-1, 1]) { const m = new THREE.Mesh(this.geo, this.mat); m.scale.set(0.25, 1, 0.45); m.position.set(s * 0.25, 0, s * 0.35); c.mesh.add(m); } c.mesh.rotation.y = c.yaw || 0; }
    else if (c.kind === 'claw') { for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.02), this.mat); m.position.set((i - 1) * 0.14, 1.4, 0); m.rotation.z = 0.35; c.mesh.add(m); } c.mesh.rotation.y = c.yaw || 0; }
    else { const m = new THREE.Mesh(this.geo, this.mat); m.scale.setScalar(c.size || 1); c.mesh.add(m); }
    const glow = new THREE.Sprite(MAT.glow.clone()); glow.material.color.setHex(0xff2020); glow.scale.setScalar(c.kind === 'claw' ? 1.8 : 1.4); glow.position.y = c.kind === 'claw' ? 1.4 : 0.4; c.mesh.add(glow);
    c.mesh.visible = false; c.mesh.traverse((m) => (m.renderOrder = 6)); this.list.push(c); return c;
  },
  clear(tag) { for (let i = this.list.length - 1; i >= 0; i--) if (!tag || this.list[i].tag === tag) { scene.remove(this.list[i].mesh); this.list.splice(i, 1); } },
  update(dt) {
    const p = G.p; if (!p) return; const t = G.time;
    for (const c of this.list) {
      c.mesh.visible = SENSE.on && !c.found && G.area === 'outside';
      if (c.mesh.visible) { const k = 0.6 + Math.sin(t * 5 + c.x) * 0.3; c.mesh.children.forEach((m) => { if (m.material) m.material.opacity = k; }); }
      if (!c.found && c.auto && SENSE.on && Math.hypot(c.x - p.x, c.z - p.z) < (c.r || 4)) this.find(c);
    }
  },
  find(c) { if (c.found) return; c.found = true; Sfx.play('page', { vol: 0.6 }); if (c.label) UI.toast(c.label, 'small'); if (c.onFind) c.onFind(c); },
  nearest(x, z, r) { let best = null, bd = r; for (const c of this.list) { if (c.found || c.auto) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } } return best; },
};
// ---------- contracts ----------
const Contracts = {
  refresh(force) {
    const C = G.save.contracts, day = Clock.W().day; if (!force && C.day === day && C.board.length) return; C.day = day;
    const L = G.save.player.level, act = new Set(C.active.map((c) => c.key)), pool = CONTRACT_KINDS.map((k, i) => [k, i]).filter(([k, i]) => (k.lvl || 1) <= L + 2 && !act.has(i) && !(k.kind === 'lair' && (C.slain || []).includes(i)));
    C.board = []; const rnd = mulberry32(day * 977 + C.done * 31);
    while (C.board.length < 3 && pool.length) { const [k, i] = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; C.board.push(this.make(k, i, rnd)); }
  },
  make(k, i, rnd) {
    const c = { key: i, kind: k.kind, mon: k.mon, coins: k.coins, xp: k.xp, got: 0 };
    if (k.kind === 'kill') { c.n = k.n[0] + Math.floor(rnd() * (k.n[1] - k.n[0] + 1)); c.text = k.text(c.n); c.coins = k.coins * c.n; c.xp = k.xp * c.n; c.title = 'Cull: ' + plural(MON[k.mon].name); }
    else { c.text = k.text; c.title = k.name; c.name = k.name; c.trophy = k.trophy; c.big = k.big || 1.25; c.blood = k.blood; const spots = LAIRS[k.mon]; c.lair = spots[Math.floor(rnd() * spots.length)]; const a = rnd() * TAU, r = 45 + rnd() * 25; c.area = [c.lair[0] + Math.cos(a) * r, c.lair[1] + Math.sin(a) * r]; }
    c.id = 'c' + Date.now().toString(36) + Math.floor(rnd() * 1e6).toString(36); return c;
  },
  accept(c) {
    const C = G.save.contracts; if (C.active.length >= 3) { UI.toast('You can only take 3 contracts at once.'); return false; }
    C.board.splice(C.board.indexOf(c), 1); C.active.push(c); Sfx.play('quest'); UI.toast('Contract taken: ' + c.title, 'gold'); this.setupTracks(c); return true;
  },
  setupTracks(c) {
    if (c.kind !== 'lair' || c.done) return; Clues.clear('c:' + c.id);
    // tracks lead from the search area to the lair: find them with hunter sense
    const [ax, az] = c.area, [lx, lz] = c.lair, n = 9;
    for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(ax, lx, t) + Math.sin(i * 1.7) * 4, z = lerp(az, lz, t) + Math.cos(i * 1.3) * 4; Clues.add({ tag: 'c:' + c.id, kind: i % 3 === 2 ? 'blood' : 'track', x, z, yaw: Math.atan2(lx - ax, lz - az), auto: true, r: 6, onFind: () => { c.seen = Math.max(c.seen || 0, i); if (i === 0) UI.toast('Tracks! They lead toward its lair.', 'small'); } }); }
  },
  onKill(a) {
    for (const c of G.save.contracts.active) {
      if (c.done) continue;
      if (c.kind === 'kill' && a.type === c.mon) { c.got++; if (c.got >= c.n) { c.done = true; Sfx.play('quest'); UI.toast('Contract done: ' + c.title + ' — collect your pay at the board.', 'gold'); } else if (c.got % 2 === 0 || c.n - c.got <= 2) UI.toast(c.title + ': ' + c.got + '/' + c.n, 'small'); }
      if (c.kind === 'lair' && a.contract === c.id) { c.done = true; Clues.clear('c:' + c.id); Sfx.play('quest'); UI.toast(c.name + ' is dead. Collect your pay at the board.', 'gold'); if (c.trophy) addTrophy(c.trophy); }
    }
  },
  onSense() {},
  update() {
    const p = G.p; if (!p || G.area !== 'outside') return;
    for (const c of G.save.contracts.active) {
      if (c.kind !== 'lair' || c.done) continue;
      const here = ACTORS.find((a) => a.contract === c.id && !a.dead); if (here) continue;
      if (Math.hypot(c.lair[0] - p.x, c.lair[1] - p.z) < 75 && (!c.blood || Clock.bloodMoon())) {
        const a = makeActor('monster', c.mon, c.lair[0], c.lair[1], { contract: c.id, big: c.big, aggro: false, named: { name: c.name, loot: ['silver_ingot', 'blood_shard'] } }); a.maxHp = a.hp = Math.round(a.hp * 2.2); a.dmg *= 1.15; a.d = Object.assign({}, a.d, { name: c.name, boss: true });
        Sfx.voice(a.d.voice, 0.8, { x: a.x, y: a.y, z: a.z, range: 140 }); UI.toast('You found the lair of ' + c.name + '.', 'blood');
      }
    }
  },
  turnIn() {
    const C = G.save.contracts, done = C.active.filter((c) => c.done); if (!done.length) return 0; const P = G.save.player;
    for (const c of done) { C.active.splice(C.active.indexOf(c), 1); P.coins += c.coins; giveXP(c.xp); C.done++; if (c.kind === 'lair') (C.slain = C.slain || []).push(c.key); UI.toast('Paid ' + c.coins + ' coins for ' + c.title, 'gold'); }
    Sfx.play('coin'); return done.length;
  },
  abandon(c) { const C = G.save.contracts; C.active.splice(C.active.indexOf(c), 1); Clues.clear('c:' + c.id); for (const a of ACTORS) if (a.contract === c.id) removeActor(a); },
  restore() { for (const c of G.save.contracts.active) this.setupTracks(c); },
};
// ---------- crafting and shops ----------
function canCraft(r) { for (const k in r.need) if (invCount(k) < r.need[k]) return false; return true; }
function craft(r) {
  if (!canCraft(r)) { Sfx.play('error'); return false; } const it = ITEMS[r.out];
  if (it.lvl && G.save.player.level < it.lvl - 1) { UI.toast('You need level ' + (it.lvl - 1) + ' to make that.'); return false; }
  for (const k in r.need) if (!(r.keepNeed || []).includes(k)) invTake(k, r.need[k]);
  invAdd(r.out, r.n, true); Sfx.play(r.at === 'smith' ? 'hammer' : 'craft'); UI.toast('Made ' + (r.n > 1 ? r.n + ' ' : '') + it.name, 'item'); G.save.player.stats.crafted = (G.save.player.stats.crafted || 0) + 1; return true;
}
function buy(id) {
  const it = ITEMS[id], P = G.save.player, n = it.type === 'arrow' ? 10 : 1, cost = Math.ceil(it.price * n * priceMul());
  if (P.coins < cost) { UI.toast('Not enough coins.', 'bad'); Sfx.play('error'); return false; }
  P.coins -= cost; invAdd(id, n, true); Sfx.play('coin'); UI.toast('Bought ' + (n > 1 ? n + ' ' : '') + it.name); return true;
}
function sellPrice(id) { return Math.max(1, Math.floor(itemValue(ITEMS[id]) * 0.4)); }
function sell(id) {
  const it = ITEMS[id], P = G.save.player; if (it.type === 'key') return false;
  if (Object.values(P.eq).includes(id) && invCount(id) <= 1) { UI.toast("You can't sell what you're using."); return false; }
  if (!invTake(id)) return false; P.coins += sellPrice(id); Sfx.play('coin'); return true;
}
// ---------- camps, fast travel, sleep ----------
function campById(id) { return CAMPS.find((c) => c.id === id); }
function nearCamp() { const p = G.p; for (const c of CAMPS) if (Math.hypot(c.x - p.x, c.z - p.z) < 10) return c; return null; }
function enemiesNear(r = 40) { const p = G.p; return ACTORS.some((a) => !a.dead && a.kind === 'monster' && a.d.family !== 'animal' && a.aggro && Math.hypot(a.x - p.x, a.z - p.z) < r); }
function fastTravel(id) {
  const c = campById(id), p = G.p; if (!c || !G.save.player.camps.includes(id)) return;
  if (enemiesNear()) { UI.toast("You can't travel with monsters on your heels.", 'bad'); return; }
  const hours = Math.max(1, Math.round(Math.hypot(c.x - p.x, c.z - p.z) / 260));
  UI.fade(() => {
    if (p.mounted) dismount(); const a = Math.atan2(PLACES.ashford.x - c.x, PLACES.ashford.z - c.z);
    p.x = c.x + Math.sin(a) * 3; p.z = c.z + Math.cos(a) * 3; p.y = floorAt(p.x, p.z) + 0.1; p.vx = p.vz = p.vy = 0; p.yaw = Math.atan2(c.x - p.x, c.z - p.z);
    if (G.horse) { G.horse.x = c.x + Math.sin(a + 1.2) * 5; G.horse.z = c.z + Math.cos(a + 1.2) * 5; G.horse.y = floorAt(G.horse.x, G.horse.z); }
    for (const m of ACTORS.slice()) if (m.kind === 'monster' && !m.story && !m.contract) removeActor(m);
    passTime(hours * 60, true); updateTrees(p.x, p.z, true); updateGrass(p.x, p.z, true); UI.toast('You travel to ' + c.name + ' (' + hours + (hours === 1 ? ' hour' : ' hours') + ').'); autosave();
  });
}
function passTime(mins, travelling) {
  const sv = G.save.surv; let left = mins;
  while (left > 0) { const s = Math.min(30, left); left -= s; Clock.advance(s); sv.hunger = Math.max(0, sv.hunger - s * 0.07 * (sk('stomach') ? 0.8 : 1)); if (travelling) sv.fatigue = Math.min(100, sv.fatigue + s * 0.083); }
  updateTmpFires(mins); G.save.player.playTime += 0;
}
// sleep until a chosen hour; where decides how rested you get
function sleepUntil(hour, where) {
  const p = G.p, sv = G.save.surv;
  if (Clock.bloodMoon() && where !== 'home') { UI.toast('Nobody sleeps under the blood moon. Not out here.', 'blood'); return; }
  if (enemiesNear(50)) { UI.toast("You can't rest with monsters nearby.", 'bad'); return; }
  const now = Clock.minutes(); let mins = hour * 60 - now; if (mins <= 30) mins += 1440;
  UI.fade(() => {
    passTime(mins); const full = where === 'home' || where === 'inn';
    sv.fatigue = full ? 0 : Math.max(0, sv.fatigue - mins * 0.15); p.hp = full ? p.maxHp : Math.min(p.maxHp, p.hp + mins * 0.4); p.stam = p.maxStam; p.mana = p.maxMana; p.poison = 0; p.burn = 0;
    if (where === 'home' || where === 'inn') sv.warmth = 100; Sfx.play('rooster');
    UI.toast('You ' + (full ? 'sleep' : 'rest') + ' until ' + Clock.label() + '.'); autosave(); Contracts.refresh();
  }, 1.4);
}
function cookAll() {
  let n = 0; for (const e of G.save.player.inv.slice()) { const it = ITEMS[e.id]; if (it.raw && it.cook) { const k = e.n; invTake(e.id, k); invAdd(it.cook, k, true); n += k; } }
  if (n) { Sfx.play('fire_crackle'); UI.toast('You cook ' + n + ' piece' + (n > 1 ? 's' : '') + ' of meat.'); } else UI.toast('You have nothing raw to cook.'); return n;
}
// ---------- saves ----------
const Store = {
  KEY: 'bloodmoon.saves.v1', mode: 'local', db: null, uid: null, saves: {}, gone: {}, pending: {}, busy: {}, onChange: null,
  init() {
    const raw = LS.get(this.KEY, null);
    if (raw && typeof raw === 'object') { this.saves = raw.saves && typeof raw.saves === 'object' ? raw.saves : {}; this.gone = raw.gone || {}; }
    for (const id in this.saves) if (!this.valid(this.saves[id])) delete this.saves[id];
    this.tryCloud();
  },
  valid(s) { return s && typeof s === 'object' && typeof s.id === 'string' && s.player && Array.isArray(s.player.inv) && s.world && s.story; },
  writeLocal() { LS.set(this.KEY, { saves: this.saves, gone: this.gone }); },
  list() { return Object.values(this.saves).sort((a, b) => Math.max(b.lastLoaded || 0, b.lastSaved || 0) - Math.max(a.lastLoaded || 0, a.lastSaved || 0)); },
  get(id) { return this.saves[id] || null; },
  put(save) { this.saves[save.id] = JSON.parse(JSON.stringify(save)); delete this.gone[save.id]; this.writeLocal(); this.push(save.id); if (this.onChange) this.onChange(); },
  del(id) { delete this.saves[id]; this.gone[id] = Date.now(); this.writeLocal(); if (this.db && this.uid) { this.pending[id] = 'delete'; this.flush(id); } if (this.onChange) this.onChange(); },
  push(id) { if (this.db && this.uid) { this.pending[id] = 'set'; this.flush(id); } },
  async flush(id) {
    if (this.busy[id]) return; this.busy[id] = true;
    try {
      while (this.pending[id]) {
        const op = this.pending[id]; delete this.pending[id]; const ref = this.db.collection('data/users/' + this.uid).doc(id);
        try { if (op === 'delete') await ref.delete(); else if (this.saves[id]) await ref.set(this.saves[id]); }
        catch (e) {
          if (e && e.code === 'unavailable') { await new Promise((r) => setTimeout(r, 800 + Math.random() * 800)); try { if (op === 'delete') await ref.delete(); else if (this.saves[id]) await ref.set(this.saves[id]); } catch (e2) {} }
          else if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) { this.mode = 'local'; this.db = null; if (this.onChange) this.onChange(); return; }
        }
      }
    } finally { this.busy[id] = false; }
  },
  async tryCloud() {
    try {
      const c = window.claude; if (!c || typeof c.use !== 'function') return;
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]); if (!db || !user) return;
      const uid = await user.id(); if (!uid) return;
      const snap = await db.collection('data/users/' + uid).get(); this.db = db; this.uid = uid; this.mode = 'cloud'; const inCloud = {};
      for (const d of snap.docs) {
        const s = d.data(); if (!this.valid(s)) continue; inCloud[s.id] = true;
        if (this.gone[s.id] && this.gone[s.id] > (s.lastSaved || 0)) { this.pending[s.id] = 'delete'; this.flush(s.id); continue; }
        const mine = this.saves[s.id]; if (!mine || (s.lastSaved || 0) > (mine.lastSaved || 0) || (s.lastLoaded || 0) > (mine.lastLoaded || 0)) this.saves[s.id] = JSON.parse(JSON.stringify(s));
      }
      for (const id in this.saves) if (!inCloud[id]) this.push(id);
      this.writeLocal(); if (this.onChange) this.onChange();
    } catch (e) { /* stay on browser saves */ }
  },
};
const START = { x: -205, z: 112, yaw: 1.45 };
function newSave(name, look, diff) {
  const y = 20;
  return {
    id: 'bm' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), v: 1, name: name || 'Hunter', diff, created: Date.now(), lastSaved: 0, lastLoaded: Date.now(), playTime: 0,
    world: { min: 17 * 60 + 30, day: 1 }, story: { step: 'arrive', flags: {}, trail: 0, clues: 0, ending: null, endings: [] },
    player: { name: name || 'Hunter', look, level: 1, xp: 0, skillPts: 1, skills: {}, hp: null, mana: 60, coins: 40, corruption: 0, muts: [], trophies: {}, camps: ['ashford'], oil: null, stats: {},
      inv: [{ id: 'rusty_sword', n: 1 }, { id: 'traveler', n: 1 }, { id: 'draught', n: 3 }, { id: 'bread', n: 2 }, { id: 'apple', n: 2 }, { id: 'firewood', n: 2 }],
      eq: { sword: 'rusty_sword', bow: null, shield: null, armor: 'traveler', arrow: 'arrow' }, pos: { x: START.x, y, z: START.z, yaw: START.yaw }, area: 'outside' },
    surv: { hunger: 75, fatigue: 25, warmth: 70, warmT: 0, owlT: 0 },
    horse: { x: START.x, z: START.z, yaw: START.yaw, name: 'Ash', mounted: true }, contracts: { board: [], active: [], day: 0, done: 0, slain: [] }, herbs: {}, gate: false,
  };
}
function snapshotSave() {
  const S = G.save, p = G.p; if (!S || !p) return S;
  const P = S.player; P.hp = Math.max(1, p.hp); P.mana = p.mana;
  if (G.area === 'outside') { P.pos = { x: p.mounted ? p.mounted.x : p.x, y: p.y, z: p.mounted ? p.mounted.z : p.z, yaw: p.yaw }; P.area = 'outside'; }
  else { P.area = G.area; P.pos = { x: p.x, y: p.y, z: p.z, yaw: p.yaw }; }
  if (G.horse) S.horse = { x: G.horse.x, z: G.horse.z, yaw: G.horse.yaw, name: S.horse.name, mounted: !!p.mounted };
  return S;
}
function saveGame(silent) {
  if (!G.save || G.save.deleted || !G.p || G.p.dead || G.cine) return false;
  snapshotSave(); G.save.lastSaved = Date.now(); Store.put(G.save); if (!silent) UI.toast('Game saved.', 'small'); G.saveT = 0; return true;
}
function autosave() { if (saveGame(true)) UI.saveIcon(); }
