// Needs & health (DESIGN §4) — told through the body only, never a bar (DESIGN §1).
//
// All needs are 0..100 where 100 = fine and 0 = in trouble; `temp` is the core body temperature
// in °C. Rates are per GAME hour (1 game day = 48 real minutes, so 1 game hour = 2 real minutes).
//
//   need      empties in     what you notice
//   hunger    ~45 h          stomach growls, then a slower walk; 0 → health drains (days)
//   thirst    ~30 h          dry swallows, slower; 0 → health drains (about a day)
//   energy    ~20 h awake    yawns, heavy eyelids (vignette pulses), blur; 0 → you pass out
//   bladder   ~14 h          fidgeting, then an accident (hygiene + fun hit), never deadly
//   hygiene   ~60 h          stink lines (NPCs react later)
//   fun       ~80 h          sighs (other modules read it)
//   temp      drifts toward the weather; shiver below 36 °C, sweat above 37.6 °C
//
// Health only drains while something is at zero (or the temperature is extreme), and refills
// slowly when nothing is. Death is real (DESIGN §2) but it takes a full game day of neglect.

import { bus } from '../core/events.js';
import { save } from '../core/save.js';
import { clamp, lerp } from '../core/util.js';
import { t } from '../core/i18n.js';
import { clock } from '../core/clock.js';
import { slice } from './state.js';
import { sfx } from './sounds.js';

const RATES = { hunger: 2.2, thirst: 3.3, energy: 5.0, bladder: 7.0, hygiene: 1.6, fun: 1.25 };
const GAME_HOUR_S = 120; // real seconds per game hour

export class Needs {
  constructor({ engine, player, world }) {
    this.engine = engine;
    this.player = player;
    this.world = world;
    this.n = slice('needs');
    this.cue = { stomach: rand(20, 50), swallow: rand(15, 40), yawn: rand(25, 60), fidget: rand(12, 30), shiver: rand(6, 14) };
    this.eyelid = 0; // 0..1 slow "heavy eyelid" blink
    this.eyelidT = rand(8, 20);
    this.asleep = false;
    this.collapsed = 0;
    this.speedCap = 99; // read by index.js
    this.stink = 0; // 0..1
    this._emitT = 0;
    this._baseVignette = engine.effects?.uVignette?.value ?? 0.2;
    this.offs = [
      bus.on('sleep:start', () => (this.asleep = true)),
      bus.on('sleep:end', () => (this.asleep = false)),
      bus.on('life:catchup', (c) => this.catchUp((c.toGameMs - c.fromGameMs) / 3600000)),
      // Other modules feed the body through events: bus.emit('needs:add', { hunger: 30 }).
      bus.on('needs:add', (d) => this.add(d)),
    ];
  }

  /** Add to needs (eating, drinking, showering, sleeping). */
  add(delta = {}) {
    for (const [k, v] of Object.entries(delta)) {
      if (k in this.n && typeof v === 'number') this.n[k] = k === 'temp' ? v + this.n[k] : clamp(this.n[k] + v, 0, 100);
    }
    save.markDirty();
    bus.emit('needs:changed', { needs: this.n });
  }

  /** Offline time: decay is gentler (you'd have eaten something), and never kills you. */
  catchUp(hours) {
    const n = this.n;
    for (const k of Object.keys(RATES)) n[k] = Math.max(k === 'bladder' ? 40 : 15, n[k] - RATES[k] * hours * 0.5);
  }

  /** Ambient temperature (°C) if the world exposes weather, else a mild indoor default. */
  _ambient() {
    const w = this.world;
    const v = w?.weather?.tempC ?? w?.sky?.weather?.tempC ?? w?.ambientTempC;
    if (typeof v === 'number') return this.player?.zone?.indoor || w?.indoor ? lerp(v, 21, 0.75) : v;
    return 21;
  }

