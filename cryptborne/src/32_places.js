
// =====================================================================
// PLACES — dungeons, overworld regions, shops.
// =====================================================================
const THEMES = {
  mossy: { floor: '#3a4636', floor2: '#43513e', wall: '#28321f', face: '#4a5a3a', top: '#5f7a4a', glow: '#9be04a', dark: 'rgba(5,10,6,0.88)', deco: 'shroom' },
  warrens: { floor: '#4a3a28', floor2: '#55432e', wall: '#2e2216', face: '#5a4430', top: '#7a5a3a', glow: '#ff9a3a', dark: 'rgba(10,6,3,0.9)', deco: 'bones' },
  bonecrypt: { floor: '#3e3c44', floor2: '#47454e', wall: '#24222a', face: '#55525e', top: '#6e6a78', glow: '#ffd27a', dark: 'rgba(5,4,8,0.9)', deco: 'bones', traps: true },
  webspire: { floor: '#352a40', floor2: '#3d3049', wall: '#1e1626', face: '#4a3a5a', top: '#5e4a72', glow: '#b878ea', dark: 'rgba(6,3,10,0.91)', deco: 'web', traps: true },
  forge: { floor: '#3a2622', floor2: '#442c27', wall: '#1e1210', face: '#5a2e22', top: '#7a3a2a', glow: '#ff7a2a', dark: 'rgba(12,4,2,0.86)', deco: 'ash', hazard: 'lava' },
  witchwood: { floor: '#2a3424', floor2: '#303a28', wall: '#161c12', face: '#3a4a2a', top: '#4a5a32', glow: '#9be04a', dark: 'rgba(4,8,3,0.9)', deco: 'shroom', hazard: 'bog' },
  frostfang: { floor: '#3a4a5a', floor2: '#425262', wall: '#1a2430', face: '#5a7088', top: '#8aa8c0', glow: '#9fe8ff', dark: 'rgba(4,8,14,0.86)', deco: 'icicle', hazard: 'ice' },
  sunking: { floor: '#6a5232', floor2: '#74593a', wall: '#3a2a16', face: '#8a6a3a', top: '#b08a4a', glow: '#ffd27a', dark: 'rgba(10,6,2,0.87)', deco: 'bones', traps: true },
  galleon: { floor: '#4a3424', floor2: '#523a28', wall: '#22160c', face: '#5a3a20', top: '#7a5232', glow: '#7ff8ff', dark: 'rgba(2,6,8,0.9)', deco: 'barrel', hazard: 'water', planks: true },
  tomb: { floor: '#232c38', floor2: '#2a3442', wall: '#12161e', face: '#2e3a4c', top: '#3e4e66', glow: '#7ff8ff', dark: 'rgba(2,4,8,0.92)', deco: 'bones', traps: true },
  mirror: { floor: '#2a2436', floor2: '#302a3e', wall: '#120e1a', face: '#4a4060', top: '#6a5a8a', glow: '#d8454a', dark: 'rgba(6,2,8,0.93)', deco: 'shard' },
};
// tier sets loot quality and stat scaling. map + at = where the entrance is.
const DUNGEONS = [
  { id: 'mossy', name: 'Mossy Hollow', lvl: 1, tier: 1, map: 'vale', at: [26, 22], look: 'cave', boss: 'slime_king', mini: 'slime_brute', rooms: 7, mons: [['slime', 3], ['bat', 2]], notes: ['n1', 'n2'], act: 1 },
  { id: 'warrens', name: 'Goblin Warrens', lvl: 3, tier: 2, map: 'vale', at: [74, 16], look: 'cave', boss: 'goblin_chief', mini: 'goblin_brute', rooms: 8, mons: [['goblin', 5], ['bat', 1], ['slime', 1]], notes: ['n3', 'n4'], act: 1 },
  { id: 'bonecrypt', name: 'Bonecrypt', lvl: 5, tier: 3, map: 'vale', at: [80, 54], look: 'cave', boss: 'skel_knight', mini: 'bone_warden', rooms: 9, mons: [['skeleton', 3], ['archer', 2], ['bat', 1]], notes: ['n5', 'n6'], act: 1 },
  { id: 'webspire', name: 'Webspire Depths', lvl: 8, tier: 4, map: 'vale', at: [16, 56], look: 'cave', boss: 'spider_queen', mini: 'broodmother', rooms: 9, mons: [['spider', 4], ['skeleton', 1], ['archer', 1]], notes: ['n7', 'n8'], act: 1 },
  { id: 'forge', name: 'Ashen Forge', lvl: 11, tier: 5, map: 'vale', at: [86, 7], look: 'cave', boss: 'magma_golem', mini: 'orc_warlord', rooms: 10, mons: [['imp', 3], ['orc', 2], ['golem', 1]], notes: ['n9', 'n10'], act: 1 },
  { id: 'witchwood', name: 'Witchwood Hollow', lvl: 13, tier: 6, map: 'mirefen', at: [12, 30], look: 'witchtree', boss: 'hag_mother', mini: 'mire_brute', rooms: 10, mons: [['frog', 3], ['hag', 2], ['wisp', 2]], notes: ['n12', 'n13'], act: 2, seal: 'swamp' },
  { id: 'frostfang', name: 'Frostfang Caverns', lvl: 16, tier: 7, map: 'frostpeak', at: [40, 8], look: 'icecave', boss: 'frost_wyrm', mini: 'frost_troll', rooms: 10, mons: [['frost_wolf', 2], ['ice_elemental', 2], ['yeti', 1]], notes: ['n15', 'n16'], act: 2, seal: 'frost' },
  { id: 'sunking', name: 'Tomb of the Sun King', lvl: 19, tier: 8, map: 'sunscar', at: [40, 50], look: 'pyramid', boss: 'sun_king', mini: 'tomb_guardian', rooms: 11, mons: [['scorpion', 2], ['mummy', 3], ['sand_wraith', 1], ['skeleton', 1]], notes: ['n18', 'n19'], act: 2, seal: 'sun' },
  { id: 'galleon', name: 'The Sunken Galleon', lvl: 22, tier: 9, map: 'saltmarrow', at: [62, 50], look: 'wreck', boss: 'blackbones', mini: 'first_mate', rooms: 11, mons: [['crab', 2], ['pirate', 3], ['gunner', 2], ['drowned', 1]], notes: ['n21', 'n22'], act: 2, seal: 'sea' },
  { id: 'tomb', name: 'Wraithmoor Tomb', lvl: 25, tier: 10, map: 'vale', at: [9, 9], look: 'crypt', boss: 'lich', mini: 'grave_warden', rooms: 12, mons: [['wraith', 3], ['archer', 1], ['golem', 1], ['skeleton', 1]], notes: ['n23', 'n24'], act: 3, final: true },
  { id: 'mirror', name: 'Mirror Crypt', lvl: 25, tier: 10, map: 'vale', at: [8, 44], look: 'mirror', boss: 'shadow_you', mini: null, rooms: 6, mons: [['shade', 1]], notes: [], secret: true },
];
for (const d of DUNGEONS) d.theme = THEMES[d.id];
const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));
const SEAL_NAMES = { swamp: 'Seal of the Mire', frost: 'Seal of the Peaks', sun: 'Seal of the Sun', sea: 'Seal of the Tide' };

