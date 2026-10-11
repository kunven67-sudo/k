// Main menu, pause menu, settings + controls panels.
import { getSettings, setSetting, QUALITY_PRESETS } from '../settings.js';
import { input, ACTION_LABELS, DEFAULT_BINDINGS, keyLabel } from '../engine/input.js';

const $ = (id) => document.getElementById(id);
let handlers = {};
let panelReturn = null;

export function initMenus(h) {
  handlers = h;
  document.body.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'settings') openPanel('settings', btn.closest('.screen').id);
    else if (a === 'controls') openPanel('controls', btn.closest('.screen').id);
    else if (a === 'panel-back') closePanel();
    else handlers[a]?.();
  });
}

export function show(id, v = true) { $(id).classList.toggle('hidden', !v); }

function openPanel(kind, from) {
  panelReturn = from;
  show(from, false);
  show('panel', true);
  $('panel-title').textContent = kind === 'settings' ? 'Settings' : 'Controls';
  if (kind === 'settings') renderSettings(); else renderControls();
}

function closePanel() {
  input.onKeyRaw = null;
  show('panel', false);
  if (panelReturn) show(panelReturn, true);
}

function row(label, control) {
  const r = document.createElement('div');
  r.className = 'set-row';
  const l = document.createElement('span');
  l.textContent = label;
  r.append(l, control);
  return r;
}
function group(text) { const g = document.createElement('div'); g.className = 'set-group'; g.textContent = text; return g; }

function select(key, options, onChange) {
  const s = document.createElement('select');
  for (const [v, label] of options) { const o = document.createElement('option'); o.value = v; o.textContent = label; s.appendChild(o); }
  s.value = String(getSettings()[key]);
  s.onchange = () => { const v = s.value === 'true' ? true : s.value === 'false' ? false : s.value; setSetting(key, v); onChange?.(); };
  return s;
}
function slider(key, min, max, step, fmt = (v) => v) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px';
  const s = document.createElement('input');
  s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = getSettings()[key];
  const val = document.createElement('span'); val.className = 'val'; val.textContent = fmt(+s.value);
  s.oninput = () => { setSetting(key, +s.value); val.textContent = fmt(+s.value); };
  wrap.append(s, val);
  return wrap;
}
const onOff = [[true, 'On'], [false, 'Off']];

function renderSettings() {
  const b = $('panel-body');
  b.innerHTML = '';
  b.append(group('Graphics'));
  b.append(row('Quality', select('quality', Object.entries(QUALITY_PRESETS).map(([k, p]) => [k, p.label]), renderSettings)));
  b.append(row('Render scale', slider('renderScale', 0.5, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`)));
  b.append(row('Shadows', select('shadows', onOff)));
  b.append(row('FPS counter', select('showFps', onOff)));
  b.append(group('Controls'));
  b.append(row('Mouse sensitivity', slider('sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2))));
  b.append(row('Field of view', slider('fov', 60, 110, 1, (v) => `${v}°`)));
  b.append(group('Audio'));
  b.append(row('Master', slider('volMaster', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`)));
  b.append(row('Effects', slider('volEffects', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`)));
  b.append(row('Music', slider('volMusic', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`)));
  b.append(row('Ambient', slider('volAmbient', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`)));
  b.append(group('Gameplay'));
  b.append(row('God mode', select('godMode', onOff)));
  b.append(row('Infinite ammo', select('infiniteAmmo', onOff)));
  b.append(row('Debris limit', slider('debrisLimit', 50, 800, 10)));
  b.append(row('Gore', select('gore', [['max', 'Max'], ['medium', 'Medium'], ['low', 'Low'], ['off', 'Off']])));
  b.append(row('Tips', select('hints', onOff)));
  const note = document.createElement('div');
  note.style.cssText = 'color:#9aa1a9;font-size:12px;margin-top:8px';
  note.textContent = 'Anti-aliasing changes from the Quality preset apply after reloading the game.';
  b.append(note);
}

function renderControls() {
  const b = $('panel-body');
  b.innerHTML = '';
  const fixed = [
    ['Look', 'Mouse'], ['Fire / use tool', 'Left mouse'], ['Aim / tool alt', 'Right mouse'],
    ['Hotbar', '1-9 / mouse wheel'], ['Pause', 'Esc'],
  ];
  b.append(group('Fixed'));
  for (const [a, k] of fixed) {
    const r = document.createElement('div'); r.className = 'key-row';
    r.innerHTML = `<span>${a}</span><span style="color:#9aa1a9;font-family:monospace">${k}</span>`;
    b.append(r);
  }
  b.append(group('Click a key to change it'));
  const binds = getSettings().bindings;
  for (const action of Object.keys(ACTION_LABELS)) {
    const r = document.createElement('div'); r.className = 'key-row';
    const l = document.createElement('span'); l.textContent = ACTION_LABELS[action];
    const btn = document.createElement('button'); btn.className = 'keybtn'; btn.textContent = keyLabel(binds[action]);
    btn.onclick = () => {
      btn.classList.add('listening'); btn.textContent = 'press a key...';
      input.onKeyRaw = (code) => {
        input.onKeyRaw = null;
        if (code !== 'Escape') setSetting('bindings', { ...getSettings().bindings, [action]: code });
        renderControls();
      };
    };
    r.append(l, btn);
    b.append(r);
  }
  const reset = document.createElement('button');
  reset.className = 'mbtn'; reset.textContent = 'Reset to defaults';
  reset.onclick = () => { setSetting('bindings', { ...DEFAULT_BINDINGS }); renderControls(); };
  b.append(reset);
}

const TIPS = [
  'A 55-gallon drum full of fuel weighs about 190 kg. Shoot it and see.',
  'Tempered glass (car windows, glass walls) bursts into thousands of little cubes.',
  'Concrete has steel rebar inside. When it breaks, the rods hold chunks together.',
  'Propane tanks can rocket off before they explode.',
  'Hold the grenade to throw harder. Press right mouse to cook it, but not for too long.',
  'Walls block explosions. Stand behind something solid.',
  'You can only lift things up to about 30 kg with your hands. Use the Physics Gun for the rest.',
  'Nails only hold wood. Welding only works on metal.',
];
export function loadingTip() { return TIPS[Math.floor(Math.random() * TIPS.length)]; }
