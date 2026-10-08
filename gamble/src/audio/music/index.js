// Music engine: plays the generative tracks on the 'music' bus.
//
//   music.play('menu-lounge', { fade: 2, gain: 1 })   crossfades from whatever is playing
//   music.stop({ fade: 2 })
//   music.setMuffle(0..1)    lowpass, e.g. music heard through a wall / from another room
//   music.setRadioFX(0..1)   tinny clock-radio speaker (band-limited, driven, hissy); each track
//                            sets its own default on play (motel-radio = 1)
//   music.current            id of the playing track or null
//   music.render(id, sec)    → Promise<AudioBuffer> offline render (dev tools / tests)
//
// Signal chain: track gain → muffle LPF → [dry | radio: HP → mid peak → LP → shaper (+ hiss)]
//               → out → audio.buses.music, with a send into the room reverb (casino music is
//               diegetic, so it takes the casino's reverb).

import { audio } from '../../core/audio.js';
import { TRACKS, TRACK_IDS } from './tracks.js';
import { Scheduler } from './scheduler.js';
import { noteBuffer } from './instruments.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const muffleHz = (m, sr = 44100) => Math.min(sr * 0.45, 18000 * Math.pow(1 - clamp01(m) * 0.97, 3) + 220);

/** Build the post-band chain on any context. Returns { input, output, set(muffle, radio, t) }. */
function buildChain(ctx) {
  const input = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = muffleHz(0, ctx.sampleRate);
  lpf.Q.value = 0.5;
  input.connect(lpf);

  const dry = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = 0;
  // Gentle bus "glue" compressor: tames ride/brush transients and keeps peaks under -1 dBFS.
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.knee.value = 12;
  glue.ratio.value = 3;
  glue.attack.value = 0.008;
  glue.release.value = 0.25;
  const output = ctx.createGain();
  output.gain.value = 0.85;
  glue.connect(output);
  lpf.connect(dry).connect(glue);

  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 380;
  hpf.Q.value = 1.1;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1700;
  mid.Q.value = 0.9;
  mid.gain.value = 7;
  const lp2 = ctx.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.frequency.value = 3400;
  lp2.Q.value = 1.4;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2.6 + 0.08) / Math.tanh(2.6); // slightly asymmetric: cheap speaker
  }
  shaper.curve = curve;
  const pre = ctx.createGain();
  pre.gain.value = 1.8;
  const dcb = ctx.createBiquadFilter(); // the asymmetric shaper adds DC
  dcb.type = 'highpass';
  dcb.frequency.value = 120;
  lpf.connect(hpf).connect(mid).connect(lp2).connect(pre).connect(shaper).connect(dcb).connect(wet).connect(glue);

  // AM-radio hiss + faint 60 Hz hum, only audible through the radio path.
  const n = ctx.sampleRate * 2;
  const hb = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = hb.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = b * 0.6 + (Math.random() * 2 - 1) * 0.4;
    d[i] = b * 0.5 + Math.sin((2 * Math.PI * 60 * i) / ctx.sampleRate) * 0.15;
  }
  const hiss = ctx.createBufferSource();
  hiss.buffer = hb;
  hiss.loop = true;
  const hissG = ctx.createGain();
  hissG.gain.value = 0;
  const hissF = ctx.createBiquadFilter();
  hissF.type = 'bandpass';
  hissF.frequency.value = 2500;
  hiss.connect(hissF).connect(hissG).connect(glue);
  hiss.start();

  return {
    input,
    output,
    set(muffle, radio, t = 0, tc = 0.08) {
      const now = ctx.currentTime + t;
      lpf.frequency.setTargetAtTime(muffleHz(muffle, ctx.sampleRate), now, tc);
      // Equal-power crossfade between hi-fi and radio speaker; radio is a bit quieter.
      dry.gain.setTargetAtTime(Math.cos(radio * Math.PI * 0.5), now, tc);
      wet.gain.setTargetAtTime(Math.sin(radio * Math.PI * 0.5) * 0.55, now, tc);
      hissG.gain.setTargetAtTime(radio * 0.012, now, tc);
    },
  };
}

