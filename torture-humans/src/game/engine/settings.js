// Game settings: graphics presets + every detail, controls, gameplay, audio.
// Saved in localStorage (the .exe keeps its own Chromium profile, so this persists).

export const GRAPHICS_PRESETS = {
  low: {
    resolutionScale: 0.75, shadows: 'low', shadowDistance: 40, textures: 'low', antialias: 'fxaa',
    ssao: false, bloom: false, sunRays: false, reflections: 'off', grass: 0.25, drawDistance: 250,
    humansDetail: 'low', particles: 0.4, volumetricFog: false, motionBlur: false, anisotropy: 2,
  },
  medium: {
    resolutionScale: 1, shadows: 'medium', shadowDistance: 70, textures: 'medium', antialias: 'fxaa',
    ssao: false, bloom: true, sunRays: false, reflections: 'low', grass: 0.5, drawDistance: 450,
    humansDetail: 'medium', particles: 0.7, volumetricFog: false, motionBlur: false, anisotropy: 4,
  },
  high: {
    resolutionScale: 1, shadows: 'high', shadowDistance: 110, textures: 'high', antialias: 'smaa',
    ssao: true, bloom: true, sunRays: true, reflections: 'medium', grass: 0.8, drawDistance: 700,
    humansDetail: 'high', particles: 1, volumetricFog: true, motionBlur: false, anisotropy: 8,
  },
  ultra: {
    resolutionScale: 1, shadows: 'ultra', shadowDistance: 160, textures: 'ultra', antialias: 'smaa',
    ssao: true, bloom: true, sunRays: true, reflections: 'high', grass: 1, drawDistance: 1000,
    humansDetail: 'ultra', particles: 1, volumetricFog: true, motionBlur: true, anisotropy: 16,
  },
  insane: {
    resolutionScale: 1.5, shadows: 'ultra', shadowDistance: 250, textures: 'ultra', antialias: 'msaa',
    ssao: true, bloom: true, sunRays: true, reflections: 'high', grass: 1.5, drawDistance: 1500,
    humansDetail: 'ultra', particles: 1.5, volumetricFog: true, motionBlur: true, anisotropy: 16,
  },
};

export const SHADOW_MAP_SIZE = { off: 0, low: 1024, medium: 2048, high: 4096, ultra: 4096 };
export const SHADOW_CASCADES = { off: 0, low: 1, medium: 2, high: 3, ultra: 4 };
export const TEXTURE_SIZE = { low: 512, medium: 1024, high: 2048, ultra: 2048 };

export const DEFAULT_SETTINGS = {
  graphics: { preset: 'high', ...GRAPHICS_PRESETS.high, fpsLimit: 0, vsync: true, showFps: false, fov: 75, brightness: 1 },
  controls: {
    mouseSensitivity: 1, invertY: false, gamepadSensitivity: 1, gamepadDeadzone: 0.15,
    toggleCrouch: false, toggleSprint: false, bindings: {},
  },
  gameplay: {
    difficulty: 'normal',       // easy | normal | hard | creative | hardcore
    witnesses: 'wanted',        // wanted | panic | none
    gore: 'some',               // none | some | full
    money: true,                // tiny humans can have money, bank, houses
    camera: 'first',            // first | third
    subtitles: true,
  },
  audio: { master: 1, music: 0.7, effects: 1, voices: 1, ambience: 0.8 },
};

const KEY = 'th.settings.v1';

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

// only keep keys we know, with the right types, so an old/broken save can't break the game
function sanitize(defaults, value) {
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) {
    if (value === undefined || value === null) return defaults;
    if (typeof defaults === 'number') return Number.isFinite(Number(value)) ? Number(value) : defaults;
    if (typeof defaults === 'boolean') return typeof value === 'boolean' ? value : defaults;
    if (typeof defaults === 'string') return typeof value === 'string' ? value : defaults;
    return value;
  }
  const out = {};
  for (const k of Object.keys(defaults)) out[k] = sanitize(defaults[k], value?.[k]);
  // free-form maps (key bindings) keep extra keys
  if (defaults === DEFAULT_SETTINGS.controls.bindings && value && typeof value === 'object') Object.assign(out, value);
  return out;
}

export class Settings {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    let saved = null;
    try { saved = JSON.parse(storage?.getItem(KEY) || 'null'); } catch { saved = null; }
    this.data = sanitize(DEFAULT_SETTINGS, merge(DEFAULT_SETTINGS, saved || {}));
    this.data.controls.bindings = { ...(saved?.controls?.bindings || {}) };
  }

  get(path) {
    return path.split('.').reduce((o, k) => o?.[k], this.data);
  }

  // set('graphics.ssao', true) or set({ graphics: { ssao: true } })
  set(pathOrPatch, value) {
    let patch = pathOrPatch;
    if (typeof pathOrPatch === 'string') {
      patch = {};
      const keys = pathOrPatch.split('.');
      keys.reduce((o, k, i) => (o[k] = i === keys.length - 1 ? value : {}), patch);
    }
    // picking a preset copies its values; changing any detail makes it "custom"
    if (patch.graphics) {
      const g = patch.graphics;
      if (g.preset && GRAPHICS_PRESETS[g.preset]) patch = merge(patch, { graphics: { ...GRAPHICS_PRESETS[g.preset], ...g } });
      else if (Object.keys(g).some((k) => k in GRAPHICS_PRESETS.high)) patch = merge(patch, { graphics: { preset: 'custom' } });
    }
    const bindings = patch.controls?.bindings;
    this.data = sanitize(DEFAULT_SETTINGS, merge(this.data, patch));
    this.data.controls.bindings = bindings ? { ...bindings } : this.data.controls.bindings;
    this.save();
    for (const fn of this.listeners) fn(this.data, patch);
    return this.data;
  }

  reset(section) {
    this.data = section ? { ...this.data, [section]: structuredClone(DEFAULT_SETTINGS[section]) } : structuredClone(DEFAULT_SETTINGS);
    this.save();
    for (const fn of this.listeners) fn(this.data, {});
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  save() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full or blocked: keep running */ }
  }
}
