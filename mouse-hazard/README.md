# MOUSE HAZARD

Do terrible things to your mouse. 20 effects (force field box, deep freeze, fire, water, black hole, airstrike,
lightning, tornado, earthquake, gravity, oil, honey, lava, blizzard, drunk, glitch, clone army, mirror world,
rubber band, soap bubble). Pick the seconds, click a hazard.

- Windows app (Electron). The mouse is locked/moved with plain Windows cursor calls (no keyboard or mouse hooks).
- A small guard process puts the real cursor back and frees the mouse if the app ever dies.
- Panic key: Ctrl + Shift + F12. Ctrl + Alt + Delete always frees the mouse as well.
- Sounds: CC0 recordings from freesound.org (see assets/sounds/CREDITS.txt). Fonts: Barlow and DSEG (SIL Open Font License).

Build: `node tools/pack.js electron-v44.6.0-win32-x64.zip dist`
Picture test (Linux): `MH_TEST=$PWD/tests/run.js xvfb-run -a -s "-screen 0 1920x1080x24" electron .`
