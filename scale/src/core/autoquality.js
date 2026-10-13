// Smart auto quality: keeps the game smooth on whatever computer it runs on.
//
// When the Graphics setting is Auto, it watches how long frames take (averaged over a couple of
// seconds, so one hiccup doesn't count). Below ~52 FPS it lowers the resolution a little at a time
// (down to 55%); if that isn't enough, it turns off the most expensive effect (ambient occlusion).
// With time to spare it brings them back, effects first. On any fixed setting (Low..Ultra) it does
// nothing: Ultra means everything on, always.
import { settings } from './settings.js';

export class AutoQuality {
  constructor(view, { enabled }) {
    this.view = view;
    this.enabled = enabled;
    this.acc = 0;
    this.n = 0;
    this.t = 0;
    this.cooldown = 3; // let loading settle first
    this.state = 'resolution 100%';
  }

  update(dt) {
    if (!this.enabled || !(settings.get('quality') === 'auto')) return;
    if (dt > 0.1) return; // tab switches, loading: not real frames
    this.acc += dt;
    this.n++;
    this.t += dt;
    this.cooldown -= dt;
    if (this.t < 1.5) return;
    const ms = (this.acc / this.n) * 1000;
    this.acc = 0;
    this.n = 0;
    this.t = 0;
    if (this.cooldown > 0) return;
    const v = this.view;
    if (ms > 19.2) {
      // Too slow: resolution first, then effects.
      if (v.dynScale > 0.56) v.setDynScale(Math.max(0.55, v.dynScale - (ms > 28 ? 0.15 : 0.08)));
      else if (v.ao && v.ao.enabled) v.ao.enabled = false;
      else if (v.bloom && v.bloom.enabled) v.bloom.enabled = false;
      this.cooldown = 1.5;
    } else if (ms < 14.5) {
      // Time to spare: effects back first (they matter more than a few pixels), then resolution.
      if (v.bloom && !v.bloom.enabled) v.bloom.enabled = true;
      else if (v.ao && !v.ao.enabled && v.dynScale >= 0.8) v.ao.enabled = true;
      else if (v.dynScale < 1) v.setDynScale(Math.min(1, v.dynScale + 0.05));
      this.cooldown = 3;
    }
    this.state = `resolution ${Math.round(v.dynScale * 100)}%${v.ao && !v.ao.enabled ? ', shadows in corners off' : ''}`;
  }
}
