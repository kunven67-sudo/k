// SPINBORN spin flow: the exact order from his videos, plus the new wheels, plus the loop until "Enter the World".
// Talks to the screen through `io` (spin / react / number / note / mirror). Pure logic otherwise.
import * as D from '../js/data/core.js';
import { RACES, RACE_EXTRAS } from '../js/data/race.js';
import * as B from '../js/data/big.js';
import * as L from '../js/data/loop.js';
import { makeRng, luckWeights, pick, goldenSlices, randInt } from './rng.js';

// ---------- wheel builders ----------
const sl = (arr, map) => arr.map(a => (map ? map(a) : { label: a[0], w: a[1], desc: a[2], x: a[3] }));
const big = arr => arr.map(a => ({ label: a[0], w: a[2] || 1, desc: a[1], x: a[3] }));

export const COLORS = {
  race: 'rainbow', age: '#2f8f2f', height: '#2f8f2f', background: '#2f8f2f', personality: '#2f8f2f', luck: '#c9a227',
  str: '#d41f1f', spd: '#d8d000', dur: '#b0145c', iq: '#0f7c8c', fight: '#b81414', style: '#c0502a', weapon: '#2f8f2f',
  wm: '#7a1fc0', element: '#1f6fd4', powercount: '#1f78d4', power: '#2f8f2f', pm: '#4f8f1f', transform: '#c98a1a',
  aura: 'rainbow', weakness: '#2f8f2f', title: '#2f8f2f', rival: '#8f1f3a', donow: 'rainbow', improves: 'improves',
  monster: '#1f6fd4', yesno: 'yesno', quest: '#2f8f2f', reward: '#2f8f2f', org: '#2f8f2f', followers: '#1f78d4',
  extra: '#2f8f2f', world: 'rainbow', dotoyou: '#8f1f1f', business: '#2f8f2f', kingdom: '#2f8f2f', beast: '#2f8f2f'
};

const W = {
  race: () => ({ id: 'race', q: 'what\'s the race?', color: COLORS.race, slices: RACES.map(r => ({ label: r[0], w: r[1], desc: r[2], look: r[3], x: r[4] })) }),
  age: () => ({ id: 'age', q: '2- Age', color: COLORS.age, slices: sl(D.AGES) }),
  height: () => ({ id: 'height', q: '3- Height', color: COLORS.height, slices: sl(D.HEIGHTS) }),
  background: () => ({ id: 'background', q: 'Whats your background?', color: COLORS.background, slices: big(B.BACKGROUNDS) }),
  luck: () => ({ id: 'luck', q: 'What\'s your luck?', color: COLORS.luck, slices: sl(D.LUCK), tiered: true, golden: true }),
  personality: () => ({ id: 'personality', q: 'What\'s your personality?', color: COLORS.personality, slices: big(B.PERSONALITIES) }),
  str: (q) => ({ id: 'str', q: q || 'What\'s your strength?', color: COLORS.str, slices: sl(D.STRENGTH_TIERS), tiered: true, golden: true }),
  spd: () => ({ id: 'spd', q: 'What\'s your speed', color: COLORS.spd, slices: sl(D.SPEED_TIERS), tiered: true, golden: true }),
  dur: () => ({ id: 'dur', q: 'What\'s your durability?', color: COLORS.dur, slices: sl(D.DURABILITY_TIERS), tiered: true, golden: true }),
  iq: () => ({ id: 'iq', q: 'What\'s your IQ', color: COLORS.iq, slices: sl(D.IQ_TIERS), tiered: true, golden: true }),
  fight: () => ({ id: 'fight', q: 'What\'s your fighting skills?', color: COLORS.fight, slices: sl(D.FIGHTING_TIERS), tiered: true, golden: true }),
  style: () => ({ id: 'style', q: 'What\'s your fighting style?', color: COLORS.style, slices: sl(D.FIGHT_STYLES) }),
  weapon: () => ({ id: 'weapon', q: 'What\'s your weapon', color: COLORS.weapon, slices: big(B.WEAPONS) }),
  wm: () => ({ id: 'wm', q: 'What\'s your weapon mastery?', color: COLORS.wm, slices: sl(D.WEAPON_MASTERY), tiered: true, golden: true }),
  element: () => ({ id: 'element', q: 'What\'s your element?', color: COLORS.element, slices: sl(D.ELEMENTS) }),
  powercount: () => ({ id: 'powercount', q: 'How many power do you have?', color: COLORS.powercount, slices: sl(D.POWER_COUNT) }),
  power: (owned) => ({ id: 'power', q: 'What\'s your power?', color: COLORS.power,
    slices: B.POWERS.filter(p => !owned.includes(p[0])).map(p => ({ label: p[0], w: p[0] === 'Omnipotence' ? 0.25 : 1, desc: p[1], x: p[2] })) }),
  pm: () => ({ id: 'pm', q: 'What\'s your power mastery?', color: COLORS.pm, slices: sl(D.POWER_MASTERY), tiered: true, golden: true }),
  transform: () => ({ id: 'transform', q: 'What\'s your transformation?', color: COLORS.transform, slices: sl(D.TRANSFORMATIONS) }),
  aura: () => ({ id: 'aura', q: 'What\'s your aura color?', color: COLORS.aura, slices: sl(D.AURA) }),
  weakness: (owned = []) => ({ id: 'weakness', q: 'What\'s your weakness?', color: COLORS.weakness, slices: big(B.WEAKNESSES).filter(s => !owned.includes(s.label)) }),
  title: () => ({ id: 'title', q: 'What\'s your title?', color: COLORS.title, slices: B.TITLES.map(t => ({ label: t, w: 1, desc: 'What people call you. It shows over your head once your name spreads.' })) }),
  rival: () => ({ id: 'rival', q: 'Who\'s your rival?', color: COLORS.rival, slices: sl(L.RIVALS) }),
  donow: () => ({ id: 'donow', q: 'What do you do now?', color: COLORS.donow, slices: sl(D.DO_NOW) }),
  improves: () => ({ id: 'improves', q: 'What improves?', color: COLORS.improves, slices: sl(D.IMPROVES) }),
  yesno: (q, yes, no, descYes, descNo) => ({ id: 'yesno', q, color: COLORS.yesno,
    slices: [{ label: 'Yes', w: yes, desc: descYes || 'Yes.' }, { label: 'No', w: no, desc: descNo || 'No.' }], yesno: true }),
  list: (id, q, arr, color) => ({ id, q, color: color || COLORS.extra, slices: sl(arr) })
};

