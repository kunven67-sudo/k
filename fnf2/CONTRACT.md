# FNF 2 — build contract

FNF 2 is a fan rhythm game that must LOOK, SOUND and PLAY like real Friday Night Funkin' (FNF),
but every character, song, stage and drawing is ORIGINAL and made in code (canvas 2D + WebAudio).
It ships as ONE html file (`fnf2/fnf2.html`) built from the modules in `fnf2/src/`.

Read this whole file before writing code. If something here is unclear, pick the most
FNF-accurate option and write down what you chose at the top of your module in a comment.

---------------------------------------------------------------------------------------------------
## 0. Ground rules (everyone)

* **Original content only.** You may LOOK at real FNF code and art for reference (paths in §11),
  to copy layouts, timings, numbers, feel and style. You must NEVER embed, trace, base64, or
  redraw FNF's own characters (Boyfriend, Girlfriend, Pico, Daddy Dearest...), sprites, logos or
  music. Our characters are described in `src/01-data.js` (`G.CHAR_INFO`). Do not copy FNF code
  verbatim — re-implement it in your own JS.
* **No emojis** anywhere in the game (text, UI, art). Draw real graphics instead.
* **No external files or network at runtime.** Everything is drawn with canvas or synthesized
  with WebAudio. No `<img src=http...>`, no CDN scripts. Fonts are already embedded by the build.
