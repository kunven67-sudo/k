// Items: resources, tools, weapons and food. Tiny people's things are human-sized models drawn at
// tiny scale; things from YOUR world are real-size (a pencil is 19 cm = a giant log to them).
import * as THREE from 'three';
import { std, glow, roundedBox } from '../world/materials.js';
import { nextId, rand, clamp } from '../core/util.js';

export const TINY = 1 / 60;

const mats = {};
const M = (c, r = 0.7, m = 0) => (mats[c + ':' + r + ':' + m] ||= std(c, r, m));

function grp(...meshes) { const g = new THREE.Group(); for (const m of meshes) { m.castShadow = true; g.add(m); } return g; }
function cyl(r1, r2, h, c, rough, metal, seg = 8) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), M(c, rough, metal)); }
function box(w, h, d, c, rough, metal) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, rough, metal)); }
function sph(r, c, rough, metal, w = 10, h = 8) { return new THREE.Mesh(new THREE.SphereGeometry(r, w, h), M(c, rough, metal)); }
const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };

// weapons: type blade | blunt | pierce | shot | gadget ; reach in meters at scale 1 (person scale)
export const ITEMS = {
  // ---------------- tiny people's stuff (model in human meters)
  stick: { label: 'Stick', kind: 'res', res: 'wood', amt: 1, r: 0.5, make: () => grp(at(cyl(0.025, 0.03, 1, 0x7a5232), 0, 0.03, 0, 0, 0, Math.PI / 2)) },
  log: { label: 'Log', kind: 'res', res: 'wood', amt: 3, r: 0.6, heavy: true, make: () => grp(at(cyl(0.12, 0.12, 1.2, 0x6a4a2c, 0.9, 0, 10), 0, 0.12, 0, 0, 0, Math.PI / 2)) },
  pebble: { label: 'Pebble', kind: 'res', res: 'stone', amt: 1, r: 0.09, make: () => grp(at(new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), M(0x8a8780, 0.9)), 0, 0.06, 0)) },
  stone: { label: 'Stone', kind: 'res', res: 'stone', amt: 3, r: 0.2, heavy: true, make: () => grp(at(new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), M(0x7a7872, 0.9)), 0, 0.14, 0)) },
  fiber: { label: 'Grass fiber', kind: 'res', res: 'fiber', amt: 1, r: 0.25, make: () => grp(...[0, 1, 2].map((i) => at(cyl(0.012, 0.012, 0.5, 0x8aa040), i * 0.02, 0.02, 0, 0, 0, Math.PI / 2))) },
  clay: { label: 'Clay', kind: 'res', res: 'clay', amt: 1, r: 0.12, make: () => grp(at(sph(0.1, 0x9a5a3a, 0.9), 0, 0.07, 0)) },
  metal: { label: 'Metal bar', kind: 'res', res: 'metal', amt: 1, r: 0.12, make: () => grp(at(box(0.22, 0.05, 0.09, 0x9aa0a6, 0.35, 0.9), 0, 0.03, 0)) },
  powder: { label: 'Gunpowder', kind: 'res', res: 'powder', amt: 1, r: 0.08, make: () => grp(at(sph(0.07, 0x2a2a2a, 0.9), 0, 0.06, 0)) },
  berries: { label: 'Berries', kind: 'food', food: 18, r: 0.08, make: () => grp(...[0, 1, 2, 3].map((i) => at(sph(0.035, 0xc0182c, 0.4), (i % 2) * 0.05, 0.035 + (i > 1 ? 0.04 : 0), (i > 1 ? 0.02 : 0)))) },
  mushroomi: { label: 'Mushroom', kind: 'food', food: 14, r: 0.07, make: () => grp(at(cyl(0.025, 0.03, 0.08, 0xf0e6d0), 0, 0.04, 0), at(sph(0.07, 0xb08a5a, 0.7), 0, 0.09, 0)) },
  meat: { label: 'Raw meat', kind: 'food', food: 25, raw: true, r: 0.1, make: () => grp(at(sph(0.09, 0xc85060, 0.6), 0, 0.06, 0)) },
  meal: { label: 'Cooked meal', kind: 'food', food: 45, r: 0.1, make: () => grp(at(sph(0.09, 0x8a4a22, 0.6), 0, 0.06, 0), at(cyl(0.12, 0.12, 0.02, 0xd8d0c0), 0, 0.01, 0)) },
  coin: { label: 'Coin', kind: 'money', money: 1, r: 0.05, make: () => grp(at(cyl(0.05, 0.05, 0.012, 0xd8b04a, 0.3, 0.9, 12), 0, 0.006, 0)) },
  shell: { label: 'Shell money', kind: 'money', money: 1, r: 0.05, make: () => grp(at(sph(0.04, 0xf4ece0, 0.4), 0, 0.02, 0)) },
  bandage: { label: 'Bandage', kind: 'med', heal: 1, r: 0.06, make: () => grp(at(cyl(0.05, 0.05, 0.08, 0xf0f0f0, 0.9), 0, 0.04, 0, 0, 0, Math.PI / 2)) },
  torch: { label: 'Torch', kind: 'tool', light: true, r: 0.4, make: () => grp(at(cyl(0.02, 0.025, 0.6, 0x6a4a2a), 0, 0.3, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 6), glow(0xff8a20, 2)), 0, 0.66, 0)) },
  stone_axe: { label: 'Stone axe', kind: 'tool', chop: 2, mine: 0.5, weapon: { type: 'blade', dmg: 18, reach: 0.75, speed: 1.1 }, tech: 0, recipe: { wood: 1, stone: 1 }, r: 0.35, make: () => grp(at(cyl(0.02, 0.025, 0.7, 0x7a5232), 0, 0.35, 0), at(box(0.18, 0.08, 0.05, 0x7a7872, 0.9), 0.07, 0.66, 0)) },
  stone_pick: { label: 'Stone pickaxe', kind: 'tool', mine: 2, chop: 0.5, weapon: { type: 'pierce', dmg: 16, reach: 0.75, speed: 1.0 }, tech: 0, recipe: { wood: 1, stone: 2 }, r: 0.35, make: () => grp(at(cyl(0.02, 0.025, 0.7, 0x7a5232), 0, 0.35, 0), at(box(0.34, 0.05, 0.05, 0x7a7872, 0.9), 0, 0.66, 0)) },
  spear: { label: 'Spear', kind: 'weapon', weapon: { type: 'pierce', dmg: 22, reach: 1.25, speed: 1.0, thrown: true }, tech: 0, recipe: { wood: 2, stone: 1 }, r: 0.8, make: () => grp(at(cyl(0.018, 0.02, 1.6, 0x7a5232), 0, 0.8, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), M(0x7a7872, 0.9)), 0, 1.66, 0)) },
  club: { label: 'Club', kind: 'weapon', weapon: { type: 'blunt', dmg: 16, reach: 0.8, speed: 1.0 }, tech: 0, recipe: { wood: 2 }, r: 0.4, make: () => grp(at(cyl(0.07, 0.03, 0.75, 0x6a4a2c), 0, 0.37, 0)) },
  bow: { label: 'Bow', kind: 'weapon', weapon: { type: 'pierce', dmg: 20, reach: 9, speed: 0.6, ranged: true, proj: 'arrow' }, tech: 1, recipe: { wood: 2, fiber: 2 }, r: 0.5, make: () => grp(at(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.018, 6, 16, Math.PI), M(0x6a4a2c)), 0, 0.5, 0, 0, 0, Math.PI / 2)) },
  shield: { label: 'Wood shield', kind: 'armor', block: 0.5, tech: 1, recipe: { wood: 3 }, r: 0.35, make: () => grp(at(cyl(0.32, 0.32, 0.05, 0x8a6a40, 0.8, 0, 14), 0, 0.32, 0, Math.PI / 2, 0, 0)) },
  drum: { label: 'Drum', kind: 'fun', tech: 1, recipe: { wood: 2, fiber: 1 }, r: 0.25, make: () => grp(at(cyl(0.2, 0.2, 0.3, 0xa0703a, 0.8, 0, 14), 0, 0.15, 0), at(cyl(0.19, 0.19, 0.01, 0xf0e0c0, 0.9, 0, 14), 0, 0.305, 0)) },
  knife: { label: 'Knife', kind: 'weapon', weapon: { type: 'blade', dmg: 20, reach: 0.55, speed: 1.6 }, tech: 2, recipe: { metal: 1 }, r: 0.2, make: () => grp(at(box(0.03, 0.22, 0.008, 0xc8ccd0, 0.25, 0.9), 0, 0.2, 0), at(box(0.035, 0.1, 0.025, 0x3a2a1a), 0, 0.05, 0)) },
  sword: { label: 'Metal sword', kind: 'weapon', weapon: { type: 'blade', dmg: 34, reach: 1.0, speed: 1.1 }, tech: 2, recipe: { metal: 2, wood: 1 }, r: 0.5, make: () => grp(at(box(0.05, 0.85, 0.01, 0xd0d4d8, 0.2, 0.95), 0, 0.6, 0), at(box(0.2, 0.03, 0.04, 0x8a6a2a, 0.4, 0.7), 0, 0.17, 0), at(cyl(0.02, 0.02, 0.17, 0x3a2a1a), 0, 0.08, 0)) },
  metal_axe: { label: 'Metal axe', kind: 'tool', chop: 4, weapon: { type: 'blade', dmg: 30, reach: 0.8, speed: 0.95 }, tech: 2, recipe: { metal: 1, wood: 1 }, r: 0.35, make: () => grp(at(cyl(0.02, 0.025, 0.75, 0x7a5232), 0, 0.37, 0), at(box(0.2, 0.12, 0.02, 0xc0c4c8, 0.3, 0.9), 0.08, 0.68, 0)) },
  metal_pick: { label: 'Metal pickaxe', kind: 'tool', mine: 4, weapon: { type: 'pierce', dmg: 24, reach: 0.8, speed: 0.9 }, tech: 2, recipe: { metal: 1, wood: 1 }, r: 0.35, make: () => grp(at(cyl(0.02, 0.025, 0.75, 0x7a5232), 0, 0.37, 0), at(box(0.4, 0.04, 0.04, 0xc0c4c8, 0.3, 0.9), 0, 0.7, 0)) },
  cleaver: { label: 'Cleaver', kind: 'weapon', weapon: { type: 'blade', dmg: 40, reach: 0.65, speed: 0.9, heavy: true }, tech: 2, recipe: { metal: 2 }, r: 0.25, make: () => grp(at(box(0.16, 0.24, 0.01, 0xc8ccd0, 0.25, 0.9), 0.04, 0.3, 0), at(cyl(0.02, 0.02, 0.16, 0x2a1a10), 0, 0.08, 0)) },
  pistol: { label: 'Pistol', kind: 'weapon', weapon: { type: 'shot', dmg: 45, reach: 14, speed: 0.9, ranged: true, proj: 'bullet' }, tech: 3, recipe: { metal: 3, powder: 1 }, r: 0.15, make: () => grp(at(box(0.04, 0.12, 0.03, 0x2a2a2a, 0.4, 0.7), 0, 0.06, 0), at(box(0.035, 0.035, 0.2, 0x3a3a3a, 0.3, 0.8), 0, 0.12, 0.07)) },
  rifle: { label: 'Rifle', kind: 'weapon', weapon: { type: 'shot', dmg: 70, reach: 26, speed: 0.6, ranged: true, proj: 'bullet', twoHand: true }, tech: 3, recipe: { metal: 5, powder: 2, wood: 1 }, r: 0.6, make: () => grp(at(box(0.05, 0.08, 0.9, 0x5a3a22), 0, 0.08, 0), at(cyl(0.015, 0.015, 0.5, 0x2a2a2a, 0.3, 0.8), 0, 0.12, 0.6, Math.PI / 2, 0, 0)) },
  zapspear: { label: 'Shock spear', kind: 'weapon', weapon: { type: 'pierce', dmg: 40, reach: 1.3, speed: 1.0, shock: true }, tech: 4, recipe: { metal: 2, wood: 2, electric: 1 }, r: 0.8, make: () => grp(at(cyl(0.02, 0.02, 1.6, 0x3a3a3a, 0.3, 0.8), 0, 0.8, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), glow(0x60c0ff, 2)), 0, 1.66, 0)) },
  tinyray: { label: 'Tiny shrink ray', kind: 'weapon', weapon: { type: 'gadget', dmg: 0, reach: 20, speed: 0.4, ranged: true, proj: 'shrink' }, tech: 5, recipe: { metal: 4, electric: 2 }, r: 0.2, make: () => grp(at(box(0.06, 0.1, 0.25, 0x3a4a4a, 0.3, 0.7), 0, 0.08, 0), at(sph(0.05, 0x63e6be, 0.2, 0.2), 0, 0.12, 0.14)) },
  lamp: { label: 'Lamp', kind: 'misc', light: true, tech: 4, recipe: { metal: 1, electric: 1 }, r: 0.15, make: () => grp(at(cyl(0.02, 0.02, 1.4, 0x3a3a3a, 0.3, 0.8), 0, 0.7, 0), at(sph(0.08, 0xfff2d0), 0, 1.45, 0)) },

  // ---------------- things from YOUR world (real meters)
  pencil: { label: 'Pencil', kind: 'deposit', big: true, give: { wood: 40 }, needs: 'chop', price: 2, r: 0.095, make: () => grp(at(cyl(0.0038, 0.0038, 0.17, 0xf2c230, 0.6, 0, 6), 0, 0.0038, 0, 0, 0, Math.PI / 2), at(new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.018, 6), M(0xe0c090)), 0.094, 0.0038, 0, 0, 0, -Math.PI / 2), at(cyl(0.0039, 0.0039, 0.012, 0xe88a9a), -0.091, 0.0038, 0, 0, 0, Math.PI / 2)) },
  toothpick: { label: 'Toothpick', kind: 'weapon', big: true, give: { wood: 6 }, weapon: { type: 'pierce', dmg: 26, reach: 1.9, speed: 0.9, twoHand: true }, price: 1, r: 0.033, make: () => grp(at(cyl(0.0009, 0.0009, 0.065, 0xe0c890, 0.8, 0, 6), 0, 0.001, 0, 0, 0, Math.PI / 2)) },
  paperclip: { label: 'Paperclip', kind: 'deposit', big: true, give: { metal: 15 }, needs: 'none', price: 2, r: 0.018, make: () => grp(at(new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0005, 6, 20), M(0xb8c0c8, 0.3, 0.9)), 0.008, 0.0006, 0, Math.PI / 2, 0, 0), at(new THREE.Mesh(new THREE.TorusGeometry(0.003, 0.0005, 6, 20), M(0xb8c0c8, 0.3, 0.9)), -0.006, 0.0006, 0, Math.PI / 2, 0, 0), at(cyl(0.0005, 0.0005, 0.014, 0xb8c0c8, 0.3, 0.9, 6), 0.001, 0.0006, 0.004, 0, 0, Math.PI / 2), at(cyl(0.0005, 0.0005, 0.014, 0xb8c0c8, 0.3, 0.9, 6), 0.001, 0.0006, -0.004, 0, 0, Math.PI / 2)) },
  staple: { label: 'Staples', kind: 'deposit', big: true, give: { metal: 4 }, needs: 'none', price: 1, r: 0.007, make: () => grp(at(box(0.012, 0.0006, 0.0006, 0xc0c4c8, 0.3, 0.9), 0, 0.0003, 0)) },
  needle: { label: 'Sewing needle', kind: 'weapon', big: true, weapon: { type: 'pierce', dmg: 48, reach: 2.0, speed: 0.85, twoHand: true }, price: 3, r: 0.018, make: () => grp(at(cyl(0.0004, 0.00005, 0.035, 0xd0d4d8, 0.2, 0.95, 6), 0, 0.0005, 0, 0, 0, Math.PI / 2)) },
  razor: { label: 'Razor blade', kind: 'weapon', big: true, weapon: { type: 'blade', dmg: 85, reach: 1.4, speed: 0.7, twoHand: true, heavy: true }, price: 4, r: 0.022, make: () => grp(at(box(0.043, 0.0002, 0.022, 0xc8ccd0, 0.15, 0.95), 0, 0.0002, 0)) },
  tack: { label: 'Thumbtack', kind: 'weapon', big: true, weapon: { type: 'pierce', dmg: 30, reach: 0.6, speed: 1.0 }, price: 1, r: 0.006, make: () => grp(at(cyl(0.005, 0.005, 0.0015, 0xd02020, 0.5, 0, 12), 0, 0.0085, 0), at(cyl(0.0005, 0.0002, 0.008, 0xc0c4c8, 0.3, 0.9, 6), 0, 0.004, 0)) },
  shard: { label: 'Glass shard', kind: 'weapon', big: true, weapon: { type: 'blade', dmg: 50, reach: 1.0, speed: 0.95 }, price: 1, r: 0.012, make: () => { const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.02, 0.004), new THREE.Vector2(0.006, 0.014)]); return grp(at(new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.6, side: THREE.DoubleSide, roughness: 0.05 })), -0.01, 0.0005, 0.007, -Math.PI / 2, 0, 0)); } },
  crumb: { label: 'Cracker crumb', kind: 'fooddep', big: true, give: { food: 160 }, price: 1, r: 0.008, make: () => grp(at(new THREE.Mesh(roundedBox(0.012, 0.006, 0.01, 0.0015), M(0xd9a85a, 0.9)), 0, 0.003, 0)) },
  sugar: { label: 'Sugar cube', kind: 'fooddep', big: true, give: { food: 120 }, price: 1, r: 0.009, make: () => grp(at(box(0.015, 0.015, 0.015, 0xf8f8f4, 0.8), 0, 0.0075, 0)) },
  gummy: { label: 'Gummy bear', kind: 'fooddep', big: true, give: { food: 110 }, price: 1, r: 0.01, make: () => grp(at(new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3a3a, roughness: 0.15, transparent: true, opacity: 0.85 })), 0, 0.006, 0), at(new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3a3a, roughness: 0.15, transparent: true, opacity: 0.85 })), 0, 0.0145, 0)) },
  grape: { label: 'Grape', kind: 'fooddep', big: true, give: { food: 90, water: 60 }, price: 1, r: 0.009, make: () => grp(at(new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), new THREE.MeshStandardMaterial({ color: 0x5a2a6a, roughness: 0.25 })), 0, 0.009, 0)) },
  waterdrop: { label: 'Bottle cap of water', kind: 'water', big: true, give: { water: 300 }, price: 0, r: 0.016, make: () => grp(at(cyl(0.015, 0.015, 0.006, 0x2a7ad8, 0.4, 0.3, 16), 0, 0.003, 0), at(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.001, 16), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.7, roughness: 0.05 })), 0, 0.0055, 0)) },
  battery: { label: 'AA battery', kind: 'deposit', big: true, give: { electric: 6, metal: 6 }, needs: 'none', tech: 3, price: 3, r: 0.025, make: () => grp(at(cyl(0.007, 0.007, 0.05, 0x1a1a1a, 0.4, 0.4, 14), 0, 0.007, 0, 0, 0, Math.PI / 2), at(cyl(0.0071, 0.0071, 0.012, 0xc87a1a, 0.4, 0.6, 14), 0.019, 0.007, 0, 0, 0, Math.PI / 2)) },
  match: { label: 'Match', kind: 'deposit', big: true, give: { powder: 3, fire: 1, wood: 2 }, needs: 'none', price: 1, r: 0.023, make: () => grp(at(cyl(0.001, 0.001, 0.045, 0xe8d8b0, 0.8, 0, 6), 0, 0.001, 0, 0, 0, Math.PI / 2), at(sph(0.0018, 0xc02020, 0.6), 0.0225, 0.0012, 0)) },
  penny: { label: 'Penny', kind: 'deposit', big: true, give: { metal: 10, coins: 30 }, needs: 'none', price: 0.01, r: 0.0095, make: () => grp(at(cyl(0.0095, 0.0095, 0.0015, 0xb8733a, 0.35, 0.85, 20), 0, 0.00075, 0)) },
  cotton: { label: 'Cotton ball', kind: 'bed', big: true, give: { fiber: 20 }, price: 1, r: 0.012, make: () => grp(at(sph(0.012, 0xffffff, 1, 0, 12, 10), 0, 0.01, 0)) },
  pill: { label: 'Pill (medicine)', kind: 'med', big: true, give: { medicine: 4 }, price: 2, r: 0.005, make: () => grp(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.002, 0.005, 4, 8), M(0xf0f0f0, 0.4)), 0, 0.002, 0, 0, 0, Math.PI / 2)) },
  bandaid: { label: 'Band-aid', kind: 'med', big: true, give: { bandage: 8 }, price: 1, r: 0.035, make: () => grp(at(box(0.07, 0.0005, 0.019, 0xe0b090, 0.8), 0, 0.0003, 0), at(box(0.022, 0.0007, 0.015, 0xf8f0e8, 0.9), 0, 0.0005, 0)) },
  candle: { label: 'Tea light candle', kind: 'fire', big: true, give: { fire: 1 }, price: 1, r: 0.02, make: () => grp(at(cyl(0.019, 0.019, 0.016, 0xc0c4c8, 0.3, 0.8, 16), 0, 0.008, 0), at(cyl(0.017, 0.017, 0.002, 0xf8f4e8, 0.8, 0, 16), 0, 0.016, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.01, 8), glow(0xffa030, 3)), 0, 0.022, 0)) },
  lego: { label: 'Toy brick', kind: 'deposit', big: true, give: { stone: 10 }, needs: 'none', price: 1, r: 0.016, make: () => grp(at(box(0.032, 0.0096, 0.016, 0xd02a2a, 0.4), 0, 0.0048, 0), ...[0, 1, 2, 3].flatMap((i) => [0, 1].map((k) => at(cyl(0.0024, 0.0024, 0.0017, 0xd02a2a, 0.4, 0, 10), -0.012 + i * 0.008, 0.0104, -0.004 + k * 0.008)))) },
  seeds: { label: 'Seeds', kind: 'farm', big: true, give: { seeds: 20 }, price: 1, r: 0.01, make: () => grp(...[0, 1, 2, 3, 4].map((i) => at(sph(0.0015, 0x6a4a2a, 0.8), (i - 2) * 0.003, 0.0012, (i % 2) * 0.002))) },
  dollhouse: { label: 'Dollhouse', kind: 'building', big: true, shelter: 10, price: 25, r: 0.2, make: makeDollhouse },
  castle: { label: 'Toy castle', kind: 'building', big: true, shelter: 8, walls: true, price: 30, r: 0.16, make: makeCastle },
  tower: { label: 'Block tower', kind: 'building', big: true, shelter: 3, price: 8, r: 0.05, make: () => { const g = new THREE.Group(); const cols = [0xd02a2a, 0x2a6ad0, 0xe0b020, 0x2aa04a]; for (let i = 0; i < 6; i++) { const b = box(0.06, 0.035, 0.06, cols[i % 4], 0.5); b.position.y = 0.0175 + i * 0.035; b.rotation.y = i * 0.2; b.castShadow = b.receiveShadow = true; g.add(b); } return g; } },
  toycar: { label: 'Toy car', kind: 'vehicle', big: true, price: 6, r: 0.04, make: () => grp(at(new THREE.Mesh(roundedBox(0.08, 0.02, 0.035, 0.006), M(0x2a7ad0, 0.3, 0.4)), 0, 0.016, 0), at(new THREE.Mesh(roundedBox(0.04, 0.015, 0.03, 0.005), M(0x2a7ad0, 0.3, 0.4)), -0.005, 0.03, 0), ...[[-0.025, -0.018], [0.025, -0.018], [-0.025, 0.018], [0.025, 0.018]].map(([x, z]) => at(cyl(0.008, 0.008, 0.006, 0x1a1a1a, 0.8, 0, 12), x, 0.008, z, Math.PI / 2, 0, 0))) },
};

