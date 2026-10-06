# Physbox — design spec

A Garry's Mod–style sandbox, but better. Everything below was chosen by the player
in the question rounds.

## Round 1
- **Name**: Physbox
- **Main things to do**: all of them —
  - Build contraptions (weld, wheels, thrusters, hinges, ropes, motors; drive/fly what you build)
  - Destroy stuff (explosives, weapons, fire, real breakage, chain reactions)
  - Ragdolls & NPCs (spawn, pose, throw, AI that reacts)
  - Make scenes & photos (pose, lights, cameras, screenshots, little movies)
- **Physics**: real physics (most realistic): real mass, friction, buoyancy, air drag;
  materials bend, crack and shatter like wood, metal, glass, concrete.
- **World**: a real round planet with real gravity, and you can fly off into orbit and space.

## Round 2
- **Camera**: first-person, third-person, and a flying free builder camera (switch any time).
- **Better than GMod** (all of these):
  - Wiring & logic built in (buttons, sensors, timers, wires — like Wiremod)
  - Real engines (torque, gears, fuel, propellers, wings with real lift and drag)
  - Real destruction (pieces break by material and force, no pre-made breaks)
  - Save & share builds (dupes you can paste into any world)
- **Ragdolls & NPCs**: active ragdolls with muscles (balance, brace, grab, stumble) — most realistic —
  plus smart NPCs that walk, drive, flee and fight, falling back to muscle physics when hit.
- **Planet size**: real Earth size (6,371 km radius, real gravity; orbit needs a real rocket, ~8 min) — most realistic.

## Round 3
- **Space**: the real Moon at 384,000 km plus the Sun and the other planets at real distances you can fly to — most realistic.
- **Spawn menu**: everyday props, building parts (real strength), vehicle parts, machines & electronics.
- **Shrinking**: you can shrink yourself (player request).
- **Collisions must be exact** (player request): furniture and props collide with their real shape —
  never walk through things, never bump into invisible walls (no box colliders around chairs/tables;
  you can walk under a table and between chair legs when small).
- **Environment**: real day/night + seasons + Moon phases; weather & wind (pushes things, storms, lightning,
  tornadoes); real oceans (waves, buoyancy, boats that flood and sink); fire & heat by material
  (wood burns, metal glows and melts, ice melts).
- **Weapons & explosives**: real ballistics — bullet drop, penetration by material, explosives with real
  shockwaves and fragments — most realistic.

## Round 4
- **Size**: shrink or grow to any size, and you move the same at every size (fun physics for your own body).
  **At any size you never fall through the floor** (player request): continuous collision for the player,
  colliders that scale with you, no tunnelling at tiny or huge sizes.
- **Modes**: Sandbox.
- **Damage to you**: real injuries — broken legs make you limp, bleeding, burns, no air in space or underwater;
  your body is an active ragdoll too — most realistic.
- **Graphics**: photoreal by default (real lighting, shadows, reflections, atmosphere from ground to space),
  with quality settings so it runs on weaker computers and phones.

## Round 5
- **Tools**: grab gun + tool gun, like GMod (grab, rotate, freeze; tool modes such as weld, rope, hinge, wheel, thruster).
- **Earth**: real continents, oceans and mountains in their real places, with made-up detail up close — most realistic.
- **NPCs**: people (walk, talk, flee, drive, react), soldiers/fighters (cover, shoot, fight), animals
  (dogs, birds, fish, horses, with real body physics), robots & aliens.
- **Spaceflight**: fully real — real orbits, fuel and thrust math (rocket equation), staging,
  reentry heating that can burn up your ship, time warp for long trips — most realistic.

## Round 6
- **Vehicles**: all of it — ready-made cars, trucks, planes, helicopters, boats and rockets in the spawn menu,
  built from real parts so you can unweld, swap or upgrade any piece; or build your own from parts.
- **Earth's surface**: towns & roads, big cities (skyscrapers, highways, traffic, crowds), military bases &
  airports (runways, hangars, a rocket launch pad), and wide wild nature (forests, deserts, mountains, ice, ocean).
- **Sound** (setting): real sound by default — silent in space, real speed of sound, muffled underwater —
  or "always sound".
- **Day length** (setting): real 24 h by default, with a day-length slider.

## Round 7
- **Buildings**: fully destructible — walls, floors and beams carry real loads; take out supports and it collapses — most realistic.
- **Physics settings** (all): gravity slider, slow motion, freeze everything (set up then press play), undo & rewind.
- **Water**: real flowing water — pour, flood rooms, fill tanks, break dams — most realistic (heavy; quality setting scales it).
- **Blood & gore**: player asked for full gore. Gore setting: Off / Light / Full (blood, wound decals,
  limbs can come off at Full). Default Light; Full is opt-in in settings.

## Round 8
- **Spawn**: start at a home build site; teleport anywhere on the real Earth from a 3D globe map.
- **Character**: all of it — customize a person (body, skin, hair, clothes, helmet; spacesuit in space),
  ready-made presets, or play as a robot, alien or animal.
- **Platform**: computer only (keyboard + mouse), full graphics.
- **Space building** (all): space stations (launch and dock parts), Moon & Mars bases with real life support
  (oxygen, power, heat), satellites you can see crossing the sky, giant megastructures (orbital rings, space elevators).

## Round 9
- **Programming**: both — wires + logic gates for simple builds, and code chips (write small programs,
  like GMod's Expression 2) for autopilots, robots and advanced builds.
- **Explosions** (all, "and more big"): TNT & grenades (real blast power by weight), big bombs that level
  buildings, nukes with real fireball/shockwave/mushroom cloud by yield, meteor strikes with real craters —
  and even bigger (see round 10).
- **Natural disasters** (all): earthquakes (buildings can collapse), volcanoes (lava, ash, bombs),
  tsunamis (flood the coast), tornadoes & hurricanes (pick things up and throw them).
- **NPC orders**: both — NPCs live their own lives until you order them (follow, guard, drive, fight, flee).

## Round 10
- **Mega booms** (all): Tsar Bomba (50 Mt), dinosaur-killer asteroid (10 km: global firestorm, mega-tsunami,
  impact winter), break the Moon into a debris ring, destroy Earth (real binding energy, ~2×10^32 J).
- **Explosion types with realistic injuries** (player request): blast overpressure, heat/flash burns,
  fragments and shrapnel, each hurting bodies realistically (skin/limb damage shown per the gore setting).
- **Persistence**: everything stays — craters, ruins, floods stay forever in that world save — most realistic.
- **Global effects**: real — big impacts and nuclear war loft dust and soot, cool the planet, start fires,
  darken days worldwide — most realistic.
- **Music**: ambient music that changes with where you are (city, nature, space); setting to turn it off.

## Round 11
- **Crashes**: soft-body crumple like BeamNG — metal bends, frames twist, engines push back — most realistic.
- **Movement powers** (all): noclip, jetpack (real thrust + fuel), parachute & wingsuit, superpowers
  (super jump / strength / speed, toggle).
- **Weapons** (all): real guns (real ballistics), melee (bats, crowbars, swords, hammers), launchers
  (rockets, grenades, mortars, artillery), sci-fi (lasers, gravity gun, freeze gun, black-hole gun).
- **Cockpits**: real 3D cockpits with working gauges (speed, altitude, fuel, artificial horizon, orbit navball) — most realistic.
