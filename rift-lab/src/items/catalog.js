// The spawn catalog. Real sizes (meters), real weights (kg), real-ish prices (USD).
// Made-up brands (real ones can't be copied):
//   Studio Kai (modern + minimal), Nordbo (cheap flat-pack), Maison Ardent (luxury),
//   Old Mill Furniture Co. (rustic farmhouse + vintage), Kelvin (appliances), Pura (bathroom),
//   Apex (gaming chairs).
// Every item is a list of parts; the same parts make the 3D model and the physics shapes.

const BRANDS = {
  modern: 'Studio Kai', flatpack: 'Nordbo', luxury: 'Maison Ardent', rustic: 'Old Mill Furniture Co.',
};

// ---------- part helpers (y = 0 is the floor, item centered on x/z) ----------
const box = (w, h, d, x, y, z, mat, o = {}) => ({ s: 'box', size: [w, h, d], p: [x, y, z], mat, ...o });
const cyl = (r, h, x, y, z, mat, o = {}) => ({ s: 'cyl', r, h, p: [x, y, z], mat, ...o });
const cone = (r, r2, h, x, y, z, mat, o = {}) => ({ s: 'cone', r, r2, h, p: [x, y, z], mat, ...o });
const sph = (r, x, y, z, mat, o = {}) => ({ s: 'sphere', r, p: [x, y, z], mat, ...o });
const cap = (r, h, x, y, z, mat, o = {}) => ({ s: 'capsule', r, h, p: [x, y, z], mat, ...o });
const legsAt = (pts, h, r, mat, o = {}) => pts.map(([x, z]) => cyl(r, h, x, h / 2, z, mat, o));
const taperLegs = (pts, h, r, r2, mat) => pts.map(([x, z]) => cone(r, r2, h, x, h / 2, z, mat, { seg: 12 }));
const corners = (w, d, inset) => [[-w / 2 + inset, -d / 2 + inset], [w / 2 - inset, -d / 2 + inset], [-w / 2 + inset, d / 2 - inset], [w / 2 - inset, d / 2 - inset]];

// options
const fabricOpt = (def = 'Stone gray', extra = {}) => ({ label: 'Fabric', choices: ['Stone gray', 'Charcoal', 'Oatmeal', 'Navy', 'Forest green', 'Mustard', 'Terracotta', 'Cream', 'Blush', 'Black'].map((c) => ({ id: c, label: c, price: extra[c] || 0 })), def });
const fabricKindOpt = () => ({ label: 'Material', choices: [{ id: 'woven', label: 'Woven', price: 0 }, { id: 'linen', label: 'Linen', price: 120 }, { id: 'velvet', label: 'Velvet', price: 240 }], def: 'woven' });
const leatherOpt = () => ({ label: 'Leather', choices: ['Cognac', 'Espresso', 'Black', 'Saddle tan', 'Oxblood', 'Ivory'].map((c) => ({ id: c, label: c, price: 0 })), def: 'Cognac' });
const woodOpt = (def, list = ['oak', 'walnut', 'pine', 'maple', 'cherry'], prices = { walnut: 0.25, cherry: 0.18, pine: -0.15, maple: 0.05, ebony: 0.6, whiteoak: 0.1, reclaimed: 0.08 }) => ({
  label: 'Wood', choices: list.map((wd) => ({ id: wd, label: cap1(wd === 'whiteoak' ? 'white oak' : wd), mult: 1 + (prices[wd] || 0) })), def,
});
const metalOpt = (def = 'black') => ({ label: 'Metal', choices: [{ id: 'black', label: 'Black steel', price: 0 }, { id: 'steel', label: 'Brushed steel', price: 20 }, { id: 'brass', label: 'Brass', price: 60 }, { id: 'chrome', label: 'Chrome', price: 40 }], def });
const sizeOpt = (choices, def) => ({ label: 'Size', choices, def });
function cap1(s) { return s[0].toUpperCase() + s.slice(1); }

const ITEMS = [];
const add = (def) => { ITEMS.push(def); return def; };

// =====================================================================
// LIVING ROOM
// =====================================================================
add({
  id: 'sofa-kai', name: 'Kai 3-Seat Sofa', brand: BRANDS.modern, style: 'modern', room: 'Living room', price: 1299, mass: 55,
  rating: 4.6, reviews: 2184, blurb: 'Low, clean lines, deep seats, solid hardwood frame, black steel legs.',
  quotes: ['"Deep enough to nap on. Cushions held their shape after a year."', '"The navy is darker in person but I love it."'],
  options: { kind: fabricKindOpt(), color: fabricOpt('Stone gray'), legs: metalOpt('black'), size: sizeOpt([{ id: '2', label: '2-seat (1.7 m)', price: -300, w: 1.7 }, { id: '3', label: '3-seat (2.2 m)', price: 0, w: 2.2 }, { id: '4', label: '4-seat (2.7 m)', price: 450, w: 2.7 }], '3') },
  build(o) {
    const W = o.size.w, D = 0.95, F = `fabric:${o.kind}:${o.color}`, L = `metal:${o.legs}`;
    const seats = Math.round(W / 0.75);
    const parts = [
      box(W, 0.2, D - 0.04, 0, 0.24, 0.02, F, { round: 0.03 }),                // base
      box(0.2, 0.42, D, -W / 2 + 0.1, 0.4, 0, F, { round: 0.05 }),             // arms
      box(0.2, 0.42, D, W / 2 - 0.1, 0.4, 0, F, { round: 0.05 }),
      box(W - 0.4, 0.42, 0.18, 0, 0.55, -D / 2 + 0.11, F, { round: 0.05 }),    // back frame
      ...legsAt(corners(W, D, 0.08), 0.14, 0.018, L),
    ];
    const cw = (W - 0.4) / seats;
    for (let i = 0; i < seats; i++) {
      const x = -W / 2 + 0.2 + cw * (i + 0.5);
      parts.push(box(cw - 0.01, 0.15, D - 0.24, x, 0.415, 0.08, F, { round: 0.045 }));        // seat cushion
      parts.push(box(cw - 0.02, 0.4, 0.17, x, 0.68, -D / 2 + 0.28, F, { round: 0.07, rot: [-10, 0, 0] })); // back cushion
    }
    return { parts, mass: 55 * W / 2.2 };
  },
});

add({
  id: 'loveseat-nordbo', name: 'KLIPPA Loveseat', brand: BRANDS.flatpack, style: 'flatpack', room: 'Living room', price: 349, mass: 30, flatpack: true,
  rating: 3.9, reviews: 8412, blurb: 'Comes flat in a box. Removable, washable cover. Particle board + pine frame.',
  quotes: ['"Took me 2 hours. One screw was missing so it wobbles a bit lol."', '"Great for the price. Don\'t jump on it."'],
  options: { color: fabricOpt('Charcoal') },
  build(o) {
    const W = 1.5, D = 0.84, F = `fabric:woven:${o.color}`;
    return { mass: 30, parts: [
      box(W, 0.28, D, 0, 0.26, 0, F, { round: 0.015 }),
      box(0.14, 0.5, D, -W / 2 + 0.07, 0.4, 0, F, { round: 0.02 }),
      box(0.14, 0.5, D, W / 2 - 0.07, 0.4, 0, F, { round: 0.02 }),
      box(W - 0.28, 0.42, 0.14, 0, 0.62, -D / 2 + 0.07, F, { round: 0.02 }),
      box(W - 0.3, 0.12, D - 0.2, 0, 0.46, 0.06, F, { round: 0.03 }),
      ...taperLegs(corners(W, D, 0.07), 0.12, 0.022, 0.016, 'wood:pine'),
    ] };
  },
});

