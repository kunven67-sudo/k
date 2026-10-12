# Sandbox Game: Design Doc

> Name: **Real Life Sandbox**
> Status: building **v1, chunk 1** (owner said build it). Play by double-clicking `RealLifeSandbox.html`.

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
- Browser (owner uses **Edge**), Three.js, PC mouse + keyboard.
- **Owner's PC**: NVIDIA GT 1030 2GB (entry-level), 16GB RAM. Target **60 FPS**.
  - Default preset tuned for GT 1030: 1K textures, sun is the only shadow light, render scale + upscale, tuned debris caps.
  - "High" preset for stronger GPUs.
  - If FPS drops in huge explosions: **keep the realistic look, allow FPS drops** (don't auto-lower quality).
- **Sounds**: real recorded CC0 sounds (not generated).
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
- Objects spawn as their **real-life material** by default (barrel = metal, crate = wood); the edit tool can swap the material.
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

- **Material details**:
  - Concrete: steel **rebar** inside. Concrete crumbles, rebar sticks out and holds chunks together.
  - Glass: **normal** (big sharp shards) and **tempered** (tiny cubes all at once, e.g. car windows).
  - Metal: dents, bends under load (steel beams), tears open from big blasts (drums, sheets), scorches black + glows red when very hot.
  - Wood: splits along the grain with jagged splintered ends, splinters fly on impact, plywood layers peel apart vs solid wood snaps, bullet holes go all the way through (light shows through).
  - Rubber: realistic bounce (balls bounce more than tires), squishes on impact, tires pop when shot, tears in blasts, melts + black smoke when burning (v1.5 fire).
  - Fuel/gas: leaks/sprays when shot, leaked fuel makes an ignitable puddle (v1.5 fire), shot propane tanks can rocket off before exploding, bigger tank = bigger explosion.
  - Ice: slippery, melts slowly (faster near heat/explosions, leaves a puddle), spiderweb cracks before shattering.
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

## Damage & health (when god mode is off)
- **Hurt by**: explosions + shrapnel, falls, heavy objects hitting/crushing you, your own ricochets.
- **Real-life damage model**:
  - Body-part damage (head, chest, arms, legs). Leg hit = limp, arm hit = shaky aim.
  - Bleeding (need a bandage), broken bones from falls (need a splint), burns.
  - Damage effects depend on what hit you.
- **Healing**: like real life. Slow natural healing + treatment.
- **Medical items (v1)**: bandage (stops bleeding), splint (fixes limp), medkit (bigger heal), painkillers (removes shaky aim/blur for a while).
- **Gore**: FULL MAX gore. Blood, wounds, dismemberment (sliced up, shot apart).
  - Applies to: the player, ragdoll dummies, town NPCs (later).
  - Losing a limb = you bleed out fast and die.
- **Death**: your body ragdolls, screen fades, respawn at spawn point. Builds stay.

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
- **v1 (core)**: movement + full body, spawn menu + all 8 materials (ghost preview, snap), connectors (weld, glue, nails/screws, hinges), explosives (TNT, C4, grenades, rocket launcher) + realistic breaking + player launch, guns (pistol, AR, shotgun, sniper), damage/gore/medical, slow-motion button, settings menu.
- **v1.5 (extras)**: grapple gun, fire, ragdoll dummies, portal gun, wheels + motors, ropes/chains.
- **After v1.5**: liquids preview page → rest of explosives & guns, vehicles...
- **Later**: town + life sim systems, then space.

## Build chunks (v1)
1. **Chunk 1**: arena + movement + spawn menu + materials + breaking + explosives + tools.
2. **Chunk 2**: guns, damage, gore, medical, full body + hands/tool viewmodels.
3. **Chunk 3**: polish (main menu extras, achievements, more hints, screen effects, sounds once real assets are reachable).

## Chunk 2 decisions
- **Outfit** (visible body + hands): work clothes. Jeans, work boots, gloves, hi-vis vest.
- **Ammo** (infinite ammo off): spawnable ammo boxes; grab with F.
- **Gun audio**: indoor vs outdoor (indoors boom + echo, outdoors crack + roll off the hills).
- **Assault rifle**: auto / semi switch on **X**.
- **Medical use**: takes time like real life (bandage ~3s, splint ~6s, medkit ~8s), can't shoot meanwhile, interrupted if hit.
- **Med keys**: H bandage, J splint, K medkit, L painkillers (hotbar stays for tools).
- **Injury info**: screen effects (red edges, blur, heartbeat, limp) + body status picture in the Esc menu + tiny icons only when bleeding/broken.

## Play setup
- One HTML file, double-click to open in Edge.
- **Auto fullscreen on Play** so Ctrl+W (crouch + forward) can't close the tab. Esc leaves fullscreen and pauses.
- Real photo textures + recorded sounds: blocked by this cloud environment's network policy until the owner allows the asset sites. The game picks them up automatically from `assets/` once added.

## Controls (all rebindable in settings; full list shown in the Esc menu)
| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint (while aiming the sniper: hold breath to steady) |
| Space | Jump |
| Space x2 | Double jump |
| Hold Space (in air) | Jetpack |
| Ctrl (hold) / C (toggle) | Crouch; crouch while sprinting = slide |
| V | Fly toggle |
| Q / E | Lean left / right |
| F | Pick up light objects with hands; hold left click to throw harder |
| Left click | Fire / use tool |
| Right click | Aim down sights / physics gun: freeze |
| R | Reload / physics gun: rotate held object |
| 1-9, mouse scroll | Hotbar |
| B | Spawn menu |
| Shift + scroll | Resize ghost preview (basic shapes) |
| T | Slow-motion toggle (sound slows + deepens too) |
| Z | Undo last spawn |
| Esc | Pause menu: settings, controls, save/load |

- **Physics gun** (edit tool): hold click to grab, drag with mouse, scroll to push/pull, R to rotate, release to drop, right-click to freeze.
- Cleanup: Delete tool, Clear All button, Freeze tool (freeze objects in mid-air).

## v1 details
- **Guns**: pistol, assault rifle, shotgun, sniper. Modern real-world style with generic names ("9mm Pistol", "Assault Rifle").
  - Ballistics: bullet drop (sniper), bullet travel time, ricochets off metal at shallow angles (sparks), hip-fire spread.
  - Handling: scope sway + breathing (hold Shift to steady), gun lowers when sprinting, shell casings eject and clink, muzzle flash light + smoke.
  - Impacts: bullets push objects, enough hits break wood/glass/concrete, shot gas tanks/drums leak then explode, per-material effects (wood splinters, concrete dust, metal sparks, glass cracks).
- **Spawn menu**: tabs (Shapes / Props / Explosives / Weapons / Tools) + search bar.
- **v1 props**:
  - Construction: concrete blocks, cinder blocks, steel beams, wood planks, pallets, scaffolding
  - Containers: wooden crates, oil drums, propane/gas tanks, shipping container, cardboard boxes
  - Everyday: soda cans, vending machine, TV, PC tower, chairs, tables, fridge
  - Glass: window panes, glass walls, bottles
- **Resizing**: Shift + scroll on the ghost preview (basic shapes only; props stay real size).
- **Weight**: real density per material, bigger = heavier.
- **Arena size**: medium, ~300m.
- **Start time**: golden hour sunset (time controls can change it).
- **Camera feel**: head bob, lean left/right, landing dip, heavy breathing + sway after sprinting.
- **Screen effects**: motion blur, lens flare/sun glare, film grain + vignette, depth of field when aiming. (Each toggleable in graphics settings for the GT 1030.)
- **Footsteps**: per surface (concrete, metal, wood, glass shards, puddles).
- **Spawn point**: small concrete control building with a big window over the arena; door leads outside.
- **Arena music**: off by default. Spawnable radio/boombox prop plays music (and can be blown up).
- **Detonation**: remote detonator (blow all at once), timer with beeping, fuse on TNT (sparks + hiss), chain reactions (TNT/C4/gas tanks set each other off).
- **Rocket launcher**: RPG style. Single shot, slow reload, smoke trail, backblast behind you. Rocket jumping works but hurts (unless god mode).
- **Connectors**: weld (metal, strongest), glue, nails/screws (wood, weaker), ropes/chains, hinges, wheels + motors. All have realistic strength and snap under enough force.
- **Grenades**: cook it (pull pin, hold), real bounce & roll, hold to throw farther with arc preview, shrapnel that damages/dents nearby stuff.
- **Explosion feel**: camera shake (by distance), ear ringing + muffled sound when too close, visible shockwave + dust cloud, scorch marks that stay on the ground.
- **Main menu**: live 3D background, a slow camera flying over the arena while stuff explodes, menu on the side.
- **Arena look**: concrete test facility. Huge concrete pad, painted grid lines, ramps, tall pillars, shipping containers, chain-link fence, open sky.

## Settings menu
- Graphics quality (Low/Med/High/Ultra), shadows, render distance, FPS counter
- Mouse sensitivity, FOV
- Volume sliders: master, effects, music, ambient
- Gameplay toggles: god mode, infinite ammo, debris limit, gore level (default MAX)

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
