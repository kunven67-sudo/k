# audio module — progress

## Status: done (sfx + music + dev board). All 148 sounds pass (peak ≤ -1 dBFS, no NaN, |DC| < 0.01).

## API
```js
import { music, playStep, prewarm, soundNames, SURFACES } from './audio/index.js';
playStep('tile', { position, gain });       // step.<surface>.1..4, never same twice, ±8% rate
prewarm(['amb.casino', 'amb.city']);        // build sfx buffers in idle slices (loading screens)
music.play('menu-lounge', { fade: 2, gain: 1, radio });  // crossfade; radio defaults per track
music.stop({ fade: 2 }); music.setMuffle(0..1); music.setRadioFX(0..1); music.current; music.section
music.prewarm(ids?, bars?)                  // pre-render note buffers in idle time (play() does its own)
music.render(id, seconds, { sampleRate, muffle, radio, solo:[inst] }) → Promise<AudioBuffer>
```
Tracks: `menu-lounge` (80 BPM ballad, F), `casino-floor` (132 BPM swing, Bb, rhythm-changes bridge),
`motel-radio` (104 BPM country oldie, G, radio FX on), `creator-dmv` (70 BPM sad muzak, C, tape wobble).

## Files
- dsp.js — offline DSP (biquad, modal, KS helpers, loopify, normalize, verb, oneShot/loopShot + catalog)
- sfx/: casino, ui, steps, doors, home, bath (toilet.flush, water.run, fan.hum), body, phone, ambience, city, splash
- music/instruments.js — FM rhodes, KS bass/guitar, modal vibes, harmon trumpet, steel, pad, brushed kit; noteBuffer() cache
- music/theory.js — chord symbols, voice-led rootless voicings, walking/two/boom bass, motif phrases
- music/tracks.js — the 4 arrangements (intro → head → solo → keys solo → head …; heads seeded = same tune each time)
- music/scheduler.js — lookahead scheduler (1.5 s ahead, 200 ms tick), swing, humanise, per-player feel, damper releases
- music/index.js — bus chain: muffle LPF → dry | radio (HP/peak/LP/shaper/hiss) → glue compressor → music bus (+ room reverb send)

## How to view
- http://127.0.0.1:8765/gamble/dev/audio.html — flags: `?verify=1` (check every sound), `?music=1` (render all
  tracks + spectrograms), `?show=<name>`, `?render=<track>&sec=24`.
- Node smoke tests: scratchpad/audio/test.mjs <sfx files>, inst.mjs, tracks.mjs; stem balance: stems.js (eval in page).

## Decisions / notes
- Sounds are rendered on first use (main thread). Full catalog ≈ 6 s on desktop; call prewarm() on loading screens.
- Music note renders are 5-60 ms each; music.play() kicks off music.prewarm(id) so later bars are cached.
- Music offline renders peak ≈ -5 dBFS (glue compressor, track gain 0.6), RMS -17…-24 dB.
