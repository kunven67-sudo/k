#!/bin/bash
# Downloads the starter stickers (Microsoft Fluent Emoji 3D, MIT license) into ui/stickers/
# and builds ui/emoji.txt (emoji <tab> name <tab> group) from Unicode's emoji-test.txt.
set -e
cd "$(dirname "$0")"
mkdir -p ui/stickers
base="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"
while IFS= read -r name; do
  [ -z "$name" ] && continue
  low=$(echo "$name" | tr 'A-Z' 'a-z' | tr ' ' '_' | tr -d "'")
  out="ui/stickers/$low.png"
  [ -s "$out" ] && continue
  enc=$(echo "$name" | sed 's/ /%20/g')
  curl -fsS -o "$out" "$base/$enc/3D/${low}_3d.png" 2>/dev/null ||
    curl -fsS -o "$out" "$base/$enc/Default/3D/${low}_3d_default.png" ||
    { rm -f "$out"; echo "missing: $name"; }
done <<'LIST'
Face with tears of joy
Rolling on the floor laughing
Skull
Clown face
Moai
Pile of poo
Nerd face
Face with rolling eyes
Smiling face with sunglasses
Exploding head
Loudly crying face
Pleading face
Face screaming in fear
Thinking face
Zany face
Upside-down face
Face with monocle
Cowboy hat face
Hot face
Cold face
Woozy face
Sleeping face
Grimacing face
Face with hand over mouth
Shushing face
Smirking face
Unamused face
Pouting face
Face with symbols on mouth
Melting face
Face holding back tears
Saluting face
Face with peeking eye
Dotted line face
Ghost
Alien
Robot
Ogre
Fire
Hundred points
Thumbs up
Thumbs down
Clapping hands
Folded hands
Flexed biceps
Eyes
Brain
Goat
Crown
Trophy
Money bag
Rocket
Collision
Party popper
Video game
Red heart
Broken heart
Sparkles
Bomb
Chicken
LIST
curl -fsS https://unicode.org/Public/emoji/latest/emoji-test.txt | awk -F'#' '
  /^# group:/ { g=$0; sub(/^# group: /,"",g); next }
  /^[0-9A-F]/ && /; fully-qualified/ && !/skin tone/ {
    split($2, a, " "); e=a[1]; v=a[2]; sub(/^E/,"",v); if (v+0 > 15.0) next; n=$2; sub(/^ *[^ ]+ +E[0-9.]+ +/,"",n); print e "\t" n "\t" g
  }' > ui/emoji.txt
echo "stickers: $(ls ui/stickers | wc -l), emoji: $(wc -l < ui/emoji.txt)"