* **Performance target:** 60 fps on a weak PC GPU (GT 1030) at 1080p, and on phones.
  - Never use `ctx.shadowBlur` or `ctx.filter` in per-frame drawing. (Allowed only while
    pre-rendering into a cached canvas once.) For glows, pre-render a radial-gradient sprite once.
  - Pre-render big static art (backgrounds, logos, arrow skins, text that doesn't change) into
    offscreen canvases with `G.cached(key, w, h, fn)` and draw them with `drawImage`.
  - Don't allocate big arrays/objects every frame in hot paths. Particle counts stay small
    (and smaller when `G.settings.quality === 'low'`).
  - Gradients created every frame are OK in small numbers; cache them when possible.
* **Work only in your own file(s)** listed in your task. Do not edit `00-core.js`, `01-data.js`,
  `98-dev.js`, `99-main.js`, `tools/` or another agent's module. If you need something from core
  that is missing, implement it locally inside your module (namespaced) and mention it in your
  final report.
* Every module is wrapped by the build in `(function(){ try { ... } catch(e){...} })()` and loaded
  in its own `<script>` tag, in file-name order. Attach everything you export to `G` (e.g.
  `G.audio = {...}`, `G.screens.play = {...}`). Top-level `const`/`function` stay private.
  Load order: 00-core, 01-data, 10-audio, 20-music, 30/31/32 chars, 40/41 stages, 50-menus,
  60-play, 70-editor, 98-dev, 99-main. Code that runs at load time must not depend on modules
  that load later; at runtime (inside functions) everything exists — but always guard
  (`if (G.audio) ...`) so a missing module degrades gracefully instead of crashing.
* Don't commit or push with git. Don't touch other repos. The lead integrates everything.
* You cannot ask the user questions. Decide yourself, FNF-accurate first.

### Build + test
```
cd /home/user/k/fnf2
node tools/build.js                                   # -> fnf2.html (all modules)
node tools/build.js --out /tmp/me.html --only 00,01,30,98,99   # just some modules (faster, isolated)
node tools/shot.js --html /tmp/me.html --query "dev=char&id=ace" --wait 1500 --out /tmp/a.png
node tools/shot.js --html fnf2.html --keys "Enter:800,Enter:600" --wait 1000 --out /tmp/b.png
```
`tools/shot.js` prints console errors + `G.errors` and exits with code 2 on errors. Then LOOK at the
PNG with your Read tool. Iterate until it really looks good. Use a private `--out` html path when
building (e.g. `/tmp/<yourname>.html`) so you never clobber another agent's build.
Dev screens (`src/98-dev.js`): `?dev=char&id=X[&freeze=0.1][&form=2]`, `?dev=stage&id=X[&song=0][&focus=dad|bf|gf|mid][&ev=lightning@800]`,
`?dev=icons`, `?dev=screen&name=freeplay`, `?dev=song&id=afterhours&diff=hard[&player=nitro]`.
Phone check: `--size 844x390 --touch`.

---------------------------------------------------------------------------------------------------
## 1. Core API (already written — `src/00-core.js`)

* `G.W=1280, G.H=720` — all game coordinates are in this space. `G.q` = canvas px per game px.
* `G.time` (s since start), `G.dt`, `G.fps`, `G.frame`.
* Math: `G.clamp, G.lerp, G.damp(a,b,rate,dt)` (frame-rate independent lerp), `G.ease.*`
  (quadOut, cubeOut, backOut, elasticOut, expoOut, sineInOut...), `G.rng(seed)` (deterministic),
  `G.hash(str)`, `G.pick(rand, arr)`, `G.fmtTime(sec)`, `G.mixColor(a,b,t)`, `G.rgba(hex,a)`.
* Transforms: `G.setScreenT(ctx, zoom=1)` — screen/HUD space (optional zoom about centre, for
  the FNF HUD bop). `new G.Camera(x,y,zoom)`: `cam.apply(ctx, scrollFactor)` sets world transform
  (Flixel-style: layer with scrollFactor 0.5 moves half as much), `cam.view(sf)` visible world rect,
  `cam.shake(intensity, dur)` (intensity = fraction of screen width, e.g. 0.005), `cam.update(dt)`.
* Canvases: `G.makeCanvas(w,h)`, `G.cached(key,w,h,fn(ctx,w,h))` (memoised), `G.uncache(prefix)`.
* Text: `G.text(ctx, str, x, y, {size, font:'alpha'|'vcr'|'body', color, outline, outlineColor,
  align, baseline, alpha, maxWidth})`; `G.measure(ctx,str,size,font)`; `G.wrap(ctx,str,maxW,size,font)`.
  Fonts: `alpha` = Spicy Rice (chunky FNF menu letters), `vcr` = VT323 (FNF's VCR HUD font, use for
  score text, small menu info, options descriptions), `body` = Chewy (dialogue, buttons).
* `G.alpha(ctx, str, x, y, {size, style:'bold'|'menu'|'menuSel', align, alpha, wobble, jitter, seed, color})`
  — the FNF "Alphabet" text. `menu` = black letters/white border (unselected main-menu item),
  `menuSel` = white letters/black border + black shadow (selected), `bold` = white/black (freeplay
  list, titles). Letters have fixed random tilt/size per string + a tiny 8fps re-ink wobble.
  `G.alphaWidth(ctx,str,size)`.
* `G.roundRect(ctx,x,y,w,h,r)` (path only).
* Sound shortcut: `G.sfx(name, opts)` — safe even if audio isn't loaded.
* `G.Conductor(bpm)`: `.update(posMs, onStep(step), onBeat(beat))` fires once per crossed step/beat;
  `.reset(posMs)`, `.beatF`, `.stepF`, `.crochet` (ms per beat), `.stepCrochet`.
* Settings: `G.settings` (see `G.DEFAULT_SETTINGS` in core for every key), `G.saveSettings()`,
  `G.resetSettings()`. Keys used by gameplay: `downscroll, middlescroll, ghostTapping, speedType
  ('chart'|'mult'|'const'), speedValue, songSpeed (0.5-2), offset (ms), hitsound (0-1), botplay,
  practice, noteSplashes, camZoom, flashing, fps, quality ('auto'|'high'|'low'), timeBar
  ('name'|'left'|'elapsed'|'off'), comboPopups, vol {master,music,vocals,sfx}, binds
  {note0..note3, dodge: [code,code]}, player ('ace'|'nitro'), diff (index), seenMechanics {}`.
  `G.DEFAULT_BINDS` (WASD + arrows), `G.DFJK_BINDS` (DFJK + arrows).
* Save: `G.getScore(songId,diff,player)` -> `{score, acc, misses, rank, fc}|null`,
  `G.submitScore(songId,diff,player,rec)` -> true if new best, `G.getWeekScore`, `G.submitWeekScore`,
  `G.save.customCharts` (editor), `G.save.deaths`, `G.saveData()`.
* `G.DIFFS` = easy, normal, hard, erupt, nightfall (`{id,name,color}`), `G.diffIndex(id)`.
* Input: screens receive `onAction(action, down, repeat, e)` for every action bound to the key and
  `onKey(code, down, repeat, e)` (return `true` to swallow, then no actions fire). Actions:
  `note0..note3` (lanes: 0 left, 1 down, 2 up, 3 right — from `G.settings.binds`), `dodge`,
  `ui_left/ui_down/ui_up/ui_right` (arrows + WASD), `accept` (Enter/Space), `back` (Esc/Backspace),
  `pause` (Enter/Esc), `reset` (R), `debug7` (7), `debug8` (8), `tab`, `shift`, `ctrl`.
  `G.input.isDown(action)`. Pointer: `onPointer(type:'down'|'move'|'up', x, y, id, e)` in game coords,
  `onWheel(dir)`. `G.touchMode` = true after a touch. `G.Swipe` helper for menu swipes/taps.
  `onBlur()` is called when the tab/window loses focus (play must auto-pause there).
  `G.input.blockKeys = true` stops action dispatch (use while rebinding a key).
* Screens: `G.screens[name] = {enter(params), leave(), update(dt), draw(ctx), onAction, onKey,
  onPointer, onWheel, onBlur}`; `G.setScreen(name, params, {instant})` does the FNF black
  gradient-wipe transition (`G.trans.active` while it runs). Draw everything yourself every frame
  (core clears to black first, then calls `draw`, then the transition, FPS counter and toasts).
* `G.toast(msg, color)`, `G.reportError(e, where)`, `G.DEBUG` (true with ?dev/?debug), `G.query`.
* Registries: `G.chars` and `G.stages` (see §3, §4). `G.drawSlot`/`G.drawPlaceholderChar` live in
  98-dev and are fine to reuse.

## 2. Data (`src/01-data.js`)
`G.CHAR_INFO[id]` {name, role, color, look, personality}; `G.WEEKS` (18 weeks incl. tutorial; each
`{id, name, title, opp, stage, color, mech:[...], songs:[{id, name, bpm, style, key, mode}]}`);
`G.SONGS` flat list (each song also has `week, weekIndex, index (0..2 within week), opp, stage,
color`); `G.songInfo(id)`, `G.weekInfo(id)`, `G.PLAYERS = ['ace','nitro']`; `G.STAGE_INFO[id]`
(art brief); `G.MECHANICS[type]` {name, avoid, desc}; `G.CREDITS`.
Everything is unlocked from the start (no locks anywhere).

---------------------------------------------------------------------------------------------------
## 3. Characters (`src/30-chars-main.js`, `31-chars-b.js`, `32-chars-c.js`)

```js
G.chars.register({
  id: 'echo', name: 'ECHO',
  healthColor: '#3fd4ff',          // health bar colour (Psych style)
  box: { w: 360, h: 470 },         // body bounds at scale 1; feet at (0,0), body extends UP (negative y)
  scale: 1,
  faces: 'right',                  // natural facing: opponents 'right', player chars 'left', MEL 'front'
  camOffset: { x: 150, y: -260 },  // camera look point relative to the feet (world units, as-is)
  dance: 'idle',                   // 'idle' (bop every 2 beats) | 'leftRight' (danceLeft/danceRight every beat)
  singDuration: 4,                 // steps a sing pose holds before returning to idle
  voice: { ...voiceDef },          // see §5
  forms: 1,                        // how many visual forms (info.form) the character supports
  anims: { idle(ctx, at, info){...}, singLEFT(ctx, at, info){...}, ... },
  icon(ctx, size, losing, t) {...},              // FNF health icon, centred at 0,0 in a size x size box
  portrait(ctx, w, h, emotion, t) {...},         // dialogue bust, centred at 0,0 inside w x h
});
```
* **Coordinates:** world units. Feet at (0,0), the character stands ON y=0 and goes up.
  Typical heights: player chars 380-430, MEL + speakers ~520 tall / ~480 wide, normal opponents
  420-560, bosses up to ~750 (OMEGA). The ctx is already translated/scaled; just draw.
* **`at`** = seconds since this animation started. FNF animations run at 24 fps, so step your
  poses with `const f = Math.floor(at * 24)`. A sing pose: frames 0-1 = the big "hit" (strong lean,
  squash/stretch, mic thrust), then it settles into the held pose and keeps a subtle 2-frame shake
  so long notes don't look frozen. Idle: a bop (squash down at frame 0-2, spring back by ~frame 8,
  then hold still until the next bop). Hair/cloth can lag 1-2 frames behind (overlap).
