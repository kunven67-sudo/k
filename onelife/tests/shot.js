// node tests/shot.js <outdir> "<js to run>@ms" ...   (screenshots after each step)
const { chromium } = require('playwright');
(async () => {
  const [out, ...steps] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await p.goto('http://localhost:8790/index.html?test');
  await p.waitForFunction(() => window.__ol, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  require('fs').mkdirSync(out, { recursive: true });
  let i = 0;
  for (const st of ['0@100', ...steps]) {
    const at = st.lastIndexOf('@'); const js = st.slice(0, at), ms = +st.slice(at + 1);
    try { const r = await p.evaluate(js); if (r !== undefined && r !== 0) console.log('step', i, '->', JSON.stringify(r).slice(0, 400)); } catch (e) { console.log('step', i, 'ERR', e.message.slice(0, 300)); }
    await p.waitForTimeout(ms);
    await p.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.png`, timeout: 180000 }); i++;
  }
  console.log([...new Set(errs)].slice(0, 25).join('\n') || 'no errors');
  await b.close();
})();
