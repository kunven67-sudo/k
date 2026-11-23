// Builds the whole soundtrack (music + sound effects) for UNKILLABLE from the same timeline as the picture.
// node tools/audio.mjs out.wav
import { writeFileSync } from 'node:fs';
import { DURATION, EVENTS, MOODS } from '../src/anim.js';

const SR = 44100;
const N = Math.ceil((DURATION + 2) * SR);
const music = new Float32Array(N), sfx = new Float32Array(N), duck = new Float32Array(N).fill(1);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---------------- instruments (write into a buffer) ----------------
function env(i, n, a, r) { const ta = a * SR, tr = r * SR; if (i < ta) return i / ta; if (i > n - tr) return Math.max(0, (n - i) / tr); return 1; }
function osc(buf, t, dur, f, o = {}) {
  const s0 = Math.floor(t * SR), n = Math.floor(dur * SR); if (s0 < 0 || s0 >= N) return;
  const type = o.type || 'sine', vol = o.vol ?? 0.2, a = o.a ?? 0.01, r = o.r ?? 0.1, f1 = o.f1 ?? f, lp = o.lp ?? 0, vib = o.vib || 0, dec = o.dec || 0;
  let ph = 0, y = 0; const k = lp ? Math.min(1, 2 * Math.PI * lp / SR) : 1;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const p = i / n, fr = (f + (f1 - f) * (o.expo ? p * p : p)) * (1 + vib * Math.sin(2 * Math.PI * 5.5 * i / SR));
    ph += fr / SR; ph -= Math.floor(ph);
    let v = type === 'sine' ? Math.sin(2 * Math.PI * ph) : type === 'saw' ? 2 * ph - 1 : type === 'square' ? (ph < 0.5 ? 1 : -1) : type === 'tri' ? 1 - 4 * Math.abs(ph - 0.5) : 0;
    if (lp) { y += k * (v - y); v = y; }
    let e = env(i, n, a, r); if (dec) e *= Math.exp(-i / SR / dec);
    buf[s0 + i] += v * e * vol;
  }
}
function noise(buf, t, dur, o = {}) {
  const s0 = Math.floor(t * SR), n = Math.floor(dur * SR); if (s0 < 0 || s0 >= N) return;
  const vol = o.vol ?? 0.2, a = o.a ?? 0.005, r = o.r ?? 0.1, dec = o.dec || 0;
  const lp0 = o.lp ?? 20000, lp1 = o.lp1 ?? lp0, hp = o.hp || 0;
  let y = 0, h = 0, px = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const p = i / n, lp = lp0 + (lp1 - lp0) * p;
    let v = rnd() * 2 - 1;
    const k = Math.min(1, 2 * Math.PI * lp / SR); y += k * (v - y); v = y;
    if (hp) { const kh = Math.min(1, 2 * Math.PI * hp / SR); h += kh * (v - h); v = v - h; }
    let e = env(i, n, a, r); if (dec) e *= Math.exp(-i / SR / dec);
    if (o.am) e *= 0.5 + 0.5 * Math.sin(2 * Math.PI * o.am * i / SR);
    buf[s0 + i] += v * e * vol; px = v;
  }
}
function pluck(buf, t, f, dur, vol = 0.25, bright = 0.5) {
  const s0 = Math.floor(t * SR), n = Math.floor(dur * SR); if (s0 >= N) return;
  const L = Math.max(2, Math.floor(SR / f)); const d = new Float32Array(L);
  for (let i = 0; i < L; i++) d[i] = rnd() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const nx = (idx + 1) % L; const v = d[idx];
    d[idx] = (d[idx] * (0.5 + bright * 0.5) + d[nx] * (0.5 - bright * 0.5)) * 0.996;
    idx = nx; buf[s0 + i] += v * vol * env(i, n, 0.002, 0.05);
  }
}
function bell(buf, t, f, dur = 2, vol = 0.12) {
  const s0 = Math.floor(t * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n && s0 + i < N; i++) { const tt = i / SR, e = Math.exp(-tt * 2.2); buf[s0 + i] += Math.sin(2 * Math.PI * f * tt + 2.2 * e * Math.sin(2 * Math.PI * f * 3.5 * tt)) * e * vol; }
}
function kick(buf, t, vol = 0.6) { osc(buf, t, 0.35, 150, { f1: 42, expo: true, vol, a: 0.001, r: 0.05, dec: 0.12 }); }
function snare(buf, t, vol = 0.3) { noise(buf, t, 0.2, { vol, hp: 900, lp: 8000, dec: 0.06 }); osc(buf, t, 0.12, 190, { vol: vol * 0.6, dec: 0.05 }); }
function hat(buf, t, vol = 0.08) { noise(buf, t, 0.05, { vol, hp: 6000, lp: 16000, dec: 0.015 }); }
function pad(buf, t, dur, notes, vol = 0.05, lp = 900) {
  for (const m of notes) for (const det of [-0.08, 0, 0.09]) osc(buf, t, dur, mtof(m + det), { type: 'saw', vol: vol / 3, a: Math.min(1.2, dur / 3), r: Math.min(1.5, dur / 3), lp });
}

