// Gadget parts. A gadget = 1 BODY + 1-3 CORES + 1 MOD + sliders (power, area, time, shots) + options.
// 8 bodies x 37 cores (pick up to 3) x 9 mods x 10^4 slider settings = millions of gadgets.

export const BODIES = {
  pistol: { label: 'Pistol', desc: 'One hand, quick shots', range: 18, rate: 3, price: 0 },
  rifle: { label: 'Rifle', desc: 'Long range, slower', range: 45, rate: 1.3, price: 120 },
  glove: { label: 'Power glove', desc: 'Touch to apply (grab range)', range: 1.2, rate: 2.5, touch: true, price: 80 },
  grenade: { label: 'Grenade launcher', desc: 'Lobs a blob that bursts', range: 22, rate: 0.9, lob: true, price: 150 },
  wand: { label: 'Wand', desc: 'Short range, fast, spreads', range: 10, rate: 5, price: 60 },
  cannon: { label: 'Cannon', desc: 'Huge, slow, big hits', range: 30, rate: 0.5, heavy: true, price: 260 },
  trap: { label: 'Trap pad', desc: 'Place it, it triggers when stepped on', range: 6, rate: 1, placed: true, price: 90 },
  staff: { label: 'Staff', desc: 'Pulses around YOU', range: 6, rate: 1, aura: true, price: 140 },
};

// cost = battery use, tier = price tier in money mode
export const CORES = {
  shrink: { label: 'Shrink', color: 0x63e6be, icon: 'cones-in', cost: 1, opp: 'grow', tier: 0, desc: 'Makes things smaller' },
  grow: { label: 'Grow', color: 0xff8a3d, icon: 'cones-out', cost: 1.2, opp: 'shrink', tier: 0, desc: 'Makes things bigger' },
  freeze: { label: 'Freeze', color: 0x9fd8ff, icon: 'crystal', cost: 1, opp: 'fire', tier: 0, desc: 'Ice block. Hit a frozen person hard and they shatter' },
  fire: { label: 'Fire', color: 0xff5a10, icon: 'flame', cost: 1, opp: 'freeze', tier: 1, desc: 'Sets things on fire' },
  lightning: { label: 'Lightning', color: 0x8ab0ff, icon: 'bolt', cost: 1.2, tier: 1, desc: 'Shock + stun' },
  teleport: { label: 'Teleport', color: 0xb070ff, icon: 'ring', cost: 1.4, tier: 1, desc: 'Sends the target to your teleporter pad (or somewhere random)' },
  object: { label: 'Object', color: 0xe0c060, icon: 'cube', cost: 1.5, tier: 1, desc: 'Turns people into objects (they stay awake inside)' },
  gravity: { label: 'Anti-gravity', color: 0xc0a0ff, icon: 'ring2', cost: 1, opp: 'heavy', tier: 1, desc: 'They float away' },
  heavy: { label: 'Heavy', color: 0x6a5acd, icon: 'weight', cost: 1, opp: 'gravity', tier: 1, desc: 'Pinned to the ground' },
  push: { label: 'Push', color: 0xffffff, icon: 'arrow', cost: 0.6, opp: 'pull', tier: 0, desc: 'Blasts things away' },
  pull: { label: 'Pull', color: 0x40e0ff, icon: 'arrow-in', cost: 0.6, opp: 'push', tier: 0, desc: 'Drags things to you' },
  love: { label: 'Love', color: 0xff5f9e, icon: 'heart', cost: 0.8, opp: 'hate', tier: 0, desc: 'They fall in love (with you or whoever is close)' },
  hate: { label: 'Hate', color: 0x8a0f2a, icon: 'heart', cost: 0.8, opp: 'love', tier: 0, desc: 'They hate everyone' },
  fear: { label: 'Fear', color: 0x5a3a8a, icon: 'drop', cost: 0.8, opp: 'calm', tier: 0, desc: 'Pure terror' },
  rage: { label: 'Rage', color: 0xff2020, icon: 'spike', cost: 0.9, opp: 'calm', tier: 0, desc: 'They attack the nearest person' },
  joy: { label: 'Joy', color: 0xffd040, icon: 'star', cost: 0.6, opp: 'sad', tier: 0, desc: 'Happy dancing' },
  sad: { label: 'Sad', color: 0x4060a0, icon: 'drop', cost: 0.6, opp: 'joy', tier: 0, desc: 'Crying mess' },
  calm: { label: 'Calm', color: 0x80e0c0, icon: 'sphere', cost: 0.5, opp: 'rage', tier: 0, desc: 'Stops fights and panic' },
  mind: { label: 'Mind control', color: 0xd040ff, icon: 'eye', cost: 2, tier: 2, desc: 'They obey every order for a while' },
  clone: { label: 'Clone', color: 0xb0ffb0, icon: 'twin', cost: 2.5, tier: 2, desc: 'Makes a copy with the same memories' },
  heal: { label: 'Heal', color: 0x50ff70, icon: 'plus', cost: 1, opp: 'poison', tier: 0, desc: 'Heals, stops bleeding, cures sickness' },
  poison: { label: 'Poison', color: 0x8acc20, icon: 'drop', cost: 1, opp: 'heal', tier: 1, desc: 'Makes them sick' },
  sleep: { label: 'Sleep', color: 0x3040a0, icon: 'moon', cost: 0.8, tier: 0, desc: 'Knocks them out' },
  explode: { label: 'Explode', color: 0xff9020, icon: 'spike', cost: 2, tier: 2, desc: 'Boom. Follows the gore setting' },
  slice: { label: 'Slice', color: 0xe0e0e0, icon: 'blade', cost: 1.2, tier: 1, desc: 'An invisible blade. Cuts off limbs (gore setting)' },
  sticky: { label: 'Sticky', color: 0xd0c070, icon: 'drop', cost: 0.6, tier: 0, desc: 'Glued in place' },
  invisible: { label: 'Invisible', color: 0xdddddd, icon: 'eye', cost: 1.2, tier: 1, desc: 'Nobody can see them' },
  speed: { label: 'Speed', color: 0x40ffd0, icon: 'arrow', cost: 0.7, opp: 'slow', tier: 0, desc: 'Super fast' },
  slow: { label: 'Slow', color: 0x406080, icon: 'weight', cost: 0.7, opp: 'speed', tier: 0, desc: 'Slow motion' },
  swap: { label: 'Swap places', color: 0xf0a0ff, icon: 'twin', cost: 1.5, tier: 1, desc: 'You trade places (similar sizes only)' },
  magnet: { label: 'Magnet', color: 0xa0a0b0, icon: 'magnet', cost: 0.8, tier: 1, desc: 'Pulls nearby objects to the target' },
  bouncy: { label: 'Bouncy', color: 0xff70d0, icon: 'sphere', cost: 0.6, tier: 0, desc: 'Rubber body. Falls don\'t hurt' },
  mutate: { label: 'Mutate', color: 0x9aff3a, icon: 'twin', cost: 1.5, tier: 2, desc: 'Random body changes: big head, long legs...' },
  money: { label: 'Money', color: 0x3ad06a, icon: 'coin', cost: 2, tier: 1, desc: 'Makes coins appear' },
  plant: { label: 'Plant', color: 0x3a9a3a, icon: 'leaf', cost: 1, tier: 0, desc: 'Grows a tree (or vines on someone)' },
  water: { label: 'Water', color: 0x3a8aff, icon: 'drop', cost: 0.6, tier: 0, desc: 'A splash of water. Puts out fires' },
  blackhole: { label: 'Black hole', color: 0x2a0040, icon: 'ring', cost: 4, tier: 3, desc: 'Sucks in and crushes everything nearby' },
  timestop: { label: 'Time stop', color: 0xc0c0ff, icon: 'clock', cost: 2.5, tier: 2, desc: 'Freezes time in an area' },
  shield: { label: 'Shield', color: 0x60c0ff, icon: 'sphere', cost: 1, tier: 1, desc: 'A bubble that blocks damage' },
};

