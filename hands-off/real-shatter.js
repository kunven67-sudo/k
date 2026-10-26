const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, 'real-test.html'));
  await p.waitForTimeout(1200);
  await p.evaluate(async () => { try { await document.fonts.load('900 40px Unbounded'); } catch (e) {} });
  await p.evaluate((q) => R.setQuality(q), process.env.Q || 'low');
  for (let i = 0; i < 400; i++) { const st = await p.evaluate(() => frame({}, null, 1)); if (st.ready || !st.ok) break; await p.waitForTimeout(100); }
  const num = await p.evaluate(() => ({ text: '421.6', cx: innerWidth / 2, cy: innerHeight * 0.465, size: Math.min(innerWidth * 0.16, 122 * Math.min(innerWidth, innerHeight * 1.7) / 1000), alpha: 1 }));
  await p.evaluate((num) => frame({ u_time: 12 }, num, 14), num);
  await p.screenshot({ path: path.join(__dirname, 'shots', 'sh-0.png'), timeout: 300000 });
  // a crack picture like the game makes, then break it
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
    const x = c.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.3;
    const ix = innerWidth * 0.62, iy = innerHeight * 0.4, angles = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + Math.random() * 0.3; angles.push(a); x.beginPath(); x.moveTo(ix, iy); x.lineTo(ix + Math.cos(a) * 400, iy + Math.sin(a) * 400); x.stroke(); }
    window.__shInfo = { w: innerWidth, h: innerHeight, ix, iy, angles, crackCanvas: c };
    R.shatterStart(window.__shInfo);
  });
  const shots = [0.06, 0.5, 1.3, 1.9, 2.3, 2.8, 3.25, 3.6];
  let t = 0, k = 0;
  while (k < shots.length) {
    t += 1 / 30;
    await p.evaluate(([t]) => frame({ u_time: 12 + t, u_shatterT: t, u_uiOn: t < 2.85 ? 0 : 1, u_rewind: t > 2.85 && t < 3.75 ? 1 : 0 }, null, 1), [t]);
    if (t >= shots[k]) { await p.screenshot({ path: path.join(__dirname, 'shots', 'sh-' + (k + 1) + '.png'), timeout: 300000 }); console.log('shot', k + 1, t.toFixed(2)); k++; }
  }
  console.log('errors', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
