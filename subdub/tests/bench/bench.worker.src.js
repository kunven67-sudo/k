import { setupOrt } from '../../src/engine/ortsetup.js';
import { AutoProcessor, WhisperForConditionalGeneration, Tensor } from '@huggingface/transformers';
self.onmessage = async (e) => {
  const { build, threads, device, dtype } = e.data;
  const log = (m) => self.postMessage({ log: m });
  try {
    const ort = await setupOrt({ build, threads });
    log(`ort threads=${ort.env.wasm.numThreads} coi=${self.crossOriginIsolated}`);
    const id = 'onnx-community/whisper-small';
    const proc = await AutoProcessor.from_pretrained(id);
    const model = await WhisperForConditionalGeneration.from_pretrained(id, { device, dtype: { encoder_model: dtype, decoder_model_merged: dtype } });
    const audio = new Float32Array(16000 * 3).map((_, i) => Math.sin(i / 10) * 0.1);
    const { input_features } = await proc(audio);
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      const out = await model.sessions.model.run({ input_features: input_features.ort_tensor });
      log(`encoder ${(performance.now() - t).toFixed(0)} ms dims ${out.last_hidden_state.dims}`);
    }
    const t = performance.now();
    const ids = await model.generate({ inputs: input_features, language: 'ja', task: 'transcribe', max_new_tokens: 20 });
    log(`generate ${(performance.now() - t).toFixed(0)} ms`);
    self.postMessage({ done: true });
  } catch (err) { self.postMessage({ log: 'ERR ' + err.message + '\n' + err.stack, done: true }); }
};
