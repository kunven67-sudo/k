// A physical body: anything with mass, from a pebble swarm to a black hole.
import { bodyRadius, compactReach, isStellarMass, starTemp, starLuminosity, stageForMass, normalizeComp } from '../core/phys.js';
import { STAGES, M_SUN, M_EARTH, M_JUP } from '../core/constants.js';

let NEXT_ID = 1;

export class Body {
  constructor(o) {
    this.id = NEXT_ID++;
    this.name = o.name || '';
    this.role = o.role || 'field'; // player | field | fragment | rails | star | compact | free
    this.mass = o.mass;
    this.comp = normalizeComp({ ...(o.comp || { rock: 0.7, iron: 0.25, ice: 0.05, gas: 0 }) });
    this.compact = o.compact || null; // 'ns' | 'bh' | null
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
    this.updateRadius();
  }

  updateRadius() {
    if (this.compact === 'bh') {
      this.radius = bodyRadius(this.mass, this.comp, 'bh');
      this.rEff = compactReach(this.mass);
    } else if (this.compact === 'ns') {
      this.radius = bodyRadius(this.mass, this.comp, 'ns');
      this.rEff = compactReach(this.mass);
    } else {
      this.radius = bodyRadius(this.mass, this.comp);
      if (this.swell) this.radius *= this.swell;
      this.rEff = this.radius;
    }
    this.isStar = !this.compact && isStellarMass(this.mass);
    if (this.isStar) {
      this.starTemp = starTemp(this.mass) / Math.pow(this.swell || 1, 0.5);
      this.lum = starLuminosity(this.mass, this.radius / (this.swell || 1)) * Math.pow(this.swell || 1, 0.4);
    } else if (this.mass >= 13 * M_JUP && !this.compact) {
      // brown dwarfs glow faintly from deuterium burning and leftover heat
      this.starTemp = 1200 + 1100 * Math.min(1, (this.mass / M_SUN - 0.0124) / 0.063);
      this.lum = 1e-5;
    } else {
      this.starTemp = 0;
      this.lum = this.compact === 'ns' ? 0.5 : 0;
    }
    return this;
  }

  get stage() {
    return stageForMass(this.mass, this.compact);
  }

  // A label for the HUD, based on what the body actually is
  get typeLabel() {
    if (this.compact === 'bh') return this.mass > 1e5 * M_SUN ? 'Supermassive black hole' : 'Black hole';
    if (this.compact === 'ns') return 'Neutron star';
    if (this.role === 'fragment') return 'Debris';
    const m = this.mass;
    if (this.isStar) {
      const ms = m / M_SUN;
      if (ms < 0.5) return 'Red dwarf';
      if (ms < 0.8) return 'Orange dwarf';
      if (ms < 1.5) return 'Yellow dwarf';
      if (ms < 8) return 'Blue-white star';
      return 'Blue giant';
    }
    if (m >= 13 * M_JUP) return 'Brown dwarf';
    if (this.kind === 'hotjupiter') return 'Hot Jupiter';
    if (m >= 30 * M_EARTH && this.comp.gas > 0.3) return 'Gas giant';
    if (m >= 6 * M_EARTH && this.comp.gas > 0.08) return 'Ice giant';
    if (this.life === 2) return 'Inhabited world';
    if (this.life === 1) return 'Living world';
    const s = STAGES[stageForMass(m)];
    if (m < 1e20 && this.comp.ice > 0.45) return m < 1e17 ? 'Icy planetesimal' : 'Comet nucleus';
    if (m < 1e20 && this.comp.iron > 0.5) return 'Metal asteroid';
    if (this.moonOf) return 'Moon';
    return s.name;
  }

  distTo(b) {
    return Math.hypot(b.x - this.x, b.y - this.y, b.z - this.z);
  }

  absorbComp(other, m) {
    const t = this.mass + m;
    const c = this.comp, o = other.comp || other;
    c.rock = (c.rock * this.mass + o.rock * m) / t;
    c.iron = (c.iron * this.mass + o.iron * m) / t;
    c.ice = (c.ice * this.mass + o.ice * m) / t;
    c.gas = (c.gas * this.mass + o.gas * m) / t;
  }
}

export function resetBodyIds(n) {
  NEXT_ID = Math.max(NEXT_ID, n);
}

export { M_EARTH };
