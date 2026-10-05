// A physical body: anything with mass, from a pebble swarm to a black hole.
import {
  bodyRadius, compactReach, starTemp, starLuminosity, normalizeComp, classify, canFuse, compOf,
} from '../core/phys.js';
import { FORM, M_SUN, M_JUP, COMP_KEYS } from '../core/constants.js';

let NEXT_ID = 1;

export class Body {
  constructor(o) {
    this.id = NEXT_ID++;
    this.name = o.name || '';
    this.role = o.role || 'field'; // player | field | fragment | rails | star | compact | free
    this.mass = o.mass;
    this.comp = normalizeComp(compOf(o.comp || { rock: 0.7, iron: 0.25, ice: 0.05 }));
    this.compact = o.compact || null; // 'ns' | 'bh' | 'wd' | null
    this.x = o.x || 0; this.y = o.y || 0; this.z = o.z || 0;
    this.vx = o.vx || 0; this.vy = o.vy || 0; this.vz = o.vz || 0;
    this.ax = 0; this.ay = 0; this.az = 0;
    this.seed = o.seed ?? ((Math.random() * 1e9) | 0);
    this.spin = o.spin ?? 1;
    this.tilt = o.tilt ?? 0.3;
    this.rot = (this.seed % 1000) / 159;
    this.temp = o.temp ?? 150;
    this.life = o.life || 0;
    this.heat = o.heat || 0;          // 0..1 extra glow from impacts
    this.alive = true;
    this.rails = o.rails || null;     // fixed orbit {parent, a, omega, phase, e1, e2}
    this.system = o.system || null;   // active system it belongs to
    this.rings = o.rings || null;
    this.volcanic = o.volcanic || false;
    this.kind = o.kind || null;       // hint for visuals: rocky, icy, gasgiant, icegiant, hotjupiter...
    this.disrupt = 0;                 // tidal disruption progress
    this.disruptMass0 = 0;
    this.moonOf = null;
    this.static = !!o.static;         // never moves (stars at system centres)
    this.age = 0;
    this.fadeIn = o.fadeIn ?? 1;
    this.persistentKey = o.persistentKey || null;
    this.stellar = o.stellar || null; // a catalogue star's current state (giant, white dwarf...)
    this.phase = o.phase || null;     // the player star's own life phase: 'rg' | 'sg'
    this.updateRadius();
  }

  updateRadius() {
    const sw = this.swell || 1;
    if (this.compact === 'bh' || this.compact === 'ns' || this.compact === 'wd') {
      this.radius = bodyRadius(this.mass, this.comp, this.compact);
      this.rEff = this.compact === 'wd' ? Math.max(this.radius, compactReach(this.mass) * 0.6) : compactReach(this.mass);
    } else if (this.stellar && this.stellar.radius > 0) {
      this.radius = this.stellar.radius;
      this.rEff = this.radius;
    } else {
      this.radius = bodyRadius(this.mass, this.comp) * sw;
      this.rEff = this.radius;
    }
    if (this.stellar) {
      this.isStar = this.stellar.phase !== 'bh' && this.stellar.phase !== 'ns';
      this.starTemp = this.stellar.temp;
      this.lum = this.stellar.lum;
    } else if (this.compact === 'wd') {
      this.isStar = true;
      this.starTemp = this.wdTemp || 25000;
      this.lum = Math.pow(this.radius / 695700, 2) * Math.pow(this.starTemp / 5772, 4);
    } else if (!this.compact && canFuse(this.mass, this.comp)) {
      this.isStar = true;
      this.starTemp = starTemp(this.mass) / Math.pow(sw, 0.5);
      this.lum = starLuminosity(this.mass, this.radius / sw) * Math.pow(sw, 0.4);
    } else if (this.mass >= 13 * M_JUP && !this.compact && this.comp.gas >= 0.5) {
      // brown dwarfs glow faintly from deuterium burning and leftover heat
      this.isStar = false;
      this.starTemp = 1200 + 1100 * Math.min(1, (this.mass / M_SUN - 0.0124) / 0.063);
      this.lum = 1e-5;
    } else {
      this.isStar = false;
      this.starTemp = 0;
      this.lum = this.compact === 'ns' ? 0.5 : 0;
    }
    return this;
  }

  get form() {
    return classify(this.mass, this.comp, this.compact, { phase: this.phase, temp: this.temp });
  }

  get stage() {
    return this.form;
  }

  // A label for the HUD, based on what the body actually is
  get typeLabel() {
    if (this.stellar) {
      const p = this.stellar.phase;
      if (p === 'rg') return 'Red giant';
      if (p === 'sg') return 'Red supergiant';
      if (p === 'wd') return 'White dwarf';
    }
    if (this.compact === 'bh') return this.mass > 1e5 * M_SUN ? 'Supermassive black hole' : 'Black hole';
    if (this.compact === 'ns') return this.magnetar ? 'Magnetar' : 'Neutron star';
    if (this.compact === 'wd') return 'White dwarf';
    if (this.role === 'fragment') return 'Debris';
    if (this.isStar) {
      const ms = this.mass / M_SUN;
      if (ms < 0.5) return 'Red dwarf';
      if (ms < 0.8) return 'Orange dwarf';
      if (ms < 1.5) return 'Yellow dwarf';
      if (ms < 8) return 'Blue-white star';
      return 'Blue giant';
    }
    if (this.kind === 'hotjupiter') return 'Hot Jupiter';
    if (this.life === 2) return 'Inhabited world';
    if (this.life === 1) return 'Living world';
    const m = this.mass;
    if (m < 1e20 && this.comp.ice > 0.45) return m < 1e17 ? 'Icy planetesimal' : 'Comet nucleus';
    if (m < 1e20 && this.comp.iron > 0.5) return 'Metal asteroid';
    if (m < 1e20 && this.comp.carbon > 0.2) return 'Carbon asteroid';
    if (this.rogue) return 'Rogue planet';
    if (this.moonOf) return 'Moon';
    return FORM[this.form]?.name || 'Body';
  }

  distTo(b) {
    return Math.hypot(b.x - this.x, b.y - this.y, b.z - this.z);
  }

  absorbComp(other, m) {
    const t = this.mass + m;
    const c = this.comp, o = other.comp || other;
    for (const k of COMP_KEYS) c[k] = ((c[k] || 0) * this.mass + (o[k] || 0) * m) / t;
  }
}

export function resetBodyIds(n) {
  NEXT_ID = Math.max(NEXT_ID, n);
}
