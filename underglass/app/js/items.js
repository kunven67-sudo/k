// Everything you can spawn. Pictures = real CC0 3D models (Poly Haven) photographed from the side.
import { asset, loadImage, canvas } from './util.js';

// size: metres come from the real model. use = what right-click (or E) does to it.
export const ITEMS = [
  // --- boom ---
  { id: 'barrel', name: 'Red Barrel', mat: 'metal', cat: 'boom', explosive: 1.4, fireExplode: true, hitExplode: 22 },
  { id: 'propane', name: 'Propane Tank', mat: 'metal', cat: 'boom', explosive: 1.1, fireExplode: true, hitExplode: 26, use: 'valve' },
  { id: 'gas_tank', name: 'Gas Bottle', mat: 'metal', cat: 'boom', explosive: 1.0, fireExplode: true, hitExplode: 26, use: 'valve' },
  { id: 'grenade', name: 'Grenade', mat: 'metal', cat: 'boom', explosive: 1.25, use: 'pin', minPx: 46 },
  { id: 'jerrycan', name: 'Fuel Can', mat: 'metal', cat: 'boom', explosive: 0.7, fireExplode: true, fuel: true, use: 'pour' },
  { id: 'cannon', name: 'Cannon', mat: 'metal', cat: 'boom', use: 'cannon', density: 2.5 },
  { id: 'pistol', name: 'Pistol', mat: 'metal', cat: 'boom', use: 'shoot', minPx: 60 },
  // --- stuff ---
  { id: 'crate', name: 'Crate', mat: 'wood', cat: 'stuff' },
  { id: 'cardboard', name: 'Box', mat: 'paper', cat: 'stuff', density: 0.15 },
  { id: 'chest', name: 'Treasure Chest', mat: 'wood', cat: 'stuff' },
  { id: 'tv', name: 'Old TV', mat: 'glass', cat: 'stuff', brk: 14, sparks: true },
  { id: 'laptop', name: 'Laptop', mat: 'plastic', cat: 'stuff', sparks: true },
  { id: 'console', name: 'Game Console', mat: 'plastic', cat: 'stuff', sparks: true },
  { id: 'boombox', name: 'Boombox', mat: 'plastic', cat: 'stuff', sparks: true },
  { id: 'megaphone', name: 'Megaphone', mat: 'plastic', cat: 'stuff' },
  { id: 'lightbulb', name: 'Light Bulb', mat: 'glass', cat: 'stuff', brk: 7, glow: true, minPx: 40 },
  { id: 'medkit', name: 'First Aid Kit', mat: 'plastic', cat: 'stuff' },
  { id: 'wet_sign', name: 'Wet Floor Sign', mat: 'plastic', cat: 'stuff' },
  { id: 'dartboard', name: 'Dartboard', mat: 'wood', cat: 'stuff', circle: true },
  { id: 'trash_can', name: 'Trash Can', mat: 'metal', cat: 'stuff', density: 0.8, trash: true },
  { id: 'trashbag', name: 'Trash Bag', mat: 'plastic', cat: 'stuff', density: 0.4, brk: 14 },
  { id: 'hydrant', name: 'Fire Hydrant', mat: 'metal', cat: 'stuff', density: 2.2, use: 'spray' },
  // --- heavy ---
  { id: 'boulder', name: 'Boulder', mat: 'stone', cat: 'heavy', density: 3 },
  { id: 'rock', name: 'Rock', mat: 'stone', cat: 'heavy', minPx: 40 },
  { id: 'sledgehammer', name: 'Sledgehammer', mat: 'metal', cat: 'heavy' },
  { id: 'axe', name: 'Axe', mat: 'wood', cat: 'heavy', density: 1.2 },
  { id: 'barrier', name: 'Concrete Barrier', mat: 'stone', cat: 'heavy' },
  { id: 'cat_statue', name: 'Cat Statue', mat: 'stone', cat: 'heavy', brk: 20 },
  { id: 'gnome', name: 'Garden Gnome', mat: 'stone', cat: 'heavy', brk: 14, density: 1.2 },
  { id: 'car', name: 'Covered Car', mat: 'metal', cat: 'heavy', density: 1.6, fireExplode: true, explosive: 1.6, burnTime: 9 },
  // --- bouncy ---
  { id: 'soccer', name: 'Soccer Ball', mat: 'rubber', cat: 'bouncy', circle: true, minPx: 46 },
  { id: 'baseball', name: 'Baseball', mat: 'rubber', cat: 'bouncy', circle: true, rest: 0.55, minPx: 34 },
  { id: 'footballusa', name: 'Football', mat: 'rubber', cat: 'bouncy', rest: 0.6 },
  { id: 'tyre', name: 'Tire', mat: 'rubber', cat: 'bouncy', circle: true, rest: 0.8 },
  { id: 'duck', name: 'Rubber Duck', mat: 'rubber', cat: 'bouncy', squeak: true },
  // --- food + drink (stickmen eat and drink these) ---
  { id: 'apple', name: 'Apple', mat: 'food', cat: 'food', food: 30, circle: true, minPx: 30 },
  { id: 'bananas', name: 'Bananas', mat: 'food', cat: 'food', food: 35, minPx: 40 },
  { id: 'buns', name: 'Bread Bun', mat: 'food', cat: 'food', food: 25, minPx: 34 },
  { id: 'wine_bottles', name: 'Wine', mat: 'glass', cat: 'food', drink: 30, alcohol: 0.35, brk: 12, minPx: 40 },
  // --- furniture ---
  { id: 'sofa', name: 'Sofa', mat: 'wood', cat: 'home' }, { id: 'bed', name: 'Bed', mat: 'metal', cat: 'home', density: 0.6 },
  { id: 'table', name: 'Table', mat: 'wood', cat: 'home' }, { id: 'bench', name: 'Bench', mat: 'wood', cat: 'home' },
  { id: 'picnic', name: 'Picnic Table', mat: 'wood', cat: 'home' }, { id: 'bar_stool', name: 'Bar Stool', mat: 'wood', cat: 'home' },
  { id: 'wine_barrel', name: 'Wine Barrel', mat: 'wood', cat: 'home' }, { id: 'register', name: 'Cash Register', mat: 'metal', cat: 'home' },
  { id: 'school_desk', name: 'School Desk', mat: 'metal', cat: 'home', density: 0.5 }, { id: 'chalkboard', name: 'Chalkboard', mat: 'wood', cat: 'home' },
  { id: 'bookshelf', name: 'Bookshelf', mat: 'wood', cat: 'home' }, { id: 'books', name: 'Books', mat: 'paper', cat: 'home' },
  { id: 'wheelchair', name: 'Wheelchair', mat: 'metal', cat: 'home', density: 0.5 }, { id: 'plant', name: 'Plant', mat: 'plastic', cat: 'home' },
  { id: 'fire_pit', name: 'Fire Pit', mat: 'stone', cat: 'home', alwaysFire: true }, { id: 'street_lamp', name: 'Street Lamp', mat: 'metal', cat: 'home', glow: true, deskH: 300 },
  // --- nature ---
  { id: 'tree_island', name: 'Tree', mat: 'wood', cat: 'nature', deskH: 360 }, { id: 'tree_small', name: 'Young Tree', mat: 'wood', cat: 'nature', deskH: 300 },
  { id: 'tree_fir', name: 'Fir Tree', mat: 'wood', cat: 'nature', deskH: 420 }, { id: 'tree_pine', name: 'Pine Tree', mat: 'wood', cat: 'nature', deskH: 420 },
  { id: 'shrub2', name: 'Bush', mat: 'wood', cat: 'nature', deskH: 120 }, { id: 'fern', name: 'Fern', mat: 'wood', cat: 'nature', deskH: 70 },
];
export const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const DESK_PPM = 110; // desktop: pixels per real metre for spawned items
let META = null; const IMG = {};
export async function loadItems() {
  META = await (await fetch(asset('sprites/sprites.json'))).json();
  await Promise.all(ITEMS.concat([{ id: 'grass_a' }, { id: 'grass_c' }, { id: 'dandelion' }]).map(async it => {
    const im = await loadImage(asset('sprites/' + it.id + '.webp')); if (im) IMG[it.id] = im;
  }));
  for (const it of ITEMS) it.meta = META[it.id];
  return META;
}
export const spriteImg = (id) => IMG[id];
export const spriteMeta = (id) => META && META[id];
// size in px of an item for a given px-per-metre
export function itemSize(it, ppm, mul = 1) {
  const m = META[it.id]; if (!m) return { w: 40, h: 40 };
  let w = m.w * ppm, h = m.h * ppm;
  if (it.deskH && ppm === DESK_PPM) { const k = it.deskH / h; w *= k; h *= k; }
  const mx = Math.max(w, h), min = ppm === DESK_PPM ? (it.minPx || 30) : 5; if (mx < min) { w *= min / mx; h *= min / mx; }
  if (Math.max(w, h) > 520 && ppm === DESK_PPM) { const k = 520 / Math.max(w, h); w *= k; h *= k; }
  return { w: w * mul, h: h * mul };
}
// spawn one item as a physics body
export function spawnItem(P, it, x, y, o = {}) {
  const im = IMG[it.id], m = META[it.id]; if (!im || !m) return null;
  const { w, h } = itemSize(it, o.ppm || DESK_PPM, o.size || 1);
  const tex = im; // the picture itself (already see-through around the object)
  let b;
  if (it.circle) b = P.addCircle(Math.min(w, h) / 2 * 0.96, x, y, o.angle || 0, { tex, tox: -w / 2, toy: -h / 2, tw: w, th: h, mat: it.mat, kind: 'item', def: it, density: it.density, rest: it.rest, brk: it.brk, vx: o.vx, vy: o.vy, ccd: w < 60 });
  else {
    const poly = m.hull.map(p => [p[0] * w - w / 2, p[1] * h - h / 2]);
    // centre of mass = centre of the hull, so pictures stay lined up
    let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
    b = P.addPoly(poly.map(p => [p[0] - cx, p[1] - cy]), x, y, o.angle || 0, { tex, tox: -w / 2 - cx, toy: -h / 2 - cy, tw: w, th: h, mat: it.mat, kind: 'item', def: it, density: it.density, rest: it.rest, brk: it.brk, vx: o.vx, vy: o.vy, ccd: Math.max(w, h) < 70 });
  }
  b.label = it.name; b.item = it.id;
  if (it.use === 'pin' && o.armed) b.fuse = 4.0;
  if (it.alwaysFire) b.burn = 2, b.eternal = true;
  return b;
}
// a small picture of an item for the menu
export function thumb(id) { const im = IMG[id]; return im ? im.src : ''; }
