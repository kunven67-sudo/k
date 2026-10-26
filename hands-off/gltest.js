const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, 'gltest.html'));
  const st = await p.evaluate(() => ({ ok: glr.ok, err: glr.error }));
  console.log('renderer', st);
  if (!st.ok) { await b.close(); process.exit(1); }
  const cases = {
    chrome: { u_mix: [1, 0.15, 0.0], u_time: 4 },
    hole: { u_mix: [0, 0, 1], u_time: 6, u_still: 0.6 },
    glitch: { u_mix: [0, 1, 0], u_time: 2, u_glitch: 0.6 },
    all: { u_mix: [1, 1, 1], u_time: 9, u_still: 1, u_glitch: 0.35, u_folds: 0 },
    kaleido: { u_mix: [0.8, 0.4, 0.6], u_folds: 6, u_hue: 0.4, u_still: 1.2, u_time: 20 },
    shock: { u_mix: [1, 0.3, 0.8], u_shock: [0.5, 0.5, 0.35], u_pulse: 0.8, u_flash: 0.15, u_flashCol: [1, 0.8, 0.4] },
    rewind: { u_mix: [1, 0.3, 0.8], u_rewind: 1, u_glitch: 0.5 },
    flip: { u_mix: [0.6, 0.6, 1], u_flip: 0.5, u_melt: 0.6 },
  };
  for (const [name, u] of Object.entries(cases)) {
    const t0 = Date.now();
    await p.evaluate(([u]) => frame(u), [u]);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    await p.screenshot({ path: path.join(__dirname, 'shots', 'gl-' + name + '.png') });
    console.log(name, (Date.now() - t0) + 'ms');
  }
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
