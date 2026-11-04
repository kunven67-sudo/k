# VR tests (real WebXR session, emulated Quest 3)

Meta's IWER emulator stands in for a Quest 3 + Touch controllers inside headless Chromium, so the game runs a real
`immersive-vr` session and gets real controller input (grip, trigger, buttons, sticks, hand positions).

    cd shrinkworks/tools/vrtest
    npm i --no-save iwer@2.7.0 esbuild@0.28.2
    npx esbuild iwer-entry.js --bundle --format=iife --outfile=iwer-bundle.js
    cd ../.. && node tools/build.mjs --dev && node tools/serve.mjs 8150 &
    node tools/vrtest/smoke.mjs <folder for screenshots>

Software rendering is slow (a few frames per second), so a test takes minutes: run it in the background.
Keep screenshots out of the repo (pass a folder outside it).
