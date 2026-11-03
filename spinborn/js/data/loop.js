// SPINBORN: every side wheel behind "What do you do now?" (his wheels word for word + the ones he never showed).
// Slice = [label, weight, what it does, extra]

export const MONSTERS = [
  ['Fenrir', 1, 'A giant wolf that eats gods.', 14], ['Cerberus', 1, 'The three-headed dog of hell.', 11], ['Chimera', 1, 'Lion, goat and snake in one beast.', 9],
  ['Manticore', 1, 'Lion body, scorpion tail, human face.', 8], ['Cockatrice', 1, 'A rooster-dragon. Its look turns you to stone.', 7],
  ['Basilisk', 1, 'King of snakes. One look can kill.', 10], ['Kraken', 1, 'A giant squid that sinks fleets.', 11], ['Hydra', 1, 'Cut one head, two grow back.', 10],
  ['Minotaur', 1, 'Half bull, half man, all rage.', 6], ['Cyclops', 1, 'A one-eyed giant.', 7], ['Troll', 1, 'Big, smelly, regenerates.', 5],
  ['Ogre', 1, 'A huge brute with a club.', 4], ['Goblin', 1, 'A tiny sneaky goblin. Easy... probably.', 1], ['Kaiju', 1, 'A city-stomping giant monster.', 12],
  ['Titan', 1, 'A giant from the age of gods.', 13], ['Dragon', 1, 'A real dragon. Fire, scales, wings.', 12], ['Balrog', 1, 'A demon of shadow and flame.', 13],
  ['Leviathan', 1, 'A sea monster the size of an island.', 14], ['Behemoth', 1, 'A land monster that shakes the earth.', 13], ['Sea Serpent', 1, 'A giant snake of the sea.', 9],
  ['Wyvern', 1, 'A fast two-legged dragon.', 8], ['Griffin', 1, 'Eagle head and wings, lion body.', 7]
];

export const QUESTS = [
  ['Protect a Village', 1, 'Monsters are coming for a village. Stop them.', 'safe'], ['Find a Lost Artifact', 1, 'Find something ancient and powerful.', 'safe'],
  ['Rescue a Prisoner', 1, 'Break someone out of a prison.', 'safe'], ['Defeat a Monster', 1, 'Kill a monster terrorizing people.', 'danger'],
  ['Prevent the End of the World', 1, 'The world is about to end. Fix it.', 'deadly'], ['Conquer a Realm', 1, 'Take over a whole realm.', 'deadly'],
  ['Kill a God', 1, 'Kill an actual god.', 'deadly'], ['Save a Kingdom', 1, 'A kingdom is falling. Save it.', 'danger'],
  ['Destroy a Powerful Artifact', 1, 'Destroy something too dangerous to exist.', 'danger'], ['Stop an Invasion', 1, 'An army is invading. Push them back.', 'deadly'],
  ['Survive a Deadly Realm', 1, 'Get into a realm nobody comes back from. Get out.', 'deadly'], ['Recover a Lost Treasure', 1, 'Find a treasure lost for ages.', 'safe'],
  ['Find a Hidden City', 1, 'Find a city hidden from the world.', 'safe'], ['Capture a Criminal', 1, 'Catch a wanted criminal.', 'safe'],
  ['Defeat a Villain', 1, 'Beat a powerful villain.', 'danger'], ['Clear a Dungeon', 1, 'Fight through a dungeon to the bottom.', 'dungeon'],
  ['Explore Ancient Ruins', 1, 'Explore ruins full of traps.', 'safe'], ['Escort a Royal', 1, 'Keep a royal safe on a long trip.', 'safe'],
  ['Retrieve a Cursed Item', 1, 'Get back a cursed item without touching it.', 'danger'], ['Hunt a Legendary Beast', 1, 'Hunt the strongest beast alive.', 'deadly']
];

