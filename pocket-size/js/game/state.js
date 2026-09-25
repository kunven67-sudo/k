// Shared game state (the "G" object every system reads from) + save/checkpoint persistence.
const SAVE_KEY = 'pocketsize.save.v1';

export const G = {
  renderer: null,
  camera: null,
  post: null,
  level: null,        // active level object (scene, world, update, ...)
  player: null,
  mode: 'menu',       // menu | feed | play | cutscene | dead | paused | inventory | ending
  time: 0,
  flags: {},
  stats: { deaths: 0, kills: 0, bugs: 0, grass: 0, viruses: 0, crafted: 0, startTime: 0, playTime: 0, wakeTime: 0, damageTaken: 0 },
  checkpoint: null,   // { level, spawn }
  inventory: null,
  chapter: '',
};

export function saveGame() {
  try {
    const data = {
      checkpoint: G.checkpoint,
      flags: G.flags,
      stats: G.stats,
      inventory: G.inventory ? G.inventory.serialize() : null,
      chapter: G.chapter,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    unlockChapter(G.checkpoint && G.checkpoint.level);
  } catch (e) { /* storage unavailable */ }
}

export function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

const CH_KEY = 'pocketsize.chapters.v1';
export function unlockedChapters() {
  try { return new Set(JSON.parse(localStorage.getItem(CH_KEY) || '["feed"]')); } catch (e) { return new Set(['feed']); }
}
export function unlockChapter(id) {
  if (!id) return;
  const s = unlockedChapters();
  s.add(id);
  try { localStorage.setItem(CH_KEY, JSON.stringify([...s])); } catch (e) { /* ignore */ }
}
