// Silero VAD v5 (16 kHz, 512-sample windows + 64-sample context). `ort` = onnxruntime module.
export class SileroVAD {
  constructor(ort, session) { this.ort = ort; this.s = session; this.reset(); }
  reset() { this.state = new Float32Array(256); this.ctx = new Float32Array(64); }
  async prob(win) {
    const x = new Float32Array(576); x.set(this.ctx, 0); x.set(win, 64);
    const ort = this.ort;
    const out = await this.s.run({
      input: new ort.Tensor('float32', x, [1, 576]),
      state: new ort.Tensor('float32', this.state, [2, 1, 128]),
      sr: new ort.Tensor('int64', BigInt64Array.from([16000n]), []),
    });
    this.state = new Float32Array(out.stateN.data);
    this.ctx = win.slice(512 - 64);
    return out.output.data[0];
  }
  async probs(audio, onProgress) {
    this.reset();
    const n = Math.floor(audio.length / 512), p = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i] = await this.prob(audio.subarray(i * 512, i * 512 + 512));
      if (onProgress && (i & 1023) === 0) onProgress(i / n);
    }
    return p;
  }
}

export const VAD_HOP = 512 / 16000;

// Per-window speech probabilities -> speech lines [start, end] in seconds.
// A line ends at a pause >= minSilence. Lines longer than maxLen are split at their quietest moment.
export function segmentsFromProbs(p, { on = 0.5, off = 0.35, minSpeech = 0.3, minSilence = 0.35, pad = 0.1, maxLen = 12, offset = 0 } = {}) {
  const hop = VAD_HOP, segs = [];
  let start = -1, last = -1;
  for (let i = 0; i < p.length; i++) {
    const t = i * hop;
    if (start < 0) { if (p[i] >= on) { start = t; last = t; } continue; }
    if (p[i] >= off) last = t;
    else if (t - last >= minSilence) { segs.push([start, last + hop]); start = -1; }
  }
  if (start >= 0) segs.push([start, last + hop]);
  const out = [];
  const split = (a, b) => {
    if (b - a <= maxLen) { out.push([a, b]); return; }
    const i0 = Math.floor((a + (b - a) * 0.25) / hop), i1 = Math.floor((a + (b - a) * 0.75) / hop);
    let best = i0;
    for (let i = i0; i <= i1; i++) if (p[i] < p[best]) best = i;
    split(a, best * hop); split(best * hop + hop, b);
  };
  for (const [a, b] of segs) if (b - a >= minSpeech) split(a, b);
  const end = p.length * hop;
  return out.map(([a, b]) => [offset + Math.max(0, a - pad), offset + Math.min(end, b + pad)]);
}
