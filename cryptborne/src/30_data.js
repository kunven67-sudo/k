
// ---------- game data ----------
const RCOL = { common: '#cdc4b4', uncommon: '#6fd46a', rare: '#55a8ef', epic: '#b878ea', legendary: '#f5b83c' };
const STEEL = { b: '#c9ced6', h: '#ffffff', g: '#8a8f99', p: '#6b4423', m: '#8a8f99' };
const ITEMS = {
  map: { name: 'World Map', type: 'map', icon: 'map', pal: { p: '#e8d5a3', g: '#5cc46e', b: '#4ea1e3', x: '#d8454a' }, rarity: 'common', desc: 'Shows Emberfall and every dungeon. Click it, the tiny map, or press M to fast-travel.' },
  // ---- weapons (melee: range px / arc degrees; bow & staff shoot)
  wood_sword: { name: 'Wooden Sword', type: 'weapon', wc: 'melee', icon: 'sword', pal: { b: '#b9844a', h: '#e0b27a', g: '#6b4423', p: '#4a2e14', m: '#6b4423' }, dmg: 6, cd: 0.38, range: 24, arc: 110, lvl: 1, price: 10, rarity: 'common', desc: 'A training sword. Splinters included.' },
  iron_sword: { name: 'Iron Sword', type: 'weapon', wc: 'melee', icon: 'sword', pal: STEEL, dmg: 11, cd: 0.36, range: 25, arc: 110, lvl: 2, price: 60, rarity: 'common', desc: 'Reliable, sharp, and cheap.' },
  hunter_bow: { name: "Hunter's Bow", type: 'weapon', wc: 'bow', icon: 'bow', pal: { b: '#8a5a2b', g: '#5a3418', s: '#efe4cc' }, dmg: 10, cd: 0.5, speed: 240, lvl: 3, price: 110, rarity: 'uncommon', desc: 'Shoots arrows. Kill things before they reach you.' },
  battle_axe: { name: 'Battle Axe', type: 'weapon', wc: 'melee', icon: 'axe', pal: { b: '#aab2bd', h: '#e6ebf0', p: '#6b4423' }, dmg: 19, cd: 0.6, range: 25, arc: 150, lvl: 4, price: 180, rarity: 'uncommon', desc: 'Wide, heavy swings that hit everything in front of you.' },
  venom_dagger: { name: 'Venomfang Dagger', type: 'weapon', wc: 'melee', icon: 'dagger', pal: { b: '#7be06a', h: '#d6ffc8', g: '#3d2a4a', p: '#2a1a30', m: '#7a5a8a' }, dmg: 14, cd: 0.22, range: 21, arc: 90, poison: true, lvl: 5, value: 380, rarity: 'rare', desc: 'Lightning fast. Poisons whatever it cuts. Chest loot only.' },
  steel_longsword: { name: 'Steel Longsword', type: 'weapon', wc: 'melee', icon: 'sword', pal: { b: '#dfe6ee', h: '#ffffff', g: '#f2c13a', p: '#3a2616', m: '#f2c13a' }, dmg: 22, cd: 0.36, range: 29, arc: 120, lvl: 6, price: 320, rarity: 'uncommon', desc: 'Longer reach, cleaner cuts.' },
  ember_staff: { name: 'Ember Staff', type: 'weapon', wc: 'staff', icon: 'staff', pal: { g: '#f2c13a', o: '#ff7a2a', h: '#ffe08a', p: '#5a3418' }, dmg: 24, cd: 0.55, speed: 190, aoe: 24, lvl: 8, price: 520, rarity: 'rare', desc: 'Throws fireballs that explode on impact.' },
  frost_bow: { name: 'Frostbite Bow', type: 'weapon', wc: 'bow', icon: 'bow', pal: { b: '#7fd8ff', g: '#2a6fa0', s: '#ffffff' }, dmg: 22, cd: 0.4, speed: 290, slow: true, lvl: 9, value: 900, rarity: 'rare', desc: 'Arrows freeze enemies and slow them down. Chest loot only.' },
  war_hammer: { name: 'War Hammer', type: 'weapon', wc: 'melee', icon: 'hammer', pal: { b: '#8a8f99', h: '#d7dde6', p: '#5a3418', m: '#f2c13a' }, dmg: 42, cd: 0.8, range: 27, arc: 160, kb: 2.2, lvl: 10, price: 760, rarity: 'rare', desc: 'Slow. Smashes enemies across the room.' },
  runeblade: { name: 'Runeblade', type: 'weapon', wc: 'melee', icon: 'sword', pal: { b: '#5ff0ff', h: '#e0ffff', g: '#b878ea', p: '#2a1a40', m: '#b878ea' }, dmg: 40, cd: 0.32, range: 31, arc: 120, lvl: 13, price: 1200, rarity: 'epic', desc: 'Glowing runes. Fast and deadly.' },
  soul_scythe: { name: 'Soulreaver Scythe', type: 'weapon', wc: 'melee', icon: 'scythe', pal: { b: '#b878ea', h: '#f0d8ff', p: '#2a1a30' }, dmg: 55, cd: 0.5, range: 35, arc: 220, lifesteal: 0.08, lvl: 14, value: 2600, rarity: 'epic', desc: 'Huge sweeping cuts. Heals you a little on every hit. Chest loot only.' },
  dragon_sword: { name: 'Dragonbone Greatsword', type: 'weapon', wc: 'melee', icon: 'sword', pal: { b: '#efe4cc', h: '#ffffff', g: '#a3322c', p: '#2a1010', m: '#f2b53a' }, dmg: 88, cd: 0.6, range: 36, arc: 170, kb: 1.6, lvl: 16, value: 6000, rarity: 'legendary', desc: 'Carved from a dragon. Only the Lich carries one.' },
  // ---- shields (block = share of damage stopped)
  wood_shield: { name: 'Wooden Shield', type: 'shield', icon: 'shield', pal: { r: '#5a3418', f: '#8a5a2b', e: '#b07a3e' }, block: 0.5, lvl: 1, price: 40, rarity: 'common', desc: 'Hold F to block. Lets you block at all.' },
  iron_shield: { name: 'Iron Shield', type: 'shield', icon: 'shield', pal: { r: '#5d6470', f: '#aab2bd', e: '#e6ebf0' }, block: 0.65, lvl: 4, price: 150, rarity: 'common', desc: 'Solid iron. Blocks most of a hit.' },
  kite_shield: { name: "Knight's Kite Shield", type: 'shield', icon: 'kite', pal: { r: '#8a8f99', f: '#3e6cb8', e: '#f2c13a' }, block: 0.75, lvl: 8, price: 420, rarity: 'uncommon', desc: 'A proper knight shield.' },
  tower_shield: { name: 'Tower Shield', type: 'shield', icon: 'kite', pal: { r: '#5d6470', f: '#7a1a1e', e: '#efe4cc' }, block: 0.85, lvl: 12, price: 900, rarity: 'rare', desc: 'A wall you carry around.' },
  aegis: { name: 'Aegis of Dawn', type: 'shield', icon: 'kite', pal: { r: '#f2c13a', f: '#fff3d2', e: '#ff9a3a' }, block: 0.94, parry: 0.32, lvl: 15, value: 5200, rarity: 'legendary', desc: 'Nearly unbreakable. Bigger parry window. Chest loot only.' },
  // ---- armor (def lowers damage taken)
  leather: { name: 'Leather Tunic', type: 'armor', icon: 'armor', pal: { a: '#8a5a2b', t: '#b07a3e' }, def: 5, lvl: 1, price: 50, rarity: 'common', color: '#8a5a2b', trim: '#b07a3e', desc: 'Basic protection.' },
  chainmail: { name: 'Chainmail', type: 'armor', icon: 'armor', pal: { a: '#8d96a3', t: '#c9ced6' }, def: 12, lvl: 5, price: 240, rarity: 'uncommon', color: '#8d96a3', trim: '#c9ced6', desc: 'Rings of steel.' },
  plate: { name: 'Plate Armor', type: 'armor', icon: 'armor', pal: { a: '#c9d1d9', t: '#ffffff' }, def: 22, lvl: 9, price: 600, rarity: 'rare', color: '#c9d1d9', trim: '#ffffff', desc: 'Heavy and shiny.' },
  shadow_plate: { name: 'Shadow Plate', type: 'armor', icon: 'armor', pal: { a: '#3c2f55', t: '#b878ea' }, def: 34, lvl: 13, value: 2400, rarity: 'epic', color: '#3c2f55', trim: '#b878ea', desc: 'Forged in darkness. Chest loot only.' },
  dragon_armor: { name: 'Dragonscale Armor', type: 'armor', icon: 'armor', pal: { a: '#a3322c', t: '#f2b53a' }, def: 45, lvl: 16, price: 2600, rarity: 'legendary', color: '#a3322c', trim: '#f2b53a', desc: 'The best armor money can buy.' },
  // ---- potions
  potion: { name: 'Health Potion', type: 'potion', icon: 'potion', pal: { c: '#8a5a2b', w: '#ffd6d6', l: '#d8454a', h: '#ff9a9a', d: '#8a1a22' }, heal: 45, lvl: 1, price: 15, rarity: 'common', desc: 'Heals 45 HP. Press Q to drink fast.' },
  big_potion: { name: 'Greater Health Potion', type: 'potion', icon: 'potion', pal: { c: '#f2c13a', w: '#ffd6f0', l: '#e0407a', h: '#ff9ad0', d: '#8a1a4a' }, heal: 130, lvl: 6, price: 45, rarity: 'uncommon', desc: 'Heals 130 HP.' },
  elixir: { name: 'Elixir of Life', type: 'potion', icon: 'potion', pal: { c: '#f2c13a', w: '#fff3d2', l: '#f2b53a', h: '#fff3b0', d: '#a36a10' }, heal: 99999, stam: true, lvl: 10, price: 140, rarity: 'rare', desc: 'Fully heals HP and stamina.' },
  // ---- loot to sell
  slime_gel: { name: 'Slime Gel', type: 'loot', icon: 'blob', pal: { l: '#5cc46e', h: '#c8ffc0', d: '#2f7a3c' }, sell: 3, rarity: 'common', desc: 'Dropped by Slimes. Sticky.' },
  bat_wing: { name: 'Bat Wing', type: 'loot', icon: 'wing', pal: { 1: '#4a2f5e' }, sell: 4, rarity: 'common', desc: 'Dropped by Cave Bats.' },
  wolf_pelt: { name: 'Wolf Pelt', type: 'loot', icon: 'pelt', pal: { 1: '#8a8f99', 2: '#5d6470' }, sell: 9, rarity: 'common', desc: 'Dropped by Wolves.' },
  goblin_ear: { name: 'Goblin Ear', type: 'loot', icon: 'fang', pal: { 1: '#5fae4a', 2: '#3d7a32' }, sell: 7, rarity: 'common', desc: 'Dropped by Goblins. Gross.' },
  bone: { name: 'Bone', type: 'loot', icon: 'bone', pal: { 1: '#efe4cc', 2: '#c9c0aa' }, sell: 6, rarity: 'common', desc: 'Dropped by Skeletons.' },
  skull: { name: 'Skull', type: 'loot', icon: 'skull', pal: { 1: '#efe4cc', e: '#140d1a' }, sell: 16, rarity: 'uncommon', desc: 'A rare Skeleton drop.' },
  spider_silk: { name: 'Spider Silk', type: 'loot', icon: 'silk', pal: { 1: '#efe4cc', 2: '#b0a8c0' }, sell: 12, rarity: 'common', desc: 'Dropped by Giant Spiders.' },
  venom_sac: { name: 'Venom Sac', type: 'loot', icon: 'blob', pal: { l: '#9be04a', h: '#e8ffc0', d: '#4a7a1a' }, sell: 20, rarity: 'uncommon', desc: 'A rare Giant Spider drop.' },
  orc_tusk: { name: 'Orc Tusk', type: 'loot', icon: 'fang', pal: { 1: '#f4ecd8', 2: '#c9b48a' }, sell: 24, rarity: 'common', desc: 'Dropped by Orc Brutes.' },
  ember_core: { name: 'Ember Core', type: 'loot', icon: 'orb', pal: { l: '#ff7a2a', h: '#ffe08a', d: '#a3242a' }, sell: 30, rarity: 'uncommon', desc: 'Dropped by Fire Imps. Still warm.' },
  golem_core: { name: 'Golem Core', type: 'loot', icon: 'orb', pal: { l: '#5ff0ff', h: '#e0ffff', d: '#2a6f80' }, sell: 46, rarity: 'uncommon', desc: 'Dropped by Stone Golems.' },
  ectoplasm: { name: 'Ectoplasm', type: 'loot', icon: 'blob', pal: { l: '#7ff8ff', h: '#e0ffff', d: '#3a8aa0' }, sell: 36, rarity: 'uncommon', desc: 'Dropped by Wraiths.' },
  soul_gem: { name: 'Soul Gem', type: 'loot', icon: 'gem', pal: { l: '#b878ea', h: '#f0d8ff', d: '#5a2a80' }, sell: 95, rarity: 'rare', desc: 'A rare Wraith drop. Something moves inside.' },
  ruby: { name: 'Ruby', type: 'loot', icon: 'gem', pal: { l: '#e0404a', h: '#ffc0c0', d: '#7a1a22' }, sell: 60, rarity: 'uncommon', desc: 'Found in chests.' },
  emerald: { name: 'Emerald', type: 'loot', icon: 'gem', pal: { l: '#3ad06a', h: '#c0ffd0', d: '#1a6a3a' }, sell: 70, rarity: 'uncommon', desc: 'Found in chests.' },
  sapphire: { name: 'Sapphire', type: 'loot', icon: 'gem', pal: { l: '#3a7ae0', h: '#c0d8ff', d: '#1a3a7a' }, sell: 85, rarity: 'rare', desc: 'Found in chests.' },
  gold_bar: { name: 'Gold Bar', type: 'loot', icon: 'bar', pal: { l: '#f2c13a', h: '#fff3b0', d: '#a36a10' }, sell: 120, rarity: 'rare', desc: 'Heavy. Worth a lot.' },
  relic: { name: 'Ancient Relic', type: 'loot', icon: 'orb', pal: { l: '#3ad0b0', h: '#f2c13a', d: '#1a6a5a' }, sell: 250, rarity: 'epic', desc: 'From a forgotten age.' },
  // ---- boss trophies
  slime_crown: { name: 'Slime Crown', type: 'loot', icon: 'crown', pal: { g: '#9be04a', r: '#ffffff', d: '#4a7a1a' }, sell: 90, rarity: 'rare', desc: 'Trophy from the Slime King.' },
  goblin_totem: { name: "Goblin Chief's Totem", type: 'loot', icon: 'fang', pal: { 1: '#d8454a', 2: '#7a1a1e' }, sell: 170, rarity: 'rare', desc: 'Trophy from the Goblin Chief.' },
  knight_crest: { name: "Knight's Crest", type: 'loot', icon: 'kite', pal: { r: '#f2c13a', f: '#7a1a1e', e: '#efe4cc' }, sell: 290, rarity: 'epic', desc: 'Trophy from the Skeleton Knight.' },
  queen_fang: { name: "Queen's Fang", type: 'loot', icon: 'fang', pal: { 1: '#b878ea', 2: '#5a2a80' }, sell: 430, rarity: 'epic', desc: 'Trophy from the Spider Queen.' },
  magma_heart: { name: 'Magma Heart', type: 'loot', icon: 'orb', pal: { l: '#ff5a1a', h: '#ffe08a', d: '#7a1010' }, sell: 680, rarity: 'epic', desc: 'Trophy from the Magma Golem.' },
  phylactery: { name: "Lich's Phylactery", type: 'loot', icon: 'gem', pal: { l: '#5a2a80', h: '#7ff8ff', d: '#1a0a30' }, sell: 1150, rarity: 'legendary', desc: 'Trophy from the Lich. It hums.' },
};
for (const id in ITEMS) ITEMS[id].id = id;
const STACKS = (it) => it.type === 'loot' || it.type === 'potion';
const sellPrice = (id) => { const it = ITEMS[id]; if (it.type === 'map') return 0; return it.sell != null ? it.sell : Math.max(1, Math.floor((it.price || it.value || 10) * 0.4)); };

