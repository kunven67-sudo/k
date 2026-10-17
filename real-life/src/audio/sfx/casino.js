// Casino SFX: chips, cards, dice, slot machines, roulette, cage and cash.
//
// Physical recipes: every impact = contact transient (filtered noise burst) + resonant body
// (modal synthesis, inharmonic decaying sinusoids) + optional tail. Clay-composite chips ring
// high and short; acrylic dice are dull on felt but clack on the rail; slot bells are long.

import {
  oneShot, loopShot, buf, noise, pink, brown, biquad, lp, hp, bp, peak, env, mix, modal, burst,
  drive, gen, wander, mtof, TAU,
} from '../dsp.js';

// ---------- shared physical models ----------

/** One clay chip hitting another: bright click + a couple of quick inharmonic rings. */
export function chipHit(x, sr, at, g, r) {
  const f = 2900 + r() * 900;
  mix(x, burst(sr, 0.006, 5200 + r() * 2000, 0.9, r), sr, at, 0.9 * g);
  modal(x, sr, [
    [f, 0.35, 0.018], [f * 1.73, 0.25, 0.012], [f * 2.41, 0.16, 0.008], [f * 0.47, 0.12, 0.03],
  ], at, g, r);
}

/** Chip landing on felt: muffled thump, almost no ring. */
function chipFelt(x, sr, at, g, r) {
  const t = burst(sr, 0.02, 900 + r() * 400, 0.7, r, 'lp');
  mix(x, t, sr, at, g);
  modal(x, sr, [[2600 + r() * 600, 0.08, 0.008]], at, g, r);
}

/** A coin: metallic disc modes (ratios of a free circular plate), long shimmering ring. */
export function coinHit(x, sr, at, g, r, ring = 1) {
  const f = 2300 + r() * 1800;
  mix(x, burst(sr, 0.004, 7000, 0.8, r), sr, at, 0.5 * g);
  modal(x, sr, [
    [f, 0.3, 0.12 * ring], [f * 1.594, 0.22, 0.09 * ring], [f * 2.136, 0.16, 0.07 * ring],
    [f * 2.653, 0.1, 0.05 * ring], [f * 3.156, 0.07, 0.04 * ring],
  ], at, g, r);
}

/** Bell strike (struck metal bell partials: hum, prime, tierce, quint, nominal...). */
export function bell(x, sr, at, f, g, r, len = 1) {
  modal(x, sr, [
    [f * 0.5, 0.15, 0.9 * len], [f, 0.5, 0.7 * len], [f * 1.2, 0.18, 0.5 * len],
    [f * 1.5, 0.14, 0.4 * len], [f * 2.0, 0.22, 0.35 * len], [f * 2.52, 0.08, 0.2 * len],
    [f * 3.01, 0.06, 0.15 * len],
  ], at, g, r);
  mix(x, burst(sr, 0.003, 6000, 1, r), sr, at, 0.3 * g);
}

/** Paper/card snap: a tight bandpassed noise spike. */
export function snap(x, sr, at, g, r, f = 3200, dur = 0.012) {
  mix(x, burst(sr, dur, f, 1.2, r), sr, at, g);
}

/** Swish of a card through air: noise with a fast band sweep. */
export function swish(x, sr, at, dur, g, r, f0 = 1200, f1 = 4500) {
  const n = noise(Math.floor(dur * sr), r);
  biquad(n, sr, 'bp', (t) => f0 + (f1 - f0) * (t / dur), 1.4);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / dur)) ** 2);
  mix(x, n, sr, at, g);
}

/** Dice body: acrylic cube modes. `hard` 0 (felt) .. 1 (wooden wall). */
export function diceHit(x, sr, at, g, r, hard = 0) {
  const f = 1700 + r() * 500;
  if (hard > 0.5) mix(x, burst(sr, 0.004, 4500, 1, r), sr, at, g);
  const thud = burst(sr, 0.03, 300 + hard * 300, 0.8, r, 'lp');
  mix(x, thud, sr, at, g * (1.2 - hard * 0.5));
  modal(x, sr, [
    [f, 0.25 * (0.3 + hard), 0.02 + hard * 0.03], [f * 1.61, 0.15 * (0.3 + hard), 0.015 + hard * 0.02],
    [f * 2.37, 0.1 * hard, 0.01], [f * 0.55, 0.12, 0.025],
  ], at, g, r);
}

// ---------- chips ----------

oneShot('chip.clack', (sr, r) => {
  const x = buf(0.18, sr);
  chipHit(x, sr, 0.002, 1, r);
  chipHit(x, sr, 0.011 + r() * 0.006, 0.45, r); // tiny rebound
  return x;
});

