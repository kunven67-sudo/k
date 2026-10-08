// The first morning (DESIGN §34): you come to on the motel carpet at 11:00 AM, hungover.
//
// Timeline (seconds):
//   0      POV from the floor, looking up past the bed at the ceiling / door; heavy blur, sway,
//          muffled ears. The body is hidden (we are inside its head).
//   ~4     BANG BANG on the door; the view flinches toward it.
//   ~5     The clerk shouts through the door (speech synthesis, en/es).
//   ~9     (or earlier on E / Space / click after the bang) the body gets up: 'get-up-floor',
//          the camera rises out of the head into the shoulder view.
//   ~12    control returns; the blur keeps easing out until ~20 s, the hangover lingers.
import * as THREE from 'three';
import { input } from '../core/input.js';
import { t } from '../core/i18n.js';
import { clamp, smoothstep, lerp } from '../core/util.js';
import { sfx, muffle } from './sound.js';
import { say } from './voice.js';
import './strings.js';

export class Opening {
  constructor({ engine, player, spawn, doorPos, roomNumber }) {
    this.engine = engine;
    this.player = player;
    this.spawn = spawn;
    this.doorPos = doorPos.clone();
    this.room = roomNumber;
    this.t = 0;
    this.phase = 'floor';
    this.done = false;
    this.banged = false;
    this.spoke = false;
    this.getUpAt = 9.5;
    this.flinch = 0;
    // Head on the carpet, a little toward the bed, eyes to the door / ceiling.
    const s = spawn;
    this.eye = new THREE.Vector3(s.x - 0.25, s.y + 0.2, s.z - 0.35);
    this.lookBase = new THREE.Vector3(s.x + 0.3, s.y + 2.1, s.z + 2.0);
    this.target = new THREE.Vector3();
    player.locked = true;
    player.hangover = 1;
    player.hideBody = true;
    player.cam.override = { position: this.eye.clone(), target: this.lookBase.clone(), weight: 1, roll: 0.42 };
    engine.effects.uBlur.value = 0.95;
    engine.effects.uVignette.value = 0.55;
    muffle(0.85);
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const T = this.t;
    const pl = this.player;
    const fx = this.engine.effects;
    const o = pl.cam.override;

    // Blur breathes (focus pulls in and out) while easing down over ~20 s.
    const base = lerp(0.95, 0, smoothstep(0, 20, T));
    fx.uBlur.value = clamp(base * (0.85 + 0.15 * Math.sin(T * 1.7)), 0, 1);
    fx.uVignette.value = lerp(0.55, 0.2, smoothstep(2, 22, T));
    muffle(lerp(0.85, 0, smoothstep(3.2, 14, T)));

    // The door.
    if (!this.banged && T > 4) {
      this.banged = true;
      const pos = { x: this.doorPos.x, y: this.doorPos.y, z: this.doorPos.z };
      sfx('door.bang', { bus: 'sfx', position: pos, refDistance: 2, gain: 1.2 });
      setTimeout(() => sfx('door.bang', { bus: 'sfx', position: pos, refDistance: 2, gain: 1.35, rate: 0.96 }), 430);
      this.flinch = 1;
    }
    if (!this.spoke && T > 5.1) {
      this.spoke = true;
      say(t('player.clerkBang', { n: this.room }), { pitch: 0.72, rate: 1.06, volume: 1 }).done.then(() => {
        this.getUpAt = Math.min(this.getUpAt, this.t + 0.9);
      });
    }
    this.flinch = Math.max(0, this.flinch - dt * 0.6);

    if (this.phase === 'floor') {
      // Slow drunken drift of the gaze; the flinch snaps it toward the door.
      this.target.copy(this.lookBase);
      this.target.x += Math.sin(T * 0.37) * 0.35;
      this.target.y += Math.sin(T * 0.23) * 0.25 - this.flinch * 1.4;
      this.target.z += this.flinch * 0.6;
      o.position.copy(this.eye);
      o.position.y += Math.sin(T * 0.5) * 0.01;
      o.target.copy(this.target);
      o.roll = 0.42 - this.flinch * 0.18 + Math.sin(T * 0.31) * 0.04;
      const skip = this.banged && T > 5.5 && (input.pressed('interact') || input.pressed('jump') || input.pointer.dragging);
      if (T > this.getUpAt || skip) this._getUp();
    } else if (this.phase === 'rise') {
      const u = clamp((T - this.riseT) / 3.4, 0, 1);
      // Head rush: the blur swells while the camera leaves the head for the shoulder view; the
      // body appears only once the lens is clear of it.
      o.weight = 1 - smoothstep(0, 0.45, u);
      if (u > 0.3) pl.hideBody = false;
      fx.uBlur.value = Math.max(fx.uBlur.value, 0.7 * Math.sin(Math.PI * clamp(u / 0.5, 0, 1)));
      o.roll = lerp(0.3, 0, u);
      o.target.lerp(pl.head(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 1.5)), 0.05);
      if (u >= 1) this._finish();
    }
  }

  _getUp() {
    const pl = this.player;
    this.phase = 'rise';
    this.riseT = this.t;
    pl.cam.yaw = this.spawn.yaw; // shoulder view behind the body, toward the door
    pl.cam.pitch = -0.1;
    pl.cam.inited = false;
    pl.human.setExpression?.('hungover', 1);
    pl.human.play('get-up-floor', { speed: 0.9 });
  }

  _finish() {
    const pl = this.player;
    pl.cam.override = null;
    pl.locked = false;
    this.done = true;
    // The hangover lingers for a few game-minutes (it slows and sways; the life module may own it later).
    const fade = () => {
      pl.hangover = Math.max(0.35, pl.hangover - 0.02);
      if (pl.hangover > 0.35) setTimeout(fade, 1000);
    };
    setTimeout(fade, 1000);
    // Blur continues to ease out from update() of the world state.
  }

  /** The blur tail after control returns. */
  tail(dt) {
    if (!this.done) return;
    this.t += dt;
    const fx = this.engine.effects;
    const T = this.t;
    fx.uBlur.value = clamp(lerp(0.95, 0, smoothstep(0, 20, T)), 0, 1);
    fx.uVignette.value = lerp(0.55, 0.2, smoothstep(2, 22, T));
    muffle(lerp(0.85, 0, smoothstep(3.2, 14, T)));
  }
}
