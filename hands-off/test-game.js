// Browser test for dist/hands-off.html. Run: node test-game.js [scenario]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const HO = require('./src/core.js');

const FILE = 'file://' + path.join(__dirname, 'dist', 'hands-off.html');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: opts.dpr || 1, hasTouch: !!opts.touch, isMobile: !!opts.mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push('console: ' + m.text()); });
  if (opts.save) await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('handsoff.save.v1', s); sessionStorage.setItem('seeded', '1'); } }, opts.save);
  await page.goto(FILE);
  await page.waitForFunction(() => window.__HO_DEBUG && window.__HO_DEBUG.state !== 'boot');
  return { ctx, page, errs };
}
const st = (page) => page.evaluate(() => window.__HO_DEBUG.state);
async function waitState(page, s, ms = 20000) {
  await page.waitForFunction((s) => window.__HO_DEBUG.state === s, s, { timeout: ms });
}
async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

function seededSave(runSecs, extra) {
  const now = Date.now();
  const s = HO.newSave(now - runSecs * 1000 - 1000);
  const r = HO.newRun(now - runSecs * 1000);
  HO.step(r, runSecs);
  s.run = r; s.savedAt = now; s.rec.runs = 3; s.rec.resets = 2; s.rec.bestTime = runSecs; s.rec.bestLog = r.maxLog; s.rec.bestLevel = r.level;
  Object.assign(s, extra || {});
  return HO.serialize(s);
}

async function basic(browser) {
  console.log('-- basic flow');
  const { ctx, page, errs } = await open(browser);
  ok(await st(page) === 'menu', 'boots to the menu');
  ok(await page.evaluate(() => document.hasFocus()), 'page has focus in the test browser');
  await shot(page, 'g-menu');
  await page.click('#startBtn');
  ok(await st(page) === 'arming', 'START -> arming');
  await page.mouse.move(700, 400); await page.mouse.move(720, 410);
  await sleep(300);
  ok(await page.evaluate(() => window.__HO_DEBUG.state) === 'arming', 'moving during arming does not reset');
  await shot(page, 'g-arming');
  await waitState(page, 'live');
  ok(true, 'arming -> live after holding still');
  await sleep(5000);
  const r1 = await page.evaluate(() => ({ t: window.__HO_DEBUG.save.run.t, lvl: window.__HO_DEBUG.save.run.level, ups: window.__HO_DEBUG.save.run.ups }));
  ok(r1.t > 3 && r1.lvl > 1 && r1.ups > 0, 'run is going: ' + JSON.stringify(r1));
  await shot(page, 'g-live');
  // touch the mouse -> crack -> shatter -> rewind -> roast -> arming again
  await page.mouse.move(760, 430);
  await page.waitForFunction(() => window.__HO_DEBUG.state === 'pending', null, { timeout: 3000 });
  ok(true, 'mouse move -> pending (crack)');
  await shot(page, 'g-pending');
  await waitState(page, 'reset', 3000);
  ok(await page.evaluate(() => window.__HO_DEBUG.save.run === null), 'run wiped on reset');
  ok(await page.evaluate(() => !!window.__HO_DEBUG.save.tro.reset1), 'trophy: WHY WOULD YOU DO SOMETHING?');
  await sleep(250); await shot(page, 'g-reset-shatter');
  await sleep(900); await shot(page, 'g-reset-rewind');
  await page.waitForFunction(() => window.__HO_DEBUG.rs && window.__HO_DEBUG.rs.t > 3.2, null, { timeout: 15000 });
  await shot(page, 'g-reset-roast');
  await waitState(page, 'arming', 15000);
  ok(true, 'reset -> straight back to arming');
  await waitState(page, 'live');
  // keyboard
  await sleep(1500);
  await page.keyboard.press('a');
  await waitState(page, 'reset', 3000);
  ok(await page.evaluate(() => window.__HO_DEBUG.rs.line) === 'YOU PRESSED A.', 'key reset says which key');
  ok(await page.evaluate(() => !!window.__HO_DEBUG.save.tro.keys), 'trophy: BUTTERFINGERS');
  await waitState(page, 'arming', 15000);
  await waitState(page, 'live');
  // X = safe exit, run keeps going
  await sleep(1200);
  const before = await page.evaluate(() => window.__HO_DEBUG.save.run.t);
  await page.keyboard.press('x');
  ok(await st(page) === 'exit', 'X -> safe exit');
  await sleep(1500);
  const after = await page.evaluate(() => window.__HO_DEBUG.save.run && window.__HO_DEBUG.save.run.t);
  ok(after > before + 1, 'run keeps counting on the exit screen');
  await shot(page, 'g-exit');
  await page.click('#backBtn');
  ok(await st(page) === 'arming', 'BACK -> arming');
  await waitState(page, 'live');
  // blur cancels a pending reset
  await sleep(800);
  await page.keyboard.down('Shift');
  ok(await st(page) === 'pending', 'Shift -> pending');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  ok(await st(page) === 'live', 'losing focus cancels the pending reset');
  await page.keyboard.up('Shift');
  // scroll
  await sleep(300);
  await page.mouse.wheel(0, 100);
  await waitState(page, 'reset', 3000);
  ok(await page.evaluate(() => window.__HO_DEBUG.rs.reason) === 'scroll', 'scroll resets');
  ok(errs.length === 0, 'no errors: ' + errs.join(' | '));
  await ctx.close();
}

