// The mystery watch. HOLD F = shrink, HOLD G = grow. The longer you hold, the faster it goes.
// Effects: watch glows + beeps, sparks zap around you, the camera shakes, whoosh sound - and the
// world grows (or shrinks) around you. The battery lasts about a day of normal use.
import * as THREE from 'three';
import { input } from '../core/input.js';
import { sfx, loop } from '../core/audio.js';
import { BASE_H } from './player.js';

export const MIN_S = 0.0004 / BASE_H;   // ~0.4 mm (germ world comes next: see micro.js)
export const MAX_S = 40;

// Real things to compare your height to
const COMPARE = [
  [70, 'a 20-story building'], [30, 'a 10-story building'], [18, 'a blue whale is long'], [11, 'a 3-story house'],
  [5.6, 'a giraffe'], [3.2, 'an elephant'], [2.3, 'a basketball hoop'], [1.5, 'a person'], [0.95, 'a kitchen counter'],
  [0.6, 'a big dog'], [0.42, 'a cat'], [0.25, 'a soda bottle'], [0.15, 'a can of soda'], [0.09, 'a mouse'],
  [0.05, 'a hamster\'s height'], [0.025, 'a paper clip'], [0.012, 'a fingernail'], [0.006, 'a big ant'],
  [0.003, 'an ant'], [0.0015, 'a flea'], [0.0007, 'a grain of sand'], [0.0003, 'a dust mite'],
  [0.0001, 'a human hair is wide'], [0.00003, 'a skin flake'], [0.00001, 'a white blood cell'],
  [0.000004, 'a red blood cell'], [0.0000015, 'a bacterium'], [0.0000002, 'a big virus'], [0.00000002, 'a small virus'],
];

export function formatSize(m) {
  if (m >= 1) return m.toFixed(m < 10 ? 2 : 1) + ' m';
  if (m >= 0.01) return (m * 100).toFixed(m < 0.1 ? 1 : 0) + ' cm';
  if (m >= 0.001) return (m * 1000).toFixed(1) + ' mm';
  if (m >= 1e-6) return (m * 1e6).toFixed(m < 1e-5 ? 1 : 0) + ' µm';
  return (m * 1e9).toFixed(0) + ' nm';
}
export function compareSize(m) {
  let best = COMPARE[COMPARE.length - 1];
  for (const c of COMPARE) { if (Math.abs(Math.log(m / c[0])) < Math.abs(Math.log(m / best[0]))) best = c; }
  const r = m / best[0];
  const word = r > 1.3 ? 'taller than' : r < 0.77 ? 'smaller than' : 'about as tall as';
  return `${word} ${best[1]}`;
}

export class Watch {
  constructor(game) {
    this.game = game;
    this.hold = 0;
    this.mode = 0;      // -1 shrinking, +1 growing
    this.battery = 1;
    this.blockT = 0;
    this.light = new THREE.PointLight(0x9ff4ff, 0, 1, 1.5);
    this.lightOn = false;
    game.engine.scene.add(this.light);
    // sparks
    const n = 140, g = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(n * 3); this.sparkVel = new Float32Array(n * 3); this.sparkLife = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparks = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8ff6ff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sparks.frustumCulled = false;
    game.engine.scene.add(this.sparks);
    this.hum = null;
  }

