// TableBase: what blackjack and roulette share on top of the casino Station — instanced cards and
// chips, the dealer (with hourly relief and a personality), NPC players, speech bubbles, the
// tween clock that drives all choreography, distance-based sleeping, colliders, and the seated
// player's hands. Subclasses build the furniture and run the game loop.

import * as THREE from 'three';
import { Station } from '../station.js';
import { bus } from '../../core/events.js';
import { Rng } from '../../core/rng.js';
import { Tweens, ease, arc } from './kit/tween.js';
import { CardMeshes } from './kit/cards.js';
import { ChipMeshes, Pile, kindOf } from './kit/chips3d.js';
import { TableHands, ORIENT } from './kit/hands.js';
import { Bubbles, makeDealer, makeNpc, voiceOf } from './kit/people.js';
import { TableUI } from './kit/ui.js';
import { sfx } from './kit/sfx.js';
import { line } from './strings.js';
import { breakdown } from '../chips.js';
import './strings.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export function tierNameOf(tier, engine) {
  if (typeof tier === 'string') return tier;
  return tier?.name || engine?.tier?.name || 'high';
}

export class TableBase extends Station {
  constructor(o, { group, seats, label, game, feltY = 0.76 }) {
    super({ engine: o.engine, id: o.id, casino: o.casino || 'eldorado', group, seats, label });
    this.game = game;
    this.physics = o.physics;
    this.tier = o.tier || o.engine?.tier;
    this.tierName = tierNameOf(o.tier, o.engine);
    this.low = this.tierName === 'low';
    this.rng = o.rng instanceof Rng ? o.rng : new Rng(`${o.id}-${typeof o.rng === 'number' ? o.rng : 7}`);
    this.feltY = feltY;
    this.tw = new Tweens();
    this.bubbles = new Bubbles(o.engine);
    this.cards = new CardMeshes({ capacity: game === 'blackjack' ? 72 : 4 });
    this.chipSet = new ChipMeshes({ capacity: game === 'blackjack' ? 520 : 760, seg: this.low ? 16 : 26 });
    group.add(this.cards.mesh, this.chipSet.mesh);
    this.npcs = [];
    this.near = false;
    this.camDist = 999;
    this.colliders = [];
    this.chairColliders = [];
    this.disabledChair = null;
    this.devSpeed = 1;
    this.pitBoss = null; // lane A may hand us its pit boss Human for the bubble anchor
    this._relief = null;
    this._lastRelief = performance.now();
    this._offs = [
      bus.on('clock:hour', () => {
        if (!this.low && performance.now() - this._lastRelief > 6 * 60 * 1000) this._wantRelief = true;
      }),
    ];
    this.footprint = { w: 3, d: 2.4 };
  }

  // ---- space helpers -------------------------------------------------------------------------

