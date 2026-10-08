// The four GAMBLE tracks as generative arrangements. Each `TRACKS[id]()` returns a fresh player
// state with `nextBar()` → { events } where an event is
//   { at (beats, straight — the scheduler applies swing), inst, midi, vel 0..1, dur (beats), pan }.
// Heads are composed from seeded motifs (so every A section is the same tune); solos and comping
// are re-improvised every chorus.
//
//   menu-lounge   ~80 BPM brushed ballad in F: Rhodes, upright, vibes head, strings on the bridge
//   casino-floor  ~132 BPM swing in Bb (rhythm-changes bridge): muted trumpet head, vibes solo
//   motel-radio   ~104 BPM country oldie in G: steel guitar, boom-chick bass, strummed acoustic
//   creator-dmv   ~70 BPM sad elevator muzak in C: strings, arpeggiated Rhodes, vibes, rim click

import { rng, hashStr } from '../dsp.js';
import { parseBar, voicing, bassBar, phrase, contour, CELLS, SLOW_CELLS, nearestPc } from './theory.js';

const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

/** Expand a song form into an endless bar sequence: passes × sections × bars. */
function* formBars(form, order, passes) {
  const flat = [];
  const count = {};
  for (const letter of order) {
    const n = (count[letter] = (count[letter] ?? 0) + 1);
    form[letter].forEach((bar, i) => flat.push({ letter, occ: n, i, bar }));
  }
  const tail = flat.slice(-4);
  for (const b of tail) yield { ...b, pass: 'intro', next: null };
  for (let p = 0; ; p = (p + 1) % passes.length) {
    for (let k = 0; k < flat.length; k++) yield { ...flat[k], pass: passes[p], last: k === flat.length - 1 };
  }
}

/**
 * Shared engine for the jazz-style tracks. cfg: id, bpm, swing, form, order, passes, lead, solo,
 * leadRange, ballad, pad ('bridge' | 'always' | null), comp ('swing'|'ballad'|'arp'),
 * drums ('brush'|'swing'|'muzak'), bass ('walk'|'two'), mix {inst: gain}.
 */