function makeDollhouse() {
  const g = new THREE.Group();
  const wall = M(0xf2d8c8, 0.8), roof = M(0xb04a4a, 0.7), trim = M(0xffffff, 0.6), floorM = M(0xc8a070, 0.8);
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const W = 0.4, D = 0.25, H = 0.3;
  add(new THREE.BoxGeometry(W, 0.01, D), floorM, 0, 0.005, 0);
  add(new THREE.BoxGeometry(W, 0.01, D), floorM, 0, H / 2, 0);
  add(new THREE.BoxGeometry(W, H, 0.01), wall, 0, H / 2, -D / 2);
  add(new THREE.BoxGeometry(0.01, H, D), wall, -W / 2, H / 2, 0);
  add(new THREE.BoxGeometry(0.01, H, D), wall, W / 2, H / 2, 0);
  add(new THREE.BoxGeometry(0.01, H, D), wall, 0, H / 2, 0);
  add(new THREE.BoxGeometry(W * 0.55, 0.012, D + 0.04), roof, -W * 0.24, H + 0.06, 0, 0, 0.55);
  add(new THREE.BoxGeometry(W * 0.55, 0.012, D + 0.04), roof, W * 0.24, H + 0.06, 0, 0, -0.55);
  for (const x of [-0.1, 0.1]) add(new THREE.BoxGeometry(0.05, 0.05, 0.002), M(0x9fd4ff, 0.1), x, H * 0.75, -D / 2 - 0.006);
  add(new THREE.BoxGeometry(0.01, 0.3, 0.01), trim, -W / 2, 0.15, D / 2);
  // tiny bed + table inside
  add(new THREE.BoxGeometry(0.06, 0.012, 0.035), M(0x7a5a8a, 0.9), -0.12, 0.018, -0.06);
  add(new THREE.BoxGeometry(0.04, 0.02, 0.03), M(0x8a6040, 0.8), 0.1, 0.02, -0.04);
  return g;
}

