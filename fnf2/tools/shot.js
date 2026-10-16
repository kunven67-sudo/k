#!/usr/bin/env node
// Screenshot + error check helper (headless Chromium via Playwright).
//   node tools/shot.js --html fnf2/fnf2.html --query "dev=char&id=ace" --wait 1500 --out /tmp/a.png
// Options:
//   --html <file>        page to load (default fnf2/fnf2.html)
//   --query <qs>         query string without '?'
//   --wait <ms>          wait before the first shot (default 1200)
//   --out <png>          output path (with --frames N, _0,_1.. are added)
//   --frames <n> --interval <ms>   take several shots
//   --keys "Enter,ArrowDown:200,..."  key presses after load (code[:delayAfterMs])
//   --eval "<js>"        run JS in the page after load (before keys)
//   --size 1280x720      viewport size (use 844x390 for a phone in landscape)
//   --touch              emulate a touch phone
// Always prints console errors + G.errors at the end. Exit code 2 if there were errors.
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const has = n => args.includes('--' + n);
(async () => {
  const html = path.resolve(opt('html', path.join(__dirname, '..', 'fnf2.html')));
  const q = opt('query', '');
  const size = (opt('size', '1280x720')).split('x').map(Number);
  const out = opt('out', '/tmp/fnf2-shot.png');
  const frames = +opt('frames', 1), interval = +opt('interval', 400), wait = +opt('wait', 1200);
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, hasTouch: has('touch'), isMobile: has('touch'), deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('[' + m.type() + '] ' + m.text()); });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.goto('file://' + html + (q ? '?' + q : ''));
  await page.waitForTimeout(300);
  const ev = opt('eval', null);
  if (ev) { try { const r = await page.evaluate(ev); if (r !== undefined) console.log('eval ->', JSON.stringify(r)); } catch (e) { errs.push('[eval] ' + e.message); } }
  const keys = opt('keys', '');
  if (keys) for (const k of keys.split(',')) {
    const [code, d] = k.split(':');
    await page.keyboard.press(code.trim());
    await page.waitForTimeout(d ? +d : 150);
  }
  await page.waitForTimeout(wait);
  for (let i = 0; i < frames; i++) {
    const p = frames > 1 ? out.replace(/\.png$/, '_' + i + '.png') : out;
    await page.screenshot({ path: p });
    console.log('shot', p);
    if (i < frames - 1) await page.waitForTimeout(interval);
  }
  const gErr = await page.evaluate(() => (window.G && G.errors ? G.errors.map(e => e.msg) : [])).catch(() => []);
  await browser.close();
  const all = errs.concat(gErr.map(m => '[G] ' + m));
  if (all.length) { console.log('ERRORS:\n' + all.join('\n')); process.exitCode = 2; } else console.log('no errors');
})();
