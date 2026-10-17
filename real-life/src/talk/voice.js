// Voices (Settings > Voices):
//   'babble' (default) -> a made-up murmur like the Sims: real vocal-cord buzz shaped into
//                         vowels, with consonant clicks/hisses, rising on questions, falling at
//                         the end, louder when angry. Pitch from the person's sex + age.
//   'spoken'           -> the browser's speech voice (picks a voice/pitch per person).
//
//   speak(npc, text, position)  -> handle with stop()

import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';

// Vowel formants (F1, F2) in Hz, roughly a/e/i/o/u.
const VOWELS = [[730, 1090], [530, 1840], [300, 2280], [570, 840], [320, 920], [660, 1700]];

function seededRand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function voiceOf(rec) {
  const age = rec.age;
  const f = rec.sex === 'f';
  let f0 = age < 5 ? 330 : age < 12 ? 280 : age < 15 ? (f ? 240 : 210) : f ? 205 : 112;
  if (age > 65) f0 *= f ? 0.88 : 0.92;
  const r = seededRand(hash(rec.id || rec.name));
  f0 *= 0.9 + r() * 0.22;
  return { f0, rate: 0.85 + (rec.traits?.talkative || 0.5) * 0.35, breath: age > 70 ? 0.25 : 0.08 + r() * 0.06, formant: age < 13 ? 1.18 : f ? 1.1 : 1 };
}

/** Babble for a line of text as an AudioBuffer. */
function babble(ctx, rec, text, mood) {
  const v = voiceOf(rec);
  const sr = ctx.sampleRate;
  const words = text.split(/\s+/).filter(Boolean);
  const sylls = Math.min(40, Math.max(2, Math.round(text.replace(/[^a-z]/gi, '').length / 3.2)));
  const syllDur = 0.13 / v.rate;
  const total = sylls * syllDur + (words.length / 6) * 0.08 + 0.25;
  const n = Math.floor(total * sr);
  const out = new Float32Array(n);
  const r = seededRand(hash(text) ^ hash(rec.id || ''));
  const question = /\?\s*$/.test(text);
  const loud = mood === 'angry' ? 1.35 : mood === 'sad' ? 0.7 : 1;
  let t0 = 0.02;
  let phase = 0;
  // Simple 2-pole resonators for F1/F2 (+F3 fixed-ish).
  const res = (f, bw) => {
    const R = Math.exp((-Math.PI * bw) / sr);
    return { a1: 2 * R * Math.cos((2 * Math.PI * f) / sr), a2: -R * R, y1: 0, y2: 0, g: 1 - R };
  };
  for (let s = 0; s < sylls; s++) {
    const dur = syllDur * (0.75 + r() * 0.6);
    const vw = VOWELS[Math.floor(r() * VOWELS.length)];
    const f1 = res(vw[0] * v.formant, 90);
    const f2 = res(vw[1] * v.formant, 120);
    const f3 = res(2600 * v.formant, 180);
    const start = Math.floor(t0 * sr);
    const len = Math.floor(dur * sr);
    // Consonant at the start of most syllables: a click (t/k/p) or a hiss (s/sh/f).
    const cons = r();
    const consLen = Math.floor((cons < 0.35 ? 0.012 : cons < 0.6 ? 0.05 : 0) * sr);
    for (let i = 0; i < len && start + i < n; i++) {
      const k = i / len;
      const pos = (s + k) / sylls;
      // Intonation: drift down over the line, rise at the end of a question.
      let pitch = v.f0 * (1.06 - pos * 0.12 + Math.sin(s * 1.7) * 0.04) * (question && pos > 0.75 ? 1 + (pos - 0.75) * 1.2 : 1);
      if (mood === 'angry') pitch *= 1.08;
      phase += pitch / sr;
      if (phase > 1) phase -= 1;
      // Glottal pulse (soft saw) + breath noise.
      const glot = (phase < 0.6 ? phase / 0.6 : (1 - phase) / 0.4) * 2 - 1;
      const src = glot * (1 - v.breath) + (r() * 2 - 1) * v.breath;
      const a = (x, f) => {
        const y = f.g * x + f.a1 * f.y1 + f.a2 * f.y2;
        f.y2 = f.y1;
        f.y1 = y;
        return y;
      };
      let y = a(src, f1) * 1.0 + a(src, f2) * 0.55 + a(src, f3) * 0.18;
      const envV = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.25);
      y *= envV;
      if (i < consLen) {
        const hiss = (r() * 2 - 1) * (cons < 0.35 ? Math.exp(-i / (0.003 * sr)) * 1.2 : 0.35 * (1 - i / consLen));
        y = y * (i / consLen) + hiss;
      }
      out[start + i] += y * 0.55 * loud;
    }
    t0 += dur;
    // Little gaps between words.
    if (r() < words.length / sylls) t0 += 0.05 + r() * 0.05;
    if (/[,.!?]/.test(words[Math.min(words.length - 1, Math.floor((s / sylls) * words.length))]?.slice(-1) || '')) t0 += 0.08;
  }
  // Normalise.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? 0.7 / peak : 1;
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = out[i] * g;
  return buf;
}

let spokenVoices = null;
function pickVoice(rec) {
  if (!('speechSynthesis' in window)) return null;
  spokenVoices ||= speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  if (!spokenVoices.length) spokenVoices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  if (!spokenVoices.length) return null;
  const female = spokenVoices.filter((v) => /female|zira|samantha|victoria|karen|moira|tessa|susan|hazel|aria|jenny|libby|sonia/i.test(v.name));
  const male = spokenVoices.filter((v) => /male|david|mark|daniel|alex|fred|george|guy|ryan|tom|james/i.test(v.name) && !/female/i.test(v.name));
  const pool = (rec.sex === 'f' ? female : male).length ? (rec.sex === 'f' ? female : male) : spokenVoices;
  return pool[hash(rec.id || rec.name) % pool.length];
}

export function speak(npc, text, { position = null, mood = null } = {}) {
  const rec = npc.rec;
  if (!text) return null;
  if (settings.get('voices') === 'spoken' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(rec);
    if (voice) u.voice = voice;
    const v = voiceOf(rec);
    u.pitch = Math.max(0.1, Math.min(2, v.f0 / (rec.sex === 'f' ? 205 : 115)));
    u.rate = Math.max(0.6, Math.min(1.4, v.rate));
    u.volume = (settings.get('voiceVolume') ?? 1) * (settings.get('masterVolume') ?? 1);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return { stop: () => speechSynthesis.cancel(), duration: text.length / 14 };
  }
  if (!audio.ctx) audio.play?.('ui.open', { gain: 0 });
  if (!audio.ctx) return null;
  const buf = babble(audio.ctx, rec, text, mood);
  const h = audio.play(buf, { bus: 'voice', position, refDistance: 2.5, reverb: 0.35, gain: 0.8 });
  if (h) h.duration = buf.duration;
  return h;
}