// ---------------- music per mood ----------------
const Am = [57, 60, 64], F = [53, 57, 60], Dm = [50, 53, 57], E = [52, 56, 59], C_ = [48, 52, 55], G = [55, 59, 62], Em = [52, 55, 59];
function section(mood, a, b) {
  const len = b - a;
  if (mood === 'creepy' || mood === 'quiet') {
    osc(music, a, len, 55, { type: 'saw', vol: 0.05, a: 2, r: 2, lp: 160 });
    osc(music, a, len, 82.4, { type: 'saw', vol: 0.025, a: 3, r: 2, lp: 200, vib: 0.003 });
    const prog = [Am, F, Dm, E];
    for (let x = a, k = 0; x < b - 1; x += 6, k++) pad(music, x, Math.min(6.5, b - x), prog[k % 4].map((m) => m + 12), mood === 'quiet' ? 0.035 : 0.045, 700);
    for (let x = a + 1; x < b - 1; x += 1.4 + rnd() * 2.2) { const sc = [69, 72, 74, 76, 79, 81, 84]; bell(music, x, mtof(sc[Math.floor(rnd() * sc.length)]), 2.5, mood === 'quiet' ? 0.06 : 0.045); }
  } else if (mood === 'title') {
    osc(music, a, 3, 40, { type: 'saw', vol: 0.25, lp: 300, dec: 1.5 });
    pad(music, a + 0.5, len - 1, [45, 52, 57, 60], 0.08, 1200);
  } else if (mood === 'sneaky' || mood === 'curious') {
    const bpm = mood === 'sneaky' ? 104 : 88, beat = 60 / bpm;
    const bass = mood === 'sneaky' ? [45, 48, 50, 51, 52, 50, 48, 47] : [45, 52, 48, 55];
    for (let x = a, k = 0; x < b - beat; x += beat, k++) {
      pluck(music, x, mtof(bass[k % bass.length] - 12), beat * 0.9, 0.3, 0.2);
      if (mood === 'sneaky') { if (k % 2) noise(music, x, 0.05, { vol: 0.08, hp: 2000, dec: 0.02 }); if (k % 4 === 3) pluck(music, x + beat / 2, mtof(69 + [0, 3, 7][k % 3]), 0.3, 0.12, 0.8); }
      else { const arp = [69, 72, 76, 79, 76, 72]; for (let j = 0; j < 2; j++) bell(music, x + j * beat / 2, mtof(arp[(k * 2 + j) % arp.length] + 12), 1.2, 0.035); }
    }
    for (let x = a, k = 0; x < b - 1; x += 8, k++) pad(music, x, Math.min(8.5, b - x), [Am, Dm, F, E][k % 4].map((m) => m + 12), 0.022, 1000);
  } else if (mood === 'montage') {
    const beat = 60 / 128; const prog = [C_, G, Am, F];
    for (let x = a, k = 0; x < b - beat; x += beat, k++) {
      kick(music, x, 0.45); if (k % 2) snare(music, x, 0.22); hat(music, x + beat / 2, 0.07); hat(music, x, 0.04);
      const ch = prog[Math.floor(k / 8) % 4];
      osc(music, x, beat * 0.45, mtof(ch[0] - 12), { type: 'saw', vol: 0.09, lp: 600, r: 0.03 });
      osc(music, x + beat / 2, beat * 0.45, mtof(ch[0] - 12), { type: 'saw', vol: 0.07, lp: 600, r: 0.03 });
      const arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12];
      for (let j = 0; j < 2; j++) osc(music, x + j * beat / 2, beat * 0.4, mtof(arp[(k * 2 + j) % 4] + 12), { type: 'square', vol: 0.025, lp: 3000, r: 0.05 });
    }
  } else if (mood === 'news') {
    for (let x = a + 3, k = 0; x < b - 1; x += 4, k++) pad(music, x, 4.2, [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]][k % 4], 0.09, 1500);
    for (let x = a + 3; x < b - 1; x += 0.5) hat(music, x, 0.05);
    for (let x = a + 3, k = 0; x < b - 1; x += 1, k++) pluck(music, x, mtof([48, 45, 41, 43][Math.floor(k / 4) % 4]), 0.9, 0.2, 0.3);
  } else if (mood === 'tense') {
    const step = 60 / 112 / 4;
    for (let x = a, k = 0; x < b - step; x += step, k++) {
      osc(music, x, step * 0.8, mtof(33 + (Math.floor(k / 64) % 2 ? 1 : 0)), { type: 'saw', vol: 0.07, lp: 300, r: 0.02 });
      if (k % 16 === 0) kick(music, x, 0.4); if (k % 16 === 8) osc(music, x, 0.3, 110, { f1: 70, vol: 0.3, dec: 0.15 });
      if (k % 4 === 2) hat(music, x, 0.04);
    }
    for (let x = a, k = 0; x < b - 1; x += 8, k++) pad(music, x, Math.min(8.5, b - x), [[45, 48, 52], [46, 50, 53], [45, 48, 52], [44, 47, 52]][k % 4].map((m) => m + 12), 0.04, 700);
  } else if (mood === 'lab') {
    const step = 60 / 120 / 4; const sc = [57, 60, 64, 67, 69, 72, 76];
    for (let x = a, k = 0; x < b - step; x += step, k++) {
      if (k % 2 === 0) osc(music, x, step * 0.9, mtof(sc[(k * 3 + Math.floor(k / 16)) % sc.length] + 12), { type: 'square', vol: 0.02, lp: 2500, r: 0.02 });
      if (k % 8 === 0) kick(music, x, 0.3); if (k % 8 === 4) hat(music, x, 0.06);
      if (k % 16 === 0) osc(music, x, step * 14, mtof(45 + [0, 3, -2, -4][Math.floor(k / 16) % 4]), { type: 'tri', vol: 0.09, r: 0.2 });
    }
  } else if (mood === 'build') {
    osc(music, a, len, 55, { type: 'saw', vol: 0.05, lp: 200, a: 2 });
    for (let x = a, k = 0; x < b - 0.2; x += 0.25, k++) {
      const p = (x - a) / len;
      if (p < 0.66 || p > 0.8) osc(music, x, 0.2, mtof(45 + Math.floor(p * 12)), { type: 'saw', vol: 0.05 + p * 0.05, lp: 300 + p * 2000, r: 0.03 });
      if (k % 4 === 0 && p < 0.66) kick(music, x, 0.25 + p * 0.3);
    }
    noise(music, a + 5, 20, { vol: 0.06, lp: 300, lp1: 6000, a: 18, r: 0.5 });
    noise(music, a + 33, 15, { vol: 0.06, lp: 300, lp1: 8000, a: 14, r: 0.3 });
  } else if (mood === 'ending') {
    osc(music, a, len, 41.2, { type: 'saw', vol: 0.06, lp: 150, a: 4, r: 3 });
    const prog = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62], [40, 47, 52, 56, 59]];
    for (let x = a, k = 0; x < b - 1; x += 7, k++) pad(music, x, Math.min(7.5, b - x), prog[k % 4], 0.07, 900 + Math.min(2000, k * 200));
    for (let x = a + 30; x < b - 2; x += 60 / 70) { kick(music, x, 0.35); osc(music, x, 0.5, 65, { f1: 45, vol: 0.25, dec: 0.25 }); }
  } else if (mood === 'credits') {
    const mel = [69, 72, 76, 74, 72, 69, 67, 69, 72, 71, 69, 64];
    for (let x = a + 1, k = 0; x < b - 2; x += 1.2, k++) bell(music, x, mtof(mel[k % mel.length]), 2.2, 0.16);
    for (let x = a, k = 0; x < b - 1; x += 4.8, k++) pad(music, x, Math.min(5, b - x), [Am, F, C_, G][k % 4], 0.1, 1200);
  }
}
for (const m of MOODS) section(m.mood, m.start, m.end);

