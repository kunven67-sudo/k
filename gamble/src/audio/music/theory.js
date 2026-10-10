// Small jazz-theory toolkit for the generative tracks: chord symbols, voice-led rootless voicings,
// walking bass lines and motif-based melodies. Pure functions over MIDI numbers; randomness is
// always passed in (`r`) so a composed section can be replayed identically from a seed.

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// tones = chord tones, tens = colour tones for voicings, scale = notes a melody may step through.
const QUAL = {
  maj7: { tones: [0, 4, 7, 11], tens: [2, 9], scale: [0, 2, 4, 7, 9, 11] },
  m7: { tones: [0, 3, 7, 10], tens: [2, 5], scale: [0, 2, 3, 5, 7, 9, 10] },
  7: { tones: [0, 4, 7, 10], tens: [2, 9], scale: [0, 2, 4, 7, 9, 10] },
  '7b9': { tones: [0, 4, 7, 10], tens: [1, 8], scale: [0, 1, 4, 7, 8, 10] },
  m7b5: { tones: [0, 3, 6, 10], tens: [5, 8], scale: [0, 1, 3, 5, 6, 8, 10] },
  m6: { tones: [0, 3, 7, 9], tens: [2, 11], scale: [0, 2, 3, 5, 7, 9, 11] },
  6: { tones: [0, 4, 7, 9], tens: [2], scale: [0, 2, 4, 7, 9] },
  '': { tones: [0, 4, 7], tens: [], scale: [0, 2, 4, 7, 9] },
  m: { tones: [0, 3, 7], tens: [], scale: [0, 2, 3, 5, 7, 10] },
};

/** Parse 'Bbmaj7', 'D7b9', 'Cm7b5', 'G' → { name, root (pc), q, tones, tens, scale }. */
export function chord(sym) {
  const m = /^([A-G])(b|#)?(.*)$/.exec(sym);
  const root = (PC[m[1]] + (m[2] === 'b' ? 11 : m[2] === '#' ? 1 : 0)) % 12;
  const q = QUAL[m[3]] ? m[3] : '7';
  return { name: sym, root, q, ...QUAL[q] };
}

/** Parse a bar string 'Am7 D7' into [{chord, beat, beats}] (chords split the 4 beats evenly). */
export function parseBar(str, beats = 4) {
  const syms = str.trim().split(/\s+/);
  const each = beats / syms.length;
  return syms.map((s, i) => ({ chord: chord(s), beat: i * each, beats: each }));
}

/** Nearest MIDI note with pitch class `pc` to `near`. */
export const nearestPc = (pc, near) => near + ((((pc - near) % 12) + 18) % 12) - 6;

const pcsOf = (c, set) => set.map((i) => (c.root + i) % 12);

/**
 * Rootless 4-note voicing for `c`, voice-led from `prev` (array of MIDI notes) inside
 * [lo, lo+octave+]. Triads get close-position voicings including the root.
 */
export function voicing(c, prev, lo = 52, r = Math.random) {
  let pcs;
  if (c.tones.length === 3) pcs = pcsOf(c, c.tones);
  else {
    const color = c.tens.length ? c.tens : [c.tones[2]];
    pcs = pcsOf(c, [c.tones[1], c.tones[3], color[0], color[1] ?? c.tones[2]]);
  }
  pcs = [...new Set(pcs)].sort((a, b) => a - b);
  let best = null, bestCost = Infinity;
  for (let rot = 0; rot < pcs.length; rot++) {
    const order = pcs.slice(rot).concat(pcs.slice(0, rot));
    for (const base of [lo - 6, lo, lo + 6]) {
      const notes = [];
      let n = base + ((((order[0] - base) % 12) + 12) % 12);
      notes.push(n);
      for (let k = 1; k < order.length; k++) {
        n = n + ((((order[k] - n) % 12) + 12) % 12 || 12);
        notes.push(n);
      }
      let cost = 0;
      if (prev && prev.length) {
        const p = [...prev].sort((a, b) => a - b);
        for (let k = 0; k < notes.length; k++) cost += Math.abs(notes[k] - (p[k] ?? p[p.length - 1]));
      } else cost = Math.abs(notes[0] - lo - 3) * 2;
      if (notes[0] < lo - 3) cost += (lo - 3 - notes[0]) * 4; // keep it out of the mud
      if (notes[notes.length - 1] > lo + 20) cost += 20;
      cost += r() * 1.5; // a little indecision so repeated changes don't sound robotic
      if (cost < bestCost) (bestCost = cost), (best = notes);
    }
  }
  return best;
}

const BASS_LO = 28, BASS_HI = 50;
const fold = (n, lo, hi) => {
  while (n < lo) n += 12;
  while (n > hi) n -= 12;
  return n;
};

/**
 * Walking bass for one bar. `slots` = parsed bar, `next` = first chord of the next bar.
 * mode 'walk' = four quarters, 'two' = half notes, 'boom' = country root-fifth.
 * Returns [{at, midi, dur, vel}], updates state.bass.
 */
export function bassBar(slots, next, state, r, mode = 'walk') {
  const out = [];
  let cur = state.bass ?? 36;
  const chordAt = (b) => [...slots].reverse().find((s) => s.beat <= b).chord;
  if (mode === 'boom') {
    const c = slots[0].chord;
    const root = fold(nearestPc(c.root, 36), 31, 45);
    out.push({ at: 0, midi: root, dur: 1.6, vel: 0.85 });
    const c2 = chordAt(2);
    const r2 = fold(nearestPc(c2.root, 36), 31, 45);
    out.push({ at: 2, midi: c2 === c ? (r() < 0.75 ? root + 7 : root - 5) : r2, dur: 1.6, vel: 0.75 });
    state.bass = root;
    return out;
  }
  const step = mode === 'two' ? 2 : 1;
  for (let b = 0; b < 4; b += step) {
    const c = chordAt(b);
    const isStart = slots.some((s) => s.beat === b);
    const nb = b + step;
    const nc = nb >= 4 ? next : chordAt(nb);
    const changes = nb >= 4 || slots.some((s) => s.beat === nb);
    let n;
    if (isStart) {
      n = nearestPc(c.root, cur);
      if (r() < 0.12 && b > 0) n = nearestPc(c.root + 7, cur);
    } else if (changes && nc) {
      const target = fold(nearestPc(nc.root, cur), BASS_LO, BASS_HI);
      const k = r();
      n = k < 0.6 ? target + (cur > target ? 1 : -1) : k < 0.8 ? target + 7 - 12 * (target + 7 > BASS_HI ? 1 : 0) : target - 1;
    } else {
      const target = nc ? fold(nearestPc(nc.root, cur), BASS_LO, BASS_HI) : cur;
      const dir = Math.sign(target - cur) || (r() < 0.5 ? 1 : -1);
      const opts = c.tones.concat(c.scale).map((i) => nearestPc(c.root + i, cur + dir * 3)).filter((m) => m !== cur && Math.abs(m - cur) <= 5);
      n = opts.length ? opts[Math.floor(r() * opts.length)] : cur + dir * 2;
    }
    n = fold(n, BASS_LO, BASS_HI);
    out.push({ at: b, midi: n, dur: step * 0.92, vel: b === 0 ? 0.9 : 0.72 + r() * 0.12 });
    cur = n;
  }
  state.bass = cur;
  return out;
}

// Rhythm cells over two bars (8 beats): [at, dur]. Swing eighths are written as .5.
export const CELLS = [
  [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1.5], [4, 0.5], [4.5, 0.5], [5, 1], [6, 2]],
  [[0.5, 0.5], [1, 0.5], [1.5, 1], [3, 1], [4, 2.5]],
  [[0, 1.5], [1.5, 0.5], [2, 0.5], [2.5, 1.5], [5, 0.5], [5.5, 0.5], [6, 1.5]],
  [[1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1], [4, 3]],
  [[0, 2], [2.5, 0.5], [3, 0.5], [3.5, 1.5], [6, 1.5]],
  [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [3.5, 0.5], [4, 0.5], [4.5, 2]],
];
// Slow, sparse cells for ballads / muzak.
export const SLOW_CELLS = [
  [[0, 2], [2, 1], [3, 1], [4, 3]],
  [[0, 1.5], [1.5, 2.5], [4, 2], [6, 1]],
  [[1, 1], [2, 2], [4, 1], [5, 2.5]],
  [[0, 3], [3, 1], [4, 4]],
];

