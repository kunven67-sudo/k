# Physbox — architecture

Read `DESIGN.md` first: it is the player's wish list. This file is how the code is organised.
Every module follows these conventions so independently written parts fit together.

## Hard constraints
- **Browser, no build step.** Plain ES modules loaded by `index.html` through an import map:
  `three` → `./js/vendor/three/build/three.module.js`, `three/addons/` → `./js/vendor/three/addons/`,
  `rapier` → `./js/vendor/rapier/rapier.mjs` (Rapier 0.19.3 compat; WASM is inlined, call `await RAPIER.init()` once).
  three.js is r170 (WebGL2 renderer, `logarithmicDepthBuffer: true`).
- **No network at runtime** except `fetch()` of our own files under `data/` (relative URLs). No CDNs, no `eval`,
  no `new Function`, no workers loaded from other origins (a worker may be made from a Blob URL).
- **Performance first.** The player's PC has an NVIDIA GeForce GT 130 (2009). Target 30+ fps at ~720p on the
  `low` preset, which is the default when the GPU looks weak (see Quality). Every heavy feature needs a cheap
  path and must obey the active quality preset. Never allocate per-frame in hot loops (reuse temp vectors).
- **Plain JavaScript** (no TypeScript), 2-space indent, semicolons, single quotes, `const`/`let`, small classes.
  Comments explain *why*, briefly. No `console.log` spam in shipped code (use `engine.log` for debug).
- **Every `localStorage` access is wrapped in try/catch** (it can throw).

## Units and frames
- SI everywhere: metres, kilograms, seconds, kelvin, joules, pascals. Angles in radians unless named `...Deg`.
- CPU math is double precision: use `THREE.Vector3`/`Quaternion`/`Matrix4` (JS numbers are doubles).
  Only GPU buffers and Rapier are 32-bit, which is why we keep a floating origin.
- **Inertial frame (ICRF-like, equatorial J2000):** X → vernal equinox, Z → celestial north pole, right-handed.
  Origin = the Sun (heliocentric). `engine.sky` gives every body's position/velocity in this frame.
- **Body-fixed frame** of a planet/moon: origin at its centre, Z = its north pole, X = prime meridian (lon 0),
  Y = lon 90°E. `latLonToBody(latDeg, lonDeg, r)` = `r·(cosφcosλ, cosφsinλ, sinφ)`. Planets are spheres.
- **Local tangent frame** at a surface point: Up = radial, East = normalize(Z × Up) (use X at a pole),
  North = Up × East.
- **The physics bubble.** Rapier simulates only a bubble around the player. `engine.frame` (BubbleFrame) defines it:
  - `frame.body` — reference body (Earth at start). `frame.mode` — `'rotating'` (body-fixed; used near the
    surface/in the atmosphere) or `'inertial'` (body-centred, non-rotating axes; used in space).
  - `frame.origin` — `THREE.Vector3` (double) in the reference body's frame. **Rapier coordinates = frame
    coordinates − origin.** We call these *local* coordinates. Everything that touches Rapier uses local coords.
  - Gravity: Rapier's `world.gravity` is set every step to the gravity at the origin (central body + tidal
    terms from Sun/Moon/other planets + centrifugal in rotating mode). A bubble is a few km, so this is exact
    enough. Coriolis is ignored in rotating mode.
  - **Rebase**: when the player is > `frame.rebaseDistance` (1000 m) from the origin, the origin moves to the
    player and every Rapier body is translated by −Δ. Event `'rebase'` `{ delta }` fires (delta in old local coords).
  - **Frame switch**: at the rotating/inertial altitude threshold (Earth: 140 km) and when entering another body's
    sphere of influence, all bodies are transformed to the new frame (positions, rotations, velocities). Event
    `'frameswitch'` `{ from, to }`.
- **Rendering is camera-relative**: the three.js scene axes are the bubble frame axes, and every object is placed
  at `(its local position − camera local position)` each frame, so GPU numbers stay small.