// ---------------- sound effects ----------------
function respawn(t, v = 1) {
  noise(sfx, t - 0.5, 0.7, { vol: 0.12 * v, lp: 400, lp1: 6000, a: 0.6, r: 0.05 });
  osc(sfx, t, 0.9, 80, { f1: 40, vol: 0.35 * v, dec: 0.4 });
  for (const m of [76, 83, 88]) osc(sfx, t + 0.05, 1.4, mtof(m), { vol: 0.05 * v, dec: 0.5, vib: 0.01 });
  osc(sfx, t + 0.02, 0.3, 300, { f1: 1400, vol: 0.08 * v, type: 'tri', r: 0.1 });
}
function splat(t, v = 1) { noise(sfx, t, 0.5, { vol: 0.5 * v, lp: 1800, lp1: 300, dec: 0.15 }); osc(sfx, t, 0.4, 160, { f1: 50, vol: 0.4 * v, dec: 0.12 }); }
function gun(t, v = 1) { noise(sfx, t, 0.4, { vol: 0.7 * v, lp: 5000, lp1: 800, dec: 0.08 }); osc(sfx, t, 0.3, 120, { f1: 40, vol: 0.5 * v, dec: 0.1 }); }
function chirp(t, up = 1) { for (let k = 0; k < 3; k++) osc(sfx, t + k * 0.13, 0.12, up ? 700 + k * 200 : 1200 - k * 250, { f1: up ? 1100 + k * 200 : 600, type: 'tri', vol: 0.09, vib: 0.05, r: 0.04 }); osc(sfx, t, 0.45, 220, { f1: 330, type: 'saw', lp: 900, vol: 0.05, vib: 0.08 }); }
const FX = {
  whoosh: (t) => noise(sfx, t, 6, { vol: 0.25, lp: 300, lp1: 3000, a: 5, r: 0.8 }),
  boom: (t) => { noise(sfx, t, 3, { vol: 0.9, lp: 900, lp1: 80, dec: 0.8 }); osc(sfx, t, 2, 60, { f1: 25, vol: 0.7, dec: 0.7 }); },
  bigboom: (t) => { noise(sfx, t, 5, { vol: 1, lp: 2000, lp1: 60, dec: 1.4 }); osc(sfx, t, 3, 55, { f1: 20, vol: 0.8, dec: 1.2 }); },
  rumble: (t) => noise(sfx, t, 12, { vol: 0.25, lp: 120, a: 2, r: 4 }),
  hiss: (t) => noise(sfx, t, 4, { vol: 0.06, hp: 3000, a: 1, r: 2 }),
  steam: (t) => noise(sfx, t, 3, { vol: 0.1, hp: 2500, a: 0.1, r: 2 }),
  gurgle: (t) => { for (let k = 0; k < 6; k++) osc(sfx, t + k * 0.18, 0.15, 180 + rnd() * 120, { f1: 90, vol: 0.12, type: 'tri', r: 0.05 }); },
  chirp: (t) => chirp(t, 1), chirp2: (t) => chirp(t, 0),
  sting: (t) => { osc(sfx, t, 2.5, 55, { type: 'saw', lp: 500, vol: 0.4, dec: 1 }); noise(sfx, t, 1.5, { vol: 0.3, lp: 3000, lp1: 200, dec: 0.5 }); for (const m of [57, 64, 69]) osc(sfx, t, 2, mtof(m), { type: 'saw', lp: 1500, vol: 0.06, dec: 0.9 }); },
  respawn: (t) => respawn(t, 1), respawnsoft: (t) => respawn(t, 0.45),
  respawnchorus: (t) => { for (let k = 0; k < 10; k++) respawn(t + k * 0.35, 0.5); },
  horn: (t) => { for (const f of [311, 370]) osc(sfx, t, 1.4, f, { type: 'square', vol: 0.09, lp: 1800, r: 0.1 }); osc(sfx, t + 1.7, 0.8, 311, { type: 'square', vol: 0.09, lp: 1800 }); },
  splat: (t) => splat(t), brake: (t) => noise(sfx, t, 1.6, { vol: 0.15, hp: 2500, lp: 7000, am: 30, r: 0.4 }),
  truckaway: (t) => { osc(sfx, t, 4, 70, { type: 'saw', lp: 300, vol: 0.18, a: 0.1, r: 3, f1: 55 }); },
  splash: (t) => { noise(sfx, t, 1.2, { vol: 0.6, lp: 6000, lp1: 800, dec: 0.3 }); for (let k = 0; k < 8; k++) osc(sfx, t + 0.2 + rnd() * 0.6, 0.08, 600 + rnd() * 900, { f1: 1500, vol: 0.05 }); },
  bubbles: (t) => { for (let k = 0; k < 14; k++) osc(sfx, t + k * 0.22 + rnd() * 0.1, 0.07, 300 + rnd() * 400, { f1: 900 + rnd() * 500, vol: 0.07 }); },
  silence: (t) => { const s0 = Math.floor(t * SR), n = 7 * SR; for (let i = 0; i < n && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], i < 0.3 * SR ? 1 - i / (0.3 * SR) : i > n - SR ? (i - (n - SR)) / SR : 0); },
  cough: (t) => { noise(sfx, t, 0.25, { vol: 0.25, lp: 1500, hp: 200, dec: 0.08 }); osc(sfx, t, 0.2, 260, { f1: 180, type: 'saw', lp: 900, vol: 0.06 }); },
  scream: (t) => { osc(sfx, t, 1.6, 700, { f1: 900, type: 'saw', lp: 2500, vol: 0.12, vib: 0.03, a: 0.05, r: 0.3 }); osc(sfx, t, 1.6, 1050, { f1: 1300, type: 'tri', vol: 0.06, vib: 0.03 }); },
  shotgun: (t) => { gun(t, 1.2); noise(sfx, t + 0.1, 1.2, { vol: 0.2, lp: 700, dec: 0.5 }); splat(t + 0.05, 0.8); },
  click: (t) => osc(sfx, t, 0.05, 2500, { vol: 0.15, type: 'square', r: 0.01 }),
  throw: (t) => noise(sfx, t, 0.6, { vol: 0.15, lp: 3000, hp: 400, a: 0.2, r: 0.3 }),
  bonk: (t) => { osc(sfx, t, 0.6, 520, { f1: 380, vol: 0.4, dec: 0.2 }); osc(sfx, t, 0.6, 1300, { vol: 0.08, dec: 0.15 }); },
  sniff: (t) => { for (let k = 0; k < 3; k++) noise(sfx, t + k * 0.25, 0.18, { vol: 0.12, hp: 1500, lp: 6000, a: 0.08, r: 0.05 }); },
  gasp: (t) => noise(sfx, t, 0.5, { vol: 0.15, hp: 800, lp: 4000, a: 0.05, r: 0.3 }),
  stab: (t) => { noise(sfx, t - 0.15, 0.2, { vol: 0.25, hp: 2500, a: 0.15, r: 0.02 }); splat(t, 0.8); },
  crunch: (t) => { for (let k = 0; k < 4; k++) noise(sfx, t + k * 0.06, 0.06, { vol: 0.2, hp: 1200, dec: 0.02 }); },
  choke: (t) => { for (let k = 0; k < 5; k++) osc(sfx, t + k * 0.35, 0.25, 300, { f1: 200, type: 'saw', lp: 800, vol: 0.08, vib: 0.1 }); },
  thud: (t) => { osc(sfx, t, 0.5, 110, { f1: 45, vol: 0.6, dec: 0.15 }); noise(sfx, t, 0.3, { vol: 0.3, lp: 600, dec: 0.1 }); },
  slip: (t) => osc(sfx, t, 0.7, 400, { f1: 1600, type: 'tri', vol: 0.12, r: 0.1 }),
  sizzle: (t) => { noise(sfx, t, 6, { vol: 0.25, hp: 3000, lp: 9000, a: 0.05, r: 3, am: 13 }); splat(t, 0.6); },
  hum: (t) => osc(sfx, t, 10, 60, { type: 'saw', lp: 400, vol: 0.07, a: 2, r: 3 }),
  zap: (t) => { osc(sfx, t, 3.5, 90, { type: 'square', lp: 2500, vol: 0.18, vib: 0.4 }); noise(sfx, t, 3.5, { vol: 0.2, hp: 2000, am: 37 }); },
  sparks: (t) => { for (let k = 0; k < 10; k++) noise(sfx, t + rnd() * 3, 0.05, { vol: 0.15, hp: 4000, dec: 0.02 }); },
  pianocrash: (t) => { for (const m of [36, 40, 43, 47, 50, 55, 59, 62]) pluck(sfx, t, mtof(m), 2.5, 0.12, 0.7); FX.thud(t); },
  mower: (t) => { osc(sfx, t - 4, 5, 70, { type: 'saw', lp: 900, vol: 0.12, a: 2, r: 0.3, vib: 0.08 }); splat(t, 0.7); },
  crash: (t) => { noise(sfx, t, 1.4, { vol: 0.6, lp: 7000, lp1: 1500, dec: 0.4 }); FX.thud(t); },
  thunder: (t) => { noise(sfx, t, 0.15, { vol: 0.9, hp: 1000, dec: 0.05 }); noise(sfx, t + 0.1, 4, { vol: 0.6, lp: 400, lp1: 100, dec: 1.4 }); },
  bees: (t) => { osc(sfx, t - 3.5, 4.5, 220, { type: 'saw', lp: 1500, vol: 0.06, vib: 0.06, a: 1, r: 0.5 }); osc(sfx, t - 3.5, 4.5, 233, { type: 'saw', lp: 1500, vol: 0.05, vib: 0.08, a: 1, r: 0.5 }); },
  train: (t) => { for (const f of [277, 349, 415]) osc(sfx, t - 2.4, 1.5, f, { type: 'saw', lp: 2000, vol: 0.05, r: 0.3 }); noise(sfx, t - 1.5, 4, { vol: 0.3, lp: 800, a: 1, r: 1.5, am: 6 }); splat(t, 0.6); },
  freeze: (t) => { noise(sfx, t, 1.2, { vol: 0.2, hp: 4000, a: 0.3, r: 0.6 }); osc(sfx, t, 1, 2000, { f1: 3000, vol: 0.04, type: 'tri' }); },
  firework: (t) => { noise(sfx, t - 3.3, 3.3, { vol: 0.12, hp: 1500, a: 0.5, r: 0.1 }); FX.boom(t); for (let k = 0; k < 15; k++) noise(sfx, t + 0.4 + rnd() * 1.4, 0.04, { vol: 0.12, hp: 3000, dec: 0.02 }); },
  fall: (t) => { osc(sfx, t - 2, 2, 1500, { f1: 300, type: 'sine', vol: 0.1, r: 0.05 }); FX.thud(t + 0.2); },
  stampede: (t) => { for (let k = 0; k < 40; k++) osc(sfx, t - 3.8 + k * 0.12, 0.12, 90 + rnd() * 30, { f1: 50, vol: 0.15, dec: 0.05 }); osc(sfx, t - 3, 1, 160, { f1: 130, type: 'saw', lp: 700, vol: 0.06, vib: 0.05 }); },
  pop: (t) => { noise(sfx, t, 0.12, { vol: 0.5, hp: 500, dec: 0.03 }); FX.fall(t + 2.2); },
  newsjingle: (t) => { [72, 76, 79, 84].forEach((m, k) => osc(sfx, t + k * 0.16, 0.6, mtof(m), { type: 'square', lp: 4000, vol: 0.06, dec: 0.3 })); },
  static: (t) => noise(sfx, t, 1.2, { vol: 0.15, hp: 1000 }),
  trucks: (t) => osc(sfx, t, 14, 55, { type: 'saw', lp: 260, vol: 0.18, a: 3, r: 4, vib: 0.02 }),
  radio: (t) => { noise(sfx, t, 2, { vol: 0.06, hp: 1500, lp: 3500, am: 9 }); osc(sfx, t + 2, 0.15, 1000, { vol: 0.05 }); },
  gunburst: (t) => { for (let k = 0; k < 6; k++) gun(t - 0.5 + k * 0.08, 0.5); splat(t, 0.5); },
  tank: (t) => { FX.boom(t); splat(t, 0.6); },
  yawn: (t) => osc(sfx, t, 1.6, 300, { f1: 160, type: 'saw', lp: 700, vol: 0.06, a: 0.3, r: 0.6 }),
  helicopter: (t) => noise(sfx, t, 22, { vol: 0.22, lp: 500, am: 11, a: 3, r: 4 }),
  clank: (t) => { osc(sfx, t, 1, 340, { vol: 0.2, dec: 0.3 }); osc(sfx, t, 1, 513, { vol: 0.1, dec: 0.25 }); FX.thud(t); },
  doors: (t) => noise(sfx, t, 2, { vol: 0.12, lp: 900, a: 0.4, r: 0.6 }),
  beep: (t) => { osc(sfx, t, 0.12, 1200, { vol: 0.08 }); osc(sfx, t + 0.2, 0.12, 1600, { vol: 0.08 }); },
  laser: (t) => { osc(sfx, t - 0.6, 0.9, 2400, { f1: 400, type: 'saw', lp: 4000, vol: 0.1 }); splat(t, 0.5); },
  acid: (t) => { noise(sfx, t - 0.8, 1.6, { vol: 0.25, hp: 2000, am: 21, a: 0.2, r: 0.4 }); },
  crush: (t) => { osc(sfx, t - 1, 1, 60, { type: 'saw', lp: 300, vol: 0.2, a: 0.5 }); FX.crash(t); },
  spin: (t) => { osc(sfx, t - 1, 1.4, 200, { f1: 1200, type: 'saw', lp: 2000, vol: 0.08 }); splat(t, 0.5); },
  vacuum: (t) => { noise(sfx, t - 1, 1.3, { vol: 0.2, lp: 800, lp1: 4000, a: 0.8, r: 0.1 }); noise(sfx, t, 0.15, { vol: 0.5, hp: 400, dec: 0.04 }); },
  fire: (t) => noise(sfx, t - 1, 2, { vol: 0.3, lp: 1500, am: 8, a: 0.3, r: 0.7 }),
  screech: (t) => osc(sfx, t - 1, 1.4, 2800, { type: 'square', lp: 6000, vol: 0.04, vib: 0.2 }),
  alarmsoft: (t) => { for (let k = 0; k < 8; k++) osc(sfx, t + k * 1.2, 0.5, 880, { f1: 660, vol: 0.05, type: 'tri' }); },
  alarm: (t) => { for (let k = 0; k < 10; k++) osc(sfx, t + k * 0.9, 0.6, 700, { f1: 1100, vol: 0.08, type: 'saw', lp: 3000 }); },
  squeak: (t) => osc(sfx, t, 0.9, 1800, { f1: 2300, type: 'sine', vol: 0.05, vib: 0.03, a: 0.05, r: 0.2 }),
  heartbeat: (t) => { for (let k = 0; k < 8; k++) { osc(sfx, t + k * 0.9, 0.18, 60, { f1: 40, vol: 0.5, dec: 0.06 }); osc(sfx, t + k * 0.9 + 0.22, 0.18, 55, { f1: 38, vol: 0.35, dec: 0.06 }); } },
  powerup: (t) => { osc(sfx, t, 13, 60, { f1: 700, type: 'saw', lp: 2500, vol: 0.08, a: 2, r: 0.2 }); },
  cheer: (t) => { for (let k = 0; k < 4; k++) noise(sfx, t + k * 0.05, 4, { vol: 0.12, hp: 600, lp: 3000, am: 3 + k, a: 0.3, r: 1.5 }); },
  party: (t) => { for (let k = 0; k < 6; k++) noise(sfx, t + k * 0.5 + rnd() * 0.3, 0.15, { vol: 0.25, hp: 1000, dec: 0.04 }); },
};
let missing = new Set();
for (const e of EVENTS) { const f = FX[e.sfx]; if (f) f(e.t); else missing.add(e.sfx); }
if (missing.size) console.log('missing sfx:', [...missing]);