add({
  id: 'chesterfield-ardent', name: 'Belmont Chesterfield', brand: BRANDS.luxury, style: 'luxury', room: 'Living room', price: 6800, mass: 88,
  rating: 4.9, reviews: 311, blurb: 'Hand-tufted full-grain leather, rolled arms, kiln-dried oak frame, turned walnut feet.',
  quotes: ['"Smells like a library in the best way."', '"Two delivery guys needed. It is HEAVY."'],
  options: { leather: leatherOpt() },
  build(o) {
    const W = 2.25, D = 0.95, Lt = `leather:${o.leather}`;
    const parts = [
      box(W, 0.3, D, 0, 0.3, 0, Lt, { round: 0.05 }),
      box(W - 0.36, 0.12, D - 0.28, 0, 0.5, 0.07, Lt, { round: 0.05 }),
      // rolled arms: same height as the back (classic chesterfield)
      box(0.22, 0.42, D, -W / 2 + 0.11, 0.36, 0, Lt, { round: 0.06 }),
      box(0.22, 0.42, D, W / 2 - 0.11, 0.36, 0, Lt, { round: 0.06 }),
      cyl(0.13, D, -W / 2 + 0.11, 0.62, 0, Lt, { rot: [90, 0, 0], seg: 24 }),
      cyl(0.13, D, W / 2 - 0.11, 0.62, 0, Lt, { rot: [90, 0, 0], seg: 24 }),
      box(W, 0.45, 0.2, 0, 0.47, -D / 2 + 0.1, Lt, { round: 0.06 }),
      cyl(0.1, W, 0, 0.7, -D / 2 + 0.1, Lt, { rot: [0, 0, 90], seg: 20 }),
      ...corners(W, D, 0.1).map(([x, z]) => cone(0.045, 0.035, 0.14, x, 0.07, z, 'wood:walnut:gloss', { seg: 14 })),
    ];
    // tufting buttons
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) parts.push(sph(0.012, -W / 2 + 0.3 + i * (W - 0.6) / 8, 0.55 + j * 0.13, -D / 2 + 0.205, Lt, { col: false, seg: 8 }));
    return { parts, mass: 88 };
  },
});

add({
  id: 'armchair-oldmill', name: 'Harlow Farmhouse Armchair', brand: BRANDS.rustic, style: 'rustic', room: 'Living room', price: 749, mass: 22,
  rating: 4.5, reviews: 640, blurb: 'Solid wood frame you can see, thick linen cushions, slightly distressed finish.',
  quotes: ['"Looks 100 years old in a good way."', '"Arms are perfect for a coffee cup."'],
  options: { wood: woodOpt('reclaimed', ['reclaimed', 'oak', 'pine', 'walnut']), color: fabricOpt('Oatmeal') },
  build(o) {
    const Wd = `wood:${o.wood}`, F = `fabric:linen:${o.color}`;
    const W = 0.8, D = 0.84;
    return { mass: 22, parts: [
      ...legsAt(corners(W, D, 0.04), 0.62, 0.025, Wd).map((p, i) => ({ ...p, s: 'box', size: [0.05, i < 2 ? 0.85 : 0.62, 0.05], p: [p.p[0], (i < 2 ? 0.85 : 0.62) / 2, p.p[2]] })),
      box(0.06, 0.05, D, -W / 2 + 0.04, 0.6, 0, Wd), box(0.06, 0.05, D, W / 2 - 0.04, 0.6, 0, Wd), // arms
      box(W, 0.05, 0.05, 0, 0.3, -D / 2 + 0.04, Wd), box(W, 0.05, 0.05, 0, 0.3, D / 2 - 0.04, Wd),
      box(0.05, 0.05, D, -W / 2 + 0.04, 0.3, 0, Wd), box(0.05, 0.05, D, W / 2 - 0.04, 0.3, 0, Wd),
      box(W - 0.12, 0.04, D - 0.1, 0, 0.32, 0, Wd), // seat deck
      box(W - 0.12, 0.13, D - 0.12, 0, 0.405, 0.02, F, { round: 0.04 }),
      box(W - 0.12, 0.45, 0.13, 0, 0.66, -D / 2 + 0.12, F, { round: 0.05, rot: [-8, 0, 0] }),
    ] };
  },
});

// ---- coffee tables ----
add({
  id: 'coffee-kai', name: 'Kai Glass Coffee Table', brand: BRANDS.modern, style: 'modern', room: 'Living room', price: 399, mass: 24,
  rating: 4.3, reviews: 1520, blurb: '10 mm tempered glass top on a powder-coated steel frame. Glass shatters if you drop something heavy on it.',
  quotes: ['"Shows every fingerprint but looks amazing."', '"My kid\'s toy truck chipped the edge."'],
  options: { legs: metalOpt('black'), glass: { label: 'Glass', choices: [{ id: 'clear', label: 'Clear', price: 0 }, { id: 'smoked', label: 'Smoked', price: 40 }], def: 'clear' } },
  build(o) {
    const M = `metal:${o.legs}`, W = 1.2, D = 0.6, H = 0.42;
    return { mass: 24, parts: [
      box(W, 0.01, D, 0, H - 0.005, 0, `glass:${o.glass}`, { round: 0.003 }),
      ...corners(W - 0.06, D - 0.06, 0).map(([x, z]) => box(0.025, H - 0.01, 0.025, x, (H - 0.01) / 2, z, M, { round: 0.002 })),
      box(W - 0.06, 0.02, 0.02, 0, H - 0.02, -(D - 0.06) / 2, M), box(W - 0.06, 0.02, 0.02, 0, H - 0.02, (D - 0.06) / 2, M),
      box(0.02, 0.02, D - 0.06, -(W - 0.06) / 2, H - 0.02, 0, M), box(0.02, 0.02, D - 0.06, (W - 0.06) / 2, H - 0.02, 0, M),
      box(W - 0.1, 0.01, D - 0.1, 0, 0.12, 0, `glass:${o.glass}`, { round: 0.003 }), // lower shelf
    ] };
  },
});

add({
  id: 'coffee-nordbo', name: 'LACKA Coffee Table', brand: BRANDS.flatpack, style: 'flatpack', room: 'Living room', price: 49, mass: 9, flatpack: true,
  rating: 4.1, reviews: 23110, blurb: 'Hollow honeycomb-paper core inside a paper-thin laminate. Super light. Super cheap.',
  quotes: ['"It\'s $49, what did you expect? It\'s perfect."', '"Dented when I set my laptop down too hard."'],
  options: { finish: { label: 'Finish', choices: [{ id: 'white', label: 'White', price: 0 }, { id: 'oakprint', label: 'Oak-look print', price: 10 }], def: 'white' } },
  build(o) {
    const B = `board:${o.finish}`;
    return { mass: 9, parts: [
      box(0.9, 0.05, 0.55, 0, 0.425, 0, B, { round: 0.002, hollow: 0.2 }),
      ...corners(0.9, 0.55, 0.025).map(([x, z]) => box(0.05, 0.4, 0.05, x, 0.2, z, B, { round: 0.002, hollow: 0.3 })),
      box(0.8, 0.012, 0.45, 0, 0.12, 0, B),
    ] };
  },
});

add({
  id: 'coffee-ardent', name: 'Orsay Marble Table', brand: BRANDS.luxury, style: 'luxury', room: 'Living room', price: 2450, mass: 62,
  rating: 4.8, reviews: 207, blurb: 'A 3 cm slab of Italian-style marble on a solid brass pedestal. Every slab\'s veins are different.',
  quotes: ['"Heavier than my car door."', '"Put coasters on it. Marble stains from wine!"'],
  options: { stone: { label: 'Marble', choices: [{ id: 'white', label: 'White Carrara', price: 0 }, { id: 'black', label: 'Nero Marquina', price: 300 }, { id: 'green', label: 'Verde', price: 500 }], def: 'white' }, metal: { label: 'Base', choices: [{ id: 'brass', label: 'Brass', price: 0 }, { id: 'gold', label: 'Gold', price: 400 }, { id: 'chrome', label: 'Chrome', price: 0 }], def: 'brass' } },
  build(o) {
    const M = `metal:${o.metal}`;
    return { mass: 62, parts: [
      cyl(0.45, 0.03, 0, 0.405, 0, `marble:${o.stone}`, { seg: 48 }),
      cone(0.06, 0.09, 0.32, 0, 0.23, 0, M, { seg: 28 }),
      cyl(0.28, 0.03, 0, 0.015, 0, M, { seg: 40 }),
      cyl(0.16, 0.02, 0, 0.38, 0, M, { seg: 32 }),
    ] };
  },
});

