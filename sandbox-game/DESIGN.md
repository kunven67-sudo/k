# Sandbox Game: Design Doc

> Working title: TBD
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

## Version plan (draft, still being decided)
- **v1**: sandbox arena core: movement, spawn menu, materials, breaking, explosions.
- **v2+**: guns, grapple, portal gun, fire, ragdolls, vehicles...
- **Later**: town + life sim systems, then space.

## Open questions
- Game name
- Liquids (needs the preview page)
- What exactly goes in each version
- Sound, music, menus, HUD, settings, saving
