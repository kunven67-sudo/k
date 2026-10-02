
// =====================================================================
// CLASSES, SPECIAL ATTACKS, SKILL TREE, PETS, DIFFICULTY
// =====================================================================
const CLASSES = {
  warrior: { name: 'Warrior', desc: 'Sword and shield. Most health, best at blocking.', hp: 1.25, def: 3, bonus: 'melee', start: { weapon: 'wood_sword', shield: 'wood_shield', armor: 'leather' }, shirt: '#a3322c', pants: '#4a3a2a', specials: ['spin', 'bash', 'warcry', 'slam', 'charge', 'second_wind'] },
  archer: { name: 'Archer', desc: 'Bows and quick rolls. Hits from far away.', hp: 1.0, speed: 0.08, dodgeCost: 0.7, bonus: 'bow', start: { weapon: 'short_bow', shield: null, armor: 'leather' }, shirt: '#3d7a32', pants: '#5a4a3a', specials: ['multishot', 'pierce', 'rollshot', 'rain', 'trap', 'eagle'] },
  mage: { name: 'Mage', desc: 'Staffs and spells. Low health, huge magic damage.', hp: 0.85, cdr: 0.2, bonus: 'magic', start: { weapon: 'apprentice_staff', shield: null, armor: null }, shirt: '#3e6cb8', pants: '#2c3e68', specials: ['fireball', 'nova', 'chain', 'blink', 'meteor', 'manashield'] },
  rogue: { name: 'Rogue', desc: 'Daggers and poison. Very fast, lots of critical hits.', hp: 0.95, crit: 0.1, bonus: 'fast', start: { weapon: 'rusty_dagger', shield: null, armor: 'leather' }, shirt: '#3a3440', pants: '#2a2430', specials: ['knives', 'shadowstep', 'cloud', 'smoke', 'flurry', 'assassinate'] },
};
// kind decides how a special works; mul = damage x weapon damage
const SPECIALS = {
  spin: { name: 'Spin Slash', lvl: 1, cd: 6, kind: 'aoe', r: 40, mul: 1.6, kb: 1.5, desc: 'Spin and hit everything around you.' },
  bash: { name: 'Shield Bash', lvl: 3, cd: 8, kind: 'cone', r: 36, arc: 1.3, mul: 1.3, stun: 1.6, desc: 'Smash enemies in front of you and stun them.' },
  warcry: { name: 'War Cry', lvl: 6, cd: 22, kind: 'buff', buff: 'warcry', t: 7, desc: '+30% damage and +25% defense for 7 seconds. Pushes enemies back.' },
  slam: { name: 'Ground Slam', lvl: 10, cd: 12, kind: 'aoe', r: 64, mul: 2.4, stun: 1, kb: 2, shake: 6, desc: 'Slam the ground. Huge area, stuns.' },
  charge: { name: 'Charge', lvl: 14, cd: 9, kind: 'dash', d: 120, mul: 2, kb: 2.5, desc: 'Charge forward, flattening everything in the way. You can\'t be hit mid-charge.' },
  second_wind: { name: 'Second Wind', lvl: 18, cd: 45, kind: 'heal', heal: 0.4, desc: 'Heal 40% of your health and refill stamina.' },
  multishot: { name: 'Multi Shot', lvl: 1, cd: 5, kind: 'volley', n: 5, spread: 0.55, mul: 1, desc: 'Fire 5 arrows in a fan.' },
  pierce: { name: 'Piercing Arrow', lvl: 3, cd: 7, kind: 'volley', n: 1, spread: 0, mul: 3.2, pierce: 99, speed: 430, big: true, desc: 'A huge arrow that goes through everything.' },
  rollshot: { name: 'Roll Shot', lvl: 6, cd: 8, kind: 'rollshot', n: 3, spread: 0.3, mul: 1.2, desc: 'Roll backward and fire 3 arrows.' },
  rain: { name: 'Arrow Rain', lvl: 10, cd: 14, kind: 'rain', r: 52, hits: 8, mul: 0.9, delay: 0.4, desc: 'Arrows rain down on the target area.' },
  trap: { name: 'Frost Trap', lvl: 14, cd: 12, kind: 'trap', r: 54, mul: 2.2, desc: 'Drop a trap that freezes and hurts enemies who step on it.' },
  eagle: { name: 'Eagle Eye', lvl: 18, cd: 30, kind: 'buff', buff: 'eagle', t: 8, desc: '+40% critical hits and faster shots for 8 seconds.' },
  fireball: { name: 'Fireball', lvl: 1, cd: 4, kind: 'bolt', proj: 'pfire', mul: 2.5, aoe: 40, burn: true, speed: 200, desc: 'A big exploding fireball that sets enemies on fire.' },
  nova: { name: 'Frost Nova', lvl: 3, cd: 9, kind: 'aoe', r: 58, mul: 1.4, slow: 3, fx: 'ice', desc: 'Freeze everything around you.' },
  chain: { name: 'Chain Lightning', lvl: 6, cd: 7, kind: 'chain', jumps: 5, mul: 1.8, desc: 'Lightning that jumps between enemies.' },
  blink: { name: 'Blink', lvl: 10, cd: 6, kind: 'blink', d: 120, mul: 1, desc: 'Teleport toward the mouse, blasting where you stood.' },
  meteor: { name: 'Meteor', lvl: 14, cd: 18, kind: 'meteor', r: 72, mul: 5, delay: 0.9, desc: 'Call down a meteor on the target.' },
  manashield: { name: 'Mana Shield', lvl: 18, cd: 30, kind: 'buff', buff: 'shield', t: 10, desc: 'A magic shield soaks up damage equal to half your health for 10 seconds.' },
  knives: { name: 'Fan of Knives', lvl: 1, cd: 5, kind: 'ring', n: 12, mul: 0.9, poison: true, desc: 'Throw knives in every direction. They poison.' },
  shadowstep: { name: 'Shadow Step', lvl: 3, cd: 6, kind: 'step', mul: 2.2, desc: 'Teleport behind the nearest enemy and stab it.' },
  cloud: { name: 'Poison Cloud', lvl: 6, cd: 12, kind: 'cloud', r: 50, t: 5, mul: 0.5, desc: 'A poison cloud that hurts everything inside it.' },
  smoke: { name: 'Smoke Bomb', lvl: 10, cd: 18, kind: 'buff', buff: 'smoke', t: 4, desc: 'Vanish for 4 seconds. Monsters lose you, and your next hit does triple damage.' },
  flurry: { name: 'Flurry', lvl: 14, cd: 10, kind: 'flurry', hits: 6, mul: 0.9, r: 34, arc: 1.4, desc: '6 lightning-fast stabs in front of you.' },
  assassinate: { name: 'Assassinate', lvl: 18, cd: 25, kind: 'assassinate', mul: 6, desc: 'Dash to the nearest enemy for a massive hit.' },
};
for (const k in SPECIALS) SPECIALS[k].id = k;
// skill tree: 3 branches x 5 skills x 3 ranks. A skill needs 2 points in its branch per row above it.
const SKILLS = [
  { id: 'vitality', br: 'might', row: 0, name: 'Vitality', per: '+6% max health' },
  { id: 'power', br: 'might', row: 1, name: 'Power', per: '+5% damage' },
  { id: 'iron_skin', br: 'might', row: 2, name: 'Iron Skin', per: '+3 defense' },
  { id: 'brutal', br: 'might', row: 3, name: 'Brutal Crits', per: '+15% critical damage' },
  { id: 'bloodlust', br: 'might', row: 4, name: 'Bloodlust', per: 'Kills heal 2% health' },
  { id: 'swift', br: 'agility', row: 0, name: 'Swift Feet', per: '+4% move speed' },
  { id: 'haste', br: 'agility', row: 1, name: 'Quick Hands', per: '-5% attack time' },
  { id: 'precision', br: 'agility', row: 2, name: 'Precision', per: '+3% critical hits' },
  { id: 'light_step', br: 'agility', row: 3, name: 'Light Step', per: 'Dodges cost 15% less stamina' },
  { id: 'evasion', br: 'agility', row: 4, name: 'Evasion', per: '+3% chance to avoid a hit' },
  { id: 'focus', br: 'spirit', row: 0, name: 'Focus', per: '-7% special cooldowns' },
  { id: 'arcana', br: 'spirit', row: 1, name: 'Arcana', per: '+10% special damage' },
  { id: 'regen', br: 'spirit', row: 2, name: 'Regeneration', per: '+0.6 health a second' },
  { id: 'alchemy', br: 'spirit', row: 3, name: 'Alchemy', per: 'Potions heal 15% more' },
  { id: 'fortune', br: 'spirit', row: 4, name: 'Fortune', per: '+8% coins, +5% more drops' },
];
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const BRANCHES = { might: { name: 'MIGHT', col: '#d8454a' }, agility: { name: 'AGILITY', col: '#5cc46e' }, spirit: { name: 'SPIRIT', col: '#55a8ef' } };

