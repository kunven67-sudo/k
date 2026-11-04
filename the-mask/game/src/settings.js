// THE MASK - settings (saved in this browser). Every read/write is wrapped: private windows can block storage.
const KEY = 'the-mask-settings-v1';
export const DEFAULTS = {
  quality: 'auto',      // auto | low | medium | high | ultra
  master: 0.9, sfx: 1, voices: 1, ambience: 0.6,
  loopMode: 'auto',     // auto = the room loops by itself, record = press a button to record a copy
  loopLen: 30,          // seconds per loop (auto mode)
  rewindRoom: true,     // auto mode: stuff + people go back to how they were when the loop started
  voice: true,          // copies repeat what you said (needs the mic)
  maxCopies: 8,
  turn: 'snap', snapAngle: 30, moveSpeed: 2.2, // VR
  sens: 1, invertY: false, showFps: false,       // PC
  blood: true, rain: true, lightning: true
};
export const S = { ...DEFAULTS };
export function loadSettings() {
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  // Game System 3 presets: inverted look
  try { const p = window.GameSystem && GameSystem.console && GameSystem.console.presets; if (p && p.invertY === true) S.invertY = true; } catch (e) { /* not in GS3 */ }
  return S;
}
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ }
}
