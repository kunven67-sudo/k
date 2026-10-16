// Player settings, saved in the browser. Everything the Q&A asked to be a setting lives here.

const KEY = 'terrarium.settings.v1';

export const DEFAULT_KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', crouch: 'ControlLeft',
  interact: 'KeyE', throw: 'KeyQ', squeeze: 'KeyF', pullLimb: 'KeyG',
  talk: 'KeyT', mic: 'KeyB', shrink: 'KeyZ', grow: 'KeyX',
  view: 'KeyV', backpack: 'Tab', changer: 'KeyC', flip: 'KeyR',
  follow: 'KeyK', info: 'KeyI', feed: 'KeyN', slower: 'Comma', faster: 'Period',
};

export const KEY_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  jump: 'Jump', sprint: 'Sprint', crouch: 'Crouch',
  interact: 'Use / interact', throw: 'Throw held thing', squeeze: 'Squeeze (hold)', pullLimb: 'Pull a limb',
  talk: 'Talk (type)', mic: 'Talk (mic, hold)', shrink: 'Shrink yourself (hold)', grow: 'Grow yourself (hold)',
  view: 'First / third person', backpack: 'Backpack', changer: 'Changer', flip: 'Flip gadget mode',
  follow: 'Follow cam on someone', info: 'Person info', feed: 'Show / hide news feed',
  slower: 'Cage time slower', faster: 'Cage time faster',
};

export const defaults = () => ({
  quality: 'auto', // auto | low | medium | high | ultra | insane
  shadows: true, grass: true, jiggle: true, reflections: true, blood: 1, resScale: 1, showFps: false,
  gore: 'max', // none | some | max
  kidGrow: 1, // 0.25 slow .. 4 fast
  witnesses: 'police', // police | panic | none
  escapes: true, glassStrength: 2, // 1 thin .. 3 bulletproof
  backfires: false,
  yourNeeds: false,
  cageDeath: 'respawn', // respawn | keepgear | permadeath
  brain: 'builtin', // builtin | local | claude
  claudeKey: '', claudeModel: 'claude-opus-5-5',
  localModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  voice: 'babble', // babble | spoken
  subtitles: true,
  master: 0.8, music: 0.5, sfx: 0.8, voices: 0.8,
  musicTrack: 'lab',
  sensitivity: 1, invertY: false,
  keys: { ...DEFAULT_KEYS },
});

export const settings = defaults();

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(settings, s);
      settings.keys = { ...DEFAULT_KEYS, ...(s.keys || {}) };
    }
  } catch (e) { /* private mode: keep defaults */ }
  return settings;
}

const listeners = new Set();
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  for (const fn of listeners) fn(settings);
}

export function keyName(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', Tab: 'Tab', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
    Backquote: '`', Minus: '-', Equal: '=', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps' };
  return map[code] || code;
}
