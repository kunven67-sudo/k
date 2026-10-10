// One-life save system (design bible §2, §19, §37).
//
// - Exactly one character/life at a time. Constant autosave, no manual saves, no backups.
// - Death deletes the life and stores an obituary record shown on the next boot.
// - Time keeps going while the game is closed: on load we compute how much game time passed
//   and emit 'life:catchup' so the autopilot simulation can live the character's life.
// - Storage is localStorage now; the cloud adapter (Firebase) plugs in behind the same API later.
//
// Feature modules own a slice of the life object: life.slices[<moduleId>] = <plain JSON>.
// Register a slice with save.registerSlice(id, { create(), migrate?(data, fromVersion) }).

import { bus } from './events.js';
import { clock, newLifeStartUtc, TIME_SCALE } from './clock.js';

const LIFE_KEY = 'gamble.life.v1';
const OBIT_KEY = 'gamble.obituaries.v1';
export const SAVE_VERSION = 1;
const AUTOSAVE_INTERVAL_MS = 15000;

const sliceDefs = new Map();

let life = null;
let dirty = false;
let autosaveTimer = null;

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
    return false;
  }
}

export const save = {
  registerSlice(id, def) {
    sliceDefs.set(id, def);
    // A slice registered after the life loaded still gets its initial data.
    if (life && !(id in life.slices)) {
      life.slices[id] = def.create(life);
      dirty = true;
    }
  },

  get life() {
    return life;
  },

  hasLife() {
    return !!readJson(LIFE_KEY);
  },

  slice(id) {
    if (!life) return null;
    if (!(id in life.slices)) {
      const def = sliceDefs.get(id);
      life.slices[id] = def ? def.create(life) : {};
    }
    return life.slices[id];
  },

  markDirty() {
    dirty = true;
  },

  // Start a brand-new life. `character` comes from the DMV creator.
  newLife(character) {
    const now = Date.now();
    const startUtc = newLifeStartUtc(now);
    life = {
      version: SAVE_VERSION,
      id: crypto.randomUUID ? crypto.randomUUID() : String(now) + Math.random(),
      createdRealMs: now,
      lastRealMs: now,
      startGameMs: startUtc,
      gameMs: startUtc,
      character,
      slices: {},
    };
    for (const [id, def] of sliceDefs) life.slices[id] = def.create(life);
    clock.setTime(startUtc);
    save.commit();
    bus.emit('life:started', life);
    return life;
  },

  // Load the existing life and apply offline catch-up.
  loadLife() {
    const data = readJson(LIFE_KEY);
    if (!data) return null;
    life = data;
    for (const [id, def] of sliceDefs) {
      if (!(id in life.slices)) life.slices[id] = def.create(life);
      else if (def.migrate && (life.version || 0) < SAVE_VERSION) life.slices[id] = def.migrate(life.slices[id], life.version);
    }
    life.version = SAVE_VERSION;
    const now = Date.now();
    const realElapsed = Math.max(0, now - (life.lastRealMs || now));
    const gameElapsed = realElapsed * TIME_SCALE;
    clock.setTime(life.gameMs);
    bus.emit('life:loaded', life);
    if (gameElapsed > 60000) {
      // Autopilot listeners advance their own state; the clock moves to "now".
      bus.emit('life:catchup', { fromGameMs: life.gameMs, toGameMs: life.gameMs + gameElapsed, realElapsed });
      clock.setTime(life.gameMs + gameElapsed);
    }
    life.lastRealMs = now;
    save.commit();
    return life;
  },

  commit() {
    if (!life) return;
    life.gameMs = clock.gameMs;
    life.lastRealMs = Date.now();
    bus.emit('save:before-commit', life);
    writeJson(LIFE_KEY, life);
    dirty = false;
    bus.emit('save:committed', life);
  },

  startAutosave() {
    if (autosaveTimer) return;
    autosaveTimer = setInterval(() => {
      if (life) save.commit();
    }, AUTOSAVE_INTERVAL_MS);
    const flush = () => {
      if (life) save.commit();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  },

  // One life: death wipes the save and leaves an obituary for the newspaper screen.
  endLife(obituary) {
    if (!life) return;
    const record = {
      lifeId: life.id,
      character: life.character,
      bornGameMs: life.startGameMs,
      diedGameMs: clock.gameMs,
      realPlayedMs: Date.now() - life.createdRealMs,
      ...obituary,
    };
    const obits = readJson(OBIT_KEY) || [];
    obits.unshift(record);
    writeJson(OBIT_KEY, obits.slice(0, 20));
    try {
      localStorage.removeItem(LIFE_KEY);
    } catch {
      /* ignore */
    }
    const ended = life;
    life = null;
    bus.emit('life:ended', { life: ended, obituary: record });
  },

  obituaries() {
    return readJson(OBIT_KEY) || [];
  },
};
