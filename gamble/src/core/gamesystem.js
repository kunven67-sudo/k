// Bridge to Game System 2.0 (the owner's game launcher) via its Save Kit (src/gamesystem-kit.js,
// loaded as a classic script before the game). Inside the launcher the real kit holds the save;
// outside it the kit's small fallback keeps a copy in the browser.
//
// GAMBLE's own data lives in a few localStorage keys. This module is imported FIRST by main.js:
// inside the launcher it restores those keys from the kit before any other module reads storage,
// then mirrors them back into the kit on every save commit (and on the kit's own timer).

import { bus } from './events.js';

const KEYS = ['gamble.life.v1', 'gamble.obituaries.v1', 'gamble.settings.v1'];
const GS = window.GameSystem || null;

function snapshot() {
  const keys = {};
  for (const k of KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v != null) keys[k] = v;
    } catch {
      /* storage blocked */
    }
  }
  return { game: 'gamble', v: 1, keys };
}

if (GS) {
  // The launcher's copy wins inside the launcher (one life, wherever you play it).
  try {
    if (GS.inSystem && GS.hasSave()) {
      const s = GS.load();
      if (s && s.keys && !(typeof s.then === 'function')) {
        for (const k of KEYS) {
          if (s.keys[k] != null) localStorage.setItem(k, s.keys[k]);
          else localStorage.removeItem(k);
        }
      }
    }
  } catch {
    /* a broken save never stops the game from starting */
  }
  try {
    GS.autoSave(snapshot, 10);
  } catch {
    /* older kit */
  }
  // Our autosave/flush commits first, then the kit copies the fresh keys.
  bus.on('save:committed', () => {
    try {
      GS.saveNow();
    } catch {
      /* ignore */
    }
  });
  bus.on('settings:changed', () => {
    try {
      GS.saveNow();
    } catch {
      /* ignore */
    }
  });
}

export const gameSystem = {
  get inSystem() {
    return !!GS?.inSystem;
  },
  /** Register pause/resume handlers with the launcher (no-ops outside it). */
  onPause(fn) {
    try {
      GS?.onPause?.(fn);
    } catch {
      /* ignore */
    }
  },
  onResume(fn) {
    try {
      GS?.onResume?.(fn);
    } catch {
      /* ignore */
    }
  },
  saveNow() {
    try {
      GS?.saveNow?.();
    } catch {
      /* ignore */
    }
  },
  /** Back to the launcher. */
  quit() {
    try {
      GS?.quit?.();
    } catch {
      /* ignore */
    }
  },
};
