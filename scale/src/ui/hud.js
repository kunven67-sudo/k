// On-screen HUD: the watch (your size), crosshair, interaction prompts, toasts, health when hurt.
import { bus } from '../core/events.js';
import { formatLength, sizeName } from '../core/util.js';
import { input } from '../core/input.js';
import { device } from '../core/quality.js';
import { MIN_SCALE, MAX_SCALE } from '../player/player.js';

export class Hud {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    root.innerHTML = `
      <div class="crosshair"></div>
      <div class="prompt"></div>
      <div class="toast"></div>
      <div class="health"><i></i></div>
      <div class="watch"><div class="label">RIFT watch</div><div class="size">1.75 m</div><div class="like">a person</div><div class="bar"><i></i></div></div>
      <div class="fps"></div>
      <div class="clicktoplay interactive"><span>Click to play</span></div>`;
    this.el = {
      watch: root.querySelector('.watch'),
      size: root.querySelector('.watch .size'),
      like: root.querySelector('.watch .like'),
      bar: root.querySelector('.watch .bar i'),
      prompt: root.querySelector('.prompt'),
      toast: root.querySelector('.toast'),
      fps: root.querySelector('.fps'),
      health: root.querySelector('.health'),
      healthBar: root.querySelector('.health i'),
      click: root.querySelector('.clicktoplay'),
    };
    this.el.click.addEventListener('click', () => input.requestLock());
    if (device.isTouch) this.el.click.style.display = 'none';
    this.toastT = 0;
    this.hurtT = 0;
    this.lastSize = '';
    bus.on('player:blocked', () => this.toast('Not enough room to grow (hold F to force it)'));
    bus.on('player:hurt', () => (this.hurtT = 4));
    bus.on('frame', (dt) => this.update(dt));
  }

  toast(text, secs = 2.2) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastT = secs;
  }

  prompt(key, text) {
    const p = this.el.prompt;
    if (!text) {
      p.classList.remove('show');
      return;
    }
    p.innerHTML = `<b>${key}</b>${text}`;
    p.classList.add('show');
  }

  update(dt) {
    const pl = this.game.player;
    if (!pl) return;
    const h = pl.height;
    const s = formatLength(h);
    if (s !== this.lastSize) {
      this.el.size.textContent = s;
      this.el.like.textContent = sizeName(h);
      const t = (Math.log(pl.scale) - Math.log(MIN_SCALE)) / (Math.log(MAX_SCALE) - Math.log(MIN_SCALE));
      this.el.bar.style.width = `${(t * 100).toFixed(1)}%`;
      this.lastSize = s;
    }
    this.el.watch.classList.toggle('changing', Math.abs(pl.sizeRate) > 0.01);
    this.el.watch.classList.toggle('blocked', pl.blockedT > 0);
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.el.toast.classList.remove('show');
    }
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.el.health.classList.toggle('show', this.hurtT > 0 || pl.health < 100);
    this.el.healthBar.style.width = `${pl.health}%`;
    this.el.click.style.display = input.locked || device.isTouch || this.game.paused || this.game.testMode ? 'none' : 'flex';
    if (this.game.frame % 15 === 0) this.el.fps.textContent = this.game.debug ? `${this.game.fps.toFixed(0)} fps · ${this.game.view.passes} pass` : '';
  }
}
