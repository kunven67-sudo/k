// Default settings. Anything missing from the saved file is filled from here,
// so new options appear automatically after an update.
const DEFAULTS = {
  version: 1,
  firstRun: true,
  theme: 'neon',            // neon | glass | pixel
  accent: '',               // '' = theme default
  lowPower: false,

  cursor: {
    enabled: true,
    id: 'neon-cyan',
    size: 32,
    colorMode: 'original',
    hue: 0,
    saturation: 100,
    brightness: 100,
    tint: '#ff2bd6',
    glow: { enabled: false, color: '#00e5ff', size: 6 },
    outline: { enabled: false, color: '#000000', width: 2 },
    anim: 'none',
    animSpeed: 1,
    replace: { normal: true, link: true, text: false, busy: false, precision: false, help: false },
    linkBadge: true,
  },

  effectsEnabled: true,
  trail: { enabled: true, type: 'sparkles', color: '#00e5ff', rainbow: false, length: 1, size: 1, amount: 1, emoji: '⭐' },
  click: { enabled: true, type: 'ripple', color: '#ff2bd6', rainbow: false, size: 1, emoji: '💥' },
  idle: { enabled: false, type: 'zzz', delay: 3, color: '#ffffff' },

  sounds: {
    enabled: true,
    pack: 'mech-blue',
    volume: 0.6,
    pitchVariation: 0.06,
    keyUp: false,
    mouseClicks: false,
    custom: { key: [], space: null, enter: null, backspace: null },
  },

  target: { mode: 'all', apps: [] },

  music: {
    volume: 0.5,
    track: 'lofi-rainy',
    shuffle: false,
    repeat: 'all',          // all | one | off
    autoplay: false,
    userTracks: [],          // { id, name, file }
  },

  background: {
    app: { type: 'animated', animated: 'starfield', file: null, blur: 0, dim: 35 },
    browserSame: true,
    browser: { type: 'animated', animated: 'aurora', file: null, blur: 0, dim: 30 },
  },

  browser: {
    searchEngine: 'google',
    adblock: true,
    restoreTabs: true,
    tabs: [],
    speedDial: [
      { name: 'Google', url: 'https://www.google.com' },
      { name: 'YouTube', url: 'https://www.youtube.com' },
      { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
      { name: 'Reddit', url: 'https://www.reddit.com' },
      { name: 'GitHub', url: 'https://github.com' },
      { name: 'Twitch', url: 'https://www.twitch.tv' },
    ],
  },

  voice: {
    enabled: false,
    mode: 'always',            // always | ptt | wake
    pttKey: { type: 'key', keycode: 66, label: 'F8' },
    confirm: 'keys',           // always | keys | never
    letters: 'both',           // both | letters | nato
    delayValue: 0,
    delayUnit: 'ms',           // ms | s | min
    minConfidence: 0.6,
    endSilenceMs: 150,
    ignoreTalk: true,          // listen for normal sentences too, and ignore them
    talkWeight: 0.5,
    pauseWhenMicBusy: true,    // stop while Discord, voice typing, etc. use the mic
    customNeedsClick: true,    // "gg" is said as "click gg"

    confirmTimeoutSec: 8,
    showHud: true,
    target: { mode: 'all', apps: [] },
    groups: { mouse: true, keys: true, combos: true, custom: true },
    custom: [],
  },

  // Ctrl+Alt instead of Ctrl+Shift: Ctrl+Shift+S/N/R/C already mean
  // Save As / incognito / hard reload / inspect in lots of apps.
  hotkeys: {
    toggleCursor: 'CommandOrControl+Alt+C',
    toggleEffects: 'CommandOrControl+Alt+E',
    toggleSounds: 'CommandOrControl+Alt+S',
    toggleMusic: 'CommandOrControl+Alt+M',
    nextTrack: 'CommandOrControl+Alt+N',
    random: 'CommandOrControl+Alt+R',
    toggleVoice: 'CommandOrControl+Alt+V',
    openApp: 'CommandOrControl+Alt+O',
  },

  autoCheckUpdates: true,
  tourDone: false,
  startWithWindows: false,
  startHidden: true,
  closeToTray: true,
  trayHintShown: false,
  presets: [],
};

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Fills missing keys from defaults; arrays and wrong-typed values fall back safely.
function withDefaults(saved, defaults = DEFAULTS) {
  if (!isObj(saved)) return structuredClone(defaults);
  const out = {};
  for (const [k, dv] of Object.entries(defaults)) {
    const sv = saved[k];
    if (isObj(dv)) out[k] = withDefaults(sv, dv);
    else if (sv === undefined || sv === null && dv !== null) out[k] = structuredClone(dv);
    else if (dv !== null && typeof dv !== typeof sv) out[k] = structuredClone(dv);
    else out[k] = structuredClone(sv);
  }
  // keep extra keys inside open-ended maps (custom sounds etc.)
  for (const [k, sv] of Object.entries(saved)) if (!(k in out) && !(k in defaults)) out[k] = structuredClone(sv);
  return out;
}

// Merges a partial patch into settings (objects merge, arrays/values replace).
function mergePatch(target, patch) {
  const out = structuredClone(target);
  for (const [k, v] of Object.entries(patch || {})) {
    if (isObj(v) && isObj(out[k])) out[k] = mergePatch(out[k], v);
    else out[k] = structuredClone(v);
  }
  return out;
}

module.exports = { DEFAULTS, withDefaults, mergePatch };
