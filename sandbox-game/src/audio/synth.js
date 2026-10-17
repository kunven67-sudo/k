// Generated sound effects, rendered once into AudioBuffers at startup.
// Stand-ins until real CC0 recordings can be downloaded (assets/sounds/*.ogg override these).

let SR = 44100;
const rnd = (a, b) => a + Math.random() * (b - a);

function buf(ctx, seconds, fill) {
  const n = Math.max(1, Math.floor(seconds * SR));
  const b = ctx.createBuffer(2, n, SR);
  const L = b.getChannelData(0), R = b.getChannelData(1);
  fill(L, R, n);
  normalize(L, R);
  return b;
}

function normalize(L, R, peak = 0.95) {
  let m = 0;
  for (let i = 0; i < L.length; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
  if (m < 1e-6) return;
  const k = peak / m;
  for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
}

// One-pole lowpass state helper
function lp(alpha) { let y = 0; return (x) => (y += alpha * (x - y)); }
const alphaFor = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / SR);

// Damped resonator (for wood knocks / metal modes)
function resonator(freq, decay) {
  const w = 2 * Math.PI * freq / SR, r = Math.exp(-1 / (decay * SR));
  const a1 = 2 * r * Math.cos(w), a2 = -r * r;
  let y1 = 0, y2 = 0;
  return (x) => { const y = x + a1 * y1 + a2 * y2; y2 = y1; y1 = y; return y; };
}

export function explosion(ctx, big = 1) {
  const len = 2.5 + big * 1.8;
  return buf(ctx, len, (L, R, n) => {
    const lowL = lp(alphaFor(900)), lowR = lp(alphaFor(900));
    const sub = lp(alphaFor(120));
    let rumbleL = 0, rumbleR = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const att = Math.min(1, t / 0.004);
      const env = att * Math.exp(-t * (4.5 / big)) ;
      const tail = Math.exp(-t * (1.1 / big));
      const cutoff = 3000 * Math.exp(-t * 6) + 180;
      const a = alphaFor(cutoff);
      rumbleL += a * (Math.random() * 2 - 1 - rumbleL);
      rumbleR += a * (Math.random() * 2 - 1 - rumbleR);
      const thump = Math.sin(2 * Math.PI * (55 * t - 20 * t * t)) * Math.exp(-t * 7) * 1.4;
      const crackle = Math.random() < 0.002 * tail ? rnd(-1, 1) * tail : 0;
      const s = sub(Math.random() * 2 - 1) * 3 * tail;
      L[i] = (lowL(rumbleL) * 2.2 + rumbleL * 0.6) * env + s * 0.6 + thump * env + crackle * 0.5;
      R[i] = (lowR(rumbleR) * 2.2 + rumbleR * 0.6) * env + s * 0.6 + thump * env + crackle * 0.5;
      // long rolling tail
      L[i] += rumbleL * tail * 0.35; R[i] += rumbleR * tail * 0.35;
    }
  });
}

export function noiseBurst(ctx, len, hz, decay, q = 0) {
  return buf(ctx, len, (L, R, n) => {
    const f1 = lp(alphaFor(hz)), f2 = lp(alphaFor(hz));
    for (let i = 0; i < n; i++) {
      const t = i / SR, e = Math.min(1, t / 0.002) * Math.exp(-t * decay);
      const x = Math.random() * 2 - 1;
      L[i] = (q ? x - f1(x) : f1(x)) * e;
      R[i] = (q ? x - f2(x) : f2(x)) * e;
    }
  });
}

export function woodKnock(ctx) {
  const f = rnd(180, 320);
  return buf(ctx, 0.35, (L, R, n) => {
    const r1 = resonator(f, 0.05), r2 = resonator(f * 2.7, 0.025), r3 = resonator(f * 5.1, 0.012), nl = lp(alphaFor(2500));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const ex = (Math.random() * 2 - 1) * Math.exp(-t * 400);
      const y = r1(ex) * 0.6 + r2(ex) * 0.3 + r3(ex) * 0.15 + nl(ex) * 2;
      L[i] = y; R[i] = y;
    }
  });
}