oneShot('chip.stack', (sr, r) => {
  // A short stack being set down: a quick cascade of clacks that settle.
  const x = buf(0.4, sr);
  let t = 0.002;
  for (let k = 0; k < 6; k++) {
    chipHit(x, sr, t, 1 - k * 0.12, r);
    t += 0.018 + r() * 0.02 + k * 0.006;
  }
  chipFelt(x, sr, 0.004, 0.6, r);
  return x;
});

oneShot('chip.slide', (sr, r) => {
  // Pushing a stack across felt: soft broadband friction with fabric grain, ends in a clack.
  const d = 0.55;
  const x = buf(d + 0.15, sr);
  const n = pink(Math.floor(d * sr), r);
  const w = wander(d, sr, 30, r);
  bp(n, sr, 1400, 0.6);
  env(n, sr, (t) => Math.sin(Math.PI * (t / d)) * (0.6 + 0.4 * w(t)));
  mix(x, n, sr, 0, 1.4);
  chipHit(x, sr, d - 0.02, 0.5, r);
  return x;
});

oneShot('chip.scatter', (sr, r) => {
  // A handful tossed onto the layout: many clacks + felt thumps, decaying density.
  const x = buf(1.0, sr);
  for (let k = 0; k < 22; k++) {
    const t = Math.pow(r(), 1.8) * 0.75;
    const g = 0.3 + r() * 0.7 * (1 - t);
    if (r() < 0.6) chipHit(x, sr, t, g, r);
    else chipFelt(x, sr, t, g, r);
  }
  return x;
});

// ---------- cards ----------

oneShot('card.deal', (sr, r) => {
  const x = buf(0.32, sr);
  snap(x, sr, 0.0, 0.5, r, 2800); // leaving the shoe/hand
  swish(x, sr, 0.01, 0.16, 0.5, r, 900, 3800);
  const slap = burst(sr, 0.025, 1300, 0.6, r, 'lp'); // landing flat on felt
  mix(x, slap, sr, 0.17, 1);
  snap(x, sr, 0.17, 0.25, r, 4200, 0.006);
  return x;
});

oneShot('card.flip', (sr, r) => {
  const x = buf(0.22, sr);
  snap(x, sr, 0.0, 0.6, r, 3600, 0.01); // edge lift
  swish(x, sr, 0.015, 0.08, 0.35, r, 2000, 5000);
  mix(x, burst(sr, 0.02, 1500, 0.6, r, 'lp'), sr, 0.1, 0.9);
  snap(x, sr, 0.1, 0.4, r, 3000, 0.008);
  return x;
});

oneShot('card.shuffle', (sr, r) => {
  // Riffle shuffle: two halves zipping together (accelerating flutter), then the bridge.
  const x = buf(1.45, sr);
  let t = 0.02;
  const n = 52;
  for (let k = 0; k < n; k++) {
    const p = k / n;
    snap(x, sr, t, 0.3 + 0.3 * Math.sin(p * Math.PI), r, 2500 + r() * 2500, 0.006);
    t += 0.016 - p * 0.008 + r() * 0.004;
  }
  // Bridge: cards cascading back in a soft "brrrp".
  const bt = t + 0.12;
  for (let k = 0; k < 40; k++) snap(x, sr, bt + k * 0.0075 + r() * 0.002, 0.18, r, 1800 + r() * 1500, 0.008);
  mix(x, burst(sr, 0.05, 700, 0.7, r, 'lp'), sr, bt + 0.32, 1.1); // squared up on the felt
  return x;
});

oneShot('card.slide', (sr, r) => {
  const d = 0.35;
  const x = buf(d + 0.05, sr);
  const n = noise(Math.floor(d * sr), r);
  bp(n, sr, 2400, 0.8);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / d)) ** 1.5);
  mix(x, n, sr, 0, 0.7);
  return x;
});

// ---------- dice ----------

oneShot('dice.hit-felt', (sr, r) => {
  const x = buf(0.2, sr);
  diceHit(x, sr, 0.002, 1, r, 0);
  return x;
});

oneShot('dice.hit-wall', (sr, r) => {
  const x = buf(0.25, sr);
  diceHit(x, sr, 0.002, 1, r, 1);
  diceHit(x, sr, 0.006 + r() * 0.004, 0.6, r, 1); // second die a hair later
  return x;
});

