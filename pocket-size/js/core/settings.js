// Player-facing settings, persisted to localStorage, plus the graphics presets they map onto.
const KEY = 'pocketsize.settings.v1';

const DEFAULTS = {
  quality: 'high',          // low | medium | high | ultra
  resolutionScale: 1,       // 0.5 .. 1
  shadows: true,
  bloom: true,
  depthOfField: true,
  filmGrain: true,
  motionEffects: true,      // camera shake, head bob, handheld sway
  fov: 70,
  sensitivity: 1,
  invertY: false,
  cameraMode: 'third',      // third | first
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  voice: true,              // text-to-speech for spoken lines
  subtitles: true,
  showFps: false,
  difficulty: 'normal',     // easy | normal | hard
  immersion5d: true,        // extra shake, rumble, heartbeat, spatial audio
};

const PRESETS = {
  low:    { pixelRatioCap: 1,    shadowMap: 1024, shadowRadius: 90,  post: false, bloom: false, dof: false, fxaa: false, grassDensity: 0.35, texSize: 256,  anisotropy: 1,  particles: 0.4, envMap: false },
  medium: { pixelRatioCap: 1.25, shadowMap: 2048, shadowRadius: 130, post: true,  bloom: true,  dof: false, fxaa: true,  grassDensity: 0.6,  texSize: 512,  anisotropy: 4,  particles: 0.7, envMap: true },
  high:   { pixelRatioCap: 1.5,  shadowMap: 2048, shadowRadius: 160, post: true,  bloom: true,  dof: true,  fxaa: true,  grassDensity: 0.85, texSize: 512,  anisotropy: 8,  particles: 1,   envMap: true },
  ultra:  { pixelRatioCap: 2,    shadowMap: 4096, shadowRadius: 200, post: true,  bloom: true,  dof: true,  fxaa: true,  grassDensity: 1.2,  texSize: 1024, anisotropy: 16, particles: 1.3, envMap: true },
};

let settings = { ...DEFAULTS };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
} catch (e) { /* storage unavailable - run with defaults */ }

const listeners = new Set();

export function getSettings() { return settings; }

export function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  listeners.forEach((fn) => fn(key, value));
}

export function onSettingChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetSettings() {
  settings = { ...DEFAULTS };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  listeners.forEach((fn) => fn('*', null));
}

export function getPreset() {
  const p = { ...(PRESETS[settings.quality] || PRESETS.high) };
  p.bloom = p.bloom && settings.bloom;
  p.dof = p.dof && settings.depthOfField;
  p.shadows = settings.shadows;
  return p;
}

export function difficultyMul() {
  return settings.difficulty === 'easy' ? 0.5 : settings.difficulty === 'hard' ? 1.6 : 1;
}
