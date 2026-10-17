// Chores + allowance (master list §3 kid money). Each morning your parents give you chores
// (depends on the family: strict parents give more, "doesn't care" parents give none, little
// kids get easy ones). Doing them adds to what they owe you; they pay your allowance on Sunday
// (or when you ask and they're fair about it). Doing chores nobody asked for makes them like
// you more. Skipping them makes them less likely to say yes when you ask for stuff.
//
//   const chores = new Chores(life)
//   chores.today -> [{ id, label, pay, done }]   chores.owed   chores.doneToday
//   chores.offer(id, by) / chores.payOut(parentNpc)

import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { me } from './me.js';

export const CHORES = {
  bed: { label: 'Make your bed', pay: 0.5, minAge: 5 },
  dishes: { label: 'Wash the dishes', pay: 2, minAge: 8 },
  trash: { label: 'Take out the kitchen trash', pay: 1, minAge: 7 },
  bin: { label: 'Roll the garbage bin to the curb', pay: 1, minAge: 8, nights: [1] }, // pickup is Tuesday morning
};
const PAY_K = { poor: 0.5, working: 0.75, middle: 1, rich: 1.5, veryrich: 2.5 };

save.registerSlice('chores', {
  create: () => ({ day: -1, list: [], owed: 0, week: -1, doneWeek: 0, extra: 0, skipped: 0 }),
});

export class Chores {
  constructor(life) {
    this.life = life;
    this._offs = [
      bus.on('chore:done', ({ chore }) => this.markDone(chore)),
      bus.on('chore:bin', () => this._bin()),
      bus.on('clock:hour', () => this._hourly()),
    ];
    if (this.d.day !== clock.dayIndex && clock.hour >= 7) this._assign();
  }

  get d() {
    return save.slice('chores');
  }

  get today() {
    return this.d.day === clock.dayIndex ? this.d.list : [];
  }

  get owed() {
    return this.d.owed;
  }

  get doneToday() {
    return this.today.filter((c) => c.done).length;
  }

  get leftToday() {
    return this.today.filter((c) => !c.done);
  }

  _wealth() {
    return save.life?.family?.house?.wealth || 'middle';
  }

  _style() {
    const parents = this.life.people?.parents || [];
    if (!parents.length) return 'chill';
    // The stricter parent sets the chores.
    return parents.reduce((a, b) => ((b.rec.traits.strictness ?? 0) > (a.rec.traits.strictness ?? 0) ? b : a)).rec.style || 'chill';
  }

  /** Morning: what your parents want done today. */
  _assign() {
    const d = this.d;
    // Yesterday's leftovers count as skipped.
    if (d.day >= 0) d.skipped = Math.max(0, d.skipped * 0.6 + d.list.filter((c) => !c.done).length);
    d.day = clock.dayIndex;
    d.list = [];
    const style = this._style();
    const age = clock.age;
    if (style === 'doesnt-care' || age < 5) return;
    const k = PAY_K[this._wealth()] ?? 1;
    const add = (id) => {
      const c = CHORES[id];
      if (!c || age < c.minAge || d.list.some((x) => x.id === id)) return;
      if (c.nights && !c.nights.includes(clock.weekday)) return;
      d.list.push({ id, label: c.label, pay: Math.round(c.pay * k * 4) / 4, done: false });
    };
    add('bed');
    if (style === 'strict' || style === 'overprotective' || clock.dayIndex % 2 === 0) add('dishes');
    if (style === 'strict' || clock.dayIndex % 3 === 1) add('trash');
    add('bin');
  }

  offer(id) {
    const d = this.d;
    if (d.day !== clock.dayIndex) this._assign();
    const c = CHORES[id];
    if (!c || d.list.some((x) => x.id === id)) return false;
    d.list.push({ id, label: c.label, pay: Math.round(c.pay * (PAY_K[this._wealth()] ?? 1) * 4) / 4, done: false });
    return true;
  }

  markDone(id) {
    const d = this.d;
    if (d.day !== clock.dayIndex) this._assign();
    const c = d.list.find((x) => x.id === id);
    const people = this.life.people;
    if (c && !c.done) {
      c.done = true;
      d.owed = Math.round((d.owed + c.pay) * 100) / 100;
      d.doneWeek++;
      for (const p of people?.parents || []) people.memory(p).opinion = Math.min(100, people.memory(p).opinion + 1);
      this.life.hud.toast(`Chore done: ${c.label.toLowerCase()} (+$${c.pay.toFixed(2)} allowance)`);
    } else if (!c) {
      // Nobody asked: they notice and like it, sometimes they tip you for it on Sunday.
      d.extra++;
      for (const p of people?.parents || []) people.memory(p).opinion = Math.min(100, people.memory(p).opinion + 2);
    }
    bus.emit('chores:changed');
  }

  /** Give you what they owe (allowance day or you asked). Returns the amount. */
  payOut() {
    const d = this.d;
    let amt = d.owed;
    // Extra chores nobody asked for: a little bonus.
    if (d.extra > 0) amt += Math.min(3, d.extra * 0.5) * (PAY_K[this._wealth()] ?? 1);
    amt = Math.round(amt * 4) / 4;
    if (amt <= 0) return 0;
    d.owed = 0;
    d.extra = 0;
    me.addCash(amt, 'allowance');
    bus.emit('chores:changed');
    return amt;
  }

  _bin() {
    const isNight = clock.weekday === 1 && clock.hour >= 16;
    this.life.skip(3);
    if (this.today.some((c) => c.id === 'bin')) {
      this.life.hud.toast('You roll the garbage bin down the driveway to the curb. Pickup is tomorrow morning.');
      this.markDone('bin');
    } else this.life.hud.toast(isNight ? 'You roll the bin out to the curb.' : "You roll the bin out... it's not trash night, so you roll it back.");
  }

  _hourly() {
    const d = this.d;
    if (clock.hour === 7 && d.day !== clock.dayIndex) this._assign();
    // New week (Sunday): allowance from whoever is home at breakfast.
    const week = Math.floor(clock.dayIndex / 7);
    if (clock.weekday === 0 && clock.hour >= 9 && d.week !== week) {
      const people = this.life.people;
      const p = people?.parents.find((n) => !n.away);
      if (!p) return;
      d.week = week;
      const amt = this.payOut();
      if (amt > 0) people.say(p, `Here's your allowance. $${amt.toFixed(2)}. You earned it.`, { loud: true, force: true });
      else if (d.doneWeek === 0 && this._style() !== 'doesnt-care') people.say(p, 'No allowance this week, you didn\'t do a single chore.', { loud: true });
      d.doneWeek = 0;
    }
  }

  dispose() {
    for (const off of this._offs) off();
  }
}