// Rewards. Dungeon rewards only after "Clear a Dungeon" (his video showed them after other quests too = fixed).
export const REWARDS_DUNGEON = [
  ['Massive Treasure Hoard — Gold, gems, and ancient valuables.', 1, 'You are rich now.', 'gold'],
  ['Legendary Weapon — A weapon forged inside the dungeon.', 1, 'Spin for the legendary weapon.', 'legend'],
  ['Powerful Artifact — A mysterious artifact with a unique ability.', 1, 'Spin for the artifact\'s power.', 'artifact'],
  ['Evolution Stone — Can trigger a powerful evolution.', 1, 'Spin "What improves?" twice.', 'evolve'],
  ['Ancient Grimoire — Contains forbidden techniques and spells.', 1, 'Learn a new spell.', 'spell'],
  ['Rare Materials — Valuable monster cores and magical resources.', 1, 'Rare stuff to make gear.', 'gold'],
  ['Dungeon Core — Allows them to claim ownership of the dungeon.', 1, 'You own the dungeon now. It\'s your base.', 'dungeon'],
  ['Regeneration Potion — Can heal even severe injuries.', 1, 'Heals you once from almost dying.', 'potion'],
  ['Royal Reward — The kingdom pays them a huge bounty.', 1, 'A big pile of gold from the king.', 'gold'],
  ['Cosmic Relic — An extremely rare relic hidden beneath the dungeon.', 0.6, 'Spin for the artifact\'s power (top slices only).', 'artifact+']
];
export const REWARDS = [
  ['Godly Artifact — A rare artifact granting a supernatural power.', 0.8, 'Spin for the artifact\'s power.', 'artifact'],
  ['Legendary Weapon — A weapon of legend.', 1, 'Spin for the legendary weapon.', 'legend'],
  ['Ancient Grimoire — Unlocks powerful spells and forbidden magic.', 1, 'Learn a new spell.', 'spell'],
  ['Divine Armor — Armor with extraordinary defensive properties.', 1, 'Spin for your armor.', 'armor'],
  ['Regeneration Potion — Heals even severe injuries.', 1, 'Heals you once from almost dying.', 'potion'],
  ['Royal Title — Grants nobility, authority, and land.', 1, 'You are a noble now. You get land.', 'title'],
  ['Treasure Hoard — An enormous amount of gold and precious gems.', 1.2, 'You are rich now.', 'gold'],
  ['Evolution Stone — Can trigger a powerful evolution.', 0.8, 'Spin "What improves?" twice.', 'evolve'],
  ['A Loyal Follower — Someone you saved follows you.', 1, 'Spin for your follower.', 'follower'],
  ['Nothing — They thank you and that\'s it.', 1, 'No reward. Classic.', 'none']
];

export const LEGEND_WEAPONS = [
  ['1. Voidbreaker — Cuts through space, dimensions, and barriers.', 1, 'A sword that cuts through anything, even dimensions.'],
  ['2. Solaris — A sword containing the power of a star.', 1, 'A star lives inside this sword.'],
  ['3. Heaven\'s Wrath — Summons devastating divine lightning.', 1, 'Calls lightning from heaven.'],
  ['4. Eclipse Fang — Absorbs light and spiritual attacks.', 1, 'Eats light and spirit attacks.'],
  ['5. Soulreaper — Can sever the soul from the body.', 1, 'Cuts the soul out of a body.'],
  ['6. Reality Edge — Slices through reality itself.', 1, 'Cuts reality open.'],
  ['7. Chronoblade — Controls and cuts through time.', 1, 'Cuts time itself.'],
  ['8. Godfire — Burns anything, including magical and divine beings.', 1, 'Fire that burns even gods.'],
  ['9. Infinity Spear — Creates infinite-length strikes and pierces dimensions.', 1, 'Its stab never ends.'],
  ['10. Divine Executioner — A god-forged weapon capable of killing immortal beings.', 1, 'Kills things that can\'t die.']
];

export const ARTIFACT_POWERS = [
  ['Soul Crown — Grants control over souls and spiritual energy.', 1, 'Control souls.'],
  ['Aegis of Eternity — Provides extraordinary defense against supernatural attacks.', 1, '+2 durability tiers against powers.'],
  ['Omniscient Eye — Reveals hidden truths and observes distant events.', 1, 'See anything anywhere.'],
  ['Gauntlet of Titans — Greatly amplifies physical strength.', 1, '+2 strength tiers.'],
  ['Void Heart — Grants control over void energy and spatial erasure.', 0.8, 'Erase space around you.'],
  ['Chrono Core — Grants time manipulation.', 0.8, 'Control time.'],
  ['Reality Shard — Manipulates reality within a limited area.', 0.7, 'Change reality around you.'],
  ['Artifact of Evolution — Evolves its user\'s abilities over time.', 1, 'Your stats slowly go up.'],
  ['Godfire Core — Grants control over divine flames.', 1, 'God fire is yours.'],
  ['Dimensional Key — Opens portals to other dimensions.', 1, 'Open portals anywhere.']
];

