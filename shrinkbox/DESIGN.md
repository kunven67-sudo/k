# SHRINKBOX — design notes (from the Q&A with the player)

Golden rule: **REALISTIC.** Looks and works like real life (germs, dirt, heat, wind,
real parts inside electronics). BUT the *player* is not science-scaled: tiny you is a
normal person, just smaller. No super strength, no flea jumps.
Anything realistic gets added automatically; only ask about real choices.

Tech: 3D browser game (Three.js like the other games in this repo).
Plays on PC (mouse+keys), phone (touch) and controller.
First-person and third-person, switch with a key. Graphics settings so it never lags.
Build plan: player chose ALL AT ONCE (was warned about the limit).

## Shrinking
- Sci-fi watch. **Hold F** = keep shrinking, **hold G** = keep growing (giant).
- Shrink animation: world grows around you + watch glows/beeps + zap sparks + camera shake/whoosh.
- Smallest: germ size first; molecules then atoms (the real bottom) in later depth levels.
- Giant: grow until you **break through the roof** and see outside.
- Watch screen: exact size ("2.4 mm"), size compared ("ant size"), health, clock.

## Shrinker (objects)
- Handheld device. **Scroll** to pick shrink/grow mode, **hold click to charge**, release to zap.
- Grown objects get heavy, knock stuff over, crush/push things, and can get big enough to walk in.

## Collisions + physics
- Real-shape collision. You walk on the actual surface of things, no invisible boxes.
  Nothing walks through anything.
- Falling when tiny: slow, like jumping off a building, and NO damage.
  Fall damage only at normal size.
- Sandbox: spawn menu (food & drinks, electronics, furniture, toys & balls),
  pick up & throw, stack, stick with a **glue gun** and **duct tape**.
- Save slots.

## Going inside things
- Get in only through real openings: can opening, vents, charging port, gaps.
- Insides are realistic.
- **Soda can**: bouncy surface tension skin, soda thick like honey, bubbles push you up, sticky after.
- **Phone**: battery (warm when charging), camera lens, speaker (booms on ring), chips + board.
- **Xbox**: big fan, heat sink fins, disc drive (spinning disc + laser), power supply (danger).
- **Controller**: rumble motors, AA batteries, rubber button domes, thumbstick sensors.
- Also: TV (pixels up close), gaming PC, snacks/chip bag, headset, cooking pot, "and more".
- Things turn ON: Xbox/PC (fans blow wind, gets warm), TV plays, phone lights/vibrates, room lights.
- Dangers inside (realistic): fan wind blows you, electric zap, hot chips burn.

## Germs + dirt
- Germs ignore you (no eyes). Bacteria wiggle/swim, viruses just sit, dust mites crawl.
- Not always there: people clean. Germs grow back over time.
- Stuff gets germy when touched; dirty hands spread germs to what you touch.
- Clean with wipes / sanitizer / spray.
- Spots: controller, phone screen, carpet + dust bunnies, old snacks/crumbs.

## World
- Start in your **bedroom/gaming room**: normal realistic teen room, bed, gaming setup.
- **Whole house** explorable.
- Window: house at edge of town: neighborhood in front, city skyline far away, fields behind.
- Real-time clock and real-time day/night.
- Sounds realistic: loud close up, muffled inside things, echo inside the can. **No music.**

## Life stuff
- Character fully customizable: skin, face, hair, clothes, height/body.
- Parents live in the house (real people): text you, call from downstairs, give chores + allowance.
- Money: allowance + chores + selling stuff online.
- Phone/PC apps: shop + bank, camera (photos only via in-game phone), sell app.
- Buying: order online, delivered to your bedroom door with a knock.
- Pets you can buy: cat, dog, hamster, fish, lizard, ant farm.
- Health 0 (big fall, zap, burn) = wake up in hospital and pay a bill.
- Pure sandbox, no missions.
- Multiplayer: later update.

## Other game (separate file, later)
- Cooking game: put ingredients together and make food.

## Rounds 16-19
- House in the **USA**: 2 floors + basement. Kitchen, living room, bathroom, parents' room,
  garage/basement, your bedroom. No siblings.
- Parents can see you down to ~hand size; ant size only if close + moving on a surface they're
  looking at (they think you're a bug: mostly ignore, swat on counters, vacuum while cleaning);
  smaller than a dust mite = invisible. On the floor they might step on you.
- Watch is a SECRET. Glimpse = they think they're tired. See a full shrink = they freak out,
  take the watch and hide it in their room; you sneak it back.
- Routine: both parents work weekday daytime, home evenings/weekends, sleep ~11pm.
- Main menu shows on the sci-fi watch screen.
- Real date: holiday decorations (October = Halloween).
- Player HATED in other shrink games: invisible walls, fake insides, lag/ugly, too little to shrink into.
- Rideable / explorable (realistic): RC car (electric motor coils+magnets, gears, battery,
  receiver, antenna), real car in garage (engine: pistons, spark plugs, radiator fan, belts, hot),
  drone (4 motors, prop wind, battery, camera), paper airplane glides,
  pets: grab fur and get carried (can't steer).
- More insides: fridge (cold, compressor, coils), microwave (danger), washing machine,
  toilet tank, keyboard switches, mouse laser sensor, headphones, wall outlets (danger), bulbs.
- Ants come in from outside, spiders in basement corners.
- Cooking game: talk about it after Shrinkbox.