async function late(browser) {
  console.log('-- 2h run seeded: continue + visuals');
  const { ctx, page, errs } = await open(browser, { save: seededSave(7200) });
  ok(await page.evaluate(() => document.getElementById('startBtn').textContent) === 'CONTINUE', 'menu says CONTINUE');
  await shot(page, 'g-menu-run');
  await page.click('#startBtn');
  await waitState(page, 'live');
  await sleep(2500);
  await shot(page, 'g-late-live');
  for (const e of ['flip', 'kaleido', 'melt', 'glitchstorm']) {
    await page.evaluate((e) => window.__HO_DEBUG.startEvent(e), e);
    await page.waitForFunction(() => window.__HO_DEBUG.ev.cur && window.__HO_DEBUG.ev.cur.t > window.__HO_DEBUG.ev.cur.dur * 0.45, null, { timeout: 20000 });
    await shot(page, 'g-ev-' + e);
    await page.waitForFunction(() => !window.__HO_DEBUG.ev.cur, null, { timeout: 20000 });
  }
  ok(errs.length === 0, 'no errors: ' + errs.join(' | '));
  await ctx.close();
}

async function phone(browser) {
  console.log('-- phone (touch, 390x844 @3x)');
  const { ctx, page, errs } = await open(browser, { viewport: { width: 390, height: 844 }, dpr: 3, touch: true, mobile: true });
  await shot(page, 'p-menu');
  await page.tap('#startBtn');
  ok(await st(page) === 'arming', 'tap START -> arming');
  await page.touchscreen.tap(200, 300);
  ok(await st(page) === 'arming', 'touching during arming just restarts the countdown');
  await waitState(page, 'live');
  await sleep(4000);
  await shot(page, 'p-live');
  // the tiny X in the top-right corner
  const b = await page.evaluate(() => { const L = window.__HO_DEBUG; return null; });
  await page.touchscreen.tap(390 - 20, 30);
  ok(await st(page) === 'exit', 'tiny X button -> safe exit (not a reset)');
  ok(await page.evaluate(() => !!window.__HO_DEBUG.save.run), 'run survived the exit');
  await shot(page, 'p-exit');
  await page.tap('#backBtn');
  await waitState(page, 'live');
  await sleep(500);
  await page.touchscreen.tap(195, 500);
  await waitState(page, 'reset', 3000);
  ok(await page.evaluate(() => window.__HO_DEBUG.rs.reason) === 'touch', 'touching the screen resets (reason touch)');
  await page.waitForFunction(() => window.__HO_DEBUG.rs && window.__HO_DEBUG.rs.t > 3, null, { timeout: 15000 });
  await shot(page, 'p-roast');
  ok(errs.length === 0, 'no errors: ' + errs.join(' | '));
  await ctx.close();
}

