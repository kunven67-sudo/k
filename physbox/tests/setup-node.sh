#!/bin/sh
# Lets Node resolve the same bare imports the browser import map provides ('three', 'three/addons/...', 'rapier').
cd "$(dirname "$0")/.." || exit 1
mkdir -p node_modules
ln -sfn ../js/vendor/three node_modules/three
ln -sfn ../js/vendor/rapier node_modules/rapier
echo "node_modules links ready"
