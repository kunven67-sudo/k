// To-English translation: the browser's own on-device translator (Edge 148+ / Chrome 138+) when there is one,
// otherwise the backup models in the "hear" worker.
import { guessLang } from './langid.js';

const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
const BUILTIN_CODE = { zh: 'zh', 'zh-Hant': 'zh-Hant' };

export class Translate {
  constructor(asr) { this.asr = asr; this.builtin = new Map(); this.state = {}; this.detector = null; this.memo = new Map(); }
  get hasApi() { return typeof self.Translator !== 'undefined'; }
  // Can the browser translate this language by itself? ('available' | 'downloadable' | 'no')
  async check(lang) {
    if (!this.hasApi) return 'no';
    const a = await withTimeout(Translator.availability({ sourceLanguage: BUILTIN_CODE[lang] || lang, targetLanguage: 'en' }).catch(() => 'unavailable'), 3000, 'timeout');
    return a === 'available' ? 'available' : (a === 'downloadable' || a === 'downloading') ? 'downloadable' : 'no';
  }
  // Must be called from a click (the browser only downloads its translator after a user gesture).
  async prepare(langs, onProgress) {
    const tasks = langs.map(async (lang) => {
      const st = await this.check(lang);
      if (st === 'no') { this.state[lang] = 'backup'; return; }
      try {
        const t = await withTimeout(Translator.create({
          sourceLanguage: BUILTIN_CODE[lang] || lang, targetLanguage: 'en',
          monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress?.({ url: `translator:${lang}`, loaded: e.loaded, total: 1 })); },
        }), st === 'available' ? 8000 : 180000, null);
        if (t) { this.builtin.set(lang, t); this.state[lang] = 'builtin'; } else this.state[lang] = 'backup';
      } catch { this.state[lang] = 'backup'; }
    });
    await Promise.all(tasks);
    return this.state;
  }
  async toEnglish(text, lang) {
    text = text.trim();
    if (!text) return '';
    lang ||= guessLang(text) || 'auto';
    if (lang === 'en') return text;
    const key = lang + '|' + text;
    if (this.memo.has(key)) return this.memo.get(key);
    let out = null;
    let t = this.builtin.get(lang);
    if (!t && this.hasApi && this.state[lang] !== 'backup' && lang !== 'auto') {
      // try once quietly (works if the language pack is already on this PC)
      const st = await this.check(lang);
      if (st === 'available') { t = await Translator.create({ sourceLanguage: BUILTIN_CODE[lang] || lang, targetLanguage: 'en' }).catch(() => null); if (t) { this.builtin.set(lang, t); this.state[lang] = 'builtin'; } }
      else this.state[lang] = 'backup';
    }
    if (t) { try { out = await withTimeout(t.translate(text), 8000, null); } catch { out = null; } }
    if (!out) {
      // backup model works sentence by sentence
      const parts = text.match(/[^。！？!?.]+[。！？!?.]*|[^。！？!?.]+$/g) || [text];
      out = (await this.asr.call('translate', { texts: parts, lang })).join(' ');
    }
    out = out.replace(/\s+/g, ' ').trim();
    // translators like to wrap short lines in quotes: drop them unless the original had quotes too
    if (!/["“”「」『』]/.test(text)) out = out.replace(/^["“”'「『]+|["“”'」』]+$/g, '').trim();
    this.memo.set(key, out);
    return out;
  }
}