* **`info`** = `{beat (float song beat), time (s), form (0..3), lowQuality, ...}`. `form` = which
  song of the week (0,1,2) plus mid-song transforms (+1). Characters with transformations (RAZOR,
  STEVE, GLITCH, OMEGA) MUST look different per form; others may just get more intense.
* **Directions:** `singLEFT` = pose/lean/point toward SCREEN LEFT in the character's natural
  facing. Never mirror yourself; the play module handles flipping if ever needed.
* **Required anims**
  - every character: `idle` (or `danceLeft` + `danceRight` if `dance:'leftRight'`), `singLEFT`,
    `singDOWN`, `singUP`, `singRIGHT`.
  - player chars (ACE, NITRO): also `singLEFTmiss`, `singDOWNmiss`, `singUPmiss`, `singRIGHTmiss`
    (pained face, flinch, drawn in a purple-blue miss palette like FNF), `hey` (cheer pose),
    `scared` (flinch, for lightning), `firstDeath` (~1.6 s: gets hit, mic drops, collapses; FNF
    death), `deathLoop` (loops forever: lying/kneeling dazed, breathing), `deathConfirm` (~1.4 s:
    pops back up, glowing, confident), `resultsLoss`, `resultsGood`, `resultsGreat`,
    `resultsPerfect` (looping poses for the results screen). NITRO also `shoot` (fires the paint
    blaster, muzzle flash) and `singXXX-alt` optional.
  - MEL (gf, `dance:'leftRight'`): `danceLeft`, `danceRight` (head bop + hair swing, speakers bump),
    `cheer`, `sad`, `scared`, plus the 4 sing poses (she is the tutorial opponent) and
    `resultsLoss/Good/Great/Perfect`. MEL's drawing INCLUDES the speaker stack she sits on; the
    speaker woofers pulse with `info.beat`.
  - opponents: optional `hey`/`laugh`, `transform` (RAZOR/STEVE/GLITCH), `shoot` (DEADEYE).
  - Missing optional anims fall back automatically (`G.chars.FALLBACK`), never crash.
* `G.chars.draw(ctx, id, anim, at, x, y, scale, flip, info)` renders. `info.tint`/`info.tintAmt`
  /`info.alpha` are applied to the whole character via an offscreen buffer (core does it).
* **Icons** (Psych/FNF health icons): the character's HEAD only, big, chunky black outline
  (~6px at size 150), simple shading, fills ~85% of the box. `losing=true` = hurt/sad face.
  Player icons face left, opponent icons face right (natural facing). Must read clearly at 75 px.
* **Portraits** (dialogue): head + shoulders, larger detail, emotions `normal | happy | angry | sad
  | shock`, facing their natural direction.
* **Dialogue lines:** each character module also fills `G.DIALOGUE[songId] = [{who, emo, text}, ...]`
  for its opponents' songs (and the tutorial for MEL). `who`: `'o'` opponent, `'p'` player (the
  player only says FNF-style gibberish: "Beep!", "Bep bop skee-dah!"), `'g'` MEL. 4-10 lines per
  song, short (max ~90 chars), funny, in character, telling a tiny story across the 3 songs of the
  week (song 3 is the climax). `G.DIALOGUE = G.DIALOGUE || {}` first.
* **Art style (FNF look):** thick black outlines (5-7 px at scale 1, `lineJoin='round'`), bold
  flat colours with ONE darker cel-shade tone and one small highlight, big expressive eyes,
  exaggerated cartoon proportions (big heads ~ 1/3 of body for teens), energetic asymmetric poses,
  smooth bezier shapes (no stiff rectangles unless the character is blocky on purpose). Look at
  the FNF character sheets in §11 for the pose energy and line weight, then make OUR characters.
  Each character must be instantly recognisable from its silhouette.

## 4. Stages (`src/40-stages-a.js`, `41-stages-b.js`)

