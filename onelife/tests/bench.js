const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(() => { document.querySelector('[data-act=begin]').click(); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })));
  await p.waitForTimeout(4000);
  await p.screenshot({ path: out + '/b0.png', timeout: 180000 });
  // click helper: point the tool at an object and use it
  const act = (sel, tool) => p.evaluate(([sel, tool]) => {
    const B = __ol.bench; B.pick(tool); B.frame(0.016);
    let target = null; B.mod.traverse(o => { if (!target && o.isMesh && eval(sel)) target = o; });
    if (!target) return 'no target ' + sel;
    target.geometry.computeBoundingSphere(); const v = target.geometry.boundingSphere.center.clone().applyMatrix4(target.matrixWorld); if (target.userData.part && target.userData.part.startsWith('wire')) { const g = target.parent.userData.blob; g.getWorldPosition(v); } v.project(B.cam); B.mouse.set(v.x, v.y); B.use();
    return document.querySelector('#benchMsg').textContent + ' | battery=' + B.state.battery + ' limiter=' + B.state.limiter + ' oc=' + B.state.oc + ' shrinkWire=' + B.state.shrinkWire + ' hp armR=' + __ol.S.body.hp.armR.toFixed(0);
  }, [sel, tool]);
  const screwSel = i => `o.parent && o.parent.userData && o.parent.userData.group === 'cover' && o.parent.userData.in && o.geometry.type === 'CylinderGeometry'`;
  for (let i = 0; i < 4; i++) console.log('cover screw', await act(screwSel(i), 'driver'));
  console.log('cut live wire', await act(`o.userData.part === 'wire:shrink' && o.visible`, 'pliers'));
  console.log('meter battery', await act(`o.userData.part === 'battery'`, 'meter'));
  for (let i = 0; i < 2; i++) console.log('clamp screw', await act(`o.parent && o.parent.userData && o.parent.userData.group === 'clamp' && o.parent.userData.in && o.geometry.type === 'CylinderGeometry'`, 'driver'));
  console.log('pull limiter', await act(`o.userData.part === 'chip'`, 'pliers'));
  console.log('bridge oc', await act(`o.userData.part === 'oc'`, 'iron'));
  console.log('solder wire', await act(`o.userData.part === 'wire:shrink' && o.visible`, 'iron'));
  await p.evaluate(() => { __ol.bench.rotX = 0.9; __ol.bench.dist = 0.45; }); await p.waitForTimeout(3000);
  await p.screenshot({ path: out + '/b1.png', timeout: 180000 });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
