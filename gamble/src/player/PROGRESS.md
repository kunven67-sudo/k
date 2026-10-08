# Player / world state — progress log

Owner of: src/player/**, src/states/world.js, src/world/compose.js, dev/world.html + dev/world.js
(+ two small fixes in src/world/reno/ground.js: motel parcel collider cut-out, 4th St driveway curb cut)

## Status
- [x] reno ground fixes (code)
- [x] compose.js (sky + reno + motel)
- [x] player controller + camera (code)
- [x] world state + dev page (code)
- [x] interaction (drag doors, toggles, props) (code)
- [x] opening (DESIGN §34), clerk NPC, sleep (code)
- [x] boot test: room spawn renders, OTS cam OK in tight room (t1)
- [x] opening test (op-sheet: floor blur, bang flinch, rise, up) — fixed camera-in-head during rise
- [x] walk + door drag verified (__sim helper; drag → door value 1.43, hand reaches the door edge)
- [ ] lot, street dusk, clerk shots; perf; mobile
- [ ] screenshots

## Decisions
- Motel integration follows dev/motel.js: motel.update(dt, clock, {camera, viewer, sky, scene, indoorLighting:true, citySigns:true}).

## How to view
http://127.0.0.1:8765/gamble/dev/world.html?newLife=1          (opening)
http://127.0.0.1:8765/gamble/dev/world.html?spawn=street&hour=19.3
Console: __world.player, __world.world

## Testing notes
- Headless frames are slow and engine dt is capped, so use dev/world.js `__sim(sec,{keys,look,drag})` to step
  deterministically. Wait for ready with an eval Promise polling `__world.ready` (load 40-90 s).
- Screenshot script with 300 s screenshot timeout: scratchpad/world/shot.mjs, wrapper scratchpad/world/ws.sh name 'query' 'steps'.