  update(dt) {
    const n = this.n;
    const h = (dt / GAME_HOUR_S) * (clock.speed || 1);
    const sleepMul = this.asleep ? 0.45 : 1;
    n.hunger = Math.max(0, n.hunger - RATES.hunger * h * sleepMul);
    n.thirst = Math.max(0, n.thirst - RATES.thirst * h * sleepMul);
    n.bladder = Math.max(0, n.bladder - RATES.bladder * h * (this.asleep ? 0.3 : 1));
    n.hygiene = Math.max(0, n.hygiene - RATES.hygiene * h);
    n.fun = Math.max(0, n.fun - RATES.fun * h * (this.asleep ? 0 : 1));
    n.energy = this.asleep ? Math.min(100, n.energy + 12.5 * h) : Math.max(0, n.energy - RATES.energy * h);

    // Core temperature drifts (slowly) toward what the weather pushes it to.
    const amb = this._ambient();
    const target = 37 + clamp((amb - 22) * 0.06, -2.2, 1.4);
    n.temp += (target - n.temp) * Math.min(1, h * 0.6);

    // Health: drains only with something at zero or a dangerous temperature.
    let drain = 0;
    let cause = null;
    const hit = (cond, rate, c) => {
      if (cond && rate > drain) (drain = rate), (cause = c);
    };
    hit(n.thirst <= 0, 4.0, 'death.thirst');
    hit(n.hunger <= 0, 1.6, 'death.starved');
    hit(n.energy <= 0, 0.8, 'death.exhaustion');
    hit(n.temp < 35 || n.temp > 39.5, 3.0, 'death.exposure');
    if (drain) n.health = Math.max(0, n.health - drain * h);
    else if (n.hunger > 25 && n.thirst > 25) n.health = Math.min(100, n.health + 0.6 * h);
    if (n.health <= 0 && !this.dead) return this._die(cause || 'death.health');

    if (!this.asleep) this._cues(dt);

    this._emitT -= dt;
    if (this._emitT <= 0) {
      this._emitT = 5;
      save.markDirty();
      bus.emit('needs:changed', { needs: n });
    }
  }

  _human() {
    return this.player?.human;
  }

  _soundAt(name, opts = {}) {
    const p = this.player?.position;
    sfx(name, { ...opts, position: p ? { x: p.x, y: p.y + 1.2, z: p.z } : undefined, refDistance: 3 });
  }

