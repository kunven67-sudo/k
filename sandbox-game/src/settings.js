// Player settings, persisted in localStorage when available.
const KEY = 'rls.settings.v1';

export const QUALITY_PRESETS = {
  // Tuned for an entry-level card like the GT 1030 (2GB): one shadowed light, modest shadow map.
  low:    { label: 'Low',               shadowMap: 1024, shadowRange: 45, antialias: false, renderScale: 0.8, maxDebris: 120, envRes: 128 },
  gt1030: { label: 'Medium (GT 1030)',  shadowMap: 2048, shadowRange: 60, antialias: true,  renderScale: 1.0, maxDebris: 220, envRes: 256 },
  high:   { label: 'High',              shadowMap: 4096, shadowRange: 80, antialias: true,  renderScale: 1.0, maxDebris: 400, envRes: 256 },
  ultra:  { label: 'Ultra',             shadowMap: 4096, shadowRange: 110, antialias: true, renderScale: 1.25, maxDebris: 700, envRes: 512 },
};

const DEFAULTS = {
  quality: 'gt1030',
  renderScale: 1.0,
  shadows: true,
  showFps: true,
  sensitivity: 1.0,
  fov: 80,
  volMaster: 0.9,
  volEffects: 1.0,
  volMusic: 0.6,
  volAmbient: 0.7,
  godMode: true,
  infiniteAmmo: false,
  debrisLimit: 220,
  gore: 'max',
  hints: true,
  bindings: null, // filled from DEFAULT_BINDINGS in input.js
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { /* storage blocked: use defaults */ }
  return { ...DEFAULTS };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

const listeners = new Set();
export function onSettingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function getSettings() { return state; }
export function setSetting(key, value) {
  state[key] = value;
  if (key === 'quality') {
    const p = QUALITY_PRESETS[value];
    state.renderScale = p.renderScale;
    state.debrisLimit = p.maxDebris;
  }
  save();
  listeners.forEach((fn) => fn(key, value));
}
export function getPreset() { return QUALITY_PRESETS[state.quality] || QUALITY_PRESETS.gt1030; }
