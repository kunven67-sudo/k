// usage: node tools/smoke.cjs <url> <out.png> [w] [h] [ms]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1280, h = 720, ms = 6000] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push('[' + m.type() + '] ' + m.text()); });
  p.on('pageerror', (e) => errs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await p.goto(url);
  try { await p.waitForFunction('window.__game && window.__game.frame > 5', null, { timeout: 120000 }); } catch (e) { errs.push('never started: ' + e.message); }
  await p.waitForTimeout(+ms);
  await p.screenshot({ path: out });
  const expr = process.argv[7] || '({ frame: G.frame, t: G.t, ents: G.entities.size })';
  const info = await p.evaluate((x) => { const G = window.__game; return G ? eval(x) : null; }, expr);
  console.log(JSON.stringify(info));
  console.log(errs.slice(0, 30).join('\n'));
  await b.close();
})();
