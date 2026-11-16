#!/bin/sh
# Builds ui/device.js (three.js + the 3D rack unit) from ui/src/device.mjs.
# Needs node. Usage: sh tools/build-ui.sh [node_modules dir with three@0.170.0 + esbuild@0.24.0]
set -e
cd "$(dirname "$0")/.."
NM="${1:-/tmp/sg-uibuild/node_modules}"
if [ ! -d "$NM/three" ]; then
  mkdir -p "$(dirname "$NM")" && (cd "$(dirname "$NM")" && npm init -y >/dev/null && npm i -s three@0.170.0 esbuild@0.24.0)
fi
NODE_PATH="$NM" "$NM/.bin/esbuild" ui/src/device.mjs --bundle --minify --format=iife --global-name=SGDevice \
  --target=chrome110 --legal-comments=none --outfile=ui/device.js --alias:three="$NM/three"
ls -la ui/device.js
