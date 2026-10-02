
// =====================================================================
// RUN STATE — the save being played, inventory, gear, and the stats that
// come from class, level, skills, gems and buffs.
// =====================================================================
const G = { later: [], on: false, save: null, p: null, area: null, mons: [], projs: [], picks: [], parts: [], texts: [], fx: [], corpses: [], zonesT: 0,
  time: 0, shake: 0, cam: { x: 0, y: 0 }, bossMon: null, autosaveT: 0, zoneT: 0, dead: false, invFullT: 0, dodgeTxtT: 0, cutscene: null, pet: null, statsV: 0, hitstop: 0, flash: 0 };
const FISTS = { id: null, name: 'Fists', wc: 'melee', dmg: 3, cd: 0.4, range: 17, arc: 90, icon: 'sword' };
const S = () => G.save.player;
const ST = () => G.save.story;
const gear = (k) => S().eq[k];
const weaponDef = () => (gear('weapon') ? ITEMS[gear('weapon').id] : FISTS);
const shieldDef = () => (gear('shield') ? ITEMS[gear('shield').id] : null);
const armorDef = () => (gear('armor') ? ITEMS[gear('armor').id] : null);
const DF = () => DIFF[G.save.diff] || DIFF.normal;
function later(sec, fn) { G.later.push({ t: G.time + sec, fn }); }
const darken = (hex, f = 0.75) => { const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
function heroLook(save) {
  const L = (save || G.save).look || {}, cls = CLASSES[(save || G.save).cls] || CLASSES.warrior;
  const shirt = L.shirt || cls.shirt;
  return { skin: L.skin || '#f0c08a', hair: L.hair || '#5a3417', hairStyle: L.hairStyle == null ? 3 : L.hairStyle, shirt, shirtDark: darken(shirt), pants: L.pants || cls.pants, shoes: '#25190f', belt: '#6b4a1e' };
}

// ---------- new saves & migration ----------
function newSaveData(o) {
  const now = Date.now(), C = CLASSES[o.cls] || CLASSES.warrior;
  const inv = new Array(INV_SIZE).fill(null);
  inv[0] = { id: 'map', n: 1 }; inv[1] = { id: 'potion', n: 3 };
  const g = (id) => (id ? newGear(id) : null);
  return { v: 2, fresh: true, id: 's' + now.toString(36) + Math.random().toString(36).slice(2, 7), name: o.name, cls: o.cls, look: o.look, diff: o.diff,
    created: now, lastLoaded: now, lastSaved: now,
    player: { level: 1, xp: 0, coins: 30, hp: null, map: 'home', x: 0, y: 0, sp: 0, skills: {}, specials: [C.specials[0], null, null, null], inv, eq: { weapon: g(C.start.weapon), shield: g(C.start.shield), armor: g(C.start.armor) }, pets: { owned: [], active: null, xp: {} } },
    world: { time: 23 * 60, day: 1, nights: 1 },
    story: { act: 1, flags: {}, notes: {}, seen: {}, seals: {}, ending: null, endings: {} },
    quests: { active: [], done: 0, offers: {}, freed: {} },
    stats: { kills: 0, chests: 0, deaths: 0, bosses: {}, playTime: 0, byType: {} } };
}
function normalizeSave(s) { // repairs and upgrades saves (version 1 had no classes, gear levels or story)
  const P = s.player = s.player || {};
  P.level = clamp(P.level | 0 || 1, 1, MAX_LVL); P.xp = Math.max(0, +P.xp || 0); P.coins = Math.max(0, Math.floor(+P.coins || 0));
  const fixGear = (e) => { if (!e) return null; if (typeof e === 'string') return ITEMS[e] && isGear(e) ? newGear(e) : null; if (!ITEMS[e.id] || !isGear(e.id)) return null; return { id: e.id, up: clamp(e.up | 0, 0, 10), gems: (e.gems || []).filter((g) => ITEMS[g] && ITEMS[g].type === 'gem').slice(0, SOCKETS[ITEMS[e.id].rarity]) }; };
  P.inv = (Array.isArray(P.inv) ? P.inv : []).slice(0, INV_SIZE).map((e) => {
    if (!e || !ITEMS[e.id]) return null;
    if (isGear(e.id)) { const g = fixGear(e); return g && Object.assign({ n: 1 }, g); }
    return { id: e.id, n: clamp(e.n | 0 || 1, 1, 99) };
  });
  while (P.inv.length < INV_SIZE) P.inv.push(null);
  if (!P.inv.some((e) => e && e.id === 'map')) { const i = P.inv.indexOf(null); if (i >= 0) P.inv[i] = { id: 'map', n: 1 }; }
  P.eq = P.eq || {}; for (const k of ['weapon', 'shield', 'armor']) { P.eq[k] = fixGear(P.eq[k]); if (P.eq[k] && ITEMS[P.eq[k].id].type !== k) P.eq[k] = null; }
  if (!CLASSES[s.cls]) s.cls = 'warrior';
  s.look = Object.assign({ skin: '#f0c08a', hair: '#5a3417', hairStyle: 3, shirt: '#3e6cb8', pants: '#4a3a2a' }, s.look || {});
  if (!DIFF[s.diff]) s.diff = 'normal';
  P.sp = Math.max(0, P.sp | 0); P.skills = P.skills || {};
  const spent = Object.values(P.skills).reduce((a, b) => a + b, 0); if (s.v !== 2) P.sp = Math.max(0, P.level - 1 - spent);
  const C = CLASSES[s.cls];
  P.specials = Array.isArray(P.specials) ? P.specials.slice(0, 4) : [C.specials[0]]; while (P.specials.length < 4) P.specials.push(null);
  P.specials = P.specials.map((id) => (id && SPECIALS[id] && C.specials.includes(id) ? id : null));
  if (!P.specials.some(Boolean)) P.specials[0] = C.specials[0];
  P.pets = Object.assign({ owned: [], active: null, xp: {} }, P.pets || {}); P.pets.owned = P.pets.owned.filter((k) => PETS[k]); if (!P.pets.owned.includes(P.pets.active)) P.pets.active = null;
  if (!REGIONS[P.map]) P.map = 'vale';
  s.world = Object.assign({ time: 8 * 60, day: 1, nights: 0 }, s.world || {});
  s.stats = Object.assign({ kills: 0, chests: 0, deaths: 0, bosses: {}, playTime: 0, byType: {} }, s.stats || {});
  s.story = Object.assign({ act: 1, flags: {}, notes: {}, seen: {}, seals: {}, ending: null, endings: {} }, s.story || {});
  if (s.v !== 2) { // old saves skip the opening and start at the right act
    s.story.seen.opening = true; s.story.flags.hasMap = true;
    if (s.stats.bosses.forge) s.story.act = 2;
  }
  s.quests = Object.assign({ active: [], done: 0, offers: {}, freed: {} }, s.quests || {});
  s.quests.active = s.quests.active.filter((q) => q && q.type);
  s.v = 2;
  return s;
}

// ---------- stats ----------
let _stats = null, _statsKey = '';
function gemCount(slot, id) { const g = gear(slot); return g ? g.gems.filter((x) => x === id).length : 0; }
function armorGems(id) { return gemCount('armor', id) + gemCount('shield', id); }
function sk(id) { return (S().skills && S().skills[id]) || 0; }
function PS() { // player stats, cached until something changes
  const P = S(), b = G.p ? G.p.buffs || {} : {};
  const key = G.statsV + '|' + P.level + '|' + (b.warcry > 0) + (b.eagle > 0);
  if (_stats && key === _statsKey) return _stats;
  const C = CLASSES[G.save.cls], w = weaponDef(), wg = gear('weapon'), ag = gear('armor'), sg = gear('shield'), arm = armorDef();
  const L = P.level;
  const st = {};
  st.maxHp = Math.round((100 + 14 * (L - 1)) * C.hp * (1 + 0.06 * sk('vitality')) * (1 + 0.1 * armorGems('ruby')));
  const wdmg = wg ? gearStats(wg).dmg : w.dmg;
  let classBonus = 1;
  if ((C.bonus === 'melee' && w.wc === 'melee') || (C.bonus === 'bow' && w.wc === 'bow') || (C.bonus === 'magic' && (w.wc === 'wand' || w.wc === 'staff')) || (C.bonus === 'fast' && w.cd <= 0.3)) classBonus = 1.15;
  st.dmg = (wdmg + 6 * gemCount('weapon', 'onyx')) * (1 + 0.05 * (L - 1)) * (1 + 0.05 * sk('power')) * (1 + 0.05 * armorGems('soul_gem')) * classBonus * (b.warcry > 0 ? 1.3 : 1);
  st.crit = 0.08 + (C.crit || 0) + 0.03 * sk('precision') + 0.08 * gemCount('weapon', 'topaz') + (b.eagle > 0 ? 0.4 : 0);
  st.critMult = 1.8 + 0.15 * sk('brutal');
  st.def = ((ag ? gearStats(ag).def : 0) + (C.def || 0) + 3 * sk('iron_skin') + 6 * armorGems('sapphire')) * (b.warcry > 0 ? 1.25 : 1);
  st.block = sg ? gearStats(sg).block : 0;
  st.parry = shieldDef() && shieldDef().parry ? shieldDef().parry : 0.2;
  st.speed = 80 * (1 + (C.speed || 0) + 0.04 * sk('swift') + 0.06 * armorGems('topaz') + ((arm && arm.speed) || 0));
  st.cdMult = (1 - 0.05 * sk('haste')) * (b.eagle > 0 && w.wc === 'bow' ? 0.8 : 1);
  st.dodgeCost = 20 * (C.dodgeCost || 1) * (1 - 0.15 * sk('light_step'));
  st.evade = 0.03 * sk('evasion');
  st.cdr = Math.max(0.4, 1 - ((C.cdr || 0) + 0.07 * sk('focus') + 0.08 * armorGems('onyx')));
  st.special = (1 + 0.1 * sk('arcana')) * (C.bonus === 'magic' ? 1.15 : 1);
  st.regen = 0.6 * sk('regen') + armorGems('emerald') + ((arm && arm.regen) || 0);
  st.potion = 1 + 0.15 * sk('alchemy') + 0.2 * armorGems('pearl');
  st.coins = (1 + 0.08 * sk('fortune')) * DF().loot; st.drops = (1 + 0.05 * sk('fortune')) * DF().loot;
  st.bloodlust = 0.02 * sk('bloodlust');
  st.burn = !!w.burn || gemCount('weapon', 'ruby') > 0; st.poison = !!w.poison || gemCount('weapon', 'emerald') > 0;
  st.freeze = w.slow ? 1 : 0.25 * gemCount('weapon', 'sapphire');
  st.lifesteal = (w.lifesteal || 0) + 0.03 * gemCount('weapon', 'soul_gem'); st.bossDmg = 1 + 0.12 * gemCount('weapon', 'pearl');
  _stats = st; _statsKey = key; return st;
}
function statsChanged() { G.statsV++; _stats = null; UI.invDirty(); }

// ---------- inventory ----------
const inv = () => S().inv;
function invAdd(id, n = 1, gearObj) {
  const it = ITEMS[id], I = inv(); let left = n;
  if (isGear(id)) { const i = I.indexOf(null); if (i < 0) return n; I[i] = Object.assign({ n: 1 }, gearObj || newGear(id)); UI.invDirty(); return 0; }
  if (STACKS(it)) for (let i = 0; i < INV_SIZE && left > 0; i++) { const s = I[i]; if (s && s.id === id && s.n < 99) { const k = Math.min(99 - s.n, left); s.n += k; left -= k; } }
  for (let i = 0; i < INV_SIZE && left > 0; i++) if (!I[i]) { const k = STACKS(it) ? Math.min(99, left) : 1; I[i] = { id, n: k }; left -= k; }
  if (left !== n) UI.invDirty();
  return left;
}
const invCount = (id) => inv().reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
function invTake(id, n) { const I = inv(); for (let i = 0; i < INV_SIZE && n > 0; i++) { const s = I[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) I[i] = null; } } UI.invDirty(); }
function invTakeAt(i, n = 1) { const s = inv()[i]; if (!s) return; s.n -= n; if (s.n <= 0) inv()[i] = null; UI.invDirty(); }
function equipFrom(i) {
  const s = inv()[i]; if (!s || !isGear(s.id)) return; const it = ITEMS[s.id], kind = it.type;
  if (S().level < it.lvl) { UI.toast(`${it.name} needs level ${it.lvl}`, 'bad'); Sfx.play('error'); return; }
  const old = S().eq[kind]; S().eq[kind] = { id: s.id, up: s.up || 0, gems: (s.gems || []).slice() };
  inv()[i] = old ? Object.assign({ n: 1 }, old) : null;
  UI.toast(`Equipped ${gearLabel(S().eq[kind])}`, 'good'); Sfx.play('pickup'); statsChanged();
}
function unequip(kind) {
  const g = S().eq[kind]; if (!g) return;
  const i = inv().indexOf(null); if (i < 0) { UI.toast('Bag is full', 'bad'); Sfx.play('error'); return; }
  inv()[i] = Object.assign({ n: 1 }, g); S().eq[kind] = null; UI.toast(`Unequipped ${gearLabel(g)}`); statsChanged();
}
function drinkAt(i) {
  const s = inv()[i]; if (!s) return; const it = ITEMS[s.id], p = G.p, mx = PS().maxHp;
  if (p.hp >= mx && !(it.stam && p.sta < p.maxSta)) { UI.toast('Already at full health'); return; }
  const heal = Math.round(it.heal * PS().potion);
  p.hp = Math.min(mx, p.hp + heal); if (it.stam) p.sta = p.maxSta;
  invTakeAt(i); Sfx.play('drink'); addText(p.x, p.y - 26, '+' + Math.min(heal, 9999) + ' HP', '#7dff8a');
  burst(p.x, p.y - 10, 10, '#ff9a9a', 50); UI.hudDirty();
}
function quickPotion() {
  const missing = PS().maxHp - G.p.hp; const I = inv(); let best = -1, bestHeal = 0;
  for (let i = 0; i < INV_SIZE; i++) { const s = I[i]; if (!s || ITEMS[s.id].type !== 'potion') continue; const h = ITEMS[s.id].heal;
    if (best < 0 || (bestHeal < missing ? h > bestHeal : h >= missing && h < bestHeal)) { best = i; bestHeal = h; } }
  if (best < 0) { UI.toast('No potions! Buy some from Mara.', 'bad'); Sfx.play('error'); return; }
  drinkAt(best);
}
function useSlot(i) {
  const s = inv()[i]; if (!s) return; const it = ITEMS[s.id];
  if (it.type === 'map') UI.openMap();
  else if (it.type === 'potion') drinkAt(i);
  else if (isGear(s.id)) equipFrom(i);
  else if (it.type === 'gem') UI.toast(`${it.name}: set it in your gear at Brom's forge. ${it.desc}`, 'gold');
  else if (it.type === 'quest') UI.toast('Deliver this parcel. Check your journal (J).', 'gold');
  else UI.toast(`${it.name}: sell it at a shop for ${sellPrice(s.id)} coins, or use it for upgrades at Brom's.`, 'gold');
}
function gainCoins(n) { S().coins += n; UI.hudDirty(); }
function gainXp(n) {
  const P = S(); if (P.level >= MAX_LVL) return;
  P.xp += n;
  while (P.level < MAX_LVL && P.xp >= xpNeed(P.level)) {
    P.xp -= xpNeed(P.level); P.level++; P.sp++;
    statsChanged(); G.p.hp = PS().maxHp; G.p.sta = G.p.maxSta;
    UI.toast(`LEVEL UP! Level ${P.level}. You got a skill point (K).`, 'gold big'); Sfx.play('level');
    burst(G.p.x, G.p.y - 10, 30, '#f2c13a', 90);
    const C = CLASSES[G.save.cls];
    for (const id of C.specials) if (SPECIALS[id].lvl === P.level) {
      UI.toast(`New special attack: ${SPECIALS[id].name}`, 'good');
      const free = P.specials.indexOf(null); if (free >= 0) P.specials[free] = id;
    }
    for (const d of DUNGEONS) if (d.lvl === P.level && !d.secret && d.act <= ST().act) UI.toast(`${d.name} is now open to you`, 'good');
    saveGame(true);
  }
  if (P.level >= MAX_LVL) P.xp = 0;
  UI.hudDirty();
}

// ---------- effects ----------
function addText(x, y, txt, col, big) { if (G.texts.length > 70) G.texts.shift(); G.texts.push({ x: x + rand(-4, 4), y, txt, col, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big }); }
function burst(x, y, n, col, spd = 60, grav = 0) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(spd * 0.3, spd); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, col, size: chance(0.3) ? 2 : 1, grav }); } if (G.parts.length > 700) G.parts.splice(0, G.parts.length - 700); }
function blood(x, y, col, n = 8) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(20, 80); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: rand(0.4, 0.8), max: 0.8, col, size: chance(0.4) ? 2 : 1, grav: 220, floor: y + rand(4, 10) }); } }
function shake(a) { if (SET.shake) G.shake = Math.max(G.shake, a); }