export const INVENT = [['Armor', 1, 'You build armor.'], ['Weapon', 1, 'You build a weapon.'], ['Medicine', 1, 'You make medicine.'], ['Spell', 1, 'You make a new spell.'],
  ['Armor', 1, 'You build armor.'], ['Weapon', 1, 'You build a weapon.'], ['Medicine', 1, 'You make medicine.'], ['Spell', 1, 'You make a new spell.']];

export const ARMORS = [
  ['Iron Armor', 1, 'Solid iron. +1 durability tier.', 1], ['Steel Armor', 1, 'Strong steel. +1 durability tier.', 1], ['Enchanted Armor', 1, 'Magic armor. +1 tier, resists spells.', 1],
  ['Dragon Armor', 1, 'Made of dragon scales. +2 tiers, fireproof.', 2], ['Demon Armor', 1, 'Dark armor from hell. +2 tiers.', 2], ['Celestial Armor', 1, 'Armor of the stars. +2 tiers.', 2],
  ['Divine Armor', 1, 'Armor of the gods. +3 tiers.', 3], ['Cursed Armor', 1, 'Strong but cursed. +2 tiers, gives a weakness.', 2], ['Spirit Armor', 1, 'Made of spirit energy. +1 tier.', 1],
  ['Elemental Armor', 1, 'Matches your element. +1 tier.', 1], ['Regenerative Armor', 1, 'Repairs itself. +1 tier, you heal faster.', 1], ['Energy Armor', 1, 'A suit of pure energy. +2 tiers.', 2],
  ['Void Armor', 1, 'Attacks vanish into it. +3 tiers.', 3], ['Anti-Magic Armor', 1, 'Powers barely hurt you. +2 tiers vs powers.', 2], ['Adaptive Armor', 1, 'Adapts to what hits it. +2 tiers.', 2],
  ['Dimensional Armor', 1, 'Exists in many dimensions. +3 tiers.', 3], ['Cosmic Armor', 0.7, 'Made of the cosmos. +4 tiers.', 4]
];

export const MEDICINES = [
  ['Regeneration Serum — rapidly heals wounds', 1, 'You heal super fast.'], ['Cosmic Serum — temporarily amplifies supernatural abilities', 1, 'Your powers get way stronger for a while.'],
  ['Mutation Serum — causes controlled biological changes', 1, 'Spin "What improves?".'], ['Energy Serum — restores supernatural energy/stamina', 1, 'Your energy refills.'],
  ['Divine Cure — cures deadly curses', 1, 'Removes one weakness.'], ['Antidote — neutralizes poisons and toxins', 1, 'Poison can\'t hurt you.'],
  ['Healing Potion — restores severe injuries', 1, 'Heals you once from almost dying.'], ['Immortality Serum — dramatically extends lifespan', 1, 'You will live a very long time.'],
  ['Durability Serum — strengthens the body\'s resistance to damage', 1, 'Spin durability again.'], ['Intelligence Serum — enhances mental processing and memory', 1, 'Spin IQ again.'],
  ['Speed Serum — temporarily increases reaction and movement speed', 1, 'Spin speed again.'], ['Strength Serum — temporarily increases physical strength', 1, 'Spin strength again.']
];

export const SPELLS = [
  ['Teleportation', 1, 'Teleport a short distance.'], ['Regeneration', 1, 'Heal over time.'], ['Healing', 1, 'Heal yourself or allies.'], ['Earth Wall', 1, 'Raise a wall of rock.'],
  ['Wind Blade', 1, 'Throw a blade of wind.'], ['Lightning Strike', 1, 'Call down lightning.'], ['Ice Blast', 1, 'Blast of ice.'], ['Fireball', 1, 'Throw a fireball.'],
  ['Reality Warping', 0.6, 'Bend reality a little.'], ['Dimensional Rift', 0.8, 'Tear open a rift.'], ['Space Manipulation', 0.8, 'Fold space.'], ['Weather Control', 1, 'Change the weather.'],
  ['Curses', 1, 'Curse an enemy.'], ['Sealing', 1, 'Seal an enemy\'s power.'], ['Binding Chains', 1, 'Chains of light hold enemies.'], ['Summoning', 1, 'Summon a creature.'],
  ['Energy Absorption', 1, 'Absorb an attack.'], ['Life Drain', 1, 'Steal life.'], ['Soul Manipulation', 0.8, 'Touch souls.'], ['Illusion', 1, 'Make fake images.'],
  ['Mind Control', 0.8, 'Control a mind.'], ['Time Stop', 0.5, 'Stop time for a moment.'], ['Time Slow', 0.8, 'Slow time.'], ['Gravity Manipulation', 0.8, 'Bend gravity.'],
  ['Force Field', 1, 'Make a shield.'], ['Invisibility', 1, 'Turn invisible.']
];