/**
 * Generate a two-bar melodic phrase over `chordAt(beat)` (beat 0..8). `cell` is a rhythm cell,
 * `contour` a list of scale-step moves (reused to make motifs recognisable). Strong notes snap
 * to chord tones. state.mel holds the last note so phrases connect.
 */
export function phrase(cell, contour, chordAt, state, { lo, hi, r = Math.random, end = false }) {
  const out = [];
  let last = state.mel ?? Math.round((lo + hi) / 2);
  cell.forEach(([at, dur], k) => {
    const c = chordAt(at);
    const scale = [];
    for (let m = lo; m <= hi; m++) if (c.scale.includes((((m - c.root) % 12) + 12) % 12)) scale.push(m);
    let idx = scale.reduce((bi, m, i) => (Math.abs(m - last) < Math.abs(scale[bi] - last) ? i : bi), 0);
    idx += contour[k % contour.length];
    if (idx < 0) idx = -idx;
    if (idx >= scale.length) idx = 2 * (scale.length - 1) - idx;
    let n = scale[Math.max(0, Math.min(scale.length - 1, idx))];
    const strong = dur >= 1 || at % 2 === 0;
    if (strong) {
      const ok = c.tones.concat(c.tens).map((i) => (c.root + i) % 12);
      for (let d = 0; d < 3; d++) {
        if (ok.includes(((n + d) % 12 + 12) % 12) && n + d <= hi) { n += d; break; }
        if (ok.includes(((n - d) % 12 + 12) % 12) && n - d >= lo) { n -= d; break; }
      }
    }
    if (end && k === cell.length - 1) n = nearestPc(c.root + (r() < 0.5 ? c.tones[1] : 0), n);
    out.push({ at, midi: n, dur: dur * 0.95, vel: 0.62 + (strong ? 0.15 : 0) + r() * 0.1 });
    last = n;
  });
  state.mel = last;
  return out;
}

/** Random contour: mostly steps, the odd leap, with a gentle arch. */
export function contour(n, r) {
  const c = [];
  for (let i = 0; i < n; i++) {
    const leap = r() < 0.2;
    const dir = i < n / 2 ? (r() < 0.65 ? 1 : -1) : r() < 0.65 ? -1 : 1;
    c.push(dir * (leap ? 2 + Math.floor(r() * 2) : 1));
  }
  return c;
}
