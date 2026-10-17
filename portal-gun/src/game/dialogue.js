// Subtitles + computer voices. Lines can contain:
//   *burp*        Rick's mid-sentence burp (plays a burp sound)
//   {word}        a bleeped cuss word (TV censor beep, like the show)
import { audio } from '../core/audio.js';
import { sleep, rand } from '../util.js';

export const CAST = {
  rick: { name: 'Rick', color: '#a9dcf2', pitch: 0.7, rate: 1.14, gender: 'm', slot: 0 },
  morty: { name: 'Morty', color: '#f6e05a', pitch: 1.75, rate: 1.06, gender: 'm', slot: 1 },
  jerry: { name: 'Jerry', color: '#b9d98c', pitch: 1.15, rate: 0.98, gender: 'm', slot: 2 },
  beth: { name: 'Beth', color: '#f7a3a3', pitch: 1.0, rate: 1.06, gender: 'f', slot: 0 },
  summer: { name: 'Summer', color: '#ffb3d9', pitch: 1.3, rate: 1.14, gender: 'f', slot: 1 },
  poopy: { name: 'Mr. Poopybutthole', color: '#f5d86a', pitch: 1.6, rate: 1.02, gender: 'm', slot: 1 },
  butter: { name: 'Butter Robot', color: '#cfd8e3', pitch: 0.55, rate: 0.82, gender: 'm', slot: 2 },
  tv: { name: 'TV', color: '#e8e8e8', pitch: 0.95, rate: 1.12, gender: 'm', slot: 2 },
  tv2: { name: 'TV', color: '#e8e8e8', pitch: 1.35, rate: 1.18, gender: 'm', slot: 0 },
  tvf: { name: 'TV', color: '#e8e8e8', pitch: 1.2, rate: 1.1, gender: 'f', slot: 0 },
};

const MALE_PREF = [
  /Guy.*Natural|Andrew.*Natural|Christopher.*Natural|Eric.*Natural|Davis.*Natural|Roger.*Natural|Brian.*Natural|Steffan.*Natural/i,
  /Google UK English Male/i,
  /\bDavid\b|\bMark\b|\bAlex\b|\bDaniel\b|\bFred\b|\bAaron\b|\bTom\b|\bRalph\b|\bJames\b|\bArthur\b|\bRishi\b/i,
  /male/i,
];
const FEMALE_PREF = [
  /Aria.*Natural|Jenny.*Natural|Ava.*Natural|Emma.*Natural|Michelle.*Natural|Ana.*Natural|Sonia.*Natural/i,
  /Google US English/i,
  /Zira|Samantha|Karen|Victoria|Susan|Allison|Moira|Tessa|Fiona|Hazel|Serena/i,
  /female/i,
];