add({
  id: 'coffee-oldmill', name: 'Barnwood Coffee Table', brand: BRANDS.rustic, style: 'rustic', room: 'Living room', price: 629, mass: 38,
  rating: 4.7, reviews: 932, blurb: 'Thick planks of reclaimed barn wood, nail holes and saw marks left in. Chunky square legs.',
  quotes: ['"Every scratch has a story."', '"Got a splinter putting it together. Worth it."'],
  options: { wood: woodOpt('reclaimed', ['reclaimed', 'pine', 'oak', 'walnut']) },
  build(o) {
    const Wd = `wood:${o.wood}`, W = 1.3, D = 0.7;
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(box(W, 0.05, D / 4 - 0.004, 0, 0.425, -D / 2 + D / 8 + i * D / 4, Wd, { round: 0.006, grain: 'x' }));
    parts.push(...corners(W, D, 0.06).map(([x, z]) => box(0.09, 0.4, 0.09, x, 0.2, z, Wd, { round: 0.006, grain: 'y' })));
    parts.push(box(W - 0.15, 0.03, D - 0.15, 0, 0.1, 0, Wd, { grain: 'x' }));
    parts.push(box(W - 0.2, 0.06, 0.04, 0, 0.36, -D / 2 + 0.07, Wd), box(W - 0.2, 0.06, 0.04, 0, 0.36, D / 2 - 0.07, Wd));
    return { mass: 38, parts };
  },
});

// ---- lamps (need real power to turn on) ----
add({
  id: 'floorlamp-kai', name: 'Kai Tripod Floor Lamp', brand: BRANDS.modern, style: 'modern', room: 'Living room', price: 149, mass: 6,
  rating: 4.4, reviews: 3301, blurb: 'Oak tripod legs, linen drum shade, warm 2700K bulb. Needs to be plugged in.', power: 9,
  quotes: ['"Cozy light. Tips over if the dog runs into it."'],
  options: { wood: woodOpt('oak', ['oak', 'walnut', 'maple']), shade: { label: 'Shade', choices: [{ id: '0xf2ead8', label: 'Linen white', price: 0 }, { id: '0x2a2a2a', label: 'Black', price: 0 }, { id: '0xc49a35', label: 'Mustard', price: 10 }], def: '0xf2ead8' } },
  build(o) {
    const Wd = `wood:${o.wood}`;
    const legs = [0, 120, 240].map((a) => {
      const r = a * Math.PI / 180;
      return cyl(0.014, 1.38, Math.cos(r) * 0.17, 0.66, Math.sin(r) * 0.17, Wd, { rot: [Math.sin(r) * -7, 0, Math.cos(r) * 7], seg: 10 });
    });
    return { mass: 6, parts: [
      ...legs,
      cyl(0.03, 0.06, 0, 1.33, 0, 'metal:brass', { seg: 12 }),
      cone(0.24, 0.2, 0.3, 0, 1.5, 0, `shade:${o.shade}`, { seg: 36, hollow: 0.05 }),
      sph(0.045, 0, 1.44, 0, 'bulb', { col: false, light: { type: 'point', color: 0xffc98a, lumens: 800, offset: [0, 1.44, 0] } }),
    ] };
  },
});

add({
  id: 'bookshelf-nordbo', name: 'BILLA Bookcase', brand: BRANDS.flatpack, style: 'flatpack', room: 'Living room', price: 79, mass: 29, flatpack: true,
  rating: 4.5, reviews: 41023, blurb: 'The bookcase in every apartment on Earth. 5 shelves, 30 kg of books per shelf before it sags.',
  quotes: ['"Bought 6. Built 6. Have regrets about my weekend."', '"Anchor it to the wall!!"'],
  options: { finish: { label: 'Finish', choices: [{ id: 'white', label: 'White', price: 0 }, { id: 'oakprint', label: 'Oak-look print', price: 10 }], def: 'white' } },
  build(o) {
    const B = `board:${o.finish}`, W = 0.8, H = 2.02, D = 0.28, t = 0.016;
    const parts = [
      box(t, H, D, -W / 2 + t / 2, H / 2, 0, B, { grain: 'y' }), box(t, H, D, W / 2 - t / 2, H / 2, 0, B, { grain: 'y' }),
      box(W, 0.003, 0.001 + 0.004, 0, H / 2, -D / 2 + 0.002, 'board:chip', { size: [W - 0.02, H - 0.02, 0.004] }), // back panel
      box(W - 2 * t, 0.06, t, 0, 0.03, D / 2 - 0.02, B), // kick plate
    ];
    for (let i = 0; i < 6; i++) parts.push(box(W - 2 * t, t, D - 0.01, 0, 0.06 + i * (H - 0.08) / 5, 0.005, B));
    return { mass: 29, parts };
  },
});

add({
  id: 'rug-kai', name: 'Kai Wool Area Rug (8 × 10 ft)', brand: BRANDS.modern, style: 'modern', room: 'Living room', price: 299, mass: 13,
  rating: 4.2, reviews: 1888, blurb: 'Low-pile wool blend. Dust, crumbs and pet hair hide in it (look closer...).',
  quotes: ['"Sheds for the first month."'],
  options: { color: fabricOpt('Oatmeal') },
  build(o) {
    return { mass: 13, parts: [box(2.44, 0.012, 3.05, 0, 0.006, 0, `fabric:woven:${o.color}`, { round: 0.003, friction: 0.9 })] };
  },
});

// =====================================================================
// BEDROOM
// =====================================================================
add({
  id: 'bed-kai', name: 'Kai Upholstered Bed Frame', brand: BRANDS.modern, style: 'modern', room: 'Bedroom', price: 1099, mass: 48,
  rating: 4.6, reviews: 2730, blurb: 'Padded headboard, solid slats. Mattress sold separately (like real stores).',
  quotes: ['"No squeaks. Headboard is great for reading in bed."'],
  options: { color: fabricOpt('Stone gray'), size: sizeOpt([{ id: 'full', label: 'Full', price: -150, w: 1.37 }, { id: 'queen', label: 'Queen', price: 0, w: 1.52 }, { id: 'king', label: 'King', price: 250, w: 1.93 }], 'queen') },
  build(o) {
    const F = `fabric:woven:${o.color}`, mw = o.size.w, W = mw + 0.1, L = 2.03 + 0.1;
    return { mass: 48 * W / 1.62, parts: [
      box(0.08, 0.3, L, -W / 2 + 0.04, 0.2, 0, F, { round: 0.02 }), box(0.08, 0.3, L, W / 2 - 0.04, 0.2, 0, F, { round: 0.02 }),
      box(W - 0.16, 0.3, 0.08, 0, 0.2, L / 2 - 0.04, F, { round: 0.02 }),
      box(W, 1.15, 0.1, 0, 0.6, -L / 2 - 0.05, F, { round: 0.04 }),
      box(W - 0.16, 0.025, L - 0.1, 0, 0.29, 0.02, 'wood:pine'), // slats deck
      ...legsAt(corners(W, L, 0.1), 0.06, 0.03, 'metal:black'),
    ] };
  },
});

add({
  id: 'mattress', name: 'Cloudrest Memory Foam Mattress', brand: 'Cloudrest', style: 'modern', room: 'Bedroom', price: 799, mass: 36,
  rating: 4.5, reviews: 15022, blurb: '28 cm thick. Comes with a sheet, duvet + 2 pillows. Dust mites will move in eventually (they always do).',
  quotes: ['"Sleeping hot but SO comfy."'],
  options: { size: sizeOpt([{ id: 'twin', label: 'Twin', price: -350, w: 0.97, l: 1.9 }, { id: 'full', label: 'Full', price: -150, w: 1.37, l: 1.9 }, { id: 'queen', label: 'Queen', price: 0, w: 1.52, l: 2.03 }, { id: 'king', label: 'King', price: 300, w: 1.93, l: 2.03 }], 'queen'), color: fabricOpt('Cream') },
  build(o) {
    const w = o.size.w, l = o.size.l, D = `fabric:linen:${o.color}`;
    return {
      mass: 36 * (w * l) / (1.52 * 2.03),
      bodies: { main: {}, pillow1: { free: true }, pillow2: { free: true } },
      parts: [
        box(w, 0.26, l, 0, 0.13, 0, 'fabric:woven:Cream', { round: 0.04 }),
        box(w + 0.04, 0.03, l * 0.72, 0, 0.275, l * 0.14, D, { round: 0.012 }), // duvet
        box(Math.min(0.66, w / 2 - 0.04), 0.13, 0.42, -w / 4, 0.33, -l / 2 + 0.28, 'fabric:linen:Cream', { round: 0.06, body: 'pillow1', mass: 1 }),
        box(Math.min(0.66, w / 2 - 0.04), 0.13, 0.42, w / 4, 0.33, -l / 2 + 0.28, 'fabric:linen:Cream', { round: 0.06, body: 'pillow2' }),
      ],
    };
  },
});

