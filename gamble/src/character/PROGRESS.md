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
- [x] A1 subdiv.js + bodycage.js + bodymesh.js; clay lineup OK (dev/character-shape.html).
      Lessons: orientFaces() needed (BFS winding), crotch ring = thigh tops (figure-8), ring
      angles of first limb rings blend from root-loop angles (else twisted tubes), soft cage fit.
- [~] A2 head: headsdf.js (layout+SDF) + headmesh.js (grid, magnifier warp for eyes/nose/mouth,
      mouth split row, seam matching body ring R[9] which is tilted: front lower).
      Integrated lid shell in the grid looked bad (coarse, creases) -> doing per-eye LID PATCH
      meshes (rings around the almond, rays from eye centre) overlapping the grid; grid tris
      under the patch dropped; both use SDF normals so the overlap is invisible.
- [ ] A3 materials: skin (paint in head UV), eyes, mouth/teeth
- [ ] A4 rig wiring, skinning, face bones, jiggle; deformation test
- [ ] A5 clothes (tops/bottoms/shoes/outer/uniforms), hats, glasses
- [ ] A6 hair + facial hair + brows/lashes
- [ ] A7 locomotion/idle/look/face anim, foot IK, one-shots, sit/stand
- [ ] A8 dirt/bruises/sweat, caching, perf, dev page polish, screenshots

## Next
A1.

### Session log (attempt 3, cont.)
- Assembled Human works end-to-end (rig.js now uses headsdf layout; meshbuild.js merges body +
  head grid + lid patches + ears into one skin geometry; facefeatures.js: eyes/mouth/ears;
  skin.js face paint now maps via `mapper.uvOf(x,y[,z])`; eyes.js material simplified).
- dev/character.html shows animated (idle) naked humans. Perf: geometry ~0.5-0.9 s/human in
  headless (needs optimisation: fewer castRay steps, cache SDF), paint 0.3-0.5 s.
- DONE since: clothes.js + clothmat.js + outfit.js (garments from cage, prints, uniforms, shoes),
  hair.js (SDF hair volume grid + clumps, spring bones hair.B/L/R/T), anim/actions.js (all 24
  one-shots + seated/phone holds), dev/character.js rewritten (lineup on a curb, face view, keys).
- OLD NEXT (done): clothes.js (garments from cage tags: tag = part<<16|ring<<8|col; arm tube i: 0 root->
  deltoid ... 7 wrist; leg tube i: 0 crotch->thigh ... 8 ankle; foot 0..3 + cap 9; torso r 0..8),
  cloth material (triplanar weave, sheen), shoes from foot cage, then hair.js, brows/lashes.
- NEXT: face cards (brows, lashes, beard/mustache), accessories (hats, glasses, bowtie, belt),
  perf (head grid castRay cost), visual polish (hair shading, face sculpt, cloth folds).
- Hair fixes: coverage is a linear field from the SCALP point under each hair point (smooth
  edges), shell thins to 0 at the hairline, noise scales with thickness, afro mass cut by a
  plane behind the hairline (hollow-shell bug), skin weights must be normalised over the 4 kept.
- facecards.js: brows/lashes/beard merged into the hair mesh (aTint, cover>=9.5 = card mode).
- NEXT: accessories.js (hats w/ hair clip, glasses, bowtie, hearing aid, belt garment), perf,
  animation screenshots, face sculpt polish, low tier check.
