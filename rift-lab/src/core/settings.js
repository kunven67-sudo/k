// Player settings, saved in the browser. Every setting the menus show lives here.

const KEY = 'riftlab.settings.v1';

export const DEFAULTS = {
  // Graphics
  quality: 'auto',          // auto | low | medium | high | ultra
  renderScale: 1,           // 0.5 .. 1.5
  shadows: true,
  grassDensity: 1,          // 0 .. 1.5
  viewDistance: 1600,       // meters
  fov: 75,                  // vertical degrees
  // Controls
  mouseSensitivity: 1,
  invertY: false,
  // Gameplay
  hud: false,               // you picked: no HUD by default
  tips: true,               // first-time tips
  subtitles: true,
  units: 'imperial',        // imperial | metric
  headBob: true,
  // Audio
  volMaster: 0.8,
  volEffects: 0.9,
  volAmbience: 0.8,
  volMusic: 0.5,
  musicMode: 'ambient',     // off | ambient | dynamic
};

const listeners = new Set();
let current = { ...DEFAULTS };

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && typeof saved === 'object') current = { ...DEFAULTS, ...saved };
} catch { /* private mode or blocked storage: defaults are fine */ }

export const settings = new Proxy(current, {
  set(target, prop, value) {
    target[prop] = value;
    try { localStorage.setItem(KEY, JSON.stringify(target)); } catch { /* ignore */ }
    for (const fn of listeners) fn(prop, value);
    return true;
  },
});

export function onSettingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetSettings() {
  for (const k of Object.keys(DEFAULTS)) settings[k] = DEFAULTS[k];
}
