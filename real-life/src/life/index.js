// Life: ties your body, home and money to the clock. Needs tick every game minute, the house
// and stores move on every game hour, sleeping fast-forwards to morning, low needs have real
// effects (tired = blurry + slow, hungry = weak), and you grow up on your birthday.
//
//   const life = new Life({ engine, world, player, hud })
//   life.update(dt) every frame
//   life.skip(minutes, { sleeping, fade })   // time passes while you do something
//   life.sleep()                              // until morning

import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { clamp } from '../core/util.js';
import { me, NEEDS, NEED_LABEL } from './me.js';
import { Home } from './home.js';
import { Shopping } from './shopping.js';
import { panelOpen } from '../ui/panel.js';

export class Life {
  constructor({ engine, world, player, hud }) {
    this.engine = engine;
    this.world = world;
    this.player = player;
    this.hud = hud;
    this.me = me;
    this.home = new Home(world, player, hud, this);
    this.shopping = new Shopping(world, player, hud, this);
    this._lastTotal = clock.total;
    this._sleeping = false;
    this._offs = [
      bus.on('clock:hour', () => this._hourly()),
      bus.on('clock:birthday', ({ age }) => this._birthday(age)),
      bus.on('me:accident', () => this._accident()),
      bus.on('me:sick', () => (this._nauseaT = 0)),
    ];
    this._nauseaT = -1;
  }

  update(dt) {
    const mins = clock.total - this._lastTotal;
    this._lastTotal = clock.total;
    if (mins > 0 && mins < 60 * 30) {
      const c = this.player.controller;
      me.tick(mins, { sleeping: this._sleeping, running: c.sprinting, hot: this.world.season === 'summer' && !this.world.isIndoors(this.player.position) && clock.hour > 11 && clock.hour < 18 });
    }
    this.home.update(dt);
    this.shopping.update(dt);
    // Panels free the mouse and freeze you in place.
    this.player.locked = panelOpen() || this.phone?.isOpen || this._sleeping || this._busy;
    this._effects(dt);
    this.hud.setNeeds(NEEDS.map((id) => ({ id, label: NEED_LABEL[id], value: me.needs[id] })));
  }

  /** Real effects of your needs on your body. */
  _effects(dt) {
    const N = me.needs;
    const c = this.player.controller;
    const tired = clamp((0.22 - N.energy) / 0.22, 0, 1);
    const weak = clamp((0.15 - N.hunger) / 0.15, 0, 1);
    const sick = me.data.sick || 0;
    const kg = me.carryKg();
    // Carrying a lot (a 24-pack of water) slows you down, kids more than adults.
    const carry = clamp(kg / (clock.age < 13 ? 18 : 35), 0, 0.5);
    c.speedCap = 99 * (1 - tired * 0.3) * (1 - weak * 0.25) * (1 - sick * 0.3) * (1 - carry) || 99;
    if (tired > 0 || weak > 0 || sick > 0.2 || carry > 0.15) c.speedCap = Math.min(c.speedCap, 5.2 * (1 - tired * 0.45) * (1 - weak * 0.3) * (1 - sick * 0.35) * (1 - carry));
    this.engine.setBlur?.(Math.max(tired * 0.55, sick * 0.35));
    // Being sick as a kid after the beer: you throw up a little later.
    if (this._nauseaT >= 0) {
      this._nauseaT += dt;
      if (this._nauseaT > 25) {
        this._nauseaT = -1;
        me.restore('hunger', -0.25);
        me.restore('hygiene', -0.3);
        me.data.flags.threwUp = clock.dayIndex;
        this.hud.toast('You throw up. Gross. You feel a little better after.');
        bus.emit('rule:maybe', { rule: 'beer-sick', severity: 0.9, noise: 0.9, where: this.world.roomAt(this.player.position)?.id || 'outside' });
        me.data.sick = Math.max(0, me.data.sick - 0.3);
      }
    }
    // Pass out from exhaustion (you wake up where you dropped, hours later).
    if (N.energy <= 0.001 && !this._sleeping && !this._busy) {
      this.hud.toast('You can\'t keep your eyes open...');
      this.skip(6 * 60, { sleeping: true, fade: true });
      me.set('energy', 0.45);
    }
  }

  _hourly() {
    this.home.hourly();
    this.shopping.hourly();
    if (clock.hour === 0 || clock.hour === 12) save.commit();
  }

  _birthday(age) {
    this.player.setAge(age + 0.01);
    this.hud.toast(`Happy birthday! You're ${age} now.`, 5000);
    bus.emit('life:birthday', { age });
  }

  _accident() {
    me.set('bladder', 1);
    me.set('hygiene', 0.05);
    me.data.flags.accidents = (me.data.flags.accidents || 0) + 1;
    this.hud.toast("You couldn't hold it... You had an accident. So embarrassing. You need a shower and clean clothes.", 5500);
    bus.emit('rule:maybe', { rule: 'accident', severity: 0.2, noise: 1, where: this.world.roomAt(this.player.position)?.id || 'outside' });
  }

  /** Time passes while you do something (eat, shower...). Long skips fade to black. */
  skip(minutes, { sleeping = false, fade = false } = {}) {
    const run = () => {
      const wasSleeping = this._sleeping;
      this._sleeping = sleeping;
      clock.advance(minutes);
      // Needs for the skipped time.
      const mins = clock.total - this._lastTotal;
      this._lastTotal = clock.total;
      me.tick(mins, { sleeping });
      this._sleeping = wasSleeping;
    };
    if (!fade || minutes < 10) return run();
    this._busy = true;
    this.engine.fade?.(true, 500).then(() => {
      run();
      setTimeout(() => {
        this.engine.fade?.(false, 700);
        this._busy = false;
      }, 350);
    });
  }

  /** Sleep in your bed until morning (7 AM school days, 9 AM weekends, or when rested). */
  sleep() {
    const wake = clock.isSchoolDay ? 7 * 60 : 9 * 60;
    let mins = wake - clock.minutes;
    if (mins <= 0) mins += 24 * 60;
    if (clock.hour >= 9 && clock.hour < 19) mins = Math.min(mins, 90); // a daytime nap
    this._busy = true;
    this.engine.fade?.(true, 900).then(() => {
      this._sleeping = true;
      clock.advance(mins);
      const m = clock.total - this._lastTotal;
      this._lastTotal = clock.total;
      me.tick(m, { sleeping: true });
      this._sleeping = false;
      me.data.stats.daysLived++;
      save.commit();
      setTimeout(() => {
        this.engine.fade?.(false, 1200);
        this._busy = false;
        this.player.stand();
        this.hud.toast(`${clock.weekdayName} ${clock.timeText()}. ${me.needs.energy > 0.8 ? 'You feel rested.' : 'You\'re still tired.'}`);
      }, 700);
    });
  }

  dispose() {
    for (const off of this._offs) off();
  }
}
