// Node check: new MDX separator (stereo FFT trick) == proto version, and timing.
import * as ort from 'onnxruntime-node';
import { MdxSeparator } from '../src/lib/mdx.js';
import { separate as protoSeparate } from '/tmp/claude-0/proto/lib/mdx.mjs';
import { readWav } from '/tmp/claude-0/proto/lib/wav.mjs';
const w = readWav('/tmp/claude-0/media/wav/ja_zenki_st60.wav'), n = Math.min(w.data.length / 2, 44100 * 15);
const L = new Float32Array(n), R = new Float32Array(n);
for (let i = 0; i < n; i++) { L[i] = w.data[2 * i]; R[i] = w.data[2 * i + 1]; }
const s = await ort.InferenceSession.create('/tmp/claude-0/proto/models/kim_vocal_2.onnx', { intraOpNumThreads: 4, logSeverityLevel: 3 });
let modelMs = 0;
const sep = new MdxSeparator(async (inp, dims) => { const t = performance.now(); const r = await s.run({ input: new ort.Tensor('float32', inp, dims) }); modelMs += performance.now() - t; return r.output.data; });
let t = performance.now(); const v = await sep.separate(L, R); const newMs = performance.now() - t;
t = performance.now(); const o = await protoSeparate(ort, s, L, R); const oldMs = performance.now() - t;
let maxd = 0, e = 0; for (let i = 0; i < n; i++) { maxd = Math.max(maxd, Math.abs(v.L[i] - o.vocL[i]), Math.abs(v.R[i] - o.vocR[i])); e += o.vocL[i] ** 2; }
console.log(`new ${(newMs / 1000).toFixed(1)}s (model ${(modelMs / 1000).toFixed(1)}s) old ${(oldMs / 1000).toFixed(1)}s maxdiff ${maxd.toExponential(2)} rms ${Math.sqrt(e / n).toFixed(4)}`);
