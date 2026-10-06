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
- [ ] everything (started fresh 2026-10-06)

## How to view
http://127.0.0.1:8765/gamble/dev/ui.html?screen=boot
