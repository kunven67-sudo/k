// 'menu' state: a giant slot machine in a dim casino IS the main menu. The center reel shows
// the highlighted option; the five push buttons on the deck are PLAY / MULTIPLAYER / SETTINGS /
// CREDITS / QUIT (mouse, touch, or arrows + Enter). Drag the side lever (or press Space) to spin
// for fun — sometimes it pays a fake jackpot: lights, bells, coins.

import * as THREE from 'three';
import { el } from '../core/util.js';
import { t, onLanguageChange } from '../core/i18n.js';
import { settings } from '../core/settings.js';
import { save } from '../core/save.js';
import '../ui/strings.js';
import { ensureStyles } from '../ui/styles.js';
import { Stage, loadFonts, fitDistance } from '../ui/three/stage.js';
import { SYMBOL_NAMES } from '../ui/three/symbols.js';
import { buildRoom } from '../ui/menu/room.js';
import { buildMachine, DIM } from '../ui/menu/machine.js';
import { buildDeck } from '../ui/menu/deck.js';
import { createCoinShower } from '../ui/menu/coins.js';
import { showCard, isTouch } from '../ui/kit.js';
import { openSettings } from '../ui/settings.js';
import { uiSound, vary, getMusic } from '../ui/sfx.js';

const OPTIONS = [
  { id: 'play', color: '#1f7a3a', label: () => t(save.hasLife() ? 'ui.menu.continue' : 'ui.menu.play') },
  { id: 'multiplayer', color: '#1f4fa3', label: () => t('ui.menu.multiplayer') },
  { id: 'settings', color: '#c26a12', label: () => t('ui.menu.settings') },
  { id: 'credits', color: '#6d2a8f', label: () => t('ui.menu.credits') },
  { id: 'quit', color: '#a3141f', label: () => t('ui.menu.quit') },
];

export class MenuState {
  constructor(engine) {
    this.engine = engine;
    this.sel = 0;
    this.modal = false;
    this.spinning = false;
    this.pointer = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this._off = [];
  }

  async enter() {
    ensureStyles();
    await loadFonts();
    const engine = this.engine;
    const stage = (this.stage = new Stage(engine, { fov: 34, background: 0x070407, envIntensity: 0.3 }));
    const { scene, camera, tier } = stage;
    this.room = buildRoom(scene, { tier });
    this.machine = buildMachine(scene, { tier, options: OPTIONS });
    this.deck = buildDeck(this.machine.group, { tier, options: OPTIONS });
    this.deck.setLabels(settings.get('language') + (save.hasLife() ? 'c' : 'p'));
    this.coins = createCoinShower(scene, { count: Math.round(36 * Math.max(0.6, tier.particlesScale)), origin: new THREE.Vector3(0, 1.2, DIM.faceZ + 0.06), trayY: 1.03 });
    this.machine.setMeter(t('ui.menu.freeplay').toUpperCase(), `${t('ui.menu.credit').toUpperCase()} 0`);

    // Light: warm key from above the player's head, colored rims from the casino behind.
    scene.add(new THREE.HemisphereLight(0x5a4458, 0x120808, 0.3));
    const key = new THREE.SpotLight(0xffe0b8, 120, 30, 0.5, 0.6, 2);
    key.position.set(1.8, 7.5, 6);
    key.target.position.set(0, 2.1, 0);
    key.castShadow = tier.shadows;
    key.shadow.mapSize.setScalar(Math.min(2048, tier.shadowMapSize));
    key.shadow.bias = -0.0004;
    scene.add(key, key.target);
    const rimL = new THREE.PointLight(0xff3d8b, 26, 9, 1.6);
    rimL.position.set(-2.6, 3.4, -1.2);
    const rimR = new THREE.PointLight(0x3dc6ff, 20, 9, 1.6);
    rimR.position.set(2.8, 2.6, -1.4);
    scene.add(rimL, rimR);

    this.pickables = [];
    for (const b of this.deck.buttons) this.pickables.push(b.cap, b.label);
    this.pickables.push(this.deck.lever.knob, this.deck.lever.rod);
    this._select(0, false);

    this._buildHint();
    this._bindInput();
    this._off.push(
      onLanguageChange((lang) => {
        this.machine.rebuildLabels();
        this.machine.center.setIndex(this.sel);
        this.deck.setLabels(lang + (save.hasLife() ? 'c' : 'p'));
        this.machine.setMeter(t('ui.menu.freeplay').toUpperCase(), `${t('ui.menu.credit').toUpperCase()} 0`);
        this._buildHint();
      }),
    );
    getMusic().then((m) => m?.play?.('menu-lounge', { fade: 2.5 }));
    this._camSway = new THREE.Vector2();
  }