function jazz(cfg) {
  const R = Math.random;
  const st = { voice: null, bass: 36, mel: null, carry: [] };
  const seq = formBars(cfg.form, cfg.order, cfg.passes);
  let cur = seq.next().value;
  let nextBar = seq.next().value;
  const bars = (b) => parseBar(b.bar);

  function lead(b, slots, nslots, ev) {
    if (b.i % 2 !== 0) return; // phrases span two bars
    const chordAt = (beat) => {
      const s = beat < 4 ? slots : nslots;
      const bb = beat % 4;
      return [...s].reverse().find((x) => x.beat <= bb).chord;
    };
    const unit = b.i / 2;
    const [lo, hi] = cfg.leadRange;
    let notes = [];
    let inst = cfg.lead;
    if (b.pass === 'head') {
      // Composed: seeded by section letter + unit, so repeats are the same tune.
      const end = unit === 3;
      const seed = hashStr(`${cfg.id}|${b.letter}|${unit}|${end && b.occ === 3 ? 'out' : ''}`);
      const r = rng(seed);
      const cells = cfg.ballad ? SLOW_CELLS : CELLS;
      let cell = pick(cells, r);
      if (end) cell = cell.filter(([at]) => at < 5).concat([[5, 2.5]]).filter((n, i, a) => i === a.length - 1 || n[0] + n[1] <= 5);
      const s2 = { mel: Math.round(lo + (hi - lo) * (0.45 + r() * 0.2)) };
      notes = phrase(cell, contour(cell.length, r), chordAt, s2, { lo, hi, r, end });
    } else if (b.pass === 'solo') {
      inst = cfg.solo;
      if (R() < 0.15) return; // breathe
      const cell = pick(cfg.ballad ? SLOW_CELLS.concat(CELLS.slice(0, 3)) : CELLS, R);
      notes = phrase(cell, contour(cell.length, R), chordAt, st, { lo: lo - 3, hi: hi + 3, r: R });
    } else if (b.pass === 'keys') {
      inst = 'rhodes';
      if (R() < 0.25) return;
      const cell = pick(cfg.ballad ? SLOW_CELLS : CELLS, R);
      notes = phrase(cell, contour(cell.length, R), chordAt, st, { lo: 67, hi: 84, r: R });
    } else return;
    for (const n of notes) {
      const e = { ...n, inst, pan: inst === 'rhodes' ? -0.15 : cfg.leadPan ?? 0.2 };
      if (e.at >= 4) st.carry.push({ ...e, at: e.at - 4 });
      else ev.push(e);
    }
  }

  function comp(b, slots, ev) {
    const keysSolo = b.pass === 'keys';
    for (const s of slots) {
      st.voice = voicing(s.chord, st.voice, cfg.compLo ?? 52);
      const v = st.voice;
      // Strings: sustained voicing (root voice an octave below the rest for width).
      const padOn = cfg.pad === 'always' || (cfg.pad === 'bridge' && (b.letter === 'B' || b.pass === 'keys'));
      if (padOn) v.forEach((m, k) => ev.push({ at: s.beat, inst: 'pad', midi: m + (k === 0 ? 0 : 12), vel: 0.35, dur: s.beats, pan: 0 }));
      let hits;
      if (cfg.comp === 'ballad') hits = [[0, s.beats * 0.96]];
      else if (cfg.comp === 'arp') {
        // Muzak: polite broken chords in straight eighths.
        const order = [0, 1, 2, 3, 2, 1, 3, 2];
        for (let k = 0; k < s.beats * 2; k++) {
          const m = v[order[k % order.length] % v.length] + 12;
          ev.push({ at: s.beat + k * 0.5, inst: 'rhodes', midi: m, vel: 0.28 + R() * 0.08, dur: 0.6, pan: -0.25 });
        }
        continue;
      } else if (s.beats >= 4) hits = pick([[[0, 1.4], [2.5, 1]], [[1.5, 0.5], [3, 0.9]], [[0, 0.6], [1.5, 2]], [[0, 2]], [[0.5, 1], [2.5, 1.2]]], R);
      else hits = pick([[[0, 1.2]], [[0, 0.5], [1, 0.8]], [[0.5, 1.2]], [[1.5, 0.5]]], R);
      if (keysSolo) hits = hits.slice(0, 1);
      for (const [at, dur] of hits) {
        v.forEach((m, k) => {
          const roll = cfg.comp === 'ballad' ? k * 0.045 : k * 0.008;
          ev.push({ at: s.beat + at + roll, inst: 'rhodes', midi: m, vel: (cfg.comp === 'ballad' ? 0.42 : 0.5) + R() * 0.1, dur, pan: -0.3 + k * 0.08 });
        });
      }
    }
  }

  function drums(b, ev) {
    const d = cfg.drums;
    const fill = b.i % 8 === 7 && R() < 0.6;
    const hit = (at, inst, vel, pan, v = Math.floor(R() * 3)) => ev.push({ at, inst, midi: v, vel, dur: 1, pan });
    if (d === 'muzak') {
      for (let k = 0; k < 8; k++) hit(k * 0.5, 'shaker', k % 2 ? 0.22 : 0.32, -0.35);
      hit(3, 'rim', 0.4, 0.2);
      if (b.i % 2) hit(1.5, 'rim', 0.25, 0.2);
      hit(0, 'kick', 0.3, 0);
      return;
    }
    const brushes = d === 'brush' && b.pass !== 'solo';
    if (brushes) {
      hit(0, 'swish', 0.55, 0.05);
      hit(2, 'swish', 0.5, 0.05);
      hit(1, 'tap', 0.45 + R() * 0.1, 0.05);
      hit(3, 'tap', 0.5 + R() * 0.1, 0.05);
      if (R() < 0.3) hit(2.5, 'tap', 0.2, 0.05);
    } else {
      const ride = [[0, 0.55], [1, 0.75], [1.5, 0.4], [2, 0.55], [3, 0.75], [3.5, 0.4]];
      for (const [at, v] of ride) hit(at, 'ride', v * (d === 'brush' ? 0.7 : 0.85) + R() * 0.08, 0.35);
      // Snare comping: a couple of offbeat chatters per bar.
      for (const at of [0.5, 1.5, 2.5, 3.5]) if (R() < 0.22) hit(at, 'tap', 0.25 + R() * 0.2, 0.05);
    }
    hit(1, 'hat', 0.45, 0.3);
    hit(3, 'hat', 0.45, 0.3);
    hit(0, 'kick', 0.22, 0);
    if (d === 'swing') hit(2, 'kick', 0.18, 0);
    if (fill) for (const at of [2.5, 3, 3.5]) hit(at, 'tap', 0.4 + R() * 0.25, 0.05);
  }

  return {
    id: cfg.id,
    bpm: cfg.bpm,
    swing: cfg.swing,
    mix: cfg.mix,
    reverb: cfg.reverb ?? 0.25,
    radio: cfg.radio ?? 0,
    detune: cfg.detune ?? 0,
    get section() {
      return `${cur.pass} ${cur.letter}${cur.i + 1}`;
    },
    nextBar() {
      const b = cur;
      const slots = bars(b);
      const nslots = bars(nextBar);
      const ev = st.carry;
      st.carry = [];
      const intro = b.pass === 'intro';
      const mode = cfg.bass === 'two' || (cfg.ballad && (b.pass === 'head' || intro)) ? 'two' : 'walk';
      for (const n of bassBar(slots, nslots[0].chord, st, R, mode)) ev.push({ ...n, inst: 'bass', pan: 0.05 });
      comp(b, slots, ev);
      if (!intro) {
        lead(b, slots, nslots, ev);
        drums(b, ev);
      } else if (cfg.drums === 'muzak') drums(b, ev);
      // Final bar of a chorus: let the head's last note ring, a soft crash on the ride.
      if (b.last && b.pass === 'head') ev.push({ at: 0, inst: 'ride', midi: 2, vel: 0.5, dur: 1, pan: 0.35 });
      cur = nextBar;
      nextBar = seq.next().value;
      return { events: ev };
    },
  };
}

