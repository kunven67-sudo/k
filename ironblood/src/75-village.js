
// ---------- the village of Ashford: its people, their days, money, raids ----------
const money = (c) => { c = Math.max(0, Math.round(c)); const g = Math.floor(c / 240), s = Math.floor((c % 240) / 12), k = c % 12; return [g && g + 'g', s && s + 's', (k || (!g && !s)) && k + 'c'].filter(Boolean).join(' '); };
const hourNow = () => dayT * 24;
// plain medieval dyes
const DYE = { linen: 0xcfc3a8, white: 0xc2b69e, russet: 0x7a3b22, woad: 0x34506e, madder: 0x8a2a20, weld: 0xb39a4a, brown: 0x5b4330, dark: 0x3e342a, green: 0x4a5a30, moss: 0x3e4a2a, grey: 0x6f6a62, black: 0x2a2624, plum: 0x5a2a4a };

// everyone in Ashford: all grown adults with their own lives
const PERSONAS = [
  { id: 'wulf', name: 'Wulf', age: 52, sex: 'm', title: 'the blacksmith', home: 'h0', work: 'smithy', evening: 'tavern', armed: 'falchion', fighter: true, shop: 'smith', pitch: 0.8, family: ['hedda'],
    outfit: { top: DYE.brown, legs: DYE.dark, hood: true, hoodColor: DYE.grey, apron: true },
    desc: 'gruff and short with words, proud of his steel, protective of his daughter Hedda, does not trust knights', likes: ['steel', 'sword', 'forge', 'iron', 'work', 'blade', 'hammer', 'ale'], dislikes: ['lazy', 'flatter', 'cheat'],
    addr: 'knight', oath: 'Hmph.' },
  { id: 'hedda', name: 'Hedda', age: 24, sex: 'f', title: "the smith's daughter", home: 'h0', work: 'smithy', evening: 'square', armed: 'arming', fighter: true, romance: true, shop: 'smith', pitch: 1.0, family: ['wulf'],
    outfit: { top: DYE.russet, veil: true, hoodColor: DYE.linen, hoodKind: 'linen', apron: true },
    desc: 'blunt, strong, laughs loud, hates being treated as fragile, respects honest fighters, dreams of leaving to see the world', likes: ['sword', 'fight', 'strong', 'honest', 'adventure', 'travel', 'train', 'steel', 'world', 'spar'], dislikes: ['liar', 'coward', 'fragile', 'weak', 'pity'],
    gifts: { ring: 2, ribbon: 0, honeycake: 2, perfume: -1, flowers: 0, comb: 1 }, jealous: 0.4, bold: 0.9, warmth: 0.6, addr: 'you', oath: 'Ha!' },
  { id: 'godric', name: 'Godric', age: 46, sex: 'm', title: 'the innkeeper', home: 'tavern', work: 'tavern', evening: 'tavern', shop: 'tavern', pitch: 0.9,
    outfit: { top: DYE.russet, legs: DYE.brown, hood: true, hoodColor: DYE.brown, apron: true },
    desc: 'jolly, loud, loves a good story and a full purse, hates brawls in his inn', likes: ['ale', 'story', 'song', 'coin', 'food', 'stew', 'mead'], dislikes: ['brawl', 'thief', 'cheap'],
    addr: 'friend', oath: 'Ho there!' },
  { id: 'elske', name: 'Elske', age: 22, sex: 'f', title: 'the tavern maid', home: 'tavern', work: 'tavern', evening: 'tavern', romance: true, shop: 'tavern', pitch: 1.12,
    outfit: { top: DYE.madder, veil: true, hoodColor: DYE.white, hoodKind: 'linen', apron: true },
    desc: 'cheerful and teasing, flirts with everyone but guards her heart, loves songs and dancing, wants someone kind who makes her laugh', likes: ['song', 'sing', 'dance', 'laugh', 'joke', 'funny', 'kind', 'music', 'smile'], dislikes: ['rude', 'brute', 'cruel', 'shout'],
    gifts: { ribbon: 3, flowers: 3, perfume: 2, ring: 2, honeycake: 1, comb: 2 }, jealous: 0.7, bold: 0.6, warmth: 0.85, addr: 'love', oath: 'Oh, you!' },
  { id: 'agnes', name: 'Agnes', age: 63, sex: 'f', title: 'the healer', home: 'healer', work: 'healer', evening: 'home', shop: 'healer', pitch: 0.92,
    outfit: { top: DYE.green, veil: true, hoodColor: DYE.white, hoodKind: 'linen', cloak: true },
    desc: 'old, wise and stern, has stitched more knights than she can count, hates needless killing', likes: ['herb', 'peace', 'honest', 'pray', 'heal'], dislikes: ['kill', 'waste', 'blood', 'boast'],
    addr: 'child', oath: 'Mercy.' },
  { id: 'isolde', name: 'Isolde', age: 26, sex: 'f', title: "the healer's apprentice", home: 'healer', work: 'healer', evening: 'square', romance: true, shop: 'healer', pitch: 1.06,
    outfit: { top: DYE.woad, veil: true, hoodColor: DYE.linen, hoodKind: 'linen' },
    desc: 'gentle, quiet and shy, reads the stars and knows every herb, hates needless killing, opens up slowly to someone patient and kind', likes: ['herb', 'star', 'flower', 'book', 'gentle', 'kind', 'peace', 'heal', 'quiet', 'moon', 'read'], dislikes: ['kill', 'shout', 'blood', 'boast', 'cruel'],
    gifts: { flowers: 4, perfume: 1, ring: 2, ribbon: 1, honeycake: 1, comb: 1 }, jealous: 0.3, bold: 0.2, warmth: 0.9, shy: true, addr: 'ser', oath: 'Oh.' },
  { id: 'maren', name: 'Maren', age: 28, sex: 'f', title: 'the huntress', home: 'h1', work: 'woods', evening: 'tavern', armed: 'arming', fighter: true, romance: true, pitch: 0.98,
    outfit: { dress: false, top: DYE.green, legs: DYE.dark, hood: true, hoodColor: DYE.moss, cloak: true },
    desc: 'bold and sharp-tongued, independent, a skilled hunter who mocks weakness, drawn to danger and courage, wants a partner who can keep up with her', likes: ['hunt', 'fight', 'brave', 'courage', 'forest', 'deer', 'wild', 'sword', 'kill', 'knight', 'danger'], dislikes: ['coward', 'boring', 'clingy', 'liar', 'weak'],
    gifts: { ring: 1, ribbon: -1, flowers: 0, perfume: -1, honeycake: 2, comb: 0 }, jealous: 0.5, bold: 1, warmth: 0.5, addr: 'big man', oath: 'Tch.' },
  { id: 'rosalind', name: 'Rosalind', age: 30, sex: 'f', title: 'the cloth merchant', home: 'h2', work: 'stall0', evening: 'square', romance: true, shop: 'gifts', pitch: 1.04,
    outfit: { top: DYE.weld, veil: true, hoodColor: DYE.white, hoodKind: 'linen', cloak: true },
    desc: 'clever and witty, ambitious, loves fine things and a hard bargain, gets jealous fast, wants someone with means and a quick mind', likes: ['coin', 'gold', 'silk', 'fine', 'clever', 'wit', 'trade', 'rich', 'jewel', 'ring'], dislikes: ['poor', 'dull', 'cheap', 'rude', 'stupid'],
    gifts: { ring: 4, perfume: 3, ribbon: 1, flowers: 1, honeycake: 0, comb: 2 }, jealous: 0.95, bold: 0.7, warmth: 0.5, addr: 'my lord', oath: 'Well now.' },
  { id: 'odo', name: 'Odo', age: 38, sex: 'm', title: 'the baker', home: 'h3', work: 'stall1', evening: 'tavern', shop: 'bakery', pitch: 0.95,
    outfit: { top: DYE.linen, legs: DYE.brown, hood: true, hoodColor: DYE.linen, hoodKind: 'linen', apron: true },
    desc: 'round, friendly and nervous, gossips about everyone, terrified of knights', likes: ['bread', 'cake', 'honey', 'gossip', 'food'], dislikes: ['knight', 'blood', 'fight'], addr: 'ser', oath: 'Oh dear.' },
  { id: 'bertram', name: 'Bertram', age: 44, sex: 'm', title: 'the farmer', home: 'h4', work: 'field', evening: 'tavern', pitch: 0.86, family: ['alys'],
    outfit: { top: DYE.grey, legs: DYE.brown, hood: true, hoodColor: DYE.brown },
    desc: 'tired and plain-spoken, married to Alys, worried about the harvest and the raids', likes: ['harvest', 'rain', 'field', 'ale', 'alys'], dislikes: ['knight', 'raid', 'drought'], addr: 'ser', oath: 'Aye.' },
  { id: 'alys', name: 'Alys', age: 40, sex: 'f', title: "the farmer's wife", home: 'h4', work: 'field', evening: 'home', pitch: 1.0, family: ['bertram'], married: true,
    outfit: { top: DYE.brown, veil: true, hoodColor: DYE.linen, hoodKind: 'linen', apron: true },
    desc: 'practical and kind, married to Bertram and happy with him, mothers the whole village', likes: ['kind', 'help', 'bread', 'field'], dislikes: ['rude', 'blood', 'kill'], addr: 'dear', oath: 'Goodness.' },
  { id: 'tobin', name: 'Tobin', age: 33, sex: 'm', title: 'the woodcutter', home: 'h5', work: 'woods', evening: 'tavern', pitch: 0.9,
    outfit: { top: DYE.russet, legs: DYE.dark, hood: true, hoodColor: DYE.green },
    desc: 'quiet and strong, likes trees more than people, makes dry jokes', likes: ['wood', 'tree', 'axe', 'forest', 'quiet'], dislikes: ['noise', 'fire'], addr: 'friend', oath: 'Mm.' },
  { id: 'edric', name: 'Edric', age: 35, sex: 'm', title: 'the village watchman', home: 'h6', work: 'square', evening: 'tavern', armed: 'longsword', fighter: true, pitch: 0.88,
    outfit: { top: DYE.grey, topKind: 'boucle', legs: DYE.dark, hood: true, hoodColor: DYE.black, cloak: true },
    desc: 'stern former soldier who guards Ashford alone, respects strength but watches you closely', likes: ['sword', 'guard', 'duty', 'fight', 'brave', 'train'], dislikes: ['thief', 'coward', 'trouble'], addr: 'stranger', oath: 'Hm.' },
  { id: 'piers', name: 'Piers', age: 50, sex: 'm', title: 'the drunk', home: 'h7', work: 'tavern', evening: 'tavern', pitch: 0.84,
    outfit: { top: DYE.grey, legs: DYE.brown, hood: true, hoodColor: DYE.grey },
    desc: 'always drunk, rambling, funny, once a soldier, tells wild stories that are sometimes true', likes: ['ale', 'mead', 'drink', 'story', 'war'], dislikes: ['water', 'sober', 'priest'], addr: 'lad', oath: 'Hic.' },
  { id: 'ulric', name: 'Ulric', age: 67, sex: 'm', title: 'the wandering mage', home: 'tavern', work: 'square', evening: 'tavern', shop: 'magic', pitch: 0.78,
    outfit: { dress: true, top: DYE.woad, legs: DYE.dark, hood: true, hoodColor: 0x23304a, cloak: true },
    desc: 'an old traveling mage of the Water school who has stopped in Ashford, patient teacher, dry humor, sells lessons; warns that running out of mana makes you faint; says the most dangerous being alive is @@DRAGON_SHORT@@, a silver-haired man who walks the north mountains, and that you must never talk to him; calls the @@MANGOD@@ a liar who whispers sweet help in dreams; has heard of a hungry demon empress with horns who wanders at night and grants demon eyes to those who feed her',
    likes: ['magic', 'mana', 'spell', 'book', 'learn', 'study', 'water', 'chant', 'tea', 'student'], dislikes: ['lazy', 'arrogant', 'reckless', 'fire'], addr: 'young one', oath: 'Hm hm.' },
];
const PERSONA = Object.fromEntries(PERSONAS.map(p => [p.id, p]));

