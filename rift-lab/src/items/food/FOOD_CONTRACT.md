# Food item contract (Rift Lab)

Every grocery aisle is one file in `src/items/food/<aisle>.js` that does `export default [ ...items ]`.
The eating engine (`src/items/consume.js`) reads exactly the fields below, so stick to them.

Rule zero: **as real as real life.** Real sizes (meters), real weights (kg), real 2026 US grocery
prices (USD), real nutrition (USDA-style numbers for that product), real shelf life (USDA FoodKeeper-style),
real packaging. **Made-up brands only** (never a real brand, logo or trademark: no Coca-Cola, Lay's, Oreo, Heinz...).

## Item

```js
import { box, cyl, cone, sph, cap, lathe, curve } from '../parts.js';
import { registerMaterial, registerPhysical, registerLabel, canvasTex, cached } from '../materials.js';

export default [{
  id: 'produce-apple-gala',     // unique, kebab-case, MUST start with the aisle name + '-'
  aisle: 'produce',             // produce | drinks | bakery | snacks | fridge | frozen | pantry
  name: 'Gala Apple',           // store page title
  brand: 'Orchard Lane',        // made-up brand
  price: 0.89,                  // USD for this exact thing as sold
  mass: 0.18,                   // kg, WHOLE thing as sold (package + contents)
  rating: 4.6, reviews: 1834,   // believable
  blurb: 'One sentence like a real store listing. Mention storage if it matters.',
  quotes: ['"A short, real-sounding review."', '"Another one."'],
  shop: true,                   // false = not sold on its own (e.g. one egg; you take it out of the carton)
  food: { ... },                // see below
  build(o) { return { mass: 0.18, parts: [ ... ] }; },   // o = chosen options (usually {}). mass must equal item mass
}]
```

## food block

```js
food: {
  kind: 'food',                 // 'food' | 'drink'
  // nutrition for ALL the edible contents of ONE of this thing (the whole apple, the whole 500 mL bottle,
  // the whole bag of chips). Water = the water the food/drink gives you (apple ~0.15 L, 500 mL water = 0.5).
  eat: { kcal: 95, waterL: 0.15, proteinG: 0.5, carbsG: 25, sugarG: 19, fatG: 0.3, fiberG: 4.4, sodiumMg: 2, caffeineMg: 0 },
  netKg: 0.17,                  // kg of the edible contents (the item gets this much lighter as you finish it)
  bites: 10,                    // bites (food) or sips (drink) to finish it. Real: a bite ~ 15-25 g, a sip ~ 30-40 mL
  bite: 'dent',                 // how it looks smaller as you eat, see "Bite looks"
  open: null,                   // how you open it first (one click), or null if ready to eat:
                                //   'cap' (screw cap) 'tab' (can pull-tab) 'tear' (bag/packet) 'peel' (banana/orange/yogurt foil)
                                //   'lid' (tub/clamshell/box flap) 'wrapper' (candy bar) 'carton' (milk/juice spout) 'twist' (bread twist tie)
                                //   'knife' (needs a knife + cutting board: can't eat it yet, e.g. a whole watermelon)
  units: 0,                     // multipack: how many single things inside (24 bottles, 12 eggs, 20 slices)...
  unitId: null,                 // ...and the item id of ONE of them (defined in the same aisle). Clicking the pack puts one in your hand.
  raw: false,                   // true = meant to be cooked first (raw chicken, raw egg, frozen pizza, dry pasta, raw potato)
  rawRisk: 0,                   // chance (0..1) eating it raw makes you sick (raw chicken 0.25, ground beef 0.08, egg 0.01)
  keep: 'room',                 // where the package says to keep it: 'room' | 'fridge' | 'freezer'
  shelf: { room: 21, fridge: 60, freezer: 240, opened: 0 },
                                // days until it goes bad at each temperature (unopened). opened = days after opening
                                // at its keep temperature (0 = same as unopened). Use real FoodKeeper-style numbers.
  ripen: null,                  // produce only: { colors: ['#6f9a2b', '#e9cf3a', '#d9b23a', '#6b4a22'] } color stages over its
                                //   shelf life (banana green -> yellow -> spotty -> brown). Applies to parts with ripen: true.
  taste: ['Crisp and sweet, a little tart.', 'Juicy.'],   // one is shown on the first bite
  sound: 'crunch',              // 'crunch' | 'chew' | 'soft' | 'slurp' | 'gulp' | 'fizz' | 'crisp' (chips)
  leftover: 'keep',             // when finished: 'keep' (core, peel, empty bottle/can/bag stays as trash) | 'remove' (nothing left)
}
```

## Part flags (on top of the normal part fields in builder.js)

- `eat: true` the edible mesh (bites apply to it). For `bite: 'hide'` use `eat: 1, 2, 3...` = the order pieces disappear.
- `liquid: true` drink inside a container (its level drops as you drink; only visible through clear containers).
- `pack: true` packaging (never eaten).
- `closed: true` only visible until opened (bottle cap, unbroken seal, wrapper ends, closed lid, twist tie).
- `opened: true` only visible after opening (pulled can tab, open lid, torn-open bag top).
- `unit: i` (0-based) the i-th single thing in a multipack. Taken out highest index first; when taken its parts
  disappear AND stop colliding, so give each unit its own simple collision shape (e.g. one cyl per bottle,
  details `col: false`) and the tray/box its own (`pack: true`).
- `leftover: true` hidden until it's finished (apple core, banana peel, pit). When finished, eat + liquid parts vanish
  (shape AND collision) and leftover parts appear (shape AND collision), so give the leftover a real small shape.
- `ripen: true` color follows `food.ripen`.
- `col: false` no collision (labels, thin details, contents inside a box). Keep ONE solid collision shape per main volume.

## Bite looks

- `'dent'` round things (apple, pear, peach, tomato, donut, muffin): each bite pushes a real bite-mark into the eat
  mesh at the spot nearest your mouth; finish -> eat parts hide, leftover parts appear. Eat mesh needs enough vertices:
  use `lathe` with 12+ profile points and seg 28+, or sph with seg 24+.
- `'hide'` things made of pieces (chocolate bar squares, pizza slices, cookies in a sleeve, sandwich halves, grapes):
  eat parts numbered 1..n vanish in order. bites can be more than n (pieces vanish proportionally).
- `'level'` drinks: `liquid: true` parts shrink from the bottom up (scale on y). Use for every drink.
- `'none'` you can't see it change (opaque bag of chips, cereal box).

## Materials + labels

Built-in keys you can use:
- `'label:<id>'` your printed packaging (register it, below). `'label:<id>:matte'` paper/card, `':gloss'` coated/film, `':foil'` chip bag.
- `'liquid:<0xRRGGBB>'` or `'liquid:<0xRRGGBB>:<opacity>'` a drink (water `liquid:0xd2e9f1:0.2`, cola `liquid:0x2a1208:0.92`, milk `liquid:0xf6f4ee:1`).
- `'clearplastic'` clear PET bottle / clamshell (see-through, doesn't shatter). `'clearplastic:0xRRGGBB'` tinted.
- `'glass:clear'` real glass jars/bottles (they SHATTER when dropped hard).
- `'plastic:0xRRGGBB'` caps, tubs, trays. `'metal:steel'` / `'metal:chrome'` can bodies + lids. `'cardboard'` plain brown box.
- `'paint:White'`, `'foam'`, `'rubber'`.

Register your own (ids MUST start with your aisle name + '-'):
```js
registerLabel('drinks-cola-can', { w: 1024, h: 512, finish: 'gloss', draw(ctx, w, h) { /* canvas 2D drawing */ } });
registerMaterial('produce-apple', (variety) => new THREE.MeshPhysicalMaterial({ map: cached('produce-apple-' + variety, () => canvasTex((ctx, w, h) => {...})), roughness: 0.35, clearcoat: 0.4 }));
registerPhysical('produce-apple', { density: 800, friction: 0.6, sound: 'soft' });
```
Import THREE as `import * as THREE from 'three';`. Material keys split on ':', so 'produce-apple:red' calls your fn('red').
Food surfaces (skin, crust, meat, cheese) should get a canvas texture with real detail: speckles, lenticels,
gradients, pores, crumb, marbling. Avoid flat single colors: this game's rule is "everything must look fire".

How labels land on shapes (set `uv` on the part):
- box with `uv: 'atlas'` (and NO round): the texture is a 3x2 sheet. Top row cells = +x side, -x side, top (+y).
  Bottom row cells = bottom (-y), FRONT (+z), back (-z). Each cell is w/3 x h/2 pixels, its image upright (v up).
  The front of every item faces +z (toward the player when placed).
- cyl / cone / lathe with `uv: 'wrap'`: u goes once around, the seam is at the BACK and u = 0.5 (the middle of
  your label image) faces the FRONT (+z); v = bottom -> top of the part. Draw the label's main face in the middle of the image.
  Cylinder caps sample the texture's bottom-left pixel: make that pixel the cap color, or put a separate lid part on top.
- `uv: 'fit'` 0..1 on every face.

## Geometry rules

- y = 0 is the bottom (resting on the table), centered on x/z. Front faces +z.
- Use real dimensions: 12 oz can r 0.033 h 0.122; 500 mL bottle r 0.033 h 0.205; gallon jug ~0.15 x 0.15 x 0.26.
- Keep collision simple (1-3 solid shapes per item); give details `col: false`.
- Physics must be stable: things should rest without jittering, rolling forever, or sinking.
- Don't make anything absurdly big or tiny for its weight (density check: mass / bounding volume 30..1500 kg/m3).

## Reference example

`src/items/food/_example.js` (a Gala apple, a 500 mL water bottle, and the 24-pack case it comes in) shows the
quality bar: real dimensions, a lathe-shaped apple with a speckled skin texture, a printed wrap label, a cap that
comes off, liquid that drains, a multipack with 24 takeable units. Copy its patterns. Don't import it.

## Check your work

`node <scratchpad>/foodcheck.mjs <aisle>` loads `tools/foodlab.html?aisle=<aisle>`. It validates every item,
drop-tests it in real physics, renders a store photo of each into `<scratchpad>/shots/food/<id>.jpg`
plus `<aisle>-lineup.png` (all items side by side at real scale), and prints a JSON report.
Look at the PNGs (Read tool) and fix anything that doesn't look like the real product.