add({
  id: 'bunkbed-nordbo', name: 'STUVA Bunk Bed (twin)', brand: BRANDS.flatpack, style: 'flatpack', room: 'Bedroom', price: 299, mass: 46, flatpack: true,
  rating: 4.0, reviews: 5320, blurb: 'Solid pine. Ladder on the side. 162 parts + 1 allen key. Max 100 kg on top.',
  quotes: ['"Instructions had no words. Just a little cartoon guy looking sad."'],
  options: { wood: woodOpt('pine', ['pine', 'whiteoak']) },
  build(o) {
    const Wd = `wood:${o.wood}`, W = 1.0, L = 2.06, H = 1.6;
    const parts = [...corners(W, L, 0.03).map(([x, z]) => box(0.055, H, 0.055, x, H / 2, z, Wd, { grain: 'y' }))];
    for (const y of [0.3, 1.25]) {
      parts.push(box(0.03, 0.14, L - 0.06, -W / 2 + 0.03, y, 0, Wd), box(0.03, 0.14, L - 0.06, W / 2 - 0.03, y, 0, Wd));
      parts.push(box(W - 0.06, 0.02, L - 0.08, 0, y - 0.04, 0, Wd));
      parts.push(box(W - 0.1, 0.16, L - 0.12, 0, y + 0.06, 0, 'foam', { round: 0.03 }));
    }
    parts.push(box(W - 0.06, 0.25, 0.025, 0, H - 0.13, -L / 2 + 0.03, Wd), box(W - 0.06, 0.25, 0.025, 0, H - 0.13, L / 2 - 0.03, Wd));
    parts.push(box(0.025, 0.2, L * 0.6, W / 2 - 0.03, 1.45, -L * 0.18, Wd)); // guard rail
    for (let i = 0; i < 5; i++) parts.push(cyl(0.016, 0.42, W / 2 + 0.03, 0.28 + i * 0.27, L / 2 - 0.35, Wd, { rot: [90, 0, 0], seg: 10 }));
    parts.push(box(0.035, 1.5, 0.035, W / 2 + 0.03, 0.75, L / 2 - 0.13, Wd), box(0.035, 1.5, 0.035, W / 2 + 0.03, 0.75, L / 2 - 0.57, Wd));
    return { mass: 46, parts };
  },
});

// ---- storage with real drawers + doors ----
function drawerParts(name, w, h, d, x, y, z, front, inside, pull) {
  // a real open-top drawer box: front, sides, back, bottom (things can go inside)
  const t = 0.012;
  return [
    box(w, h, 0.02, x, y, z + d / 2 - 0.01, front, { body: name, round: 0.003 }),
    box(t, h - 0.03, d - 0.02, x - w / 2 + 0.02, y - 0.01, z - 0.01, inside, { body: name }),
    box(t, h - 0.03, d - 0.02, x + w / 2 - 0.02, y - 0.01, z - 0.01, inside, { body: name }),
    box(w - 0.04, h - 0.03, t, x, y - 0.01, z - d / 2 + 0.006, inside, { body: name }),
    box(w - 0.04, t, d - 0.02, x, y - h / 2 + 0.01, z - 0.01, inside, { body: name }),
    { ...pull, body: name },
  ];
}

add({
  id: 'nightstand-oldmill', name: 'Harlow Nightstand', brand: BRANDS.rustic, style: 'rustic', room: 'Bedroom', price: 349, mass: 15,
  rating: 4.6, reviews: 812, blurb: 'Solid wood, one drawer on real wooden runners, open shelf below. Pull the knob to open.',
  quotes: ['"Drawer slides smooth. Perfect for my phone + a book."'],
  options: { wood: woodOpt('oak', ['oak', 'reclaimed', 'walnut', 'pine', 'cherry']) },
  build(o) {
    const Wd = `wood:${o.wood}`, W = 0.5, H = 0.62, D = 0.4;
    return {
      mass: 15,
      bodies: { main: {}, drawer: { joint: 'prismatic', axis: [0, 0, 1], limits: [0, 0.3], anchor: [0, 0.48, 0] } },
      parts: [
        box(W, 0.03, D, 0, H - 0.015, 0, Wd, { round: 0.004 }),
        box(0.025, H - 0.03, D, -W / 2 + 0.0125, (H - 0.03) / 2, 0, Wd, { grain: 'y' }), box(0.025, H - 0.03, D, W / 2 - 0.0125, (H - 0.03) / 2, 0, Wd, { grain: 'y' }),
        box(W - 0.05, H - 0.03, 0.015, 0, (H - 0.03) / 2, -D / 2 + 0.0075, Wd, { grain: 'y' }),
        box(W - 0.05, 0.02, D - 0.03, 0, 0.36, 0, Wd), box(W - 0.05, 0.02, D - 0.03, 0, 0.08, 0, Wd),
        ...drawerParts('drawer', W - 0.06, 0.2, D - 0.04, 0, 0.48, 0.0, Wd, 'wood:pine', sph(0.018, 0, 0.48, (D - 0.04) / 2 + 0.02, 'metal:iron', { seg: 12 })),
      ],
    };
  },
});

add({
  id: 'dresser-kai', name: 'Kai 6-Drawer Dresser', brand: BRANDS.modern, style: 'modern', room: 'Bedroom', price: 899, mass: 62,
  rating: 4.4, reviews: 1477, blurb: 'Six soft-close drawers, slim steel pulls, solid oak top. Holds a LOT of clothes.',
  quotes: ['"Drawers glide forever. Heavy, needed help to move it."'],
  options: { wood: woodOpt('whiteoak', ['whiteoak', 'walnut', 'oak', 'maple']), pulls: metalOpt('black') },
  build(o) {
    const Wd = `wood:${o.wood}`, M = `metal:${o.pulls}`, W = 1.4, H = 0.82, D = 0.5;
    const parts = [
      box(W, 0.03, D, 0, H - 0.015, 0, Wd, { round: 0.004 }),
      box(0.02, H - 0.1, D, -W / 2 + 0.01, (H - 0.1) / 2 + 0.07, 0, Wd, { grain: 'y' }), box(0.02, H - 0.1, D, W / 2 - 0.01, (H - 0.1) / 2 + 0.07, 0, Wd, { grain: 'y' }),
      box(W - 0.04, H - 0.1, 0.012, 0, (H - 0.1) / 2 + 0.07, -D / 2 + 0.006, Wd),
      box(W - 0.04, 0.02, D, 0, 0.08, 0, Wd), box(0.02, H - 0.1, D - 0.02, 0, (H - 0.1) / 2 + 0.07, 0, Wd),
      ...legsAt(corners(W, D, 0.04), 0.07, 0.018, M),
    ];
    const bodies = { main: {} };
    const dw = (W - 0.06) / 2, dh = (H - 0.13) / 3;
    for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) {
      const name = `d${c}${r}`;
      const x = -W / 4 + c * W / 2 + (c ? -0.005 : 0.005), y = 0.09 + dh * (r + 0.5);
      bodies[name] = { joint: 'prismatic', axis: [0, 0, 1], limits: [0, 0.36], anchor: [x, y, 0] };
      parts.push(...drawerParts(name, dw - 0.01, dh - 0.01, D - 0.04, x, y, 0, Wd, 'wood:maple', box(0.18, 0.012, 0.02, x, y + dh * 0.3, (D - 0.04) / 2 + 0.01, M, { round: 0.004 })));
    }
    return { mass: 62, bodies, parts };
  },
});

