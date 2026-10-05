// Human parameter schema: every slider/option the DMV creator shows, with ranges, defaults and
// English/Spanish labels. `randomHumanParams(rng)` produces believable, diverse people
// (correlated traits: older people grey and wrinkle, heavier people get rounder faces, etc.).
//
// Params are a flat plain object (JSON-safe, saved inside life.character). Unknown keys are
// ignored and missing keys fall back to defaults via `normalizeParams()`.

import { i18n, t } from '../core/i18n.js';
import { Rng } from '../core/rng.js';
import { clamp } from '../core/util.js';

// ---- option lists -----------------------------------------------------------------------------

export const EYE_COLORS = ['dark-brown', 'brown', 'hazel', 'amber', 'green', 'blue', 'light-blue', 'gray'];
export const HAIR_STYLES = [
  'bald', 'buzz', 'crew', 'side-part', 'messy', 'slick-back', 'curly-short', 'afro', 'mohawk',
  'bob', 'long-straight', 'long-wavy', 'ponytail', 'bun', 'mullet', 'receding', 'comb-over', 'shag',
];
export const HAIR_COLORS = ['black', 'dark-brown', 'brown', 'light-brown', 'auburn', 'ginger', 'strawberry', 'blonde', 'platinum', 'gray', 'white', 'dyed-red', 'dyed-blue', 'dyed-pink', 'dyed-green'];
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'horseshoe', 'goatee', 'soul-patch', 'chin-strap', 'full', 'long', 'mutton-chops'];
export const TOPS = ['tshirt', 'tank', 'button', 'hoodie', 'polo', 'dress', 'dealer', 'security', 'clerk'];
export const BOTTOMS = ['jeans', 'slacks', 'shorts', 'skirt', 'cargo'];
export const SHOES = ['sneakers', 'boots', 'dress', 'cowboy', 'slides'];
export const OUTERS = ['none', 'jacket', 'denim-jacket', 'leather-jacket', 'blazer', 'vest'];
export const HATS = ['none', 'cap', 'cowboy', 'beanie', 'fedora'];
export const GLASSES = ['none', 'round', 'square', 'aviator', 'reading', 'sunglasses'];
export const BIRTHMARKS = ['none', 'cheek', 'forehead', 'neck', 'temple'];
export const SCARS = ['none', 'brow', 'cheek', 'lip', 'chin', 'nose'];
export const WALK_STYLES = ['natural', 'swagger', 'bouncy', 'slouchy', 'stiff'];
export const PRINTS = ['none', 'dice', 'stripe', 'reno', 'cherries', 'pocket'];

// Curated skin ramp (sRGB hex) from very fair to very deep; skinTone 0..1 indexes it smoothly.
export const SKIN_RAMP = [
  0xf6dccb, 0xf0cfb6, 0xe8bf9f, 0xdcae8a, 0xcf9c74, 0xc08a62, 0xae7650, 0x9a6442, 0x845236, 0x6e432c, 0x5a3523, 0x45281b,
];

export const HAIR_COLOR_HEX = {
  black: 0x16110e, 'dark-brown': 0x2e1f16, brown: 0x4a3020, 'light-brown': 0x6f4c30, auburn: 0x6a2c18,
  ginger: 0xa8461c, strawberry: 0xc4794a, blonde: 0xc9a466, platinum: 0xe2d7bd, gray: 0x8d8a86,
  white: 0xdedbd5, 'dyed-red': 0xa3141f, 'dyed-blue': 0x1f4fa3, 'dyed-pink': 0xd9488f, 'dyed-green': 0x2f8f4a,
};

export const EYE_COLOR_HEX = {
  'dark-brown': 0x2b1609, brown: 0x51290f, hazel: 0x7a5a2a, amber: 0xa5701e, green: 0x4d7a3a,
  blue: 0x3d6ea8, 'light-blue': 0x7fa8cc, gray: 0x7d8a90,
};

// Garment colours offered by the creator (and used by the random generator).
export const CLOTH_COLORS = {
  black: 0x1c1b1e, charcoal: 0x3a3a3e, gray: 0x7c7d80, white: 0xe9e6df, cream: 0xd9ceb4, navy: 0x1f2a44,
  denim: 0x3c5679, sky: 0x7aa6c8, red: 0x9c2027, maroon: 0x5a1a22, orange: 0xc3632a, mustard: 0xc69a2b,
  olive: 0x5b5e34, forest: 0x2c4a33, teal: 0x2b6a6a, purple: 0x4f3466, pink: 0xd67fa0, tan: 0xb39570,
  khaki: 0x9c8a63, brown: 0x5a3c26,
};

// ---- schema -----------------------------------------------------------------------------------

const R = (key, min, max, def, step = 0.01) => ({ key, type: 'range', min, max, default: def, step, labelKey: `character.p.${key}` });
const E = (key, options, def, optNs = key) => ({
  key,
  type: 'enum',
  default: def,
  labelKey: `character.p.${key}`,
  options: options.map((v) => ({ value: v, labelKey: `character.o.${optNs}.${v}` })),
});
const B = (key, def) => ({ key, type: 'bool', default: def, labelKey: `character.p.${key}` });
const C = (key, def) => ({
  key,
  type: 'color',
  default: def,
  labelKey: `character.p.${key}`,
  options: Object.keys(CLOTH_COLORS).map((v) => ({ value: v, hex: CLOTH_COLORS[v], labelKey: `character.o.color.${v}` })),
});