// ---------- monsters (each type shows only its type name in game) ----------
const MON = {
  slime: { name: 'Slime', art: 'slime', pal: { 1: '#5cc46e', 2: '#b8f5a8', 3: '#2f7a3c', e: '#1a1020', w: '#ffffff' }, hp: 20, dmg: 6, spd: 40, ai: 'hop', xp: 6, coins: [1, 3], drops: [['slime_gel', 0.7]], t: 1, w: 12, h: 8 },
  bat: { name: 'Cave Bat', art: 'bat', pal: { 1: '#5a3a70', e: '#ff4d4d', t: '#ffffff' }, hp: 14, dmg: 5, spd: 72, ai: 'flutter', xp: 7, coins: [1, 3], drops: [['bat_wing', 0.6]], t: 1, w: 10, h: 6, fly: true },
  wolf: { name: 'Wolf', art: 'wolf', pal: { 1: '#8a8f99', 2: '#5d6470', e: '#ffd23a', n: '#120a10' }, hp: 40, dmg: 8, spd: 74, ai: 'melee', reach: 16, windup: 0.35, xp: 12, coins: [2, 5], drops: [['wolf_pelt', 0.6]], t: 1, w: 14, h: 8 },
  goblin: { name: 'Goblin', art: 'human', look: { skin: '#5fae4a', shirt: '#7a4a24', shirtDark: '#5a3418', pants: '#4e2e14', shoes: '#2a1a0c', ears: true, eyes: '#ffe04a', weapon: 'club' }, hp: 45, dmg: 10, spd: 54, ai: 'melee', reach: 18, windup: 0.4, xp: 14, coins: [3, 7], drops: [['goblin_ear', 0.6]], t: 2 },
  skeleton: { name: 'Skeleton', art: 'human', look: { skin: '#e8e0cc', shirt: '#e8e0cc', shirtDark: '#c9c0aa', pants: '#c9c0aa', shoes: '#a89f88', belt: '#5d5446', skull: true, ribs: '#5d5446', weapon: 'sword' }, hp: 70, dmg: 14, spd: 46, ai: 'melee', reach: 19, windup: 0.45, xp: 22, coins: [4, 9], drops: [['bone', 0.7], ['skull', 0.15]], t: 3 },
  archer: { name: 'Skeleton Archer', art: 'human', look: { skin: '#d8d0bc', shirt: '#5a4a3a', shirtDark: '#3a2e22', pants: '#c9c0aa', shoes: '#a89f88', belt: '#3a2616', skull: true, weapon: 'bow', hat: '#3a2e22' }, hp: 55, dmg: 12, spd: 42, ai: 'ranged', range: 150, proj: 'arrow', projSpd: 150, rate: 1.7, xp: 24, coins: [4, 9], drops: [['bone', 0.6], ['skull', 0.12]], t: 3 },
  spider: { name: 'Giant Spider', art: 'spider', pal: { 1: '#3d2a4a', 2: '#7a5a8a', e: '#ff3b3b', t: '#efe4cc' }, hp: 90, dmg: 18, spd: 62, ai: 'lunge', xp: 30, coins: [6, 12], drops: [['spider_silk', 0.6], ['venom_sac', 0.2]], t: 4, w: 14, h: 8 },
  orc: { name: 'Orc Brute', art: 'human', scale: 1.5, look: { skin: '#6b8a4a', shirt: '#5a4a3a', shirtDark: '#3a2e22', pants: '#3a2e22', shoes: '#2a1a0c', tusks: true, eyes: '#ff4d4d', weapon: 'axe', hairStyle: 2 }, hp: 220, dmg: 32, spd: 40, ai: 'melee', reach: 26, windup: 0.6, xp: 45, coins: [10, 20], drops: [['orc_tusk', 0.6]], t: 5 },
  imp: { name: 'Fire Imp', art: 'human', scale: 0.9, look: { skin: '#d8454a', shirt: '#a3242a', shirtDark: '#7a1a1e', pants: '#7a1a1e', shoes: '#3a0a0a', horns: '#2a1010', wings: '#5a1a20', eyes: '#ffe04a', weapon: 'fist' }, hp: 110, dmg: 22, spd: 56, ai: 'caster', range: 140, proj: 'fire', projSpd: 125, rate: 1.9, blink: true, xp: 50, coins: [10, 22], drops: [['ember_core', 0.5]], t: 5, fly: true },
  golem: { name: 'Stone Golem', art: 'human', scale: 1.6, look: { skin: '#7d7f86', shirt: '#6a6c72', shirtDark: '#55575d', pants: '#55575d', shoes: '#44464b', belt: '#55575d', spots: '#5a8a4a', eyes: '#5ff0ff', weapon: 'fist', hairStyle: 2 }, hp: 380, dmg: 38, spd: 28, ai: 'melee', reach: 26, windup: 0.75, slam: true, xp: 70, coins: [14, 28], drops: [['golem_core', 0.5]], t: 5 },
  wraith: { name: 'Wraith', art: 'human', look: { skin: '#1a1e28', robe: '#3a4a6a', hat: '#28344e', shirt: '#3a4a6a', shoes: '#3a4a6a', eyes: '#7ff8ff' }, hp: 260, dmg: 36, spd: 50, ai: 'melee', reach: 20, windup: 0.45, ghost: true, alpha: 0.78, xp: 80, coins: [16, 30], drops: [['ectoplasm', 0.6], ['soul_gem', 0.06]], t: 6, fly: true },
  // ---- bosses: `moves` is the attack rotation
  slime_king: { name: 'Slime King', art: 'slime', boss: true, scale: 3, crown: true, pal: { 1: '#3fb05a', 2: '#b8f5a8', 3: '#1f6a30', e: '#1a1020', w: '#ffffff' }, hp: 230, dmg: 12, spd: 36, ai: 'boss', moves: ['hop', 'ring:slime', 'summon:slime', 'hop'], xp: 120, coins: [0, 0], t: 1 },
  goblin_chief: { name: 'Goblin Chief', art: 'human', boss: true, scale: 2, look: { skin: '#4f9a3a', shirt: '#a3242a', shirtDark: '#7a1a1e', pants: '#4e2e14', shoes: '#2a1a0c', ears: true, eyes: '#ffe04a', weapon: 'axe', feather: true, cape: '#7a1a1e' }, hp: 650, dmg: 18, spd: 50, ai: 'boss', moves: ['chase', 'charge', 'summon:goblin', 'chase'], xp: 300, coins: [0, 0], t: 2 },
  skel_knight: { name: 'Skeleton Knight', art: 'human', boss: true, scale: 2, look: { skin: '#e8e0cc', shirt: '#e8e0cc', shirtDark: '#c9c0aa', pants: '#5d6470', shoes: '#3a3e46', skull: true, eyes: '#ff4d4d', weapon: 'bigsword', armor: '#5d6470', trim: '#aab2bd', helm: '#5d6470', cape: '#3a1a40' }, hp: 1300, dmg: 24, spd: 46, ai: 'boss', moves: ['chase', 'charge', 'slam', 'summon:skeleton'], xp: 600, coins: [0, 0], t: 3 },
  spider_queen: { name: 'Spider Queen', art: 'spider', boss: true, scale: 2, pal: { 1: '#4a1e5a', 2: '#b878ea', e: '#ff3b3b', t: '#efe4cc' }, hp: 2100, dmg: 26, spd: 58, ai: 'boss', moves: ['lunge', 'volley:web', 'summon:spider', 'lunge'], xp: 1000, coins: [0, 0], t: 4 },
  magma_golem: { name: 'Magma Golem', art: 'human', boss: true, scale: 2, look: { skin: '#8a4a36', shirt: '#6e3a2a', shirtDark: '#552a1e', pants: '#552a1e', shoes: '#3a1a12', belt: '#ff8a2a', spots: '#ffb040', eyes: '#ffe04a', weapon: 'fist', hairStyle: 2 }, hp: 3600, dmg: 40, spd: 34, ai: 'boss', moves: ['chase', 'slam', 'ring:fire', 'volley:fire'], xp: 1600, coins: [0, 0], t: 5 },
  lich: { name: 'Lich', art: 'human', boss: true, scale: 2, look: { skin: '#e8e0cc', robe: '#3a1a50', shirt: '#3a1a50', shoes: '#2a1040', skull: true, eyes: '#7ff8ff', weapon: 'staff', orb: '#7ff8ff', crown: true }, hp: 6000, dmg: 44, spd: 44, ai: 'boss', moves: ['blink', 'volley:soul', 'ring:soul', 'summon:wraith', 'blink', 'summon:archer'], xp: 2600, coins: [0, 0], t: 6 },
};
for (const k in MON) MON[k].id = k;

