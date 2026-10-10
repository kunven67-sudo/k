// 'credits' state: an end-titles crawl over out-of-focus casino lights. Auto-scrolls; wheel,
// drag or arrow keys scrub it. Esc / Enter / the button return to the machine ('menu').

import { el, injectStyle } from '../core/util.js';
import { t, onLanguageChange } from '../core/i18n.js';
import '../ui/strings.js';
import { ensureStyles } from '../ui/styles.js';
import { Stage } from '../ui/three/stage.js';
import { createBokeh } from '../ui/three/bokeh.js';
import { button } from '../ui/kit.js';
import { uiSound } from '../ui/sfx.js';

// Mirrors THIRD_PARTY_LICENSES.md (the only outside code and fonts in the game).
const THIRD_PARTY = [
  ['three.js r180', 'MIT'],
  ['Rapier 3D 0.19', 'Apache-2.0'],
];
const FONTS = [
  ['Playfair Display', 'SIL OFL 1.1'],
  ['Rye', 'SIL OFL 1.1'],
  ['Inter', 'SIL OFL 1.1'],
  ['Bebas Neue', 'SIL OFL 1.1'],
  ['Special Elite', 'Apache-2.0'],
  ['Monoton', 'SIL OFL 1.1'],
];
const ROLES = ['design', 'direction', 'code', 'art', 'anim', 'audio', 'writing', 'qa'];

const CSS = /* css */ `
.cr { position: absolute; inset: 0; overflow: hidden; color: #efe2c4; font-size: calc(16px * var(--text-scale)); cursor: grab; touch-action: none;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 18%, #000 70%, transparent 88%); mask-image: linear-gradient(180deg, transparent 0, #000 18%, #000 70%, transparent 88%); }
.cr-roll { position: absolute; left: 0; right: 0; top: 0; text-align: center; padding: 0 20px; will-change: transform; }
.cr-k { font: 400 .85em/1 var(--font-display); letter-spacing: .5em; color: #d7b56a; }
.cr-logo { margin: 18px 0 6px; font: 400 clamp(3em, 11vw, 6em)/1 var(--font-neon); color: #ffd6e0; text-shadow: 0 0 8px #ff2a60, 0 0 30px #ff2a6088; }
.cr-sub { font: italic 400 1.1em/1.4 var(--font-casino); color: #cdbb94; }
.cr-sec { margin: 70px auto 0; max-width: 560px; }
.cr-h { font: 400 .8em/1 var(--font-display); letter-spacing: .42em; color: #b99c63; margin-bottom: 18px; }
.cr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 7px 0; align-items: baseline; }
.cr-row .r { text-align: right; font: 500 .82em/1.3 var(--font-ui); letter-spacing: .08em; text-transform: uppercase; color: #a99878; }
.cr-row .n { text-align: left; font: 700 1.15em/1.3 var(--font-casino); color: #f4e6c4; }
.cr-p { font: italic 400 1.25em/1.5 var(--font-casino); color: #efe2c4; max-width: 30em; margin: 0 auto; text-wrap: balance; }
.cr-small { margin-top: 12px; font: 400 .85em/1.5 var(--font-ui); color: #a99878; }
.cr-end { margin: 90px 0 0; font: 700 2em/1.2 var(--font-casino); }
.cr-suits { margin-top: 14px; color: #b99c63; letter-spacing: .6em; }
.cr-back { position: absolute; left: 50%; bottom: calc(18px + var(--safe-bottom)); translate: -50% 0; z-index: 2; }
@media (max-width: 560px) { .cr-row { grid-template-columns: 1fr; gap: 2px; } .cr-row .r, .cr-row .n { text-align: center; } }
`;

export class CreditsState {
  constructor(engine) {
    this.engine = engine;
    this.y = 0;
    this.speed = 38; // px per second
    this._off = [];
  }