// ---------- helpers ----------
export const STAT_WHEEL = { str: 'str', spd: 'spd', dur: 'dur', iq: 'iq', fight: 'fight', wm: 'wm', pm: 'pm' };
export const STAT_NAME = { str: 'Strength', spd: 'Speed', dur: 'Durability', iq: 'IQ', fight: 'Fighting skills', wm: 'Weapon mastery', pm: 'Power mastery' };
export const STAT_SIZE = { str: 20, spd: 15, dur: 20, iq: 10, fight: 10, wm: 10, pm: 10 };
const LABELS = { str: D.STRENGTH_TIERS, spd: D.SPEED_TIERS, dur: D.DURABILITY_TIERS, iq: D.IQ_TIERS, fight: D.FIGHTING_TIERS, wm: D.WEAPON_MASTERY, pm: D.POWER_MASTERY };
export const tierLabel = (stat, i) => (i == null || i < 0 ? '—' : LABELS[stat][i][0]);
export const tierDesc = (stat, i) => (i == null || i < 0 ? '' : LABELS[stat][i][2]);

// tier on the 0..19 strength scale for comparing fighters
export function combatTier(C) {
  const s = C.stats;
  const sc = (v, n) => (v < 0 ? 0 : v * 19 / (n - 1));
  let t = 0.42 * sc(s.str, 20) + 0.33 * sc(s.dur, 20) + 0.13 * sc(s.spd, 15) + 0.12 * sc(s.fight, 10);
  t += (C.raceBoost || 0) * 0.8 + (C.extraBoost || 0) * 0.6 + (C.transformBoost || 0) * 0.5 + (C.armorBoost || 0) * 0.5;
  if (C.weapon && C.weapon !== 'No weapon') t += 0.5 + Math.max(0, C.stats.wm) * 0.12;
  t += Math.min(3, C.powers.length * 0.6) + Math.max(0, C.stats.pm) * 0.1;
  return Math.max(0, Math.min(22, t));
}

export function newCharacter(gender, comment) {
  return {
    v: 1, id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    created: Date.now(), gender, comment: comment || '',
    race: null, parents: null, raceLook: null, raceBoost: 0, extras: {}, extraBoost: 0,
    age: null, height: null, background: null, luck: 0, luckLabel: 'Normal Luck', personality: null,
    stats: { str: -1, spd: -1, dur: -1, iq: -1, fight: -1, wm: -1, pm: -1 },
    style: null, weapon: null, legendWeapon: null, element: null, powers: [], transformation: 'None', transformBoost: 0,
    aura: null, auraColor: null, weaknesses: [], title: null, rival: null,
    followers: [], org: null, kingdom: null, business: null, beasts: [], allies: [], enemies: [], spells: [], skills: [],
    armor: null, armorBoost: 0, medicine: [], artifacts: [], items: [], territories: [], gold: 0, saves: 0, canFly: false,
    log: [], spins: 0, golden: 0, dead: false, death: null, world: null, retired: false
  };
}