export function metalClang(ctx, light = false) {
  const base = light ? rnd(600, 1100) : rnd(160, 320);
  const modes = [1, 2.76, 5.4, 8.93, 13.3].map((m) => m * base * rnd(0.97, 1.03));
  return buf(ctx, light ? 0.8 : 2.0, (L, R, n) => {
    const res = modes.map((m, k) => resonator(m, (light ? 0.25 : 0.9) / (1 + k * 0.6)));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const ex = (Math.random() * 2 - 1) * Math.exp(-t * 900);
      let y = 0;
      res.forEach((r, k) => { y += r(ex) * (1 / (1 + k)); });
      L[i] = y * (1 + 0.05 * Math.sin(t * 7)); R[i] = y * (1 - 0.05 * Math.sin(t * 7));
    }
  });
}

export function glassShatter(ctx, tempered = false) {
  return buf(ctx, tempered ? 1.6 : 1.2, (L, R, n) => {
    const tinks = [];
    const count = tempered ? 220 : 90;
    for (let k = 0; k < count; k++) tinks.push({ t0: Math.pow(Math.random(), 2.2) * (tempered ? 1.2 : 0.9), f: rnd(2200, 7500), d: rnd(0.02, 0.09), pan: Math.random(), a: rnd(0.2, 1) });
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let l = 0, r = 0;
      const crash = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.7;
      for (const k of tinks) {
        const dt = t - k.t0;
        if (dt < 0 || dt > k.d * 6) continue;
        const v = Math.sin(2 * Math.PI * k.f * dt) * Math.exp(-dt / k.d) * k.a;
        l += v * (1 - k.pan); r += v * k.pan;
      }
      L[i] = l * 0.5 + crash; R[i] = r * 0.5 + crash;
    }
  });
}

export function concreteCrunch(ctx) {
  return buf(ctx, 0.9, (L, R, n) => {
    const f = lp(alphaFor(700)), g = lp(alphaFor(700)), body = resonator(rnd(70, 110), 0.08);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const grit = (Math.random() < 0.05 ? rnd(-1, 1) : 0) * Math.exp(-t * 5);
      const x = (Math.random() * 2 - 1) * Math.exp(-t * 9);
      const b = body((Math.random() * 2 - 1) * Math.exp(-t * 200)) * 0.4;
      L[i] = f(x) * 1.5 + grit * 0.4 + b; R[i] = g(x) * 1.5 + grit * 0.4 + b;
    }
  });
}

export function thud(ctx, hz = 90, len = 0.4) {
  return buf(ctx, len, (L, R, n) => {
    const r = resonator(hz, 0.06), f = lp(alphaFor(500));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const ex = (Math.random() * 2 - 1) * Math.exp(-t * 250);
      const y = r(ex) * 0.5 + f(ex) * 2;
      L[i] = y; R[i] = y;
    }
  });
}

export function plasticTick(ctx) {
  return buf(ctx, 0.15, (L, R, n) => {
    const r = resonator(rnd(900, 1500), 0.012);
    for (let i = 0; i < n; i++) { const t = i / SR; const y = r((Math.random() * 2 - 1) * Math.exp(-t * 900)) + (Math.random() * 2 - 1) * Math.exp(-t * 300) * 0.3; L[i] = y; R[i] = y; }
  });
}

