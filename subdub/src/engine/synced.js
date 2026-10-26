// Synced window: the anime plays inside SUBDUB a few seconds late, so every English line lands right on the mouth.
// Picture: frames are squeezed (WebCodecs) as they arrive and unsqueezed D seconds later.
// Sound: the shared tab plays D seconds late with the voices cut (cheap band cut always ready underneath,
// and clean voice-remover pieces on top whenever the computer keeps up).
import { resample } from '../lib/resample.js';
import { h, icon } from '../ui/dom.js';
import { coverEl } from '../ui/cover.js';

const SEP_SR = 44100;
const PAD = 0.75;     // extra sound on each side so the voice remover has context
const XF = 0.02;      // crossfade between clean pieces

export class SyncedLive {
  constructor({ live, stream, sep, cast, settings, onClose }) {
    this.live = live; this.stream = stream; this.sep = sep; this.cast = cast; this.settings = settings; this.onClose = onClose;
    this.D = Math.max(4, Math.min(20, settings.syncDelay || 8));
    this.chunks = []; this.frames = []; this.subs = []; this.caps = []; this.keeps = []; this.pieces = [];
    this.voiceFree = 0; this.closed = false;
  }

  async open() {
    const live = this.live, ctx = live.ctx;
    if (!ctx || !live.running) throw new Error('Live mode is not running');
    if (!live.ownsSound) throw new Error('Synced only works when you share a browser tab (then SUBDUB plays the sound). Apps and phone mirrors play their own sound, so use the caption bar there.');
    this.ctx = ctx; this.sr = ctx.sampleRate;
    this.openedAt = ctx.currentTime;
    this.out = ctx.createGain(); this.out.connect(ctx.destination);
    this.bgBus = ctx.createGain(); this.bgBus.connect(this.out);
    this.voiceBus = ctx.createGain(); this.voiceBus.connect(this.out);
    // delayed sound (band cut while someone talks); full-quality copies go to the voice remover
    this.tap = new AudioWorkletNode(ctx, 'subdub-tap', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { delay: this.D, passthrough: true, cutDepth: live.cutDepth(), small: false, full: !!this.sep },
    });
    this.tap.port.onmessage = (e) => this._full(e.data);
    live.src.connect(this.tap).connect(this.bgBus);
    live.addTap(this.tap);
    live.sink = this; live.setMuted(true);
    this.applySettings();
    this._ui();
    window.__subdubSynced = this; // (for tests)
    this._startVideo().catch((e) => this._note('Picture problem: ' + e.message));
    this.raf = requestAnimationFrame(() => this._frame());
  }

  applySettings() {
    const s = this.settings, now = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(s.volume ?? 1, now, 0.03);
    this.bgBus.gain.setTargetAtTime(s.bgVolume ?? 1, now, 0.03);
    this.voiceBus.gain.setTargetAtTime(s.mode === 'captions' || s.mode === 'original' ? 0 : (s.voiceVolume ?? 1), now, 0.03);
    if (this.capsEl) this.capsEl.style.setProperty('--capsize', s.capSize + 'px');
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.raf);
    this.live.removeTap(this.tap);
    if (this.live.sink === this) this.live.sink = null;
    this.live.setMuted(false);
    try { this.tap.disconnect(); this.live.src.disconnect(this.tap); } catch {}
    for (const p of this.pieces) for (const n of p.nodes || []) { try { n.stop(); } catch {} }
    try { this.out.disconnect(); } catch {}
    this.reader?.cancel().catch(() => {});
    this.track?.stop();
    try { this.enc?.close(); } catch {}
    try { this.dec?.close(); } catch {}
    for (const f of this.frames) f.img.close();
    this.frames = []; this.chunks = [];
    document.removeEventListener('keydown', this.keys);
    if (document.fullscreenElement === this.el) document.exitFullscreen().catch(() => {});
    this.el?.remove();
    this.onClose?.();
  }

  // ---------- picture ----------
  async _startVideo() {
    const vt = this.stream.getVideoTracks()[0];
    if (!vt) return;
    this.track = vt.clone();
    if ('MediaStreamTrackProcessor' in window && 'VideoEncoder' in window) {
      this.reader = new MediaStreamTrackProcessor({ track: this.track }).readable.getReader();
      while (!this.closed) {
        const { value: frame, done } = await this.reader.read();
        if (done) break;
        const t = this.ctx.currentTime; // arrival, on the same clock as the sound
        try { await this._encode(frame, t); } finally { frame.close(); }
      }
    } else {
      // older browsers: keep small pictures instead (uses more memory, so they are smaller)
      const v = h('video', { muted: true, playsinline: true });
      v.srcObject = new MediaStream([this.track]); v.muted = true; await v.play();
      const grab = async () => {
        if (this.closed) return;
        if (v.videoWidth) {
          const w = Math.min(640, v.videoWidth), hh = Math.round(v.videoHeight * w / v.videoWidth);
          const img = await createImageBitmap(v, { resizeWidth: w, resizeHeight: hh });
          this.frames.push({ t: this.ctx.currentTime, img });
          this._dropOldFrames();
        }
        v.requestVideoFrameCallback(grab);
      };
      v.requestVideoFrameCallback(grab);
    }
  }
  async _encode(frame, t) {
    const W = Math.min(1280, frame.displayWidth) & ~1, H = Math.round(frame.displayHeight * W / frame.displayWidth) & ~1;
    if (!this.enc || this.encW !== W || this.encH !== H) await this._makeEncoder(W, H);
    if (!this.enc || this.enc.encodeQueueSize > 3) return; // computer busy: skip this frame, never fall behind
    this.ox.drawImage(frame, 0, 0, W, H);
    const vf = new VideoFrame(this.oc, { timestamp: Math.round(t * 1e6) });
    this.enc.encode(vf, { keyFrame: this.nEnc++ % 60 === 0 });
    vf.close();
  }
  async _makeEncoder(W, H) {
    try { this.enc?.close(); } catch {}
    this.enc = null; this.encW = W; this.encH = H; this.nEnc = 0;
    this.oc = new OffscreenCanvas(W, H); this.ox = this.oc.getContext('2d');
    const tries = [
      { codec: 'avc1.42E01F', avc: { format: 'annexb' } },
      { codec: 'vp8' },
      { codec: 'vp09.00.10.08' },
    ];
    for (const c of tries) {
      const cfg = { ...c, width: W, height: H, bitrate: Math.round(W * H * 4), framerate: 30, latencyMode: 'realtime' };
      const ok = await VideoEncoder.isConfigSupported(cfg).catch(() => null);
      if (!ok?.supported) continue;
      // must be able to unsqueeze it again too (some browsers can only do one direction)
      const back = await VideoDecoder.isConfigSupported({ codec: c.codec, codedWidth: W, codedHeight: H }).catch(() => null);
      if (!back?.supported) continue;
      let decCfg = null;
      this.enc = new VideoEncoder({
        output: (chunk, meta) => {
          if (meta?.decoderConfig) decCfg = { ...meta.decoderConfig };
          if (!decCfg) decCfg = { codec: c.codec, codedWidth: W, codedHeight: H };
          this.chunks.push({ t: chunk.timestamp / 1e6, key: chunk.type === 'key', chunk, cfg: decCfg });
          // keep only what's still to be shown (+ a little)
          const keepFrom = this.ctx.currentTime - this.D - 3;
          while (this.chunks.length > 2 && this.chunks[1].t < keepFrom) this.chunks.shift();
        },
        error: (e) => { this._note('Picture squeezer stopped: ' + e.message); this.enc = null; },
      });
      this.enc.configure(cfg);
      return;
    }
    throw new Error('this browser can\'t squeeze video (WebCodecs)');
  }
  _decodeUpTo(t) {
    // hand the decoder every squeezed frame due soon, starting at a key frame
    let i = this.fed ? this.chunks.indexOf(this.fed) + 1 : 0;
    if (this.fed && i === 0) { this.fed = null; this.decReady = false; } // fell out of the list: restart at a key frame
    const late = this.chunks.find(c => c.key && c.t <= t && c.t > t - 1.5);
    // too far behind (computer was busy)? jump to the newest key frame
    if (this.fed && this.fed.t < t - 1.2 && late && late !== this.fed) { this.decReady = false; i = this.chunks.indexOf(late); }
    for (; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (c.t > t + 0.25) break;
      if (!this.decReady) {
        if (!c.key) continue;
        try { this.dec?.close(); } catch {}
        this.dec = new VideoDecoder({
          output: (f) => { this.frames.push({ t: f.timestamp / 1e6, img: f }); this._dropOldFrames(); },
          error: (e) => { this.decReady = false; this.decErrors = (this.decErrors || 0) + 1; if (this.decErrors === 5) this._note('Picture problem: ' + e.message); },
        });
        this.dec.configure(c.cfg); this.decCfg = c.cfg; this.decReady = true;
      } else if (c.cfg !== this.decCfg) { this.dec.configure(c.cfg); this.decCfg = c.cfg; if (!c.key) { this.decReady = false; continue; } }
      if (this.dec.decodeQueueSize > 8) break;
      this.dec.decode(c.chunk); this.fed = c;
    }
  }
  _dropOldFrames() {
    const t = this.playTime();
    while (this.frames.length > 1 && this.frames[1].t <= t) this.frames.shift().img.close();
    if (this.frames.length > 400) this.frames.shift().img.close();
  }
  // what moment of the input is on screen now (sound comes out a little after it's scheduled)
  playTime() { return this.ctx.currentTime - this.D - (this.ctx.outputLatency || this.ctx.baseLatency || 0.02); }

  // ---------- sound: clean pieces from the voice remover ----------
  _full({ L, R, tEnd }) {
    if (this.closed || !this.sep || this.settings.mode !== 'dub') { this.buf = null; return; }
    const sr = this.sr, n = L.length;
    if (!this.buf) { this.buf = { L: [], R: [], t0: tEnd - n / sr, n: 0 }; this.nextS = this.buf.t0 + PAD; }
    const b = this.buf; b.L.push(L); b.R.push(R); b.n += n;
    // drop sound older than we'll ever need
    while (b.L.length > 1 && b.t0 + b.L[0].length / sr < this.nextS - PAD - 0.5) { b.t0 += b.L[0].length / sr; b.n -= b.L[0].length; b.L.shift(); b.R.shift(); }
    // piece length: as long as possible while still finishing before it has to play (sound waits PIECE + PAD,
    // then the voice remover needs its time)
    const PIECE = this.piece();
    if (this.sepBusy || tEnd < this.nextS + PIECE + PAD) return;
    // fell behind (computer busy)? skip to the newest piece we can still finish in time
    const need = (this.lastSepMs || 1500) / 1000 + 0.4;
    if (this.nextS + this.D - this.ctx.currentTime < need) this.nextS = Math.max(this.nextS, tEnd - PAD - PIECE);
    this._clean(this.nextS, this.nextS + PIECE).catch(() => {});
  }
  piece() {
    const need = (this.lastSepMs || 1500) / 1000;
    return Math.max(2, Math.min(6, this.D - PAD - need * 1.3 - 0.8));
  }
  _slice(a, b) {
    const sr = this.sr, buf = this.buf, i0 = Math.round((a - buf.t0) * sr), len = Math.round((b - a) * sr);
    const L = new Float32Array(len), R = new Float32Array(len);
    let off = 0;
    for (let k = 0; k < buf.L.length && off < i0 + len; k++) {
      const cl = buf.L[k], cr = buf.R[k];
      const from = Math.max(0, i0 - off), to = Math.min(cl.length, i0 + len - off);
      if (to > from) { L.set(cl.subarray(from, to), off + from - i0); R.set(cr.subarray(from, to), off + from - i0); }
      off += cl.length;
    }
    return { L, R };
  }
  async _clean(s, e) {
    this.sepBusy = true; this.nextS = e;
    const started = performance.now();
    try {
      const a = s - PAD, b = e + PAD, sr = this.sr;
      const raw = this._slice(a, b);
      const L = resample(raw.L, sr, SEP_SR), R = resample(raw.R, sr, SEP_SR);
      const v = await this.sep.call('separate', { L: L.slice(), R: R.slice() });
      if (this.closed) return;
      const playAt = s - XF + this.D;
      if (playAt < this.ctx.currentTime + 0.12) { this.slow = (this.slow || 0) + 1; return; } // too late: band cut covers it
      // background = original - voices, back at the sound card's rate
      const i0 = Math.round((PAD - XF) * SEP_SR), len = Math.round((e - s + 2 * XF) * SEP_SR);
      const bgL = new Float32Array(len), bgR = new Float32Array(len), vL = new Float32Array(len), vR = new Float32Array(len);
      for (let i = 0; i < len; i++) { vL[i] = v.L[i0 + i]; vR[i] = v.R[i0 + i]; bgL[i] = L[i0 + i] - vL[i]; bgR[i] = R[i0 + i] - vR[i]; }
      const piece = { s, e, playAt, vL: resample(vL, SEP_SR, sr), vR: resample(vR, SEP_SR, sr), nodes: [] };
      piece.nodes.push(this._playStereo(resample(bgL, SEP_SR, sr), resample(bgR, SEP_SR, sr), playAt, this.bgBus));
      this.tap.port.postMessage({ mute: [s - XF / 2, e + XF / 2] }); // the band-cut copy goes quiet here
      this.pieces.push(piece);
      while (this.pieces.length && this.pieces[0].e < this.ctx.currentTime - this.D - 2) this.pieces.shift();
      for (const k of this.keeps) this._keepIn(piece, k.a, k.b);
      this.slow = 0;
    } finally {
      this.sepBusy = false;
      this.lastSepMs = performance.now() - started;
    }
  }
  _playStereo(L, R, at, bus, fade = XF) {
    const ctx = this.ctx, sr = this.sr, n = L.length, f = Math.min(n >> 1, Math.round(fade * 2 * sr));
    for (let i = 0; i < f; i++) { const g = i / f; L[i] *= g; R[i] *= g; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
    const ab = ctx.createBuffer(2, n, sr); ab.copyToChannel(L, 0); ab.copyToChannel(R, 1);
    const src = ctx.createBufferSource(); src.buffer = ab; src.connect(bus);
    src.start(Math.max(at, ctx.currentTime + 0.005));
    return src;
  }
  // a line that keeps its real voice (scream, laugh, English): put the voice back in
  keep(a, b) {
    if (this.settings.mode !== 'dub') return;
    this.tap.port.postMessage({ uncut: [a - 0.05, b + 0.05] });
    this.keeps.push({ a, b });
    while (this.keeps.length > 20) this.keeps.shift();
    for (const p of this.pieces) this._keepIn(p, a, b);
  }
  _keepIn(p, a, b) {
    const s = Math.max(a, p.s - XF), e = Math.min(b, p.e + XF);
    if (e - s < 0.05) return;
    const at = s + this.D;
    if (at < this.ctx.currentTime + 0.05) return;
    const sr = this.sr, i0 = Math.round((s - (p.s - XF)) * sr), n = Math.round((e - s) * sr);
    p.nodes.push(this._playStereo(p.vL.slice(i0, i0 + n), p.vR.slice(i0, i0 + n), at, this.bgBus, 0.01));
  }

  // ---------- English lines ----------
  speak(line, audio, gain, tIn) {
    if (this.closed || tIn < this.openedAt - 0.5) return;
    const ctx = this.ctx, now = ctx.currentTime + 0.02;
    let at = Math.max(tIn + this.D, now, this.voiceFree - 0.1);
    const ab = ctx.createBuffer(1, audio.length, this.sr); ab.copyToChannel(audio, 0);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = ab; g.gain.value = gain; src.connect(g).connect(this.voiceBus);
    src.start(at);
    this.voiceFree = at + ab.duration;
    const c = this.cast.byId(line.charId);
    this.caps.push({ at, end: at + ab.duration + 0.4, text: line.en, color: c?.color });
    while (this.caps.length > 12) this.caps.shift();
    this.late = Math.max(0, at - (tIn + this.D));
  }
  addSubtitle(s) { if (this.subs.includes(s)) return; this.subs.push(s); while (this.subs.length > 30) this.subs.shift(); }

  // ---------- screen ----------
  _ui() {
    this.cv = h('canvas', { class: 'synccv' });
    this.capsEl = h('div', { class: 'caps' });
    this.coversEl = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
    this.count = h('div', { class: 'synccount' }, '');
    this.noteEl = h('div', { class: 'syncnote', hidden: true });
    this.lagEl = h('span', { class: 'time' }, '');
    const full = h('button', { class: 'iconbtn', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : this.el.requestFullscreen()) }, icon('full'), 'Fullscreen');
    const back = h('button', { class: 'iconbtn', onclick: () => this.close() }, icon('x'), 'Back to live');
    this.bar = h('div', { class: 'syncbar' }, h('b', {}, 'Synced'), h('span', { class: 'time' }, `${this.D} s behind live`), this.lagEl, h('span', { style: { flex: 1 } }), full, back);
    this.el = h('div', { class: 'synced' }, this.cv, this.coversEl, this.capsEl, this.count, this.noteEl, this.bar);
    document.body.append(this.el);
    let hide = null;
    const showBar = () => { this.bar.classList.remove('gone'); clearTimeout(hide); hide = setTimeout(() => this.bar.classList.add('gone'), 2500); };
    this.el.addEventListener('pointermove', showBar); showBar();
    this.keys = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) this.close();
      else if (e.key === 'f' || e.key === 'F') full.click();
    };
    document.addEventListener('keydown', this.keys);
  }
  _note(t) { this.noteEl.hidden = false; this.noteEl.textContent = t; }
  _frame() {
    if (this.closed) return;
    this.raf = requestAnimationFrame(() => this._frame());
    const t = this.playTime(), now = this.ctx.currentTime;
    // countdown while the first seconds fill up
    const left = this.openedAt + this.D - now;
    this.count.hidden = left <= 0;
    if (left > 0) this.count.textContent = `Getting ${this.D} seconds ahead… ${Math.ceil(left)}`;
    if (this.chunks.length) this._decodeUpTo(t);
    // newest picture that's due
    let f = null;
    for (const x of this.frames) { if (x.t <= t) f = x; else break; }
    if (f) {
      const w = f.img.displayWidth || f.img.width, hh = f.img.displayHeight || f.img.height;
      if (this.cv.width !== w || this.cv.height !== hh) { this.cv.width = w; this.cv.height = hh; }
      this.cv.getContext('2d').drawImage(f.img, 0, 0);
    }
    this._dropOldFrames();
    // captions + English over foreign subtitles
    this.capsEl.textContent = ''; this.coversEl.textContent = '';
    const S = this.settings;
    if (S.showCaps && S.mode !== 'original') {
      const r = this.el.getBoundingClientRect(), vw = this.cv.width, vh = this.cv.height;
      let bottomCover = false;
      if (vw && vh) {
        for (const s of this.subs) {
          if (!s.en || s.lang === 'en' || !s.box) continue;
          const e = Math.max(s.e ?? s.s, s.s + 1.2);
          if (t < s.s || t > e + 0.2) continue;
          this.coversEl.append(coverEl(s.box, r, vw, vh, s.en));
          if (s.box.y > 0.5) bottomCover = true;
        }
      }
      if (!bottomCover) for (const c of this.caps) if (now >= c.at && now <= c.end) this.capsEl.append(h('div', { class: 'cap' }, h('span', { class: 'who', style: { background: c.color || '#fff' } }), c.text));
    }
    this.lagEl.textContent = this.late > 0.4 ? ` · English ${this.late.toFixed(1)} s late (computer busy)` : '';
  }
}
