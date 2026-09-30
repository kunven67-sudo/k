import { h, section, slider, toggle, chips, button, row, select, toast } from '../lib.js';
import { state, set } from '../state.js';
import { nav } from '../nav.js';
import { targetEditor } from './target-editor.js';
import {
  NATO, DIGIT_WORDS, SPECIAL_KEYS, COMBOS, MOUSE_PHRASES, delayToMs, WAKE_WORD,
} from '../../../shared/voice-commands.mjs';

const cv = window.cv;

const QUICK_DELAYS = [
  [0.1, 'ms'], [1, 'ms'], [10, 'ms'], [50, 'ms'], [100, 'ms'], [250, 'ms'], [0.5, 's'], [1, 's'], [2, 's'],
  [3, 's'], [5, 's'], [10, 's'], [15, 's'], [30, 's'], [45, 's'], [1, 'min'], [2, 'min'], [5, 'min'],
];
const UNIT_NAMES = { ms: 'milliseconds', s: 'seconds', min: 'minutes' };

// KeyboardEvent.code -> Windows virtual key, for recording custom key commands.
function vkFromCode(code) {
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1].charCodeAt(0);
  if ((m = /^Digit(\d)$/.exec(code))) return 0x30 + Number(m[1]);
  if ((m = /^Numpad(\d)$/.exec(code))) return 0x60 + Number(m[1]);
  if ((m = /^F(\d{1,2})$/.exec(code))) return 0x6f + Number(m[1]);
  return {
    Enter: 0x0d, NumpadEnter: 0x0d, Space: 0x20, Backspace: 0x08, Tab: 0x09, Escape: 0x1b, Delete: 0x2e, Insert: 0x2d,
    Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22, ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
    Minus: 0xbd, Equal: 0xbb, BracketLeft: 0xdb, BracketRight: 0xdd, Backslash: 0xdc, Semicolon: 0xba, Quote: 0xde,
    Comma: 0xbc, Period: 0xbe, Slash: 0xbf, Backquote: 0xc0, CapsLock: 0x14, PrintScreen: 0x2c,
  }[code] || null;
}

function recordKeys(onDone) {
  const input = h('input', { class: 'text', readOnly: true, placeholder: 'Press the keys now...', style: { maxWidth: '240px' } });
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const vk = vkFromCode(e.code);
    if (!vk) { toast(`Can't use ${e.code} 😅`, 'bad'); return; }
    const vks = [...(e.ctrlKey ? [0x11] : []), ...(e.shiftKey ? [0x10] : []), ...(e.altKey ? [0x12] : []), ...(e.metaKey ? [0x5b] : []), vk];
    const label = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', e.metaKey && 'Win', e.code.replace(/^(Key|Digit)/, '')].filter(Boolean).join('+');
    input.value = label;
    onDone({ vks, label });
  });
  return input;
}

