
// =====================================================================
// ITEMS — gear, potions, loot, gems, trophies. Gear in the bag carries an
// upgrade level (+0..+10) and gem sockets.
// =====================================================================
const RCOL = { common: '#cdc4b4', uncommon: '#6fd46a', rare: '#55a8ef', epic: '#b878ea', legendary: '#f5b83c' };
const STEEL = { b: '#c9ced6', h: '#ffffff', g: '#8a8f99', p: '#6b4423', m: '#8a8f99' };
const WPN = (o) => Object.assign({ type: 'weapon', rarity: 'common' }, o);
const ITEMS = {
  map: { name: 'World Map', type: 'map', icon: 'map', pal: { p: '#e8d5a3', g: '#5cc46e', b: '#4ea1e3', x: '#d8454a' }, rarity: 'common', desc: 'Shows every land and dungeon. Click it, the tiny map, or press M.' },
  // ---- starter weapons (one per class)
  wood_sword: WPN({ name: 'Wooden Sword', wc: 'melee', icon: 'sword', pal: { b: '#b9844a', h: '#e0b27a', g: '#6b4423', p: '#4a2e14', m: '#6b4423' }, dmg: 6, cd: 0.38, range: 24, arc: 110, lvl: 1, price: 10, desc: 'A training sword. Splinters included.' }),
  short_bow: WPN({ name: 'Short Bow', wc: 'bow', icon: 'bow', pal: { b: '#a87a4a', g: '#6b4423', s: '#efe4cc' }, dmg: 7, cd: 0.5, speed: 220, lvl: 1, price: 25, desc: 'A simple bow. Hold the button to keep shooting.' }),
  apprentice_staff: WPN({ name: 'Apprentice Staff', wc: 'wand', icon: 'staff', pal: { g: '#8a8f99', o: '#55a8ef', h: '#c8e8ff', p: '#6b4423' }, dmg: 8, cd: 0.45, speed: 210, lvl: 1, price: 25, desc: 'Shoots magic bolts.' }),
  rusty_dagger: WPN({ name: 'Rusty Dagger', wc: 'melee', icon: 'dagger', pal: { b: '#a87a5a', h: '#d8b08a', g: '#5a3a20', p: '#3a2414', m: '#5a3a20' }, dmg: 4, cd: 0.22, range: 19, arc: 90, lvl: 1, price: 15, desc: 'Fast little stabs. Rogues love it.' }),
  // ---- Vale weapons
  iron_sword: WPN({ name: 'Iron Sword', wc: 'melee', icon: 'sword', pal: STEEL, dmg: 11, cd: 0.36, range: 25, arc: 110, lvl: 2, price: 60, desc: 'Reliable, sharp, and cheap.' }),
  hunter_bow: WPN({ name: "Hunter's Bow", wc: 'bow', icon: 'bow', pal: { b: '#8a5a2b', g: '#5a3418', s: '#efe4cc' }, dmg: 12, cd: 0.46, speed: 240, lvl: 3, price: 110, rarity: 'uncommon', desc: 'A proper hunting bow.' }),
  battle_axe: WPN({ name: 'Battle Axe', wc: 'melee', icon: 'axe', pal: { b: '#aab2bd', h: '#e6ebf0', p: '#6b4423' }, dmg: 19, cd: 0.6, range: 25, arc: 150, lvl: 4, price: 180, rarity: 'uncommon', desc: 'Wide, heavy swings.' }),
  oak_wand: WPN({ name: 'Oakheart Wand', wc: 'wand', icon: 'staff', pal: { g: '#5a8a3a', o: '#9be04a', h: '#e0ffc0', p: '#5a3418' }, dmg: 15, cd: 0.4, speed: 230, lvl: 4, price: 170, rarity: 'uncommon', desc: 'Faster, stronger magic bolts.' }),
  venom_dagger: WPN({ name: 'Venomfang Dagger', wc: 'melee', icon: 'dagger', pal: { b: '#7be06a', h: '#d6ffc8', g: '#3d2a4a', p: '#2a1a30', m: '#7a5a8a' }, dmg: 14, cd: 0.22, range: 21, arc: 90, poison: true, lvl: 5, value: 380, rarity: 'rare', desc: 'Lightning fast. Poisons what it cuts. Chest loot only.' }),
  steel_longsword: WPN({ name: 'Steel Longsword', wc: 'melee', icon: 'sword', pal: { b: '#dfe6ee', h: '#ffffff', g: '#f2c13a', p: '#3a2616', m: '#f2c13a' }, dmg: 22, cd: 0.36, range: 29, arc: 120, lvl: 6, price: 320, rarity: 'uncommon', desc: 'Longer reach, cleaner cuts.' }),
  ember_staff: WPN({ name: 'Ember Staff', wc: 'staff', icon: 'staff', pal: { g: '#f2c13a', o: '#ff7a2a', h: '#ffe08a', p: '#5a3418' }, dmg: 24, cd: 0.55, speed: 190, aoe: 24, lvl: 8, price: 520, rarity: 'rare', desc: 'Fireballs that explode on impact.' }),
  frost_bow: WPN({ name: 'Frostbite Bow', wc: 'bow', icon: 'bow', pal: { b: '#7fd8ff', g: '#2a6fa0', s: '#ffffff' }, dmg: 22, cd: 0.4, speed: 290, slow: true, pierce: 1, lvl: 9, value: 900, rarity: 'rare', desc: 'Arrows freeze and slow enemies. Chest loot only.' }),
  war_hammer: WPN({ name: 'War Hammer', wc: 'melee', icon: 'hammer', pal: { b: '#8a8f99', h: '#d7dde6', p: '#5a3418', m: '#f2c13a' }, dmg: 42, cd: 0.8, range: 27, arc: 160, kb: 2.2, lvl: 10, price: 760, rarity: 'rare', desc: 'Slow. Smashes enemies across the room.' }),
  runeblade: WPN({ name: 'Runeblade', wc: 'melee', icon: 'sword', pal: { b: '#5ff0ff', h: '#e0ffff', g: '#b878ea', p: '#2a1a40', m: '#b878ea' }, dmg: 40, cd: 0.32, range: 31, arc: 120, lvl: 12, price: 1200, rarity: 'epic', desc: 'Glowing runes. Fast and deadly.' }),
  soul_scythe: WPN({ name: 'Soulreaver Scythe', wc: 'melee', icon: 'scythe', pal: { b: '#b878ea', h: '#f0d8ff', p: '#2a1a30' }, dmg: 55, cd: 0.5, range: 35, arc: 220, lifesteal: 0.08, lvl: 14, value: 2600, rarity: 'epic', desc: 'Huge sweeping cuts. Heals you on every hit. Chest loot only.' }),
  // ---- region weapons
  hexwood_staff: WPN({ name: 'Hexwood Staff', wc: 'wand', icon: 'staff', pal: { g: '#3a5a2a', o: '#9be04a', h: '#e8ffc0', p: '#2a1a10' }, dmg: 30, cd: 0.42, speed: 220, poison: true, lvl: 13, price: 1500, rarity: 'rare', desc: 'Bolts that poison. Sold by Old Morra.' }),
  bog_cleaver: WPN({ name: 'Bog Cleaver', wc: 'melee', icon: 'axe', pal: { b: '#6a7a5a', h: '#9aaa8a', p: '#3a2a1a' }, dmg: 48, cd: 0.62, range: 27, arc: 150, poison: true, lvl: 13, value: 2200, rarity: 'rare', desc: 'Rusty, heavy, and it poisons. Swamp loot.' }),
  frost_axe: WPN({ name: 'Frostbite Axe', wc: 'melee', icon: 'axe', pal: { b: '#9fe8ff', h: '#ffffff', p: '#2a4a6a' }, dmg: 58, cd: 0.6, range: 27, arc: 150, slow: true, lvl: 16, price: 2600, rarity: 'rare', desc: 'Chills whatever it hits. Sold by Sigrid.' }),
  glacier_bow: WPN({ name: 'Glacier Bow', wc: 'bow', icon: 'bow', pal: { b: '#c8eeff', g: '#5a8ab0', s: '#ffffff' }, dmg: 44, cd: 0.38, speed: 320, slow: true, pierce: 2, lvl: 17, value: 3400, rarity: 'epic', desc: 'Arrows pierce through three enemies and freeze them. Frost loot.' }),
  sun_scimitar: WPN({ name: 'Sun Scimitar', wc: 'melee', icon: 'sword', pal: { b: '#ffe08a', h: '#ffffff', g: '#a3322c', p: '#5a3418', m: '#f2c13a' }, dmg: 60, cd: 0.3, range: 29, arc: 130, burn: true, lvl: 19, price: 3600, rarity: 'rare', desc: 'Sets enemies on fire. Sold by Rashid.' }),
  sunfire_staff: WPN({ name: 'Sunfire Staff', wc: 'staff', icon: 'staff', pal: { g: '#f2c13a', o: '#fff3b0', h: '#ffffff', p: '#a36a10' }, dmg: 66, cd: 0.55, speed: 200, aoe: 32, burn: true, lvl: 20, value: 4200, rarity: 'epic', desc: 'Huge burning explosions. Desert loot.' }),
  coral_trident: WPN({ name: 'Coral Trident', wc: 'melee', icon: 'trident', pal: { b: '#ff8a7a', p: '#3a6a8a' }, dmg: 72, cd: 0.42, range: 40, arc: 70, lvl: 22, price: 5200, rarity: 'rare', desc: 'Very long reach. Sold by Captain Vey.' }),
  captain_cutlass: WPN({ name: "Blackbones' Cutlass", wc: 'melee', icon: 'sword', pal: { b: '#d7dde6', h: '#ffffff', g: '#f2c13a', p: '#1a1a1a', m: '#f2c13a' }, dmg: 70, cd: 0.25, range: 28, arc: 120, lifesteal: 0.04, lvl: 22, value: 6000, rarity: 'epic', desc: 'Fast and greedy. Taken from a dead captain.' }),
  dragon_sword: WPN({ name: 'Dragonbone Greatsword', wc: 'melee', icon: 'sword', pal: { b: '#efe4cc', h: '#ffffff', g: '#a3322c', p: '#2a1010', m: '#f2b53a' }, dmg: 100, cd: 0.6, range: 36, arc: 170, kb: 1.6, lvl: 25, value: 9000, rarity: 'legendary', desc: 'Carved from a dragon. Only the Lich carries one.' }),
  shadow_blade: WPN({ name: 'Mirror Edge', wc: 'melee', icon: 'sword', pal: { b: '#3a2a50', h: '#b878ea', g: '#d8454a', p: '#07050a', m: '#d8454a' }, dmg: 110, cd: 0.3, range: 32, arc: 130, lifesteal: 0.06, lvl: 25, value: 12000, rarity: 'legendary', desc: 'Your own shadow, made sharp.' }),
  // ---- shields (block = share of a hit that's stopped)
  wood_shield: { name: 'Wooden Shield', type: 'shield', icon: 'shield', pal: { r: '#5a3418', f: '#8a5a2b', e: '#b07a3e' }, block: 0.5, lvl: 1, price: 40, rarity: 'common', desc: 'Hold F to block.' },
  iron_shield: { name: 'Iron Shield', type: 'shield', icon: 'shield', pal: { r: '#5d6470', f: '#aab2bd', e: '#e6ebf0' }, block: 0.65, lvl: 4, price: 150, rarity: 'common', desc: 'Solid iron.' },
  kite_shield: { name: "Knight's Kite Shield", type: 'shield', icon: 'kite', pal: { r: '#8a8f99', f: '#3e6cb8', e: '#f2c13a' }, block: 0.75, lvl: 8, price: 420, rarity: 'uncommon', desc: 'A proper knight shield.' },
  tower_shield: { name: 'Tower Shield', type: 'shield', icon: 'kite', pal: { r: '#5d6470', f: '#7a1a1e', e: '#efe4cc' }, block: 0.82, lvl: 11, price: 900, rarity: 'rare', desc: 'A wall you carry around.' },
  bog_buckler: { name: 'Bog Buckler', type: 'shield', icon: 'shield', pal: { r: '#3a2a1a', f: '#5a6a3a', e: '#9be04a' }, block: 0.84, lvl: 13, price: 1300, rarity: 'rare', desc: 'Sold by Old Morra.' },
  frost_ward: { name: 'Frost Ward', type: 'shield', icon: 'kite', pal: { r: '#5a8ab0', f: '#c8eeff', e: '#ffffff' }, block: 0.87, lvl: 16, price: 2200, rarity: 'rare', desc: 'Sold by Sigrid.' },
  sun_shield: { name: 'Sunburst Shield', type: 'shield', icon: 'shield', pal: { r: '#a36a10', f: '#f2c13a', e: '#ffffff' }, block: 0.89, lvl: 19, price: 3200, rarity: 'rare', desc: 'Sold by Rashid.' },
  anchor_shield: { name: 'Anchor Shield', type: 'shield', icon: 'kite', pal: { r: '#3a3a40', f: '#3a6a8a', e: '#c9ced6' }, block: 0.91, lvl: 22, price: 4600, rarity: 'epic', desc: 'Sold by Captain Vey.' },
  aegis: { name: 'Aegis of Dawn', type: 'shield', icon: 'kite', pal: { r: '#f2c13a', f: '#fff3d2', e: '#ff9a3a' }, block: 0.94, parry: 0.32, lvl: 15, value: 5200, rarity: 'legendary', desc: 'Nearly unbreakable. Bigger parry window.' },
  // ---- armor (def lowers damage taken)
  leather: { name: 'Leather Tunic', type: 'armor', icon: 'armor', pal: { a: '#8a5a2b', t: '#b07a3e' }, def: 5, lvl: 1, price: 50, rarity: 'common', color: '#8a5a2b', trim: '#b07a3e', desc: 'Basic protection.' },
  chainmail: { name: 'Chainmail', type: 'armor', icon: 'armor', pal: { a: '#8d96a3', t: '#c9ced6' }, def: 12, lvl: 5, price: 240, rarity: 'uncommon', color: '#8d96a3', trim: '#c9ced6', desc: 'Rings of steel.' },
  plate: { name: 'Plate Armor', type: 'armor', icon: 'armor', pal: { a: '#c9d1d9', t: '#ffffff' }, def: 22, lvl: 9, price: 600, rarity: 'rare', color: '#c9d1d9', trim: '#ffffff', desc: 'Heavy and shiny.' },
  witch_robes: { name: 'Witchweave Robes', type: 'armor', icon: 'armor', pal: { a: '#3a2a4a', t: '#9be04a' }, def: 28, lvl: 13, price: 1400, rarity: 'rare', color: '#3a2a4a', trim: '#9be04a', regen: 1, desc: 'Slowly heals you. Sold by Old Morra.' },
  shadow_plate: { name: 'Shadow Plate', type: 'armor', icon: 'armor', pal: { a: '#3c2f55', t: '#b878ea' }, def: 34, lvl: 14, value: 2400, rarity: 'epic', color: '#3c2f55', trim: '#b878ea', desc: 'Forged in darkness. Chest loot only.' },
  hunter_furs: { name: 'Hunter Furs', type: 'armor', icon: 'armor', pal: { a: '#c8b8a0', t: '#efe4cc' }, def: 36, lvl: 16, price: 2400, rarity: 'rare', color: '#a8988a', trim: '#efe4cc', desc: 'Warm and tough. Sold by Sigrid.' },
  desert_wraps: { name: 'Sandstrider Wraps', type: 'armor', icon: 'armor', pal: { a: '#d8b468', t: '#a3322c' }, def: 42, lvl: 19, price: 3400, rarity: 'rare', color: '#c8a458', trim: '#a3322c', speed: 0.06, desc: 'Light, so you move faster. Sold by Rashid.' },
  captain_coat: { name: "Captain's Coat", type: 'armor', icon: 'armor', pal: { a: '#7a1a1e', t: '#f2c13a' }, def: 50, lvl: 22, price: 5000, rarity: 'epic', color: '#7a1a1e', trim: '#f2c13a', desc: 'Sold by Captain Vey.' },
  dragon_armor: { name: 'Dragonscale Armor', type: 'armor', icon: 'armor', pal: { a: '#a3322c', t: '#f2b53a' }, def: 60, lvl: 24, price: 8000, rarity: 'legendary', color: '#a3322c', trim: '#f2b53a', desc: 'The best armor money can buy.' },
  // ---- potions
  potion: { name: 'Health Potion', type: 'potion', icon: 'potion', pal: { c: '#8a5a2b', w: '#ffd6d6', l: '#d8454a', h: '#ff9a9a', d: '#8a1a22' }, heal: 45, lvl: 1, price: 15, rarity: 'common', desc: 'Heals 45 HP. Press Q to drink fast.' },
  big_potion: { name: 'Greater Health Potion', type: 'potion', icon: 'potion', pal: { c: '#f2c13a', w: '#ffd6f0', l: '#e0407a', h: '#ff9ad0', d: '#8a1a4a' }, heal: 130, lvl: 6, price: 45, rarity: 'uncommon', desc: 'Heals 130 HP.' },
  super_potion: { name: 'Superior Health Potion', type: 'potion', icon: 'potion', pal: { c: '#55a8ef', w: '#d6e8ff', l: '#b0306a', h: '#ff8ac0', d: '#5a1030' }, heal: 300, lvl: 15, price: 110, rarity: 'rare', desc: 'Heals 300 HP.' },
  elixir: { name: 'Elixir of Life', type: 'potion', icon: 'potion', pal: { c: '#f2c13a', w: '#fff3d2', l: '#f2b53a', h: '#fff3b0', d: '#a36a10' }, heal: 99999, stam: true, lvl: 10, price: 160, rarity: 'rare', desc: 'Fully heals HP and stamina.' },
  // ---- gems (socket them at Brom's forge, or sell them)
  ruby: { name: 'Ruby', type: 'gem', icon: 'gem', pal: { l: '#e0404a', h: '#ffc0c0', d: '#7a1a22' }, sell: 60, rarity: 'uncommon', desc: 'Weapon: burns enemies. Armor: +10% max health.' },
  emerald: { name: 'Emerald', type: 'gem', icon: 'gem', pal: { l: '#3ad06a', h: '#c0ffd0', d: '#1a6a3a' }, sell: 70, rarity: 'uncommon', desc: 'Weapon: poisons enemies. Armor: heals 1 HP a second.' },
  sapphire: { name: 'Sapphire', type: 'gem', icon: 'gem', pal: { l: '#3a7ae0', h: '#c0d8ff', d: '#1a3a7a' }, sell: 85, rarity: 'rare', desc: 'Weapon: chance to freeze. Armor: +6 defense.' },
  topaz: { name: 'Topaz', type: 'gem', icon: 'gem', pal: { l: '#f2b53a', h: '#fff3b0', d: '#a36a10' }, sell: 90, rarity: 'rare', desc: 'Weapon: +8% critical hits. Armor: +6% move speed.' },
  pearl: { name: 'Pearl', type: 'gem', icon: 'orb', pal: { l: '#efe4f4', h: '#ffffff', d: '#b0a8c8' }, sell: 100, rarity: 'rare', desc: 'Weapon: +12% damage to bosses. Armor: potions heal 20% more.' },
  onyx: { name: 'Onyx', type: 'gem', icon: 'gem', pal: { l: '#3a3440', h: '#8a86a8', d: '#140d1a' }, sell: 110, rarity: 'rare', desc: 'Weapon: +6 damage. Armor: -8% special cooldowns.' },
  soul_gem: { name: 'Soul Gem', type: 'gem', icon: 'gem', pal: { l: '#b878ea', h: '#f0d8ff', d: '#5a2a80' }, sell: 120, rarity: 'epic', desc: 'Weapon: heals you a little on hit. Armor: +5% damage.' },
  // ---- monster drops to sell (and use for upgrades)
  slime_gel: { name: 'Slime Gel', type: 'loot', icon: 'blob', pal: { l: '#5cc46e', h: '#c8ffc0', d: '#2f7a3c' }, sell: 3, rarity: 'common', desc: 'Dropped by Slimes.' },
  bat_wing: { name: 'Bat Wing', type: 'loot', icon: 'wing', pal: { 1: '#4a2f5e' }, sell: 4, rarity: 'common', desc: 'Dropped by Cave Bats.' },
  wolf_pelt: { name: 'Wolf Pelt', type: 'loot', icon: 'pelt', pal: { 1: '#8a8f99', 2: '#5d6470' }, sell: 9, rarity: 'common', desc: 'Dropped by Wolves.' },
  goblin_ear: { name: 'Goblin Ear', type: 'loot', icon: 'fang', pal: { 1: '#5fae4a', 2: '#3d7a32' }, sell: 7, rarity: 'common', desc: 'Dropped by Goblins.' },
  bone: { name: 'Bone', type: 'loot', icon: 'bone', pal: { 1: '#efe4cc', 2: '#c9c0aa' }, sell: 6, rarity: 'common', desc: 'Dropped by Skeletons.' },
  skull: { name: 'Skull', type: 'loot', icon: 'skull', pal: { 1: '#efe4cc', e: '#140d1a' }, sell: 16, rarity: 'uncommon', desc: 'A rare Skeleton drop.' },
  ghoul_claw: { name: 'Ghoul Claw', type: 'loot', icon: 'fang', pal: { 1: '#a8b090', 2: '#6a7258' }, sell: 14, rarity: 'common', desc: 'Dropped by Ghouls that roam at night.' },
  spider_silk: { name: 'Spider Silk', type: 'loot', icon: 'silk', pal: { 1: '#efe4cc', 2: '#b0a8c0' }, sell: 12, rarity: 'common', desc: 'Dropped by Giant Spiders.' },
  venom_sac: { name: 'Venom Sac', type: 'loot', icon: 'blob', pal: { l: '#9be04a', h: '#e8ffc0', d: '#4a7a1a' }, sell: 20, rarity: 'uncommon', desc: 'A rare Giant Spider drop.' },
  orc_tusk: { name: 'Orc Tusk', type: 'loot', icon: 'fang', pal: { 1: '#f4ecd8', 2: '#c9b48a' }, sell: 24, rarity: 'common', desc: 'Dropped by Orc Brutes.' },
  ember_core: { name: 'Ember Core', type: 'loot', icon: 'orb', pal: { l: '#ff7a2a', h: '#ffe08a', d: '#a3242a' }, sell: 30, rarity: 'uncommon', desc: 'Dropped by Fire Imps.' },
  golem_core: { name: 'Golem Core', type: 'loot', icon: 'orb', pal: { l: '#5ff0ff', h: '#e0ffff', d: '#2a6f80' }, sell: 46, rarity: 'uncommon', desc: 'Dropped by Stone Golems.' },
  ectoplasm: { name: 'Ectoplasm', type: 'loot', icon: 'blob', pal: { l: '#7ff8ff', h: '#e0ffff', d: '#3a8aa0' }, sell: 36, rarity: 'uncommon', desc: 'Dropped by Wraiths.' },
  frog_leg: { name: 'Frog Leg', type: 'loot', icon: 'leg', pal: { 1: '#6a9a3a', 2: '#4a7a2a' }, sell: 18, rarity: 'common', desc: 'Dropped by Bog Frogs.' },
  hag_hair: { name: 'Hag Hair', type: 'loot', icon: 'silk', pal: { 1: '#8a8a7a', 2: '#5a5a4a' }, sell: 28, rarity: 'common', desc: 'Dropped by Swamp Hags.' },
  wisp_essence: { name: 'Wisp Essence', type: 'loot', icon: 'orb', pal: { l: '#9be0ff', h: '#ffffff', d: '#3a8aa0' }, sell: 40, rarity: 'uncommon', desc: 'Dropped by Will-o-Wisps.' },
  drowned_rag: { name: 'Drowned Rag', type: 'loot', icon: 'silk', pal: { 1: '#5a7a6a', 2: '#3a5a4a' }, sell: 22, rarity: 'common', desc: 'Dropped by Drowners.' },
  yeti_fur: { name: 'Yeti Fur', type: 'loot', icon: 'pelt', pal: { 1: '#efe4f4', 2: '#b8b0c8' }, sell: 34, rarity: 'common', desc: 'Dropped by Yetis.' },
  ice_crystal: { name: 'Ice Crystal', type: 'loot', icon: 'gem', pal: { l: '#c8eeff', h: '#ffffff', d: '#5a8ab0' }, sell: 44, rarity: 'uncommon', desc: 'Dropped by Ice Elementals.' },
  frost_fang: { name: 'Frost Fang', type: 'loot', icon: 'fang', pal: { 1: '#e0f4ff', 2: '#8ab0c8' }, sell: 30, rarity: 'common', desc: 'Dropped by Frost Wolves.' },
  scorpion_tail: { name: 'Scorpion Tail', type: 'loot', icon: 'fang', pal: { 1: '#c88a3a', 2: '#7a4a1a' }, sell: 38, rarity: 'common', desc: 'Dropped by Scorpions.' },
  mummy_wrap: { name: 'Mummy Wrap', type: 'loot', icon: 'silk', pal: { 1: '#e0d0a8', 2: '#a89870' }, sell: 36, rarity: 'common', desc: 'Dropped by Mummies.' },
  sand_essence: { name: 'Sand Essence', type: 'loot', icon: 'orb', pal: { l: '#f2d08a', h: '#fff3d2', d: '#a3803a' }, sell: 52, rarity: 'uncommon', desc: 'Dropped by Sand Wraiths.' },
  crab_shell: { name: 'Crab Shell', type: 'loot', icon: 'shell', pal: { 1: '#d8604a', 2: '#ff9a7a' }, sell: 42, rarity: 'common', desc: 'Dropped by Giant Crabs.' },
  doubloon: { name: 'Gold Doubloon', type: 'loot', icon: 'orb', pal: { l: '#f2c13a', h: '#fff3b0', d: '#a36a10' }, sell: 60, rarity: 'uncommon', desc: 'Pirates carry these.' },
  gold_bar: { name: 'Gold Bar', type: 'loot', icon: 'bar', pal: { l: '#f2c13a', h: '#fff3b0', d: '#a36a10' }, sell: 120, rarity: 'rare', desc: 'Heavy. Worth a lot.' },
  relic: { name: 'Ancient Relic', type: 'loot', icon: 'orb', pal: { l: '#3ad0b0', h: '#f2c13a', d: '#1a6a5a' }, sell: 250, rarity: 'epic', desc: 'From a forgotten age.' },
  // ---- boss trophies
  slime_crown: { name: 'Slime Crown', type: 'loot', icon: 'crown', pal: { g: '#9be04a', r: '#ffffff', d: '#4a7a1a' }, sell: 90, rarity: 'rare', desc: 'Trophy from the Slime King.' },
  goblin_totem: { name: "Goblin Chief's Totem", type: 'loot', icon: 'fang', pal: { 1: '#d8454a', 2: '#7a1a1e' }, sell: 170, rarity: 'rare', desc: 'Trophy from the Goblin Chief.' },
  knight_crest: { name: "Knight's Crest", type: 'loot', icon: 'kite', pal: { r: '#f2c13a', f: '#7a1a1e', e: '#efe4cc' }, sell: 290, rarity: 'epic', desc: 'Trophy from the Skeleton Knight.' },
  queen_fang: { name: "Queen's Fang", type: 'loot', icon: 'fang', pal: { 1: '#b878ea', 2: '#5a2a80' }, sell: 430, rarity: 'epic', desc: 'Trophy from the Spider Queen.' },
  magma_heart: { name: 'Magma Heart', type: 'loot', icon: 'orb', pal: { l: '#ff5a1a', h: '#ffe08a', d: '#7a1010' }, sell: 680, rarity: 'epic', desc: 'Trophy from the Magma Golem.' },
  hag_heart: { name: "Hag Mother's Heart", type: 'loot', icon: 'orb', pal: { l: '#5a8a2a', h: '#c8ff8a', d: '#1a3a0a' }, sell: 900, rarity: 'epic', desc: 'Trophy from the Hag Mother. Still beating.' },
  wyrm_scale: { name: 'Frost Wyrm Scale', type: 'loot', icon: 'scale', pal: { 1: '#9fe8ff', 2: '#ffffff' }, sell: 1200, rarity: 'epic', desc: 'Trophy from the Frost Wyrm.' },
  sun_crown: { name: 'Crown of the Sun King', type: 'loot', icon: 'crown', pal: { g: '#f2c13a', r: '#3a7ae0', d: '#a36a10' }, sell: 1500, rarity: 'epic', desc: 'Trophy from the Sun King.' },
  captain_hook: { name: "Blackbones' Hook", type: 'loot', icon: 'fang', pal: { 1: '#c9ced6', 2: '#5d6470' }, sell: 1800, rarity: 'epic', desc: 'Trophy from Captain Blackbones.' },
  phylactery: { name: "Lich's Phylactery", type: 'loot', icon: 'gem', pal: { l: '#5a2a80', h: '#7ff8ff', d: '#1a0a30' }, sell: 2500, rarity: 'legendary', desc: "Dad's soul was kept in this." },
  // ---- quest items (can't be sold)
  parcel: { name: 'Parcel', type: 'quest', icon: 'bar', pal: { l: '#b08a4a', h: '#d8b878', d: '#6b4423' }, rarity: 'common', desc: 'A package to deliver. Check your journal (J).' },
};
for (const id in ITEMS) ITEMS[id].id = id;
const isGear = (id) => { const t = ITEMS[id] && ITEMS[id].type; return t === 'weapon' || t === 'shield' || t === 'armor'; };
const STACKS = (it) => it.type === 'loot' || it.type === 'potion' || it.type === 'gem';
const SOCKETS = { common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3 };
const sellPrice = (id, up = 0) => {
  const it = ITEMS[id]; if (it.type === 'map' || it.type === 'quest') return 0;
  const base = it.sell != null ? it.sell : Math.max(1, Math.floor((it.price || it.value || 10) * 0.4));
  return Math.floor(base * (1 + up * 0.25));
};
// gear objects: { id, up, gems }
const newGear = (id) => ({ id, up: 0, gems: [] });
const gearLabel = (g) => ITEMS[g.id].name + (g.up ? ' +' + g.up : '');
function gearStats(g) { // base stats after upgrades (gems are added in playerStats)
  const it = ITEMS[g.id], up = g.up || 0;
  return { dmg: it.dmg ? Math.round(it.dmg * (1 + up * 0.08)) : 0, def: it.def ? Math.round(it.def * (1 + up * 0.1)) : 0, block: it.block ? Math.min(0.97, it.block + up * 0.012) : 0 };
}
// upgrades: coins + monster parts; from +6 an upgrade can fail
const UP_FAIL = [0, 0, 0, 0, 0, 0, 0.15, 0.25, 0.35, 0.45, 0.55];
function upgradeCost(g) {
  const it = ITEMS[g.id], next = (g.up || 0) + 1, base = it.price || it.value || 50;
  const tier = next <= 3 ? 'common' : next <= 6 ? 'uncommon' : 'rare';
  return { next, coins: Math.round(base * 0.18 * next + 20 * next), tier, count: next <= 6 ? 3 : 2, fail: UP_FAIL[next] || 0 };
}
const GEM_FX = {
  ruby: { w: 'Burns enemies', a: '+10% max health' }, emerald: { w: 'Poisons enemies', a: 'Heals 1 HP a second' }, sapphire: { w: '25% chance to freeze', a: '+6 defense' },
  topaz: { w: '+8% critical hits', a: '+6% move speed' }, pearl: { w: '+12% damage to bosses', a: 'Potions heal 20% more' }, onyx: { w: '+6 damage', a: '-8% special cooldowns' },
  soul_gem: { w: 'Heals you on hit (3%)', a: '+5% damage' },
};