export const SKILLS = [
  ['Swordsmanship', 1, 'Better with swords.'], ['Archery', 1, 'Better with bows.'], ['Stealth', 1, 'Move without being seen.'], ['Flight', 0.6, 'You learn to fly.'],
  ['Healing Hands', 1, 'Heal small wounds.'], ['Sensing', 1, 'Feel how strong people are.'], ['Speed Blitz', 1, 'Burst of speed.'], ['Blacksmithing', 1, 'Make your own weapons.'],
  ['Cooking', 1, 'Cook food that heals.'], ['Tracking', 1, 'Track anyone.'], ['Leadership', 1, 'Followers fight harder.'], ['Beast Taming', 1, 'Beasts trust you.'],
  ['Pressure Points', 1, 'Hit weak spots.'], ['Meditation', 1, 'Calm and focused. Regain energy.'], ['Dual Wielding', 1, 'Use two weapons.'], ['Parkour', 1, 'Climb and jump anywhere.'],
  ['Counterattack', 1, 'Hit back when they hit you.'], ['Iron Body', 1, 'Harden your body. +1 durability tier.'], ['Endurance', 1, 'Fight for days.'], ['Lockpicking', 1, 'Open any lock.'],
  ['Disguise', 1, 'Look like someone else.'], ['Strategy', 1, 'Plan battles perfectly.'], ['Energy Control', 1, 'Better power control.'], ['Barrier Breaking', 1, 'Break shields.']
];

export const FOLLOWERS = [
  ['Thieves', 1, 'Sneaky thieves.', 3], ['Alchemists', 1, 'Potion makers.', 3], ['Blacksmiths', 1, 'They make your gear.', 3], ['Healers', 1, 'They heal you.', 3],
  ['Archers', 1, 'Long range fighters.', 4], ['Assassins', 1, 'Silent killers.', 5], ['Mages', 1, 'Magic users.', 5], ['Adventurers', 1, 'Brave explorers.', 4],
  ['Mercenaries', 1, 'Fighters for hire.', 4], ['Human Warriors', 1, 'Trained soldiers.', 4], ['Symbiotes', 1, 'Living alien goo.', 7], ['Kree', 1, 'Alien warriors.', 7],
  ['Atlanteans', 1, 'Sea warriors.', 7], ['Asgardians', 1, 'Norse god warriors.', 9], ['Saiyans', 1, 'Alien warriors.', 9], ['Shinigami', 1, 'Soul reapers.', 8],
  ['Cursed Spirits', 1, 'Dark spirits.', 6], ['Dragons', 1, 'Actual dragons.', 10], ['Dwarves', 1, 'Tough smiths.', 4], ['Elves', 1, 'Magic archers.', 5],
  ['Goblins', 1, 'Small and many.', 2], ['Orcs', 1, 'Brutal warriors.', 4], ['Werewolves', 1, 'Wolf beasts.', 5], ['Vampires', 1, 'Blood drinkers.', 6],
  ['Spirit Users', 1, 'Spirit fighters.', 6], ['Demon Worshippers', 1, 'A dark cult.', 3], ['Monster Hunters', 1, 'Monster killers.', 5], ['Beast Tamers', 1, 'They bring beasts.', 5],
  ['Priests', 1, 'Holy healers.', 3], ['Knights', 1, 'Armored warriors.', 5]
];

export const FOLLOWER_COUNT = [
  ['1', 2, 'Just one.', 1], ['1–10', 4, 'A small group.', 10], ['10–100', 4, 'A real crew.', 100], ['100–1,000', 3, 'A small army.', 1000],
  ['1,000–10,000', 2, 'A big army.', 10000], ['10,000–100,000', 1, 'A massive army.', 100000]
];

export const POWERSCALE = [
  ['1. Building Level — Can destroy buildings.', 4, '', 5], ['2. City Level — Can destroy cities.', 4, '', 6], ['3. Mountain Level — Can destroy mountains.', 3.6, '', 7],
  ['4. Island Level — Can destroy islands.', 3.2, '', 8], ['5. Planetary Level — Can destroy planets.', 2.6, '', 12], ['6. Star Level — Can destroy stars.', 2.2, '', 13],
  ['7. Solar-System Level — Can destroy entire solar systems.', 1.8, '', 14], ['8. Galaxy Level — Can destroy galaxies.', 1.4, '', 15],
  ['9. Universal Level — Can destroy or affect an entire universe.', 1, '', 16], ['10. Multiversal Level — Can affect or destroy multiple universes.', 0.7, '', 17],
  ['11. Complex Multiversal — Can affect infinite universes.', 0.5, '', 17], ['12. Hyperversal — Can affect vast hierarchies of higher dimensions.', 0.4, '', 18],
  ['13. Outerversal — Exists beyond conventional dimensional structures.', 0.25, '', 19], ['14. Boundless — Transcends all.', 0.15, '', 19]
];

