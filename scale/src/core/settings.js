// Player settings, saved in this browser. Every read/write is wrapped: private windows and blocked
// storage must never break the game.
import { bus } from './events.js';

const KEY = 'scale.settings.v1';
export const DEFAULTS = {
  quality: 'auto', // auto | low | medium | high | ultra
  renderScale: 1,
  fov: 70,
  sensitivity: 1,
  invertY: false,
  showFps: false,
  subtitles: true,
  masterVolume: 0.9,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  voiceVolume: 1,
  needs: 'robot', // full | basic | robot (The Glitch defaults to robot)
  gore: 'max', // off | normal | max
  permadeath: false,
  slowMoFalls: false,
  bugLook: 'real', // real | soft
  cameraDistance: 3.2, // in body heights
  firstPerson: false,
};

let data = { ...DEFAULTS };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = { ...DEFAULTS, ...JSON.parse(raw) };
} catch {
  /* storage unavailable: defaults only */
}

export const settings = {
  get(k) {
    return data[k];
  },
  set(k, v) {
    if (data[k] === v) return;
    data[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
    bus.emit('settings', { key: k, value: v });
  },
  all() {
    return { ...data };
  },
};
