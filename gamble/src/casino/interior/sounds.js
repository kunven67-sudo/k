// The casino floor's sound (DESIGN §20 "sound by space", ARCHITECTURE §5 names):
//   amb.casino bed (murmur scaled by how many people are around) · distant machine chatter
//   (positional slot dings / reel stops / small wins from the banks near you) · the casino's own
//   background music ('casino-floor', diegetic: ceiling speakers + the room reverb, a touch muffled)
//   · the fountain (its own procedural loop, defined here) · the street leaking in when a door
//   opens. The 'casino' reverb room comes from the zones (world state → audio.setRoom).
//
// The world's zone ambience (src/player/ambience.js) knows motel rooms and streets; zones marked
// `ambience: 'self'` are handed to us here (see patchZoneAmbience).
import { audio } from '../../core/audio.js';
import { loopShot, noise, pink, bp, lp, hp, env, mix, wander, TAU, gen } from '../../audio/dsp.js';
import { bubble } from '../../audio/sfx/steps.js';
import { Ambience } from '../../player/ambience.js';

// A big fountain: falling sheets (broadband hiss with flutter), splashing streams, bubbles.
loopShot('casino.fountain', (sr, r) => {
  const d = 8;
  const xf = 1;
  const T = d + xf;
  const n = Math.floor(T * sr);
  const L = pink(n, r);
  const R = pink(n, r);
  for (const [x, f] of [[L, 1100], [R, 1300]]) {
    bp(x, sr, f, 0.35);
    const fl = wander(T, sr, 14, r);
    env(x, sr, (t) => 0.6 + 0.4 * fl(t));
  }
  // Sheet roar (low) and spray hiss (high).
  const low = noise(n, r);
  lp(low, sr, 380);
  const hiss = noise(n, r);
  hp(hiss, sr, 4200);
  mix(L, low, sr, 0, 0.55);
  mix(R, low, sr, 0.004, 0.55);
  mix(L, hiss, sr, 0, 0.12);
  mix(R, hiss, sr, 0, 0.12);
  // Streams hitting water: dense bubble population.
  for (let k = 0; k < 2600; k++) {
    const t = r() * (T - 0.1);
    bubble(r() < 0.5 ? L : R, sr, t, 500 + r() * r() * 2600, 0.03 + r() * 0.07, 0.004 + r() * 0.012);
  }
  // A slow swell so the loop never sounds static.
  const sw = gen(T, sr, (t) => 0.9 + 0.1 * Math.sin((TAU * t) / T));
  env(L, sr, (t) => sw[Math.min(sw.length - 1, Math.floor(t * sr))]);
  env(R, sr, (t) => sw[Math.min(sw.length - 1, Math.floor(t * sr))]);
  return [L, R];
}, { db: -12, xf: 1, group: 'casino' });

/** Zones with ambience: 'self' are ours: the world ambience only keeps a faint street bed. */
let patched = false;
export function patchZoneAmbience() {
  if (patched || !Ambience?.prototype?._target) return;
  patched = true;
  const orig = Ambience.prototype._target;
  Ambience.prototype._target = function (zone, night) {
    if (zone?.ambience === 'self') return { 'amb.city': zone.id === 'eldorado-foyer' ? 0.1 : 0.025 };
    return orig.call(this, zone, night);
  };
}

const CHATTER = [
  ['slot.ding', 0.16, 1],
  ['slot.reel-stop', 0.12, 1],
  ['slot.win-small', 0.1, 1],
  ['slot.button', 0.08, 1],
  ['coins.drop', 0.06, 1.1],
  ['chip.stack', 0.1, 1],
  ['chip.clack', 0.08, 1],
];

export class CasinoSound {
  constructor({ banks, tables, doors }) {
    this.banks = banks;
    this.tables = tables;
    this.doors = doors;
    this.bed = null;
    this.musicOn = false;
    this.music = null;
    this.next = 1;
    this.crowd = 0;
    this.loading = false;
  }

  _music() {
    if (this.music || this.loading) return this.music;
    this.loading = true;
    import('../../audio/index.js').then((m) => (this.music = m.music || null)).catch(() => (this.music = null));
    return null;
  }

  update(dt, { inside, viewer, npcCount = 0, doorNear = 99 }) {
    if (!audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    // The bed: full inside; outside you hear it only through an open door.
    const leak = this.doors ? this.doors.openness() * Math.max(0, 1 - doorNear / 9) * 0.35 : 0;
    const want = inside > 0.5 ? 0.42 + Math.min(0.3, npcCount * 0.015) : leak;
    if (!this.bed && want > 0.01) {
      try {
        this.bed = audio.play('amb.casino', { bus: 'ambience', loop: true, gain: 0.0001 });
      } catch {
        this.bed = null;
      }
    }
    if (this.bed && Math.abs(this.crowd - want) > 0.01) {
      this.crowd = want;
      this.bed.setGain?.(want, 1.2);
    }
    // Music from the ceiling speakers.
    const music = this._music();
    const wantMusic = inside > 0.5;
    if (music && wantMusic !== this.musicOn) {
      this.musicOn = wantMusic;
      try {
        if (wantMusic) {
          music.play('casino-floor', { fade: 3, gain: 0.32 });
          music.setMuffle?.(0.18);
        } else if (music.current === 'casino-floor') {
          music.stop({ fade: 2.5 });
          music.setMuffle?.(0);
        }
      } catch {
        /* music engine absent */
      }
    }
    // Machine / table chatter around you.
    if (inside > 0.5 && viewer) {
      this.next -= dt;
      if (this.next <= 0) {
        this.next = 0.35 + Math.random() * 1.6;
        const src = this._pickSource(viewer);
        if (src) {
          const [name, g, rate] = CHATTER[Math.floor(Math.random() * (src.table ? 2 : 5)) + (src.table ? 5 : 0)];
          try {
            audio.play(name, { bus: 'sfx', gain: g * (0.6 + Math.random() * 0.6), rate: rate * (0.9 + Math.random() * 0.2), position: { x: src.p.x + (Math.random() - 0.5) * 2, y: 1.3, z: src.p.z + (Math.random() - 0.5) * 2 }, refDistance: 3, rolloff: 1.4, reverb: 0.8 });
          } catch {
            /* missing name: warns once in core */
          }
        }
      }
    }
  }

  _pickSource(v) {
    const near = [];
    for (const b of this.banks) {
      const d = b.center.distanceTo(v);
      if (d > 4 && d < 26) near.push({ p: b.center, table: false });
    }
    for (const t of this.tables) {
      const d = t.p.distanceTo(v);
      if (d > 3 && d < 22) near.push({ p: t.p, table: true });
    }
    return near.length ? near[Math.floor(Math.random() * near.length)] : null;
  }

  dispose() {
    this.bed?.stop?.(0.5);
    this.bed = null;
    if (this.musicOn && this.music?.current === 'casino-floor') this.music.stop({ fade: 1 });
  }
}
