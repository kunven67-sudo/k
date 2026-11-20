#!/bin/sh
# Build ONE-LIFE.exe (Windows) + zip: sh tools/pack.sh <version> <outdir>
set -e
cd "$(dirname "$0")/.."
V=${1:-0.1.0}; OUT=${2:-dist}
node tools/build.mjs
rm -rf tools/launcher/site && mkdir -p tools/launcher/site
cp index.html game.js tools/launcher/site/ && cp -r assets tools/launcher/site/
(cd tools/launcher && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o ../../ONE-LIFE.exe .)
mkdir -p "$OUT" && rm -f "$OUT/ONE-LIFE-$V.zip"
zip -q -j "$OUT/ONE-LIFE-$V.zip" ONE-LIFE.exe
rm -rf tools/launcher/site ONE-LIFE.exe
ls -la "$OUT/ONE-LIFE-$V.zip"
