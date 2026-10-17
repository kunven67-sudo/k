#!/bin/sh
# glue the source parts into one playable file
cd "$(dirname "$0")/.." && cat src/00-head.html src/10-world.js src/12-nature.js src/13-build.js src/15-sky.js src/16-life.js src/20-audio.js src/30-armor.js src/35-clothes.js src/40-fighter.js src/50-gore.js src/60-ai.js src/70-player.js src/75-village.js src/76-talk.js src/80-ui.js src/90-main.js src/99-tail.html > ironblood.html && wc -c ironblood.html