add({
  id: 'wardrobe-nordbo', name: 'PAXA Wardrobe (2-door)', brand: BRANDS.flatpack, style: 'flatpack', room: 'Bedroom', price: 199, mass: 72, flatpack: true,
  rating: 3.8, reviews: 6201, blurb: 'Two hinged doors, hanging rail + a shelf. Tall. Anchor it to a wall or it can tip.',
  quotes: ['"Doors needed adjusting for an hour to line up."', '"Fits SO much."'],
  options: { finish: { label: 'Finish', choices: [{ id: 'white', label: 'White', price: 0 }, { id: 'oakprint', label: 'Oak-look print', price: 20 }], def: 'white' } },
  build(o) {
    const B = `board:${o.finish}`, W = 1.0, H = 2.01, D = 0.58, t = 0.018;
    const dw = W / 2 - 0.003;
    return {
      mass: 72,
      bodies: {
        main: {},
        doorL: { joint: 'revolute', axis: [0, 1, 0], limits: [-1.95, 0], anchor: [-W / 2 + 0.005, H / 2, D / 2 + 0.01] },
        doorR: { joint: 'revolute', axis: [0, 1, 0], limits: [0, 1.95], anchor: [W / 2 - 0.005, H / 2, D / 2 + 0.01] },
      },
      parts: [
        box(t, H, D, -W / 2 + t / 2, H / 2, 0, B, { grain: 'y' }), box(t, H, D, W / 2 - t / 2, H / 2, 0, B, { grain: 'y' }),
        box(W - 2 * t, t, D, 0, H - t / 2, 0, B), box(W - 2 * t, t, D, 0, 0.08, 0, B), box(W - 2 * t, 0.07, t, 0, 0.035, D / 2 - 0.03, B),
        box(W - 0.02, H - 0.02, 0.004, 0, H / 2, -D / 2 + 0.002, 'board:chip', { col: false }),
        box(W - 0.02, H - 0.02, 0.006, 0, H / 2, -D / 2 + 0.005, B, { vis: false }),
        box(W - 2 * t, t, D - 0.04, 0, 1.68, 0, B),
        cyl(0.012, W - 2 * t, 0, 1.6, 0, 'metal:chrome', { rot: [0, 0, 90], seg: 10 }),
        box(dw, H - 0.01, t, -W / 4 - 0.0015, H / 2, D / 2 + 0.01, B, { body: 'doorL', grain: 'y' }),
        box(dw, H - 0.01, t, W / 4 + 0.0015, H / 2, D / 2 + 0.01, B, { body: 'doorR', grain: 'y' }),
        box(0.015, 0.12, 0.025, -0.06, 1.05, D / 2 + 0.03, 'metal:steel', { body: 'doorL' }),
        box(0.015, 0.12, 0.025, 0.06, 1.05, D / 2 + 0.03, 'metal:steel', { body: 'doorR' }),
      ],
    };
  },
});

// =====================================================================
// KITCHEN + DINING
// =====================================================================
add({
  id: 'diningtable-oldmill', name: 'Harvest Farmhouse Dining Table', brand: BRANDS.rustic, style: 'rustic', room: 'Kitchen + dining', price: 1250, mass: 64,
  rating: 4.8, reviews: 1104, blurb: 'Seats 6. Trestle base, breadboard ends, thick plank top. Built to last 100 years.',
  quotes: ['"Thanksgiving for 10 people, no problem."'],
  options: { wood: woodOpt('oak', ['oak', 'reclaimed', 'walnut', 'pine', 'cherry']), size: sizeOpt([{ id: '6', label: '6-seat (2.1 m)', price: 0, w: 2.1 }, { id: '8', label: '8-seat (2.6 m)', price: 380, w: 2.6 }], '6') },
  build(o) {
    const Wd = `wood:${o.wood}`, W = o.size.w, D = 0.95, H = 0.76;
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(box(W - 0.12, 0.045, D / 5 - 0.003, 0, H - 0.0225, -D / 2 + D / 10 + i * D / 5, Wd, { round: 0.004 }));
    parts.push(box(0.06, 0.045, D, -W / 2 + 0.03, H - 0.0225, 0, Wd, { grain: 'z', round: 0.004 }), box(0.06, 0.045, D, W / 2 - 0.03, H - 0.0225, 0, Wd, { grain: 'z', round: 0.004 }));
    for (const s of [-1, 1]) {
      const x = s * (W / 2 - 0.35);
      parts.push(box(0.09, H - 0.12, 0.12, x, (H - 0.12) / 2 + 0.05, 0, Wd, { grain: 'y' }));
      parts.push(box(0.1, 0.07, D - 0.12, x, 0.035, 0, Wd, { grain: 'z' }));
      parts.push(box(0.1, 0.06, D - 0.2, x, H - 0.075, 0, Wd, { grain: 'z' }));
    }
    parts.push(box(W - 0.7, 0.08, 0.06, 0, 0.32, 0, Wd));
    return { mass: 64 * W / 2.1, parts };
  },
});

add({
  id: 'chair-oldmill', name: 'Harvest Dining Chair', brand: BRANDS.rustic, style: 'rustic', room: 'Kitchen + dining', price: 189, mass: 6.5,
  rating: 4.5, reviews: 2210, blurb: 'Classic slat-back chair, solid wood. Tips over if you lean back on two legs (don\'t).',
  quotes: ['"Sturdy. Bought 6 for our table."'],
  options: { wood: woodOpt('oak', ['oak', 'reclaimed', 'walnut', 'pine', 'cherry']) },
  build(o) {
    const Wd = `wood:${o.wood}`, W = 0.45, D = 0.5, S = 0.46;
    const parts = [
      box(W, 0.035, D, 0, S, 0, Wd, { round: 0.006 }),
      ...corners(W, D, 0.025).map(([x, z], i) => box(0.035, i < 2 ? 0.92 : S, 0.035, x, (i < 2 ? 0.92 : S) / 2, z, Wd, { grain: 'y' })),
      box(W - 0.05, 0.03, 0.02, 0, S - 0.06, -D / 2 + 0.025, Wd), box(W - 0.05, 0.03, 0.02, 0, S - 0.06, D / 2 - 0.025, Wd),
      box(0.02, 0.025, D - 0.05, -W / 2 + 0.025, 0.15, 0, Wd), box(0.02, 0.025, D - 0.05, W / 2 - 0.025, 0.15, 0, Wd),
    ];
    for (let i = 0; i < 3; i++) parts.push(box(W - 0.05, 0.05, 0.018, 0, 0.6 + i * 0.11, -D / 2 + 0.025, Wd));
    return { mass: 6.5, parts };
  },
});

add({
  id: 'stool-kai', name: 'Kai Counter Stool', brand: BRANDS.modern, style: 'modern', room: 'Kitchen + dining', price: 129, mass: 7,
  rating: 4.2, reviews: 980, blurb: 'Molded oak seat, slim steel frame, footrest ring. 65 cm counter height.',
  quotes: ['"Wobbled on my tile floor till I adjusted the feet."'],
  options: { legs: metalOpt('black'), wood: woodOpt('oak', ['oak', 'walnut']) },
  build(o) {
    const M = `metal:${o.legs}`;
    const legs = [45, 135, 225, 315].map((a) => { const r = a * Math.PI / 180; return cyl(0.011, 0.66, Math.cos(r) * 0.15, 0.33, Math.sin(r) * 0.15, M, { rot: [Math.sin(r) * -5, 0, Math.cos(r) * 5], seg: 10 }); });
    return { mass: 7, parts: [
      cyl(0.19, 0.04, 0, 0.67, 0, `wood:${o.wood}`, { seg: 32, round: 0.01 }),
      ...legs,
      // footrest bars between the legs
      ...[0, 90, 180, 270].map((a) => { const r = (a + 45) * Math.PI / 180, r2 = (a + 135) * Math.PI / 180; const x = (Math.cos(r) + Math.cos(r2)) * 0.075, z = (Math.sin(r) + Math.sin(r2)) * 0.075; return cyl(0.008, 0.2, x, 0.25, z, M, { rot: [0, -a, 90], seg: 8 }); }),
    ] };
  },
});

