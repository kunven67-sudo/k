// THE MASK - your voice: the mic is recorded with each copy, and the copy says it again from its own mouth (3D sound).
import { audio } from './audio.js';

let stream = null, node = null, chunks = [], capturing = false, worklet = false, sinkNode = null;
const CAP = `class C extends AudioWorkletProcessor{constructor(){super();this.on=false;this.b=new Float32Array(2048);this.n=0;this.port.onmessage=(e)=>{this.on=e.data;if(!e.data)this.n=0;};}
process(inp){const ch=inp[0]&&inp[0][0];if(this.on&&ch){for(let i=0;i<ch.length;i++){this.b[this.n++]=ch[i];if(this.n===2048){this.port.postMessage(this.b);this.b=new Float32Array(2048);this.n=0;}}}return true;}}
registerProcessor('mask-cap',C);`;

export const voice = {
  get on() { return !!stream; },
  get denied() { return this._denied; },
  async enable() {
    const ctx = audio.init(); if (!ctx) return false;
    if (stream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
    catch (e) { stream = null; this._denied = true; return false; }
    const src = ctx.createMediaStreamSource(stream);
    try {
      const url = URL.createObjectURL(new Blob([CAP], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      node = new AudioWorkletNode(ctx, 'mask-cap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      node.port.onmessage = (e) => { if (capturing) chunks.push(e.data); };
      worklet = true;
    } catch (e) {
      node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => { if (capturing) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    }
    sinkNode = ctx.createGain(); sinkNode.gain.value = 0; // keeps the capture running without playing your mic back to you
    src.connect(node); node.connect(sinkNode); sinkNode.connect(ctx.destination);
    if (capturing && worklet) node.port.postMessage(true);
    return true;
  },
  disable() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; capturing = false;
  },
  start() { chunks = []; capturing = true; if (worklet && node) node.port.postMessage(true); },
  stop() { capturing = false; if (worklet && node) node.port.postMessage(false); },
  // everything said since start(); null when it was quiet (no voice for that copy)
  take(maxSec = 120) {
    const ctx = audio.ctx; if (!ctx || !chunks.length) { chunks = []; return null; }
    let n = 0; for (const c of chunks) n += c.length;
    n = Math.min(n, ctx.sampleRate * maxSec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let o = 0, peak = 0, loud = 0;
    for (const c of chunks) { for (let i = 0; i < c.length && o < n; i++, o++) { d[o] = c[i]; const a = Math.abs(c[i]); if (a > peak) peak = a; if (a > 0.06) loud++; } }
    chunks = [];
    if (peak < 0.05 || loud < ctx.sampleRate * 0.05) return null; // nothing said
    return buf;
  }
};

// a copy's mouth: plays its recording from where its mask is
export function mouth(buffer, { loop = false, loopEnd = 0 } = {}) {
  const ctx = audio.ctx; if (!ctx || !buffer) return null;
  const out = ctx.createGain(); const pan = audio.panner(null, audio.voiceBus()); out.connect(pan);
  let src = null, muted = false, pauseUntil = 0;
  const h = {
    restart(offset = 0) {
      if (src) { try { src.stop(); } catch (e) { /* done */ } src.disconnect(); }
      src = ctx.createBufferSource(); src.buffer = buffer; src.loop = loop;
      if (loop) { src.loopStart = 0; src.loopEnd = loopEnd || buffer.duration; }
      src.connect(out);
      const off = loop ? offset % (loopEnd || buffer.duration) : offset;
      if (off < buffer.duration) src.start(ctx.currentTime, Math.max(0, off));
    },
    move(p) { audio.setPannerPos(pan, p); },
    mute(m) { muted = m; out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03); },
    pause(sec) { out.gain.setTargetAtTime(0, ctx.currentTime, 0.03); clearTimeout(pauseUntil); pauseUntil = setTimeout(() => { if (!muted) out.gain.setTargetAtTime(1, ctx.currentTime, 0.05); }, sec * 1000); },
    stop() { if (src) { try { src.stop(); } catch (e) { /* done */ } } pan.disconnect(); }
  };
  return h;
}
