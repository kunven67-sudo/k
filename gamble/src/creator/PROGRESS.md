# creator module — progress log
Owner: src/creator/**, src/states/creator.js, dev/creator.html|js
View: http://127.0.0.1:8765/gamble/dev/creator.html
  ?section=face (open a section) · ?lang=es · ?photo=1 (run photo routine) · ?nosave=1 (stop at card)

## Files
- states/creator.js — CreatorState ('creator'): scene, model, debounced rebuilds (260 ms), drag/pinch/wheel,
  camera framing with setViewOffset (character centred in the free area beside/above the form),
  photo routine (smile → clerk "Don't smile" bubble + TTS → 3-2-1 → flash → capture → license → newLife → world).
- creator/booth.js — DMV corner, statics merged per material (~14 draw calls), clerk arm finger drum,
  flickering troffer, ring-light flash, NOW SERVING LED canvas sign.
- creator/form.js + formstyle.js — clipboard + DMV form (sections from HUMAN_PARAM_SCHEMA via SECTIONS map).
- creator/license.js — fictional "Silver State" license canvas (856x540), dobFor(name, age).
- creator/photo.js — PhotoRig: renders a 300x380 corner of the main canvas with tone mapping, copies to 2D canvas.
- creator/names.js, strings.js (EN/ES).

## Decisions
- No hero rebuild for the photo (ultra geometry stalls phones/headless); photo uses the live human.
- JPEG data URLs encoded via toBlob (async) — toDataURL was stalling seconds in SwiftShader.
- character = { params, name:{first,last}, age, voiceURI, idPhoto, licenseCard } → save.newLife; if no
  'world' state registered → "Reno is still being built" card with license + back button.

## Done
- [x] booth, form, license, photo routine, dev page.
- [x] Screenshots reviewed: booth (bust + full), face/eyes/clothes/voice sections, mobile ES (hair),
      flash, license card, "Reno is still being built" card. Result object verified via eval.
- [x] Flash too hot (blew out face + photo) → ring light pop reduced; photo exposure 1.04.

## Next / known gaps
- states/index.js must register `creator: CreatorState` (core change request; menu already goes to 'creator').
- Clerk is a stylised silhouette behind frosted glass + animated arm, not a full Human.
- Counter/clerk mostly off-frame at default zoom on 16:9; visible on wide/Full view.
- Headless SwiftShader: flash/card frames are slow (seconds); fine on real GPUs.