// ---------- dungeons: the deeper the tier, the better the loot ----------
const DUNGEONS = [
  { id: 'mossy', name: 'Mossy Hollow', lvl: 1, tier: 1, at: [26, 22], boss: 'slime_king', rooms: 7, mons: [['slime', 3], ['bat', 2]],
    theme: { floor: '#3a4636', floor2: '#43513e', wall: '#28321f', face: '#4a5a3a', top: '#5f7a4a', glow: '#9be04a', dark: 'rgba(5,10,6,0.88)', deco: 'shroom' } },
  { id: 'warrens', name: 'Goblin Warrens', lvl: 3, tier: 2, at: [74, 16], boss: 'goblin_chief', rooms: 8, mons: [['goblin', 5], ['bat', 1], ['slime', 1]],
    theme: { floor: '#4a3a28', floor2: '#55432e', wall: '#2e2216', face: '#5a4430', top: '#7a5a3a', glow: '#ff9a3a', dark: 'rgba(10,6,3,0.9)', deco: 'bones' } },
  { id: 'bonecrypt', name: 'Bonecrypt', lvl: 5, tier: 3, at: [80, 54], boss: 'skel_knight', rooms: 9, mons: [['skeleton', 3], ['archer', 2], ['bat', 1]],
    theme: { floor: '#3e3c44', floor2: '#47454e', wall: '#24222a', face: '#55525e', top: '#6e6a78', glow: '#ffd27a', dark: 'rgba(5,4,8,0.9)', deco: 'bones', traps: true } },
  { id: 'webspire', name: 'Webspire Depths', lvl: 8, tier: 4, at: [16, 56], boss: 'spider_queen', rooms: 10, mons: [['spider', 4], ['skeleton', 1], ['archer', 1]],
    theme: { floor: '#352a40', floor2: '#3d3049', wall: '#1e1626', face: '#4a3a5a', top: '#5e4a72', glow: '#b878ea', dark: 'rgba(6,3,10,0.91)', deco: 'web', traps: true } },
  { id: 'forge', name: 'Ashen Forge', lvl: 11, tier: 5, at: [86, 7], boss: 'magma_golem', rooms: 10, mons: [['imp', 3], ['orc', 2], ['golem', 1]],
    theme: { floor: '#3a2622', floor2: '#442c27', wall: '#1e1210', face: '#5a2e22', top: '#7a3a2a', glow: '#ff7a2a', dark: 'rgba(12,4,2,0.86)', deco: 'ash', lava: true } },
  { id: 'tomb', name: 'Wraithmoor Tomb', lvl: 15, tier: 6, at: [9, 9], boss: 'lich', rooms: 11, mons: [['wraith', 3], ['archer', 1], ['golem', 1], ['skeleton', 1]],
    theme: { floor: '#232c38', floor2: '#2a3442', wall: '#12161e', face: '#2e3a4c', top: '#3e4e66', glow: '#7ff8ff', dark: 'rgba(2,4,8,0.92)', deco: 'bones', traps: true } },
];
const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

