// Everything you can spawn. Sizes are real-world meters.
// anim: role -> clip name in the model (or from `borrow`, a model with the same skeleton).
// gait: legs moved by code when the model has no walk clip of its own: [hip, knee, foot, phase].

export const CREATURES = {
  // ---- Real animals
  wolf: {
    name: 'Gray Wolf', group: 'animals', length: 1.55, yaw: -Math.PI / 2, hp: 70, speed: 2.2, runSpeed: 11, turn: 5,
    borrow: 'bear', anim: { idle: 'Wolf|WOLF_DEMO', walk: 'walk', run: 'run', attack: 'bite', hurt: 'hurt', die: 'die', dead: 'dead' },
    attack: { range: 1.6, damage: 18, sever: 0.35, cooldown: 1.1, hitAt: 0.35, kind: 'bite' }, sounds: ['growl', 'growl2'], senses: 40, pack: true,
  },
  bear: {
    name: 'Black Bear', group: 'animals', length: 1.9, yaw: -Math.PI / 2, hp: 220, speed: 1.6, runSpeed: 10, turn: 3,
    anim: { idle: 'idle', walk: 'walk', run: 'run', attack: 'bite', hurt: 'hurt', die: 'die', dead: 'dead', roar: 'roar' },
    attack: { range: 2.1, damage: 30, sever: 0.55, cooldown: 1.5, hitAt: 0.4, kind: 'claw' }, sounds: ['roar_bear'], senses: 35,
  },
  tiger: {
    name: 'White Tiger', group: 'animals', length: 2.9, yaw: 0, hp: 180, speed: 1.8, runSpeed: 14, turn: 4.5,
    anim: { idle: 'Idle' },
    gait: [['l_femurRibbonFront_00', 'l_tibiaRibbonFront_00', 'l_footFront_00', 0], ['r_femurRibbonFront_00', 'r_tibiaRibbonFront_00', 'r_footFront_00', 0.5],
      ['l_femurRibbon_00', 'l_tibiaRibbon_00', 'l_foot_00', 0.75], ['r_femurRibbon_00', 'r_tibiaRibbon_00', 'r_foot_00', 0.25]],
    gaitSwing: 0.45, gaitStride: 1.4,
    attack: { range: 2.4, damage: 28, sever: 0.55, cooldown: 1.2, hitAt: 0.3, kind: 'claw', lunge: true }, sounds: ['roar_cat'], senses: 45,
  },
  hyena: {
    name: 'Spotted Hyena', group: 'animals', length: 1.4, yaw: 0, hp: 60, speed: 2.4, runSpeed: 10, turn: 5,
    borrow: 'bear', anim: { idle: 'idle', walk: 'walk', run: 'run', attack: 'bite', hurt: 'hurt', die: 'die', dead: 'dead' },
    attack: { range: 1.5, damage: 15, sever: 0.3, cooldown: 1.0, hitAt: 0.35, kind: 'bite' }, sounds: ['hyena'], senses: 40, pack: true,
  },
  rhino: {
    name: 'Grey Rhino', group: 'animals', length: 3.7, yaw: 0, hp: 400, speed: 1.4, runSpeed: 12, turn: 2,
    anim: { run: 'Animation' }, walkFromRun: true,
    attack: { range: 2.8, damage: 45, sever: 0.45, cooldown: 2.2, hitAt: 0.2, kind: 'ram', lunge: true }, sounds: ['growl2'], senses: 30,
  },
  elk: {
    name: 'Elk', group: 'animals', length: 2.5, yaw: 0, hp: 120, speed: 1.5, runSpeed: 13, turn: 4, timid: true,
    anim: { idle: 'idle', walk: 'walk', run: 'run', hurt: 'hurt', die: 'die', eat: 'eat' },
    attack: { range: 2.2, damage: 20, sever: 0.15, cooldown: 2, hitAt: 0.3, kind: 'ram' }, sounds: ['roar_bear'], senses: 30,
  },
  // ---- Dinosaurs
  trex: {
    name: 'Tyrannosaurus Rex', group: 'dinos', length: 12, yaw: 0, hp: 1500, speed: 2.5, runSpeed: 9, turn: 1.6,
    anim: { idle: 'idle', walk: 'run', run: 'run', attack: 'bite', roar: 'roar', tail: 'attack_tail' }, walkRate: 0.55,
    attack: { range: 7, damage: 70, sever: 0.85, cooldown: 2.4, hitAt: 0.45, kind: 'bite', clipSpan: [0, 1.6] }, sounds: ['roar_big'], senses: 70, shake: 1,
  },
  raptor: {
    name: 'Velociraptor', group: 'dinos', length: 3.4, yaw: 0, hp: 110, speed: 2.2, runSpeed: 15, turn: 5, pack: true,
    anim: { idle: 'idle', walk: 'walk', run: 'run', attack: 'bite', leap: 'leap', roar: 'roar', hurt: 'hurt', die: 'die' },
    attack: { range: 2.2, damage: 22, sever: 0.5, cooldown: 0.9, hitAt: 0.35, kind: 'claw', lunge: true }, sounds: ['screech'], senses: 50,
  },
  trike: {
    name: 'Triceratops', group: 'dinos', length: 8, yaw: 0, hp: 1100, speed: 1.3, runSpeed: 7, turn: 1.4,
    anim: { idle: 'Animation' },
    gait: [['Bip001 L UpperArm', 'Bip001 L Forearm', 'Bip001 L Hand', 0], ['Bip001 R UpperArm', 'Bip001 R Forearm', 'Bip001 R Hand', 0.5],
      ['Bip001 L Thigh', 'Bip001 L Calf', 'Bip001 L Foot', 0.5], ['Bip001 R Thigh', 'Bip001 R Calf', 'Bip001 R Foot', 0]],
    gaitSwing: 0.32, gaitStride: 3.2,
    attack: { range: 5.5, damage: 50, sever: 0.5, cooldown: 2.5, hitAt: 0.3, kind: 'ram', lunge: true }, sounds: ['roar_bear'], senses: 30, shake: 0.5,
  },
  ptero: {
    name: 'Pteranodon', group: 'dinos', length: 3.5, wingspan: 7, yaw: 0, hp: 90, speed: 9, runSpeed: 16, turn: 1.6, flying: true,
    anim: { fly: 'Animation' },
    attack: { range: 2.6, damage: 20, sever: 0.45, cooldown: 3, hitAt: 0, kind: 'claw' }, sounds: ['screech'], senses: 60,
  },
  // ---- Monsters + aliens
  dragon: {
    name: 'Dragon', group: 'monsters', length: 9, wingspan: 14, yaw: 0, hp: 900, speed: 11, runSpeed: 20, turn: 1.1, flying: true,
    anim: { fly: 'Flying' },
    attack: { range: 5, damage: 60, sever: 0.8, cooldown: 3.5, hitAt: 0, kind: 'bite' }, sounds: ['roar_dragon'], senses: 90, shake: 0.6,
  },
  zombie: {
    name: 'Zombie', group: 'monsters', height: 1.8, yaw: 0, hp: 90, speed: 0.9, runSpeed: 1.6, turn: 3,
    anim: { idle: 'idle', walk: 'walk', run: 'walk', attack: 'attack' }, runRate: 1.6,
    attack: { range: 1.4, damage: 14, sever: 0.25, cooldown: 1.6, hitAt: 0.55, kind: 'bite' }, sounds: ['zombie1', 'zombie2'], senses: 30,
  },
  alien: {
    name: 'Grey Alien', group: 'monsters', height: 1.5, yaw: 0, hp: 80, speed: 1.0, runSpeed: 2.8, turn: 4,
    anim: { walk: 'walk', run: 'walk' }, walkFromRun: true, runRate: 2,
    attack: { range: 1.5, damage: 16, sever: 0.4, cooldown: 1.4, hitAt: 0.3, kind: 'claw', lunge: true }, sounds: ['alien'], senses: 40,
  },
  fossil: {
    name: 'Living Triceratops Skeleton', group: 'monsters', length: 7, yaw: 0, hp: 600, speed: 1.6, runSpeed: 5, turn: 1.6,
    anim: { idle: 'Armature|IdleGround', walk: 'Armature|Walk', run: 'Armature|Walk', roar: 'Armature|Roar', rise: 'Armature|RiseUp', die: 'Armature|Fall' }, runRate: 1.8,
    attack: { range: 5, damage: 45, sever: 0.6, cooldown: 2.4, hitAt: 0.3, kind: 'ram', lunge: true }, sounds: ['fossil'], senses: 35, bloodless: true,
  },
};

