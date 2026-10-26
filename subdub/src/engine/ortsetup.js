// Sets up onnxruntime-web (shared with transformers.js) inside a worker:
// wasm runtime files come from jsDelivr once, then from the model cache (works offline after the first run).
import * as ort from 'onnxruntime-web/webgpu';
import { env } from '@huggingface/transformers';
import { modelCache, fetchModel } from './cache.js';

export const ORT_VERSION = '1.31.0-dev.20260914-8d85527a0';
const CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

let ready = null;
// build: 'gpu' = asyncify build (WebGPU + CPU), 'cpu' = plain threaded build (fastest CPU, no WebGPU)
export function setupOrt({ build = 'gpu', threads = 1, onProgress } = {}) {
  ready ??= (async () => {
    const base = build === 'cpu' ? 'ort-wasm-simd-threaded' : 'ort-wasm-simd-threaded.asyncify';
    const [mjs, wasm] = await Promise.all([
      fetchModel(CDN + base + '.mjs'),
      fetchModel(CDN + base + '.wasm', onProgress),
    ]);
    const code = new TextDecoder().decode(mjs).replaceAll('globalThis.process?.versions?.node', 'false');
    ort.env.wasm.wasmPaths = { mjs: URL.createObjectURL(new Blob([code], { type: 'text/javascript' })), wasm: CDN + base + '.wasm' };
    ort.env.wasm.wasmBinary = wasm.buffer.byteLength === wasm.length ? wasm.buffer : wasm.slice().buffer;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, threads) : 1;
    ort.env.wasm.proxy = false;
    ort.env.logLevel = 'error';
    // transformers.js: same runtime, our cache, no local files
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = modelCache;
    env.backends.onnx.logLevel = 'error';
    return ort;
  })();
  return ready;
}

// Create a raw ORT session from a model URL.
export async function session(url, { device = 'wasm', onProgress } = {}) {
  const bytes = await fetchModel(url, onProgress);
  const eps = device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
  return ort.InferenceSession.create(bytes, { executionProviders: eps, logSeverityLevel: 3, graphOptimizationLevel: 'all' });
}

export { ort };