const CHEST_LOOT = {
  1: [['potion', 5], ['slime_gel', 3], ['bat_wing', 2], ['ruby', 1], ['wood_shield', 1], ['leather', 1], ['iron_sword', 0.7]],
  2: [['potion', 5], ['goblin_ear', 2], ['emerald', 1.5], ['ruby', 1], ['iron_shield', 0.6], ['hunter_bow', 0.6], ['battle_axe', 0.5]],
  3: [['potion', 3], ['big_potion', 2], ['skull', 2], ['sapphire', 1], ['emerald', 1], ['chainmail', 0.6], ['venom_dagger', 0.4]],
  4: [['big_potion', 4], ['venom_sac', 2], ['gold_bar', 1], ['sapphire', 1.2], ['frost_bow', 0.4], ['kite_shield', 0.5]],
  5: [['big_potion', 3], ['elixir', 1], ['ember_core', 2], ['gold_bar', 1.5], ['ruby', 1.5], ['ember_staff', 0.5], ['shadow_plate', 0.3]],
  6: [['elixir', 3], ['soul_gem', 1.5], ['relic', 1], ['gold_bar', 2], ['soul_scythe', 0.35], ['aegis', 0.2]],
};
const BOSS_LOOT = {
  1: { coins: [90, 130], items: ['slime_crown'], pick: ['iron_sword', 'wood_shield', 'leather'] },
  2: { coins: [200, 280], items: ['goblin_totem'], pick: ['hunter_bow', 'iron_shield', 'venom_dagger'] },
  3: { coins: [380, 500], items: ['knight_crest'], pick: ['chainmail', 'kite_shield', 'venom_dagger'] },
  4: { coins: [650, 850], items: ['queen_fang'], pick: ['frost_bow', 'kite_shield', 'plate'] },
  5: { coins: [1100, 1500], items: ['magma_heart'], pick: ['shadow_plate', 'ember_staff', 'tower_shield'] },
  6: { coins: [2400, 3200], items: ['phylactery', 'dragon_sword'], pick: ['aegis', 'soul_scythe'] },
};

const SHOPS = {
  store: { title: "MARA'S GENERAL STORE", npc: 'Mara', greet: 'Potions and supplies. And I buy anything you drag out of those holes.', items: ['potion', 'big_potion', 'elixir'] },
  smith: { title: "BROM'S FORGE", npc: 'Brom', greet: 'Steel for the brave. Bring coin, leave stronger.', items: ['iron_sword', 'hunter_bow', 'battle_axe', 'steel_longsword', 'ember_staff', 'war_hammer', 'runeblade', 'wood_shield', 'iron_shield', 'kite_shield', 'tower_shield', 'leather', 'chainmail', 'plate', 'dragon_armor'] },
};

const MAX_LVL = 30;
const xpNeed = (L) => Math.floor(25 * Math.pow(L, 1.55));
const maxHpFor = (L) => 100 + (L - 1) * 14;
const dmgMultFor = (L) => 1 + (L - 1) * 0.05;
const INV_SIZE = 24, HOTBAR = 10;
