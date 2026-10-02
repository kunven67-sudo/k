# Cryptborne: plan for the next version

Notes from the planning questions. Nothing here is built yet.

## Order of work
Plan both games first (pixel upgrade + 3D first-person version), then build them one after the other.

## Pixel game upgrades

### Boss path (every dungeon)
1. A **mini-boss** guards the **boss key**. Beat it to get the key.
2. The key opens the **healing spring room** (heals you to full before the fight).
3. Inside the spring room you pull the **lever** that opens the boss gate.
4. Fight the boss.

### Music
Changes by place: chill town music, creepy dungeon music, loud fast boss music.

### Animations
- **Water:** moving waves, ripples and splashes, fountain spray.
- **People:** breathing, blinking, waving, chatting, doing jobs (Brom hammering).
- **Monsters:** real attack swings, flinch when hit, death animations.
- **Nature and weather:** swaying grass and trees, birds, fireflies, rain, day and night.

### Night
Night is more dangerous: darker, lamps and windows light up, tougher monsters come out in the wild.

### Sounds
Footsteps (grass, stone, wood, water), nature (birds, crickets, wind, rain, cave drips), a sound for each monster type, town sounds (hammer, fountain, chatter).

### New features
- Quests from villagers
- Weapon upgrades at Brom (+1, +2, +3...) with coins and monster drops
- Pets, bought at a **pet shop** in town: Wolf pup, Fire sprite, Baby slime, Raven
- More places, each with new monsters and dungeons: **Frozen mountains** (ice monsters, slippery ice, blizzards), **Haunted swamp** (poison water, frogs, witch huts), **Desert ruins** (mummies, scorpions, sandstorms), **Pirate coast** (beach town, ships, pirates, sea monsters)
- Quest types: hunting, collecting, rescue, delivery
- Upgrades: up to **+10**. Past +5 an upgrade can **fail** and you lose the materials. Items also get **gem slots** for bonuses like fire or lifesteal.
- New save: pick a **class** AND customize the hero's looks
- Classes: Warrior, Archer, Mage, Rogue
- Skill tree (a point each level) AND special attacks, **4 special slots**
- Difficulty: Easy, Normal, Hard, Hardcore (dying deletes the save)

## Story: The Missing Brother (dark and serious)
- Your **younger brother Finn** wanted to prove he was brave.
- A **voice in his dreams** called him into the crypts. It sounded like your dead father.
- **Twist: Dad IS the Lich.** He didn't die; he became the Lich to cheat death.
- **Opening cutscene:** the night he left. You wake up, his bed is empty, his sword is gone, a note is on the table.
- Told through **cutscenes** and **notes/journals** found in dungeons.

### Endings
- **Good:** you and Finn seal the crypts forever and Emberfall is safe.
- **Bad (three of them):**
  - Eternal night: too many nights pass before you win.
  - You fight Finn: you found fewer than half of his notes.
  - You take his place: you accept the voice's deal at the end.
- **Secret:** find every note AND beat the secret boss **Shadow You** (a dark copy of your hero that uses your moves) in a hidden dungeon. The ending is a **sequel tease**: something bigger wakes up, leading into the 3D game.