// ---------- what you own ----------
const ITEMS = {
  bread: { name: 'Bread', heal: 10 }, stew: { name: 'Bowl of stew', heal: 25 }, draught: { name: 'Healing draught', heal: 50, stopBleed: true },
  honeycake: { name: 'Honey cake', heal: 6, gift: true }, flowers: { name: 'Wildflowers', gift: true }, ribbon: { name: 'Silk ribbon', gift: true },
  comb: { name: 'Carved comb', gift: true }, perfume: { name: 'Rose perfume', gift: true }, ring: { name: 'Silver ring', gift: true },
  manadraught: { name: 'Mana draught', mana: 45 },
};
const vsave = { coins: 30, items: {}, goods: [], owned: ['arming'], armorLvl: 0, edge: 0, day: 1, anger: {}, people: {}, ally: null };
try { Object.assign(vsave, JSON.parse(localStorage.getItem('ironblood.village') || '{}')); } catch (e) {}
for (const p of PERSONAS) vsave.people[p.id] = Object.assign({ alive: true, opinion: 0, fear: 0, aff: 0, stage: 'stranger', mem: [], gainDay: 0, gained: 0, pending: [], metDay: 0, kissedDay: 0 }, vsave.people[p.id] || {});
let vDirty = false, vSaveT = 0;
function vSave() { vDirty = true; }
function vFlush(dt) { vSaveT -= dt; if (vDirty && vSaveT <= 0) { vSaveT = 4; vDirty = false; try { localStorage.setItem('ironblood.village', JSON.stringify(vsave)); } catch (e) {} } }
function remember(st, text) { st.mem.push('Day ' + vsave.day + ': ' + text); if (st.mem.length > 8) st.mem.shift(); vSave(); }
function addCoins(c) { vsave.coins = Math.max(0, Math.round(vsave.coins + c)); vSave(); }
function addItem(id, n = 1) { vsave.items[id] = (vsave.items[id] || 0) + n; if (vsave.items[id] <= 0) delete vsave.items[id]; vSave(); }

