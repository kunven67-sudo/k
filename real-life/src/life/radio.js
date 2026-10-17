// The kitchen radio really plays: music on the station you picked, quieter the further you are,
// muffled through walls (other rooms / outside), with the tinny little-speaker sound. Your
// phone's music app wins while it plays (it's in your hand).
//
//   const radio = new Radio(life)   // listens to 'radio:set' + 'phone:music'

import { bus } from '../core/events.js';
import { music } from '../audio/music/index.js';
import { settings } from '../core/settings.js';
import { save } from '../core/save.js';

const TRACK = ['menu-lounge', 'motel-radio', 'creator-dmv', 'casino-floor'];

export class Radio {
  constructor(life) {
    this.life = life;
    this.on = false;
    this.at = null;
    this.track = null;
    this.phone = false;
    this._t = 0;
    this._offs = [
      bus.on('radio:set', ({ on, station, at }) => {
        this.on = on;
        if (at) this.at = at.clone();
        this.track = TRACK[station % TRACK.length];
        if (!on && !this.phone) music.stop({ fade: 0.4 });
        this._t = 0;
      }),
      bus.on('phone:music', ({ on }) => {
        this.phone = on;
        if (!on && this.on) this._t = 0;
      }),
    ];
    // Radio left on in the save.
    const r = save.slice('home').radio;
    if (r?.on) {
      this.on = true;
      this.track = TRACK[r.station % TRACK.length];
      this.at = life.world.home.spots.find((s) => s.kind === 'radio')?.at.clone() || null;
    }
  }

  update(dt) {
    if (!this.on || this.phone || !this.at) return;
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.25;
    const p = this.life.player.position;
    const d = p.distanceTo(this.at);
    const w = this.life.world;
    const here = w.roomAt(p)?.id;
    const there = w.roomAt(this.at.clone().setY(this.at.y))?.id || 'kitchen';
    const sameSpace = here === there || (['kitchen', 'living'].includes(here) && ['kitchen', 'living'].includes(there));
    const gain = Math.max(0, 1 - d / (sameSpace ? 16 : 11)) ** 1.6 * (settings.get('radioVolume') ?? 0.8);
    if (gain < 0.01) {
      if (music.current) music.stop({ fade: 0.5 });
      return;
    }
    music.play(this.track, { fade: 0.3, gain: gain * 1.4, radio: 1 });
    music.setMuffle(sameSpace ? 0 : here ? 0.55 : 0.75);
  }

  dispose() {
    for (const off of this._offs) off();
    if (this.on && !this.phone) music.stop({ fade: 0.3 });
  }
}
