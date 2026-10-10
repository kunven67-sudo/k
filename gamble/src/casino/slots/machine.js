// SlotMachine: one playable cabinet (a Station with one stool). Owns the money on the machine
// (balance in cents, persisted per machine — forgotten credits stay), the bet, the spin director
// (reels, tease, wins, rollups, free spins, hold & spin, big-win celebrations, hand pays), bill /
// TITO handling, cash out, 3D button / lever picking and NPC play.
//
// Static geometry lives in the bank (merged); the machine drives its own screen (video), its
// drums (stepper), its LED/candle slot in the bank's LED uniforms and its deck-button instances.

import * as THREE from 'three';
import { Station } from '../station.js';
import { tickets } from '../tickets.js';
import { bus } from '../../core/events.js';
import { t } from '../../core/i18n.js';
import { save } from '../../core/save.js';
import { Rng } from '../../core/rng.js';
import { addCash, slice } from '../../life/state.js';
import { spinVideo, spinStepper, pearlFace, VIDEO_PARS, CLASSIC_PARS } from './math/index.js';
import { VideoScreen, fmt$ } from './screen.js';
import { machineSound } from './sound.js';
import { buildSlotUI } from './ui.js';
import { openHandPay } from './handpay.js';
import './strings.js';

export const HANDPAY_LIMIT = 1200;
const STEPPER_SPIN = 2.6; // stops per frame-second at full speed (drums)

save.registerSlice?.('slots', { create: () => ({ balances: {} }) });
const memBalances = {};
function balances() {
  const s = save.slice?.('slots');
  if (s) {
    s.balances ||= {};
    return s.balances;
  }
  return memBalances;
}