// ---------- where things are ----------
const SPOTS = {};
function villageSpots() {
  const houses = VHOUSES.filter(h => h.kind === 'house');
  SPOTS.tavern = VHOUSES.find(h => h.kind === 'tavern');
  SPOTS.smithy = VHOUSES.find(h => h.kind === 'smithy');
  SPOTS.healer = VHOUSES.find(h => h.kind === 'healer');
  houses.forEach((h, i) => { SPOTS['h' + i] = h; });
  // fields and the wood's edge: open ground just outside the houses
  const ring = (dist, n) => {
    const out = [];
    for (let i = 0; i < 64 && out.length < n; i++) {
      const a = i * 2.4, x = SQUARE.x + Math.cos(a) * dist, z = SQUARE.z + Math.sin(a) * dist;
      if (solidAt(x, z, 2) || riverDist(x, z) < 14 || slopeAt(x, z) > 0.35) continue;
      out.push({ x, z });
    }
    return out;
  };
  SPOTS.fields = ring(62, 4); SPOTS.woods = ring(84, 4);
}
// the spot a person wants to be at right now, from their daily routine
function scheduleSpot(p, h) {
  const home = SPOTS[p.home] || SPOTS.h0;
  if (h >= 22 || h < 6) return { ...home.door, inside: true, slot: 'sleep' };
  if (h < 7.5) return { ...jit(home.door, 1.5), slot: 'morning' };
  const where = h < 18 ? p.work : p.evening;
  const slot = h < 18 ? 'work' : 'evening';
  if (where === 'home') return h >= 20 ? { ...home.door, inside: true, slot } : { ...jit(home.door, 2), slot };
  if (where === 'smithy') return { ...jit(SPOTS.smithy.work, 0.8), slot, face: SPOTS.smithy };
  if (where === 'tavern' || where === 'healer') { const b = SPOTS[where]; return { ...jit(b.door, where === 'tavern' && slot === 'evening' ? 3.5 : 1.6), slot }; }
  if (where.startsWith('stall')) { const s = VSTALLS[+where[5]] || VSTALLS[0]; return { ...s.front, slot, face: s }; }
  if (where === 'field' || where === 'woods') { const list = where === 'field' ? SPOTS.fields : SPOTS.woods; const s = list[(p.id.charCodeAt(0) + p.id.length) % Math.max(1, list.length)] || SQUARE; return { ...jit(s, 5), slot, wander: 7 }; }
  const a = Math.random() * 6.28, r = 3.5 + Math.random() * 8;
  return { x: SQUARE.x + Math.cos(a) * r, z: SQUARE.z + Math.sin(a) * r, slot, wander: 9 };
}
function jit(p, r) { const a = Math.random() * 6.28, d = Math.random() * r; return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }; }