  /** Local point → new world Vector3. */
  W(x, y, z) {
    if (x.isVector3) return this.group.localToWorld(x.clone());
    return this.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  /** World → local (new vector). */
  L(v) {
    return this.group.worldToLocal(v.clone());
  }

  sfx(name, local, opts) {
    return sfx(name, local ? this.W(local) : null, opts);
  }

  // ---- dealer ----------------------------------------------------------------------------------

  createDealer(pos, restL, restR, lookAt) {
    const d = makeDealer(this.rng, this.tier);
    d.human.root.position.copy(pos);
    d.human.root.rotation.y = 0;
    this.group.add(d.human.root);
    d.hands = new TableHands(d.human, { tweens: this.tw, seated: false });
    d.restL = restL;
    d.restR = restR;
    d.voice = voiceOf(d.params);
    d.human.update(0.016);
    this.dealer = d;
    this._dealerLook = lookAt;
    this._restDealerHands();
    this.tw.scale = d.type.speed * this.devSpeed;
    return d;
  }

  _restDealerHands() {
    const d = this.dealer;
    if (!d) return;
    this.group.updateWorldMatrix(true, false);
    d.hands.rest('L', this.W(d.restL), ORIENT.palmDownIn);
    d.hands.rest('R', this.W(d.restR), ORIENT.palmDownIn);
  }

  /** Dealer line (bubble + voice). chance < 1 lets personality skip chatter. */
  dsay(key, vars, { chance = 1 } = {}) {
    const d = this.dealer;
    if (!d) return;
    if (chance < 1 && this.rng.next() > chance * (0.4 + d.type.chat)) return;
    const head = d.human.bones.head;
    this.bubbles.say(() => head.getWorldPosition(_v2).add(_v.set(0, 0.24, 0)).clone(), line(key, vars), { who: d.name, voice: d.voice });
  }

  pitSay(key, vars) {
    const anchor = this.pitBoss
      ? () => this.pitBoss.bones.head.getWorldPosition(_v2).add(_v.set(0, 0.25, 0)).clone()
      : (() => {
          const p = this.W(this.pitAnchor || new THREE.Vector3(0.9, 1.75, -1.7));
          return () => p;
        })();
    this.bubbles.say(anchor, line(key, vars), { who: 'Pit', kind: 'pit', voice: { pitch: 0.8, rate: 0.95, male: true } });
  }

  npcSay(npc, key, vars) {
    const head = npc.human.bones.head;
    this.bubbles.say(() => head.getWorldPosition(_v2).add(_v.set(0, 0.24, 0)).clone(), line(key, vars), { voice: voiceOf(npc.params) });
  }

  /** Hourly relief: the next dealer walks in, the current one claps out and leaves. */
  async _doRelief() {
    this._wantRelief = false;
    this._lastRelief = performance.now();
    const old = this.dealer;
    if (!old) return;
    let next = this._offDuty;
    if (!next) {
      next = makeDealer(this.rng, this.tier);
      next.voice = voiceOf(next.params);
    }
    this._offDuty = null;
    const home = old.human.root.position.clone();
    const side = new THREE.Vector3(1.4, 0, home.z - 0.9);
    next.human.root.position.copy(side);
    next.human.root.rotation.y = -Math.PI / 2;
    this.group.add(next.human.root);
    // The outgoing dealer "clears" their hands (palms shown to the camera) before stepping away.
    old.hands.rest('L', null);
    old.hands.rest('R', null);
    old.human.play('shrug', { speed: 1.2 });
    await this.tw.wait(0.8);
    await this._walk(old.human, [home.clone().add(new THREE.Vector3(-0.2, 0, -0.5)), new THREE.Vector3(-1.5, 0, home.z - 0.9)], 1.1);
    old.human.root.removeFromParent();
    old.hands.dispose();
    this._offDuty = old;
    await this._walk(next.human, [new THREE.Vector3(0.4, 0, home.z - 0.45), home], 1.1);
    next.human.root.rotation.y = 0;
    next.hands = new TableHands(next.human, { tweens: this.tw, seated: false });
    next.restL = old.restL;
    next.restR = old.restR;
    this.dealer = next;
    this._restDealerHands();
    this.tw.scale = next.type.speed * this.devSpeed;
    this.dsay('d.relief');
  }

  async _walk(human, pts, speed = 1.1) {
    const root = human.root;
    (this._walking ||= new Set()).add(human);
    for (const p of pts) {
      const from = root.position.clone();
      const d = from.distanceTo(p);
      if (d < 0.01) continue;
      root.rotation.y = Math.atan2(p.x - from.x, p.z - from.z);
      human.setLocomotion({ speed, grounded: true });
      await this.tw.to(d / speed, (k) => root.position.lerpVectors(from, p, k), ease.linear);
    }
    human.setLocomotion({ speed: 0, grounded: true });
    await this.tw.wait(0.3);
    this._walking.delete(human);
  }

  // ---- NPC players -----------------------------------------------------------------------------

  /** Seat a new NPC at seat index i (built, sat down instantly, hands on the rail). */
  seatNpc(i, { min = 5 } = {}) {
    const seat = this.seats[i];
    if (!seat || seat.occupant) return null;
    const npc = makeNpc(this.rng, this.tier, { min });
    npc.seat = i;
    npc.human.root.position.copy(seat.pos);
    npc.human.root.rotation.y = seat.yaw;
    this.group.add(npc.human.root);
    npc.human.play('sit', { height: seat.height });
    for (let k = 0; k < 70; k++) npc.human.update(1 / 30);
    npc.hands = new TableHands(npc.human, { tweens: this.tw, seated: true, seatHeight: seat.height });
    seat.occupant = 'npc';
    this.npcs.push(npc);
    this.group.updateWorldMatrix(true, false);
    this.restNpcHands(npc);
    this.chairColliders[i]?.setEnabled?.(false);
    return npc;
  }

  /** Hands resting on the rail in front of the seat (override per table). */
  restNpcHands(npc) {
    void npc;
  }

  async npcLeave(npc) {
    const seat = this.seats[npc.seat];
    this.npcSay(npc, 'n.broke');
    npc.hands.rest('L', null);
    npc.hands.rest('R', null);
    npc.hands.enabled = false;
    npc.human.play('stand', { height: seat.height });
    await this.tw.wait(1.8);
    npc.hands.dispose();
    const out = seat.pos.clone().add(new THREE.Vector3(Math.sin(seat.yaw + Math.PI) * 1.2, 0, Math.cos(seat.yaw + Math.PI) * 1.2));
    const away = out.clone().add(new THREE.Vector3(out.x > 0 ? 2.5 : -2.5, 0, 1.5));
    await this._walk(npc.human, [out, away], 1.2);
    npc.human.dispose();
    seat.occupant = null;
    this.chairColliders[npc.seat]?.setEnabled?.(true);
    this.npcs = this.npcs.filter((n) => n !== npc);
  }

  // ---- chips helpers ---------------------------------------------------------------------------

  /** New pile at a local position holding `counts` ({ 25: 2, 5: 1 }), big chips at the bottom. */
  pileOf(counts, x, z, { tint = null, neat = 1 } = {}) {
    const p = new Pile(this.chipSet, x, z, this.feltY, { tint, neat });
    const vals = Object.keys(counts).map(Number).sort((a, b) => b - a);
    for (const v of vals) for (let i = 0; i < counts[v]; i++) p.push(kindOf(v));
    return p;
  }

  pileOfAmount(amount, x, z, style = 'pay') {
    return this.pileOf(breakdown(amount, style).counts, x, z);
  }

  /** Slide a pile to a new local spot (with an optional lift), chips clacking at the end. */
  async movePile(pile, x, z, dur = 0.4, { lift = 0.0, sound = 'chip.slide' } = {}) {
    const from = pile.base.clone();
    const to = new THREE.Vector3(x, pile.base.y, z);
    if (sound) this.sfx(sound, from, { gain: 0.7 });
    await this.tw.to(dur, (k) => {
      arc(pile.base, from, to, k, lift);
      pile.relayout();
    }, ease.inOut);
  }

  /** Drop one chip (kind) from a local point onto `pile` with a little bounce. */
  async dropChip(pile, kind, from, dur = 0.22) {
    const c = this.chipSet.spawn(kind, from, Math.random() * Math.PI * 2, pile.tint);
    if (!c) return;
    const to = pile.slot();
    const a = from.clone();
    await this.tw.to(dur, (k) => {
      arc(c.pos, a, to, k, 0.03);
      c.commit();
    }, ease.in);
    pile.adopt(c);
    this.sfx(pile.chips.length > 1 ? 'chip.clack' : 'chip.stack', to, { gain: 0.65 });
  }

  // ---- per frame -------------------------------------------------------------------------------

  idleUpdate(dt, ctx = {}) {
    const cam = ctx.camera || this.player?.camera || this.engine.camera;
    if (cam) {
      this.group.getWorldPosition(_v);
      this.camDist = cam.position.distanceTo(_v);
    }
    const wasNear = this.near;
    this.near = this.active || this.camDist < 22;
    const visible = this.camDist < 45 || this.active;
    if (this.dealer && this.dealer.human.root.visible !== visible) {
      this.dealer.human.root.visible = visible;
      for (const n of this.npcs) n.human.root.visible = visible;
    }
    if (this.near) {
      this.tw.update(dt);
      const d = this.dealer;
      if (d) {
        if (this._dealerLook) d.human.lookAt(this._dealerLook());
        d.human.update(dt);
      }
      // Far-ish NPCs animate at half rate.
      this._npcTick = !this._npcTick;
      for (const n of this.npcs) {
        if (this.camDist < 9 || this._npcTick) n.human.update(this.camDist < 9 ? dt : dt * 2);
      }
      if (this._walking) for (const h of this._walking) if (h !== d?.human && !this.npcs.some((n) => n.human === h)) h.update(dt);
    }
    if (cam) this.bubbles.update(cam);
    if (wasNear !== this.near && !this.near) this.bubbles.clear();
    // Re-enable the chair collider once the player has walked away from it.
    if (this.disabledChair != null && !this.active && this.player == null) {
      const pl = ctx.player;
      const seat = this.seats[this.disabledChair];
      const far = !pl || pl.position.distanceTo(this.W(seat.pos)) > 0.9;
      if (far && seat.occupant !== 'npc') {
        this.chairColliders[this.disabledChair]?.setEnabled?.(true);
        this.disabledChair = null;
      }
    }
    this.tableUpdate?.(dt, ctx);
  }

  // ---- player seat plumbing ----------------------------------------------------------------------

  /** Seated: hands on the rail, chair collider off, UI built. */
  seatPlayer(seat) {
    this.chairColliders[seat.index]?.setEnabled?.(false);
    this.disabledChair = seat.index;
    this.bubbles.speakNear = true;
    const human = this.player.human;
    this.playerHands = new TableHands(human, { tweens: this.tw, seated: true, seatHeight: seat.height });
    this.tui = new TableUI(this.ui);
    const fx = this.engine.effects;
    if (fx) {
      this._vig0 = fx.uVignette.value;
      fx.uVignette.value = Math.max(this._vig0, 0.42);
    }
  }

  unseatPlayer() {
    this.playerHands?.dispose();
    this.playerHands = null;
    this.tui?.dispose();
    this.tui = null;
    this.bubbles.speakNear = false;
    const fx = this.engine.effects;
    if (fx && this._vig0 != null) fx.uVignette.value = this._vig0;
  }

  toast(text) {
    this.tui?.toast(text);
  }

  dispose() {
    super.dispose();
    this.tw.dispose();
    this.bubbles.dispose();
    for (const off of this._offs) off?.();
    this.dealer?.hands?.dispose();
    this.dealer?.human?.dispose();
    this._offDuty?.human?.dispose();
    for (const n of this.npcs) {
      n.hands?.dispose();
      n.human.dispose();
    }
    this.cards.dispose();
    this.chipSet.dispose();
    const w = this.physics?.world;
    if (w) for (const c of [...this.colliders, ...this.chairColliders]) if (c) w.removeCollider(c, true);
    this.group.traverse((o) => {
      if (o.isMesh && !o.isSkinnedMesh) {
        o.geometry?.dispose?.();
      }
    });
  }
}