export function footstep(ctx, surface = 'concrete') {
  const hz = surface === 'metal' ? 1800 : surface === 'wood' ? 900 : 1300;
  return buf(ctx, 0.22, (L, R, n) => {
    const f = lp(alphaFor(hz)), r = resonator(surface === 'metal' ? rnd(400, 700) : surface === 'wood' ? rnd(120, 180) : rnd(80, 120), surface === 'metal' ? 0.08 : 0.03);
    const heel = rnd(0.012, 0.02);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = Math.exp(-t * 60) + (t > heel ? Math.exp(-(t - heel) * 45) * 0.7 : 0);
      const x = (Math.random() * 2 - 1) * e;
      const y = f(x) * 1.6 + r(x * 0.2) * 0.5 + (Math.random() < 0.02 ? rnd(-0.2, 0.2) * e : 0);
      L[i] = y; R[i] = y;
    }
  });
}

export function whoosh(ctx, len = 1.2) {
  return buf(ctx, len, (L, R, n) => {
    let y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = t / len;
      const env = Math.sin(Math.PI * Math.min(1, p * 1.2)) ** 2;
      const a = alphaFor(400 + 3000 * Math.exp(-p * 3));
      y1 += a * (Math.random() * 2 - 1 - y1); y2 += a * (Math.random() * 2 - 1 - y2);
      L[i] = y1 * env; R[i] = y2 * env;
    }
  });
}

export function rpgLaunch(ctx) {
  return buf(ctx, 1.6, (L, R, n) => {
    const f = lp(alphaFor(1800));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const bang = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 1.4;
      const roar = (Math.random() * 2 - 1) * Math.exp(-t * 2.2) * (t > 0.08 ? 1 : 0);
      const thump = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 18);
      const y = f(bang + roar * 0.8) + thump * 0.8 + bang * 0.3;
      L[i] = y; R[i] = y * 0.95;
    }
  });
}

export function click(ctx, hz = 2200, len = 0.05) {
  return buf(ctx, len, (L, R, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const y = Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * 120) + (Math.random() * 2 - 1) * Math.exp(-t * 600) * 0.5; L[i] = y; R[i] = y; } });
}

export function beep(ctx, hz = 2800, len = 0.09) {
  return buf(ctx, len, (L, R, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const y = Math.sin(2 * Math.PI * hz * t) * Math.min(1, t / 0.004, (len - t) / 0.01); L[i] = y; R[i] = y; } });
}

// Seamless loops (fade-crossed ends)
export function noiseLoop(ctx, len, hz, highpass = false) {
  const b = buf(ctx, len, (L, R, n) => {
    const f1 = lp(alphaFor(hz)), f2 = lp(alphaFor(hz));
    for (let i = 0; i < n; i++) { const x1 = Math.random() * 2 - 1, x2 = Math.random() * 2 - 1; L[i] = highpass ? x1 - f1(x1) : f1(x1); R[i] = highpass ? x2 - f2(x2) : f2(x2); }
    const fade = Math.floor(0.2 * SR);
    for (let i = 0; i < fade; i++) { const k = i / fade; L[i] = L[i] * k + L[n - fade + i] * (1 - k); R[i] = R[i] * k + R[n - fade + i] * (1 - k); }
  });
  return b;
}

export function wind(ctx) {
  return buf(ctx, 12, (L, R, n) => {
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const gust = 0.55 + 0.45 * Math.sin(t * 0.7 * Math.PI * 2 / 12 * 2) * Math.sin(t * 0.31 + 1);
      const cut = alphaFor(250 + 500 * gust);
      a += cut * (Math.random() * 2 - 1 - a); b += cut * (Math.random() * 2 - 1 - b);
      L[i] = a * gust; R[i] = b * gust;
    }
    const fade = Math.floor(0.5 * SR);
    for (let i = 0; i < fade; i++) { const k = i / fade; L[i] = L[i] * k + L[n - fade + i] * (1 - k); R[i] = R[i] * k + R[n - fade + i] * (1 - k); }
  });
}