  _buildHint() {
    this.hint?.remove();
    this.hint = el('div', { class: 'passthrough', text: (isTouch() ? t('ui.menu.hintTouch') : t('ui.menu.hint')).toUpperCase() });
    Object.assign(this.hint.style, {
      position: 'absolute', left: 0, right: 0, bottom: 'calc(14px + var(--safe-bottom))', textAlign: 'center',
      font: '400 13px/1 var(--font-display)', letterSpacing: '.32em', color: 'rgba(242,214,140,.55)', textShadow: '0 1px 2px #000',
    });
    this.engine.uiRoot.appendChild(this.hint);
  }

  // ---------------------------------------------------------------- input

  _bindInput() {
    const canvas = this.engine.canvas;
    const on = (target, ev, fn, opts) => {
      target.addEventListener(ev, fn, opts);
      this._off.push(() => target.removeEventListener(ev, fn, opts));
    };
    const toNdc = (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    on(window, 'pointermove', (e) => {
      toNdc(e);
      if (this.drag) {
        const dy = (e.clientY - this.drag.y0) / Math.max(300, this.engine.height * 0.45);
        this.deck.lever.hold(this.drag.a0 + dy * 1.6);
        if (!this.drag.clicked && this.deck.lever.angle > 0.8) {
          this.drag.clicked = true;
          uiSound('slot.lever', { rate: vary(), bus: 'sfx', gain: 0.6 });
        }
        return;
      }
      if (this.modal || e.target !== canvas) return;
      const hit = this._pick();
      canvas.style.cursor = hit ? (hit.object.userData.lever ? 'grab' : 'pointer') : '';
      if (hit?.object.userData.button) {
        const i = OPTIONS.findIndex((o) => o.id === hit.object.userData.button);
        if (i !== this.sel) this._select(i);
      }
      this._hoverId = hit?.object.userData.button || null;
    });
    on(window, 'pointerdown', (e) => {
      if (this.modal || e.target !== canvas) return;
      toNdc(e);
      const hit = this._pick();
      if (!hit) return;
      if (hit.object.userData.lever) {
        this.drag = { y0: e.clientY, a0: this.deck.lever.angle, clicked: false };
        canvas.style.cursor = 'grabbing';
        canvas.setPointerCapture?.(e.pointerId);
      } else if (hit.object.userData.button) {
        const i = OPTIONS.findIndex((o) => o.id === hit.object.userData.button);
        this._select(i);
        this._activate();
      }
    });
    on(window, 'pointerup', () => {
      if (!this.drag) return;
      const pulled = this.deck.lever.angle > 1.0;
      this.drag = null;
      this.deck.lever.release();
      this.engine.canvas.style.cursor = '';
      if (pulled) this._spin();
    });
    on(window, 'keydown', (e) => {
      if (this.modal || e.repeat) return;
      if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(e.code)) this._select((this.sel + 1) % OPTIONS.length);
      else if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(e.code)) this._select((this.sel + OPTIONS.length - 1) % OPTIONS.length);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this._activate();
      else if (e.code === 'Space') this._autoPull();
      else return;
      e.preventDefault();
    });
  }

  _pick() {
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    return this.raycaster.intersectObjects(this.pickables, false)[0] || null;
  }

  _select(i, sound = true) {
    this.sel = i;
    this.deck.buttons.forEach((b, k) => (b.selected = k === i));
    // Roll the center reel to the option (either of its two copies, whichever is closer).
    if (!this.spinning) this.machine.center.rollTo([i, i + OPTIONS.length], sound ? 0.42 : 0.01);
    if (sound) uiSound('ui.hover', { rate: vary(0.08) });
  }

  async _activate() {
    const id = OPTIONS[this.sel].id;
    this.deck.push(id);
    uiSound('slot.button', { rate: vary(), bus: 'sfx' });
    uiSound('ui.click', { rate: vary() });
    await new Promise((r) => setTimeout(r, 170));
    const engine = this.engine;
    if (id === 'play') {
      const hasLife = save.hasLife();
      const target = hasLife ? 'world' : 'creator';
      if (!engine.states.has(target)) return this._card({ title: t('ui.menu.notReadyTitle'), body: t('ui.menu.notReadyBody'), suit: '♠' });
      this._leaving = target;
      engine.go(target, hasLife ? { continue: true } : {});
    } else if (id === 'multiplayer') {
      this._card({ title: t('ui.menu.mpTitle'), body: t('ui.menu.mpBody'), foot: t('ui.menu.mpFoot'), suit: '♥' });
    } else if (id === 'settings') {
      this.modal = true;
      openSettings(engine, { onClose: () => setTimeout(() => (this.modal = false), 50) });
    } else if (id === 'credits') {
      this._leaving = 'credits';
      engine.go('credits');
    } else if (id === 'quit') {
      const yes = await this._card({
        title: t('ui.menu.quitTitle'),
        body: t('ui.menu.quitBody'),
        suit: '♣',
        actions: [
          { label: t('ui.menu.quitNo'), value: false, ghost: true },
          { label: t('ui.menu.quitYes'), value: true },
        ],
      });
      if (yes) {
        uiSound('coins.pour', { bus: 'sfx', gain: 0.5 });
        this.coins.burst(14);
        await this._card({ title: t('ui.menu.thanksTitle'), body: t('ui.menu.thanksBody'), suit: '♦', actions: [{ label: t('ui.menu.thanksBack'), value: true }] });
      }
    }
  }

  async _card(opts) {
    this.modal = true;
    const v = await showCard(this.engine.uiRoot, { actions: [{ label: t('ui.menu.ok'), value: true }], ...opts });
    setTimeout(() => (this.modal = false), 50);
    return v;
  }

  /** Space / Enter-on-lever: animate a full pull without dragging. */
  async _autoPull() {
    if (this.spinning || this.drag) return;
    const lever = this.deck.lever;
    uiSound('slot.lever', { rate: vary(), bus: 'sfx', gain: 0.6 });
    for (let k = 0; k <= 8; k++) {
      lever.hold(lever.REST + ((lever.MAX - lever.REST) * k) / 8);
      await new Promise((r) => setTimeout(r, 18));
    }
    lever.release();
    this._spin();
  }

  async _spin() {
    if (this.spinning) return;
    this.spinning = true;
    const m = this.machine;
    const jackpot = Math.random() < 0.14;
    const sevenAt = (k) => [...Array(12).keys()].filter((i) => SYMBOL_NAMES[(i * 5 + k * 3) % SYMBOL_NAMES.length] === 'seven');
    const pick = (k) => (jackpot ? sevenAt(k)[0] : Math.floor(Math.random() * 12));
    m.winBulbs.setPattern('chase', 16);
    m.marqBulbs.setPattern('chase', 16);
    const loop = uiSound('slot.reel-spin', { loop: true, bus: 'sfx', gain: 0.45 });
    const stop = () => uiSound('slot.reel-stop', { rate: vary(0.06), bus: 'sfx' });
    await Promise.all([
      m.left.spinTo(pick(0), 1.4, { turns: 3, onStop: stop }),
      m.center.spinTo(this.sel, 1.8, { turns: 3, onStop: stop }),
      m.right.spinTo(pick(1), 2.25, { turns: 4, onStop: stop }),
    ]);
    loop?.stop?.(0.08);
    if (jackpot) {
      m.setMeter(t('ui.menu.jackpot').toUpperCase(), `${t('ui.menu.credit').toUpperCase()} 777`);
      m.winBulbs.setPattern('alternate', 9);
      m.marqBulbs.setPattern('sparkle', 14);
      uiSound('slot.ding', { bus: 'sfx' });
      uiSound('slot.win-big', { bus: 'sfx' });
      const siren = uiSound('slot.jackpot-siren', { loop: true, bus: 'sfx', gain: 0.35 });
      uiSound('slot.coin-hopper', { bus: 'sfx', gain: 0.5 });
      this.coins.burst();
      await new Promise((r) => setTimeout(r, 2600));
      siren?.stop?.(0.4);
      m.setMeter(t('ui.menu.freeplay').toUpperCase(), `${t('ui.menu.credit').toUpperCase()} 0`);
    } else {
      uiSound('slot.win-small', { bus: 'sfx', gain: 0.25, rate: 0.9 });
    }
    m.winBulbs.setPattern('chase', 10);
    m.marqBulbs.setPattern('chase', 10);
    this.spinning = false;
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    const stage = this.stage;
    if (!stage) return;
    stage.update(dt);
    const time = stage.time;
    this.room.update(time, this.engine.height);
    this.machine.update(dt, time);
    this.deck.update(dt, time);
    this.coins.update(dt);
    this.deck.buttons.forEach((b) => (b.hover = b.id === this._hoverId));

    // Camera: frame the whole machine (+ lever) at any aspect; gentle parallax with the pointer.
    const cam = stage.camera;
    const dist = fitDistance(cam, 1.95, 2.45) * 1.02;
    this._camSway.lerp(this.pointer, Math.min(1, dt * 2));
    const portrait = cam.aspect < 1;
    cam.position.set(0.15 + this._camSway.x * 0.35, 2.05 + this._camSway.y * 0.2 + (portrait ? 0.2 : 0), dist);
    cam.lookAt(0.08, 2.3, 0);
  }

  exit() {
    for (const off of this._off) off();
    this._off.length = 0;
    this.engine.canvas.style.cursor = '';
    if (this._leaving !== 'credits') getMusic().then((m) => m?.stop?.({ fade: 1.2 }));
    this.coins?.dispose();
    this.deck?.dispose();
    this.machine?.dispose();
    this.room?.dispose();
    this.stage?.dispose();
  }
}
