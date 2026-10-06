# Reno downtown slice + sky — progress log

Owner of: src/gfx/sky.js, src/gfx/decals.js, src/world/reno/**, src/world/shared/**, dev/city.html + dev/city.js

View: http://127.0.0.1:8765/gamble/dev/city.html?hour=21&cam=arch  (params: hour, min, date, cam, rain, run, walk, panel)
Cam presets: virginia, arch, strip, eldo, walk, overview (keys 1-6). F = walk mode, [ ] hour, ; ' day, R rain.

## Status
- [x] sky.js — atmosphere LUT, sun/moon/stars, mountains, clouds, lights, fog, PMREM (attempt 1)
- [x] shared/batch.js (StaticBatch + Colliders), shared/kinds.js (extra materials), shared/facade.js (interior-mapped windows)
- [x] reno/layout.js (coordinate contract), reno/ground.js (streets, curbs, corners, markings, trench, drains)
- [x] verify all of the above renders (attempt 2) — dev page guard added (engine ticks update during async enter)
- [x] gfx/decals.js — canvas atlas (32 cells), instanced DecalLayer per target, projectDecal, scatterDecals
- [x] shared/text3d.js (canvas→marching squares→ExtrudeGeometry letters), shared/signs.js (painted/lit signs, neon, BulbSet, LED screen)
- [x] shared/props.js (lamps, cobra lights, signal masts w/ cycling SIGNAL uniforms, blades, hydrant, newsboxes, meter, cans, bench, bus shelter, power poles + wires, chain fence, cabinet, bollard, planter, litter)
- [x] shared/vehicles.js (parked cars: sedan/coupe/wagon/pickup/van), shared/flora.js (trees w/ seasonal cards, weeds)
- [x] shared/buildings.js (facade with recessed openings, storefronts, awnings, sign panels, roofs, HVAC)
- [x] (attempt 3, code written; verified rendering in attempt 4) strip.js (4th St strip), downtown.js (east side Virginia),
      eldorado.js (shell + tower), legacy.js (Silver Legacy + dome, Circus Circus, skyways), arch.js, streets.js (props),
      filler.js (skyline), shared/nightlights.js (pooled lights), shared/wet.js (wet streets + rain), index.js zones/spawn/interactables/NeonBuzz
- [x] attempt 4: page boots (ready ~60 s, ~6 s/frame headless high). Noon Virginia + 9 PM arch shots look good overall.
- [x] attempt 4 fixes: night ground washed white = additive light pools mixing toward fog colour + far too bright
      (ADDITIVE_FOG fade-to-black, k lowered, pools fade near viewer where real PointLights take over);
      street blades mirrored (setBoxFaceUV no longer flips the back face); oil decals were mirror-glossy (now satin);
      arch letter emissive toned down (was blooming to pale pink).
- [x] rain fixed (Rain shader: `position` was vec4 → invalid program; corner moved to aCorner attribute)
- [x] golden hour: sky.js key light amber grade below 16 deg + hemi fill boost at low sun; parking lots bleached
- [x] dev page: preset 7 'sunset' (4th St looking west into the low sun)
- [ ] remaining shots: strip golden hour, eldo night, walk mode, rain, 3 AM; final report

## Key decisions
- Arch at z=106 (layout ARCH_Z), Commercial Row centre z=114 (hw 6). Close to the brief's ≈108/≈112 and keeps
  the arch legs on the north corner sidewalks.
- Static geometry → StaticBatch merged per (64 m chunk, material), culled by tier.drawDistance.

## Notes / perf
- Screenshot helper: scratchpad/cshot.sh name 'query' [waitMs] (uses shot2.mjs with 240 s screenshot timeout).
- SwiftShader headless: ~2.7-6 s/frame at tier high, page ready after ~30 s. Use waits >= 35 s before first shot.
- Avoid mat('glass') (transmission pass). Use propMats().glass / darkGlass.
- Material variants bake textures on the CPU: prefer one base material + batch `tint` over new mat() colors.