```js
G.stages.register({
  id: 'club', name: 'Club Phantom',
  zoom: 0.9,                                   // default camera zoom (FNF stage = 0.9)
  dad: { x: 380, y: 900 }, gf: { x: 740, y: 860 }, bf: { x: 1100, y: 900 },  // feet positions
  camOffsets: { dad: {x:0,y:0}, bf: {x:0,y:0}, gf: {x:0,y:0} },              // optional tweaks
  events: ['lightning'],                       // names this stage reacts to (for testing)
  create(s, info) {},                          // build state into `s`; pre-render static layers here
  update(s, dt, info) {},
  beat(s, beat, info) {}, step(s, step, info) {},
  event(s, name, value, info) {},              // song events {name:'stage', v:{name}} + random ones
  drawBack(ctx, cam, s, info) {},              // all layers BEHIND the speaker girl
  drawMid(ctx, cam, s, info) {},               // optional: between MEL and the singers
  drawFront(ctx, cam, s, info) {},             // optional: in front of everyone (foreground props)
  drawOverlay(ctx, s, info) {},                // optional: SCREEN space over the stage, under the HUD (rain, vignette, fog)
});
```
* Draw each parallax layer with `cam.apply(ctx, scrollFactor)` then draw in world units.
  Far sky ~0.1-0.3, buildings ~0.4-0.7, floor 1.0, foreground 1.1-1.4. The camera moves between
  dad and bf and zooms (0.9 ± bops, and sometimes 1.05+ when focused), so layers must cover the
  view generously: at scrollFactor 1 cover at least x -700..2200, y -400..1400.
* Default world layout: ground line y ≈ 900, singers' feet on it, MEL's speakers at x≈740.
  Visible area at zoom 0.9 centred on the middle ≈ x 30..1450, y 220..1020.
* `info` = `{time, beat, step, bpm, crochet, songIndex (0..2), form, flashing, lowQuality, health
  (0..2), playing, cam, chars:{dad,gf,bf} (each {id,x,y,anim,at}), api}`;
  `api.playAnim(who:'dad'|'gf'|'bf', anim)`, `api.flash(color, dur)` (already respects the
  flashing setting), `api.shake(intensity, dur)`, `api.zoomHit(amount)`, `api.sfx(name, opts)`.
* Events: stages run their own FNF-style random events (week-2 lightning: chance per beat with a
  cooldown, thunder sfx, `api.playAnim('bf','scared')`, `api.playAnim('gf','scared')`, white flash;
  week-3 train; week-4 car pass...) AND respond to `event(s, name)` from songs. List every event
  name in `events`. Respect `info.flashing` (no white flashes when false) and `info.lowQuality`
  (fewer particles/layers).
* `songIndex` lets a stage change across the week (e.g. overworld day → sunset → corrupted night).
* Stage art style: painted-cartoon look like FNF backgrounds: strong silhouettes, limited palette
  per stage, dark outlines on near objects, softer/no outlines on far layers, lighting that makes
  the singers pop (background darker/desaturated vs. the characters). Pre-render static layers.

---------------------------------------------------------------------------------------------------
## 5. Audio (`src/10-audio.js`)  — `G.audio`

Own WebAudio engine. No Tone.js, no samples: everything synthesized.
```js
G.audio = {
  ctx, ready,
  unlock(),                 // call on any gesture; creates/resumes the AudioContext; idempotent
  update(dt),               // called every frame by core (scheduler pump)
  applyVolumes(),           // re-read G.settings.vol
  sfx(name, {vol, rate, pan}),
  music: {                  // menu / game-over / results / pause loops
    play(track, {loop=true, fadeIn=0, vol=1, restart=false}),  // track = {id, bpm, music: MusicDescriptor}; same id already playing -> keep going
    stop(fadeOut=0), current() -> {id,bpm}|null, time() -> ms since the loop started (wraps at loop end),
    setVolume(v, fadeSec),
  },
  playSong(song, opts) -> SongHandle,     // song = SongData (§6)
  voice(voiceDef, midi, durSec, {when, syl, vel, bus:'sfx'}),   // one sung syllable (editor, dialogue blips)
};
// opts: {voices: {o: voiceDef, p: voiceDef, g: voiceDef}, rate=1, startPos=ms (can be negative =
//        countdown before the music), instOnly=false, loop=false, vol=1}
// SongHandle: { time() -> song position in ms (negative before start; uses the audio clock, corrected
//   for outputLatency, multiplied by rate), pause(), resume(), stop(), seek(ms), paused, ended,
//   setPlayerVocals(on) /* mute/unmute player vocal bus with a ~10 ms ramp (FNF: vocals cut on miss) */,
//   setVolume(v) }
```
* Scheduling: lookahead scheduler (e.g. every 25 ms schedule events in the next ~150 ms) for music
  + vocals; never schedule a whole song up front. `rate` changes tempo WITHOUT changing pitch
  (just divide event times by rate). Pause/seek must silence everything instantly and resume
  exactly. Track active nodes so stop() really stops.
* Buses: master → (music, vocals[o,p,g], sfx); volumes from `G.settings.vol`. Shared reverb
  (generated impulse) + tempo-synced delay sends. A master compressor/limiter so nothing clips.
* **MusicDescriptor** (made by the composer, §6):
  `{ bpm, lengthSec, tracks: [ { inst, vol, pan, fx: {rev, delay, dist, crush, lp, hp, duck},
  params: {...}, events: [ {t (sec), d (sec), m (midi), v (0-1)} ] } ] }`.
  `fx.duck` (0-1) = sidechain-style volume dip on every `kick`/`kick808` event of the same descriptor.
