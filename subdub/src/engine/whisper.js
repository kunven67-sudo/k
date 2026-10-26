// Whisper speech-to-text with our own language detection (transformers.js doesn't do it) and timestamped sentences.
import { AutoProcessor, WhisperForConditionalGeneration, Tensor } from '@huggingface/transformers';
import { fixRepeats, isHallucination, langFromScript } from './textclean.js';

export class Whisper {
  static async load(id, { device = 'wasm', dtype = 'q8', onProgress } = {}) {
    const progress_callback = (p) => p.status === 'progress' && onProgress?.({ url: (p.name ? p.name + '/' : '') + p.file, loaded: p.loaded, total: p.total });
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(id, { progress_callback }),
      WhisperForConditionalGeneration.from_pretrained(id, { device, dtype: typeof dtype === 'object' ? dtype : { encoder_model: dtype, decoder_model_merged: dtype }, progress_callback }),
    ]);
    // let generate() reuse an encoder output we already computed
    if (!model.forward_params.includes('encoder_outputs')) model.forward_params = [...model.forward_params, 'encoder_outputs'];
    return new Whisper(id, processor, model);
  }
  constructor(id, processor, model) {
    this.id = id; this.processor = processor; this.model = model; this.tok = processor.tokenizer;
    const gc = model.generation_config;
    this.gc = gc;
    this.sot = gc.decoder_start_token_id;
    this.langIds = Object.entries(gc.lang_to_id).map(([k, id]) => [k.slice(2, -2), id]);
    this.tsBegin = gc.no_timestamps_token_id + 1;
    this.eot = gc.eos_token_id;
  }
  async encode(audio) {
    const { input_features } = await this.processor(audio);
    const out = await this.model.sessions.model.run({ input_features: input_features.ort_tensor });
    return { input_features, enc: new Tensor(out.last_hidden_state) };
  }
  // Language probabilities from the first decoder step. prior: {lang: weight} nudges toward the show's language.
  async detect({ enc }, prior = null) {
    const r = await this.model.forward({ encoder_outputs: enc, decoder_input_ids: new Tensor('int64', BigInt64Array.from([BigInt(this.sot)]), [1, 1]) });
    const V = r.logits.dims.at(-1), d = r.logits.data, base = d.length - V;
    let mx = -Infinity;
    const ls = this.langIds.map(([k, id]) => { const v = d[base + id] + (prior?.[k] ? Math.log(prior[k]) : 0); if (v > mx) mx = v; return [k, v]; });
    let sum = 0; for (const x of ls) { x[1] = Math.exp(x[1] - mx); sum += x[1]; }
    ls.forEach(x => x[1] /= sum); ls.sort((a, b) => b[1] - a[1]);
    return ls.slice(0, 5);
  }
  // Transcribe (or translate) -> sentences with times (seconds, relative to the clip)
  async run({ input_features, enc }, { lang, task = 'transcribe', duration = 30 }) {
    const max_new_tokens = Math.min(220, Math.ceil(duration * 16) + 12);
    const ids = await this.model.generate({ inputs: input_features, encoder_outputs: enc, language: lang, task, return_timestamps: true, max_new_tokens });
    const seq = Array.from(ids.tolist ? ids.tolist()[0] : ids[0], Number);
    // split on timestamp tokens: <|t0|> text <|t1|> <|t1|> text <|t2|> ...
    const parts = [];
    let start = null, lastEnd = 0, buf = [];
    for (const id of seq) {
      if (id >= this.tsBegin) {
        const t = (id - this.tsBegin) * 0.02;
        if (buf.length) { parts.push({ a: start ?? lastEnd, b: t, ids: buf }); buf = []; lastEnd = t; start = null; }
        else start = t;
      } else if (id < this.eot) {
        if (start === null && !buf.length) start = lastEnd;
        buf.push(id);
      }
    }
    if (buf.length) parts.push({ a: start ?? lastEnd, b: duration, ids: buf });
    const out = [];
    for (const p of parts) {
      let text = fixRepeats(this.tok.decode(p.ids, { skip_special_tokens: true }));
      if (!text || isHallucination(text)) continue;
      out.push({ a: Math.max(0, Math.min(p.a, duration)), b: Math.max(0, Math.min(p.b, duration)), text });
    }
    return out;
  }
}

// Pick the line's language: whisper's guess, corrected by the letters it actually wrote and by the show's language.
export function settleLanguage(top, text, showLang) {
  const byScript = langFromScript(text);
  let lang = top[0][0], p = top[0][1];
  if (byScript && byScript !== lang && !(byScript === 'zh' && lang === 'ja')) { lang = byScript; p = 0.9; }
  if (showLang && lang !== showLang && p < 0.7 && lang !== 'en') { lang = showLang; }
  return { lang, p };
}