function parse(text) {
  const out = [];
  const re = /\*burp\*|\{[^}]+\}/gi;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', s: text.slice(last, m.index) });
    out.push(m[0].toLowerCase() === '*burp*' ? { t: 'burp' } : { t: 'bleep', s: m[0].slice(1, -1) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', s: text.slice(last) });
  return out;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export class Dialogue {
  constructor(el) {
    this.el = el; // subtitle container
    this.mode = 'tts'; // 'tts' | 'text'
    this.volume = 1;
    this.voices = { m: [], f: [] };
    this.token = 0;
    this.busy = false;
    this.onTalk = null; // (speakerId, isTalking) => void
    this._keep = [];
    this.tts = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
    if (this.tts) {
      this._loadVoices();
      speechSynthesis.addEventListener?.('voiceschanged', () => this._loadVoices());
    }
  }

  _loadVoices() {
    const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    const rank = (list, prefs) => {
      const picked = [];
      for (const re of prefs) for (const v of list) if (re.test(v.name) && !picked.includes(v)) picked.push(v);
      return picked;
    };
    this.voices.m = rank(all, MALE_PREF);
    this.voices.f = rank(all, FEMALE_PREF);
    // fallbacks: anything English
    if (!this.voices.m.length) this.voices.m = all.slice();
    if (!this.voices.f.length) this.voices.f = all.slice();
  }

  _voiceFor(cast) {
    const list = this.voices[cast.gender] || [];
    if (!list.length) return null;
    return list[Math.min(cast.slot, list.length - 1)];
  }

  get hasVoices() {
    return this.tts && (this.voices.m.length > 0 || this.voices.f.length > 0);
  }

  stop() {
    this.speaker = null;
    this.token++;
    if (this.tts) speechSynthesis.cancel();
    this._hide();
    this.busy = false;
  }

  _show(who, text) {
    const c = CAST[who] || { name: who, color: '#fff' };
    const parts = parse(text)
      .map((p) => {
        if (p.t === 'text') return escapeHtml(p.s);
        if (p.t === 'burp') return '<em class="burp">*burp*</em>';
        return '<span class="bleep">BLEEP</span>';
      })
      .join('');
    this.el.innerHTML = `<span class="who" style="color:${c.color}">${escapeHtml(c.name)}</span><span class="line">${parts}</span>`;
    this.el.classList.add('show');
  }

  _hide() {
    this.el.classList.remove('show');
  }

  /** Speak a whole conversation: [['rick', 'line'], ['morty', 'line'], ...] */
  async play(lines, { gap = 0.25 } = {}) {
    this.stop();
    const token = this.token;
    this.busy = true;
    for (const [who, text] of lines) {
      if (token !== this.token) return false;
      await this._line(who, text, token);
      if (token !== this.token) return false;
      await sleep(gap * 1000);
    }
    if (token === this.token) {
      this._hide();
      this.busy = false;
      this.speaker = null;
    }
    return true;
  }

  say(who, text) {
    return this.play([[who, text]]);
  }

  async _line(who, text, token) {
    this.speaker = who;
    this._show(who, text);
    const cast = CAST[who] || CAST.tv;
    this.onTalk?.(who, true);
    const useTts = this.mode === 'tts' && this.hasVoices;
    for (const seg of parse(text)) {
      if (token !== this.token) break;
      if (seg.t === 'burp') {
        this.onTalk?.(who, false);
        const d = audio.burp(rand(0.8, 1.1));
        await sleep(d * 1000 + 80);
        this.onTalk?.(who, true);
      } else if (seg.t === 'bleep') {
        audio.bleep(0.42);
        await sleep(470);
      } else if (seg.s.trim()) {
        if (useTts) await this._speak(seg.s, cast, token);
        else await this._fakeSpeak(seg.s, cast, token);
      }
    }
    this.onTalk?.(who, false);
    if (token === this.token) await sleep(useTts ? 250 : 400);
  }

  _speak(s, cast, token) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(s);
      const v = this._voiceFor(cast);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.pitch = cast.pitch;
      u.rate = cast.rate;
      u.volume = Math.max(0, Math.min(1, this.volume * audio.volumes.master * 1.1));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const i = this._keep.indexOf(u);
        if (i >= 0) this._keep.splice(i, 1);
        resolve();
      };
      // Chrome sometimes never fires onend; never let a line hang forever.
      const timer = setTimeout(finish, 1500 + (s.length * 85) / cast.rate);
      u.onend = finish;
      u.onerror = finish;
      this._keep.push(u); // keeps Chrome from garbage-collecting the utterance mid-line
      if (token !== this.token) return finish();
      speechSynthesis.speak(u);
    });
  }

  async _fakeSpeak(s, cast, token) {
    // no voices on this computer: cartoon babble so it's not silent
    const syll = Math.max(1, Math.round(s.replace(/[^a-z]/gi, '').length / 2.6));
    const base = 160 * cast.pitch;
    for (let i = 0; i < syll; i++) {
      if (token !== this.token) return;
      if (this.mode === 'tts') audio.tone({ type: 'triangle', f: base * rand(0.85, 1.25), dur: 0.07, gain: 0.05 });
      await sleep((70 + Math.random() * 40) / cast.rate);
    }
  }
}
