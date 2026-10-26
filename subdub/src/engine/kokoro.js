// Kokoro-82M English text-to-speech with mixable voices (each anime character gets its own blend).
import { StyleTextToSpeech2Model, AutoTokenizer, Tensor } from '@huggingface/transformers';
import { phonemize } from 'phonemizer';
import { fetchModel } from './cache.js';

const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const punctRe = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`, 'g');

// Number/short-form clean-up so the voice reads things naturally
export function normalizeText(t) {
  return t
    .replace(/[‘’]/g, "'").replace(/[“”«»「」『』]/g, '"').replace(/[、，]/g, ', ').replace(/[。．]/g, '. ').replace(/！/g, '! ').replace(/？/g, '? ')
    .replace(/[：]/g, ': ').replace(/[；]/g, '; ').replace(/…/g, '...').replace(/[~～]+/g, '!')
    .replace(/\bDr\.(?= [A-Z])/g, 'Doctor').replace(/\bMr\./g, 'Mister').replace(/\bMs\./g, 'Miss').replace(/\bMrs\./g, 'Missus')
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/\s+/g, ' ').trim();
}

async function textToPhonemes(text, accent) {
  const lang = accent === 'b' ? 'en' : 'en-us';
  const parts = []; let last = 0;
  for (const m of text.matchAll(punctRe)) { if (m.index > last) parts.push([false, text.slice(last, m.index)]); parts.push([true, m[0]]); last = m.index + m[0].length; }
  if (last < text.length) parts.push([false, text.slice(last)]);
  const ph = (await Promise.all(parts.map(async ([isP, s]) => isP ? s : (await phonemize(s, lang)).join(' ')))).join('');
  let out = ph.replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ').replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ').replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
  if (accent !== 'b') out = out.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return out.trim();
}

// Split into sentences so long lines stay natural (Kokoro reads up to ~510 tokens at once)
export function sentences(text) {
  const out = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text];
  return out.map(s => s.trim()).filter(Boolean);
}

export class Kokoro {
  static async load(id, { device = 'wasm', dtype = 'q8', onProgress } = {}) {
    const progress_callback = (p) => p.status === 'progress' && onProgress?.({ url: (p.name ? p.name + '/' : '') + p.file, loaded: p.loaded, total: p.total });
    const [model, tok] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(id, { device, dtype, progress_callback }),
      AutoTokenizer.from_pretrained(id, { progress_callback }),
    ]);
    return new Kokoro(id, model, tok);
  }
  constructor(id, model, tok) { this.id = id; this.model = model; this.tok = tok; this.voices = new Map(); this.sr = 24000; }
  async voice(name) {
    if (!this.voices.has(name)) {
      const b = await fetchModel(`https://huggingface.co/${this.id}/resolve/main/voices/${name}.bin`);
      this.voices.set(name, new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4));
    }
    return this.voices.get(name);
  }
  // mix: [[voiceName, weight], ...] -> blended style table
  async style(mix) {
    const key = JSON.stringify(mix);
    if (this.voices.has(key)) return this.voices.get(key);
    const tabs = await Promise.all(mix.map(([n]) => this.voice(n)));
    const sum = mix.reduce((s, [, w]) => s + w, 0) || 1;
    const out = new Float32Array(tabs[0].length);
    mix.forEach(([, w], i) => { const t = tabs[i]; for (let k = 0; k < out.length; k++) out[k] += t[k] * w / sum; });
    this.voices.set(key, out);
    return out;
  }
  // text -> Float32Array at 24 kHz
  async speak(text, { mix = [['af_heart', 1]], speed = 1, accent = null } = {}) {
    accent ??= mix[0][0][0];
    const st = await this.style(mix);
    const chunks = [];
    for (const s of sentences(normalizeText(text))) {
      const ph = await textToPhonemes(s, accent);
      if (!ph) continue;
      const { input_ids } = this.tok(ph, { truncation: true });
      const L = Math.min(Math.max(input_ids.dims.at(-1) - 2, 0), 509);
      const { waveform } = await this.model({
        input_ids, style: new Tensor('float32', st.slice(L * 256, L * 256 + 256), [1, 256]),
        speed: new Tensor('float32', [speed], [1]),
      });
      chunks.push(trimSilence(waveform.data, this.sr));
    }
    // join sentences with a short breath
    const gap = Math.round(this.sr * 0.12 / speed);
    const n = chunks.reduce((s, c) => s + c.length, 0) + gap * Math.max(0, chunks.length - 1);
    const out = new Float32Array(n); let o = 0;
    chunks.forEach((c, i) => { out.set(c, o); o += c.length + (i < chunks.length - 1 ? gap : 0); });
    return out;
  }
}

// cut leading/trailing near-silence (Kokoro adds some)
function trimSilence(x, sr) {
  const th = 0.003, pad = Math.round(sr * 0.03);
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  return x.slice(Math.max(0, a - pad), Math.min(x.length, b + pad));
}
