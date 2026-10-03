/* AI Play - the BRAIN. A free, offline learning brain that starts knowing nothing.
 *
 * It has a few parts that work together (like a real brain has different parts):
 *  1. Control discovery - presses keys, watches what changes, figures out "← moves me left".
 *  2. Instincts        - remembers which colors were near it when it got hurt / got points,
 *                        then moves away from "pain colors" and toward "good colors".
 *  3. Neural net       - a small Q-network ("how good is each button right now?") trained
 *                        from rewards with experience replay (and replay = DREAMS).
 *  4. Episodic memory  - "last time the screen looked like this, pressing X went well".
 *  5. Copycat brain    - learns by watching YOU play, or a rival AI's best run.
 * Nothing here is set by the player: mood + personality (from heart.js) change how it plays.
 */
'use strict';

AIP.Brain = (function () {
  const U = AIP.util;
  const S = AIP.Senses;
  const KEYS = AIP.KEYS;
  const N = S.N, SW = S.SW, SH = S.SH, GW = S.GW, GH = S.GH;
  const EXTRA = 10;
  const IN = N * 2 + EXTRA;
  const MAXA = 32, HID = 64, CHID = 32;
  const GAMMA = 0.96, NSTEP = 4;
  const NC = AIP.COLORS.names.length;
  const VERSION = 3;

  /* ------------------------------------------------------------------ tiny neural net */
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function makeNet(nin, nh, nout, rnd) {
    const sz = nh * nin + nh + nout * nh + nout;
    const P = new Float32Array(sz);
    const s1 = Math.sqrt(2 / nin), s2 = Math.sqrt(1 / nh) * 0.3;
    for (let i = 0; i < nh * nin; i++) P[i] = gauss(rnd) * s1;
    for (let i = nh * nin + nh; i < nh * nin + nh + nout * nh; i++) P[i] = gauss(rnd) * s2;
    return { nin, nh, nout, P, G: new Float32Array(sz), m: new Float32Array(sz), v: new Float32Array(sz), t: 0 };
  }
  function forward(net, P, x, out, h) {
    const nin = net.nin, nh = net.nh, nout = net.nout;
    const oB1 = nh * nin, oW2 = oB1 + nh, oB2 = oW2 + nout * nh;
    for (let j = 0; j < nh; j++) {
      let s = P[oB1 + j];
      const row = j * nin;
      for (let i = 0; i < nin; i++) s += P[row + i] * x[i];
      h[j] = s > 0 ? s : 0;
    }
    for (let k = 0; k < nout; k++) {
      let s = P[oB2 + k];
      const row = oW2 + k * nh;
      for (let j = 0; j < nh; j++) s += P[row + j] * h[j];
      out[k] = s;
    }
    return out;
  }
  const dhBuf = new Float32Array(HID);
  function backward(net, x, h, dy) {
    const nin = net.nin, nh = net.nh, nout = net.nout, P = net.P, G = net.G;
    const oB1 = nh * nin, oW2 = oB1 + nh, oB2 = oW2 + nout * nh;
    const dh = dhBuf; dh.fill(0, 0, nh);
    for (let k = 0; k < nout; k++) {
      const d = dy[k];
      if (d === 0) continue;
      G[oB2 + k] += d;
      const row = oW2 + k * nh;
      for (let j = 0; j < nh; j++) { G[row + j] += d * h[j]; dh[j] += P[row + j] * d; }
    }
    for (let j = 0; j < nh; j++) {
      if (h[j] <= 0) continue;
      const d = dh[j];
      if (d === 0) continue;
      G[oB1 + j] += d;
      const row = j * nin;
      for (let i = 0; i < nin; i++) G[row + i] += d * x[i];
    }
  }
  function adam(net, lr, scale) {
    const P = net.P, G = net.G, m = net.m, v = net.v;
    net.t++;
    const c1 = 1 - Math.pow(0.9, net.t), c2 = 1 - Math.pow(0.999, net.t);
    for (let i = 0; i < P.length; i++) {
      let g = G[i] * scale;
      if (g > 5) g = 5; else if (g < -5) g = -5;
      m[i] = 0.9 * m[i] + 0.1 * g;
      v[i] = 0.999 * v[i] + 0.001 * g * g;
      P[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-7);
      G[i] = 0;
    }
  }
  function resetOutput(net, k) {
    const oW2 = net.nh * net.nin + net.nh, oB2 = oW2 + net.nout * net.nh;
    for (let j = 0; j < net.nh; j++) net.P[oW2 + k * net.nh + j] = (Math.random() - 0.5) * 0.02;
    net.P[oB2 + k] = 0;
  }

  /* ------------------------------------------------------------------ memory of experiences */
  class Replay {
    constructor(cap) {
      this.cap = cap;
      this.S = new Uint8Array(cap * IN);
      this.A = new Int8Array(cap); this.GEN = new Uint16Array(cap);
      this.R = new Float32Array(cap); this.D = new Uint8Array(cap);
      this.seq = 0; // total pushed ever
      this.important = [];
    }
    size() { return Math.min(this.seq, this.cap); }
    push(stateU8, a, gen, r, done) {
      const i = this.seq % this.cap;
      this.S.set(stateU8, i * IN);
      this.A[i] = a; this.GEN[i] = gen; this.R[i] = r; this.D[i] = done ? 1 : 0;
      if (Math.abs(r) > 0.25) { this.important.push(this.seq); if (this.important.length > 3000) this.important.splice(0, 1000); }
      return this.seq++;
    }
    oldest() { return Math.max(0, this.seq - this.cap); }
    valid(s) { return s >= this.oldest() && s < this.seq - 1; }
    sample() {
      if (this.important.length > 20 && Math.random() < 0.35) {
        const s = this.important[Math.floor(Math.random() * this.important.length)];
        if (this.valid(s)) return s;
      }
      const lo = this.oldest(), hi = this.seq - 1;
      return lo + Math.floor(Math.random() * (hi - lo));
    }
    decode(s, x) { const o = (s % this.cap) * IN, Sb = this.S; for (let i = 0; i < IN; i++) x[i] = Sb[o + i] / 255; return x; }
    // Save the newest `n` memories (for next time).
    dump(n) {
      const cnt = Math.min(n, this.size());
      const from = this.seq - cnt;
      const S2 = new Uint8Array(cnt * IN), A2 = new Int8Array(cnt), G2 = new Uint16Array(cnt), R2 = new Float32Array(cnt), D2 = new Uint8Array(cnt);
      for (let k = 0; k < cnt; k++) {
        const i = (from + k) % this.cap;
        S2.set(this.S.subarray(i * IN, i * IN + IN), k * IN);
        A2[k] = this.A[i]; G2[k] = this.GEN[i]; R2[k] = this.R[i]; D2[k] = this.D[i];
      }
      return { S: S2, A: A2, GEN: G2, R: R2, D: D2, n: cnt };
    }
    load(d) {
      if (!d || !d.n) return;
      for (let k = 0; k < d.n; k++) this.push(d.S.subarray(k * IN, k * IN + IN), d.A[k], d.GEN[k], d.R[k], k === d.n - 1 ? 1 : d.D[k]);
    }
  }

  // which way a key moves things (already "with the key minus without the key")
  const dirOf = (c) => [c.dx || 0, c.dy || 0];
  const newAcc = () => ({ n: 0, x: 0, y: 0, xx: 0, yy: 0 });
  const arrowOf = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? '➡️ right' : '⬅️ left') : (dy > 0 ? '⬇️ down' : '⬆️ up'));
  const isDirLabel = (c) => c && ((c.dirZ || 0) > 3 && Math.hypot(c.dx || 0, c.dy || 0) > 0.3 || Math.hypot(c.gx, c.gy) > 0.4);

  /* ------------------------------------------------------------------ THE BRAIN */
  class Brain {
    constructor(aiId, game) {
      this.aiId = aiId; this.gameId = game.id; this.gameName = game.name;
      this.hashSeed = U.hashStr(game.id + ':eyes');
      const rnd = U.seeded(U.hashStr(aiId + game.id));
      this.q = makeNet(IN, HID, MAXA, rnd);
      this.qT = new Float32Array(this.q.P);
      this.copy = makeNet(IN, CHID, MAXA, rnd);
      this.copyTrained = 0;
      this.replay = new Replay(16000);
      this.demos = { S: new Uint8Array(4000 * IN), ids: new Array(4000), n: 0, seq: 0, from: '' };
      this.epi = new Map();
      this.novel = new Map();
      this.actions = []; // slots
      this.gen = new Uint16Array(MAXA);
      this.controls = {}; // code/id -> knowledge
      this.baseMap = new Float32Array(N); this.baseVar = new Float32Array(N).fill(0.01); this.baseAmt = 0.003; this.quietN = 0;
      this.lab = null; this.labNext = 0;
      this.self = { x: 0.5, y: 0.5, conf: 0, camera: 0 };
      this.assoc = { good: new Float32Array(NC), bad: new Float32Array(NC), nGood: 0, nBad: 0, prior: new Float32Array(NC), val: new Float32Array(NC) };
      this.nearHist = [];
      this.buttonValue = {};
      this.tips = []; this.tipDir = null;
      this.memories = [];
      this.stats = { episodes: 0, steps: 0, best: null, history: [], timeMs: 0, wins: 0, deaths: 0, first: Date.now(), lastDemoEp: -99 };
      this.trainSteps = 0;
      this.traj = [];
      this.discoverAt = 0; this.discoverIdx = 0;
      this.prev = null; // {u8, slot, keys, mouseId}
      this.prevKeysBefore = [];
      this.prevG40 = null;
      this.pendingBtn = null;
      this.routine = null;
      this.lastReason = '';
      this.lastValues = null;
      this.recentScore = 0;
      this.epStartSeq = 0;
      this.bestRun = null;
      this.x = new Float32Array(IN); this.x2 = new Float32Array(IN);
      this.h = new Float32Array(HID); this.h2 = new Float32Array(HID); this.hc = new Float32Array(CHID);
      this.qo = new Float32Array(MAXA); this.qo2 = new Float32Array(MAXA); this.co = new Float32Array(MAXA);
      this.u8 = new Uint8Array(IN);
      this.proj = null;
      this.ensureAction('noop', { keys: [] });
      this.newsQueue = []; // things it figured out, for talking
    }

    /* ---------------- actions ---------------- */
    slotOf(id) { for (let i = 0; i < this.actions.length; i++) if (this.actions[i] && this.actions[i].id === id) return i; return -1; }
    ensureAction(id, spec, activate = true) {
      let i = this.slotOf(id);
      if (i >= 0) { if (activate) this.actions[i].active = true; return i; }
      if (this.actions.length < MAXA) i = this.actions.length;
      else {
        // recycle the most useless inactive slot
        let best = -1, bs = Infinity;
        this.actions.forEach((a, k) => { if (k === 0 || a.active) return; const s = a.tries; if (s < bs) { bs = s; best = k; } });
        if (best < 0) return -1;
        i = best;
        this.gen[i] = (this.gen[i] + 1) & 0xffff;
        resetOutput(this.q, i); resetOutput(this.copy, i);
        const o = this.q.nh * this.q.nin + this.q.nh;
        for (let j = 0; j < this.q.nh; j++) this.qT[o + i * this.q.nh + j] = this.q.P[o + i * this.q.nh + j];
        this.epi.forEach((e) => { e[i] = NaN; });
      }
      this.actions[i] = { id, keys: spec.keys || [], mouse: spec.mouse || null, active: activate, tries: 0, label: spec.label || this.labelOfSpec(id, spec) };
      return i;
    }
    labelOfSpec(id, spec) {
      if (id === 'noop') return 'wait';
      if (spec.mouse) return { click: 'click', hold: 'hold click', btn: 'click a button', look: 'look ' + (spec.mouse.dx < 0 ? '⬅️' : spec.mouse.dx > 0 ? '➡️' : spec.mouse.dy < 0 ? '⬆️' : '⬇️'), goto: 'move mouse' }[spec.mouse.t] || id;
      return (spec.keys || []).map(KEYS.label).join(' + ');
    }
    activeSlots() { const out = []; this.actions.forEach((a, i) => { if (a && a.active) out.push(i); }); return out; }
    keyCtl(code) {
      if (!this.controls[code]) this.controls[code] = { tries: 0, n: 0, map: new Float32Array(N), amt: 0, dx: 0, dy: 0, dirZ: 0, on: newAcc(), off: newAcc(), gx: 0, gy: 0, gn: 0, pause: 0, rew: 0, hurt: 0, status: 'new', tip: '', at: 0, user: 0, peakZ: 0, peak: 0 };
      return this.controls[code];
    }

    // Slowly try more keys - curiosity! (it starts with the usual game keys)
    discover(now, obs, mods) {
      const order = KEYS.order;
      const activeKeys = this.actions.filter((a) => a.active && a.keys.length === 1 && !a.mouse).length;
      const testing = this.actions.filter((a) => a.active && a.keys.length === 1 && this.keyCtl(a.keys[0]).status === 'new').length;
      // the usual game keys get tried quickly; weird keys only now and then (or when it's confused/bored)
      const core = this.discoverIdx < 16;
      const urge = (mods ? mods.curiosity : 0.5) + (mods ? mods.confused : 0);
      const gap = core ? 2200 / (0.5 + urge) : 14000 / (0.4 + urge);
      if (now < this.discoverAt) return;
      this.discoverAt = now + gap;
      const haveUseful = Object.keys(this.controls).some((k) => k.indexOf('m:') !== 0 && (this.controls[k].status === 'useful' || this.controls[k].status === 'starred'));
      const wantWeird = !haveUseful || (mods && (mods.confused > 0.45 || mods.bored > 0.5)) || now - (this.lastWeird || 0) > 60000;
      const doKeys = core || wantWeird;
      if (!core && doKeys) this.lastWeird = now;
      if (doKeys && testing < (core ? 4 : 2) && activeKeys < 12) {
        while (this.discoverIdx < order.length) {
          const code = order[this.discoverIdx++];
          const c = this.keyCtl(code);
          if (c.status === 'banned' || c.status === 'pause' || c.status === 'useless') continue;
          if (this.slotOf('k:' + code) >= 0 && this.actions[this.slotOf('k:' + code)].active) continue;
          this.ensureAction('k:' + code, { keys: [code] });
          break;
        }
      }
      if (testing < 3) {
        // knows almost nothing? (or just now and then) give the usual game keys another chance
        if (this.discoverIdx >= 16 && (!haveUseful ? Math.random() < 0.3 : now - (this.lastRetest || 0) > 40000)) {
          this.lastRetest = now;
          const again = order.slice(0, 16).filter((c) => this.keyCtl(c).status === 'useless');
          if (again.length) { const code = U.pick(again); const c = this.keyCtl(code); c.status = 'new'; c.tries = 0; c.n = 0; c.map.fill(0); this.ensureAction('k:' + code, { keys: [code] }); }
        }
        // after going through everything once, sometimes re-test a "useless" key (maybe it was a menu thing)
        if (this.discoverIdx >= order.length && Math.random() < 0.15) {
          const useless = order.filter((c) => this.keyCtl(c).status === 'useless');
          if (useless.length) { const code = U.pick(useless); const c = this.keyCtl(code); c.status = 'new'; c.tries = Math.min(c.tries, 2); this.ensureAction('k:' + code, { keys: [code] }); }
        }
      }
      // mouse stuff
      if (obs) {
        if (obs.buttons && obs.buttons.length) this.ensureAction('m:btn', { mouse: { t: 'btn' } });
        this.ensureAction('m:click', { mouse: { t: 'click' } });
        if (obs.lockActive || this.self.camera > 0.3) {
          const L = 70;
          this.ensureAction('m:look-l', { mouse: { t: 'look', dx: -L, dy: 0 } });
          this.ensureAction('m:look-r', { mouse: { t: 'look', dx: L, dy: 0 } });
          this.ensureAction('m:look-u', { mouse: { t: 'look', dx: 0, dy: -L * 0.6 } });
          this.ensureAction('m:look-d', { mouse: { t: 'look', dx: 0, dy: L * 0.6 } });
          this.ensureAction('m:hold', { mouse: { t: 'hold' } });
        }
        // moving the mouse around only matters in mouse games (clicking does something AND keys mostly don't)
        const clickCtl = this.controls['m:click'];
        const usefulKeys = Object.keys(this.controls).filter((k) => k.indexOf('m:') !== 0 && this.controls[k].status === 'useful').length;
        const mouseGame = clickCtl && clickCtl.status === 'useful' && (clickCtl.peakZ || 0) > 6 && usefulKeys < 2 && !obs.lockActive;
        for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
          const id = 'm:goto-' + gx + gy;
          if (mouseGame) this.ensureAction(id, { mouse: { t: 'goto', x: (gx + 0.5) / 3, y: (gy + 0.5) / 3 } });
          else { const i = this.slotOf(id); if (i >= 0) this.actions[i].active = false; }
        }
      }
      // combos: a move key + an action key at the same time (run + jump!)
      const dirKeys = [], actKeys = [];
      Object.keys(this.controls).forEach((code) => {
        const c = this.controls[code];
        if (code.indexOf('m:') === 0 || c.status !== 'useful') return;
        if (isDirLabel(c)) dirKeys.push([code, c.peakZ || 0]); else actKeys.push([code, c.peakZ || 0]);
      });
      dirKeys.sort((a, b) => b[1] - a[1]); actKeys.sort((a, b) => b[1] - a[1]);
      const wantCombos = new Set();
      dirKeys.slice(0, 2).forEach(([d]) => actKeys.slice(0, 1).forEach(([a]) => wantCombos.add('k:' + d + '+' + a)));
      this.actions.forEach((a) => { if (a.keys.length > 1 && a.id.indexOf('k:') === 0 && !wantCombos.has(a.id) && !a.fromUser) a.active = false; });
      wantCombos.forEach((id) => this.ensureAction(id, { keys: id.slice(2).split('+') }));
    }

    /* ---------------- turning the screen into brain input ---------------- */
    features(obs, ctx) {
      const x = this.x;
      for (let i = 0; i < N; i++) { x[i] = obs.gray[i]; x[N + i] = obs.motion[i]; }
      let o = N * 2;
      x[o++] = obs.healthFrac == null ? 1 : obs.healthFrac;
      x[o++] = U.clamp(this.recentScore, 0, 1);
      x[o++] = this.self.x; x[o++] = this.self.y;
      x[o++] = ctx.mx; x[o++] = ctx.my;
      x[o++] = obs.buttons && obs.buttons.length ? 1 : 0;
      x[o++] = obs.lockActive ? 1 : 0;
      x[o++] = U.clamp((obs.staticTime || 0) / 3, 0, 1);
      x[o++] = 1;
      const u8 = this.u8;
      for (let i = 0; i < IN; i++) u8[i] = Math.round(U.clamp(x[i], 0, 1) * 255);
      return x;
    }
    hashState(obs) {
      if (!this.proj) {
        const r = U.seeded(this.hashSeed);
        this.proj = [];
        for (let p = 0; p < 16; p++) { const v = new Float32Array(N); for (let i = 0; i < N; i++) v[i] = r() - 0.5; this.proj.push(v); }
      }
      let bits = 0;
      for (let p = 0; p < 16; p++) {
        const v = this.proj[p], src = p < 13 ? obs.gray : obs.motion;
        let s = 0;
        for (let i = 0; i < N; i++) s += v[i] * (src[i] - (p < 13 ? 0.5 : 0.1));
        if (s > 0) bits |= 1 << p;
      }
      const hf = obs.healthFrac == null ? 1 : obs.healthFrac;
      const hb = hf < 0.34 ? 0 : hf < 0.67 ? 1 : 2;
      return bits * 8 + hb * 2 + (obs.buttons && obs.buttons.length ? 1 : 0);
    }

    /* ---------------- learning what the controls do + where "I" am ---------------- */
    learnControls(obs, now) {
      if (!this.prev || !obs.ok) return;
      const keys = this.prev.keys, before = this.prevKeysBefore;
      const fresh = keys.filter((k) => before.indexOf(k) < 0);
      const mid = this.prev.mouseId;
      const amt = obs.motionAmt || 0;
      // frozen screen (paused) or a menu: that tells us nothing about what keys do IN the game
      if ((obs.staticTime || 0) > 1.2 && amt < 0.001) return;
      if (obs.menuish) return;
      // what the screen does when I'm NOT pressing anything (falling stuff, animations...)
      const M = obs.motion, B = this.baseMap, V = this.baseVar;
      const quiet = !mid && (obs.changedFrac || 0) < 0.4 && keys.every((k) => { const c = this.controls[k]; return c && c.status === 'useless'; });
      if (quiet) {
        const kb = this.quietN < 30 ? 1 / ++this.quietN : 0.03;
        for (let i = 0; i < N; i++) { const d = M[i] - B[i]; B[i] += d * kb; V[i] += (d * d - V[i]) * kb; }
        this.baseAmt += (amt - this.baseAmt) * kb;
      }
      const glob = obs.gshift || { dx: 0, dy: 0, gain: 0 };
      const ids = keys.slice();
      if (mid) ids.push(mid);
      // best: "where was I -> where am I now" (if I'm tracking myself). Else: how stuff shifted at the key's spot.
      // (use the CHANGE in my motion: falling after a jump isn't the key's doing, a sudden push up is)
      // Clean experiment: only judge a key when I was STANDING STILL before pressing it
      // (jump pressed mid-air does nothing; a move key pressed while already moving tells little).
      const vel = this.self.tracked && this.lastSelfPos ? [(this.self.x - this.lastSelfPos.x) * GW, (this.self.y - this.lastSelfPos.y) * GH] : null;
      const atRest = vel && this.lastVel && Math.hypot(this.lastVel[0], this.lastVel[1]) < 0.35;
      const selfMove = atRest ? vel : null;
      const skipDir = !!vel && !atRest;
      this.lastVel = vel;
      const shiftAt = (c) => {
        if (selfMove) return selfMove;
        const cx = Math.round(c.hot.x * GW), cy = Math.round(c.hot.y * GH);
        const sh = S.bestShift(this.prevG40, obs.g40, Math.max(0, cx - 6), Math.max(0, cy - 4), Math.min(GW, cx + 7), Math.min(GH, cy + 5), 3);
        return [sh.dx * sh.gain, sh.dy * sh.gain];
      };
      const acc = (st, v) => { st.n = st.n * 0.985 + 1; st.x = st.x * 0.985 + v[0]; st.y = st.y * 0.985 + v[1]; st.xx = st.xx * 0.985 + v[0] * v[0]; st.yy = st.yy * 0.985 + v[1] * v[1]; };
      // "control group": how do things move at each key's spot when that key is NOT pressed?
      if (this.prevG40 && obs.g40) {
        for (const code in this.controls) {
          const c = this.controls[code];
          if (skipDir || (!c.hot && !selfMove) || ids.indexOf(code) >= 0 || code.indexOf('m:') === 0 || c.status === 'useless' || Math.random() > 0.4) continue;
          acc(c.off, shiftAt(c));
        }
      }
      for (const code of ids) {
        const c = this.keyCtl(code);
        const isFresh = fresh.indexOf(code) >= 0 || code === mid;
        if (isFresh) { c.tries++; c.at = now; }
        const w = isFresh ? 1 : 0.5;
        // the WHOLE screen changing (got hit + red flash, scene change) says nothing about what one key does
        const flood = (obs.changedFrac || 0) > 0.4 && !(glob.gain > 0.2);
        if (!flood) {
          c.n = (c.n || 0) + w;
          const rate = Math.max(w / c.n, 0.04 * w); // a true average at first, then a slow moving average
          for (let i = 0; i < N; i++) c.map[i] += (M[i] - c.map[i]) * rate;
          c.amt += (Math.max(0, amt - this.baseAmt) - c.amt) * rate;
        }
        const rate = Math.max(w / Math.max(1, c.n), 0.04 * w);
        // direction = what happens right after pressing (a jump goes UP first, then falls back down)
        if (isFresh && !skipDir && (c.hot || selfMove) && this.prevG40 && obs.g40 && code.indexOf('m:') !== 0) acc(c.on, shiftAt(c));
        if (glob.gain > 0.2 && obs.changedFrac > 0.25) { const r = Math.max(0.1, rate); c.gx += (glob.dx * glob.gain * 1.6 - c.gx) * r; c.gy += (glob.dy * glob.gain * 1.6 - c.gy) * r; c.gn++; }
        else { c.gx *= 0.97; c.gy *= 0.97; }
        // pause check: everything stopped right after pressing it?
        // everything froze right after pressing it? Maybe it's a pause key... or maybe I just died.
        // Wait a moment before blaming the key (the "GAME OVER" text can show up a bit later).
        if (isFresh && this.baseAmt > 0.0025 && amt < this.baseAmt * 0.08 && (this.prevAmt || 0) > this.baseAmt * 0.3 && !obs.gameOverVisible && now - (this.lastBadAt || -1e9) > 2500) this.pauseSuspect = { code, t: now };
        this.analyze(c);
        this.judge(code, c);
      }
      this.prevAmt = amt;
      const ps = this.pauseSuspect;
      if (ps && now - ps.t > 1500) {
        this.pauseSuspect = null;
        if (now - (this.lastBadAt || -1e9) > now - ps.t + 300 && !obs.gameOverVisible && !obs.menuish) { const c = this.keyCtl(ps.code); c.pause++; this.judge(ps.code, c); }
      }
      // camera games: the whole screen slides when you move
      if (glob.gain > 0.2 && obs.changedFrac > 0.3 && ids.length) this.self.camera = Math.min(1, this.self.camera + 0.02); else this.self.camera *= 0.999;
    }
    // Is this key REALLY doing something, or is it just random stuff moving? (a z-score test)
    analyze(c) {
      const z = this.scratch || (this.scratch = new Float32Array(N));
      const nEff = Math.min(c.n, 40), qn = Math.max(1, this.quietN);
      let mean = 0;
      for (let i = 0; i < N; i++) {
        const d = c.map[i] - this.baseMap[i];
        mean += d;
        // don't trust a jumpiness estimate from only a few quiet moments (shrink it toward a guess)
        const v = (this.baseVar[i] * qn + 0.03 * 6) / (qn + 6);
        z[i] = d / Math.sqrt(v / nEff + v / qn + 0.004 / nEff);
      }
      c.mean = mean / N;
      // a real effect lights up 2+ cells next to each other; random noise usually lights one
      let peak = -Infinity, pi = -1;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const i = y * SW + x;
        let nb = -Infinity;
        if (x > 0) nb = Math.max(nb, z[i - 1]);
        if (x < SW - 1) nb = Math.max(nb, z[i + 1]);
        if (y > 0) nb = Math.max(nb, z[i - SW]);
        if (y < SH - 1) nb = Math.max(nb, z[i + SW]);
        const v = (z[i] + nb) / 2;
        if (v > peak) { peak = v; pi = i; }
      }
      c.peakZ = peak;
      c.peak = pi >= 0 ? c.map[pi] - this.baseMap[pi] : 0;
      if (pi >= 0 && peak > 3) {
        const hx = (pi % SW + 0.5) / SW, hy = (Math.floor(pi / SW) + 0.5) / SH;
        if (!c.hot || (!this.self.tracked && Math.abs(c.hot.y - hy) > 0.2)) { c.on = newAcc(); c.off = newAcc(); }
        c.hot = { x: hx, y: hy };
        c.maxZ = Math.max(c.maxZ || 0, peak);
      }
      // direction: (with key) minus (without key), and how sure we are
      const on = c.on, off = c.off;
      if (on.n > 3 && off.n > 3) {
        const mx = on.x / on.n - off.x / off.n, my = on.y / on.n - off.y / off.n;
        const vx = Math.max(0.02, on.xx / on.n - (on.x / on.n) ** 2) / on.n + Math.max(0.02, off.xx / off.n - (off.x / off.n) ** 2) / off.n;
        const vy = Math.max(0.02, on.yy / on.n - (on.y / on.n) ** 2) / on.n + Math.max(0.02, off.yy / off.n - (off.y / off.n) ** 2) / off.n;
        c.dirZ = Math.max(Math.abs(mx) / Math.sqrt(vx), Math.abs(my) / Math.sqrt(vy));
        c.dx = mx * 1.6; c.dy = my * 1.6;
        if (c.dirZ < 3) { c.dx *= 0.3; c.dy *= 0.3; }
      }
    }
    judge(code, c) {
      if (c.status === 'banned' || c.status === 'starred') return;
      const old = c.status;
      if (c.pauseConfirmed || (c.tries >= 3 && c.pause >= 3 && c.pause / c.tries > 0.6)) c.status = 'pause';
      else if (c.tries >= 3 && (c.n || 0) >= 6) {
        const localized = (c.peakZ || 0) > 5 && c.peak > 0.04;
        const moves = (c.dirZ || 0) > 3.5 && Math.hypot(c.dx, c.dy) > 0.3;
        const global = (c.mean || 0) > 0.02 || (c.gn > 4 && Math.hypot(c.gx, c.gy) > 0.45);
        if (localized || moves || global || c.user > 3) c.status = 'useful';
        // once it worked, it takes a LOT of nothing to give up on a key (maybe I was stuck at a wall)
        else if ((c.maxZ || 0) > 6.5 && old === 'useful') { /* it clearly worked before - keep believing in it */ }
        else if (old === 'useful' ? c.tries >= 30 && (c.peakZ || 0) < 2 && (c.dirZ || 0) < 1.5 : c.tries >= 8 && c.n >= 14 && this.quietN >= 8 && (c.peakZ || 0) < 3 && (c.dirZ || 0) < 2.5) c.status = 'useless';
      }
      if (old !== c.status) {
        if (c.status === 'useless' || c.status === 'pause') {
          const i = this.slotOf('k:' + code); if (i >= 0) this.actions[i].active = false;
          const im = this.slotOf(code); if (im >= 0) this.actions[im].active = false;
          this.actions.forEach((a) => { if (a.keys.length > 1 && a.keys.indexOf(code) >= 0) a.active = false; });
        }
        if (c.status === 'useful' || c.status === 'pause' || (c.status === 'useless' && old === 'new')) this.newsQueue.push({ type: 'control', code, status: c.status, label: this.controlLabel(code, c) });
      }
    }
    controlLabel(code, c) {
      c = c || this.controls[code];
      if (!c) return '???';
      if (c.status === 'pause') return 'pauses the game ⏸️';
      if (c.status === 'banned') return "banned (you said so) 🚫";
      if (c.tip) return c.tip;
      if (c.status === 'useless') return 'does nothing 😐';
      if (c.status === 'starred' && !(c.tries >= 4 && ((c.peakZ || 0) > 5 || (c.dirZ || 0) > 3.5))) return 'you said it matters ⭐ (still figuring out what it does)';
      if (c.status === 'new') return 'testing... 🔬';
      if (Math.hypot(c.gx, c.gy) > 0.4) return 'turns the camera ' + arrowOf(-c.gx, -c.gy);
      if (code.indexOf('m:') !== 0 && Math.hypot(...dirOf(c)) > 0.3) return 'moves me ' + arrowOf(...dirOf(c));
      if ((c.peakZ || 0) > 6 || c.amt > 0.01) return 'does something big (jump? shoot?) 💥';
      return 'does something ✨';
    }
    // What color am I? (the color that shows up where things move when I press a move key)
    learnSelfColor(obs) {
      if (!this.prev || this.self.camera > 0.5) return;
      const moving = this.prev.keys.some((k) => { const c = this.controls[k]; return c && c.hot && (isDirLabel(c) || (c.peakZ || 0) > 5); });
      if (!moving || (obs.changedFrac || 0) > 0.4) return;
      const hist = this.selfHist || (this.selfHist = new Float32Array(NC));
      const band = 0.16;
      for (let i = 0; i < N; i++) {
        if (obs.motion[i] < 0.35) continue;
        const y = (Math.floor(i / SW) + 0.5) / SH, x = (i % SW + 0.5) / SW;
        if (Math.abs(y - this.self.y) > band || Math.abs(x - this.self.x) > 0.3) continue;
        const c = obs.cat[i];
        if (c === obs.bgCat) continue;
        hist[c] += 1;
      }
      let best = -1, bv = 0, tot = 0;
      for (let c = 0; c < NC; c++) { if (c === obs.bgCat) continue; tot += hist[c]; if (hist[c] > bv) { bv = hist[c]; best = c; } }
      // need real proof before deciding "that's my color" (a coin touching me once doesn't count)
      if (tot > 30 && bv / tot > 0.55) this.self.cat = best;
      else if (this.self.cat != null && tot > 30 && hist[this.self.cat] / tot < 0.25) this.self.cat = null;
      for (let c = 0; c < NC; c++) hist[c] *= 0.995;
    }
    // Follow myself around the screen: find the blob of "my color" closest to where I was.
    trackSelf(obs) {
      const me = this.self;
      if (me.cat == null || me.camera > 0.5 || !obs.cat) return;
      const seen = this.seenBuf || (this.seenBuf = new Uint8Array(N));
      seen.fill(0);
      let best = null, bd = Infinity;
      const band = 0.2;
      for (let i = 0; i < N; i++) {
        if (seen[i] || obs.cat[i] !== me.cat) continue;
        // flood fill one blob
        const stack = [i]; seen[i] = 1;
        let sx = 0, sy = 0, n = 0;
        while (stack.length) {
          const j = stack.pop();
          const x = j % SW, y = Math.floor(j / SW);
          sx += x; sy += y; n++;
          const nb = [x > 0 ? j - 1 : -1, x < SW - 1 ? j + 1 : -1, y > 0 ? j - SW : -1, y < SH - 1 ? j + SW : -1];
          for (const k of nb) if (k >= 0 && !seen[k] && obs.cat[k] === me.cat) { seen[k] = 1; stack.push(k); }
        }
        if (n > 40) continue; // a huge blob is background, not me
        const cx = (sx / n + 0.5) / SW, cy = (sy / n + 0.5) / SH;
        if (Math.abs(cy - (me.homeY != null ? me.homeY : me.y)) > band) continue;
        const d = Math.hypot(cx - me.x, (cy - me.y) * 1.5);
        if (d < bd) { bd = d; best = { x: cx, y: cy }; }
      }
      if (best && bd < 0.35) { me.x += (best.x - me.x) * 0.7; me.y += (best.y - me.y) * 0.7; me.tracked = true; }
      else me.tracked = false;
    }
    // Which part of the screen is ME? The spot that moves when I press my move keys.
    findSelf() {
      if (this.self.camera > 0.5) { this.self.x += (0.5 - this.self.x) * 0.2; this.self.y += (0.5 - this.self.y) * 0.2; this.self.conf = Math.max(this.self.conf, 0.6); return; }
      let wx = 0, wy = 0, ws = 0;
      Object.keys(this.controls).forEach((code) => {
        const c = this.controls[code];
        if (code.indexOf('m:') === 0 || !c.hot || (c.peakZ || 0) < 3 || !(c.status === 'useful' || c.status === 'starred' || (c.status === 'new' && c.tries >= 3))) return;
        const w = Math.max(0, (c.peakZ || 0) - 2.5) * (isDirLabel(c) ? 3 : 1) * (c.status === 'new' ? 0.3 : 1);
        wx += c.hot.x * w; wy += c.hot.y * w; ws += w;
      });
      if (ws <= 0) return;
      this.self.homeY = wy / ws;
      if (!this.self.tracked) {
        this.self.x += (wx / ws - this.self.x) * 0.35;
        this.self.y += (wy / ws - this.self.y) * 0.35;
      }
      this.self.conf += (U.clamp(ws / 4, 0, 1) - this.self.conf) * 0.3;
    }

    /* ---------------- instincts: colors near me when good/bad stuff happened ---------------- */
    nearColors(obs) {
      const near = new Float32Array(NC), glob = new Float32Array(NC);
      const sx = this.self.x, sy = this.self.y;
      let wn = 0;
      for (let i = 0; i < N; i++) {
        const c = obs.cat[i];
        if (c === this.self.cat || c === obs.bgCat) continue;
        glob[c]++;
        const dx = ((i % SW) + 0.5) / SW - sx, dy = ((Math.floor(i / SW) + 0.5) / SH - sy) * 0.75;
        const d2 = dx * dx + dy * dy;
        // what's TOUCHING me counts the most (the spike I hit, the coin I grabbed)
        if (d2 < 0.02) { const w = (1 - d2 / 0.02) * (1 - d2 / 0.02); near[c] += w; wn += w; }
      }
      for (let c = 0; c < NC; c++) near[c] = (wn ? near[c] / wn : 0) - glob[c] / N;
      if (obs.bgCat != null) near[obs.bgCat] = 0;
      if (this.self.cat != null) near[this.self.cat] = 0;
      return near;
    }
    updateAssoc(obs) {
      if (!obs.ok || !obs.cat) return;
      const near = this.nearColors(obs);
      const nb = this.nearBase || (this.nearBase = new Float32Array(NC));
      const rel = new Float32Array(NC);
      for (let c = 0; c < NC; c++) { rel[c] = near[c] - nb[c]; nb[c] += (near[c] - nb[c]) * 0.02; }
      this.nearHist.push(rel);
      if (this.nearHist.length > 6) this.nearHist.shift();
      const A = this.assoc;
      const credit = (arr, scale) => {
        for (let c = 0; c < NC; c++) { let m = 0; for (const h of this.nearHist) if (h[c] > m) m = h[c]; arr[c] += m * scale; }
      };
      for (const ev of obs.events) {
        // big points teach more than the tiny "+1 for staying alive" kind
        if (ev.type === 'score') { const w = U.clamp(ev.size == null ? 0.5 : ev.size, 0.05, 1); credit(A.good, w); A.nGood += w; }
        if (ev.type === 'damage' || ev.type === 'healthZero' || ev.type === 'gameOver' || (ev.type === 'flash' && !obs.hp && !obs.lives)) { credit(A.bad, ev.type === 'flash' ? 0.5 : 1); A.nBad++; }
      }
      // raw = how much more of this color was near me when good/bad stuff happened (vs. normal)
      let mx = 0.015;
      const raw = this.rawAssoc || (this.rawAssoc = new Float32Array(NC));
      for (let c = 0; c < NC; c++) { raw[c] = A.good[c] / (A.nGood + 2) - A.bad[c] / (A.nBad + 2); mx = Math.max(mx, Math.abs(raw[c])); }
      const sure = Math.min(1, (A.nGood + A.nBad) / 5);
      for (let c = 0; c < NC; c++) A.val[c] = U.clamp((raw[c] / mx) * (Math.abs(raw[c]) > 0.008 ? 1 : 0) * sure * 1.5 + A.prior[c], -2, 2);
    }
    // LOOK AHEAD: "if I press this, where will I be, and is that spot nicer?" (near good colors,
    // far from the ones that hurt me). Works for dodging too: standing still under a falling red
    // block is worse than stepping left or right.
    instinct(obs, slots, fear) {
      const out = new Float32Array(MAXA);
      if (!obs.cat) return out;
      const A = this.assoc;
      let any = false;
      for (let c = 0; c < NC; c++) if (A.val[c]) { any = true; break; }
      if (!any) return out;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const cat = obs.cat[i];
        if (cat === this.self.cat || cat === obs.bgCat) continue;
        let v = A.val[cat];
        if (!v) continue;
        if (v < 0) v *= fear;
        pts.push((i % SW + 0.5) / SW, (Math.floor(i / SW) + 0.5) / SH, v, cat);
      }
      if (!pts.length) return out;
      const byCat = new Float32Array(NC);
      const P = (px, py, track) => {
        let s = 0;
        for (let k = 0; k < pts.length; k += 4) {
          const dx = pts[k] - px, dy = (pts[k + 1] - py) * 0.8;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.45) { const v = pts[k + 2] / (d + 0.05); s += v; if (track) byCat[pts[k + 3]] += v * track; }
        }
        return s;
      };
      this.instinctWhy = {};
      const sx = this.self.x, sy = this.self.y;
      const here = P(sx, sy);
      const H = 0.1; // how far ahead it imagines
      for (const s of slots) {
        const a = this.actions[s];
        let ux = 0, uy = 0;
        const ids = a.mouse ? [a.id] : a.keys;
        for (const code of ids) {
          const c = this.controls[code];
          if (!c || !(c.status === 'useful' || c.status === 'starred')) continue;
          if (Math.hypot(c.gx, c.gy) > 0.4) { ux -= c.gx; uy -= c.gy; } else if ((c.dirZ || 0) > 2.5) { const d = dirOf(c); ux += d[0]; uy += d[1]; }
        }
        const m = Math.hypot(ux, uy);
        if (m < 0.2) continue;
        const nx = U.clamp(sx + ux / m * H, 0, 1), ny = U.clamp(sy + uy / m * H, 0, 1);
        byCat.fill(0);
        P(sx, sy, -1);
        out[s] = U.clamp((P(nx, ny, 1) - here) * 0.25, -2.5, 2.5);
        // which color pushed this choice the most?
        let bc = -1, bv = 0;
        for (let c = 0; c < NC; c++) { const v = byCat[c] * Math.sign(out[s] || 1); if (v > bv) { bv = v; bc = c; } }
        this.instinctWhy[s] = bc;
      }
      return out;
    }

    /* ---------------- tips from the player ---------------- */
    applyTip(tip) {
      this.tips.push(Object.assign({ t: Date.now() }, tip));
      if (this.tips.length > 30) this.tips.shift();
      if (tip.type === 'keyRole' || tip.type === 'useKey') {
        const c = this.keyCtl(tip.code);
        if (tip.role) c.tip = tip.role + ' (you told me ✍️)';
        if (c.status !== 'banned') c.status = 'starred';
        this.ensureAction('k:' + tip.code, { keys: [tip.code] });
      } else if (tip.type === 'ban') {
        const c = this.keyCtl(tip.code); c.status = 'banned';
        this.actions.forEach((a) => { if (a.keys.indexOf(tip.code) >= 0) a.active = false; });
      } else if (tip.type === 'unban') {
        const c = this.keyCtl(tip.code); if (c.status === 'banned') c.status = 'new';
      } else if (tip.type === 'color') {
        this.assoc.prior[tip.cat] = U.clamp(this.assoc.prior[tip.cat] + tip.val * 0.8, -1.5, 1.5);
      } else if (tip.type === 'dir') {
        this.tipDir = { x: tip.x, y: tip.y, t: performance.now() };
      } else if (tip.type === 'click') {
        const w = String(tip.word).toLowerCase();
        this.buttonValue[w] = (this.buttonValue[w] || 0) + 2;
      }
    }

    /* ---------------- one step: learn from what just happened, then pick what to do ---------------- */
    step(obs, reward, done, mods, ctx) {
      const now = performance.now();
      this.stats.steps++;
      this._curG40 = obs.g40 || null;
      this.recentScore *= 0.9;
      if (obs.events) for (const ev of obs.events) {
        if (ev.type === 'score') this.recentScore = 1;
        if (ev.type === 'gameOver' || ev.type === 'healthZero' || ev.type === 'damage' || ev.type === 'death') this.lastBadAt = now;
      }
      // 1) learn
      if (obs.ok) {
        this.lastSelfPos = this.self.tracked ? { x: this.self.x, y: this.self.y } : null;
        this.trackSelf(obs);
        this.learnControls(obs, now);
        if (this.stats.steps % 8 === 0) this.findSelf();
        this.learnSelfColor(obs);
        this.updateAssoc(obs);
      }
      const key = obs.ok ? this.hashState(obs) : 0;
      const cnt = (this.novel.get(key) || 0) + 1;
      this.novel.set(key, cnt);
      if (this.novel.size > 40000) this.novel.delete(this.novel.keys().next().value);
      this.noveltyNow = 1 / Math.sqrt(cnt);
      if (this.prev) {
        this.replay.push(this.prev.u8, this.prev.slot, this.gen[this.prev.slot], reward, done);
        this.traj.push({ key: this.prev.key, a: this.prev.slot, r: reward });
        if (this.traj.length > 1600) this.flushTraj(800);
        // reward credit for the keys that were pressed (helps "this key gets points")
        if (reward > 0.3) for (const k of this.prev.keys) this.keyCtl(k).rew += 0.5;
        if (reward < -0.3) for (const k of this.prev.keys) this.keyCtl(k).hurt += 0.5;
      }
      this.checkButton(obs, now);
      if (!obs.ok) { this.prev = null; return { keys: [], mouse: null, reason: "can't see the game 😵", slot: 0 }; }
      const x = this.features(obs, ctx);

      // 2) watching YOU (or nobody playing yet)
      if (ctx.user) {
        const d = this.fromUser(ctx.user);
        this.pushDemo(this.u8, this.actions[d.slot].id, 'you');
        this.remember(d.slot, key, ctx);
        if (this.replay.size() > 300) this.trainQ(8);
        this.trainCopy(8);
        d.reason = 'watching you play 👀 (' + this.actions[d.slot].label + ')';
        this.lastReason = d.reason;
        return d;
      }

      // 3) fun routine in progress?
      if (this.routine) {
        const r = this.routine;
        const st = r.steps[r.i++];
        if (r.i >= r.steps.length) this.routine = null;
        const slot = Math.max(0, this.slotOf(st.id || 'noop'));
        const d = { keys: st.keys || [], mouse: st.mouse || null, slot, reason: r.why };
        this.remember(slot, key, ctx, st.keys || [], st.mouse ? (st.id || null) : null);
        this.lastReason = d.reason;
        return d;
      }

      // 4) choose (sometimes: run a little experiment on a key I don't understand yet)
      this.discover(now, obs, mods);
      const labStep = this.labStep(obs, now, mods);
      if (labStep) {
        const slot = Math.max(0, this.slotOf(labStep.id));
        this.remember(slot, key, ctx, labStep.keys, null);
        if (this.replay.size() > 300) this.trainQ(16);
        this.lastReason = labStep.reason;
        return { keys: labStep.keys, mouse: null, slot, reason: labStep.reason };
      }
      const d = this.choose(obs, mods, x, now);
      this.remember(d.slot, key, ctx);
      // 5) train a little every step
      if (this.replay.size() > 300) this.trainQ(16);
      if (this.demos.n > 30 && this.stats.steps % 2 === 0) this.trainCopy(8);
      return d;
    }
    remember(slot, key, ctx, keysOverride, mouseIdOverride) {
      const a = this.actions[slot];
      this.prevKeysBefore = this.prev ? this.prev.keys : [];
      this.prev = {
        u8: new Uint8Array(this.u8), slot, key,
        keys: keysOverride || (a ? a.keys : []),
        mouseId: mouseIdOverride !== undefined ? mouseIdOverride : (a && a.mouse && a.mouse.t !== 'goto' ? a.id : null),
      };
      if (a) a.tries++;
      this.prevG40 = this._curG40 || this.prevG40;
    }

    // 🔬 LAB: hold the key a bit, let go, watch what changes. Mixed in between normal playing.
    labStep(obs, now, mods) {
      if (obs.menuish || (obs.staticTime || 0) > 1.2) { this.lab = null; return null; }
      if (!this.lab) {
        if (now < this.labNext) return null;
        const todo = this.actions.filter((a) => a.active && !a.mouse && a.keys.length === 1 && this.keyCtl(a.keys[0]).status === 'new' && this.keyCtl(a.keys[0]).tries < 8);
        if (!todo.length) return null;
        todo.sort((a, b) => this.keyCtl(a.keys[0]).tries - this.keyCtl(b.keys[0]).tries);
        const code = todo[0].keys[0];
        this.lab = { code, i: 0, steps: [[code], [code], [code], [], []] };
      }
      const L = this.lab;
      const keys = L.steps[L.i++];
      if (L.i >= L.steps.length) {
        this.lab = null;
        const c = this.keyCtl(L.code);
        // keep testing the same key a few times in a row, then go play for a bit
        this.labNext = c.status === 'new' && c.tries % 3 !== 0 ? now : now + 900 + 1600 * (1 - (mods.curiosity || 0.5));
      }
      return { keys, id: keys.length ? 'k:' + keys[0] : 'noop', reason: '🔬 testing what ' + AIP.KEYS.label(L.code) + ' does...' };
    }

    choose(obs, mods, x, now) {
      const slots = this.activeSlots();
      const q = forward(this.q, this.q.P, x, this.qo, this.h);
      const trust = U.clamp(this.trainSteps / 3000, 0.1, 1);
      // z-score the brain's opinions so they're on the same scale as the rest
      let mean = 0, sd = 0;
      for (const s of slots) mean += q[s];
      mean /= slots.length;
      for (const s of slots) sd += (q[s] - mean) * (q[s] - mean);
      sd = Math.sqrt(sd / slots.length) + 0.05;
      const epiE = this.epi.get(this.hashState(obs));
      let eMean = 0, eN = 0;
      if (epiE) for (const s of slots) if (!isNaN(epiE[s])) { eMean += epiE[s]; eN++; }
      if (eN) eMean /= eN;
      let copyLog = null;
      const copyW = this.copyTrained > 50 ? 1.6 / (1 + Math.max(0, this.stats.episodes - this.stats.lastDemoEp) / 6) : 0;
      if (copyW > 0.05) {
        const c = forward(this.copy, this.copy.P, x, this.co, this.hc);
        let mx = -Infinity;
        for (const s of slots) if (c[s] > mx) mx = c[s];
        let z = 0;
        for (const s of slots) z += Math.exp(c[s] - mx);
        copyLog = {};
        for (const s of slots) copyLog[s] = (c[s] - mx) - Math.log(z);
      }
      const inst = this.instinct(obs, slots, mods.fear);
      const coachV = this.coachValues(slots, now);
      const menuish = obs.menuish != null ? obs.menuish : !!(obs.buttons && obs.buttons.length && (obs.staticTime > 0.6 || obs.motionAmt < 0.004));
      const parts = {};
      const vals = [];
      for (const s of slots) {
        const a = this.actions[s];
        const p = { brain: (q[s] - mean) / sd * 0.9 * trust, memory: 0, copy: 0, instinct: inst[s] * mods.instinct, tip: 0, curious: 0, stick: 0, menu: 0, coach: coachV[s] };
        if (epiE && eN >= 2 && !isNaN(epiE[s])) p.memory = U.clamp((epiE[s] - eMean) * 1.5, -0.8, 0.8);
        if (copyLog) p.copy = copyW * (copyLog[s] + Math.log(slots.length)) * 0.5;
        // curiosity: try stuff I haven't figured out yet
        const ids = a.mouse ? [a.id] : a.keys;
        let unknown = 0;
        const isGoto = a.mouse && a.mouse.t === 'goto';
        if (!isGoto) for (const code of ids) { const c = this.controls[code]; if (!c || c.status === 'new') unknown++; if (c && c.status === 'starred') p.tip += 0.9; }
        if (ids.length && !isGoto) p.curious = unknown / ids.length * 0.3 * mods.curiosity * (1 + mods.confused);
        p.curious += 0.15 * mods.curiosity / Math.sqrt(1 + a.tries / 20);
        if (this.tipDir && performance.now() - this.tipDir.t < 120000) {
          let ux = 0, uy = 0;
          for (const code of ids) { const c = this.controls[code]; if (c) { const d = dirOf(c); ux += d[0] - c.gx; uy += d[1] - c.gy; } }
          const m = Math.hypot(ux, uy);
          if (m > 0.2) p.tip += (ux * this.tipDir.x + uy * this.tipDir.y) / m * 0.8;
        }
        if (a.id === 'm:btn') p.menu = menuish ? 1.6 : -0.3;
        if (menuish && a.keys.length === 1 && (a.keys[0] === 'Enter' || a.keys[0] === 'Space')) p.menu = 0.5;
        if (this.prev && this.prev.slot === s) p.stick = mods.stick;
        if (a.id === 'noop') p.brain -= 0.15 * (1 - mods.patience);
        let v = 0;
        for (const k in p) v += p[k];
        parts[s] = p;
        vals.push(v);
      }
      // pick (softmax with mood temperature) - sometimes just random (exploring / mood swings)
      let pickI;
      const tau = mods.temp;
      if (Math.random() < mods.explore) { pickI = Math.floor(Math.random() * slots.length); this.lastWhy = 'random'; }
      else {
        let mx = -Infinity;
        for (const v of vals) if (v > mx) mx = v;
        let z = 0;
        const ps = vals.map((v) => { const e = Math.exp((v - mx) / tau); z += e; return e; });
        let r = Math.random() * z;
        pickI = 0;
        for (; pickI < ps.length - 1; pickI++) { r -= ps[pickI]; if (r <= 0) break; }
        this.lastWhy = null;
      }
      const slot = slots[pickI];
      const a = this.actions[slot];
      this.lastValues = { slots, vals, parts };
      const reason = this.explain(slot, parts[slot], obs);
      this.lastReason = reason;
      const d = { keys: a.keys, mouse: a.mouse, slot, reason };
      if (a.mouse && a.mouse.t === 'btn') {
        const b = this.pickButton(obs.buttons);
        if (b) { d.mouse = { t: 'btn', el: b.el, text: b.text }; d.reason = "clicking '" + b.text + "' 🖱️"; this.pendingBtn = { text: b.text.toLowerCase(), label: b.text, at: now, key: this.hashState(obs), nb: obs.buttons.length }; }
        else d.mouse = null;
      }
      return d;
    }
    // 🧠 the coach's plan: head for its 🎯 target (2D: move toward it; 3D: turn to face it, then go forward)
    coachValues(slots, now) {
      const out = new Float32Array(MAXA);
      const C = this.coach;
      if (!C || now > C.until) return out;
      const cam = this.self.camera > 0.5;
      const sx = cam ? 0.5 : this.self.x, sy = cam ? 0.5 : this.self.y;
      let vx = 0, vy = 0, dist = 0;
      if (C.target) {
        vx = C.target.x - sx; vy = (C.target.y - sy) * 0.8; dist = Math.hypot(vx, vy);
        if (!cam && dist < 0.05) { C.reached = true; C.target = null; } // made it!
      }
      for (const s of slots) {
        const a = this.actions[s];
        const ids = a.mouse ? [a.id] : a.keys;
        if (C.avoid && ids.some((k) => C.avoid.has(k))) { out[s] -= 2; continue; }
        if (!C.target || dist < 0.03) continue;
        let ux = 0, uy = 0;
        for (const code of ids) {
          const c = this.controls[code];
          if (!c) continue;
          if (Math.hypot(c.gx, c.gy) > 0.4) { ux -= c.gx; uy -= c.gy; } else if ((c.dirZ || 0) > 2.5 || (c.tip && /coach/.test(c.tip))) { const d = dirOf(c); ux += d[0]; uy += d[1]; }
        }
        const m = Math.hypot(ux, uy);
        if (m > 0.2) out[s] += 1.6 * (ux * vx + uy * vy) / (m * dist);
        // 3D: facing the target already? walk forward
        if (cam && Math.abs(vx) < 0.12 && C.forward && ids.some((k) => C.forward.indexOf(k) >= 0)) out[s] += 1.4;
      }
      return out;
    }

    explain(slot, p, obs) {
      const a = this.actions[slot];
      const what = a.label;
      if (this.lastWhy === 'random') return 'random vibes, pressing ' + what + ' 🎲';
      let best = 'brain', bv = -Infinity;
      for (const k in p) if (k !== 'stick' && p[k] > bv) { bv = p[k]; best = k; }
      switch (best) {
        case 'memory': return what + ' - last time I was here that worked 📼';
        case 'copy': return what + ' - copying what I watched ' + (this.demos.from || 'you') + ' do 👀';
        case 'instinct': {
          const c = this.instinctWhy ? this.instinctWhy[slot] : -1;
          if (c == null || c < 0) return what + ' - gut feeling 🫃';
          return this.assoc.val[c] > 0 ? what + ' - going for the ' + AIP.COLORS.names[c] + ' stuff ' + AIP.COLORS.emoji[c] : what + ' - getting AWAY from the ' + AIP.COLORS.names[c] + ' stuff ' + AIP.COLORS.emoji[c] + ' 😨';
        }
        case 'tip': return what + (a.keys.some((k) => this.controls[k] && /coach/.test(this.controls[k].tip || '')) ? ' - my coach taught me this 🧠' : ' - you told me to ✍️');
        case 'coach': return what + ' - coach plan: ' + ((this.coach && (this.coach.target && this.coach.target.what || this.coach.goal)) || 'go there') + ' 🧠🎯';
        case 'curious': return what + ' - never really tried this... what does it do? 🤔';
        case 'menu': return what + ' - looks like a menu, gotta start the game ▶️';
        default: return p.brain > 0.3 ? what + ' - my brain says this is the best move 🧠' : what + ' - just feeling it out 🤷';
      }
    }
    pickButton(buttons) {
      if (!buttons || !buttons.length) return null;
      let best = null, bs = -Infinity;
      for (const b of buttons) {
        const learned = this.buttonValue[b.text.toLowerCase()] || 0;
        const s = b.prio * 2 + learned + Math.random() * 0.8;
        if (s > bs) { bs = s; best = b; }
      }
      return best;
    }
    checkButton(obs, now) {
      const p = this.pendingBtn;
      if (!p || now - p.at < 1200) return;
      this.pendingBtn = null;
      const changed = (obs.ok && this.hashState(obs) !== p.key) || (obs.buttons ? obs.buttons.length : 0) !== p.nb;
      const v = this.buttonValue[p.text] || 0;
      this.buttonValue[p.text] = U.clamp(v + (changed ? 0.6 : -0.5), -3, 4);
      if (changed && v <= 0 && this.buttonValue[p.text] > 0) this.newsQueue.push({ type: 'button', text: p.label });
    }

    // Turn what the player is doing into one of my actions (so I can copy it).
    fromUser(user) {
      const keys = [...user.keys].filter((k) => KEYS.map[k]).sort();
      let id, spec;
      if (user.look && (Math.abs(user.look.dx) > 4 || Math.abs(user.look.dy) > 4)) {
        const h = Math.abs(user.look.dx) >= Math.abs(user.look.dy);
        id = h ? (user.look.dx < 0 ? 'm:look-l' : 'm:look-r') : (user.look.dy < 0 ? 'm:look-u' : 'm:look-d');
        const L = 70;
        spec = { mouse: { t: 'look', dx: h ? Math.sign(user.look.dx) * L : 0, dy: h ? 0 : Math.sign(user.look.dy) * L * 0.6 } };
      } else if (user.clicked) { id = 'm:click'; spec = { mouse: { t: 'click' } }; }
      else if (keys.length) { id = 'k:' + keys.slice(0, 2).join('+'); spec = { keys: keys.slice(0, 2) }; keys.forEach((k) => { const c = this.keyCtl(k); c.user++; this.judge(k, c); }); }
      else { id = 'noop'; spec = { keys: [] }; }
      let slot = this.ensureAction(id, spec);
      if (slot < 0) slot = 0;
      const a = this.actions[slot];
      if (keys.length > 1) a.fromUser = true;
      return { keys: a.keys, mouse: null, slot, reason: '' };
    }

    // 👍 / 👎 from the player: spread it over the last few moves (it can't know exactly which one).
    retroReward(amt, n = 10) {
      const R = this.replay;
      for (let k = 1; k <= Math.min(n, R.size()); k++) {
        const i = (R.seq - k) % R.cap;
        R.R[i] += amt * Math.pow(0.82, k - 1);
        if (Math.abs(R.R[i]) > 0.25) R.important.push(R.seq - k);
      }
      if (this.prev) for (const k of this.prev.keys) { const c = this.keyCtl(k); if (amt > 0) c.rew += 0.3; else c.hurt += 0.3; }
    }

    /* ---------------- training ---------------- */
    trainQ(batch) {
      const R = this.replay;
      if (R.seq < 50) return;
      const x = this.x2, h = this.h2, y = this.qo2;
      const dy = new Float32Array(MAXA);
      let used = 0;
      const activeMask = this.actions.map((a) => !!(a && a.active));
      for (let b = 0; b < batch; b++) {
        const s = R.sample();
        if (!R.valid(s)) continue;
        const i0 = s % R.cap;
        const a = R.A[i0];
        if (R.GEN[i0] !== this.gen[a]) continue;
        // n-step return
        let G = 0, disc = 1, term = false, k = 0;
        for (; k < NSTEP; k++) {
          const sj = s + k;
          if (sj >= R.seq - 1) break;
          const ij = sj % R.cap;
          G += disc * R.R[ij];
          disc *= GAMMA;
          if (R.D[ij]) { term = true; k++; break; }
        }
        if (!term) {
          const sn = s + Math.max(1, k);
          if (sn >= R.seq) continue;
          R.decode(sn, x);
          forward(this.q, this.q.P, x, y, h);
          let best = -1, bv = -Infinity;
          for (let j = 0; j < MAXA; j++) if (activeMask[j] && y[j] > bv) { bv = y[j]; best = j; }
          if (best < 0) continue;
          forward(this.q, this.qT, x, y, h);
          G += disc * y[best];
        }
        R.decode(s, x);
        forward(this.q, this.q.P, x, y, h);
        let td = y[a] - G;
        if (td > 1) td = 1; else if (td < -1) td = -1;
        dy.fill(0); dy[a] = td;
        backward(this.q, x, h, dy);
        used++;
      }
      if (!used) return;
      adam(this.q, 0.0006, 1 / used);
      this.trainSteps++;
      if (this.trainSteps % 300 === 0) this.qT.set(this.q.P);
    }
    pushDemo(u8, id, from) {
      const D = this.demos;
      const i = D.seq % 4000;
      D.S.set(u8, i * IN); D.ids[i] = id; D.seq++; D.n = Math.min(4000, D.n + 1);
      D.from = from;
      if (from === 'you') this.stats.lastDemoEp = this.stats.episodes;
    }
    trainCopy(batch) {
      const D = this.demos;
      if (D.n < 20) return;
      const x = this.x2, h = this.hc, y = this.co;
      const dy = new Float32Array(MAXA);
      const act = this.actions.map((a) => !!(a && a.active));
      let used = 0;
      for (let b = 0; b < batch; b++) {
        const i = Math.floor(Math.random() * D.n);
        const slot = this.slotOf(D.ids[i]);
        if (slot < 0 || !act[slot]) continue;
        const o = i * IN;
        for (let k = 0; k < IN; k++) x[k] = D.S[o + k] / 255;
        forward(this.copy, this.copy.P, x, y, h);
        let mx = -Infinity;
        for (let j = 0; j < MAXA; j++) if (act[j] && y[j] > mx) mx = y[j];
        let z = 0;
        for (let j = 0; j < MAXA; j++) if (act[j]) z += Math.exp(y[j] - mx);
        for (let j = 0; j < MAXA; j++) dy[j] = act[j] ? Math.exp(y[j] - mx) / z - (j === slot ? 1 : 0) : 0;
        backward(this.copy, x, h, dy);
        used++;
      }
      if (!used) return;
      adam(this.copy, 0.001, 1 / used);
      this.copyTrained++;
    }
    flushTraj(n) {
      // "what happened after I did X here" -> episodic memory (average of real returns)
      const T = this.traj;
      let G = 0;
      const rets = new Float32Array(T.length);
      for (let i = T.length - 1; i >= 0; i--) { G = T[i].r + GAMMA * G; rets[i] = G; }
      const upto = Math.min(n, T.length);
      for (let i = 0; i < upto; i++) {
        let e = this.epi.get(T[i].key);
        if (!e) { e = new Float32Array(MAXA).fill(NaN); this.epi.set(T[i].key, e); if (this.epi.size > 8000) this.epi.delete(this.epi.keys().next().value); }
        const a = T[i].a;
        e[a] = isNaN(e[a]) ? rets[i] : e[a] * 0.75 + rets[i] * 0.25;
      }
      this.traj = T.slice(upto);
    }

    /* ---------------- episodes ---------------- */
    endEpisode(info) {
      this.flushTraj(this.traj.length);
      this.prev = null;
      const st = this.stats;
      st.episodes++;
      if (info.died) st.deaths++;
      if (info.won) st.wins++;
      st.history.push({ s: info.score, t: Date.now(), d: Math.round(info.dur), w: info.won ? 1 : 0, k: info.scoreKind });
      if (st.history.length > 400) st.history.splice(0, st.history.length - 400);
      const newBest = st.best == null || info.score > st.best;
      if (newBest && info.score > 0) {
        st.best = info.score;
        // save this run so rivals can watch it later
        const R = this.replay;
        const from = Math.max(this.epStartSeq, R.seq - 1500, R.oldest());
        const n = R.seq - from;
        if (n > 20) {
          const Sx = new Uint8Array(n * IN), ids = [], rew = new Float32Array(n);
          for (let k = 0; k < n; k++) {
            const i = (from + k) % R.cap;
            Sx.set(R.S.subarray(i * IN, i * IN + IN), k * IN);
            const a = this.actions[R.A[i]];
            ids.push(a && R.GEN[i] === this.gen[R.A[i]] ? a.id : 'noop');
            rew[k] = R.R[i];
          }
          this.bestRun = { aiId: this.aiId, score: info.score, S: Sx, ids, rew, n, t: Date.now() };
        }
      }
      this.epStartSeq = this.replay.seq;
      return newBest;
    }

    // You played (it watched): that run doesn't count as one of its tries.
    endWatchEpisode() {
      this.flushTraj(this.traj.length);
      this.prev = null;
      this.epStartSeq = this.replay.seq;
    }

    // DREAMS: replay memories super fast to learn more (real AI trick!).
    async dream(ms, onTick) {
      const end = performance.now() + ms;
      let rounds = 0;
      while (performance.now() < end) {
        if (this.replay.seq > 200) for (let i = 0; i < 4; i++) this.trainQ(32);
        if (this.demos.n > 30) this.trainCopy(16);
        rounds++;
        if (onTick) onTick(rounds);
        await new Promise((r) => setTimeout(r, 0));
        if (this.stopDream) break;
      }
      this.stopDream = false;
      // what was the dream about? the strongest recent memory
      const mem = this.memories.slice(-25);
      if (!mem.length) return { rounds, memory: null };
      let pick = null, ps = -Infinity;
      for (const m of mem) { const s = m.intensity + Math.random() * 0.6; if (s > ps) { ps = s; pick = m; } }
      return { rounds, memory: pick };
    }
    addMemory(kind, text, intensity) {
      this.memories.push({ kind, text, intensity, t: Date.now() });
      if (this.memories.length > 60) this.memories.shift();
    }

    // Watch a rival's best run and learn the good parts.
    learnFromRun(run, name) {
      if (!run || !run.n) return 0;
      let added = 0;
      for (let k = 0; k < run.n; k++) {
        // only the moments shortly before good stuff happened
        let good = false;
        for (let j = k; j < Math.min(run.n, k + 25); j++) if (run.rew[j] > 0.3) { good = true; break; }
        if (!good) continue;
        const id = run.ids[k];
        if (this.slotOf(id) < 0) {
          const keys = id.indexOf('k:') === 0 ? id.slice(2).split('+') : [];
          let spec = { keys };
          if (id.indexOf('m:') === 0) {
            const L = 70;
            const m = { 'm:click': { t: 'click' }, 'm:hold': { t: 'hold' }, 'm:btn': { t: 'btn' }, 'm:look-l': { t: 'look', dx: -L, dy: 0 }, 'm:look-r': { t: 'look', dx: L, dy: 0 }, 'm:look-u': { t: 'look', dx: 0, dy: -L * 0.6 }, 'm:look-d': { t: 'look', dx: 0, dy: L * 0.6 } }[id];
            if (/^m:goto-\d\d$/.test(id)) spec = { mouse: { t: 'goto', x: (+id[7] + 0.5) / 3, y: (+id[8] + 0.5) / 3 } };
            else if (m) spec = { mouse: m }; else continue;
          }
          if (this.ensureAction(id, spec) < 0) continue;
        }
        this.pushDemo(run.S.subarray(k * IN, k * IN + IN), id, name);
        added++;
      }
      if (added) { this.stats.lastDemoEp = this.stats.episodes; for (let i = 0; i < 60; i++) this.trainCopy(16); }
      return added;
    }

    /* ---------------- fun stuff (when it's happy or bored) ---------------- */
    startRoutine(kind) {
      const useful = Object.keys(this.controls).filter((c) => c.indexOf('m:') !== 0 && (this.controls[c].status === 'useful' || this.controls[c].status === 'starred'));
      const dirs = useful.filter((c) => isDirLabel(this.controls[c]));
      const acts = useful.filter((c) => !isDirLabel(this.controls[c]));
      const hx = (c) => { const k = this.controls[c]; return Math.hypot(k.gx, k.gy) > 0.3 ? -k.gx : dirOf(k)[0]; };
      const left = dirs.find((c) => hx(c) < -0.2);
      const right = dirs.find((c) => hx(c) > 0.2);
      const steps = [];
      let why = '', name = kind;
      const k = (keys) => ({ keys, id: 'k:' + keys.join('+') });
      if (kind === 'dance' && left && right) {
        for (let i = 0; i < 14; i++) steps.push(k([i % 4 < 2 ? left : right]));
        why = 'doing a little dance 🕺';
      } else if (kind === 'spam' && acts.length) {
        const a = U.pick(acts);
        for (let i = 0; i < 14; i++) steps.push(i % 2 ? { keys: [], id: 'noop' } : k([a]));
        why = 'spamming ' + KEYS.label(a) + ' for fun 😜';
      } else if (kind === 'spin' && (this.slotOf('m:look-l') >= 0 || left)) {
        for (let i = 0; i < 16; i++) steps.push(this.slotOf('m:look-l') >= 0 ? { keys: [], id: 'm:look-l', mouse: { t: 'look', dx: -90, dy: 0 } } : k([left]));
        why = 'spinning around 🌀';
      } else {
        name = 'wiggle';
        for (let i = 0; i < 10; i++) { const ang = i / 10 * Math.PI * 2; steps.push({ keys: [], id: null, mouse: { t: 'goto', x: 0.5 + Math.cos(ang) * 0.12, y: 0.5 + Math.sin(ang) * 0.12 } }); }
        why = 'wiggling the mouse around 🙃';
      }
      this.routine = { name, steps, i: 0, why };
      return { name, why };
    }

    /* ---------------- what it knows (for the "What it learned" list) ---------------- */
    learned(readouts, primary) {
      const out = [];
      const C = this.controls;
      Object.keys(C).forEach((code) => {
        const c = C[code];
        if (code.indexOf('m:') === 0) {
          if (c.tries < 3 || c.status === 'new') return;
          const label = this.actions[this.slotOf(code)] ? this.actions[this.slotOf(code)].label : code;
          out.push({ kind: 'control', icon: c.status === 'useless' ? '😐' : '🖱️', text: label + ': ' + this.controlLabel(code, c), good: c.status !== 'useless', sort: c.status === 'useless' ? 3 : 1 });
          return;
        }
        if (c.status === 'new' && c.tries < 1 && !c.user) return;
        const icon = { useful: '✅', starred: '⭐', useless: '😐', pause: '⏸️', banned: '🚫', new: '🔬' }[c.status];
        out.push({ kind: 'control', icon, text: KEYS.label(code) + ' = ' + this.controlLabel(code, c), good: c.status === 'useful' || c.status === 'starred', sort: c.status === 'useful' || c.status === 'starred' ? 0 : c.status === 'new' ? 2 : 4 });
      });
      const A = this.assoc;
      for (let c = 0; c < NC; c++) {
        const v = A.val[c];
        const evidence = A.nGood + A.nBad;
        if (Math.abs(v) < 0.12 || (evidence < 2 && !A.prior[c])) continue;
        out.push({ kind: 'color', icon: AIP.COLORS.emoji[c], text: AIP.COLORS.names[c] + ' stuff = ' + (v > 0 ? 'GOOD (points?) 🤑' : 'BAD (it hurts) 😖'), good: v > 0, sort: -1 });
      }
      if (primary && primary.score) out.push({ kind: 'read', icon: '📊', text: "my score is the '" + primary.score + "' number", good: true, sort: -2 });
      if (primary && primary.hp) out.push({ kind: 'read', icon: '❤️', text: "my health is the '" + primary.hp + "' number", good: true, sort: -2 });
      if (primary && primary.lives) out.push({ kind: 'read', icon: '💖', text: "my lives are the '" + primary.lives + "' number", good: true, sort: -2 });
      Object.keys(this.buttonValue).forEach((t) => { const v = this.buttonValue[t]; if (v > 0.5) out.push({ kind: 'button', icon: '▶️', text: "clicking '" + t + "' does something", good: true, sort: 1.5 }); });
      Object.keys(C).forEach((code) => { const c = C[code]; if (code.indexOf('m:') !== 0 && c.hurt > 2 && c.hurt > c.rew * 2) out.push({ kind: 'warn', icon: '⚠️', text: 'pressing ' + KEYS.label(code) + ' often goes badly', good: false, sort: 2.5 }); });
      if (this.self.conf > 0.4 && this.self.camera < 0.5) out.push({ kind: 'self', icon: '📍', text: "I'm the thing around the " + where(this.self.x, this.self.y) + ' of the screen', good: true, sort: -1.5 });
      if (this.self.cat != null && this.self.camera < 0.5) out.push({ kind: 'self', icon: AIP.COLORS.emoji[this.self.cat], text: "I'm " + AIP.COLORS.names[this.self.cat] + (this.self.tracked ? " (and I'm keeping an eye on myself 👀)" : ''), good: true, sort: -1.4 });
      if (this.self.camera > 0.5) out.push({ kind: 'self', icon: '🎥', text: "I see through my own eyes (it's 3D!)", good: true, sort: -1.5 });
      this.tips.slice(-4).forEach((t) => out.push({ kind: 'tip', icon: '✍️', text: 'you said: "' + t.text + '"', good: true, sort: 5 }));
      out.sort((a, b) => a.sort - b.sort);
      return out;
    }

    /* ---------------- save / load ---------------- */
    serialize() {
      const ctl = {};
      Object.keys(this.controls).forEach((k) => { const c = this.controls[k]; ctl[k] = Object.assign({}, c, { map: Array.from(c.map, (v) => Math.round(v * 1000) / 1000) }); });
      const epiKeys = [], epiVals = [];
      let n = 0;
      for (const [k, e] of this.epi) { if (n++ > 6000) break; epiKeys.push(k); epiVals.push(e); }
      const nov = [];
      for (const [k, c] of this.novel) { nov.push(k, c); if (nov.length > 40000) break; }
      return {
        key: this.aiId + '|' + this.gameId, v: VERSION, aiId: this.aiId, gameId: this.gameId, t: Date.now(),
        q: this.q.P, copy: this.copy.P, copyTrained: this.copyTrained, trainSteps: this.trainSteps,
        actions: this.actions, gen: this.gen, controls: ctl, baseMap: this.baseMap, baseVar: this.baseVar, baseAmt: this.baseAmt, quietN: this.quietN,
        self: this.self, assoc: { good: this.assoc.good, bad: this.assoc.bad, nGood: this.assoc.nGood, nBad: this.assoc.nBad, prior: this.assoc.prior },
        buttonValue: this.buttonValue, tips: this.tips, memories: this.memories, stats: this.stats, discoverIdx: this.discoverIdx,
        epiKeys, epiVals, nov, replay: this.replay.dump(2500),
        demos: { S: this.demos.S.slice(0, Math.min(this.demos.n, 1500) * IN), ids: this.demos.ids.slice(0, Math.min(this.demos.n, 1500)), from: this.demos.from },
      };
    }
    load(d) {
      if (!d || d.v !== VERSION) return false;
      try {
        if (d.q && d.q.length === this.q.P.length) { this.q.P.set(d.q); this.qT.set(d.q); }
        if (d.copy && d.copy.length === this.copy.P.length) this.copy.P.set(d.copy);
        this.copyTrained = d.copyTrained || 0; this.trainSteps = d.trainSteps || 0;
        this.actions = d.actions || this.actions;
        if (d.gen) this.gen.set(d.gen);
        Object.keys(d.controls || {}).forEach((k) => { const c = d.controls[k]; c.map = Float32Array.from(c.map || []); if (c.map.length !== N) c.map = new Float32Array(N); c.on = c.on || newAcc(); c.off = c.off || newAcc(); this.controls[k] = c; });
        if (d.baseMap) this.baseMap.set(d.baseMap);
        if (d.baseVar) this.baseVar.set(d.baseVar);
        this.quietN = d.quietN || 0;
        this.baseAmt = d.baseAmt || this.baseAmt;
        Object.assign(this.self, d.self || {});
        if (d.assoc) { this.assoc.good.set(d.assoc.good); this.assoc.bad.set(d.assoc.bad); this.assoc.nGood = d.assoc.nGood; this.assoc.nBad = d.assoc.nBad; this.assoc.prior.set(d.assoc.prior); }
        this.buttonValue = d.buttonValue || {}; this.tips = d.tips || []; this.memories = d.memories || [];
        this.stats = Object.assign(this.stats, d.stats || {});
        this.discoverIdx = d.discoverIdx || 0;
        (d.epiKeys || []).forEach((k, i) => this.epi.set(k, d.epiVals[i]));
        const nov = d.nov || [];
        for (let i = 0; i < nov.length; i += 2) this.novel.set(nov[i], nov[i + 1]);
        this.replay.load(d.replay);
        this.epStartSeq = this.replay.seq;
        if (d.demos && d.demos.ids) d.demos.ids.forEach((id, i) => this.pushDemo(d.demos.S.subarray(i * IN, i * IN + IN), id, d.demos.from || 'you'));
        // re-check actions point at valid things
        this.actions.forEach((a) => { if (a && !a.label) a.label = this.labelOfSpec(a.id, a); });
        return true;
      } catch (e) { console.warn('brain load failed', e); return false; }
    }
  }
  function where(x, y) {
    const h = x < 0.33 ? 'left' : x > 0.66 ? 'right' : 'middle';
    const v = y < 0.33 ? 'top' : y > 0.66 ? 'bottom' : 'center';
    return h === 'middle' && v === 'center' ? 'center' : v + ' ' + h;
  }

  Brain.IN = IN; Brain.MAXA = MAXA;
  return Brain;
})();
