# Testing Physbox

- Serve the folder: `npx http-server -p 8770 -s -c-1 .` (from `physbox/`), open http://localhost:8770/.
- Lint: `npx eslint js` (from `physbox/`).
- Node: run `sh tests/setup-node.sh` once so bare imports (`three`, `three/addons/...`, `rapier`) resolve in Node.
  Rapier works in Node too (`await RAPIER.init()`), so physics can be tested without a browser.
- Pure logic (ephemeris, height functions, materials…): write Node scripts in `tests/` that import the modules
  directly (`node tests/xxx.test.mjs`). Node has no `DecompressionStream`-free path issue: use `zlib.inflateSync`
  on `data/*.bin` to get the grids.
- Browser tests: Playwright is installed at `/opt/node22/lib/node_modules/playwright/index.mjs`. Launch Chromium with
  `args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']`.
  The sandbox renders with SwiftShader at only ~1–2 fps: use `waitUntil: 'domcontentloaded'`, long timeouts
  (`page.screenshot({ timeout: 180000 })`), and small viewports (e.g. 800×450).
- Write throwaway test pages under `tests/` (e.g. `tests/terrain-view.html`) that import modules through the same
  import map as `index.html` but with `../js/...` paths. Keep useful ones; delete scratch ones.
