// Live mode: dub whatever you picked (a browser tab, an app window, or the whole screen) while it plays.
// Tab: we get its sound alone, mute it, and play it back ourselves with the voices cut out -> you only hear English.
// Window/screen: the app keeps playing its own sound (a website can't mute other apps), so English goes on top.
import { resample, semitones, rms, fadeEdges } from '../lib/resample.js';
import { VAD_HOP } from '../lib/vad.js';
import { looksEnglish } from './textclean.js';
import { isNonverbal } from './nonverbal.js';
import { hearRound } from './hearround.js';

const RING = 16000 * 60; // one minute of 16 kHz audio

export class LiveDub extends EventTarget {
  constructor({ engine, cast, translate, settings, workletUrl }) {
    super();
    this.e = engine; this.cast = cast; this.tr = translate; this.settings = settings; this.workletUrl = workletUrl;
    this.ring = new Float32Array(RING); this.ringEnd = 0;  // samples written in total
    this.t0 = null;          // input time of 16k sample 0
    this.queue = []; this.busy = false; this.speaking = null; this.voiceFree = 0;
    this.langVotes = {}; this.showLang = null; this.subs = [];
    this.stats = { lines: 0, lagMs: 0 };
    this.taps = new Set();   // extra taps (synced window) get the same cut messages
    this.sink = null;        // synced window: plays lines on time instead of right away
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  async start() {
    const s = this.settings;
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 }, width: { ideal: 1920 } },
      audio: { suppressLocalAudioPlayback: true, restrictOwnAudio: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
      systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include', preferCurrentTab: false, monitorTypeSurfaces: 'include',
    });
    const vt = this.stream.getVideoTracks()[0], at = this.stream.getAudioTracks()[0];
    this.surface = vt?.getSettings().displaySurface || 'unknown';
    this.title = vt?.label || '';
    this.hasAudio = !!at;
    vt?.addEventListener('ended', () => this.stop('ended'));
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    await this.ctx.audioWorklet.addModule(this.workletUrl);
    this.out = this.ctx.createGain(); this.out.connect(this.ctx.destination);
    this.voiceBus = this.ctx.createGain(); this.voiceBus.connect(this.out);
    this.bgBus = this.ctx.createGain(); this.bgBus.connect(this.out);
    // tab sound is muted by the browser for us -> we play it (with voices cut). Other sources play by themselves.
    this.ownsSound = this.surface === 'browser' && this.hasAudio;
    if (this.hasAudio) {
      this.src = this.ctx.createMediaStreamSource(new MediaStream([at]));
      this.tap = new AudioWorkletNode(this.ctx, 'subdub-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { delay: 0.3, passthrough: this.ownsSound, cutDepth: this.cutDepth() } });
      this.src.connect(this.tap).connect(this.bgBus);
      this.tap.port.onmessage = (e) => this._pcm(e.data);
    }
    this.applySettings();
    this.running = true;
    this.emit('started', { surface: this.surface, title: this.title, hasAudio: this.hasAudio, ownsSound: this.ownsSound });
    return this.stream;
  }
  cutDepth() { return this.settings.mode === 'dub' || !this.settings.mode ? 0.05 : 1; }
  applySettings() {
    const s = this.settings;
    if (this.out) this.out.gain.value = s.volume ?? 1;
    this._post({ cutDepth: this.cutDepth() });
    this._applyMute();
  }
  _post(m) {
    this.tap?.port.postMessage(m); for (const t of this.taps) t.port.postMessage(m);
    // remember recent cuts so a tap added later (synced window) knows about talking that already started
    this.cutLog ??= [];
    if (m.cut) { this.cutLog.push([...m.cut]); if (this.cutLog.length > 30) this.cutLog.shift(); }
    if (m.endCut !== undefined) { const c = this.cutLog.at(-1); if (c && c[1] === Infinity) c[1] = m.endCut; }
  }
  addTap(t) { this.taps.add(t); for (const c of this.cutLog || []) t.port.postMessage({ cut: [...c] }); t.port.postMessage({ cutDepth: this.cutDepth() }); }
  removeTap(t) { this.taps.delete(t); }
  // the synced window plays the sound itself: the live path goes quiet
  setMuted(m) { this.muted = !!m; this._applyMute(); }
  _applyMute() {
    if (!this.out) return;
    const s = this.settings, now = this.ctx.currentTime;
    this.bgBus.gain.setTargetAtTime(this.muted ? 0 : (s.bgVolume ?? 1), now, 0.03);
    this.voiceBus.gain.setTargetAtTime(this.muted || s.mode === 'captions' ? 0 : (s.voiceVolume ?? 1), now, 0.03);
  }
  stop(why = 'stopped') {
    if (!this.running) return;
    this.running = false;
    this.stream?.getTracks().forEach(t => t.stop());
    try { this.ctx?.close(); } catch {}
    this.e.listen?.call('vadReset', { id: 'live' }).catch(() => {});
    this.emit('stopped', { why });
  }

  // ---- voice finding on the 16 kHz copy ----
  _pcm({ pcm, t }) {
    if (!this.running) return;
    if (this.t0 === null) this.t0 = t - pcm.length / 16000;
    for (let i = 0; i < pcm.length; i++) this.ring[(this.ringEnd + i) % RING] = pcm[i];
    this.ringEnd += pcm.length;
    if (!this.e.listen) return;   // brains still loading: keep the sound, start finding voices once they're up
    if (this.vadOff === undefined) this.vadOff = (this.ringEnd - pcm.length) / 16000;
    this._vadChain = (this._vadChain || Promise.resolve()).then(() => this._vad(pcm)).catch(e => this.emit('error', e));
  }
  _timeOf(sample) { return this.t0 + sample / 16000; }
  async _vad(pcm) {
    const probs = await this.e.listen.call('vadStream', { id: 'live', audio: pcm });
    this.vadPos ??= 0; // in 512-sample windows
    const on = 0.5, off = 0.35, hop = VAD_HOP;
    for (const p of probs) {
      const t = this.vadOff + this.vadPos * hop; this.vadPos++;
      if (!this.cur) {
        if (p >= on) {
          this.cur = { s: t, last: t };
          // start cutting the voice (a bit earlier than we noticed it)
          this._post({ cut: [this._timeOf(Math.max(0, t - 0.12) * 16000), Infinity] });
          this.emit('hearing', true);
        }
      } else {
        if (p >= off) this.cur.last = t;
        const long = t - this.cur.s > 11;
        if (t - this.cur.last >= 0.32 || (long && p < 0.6)) {
          const seg = { s: Math.max(0, this.cur.s - 0.1), e: this.cur.last + hop + 0.1 };
          this.cur = null;
          this._post({ endCut: this._timeOf(seg.e * 16000) + 0.05 });
          this.emit('hearing', false);
          if (seg.e - seg.s >= 0.3) this._line(seg);
        }
      }
    }
  }
  _audioOf(seg) {
    const a = Math.floor(seg.s * 16000), b = Math.floor(seg.e * 16000);
    if (b > this.ringEnd || this.ringEnd - a > RING) return null;
    const out = new Float32Array(b - a);
    for (let i = a; i < b; i++) out[i - a] = this.ring[i % RING];
    return out;
  }

  // ---- one spoken line -> English ----
  _line(seg) {
    const audio = this._audioOf(seg);
    if (!audio) return;
    this.queue.push({ seg, audio, heardAt: performance.now() });
    // if we fall far behind, drop the oldest lines (live must stay live)
    while (this.queue.length > 8) this.queue.shift();
    this._work();
  }
  _leadLang() {
    if (this.settings.forceLang) return this.settings.forceLang;
    if (this.showLang) return this.showLang;
    const best = Object.entries(this.langVotes).sort((x, y) => y[1] - x[1])[0];
    return best && best[1] >= 4 ? best[0] : null;
  }
  async _work() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length && this.running) {
        // everything that's waiting (up to ~26 s of talking) is read in one pass of the big model
        const jobs = [];
        let tot = 0;
        while (this.queue.length && (!jobs.length || tot + this.queue[0].audio.length / 16000 <= 26)) { const j = this.queue.shift(); jobs.push(j); tot += j.audio.length / 16000 + 0.8; }
        await this._doRound(jobs).catch(e => this.emit('error', e));
      }
    } finally { this.busy = false; }
  }
  async _doRound(jobs) {
    const [infos, heards] = await Promise.all([
      Promise.all(jobs.map(j => this.e.listen.call('analyze', { audio: j.audio }))),
      hearRound(this.e.asr, jobs.map(j => j.audio), { tier: this.settings.liveModel || 'good', lead: this._leadLang(), showLang: this.showLang, force: this.settings.forceLang || null }),
    ]);
    for (let i = 0; i < jobs.length && this.running; i++) await this._doLine(jobs[i], infos[i], heards[i]).catch(e => this.emit('error', e));
  }
  async _doLine({ seg, audio, heardAt }, info, heard) {
    const dur = seg.e - seg.s, tIn = this._timeOf(seg.s * 16000);
    if (!this.running) return;
    if (heard.lang !== 'en') { this.langVotes[heard.lang] = (this.langVotes[heard.lang] || 0) + dur; const tot = Object.values(this.langVotes).reduce((a, b) => a + b, 0); const b = Object.entries(this.langVotes).sort((x, y) => y[1] - x[1])[0]; if (tot > 15 && b[1] / tot > 0.6) this.showLang = b[0]; }
    const ch = this.cast.match(info, tIn);
    const text = heard.sentences.map(x => x.text).join(' ').trim();
    const line = { id: 'live' + Math.round(tIn * 1000), t: tIn, s: seg.s, e: seg.e, charId: ch.id, lang: heard.lang, src: text, en: '', keep: false, why: '' };
    if (!text) { line.keep = true; line.why = 'unclear'; }
    else if (heard.lang === 'en' || looksEnglish(text)) { line.keep = true; line.why = 'english'; line.en = text; }
    else if (isNonverbal(text)) { line.keep = true; line.why = 'sound'; }
    if (line.keep) {
      // screams, laughs, English: give the real voice back (it was cut while we listened)
      this._restore(audio, seg);
      this.emit('line', line);
      return;
    }
    // English subtitles on screen at the same time are better than our own translation
    line.en = this._subtitleFor(tIn, tIn + dur) || await this.tr.toEnglish(text, heard.lang);
    if (!this.running) return;
    if (isNonverbal(text, line.en)) { line.keep = true; line.why = 'sound'; this._restore(audio, seg); this.emit('line', line); return; }
    ch.lastText = line.en;
    this.emit('line', line);
    await this._speak(line, ch, rms(audio), dur, heardAt);
  }
  // the real voice comes back (we cut it while it was being said; it plays right now instead)
  _restore(audio16, seg) {
    if (this.sink) { this.sink.keep(this._timeOf(seg.s * 16000), this._timeOf(seg.e * 16000)); return; }
    if (!this.ownsSound || this.settings.mode !== 'dub') return;
    const x = fadeEdges(resample(audio16, 16000, this.ctx.sampleRate), this.ctx.sampleRate);
    this._play(x, 0.9, this.bgBus);
  }
  async _speak(line, ch, srcLoud, dur, heardAt) {
    const v = this.cast.voice(ch), ratio = semitones(v.shift || 0);
    // live lines may run a little faster so we keep up
    const behind = this.queue.length, sink = this.sink;
    // synced window: there's time, so fit the line to how long it was said; live: a bit faster to keep up
    let speed = sink ? Math.min(1.5, Math.max(0.9, (line.en.length / 15) / (dur + 0.3)))
      : Math.min(1.5, Math.max(1.0, (line.en.length / 15) / (dur + 0.6)) * (1 + 0.12 * behind));
    const r = await this.e.tts.call('speak', { text: line.en, mix: v.mix, speed: speed / ratio });
    if (!this.running) return;
    const sr = this.ctx.sampleRate;
    const out = fadeEdges(resample(r.audio, r.sr * ratio, sr), sr);
    const g = Math.min(4, Math.max(0.35, (Math.max(0.03, Math.min(0.25, srcLoud)) * 1.1) / (rms(out) || 1)));
    line.dur = out.length / sr; line.voiceId = v.id;
    this.stats.lagMs = performance.now() - heardAt; this.stats.lines++;
    if (sink && this.sink === sink) { sink.speak(line, out, g, this._timeOf(line.s * 16000)); this.emit('speak', { line, at: null, lagMs: this.stats.lagMs }); return; }
    const at = this._play(out, g, this.voiceBus, true);
    this.emit('speak', { line, at, lagMs: this.stats.lagMs });
  }
  _play(x, gain, bus, queue = false) {
    const ab = this.ctx.createBuffer(1, x.length, this.ctx.sampleRate); ab.copyToChannel(x, 0);
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = ab; g.gain.value = gain; src.connect(g).connect(bus);
    const now = this.ctx.currentTime + 0.02;
    const at = queue ? Math.max(now, this.voiceFree) : now;
    src.start(at);
    if (queue) this.voiceFree = at + ab.duration + 0.05;
    return at;
  }
  // ---- English subtitles seen on screen (from the subtitle reader) ----
  addSubtitle(sub) { if (this.subs.includes(sub)) return; this.subs.push(sub); if (this.subs.length > 30) this.subs.shift(); }
  _subtitleFor(a, b) {
    const hits = this.subs.filter(x => x.lang === 'en' && Math.min(b, x.e ?? x.s + 4) - Math.max(a, x.s) > 0.3);
    return hits.length ? hits.map(x => x.text).join(' ') : null;
  }
  nowInput() { return this.ctx ? this.ctx.currentTime : 0; }
}