## Time
`engine.time` (SimClock, `js/core/time.js`):
- `t` — celestial time, seconds since J2000 (TT ≈ UTC is fine). Starts at the real current date on a new world.
- `physicsScale` — slow motion (0.05–1); scales the physics step size (smooth slow-mo).
- `frozen` — physics frozen (the "freeze everything" setting). Rendering, UI and the camera still run.
- `warp` — 1 normally; > 1 = on-rails time warp (physics paused, orbits propagated analytically/numerically).
- `celestialRate` — 24 h / `settings.dayLengthHours` while in rotating mode, 1 in space. Cosmetic day length:
  the physics rotating frame always uses the body's real spin for centrifugal/frame-switch maths.
- Physics uses a fixed step `1/60 s × physicsScale`, at most `maxSubsteps` (4) per frame; leftover time is
  carried in an accumulator; render interpolation is not required.

## Engine and modules
`js/core/engine.js` owns everything. Shared services hang off the engine object:

| field | class | file | role |
|---|---|---|---|
| `engine.bus` | EventBus | core/bus.js | `on(type, fn)`, `off`, `emit(type, payload)` |
| `engine.settings` | Settings | core/settings.js | `get(key)`, `set(key, v)`, `onChange(key, fn)`; schema-driven, persisted |
| `engine.quality` | Quality | core/quality.js | current preset values (`engine.quality.get('shadows')`) |
| `engine.time` | SimClock | core/time.js | see Time |
| `engine.data` | DataStore | core/data.js | loaded binary data (Earth topography/moisture) |
| `engine.sky` | SolarSystem | space/solar.js | bodies, ephemeris, rotations |
| `engine.frame` | BubbleFrame | space/frames.js | bubble reference frame + transforms |
| `engine.physics` | Physics | physics/physics.js | Rapier world, stepping, queries, events |
| `engine.materials` | Materials | physics/materials.js | material table |
| `engine.terrain` | TerrainSystem | world/terrain/terrain.js | surfaces, LOD meshes, colliders, craters |
| `engine.world` | World | world/world.js | entities, spawning, parking, undo, saving |
| `engine.catalog` | Catalog | world/catalog.js | spawnable things (`register(def)`, `get(id)`, `search(q)`) |
| `engine.input` | Input | game/input.js | actions + rebindable keys + mouse |
| `engine.player` | Player | game/player.js | the player body, movement, size, health |
| `engine.camera` | CameraRig | game/camera.js | first/third/free camera, owns the THREE camera |
| `engine.renderer` | Renderer | render/renderer.js | WebGL, scene, camera-relative placement, post |
| `engine.tools` | ToolSystem | tools/tools.js | hand slots: grab gun, tool gun, weapons |
| `engine.ui` | UI | ui/ui.js | DOM overlay: HUD, menus, panels, toasts, tips |
| `engine.audio` | Audio | audio/audio.js | WebAudio, real sound propagation |

A **module** is any object registered with `engine.register(mod)`. Optional hooks, called in registration order:
- `init(engine)` — once, may be `async`.
- `prePhysics(dt)` — before each fixed physics step (apply forces here: thrusters, aero, buoyancy).
- `postPhysics(dt)` — after each fixed step (read contacts, break things).
- `update(dt)` — once per rendered frame with real dt (seconds, clamped to 0.1) — AI, effects, UI state.
- `render(dt)` — just before drawing (update meshes, camera-relative placement).
- `serialize()` → JSON-able, `deserialize(obj)` — module state in world saves (key = `mod.name`).
- `onRebase(delta)`, `onFrameSwitch(info)` — optional fast paths (also available as bus events).

Frame order: input → `update` hooks → physics fixed steps (`prePhysics` → `world.step` → events → `postPhysics`)
→ camera → `render` hooks → draw → UI.