add({
  id: 'fridge-kelvin', name: 'Kelvin French-Door Refrigerator', brand: 'Kelvin', style: 'modern', room: 'Kitchen + dining', price: 2199, mass: 138,
  rating: 4.3, reviews: 4410, blurb: 'Stainless steel, 25 cu ft. Two doors + a freezer drawer. Comes EMPTY. Needs power, or food inside spoils.', power: 150,
  quotes: ['"Ice maker is loud at night."', '"Fingerprints everywhere on stainless."'],
  options: { finish: { label: 'Finish', choices: [{ id: 'steel', label: 'Stainless', price: 0 }, { id: 'black', label: 'Black stainless', price: 150 }, { id: 'white', label: 'White', price: -200 }], def: 'steel' } },
  build(o) {
    const F = o.finish === 'white' ? 'paint:White' : `metal:${o.finish}`, W = 0.91, H = 1.78, D = 0.74;
    const dw = W / 2 - 0.004;
    return {
      mass: 138,
      bodies: {
        main: {},
        doorL: { joint: 'revolute', axis: [0, 1, 0], limits: [-2.0, 0], anchor: [-W / 2, 1.2, D / 2 + 0.03] },
        doorR: { joint: 'revolute', axis: [0, 1, 0], limits: [0, 2.0], anchor: [W / 2, 1.2, D / 2 + 0.03] },
        freezer: { joint: 'prismatic', axis: [0, 0, 1], limits: [0, 0.45], anchor: [0, 0.32, 0] },
      },
      parts: [
        // cabinet: real hollow box so stuff fits inside
        box(0.03, H, D, -W / 2 + 0.015, H / 2, 0, F), box(0.03, H, D, W / 2 - 0.015, H / 2, 0, F),
        box(W - 0.06, 0.03, D, 0, H - 0.015, 0, F), box(W - 0.06, 0.06, D, 0, 0.03, 0, F),
        box(W - 0.06, H - 0.09, 0.04, 0, H / 2, -D / 2 + 0.02, 'plastic:0xf4f4f2'),
        box(W - 0.06, 0.03, D - 0.05, 0, 0.62, 0.0, 'plastic:0xf4f4f2'), // freezer divider
        box(W - 0.07, 0.008, D - 0.12, 0, 1.0, -0.03, 'glass:clear'), box(W - 0.07, 0.008, D - 0.12, 0, 1.3, -0.03, 'glass:clear'), // glass shelves
        box(W - 0.07, 0.01, D - 0.06, 0, 0.66, 0.0, 'plastic:0xf4f4f2', { vis: false }),
        // doors
        box(dw, H - 0.66, 0.06, -W / 4 - 0.002, 0.66 + (H - 0.66) / 2, D / 2 + 0.03, F, { body: 'doorL', round: 0.008 }),
        box(dw, H - 0.66, 0.06, W / 4 + 0.002, 0.66 + (H - 0.66) / 2, D / 2 + 0.03, F, { body: 'doorR', round: 0.008 }),
        cyl(0.011, 0.6, -0.04, 1.2, D / 2 + 0.09, 'metal:chrome', { body: 'doorL', seg: 10 }),
        cyl(0.011, 0.6, 0.04, 1.2, D / 2 + 0.09, 'metal:chrome', { body: 'doorR', seg: 10 }),
        // freezer drawer (front + tub)
        box(W - 0.01, 0.56, 0.06, 0, 0.34, D / 2 + 0.03, F, { body: 'freezer', round: 0.008 }),
        box(W - 0.1, 0.4, 0.5, 0, 0.3, D / 2 - 0.27, 'plastic:0xe9ecef', { body: 'freezer', hollow: 0.15 }),
        cyl(0.011, W - 0.2, 0, 0.55, D / 2 + 0.09, 'metal:chrome', { body: 'freezer', rot: [0, 0, 90], seg: 10 }),
        sph(0.02, 0, H - 0.08, D / 2 - 0.1, 'bulb', { col: false, light: { type: 'point', color: 0xf1f6ff, lumens: 120, offset: [0, H - 0.1, 0.1], inside: true } }),
      ],
    };
  },
});

add({
  id: 'stove-kelvin', name: 'Kelvin 30" Gas Range', brand: 'Kelvin', style: 'modern', room: 'Kitchen + dining', price: 1099, mass: 78,
  rating: 4.4, reviews: 2950, blurb: '5 burners + oven. Needs a gas line + power. Oven door swings down. Real flames (careful).', power: 40,
  quotes: ['"Boils water crazy fast."'],
  options: { finish: { label: 'Finish', choices: [{ id: 'steel', label: 'Stainless', price: 0 }, { id: 'black', label: 'Black', price: 0 }], def: 'steel' } },
  build(o) {
    const F = `metal:${o.finish}`, W = 0.76, H = 0.92, D = 0.66;
    const parts = [
      box(W, H - 0.05, 0.03, 0, (H - 0.05) / 2, -D / 2 + 0.015, F),
      box(0.03, H - 0.05, D, -W / 2 + 0.015, (H - 0.05) / 2, 0, F), box(0.03, H - 0.05, D, W / 2 - 0.015, (H - 0.05) / 2, 0, F),
      box(W, 0.05, D, 0, H - 0.025, 0, 'metal:black'), box(W - 0.06, 0.1, 0.03, 0, 0.05, D / 2 - 0.02, F),
      box(W - 0.06, 0.02, D - 0.05, 0, 0.12, 0, 'metal:black'), box(W - 0.06, 0.02, D - 0.05, 0, 0.66, 0, 'metal:black'),
      box(W, 0.12, 0.1, 0, H + 0.06, -D / 2 + 0.05, F), // back panel with clock
      box(W - 0.06, 0.1, 0.05, 0, H - 0.1, D / 2 - 0.02, F),
      box(W - 0.06, 0.48, 0.05, 0, 0.36, D / 2 + 0.025, F, { body: 'oven', round: 0.006 }),
      box(W - 0.2, 0.22, 0.012, 0, 0.36, D / 2 + 0.052, 'glass:smoked', { body: 'oven', col: false }),
      cyl(0.012, W - 0.15, 0, 0.56, D / 2 + 0.085, 'metal:chrome', { body: 'oven', rot: [0, 0, 90], seg: 10 }),
    ];
    for (const [x, z, r] of [[-0.2, -0.15, 0.06], [0.2, -0.15, 0.06], [-0.2, 0.13, 0.05], [0.2, 0.13, 0.05], [0, 0, 0.07]]) {
      parts.push(cyl(r, 0.02, x, H + 0.01, z, 'metal:iron', { seg: 20 }));
      parts.push(box(r * 2.8, 0.02, 0.02, x, H + 0.03, z, 'metal:iron'), box(0.02, 0.02, r * 2.8, x, H + 0.03, z, 'metal:iron'));
    }
    for (let i = 0; i < 5; i++) parts.push(cyl(0.022, 0.03, -0.26 + i * 0.13, H - 0.1, D / 2 + 0.015, 'plastic:0x222222', { rot: [90, 0, 0], seg: 14 }));
    return { mass: 78, parts, bodies: { main: {}, oven: { joint: 'revolute', axis: [1, 0, 0], limits: [0, 1.57], anchor: [0, 0.12, D / 2 + 0.025] } } };
  },
});

// =====================================================================
// BATHROOM
// =====================================================================
add({
  id: 'toilet-pura', name: 'Pura Comfort-Height Toilet', brand: 'Pura', style: 'modern', room: 'Bathroom', price: 279, mass: 41,
  rating: 4.5, reviews: 6703, blurb: 'Vitreous china, soft-close seat + lid on real hinges. Needs a water line to flush. Germs live near it (they really do).',
  quotes: ['"Soft close lid is a game changer."'],
  options: {},
  build() {
    const C = 'ceramic';
    return {
      mass: 41,
      bodies: { main: {}, seat: { joint: 'revolute', axis: [1, 0, 0], limits: [-1.75, 0], anchor: [0, 0.43, -0.12] }, lid: { joint: 'revolute', axis: [1, 0, 0], limits: [-1.85, 0], anchor: [0, 0.445, -0.13] } },
      parts: [
        { s: 'hull', lathe: [[0.0, 0.0], [0.15, 0.0], [0.16, 0.04], [0.12, 0.2], [0.17, 0.3], [0.2, 0.4], [0.19, 0.42], [0.16, 0.41], [0.13, 0.33], [0.08, 0.25], [0.0, 0.22]], seg: 28, p: [0, 0, 0.08], scale: [0.95, 1, 1.25], mat: C, volume: 0.03 },
        box(0.42, 0.38, 0.19, 0, 0.6, -0.24, C, { round: 0.03 }),          // tank
        box(0.44, 0.03, 0.21, 0, 0.805, -0.24, C, { round: 0.012 }),       // tank lid
        box(0.05, 0.02, 0.02, -0.15, 0.74, -0.135, 'metal:chrome'),        // flush handle
        box(0.38, 0.025, 0.46, 0, 0.43, 0.09, 'plastic:0xf7f7f5', { body: 'seat', round: 0.02 }),
        box(0.38, 0.025, 0.46, 0, 0.455, 0.09, 'plastic:0xf7f7f5', { body: 'lid', round: 0.02 }),
      ],
    };
  },
});

