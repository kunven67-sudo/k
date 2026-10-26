// "Listen" worker: voice activity (who is talking when) + voice analysis (girl/boy, pitch, voice fingerprint).
import { serve, withTransfer } from '../engine/rpc.js';
import { setupOrt, session, ort } from '../engine/ortsetup.js';
import { MODELS } from '../engine/models.js';
import { SileroVAD, segmentsFromProbs } from '../lib/vad.js';
import { pitchStats } from '../lib/pitch.js';
import { AutoFeatureExtractor, AutoModel } from '@huggingface/transformers';

let vad = null, gender = null, spkFe = null, spk = null;
const streams = new Map();

serve({
  async init({ threads = 2 }, emit) {
    const onProgress = (p) => emit('progress', p);
    await setupOrt({ threads, onProgress });
    const [v, g] = await Promise.all([session(MODELS.vad.url, { onProgress }), session(MODELS.gender.url, { onProgress })]);
    vad = new SileroVAD(ort, v); gender = g;
    const pc = (p) => p.status === 'progress' && onProgress({ url: (p.name ? p.name + '/' : '') + p.file, loaded: p.loaded, total: p.total });
    [spkFe, spk] = await Promise.all([
      AutoFeatureExtractor.from_pretrained(MODELS.speaker.id, { progress_callback: pc }),
      AutoModel.from_pretrained(MODELS.speaker.id, { dtype: MODELS.speaker.dtype, device: 'wasm', progress_callback: pc }),
    ]);
    return true;
  },
  // Whole-clip voice activity -> speech lines (file mode)
  async vadSegments({ audio, opts, offset = 0 }, emit) {
    const p = await vad.probs(audio, (f) => emit('vadProgress', f));
    return segmentsFromProbs(p, { ...opts, offset });
  },
  // Streaming voice activity (live mode): feed 16 kHz chunks, get back per-window probabilities
  async vadStream({ id, audio }) {
    let st = streams.get(id);
    if (!st) { st = { rest: new Float32Array(0), v: new SileroVAD(ort, vad.s) }; streams.set(id, st); }
    const x = new Float32Array(st.rest.length + audio.length); x.set(st.rest); x.set(audio, st.rest.length);
    const n = Math.floor(x.length / 512), p = new Float32Array(n);
    for (let i = 0; i < n; i++) p[i] = await st.v.prob(x.subarray(i * 512, i * 512 + 512));
    st.rest = x.slice(n * 512);
    return withTransfer(p, [p.buffer]);
  },
  vadReset({ id }) { streams.delete(id); return true; },
  // One piece of speech -> girl/boy probability, pitch, and a voice fingerprint for telling characters apart
  async analyze({ audio }) {
    const out = { pf: 0.5, pitch: pitchStats(audio), emb: null, dur: audio.length / 16000 };
    if (audio.length >= 16000 * 0.4) {
      const x = audio.length > 16000 * 8 ? audio.subarray(0, 16000 * 8) : audio;
      const g = await gender.run({ input_values: new ort.Tensor('float32', x, [1, x.length]) });
      const [lm, lf] = g.logits.data;
      out.pf = 1 / (1 + Math.exp(lm - lf));
      out.gLogit = lf - lm;
    }
    if (audio.length >= 16000 * 0.7) {
      const x = audio.length > 16000 * 6 ? audio.subarray(0, 16000 * 6) : audio;
      const r = await spk(await spkFe(x));
      const e = r[Object.keys(r)[0]].data;
      let s = 0; for (const v of e) s += v * v; s = Math.sqrt(s) || 1;
      out.emb = Float32Array.from(e, v => v / s);
    }
    return out;
  },
});
