// Player settings (persisted in localStorage). Every option the design bible puts in Settings
// lives here so menus and systems read one source of truth. Listen with
// bus.on('settings:changed', ({key, value}) => ...).

import { bus } from './events.js';

const KEY = 'gamble.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  language: 'en', // 'en' | 'es'
  // Audio (0..1)
  masterVolume: 0.9,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  ambienceVolume: 0.8,
  voiceVolume: 1.0,
  uiVolume: 0.8,
  // Graphics
  quality: 'auto', // 'auto' | 'low' | 'medium' | 'high' | 'ultra'
  resolutionScale: 1.0, // multiplier on devicePixelRatio cap
  motionBlur: true,
  filmGrain: true,
  bloom: true,
  lensEffects: true, // rain on lens, flares
  fov: 62,
  // Camera / controls
  mouseSensitivity: 1.0,
  invertY: false,
  touchStyle: 'joysticks', // 'joysticks' | 'tap'
  // Content
  swearFilter: true, // bleeped by default
  blood: true, // realistic blood by default, toggleable
  subtitles: false, // off by default (design bible)
  npcVoices: 'tts', // 'tts' | 'gibberish' | 'text'
  // Voice & mic
  micMode: 'open', // 'open' | 'push'
  micEnabled: false,
  voiceTalkToNpcs: true,
  realVoiceOut: true,
  // Online
  nameTags: true,
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
