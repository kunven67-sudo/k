// Life slots + one save per life (master list §36).
//
// - Several lives can exist side by side (slots). Each life has exactly ONE save that only ever
//   moves forward: autosave every 20 s, when you sleep, and when the tab closes. There is no
//   "load an older save", so dying can't be undone.
// - Death deletes the life and keeps a short obituary for the life recap.
// - Backups: download a life as a .json file and upload it again later (adds it as a slot).
//
// Feature modules own a slice of the life object:
//   save.registerSlice('needs', { create(life) { return {...} }, migrate?(data, fromVersion) })
//   save.slice('needs') -> the live object (mutate it, it gets saved)

import { bus } from './events.js';
import { clock } from './clock.js';

const INDEX_KEY = 'reallife.slots.v1';
const LIFE_PREFIX = 'reallife.life.';
const OBIT_KEY = 'reallife.obituaries.v1';
const LAST_KEY = 'reallife.lastSlot';
export const SAVE_VERSION = 1;
const AUTOSAVE_MS = 20000;

const sliceDefs = new Map();
let life = null;
let autosaveTimer = null;
let listenersOn = false;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('[save] write failed', err);
    bus.emit('save:failed', { error: err });
    return false;
  }
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function slotMeta(l) {
  const c = l.character || {};
  return {
    id: l.id,
    name: c.name || 'Someone',
    age: Math.floor((l.clockTotal || 0) / 1440 / 4),
    money: l.slices?.money?.cash ?? 0,
    bank: l.slices?.money?.bank ?? 0,
    country: l.slices?.world?.country || 'USA',
    town: l.slices?.world?.town || 'Maple Hollow, OH',
    dateText: l.dateText || '',
    photo: l.photo || null,
    updated: l.lastRealMs || Date.now(),
    created: l.createdRealMs || Date.now(),
  };
}

