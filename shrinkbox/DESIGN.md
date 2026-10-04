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

## Added later (player's message)
1. **Inside the body** (a person's body): get in by riding on food, hiding in a drink,
   getting breathed in, or walking into an ear.
   Path: mouth -> throat -> stomach (acid hurts) -> intestines -> pooped out into the toilet.
   Other ways out: sneeze, cough, crawl out the ear.
   (No cutting people open - entry is only through real openings.)
2. **Tiny humans** (not the parents): a hidden tiny village inside the walls, plus tiny
   humans in the spawn menu. Pick them up, carry them, set them down, talk to them.
   They react like real people (scared, curious, friendly, etc).
3. **Pick up shrunk people** in your hand (gently).
4. **Cutting tool - objects only**: cut open soda cans, the Xbox, the phone, boxes, food.


## Build status (what's in the game now)
- [x] Bedroom + whole house (2 floors + basement + garage), real doors/windows/stairs
- [x] Watch: hold F/G, effects, HUD, battery (lie in bed to charge), confiscation by parents
- [x] Real-shape collisions everywhere; ray-based player mover exact at any size
- [x] Inside: Xbox, controller, phone, soda can, TV, toilet tank, fridge, pot, microwave, car
- [x] Tools: hands, shrinker (people too), glue gun, duct tape, cutter (objects only), clean
- [x] Spawn menu: food, electronics, furniture, toys, tiny people
- [x] Germ world (< 0.45 mm) per surface + dirt that spreads/regrows; atom world (< 1.5 µm)
- [x] Wall village with tiny people (talk by typing or mic, real voices, pick up gently)
- [x] Mom + Dad on the real clock: work, cooking, dinner call, TV, sleep; texts; bug swats; feet
- [x] Body journey: mouth/stomach/intestines/toilet, nose->sneeze, wrong pipe->cough, ear
- [x] Phone: messages, bank, shop + deliveries, sell, chores, camera/photos, weather
- [x] Pets: cat (hunts tiny you), dog (licks), hamster wheel, goldfish tank, gecko, ant farm
- [x] Real sun/time, west-coast weather + small earthquakes, Halloween in October
- [x] Giant: break through the roof, solid neighborhood outside
- [ ] Multiplayer (later)
- [ ] Cooking game (separate file, talk about it first)
