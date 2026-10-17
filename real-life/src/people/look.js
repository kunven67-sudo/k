// What a person looks like, as plain JSON (saved in the life file) + genetics.
//
//   randomLook(rng, { sex, age })           -> look
//   childLook(rng, mom, dad, sex)          -> a look mixed from both parents' genes
//   lookAtAge(look, age)                   -> derived look for that age (grey hair, beard...)
//
// Look fields: sex 'f'|'m', skin (0..1 light->dark), hair (colour hex), hairStyle, eyes (hex),
// height (0..1 genetic tall-ness), build (0..1 skinny->big), face { nose, ears, cheeks, brows },
// freckles, glasses, outfit { top, topColor, bottom, bottomColor, shoes, shoeColor, hat }.

import { clamp, lerp } from '../core/util.js';

export const SKIN_TONES = ['#ffe3cf', '#f7d2b6', '#eebf9b', '#dca47c', '#c4895f', '#a76d48', '#865436', '#683f28', '#4e2f1e'];
export const HAIR_COLORS = {
  black: '#1c1714', darkBrown: '#3a2719', brown: '#5c3b22', lightBrown: '#8a5d34', auburn: '#8e3b1f',
  red: '#b5532a', dirtyBlond: '#b48d55', blond: '#e1c27a', platinum: '#efe2bb', gray: '#a9a6a2', white: '#eceae6',
};
export const EYE_COLORS = { brown: '#5a3a1e', darkBrown: '#2f1d10', hazel: '#7a6230', green: '#3f7d4a', blue: '#3c78c2', gray: '#6f7d8a' };
export const HAIR_STYLES = {
  f: ['long', 'ponytail', 'bun', 'bob', 'curly', 'braids', 'pigtails', 'short', 'afro'],
  m: ['short', 'buzz', 'side', 'curly', 'spiky', 'afro', 'messy', 'long', 'bald'],
};
export const TOPS = ['tee', 'hoodie', 'longsleeve', 'polo', 'tank', 'sweater', 'button'];
export const BOTTOMS = ['jeans', 'pants', 'shorts', 'skirt', 'sweats'];
export const CLOTH_COLORS = ['#e8463a', '#3a7be8', '#f2c230', '#3ab86a', '#9b59b6', '#f08c2e', '#ffffff', '#2c2c2c', '#e86aa6', '#4fd1c5', '#8b5a2b', '#1f3a5f', '#b8c2cc', '#6b8e23', '#c0392b', '#ffd6e0', '#c7e8ff', '#7a5cff'];
export const PANTS_COLORS = ['#2f4a73', '#1f2a44', '#3b3b3b', '#5a4632', '#6d7a86', '#1a1a1a', '#4a5d23', '#7a1f2b', '#a7b4c2', '#c8b38c'];
export const SHOE_COLORS = ['#1a1a1a', '#f2f2f2', '#8b5a2b', '#c0392b', '#2c3e50', '#3a7be8'];

const HAIR_KEYS = Object.keys(HAIR_COLORS);
const EYE_KEYS = Object.keys(EYE_COLORS);

/** Gene value: two alleles 0..1, the person shows the average with a little noise. */
function mixGene(a, b, rng, spread = 0.08) {
  const pa = rng.chance(0.5) ? a : a + rng.gaussian(0, spread);
  const pb = rng.chance(0.5) ? b : b + rng.gaussian(0, spread);
  return clamp((pa + pb) / 2 + rng.gaussian(0, spread * 0.5), 0, 1);
}

export function randomOutfit(rng, sex, age) {
  const kid = age < 13;
  const top = rng.pick(kid ? ['tee', 'tee', 'hoodie', 'longsleeve', 'sweater'] : TOPS);
  let bottom = rng.pick(sex === 'f' ? ['jeans', 'pants', 'shorts', 'skirt', 'jeans'] : ['jeans', 'pants', 'shorts', 'jeans', 'sweats']);
  if (age > 60 && bottom === 'shorts') bottom = 'pants';
  return {
    top,
    topColor: rng.pick(CLOTH_COLORS),
    graphic: rng.chance(kid ? 0.6 : 0.3) ? rng.int(0, 5) : -1, // shirt print
    bottom,
    bottomColor: rng.pick(PANTS_COLORS),
    shoes: rng.pick(['sneakers', 'sneakers', 'boots', 'flats']),
    shoeColor: rng.pick(SHOE_COLORS),
    hat: rng.chance(0.08) ? rng.pick(['cap', 'beanie']) : null,
    hatColor: rng.pick(CLOTH_COLORS),
  };
}

export function randomLook(rng, { sex = rng.pick(['f', 'm']), age = 30 } = {}) {
  const skin = clamp(rng.next() * 1.05, 0, 1);
  const hairKey = skin > 0.55 ? rng.pick(['black', 'darkBrown', 'darkBrown', 'brown']) : rng.pick(HAIR_KEYS.slice(0, 9));
  return {
    sex,
    skin,
    hairGene: HAIR_KEYS.indexOf(hairKey) / (HAIR_KEYS.length - 3),
    hair: HAIR_COLORS[hairKey],
    hairStyle: rng.pick(HAIR_STYLES[sex]),
    eyeGene: skin > 0.55 ? rng.range(0, 0.25) : rng.next(),
    eyes: null,
    height: rng.next(),
    build: clamp(rng.gaussian(0.45, 0.2), 0, 1),
    face: { nose: rng.next(), ears: rng.next(), cheeks: rng.next(), brows: rng.next() },
    freckles: skin < 0.3 && rng.chance(0.3) ? rng.range(0.3, 1) : 0,
    glasses: rng.chance(age > 45 ? 0.4 : 0.12),
    metabolism: rng.next(), // high = stays skinny on junk food (gene)
    outfit: randomOutfit(rng, sex, age),
  };
}

