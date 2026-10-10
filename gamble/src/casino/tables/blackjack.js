// BlackjackTable — a 7-spot shoe game with real rules and a real shoe (rules/blackjack.js), a
// dealer who deals every card by hand from the shoe, NPC players with their own bankrolls and
// habits, and the seated player's chips, hand signals and payouts as physical objects.
//
// Flow per round: bets → (shuffle + burn when the cut card came out) → two cards each, dealer up
// card + hole card → insurance / even money on an ace → peek on an ace or ten → naturals paid →
// each hand acts (hit = tap, stand = wave, double / split = chips placed) → dealer turns the hole
// card and draws to the rule (H17 / S17) → settle from third base to first base, sweep cards.

import * as THREE from 'three';
import { TableBase } from './base.js';
import { BJ, buildBlackjackTable, polar } from './blackjack-geo.js';
import {
  Shoe, DEFAULT_RULES, handTotal, isBlackjack, isBust, pointOf, basicStrategy, legalActions, dealerShouldHit, settleHand,
} from './rules/blackjack.js';
import { CARD_T } from './kit/cards.js';
import { kindOf, valueOfKind, Pile } from './kit/chips3d.js';
import { ORIENT } from './kit/hands.js';
import { chipButton, segButton, h } from './kit/ui.js';
import { billsFor } from './kit/bills.js';
import { ease, arc } from './kit/tween.js';
import { chips, breakdown } from '../chips.js';
import { addCash, slice as lifeSlice } from '../../life/state.js';
import { bus } from '../../core/events.js';
import { input } from '../../core/input.js';
import { tt, money } from './strings.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _qx = new THREE.Quaternion();
const _qz = new THREE.Quaternion();
const AY = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const STACK_ORDER = [1, 2.5, 5, 25, 100, 500, 1000];

const MOUTH = new THREE.Vector3(0.548, 0.792, -0.33);
const OUT = new THREE.Vector3(0.43, 0.7615, -0.3);
const RACK_FRONT = new THREE.Vector3(0, 0.76, -0.285);

/** Card orientation from yaw, flip angle (0 = face up, π = face down) and tilt. */
function cardQ(yaw, flip, tilt = 0, out = new THREE.Quaternion()) {
  out.copy(_qy.setFromAxisAngle(AY, yaw));
  if (tilt) out.multiply(_qx.setFromAxisAngle(AX, tilt));
  if (flip) out.multiply(_qz.setFromAxisAngle(AZ, flip));
  return out;
}

