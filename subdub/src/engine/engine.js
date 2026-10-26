// Starts the worker "brains" and loads their models (once; after that they come from the PC's cache).
import { WorkerRPC } from './rpc.js';
import { MODELS } from './models.js';
import { modelCache } from './cache.js';

export const WORKERS = {
  listen: { file: 'w-listen.js', label: 'Voice finder + girl/boy ears' },
  asr: { file: 'w-asr.js', label: 'Speech reader' },
  tts: { file: 'w-tts.js', label: 'English voices' },
  sep: { file: 'w-sep.js', label: 'Voice cutter' },
  eyes: { file: 'w-eyes.js', label: 'Subtitle reader' },
};

// Is there a real graphics card we can use (not a software fallback)?
export async function detectGpu() {
  try {
    if (!navigator.gpu) return { ok: false, why: 'no WebGPU' };
    const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!a) return { ok: false, why: 'no adapter' };
    const info = a.info || {};
    const soft = a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|microsoft basic|llvmpipe/i.test(`${info.vendor} ${info.architecture} ${info.description}`);
    return { ok: !soft, name: [info.vendor, info.architecture, info.description].filter(Boolean).join(' '), soft };
  } catch (e) { return { ok: false, why: e.message }; }
}

export class Engine extends EventTarget {
  constructor(base = './') { super(); this.base = base; this.rpc = {}; this.ready = {}; this.dl = new Map(); this.gpu = null; }
  _progress(name, p) {
    if (p?.url) this.dl.set(p.url, { loaded: p.loaded || 0, total: p.total || p.loaded || 0, done: !!p.done || (p.total && p.loaded >= p.total) });
    this.dispatchEvent(new CustomEvent('progress', { detail: { name, ...this.totals() } }));
  }
  totals() { let loaded = 0, total = 0; for (const f of this.dl.values()) { loaded += f.loaded; total += Math.max(f.total, f.loaded); } return { loaded, total }; }
  _spawn(name) {
    if (this.rpc[name]) return this.rpc[name];
    const w = new Worker(new URL(this.base + WORKERS[name].file, location.href), { type: 'module', name });
    const r = new WorkerRPC(w);
    r.on('progress', (p) => this._progress(name, p));
    r.on('crash', (e) => this.dispatchEvent(new CustomEvent('crash', { detail: { name, error: e } })));
    this.rpc[name] = r;
    return r;
  }
  // Share the CPU instead of every brain grabbing all cores (their threads spin while waiting, so too many
  // threads in total makes everything slower). The speech reader is on the critical path and gets the most.
  threads(name) {
    const n = navigator.hardwareConcurrency || 4;
    const share = { asr: 0.5, tts: 0.3, sep: 0.2, listen: 0.12, eyes: 0.1 }[name] ?? 0.2;
    return Math.max(1, Math.min(name === 'asr' ? 8 : 4, Math.round(n * share)));
  }
  // Start one brain. Falls back from graphics card to CPU if the card refuses.
  async start(name, opts = {}) {
    if (this.ready[name]) return this.ready[name];
    this.ready[name] = (async () => {
      this.gpu ??= await detectGpu();
      const useGpu = opts.gpu ?? (this.gpu.ok && ['asr', 'tts', 'sep'].includes(name) && this.settings?.useGpu !== false);
      const threads = this.threads(name);
      let r = this._spawn(name);
      try {
        await r.call('init', { threads, gpu: useGpu });
      } catch (e) {
        if (!useGpu) throw e;
        console.warn(`${name}: graphics card failed, using CPU`, e);
        r.terminate(); delete this.rpc[name];
        r = this._spawn(name);
        await r.call('init', { threads, gpu: false });
      }
      return r;
    })();
    try { return await this.ready[name]; } catch (e) { delete this.ready[name]; throw e; }
  }
  get(name) { return this.rpc[name]; }
  async stop(name) { if (this.rpc[name]) { this.rpc[name].terminate(); delete this.rpc[name]; delete this.ready[name]; } }
  // Total first-time download for the standard set (MB)
  static setupSizeMB(gpu) {
    const m = MODELS, k = gpu ? 'gpu' : 'cpu';
    return Math.round(m.vad.mb + m.gender.mb + m.speaker.mb + m.sep.fast.mb + m.ocrDet.mb + m.ocrRec.main.mb + m.whisper.good.mb[k] + m.whisper.fast.mb[k] + m.tts.mb[k] + 27 /* runtime */);
  }
  static clearDownloads() { return modelCache.clear(); }
}