## 3D first-person version
- **Brand new story:** Blood Moon Hunter. You're a monster hunter in a cursed valley. Every 7 nights a blood moon rises and the monsters go crazy. Find out who cursed the valley.
- **Vibe:** gritty and brutal. Harsh world, hard choices, nobody is fully good.
- **World:** realistic medieval fantasy (stone towns, forests, castles, dungeons).
- **Camera:** first person by default, press V to see your hero from behind.
- **Combat:** melee (click to swing, F to block with a shield, C to dodge), bows (hold right click to aim and draw), magic (fireballs, lightning, ice).
- **Name:** BLOOD MOON HUNTER
- **Your hunter:** a rookie on their first real contract, with a lot to prove. You grew up in this valley, left as a kid, and came back to find it cursed.
- **Endings (your choices decide which one):** kill the lord and break the curse; find and kill the demon he made the deal with; or the dark ending where you take the lord's deal, live forever, and become the new monster.
- **Allies:** none. Lone wolf, just you and your horse.
- **Gore:** brutal. Lots of blood, finishing moves, monsters can lose limbs.
- **Getting stronger:** levels + skill tree, better gear (buy, craft, upgrade), and monster mutations (powers from monster parts that slowly corrupt you).
- **Hunter look:** full creator (face, skin, hair, scars, body type, clothes), ready-made hunters to pick from, or keep the default hunter.
- **Music:** changes by place: calm in town, eerie in the wild, intense in fights and during blood moons.
- **Realism:** day and night, weather (rain, fog, thunderstorms, wind in trees and grass), wildlife to hunt (deer, rabbits, crows, wolves) for meat and hides, survival needs (eat, sleep, cold nights hurt without a fire).
- **Menu and saves:** same as the pixel game (title, Play, Settings, save slots showing when each save was created and loaded), plus autosave at camps and when you sleep.
- **Difficulty:** Easy, Normal, Hard, Hardcore (dying deletes your save).
- **Villain:** the valley's lord traded his people's lives to a demon to live forever.
- **Blood moon (every 7 nights):** monsters get stronger and drop better loot, and rare blood monsters only appear then.
- **Monsters:** werewolves (silver hurts them), ghouls and vampires (graveyards, the lord's castle), swamp drowners, trolls under bridges, wyverns in the mountains.
- **Hunter stuff:** contract board, tracking (footprints, blood trails, clues to a lair), crafting potions and blade oils from monster parts, a trophy wall at home.
- **Travel:** ride a horse (whistle for it, fight from horseback) and fast travel between signposts you've found.
- **Map:** one big open valley with no loading screens.

Honest limit: a browser game can't match GTA V's hand-made 3D art. It can have real 3D, lighting, shadows, fog, day and night, music and sound for everything.

## Build decisions
- Build the **pixel upgrade first**, then Blood Moon Hunter.
- Deliver **all at once** when both are done, then make a **trailer**.

## Pixel upgrade: design details (filled in while building)
Levels and order of places:
| Place | Level | Boss | Mini-boss (has the boss key) |
| --- | --- | --- | --- |
| Mossy Hollow (Vale) | 1 | Slime King | Slime Brute |
| Goblin Warrens (Vale) | 3 | Goblin Chief | Goblin Brute |
| Bonecrypt (Vale) | 5 | Skeleton Knight | Bone Warden |
| Webspire Depths (Vale) | 8 | Spider Queen | Broodmother |
| Ashen Forge (Vale) | 11 | Magma Golem | Orc Warlord |
| Witchwood Hollow (Haunted swamp, Mirefen) | 13 | Hag Mother | Mire Brute |
| Frostfang Caverns (Frozen mountains, Frostpeak) | 16 | Frost Wyrm | Frost Troll |
| Tomb of the Sun King (Desert ruins, Sunscar) | 19 | Sun King | Tomb Guardian |
| The Sunken Galleon (Pirate coast, Saltmarrow) | 22 | Captain Blackbones | First Mate |
| Wraithmoor Tomb (final, Vale) | 25 | The Lich (Dad) | Grave Warden |
| Mirror Crypt (secret) | 25 | Shadow You | none |

Story acts:
1. **Act 1 (the Vale):** follow Finn's trail and notes through the first five dungeons. After the Ashen Forge the voice calls to you too, and you recognize Dad's voice.
2. **Act 2 (the four regions):** Finn is breaking four seals that keep Wraithmoor Tomb shut. Each region boss guards a seal Finn already broke.
3. **Act 3 (Wraithmoor Tomb):** the Lich reveals he is Dad. He offers the deal (your soul for Finn's). Notes found (25 total, half = 13) decide whether Finn can be reached.

The night counter (shown on screen) decides the Eternal Night ending: Easy 80 nights, Normal 60, Hard and Hardcore 45. Sleeping in your bed skips a night.
The Mirror Crypt opens when you have all 25 notes. The secret ending's sequel tease shows a blood moon rising over a distant valley, leading into Blood Moon Hunter.

## Art direction update (after the pixel upgrade)
- **Look and feel like Moonlighter** (same Cryptborne story and characters): chunky outlined pixel characters facing 4 ways, smooth walk cycles with a body bob, breathing, blinking, a spinning roll with dust, swoosh trails on swings, hit sparks, white hit flash, squishy creatures, lit dungeon wall edges with soft floor shadows, and a 3-hit sword combo with a big finisher.
- **No voice lines.** Dialogue text types out with a soft blip sound (no babble), pitched per character, like most pixel games.
