// AudioWorklet: taps the captured sound (16 kHz mono copies go to the voice finder) and plays it back
// a little later with the voices cut out while someone is talking (music + effects stay).
class Biquad {
  constructor(type, f, sr, q = 0.707) {
    const w = 2 * Math.PI * f / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2; const a0 = 1 + a;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  step(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
class Tap extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const o = opts.processorOptions || {};
    this.delay = Math.round((o.delay ?? 0.3) * sampleRate);
    this.size = this.delay + 4096;
    this.bl = new Float32Array(this.size); this.br = new Float32Array(this.size); this.w = 0;
    this.passthrough = o.passthrough !== false;  // false when the source keeps playing by itself (window/screen)
    this.cutDepth = o.cutDepth ?? 0.06;         // how much of the voice band is left while someone talks
    this.cuts = [];                               // [start, end] in input frame time (seconds), end may be Infinity
    this.uncuts = [];                             // stretches where the real voice comes back (screams, English lines)
    this.mutes = [];                              // stretches played by someone else (clean cut pieces in the synced window)
    this.gain = 1; this.target = 1; this.mg = 1;
    // full-quality stereo copies (synced window cleans them with the voice remover)
    this.full = !!o.full; this.small = o.small !== false; this.fL = new Float32Array(8192); this.fR = new Float32Array(8192); this.nF = 0;
    this.lp = new Biquad('lp', 180, sampleRate); this.hp = new Biquad('hp', 6500, sampleRate);
    // 16 kHz decimation (box filter + linear resample is fine for speech detection)
    this.step = sampleRate / 16000; this.acc = 0; this.out16 = new Float32Array(1600); this.n16 = 0;
    this.aa = new Biquad('lp', 7000, sampleRate);
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.cut) this.cuts.push(m.cut);
      if (m.endCut !== undefined) { const c = this.cuts.at(-1); if (c && c[1] === Infinity) c[1] = m.endCut; }
      if (m.passthrough !== undefined) this.passthrough = m.passthrough;
      if (m.cutDepth !== undefined) this.cutDepth = m.cutDepth;
      if (m.uncut) this.uncuts.push(m.uncut);
      if (m.mute) this.mutes.push(m.mute);
      if (m.clear) { this.cuts = []; this.uncuts = []; this.mutes = []; }
    };
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    const L = inp[0], R = inp[1] || inp[0];
    const n = out[0].length;
    const tIn = currentFrame / sampleRate;            // time of this block at the input
    const tOut = tIn - this.delay / sampleRate;       // time of what we play now
    // is the delayed audio inside a cut (someone talking)?
    const inside = (list) => { for (const c of list) if (tOut >= c[0] && tOut <= c[1]) return true; return false; };
    const cutting = inside(this.cuts) && !inside(this.uncuts), muted = inside(this.mutes);
    if (this.cuts.length > 50) this.cuts = this.cuts.filter(c => c[1] > tOut - 2);
    if (this.uncuts.length > 50) this.uncuts = this.uncuts.filter(c => c[1] > tOut - 2);
    if (this.mutes.length > 50) this.mutes = this.mutes.filter(c => c[1] > tOut - 2);
    this.target = cutting ? this.cutDepth : 1;
    const mTarget = muted ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const l = L ? L[i] : 0, r = R ? R[i] : 0;
      this.bl[this.w] = l; this.br[this.w] = r;
      if (this.full) { this.fL[this.nF] = l; this.fR[this.nF] = r; if (++this.nF === this.fL.length) { this.port.postMessage({ L: this.fL.slice(), R: this.fR.slice(), tEnd: (currentFrame + i + 1) / sampleRate }); this.nF = 0; } }
      // 16 kHz mono copy for the voice finder
      const m = this.small ? this.aa.step((l + r) * 0.5) : 0;
      this.acc += this.small ? 1 : 0;
      if (this.acc >= this.step) { this.acc -= this.step; this.out16[this.n16++] = m; if (this.n16 === this.out16.length) { this.port.postMessage({ pcm: this.out16.slice(), t: (currentFrame + i) / sampleRate }); this.n16 = 0; } }
      // delayed playback with the voice band cut out while someone talks
      const k = (this.w - this.delay + this.size) % this.size;
      const dl = this.bl[k], dr = this.br[k];
      this.gain += (this.target - this.gain) * 0.002;
      this.mg += (mTarget - this.mg) * 0.004;
      const mid = (dl + dr) * 0.5, side = (dl - dr) * 0.5;
      const keep = this.lp.step(mid) + this.hp.step(mid);         // bass + cymbals of the middle
      const midOut = keep + (mid - keep) * this.gain;              // voice band scaled down while talking
      if (this.passthrough) { out[0][i] = (midOut + side) * this.mg; if (out[1]) out[1][i] = (midOut - side) * this.mg; }
      else { out[0][i] = 0; if (out[1]) out[1][i] = 0; }
      this.w = (this.w + 1) % this.size;
    }
    return true;
  }
}
registerProcessor('subdub-tap', Tap);
