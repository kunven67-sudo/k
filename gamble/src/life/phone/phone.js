// The phone in your hand (DESIGN §7, §39, §52): a cracked budget Android drawn in the DOM,
// held up at the bottom of the view while the world keeps running (you can still shuffle along).
//
//   const phone = new Phone({ engine, player, state });
//   phone.toggle() / open() / close();  phone.update(dt);  phone.dispose();
//
// Lock screen (real game time + date) → swipe up / tap / Enter → home → apps (apps.js).
// The battery drains in game time; at 0 % the screen stays black.

import './style.js';
import { bus } from '../../core/events.js';
import { clock } from '../../core/clock.js';
import { save } from '../../core/save.js';
import { t, i18n, onLanguageChange } from '../../core/i18n.js';
import { el } from '../../core/util.js';
import { slice } from '../state.js';
import { sfx } from '../sounds.js';
import { crackSVG, wallpaper, APP_ICONS } from './art.js';
import { buildApp } from './apps.js';

const IDLE_DRAIN = 0.028; // per game hour, screen off (an old battery)
const SCREEN_DRAIN = 0.16; // extra per game hour while the screen is on
const GAME_HOUR_S = 120;

const HOME_APPS = ['clock', 'messages', 'wallet', 'maps', 'camera', 'settings'];
const DOCK_APPS = ['phoneApp', 'messages', 'browser', 'camera'];

export class Phone {
  constructor({ engine, player, state }) {
    this.engine = engine;
    this.player = player;
    this.state = state;
    this.data = slice('phone');
    this.isOpen = false;
    this.view = 'lock';
    this.app = null;
    this._build();
    this.offs = [
      onLanguageChange(() => this._render()),
      bus.on('phone:charge', ({ amount = 1 } = {}) => this.charge(amount)),
      bus.on('clock:minute', (p) => this._alarmCheck(p)),
    ];
  }

  get battery() {
    return this.data.battery;
  }

  get dead() {
    return this.data.battery <= 0;
  }

  charge(amount) {
    this.data.battery = Math.min(1, this.data.battery + amount);
    save.markDirty();
    this._status();
  }

  _locale() {
    return i18n.language === 'es' ? 'es-MX' : 'en-US';
  }

  // ---- DOM ------------------------------------------------------------------------------------

