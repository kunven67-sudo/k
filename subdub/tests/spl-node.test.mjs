// Node: Spleeter separation quality (Whisper must not hear words in the music track) + speed
import * as ort from 'onnxruntime-node';
import { SpleeterSeparator } from '../src/lib/spleeter.js';
import { readWav, writeWav } from '/tmp/claude-0/proto/lib/wav.mjs';
const clip = process.argv[2] || 'ja_zenki_st60';
const w = readWav(`/tmp/claude-0/media/wav/${clip}.wav`), n = w.data.length / 2;
const L = new Float32Array(n), R = new Float32Array(n);
for (let i = 0; i < n; i++) { L[i] = w.data[2 * i]; R[i] = w.data[2 * i + 1]; }
const o = { intraOpNumThreads: 4, logSeverityLevel: 3 };
const sv = await ort.InferenceSession.create('/tmp/claude-0/proto/models/spl/vocals.onnx', o), sm = await ort.InferenceSession.create('/tmp/claude-0/proto/models/spl/accompaniment.onnx', o);
let modelMs = 0;
const run = (s) => async (inp, dims) => { const t = performance.now(); const r = await s.run({ x: new ort.Tensor('float32', inp, dims) }); modelMs += performance.now() - t; return r.y.data; };
const sep = new SpleeterSeparator(run(sv), run(sm));
const t = performance.now(); const v = await sep.separate(L, R); const ms = performance.now() - t;
console.log(`${(n / 44100).toFixed(1)}s audio in ${(ms / 1000).toFixed(1)}s (model ${(modelMs / 1000).toFixed(1)}s)`);
const inter = (a, b) => { const x = new Float32Array(a.length * 2); for (let i = 0; i < a.length; i++) { x[2 * i] = a[i]; x[2 * i + 1] = b[i]; } return x; };
const mL = L.map((x, i) => x - v.L[i]), mR = R.map((x, i) => x - v.R[i]);
writeWav(`/tmp/claude-0/media/wav/${clip}_spl_music.wav`, inter(mL, mR), 44100, 2);
writeWav(`/tmp/claude-0/media/wav/${clip}_spl_voice.wav`, inter(v.L, v.R), 44100, 2);
