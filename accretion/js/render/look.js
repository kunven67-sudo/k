// Decides what a body looks like from what it is made of, how big and how hot it is.
import { M_EARTH, M_JUP } from '../core/constants.js';
import { clamp, smoothstep, lumpiness, logStep } from '../core/phys.js';
import { RNG } from '../core/rng.js';
import { PTYPE } from './planetMaterial.js';

const PALETTES = {
  lunar: [[0.14, 0.135, 0.13], [0.34, 0.33, 0.315], [0.46, 0.44, 0.42]],
  mars: [[0.22, 0.1, 0.055], [0.42, 0.21, 0.11], [0.58, 0.43, 0.33]],
  mercury: [[0.15, 0.135, 0.12], [0.33, 0.3, 0.27], [0.48, 0.45, 0.41]],
  carbon: [[0.1, 0.095, 0.09], [0.16, 0.15, 0.14], [0.24, 0.225, 0.21]],
  stony: [[0.22, 0.19, 0.16], [0.36, 0.31, 0.25], [0.5, 0.44, 0.37]],
  desert: [[0.35, 0.25, 0.15], [0.5, 0.38, 0.24], [0.62, 0.55, 0.45]],
  ice: [[0.66, 0.7, 0.74], [0.86, 0.89, 0.92], [0.45, 0.27, 0.16]],
  dirtyice: [[0.3, 0.29, 0.28], [0.62, 0.62, 0.62], [0.2, 0.15, 0.12]],
  metal: [[0.3, 0.31, 0.33], [0.48, 0.48, 0.5], [0.6, 0.58, 0.55]],
  lava: [[0.06, 0.05, 0.045], [0.14, 0.11, 0.09], [0.28, 0.22, 0.12]],
  sulfur: [[0.5, 0.42, 0.16], [0.75, 0.68, 0.32], [0.3, 0.12, 0.05]],
  jupiter: [[0.78, 0.66, 0.52], [0.52, 0.36, 0.25], [0.92, 0.88, 0.78]],
  saturn: [[0.86, 0.77, 0.56], [0.72, 0.6, 0.4], [0.95, 0.9, 0.76]],
  coldgiant: [[0.72, 0.74, 0.76], [0.5, 0.55, 0.6], [0.86, 0.86, 0.84]],
  neptune: [[0.22, 0.42, 0.85], [0.16, 0.3, 0.72], [0.55, 0.72, 0.96]],
  uranus: [[0.62, 0.84, 0.88], [0.55, 0.78, 0.83], [0.74, 0.9, 0.92]],
  hotjup: [[0.22, 0.11, 0.07], [0.12, 0.05, 0.04], [0.38, 0.2, 0.1]],
  bdwarf: [[0.2, 0.06, 0.1], [0.09, 0.025, 0.05], [0.32, 0.12, 0.12]],
};