export const ORG_KINDS = [
  ['Villain Organization', 1, 'Evil group. Heroes will come for you.'], ['Hero Organization', 1, 'Heroes who protect people.'], ['Adventurer Guild', 1, 'A guild of adventurers.'],
  ['Pirate Crew', 1, 'Pirates of the sea.'], ['Assassin Guild', 1, 'Hidden killers.'], ['Military', 1, 'Your own army.'], ['Mercenary Group', 1, 'Fighters for hire.'],
  ['Secret Society', 1, 'A secret group in the shadows.'], ['Cosmic Organization', 1, 'A group across the stars.'], ['Interdimensional Organization', 1, 'A group across dimensions.'],
  ['Royal Guard', 1, 'Guards of a kingdom.'], ['Rebel Army', 1, 'Rebels fighting the rulers.'], ['Criminal Syndicate', 1, 'Organized crime.'],
  ['Scientific Institute', 1, 'Scientists and inventors.'], ['Religious Order', 1, 'A holy order.'], ['Monster Clan', 1, 'A clan of monsters.'], ['Mage Order', 1, 'An order of wizards.']
];
export const ORG_SIZE = [['Small — 10–50 members', 3, 'A small group.', 50], ['Medium — 50–500', 3, 'A medium group.', 500], ['Large — 500–10,000', 2.5, 'A large group.', 10000], ['Massive — 10,000+', 1.5, 'A massive group.', 50000]];

export const MERC_ROLES = [
  ['Assassin', 1, 'You kill targets.'], ['Bodyguard', 1, 'You protect someone.'], ['Bounty Hunter', 1, 'You hunt wanted people.'], ['Monster Slayer', 1, 'You kill monsters for money.'],
  ['Spy', 1, 'You steal secrets.'], ['Hired Soldier', 1, 'You fight in wars for pay.'], ['Thief for Hire', 1, 'You steal for clients.'], ['Duelist', 1, 'You fight duels for others.']
];
export const MERC_CLIENTS = [
  ['A King', 1, 'A king hires you.'], ['A Crime Boss', 1, 'A crime boss hires you.'], ['A God', 0.6, 'An actual god hires you.'], ['A Rebel Army', 1, 'Rebels hire you.'],
  ['A Rich Merchant', 1, 'A rich merchant hires you.'], ['A Mysterious Stranger', 1, 'Nobody knows who they are.'], ['A Demon Lord', 0.8, 'A demon lord hires you.'], ['Your Enemy', 0.5, 'Your own enemy hires you. Weird.']
];
export const MERC_PAY = [
  ['A pile of gold', 3, 'You get paid well.', 'gold'], ['A legendary weapon', 1, 'Spin for the legendary weapon.', 'legend'], ['An artifact', 1, 'Spin for the artifact.', 'artifact'],
  ['Land', 1, 'They give you land.', 'title'], ['Followers', 1, 'Some of their people join you.', 'follower'], ['Nothing — they scammed you', 1.2, 'No pay. You got played.', 'none']
];

export const KINGDOM_WHERE = [
  ['Mountains', 1, 'A kingdom carved into mountains.'], ['An Island', 1, 'An island kingdom.'], ['The Desert', 1, 'A desert kingdom.'], ['The Sky', 0.8, 'A floating kingdom.'],
  ['Underground', 1, 'A kingdom under the earth.'], ['A Forest', 1, 'A forest kingdom.'], ['The Ocean Floor', 0.8, 'An underwater kingdom.'], ['A Volcano', 0.8, 'A kingdom in a volcano.'],
  ['Another Dimension', 0.6, 'A kingdom in another dimension.'], ['On the Moon', 0.5, 'A kingdom on the moon.']
];
export const KINGDOM_SIZE = [['Village', 2, 'A small village.', 300], ['Town', 3, 'A town.', 5000], ['City', 3, 'A full city.', 100000], ['Empire', 2, 'An empire.', 5000000], ['Galactic Empire', 0.6, 'An empire across stars.', 900000000]];
export const KINGDOM_OUTCOME = [
  ['Golden Age — Your kingdom becomes rich and happy.', 2, 'Everyone loves you.'], ['Peaceful — Nothing bad ever happens.', 2, 'Quiet and safe.'],
  ['Strongest Nation — Nobody dares attack you.', 1.4, 'Your kingdom is feared.'], ['Trade Empire — Gold flows in from everywhere.', 1.4, 'You are super rich.'],
  ['Constant Wars — Enemies attack again and again.', 1.4, 'You have new enemies.'], ['Rebellion — Your own people rise up.', 1, 'Some of your people turn on you.'],
  ['Invaded — Another army takes part of it.', 1, 'You lose some land.'], ['Falls to Ruin — It collapses.', 0.8, 'Your kingdom is gone.']
];