* **Instruments** (implement ALL; each a small synth recipe, punchy and modern-sounding, not beepy):
  drums: `kick, kick808 (m = pitch, d = length), snare, clap, rim, hat, ohat, ride, crash, tom (m),
  shaker, cowbell, perc (m), chipnoise (m picks tone), gunshot, scratch`;
  melodic: `bass, sub, reese, slap, pluck, keys, piano, organ, pad, strings, choir, brass,
  synthbrass, lead, squarelead, chip, triangle, arp, bell, marimba, steeldrum, guitar (distorted
  power chord: root + fifth + octave), cleanguitar, flute, whistle, theremin, harpsichord, koto`;
  fx: `riser (d), downlifter (d), impact, reverse (cymbal swelling into t+d), noise, vinyl (crackle
  bed for d), thunder, wind, crowd (cheer swell), belltoll (m)`.
  `params` common keys: `wave`, `cutoff`, `res`, `attack`, `release`, `detune`, `glide`, `octave`.
* **Voice** (FNF singing): each vocal note is one sung syllable — a buzzy oscillator through 2-3
  vowel formant band-pass filters, a consonant burst at the start (b/p pop, d/t click, s/sk hiss,
  k/g), quick pitch scoop into the note, vibrato on long notes, slight pitch fall at the end. It must
  sound like FNF's "beep bop skee-dah" scat, NOT a plain beep. voiceDef:
  `{wave:'saw'|'square'|'triangle'|'pulse'|'sine', octave:0, formant:1.0 (<1 bigger/deeper, >1
  smaller/cuter), vibrato:0.3, grit:0, crush:0, breath:0.1, chorus:0, robot:0, reverb:0.2, echo:0,
  style:'bop'|'robot'|'ghost'|'growl'|'chip'|'diva'|'deep'|'whisper'|'cool', gain:1}`.
  Vocal events `{t, d, m, v, syl}`: `syl` is a short scat syllable like `ba, bop, beep, skee, dah,
  bee, doo, wah, yeah, hey, ooh, ah, be, dop, da, la, na, uh`. The first letters pick the consonant,
  the vowel picks the formants. `style` re-flavours them (robot = ring-mod + crush, ghost = airy
  'oo' + reverb, growl = distorted low formant, chip = no formants, square, diva = bright + vibrato).
* **SFX names** (all required): `scroll` (menu move), `confirm` (menu confirm, bright 2-note), `cancel`,
  `intro3, intro2, intro1, introGo` (countdown: punchy beatbox/vocal-ish hits, Go is biggest),
  `miss1, miss2, miss3` (FNF "missnote": short dull thud + falling squeak), `hitsound` (clicky tick),
  `death` (FNF "fnf_loss_sfx": big hit + falling sting), `deathConfirm` (bright riser jingle ~1.5s),
  `text` (dialogue typing blip), `dialogueOpen`, `dialogueNext`, `lock`, `unlock`, `thunder1`,
  `thunder2`, `trainPass` (long whoosh + rumble ~4s), `trainBell`, `carPass`, `siren`, `gunshot`,
  `dodge` (whoosh), `hurt` (damage hit), `burn` (sizzle), `glitch` (digital stutter), `coin`,
  `fireworks`, `wave` (splash), `bell` (clock bell), `crowd`, `scratch`, `cheer`, `paintShot`
  (NITRO blaster: splat pop), `resultsTally` (tick), `rankReveal`, `pauseOpen`, `beep`.
* Must work on phones (resume context on touch). Lazy-create the AudioContext in `unlock()`.

## 6. Songs + music (`src/20-music.js`) — `G.songs`, `G.music`

```js
G.songs.build(songId, diff /* 'easy'|'normal'|'hard'|'erupt'|'nightfall' */, player /* 'ace'|'nitro' */, opts /* {bpm} */) -> SongData
G.songs.preview(songId, player) -> {id, bpm, music}   // instrumental loop for the freeplay preview (a 16-32 bar loop from the hook)
G.music.menu()            -> {id:'menu', bpm, music}  // the "Freaky Menu"-style main theme loop (title + all menus)
G.music.gameOver(player)  -> loop;  G.music.gameOverEnd(player) -> one-shot retry jingle (~2.5 s, {loop:false})
G.music.results(tier)     -> loop  (tier: 'loss'|'good'|'great'|'excellent'|'perfect')
G.music.pause()           -> chill loop for the pause menu ("Breakfast" vibe, our own)
G.music.dialogue(weekId)  -> soft loop under dialogue boxes
```
**SongData**
```js
{ id, name, week, stage, opp, player, diff,
  bpm, crochet /*ms per beat*/, stepCrochet,
  speed,            // scroll speed for this diff (FNF scale: ~1.4 easy ... 3.4 nightfall)
  length,           // ms: end of the song (music end)
  notes: [ { t /*ms*/, lane /*0-3*/, len /*ms, 0 = tap*/, who: 'p'|'o', type, alt?: bool, to?: lane /*glitch target*/ } ], // sorted by t
  sections: [ { t, len, focus: 'p'|'o'|'g' } ],        // camera focus per 4-beat section (FNF mustHitSection)
  events: [ { t, name, v } ],
  music: MusicDescriptor,                               // instrumental (times in SECONDS)
  vocals: { o: [ {t /*sec*/, d, m, v, syl} ], p: [...], g: [...] },
  mechanics: ['bullet', 'dodge', ...],                  // special things used in this chart
}
```
* **Times:** `notes/sections/events/length` in **milliseconds**; `music` + `vocals` in **seconds**.
* Note `type`: `normal | hurt | bullet | fire | virus | void | ghost | glitch | coin`. Avoid-types
  (hurt, bullet, fire, virus, void) are only for the player (`who:'p'`). Use the week's `mech`
  list (01-data) to decide which types/events a week gets. Tutorial + weeks without mechanics:
  normal notes only. Bullet notes appear on every difficulty (never softened).
