# Jordus: reading the mod out of a gameplay video

The tools that turn the gameplay video (`v.mp4`, 1024x576, 30 fps) into the song, charts, camera and art that
`tools/own/jordus.py` packs. Work folder: `$FNF_JORDUS_WORK` (default `/tmp/claude-0/nf`), with `tools/esrgan.py`
and the models in `/tmp/claude-0/models` (Real-ESRGAN `realesr-animevideov3.pth`, rembg `birefnet-general-lite`).
Nothing the video holds is ever committed; only this code.

Run in this order (each one writes what the next reads):

1. `stems.sh`: sound -> demucs stems; brightness of every frame (`bright.npy`: the blackouts).
2. `kymo2.py` -> `notes.py` -> `holds.py` -> `chart_final.py`: your chart. Each arrow lane is read on every frame
   (its colour, along the lane), arrows scroll up at 1110 px/s, so each arrow's hit time comes from where it is
   on many frames (2-8 ms apart). 125 BPM exactly; holds from the trails.
3. `camtrack.py`: the camera on every 2nd frame (SIFT against the 90 s frame: a similarity = position + zoom).
4. `goggles.py` -> `posefeat.py` -> `pose_knn.py` -> `oppchart2.py`: her chart. Her goggles glow pink / cyan /
   green / red with the arrow she sings (red is also her resting colour); a pose recogniser fills in the frames
   where the goggles are hidden.
5. `plate.py opp|plr` (the stage behind each girl), `plate2.py opp` (a CLEAN stage behind her: ~100 frames,
   each masked by the cut-out model, median of where she wasn't), `pickfr.py` (frames with no arrows crossing the
   player), `cut_all.py opp|plr` (= `sprite_cut.py` per frame: upscale x4, warp into the reference frame x2,
   BiRefNet mask, goggle glow added back; the player also loses what the background reaches without crossing
   her black outline + the ramp's thin black line). Bits of stage left on HER are fine: in the game she stands on
   the same stage, at the same spot, so they land on exactly what they show (her cap is the buildings' navy, so
   cutting closer only ate her). BiRefNet runs with the onnxruntime memory arena OFF (it leaks: OOM in ~22 frames).
6. `icons.py`: the health icons off the health bar (outline rebuilt, the bar removed).
7. `panorama.py` -> `stage_build.py`: the whole stage from every camera angle, filled under the girls, upscaled.
