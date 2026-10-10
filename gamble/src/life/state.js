// Save slices owned by the life module + small helpers around them.
//
//   money     { cash, bank, chips }                          -> bus 'money:changed' {cash, delta, reason}
//   needs     { hunger, thirst, energy, hygiene, bladder, fun, temp, health }   0..100 (temp: °C core)
//   inventory { pockets: [{ id, kind, ... }] }
//   rent      { paidThroughGameMs, lastKnockDay, rate }
//   phone     { battery, alarm: { on, hour, minute }, photos }

import { save } from '../core/save.js';
import { bus } from '../core/events.js';
import { clock, localParts, zonedToUtc } from '../core/clock.js';

// Names on the napkin: whoever wrote it, nobody remembers. Picked once per life.
const NAPKIN_NAMES = ['Crystal', 'Desiree', 'Tony', 'Marisol', 'Dee', 'Rick', 'Jasmine', 'Lou'];

function randomNapkin() {
  const name = NAPKIN_NAMES[Math.floor(Math.random() * NAPKIN_NAMES.length)];
  const mid = String(200 + Math.floor(Math.random() * 700));
  const end = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return { name, number: `(775) ${mid}-${end}` };
}

export const RENT_RATE = 45;

save.registerSlice('money', { create: () => ({ cash: 100, bank: 0, chips: 0 }) });

save.registerSlice('needs', {
  // Hungover morning: thirsty and tired, but nothing dangerous yet.
  create: () => ({ hunger: 62, thirst: 38, energy: 55, hygiene: 48, bladder: 30, fun: 50, temp: 37, health: 92 }),
});

save.registerSlice('inventory', {
  create: () => {
    const napkin = randomNapkin();
    return {
      pockets: [
        { id: 'wallet', kind: 'wallet' },
        { id: 'phone', kind: 'phone' },
        { id: 'keycard', kind: 'keycard' },
        { id: 'napkin', kind: 'napkin', name: napkin.name, number: napkin.number },
        { id: 'receipt', kind: 'receipt' },
      ],
    };
  },
});

save.registerSlice('rent', {
  // The night you can't remember was paid until today's 11 AM checkout.
  create: (life) => ({ paidThroughGameMs: life?.startGameMs ?? clock.gameMs, lastKnockDay: null, rate: RENT_RATE }),
});

save.registerSlice('phone', {
  create: () => ({ battery: 0.23, alarm: { on: false, hour: 9, minute: 0 }, photos: 0, unlockedOnce: false }),
});

// A detached fallback store so dev pages without a life still work.
const fallback = new Map();

/** Live slice object (persisted when a life exists, an in-memory stand-in otherwise). */
export function slice(id) {
  const s = save.slice(id);
  if (s) return s;
  if (!fallback.has(id)) {
    const defaults = {
      money: { cash: 100, bank: 0, chips: 0 },
      needs: { hunger: 62, thirst: 38, energy: 55, hygiene: 48, bladder: 30, fun: 50, temp: 37, health: 92 },
      inventory: { pockets: [{ id: 'wallet', kind: 'wallet' }, { id: 'phone', kind: 'phone' }, { id: 'keycard', kind: 'keycard' }, { id: 'napkin', kind: 'napkin', ...randomNapkin() }, { id: 'receipt', kind: 'receipt' }] },
      rent: { paidThroughGameMs: clock.gameMs, lastKnockDay: null, rate: RENT_RATE },
      phone: { battery: 0.23, alarm: { on: false, hour: 9, minute: 0 }, photos: 0 },
    };
    fallback.set(id, defaults[id] || {});
  }
  return fallback.get(id);
}

/** Change cash by `delta` (negative to spend). Returns false (and changes nothing) if short. */
export function addCash(delta, reason = '') {
  const m = slice('money');
  if (m.cash + delta < -1e-6) return false;
  m.cash = Math.round((m.cash + delta) * 100) / 100;
  save.markDirty();
  bus.emit('money:changed', { cash: m.cash, delta, reason });
  return true;
}

/** The next 11 AM (Reno time) strictly after `utcMs`. */
export function nextCheckout(utcMs) {
  const p = localParts(utcMs);
  let t = zonedToUtc(p.year, p.month, p.day, 11, 0);
  if (t <= utcMs) {
    const n = localParts(utcMs + 86400000);
    t = zonedToUtc(n.year, n.month, n.day, 11, 0);
  }
  return t;
}

/** The player's room number (world state owns it), with a sane default for dev pages. */
export function roomNumber(state) {
  return state?.roomNumber || save.slice('player')?.roomNumber || 6;
}

/** Character info for the ID card (creator output), if any. */
export function character() {
  return save.life?.character || null;
}