oneShot('dice.roll', (sr, r) => {
  // Two dice thrown along a craps table: bounces, rail clack, tumbling rattle, settle.
  const x = buf(1.6, sr);
  const bounces = [0.0, 0.18, 0.31, 0.42];
  bounces.forEach((t, k) => {
    diceHit(x, sr, t, 1 - k * 0.15, r, 0);
    diceHit(x, sr, t + 0.03 + r() * 0.02, 0.8 - k * 0.15, r, 0);
  });
  diceHit(x, sr, 0.55, 1, r, 1); // back wall
  diceHit(x, sr, 0.565, 0.8, r, 1);
  let t = 0.62;
  for (let k = 0; k < 14; k++) {
    // tumbling, quieter and closer together
    diceHit(x, sr, t, 0.5 * (1 - k / 16), r, k % 3 === 0 ? 0.6 : 0.1);
    t += 0.035 + r() * 0.04 + k * 0.004;
  }
  return x;
});

// ---------- slots ----------

oneShot('slot.lever', (sr, r) => {
  // Pull: ratchet pawl clicks over a spring stretch, release clunk, spring twang back.
  const x = buf(1.1, sr);
  for (let k = 0; k < 9; k++) {
    const t = 0.02 + k * 0.045 + k * k * 0.001;
    mix(x, burst(sr, 0.005, 3800, 2, r), sr, t, 0.4);
    modal(x, sr, [[1900 + k * 40, 0.06, 0.02]], t, 1, r);
  }
  const spring = gen(0.5, sr, (t) => Math.sin(TAU * (90 + 30 * Math.exp(-t * 8)) * t) * Math.exp(-t * 7) * 0.4);
  mix(x, spring, sr, 0.47, 1);
  mix(x, burst(sr, 0.05, 220, 0.8, r, 'lp'), sr, 0.45, 1.6); // bottom-out clunk
  modal(x, sr, [[420, 0.25, 0.08], [1130, 0.1, 0.05], [2310, 0.05, 0.03]], 0.45, 1, r);
  mix(x, burst(sr, 0.04, 180, 0.8, r, 'lp'), sr, 0.78, 0.9); // returns home
  modal(x, sr, [[560, 0.12, 0.06]], 0.78, 1, r);
  return x;
});

oneShot('slot.button', (sr, r) => {
  // Big illuminated plastic button: snap down + microswitch tick + release.
  const x = buf(0.2, sr);
  mix(x, burst(sr, 0.012, 1600, 1, r), sr, 0, 0.7);
  modal(x, sr, [[850, 0.2, 0.025], [2300, 0.1, 0.012]], 0, 1, r);
  mix(x, burst(sr, 0.003, 5200, 2, r), sr, 0.008, 0.6);
  mix(x, burst(sr, 0.01, 1900, 1, r), sr, 0.09, 0.35);
  return x;
});

loopShot('slot.reel-spin', (sr, r) => {
  // Stepper motor whine + symbol strip ticks (~18/s) + a soft rumble. Exactly 2 s loop.
  const d = 2.0, xf = 0.2;
  const x = buf(d + xf, sr);
  const m = gen(d + xf, sr, (t) =>
    0.12 * Math.sin(TAU * 196 * t) + 0.06 * Math.sin(TAU * 392 * t + 0.3) + 0.04 * Math.sin(TAU * 588 * t));
  mix(x, m, sr, 0, 1);
  const rum = brown(x.length, r);
  lp(rum, sr, 160);
  mix(x, rum, sr, 0, 0.6);
  for (let t = 0; t < d + xf; t += 1 / 18) {
    mix(x, burst(sr, 0.008, 2400 + r() * 300, 1.4, r), sr, t, 0.35 + r() * 0.1);
  }
  return x;
}, { db: -6, xf: 0.2 });

oneShot('slot.reel-stop', (sr, r) => {
  // Reel brake: solenoid clunk + overshoot bounce.
  const x = buf(0.35, sr);
  mix(x, burst(sr, 0.04, 260, 0.9, r, 'lp'), sr, 0, 1.4);
  modal(x, sr, [[310, 0.3, 0.06], [780, 0.15, 0.04], [1620, 0.08, 0.025]], 0, 1, r);
  mix(x, burst(sr, 0.006, 3000, 1.2, r), sr, 0, 0.6);
  mix(x, burst(sr, 0.02, 400, 0.9, r, 'lp'), sr, 0.07, 0.4); // settle
  return x;
});

/** Major-chord chime arpeggio — the classic happy machine voice. */
function chimeRun(x, sr, at, notes, step, g, r, len = 0.6) {
  notes.forEach((m, k) => bell(x, sr, at + k * step, mtof(m), g * (0.8 + 0.2 * r()), r, len));
}

oneShot('slot.win-small', (sr, r) => {
  const x = buf(1.6, sr);
  chimeRun(x, sr, 0, [76, 80, 83, 88], 0.09, 0.6, r, 0.7); // E major up
  chimeRun(x, sr, 0.4, [83, 88], 0.09, 0.5, r, 1.1);
  return x;
});

