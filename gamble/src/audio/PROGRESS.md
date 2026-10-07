# audio module — progress
## Done
- (starting) dsp.js helpers
## Next
- sfx files in order: casino, ui, steps, doors, home, body, phone, ambience, city, splash; index.js; music/; dev/audio.html
## Decisions
- All sfx rendered offline into Float32Arrays via src/audio/dsp.js (biquad, modal, noise, loopify, normalize), wrapped with synth().
- Music instruments render per-note buffers (cached), scheduler plays them with lookahead on the 'music' bus.
## How to view
- http://127.0.0.1:8765/gamble/dev/audio.html
- [done] dsp.js, sfx/casino.js (incl. coins.*), ui.js, steps.js (4 variants x 10 surfaces), doors.js, home.js, body.js (incl. cloth/pocket/keys/wallet/bag). Node smoke test: scratchpad/audio/test.mjs <files> (stubs ctx; checks peak/NaN/DC).
- [done] phone.js, ambience.js (talker/murmur speech-shaped synthesis, rendered at sr/4 for speed), city.js, splash.js, index.js (playStep, prewarm, soundNames). All §5 names verified by scratchpad/audio/names.mjs.
- Heavy loops cost 0.3-0.8 s to build in node: use prewarm() on loading screens.
- NEXT: music/ (scheduler, instruments, tracks, index), then dev/audio.html + .js