const CHEST_LOOT = {
  1: [['potion', 5], ['slime_gel', 3], ['bat_wing', 2], ['ruby', 1], ['wood_shield', 1], ['leather', 1], ['iron_sword', 0.7]],
  2: [['potion', 5], ['goblin_ear', 2], ['emerald', 1.5], ['ruby', 1], ['iron_shield', 0.6], ['hunter_bow', 0.6], ['battle_axe', 0.5], ['oak_wand', 0.5]],
  3: [['potion', 3], ['big_potion', 2], ['skull', 2], ['sapphire', 1], ['emerald', 1], ['chainmail', 0.6], ['venom_dagger', 0.4]],
  4: [['big_potion', 4], ['venom_sac', 2], ['gold_bar', 1], ['sapphire', 1.2], ['frost_bow', 0.4], ['kite_shield', 0.5]],
  5: [['big_potion', 3], ['elixir', 1], ['ember_core', 2], ['gold_bar', 1.5], ['ruby', 1.5], ['ember_staff', 0.5], ['shadow_plate', 0.3]],
  6: [['big_potion', 3], ['super_potion', 1], ['frog_leg', 2], ['emerald', 1.5], ['gold_bar', 1], ['bog_cleaver', 0.5], ['soul_scythe', 0.2]],
  7: [['super_potion', 3], ['ice_crystal', 2], ['onyx', 1], ['sapphire', 1.5], ['gold_bar', 1.5], ['glacier_bow', 0.4], ['aegis', 0.1]],
  8: [['super_potion', 3], ['elixir', 1], ['topaz', 1.5], ['mummy_wrap', 2], ['gold_bar', 2], ['sunfire_staff', 0.4], ['relic', 0.5]],
  9: [['super_potion', 3], ['elixir', 1.5], ['pearl', 1.5], ['doubloon', 3], ['gold_bar', 2], ['captain_cutlass', 0.3], ['relic', 0.7]],
  10: [['elixir', 3], ['soul_gem', 1.5], ['relic', 1], ['gold_bar', 2], ['onyx', 1], ['soul_scythe', 0.35], ['aegis', 0.2]],
};
const BOSS_LOOT = {
  1: { coins: [90, 130], items: ['slime_crown'], pick: ['iron_sword', 'wood_shield', 'leather', 'oak_wand'] },
  2: { coins: [200, 280], items: ['goblin_totem'], pick: ['hunter_bow', 'iron_shield', 'venom_dagger', 'oak_wand'] },
  3: { coins: [380, 500], items: ['knight_crest'], pick: ['chainmail', 'kite_shield', 'venom_dagger'] },
  4: { coins: [650, 850], items: ['queen_fang'], pick: ['frost_bow', 'kite_shield', 'plate'] },
  5: { coins: [1100, 1500], items: ['magma_heart'], pick: ['shadow_plate', 'ember_staff', 'tower_shield'] },
  6: { coins: [1600, 2100], items: ['hag_heart', 'emerald'], pick: ['bog_cleaver', 'witch_robes', 'soul_scythe'] },
  7: { coins: [2200, 2900], items: ['wyrm_scale', 'onyx'], pick: ['glacier_bow', 'frost_ward', 'hunter_furs'] },
  8: { coins: [3000, 3800], items: ['sun_crown', 'topaz'], pick: ['sunfire_staff', 'sun_shield', 'desert_wraps'] },
  9: { coins: [3800, 4800], items: ['captain_hook', 'pearl'], pick: ['captain_cutlass', 'anchor_shield', 'captain_coat'] },
  10: { coins: [6000, 8000], items: ['phylactery', 'dragon_sword'], pick: ['aegis', 'dragon_armor'] },
  mirror: { coins: [8000, 10000], items: ['shadow_blade', 'soul_gem'], pick: ['dragon_armor', 'aegis'] },
};