// ---------- the flow ----------
export async function runFlow(C, io, opts = {}) {
  const rng = opts.rng || makeRng();
  const golden = opts.goldenChance ?? 1 / 50;

  async function spin(wheel, ctx = {}) {
    let slices = wheel.slices;
    let isGold = false;
    if (wheel.golden && rng() < golden) { slices = goldenSlices(slices); isGold = true; C.golden++; }
    const weights = luckWeights(slices, wheel.tiered, wheel.tiered ? C.luck : 0);
    if (wheel.yesno && C.luck) { weights[0] *= Math.exp(C.luck * 0.5); }
    const idx = pick(rng, weights);
    const res = slices[idx];
    C.spins++;
    const shown = { ...wheel, slices, gold: isGold };
    await io.spin(shown, idx, weights, ctx);
    const tierIndex = wheel.tiered ? wheel.slices.indexOf(res) : -1;
    C.log.push({ q: wheel.q, a: res.label, gold: isGold, id: wheel.id });
    return { ...res, i: tierIndex, gold: isGold };
  }
  const react = (ev) => io.react({ ...ev, C });
  const note = (t) => io.note && io.note(t);
  const mirror = () => io.mirror && io.mirror(C);
  const dead = async (cause) => { C.dead = true; C.death = cause; await react({ type: 'death', cause }); return true; };

  async function statSpin(stat, q, ctx) {
    const prev = C.stats[stat];
    const r = await spin(W[STAT_WHEEL[stat]](q), ctx);
    C.stats[stat] = r.i;
    mirror();
    await react({ type: 'stat', stat, idx: r.i, n: STAT_SIZE[stat], prev, gold: r.gold, label: r.label });
    return r;
  }

  async function improve(times = 1) {
    for (let k = 0; k < times; k++) {
      const r = await spin(W.improves());
      await react({ type: 'improveWheel', stat: r.x });
      if (r.x === 'wm' && (!C.weapon || C.weapon === 'No weapon')) note('No weapon yet, but you still train it.');
      if (r.x === 'pm' && !C.powers.length) note('No powers yet, but you still train it.');
      await statSpin(r.x);
      if (C.dead) return;
    }
  }

  async function addWeakness() {
    const r = await spin(W.weakness(C.weaknesses));
    if (r.label !== 'No weakness') C.weaknesses.push(r.label);
    await react({ type: 'weakness', none: r.label === 'No weakness', label: r.label });
  }

  async function addPower() {
    const r = await spin(W.power(C.powers.map(p => p.name)));
    C.powers.push({ name: r.label, kind: r.x, desc: r.desc });
    await react({ type: 'power', label: r.label, kind: r.x });
    if (C.stats.pm < 0) await statSpin('pm');
  }

  async function giveWeapon(label, legend) {
    const had = C.weapon && C.weapon !== 'No weapon';
    C.weapon = label; if (legend) C.legendWeapon = label;
    mirror();
    if (!had || C.stats.wm < 0) await statSpin('wm');
  }

  async function doToYou(foeLabel, evil) {
    const sl = D.DO_TO_YOU.map(d => ({ label: d[0], w: d[1] * (d[3] === 'kill' ? (evil ? 1.8 : 0.8) : d[3] === 'spare' ? (evil ? 0.6 : 1.5) : 1), desc: d[2], x: d[3] }));
    const r = await spin({ id: 'dotoyou', q: 'What do they do to you?', color: COLORS.dotoyou, slices: sl });
    if (r.x === 'kill') return dead(`Killed by ${foeLabel}`);
    if (r.x === 'spare') { await react({ type: 'spared', foe: foeLabel }); note('You live, but you got hurt.'); await addWeakness(); return false; }
    await react({ type: 'captured', foe: foeLabel });
    const p = Math.min(0.85, Math.max(0.2, 0.35 + C.stats.spd * 0.025 + C.stats.iq * 0.03));
    const e = await spin(W.yesno('Do you escape?', p * 10, (1 - p) * 10, 'You break out.', 'Locked up forever.'));
    if (e.label === 'No') return dead(`Locked up forever by ${foeLabel}`);
    await react({ type: 'escaped' });
    return false;
  }

  function winChance(foeTier) {
    const d = combatTier(C) - foeTier;
    return Math.min(0.94, Math.max(0.1, 0.62 + d * 0.07));
  }

  async function fightMonster(forced) {
    const m = forced || await spin(W.list('monster', 'Which monster?', L.MONSTERS, COLORS.monster));
    await react({ type: 'monster', label: m.label, tier: m.x });
    const p = winChance(m.x);
    const r = await spin(W.yesno('Do you win?', p * 10, (1 - p) * 10, 'You beat it.', 'It kills you.'));
    await react({ type: 'fight', win: r.label === 'Yes', vs: m.label, tier: m.x });
    if (r.label === 'No') return dead(`Killed by a ${m.label}`);
    const imp = await spin(W.yesno('Do you improve in return?', 6, 4, 'You get stronger from the fight.', 'Nothing gained.'));
    if (imp.label === 'Yes') await improve();
    return C.dead;
  }

  async function fightPerson(label, tier, evil) {
    const p = winChance(tier);
    const r = await spin(W.yesno('Do you win?', p * 10, (1 - p) * 10, 'You win the fight.', 'You lose.'));
    await react({ type: 'fight', win: r.label === 'Yes', vs: label, tier });
    if (r.label === 'No') return doToYou(label, evil);
    return false;
  }

  async function reward(tag) {
    switch (tag) {
      case 'gold': C.gold += randInt(rng, 1000, 90000); note('Gold added to your stash.'); break;
      case 'legend': { const w = await spin(W.list('legend', 'What is the weapon?', L.LEGEND_WEAPONS)); await react({ type: 'legend', label: w.label });
        await giveWeapon(w.label.replace(/^\d+\.\s*/, '').split(' — ')[0], true); break; }
      case 'artifact': case 'artifact+': {
        let s = sl(L.ARTIFACT_POWERS); if (tag === 'artifact+') s = s.slice(4);
        const a = await spin({ id: 'artifact', q: 'Whats the power?', color: COLORS.reward, slices: s });
        C.artifacts.push(a.label); await react({ type: 'artifact', label: a.label }); break; }
      case 'evolve': await improve(2); break;
      case 'spell': await learnSpell(); break;
      case 'dungeon': C.items.push('Dungeon Core'); note('You own a dungeon now.'); break;
      case 'potion': C.saves++; C.items.push('Regeneration Potion'); note('Saved for later: heals you once.'); break;
      case 'armor': await makeArmor(); break;
      case 'title': C.items.push('Noble Title + Land'); note('You are a noble with your own land.'); break;
      case 'follower': await recruit(); break;
      case 'improve': await improve(); break;
      case 'newtitle': { const t = await spin(W.title()); C.title = t.label; await react({ type: 'title', label: t.label }); break; }
      case 'weapon': { const w = await spin({ id: 'weapon', q: 'What weapon do they give you?', color: COLORS.weapon, slices: big(B.WEAPONS).filter(s => s.label !== 'No weapon') });
        await react({ type: 'weapon', label: w.label, none: false }); await giveWeapon(w.label); break; }
      default: break;
    }
  }

  async function learnSpell() {
    const s = await spin(W.list('spell', 'What is the spell?', L.SPELLS));
    if (!C.spells.includes(s.label)) C.spells.push(s.label);
    await react({ type: 'spell', label: s.label });
  }
  async function makeArmor() {
    const a = await spin(W.list('armor', 'What kind of armor?', L.ARMORS, '#1f6fd4'));
    C.armor = a.label; C.armorBoost = Math.max(C.armorBoost, a.x); mirror();
    await react({ type: 'armor', label: a.label });
    if (a.label === 'Cursed Armor') await addWeakness();
  }
  async function recruit(kindOverride) {
    const f = kindOverride || await spin(W.list('followers', 'Who are your followers?', L.FOLLOWERS, COLORS.followers));
    const c = await spin(W.list('followercount', `How many ${f.label.toLowerCase()}?`, L.FOLLOWER_COUNT, COLORS.followers));
    const ps = await spin(W.list('powerscale', 'What\'s your Follower\'s overall powerscale?', L.POWERSCALE, '#3a2a8a'));
    const fol = { kind: f.label, count: c.label, n: c.x, power: ps.label, tier: ps.x };
    C.followers.push(fol);
    await react({ type: 'followers', ...fol });
    return fol;
  }

  // ===== 1. race =====
  const race = await spin(W.race());
  C.race = race.label; C.raceLook = race.look; C.raceBoost = race.x || 0; mirror();
  await react({ type: 'race', label: race.label, power: race.x });
  let extraLists = RACE_EXTRAS[race.label] ? [race.label] : [];
  if (race.label === 'Hybrid') {
    await react({ type: 'hybrid' });
    const pool = W.race(); pool.slices = pool.slices.filter(s => s.label !== 'Hybrid');
    const f = await spin({ ...pool, q: 'what\'s the race?', sub: 'Father' }, { sub: 'Father' });
    const m = await spin({ ...pool, q: 'what\'s the race?', sub: 'Mother' }, { sub: 'Mother' });
    C.parents = [f.label, m.label]; C.raceBoost = Math.max(f.x || 0, m.x || 0); C.raceLook = f.look; mirror();
    await react({ type: 'parents', father: f.label, mother: m.label });
    extraLists = [...new Set([f.label, m.label].filter(r => RACE_EXTRAS[r]))];
  }
  // race extras (zanpakutō, Saiyan form, god type...)
  const doneExtras = new Set();
  for (const rl of extraLists) {
    for (let ex of RACE_EXTRAS[rl]) {
      if (ex.ref) { const [a, b] = ex.ref.split('.'); const base = a === 'Loop' ? { slices: L.POWERSCALE, q: ex.q } : RACE_EXTRAS[a].find(e => e.id === b); ex = { ...base, id: ex.id, q: ex.q || base.q, needs: ex.needs }; }
      if (doneExtras.has(ex.id)) continue;
      if (ex.needs && Object.entries(ex.needs).some(([k, v]) => C.extras[k] !== v)) continue;
      doneExtras.add(ex.id);
      const r = await spin({ id: 'extra_' + ex.id, q: ex.q, color: COLORS.extra, slices: sl(ex.slices) });
      C.extras[ex.id] = r.label; C.extraBoost += Math.max(-2, r.x || 0);
      if (ex.id === 'god_type' && r.label === 'God of Luck') { C.luck = 0.8; C.luckLabel = 'Blessed'; }
      mirror();
      await react({ type: 'extra', id: ex.id, label: r.label, boost: r.x || 0 });
    }
  }

  // ===== 2. age =====
  const age = await spin(W.age());
  const [a0, a1] = age.x; const years = a1 > 1e6 ? Math.round(a0 + rng() * (a1 - a0)) : randInt(rng, a0, a1);
  if (io.number) await io.number('2- Age', years, age.label);
  C.age = { label: age.label, years, idx: D.AGES.findIndex(a => a[0] === age.label) }; mirror();
  await react({ type: 'age', label: age.label, years, idx: C.age.idx });

  // ===== 3. height =====
  const h = await spin(W.height());
  C.height = h.x; mirror();
  await react({ type: 'height', inches: h.x, label: h.label });

  // ===== background, luck, personality =====
  const bg = await spin(W.background());
  C.background = bg.label;
  await react({ type: 'background', label: bg.label, nobody: bg.label === 'You were a Nobody' });
  const lk = await spin(W.luck());
  C.luck = lk.x; C.luckLabel = lk.label;
  await react({ type: 'luck', label: lk.label, value: lk.x });
  const pers = await spin(W.personality());
  C.personality = pers.label;
  await react({ type: 'personality', label: pers.label });

  // ===== stats =====
  for (const st of ['str', 'spd', 'dur', 'iq', 'fight']) await statSpin(st);
  const style = await spin(W.style()); C.style = style.label;
  await react({ type: 'style', label: style.label });

  // ===== weapon =====
  const wp = await spin(W.weapon());
  C.weapon = wp.label; mirror();
  await react({ type: 'weapon', label: wp.label, none: wp.label === 'No weapon' });
  if (wp.label !== 'No weapon') await statSpin('wm');

  // ===== element + powers =====
  const el = await spin(W.element()); C.element = el.label;
  await react({ type: 'element', label: el.label });
  const pc = await spin(W.powercount());
  await react({ type: 'powercount', n: pc.x });
  for (let k = 0; k < pc.x; k++) {
    const p = await spin(W.power(C.powers.map(q => q.name)));
    C.powers.push({ name: p.label, kind: p.x, desc: p.desc });
    if (p.label === 'Flight') C.canFly = true;
    await react({ type: 'power', label: p.label, kind: p.x, k, n: pc.x });
  }
  if (pc.x > 0) await statSpin('pm');

  const tf = await spin(W.transform()); C.transformation = tf.label; C.transformBoost = tf.x || 0;
  await react({ type: 'transform', label: tf.label, boost: tf.x || 0 });
  const au = await spin(W.aura()); C.aura = au.label; C.auraColor = au.x; mirror();
  await react({ type: 'aura', label: au.label });
  await addWeakness();
  const ti = await spin(W.title()); C.title = ti.label;
  await react({ type: 'title', label: ti.label });
  const rv = await spin(W.rival()); C.rival = rv.label === 'No rival' ? null : rv.label;
  await react({ type: 'rival', label: rv.label });
  if (['Angel', 'Dragon', 'Phoenix', 'Fairy', 'Kryptonian', 'Viltrumite', 'Saiyan', 'Eternal', 'God', 'Devil'].includes(C.race) ||
      (C.parents && C.parents.some(p => ['Angel', 'Dragon', 'Phoenix', 'Fairy', 'Kryptonian', 'Viltrumite'].includes(p)))) C.canFly = true;

  // ===== the loop =====
  for (let guard = 0; guard < 200 && !C.dead; guard++) {
    const act = await spin(W.donow());
    await react({ type: 'donow', label: act.label });
    switch (act.label) {
      case 'Train': case 'Evolve': await improve(); break;
      case 'Study': { const s = await spin(W.list('study', 'What do you study?', L.STUDY)); await statSpin(s.x);
        if (s.label === 'Forbidden Books' && rng() < 0.3) { note('The forbidden book cursed you.'); await addWeakness(); } break; }
      case 'Explore': {
        const where = await spin(W.list('explore', 'Where do you explore?', L.EXPLORE_WHERE));
        const hap = await spin(W.list('explorehappens', 'What happens there?', L.EXPLORE_HAPPENS));
        await react({ type: 'explore', where: where.label, what: hap.label });
        if (hap.x === 'treasure') await treasure();
        else if (hap.x === 'improve') await improve();
        else if (hap.x === 'monster') await fightMonster();
        else if (hap.x === 'power') await addPower();
        else if (hap.x === 'weakness') await addWeakness();
        else if (hap.x === 'beast') await tame(true);
        else if (hap.x === 'spell') await learnSpell();
        else if (hap.x === 'age') { const y = randInt(rng, 3, 40); C.age.years += y; note(`You came back ${y} years older.`); }
        break; }
      case 'Fight a Monster': await fightMonster(); break;
      case 'Complete a Quest': {
        const q = await spin(W.list('quest', 'What is the quest?', L.QUESTS));
        await react({ type: 'quest', label: q.label, danger: q.x });
        const base = q.x === 'deadly' ? 0.45 : q.x === 'danger' ? 0.6 : 0.72;
        const p = Math.min(0.92, Math.max(0.15, base + (combatTier(C) - 9) * 0.03));
        const fin = await spin(W.yesno('Will you finish the quest?', p * 10, (1 - p) * 10, 'You finish it.', 'You fail it.'));
        if (fin.label === 'Yes') {
          await react({ type: 'questdone', label: q.label });
          const list = q.x === 'dungeon' ? L.REWARDS_DUNGEON : L.REWARDS;
          const rw = await spin(W.list('reward', 'Quest\'s reward', list));
          await react({ type: 'reward', label: rw.label, tag: rw.x });
          await reward(rw.x);
        } else if (q.x !== 'safe') {
          const sp = q.x === 'deadly' ? 0.55 : 0.8;
          const sv = await spin(W.yesno('Do you survive?', sp * 10, (1 - sp) * 10, 'You barely make it out.', 'It was too much.'));
          if (sv.label === 'No') { await dead(`Died trying to ${q.label.toLowerCase()}`); }
          else await react({ type: 'survived' });
        } else await react({ type: 'questfail', label: q.label });
        break; }
      case 'Become a Mercenary': {
        const role = await spin(W.list('merc', 'What\'s your mercenary role?', L.MERC_ROLES));
        const who = await spin(W.list('client', 'Who hires you?', L.MERC_CLIENTS));
        await react({ type: 'merc', role: role.label, client: who.label });
        const p = Math.min(0.9, Math.max(0.2, 0.6 + (combatTier(C) - 8) * 0.03));
        const ok = await spin(W.yesno('Do you finish the job?', p * 10, (1 - p) * 10, 'Job done.', 'You mess it up.'));
        if (ok.label === 'Yes') { const pay = await spin(W.list('pay', 'What\'s your pay?', L.MERC_PAY)); await react({ type: 'reward', label: pay.label, tag: pay.x }); await reward(pay.x); }
        else if (await doToYou(who.label, /Crime|Demon|Enemy/.test(who.label))) break;
        break; }
      case 'Create an Organization': {
        const k = await spin(W.list('org', 'What kind of organization?', L.ORG_KINDS));
        const s = await spin(W.list('orgsize', 'How large is the organization?', L.ORG_SIZE));
        const mem = await spin(W.list('members', 'Who are your members?', L.FOLLOWERS, COLORS.followers));
        const ps = await spin(W.list('powerscale', 'What\'s your Follower\'s overall powerscale?', L.POWERSCALE, '#3a2a8a'));
        C.org = { kind: k.label, size: s.label, n: s.x, members: mem.label, power: ps.label, tier: ps.x };
        await react({ type: 'org', ...C.org });
        break; }
      case 'Recruit Followers': await recruit(); break;
      case 'Make an Ally': {
        const r = await spin({ ...W.race(), id: 'allyrace', q: 'Who is your ally?' });
        const s = await spin(W.str('How strong is your ally?'));
        const ally = { race: r.label, tier: s.i, power: s.label };
        C.allies.push(ally);
        await react({ type: 'ally', ...ally });
        const g = await spin(W.list('allygives', 'What does your ally do?', L.ALLY_GIVES));
        if (g.x === 'betray') { C.allies.pop(); C.enemies.push(ally); await react({ type: 'betray' }); }
        else await reward(g.x);
        break; }
      case 'Make an Enemy': {
        const r = await spin({ ...W.race(), id: 'enemyrace', q: 'Who is your enemy?' });
        const s = await spin(W.str('How strong is your enemy?'));
        const en = { race: r.label, tier: s.i, power: s.label };
        C.enemies.push(en);
        await react({ type: 'enemy', ...en });
        const d = await spin(W.list('enemydoes', 'What happens?', L.ENEMY_DOES));
        if (d.x === 'fight') { await fightPerson(`a ${r.label} enemy`, s.i, true); }
        else if (d.x === 'rival') { C.rival = `${r.label} enemy (${s.label})`; }
        else if (d.x === 'loseally') { if (C.allies.length) { C.allies.pop(); note('You lost an ally.'); } }
        else if (d.x === 'broke') { C.gold = Math.floor(C.gold / 3); note('They stole most of your gold.'); }
        else if (d.x === 'gone') { C.enemies.pop(); }
        break; }
      case 'Build a Kingdom': {
        const w = await spin(W.list('kwhere', 'Where do you build it?', L.KINGDOM_WHERE));
        const s = await spin(W.list('ksize', 'How big is your kingdom?', L.KINGDOM_SIZE));
        const o = await spin(W.list('kout', 'What is the kingdoms outcome?', L.KINGDOM_OUTCOME));
        C.kingdom = { where: w.label, size: s.label, people: s.x, outcome: o.label };
        await react({ type: 'kingdom', ...C.kingdom });
        if (o.label.startsWith('Falls to Ruin')) C.kingdom.fallen = true;
        if (o.label.startsWith('Constant Wars')) C.enemies.push({ race: 'Enemy Nation', tier: 7, power: 'Country Level' });
        break; }
      case 'Invent Something': {
        const what = await spin(W.list('invent', 'What do you invent?', L.INVENT));
        if (what.label === 'Armor') await makeArmor();
        else if (what.label === 'Weapon') {
          const w = await spin({ id: 'weapon', q: 'What weapon do you invent?', color: COLORS.weapon, slices: big(B.WEAPONS).filter(s => s.label !== 'No weapon') });
          await react({ type: 'weapon', label: w.label, none: false }); await giveWeapon(w.label);
        } else if (what.label === 'Medicine') {
          const m = await spin(W.list('medicine', 'What kind of medicine?', L.MEDICINES));
          C.medicine.push(m.label); await react({ type: 'medicine', label: m.label });
          const mm = m.label;
          if (/^Mutation/.test(mm)) await improve();
          else if (/^Durability/.test(mm)) await statSpin('dur');
          else if (/^Intelligence/.test(mm)) await statSpin('iq');
          else if (/^Speed Serum/.test(mm)) await statSpin('spd');
          else if (/^Strength/.test(mm)) await statSpin('str');
          else if (/^Divine Cure/.test(mm) && C.weaknesses.length) { const gone = C.weaknesses.pop(); note(`Cured: ${gone}`); }
          else if (/^Healing Potion|^Regeneration/.test(mm)) C.saves++;
        } else await learnSpell();
        break; }
      case 'Learn a New Skill': {
        const s = await spin(W.list('skill', 'What skill do you learn?', L.SKILLS));
        if (!C.skills.includes(s.label)) C.skills.push(s.label);
        if (s.label === 'Flight') C.canFly = true;
        if (s.label === 'Iron Body' && C.stats.dur < 19) { C.stats.dur++; note('+1 durability tier'); }
        await react({ type: 'skill', label: s.label });
        break; }
      case 'Learn a New Spell': await learnSpell(); break;
      case 'Find a Treasure': await treasure(); break;
      case 'Tame a Beast': await tame(false); break;
      case 'Go to War': {
        const foe = await spin(W.list('war', 'Who do you go to war against?', L.WAR_FOES));
        let tier = foe.x; if (foe.label === 'Your Enemy') tier = C.enemies.length ? C.enemies[C.enemies.length - 1].tier : 8;
        await react({ type: 'war', label: foe.label, tier });
        const p = winChance(tier);
        const r = await spin(W.yesno('Do you win the war?', p * 10, (1 - p) * 10, 'Victory.', 'Defeat.'));
        await react({ type: 'fight', win: r.label === 'Yes', vs: foe.label, tier });
        if (r.label === 'Yes') { const g = await spin(W.list('wargain', 'What do you gain?', L.WAR_GAIN)); await reward(g.x); }
        else await doToYou(foe.label, /Demon|Undead|Alien|Enemy/.test(foe.label));
        break; }
      case 'Conquer a Territory': {
        const realm = await spin(W.list('realm', 'Which Realm/Territory?', L.REALMS));
        const hap = await spin(W.list('conquer', 'What happens!', L.CONQUER_HAPPENS));
        await react({ type: 'conquer', realm: realm.label, what: hap.label });
        if (hap.x === 'win' || hap.x === 'follower' || hap.x === 'age') C.territories.push(realm.label);
        if (hap.x === 'follower') await recruit();
        if (hap.x === 'age') { const y = randInt(rng, 2, 30); if (C.age) C.age.years += y; note(`The war took ${y} years.`); }
        if (hap.x === 'god') { if (!(await fightPerson('a god', 16, false))) C.territories.push(realm.label); }
        break; }
      case 'Start a Business': {
        const b = await spin(W.list('business', 'what kind of business?', L.BUSINESS));
        const outs = (L.BUSINESS_OUTCOMES[b.label] || L.BUSINESS_OUTCOMES.default).map(o => ({ label: o, w: 1, desc: o.split(' — ')[1] || '', x: L.BUSINESS_TAGS[o.split(' — ')[0]] }));
        const o = await spin({ id: 'bizout', q: 'What is the outcome? ( BUSINESS )', color: COLORS.business, slices: outs });
        C.business = { kind: b.label, outcome: o.label };
        await react({ type: 'business', kind: b.label, outcome: o.label, tag: o.x });
        if (o.x === 'gold') C.gold += randInt(rng, 5000, 900000);
        else if (o.x === 'artifact' || o.x === 'artifact+') await reward(o.x);
        else if (o.x === 'monster') await fightMonster({ label: 'Ancient Guardian', x: 12 });
        else if (o.x === 'trapped') { const e = await spin(W.yesno('Do you escape?', 6, 4, 'You make it out.', 'Trapped forever.')); if (e.label === 'No') await dead('Trapped in another dimension'); }
        else if (o.x === 'enemy') { C.enemies.push({ race: 'Rivals', tier: 8, power: 'Country Level' }); }
        else if (o.x === 'broke') C.gold = 0;
        else if (o.x === 'weakness') await addWeakness();
        break; }
      case 'Enter the World': {
        const w = await spin({ id: 'world', q: 'What world do you land in?', color: COLORS.world, slices: sl(D.WORLDS) });
        C.world = w.x; C.worldLabel = w.label; C.retired = true;
        await react({ type: 'world', label: w.label });
        return C;
      }
      default: break;
    }
  }

  async function treasure() {
    const t = await spin(W.list('treasure', 'What\'s in the treasure?', L.TREASURE));
    await react({ type: 'treasure', label: t.label, tag: t.x });
    if (t.x === 'weakness') await addWeakness();
    else if (t.x === 'dragonegg') { C.beasts.push({ kind: 'Baby Dragon', tier: 6 }); note('A baby dragon follows you now.'); }
    else if (t.x === 'young') { if (C.age) C.age.years = Math.max(16, Math.round(C.age.years * 0.6)); note('You got younger.'); }
    else if (t.x === 'explore') { note('The map leads somewhere...'); }
    else await reward(t.x);
  }
  async function tame(egg) {
    const b = await spin(W.list('beast', 'What is the Beast you tame?', L.BEASTS, COLORS.beast));
    if (!egg) {
      const p = Math.min(0.85, Math.max(0.25, 0.55 + (combatTier(C) - b.x) * 0.04));
      const ok = await spin(W.yesno('Do you tame the beast?', p * 10, (1 - p) * 10, 'It follows you now.', 'It runs away.'));
      if (ok.label === 'No') { await react({ type: 'tamefail', label: b.label }); return; }
    }
    C.beasts.push({ kind: b.label, tier: b.x });
    await react({ type: 'beast', label: b.label, tier: b.x });
  }
  return C;
}
