// The settings menu (from the pause menu, or F10): tabs for graphics, sound,
// gameplay, controls (rebind any key) and the just-for-fun tiny-world switches
// (the realistic tiny stuff is always on; those aren't realistic).
import { ACTIONS, keyLabel } from '../engine/input.js';

const TINY = [
  ['superJump', 'Super jump when tiny', 'Jump ~20× your height like a flea'],
  ['talkingBugs', 'Talking bugs', 'Ants, spiders, beetles and dust mites talk to you'],
  ['moreTinyCities', 'More tiny cities', 'A second tiny village in the park (after a restart)'],
  ['rideCritters', 'Ride your pet rat', 'When tiny, E on your rat to ride it'],
  ['labels', 'Tiny labels', 'Look at tiny things to see what they are'],
];
const TABS = [['graphics', 'Graphics'], ['sound', 'Sound'], ['gameplay', 'Gameplay'], ['controls', 'Controls'], ['tiny', 'Tiny fun']];

export class SettingsPanel {
  constructor({ settings, input, canvas, toast }) {
    Object.assign(this, { settings, input, canvas, toast });
    this.tab = 'graphics';
    this.el = document.getElementById('settingspanel');
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'settingspanel'; this.el.className = 'panel wide'; this.el.hidden = true; document.body.appendChild(this.el); }
    this.el.addEventListener('change', (e) => this.onChange(e));
    this.el.addEventListener('input', (e) => { if (e.target.type === 'range') this.onChange(e); });
    this.el.addEventListener('click', (e) => this.onClick(e));
    addEventListener('keydown', (e) => {
      if (this.binding) return;
      if (e.code === 'F10') { e.preventDefault(); this.isOpen ? this.close() : this.open(); }
      else if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); }
    });
  }

  get isOpen() { return !this.el.hidden; }

  // onClose: where to go back to (the pause menu), otherwise back into the game
  open({ onClose = null } = {}) {
    this.onClose = onClose;
    this.render();
    this.el.hidden = false;
    this.input.enabled = false;
    this.input.clear();
    document.exitPointerLock?.();
  }

  close() {
    if (!this.isOpen) return;
    this.el.hidden = true;
    const back = this.onClose;
    this.onClose = null;
    if (back) { back(); return; }
    this.input.enabled = true;
    this.canvas?.requestPointerLock?.()?.catch?.(() => {});
  }

  render() {
    const g = (p) => this.settings.get(p);
    const sel = (path, opts) => `<select data-path="${path}">${opts.map(([v, l]) => `<option value="${v}" ${g(path) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const range = (path, min, max, step) => `<input type="range" min="${min}" max="${max}" step="${step}" data-path="${path}" value="${g(path) ?? max}"><b class="val">${Math.round((g(path) ?? 1) * 100)}%</b>`;
    const check = (path) => `<input type="checkbox" data-path="${path}" ${g(path) ? 'checked' : ''}>`;
    let body = '';
    if (this.tab === 'graphics') {
      body = `
        <div class="row"><span>Quality <i>Low runs well on weak graphics cards (GT 1030, laptops)</i></span>${sel('graphics.preset', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']])}</div>
        <div class="row"><span>Field of view</span><input type="range" min="60" max="100" step="1" data-path="graphics.fov" value="${g('graphics.fov') ?? 75}"><b class="val">${g('graphics.fov') ?? 75}°</b></div>
        <div class="row"><span>Brightness</span>${range('graphics.brightness', 0.5, 1.5, 0.05)}</div>
        <label class="row"><span>Show FPS (F3)</span>${check('graphics.showFps')}</label>`;
    } else if (this.tab === 'sound') {
      body = `
        <div class="row"><span>Music style</span>${sel('audio.musicStyle', [['goofy', 'Goofy & upbeat'], ['lofi', 'Chill lo-fi'], ['chiptune', 'Retro chiptune'], ['epic', 'Epic / dramatic'], ['off', 'No music']])}</div>
        <div class="row"><span>Master volume</span>${range('audio.master', 0, 1, 0.05)}</div>
        <div class="row"><span>Music</span>${range('audio.music', 0, 1, 0.05)}</div>
        <div class="row"><span>Effects (footsteps, gadgets)</span>${range('audio.effects', 0, 1, 0.05)}</div>
        <div class="row"><span>Voices</span>${range('audio.voices', 0, 1, 0.05)}</div>
        <div class="row"><span>World (birds, rain)</span>${range('audio.ambience', 0, 1, 0.05)}</div>`;
    } else if (this.tab === 'gameplay') {
      body = `
        <div class="row"><span>Difficulty</span>${sel('gameplay.difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['creative', 'Creative (can\'t get hurt)']])}</div>
        <div class="row"><span>Gore</span>${sel('gameplay.gore', [['none', 'None'], ['some', 'Some'], ['full', 'Full']])}</div>
        <div class="row"><span>Camera</span>${sel('gameplay.camera', [['first', 'First person'], ['third', 'Third person']])}</div>`;
    } else if (this.tab === 'controls') {
      const rows = Object.entries(ACTIONS).map(([id, a]) => {
        const keys = this.input.keysFor(id);
        const waiting = this.binding === id;
        return `<div class="row"><span>${a.label}</span><button class="key" data-bind="${id}">${waiting ? 'Press a key… (Esc cancels)' : keys.map(keyLabel).join(' / ') || '—'}</button></div>`;
      }).join('');
      body = `
        <div class="row"><span>Mouse sensitivity</span><input type="range" min="0.2" max="3" step="0.1" data-path="controls.mouseSensitivity" value="${g('controls.mouseSensitivity') ?? 1}"><b class="val">${(g('controls.mouseSensitivity') ?? 1).toFixed(1)}</b></div>
        <label class="row"><span>Invert mouse Y</span>${check('controls.invertY')}</label>
        <label class="row"><span>Crouch is a toggle</span>${check('controls.toggleCrouch')}</label>
        <label class="row"><span>Sprint is a toggle</span>${check('controls.toggleSprint')}</label>
        <h4>Keys <i>click a key to change it</i></h4>${rows}
        <div class="row"><span></span><button data-act="resetkeys">Reset all keys</button></div>`;
    } else if (this.tab === 'tiny') {
      body = `<p class="note">These are just for fun (not realistic), off by default. The realistic tiny stuff is always on: crumbs are meals, bugs, pets, feet and vacuums are dangerous, wind, raindrops, cold, blurry eyes, slow-motion world, and your body giving out below 2 cm.</p>
        ${TINY.map(([k, label, note]) => `<label class="row"><span>${label} <i>${note}</i></span>${check(`tiny.${k}`)}</label>`).join('')}`;
    }
    this.el.innerHTML = `<h3>Settings</h3>
      <div class="tabs">${TABS.map(([id, l]) => `<button data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="tabbody">${body}</div>
      <div class="foot"><button data-act="close">Back (Esc)</button></div>`;
  }

  onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { this.tab = b.dataset.tab; this.render(); return; }
    if (b.dataset.act === 'close') { this.close(); return; }
    if (b.dataset.act === 'resetkeys') { this.settings.set('controls.bindings', {}); this.render(); return; }
    if (b.dataset.bind) {
      const id = b.dataset.bind;
      this.binding = id;
      this.render();
      this.input.captureNext().then((code) => {
        this.binding = null;
        if (code) {
          const all = { ...(this.settings.get('controls.bindings') || {}) };
          all[id] = [code];
          this.settings.set('controls.bindings', all);
          this.toast?.(`${ACTIONS[id].label}: ${keyLabel(code)}`);
        }
        this.render();
      });
    }
  }

  onChange(e) {
    const t = e.target;
    const path = t.dataset.path;
    if (!path) return;
    const value = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value;
    const [a, b] = path.split('.');
    this.settings.set({ [a]: { [b]: value } });
    if (path === 'tiny.moreTinyCities') this.toast?.('More tiny cities: restart the game to build them');
    // live value labels next to sliders
    const val = t.parentElement?.querySelector('.val');
    if (val && t.type === 'range') val.textContent = path === 'graphics.fov' ? `${value}°` : path === 'controls.mouseSensitivity' ? value.toFixed(1) : `${Math.round(value * 100)}%`;
  }

  update() {}
}
