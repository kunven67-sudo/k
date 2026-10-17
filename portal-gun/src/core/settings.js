import { store } from '../util.js';

const KEY = 'portalgun.settings.v1';
export const DEFAULTS = {
  master: 0.8,
  music: 0.5,
  sfx: 0.9,
  voice: 'tts',
  voiceVol: 1,
  sens: 1,
  invertY: false,
  fov: 75,
  quality: 'high',
};

export function loadSettings() {
  return { ...DEFAULTS, ...(store.get(KEY, {}) || {}) };
}

export function saveSettings(s) {
  store.set(KEY, s);
}
