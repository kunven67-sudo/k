# character module — progress log

Owner of: `src/character/**`, `dev/character*.html|js`.
View: http://127.0.0.1:8765/gamble/dev/character.html

## Attempt 3 (2026-10-06) — geometry pipeline replaced

Attempt 2 (SDF surface-nets template + QEM + projection) produced blobby clay figures (screenshot
review: hanger shoulders, egg head, no neck, 10 s template build). Replaced by a classic
"box-modeling in code" pipeline that artists would recognise:

1. **Body = Catmull-Clark subdivision cage** (`subdiv.js`, `bodycage.js`). The cage is built from
   rings around the skeleton: torso 16 verts/ring (half-step angles so the midline is an edge),
   arms 10/ring extruded from a 3x2 shoulder hole, legs 8/ring sharing a crotch strip quad, hands
   flattened 10-rings whose end cap (4 quads) extrudes 4 fingers + a side face extrudes the thumb,
   feet as a bent tube. Cage verts carry dense bone weights + region ids; weights/regions are
   subdivided with the same stencils. The cage is solved so its **limit surface interpolates** the
   designed surface points (few iterations of C += S - limit(C)). Level 1 + push-to-limit (high),
   level 2 (ultra/hero), level 1 coarse (low).
2. **Head = radial projection of an art-directed SDF** (`headgen.js`): a warped direction grid
   (dense on the face) shot from a point inside the head onto a smooth-union SDF sculpt (cranium,
   jaw, cheeks, brow, nose, lips, eye sockets + lid bands, neck). Eyeballs are part of the SDF so
   the skin meets them exactly; verts that land on the eyeball are pulled behind it (depth buffer
   draws a perfect lid line). Mouth = one grid row split between head/jaw (cut), deep groove.
   Grid (u,v) doubles as face-paint UV. Neck bottom ring matches the body neck top ring.
3. Garments = offset shells of body cage regions (so skinning matches), body faces under opaque
   garments are dropped (no poke-through, fewer tris).

Kept from attempt 2: `schema.js` (params, i18n), rig bone convention (`rig.js`), shaderlib/skin
material ideas, eyes.js eye atlas, anim/* skeleton (to be finished).

## Status
- [ ] A1 subdiv.js + bodycage.js + clay screenshot of nude body lineup
- [ ] A2 headgen.js (SDF sculpt, grid, eyes, mouth cut) + face close-up
- [ ] A3 materials: skin (paint in head UV), eyes, mouth/teeth
- [ ] A4 rig wiring, skinning, face bones, jiggle; deformation test
- [ ] A5 clothes (tops/bottoms/shoes/outer/uniforms), hats, glasses
- [ ] A6 hair + facial hair + brows/lashes
- [ ] A7 locomotion/idle/look/face anim, foot IK, one-shots, sit/stand
- [ ] A8 dirt/bruises/sweat, caching, perf, dev page polish, screenshots

## Next
A1.
