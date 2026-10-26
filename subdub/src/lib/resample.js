// Windowed-sinc resampler (table driven). Also does pitch shifting: resample(x, sr * ratio, outSr) plays x `ratio` times higher.
const TAB_RES = 256;
const tables = new Map();
function table(halfWidth) {
  let t = tables.get(halfWidth);
  if (t) return t;
  const n = halfWidth * TAB_RES + 2; t = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = i / TAB_RES;
    const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
    const w = d >= halfWidth ? 0 : 0.42 + 0.5 * Math.cos(Math.PI * d / halfWidth) + 0.08 * Math.cos(2 * Math.PI * d / halfWidth); // Blackman
    t[i] = sinc * w;
  }
  tables.set(halfWidth, t);
  return t;
}

export function resample(x, fromSr, toSr, { quality = 12 } = {}) {
  if (Math.abs(fromSr - toSr) < 1e-6) return Float32Array.from(x);
  const ratio = toSr / fromSr, n = Math.max(0, Math.floor(x.length * ratio));
  const y = new Float32Array(n), scale = Math.min(1, ratio) * 0.96;
  const hw = quality, tab = table(hw), reach = Math.ceil(hw / scale), len = x.length;
  for (let i = 0; i < n; i++) {
    const t = i / ratio, c = Math.floor(t);
    let s = 0, ws = 0;
    const j0 = Math.max(0, c - reach + 1), j1 = Math.min(len - 1, c + reach);
    for (let j = j0; j <= j1; j++) {
      const d = Math.abs(t - j) * scale;
      if (d >= hw) continue;
      const f = d * TAB_RES, k = f | 0, w = tab[k] + (tab[k + 1] - tab[k]) * (f - k);
      s += x[j] * w; ws += w;
    }
    y[i] = ws ? s / ws : 0;
  }
  return y;
}

export const semitones = (st) => Math.pow(2, st / 12);

export function rms(x, a = 0, b = x.length) {
  let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, b - a));
}

// short fades on both ends so pasted audio never clicks
export function fadeEdges(x, sr, ms = 12) {
  const n = Math.min(Math.floor(sr * ms / 1000), x.length >> 1);
  for (let i = 0; i < n; i++) { const g = i / n; x[i] *= g; x[x.length - 1 - i] *= g; }
  return x;
}
