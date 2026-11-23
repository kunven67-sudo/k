// Sound: real recorded sounds (assets/sounds) + a few made on the fly (deep space hum, snaps).
'use strict';
const Sfx = (() => {
  let ctx = null, master = null, vol = 0.8; const buf = {}; const fs = require('fs'), path = require('path');
  function init(v) {
    if (ctx) { setVolume(v); return; }
    ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = v == null ? vol : v; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; master.disconnect(); master.connect(comp); comp.connect(ctx.destination);
    const dir = path.join(__dirname, 'assets', 'sounds');
    let files = []; try { files = fs.readdirSync(dir).filter(f => /\.(ogg|mp3)$/.test(f)); } catch (e) {}
    files.forEach(f => { const b = fs.readFileSync(path.join(dir, f)); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      ctx.decodeAudioData(ab).then(d => { buf[f.replace(/\.(ogg|mp3)$/, '')] = d; }).catch(() => {}); });
  }
  function setVolume(v) { vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }
  function chain(o) { // gain -> pan -> master
    const g = ctx.createGain(); g.gain.value = o.vol == null ? 1 : o.vol; let out = g;
    if (o.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); out = p; }
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; out.connect(f); out = f; }
    out.connect(master); return g;
  }
  function play(name, o) {
    if (!ctx || !buf[name]) return null; o = o || {};
    const s = ctx.createBufferSource(); s.buffer = buf[name]; s.playbackRate.value = (o.rate || 1) * (o.vary ? 1 + (Math.random() - 0.5) * o.vary : 1);
    const g = chain(o); s.connect(g); s.start(0, o.offset || 0, o.dur);
    return { stop(f) { try { g.gain.setTargetAtTime(0, ctx.currentTime, (f || 0.1) / 3); s.stop(ctx.currentTime + (f || 0.1)); } catch (e) {} }, gain: g };
  }
  function loop(name, o) {
    if (!ctx || !buf[name]) return { set() {}, stop() {} }; o = o || {};
    const s = ctx.createBufferSource(); s.buffer = buf[name]; s.loop = true; s.playbackRate.value = o.rate || 1;
    const g = chain(Object.assign({}, o, { vol: 0 })); s.connect(g); s.start(0, Math.random() * Math.max(0, buf[name].duration - 1));
    g.gain.setTargetAtTime(o.vol == null ? 1 : o.vol, ctx.currentTime, (o.fade || 0.3) / 3);
    return { set(v, t) { g.gain.setTargetAtTime(v, ctx.currentTime, (t || 0.2) / 3); }, rate(r) { s.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.1); },
      stop(f) { f = f || 0.5; g.gain.setTargetAtTime(0, ctx.currentTime, f / 3); try { s.stop(ctx.currentTime + f * 2); } catch (e) {} } };
  }
  function drone(o) { // deep rumble that rises as you get pulled in
    if (!ctx) return { set() {}, stop() {} }; o = o || {};
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 6; f.connect(g);
    const osc = [38, 38.6, 57].map(fr => { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = fr; s.connect(f); s.start(); return s; });
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nb.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; ns.connect(f); ns.start();
    g.gain.setTargetAtTime(o.vol || 0.5, ctx.currentTime, 0.4);
    return { set(v, pitch) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.1); if (pitch) { osc.forEach((s, i) => s.frequency.setTargetAtTime([38, 38.6, 57][i] * pitch, ctx.currentTime, 0.2)); f.frequency.setTargetAtTime(180 * pitch, ctx.currentTime, 0.2); } },
      stop(t) { t = t || 0.6; g.gain.setTargetAtTime(0, ctx.currentTime, t / 3); setTimeout(() => { osc.forEach(s => s.stop()); ns.stop(); }, t * 2000); } };
  }
  function snap(o) { // short rubber snap made from a filtered click
    if (!ctx) return; o = o || {};
    const n = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate); const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    const s = ctx.createBufferSource(); s.buffer = n; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
    const g = chain({ vol: o.vol || 0.9, pan: o.pan }); s.connect(f); f.connect(g); s.start();
  }
  function stopAll() { if (!ctx) return; master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { master.gain.setTargetAtTime(vol, ctx.currentTime, 0.05); }, 400); }
  return { init, play, loop, drone, snap, setVolume, stopAll, has: n => !!buf[n] };
})();
