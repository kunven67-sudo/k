// Mixed-radix complex FFT for any length (fast when the length factors into 2, 3, 4, 5).
// Plans (twiddles + digit-reversal order) are cached per size.
const plans = new Map();

function factorize(n) {
  const f = [];
  for (const p of [4, 2, 3, 5]) while (n % p === 0) { f.push(p); n /= p; }
  for (let p = 7; n > 1; p += 2) while (n % p === 0) { f.push(p); n /= p; }
  return f;
}

export function getPlan(n) {
  let p = plans.get(n);
  if (p) return p;
  const factors = factorize(n);
  const cos = new Float64Array(n), sin = new Float64Array(n);
  for (let k = 0; k < n; k++) { cos[k] = Math.cos(2 * Math.PI * k / n); sin[k] = -Math.sin(2 * Math.PI * k / n); }
  // input order produced by the decimation-in-time recursion
  const perm = new Int32Array(n);
  let w = 0;
  (function rec(len, fi, off, stride) {
    if (len === 1) { perm[w++] = off; return; }
    const r = factors[fi];
    for (let s = 0; s < r; s++) rec(len / r, fi + 1, off + s * stride, stride * r);
  })(n, 0, 0, 1);
  const stages = [];
  let size = 1;
  for (let i = factors.length - 1; i >= 0; i--) { const r = factors[i]; stages.push({ r, M: size, N: size * r }); size *= r; }
  p = { n, cos, sin, perm, stages, xr: new Float64Array(n), xi: new Float64Array(n), yr: new Float64Array(n), yi: new Float64Array(n), tr: new Float64Array(16), ti: new Float64Array(16) };
  plans.set(n, p);
  return p;
}

// Complex FFT. inverse=true uses conjugate twiddles and does NOT divide by n.
// re/im are read, outRe/outIm are written (they may be the same arrays as the inputs).
export function fft(p, re, im, outRe, outIm, inverse = false) {
  const n = p.n, cos = p.cos, sin = p.sin, sg = inverse ? -1 : 1, perm = p.perm;
  let xr = p.xr, xi = p.xi, yr = p.yr, yi = p.yi;
  for (let i = 0; i < n; i++) { const j = perm[i]; xr[i] = re[j]; xi[i] = im ? im[j] : 0; }
  let tr = p.tr, ti = p.ti;
  for (const { r, M, N } of p.stages) {
    if (tr.length < r) { tr = p.tr = new Float64Array(r); ti = p.ti = new Float64Array(r); }
    const tws = n / N;
    for (let base = 0; base < n; base += N) {
      for (let k = 0; k < M; k++) {
        const kt = k * tws;
        for (let s = 0; s < r; s++) {
          const idx = base + s * M + k, t = s * kt; // s*k < N so t < n
          const c = cos[t], d = sg * sin[t], a = xr[idx], b = xi[idx];
          tr[s] = a * c - b * d; ti[s] = a * d + b * c;
        }
        const o = base + k;
        if (r === 4) {
          const ar = tr[0] + tr[2], ai = ti[0] + ti[2], br = tr[0] - tr[2], bi = ti[0] - ti[2];
          const cr = tr[1] + tr[3], ci = ti[1] + ti[3], dr = tr[1] - tr[3], di = ti[1] - ti[3];
          const er = sg * di, ei = -sg * dr;
          yr[o] = ar + cr; yi[o] = ai + ci;
          yr[o + M] = br + er; yi[o + M] = bi + ei;
          yr[o + 2 * M] = ar - cr; yi[o + 2 * M] = ai - ci;
          yr[o + 3 * M] = br - er; yi[o + 3 * M] = bi - ei;
        } else if (r === 2) {
          yr[o] = tr[0] + tr[1]; yi[o] = ti[0] + ti[1];
          yr[o + M] = tr[0] - tr[1]; yi[o + M] = ti[0] - ti[1];
        } else {
          const tq = n / r;
          for (let q = 0; q < r; q++) {
            let sr = 0, si = 0;
            for (let s = 0; s < r; s++) {
              const t = (s * q * tq) % n, c = cos[t], d = sg * sin[t];
              sr += tr[s] * c - ti[s] * d; si += tr[s] * d + ti[s] * c;
            }
            yr[o + q * M] = sr; yi[o + q * M] = si;
          }
        }
      }
    }
    let t = xr; xr = yr; yr = t; t = xi; xi = yi; yi = t;
  }
  for (let i = 0; i < n; i++) { outRe[i] = xr[i]; outIm[i] = xi[i]; }
}