function makeCastle() {
  const g = new THREE.Group();
  const stone = M(0xb8b0a0, 0.9), dark = M(0x6a6a6a, 0.9);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const S = 0.3, H = 0.12;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    add(new THREE.CylinderGeometry(0.035, 0.04, H * 1.6, 12), stone, x * S / 2, H * 0.8, z * S / 2);
    add(new THREE.ConeGeometry(0.045, 0.06, 12), M(0x3a5ab0, 0.6), x * S / 2, H * 1.6 + 0.03, z * S / 2);
  }
  add(new THREE.BoxGeometry(S, H, 0.012), stone, 0, H / 2, -S / 2);
  add(new THREE.BoxGeometry(0.012, H, S), stone, -S / 2, H / 2, 0);
  add(new THREE.BoxGeometry(0.012, H, S), stone, S / 2, H / 2, 0);
  add(new THREE.BoxGeometry(S * 0.35, H, 0.012), stone, -S * 0.33, H / 2, S / 2);
  add(new THREE.BoxGeometry(S * 0.35, H, 0.012), stone, S * 0.33, H / 2, S / 2);
  add(new THREE.BoxGeometry(S * 0.3, H * 0.3, 0.012), stone, 0, H * 0.85, S / 2);
  add(new THREE.BoxGeometry(0.08, 0.08, 0.08), dark, 0, 0.04, -0.05);
  return g;
}

