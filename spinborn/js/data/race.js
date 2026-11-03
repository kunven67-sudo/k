// SPINBORN races (same 54 as his wheel, same order) + race-only extra wheels.
// [label, weight, what it does, look, power] look = how your 3D character changes, power = base boost (tiers)
export const RACES = [
  ['Human', 6, 'Normal human. No special body, but humans can learn anything.', 'skin', 0],
  ['Hybrid', 4, 'Half one race, half another. Spin for your father and your mother.', 'hybrid', 0],
  ['God', 0.7, 'An actual god. Worshipped, immortal and insanely strong.', 'god', 4],
  ['Devil', 1.1, 'A devil from hell. Can command demons.', 'devil', 3],
  ['Angel', 1.1, 'A warrior of heaven with wings of light.', 'angel', 3],
  ['Deviant', 1.1, 'A twisted cosmic race. Strong, hated, and feared.', 'deviant', 3],
  ['Eternal', 1.3, 'An immortal cosmic being made to protect worlds.', 'eternal', 3],
  ['Symbiote', 1.3, 'A living alien goo that bonds to a body.', 'symbiote', 2],
  ['Skrull', 1.3, 'A green alien that can shapeshift into anyone.', 'skrull', 1],
  ['Kree', 1.3, 'A proud alien warrior race with blue skin.', 'kree', 1],
  ['Amazon', 1.3, 'A warrior from an island of immortal fighters.', 'amazon', 2],
  ['Atlantean', 1.3, 'From the sunken city. Breathes underwater, super strong.', 'atlantean', 2],
  ['Titan', 1.3, 'A giant from the age of gods. Massive power.', 'titan', 3],
  ['Asgardian', 1.3, 'From the realm of the Norse gods. Very hard to kill.', 'asgardian', 3],
  ['Viltrumite', 1.3, 'Flying alien conquerors. Strong, fast, and they live forever.', 'viltrumite', 3],
  ['Kryptonian', 1.3, 'Gets power from the sun. Flies, lasers, super strength.', 'kryptonian', 3],
  ['Martian', 1.3, 'A green alien from Mars. Telepathy and shapeshifting.', 'martian', 2],
  ['Ōtsutsuki', 1.3, 'A god-like alien clan with special eyes. Eats the life of planets.', 'otsutsuki', 4],
  ['Namekian', 1.3, 'Green alien that regrows limbs and can stretch.', 'namekian', 2],
  ['Saiyan', 1.5, 'Alien warrior race. Gets stronger after every fight.', 'saiyan', 2],
  ['Quincy', 1.3, 'Spirit archers who hunt hollows with spirit arrows.', 'quincy', 2],
  ['Arrancar', 1.3, 'A hollow that ripped off its mask and got stronger.', 'arrancar', 2],
  ['Hollow', 1.3, 'A soul turned into a monster. Hungry for souls.', 'hollow', 1],
  ['Shinigami', 1.3, 'A soul reaper with a spirit sword (zanpakutō).', 'shinigami', 2],
  ['Inhuman', 1.3, 'A human who got powers from an alien mist.', 'skin', 1],
  ['Mutant', 1.5, 'Born with a mutation that gives you powers.', 'skin', 1],
  ['Dragon', 1.5, 'A real dragon. Scales, wings, and a deadly breath.', 'dragon', 3],
  ['Phoenix', 1.3, 'A firebird that is reborn from its own ashes.', 'phoenix', 3],
  ['Leviathan', 1.3, 'A huge sea monster from the deep.', 'leviathan', 3],
  ['Kraken', 1.3, 'A giant squid monster that sinks ships.', 'kraken', 2],
  ['Cerberus', 1.3, 'The three-headed dog that guards hell.', 'cerberus', 2],
  ['Golem', 1.3, 'A body of stone brought to life. Super tough.', 'golem', 1],
  ['Slime', 1.5, 'A blob of goo. Weak at first, but it can absorb things.', 'slime', 0],
  ['Lich', 1.3, 'An undead wizard. Hides its soul to never die.', 'lich', 2],
  ['Vampire', 1.5, 'Drinks blood, lives forever, hates the sun.', 'vampire', 2],
  ['Werewolf', 1.5, 'Turns into a wolf beast. Super strength and claws.', 'werewolf', 1],
  ['Ghoul', 1.3, 'Eats to survive. Fast healing and sharp claws.', 'ghoul', 1],
  ['Spirit', 1.3, 'A spirit with no body. Floats and passes through walls.', 'spirit', 1],
  ['Ghost', 1.3, 'A ghost. Phases through everything and possesses people.', 'ghost', 1],
  ['Zombie', 1.3, 'Undead. Slow, but almost impossible to keep down.', 'zombie', 0],
  ['Skeleton', 1.3, 'Just bones. Can\'t feel pain at all.', 'skeleton', 0],
  ['Medusa', 1.3, 'Snakes for hair. Your stare turns people to stone.', 'medusa', 2],
  ['Cyclops', 1.3, 'A one-eyed giant. Huge strength.', 'cyclops', 1],
  ['Minotaur', 1.3, 'Half bull, half human. Charges through anything.', 'minotaur', 1],
  ['Centaur', 1.3, 'Half horse, half human. Fast and great with bows.', 'centaur', 1],
  ['Fairy', 1.5, 'Tiny with wings. Full of magic and tricks.', 'fairy', 1],
  ['Dark Elf', 2.4, 'Elf of the shadows. Magic and stealth.', 'darkelf', 1],
  ['Elf', 3.6, 'Long life, pointy ears, great with magic and bows.', 'elf', 1],
  ['Ogre', 3.6, 'A huge, strong brute. Not very smart.', 'ogre', 1],
  ['Orc', 3.6, 'A strong green warrior built for battle.', 'orc', 1],
  ['Dwarf', 3.6, 'Short, tough, master smiths and miners.', 'dwarf', 0],
  ['Hobbit', 3.6, 'Small and peaceful. Lucky and sneaky.', 'hobbit', 0],
  ['Gnome', 3.6, 'Small, clever inventors.', 'gnome', 0],
  ['Goblin', 3.6, 'Small, sneaky and greedy. Weak alone, strong in groups.', 'goblin', 0]
];

