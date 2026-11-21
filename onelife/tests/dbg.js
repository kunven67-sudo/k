const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(() => { document.querySelector('[data-act=begin]').click(); __ol.suit.limiter = false; __ol.S.logK = -4.6; });
  await p.waitForTimeout(15000);
  console.log(await p.evaluate(() => { const o = __ol; const C = o.scatter.classes; return { k: o.S.k, P: o.S.P, O: o.S.O, classes: C.map(c => [c.id, c.n, c.kMin, c.kMax, c.last && c.last.k].join('/')), cols: o.scatter.colliders.length, first: C.find(c => c.id === 7)?.meshes[0] && Array.from(C.find(c => c.id === 7).meshes[0].instanceMatrix.array.slice(0, 16)).map(v => +v.toPrecision(4)), macro: [o.S.k, o.camera.position.toArray()] }; }));
  await b.close();
})();
