// Your body's real needs, with real physiology numbers for a ~75 kg adult. Everything runs on GAME
// time, so a short day setting makes you hungry sooner (like a day really passed).
//
//  Food energy: what you eat sits in your stomach, gets absorbed over a few hours into a ready
//    energy store (glycogen, ~2,000 kcal max), and you burn it by moving (MET rates: resting 1.3,
//    walking 3.5, jogging 7.5, sprinting 11, swimming 8). Run out and your body burns fat (7,700
//    kcal per kg). Real starvation takes weeks.
//  Water: you lose ~2.4 L a day just living, plus sweat when you work hard or it's hot. Thirsty at
//    ~1% of body water, real trouble at 4%, collapse ~10%, death ~15% (about 3 days with nothing).
//  Sleep: tired after ~16 h awake, exhausted at 24 h, micro-sleeps past 40 h. 8 h of sleep resets it.
//    Caffeine hides tiredness for a few hours (half-life ~5 h).
//  Food poisoning: raw chicken or spoiled food can make you sick a few hours later for about a day.

import { clamp } from '../core/noise.js';
import { settings } from '../core/settings.js';

const BODY_WATER_L = 45;          // ~60% of 75 kg
const GLYCOGEN_MAX = 2000;        // kcal
const KCAL_PER_KG_FAT = 7700;
const MET = { idle: 1.3, walk: 3.5, crouch: 4, jog: 7.5, sprint: 11, swim: 8, sleep: 0.95 };

export class Needs {
  constructor(player, clock, saved) {
    this.player = player;
    this.clock = clock;
    this.stomachKcal = 0;     // eaten, not absorbed yet
    this.stomachL = 0;        // how full your stomach is (liters of food + drink)
    this.reserve = 1300;      // ready energy (kcal)
    this.fatKg = 14;          // ~19% body fat
    this.waterDef = 0.3;      // liters short of fully hydrated
    this.awakeH = 3;          // hours since you woke up
    this.sleepDebtH = 0;
    this.caffeineMg = 0;
    this.sick = null;         // { name, onsetH, leftH, severity, vomitH }
    this.sleeping = null;     // { quality, startedMs }
    this.log = { day: -1, kcalIn: 0, kcalOut: 0, waterIn: 0, steps: 0, lastSleepH: 0 };
    this.events = [];
    this.t = 0;
    this.growlT = 60 + Math.random() * 60;
    this.yawnT = 30;
    if (saved) Object.assign(this, saved, { player, clock, events: [] });
  }

  get mode() { return this.player.godMode ? 'off' : settings.needs || 'real'; }
  get rate() { return this.mode === 'relaxed' ? 0.5 : 1; }

  // ---------- levels (0 = fine .. 1 = critical) ----------
  get hunger() { return clamp((1650 - this.reserve - this.stomachKcal * 0.8) / 1450, 0, 1); }
  get thirst() { return clamp(this.waterDef / (BODY_WATER_L * 0.07), 0, 1.5); }     // 1.0 = 7% short
  get dehydration() { return Math.max(0, this.waterDef) / BODY_WATER_L; }             // fraction of body water
  get tiredness() {
    const t = clamp((this.awakeH - 15) / 16, 0, 1.2) + this.sleepDebtH / 24;
    return clamp(t - Math.min(0.35, this.caffeineMg / 450), 0, 1.3);
  }
  get stuffed() { return this.stomachL > 1.6 || this.stomachKcal > 1500; }
  get nauseous() { return !!(this.sick && this.sick.onsetH <= 0); }

  words() {
    const hu = this.hunger, th = this.thirst, ti = this.tiredness;
    return {
      food: this.stuffed ? 'Stuffed' : hu < 0.15 ? 'Full' : hu < 0.4 ? 'Fine' : hu < 0.6 ? 'Peckish' : hu < 0.85 ? 'Hungry' : this.reserve <= 0 ? 'Starving' : 'Very hungry',
      water: th < 0.12 ? 'Hydrated' : th < 0.3 ? 'A bit thirsty' : th < 0.55 ? 'Thirsty' : th < 0.85 ? 'Dehydrated' : 'Severely dehydrated',
      sleep: this.sleeping ? 'Asleep' : ti < 0.1 ? 'Rested' : ti < 0.35 ? 'Awake' : ti < 0.6 ? 'Tired' : ti < 0.9 ? 'Exhausted' : 'Falling asleep',
      sick: this.sick ? (this.sick.onsetH > 0 ? null : `${this.sick.name} (~${Math.ceil(this.sick.leftH)} h left)`) : null,
    };
  }