// ---------- the people themselves ----------
const villagers = [];
function personFor(id) { return villagers.find(v => v.vill.p.id === id); }
function spawnVillager(p) {
  const st = vsave.people[p.id];
  const f = new Fighter({ tier: p.fighter ? 5 : 4, team: 'villager', outfit: { sex: p.sex, face: p.id, ...p.outfit }, body: p.sex === 'f' ? 0x6e5848 : 0x5e4a3c, sword: null, scale: p.sex === 'f' ? 0.93 : 1 + (p.id.length % 3) * 0.02, name: p.name });
  f.voicePitch = (p.sex === 'f' ? 1.45 : 1) * p.pitch;
  f.vill = { p, st, mode: 'life', goal: null, slot: '', wait: 0, stuckT: 0, lx: 0, lz: 0, detourT: 0, dx: 0, dz: 0, talkT: 0, fleeT: 0 };
  f.purse = 3 + Math.floor(Math.random() * 20);
  const g = scheduleSpot(p, hourNow());
  f.pos.set(g.x, groundH(g.x, g.z), g.z);
  collideFighter(f); f.pos.y = groundH(f.pos.x, f.pos.z);
  f.facing = Math.random() * 6.28;
  f.vill.goal = g; f.vill.slot = g.slot;
  if (g.inside) setInside(f, true);
  villagers.push(f);
  return f;
}
function setInside(f, v) { f.inside = v; f.root.visible = !v; if (v) { f.vel.set(0, 0, 0); f.speed = 0; } }
function arm(f) { if (!f.hasSword && f.vill.p.armed && !f.severed.includes('RightArm') && !f.severed.includes('RightForeArm')) f.setSword(SWORDS.find(s => s.id === f.vill.p.armed)); }
function disarm(f) { if (f.hasSword && f.alive) { scene.remove(f.swordMesh); f.hasSword = false; f.swordMesh = null; f.attack = null; f.blocking = false; } }
// a villager picks up their sword and fights (raids, defending themselves, or with you)
function toFight(f, opt = {}) {
  if (talkWho() === f) endTalk();
  arm(f);
  if (!f.hasSword) return toFlee(f);
  if (f.inside) { setInside(f, false); const d = (SPOTS[f.vill.p.home] || SPOTS.h0).door; f.pos.set(d.x, groundH(d.x, d.z), d.z); }
  f.vill.mode = opt.follow ? 'ally' : 'fight';
  f.team = opt.follow ? 'ally' : 'villager';
  f.ai = { state: 'patrol', camp: { x: f.pos.x, z: f.pos.z }, wait: 0, tx: f.pos.x, tz: f.pos.z, alert: !!opt.alert, strafe: 1, strafeT: 0, cd: 0.6, blockT: 0, courage: f.vill.p.bold ?? 0.7, shouted: true, react: 0, crawlT: 0, follow: !!opt.follow };
}
function toLife(f) {
  if (f.ai && f.ai.attacking) { f.ai.attacking.tokens = Math.max(0, (f.ai.attacking.tokens || 1) - 1); }
  f.ai = null; f.team = 'villager'; f.angryAtYou = false; f.vill.mode = 'life'; f.vill.goal = null; f.blocking = false;
  disarm(f);
}
function toFlee(f) { if (f.vill.mode === 'ally') return; if (talkWho() === f) endTalk(); f.ai = null; f.vill.mode = 'flee'; f.vill.fleeT = 25 + Math.random() * 15; }

