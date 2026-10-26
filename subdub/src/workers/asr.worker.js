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
  // Language of each line, with the small quick model (so the big one can read many lines in one go).
  async detectEach({ clips, prior = null }, emit) {
    const w = await getWhisper('fast', emit);
    const out = [];
    for (const c of clips) out.push(await w.detect(await w.encode(c), prior));
    return out;
  },
  // Several lines in the same language, read in ONE pass (Whisper always works on 30 s, so this is much faster
  // than one pass per line). Lines are glued with short silences; each sentence goes back to its own line.
  async hearBatch({ clips, tier = 'good', lang, gap = 0.8 }, emit) {
    const w = await getWhisper(tier, emit);
    const G = Math.round(gap * 16000), offs = [];
    const audio = new Float32Array(clips.reduce((s, c) => s + c.length + G, 0));
    let o = 0;
    for (const c of clips) { offs.push(o / 16000); audio.set(c, o); o += c.length + G; }
    const duration = audio.length / 16000;
    const sents = await w.run(await w.encode(audio), { lang, task: 'transcribe', duration });
    const per = clips.map(() => []);
    for (const st of sents) {
      let best = -1, bo = 0;
      clips.forEach((c, i) => { const ov = Math.min(offs[i] + c.length / 16000, st.b) - Math.max(offs[i], st.a); if (ov > bo) { bo = ov; best = i; } });
      if (best < 0) { // fell in a gap: closest line
        let bd = Infinity;
        clips.forEach((c, i) => { const d = Math.abs(offs[i] + c.length / 32000 - (st.a + st.b) / 2); if (d < bd) { bd = d; best = i; } });
      }
      const len = clips[best].length / 16000, a = Math.max(0, Math.min(len, st.a - offs[best]));
      per[best].push({ a, b: Math.max(a, Math.min(len, st.b - offs[best])), text: st.text });
    }
    return per;
  },
  // The show's main language from up to 30 s of talking (stuck together): much surer than one short line.
  async detectLang({ audio, tier = 'good' }, emit) {
    const w = await getWhisper(tier, emit);
    const feats = await w.encode(audio.length > 16000 * 30 ? audio.subarray(0, 16000 * 30) : audio);
    return w.detect(feats, null);
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
