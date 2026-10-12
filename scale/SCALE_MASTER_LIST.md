# SCALE — The Master List

Everything that goes in SCALE, and how every piece of it works. This is the full target for the whole game.
It's built in waves (see the build order at the end), but nothing on this list is "maybe".

How to read it:
- **The list** parts say what's in the game.
- **How it works** parts explain, in plain words, what happens in real life and how the game copies it.
- **Never-bugs** parts list the bugs each system must never have.
- The **Questions** at the end are things only you can decide.

---

## 0. The 6 rules that make everything make sense

### Rule 1: Nothing is random. Everything has a cause.
No dice rolls and no "50% chance" anywhere in the game's decisions.

- **People decide from who they are.** Every person gets a full personality when the world is made (honesty,
  bravery, kindness, greed, curiosity, laziness, impulsiveness, how much they like or trust you, and more, see section 10).
  When you ask someone to follow you, the game works out the answer from their traits, what they want right now,
  what they remember about you, and what's going on around them. Same person + same situation = same answer, every time.
  A person who's "weird" is weird because they have the traits that make them weird, so you can learn them.
- **Things break because of force.** A glass breaks when it hits the floor hard enough for the material it's made of.
  A cord gets unplugged because the dog tripped on it, the robot vacuum dragged it, a person yanked it, or you pulled it.
- **Mess has a history.** A crumb under the couch is there because someone ate on the couch. The ants in the kitchen
  are there because they found that crumb trail. You can check where anything came from with the inspect tool.
- **The only "random" is the seed.** When you make a new world, a seed number decides who lives in the town, what they're like,
  where the furniture is. After that, nothing is a coin flip. (Same seed = same starting world, so you can share a world code.)

### Rule 2: One sci-fi thing. Everything else is real physics.
In real life, shrinking a person isn't possible: atoms can't get smaller, and a 2 mm person couldn't breathe, think or stay warm.
So the game has exactly ONE invented technology: the **RIFT field**, made in your basement lab (RIFT LAB).
The watch and the rays work by wrapping a thing in a RIFT field that changes its size.

What the RIFT field does (the only "cheats" in the game):
- Changes the size of whatever is inside it (you, a person, a can, a car) and keeps its body working at that size:
  the thing still has a working brain, lungs and heart, and the air it breathes gets resized with it.
- Keeps the thing's mass scaled correctly (a can at 1/10 size weighs 1/1000 as much, because volume shrinks by 10x10x10).

What the RIFT field does NOT do (so real physics hits you):
- It doesn't make you stronger or weaker than physics says (the square-cube law decides that, see section 1).
- It doesn't protect you from falling, crushing, drowning, heat, cold, poison, being eaten, or surface tension.
- It doesn't keep you warm for free: tiny bodies lose heat fast and burn food fast (real, see section 1).
- Shrunk people who were hit with the ray get the same field, so they can survive, but they feel everything else.

Other inventions in the lab (black hole gun, freeze gun, and so on) are RIFT LAB tech too, and each one is explained
in section 7 with what's invented and what follows real physics.

### Rule 3: Detail at every size.
When you're 1.75 m tall you don't need to see carpet fibers. When you're 2 mm tall, a carpet fiber is as thick as your leg.
So the world is built in **layers of detail** that appear when you're small enough to see them:
- Big layer: the town, buildings, rooms, furniture (always there).
- Small layer: crumbs, coins, hair, dust bunnies, pebbles, grass blades, fabric weave (appears below about mouse size).
- Tiny layer: carpet fibers, wood grain you can walk in, salt grains, pollen, mites (below about ant size).
- Micro layers: cells, bacteria, molecules, atoms (section 2), built from **what you're actually standing on**.

Each layer is made by code from the real material under you (carpet makes carpet fibers, a soda can makes aluminum,
skin makes skin cells), and it's the same every time you come back to that spot. That's how "getting small at a certain
place" works: the place decides what you find down there.

### Rule 4: If you can see it, it's real.
Every object you see is a real physics object: you can touch it, push it, pick it up if you're strong enough, break it if
it's breakable, shrink it, grow it. No fake painted-on stuff. (Things too far away to matter, like a mountain 50 km away,
are scenery until you get close enough or big enough to reach them.)

### Rule 5: Everything is a real thing with real numbers.
Every object has its real size, real weight, real material and real behavior. A soda can is 12.2 cm tall, weighs about
14 g empty and about 383 g full. A coffee mug breaks on tile but usually survives carpet. A bowling ball dents the floor.

### Rule 6: Who can and can't be hurt
- All people in the game are made up. No real people, no celebrities.
- **Kids and babies can never be hurt** by anything: no weapons, no shrink ray, no experiments, no gore, no creatures
  attacking them. They still act like real kids (they get scared, cry, run to their parents, tell on you).
- Dating, romance and pregnancy are adults only and family-friendly (it cuts to a time skip, nothing explicit).
- Gore, dismemberment, anatomy and lab experiments only happen to made-up adult characters.
- Real brands, movies, shows and songs can't be copied, so the game has the real kinds of things with made-up names
  (like your cars: Velaro, Hesper, Grizz), and its own movies, shows, music and websites.

---

## 1. Size and the RIFT field

### The list
- **The watch** (on your left wrist). Hold one key to shrink, hold another to grow, smooth like a zoom. Let go and you stay that size.
  Shift makes it change faster. The watch face shows your height and what you're the size of.
- **Size readout** on the watch, using real comparisons:
  - 1.75 m: normal person
  - 50 cm: a cat
  - 10 cm: a mouse
  - 2.5 cm: a grape
  - 5 mm: an ant
  - 1 mm: a flea
  - 0.3 mm: a dust mite
  - 0.1 mm: a human hair is wider than you
  - 10 µm: a skin cell / a red blood cell
  - 1 µm: a bacterium
  - 100 nm: a virus
  - 2 nm: the width of DNA
  - 0.3 nm: a water molecule
  - 0.1 nm: an atom
  - 17 m: a 5-story building
  - 100 m: a skyscraper
  - 1 km: a mountain
  - 12,742 km (wide): Earth
  - 1.39 million km: the Sun
  - 100,000 light years: the Milky Way
  - 93 billion light years: the observable universe
- **Shrink ray** (shrink/grow anything you point at).
- **Size lock zones**: the lab has a "reset to normal size" pad, so you can always get back to 1.75 m fast.
- **Force grow** option: if there's no room to grow, the watch stops you. Hold the force button to grow anyway and break
  whatever's in the way (see "Growing inside a house").

### How size changes your body (real physics, the square-cube law)
When you shrink to 1/10 of your size, your height goes down 10x, but:
- your muscles' **strength** goes down only 10 x 10 = 100x (strength depends on how thick a muscle is, an area),
- your **weight** goes down 10 x 10 x 10 = 1,000x (weight depends on volume).

So small things are **super strong for their size**. That's why an ant can carry many times its own weight.
In SCALE:
- At ant size you can lift things way heavier than you (a crumb, a sugar cube, a paperclip), but in absolute terms you're
  super weak: you can't flip a light switch (it takes a few newtons of push, like a fingertip press), you can't open a door, you can't turn a knob.
- At giant size you're weaker for your size: a 17 m giant moves slower and gets tired faster, and things like your
  knees take a beating when you jump (real: big animals can't jump like small ones).
- **Falling**: small things fall slower because air slows them down more compared to their weight. A mouse can survive a fall
  from almost any height. A scientist named J.B.S. Haldane wrote that you could drop a mouse down a deep mine shaft and it would
  walk away, while a human would die. In SCALE, at ant size you can jump off the kitchen counter and land without getting hurt.
  At human size a staircase fall hurts. At giant size a fall from your own height can break bones.
- **Heat and hunger**: small bodies lose heat super fast (lots of skin for how little body there is). Real tiny mammals like
  shrews eat close to their own body weight every day. When you or shrunk people are tiny, you get cold fast and hungry fast
  (compared to your size), so shrunk people need lots of food and need to stay warm (fire, cotton, huddling).
  The amounts are tiny in real terms: a crumb feeds a 2 mm person for days.
- **Surface tension**: water acts like a stretchy skin. For you at normal size it's nothing. For a 2 mm person, a water drop
  is a sticky blob that can grab you and hold you, and getting out is hard. Water striders can walk on water because of this,
  and in SCALE, if you're light enough, so can you.
- **Thick water**: the smaller you get, the more water feels like honey (scientists call this low Reynolds number).
  At bacteria size, if you stop swimming you stop instantly, no gliding.
- **Wind**: a breeze you'd never notice at normal size can blow a tiny you off a table. A fan is a hurricane.
- **Sound**: sounds don't change pitch when you shrink, but loud things are scary: a dog bark at 2 mm is an explosion of sound.
  The game keeps real pitch and makes big things feel huge with volume, rumble, and distance.
- **Light**: at normal sizes you see normally. Below about 0.2 µm, things are smaller than light waves, so in real life you
  can't see them with light at all. The game switches to RIFT vision there (section 2), which is how real scientists see
  that small too (electron microscopes).

### How shrinking ON things works (where you shrink matters)
You shrink wherever you're standing. The game knows what's under your feet, so it builds the right small world.

- **Shrinking on a soda can**: the can's top is a giant metal plaza. The pull tab is a huge lever bigger than a car.
  The rim is a curved metal wall. Down at about 1 mm size you see the printed logo is made of colored dots (that's how cans
  are printed). Below that, the aluminum's surface has scratches and rolling marks like canyon walls. If the can is cold,
  water drops form on the outside (condensation) and each drop is a blob you can get stuck in. If the can is open, the
  opening is a dark hole with fizzy air coming out of it. Way down at the atom level you see aluminum atoms stacked in a
  neat repeating pattern (real aluminum crystal), under a thin layer of aluminum oxide.
- **Shrinking on a PS5-style console**: the top is a smooth plastic plain with tiny scratches and dust. The vents are giant
  grilles; behind them the big fan's blades are as tall as buildings and they blow hot air out like a storm (you get blown
  away if you stand in front of an exhaust vent while it's on). Go in through a vent and you're inside: a huge fan,
  a heat sink with copper heat pipes (hot, it burns you), the main chip and memory chips like flat buildings on a green city
  (the circuit board), with copper roads (traces) and little parts like towers (capacitors). Dust bunnies are trapped in the vents.
  If the console is on, it's hot and loud inside. Walking on a power line on the board does nothing (it's low voltage and
  covered), but touching inside the power supply while it's plugged in can shock you.
