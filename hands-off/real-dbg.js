// usage: node real-dbg.js name 'js to run before' [world]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, 'real-test.html'));
  await p.waitForTimeout(1200);
  console.log('font', await p.evaluate(async () => { try { await document.fonts.load('900 40px Unbounded'); } catch (e) {} return document.fonts.check('900 40px Unbounded'); }));
  await p.evaluate((q) => R.setQuality(q), process.env.Q || 'low');
  for (let i = 0; i < 400; i++) { const st = await p.evaluate(() => frame({}, null, 1)); if (st.ready || !st.ok) break; await p.waitForTimeout(100); }
  const runs = JSON.parse(process.argv[2]);
  for (const r of runs) {
    await p.evaluate((code) => eval(code), r.pre || '');
    const res = await p.evaluate((r) => frame(Object.assign({ u_world: r.w || 0, u_time: r.t || 12 }, r.u || {}), r.num === false ? null : { text: r.text || '421.6', cx: innerWidth / 2, cy: innerHeight * 0.465, size: Math.min(innerWidth * 0.16, 122 * Math.min(innerWidth, innerHeight * 1.7) / 1000), alpha: 1, mode: r.mode }, r.n || 8), r);
    await p.screenshot({ path: path.join(__dirname, 'shots', 'dbg-' + r.name + '.png'), timeout: 300000 });
    console.log(r.name, JSON.stringify(res));
  }
  console.log('errors', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
