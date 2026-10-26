// Spleeter 2-stem voice separation (Deezer). Fast enough for any PC. Stereo 44.1 kHz in -> vocals out.
// Same recipe as sherpa-onnx: STFT 4096/1024, magnitudes of the lower 1024 bins in 512-frame blocks,
// both stem models -> soft mask (vocals^2 / (vocals^2 + music^2)) -> applied to the complex spectrum.
import { getPlan, fft } from './fft.js';

export const SPL = { nfft: 4096, hop: 1024, F: 1024, T: 512, sr: 44100 };

function hann(n) { const w = new Float64Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); return w; }

export class SpleeterSeparator {
  // runVocals / runMusic: async (Float32Array [2, splits, T, F], dims) => Float32Array same shape
  constructor(runVocals, runMusic) {
    this.rv = runVocals; this.rm = runMusic;
    this.win = hann(SPL.nfft); this.plan = getPlan(SPL.nfft);
  }
  async separate(L, R, { onProgress, shouldStop } = {}) {
    const { nfft, hop, F, T } = SPL, n = L.length, win = this.win, plan = this.plan;
    const frames = Math.ceil((n + nfft) / hop);         // padded at both ends by nfft/2... (we pad nfft at start)
    const pad = nfft;                                   // leading pad so the first samples are fully covered
    const total = pad + n + nfft;
    const at = (x, i) => (i >= pad && i < pad + n) ? x[i - pad] : 0;
    // complex spectra of both channels for all frames (only bins 0..nfft/2 kept)
    const B = nfft / 2 + 1;
    const nF = Math.floor((total - nfft) / hop) + 1;
    const sLr = new Float32Array(nF * B), sLi = new Float32Array(nF * B), sRr = new Float32Array(nF * B), sRi = new Float32Array(nF * B);
    const zr = new Float64Array(nfft), zi = new Float64Array(nfft), or = new Float64Array(nfft), oi = new Float64Array(nfft);
    for (let t = 0; t < nF; t++) {
      const s = t * hop;
      for (let i = 0; i < nfft; i++) { zr[i] = at(L, s + i) * win[i]; zi[i] = at(R, s + i) * win[i]; }
      fft(plan, zr, zi, or, oi);
      for (let f = 0; f < B; f++) {
        const g = f === 0 ? 0 : nfft - f, o = t * B + f;
        sLr[o] = (or[f] + or[g]) / 2; sLi[o] = (oi[f] - oi[g]) / 2;
        sRr[o] = (oi[f] + oi[g]) / 2; sRi[o] = -(or[f] - or[g]) / 2;
      }
    }
    // model input: magnitudes [2, splits, T, F]
    const splits = Math.ceil(nF / T);
    const inp = new Float32Array(2 * splits * T * F);
    for (let t = 0; t < nF; t++) {
      const sp = Math.floor(t / T), tt = t % T;
      for (let f = 0; f < F; f++) {
        const o = t * B + f;
        inp[((0 * splits + sp) * T + tt) * F + f] = Math.hypot(sLr[o], sLi[o]);
        inp[((1 * splits + sp) * T + tt) * F + f] = Math.hypot(sRr[o], sRi[o]);
      }
    }
    if (shouldStop?.()) throw new Error('stopped');
    const dims = [2, splits, T, F];
    const v = await this.rv(inp, dims);
    onProgress?.(0.4);
    const m = await this.rm(inp, dims);
    onProgress?.(0.7);
    // vocals = mask * spectrum; iSTFT with window-squared normalization
    const yL = new Float64Array(total), yR = new Float64Array(total), ws = new Float64Array(total);
    const eps = 1e-10;
    for (let t = 0; t < nF; t++) {
      const sp = Math.floor(t / T), tt = t % T;
      zr.fill(0); zi.fill(0);
      for (let f = 0; f < F; f++) {
        const iL = ((0 * splits + sp) * T + tt) * F + f, iR = ((1 * splits + sp) * T + tt) * F + f;
        const mL = (v[iL] * v[iL] + eps / 2) / (v[iL] * v[iL] + m[iL] * m[iL] + eps);
        const mR = (v[iR] * v[iR] + eps / 2) / (v[iR] * v[iR] + m[iR] * m[iR] + eps);
        const o = t * B + f;
        const lr = sLr[o] * mL, li = sLi[o] * mL, rr = sRr[o] * mR, ri = sRi[o] * mR;
        zr[f] = lr - ri; zi[f] = li + rr;
        if (f > 0) { zr[nfft - f] = lr + ri; zi[nfft - f] = rr - li; }
      }
      fft(plan, zr, zi, or, oi, true);
      const s = t * hop;
      for (let i = 0; i < nfft; i++) { const w = win[i]; yL[s + i] += or[i] / nfft * w; yR[s + i] += oi[i] / nfft * w; ws[s + i] += w * w; }
    }
    const outL = new Float32Array(n), outR = new Float32Array(n);
    for (let i = 0; i < n; i++) { const w = ws[i + pad]; if (w > 1e-8) { outL[i] = yL[i + pad] / w; outR[i] = yR[i + pad] / w; } }
    onProgress?.(1);
    return { L: outL, R: outR };
  }
}
