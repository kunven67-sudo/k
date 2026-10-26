// MDX-Net vocal separation (UVR "Kim_Vocal_2"): stereo 44.1 kHz in -> vocals out.
// The model sees a [4, 3072, 256] spectrogram chunk (L re, L im, R re, R im) and returns the vocal part.
// Background = mix - vocals. Both channels share one complex FFT per frame (L + iR trick).
import { getPlan, fft } from './fft.js';

export const MDX_CFG = { nfft: 7680, hop: 1024, dimF: 3072, dimT: 256, compensate: 1.009, sr: 44100 };

function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
  return w;
}

export class MdxSeparator {
  // run: async (Float32Array input, dims) => Float32Array output (same layout)
  constructor(run, cfg = MDX_CFG) {
    this.run = run; this.cfg = cfg;
    const { nfft, hop, dimT } = cfg;
    this.win = hann(nfft); this.plan = getPlan(nfft);
    this.chunk = hop * (dimT - 1); this.trim = nfft / 2; this.gen = this.chunk - 2 * this.trim;
    this.zr = new Float64Array(nfft); this.zi = new Float64Array(nfft);
    this.or = new Float64Array(nfft); this.oi = new Float64Array(nfft);
  }
  // Spectrogram of both channels of a chunk (length this.chunk) into the model input buffer
  _stft(L, R, inp) {
    const { nfft, hop, dimF, dimT } = this.cfg, half = nfft / 2, len = L.length, FT = dimF * dimT;
    const { win, plan, zr, zi, or, oi } = this;
    for (let t = 0; t < dimT; t++) {
      const start = t * hop - half;
      for (let i = 0; i < nfft; i++) {
        let j = start + i;
        if (j < 0) j = -j; else if (j >= len) j = 2 * len - 2 - j; // reflect padding (center=True)
        zr[i] = L[j] * win[i]; zi[i] = R[j] * win[i];
      }
      fft(plan, zr, zi, or, oi);
      for (let f = 0; f < dimF; f++) {
        const g = f === 0 ? 0 : nfft - f;
        const o = f * dimT + t;
        inp[o] = (or[f] + or[g]) / 2;              // L re
        inp[FT + o] = (oi[f] - oi[g]) / 2;         // L im
        inp[2 * FT + o] = (oi[f] + oi[g]) / 2;     // R re
        inp[3 * FT + o] = -(or[f] - or[g]) / 2;    // R im
      }
    }
  }
  // Inverse STFT of the model output -> two channels of length this.chunk (overlap-add, window-squared normalized)
  _istft(spec) {
    const { nfft, hop, dimF, dimT } = this.cfg, half = nfft / 2, FT = dimF * dimT, len = this.chunk;
    const { win, plan, zr, zi, or, oi } = this;
    const yl = new Float64Array(len + nfft), yr = new Float64Array(len + nfft), ws = new Float64Array(len + nfft);
    for (let t = 0; t < dimT; t++) {
      zr.fill(0); zi.fill(0);
      for (let f = 0; f < dimF; f++) {
        const o = f * dimT + t;
        const lr = spec[o], li = spec[FT + o], rr = spec[2 * FT + o], ri = spec[3 * FT + o];
        zr[f] = lr - ri; zi[f] = li + rr;
        if (f > 0) { zr[nfft - f] = lr + ri; zi[nfft - f] = rr - li; }
      }
      fft(plan, zr, zi, or, oi, true);
      const s = t * hop;
      for (let i = 0; i < nfft; i++) {
        const w = win[i];
        yl[s + i] += or[i] / nfft * w; yr[s + i] += oi[i] / nfft * w; ws[s + i] += w * w;
      }
    }
    const L = new Float32Array(len), R = new Float32Array(len);
    for (let i = 0; i < len; i++) { const w = ws[i + half]; if (w > 1e-8) { L[i] = yl[i + half] / w; R[i] = yr[i + half] / w; } }
    return [L, R];
  }
  // Separate whole buffers. Returns vocals {L, R}. onProgress(0..1); shouldStop() can abort between chunks.
  async separate(L, R, { onProgress, shouldStop } = {}) {
    const { dimF, dimT, compensate } = this.cfg, { chunk, trim, gen } = this;
    const n = L.length;
    const total = trim + n + (gen - (n % gen)) + trim;
    const pL = new Float32Array(total), pR = new Float32Array(total);
    pL.set(L, trim); pR.set(R, trim);
    const vL = new Float32Array(n), vR = new Float32Array(n);
    const inp = new Float32Array(4 * dimF * dimT);
    for (let i = 0; i + chunk <= total; i += gen) {
      if (shouldStop?.()) throw new Error('stopped');
      this._stft(pL.subarray(i, i + chunk), pR.subarray(i, i + chunk), inp);
      const out = await this.run(inp, [1, 4, dimF, dimT]);
      const [yl, yr] = this._istft(out);
      for (let j = 0; j < gen; j++) {
        const o = i + j; if (o >= n) break;
        vL[o] = yl[trim + j] * compensate; vR[o] = yr[trim + j] * compensate;
      }
      onProgress?.(Math.min(1, (i + gen) / n));
    }
    return { L: vL, R: vR };
  }
}
