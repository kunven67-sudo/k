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

## Build decision
- Player said "make this file" after round 4: build Physbox now from the answers above.