  _cues(dt) {
    const n = this.n;
    const human = this._human();
    const fx = this.engine?.effects;

    // Walk speed cap (m/s). The controller's sprint is well above 4.
    let cap = 99;
    if (n.hunger < 15) cap = Math.min(cap, 2.6);
    else if (n.hunger < 30) cap = Math.min(cap, 3.6);
    if (n.thirst < 12) cap = Math.min(cap, 2.3);
    else if (n.thirst < 25) cap = Math.min(cap, 3.4);
    if (n.energy < 10) cap = Math.min(cap, 1.7);
    else if (n.energy < 22) cap = Math.min(cap, 2.8);
    if (this.collapsed > 0) cap = 0.01;
    this.speedCap = cap;

    // Hunger: the stomach talks, louder and more often the emptier it is.
    if (n.hunger < 38 && (this.cue.stomach -= dt) <= 0) {
      this.cue.stomach = lerp(25, 110, n.hunger / 38) * rand(0.7, 1.3);
      this._soundAt('body.stomach', { gain: lerp(1, 0.55, n.hunger / 38), rate: rand(0.9, 1.1) });
    }
    // Thirst: dry swallows.
    if (n.thirst < 32 && (this.cue.swallow -= dt) <= 0) {
      this.cue.swallow = lerp(14, 70, n.thirst / 32) * rand(0.7, 1.3);
      this._soundAt('life.swallow', { gain: 0.7, rate: rand(0.92, 1.08) });
      human?.setViseme?.('U', 0.6);
      setTimeout(() => human?.setViseme?.('rest', 0), 380);
    }
    // Energy: yawns + heavy eyelids (vignette pulse) + blur when exhausted.
    if (n.energy < 30 && (this.cue.yawn -= dt) <= 0) {
      this.cue.yawn = lerp(22, 90, n.energy / 30) * rand(0.7, 1.3);
      human?.play?.('yawn');
      this._soundAt('body.yawn', { rate: rand(0.9, 1.08) });
    }
    if (n.energy < 25) {
      this.eyelidT -= dt;
      if (this.eyelidT <= 0) {
        this.eyelidT = lerp(4, 16, n.energy / 25) * rand(0.7, 1.4);
        this.eyelidPhase = 0;
      }
    }
    if (this.eyelidPhase != null) {
      this.eyelidPhase += dt / 2.2; // a slow droop and a jerk back open
      const p = this.eyelidPhase;
      this.eyelid = p < 0.75 ? Math.sin((p / 0.75) * Math.PI * 0.5) : Math.max(0, 1 - (p - 0.75) * 6);
      if (p > 1) (this.eyelidPhase = null), (this.eyelid = 0);
    }
    if (fx) {
      const tired = clamp((25 - n.energy) / 25, 0, 1);
      if (fx.uVignette) fx.uVignette.value = lerp(fx.uVignette.value, this._baseVignette + tired * 0.25 + this.eyelid * (0.35 + tired * 0.5), Math.min(1, dt * 6));
      // Add only our own share on top of whatever else blurs the view (hangover, drinks).
      const blur = clamp((10 - n.energy) / 10, 0, 1) * 0.45;
      if (fx.uBlur) fx.uBlur.value = Math.max(0, fx.uBlur.value + blur - (this._blur || 0));
      this._blur = blur;
    }
    // Pass out at zero energy: down for a while, wake with a little back.
    if (n.energy <= 0 && this.collapsed <= 0) {
      this.collapsed = 14;
      human?.play?.('stumble');
      this._soundAt('body.groan');
      bus.emit('life:collapse', { cause: 'exhaustion' });
    }
    if (this.collapsed > 0) {
      this.collapsed -= dt;
      const tun = clamp(this.collapsed / 6, 0, 0.8);
      if (fx?.uTunnel) fx.uTunnel.value = Math.max(0, fx.uTunnel.value + tun - (this._tunnel || 0));
      this._tunnel = tun;
      if (this.collapsed <= 0) {
        n.energy = 14;
        human?.play?.('get-up-floor');
      }
    }

    // Bladder: fidget, then the accident.
    if (n.bladder < 22 && (this.cue.fidget -= dt) <= 0) {
      this.cue.fidget = lerp(8, 30, n.bladder / 22) * rand(0.7, 1.3);
      human?.play?.(Math.random() < 0.5 ? 'pat-pockets' : 'shrug', { speed: 1.4 });
      human?.setExpression?.('nervous', 0.7);
    }
    if (n.bladder <= 0) {
      n.bladder = 100;
      n.hygiene = Math.max(0, n.hygiene - 45);
      n.fun = Math.max(0, n.fun - 25);
      human?.setExpression?.('pain', 0.8);
      human?.play?.('facepalm');
      this._soundAt('life.trickle', { gain: 0.8 });
      bus.emit('life:accident', { position: this.player?.position?.clone?.() });
    }

    // Temperature: shiver (chatter + cold breath) or sweat.
    const cold = clamp((36.2 - n.temp) / 1.2, 0, 1);
    const hot = clamp((n.temp - 37.5) / 1.2, 0, 1);
    this.shiver = cold;
    if (cold > 0 && (this.cue.shiver -= dt) <= 0) {
      this.cue.shiver = lerp(14, 4, cold) * rand(0.7, 1.3);
      this._soundAt('life.chatter', { gain: 0.4 + cold * 0.4 });
    }
    human?.setSweat?.(hot);

    // Hygiene → stink lines strength.
    this.stink = clamp((32 - n.hygiene) / 26, 0, 1);
  }

  _die(causeKey) {
    this.dead = true;
    const fx = this.engine?.effects;
    if (fx?.uTunnel) fx.uTunnel.value = 1;
    bus.emit('life:dying', { cause: causeKey });
    // The obituary keeps the cause as plain words in both languages.
    setTimeout(() => save.endLife({ cause: causeKey, causeText: t(`life.${causeKey}`) }), 4000);
  }

  dispose() {
    for (const off of this.offs) off();
    const fx = this.engine?.effects;
    if (fx?.uVignette) fx.uVignette.value = this._baseVignette;
  }
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}