const _vw = new THREE.Vector3(), _zero = new THREE.Vector3();
function walkTo(f, tx, tz, speed, dt) {
  const v = f.vill;
  let gx = tx, gz = tz;
  if (v.detourT > 0) { v.detourT -= dt; gx = v.dx; gz = v.dz; }
  const dx = gx - f.pos.x, dz = gz - f.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.45) { if (v.detourT > 0) { v.detourT = 0; return false; } stepFighter(f, dt, _zero, 0, null); return true; }
  stepFighter(f, dt, _vw.set(dx / d, 0, dz / d), speed * f.legMult, Math.atan2(dx, dz), 6);
  // walked into a wall? go round it
  v.stuckT += dt;
  if (v.stuckT > 1.0) {
    const moved = Math.hypot(f.pos.x - v.lx, f.pos.z - v.lz);
    if (moved < 0.3 * speed && v.detourT <= 0) {
      const rx = tx - f.pos.x, rz = tz - f.pos.z, rd = Math.hypot(rx, rz) || 1, side = Math.random() < 0.5 ? 1 : -1, len = 3.5 + Math.random() * 3;
      v.dx = f.pos.x + (-rz / rd) * side * len - (rx / rd) * 1.2; v.dz = f.pos.z + (rx / rd) * side * len - (rz / rd) * 1.2; v.detourT = 2.4;
    }
    v.stuckT = 0; v.lx = f.pos.x; v.lz = f.pos.z;
  }
  return false;
}
function nearestThreat(f, r) {
  let best = null, bd = r;
  for (const o of fighters) { if (o.team !== 'knight' || !o.alive || o.down) continue; const d = o.pos.distanceTo(f.pos); if (d < bd) { bd = d; best = o; } }
  return best;
}
function updateVillager(f, dt) {
  const v = f.vill, p = v.p;
  if (!f.alive) { f.updateFall(dt); return; }
  if (f.ai) return; // fighting: the knight brain drives them
  tickVitals(f, dt);
  if (!f.alive) return;
  if (f.knock) { updateKnock(f, dt); return; }
  if (f.lift) return;
  if (f.burning > 1 && !f.down) {
    // on fire: run for the river screaming
    if (v.mode === 'talk') endTalk();
    const rp = RIVER.reduce((b, p) => { const d = Math.hypot(p[0] - f.pos.x, p[1] - f.pos.z); return d < b.d ? { d, p } : b; }, { d: 1e9, p: null }).p;
    walkTo(f, rp[0], rp[1], 4.8, dt);
    return;
  }
  if (f.down) { f.updateFall(dt); if (Math.random() < dt * 0.5) sfx.voice(f.pos, 'hurt', f.voicePitch); return; }
  const h = hourNow();
  // knights close by: armed villagers fight, the rest run home and bar the door
  if (v.mode === 'life' || v.mode === 'talk') {
    const th = nearestThreat(f, raid.active ? 45 : 16);
    if (th && th.ai && th.ai.alert || (th && raid.active)) { if (v.mode === 'talk') endTalk(); if (p.fighter && !p.married && f.hp > f.maxHp * 0.35) toFight(f, { alert: true }); else toFlee(f); return; }
  }
  if (v.mode === 'talk' || v.mode === 'scene') {
    if (v.mode === 'talk') { const d = _vw.copy(player.pos).sub(f.pos); f.facing = angleLerp(f.facing, Math.atan2(d.x, d.z), Math.min(1, dt * 5)); }
    stepFighter(f, dt, _zero, 0, null);
    return;
  }
  if (v.mode === 'flee') {
    const home = (SPOTS[p.home] || SPOTS.h0).door;
    if (!f.inside) { if (walkTo(f, home.x, home.z, 4.6, dt)) setInside(f, true); if (Math.random() < dt * 0.25) sfx.voice(f.pos, p.sex === 'f' ? 'scream' : 'shout', f.voicePitch); }
    v.fleeT -= dt;
    if (v.fleeT <= 0 && !raid.active && !nearestThreat(f, 35)) { v.mode = 'life'; v.goal = null; }
    return;
  }
  // everyday life
  if (!v.goal || v.slotCheck === undefined || (v.slotCheck -= dt) <= 0) {
    v.slotCheck = 3;
    const want = scheduleSpot(p, h);
    if (!v.goal || want.slot !== v.slot || want.inside !== v.goal.inside) { v.goal = want; v.slot = want.slot; v.wait = Math.random() * 4; }
  }
  const g = v.goal;
  if (f.inside) {
    if (!g.inside) { setInside(f, false); const d = (SPOTS[p.home] || SPOTS.h0).door; f.pos.set(d.x, groundH(d.x, d.z), d.z); }
    return;
  }
  if (v.wait > 0) { v.wait -= dt; stepFighter(f, dt, _zero, 0, g.face ? Math.atan2(g.face.x - f.pos.x, g.face.z - f.pos.z) : null); return; }
  const late = h >= 21.5 || (h >= 5.5 && h < 6);
  if (walkTo(f, g.x, g.z, late ? 2.2 : 1.35, dt)) {
    if (g.inside) { setInside(f, true); return; }
    v.wait = 4 + Math.random() * 10;
    if (g.wander) { const a = Math.random() * 6.28, r = Math.random() * g.wander; v.goal = { ...g, x: g.x + Math.cos(a) * r * 0.5, z: g.z + Math.sin(a) * r * 0.5 }; }
  }
}

