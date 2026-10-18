#!/bin/sh
# glue the source parts into one playable file
# names from a story the player loves live in private/names.sed (never committed); the public file gets our own names
cd "$(dirname "$0")/.." || exit 1
cat src/00-head.html src/10-world.js src/12-nature.js src/13-build.js src/15-sky.js src/16-life.js src/20-audio.js src/30-armor.js src/35-clothes.js src/40-fighter.js src/50-gore.js src/60-ai.js src/70-player.js src/75-village.js src/76-talk.js src/77-magic.js src/78-spells.js src/79-mages.js src/80-ui.js src/85-legends.js src/90-main.js src/99-tail.html > .build.raw || exit 1
sed -f tools/names-public.sed .build.raw > ironblood.html && wc -c ironblood.html
if [ -f private/names.sed ]; then sed -f private/names.sed .build.raw > private/ironblood-private.html && echo "private build: private/ironblood-private.html"; fi
rm -f .build.raw
