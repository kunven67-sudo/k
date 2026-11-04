// Drive the game with real keyboard/mouse input. usage: node tools/play.cjs <url> <steps.cjs> <outdir> [w] [h]
// steps.cjs exports async (page, shot, log) => { ... }
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [url, stepsFile, outDir, w = 960, h = 540] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
  await ctx.grantPermissions(['microphone']);
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/Clock/.test(m.text()))) errs.push('[' + m.type() + '] ' + m.text()); if (m.text().startsWith('LOG')) console.log(m.text()); });
  p.on('pageerror', (e) => errs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await p.goto(url);
  await p.waitForFunction('window.__game && window.__game.frame > 2', null, { timeout: 180000 });
  let n = 0;
  const shot = async (name) => { await p.screenshot({ path: path.join(outDir, (++n) + '-' + name + '.png') }); };
  const log = async (expr) => { const r = await p.evaluate((x) => { const G = window.__game; return eval(x); }, expr); console.log(JSON.stringify(r)); return r; };
  try { await require(path.resolve(stepsFile))(p, shot, log); } catch (e) { errs.push('[step] ' + e.message); }
  console.log(errs.slice(0, 30).join('\n'));
  await b.close();
})();