* **Events** (`name`, `v`): `hey {who:'bf'|'gf'|'both'}`, `zoom {game:0.015, hud:0.03}`,
  `transform {}` (opponent form +1, flash + shake; RAZOR song 3, STEVE song 3, GLITCH song 3,
  OMEGA song 3), `flash {color, dur}`, `speed {mult, dur /*ms tween*/}` (TEMPO), `stage {name}`
  (forwarded to the stage, e.g. lightning on a big hit, train, fireworks), `text {str, dur, color,
  glitch}` (STEVE "help me"), `glitch {dur}` (screen glitch), `dodge {}` (DEADEYE fires at `t`),
  `shoot {who:'p'|'o'}` (gun/paint shot animation), `focus {who:'o'|'p'|'g'|null}`,
  `drain {amount, floor}` (opponent notes steal health from now on).
* **Song structure (FNF-like):** 1:15–2:30 long. Count-in silence is handled by gameplay (music
  starts at t=0). Sections of 4 beats; the opponent sings a phrase (1-2 sections), then the player
  answers (often a variation of the same melody — FNF call & response), chorus sections both
  alternate faster, a breakdown/bridge, a final big chorus, short outro. The vocal melody IS the
  chart: every vocal syllable = one note in the full (hard) chart, lane picked from the melody's
  pitch movement so the chart feels musical (repeated pitch = same lane, going up = up/right...).
  Long syllables become hold notes.
* **Difficulty charts:** easy ≈ 1 note per beat max, no notes closer than ~1/4 beat... normal ≈
  8ths, hard = full vocal (8ths + some 16ths), erupt = remix arrangement + denser chart (16th runs,
  some chords/doubles), nightfall = insane (fast 16ths, jacks, more doubles). Look at real FNF chart
  JSONs (§11) to match density + pattern feel per difficulty. Never stack a note on a lane that is
  still holding a sustain. Keep everything humanly playable.