export const MODS = {
  beam: { label: 'Beam', desc: 'Instant hit where you aim' },
  bolt: { label: 'Bolt', desc: 'A glowing shot that flies' },
  spray: { label: 'Spray', desc: 'Short cone, hits everything in it' },
  burst: { label: 'Burst', desc: 'Explodes into an area on hit' },
  chain: { label: 'Chain', desc: 'Jumps to more targets' },
  rain: { label: 'Rain', desc: 'Falls from above on an area' },
  homing: { label: 'Homing', desc: 'Chases the closest target' },
  hold: { label: 'Hold', desc: 'Keeps working while you hold the trigger' },
  pulse: { label: 'Pulse', desc: 'A ring around the hit point' },
};

export const OBJECT_TYPES = ['chair', 'cup', 'rock', 'lamp', 'teddy', 'shoe', 'can', 'book', 'toilet', 'traffic cone', 'pumpkin', 'trophy', 'fish bowl', 'brick', 'pillow'];
export const EMOTION_CYCLE = ['love', 'hate', 'fear', 'rage', 'joy', 'sad', 'calm'];

export const DEFAULT_STATS = { power: 5, area: 3, time: 5, shots: 1 };

export function blueprint(name, body, cores, mod, stats = {}, opts = {}) {
  return { id: 'bp' + Math.random().toString(36).slice(2, 9), name, body, cores, mod, stats: { ...DEFAULT_STATS, ...stats }, opts: { color: null, objectType: 'chair', ...opts } };
}

export const STARTERS = [
  blueprint('Shrink Ray', 'pistol', ['shrink'], 'beam', { power: 6 }, { toCage: true, flip: true, color: 0x63e6be }),
  blueprint('Freeze Gun', 'pistol', ['freeze'], 'bolt', { power: 5, time: 5 }, { color: 0x9fd8ff }),
  blueprint('Tractor Beam', 'rifle', ['pull'], 'hold', { power: 5 }, { tractor: true, color: 0x40e0ff }),
  blueprint('Object Gun', 'pistol', ['object'], 'bolt', { power: 5, time: 10 }, { objectType: 'chair', cycleObject: true, color: 0xe0c060 }),
  blueprint('Teleporter', 'trap', ['teleport'], 'beam', { power: 5 }, { pads: true, color: 0xb070ff }),
  blueprint('Emotion Ray', 'wand', ['love'], 'beam', { power: 5, time: 6 }, { cycleEmotion: true, color: 0xff5f9e }),
];

// how much a gadget would sell for / how complex it is
export function complexity(bp) {
  const c = bp.cores.reduce((s, k) => s + (CORES[k] ? CORES[k].cost + CORES[k].tier : 0), 0);
  const st = bp.stats;
  return Math.round((c * 30 + st.power * 8 + st.area * 4 + st.time * 3 + st.shots * 10 + (BODIES[bp.body].price || 0) * 0.3) * (1 + (bp.cores.length - 1) * 0.6));
}

// backfire chance when the setting is on: crazy combos glitch more
export function instability(bp) {
  return Math.max(0, (bp.cores.length - 1) * 0.07 + Math.max(0, bp.stats.power - 7) * 0.03 + (bp.cores.includes('blackhole') ? 0.05 : 0) + (bp.cores.includes('explode') && bp.body === 'glove' ? 0.1 : 0));
}
