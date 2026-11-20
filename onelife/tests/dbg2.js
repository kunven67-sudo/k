const { chromium } = require('playwright');
(async () => {
  const [lk, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(v => { document.querySelector('[data-act=begin]').click(); __ol.suit.limiter = false; __ol.S.logK = +v; }, lk);
  await p.waitForTimeout(16000);
  console.log(await p.evaluate(() => { const o = __ol, S = o.S, k = S.k; const g = o.land.height(S.P.x, S.P.z, 1.8 * k / 17); const t = o.scatter.topAt(S.P.x, S.P.z); return { k, BH: 1.8 * k, playerAboveGroundBH: (S.P.y - g) / (1.8 * k), propTopBH: (t.top - g) / (1.8 * k), onGround: S.onGround, cam: o.camera.position.toArray().map(v => +v.toFixed(2)), n: o.scatter.classes.map(c => c.id + ':' + c.n).join(' '), fog: o.S.deep, levels: o.terrain.levels.filter(l => l.active).map(l => l.built ? 1 : 0).join('') }; }));
  await p.screenshot({ path: out, timeout: 180000 });
  await b.close();
})();