/** Country oldie for the motel clock radio. */
function country() {
  const R = Math.random;
  const form = {
    V: ['G', 'G7', 'C', 'C', 'G', 'Em', 'A7', 'D7'],
    C: ['C', 'C', 'G', 'G', 'D', 'D7', 'G', 'G'],
  };
  const seq = formBars(form, 'VCVC', ['head', 'solo']);
  const st = { voice: null, bass: 36, mel: null, carry: [] };
  let cur = seq.next().value;
  let nb = seq.next().value;
  return {
    id: 'motel-radio',
    bpm: 104,
    swing: 0.58,
    reverb: 0.1,
    radio: 1,
    mix: { bass: 0.8, guitar: 0.45, steel: 0.22, tap: 0.5, kick: 2.0, shaker: 0.4 },
    get section() {
      return `${cur.pass} ${cur.letter}${cur.i + 1}`;
    },
    nextBar() {
      const b = cur;
      const slots = parseBar(b.bar);
      const nslots = parseBar(nb.bar);
      const ev = st.carry;
      st.carry = [];
      for (const n of bassBar(slots, nslots[0].chord, st, R, 'boom')) ev.push({ ...n, inst: 'bass', pan: 0 });
      // Strummed acoustic: "chick" on 2 and 4, light upstroke on the and-of-4.
      const c = slots[0].chord;
      st.voice = voicing(c, st.voice, 55);
      const strum = [nearestPc(c.root, 52), ...st.voice, st.voice[0] + 12];
      for (const [at, vel, up] of [[1, 0.6, 0], [3, 0.65, 0], [3.5, 0.3, 1]]) {
        if (up && R() < 0.4) continue;
        const notes = up ? [...strum].reverse().slice(0, 3) : strum;
        notes.forEach((m, k) => ev.push({ at: at + k * 0.03, inst: 'guitar', midi: m, vel: vel - k * 0.03, dur: 0.9, pan: -0.3 }));
      }
      if (b.pass !== 'intro') {
        ev.push({ at: 0, inst: 'kick', midi: 0, vel: 0.5, dur: 1, pan: 0 });
        ev.push({ at: 2, inst: 'kick', midi: 1, vel: 0.45, dur: 1, pan: 0 });
        ev.push({ at: 1, inst: 'tap', midi: Math.floor(R() * 3), vel: 0.7, dur: 1, pan: 0 });
        ev.push({ at: 3, inst: 'tap', midi: Math.floor(R() * 3), vel: 0.75, dur: 1, pan: 0 });
        for (let k = 0; k < 8; k++) ev.push({ at: k * 0.5, inst: 'shaker', midi: k % 3, vel: k % 2 ? 0.3 : 0.45, dur: 1, pan: 0.3 });
        // Steel: composed melody on the head, licks on the solo pass.
        if (b.i % 2 === 0) {
          const chordAt = (beat) => (beat < 4 ? slots : nslots)[0].chord;
          const unit = b.i / 2;
          const r = b.pass === 'head' ? rng(hashStr(`radio|${b.letter}|${unit}`)) : R;
          const cell = pick(b.pass === 'head' ? SLOW_CELLS : CELLS.slice(0, 4), r);
          const s = b.pass === 'head' ? { mel: 67 + Math.floor(r() * 5) } : st;
          const notes = phrase(cell, contour(cell.length, r), chordAt, s, { lo: 62, hi: 81, r, end: unit === 3 });
          for (const n of notes) {
            const e = { ...n, inst: 'steel', pan: 0.25 };
            if (e.at >= 4) st.carry.push({ ...e, at: e.at - 4 });
            else ev.push(e);
          }
        }
      }
      cur = nb;
      nb = seq.next().value;
      return { events: ev };
    },
  };
}

