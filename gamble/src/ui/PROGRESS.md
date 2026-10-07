# ui module — progress log

## Plan (files)
- strings.js      i18n 'ui' namespace (EN/ES) for boot/menu/settings/credits
- tips.js         loading tips (30+ EN/ES) + Truckee Times headlines
- sfx.js          uiSound(name) — plays the contract name if audio module defines it, else a
                  built-in procedural fallback (so UI is never silent / never warns)
- styles.js       injected CSS (card-table kit, boot screens, overlays)
- kit.js          DOM components: panel, chip tabs, toggles, sliders, segmented, buttons, focus nav
- settings.js     openSettings(engine,{onClose})
- loading.js      showLoading({kind}) newspaper / tip / free slot
- three/*.js      3D helpers: casino env map, bokeh, reel, text→shape tracer, bulbs
- boot/*.js       warning, dice splash, 4 logos
- states: src/states/boot.js, menu.js, credits.js
- PWA: assets/icons/*, manifest.webmanifest, sw.js
- dev/ui.html + dev/ui.js (?screen=boot|menu|settings|credits|loading|icons, ?logo=)

## Status
- [x] strings.js (EN/ES full), tips.js (30+ tips + headlines), sfx.js (uiSound + fallbacks + getMusic), styles.js (card-table CSS)
- [x] kit.js [x] settings.js (screenshotted desktop+mobile) [x] loading.js (3 kinds, screenshotted)
- [x] boot state + content warning + dice splash (Rapier seed search, relabel fallback) + 4 logos (neon, gold, cards, reels)
- [x] menu: src/ui/menu/{room,machine,deck,coins}.js + states/menu.js (screenshotted idle + lever spin)
- [x] credits state
- [x] PWA: icons.js → assets/icons/*.png (captured via dev page window.__icons()), manifest.webmanifest, sw.js
      (registered in boot.js; skipped on localhost unless ?sw=1 so dev never serves stale code)
- [x] dev/ui.html + dev/ui.js
- [x] full-flow test boot→menu→settings→credits (desktop), mobile (iPhone 13) shots of every screen + all 4 logos
- Screenshots: scratchpad/ui/*.png (desktop), scratchpad/ui/m/*.png (mobile)

## Known gaps / next
- states/index.js + index.html are core files: boot/menu/credits must be registered there (FIRST_STATE='boot'),
  and index.html needs <link rel=manifest>, apple-touch-icon, theme-color (requested as core changes).
- Frame-rate was only measured in headless SwiftShader (~1-2 fps, useless); real-device perf unverified.
- Gold logo letters are locked to vertical motion + in-plane wobble (free bodies knocked each other over).
- On portrait phones the gold/reels/cards logos are small (wide words on a narrow screen).
- Menu button-cap labels are small on phones; the center reel shows the selected option in large type.
- Music/sfx rely on src/audio (absent so far): sfx.js fallbacks cover UI names; music is skipped silently.

## Decisions
- engine.go() clears uiRoot; overlays append to engine.uiRoot.
- Sounds via uiSound(name) (fallback synth when audio module lacks name).


## How to view
http://127.0.0.1:8765/gamble/dev/ui.html?screen=boot (&logo=neon|gold|cards|reels)
  ?screen=menu | settings | credits | loading&kind=newspaper|tip|slot | logo&logo=… | icons&size=512

## Dev tips
- Headless SwiftShader renders ~1-2 fps: sequencing uses stage time (stage.wait), and dev/ui.js exposes
  window.ff(sec) to fast-forward the active stage before a shot: steps [{"eval":"ff(3)"},{"wait":1500},{"shot":"x"}]
- dev/ui.html?screen=logo&logo=neon|gold|cards|reels (&loop=1)