export const HUMAN_PARAM_SCHEMA = [
  {
    id: 'body',
    labelKey: 'character.g.body',
    params: [
      R('age', 21, 90, 32, 1),
      R('height', 1.5, 2.05, 1.75),
      R('fat', 0, 1, 0.3),
      R('muscle', 0, 1, 0.35),
      R('shoulders', 0, 1, 0.5),
      R('chest', 0, 1, 0.3),
      R('waist', 0, 1, 0.45),
      R('hips', 0, 1, 0.45),
      R('belly', 0, 1, 0.3),
      R('legs', 0, 1, 0.5),
      R('handSize', 0, 1, 0.5),
    ],
  },
  {
    id: 'skin',
    labelKey: 'character.g.skin',
    params: [
      R('skinTone', 0, 1, 0.35),
      R('undertone', -1, 1, 0.1),
      R('freckles', 0, 1, 0),
      R('moles', 0, 1, 0.2),
      E('birthmark', BIRTHMARKS, 'none'),
      R('acne', 0, 1, 0),
      R('wrinkles', 0, 1, 0),
      E('scar', SCARS, 'none'),
      R('blush', 0, 1, 0.3),
      R('bodyHair', 0, 1, 0.3),
    ],
  },
  {
    id: 'face',
    labelKey: 'character.g.face',
    params: [
      R('faceWidth', 0, 1, 0.5),
      R('jaw', 0, 1, 0.5),
      R('chin', 0, 1, 0.5),
      R('cheeks', 0, 1, 0.4),
      R('cheekbones', 0, 1, 0.5),
      R('noseSize', 0, 1, 0.5),
      R('noseWidth', 0, 1, 0.5),
      R('noseBridge', 0, 1, 0.4),
      R('noseTip', 0, 1, 0.5),
      R('ears', 0, 1, 0.5),
      R('earsOut', 0, 1, 0.3),
      R('browRidge', 0, 1, 0.4),
      R('lips', 0, 1, 0.5),
      R('mouthWidth', 0, 1, 0.5),
    ],
  },
  {
    id: 'eyes',
    labelKey: 'character.g.eyes',
    params: [
      R('eyeSize', 0, 1, 0.5),
      R('eyeSpacing', 0, 1, 0.5),
      R('eyeTilt', 0, 1, 0.5),
      R('lids', 0, 1, 0.3),
      E('eyeColor', EYE_COLORS, 'brown'),
      B('heterochromia', false),
      E('eyeColor2', EYE_COLORS, 'blue', 'eyeColor'),
      R('browThickness', 0, 1, 0.5),
      R('browArch', 0, 1, 0.4),
    ],
  },
  {
    id: 'hair',
    labelKey: 'character.g.hair',
    params: [
      E('hairStyle', HAIR_STYLES, 'messy'),
      E('hairColor', HAIR_COLORS, 'brown'),
      R('gray', 0, 1, 0),
      R('hairVolume', 0, 1, 0.5),
      E('facialHair', FACIAL_HAIR, 'none'),
      R('stubble', 0, 1, 0.2),
    ],
  },
  {
    id: 'outfit',
    labelKey: 'character.g.outfit',
    params: [
      E('top', TOPS, 'tshirt'),
      C('topColor', 'navy'),
      E('print', PRINTS, 'none'),
      E('bottom', BOTTOMS, 'jeans'),
      C('bottomColor', 'denim'),
      E('shoes', SHOES, 'sneakers'),
      C('shoesColor', 'white'),
      E('outer', OUTERS, 'none'),
      C('outerColor', 'brown'),
      E('hat', HATS, 'none'),
      C('hatColor', 'red'),
    ],
  },
  {
    id: 'details',
    labelKey: 'character.g.details',
    params: [E('glasses', GLASSES, 'none'), B('hearingAid', false), R('dirtiness', 0, 1, 0.1), R('wear', 0, 1, 0.2)],
  },
  {
    id: 'voice',
    labelKey: 'character.g.voice',
    params: [R('voicePitch', 0, 1, 0.5), R('voiceRate', 0, 1, 0.5)],
  },
  {
    id: 'walk',
    labelKey: 'character.g.walk',
    params: [E('walkStyle', WALK_STYLES, 'natural')],
  },
];

// Convenience: `.label` resolves through t() so UIs can just read it.
for (const g of HUMAN_PARAM_SCHEMA) {
  Object.defineProperty(g, 'label', { get: () => t(g.labelKey), enumerable: false });
  for (const p of g.params) {
    Object.defineProperty(p, 'label', { get: () => t(p.labelKey), enumerable: false });
    for (const o of p.options || []) Object.defineProperty(o, 'label', { get: () => t(o.labelKey), enumerable: false });
  }
}

export const PARAM_INDEX = new Map(HUMAN_PARAM_SCHEMA.flatMap((g) => g.params.map((p) => [p.key, p])));

export function defaultParams() {
  const o = { seed: 1 };
  for (const p of PARAM_INDEX.values()) o[p.key] = p.default;
  return o;
}