export function computeLook(b, models = null) {
  const rng = new RNG(b.seed);
  const m = b.mass;
  const c = b.comp;
  const T = b.temp || 150;
  const L = { type: PTYPE.rocky, pal: PALETTES.lunar, ocean: 0, iceCap: 0, atmo: 0, atmoColor: [0.18, 0.42, 1.0], atmoMie: 0.1, clouds: 0, cloudTint: [0.95, 0.95, 0.95], craters: 1, relief: 1, lumpy: 0, heat: 0, rings: b.rings, glow: 0 };
  L.lumpy = lumpiness(m) * 0.32;

  const gassy = (c.gas > 0.3 && m > 6 * M_EARTH) || (c.gas > 0.08 && m > 8 * M_EARTH);
  if (m >= 13 * M_JUP && !b.isStar) {
    L.type = PTYPE.browndwarf; L.pal = PALETTES.bdwarf; L.glow = 0.45;
  } else if (gassy || b.kind === 'gasgiant' || b.kind === 'icegiant' || b.kind === 'hotjupiter') {
    if (T > 1000 || b.kind === 'hotjupiter') { L.type = PTYPE.hotjupiter; L.pal = PALETTES.hotjup; L.glow = 0.6; }
    else if ((c.gas < 0.5 && m < 80 * M_EARTH) || b.kind === 'icegiant') { L.type = PTYPE.icegiant; L.pal = rng.chance(0.5) ? PALETTES.neptune : PALETTES.uranus; }
    else if (T < 90) { L.type = PTYPE.gasgiant; L.pal = rng.chance(0.5) ? PALETTES.saturn : PALETTES.coldgiant; }
    else { L.type = PTYPE.gasgiant; L.pal = rng.chance(0.65) ? PALETTES.jupiter : PALETTES.saturn; }
    L.atmo = 0.5;
    L.atmoColor = L.type === PTYPE.icegiant ? [0.3, 0.55, 1.0] : [0.55, 0.6, 0.8];
    L.craters = 0;
  } else {
    // solid bodies
    if (c.iron > 0.55) { L.type = PTYPE.metal; L.pal = PALETTES.metal; }
    else if (b.volcanic) { L.type = PTYPE.lava; L.pal = PALETTES.sulfur; }
    else if (T > 950 || b.kind === 'lava') { L.type = PTYPE.lava; L.pal = PALETTES.lava; }
    else if (c.ice > 0.35 && T < 230) { L.type = PTYPE.icy; L.pal = m < 1e20 ? PALETTES.dirtyice : PALETTES.ice; }
    else {
      L.type = PTYPE.rocky;
      if (m < 1e20) L.pal = rng.chance(0.55) ? PALETTES.carbon : PALETTES.stony;
      else if (m < 3e23) L.pal = rng.pick([PALETTES.lunar, PALETTES.mercury, PALETTES.lunar]);
      else L.pal = rng.pick([PALETTES.mars, PALETTES.desert, PALETTES.mercury, PALETTES.stony]);
    }
    // can it hold an atmosphere? (needs gravity; volcanoes and ice supply the gas)
    const holds = logStep(2e23, 3e24, m);
    const supply = clamp(c.gas * 60 + c.ice * 2 + 0.15, 0, 3);
    L.atmo = holds * clamp(supply, 0, 1.6);
    // liquid water needs the right temperature and enough gravity for an atmosphere
    // equilibrium temperature plus some greenhouse warming from the air
    if (L.type === PTYPE.rocky && c.ice > 0.015 && T > 215 && T < 370 && m > 2e23) {
      // Earth is only 0.02% water by mass yet 71% ocean, so coverage grows slowly with water
      L.ocean = clamp(0.38 + Math.log10(c.ice / 0.001) * 0.17, 0.2, 0.93) * holds;
      L.iceCap = T < 235 ? 0.55 : T < 265 ? 0.25 : 0.08;
      L.clouds = clamp(0.28 + c.ice * 0.6, 0.25, 0.5) * holds;
      L.atmoColor = [0.16, 0.4, 1.0];
    } else if (L.type === PTYPE.rocky && T >= 390 && L.atmo > 0.6 && c.ice > 0.01) {
      // runaway greenhouse: a Venus
      L.clouds = 0.95 * holds;
      L.cloudTint = [0.93, 0.82, 0.58];
      L.atmoColor = [0.85, 0.7, 0.45];
      L.atmoMie = 0.4;
    } else if (L.type === PTYPE.icy) {
      L.iceCap = 0;
      L.atmoColor = [0.95, 0.6, 0.25]; // Titan-like orange haze
      L.atmoMie = 0.35;
    } else if (L.pal === PALETTES.mars || L.pal === PALETTES.desert) {
      L.atmoColor = [0.85, 0.55, 0.42];
      L.atmo *= 0.4;
      L.iceCap = T < 260 ? 0.12 : 0;
    }
    if (c.ice > 0.2 && T < 235 && L.type === PTYPE.rocky) L.iceCap = 0.7;
    // big active worlds erase their craters; molten ones too
    L.craters = clamp(1 - smoothstep(5e22, 2e24, m) * 0.85 - L.ocean * 0.5 - L.atmo * 0.2, 0.08, 1);
    L.relief = m < 1e20 ? 1.4 : m < 1e23 ? 1.1 : 0.7;
  }
  const own = models && models.planet && b.role === 'player' && !b.isStar && !b.compact;
  if (b.life && !own && L.type < PTYPE.gasgiant) {
    L.atmoColor = [0.16, 0.4, 1.0];
    L.atmo = Math.max(L.atmo, 1);
    L.ocean = Math.max(L.ocean, 0.6);
    L.clouds = Math.max(L.clouds, 0.45);
  }
  L.green = b.life ? 0.85 : 0;
  L.city = b.life === 2 ? (b.colony ? 0.5 : 0.75) : 0;
  L.aurora = 0;
  L.volcano = b.volcanic ? 0.5 : 0;
  L.storm = 0;
  L.lightning = L.type >= PTYPE.gasgiant && L.type <= PTYPE.icegiant ? 0.25 : 0;
  L.drift = 0;
  // impact heating: early worlds glow
  L.heat = clamp(b.heat || 0, 0, 1);
  if (L.type === PTYPE.lava) L.heat = Math.max(L.heat, b.volcanic ? 0.25 : 0.6);
  if (own && L.type < PTYPE.gasgiant) applyModel(L, b, models.planet, models.life);
  return L;
}

