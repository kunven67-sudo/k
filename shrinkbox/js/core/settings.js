// Player settings, saved in the browser (if the browser lets us).
const KEY = 'shrinkbox.settings.v1';

const defaults = {
  quality: 'auto',      // low | medium | high | ultra | auto
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

// Picks a starting quality from the device so weak laptops / phones don't lag.
export function resolveQuality() {
  if (settings.quality !== 'auto') return settings.quality;
  const touch = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (touch) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
}
