const { chromium } = require('playwright');
(async () => {
  const [out, vis] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(() => { document.querySelector('[data-act=begin]').click(); __ol.S.camPitch = 0.35; __ol.S.camDist = 9; });
  await p.waitForTimeout(6000);
  await p.evaluate(v => { const show = v.split(',').map(Number); __ol.scatter.classes.forEach(c => c.meshes.forEach((m, i) => { m.visible = show.includes(c.id); m.userData.vi = i; })); }, vis);
  await p.waitForTimeout(9000);
  console.log(await p.evaluate(() => __ol.scatter.classes.filter(c => c.id === 1)[0].meshes.map((m, i) => i + ':' + m.count + ':' + m.geometry.boundingBox.getSize(new __ol.THREE.Vector3()).toArray().map(v => v.toFixed(1)).join('x')).join(' ')));
  await p.screenshot({ path: out, timeout: 180000 });
  await b.close();
})();