// your own world: drawn from the planet and life simulations
function applyModel(L, b, pm, life) {
  const P = pm.P || 0;
  const a = pm.atm;
  const c = b.comp;
  L.atmo = clamp(Math.log10(1 + P * 9), 0, 1.8);
  L.atmoMie = 0.1;
  L.atmoColor = [0.16, 0.4, 1.0];
  L.clouds = 0;
  L.cloudTint = [0.95, 0.95, 0.95];
  const tot = Math.max(P, 1e-9);
  if (pm.oceanState === 'steam' || (a.co2 / tot > 0.6 && P > 8)) {
    // a Venus: thick yellow-white clouds hide the ground
    L.atmoColor = [0.85, 0.7, 0.45];
    L.clouds = 0.97;
    L.cloudTint = pm.oceanState === 'steam' ? [0.96, 0.95, 0.92] : [0.93, 0.82, 0.58];
    L.atmoMie = 0.4;
  } else if (a.ch4 / tot > 0.01 && pm.Ts < 150 && P > 0.05) {
    L.atmoColor = [0.95, 0.6, 0.25]; // Titan-like orange haze
    L.atmoMie = 0.35;
  } else if (P < 0.05) {
    L.atmoColor = [0.85, 0.55, 0.42]; // thin dusty air like Mars
  }
  const water = c.ice;
  const cover = water > 0.0005 ? clamp(0.38 + Math.log10(water / 0.001) * 0.17, 0.12, 0.95) : 0;
  if (pm.oceanState === 'liquid') {
    L.ocean = cover;
    if (L.clouds < 0.5) L.clouds = clamp(0.22 + 0.25 * clamp(P, 0, 1.2), 0.15, 0.5);
    L.storm = clamp((pm.Ts - 284) / 14, 0, 1) * 0.9;
    L.lightning = 0.6;
  } else if (pm.oceanState === 'frozen') {
    L.ocean = cover;
  } else {
    L.ocean = 0;
  }
  // ice sheets: from polar caps to a fully frozen snowball
  L.iceCap = water > 0.0005 || P > 0.01 ? 0.05 + pm.iceCover * 1.75 : 0;
  if (pm.oceanState === 'none' && water < 0.0005) L.iceCap = 0;
  L.heat = Math.max(L.heat, smoothstep(0.15, 0.7, pm.magma || 0) * 0.85 * (pm.meltable ?? 1));
  if (L.heat > 0.5) { L.ocean = 0; L.clouds = Math.max(L.clouds, 0.4); L.cloudTint = [0.5, 0.45, 0.42]; }
  L.craters = clamp(L.craters - (pm.tectonics ? 0.25 : 0) - (L.green || 0) * 0.2, 0.05, 1);
  L.green = life ? life.green || 0 : 0;
  L.city = life ? life.city || 0 : 0;
  L.aurora = pm.field > 0.15 ? clamp(pm.field * 0.6, 0.15, 1) * (P > 0.01 ? 1 : 0.35) : 0;
  L.volcano = clamp((pm.volcanism - 0.3) * 0.9, 0, 1) * (L.heat > 0.5 ? 0 : 1);
  L.drift = pm.drift || 0;
}

export { PALETTES };
