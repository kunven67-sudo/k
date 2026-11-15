#!/bin/sh
# Build REGEN.exe (Windows) + zip: sh tools/pack.sh <version> <outdir>
set -e
cd "$(dirname "$0")/.."
V=${1:-1.0.0}; OUT=${2:-dist}
node tools/build.mjs
rm -rf tools/launcher/site && mkdir -p tools/launcher/site/assets
cp index.html game.js tools/launcher/site/ && cp -r gs3kit tools/launcher/site/
cp -r assets/models assets/tex assets/snd assets/thumbs tools/launcher/site/assets/
(cd tools/launcher && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o ../../REGEN.exe .)
mkdir -p "$OUT" && rm -f "$OUT/REGEN-$V.zip"
zip -q -j "$OUT/REGEN-$V.zip" REGEN.exe
rm -rf tools/launcher/site REGEN.exe
ls -la "$OUT/REGEN-$V.zip"
