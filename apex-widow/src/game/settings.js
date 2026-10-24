// Player settings (saved in the browser). Everything from the settings menu lives here.
const KEY = 'aw.settings';
export const DEFAULTS = {
  quality: 'auto', gore: 'medium', bloodColor: 'dark', bloodStays: true,
  music: 0.7, sfx: 0.9, spiderVol: 0.9, voices: 0.9, world: 0.8, news: 0.8, master: 1,
  subtitles: true, subSize: 1,
  camDist: 1, shake: 1, fov: 60, sens: 1, invertY: false, upright: false,
  hud: { minimap: true, size: true, wanted: true, feed: true, meters: true, near: true, kills: true },
  fear: false, hints: true, difficulty: 'normal',
};
export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const out = { ...DEFAULTS, ...s, hud: { ...DEFAULTS.hud, ...(s.hud || {}) } };
  return out;
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
