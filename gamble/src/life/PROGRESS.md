# life module — progress log

Owner of: src/life/**, dev/life.html, dev/life.js

## Plan (files)
- strings.js   EN/ES text (namespace 'life')
- state.js     save slices (money, needs, inventory, phone), money helpers
- needs.js     needs decay + body cues (no HUD), collapse/death stub
- stink.js     stink-line particles (one shared material, instanced)
- rent.js      clerk dialogue (speech bubble + choices), rent clock, 11 AM complaint
- phone/*.js   DOM phone (cracked budget Android): lock, apps
- pockets.js   pockets view
- index.js     initLife({engine, world, player}) -> {update, dispose}

## Status
- [x] all files written; dev page + screenshots (lock, apps, pockets, rent, stink, ES, mobile)

## Decisions
- Player has no setControlsEnabled; we use player.locked + controller.speedCap (defensive).

## Log
- [x] strings.js, state.js (slices), sounds.js, needs.js, stink.js, dialogue.js, rent.js written
- [ ] phone/, pockets.js, index.js, dev page
- [x] phone/ (phone.js, apps.js, map.js, art.js, style.js, license.js, calltones.js), items.js, pockets.js, index.js written
- [x] dev page dev/life.html + screenshots reviewed; fixes: alarm row layout, map zoom, dialogue choices absolute + clamped, pockets fan fits phones
- [x] in-world check via dev/world.html: initLife loads, phone + Maps GPS work at the motel (game time 7:18 PM)
- [x] settings app hides the phone while the sheet is open; map labels sit on the visible part of each road

## API
initLife({engine, world, player, state}) -> { update(dt), dispose(), needs, rent, phone, pockets, stink, addCash }
Bus out: money:changed {cash,delta,reason}, needs:changed {needs}, rent:paid, rent:overdue {room,daysLate,line},
  phone:open/close/dead/alarm, pockets:open/close, life:collapse, life:accident {position}, life:dying {cause}
Bus in: talk:clerk {clerk, player, handled}, needs:add {hunger:+30...}, phone:charge {amount}, sleep:start/end,
  life:catchup, clock:hour/minute
Slices: money, needs, inventory, rent, phone.

## How to view
http://127.0.0.1:8765/gamble/dev/life.html?open=phone&app=maps   (apps: clock messages wallet maps camera)
http://127.0.0.1:8765/gamble/dev/life.html?open=pockets&inspect=wallet
http://127.0.0.1:8765/gamble/dev/life.html?open=rent&hygiene=4&lang=es
Keys: P phone, I pockets, E talk to clerk, WASD. Console: __life

## Known gaps / next
- No 3D phone prop in the hand (the 'phone' hold pose has an empty hand); DOM phone carries the look.
- Pockets is a stylised overlay (items drawn in canvas, fanned like they're in your hands) and not a
  3D hand close-up. Touch has no pockets button (input.js has no 'pockets' touch button yet).
- Shiver has sound only (no body tremor); sweat uses human.setSweat. Temperature reads world.weather.tempC if present.
- The rent knock needs world.motel.roomDoorPosition(room) or state.doorPos for a spatial knock.
- Unknown-number call ends with the SIT tones + speechSynthesis line (owner's prank voice line comes later).
