// Settings persistence + graphics preset application.
const KEY = 'dhg_settings_v1';

const DEFAULTS = {
  graphics: 'medium', // low | medium | high | ultra
  sensitivity: 1.0,   // maps directly to PointerLockControls.pointerSpeed, 0.3 - 2.5
  volume: 0.7,        // 0 - 1
  fov: 75,            // 60 - 100
};

let current = loadRaw();

function loadRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* storage unavailable, ignore */ }
}

export function getSettings() { return { ...current }; }

export function setSetting(key, value) {
  current[key] = value;
  persist();
  notify();
}

const listeners = new Set();
export function onSettingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { listeners.forEach(fn => fn(getSettings())); }

// Graphics presets. Each field is read by main.js / scene builders when constructing
// the renderer, composer and per-scene fog/lighting so "ultra" is visibly heavier than "low".
const GRAPHICS_PRESETS = {
  low: {
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMapSize: 512,
    antialias: false,
    fogDensityMul: 1.6, // fog starts closer -> shorter visible distance
    fogFar: 28,
    bloom: false,
    bloomStrength: 0,
    cameraFar: 60,
    maxDucksVisualDetail: 6,
  },
  medium: {
    pixelRatioCap: 1.25,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    fogDensityMul: 1.15,
    fogFar: 42,
    bloom: false,
    bloomStrength: 0,
    cameraFar: 90,
    maxDucksVisualDetail: 8,
  },
  high: {
    pixelRatioCap: 1.75,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    fogDensityMul: 0.85,
    fogFar: 70,
    bloom: true,
    bloomStrength: 0.45,
    cameraFar: 140,
    maxDucksVisualDetail: 10,
  },
  ultra: {
    pixelRatioCap: 2.0,
    shadows: true,
    shadowMapSize: 4096,
    antialias: true,
    fogDensityMul: 0.55, // thinner fog, sits further out -> much longer draw distance feel
    fogFar: 120,
    bloom: true,
    bloomStrength: 0.85,
    cameraFar: 220,
    maxDucksVisualDetail: 12,
  },
};

export function getGraphicsPreset(name = current.graphics) {
  return GRAPHICS_PRESETS[name] || GRAPHICS_PRESETS.medium;
}

export function getEffectivePixelRatio(preset = getGraphicsPreset()) {
  return Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap);
}