// Fill defaults, clamp ranges, reject unknown enum values.
export function normalizeParams(params = {}) {
  const o = defaultParams();
  for (const [k, v] of Object.entries(params)) {
    const def = PARAM_INDEX.get(k);
    if (!def) {
      if (k === 'seed' || k === 'name') o[k] = v;
      continue;
    }
    if (def.type === 'range') o[k] = clamp(Number(v) || 0, def.min, def.max);
    else if (def.type === 'bool') o[k] = !!v;
    else if (def.options.some((x) => x.value === v)) o[k] = v;
  }
  return o;
}

// ---- random people ----------------------------------------------------------------------------

const UNIFORMS = {
  dealer: { top: 'dealer', bottom: 'slacks', bottomColor: 'black', shoes: 'dress', shoesColor: 'black', outer: 'none', hat: 'none', print: 'none' },
  security: { top: 'security', bottom: 'cargo', bottomColor: 'black', shoes: 'boots', shoesColor: 'black', outer: 'none', hat: 'none', print: 'none' },
  clerk: { top: 'clerk', bottom: 'slacks', bottomColor: 'khaki', shoes: 'sneakers', shoesColor: 'gray', outer: 'none', hat: 'none', print: 'none' },
};

/**
 * A believable random person. `overrides` wins over everything; `overrides.uniform` applies a
 * job outfit ('dealer' | 'security' | 'clerk'); `overrides.sex` biases body/face ('m' | 'f' | 'x').
 */
