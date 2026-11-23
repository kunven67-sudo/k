#!/bin/sh
# Build LEVEL0.exe (Windows) + zip: sh tools/pack.sh <version> <outdir>
set -e
cd "$(dirname "$0")/.."
V=${1:-1.0.0}; OUT=${2:-dist}
node tools/build.mjs
rm -rf tools/launcher/site && mkdir -p tools/launcher/site
cp index.html game.js worker.js CREDITS.txt tools/launcher/site/ && cp -r assets tools/launcher/site/
(cd tools/launcher && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o "../../LEVEL 0.exe" .)
mkdir -p "$OUT" && rm -f "$OUT/LEVEL-0-$V.zip"
zip -q -j "$OUT/LEVEL-0-$V.zip" "LEVEL 0.exe"
rm -rf tools/launcher/site "LEVEL 0.exe"
ls -la "$OUT/LEVEL-0-$V.zip"