  update(dt) {
    const g = this.game, p = g.player;
    const want = input.held('shrink') ? -1 : input.held('grow') ? 1 : 0;
    if (want !== this.mode) {
      if (want) { sfx.beep(want < 0 ? 1500 : 900, 0.07, 0.2); sfx.zap(0.25); g.ui.flash(0.25); sfx.whoosh(want > 0, 0.3, 0.9); }
      this.mode = want; this.hold = 0;
    }
    if (this.confiscated && want) { if (!this._confTip || g.time > this._confTip) { this._confTip = g.time + 5; g.ui.toast('⌚ No watch! Your parents took it. It\'s in their dresser...'); } this.mode = 0; }
    else if (this.battery <= 0 && want) { if (!this._battTip) { this._battTip = 1; g.ui.toast('🔋 Watch battery is dead. Charge it (sleep in bed or wait).'); } this.mode = 0; }
    let changing = false;
    if (this.mode && this.battery > 0) {
      this.hold += dt;
      const rate = Math.min(2.4, 0.45 + this.hold * 0.55); // e-folds per second
      let ns = p.s * Math.exp(this.mode * rate * dt);
      const lim = g.sizeLimits();
      ns = Math.max(lim.min, Math.min(lim.max, ns));
      if (this.mode > 0 && ns > p.s) {
        // growing needs room. Push light stuff away, but walls/ceiling stop you (for now)
        if (!p.fits(ns)) {
          // try to stand up straight in the space first (slide up if feet are clear)
          this.blockT += dt;
          ns = p.s;
          if (this.blockT > 0.6 && !this._blockTip) { this._blockTip = 1; g.ui.toast('🧱 No room to grow here! Find open space.'); }
          g.onGrowBlocked?.(p, this.blockT);
        } else this.blockT = 0;
      }
      if (ns === lim.min && this.mode < 0) { this.minHold = (this.minHold || 0) + dt; g.onMinHold?.(this.minHold); if (lim.msg && !this['_tip' + lim.msg.length]) { this['_tip' + lim.msg.length] = 1; g.ui.toast(lim.msg); } } else this.minHold = 0;
      if (ns !== p.s) {
        const ratio = ns / p.s;
        p.setScale(ns);
        p.vel.multiplyScalar(ratio);
        changing = true;
        this.lastChange = g.time;
        this.battery = Math.max(0, this.battery - Math.abs(Math.log(ratio)) * 0.0045);
      }
    } else this.blockT = 0;
    this.changing = changing;
    p.shake = Math.max(p.shake, changing ? 0.35 + Math.min(0.45, this.hold * 0.15) : 0);
    // charge slowly while idle at night is handled by the bed; tiny trickle here so it never soft-locks
    this.battery = Math.min(1, this.battery + dt * 0.00002);

    // hum while changing
    if (!this.hum) this.hum = loop('charge');
    this.hum.set(changing ? 0.06 : 0, this.mode > 0 ? 0.7 + this.hold * 0.2 : 1.4 + this.hold * 0.3);

    // sparks around your body
    const n = this.sparkLife.length, s = p.s, c = p.center(new THREE.Vector3());
    this.sparks.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      if (this.sparkLife[i] <= 0 && changing && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2, h = Math.random();
        this.sparkPos[i * 3] = c.x + Math.cos(a) * 0.3 * s; this.sparkPos[i * 3 + 1] = p.feet.y + h * p.height; this.sparkPos[i * 3 + 2] = c.z + Math.sin(a) * 0.3 * s;
        this.sparkVel[i * 3] = Math.cos(a) * 0.3 * s; this.sparkVel[i * 3 + 1] = (Math.random() - 0.3) * 0.8 * s; this.sparkVel[i * 3 + 2] = Math.sin(a) * 0.3 * s;
        this.sparkLife[i] = 0.2 + Math.random() * 0.4;
      }
      if (this.sparkLife[i] > 0) {
        this.sparkLife[i] -= dt;
        for (let k = 0; k < 3; k++) this.sparkPos[i * 3 + k] += this.sparkVel[i * 3 + k] * dt;
        if (this.sparkLife[i] <= 0) this.sparkPos[i * 3 + 1] = -1e5;
      }
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.material.color.set(this.mode > 0 ? 0xffc46b : 0x8ff6ff);

    // watch flashlight (L) - lights up the inside of things
    if (input.pressed('light')) { this.lightOn = !this.lightOn; sfx.click(0.4); }
    const glow = changing ? 0.6 : 0;
    this.light.intensity = (this.lightOn ? 1.6 : 0) + glow;
    this.light.distance = 6 * s;
    this.light.decay = 1.5;
    this.light.position.copy(p.head(new THREE.Vector3())).add(new THREE.Vector3(0, -0.25 * s, 0));
    // light intensity must scale with size (a tiny light for a tiny you): physically-correct lights fall off with distance^decay
    this.light.intensity *= Math.pow(s, 1.5) * 1.2;
  }
}