export const EXPLORE_WHERE = [
  ['Ancient Ruins', 1, 'Old ruins full of traps.'], ['Hidden Cave', 1, 'A cave nobody knows about.'], ['Haunted Forest', 1, 'A forest full of ghosts.'], ['Sunken City', 1, 'A city under the sea.'],
  ['Volcano', 1, 'Inside an active volcano.'], ['Floating Island', 1, 'An island in the clouds.'], ['Abandoned Lab', 1, 'A creepy old lab.'], ['Another Dimension', 0.8, 'A rift to another world.'],
  ['The Underworld', 0.8, 'The land of the dead.'], ['Frozen Peak', 1, 'The top of a frozen mountain.'], ['Desert Tomb', 1, 'A tomb in the sand.'], ['Dragon\'s Nest', 0.8, 'Where dragons sleep.']
];
export const EXPLORE_HAPPENS = [
  ['You find a treasure', 3, 'Spin "What\'s in the treasure?".', 'treasure'], ['You meet a master who trains you', 2, 'Spin "What improves?".', 'improve'],
  ['A monster attacks you', 2, 'Fight it. Lose = you die.', 'monster'], ['You find a new power', 1.2, 'Spin for a new power.', 'power'],
  ['You get cursed', 1.4, 'Spin for a new weakness.', 'weakness'], ['You find a beast egg', 1.2, 'Spin for your beast.', 'beast'],
  ['You learn a forbidden spell', 1.2, 'Spin for a spell.', 'spell'], ['Nothing happens', 2.4, 'Just a long walk.', 'none'],
  ['You get lost for years', 1, 'You come back older.', 'age']
];
export const TREASURE = [
  ['A gold hoard', 3, 'You are rich now.', 'gold'], ['A legendary weapon', 1, 'Spin for the legendary weapon.', 'legend'], ['An artifact', 1, 'Spin for the artifact\'s power.', 'artifact'],
  ['An ancient grimoire', 1.2, 'Learn a spell.', 'spell'], ['An evolution stone', 1, 'Spin "What improves?" twice.', 'evolve'], ['A cursed treasure', 1.2, 'Spin for a weakness.', 'weakness'],
  ['An empty chest', 1.4, 'Someone got here first.', 'none'], ['A dragon egg', 0.8, 'A baby dragon follows you.', 'dragonegg'], ['Divine armor', 1, 'Spin for armor.', 'armor'],
  ['A potion of youth', 1, 'You get younger.', 'young'], ['A treasure map', 1, 'Explore again.', 'explore']
];

export const BEASTS = [
  ['Basilisk', 1, 'King of snakes.', 10], ['Wyvern', 1, 'A fast dragon.', 8], ['Griffin', 1, 'Eagle and lion.', 7], ['Giant Snake', 1, 'A huge snake.', 5], ['Giant Eagle', 1, 'A huge eagle.', 5],
  ['Tiger', 1, 'A big tiger.', 3], ['Lion', 1, 'A lion.', 3], ['Dire Wolf', 1, 'A giant wolf.', 4], ['War Bear', 1, 'A battle bear.', 4], ['Dragon', 0.7, 'A real dragon.', 12],
  ['Phoenix', 0.7, 'A fire bird that comes back to life.', 11], ['Kraken', 0.7, 'A giant squid.', 11], ['Leviathan', 0.5, 'A sea monster.', 14], ['Fenrir', 0.5, 'The god-eating wolf.', 14],
  ['Cerberus', 0.7, 'Three-headed dog.', 11], ['Chimera', 1, 'Three animals in one.', 9], ['Manticore', 1, 'Scorpion-tail lion.', 8], ['Hydra', 0.8, 'Many-headed snake.', 10],
  ['Behemoth', 0.5, 'An earth-shaking beast.', 13], ['Unicorn', 1, 'A magic horse.', 6], ['Pegasus', 1, 'A flying horse.', 6], ['Thunderbird', 0.8, 'A storm bird.', 9]
];

