// Everyone who lives and works in Maple Hollow (master list §24): your family, the neighbours
// on Maple Street, store workers. Each has a name, age, job, personality, a home and a daily
// schedule. Off-screen they're "away" (inside their house, at work), on-screen they walk.
//
//   const recs = makeResidents(life)          // deterministic from the life's family seed
//   plan(rec, clock, ctx) -> { at: 'home' | 'work' | 'store:grocery' | node, act }

import { Rng } from '../core/rng.js';
import { randomLook } from './look.js';
import { LOTS } from '../world/layout.js';

const FIRST = {
  f: ['Linda', 'Karen', 'Jennifer', 'Amy', 'Melissa', 'Nicole', 'Heather', 'Stephanie', 'Rachel', 'Megan', 'Brianna', 'Tasha', 'Maria', 'Priya', 'Grace', 'Hannah', 'Olivia', 'Ava', 'Mia', 'Zoe', 'Lily', 'Chloe', 'Aaliyah', 'Sofia', 'Barb', 'Dolores', 'Joan'],
  m: ['Mike', 'Dave', 'Chris', 'Jason', 'Brian', 'Kevin', 'Tom', 'Steve', 'Marcus', 'Andre', 'Carlos', 'Raj', 'Tyler', 'Josh', 'Ryan', 'Kyle', 'Ethan', 'Noah', 'Liam', 'Mason', 'Jayden', 'Diego', 'Owen', 'Caleb', 'Gary', 'Ron', 'Walt'],
};
const LAST = ['Miller', 'Johnson', 'Smith', 'Brown', 'Davis', 'Wilson', 'Anderson', 'Thompson', 'Garcia', 'Martinez', 'Patel', 'Nguyen', 'Kowalski', 'Schmidt', 'Hoffman', 'Baker', 'Carter', 'Reed', 'Brooks', 'Price'];
const JOBS = [
  { job: 'nurse', start: 7, end: 19, days: [1, 2, 4] },
  { job: 'office worker', start: 8.5, end: 17.5 },
  { job: 'teacher', start: 7.5, end: 16 },
  { job: 'mechanic', start: 8, end: 17 },
  { job: 'accountant', start: 8.5, end: 17.5 },
  { job: 'electrician', start: 7, end: 15.5 },
  { job: 'warehouse worker', start: 6, end: 14.5 },
  { job: 'manager at the bank', start: 9, end: 17 },
  { job: 'software developer', start: 9.5, end: 18 },
  { job: 'truck driver', start: 5, end: 15 },
];

function traits(rng, bias = {}) {
  const t = (k, d = 0.5) => Math.max(0, Math.min(1, rng.gaussian(bias[k] ?? d, 0.2)));
  return { warmth: t('warmth'), strictness: t('strictness', 0.45), humor: t('humor'), patience: t('patience'), talkative: t('talkative'), honesty: t('honesty', 0.7), swears: t('swears', 0.25), nosy: t('nosy', 0.4) };
}

const PARENT_STYLE = {
  strict: { strictness: 0.85, warmth: 0.45, patience: 0.4 },
  chill: { strictness: 0.25, warmth: 0.7, patience: 0.75 },
  'doesnt-care': { strictness: 0.1, warmth: 0.25, nosy: 0.1 },
  overprotective: { strictness: 0.7, warmth: 0.85, nosy: 0.9 },
  fun: { strictness: 0.3, warmth: 0.85, humor: 0.9 },
};