async function more(browser) {
  console.log('-- deeper: freeze, offline, two tabs, PUSH, hidden, flinch, menus');
  // offline: a run saved an hour ago keeps going while closed
  const hourAgo = (() => { const now = Date.now(); const s = HO.newSave(now - 4e6); const r = HO.newRun(now - 3600e3 - 600e3); HO.step(r, 600); s.run = r; s.savedAt = now - 3600e3; s.rec.runs = 1; return HO.serialize(s); })();
  const { ctx, page, errs } = await open(browser, { save: hourAgo });
  const card = await page.evaluate(() => document.getElementById('runGain').textContent);
  ok(/while you were gone \(1:00:0/.test(card), 'offline hour shows on the run card: ' + card.replace(/\n/g, ' / '));
  const t = await page.evaluate(() => window.__HO_DEBUG.save.run.t);
  ok(t > 4190 && t < 4220, 'run time includes the hour away: ' + t.toFixed(0));
  await page.click('#startBtn');
  await waitState(page, 'live');
  // the computer freezes for 3.5s (sleep / display off): no reset, just re-arm
  await sleep(600);
  await page.evaluate(() => { const e = performance.now() + 3500; while (performance.now() < e) {} });
  await page.waitForFunction(() => window.__HO_DEBUG.state === 'arming', null, { timeout: 5000 });
  ok(await page.evaluate(() => !!window.__HO_DEBUG.save.run), 'a 3.5s freeze re-arms instead of resetting');
  await page.mouse.move(300, 300); await page.mouse.move(340, 320);
  ok(await st(page) === 'arming', 'the wake-up wiggle after a freeze is not a reset');
  await waitState(page, 'live');
  // PUSH button
  await sleep(2600);
  const vp = page.viewportSize();
  const push = await page.evaluate(() => { const L = window.__HO_DEBUG; return null; });
  await page.mouse.click(vp.width - 60, vp.height - 60);
  await waitState(page, 'reset', 3000);
  ok(await page.evaluate(() => window.__HO_DEBUG.rs.reason) === 'push', 'clicking PUSH says you pushed it');
  ok(await page.evaluate(() => !!window.__HO_DEBUG.save.tro.push), 'trophy: YOU PUSHED IT');
  await waitState(page, 'arming', 15000);
  await waitState(page, 'live');
  // flinch: twitch right away
  await page.mouse.move(500, 500); await page.mouse.move(520, 520);
  await waitState(page, 'reset', 3000);
  ok(await page.evaluate(() => !!window.__HO_DEBUG.save.tro.flinch), 'trophy: FLINCH (reset in the first second)');
  ok(await page.evaluate(() => window.__HO_DEBUG.rs.quick), 'a tiny run gets the quick roast');
  await waitState(page, 'arming', 15000);
  await waitState(page, 'live');
  // the page gets hidden mid-crack (phone screen off / tab switch): no reset
  await sleep(1200);
  await page.keyboard.down('Alt');
  ok(await st(page) === 'pending', 'Alt -> pending');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok(await st(page) === 'live', 'page hidden mid-crack cancels the reset');
  await page.keyboard.up('Alt');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  ok(await st(page) === 'arming', 'coming back re-arms');
  // second tab: lock
  const runStart = await page.evaluate(() => window.__HO_DEBUG.save.run && window.__HO_DEBUG.save.run.start);
  const p2 = await ctx.newPage();
  const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
  await p2.goto(FILE);
  await p2.waitForFunction(() => window.__HO_DEBUG && window.__HO_DEBUG.state !== 'boot');
  ok(await st(p2) === 'lock', 'a second tab shows OPEN SOMEWHERE ELSE');
  await p2.click('#takeBtn');
  ok(await st(p2) === 'menu', 'PLAY HERE INSTEAD takes over');
  await page.waitForFunction(() => window.__HO_DEBUG.state === 'lock', null, { timeout: 5000 });
  ok(true, 'the first tab steps aside');
  ok(await p2.evaluate((rs) => window.__HO_DEBUG.save.run && window.__HO_DEBUG.save.run.start === rs, runStart), 'the new tab has the same run');
  // menus
  await p2.click('#tropBtn');
  ok(await p2.evaluate(() => document.querySelectorAll('#tropGrid .trophy').length) === 30, 'trophy panel lists all 30');
  ok(await p2.evaluate(() => document.querySelectorAll('#tropGrid .trophy.got').length) >= 5, 'earned trophies light up');
  await shot(p2, 'g-trophies');
  await p2.click('#tropPanel [data-close]');
  await p2.click('#setBtn');
  await p2.click('#qualitySeg [data-q="high"]');
  await p2.click('#flashSw');
  await shot(p2, 'g-settings');
  const set = await p2.evaluate(() => JSON.parse(localStorage.getItem('handsoff.save.v1')).set);
  ok(set.quality === 'high' && set.flashes === false, 'settings saved: ' + JSON.stringify(set));
  await p2.click('#wipeBtn'); await p2.click('#wipeYes');
  ok(await p2.evaluate(() => window.__HO_DEBUG.save.run === null && window.__HO_DEBUG.save.rec.resets === 0), 'DELETE wipes the run and records');
  ok(await p2.evaluate(() => window.__HO_DEBUG.save.set.quality) === 'high', 'DELETE keeps your settings');
  ok(errs.length === 0 && e2.length === 0, 'no errors: ' + errs.concat(e2).join(' | '));
  await ctx.close();
}

(async () => {
  const which = process.argv[2] || 'all';
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  try {
    if (which === 'all' || which === 'basic') await basic(browser);
    if (which === 'all' || which === 'late') await late(browser);
    if (which === 'all' || which === 'phone') await phone(browser);
    if (which === 'all' || which === 'more') await more(browser);
  } catch (e) { fail++; console.log('  FAIL threw:', e.message); }
  await browser.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
