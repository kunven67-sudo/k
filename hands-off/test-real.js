// The game with the real (WebGL2) renderer: boot, live, milestone, world dive, 3D shatter reset. Run: node test-real.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const HO = require('./src/core.js');
const FILE = 'file://' + path.join(__dirname, 'dist', 'hands-off.html');
const SHOTS = path.join(__dirname, 'shots');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Q = process.env.Q || 'low';
function seeded(level, extra) {
  const now = Date.now();
  const s = HO.newSave(now - 60000);
  s.set.quality = Q;
  if (level !== null) {
    const r = HO.newRun(now - 1000);
    // walk the run up to the wanted level
    let guard = 0;
    while (r.level < level && guard++ < 100000) HO.step(r, 0.25);
    s.run = r; s.savedAt = now; s.rec.runs = 2; s.rec.bestTime = r.t;
  }
  Object.assign(s, extra || {});
  return HO.serialize(s);
}
async function open(browser, save, vp, phone) {
  const ctx = await browser.newContext(phone ? { viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: vp || { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('handsoff.save.v1', s); localStorage.setItem('handsoff.real.v1', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
  await page.goto(FILE);
  await page.waitForFunction(() => window.__HO_DEBUG && window.__HO_DEBUG.state !== 'boot', null, { polling: 200, timeout: 60000 });
  return { ctx, page, errs };
}
const wf = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { polling: 150, timeout: ms || 30000 });
const waitState = (page, s, ms) => wf(page, (s) => window.__HO_DEBUG.state === s, s, ms);
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, 'r-' + n + '.png'), timeout: 300000 });

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  console.log('-- real renderer: boot + live + milestone');
  {
    const { page, errs, ctx } = await open(browser, seeded(null));
    const info = await page.evaluate(() => ({ real: !!window.__HO_DEBUG.R.real, ok: window.__HO_DEBUG.R.ok, err: window.__HO_DEBUG.R.error }));
    ok(info.real && info.ok, 'real renderer is up: ' + JSON.stringify(info));
    await wf(page, () => window.__HO_DEBUG.R.ready, null, 120000);
    ok(true, 'shaders ready');
    await sleep(1500);
    await shot(page, 'menu');
    await page.click('#startBtn');
    await waitState(page, 'arming', 10000);
    await waitState(page, 'live', 60000);
    ok(true, 'arming -> live');
    await wf(page, () => window.__HO_DEBUG.save.run && window.__HO_DEBUG.save.run.maxTier >= 1, null, 60000);
    await sleep(300);
    await shot(page, 'milestone');
    ok(await page.evaluate(() => window.__HO_DEBUG.R.debug.NUM.slots.length > 0), '3D number has drums');
    await wf(page, () => window.__HO_DEBUG.save.run.t > 8, null, 90000);
    await shot(page, 'live');
    // reset: move the mouse
    await page.mouse.move(600, 260); await page.mouse.move(640, 280);
    await waitState(page, 'pending', 15000);
    ok(true, 'mouse -> pending');
    await waitState(page, 'reset', 20000);
    ok(await page.evaluate(() => !!(window.__HO_DEBUG.rs && window.__HO_DEBUG.rs.real)), 'reset uses the real 3D shatter');
    ok(await page.evaluate(() => window.__HO_DEBUG.R.shattering()), 'glass is in pieces');
    for (const [t, n] of [[0.8, 'shatter-slowmo'], [2.35, 'shatter-floor'], [3.2, 'shatter-rewind'], [4.6, 'roast']]) {
      await wf(page, (t) => window.__HO_DEBUG.rs && window.__HO_DEBUG.rs.t >= t, t, 120000);
      await shot(page, n);
    }
    await waitState(page, 'arming', 120000);
    ok(await page.evaluate(() => !window.__HO_DEBUG.R.shattering()), 'shatter cleaned up after the reset');
    ok(errs.length === 0, 'no errors: ' + errs.slice(0, 4).join(' | '));
    await ctx.close();
  }
  if (process.env.ONLY !== 'pc') {
    console.log('-- real renderer: phone (390x844 touch)');
    const { page, errs, ctx } = await open(browser, seeded(null, { set: Object.assign(HO.newSave(0).set, { quality: 'auto' }) }), { width: 390, height: 844 }, true);
    await wf(page, () => window.__HO_DEBUG.R.ready, null, 120000);
    await page.tap('#startBtn');
    await waitState(page, 'live', 60000);
    await wf(page, () => window.__HO_DEBUG.save.run.t > 6, null, 90000);
    await shot(page, 'phone-live');
    await page.touchscreen.tap(200, 500);
    await waitState(page, 'reset', 20000);
    await wf(page, () => window.__HO_DEBUG.rs && window.__HO_DEBUG.rs.t >= 0.9, null, 60000);
    await shot(page, 'phone-shatter');
    await waitState(page, 'arming', 120000);
    ok(errs.length === 0, 'phone: no errors: ' + errs.slice(0, 4).join(' | '));
    await ctx.close();
  }
  console.log('-- real renderer: world change dive');
  {
    const { page, errs, ctx } = await open(browser, seeded(19));
    await wf(page, () => window.__HO_DEBUG.R.ready, null, 120000);
    await page.click('#startBtn');
    await waitState(page, 'live', 60000);
    await wf(page, () => window.__HO_DEBUG.R.diving(), null, 120000);
    ok(true, 'world change starts a dive');
    await sleep(700); await shot(page, 'dive-in');
    await wf(page, () => window.__HO_DEBUG.R.debug.dive.swapped, null, 60000);
    await shot(page, 'dive-out');
    await wf(page, () => !window.__HO_DEBUG.R.diving(), null, 60000);
    ok(await page.evaluate(() => window.__HO_DEBUG.R.debug.world === 1), 'arrived in world 2');
    await sleep(500); await shot(page, 'world2');
    ok(errs.length === 0, 'no errors: ' + errs.slice(0, 4).join(' | '));
    await ctx.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  FAIL threw:', e.message.split('\n')[0]); console.log(pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
