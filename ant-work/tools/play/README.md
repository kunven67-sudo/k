# Play harness (Ant Work 3 / 4 / 5)

One live game window you can drive from the command line, to play-test the games without a person at the keyboard.

1. Build the game first: `cd ant-work/aw5 && node build.js` (same for aw3, aw4).
2. Start the harness: `node ant-work/tools/play/server.js` (needs Playwright + Chromium). It listens on `localhost:7777`.
3. Open a game at a checkpoint: `curl "localhost:7777/open?game=aw5&cp=white&speed=1&preset=high&shot=0"`
4. Drive it with the scripts here (`go.sh`, `walkto.sh`, `lookE.sh`, `talk.sh`, `choose.sh`, `shoot2.sh`, `fight2.sh` ...)
   or run code in the page: `curl --get localhost:7777/eval --data-urlencode "js=..."`.
5. Every command saves the current frame to `view.png` next to `server.js`. Page errors are printed as `PAGE ERROR` in the server output.

Note: this harness renders with a software renderer (2-3 frames a second), so fights and anything timing-based play
much harder here than on a real graphics card. Test timing and difficulty on a real PC, never tune it from this harness.
