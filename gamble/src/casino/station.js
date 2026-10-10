// Station: a seat where you play something (slot machine, blackjack seat, roulette rail, video
// poker). Shared by every casino game so sitting down, the close-up camera and standing up feel
// the same everywhere (DESIGN §9 "cinematic close-up, hands visible", §39, §53).
//
//   class SlotMachine extends Station {
//     constructor(opts) { super({ ...opts, seats: [{ pos, yaw, height: 0.7, cam: { pos, target } }] }); }
//     onSit(seat) { build this.ui }      onStand() { … }
//     canStand() { return !this.spinning; }
//     sessionUpdate(dt) { … }            onPointer(type, ray, ev) { 3D picking while seated }
//   }
//
// Everything in `seats` is in the station group's LOCAL space (the group is placed and rotated
// by whoever builds the casino floor): `pos` = where the feet go when seated (in front of the
// stool/chair), `yaw` = facing angle (0 = facing local +Z), `height` = seat height for the
// Human's 'sit' action, `cam` = the close-up camera position/target. `occupant` is null, 'npc' or
// the player.
//
// While seated: player.locked, the body sits, the camera eases into the close-up via
// player.cam.override, pointer lock is released (and the touch sticks hidden) so the mouse/finger
// works the game, and `this.ui` (a DOM layer over the canvas) holds the game's controls plus a
// standard Stand Up button. Escape also stands you up when canStand() allows it.
//
// Events: bus 'casino:sit' { station, seat }, 'casino:stand' { station, seat }.

import * as THREE from 'three';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';
import { t, i18n } from '../core/i18n.js';
import { clamp } from '../core/util.js';

i18n.register('casino', {
  en: { 'station.stand': 'Stand up', 'station.busy': 'Finish this one first.', 'station.taken': 'Someone is sitting there.' },
  es: { 'station.stand': 'Levantarse', 'station.busy': 'Termina esta primero.', 'station.taken': 'Alguien está sentado ahí.' },
});

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const ss = (x) => x * x * (3 - 2 * x);

export class Station {
  constructor({ engine, id, casino = 'eldorado', group = new THREE.Group(), seats = [], label = '' }) {
    this.engine = engine;
    this.id = id;
    this.casino = casino;
    this.group = group;
    this.group.name ||= id;
    this.label = label;
    this.seats = seats.map((s, i) => ({ height: 0.68, occupant: null, ...s, index: i }));
    this.active = false; // the player is seated here
    this.player = null;
    this.seat = null;
    this.ui = null;
    this._blend = null; // { from:{pos,target}, t, dur, dir: 1 sit / -1 stand }
    this.camGoal = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._onPtr = (ev) => this._pointer(ev);
    this.interactables = this.seats.map((seat) => ({
      id: `${id}:seat${seat.index}`,
      kind: 'seat',
      station: this,
      seat: seat.index,
      radius: seat.radius ?? 0.38,
      reach: 2.4,
      get position() {
        return seat._worldFocus;
      },
      onInteract: (pl) => this.sit(pl, seat.index),
    }));
    for (const seat of this.seats) seat._worldFocus = new THREE.Vector3();
    this.refreshWorld();
  }

  /** Call after the group is placed/rotated (and before the first frame). */
  refreshWorld() {
    this.group.updateWorldMatrix(true, false);
    for (const seat of this.seats) {
      // The thing you aim at to sit: the seat/chair top, a little above seat height.
      const f = seat.focus || new THREE.Vector3(seat.pos.x, (seat.height ?? 0.68) + 0.2, seat.pos.z);
      seat._worldFocus.copy(f).applyMatrix4(this.group.matrixWorld);
    }
  }

  /** Local → world helpers. */
  toWorld(v, out = new THREE.Vector3()) {
    return out.copy(v).applyMatrix4(this.group.matrixWorld);
  }

  worldYaw(localYaw) {
    // Facing direction (sin, 0, cos) of localYaw, rotated into world space.
    this.group.getWorldQuaternion(_q);
    _v.set(Math.sin(localYaw), 0, Math.cos(localYaw)).applyQuaternion(_q);
    return Math.atan2(_v.x, _v.z);
  }

  // ---- seating -----------------------------------------------------------------------------------

  sit(player, index = 0) {
    const seat = this.seats[index];
    if (!seat || this.active || player.locked) return false;
    if (seat.occupant && seat.occupant !== player) {
      bus.emit('casino:seat-taken', { station: this, seat: index });
      return false;
    }
    this.player = player;
    this.seat = seat;
    seat.occupant = player;
    this.active = true;
    player.locked = true;
    player.seatedAt = this;

    // Feet spot + facing. Player.place takes the view yaw (looking along (-sin, -cos)).
    const p = this.toWorld(seat.pos);
    const face = this.worldYaw(seat.yaw ?? 0);
    player.place(p, face + Math.PI);
    player.human.play('sit', { height: seat.height });

    // Close-up camera: blend from wherever the shoulder camera is now.
    const cam = player.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const from = { pos: cam.position.clone(), target: cam.position.clone().addScaledVector(fwd, 3) };
    this.setCamGoal(seat.cam.pos, seat.cam.target, true);
    player.cam.override = { position: from.pos.clone(), target: from.target.clone(), weight: 1 };
    this._blend = { from, t: 0, dur: 1.25, dir: 1 };

    this._prevLock = input.wantPointerLock;
    input.setPointerLock(false);
    const canvas = this.engine.renderer.domElement;
    canvas.addEventListener('pointerdown', this._onPtr);
    canvas.addEventListener('pointermove', this._onPtr);
    window.addEventListener('pointerup', this._onPtr);

    this._mountUI();
    this.onSit(seat);
    bus.emit('casino:sit', { station: this, seat: index });
    return true;
  }