## Physics conventions (`js/physics/physics.js`)
- `physics.R` is the RAPIER namespace, `physics.world` the `RAPIER.World`.
- **Collision groups** (`physics.GROUPS`): `TERRAIN=1, STATIC=2, DYNAMIC=4, PLAYER=8, CHARACTER=16, DEBRIS=32,
  RAGDOLL=64, VEHICLE=128, PROJECTILE=256, TRIGGER=512, WATER=1024`. Helper `physics.groups(member, filterMask)`.
- `physics.colliderInfo(collider)` → `{ entity, part }` (every collider we create is registered here).
- `physics.raycast(origin, dir, maxDist, opts)` → `{ entity, part, collider, point, normal, distance } | null`
  (local coords; `opts.exclude` entity or collider, `opts.groups`).
- `physics.overlapSphere(center, radius, cb)`, `physics.castShape(...)`.
- `physics.addForceProvider(fn)` — `fn(dt)` called inside `prePhysics` each step (aero, buoyancy, wind, explosions).
- Impacts: contact-force events are turned into bus events
  `'impact' { a, b, partA, partB, force, impulse, point, normal, relSpeed }` (entities may be null for terrain).
- CCD is enabled for fast/small bodies. A **safety net** runs after every step: any dynamic body whose centre is
  below the terrain surface by more than its size is lifted back above it, so nothing ever falls through the ground
  (player request: "no matter what size, you don't walk through the floor").

## Materials (`js/physics/materials.js`)
`materials.get(name)` → `{ name, density (kg/m³), friction, restitution, strength (J/m² fracture toughness proxy),
hardness (for penetration), flammable, ignition (K), burnRate, melt (K), heatCapacity (J/kg/K), conductivity,
color (hex), roughness, metalness, sound: 'wood'|'metal'|'glass'|'concrete'|'rubber'|'flesh'|'plastic'|'stone'|'ice'|'dirt' }`.
At least: wood, plank, steel, aluminium, iron, copper, gold, glass, concrete, brick, stone, rubber, plastic, cloth,
foam, ice, flesh, bone, dirt, sand, water, carbon_fiber, titanium, ceramic (heat shield), paper.

## Entities (`js/world/entity.js`, `js/world/world.js`)
An **Entity** is anything simulated: props, vehicle parts, NPCs, debris, building pieces.
```
entity.id            unique int
entity.type          catalog id ('prop.crate_wood', 'vehicle.sedan', ...)
entity.kind          'prop' | 'vehicle' | 'npc' | 'animal' | 'ragdoll' | 'debris' | 'building' | 'effect' | 'structure'
entity.body          RAPIER.RigidBody | null
entity.parts[]       { name, collider, mesh, material, health, maxHealth, temp, shape }   (one per primitive)
entity.group         THREE.Group placed camera-relative every frame by the renderer
entity.frozen        bool (grab-gun freeze → kinematic/fixed)
entity.data          free-form JSON state (serialised)
entity.update(dt), entity.onImpact(e), entity.onDamage(d), entity.serialize(), Entity.from(json)
```
**Exact collisions** (player request): props are built from primitives — box, cylinder, cone, sphere, capsule,
convex hull, rounded box — and **each primitive is both the visible mesh and its collider** (same dimensions).
No invisible bounding boxes; you can walk under a table between its legs. Builder:
`buildFromPrimitives(def)` where `def.parts = [{ shape, size|radius|height|points, pos, rot (euler deg), material,
color, name }]` returns meshes + collider descriptors.
`world.spawn(type, opts)` (opts: `position` local, `rotation` quaternion, `velocity`, `params`) → Entity;
`world.remove(entity)`; `world.find(id)`; `world.query(pos, radius)`; `world.undo()`.

**Parking.** Only entities within `quality.activeRadius` (1–3 km) of the player are in Rapier. Farther ones are
*parked*: serialised with their pose in the reference body's frame, shown as static meshes up to the view
distance, and restored when the player returns. Parked things in orbit move on rails.

