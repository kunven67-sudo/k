// Reference items for FOOD_CONTRACT.md (they're real items in the game too):
// a Gala apple, a 500 mL bottle of spring water, and the 24-pack case the bottles come in.

import * as THREE from 'three';
import { cyl, box, lathe } from '../parts.js';
import { registerMaterial, registerPhysical, registerLabel, canvasTex, heightToNormal, cached } from '../materials.js';
import { mulberry32 } from '../../core/noise.js';

// ---------- apple skin: Gala = red-orange streaks over yellow, tiny pale lenticels, waxy shine ----------
registerMaterial('produce-apple', (variety = 'gala') => {
  const t = cached('produce-apple-' + variety, () => {
    const W = 512, H = 512, rand = mulberry32(95);
    const hgt = new Float32Array(W * H);
    const map = canvasTex((ctx) => {
      // v (y) runs bottom -> top of the apple; u (x) runs around it
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, '#d9b13f'); g.addColorStop(0.25, '#e0a33a'); g.addColorStop(0.55, '#c8452b'); g.addColorStop(0.9, '#b8372a'); g.addColorStop(1, '#8f6b2c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // streaks: thin vertical red stripes that fade toward the bottom (the sunny side is redder)
      for (let i = 0; i < 260; i++) {
        const x = rand() * W, w = 1 + rand() * 5, top = rand() * H * 0.2, len = H * (0.45 + rand() * 0.45);
        const sg = ctx.createLinearGradient(0, top, 0, top + len);
        const a = 0.18 + rand() * 0.35 * (0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2));
        sg.addColorStop(0, `rgba(150,28,22,${a})`); sg.addColorStop(1, 'rgba(150,28,22,0)');
        ctx.fillStyle = sg; ctx.fillRect(x, top, w, len);
      }
      // lenticels (tiny pale dots)
      for (let i = 0; i < 1400; i++) {
        const x = rand() * W, y = rand() * H, r = 0.6 + rand() * 1.1;
        ctx.fillStyle = `rgba(245,225,170,${0.35 + rand() * 0.4})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        hgt[(Math.floor(y) % H) * W + (Math.floor(x) % W)] = 1;
      }
      // russet around the stem cavity (top) + the calyx (bottom)
      const rg = ctx.createLinearGradient(0, 0, 0, H * 0.06);
      rg.addColorStop(0, 'rgba(110,84,40,0.9)'); rg.addColorStop(1, 'rgba(110,84,40,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H * 0.06);
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 0.6) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.35 });
});
registerPhysical('produce-apple', { density: 820, friction: 0.6, sound: 'soft' });

// the core left over: cream flesh going brown at the bitten edges
registerMaterial('produce-applecore', () => {
  const map = cached('produce-applecore', () => canvasTex((ctx, w, h) => {
    const rand = mulberry32(7);
    ctx.fillStyle = '#efe3c2'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { ctx.fillStyle = `rgba(${150 + rand() * 40},${110 + rand() * 30},60,${rand() * 0.25})`; ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 6, 2 + rand() * 6); }
    ctx.fillStyle = 'rgba(160,40,30,0.8)'; ctx.fillRect(0, 0, w, h * 0.08); ctx.fillRect(0, h * 0.92, w, h * 0.08);
  }, { w: 256, h: 256 }));
  return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
});
registerPhysical('produce-applecore', { density: 700, friction: 0.7, sound: 'soft' });

// ---------- water bottle label (wraps once around; the middle of the image faces you) ----------
registerLabel('drinks-water-label', {
  w: 1024, h: 300, finish: 'gloss',
  draw(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f4fbff'); g.addColorStop(1, '#bfe2f5');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8f2f8'; ctx.fillRect(0, h - 4, w, 4);
    // mountains across the front
    ctx.fillStyle = '#5fa3cf';
    ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.78);
    [[0.36, 0.45], [0.42, 0.6], [0.5, 0.3], [0.58, 0.58], [0.64, 0.42], [0.72, 0.78]].forEach(([x, y]) => ctx.lineTo(w * x, h * y));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.42); ctx.lineTo(w * 0.5, h * 0.3); ctx.lineTo(w * 0.54, h * 0.42); ctx.lineTo(w * 0.5, h * 0.38); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f4c81'; ctx.font = '700 64px Inter, sans-serif'; ctx.fillText('CLEARWELL', w * 0.5, h * 0.22);
    ctx.font = '600 30px Inter, sans-serif'; ctx.fillText('NATURAL SPRING WATER', w * 0.5, h * 0.92);
    // the sides: volume + the boring legal stuff
    ctx.font = '600 22px Inter, sans-serif'; ctx.fillStyle = '#245b86';
    ctx.fillText('16.9 FL OZ (500 mL)', w * 0.18, h * 0.55); ctx.fillText('16.9 FL OZ (500 mL)', w * 0.82, h * 0.55);
    ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#35607f';
    ['Nutrition Facts', 'Calories 0  ·  Sodium 0 mg', 'Bottled at the source', 'Coast Springs, CA', 'Please recycle ♻'].forEach((l, i) => ctx.fillText(l, w * 0.04 + 60, h * 0.25 + i * 26));
  },
});

// ---------- shapes ----------
// a real 500 mL PET bottle: petaloid feet, ribbed waist, shoulder, neck. r 3.25 cm, 20.5 cm with the cap
const BOTTLE = [[0, 0.003], [0.02, 0.0], [0.029, 0.004], [0.0325, 0.016], [0.0325, 0.118], [0.0305, 0.124], [0.0325, 0.13], [0.0325, 0.148],
  [0.0305, 0.162], [0.024, 0.175], [0.016, 0.183], [0.0135, 0.187], [0.0135, 0.194]];
const LIQUID = [[0, 0.004], [0.019, 0.0018], [0.0275, 0.0055], [0.0312, 0.017], [0.0312, 0.117], [0.0293, 0.124], [0.0312, 0.131], [0.0312, 0.147], [0.0293, 0.16], [0.024, 0.169], [0, 0.169]];

function waterBottleParts(x = 0, z = 0, unit) {
  const u = unit == null ? {} : { unit };
  return [
    lathe(BOTTLE, x, 0, z, 'clearplastic', { seg: 32, col: false, pack: true, ...u }),
    lathe(LIQUID, x, 0, z, 'liquid:0xd2e9f1:0.2', { seg: 28, col: false, liquid: true, ...u }),
    cyl(0.0329, 0.058, x, 0.087, z, 'label:drinks-water-label', { seg: 40, uv: 'wrap', col: false, pack: true, ...u }),
    cyl(0.0158, 0.016, x, 0.2015, z, 'plastic:0x2a78d6', { seg: 24, col: false, closed: true, ...u }),       // the cap
    cyl(0.0168, 0.0025, x, 0.188, z, 'plastic:0x2a78d6', { seg: 24, col: false, pack: true, ...u }),        // tamper ring stays
    cyl(0.0325, 0.2, x, 0.1, z, 'clearplastic', { seg: 16, vis: false, ...u }),                            // collision
  ];
}

export default [
  {
    id: 'produce-apple-gala', aisle: 'produce', name: 'Gala Apple', brand: 'Orchard Lane', price: 0.75, mass: 0.18,
    rating: 4.6, reviews: 1834,
    blurb: 'Sweet, crisp Gala from Washington. Keeps about 3 weeks on the counter, 6 in the fridge.',
    quotes: ['"Crunchy every time."', '"Sweeter than Fuji, not as tart as Granny Smith."'],
    food: {
      kind: 'food',
      eat: { kcal: 95, waterL: 0.156, proteinG: 0.5, carbsG: 25, sugarG: 19, fatG: 0.3, fiberG: 4.4, sodiumMg: 2, caffeineMg: 0 },
      netKg: 0.163, bites: 11, bite: 'dent', open: null,
      keep: 'room', shelf: { room: 21, fridge: 42, freezer: 240, opened: 0 },
      taste: ['Crisp and sweet, a little tart.', 'Juicy. Really good apple.', 'Sweet, with that Gala floral thing.'],
      sound: 'crunch', leftover: 'keep',
    },
    build() {
      // 7.5 cm wide, 7 cm tall, dimpled at the stem + the bottom
      const skin = [[0, 0.0045], [0.008, 0.0035], [0.016, 0.0012], [0.022, 0.0], [0.028, 0.0028], [0.033, 0.009], [0.0362, 0.018], [0.0376, 0.028],
        [0.0378, 0.037], [0.0368, 0.046], [0.0342, 0.055], [0.0298, 0.0625], [0.0238, 0.0675], [0.0172, 0.0695], [0.011, 0.0672], [0.006, 0.0635], [0.0025, 0.0618], [0, 0.0615]];
      const core = [[0, 0.004], [0.007, 0.0045], [0.0115, 0.011], [0.0125, 0.02], [0.0105, 0.031], [0.0112, 0.042], [0.014, 0.052], [0.0115, 0.06], [0.006, 0.0635], [0, 0.064]];
      return { mass: 0.18, parts: [
        lathe(skin, 0, 0, 0, 'produce-apple:gala', { seg: 36, eat: true }),
        lathe(core, 0, 0, 0, 'produce-applecore', { seg: 18, leftover: true }),
        cyl(0.0016, 0.016, 0.0012, 0.068, 0, 'wood:walnut', { seg: 6, rot: [0, 0, -12], col: false }), // stem
      ] };
    },
  },
  {
    id: 'drinks-water-500', aisle: 'drinks', name: 'Natural Spring Water, 16.9 fl oz', brand: 'Clearwell', price: 1.29, mass: 0.511,
    rating: 4.7, reviews: 22140,
    blurb: '500 mL of spring water in a recyclable PET bottle. Twist the cap to open.',
    quotes: ['"It\'s water. Tastes clean, no plastic taste."', '"Cap is easy to twist off, which is all I ask."'],
    food: {
      kind: 'drink',
      eat: { kcal: 0, waterL: 0.5, proteinG: 0, carbsG: 0, sugarG: 0, fatG: 0, fiberG: 0, sodiumMg: 5, caffeineMg: 0 },
      netKg: 0.5, bites: 12, bite: 'level', open: 'cap',
      keep: 'room', shelf: { room: 730, fridge: 730, freezer: 730, opened: 7 },
      taste: ['Cold, clean water.', 'Refreshing.'],
      sound: 'gulp', leftover: 'keep',
    },
    build() { return { mass: 0.511, parts: waterBottleParts() }; },
  },
  {
    id: 'drinks-water-500-24pk', aisle: 'drinks', name: 'Natural Spring Water, 24-pack', brand: 'Clearwell', price: 5.99, mass: 12.33,
    rating: 4.8, reviews: 31877,
    blurb: '24 bottles x 16.9 fl oz on a cardboard tray in shrink wrap. About 27 lb: lift with your legs.',
    quotes: ['"Best price per bottle anywhere."', '"The plastic wrap is impossible to rip until it suddenly isn\'t."'],
    food: {
      kind: 'drink',
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: null,
      units: 24, unitId: 'drinks-water-500',
      keep: 'room', shelf: { room: 730, fridge: 730, freezer: 730, opened: 0 },
      taste: ['Water.'], sound: 'gulp', leftover: 'keep',
    },
    build() {
      const parts = [box(0.4, 0.018, 0.268, 0, 0.009, 0, 'cardboard', { pack: true })];   // the tray
      let i = 0;
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
        parts.push(...waterBottleParts(-0.165 + col * 0.066, -0.099 + row * 0.066, i++).map((p) => ({ ...p, p: [p.p[0], p.p[1] + 0.006, p.p[2]] })));
      }
      return { mass: 12.33, parts };
    },
  },
];