add({
  id: 'tub-ardent', name: 'Victoria Cast-Iron Clawfoot Tub', brand: BRANDS.luxury, style: 'luxury', room: 'Bathroom', price: 3900, mass: 135,
  rating: 4.9, reviews: 188, blurb: 'Enameled cast iron, rolled rim, four lion-paw feet. Holds heat for ages. Needs 4 people to carry.',
  quotes: ['"Floor had to be reinforced. Worth it."'],
  options: { feet: { label: 'Feet', choices: [{ id: 'brass', label: 'Brass', price: 0 }, { id: 'chrome', label: 'Chrome', price: 0 }, { id: 'black', label: 'Black', price: 0 }], def: 'brass' }, outside: { label: 'Outside paint', choices: [{ id: '0xf6f6f3', label: 'White', price: 0 }, { id: '0x2b3550', label: 'Navy', price: 250 }, { id: '0x3d4a3a', label: 'Forest', price: 250 }, { id: '0x1d1d1f', label: 'Black', price: 250 }], def: '0xf6f6f3' } },
  build(o) {
    const L = 1.67, W = 0.78, H = 0.62, y0 = 0.14;
    const parts = [
      { s: 'hull', lathe: [[0.0, 0], [0.3, 0], [0.37, 0.12], [0.4, 0.4], [0.41, H - 0.03], [0.39, H], [0.365, H - 0.01], [0.355, H - 0.06], [0.33, 0.35], [0.28, 0.14], [0.0, 0.1]], seg: 40, p: [0, y0, 0], scale: [W / 0.82, 1, L / 0.82], mat: `ceramic:${o.outside}`, col: false, volume: 0.05 },
    ];
    // physics: a real hollow tub (bottom + curved walls) so water/stuff/you can go inside
    parts.push(box(W * 0.68, 0.06, L * 0.7, 0, y0 + 0.08, 0, 'ceramic', { vis: false }));
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2, a2 = ((i + 1) / segs) * Math.PI * 2;
      const rx = W / 2 - 0.03, rz = L / 2 - 0.03;
      const x1 = Math.cos(a) * rx, z1 = Math.sin(a) * rz, x2 = Math.cos(a2) * rx, z2 = Math.sin(a2) * rz;
      const len = Math.hypot(x2 - x1, z2 - z1) + 0.04;
      const ang = Math.atan2(z2 - z1, x2 - x1) * 180 / Math.PI;
      parts.push(box(len, H - 0.1, 0.05, (x1 + x2) / 2, y0 + H / 2 + 0.04, (z1 + z2) / 2, 'ceramic', { vis: false, rot: [0, -ang, 0] }));
    }
    for (const [x, z] of corners(W * 0.75, L * 0.68, 0)) parts.push(sph(0.06, x, 0.07, z, `metal:${o.feet}`, { seg: 14 }), cone(0.035, 0.05, 0.1, x, 0.12, z, `metal:${o.feet}`, { seg: 12, col: false }));
    return { mass: 135, parts };
  },
});

add({
  id: 'vanity-kai', name: 'Kai Bathroom Vanity + Sink', brand: BRANDS.modern, style: 'modern', room: 'Bathroom', price: 649, mass: 46,
  rating: 4.3, reviews: 1203, blurb: 'Oak cabinet with 2 doors, quartz top, ceramic undermount sink + chrome faucet. Biofilm grows in the drain over time.',
  quotes: ['"Lots of storage under the sink."'],
  options: { wood: woodOpt('whiteoak', ['whiteoak', 'walnut', 'oak']) },
  build(o) {
    const Wd = `wood:${o.wood}`, W = 0.9, H = 0.85, D = 0.55;
    return {
      mass: 46,
      bodies: {
        main: {},
        doorL: { joint: 'revolute', axis: [0, 1, 0], limits: [-1.9, 0], anchor: [-W / 2 + 0.02, 0.45, D / 2] },
        doorR: { joint: 'revolute', axis: [0, 1, 0], limits: [0, 1.9], anchor: [W / 2 - 0.02, 0.45, D / 2] },
      },
      parts: [
        box(0.02, H - 0.03, D, -W / 2 + 0.01, (H - 0.03) / 2, 0, Wd, { grain: 'y' }), box(0.02, H - 0.03, D, W / 2 - 0.01, (H - 0.03) / 2, 0, Wd, { grain: 'y' }),
        box(W - 0.04, 0.02, D - 0.02, 0, 0.1, 0, Wd), box(W - 0.04, H - 0.03, 0.012, 0, (H - 0.03) / 2, -D / 2 + 0.006, Wd), box(W - 0.04, 0.09, 0.02, 0, 0.045, D / 2 - 0.03, Wd),
        box(W + 0.01, 0.03, D + 0.01, 0, H - 0.015, 0, 'marble:white', { round: 0.004 }),
        // vessel sink sitting on the counter
        { s: 'hull', lathe: [[0.0, 0.0], [0.1, 0.0], [0.19, 0.05], [0.21, 0.13], [0.2, 0.135], [0.185, 0.06], [0.09, 0.012], [0.0, 0.012]], seg: 32, p: [0, H, 0.03], scale: [1, 1, 0.78], mat: 'ceramic', col: false, volume: 0.004 },
        cyl(0.015, 0.36, 0, H + 0.18, -0.2, 'metal:chrome', { seg: 12 }), cyl(0.012, 0.16, 0, H + 0.35, -0.13, 'metal:chrome', { rot: [90, 0, 0], seg: 12 }),
        box(W / 2 - 0.025, H - 0.13, 0.02, -W / 4 + 0.0025, 0.1 + (H - 0.13) / 2, D / 2, Wd, { body: 'doorL', grain: 'y' }),
        box(W / 2 - 0.025, H - 0.13, 0.02, W / 4 - 0.0025, 0.1 + (H - 0.13) / 2, D / 2, Wd, { body: 'doorR', grain: 'y' }),
        box(0.012, 0.12, 0.02, -0.04, 0.6, D / 2 + 0.02, 'metal:chrome', { body: 'doorL' }), box(0.012, 0.12, 0.02, 0.04, 0.6, D / 2 + 0.02, 'metal:chrome', { body: 'doorR' }),
      ],
    };
  },
});

// =====================================================================
// OFFICE
// =====================================================================
add({
  id: 'desk-kai', name: 'Kai Writing Desk', brand: BRANDS.modern, style: 'modern', room: 'Office', price: 349, mass: 28,
  rating: 4.5, reviews: 3011, blurb: 'Solid oak top, slim steel legs, one shallow drawer for cables + snacks.',
  quotes: ['"Perfect home office desk."'],
  options: { wood: woodOpt('oak', ['oak', 'walnut', 'whiteoak']), legs: metalOpt('black') },
  build(o) {
    const Wd = `wood:${o.wood}`, M = `metal:${o.legs}`, W = 1.4, D = 0.7, H = 0.75;
    return {
      mass: 28,
      bodies: { main: {}, drawer: { joint: 'prismatic', axis: [0, 0, 1], limits: [0, 0.4], anchor: [0, H - 0.08, 0] } },
      parts: [
        box(W, 0.03, D, 0, H - 0.015, 0, Wd, { round: 0.004 }),
        ...corners(W, D, 0.04).map(([x, z]) => box(0.03, H - 0.03, 0.03, x, (H - 0.03) / 2, z, M, { round: 0.003 })),
        box(W - 0.08, 0.04, 0.02, 0, H - 0.05, -D / 2 + 0.04, M),
        box(0.6, 0.012, D - 0.1, 0, H - 0.115, -0.01, Wd),
        ...drawerParts('drawer', 0.56, 0.07, D - 0.12, 0, H - 0.08, -0.01, Wd, 'wood:maple', box(0.12, 0.012, 0.015, 0, H - 0.08, (D - 0.12) / 2 + 0.005, M)),
      ],
    };
  },
});

