// You: needs, money, what you carry, what you own. Lives in the 'me' save slice.
//
// Needs (master list §5) go from 1 (great) to 0 (desperate). They change every game minute:
//   hunger  8 h to empty         thirst 6.5 h (faster in heat / running)
//   energy  16 h awake           bladder 5 h (drinks fill it up)
//   hygiene ~1.5 days            fun / social slowly drain
// Low needs have real effects: hungry = weak + slower, tired = blurry + slower, bladder at 0 =
// an accident, starving/dehydrated for long = health drops (adults can die; kids pass out and
// wake up at the hospital per §0).
//
// Money is real cash: bills + coins in your wallet (can be lost/stolen), your piggy bank at home.
// What you carry: 2 hands + pockets (small things) + a shopping bag/basket.

import { save } from '../core/save.js';
import { bus } from '../core/events.js';
import { clamp } from '../core/util.js';
import { PRODUCT } from './products.js';

export const NEEDS = ['hunger', 'thirst', 'energy', 'bladder', 'hygiene', 'fun', 'social'];
export const NEED_LABEL = { hunger: 'Hungry', thirst: 'Thirsty', energy: 'Tired', bladder: 'Need to pee', hygiene: 'Smelly', fun: 'Bored', social: 'Lonely' };
const DRAIN = { hunger: 1 / 8, thirst: 1 / 6.5, energy: 1 / 16, bladder: 1 / 5, hygiene: 1 / 36, fun: 1 / 10, social: 1 / 18 }; // per game hour

save.registerSlice('me', {
  create: () => ({
    needs: { hunger: 0.8, thirst: 0.8, energy: 0.95, bladder: 0.9, hygiene: 0.9, fun: 0.7, social: 0.7 },
    health: 1,
    cash: 0, // in your pocket (dollars)
    piggy: 0, // at home
    hands: { right: null, left: null }, // item ids
    pockets: [], // small items: [{ id, uses }]
    bag: [], // bought/carried stuff: [{ id, uses, paid, from }]
    owned: {}, // id -> count kept at home (fridge/closet/room)
    placed: [], // furniture you placed in your room: [{ id, x, y, z, rotY }]
    weight: 0.45, // 0 skinny .. 1 heavy (body over time)
    junk: 0, // recent junk-food load (drives weight + mood)
    caffeine: 0,
    sick: 0, // 0..1 (beer as a kid, food poisoning, flu)
    flags: {},
    stats: { daysLived: 0, moneyEarned: 0, moneySpent: 0, itemsBought: 0 },
  }),
});

export class Me {
  constructor() {
    this._accident = false;
  }

  get data() {
    return save.slice('me');
  }

  get needs() {
    return this.data.needs;
  }

  /** gameMinutes passed; ctx = { sleeping, running, hot, inStoreAC } */
  tick(gameMinutes, ctx = {}) {
    const d = this.data;
    const N = d.needs;
    const h = gameMinutes / 60;
    const sleepK = ctx.sleeping ? 0.45 : 1;
    N.hunger = clamp(N.hunger - DRAIN.hunger * h * sleepK * (ctx.running ? 1.3 : 1), 0, 1);
    N.thirst = clamp(N.thirst - DRAIN.thirst * h * sleepK * (ctx.hot ? 1.8 : 1) * (ctx.running ? 1.6 : 1), 0, 1);
    if (ctx.sleeping) N.energy = clamp(N.energy + (h / 8) * (d.caffeine > 0.3 ? 0.5 : 1), 0, 1);
    else N.energy = clamp(N.energy - DRAIN.energy * h * (ctx.running ? 1.8 : 1), 0, 1);
    N.bladder = clamp(N.bladder - DRAIN.bladder * h * (ctx.sleeping ? 0.35 : 1), 0, 1);
    N.hygiene = clamp(N.hygiene - DRAIN.hygiene * h * (ctx.running ? 2.5 : 1) * (ctx.hot ? 1.5 : 1), 0, 1);
    N.fun = clamp(N.fun - DRAIN.fun * h * (ctx.sleeping ? 0 : 1), 0, 1);
    N.social = clamp(N.social - DRAIN.social * h * (ctx.sleeping ? 0 : 1), 0, 1);
    d.caffeine = Math.max(0, d.caffeine - h * 0.2);
    d.junk = Math.max(0, d.junk - h * 0.02);
    d.sick = Math.max(0, d.sick - h * 0.05);
    // Health: starving or dehydrated hurts; good needs heal slowly.
    const starving = N.hunger < 0.02 ? 1 : 0;
    const parched = N.thirst < 0.02 ? 1 : 0;
    if (starving || parched) d.health = clamp(d.health - h * (0.02 * starving + 0.05 * parched), 0, 1);
    else if (N.hunger > 0.4 && N.thirst > 0.4 && N.energy > 0.2) d.health = clamp(d.health + h * 0.02, 0, 1);
    // Weight follows junk food vs metabolism (genes) very slowly.
    if (!this._accident && N.bladder <= 0) {
      this._accident = true;
      bus.emit('me:accident');
    }
    if (N.bladder > 0.2) this._accident = false;
  }