export function makeResidents(life) {
  const fam = life.family || {};
  const rng = new Rng((fam.house?.seed || 7) * 7919 + 17);
  const out = [];
  const last = fam.lastName || rng.pick(LAST);
  // ---- your family ----
  const members = fam.members || [
    fam.mom && { role: 'mom', ...fam.mom },
    fam.dad && { role: 'dad', ...fam.dad },
  ].filter(Boolean);
  members.forEach((m, i) => {
    const style = m.style || rng.pick(Object.keys(PARENT_STYLE));
    const sex = m.look?.sex || (m.role === 'mom' || m.role === 'grandma' ? 'f' : 'm');
    const age = m.age || (m.role === 'grandma' || m.role === 'grandpa' ? 66 : 34 + rng.int(0, 8));
    const job = m.job ? JOBS.find((j) => j.job === m.job) || JOBS[1] : m.role.startsWith('grand') ? { job: 'retired' } : rng.pick(JOBS);
    out.push({
      id: `fam-${m.role}${i}`,
      family: true,
      role: m.role,
      call: { mom: 'Mom', dad: 'Dad', grandma: 'Grandma', grandpa: 'Grandpa' }[m.role] || m.name,
      name: m.name || rng.pick(FIRST[sex]),
      last,
      sex,
      age,
      look: m.look || randomLook(rng, { sex, age }),
      job: job.job,
      shift: job,
      style,
      traits: traits(rng, PARENT_STYLE[style] || {}),
      habits: m.habits || [],
      home: 'home',
      startAway: null,
    });
  });
  // Sibling.
  if (fam.house?.sibling && fam.house.sibling !== 'none') {
    const sex = rng.pick(['f', 'm']);
    const age = fam.house.sibling === 'older' ? 12 : 5;
    out.push({ id: 'fam-sib', family: true, role: 'sibling', name: rng.pick(FIRST[sex]), last, sex, age, look: randomLook(rng, { sex, age }), job: age < 6 ? 'kindergarten' : 'school', traits: traits(rng, { talkative: 0.7, nosy: 0.7 }), home: 'home', startAway: null });
  }
  // ---- neighbours ----
  for (const lot of LOTS) {
    if (lot.family) continue;
    const lr = new Rng(lot.x * 131 + lot.side * 977 + 5);
    const lname = lr.pick(LAST);
    const kind = lr.pick(['couple+kids', 'couple', 'retiree', 'single', 'couple+kids', 'single-parent']);
    const add = (role, sex, age, extra = {}) =>
      out.push({ id: `${lot.id}-${role}-${out.length}`, role, name: lr.pick(FIRST[sex]), last: lname, sex, age, look: randomLook(lr, { sex, age }), traits: traits(lr), home: lot.id, address: lot.address, startAway: 'home', ...extra });
    const job = () => {
      const j = lr.pick(JOBS);
      return { job: j.job, shift: j };
    };
    if (kind === 'retiree') {
      add('retiree', lr.pick(['f', 'm']), 68 + lr.int(0, 14), { job: 'retired', dog: lr.chance(0.5) });
    } else if (kind === 'single') {
      add('adult', lr.pick(['f', 'm']), 24 + lr.int(0, 20), job());
    } else {
      const s1 = lr.pick(['f', 'm']);
      add('adult', s1, 30 + lr.int(0, 14), job());
      if (kind !== 'single-parent') add('adult', s1 === 'f' ? 'm' : 'f', 30 + lr.int(0, 14), job());
      if (kind.includes('kids') || kind === 'single-parent') {
        const n = 1 + lr.int(0, 1);
        for (let k = 0; k < n; k++) add('kid', lr.pick(['f', 'm']), 6 + lr.int(0, 9), { job: 'school' });
      }
    }
  }
  // ---- store workers ----
  const staff = [
    ['grocery', 'cashier', 0], ['grocery', 'cashier', 1], ['grocery', 'stocker', -1],
    ['electronics', 'cashier', 0], ['electronics', 'blue shirt', -1],
    ['furniture', 'cashier', 0], ['furniture', 'helper', -1],
  ];
  const sr = new Rng(4242);
  for (const [store, role, reg] of staff) {
    const sex = sr.pick(['f', 'm']);
    const age = 17 + sr.int(0, 40);
    const look = randomLook(sr, { sex, age });
    // Uniform colours: Walmort blue vest, Best Bye blue polo, IKEO yellow shirt.
    look.outfit = { ...look.outfit, topColor: store === 'grocery' ? '#1a5fb4' : store === 'electronics' ? '#1d3c78' : '#ffda1a', bottomColor: '#2b2b2b' };
    out.push({ id: `staff-${store}-${role}-${reg}`, role: 'staff', staffRole: role, store, register: reg, name: sr.pick(FIRST[sex]), last: sr.pick(LAST), sex, age, look, job: `${role} at ${store === 'grocery' ? 'Walmort' : store === 'electronics' ? 'Best Bye' : 'IKEO'}`, traits: traits(sr, { warmth: 0.6, patience: 0.6 }), home: 'offsite', startAway: 'offsite' });
  }
  return out;
}

/**
 * What someone should be doing right now. Returns { at, act } where at is:
 *   'home' (inside their own house, no body), 'work', 'offsite', 'world' + node/spot targets.
 * ctx = { home spots by kind, stores, parks, player info, weekday, hour }
 */