/** A baby's look from both parents' genes. */
export function childLook(rng, mom, dad, sex = rng.pick(['f', 'm'])) {
  const skin = mixGene(mom.skin, dad.skin, rng, 0.05);
  const hairGene = mixGene(mom.hairGene ?? 0.3, dad.hairGene ?? 0.3, rng, 0.12);
  const eyeGene = rng.chance(0.5) ? mom.eyeGene ?? 0.2 : dad.eyeGene ?? 0.2;
  return {
    sex,
    skin,
    hairGene,
    hair: geneHair(hairGene, skin),
    hairStyle: rng.pick(HAIR_STYLES[sex].filter((s) => s !== 'bald')),
    eyeGene: mixGene(eyeGene, eyeGene, rng, 0.04),
    eyes: null,
    height: mixGene(mom.height, dad.height, rng, 0.1),
    build: mixGene(mom.build, dad.build, rng, 0.12),
    face: {
      nose: rng.chance(0.5) ? mom.face.nose : dad.face.nose,
      ears: rng.chance(0.5) ? mom.face.ears : dad.face.ears,
      cheeks: mixGene(mom.face.cheeks, dad.face.cheeks, rng),
      brows: rng.chance(0.5) ? mom.face.brows : dad.face.brows,
    },
    freckles: (mom.freckles || dad.freckles) && rng.chance(0.6) ? rng.range(0.3, 1) : 0,
    glasses: false,
    metabolism: mixGene(mom.metabolism ?? 0.5, dad.metabolism ?? 0.5, rng, 0.1),
    outfit: randomOutfit(rng, sex, 8),
  };
}

function geneHair(g, skin) {
  if (skin > 0.6) return g < 0.5 ? HAIR_COLORS.black : HAIR_COLORS.darkBrown;
  const order = ['black', 'darkBrown', 'brown', 'lightBrown', 'auburn', 'red', 'dirtyBlond', 'blond', 'platinum'];
  return HAIR_COLORS[order[clamp(Math.round(g * (order.length - 1)), 0, order.length - 1)]];
}

export function eyeColor(look) {
  if (look.eyes) return look.eyes;
  const g = look.eyeGene ?? 0.2;
  const k = g < 0.35 ? (g < 0.15 ? 'darkBrown' : 'brown') : g < 0.5 ? 'hazel' : g < 0.68 ? 'green' : g < 0.88 ? 'blue' : 'gray';
  return EYE_COLORS[k];
}

export function skinColor(look) {
  const t = clamp(look.skin, 0, 1) * (SKIN_TONES.length - 1);
  const i = Math.floor(t);
  const a = SKIN_TONES[i];
  const b = SKIN_TONES[Math.min(SKIN_TONES.length - 1, i + 1)];
  return lerpHex(a, b, t - i);
}

export function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** Body measurements for an age (years). Toy proportions: heads are big, more so the younger. */
export function bodyAt(look, age) {
  const sex = look.sex;
  const adultH = (sex === 'm' ? 1.74 : 1.62) + (look.height - 0.5) * 0.2;
  // Growth curve: newborn ~0.5, 1y 0.75, 8y ~0.73 of adult, 13y ~0.88, 17y adult.
  const curve = [[0, 0.3], [1, 0.44], [2, 0.5], [4, 0.6], [8, 0.74], [11, 0.82], [13, 0.89], [15, 0.96], [17, 1], [70, 1], [90, 0.97]];
  let f = 1;
  for (let i = 0; i < curve.length - 1; i++) {
    const [a0, h0] = curve[i];
    const [a1, h1] = curve[i + 1];
    if (age >= a0 && age <= a1) {
      f = lerp(h0, h1, (age - a0) / (a1 - a0));
      break;
    }
  }
  const height = adultH * f;
  // Head share of the height (toy style: bigger than real life).
  const headShare = age < 2 ? 0.36 : age < 6 ? 0.32 : age < 12 ? 0.29 : age < 16 ? 0.265 : 0.245;
  const legShare = age < 2 ? 0.26 : age < 6 ? 0.3 : age < 12 ? 0.33 : age < 16 ? 0.36 : 0.37;
  const width = age < 2 ? 1.15 : age < 12 ? 1.0 : 1.0 + (sex === 'm' && age >= 15 ? 0.06 : 0);
  const build = clamp(look.build + (age > 40 ? (age - 40) / 120 : 0), 0, 1);
  return {
    height,
    headD: height * headShare, // head diameter
    legH: height * legShare, // hip joint to floor
    torsoH: height * (1 - headShare - legShare) * 0.92,
    width: width * (0.84 + build * 0.38),
    build,
    stage: age < 1 ? 'baby' : age < 3 ? 'toddler' : age < 13 ? 'kid' : age < 18 ? 'teen' : age < 65 ? 'adult' : 'old',
  };
}

/** The look with age applied: grey hair, receding hair, beard, glasses. */
export function lookAtAge(look, age) {
  const L = structuredClone(look);
  if (age >= 45) {
    const grey = clamp((age - 45) / 30, 0, 1);
    L.hair = lerpHex(L.hair, age > 75 ? HAIR_COLORS.white : HAIR_COLORS.gray, grey);
  }
  if (L.sex === 'm' && age > 55 && (look.face.brows > 0.6) && L.hairStyle !== 'bald') L.hairStyle = 'short';
  if (age < 1) L.hairStyle = 'baby';
  else if (age < 3 && !['short', 'curly', 'pigtails', 'afro'].includes(L.hairStyle)) L.hairStyle = L.sex === 'f' ? 'pigtails' : 'short';
  L.beard = L.sex === 'm' && age >= 18 && !!look.beard;
  return L;
}