export const save = {
  registerSlice(id, def) {
    sliceDefs.set(id, def);
    if (life && !(id in life.slices)) life.slices[id] = def.create(life);
  },

  get life() {
    return life;
  },

  /** Saved lives, newest first. */
  slots() {
    const idx = readJson(INDEX_KEY) || [];
    return idx.filter((m) => localStorage.getItem(LIFE_PREFIX + m.id)).sort((a, b) => b.updated - a.updated);
  },

  lastSlotId() {
    try {
      return localStorage.getItem(LAST_KEY);
    } catch {
      return null;
    }
  },

  slice(id) {
    if (!life) return null;
    if (!(id in life.slices)) {
      const def = sliceDefs.get(id);
      life.slices[id] = def ? def.create(life) : {};
    }
    return life.slices[id];
  },

  /** Start a brand-new life. `setup` comes from the new life screen. */
  newLife(setup) {
    const now = Date.now();
    life = {
      version: SAVE_VERSION,
      id: newId(),
      createdRealMs: now,
      lastRealMs: now,
      clockTotal: 0,
      birth: setup.birth || { year: new Date().getFullYear() - 8, season: 0, weekdayOffset: 6 },
      character: setup.character,
      family: setup.family,
      opening: 'birth', // 'birth' -> 'baby' -> 'flashes' -> 'done'
      photo: null,
      slices: {},
    };
    clock.birthYear = life.birth.year;
    clock.birthSeason = life.birth.season;
    clock.weekdayOffset = life.birth.weekdayOffset;
    clock.reset(0, 6 * 60);
    for (const [id, def] of sliceDefs) life.slices[id] = def.create(life);
    save.commit();
    bus.emit('life:started', life);
    return life;
  },

  loadLife(id) {
    const data = readJson(LIFE_PREFIX + id);
    if (!data) return null;
    life = data;
    for (const [sid, def] of sliceDefs) {
      if (!(sid in life.slices)) life.slices[sid] = def.create(life);
      else if (def.migrate && (life.version || 0) < SAVE_VERSION) life.slices[sid] = def.migrate(life.slices[sid], life.version);
    }
    life.version = SAVE_VERSION;
    clock.birthYear = life.birth?.year ?? clock.birthYear;
    clock.birthSeason = life.birth?.season ?? 0;
    clock.weekdayOffset = life.birth?.weekdayOffset ?? 6;
    clock.total = life.clockTotal || 0;
    bus.emit('life:loaded', life);
    return life;
  },

  /** Write the current life (forward only). */
  commit() {
    if (!life) return false;
    life.clockTotal = clock.total;
    life.lastRealMs = Date.now();
    life.dateText = `${clock.dateText()}, ${clock.year}`;
    bus.emit('save:before-commit', life);
    const ok = writeJson(LIFE_PREFIX + life.id, life);
    if (ok) {
      const idx = (readJson(INDEX_KEY) || []).filter((m) => m.id !== life.id);
      idx.push(slotMeta(life));
      writeJson(INDEX_KEY, idx);
      try {
        localStorage.setItem(LAST_KEY, life.id);
      } catch {
        /* ignore */
      }
      bus.emit('save:committed', life);
    }
    return ok;
  },

  setPhoto(dataUrl) {
    if (life) life.photo = dataUrl;
  },

  startAutosave() {
    if (!autosaveTimer) autosaveTimer = setInterval(() => life && save.commit(), AUTOSAVE_MS);
    if (listenersOn) return;
    listenersOn = true;
    const flush = () => life && save.commit();
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  },

  /** Leave the life (back to the menu) without ending it. */
  close() {
    if (life) save.commit();
    life = null;
  },

  deleteSlot(id) {
    try {
      localStorage.removeItem(LIFE_PREFIX + id);
    } catch {
      /* ignore */
    }
    writeJson(INDEX_KEY, (readJson(INDEX_KEY) || []).filter((m) => m.id !== id));
    if (life?.id === id) life = null;
  },

  /** Permadeath: the life is over for good. Keeps a recap record. */
  endLife(recap) {
    if (!life) return null;
    const record = { lifeId: life.id, character: life.character, photo: life.photo, ageYears: Math.floor(clock.age), diedAt: Date.now(), ...recap };
    const obits = readJson(OBIT_KEY) || [];
    obits.unshift(record);
    writeJson(OBIT_KEY, obits.slice(0, 20));
    const ended = life;
    save.deleteSlot(ended.id);
    life = null;
    bus.emit('life:ended', { life: ended, recap: record });
    return record;
  },

  obituaries() {
    return readJson(OBIT_KEY) || [];
  },

  /** Download the current (or given) life as a backup file. */
  download(id = life?.id) {
    if (life && life.id === id) save.commit();
    const data = readJson(LIFE_PREFIX + id);
    if (!data) return false;
    const blob = new Blob([JSON.stringify({ game: 'REAL LIFE', version: SAVE_VERSION, life: data })], { type: 'application/json' });
    const a = document.createElement('a');
    const nm = (data.character?.name || 'life').replace(/[^\w-]+/g, '_');
    a.href = URL.createObjectURL(blob);
    a.download = `real-life_${nm}_age${Math.floor((data.clockTotal || 0) / 5760)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    return true;
  },

  /** Read a backup file chosen by the player. Resolves to the slot meta, or throws. */
  async upload(file) {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file isn't a REAL LIFE save.");
    }
    const data = parsed?.life;
    if (parsed?.game !== 'REAL LIFE' || !data?.id || !data.slices) throw new Error("That file isn't a REAL LIFE save.");
    // A restored backup becomes its own slot so it can't overwrite a newer life with the same id.
    if (localStorage.getItem(LIFE_PREFIX + data.id)) data.id = newId();
    writeJson(LIFE_PREFIX + data.id, data);
    const idx = (readJson(INDEX_KEY) || []).filter((m) => m.id !== data.id);
    idx.push(slotMeta(data));
    writeJson(INDEX_KEY, idx);
    return slotMeta(data);
  },
};
