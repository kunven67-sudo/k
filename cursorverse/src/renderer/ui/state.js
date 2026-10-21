// UI-side copy of the settings, kept in sync with the main process.
import { customToDef } from '../../shared/cursor-render.mjs';

const cv = window.cv;
const listeners = new Set();

export const state = {
  settings: null,
  myCursors: [],
  customDefs: new Map(),
  music: { playing: false },
  info: {},
};

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
export function mergePatch(target, patch) {
  const out = { ...target };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = isObj(v) && isObj(out[k]) ? mergePatch(out[k], v) : v;
  }
  return out;
}

export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(changed, from) { for (const fn of listeners) fn(state.settings, changed, from); }

// Updates locally right away (snappy sliders), then tells the main process.
export function set(patch) {
  state.settings = mergePatch(state.settings, patch);
  emit(Object.keys(patch), 'local');
  return cv.settings.set(patch).catch((err) => console.error('settings.set failed', err));
}

export async function refreshMyCursors(list) {
  state.myCursors = list || await cv.myCursors.list();
  const defs = new Map();
  for (const rec of state.myCursors) {
    try { defs.set(rec.id, await customToDef(rec)); } catch (err) { console.warn('custom cursor failed', rec.name, err); }
  }
  state.customDefs = defs;
  emit(['myCursors'], 'local');
}

export async function initState() {
  state.settings = await cv.settings.get();
  state.info = await cv.app.info();
  state.music = await cv.music.state();
  await refreshMyCursors();
  cv.settings.onChange(({ settings, changed, from }) => {
    state.settings = settings;
    if (from !== 'ui') emit(changed, from);
  });
  cv.music.onState((m) => { state.music = m; emit(['music'], 'music'); });
}
