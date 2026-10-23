// Records a smooth preview video of the real game with a fake clock (each frame rendered, then captured).
// node rec-video.js <out dir> [fps] [WxH] [quality]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
const HO = require('./src/core.js');
const OUT = process.argv[2] || path.join(__dirname, 'shots', 'vid');
const FPS = +(process.argv[3] || 30);
const [W, H] = (process.argv[4] || '1280x720').split('x').map(Number);
const Q = process.argv[5] || 'high';
const ONLY = process.env.ONLY ? +process.env.ONLY : 0;   // >0: just time one frame
fs.mkdirSync(OUT, { recursive: true });
function seeded(level) {
  const now = Date.now();
  const s = HO.newSave(now - 600000);
  s.set.quality = Q; s.rec.runs = 4; s.rec.resets = 3; s.rec.bestTime = 900;
  const r = HO.newRun(now - 1000);
  let g = 0; while (r.level < level && g++ < 100000) HO.step(r, 0.25);
  s.run = r; s.savedAt = now; s.rec.bestLog = r.maxLog; s.rec.bestLevel = r.level;
  return HO.serialize(s);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.install({ time: Date.now() });
  await page.clock.pauseAt(Date.now() + 1000);      // time only moves when we step it (else rAF keeps queuing frames during slow screenshots)
  await page.addInitScript((fps) => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1000 / fps); }, FPS);   // one render per video frame
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('handsoff.save.v1', s); localStorage.setItem('handsoff.real.v1', '1'); sessionStorage.setItem('seeded', '1'); } }, seeded(+(process.env.LEVEL || 17)));
  await page.goto('file://' + path.join(__dirname, 'dist', 'hands-off.html'));
  await page.evaluate(async () => { try { await document.fonts.load('900 40px Unbounded'); await document.fonts.load('700 16px "JetBrains Mono"'); } catch (e) {} });
  // let the shaders + sky finish (real time passes, fake clock steps)
  for (let i = 0; i < 600; i++) { await page.clock.runFor(50); const r = await page.evaluate(() => window.__HO_DEBUG && window.__HO_DEBUG.R.ready && window.__HO_DEBUG.state === 'menu'); if (r) break; await new Promise((r) => setTimeout(r, 100)); }
  await page.evaluate(() => { window.__HO_DEBUG.R.flags.noAdapt = true; });   // keep full quality (the fake clock looks slow to it)
  for (let i = 0; i < 3; i++) await page.clock.runFor(1000 / FPS);
  let n = 0;
  const dt = 1000 / FPS;
  const frame = async () => {
    const tA = Date.now();
    await page.clock.runFor(dt);
    const t0 = Date.now();
    if (ONLY) console.log('runFor', t0 - tA, 'ms');
    await page.screenshot({ path: path.join(OUT, String(n).padStart(5, '0') + '.png'), timeout: 600000 });
    if (ONLY) console.log('shot', Date.now() - t0, 'ms');
    if (n % 30 === 0) console.log('frame', n, (Date.now() - t0) + 'ms', await page.evaluate(() => window.__HO_DEBUG.state));
    n++;
  };
  const run = async (sec) => { const k = Math.round(sec * FPS); for (let i = 0; i < k; i++) await frame(); };
  if (ONLY) { const t0 = Date.now(); for (let i = 0; i < ONLY; i++) await frame(); console.log('per frame', (Date.now() - t0) / ONLY, 'ms'); await b.close(); return; }
  await run(2.0);                                // the menu over the live world
  await page.click('#startBtn');                 // (a click on the menu is fine)
  await page.mouse.move(W - 4, H - 4);           // park the mouse, then leave it alone
  await run(3.3);                                // arming countdown
  const until = async (fn, maxSec) => { for (let i = 0; i < maxSec * FPS; i++) { if (await page.evaluate(fn)) return; await frame(); } };
  await until(() => window.__HO_DEBUG.R.diving(), 25);   // live, counting, into the world change
  await run(3.2);                                // the dive
  await run(4.0);                                // the new world
  await page.mouse.move(W * 0.6, H * 0.42);      // touch it
  await page.mouse.move(W * 0.62, H * 0.43);
  await until(() => window.__HO_DEBUG.state === 'arming', 12);   // crack, shatter, rewind, roast
  await run(1.0);
  console.log('frames', n, 'errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
