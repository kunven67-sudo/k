// Spoken lines through the browser's speech synthesis (no assets). Picks the most natural voice
// the platform offers for the current language — neural/"natural"/premium voices first, then
// known good male voices for gruff characters — and tunes pitch/rate per speaker.
// Tolerates browsers without speechSynthesis (and headless runs) by doing nothing.
import { i18n } from '../core/i18n.js';

const PREFER = [/natural/i, /neural/i, /premium/i, /enhanced/i, /online/i];
const MALE = [/daniel|alex\b|aaron|fred|tom\b|guy|davis|tony|ryan|christopher|eric|jorge|diego|juan|pablo|carlos|google us english|google español/i];

function lang() {
  return (i18n.lang || i18n.language || document.documentElement.lang || 'en').slice(0, 2);
}

function pickVoice(want, male) {
  const synth = window.speechSynthesis;
  const all = synth?.getVoices?.() || [];
  const voices = all.filter((v) => v.lang?.toLowerCase().startsWith(want));
  if (!voices.length) return null;
  let best = null;
  let bestScore = -1;
  for (const v of voices) {
    let s = 0;
    PREFER.forEach((re, i) => re.test(v.name) && (s += 10 - i));
    if (male && MALE.some((re) => re.test(v.name))) s += 4;
    if (/en-us|es-mx|es-us/i.test(v.lang)) s += 2;
    if (v.localService) s += 1;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

/**
 * Speak `text`. opts: { pitch, rate, volume, male }. Resolves when finished (or immediately when
 * speech is unavailable). Returns { done: Promise, cancel() }.
 */
export function say(text, { pitch = 1, rate = 1, volume = 1, male = true } = {}) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return { done: Promise.resolve(false), cancel() {} };
  const l = lang();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(l, male) || pickVoice('en', male);
  if (v) u.voice = v;
  u.lang = v?.lang || (l === 'es' ? 'es-MX' : 'en-US');
  u.pitch = pitch;
  u.rate = rate;
  u.volume = volume;
  const done = new Promise((resolve) => {
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    setTimeout(() => resolve(false), 9000); // never hang a cutscene on a stuck engine
  });
  try {
    synth.cancel();
    synth.speak(u);
  } catch {
    return { done: Promise.resolve(false), cancel() {} };
  }
  return { done, cancel: () => synth.cancel() };
}

// Voices load asynchronously in Chrome; touching the list early warms it up.
try {
  window.speechSynthesis?.getVoices();
} catch {
  /* unsupported */
}