export function randomHumanParams(rng = new Rng((Math.random() * 2 ** 31) | 0), overrides = {}) {
  if (typeof rng === 'number' || typeof rng === 'string') rng = new Rng(rng);
  const g = (m, sd, lo = 0, hi = 1) => clamp(rng.gaussian(m, sd), lo, hi);
  const p = defaultParams();
  p.seed = rng.int(1, 2 ** 30);
  const sex = overrides.sex ?? rng.pick(['m', 'm', 'f', 'f', 'x']);
  const fem = sex === 'f' ? 1 : sex === 'm' ? 0 : rng.range(0.3, 0.7);

  // Ages skew towards casino/motel demographics: plenty of 25-45 but many retirees too.
  p.age = Math.round(rng.weighted([[rng.range(21, 30), 3], [rng.range(30, 45), 4], [rng.range(45, 62), 3], [rng.range(62, 90), 2.5]]));
  const old = clamp((p.age - 40) / 45, 0, 1);
  p.height = clamp(rng.gaussian(1.76 - fem * 0.13, 0.075), 1.5, 2.05);
  p.fat = clamp(rng.weighted([[g(0.15, 0.08), 3], [g(0.4, 0.12), 4], [g(0.72, 0.15), 3]]) + old * 0.08, 0, 1);
  p.muscle = g(0.45 - fem * 0.2 - old * 0.15, 0.2);
  p.shoulders = g(0.62 - fem * 0.35, 0.15);
  p.chest = g(0.12 + fem * 0.55 + p.fat * 0.15, 0.15);
  p.waist = g(0.55 - fem * 0.25 + p.fat * 0.2, 0.12);
  p.hips = g(0.35 + fem * 0.35, 0.13);
  p.belly = g(p.fat * 0.7 + old * 0.2 + (1 - fem) * 0.05, 0.15);
  p.legs = g(0.5 + fem * 0.05, 0.15);
  p.handSize = g(0.55 - fem * 0.2, 0.15);

  p.skinTone = clamp(rng.weighted([[rng.range(0, 0.25), 3], [rng.range(0.2, 0.5), 3], [rng.range(0.45, 0.75), 2.5], [rng.range(0.7, 1), 2]]), 0, 1);
  p.undertone = clamp(rng.gaussian(0.1, 0.45), -1, 1);
  p.freckles = p.skinTone < 0.3 && rng.chance(0.35) ? rng.range(0.25, 1) : rng.chance(0.08) ? rng.range(0.1, 0.4) : 0;
  p.moles = g(0.25 + old * 0.3, 0.2);
  p.birthmark = rng.chance(0.1) ? rng.pick(['cheek', 'forehead', 'neck', 'temple']) : 'none';
  p.acne = p.age < 30 && rng.chance(0.3) ? rng.range(0.15, 0.7) : 0;
  p.wrinkles = g(old * 0.4, 0.15);
  p.scar = rng.chance(0.12) ? rng.pick(['brow', 'cheek', 'lip', 'chin', 'nose']) : 'none';
  p.blush = g(0.3 + (p.skinTone < 0.35 ? 0.15 : 0), 0.15);
  p.bodyHair = g(0.45 - fem * 0.35, 0.2);

  p.faceWidth = g(0.45 + p.fat * 0.3, 0.15);
  p.jaw = g(0.6 - fem * 0.3 + p.fat * 0.1, 0.17);
  p.chin = g(0.5, 0.18);
  p.cheeks = g(0.25 + p.fat * 0.55 + (p.age < 28 ? 0.1 : 0), 0.12);
  p.cheekbones = g(0.5, 0.2);
  p.noseSize = g(0.45 + old * 0.2, 0.2);
  p.noseWidth = g(0.45 + p.skinTone * 0.2, 0.2);
  p.noseBridge = g(0.45, 0.22);
  p.noseTip = g(0.5, 0.2);
  p.ears = g(0.45 + old * 0.25, 0.18);
  p.earsOut = g(0.3, 0.2);
  p.browRidge = g(0.55 - fem * 0.3, 0.17);
  p.lips = g(0.45 + fem * 0.2 + p.skinTone * 0.15 - old * 0.15, 0.18);
  p.mouthWidth = g(0.5, 0.17);

  p.eyeSize = g(0.5 + fem * 0.1, 0.15);
  p.eyeSpacing = g(0.5, 0.17);
  p.eyeTilt = g(0.5, 0.18);
  p.lids = g(0.25 + old * 0.45, 0.17);
  p.eyeColor = p.skinTone > 0.5 ? rng.weighted([['dark-brown', 6], ['brown', 3], ['hazel', 1], ['amber', 0.5]]) : rng.weighted([['dark-brown', 2], ['brown', 3], ['hazel', 2], ['amber', 0.6], ['green', 1.5], ['blue', 2.5], ['light-blue', 1.2], ['gray', 0.8]]);
  p.heterochromia = rng.chance(0.03);
  p.eyeColor2 = rng.pick(EYE_COLORS);
  p.browThickness = g(0.55 - fem * 0.2, 0.2);
  p.browArch = g(0.35 + fem * 0.25, 0.2);

  // Hair: natural colours follow skin tone; age greys and recedes.
  const natural = p.skinTone > 0.55
    ? rng.weighted([['black', 6], ['dark-brown', 3], ['brown', 1]])
    : rng.weighted([['black', 2], ['dark-brown', 3], ['brown', 3], ['light-brown', 2], ['auburn', 1], ['ginger', p.freckles > 0 ? 2 : 0.4], ['strawberry', 0.6], ['blonde', 2], ['platinum', 0.4]]);
  p.hairColor = rng.chance(0.07) ? rng.pick(['dyed-red', 'dyed-blue', 'dyed-pink', 'dyed-green']) : natural;
  p.gray = clamp((p.age - 38) / 40 + rng.gaussian(0, 0.15), 0, 1);
  const mascStyles = [['buzz', 3], ['crew', 4], ['side-part', 3], ['messy', 3], ['slick-back', 2], ['curly-short', 2], ['receding', 2 + old * 4], ['bald', 1 + old * 4], ['comb-over', old * 2], ['mullet', 1], ['mohawk', 0.3], ['afro', p.skinTone > 0.55 ? 2 : 0.2], ['shag', 1], ['ponytail', 0.4], ['long-straight', 0.4]];
  const femStyles = [['bob', 3], ['long-straight', 4], ['long-wavy', 4], ['ponytail', 3], ['bun', 3], ['shag', 2], ['curly-short', 1.5], ['afro', p.skinTone > 0.55 ? 2.5 : 0.2], ['messy', 1.5], ['side-part', 1], ['buzz', 0.4], ['mullet', 0.3]];
  p.hairStyle = rng.weighted(fem > 0.6 ? femStyles : fem < 0.4 ? mascStyles : [...mascStyles, ...femStyles]);
  p.hairVolume = g(0.5, 0.2);
  p.facialHair = fem < 0.4 && rng.chance(0.6)
    ? rng.weighted([['stubble', 5], ['mustache', 1.5], ['horseshoe', 0.7], ['goatee', 1.5], ['soul-patch', 0.4], ['chin-strap', 0.6], ['full', 3], ['long', 0.6 + old], ['mutton-chops', 0.3]])
    : 'none';
  p.stubble = fem < 0.4 ? g(0.4, 0.25) : fem > 0.6 ? 0 : g(0.1, 0.1);

  // Clothes.
  const colors = Object.keys(CLOTH_COLORS);
  p.top = rng.weighted([['tshirt', 5], ['tank', 1], ['button', 3], ['hoodie', 3], ['polo', 2], ['dress', fem > 0.6 ? 2 : 0]]);
  p.topColor = rng.pick(colors);
  p.print = p.top === 'tshirt' || p.top === 'tank' ? rng.weighted([['none', 4], ['dice', 1], ['stripe', 1], ['reno', 1], ['cherries', 1], ['pocket', 1]]) : 'none';
  p.bottom = rng.weighted([['jeans', 6], ['slacks', 2], ['shorts', 2], ['skirt', fem > 0.6 ? 2 : 0], ['cargo', 2]]);
  p.bottomColor = p.bottom === 'jeans' ? rng.pick(['denim', 'denim', 'navy', 'black', 'charcoal', 'sky']) : rng.pick(['khaki', 'black', 'charcoal', 'navy', 'tan', 'olive', 'gray', 'brown']);
  p.shoes = rng.weighted([['sneakers', 6], ['boots', 2], ['dress', 1.5], ['cowboy', 1], ['slides', 0.5]]);
  p.shoesColor = rng.pick(['white', 'black', 'brown', 'gray', 'tan', 'red', 'navy']);
  p.outer = rng.weighted([['none', 7], ['jacket', 1], ['denim-jacket', 1], ['leather-jacket', 1], ['blazer', 0.6], ['vest', 0.4]]);
  p.outerColor = rng.pick(['brown', 'black', 'denim', 'olive', 'navy', 'tan', 'charcoal', 'maroon']);
  p.hat = rng.weighted([['none', 8], ['cap', 2], ['cowboy', 0.8], ['beanie', 0.8], ['fedora', 0.3]]);
  p.hatColor = rng.pick(colors);

  p.glasses = rng.chance(0.2 + old * 0.4) ? rng.pick(['round', 'square', 'aviator', 'reading', 'sunglasses']) : 'none';
  p.hearingAid = p.age > 65 && rng.chance(0.3);
  p.dirtiness = g(0.12, 0.12);
  p.wear = g(0.25, 0.15);
  p.voicePitch = g(0.35 + fem * 0.35, 0.12);
  p.voiceRate = g(0.5 - old * 0.15, 0.12);
  p.walkStyle = rng.weighted([['natural', 6], ['swagger', 1.2], ['bouncy', 1], ['slouchy', 1.2 + old], ['stiff', 0.8 + old]]);

  if (overrides.uniform && UNIFORMS[overrides.uniform]) Object.assign(p, UNIFORMS[overrides.uniform]);
  const { uniform, sex: _s, ...rest } = overrides;
  return normalizeParams({ ...p, ...rest });
}

