// Sleeping (basic): sit on the edge of the bed, curl up on your side, and the day time-lapses
// through the curtain gap until 8 AM (or until you press E / Space / click).
//
// The curl is the Human's own 'seated' hold tipped 90° onto its side around the hips (hips bent,
// knees bent → a natural fetal sleeping pose), done on the player's parent group so the
// animation layer is untouched. Emits bus 'player:slept' { hours }.
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';
import { clock, zonedToUtc } from '../core/clock.js';
import { clamp, lerp, smoothstep } from '../core/util.js';

const TIMELAPSE = 420; // × TIME_SCALE: ~3.5 game hours per real second at full speed

export class Sleep {
  constructor({ engine, player, bed, camPos, camTarget, interactables = [] }) {
    this.interactables = interactables;
    this.engine = engine;
    this.player = player;
    this.bed = bed; // { sit: {x,y,z}, lie: {x,y,z} hips target, yaw }
    this.camPos = camPos;
    this.camTarget = camTarget;
    this.active = false;
  }

  begin() {
    if (this.active) return;
    const pl = this.player;
    this.active = true;
    this.t = 0;
    this.phase = 'sit';
    this.startMs = clock.gameMs;
    // Wake at the next 8:00 AM.
    const p = clock.local;
    let wake = zonedToUtc(p.year, p.month, p.day, 8, 0);
    if (wake <= clock.gameMs + 3600e3) wake = zonedToUtc(p.year, p.month, p.day + 1, 8, 0);
    this.wakeMs = wake;
    pl.locked = true;
    // Lights out (the TV may stay on — falling asleep to it is the motel way).
    setTimeout(() => {
      for (const id of ['room-light-switch', 'lamp', 'bath-light-switch', 'closet-light']) {
        const it = this.interactables.find((i) => i.id === id);
        if (it?.on) it.toggle(false);
      }
    }, 1600);
    pl.place(this.bed.sit, this.bed.yaw);
    pl.human.play('sit');
    pl.cam.override = { position: pl.camera.position.clone(), target: this.camTarget.clone(), weight: 0 };
    this.root = pl.root;
    this.root.matrixAutoUpdate = false;
    this.hips0 = null;
  }

  _wakeUp() {
    if (this.phase === 'wake' || this.phase === 'stand') return;
    this.phase = 'wake';
    this.wakeT = this.t;
    clock.speed = 1;
    const hours = (clock.gameMs - this.startMs) / 3600e3;
    bus.emit('player:slept', { hours });
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const pl = this.player;
    const o = pl.cam.override;
    o.weight = Math.min(1, o.weight + dt / 1.2);
    o.position.lerp(this.camPos, Math.min(1, dt * 1.5));
    o.target.lerp(this.camTarget, Math.min(1, dt * 2));
    let curl = 0;
    if (this.phase === 'sit') {
      if (this.t > 2.0) {
        this.phase = 'lie';
        this.lieT = this.t;
        this.hips0 = pl.human.bones?.hips?.getWorldPosition(new THREE.Vector3()) || pl.position.clone().setY(pl.position.y + 0.5);
      }
    } else if (this.phase === 'lie') {
      curl = smoothstep(0, 1.8, this.t - this.lieT);
      if (curl >= 1 && this.t - this.lieT > 2.4) this.phase = 'lapse';
    } else if (this.phase === 'lapse') {
      curl = 1;
      // Ease the clock up to speed, back down near the wake time.
      const left = (this.wakeMs - clock.gameMs) / 3600e3;
      const ramp = smoothstep(0, 1.5, this.t - this.lieT - 2.4) * smoothstep(0, 0.6, left);
      clock.speed = Math.max(1, TIMELAPSE * ramp);
      if (left <= 0.01 || (this.t - this.lieT > 3.4 && (input.pressed('interact') || input.pressed('jump')))) this._wakeUp();
    } else if (this.phase === 'wake') {
      curl = 1 - smoothstep(0, 1.6, this.t - this.wakeT);
      if (curl <= 0) {
        this.phase = 'stand';
        pl.human.play('stand');
        this.standT = this.t;
      }
    } else if (this.phase === 'stand') {
      o.weight = 1 - smoothstep(0, 1.6, this.t - this.standT);
      if (this.t - this.standT > 1.8) this._end();
    }
    this._applyCurl(curl);
  }

  // Tip the whole body onto its side around the hips and settle the hips into the bed.
  _applyCurl(k) {
    const root = this.root;
    if (!this.hips0 || k <= 0) {
      root.matrix.identity();
      return;
    }
    const pl = this.player;
    const fwd = pl.facing(new THREE.Vector3());
    const q = new THREE.Quaternion().setFromAxisAngle(fwd, (Math.PI / 2) * 0.97 * k);
    const dst = this.hips0.clone().lerp(new THREE.Vector3(this.bed.lie.x, this.bed.lie.y, this.bed.lie.z), k);
    const m = new THREE.Matrix4().makeTranslation(dst.x, dst.y, dst.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
      .multiply(new THREE.Matrix4().makeTranslation(-this.hips0.x, -this.hips0.y, -this.hips0.z));
    root.matrix.copy(m);
    root.matrixWorldNeedsUpdate = true;
  }

  _end() {
    const pl = this.player;
    this.active = false;
    this.root.matrix.identity();
    this.root.matrixAutoUpdate = true;
    pl.cam.override = null;
    pl.cam.syncFromCamera();
    pl.locked = false;
    clock.speed = 1;
  }

  get busy() {
    return this.active;
  }

  dispose() {
    if (this.active) {
      clock.speed = 1;
      this.root.matrixAutoUpdate = true;
    }
  }
}

export { clamp, lerp };
