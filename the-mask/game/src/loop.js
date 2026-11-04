// THE MASK - the loop. Two ways to make copies of yourself (switch in the Loop menu):
//  - Auto loop: the room loops every N seconds. At the end, time rewinds: a new copy appears doing everything you
//    just did (moves, voice, shots), every older copy starts over with it, and (if Rewind the room is on) people and
//    stuff go back to where they were when the loop began.
//  - Record button: press to start recording, press again to stop. That copy then loops on its own forever.
import * as THREE from 'three';
import { G, on, emit, unlock, clamp } from './game.js';
import { S } from './settings.js';
import { Copy, COLORS, FRAME_HZ, F } from './copies.js';
import { voice, mouth } from './voice.js';
import { audio } from './audio.js';
import { fx } from './fx.js';
import { GADGET_IDS } from './gadgets.js';

const MAX_REC = 60;
let colorI = 0;

function newRec() { return { frames: [], events: [], dur: 0, eyeH: 1.6, heights: [], voice: null, lastSample: -1 }; }

export const loop = {
  copies: [], rec: null, recording: false, mode: 'auto', loopStart: 0, frac: 0, clockDate: new Date(), recStart: 0,
  snapshot: null, rewindAt: 0, rewinding: 0,
  init() {
    this.mode = S.loopMode;
    on('personShot', (p, who) => this.teamwork(p, who));
    on('copyHit', (p, who) => this.teamwork(p, who));
  },
  // the mask went on: time starts
  start() {
    this.loopStart = G.t; this.copies.forEach((c) => (c.first = true));
    if (this.mode === 'auto') this.beginRecording();
    this.takeSnapshot();
  },
  get loopLen() { return S.loopLen; },
  get loopT() { return G.t - this.loopStart; },
  get recT() { return this.mode === 'auto' ? this.loopT : G.t - this.recStart; },

  beginRecording() {
    this.rec = newRec(); this.recording = true; this.recStart = G.t;
    if (S.voice && voice.on) voice.start();
  },
  // what you're doing right now goes into the recording (30 times a second)
  sample() {
    const r = this.rec, p = G.player; if (!r || !this.recording || !p) return;
    const t = this.recT;
    if (t < r.lastSample + 1 / FRAME_HZ - 1e-4) return;
    r.lastSample = t;
    const f = r.frames, n = f.length / F;
    const want = Math.floor(t * FRAME_HZ); // keep frame i at time i/30 (repeat the last one if a frame was skipped)
    const row = p.recordRow(this.row || (this.row = new Float32Array(F)));
    for (let i = n; i <= want; i++) for (let k = 0; k < F; k++) f.push(row[k]);
    if (p.headPos.y > 0.9) r.heights.push(p.headPos.y);
  },
  onFire(gid, hand) {
    if (!this.recording || !this.rec) return;
    this.rec.events.push({ t: this.recT, type: 'fire', gid, hand });
  },
  finishRecording() {
    const r = this.rec; this.recording = false; this.rec = null;
    if (!r || r.frames.length < F * FRAME_HZ * 0.6) { voice.stop(); return null; }
    r.frames = new Float32Array(r.frames); r.dur = r.frames.length / F / FRAME_HZ;
    r.heights.sort((a, b) => a - b); r.eyeH = r.heights.length ? r.heights[Math.floor(r.heights.length * 0.8)] : 1.6;
    if (S.voice && voice.on) { r.voice = voice.take(r.dur + 1); voice.stop(); }
    return r;
  },
  addCopy(rec, { phase = 0, color = null } = {}) {
    const c = new Copy(rec, color != null ? color : COLORS[colorI++ % COLORS.length]);
    c.startT = G.t - phase; c.phase = phase;
    if (rec.voice) {
      c.voice = mouth(rec.voice, { loop: this.mode === 'record', loopEnd: rec.dur });
      if (c.voice) c.voice.restart(this.mode === 'record' ? phase : Math.min(this.loopT, rec.dur));
      unlock('voice');
    }
    this.copies.push(c);
    while (this.copies.length > S.maxCopies) this.copies.shift().dispose();
    audio.play('copy_born', c.root.position.clone().setY(1.4), 0.8);
    unlock('copy1'); if (this.copies.length >= 8) unlock('copies8');
    emit('copyMade', c);
    return c;
  },
  cloneCopy(c) { if (this.copies.length >= 12) return; this.addCopy(c.rec, { phase: 0.6 + Math.random() * 1.5 }); },
  removeLast() { const c = this.copies.pop(); if (c) c.dispose(); },
  clearCopies() { this.copies.forEach((c) => c.dispose()); this.copies = []; },
  setMode(m) {
    if (m === this.mode) return;
    if (this.recording) { this.recording = false; this.rec = null; voice.stop(); }
    this.mode = m; S.loopMode = m;
    // copies switch how they keep time; voices too
    for (const c of this.copies) {
      c.startT = G.t; c.first = true;
      if (c.voice) { c.voice.stop(); c.voice = mouth(c.rec.voice, { loop: m === 'record', loopEnd: c.rec.dur }); if (c.voice) c.voice.restart(0); }
    }
    if (G.wearing) { this.loopStart = G.t; if (m === 'auto') this.beginRecording(); this.takeSnapshot(); }
  },
  // record button (record mode). In auto mode it starts the next loop right away.
  pressRecord() {
    if (!G.wearing) return;
    if (this.mode === 'auto') { this.endLoop(); return; }
    if (!this.recording) { this.beginRecording(); audio.play('rec_start'); emit('recState', true); }
    else this.stopRecording();
  },
  stopRecording() {
    audio.play('rec_stop'); emit('recState', false);
    const r = this.finishRecording(); if (r) this.addCopy(r);
  },
  endLoop() {
    if (this.rewinding > 0) return;
    // the new copy: everything you did this loop
    const r = this.finishRecording();
    fx.wash(0x2c8c87, 0.62, 0.75); audio.play('rewind', null, 0.9);
    this.rewinding = 0.75; this.rewindFrom = this.frac;
    this.pending = r;
    this.restoreAt = G.t + 0.3; // under the color wash
  },
  takeSnapshot() {
    if (!S.rewindRoom || this.mode !== 'auto') { this.snapshot = null; return; }
    this.snapshot = {
      props: G.props.list.filter((p) => !p.held && !p.special).map((p) => [p, p.snapshot()]),
      people: G.people.list.filter((p) => !p.held).map((p) => [p, p.snapshot()]),
      blood: G.blood.count
    };
  },
  restoreRoom() {
    const s = this.snapshot; if (!s) return;
    for (const [p, snap] of s.props) p.restore(snap);
    for (const [p, snap] of s.people) p.restore(snap);
    G.blood.truncate(s.blood);
  },
  update(dt) {
    this.clockDate = new Date();
    if (!G.wearing) { this.frac = 0; for (const c of this.copies) c.update(dt, (G.t - c.startT) % c.rec.dur); return; }
    if (this.mode === 'auto') {
      if (this.rewinding > 0) {
        this.rewinding -= dt;
        this.frac = this.rewindFrom * Math.max(0, this.rewinding / 0.75); // the clock hands spin back
        if (this.restoreAt && G.t >= this.restoreAt) {
          this.restoreAt = 0;
          if (S.rewindRoom) this.restoreRoom();
          this.loopStart = G.t;
          for (const c of this.copies) { c.first = true; if (c.gone) c.comeBack(); if (c.voice) c.voice.restart(0); }
          if (this.pending) { this.addCopy(this.pending); this.pending = null; }
          this.beginRecording(); this.takeSnapshot();
          emit('loopStart');
        }
      } else {
        this.frac = clamp(this.loopT / S.loopLen, 0, 1);
        if (this.loopT >= S.loopLen) this.endLoop();
      }
      this.sample();
      const lt = this.rewinding > 0 && this.restoreAt ? null : this.loopT;
      for (const c of this.copies) c.update(dt, lt == null ? c.lastT : Math.min(lt, c.rec.dur - 0.001));
    } else {
      if (this.recording) {
        this.sample();
        this.frac = clamp(this.recT / MAX_REC, 0, 1);
        if (this.recT >= MAX_REC) this.stopRecording();
      } else this.frac = 0;
      for (const c of this.copies) c.update(dt, ((G.t - c.startT) % c.rec.dur + c.rec.dur) % c.rec.dur);
    }
  },
  teamwork(p, who) {
    if (!p) return;
    if (who === 'you') p.lastYou = G.t; else if (who && who.kind === 'copy') p.lastCopy = G.t;
    if (p.lastYou && p.lastCopy && Math.abs(p.lastYou - p.lastCopy) < 2) unlock('teamwork');
  }
};
export { GADGET_IDS };
