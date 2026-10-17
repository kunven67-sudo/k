// Background sound for wherever you are, crossfaded smoothly:
//   outside, day   -> birds + breeze (spring/summer/fall), wind in winter; Elm Ave traffic gets
//                     louder the closer you are to it
//   outside, night -> crickets (not in winter), quiet wind
//   rain           -> rain on everything (muffled indoors)
//   inside a house -> quiet room; the kitchen fridge hums when you're near it
//   inside a store -> air conditioning hum
//
//   const amb = new Ambience(world); amb.update(dt, playerPos)

import { audio } from '../core/audio.js';
import { clock } from '../core/clock.js';
import { ELM } from './layout.js';

const BEDS = ['amb.birds', 'amb.night', 'amb.wind', 'amb.traffic', 'amb.rain', 'fan.hum', 'fridge.hum'];

export class Ambience {
  constructor(world) {
    this.world = world;
    this.h = {};
    this.g = Object.fromEntries(BEDS.map((b) => [b, 0]));
    this._t = 0;
    this.fridge = world.home?.spots.find((s) => s.kind === 'fridge' && s.room === 'kitchen')?.at || null;
  }

  _ensure(name) {
    if (this.h[name] || !audio.ctx) return this.h[name];
    try {
      this.h[name] = audio.play(name, { bus: 'ambience', loop: true, gain: 0, reverb: 0.05 });
    } catch {
      this.h[name] = null;
    }
    return this.h[name];
  }

  update(dt, p) {
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.2;
    const w = this.world;
    const room = w.roomAt(p.clone().setY(p.y + 0.5));
    const inside = !!room;
    const store = room?.kind === 'store';
    const h = clock.hourFloat;
    const night = clock.isNight || h < 5.8 || h > 20.5;
    const winter = clock.season === 'winter';
    const rain = w.weather?.rain || 0;
    const out = inside ? 0.18 : 1; // walls take most of the outside away
    const elm = Math.max(0, 1 - Math.abs(p.x - ELM.x) / 70);
    const want = {
      'amb.birds': !night && !winter ? 0.55 * out * (1 - rain) : 0,
      'amb.night': night && !winter ? 0.6 * out : 0,
      'amb.wind': (winter ? 0.5 : 0.18) * out,
      'amb.traffic': (0.08 + elm * 0.55) * out * (night ? 0.4 : 1),
      'amb.rain': rain * (inside ? 0.35 : 0.9),
      'fan.hum': store ? 0.35 : 0,
      'fridge.hum': this.fridge && inside && !store ? Math.max(0, 1 - p.distanceTo(this.fridge) / 5) * 0.45 : 0,
    };
    for (const name of BEDS) {
      this.g[name] += (want[name] - this.g[name]) * 0.25;
      const g = this.g[name];
      if (g > 0.004) this._ensure(name)?.setGain(g, 0.25);
      else if (this.h[name]) this.h[name].setGain(0, 0.25);
    }
  }

  dispose() {
    for (const h of Object.values(this.h)) h?.stop?.(0.5);
    this.h = {};
  }
}