  _build() {
    this.screen = el('div', { class: 'ph-screen' });
    this.viewEl = el('div', { class: 'ph-view' });
    this.statusEl = el('div', { class: 'ph-status' });
    this.dimEl = el('div', { class: 'ph-dim' });
    this.screen.append(this.viewEl, this.statusEl, this.dimEl, el('div', { class: 'ph-notch' }), el('div', { class: 'ph-glass' }));
    this.screen.insertAdjacentHTML('beforeend', crackSVG(31));
    this.body = el('div', { class: 'ph-body' }, [this.screen, el('div', { class: 'ph-chin' }, ['vortex'])]);
    this.root = el('div', { class: 'ph-hold' }, [this.body]);
    this.root.style.pointerEvents = 'none';
    // Taps on the phone must never reach the 3D view (which would grab doors / look around).
    for (const ev of ['pointerdown', 'pointerup', 'click', 'wheel', 'touchstart']) {
      this.body.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'click' });
    }
    this.body.addEventListener('pointerdown', (e) => this._ripple(e));
    (this.engine.uiRoot || document.body).appendChild(this.root);
    this._fit();
    this._onResize = () => this._fit();
    window.addEventListener('resize', this._onResize);
    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey);
  }

  /** Scale so the phone fills most of the view height on any screen (phones especially). */
  _fit() {
    const h = innerHeight;
    const w = innerWidth;
    const s = Math.min((h * 0.9) / 628, (w * 0.92) / 300, 1.25);
    this.root.style.setProperty('--s', s.toFixed(3));
    // On wide screens hold it a little right of centre, like a right hand would.
    this.root.style.setProperty('--px', w > 900 ? `${Math.round(w * 0.12)}px` : '0px');
  }

  _ripple(e) {
    if (this.dead) return;
    const target = e.target.closest?.('.ph-btn,.ph-row,.ph-ico,.ph-nav b');
    if (!target) return;
    const r = target.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const scale = r.width / target.offsetWidth || 1;
    const rp = el('span', { class: 'ph-ripple' });
    rp.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX - r.left) / scale - size / 2}px;top:${(e.clientY - r.top) / scale - size / 2}px`;
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.appendChild(rp);
    setTimeout(() => rp.remove(), 480);
    sfx('phone.tap', { bus: 'ui', gain: 0.25 });
  }

  /** Budget-phone lag: every action lands a beat late. */
  lag(fn, extra = 0) {
    setTimeout(fn, 70 + Math.random() * 240 + extra);
  }

  toast(text) {
    const tEl = el('div', { class: 'ph-toast' }, [text]);
    this.screen.appendChild(tEl);
    setTimeout(() => tEl.remove(), 2100);
  }

  // ---- open / close -----------------------------------------------------------------------------

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.view = 'lock';
    this.app?.dispose?.();
    this.app = null;
    this._render();
    this.root.classList.add('up');
    this.root.style.pointerEvents = '';
    this.player?.human?.play?.('phone-up');
    sfx('cloth.rustle', { gain: 0.5 });
    // The cursor is needed to tap the screen.
    this._input()?.setPointerLock?.(false);
    // Waking the screen takes a moment on this phone.
    this.dimEl.style.opacity = '1';
    if (!this.dead) this.lag(() => (this.dimEl.style.opacity = '0'), 120);
    bus.emit('phone:open');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('up');
    this.root.style.pointerEvents = 'none';
    this.player?.human?.play?.('phone-down');
    if (!this.dead) sfx('phone.lock', { bus: 'ui', gain: 0.4 });
    this.app?.dispose?.();
    this.app = null;
    this._input()?.setPointerLock?.(true);
    bus.emit('phone:close');
  }

  _input() {
    return window.__gamble?.input || null;
  }

  _key(e) {
    if (!this.isOpen) return;
    if (document.querySelector('.gx-settings')) return; // the settings sheet has the keyboard
    if (this.view === 'lock' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowUp')) {
      e.preventDefault();
      this.unlock();
    } else if (e.code === 'Escape' || e.code === 'Backspace') {
      e.preventDefault();
      if (this.view === 'app') this.back();
      else this.close();
    }
  }

  // ---- navigation -------------------------------------------------------------------------------

  unlock() {
    if (this.dead || this.view !== 'lock') return;
    sfx('phone.unlock', { bus: 'ui', gain: 0.4 });
    const lock = this.viewEl.firstChild;
    if (lock) {
      lock.style.transition = 'transform .3s steps(6), opacity .3s steps(6)';
      lock.style.transform = 'translateY(-40%)';
      lock.style.opacity = '0';
    }
    this.lag(() => {
      this.view = 'home';
      this._render();
    }, 160);
  }

  openApp(name, fromEl) {
    if (this.dead) return;
    this.lag(() => {
      this.app?.dispose?.();
      this.app = buildApp(name, this);
      if (!this.app) return;
      this.view = 'app';
      this.appName = name;
      const r = fromEl?.getBoundingClientRect?.();
      const s = this.screen.getBoundingClientRect();
      if (r) {
        this.app.el.style.setProperty('--ox', `${((r.left + r.width / 2 - s.left) / s.width) * 100}%`);
        this.app.el.style.setProperty('--oy', `${((r.top + r.height / 2 - s.top) / s.height) * 100}%`);
      }
      this.viewEl.textContent = '';
      this.viewEl.appendChild(this.app.el);
      this._status();
    });
  }

  back() {
    if (this.app?.back?.()) return; // app handled it (sub-screen)
    this.home();
  }

  home() {
    if (this.view !== 'app') return;
    const a = this.app;
    a?.el.classList.add('closing');
    this.lag(() => {
      a?.dispose?.();
      if (this.app === a) this.app = null;
      this.view = 'home';
      this._render();
    });
  }

  /** The Android nav bar (back, home, recents) for app screens. */
  navBar() {
    const back = el('b', { 'aria-label': t('life.phone.back') });
    back.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2 3.5 7 10 12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    back.onclick = () => this.back();
    const home = el('b', { 'aria-label': t('life.phone.home') });
    home.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    home.onclick = () => this.home();
    const rec = el('b');
    rec.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    return el('div', { class: 'ph-nav' }, [back, home, rec]);
  }

  // ---- screens ------------------------------------------------------------------------------------

  _render() {
    if (!this.isOpen) return;
    this._status();
    if (this.dead) {
      this.viewEl.textContent = '';
      const b = el('div', { class: 'ph-deadbat show' });
      b.innerHTML = '<svg width="52" height="28" viewBox="0 0 52 28"><rect x="1.5" y="1.5" width="44" height="25" rx="4" fill="none" stroke="#e5413a" stroke-width="2.4"/><rect x="47" y="9" width="3.5" height="10" rx="1.2" fill="#e5413a"/><rect x="5" y="5" width="4" height="18" rx="1" fill="#e5413a"/></svg>';
      this.viewEl.appendChild(b);
      setTimeout(() => b.classList.remove('show'), 1400);
      this.statusEl.style.display = 'none';
      return;
    }
    this.statusEl.style.display = '';
    if (this.view === 'app' && this.app) return;
    this.viewEl.textContent = '';
    this.viewEl.appendChild(this.view === 'lock' ? this._lockScreen() : this._homeScreen());
  }

  _lockScreen() {
    const lock = el('div', { class: 'ph-lock' });
    lock.style.background = `url(${wallpaper()}) center/cover`;
    this.lockTime = el('div', { class: 'tm' });
    this.lockDate = el('div', { class: 'dt' });
    const pad = el('div', { class: 'lk' });
    pad.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
    const sw = el('div', { class: 'sw' });
    sw.innerHTML = '<svg width="18" height="10" viewBox="0 0 18 10"><path d="M2 8 9 2l7 6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    sw.append(t('life.phone.swipe'));
    lock.append(this.lockTime, this.lockDate, pad, sw);
    // Swipe up (or just tap) to unlock.
    let y0 = null;
    lock.addEventListener('pointerdown', (e) => {
      y0 = e.clientY;
      lock.setPointerCapture?.(e.pointerId);
    });
    lock.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      const dy = Math.min(0, e.clientY - y0);
      lock.style.transform = `translateY(${dy * 0.6}px)`;
      lock.style.opacity = String(1 + dy / 300);
    });
    lock.addEventListener('pointerup', (e) => {
      const dy = y0 == null ? 0 : e.clientY - y0;
      y0 = null;
      if (dy < -50 || Math.abs(dy) < 6) this.unlock();
      else (lock.style.transform = ''), (lock.style.opacity = '');
    });
    this._clockText();
    return lock;
  }

  _homeScreen() {
    const home = el('div', { class: 'ph-home' });
    home.style.background = `url(${wallpaper()}) center/cover`;
    this.homeTime = el('div', { class: 'big' });
    this.homeDate = el('div', { class: 'sm' });
    home.appendChild(el('div', { class: 'ph-widget' }, [this.homeTime, this.homeDate]));
    const grid = el('div', { class: 'ph-grid' });
    for (const name of HOME_APPS) grid.appendChild(this._icon(name));
    home.appendChild(grid);
    home.appendChild(el('div', { class: 'ph-dots' }, [el('i'), el('i')]));
    const dock = el('div', { class: 'ph-dock' });
    for (const name of DOCK_APPS) dock.appendChild(this._icon(name, true));
    home.appendChild(dock);
    this._clockText();
    return home;
  }

  _icon(name, dock = false) {
    const [bg, svg] = APP_ICONS[name];
    const sq = el('span', { class: 'sq' });
    sq.style.background = bg;
    sq.innerHTML = svg;
    const label = { phoneApp: '', browser: '' }[name] ?? t(`life.phone.${name}`);
    const b = el('button', { class: 'ph-ico' }, dock ? [sq] : [sq, label]);
    b.onclick = () => {
      // The dock's phone opens Messages' contact list; the browser has no data plan.
      if (name === 'phoneApp') return this.openApp('messages', b);
      if (name === 'browser') return this.lag(() => this.toast('ERR_INTERNET_DISCONNECTED'));
      this.openApp(name, b);
    };
    return b;
  }

  _clockText() {
    const loc = this._locale();
    const time = clock.format({ hour: 'numeric', minute: '2-digit' }, loc).replace(/\s?[AP]\.?\s?M\.?$/i, '').replace(/\s?[ap]\.\s?m\.$/i, '');
    const date = clock.format({ weekday: 'long', month: 'long', day: 'numeric' }, loc);
    if (this.lockTime) this.lockTime.textContent = time;
    if (this.lockDate) this.lockDate.textContent = date.charAt(0).toUpperCase() + date.slice(1);
    if (this.homeTime) this.homeTime.textContent = time;
    if (this.homeDate) this.homeDate.innerHTML = `${date.charAt(0).toUpperCase() + date.slice(1)}<br>Reno, NV`;
    return time;
  }

  _status() {
    const s = this.statusEl;
    const pct = Math.max(0, Math.round(this.data.battery * 100));
    const light = this.view === 'app' && !this.app?.dark;
    s.style.color = light ? '#1a1b1e' : '#fff';
    s.style.textShadow = light ? 'none' : '';
    const time = clock.format({ hour: 'numeric', minute: '2-digit' }, this._locale()).replace(/\s?[AP]\.?\s?M\.?$/i, '').replace(/\s?[ap]\.\s?m\.$/i, '');
    const sig = '<svg width="15" height="10" viewBox="0 0 15 10"><rect x="0" y="7" width="2.4" height="3" rx=".5" fill="currentColor"/><rect x="4" y="5" width="2.4" height="5" rx=".5" fill="currentColor"/><rect x="8" y="2.5" width="2.4" height="7.5" rx=".5" fill="currentColor" opacity=".35"/><rect x="12" y="0" width="2.4" height="10" rx=".5" fill="currentColor" opacity=".35"/></svg>';
    const lte = '<span style="font-size:8.5px;font-weight:700;letter-spacing:.02em">LTE</span>';
    const low = pct <= 20;
    s.innerHTML = `<span>${this.view === 'lock' ? t('life.phone.carrier') : time}</span><span class="sp"></span><span class="ic">${lte}${sig}<span class="ph-bat${low ? ' low' : ''}"><i style="width:${Math.max(1.5, pct * 0.165).toFixed(1)}px"></i></span><span class="ph-pct">${pct}%</span></span>`;
  }

  // ---- alarm (Clock app sets it; it rings even with the phone in your pocket) -------------------------

  _alarmCheck(p) {
    const a = this.data.alarm;
    if (!a?.on || this.dead) return;
    if (p.hour === a.hour && p.minute === a.minute) this.ring();
  }

  ring() {
    bus.emit('phone:alarm', {});
    let n = 0;
    const buzz = () => {
      if (n++ > 8 || this._ringStop) return;
      sfx('phone.vibrate', { gain: 0.9 });
      sfx('phone.notify', { gain: 0.6 });
      this._ringT = setTimeout(buzz, 1300);
    };
    this._ringStop = false;
    buzz();
    this.player?.human?.play?.('pat-pockets');
  }

  stopRing() {
    this._ringStop = true;
    clearTimeout(this._ringT);
  }

  // ---- per frame -----------------------------------------------------------------------------------

  update(dt) {
    const d = this.data;
    const was = d.battery;
    if (d.battery > 0) {
      const h = (dt / GAME_HOUR_S) * (clock.speed || 1);
      d.battery = Math.max(0, d.battery - h * (IDLE_DRAIN + (this.isOpen ? SCREEN_DRAIN : 0)));
      if (d.battery === 0) {
        bus.emit('phone:dead');
        this.app?.dispose?.();
        this.app = null;
        this._render();
      }
    }
    if (!this.isOpen) return;
    // Low battery warning once at 15 % and 5 %.
    if ((was > 0.15 && d.battery <= 0.15) || (was > 0.05 && d.battery <= 0.05)) {
      sfx('phone.notify', { bus: 'ui', gain: 0.4 });
      this.toast(t('life.phone.lowBattery'));
    }
    // Hand bob: walking jiggles the phone; a little breathing sway when still.
    const sp = this.player?.controller?.speed || 0;
    this._bobT = (this._bobT || 0) + dt * (1.2 + sp * 2.6);
    const bob = Math.sin(this._bobT * 2) * (1.5 + sp * 3.5);
    const rot = -2.5 + Math.sin(this._bobT) * (0.4 + sp * 0.5);
    this.root.style.setProperty('--bob', `${bob.toFixed(2)}px`);
    this.root.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
    this._tick = (this._tick || 0) - dt;
    if (this._tick <= 0) {
      this._tick = 1;
      this._status();
      this._clockText();
    }
    this.app?.update?.(dt);
  }

  dispose() {
    for (const off of this.offs) off();
    this.stopRing();
    this.app?.dispose?.();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    this.root.remove();
  }
}