// overworld regions; gates connect them (tiles on the map edge)
const REGIONS = {
  vale: { name: 'Emberfall Vale', biome: 'vale', w: 96, h: 72, music: 'wild', weather: [['clear', 6], ['rain', 2], ['fog', 1], ['storm', 1]],
    zones: [{ x0: 14, y0: 14, x1: 36, y1: 30, types: [['slime', 1]], max: 6 }, { x0: 62, y0: 26, x1: 86, y1: 46, types: [['slime', 2], ['wolf', 1]], max: 6 }, { x0: 18, y0: 46, x1: 44, y1: 64, types: [['wolf', 2], ['slime', 1]], max: 5 }, { x0: 58, y0: 6, x1: 82, y1: 14, types: [['wolf', 1]], max: 3 }],
    night: [['ghoul', 2], ['dire_wolf', 1]] },
  mirefen: { name: 'Mirefen', biome: 'swamp', w: 80, h: 60, music: 'swamp', lvl: 13, weather: [['fog', 4], ['rain', 2], ['clear', 1]],
    zones: [{ x0: 8, y0: 8, x1: 40, y1: 28, types: [['frog', 2], ['hag', 1]], max: 6 }, { x0: 8, y0: 34, x1: 46, y1: 54, types: [['frog', 1], ['wisp', 1]], max: 6 }],
    night: [['drowner', 2], ['wisp', 2]] },
  frostpeak: { name: 'Frostpeak', biome: 'frost', w: 80, h: 60, music: 'frost', lvl: 16, weather: [['snow', 4], ['blizzard', 2], ['clear', 1]],
    zones: [{ x0: 6, y0: 14, x1: 36, y1: 40, types: [['frost_wolf', 2], ['ice_elemental', 1]], max: 6 }, { x0: 44, y0: 14, x1: 74, y1: 40, types: [['yeti', 1], ['frost_wolf', 1]], max: 5 }],
    night: [['ice_wraith', 2], ['frost_wolf', 1]] },
  sunscar: { name: 'Sunscar Desert', biome: 'desert', w: 80, h: 60, music: 'desert', lvl: 19, weather: [['clear', 5], ['sandstorm', 2]],
    zones: [{ x0: 6, y0: 16, x1: 34, y1: 44, types: [['scorpion', 2], ['sand_wraith', 1]], max: 6 }, { x0: 46, y0: 16, x1: 74, y1: 44, types: [['scorpion', 1], ['mummy', 1]], max: 6 }],
    night: [['mummy', 2], ['sand_wraith', 1]] },
  saltmarrow: { name: 'Saltmarrow Coast', biome: 'coast', w: 80, h: 60, music: 'coast', lvl: 22, weather: [['clear', 4], ['rain', 2], ['storm', 1]],
    zones: [{ x0: 8, y0: 6, x1: 40, y1: 24, types: [['pirate', 2], ['gunner', 1]], max: 6 }, { x0: 30, y0: 36, x1: 58, y1: 56, types: [['crab', 2], ['pirate', 1]], max: 6 }],
    night: [['drowned', 2], ['crab', 1]] },
  home: { name: 'Your House', biome: 'home', w: 14, h: 10, music: 'town', interior: true },
};

