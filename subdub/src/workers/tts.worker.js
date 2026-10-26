// "Speak" worker: English voices (Kokoro).
import { serve, withTransfer } from '../engine/rpc.js';
import { setupOrt } from '../engine/ortsetup.js';
import { MODELS } from '../engine/models.js';
import { Kokoro } from '../engine/kokoro.js';

let tts = null;
serve({
  async init({ threads = 2, gpu = false }, emit) {
    await setupOrt({ threads, onProgress: (p) => emit('progress', p) });
    const device = gpu ? 'webgpu' : 'wasm';
    tts = await Kokoro.load(MODELS.tts.id, { device, dtype: gpu ? MODELS.tts.gpu : MODELS.tts.cpu, onProgress: (p) => emit('progress', p) });
    return device;
  },
  async warm({ mixes = [] }) { for (const m of mixes) await tts.style(m); return true; },
  async speak({ text, mix, speed = 1 }) {
    const t = performance.now();
    const audio = await tts.speak(text, { mix, speed });
    return withTransfer({ audio, sr: tts.sr, ms: performance.now() - t }, [audio.buffer]);
  },
});
