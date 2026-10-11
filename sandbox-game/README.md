# Real Life Sandbox

Realistic first-person physics sandbox (v1, chunk 1 preview). See `DESIGN.md` for the full plan.

## Play
Double-click `RealLifeSandbox.html` (Edge/Chrome). Everything is inside that one file.

## Build from source
```
npm install
npm run build      # writes RealLifeSandbox.html
npm run watch      # rebuild on save
```
Drop real textures in `assets/textures/<material>/{albedo,normal,roughness}.jpg` and rebuild; they get inlined automatically.