  /** Change the close-up (e.g. look at the roulette wheel while the ball runs). Local space. */
  setCamGoal(pos, target, snap = false) {
    this.toWorld(pos, this._goalPos ||= new THREE.Vector3());
    this.toWorld(target, this._goalTarget ||= new THREE.Vector3());
    if (snap) {
      this.camGoal.pos.copy(this._goalPos);
      this.camGoal.target.copy(this._goalTarget);
    }
  }

  stand(force = false) {
    if (!this.active) return false;
    if (!force && !this.canStand()) {
      this.toast?.(t('casino.station.busy'));
      return false;
    }
    const pl = this.player;
    this.onStand(this.seat);
    pl.human.play('stand', { height: this.seat.height });
    const o = pl.cam.override;
    this._blend = { from: { pos: o.position.clone(), target: o.target.clone() }, t: 0, dur: 1.4, dir: -1 };
    this._unmountUI();
    const canvas = this.engine.renderer.domElement;
    canvas.removeEventListener('pointerdown', this._onPtr);
    canvas.removeEventListener('pointermove', this._onPtr);
    window.removeEventListener('pointerup', this._onPtr);
    bus.emit('casino:stand', { station: this, seat: this.seat.index });
    this.active = false;
    return true;
  }

  _finishStand() {
    const pl = this.player;
    if (!pl) return;
    pl.cam.override = null;
    pl.cam.syncFromCamera?.();
    pl.locked = false;
    pl.seatedAt = null;
    if (this.seat) this.seat.occupant = null;
    input.setPointerLock(this._prevLock ?? true);
    this.player = null;
    this.seat = null;
  }

  // ---- per frame ---------------------------------------------------------------------------------

  update(dt, ctx = {}) {
    if (this._blend) this._updateBlend(dt);
    if (this.active) {
      if (input.pressed('menu')) this.stand();
      // Ease toward the (possibly moving) goal so camera changes never cut.
      const k = 1 - Math.exp(-dt * 4);
      this.camGoal.pos.lerp(this._goalPos, k);
      this.camGoal.target.lerp(this._goalTarget, k);
      if (!this._blend) {
        const o = this.player.cam.override;
        o.position.copy(this.camGoal.pos);
        o.target.copy(this.camGoal.target);
      }
      this.sessionUpdate(dt, ctx);
    }
    this.idleUpdate(dt, ctx);
  }

  _updateBlend(dt) {
    const b = this._blend;
    const pl = this.player;
    if (!pl) {
      this._blend = null;
      return;
    }
    b.t += dt / b.dur;
    const k = ss(clamp(b.t, 0, 1));
    const o = pl.cam.override;
    if (b.dir > 0) {
      o.position.copy(b.from.pos).lerp(this.camGoal.pos, k);
      o.target.copy(b.from.target).lerp(this.camGoal.target, k);
      o.weight = 1;
    } else {
      // Standing: hold the close-up framing and fade the override out so the shoulder camera
      // takes over smoothly from wherever it is.
      o.position.copy(b.from.pos);
      o.target.copy(b.from.target);
      o.weight = 1 - k;
    }
    if (b.t >= 1) {
      this._blend = null;
      if (b.dir < 0) this._finishStand();
    }
  }

  // ---- pointer picking while seated ---------------------------------------------------------------

  _pointer(ev) {
    if (!this.active || this._blend) return;
    if (ev.type !== 'pointerup' && ev.target !== this.engine.renderer.domElement) return;
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    this._ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(this._ndc, this.player.camera);
    const type = ev.type === 'pointerdown' ? 'down' : ev.type === 'pointermove' ? 'move' : 'up';
    this.onPointer(type, this._raycaster, ev);
  }

  // ---- UI layer ----------------------------------------------------------------------------------

  _mountUI() {
    const root = this.engine.uiRoot || document.getElementById('ui-root');
    const ui = document.createElement('div');
    ui.className = 'casino-ui';
    ui.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    const stand = document.createElement('button');
    stand.className = 'casino-stand';
    stand.textContent = t('casino.station.stand');
    stand.style.cssText = 'position:absolute;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));pointer-events:auto;';
    stand.addEventListener('click', () => this.stand());
    ui.append(stand);
    root.append(ui);
    this.ui = ui;
    this.standButton = stand;
  }

  _unmountUI() {
    this.ui?.remove();
    this.ui = null;
  }

  // ---- hooks for subclasses ----------------------------------------------------------------------

  /** Seated; build the game's controls into this.ui. */
  onSit(_seat) {}
  /** About to stand (cash out credits, colour up, …). */
  onStand(_seat) {}
  /** False while a spin/hand is in progress. */
  canStand() {
    return true;
  }
  /** Every frame while the player is seated here. */
  sessionUpdate(_dt, _ctx) {}
  /** Every frame regardless (attract lights, NPC play, idle reels). */
  idleUpdate(_dt, _ctx) {}
  /** 'down' | 'move' | 'up' with a Raycaster from the close-up camera. */
  onPointer(_type, _raycaster, _ev) {}

  dispose() {
    if (this.active) this.stand(true);
    if (this._blend) this._finishStand();
    this._unmountUI();
    this.group.removeFromParent();
  }
}