oneShot('slot.win-big', (sr, r) => {
  // Fanfare chimes over a coin hopper burst.
  const x = buf(4.2, sr);
  const runs = [[72, 76, 79, 84], [74, 77, 81, 86], [76, 79, 83, 88], [79, 84, 88, 91]];
  runs.forEach((run, k) => chimeRun(x, sr, k * 0.42, run, 0.07, 0.55, r, 0.8));
  chimeRun(x, sr, 1.75, [84, 88, 91, 96, 91, 96], 0.11, 0.5, r, 1.4);
  for (let k = 0; k < 120; k++) coinHit(x, sr, 0.3 + r() * 3.2, 0.12 + r() * 0.12, r, 0.6);
  return x;
}, { db: -2 });

loopShot('slot.jackpot-siren', (sr, r) => {
  // Rotating-beacon siren: wobbling square-ish tone + bell clang every half-second.
  const d = 2.0, xf = 0.25;
  let ph = 0;
  const x = gen(d + xf, sr, (t) => {
    const f = 820 + 260 * Math.sin(TAU * 2 * t); // exactly 4 cycles per loop → seamless
    ph += (TAU * f) / sr;
    return Math.tanh(2.2 * Math.sin(ph)) * 0.25;
  });
  bp(x, sr, 1100, 0.7);
  for (let t = 0; t < d + xf; t += 0.25) bell(x, sr, t, mtof(88), 0.3, r, 0.35);
  return x;
}, { db: -4, xf: 0.25 });

oneShot('slot.ticket-print', (sr, r) => {
  // Thermal printer: stepper chirps in bursts, feed whirr, guillotine cut.
  const x = buf(1.6, sr);
  let ph = 0;
  const motor = gen(1.2, sr, (t) => {
    ph += (TAU * (1150 + 40 * Math.sin(TAU * 5 * t))) / sr;
    const gate = Math.sin(TAU * 11 * t) > -0.2 ? 1 : 0.2;
    return Math.sign(Math.sin(ph)) * 0.08 * gate * Math.min(1, t * 30);
  });
  lp(motor, sr, 3500);
  mix(x, motor, sr, 0.05, 1);
  const feed = noise(Math.floor(1.2 * sr), r);
  bp(feed, sr, 2600, 0.7);
  mix(x, feed, sr, 0.05, 0.08);
  mix(x, burst(sr, 0.03, 3000, 1, r), sr, 1.28, 0.9); // cutter
  modal(x, sr, [[1450, 0.2, 0.05], [3300, 0.1, 0.03]], 1.28, 1, r);
  return x;
});

loopShot('slot.coin-hopper', (sr, r) => {
  // Coins pouring into a steel tray: dense coin hits on a tray resonance, motor underneath.
  const d = 2.0, xf = 0.3;
  const x = buf(d + xf, sr);
  for (let k = 0; k < 90; k++) coinHit(x, sr, r() * (d + xf), 0.2 + r() * 0.25, r, 0.7);
  const tray = noise(x.length, r);
  bp(tray, sr, 640, 6);
  mix(x, tray, sr, 0, 0.1);
  const motor = gen(d + xf, sr, (t) => 0.05 * Math.sin(TAU * 110 * t) + 0.03 * Math.sin(TAU * 220 * t));
  mix(x, motor, sr, 0, 1);
  return x;
}, { db: -5, xf: 0.3 });

oneShot('slot.ding', (sr, r) => {
  const x = buf(1.4, sr);
  bell(x, sr, 0, mtof(88), 1, r, 1);
  return x;
});

// ---------- roulette ----------

loopShot('roulette.spin', (sr, r) => {
  // Wheel turning on its spindle: low wooden rumble with a slow 1 Hz rotational swell.
  const d = 3.0, xf = 0.5;
  const x = brown(Math.floor((d + xf) * sr), r);
  lp(x, sr, 380);
  const air = pink(x.length, r);
  bp(air, sr, 900, 0.6);
  mix(x, air, sr, 0, 0.12);
  env(x, sr, (t) => 0.75 + 0.25 * Math.sin(TAU * t)); // 3 whole cycles in 3 s
  return x;
}, { db: -9, xf: 0.5 });