## Terrain (`js/world/terrain/*`)
- Earth: real topography (`data/earth-topo.bin`: 2160×1081 uint8, row 0 = 90°N, col 0 = 180°W, 10′ cells;
  value ≥128 = land: `h = 9000·((v−128)/127)²` m; <128 = sea: `h = −11000·((128−v)/128)²` m) plus a climate
  moisture layer (`data/earth-moist.bin`, same grid, 0–255; 255 over sea). Both are zlib (deflate) streams —
  decode with `DecompressionStream('deflate')`. Procedural detail (fbm/ridged noise) is added on top, scaled by
  terrain roughness, so mountains reach real heights and the ground is varied up close. Bilinear sampling.
- Sea level = radius 6 371 000 m. Ocean covers everything below 0.
- Biome from temperature (latitude, altitude lapse 6.5 K/km, season) and moisture: ice, tundra, taiga, temperate
  forest, grassland, savanna, desert, tropical forest, rock (steep), beach (near sea level).
- `terrain.heightAt(body, dirUnit)` → metres above the body's radius (exact same function the meshes and
  colliders use). `terrain.surfaceAtLocal(localPos)` → `{ height, normal, biome, material }` for the current body.
- Rendering: cube-sphere quadtree LOD, chunks built in a Blob-URL Web Worker, skirts to hide cracks.
- Colliders: Rapier heightfield tiles (rotated so the tile's Y = local up) in a small grid around the player
  (and around other active bodies that are near the ground), rebuilt as the player moves.
- Craters/flattening are persistent modifications applied inside the height function.

## Rendering (`js/render/*`)
- One `THREE.WebGLRenderer` (`logarithmicDepthBuffer`, ACES filmic tone mapping, sRGB output).
- Each frame: `renderer.camLocal` (double) = camera position in local coords. Every placed object sets
  `group.position = localPos − camLocal`.
- Sky: ray-marched single-scattering atmosphere (Rayleigh + Mie) for sky dome and planet limb; sun disk,
  moon with phase, planets, stars. The same atmosphere parameters tint terrain with aerial perspective.
- Lighting: one directional sun light (+ moonlight at night), hemisphere ambient from sky colour, optional shadow
  map following the camera (quality), emissive for hot/burning things.
- Quality presets (`low`, `medium`, `high`, `ultra`) control resolution scale, shadows, post-processing, terrain
  LOD error, view distance, active radius, particle caps, NPC caps, water sim size, debris caps.

## UI and input
- New key layout (player choice), all rebindable in Settings → Controls. Defaults:
  `WASD` move · `Space` jump/up · `Ctrl` crouch/down · `Shift` sprint/boost · `F` use/enter/exit ·
  `Tab` spawn menu · `X` context menu (properties, wiring) · `Q` quick weapon/tool wheel · `1–9` hotbar ·
  `Z` undo · `N` noclip · `J` jetpack · `P` parachute/wingsuit · `B` superpowers · `V` camera mode ·
  `G` orders to NPCs · `M` globe map/teleport · `O` orbit map · `,` `.` time warp · `T` slow motion ·
  `K` freeze physics · `R` reload / hold to rewind · `H` hide HUD · `Esc` pause · `F1` tips.
  Mouse: LMB primary, RMB secondary, wheel = adjust (tool setting / grab distance), MMB = rotate held object.
- UI is DOM over the canvas, styled from CSS tokens in `index.html` (single dark theme, Physbox look).

## Saving
World saves are JSON compressed with `CompressionStream('deflate')` into IndexedDB (fallback localStorage),
slots + autosave. Contents: `{ version, time, frame, player, entities[], parked[], terrainMods[],
buildings, globals, modules: { [name]: state } }`. Dupes (saved builds) are separate small JSON blobs and
can be exported as share codes (`PHYSBOX1:` + base64 deflate).

## File ownership
Each module lives in its own file(s). When adding a feature, create new files and register them in
`js/main.js`'s module list; avoid editing files owned by other modules except through their public APIs.

## API contracts (exact signatures — code against these)

### core/bus.js (done)
`new EventBus()` · `on(type, fn) → unsubscribe()` · `off(type, fn)` · `emit(type, payload)`.

### core/math.js (done)
`clamp, lerp, smoothstep, invLerp, remap, degToRad, radToDeg, TAU`, `hash32(a,b)`, `mulberry32(seed)`,
noise: `noise2(x,y)`, `noise3(x,y,z)` (simplex, −1..1), `fbm3(x,y,z,oct,lac,gain)`, `ridged3(x,y,z,oct,lac,gain)`,
`latLonToUnit(latDeg, lonDeg, out?)`, `unitToLatLon(v) → {lat, lon}` (degrees), `tangentFrame(up, outEast, outNorth)`.

### core/data.js (done)
`await loadData()` → `{ topo: Uint8Array(2160*1081), moist: Uint8Array(2160*1081), W:2160, H:1081 }`
(also available as `engine.data`).

### core/time.js — SimClock
`t` (s since J2000) · `physicsScale` · `frozen` · `warp` · `celestialRate` · `advance(realDt)` (advances `t` by
`realDt·celestialRate·warp`) · `date()` → JS Date · `setDate(date)` · `dayFraction(lonDeg)` local solar time 0..1.

### space/solar.js — SolarSystem
- `sky.bodies` — array of body records:
  `{ name, parent (name|null), GM (m³/s²), radius (m), mass, soi (m), color [r,g,b], albedo,
     rotationPeriod (s, sidereal; negative = retrograde), poleRA, poleDec (deg), W0 (deg), tidallyLocked,
     atmosphere: null | { height, scaleHeight, surfacePressure (Pa), surfaceDensity (kg/m³), rayleigh [r,g,b] (1/m),
     mie (1/m), mieG, sunIntensity }, surface: 'earth'|'rocky'|'gas'|'star', hasOcean, rings: null|{inner, outer} }`
  for Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune (Phobos/Deimos optional).
- `sky.get(name)` → body record.
- `sky.position(name, t, out)` → heliocentric inertial position (Vector3, m). `sky.velocity(name, t, out)`.
- `sky.rotation(name, t, out)` → Quaternion that maps body-fixed vectors to inertial.
- `sky.angularVelocity(name, out)` → inertial angular velocity vector (rad/s).
- `sky.gravityAt(inertialPos, t, out, excludeName?)` → total gravitational acceleration from all bodies.
- `sky.dominantBody(inertialPos, t)` → name of the body whose SOI contains the point (deepest).
- `sky.sunDirection(bodyName, t, out)` → unit vector from body centre to Sun in inertial frame.

### space/frames.js — BubbleFrame (engine.frame)
- `body` (record), `mode` ('rotating'|'inertial'), `origin` (Vector3, double, in reference frame),
  `rebaseDistance` (1000).
- `localToRef(local, out)` / `refToLocal(ref, out)` — local (Rapier) ↔ reference frame (body-fixed or body-inertial).
- `localToInertial(local, out)` (heliocentric inertial), `inertialToLocal(p, out)`.
- `dirLocalToInertial(v, out)` / `dirInertialToLocal(v, out)` — directions (rotations only).
- `refQuaternion(out)` — rotation from reference-frame axes to inertial axes at current time.
- `upAt(local, out)` — unit radial direction. `altitudeAt(local)` — metres above the body's radius (sea level).
- `gravityAt(local, out)` — gravity used for that point (incl. centrifugal in rotating mode).
- `velocityToInertial(local, vLocal, out)` — adds body motion and ω×r as needed.
- `latLonOf(local)` → `{ lat, lon }`. `localFromLatLon(latDeg, lonDeg, altitude, out)`.
- `update()` — per frame (called by Physics before stepping): handles rebase + frame switching, sets gravity.

### physics/physics.js — Physics
see "Physics conventions". Also: `physics.ready` promise, `physics.step(dt)` (called by the engine),
`physics.createBody(desc)` where desc = `{ type: 'dynamic'|'fixed'|'kinematic', position, rotation, linvel, angvel,
ccd, canSleep, linearDamping, angularDamping, gravityScale }`, `physics.createCollider(shapeDesc, body, info)`
where shapeDesc = `{ shape: 'box'|'sphere'|'capsule'|'cylinder'|'cone'|'hull'|'trimesh'|'heightfield'|'roundBox',
size: [x,y,z] (full extents) | radius | halfHeight | points (Float32Array) | indices, density, friction, restitution,
groups, sensor, offset: [x,y,z], rotation: Quaternion, activeEvents }` and `info = { entity, part }`.
`physics.removeBody(body)` (also removes its colliders/joints and unregisters them).
`physics.joint(kind, bodyA, bodyB, params)` kinds: 'fixed', 'ball', 'hinge', 'slider', 'rope', 'spring'
→ RAPIER joint (with `params.breakForce` honoured by Physics: joints whose reaction impulse exceeds it are removed and
bus emits `'jointbreak' { joint, a, b }`).

### world/terrain/earth.js & planets.js — height functions
`createEarthSurface(data)` / `createProceduralSurface(bodyRecord, seed)` →
`{ heightAt(x, y, z) /* unit dir, body-fixed */ → metres, sample(x, y, z, out) → out{ height, biome, moisture, temp,
roughness }, seaLevel: 0, hasOcean, radius }`. Deterministic, fast (≥ 200k samples/s), no allocations per call.
Biome ids (`BIOMES` export): 0 ocean, 1 beach, 2 desert, 3 grassland, 4 savanna, 5 temperate forest,
6 tropical forest, 7 taiga, 8 tundra, 9 ice, 10 rock, 11 regolith (Moon/Mercury), 12 mars dust, 13 venus basalt.

### core/settings.js — Settings
`settings.get(key)`, `settings.set(key, value)`, `settings.onChange(key, fn)`, `settings.schema` (array of
`{ key, label, group, type: 'bool'|'range'|'select'|'key', default, min, max, step, options }`), persisted under
`physbox-settings`. Keys include: quality, renderScale, fov, mouseSens, invertY, volume, musicVolume, music,
soundMode ('real'|'always'), dayLengthHours, gravityScale, physicsScale, frozen, infiniteFuel, infiniteAmmo,
infiniteOxygen, gore ('off'|'light'|'full'), injuries, npcCap, showFps, tips, plus `keys.<action>` bindings.

### core/quality.js — Quality
`quality.preset` ('low'|'medium'|'high'|'ultra'), `quality.get(name)`; values: renderScale, shadows (0/1/2),
shadowMapSize, bloom, ssao(false), terrainError (px), viewDistance (m), activeRadius (m), maxDebris, maxParticles,
maxNPCs, maxAnimals, waterGrid, cloudQuality, vegetationDensity. `quality.autoDetect(renderer)`;
FPS watchdog lowers the preset if fps < 24 for 10 s.

### game/input.js — Input
`input.down(action)`, `input.pressed(action)` (edge, this frame), `input.released(action)`, `input.mouseDX/DY`,
`input.wheel`, `input.lock()` (pointer lock), `input.locked`, `input.enabled` (false when a menu has focus),
`input.endFrame()`. Actions: moveF, moveB, moveL, moveR, jump, crouch, sprint, use, spawnMenu, context,
quickWheel, hot1..hot9, undo, noclip, jetpack, parachute, powers, camera, orders, map, orbitMap, warpDown, warpUp,
slowmo, freeze, reload, hud, pause, tips, primary, secondary, rotate (MMB).

### render/renderer.js — Renderer
`renderer.scene`, `renderer.three` (WebGLRenderer), `renderer.camLocal` (Vector3), `renderer.add(obj3d, localPosFn?)`
`renderer.place(group, local)` (sets camera-relative position), `renderer.sunDirLocal` (unit Vector3),
`renderer.sunColor`, `renderer.skyAmbient`, `renderer.addPostPass(pass)`, `renderer.screenshot()`.
Standard materials should be `MeshStandardMaterial` so lighting is consistent; use `renderer.envMap` for reflections.
