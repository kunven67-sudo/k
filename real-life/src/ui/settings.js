// Settings (Esc > Settings, phone > Settings, main menu). Every option applies live.
//
//   openSettings({ onClose })

import { el, injectStyle } from '../core/util.js';
import { settings, DEFAULT_SETTINGS } from '../core/settings.js';
import { bus } from '../core/events.js';
import { input, DEFAULT_BINDINGS, ACTION_LABELS } from '../core/input.js';
import { openPanel } from './panel.js';
import { aiStatus, brainMode, CLAUDE_MODELS } from '../talk/ai.js';

injectStyle('settings', `
.rl-panel.settings { width: min(640px, 94vw); }
.st-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 2px 0 12px; }
.st-tabs button { padding: 7px 12px; border-radius: 999px; border: 1px solid #e3dccd; background: var(--paper-2); color: var(--ink); font: 600 13px var(--font-ui); cursor: pointer; }
.st-tabs button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.st-row { display: flex; align-items: center; gap: 12px; padding: 9px 2px; border-bottom: 1px solid #efe8da; }
.st-row .lab { flex: 1; font: 500 14px var(--font-ui); }
.st-row .lab small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
.st-row input[type=range] { width: 170px; accent-color: var(--accent); }
.st-row .val { width: 48px; text-align: right; font: 600 12.5px var(--font-ui); color: var(--muted); }
.st-seg { display: inline-flex; background: var(--paper-2); border-radius: 10px; padding: 3px; gap: 2px; flex-wrap: wrap; }
.st-seg button { border: 0; background: transparent; padding: 6px 10px; border-radius: 8px; font: 600 12.5px var(--font-ui); color: var(--ink); cursor: pointer; }
.st-seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.st-tog { width: 42px; height: 24px; border-radius: 999px; background: #d8d0c0; position: relative; cursor: pointer; border: 0; transition: background .15s; }
.st-tog::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.st-tog.on { background: var(--good, #47b26b); }
.st-tog.on::after { left: 21px; }
.st-row input[type=text], .st-row input[type=password], .st-row input[type=number] { width: 220px; padding: 7px 10px; border-radius: 9px; border: 1px solid #e3dccd; font: 500 13px var(--font-ui); background: #fff; }
.st-key { min-width: 64px; padding: 6px 10px; border-radius: 8px; border: 1px solid #e3dccd; background: #fff; font: 600 12.5px var(--font-ui); cursor: pointer; }
.st-key.wait { background: var(--accent); color: #fff; }
`);