const PETS = {
  slime: { name: 'Baby Slime', price: 150, kind: 'melee', atk: 3, per: 2, rate: 1.2, spd: 90, desc: 'Bounces after you and grabs loot from far away.' },
  wolf: { name: 'Wolf Pup', price: 300, kind: 'melee', atk: 6, per: 4, rate: 0.9, spd: 120, desc: 'Bites hard. Grows bigger every level.' },
  raven: { name: 'Raven', price: 500, kind: 'fly', atk: 4, per: 3, rate: 0.6, spd: 130, desc: 'Pecks enemies and finds hidden notes and secret walls.' },
  sprite: { name: 'Fire Sprite', price: 800, kind: 'ranged', atk: 5, per: 4, rate: 1.4, spd: 110, desc: 'Shoots fireballs and lights up dark dungeons.' },
};
const petXpNeed = (lv) => Math.floor(40 * Math.pow(lv, 1.6));

const DIFF = {
  easy: { name: 'Easy', hp: 0.75, dmg: 0.6, loot: 1, nights: 80, desc: 'Monsters hit softer. 80 nights to save Finn.' },
  normal: { name: 'Normal', hp: 1, dmg: 1, loot: 1, nights: 60, desc: 'The way it was meant to be played. 60 nights.' },
  hard: { name: 'Hard', hp: 1.3, dmg: 1.4, loot: 1.25, nights: 45, desc: 'Tougher monsters, better loot. 45 nights.' },
  hardcore: { name: 'Hardcore', hp: 1.3, dmg: 1.4, loot: 1.25, nights: 45, perma: true, desc: 'Like Hard, but if you die your save is deleted. Forever.' },
};

const MAX_LVL = 30;
const xpNeed = (L) => Math.floor(25 * Math.pow(L, 1.55));
const INV_SIZE = 30, HOTBAR = 10;
// hero creator choices
const LOOK_OPTS = {
  skin: ['#f6d2a8', '#f0c08a', '#d8a070', '#b07a50', '#8a5a3a', '#5a3a24'],
  hair: ['#1a120a', '#3a2410', '#5a3417', '#8a5a2b', '#c8902a', '#e8d090', '#a3322c', '#efe4cc', '#3e6cb8', '#7a4a9a'],
  hairStyle: [0, 1, 2, 3, 4],
  shirt: ['#a3322c', '#3d7a32', '#3e6cb8', '#3a3440', '#7a4a9a', '#c8922a', '#2a8a8a', '#efe4cc'],
  pants: ['#4a3a2a', '#2c3e68', '#2a2430', '#5a4a3a', '#3a5a3a', '#6a2a2a'],
};
const HAIR_NAMES = ['Short', 'Long', 'Bald', 'Spiky', 'Ponytail'];