// ---------------- mix: duck music under silence + reverb + limiter ----------------
// smooth the duck curve
let d = 1; for (let i = 0; i < N; i++) { d += (duck[i] - d) * 0.0005; duck[i] = d; }
function reverb(buf, mix) {
  const combs = [1557, 1617, 1491, 1422].map((n) => ({ b: new Float32Array(n), i: 0, f: 0.78 }));
  const aps = [225, 556].map((n) => ({ b: new Float32Array(n), i: 0 }));
  for (let i = 0; i < N; i++) {
    const x = buf[i] * 0.3; let y = 0;
    for (const c of combs) { const o = c.b[c.i]; c.b[c.i] = x + o * c.f; c.i = (c.i + 1) % c.b.length; y += o; }
    for (const a of aps) { const o = a.b[a.i]; const v = -y * 0.5 + o; a.b[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.b.length; y = v; }
    buf[i] += y * mix;
  }
}
reverb(music, 0.35);
reverb(sfx, 0.12);
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const m = music[i] * duck[i] * 0.9, s = sfx[i];
  L[i] = m + s; R[i] = (i > 300 ? music[i - 300] * duck[i] * 0.9 : 0) + s;
}
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.92 / Math.max(peak, 0.5);
const soft = (v) => Math.tanh(v * g * 1.3) / Math.tanh(1.3);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(soft(L[i]) * 32000), 44 + i * 4); out.writeInt16LE(Math.round(soft(R[i]) * 32000), 46 + i * 4); }
writeFileSync(process.argv[2] || 'soundtrack.wav', out);
console.log('wrote', (N / SR).toFixed(1), 's, peak', peak.toFixed(2));
