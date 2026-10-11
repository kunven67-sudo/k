// Menus + overlays (HTML on top of the 3D view).

import { settings, resetSettings } from '../core/settings.js';
import { mulberry32 } from '../core/noise.js';
import { moonPhaseName } from '../core/time.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

// RIFT LAB logo: the letters are torn open along a jagged crack with light coming through.
export function logoSVG(seed = 7) {
  const rand = mulberry32(seed);
  const pts = [];
  let y = 128;
  for (let x = -20; x <= 1040; x += 26 + rand() * 30) {
    y = 128 + (rand() - 0.5) * 38;
    pts.push([x, y]);
  }
  const line = pts.map((p) => p.join(',')).join(' ');
  // the glowing crack only runs across the letters
  const crack = pts.filter((p) => p[0] > 150 && p[0] < 850);
  const crackLine = [[150, crack[0][1]], ...crack, [850, crack[crack.length - 1][1]]].map((p) => p.join(',')).join(' ');
  const topPoly = `-40,-80 1080,-80 ${pts.slice().reverse().map((p) => p.join(',')).join(' ')}`;
  const botPoly = `${line} 1080,400 -40,400`;
  return `
  <svg class="logo" viewBox="0 0 1000 250" aria-label="Rift Lab">
    <defs>
      <clipPath id="clipTop${seed}"><polygon points="${topPoly}"/></clipPath>
      <clipPath id="clipBot${seed}"><polygon points="${botPoly}"/></clipPath>
      <linearGradient id="riftGrad" x1="0" x2="1">
        <stop offset="0" stop-color="#7ef2ff"/><stop offset="0.45" stop-color="#ffffff"/><stop offset="1" stop-color="#c9b6ff"/>
      </linearGradient>
      <filter id="riftBlur" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <g class="half-top" clip-path="url(#clipTop${seed})"><text x="500" y="205" text-anchor="middle">RIFT LAB</text></g>
    <g class="half-bot" clip-path="url(#clipBot${seed})"><text x="500" y="205" text-anchor="middle">RIFT LAB</text></g>
    <polyline class="crack" points="${crackLine}"/>
    <polyline class="crack-core" points="${crackLine}"/>
  </svg>`;
}

const TIPS_KEY = 'riftlab.tips.seen';
let seenTips = new Set();
try { seenTips = new Set(JSON.parse(localStorage.getItem(TIPS_KEY) || '[]')); } catch { /* ignore */ }

export class UI {
  constructor(root, fxRoot) {
    this.root = root;
    this.fx = {};
    for (const k of ['hurt', 'tired', 'water', 'cold', 'sick', 'thirst', 'lidtop', 'lidbottom', 'fade']) {
      const el = h('div', { class: `fx-layer fx-${k}` });
      fxRoot.append(el);
      this.fx[k] = el;
    }
    this.layer = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    root.append(this.layer);
    this.screen = null;
    this.tipEl = null;
    this.tipQueue = [];
  }

  clear() {
    if (this.screen) this.screen.remove();
    this.screen = null;
  }

  show(el) {
    this.clear();
    this.screen = el;
    this.root.append(el);
    return el;
  }

  loading(text = 'Loading') {
    const bar = h('i');
    const what = h('div', { class: 'what' }, text);
    const tips = [
      'Everything in a world comes from its seed: share the seed and a friend gets the same land.',
      'The sun, moon phase and stars match the real date + your time zone.',
      'Real speeds: walking is about 1.4 m/s, sprinting about 6 m/s. You get tired.',
      'Fall leaves crunch. Mud squelches. Rocks click. Listen to the ground.',
      'Rivers start in the mountains and carve their way downhill into the lake.',
    ];
    const el = h('div', { class: 'loading' },
      h('div', { html: logoSVG(3), style: 'width:min(420px,80vw)' }),
      h('div', { class: 'bar' }, bar), what,
      h('div', { class: 'tip' }, tips[Math.floor(Math.random() * tips.length)]));
    this.show(el);
    return { set: (p, t) => { bar.style.width = `${Math.round(p * 100)}%`; if (t) what.textContent = t; } };
  }

