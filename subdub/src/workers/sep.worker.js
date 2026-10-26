// "Cut" worker: removes the voices from the soundtrack (keeps music + sound effects).
import { serve, withTransfer } from '../engine/rpc.js';
import { setupOrt, session, ort } from '../engine/ortsetup.js';
import { MODELS } from '../engine/models.js';
import { MdxSeparator } from '../lib/mdx.js';
import { SpleeterSeparator } from '../lib/spleeter.js';

const seps = {};
let device = 'wasm';
async function get(kind, emit) {
  if (seps[kind]) return seps[kind];
  const onProgress = (p) => emit('progress', p);
  if (kind === 'best') {
    const s = await session(MODELS.sep.best.url, { device, onProgress });
    seps.best = new MdxSeparator(async (inp, dims) => (await s.run({ input: new ort.Tensor('float32', inp, dims) })).output.data);
  } else {
    const [v, m] = await Promise.all([session(MODELS.sep.fast.vocals, { device, onProgress }), session(MODELS.sep.fast.music, { device, onProgress })]);
    const run = (s) => async (inp, dims) => (await s.run({ x: new ort.Tensor('float32', inp, dims) })).y.data;
    seps.fast = new SpleeterSeparator(run(v), run(m));
  }
  return seps[kind];
}
serve({
  async init({ threads = 4, gpu = false, kind = 'fast' }, emit) {
    await setupOrt({ threads, onProgress: (p) => emit('progress', p) });
    device = gpu ? 'webgpu' : 'wasm';
    await get(kind, emit);
    return device;
  },
  // L, R: 44.1 kHz stereo pieces -> voices only (L, R). Background = original - voices.
  async separate({ L, R, kind = 'fast' }, emit) {
    const sep = await get(kind, emit);
    const v = await sep.separate(L, R, { onProgress: (f) => emit('sepProgress', f) });
    return withTransfer(v, [v.L.buffer, v.R.buffer]);
  },
});