function rollingChair({ seatMat, backMat, frame, tall }) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(box(0.3, 0.03, 0.045, Math.cos(a) * 0.15, 0.09, Math.sin(a) * 0.15, frame, { rot: [0, -a * 180 / Math.PI, 0], round: 0.01 }));
    parts.push(sph(0.03, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, 'rubber', { friction: 0.04 })); // casters roll
  }
  parts.push(cyl(0.025, 0.36, 0, 0.27, 0, 'metal:chrome', { seg: 14 }));
  parts.push(box(0.5, 0.09, 0.5, 0, 0.49, 0, seatMat, { round: 0.04 }));
  parts.push(box(0.46, tall ? 0.78 : 0.55, 0.08, 0, tall ? 0.97 : 0.84, -0.25, backMat, { round: 0.035, rot: [-8, 0, 0] }));
  parts.push(box(0.04, 0.22, 0.04, -0.27, 0.6, -0.02, frame), box(0.04, 0.22, 0.04, 0.27, 0.6, -0.02, frame));
  parts.push(box(0.07, 0.03, 0.26, -0.27, 0.72, 0.02, 'plastic:0x222222', { round: 0.01 }), box(0.07, 0.03, 0.26, 0.27, 0.72, 0.02, 'plastic:0x222222', { round: 0.01 }));
  if (tall) parts.push(box(0.26, 0.14, 0.1, 0, 1.42, -0.32, backMat, { round: 0.05, rot: [-8, 0, 0] }));
  return parts;
}

add({
  id: 'officechair', name: 'Kai Ergo Task Chair', brand: BRANDS.modern, style: 'modern', room: 'Office', price: 499, mass: 17,
  rating: 4.6, reviews: 5502, blurb: 'Mesh back, padded seat, 5 rolling casters. Rolls across hard floors, barely moves on grass.',
  quotes: ['"My back stopped hurting."', '"Rolls away when you sit down too fast."'],
  options: { color: fabricOpt('Charcoal') },
  build(o) { return { mass: 17, parts: rollingChair({ seatMat: `fabric:woven:${o.color}`, backMat: `fabric:linen:${o.color}`, frame: 'plastic:0x1b1b1c' }) }; },
});

add({
  id: 'gamingchair-apex', name: 'Apex RIFT Gaming Chair', brand: 'Apex', style: 'modern', room: 'Office', price: 329, mass: 23,
  rating: 4.1, reviews: 11903, blurb: 'Racing-style bucket seat, PU leather, neck pillow. Looks fast. Is a chair.',
  quotes: ['"Leather peeled after 2 years."', '"Makes me 10% better at games (not really)."'],
  options: { color: { label: 'Color', choices: [{ id: 'Black', label: 'Black / red', price: 0 }, { id: 'Oxblood', label: 'Red', price: 0 }, { id: 'Ivory', label: 'White', price: 20 }], def: 'Black' } },
  build(o) { return { mass: 23, parts: rollingChair({ seatMat: `leather:${o.color}`, backMat: `leather:${o.color}`, frame: 'metal:black', tall: true }) }; },
});

// =====================================================================
// OUTDOOR
// =====================================================================
add({
  id: 'picnic-oldmill', name: 'Old Mill Picnic Table', brand: BRANDS.rustic, style: 'rustic', room: 'Outdoor', price: 399, mass: 75,
  rating: 4.6, reviews: 1709, blurb: 'Pressure-treated pine, attached benches. Weathers silver-gray in the sun + rain over the years.',
  quotes: ['"Survived 3 winters outside."'],
  options: { wood: woodOpt('pine', ['pine', 'reclaimed', 'oak']) },
  build(o) {
    const Wd = `wood:${o.wood}`, L = 1.83;
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(box(L, 0.04, 0.14, 0, 0.74, -0.31 + i * 0.155, Wd, { round: 0.004 }));
    for (const z of [-0.62, 0.62]) for (let i = 0; i < 2; i++) parts.push(box(L, 0.04, 0.14, 0, 0.44, z + (i - 0.5) * 0.15, Wd, { round: 0.004 }));
    for (const x of [-0.65, 0.65]) {
      parts.push(box(0.045, 0.82, 0.14, x, 0.39, -0.25, Wd, { rot: [-22, 0, 0], grain: 'y' }), box(0.045, 0.82, 0.14, x, 0.39, 0.25, Wd, { rot: [22, 0, 0], grain: 'y' }));
      parts.push(box(0.045, 0.09, 1.58, x, 0.38, 0, Wd), box(0.045, 0.09, 0.74, x, 0.68, 0, Wd));
    }
    return { mass: 75, parts };
  },
});

add({
  id: 'adirondack-oldmill', name: 'Lakeside Adirondack Chair', brand: BRANDS.rustic, style: 'rustic', room: 'Outdoor', price: 229, mass: 15,
  rating: 4.7, reviews: 2244, blurb: 'Slanted seat, wide flat arms for your drink, fan back. Hard to get out of (on purpose).',
  quotes: ['"Best seat for a sunset by the lake."'],
  options: { wood: woodOpt('pine', ['pine', 'whiteoak', 'reclaimed']), paint: { label: 'Paint', choices: [{ id: 'Natural', label: 'Natural wood', price: 0 }, { id: 'White', label: 'White', price: 20 }, { id: 'Sage', label: 'Sage', price: 20 }, { id: 'Navy', label: 'Navy', price: 20 }], def: 'Natural' } },
  build(o) {
    const Wd = o.paint === 'Natural' ? `wood:${o.wood}` : `paint:${o.paint}`;
    const parts = [
      box(0.05, 0.08, 0.85, -0.3, 0.3, 0.05, Wd, { rot: [12, 0, 0] }), box(0.05, 0.08, 0.85, 0.3, 0.3, 0.05, Wd, { rot: [12, 0, 0] }),
      box(0.05, 0.55, 0.06, -0.3, 0.27, 0.42, Wd, { grain: 'y' }), box(0.05, 0.55, 0.06, 0.3, 0.27, 0.42, Wd, { grain: 'y' }),
      box(0.15, 0.025, 0.72, -0.34, 0.6, 0.12, Wd), box(0.15, 0.025, 0.72, 0.34, 0.6, 0.12, Wd),
    ];
    for (let i = 0; i < 6; i++) parts.push(box(0.56, 0.02, 0.08, 0, 0.36 - i * 0.025, 0.36 - i * 0.1, Wd));
    for (let i = 0; i < 6; i++) {
      const x = -0.22 + i * 0.088;
      parts.push(box(0.075, 0.95 - Math.abs(i - 2.5) * 0.06, 0.02, x, 0.72, -0.32, Wd, { rot: [-25, 0, (i - 2.5) * -2.5], grain: 'y' }));
    }
    return { mass: 15, parts };
  },
});

// =====================================================================
export const CATALOG = ITEMS;
export const ROOMS = ['Living room', 'Bedroom', 'Kitchen + dining', 'Bathroom', 'Office', 'Outdoor'];
export const STYLES = { modern: 'Modern', flatpack: 'Flat-pack', luxury: 'Luxury', rustic: 'Rustic + vintage' };
export const TABS = [
  { id: 'furniture', label: 'Furniture', icon: '🛋️', ready: true },
  { id: 'food', label: 'Food', icon: '🍎' }, { id: 'everyday', label: 'Everyday', icon: '🧴' },
  { id: 'electronics', label: 'Electronics', icon: '📺' }, { id: 'tools', label: 'Tools', icon: '🔧' },
  { id: 'nature', label: 'Nature', icon: '🌲' }, { id: 'animals', label: 'Animals', icon: '🦌' },
  { id: 'people', label: 'People', icon: '🧍' }, { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'buildings', label: 'Buildings', icon: '🏠' }, { id: 'power', label: 'Power', icon: '⚡' },
];

export function getItem(id) { return ITEMS.find((i) => i.id === id); }

export function defaultOptions(item) {
  const o = {};
  for (const [k, opt] of Object.entries(item.options || {})) o[k] = opt.def;
  return o;
}

// options as chosen ids -> values the build() function uses + final price
export function resolve(item, chosen) {
  const vals = {};
  let price = item.price, mult = 1;
  for (const [k, opt] of Object.entries(item.options || {})) {
    const id = chosen?.[k] ?? opt.def;
    const c = opt.choices.find((x) => x.id === id) || opt.choices.find((x) => x.id === opt.def);
    if (k === 'size') vals[k] = c; else vals[k] = c.id;
    price += c.price || 0;
    if (c.mult) mult *= c.mult;
  }
  return { vals, price: Math.round(price * mult) };
}

export function buildSpec(item, chosen) {
  const { vals, price } = resolve(item, chosen);
  const spec = item.build(vals);
  spec.bodies = spec.bodies || { main: {} };
  spec.price = price;
  return spec;
}