* **Player variants:** `player === 'nitro'` uses a remixed arrangement ("NITRO mix": heavier
  drums, guitar, different chords voicing) and its own vocal variation; ERUPT/NIGHTFALL use the
  ERUPT remix arrangement. Vocal parts `o` = opponent's line, `p` = player's line, `g` = MEL (only
  tutorial where she's the opponent: then put her line in `o`).
* Songs must sound like real music in the given `style`/key/mode: proper chord progressions,
  groove, bass that locks to the kick, catchy hooks, intros/fills/drops, not random notes. Every
  song different. Deterministic (seeded by song id + diff + player) and cached; `build` should take
  < 150 ms.
* Custom charts from the editor: if `G.save.customCharts[songId + '|' + diff + '|' + player]`
  exists ( `{notes, sections, events, speed, bpm}` ), use them instead of the generated chart.

---------------------------------------------------------------------------------------------------
## 7. Gameplay (`src/60-play.js`) — `G.screens.play`

`G.setScreen('play', { mode: 'story'|'freeplay', week: weekId|null, songs: [songId...],
songIndex: 0, diff: 'normal', player: 'ace'|'nitro', weekStats: {...} /*accumulated in story*/,
deaths: 0, fromEditor: false })`
Must re-create FNF/Psych PlayState faithfully (read §11 code):
* Layers: stage back → MEL (+speakers) → stage mid → opponent (dad) → player (bf) → stage front →
  stage overlay → HUD (own zoom) → popups/substates. Tutorial (`opp === 'mel'`): MEL is the
  opponent, standing at the gf position, no separate gf.
* Camera: follows section focus (dad / bf / gf) with FNF lerp (~2.4/s via `G.damp`), stage zoom;
  every 4 beats `camGame zoom +0.015`, `camHUD +0.03`, lerping back (respect `settings.camZoom`).
* Countdown: 4 beats before t=0: beat 1 `intro3` (no image), 2 "READY?" graphic + `intro2`,
  3 "SET!" + `intro1`, 4 "GO!" + `introGo`, graphics pop in and fade like FNF. Characters dance.
* Strumlines: FNF positions (Psych: STRUM_X 42 + 112*i, player half +640, y=50 or downscroll 570),
  arrow skin = our own FNF-like arrows: purple left `#C24B99`, cyan down `#00FFFF`, green up
  `#12FA05`, red right `#F9393F`, chunky with a white inner rim + dark border; strum receptors grey
  `#87A3AD` with press + confirm (bright, glowing) animations; sustain trails with end caps;
  note splashes on SICK (and hold covers on held sustains). Pre-render all arrow sprites once.
  Middlescroll + downscroll + scroll speed setting supported. Opponent strum lights up on its notes.
* Judgement (Psych): sick ≤45 ms, good ≤90, bad ≤135, shit ≤166 (safe zone); score 350/200/100/50,
  miss −10; health 0..2 start 1, hit +0.023, miss −0.0475; holds give health + 250 score/sec while
  held, releasing early = 1 miss. Accuracy = (sick 1, good .67, bad .34, shit 0, miss 0) average.
  Rating names (Psych): You Suck! <20%, Shit <40, Bad <50, Bruh <60, Meh <69, Nice <70, Good <80,
  Great <90, Sick! <100, Perfect!! = 100. FC tags SFC/GFC/FC/SDCB (<10 misses)/Clear.
  Ghost tapping setting; `settings.offset` shifts judgement; botplay; practice (can't die).
* Rating popups like FNF: "SICK!!" / "GOOD" / "BAD" / "SHIT" graphic + combo digits (3 digits,
  leading zeros, shown at combo ≥ 10) that pop up, fall with gravity and fade; drawn in our own
  FNF-like style. Psych HUD: health bar at bottom (y≈0.89*H, downscroll 0.11*H) 600×19 with black
  border, left side = opponent colour, right = player colour, the two icons sit at the split
  point and bop on every beat (scale 1.2 → 1), losing frames under 20% / over 80%;
  `Score: 12345 | Misses: 2 | Rating: Great (91.23%) - FC` in VCR font under it; time bar at the
  top with song name / time left; "BOTPLAY" text when botplay.
* Characters: sing pose on each note (dad on his notes, bf on hits, `singXmiss` + random miss sfx
  + `setPlayerVocals(false)` on miss, vocals back on next hit), return to idle after
  `singDuration` steps; idle on every 2nd beat; MEL dances every beat, `cheer` on `hey` events
  and at combo milestones (every 50), `sad` when a combo ≥ 5 breaks, `scared` on stage scares.
  Miss tint: draw bf with `info.tint='#6b4eff', tintAmt 0.35` for the miss anim.
* Special notes + mechanics (§6 types/events): avoid-notes (hurt/bullet/fire/virus/void) look
  different (draw each type clearly: fox-tail fake, red bullet, flaming, green virus, black void)
  and hurt when hit (bullet −0.5, fire = burn −0.03/beat for 4 beats, virus = HUD glitch + −0.2,
  void −0.3, hurt −0.3) and are ignored safely when not hit; ghost notes fade out in the last 40%
  of their travel; glitch notes jump lanes at 50% travel (telegraph with a flicker); coin notes
  are optional bonus; dodge: warning "!" + DODGE prompt 1.5 beats before, press `dodge`
  (SPACE / tap the DODGE button) in [t−600 ms, t+100 ms] or take −0.6 health; drain: opponent
  notes reduce health to a floor. The first time a mechanic appears (`G.settings.seenMechanics`)
  show an FNF-style popup card explaining it (`G.MECHANICS[type].desc`) before the countdown.
* Events (§6) handled; `stage` events forwarded to `stageDef.event`. Stage `api` provided.
* Pause substate (Enter/Esc or the on-screen pause button on touch): dark overlay, FNF/Psych pause
  menu items in Alphabet font: Resume, Restart Song, Change Difficulty, Toggle Practice Mode,
  Toggle Botplay, Exit to Menu; info top-right (song name, difficulty, "Blueballed: N" style
  death counter — call it "Died: N"); pause music (`G.music.pause()`); auto-pause on `onBlur`.
* Game over substate: camera snaps to the player, `death` sfx, `firstDeath` → `deathLoop` + game
  over loop music; Enter = `deathConfirm` + `gameOverEnd` jingle, fade, restart song; Esc = back
  to menu. Death counter `G.save.deaths` + per-run deaths.
* Dialogue (story mode, before each song if `G.DIALOGUE[songId]`): FNF/Psych speech box at the
  bottom, portrait slides in from the side of whoever talks, text types out with `text` blips at
  ~30 chars/s, Enter = finish/next, Esc = skip all, soft music `G.music.dialogue(week)`.
* End of song: story → next song (keep weekStats) or after the last → `results`; freeplay →
  `results`. Save scores with `G.submitScore` (not in botplay; practice runs not saved).
* Touch (phones): 4 tall hitbox zones (FNF mobile hitbox: purple/cyan/green/red translucent
  columns, flash on press), plus pause button top-right and a DODGE strip when the song has dodge.
* Press 7 in a song → `G.setScreen('editor', {songId, diff, player, from:'play'})`.
* Restart from pause / game over must fully reset state (no leftover notes, timers, tints).

## 8. Menus (`src/50-menus.js`) — screens `title`, `mainMenu`, `storyMenu`, `freeplay`, `options`, `credits`, `results`

Match real FNF (V-Slice / Psych) layout, motion and sounds, with our own art:
* **title**: menu music starts; FNF intro text sequence synced to beats (white VCR/alpha text
  lines appearing on black, random funny pairs of lines like FNF's introText — write ~30 of our
  own pairs), then a white flash + the title: big bopping "FNF 2" graffiti logo (left/top), MEL
  dancing on her speakers (right), "PRESS ENTER TO BEGIN" flashing at the bottom (tap on phones),
  Enter → flash + `confirm` + to mainMenu. Logo: fat bubble graffiti letters "FNF" pink→magenta
  gradient + big blue "2", thick black outline, spray drips, bumps on every beat.
* **mainMenu**: yellow `menuBG`-style background (our own: warm yellow with orange-red loose
  pencil sketches of OUR characters, drawn with jittery multi-pass strokes), slight scroll as the
  selection moves; items centred: STORY MODE, FREEPLAY, OPTIONS, CREDITS — unselected = `menu`
  style alpha text, selected = bigger `menuSel` style + a little bounce; confirm = background
  flickers magenta (`menuBGMagenta` vibe) + chosen item flickers, others fade out, then go.
  Version text bottom-left in VCR ("FNF 2 v2.0.0").
* **storyMenu** (classic FNF): black top bar with "WEEK SCORE: N" left and week title right;
  yellow band `#F9CF51` with the opponent (left), player (centre) and MEL (right) bopping to the
  music; scrolling list of week titles below (our own big blue-ish week text images, e.g.
  "WEEK 1"), selected one bright, others dim; "TRACKS" list in pink `#E55777` bottom-left;
  difficulty selector right (arrows + difficulty name in its colour, sliding in on change);
  player toggle (TAB or a button: ACE / NITRO) updates the band; Enter → player `hey` pose, week
  title flashes, `confirm`, then play.
* **freeplay** (Psych style): background tinted (lerped) to the selected song's week colour;
  vertical list of song names in `bold` alpha text, curving slightly left as they go away (FNF
  `isMenuItem` targetY layout), opponent icon right of each name; top-right box with
  "PERSONAL BEST: N (xx.xx%)" + difficulty "< HARD >"; after ~0.5 s on a song play
  `G.songs.preview()` instrumental; TAB switches player ACE/NITRO; Enter plays; 7 opens the editor
  for that song; Esc back (menu music returns).
* **options**: categories (Gameplay, Visuals, Audio, Controls, Offset & Calibration, Reset)
  with every setting in §1 (checkbox `checkboxThingie`-style animated checks, number/choice
  values with left/right, description text at the bottom in VCR). Controls page: rebind every lane
  (2 slots each) + dodge, presets WASD+Arrows / DFJK+Arrows. Calibration screen: metronome beat at
  ~100 bpm, player taps along, shows average offset, Apply. Volume sliders. Reset save (confirm).
* **credits**: scrolling list from `G.CREDITS` in Psych credits style.
* **results** (V-Slice ResultState): params `{mode, week, songs, diff, player, title, stats:{score,
  sick, good, bad, shit, misses, maxCombo, totalNotes, acc}, newBest}`. Rank from accuracy & clear:
  PERFECT GOLD (all sick), PERFECT (100% no misses), EXCELLENT ≥90, GREAT ≥80, GOOD ≥60, LOSS <60.
  Animated: dark scrolling background, "RESULTS" header slides in, tallies roll up one by one with
  `resultsTally` ticks (TOTAL NOTES, MAX COMBO, SICK, GOOD, BAD, SHIT, MISSED in colours), score
  digits roll, rank letter/title slams in with `rankReveal`, player + MEL do the matching
  `results*` pose, "NEW HIGH SCORE!" if new best, rank music `G.music.results(tier)`; Enter →
  back to storyMenu/freeplay (menu music).
* All menus: FNF sounds (`scroll`, `confirm`, `cancel`), keyboard + touch (tap items, swipe to
  scroll, on-screen back button on touch), beat-synced bops using `G.audio.music.time()` + bpm.

## 9. Chart editor (`src/70-editor.js`) — `G.screens.editor`

Params `{songId, diff, player, from: 'play'|'freeplay', startMs}`. Easy to use:
* Grid like FNF: 8 columns (opponent 4 | player 4) + an event column; rows = 16th steps; zoom;
  section banding every 16 steps with "who sings" toggle per section (camera focus); strumline
  marker showing current time; arrows drawn with the gameplay arrow skin (`G.notes.drawArrow` if
  present, else own).
* Mouse: click empty = add note, click note = delete, click+drag down = hold length; right click =
  delete. Note-type picker (normal + special types). Snap selector (4th/8th/12th/16th/24th/32nd/64th).
* Keys: Space play/pause (instrumental + vocals via `G.audio.playSong`, hitsound on notes),
  Up/Down/wheel scroll, Shift faster, Enter playtest from current section, Ctrl+Z undo, Ctrl+Y
  redo, Ctrl+C/V copy/paste section, Delete clears section, Esc exits (asks to save).
* Panel: song info, BPM (changing BPM rebuilds the song with `opts.bpm`), scroll speed,
  difficulty, player, "Load generated chart", "Save" (to `G.save.customCharts`), "Export JSON"
  (download) / "Import JSON" (file picker), "Clear", a short help box.
* Touch: basic tapping works; the editor is mainly for PC.

## 10. Visual style quick reference
* FNF palette: arrows `#C24B99 #00FFFF #12FA05 #F9393F`; story band `#F9CF51`; tracks pink
  `#E55777`; menu yellow `#FDE871`-ish; Psych score text white VCR with black outline.
* Text in UI is short and punchy. No emojis.

## 11. Reference material (LOOK, don't copy)
* Real FNF source (V-Slice, Haxe): `/home/user/funkincrew/funkin/source/funkin/` — e.g.
  `ui/title/TitleState.hx`, `ui/mainmenu/MainMenuState.hx`, `ui/story/StoryMenuState.hx`,
  `ui/freeplay/FreeplayState.hx`, `play/PlayState.hx`, `play/ResultState.hx`,
  `play/GameOverSubState.hx`, `play/PauseSubState.hx`, `play/notes/*`, `play/components/*`,
  `play/scoring/Scoring.hx`, `ui/transition/`, `ui/options/`, `ui/debug/charting/`.
* Psych Engine source: `/home/user/shadowmario/fnf-psychengine/source/` — `states/PlayState.hx`,
  `objects/Note.hx`, `objects/StrumNote.hx`, `objects/HealthIcon.hx`, `substates/PauseSubState.hx`,
  `substates/GameOverSubstate.hx`, `states/FreeplayState.hx`, `states/StoryMenuState.hx`,
  `states/editors/ChartingState.hx`, `options/*`, `backend/Rating.hx`. Psych assets are under
  `/home/user/shadowmario/fnf-psychengine/assets/`.
* Real FNF art (for style only): `/home/user/funkincrew/funkin.assets/` — `preload/images/`
  (menuBG.png, menuBGMagenta.png, menuDesat.png, logoBumpin.png, gfDanceTitle.png, alphabet.png,
  NOTE_assets.png, StrumlineNotes.png, mainmenu/, storymenu/, freeplay/, icons/, title-screen-text/),
  `shared/images/` (characters/, noteSplashes.png, healthBar.png, resultScreen/, ui/, stage*.png),
  `week1..week7/images/` (stage backgrounds), `preload/data/songs/<song>/<song>-chart.json`
  (real charts: note density/patterns per difficulty) and `-metadata.json` (bpm etc).
  Sprite sheets are big PNGs; open them with Read to look. Crop/scale with python3 PIL if needed
  (save crops in /tmp, never in the repo).
