// usage: node tools/shot.cjs <url> <out.png> [w] [h] [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 900, h = 900, wait = 120000] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', m => console.log('[page]', m.text()));
  p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto(url);
  await p.waitForFunction('window.DONE === true', null, { timeout: +wait });
  await p.screenshot({ path: out });
  await b.close();
})();