// ---------- what people think of you ----------
function witnesses(at, r, except) { return villagers.filter(o => o !== except && o.alive && !o.inside && o.pos.distanceTo(at) < r); }
function spreadWord(fromWho, text, dOpinion, dFear, delayH = 1) {
  for (const o of villagers) {
    if (!o.alive || o === fromWho) continue;
    o.vill.st.pending.push({ at: vsave.day * 24 + hourNow() + delayH * (0.5 + Math.random()), text, dOpinion, dFear });
  }
  vSave();
}
function processGossip() {
  const t = vsave.day * 24 + hourNow();
  for (const o of villagers) {
    const st = o.vill.st;
    if (!st.pending.length) continue;
    const due = st.pending.filter(g => g.at <= t);
    if (!due.length) continue;
    st.pending = st.pending.filter(g => g.at > t);
    for (const g of due) {
      if (g.jealous) { jealousy(o, g.text, false); continue; }
      st.opinion = clampO(st.opinion + g.dOpinion); st.fear = Math.min(100, st.fear + g.dFear);
      remember(st, 'heard ' + g.text);
    }
  }
}
const clampO = (v) => Math.max(-100, Math.min(100, v));
hitHooks.push((victim, by, dmg) => {
  if (!victim.vill || !by) return;
  const st = victim.vill.st;
  if (by.isPlayer) {
    st.opinion = clampO(st.opinion - 20 - dmg * 0.3); st.fear = Math.min(100, st.fear + 25);
    remember(st, 'the dark knight cut me with his sword');
    if (victim.vill.mode === 'talk') endTalk();
    if (victim.vill.mode === 'ally') { victim.ai.follow = false; vsave.ally = null; }
    const fightBack = victim.vill.p.fighter && victim.hp > victim.maxHp * 0.3;
    if (fightBack) { victim.angryAtYou = true; if (!victim.ai || victim.ai.follow) toFight(victim, { alert: true }); if (victim.ai) { victim.ai.target = player; victim.ai.pickT = 8; } }
    else toFlee(victim);
    for (const w of witnesses(victim.pos, 22, victim)) {
      w.vill.st.opinion = clampO(w.vill.st.opinion - 8); w.vill.st.fear = Math.min(100, w.vill.st.fear + 15);
      if (w.vill.p.fighter && (w.vill.p.bold || 0.7) > 0.5 && !w.vill.p.married && w.vill.mode !== 'ally') { w.angryAtYou = true; if (!w.ai) toFight(w, { alert: true }); if (w.ai) { w.ai.target = player; w.ai.pickT = 8; } }
      else if (w.vill.mode !== 'ally' && w.vill.mode !== 'fight') toFlee(w);
    }
  } else if (by.team === 'knight' && !victim.ai) { if (victim.vill.p.fighter && victim.hp > victim.maxHp * 0.35) toFight(victim, { alert: true }); else toFlee(victim); }
});
deathHooks.push((victim, by, how) => {
  const mine = by && (by.isPlayer || by.team === 'ally');
  if (victim.team === 'knight' && mine && victim.houseName) {
    // every knight you kill makes his house want revenge on Ashford
    vsave.anger[victim.houseName] = (vsave.anger[victim.houseName] || 0) + 1 + victim.tier * 0.6;
    if (victim.ai && victim.ai.raid) for (const w of villagers) if (w.alive && w.pos.distanceTo(victim.pos) < 70) { w.vill.st.opinion = clampO(w.vill.st.opinion + 4); w.vill.st.fear = Math.max(0, w.vill.st.fear - 4); if (Math.random() < 0.3) remember(w.vill.st, 'the dark knight killed a raider in Ashford'); }
    if (personFor('maren') && personFor('maren').alive) { const st = vsave.people.maren; if (st.opinion > -20 && Math.random() < 0.25) st.aff = Math.min(100, st.aff + 1); }
    vSave();
  }
  if (victim.vill) {
    const st = victim.vill.st, p = victim.vill.p;
    st.alive = false;
    if (victim === talkWho()) endTalk();
    if (vsave.ally === p.id) vsave.ally = null;
    if (by && by.isPlayer) {
      for (const w of witnesses(victim.pos, 35, victim)) { w.vill.st.opinion = clampO(w.vill.st.opinion - 55); w.vill.st.fear = Math.min(100, w.vill.st.fear + 50); remember(w.vill.st, 'watched the dark knight murder ' + p.name); if (w.vill.p.romance) w.vill.st.aff = Math.max(0, w.vill.st.aff - 45); }
      spreadWord(victim, 'that the dark knight murdered ' + p.name, -30, 30, 1);
      for (const id of p.family || []) { const fs = vsave.people[id]; if (fs) { fs.opinion = -100; fs.aff = 0; if (fs.stage === 'courting' || fs.stage === 'lover') fs.stage = 'ex'; } }
      ui.message('YOU MURDERED ' + p.name.toUpperCase(), 2.5);
    } else spreadWord(victim, 'that ' + p.name + ' was killed by knights', 0, 10, 0.5);
    vSave();
  }
});

// ---------- coins, loot, what you carry ----------
function onPlayerDeathVillage() {
  const lost = Math.floor(vsave.coins * 0.5);
  if (lost > 0) { addCoins(-lost); setTimeout(() => ui.sub('Someone emptied your purse while you lay dying: lost ' + money(lost), 4), 400); }
  if (vsave.ally) { const a = personFor(vsave.ally); if (a && a.alive) toLife(a); vsave.ally = null; }
}
function lootBody(o) {
  const got = [];
  if (o.purse > 0) { addCoins(o.purse); got.push(money(o.purse)); o.purse = 0; }
  if (o.loot) { vsave.goods.push({ name: o.loot[0], value: o.loot[1] }); got.push(o.loot[0].toLowerCase()); o.loot = null; vSave(); }
  if (got.length) { sfx.coins(); ui.sub('Took ' + got.join(' and '), 2.5); }
  if (o.vill) for (const w of witnesses(o.pos, 20)) { w.vill.st.opinion = clampO(w.vill.st.opinion - 12); remember(w.vill.st, 'saw the dark knight rob the body of ' + o.vill.p.name); }
}
function useHealItem() {
  const f = player;
  const id = ['draught', 'stew', 'bread', 'honeycake'].find(k => vsave.items[k] > 0);
  if (!id) { ui.sub('No food or draughts. Buy some at the tavern or the healer.', 2); return; }
  if (f.hp >= f.maxHp && f.bleed < 0.05) { ui.sub('You are not hurt', 1.2); return; }
  const it = ITEMS[id];
  addItem(id, -1);
  f.hp = Math.min(f.maxHp, f.hp + it.heal);
  if (it.stopBleed) f.bleed = 0;
  sfx.ui(380); ui.sub((id === 'draught' ? 'Drank a healing draught' : 'Ate the ' + it.name.toLowerCase()) + ' (+' + it.heal + ' health)', 1.8);
}
function goodsSummary() { return vsave.goods.length ? vsave.goods.length + ' goods to sell' : ''; }

