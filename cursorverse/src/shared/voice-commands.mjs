// Voice command vocabulary. Pure data + parsing so it can be unit tested and
// shared by the main process (listening) and the UI (help list).
//
// Every phrase maps to an action:
//   { kind: 'mouse', op: 'click'|'double'|'triple'|'down'|'up', button }
//   { kind: 'scroll', notches, horizontal }
//   { kind: 'keys', vks: [..], label }     (modifiers first)
//   { kind: 'text', text, enter }         (custom commands that type text)
//   { kind: 'control', op: 'yes'|'no'|'pause'|'resume' }

export const NATO = {
  a: 'alpha', b: 'bravo', c: 'charlie', d: 'delta', e: 'echo', f: 'foxtrot', g: 'golf', h: 'hotel',
  i: 'india', j: 'juliet', k: 'kilo', l: 'lima', m: 'mike', n: 'november', o: 'oscar', p: 'papa',
  q: 'quebec', r: 'romeo', s: 'sierra', t: 'tango', u: 'uniform', v: 'victor', w: 'whiskey',
  x: 'x-ray', y: 'yankee', z: 'zulu',
};

// How each letter sounds when said on its own (extra spellings help the recognizer).
export const LETTER_SOUNDS = {
  a: ['a', 'ay'], b: ['b', 'bee'], c: ['c', 'see', 'sea'], d: ['d', 'dee'], e: ['e'], f: ['f', 'eff'],
  g: ['g', 'gee'], h: ['h', 'aitch'], i: ['i', 'eye'], j: ['j', 'jay'], k: ['k', 'kay'], l: ['l', 'el'],
  m: ['m', 'em'], n: ['n', 'en'], o: ['o', 'oh'], p: ['p', 'pee'], q: ['q', 'cue'], r: ['r', 'are'],
  s: ['s', 'ess'], t: ['t', 'tee'], u: ['u', 'you'], v: ['v', 'vee'], w: ['w', 'double you'],
  x: ['x', 'ex'], y: ['y', 'why'], z: ['z', 'zee', 'zed'],
};

export const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const VK = {
  BACK: 0x08, TAB: 0x09, ENTER: 0x0d, SHIFT: 0x10, CTRL: 0x11, ALT: 0x12, PAUSE: 0x13, CAPS: 0x14,
  ESC: 0x1b, SPACE: 0x20, PGUP: 0x21, PGDN: 0x22, END: 0x23, HOME: 0x24, LEFT: 0x25, UP: 0x26,
  RIGHT: 0x27, DOWN: 0x28, PRTSC: 0x2c, INS: 0x2d, DEL: 0x2e, WIN: 0x5b, MENU: 0x5d,
  VOL_MUTE: 0xad, VOL_DOWN: 0xae, VOL_UP: 0xaf, NEXT: 0xb0, PREV: 0xb1, STOP: 0xb2, PLAY: 0xb3,
};
export { VK };

export const SPECIAL_KEYS = [
  ['enter', [VK.ENTER], ['enter', 'return']],
  ['space', [VK.SPACE], ['space', 'spacebar', 'space bar']],
  ['backspace', [VK.BACK], ['backspace', 'back space', 'delete back']],
  ['delete', [VK.DEL], ['delete']],
  ['tab', [VK.TAB], ['tab']],
  ['escape', [VK.ESC], ['escape']],
  ['up arrow', [VK.UP], ['up', 'up arrow', 'arrow up']],
  ['down arrow', [VK.DOWN], ['down', 'down arrow', 'arrow down']],
  ['left arrow', [VK.LEFT], ['left', 'left arrow', 'arrow left']],
  ['right arrow', [VK.RIGHT], ['right', 'right arrow', 'arrow right']],
  ['home', [VK.HOME], ['home']],
  ['end', [VK.END], ['end']],
  ['page up', [VK.PGUP], ['page up']],
  ['page down', [VK.PGDN], ['page down']],
  ['shift', [VK.SHIFT], ['shift']],
  ['control', [VK.CTRL], ['control']],
  ['alt', [VK.ALT], ['alt']],
  ['caps lock', [VK.CAPS], ['caps lock']],
  ['insert', [VK.INS], ['insert']],
  ['print screen', [VK.PRTSC], ['print screen']],
  ['windows key', [VK.WIN], ['windows', 'windows key', 'start menu']],
  ['volume up', [VK.VOL_UP], ['volume up']],
  ['volume down', [VK.VOL_DOWN], ['volume down']],
  ['mute', [VK.VOL_MUTE], ['mute']],
  ['play pause', [VK.PLAY], ['play', 'pause', 'play pause']],
  ['next track', [VK.NEXT], ['next track']],
  ['previous track', [VK.PREV], ['previous track']],
];
for (let i = 1; i <= 12; i++) SPECIAL_KEYS.push([`F${i}`, [0x6f + i], [`f ${i}`, `f${i}`, `function ${DIGIT_WORDS[i] || ['ten', 'eleven', 'twelve'][i - 10]}`]]);

