# character module — progress log

Owner of: `src/character/**`, `dev/character*.html|js`.
View: http://127.0.0.1:8765/gamble/dev/character.html (main), dev/character-shape.html (raw sculpt).

## Architecture decisions (attempt 2)

- Attempt 1 polygonized every human from scratch: 3.1 s / 33k tris per body, 0.8 s per head
  (headless). Far over budget (<150 ms, ~25k tris). **Replaced by templates**:
  1. A *template* sculpt (SDF of an average person) is polygonized once per tier on a fine grid
     (surface nets) and decimated with QEM (`decimate.js`) to an adaptive, budgeted mesh. Skin
     weights / regions / head UVs are computed once on the template.
  2. Each human = template retargeted to their rig (linear-blend from template bind pose to the
     human's bind pose) and then *projected* onto that human's own SDF (a few Newton steps along
     the field gradient). Normals come from the analytic field gradient → perfectly smooth.
  3. Topology is shared, so garments (clipped offset shells of body regions), hair roots, face
     UVs and texture layouts are defined once per template.
- Head: separate template (surface nets at ~2.5 mm, decimated with feature importance). Eye
  sockets are holes filled by eyeballs + **lid shells** (rotating spherical caps, weighted to lid
  bones) — robust blinking/tracking with no fragile eyelid topology. Mouth = slit + mouth bag in
  the SDF; jaw bone opens it; teeth/tongue meshes inside.
- Face animation = **face bones** (jaw, lips, corners, cheeks, brows, lids, nose, tongue) with
  gaussian-falloff weights, not morph targets (morph textures per unique NPC are too heavy).
- Textures: no garment UVs. Fabric/skin detail is sampled **triplanar in bind space** (attribute
  `position` before skinning) so it sticks to the deforming body. Head gets fixed UVs from the
  template (direction-space equirect with the face magnified) for the per-human face paint.
- Draw calls per human: skin(body+head+hands+ears) · eyes · mouth · face-cards(lashes/brows/beard)
  · hair · clothes · accessories(+lenses) ≈ 8.

## Status

- [ ] M1 sdf culling speedup, QEM decimator, body template, retarget+project, clay review
- [ ] M2 head template, eyes, lid shells, mouth interior, ears
- [ ] M3 skin / eye / teeth materials, face paint, detail maps
- [ ] M4 rig: face/jiggle bones, skinning, deformation test
- [ ] M5 locomotion (foot planting, foot IK), idle, look-at, face animation
- [ ] M6 clothes (all garments, uniforms, torn/stained), shoes, hats, glasses
- [ ] M7 hair (strands high / cards low, guide springs), facial hair, brows, lashes
- [ ] M8 one-shot actions (all 26), sit/stand, hand poses
- [ ] M9 dirt / bruises / sweat / dirtiness, perf pass, caching
- [ ] M10 dev page polish + screenshots

## Next
Start M1.
