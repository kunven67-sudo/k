// Player settings (persisted in localStorage). Every option the design bible puts in Settings
// lives here so menus and systems read one source of truth. Listen with
// bus.on('settings:changed', ({key, value}) => ...).

import { bus } from './events.js';

const KEY = 'reallife.settings.v1';export const DEFAULT_SETTINGS = Object.freeze({
  language: 'en',
  // Audio (0..1)
  masterVolume: 0.9,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  ambienceVolume: 0.8,
  voiceVolume: 1.0,
  radioVolume: 0.8,
  uiVolume: 0.8,
  backgroundMusic: true, // chill music by place (radio / phone / TV music always plays)
  // Graphics
  quality: 'auto', // 'auto' | 'low' | 'medium' | 'high' | 'ultra'
  resolutionScale: 1.0,
  shadows: true,
  grass: true,
  reflections: true,
  drawDistance: 1.0, // multiplier
  peopleCount: 1.0, // multiplier
  carCount: 1.0, // multiplier
  bloom: true,
  filmGrain: false,
  motionBlur: false,
  lensEffects: true,
  fov: 75,
  fpsCounter: false,
  // Camera / controls
  mouseSensitivity: 1.0,
  invertY: false,
  cameraBob: true,
  hudHints: true,
  touchStyle: 'joysticks',
  keyBindings: null, // { action: [codes] } overrides
  // Content
  gore: 'some', // 'off' | 'some' | 'max'  (adults only, ever)
  swearFilter: false,
  subtitles: true,
  voices: 'babble', // 'babble' | 'spoken'
  // Talking brain
  aiBrain: 'builtin', // 'builtin' | 'local' | 'claude'
  claudeKey: '',
  claudeModel: 'claude-haiku-5-5',
  aiDailyLimit: 1.0, // dollars per real day for the Claude key
  localAiUrl: 'http://localhost:11434',
  localAiModel: 'llama3.2',
  // Accessibility
  textScale: 1.0,
  reduceFlashing: false,
  // Dev
  devOverlay: false,
});



let current = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage may be unavailable (private mode) — settings still work for the session */
  }
}

export const settings = {
  get(key) {
    return current[key];
  },
  all() {
    return { ...current };
  },
  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) {
      console.warn(`[settings] unknown key "${key}"`);
      return;
    }
    if (current[key] === value) return;
    current[key] = value;
    persist();
    bus.emit('settings:changed', { key, value });
  },
  reset() {
    current = { ...DEFAULT_SETTINGS };
    persist();
    for (const [key, value] of Object.entries(current)) bus.emit('settings:changed', { key, value });
  },
};
