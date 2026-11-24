// Sound: real CC0 recordings + (on Windows) their own Windows sounds from C:\Windows\Media
import { asset, clamp, rand } from './util.js';
const fs = require('fs');

const NAMES = ['tear_plastic', 'tear_paper', 'glass_shatter', 'glass_crack', 'impact_wood', 'impact_metal', 'impact_plastic', 'thud', 'laser', 'punch', 'poof',
  'gunshot', 'siren', 'fuse', 'big_boom', 'explosion', 'day_amb', 'night_amb', 'town_amb', 'pub_amb', 'feedback', 'door', 'pop_click', 'baby', 'cheer',
  'swallow', 'eat', 'sleep', 'fire_loop', 'fire_ignite', 'ice_freeze', 'ice_shatter', 'ice_crack', 'electric', 'thunder', 'whoosh', 'rumble', 'shimmer',
  'field_hum', 'sizzle', 'incoming', 'water_splash', 'water_pour', 'bubble_pop', 'pop', 'squelch', 'steam', 'lava', 'glitch', 'hiccup', 'beep', 'blizzard', 'bubbles', 'field_hit', 'water_drip', 'band_stretch'];
const WIN_MEDIA = { start: 'Windows Navigation Start.wav', notify: 'Windows Notify System Generic.wav', error: 'Windows Background.wav', ding: 'Windows Ding.wav',
  logon: 'Windows Logon.wav', unlock: 'Windows Unlock.wav', shutdown: 'Windows Shutdown.wav', critical: 'Windows Critical Stop.wav', recycle: 'Windows Recycle.wav', hw_insert: 'Windows Hardware Insert.wav', hw_remove: 'Windows Hardware Remove.wav' };

class Audio {
  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
    this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.master.connect(this.comp).connect(this.ctx.destination);
    this.buf = {}; this.loops = {}; this.last = {}; this.slow = 1;
    this.ready = this.load();
  }
  async load() {
    await Promise.all(NAMES.map(async n => {
      try { const r = await fetch(asset('sounds/' + n + '.ogg')); if (!r.ok) return; this.buf[n] = await this.ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) { }
    }));
    if (process.platform === 'win32') {
      const dir = (process.env.SystemRoot || 'C:\\Windows') + '\\Media\\';
      await Promise.all(Object.entries(WIN_MEDIA).map(async ([k, f]) => {
        try { const b = fs.readFileSync(dir + f); this.buf['win_' + k] = await this.ctx.decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (e) { }
      }));
    }
  }
  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }
  setVolume(v) { this.master.gain.value = clamp(v, 0, 1.5); }
  // play once. o: {vol, rate, pan (-1..1), x (screen px -> pan), gap (min seconds between same sound), start, dur}
  play(name, o = {}) {
    const b = this.buf[name]; if (!b) return null;
    const t = this.ctx.currentTime;
    const gap = o.gap ?? 0.03; if (this.last[name] && t - this.last[name] < gap) return null; this.last[name] = t;
    const src = this.ctx.createBufferSource(); src.buffer = b;
    src.playbackRate.value = (o.rate ?? rand(0.92, 1.08)) * (o.noSlow ? 1 : this.slow);
    const g = this.ctx.createGain(); g.gain.value = clamp(o.vol ?? 1, 0, 3);
    const p = this.ctx.createStereoPanner(); p.pan.value = clamp(o.pan ?? (o.x !== undefined ? (o.x / innerWidth) * 2 - 1 : 0), -1, 1) * 0.7;
    src.connect(g).connect(p).connect(this.master);
    src.start(t, o.start || 0, o.dur);
    return { src, g };
  }
  // looping sound that can be faded (fire, ambience, laser)
  loop(name, vol = 1, key = name) {
    let L = this.loops[key];
    if (!L) {
      const b = this.buf[name]; if (!b) return null;
      const src = this.ctx.createBufferSource(); src.buffer = b; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0; src.connect(g).connect(this.master); src.start();
      L = this.loops[key] = { src, g, vol: 0 };
    }
    L.vol = vol; L.g.gain.setTargetAtTime(clamp(vol, 0, 2), this.ctx.currentTime, 0.12);
    return L;
  }
  loopRate(key, r) { const L = this.loops[key]; if (L) L.src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.1); }
  stopLoop(key) { const L = this.loops[key]; if (L) { L.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); L.vol = 0; } }
  killLoop(key) { const L = this.loops[key]; if (L) { try { L.src.stop(this.ctx.currentTime + 0.5); } catch (e) { } L.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); delete this.loops[key]; } }
  win(k, vol = 0.8) { return this.play('win_' + k, { vol, rate: 1, gap: 0.1, noSlow: true }); }
}
export const audio = new Audio();
