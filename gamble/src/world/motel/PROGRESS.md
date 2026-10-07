# Motel module — progress log

## Status: feature-complete first pass (all pieces build, screenshots reviewed)

## Files (src/world/motel/)
- `index.js` buildStarlite() entry: ctx, pieces, batch build, decals, NightLights, zones, spawns, setRoomNumber, update (indoor light dimming opt-in), interior proximity culling.
- `layout.js` coordinate contract + door slots + RI (room interior frame).  `strings.js` en/es.
- `mats.js` palette, breeze block, stall paint, number-plate atlas, plaqueMat.  `kinds.js` lot-asphalt, pool-plaster.
- `lot.js` asphalt/deck/aprons, stalls, wheel stops, 3 beaters, dumpster, cart, lot light, weeds, decal regions.
- `wings.js` L building, custom doors (doors.js), walkway/railing/posts, breeze screens, 17-riser stair (x 213..217.5), plates, AC units + drips, porch lights, ice/soda nook.
- `office.js` shell + interior (desk, bulletproof glass, tray, bell, mints, NO REFUNDS, brochures, TV, key board, fluorescent flicker, hinged glass door, payphone).
- `sign.js` pole sign (R/T burnt channel, stars, starburst bulbs, VACANCY with dead NO).  `pool.js` empty pool, ladder, leaves, graffiti, lawn chairs, fence + ajar gate.
- `room.js` shell/door/window/curtains/lights/spill/shadow proxies; `room-furniture.js`; `room-bath.js` (Reflector mirror); `room-clutter.js` (Rapier dynamic props).
- `interact.js` movable()/switcher() descriptors.  `tv.js` procedural TV channels.  `doors.js` door/jamb part kit.

## Decisions
- Rooms per floor: back wing 8 + east wing 6 → 1-14 ground, 17-30 upper; player slot default #6; setRoomNumber swaps, 9/13 → 10/14.
- Lot surface y = 0.15 (curb level). Stair moved 1 m west of spec (x 213..217.5) so its top lands on the east walkway.
- Light units candela; indoors the sky's sun/hemi/env are dimmed (opt-in `indoorLighting`) to stop shadow-map leaks; the room fakes its sunbeam.

## How to view
http://127.0.0.1:8765/gamble/dev/motel.html?cam=wake&hour=11  (cams: wake room bath lot sign office overview door; walk=1 fp=1 room=23)
Collision test: __motel.simWalk(yaw, seconds). Screenshot helper: scratchpad/motel/shot.sh.
