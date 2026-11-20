const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(() => {
    const { G, THREE, S } = __ol; document.querySelector('[data-act=begin]').click();
    __ol.scatter.classes.forEach(c => c.meshes.forEach(m => m.visible = false));
    const names = ['rocks', 'log', 'stump', 'bark', 'boulder', 'dandelion', 'nettle', 'grassb'];
    names.forEach((n, i) => { const o = G[n].scene.clone(); const bb = new THREE.Box3().setFromObject(o); const sz = bb.getSize(new THREE.Vector3()); const s = 1.6 / Math.max(sz.x, sz.y, sz.z); o.scale.setScalar(s); o.position.set((i - 3.5) * 1.9, 0.2, -2); __ol.camera.parent || 0; window.__scene = __ol.camera; __ol.renderer.domElement && 0; __ol.S.camYaw = 0; __ol.S.camPitch = 0.1; __ol.S.camDist = 9; __ol.extra = (__ol.extra || []).concat(o); });
  });
  await p.evaluate(() => { const sc = __ol.deep.group.parent; __ol.extra.forEach(o => sc.add(o)); });
  await p.waitForTimeout(15000);
  await p.screenshot({ path: process.argv[2], timeout: 180000 });
  await b.close();
})();