export const SUPPLY = ['crumb', 'sugar', 'gummy', 'grape', 'waterdrop', 'pencil', 'toothpick', 'paperclip', 'staple', 'needle', 'razor', 'tack', 'shard', 'battery', 'match', 'penny', 'cotton', 'pill', 'bandaid', 'candle', 'lego', 'seeds', 'tower', 'toycar', 'dollhouse', 'castle'];

// ------------------------------------------------------------- item entity
export class Item {
  constructor(type, pos, scale, extra = {}) {
    const def = ITEMS[type];
    this.id = extra.id || nextId();
    this.type = type;
    this.def = def;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = extra.yaw ?? rand() * Math.PI * 2;
    this.scale = scale;
    this.pool = def.give ? { ...def.give, ...(extra.pool || {}) } : null;
    this.owner = extra.owner || null;
    this.heldBy = null;
    this.rest = false;
    this.mesh = def.make();
    this.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.mesh.scale.setScalar(scale);
    this.mesh.userData.item = this;
    this.charge = extra.charge ?? 1;
  }

  get radius() { return this.def.r * this.scale; }

  // weight relative to a tiny person can lift it (in "person loads")
  get size() { return this.def.r * this.scale; }

  update(dt, groundFn, inCage, cage) {
    if (this.heldBy) return;
    if (!this.rest) {
      const g = 9.8 * Math.sqrt(clamp(this.scale * 3, 0.01, 1));
      this.vel.y -= g * dt;
      this.pos.addScaledVector(this.vel, dt);
      const gy = groundFn(this.pos.x, this.pos.z, this.pos.y + this.radius * 0.5);
      if (this.pos.y <= gy) {
        this.pos.y = gy;
        if (this.vel.y < -0.3 * Math.sqrt(this.scale)) { this.vel.y *= -0.25; this.vel.x *= 0.5; this.vel.z *= 0.5; }
        else { this.vel.set(0, 0, 0); this.rest = true; }
      }
      if (inCage && cage) {
        if (this.pos.x < cage.x0 + 0.002) { this.pos.x = cage.x0 + 0.002; this.vel.x *= -0.3; }
        if (this.pos.x > cage.x1 - 0.002) { this.pos.x = cage.x1 - 0.002; this.vel.x *= -0.3; }
        if (this.pos.z < cage.z0 + 0.002) { this.pos.z = cage.z0 + 0.002; this.vel.z *= -0.3; }
        if (this.pos.z > cage.z1 - 0.002) { this.pos.z = cage.z1 - 0.002; this.vel.z *= -0.3; }
      }
    } else {
      // things sink with the ground (terrain edits) or start falling if the floor is gone
      const gy = groundFn(this.pos.x, this.pos.z, this.pos.y + this.radius * 0.5);
      if (gy < this.pos.y - 0.0005) this.rest = false; else this.pos.y = gy;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }

  save() { return { id: this.id, type: this.type, p: this.pos.toArray(), s: this.scale, pool: this.pool, owner: this.owner, yaw: this.yaw, charge: this.charge }; }
}

export function itemLabel(it) {
  if (!it) return '';
  let s = it.def.label;
  if (it.pool) {
    const parts = Object.entries(it.pool).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${Math.ceil(v)}`);
    if (parts.length) s += ' (' + parts.join(', ') + ')';
  }
  return s;
}