  /** Eat/drink one serving of a product. Returns the effect summary. */
  consume(id) {
    const p = PRODUCT[id];
    if (!p?.food) return null;
    const f = p.food;
    const N = this.data.needs;
    for (const k of ['hunger', 'thirst', 'energy', 'fun']) if (f[k]) N[k] = clamp(N[k] + f[k], 0, 1);
    if (f.thirst) N.bladder = clamp(N.bladder - f.thirst * 0.45, 0, 1);
    if (f.junk) this.data.junk = clamp(this.data.junk + f.junk * 0.05, 0, 1);
    if (f.caffeine) this.data.caffeine += f.caffeine * 0.5;
    if (f.alcohol) bus.emit('me:alcohol', { id, amount: f.alcohol });
    bus.emit('me:ate', { id, product: p });
    return f;
  }

  restore(need, amount) {
    const N = this.data.needs;
    N[need] = clamp(N[need] + amount, 0, 1);
  }

  set(need, value) {
    this.data.needs[need] = clamp(value, 0, 1);
  }

  /** Lowest need (for the mood + HUD). */
  lowest() {
    let best = null;
    for (const k of NEEDS) if (!best || this.needs[k] < this.needs[best]) best = k;
    return best;
  }

  /** Mood from needs + recent memories (memories are added by the world: 'grounded', 'new toy'...). */
  mood() {
    const N = this.needs;
    const base = (N.hunger + N.thirst + N.energy + N.bladder * 0.6 + N.hygiene * 0.5 + N.fun + N.social * 0.8) / 5.9;
    const mem = (this.data.flags.moodBoost || 0) - (this.data.sick || 0) * 0.4;
    const v = clamp(base + mem, 0, 1);
    const tag = v > 0.75 ? 'happy' : v > 0.5 ? 'fine' : v > 0.3 ? 'meh' : 'sad';
    return { value: v, tag };
  }

  // ------------------------------------------------------------------------------- money
  get cash() {
    return this.data.cash;
  }

  addCash(amount, why = '') {
    this.data.cash = Math.round((this.data.cash + amount) * 100) / 100;
    if (amount > 0) this.data.stats.moneyEarned += amount;
    bus.emit('me:cash', { amount, why, cash: this.data.cash });
  }

  spend(amount) {
    if (amount > this.data.cash + 1e-6) return false;
    this.data.cash = Math.round((this.data.cash - amount) * 100) / 100;
    this.data.stats.moneySpent += amount;
    bus.emit('me:cash', { amount: -amount, cash: this.data.cash });
    return true;
  }

  // ------------------------------------------------------------------------------- items
  /** Put something you got into your bag/pockets (small things go in pockets if room). */
  give(id, { paid = true, from = null, uses = null } = {}) {
    const p = PRODUCT[id];
    const item = { id, uses: uses ?? p?.food?.servings ?? 1, paid, from };
    this.data.bag.push(item);
    bus.emit('me:items');
    return item;
  }

  removeItem(item) {
    const d = this.data;
    for (const list of [d.bag, d.pockets]) {
      const i = list.indexOf(item);
      if (i >= 0) {
        list.splice(i, 1);
        bus.emit('me:items');
        return true;
      }
    }
    return false;
  }

  items() {
    return [...this.data.pockets, ...this.data.bag];
  }

  unpaid(storeId) {
    return this.data.bag.filter((it) => !it.paid && (!storeId || it.from === storeId));
  }

  /** Weight you're carrying (kg, rough) slows you down. */
  carryKg() {
    let kg = 0;
    for (const it of this.items()) {
      const p = PRODUCT[it.id];
      if (!p) continue;
      const [w, h, dd] = p.pack.size;
      kg += Math.min(25, w * h * dd * 350);
    }
    return kg;
  }

  /** Move bag items home (when you walk into your house with bags). */
  unpackAtHome() {
    const d = this.data;
    const keep = [];
    let n = 0;
    for (const it of d.bag) {
      if (!it.paid) {
        keep.push(it);
        continue;
      }
      d.owned[it.id] = (d.owned[it.id] || 0) + 1;
      n++;
    }
    d.bag = keep;
    if (n) bus.emit('me:items');
    return n;
  }
}

export const me = new Me();