export function birdChirp(ctx) {
  const notes = Math.floor(rnd(2, 6));
  const f0 = rnd(2500, 4200);
  return buf(ctx, notes * 0.16 + 0.1, (L, R, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / SR, k = Math.floor(t / 0.16), tt = t - k * 0.16;
      if (k >= notes || tt > 0.11) { L[i] = R[i] = 0; continue; }
      const f = f0 * (1 + 0.25 * Math.sin(tt * 60)) * (1 - tt * 2);
      const y = Math.sin(2 * Math.PI * f * tt) * Math.sin(Math.PI * tt / 0.11);
      L[i] = y; R[i] = y;
    }
  });
}

export function ringing(ctx) {
  return buf(ctx, 6, (L, R, n) => {
    for (let i = 0; i < n; i++) { const t = i / SR; const e = Math.min(1, t / 0.3) * Math.exp(-t * 0.6); L[i] = Math.sin(2 * Math.PI * 3900 * t) * e; R[i] = Math.sin(2 * Math.PI * 3920 * t) * e; }
  });
}

export function setSampleRate(sr) { SR = sr; }

// ---------------------------------------------------------------- guns
// kind: pistol | rifle | shotgun | sniper
export function gunshot(ctx, kind) {
  const P = {
    pistol:  { len: 0.9, crack: 1.0, body: 220, bodyDecay: 30, tail: 5.5, sub: 0 },
    rifle:   { len: 1.2, crack: 1.4, body: 160, bodyDecay: 22, tail: 4.0, sub: 0.3 },
    shotgun: { len: 1.4, crack: 0.9, body: 95,  bodyDecay: 14, tail: 3.0, sub: 0.8 },
    sniper:  { len: 1.8, crack: 1.6, body: 120, bodyDecay: 16, tail: 2.4, sub: 0.6 },
  }[kind];
  return buf(ctx, P.len, (L, R, n) => {
    const bodyF = lp(alphaFor(P.body * 6)), bodyG = lp(alphaFor(P.body * 6));
    const tailF = lp(alphaFor(1400)), tailG = lp(alphaFor(1400));
    const boom = resonator(P.body, 0.04);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      // supersonic crack: very short broadband transient
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 900) * P.crack;
      const x1 = Math.random() * 2 - 1, x2 = Math.random() * 2 - 1;
      const bodyEnv = Math.exp(-t * P.bodyDecay);
      const tailEnv = Math.exp(-t * P.tail) * Math.min(1, t / 0.01);
      const sub = Math.sin(2 * Math.PI * (60 - 20 * t) * t) * Math.exp(-t * 12) * P.sub;
      const b = boom((Math.random() * 2 - 1) * Math.exp(-t * 400)) * 0.15;
      L[i] = crack + bodyF(x1) * 2.2 * bodyEnv + tailF(x1) * 0.9 * tailEnv + sub + b;
      R[i] = crack * 0.95 + bodyG(x2) * 2.2 * bodyEnv + tailG(x2) * 0.9 * tailEnv + sub + b;
    }
  });
}

// short metallic mechanism noises: mag out/in, slide, pump, bolt
export function mech(ctx, kind) {
  const spec = {
    magOut: [[0, 2600, 0.05], [0.04, 900, 0.08]],
    magIn: [[0, 1800, 0.04], [0.025, 3400, 0.03], [0.05, 700, 0.06]],
    slide: [[0, 2200, 0.06], [0.12, 3000, 0.05]],
    pump: [[0, 1400, 0.09], [0.22, 1900, 0.07]],
    bolt: [[0, 2600, 0.04], [0.15, 1600, 0.06], [0.42, 2200, 0.05], [0.55, 3000, 0.04]],
    dry: [[0, 3800, 0.02]],
    shell: [[0, 1500, 0.05], [0.06, 2400, 0.03]],
    select: [[0, 3200, 0.02]],
  }[kind];
  const len = spec[spec.length - 1][0] + 0.25;
  return buf(ctx, len, (L, R, n) => {
    const ev = spec.map(([t0, f, d]) => ({ t0, r: resonator(f * rnd(0.95, 1.05), d), r2: resonator(f * 2.3, d * 0.5) }));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let y = 0;
      for (const e of ev) {
        const dt = t - e.t0;
        const ex = dt >= 0 && dt < 0.004 ? (Math.random() * 2 - 1) : 0;
        y += e.r(ex) * 0.6 + e.r2(ex) * 0.3;
      }
      L[i] = y; R[i] = y;
    }
  });
}

