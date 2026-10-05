// Player settings, saved in the browser (if the browser lets us).
const KEY = 'shrinkbox.settings.v1';

const defaults = {
  quality: 'ultra',     // low | medium | high | ultra | auto
  sensitivity: 1,
  invertY: false,
  fov: 75,
  volume: 0.8,
  showFps: false,
  subtitles: true,
};

function load() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...defaults }; }
}

export const settings = load();
const listeners = new Set();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  for (const fn of listeners) fn(settings);
}
export function onSettings(fn) { listeners.add(fn); }

// Max realism by default (lag is OK). Lower it in Settings if a device can't keep up.
export function resolveQuality() {
  if (settings.quality !== 'auto') return settings.quality;
  return 'ultra';
}