// ---------- drink ----------
let drunk = 0, passedOut = 0;
function drinkAle(strength) {
  drunk += strength;
  player.hp = Math.min(player.maxHp, player.hp + 4);
  if (drunk > 1.25) setTimeout(passOut, 1800);
}
function passOut() {
  if (!player.alive || passedOut > 0) return;
  passedOut = 1;
  endTalk(); closeShop();
  fadeTo(1, 1.2, () => {
    dayT = (dayT + 3 / 24) % 1;
    const inTavern = SPOTS.tavern && player.pos.distanceTo(new THREE.Vector3(SPOTS.tavern.door.x, player.pos.y, SPOTS.tavern.door.z)) < 10;
    const lost = Math.floor(vsave.coins * (inTavern ? 0.15 : 0.3 + Math.random() * 0.4));
    addCoins(-lost);
    drunk = 0.45;
    setTimeout(() => fadeTo(0, 2.5, () => { passedOut = 0; ui.sub('You wake up on the ground with a pounding head.' + (lost > 0 ? ' Your purse is ' + money(lost) + ' lighter.' : ''), 5); }), 900);
  });
}
function fadeTo(a, dur, done) {
  const el = document.getElementById('fade');
  el.style.transition = 'opacity ' + dur + 's'; el.style.opacity = a;
  setTimeout(() => done && done(), dur * 1000 + 50);
}
function sleepAtInn() {
  closeShop(); endTalk();
  cutscene = true;
  fadeTo(1, 1.4, () => {
    // past 7 AM the clock wraps to tomorrow, and the day counter ticks over by itself
    dayT = 7 / 24;
    const f = player;
    f.hp = f.maxHp; f.bleed = 0; f.stamina = 100; drunk = 0;
    for (const k in f.parts) if (!f.parts[k].gone) f.parts[k].hp = Math.min(f.parts[k].max, f.parts[k].hp + f.parts[k].max * 0.6);
    for (const v of villagers) if (v.vill) { v.vill.goal = null; }
    vSave();
    setTimeout(() => fadeTo(0, 2, () => { cutscene = false; ui.message('MORNING', 1.6); ui.sub('You slept at The Red Boar. Day ' + vsave.day + '.', 3); requestLock(); }), 800);
  });
}

// ---------- raids: the houses come for revenge ----------
const raid = { active: false, house: null, members: [], t: 0, burning: [], nextCheck: 0, cool: 0 };
function raidCheck(dt) {
  raid.cool -= dt;
  if (raid.active) {
    raid.t += dt;
    raid.members = raid.members.filter(m => m.alive);
    // raiders torch houses they walk past
    for (const m of raid.members) {
      if (m.down || raid.burning.length >= 4 || Math.random() > dt * 0.06) continue;
      const h = VHOUSES.find(b => b.kind !== 'smithy' && Math.hypot(b.x - m.pos.x, b.z - m.pos.z) < Math.max(b.w, b.d) / 2 + 5 && !raid.burning.some(x => x.house === b));
      if (h) burnHouse(h);
    }
    if (raid.members.length === 0 || raid.t > 150) endRaid(raid.members.length === 0);
  }
  for (let i = raid.burning.length - 1; i >= 0; i--) {
    const b = raid.burning[i]; b.t -= dt;
    if (Math.random() < dt * 9) smoke.emit(b.top.x + (Math.random() - 0.5) * 3, b.top.y, b.top.z + (Math.random() - 0.5) * 3, 1);
    if (b.t <= 0) { for (const e of b.fires) removeFire(e); raid.burning.splice(i, 1); }
  }
  if (raid.active || raid.cool > 0 || !player.alive) return;
  raid.nextCheck -= dt;
  if (raid.nextCheck > 0) return;
  raid.nextCheck = DAY_SECONDS / 24; // once an hour of game time
  if (Math.hypot(player.pos.x - SQUARE.x, player.pos.z - SQUARE.z) > 220) return;
  const list = Object.entries(vsave.anger).filter(([, a]) => a >= 2).sort((a, b) => b[1] - a[1]);
  for (const [house, anger] of list) if (Math.random() < Math.min(0.4, (anger - 1) * 0.02)) { startRaid(house, anger); break; }
}
function startRaid(houseName, anger) {
  const camp = CAMPS.find(c => c.house.name === houseName) || CAMPS[0];
  const n = Math.min(7, 2 + Math.floor(anger / 3));
  const dx = camp.x - SQUARE.x, dz = camp.z - SQUARE.z, d = Math.hypot(dx, dz) || 1;
  const at = { x: SQUARE.x + dx / d * 74, z: SQUARE.z + dz / d * 74 };
  raid.active = true; raid.house = houseName; raid.t = 0; raid.members = []; raid.size = n;
  for (let i = 0; i < n; i++) {
    const k = spawnKnight(camp, { x: at.x + (Math.random() - 0.5) * 8, z: at.z + (Math.random() - 0.5) * 8 });
    k.ai.raid = true; k.ai.camp = { x: SQUARE.x, z: SQUARE.z }; k.ai.tx = SQUARE.x; k.ai.tz = SQUARE.z; k.ai.wait = 0;
    k.name = houseName + ' Raider';
    raid.members.push(k);
  }
  sfx.bell();
  ui.message('RAID ON ASHFORD', 2.6);
  setTimeout(() => ui.sub(n + ' knights of the ' + houseName + ' house are coming for revenge.', 4), 900);
  for (const v of villagers) if (v.alive && !v.ai) { if (v.vill.p.fighter && !v.vill.p.married && v.hp > v.maxHp * 0.4) toFight(v, {}); else toFlee(v); }
}
function endRaid(beaten) {
  raid.active = false; raid.cool = DAY_SECONDS * 0.4;
  vsave.anger[raid.house] = Math.max(0, (vsave.anger[raid.house] || 0) - raid.size * 0.7);
  for (const m of raid.members) if (m.alive) { m.ai.raid = false; m.ai.camp = CAMPS.find(c => c.house.name === raid.house) || CAMPS[0]; m.ai.alert = false; }
  raid.members = [];
  if (beaten) { ui.message('ASHFORD IS SAFE', 2); for (const v of villagers) if (v.alive && Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 90) { v.vill.st.opinion = clampO(v.vill.st.opinion + 6); remember(v.vill.st, 'the dark knight helped beat off a raid from the ' + raid.house + ' house'); } }
  else ui.sub('The raiders pull back.', 3);
  setTimeout(() => { for (const v of villagers) if (v.alive && v.vill.mode === 'fight' && !v.angryAtYou) toLife(v); }, 8000);
  vSave();
}
function burnHouse(h, cause) {
  const top = { x: h.x, y: terrainH(h.x, h.z) + 5.2, z: h.z };
  const fires = [];
  for (let i = 0; i < 3; i++) fires.push(addFire(h.x + (Math.random() - 0.5) * h.w * 0.6, top.y - 0.8 + Math.random(), h.z + (Math.random() - 0.5) * h.d * 0.6, 1.6 + Math.random() * 0.8));
  raid.burning.push({ house: h, fires, top, t: 90 + Math.random() * 60 });
  for (const v of villagers) if (v.alive && SPOTS[v.vill.p.home] === h && v.inside) { setInside(v, false); toFlee(v); v.vill.mode = 'flee'; v.vill.fleeT = 40; v.pos.set(h.door.x, groundH(h.door.x, h.door.z), h.door.z); v.vill.st.opinion = clampO(v.vill.st.opinion - 3); remember(v.vill.st, cause === 'you' ? 'my house burned down in the dark knight\'s fire' : cause === 'wild' ? 'my house caught fire and burned' : 'raiders burned my house because of the dark knight\'s killing'); }
  sfx.thud(new THREE.Vector3(h.x, top.y, h.z), 1.5);
}
// smoke from burning roofs
const smoke = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(70,66,62,0.75)'); gr.addColorStop(1, 'rgba(70,66,62,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const pool = [];
  for (let i = 0; i < 80; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); pool.push({ s, life: 0 }); }
  let k = 0;
  return {
    emit(x, y, z, size) { const p = pool[k++ % pool.length]; p.s.position.set(x, y, z); p.life = 1; p.size = size; p.s.visible = true; },
    update(dt) { for (const p of pool) { if (p.life <= 0) continue; p.life -= dt * 0.12; p.s.position.y += dt * 2.2; p.s.position.x += dt * 0.6; const sc = p.size * (2 + (1 - p.life) * 7); p.s.scale.set(sc, sc, 1); p.s.material.opacity = Math.max(0, p.life) * 0.55; if (p.life <= 0) p.s.visible = false; } },
  };
})();