// ---- strings ----------------------------------------------------------------------------------

const EN = {
  'g.body': 'Body', 'g.skin': 'Skin', 'g.face': 'Face', 'g.eyes': 'Eyes & brows', 'g.hair': 'Hair', 'g.outfit': 'Outfit', 'g.details': 'Details', 'g.voice': 'Voice', 'g.walk': 'Walk',
  'p.age': 'Age', 'p.height': 'Height', 'p.fat': 'Body fat', 'p.muscle': 'Muscle', 'p.shoulders': 'Shoulders', 'p.chest': 'Chest', 'p.waist': 'Waist', 'p.hips': 'Hips', 'p.belly': 'Belly', 'p.legs': 'Leg length', 'p.handSize': 'Hand size',
  'p.skinTone': 'Skin tone', 'p.undertone': 'Undertone', 'p.freckles': 'Freckles', 'p.moles': 'Moles', 'p.birthmark': 'Birthmark', 'p.acne': 'Acne', 'p.wrinkles': 'Wrinkles', 'p.scar': 'Scar', 'p.blush': 'Rosy cheeks', 'p.bodyHair': 'Body hair',
  'p.faceWidth': 'Face width', 'p.jaw': 'Jaw', 'p.chin': 'Chin', 'p.cheeks': 'Cheeks', 'p.cheekbones': 'Cheekbones', 'p.noseSize': 'Nose size', 'p.noseWidth': 'Nose width', 'p.noseBridge': 'Nose bridge', 'p.noseTip': 'Nose tip', 'p.ears': 'Ear size', 'p.earsOut': 'Ears stick out', 'p.browRidge': 'Brow ridge', 'p.lips': 'Lip fullness', 'p.mouthWidth': 'Mouth width',
  'p.eyeSize': 'Eye size', 'p.eyeSpacing': 'Eye spacing', 'p.eyeTilt': 'Eye tilt', 'p.lids': 'Heavy lids', 'p.eyeColor': 'Eye color', 'p.heterochromia': 'Two eye colors', 'p.eyeColor2': 'Second eye color', 'p.browThickness': 'Brow thickness', 'p.browArch': 'Brow arch',
  'p.hairStyle': 'Hairstyle', 'p.hairColor': 'Hair color', 'p.gray': 'Gray hair', 'p.hairVolume': 'Volume', 'p.facialHair': 'Facial hair', 'p.stubble': 'Stubble',
  'p.top': 'Top', 'p.topColor': 'Top color', 'p.print': 'Print', 'p.bottom': 'Bottoms', 'p.bottomColor': 'Bottoms color', 'p.shoes': 'Shoes', 'p.shoesColor': 'Shoe color', 'p.outer': 'Outerwear', 'p.outerColor': 'Outerwear color', 'p.hat': 'Hat', 'p.hatColor': 'Hat color',
  'p.glasses': 'Glasses', 'p.hearingAid': 'Hearing aid', 'p.dirtiness': 'Grime', 'p.wear': 'Clothes wear',
  'p.voicePitch': 'Voice pitch', 'p.voiceRate': 'Speaking speed', 'p.walkStyle': 'Walk style',
  'o.eyeColor.dark-brown': 'Dark brown', 'o.eyeColor.brown': 'Brown', 'o.eyeColor.hazel': 'Hazel', 'o.eyeColor.amber': 'Amber', 'o.eyeColor.green': 'Green', 'o.eyeColor.blue': 'Blue', 'o.eyeColor.light-blue': 'Light blue', 'o.eyeColor.gray': 'Gray',
  'o.hairStyle.bald': 'Bald', 'o.hairStyle.buzz': 'Buzz cut', 'o.hairStyle.crew': 'Crew cut', 'o.hairStyle.side-part': 'Side part', 'o.hairStyle.messy': 'Messy', 'o.hairStyle.slick-back': 'Slicked back', 'o.hairStyle.curly-short': 'Short curls', 'o.hairStyle.afro': 'Afro', 'o.hairStyle.mohawk': 'Mohawk', 'o.hairStyle.bob': 'Bob', 'o.hairStyle.long-straight': 'Long straight', 'o.hairStyle.long-wavy': 'Long wavy', 'o.hairStyle.ponytail': 'Ponytail', 'o.hairStyle.bun': 'Bun', 'o.hairStyle.mullet': 'Mullet', 'o.hairStyle.receding': 'Receding', 'o.hairStyle.comb-over': 'Comb-over', 'o.hairStyle.shag': 'Shag',
  'o.hairColor.black': 'Black', 'o.hairColor.dark-brown': 'Dark brown', 'o.hairColor.brown': 'Brown', 'o.hairColor.light-brown': 'Light brown', 'o.hairColor.auburn': 'Auburn', 'o.hairColor.ginger': 'Ginger', 'o.hairColor.strawberry': 'Strawberry blonde', 'o.hairColor.blonde': 'Blonde', 'o.hairColor.platinum': 'Platinum', 'o.hairColor.gray': 'Gray', 'o.hairColor.white': 'White', 'o.hairColor.dyed-red': 'Dyed red', 'o.hairColor.dyed-blue': 'Dyed blue', 'o.hairColor.dyed-pink': 'Dyed pink', 'o.hairColor.dyed-green': 'Dyed green',
  'o.facialHair.none': 'Clean shaven', 'o.facialHair.stubble': 'Stubble', 'o.facialHair.mustache': 'Mustache', 'o.facialHair.horseshoe': 'Horseshoe', 'o.facialHair.goatee': 'Goatee', 'o.facialHair.soul-patch': 'Soul patch', 'o.facialHair.chin-strap': 'Chin strap', 'o.facialHair.full': 'Full beard', 'o.facialHair.long': 'Long beard', 'o.facialHair.mutton-chops': 'Mutton chops',
  'o.top.tshirt': 'T-shirt', 'o.top.tank': 'Tank top', 'o.top.button': 'Button shirt', 'o.top.hoodie': 'Hoodie', 'o.top.polo': 'Polo', 'o.top.dress': 'Dress', 'o.top.dealer': 'Dealer uniform', 'o.top.security': 'Security uniform', 'o.top.clerk': 'Motel clerk shirt',
  'o.bottom.jeans': 'Jeans', 'o.bottom.slacks': 'Slacks', 'o.bottom.shorts': 'Shorts', 'o.bottom.skirt': 'Skirt', 'o.bottom.cargo': 'Cargo pants',
  'o.shoes.sneakers': 'Sneakers', 'o.shoes.boots': 'Work boots', 'o.shoes.dress': 'Dress shoes', 'o.shoes.cowboy': 'Cowboy boots', 'o.shoes.slides': 'Slides',
  'o.outer.none': 'None', 'o.outer.jacket': 'Bomber jacket', 'o.outer.denim-jacket': 'Denim jacket', 'o.outer.leather-jacket': 'Leather jacket', 'o.outer.blazer': 'Blazer', 'o.outer.vest': 'Vest',
  'o.hat.none': 'None', 'o.hat.cap': 'Baseball cap', 'o.hat.cowboy': 'Cowboy hat', 'o.hat.beanie': 'Beanie', 'o.hat.fedora': 'Fedora',
  'o.glasses.none': 'None', 'o.glasses.round': 'Round', 'o.glasses.square': 'Square', 'o.glasses.aviator': 'Aviators', 'o.glasses.reading': 'Readers', 'o.glasses.sunglasses': 'Sunglasses',
  'o.birthmark.none': 'None', 'o.birthmark.cheek': 'Cheek', 'o.birthmark.forehead': 'Forehead', 'o.birthmark.neck': 'Neck', 'o.birthmark.temple': 'Temple',
  'o.scar.none': 'None', 'o.scar.brow': 'Eyebrow', 'o.scar.cheek': 'Cheek', 'o.scar.lip': 'Lip', 'o.scar.chin': 'Chin', 'o.scar.nose': 'Nose',
  'o.walkStyle.natural': 'Natural', 'o.walkStyle.swagger': 'Swagger', 'o.walkStyle.bouncy': 'Bouncy', 'o.walkStyle.slouchy': 'Slouchy', 'o.walkStyle.stiff': 'Stiff',
  'o.print.none': 'Plain', 'o.print.dice': 'Lucky dice', 'o.print.stripe': 'Chest stripe', 'o.print.reno': 'Reno', 'o.print.cherries': 'Cherries', 'o.print.pocket': 'Pocket',
  'o.color.black': 'Black', 'o.color.charcoal': 'Charcoal', 'o.color.gray': 'Gray', 'o.color.white': 'White', 'o.color.cream': 'Cream', 'o.color.navy': 'Navy', 'o.color.denim': 'Denim', 'o.color.sky': 'Sky blue', 'o.color.red': 'Red', 'o.color.maroon': 'Maroon', 'o.color.orange': 'Orange', 'o.color.mustard': 'Mustard', 'o.color.olive': 'Olive', 'o.color.forest': 'Forest green', 'o.color.teal': 'Teal', 'o.color.purple': 'Purple', 'o.color.pink': 'Pink', 'o.color.tan': 'Tan', 'o.color.khaki': 'Khaki', 'o.color.brown': 'Brown',
  'expr.neutral': 'Neutral', 'expr.happy': 'Happy', 'expr.sad': 'Sad', 'expr.angry': 'Angry', 'expr.scared': 'Scared', 'expr.hungover': 'Hungover', 'expr.disgusted': 'Disgusted', 'expr.surprised': 'Surprised', 'expr.smug': 'Smug', 'expr.nervous': 'Nervous',
};

