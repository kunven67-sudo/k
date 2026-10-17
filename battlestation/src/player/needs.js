// Your body: hunger, thirst, bladder and tiredness creep up in real time (hours, not minutes).
// Nothing kills you. Ignore them and you get slower, your eyes get heavy, the view goes soft.
// 0 = totally fine, 1 = you really need to deal with it.
const RATE = {               // per real hour
  hunger: 1 / 5,             // hungry again ~5 h after a meal
  thirst: 1 / 3.5,
  bladder: 1 / 3,            // faster after you drink (see drink())
  tired: 1 / 16,             // a full day awake
};
const LABEL = { hunger: 'Hungry', thirst: 'Thirsty', bladder: 'Need to pee', tired: 'Tired' };
const ICON = {
  hunger: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 1.5v5a1.5 1.5 0 003 0v-5M5.5 1.5v13M11.5 14.5V1.5c-2 0-3 2-3 5s1 3 3 3"/></svg>',
  thirst: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 009 0C12.5 7 8 1.5 8 1.5z"/></svg>',
  bladder: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9h10v1.5a4 4 0 01-4 4H7a4 4 0 01-4-4zM4.5 9V3.5h4V9M10.5 6h2"/></svg>',
  tired: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 9.5A6 6 0 116.5 3a4.8 4.8 0 006.5 6.5z"/></svg>',
};

export class Needs {
  constructor(g) {
    this.g = g;
    this.v = { hunger: 0.25, thirst: 0.3, bladder: 0.35, tired: 0.05 };
    this.caffeine = 0;   // energy drinks: wakes you up for a while, then the crash
    this.sugar = 0;
    this.saveT = 0;
    this.restore();
    this.el = document.createElement('div');
    this.el.id = 'needs';
    document.getElementById('hud').appendChild(this.el);
    this.shown = '';
  }

  restore() {
    try {
      const s = JSON.parse(localStorage.getItem('bs_needs') || 'null');
      if (s?.v) {
        Object.assign(this.v, s.v);
        // time away from the game still counts a bit (you were busy in real life too)
        const hrs = Math.min(12, Math.max(0, (Date.now() - (s.t || Date.now())) / 3.6e6));
        for (const k of Object.keys(RATE)) this.v[k] = Math.min(0.75, this.v[k] + RATE[k] * hrs * 0.35);
      }
    } catch (e) { /* first run */ }
  }

  save() { try { localStorage.setItem('bs_needs', JSON.stringify({ v: this.v, t: Date.now() })); } catch (e) { /* blocked */ } }

  // ------------------------------------------------------------------ things that fix you
  eat(amount, what) {
    this.v.hunger = Math.max(0, this.v.hunger - amount);
    this.v.thirst = Math.min(1, this.v.thirst + amount * 0.08);
    if (what) this.g.toast(what);
    this.save();
  }

  drink(amount, o = {}) {
    this.v.thirst = Math.max(0, this.v.thirst - amount);
    this.v.bladder = Math.min(1, this.v.bladder + amount * 0.35);
    if (o.caffeine) this.caffeine = Math.min(1.5, this.caffeine + o.caffeine);
    if (o.sugar) this.sugar = Math.min(1, this.sugar + o.sugar);
    if (o.text) this.g.toast(o.text);
    this.save();
  }

  pee() { this.v.bladder = 0; this.save(); }

  // sleeping in bed: every real minute asleep takes off about 15 minutes of awake time
  rest(dt) { this.v.tired = Math.max(0, this.v.tired - dt / 60 * RATE.tired * 4); }

  // ------------------------------------------------------------------ per frame
  update(dt, asleep) {
    const h = dt / 3600;
    const v = this.v;
    v.hunger = Math.min(1, v.hunger + RATE.hunger * h);
    v.thirst = Math.min(1, v.thirst + RATE.thirst * h);
    v.bladder = Math.min(1, v.bladder + RATE.bladder * h);
    if (!asleep) v.tired = Math.min(1, v.tired + RATE.tired * h * (this.caffeine > 0.2 ? 0.3 : 1));
    // caffeine wears off over ~3 h, then you feel it
    if (this.caffeine > 0) { this.caffeine = Math.max(0, this.caffeine - h / 3); if (this.caffeine < 0.05 && this.caffeine > 0) v.tired = Math.min(1, v.tired + 0.04); }
    this.sugar = Math.max(0, this.sugar - h * 2);
    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; this.save(); }
    this.hud();
  }

  // how much the body slows you down (walk speed multiplier)
  speed() { return 1 - Math.max(0, this.v.hunger - 0.75) * 0.5 - Math.max(0, this.effTired() - 0.8) * 0.8; }
  effTired() { return Math.max(0, this.v.tired - this.caffeine * 0.5); }
  // soft focus when you're dehydrated or exhausted
  blur() { return Math.max(0, this.v.thirst - 0.85) * 4 + Math.max(0, this.effTired() - 0.9) * 6; }
  jitter() { return this.caffeine > 0.9 ? (this.caffeine - 0.9) * 0.6 : 0; }

  hud() {
    const show = Object.keys(LABEL).filter(k => (k === 'tired' ? this.effTired() : this.v[k]) > 0.6);
    const key = show.map(k => k + ((this.v[k] > 0.85) ? '!' : '')).join(',');
    if (key === this.shown) return;
    this.shown = key;
    this.el.innerHTML = show.map(k => `<div class="need${this.v[k] > 0.85 ? ' bad' : ''}" title="${LABEL[k]}">${ICON[k]}<span>${LABEL[k]}</span></div>`).join('');
  }
}