// ---------- the village every frame ----------
let lastDayT = dayT, villageReady = false;
function initVillage() {
  villageSpots();
  for (const p of PERSONAS) if (vsave.people[p.id].alive) spawnVillager(p);
  if (vsave.ally) { const a = personFor(vsave.ally); if (a) { a.pos.copy(player.pos).add(new THREE.Vector3(1.5, 0, 1.5)); setInside(a, false); toFight(a, { follow: true }); } }
  villageReady = true;
}
function updateVillage(dt) {
  if (!villageReady) return;
  if (dayT < lastDayT) { vsave.day++; for (const v of villagers) if (v.vill.mode === 'ally' && v.alive) { /* allies go home at night on their own below */ } vSave(); }
  lastDayT = dayT;
  for (const f of villagers) updateVillager(f, dt);
  // allies head home to sleep after dark
  const h = hourNow();
  if ((h > 22.5 || h < 5) && vsave.ally) { const a = personFor(vsave.ally); if (a && a.alive && !raid.active) { toLife(a); vsave.ally = null; ui.sub(a.vill.p.name + ' heads home to sleep.', 2.5); } }
  // fighters calm down when nothing is left to fight
  for (const f of villagers) {
    if (!f.alive || !f.ai || f.vill.mode !== 'fight') continue;
    if (f.angryAtYou) { if (f.pos.distanceTo(player.pos) > 45 || !player.alive) { f.calmT = (f.calmT || 0) + dt; if (f.calmT > 20) { f.calmT = 0; toLife(f); } } continue; }
    if (!raid.active && !nearestThreat(f, 40)) { f.calmT = (f.calmT || 0) + dt; if (f.calmT > 6) { f.calmT = 0; toLife(f); } }
  }
  // fear fades slowly, gossip travels
  for (const f of villagers) { const st = f.vill.st; if (st.fear > 0) st.fear = Math.max(0, st.fear - dt * 0.05); }
  processGossip();
  raidCheck(dt);
  smoke.update(dt);
  if (drunk > 0) drunk = Math.max(0, drunk - dt * 0.006);
  vFlush(dt);
}
// what E does right now, and the hint for it
function interactTarget() {
  if (!player.alive) return null;
  const f = player, fwd = _vw.set(Math.sin(f.facing), 0, Math.cos(f.facing));
  let best = null, bs = 1e9;
  for (const o of fighters) {
    if (o === f || o.inside) continue;
    const d = o.pos.distanceTo(f.pos);
    if (o.alive && o.vill && !o.down && d < 2.8 && o.vill.mode !== 'flee' && o.vill.mode !== 'fight' && !o.angryAtYou) {
      const dir = o.pos.clone().sub(f.pos).setY(0).normalize(), s = d * (1.6 - dir.dot(fwd));
      if (s < bs) { bs = s; best = { kind: 'talk', o, text: 'Talk to ' + o.vill.p.name }; }
    } else if (!o.alive && d < 2.0 && (o.purse > 0 || o.loot)) {
      if (d < bs) { bs = d; best = { kind: 'loot', o, text: 'Search the body' }; }
    }
  }
  return best;
}
function cameraFx(t) {
  if (drunk > 0.08) {
    const k = Math.min(1, drunk);
    camera.rotateZ(Math.sin(t * 0.9) * 0.05 * k);
    camera.rotateX(Math.sin(t * 0.63) * 0.02 * k);
  }
}
