# Portal Gun Workbench

A 3D portal gun, a fan build inspired by Rick and Morty. You can orbit it, fire portals, swap the coloured cores,
explode it into parts, and download it for 3D printing.

- Open `index.html` through a local server (for example `python3 -m http.server` in this folder).
- `models/portal-gun.stl` is in millimetres (27.3 × 20.0 × 5.5 cm assembled). `models/portal-gun.glb` is in metres and includes materials.
- `model.js` builds the geometry. `tools/export-models.mjs` regenerates the files in `models/`.
- Three.js r160 is in `vendor/three` (MIT, see its LICENSE).

Not affiliated with Adult Swim.