export const COMBOS = [
  ['copy', [VK.CTRL, 0x43]], ['paste', [VK.CTRL, 0x56]], ['cut', [VK.CTRL, 0x58]],
  ['undo', [VK.CTRL, 0x5a]], ['redo', [VK.CTRL, 0x59]], ['select all', [VK.CTRL, 0x41]],
  ['save', [VK.CTRL, 0x53]], ['find', [VK.CTRL, 0x46]], ['print', [VK.CTRL, 0x50]],
  ['new tab', [VK.CTRL, 0x54]], ['close tab', [VK.CTRL, 0x57]], ['reopen tab', [VK.CTRL, VK.SHIFT, 0x54]],
  ['next tab', [VK.CTRL, VK.TAB]], ['previous tab', [VK.CTRL, VK.SHIFT, VK.TAB]],
  ['refresh', [0x74]], ['alt tab', [VK.ALT, VK.TAB]], ['close window', [VK.ALT, 0x73]],
  ['show desktop', [VK.WIN, 0x44]], ['task manager', [VK.CTRL, VK.SHIFT, VK.ESC]],
  ['screenshot', [VK.WIN, VK.SHIFT, 0x53]], ['zoom in', [VK.CTRL, 0xbb]], ['zoom out', [VK.CTRL, 0xbd]],
  ['go back', [VK.ALT, VK.LEFT]], ['go forward', [VK.ALT, VK.RIGHT]],
];

export const MOUSE_PHRASES = [
  ['click', { kind: 'mouse', op: 'click', button: 'left' }],
  ['left click', { kind: 'mouse', op: 'click', button: 'left' }],
  ['right click', { kind: 'mouse', op: 'click', button: 'right' }],
  ['middle click', { kind: 'mouse', op: 'click', button: 'middle' }],
  ['double click', { kind: 'mouse', op: 'double', button: 'left' }],
  ['triple click', { kind: 'mouse', op: 'triple', button: 'left' }],
  ['hold click', { kind: 'mouse', op: 'down', button: 'left' }],
  ['let go', { kind: 'mouse', op: 'up', button: 'left' }],
  ['release', { kind: 'mouse', op: 'up', button: 'left' }],
  ['scroll up', { kind: 'scroll', notches: 3, horizontal: false }],
  ['scroll down', { kind: 'scroll', notches: -3, horizontal: false }],
  ['scroll up more', { kind: 'scroll', notches: 10, horizontal: false }],
  ['scroll down more', { kind: 'scroll', notches: -10, horizontal: false }],
  ['scroll left', { kind: 'scroll', notches: -3, horizontal: true }],
  ['scroll right', { kind: 'scroll', notches: 3, horizontal: true }],
];

export const CONTROL_PHRASES = [
  ['yes', 'yes'], ['yeah', 'yes'], ['yep', 'yes'], ['correct', 'yes'],
  ['no', 'no'], ['nope', 'no'], ['wrong', 'no'], ['cancel', 'no'],
  ['stop listening', 'pause'], ['start listening', 'resume'],
];

