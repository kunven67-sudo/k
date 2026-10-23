const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const HO = require('./src/core.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader'] });
  for (const secs of [30, 7200]) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await ctx.newPage();
    const now = Date.now(); const s = HO.newSave(now); const r = HO.newRun(now - secs * 1000); HO.step(r, secs); s.run = r; s.savedAt = now; s.rec.runs = 2;
    await p.addInitScript((v) => { if (!sessionStorage.getItem('x')) { localStorage.setItem('handsoff.save.v1', v); sessionStorage.setItem('x', 1); } }, HO.serialize(s));
    await p.goto('file://' + path.join(__dirname, 'dist', 'hands-off.html'));
    await p.click('#startBtn');
    await p.waitForFunction(() => window.__HO_DEBUG.state === 'live', null, { timeout: 60000 });
    await sleep(15000); // let temptations / ring / particles fill up
    await p.evaluate(() => { const q = window.__HO_DEBUG.perf; q.hud = q.gl = q.n = 0; });
    await sleep(8000);
    const q = await p.evaluate(() => ({ ...window.__HO_DEBUG.perf, items: window.__HO_DEBUG.tempt.items.length }));
    console.log(secs + 's run @1080p: frames', q.n, '| HUD draw avg', (q.hud / q.n).toFixed(2), 'ms | upload+GL submit avg', (q.gl / q.n).toFixed(2), 'ms (software GPU) | temptations', q.items);
    await ctx.close();
  }
  await b.close();
})();