loopShot('roulette.ball-roll', (sr, r) => {
  // Ivorine ball circling the back track: bright rolling noise, Doppler-ish swell every lap.
  const d = 2.0, xf = 0.3;
  const x = noise(Math.floor((d + xf) * sr), r);
  bp(x, sr, (t) => 2200 + 500 * Math.sin(TAU * 1.5 * t), 1.6);
  const n2 = brown(x.length, r);
  lp(n2, sr, 500);
  mix(x, n2, sr, 0, 0.5);
  env(x, sr, (t) => 0.55 + 0.45 * Math.sin(TAU * 1.5 * t + 1) ** 2);
  return x;
}, { db: -8, xf: 0.3 });

/** Ball striking a fret/diamond. */
function ballClick(x, sr, at, g, r) {
  mix(x, burst(sr, 0.003, 6000, 1, r), sr, at, g * 0.8);
  modal(x, sr, [[3400 + r() * 800, 0.3, 0.012], [5600 + r() * 900, 0.2, 0.008], [1800, 0.1, 0.02]], at, g, r);
}

oneShot('roulette.ball-bounce', (sr, r) => {
  const x = buf(0.5, sr);
  let t = 0, g = 1;
  for (let k = 0; k < 4; k++) {
    ballClick(x, sr, t, g, r);
    t += 0.13 * Math.pow(0.65, k) + r() * 0.02;
    g *= 0.55;
  }
  return x;
});

oneShot('roulette.ball-drop', (sr, r) => {
  // Ball clattering between pockets and settling: rapid clicks with shrinking gaps.
  const x = buf(1.3, sr);
  let t = 0, gap = 0.16, g = 1;
  for (let k = 0; k < 13; k++) {
    ballClick(x, sr, t, g, r);
    t += gap;
    gap *= 0.78;
    g *= 0.82;
  }
  mix(x, burst(sr, 0.03, 600, 0.8, r, 'lp'), sr, t, 0.5); // final seat
  return x;
});

// ---------- cage & cash ----------

oneShot('cage.drawer', (sr, r) => {
  // Steel cash drawer: roller rumble out, hard stop clank, rattle of the till.
  const x = buf(0.9, sr);
  const roll = noise(Math.floor(0.35 * sr), r);
  bp(roll, sr, 900, 1.2);
  env(roll, sr, (t) => Math.min(1, t * 20) * (0.5 + 0.5 * Math.sin(TAU * 34 * t) ** 2));
  mix(x, roll, sr, 0, 0.5);
  mix(x, burst(sr, 0.04, 300, 0.8, r, 'lp'), sr, 0.35, 1.4);
  modal(x, sr, [[640, 0.25, 0.18], [1510, 0.15, 0.12], [2730, 0.1, 0.08], [3920, 0.06, 0.05]], 0.35, 1, r);
  for (let k = 0; k < 6; k++) coinHit(x, sr, 0.36 + r() * 0.12, 0.08, r, 0.4);
  return x;
});

/** One banknote flick: crisp paper snap with a body pop. */
function bill(x, sr, at, g, r) {
  snap(x, sr, at, g, r, 2200 + r() * 1800, 0.014);
  mix(x, burst(sr, 0.012, 700, 0.9, r, 'lp'), sr, at, g * 0.5);
}

oneShot('cash.count', (sr, r) => {
  // Dealer counting out bills by hand: steady flicks with a final tap of the stack.
  const x = buf(1.6, sr);
  for (let k = 0; k < 10; k++) bill(x, sr, 0.02 + k * 0.12 + r() * 0.02, 0.6 + r() * 0.4, r);
  mix(x, burst(sr, 0.04, 500, 0.8, r, 'lp'), sr, 1.35, 1.1);
  return x;
});

oneShot('cash.bill', (sr, r) => {
  const x = buf(0.3, sr);
  bill(x, sr, 0.005, 1, r);
  swish(x, sr, 0.02, 0.12, 0.2, r, 1800, 3500);
  return x;
});

// ---------- coins ----------

oneShot('coins.drop', (sr, r) => {
  // A few coins dropped on a hard counter: impacts, then the spinning-coin "wobble" ring-down.
  const x = buf(1.5, sr);
  for (let k = 0; k < 4; k++) coinHit(x, sr, k * 0.06 + r() * 0.04, 1 - k * 0.15, r);
  let t = 0.35, gap = 0.09;
  for (let k = 0; k < 12; k++) {
    coinHit(x, sr, t, 0.35 * (1 - k / 13), r, 0.3);
    t += gap;
    gap *= 0.84;
  }
  return x;
});

oneShot('coins.pour', (sr, r) => {
  const x = buf(1.8, sr);
  for (let k = 0; k < 70; k++) {
    const t = r() * 1.3;
    coinHit(x, sr, t, (0.25 + r() * 0.4) * Math.sin(Math.PI * (t / 1.3 + 0.05)), r, 0.6);
  }
  return x;
});