const ES = {
  'g.body': 'Cuerpo', 'g.skin': 'Piel', 'g.face': 'Cara', 'g.eyes': 'Ojos y cejas', 'g.hair': 'Pelo', 'g.outfit': 'Ropa', 'g.details': 'Detalles', 'g.voice': 'Voz', 'g.walk': 'Andar',
  'p.age': 'Edad', 'p.height': 'Altura', 'p.fat': 'Grasa corporal', 'p.muscle': 'Músculo', 'p.shoulders': 'Hombros', 'p.chest': 'Pecho', 'p.waist': 'Cintura', 'p.hips': 'Caderas', 'p.belly': 'Barriga', 'p.legs': 'Largo de piernas', 'p.handSize': 'Tamaño de manos',
  'p.skinTone': 'Tono de piel', 'p.undertone': 'Subtono', 'p.freckles': 'Pecas', 'p.moles': 'Lunares', 'p.birthmark': 'Marca de nacimiento', 'p.acne': 'Acné', 'p.wrinkles': 'Arrugas', 'p.scar': 'Cicatriz', 'p.blush': 'Mejillas rosadas', 'p.bodyHair': 'Vello corporal',
  'p.faceWidth': 'Ancho de cara', 'p.jaw': 'Mandíbula', 'p.chin': 'Barbilla', 'p.cheeks': 'Mofletes', 'p.cheekbones': 'Pómulos', 'p.noseSize': 'Tamaño de nariz', 'p.noseWidth': 'Ancho de nariz', 'p.noseBridge': 'Puente nasal', 'p.noseTip': 'Punta de la nariz', 'p.ears': 'Tamaño de orejas', 'p.earsOut': 'Orejas salidas', 'p.browRidge': 'Arco superciliar', 'p.lips': 'Grosor de labios', 'p.mouthWidth': 'Ancho de boca',
  'p.eyeSize': 'Tamaño de ojos', 'p.eyeSpacing': 'Separación de ojos', 'p.eyeTilt': 'Inclinación de ojos', 'p.lids': 'Párpados caídos', 'p.eyeColor': 'Color de ojos', 'p.heterochromia': 'Dos colores de ojos', 'p.eyeColor2': 'Segundo color de ojos', 'p.browThickness': 'Grosor de cejas', 'p.browArch': 'Arco de cejas',
  'p.hairStyle': 'Peinado', 'p.hairColor': 'Color de pelo', 'p.gray': 'Canas', 'p.hairVolume': 'Volumen', 'p.facialHair': 'Vello facial', 'p.stubble': 'Barba de días',
  'p.top': 'Parte de arriba', 'p.topColor': 'Color de arriba', 'p.print': 'Estampado', 'p.bottom': 'Parte de abajo', 'p.bottomColor': 'Color de abajo', 'p.shoes': 'Zapatos', 'p.shoesColor': 'Color de zapatos', 'p.outer': 'Abrigo', 'p.outerColor': 'Color del abrigo', 'p.hat': 'Sombrero', 'p.hatColor': 'Color del sombrero',
  'p.glasses': 'Gafas', 'p.hearingAid': 'Audífono', 'p.dirtiness': 'Suciedad', 'p.wear': 'Desgaste de ropa',
  'p.voicePitch': 'Tono de voz', 'p.voiceRate': 'Velocidad al hablar', 'p.walkStyle': 'Forma de andar',
  'o.eyeColor.dark-brown': 'Marrón oscuro', 'o.eyeColor.brown': 'Marrón', 'o.eyeColor.hazel': 'Avellana', 'o.eyeColor.amber': 'Ámbar', 'o.eyeColor.green': 'Verde', 'o.eyeColor.blue': 'Azul', 'o.eyeColor.light-blue': 'Azul claro', 'o.eyeColor.gray': 'Gris',
  'o.hairStyle.bald': 'Calvo', 'o.hairStyle.buzz': 'Rapado', 'o.hairStyle.crew': 'Corte militar', 'o.hairStyle.side-part': 'Raya al lado', 'o.hairStyle.messy': 'Despeinado', 'o.hairStyle.slick-back': 'Engominado', 'o.hairStyle.curly-short': 'Rizos cortos', 'o.hairStyle.afro': 'Afro', 'o.hairStyle.mohawk': 'Cresta', 'o.hairStyle.bob': 'Melena corta', 'o.hairStyle.long-straight': 'Largo liso', 'o.hairStyle.long-wavy': 'Largo ondulado', 'o.hairStyle.ponytail': 'Coleta', 'o.hairStyle.bun': 'Moño', 'o.hairStyle.mullet': 'Mullet', 'o.hairStyle.receding': 'Entradas', 'o.hairStyle.comb-over': 'Cortinilla', 'o.hairStyle.shag': 'Shag',
  'o.hairColor.black': 'Negro', 'o.hairColor.dark-brown': 'Castaño oscuro', 'o.hairColor.brown': 'Castaño', 'o.hairColor.light-brown': 'Castaño claro', 'o.hairColor.auburn': 'Caoba', 'o.hairColor.ginger': 'Pelirrojo', 'o.hairColor.strawberry': 'Rubio rojizo', 'o.hairColor.blonde': 'Rubio', 'o.hairColor.platinum': 'Platino', 'o.hairColor.gray': 'Gris', 'o.hairColor.white': 'Blanco', 'o.hairColor.dyed-red': 'Teñido rojo', 'o.hairColor.dyed-blue': 'Teñido azul', 'o.hairColor.dyed-pink': 'Teñido rosa', 'o.hairColor.dyed-green': 'Teñido verde',
  'o.facialHair.none': 'Afeitado', 'o.facialHair.stubble': 'Barba de días', 'o.facialHair.mustache': 'Bigote', 'o.facialHair.horseshoe': 'Bigote herradura', 'o.facialHair.goatee': 'Perilla', 'o.facialHair.soul-patch': 'Mosca', 'o.facialHair.chin-strap': 'Barba de contorno', 'o.facialHair.full': 'Barba completa', 'o.facialHair.long': 'Barba larga', 'o.facialHair.mutton-chops': 'Patillas largas',
  'o.top.tshirt': 'Camiseta', 'o.top.tank': 'Camiseta de tirantes', 'o.top.button': 'Camisa', 'o.top.hoodie': 'Sudadera', 'o.top.polo': 'Polo', 'o.top.dress': 'Vestido', 'o.top.dealer': 'Uniforme de crupier', 'o.top.security': 'Uniforme de seguridad', 'o.top.clerk': 'Camisa de recepcionista',
  'o.bottom.jeans': 'Vaqueros', 'o.bottom.slacks': 'Pantalón de vestir', 'o.bottom.shorts': 'Pantalón corto', 'o.bottom.skirt': 'Falda', 'o.bottom.cargo': 'Pantalón cargo',
  'o.shoes.sneakers': 'Zapatillas', 'o.shoes.boots': 'Botas de trabajo', 'o.shoes.dress': 'Zapatos de vestir', 'o.shoes.cowboy': 'Botas vaqueras', 'o.shoes.slides': 'Chanclas',
  'o.outer.none': 'Ninguno', 'o.outer.jacket': 'Cazadora', 'o.outer.denim-jacket': 'Chaqueta vaquera', 'o.outer.leather-jacket': 'Chaqueta de cuero', 'o.outer.blazer': 'Americana', 'o.outer.vest': 'Chaleco',
  'o.hat.none': 'Ninguno', 'o.hat.cap': 'Gorra', 'o.hat.cowboy': 'Sombrero vaquero', 'o.hat.beanie': 'Gorro', 'o.hat.fedora': 'Fedora',
  'o.glasses.none': 'Ninguna', 'o.glasses.round': 'Redondas', 'o.glasses.square': 'Cuadradas', 'o.glasses.aviator': 'De aviador', 'o.glasses.reading': 'De lectura', 'o.glasses.sunglasses': 'De sol',
  'o.birthmark.none': 'Ninguna', 'o.birthmark.cheek': 'Mejilla', 'o.birthmark.forehead': 'Frente', 'o.birthmark.neck': 'Cuello', 'o.birthmark.temple': 'Sien',
  'o.scar.none': 'Ninguna', 'o.scar.brow': 'Ceja', 'o.scar.cheek': 'Mejilla', 'o.scar.lip': 'Labio', 'o.scar.chin': 'Barbilla', 'o.scar.nose': 'Nariz',
  'o.walkStyle.natural': 'Natural', 'o.walkStyle.swagger': 'Chulesco', 'o.walkStyle.bouncy': 'Saltarín', 'o.walkStyle.slouchy': 'Encorvado', 'o.walkStyle.stiff': 'Rígido',
  'o.print.none': 'Liso', 'o.print.dice': 'Dados de la suerte', 'o.print.stripe': 'Franja', 'o.print.reno': 'Reno', 'o.print.cherries': 'Cerezas', 'o.print.pocket': 'Bolsillo',
  'o.color.black': 'Negro', 'o.color.charcoal': 'Carbón', 'o.color.gray': 'Gris', 'o.color.white': 'Blanco', 'o.color.cream': 'Crema', 'o.color.navy': 'Azul marino', 'o.color.denim': 'Vaquero', 'o.color.sky': 'Celeste', 'o.color.red': 'Rojo', 'o.color.maroon': 'Granate', 'o.color.orange': 'Naranja', 'o.color.mustard': 'Mostaza', 'o.color.olive': 'Oliva', 'o.color.forest': 'Verde bosque', 'o.color.teal': 'Verde azulado', 'o.color.purple': 'Morado', 'o.color.pink': 'Rosa', 'o.color.tan': 'Canela', 'o.color.khaki': 'Caqui', 'o.color.brown': 'Marrón',
  'expr.neutral': 'Neutral', 'expr.happy': 'Feliz', 'expr.sad': 'Triste', 'expr.angry': 'Enfadado', 'expr.scared': 'Asustado', 'expr.hungover': 'Con resaca', 'expr.disgusted': 'Asqueado', 'expr.surprised': 'Sorprendido', 'expr.smug': 'Engreído', 'expr.nervous': 'Nervioso',
};

i18n.register('character', { en: EN, es: ES });