// Extra wheels that only show up for some races. Each: { q, slices: [label, weight, what it does, boost] }
export const RACE_EXTRAS = {
  Shinigami: [
    { id: 'zanpakuto', q: 'What is the zanpakutō?', slices: [
      ['None', 14, 'No zanpakutō. You fight with your bare hands.', 0],
      ['Ryūjin Jakka — fire katana', 0.6, 'The strongest fire sword. Flames that turn everything to ash.', 3],
      ['Zangetsu — large black blade', 1, 'A huge cleaver sword. Huge slashes of spirit energy.', 2],
      ['Senbonzakura — standard katana', 1.2, 'Splits into thousands of cherry blossom blades.', 2],
      ['Hyōrinmaru — katana with chain', 1.2, 'An ice dragon of frost and water.', 2],
      ['Kyōka Suigetsu — standard katana', 0.8, 'Total illusion. People see what you want them to see.', 2],
      ['Sode no Shirayuki — white katana', 1.2, 'The most beautiful ice sword. Freezes all around you.', 1],
      ['Benihime — katana', 1.2, 'Crimson blasts, shields and nets of blood-red energy.', 1],
      ['Haineko — katana', 1.2, 'Blade turns to ash that cuts anything it touches.', 1],
      ['Kazeshini — double-bladed kama', 1.2, 'Two spinning scythes on a chain.', 1],
      ['Suzumebachi — short, needle-like blade', 1.2, 'A stinger. Hit the same spot twice and they die.', 1],
      ['Wabisuke — unusually shaped', 1.2, 'Every hit doubles the weight of what it touches.', 1],
      ['Nozarashi — large, rugged', 1, 'A giant blade that cuts through anything.', 2],
      ['Ashisogi Jizō — distinctive', 1.2, 'Paralyzes everything it cuts.', 1],
      ['Minazuki — katana', 1.2, 'A healing manta ray that fixes wounds.', 1],
      ['Katen Kyōkotsu — paired swords', 1, 'Two swords that turn kids\' games into deadly rules.', 2],
      ['Sakanade — katana', 1.2, 'Flips everyone\'s senses: left is right, up is down.', 1],
      ['Hōzukimaru — spear-like', 1.2, 'A spear that splits into three pieces.', 1],
      ['Shinsō — short blade', 1, 'Stretches insanely far, insanely fast.', 2],
      ['Tobiume — katana', 1.2, 'Shoots fireballs.', 1]
    ]},
    { id: 'shikai', q: 'Do you have shikai?', slices: [['Yes', 6, 'You unlocked your sword\'s first release. Big power-up.', 1], ['No', 4, 'Your sword stays sealed.', 0]] },
    { id: 'bankai', q: 'Do you have bankai?', needs: { shikai: 'Yes' }, slices: [['Yes', 4, 'Final release. Your power jumps massively.', 2], ['No', 6, 'No bankai yet.', 0]] },
    { id: 'reiatsu', q: 'What\'s your Spiritual Pressure?', slices: [
      ['Ordinary Human', 3, 'Basically none. You can barely see spirits.', 0], ['Spirit-Aware Human', 3, 'You can see and feel spirits.', 0],
      ['Academy Student', 3, 'Student level. Still learning.', 0], ['Seated Officer', 3, 'A ranked soul reaper.', 0],
      ['Lieutenant', 2.6, 'Second in command of a squad.', 1], ['Elite Lieutenant', 2, 'One of the strongest lieutenants.', 1],
      ['Captain', 1.8, 'Leader of a whole squad.', 1], ['Elite Captain', 1.4, 'One of the strongest captains.', 2],
      ['Top Captain', 1, 'Among the top captains ever.', 2], ['Transcendent Captain', 0.7, 'Way beyond captain level.', 3],
      ['Royal Guard', 0.6, 'Guards the Soul King himself.', 3], ['Elite Royal Guard', 0.4, 'The best of the royal guard.', 3],
      ['Realm-Shaking', 0.3, 'Your pressure shakes the whole realm.', 4], ['Godlike Reiatsu', 0.2, 'Godlike spiritual pressure.', 4],
      ['Soul King Level', 0.1, 'The power of the Soul King.', 5]
    ]}
  ],
  Quincy: [
    { id: 'schrift', q: 'What\'s your Schrift?', slices: [
      ['None', 10, 'No special letter power.', 0], ['A — The Antithesis', 1, 'Swap what happened between two things.', 2],
      ['B — The Balance', 1, 'Spreads bad luck around equally.', 1], ['D — The Deathdealing', 1, 'Learn any attack you see, then dodge it forever.', 2],
      ['E — The Explode', 1, 'Make anything you touch blow up.', 1], ['F — The Fear', 1, 'Fill enemies with terror.', 1],
      ['G — The Glutton', 1, 'Eat things to steal their power.', 1], ['H — The Heat', 1, 'Burning hot spirit power.', 1],
      ['I — The Iron', 1, 'Your skin becomes iron.', 1], ['L — The Love', 1, 'Make enemies fall in love with you so they can\'t fight.', 1],
      ['M — The Miracle', 1, 'The more hurt you are, the stronger you get.', 2], ['P — The Power', 1, 'Giant-level raw strength.', 1],
      ['S — The Superstar', 1, 'Fans make you stronger.', 1], ['T — The Thunderbolt', 1, 'Lightning spirit arrows.', 1],
      ['U — The Underbelly', 1, 'Swim through the ground and shadows.', 1], ['V — The Visionary', 0.5, 'Wake up after your enemy\'s attack is already over.', 3],
      ['A — The Almighty', 0.3, 'See and change every possible future.', 5]
    ]},
    { id: 'reiatsu', ref: 'Shinigami.reiatsu' }
  ],
  Arrancar: [
    { id: 'resurreccion', q: 'What\'s the resurrection?', slices: [
      ['None', 6, 'Your release is sealed.', 0], ['Panther — claws and speed', 1.6, 'You turn into a panther warrior.', 1],
      ['Bat — wings and darkness', 1.6, 'Black bat wings and lances of light.', 2], ['Wolf Pack', 1.4, 'You split into a pack of wolves.', 2],
      ['Skeleton King', 1.2, 'Everything you touch rots and ages to dust.', 2], ['Moth — giant wings', 1.4, 'Huge wings that shoot energy.', 1],
      ['Shark — water blades', 1.4, 'Water and shark power.', 1], ['Mantis — four arms', 1.4, 'Four arms, four blades.', 1],
      ['Crown of Thorns', 1, 'Your release copies others.', 1], ['Hollow Sun', 0.7, 'A second release. Pure destruction.', 3]
    ]},
    { id: 'espada', q: 'What\'s your Espada rank?', slices: [
      ['Not an Espada', 8, 'A regular arrancar.', 0], ['10', 1, 'Rank 10 Espada.', 1], ['9', 1, 'Rank 9 Espada.', 1], ['8', 1, 'Rank 8 Espada.', 1],
      ['7', 1, 'Rank 7 Espada.', 1], ['6', 1, 'Rank 6 Espada.', 1], ['5', 1, 'Rank 5 Espada.', 2], ['4', 0.9, 'Rank 4 Espada.', 2],
      ['3', 0.8, 'Rank 3 Espada.', 2], ['2', 0.7, 'Rank 2 Espada.', 3], ['1', 0.5, 'Rank 1. The strongest Espada.', 3], ['0', 0.3, 'The secret rank 0.', 4]
    ]}
  ],
  Hollow: [{ id: 'resurreccion', ref: 'Arrancar.resurreccion' }],
  Saiyan: [
    { id: 'saiyan_form', q: 'What\'s your strongest Saiyan form?', slices: [
      ['Base Form', 8, 'No transformation yet.', 0], ['Great Ape', 4, 'Turn into a giant ape under the full moon.', 1],
      ['Super Saiyan', 5, 'Golden hair. Power x50.', 1], ['Super Saiyan 2', 3.5, 'Lightning around you. Stronger again.', 2],
      ['Super Saiyan 3', 2.6, 'Long hair, no eyebrows, huge power.', 2], ['Super Saiyan 4', 1.6, 'Red fur and a tail. Wild power.', 3],
      ['Super Saiyan God', 1.4, 'Red hair, god ki.', 3], ['Super Saiyan Blue', 1, 'Blue hair, god ki under control.', 3],
      ['Legendary Super Saiyan', 0.8, 'Endless rage power. Gets stronger forever.', 4], ['Ultra Instinct', 0.5, 'Your body dodges and attacks by itself.', 4],
      ['Ultra Ego', 0.4, 'Destroyer power. The more you get hit, the stronger you get.', 4]
    ]}
  ],
  Devil: [
    { id: 'demon_army', q: 'Do you have an army ( demons )', slices: [['Yes', 6, 'Demons answer to you.', 0], ['No', 4, 'You walk alone.', 0]] },
    { id: 'demon_count', q: 'How many demons are in your army?', needs: { demon_army: 'Yes' }, slices: [
      ['10–100', 5, 'A small demon squad.', 0], ['100–1,000', 5, 'A real demon army.', 0], ['1,000–10,000', 4, 'A huge army.', 0],
      ['10,000–100,000', 3, 'An endless army of demons.', 1], ['100,000+', 1.5, 'Hell itself marches with you.', 1]
    ]},
    { id: 'demon_power', q: 'What\'s your army\'s overall powerscale?', needs: { demon_army: 'Yes' }, ref: 'Loop.powerscale' },
    { id: 'hell_rank', q: 'What\'s your rank in Hell?', slices: [
      ['Imp', 5, 'The lowest rank. Everybody bosses you.', 0], ['Lesser Devil', 5, 'A normal devil.', 0], ['Greater Devil', 4, 'A feared devil.', 1],
      ['Duke of Hell', 3, 'You rule a part of hell.', 1], ['Prince of Hell', 2, 'Royal blood of hell.', 2], ['King of Hell', 1, 'You rule all of hell.', 3],
      ['Lucifer Level', 0.4, 'The first and strongest devil.', 4]
    ]}
  ],
  God: [
    { id: 'god_type', q: 'What type of god?', slices: [
      ['God of War', 1, 'Battle is your domain. You never lose your nerve.', 1], ['God of Death', 1, 'You decide when things die.', 2],
      ['God of Time', 0.7, 'Time bends for you.', 3], ['God of Space', 0.7, 'Space folds for you.', 3], ['God of Thunder', 1, 'Lightning answers your call.', 1],
      ['God of the Sun', 1, 'The sun\'s power is yours.', 2], ['God of the Sea', 1, 'Every ocean obeys you.', 1], ['God of Chaos', 0.8, 'Pure chaos. Nothing goes as planned near you.', 2],
      ['God of Creation', 0.5, 'You create anything from nothing.', 4], ['God of Destruction', 0.6, 'You erase anything from existence.', 4],
      ['God of Wisdom', 1, 'You know the answer to almost everything.', 1], ['God of Fire', 1, 'Fire of the heavens.', 1], ['God of Darkness', 1, 'Shadows are yours.', 2],
      ['God of Light', 1, 'Holy light is yours.', 2], ['God of Dreams', 1, 'You walk in dreams and control them.', 1], ['God of the Moon', 1, 'Night and the moon obey you.', 1],
      ['God of Nature', 1, 'All life and plants obey you.', 1], ['God of Luck', 0.8, 'Luck itself. Your luck turns to Blessed.', 1]
    ]},
    { id: 'divine_power', q: 'What is the divine power?', slices: [
      ['Smite', 2, 'Strike anyone down from the sky.', 1], ['Immortality', 1.6, 'You can\'t die of age or wounds.', 2], ['Resurrection', 1.2, 'Bring the dead back to life.', 1],
      ['Divine Judgment', 1.2, 'Judge someone and punish them instantly.', 2], ['Blessing', 2, 'Make your allies way stronger.', 1], ['Curse', 2, 'Put god-level curses on enemies.', 1],
      ['Creation', 0.7, 'Make anything appear.', 3], ['Omnipresence', 0.5, 'Be everywhere at once.', 3], ['Miracles', 1.4, 'Make the impossible happen once a day.', 2],
      ['Worship Power', 1.4, 'The more people believe in you, the stronger you get.', 2]
    ]}
  ],
  Angel: [
    { id: 'angel_rank', q: 'What\'s your angel rank?', slices: [
      ['Angel', 5, 'A normal angel.', 0], ['Archangel', 4, 'A warrior angel.', 1], ['Principality', 3, 'You guard nations.', 1], ['Power', 3, 'You fight demons for heaven.', 1],
      ['Virtue', 2.5, 'You perform miracles.', 1], ['Dominion', 2, 'You command other angels.', 2], ['Throne', 1.4, 'You carry the judgment of heaven.', 2],
      ['Cherubim', 1, 'Guardian of heaven\'s gates.', 3], ['Seraphim', 0.6, 'Six-winged. The highest angels.', 4]
    ]}
  ],
  Vampire: [
    { id: 'bloodline', q: 'What\'s your bloodline?', slices: [
      ['Fledgling', 5, 'Just turned. Weak and hungry.', 0], ['Turned', 5, 'A normal vampire.', 0], ['Noble', 3, 'Old vampire family. Powerful.', 1],
      ['Pureblood', 2, 'Born a vampire. Very powerful.', 2], ['Daywalker', 1.4, 'The sun can\'t hurt you.', 1], ['Ancient', 1, 'One of the first vampires.', 3], ['Progenitor', 0.4, 'The very first vampire. All others came from you.', 4]
    ]}
  ],
  Dragon: [
    { id: 'dragon_breed', q: 'What kind of dragon?', slices: [
      ['Fire Dragon', 4, 'Breathes fire.', 0], ['Ice Dragon', 3, 'Freezing breath.', 0], ['Lightning Dragon', 3, 'Breathes lightning.', 1], ['Earth Dragon', 3, 'Armored with rock.', 0],
      ['Shadow Dragon', 2, 'A dragon of darkness.', 1], ['Light Dragon', 2, 'A holy dragon.', 1], ['Poison Dragon', 2, 'Toxic breath.', 0], ['Gold Dragon', 1.5, 'A royal golden dragon.', 1],
      ['Void Dragon', 0.8, 'Breath that erases things.', 2], ['Cosmic Dragon', 0.5, 'Big enough to swallow planets.', 3]
    ]}
  ],
  Kryptonian: [
    { id: 'sun', q: 'What sun did you grow up under?', slices: [
      ['Red Sun', 2, 'Red sun = almost no powers.', -2], ['Yellow Sun', 7, 'Full Kryptonian powers.', 0], ['White Sun', 2, 'Extra charged.', 1], ['Blue Sun', 1, 'Super charged. Way stronger.', 2]
    ]}
  ],
  Mutant: [
    { id: 'mutation', q: 'What level is your mutation?', slices: [
      ['Delta Level', 5, 'A small mutation.', 0], ['Gamma Level', 4, 'A useful mutation.', 0], ['Beta Level', 3, 'A strong mutation.', 1], ['Alpha Level', 2, 'A dangerous mutation.', 1], ['Omega Level', 0.7, 'One of the most powerful mutants alive.', 3]
    ]}
  ],
  'Ōtsutsuki': [
    { id: 'eyes', q: 'What eyes do you have?', slices: [
      ['Byakugan', 4, 'See through walls and see chakra points.', 1], ['Rinnegan', 2, 'Control gravity, summon, absorb attacks.', 2],
      ['Tenseigan', 1.5, 'Gravity and planet-level beams.', 2], ['Jōgan', 1.5, 'See into other dimensions.', 1], ['Rinne Sharingan', 0.6, 'The god eye. Control the whole world.', 3], ['None', 4, 'Your eyes are normal.', 0]
    ]}
  ],
  Werewolf: [
    { id: 'wolf_form', q: 'What\'s your wolf form?', slices: [
      ['Half Wolf', 4, 'Claws, fangs and ears.', 0], ['Full Wolf', 4, 'A giant wolf.', 0], ['Alpha', 2, 'Leader of the pack. Stronger.', 1], ['Lycan Lord', 1, 'The king of all werewolves.', 2]
    ]}
  ],
  Viltrumite: [
    { id: 'viltrum_blood', q: 'What\'s your bloodline?', slices: [
      ['Regular Viltrumite', 6, 'A normal Viltrumite.', 0], ['Pureblood', 3, 'Stronger than most.', 1], ['Royal Bloodline', 1, 'The emperor\'s blood.', 2]
    ]}
  ],
  Golem: [
    { id: 'golem_body', q: 'What are you made of?', slices: [
      ['Stone', 5, 'Tough stone body.', 0], ['Iron', 4, 'Iron body.', 1], ['Crystal', 3, 'Shiny crystal body.', 0], ['Lava', 2, 'Burning lava body.', 1],
      ['Ice', 2, 'Frozen body.', 0], ['Gold', 1.5, 'Golden body.', 0], ['Diamond', 1, 'Diamond body. Almost unbreakable.', 2]
    ]}
  ],
  Phoenix: [
    { id: 'rebirths', q: 'How many rebirths?', slices: [
      ['1', 5, 'One rebirth. Death sets you back once.', 0], ['3', 3, 'Three rebirths.', 0], ['9', 2, 'Nine lives.', 1], ['Infinite', 0.6, 'You always come back.', 2]
    ]}
  ],
  Titan: [
    { id: 'titan_size', q: 'How big is your titan form?', slices: [
      ['House Sized', 4, 'As tall as a house.', 0], ['Skyscraper Sized', 3, 'Taller than skyscrapers.', 1], ['Mountain Sized', 2, 'Tall as a mountain.', 1], ['Planet Sized', 0.6, 'Big enough to hold a planet.', 3]
    ]}
  ],
  Namekian: [
    { id: 'clan', q: 'What\'s your clan?', slices: [['Warrior Clan', 5, 'Born to fight.', 1], ['Dragon Clan', 3, 'You can make wish dragons and heal.', 0], ['Super Namekian', 1, 'A legendary Namekian.', 2]] }
  ],
  Symbiote: [
    { id: 'symbiote_color', q: 'What color is your symbiote?', slices: [
      ['Black', 5, 'The classic. Strong and wild.', 0], ['Red', 3, 'The most violent kind.', 1], ['Purple', 2, 'Sneaky and smart.', 0], ['Gold', 1, 'A god-hunting symbiote.', 2], ['White', 1, 'Rare and super strong.', 1]
    ]}
  ]
};
