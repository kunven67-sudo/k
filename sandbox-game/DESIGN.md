# Sandbox Game: Design Doc

> Name: **Real Life Sandbox**
> Status: planning (no code yet; nothing gets built until the owner says "build it")

## Big picture
A **realistic first-person life sim town + sandbox arena**, playing in the browser (Three.js).
- Live a real-life-style life in a small town (jobs, money, taxes, bills, stores, cars, property, PCs).
- Go to the **sandbox arena** to spawn things, build, and blow everything up legally.
- Later on: go to **outer space** (rockets, Moon, zero gravity).

## Hard rules
- **Realistic like real life** is the default for EVERY feature. Don't ask "realistic or not?" again.
- **Must not lag.** Get realism from real photo-scanned textures + realistic lighting, and fake the expensive stuff smartly (fog/LOD/instancing, capped debris, faked fire/liquids).
- **Built in versions** (v1 core → v2 → v3...). The owner plays each version and gives feedback.
- **Ask detailed questions before building anything.**

## Tech
- Browser, Three.js, PC mouse + keyboard.
- Real photo-scanned textures (free CC0 sources like Poly Haven / ambientCG).
- First person.

## Player movement
- Walk, sprint, jump
- Crouch + slide
- Fly mode (toggle)
- Double jump / jetpack
- God mode: **toggle in settings** (off = you can get hurt and die, then respawn)
- Explosions **launch the player** (rocket-jump style)

## Sandbox arena
- Big flat test arena, realistic look.
- **Spawn menu**: big grid with pictures (Garry's Mod / People Playground style).
- **Placement**: ghost preview → rotate → click to place.
- **Building**: snap to grid + weld tool.
- **Spawnable**: basic shapes, real props (barrels, crates, tires, pallets, gas tanks, concrete blocks), vehicles, ragdoll crash-test dummies.

### Materials (all realistic)
| Material | Behavior |
|---|---|
| Wood | burns, chars black, splinters |
| Metal | heavy, dents, glows red when hot |
| Glass | shatters into shards |
| Ice | melts, slippery |
| Concrete | crumbles into chunks |
| Rubber | bounces |
| TNT | explodes |
| Fuel / gas tanks | explode when shot or burned |

- **Breaking**: realistic per-material fracture; chunks fade over time (no lag).
- **Fire**: spreads across wood, chars objects black so they crumble, rising smoke, metal glows hot.
- **Liquids**: undecided. Owner wants a **preview page** comparing faked liquids vs real liquid sim first.

### Tools
- **Explosives**: TNT, grenades, rocket launcher, C4 + detonator, nuke, molotov/napalm, sticky bombs, landmines, airstrike.
- **Grapple gun**: Spider-Man swing; can also yank objects / tie objects together.
- **Portal gun**: Portal 2 style (blue + orange, on walls/floors, momentum carries, objects go through). Max 2 portals.
- **Guns**: pistol, revolver, assault rifle, SMG, shotgun, sniper, minigun.
  - Recoil + reload animations
  - Bullet holes + penetration (through wood/glass, not thick metal)
  - Aim down sights
  - Infinite ammo toggle

## Life sim town
- **Jobs + money**, including a **tech job** (computer store / PC repair).
- **Taxes + bills**.
- **Stores + food/drink** (soda etc.), hunger & thirst.
- **Cars you own**: buy, drive, refuel, crash, repair.
- **Property**: houses / apartments / garages to own.
- **PCs, graphics cards, consoles**:
  - Build your own PC part by part
  - Use them in-game (mini-games)
  - Buy them as props, put them in your house, smash them
- **Police**: realistic. Destruction in town → cops respond → arrest / fines / jail depending on what you did. The arena is legal.

## Space
- Rockets, the Moon, zero-gravity sandbox (later version).

## Version plan
- **v1 (core)**: movement + full body, spawn menu + all 8 materials (ghost preview, snap, weld), explosives (TNT, C4, grenades, rocket launcher) + realistic breaking + player launch, a few guns (recoil, ADS, bullet holes), settings menu.
- **v1.5 (extras)**: grapple gun, fire, ragdoll dummies, portal gun.
- **After v1.5**: liquids preview page → rest of explosives & guns, vehicles...
- **Later**: town + life sim systems, then space.

## Controls
- **B** opens the spawn menu.
- **Hotbar 1-9 + mouse scroll** to switch tools/guns.
- **Space x2** = double jump, **hold Space** = jetpack, **V** = fly toggle.
- **Z** undo last spawn. Delete tool, Clear All button, Freeze tool (freeze objects in mid-air).

## v1 details
- **Guns**: pistol, assault rifle, shotgun, sniper.
- **Arena size**: medium, ~300m.
- **Explosion feel**: camera shake (by distance), ear ringing + muffled sound when too close, visible shockwave + dust cloud, scorch marks that stay on the ground.
- **Main menu**: live 3D background, a slow camera flying over the arena while stuff explodes, menu on the side.
- **Arena look**: concrete test facility. Huge concrete pad, painted grid lines, ramps, tall pillars, shipping containers, chain-link fence, open sky.

## Settings menu
- Graphics quality (Low/Med/High/Ultra), shadows, render distance, FPS counter
- Mouse sensitivity, FOV
- Volume sliders: master, effects, music, ambient
- Gameplay toggles: god mode, infinite ammo, debris limit

## Feel & menus
- **HUD**: minimal realistic. Small crosshair, ammo only when holding a gun, money/time small in a corner.
- **Sound**: realistic weapon/explosion sounds (echo, distance delay, muffled far away), ambient world (birds, wind, traffic, city), music + car radio, material impact sounds (wood thunk, metal clang, glass smash).
- **Saving**: auto-save life progress, save/load arena builds, multiple save slots.

## You & the world
- **Full body**: look down and see your legs, hands hold items, real shadow.
- **One default character** (no character creator).
- **Day/night cycle**: real sunrise/sunset, street lights at night. 1 in-game day = 48 real minutes.
- **Weather**: rain, fog, storms, snow, wet roads.
- **Seasons**: summer/fall/winter/spring.
- **Arena time controls**: set time of day/weather + slow motion.

## Open questions
- Liquids (preview page after v1)
