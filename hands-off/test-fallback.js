// No WebGL2 on this device: the game must fall back to the old renderer and still work. Run: node test-fallback.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  for (const mode of ['no-webgl2', 'no-float']) {
    const p = await b.newPage({ viewport: { width: 800, height: 450 } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); });
    await p.addInitScript((mode) => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) {
        if (t === 'webgl2' && mode === 'no-webgl2') return null;
        const c = orig.call(this, t, o);
        if (c && t === 'webgl2' && mode === 'no-float') { const ge = c.getExtension.bind(c); c.getExtension = (n) => (n === 'EXT_color_buffer_float' ? null : ge(n)); }
        return c;
      };
    }, mode);
    await p.goto('file://' + path.join(__dirname, 'dist', 'hands-off.html'));
    await p.waitForFunction(() => window.__HO_DEBUG && window.__HO_DEBUG.state === 'menu', null, { polling: 200, timeout: 60000 });
    await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({ glVisible: getComputedStyle(document.getElementById('gl')).visibility, canvases: document.querySelectorAll('canvas').length }));
    await p.click('#startBtn');
    await p.waitForFunction(() => window.__HO_DEBUG.state === 'live', null, { polling: 200, timeout: 30000 });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(__dirname, 'shots', 'fb-' + mode + '.png') });
    console.log(mode, JSON.stringify(st), 'errors:', errs.length ? errs.slice(0, 3) : 'none');
    await p.close();
  }
  await b.close();
})();
