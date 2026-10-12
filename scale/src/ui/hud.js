// On-screen HUD: the watch (your size), crosshair, hand bar, interaction prompts, toasts, health.
import { bus } from '../core/events.js';
import { formatLength, sizeName } from '../core/util.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { MIN_SCALE, MAX_SCALE } from '../player/player.js';

const SLOT_ICON = {
  hands: '<svg viewBox="0 0 24 24"><path d="M8.5 11V5.8a1.6 1.6 0 0 1 3.2 0V10m0-.8V4.6a1.6 1.6 0 0 1 3.2 0V10m0-3.6a1.6 1.6 0 0 1 3.2 0v6.8c0 4-2.6 6.8-6.3 6.8-2.8 0-4.4-1.4-5.7-3.5l-2.4-4a1.5 1.5 0 0 1 2.4-1.8L8.5 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ray: '<svg viewBox="0 0 24 24"><path d="M3 9.5h11.5l2-2h3v6h-3l-2-2H11l-1.2 6.5H6.6L7.8 11.5H3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="21" cy="10.5" r="1.3" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

export class Hud {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="crosshair"></div>
      <div class="prompt"></div>
      <div class="toast"></div>
      <div class="health"><i></i></div>
      <div class="watch"><div class="label">RIFT watch</div><div class="size">1.75 m</div><div class="like">a person</div><div class="bar"><i></i></div></div>
      <div class="hotbar interactive">
        <button data-slot="slot1"><kbd>1</kbd>${SLOT_ICON.hands}<span>Hands</span></button>
        <button data-slot="slot2"><kbd>2</kbd>${SLOT_ICON.ray}<span>Ray</span></button>
        <button data-slot="slot3"><kbd>Tab</kbd>${SLOT_ICON.phone}<span>Phone</span></button>
      </div>
      <div class="fps"></div>
      <div class="struggle"><b>Caught!</b><span class="how">Spam <kbd>Space</kbd> to struggle</span><div class="sbar"><i></i></div></div>
      <div class="death"><div class="dt">You died</div><div class="dc"></div><div class="dn"></div></div>`;
    root.appendChild(hud);
    const q = (s) => hud.querySelector(s);
    this.el = {
      hud,
      watch: q('.watch'),
      size: q('.watch .size'),
      like: q('.watch .like'),
      bar: q('.watch .bar i'),
      prompt: q('.prompt'),
      toast: q('.toast'),
      fps: q('.fps'),
      health: q('.health'),
      healthBar: q('.health i'),
      slots: [...hud.querySelectorAll('.hotbar button')],
      struggle: q('.struggle'),
      sbar: q('.struggle .sbar i'),
      how: q('.struggle .how'),
      death: q('.death'),
      dc: q('.death .dc'),
      dn: q('.death .dn'),
    };
    // The hand bar works by tapping too (phones). It sends the same action as the number keys.
    for (const b of this.el.slots) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        input.touch.down.add(b.dataset.slot);
      });
    }
    this.toastT = 0;
    this.hurtT = 0;
    this.lastSize = '';
    bus.on('player:blocked', () => this.toast('Not enough room to grow (hold F to squeeze)'));
    bus.on('player:resized', () => this.toast('Back to normal size'));
    bus.on('toast', (t) => (typeof t === 'string' ? this.toast(t) : this.toast(t.text, t.secs)));
    bus.on('player:hurt', () => (this.hurtT = 4));
    bus.on('player:died', ({ cause, permadeath }) => {
      this.el.dc.textContent = cause || '';
      this.el.dn.textContent = permadeath ? 'Permadeath is on. This world has ended.' : 'Waking up back home...';
      this.el.death.classList.add('show');
    });
    bus.on('player:respawn', () => this.el.death.classList.remove('show'));
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
      this._lastPrompt = '';
      return;
    }
    const html = key ? `<b>${key}</b>${text}` : text;
    if (html !== this._lastPrompt) p.innerHTML = html;
    this._lastPrompt = html;
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
    const pt = pl.hands?.promptText();
    if (pt) this.prompt(pt[0], pt[1]);
    else this.prompt(null, null);
    // Hand bar: which tool is out.
    const hs = pl.hands?.slots;
    if (hs) {
      const r = hs.right, l = hs.left;
      const ray = r && r.kind === 'tool' && r.ref.id === 'ray';
      const phone = l && l.kind === 'tool' && l.ref.id === 'phone';
      this.el.slots[0].classList.toggle('on', !ray);
      this.el.slots[1].classList.toggle('on', !!ray);
      this.el.slots[2].classList.toggle('on', !!phone);
      this.root.classList.toggle('phone-open', !!phone);
    }
    // Caught by something: show how close you are to getting free.
    const held = !!pl.heldBy && !pl.dead;
    this.el.struggle.classList.toggle('show', held);
    if (held) {
      this.el.sbar.style.width = `${Math.round(Math.min(1, pl.struggle) * 100)}%`;
      const touch = this.root.classList.contains('touch');
      const how = touch ? 'Tap jump fast to struggle' : 'Spam <kbd>Space</kbd> to struggle';
      if (this._how !== how) this.el.how.innerHTML = this._how = how;
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.el.toast.classList.remove('show');
    }
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.el.health.classList.toggle('show', this.hurtT > 0 || pl.health < 100);
    this.el.healthBar.style.width = `${pl.health}%`;
    if (this.game.frame % 15 === 0) {
      const show = this.game.debug || settings.get('showFps');
      this.el.fps.textContent = show ? `${this.game.fps.toFixed(0)} fps${this.game.debug ? ` · ${this.game.view.passes} pass · ${this.game.view.renderer.info.render.calls} draws` : ''}` : '';
    }
  }
}
