// YIN pitch tracker (16 kHz mono). Used to tell high (girl/kid) from low (man) voices and to pick voice tone.
export function yinTrack(x, sr = 16000, { fmin = 60, fmax = 620, win = 640, hop = 160, thresh = 0.15, loose = 0.35 } = {}) {
  const tauMin = Math.floor(sr / fmax), tauMax = Math.ceil(sr / fmin), W = Math.max(win, tauMax + 2);
  const d = new Float32Array(tauMax + 1), f0 = [];
  for (let s = 0; s + W + tauMax < x.length; s += hop) {
    let e = 0;
    for (let i = 0; i < W; i++) e += x[s + i] * x[s + i];
    if (e / W < 1e-5) { f0.push(0); continue; }
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let i = 0; i < W; i++) { const df = x[s + i] - x[s + i + tau]; sum += df * df; }
      d[tau] = sum;
    }
    let run = 0, best = -1; d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = run > 0 ? d[tau] * tau / run : 1; }
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (d[tau] < thresh) { while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++; best = tau; break; }
    }
    if (best < 0) {
      // noisy/old audio: take the deepest dip if it is clear enough (pYIN-style fallback)
      let m = tauMin; for (let tau = tauMin + 1; tau <= tauMax; tau++) if (d[tau] < d[m]) m = tau;
      if (d[m] < loose) {
        // prefer the first dip that is almost as deep (avoids picking a sub-octave)
        for (let tau = tauMin; tau < m; tau++) if (d[tau] < d[m] * 1.15 + 0.02 && d[tau] <= d[tau - 1] && d[tau] <= d[tau + 1]) { m = tau; break; }
        best = m;
      }
    }
    if (best < 0) { f0.push(0); continue; }
    const a = d[best - 1] ?? d[best], b = d[best], c = d[best + 1] ?? d[best], den = a - 2 * b + c;
    f0.push(sr / (den ? best + 0.5 * (a - c) / den : best));
  }
  return f0;
}

export function pitchStats(x, sr = 16000) {
  // cap the work: at most ~6 s of audio
  if (x.length > sr * 6) x = x.subarray(0, sr * 6);
  const f = yinTrack(x, sr).filter(v => v > 0).sort((a, b) => a - b);
  if (f.length < 12) return { median: 0, p10: 0, p90: 0, voiced: f.length }; // too little voiced sound to trust
  const q = p => f[Math.min(f.length - 1, Math.floor(p * f.length))];
  return { median: q(0.5), p10: q(0.1), p90: q(0.9), voiced: f.length };
}