  async enter() {
    ensureStyles();
    injectStyle('gx-credits', CSS);
    const stage = (this.stage = new Stage(this.engine, { fov: 50, background: 0x050304 }));
    this.bokeh = createBokeh({ count: Math.round(40 * stage.tier.particlesScale) + 16, y: 0, spreadY: 18, spreadX: 46, z: [-16, -36], size: [0.8, 2.2], opacity: 0.16 });
    stage.scene.add(this.bokeh);
    stage.camera.position.set(0, 0, 6);
    this._render();
    this._off.push(onLanguageChange(() => this._render()));
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Backspace') this._back();
      else if (e.code === 'ArrowDown') this.y += 120;
      else if (e.code === 'ArrowUp') this.y -= 120;
    };
    window.addEventListener('keydown', onKey);
    this._off.push(() => window.removeEventListener('keydown', onKey));
  }

  _render() {
    const root = this.engine.uiRoot;
    root.querySelector('.cr')?.remove();
    root.querySelector('.cr-back')?.remove();
    const sec = (title, kids) => el('div', { class: 'cr-sec' }, [el('div', { class: 'cr-h', text: title.toUpperCase() }), ...kids]);
    const row = (r, n) => el('div', { class: 'cr-row' }, [el('div', { class: 'r', text: r }), el('div', { class: 'n', text: n })]);
    this.roll = el('div', { class: 'cr-roll' }, [
      el('div', { class: 'cr-k', text: t('ui.cred.kicker').toUpperCase() }),
      el('div', { class: 'cr-logo', text: 'Gamble' }),
      el('div', { class: 'cr-sub', text: 'Reno, Nevada' }),
      sec(t('ui.cred.studio'), ROLES.map((r) => row(t(`ui.cred.${r}`), t('ui.cred.studio')))),
      sec(t('ui.cred.made'), [el('p', { class: 'cr-p', text: t('ui.cred.original') }), el('div', { class: 'cr-small', text: t('ui.cred.virtual') })]),
      sec(t('ui.cred.thirdParty'), THIRD_PARTY.map(([a, b]) => row(b, a))),
      sec(t('ui.cred.fonts'), FONTS.map(([a, b]) => row(b, a))),
      el('div', { class: 'cr-small', text: 'THIRD_PARTY_LICENSES.md' }),
      el('div', { class: 'cr-end', text: t('ui.cred.thanks') }),
      el('div', { class: 'cr-suits', text: '♠ ♥ ♦ ♣' }),
      el('div', { style: { height: '60vh' } }),
    ]);
    const wrap = el('div', { class: 'cr' }, [this.roll]);
    // Wheel / drag scrubbing.
    wrap.addEventListener('wheel', (e) => (this.y += e.deltaY * 0.8), { passive: true });
    wrap.addEventListener('pointerdown', (e) => {
      this.drag = { y0: e.clientY, s0: this.y };
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', (e) => this.drag && (this.y = this.drag.s0 - (e.clientY - this.drag.y0)));
    wrap.addEventListener('pointerup', () => (this.drag = null));
    root.appendChild(wrap);
    const back = button(t('ui.cred.back'), () => this._back(), { ghost: true, sound: null });
    back.classList.add('cr-back');
    root.appendChild(back);
    if (!this.y) this.y = -this.engine.height * 0.62; // start below the fold
  }

  _back() {
    if (this._leaving) return;
    this._leaving = true;
    uiSound('ui.back');
    this.engine.go('menu');
  }

  update(dt) {
    this.stage.update(dt);
    this.bokeh.update(this.stage.time, this.engine.height);
    this.stage.camera.position.x = Math.sin(this.stage.time * 0.1) * 0.6;
    this.stage.camera.lookAt(0, 0, -20);
    if (!this.drag) this.y += this.speed * dt;
    const max = this.roll.scrollHeight - this.engine.height * 0.5;
    if (this.y > max) this.y = max;
    this.y = Math.max(-this.engine.height, this.y);
    this.roll.style.transform = `translateY(${-this.y}px)`;
  }

  exit() {
    for (const off of this._off) off();
    this.bokeh.material.dispose();
    this.stage.dispose();
  }
}