  mainMenu({ hasSave, saveName, onContinue, onNew, onLoad, onSettings, status }) {
    const el = h('div', { class: 'menu' },
      h('div', { class: 'menu-left' },
        h('div', { html: logoSVG(7) }),
        h('p', { class: 'tagline' }, 'A realistic sandbox. Shrink it. Grow it. Rip it open.'),
        hasSave ? h('button', { class: 'btn primary', onclick: onContinue }, 'Continue', h('small', {}, saveName)) : null,
        h('button', { class: `btn ${hasSave ? '' : 'primary'}`, onclick: onNew }, 'New World', h('small', {}, 'Empty World is ready. Mansion Town + Portal Lab are coming.')),
        h('button', { class: 'btn', onclick: onLoad, ...(hasSave ? {} : { disabled: '' }) }, 'Load World'),
        h('button', { class: 'btn', onclick: onSettings }, 'Settings'),
      ),
      h('div', { class: 'menu-foot' }, 'Rift Lab · early build · everything is made in code'),
      h('div', { class: 'menu-status' }, status || ''),
    );
    return this.show(el);
  }

  newWorldSheet({ onCreate, onBack, defaultSeed }) {
    const state = {
      name: 'My World', seed: defaultSeed, map: 'empty', terrain: 'meadow',
      start: 'now', startAt: '', dayLength: 'real', spawnMode: 'free', arrival: 'appear',
      kit: 'none', godMode: false, deathMode: 'respawn', gore: false, disasters: 'real', battery: 'real', startMoney: '10000',
    };
    const chipGroup = (key, options) => h('div', { class: 'chips' }, options.map(([val, label, soon]) => {
      const c = h('button', { class: `chip ${state[key] === val ? 'on' : ''} ${soon ? 'soon' : ''}`, onclick: () => {
        if (soon) { this.toast('Coming in a later piece of the build.'); return; }
        state[key] = val;
        c.parentElement.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        if (key === 'start') startInput.style.display = val === 'pick' ? 'block' : 'none';
      } }, label, soon ? h('span', { class: 'tag' }, 'soon') : null);
      return c;
    }));
    const nameIn = h('input', { type: 'text', value: state.name, maxlength: '40', oninput: (e) => { state.name = e.target.value; } });
    const seedIn = h('input', { type: 'text', value: state.seed, maxlength: '32', oninput: (e) => { state.seed = e.target.value; } });
    const startInput = h('input', { type: 'datetime-local', style: 'display:none;margin-top:8px', oninput: (e) => { state.startAt = e.target.value; } });
    const toggle = (key, label, sub) => {
      const sw = h('button', { class: `switch ${state[key] ? 'on' : ''}`, 'aria-label': label, onclick: () => { state[key] = !state[key]; sw.classList.toggle('on', state[key]); } });
      return h('div', { class: 'toggle' }, h('div', {}, label, sub ? h('small', {}, sub) : null), sw);
    };
    const el = h('div', { class: 'sheet panel' },
      h('h2', {}, 'New World'),
      h('p', { class: 'sub' }, 'Pick how your world starts. You can change settings later.'),
      h('div', { class: 'field' }, h('label', {}, 'World name'), nameIn),
      h('div', { class: 'field' }, h('label', {}, 'Map'), chipGroup('map', [['empty', 'Empty World'], ['mansion', 'Mansion Town', true], ['lab', 'Portal Lab', true]])),
      h('div', { class: 'field' }, h('label', {}, 'Terrain'), chipGroup('terrain', [['meadow', 'Meadow + forest'], ['desert', 'Desert + canyon', true], ['snow', 'Snow + mountains', true], ['beach', 'Beach + ocean', true], ['grid', 'White grid', true]])),
      h('div', { class: 'field' }, h('label', {}, 'Seed'), h('div', { class: 'row' }, seedIn, h('button', { class: 'chip', onclick: () => { state.seed = randomSeed(); seedIn.value = state.seed; } }, '🎲'))),
      h('div', { class: 'field' }, h('label', {}, 'Start date + time'), chipGroup('start', [['now', 'Right now (your real clock)'], ['pick', 'Pick a date']]), startInput),
      h('div', { class: 'field' }, h('label', {}, 'Length of one day'), chipGroup('dayLength', [['real', 'Real 24 h'], ['2h', '2 hours'], ['48m', '48 min'], ['24m', '24 min']])),
      h('div', { class: 'field' }, h('label', {}, 'Spawning'), chipGroup('spawnMode', [['free', 'Free (shows real prices)'], ['pay', 'Pay mode']])),
      h('div', { class: 'field' }, h('label', {}, 'Start money (Pay mode)'), chipGroup('startMoney', [['0', '$0'], ['1000', '$1,000'], ['10000', '$10,000'], ['100000', '$100,000'], ['rich', 'Rich inventor']])),
      h('div', { class: 'field' }, h('label', {}, 'Spawned stuff arrives'), chipGroup('arrival', [['appear', 'Where I point'], ['truck', 'Delivery truck', true]])),
      h('div', { class: 'field' }, h('label', {}, 'Start kit'), chipGroup('kit', [['none', 'Clothes + phone'], ['camping', 'Camping kit', true], ['survival', 'Survival kit', true]])),
      h('div', { class: 'field' }, h('label', {}, 'When you die'), chipGroup('deathMode', [['respawn', 'Wake up at spawn'], ['hospital', 'Hospital + bill', true], ['perma', 'Permadeath']])),
      h('div', { class: 'field' }, h('label', {}, 'Rift Tool battery'), chipGroup('battery', [['real', 'Real battery'], ['recharge', 'Self-recharge'], ['unlimited', 'Unlimited']])),
      h('div', { class: 'field' }, h('label', {}, 'Natural disasters'), chipGroup('disasters', [['off', 'Off'], ['real', 'Real-life chance'], ['more', 'More often']])),
      toggle('godMode', 'God mode', 'No hunger, thirst, tiredness or damage'),
      toggle('gore', 'Blood + gore', 'Off by default'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: onBack }, 'Back'),
        h('button', { class: 'btn primary', onclick: () => onCreate({ ...state }) }, 'Create World')),
    );
    this.screen?.append(el);
    return el;
  }

  loadSheet({ saves, onLoad, onDelete, onBack }) {
    const list = h('div');
    const render = () => {
      list.innerHTML = '';
      for (const s of saves()) {
        list.append(h('div', { class: 'row', style: 'margin-bottom:8px' },
          h('button', { class: 'btn', style: 'margin:0', onclick: () => onLoad(s.id) }, s.name, h('small', {}, `${s.mapName} · seed ${s.seed} · ${new Date(s.savedAt).toLocaleString()}`)),
          h('button', { class: 'chip', title: 'Delete', onclick: () => { if (confirm(`Delete "${s.name}"? This can't be undone.`)) { onDelete(s.id); render(); } } }, '🗑')));
      }
      if (!list.childNodes.length) list.append(h('p', { class: 'sub' }, 'No saved worlds yet.'));
    };
    render();
    const el = h('div', { class: 'sheet panel' }, h('h2', {}, 'Load World'), list, h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: onBack }, 'Back')));
    this.screen?.append(el);
    return el;
  }

  settingsSheet({ onBack, onChange }) {
    let tab = 'graphics';
    const body = h('div');
    const slider = (key, label, min, max, step, fmt = (v) => v) => {
      const val = h('span', { style: 'color:var(--muted);font-size:12px' }, fmt(settings[key]));
      const input = h('input', { type: 'range', min, max, step, value: settings[key], oninput: (e) => { settings[key] = parseFloat(e.target.value); val.textContent = fmt(settings[key]); onChange?.(key); } });
      return h('div', { class: 'field' }, h('label', {}, label, ' ', val), input);
    };
    const sw = (key, label, sub) => {
      const b = h('button', { class: `switch ${settings[key] ? 'on' : ''}`, onclick: () => { settings[key] = !settings[key]; b.classList.toggle('on', settings[key]); onChange?.(key); } });
      return h('div', { class: 'toggle' }, h('div', {}, label, sub ? h('small', {}, sub) : null), b);
    };
    const chips = (key, label, opts) => h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'chips' }, opts.map(([v, l]) => {
      const c = h('button', { class: `chip ${settings[key] === v ? 'on' : ''}`, onclick: () => { settings[key] = v; c.parentElement.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); onChange?.(key); } }, l);
      return c;
    })));
    const pages = {
      graphics: () => [
        chips('quality', 'Quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']]),
        slider('renderScale', 'Render scale', 0.5, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`),
        slider('fov', 'Field of view', 55, 100, 1, (v) => `${v}°`),
        slider('grassDensity', 'Grass', 0, 1.5, 0.05, (v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`)),
        sw('shadows', 'Shadows'),
      ],
      controls: () => [
        slider('mouseSensitivity', 'Mouse sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2)),
        sw('invertY', 'Invert mouse Y'),
        sw('headBob', 'Head bob', 'Your head moves a little when you walk'),
        h('div', { class: 'help', html: `
          <b>Move</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <b>Sprint</b> <kbd>Shift</kbd> · <b>Jog toggle</b> <kbd>Caps</kbd><br>
          <b>Jump</b> <kbd>Space</kbd> · <b>Crouch</b> <kbd>Ctrl</kbd>/<kbd>C</kbd> · <b>Lean</b> <kbd>Q</kbd> <kbd>E</kbd><br>
          <b>Look at watch</b> hold <kbd>T</kbd> · <b>Fast-forward time</b> <kbd>F</kbd> · <b>Pause</b> <kbd>Esc</kbd><br>
          <span style="opacity:.7">Changing keys is coming with the phone + spawn app piece.</span>` }),
      ],
      gameplay: () => [
        sw('hud', 'HUD', 'Off = you feel it instead (stomach growls, heavy breathing, red edges)'),
        chips('needs', 'Hunger, thirst + sleep', [['real', 'Real'], ['relaxed', 'Relaxed (half as fast)'], ['off', 'Off']]),
        sw('tips', 'First-time tips'),
        sw('subtitles', 'Subtitles'),
        chips('units', 'Units', [['imperial', 'Feet + °F'], ['metric', 'Meters + °C']]),
        h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => { try { localStorage.removeItem(TIPS_KEY); } catch { /* */ } seenTips = new Set(); this.toast('Tips will show again.'); } }, 'Show all tips again'),
      ],
      audio: () => [
        slider('volMaster', 'Master volume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
        slider('volEffects', 'Effects', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
        slider('volAmbience', 'Nature sounds', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
        slider('volMusic', 'Music', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
        chips('musicMode', 'Music', [['off', 'Off'], ['ambient', 'Ambient'], ['dynamic', 'Dynamic']]),
      ],
    };
    const tabs = h('div', { class: 'tabs' });
    const renderTabs = () => {
      tabs.innerHTML = '';
      for (const [k, label] of [['graphics', 'Graphics'], ['controls', 'Controls'], ['gameplay', 'Gameplay'], ['audio', 'Sound']]) {
        tabs.append(h('button', { class: `chip ${tab === k ? 'on' : ''}`, onclick: () => { tab = k; renderTabs(); renderBody(); } }, label));
      }
    };
    const renderBody = () => { body.innerHTML = ''; body.append(...pages[tab]()); };
    renderTabs();
    renderBody();
    const el = h('div', { class: 'sheet panel' },
      h('h2', {}, 'Settings'), tabs, body,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => { if (confirm('Reset all settings?')) { resetSettings(); renderBody(); onChange?.('*'); } } }, 'Reset'),
        h('button', { class: 'btn primary', onclick: onBack }, 'Done')));
    return el;
  }

  pauseMenu({ onResume, onSettings, onSave, onQuit, worldName }) {
    const el = h('div', { class: 'menu', style: 'background:rgba(5,6,10,0.35)' },
      h('div', { class: 'menu-left panel', style: 'padding:24px' },
        h('h2', { style: "font-family:'Bebas Neue';font-weight:400;font-size:44px;margin:0 0 4px" }, 'Paused'),
        h('p', { class: 'tagline', style: 'margin-left:0' }, worldName),
        h('button', { class: 'btn primary', onclick: onResume }, 'Resume'),
        h('button', { class: 'btn', onclick: onSave }, 'Save'),
        h('button', { class: 'btn', onclick: onSettings }, 'Settings'),
        h('button', { class: 'btn', onclick: onQuit }, 'Save + quit to menu')));
    return this.show(el);
  }

  playOverlay() {
    const el = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    this.dot = h('div', { class: 'dot' });
    el.append(this.dot);
    return this.show(el);
  }

  clickToPlay(show) {
    if (show && !this.clickHint) {
      this.clickHint = h('div', { class: 'clickhint panel' }, 'Click to play');
      this.layer.append(this.clickHint);
    } else if (!show && this.clickHint) { this.clickHint.remove(); this.clickHint = null; }
  }

  tip(id, html, seconds = 7) {
    if (!settings.tips || seenTips.has(id)) return;
    seenTips.add(id);
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...seenTips])); } catch { /* */ }
    this.tipQueue.push({ html, seconds });
    if (!this.tipEl) this.nextTip();
  }

  nextTip() {
    const t = this.tipQueue.shift();
    if (!t) { this.tipEl = null; return; }
    this.tipEl = h('div', { class: 'tipbox panel', html: t.html });
    this.layer.append(this.tipEl);
    setTimeout(() => { this.tipEl?.remove(); this.tipEl = null; setTimeout(() => this.nextTip(), 400); }, t.seconds * 1000);
  }

  toast(text, seconds = 3) {
    const el = h('div', { class: 'toast panel' }, text);
    this.layer.append(el);
    setTimeout(() => el.remove(), seconds * 1000);
  }

  watch(show, clock, sky, sizeM = 1.8) {
    if (!show) { this.watchEl?.remove(); this.watchEl = null; return; }
    if (!this.watchEl) {
      this.watchEl = h('div', { class: 'watch panel' });
      this.layer.append(this.watchEl);
    }
    const ft = sizeM * 3.28084, inch = sizeM * 39.37;
    const size = settings.units === 'imperial'
      ? (inch < 12 ? `${inch < 2 ? inch.toFixed(2) : inch.toFixed(1)}"` : `${Math.floor(ft)}' ${Math.round((ft % 1) * 12)}"`)
      : (sizeM < 1 ? `${(sizeM * 100).toFixed(sizeM < 0.1 ? 1 : 0)} cm` : `${sizeM.toFixed(2)} m`);
    const like = [[0.012, 'about an ant'], [0.03, 'about a bumblebee'], [0.08, 'about a mouse'], [0.2, 'about a hamster standing up'], [0.45, 'about a cat'],
      [0.9, 'about a toddler'], [1.5, 'about a kid'], [2.1, 'normal'], [3.5, 'about an elephant'], [6.5, 'about a giraffe'], [11, 'about a house'], [99, 'about a building']].find(([m]) => sizeM < m)[1];
    this.watchEl.innerHTML = `<div class="time">${clock.formatTime()}</div><div class="date">${clock.formatDate()}</div>
      <div class="line">🌙 <b>${moonPhaseName(sky.state.phase)}</b> (${Math.round(sky.state.moonIllum * 100)}%)</div>
      <div class="line">📏 Your size: <b>${size}</b> (${like})</div>
      <div class="line">${clock.fastForward > 1 ? `⏩ <b>x${clock.fastForward}</b>` : `🍂 ${cap(clock.season())}`}</div>
      ${this.bodyLine ? `<div class="line">${this.bodyLine}</div>` : ''}`;
  }

  progress(p) {
    if (p == null) { this.progEl?.remove(); this.progEl = null; return; }
    if (!this.progEl) { this.progEl = h('div', { class: 'progress-wrap' }, h('div', { class: 'progress-ring' }), h('span')); this.layer.append(this.progEl); }
    this.progEl.firstChild.style.setProperty('--p', `${Math.round(p * 100)}%`);
    this.progEl.lastChild.textContent = `Building… ${Math.round(p * 100)}%`;
  }

  buildBanner(on) {
    if (!on) { this.buildEl?.remove(); this.buildEl = null; return; }
    if (this.buildEl) return;
    this.buildEl = h('div', { class: 'build-banner panel', html: '<b>BUILD MODE</b> · click pick up / set down · scroll turn · <kbd>R</kbd> freeze · <kbd>X</kbd> delete · <kbd>Z</kbd> undo · <kbd>B</kbd> exit' });
    this.layer.append(this.buildEl);
  }

  speed(mult) {
    if (mult <= 1) { this.speedEl?.remove(); this.speedEl = null; return; }
    if (!this.speedEl) { this.speedEl = h('div', { class: 'speedpill panel' }); this.layer.append(this.speedEl); }
    this.speedEl.textContent = `⏩ Time x${mult}`;
  }

  hud(show, p) {
    if (!show) { this.hudEl?.remove(); this.hudEl = null; return; }
    if (!this.hudEl) { this.hudEl = h('div', { class: 'hud panel' }); this.layer.append(this.hudEl); }
    const m = (label, v, col) => `${label}<div class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></div>`;
    const n = p.needs && p.needs.mode !== 'off' ? p.needs : null;
    this.hudEl.innerHTML = m('Health', p.health, '#ff7a7a') + m('Stamina', p.stamina, '#ffffff') + (p.breath < 45 ? m('Air', (p.breath / 45) * 100, '#7ef2ff') : '')
      + (n ? m('Food', (1 - n.hunger) * 100, '#ffc56b') + m('Water', (1 - Math.min(1, n.thirst)) * 100, '#6bc8ff') + m('Energy', (1 - Math.min(1, n.tiredness)) * 100, '#c9b6ff') : '');
  }

  feel(p, dt) {
    // no HUD: you feel it on screen
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - dt * 0.8);
    const lowHealth = p.health < 40 ? (40 - p.health) / 40 : 0;
    this.fx.hurt.style.opacity = Math.min(1, this.hurtFlash + lowHealth * 0.7).toFixed(3);
    const tired = Math.max(0, (40 - p.stamina) / 40);
    this.fx.tired.style.opacity = (tired * 0.7).toFixed(3);
    this.fx.water.style.opacity = p.underwater ? '1' : '0';
    const n = p.needs && p.needs.mode !== 'off' ? p.needs : null;
    const lid = n ? Math.min(1, n.blink || 0) : 0;
    this.fx.lidtop.style.opacity = this.fx.lidbottom.style.opacity = lid > 0.01 ? '1' : '0';
    this.fx.lidtop.style.transform = `translateY(${(-100 + lid * 50).toFixed(1)}%)`;
    this.fx.lidbottom.style.transform = `translateY(${(100 - lid * 50).toFixed(1)}%)`;
    this.fx.sick.style.opacity = n && n.nauseous ? (0.35 + 0.25 * Math.sin(performance.now() / 900)).toFixed(3) : '0';
    this.fx.thirst.style.opacity = n ? Math.max(0, Math.min(0.85, (n.thirst - 0.45) * 1.4)).toFixed(3) : '0';
  }

  // asleep: the screen goes dark, the clock races, click to wake up early
  sleepScreen(info) {
    if (!info) { this.sleepEl?.remove(); this.sleepEl = null; this.fx.fade.style.opacity = '0'; return; }
    this.fx.fade.style.opacity = '1';
    if (!this.sleepEl) { this.sleepEl = h('div', { class: 'sleep-screen' }); this.layer.append(this.sleepEl); }
    this.sleepEl.innerHTML = `<div class="zz">💤</div><div class="t">${info.time}</div><div class="s">${info.text}</div><div class="hint">Click to wake up</div>`;
  }

  deathScreen({ cause, deathMode, onRespawn, onQuit }) {
    const why = { fall: 'You fell too far.', drowning: 'You drowned.', dehydration: 'You died of thirst. (About 3 days without water.)', starvation: 'You starved.' }[cause] || 'You died.';
    const el = h('div', { class: 'center-screen dead', style: 'background:rgba(0,0,0,0.6)' },
      h('div', { class: 'panel', style: 'padding:30px;text-align:center;min-width:320px' },
        h('h1', {}, deathMode === 'perma' ? 'The End' : 'You Died'),
        h('p', {}, why),
        deathMode === 'perma'
          ? h('p', {}, 'Permadeath is on. This world is over and is saved as a memory.')
          : h('button', { class: 'btn primary', style: 'text-align:center', onclick: onRespawn }, 'Wake up at spawn'),
        h('button', { class: 'btn', style: 'text-align:center', onclick: onQuit }, 'Quit to menu')));
    return this.show(el);
  }
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

export function randomSeed() {
  const words = ['maple', 'river', 'quartz', 'fern', 'ember', 'hollow', 'cedar', 'misty', 'acorn', 'falcon', 'stone', 'brook', 'aspen', 'cobalt'];
  const r = Math.random;
  return `${words[Math.floor(r() * words.length)]}-${words[Math.floor(r() * words.length)]}-${Math.floor(r() * 9000 + 1000)}`;
}
