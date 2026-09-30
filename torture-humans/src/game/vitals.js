// Your body: health, hunger, thirst, energy (sleep). Drain speed follows the
// difficulty; creative mode turns it all off. Empty hunger or thirst hurts.
const DIFFICULTY = { easy: 0.6, normal: 1, hard: 1.5, hardcore: 1.5, creative: 0 };
// per real minute at normal difficulty
const DRAIN = { hunger: 1.0, thirst: 1.4, energy: 0.7 };

export class Vitals {
  constructor(settings) {
    this.settings = settings;
    this.health = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.energy = 100;
    this.dead = false;
    this.lastCause = null;
    this.onDeath = null;
    this.hurtFlash = 0;
    this.el = document.getElementById('vitals');
  }

  get mult() {
    return DIFFICULTY[this.settings.get('gameplay.difficulty')] ?? 1;
  }

  damage(amount, cause) {
    if (this.dead || this.mult === 0) return;
    this.health = Math.max(0, this.health - amount);
    this.lastCause = cause;
    this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    if (this.health <= 0) {
      this.dead = true;
      this.onDeath?.(cause);
    }
  }

  eat(amount) { this.hunger = Math.min(100, this.hunger + amount); }
  drink(amount) { this.thirst = Math.min(100, this.thirst + amount); }
  rest(amount) { this.energy = Math.min(100, this.energy + amount); }

  revive(health = 60) {
    this.dead = false;
    this.health = health;
  }

  update(dt) {
    dt = Math.max(0, dt);
    const k = this.mult;
    if (!this.dead && k > 0) {
      const perSec = (x) => (x * k) / 60;
      this.hunger = Math.max(0, this.hunger - perSec(DRAIN.hunger) * dt);
      this.thirst = Math.max(0, this.thirst - perSec(DRAIN.thirst) * dt);
      this.energy = Math.max(0, this.energy - perSec(DRAIN.energy) * dt);
      if (this.hunger <= 0) this.damage(0.8 * dt, 'starved');
      if (this.thirst <= 0) this.damage(1.2 * dt, 'dehydrated');
      // slowly heal when fed and watered
      if (this.hunger > 50 && this.thirst > 50 && this.health < 100) this.health = Math.min(100, this.health + 0.5 * dt);
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    this.draw();
  }

  draw() {
    if (!this.el) return;
    const set = (name, v) => {
      const bar = this.el.querySelector(`[data-v="${name}"] > i`);
      if (bar) bar.style.backgroundSize = `${v.toFixed(1)}% 100%, 100% 100%`; // fill part, then the empty track
    };
    set('health', this.health);
    set('hunger', this.hunger);
    set('thirst', this.thirst);
    set('energy', this.energy);
    this.el.hidden = this.mult === 0;
    const hurt = document.getElementById('hurt');
    if (hurt) hurt.style.opacity = String(this.hurtFlash * 0.7);
  }
}
