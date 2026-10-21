const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const HO = require('./src/core.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  // a run a few seconds before world 4
  const now = Date.now(); const s = HO.newSave(now); const r = HO.newRun(now);
  while (r.level < 79 || r.lp < 0.2) HO.step(r, 0.05);
  r.start = now - r.t * 1000; s.run = r; s.savedAt = now; s.rec.runs = 2; s.rec.bestTime = 9999;
  await p.addInitScript((v) => { if (!sessionStorage.getItem('x')) { localStorage.setItem('handsoff.save.v1', v); sessionStorage.setItem('x', 1); } }, HO.serialize(s));
  await p.goto('file://' + path.join(__dirname, 'dist', 'hands-off.html'));
  await p.click('#startBtn');
  await p.waitForFunction(() => window.__HO_DEBUG.state === 'live', null, { timeout: 30000 });
  await p.waitForFunction(() => window.__HO_DEBUG.sweep && window.__HO_DEBUG.sweep.t > 0.9, null, { timeout: 30000 });
  await p.screenshot({ path: 'shots/v-world-sweep.png' });
  await sleep(4000);
  await p.evaluate(() => { const e = performance.now() + 6000; while (performance.now() < e) {} });
  await p.waitForFunction(() => window.__HO_DEBUG.state === 'arming', null, { timeout: 5000 });
  await sleep(600);
  console.log('welcome', await p.evaluate(() => JSON.stringify(window.__HO_DEBUG.welcome)), 'state', await p.evaluate(() => window.__HO_DEBUG.state));
  await p.screenshot({ path: 'shots/v-welcome.png' });
  await b.close();
})();