const SHOPS = {
  store: { title: "MARA'S GENERAL STORE", npc: 'Mara', greet: 'Potions and supplies. And I buy anything you drag out of those holes.', items: ['potion', 'big_potion', 'super_potion', 'elixir'] },
  smith: { title: "BROM'S FORGE", npc: 'Brom', greet: 'Steel for the brave. I can upgrade your gear and set gems in it too.', smith: true,
    items: ['iron_sword', 'hunter_bow', 'battle_axe', 'oak_wand', 'steel_longsword', 'ember_staff', 'war_hammer', 'runeblade', 'wood_shield', 'iron_shield', 'kite_shield', 'tower_shield', 'leather', 'chainmail', 'plate', 'dragon_armor'] },
  pets: { title: "HOLLIS'S PET SHOP", npc: 'Hollis', greet: 'Every hunter needs a friend. Pick one, they grow stronger with you.', pets: true, items: [] },
  morra: { title: "OLD MORRA'S HUT", npc: 'Old Morra', greet: "Brews, staffs, and robes. Don't touch the jars.", items: ['big_potion', 'super_potion', 'hexwood_staff', 'bog_buckler', 'witch_robes'] },
  sigrid: { title: "SIGRID'S CAMP", npc: 'Sigrid', greet: 'Up here the cold kills more than the monsters. Gear up.', items: ['super_potion', 'elixir', 'frost_axe', 'frost_ward', 'hunter_furs'] },
  rashid: { title: "RASHID'S CARAVAN", npc: 'Rashid', greet: 'Water is free. Everything else has a price, friend.', items: ['super_potion', 'elixir', 'sun_scimitar', 'sun_shield', 'desert_wraps'] },
  vey: { title: "CAPTAIN VEY'S STALL", npc: 'Captain Vey', greet: 'Steel from three oceans. Pay in gold, not stories.', items: ['super_potion', 'elixir', 'coral_trident', 'anchor_shield', 'captain_coat'] },
};