const pct = (v) => `${Math.round(v * 100)}%`;
const TABS = [
  {
    id: 'Graphics',
    rows: [
      ['quality', 'Quality', 'seg', ['auto', 'low', 'medium', 'high', 'ultra'], 'Auto watches your FPS and picks the best look that stays smooth. Ultra turns everything on, even if it lags.'],
      ['resolutionScale', 'Resolution', 'slider', { min: 0.5, max: 1.5, step: 0.05, fmt: pct }],
      ['shadows', 'Shadows', 'toggle'],
      ['grass', 'Grass', 'toggle'],
      ['reflections', 'Reflections', 'toggle'],
      ['drawDistance', 'Draw distance', 'slider', { min: 0.5, max: 1.5, step: 0.05, fmt: pct }],
      ['peopleCount', 'People around town', 'slider', { min: 0.3, max: 1, step: 0.05, fmt: pct }, 'Fewer people = more FPS.'],
      ['carCount', 'Cars', 'slider', { min: 0, max: 1, step: 0.05, fmt: pct }],
      ['bloom', 'Glow', 'toggle'],
      ['filmGrain', 'Film grain', 'toggle'],
      ['lensEffects', 'Lens effects', 'toggle'],
      ['fov', 'Field of view', 'slider', { min: 55, max: 100, step: 1, fmt: (v) => `${v}°` }],
      ['fpsCounter', 'FPS counter', 'toggle'],
    ],
  },
  {
    id: 'Sound',
    rows: [
      ...[['masterVolume', 'Master'], ['musicVolume', 'Music'], ['sfxVolume', 'Sound effects'], ['ambienceVolume', 'Ambience'], ['voiceVolume', 'Voices'], ['radioVolume', 'Radio + TV'], ['uiVolume', 'Menus']].map(([k, l]) => [k, l, 'slider', { min: 0, max: 1, step: 0.01, fmt: pct }]),
      ['backgroundMusic', 'Chill background music', 'toggle', null, "Music from radios, TVs and your phone always plays."],
    ],
  },
  {
    id: 'Controls',
    rows: [
      ['mouseSensitivity', 'Mouse sensitivity', 'slider', { min: 0.2, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` }],
      ['invertY', 'Invert mouse Y', 'toggle'],
      ['cameraBob', 'Head bob when walking', 'toggle'],
      ['hudHints', 'Show "E: open fridge" hints', 'toggle'],
    ],
    keys: true,
  },
  {
    id: 'People',
    rows: [
      ['subtitles', 'Subtitles', 'toggle'],
      ['voices', 'Voices', 'seg', ['babble', 'spoken'], 'Babble = made-up talking like the Sims. Spoken = your computer reads the lines out loud.'],
      ['swearFilter', 'Swear filter', 'toggle'],
      ['aiBrain', 'Talking brain', 'seg', ['builtin', 'claude', 'local'], 'Built-in works offline. Claude = your own API key (understands anything). Local = a free AI on your PC (Ollama).'],
      ['claudeKey', 'Claude API key', 'password', null, 'Paste it and people use Claude right away. Stays on this computer. Get one at console.anthropic.com.'],
      ['claudeModel', 'Claude model', 'seg', CLAUDE_MODELS, 'Haiku = fast + cheap (best for talking). Sonnet / Opus = smarter, slower, costs more.'],
      ['aiDailyLimit', 'Daily spending limit ($)', 'number', { min: 0.1, max: 50, step: 0.1 }],
      ['localAiUrl', 'Local AI address', 'text'],
      ['localAiModel', 'Local AI model', 'text'],
      ['gore', 'Gore (adults only, ever)', 'seg', ['off', 'some', 'max']],
    ],
  },
  {
    id: 'Accessibility',
    rows: [
      ['textScale', 'Text size', 'slider', { min: 0.85, max: 1.5, step: 0.05, fmt: pct }],
      ['reduceFlashing', 'Reduce flashing', 'toggle'],
      ['devOverlay', 'Dev overlay', 'toggle'],
    ],
  },
];

const applyTextScale = () => document.documentElement.style.setProperty('--text-scale', String(settings.get('textScale')));
applyTextScale();
bus.on('settings:changed', ({ key }) => key === 'textScale' && applyTextScale());

export function openSettings({ onClose } = {}) {
  let tab = 'Graphics';
  const p = openPanel({ title: 'Settings', className: 'settings', onClose });
  const render = () => {
    const def = TABS.find((t) => t.id === tab);
    const tabs = el('div', { class: 'st-tabs' }, TABS.map((t) => el('button', { class: t.id === tab ? 'on' : '', onclick: () => ((tab = t.id), render()) }, [t.id])));
    const rows = def.rows.map((r) => control(r, render));
    if (def.id === 'People') rows.push(el('p', { class: 'rl-note st-brain' }, [brainNote()]));
    if (def.keys) rows.push(...keyRows(render));
    p.setBody([tabs, ...rows]);
  };
  render();
  // Typing/pasting in a box saves as you go: keep the brain buttons + status line in step
  // without re-rendering (that would steal focus from the box you're typing in).
  const off = bus.on('settings:changed', ({ key }) => {
    if (key !== 'claudeKey' && key !== 'aiBrain' && key !== 'claudeModel') return;
    for (const b of p.el.querySelectorAll('.st-seg button[data-k]')) b.classList.toggle('on', settings.get(b.dataset.k) === b.dataset.v);
    const n = p.el.querySelector('.st-brain');
    if (n) n.textContent = brainNote();
  });
  const close = p.close.bind(p);
  p.close = (...a) => (off(), close(...a));
  p.setButtons([
    { text: 'Reset to defaults', onClick: () => (settings.reset(), render()) },
    { text: 'Done', kind: 'go', onClick: () => p.close() },
  ]);
  return p;
}

function brainNote() {
  const st = aiStatus();
  if (brainMode() === 'builtin') return 'Using the built-in brain.';
  return st.ok ? `Ready: ${st.mode === 'claude' ? 'Claude' : 'local AI'} brain.` : `Not ready: ${st.why || 'check the settings above'} (falls back to the built-in brain).`;
}

function control([key, label, kind, opt, help], rerender) {
  const v = settings.get(key);
  const lab = el('div', { class: 'lab' }, [label, help ? el('small', {}, [help]) : null]);
  let ctl;
  if (kind === 'toggle') ctl = el('button', { class: `st-tog ${v ? 'on' : ''}`, onclick: () => (settings.set(key, !settings.get(key)), rerender()) });
  else if (kind === 'seg') ctl = el('div', { class: 'st-seg' }, opt.map((o) => el('button', { class: o === v ? 'on' : '', 'data-k': key, 'data-v': o, onclick: () => (settings.set(key, o), rerender()) }, [o === 'builtin' ? 'built-in' : o])));
  else if (kind === 'slider') {
    const val = el('span', { class: 'val' }, [opt.fmt(v)]);
    const r = el('input', { type: 'range', min: opt.min, max: opt.max, step: opt.step, value: v });
    r.addEventListener('input', () => {
      settings.set(key, +r.value);
      val.textContent = opt.fmt(+r.value);
    });
    ctl = el('span', {}, [r, val]);
  } else {
    const inp = el('input', { type: kind, value: v ?? '', ...(opt || {}), autocomplete: 'off', spellcheck: 'false' });
    inp.addEventListener('change', () => settings.set(key, kind === 'number' ? Math.max(opt?.min ?? 0, +inp.value || DEFAULT_SETTINGS[key]) : inp.value.trim()));
    // Text boxes save while you type/paste (closing Settings right after pasting never fires 'change').
    if (kind !== 'number') inp.addEventListener('input', () => settings.set(key, inp.value.trim()));
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    ctl = inp;
  }
  return el('div', { class: 'st-row' }, [lab, ctl]);
}

let waiting = null;
function keyRows(rerender) {
  const out = [el('p', { class: 'rl-note', style: 'margin-top:14px' }, ['Keys (click one, then press the new key):'])];
  for (const [action, label] of Object.entries(ACTION_LABELS)) {
    if (/^q\d$/.test(action)) continue;
    const codes = input.bindings[action] || DEFAULT_BINDINGS[action] || [];
    const b = el('button', { class: `st-key ${waiting === action ? 'wait' : ''}` }, [waiting === action ? 'Press a key...' : codes.map(niceKey).join(' / ')]);
    b.onclick = () => {
      waiting = action;
      rerender();
      const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('keydown', onKey, true);
        if (e.code !== 'Escape') input.bind(action, [e.code, ...codes.slice(1).filter((c) => c !== e.code)]);
        waiting = null;
        rerender();
      };
      window.addEventListener('keydown', onKey, true);
    };
    out.push(el('div', { class: 'st-row' }, [el('div', { class: 'lab' }, [label]), b]));
  }
  out.push(el('div', { class: 'st-row' }, [el('div', { class: 'lab' }, ['Put all keys back']), el('button', { class: 'st-key', onclick: () => (input.resetBindings(), rerender()) }, ['Reset keys'])]));
  return out;
}

function niceKey(code) {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'R-Shift').replace('Escape', 'Esc').replace('Arrow', '↑ ').replace('↑ Up', '↑').replace('↑ Down', '↓').replace('↑ Left', '←').replace('↑ Right', '→');
}
