
// =====================================================================
// DATA — items, monsters, skills, recipes, hunter looks, difficulty.
// =====================================================================
// item types: sword bow arrow shield armor potion oil food mat herb mutagen trophy key
const I = (o) => Object.assign({ price: 10, stack: 1, desc: '' }, o);
const ITEMS = {
  // swords (dmg per hit; silver hurts werewolves, vampires and the demon's spawn)
  rusty_sword: I({ name: 'Rusty Sword', type: 'sword', dmg: 14, price: 30, col: 0x8a7a6a, desc: 'Your father\'s old blade. It has seen better years.' }),
  steel_sword: I({ name: 'Steel Sword', type: 'sword', dmg: 24, price: 260, lvl: 3, col: 0xb8bcc4, desc: 'Honest steel from Brann\'s forge.' }),
  silver_sword: I({ name: 'Silver Sword', type: 'sword', dmg: 19, silver: true, price: 480, lvl: 4, col: 0xe8ecf4, desc: 'Silver burns cursed flesh. Twice the damage against werewolves, vampires and ghouls.' }),
  knight_sword: I({ name: 'Knight\'s Longsword', type: 'sword', dmg: 34, price: 900, lvl: 7, col: 0xc8ccd4, desc: 'Long, heavy and very sharp.' }),
  vargrave_blade: I({ name: 'Vargrave Blade', type: 'sword', dmg: 44, steal: 0.06, price: 0, value: 1200, lvl: 9, col: 0x8a1018, desc: 'Taken from the lord\'s armoury. It drinks a little of every wound.' }),
  moonsilver: I({ name: 'Moonsilver', type: 'sword', dmg: 40, silver: true, price: 0, value: 1800, lvl: 11, col: 0xd8a0a8, desc: 'Silver forged under a blood moon.' }),
  demonbane: I({ name: 'Demonbane', type: 'sword', dmg: 52, silver: true, demon: true, price: 0, value: 3000, lvl: 12, col: 0xff6030, desc: 'Forged around the Demon\'s Horn. Triple damage to the demon.' }),
  // bows
  hunting_bow: I({ name: 'Hunting Bow', type: 'bow', dmg: 18, draw: 0.85, price: 120, col: 0x8a5a2b, desc: 'Hold right click to draw, let go to shoot.' }),
  yew_longbow: I({ name: 'Yew Longbow', type: 'bow', dmg: 28, draw: 1.05, price: 640, lvl: 5, col: 0x6a3a1a, desc: 'Strong pull, long range.' }),
  bone_bow: I({ name: 'Wyvernbone Bow', type: 'bow', dmg: 38, draw: 0.95, price: 0, value: 1400, lvl: 9, col: 0xe8dcc0, desc: 'Strung with wyvern sinew.' }),
  arrow: I({ name: 'Arrows', type: 'arrow', stack: 99, price: 1, desc: 'Plain arrows.' }),
  silver_arrow: I({ name: 'Silver Arrows', type: 'arrow', stack: 99, price: 6, silver: true, desc: 'Double damage against the cursed.' }),
  fire_arrow: I({ name: 'Fire Arrows', type: 'arrow', stack: 99, price: 5, fire: true, desc: 'Set your target burning.' }),
  // shields and armour
  wood_shield: I({ name: 'Wooden Shield', type: 'shield', block: 0.55, price: 60, col: 0x8a5a2b, desc: 'Hold F to block. Block just before a hit to parry.' }),
  iron_shield: I({ name: 'Iron Shield', type: 'shield', block: 0.7, price: 340, lvl: 4, col: 0x6a6e78 }),
  tower_shield: I({ name: 'Tower Shield', type: 'shield', block: 0.85, price: 820, lvl: 8, col: 0x4a4e58, desc: 'Blocks nearly everything. A bit slow.' }),
  traveler: I({ name: 'Traveller\'s Clothes', type: 'armor', def: 2, warm: 1, price: 20, col: 0x5a4a3a }),
  leather: I({ name: 'Leather Jerkin', type: 'armor', def: 6, warm: 1, price: 140, col: 0x6a4a2a }),
  hunter_coat: I({ name: 'Hunter\'s Coat', type: 'armor', def: 10, warm: 2, price: 380, lvl: 3, col: 0x3a3028 }),
  chainmail: I({ name: 'Chainmail', type: 'armor', def: 16, warm: 0, price: 700, lvl: 5, col: 0x8a8e98 }),
  wolf_coat: I({ name: 'Wolf-fur Coat', type: 'armor', def: 12, warm: 4, price: 0, value: 600, lvl: 4, col: 0x8a8278, desc: 'Keeps the night cold away.' }),
  knight_plate: I({ name: 'Knight\'s Plate', type: 'armor', def: 24, warm: 0, price: 1500, lvl: 8, col: 0xb8bcc4 }),
  blood_plate: I({ name: 'Blood Plate', type: 'armor', def: 32, warm: 3, price: 0, value: 2600, lvl: 11, col: 0x6a0a10, desc: 'Forged from blood moon shards.' }),
  // potions
  draught: I({ name: 'Healing Draught', type: 'potion', heal: 55, stack: 20, price: 30, col: 0xc02020 }),
  greater_draught: I({ name: 'Greater Draught', type: 'potion', heal: 140, stack: 20, price: 110, col: 0xff4040 }),
  stamina_tonic: I({ name: 'Stamina Tonic', type: 'potion', stam: true, stack: 20, price: 25, col: 0x40c040, desc: 'Refills stamina and speeds it up for a minute.' }),
  mana_tonic: I({ name: 'Mana Tonic', type: 'potion', mana: true, stack: 20, price: 40, col: 0x4060e0 }),
  warming_brandy: I({ name: 'Warming Brandy', type: 'potion', warm: true, stack: 20, price: 20, col: 0xd08020, desc: 'Warms you right up and keeps the cold off for a while.' }),
  antidote: I({ name: 'Antidote', type: 'potion', cure: true, stack: 20, price: 25, col: 0x60d080 }),
  owl_eye: I({ name: 'Owl\'s Eye', type: 'potion', owl: true, stack: 20, price: 60, col: 0xe0e080, desc: 'See in the dark for five minutes.' }),
  holy_water: I({ name: 'Holy Water', type: 'potion', holy: true, stack: 20, price: 80, col: 0xc0e0ff, desc: 'Washes away 25 corruption.' }),
  // blade oils
  beast_oil: I({ name: 'Beast Oil', type: 'oil', vs: 'beast', stack: 20, price: 45, col: 0x8a6a3a, desc: '+50% damage against wolves and werewolves for 40 hits.' }),
  cursed_oil: I({ name: 'Cursed Oil', type: 'oil', vs: 'cursed', stack: 20, price: 45, col: 0x6a3a8a, desc: '+50% against ghouls and vampires for 40 hits.' }),
  draconid_oil: I({ name: 'Draconid Oil', type: 'oil', vs: 'draconid', stack: 20, price: 60, col: 0x3a8a6a, desc: '+50% against wyverns for 40 hits.' }),
  ogroid_oil: I({ name: 'Ogroid Oil', type: 'oil', vs: 'ogroid', stack: 20, price: 60, col: 0x6a6a3a, desc: '+50% against trolls for 40 hits.' }),
  drowned_oil: I({ name: 'Drowned Oil', type: 'oil', vs: 'drowned', stack: 20, price: 45, col: 0x2a6a8a, desc: '+50% against drowners for 40 hits.' }),
  // food
  bread: I({ name: 'Bread', type: 'food', food: 25, stack: 20, price: 4 }), apple: I({ name: 'Apple', type: 'food', food: 12, stack: 20, price: 2 }), cheese: I({ name: 'Cheese', type: 'food', food: 20, stack: 20, price: 5 }),
  raw_venison: I({ name: 'Raw Venison', type: 'food', food: 12, raw: true, cook: 'venison_steak', stack: 20, price: 6 }), venison_steak: I({ name: 'Venison Steak', type: 'food', food: 45, heal: 15, stack: 20, price: 14 }),
  raw_rabbit: I({ name: 'Raw Rabbit', type: 'food', food: 7, raw: true, cook: 'roast_rabbit', stack: 20, price: 3 }), roast_rabbit: I({ name: 'Roast Rabbit', type: 'food', food: 26, heal: 8, stack: 20, price: 8 }),
  stew: I({ name: 'Hunter\'s Stew', type: 'food', food: 60, heal: 25, warm: 30, stack: 20, price: 16 }), ale: I({ name: 'Ale', type: 'food', food: 5, warm: 15, stack: 20, price: 3 }),
  // materials
  deer_hide: I({ name: 'Deer Hide', type: 'mat', stack: 50, price: 12 }), rabbit_pelt: I({ name: 'Rabbit Pelt', type: 'mat', stack: 50, price: 4 }), wolf_pelt: I({ name: 'Wolf Pelt', type: 'mat', stack: 50, price: 16 }),
  werewolf_claw: I({ name: 'Werewolf Claw', type: 'mat', stack: 50, price: 45 }), ghoul_marrow: I({ name: 'Ghoul Marrow', type: 'mat', stack: 50, price: 18 }), vampire_fang: I({ name: 'Vampire Fang', type: 'mat', stack: 50, price: 60 }),
  drowner_brain: I({ name: 'Drowner Brain', type: 'mat', stack: 50, price: 15 }), troll_hide: I({ name: 'Troll Hide', type: 'mat', stack: 50, price: 70 }), wyvern_scale: I({ name: 'Wyvern Scale', type: 'mat', stack: 50, price: 55 }),
  iron_ingot: I({ name: 'Iron Ingot', type: 'mat', stack: 50, price: 25 }), silver_ingot: I({ name: 'Silver Ingot', type: 'mat', stack: 50, price: 70 }), blood_shard: I({ name: 'Blood Moon Shard', type: 'mat', stack: 50, price: 150, desc: 'Only found on the blood moon.' }),
  firewood: I({ name: 'Firewood', type: 'mat', stack: 50, price: 2, desc: 'Use it to light a campfire anywhere.' }),
  // herbs
  bloodroot: I({ name: 'Bloodroot', type: 'herb', stack: 50, price: 4 }), silverleaf: I({ name: 'Silverleaf', type: 'herb', stack: 50, price: 5 }), ghostcap: I({ name: 'Ghostcap', type: 'herb', stack: 50, price: 7 }), frostbloom: I({ name: 'Frostbloom', type: 'herb', stack: 50, price: 9 }),
  // mutagens: power from monster blood, at a price
  wolf_mutagen: I({ name: 'Werewolf Mutagen', type: 'mutagen', mut: 'wolf', price: 0, value: 300 }), vampire_mutagen: I({ name: 'Vampire Mutagen', type: 'mutagen', mut: 'vampire', price: 0, value: 300 }),
  troll_mutagen: I({ name: 'Troll Mutagen', type: 'mutagen', mut: 'troll', price: 0, value: 300 }), wyvern_mutagen: I({ name: 'Wyvern Mutagen', type: 'mutagen', mut: 'wyvern', price: 0, value: 300 }),
  drowner_mutagen: I({ name: 'Drowner Mutagen', type: 'mutagen', mut: 'drowner', price: 0, value: 200 }), ghoul_mutagen: I({ name: 'Ghoul Mutagen', type: 'mutagen', mut: 'ghoul', price: 0, value: 200 }),
  // story items
  jonah_locket: I({ name: 'Jonah\'s Locket', type: 'key', desc: 'A miller\'s son\'s locket. Inside: the Vargrave crest.' }),
  edrin_journal: I({ name: 'Father Edrin\'s Journal', type: 'key' }), morwen_charm: I({ name: 'Morwen\'s Charm', type: 'key', desc: 'A bundle of bones and hair. It hums near the demon\'s things.' }),
  iron_key: I({ name: 'Smuggler\'s Iron Key', type: 'key', desc: 'Opens the castle gate.' }), demon_horn: I({ name: 'The Demon\'s Horn', type: 'key', desc: 'Black, warm to the touch. It opens the Hungering Shrine.' }),
  vargrave_letter: I({ name: 'A Sealed Letter', type: 'key' }),
};
for (const k in ITEMS) ITEMS[k].id = k;
const TROPHY = (name, col) => ({ name, col });
const TROPHIES = {
  mill_beast: TROPHY('The Mill Beast', 0x5a4a3a), mire_mother: TROPHY('The Mire Mother', 0x3a5a4a), old_grum: TROPHY('Old Grum', 0x6a6a5a), wyvern_queen: TROPHY('Skarnveil, the Wyvern Queen', 0x3a6a5a),
  vargrave: TROPHY('Lord Vargrave', 0xd8d0c8), azgoreth: TROPHY('Azgoreth', 0x6a1010),
  c_werewolf: TROPHY('A named werewolf', 0x4a3a2a), c_ghoul: TROPHY('A ghoul alpha', 0x6a7a5a), c_vampire: TROPHY('A pale vampire', 0xd8d0d8), c_drowner: TROPHY('A drowner matriarch', 0x3a5a5a), c_troll: TROPHY('A bridge troll', 0x7a7a6a), c_wyvern: TROPHY('A red wyvern', 0x8a2a1a), c_fiend: TROPHY('A blood fiend', 0x8a0a0a),
};
// ---------- monsters ----------
// family decides what oils and silver do; model picks the 3D body
const MON = {
  wolf: { name: 'Wolf', model: 'wolf', family: 'beast', hp: 45, dmg: 8, speed: 7.2, reach: 1.9, xp: 12, coins: [0, 0], drops: [['wolf_pelt', 0.6], ['raw_venison', 0.3]], pack: [2, 4], col: 0x6a6a68, voice: 'snarl', size: 1 },
  werewolf: { name: 'Werewolf', model: 'werewolf', family: 'beast', hp: 260, dmg: 22, speed: 8.6, reach: 2.4, xp: 90, coins: [8, 20], silver: 2, regen: 3, drops: [['werewolf_claw', 0.7], ['wolf_mutagen', 0.12]], col: 0x4a3a2c, voice: 'growl', size: 1.25, night: true },
  ghoul: { name: 'Ghoul', model: 'ghoul', family: 'cursed', hp: 70, dmg: 11, speed: 5.8, reach: 1.9, xp: 22, coins: [1, 5], silver: 1.5, drops: [['ghoul_marrow', 0.6], ['ghoul_mutagen', 0.05]], pack: [3, 6], col: 0x7a8a6a, voice: 'screech', size: 1, night: true },
  vampire: { name: 'Vampire', model: 'vampire', family: 'cursed', hp: 210, dmg: 20, speed: 8.2, reach: 2.1, xp: 85, coins: [20, 45], silver: 2, fire: 1.5, blink: true, drops: [['vampire_fang', 0.6], ['vampire_mutagen', 0.1]], col: 0xd8d0d8, voice: 'hiss', size: 1, night: true },
  drowner: { name: 'Drowner', model: 'drowner', family: 'drowned', hp: 80, dmg: 12, speed: 5.2, reach: 1.9, xp: 24, coins: [0, 3], fire: 1.6, drops: [['drowner_brain', 0.6], ['drowner_mutagen', 0.05]], pack: [2, 4], col: 0x4a6a5a, voice: 'gurgle', size: 0.95 },
  troll: { name: 'Troll', model: 'troll', family: 'ogroid', hp: 680, dmg: 34, speed: 4.2, reach: 3, xp: 180, coins: [30, 70], fire: 1.4, drops: [['troll_hide', 0.8], ['troll_mutagen', 0.15]], col: 0x7a7868, voice: 'roar', size: 1.9 },
  wyvern: { name: 'Wyvern', model: 'wyvern', family: 'draconid', hp: 320, dmg: 24, speed: 9, reach: 2.6, xp: 140, coins: [10, 30], ice: 1.4, fly: true, drops: [['wyvern_scale', 0.7], ['wyvern_mutagen', 0.12]], col: 0x3a5a4a, voice: 'screech', size: 1.6 },
  blood_fiend: { name: 'Blood Fiend', model: 'werewolf', family: 'cursed', hp: 950, dmg: 38, speed: 9, reach: 2.8, xp: 400, coins: [60, 120], silver: 1.5, drops: [['blood_shard', 1], ['blood_shard', 0.6]], col: 0x6a0a0a, voice: 'roar', size: 1.6, bloodOnly: true },
  // wildlife
  deer: { name: 'Deer', model: 'deer', family: 'animal', hp: 30, dmg: 0, speed: 10, xp: 6, coins: [0, 0], drops: [['raw_venison', 1], ['deer_hide', 0.8]], col: 0x8a6a4a, voice: 'bleat', size: 1, prey: true },
  rabbit: { name: 'Rabbit', model: 'rabbit', family: 'animal', hp: 6, dmg: 0, speed: 9, xp: 2, coins: [0, 0], drops: [['raw_rabbit', 1], ['rabbit_pelt', 0.7]], col: 0x9a8a78, voice: 'squeal', size: 1, prey: true },
  crow: { name: 'Crow', model: 'crow', family: 'animal', hp: 3, dmg: 0, speed: 8, xp: 1, coins: [0, 0], drops: [], col: 0x1a1a1e, voice: 'caw', size: 1, prey: true, bird: true },
  // bosses
  mill_beast: { name: 'The Mill Beast', model: 'werewolf', family: 'beast', hp: 1100, dmg: 28, speed: 9, reach: 2.8, xp: 600, coins: [80, 80], silver: 2, regen: 4, boss: true, trophy: 'mill_beast', drops: [['werewolf_claw', 1], ['wolf_mutagen', 1]], col: 0x3a2c22, voice: 'roar', size: 1.55 },
  mire_mother: { name: 'The Mire Mother', model: 'drowner', family: 'drowned', hp: 1500, dmg: 30, speed: 6, reach: 3, xp: 800, coins: [120, 120], fire: 1.6, boss: true, trophy: 'mire_mother', drops: [['drowner_mutagen', 1], ['drowner_brain', 1]], col: 0x2a4a3a, voice: 'gurgle', size: 2 },
  old_grum: { name: 'Old Grum', model: 'troll', family: 'ogroid', hp: 2200, dmg: 42, speed: 4.6, reach: 3.6, xp: 1000, coins: [200, 200], fire: 1.4, boss: true, trophy: 'old_grum', drops: [['iron_key', 1], ['troll_mutagen', 1], ['troll_hide', 1]], col: 0x6a6858, voice: 'roar', size: 2.4 },
  wyvern_queen: { name: 'Skarnveil, the Wyvern Queen', model: 'wyvern', family: 'draconid', hp: 2600, dmg: 36, speed: 10, reach: 3.2, xp: 1200, coins: [250, 250], ice: 1.4, fly: true, boss: true, trophy: 'wyvern_queen', drops: [['demon_horn', 1], ['wyvern_scale', 1], ['wyvern_mutagen', 1]], col: 0x2a4a3a, voice: 'screech', size: 2.6 },
  lord_vargrave: { name: 'Lord Aldous Vargrave', model: 'lord', family: 'cursed', hp: 3600, dmg: 40, speed: 9, reach: 2.6, xp: 2000, coins: [500, 500], silver: 1.6, fire: 1.3, blink: true, boss: true, trophy: 'vargrave', drops: [['vargrave_blade', 1]], col: 0xd8d0c8, voice: 'hiss', size: 1.1 },
  azgoreth: { name: 'Azgoreth, the Hunger Below', model: 'demon', family: 'demon', hp: 5200, dmg: 48, speed: 6.5, reach: 4, xp: 3000, coins: [0, 0], boss: true, trophy: 'azgoreth', drops: [], col: 0x3a0a0a, voice: 'demon', size: 3.2 },
};
for (const k in MON) MON[k].id = k;
const BLOOD_MUL = 1.5; // blood moon: monsters are this much stronger
// where things live: [x, z, radius, [[type, weight]...], max, when]
const ZONES = [
  { x: 300, z: 60, r: 170, day: [['wolf', 3], ['deer', 2], ['rabbit', 2]], night: [['werewolf', 2], ['wolf', 3]], max: 7 },
  { x: 420, z: 300, r: 60, day: [['crow', 3]], night: [['ghoul', 4]], max: 6 },
  { x: -470, z: 60, r: 150, day: [['drowner', 3]], night: [['drowner', 4], ['ghoul', 1]], max: 7 },
  { x: 135, z: 600, r: 130, day: [['rabbit', 2], ['crow', 1]], night: [['drowner', 3]], max: 5 },
  { x: 360, z: -340, r: 150, day: [['crow', 2], ['wolf', 1]], night: [['vampire', 2], ['ghoul', 2]], max: 5 },
  { x: -200, z: -560, r: 140, day: [['wyvern', 1], ['wolf', 2]], night: [['wyvern', 1], ['werewolf', 1]], max: 3 },
  { x: 120, z: 230, r: 120, day: [['rabbit', 3], ['crow', 3], ['deer', 1]], night: [['wolf', 2]], max: 6 },
  { x: -230, z: 300, r: 160, day: [['deer', 3], ['rabbit', 3], ['wolf', 1]], night: [['wolf', 3], ['ghoul', 1]], max: 6 },
  { x: -300, z: -250, r: 180, day: [['deer', 2], ['wolf', 2]], night: [['werewolf', 1], ['wolf', 2]], max: 6 },
  { x: 220, z: -80, r: 140, day: [['deer', 3], ['rabbit', 2]], night: [['wolf', 2], ['werewolf', 1]], max: 5 },
  { x: 0, z: 420, r: 140, day: [['deer', 2], ['rabbit', 2], ['crow', 2]], night: [['wolf', 2], ['drowner', 1]], max: 5 },
];
// ---------- skills: 4 branches, 4 skills, 3 ranks each ----------
const SKILLS = [
  { id: 'edge', br: 'blade', row: 0, name: 'Sharp Edge', per: '+8% sword damage' }, { id: 'heavy', br: 'blade', row: 1, name: 'Heavy Hand', per: '+15% heavy attack damage' },
  { id: 'riposte', br: 'blade', row: 2, name: 'Riposte', per: 'Wider parry window, parries hurt' }, { id: 'butcher', br: 'blade', row: 3, name: 'Butcher', per: 'Finishers heal 8% and cut off more limbs' },
  { id: 'aim', br: 'hunt', row: 0, name: 'Steady Aim', per: '+10% bow damage' }, { id: 'draw', br: 'hunt', row: 1, name: 'Quick Draw', per: 'Draw your bow 12% faster' },
  { id: 'head', br: 'hunt', row: 2, name: 'Headhunter', per: '+25% headshot damage' }, { id: 'eye', br: 'hunt', row: 3, name: 'Hunter\'s Eye', per: 'Hunter sense lasts longer and shows monster health' },
  { id: 'kindle', br: 'arcana', row: 0, name: 'Kindling', per: '+12% fire damage' }, { id: 'storm', br: 'arcana', row: 1, name: 'Storm Caller', per: 'Lightning jumps to one more enemy' },
  { id: 'winter', br: 'arcana', row: 2, name: 'Winter\'s Touch', per: 'Ice freezes for longer' }, { id: 'well', br: 'arcana', row: 3, name: 'Deep Well', per: '+15 max mana and faster mana' },
  { id: 'blood', br: 'survival', row: 0, name: 'Thick Blood', per: '+8% max health' }, { id: 'stomach', br: 'survival', row: 1, name: 'Iron Stomach', per: 'Hunger falls 20% slower, raw meat is safe' },
  { id: 'cold', br: 'survival', row: 2, name: 'Cold Hardened', per: 'Feel the cold 20% less' }, { id: 'rider', br: 'survival', row: 3, name: 'Rider', per: 'Your horse is 10% faster and tires slower' },
];
const SKILL_BY = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const BRANCHES = { blade: { name: 'BLADE', col: '#c84040' }, hunt: { name: 'HUNT', col: '#5aa050' }, arcana: { name: 'ARCANA', col: '#5a7ae0' }, survival: { name: 'SURVIVAL', col: '#d8a040' } };
const SPELLS = {
  fire: { name: 'Fire', mana: 22, cd: 0.9, dmg: 34, col: 0xff6020, desc: 'A fireball that bursts and sets things burning.' },
  lightning: { name: 'Lightning', mana: 28, cd: 1.2, dmg: 30, col: 0xa0c8ff, desc: 'Strikes your target and jumps to others nearby. Stuns.' },
  ice: { name: 'Ice', mana: 20, cd: 0.8, dmg: 18, col: 0xa0e8ff, desc: 'A cone of ice shards that slows and freezes.' },
};
const MUTATIONS = {
  wolf: { name: 'Wolf Blood', desc: 'Heal 2 health a second at night.', corr: 15 }, vampire: { name: 'Thirst', desc: 'Your sword hits heal you a little.', corr: 20 },
  troll: { name: 'Stone Skin', desc: '+15% max health, +6 armour.', corr: 18 }, wyvern: { name: 'Wyvern Lungs', desc: '+25% stamina, faster stamina.', corr: 15 },
  drowner: { name: 'Gills', desc: 'Swim fast and never drown.', corr: 10 }, ghoul: { name: 'Carrion Hunger', desc: 'Eat from fresh kills (E) to heal.', corr: 12 },
};
// ---------- crafting ----------
const RECIPES = [
  // alchemy (camps, home, Maud's)
  { out: 'draught', n: 1, at: 'alchemy', need: { bloodroot: 2 } }, { out: 'greater_draught', n: 1, at: 'alchemy', need: { bloodroot: 2, ghostcap: 1, drowner_brain: 1 } },
  { out: 'stamina_tonic', n: 1, at: 'alchemy', need: { silverleaf: 2 } }, { out: 'mana_tonic', n: 1, at: 'alchemy', need: { frostbloom: 1, silverleaf: 1 } },
  { out: 'warming_brandy', n: 1, at: 'alchemy', need: { ale: 1, bloodroot: 1 } }, { out: 'antidote', n: 1, at: 'alchemy', need: { silverleaf: 1, ghostcap: 1 } },
  { out: 'owl_eye', n: 1, at: 'alchemy', need: { ghostcap: 2, frostbloom: 1 } },
  { out: 'beast_oil', n: 1, at: 'alchemy', need: { wolf_pelt: 1, bloodroot: 1 } }, { out: 'cursed_oil', n: 1, at: 'alchemy', need: { ghoul_marrow: 1, silverleaf: 1 } },
  { out: 'draconid_oil', n: 1, at: 'alchemy', need: { wyvern_scale: 1, frostbloom: 1 } }, { out: 'ogroid_oil', n: 1, at: 'alchemy', need: { troll_hide: 1, bloodroot: 1 } }, { out: 'drowned_oil', n: 1, at: 'alchemy', need: { drowner_brain: 1, ghostcap: 1 } },
  { out: 'silver_arrow', n: 10, at: 'alchemy', need: { silver_ingot: 1, firewood: 1 } }, { out: 'fire_arrow', n: 10, at: 'alchemy', need: { firewood: 2, bloodroot: 1 } },
  // smithing (Brann's forge)
  { out: 'silver_sword', n: 1, at: 'smith', need: { silver_ingot: 3, iron_ingot: 1 } }, { out: 'hunter_coat', n: 1, at: 'smith', need: { deer_hide: 4 } },
  { out: 'wolf_coat', n: 1, at: 'smith', need: { wolf_pelt: 4, deer_hide: 2 } }, { out: 'bone_bow', n: 1, at: 'smith', need: { wyvern_scale: 3, firewood: 2 } },
  { out: 'moonsilver', n: 1, at: 'smith', need: { silver_ingot: 4, blood_shard: 3 } }, { out: 'blood_plate', n: 1, at: 'smith', need: { blood_shard: 5, troll_hide: 2, iron_ingot: 3 } },
  { out: 'demonbane', n: 1, at: 'smith', need: { demon_horn: 1, silver_ingot: 5, blood_shard: 2 }, keepNeed: ['demon_horn'] },
];
const SHOPS = {
  smith: { name: 'Brann\'s Forge', greet: 'Steel, silver and good leather. And if you bring me the makings, I\'ll forge you something special.', items: ['steel_sword', 'knight_sword', 'hunting_bow', 'yew_longbow', 'wood_shield', 'iron_shield', 'tower_shield', 'leather', 'hunter_coat', 'chainmail', 'knight_plate', 'arrow', 'iron_ingot', 'silver_ingot'], craft: 'smith' },
  alchemist: { name: 'Old Maud\'s Remedies', greet: 'Bloodroot heals, silverleaf steadies the breath. Bring me herbs and I\'ll pay you, or mix your own on my table.', items: ['draught', 'stamina_tonic', 'mana_tonic', 'antidote', 'warming_brandy', 'owl_eye', 'beast_oil', 'cursed_oil', 'drowned_oil', 'bloodroot', 'silverleaf', 'silver_arrow', 'fire_arrow'], craft: 'alchemy' },
  inn: { name: 'The Drowned Lantern', greet: 'Warm stew, cold ale and a bed that hasn\'t got bugs in it. Mostly.', items: ['bread', 'apple', 'cheese', 'stew', 'ale', 'firewood', 'arrow'], room: 15 },
  chapel: { name: 'Chapel of the Dawn', greet: 'The light keeps what darkness you carry from taking root. For a donation.', items: ['holy_water', 'draught'], cleanse: 120 },
};
// ---------- hunter looks ----------
const LOOK_OPTS = {
  body: ['Slim', 'Average', 'Broad'], skin: ['#f2d0b0', '#e0b090', '#c89068', '#a06a48', '#7a4a30', '#4a2c1c'],
  face: ['Sharp', 'Soft', 'Square', 'Gaunt'], hair: ['Bald', 'Short', 'Long', 'Ponytail', 'Braid', 'Shaved sides'],
  hairCol: ['#1a1410', '#3a2414', '#6a4024', '#a06a34', '#d8b070', '#e8e0d0', '#8a2a1a', '#2a2a30'], beard: ['None', 'Stubble', 'Short', 'Full'],
  scar: ['None', 'Eye', 'Cheek', 'Cross', 'Burn'], eyes: ['#3a2a1a', '#3a5a8a', '#4a6a3a', '#7a6a4a', '#8a2020'],
  coat: ['#3a3028', '#2a2a30', '#4a2a20', '#2a3a2a', '#5a4a3a', '#1a1a1a'], shirt: ['#8a7a6a', '#5a2a24', '#2a3a4a', '#d8d0c0', '#3a4a2a'],
};
const LOOK_PRESETS = {
  rookie: { name: 'The Rookie', body: 1, skin: 1, face: 1, hair: 1, hairCol: 2, beard: 1, scar: 0, eyes: 1, coat: 0, shirt: 0 },
  wolfborn: { name: 'Wolfborn', body: 2, skin: 2, face: 2, hair: 2, hairCol: 0, beard: 3, scar: 3, eyes: 3, coat: 4, shirt: 1 },
  ashen: { name: 'Ashen Widow', body: 0, skin: 0, face: 0, hair: 3, hairCol: 5, beard: 0, scar: 1, eyes: 4, coat: 5, shirt: 3 },
  veteran: { name: 'The Veteran', body: 2, skin: 3, face: 3, hair: 5, hairCol: 1, beard: 2, scar: 2, eyes: 0, coat: 2, shirt: 2 },
};
const DIFF = {
  easy: { name: 'Easy', dmgIn: 0.6, hp: 0.8, loot: 1, desc: 'Monsters hit softer. A good way to enjoy the story.' },
  normal: { name: 'Normal', dmgIn: 1, hp: 1, loot: 1, desc: 'A harsh valley. Prepare before every hunt.' },
  hard: { name: 'Hard', dmgIn: 1.45, hp: 1.3, loot: 1.25, desc: 'Brutal. Monsters hit hard and take a beating.' },
  hardcore: { name: 'Hardcore', dmgIn: 1.45, hp: 1.3, loot: 1.25, perma: true, desc: 'Like Hard, but if you die your save is deleted forever.' },
};
const MAX_LVL = 25;
const xpNeed = (L) => Math.floor(120 * Math.pow(L, 1.45));
