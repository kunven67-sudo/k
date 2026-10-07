// 'boot' state: content warning → Loaded Dice Studios splash → one random GAMBLE logo → 'menu'.
// Splash and logo are skippable with any key / click / tap. `?logo=neon|gold|cards|reels`
// forces a logo; `?skipboot=1` jumps straight to the menu (dev).

import { el } from '../core/util.js';
import { t } from '../core/i18n.js';
import { ensureStyles } from '../ui/styles.js';
import '../ui/strings.js';
import { showWarning } from '../ui/boot/warning.js';
import { runSplash } from '../ui/boot/splash.js';

export const LOGOS = ['neon', 'gold', 'cards', 'reels'];
const LOGO_MODULES = {
  neon: () => import('../ui/boot/logos/neon.js'),
  gold: () => import('../ui/boot/logos/gold.js'),
  cards: () => import('../ui/boot/logos/cards.js'),
  reels: () => import('../ui/boot/logos/reels.js'),
};

/** Offline support (PWA). Skipped on localhost unless ?sw=1 so dev reloads are never stale. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;
  navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url)).catch((err) => console.warn('[boot] service worker not registered', err.message));
}

export class BootState {
  constructor(engine) {
    this.engine = engine;
    this.host = { stage: null }; // the active 3D stage (splash, then logo)
    this.skip = { requested: false };
    this._alive = true;
  }

  async enter(params = {}) {
    ensureStyles();
    registerServiceWorker();
    const q = new URLSearchParams(location.search);
    const forced = params.logo || q.get('logo');
    this.logo = LOGOS.includes(forced) ? forced : LOGOS[Math.floor(Math.random() * LOGOS.length)];
    if (params.skipboot || q.get('skipboot')) {
      // engine.go() is ignored while this state's own transition is still running; wait it out.
      const tryGo = () => (this.engine._transitioning ? setTimeout(tryGo, 50) : this.engine.go('menu', {}, { fade: false }));
      setTimeout(tryGo, 0);
      return;
    }
    // Run the sequence in the background so enter() returns and the engine fades in.
    this._run();
  }

  _armSkip() {
    this.skip.requested = false;
    const root = this.engine.uiRoot;
    const hint = el('div', { class: 'boot-skip', text: t('ui.skip.hint').toUpperCase() });
    Object.assign(hint.style, {
      position: 'absolute', right: 'calc(18px + var(--safe-right))', bottom: 'calc(16px + var(--safe-bottom))',
      font: '400 12px/1 var(--font-display)', letterSpacing: '.3em', color: 'rgba(240,225,190,.45)', pointerEvents: 'none', zIndex: 5,
    });
    root.appendChild(hint);
    const onSkip = () => {
      this.skip.requested = true;
    };
    // Defer arming slightly so the keypress that dismissed the warning doesn't also skip.
    const arm = setTimeout(() => {
      window.addEventListener('keydown', onSkip);
      window.addEventListener('pointerdown', onSkip);
    }, 350);
    return () => {
      clearTimeout(arm);
      window.removeEventListener('keydown', onSkip);
      window.removeEventListener('pointerdown', onSkip);
      hint.remove();
    };
  }

  async _run() {
    const engine = this.engine;
    const root = engine.uiRoot;
    try {
      await showWarning(root);
      if (!this._alive) return;
      engine.fade(false, 10);

      let disarm = this._armSkip();
      await runSplash(engine, root, this.skip, this.host);
      disarm();
      if (!this._alive) return;

      disarm = this._armSkip();
      const mod = await LOGO_MODULES[this.logo]();
      if (!this._alive) return;
      engine.fade(false, 500);
      await mod.runLogo(engine, root, this.skip, this.host);
      disarm();
    } catch (err) {
      console.error('[boot] sequence failed, going to menu', err);
    }
    if (this._alive) engine.go('menu', {}, { fadeMs: 500 });
  }

  update(dt) {
    this.host.stage?.update(dt);
  }

  exit() {
    this._alive = false;
    this.skip.requested = true;
    this.host.stage?.dispose();
    this.host.stage = null;
  }

  onResize() {}
}