export function casingTink(ctx) {
  const f = rnd(4200, 6500);
  return buf(ctx, 0.35, (L, R, n) => {
    const r1 = resonator(f, 0.08), r2 = resonator(f * 1.47, 0.05);
    for (let i = 0; i < n; i++) { const t = i / SR; const ex = (Math.random() * 2 - 1) * Math.exp(-t * 3000); const second = t > 0.09 && t < 0.092 ? (Math.random() * 2 - 1) * 0.5 : 0; const y = r1(ex + second) + r2(ex + second) * 0.5; L[i] = y; R[i] = y; }
  });
}

export function ricochet(ctx) {
  const f0 = rnd(2200, 3600);
  return buf(ctx, 0.7, (L, R, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = f0 * (1 - t * 0.9);
      ph += (2 * Math.PI * f) / SR;
      const y = Math.sin(ph + Math.sin(t * 90) * 0.4) * Math.exp(-t * 4) * Math.min(1, t / 0.01) + (Math.random() * 2 - 1) * Math.exp(-t * 300) * 0.6;
      L[i] = y * (1 - t); R[i] = y * (0.4 + t);
    }
  });
}

export function fleshHit(ctx) {
  return buf(ctx, 0.3, (L, R, n) => {
    const f = lp(alphaFor(600)), r = resonator(rnd(70, 110), 0.05);
    for (let i = 0; i < n; i++) { const t = i / SR; const x = (Math.random() * 2 - 1) * Math.exp(-t * 60); const y = f(x) * 2 + r(x * 0.3) * 0.4 + (Math.random() * 2 - 1) * Math.exp(-t * 25) * 0.15; L[i] = y; R[i] = y; }
  });
}

export function heartbeat(ctx) {
  return buf(ctx, 0.9, (L, R, n) => {
    const r = resonator(48, 0.06), r2 = resonator(60, 0.05);
    for (let i = 0; i < n; i++) { const t = i / SR; const ex = (t < 0.01 ? (Math.random() * 2 - 1) : 0) + (t > 0.24 && t < 0.25 ? (Math.random() * 2 - 1) * 0.7 : 0); const y = r(ex) + r2(ex) * 0.6; L[i] = y; R[i] = y; }
  });
}

export function rip(ctx, len = 0.6) {
  return buf(ctx, len, (L, R, n) => {
    const f = lp(alphaFor(3500));
    for (let i = 0; i < n; i++) { const t = i / SR; const crackle = Math.random() < 0.3 ? 1 : 0.2; const y = f((Math.random() * 2 - 1) * crackle) * Math.sin(Math.PI * t / len); L[i] = y; R[i] = y; }
  });
}

export function pills(ctx) {
  return buf(ctx, 0.5, (L, R, n) => {
    const hits = Array.from({ length: 14 }, () => ({ t0: Math.random() * 0.35, r: resonator(rnd(2500, 4500), 0.01) }));
    for (let i = 0; i < n; i++) { const t = i / SR; let y = 0; for (const h of hits) { const dt = t - h.t0; y += h.r(dt >= 0 && dt < 0.002 ? Math.random() * 2 - 1 : 0); } L[i] = y; R[i] = y; }
  });
}

// Simple room impulse response for indoor reverb
export function roomIR(ctx, seconds = 0.7) {
  return buf(ctx, seconds, (L, R, n) => {
    for (let i = 0; i < n; i++) { const t = i / SR; const e = Math.exp(-t * 7); L[i] = (Math.random() * 2 - 1) * e; R[i] = (Math.random() * 2 - 1) * e; }
  });
}