export class BlackjackTable extends TableBase {
  constructor(o) {
    const group = new THREE.Group();
    group.name = o.id || 'blackjack';
    group.position.copy(o.position || new THREE.Vector3());
    group.rotation.y = o.yaw || 0;
    group.updateMatrixWorld(true);
    const limits = { min: 5, max: 500, ...(o.limits || {}) };
    const h17 = o.h17 ?? limits.min < 25;
    const built = buildBlackjackTable(group, { physics: o.physics, limits, h17, tier: o.tier });
    super(o, { group, seats: built.seats, label: 'blackjack', game: 'blackjack' });
    this.built = built;
    this.colliders = built.colliders;
    this.chairColliders = built.chairColliders;
    this.limits = limits;
    this.rules = { ...DEFAULT_RULES, h17 };
    this.shoe = new Shoe({ decks: 6, penetration: 0.75 });
    this.shoe.burn();
    this.discards = 1;
    this.spots = BJ.seatA.map((a, i) => ({
      i,
      a,
      dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)),
      right: new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
      owner: null,
      betPile: null,
      hands: [],
      insPile: null,
      stacks: [],
      lastBet: 0,
    }));
    this.dealerCards = [];
    this.phase = 'idle';
    this.footprint = { w: 3.0, d: 2.3 };
    this.pitAnchor = new THREE.Vector3(1.1, 1.8, -1.6);

    // Dealer (hands resting on the edge in front of the rack).
    this.createDealer(
      BJ.dealer,
      new THREE.Vector3(0.16, 0.778, -0.452),
      new THREE.Vector3(-0.16, 0.778, -0.452),
      () => this._lookTarget()
    );
    // NPC players: low tier keeps it to the dealer + one.
    const want = Math.min(this.low ? 1 : 6, o.npcs ?? 2);
    const order = [1, 5, 3, 0, 6, 2, 4];
    for (let k = 0; k < want; k++) this._addNpc(order[k]);

    this._syncShoeStack();
    this._onChips = bus.on('chips:changed', ({ casino }) => {
      if (casino === this.casino && this.active && !this._holdStacks) this._syncMyStacks();
    });
    this._offs.push(this._onChips);
    this._keys = (e) => this._onKey(e);
    this._ctx = (e) => this.active && e.preventDefault();
    this.engine.renderer.domElement.addEventListener('contextmenu', this._ctx);
    this._loop();
  }

  // ---- geometry helpers -----------------------------------------------------------------------

  _lookTarget() {
    const s = this._focusSpot;
    if (s) return this.W(polar(0.9, s.a, 1.1));
    return this.W(0, 1.3, 0.6);
  }

  _handLat(hand) {
    const n = hand.spot.hands.length;
    return (hand.idx - (n - 1) / 2) * 0.085;
  }

  _cardPos(hand, k, out = new THREE.Vector3()) {
    const s = hand.spot;
    polar(BJ.Rcard, s.a, BJ.feltY + 0.0004 + k * (CARD_T + 0.00012), out);
    return out.addScaledVector(s.right, this._handLat(hand) + k * 0.0125).addScaledVector(s.dir, -k * 0.017);
  }

  _betPos(hand, out = new THREE.Vector3()) {
    polar(BJ.Rbet, hand.spot.a, BJ.feltY, out);
    return out.addScaledVector(hand.spot.right, this._handLat(hand));
  }

  _dealerCardPos(k, out = new THREE.Vector3()) {
    const x = k === 0 ? -0.022 : k === 1 ? 0.02 : 0.02 + (k - 1) * 0.046;
    return out.set(x - 0.02, BJ.feltY + (k === 1 ? 0.0003 : 0.0008 + k * 0.0004), BJ.dealerCards.z);
  }

  _stackPos(spot, k, n, row = 0, out = new THREE.Vector3()) {
    const r = BJ.Rstack + row * 0.042;
    const step = 0.044 / r;
    const a = spot.a + 0.085 + (k - (n - 1) / 2) * step;
    return polar(r, a, BJ.feltY, out);
  }

  // ---- shoe / discard visuals --------------------------------------------------------------------

  _syncShoeStack() {
    const left = this.shoe.remaining / (this.shoe.decks * 52);
    this.built.shoeStack.scale.z = Math.max(0.02, left);
    this.built.discardStack.scale.y = Math.max(0.0001, this.discards * 0.00029);
    this.built.discardStack.position.y = BJ.feltY + (this.discards * 0.00029) / 2 + 0.002;
  }

  // ---- NPCs -------------------------------------------------------------------------------------

  _addNpc(i) {
    const npc = this.seatNpc(i, { min: this.limits.min });
    if (!npc) return null;
    npc.bankroll = Math.max(npc.bankroll, this.limits.min * 6);
    npc.unit = Math.max(this.limits.min, Math.min(npc.unit, this.limits.max));
    this.spots[i].owner = npc;
    this._syncNpcStacks(npc);
    return npc;
  }

  restNpcHands(npc) {
    const s = this.spots[npc.seat] || { a: BJ.seatA[npc.seat], right: new THREE.Vector3(Math.cos(BJ.seatA[npc.seat]), 0, -Math.sin(BJ.seatA[npc.seat])) };
    const base = polar(BJ.Rf + 0.03, s.a, BJ.feltY + 0.06);
    npc.hands.rest('L', this.W(base.clone().addScaledVector(s.right, -0.13)), ORIENT.palmDownIn);
    npc.hands.rest('R', this.W(base.clone().addScaledVector(s.right, 0.13)), ORIENT.palmDownIn);
  }

  _syncNpcStacks(npc) {
    const spot = this.spots[npc.seat];
    for (const p of spot.stacks) p.clear();
    spot.stacks = [];
    const counts = breakdown(Math.floor(npc.bankroll), 'cage').counts;
    this._buildStacks(spot, counts, 25);
  }

  _buildStacks(spot, counts, cap = 40) {
    const present = STACK_ORDER.filter((v) => counts[v] > 0);
    present.forEach((v, k) => {
      let n = Math.min(counts[v], cap);
      let row = 0;
      while (n > 0 && row < 2) {
        const p = this._stackPos(spot, k, present.length, row);
        const pile = new Pile(this.chipSet, p.x, p.z, BJ.feltY, { neat: 2 });
        pile.denom = v;
        const m = Math.min(20, n);
        for (let i = 0; i < m; i++) pile.push(kindOf(v));
        spot.stacks.push(pile);
        n -= m;
        row++;
      }
    });
  }

  // ---- the player's chips -----------------------------------------------------------------------

  _playerSpot() {
    return this.spots.find((s) => s.owner === 'player') || null;
  }

  _syncMyStacks() {
    const spot = this._playerSpot();
    if (!spot) return;
    for (const p of spot.stacks) p.clear();
    spot.stacks = [];
    this._buildStacks(spot, chips.counts(this.casino), 40);
    this._refreshUI();
  }

  get myTotal() {
    return chips.total(this.casino);
  }

  // ---- game loop --------------------------------------------------------------------------------

  async _loop() {
    await this.tw.wait(1.2);
    for (;;) {
      if (this.tw.dead) return;
      await this.tw.until(() => this.near);
      if (this._wantRelief && !this._playerSpot()?.betPile) await this._doRelief();
      await this._bettingPhase();
      const live = this.spots.filter((s) => s.betPile && s.betPile.value >= this.limits.min - 1e-9);
      if (!live.length) {
        await this.tw.wait(1.2);
        continue;
      }
      try {
        await this._playRound(live);
      } catch (err) {
        console.error('[blackjack] round failed', err);
        this._reset();
      }
      // NPCs who ran dry leave; empty seats fill again now and then.
      for (const npc of [...this.npcs]) if (npc.bankroll < this.limits.min) await this.npcLeave(npc).then(() => (this.spots[npc.seat].owner = null));
      this._maybeNewNpc();
    }
  }

  _maybeNewNpc() {
    if (this.low || this.npcs.length >= (this._npcTarget ?? 2)) return;
    if (this.rng.next() > 0.25) return;
    const free = this.spots.filter((s) => !s.owner && !this.seats[s.i].occupant);
    if (free.length <= 2) return;
    this._addNpc(this.rng.pick(free).i);
  }

  _reset() {
    for (const s of this.spots) {
      for (const hnd of s.hands) {
        for (const c of hnd.cards) this.cards.free(c.c);
        if (hnd.betPile && hnd.betPile !== s.betPile) hnd.betPile.clear();
        hnd.dblPile?.clear();
      }
      s.hands = [];
      s.insPile?.clear();
      s.insPile = null;
    }
    for (const c of this.dealerCards) this.cards.free(c.c);
    this.dealerCards = [];
    this.phase = 'betting';
  }

  async _bettingPhase() {
    this.phase = 'betting';
    this._dealRequested = false;
    this._refreshUI();
    if (this.npcs.length || this._playerSpot()) this.dsay('d.bets', null, { chance: 0.45 });
    const t0 = this.tw.time;
    const npcs = [...this.npcs].sort(() => this.rng.next() - 0.5);
    for (const npc of npcs) {
      await this.tw.wait(0.25 + this.rng.next() * 0.5);
      if (npc.bankroll >= this.limits.min) await this._npcBet(npc);
    }
    await this.tw.until(() => {
      const pl = this._playerSpot();
      if (pl) {
        if (this._dealRequested) return true;
        const anyNpc = this.spots.some((s) => s.owner !== 'player' && s.betPile);
        // A seated player who isn't betting doesn't hold the others up forever.
        if (!pl.betPile && anyNpc && this.tw.time - t0 > 16) return true;
        return false;
      }
      return this.tw.time - t0 > 2.4;
    });
    if (this._playerSpot()?.betPile && this._playerSpot().betPile.value < this.limits.min) {
      // Under the minimum: the chips go back.
      await this._returnBet(this._playerSpot());
    }
    this.phase = 'dealing';
    this._refreshUI();
  }

  async _npcBet(npc) {
    const spot = this.spots[npc.seat];
    const t = npc.type;
    let amt = npc.unit;
    if (t.style === 'martingale' && npc.losses) amt = npc.unit * 2 ** Math.min(npc.losses, 5);
    else if (t.style === 'wild') amt = npc.unit * this.rng.pick([1, 1, 2, 3, 5]);
    else if (t.style === 'hunch') amt = npc.unit * (this.rng.chance(0.3) ? 2 : 1);
    else if (t.style === 'count') amt = npc.unit * Math.max(1, Math.min(8, Math.floor(this.shoe.trueCount)));
    amt = Math.max(this.limits.min, Math.min(this.limits.max, amt, Math.floor(npc.bankroll)));
    amt = Math.floor(amt / this.limits.min) * this.limits.min || this.limits.min;
    if (amt > npc.bankroll) return;
    npc.bankroll -= amt;
    const counts = breakdown(amt, 'pay').counts;
    const bp = polar(BJ.Rbet, spot.a, BJ.feltY);
    spot.betPile = new Pile(this.chipSet, bp.x, bp.z, BJ.feltY, { neat: 2 });
    const from = this._stackPos(spot, 1, 3).setY(BJ.feltY + 0.06);
    const hand = from.clone();
    npc.hands.move('R', this.W(from.clone().setY(BJ.feltY + 0.02)), 0.3, { shape: 'pinch' });
    await this.tw.wait(0.3);
    this._syncNpcStacks(npc);
    npc.hands.follow('R', () => this.W(_v.copy(bp).setY(BJ.feltY + 0.03 + spot.betPile.height)), { shape: 'pinch' });
    for (const v of Object.keys(counts).map(Number).sort((a, b) => b - a)) {
      for (let i = 0; i < counts[v]; i++) await this.dropChip(spot.betPile, kindOf(v), hand, 0.16);
    }
    npc.hands.release('R');
    spot.lastBet = amt;
    // Tips for the dealer: a chip next to the bet (real "toke" bet), by personality.
    if (this.rng.chance(t.tip * 0.4) && npc.bankroll > this.limits.min * 3) {
      npc.tip = Math.min(npc.bankroll, this.limits.min >= 25 ? 5 : 1);
      npc.bankroll -= npc.tip;
      const tp = bp.clone().addScaledVector(spot.dir, -0.075);
      spot.tipPile = this.pileOf({ [npc.tip]: 1 }, tp.x, tp.z);
      this.npcSay(npc, 'n.tip');
    }
  }

  async _playRound(live) {
    if (this.shoe.cutReached) await this._shuffle();
    // Big bets get called out to the pit ("checks play").
    if (live.some((s) => s.betPile.value >= 100) && this.rng.chance(0.7)) {
      this.dsay('d.checks');
      await this.tw.wait(0.5);
      this.pitSay('p.ok');
    }
    for (const s of live) {
      s.hands = [{ spot: s, idx: 0, cards: [], vals: [], bet: s.betPile.value, betPile: s.betPile, dblPile: null, fromSplit: false, splitAces: false, doubled: false, done: false, result: null }];
      s.roundStake = s.betPile.value;
      s.roundBack = 0;
    }
    this.phase = 'dealing';
    this._refreshUI();
    for (const s of live) await this._dealTo(s.hands[0], true);
    await this._dealDealer(true);
    for (const s of live) await this._dealTo(s.hands[0], true);
    await this._dealDealer(false);
    const up = this.dealerCards[0].v;
    const upPts = pointOf(up);
    if (upPts === 11) await this._insurance(live);
    let dealerBJ = false;
    if (upPts >= 10) {
      await this._peek();
      dealerBJ = isBlackjack(this.dealerCards.map((c) => c.v));
    }
    if (dealerBJ) {
      await this._revealHole();
      this.dsay('d.dealerBJ');
      await this.tw.wait(0.6);
      await this._settleInsurance(live, true);
      await this._settleAll(live);
      await this._collectAll(live);
      this._emitResults(live);
      return;
    }
    if (upPts === 11) {
      await this._settleInsurance(live, false);
      this.dsay('d.noBJ', null, { chance: 0.7 });
    }
    // Naturals are paid at once.
    for (const s of live) {
      const hnd = s.hands[0];
      if (isBlackjack(hnd.vals)) {
        hnd.done = true;
        if (s.owner !== 'player') this.npcSay(s.owner, 'n.bj');
        else this.dsay('d.bj');
        await this._settleHand(hnd, true);
      }
    }
    // Players act, first base → third base.
    this.phase = 'playing';
    for (const s of live) {
      for (let k = 0; k < s.hands.length; k++) {
        const hnd = s.hands[k];
        if (hnd.done) continue;
        await this._playHand(hnd);
      }
    }
    this._focusSpot = null;
    this.phase = 'dealer';
    this._refreshUI();
    await this._revealHole();
    const anyLive = live.some((s) => s.hands.some((hnd) => !hnd.result && !isBust(hnd.vals)));
    if (anyLive) {
      while (dealerShouldHit(this.dealerCards.map((c) => c.v), this.rules.h17)) await this._dealDealer(true);
    }
    const dt = handTotal(this.dealerCards.map((c) => c.v)).total;
    if (anyLive) {
      if (dt > 21) this.dsay('d.dealerBust');
      else this.dsay('d.dealerHas', { n: dt });
    }
    await this.tw.wait(0.5);
    this.phase = 'settle';
    await this._settleAll(live);
    await this._collectAll(live);
    this._emitResults(live);
  }

  // ---- dealing ------------------------------------------------------------------------------------

  /** Shoe → (left hand slides it out) → right hand carries it to `to` and lays it down. */
  async _cardFromShoe(v, to, yaw, faceUp, { reveal = faceUp } = {}) {
    const d = this.dealer;
    const yaw0 = Math.PI / 2;
    const c = this.cards.spawn(v, MOUTH, cardQ(yaw0, Math.PI, 0.32));
    if (!c) return null;
    // Left hand: pull the card out of the shoe onto the felt.
    const mouthW = this.W(MOUTH.clone().add(_v.set(-0.02, 0.012, 0)));
    d.hands.move('L', mouthW, 0.14 / 1, { shape: 'flat', rot: ORIENT.palmDown, lift: 0.01 });
    await this.tw.wait(0.12);
    this.sfx('card.slide', MOUTH, { gain: 0.55 });
    const p0 = MOUTH.clone();
    await this.tw.to(0.17, (k) => {
      c.pos.lerpVectors(p0, OUT, k);
      c.pos.y += 0.006 * Math.sin(k * Math.PI);
      cardQ(yaw0, Math.PI, 0.32 * (1 - k), c.quat);
      c.commit();
      d.hands.set('L', this.W(_v.copy(c.pos).add(_v2.set(0.03, 0.012, 0))), { shape: 'flat', rot: ORIENT.palmDown });
    }, ease.out);
    d.hands.release('L');
    // Right hand takes it.
    const from = OUT.clone();
    const flip0 = Math.PI;
    const flip1 = faceUp ? 0 : Math.PI;
    d.hands.follow('R', () => this._reach('R', _v.copy(c.pos).add(_v2.set(0, 0.016, -0.02))), { shape: 'pinch', rot: ORIENT.cardGrip });
    const dist = from.distanceTo(to);
    const dur = 0.24 + dist * 0.22;
    this.sfx('card.deal', to, { gain: 0.6 });
    await this.tw.to(dur, (k) => {
      arc(c.pos, from, to, k, 0.035 + dist * 0.02);
      cardQ(yaw0 + (yaw - yaw0) * ease.inOut(k), flip0 + (flip1 - flip0) * ease.inOut(Math.min(1, k * 1.25)), 0, c.quat);
      c.commit();
    }, ease.inOut);
    c.pos.copy(to);
    cardQ(yaw, flip1, 0, c.quat);
    c.commit();
    d.hands.release('R');
    c.faceUp = faceUp;
    if (reveal) this.shoe.reveal(v);
    this._syncShoeStack();
    return c;
  }

  /** Clamp a world-space hand target to what the dealer's arm (plus a lean) can reach. */
  _reach(side, localPt) {
    const w = this.W(localPt);
    const sh = this.dealer.human.bones[`upperarm.${side}`].getWorldPosition(_v2);
    const max = 0.7;
    const d = w.distanceTo(sh);
    if (d > max) w.sub(sh).multiplyScalar(max / d).add(sh);
    return w;
  }

  async _dealTo(hand, faceUp) {
    const s = hand.spot;
    this._focusSpot = s;
    const v = this.shoe.draw();
    const to = this._cardPos(hand, hand.cards.length);
    const jitter = (Math.random() - 0.5) * 0.06;
    const c = await this._cardFromShoe(v, to, s.a + jitter, faceUp);
    hand.cards.push({ c, v });
    hand.vals.push(v);
    this._refreshUI();
    return v;
  }

  async _dealDealer(faceUp) {
    this._focusSpot = null;
    const k = this.dealerCards.length;
    const v = this.shoe.draw();
    const c = await this._cardFromShoe(v, this._dealerCardPos(k), (Math.random() - 0.5) * 0.04, faceUp);
    this.dealerCards.push({ c, v, up: faceUp });
    this._refreshUI();
    return v;
  }

  async _peek() {
    const hole = this.dealerCards[1];
    if (!hole) return;
    const d = this.dealer;
    const c = hole.c;
    const base = c.quat.clone();
    const p0 = c.pos.clone();
    await d.hands.move('R', this.W(c.pos.clone().add(_v.set(0.02, 0.02, 0.02))), 0.25, { shape: 'pinch' });
    // Lift the near corner just enough to read the index in the peek mirror.
    await this.tw.to(0.35, (k) => {
      c.quat.copy(base).multiply(_q.setFromAxisAngle(AX, -0.22 * Math.sin(k * Math.PI)));
      c.pos.copy(p0);
      c.pos.y += 0.006 * Math.sin(k * Math.PI);
      c.commit();
    }, ease.inOut);
    c.quat.copy(base);
    c.pos.copy(p0);
    c.commit();
    d.hands.release('R');
    await this.tw.wait(0.25);
  }

  async _revealHole() {
    const hole = this.dealerCards[1];
    if (!hole || hole.up) return;
    const d = this.dealer;
    const c = hole.c;
    const p0 = c.pos.clone();
    const to = p0.clone();
    to.y = BJ.feltY + 0.0012;
    const yaw = 0;
    d.hands.follow('R', () => this.W(_v.copy(c.pos).add(_v2.set(0.0, 0.02, -0.02))), { shape: 'pinch' });
    this.sfx('card.flip', p0, { gain: 0.7 });
    await this.tw.to(0.38, (k) => {
      c.pos.lerpVectors(p0, to, k);
      c.pos.y += 0.05 * Math.sin(k * Math.PI);
      c.pos.x += 0.02 * Math.sin(k * Math.PI);
      cardQ(yaw, Math.PI * (1 - k), 0, c.quat);
      c.commit();
    }, ease.inOut);
    d.hands.release('R');
    hole.up = true;
    c.faceUp = true;
    this.shoe.reveal(hole.v);
    this._refreshUI();
  }

  // ---- decisions ---------------------------------------------------------------------------------

  async _playHand(hand) {
    const s = hand.spot;
    this._focusSpot = s;
    if (hand.cards.length < 2) await this._dealTo(hand, true);
    for (;;) {
      const t = handTotal(hand.vals).total;
      if (t >= 21 || hand.doubled || (hand.splitAces && hand.cards.length >= 2)) break;
      const legal = legalActions(hand, s.hands.length, this.rules);
      if (!legal.hit) break;
      let act;
      if (s.owner === 'player') act = await this._askPlayer(hand, legal);
      else act = await this._npcDecide(hand, legal);
      if (act === 'H') {
        await this._signalHit(hand);
        await this._dealTo(hand, true);
      } else if (act === 'S') {
        await this._signalStand(hand);
        break;
      } else if (act === 'D') {
        await this._double(hand);
        await this._dealTo(hand, true);
        break;
      } else if (act === 'P') {
        await this._split(hand);
        if (hand.splitAces) {
          await this._dealTo(hand, true);
          break;
        }
        await this._dealTo(hand, true);
      } else break;
    }
    hand.done = true;
    if (isBust(hand.vals)) {
      if (s.owner === 'player') this.dsay('d.bust', null, { chance: 0.8 });
      else if (this.rng.chance(0.5)) this.npcSay(s.owner, 'n.lose');
      await this._settleHand(hand, false);
      if (s.owner !== 'player' && this.rng.chance(0.4)) s.owner.human.play('facepalm', { speed: 1.1 });
    }
    this._refreshUI();
  }

  async _npcDecide(hand, legal) {
    const npc = hand.spot.owner;
    await this.tw.wait(0.45 + this.rng.next() * 0.8);
    const up = this.dealerCards[0].v;
    const canDouble = legal.double && npc.bankroll >= hand.bet;
    const canSplit = legal.split && npc.bankroll >= hand.bet;
    let a = basicStrategy(hand.vals, up, { h17: this.rules.h17, canDouble, canSplit });
    const t = handTotal(hand.vals).total;
    if (npc.type.neverBust && t >= 12 && a === 'H') a = 'S';
    if (this.rng.next() < npc.type.mistake) {
      // Personality mistakes: mimic the dealer (hit to 17), chicken out, or a gut double.
      const r = this.rng.next();
      if (r < 0.4) a = t < 17 ? 'H' : 'S';
      else if (r < 0.75) a = t >= 12 ? 'S' : 'H';
      else if (canDouble && t >= 8 && t <= 12) a = 'D';
    }
    if (a === 'D' && !canDouble) a = 'H';
    if (a === 'P' && !canSplit) a = t >= 17 ? 'S' : 'H';
    return a;
  }

  _askPlayer(hand, legal) {
    this.phase = 'player';
    this._turn = { hand, legal };
    this.dsay('d.what', null, { chance: 0.35 });
    this._refreshUI();
    return new Promise((resolve) => {
      this._turn.resolve = (a) => {
        if (!this._turn) return;
        const ok = (a === 'H' && legal.hit) || (a === 'S' && legal.stand) || (a === 'D' && legal.double && this.myTotal >= hand.bet) || (a === 'P' && legal.split && this.myTotal >= hand.bet);
        if (!ok) return;
        this._turn = null;
        this.phase = 'playing';
        this._refreshUI();
        resolve(a);
      };
    });
  }

  /** Who's hands do the signal: the player's TableHands, or the NPC's. */
  _handsOf(spot) {
    if (spot.owner === 'player') return this.playerHands;
    return spot.owner?.hands || null;
  }

  async _signalHit(hand) {
    const hs = this._handsOf(hand.spot);
    if (!hs) return;
    const at = this._cardPos(hand, 0).addScaledVector(hand.spot.dir, 0.075);
    await hs.tap('R', this.W(at), 2);
    hs.release('R');
    if (hand.spot.owner !== 'player' && this.rng.chance(0.15)) this.npcSay(hand.spot.owner, 'n.hit');
  }

  async _signalStand(hand) {
    const hs = this._handsOf(hand.spot);
    if (!hs) return;
    const at = this._cardPos(hand, 0).addScaledVector(hand.spot.dir, 0.06);
    const across = this.group.localToWorld(hand.spot.right.clone().add(this.group.position)).sub(this.group.position).normalize();
    await hs.waveOff('R', this.W(at), this.group.getWorldQuaternion(_q) && hand.spot.right.clone().applyQuaternion(_q));
    void across;
    hs.release('R');
  }

  /** Take `amount` from the spot's owner as felt chips (player chips store or NPC bankroll). */
  _takeFromOwner(spot, amount) {
    if (spot.owner === 'player') {
      const counts = chips.take(amount, this.casino, 'blackjack');
      return counts;
    }
    const npc = spot.owner;
    if (npc.bankroll < amount) return null;
    npc.bankroll -= amount;
    this._syncNpcStacks(npc);
    return breakdown(amount, 'pay').counts;
  }

  async _placeChipsBeside(hand, counts, pos) {
    const s = hand.spot;
    const hs = this._handsOf(s);
    const pile = new Pile(this.chipSet, pos.x, pos.z, BJ.feltY, { neat: 2 });
    const from = this._stackPos(s, 1, 3).setY(BJ.feltY + 0.05);
    if (hs) hs.follow('R', () => this.W(_v.copy(pos).setY(BJ.feltY + 0.035 + pile.height)), { shape: 'pinch' });
    for (const v of Object.keys(counts).map(Number).sort((a, b) => b - a)) for (let i = 0; i < counts[v]; i++) await this.dropChip(pile, kindOf(v), from, 0.15);
    hs?.release('R');
    return pile;
  }

  async _double(hand) {
    const s = hand.spot;
    this._holdStacks = true;
    const counts = this._takeFromOwner(s, hand.bet);
    if (!counts) {
      this._holdStacks = false;
      return;
    }
    if (s.owner === 'player') this._syncMyStacks();
    const pos = this._betPos(hand).addScaledVector(s.right, 0.045).addScaledVector(s.dir, 0.012);
    hand.dblPile = await this._placeChipsBeside(hand, counts, pos);
    s.roundStake += hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    this._holdStacks = false;
    // One finger up: "one card".
    const hs = this._handsOf(s);
    if (hs) {
      await hs.move('R', this.W(this._betPos(hand).setY(BJ.feltY + 0.08)), 0.25, { shape: 'point', rot: ORIENT.point });
      await this.tw.wait(0.25);
      hs.release('R');
    }
    if (s.owner === 'player') this.dsay('d.double', null, { chance: 0.5 });
  }

  async _split(hand) {
    const s = hand.spot;
    this._holdStacks = true;
    const counts = this._takeFromOwner(s, hand.bet);
    if (!counts) {
      this._holdStacks = false;
      return;
    }
    if (s.owner === 'player') this._syncMyStacks();
    const aces = pointOf(hand.vals[0]) === 11;
    const second = { spot: s, idx: hand.idx + 1, cards: [hand.cards.pop()], vals: [hand.vals.pop()], bet: hand.bet, betPile: null, dblPile: null, fromSplit: true, splitAces: aces, doubled: false, done: false, result: null };
    hand.fromSplit = true;
    hand.splitAces = aces;
    s.hands.splice(hand.idx + 1, 0, second);
    s.hands.forEach((hh, i) => (hh.idx = i));
    s.roundStake += hand.bet;
    // Re-lay every hand of this spot (cards and bets slide apart).
    const moves = [];
    for (const hh of s.hands) {
      hh.cards.forEach((cc, k) => {
        const from = cc.c.pos.clone();
        const to = this._cardPos(hh, k);
        moves.push(this.tw.to(0.3, (e) => {
          cc.c.pos.lerpVectors(from, to, e);
          cc.c.commit();
        }));
      });
      if (hh.betPile) {
        const to = this._betPos(hh);
        moves.push(this.movePile(hh.betPile, to.x, to.z, 0.3, { sound: null }));
      }
    }
    this.sfx('card.slide', hand.cards[0]?.c.pos, { gain: 0.6 });
    await Promise.all(moves);
    second.betPile = await this._placeChipsBeside(second, counts, this._betPos(second));
    this._holdStacks = false;
    if (s.owner === 'player') this.dsay('d.split', null, { chance: 0.6 });
  }

  // ---- insurance ---------------------------------------------------------------------------------

  async _insurance(live) {
    this.dsay('d.insurance');
    this.phase = 'insurance';
    for (const s of live) {
      const hnd = s.hands[0];
      const cost = Math.floor((hnd.bet / 2) * 2) / 2;
      let take = false;
      if (s.owner === 'player') {
        if (this.myTotal >= cost) take = await this._askInsurance(isBlackjack(hnd.vals));
      } else {
        const npc = s.owner;
        const tc = this.shoe.trueCount;
        take = npc.bankroll >= cost && ((npc.type.style === 'count' && tc >= 3) || (npc.type.id === 'tourist' && this.rng.chance(0.4)) || (npc.type.id === 'nervous' && this.rng.chance(0.6)) || (npc.type.id === 'drunk' && this.rng.chance(0.3)));
        await this.tw.wait(0.3);
      }
      if (!take) continue;
      this._holdStacks = true;
      const counts = this._takeFromOwner(s, cost);
      if (s.owner === 'player') this._syncMyStacks();
      if (counts) {
        const p = polar(0.536, s.a, BJ.feltY);
        s.insPile = await this._placeChipsBeside(hnd, counts, p);
        s.insPile.amount = cost;
        s.roundStake += cost;
      }
      this._holdStacks = false;
    }
    this.phase = 'dealing';
    this._refreshUI();
  }

  _askInsurance(evenMoney) {
    this._insAsk = { evenMoney };
    this._refreshUI();
    return new Promise((resolve) => {
      this._insAsk.resolve = (yes) => {
        this._insAsk = null;
        this._refreshUI();
        resolve(yes);
      };
    });
  }

  async _settleInsurance(live, dealerBJ) {
    for (const s of [...live].reverse()) {
      if (!s.insPile) continue;
      if (dealerBJ) {
        const pay = s.insPile.amount * 2;
        const p = s.insPile.base;
        const payPile = await this._dealerBring(pay, p.x + 0.045, p.z);
        await this._toOwner(s, [s.insPile, payPile], s.insPile.amount * 3);
      } else {
        await this._dealerTake(s.insPile);
      }
      s.insPile = null;
    }
  }

  // ---- chips choreography ------------------------------------------------------------------------

  /** The dealer cuts `amount` from the rack and sets it down at (x, z). */
  async _dealerBring(amount, x, z) {
    const pile = this.pileOfAmount(amount, RACK_FRONT.x, RACK_FRONT.z);
    const d = this.dealer;
    d.hands.follow('R', () => this._reach('R', _v.copy(pile.base).add(_v2.set(0, 0.02 + pile.height, -0.025))), { shape: 'grip' });
    await this.movePile(pile, x, z, 0.32 + Math.hypot(x, z - RACK_FRONT.z) * 0.25, { lift: 0.02 });
    this.sfx('chip.stack', pile.base, { gain: 0.6 });
    d.hands.release('R');
    return pile;
  }

  /** The dealer sweeps a losing pile into the rack. */
  async _dealerTake(pile) {
    if (!pile || !pile.chips.length) return;
    const d = this.dealer;
    await d.hands.move('R', this._reach('R', pile.base.clone().add(_v.set(0, 0.025, -0.02))), 0.22, { shape: 'flat' });
    d.hands.follow('R', () => this._reach('R', _v.copy(pile.base).add(_v2.set(0, 0.02 + pile.height, -0.025))), { shape: 'grip' });
    await this.movePile(pile, RACK_FRONT.x + (Math.random() - 0.5) * 0.2, RACK_FRONT.z, 0.36, { lift: 0.012 });
    d.hands.release('R');
    this.sfx('chip.clack', pile.base, { gain: 0.5 });
    pile.clear();
  }

  /** Winning / pushed chips slide back to their owner's stacks. */
  async _toOwner(spot, piles, amount) {
    const target = this._stackPos(spot, 1, 3);
    piles = piles.filter((p) => p && p.chips.length);
    const counts = {};
    for (const p of piles) for (const [v, n] of Object.entries(p.counts())) counts[v] = (counts[v] || 0) + n;
    await Promise.all(piles.map((p, i) => this.movePile(p, target.x + i * 0.01, target.z, 0.42, { lift: 0.015, sound: i ? null : 'chip.slide' })));
    for (const p of piles) p.clear();
    if (spot.owner === 'player') {
      this._holdStacks = false;
      chips.addCounts(counts, this.casino, 'blackjack');
      // Anything chips can't express (never with these denominations) would come back as cash.
      const v = Object.entries(counts).reduce((a, [d, n]) => a + d * n, 0);
      if (amount - v > 0.001) addCash(Math.round((amount - v) * 100) / 100, 'blackjack');
    } else if (spot.owner) {
      spot.owner.bankroll += amount;
      this._syncNpcStacks(spot.owner);
    }
  }

  async _returnBet(spot) {
    if (!spot.betPile) return;
    const amt = spot.betPile.value;
    await this._toOwner(spot, [spot.betPile], amt);
    spot.betPile = null;
  }

  // ---- settlement --------------------------------------------------------------------------------

  async _settleHand(hand, natural) {
    const s = hand.spot;
    const dealerVals = this.dealerCards.map((c) => c.v);
    const r = natural ? { result: 'blackjack', returned: hand.bet * (1 + this.rules.blackjackPays) } : settleHand(hand, dealerVals, this.rules);
    if (isBust(hand.vals)) Object.assign(r, { result: 'bust', returned: 0 });
    hand.result = r.result;
    this._focusSpot = s;
    const piles = [hand.betPile, hand.dblPile];
    if (r.returned > hand.bet + 1e-9) {
      const win = r.returned - hand.bet;
      const bp = hand.betPile.base;
      const payPile = await this._dealerBring(win, bp.x - s.right.x * 0.046, bp.z - s.right.z * 0.046);
      await this.tw.wait(0.25);
      await this._toOwner(s, [...piles, payPile], r.returned);
      if (s.owner !== 'player' && s.owner) {
        if (this.rng.chance(0.5)) s.owner.human.play('cheer', { speed: 1.2 });
        if (this.rng.chance(0.4)) this.npcSay(s.owner, 'n.win');
        s.owner.losses = 0;
      }
    } else if (Math.abs(r.returned - hand.bet) < 1e-9) {
      await this._toOwner(s, piles, r.returned);
    } else {
      for (const p of piles) await this._dealerTake(p);
      if (s.owner && s.owner !== 'player') s.owner.losses = (s.owner.losses || 0) + 1;
    }
    s.roundBack += r.returned;
    hand.betPile = null;
    hand.dblPile = null;
    if (hand.idx === 0) s.betPile = null;
    // Tips ride on the hand's result.
    if (s.tipPile) {
      if (r.returned > hand.bet) {
        this.dsay('d.thanks');
        const tp = s.tipPile;
        const pay = await this._dealerBring(tp.value, tp.base.x + 0.04, tp.base.z);
        await this.tw.wait(0.2);
        for (const p of [tp, pay]) await this.movePile(p, RACK_FRONT.x + 0.25, RACK_FRONT.z, 0.3);
        tp.clear();
        pay.clear();
      } else await this._dealerTake(s.tipPile);
      s.tipPile = null;
    }
  }

  async _settleAll(live) {
    for (const s of [...live].reverse()) {
      for (const hnd of [...s.hands].reverse()) {
        if (hnd.result) continue;
        await this._settleHand(hnd, false);
      }
    }
  }

  async _collectAll(live) {
    const d = this.dealer;
    const all = [];
    for (const s of [...live].reverse()) for (const hnd of s.hands) for (const c of hnd.cards) all.push(c);
    for (const c of this.dealerCards) all.push(c);
    // Scoop spot by spot into one pile, then into the discard holder face down.
    const pileAt = BJ.dealerCards.clone().add(_v.set(-0.25, 0, 0.04));
    let i = 0;
    d.hands.follow('R', () => this._reach('R', _v.copy(pileAt).add(_v2.set(0, 0.03, -0.02))), { shape: 'flat' });
    await Promise.all(all.map((cc) => {
      const from = cc.c.pos.clone();
      const q0 = cc.c.quat.clone();
      const to = pileAt.clone();
      to.y = BJ.feltY + 0.001 + i * CARD_T;
      const q1 = cardQ(0, Math.PI);
      const delay = i++ * 0.035;
      return this.tw.wait(delay).then(() => this.tw.to(0.32, (k) => {
        cc.c.pos.lerpVectors(from, to, k);
        cc.c.pos.y += 0.02 * Math.sin(k * Math.PI);
        cc.c.quat.slerpQuaternions(q0, q1, k);
        cc.c.commit();
      }));
    }));
    this.sfx('card.slide', pileAt, { gain: 0.7 });
    const p0 = all.map((cc) => cc.c.pos.clone());
    const dest = BJ.discard.clone();
    dest.y = BJ.feltY + this.discards * 0.00029 + 0.004;
    d.hands.follow('R', () => this._reach('R', _v.copy(all[0]?.c.pos || dest).add(_v2.set(0, 0.03, -0.02))), { shape: 'grip' });
    await this.tw.to(0.4, (k) => {
      all.forEach((cc, j) => {
        arc(cc.c.pos, p0[j], dest, k, 0.06);
        cc.c.pos.y += j * CARD_T;
        cc.c.commit();
      });
    });
    d.hands.release('R');
    for (const cc of all) this.cards.free(cc.c);
    this.discards += all.length;
    this.dealerCards = [];
    for (const s of live) s.hands = [];
    this._syncShoeStack();
    this.sfx('card.deal', dest, { gain: 0.5 });
  }

  _emitResults(live) {
    for (const s of live) {
      if (s.owner !== 'player') continue;
      const bet = s.roundStake || 0;
      const payout = s.roundBack || 0;
      bus.emit('gamble:result', { game: 'blackjack', bet, payout, net: Math.round((payout - bet) * 100) / 100, table: this.id });
      if (payout > bet) this.tui?.toast(tt('youWin', { amount: money(payout - bet) }));
      else if (payout < bet) this.tui?.toast(tt('youLose', { amount: money(bet - payout) }));
      else this.tui?.toast(tt('push'));
      s.lastBet = s.lastBet || bet;
    }
    this.phase = 'betting';
    this._refreshUI();
  }

  // ---- shuffle ------------------------------------------------------------------------------------

  async _shuffle() {
    this.dsay('d.shuffle');
    const d = this.dealer;
    // Discards and the rest of the shoe come together in the middle for a riffle shuffle.
    const mid = this.W(0, BJ.feltY + 0.03, -0.26);
    d.hands.move('L', mid.clone().add(_v.set(0.06, 0, 0)), 0.4, { shape: 'grip' });
    await d.hands.move('R', mid.clone().add(_v.set(-0.06, 0, 0)), 0.4, { shape: 'grip' });
    this.built.discardStack.scale.y = 0.0001;
    for (let k = 0; k < 4; k++) {
      this.sfx('card.shuffle', BJ.dealerCards, { gain: 0.8 });
      await Promise.all([
        d.hands.move('L', mid.clone().add(_v.set(0.09, 0.03, 0)), 0.35, { shape: 'grip', lift: 0.03 }),
        d.hands.move('R', mid.clone().add(_v.set(-0.09, 0.03, 0)), 0.35, { shape: 'grip', lift: 0.03 }),
      ]);
      await Promise.all([
        d.hands.move('L', mid.clone().add(_v.set(0.03, 0, 0)), 0.45, { shape: 'grip' }),
        d.hands.move('R', mid.clone().add(_v.set(-0.03, 0, 0)), 0.45, { shape: 'grip' }),
      ]);
    }
    d.hands.release('L');
    d.hands.release('R');
    this.shoe.shuffle();
    this.shoe.burn();
    this.discards = 1;
    this._syncShoeStack();
    this.sfx('card.slide', BJ.shoe, { gain: 0.6 });
    await this.tw.wait(0.4);
  }

  // ---- player seat --------------------------------------------------------------------------------

  onSit(seat) {
    const spot = this.spots[seat.index];
    spot.owner = 'player';
    this.seatPlayer(seat);
    const base = polar(BJ.Rf + 0.035, spot.a, BJ.feltY + 0.062);
    this.playerHands.rest('L', this.W(base.clone().addScaledVector(spot.right, -0.14)), ORIENT.palmDownIn);
    this.playerHands.rest('R', this.W(base.clone().addScaledVector(spot.right, 0.14)), ORIENT.palmDownIn);
    this.tui.setPlaque(`Blackjack ${money(this.limits.min)} – ${money(this.limits.max)}`, `${tt(this.rules.h17 ? 'h17' : 's17')} · ${tt('bjPays')}`);
    window.addEventListener('keydown', this._keys);
    this._syncMyStacks();
    this.dsay('d.greet');
    this._refreshUI();
  }

  canStand() {
    const spot = this._playerSpot();
    if (!spot) return true;
    const inHand = spot.hands.length > 0 || this._turn || this._insAsk || this._changing;
    if (inHand) {
      this.toast(tt('standBusy'));
      return false;
    }
    return true;
  }

  onStand() {
    const spot = this._playerSpot();
    window.removeEventListener('keydown', this._keys);
    this._cancelDrag();
    if (spot) {
      if (spot.betPile) {
        chips.addCounts(spot.betPile.counts(), this.casino, 'blackjack');
        spot.betPile.clear();
        spot.betPile = null;
      }
      for (const p of spot.stacks) p.clear();
      spot.stacks = [];
      spot.owner = null;
    }
    // Colour up: the dealer swaps your small chips for big ones.
    const total = chips.total(this.casino);
    if (total > 0) {
      chips.colorUp(this.casino);
      this.dsay('d.colorUp', { amount: money(total) }, { chance: 0.8 });
    }
    this.unseatPlayer();
  }

  // ---- input -------------------------------------------------------------------------------------

  _onKey(e) {
    if (!this.active || e.repeat) return;
    const k = e.code;
    if (this._turn) {
      const map = { KeyH: 'H', KeyS: 'S', KeyD: 'D', KeyQ: 'P' };
      if (map[k]) this._turn.resolve(map[k]);
      return;
    }
    if (this._insAsk) {
      if (k === 'KeyY' || k === 'KeyI') this._insAsk.resolve(true);
      if (k === 'KeyN') this._insAsk.resolve(false);
      return;
    }
    if (this.phase === 'betting') {
      if (k === 'Space' || k === 'Enter') this._requestDeal();
      if (k === 'KeyR') this._rebet();
      if (k === 'KeyC') this._clearBet();
    }
  }

  _requestDeal() {
    const spot = this._playerSpot();
    if (!spot || this.phase !== 'betting') return;
    if (!spot.betPile || spot.betPile.value < this.limits.min) {
      this.toast(tt('under', { min: money(this.limits.min) }));
      return;
    }
    spot.lastBet = spot.betPile.value;
    this._dealRequested = true;
  }

  /** Put `counts` of the player's chips (already removed from the store) onto the circle. */
  async _betCounts(counts, from = null) {
    const spot = this._playerSpot();
    if (!spot) return;
    if (!spot.betPile) {
      const bp = polar(BJ.Rbet, spot.a, BJ.feltY);
      spot.betPile = new Pile(this.chipSet, bp.x, bp.z, BJ.feltY, { neat: 2 });
    }
    const src = from || this._stackPos(spot, 1, 3).setY(BJ.feltY + 0.05);
    const vals = Object.keys(counts).map(Number).sort((a, b) => b - a);
    const n = vals.reduce((a, v) => a + counts[v], 0);
    for (const v of vals) for (let i = 0; i < counts[v]; i++) await this.dropChip(spot.betPile, kindOf(v), src, n > 6 ? 0.08 : 0.16);
    if (spot.betPile.value >= 100 && !this._calledChecks) {
      this._calledChecks = true;
      this.dsay('d.checks');
    }
    this._refreshUI();
  }

  _canBet() {
    return this.active && this.phase === 'betting' && !this._dealRequested;
  }

  /** One chip of value v from your stacks to the circle (with limit checks). */
  _betChip(v, from) {
    const spot = this._playerSpot();
    if (!this._canBet() || !spot) return false;
    const cur = spot.betPile?.value || 0;
    if (cur + v > this.limits.max + 1e-9) {
      this.toast(tt('over', { max: money(this.limits.max) }));
      return false;
    }
    if (!chips.removeCounts({ [v]: 1 }, this.casino, 'bet')) return false;
    this._betCounts({ [v]: 1 }, from);
    return true;
  }

  _betAmount(amount) {
    const spot = this._playerSpot();
    if (!this._canBet() || !spot) return;
    const cur = spot.betPile?.value || 0;
    const amt = Math.min(amount, this.limits.max - cur, this.myTotal);
    if (amt <= 0) {
      this.toast(cur >= this.limits.max ? tt('over', { max: money(this.limits.max) }) : tt('noChips'));
      return;
    }
    const counts = chips.take(amt, this.casino, 'bet');
    if (counts) this._betCounts(counts);
  }

  _allIn() {
    this._betAmount(this.myTotal);
    this.sfx('chip.scatter', this._playerSpot() ? polar(BJ.Rbet, this._playerSpot().a) : null, { gain: 0.8 });
  }

  _rebet() {
    const spot = this._playerSpot();
    if (!spot || !spot.lastBet || spot.betPile) return;
    this._betAmount(spot.lastBet);
  }

  _clearBet() {
    const spot = this._playerSpot();
    if (!spot?.betPile || !this._canBet()) return;
    this._returnBet(spot);
  }

  // ---- pointer: physical chips -------------------------------------------------------------------

  _feltPoint(ray) {
    const inv = this.group.matrixWorld.clone().invert();
    const r = ray.ray.clone().applyMatrix4(inv);
    if (Math.abs(r.direction.y) < 1e-4) return null;
    const t = (BJ.feltY - r.origin.y) / r.direction.y;
    if (t < 0) return null;
    return r.origin.addScaledVector(r.direction, t);
  }

  _pickStack(ray, p) {
    const spot = this._playerSpot();
    if (!spot) return null;
    const hits = ray.intersectObject(this.chipSet.mesh, false);
    for (const hit of hits) {
      const pile = spot.stacks.find((pp) => pp.chips.some((c) => c.id === hit.instanceId));
      if (pile) return pile;
    }
    // Fat-finger tolerance: closest stack base under the touch on the felt.
    if (p) {
      let best = null;
      let bd = 0.032;
      for (const pile of spot.stacks) {
        const d = Math.hypot(pile.base.x - p.x, pile.base.z - p.z);
        if (d < bd) {
          bd = d;
          best = pile;
        }
      }
      return best;
    }
    return null;
  }

  _overCircle(p) {
    const spot = this._playerSpot();
    if (!spot || !p) return false;
    const c = polar(BJ.Rbet, spot.a);
    return Math.hypot(c.x - p.x, c.z - p.z) < BJ.betR + 0.03;
  }

  onPointer(type, ray, ev) {
    const p = this._feltPoint(ray);
    if (type === 'down') {
      if (ev.button === 2) {
        // Right-click the circle: take the top chip back.
        if (this._overCircle(p) && this._canBet()) this._takeBackOne();
        return;
      }
      const pile = this._pickStack(ray, p);
      if (pile && this._canBet()) {
        this.drag = { mode: 'press', pile, v: pile.denom, x: ev.clientX, y: ev.clientY, t: performance.now() };
      } else if (this._overCircle(p) && this._canBet() && this._selected) {
        this._betChip(this._selected, null);
      }
      return;
    }
    const dg = this.drag;
    if (!dg) return;
    if (type === 'move') {
      if (dg.mode === 'press' && Math.hypot(ev.clientX - dg.x, ev.clientY - dg.y) > 7) this._startDrag(false);
      if ((dg.mode === 'drag' || dg.mode === 'dragAll') && p) {
        dg.at = p;
        dg.carry.forEach((c, i) => {
          c.pos.set(p.x, BJ.feltY + 0.03 + i * 0.0033, p.z);
          c.commit();
        });
      }
      return;
    }
    if (type === 'up') {
      if (dg.mode === 'press') {
        const now = performance.now();
        const dbl = this._lastTap && now - this._lastTap.t < 340 && this._lastTap.v === dg.v;
        this._selected = dg.v;
        if (dbl) {
          // Double-click a stack: bet the whole stack.
          const n = chips.counts(this.casino)[dg.v] || 0;
          this._betAmount(n * dg.v);
          this._lastTap = null;
        } else {
          this._betChip(dg.v, dg.pile.slot(dg.pile.chips.length).setY(BJ.feltY + 0.04));
          this._lastTap = { t: now, v: dg.v };
        }
        this.drag = null;
        return;
      }
      this._endDrag(p);
    }
  }

  _startDrag(all) {
    const dg = this.drag;
    const n = all ? dg.pile.chips.length : 1;
    dg.mode = all ? 'dragAll' : 'drag';
    dg.carry = [];
    this._holdStacks = true;
    for (let i = 0; i < n; i++) {
      const c = dg.pile.pop();
      if (c) dg.carry.unshift(c);
    }
    this.sfx('chip.clack', dg.pile.base, { gain: 0.4 });
  }

  tableUpdate() {
    const dg = this.drag;
    if (dg && dg.mode === 'press' && performance.now() - dg.t > 450) this._startDrag(true);
  }

  async _endDrag(p) {
    const dg = this.drag;
    this.drag = null;
    if (!dg?.carry) return;
    const spot = this._playerSpot();
    const ok = spot && this._overCircle(p) && this._canBet();
    const value = dg.carry.reduce((a, c) => a + c.value, 0);
    const cur = spot?.betPile?.value || 0;
    if (ok && cur + value <= this.limits.max + 1e-9 && chips.removeCounts({ [dg.v]: dg.carry.length }, this.casino, 'bet')) {
      if (!spot.betPile) {
        const bp = polar(BJ.Rbet, spot.a, BJ.feltY);
        spot.betPile = new Pile(this.chipSet, bp.x, bp.z, BJ.feltY, { neat: 2 });
      }
      for (const c of dg.carry) {
        const from = c.pos.clone();
        const to = spot.betPile.slot();
        await this.tw.to(0.12, (k) => {
          c.pos.lerpVectors(from, to, k);
          c.commit();
        }, ease.in);
        spot.betPile.adopt(c);
        this.sfx('chip.clack', to, { gain: 0.6 });
      }
      this._holdStacks = false;
      this._refreshUI();
      return;
    }
    if (ok) this.toast(tt('over', { max: money(this.limits.max) }));
    // Back onto the stack.
    for (const c of dg.carry) this.chipSet.free(c);
    this._holdStacks = false;
    this._syncMyStacks();
  }

  _cancelDrag() {
    if (this.drag?.carry) for (const c of this.drag.carry) this.chipSet.free(c);
    this.drag = null;
    this._holdStacks = false;
  }

  _takeBackOne() {
    const spot = this._playerSpot();
    const c = spot?.betPile?.pop();
    if (!c) return;
    const v = c.value;
    this.chipSet.free(c);
    if (!spot.betPile.chips.length) spot.betPile = null;
    chips.addCounts({ [v]: 1 }, this.casino, 'unbet');
    this.sfx('chip.clack', null, { gain: 0.4 });
  }

  // ---- cash change at the table ------------------------------------------------------------------

  _openChange() {
    if (!this.tui || this.phase !== 'betting') return;
    const cash = lifeSlice('money').cash || 0;
    const p = this.tui.panel(tt('changeTitle'), `${tt('cashLeft')}: ${money(cash)}`);
    const row = h('div', 'row');
    for (const a of [20, 50, 100, 200, 500, 1000]) {
      const b = segButton(money(a), () => this._change(a));
      if (a > cash) b.disabled = true;
      row.append(b);
    }
    const all = segButton(`${tt('all')} ${money(Math.floor(cash))}`, () => this._change(Math.floor(cash)));
    if (cash < 1) all.disabled = true;
    row.append(all);
    p.append(row);
    const r2 = h('div', 'row');
    r2.append(segButton(tt('cancel'), () => this.tui.closePanel()));
    p.append(r2);
  }

  async _change(amount) {
    this.tui?.closePanel();
    if (amount <= 0 || this._changing) return;
    if (!addCash(-amount, 'chips buy-in')) {
      this.toast(tt('noCash'));
      return;
    }
    this._changing = true;
    this._refreshUI();
    const spot = this._playerSpot();
    // You lay the bills on the felt; the dealer spreads them for the camera and calls it out.
    const bills = billsFor(amount);
    const at = polar(0.7, spot.a, BJ.feltY + 0.0008).addScaledVector(spot.right, -0.08);
    bills.forEach((b, i) => {
      b.position.copy(at).add(_v.set(i * 0.004, i * 0.0004, -i * 0.002));
      b.rotation.y = spot.a + 0.2;
      this.group.add(b);
    });
    this.sfx('cash.bill', at, { gain: 0.7 });
    await this.tw.wait(0.4);
    const mid = new THREE.Vector3(-0.1, BJ.feltY + 0.001, -0.15);
    const d = this.dealer;
    d.hands.follow('R', () => this._reach('R', _v.copy(bills[0].position).add(_v2.set(0, 0.02, -0.02))), { shape: 'flat' });
    await this.tw.to(0.5, (k) => {
      bills.forEach((b, i) => {
        b.position.lerpVectors(at.clone().add(_v.set(i * 0.004, i * 0.0004, 0)), mid.clone().add(_v2.set((i - bills.length / 2) * 0.03, i * 0.0004, 0)), k);
        b.rotation.y = (spot.a + 0.2) * (1 - k);
      });
    });
    d.hands.release('R');
    this.dsay('d.changing', { amount: money(amount) });
    this.sfx('cash.count', mid, { gain: 0.6 });
    await this.tw.wait(1.1);
    this.pitSay('p.ok');
    await this.tw.wait(0.6);
    // Into the drop box with the paddle.
    const slot = BJ.drop.clone();
    d.hands.follow('L', () => this._reach('L', _v.copy(bills[0].position).add(_v2.set(0, 0.02, -0.02))), { shape: 'flat' });
    const starts = bills.map((b) => b.position.clone());
    await this.tw.to(0.55, (k) => {
      bills.forEach((b, i) => {
        b.position.lerpVectors(starts[i], slot, k);
        b.position.y = BJ.feltY + 0.001 + i * 0.0004 - (k > 0.85 ? (k - 0.85) * 0.2 : 0);
        b.scale.setScalar(k > 0.85 ? 1 - (k - 0.85) * 5 : 1);
      });
    });
    d.hands.release('L');
    for (const b of bills) b.removeFromParent();
    this.sfx('cash.bill', slot, { gain: 0.6 });
    // Chips cut from the rack and pushed to you.
    const counts = breakdown(amount, 'cage').counts;
    const pile = this.pileOf(counts, RACK_FRONT.x, RACK_FRONT.z);
    const dest = this._stackPos(spot, 1, 3);
    d.hands.follow('R', () => this._reach('R', _v.copy(pile.base).add(_v2.set(0, 0.03 + pile.height, -0.03))), { shape: 'grip' });
    await this.movePile(pile, dest.x, dest.z, 0.6, { lift: 0.01 });
    d.hands.release('R');
    pile.clear();
    chips.buyIn(amount, this.casino, 'table');
    this._changing = false;
    this._syncMyStacks();
  }

  // ---- UI ----------------------------------------------------------------------------------------

  _refreshUI() {
    const ui = this.tui;
    if (!ui) return;
    const spot = this._playerSpot();
    if (!spot) return;
    const status = [];
    const myHands = spot.hands;
    for (const hnd of myHands) {
      const t = handTotal(hnd.vals);
      const lo = t.soft ? t.total - 10 : t.total;
      const txt = isBlackjack(hnd.vals, hnd.fromSplit) ? 'BJ' : t.soft && t.total < 21 ? tt('totalSoft', { lo, hi: t.total }) : String(t.total);
      status.push({ label: myHands.length > 1 ? `${tt('bet')} ${hnd.idx + 1}` : '', value: `${txt} · ${money(hnd.bet)}`, hl: this._turn?.hand === hnd });
    }
    if (this.dealerCards.length) {
      const shown = this.dealerCards.filter((c) => c.up).map((c) => c.v);
      const t = handTotal(shown);
      status.push({ label: 'Dealer', value: String(t.total) });
    }
    if (!myHands.length) status.push({ label: tt('bet'), value: money(spot.betPile?.value || 0) });
    status.push({ label: tt('yourChips'), value: money(this.myTotal) });
    ui.setStatus(status);

    if (this._insAsk) {
      ui.hint('');
      ui.setButtons([
        chipButton(tt(this._insAsk.evenMoney ? 'evenMoney' : 'insurance'), () => this._insAsk?.resolve(true), { color: 'gold', key: 'Y' }),
        chipButton(tt('noInsurance'), () => this._insAsk?.resolve(false), { color: 'black', key: 'N' }),
      ]);
      return;
    }
    if (this._turn) {
      const { hand, legal } = this._turn;
      const afford = this.myTotal >= hand.bet;
      const dbl = chipButton(tt('double'), () => this._turn?.resolve('D'), { color: 'blue', key: 'D' });
      const spl = chipButton(tt('split'), () => this._turn?.resolve('P'), { color: 'purple', key: 'Q' });
      dbl.disabled = !(legal.double && afford);
      spl.disabled = !(legal.split && afford);
      ui.hint(tt('hintTurn'));
      ui.setButtons([
        chipButton(tt('hit'), () => this._turn?.resolve('H'), { color: 'green', key: 'H' }),
        chipButton(tt('stand'), () => this._turn?.resolve('S'), { color: '', key: 'S' }),
        dbl,
        spl,
      ]);
      return;
    }
    if (this.phase === 'betting' && !this._dealRequested && !this._changing) {
      const has = this.myTotal > 0 || spot.betPile;
      ui.hint(has ? tt('hintBet') : tt('noChips'));
      const deal = chipButton(tt('deal'), () => this._requestDeal(), { color: 'green', key: 'Space' });
      deal.disabled = !spot.betPile;
      const rebet = chipButton(tt('rebet'), () => this._rebet(), { color: 'blue', key: 'R', small: true });
      rebet.disabled = !spot.lastBet || !!spot.betPile || this.myTotal < spot.lastBet;
      const clear = chipButton(tt('clear'), () => this._clearBet(), { color: 'black', key: 'C', small: true });
      clear.disabled = !spot.betPile;
      const allin = chipButton(tt('allIn'), () => this._allIn(), { color: 'gold', small: true });
      allin.disabled = this.myTotal <= 0;
      const change = chipButton(tt('change'), () => this._openChange(), { wide: true });
      ui.setButtons([change, clear, rebet, deal, allin]);
      return;
    }
    ui.hint(this.phase === 'playing' || this.phase === 'dealing' ? tt('waitTurn') : '');
    ui.setButtons([]);
  }

  sessionUpdate() {
    // Esc is handled by the Station; keep the camera on our close-up.
    void input;
  }

  dispose() {
    this.engine.renderer.domElement.removeEventListener('contextmenu', this._ctx);
    window.removeEventListener('keydown', this._keys);
    for (const s of this.spots) {
      for (const p of s.stacks) p.clear();
      s.betPile?.clear();
    }
    super.dispose();
  }
}

export function createBlackjackTable(opts) {
  return new BlackjackTable(opts);
}
void valueOfKind;
