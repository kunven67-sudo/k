const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 200, height: 120 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('[data-act=begin]').click()); await p.waitForTimeout(2000);
  for (const [lk, h] of [[0, 3], [0, 6], [-2.5, 2], [-2.5, 8], [-2.5, 15]]) {
    const r = await p.evaluate(([lk, h]) => new Promise(res => {
      const S = __ol.S; S.body.reset(); S.logK = lk; S.k = Math.pow(10, lk); const bh = 1.8 * S.k;
      const g = __ol.land.height(S.P.x, S.P.z, bh / 17); S.P.y = g + h * bh; S.peakY = S.P.y; S.onGround = false; S.vyBH = 0;
      const t0 = performance.now(), t0g = S.t; let maxV = 0;
      const tick = () => { maxV = Math.max(maxV, -S.vyBH); if (S.onGround || S.t - t0g > 30) res({ size: lk, heightBH: h, fallTime: (S.t - t0g).toFixed(2) + 's', maxSpeedBHps: maxV.toFixed(1), health: S.body.health.toFixed(0), legs: [S.body.hp.legL.toFixed(0), S.body.hp.legR.toFixed(0)], broken: S.body.legs, dead: S.body.dead, cause: S.body.cause }); else setTimeout(tick, 50); };
      tick();
    }), [lk, h]);
    console.log(JSON.stringify(r));
  }
  await b.close();
})();