export const WAR_FOES = [
  ['A Kingdom', 2, 'A kingdom\'s army.', 6], ['A Demon Army', 1.4, 'Demons from hell.', 10], ['An Alien Empire', 1, 'Aliens from space.', 13], ['A God', 0.5, 'An actual god.', 16],
  ['The Undead', 1.4, 'An army of the dead.', 7], ['A Rebel Army', 1.6, 'Rebels.', 5], ['Your Enemy', 1, 'Your own enemy\'s forces.', 0], ['A Dragon Clan', 0.8, 'Dragons.', 12]
];
export const WAR_GAIN = [
  ['New land', 2, 'You take their land.', 'title'], ['Their army joins you', 1.4, 'Their soldiers follow you now.', 'follower'], ['A war treasure', 1.4, 'You take their treasure.', 'gold'],
  ['A legendary weapon', 0.8, 'Spin for a legendary weapon.', 'legend'], ['You get stronger', 1.4, 'Spin "What improves?".', 'improve'], ['A new title', 1, 'Spin for a new title.', 'newtitle']
];

export const REALMS = [
  ['Underworld', 1, 'The land of the dead.'], ['Olympus', 1, 'Home of the Greek gods.'], ['The Dark Dimension', 1, 'A realm of darkness.'], ['Konoha', 1, 'A hidden ninja village.'],
  ['Hueco Mundo', 1, 'The desert realm of hollows.'], ['Soul Society', 1, 'The afterlife of soul reapers.'], ['Planet Vegeta', 1, 'The Saiyan home planet.'], ['Atlantis', 1, 'The sunken city.'],
  ['Pirate Island', 1, 'An island of pirates.'], ['Hidden Village', 1, 'A secret village.'], ['Krypton', 1, 'Superman\'s home planet.'], ['Apokolips', 1, 'A planet of fire and war.'],
  ['Asgard', 1, 'The Norse gods\' realm.'], ['A Floating Continent', 1, 'Land in the sky.'], ['The Frozen North', 1, 'Endless ice.'], ['The Demon Realm', 1, 'Where demons live.']
];
export const CONQUER_HAPPENS = [
  ['You conquer it', 3, 'It\'s yours now.', 'win'], ['The rulers surrender', 2, 'They give up without a fight.', 'win'], ['Its people join you', 1.4, 'They become your followers.', 'follower'],
  ['A long war', 1.6, 'You win, but it takes years.', 'age'], ['You destroy it completely', 1, 'Nothing is left.', 'destroy'], ['A god defends it', 0.8, 'A god fights you. Win or lose.', 'god'],
  ['You fail and run', 1.4, 'You lose and escape.', 'none']
];