class Music {
  constructor() {
    this.current = null;
    this.muffle = 0;
    this.radio = 0;
    this._chain = null;
    this._voice = null; // { id, sched, gain, send }
  }

  get section() {
    return this._voice?.sched.track.section ?? '';
  }

  _ensure() {
    if (!audio.ctx) audio.unlock(); // creates the context synchronously (resumes on a gesture)
    if (!this._chain) {
      this._chain = buildChain(audio.ctx);
      this._chain.output.connect(audio.buses.music);
      this._chain.set(this.muffle, this.radio);
    }
    return audio.ctx;
  }

  /** Crossfade to track `id`. Re-playing the current track only adjusts its gain. */
  play(id, { fade = 2, gain = 1, radio } = {}) {
    const make = TRACKS[id];
    if (!make) return console.warn('[music] unknown track', id);
    const ctx = this._ensure();
    const t = ctx.currentTime;
    if (this.current === id && this._voice) {
      this._voice.gain.gain.setTargetAtTime(gain * 0.6, t, fade / 3 + 0.01);
      return;
    }
    this.stop({ fade });
    const track = make();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain * 0.6, t + Math.max(0.05, fade));
    g.connect(this._chain.input);
    // Room reverb send (diegetic music lives in the space).
    let send = null;
    if (audio.reverbSend) {
      send = ctx.createGain();
      send.gain.value = track.reverb;
      g.connect(send).connect(audio.reverbSend);
    }
    const sched = new Scheduler(ctx, g, track);
    sched.start(t + 0.08);
    this.prewarm(id, 40);
    this._voice = { id, sched, gain: g, send };
    this.current = id;
    this.setRadioFX(radio ?? track.radio);
  }

  stop({ fade = 2 } = {}) {
    const v = this._voice;
    if (!v) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.03, fade));
    clearInterval(v.sched.timer); // no new bars; queued notes die under the fade
    setTimeout(() => {
      v.sched.stop();
      v.gain.disconnect();
      v.send?.disconnect();
    }, (fade + 0.2) * 1000);
    this._voice = null;
    this.current = null;
  }

  /**
   * Pre-render the note buffers a track will need (simulates `bars` bars of a fresh pass) in
   * idle slices, so the scheduler never synthesises on a busy frame. Call on loading screens;
   * play() also starts it for the chosen track. Resolves when done.
   */
  prewarm(ids = TRACK_IDS, bars = 48) {
    const ctx = this._ensure();
    const jobs = [];
    for (const id of [].concat(ids)) {
      const tr = TRACKS[id]?.();
      if (!tr) continue;
      const spb = 60 / tr.bpm;
      for (let b = 0; b < bars; b++) for (const e of tr.nextBar().events) jobs.push([e.inst, e.midi, e.vel, e.dur * spb]);
    }
    const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 30));
    return new Promise((resolve) => {
      const work = (dl) => {
        while (jobs.length && dl.timeRemaining() > 4) noteBuffer(ctx, ...jobs.pop());
        if (jobs.length) idle(work);
        else resolve();
      };
      idle(work);
    });
  }

  setMuffle(m) {
    this.muffle = clamp01(m);
    this._chain?.set(this.muffle, this.radio);
  }

  setRadioFX(r) {
    this.radio = clamp01(r);
    this._chain?.set(this.muffle, this.radio);
  }

  /** Offline render of `seconds` of track `id` (fresh generative pass) through the full chain. */
  async render(id, seconds = 20, { sampleRate = 44100, muffle = 0, radio, solo } = {}) {
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
    const track = TRACKS[id]();
    // solo: ['bass', ...] renders a stem (dev diagnostics).
    if (solo) track.mix = Object.fromEntries(Object.entries(track.mix).map(([k, v]) => [k, solo.includes(k) ? v : 0]));
    const chain = buildChain(ctx);
    chain.output.connect(ctx.destination);
    chain.set(muffle, radio ?? track.radio, 0, 0.001);
    const g = ctx.createGain();
    g.gain.value = 0.6;
    g.connect(chain.input);
    const sched = new Scheduler(ctx, g, track);
    sched.barTime = 0.05;
    sched.pump(seconds);
    return ctx.startRendering();
  }
}

export const music = new Music();
export { TRACK_IDS };