const ss = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export class SlotMachine extends Station {
  constructor(o) {
    const { engine, id, casino, group, bank, index, theme, variant, denom, cab, seat } = o;
    super({ engine, id, casino, group, seats: [seat], label: theme });
    this.bank = bank;
    this.index = index;
    this.theme = theme;
    this.variant = variant; // 'single' | 'three' for steppers
    this.kind = theme === 'classic-fruit' ? 'stepper' : 'video';
    this.denom = denom;
    this.denomCents = Math.round(denom * 100);
    this.cab = cab;
    this.par = this.kind === 'video' ? VIDEO_PARS[theme] : CLASSIC_PARS[variant];
    this.rng = new Rng(`${id}|look`);
    // bet
    if (this.kind === 'video') {
      this.lineIdx = this.par.lineChoices ? this.par.lineChoices.length - 1 : 0;
      this.betIdx = 0;
    } else this.coins = 1;
    this.phase = 'idle'; // idle | spin | handpay | cashout
    this.lastWinCredits = 0;
    this.lastWins = [];
    this._timers = [];
    this.skip = false;
    this.npc = null; // { human, next, mood }
    this.ledMode = 3;
    this._ledFlash = 0;
    this._pressAnim = [];
    this._handTimer = 0;
    this.drums = null; // stepper drum states
    this.screen = null; // video: VideoScreen when active / NPC / credits on machine
    this._drawAcc = 0;
    this._stoolDisabled = false;
    if (this.kind === 'stepper') {
      this.drums = [0, 1, 2].map((r) => ({ pos: (r * 7 + index * 3) % 22, vel: 0, anim: null }));
      this.lever = { angle: this.cab.anchors.lever.rest, target: null, drag: null };
    }
  }

  // ---- money --------------------------------------------------------------------------------------

  get balance() {
    return balances()[this.id] || 0;
  }

  set balance(cents) {
    const b = balances();
    if (cents > 0) b[this.id] = Math.round(cents);
    else delete b[this.id];
    save.markDirty?.();
  }

  get credits() {
    return Math.floor(this.balance / this.denomCents);
  }

  /** Total bet in credits for the current bet setting. */
  betCredits() {
    if (this.kind === 'stepper') return this.coins;
    if (this.par.kind === 'ways') return this.par.betChoices[this.betIdx] * this.par.waysUnit;
    return this.par.lineChoices[this.lineIdx] * this.par.betChoices[this.betIdx];
  }

  get lines() {
    return this.par.kind === 'lines' ? this.par.lineChoices[this.lineIdx] : 0;
  }

  dollars(credits) {
    return (credits * this.denomCents) / 100;
  }

  // ---- world helpers ------------------------------------------------------------------------------

  soundPos() {
    return this.toWorld(this.cab.anchors.screenCenter, this._sp || (this._sp = new THREE.Vector3()));
  }

  get worldCenter() {
    return this.toWorld(this.cab.anchors.screenCenter, this._wc || (this._wc = new THREE.Vector3()));
  }

  wait(sec) {
    if (this.skip || sec <= 0) return Promise.resolve();
    return new Promise((resolve) => this._timers.push({ t: sec, resolve }));
  }

  after(sec, fn) {
    this._timers.push({ t: sec, resolve: fn, hard: true });
  }

  _tickTimers(dt) {
    if (!this._timers.length) return;
    const due = [];
    for (const tm of this._timers) {
      tm.t -= dt;
      if (tm.t <= 0 || (this.skip && !tm.hard)) due.push(tm);
    }
    if (due.length) {
      this._timers = this._timers.filter((x) => !due.includes(x));
      for (const tm of due) tm.resolve();
    }
  }

  sound(name, opts) {
    return machineSound(this, name, opts);
  }

  setLed(mode, dur = 0) {
    this.ledMode = mode;
    this._ledHold = dur;
    this.bank.setLed(this.index, { mode });
  }

  // ---- screens ------------------------------------------------------------------------------------

  /** Make sure this machine has its own screen (player, NPC, or credits showing). */
  ensureScreen(scale) {
    if (this.kind !== 'video') return null;
    if (!this.screen || (scale && this.screen.scale !== scale)) {
      const old = this.screen;
      this.screen = new VideoScreen(this.theme, { scale: scale || this.bank.screenScale(false), denom: this.denom });
      if (old) {
        this.screen.setStops(old.reels.map((R) => Math.round(R.pos) + 1));
        old.dispose();
      } else this.screen.setStops(this.bank.idleStops(this));
      this._syncMeters();
      this.bank.useScreen(this, this.screen.texture);
    }
    return this.screen;
  }

  releaseScreen() {
    if (!this.screen || this.active || this.npc || this.balance > 0 || this.phase !== 'idle') return;
    this.screen.dispose();
    this.screen = null;
    this.bank.useScreen(this, null);
  }

  _syncMeters() {
    const sc = this.screen;
    if (sc) {
      sc.setMeters({
        credit: this.balance / 100,
        bet: this.dollars(this.betCredits()),
        win: this.dollars(this.lastWinCredits),
        lines: this.lines,
        betPerLine: this.par.kind === 'lines' ? this.par.betChoices[this.betIdx] : 0,
        mult: this.par.kind === 'ways' ? this.par.betChoices[this.betIdx] : 1,
      });
      if (sc.mode !== 'paytable' && this.phase === 'idle' && !sc.win) {
        sc.setMessage(this.balance > 0 ? t('slots.screen.press') : t('slots.screen.insert'), '');
      }
    }
    this._meterPaid ??= 0;
    this.ui?.refresh?.();
  }

  // ---- seating ------------------------------------------------------------------------------------

  sit(player, index = 0) {
    if (this.npc) {
      bus.emit('casino:seat-taken', { station: this, seat: index });
      return false;
    }
    const ok = super.sit(player, index);
    if (ok) this.bank.setStoolCollider(this, false);
    return ok;
  }

  onSit() {
    this.ensureScreen(this.bank.screenScale(true));
    this.ui = this.ui || null;
    this.uiCtl = buildSlotUI(this);
    this._keys = (e) => this._onKey(e);
    window.addEventListener('keydown', this._keys);
    this.setLed(0);
    this._syncMeters();
    if (this.balance > 0) this.screen?.setMessage(t('slots.screen.press'));
    this._camForAspect(true);
  }

  canStand() {
    return this.phase === 'idle' || this.phase === 'cashout';
  }

  onStand() {
    window.removeEventListener('keydown', this._keys);
    this.uiCtl?.dispose();
    this.uiCtl = null;
    this.player?.human?.setHandTarget?.('R', null);
    this.player?.human?.setHandTarget?.('L', null);
    if (this.screen) this.screen.mode = 'reels';
    this.setLed(3);
    if (this.balance > 0) {
      bus.emit('slots:forgotten', { machine: this.id, amount: this.balance / 100, position: this.worldCenter.clone() });
      floatToast(this.engine, t('slots.ui.creditsLeft', { amt: fmt$(this.balance / 100) }));
    }
  }

  _finishStand() {
    const pl = this.player;
    super._finishStand();
    this._standingPlayer = pl;
  }

  _camForAspect(snap = false) {
    const cam = this.player?.camera;
    const aspect = cam?.aspect || 1.6;
    const c = this.cab.camera;
    // narrow (phone portrait) screens: step back so the whole machine face fits
    const k = THREE.MathUtils.clamp((1.35 - aspect) / 0.9, 0, 1);
    const pos = c.pos.clone().lerp(c.posNarrow, k);
    const tgt = c.target.clone().lerp(c.targetNarrow, k);
    if (this._focus === 'screen' && c.screenPos) {
      pos.copy(c.screenPos).lerp(c.screenPosNarrow, k);
      tgt.copy(c.screenTarget);
    }
    this.setCamGoal(pos, tgt, snap);
    this._camAspect = aspect;
  }

  toggleFocus() {
    this._focus = this._focus === 'screen' ? null : 'screen';
    this._camForAspect();
  }

  toast(msg) {
    this.uiCtl?.toast(msg);
  }

  // ---- input ----------------------------------------------------------------------------------------

  _onKey(e) {
    if (!this.active || this._blend) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.code;
    if (k === 'Space' || k === 'Enter') {
      e.preventDefault();
      this.press(this.kind === 'stepper' ? 'lever' : 'spin');
    } else if (k === 'ArrowUp') this.press(this.kind === 'stepper' ? 'betone' : 'betplus');
    else if (k === 'ArrowDown') this.press(this.kind === 'stepper' ? 'betone' : 'betminus');
    else if (k === 'KeyL') this.press('lines');
    else if (k === 'KeyM') this.press(this.kind === 'stepper' ? 'betmax' : 'maxbet');
    else if (k === 'KeyP') this.press('help');
    else if (k === 'KeyC') this.press('cashout');
    else if (k === 'KeyF') this.toggleFocus();
  }

  onPointer(type, ray, ev) {
    if (type === 'down') {
      const hit = this.bank.pick(this, ray);
      if (!hit) return;
      if (hit.type === 'lever') {
        this.lever.drag = { y0: ev.clientY, a: 0 };
        return;
      }
      if (hit.type === 'bill') return this.uiCtl?.openWallet();
      if (hit.type === 'screen') {
        if (this.screen?.mode === 'paytable') this.press('help');
        else if (this.phase === 'spin') this.skip = true;
        return;
      }
      this.press(hit.type);
    } else if (type === 'move' && this.lever?.drag) {
      const d = this.lever.drag;
      d.a = THREE.MathUtils.clamp((ev.clientY - d.y0) / (innerHeight * 0.22), 0, 1);
    } else if (type === 'up' && this.lever?.drag) {
      const d = this.lever.drag;
      this.lever.drag = null;
      if (d.a > 0.62) this.pullLever(d.a);
      else if (d.a < 0.08 && performance.now() - (this._lastClick || 0) < 400) this.pullLever(0);
      this._lastClick = performance.now();
    }
  }

  /** A deck button (3D, keyboard or the on-screen bar). */
  press(type) {
    if (this.phase === 'handpay') return this.toast(t('slots.ui.locked'));
    if (type !== 'lever') {
      this.bank.pressButton(this, type);
      this._reachFor(type);
      this.sound('slot.button', { gain: 0.8, rate: 0.95 + Math.random() * 0.1 });
    }
    switch (type) {
      case 'spin':
      case 'repeat':
        if (this.phase === 'spin') this.skip = true;
        else this.spin();
        break;
      case 'lever':
        this.pullLever(0);
        break;
      case 'betplus':
      case 'betminus':
        if (this.phase !== 'idle') return;
        this.betIdx = THREE.MathUtils.clamp(this.betIdx + (type === 'betplus' ? 1 : -1), 0, this.par.betChoices.length - 1);
        this._clearWinShow();
        this._syncMeters();
        break;
      case 'lines':
        if (this.phase !== 'idle' || this.par.kind !== 'lines') return;
        this.lineIdx = (this.lineIdx + 1) % this.par.lineChoices.length;
        this._clearWinShow();
        this._syncMeters();
        this._showLinesPreview();
        break;
      case 'maxbet':
        if (this.phase !== 'idle') return;
        this.betIdx = this.par.betChoices.length - 1;
        if (this.par.kind === 'lines') this.lineIdx = this.par.lineChoices.length - 1;
        this._syncMeters();
        this.spin();
        break;
      case 'betone':
        if (this.phase !== 'idle') return;
        this.coins = (this.coins % this.par.maxCoins) + 1;
        this.sound('slots.rollup', { rate: 0.8 + this.coins * 0.15, gain: 0.6 });
        this._syncMeters();
        break;
      case 'betmax':
        if (this.phase !== 'idle') return;
        this.coins = this.par.maxCoins;
        this._syncMeters();
        break;
      case 'help':
        if (!this.screen) break;
        this.screen.mode = this.screen.mode === 'paytable' ? 'reels' : 'paytable';
        this.screen.dirty = true;
        break;
      case 'service':
        this._service = !this._service;
        this.bank.setLed(this.index, { service: this._service });
        if (this.screen) this.screen.setMessage(this._service ? t('slots.screen.service') : '');
        break;
      case 'cashout':
        this.cashOut();
        break;
      default:
    }
  }

  _reachFor(type) {
    const h = this.player?.human;
    if (!h?.setHandTarget) return;
    const p = this.bank.buttonWorldPos(this, type);
    if (!p) return;
    h.setHandTarget('R', p.add(new THREE.Vector3(0, 0.03, 0)));
    this._handTimer = 0.45;
  }

  _showLinesPreview() {
    const sc = this.screen;
    if (!sc) return;
    sc.win = { cells: new Set(), line: null, lines: Array.from({ length: this.lines }, (_, i) => i), text: t('slots.screen.lines', { n: this.lines, b: this.par.betChoices[this.betIdx] }), color: '#fff', t0: sc.time };
    sc.dirty = true;
    this.after(1.4, () => {
      if (this.phase === 'idle' && sc.win?.text?.includes(String(this.lines))) sc.clearWin();
    });
  }

  _clearWinShow() {
    this.lastWins = [];
    this.screen?.clearWin();
  }

  // ---- money in / out -------------------------------------------------------------------------------

  /** Insert a bill from pocket cash. Returns false if short / busy. */
  async insertBill(amount) {
    if (this.phase === 'handpay' || this._inserting) return false;
    if (!addCash(-amount, 'slot machine')) {
      this.toast(t('slots.ui.notEnough'));
      return false;
    }
    this._inserting = true;
    this.sound('cash.bill', { gain: 0.7 });
    this.bank.animateBill(this, amount);
    this.after(0.25, () => this.sound('slots.bill-in', { gain: 0.8 }));
    await this.wait(1.25);
    this._inserting = false;
    this.balance = this.balance + amount * 100;
    this.sound('slots.rollup', { rate: 1.2, gain: 0.7 });
    this._syncMeters();
    this.ensureScreen();
    return true;
  }

  /** Insert a TITO ticket (object from tickets.list()). */
  async insertTicket(ticket) {
    if (this.phase === 'handpay' || this._inserting) return false;
    if (!tickets.isValid(ticket, this.casino)) {
      this.toast(ticket.casino !== this.casino ? t('slots.ui.ticketOther') : t('slots.ui.ticketBad'));
      return false;
    }
    const tk = tickets.take(ticket.id, this.id);
    if (!tk) return false;
    this._inserting = true;
    this.bank.animateBill(this, 0, true);
    this.after(0.2, () => this.sound('slots.bill-in', { gain: 0.8, rate: 1.1 }));
    await this.wait(1.2);
    this._inserting = false;
    this.balance = this.balance + Math.round(tk.amount * 100);
    this.sound('slots.rollup', { rate: 1.2, gain: 0.7 });
    this._syncMeters();
    return true;
  }

  /** Print the whole balance as a ticket. */
  async cashOut() {
    if (this.phase !== 'idle' || this.balance <= 0) return;
    this.phase = 'cashout';
    const amount = this.balance / 100;
    this.screen?.setMessage(t('slots.screen.ticket', { amt: fmt$(amount) }));
    this.sound('slot.ticket-print', { gain: 0.9 });
    this.bank.animateTicket(this);
    await this.wait(1.5);
    this.balance = 0;
    this.lastWinCredits = 0;
    if (this.npc) {
      this.npc.pocket = (this.npc.pocket || 0) + amount;
    } else {
      const tk = tickets.print(amount, { casino: this.casino, machine: this.id });
      this.toast(t('slots.ui.ticketPrinted', { amt: fmt$(tk.amount) }));
      this.screen?.setMessage(t('slots.screen.cashedOut', { amt: fmt$(amount) }));
    }
    this.phase = 'idle';
    this._syncMeters();
  }

  // ---- the spin ------------------------------------------------------------------------------------

  spin() {
    if (this.phase !== 'idle') return;
    if (this.kind === 'stepper') return this.pullLever(0);
    const bet = this.betCredits();
    if (this.credits < bet) {
      this.screen?.setMessage(t('slots.screen.noCredit'));
      this.sound('ui.error', { gain: 0.4 });
      this.uiCtl?.nudgeWallet();
      return;
    }
    this._runVideo(bet).catch((e) => {
      console.error('[slots] spin failed', e);
      this.phase = 'idle';
    });
  }

  async _runVideo(bet) {
    const sc = this.ensureScreen();
    this.phase = 'spin';
    this.skip = false;
    sc.mode = 'reels';
    sc.freeInfo = null;
    sc.cells.fill(null);
    this._clearWinShow();
    this.balance -= bet * this.denomCents;
    this.lastWinCredits = 0;
    this._syncMeters();
    const res = spinVideo(this.theme, this.lines);
    this._lastResult = res;
    sc.setMessage(t('slots.screen.goodLuck'));
    if (!this.npc) this.setLed(1);
    this._pearlLabels(sc, res.landed, res.holdSpin, bet);
    const won = await this._playGrid(sc, res, 'base', bet);
    let total = won;
    // features
    if (res.freeGame) total += await this._playFree(sc, res, bet, total);
    if (res.holdSpin) total += await this._playHold(sc, res.holdSpin, bet);
    // exact award = engine total (avoids rounding drift between presentation pieces)
    const award = Math.round(res.total * bet);
    if (award !== total) this.lastWinCredits = award;
    await this._finishSpin(bet, award);
  }

  /** Label pearls on a grid: real values if they start the hold & spin, cosmetic otherwise. */
  _pearlLabels(sc, grid, hold, bet) {
    if (this.theme !== 'dragon') return;
    const C = sc.m.idx.C;
    grid.forEach((sym, c) => {
      if (sym !== C) return;
      let v;
      let label;
      if (hold?.values?.[c]) {
        v = hold.values[c];
        label = hold.labels[c];
      } else {
        const f = pearlFace();
        v = f.x;
        label = f.label;
      }
      sc.cells[c] = { key: null, label: label || fmt$(this.dollars(v * bet)) };
    });
  }

  /** Spin the reels to a result grid and present its wins. Returns credits won (incl. scatter). */
  async _playGrid(sc, r, set, bet, { sticky = null, mult = 1 } = {}) {
    sc.spinStart(set);
    const spinLoop = this.sound('slot.reel-spin', { loop: true, gain: 0.18, rate: 1.35 });
    await this.wait(this.npc ? 0.5 : 0.42);
    const S = sc.m.S;
    const C = sc.m.C;
    let scat = 0;
    let coins = 0;
    let teaseHandle = null;
    for (let i = 0; i < 5; i++) {
      // tease the remaining reels when a feature is one symbol away
      const canScatter = sc.m.strips[set][i].keys.includes('S');
      const tease = !this.skip && ((scat >= 2 && canScatter) || (this.theme === 'dragon' && coins >= 4 && i >= 2));
      if (tease && !teaseHandle) {
        teaseHandle = this.sound('slots.tease', { loop: true, gain: 0.45 });
        sc.setMessage(t('slots.screen.tease'));
      }
      const dur = sc.stopReel(i, r.stops[i], { extra: tease ? 1.3 : 0, tease });
      const landed = r.landed.slice(i * 3, i * 3 + 3);
      const sHere = landed.filter((x) => x === S).length;
      const cHere = landed.filter((x) => x === C).length;
      this.after(dur, () => {
        this.sound('slots.video-stop', { gain: 0.5, rate: 0.95 + i * 0.03 });
        if (sHere) this.sound('slots.scatter', { gain: 0.6, rate: 1 + (scat + sHere) * 0.08 });
        if (cHere) this.sound('slots.pearl', { gain: 0.35, rate: 1.1 + coins * 0.03 });
      });
      scat += sHere;
      coins += cHere;
      await this.wait(tease ? dur + 0.05 : Math.min(dur, 0.21));
    }
    while (sc.spinning) await this.waitFrame();
    spinLoop?.stop(0.12);
    teaseHandle?.stop(0.2);
    if (sticky) sticky.forEach((c) => (sc.cells[c] = { key: 'W', sticky: true }));
    // saucer beams expand one reel at a time
    for (const rr of r.expanded || []) {
      sc.expanded.add(rr);
      sc.dirty = true;
      this.sound('slots.expand', { gain: 0.7 });
      await this.wait(0.45);
    }
    if (mult > 1) {
      sc.setBanner(`× ${mult}`, '', 1.2);
      await this.wait(0.8);
    }
    const wins = r.wins || [];
    const won = wins.reduce((s, w) => s + this._winCredits(w, bet), 0);
    if (wins.length) await this._presentWins(sc, wins, won, bet);
    else sc.setMessage(set === 'free' ? '' : t('slots.screen.press'));
    return won;
  }

  _winCredits(w, bet) {
    if (w.kind === 'scatter') return Math.round(w.pay * bet);
    if (w.kind === 'ways') return Math.round((w.pay * bet) / this.par.waysUnit);
    return Math.round(w.pay * this.par.betChoices[this.betIdx]);
  }

  async _presentWins(sc, wins, credits, bet) {
    this.lastWins = wins;
    sc.showAllWins(wins);
    const ratio = credits / bet;
    const jingle = this.theme === 'classic-fruit' ? 'slot.win-small' : `slots.jingle.${this.theme}`;
    this.sound(ratio >= 5 ? 'slot.win-small' : jingle, { gain: 0.6 });
    if (!this.npc) this.setLed(1, 2);
    await this.rollup(this.lastWinCredits, this.lastWinCredits + credits, ratio, (v) => {
      this.lastWinCredits = v;
      sc.setMeters({ win: this.dollars(v) });
    });
    sc.setMessage(t('slots.screen.totalWin', { amt: fmt$(this.dollars(this.lastWinCredits)) }));
  }

  /** Count a meter up with ascending ticks. Slam (SPIN) skips to the end. */
  async rollup(from, to, ratio, set) {
    if (to <= from) return;
    const dur = this.skip ? 0 : ratio < 1 ? 0.5 : ratio < 5 ? 1.2 : ratio < 15 ? 2.4 : Math.min(8, 3 + ratio * 0.04);
    let tAcc = 0;
    let tick = 0;
    while (tAcc < dur && !this.skip) {
      const dt = await this.waitFrame();
      tAcc += dt;
      const u = Math.min(1, tAcc / dur);
      set(Math.round(from + (to - from) * u));
      tick += dt;
      if (tick > 0.075 && !this.npc) {
        tick = 0;
        this.sound('slots.rollup', { gain: 0.35, rate: 0.85 + u * 0.9 });
      }
    }
    set(to);
  }

  waitFrame() {
    return new Promise((resolve) => this._timers.push({ t: 0.0001, resolve: () => resolve(this._lastDt || 1 / 60), hard: true }));
  }

  async _playFree(sc, res, bet, baseWon) {
    const F = res.freeGame;
    const first = F.spins.length ? F.spins[0] : null;
    if (!first) return 0;
    this.skip = false;
    this.sound('slots.feature', { gain: 0.9 });
    if (!this.npc) this.setLed(2, 3);
    const n0 = this.par.scatter.spins[res.scatters] || F.spins.length;
    sc.setBanner(t('slots.screen.freeWon', { n: n0 }), this.theme === 'wild-west' ? t('slots.screen.sticky') : this.theme === 'space' ? t('slots.screen.expand') : t('slots.screen.hold'), 2.6);
    await this.wait(2.8);
    let total = 0;
    let shown = n0;
    for (let i = 0; i < F.spins.length; i++) {
      const s = F.spins[i];
      if (i + 1 + s.left > shown) {
        shown = i + 1 + s.left;
      }
      sc.freeInfo = { i: i + 1, n: Math.max(shown, i + 1 + s.left) };
      sc.cells.fill(null);
      const sticky = this.theme === 'wild-west' ? s.sticky.map((v, c) => (v ? c : -1)).filter((c) => c >= 0 && !(s.newSticky || []).includes(c)) : null;
      if (sticky) sticky.forEach((c) => (sc.cells[c] = { key: 'W', sticky: true }));
      this._pearlLabels(sc, s.landed, s.hold, bet);
      const won = await this._playGrid(sc, { ...s, stops: s.stops }, 'free', bet, { sticky: this.theme === 'wild-west' ? s.sticky.map((v, c) => (v ? c : -1)).filter((c) => c >= 0) : null, mult: s.mult });
      total += won;
      if (s.scatters >= 3 && this.par.scatter.retrigger) {
        this.sound('slots.feature', { gain: 0.7 });
        sc.setBanner(t('slots.screen.freeMore', { n: this.par.scatter.retrigger[s.scatters] }), '', 1.8);
        await this.wait(1.9);
      }
      if (s.hold) total += await this._playHold(sc, s.hold, bet);
      await this.wait(won ? 0.5 : 0.35);
    }
    sc.freeInfo = null;
    sc.cells.fill(null);
    sc.setBanner(t('slots.screen.freeTotal'), fmt$(this.dollars(total)), 2.6);
    await this.wait(2.6);
    void baseWon;
    return total;
  }

  async _playHold(sc, H, bet) {
    this.skip = false;
    this.sound('slots.feature', { gain: 0.9 });
    sc.setBanner(t('slots.screen.hold'), '', 2.2);
    await this.wait(2.2);
    sc.mode = 'hold';
    const cells = new Array(15).fill(null);
    const label = (c) => {
      const l = H.labels[c];
      return l || fmt$(this.dollars(H.values[c] * bet));
    };
    let total = 0;
    for (const c of H.steps[0].cells) {
      cells[c] = { label: label(c), t: sc.time };
      total += this.dollars(H.values[c] * bet);
    }
    sc.hold = { cells, respins: 3, total, spinning: false };
    await this.wait(1.0);
    for (let k = 1; k < H.steps.length; k++) {
      const st = H.steps[k];
      sc.hold.spinning = true;
      this.sound('slot.reel-spin', { gain: 0.15, rate: 1.6 });
      await this.wait(0.85);
      sc.hold.spinning = false;
      for (const c of st.cells) {
        cells[c] = { label: label(c), t: sc.time };
        sc.hold.total += this.dollars(H.values[c] * bet);
        this.sound('slots.pearl', { gain: 0.7, rate: 0.9 + Math.random() * 0.2 });
        await this.wait(0.22);
      }
      sc.hold.respins = st.respins;
      await this.wait(st.cells.length ? 0.45 : 0.3);
    }
    if (H.full) {
      this.sound('slot.win-big', { gain: 0.9 });
      sc.setBanner(t('slots.screen.major'), fmt$(this.dollars(H.fullAward * bet)), 3);
      await this.wait(3);
    }
    const won = Math.round(H.total * bet);
    sc.setBanner(t('slots.screen.holdTotal'), fmt$(this.dollars(won)), 2.4);
    await this.rollup(this.lastWinCredits, this.lastWinCredits + won, H.total, (v) => {
      this.lastWinCredits = v;
      sc.setMeters({ win: this.dollars(v) });
    });
    await this.wait(1.2);
    sc.mode = 'reels';
    sc.hold = null;
    sc.cells.fill(null);
    return won;
  }

  /** Award (credits), big-win celebration, hand pay or credit meter, events. */
  async _finishSpin(bet, award) {
    const sc = this.screen;
    const dollars = this.dollars(award);
    const betDollars = this.dollars(bet);
    if (dollars >= HANDPAY_LIMIT) {
      await this.handPay(award);
    } else {
      const ratio = award / bet;
      if (ratio >= 15) {
        const label = ratio >= 100 ? t('slots.screen.megaWin') : ratio >= 40 ? t('slots.screen.hugeWin') : t('slots.screen.bigWin');
        sc?.bigWin(label, dollars);
        this.sound('slot.win-big', { gain: 0.9 });
        if (this.kind === 'stepper' || ratio >= 40) this._hopper = this.sound('slot.coin-hopper', { loop: true, gain: 0.25 });
        this.setLed(2, 5);
        this.skip = false;
        await this.wait(Math.min(7, 3 + ratio * 0.03));
        sc?.bigWin(null);
        this._hopper?.stop(0.4);
        this._hopper = null;
        if (this.npc) this.npc.human?.play?.('cheer');
      }
      this.balance = this.balance + award * this.denomCents;
    }
    this.lastWinCredits = award;
    this.phase = 'idle';
    this.skip = false;
    if (!this.npc) {
      this.setLed(0);
      bus.emit('gamble:result', { game: 'slots', theme: this.theme, machine: this.id, bet: betDollars, payout: dollars, net: dollars - betDollars });
    } else this.setLed(3);
    this._syncMeters();
    if (sc && this.lastWins.length && award > 0) sc.setMessage(t('slots.screen.totalWin', { amt: fmt$(dollars) }));
    this._cycle = { i: 0, t: 1.4 };
    this.npcReact?.(award, bet);
  }

  // ---- hand pay ---------------------------------------------------------------------------------------

  async handPay(credits) {
    const amount = this.dollars(credits);
    this.phase = 'handpay';
    this.skip = false;
    const sc = this.screen;
    if (sc) sc.lockText = t('slots.screen.handpayAmt', { amt: fmt$(amount) });
    this.bank.setLed(this.index, { mode: 2, flash: true, service: true });
    this._siren = this.sound('slot.jackpot-siren', { loop: true, gain: this.npc ? 0.6 : 0.7, positional: true });
    const pos = this.worldCenter.clone();
    bus.emit('jackpot', { game: 'slots', amount, position: pos, machine: this.id, npc: !!this.npc });
    // Lane A's attendant walks over and answers with 'slots:attendant-arrived'; fall back to a
    // timed arrival when nobody is listening (dev pages, empty floors).
    let arrived = false;
    const off = bus.on('slots:attendant-arrived', (e) => {
      if (!e || e.machine === this.id) arrived = true;
    });
    bus.emit('slots:handpay', { machine: this.id, amount, position: pos, station: this });
    this.toast(t('slots.ui.attendantComing'));
    let waited = 0;
    while (!arrived && waited < (this.npc ? 10 : 8)) waited += await this.waitFrame();
    off?.();
    this._siren?.stop(0.6);
    this._siren = null;
    if (this.npc) {
      this.npc.pocket = (this.npc.pocket || 0) + amount;
      this.npc.human?.play?.('cheer');
    } else {
      const res = await openHandPay(this, amount);
      addCash(res.net, 'slot jackpot hand pay');
      bus.emit('slots:handpaid', { machine: this.id, amount, withheld: res.withheld, net: res.net });
    }
    if (sc) sc.lockText = null;
    this.bank.setLed(this.index, { mode: this.npc ? 3 : 0, flash: false, service: false });
    this.phase = 'idle';
  }

  // ---- stepper -----------------------------------------------------------------------------------------

  /** Pull the lever (drag amount a already applied when dragged by hand). */
  pullLever(from = 0) {
    if (this.kind !== 'stepper' || this.phase !== 'idle') return;
    if (this.credits < this.coins) {
      this.sound('ui.error', { gain: 0.4 });
      this.uiCtl?.nudgeWallet();
      this.bank.meterBlink(this, 1.2);
      return;
    }
    this._runStepper(from).catch((e) => {
      console.error('[slots] lever failed', e);
      this.phase = 'idle';
    });
  }

  async _runStepper(from) {
    this.phase = 'spin';
    this.skip = false;
    const coins = this.coins;
    this.balance -= coins * this.denomCents;
    this.lastWinCredits = 0;
    this._meterPaid = 0;
    this._syncMeters();
    const res = spinStepper(this.variant, coins);
    // the arm: from wherever the hand left it, down to the stop, then the spring returns it
    const human = this.npc ? this.npc.human : this.player?.human;
    human?.play?.('pull-lever', { side: 'R', speed: from > 0.5 ? 1.6 : 1 });
    const L = this.lever;
    L.anim = { t: from > 0.5 ? 0.55 : 0, from };
    this.sound('slot.lever', { gain: 0.9 });
    if (!this.npc) this.setLed(1);
    await this.wait(from > 0.5 ? 0.2 : 0.62);
    const loop = this.sound('slot.reel-spin', { loop: true, gain: 0.45 });
    this.drums.forEach((d, i) => (d.anim = { kind: 'start', t: -i * 0.05 }));
    await this.wait(this.npc ? 0.8 : 1.0);
    for (let i = 0; i < 3; i++) {
      const dur = this._stopDrum(i, res.stops[i]);
      this.after(dur, () => this.sound('slot.reel-stop', { gain: 0.8, rate: 0.95 + i * 0.04 }));
      await this.wait(i < 2 ? 0.42 : dur);
    }
    while (this.drums.some((d) => d.anim)) await this.waitFrame();
    loop?.stop(0.1);
    const award = res.win;
    if (award > 0) {
      this.bank.flashPaylines(this, res.lines.map((l) => l.row));
      if (res.top) {
        this.sound('slot.jackpot-siren', { gain: 0.6 });
        this.setLed(2, 4);
      }
      if (this.dollars(award) < HANDPAY_LIMIT) {
        // classic bell: one ding per credit, faster on bigger pays
        const step = Math.max(0.035, Math.min(0.16, 1.6 / award));
        for (let k = 1; k <= award; k++) {
          this._meterPaid = k;
          this.lastWinCredits = k;
          if (!this.skip && (award < 60 || k % Math.ceil(award / 60) === 0)) this.sound('slot.ding', { gain: this.npc ? 0.4 : 0.35, rate: 1 + (k % 2) * 0.12 });
          await this.wait(step);
          if (this.skip) break;
        }
      }
    }
    await this._finishSpin(coins, award);
    this._meterPaid = award;
  }

  _stopDrum(i, stop) {
    const d = this.drums[i];
    let dist = (((d.pos - stop) % 22) + 22) % 22;
    while (dist < 6) dist += 22;
    const dur = 0.18 + dist * 0.016;
    d.anim = { kind: 'stop', t: 0, from: d.pos, dist, dur, target: stop };
    return dur;
  }

  _updateDrums(dt) {
    let moving = false;
    this.drums.forEach((d, i) => {
      const a = d.anim;
      if (!a) return;
      moving = true;
      if (a.kind === 'start') {
        a.t += dt;
        if (a.t < 0) return;
        d.vel = Math.min(STEPPER_SPIN * 9, d.vel + dt * 120);
        d.pos -= d.vel * dt;
      } else {
        a.t += dt;
        const u = Math.min(1, a.t / a.dur);
        // constant speed, hard brake with a short mechanical bounce
        const k = u < 0.85 ? u / 0.85 * 0.985 : 0.985 + 0.015 * Math.sin(((u - 0.85) / 0.15) * Math.PI * 0.5);
        const bounce = u > 0.92 ? Math.sin(((u - 0.92) / 0.08) * Math.PI) * 0.06 : 0;
        d.pos = a.from - a.dist * k + bounce;
        d.vel = u < 0.85 ? a.dist / a.dur : 0;
        if (u >= 1) {
          d.pos = a.target;
          d.vel = 0;
          d.anim = null;
        }
      }
      this.bank.setDrum(this, i, d.pos, Math.min(1, Math.abs(d.vel) / 14));
    });
    return moving;
  }

  _updateLever(dt) {
    const L = this.lever;
    const A = this.cab.anchors.lever;
    const pulled = 1.15;
    let a = A.rest;
    if (L.anim) {
      L.anim.t += dt;
      const u = L.anim.t / 1.8;
      // matches the 'pull-lever' action: reach, pull (back-out), hold, release
      const pull = ss(0.3, 0.55, u) * (1 - ss(0.7, 0.95, u));
      const start = L.anim.from * (1 - ss(0.55, 0.75, u));
      a = A.rest + (pulled - A.rest) * Math.max(pull, start);
      if (u >= 1) L.anim = null;
    } else if (L.drag) {
      a = A.rest + (pulled - A.rest) * L.drag.a;
    }
    if (Math.abs(a - L.angle) > 1e-4) {
      L.angle = a;
      this.bank.setLever(this, a);
    }
    // the player's hand follows the knob while dragging
    const h = this.player?.human;
    if (L.drag && h?.setHandTarget) {
      h.setHandTarget('R', this.bank.leverKnobWorld(this));
      this._handTimer = 0.2;
    }
  }

  // ---- NPC play ----------------------------------------------------------------------------------------

  /** An NPC sits down and plays (visual + quiet sound). Returns false if the seat is taken. */
  seatNpc(human) {
    if (this.active || this.npc || this.seats[0].occupant) return false;
    const seat = this.seats[0];
    seat.occupant = 'npc';
    const r = new Rng(`${this.id}|${Date.now()}`);
    this.npc = { human, next: 2 + r.range(0, 4), pace: r.range(3.5, 8), r, losses: 0, pocket: 0 };
    human.root.position.copy(seat.pos);
    human.root.rotation.set(0, seat.yaw ?? Math.PI, 0);
    this.group.add(human.root);
    human.play?.('sit', { height: seat.height });
    this.bank.setStoolCollider(this, false);
    this.bank.setNpcCollider(this, true);
    // somebody left credits here: most people quietly cash them out and keep the ticket
    if (this.balance > 0) {
      const amt = this.balance / 100;
      this.after(1.5, () => {
        if (!this.npc) return;
        this.cashOut();
        bus.emit('slots:forgotten-taken', { machine: this.id, amount: amt });
      });
    }
    this.after(2.2, () => {
      if (this.npc && this.balance <= 0) this._npcFeed();
    });
    if (this.kind === 'video') this.ensureScreen(this.bank.screenScale(false));
    return true;
  }

  unseatNpc() {
    const n = this.npc;
    if (!n) return null;
    this.skip = true;
    if (this.phase === 'handpay') {
      this.phase = 'idle';
      this._siren?.stop(0.3);
    }
    // they cash out on the way out
    if (this.balance > 0) {
      n.pocket += this.balance / 100;
      this.balance = 0;
      this.sound('slot.ticket-print', { gain: 0.5 });
    }
    n.human.play?.('stand', { height: this.seats[0].height });
    n.human.setHandTarget?.('R', null);
    this.seats[0].occupant = null;
    this.npc = null;
    this.bank.setNpcCollider(this, false);
    this.bank.setStoolCollider(this, true);
    this.setLed(3);
    this.after(0.05, () => {
      this.skip = false;
    });
    this.after(2, () => this.releaseScreen());
    return n.human;
  }

  _npcFeed() {
    const n = this.npc;
    const bill = this.denom >= 1 ? 100 : this.denom >= 0.25 ? n.r.pick([20, 20, 100]) : n.r.pick([5, 20, 20]);
    this.bank.animateBill(this, bill);
    this.sound('slots.bill-in', { gain: 0.6 });
    this.after(1.2, () => {
      if (!this.npc) return;
      this.balance = this.balance + bill * 100;
      this._syncMeters();
    });
  }

  npcReact(award, bet) {
    const n = this.npc;
    if (!n) return;
    const h = n.human;
    if (award >= bet * 8) {
      h.play?.('cheer');
      h.setExpression?.('happy', 1);
      n.losses = 0;
    } else if (award === 0) {
      n.losses++;
      if (n.losses > 6 && n.r.chance(0.25)) {
        h.play?.('facepalm');
        h.setExpression?.('sad', 0.6);
        n.losses = 0;
      } else if (n.r.chance(0.12)) h.play?.('tap-table', { height: 0.95 });
    } else if (award > bet && n.r.chance(0.3)) h.setExpression?.('happy', 0.6);
  }

  _npcTick(dt) {
    const n = this.npc;
    n.next -= dt;
    if (n.next > 0 || this.phase !== 'idle' || this._inserting) return;
    n.next = n.pace * n.r.range(0.7, 1.4);
    if (this.kind === 'video') {
      if (this.credits < this.betCredits()) {
        if (this.betIdx > 0) this.betIdx = 0;
        else return this._npcFeed();
      }
      // reach and tap SPIN
      const p = this.bank.buttonWorldPos(this, 'spin');
      if (p && n.human.setHandTarget) {
        n.human.setHandTarget('R', p.add(new THREE.Vector3(0, 0.03, 0)));
        this.after(0.5, () => this.npc?.human.setHandTarget?.('R', null));
      }
      this.bank.pressButton(this, 'spin');
      this.after(0.25, () => {
        if (this.npc) this.spin();
      });
    } else {
      if (this.credits < this.coins) return this._npcFeed();
      this.coins = this.denom >= 1 ? 1 : this.par.maxCoins;
      this.pullLever(0);
    }
  }

  // ---- per frame ---------------------------------------------------------------------------------------

  sessionUpdate(dt) {
    const asp = this.player?.camera?.aspect;
    if (asp && Math.abs(asp - (this._camAspect || 0)) > 0.02) this._camForAspect();
    this.uiCtl?.update(dt);
  }

  idleUpdate(dt, ctx = {}) {
    this._lastDt = dt;
    this._tickTimers(dt);
    if (this._handTimer > 0) {
      this._handTimer -= dt;
      if (this._handTimer <= 0) this.player?.human?.setHandTarget?.('R', null);
    }
    if (this._ledHold > 0) {
      this._ledHold -= dt;
      if (this._ledHold <= 0 && this.phase !== 'handpay') this.setLed(this.active ? 0 : 3);
    }
    if (this.npc) this._npcTick(dt);
    if (this.kind === 'stepper') {
      this._updateDrums(dt);
      this._updateLever(dt);
      this.bank.setMeter(this, this.credits, this.coins, this._meterPaid ?? 0);
    }
    // stool collider comes back once the player has stepped away
    if (this._standingPlayer && !this.active) {
      const p = this._standingPlayer.position;
      const s = this.bank.stoolWorld(this);
      if (Math.hypot(p.x - s.x, p.z - s.z) > 0.55) {
        this.bank.setStoolCollider(this, true);
        this._standingPlayer = null;
      }
    }
    const sc = this.screen;
    if (sc) {
      sc.update(dt);
      // idle win cycling: show each winning line in turn
      if (this.phase === 'idle' && this.lastWins.length > 1 && this._cycle && sc.mode === 'reels') {
        this._cycle.t -= dt;
        if (this._cycle.t <= 0) {
          this._cycle.t = 1.3;
          const w = this.lastWins[this._cycle.i % this.lastWins.length];
          this._cycle.i++;
          sc.showWin(w, this._winCredits(w, this.betCredits()));
        }
      }
      const fps = this.bank.screenFps(this, ctx);
      this._drawAcc += dt;
      if (fps > 0 && this._drawAcc >= 1 / fps && (sc.dirty || sc.time - (sc._lastDraw || 0) > 0.5)) {
        this._drawAcc = 0;
        sc._lastDraw = sc.time;
        sc.draw();
      }
      if (!this.active && !this.npc && this.phase === 'idle' && this.balance <= 0 && !this._timers.length) this.releaseScreen();
    } else if (this.kind === 'video' && this.balance > 0) this.ensureScreen();
  }

  dispose() {
    window.removeEventListener('keydown', this._keys);
    this._siren?.stop(0.1);
    this._hopper?.stop(0.1);
    if (this.npc) this.unseatNpc();
    super.dispose();
    this.screen?.dispose();
  }
}

/** A short floating message over the game (used when the machine's own UI is gone). */
export function floatToast(engine, text) {
  const root = engine?.uiRoot || document.getElementById('ui-root');
  if (!root) return;
  const d = document.createElement('div');
  d.className = 'slots-float-toast';
  d.textContent = text;
  root.append(d);
  setTimeout(() => d.classList.add('out'), 2600);
  setTimeout(() => d.remove(), 3300);
}