export const WAKE_WORD = 'hey cursor';

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Builds phrase -> action for the chosen letter style ('both' | 'letters' | 'nato').
export function buildCommandMap(opts = {}) {
  const letterStyle = opts.letters || 'both';
  const map = new Map();
  const put = (phrase, action) => { const p = norm(phrase); if (p && !map.has(p)) map.set(p, action); };

  for (const [p, a] of MOUSE_PHRASES) put(p, a);
  for (const [p, op] of CONTROL_PHRASES) put(p, { kind: 'control', op });

  for (const [letter, sounds] of Object.entries(LETTER_SOUNDS)) {
    const vk = letter.toUpperCase().charCodeAt(0);
    const action = { kind: 'keys', vks: [vk], label: letter.toUpperCase(), isChar: true, group: 'letters' };
    if (letterStyle !== 'nato') for (const s of sounds) put(`click ${s}`, action);
    if (letterStyle !== 'letters') put(`click ${NATO[letter]}`, action);
  }
  for (let d = 0; d <= 9; d++) {
    const action = { kind: 'keys', vks: [0x30 + d], label: String(d), isChar: true, group: 'letters' };
    put(`click ${d}`, action);
    put(`click ${DIGIT_WORDS[d]}`, action);
  }
  for (const [label, vks, phrases] of SPECIAL_KEYS) {
    for (const p of phrases) put(`click ${p}`, { kind: 'keys', vks, label, group: 'keys' });
  }
  for (const [p, vks] of COMBOS) put(`click ${p}`, { kind: 'keys', vks, label: p, group: 'combos' });

  // switch whole groups off (letters/numbers and yes/no always stay)
  const groups = opts.groups || {};
  for (const [phrase, a] of [...map]) {
    const g = a.kind === 'mouse' || a.kind === 'scroll' ? 'mouse' : a.group;
    if (g && g !== 'letters' && groups[g] === false) map.delete(phrase);
  }

  for (const c of (groups.custom === false ? [] : opts.custom || [])) {
    if (!c || !c.phrase || c.enabled === false) continue;
    const phrase = customSayPhrase(c.phrase, opts.customNeedsClick !== false);
    if (!phrase) continue;
    let action = null;
    if (c.type === 'text') action = { kind: 'text', text: String(c.text || ''), enter: !!c.enter, label: c.phrase };
    else if (c.type === 'keys' && Array.isArray(c.vks) && c.vks.length) action = { kind: 'keys', vks: c.vks.map(Number), label: c.label || c.phrase };
    else if (c.type === 'mouse') action = { kind: 'mouse', op: c.op || 'click', button: c.button || 'left', label: c.phrase };
    if (action) {
      action.custom = true;
      // custom commands win over built-ins with the same words
      map.set(phrase, action);
    }
  }
  return map;
}

// What the user actually says for a custom command. With "needs click" on,
// "gg" becomes "click gg" so normal talking can't set it off.
export function customSayPhrase(phrase, needsClick = true) {
  const p = norm(phrase);
  if (!p) return '';
  return needsClick && p !== 'click' && !p.startsWith('click ') ? `click ${p}` : p;
}

// Words people say that are NOT commands. The recognizer only picks from the
// phrases it is given, so without these a plain "H" gets matched to "click h".
// Listing "h" on its own lets it land there instead, and it is then ignored.
const FILLER = ['the', 'a', 'and', 'okay', 'what', 'hey', 'uh', 'um', 'hmm', 'so', 'like', 'bro', 'yo', 'wait', 'go', 'oh', 'is', 'it', 'that', 'this'];
export function decoyPhrases(map) {
  const out = new Set(FILLER);
  for (const p of map.keys()) {
    if (p.startsWith('click ')) out.add(p.slice(6));
  }
  for (const w of Object.values(NATO)) out.add(w);
  for (const k of map.keys()) out.delete(k);
  return [...out].filter(Boolean);
}

// All phrases the recognizer should listen for (wake word variants included).
export function grammarPhrases(map, mode) {
  const phrases = [...map.keys(), ...decoyPhrases(map)];
  if (mode === 'wake') {
    const commands = [...map.keys()].filter((p) => !CONTROL_PHRASES.some(([c]) => c === p));
    return [...phrases, WAKE_WORD, ...commands.map((p) => `${WAKE_WORD} ${p}`)];
  }
  return phrases;
}

// Turns recognized text into { action, phrase, woke } or null.
export function parseUtterance(text, map) {
  let t = norm(text);
  let woke = false;
  if (t === WAKE_WORD) return { action: null, phrase: WAKE_WORD, woke: true };
  if (t.startsWith(`${WAKE_WORD} `)) { woke = true; t = t.slice(WAKE_WORD.length + 1); }
  const action = map.get(t);
  if (!action) return null;
  return { action, phrase: t, woke };
}

// Whether an action needs a "did you say ...?" check under a confirm mode.
export function needsConfirm(action, mode) {
  if (!action || action.kind === 'control') return false;
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return action.kind === 'keys' && !!action.isChar; // 'keys' mode: letters and numbers only
}

export const DELAY_UNITS = { ms: 1, s: 1000, min: 60000 };

// "0.1" + "ms" -> 0.1 ; clamps to 0..1 hour.
export function delayToMs(value, unit) {
  const v = Number(value);
  const mult = DELAY_UNITS[unit] ?? 1;
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(v * mult, 3600000);
}

export function describeAction(action) {
  if (!action) return '';
  switch (action.kind) {
    case 'mouse': return { click: `${action.button} click`, double: 'double click', triple: 'triple click', down: 'hold click', up: 'let go' }[action.op] || 'click';
    case 'scroll': return `scroll ${action.horizontal ? (action.notches > 0 ? 'right' : 'left') : (action.notches > 0 ? 'up' : 'down')}`;
    case 'keys': return action.label;
    case 'text': return `type "${action.text}"`;
    default: return action.op || '';
  }
}
