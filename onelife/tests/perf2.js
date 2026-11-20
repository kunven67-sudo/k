const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('[data-act=begin]').click()); await p.waitForTimeout(2000);
  const probe = async (label) => console.log(label, await p.evaluate(() => new Promise(r => { const d = []; let last = performance.now(); const f = () => { const n = performance.now(); d.push(n - last); last = n; if (d.length < 8) requestAnimationFrame(f); else r({ intervals: d.map(x => x.toFixed(0)).join(','), js: __ol.prof.js.toFixed(1), gpu: __ol.prof.gpu.toFixed(1) }); }; requestAnimationFrame(f); })));
  await probe('base');
  await p.evaluate(() => { __ol.renderer.shadowMap.enabled = false; __ol.renderer.compile && 0; }); await p.waitForTimeout(3000); await probe('no shadows');
  await p.evaluate(() => { __ol.scatter.classes.forEach(c => c.meshes.forEach(m => m.visible = false)); }); await p.waitForTimeout(2000); await probe('no props');
  await p.evaluate(() => { __ol.terrain.levels.forEach(l => l.mesh.material.visible = false); }); await p.waitForTimeout(2000); await probe('no terrain');
  await b.close();
})();