export function plan(rec, clock, ctx) {
  const h = clock.hourFloat;
  const wd = clock.weekday; // 0 Sun .. 6 Sat
  const weekend = wd === 0 || wd === 6;
  const S = ctx.spots;
  if (rec.family) {
    const isParent = rec.role === 'mom' || rec.role === 'dad' || rec.role.startsWith('grand');
    if (rec.role === 'sibling') {
      if (h < 7.5 || h >= 21) return { act: { kind: 'sleep', spot: S.siblingBed || S.couch } };
      if (!weekend && h >= 8 && h < 15.5) return { at: 'away', exit: 'front', why: 'school' };
      if (h >= 18.5 && h < 19.2) return { act: { kind: 'sit', spot: S.chairs[2] } };
      return { act: { kind: 'tv', spot: S.couch } };
    }
    if (!isParent) return { act: { kind: 'stand', node: ctx.homeRoom.living } };
    const first = rec.role === 'mom' || rec.role === 'grandma';
    const wake = weekend ? 8 : 6.5;
    const bed = weekend ? 23 : 22.5;
    if (h < wake || h >= bed) return { act: { kind: 'sleep', spot: S.parentsBed } };
    const shift = rec.shift || { start: 8.5, end: 17.5 };
    const works = rec.job !== 'retired' && !weekend && (!shift.days || shift.days.includes(wd));
    if (works && h >= shift.start - 0.4 && h < shift.end + 0.4) return { at: 'away', exit: 'driveway', why: 'work' };
    // Saturday grocery run (they really drive to Walmort).
    if (wd === 6 && h >= 11 && h < 12.5 && first) return { at: 'away', exit: 'driveway', why: 'groceries' };
    if (h < wake + 1) return first ? { act: { kind: 'cook', spot: S.stove } } : { act: { kind: 'sit', spot: S.chairs[0] } };
    if (h >= 17.8 && h < 18.5) return first ? { act: { kind: 'cook', spot: S.stove } } : { act: { kind: 'stand', spot: S.fridge } };
    if (h >= 18.5 && h < 19.2) return { act: { kind: 'sit', spot: first ? S.chairs[1] : S.chairs[0] } };
    if (h >= 19.2 && h < 20 && first) return { act: { kind: 'cook', spot: S.sinkKitchen } };
    if (h >= 20 && h < bed) return { act: { kind: 'tv', spot: S.couch, alt: first } };
    // Weekend day / days off: around the house + yard.
    if (weekend) {
      if (h < 11) return first ? { act: { kind: 'stand', spot: S.sinkKitchen } } : { act: { kind: 'stand', node: ctx.homeRoom.garage } };
      return { act: { kind: 'tv', spot: S.couch, alt: !first } };
    }
    return { act: { kind: 'stand', node: ctx.homeRoom.kitchen } };
  }
  if (rec.role === 'staff') {
    const st = ctx.stores[rec.store];
    if (h < st.def.open - 0.2 || h >= st.def.close + 0.1) return { at: 'offsite' };
    if (rec.register >= 0) {
      const r = st.registers[rec.register];
      return { act: { kind: 'work', node: r.navCashier, yaw: 0 }, store: rec.store };
    }
    return { act: { kind: 'wander-store', store: rec.store }, store: rec.store };
  }
  // Neighbours.
  if (rec.role === 'kid') {
    if (!weekend && h >= 7.6 && h < 15.6) return { at: 'away', exit: 'door', why: 'school' };
    const playTime = weekend ? (h >= 10 && h < 12.5) || (h >= 14 && h < 18) : h >= 16 && h < 18.3;
    if (playTime && !ctx.badWeather) return { act: { kind: 'play' }, outside: true };
    return { at: 'home' };
  }
  if (rec.role === 'retiree') {
    if (h >= 9 && h < 10.2 && !ctx.badWeather) return { act: { kind: 'walk-park' }, outside: true };
    if (h >= 15 && h < 16 && !ctx.badWeather && rec.dog) return { act: { kind: 'walk-street' }, outside: true };
    return { at: 'home' };
  }
  // Adults: commute, errands, evening walk.
  const shift = rec.shift || { start: 9, end: 17 };
  if (!weekend && rec.job !== 'retired' && h >= shift.start - 0.5 && h < shift.end + 0.5) return { at: 'away', exit: 'driveway', why: 'work' };
  const errand = (rec.id.charCodeAt(rec.id.length - 1) % 7) === wd % 7;
  if (errand && h >= 12 && h < 13.5) return { act: { kind: 'shop', store: ['grocery', 'electronics', 'furniture'][rec.id.length % 3] }, outside: true };
  if (h >= 19 && h < 19.6 && rec.traits.warmth > 0.55 && !ctx.badWeather) return { act: { kind: 'walk-street' }, outside: true };
  return { at: 'home' };
}
