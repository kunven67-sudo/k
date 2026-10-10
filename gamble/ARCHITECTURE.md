# GAMBLE — Architecture & Engineering Contract

Read `DESIGN.md` (the design bible) for *what* the game is. This file is *how* it is built.
Every module author (human or agent) follows it so independently-built parts snap together.

## 0. Non-negotiable quality bar

GAMBLE must look and feel like a real studio made it. The owner's dealbreakers:
**lag, looking AI-made/cheap, bad collisions, getting boring.** Concretely:

1. **No plastic.** Every surface gets texture, wear and variation (procedural PBR: color + roughness
   + normal detail, grime, edge wear, decals). Flat single-color `MeshStandardMaterial`s are a bug.
2. **Never too clean.** Dirt, scuffs, stains, cracks, clutter, trash where real places have them.
3. **No stiff animation.** Weight, anticipation, follow-through, foot planting (no sliding),
   secondary motion / MAX jiggle on soft things.
4. **No default UI.** Custom typography (fonts in `assets/fonts`), designed layouts, motion, sound
   on every interaction. Never a browser-default button, alert(), or system font.
5. **Collisions match visuals.** If you can see it, it blocks you exactly where it looks solid.
   No invisible walls, no walking through props. Curbs/steps auto-step.
6. **60 fps on a gaming PC, smooth on a newer iPhone.** Read `engine.tier` and scale.
7. **Everything original.** No downloaded models/textures/music/sounds. Geometry, textures, audio
   and music are generated in code. Real *brand names* are allowed as text (no logos copied).
8. **Golden rules from DESIGN.md:** most realistic option wins; behavior depends on the person;
   features depend on the specific thing; outcomes depend on the situation.
9. **No HUD.** No health bars, minimap or interaction prompts in gameplay. Information comes from
   the body, the phone, the watch, the world (DESIGN.md §1).

## 1. Stack

- Plain ES modules, no build step (GitHub Pages serves the repo). Import map in `index.html`:
  `three` → `vendor/three/three.module.js` (r180), `three/addons/*` → `vendor/three/addons/*`,
  `rapier` → `vendor/rapier/rapier.mjs` (Rapier 3D 0.19, WASM inlined).
- WebGL2 renderer, AgX tone mapping, sRGB output, post FX (bloom, film grain/vignette,
  blur/tunnel effects) via `EffectComposer`.
- Physics: Rapier (fixed 60 Hz). Audio: Web Audio. Storage: localStorage (cloud later).
- Fonts (OFL/Apache, vendored woff2): Playfair Display (casino/classic), Rye (western), Inter (UI,
  phone), Bebas Neue (display), Special Elite (typewriter/newspaper), Monoton (neon).

## 2. Directory layout

```
gamble/
  index.html, manifest.webmanifest, sw.js, css/game.css
  assets/fonts, assets/icons
  vendor/three, vendor/rapier
  src/
    main.js                 boot: input, audio unlock, physics init, engine, states
    core/                   engine.js events.js input.js physics.js audio.js clock.js save.js
                            settings.js i18n.js quality.js rng.js util.js
    gfx/                    procedural textures/materials, sky, decals, shared shaders
    character/              procedural humans: body, face, hair, clothes, rig, animation, jiggle
    audio/                  sfx library (procedural) + music engine
    ui/                     boot screens, menus, settings, loading screens, phone UI kit
    world/                  Reno map pieces, buildings, interiors, props, NPC placement
    player/                 controller, camera, interactions, needs, pockets, phone-in-hand
    casino/                 cage, chips, slots, blackjack, roulette, tickets, close-up cameras
    creator/                DMV photo booth character creator
    states/                 one file per engine state + index.js registry
  dev/                      standalone dev/test pages per module (not linked from the game)
  tools/shot.mjs            headless screenshot/test tool
```
**Ownership rule:** a module only edits files inside its own directory (plus its own dev page and
its own state file). Shared core files (`src/core/*`, `src/main.js`, `index.html`,
`css/game.css`, `states/index.js`) are changed only by the integrator. If you need a core change,
write it down in your final report instead of editing.

## 3. Core APIs (src/core)

