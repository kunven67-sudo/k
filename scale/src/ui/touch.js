// Touch controls for phones and tablets. They drive the same actions as the keyboard, so every
// game system works the same with either.
//
//   left side:  a thumbstick appears wherever your thumb lands (push it all the way to run)
//               plus the watch buttons (hold minus to shrink, hold plus to grow)
//   right side: drag to look around; jump, use, crouch, and (when they make sense) throw, drop
//               and the ray's shrink/grow beams
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { bus } from '../core/events.js';

const SVG = {
  jump: '<svg viewBox="0 0 24 24"><path d="M12 4 5 11h4.5v8h5v-8H19z" fill="currentColor"/></svg>',
  use: '<svg viewBox="0 0 24 24"><path d="M8.5 11V5.8a1.6 1.6 0 0 1 3.2 0V10m0-.8V4.6a1.6 1.6 0 0 1 3.2 0V10m0-3.6a1.6 1.6 0 0 1 3.2 0v6.8c0 4-2.6 6.8-6.3 6.8-2.8 0-4.4-1.4-5.7-3.5l-2.4-4a1.5 1.5 0 0 1 2.4-1.8L8.5 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  crouch: '<svg viewBox="0 0 24 24"><path d="M6 13h12M9 17h6M12 4v6m-3-3 3 3 3-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  throw: '<svg viewBox="0 0 24 24"><path d="M5 19 19 5m0 0h-7m7 0v7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  view: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  beam: '<svg viewBox="0 0 24 24"><path d="M3 12h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="17" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
};

// Keep getting this finger's moves even when it slides off the button (some browsers refuse; fine).
function capture(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* not capturable: events still arrive while the finger stays on the element */
  }
}

export class TouchControls {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'tc';
    this.el.innerHTML = `
      <div class="tc-zone tc-left"></div>
      <div class="tc-zone tc-right"></div>
      <div class="tc-stick"><i></i></div>
      <button class="tc-b tc-watch tc-grow" data-hold="grow" aria-label="Grow">${SVG.plus}<span>grow</span></button>
      <button class="tc-b tc-watch tc-shrink" data-hold="shrink" aria-label="Shrink">${SVG.minus}<span>shrink</span></button>
      <button class="tc-b tc-jump" data-press="jump" aria-label="Jump">${SVG.jump}</button>
      <button class="tc-b tc-use" data-press="interact" aria-label="Use">${SVG.use}</button>
      <button class="tc-b tc-crouch" data-hold="crouch" aria-label="Crouch">${SVG.crouch}</button>
      <button class="tc-b tc-throw" data-hold="throw" aria-label="Throw">${SVG.throw}</button>
      <button class="tc-b tc-drop" data-press="drop" aria-label="Drop">${SVG.drop}</button>
      <button class="tc-b tc-fire" data-hold="fire" aria-label="Shrink beam">${SVG.beam}<span>shrink</span></button>
      <button class="tc-b tc-alt" data-hold="alt" aria-label="Grow beam">${SVG.beam}<span>grow</span></button>
      <button class="tc-b tc-top tc-view" data-press="view" aria-label="Camera">${SVG.view}</button>
      <button class="tc-b tc-top tc-pause" data-act="pause" aria-label="Pause">${SVG.pause}</button>`;
    root.appendChild(this.el);
    this.stick = this.el.querySelector('.tc-stick');
    this.knob = this.stick.querySelector('i');
    this.stickId = null;
    this.lookId = null;

    for (const b of this.el.querySelectorAll('.tc-b')) this._button(b);
    this._stickZone(this.el.querySelector('.tc-left'));
    this._lookZone(this.el.querySelector('.tc-right'));
    bus.on('frame', () => this.update());
  }

  _button(b) {
    const hold = b.dataset.hold, press = b.dataset.press, act = b.dataset.act;
    let id = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (id !== null) return;
      id = e.pointerId;
      capture(b, e.pointerId);
      b.classList.add('on');
      if (hold) {
        input.touch.held.add(hold);
        input.touch.down.add(hold);
      }
      if (press) input.touch.down.add(press);
      if (act === 'pause') this.game.ui?.menu?.set('pause');
    });
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      b.classList.remove('on');
      if (hold && input.touch.held.delete(hold)) input.touch.up.add(hold);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  }

  _stickZone(z) {
    const R = 56;
    let ox = 0, oy = 0;
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      capture(z, e.pointerId);
      ox = e.clientX;
      oy = e.clientY;
      this.stick.style.transform = `translate(${ox - R}px, ${oy - R}px)`;
      this.stick.classList.add('on');
      this.knob.style.transform = 'translate(0px, 0px)';
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) {
        dx *= R / l;
        dy *= R / l;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.touch.moveX = dx / R;
      input.touch.moveY = -dy / R;
      // Thumb pushed all the way = run.
      if (l > R * 0.95) input.touch.held.add('sprint');
      else input.touch.held.delete('sprint');
    });
    const up = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      input.touch.moveX = input.touch.moveY = 0;
      input.touch.held.delete('sprint');
      this.stick.classList.remove('on');
    };
    z.addEventListener('pointerup', up);
    z.addEventListener('pointercancel', up);
  }

  _lookZone(z) {
    let lx = 0, ly = 0;
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.lookId !== null) return;
      this.lookId = e.pointerId;
      capture(z, e.pointerId);
      lx = e.clientX;
      ly = e.clientY;
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId || !input.enabled) return;
      const k = 0.0048 * settings.get('sensitivity');
      input.lookX += (e.clientX - lx) * k;
      input.lookY += (e.clientY - ly) * k * (settings.get('invertY') ? -1 : 1);
      lx = e.clientX;
      ly = e.clientY;
    });
    const up = (e) => {
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    z.addEventListener('pointerup', up);
    z.addEventListener('pointercancel', up);
  }

  // Show only the buttons that do something right now.
  update() {
    const h = this.game.player?.hands;
    if (!h) return;
    const r = h.slots.right, l = h.slots.left;
    this.el.classList.toggle('has-ray', !!(r && r.kind === 'tool' && r.ref.id === 'ray'));
    this.el.classList.toggle('has-prop', !!((r && r.kind === 'prop') || (l && l.kind === 'prop')));
  }
}