export const BUSINESS = [
  ['Treasure Hunting Company', 1, 'You hunt treasure for money.'], ['Monster Hunting Agency', 1, 'You hunt monsters for money.'], ['Mercenary Company', 1, 'You rent out fighters.'],
  ['Adventurer Guild', 1, 'You run a guild.'], ['Tavern', 1, 'You run a tavern.'], ['Restaurant', 1, 'You run a restaurant.'], ['Blacksmith', 1, 'You make weapons and armor.'],
  ['Magic Shop', 1, 'You sell magic items.'], ['Potion Shop', 1, 'You sell potions.'], ['Armor Shop', 1, 'You sell armor.'], ['Weapon Shop', 1, 'You sell weapons.'],
  ['Artifact Dealership', 1, 'You sell rare artifacts.'], ['Interdimensional Travel Agency', 1, 'You sell trips to other worlds.'], ['Transportation Company', 1, 'You move people and goods.'],
  ['Technology Company', 1, 'You invent and sell tech.'], ['Magic Academy', 1, 'You teach magic.'], ['Alchemist Lab', 1, 'You make potions and gold.'], ['Mining Company', 1, 'You dig for treasure.'],
  ['Trading Company', 1, 'You buy and sell everything.'], ['Shipping Company', 1, 'Your ships carry goods.']
];
// Outcomes per business (his treasure-hunting wheel word for word + the same style for the rest)
export const BUSINESS_OUTCOMES = {
  'Treasure Hunting Company': [
    'Interdimensional Treasure — He discovers treasure from another dimension.', 'Forbidden Relic — They recover an artifact capable of manipulating reality.',
    'Infinite Wealth — They discover a source of seemingly endless valuable resources.', 'Ancient Guardian — A powerful entity protects the treasure.',
    'Lost Civilization — The vault belongs to an extinct interdimensional empire.', 'Godly Artifact — They discover an artifact created by a god.',
    'Expedition Lost — The entire team becomes trapped in the dimension.', 'Business Empire — Their discovery makes the company the leading interdimensional treasure hunter.',
    'Portal Collapse — Their exit portal begins collapsing.', 'Rival Hunters — Another company invades the dimension to steal their discovery.',
    'Territorial Ruler — The dimension\'s ruler demands the treasure back.'],
  default: [
    'Business Empire — It becomes the biggest business in the world.', 'Huge Profit — You make a fortune.', 'Steady Income — It does okay. Money every week.',
    'Rival Business — A rival tries to destroy you.', 'Scammed — Your partner runs off with the money.', 'Bankrupt — It fails. You lose everything.',
    'Famous — Everyone knows your shop now.', 'Royal Contract — The king becomes your customer.', 'Cursed Customer — A strange customer curses you.',
    'Monopoly — You own the whole market.']
};
export const BUSINESS_TAGS = {
  'Interdimensional Treasure': 'gold', 'Forbidden Relic': 'artifact+', 'Infinite Wealth': 'gold', 'Ancient Guardian': 'monster', 'Lost Civilization': 'gold',
  'Godly Artifact': 'artifact', 'Expedition Lost': 'trapped', 'Business Empire': 'gold', 'Portal Collapse': 'trapped', 'Rival Hunters': 'enemy', 'Territorial Ruler': 'enemy',
  'Huge Profit': 'gold', 'Steady Income': 'gold', 'Rival Business': 'enemy', 'Scammed': 'broke', 'Bankrupt': 'broke', 'Famous': 'gold', 'Royal Contract': 'gold',
  'Cursed Customer': 'weakness', 'Monopoly': 'gold'
};

export const ALLY_GIVES = [
  ['They train you', 2, 'Spin "What improves?".', 'improve'], ['They give you a weapon', 1.4, 'Spin for a weapon.', 'weapon'], ['They give you followers', 1.2, 'Spin for followers.', 'follower'],
  ['They fight beside you forever', 2, 'They follow you into the world.', 'none'], ['They save your life once', 1.2, 'One free save from death.', 'potion'],
  ['They betray you', 1, 'Your ally is now your enemy.', 'betray']
];
export const ENEMY_DOES = [
  ['They wait in the shadows', 2.4, 'They will hunt you in the world.', 'none'], ['They attack you right now', 1.6, 'Fight! Lose and they decide what to do with you.', 'fight'],
  ['They steal from you', 1.2, 'You lose some gold.', 'broke'], ['They become your rival', 1.2, 'They get stronger when you do.', 'rival'],
  ['They hurt your ally', 1, 'Your ally is gone.', 'loseally'], ['They give up', 1, 'They are too scared of you.', 'gone']
];

export const STUDY = [
  ['Ancient Magic', 1, 'Spin your power mastery again.', 'pm'], ['Combat Books', 1, 'Spin your fighting skills again.', 'fight'], ['Science', 1, 'Spin your IQ again.', 'iq'],
  ['Forbidden Books', 1, 'Spin your IQ again. Might get cursed.', 'iq'], ['Weapon Manuals', 1, 'Spin your weapon mastery again.', 'wm'], ['The Stars', 1, 'Spin your IQ again.', 'iq'],
  ['Strategy', 1, 'Spin your fighting skills again.', 'fight'], ['Medicine', 1, 'Spin your IQ again.', 'iq']
];

export const RIVALS = [
  ['No rival', 8, 'Nobody is chasing you. For now.', 0], ['A childhood friend', 2, 'Your old friend wants to beat you.', 0], ['Your sibling', 2, 'Family rivalry.', 0],
  ['A stronger version of you', 1, 'Someone just like you, but a bit stronger.', 1], ['A demon', 1.4, 'A demon wants your soul.', 1], ['A god', 0.6, 'A god sees you as a threat.', 3],
  ['A dark copy of you', 1, 'Your evil clone.', 0], ['A legendary warrior', 1.2, 'An old legend wants to test you.', 1], ['An alien hunter', 1, 'An alien hunts strong people.', 1],
  ['The world\'s strongest', 0.5, 'The strongest person alive wants to fight you.', 2]
];