```js
import { bus } from '../core/events.js';        // bus.on(name, fn) → off(); bus.emit(name, payload)
import { settings } from '../core/settings.js'; // settings.get(k) / set(k, v); 'settings:changed'
import { i18n, t } from '../core/i18n.js';      // i18n.register(ns, {en:{}, es:{}}); t('ns.key', vars)
import { input } from '../core/input.js';       // input.move{x,y} look{x,y} down/pressed/released(action)
                                                // input.pointer{...} input.setPointerLock(bool)
import { audio, synth, ROOMS } from '../core/audio.js'; // audio.define(name, gen); audio.play(name, opts)
import { clock, TIME_SCALE, RENO, sunPosition, moonPosition } from '../core/clock.js';
import { save } from '../core/save.js';         // save.registerSlice(id,{create}); save.slice(id)
import { PhysicsWorld, RAPIER, GROUPS } from '../core/physics.js';
import { currentTier, device } from '../core/quality.js';
import { Rng, fairRandom, fairInt, fairShuffle } from '../core/rng.js';
import { clamp, lerp, damp, springStep, el, injectStyle, formatMoney } from '../core/util.js';
```

### Engine (`src/core/engine.js`)
- `engine.renderer`, `engine.scene`, `engine.camera`, `engine.physics` (a `PhysicsWorld` the
  active state creates and assigns), `engine.tier` (quality knobs, see `quality.js` TIERS),
  `engine.uiRoot` (DOM root for the state's UI; cleared on state change), `engine.effects`
  (shader uniforms: `uBlur`, `uTunnel`, `uDesat`, `uTint`, `uVignette`), `engine.bloomStrength`.
- `engine.setView(scene, camera)`, `engine.go(stateName, params)`, `engine.fade(toBlack, ms)`.
- State interface: `constructor(engine)`, `async enter(params)`, `update(dt, realDt)`,
  `fixedUpdate(step)` (optional), `exit()`, `onResize(w,h)` (optional).
- The world never pauses (no pause rule). Menus over gameplay are overlays; time keeps running.

### Physics (`src/core/physics.js`)
`physics.addStaticBox(mesh)`, `addStaticTrimesh(mesh)`, `addGround(y)`, `addDynamicBox(mesh, opts)`
(auto-synced), `createCharacter({radius,height,position})` (Rapier KCC with autostep 0.32 m,
snap-to-ground), `raycast(origin, dir, max, {groups, exclude})`, `sphereCast(...)`,
`setOwner(collider, owner)` (owner objects are how interactions find what was hit),
`onContact(collider, fn)`. Groups: `GROUPS.static|dynamic|character|vehicle|trigger|ragdoll|cameraOnly`.

### Audio (`src/core/audio.js`)
Buses: `music, sfx, ambience, voice, ui`. `audio.define(name, (ctx) => AudioBuffer)` registers a
procedural sound (built lazily, cached). `audio.play(name, {bus, gain, rate, detune, loop,
position:{x,y,z}, refDistance, rolloff, reverb, occluded})` → handle `{stop(f), setPosition,
setGain, setOcclusion}`. `audio.setRoom(ROOMS key)` crossfades reverb for the current space.
`synth(ctx, seconds, (t,i,rate)=>sample)` helper for generators. Unlock happens on first gesture.

### Clock (`src/core/clock.js`)
`clock.gameMs` (UTC epoch), `clock.local` {year,month,day,hour,minute,second,weekday} in Reno time,
`clock.hourFloat`, `clock.speed` (sleep time-lapse), `clock.sun()`/`clock.moon()` real sky
positions, `clock.format(intlOpts)`. Events: `clock:minute`, `clock:hour`, `clock:day`.
`TIME_SCALE = 30` (48 real minutes per game day).

### Save (`src/core/save.js`)
One life. `save.registerSlice('money', { create: (life) => ({ cash: 100 }) })`, then
`save.slice('money')` returns the live object — mutate it and call `save.markDirty()`.
Autosave every 15 s + on hide. `save.newLife(character)`, `save.loadLife()` (emits
`life:catchup` for offline time), `save.endLife(obituary)` (wipes, stores obituary).

## 4. Shared events (bus)

| event | payload | emitted by |
|---|---|---|
| `settings:changed` | {key, value} | settings |
| `quality:changed` | tier | quality |
| `audio:unlocked` | – | audio |
| `state:entered` | name | engine |
| `clock:minute/hour/day` | local parts | clock |
| `life:started/loaded/ended` | life / {life, obituary} | save |
| `life:catchup` | {fromGameMs, toGameMs, realElapsed} | save |
| `money:changed` | {cash, delta, reason} | player/money |
| `chips:changed` | {chips, delta} | casino/cage |
| `needs:changed` | {needs} | player/needs |
| `interact:begin/end` | {target} | player/interact |
| `zone:entered/left` | {zone} (room, audio room, venue) | world |
| `phone:open/close` | – | player/phone |
| `notify` | {app, title, body} | anyone → phone |
| `gamble:result` | {game, bet, payout, net} | casino games |
| `jackpot` | {game, amount, position} | casino games |

## 5. Sound names (contract between `audio/` and everyone else)

Feature modules call these names; `src/audio/sfx/*.js` defines them. Use `rate`/`detune`
randomization at call sites for variety. Missing names log a warning (never crash).

```
ui.hover ui.click ui.back ui.toggle ui.slider ui.chip-place ui.card-flip ui.paper ui.whoosh
ui.error ui.confirm ui.type
step.carpet step.tile step.wood step.concrete step.asphalt step.gravel step.metal step.grass
step.snow step.water                      (each a short one-shot; play per footfall)
door.open door.close door.creak door.knock door.bang door.lock door.unlock door.slam
fridge.open fridge.close fridge.hum (loop) light.switch tv.static (loop) ac.rattle (loop)
body.stomach body.yawn body.hiccup body.burp body.breath-heavy body.groan body.heartbeat (loop)
cloth.rustle pocket.pat keys.jingle coins.drop coins.pour wallet.open bag.zip
phone.vibrate phone.notify phone.unlock phone.lock phone.tap phone.camera
chip.clack chip.stack chip.slide chip.scatter card.deal card.flip card.shuffle card.slide
dice.roll dice.hit-felt dice.hit-wall
slot.lever slot.button slot.reel-spin (loop) slot.reel-stop slot.win-small slot.win-big
slot.jackpot-siren (loop) slot.ticket-print slot.coin-hopper (loop) slot.ding
roulette.spin (loop) roulette.ball-roll (loop) roulette.ball-bounce roulette.ball-drop
cage.drawer cash.count cash.bill
amb.casino (loop) amb.city (loop) amb.night (loop) amb.motel-room (loop) amb.wind (loop)
amb.rain (loop) amb.traffic (loop) amb.neighbor-tv (loop) amb.crowd-cheer
neon.buzz (loop) neon.flicker train.horn siren.distant car.pass car.horn
splash.dice-roll splash.dice-land logo.neon-on logo.coins logo.cards logo.reels
```
Music (`src/audio/music/`): `music.play(trackId, {fade})`, `music.stop({fade})`, tracks:
`menu-lounge`, `casino-floor`, `motel-radio`, `creator-dmv`. Casino music is diegetic (from
speakers), routed through the `music` bus with room reverb.

## 6. Module contracts

### gfx (`src/gfx/`) — foundation already exists, extend it
- `noise.js`: `TileNoise(seed)` periodic `perlin`, `fbm`, `ridged`, `worley`; `hash2`.
- `textures.js`: `bakePBR(key, size, fn)` → `{map, normalMap, ormMap}` (AO/rough/metal packed),
  `canvasTexture(key, w, h, draw)` for signs/labels/posters, `textureSize(base)` (tier-scaled),
  `setMaxAnisotropy(n)` (call once with `renderer.capabilities.getMaxAnisotropy()`).
- `materials.js`: `mat(kind, {color, wear, dirt, seed, ...})` → cached PBR material with
  `userData.tileMeters`. Kinds: `asphalt sidewalk concrete curb dirt gravel grass stucco brick
  painted-wood wallpaper drywall tile-bathroom linoleum wood-floor carpet-casino carpet-motel felt
  fabric leather chrome steel brass gold aluminum metal-painted plastic rubber car-paint glass
  mirror neon emissive paper cardboard wood`. Add kinds with `registerKind(name, def)` in YOUR
  module's own file (e.g. `src/world/materials-extra.js`) — never edit materials.js itself.
  Preview every kind at `dev/materials.html`.
- `geom.js`: `worldUV(geometry, tileMeters)`, `meshWithWorldUV(geo, mat)`, `bevelBox(w,h,d,mat)`,
  `mergeStatic(meshes, mat)`, re-exports `mergeGeometries`, `mergeVertices`.
- To be built by the world module: `sky.js` (`createSky(scene, renderer, {tier})` → `{update(clock,
  weather), sunLight, hemi}`: real sun/moon/stars, day/night, fog) and `decals.js`.

### character (`src/character/`)
- `index.js` exports `createHuman(params, {tier}) → Human` and `randomHumanParams(rng, overrides)`,
  `HUMAN_PARAM_SCHEMA` (drives the creator UI: body, skin, face, eyes, hair, facial hair, outfit,
  details, voice, walk style).
- `Human`: `.root` (Object3D, feet at y=0, faces +Z), `.update(dt)`, `.setLocomotion({speed,
  turnRate, grounded, crouch, sprint})`, `.play(actionName, opts)` for one-shots (`knock`,
  `reach`, `sit`, `stand`, `pat-pockets`, `phone-up`, `phone-down`, `drink`, `eat`, `stumble`,
  `wave`, `flip-off`, `shrug`, `facepalm`, `cheer`, `tap-table`, `wave-off`, `pull-lever`,
  `toss-chips`, `peek-cards`, `throw-dice`, `yawn`, `stretch`, `get-up-floor`),
  `.setExpression(name, weight)` (`neutral happy sad angry scared hungover disgusted surprised
  smug nervous`), `.lookAt(worldPos|null)`, `.setViseme(name, weight)` (lip sync: `rest A E I O U
  F M L W`), `.setFootIK(raycastFn)`, `.setHandTarget(side, worldPos|null)`, `.attach(boneName,
  object3d)` (`hand.L`, `hand.R`, `head`, `spine`), `.setOutfit(outfit)`, `.setDirtiness(0..1)`,
  `.setBruises({eye, knuckles, ...})`, `.dispose()`.
- Jiggle: spring bones on belly, chest, cheeks, hair, clothes; intensity scales with body fat.

### audio (`src/audio/`)
- `index.js` imports every sfx file (registering names from §5) and exports `music`.

### ui (`src/ui/`)
- States: `boot` (content warning → dice splash → random logo → `menu`), `menu` (3D slot machine),
  `credits`. Overlays: `openSettings(engine, {onClose})` (card-table UI), `showLoading(kind)`.
- `kit.js`: shared UI components (card-table panel, chip buttons, toggles, sliders, tabs) with
  hover/click sounds; all text through `t()`.

### creator (`src/creator/`)
- State `creator`: DMV photo booth; uses `createHuman`; ends with the flash → ID photo
  (`canvas.toDataURL`) stored in `life.character.idPhoto`; then `save.newLife(character)` and
  `engine.go('world', { newLife: true })`.

### player (`src/player/`)
- `Player` class: `new Player(engine, world, human)`, `.update(dt)`, `.fixedUpdate(step)`,
  over-shoulder camera, weighty locomotion, interaction raycasts (owners implement
  `{ kind, onInteract(player), onGrab(player, hit), describe() }`), needs, pockets, phone.
- Save slices it owns: `money`, `needs`, `inventory`, `body`.

### world (`src/world/`)
- `buildReno(engine, physics, {tier})` → `{ group, spawn: {motelRoom, ...}, zones, interactables,
  update(dt) }`. Zones are boxes with `{ id, audioRoom, venue, indoor }`; the world state emits
  `zone:entered/left` and calls `audio.setRoom`.

### casino (`src/casino/`)
- Full contract: `src/casino/CONTRACT.md` (lanes, factory API, floor plan, rules, quality bar).
- Shared: `chips.js` (per-casino chip counts, Nevada colours, buy-in/pay/take/colour-up),
  `station.js` (`Station` base: seats, sit/stand, close-up camera, pointer picking, UI layer),
  `tickets.js` (TITO vouchers as pocket items).
- `buildEldoradoInterior(engine, physics, { tier, scene })` (index.js) → `{ group, zones,
  interactables, stations, update(dt, ctx), dispose() }`; tables via `tables/index.js`, slots via
  `slots/index.js`. Games use `fairRandom()`; real house edge (slots 88–95 % RTP, roulette 00).

## 7. Testing

- Static server: `python3 -m http.server 8765` from the repo root → `http://127.0.0.1:8765/gamble/`.
- `?state=<name>` jumps to a state. Dev pages under `gamble/dev/` for isolated modules.
- Screenshots: `PW=<scratchpad>/deps/node_modules/playwright/index.mjs node gamble/tools/shot.mjs
  <url> <outPrefix> '<steps json>'`. Headless uses SwiftShader (slow, auto-tier `low`), so set
  `SHOT_QUALITY=high` to see real materials/shadows/post. `SHOT_MOBILE=1` emulates an iPhone.
- Look at your screenshots critically against §0 before declaring anything done. Check the console
  output the tool prints — zero errors is the bar.

## 8. Code style

- Modern JS (ES2022), 2-space indent, single quotes, semicolons, `const` by default.
- File header comment explaining the module's role; comments explain *why*, not *what*.
- No global singletons except the core ones listed above. Dispose GPU resources in `exit()`.
- All player-facing text goes through `t()` with English and Spanish strings.
- Deterministic visuals: seed procedural generation (`Rng`) so the world looks the same each load.
