// Linux preview shots + click test: node tests/shots.js <outdir> <scale>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const BIN = process.env.SG_BIN;
const out = process.argv[2] || '.';
const scale = +(process.argv[3] || 1);
let port = 8790;
function start(scen) {
  return new Promise((res, rej) => {
    const p = spawn(BIN, ['-port', String(++port), '-scenario', scen]);
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; const lines = buf.split('\n').filter(Boolean); if (lines.length >= (scen === 'popup' ? 2 : 1)) res({ p, urls: lines }); });
    p.stderr.on('data', (d) => { if (process.env.V) process.stderr.write(d); });
    setTimeout(() => rej(new Error('no url ' + scen)), 8000);
  });
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function shot(scen, file, opts = {}) {
    const { p, urls } = await start(scen);
    const w = opts.w || 1180, h = opts.h || 760;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    page.on('pageerror', (e) => errors.push(scen + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(scen + ' console: ' + m.text()); });
    await page.goto(opts.popup ? urls[1] : urls[0]);
    await page.waitForTimeout(opts.wait || 7000);
    if (opts.before) await opts.before(page);
    await page.screenshot({ path: path.join(out, file) });
    await page.close();
    p.kill();
  }
  await shot('fixed', '1-home.png', { before: async (pg) => { await pg.waitForTimeout(400); } });
  await shot('micmissing', '2-mic-not-detected.png', { wait: 9000 });
  await shot('restart', '3-restart-needed.png');
  await shot('popup', '4-restart-popup.png', { popup: true, w: 440, h: 196 });
  await shot('ok', '5-fix-for-good.png', { before: async (pg) => { await pg.click('[data-tab=forever]'); await pg.click('#drvBtn'); await pg.waitForTimeout(3600); } });
  await shot('ok', '6-settings.png', { before: async (pg) => { await pg.click('[data-tab=settings]'); await pg.waitForTimeout(500); } });
  await shot('setup', '7-first-run.png', { wait: 7000 });
  await shot('ok', '8-mic-test.png', { before: async (pg) => { await pg.click('#micTestBtn'); await pg.waitForTimeout(1700); } });
  await shot('ok', '9-sound-test.png', { before: async (pg) => { await pg.click('#soundTestBtn'); await pg.waitForTimeout(2600); } });
  await shot('muted', '10-muted-fixed.png', { wait: 3000 });
  await shot('usb', '11-usb.png');
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('shots ok');
})().catch((e) => { console.error(e); process.exit(1); });
