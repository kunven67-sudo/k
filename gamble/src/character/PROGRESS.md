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

## Session 4 (2026-10-06, converge & finish)
Baseline review (busts view, lineup): heads too narrow/egg, hair ragged shell + spikes, tank-top
strap spikes, glasses lens bloom, flat card mustache/brows, A-pose arms, build 1.3-6 s/human.
- DONE: head widened (cranium rx .115, jaw wider, neck thicker), SDF bounding-sphere early-outs +
  warm-started grid rays (head build faster), tank strap select fixed, curved lens normals +
  temple arms follow skull, dev page `view=busts&i=N` (4 head-and-shoulders portraits).
- NEXT: hair (locks), brows/facial hair painted + volume, lids lower, idle arm pose, perf, walk.
- DONE: head SDF rewritten: skull + **superellipse face loft** (LOFT_KEYS, Catmull-Rom, params
  scale W/F per height) instead of blob primitives (lumpy); lids thicken away from the margin
  (no socket ring gap); lid patch rings now marched inward from outside (fixed folded gray
  flaps); SDF-baked head AO in faceData.w (skin shader); lashes = gapped strands (cover 12);
  brows = 2 layers of short hair cards; hair.js rewritten (flow-aligned UV clumps, rounded locks,
  fixed mohawk, curtain locks hang past the edge); beard shell uses flow UVs + fuzzy edge.
- Tool: scratchpad sculpt.mjs = CPU raymarch of headSDF (front/3-4/profile PNG in ~6 s) — not in
  repo; recreate if needed (raymarch headSDF from node, write PNG with zlib).
- DONE: locomotion cadence from leg reach (no lunges/kneeling), start-off phase alignment,
  emergency step; idle arms hang closer, palms face the thighs (forearm/hand twist).
  schema: overrides now apply while drawing (age override drives grey hair etc.).
  Hat brims are closed felt profiles (no sun glint line).
- Tool: scratchpad/sim (node --import ./reg.mjs walk.mjs|pose.mjs): runs Human in node with
  browser shims + 'three' loader → numeric gait/pose checks without the browser.

## Session 5 (2026-10-06, finish) — state check
Verified by screenshots (lineup + busts): everything A1..A7 exists and runs end-to-end — clothed,
haired, idling/walking humans on the curb, busts view with glasses/hats/moustache. Build 1.8-2.6 s
for the page in headless. Remaining issues seen: one 404 on page load, grey long hair ragged,
heads read slightly small for the chunky style, skin tone a bit flat/pale on light skins.
Status table (truthful): A1 done, A2 done (SDF loft head + lid patches), A3 done (skin.js paint,
eyes.js, mouth in facefeatures.js), A4 done (rig.js, jiggle.js, face bones), A5 done (clothes,
outfit, clothmat, accessories), A6 done (hair.js, facecards.js), A7 done (locomotion/ik/idle/
face/actions), A8 partial (dirt/bruise uniforms exist in skin.js — verify; cache; perf).
NEXT: fix 404, verify A8 + cache + tri/draw-call counts, polish, final screenshots.
- DONE (s5): accessories merged per material (hat parts, glasses frame, lenses) → max 13 draws
  (was 19). HEAD_RES high 72x56 / low 40x32, low-tier teeth 6x2, hair locks 96/22.
  Measured (dev page, 8 people): high 23.5-31k tris, low 8.5-11k tris. Still over budget → next.
  How to measure: scratchpad probe.mjs + stats.js (traverse root, count index/3) — recreate if lost.
- DONE (s5): face offsets x1.9 (FACE_EXAGGERATION in anim/face.js) + jaw 0.42 rad: expressions now
  read (happy/surprised/angry/sad grid checked). Budgets after tuning: high 21-27.5k tris,
  low 8.3-10.5k, ≤13 draws (hat+glasses+bowtie wearers), most 6-11.
- DONE (s5): hair/brow/beard cards re-wound to match authored normals (orientToNormals in human.js) → dark blotches on every lock gone.
- DONE (s5): HEAD_UNIT 0.32→0.285 (heads ~12% bigger, cartoon read; everything scales via hsc).
- DONE (s5): hat clip also removes lock tips in a 1.6x column (no tips through the band); free curtain lock tips overhang 0.3x and taper less (no icicles).
- DONE (s5): idle/walk forearm twist sign flipped (palms now face the thighs, not forward);
  arms held 0.09 rad further out over skirts/dresses. dev page `view=builds` (slim/heavy,
  young/old contrast line-up on the sidewalk).
- DONE (s5): mouth interior flag in meshbuild (lip seam row + skin behind the lip front, bounded so
  the back of the head is never flagged); jaw 0.62 rad/unit → surprised/O visemes open visibly.
  Verified expression grid (happy/surprised/angry/sad) — NOTE for screenshots: run ONE shot.mjs
  at a time; two in parallel starve SwiftShader and evals land on stale frames (looked "broken").
  Never use top-level `const` in shot.mjs evals (redeclaration error on the 2nd eval) — use IIFEs.

## Status (end of session 5)
A1-A7 done and verified in screenshots; A8: dirt/bruise/sweat uniforms + setters exist (D key),
caching (shape geometry by param hash, garments by key), perf tuned (see numbers above).
Known gaps: open-mouth interior shows stretched lower-lip skin + sky slivers at the corners (no
dark mouth bag visible); face paint soft at extreme close-up (512 px face texture); grey long
hair under hats has see-through gaps; walk reads slightly crouched/forward-leaning at 1.3+ m/s.
Final screenshots: scratchpad/character/final_*.png.
