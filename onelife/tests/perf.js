const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  const probe = async (label) => console.log(label, await p.evaluate(() => new Promise(r => { const i = __ol.renderer.info; let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else r({ fps: (n / 4).toFixed(1), js: __ol.prof.js.toFixed(1), gpu: __ol.prof.gpu.toFixed(1), calls: i.render.calls, tris: i.render.triangles, inst: __ol.scatter.classes.map(c => c.id + ':' + c.n).join(' '), levels: __ol.terrain.levels.filter(l => l.active).length }); }; requestAnimationFrame(f); })));
  await probe('menu');
  await p.evaluate(() => document.querySelector('[data-act=begin]').click()); await p.waitForTimeout(3000);
  await probe('play k=1');
  for (const lk of process.argv.slice(2)) { await p.evaluate(v => __ol.S.logK = +v, lk); await p.waitForTimeout(4000); await probe('logK ' + lk); }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
