// Title screen, pause menu, controls and settings, drawn over the live 3D world.
//
// States:
//   title  - first screen. The world runs behind it (you stand in the hall), controls are off.
//   play   - playing. On a computer the mouse is locked to the game.
//   phone  - your phone is out: the mouse is free for the phone screen, you can still walk.
//   pause  - everything stops (Esc, P, or the mouse got unlocked).
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { detectedTier } from '../core/quality.js';
import { bus } from '../core/events.js';

const KEYS = [
  ['Move', ['W', 'A', 'S', 'D']],
  ['Look around', ['Mouse']],
  ['Jump', ['Space']],
  ['Run', ['Shift']],
  ['Crouch', ['C']],
  ['Shrink (hold)', ['Z']],
  ['Grow (hold)', ['X']],
  ['Change size faster', ['Shift', '+', 'Z / X']],
  ['Squeeze-grow when there is no room', ['F', '+', 'X']],
  ['Pick up / use / open', ['E']],
  ['Drop what you hold', ['G']],
  ['Throw (hold to throw harder)', ['Q']],
  ['Empty hands', ['1']],
  ['RIFT shrink ray', ['2']],
  ['Ray: shrink / grow what you aim at', ['Left click', '/', 'Right click']],
  ['Phone (shopping app)', ['Tab']],
  ['Third / first person', ['T']],
  ['Camera distance', ['Mouse wheel']],
  ['Controls card', ['H']],
  ['Pause', ['Esc']],
];

const TOUCH = [
  ['Move', 'Left thumb: drag anywhere on the left side'],
  ['Look', 'Right thumb: drag on the right side'],
  ['Shrink / grow', 'Hold the minus / plus buttons by your left thumb'],
  ['Jump, use, throw, drop', 'Buttons by your right thumb'],
  ['Ray', 'Tap the ray in the hand bar, then hold the shrink or grow beam button'],
  ['Phone', 'Tap the phone in the hand bar'],
];

const kbd = (k) => (k === '+' || k === '/' ? `<i>${k}</i>` : `<kbd>${k}</kbd>`);