- **Going into a drink**: you need to be small enough to fit over the rim (or fall in). What happens depends on the drink:
  - **Water**: you swim. At ant size, surface tension holds you on top if you're light enough, or traps you when you break in.
  - **Soda**: it's fizzy. CO2 bubbles form on everything, including you, and lift you up (real: raisins in soda go up and down
    because of this). It's sticky (sugar) and slightly acidic (stings a little, nothing dangerous fast).
  - **Hot coffee**: about 60-70°C. It burns you. Steam rises off it.
  - **Milk**: at tiny sizes you see fat droplets floating in it (that's why milk is white).
  - **Oil**: thick and slippery, hard to swim in, hard to climb out of.
  - A person can **drink you** if you're in their drink and they don't notice (section 12, being eaten).
- **Raindrops**: real raindrops are about 1-5 mm wide and fall up to about 9 m/s. At normal size it's just rain. At ant size, each
  drop is a water ball as big as you hitting you at high speed. Real mosquitoes survive raindrop hits because they're so light
  that the drop pushes them instead of crushing them, then they slip free. Same in SCALE: if you're light enough you ride the
  drop down and slip off, or get stuck in it when it splats. Puddles are lakes. Rain is dangerous at tiny size, so you hide
  under a leaf.
- **A plastic bag**: blowing into a bag fills it with your breath (it inflates for real, with air volume). Pop it by squeezing
  or hitting it hard. If you're shrunk and inside a bag, the bag is a giant crinkly tent; if it's tied shut, there's only so much
  air: a big person in a sealed bag runs out of air fast, a tiny person has way more air for their size and lasts much longer.
- **Shrinking on a car**: see section 14 (the engine bay, the tires, the grille).
- **Shrinking on a person**: their skin is a landscape: pores, hairs like trees, skin flakes, tiny mites living on faces
  (Demodex mites, real, most adults have them). They can feel you if you're above about 1 mm and they'll swat you.
- **Shrinking on a plant**: leaf surfaces have little hairs and mouth-like holes (stomata), aphids, ladybugs, dew drops.
- **Shrinking on food**: bread is a sponge cave, a cookie is rough rock with sugar crystals, cheese is smooth, salt grains are cubes.

### Growing inside a house
- The watch checks for room before it grows you. If your head would hit the ceiling, it stops and the watch says
  "Not enough room."
- **Force grow** (hold the force button): you keep growing and push on everything around you. Things break in the order their
  real strength says: drywall cracks first, then ceiling joists snap, then the roof lifts off. Concrete and the foundation are
  much stronger. Furniture you're squeezing gets crushed. Glass windows burst. Pipes break and spray water, wires spark.
- Breaking the house is permanent until it's repaired (by you, or by workers you hire, section 15). People inside react
  (they run, call 911, get hurt by falling stuff).
- Same goes for growing inside a car (the roof pops off), a box (it tears), a jar (glass shatters around you), a tunnel or a pipe.

### How the shrink ray works
- Hold fire to shrink what you're aiming at, hold alt-fire to grow it, smooth, with a beam you can see.
- Works on anything: objects, furniture, people, pets, bugs, plants, cars, buildings' loose parts.
  (Walls, floors and the ground can't be resized because they're part of the building and the earth.)
- What happens to a shrunk thing:
  - Its weight drops by the cube (half size = 1/8 the weight). A shrunk car is light enough to pick up.
  - Its strength drops by the square. A shrunk dog is a strong little dog for its size but harmless to you.
  - Its stuff shrinks with it (clothes, a phone in a pocket, a person's keys) because the field wraps everything touching it.
- Growing stops if there's no room (same check as your watch), unless you use force mode.
- Living things you shrink stay alive and aware; they freak out depending on who they are (section 11).
- **Kids can't be targeted**: the ray beam slides off them.

### Never-bugs
- Growing never puts you inside a wall or the ceiling. If you'd overlap anything, the grow stops first.
- Shrinking never drops you through the floor. Your feet stay planted on the spot under you while you shrink.
- Things you shrink never fall through the table they were on, and things you grow never explode out of walls in a glitchy way.
- You never get "stuck" at a size: the reset pad and holding grow/shrink always work.
- The camera never ends up inside an object when you change size.

---

## 2. The microscopic world (all the way down to atoms)

### How it works
There are too many tiny things in the world to build all of them, so the game builds the micro world from **the material
you're standing on**, with code, the same way every time for the same spot. Every material in the game (carpet, wood,
skin, soda, aluminum, plastic, soil, leaf, glass, paper, food) has a recipe for what it looks like at each size level.

When you go below about 0.2 µm, visible light is too big to show anything (real physics: light can't show things smaller than
about half its wavelength). The game switches to **RIFT vision**: a mode that looks like electron microscope pictures
(gray, sharp, 3D-looking), with an option to color it. At the atom level, it shows atoms as glowing electron clouds.

Breathing and moving at micro sizes: your RIFT field keeps you breathing. Around you, air stops looking like nothing and starts
looking like a storm of tiny molecules (below about 100 nm). Things shake around from being hit by molecules (Brownian motion,
real, you can see it under a microscope at about 1 µm).

### The levels (real sizes, real things)
**Level 1: tiny (1 mm to 0.1 mm)**
- Dust mites (0.2-0.3 mm): eat skin flakes, live in carpets, beds, couches, pillows. 8 legs, look like little ugly monsters.
- Springtails (jump with a tail-spring), booklice, flea larvae in pet beds, mold spores.
- Skin flakes (people shed tons, that's most of house dust), hair (about 0.07 mm thick, a tree trunk to you), fabric fibers.
- Pollen grains (spiky balls, 10-100 µm), salt crystals (perfect cubes), sugar crystals, sand grains (rounded rocks), flour.
- Tardigrades (water bears, 0.3-0.5 mm) in moss and wet places, slowly walking on 8 stubby legs.
- In water drops: paramecia (slipper-shaped, swim with tiny hairs), rotifers (spinning mouths), amoebas (blobby, eat by
  surrounding food), algae, diatoms (glass shells with patterns), copepods, mosquito larvae in standing water.

**Level 2: cells (100 µm to 1 µm)**
- On skin: skin cells, Demodex mites (on faces), sweat pores, bacteria colonies.
- Blood (if there's a cut or a blood drop): red blood cells (7-8 µm, red discs), white blood cells hunting bacteria, platelets.
- Plants: leaf cells with green chloroplasts, stomata (leaf "mouths" that open and close).
- Food: yeast cells in bread dough, mold on old food.
- Bacteria everywhere: on door handles, phones (phones are really dirty), teeth (Streptococcus mutans, the cavity bacteria),
  in the soil, in the gut of bugs. They split in two, swim with tails, stick together in films.

**Level 3: viruses and big molecules (1 µm to 10 nm)**
- Viruses (20-300 nm): flu viruses (round with spikes), cold viruses, bacteriophages (look like little landers) attacking bacteria.
  The game's sickness system (section 4) uses real virus particles, so you can find flu viruses on a doorknob someone sick touched.
- Proteins, DNA strands (2 nm wide, a twisted ladder), cell membranes, fat droplets in milk.

**Level 4: molecules (10 nm to 0.5 nm)**
- Water molecules (one oxygen, two hydrogens) jiggling and linking up.
- Air: nitrogen (two atoms stuck together) and oxygen molecules flying around at about 500 m/s, CO2 in soda bubbles.
- Sugar (sucrose), salt (sodium and chloride in a grid), cellulose chains in wood and paper, plastic polymer chains,
  caffeine in coffee.

**Level 5: atoms (about 0.1-0.5 nm)**
- Atoms of the material you're on: aluminum (soda can) in a neat crystal grid, iron in steel, silicon in computer chips
  (diamond-like grid), carbon in wood and food, sodium + chlorine in salt, oxygen + hydrogen in water.
- Each atom is a fuzzy electron cloud with a tiny bright nucleus in the middle (the nucleus is about 100,000 times smaller
  than the atom, so the game shows it as a tiny glowing point, and you can zoom on it).

**Bottom of the game**: the nucleus of an atom (protons and neutrons, about 1 femtometer). That's as far down as real science
can describe as "things". Below that is quarks, which the game shows as a final level you can look at but not walk on,
because they don't work like objects.

### Dangers down there
- Mites, amoebas and white blood cells try to eat things your size.
- Water drops trap you (surface tension).
- Getting too close to a hot surface (molecules moving super fast) burns you.
- Getting breathed in by a person (if you're near their nose at 0.1 mm or smaller).

### Never-bugs
- The micro world always matches what's above it (shrinking on a can never shows grass).
- Coming back up puts you exactly where you went down.
- Things you carry stay with you through every level.

---

## 3. Giant, kaiju, Earth and space (all the way up to the universe)

### How it works
The town is built in real meters. When you grow past the town, the game swaps the town for bigger and bigger versions of the
world, each built for that size:

**Giant (2 m to 100 m)**: the town is all there, full detail. At 17 m you're taller than a house. Cars are toys.
People run screaming, cops show up (section 15). You can step on things (and people, unless they're kids, kids always get out
of the way or the step stops). Real: at this size, your steps shake the ground (people feel it, glass rattles).

**Kaiju (100 m to 10 km)**: the town is a model-train set. You see the whole coast, the highway, the ocean, other towns as
smaller details, hills and mountains inland. Clouds are at your head or below. Helicopters show up (news and police).

**Mountain and up (10 km to 1,000 km)**: you're in the sky. The ground is a map of California: real coastline, the Central
Valley, the Sierra Nevada mountains, the ocean. Air gets thin above about 10 km (in real life you'd need oxygen: your RIFT
field handles it). The sky turns dark blue then black.

**Earth (bigger than 1,000 km)**: you're standing on Earth like a ball. Real continents and oceans, real clouds, ice caps,
the night side with city lights. Earth turns (one turn a day). You can't stand on Earth anymore once it's smaller than you,
so you float in space (space mode).

**Space mode**: no ground, you float. You can move around, grab things, and look.
- The Moon (3,474 km wide, 384,400 km away) orbits Earth.
- The solar system: the Sun (1.39 million km wide), all 8 planets with real sizes, colors, rings and big moons, the asteroid
  belt, the Kuiper belt. Planets move on their real orbits. You can grab and move planets (and see what happens: two planets
  hitting each other makes a huge debris field).
- Stars: the real nearby stars (Proxima Centauri 4.24 light years away, Sirius, and so on), each with real color by temperature.
- The Milky Way: a spiral galaxy about 100,000 light years across, with the Sun about 26,000 light years from the center,
  a black hole in the middle (Sagittarius A*).
- Other galaxies: Andromeda (2.5 million light years away, heading toward us), the Magellanic Clouds, galaxy clusters.
- The universe: galaxies arranged in a giant web (the cosmic web), up to the edge of the observable universe
  (about 93 billion light years across), where the oldest light (the cosmic microwave background) glows.

**Coming back**: shrink back down and you land wherever you aim on Earth (or back home by default). The town is exactly how
you left it.

**What's in detail and what isn't**: the town is fully detailed. The rest of Earth is real geography (coastlines, mountains,
oceans, cities as lights and gray areas) but not walkable in full detail. I can't build every city on Earth in full detail.
If you shrink down somewhere far away (like in the middle of Nevada), you land on generic terrain that matches the real
type of land there (desert, forest, snow, ocean), not a real copy of that place.

### Rockets and space travel
- A rocket you can build/buy in the late game (RIFT LAB space program) or spawn: real staging (boosters drop off), real fuel,
  launch from the beach or a launch pad you build, real orbit (about 7.8 km/s sideways to stay up), real reentry heat.
- Ride it at normal size to the Moon or Mars the real way, or shrink the rocket and launch it as a toy, or grow yourself and
  carry it up by hand (that's the sci-fi way).
- Space is deadly without a suit: no air, freezing in shadow, burning in sunlight. Your RIFT field covers you;
  people you bring don't get one unless they wear a suit.

### Telescope
- A real telescope in your mansion (on the roof deck). Look through it and see the real sky for that time and season:
  the Moon's craters and phase, Jupiter and its 4 big moons, Saturn's rings, Mars (red dot), Venus (phases like the moon),
  star clusters (Pleiades), the Andromeda galaxy (a fuzzy smudge). These come from the same space model, so they're in the
  right places.

### Never-bugs
- Growing never makes the ground vanish under you; each size level fades into the next.
- You never fall forever in space; you can always shrink back to Earth.
- The planets never show up in the wrong places compared to the telescope view.

---

## 4. You: your character, body and health

### Your two characters
**The Glitch** (non-human hacker scientist):
- Dark hood with nothing inside but a void, two glowing eyes and static (eyes change: squint, widen, flicker when hurt).
- Long lab coat (white with black panels, or all black, you pick colors), with an ID badge for RIFT LAB, pens in the pocket,
  burn marks from experiments.
- Techwear: chest and leg straps, a backpack with cables plugged into its forearms, glowing circuit lines running down the
  body, pulsing with your heartbeat.
- Glitch effect running all the time on the clothes: slices of the coat shift sideways, colors split red/blue, pixel blocks
  flicker, little pieces break off and float back. It gets way stronger while you shrink or grow, when you're hurt, and when
  you possess something.
- Moves like a person but a little too smooth.

**Regular dude**: black hair (messy), blue jacket, tired-looking eyes (heavy eyelids, dark circles, a "done with today" face).

### Character maker (sliders for everything)
- Body: height, weight (fat), muscle, shoulder width, waist, hips, leg length, arm length, posture, hand size, foot size.
- Face: face shape, jaw, chin, cheekbones, nose (width, length, bridge, tip), eyes (size, spacing, tilt, eyelid weight,
  eye color, dark circles), brows (shape, thickness), mouth (width, lip size), ears, forehead, skin tone, freckles, moles,
  scars, wrinkles, acne, birthmarks.
- Hair: style (long list), color, gray amount, facial hair, body hair.
- Age: kid (8) to old (90). See "Being a kid" below.
- Voice: pitch, speed, tone.
- Glitch-only: hood shape, eye color and shape, static amount, circuit color, coat length, cable count, glitch strength.
- Clothes: all slots (section 9), saved as outfits.
- Walk style: normal, confident, tired, bouncy, slouch.

### Your body (full real body)
- Real animations for everything: idle (breathing, shifting weight, looking around), walk, jog, sprint, crouch, crawl, prone,
  jump (with a crouch before it), land (light, heavy, roll), climb (ledges, ladders, fences), slide, swim, tread water, push,
  pull, carry (one hand, two hands, on the shoulder, dragging heavy stuff), throw (underhand, overhand), punch, kick, shove,
  sit (chair, couch, floor, bed edge, car seat, toilet), lie down, sleep, get up, eat, drink, type, use the phone, open doors
  (push, pull, knobs, handles, sliding), flip switches, pick up from the floor (crouch and grab), get hit (by direction and
  strength), stumble, trip, fall down stairs, ragdoll, recover, limp (hurt leg), hold a wound, shiver (cold), sweat (hot),
  cough, sneeze, yawn, stretch, dance, wave, point.
- Hands go where they should (hand IK): your hand actually grabs the doorknob, the cup, the steering wheel.
- Feet plant on stairs and slopes (foot IK), no floating feet.

### Falling, and falling down the stairs
- Fall damage depends on how fast you hit and what you hit (carpet hurts less than concrete), compared to your size (section 1).
- **Stairs**: if you run down too fast, get shoved, trip on something (a toy, a cord, a pet), or get knocked out, you fall down
  the stairs for real: you tumble step by step, hitting each step, at real speed (a tumble down a whole flight takes a couple of seconds,
  it's not instant and it's not slow-mo). You take damage on every hit (head, back, arms), can break a wrist or ankle, and end
  up at the bottom hurt. You can grab the railing to stop yourself if you have a hand free.
  Setting: "slow-mo big falls" (off by default) turns on slow-motion for big falls like a movie.

### Needs (turn them off with Robot mode)
- **Hunger**: based on calories. Your body burns calories every minute (more when you move, more when you're cold, way more
  for your size when you're tiny).
- **Thirst**: you lose water by breathing, sweating, peeing. Hot days and exercise = thirstier.
- **Sleep**: you get tired over the day; staying up makes you slower, clumsier, grumpier (real effects of no sleep).
- **Bladder**: you need the bathroom after drinking. (Optional setting.)
- **Hygiene**: you get sweaty and dirty; people notice the smell (section 17). Showers, baths, deodorant, brushing teeth.
- **Temperature**: cold makes you shiver, hot makes you sweat; extreme cold or heat hurts you.
- **Breath**: holding your breath underwater; drowning if you run out.
- **Robot mode** (setting): no hunger, thirst, sleep, bladder or hygiene. You can still eat and drink for fun.
  The Glitch defaults to Robot mode (you can turn needs on).

### Metabolism and body shape (real)
- Every person (and you, if needs are on) has a real metabolism:
  - Base calories burned at rest from their size, age, sex and muscle (the game uses a real formula that doctors use).
  - Their own genes: some people burn more just by fidgeting and moving around (real, scientists call it NEAT),
    so some people don't get fat easily and some do.
  - Activity: walking, working, the gym all burn more.
- Eat more than you burn for a while and you gain fat (about 7,700 extra calories adds about 1 kg of fat).
  Eat less and you lose it. Work out and you build muscle slowly (weeks, not minutes).
- Your body shape actually changes over days and weeks (the character's weight and muscle sliders move).
- Too little food for too long: weak, dizzy, sick. Too much junk: slower, more tired, cavities.

### Teeth
- Adults have 32 teeth, kids have 20 baby teeth (they fall out and adult teeth come in).
- Sugar + not brushing = plaque (a film of bacteria) = acid = cavities over weeks. Toothache hurts and puts you in a bad mood.
- Brush (twice a day keeps it clean), floss, the dentist fills cavities, pulls bad teeth.
- You can shrink down and see the cavity bacteria on teeth (section 2).
- Teeth can get knocked out in fights or falls.

### Health, injuries and sickness
- **Body parts**: head, neck, chest, belly, arms (upper, lower, hands), legs (upper, lower, feet). Each one can be hurt separately.
- **Injuries**: bruises, cuts (bleeding, which drains blood over time until it's stopped), deep wounds, broken bones (arm in a
  sling, leg means limping or crutches), sprains, burns (from fire, hot drinks, stoves), concussion (blurry, dizzy), shock
  (electric), poison and venom (spiders, bees, black widows, rattlesnakes), allergic reactions (bee stings for allergic people),
  frostbite, heatstroke, drowning.
- **Blood**: you have about 5 liters. Lose too much and you pass out, then die. Stop bleeding with bandages, pressure, a tourniquet.
- **Healing**: real-ish speed: bruises in days, cuts in a week or two, bones in 6+ weeks (sped up by time settings). First aid kits,
  painkillers, the pharmacy, the hospital (surgery, casts, stitches, blood transfusion).
- **Sickness (real viruses and bacteria)**: colds, flu, stomach bugs, infections in dirty wounds, food poisoning (from spoiled food).
  They spread for real: coughs and sneezes send droplets, people touch surfaces and then their face. Being around a sick person
  without washing your hands is how you catch it. Symptoms show up a day or few after you catch it (like real flu).
  Your immune system fights it; rest, water, medicine help. Vaccines exist and work.
- **Emotions affect your body**: stress raises your heart rate, makes you shake and sleep worse. Sadness makes you slow, tired,
  not hungry (or eating more), and shows in your face and posture. Heartbreak (a breakup, someone dying) hits hard for days.
  Fear spikes adrenaline (faster, stronger for a few seconds, then crashed). Happy = more energy.
- **Death**: if your health hits zero. What happens next depends on the permadeath setting (section 18):
  - Permadeath OFF: you wake up in your lab (or the hospital if someone called an ambulance), stuff you were carrying stays where you died.
  - Permadeath ON: you're dead and the world ends. The save is gone.

### Clothes, shoes, no shoes, no shirt
- Clothing slots: hat, glasses, mask, top (undershirt + shirt), jacket/coat, pants/shorts/skirt, socks, shoes, gloves,
  watch (yours is the RIFT watch), jewelry, backpack, belt (holsters, pouches).
- **Barefoot**: you feel the ground (hot asphalt in summer burns, gravel hurts, stepping on a Lego hurts a lot,
  stepping on glass cuts your foot).
- **No shirt / no shoes**: real stores have "No shirt, no shoes, no service" signs. Some workers refuse to serve you,
  depending on who they are and the store's rules.
- Clothes get dirty, wet, torn, bloody; they can be washed (washer and dryer), dried, folded, put in drawers and closets.
- Buy clothes and shoes at the clothes store, shoe section, or online (section 9). Try them on. Sizes matter (too small won't fit).

### Being a kid
- Make your character 8-17 in the character maker, or get turned into a kid by an age-changing invention (the "Age Ray",
  optional late-game lab invention) and back.
- Real-life kid rules apply to you:
  - Smaller and weaker body, smaller hands (can't hold big things).
  - Can't legally drive (you can try, cops will stop you), can't buy guns, lottery tickets, energy drinks at some stores.
  - Shops and people treat you like a kid: adults might ask where your parents are, school is on weekdays.
  - No romance or dating.
- Kid safety rules apply to you too: no gore on you ever. If something would kill a kid character, you pass out instead
  (the screen goes dark) and wake up at the hospital or home, unless permadeath is on (then the world ends, no gore shown).

### Camera
- Third-person (default) with a camera that never goes through walls, scales with your size, and zooms smoothly.
- First-person toggle (you see your own hands and body when you look down).
- At tiny sizes the camera's view distance and blur change so the world looks huge (like macro photography).

### Never-bugs
- You never get stuck in a sitting or sleeping pose.
- You never fall through stairs or slide down them like a ramp.
- Clothes never poke through your body (each layer is fitted to the one under it).
- Your hands never hold two things at once (section 5).

---

## 5. Hands, grabbing, and how objects work

### Two hands (the phone + gun problem, solved)
You have a **left hand** and a **right hand**, like real life. Each hand holds **one thing at most**. That's the whole rule,
and the game is built so it can't be broken:

- The game keeps one list: what's in your left hand, what's in your right hand, what's in each pocket, what's in your backpack,
  what's in your holster. The 3D models are drawn from that list every frame. So a phone can only ever be drawn in a hand
  or a pocket. It can never end up "stuck on the gun", because the gun isn't a place a phone can go.
- **Phone**: always comes out in your left hand. If your left hand is holding something, that thing goes to a free pocket,
  your belt or your backpack first (you see the move), then the phone comes out. If there's nowhere to put it (it's too big,
  like a box you're carrying with both hands), the phone doesn't come out and a small message says why.
- **Two-handed things** (a box, a rifle, a TV, a person you're carrying, a steering wheel) need both hands free. The game puts
  away what you can, and asks you to drop the rest.
- **Gun + phone**: gun in your right hand, phone in your left. You can text with one thumb while holding a gun (aim is shaky).
- **Pockets**: small things only (phone, keys, wallet, coins, a candy bar). Big things go in the backpack or your hands.
- **Swapping**: a hotbar shows what's in your hands and on you. Pick a slot and the game moves things between hands and pockets
  with animations.

### Picking things up (including off the floor)
- Look at anything and it highlights if you can interact with it. Small things get an extra-big highlight zone so you never
  have to pixel-hunt a coin on the carpet.
- **Pick up**: you crouch (if it's low), reach, your hand closes on it, and it's in your hand. Works on everything that's a real
  object (Rule 4), from a crumb to a couch, as long as you're strong enough for its weight at your size.
- **Too heavy to lift**: you drag or push it instead (slowly, with effort).
- **Too heavy to move at all**: you strain and nothing happens (a message says how heavy it is vs. how much you can lift).
- **Throw**: hold to wind up, let go to throw. Distance depends on weight and your strength.
- **Place**: hold to show where it'll go (a ghost of it), rotate it, set it down exactly. Stack things, hang things on hooks.
- **Drop**: let go anywhere.

### Sounds of picking stuff up
Every object has a material, and every material has its own sounds for picking up, putting down, dropping, scraping, rolling,
breaking: glass clinks, metal clangs, plastic clacks, wood knocks, paper rustles, cloth swishes, a can sloshes if it has liquid,
a bag crinkles, keys jingle, coins chime. Louder when heavier, deeper when bigger, quieter on carpet.

### Doors
- Real hinged doors: push or pull depending on the side. Knobs need turning (a tiny you can't turn one), lever handles can be
  pushed down (a mouse-size you can hang on one).
- Locks: keys, deadbolts, keypad codes, the mansion gate (code or remote). Locked doors can be broken (kick, ram, shoulder) with
  enough force (and it's loud, and it's a crime if it's not your door).
- **Gap under doors**: real interior doors have a gap of about 1-2 cm. At mouse size you can squeeze under, at ant size you
  walk under easily.
- Sliding doors, screen doors, garage doors (button or remote, with a safety sensor that stops it if something's in the way),
  pet doors (flap), car doors, cabinet doors, fridge doors (with a seal that holds them shut).
- Doors swing when people walk through, slam in the wind (if a window is open), creak if old.

### Drawers, cabinets and closets
- Drawers slide out on rails until they hit the stop. What's inside is real: the things in a drawer move with it and can roll
  to the front if you yank it hard.
- A drawer won't close if something sticks out (it actually bumps into it).
- Drawers can be locked (desks, filing cabinets), stuck (wooden drawers swell in humid weather), childproofed (latches),
  overfilled (hard to open).
- What's in a drawer depends on whose drawer it is (people put things where their habits say: the junk drawer has batteries,
  rubber bands, takeout menus, a dead pen, tape; a teen's desk drawer has chargers and snacks).
- Tiny you can climb into a drawer through the gap, and get shut in if someone closes it.

### Sitting, lying and sleeping on anything
- Chairs, couches, beds, stools, benches, car seats, toilets, the floor, stairs, a wall edge, the curb.
- At any size, anything flat at about knee height for your size can be sat on: a crumb, a matchbox, a bottle cap.
- Sleep in a bed (best sleep), on a couch (OK sleep, sore back), on the floor (bad sleep). Sleeping skips time if you want it to.
- Get under the covers (the blanket actually goes over you).

### Cloth: blankets, pillows, curtains, bags, clothes
- Blankets and sheets are real cloth: they drape, fold, slide off the bed, get pulled when someone rolls over. At tiny size a
  blanket is a moving mountain and you can get trapped under it.
- Pillows squish when you lean on them and spring back. A pillow fight is real physics. Feathers come out if one rips.
- Curtains move in the wind and when someone walks past. You can open and close them (and blinds).
- Plastic bags inflate (blow in them), crinkle, tear, float in the wind, get stuck in trees.
- Paper: tears, crumples into a ball, folds into a paper airplane that really flies.
- Clothes on the floor are real cloth piles.

### Breaking things
Everything has a real strength. If a hit is harder than that, it breaks, and how it breaks depends on the material:
- **Glass** (windows, cups, bottles, phone screens, TV screens, light bulbs, mirrors, the terrarium): cracks or shatters into
  sharp shards (real cut damage, especially barefoot or tiny). Safety glass (car windows) breaks into little cubes.
  Laminated glass (car windshields) cracks in a spiderweb but holds together.
- **Ceramic** (mugs, plates, toilets, tiles): breaks into chunks.
- **Wood** (chairs, tables, doors): splinters, snaps along the grain.
- **Plastic**: cracks, snaps, bends (toys, controllers, phone cases).
- **Electronics**: break when dropped or hit hard: a game controller thrown at the wall cracks open (the shell splits,
  buttons pop out, the battery can come loose); a smashed TV screen goes black with a crack pattern; a dropped phone gets
  a cracked screen (it still works, sort of, depending on how bad it is).
- **Metal**: dents, bends, doesn't usually break.
- **Drywall** (house walls): cracks, then punches through (fists can go through drywall in real life, and it hurts).
- **Light bulbs**: shatter (and the light goes out, and it's dark).
- **Food**: squishes, splats.
- Broken things stay broken until fixed or replaced. Broken pieces are real objects (you can pick up the shards and throw them out).
- **Rage breaking**: you can smash anything you want: throw the controller, punch the TV, flip the table. It's your stuff
  (or it's a crime if it's someone else's, section 15). People who see it react depending on who they are.

### Liquids
- Drinks pour from bottles and cans into cups, spill when knocked over (a puddle spreads, soaks into carpet, stays on tile),
  splash when stuff falls in. Sticky drinks leave sticky spots that ants find (Rule 1).
- Sinks, tubs and toilets fill and drain. Faucets have hot and cold. Leaks drip.
- Water conducts electricity: a phone in the bath is a bad idea.

### Fire
- Real fire: needs fuel, air and heat. Starts from matches, lighters, stoves, candles, fireplaces, sparks, electrical shorts,
  a toaster with a fork in it, a grill.
- Spreads to things that burn (paper, cloth, wood, curtains), makes smoke (which fills rooms from the ceiling down and sets off
  smoke alarms), can be put out with water (not on a grease fire!), a fire extinguisher, or by smothering it.
- The fire department comes if someone calls (section 15).

### Never-bugs
- You can always pick up an item on the floor if you're strong enough for it (the game tests this for every object).
- Nothing ever gets attached to the wrong thing (phone to gun, cup to hand forever, hat to the dog).
- Held items never go through walls: if you walk into a wall, the item gets pushed back toward you, not into the wall.
- Dropped items never fall through the floor or fly off into space.
- Doors never push you through walls or launch you.
- Drawers never eat items (things inside always stay inside until taken out).

---

## 6. Electronics, power, the internet, and your PC inside the game

### Power (everything has to be plugged in or charged)
- **The power grid**: power lines on poles bring electricity to the town. Each house has a meter and a breaker panel
  (in the garage). Each room is on a circuit with a breaker (real US homes: 120 volts, 15 or 20 amp breakers).
- **Outlets and plugs**: every device has a real cord with a real plug. The cord is a physics rope: it drapes, gets in the way,
  can be tripped over. A plug can come out of an outlet only if something pulls on it hard enough:
  the dog runs through the cord, the robot vacuum drags it, a person trips, a kid yanks it, you pull it, a shelf falls on it.
  No random unplugging.
- **Unplugging things**: pull the plug on the TV, the PC, the game console, the fridge, the router.
  - Unplug a PC or console while it's on: it shuts off instantly, the game you were playing on it loses progress since its last save
    (just like real life), and in rare real cases files get damaged (the game decides this from what was happening: saving a file
    when the power cut = that file gets corrupted).
  - Unplug the fridge: it warms up over hours and food starts going bad.
  - Unplug the router: the whole house loses Wi-Fi.
- **Breakers trip**: plug in too much on one circuit (space heater + microwave + hair dryer) and the breaker trips, that room goes dark.
  Flip it back on at the panel.
- **Power outages**: caused by real things: a storm knocks a tree branch into a line, a car crashes into a pole, a giant (you) steps on
  the lines, the power company does repairs. The whole street goes dark, the fridge stops, phones run on battery.
- **Generators**: a gas generator outside (loud, needs gas, makes exhaust you can't run indoors because of carbon monoxide,
  which is deadly and real), or a big battery backup / solar panels on the mansion roof.
- **Batteries**: phones, controllers, laptops, remotes, smoke alarms (that chirp when they're low, at 3 AM, like real life),
  RC cars, drones. They drain with use and recharge on chargers.
- **Light bulbs**: each one has a real lifespan (old-style bulbs about 1,000 hours, LEDs 15,000+ hours). They burn out from
  use, not randomly. They also break if hit. Change them by hand (old ones can be hot).
- **Electric shock**: touching live wires, a fork in a toaster, water + electronics. At tiny size, an outlet slot is a cave
  with two metal walls and walking between them while touching both = deadly shock.

### Light switches
- Every room's lights are wired to real switches (some rooms have two switches for one light). Flip one and the right lights
  turn on. Dimmers dim. Smart switches can be controlled from your phone.
- At tiny size you can't flip one (not enough force). Ideas that work for real: push it with a tool as a lever, get on it and
  jump (if you're heavy enough), grow a little, or use the smart-home app on your phone.

### TVs and what's on them
- TVs show the game's own channels and movies (real ones can't be copied):
  - **News channel** that reports what actually happened in the town today (section 15): "Man reports giant walking on
    Ocean Avenue", "Local family missing", weather, traffic.
  - Cartoons, a cooking show, sports (basketball, football, surfing), a nature documentary (filmed from the game's own
    micro world and creatures), a reality show, a game show, a crime drama, a horror movie, a kids show, a shopping channel,
    commercials for made-up products (and for YOUR inventions once your company exists).
  - A streaming app with made-up movies and series to pick from (each with a title, poster and a short animated movie).
- Remotes (lose them in the couch, batteries die), channels, volume, input switching (TV / console / PC).
- TVs show what's actually connected: plug a console into the TV and switch input to see the console.

### Game consoles (PS5-style) and controllers
- Made-up brands, real kinds: a big home console, a handheld one, an older console.
- Turn it on, pick a game, play it on the TV with a controller. The console's games are real little games built into SCALE
  (a racing game, a shooter, a soccer game, a platformer, a fighting game, a horror game, more).
- Controllers: wireless with batteries, rumble, can be thrown, broken (section 5), chewed by the dog.
- Inside the console: section 1 (fan, heat sink, chips).
- It gets hot and loud if the vents are blocked or dusty.

### VR headset
- Put it on (it goes on your head, in your character's real view): you're in a virtual world (a VR game: a space station,
  a boxing ring, a theme park), your real body still stands in the room. People in the room see you swinging your arms around.
  You can walk into a wall in real life while in VR (bump, ouch), trip over things, hit the TV.
- Take it off to be back.

### Your PC (and every PC in town)
- **Build it yourself** (designing your PC): case, motherboard, CPU, graphics card, RAM, storage (SSD/hard drive), power supply,
  cooler, case fans, RGB lights, cables. Real rules:
  - Parts must fit (CPU socket matches the motherboard, the graphics card fits in the case, the power supply has enough watts).
  - Plug it together for real: cables in the right places, and if you plug the monitor into the motherboard instead of the
    graphics card, you don't get the graphics card's power (that's a real mistake people make).
  - Graphics cards from a small 2 GB low-profile card up to a giant triple-fan flagship card. Better card = games run better.
  - Everything is made-up brands with real-style specs.
- **Using the PC**: sit at the desk and the screen fills your view: a full desktop like a real computer (made-up OS):
  - Start menu, windows, a taskbar, a clock, notifications, a wallpaper you can change.
  - **Web browser** with the game's own internet (below).
  - **Game launcher**: download games from a game store (downloads take real time depending on your internet speed and the
    game size), install, play them. They run on the PC's actual in-game hardware: on a weak graphics card the in-game game runs
    at low frames and looks worse (lower resolution, choppy), on a strong card it's smooth. You see an FPS counter.
  - **AI chat app**: chat with an AI on your in-game PC. It can answer questions, help you, and **make games**: tell it
    "make a game where a frog jumps on cars" and it writes a small game you can play right there on the in-game PC.
    This uses the AI brain setting (section 10): your own Claude key (best) or a free local AI. Without either, it can still
    make games from built-in templates (it mixes pieces it knows: a jumper, a shooter, a racer, with your words for the
    characters and colors).
  - Music app, video player, paint app, notes, a camera app (webcam), file explorer, a settings app, an antivirus.
  - **Viruses**: downloading sketchy stuff (cracked games, weird links, dark web files) can infect the PC: pop-ups, slowdown,
    the webcam light turns on by itself, files get locked (ransomware asks for money), your in-game bank money gets stolen.
    Fix it with the antivirus, a reset, or a tech shop. Nothing on the real PC is ever touched, it's all inside the game.
- **Keyboard and mouse**: at normal size you use them normally. At tiny size the keyboard is a field of giant buttons; jump on
  a key (if you're heavy enough to push it down about 2-4 mm) and it types a letter on the screen. A mouse is a big plastic
  shell you can push to move the cursor (like a car you push).
- Laptops (battery, lid closes, it sleeps), tablets, old desktop PCs at school.

### The internet inside the game
**Getting internet works like real life: you pay for it.**
- **Internet companies**: made-up providers in town (a cable company, a fiber company, a cheap one with bad service).
  Each has plans: speeds (slow, medium, fast, gigabit fiber), monthly price, a contract or no contract, and real
  service quality (the cheap one goes down more when it's busy at night).
- **Signing up**: call them on your phone, go to their store downtown, or sign up on their website at a library or
  café computer (you don't have internet at home yet). You pick a plan, they run a credit check, set a monthly bill.
- **The internet box**: they mail you a modem + Wi-Fi router box (or a technician comes on a scheduled day and time,
  and you have to be home to let them in). You plug the modem into the wall jack and power, connect the router, wait for
  the lights to turn green, then set the Wi-Fi name and password. Do it wrong (wrong cable, no power) and nothing works.
- **The bill**: comes every month (in the mail and in your email/bank app). Pay it on time or you get late fees, then
  the speed drops, then the company **cuts your internet off** until you pay. Autopay is an option.
- **Wi-Fi in your house**: the router has a real range; walls and floors weaken it, so the basement lab and the far end of
  the mansion get weak signal unless you buy and set up mesh Wi-Fi boxes or extenders. The PC can use a cable instead
  (faster, steadier). Too many devices streaming at once = everything slows down.
- **Speed test app**: shows your real in-game speed; downloads, video and online games depend on it.
- **Other people's Wi-Fi**: every house has its own network with a name you can see on your phone. Locked ones need the
  password (a neighbor might give it to you if they like you, or you can find it written on their fridge). Using someone's
  Wi-Fi without asking is something people react to if they find out. Open public Wi-Fi at the café, library and airport-style
  spots (slow, and sketchy for logging into your bank).
- **Phone service**: your phone has its own monthly plan (made-up carriers) with a data limit; go over it and it slows to a
  crawl or costs extra. Signal is real: full bars outside, weak in the basement, the sewer, inside a fridge.
  You can turn your phone into a hotspot for your laptop.
- **Outages**: storms, a truck hitting a pole, the company doing work, a squirrel chewing a line (real), you unplugging
  the box, or not paying. The company's app shows the outage and when it should be fixed.
- Unplug the router = no internet. Power outage = no Wi-Fi (unless the router is on a battery backup).
- Websites (all made up, all inside the game):
  - A search engine (search for things in the town, people, products, how-to guides).
  - A social media site where townspeople post what happens to them, with comments and likes
    ("bro there's a GIANT at the beach", posts from people's real lives, vacation pics, rants).
  - A video site (people post videos, including videos of you if they filmed you).
  - A news site (same stories as the TV).
  - The shopping site (same as the phone's shopping app).
  - A bank site, email, a maps site, a job site, a weather site, forums, a wiki about the town's history.
  - **The dark web**: a hidden part you reach with a special browser. Illegal shop listings (stolen stuff, fake IDs,
    restricted parts), scammers (you can get ripped off), and police stings (buying illegal stuff can get you arrested, section 15).
    It's a game system, made-up sites only.

### Phones (yours and everyone else's)
- You hold it in your left hand (section 5). The screen shows real apps:
  - **Shop** (the spawn menu, looks like a real shopping app, section 9).
  - **Messages** (texting, people text you back based on who they are, section 10), **Phone** (calls), **Contacts**.
  - **Camera** (photos, videos, selfie, zoom; photos save to your gallery and you can post them).
  - **Maps** (the town and where people are that share their location with you).
  - **Music** (section 17), **Radio**, **Podcasts** (made-up shows).
  - **Bank** (your money, transfers, your company's money).
  - **Home** (your mansion: lights, cameras, gate, alarm, garage door, thermostat, locks).
  - **Social**, **News**, **Weather**, **Clock** (alarms, timer), **Notes**, **Calculator**, **Flashlight**.
  - **Lab** (your RIFT LAB stuff: inventions, experiments, the business app).
  - **Inspect** (point the camera at anything to see what it is and where it came from, section 13).
- Phone battery, charging cable, cracked screen when dropped, calls ringing at bad times, notifications.
- Other people's phones: they text, call, scroll, film you, call 911 when they see something crazy.

### Smart home and security (your mansion)
- **Gate** with a keypad and remote, **cameras** around the mansion (watch them live on your phone or the security monitor
  in the lab), **alarm** (arms at night, triggers when doors or windows open, calls the security company, which calls police).
- Motion lights, smart locks, a doorbell camera, a thermostat (AC/heat), smoke and CO alarms.

### Appliances (each one works like the real thing)
- Fridge (cold inside, light turns on when opened, freezer, ice maker, food goes bad if the door's left open),
  oven and stove (gas flames or electric coils, burns), microwave (spins, beeps, sparks if you put metal in it),
  dishwasher, washing machine (fills, spins, drains; a tiny you inside gets tumbled and drowned), dryer (hot, tumbles),
  toaster (pops), coffee maker, kettle (whistles), blender (deadly at tiny size), air fryer, garbage disposal (deadly),
  vacuum cleaner (sucks up crumbs and tiny you), robot vacuum (drives its pattern, sucks up tiny things, gets stuck on cords),
  hair dryer, hair clippers, electric toothbrush, ceiling fans (wind, can fling you), space heater, air conditioner,
  water heater, garage door opener, doorbell, clocks (wall clocks tick), smoke alarms.
- Water: faucets, showers, bathtubs, toilets (flush spins water and sucks small things down to the sewer, section 13),
  garden hose, sprinklers (on timers, real water drops that knock tiny you over).

### Music instruments and the piano
- **Piano** (grand piano in the mansion): play it with your keyboard keys or clicking. 88 keys, real notes, real piano sound,
  sustain pedal. At tiny size, jump on keys to play notes, and you can climb inside to see the hammers hit the strings.
- Guitar, drums, keyboard, violin, trumpet, ukulele: playable simply, with real sounds.

### Never-bugs
- A device never works when it's unplugged and its battery is dead.
- The TV never shows the wrong thing for its input.
- The PC desktop never traps you (Esc always gets you out).
- Cords never stretch forever or glitch through walls.

---

## 7. Weapons, inventions, the lab, and experiments

### RIFT LAB inventions (sci-fi, made in your basement)
Each one has ONE invented trick; everything it does after that is real physics.
- **Shrink ray**: resizes what you point at (section 1).
- **Black hole gun**: fires a tiny contained black hole that pulls things in for a few seconds. The invented part: it's held stable
  by a RIFT field and you set how strong it is. The real part: stuff closer to it gets pulled way harder (gravity gets stronger
  fast as you get closer), so things stretch toward it, spiral in, slam together, and get crushed into a ball of junk. Light bends
  around it (you see the background warp). When it runs out, the crushed ball drops (and it's heavy, it's everything it ate).
  A strong one can tear a room apart. People, pets and bugs get pulled in too (kids are pushed out of range).
- **Freeze gun**: fires a beam that sucks heat out of things. Water freezes into ice, drinks freeze and burst their cans,
  people and animals get frostbite, slow down, then freeze solid (adults only). Frozen things become brittle and shatter when hit
  (real: very cold things break like glass). Frozen stuff thaws over time.
- **Grow/shrink grenade**: resizes everything in a radius.
- **Copy machine** (late game): scans an object and builds a copy from raw materials you feed it (needs the right materials
  by weight, so it's not free stuff).
- **Gravity gun**: grabs and holds things at a distance, throws them.
- **Age ray** (optional): makes an adult older or younger (never affects kids).
- **Possession headset**: lets you control any living thing (section 12).
- **Size-locked terrarium**: keeps whatever's inside it at the size it was shrunk to.
- **Teleport pads**: two pads; walk on one, appear on the other.
- **Rift portal**: drops things you order in "sandbox mode" (section 9).
- **Weather machine** (late game): changes the local weather.
- More get added: the lab has an invention tree (below).

### Making your own stuff (gadgets, guns, furniture)
- **Workbench** in the lab and in the garage: pick a blueprint, have the parts, build it (you see it get assembled).
- **Blueprints**: found, bought, or made in the lab by researching. Research takes time and materials.
- **Parts** are real objects: batteries, wires, circuit boards, motors, lenses, magnets, springs, screws, pipes, sheet metal,
  plastic, wood, glass, and RIFT crystals (from your lab machine, the only invented material).
- Gadgets you can build: the inventions above, drones, RC cars, a metal detector, a walkie-talkie, a jetpack (RIFT-powered),
  a grappling hook, night-vision goggles, a robot helper, a laser pointer (cats chase it, real), a bug catcher, a mini-fridge.
- **Making your own guns**: a gunsmith bench in the lab. You combine game parts (frame, barrel, grip, sight, magazine type,
  RIFT modules) into your own design and name it. It's a game crafting system, not a how-to. Guns you make work by game rules.
- **Building furniture**: buy flat-pack furniture (assemble it with the instructions, a screwdriver and an allen key;
  skip a step and it wobbles or collapses), or build from wood (saw, drill, screws, glue). Shrunk people build their own
  (section 11).

### Real weapons
- **Normal-size**: fists and kicks, baseball bat, golf club, kitchen knife, broom, frying pan, crowbar, hammer, shovel,
  fly swatter, rolled-up newspaper, a shoe, pepper spray, a taser.
- **Tiny-size** (whatever's around at your scale): sewing needle (a spear/sword), toothpick (spear), thumbtack, staple,
  a pin, a splinter, a match (light it and it's a torch, or a fire weapon), a paperclip (bent into a hook), a bottle cap
  (shield), a razor blade (very sharp, dangerous to you too), a rubber band (slingshot).
- **Guns** (bought at the gun store or found): pistols, revolvers, shotguns, hunting rifles, airsoft and BB guns,
  paintball guns, nerf blasters, plus your RIFT guns. Made-up brands.
  - Shooting: real-feeling recoil, bullet drop over distance, bullets that go through thin walls (drywall) but not
    concrete, ricochets off metal, sound that people hear across the neighborhood (and they call the police).
  - Damage depends on where you hit and the size of the target; at tiny size a BB is a cannonball.
  - Ammo, reloading, jams if dirty, cleaning.
  - Buying one follows California's real rules: you have to be 21, pass a background check and a safety test,
    and wait 10 days before you can pick it up. People react to you holding a gun depending on who they are
    (they run, call 911, or a cop tells you to drop it).

### Sprays
- **Bug spray**: real bug sprays attack insects' nervous systems; bugs that get hit twitch, flip over and die after a bit.
  At tiny size it's a toxic fog that hurts you too. People cough if sprayed in the face.
- **Air freshener**: makes a smell cloud that covers bad smells for a while (section 17).
- **Perfume and cologne**: a smell people react to depending on whether they like it (section 10).
- **Pepper spray**: burns eyes, people can't see, cough, cry.
- **Spray paint**: paint on walls (graffiti, a crime on other people's stuff), cars, anything.
- **Cleaning spray**, **hairspray**, **deodorant**, **WD-40**, **cooking spray**, **sunscreen spray**, **fire extinguisher**.
- Aerosol cans + fire = a flamethrower-like burst (dangerous, real).

### The experiment room (adults only, made-up people)
- In your basement lab: an **experiment chair** with straps, a scanner arch, a monitor wall, glass observation tanks,
  operating table, specimen jars, a cage area, a walk-in observation box with a one-way mirror.
- Put an adult in the chair and strap them in (they fight it depending on how strong and how scared they are).
- Experiments are RIFT LAB science:
  - Size experiments: shrink them partway, grow them, shrink just one body part (a hand, their head) and watch them react.
  - Glitch infusion: they start glitching like The Glitch (flickering, static on their skin).
  - Scanner: shows their heart rate, brain activity, stress level, what emotion they're feeling right now, their health.
  - Put creatures in the observation tank with them (spiders, a mantis, a rat), at any size.
  - Feeding tests, sleep tests, temperature tests.
- They react the way their personality says: begging, bargaining, lying, staying calm, panicking, fighting back.
  They remember it forever (section 10). If they get out, they go to the police: that's kidnapping (section 15).

### Anatomy (adults only)
- Every adult NPC has a real body inside: skin, fat, muscle, bones (206 of them), and organs: brain, eyes, heart, lungs,
  stomach, liver, kidneys, intestines, bladder, plus blood vessels.
- With max gore on, injuries show what's under the skin, and you can do surgery-style cutting on an adult in the lab
  or the operating room: look at the brain, take out and hold the heart (it beats for a short time, like real hearts can),
  study the organs. The organs are real objects you can pick up, put in jars, put in the freezer.
- This is the same body system hospitals use for surgery on injured people (below).

### Hospital and doctors
- The town hospital: ER, ambulances (they come when someone calls 911), doctors, nurses, surgery, X-rays (see broken bones),
  MRI, casts, stitches, blood bank, pharmacy, maternity ward (babies are born here, section 10), morgue.
- Injured people get treated if they get there in time. People can die from blood loss on the way.
- You can be a patient (wake up here after getting hurt, if permadeath is off and someone called 911). Hospital bills cost money.
- Dentist office, eye doctor, vet clinic (for pets), the pharmacy (medicine, prescriptions).

### Never-bugs
- A gun never shoots through solid concrete, bullets never hit things behind you.
- Black holes never get stuck forever or eat the ground.
- The experiment chair always lets you release someone.
- Inventions never work without power/charge when they need it.

---

## 8. Food, drinks, and everything you eat

### How eating works
- Pick up food, eat it (bite by bite, the food actually gets smaller with bite marks), drink (the liquid level goes down).
- Every food has real calories, sugar, salt, protein, fat, water, caffeine, and a real size and weight.
- Food fills hunger, drinks fill thirst, salty food makes you thirstier, coffee and energy drinks give energy then a crash,
  sugar gives a quick boost and feeds the cavity bacteria (section 4).
- Eating leaves stuff: crumbs (chips, cookies, bread), wrappers, cans, bottles, cores, peels, bones, stains. Where you eat
  is where the crumbs go (Rule 1), and the ants find them.
- Food goes bad over real time: bread gets stale then moldy (about a week), milk sours (about a week after opening),
  fruit browns and rots, meat goes bad fast out of the fridge (hours), chips go stale if the bag's left open.
  The fridge slows it way down, the freezer stops it. Spoiled food = food poisoning (section 4).
- Allergies: some people are allergic to peanuts, shellfish, etc. (it's part of who they are).
- At tiny size, food is a landscape: a cookie is a rock field, a gummy bear is a bouncy mountain you can sink into, a chip is a
  salty cliff, spilled soda is a sticky lake, a sugar cube is a white building.

### Cooking
- Stove, oven, microwave, grill, air fryer, toaster, blender, coffee maker, kettle, slow cooker.
- Real cooking: raw food cooks over time (meat changes color, eggs set, bread toasts), burns if left too long (smoke, smoke alarm),
  boils over, catches fire (grease fire: water makes it worse, a lid or extinguisher puts it out).
- Recipes: combine ingredients (or cook freestyle). People cook based on their skills and habits (a chef cooks fancy,
  a college student makes ramen).

### The food list (grocery store, kitchen, restaurants)
**Snacks**: potato chips (plain, salt and vinegar, barbecue, sour cream and onion), tortilla chips, cheese puffs, pretzels,
popcorn (microwave bags that pop for real), crackers, cheese crackers, cookies (chocolate chip, sandwich cookies, oatmeal),
granola bars, protein bars, trail mix, peanuts, sunflower seeds (people spit the shells), beef jerky, fruit snacks,
gummy bears, gummy worms, sour gummies, chocolate bars, candy bars, lollipops, hard candy, mints, gum (people stick it
under desks and spit it on sidewalks, Rule 1), cotton candy (boardwalk), rice cakes, pudding cups, Jell-O, ice cream bars,
popsicles, donuts, muffins, cupcakes, brownies.

**Drinks**: water (bottles, tap, filtered, sparkling), soda (cola, lemon-lime, orange, root beer, diet), energy drinks
(adults, in real life many stores don't sell them to kids), sports drinks, iced tea, lemonade, juice (orange, apple, grape,
cranberry), juice boxes, milk (whole, 2%, skim, chocolate, oat, almond), coffee (hot, iced, cold brew, espresso drinks at
the café), tea, hot chocolate, smoothies, milkshakes, boba tea, coconut water, kombucha. Adults at the restaurant can order
beer and wine (21+, it makes them tipsy and their choices worse, real); it's not something you need to drink.

**Breakfast**: cereal (milk gets soggy over time), oatmeal, eggs (fried, scrambled, boiled), bacon, sausage, pancakes,
waffles, French toast, toast with butter or jam, bagels with cream cheese, yogurt, fruit, breakfast burritos, avocado toast.

**Meals**: pizza (whole pies and slices), burgers, cheeseburgers, hot dogs, sandwiches (turkey, ham, PB&J, grilled cheese),
tacos, burritos, quesadillas, nachos, sushi, ramen (instant and restaurant), spaghetti, mac and cheese, lasagna, fried
chicken, chicken nuggets, wings, steak, salmon, fish tacos (California coast!), fried rice, orange chicken, pad thai,
curry, pho, salad, soup, chili, BBQ ribs, meatloaf, mashed potatoes, fries, onion rings, corn dogs (boardwalk), clam chowder
in a bread bowl (pier), fish and chips (pier), poke bowls, burritos California-style (with fries inside).

**Groceries / ingredients**: bread (loaf, buns, tortillas), rice, pasta, flour, sugar, salt, pepper, spices, oil, butter,
eggs, milk, cheese (shredded, sliced, blocks), meats (raw chicken, ground beef, steak, fish, shrimp), deli meats, beans,
canned soup, canned tuna, peanut butter, jelly, honey, syrup, ketchup, mustard, mayo, hot sauce, soy sauce, ranch,
frozen pizzas, frozen dinners, ice cream tubs, frozen veggies, cereal boxes.

**Fruit and vegetables**: apples, bananas (brown spots over days), oranges, lemons, limes, grapes, strawberries, blueberries,
watermelon (huge at tiny size), pineapple, mango, avocados (California!), peaches, cherries, tomatoes, lettuce, spinach,
carrots, potatoes, onions (cutting them makes people cry, real), garlic, peppers, broccoli, corn, cucumbers, mushrooms,
pumpkins (Halloween).

**Pet food**: dog food, cat food, treats, bird seed, fish flakes. (Pets eat it; the dog also eats anything it can reach.)

**Medicine and health**: painkillers, cold medicine, allergy pills, vitamins, bandages, antiseptic, cough drops,
prescription bottles (with names on them), first aid kits (section 7, pharmacy).

### Restaurants and food places (section 13)
- Each has a real menu with prices, real cooks and servers, orders take time to make, food comes on plates or in bags,
  tips, bills, leftovers in takeout boxes.

### Never-bugs
- Food never floats after you eat it (it's gone or it's leftovers).
- Drinks never refill by themselves.
- A bite never comes back.

---

## 9. The shopping app (spawn menu) and the catalog of everything

### How it works
The spawn menu is an app on your phone that looks and works like a real shopping app: a search bar, categories, item pages
with pictures (real rendered images of the 3D model, no emojis), price, size, weight, material, reviews from townspeople,
a cart, and checkout.

Two modes (pick when you make a world, change in settings):
- **Sandbox mode**: everything is free and arrives instantly through a RIFT portal next to you (or where you aim).
  You pick the size it arrives at: real size, your size, or any size.
- **Real-life mode**: everything costs real money (realistic prices). Delivery takes time: a delivery van drives to your gate,
  the driver walks it up (or leaves it at the gate if it's closed and nobody's there). A porch thief (someone in town with low
  honesty who's nearby) can steal packages left outside, and your cameras record it. Big stuff (furniture, a car) comes on a truck.
  Stores in town sell the same things in person, sometimes cheaper, and you carry them home.

You can also sell your own inventions in this app (section 15).

### The catalog
**Furniture**: sofas (2-seat, 3-seat, sectional, leather, fabric), recliners, armchairs, beanbags, coffee tables, side tables,
TV stands, bookshelves, dining tables, chairs, bar stools, desks, gaming chairs, office chairs, beds (twin, full, queen, king,
bunk, crib), mattresses, nightstands, dressers, wardrobes, mirrors, shoe racks, coat racks, benches, ottomans, cabinets,
patio furniture, hammocks, hot tub, outdoor grill, fire pit, umbrellas, kids' beds, toy chests, flat-pack kits (build them).

**Decor and stuff for walls**: posters (made-up movies, bands, games, sports, art), framed paintings, photos, mirrors,
clocks, shelves, neon signs, LED strips, string lights, wall stickers/decals, **animated stickers** (they move: a looping
animation on the wall, on your PC, on your car, on your phone case), flags, tapestries, rugs, curtains, blinds, plants
(real and fake), vases, candles, lamps, lava lamps, figurines, trophies, snow globes, wallpaper and paint (paint walls
any color), floor types.
- **Stickers**: put stickers on anything (walls, laptops, cars, the fridge, your skateboard, other people's stuff if you're rude).
  They peel off and leave sticky marks.

**Electronics**: phones, phone cases, chargers, power banks, earbuds, headphones, smartwatches, tablets, laptops, desktop PCs,
PC parts (section 6), monitors, keyboards (mechanical, clicky), mice, mousepads, webcams, microphones, speakers, soundbars,
TVs (small to huge), projectors, game consoles, controllers, VR headsets, handheld consoles, cameras, drones, RC cars and planes,
routers, smart speakers, smart lights, security cameras, printers (they jam), 3D printers (print simple objects),
batteries (AA, AAA, 9V, coin cells), extension cords, power strips, generators, solar panels, flashlights, radios,
walkie-talkies, electric scooters.

**Clothes and shoes**: t-shirts, hoodies, jackets (puffer, denim, leather, rain), button-ups, polos, tank tops, sweaters,
jeans, sweatpants, shorts, cargo pants, dresses, skirts, suits, uniforms, swimsuits, pajamas, underwear, socks,
sneakers, running shoes, boots, sandals, flip-flops, slides, dress shoes, heels, cleats, slippers, hats (caps, beanies,
bucket hats), sunglasses, glasses, watches, chains, rings, earrings, belts, backpacks, purses, wallets, gloves, scarves,
masks, costumes (Halloween), the RIFT lab coat and Glitch techwear pieces.

**Tools and hardware** (hardware store): hammer, screwdrivers, drill, saw, wrench set, pliers, tape measure, level,
utility knife, ladder, shovel, rake, hoe, wheelbarrow, hose, sprinkler, lawn mower, leaf blower, chainsaw, nails, screws,
bolts, glue (super glue sticks tiny you to things!), duct tape, zip ties, rope, chain, padlocks, paint, brushes, rollers,
lumber, plywood, drywall, cement bags, bricks, pipes, wire, light bulbs, outlets, switches, fire extinguisher, smoke alarms,
ant traps, mouse traps (snap traps are deadly at mouse size and lower), bug spray, weed killer, fertilizer, seeds.

**Building materials for tiny builders** (great for shrunk people, section 11): toothpicks, popsicle sticks, matchsticks,
matchboxes, cotton balls, cotton swabs, bottle caps, buttons, coins, paperclips, thumbtacks, pins, needles, thread spools,
yarn, fabric scraps, cardboard, playing cards, sugar cubes, LEGO-style bricks, string, rubber bands, tape, glue, wire,
LEDs, coin batteries, tiny motors, phone screens (broken), straws, pen springs, marbles, bottle corks, clothespins,
egg cartons, tissue, foil, plastic wrap, seeds, soil, pebbles, sand.

**Containers**: glass terrarium, fish tank, jars with lids (punch air holes or not), shoebox, cardboard boxes, plastic bins,
cages (hamster, bird), buckets, cups, bowls, plates, tupperware, lunchboxes, bags (paper, plastic, ziplock), backpacks,
suitcases, trash bags, a dollhouse.

**Toys and games**: balls (basketball, soccer, football, tennis, bouncy), frisbee, kite, yo-yo, toy cars, action figures,
dolls, stuffed animals, LEGO-style sets, board games, playing cards, puzzles, Rubik's-style cube, nerf blasters, water guns,
water balloons, slime, fidget spinners, skateboard, bike, scooter, roller skates, pogo stick, trampoline, swing set,
sandbox, bubbles, chalk, crayons, paint, play-doh, dollhouse, toy kitchen, train set, magnifying glass (focuses sunlight
into a hot dot that burns: real, and dangerous for tiny you), ant farm.

**Sports and fitness**: basketball hoop, weights, dumbbells, bench, treadmill, exercise bike, yoga mat, surfboard,
boogie board, wetsuit, skateboard, golf clubs, baseball bat and glove, tennis racket, boxing gloves and bag, jump rope,
bike helmet, pool floaties.

**Music**: guitars, keyboards, drums, microphones, speakers, record player and records, headphones.

**Kitchen and home**: pots, pans, knives, cutting boards, utensils, plates, cups, mugs, glasses, blender, toaster,
coffee maker, microwave, kettle, dish soap, sponges, paper towels, trash cans, recycling bins, laundry baskets,
detergent, iron, ironing board, vacuum, broom, mop, bucket, toilet paper, towels, shower curtain, toothbrush, toothpaste,
floss, shampoo, soap, deodorant, razor, hair dryer, makeup, perfume, cologne, nail polish, hairbrush, sunscreen.

**Garden and nature**: potted plants, flowers, seeds (they grow over real days when watered and in sun), trees (saplings),
soil, mulch, rocks, garden gnomes, bird feeders (birds come), bird baths, fountains, pond kits.

**Animals and creatures** (sandbox mode or the pet store, section 12): dogs (many breeds), cats, hamsters, guinea pigs,
rabbits, birds (parakeet, parrot), fish, turtles, lizards, snakes, frogs, tarantulas, ant farms, plus any wild creature in
sandbox mode (bugs, mantis, spiders, mice, rats, raccoons...).

**People** (sandbox mode): spawn a made-up adult with a job and personality (pick or random from the seed), or a whole family.

**Vehicles** (section 14): cars, trucks, motorcycles, bikes, skateboards, scooters, golf carts, RC cars, drones, boats,
jet skis, a rocket (late game).

**Lab and science**: microscopes (real ones, look at tiny stuff without shrinking), test tubes, beakers, lab coats, goggles,
RIFT parts, cages, specimen jars, a whiteboard, server racks.

**Holiday stuff** (section 16): Halloween decorations, costumes, pumpkins, candy bowls, Christmas trees, lights, ornaments,
wrapping paper, presents, stockings, fireworks (where legal), party supplies, balloons, birthday cakes, candles.

### Never-bugs
- Every item in the catalog spawns as a real, working object (never a fake prop that can't be picked up).
- Search always finds what you type if it exists (search "chips", get every chip).
- Items never spawn inside walls or people (the portal finds free space).
- Paying never takes money twice; a delivery never vanishes without a cause (if it's stolen, you can see who did it on camera).

---

## 10. People: their minds, choices, talking, love and family

### Who lives in town
- A whole town of made-up people (about 60-100 living in it, more passing through: delivery drivers, tourists at the beach,
  surfers, workers). Each has a name, age, looks (from the same character maker you use), a home, a job (or school),
  a family, friends, enemies, a schedule, habits, and stuff they own.
- Neighbors are generated from the world seed: who moves in next door depends on the world.

### How a person's mind works (no coin flips)
Each person has these, decided once when the world is made, changing slowly from what happens to them:
- **Personality traits** (0-100 each): honesty, kindness, bravery, curiosity, greed, patience, temper, impulsiveness,
  laziness, neatness, confidence, shyness, trust, loyalty, humor, jealousy, empathy, stubbornness, risk-taking, weirdness.
- **Values**: what they care about (family, money, rules, fun, faith, health, status, nature, science).
- **Likes and dislikes**: foods, music, smells (perfume they like or hate), colors, hobbies, kinds of people, animals
  (some love dogs, some are scared of them), bugs (some people are terrified of spiders, real phobias).
- **Skills**: cooking, fixing cars, electronics, carpentry, medicine, fighting, driving, talking, art, sports, computers.
- **Needs right now**: hunger, thirst, sleep, bathroom, money, safety, company, fun.
- **Emotions right now**: happy, sad, scared, angry, disgusted, surprised, calm, stressed, bored, in love, embarrassed,
  guilty, lonely. Emotions come from events and fade over time.
- **Memories**: what happened to them and who did it (you shrank them, you gave them food, you hit their dog, you were nice).
  Big events are remembered forever, small ones fade.
- **Relationships**: how much they like, trust, respect, fear, and are attracted to each person (including you).

**How they decide** (example): you ask Marcus to follow you to your basement.
The game adds up what Marcus's mind cares about:
- How much he trusts you (from his memories of you).
- How curious he is vs. how careful.
- How much he wants something you offered ("I'll pay you $50" matters a lot to someone greedy or broke).
- What he's doing right now (he's late for work: big minus).
- How scary the situation is (it's 2 AM and you're holding a ray gun: big minus for most people).
- His fear of you (if he's seen you be a giant, a lot).
Then he picks the option that's best **for him**: come with you, say no, or **lie** ("sure, I'll come right after I grab my keys"
and then he leaves, or calls the cops). He only lies if lying is better for him AND his honesty is low enough that he's willing to.
Same Marcus, same situation = same choice. Change the situation (offer more money, ask in daylight, be his friend first) and the
choice changes. Nothing is a 50/50.

### Talking to people
- Walk up to anyone and talk. Options: type anything you want, or pick from suggested things to say.
- **AI brain** (setting, section 18):
  - **Your own Claude API key**: people answer like real people, using everything the game knows about them
    (their traits, mood, memories of you, what they can see right now). Their answer is turned back into actions in the game
    (follow you, refuse, run, call someone, give you something, lie). The key stays only in your browser on your computer.
  - **Free local AI**: runs on your own computer if it's strong enough (it needs a decent graphics card; on weak ones it's slow).
  - **Built-in brain** (always works, no internet): people answer from written lines picked by their personality, mood and memories.
- Every person has a voice that fits them (pitch, speed, accent options), with subtitles ON by default.
- Lines never get cut off: the next line waits until the current one is finished, and muting doesn't make lines skip.
- People talk to each other too: gossip, arguments, jokes, small talk, phone calls you can overhear.

### Jobs in town (who does what)
Police officers, detectives, firefighters, paramedics, doctors, nurses, surgeons, dentist, vet, pharmacist, teachers,
principal, school bus driver, janitor, lifeguards, surf instructor, cashiers, grocery stockers, barista, cooks, chef,
waiters, restaurant owner, gas station clerk, mechanic, car salesman, barber, hairstylist, clothes store worker,
electronics store worker, pet store worker, bank teller, bank manager, gun store owner, hardware store worker,
electrician, plumber, carpenter, construction workers, roofer, landscaper/gardener, pool cleaner, house cleaner,
exterminator, animal control officer, mail carrier, delivery drivers, garbage truck crew, bus driver, taxi/rideshare driver,
lawyer, judge, court clerk, real estate agent, mayor, city workers, news reporter, camera operator, photographer,
artist, musician (plays on the boardwalk), YouTuber/streamer, programmer (works from home), engineer, scientist,
security guard (your mansion's security company), arcade worker, Ferris wheel operator, fisherman (on the pier),
retired people, students (high school, college), kids, stay-at-home parents, unemployed people.

### Daily life
- Real schedules that depend on the person: wake up (early birds and night owls), shower, eat breakfast, commute
  (drive, bus, bike, walk), work, lunch, errands, gym, pick up kids, cook dinner, TV, phone, games, walk the dog, sleep.
  Weekends are different (beach, park, sleep in, parties, church, chores, yard work).
- They use the real things around them (they open the fridge, sit on the couch, use the bathroom, flip light switches,
  charge their phones, take out the trash on trash night).
- They react to what's around them: rain = umbrellas and staying in, heat = beach, a sale = shopping.

### How people react to you (depends on them, your size, and what you've done)
- **Normal size**: like any person. Friendly to strangers or not, depending on them and on your reputation.
- **Giant**: almost everyone panics: run, scream, hide, film you on their phone, call 911. Brave/curious ones get closer.
- **Tiny**: they might not notice you at all. If they do: scream and squish (scared + low empathy), trap you in a cup (curious),
  try to help (kind), show their friends, call animal control because they think you're a bug.
- **Shrinking someone**: depends totally on them (section 11).
- **Littering**: drop trash in public and people who see it react from who they are: some say "hey, pick that up",
  some give you a look, some don't care, some litter too. A cop can fine you (California littering fines start around $250).
- **Rudeness, crime, kindness**: all remembered, all spread by gossip (they tell their friends and post about it).

### Love, dating, texting and ghosting (adults only, family-friendly)
- Every adult has their own attraction: what they like in looks, personality, style, smell (section 17), how you treat people,
  money, humor, shared hobbies. Some will like you, some won't, and that comes from who they are and what you do.
- Flirt, compliment, ask them out, go on dates (café, restaurant, beach, pier, Ferris wheel, arcade, movie night).
- **Texting**: you swap numbers and they text you like real people: good morning texts if they like you, slow replies if they're
  busy or not that into you, memes, "wyd", jealousy if they see you with someone else, angry texts after a fight.
- **Ghosting**: someone who's losing interest and doesn't like conflict stops answering (they leave you on read).
  A direct person tells you it's over. It's from their traits.
- Relationships go: strangers, friends, dating, together, moving in, engaged, married, or breakups, divorce.
- NPCs date each other too (and break up, cheat, make up) based on their own traits.

### Family, pregnancy and babies (family-friendly)
- Couples can decide to have a baby (if they want kids, from their values and their relationship). Pregnancy lasts the real
  40 weeks scaled by the time setting (you can choose how fast). The belly grows, they go to the doctor, the baby is born at the
  hospital (it cuts to after).
- Or adopt (an adoption agency in the city, paperwork and a home visit).
- Babies need feeding, diapers, sleep (they cry at night), then grow into toddlers, then kids, then teens, then adults
  (on a time scale you set). Kids go to school, make friends, get in trouble, have their own personalities from their parents
  plus how they're raised.
- You can have kids too (with a partner, or adopt).
- Remember Rule 6: kids are always safe from harm.

### Getting older, dying, funerals
- People age slowly (time setting). Old people get slower, wrinklier, grayer.
- People can die from injuries, sickness, old age, accidents, crime, creatures (adults only).
- When someone dies: the family grieves (sadness affects their body and routine for weeks), a funeral at the church/cemetery,
  the house might get sold, a new family might move in. People remember the dead.

### Never-bugs
- People never walk through walls, get stuck in doorways, or spin in place.
- They never forget something big you did (unless it was small and a long time ago).
- They never answer like a robot reading a list (no repeating the same line over and over).
- Two people never sit in the same chair.

---

## 11. Shrunk people and their tiny society

### What happens when you shrink someone (it depends on the person)
- First seconds: confusion. Everything got huge, their voice sounds the same to them, you sound like thunder.
- Then it depends on who they are: panic and run (scared, low bravery), freeze, scream for help, try to call 911 (their phone
  shrank with them, but tiny phones still work only if they're near Wi-Fi or a signal, and nobody believes them),
  get angry at you, beg, bargain, try to climb up your leg, faint (very scared), or get curious (curious + brave people start
  exploring right away).
- They need what real tiny bodies need (section 1): warmth (tiny bodies lose heat fast), lots of food for their size,
  water (a single drop is a big drink, but drops are sticky and dangerous), shelter, safety from bugs.

### Survival
- They find what's around: crumbs, drops, cotton, threads, paper, matches, bottle caps.
- They know what their job taught them: a doctor treats injuries with tiny scraps, a cook cooks crumbs over a match flame,
  an electrician gets a coin battery and an LED running, a carpenter builds, a gardener plants seeds.
- If you drop them resources (from the shopping app, section 9, "building materials for tiny builders"), they use them based
  on what they need most right now (warmth and food first, then shelter, then comfort, then fun).

### Who builds what (real materials, real skills)
- **Carpenter / construction worker**: houses from popsicle sticks, toothpicks and matchboxes (with real framing: a floor,
  walls, a roof), ladders, bridges, fences, furniture.
- **Electrician / engineer**: wiring with thin wire and coin batteries, LED lights for the camp, a tiny working TV from a broken
  phone screen piece + battery + parts (it shows a picture), a radio, a fan from a tiny motor, an alarm that goes off when bugs come.
- **Mechanic**: wheels from buttons and bottle caps, carts, a tiny car from a toy car's parts, pulleys and cranes for lifting.
- **Cook / chef**: a kitchen with a match or candle stove (fire!), a bottle-cap pot, food storage, recipes from crumbs.
- **Farmer / gardener**: plants seeds in soil, waters them, harvests (sprouts grow over real days), keeps aphids like real
  ants do (aphids make sweet honeydew).
- **Doctor / nurse**: a clinic, bandages from tissue, stitches with thread, splints from toothpicks.
- **Artist**: paintings on paper scraps, statues from clay, decorates.
- **Police / soldier / security**: guards, weapons (needle spears, pin swords, thumbtack shields), traps, a lookout tower.
- **Teacher**: organizes people, makes a schedule, keeps kids calm.
- **Programmer / office worker**: not much use at first (they learn other jobs slowly, skills grow by doing).
- **Lazy or selfish people**: take food, don't help, cause fights.
- Building is visible: they carry materials one by one (stronger people carry more), and the build grows piece by piece.

### How the tiny society grows (what would really happen)
- **Day 1**: panic, finding each other, huddling for warmth, a first shelter.
- **Days 2-7**: a camp with a fire, food storage, beds from cotton, a water collector (bottle cap catching drips), the first
  leader (the most confident or most liked person, or whoever has the most useful skill).
- **Weeks**: real buildings, farms, lights, tools, rules (who gets food, who guards at night), maybe a tiny town with streets.
- **Groups split** when people disagree (a group that wants to escape, a group that wants to stay), they argue, steal, fight,
  and can kill each other if food runs out and the people involved have the traits for it (adults only).
- **What they think of you**: if you keep feeding and protecting them, they start treating you like a god (leaving "offerings",
  building a statue of you, praying to the sky when you show up). If you hurt them, they hide when you come, build traps,
  and some fight back. Mixed treatment = mixed feelings, depending on each person.
- They try to escape if they can (climb out of the terrarium, sneak out through a gap) and go home or to the police.
- You can talk to them (they hear you as a giant voice, you hear them small).

### Bugs and creatures with them
- Put any creature in with them (an ant, a spider, a mantis, a cockroach, a mouse), at any size.
- The creature does what it really does (section 12): an ant ignores them or bites if attacked, a spider hunts, a mantis ambushes,
  a cockroach scurries around eating their food, a mouse eats them and their crops.
- The people react from who they are (fight, run, build walls, set traps, sacrifice someone else...).

### Death and gore (adults only)
- They can die from: creatures, falls (rare at their size), drowning, freezing, starving, fire, being crushed,
  each other, you. With max gore on, creatures can tear them apart for real (section 12).
- The others grieve, bury them (tiny graves), get angry, get scared.

### Never-bugs
- Shrunk people never walk through the terrarium glass or float.
- What they build stays built when you save and load.
- They never build things they couldn't (a cook doesn't build a TV out of nothing; someone with electrical skills needs a battery and parts).

---

## 12. Creatures and nature (and getting eaten)

### How bugs and animals work
- **Bodies**: built like the real animal: a real number of legs, body segments, real eyes (compound eyes on insects, 8 eyes on
  most spiders), antennae, wings with veins, hairs. Legs move with real gaits (insects walk with 3 legs down at a time like a
  tripod; spiders move 4 legs at a time), and each foot plants on the ground (no sliding).
- **Real size**: every creature has its real size, and you see it at the right scale at every size you are.
- **Senses** (they notice you three ways):
  - **Sight**: depends on the animal (cats see in the dark way better than us, flies see fast motion, most bugs see movement
    more than detail). Hiding in shadows and staying still works on many of them.
  - **Hearing**: footsteps, voices, your movement. Bugs "hear" vibrations through the ground and through webs (spiders).
  - **Smell**: dogs track your smell trail (it stays on the ground for a while and wind blows it), ants follow scent trails,
    mosquitoes find you by the CO2 you breathe out and your body heat, sharks and fish smell blood in water.
    You can hide your smell (water, mud, perfume, being downwind).
- **Behavior**: from real behavior of that animal: hunting, eating, resting, mating seasons, nests, territories, fleeing,
  following other members (ants, birds in flocks, fish in schools).
- **Size-aware**: animals react to things by size: a cat chases a tiny you like a bug, runs from a giant you, ignores you at
  normal size (or wants pets).
- **Shrink and grow them**: shrink the dog to ant size, grow an ant to dog size. Real problem with giant bugs: bugs breathe
  through tiny tubes in their body, and at big sizes that doesn't work well (that's why real bugs are small). In SCALE, a grown
  bug moves slower and gets tired fast unless it's in the RIFT field (setting: "real giant bugs" makes them struggle and die if
  grown too big).

### Creatures in the world (California coast, real species)
**In houses**: Argentine ants (super common in coastal California, they form huge trails into kitchens when they find food or
when it rains), house flies, fruit flies (around old fruit), cockroaches (German and American, at night in kitchens and the
sewer), silverfish (bathrooms), house spiders, cellar spiders (long legs, in corners), black widows (garages, sheds, dark
corners, venomous), wolf spiders, earwigs, pill bugs (roly-polies), moths (clothes and pantry moths), dust mites (beds),
bed bugs (only if someone brings them in, Rule 1), fleas (on pets that go outside), termites (in wood), mice (in walls,
come out at night for crumbs), rats (garages, the sewer, trash).

**Yard, park, meadow and woods**: garden ants and anthills (real underground colonies with tunnels, chambers, a queen,
workers, larvae), praying mantises (California mantis and European mantis), ladybugs, aphids, bees (honeybees and bumblebees,
they sting), wasps and yellowjackets (nests, aggressive near food, they sting more than once), butterflies (monarchs!),
moths, crickets (chirp at night, faster when warmer, real), grasshoppers, beetles, June bugs, earthworms (come up after rain),
snails and slugs (slime trails), centipedes, millipedes, jumping spiders, orb weavers (big round webs), dragonflies,
damselflies, mosquitoes (near standing water), ticks (in tall grass), fireflies (rare in California, so not common here),
western fence lizards (do push-ups), alligator lizards, Pacific chorus frogs, toads, California newts (toxic skin),
gopher snakes, garter snakes, rattlesnakes (in the dry hills, venomous, rattle before they strike), squirrels,
California ground squirrels, rabbits, gophers (holes in lawns), moles, raccoons (raid trash at night), opossums,
skunks (spray a smell that lasts days, section 17), coyotes (at night), deer (mule deer, eat gardens), bats (at dusk),
birds: crows, ravens, scrub jays, hummingbirds (Anna's hummingbird, fast wings, territorial), sparrows, finches, robins,
mockingbirds (copy sounds, sing at night), pigeons, mourning doves, red-tailed hawks (hunt mice), owls (hunt at night),
woodpeckers, turkey vultures.

**Creek**: water striders, mosquito larvae, tadpoles, frogs, crayfish, small fish, dragonfly nymphs, water beetles,
caddisfly larvae (build cases from pebbles), snails, newts.

**Beach and ocean**: western gulls (steal food), brown pelicans (dive for fish), sandpipers, snowy plovers, cormorants,
sand crabs (dig in the wet sand), kelp flies on seaweed, California sea lions (bark on the pier), harbor seals, dolphins,
gray whales (they migrate past in winter and spring), fish (surfperch, halibut, rays), jellyfish (wash up, sting),
sharks (offshore, rare).

**Tide pools** (rocky areas at low tide): ochre sea stars (purple/orange starfish), giant green anemones (sting tiny things,
close up when touched), aggregating anemones, purple sea urchins, hermit crabs (swap shells), shore crabs, mussels,
gooseneck and acorn barnacles, limpets, chitons, sea snails, sculpins (little fish), nudibranchs (colorful sea slugs),
sea hares, octopus (hides in cracks). Tide pools only show at low tide (real tides, section 16).

**Pets** (pet store or spawn): dogs (labs, golden retrievers, German shepherds, pit bulls, chihuahuas, huskies, corgis,
pugs, poodles, mutts), cats (house cats of all colors), hamsters, guinea pigs, rabbits, parrots, parakeets, goldfish, turtles,
bearded dragons, snakes, tarantulas. Real pet behavior: dogs need walks, beg for food, bark at the mail carrier, chew stuff
(cords, shoes, controllers), dig, sleep a lot; cats knock things off tables, scratch furniture, hunt bugs, sleep in sunny spots,
ignore you, then want attention at 5 AM. Pets need food, water, vet visits; they get fleas if they go outside.

### Plants
- Coast live oak and bigleaf maple (both really grow in coastal California; maples along the creek), sycamores along the creek,
  Monterey cypress, eucalyptus, palm trees (planted in town), pines, fruit trees in yards (lemon, orange, avocado), coyote brush,
  California poppies, sagebrush, ice plant (on the coast), grasses (green in winter-spring, golden-brown in summer, real
  California look), weeds in sidewalk cracks, moss, lichen on rocks, mushrooms (after rain), seaweed and kelp at the beach,
  garden flowers, vegetables, lawns (sprinklers keep them green), houseplants.
- Plants grow over real days, need water and sun, die if neglected, drop leaves in fall (maples turn yellow), sprout after rain.

### Getting eaten (how it works, depends on the animal)
Each predator does what the real one does to prey your size. With max gore on, it's shown for real (adults only).
- **Praying mantis**: waits perfectly still, then grabs in a split second with spiked front legs that lock you in, and starts
  eating while you're alive (real mantises often start at the head/neck). Its grip is very strong for its size.
- **Spider**: web spiders feel you hit the web (vibrations), run over, wrap you in silk, bite with venom that paralyzes.
  Jumping spiders and wolf spiders hunt by pouncing. Black widow venom is very strong.
- **Ants**: one ant bites, then the colony comes (they send scent signals), they swarm, bite, and carry pieces back to the nest.
- **Mouse / rat**: sniffs you out, grabs you with its front paws, chews (they eat bugs in real life).
- **Cat**: plays with you first (batting you around, letting you run, catching you again: real cat behavior), then kills you.
- **Dog**: sniffs, licks, might swallow you whole without chewing, or just ignore you.
- **Frog / toad / lizard**: tongue snap (frogs) or a quick bite (lizards), swallowed whole.
- **Birds**: peck and swallow; hummingbirds don't eat you, but they eat tiny bugs.
- **Fish**: suck you in from the water's surface.
- **Anemone**: stinging tentacles grab tiny things and pull them in.
- **Humans**: can eat you if you're in their food or drink and they don't see you (a bite of a sandwich you're hiding on).
- **Escaping**: struggle (you're strong for your size, section 1, so sometimes you get free), stab it with your tiny weapon,
  shrink ray it, or grow. If you grow while something's holding you, it has to let go (or you get too big for it, and with max
  gore on, growing inside something kills it).

### Riding animals
- Ride the dog (at mouse size, hold its fur), the cat, a bird (it flies where it wants unless you possess it), a beetle (slow but
  climbs walls), a rat, a dragonfly (fast, hard to hold onto), a horse (if you add a ranch later) at normal size.
- Animals don't like being ridden: some throw you off, some don't notice, depends on the animal and its mood.

### Possessing anything alive
- With the possession headset (section 7), aim at any living thing (not kids): you take control and your body stands frozen
  (vulnerable!) where you left it.
- You move like the real thing: a fly flies in jerky zips, a spider walks on walls and ceilings and makes webs, a mantis
  stalks and strikes, a dog runs and sniffs (smell vision shows scent trails), a cat jumps high and sees in the dark,
  a bird flies (glide and flap), a fish swims, a person does anything a person does (and other people think it's them).
- The possessed creature remembers it afterwards (people are freaked out, lost time).
- **Crimes while possessing someone**: cameras and witnesses see THEIR face, so they get blamed and arrested first (and they swear
  they don't remember doing it). If a detective finds evidence of your RIFT tech (your frozen body nearby, footage of you with
  the headset on, the possessed person's story checking out), the case turns toward you.
- If the creature dies while you're in it, you snap back to your body (and it hurts).

### Never-bugs
- Creatures never walk in the air, never slide without moving their legs, never get stuck inside furniture.
- Predators never attack kids.
- Ants never lose their trail for no reason (a trail breaks only if something wipes the scent: cleaning, water, you).

---

## 13. The town (California coast)

### The map
A made-up small beach town on the California coast (the real kind: hills behind it, the Pacific in front, a coast highway
running through, marine fog in the mornings). Parts:
- **Your mansion** on the hill above town (ocean view), behind a gate.
- **Residential streets**: houses of all kinds (big, small, old, new, apartments, a trailer park), each with its own family,
  yard, cars, trash cans, mailbox, junk in the garage.
- **Every building can be entered**: every house, apartment, shop and public building has a full inside with real stuff in it.
- **Downtown / main street**: the shops.
- **Civic stuff**: police station, courthouse, jail, fire station, hospital, city hall, post office, library, church,
  cemetery, school.
- **The beach**: boardwalk, pier, sand, lifeguard towers, tide pools at the rocky end.
- **The wild side**: a grass meadow with oak and maple woods, a creek running down to the ocean, hiking trails.
- **Under it all**: storm drains, the sewer, utility tunnels, basements.
- **Roads**: the coast highway, town streets, alleys, a parking lot by the beach, a gas station on the highway.

### Your mansion
- **Outside**: gate with keypad, long driveway, front fountain, gardens, pool and hot tub, outdoor kitchen and grill,
  fire pit, tennis or basketball court, garden shed, solar panels, security cameras, motion lights, ocean-view deck.
- **Garage** (4 bays): your 3 cars (Velaro, Hesper, Grizz, section 14), a workbench, tools, bikes, a surfboard rack,
  the breaker panel, a freezer, storage shelves, oil stains on the floor.
- **Ground floor**: entry hall with a big staircase, living room (huge TV, sectional, fireplace), kitchen (island, two ovens,
  big fridge, wine fridge, pantry), dining room, home theater (projector, recliners, popcorn machine), game room (pool table,
  arcade machines, consoles), music room (grand piano), home office (your PC setup), guest bathroom, laundry room.
- **Upstairs**: your bedroom (king bed, walk-in closet, bathroom with a big tub and glass shower, balcony), guest rooms,
  more bathrooms, a gym (weights, treadmill), a library, the roof deck with the telescope.
- **Secret basement lab (RIFT LAB)**: hidden entrance (a bookshelf in the office slides away when you pull the right book),
  the RIFT machine (big, humming, glowing), the reset pad, workbenches, the invention research station, server racks,
  monitor wall (security cameras, scanners), glass terrariums and tanks for shrunk things, the experiment room (section 7),
  specimen fridge, cages, a decontamination shower, a 3D printer, a microscope station, a whiteboard full of equations.
- **Security**: the alarm system (section 6) with a real security company that calls you, then the police, if it goes off.
- **The lab is 100% hidden**: nobody in town can ever find it (not burglars, not cops with a warrant, not escaped shrunk people,
  who can only describe "a giant lab" that nobody can locate). It's your safe zone.

### Downtown shops (each one fully inside, with workers, real stock and prices)
- **Grocery store**: aisles (section 8), carts, checkout lanes, self-checkout, bakery, deli, produce misting, frozen aisle
  (cold), back storage with a loading dock, a dumpster.
- **Restaurant**: dining room, bar, kitchen (fire, knives, grease), menus, servers, cooks, a dishwasher guy, a walk-in fridge.
- **Café**: espresso machines (loud steam), pastries, laptop people, a line in the morning.
- **Gas station + corner store**: pumps (pay, pump, the smell of gas), snacks, drinks, lottery tickets, cigarettes behind the
  counter, a restroom with a key on a giant keychain, an air pump for tires, the clerk who smokes on his break out back
  (that's where the cigarette butts come from).
- **Hardware store**: tools, lumber, paint mixing, keys copied, garden center (section 9).
- **Clothes store**: racks, fitting rooms with mirrors, shoe wall, sales.
- **Barber / salon**: chairs, clippers, haircuts that actually change your hair (pick a style), hair dye, beard trims, gossip.
- **Car dealer**: a lot of new and used cars, a showroom, test drives, a salesman who's pushy or chill depending on who he is.
- **Mechanic**: lifts, tools, oil changes, repairs that take time and cost money, an old car on blocks.
- **Electronics store**: TVs on a wall, PC parts, phones, consoles, cables, a repair counter.
- **Pet store**: fish tanks (bubbling), puppies/kittens (adoption events), birds, reptiles, crickets and mice (feeder animals),
  food, toys, cages.
- **Bank**: tellers, a vault, an ATM outside, safe deposit boxes, loan officer, security guard, cameras (section 15).
- **Gun store**: counter, guns behind glass, ammo, a shooting range in the back, real rules (section 7).
- **Pharmacy**: medicine aisles, the pharmacy counter with prescriptions, a little bit of everything (snacks, makeup, cards).
- More real small-town places: a pizza place, a taco shop, an ice cream shop, a surf shop, a bike shop, a thrift store,
  a laundromat, a dentist, a vet clinic, a gym, a motel, a bar, a movie theater (shows the game's made-up movies),
  a farmers market on weekends.

### Civic places
- **Police station**: front desk, offices, holding cells, interrogation room, evidence room, impound lot, cop cars.
- **Courthouse**: courtroom, judge, lawyers' tables, jury box, waiting halls (section 15).
- **Jail**: cells, a yard, a cafeteria, visiting room.
- **Fire station**: trucks, gear, the pole, a dog maybe.
- **Hospital**: section 7.
- **School** (elementary + middle): classrooms, gym, cafeteria (food fights), playground, the basketball court, library,
  principal's office, buses, a schedule (bell rings, recess, lunch). Kids there on weekdays.
- **Park**: playground, grass field, picnic tables, BBQ grills, a pond with ducks, dog park, public restrooms, trash cans,
  benches with plaques.
- **Church, cemetery** (funerals, section 10), **library**, **post office** (mail sorting, mail trucks),
  **city hall** (the mayor, permits, the town's records).

### The beach
- **Boardwalk**: shops (souvenirs, sunglasses, T-shirts, surf rentals), food stands (corn dogs, churros, cotton candy,
  fish tacos, funnel cake, lemonade), street performers, skaters, bikers.
- **Pier**: long wooden pier over the waves, fishermen with buckets, a seafood restaurant at the end, the arcade
  (made-up arcade machines that you can actually play: claw machine, air hockey, skee-ball, racing, a shooter; tickets and a
  prize counter), and the **Ferris wheel** (ride it, see the whole town, it stops at the top if the power goes out).
- **Sand**: towels, umbrellas, sandcastles (people build them, waves wash them away), volleyball nets, fire rings (bonfires
  at night), trash left by beachgoers (Rule 1).
- **Lifeguards**: towers, a truck on the sand, they watch the water, whistle, run in to save drowning people (you too).
- **Surfers**: they paddle out, wait for waves, ride them, wipe out. Real waves come in sets.
- **Ocean**: real waves, rip currents (they pull you out, swim sideways to escape, real advice), cold water (about 12-20°C on the
  California coast, colder up north, warmer down south in late summer), seaweed, sea lions, dolphins, the tide going in and out.
- **Tide pools**: at the rocky end, only when the tide is low (section 12 for what lives there).

### The wild side
- **Grass meadow** with oaks and maples (section 12 plants), wildflowers, gopher holes, a hiking trail, picnic spot.
- **Creek**: shallow, rocky, a little waterfall, fallen logs, a wooden footbridge, flows to the beach. Gets bigger and muddy
  after rain.
- **Woods**: shade, leaf litter (a jungle at tiny size), fallen branches, mushrooms, a hidden spot where teens hang out
  (and leave trash and graffiti, Rule 1).

### Under the town
- **Storm drains**: street grates and curb openings lead down to concrete pipes that carry rainwater to the creek and the ocean
  (real: storm drains go straight to the ocean without being cleaned, so trash ends up on the beach).
- **Sewer**: separate pipes from toilets and sinks to the treatment plant. Dark, wet, smelly (section 17), rats, roaches,
  echoing drips, flowing water that can sweep tiny you away. Things flushed down toilets end up here.
- **Manholes**, utility tunnels, basements, crawl spaces under houses (spiders, pipes).

### The history system (everything has a cause) and the inspect tool
- When you make a new world, the game runs the town's life for a few days in fast-forward before you spawn.
  People live their routines: they eat, drop crumbs, spill drinks, throw trash (or litter), track mud, lose things
  (keys between couch cushions, a sock behind the dryer, an earring down the sink drain), break things, smoke, chew gum.
  Ants find crumbs, spiders build webs in quiet corners, dust gathers where nobody cleans.
- Every piece of mess and every lost thing records **what it is, who caused it, when, and how**.
- **Inspect tool** (on your phone, section 6): point it at anything:
  "Dorito crumb. Dropped by Tyler Reyes (12), Tuesday 8:14 PM, eating on the couch while watching TV."
  "Cigarette butt. Dropped by Dale Moore (gas station clerk), Monday 3:02 PM, on his break."
  "Ant trail. Argentine ants from the colony under the side yard, following crumbs since Wednesday."
  "Coffee stain. Spilled by Jen Park, Thursday 7:40 AM, when the dog bumped her."
  "Scratch on the door. Biscuit (dog) scratching to go out, many times."
- It works on objects too: who owns it, where it was bought, how old it is, what it's made of, real size and weight.
- From then on, everything that happens while you play gets recorded the same way.

### Trash
- Trash cans in every room, under the kitchen sink, outside each house (trash, recycling, green waste), in public places.
- People throw stuff in the right can or not (depends on them). Trash cans fill up and smell (worse in heat).
- **Trash night**: people roll the bins to the curb the night before pickup; the garbage truck comes on its day (the arm lifts
  the bin and dumps it), raccoons and crows dig into bins left open.
- Trash goes to the landfill (off the map). Litter stays where it's dropped until someone picks it up, the wind blows it,
  or rain washes it into a storm drain and then onto the beach.

### Never-bugs
- Every door you can see leads somewhere real.
- No invisible walls in town (the edge of the map is real geography: the ocean, steep hills, the highway out of town).
- Stores never sell stuff they don't have in stock (if it's sold out, it's sold out until a delivery truck restocks it).

---

## 14. Vehicles and getting around

### Your 3 cars (made-up brands, real kinds of cars)
- **Velaro**: a low two-door sports car. Mid-engine, fast, loud, stiff ride, scrapes on speed bumps, tiny trunk in the front.
- **Hesper**: a long luxury electric sedan. Silent, fast off the line, heavy battery in the floor, glass roof,
  a big touchscreen, charges in your garage (no gas).
- **Grizz**: a big off-road pickup truck. Tall, loud gas V8, a truck bed for hauling, a tow hitch, mud tires.
- Each has a real interior (seats, steering wheel, pedals, gear shifter, dashboard with working gauges, mirrors, radio,
  glovebox with real junk in it, cup holders, seatbelts), real lights (headlights, brake lights, turn signals, hazards),
  horn, wipers, windows that roll down, doors, trunk/hood that open, fuel or charge level.

### Driving (works like a real car)
- Real car physics: weight, grip (worse in rain), engine power, gears, braking distance, skids, drifting,
  rollover if you corner too hard in a tall truck.
- Fuel: gas cars use gas and need the gas station (pump, pay, the smell). The electric car needs charging.
- Damage: dents, broken glass, popped tires (drive on the rim, sparks), smoking engine, airbags in big crashes,
  injuries to people inside (seatbelts help, real).
- Traffic laws: stop signs, traffic lights, speed limits, parking. Break them near a cop and you get pulled over (section 15).
- Crashing into people: real injuries (adults), and it's a crime.
- Car keys: lose them, lock them in the car, find them in the couch.
- Car radio (section 17).
- Car maintenance: oil changes, tire pressure, check engine light (from a real cause, like a loose gas cap),
  dead battery if you leave the lights on.

### Shrinking on a car / going into the engine
- **Shrink on the outside**: the paint is a mirror-smooth landscape with tiny swirl scratches and dead bugs on the front,
  the tires' treads are canyons, the grille is a giant fence, the windshield wiper is a huge arm that sweeps when it rains.
- **Into the engine bay** (through the grille or under the car): the radiator's thin metal fins are a maze of walls,
  the cooling fan (can kick on when the engine's hot and blow you away or chop you), belts spinning on pulleys when the
  engine runs (deadly to get caught in), the engine block (hot, 90°C+ when running), the exhaust parts (hundreds of degrees,
  they burn you instantly), the battery (big posts, acid), wires, hoses with coolant, oil dripping.
- **Inside the engine itself**: only through the air intake (past the air filter, which catches dust and tiny you).
  Inside the cylinders it's real: the piston moves up and down hundreds of times a second at idle, fuel explodes in there.
  Going in while it's running = instant death. When it's off, you can walk around inside the cylinder and see the valves.
- **Electric car**: no engine; the big flat battery pack, electric motors, cooling lines, high-voltage orange cables (deadly).
- **Inside the cabin at tiny size**: crumbs and fries under the seats (Rule 1, someone eats in their car), cup holder lakes,
  the AC vent blasting wind, the speakers thumping like earthquakes.

### Other vehicles in town
- Traffic: cars of all kinds (sedans, SUVs, minivans, trucks, old beaters, sports cars, electric cars), each driven by a
  townsperson going somewhere real (work, school, store), with real driving: some speed, some are careful, some text and drive.
- Police cars, ambulances, fire trucks (sirens, they pull up when called), the garbage truck, the school bus, a city bus,
  delivery vans (they bring your orders), mail truck, ice cream truck (summer weekends, plays a song), tow truck,
  street sweeper, construction trucks, a cement mixer, a taxi/rideshare, motorcycles, golf carts.
- Planes flying over, a news helicopter (when something big happens), police helicopter.
- Boats offshore, fishing boats at the pier, a kayak and a jet ski you can rent.

### Small stuff
- **Bikes** (pedal, gears, brakes, fall over if you go too slow, flat tires), **skateboards** (push, ollie, grind,
  fall on hard landings), **scooters** (kick and electric), **roller skates**, **surfboards** (paddle and stand up on real waves).
- **RC cars**: drive them with a controller (fast!) or shrink yourself and ride on one / in one.
- **Drones**: fly with a controller and a camera view; at tiny size ride on top. Batteries die mid-flight (it lands or falls).
  Propellers are dangerous at tiny size.
- **RC planes**: need a runway (the street), crash if they stall.
- **Rocket** (section 3).
- **Riding animals** (section 12).

### Never-bugs
- Cars never fall through the road, fly off for no reason, or bounce like they're made of rubber.
- You never get stuck inside a car door; getting in and out always works (and if the door's blocked, you climb out another one).
- NPC drivers never drive through buildings or stop forever.

---

## 15. Money, your company, crime, police and court

### Money
- You start rich (mansion, cars), with money in the bank. Real-life mode makes things cost money; sandbox mode doesn't (section 9).
- Bank account, debit card, cash in your wallet, an ATM, checks, a credit card (with a bill every month), bills
  (power, water, internet, phone, insurance, property tax on the mansion), hospital bills, fines.
- Prices are realistic for California (a burrito about $12, gas about $5 a gallon, a console about $500).
- People in town have their own money: they earn it at their jobs, spend it, run out of it (and then make choices based on who
  they are: get a second job, borrow, beg, steal).

### Your inventions business (RIFT LAB)
- **Start small**: build a gadget, list it in the shopping app (your own store page: name, price, description, photo).
  Townspeople buy it if it's useful to them and the price is right for them (no random buyers: each one decides).
  Reviews come in (good or bad, based on whether the gadget works and breaks).
- **Grow it**: rent a workshop, then a factory in the industrial part of town. Hire workers (real townspeople with real skills
  apply; you interview them), pay them, they build your products on an assembly line, they get tired, quit if treated badly,
  go on strike if paid too little.
- Ads on TV and online, competitors copying you, taxes, lawsuits if a product hurts someone.
- Your company's money is in your bank app.

### Crime (by anyone, depending on who they are)
- Townspeople commit crimes when their traits and situation push them to: someone broke with low honesty shoplifts,
  a bored teen with low empathy does graffiti, an angry drunk guy starts a fight, a greedy person scams people online,
  a thief steals packages or breaks into cars, someone drives drunk. No random "crime events": each crime has a person and a reason.
- Crimes in town: shoplifting, theft, package theft, car break-ins, car theft, burglary, vandalism, graffiti, littering,
  trespassing, fights/assault, robbery, reckless driving, DUI, hit and run, fraud/scams, hacking (in-game), selling illegal stuff
  on the dark web, kidnapping, murder (adults only).
- You can do crimes too, and they're crimes even if you're the main character.
- **Shrinking someone is kidnapping** if it's against their will (if anyone finds out: they escape, someone sees, cameras catch it).

### Police (only when something causes it)
- Police show up when someone calls 911 or a cop sees something themselves. No call, no cops.
- 911 calls come from people who saw something, heard gunshots, found a body, had something stolen, saw a giant, or from your alarm.
- They respond with real timing (a few minutes, depending on how far the closest car is), sirens, lights.
- Cops have their own personalities too: chill, strict, rude, by-the-book.
- **Evidence**: witnesses (what they saw, how sure they are, if they're honest), security cameras (yours, the bank's, the gas
  station's, doorbell cams), phone videos, fingerprints on things you touched, blood, your car's license plate.
- Detectives investigate bigger crimes (missing people: they search, interview, put up posters).

### Getting arrested, bail, lawyer, court, jail (real California steps)
1. **Arrest**: cuffs, your rights read to you, ride in the back of the cop car.
2. **Booking** at the station: photo, fingerprints, your stuff taken and bagged.
3. **Bail**: depends on the crime (set by the county's bail schedule). Pay it (from your bank) and you go home until court.
   Big crimes might get no bail.
4. **Lawyer**: hire one (good ones cost a lot) or get a free public defender (they're overloaded).
5. **First court date (arraignment)**: within about 2 days (not counting weekends). You plead guilty, not guilty, or no contest.
6. **Trial** (if not guilty): the jury hears the evidence and witnesses. Your lawyer can argue. The verdict comes from the
   actual evidence and how believable the witnesses are, not a coin flip.
7. **Sentence**: fines, community service (picking up beach trash!), probation, county jail (smaller crimes, up to about a year)
   or state prison (felonies, off the map, time skip).
8. **Jail time**: you're in a cell. You can do time (time skip at a speed you choose), or try to break out (with tools, or by
   shrinking if you somehow kept your watch: guards take your watch at booking unless you hid it).
- Traffic tickets for driving stuff, fines for littering.

### How the world reacts (depends on what actually happened)
- **News**: TV news, the news website and phone alerts report what happened IF someone saw it, filmed it or reported it.
  "Witnesses say a 60-foot person walked down Ocean Avenue", "Missing: Daniel Kim, 34, last seen near Seacliff Drive".
- **Social media**: people post what they saw, with blurry phone videos. Rumors spread and change as they're retold.
- **Exterminator**: comes when someone with a bug problem calls (ants in the kitchen for days, roaches, termites, a wasp nest).
  They spray (deadly to tiny you), set traps, put bait out.
- **Animal control**: a loose aggressive dog, a raccoon in the house, a giant animal (that you grew!), a coyote in a yard.
- **Fire department**: a fire, a gas leak smell, someone stuck somewhere, a cat in a tree (yes, real).
- **Ambulance**: someone hurt and someone called.
- **People remember you**: if you scared or hurt someone, they act on it: they avoid you, lock doors, tell neighbors, get a
  security camera, put up "have you seen this?" posters, move away, or (if they're brave) come to confront you.
- **The town changes over time**: more police patrols after a crime wave, new cameras, a "neighborhood watch", a news van
  parked outside your gate if people think you're involved.

---

## 16. Time, weather, seasons and holidays

### Time
- A full day takes 48 real minutes (1 real second = 30 game seconds). Time controls: pause, slow (half speed), fast (2x, 5x,
  10x, 50x), skip to a time, freeze time completely (everything stops except you, a RIFT invention).
- The calendar is real: days of the week (weekdays: work and school, weekends: beach), months, years, holidays on their real dates.
- Sunrise and sunset times change with the season (long summer evenings, early winter dark), the real way for California.
- The moon goes through its real phases and rises later each night. Stars move across the sky through the night.
- **Tides**: the ocean has two high tides and two low tides a day (about 50 minutes later each day), so the tide pools appear
  and disappear for real.

### Weather (real California coast weather)
- **Marine layer fog**: gray mornings that burn off by afternoon, especially in May and June ("May Gray, June Gloom").
- **Sunny and mild** most of the year (about 15-25°C at the coast).
- **Rain**: mostly in winter (November to March), sometimes big storms with wind, flooding in the creek and the storm drains,
  power outages from falling branches, mudslides on the hills. Summer is basically dry.
- **Wind**: ocean breezes every afternoon; in fall, hot dry inland winds sometimes blow toward the coast (Santa Ana winds
  in Southern California), making it hot, dry and dangerous for wildfires.
- **Heat waves**, **thunderstorms** (rare at the coast), **hail** (rare), **frost** (rare, cold winter nights).
- **Snow**: it basically never snows at the California coast, so it doesn't, unless you use the weather machine (section 7)
  or turn on "any weather" in settings. Snow shows up on far-away mountains in winter.
- **Earthquakes**: California has them. Small ones happen and nobody cares (things rattle); a big one shakes everything,
  knocks stuff off shelves, breaks windows, people run outside, the news covers it. They come from the fault under the area
  building up (the game tracks it), not random dice.
- At tiny size, weather is extreme: raindrops are water balls (section 1), wind is a hurricane, fog droplets bead on everything,
  a puddle is a lake, hail is a meteor.

### Seasons
- **Spring**: green hills, wildflowers (poppies), more bugs, baby birds, rain ending.
- **Summer**: golden-brown dry grass, fog in the morning, beach crowds, tourists, ice cream truck, fireworks on July 4th,
  most bugs, mosquitoes at dusk.
- **Fall**: maple leaves turn yellow and drop (leaf piles), Santa Ana-type winds, Halloween, pumpkins, school starts (late August).
- **Winter**: rain, green grass again, gray whales passing, Christmas lights, short days, cold nights.

### Holidays and events (real dates)
- **New Year's Eve/Day**: parties, countdown, fireworks.
- **Lunar New Year**, **Valentine's Day** (flowers, chocolate, dates), **St. Patrick's Day** (green everything),
  **Easter** (egg hunts in the park), **Cinco de Mayo**, **Mother's Day / Father's Day**, **Memorial Day / Labor Day**
  (beach crowds, BBQs), **4th of July** (fireworks, flags, BBQs, the dog hides from the noise: real), **back to school**,
  **Halloween** (Oct 31: houses decorated, pumpkins carved and lit, costumes, trick-or-treating kids with candy bags,
  haunted house at a neighbor's, candy wrappers everywhere the next day, Rule 1), **Día de los Muertos** (altars, marigolds),
  **Thanksgiving** (4th Thursday of November: family dinners, turkey, football on TV, traffic),
  **Christmas** (Christmas trees, lights on houses, inflatable decorations, presents under the tree, stockings, Santa at the mall
  area, carols, Christmas Eve dinner, unwrapping on the morning of Dec 25th, wrapping paper everywhere),
  **Hanukkah** (menorahs in some windows), **birthdays** (every person has a birthday: party, cake, presents).
- Town events: farmers market, beach cleanup day, surf contest, a fair on the pier, school plays, garage sales,
  block parties, power company repairs, road construction.

### Never-bugs
- The sun is never up at midnight.
- Rain never falls indoors (unless the roof is broken).
- Holidays never happen on the wrong date.
- The tide never jumps instantly; it moves smoothly.

---

## 17. Smell, sound, music and voices

### Smell (a real system, not just text)
- Smells come from things: food cooking, coffee, perfume and cologne, air freshener, sweat, trash, a skunk, smoke, gas (natural gas
  has a "rotten egg" smell added on purpose so leaks get noticed: real), flowers, the ocean, wet dog, the sewer, rotting food,
  bug spray, gasoline, a dirty litter box, fresh laundry, new car smell, popcorn, cigarettes, rain on dry ground.
- Each smell spreads out from its source, drifts with the wind and air from fans and AC, fills closed rooms, leaks out of open doors,
  and fades over time. Strong smells (skunk spray) last days on clothes.
- **Who reacts**: people (they like or hate a smell based on who they are, perfume included; they say "what's that smell?",
  open windows, cover their nose, follow the smell of food), dogs (they track scent trails across town, smell vision when you
  possess one), ants (they follow scent trails, and their alarm scent calls the colony), mosquitoes (they track the CO2 you breathe
  out), sharks and fish (blood in water), bees (flowers).
- **You**: an optional "smell" display shows smells around you as soft colored haze (setting), and the game also tells you in words
  ("Smells like burnt toast").
- Your own smell: sweat after running, no shower for days, cologne/perfume, smoke from a fire, skunk. People react.

### Sound (everything makes its real sound)
- Every material makes its own sounds (section 5): footsteps on wood, tile, carpet, grass, sand, gravel, metal, puddles.
- Every device makes its own sounds: fridge hum, AC, fans, clocks ticking, the dishwasher, the washing machine spin, the console fan,
  keyboard clicks, phone vibrations, notification sounds, the microwave beep, the toaster pop, the kettle whistle, the TV.
- The world: waves, wind, seagulls, crows, distant traffic on the coast highway, dogs barking down the street, kids at recess,
  lawn mowers on Saturday, a plane overhead, sirens, the ice cream truck, construction, church bells, crickets at night,
  the foghorn on a foggy morning.
- **Real sound physics**: sounds get quieter with distance, muffled through walls and doors, echo in big rooms, the sewer and
  the stairwell, and you can tell where a sound comes from (left, right, behind).
- **Size**: at tiny size nearby big things are LOUD and you feel them (footsteps shake, a dog bark is a blast); at giant size small
  sounds are tiny under you. Pitch stays real.

### The soundtrack (so it never gets boring)
- Original music that changes with what's happening:
  - **Exploring** (chill, different for day and night, inside and outside),
  - **Tiny** (big, mysterious, wonder),
  - **Microscopic** (strange, alien, glassy),
  - **Danger** (a predator is hunting you, the mantis is close: tense, then full panic music in a chase),
  - **Giant / kaiju** (huge, heavy, epic),
  - **Space** (wide, slow, beautiful),
  - **Lab** (techy, hacker, glitchy),
  - **Sad** (when someone dies or a big loss), **happy** (good moments), **holiday** themes.
- Music fades between moods smoothly, never cuts off in a weird way.

### Your music
- **Music app** (on your phone and PC, like a real music streaming app with a made-up name): playlists, albums, artists
  (made-up bands and songs in many genres: hip hop, pop, rock, EDM, lo-fi, R&B, country, metal, classical, jazz, reggaeton),
  shuffle, repeat, liked songs. Play it through your earbuds (only you hear it), your phone speaker, Bluetooth speakers,
  the house speakers, or the car.
- **Add your own music**: pick audio files from your real computer or phone (MP3 and other formats), and they show up in the app,
  saved with your game. Play them in your car, at your house party, on the in-game radio station you start.
- **Radio**: car radios and home radios have stations with real-feeling DJs between songs, ads, traffic reports, news breaks,
  call-in shows. Stations: hip hop, rock, country, Spanish, classical, talk, news, oldies, plus your own station.
- **Live music**: a guitarist on the boardwalk, a band at the bar on weekends, the church choir, a kid practicing drums
  next door (badly).
- NPCs play music too (loud music from a neighbor's party, a car blasting bass going by).

### Voices
- Everyone has their own voice (made with voice settings by person: pitch, speed, tone, accent), saying their lines out loud,
  with subtitles (ON by default, setting to turn off, size options).
- Voice lines never get cut off by the next line, and they don't speed past when the sound is muted.
- People shout, whisper, cry, laugh, scream, talk on phones, sing in the shower.
- Tiny people sound small and far to you; you sound like a giant booming voice to them.

---

## 18. Graphics, animation, collisions, settings, menus and saves

### The look
- Realistic, colorful, clean. Real light: warm morning sun, white noon, golden hour, blue night with moonlight and streetlights,
  ocean haze, foggy mornings. Real shadows that match the sun. Reflections on water, glass, cars and shiny floors.
- Materials look like what they are: wood grain, fabric weave, brushed metal, glossy paint, wet asphalt after rain, sand that
  gets darker when wet.
- Color grading per mood: warm golden for sunny days, cool blue for night, gray-blue for fog, a clean bright look indoors.
- **Tiny-size look**: like macro photography: soft blurry backgrounds, huge light sources, dust floating in light beams,
  everything gigantic.
- **Micro look**: microscope and electron-microscope style (section 2).
- **Giant/space look**: real atmosphere scattering (blue sky, red sunsets), clouds, stars.
- No emojis in the game. Icons and pictures are real graphics.

### Animations (all of them have to look good)
- People: all the body animations in section 4, plus jobs (typing, cooking, cutting hair, fixing cars, scanning groceries,
  surfing, fishing, sweeping), emotions (crying, laughing, shaking from fear, slumped sadness), talking gestures,
  sitting, sleeping, eating, using phones, dancing.
- Creatures: real gaits for every animal, wings beating at real speeds (blurred for fast ones like flies and hummingbirds),
  attack moves, eating, grooming (cats lick, flies rub their legs), sleeping, death.
- Objects: doors, drawers, cloth, water, fire, smoke, breaking pieces, cars (suspension, wheels turning and steering), machines.
- The Glitch: its glitch effects, the eyes in the hood, cables swinging, the coat flowing.
- Transitions: growing and shrinking are smooth and dramatic (glitch flash, the world rushing away/toward you).

### Collisions
- Every object collides with a shape that matches what you see (a chair has legs you can walk between at tiny size,
  not a box around the whole chair).
- Feet stand on surfaces exactly. Hands touch what they hold. Nothing goes through anything.
- Physics stays stable at every size (tiny objects don't jitter, giant ones don't explode).

### Settings (lots of them)
**Graphics**: preset (Low, Medium, High, Ultra), resolution scale, frame rate cap, shadows (off/low/high), shadow distance,
ambient occlusion, reflections, bloom, motion blur, depth of field (tiny-size blur), film grain, view distance, grass density,
detail density (how many crumbs/fibers/grains at tiny size), crowd size (how many people out at once), cloth quality,
water quality, particle amount, texture quality, anti-aliasing, field of view, brightness, gamma, color mode (colorblind options),
FPS counter.
**Audio**: master volume, music (soundtrack) volume, radio/music app volume, sound effects, voices, ambience, UI sounds,
soundtrack on/off, soundtrack style (cinematic, chill, minimal), mute when the game is in the background.
**Gameplay**: sandbox mode vs real-life mode, needs (full, basic, off/Robot mode), permadeath (off/on: on = death ends the world),
gore (off, normal, max), time speed, day length, starting season, weather (realistic, any weather), crime and police on/off,
creatures (realistic, less scary, none), bug look (100% real by default, or "less creepy" for people who hate spiders),
difficulty of creatures, fall damage, slow-mo big falls (off by default), starting money (pick when you make a world),
how fast kids grow up (real, medium, fast), AI brain (built-in, free local AI, your Claude API key), Claude key use
(off / only when I talk to someone / everything, plus a daily spending limit), NPC population.
**Controls**: mouse sensitivity, invert Y, controller support, key rebinding for everything, hold vs toggle (crouch, sprint, aim),
camera distance, first-person/third-person default, mobile layout editor (move and resize touch buttons).
**Accessibility**: subtitles (on by default), subtitle size and background, speaker names, sound visualizer (shows where sounds
come from), reduce flashing (glitch effects calmer), screen shake on/off, text size.

### Menus and the RIFT LAB look
- **Logo**: RIFT LAB as the studio/lab logo: torn text with a glowing rift shining through the tear. The game title SCALE
  on the main menu (see Questions).
- **Main menu**: clean menus floating over the live 3D world in the background (your mansion at sunset, the lab, the beach),
  with The Glitch or your character standing there.
- Menus: Play (new world, load world), Settings, Character, Credits, Quit.
- **New world**: pick the world seed (or random), sandbox/real-life mode, permadeath, needs, and your character.
- **First time you start**: a normal morning in your mansion bedroom. You explore the house, find the hidden bookshelf door
  (hints if you get stuck), go down into the lab, and finish building the watch with the RIFT machine (this is the tutorial:
  shrink, grow, the ray, your phone). Then a cutscene: "2 YEARS LATER". Then free play.
- **Pause menu**: resume, settings, save, load, photo mode, quit to menu.
- **HUD**: minimal: your size on the watch, health only when hurt, needs only when they're getting low, what's in your hands,
  small interaction prompts. Turn everything off for clean screenshots.
- **Phone** (section 6) is the main way to do things in the game, like real life.
- **Photo mode**: freeze, fly the camera, focus blur, filters, take a screenshot.

### Saving
- Save slots with the world name, a picture, your character, the in-game date, and when the save was made and last loaded.
- Autosave every few minutes and when you sleep. Manual save any time (not during permadeath combat, to stop save-scumming,
  if permadeath is on).
- Everything saves: every object and where it is and what size, every person's mind and memories, what tiny people built, damage,
  broken things, mess, weather, time, your company, police records.
- Saves are stored in your browser; export/import a save file to back it up or move it to another computer.

### Phones and mobile controls
- Touch controls: left thumb joystick, right side drag to look, buttons for jump, interact, grab/drop, fire, shrink, grow,
  phone, crouch, sprint. Customizable layout. Gyro aiming (optional).
- Phone settings default to Low/Medium so it runs smoothly.

### Performance (smooth on weak computers and phones)
- Things far away or too small to see are simplified or skipped (level of detail).
- Repeated things (grass, crumbs, fibers, leaves) are drawn all at once (instancing).
- Only nearby people and creatures run their full brains and animations; far ones run a simple version.
- Tiny details only exist near you and appear when you're small enough.
- The game watches its frame rate and adjusts the detail density automatically if you turn that on.

---

## 19. The no-bugs rulebook

### Bugs that kill other games, and how SCALE stops each one
- **Phone stuck on the gun / items attached to the wrong thing**: one list of what's in each hand and pocket; models are drawn from
  that list every frame (section 5). Automatic tests swap items thousands of times and check every item is in exactly one place.
- **Can't pick up items on the floor**: every object gets a pickup test at every size it can be (the test bot tries to pick up
  every catalog item off the floor, off a table, from a drawer, from under a bed).
- **Falling through the floor**: physics runs in small fixed steps, fast things use continuous collision (no tunneling),
  the floor is solid under every walkable spot, and a safety net puts anything that falls out of the world back on the nearest
  ground and logs it as a bug.
- **Stuck in walls after growing**: the room check before growing (section 1), and an "unstuck" push if anything ever overlaps.
- **Camera clipping into walls**: the camera is pushed in front of walls, at every size.
- **Objects jittering or exploding**: physics settings follow your size, heavy things resting on light things are handled
  carefully, and items that spawn overlapping are moved apart gently.
- **NPCs stuck, walking into walls, spinning**: navigation meshes for every size, door awareness, and a stuck-detector that
  replans their path.
- **Voice lines cut off or skipped**: lines queue and wait for each other; muting keeps the timing.
- **Sound spam** (100 sounds at once when stuff falls): sounds are limited per object and per frame, quieter duplicates merge.
- **Saves breaking**: saves are checked after writing, an old copy is kept, versions upgrade cleanly.
- **Memory leaks / slowdown over time**: everything removed from the world is cleaned up; a long-run test plays for hours.
- **UI traps**: Esc / back always works, menus never open twice, the mouse never gets lost.
- **Doors launching you**, **cars flying**, **ragdolls freaking out**: force limits and joint limits.
- **Two people in one chair**, **items inside each other**: seats and spots are reserved.
- **Time desync** (lights on in the day, shops open at 3 AM): everything reads the same clock.
- **Lag spikes when spawning**: heavy stuff (people, big models) is prepared ahead of time or in small pieces.

### How it's tested
- Automatic test runs in a real browser that:
  - start the game at every size level and check nothing is broken in the picture,
  - spawn every catalog item, pick it up, drop it, shrink it, grow it,
  - walk the player through every door, up every staircase, into every room,
  - run the town for game-days in fast-forward and check no person gets stuck and nothing falls out of the world,
  - save and load and compare the world before and after,
  - measure frame rate on Low settings.
- Screenshots at many sizes and places, checked by eye.
- Every bug found gets a test so it can't come back.

---

## 20. Real-life stuff you didn't say (added anyway)

**Your body**: hiccups, sneezing (pollen, pepper, dust), yawning (it's contagious, people around you yawn too), goosebumps when cold,
sunburn (sunscreen works, the UV index matters, tan lines), brain freeze from cold drinks, getting dizzy from spinning, stubbing
your toe, paper cuts, splinters, mosquito bites that itch, poison oak in the California woods (touch it and get an itchy rash a day
later: real), getting soaked (wet clothes are heavy and make you cold), sand in your shoes after the beach, sweat stains, hair and
nails and beards growing (you need haircuts, stubble grows over days), bad breath in the morning, bed hair, caffeine jitters,
being hangry, needing glasses (some people see blurry without them), bruises changing color as they heal, scars that stay.

**Home life**: dishes piling up, laundry piles, making the bed, vacuuming, dusting, cleaning the bathroom, taking out the trash,
mail (letters, bills, junk mail, packages, magazines), a running toilet, a clogged toilet (plunger), a dripping faucet, a squeaky
door, the smoke alarm low-battery chirp, mold in a damp bathroom, a lawn that grows (mowing), leaves in the gutters, a pool that
turns green if nobody cleans it, fingerprints on glass and screens, dust on things nobody uses, fridge magnets and kids' drawings
on the fridge, the junk drawer, a lost remote, a dead phone, a forgotten Wi-Fi password, spare keys under the mat.

**Real physics fun**: things float or sink by density (ice floats, a can of diet soda floats in water while regular soda sinks:
real), shaking a soda then opening it sprays, mint candies dropped in soda erupt, static electricity (rub a balloon on your hair;
at tiny size static makes dust and you stick to things), magnets, a magnifying glass burning a dot with sunlight, mirrors and
prisms making rainbows, echoes, ice melting, water boiling and freezing, metal feeling colder than wood, rust (fast on the coast
because of salty air: real), colors fading in the sun, candles melting down, old batteries leaking, frozen cans bursting.

**Pets**: pet hair on everything (at tiny size, each hair is a log), fleas, the litter box, walking the dog, fetch, a dog that
escapes when the gate's left open (cause), lost pet posters, pets getting old, the vet, pet funerals in the backyard.

**Kids** (all safe): homework, report cards, lunchboxes, cartoons, toys all over the floor (stepping on LEGO-style bricks
barefoot), tantrums, bedtime stories, nightlights, losing baby teeth (and parents sneaking money under the pillow, the real
tooth fairy), birthday parties, sleepovers, kids being bored and making their own games.

**Town life**: rush hour traffic, school zone slowdowns, street sweeping days (park on the wrong day and get a ticket), parking
meters, potholes, car alarms going off when a car gets bumped, car washes, the DMV (long lines to renew your license), dog poop on
sidewalks from owners who don't pick it up (cause), gum and cigarette butts, graffiti, house parties (and noise complaints that
bring the police), garage sales, local elections (yard signs, the mayor's race), jury duty letters, protests, tourists taking
photos, people experiencing homelessness living in town with their own stories (treated like real people), church on Sundays,
volunteers at the beach cleanup.

**Money life**: paychecks every two weeks, rent and landlords, eviction if rent isn't paid, taxes in April, insurance claims
(when your house gets wrecked, the insurance company sends someone), credit scores, loans, lottery tickets, tips, sales and
coupons, Black Friday crowds.

**Phones and tech**: updates at the worst time, spam calls and spam texts, low battery panic, phone screen time (people
doom-scroll), group chats, memes, video calls, selfies with face filters, tangled cables, lost earbuds, cracked screens, printers
that jam, captchas, forgotten passwords.

**Nature**: rainbows after rain, sunsets over the ocean, morning dew, the foghorn, fallen leaves, spider webs with dew, pollen season
(allergies), seagulls stealing fries, pigeons on the pier, ant trails getting into the kitchen when it rains (real Argentine ant
behavior), crickets chirping faster on warm nights (real), birds singing at dawn, bats at dusk, the smell after rain.

---

## 21. What I can't do (honest)

- **Real brands, real movies, real shows, real songs**: I can't put them in (they belong to other people). The game has the same
  kinds of things with made-up names and its own movies, shows and music.
- **Every real city on Earth in full detail**: I can't do that. The town is fully detailed; the rest of Earth is real geography
  (coastlines, mountains, oceans) without walkable cities.
- **The real internet inside the game**: the in-game internet is made-up websites. The only real connection is the AI chat if you
  give it your own Claude key (and the free local AI runs on your own computer).
- **Real quantum physics at the atom level**: atoms and electron clouds are shown the way scientists picture them, not simulated
  exactly.
- **Harming kids, or anything about real people**: not in the game at all.
- **Real-world how-to for weapons, drugs, explosives or hacking**: the game has its own versions (crafting benches, made-up dark web)
  that work by game rules.
- **Literally every object that exists**: the catalog will be huge (hundreds of items to start, and it keeps growing with every
  update), but it can't be infinite.

---

## 22. Build order

All of it is the plan. It gets built in waves so you can play early and every wave gets bug-hunted before the next one.
This is many sessions of work.

- **Wave 1: the core** (playable): the engine, the watch and shrink ray with real size physics from about 1 mm to about 17 m,
  your mansion + the secret lab + the street around it, The Glitch and the regular dude (+ character maker basics), two hands,
  picking up anything, doors, drawers, sitting, breaking glass and stuff, the phone with the shopping app (a big starter catalog),
  ants, spiders, the mantis, flies, the dog and the cat, a handful of townspeople with real minds and routines, day/night and
  basic weather, the soundtrack, settings, saves, mobile controls.
- **Wave 2: the town**: the whole town, the beach, pier, arcade, Ferris wheel, tide pools, creek, woods, sewer; the full catalog;
  power and plugs, electronics, TVs, the PC; your 3 cars and traffic; more creatures; shrunk people's tiny society;
  the history system and inspect tool.
- **Wave 3: life**: crime, police, court and jail; your business; dating, texting, ghosting; families, pregnancy, babies, kids;
  the hospital; the experiment room, anatomy and max gore.
- **Wave 4: the extremes**: the micro world down to atoms; kaiju, Earth, space, the solar system, galaxies, the universe;
  rockets; the telescope sky.
- **Wave 5: the deep stuff**: the AI brain (Claude key / local AI), games on the in-game PC + the AI game maker, VR,
  every holiday, seasons, possession, more inventions.

---

## 23. Your answers (decided)

1. **Name**: the game is **SCALE**. **RIFT LAB** is your secret lab, your inventions company, and the studio logo (torn text with
   a glowing rift) that plays first on the menu.
2. **First start**: a normal morning in your mansion, find the hidden lab, finish the watch (tutorial), then "2 YEARS LATER",
   then free play (section 18).
3. **Stair falls**: real tumble at real speed, plus a "slow-mo big falls" setting (off by default).
4. **Kid player**: deadly stuff knocks you out and you wake up at the hospital or home. No gore ever.
5. **Possession crimes**: the possessed person gets blamed first; evidence of your RIFT tech can turn the case toward you (section 12).
6. **Secret lab**: 100% hidden, nobody can find it.
7. **Starting money**: picked in settings when you make a world.
8. **Growing up speed**: a setting (real, medium, fast).
9. **Bug look**: 100% real by default, "less creepy" option in settings.
10. **Interiors**: every building can be entered.
11. **Claude key use**: a setting: off / only when you talk to someone / everything, with a daily spending limit.
12. **Anything else**: send it any time and it goes in.
