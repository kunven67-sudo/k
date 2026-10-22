# HANDS OFF

An idle game where the only rule is: **do nothing.** Literally nothing.

Your money grows on its own, faster and faster, upgrades buy themselves, and reality slowly
breaks around you. Touch the mouse, a key, the screen or a controller and everything resets to zero.

**Play:** open `dist/hands-off.html` in Chrome or Edge (one file, works offline except the fonts).

- Leaving is safe: press **X** (or tap the tiny X on a phone), close the tab, or walk away.
  The run keeps counting while it's closed.
- Every x1000 is a milestone (the money gets a new name), every 20 levels is a new world.
- Settings: graphics (Low / Auto / High / Max / Insane), music + sound volume, big flashes on/off.
  PCs start on Max, phones on Auto. Max lowers the resolution (never the effects) if frames get slow;
  Insane never does.

## The real renderer (WebGL2)

Every world is a real place in space, rendered live:

| world | what you see |
| --- | --- |
| EVENT HORIZON | a black hole whose light is bent for real (photon paths traced through Schwarzschild space), a hot disk with true blackbody colors, Doppler beaming and gravitational redshift |
| PILLARS | a lone black hole with no disk, lensing the Pillars of Creation behind it |
| RINGED GIANT | a gas giant with real ring structure (C/B/A rings, Cassini division, Encke gap), ring shadows, a thin atmosphere, the sun |
| PULSAR | a spinning neutron star with lighthouse beams, a wind torus, polar jets and dipole field lines, inside the Crab Nebula |
| QUASAR | a supermassive black hole with a blinding disk and relativistic jets (the one coming at you is brighter) |
| COLLISION | two black holes orbiting each other in front of two colliding galaxies |

After the sixth world they come back, deeper and more broken. Stars are drawn per pixel with real star
colors (temperature -> CIE 1931 -> sRGB). Each place's sky (nebulas, Milky Way, galaxies) is built
once into a cube map, a strip at a time.

In front of the place: the number is 3D chrome on rolling drums (a signed-distance atlas made from the
font at load time), a drop of liquid mercury, a glass cube with real refraction and dispersion. They all
reflect a live probe of the bent light. Then HDR bloom, a horizontal lens streak, ACES tone mapping,
and the old glitch layer on top.

Touching anything breaks the screen for real: the frozen frame becomes thick 3D glass shards, time
slows down while the camera drifts through them, they fall and smash on a mirror floor, then the whole
thing plays backwards (VHS rewind) into the new run.

Devices without WebGL2 (or without float render targets) get the original WebGL1 renderer.

## Code

| file | what it does |
| --- | --- |
| `src/core.js` | endless numbers (stored as log10), economy, upgrades, saves, trophies |
| `src/gfx2-shaders.js` | the real renderer's GPU programs: skies, light bending, planet, pulsar, objects, bloom, post |
| `src/gfx2.js` | the real renderer: places, camera, cube maps, probe, number drums, mercury, glass, dust, shatter physics |
| `src/gfx.js` | the original WebGL1 renderer (fallback) |
| `src/glyphs.js` | every icon, drawn in code (money, upgrades, trophies, cursor) |
| `src/audio.js` | music made live (hum -> phonk -> breakcore), drops, braams, tape stop, plus recorded glass sounds |
| `assets/sfx/` | recorded glass sounds (CC0, see `assets/sfx/CREDITS.md`), baked into the HTML by the build |
| `src/main.js` | states, the hands-off guard, HUD, reset sequence, temptations, events, menus, tab lock |
| `src/style.css`, `src/body.html` | menus |

`python3 build.py` glues it into `dist/hands-off.html`.

Tests: `node test-core.js` (numbers/economy/saves), `OLD=1 node test-game.js` (headless Chromium: real
clicks, keys, touch, two tabs, offline, freezes), `node test-real.js` (the real renderer: boot, milestone,
3D shatter reset, phone, world dive), `node test-fallback.js` (no WebGL2 / no float targets),
`node sim.js` (pacing table).