export class Menu {
  constructor(root, game) {
    this.game = game;
    this.state = 'title';
    this.tab = 'main';
    this.touch = false;
    this.el = document.createElement('div');
    this.el.className = 'menu interactive show';
    this.el.innerHTML = `
      <div class="mn-panel">
        <div class="mn-logo" aria-label="SCALE"><span>S</span><span>C</span><span>A</span><span>L</span><span>E</span></div>
        <div class="mn-by"><i></i>RIFT LAB<i></i></div>
        <div class="mn-tabs"><button data-tab="main">Play</button><button data-tab="controls">Controls</button><button data-tab="settings">Settings</button></div>
        <section data-tab="main">
          <button class="mn-big" data-act="play">Play</button>
          <p class="mn-hint"></p>
        </section>
        <section data-tab="controls"><div class="mn-keys"></div></section>
        <section data-tab="settings"><div class="mn-set"></div></section>
      </div>`;
    root.appendChild(this.el);
    this.$ = (q) => this.el.querySelector(q);
    this.help = document.createElement('div');
    this.help.className = 'helpcard';
    this.help.innerHTML = `<b>Controls</b>${KEYS.filter((k) => !/Look|Pause|Controls/.test(k[0])).map(([a, ks]) => `<div><span>${a}</span><em>${ks.map(kbd).join('')}</em></div>`).join('')}<small>H to hide</small>`;
    root.appendChild(this.help);
    this._renderKeys();
    this._renderSettings();

    this.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t && t.tagName === 'BUTTON') {
        this.tab = t.dataset.tab;
        this._sync();
        return;
      }
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'play') this.resume();
      if (a && a.dataset.act === 'reload') location.reload();
    });
    // Clicking the dark area around the panel also resumes (desktop habit).
    this.el.addEventListener('mousedown', (e) => {
      if (e.target === this.el && this.state === 'pause') this.resume();
    });
    for (const ev of ['mousedown', 'pointerdown', 'wheel', 'touchstart']) this.el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === input.canvas;
      if (locked) {
        clearTimeout(this._relockT);
        if (this.state === 'phone') this.game.ui.phone.close(); // clicked back into the world
        this.set('play');
      } else if (this.state === 'play' && !this.touch) {
        this.set('pause');
      }
    });
    bus.on('phone', (on) => {
      if (on) this.set('phone');
      else if (this.state === 'phone') {
        this.set('play');
        if (!this.touch) {
          input.requestLock();
          // If the browser didn't give the mouse back (it sometimes needs a click), show the menu.
          clearTimeout(this._relockT);
          this._relockT = setTimeout(() => {
            if (this.state === 'play' && !input.locked) this.set('pause');
          }, 700);
        }
      }
    });
    bus.on('frame', () => this.update());
    // Touch screen or mouse: switch controls to whatever you last used (touchscreen laptops have both).
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.setTouch(true);
      else if (e.pointerType === 'mouse') this.setTouch(false);
    }, { passive: true, capture: true });
    this.set('title');
  }

  setTouch(on) {
    if (this.touch === on) return;
    this.touch = on;
    input.touchMode = on;
    document.getElementById('ui')?.classList.toggle('touch', on);
    bus.emit('touchmode', on);
    this._sync();
  }

  // Leave the menu: lock the mouse (computer) or just go (touch).
  resume() {
    if (this.touch) {
      this.set('play');
      return;
    }
    input.requestLock();
    // Some browsers refuse right after you pressed Esc; the click after that always works.
    this.$('.mn-hint').textContent = 'Click again if the game doesn’t start.';
  }

  set(state) {
    this.state = state;
    const g = this.game;
    g.paused = state === 'pause';
    if (g.player) g.player.showcase = state === 'title';
    document.getElementById('ui')?.classList.toggle('title', state === 'title');
    input.enabled = state === 'play' || state === 'phone';
    if (!input.enabled) input.clearHeld();
    if (state === 'play' && !this._shownHelpHint && !this.touch) {
      this._shownHelpHint = true;
      bus.emit('toast', { text: 'Press H to see the controls', secs: 3.5 });
    }
    this._sync();
  }

  update() {
    if (this.state === 'play' && input.pressed('help')) this.help.classList.toggle('show');
    if (this.state === 'play' && input.pressed('pause') && !this.touch) {
      input.releaseLock();
      this.set('pause');
    }
    if (this.state === 'phone' && input.pressed('pause')) this.game.ui.phone.close();
  }

  _sync() {
    const s = this.state;
    const menuOpen = s === 'title' || s === 'pause';
    this.el.classList.toggle('show', menuOpen);
    this.el.classList.toggle('title', s === 'title');
    document.getElementById('ui')?.classList.toggle('menu-open', menuOpen);
    if (!menuOpen) this.help.classList.toggle('show', this.help.classList.contains('show') && s === 'play');
    this.$('.mn-tabs button[data-tab="main"]').textContent = s === 'pause' ? 'Resume' : 'Play';
    this.$('.mn-big').textContent = s === 'pause' ? 'Resume' : 'Play';
    if (menuOpen && this.tab === 'main') this.$('.mn-hint').textContent = this.touch ? 'Tap Play. Your thumbs do the rest.' : s === 'title' ? 'Click Play. The mouse gets locked to the game (Esc gives it back).' : 'Paused.';
    for (const b of this.el.querySelectorAll('.mn-tabs button')) b.classList.toggle('on', b.dataset.tab === this.tab);
    for (const sec of this.el.querySelectorAll('section')) sec.classList.toggle('on', sec.dataset.tab === this.tab);
    this._renderKeys();
    for (const t of this.el.querySelectorAll('.tgl')) t.classList.toggle('on', !!settings.get(t.dataset.key));
  }

  _renderKeys() {
    const k = this.$('.mn-keys');
    if (this.touch) k.innerHTML = TOUCH.map(([a, b]) => `<div class="row"><span>${a}</span><em class="txt">${b}</em></div>`).join('');
    else k.innerHTML = KEYS.map(([a, ks]) => `<div class="row"><span>${a}</span><em>${ks.map(kbd).join('')}</em></div>`).join('');
  }

  _renderSettings() {
    const box = this.$('.mn-set');
    const q = settings.get('quality');
    const tierName = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };
    box.innerHTML = `
      <div class="row"><span>Graphics<small>Auto picked ${tierName[detectedTier]} for this computer</small></span>
        <div class="seg" data-key="quality">${['auto', 'low', 'medium', 'high', 'ultra'].map((v) => `<button data-v="${v}" class="${q === v ? 'on' : ''}">${v === 'auto' ? 'Auto' : tierName[v]}</button>`).join('')}</div></div>
      <div class="row restart" hidden><span>Graphics changes need a restart<small>Your world isn't saved yet in this early version</small></span><button class="mn-small" data-act="reload">Restart now</button></div>
      ${slider('renderScale', 'Resolution', 0.5, 1, 0.05, (v) => `${Math.round(v * 100)}%`, 'Lower = faster on weak graphics cards')}
      ${slider('fov', 'Field of view', 55, 100, 1, (v) => `${v}°`)}
      ${slider('sensitivity', 'Mouse / touch look speed', 0.2, 3, 0.05, (v) => `${v.toFixed(2)}x`)}
      ${toggle('invertY', 'Invert look up/down')}
      ${toggle('firstPerson', 'First-person camera', 'Same as pressing T')}
      ${toggle('showFps', 'Show FPS')}`;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) {
        const key = b.parentElement.dataset.key;
        settings.set(key, b.dataset.v);
        for (const x of b.parentElement.children) x.classList.toggle('on', x === b);
        if (key === 'quality') box.querySelector('.restart').hidden = false;
      }
      const t = e.target.closest('.tgl');
      if (t) {
        const key = t.dataset.key;
        settings.set(key, !settings.get(key));
        t.classList.toggle('on', settings.get(key));
        if (key === 'firstPerson' && this.game.player) this.game.player.firstPerson = settings.get(key);
      }
    });
    box.addEventListener('input', (e) => {
      const r = e.target.closest('input[type=range]');
      if (!r) return;
      const v = Number(r.value);
      settings.set(r.dataset.key, v);
      r.parentElement.querySelector('output').textContent = FMT[r.dataset.key](v);
    });
  }
}

const FMT = {};
function slider(key, label, min, max, step, fmt, note = '') {
  FMT[key] = fmt;
  const v = settings.get(key);
  return `<div class="row"><span>${label}${note ? `<small>${note}</small>` : ''}</span><div class="rng"><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${fmt(v)}</output></div></div>`;
}
function toggle(key, label, note = '') {
  return `<div class="row"><span>${label}${note ? `<small>${note}</small>` : ''}</span><button class="tgl ${settings.get(key) ? 'on' : ''}" data-key="${key}" aria-label="${label}"><i></i></button></div>`;
}
