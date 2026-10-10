// Dev tool: open a GAMBLE URL in headless Chromium, run optional input steps, capture
// screenshots + console errors. Used by developers/agents to verify visuals.
//
// Usage: node shot.mjs <url> <outPrefix> [stepsJson]
//   steps: [{wait:ms} | {key:'KeyW', ms:800} | {click:[x,y]} | {mouse:[dx,dy]} | {shot:'name'} |
//           {eval:'js code (function-scoped; value of last expression is printed)'} | {type:'text'} | {viewport:[w,h]}]
// Run ONE shot.mjs at a time: parallel runs starve SwiftShader and capture stale frames.
// Env: SHOT_W/SHOT_H viewport (default 1280x720), SHOT_MOBILE=1 to emulate an iPhone,
//      SHOT_QUALITY=low|medium|high|ultra to force a tier, SHOT_CLEAR=1 to wipe localStorage first.
// Set PW=/path/to/node_modules/playwright/index.mjs if playwright isn't installed next to this file.
const { chromium, devices } = await import(process.env.PW || 'playwright');

const [url, out = 'shot', stepsArg = '[]'] = process.argv.slice(2);
const steps = JSON.parse(stepsArg);
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const ctxOpts = process.env.SHOT_MOBILE
  ? { ...devices['iPhone 13'] }
  : { viewport: { width: +(process.env.SHOT_W || 1280), height: +(process.env.SHOT_H || 720) } };
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
if (process.env.SHOT_QUALITY) {
  // Force a quality tier (headless SwiftShader auto-detects 'low').
  await page.addInitScript((q) => {
    const k = 'gamble.settings.v1';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    cur.quality = q;
    localStorage.setItem(k, JSON.stringify(cur));
  }, process.env.SHOT_QUALITY);
}
if (process.env.SHOT_CLEAR) await page.addInitScript(() => { if (!sessionStorage.getItem('cleared')) { localStorage.clear(); sessionStorage.setItem('cleared', '1'); } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
await page.goto(url, { waitUntil: 'load' });
let n = 0;
if (!steps.length) steps.push({ wait: 4000 }, { shot: 'main' });
for (const s of steps) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.viewport) await page.setViewportSize({ width: s.viewport[0], height: s.viewport[1] });
  if (s.click) await page.mouse.click(s.click[0], s.click[1]);
  if (s.mouse) await page.mouse.move(s.mouse[0], s.mouse[1]);
  if (s.key) { await page.keyboard.down(s.key); await page.waitForTimeout(s.ms || 100); await page.keyboard.up(s.key); }
  if (s.press) await page.keyboard.press(s.press);
  if (s.type) await page.keyboard.type(s.type);
  if (s.eval) { try { const r = await page.evaluate(`(function(){ return eval(${JSON.stringify(s.eval)}); })()`); if (r !== undefined) console.log('eval:', JSON.stringify(r)); } catch (e) { logs.push('[eval] ' + e.message); } }
  if (s.shot) { const p = `${out}-${String(n++).padStart(2, '0')}-${s.shot}.png`; await page.screenshot({ path: p, timeout: 300000 }); console.log('saved', p); }
}
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