export const TRACKS = {
  'menu-lounge': () =>
    jazz({
      id: 'menu-lounge',
      bpm: 80,
      swing: 0.64,
      ballad: true,
      form: {
        A: ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Am7 D7', 'Gm7 C7', 'Fmaj7 Bb7', 'Am7 D7b9'],
        B: ['Cm7', 'F7', 'Bbmaj7', 'Bbmaj7', 'Ebm7', 'Ab7', 'Gm7', 'C7b9'],
      },
      order: 'AABA',
      passes: ['head', 'solo', 'keys', 'head'],
      lead: 'vibes',
      solo: 'vibes',
      leadRange: [65, 84],
      leadPan: 0.3,
      comp: 'ballad',
      drums: 'brush',
      pad: 'bridge',
      reverb: 0.35,
      mix: { rhodes: 0.3, bass: 1.0, vibes: 0.9, pad: 0.18, swish: 0.7, tap: 1.0, hat: 1.0, kick: 1.0, ride: 0.6 },
    }),
  'casino-floor': () =>
    jazz({
      id: 'casino-floor',
      bpm: 132,
      swing: 0.62,
      form: {
        A: ['Bbmaj7 G7', 'Cm7 F7', 'Dm7 G7', 'Cm7 F7', 'Fm7 Bb7', 'Ebmaj7 Ab7', 'Dm7 G7b9', 'Cm7 F7'],
        B: ['D7', 'D7', 'G7', 'G7', 'C7', 'C7', 'F7', 'F7'],
      },
      order: 'AABA',
      passes: ['head', 'solo', 'keys', 'head'],
      lead: 'trumpet',
      solo: 'vibes',
      leadRange: [62, 81],
      leadPan: 0.15,
      comp: 'swing',
      drums: 'swing',
      reverb: 0.2,
      mix: { rhodes: 0.3, bass: 0.9, trumpet: 0.5, vibes: 0.7, ride: 0.5, tap: 1.2, hat: 1.4, kick: 1.0 },
    }),
  'motel-radio': country,
  'creator-dmv': () =>
    jazz({
      id: 'creator-dmv',
      bpm: 70,
      swing: 0.5,
      ballad: true,
      form: {
        A: ['Fmaj7', 'Fm6', 'Em7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Cmaj7'],
        B: ['Am7', 'Am7 D7', 'Dm7', 'G7', 'Em7 A7', 'Dm7 G7', 'Cmaj7', 'Fmaj7 G7'],
      },
      order: 'AABA',
      passes: ['head', 'head'],
      lead: 'vibes',
      solo: 'vibes',
      leadRange: [67, 84],
      leadPan: 0.25,
      comp: 'arp',
      compLo: 55,
      drums: 'muzak',
      bass: 'two',
      pad: 'always',
      reverb: 0.3,
      detune: 9, // worn-tape wobble (cents)
      mix: { rhodes: 0.42, bass: 0.9, vibes: 1.5, pad: 0.3, shaker: 0.45, rim: 1.8, kick: 1.2 },
    }),
};

export const TRACK_IDS = Object.keys(TRACKS);