export default {
  id: 'voice', title: 'Voice', emoji: '🎤',
  render(main) {
    const v = state.settings.voice;
    const setV = (p) => set({ voice: p });
    const statusBox = h('div', { class: 'row' });
    const meter = h('div', { class: 'meter' }, h('div'));
    const heardBox = h('div', { class: 'hint' }, 'Last heard: —');
    const logBox = h('div', { class: 'list' });

    const drawStatus = (st) => {
      const words = { off: 'Voice control is off', starting: 'Starting up...', listening: 'Listening 👂', ready: `Ready: hold ${v.pttKey?.label || 'your talk key'} to talk`, paused: 'Paused (say "start listening")', error: 'Problem' };
      statusBox.replaceChildren(h('span', { class: `status-dot ${st.state}` }), h('b', {}, words[st.state] || st.state), st.message ? h('small', {}, ` · ${st.message}`) : null);
    };
    const drawLog = (list) => logBox.replaceChildren(...(list.length ? list.slice(0, 8).map((c) => h('div', { class: 'item' }, h('span', {}, c.ok ? '✅' : '⚠️'), h('span', { class: 'grow' }, `"${c.phrase}" → ${c.label}`), h('small', {}, c.at ? new Date(c.at).toLocaleTimeString() : ''))) : [h('small', {}, 'Nothing yet. Say "click"!')]));

    cv.voice.status().then(drawStatus);
    cv.voice.history().then(drawLog);
    const offs = [
      cv.voice.onStatus(drawStatus),
      cv.voice.onLevel((lv) => { meter.firstChild.style.width = `${Math.min(100, lv)}%`; }),
      cv.voice.onHeard((hd) => { heardBox.textContent = `Last heard: "${hd.text}" (${Math.round(hd.confidence * 100)}% sure)${hd.matched ? '' : ' - not a command'}`; }),
      cv.voice.onCommand(() => cv.voice.history().then(drawLog)),
    ];

    // ----- delay picker: type any number + pick the unit
    const ms = delayToMs(v.delayValue, v.delayUnit);
    const delayInput = h('input', { type: 'number', min: 0, step: 'any', value: v.delayValue, style: { width: '120px' },
      onchange: (e) => { const n = Math.max(0, Number(e.target.value) || 0); setV({ delayValue: n }); nav.refresh(); } });
    const delayBox = section('⏱️ How fast it reacts',
      h('p', {}, 'After CursorVerse hears you (and you say "yes" if it asked), it waits this long, then clicks.'),
      row(delayInput,
        select({ value: v.delayUnit, options: Object.entries(UNIT_NAMES).map(([value, label]) => ({ value, label })), onChange: (u) => { setV({ delayUnit: u }); nav.refresh(); } }),
        h('b', {}, ms < 1 ? '⚡ instant' : `= ${ms >= 1000 ? `${+(ms / 1000).toFixed(3)} s` : `${+ms.toFixed(1)} ms`}`)),
      h('div', { class: 'chips delay-chips', style: { marginTop: '10px' } }, QUICK_DELAYS.map(([val, unit]) => h('button', {
        class: `chip${Number(v.delayValue) === val && v.delayUnit === unit ? ' active' : ''}`,
        onclick: () => { setV({ delayValue: val, delayUnit: unit }); nav.refresh(); },
      }, `${val} ${unit}`))),
      h('p', { class: 'hint' }, 'Heads up: it still has to hear the whole word first (about 0.2 - 0.4 s), then the delay starts. Lower "wait after you stop talking" below to make that part faster.'));

    // ----- custom commands
    const customRows = v.custom.map((c, i) => {
      const upd = (p) => { const list = v.custom.slice(); list[i] = { ...c, ...p }; setV({ custom: list }); };
      let valueCell;
      if (c.type === 'text') {
        valueCell = h('div', { class: 'row' },
          h('input', { class: 'text', value: c.text || '', placeholder: 'Text to type', style: { maxWidth: '220px' }, onchange: (e) => upd({ text: e.target.value }) }),
          toggle({ label: '+ Enter', checked: !!c.enter, onChange: (x) => upd({ enter: x }) }));
      } else if (c.type === 'keys') {
        valueCell = h('div', { class: 'row' }, h('span', { class: 'kbd' }, c.label || 'no keys yet'), recordKeys(({ vks, label }) => { upd({ vks, label }); setTimeout(() => nav.refresh(), 50); }));
      } else {
        valueCell = select({ value: `${c.op || 'click'}:${c.button || 'left'}`, options: [
          ['click:left', 'Left click'], ['click:right', 'Right click'], ['click:middle', 'Middle click'], ['double:left', 'Double click'], ['triple:left', 'Triple click'], ['down:left', 'Hold click'], ['up:left', 'Let go'],
        ].map(([value, label]) => ({ value, label })), onChange: (x) => { const [op, b] = x.split(':'); upd({ op, button: b }); } });
      }
      return h('tr', {},
        h('td', {}, toggle({ label: '', checked: c.enabled !== false, onChange: (x) => upd({ enabled: x }) })),
        h('td', {}, h('input', { class: 'text', value: c.phrase || '', placeholder: 'what you say', onchange: (e) => upd({ phrase: e.target.value.trim() }) })),
        h('td', {}, select({ value: c.type, options: [{ value: 'text', label: 'Type text' }, { value: 'keys', label: 'Press keys' }, { value: 'mouse', label: 'Mouse' }], onChange: (x) => { upd({ type: x }); setTimeout(() => nav.refresh(), 50); } })),
        h('td', {}, valueCell),
        h('td', {}, button('🗑️', () => { setV({ custom: v.custom.filter((_, k) => k !== i) }); setTimeout(() => nav.refresh(), 50); }, 'small')));
    });

    const letters = Object.keys(NATO).map((l) => `click ${l} / click ${NATO[l]} → ${l.toUpperCase()}`);
    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '🎤 Voice control'), h('p', {}, 'Say "click" to click. Say "click P" to press P. No hands needed, bro.')),
        toggle({ big: true, label: 'Voice control', checked: v.enabled, onChange: async (x) => { await setV({ enabled: x }); nav.refresh(); } })),
      state.info.platform !== 'win32' ? h('div', { class: 'warn-box' }, 'Voice control uses Windows speech recognition, so it only runs on Windows.') : null,
      section('📡 Status', statusBox, h('div', { class: 'row', style: { marginTop: '10px' } }, h('small', {}, 'Mic level'), meter), heardBox,
        h('p', { class: 'hint' }, '🔒 Works offline with Windows\' own speech engine. Your voice never leaves your PC.')),
      h('div', { class: 'grid2' },
        section('🎙️ How it listens',
          chips({ value: v.mode, options: [{ value: 'always', label: 'Always listening', emoji: '👂' }, { value: 'ptt', label: 'Hold a key to talk', emoji: '🔘' }, { value: 'wake', label: `Wake word "${WAKE_WORD}"`, emoji: '👋' }], onChange: async (x) => { await setV({ mode: x }); nav.refresh(); } }),
          v.mode === 'ptt' ? h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', {}, 'Talk key:'), h('span', { class: 'kbd' }, v.pttKey?.label || 'none'),
            button('Change...', async () => {
              toast('Press any key or a side mouse button 🔘', 'info', 3000);
              const k = await cv.voice.capturePtt();
              if (k) { await setV({ pttKey: k }); toast(`Talk key: ${k.label}`, 'good'); nav.refresh(); } else toast('No key pressed', 'bad');
            }, 'small')) : null,
          v.mode === 'wake' ? h('p', { class: 'hint' }, `Say "${WAKE_WORD}", then your command within 6 seconds. Or say it all at once: "${WAKE_WORD} click".`) : null,
          v.mode === 'always' ? h('p', { class: 'hint' }, 'Normal talking is ignored. It only reacts to command words like "click ...".') : null),
        section('🤔 "Did you say ___?"',
          chips({ value: v.confirm, options: [{ value: 'keys', label: 'Only letters & numbers', emoji: '🔤' }, { value: 'always', label: 'Always ask', emoji: '🛡️' }, { value: 'never', label: 'Never ask (fastest)', emoji: '⚡' }], onChange: async (x) => { await setV({ confirm: x }); nav.refresh(); } }),
          h('p', { class: 'hint' }, 'When it asks, say "yes" to press it or "no" to cancel. No answer = skipped.'),
          slider({ label: 'Wait for yes/no', min: 2, max: 30, value: v.confirmTimeoutSec, format: (x) => `${x}s`, onInput: (x) => setV({ confirmTimeoutSec: x }), live: false })),
        delayBox,
        section('🔤 Letters',
          chips({ value: v.letters, options: [{ value: 'both', label: 'Both', emoji: '✌️' }, { value: 'letters', label: 'Just letters (click P)', emoji: '🔤' }, { value: 'nato', label: 'Pilot words (click papa)', emoji: '✈️' }], onChange: async (x) => { await setV({ letters: x }); nav.refresh(); } }),
          h('p', { class: 'hint' }, 'B, D, E, P, T and V sound alike. If one keeps getting mixed up, use its pilot word (bravo, delta, echo, papa, tango, victor).')),
        section('🎯 Accuracy vs speed',
          slider({ label: 'How sure it must be', min: 0.3, max: 0.95, step: 0.05, value: v.minConfidence, format: (x) => `${Math.round(x * 100)}%`, onInput: (x) => setV({ minConfidence: x }), live: false }),
          slider({ label: 'Wait after you stop talking', min: 60, max: 800, step: 10, value: v.endSilenceMs, format: (x) => `${x} ms`, onInput: (x) => setV({ endSilenceMs: x }), live: false }),
          h('p', { class: 'hint' }, 'Lower = faster but it might cut you off. 150 ms is a good start.'),
          toggle({ label: 'Show the bubble by my cursor', checked: v.showHud, onChange: (x) => setV({ showHud: x }) })),
        section('🧰 Which commands are on',
          h('div', { class: 'stack' },
            toggle({ label: 'Mouse', desc: 'click, right click, double click, scroll, hold click / let go', checked: v.groups.mouse, onChange: (x) => setV({ groups: { mouse: x } }) }),
            toggle({ label: 'Special keys', desc: 'click enter, space, backspace, arrows, F1-F12...', checked: v.groups.keys, onChange: (x) => setV({ groups: { keys: x } }) }),
            toggle({ label: 'Combos', desc: 'click copy, paste, undo, save, alt tab...', checked: v.groups.combos, onChange: (x) => setV({ groups: { combos: x } }) }),
            toggle({ label: 'My own commands', checked: v.groups.custom, onChange: (x) => setV({ groups: { custom: x } }) }),
            h('small', {}, 'Letters, numbers, "yes" and "no" are always on.'))),
      ),
      h('div', { style: { height: '16px' } }),
      section('✍️ My own commands',
        h('p', {}, 'Make any word do anything. Example: say "gg" to type "good game" and press Enter.'),
        h('table', { class: 'cmd-table' },
          h('tr', {}, h('th', {}, 'On'), h('th', {}, 'Say'), h('th', {}, 'Does'), h('th', {}, 'What'), h('th', {})),
          customRows),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          button('➕ Add command', async () => { await setV({ custom: [...v.custom, { phrase: '', type: 'text', text: '', enter: false, enabled: true }] }); nav.refresh(); }, 'primary'),
          button('➕ Example: gg', async () => { await setV({ custom: [...v.custom, { phrase: 'gg', type: 'text', text: 'good game', enter: true, enabled: true }] }); nav.refresh(); }))),
      targetEditor('🎯 Where voice works', v.target, (t) => setV({ target: t })),
      section('🕘 Recent commands', logBox),
      section('📖 Everything you can say',
        h('div', { class: 'cheats' },
          h('div', {}, h('b', {}, '🖱️ Mouse')), ...MOUSE_PHRASES.map(([p]) => h('div', {}, `"${p}"`)),
          h('div', {}, h('b', {}, '🔤 Letters')), ...letters.map((l) => h('div', {}, l)),
          h('div', {}, h('b', {}, '🔢 Numbers')), ...DIGIT_WORDS.map((w, i) => h('div', {}, `click ${i} / click ${w}`)),
          h('div', {}, h('b', {}, '⌨️ Special keys')), ...SPECIAL_KEYS.map(([label, , phrases]) => h('div', {}, `click ${phrases[0]} → ${label}`)),
          h('div', {}, h('b', {}, '📋 Combos')), ...COMBOS.map(([p]) => h('div', {}, `click ${p}`)),
          h('div', {}, h('b', {}, '🎛️ Control')), h('div', {}, '"yes" / "no"'), h('div', {}, '"stop listening" / "start listening"'))),
    );
    return () => offs.forEach((off) => off());
  },
  onSettings() { nav.refresh(); },
};
