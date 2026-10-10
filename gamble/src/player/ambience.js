// Zone ambience: looping beds crossfaded by where you are (no hard cuts).
//   motel room / bathroom / office → amb.motel-room (+ a neighbour's TV through the wall),
//   outdoors → amb.city by day, amb.night layered in after dark, amb.traffic near 4th St.
// The motel room radio (music 'motel-radio') plays quietly only while the room's TV/radio is on.
import { audio } from '../core/audio.js';

const FADE = 0.9; // seconds (time constant of the gain glide)

export class Ambience {
  constructor() {
    this.loops = new Map(); // name → { h, gain, idle }
    this.radio = false;
  }

  _target(zone, night) {
    const g = {};
    const indoor = zone?.indoor;
    if (indoor) {
      const bath = zone.id === 'motel-bathroom';
      g['amb.motel-room'] = bath ? 0.35 : 0.55;
      if (zone.id === 'motel-room' || bath) g['amb.neighbor-tv'] = bath ? 0.05 : 0.12;
      g['amb.city'] = 0.08; // muffled street through the walls
    } else {
      const lot = zone?.id === 'motel-lot';
      g['amb.city'] = lot ? 0.42 : 0.6;
      g['amb.traffic'] = lot ? 0.18 : 0.32;
      g['amb.night'] = 0.35 * night;
    }
    return g;
  }

  update({ zone, night = 0, tvOn = false, music = null }) {
    const running = audio.ctx && audio.ctx.state === 'running';
    if (!running) return;
    const target = this._target(zone, night);
    const names = new Set([...this.loops.keys(), ...Object.keys(target)]);
    for (const name of names) {
      const want = target[name] || 0;
      let L = this.loops.get(name);
      if (!L && want > 0.001) {
        let h = null;
        try {
          h = audio.play(name, { bus: 'ambience', loop: true, gain: 0.0001 });
        } catch {
          h = null;
        }
        if (!h) continue;
        L = { h, gain: 0, idle: 0 };
        this.loops.set(name, L);
      }
      if (!L) continue;
      if (Math.abs(L.gain - want) > 0.005) {
        L.gain = want;
        L.h.setGain?.(want, FADE);
      }
      // Fully faded beds are stopped after a while (they restart on demand).
      L.idle = want <= 0.001 ? L.idle + 1 : 0;
      if (L.idle > 40) {
        L.h.stop?.(0.2);
        this.loops.delete(name);
      }
    }
    // The radio in the room: diegetic, quiet, only while it's on and you're in there.
    const wantRadio = !!(tvOn && zone && (zone.id === 'motel-room' || zone.id === 'motel-bathroom'));
    if (music && wantRadio !== this.radio) {
      this.radio = wantRadio;
      try {
        if (wantRadio) music.play('motel-radio', { fade: 2, gain: 0.35 });
        else music.stop({ fade: 2 });
      } catch {
        /* music engine absent */
      }
    }
  }

  dispose() {
    for (const L of this.loops.values()) L.h.stop?.(0.5);
    this.loops.clear();
    if (this.radio) {
      try {
        this.radio = false;
      } catch {
        /* */
      }
    }
  }
}