  // ---------- eating + drinking ----------
  // portion of a food's nutrition (kcal, waterL, caffeineMg...) and how much room it takes (liters)
  consume(n, volumeL) {
    this.stomachKcal += n.kcal || 0;
    this.stomachL += volumeL;
    this.waterDef -= (n.waterL || 0) * 0.15; // a little hits right away (wet mouth); the rest absorbs
    this.pendingWater = (this.pendingWater || 0) + (n.waterL || 0) * 0.85;
    this.caffeineMg += n.caffeineMg || 0;
    this.rollLog();
    this.log.kcalIn += n.kcal || 0;
    this.log.waterIn += n.waterL || 0;
  }

  poison(severity = 0.6, name = 'Food poisoning') {
    if (this.sick && this.sick.severity >= severity) return;
    // symptoms show up hours later, last about a day (real: 2-6 h onset, 12-48 h)
    this.sick = { name, onsetH: 2 + Math.random() * 4, leftH: 14 + Math.random() * 18 * severity, severity, vomitH: 0 };
  }

  vomit() {
    const lostKcal = this.stomachKcal, lostL = this.stomachL;
    this.stomachKcal = 0; this.stomachL = 0;
    this.pendingWater = 0;
    this.waterDef += 0.35;
    this.events.push({ type: 'vomit', lostKcal, lostL });
  }

  rollLog() {
    const d = this.clock.dayOfYear();
    if (this.log.day !== d) this.log = { day: d, kcalIn: 0, kcalOut: 0, waterIn: 0, steps: 0, lastSleepH: this.log.lastSleepH || 0 };
  }

  // ---------- sleep ----------
  canSleep() { return this.tiredness > 0.12 || this.awakeH > 10; }

  startSleep(quality = 1) {
    this.sleeping = { quality, startH: 0, slept: 0 };
  }

  stopSleep() {
    if (!this.sleeping) return;
    this.log.lastSleepH = this.sleeping.slept;
    this.sleeping = null;
    this.events.push({ type: 'wake', groggy: this.tiredness > 0.25 });
  }

  // ---------- per frame ----------
  update(dt, moveMode) {
    if (this.mode === 'off' || this.player.dead) { this.applyEffects(dt, true); return; }
    const h = (dt * this.clock.rate) / 3600 * this.rate; // game hours (relaxed = half as fast)
    if (h <= 0) return;
    this.rollLog();
    const p = this.player;
    const asleep = !!this.sleeping;
    const met = asleep ? MET.sleep : MET[moveMode] ?? MET.idle;
    // burn
    const burn = met * 75 * h * (this.sick && this.sick.onsetH <= 0 ? 1.1 : 1);
    this.log.kcalOut += burn;
    this.reserve -= burn;
    // digest: big meals absorb faster at first, ~3-5 h for a full meal
    const absorb = Math.min(this.stomachKcal, (90 + this.stomachKcal * 0.35) * h);
    this.stomachKcal -= absorb;
    this.reserve += absorb;
    this.stomachL = Math.max(0, this.stomachL - (0.35 + this.stomachL * 0.5) * h);
    if (this.pendingWater > 0) { const w = Math.min(this.pendingWater, 0.9 * h); this.pendingWater -= w; this.waterDef -= w; }
    if (this.reserve > GLYCOGEN_MAX) { this.fatKg += (this.reserve - GLYCOGEN_MAX) * 0.85 / KCAL_PER_KG_FAT; this.reserve = GLYCOGEN_MAX; }
    if (this.reserve < 0) { this.fatKg += this.reserve / KCAL_PER_KG_FAT; this.reserve = 0; }
    // water out: ~0.1 L/h just living + sweat when working hard or hot
    const tempC = this.weatherTemp ?? 18;
    const heat = tempC > 25 ? 1 + (tempC - 25) / 8 : 1;
    this.waterDef += (0.1 + Math.max(0, met - 2) * 0.075 * heat) * h;
    this.waterDef = Math.max(-0.8, this.waterDef); // extra water just gets peed out
    // caffeine half-life ~5 h
    this.caffeineMg *= Math.pow(0.5, h / 5);
    // sleep
    if (asleep) {
      const q = this.sleeping.quality;
      this.sleeping.slept += h;
      if (this.awakeH > 0) this.awakeH = Math.max(0, this.awakeH - 2 * q * h);
      else this.sleepDebtH = Math.max(0, this.sleepDebtH - q * h);
      // you wake up on your own once rested, or if hunger/thirst gets bad
      if ((this.awakeH <= 0 && this.sleepDebtH <= 0.05) || this.sleeping.slept > 12 || this.thirst > 0.8 || this.hunger > 0.97 || (this.nauseous && this.sleeping.slept > 1)) this.stopSleep();
    } else {
      this.awakeH += h;
      if (this.awakeH > 18) this.sleepDebtH += h * 0.5;
    }
    // sickness
    if (this.sick) {
      const s = this.sick;
      if (s.onsetH > 0) { s.onsetH -= h; if (s.onsetH <= 0) this.events.push({ type: 'sickStart', name: s.name }); }
      else {
        s.leftH -= h;
        s.vomitH -= h;
        if (s.vomitH <= 0 && Math.random() < s.severity) { s.vomitH = 1.5 + Math.random() * 2.5; if (!asleep) this.vomit(); }
        else if (s.vomitH <= 0) s.vomitH = 2;
        if (s.leftH <= 0) { this.sick = null; this.events.push({ type: 'sickEnd' }); }
      }
    }
    // real danger (only if dying is possible in this world)
    if (!p.godMode) {
      const dehy = this.dehydration;
      if (dehy > 0.1) p.damage((dehy - 0.1) * 400 * h, 'dehydration');
      if (this.fatKg < 2) p.damage(20 * h, 'starvation');
    }
    this.applyEffects(dt, false);
  }

