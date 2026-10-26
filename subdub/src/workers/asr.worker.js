// "Hear" worker: Whisper speech-to-text (+ backup translators when the browser has none built in).
import { serve } from '../engine/rpc.js';
import { setupOrt } from '../engine/ortsetup.js';
import { MODELS } from '../engine/models.js';
import { Whisper, settleLanguage } from '../engine/whisper.js';
import { pipeline } from '@huggingface/transformers';

const whispers = {};       // tier -> Whisper
const translators = {};    // lang -> pipeline
let device = 'wasm';

async function getWhisper(tier, emit) {
  if (whispers[tier]) return whispers[tier];
  const m = MODELS.whisper[tier];
  const dtype = device === 'webgpu' ? m.gpu : m.cpu;
  whispers[tier] = await Whisper.load(m.id, { device, dtype, onProgress: (p) => emit('progress', p) });
  return whispers[tier];
}

serve({
  async init({ threads = 4, gpu = false }, emit) {
    await setupOrt({ threads, onProgress: (p) => emit('progress', p) });
    device = gpu ? 'webgpu' : 'wasm';
    return device;
  },
  async load({ tier }, emit) { await getWhisper(tier, emit); return true; },
  async unload({ tier }) { const w = whispers[tier]; if (w) { delete whispers[tier]; await w.model.dispose?.(); } return true; },
  // audio: 16 kHz mono speech line (<= 30 s). prior: {lang: weight}. showLang: the show's main language.
  // force: language to use without asking. wantEnglish: also run Whisper's own X->English translation.
  async hear({ audio, tier = 'good', prior = null, showLang = null, force = null, wantEnglish = false }, emit) {
    const w = await getWhisper(tier, emit);
    const duration = audio.length / 16000;
    const t0 = performance.now();
    const feats = await w.encode(audio);
    const top = force ? [[force, 1]] : await w.detect(feats, prior);
    let lang = top[0][0];
    // English line? (strong English guess) -> just transcribe it for captions
    let sentences = await w.run(feats, { lang, task: 'transcribe', duration });
    const joined = sentences.map(s => s.text).join(' ');
    const settled = force ? { lang, p: 1 } : settleLanguage(top, joined, showLang);
    if (settled.lang !== lang) { lang = settled.lang; sentences = await w.run(feats, { lang, task: 'transcribe', duration }); }
    let english = null;
    if (wantEnglish && lang !== 'en' && sentences.length) english = (await w.run(feats, { lang, task: 'translate', duration })).map(s => s.text).join(' ');
    return { lang, p: settled.p, top: top.slice(0, 3), sentences, english, ms: performance.now() - t0 };
  },
  // Backup translation (Marian opus-mt). texts: array of sentences in `lang`.
  async translate({ texts, lang }, emit) {
    const id = MODELS.mt[lang] || MODELS.mt['*'];
    translators[id] ??= await pipeline('translation', id, { dtype: 'q8', device: 'wasm', progress_callback: (p) => p.status === 'progress' && emit('progress', { url: (p.name ? p.name + '/' : '') + p.file, loaded: p.loaded, total: p.total }) });
    const out = [];
    for (const t of texts) {
      if (!t.trim()) { out.push(''); continue; }
      const r = await translators[id](t, { max_new_tokens: 160 });
      out.push(r[0].translation_text);
    }
    return out;
  },
});