// Weapons. len = model length along its long axis; grip = 0..1 along that axis from the handle end.
export const WEAPONS = {
  katana: { name: 'Katana', kind: 'blade', damage: 55, reach: 1.25, swing: 0.42, grip: 0.12, sever: 0.7 },
  machete: { name: 'Machete', kind: 'blade', damage: 40, reach: 0.95, swing: 0.38, grip: 0.1, sever: 0.45 },
  hatchet: { name: 'Hatchet', kind: 'blade', damage: 38, reach: 0.65, swing: 0.4, grip: 0.12, sever: 0.35 },
  axe: { name: 'Wood Axe', kind: 'blade', damage: 60, reach: 1.0, swing: 0.6, grip: 0.08, sever: 0.6 },
  warhammer: { name: 'War Hammer', kind: 'blunt', damage: 65, reach: 1.05, swing: 0.62, grip: 0.08 },
  mace: { name: 'Mace', kind: 'blunt', damage: 50, reach: 0.95, swing: 0.5, grip: 0.08, hide: [] },
  dagger: { name: 'Dagger', kind: 'blade', damage: 30, reach: 0.55, swing: 0.28, grip: 0.12, hide: ['scabbard'], sever: 0.2 },
  pistol: { name: 'Pistol', kind: 'gun', damage: 34, rate: 0.18, keep: ['_a', 'magazine_loaded'], hide: ['magazine', 'bullet', '_b'], sound: 'gun_pistol', recoil: 0.06 },
  rifle: { name: 'Bolt-Action Rifle', kind: 'rifle', damage: 140, rate: 1.1, hide: ['bolt_b', 'bullet'], sound: 'gun_rifle', recoil: 0.14, zoom: 3 },
  grenade: { name: 'Stick Grenade', kind: 'throw', damage: 220, radius: 8, fuse: 3 },
  shield: { name: 'Kite Shield', kind: 'shield' },
};

// Props ("stuff"). mass in kg, explode = blows up when shot or hit hard.
export const PROPS = {
  barrel: { name: 'Fuel Barrel', mass: 60, explode: true },
  box: { name: 'Cardboard Box', mass: 2 },
  crate: { name: 'Military Crate', mass: 25 },
  ammo: { name: 'Ammo Box', mass: 8 },
  log: { name: 'Dead Log', mass: 150 },
  boulder: { name: 'Boulder', mass: 900, scale: 0.5 },
  car: { name: 'Covered Car', mass: 1300 },
};

export const GROUPS = [
  ['weapons', 'Weapons'], ['animals', 'Real Animals'], ['dinos', 'Dinosaurs'], ['monsters', 'Monsters + Aliens'], ['props', 'Stuff'],
];