  // what you feel: slower recovery, less stamina, dizziness, yawns, heavy eyelids, a growling stomach
  applyEffects(dt, off) {
    const p = this.player;
    if (off) { p.regenMul = 1; p.staminaCap = 100; p.sway = 0; p.swayPitch = 0; this.blink = 0; return; }
    const hu = this.hunger, th = this.thirst, ti = this.tiredness;
    const sickNow = this.nauseous ? this.sick.severity : 0;
    let regen = 1, cap = 100;
    if (hu > 0.6) { regen *= 1 - (hu - 0.6) * 0.8; cap -= (hu - 0.6) * 50; }
    if (this.reserve <= 0) { regen *= 0.7; cap -= 15; }
    if (th > 0.3) { regen *= 1 - Math.min(0.6, (th - 0.3) * 0.75); cap -= Math.min(45, (th - 0.3) * 60); }
    if (ti > 0.4) { regen *= 1 - Math.min(0.4, (ti - 0.4) * 0.6); cap -= Math.min(30, (ti - 0.4) * 40); }
    if (sickNow) { regen *= 1 - sickNow * 0.4; cap -= sickNow * 25; }
    p.regenMul = clamp(regen, 0.15, 1);
    p.staminaCap = clamp(cap, 25, 100);
    // dizzy: dehydration + sickness make the world sway a little
    this.t += dt;
    const dizzy = Math.max(0, th - 0.5) * 0.9 + sickNow * 0.6 + Math.max(0, ti - 0.9) * 0.5;
    p.sway = Math.sin(this.t * 0.7) * 0.025 * dizzy + Math.sin(this.t * 1.9) * 0.008 * dizzy;
    p.swayPitch = Math.sin(this.t * 0.53) * 0.012 * dizzy;
    // heavy eyelids: slow blinks when exhausted, micro-sleeps past ~40 h awake
    this.blinkT = (this.blinkT ?? 4) - dt;
    if (this.blinkT <= 0) {
      this.blinkT = 3 + Math.random() * 6;
      if (ti > 0.6 && !this.sleeping) this.blinkDur = ti > 1 && Math.random() < 0.3 ? 1.4 : 0.35 + (ti - 0.6) * 0.5;
    }
    if (this.blinkDur > 0) { this.blinkDur -= dt; this.blink = Math.min(1, (this.blink || 0) + dt * 6); }
    else this.blink = Math.max(0, (this.blink || 0) - dt * 4);
    if (this.sleeping) return;
    // sounds you make
    this.growlT -= dt;
    if (this.growlT <= 0) { this.growlT = 45 + Math.random() * 90; if (hu > 0.55 && this.stomachKcal < 100) this.events.push({ type: 'growl', k: hu }); }
    this.yawnT -= dt;
    if (this.yawnT <= 0) { this.yawnT = 25 + Math.random() * 60 * (1.3 - Math.min(1, ti)); if (ti > 0.35) this.events.push({ type: 'yawn' }); }
  }

  respawn() {
    Object.assign(this, { stomachKcal: 0, stomachL: 0, reserve: 1200, waterDef: 0.4, awakeH: 2, sleepDebtH: 0, caffeineMg: 0, sick: null, sleeping: null, pendingWater: 0 });
    if (this.fatKg < 6) this.fatKg = 6;
  }

  serialize() {
    const { stomachKcal, stomachL, reserve, fatKg, waterDef, awakeH, sleepDebtH, caffeineMg, sick, log, pendingWater } = this;
    return { stomachKcal, stomachL, reserve, fatKg, waterDef, awakeH, sleepDebtH, caffeineMg, sick, log, pendingWater };
  }

  get weightKg() { return 61 + this.fatKg; }
}
