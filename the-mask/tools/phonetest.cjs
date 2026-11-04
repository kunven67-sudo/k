// phone check: touch controls show up and the buttons work. usage: node tools/phonetest.cjs <url> <out.png>
const { chromium, devices } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url); await p.waitForFunction('window.__game && window.__game.frame > 2', null, { timeout: 180000 });
  await p.tap('[data-a="play"]'); await p.waitForTimeout(800);
  const ev = (x) => p.evaluate((c) => { const G = window.__game; return eval(c); }, x);
  console.log('touch ui:', await ev('!!document.querySelector("#touch") && G.touch'));
  await ev(`(()=>{const P=G.player, m=G.mask.obj.position; const d=m.clone().sub(P.headPos); P.yaw=Math.atan2(-d.x,-d.z); P.pitch=Math.atan2(d.y, Math.hypot(d.x,d.z)); return 1})()`);
  await p.waitForTimeout(400);
  await p.tap('.tbtn[data-a="grab"]'); await p.waitForTimeout(3000);
  console.log('wearing:', await ev('G.wearing'));
  await p.tap('.tbtn[data-a="gadget"]'); await p.waitForTimeout(500);
  console.log('gadget:', await ev('G.player.hands[1].gadget && G.player.hands[1].gadget.gid'));
  await p.tap('.tbtn[data-a="fire"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: out });
  console.log(errs.join('\n'));
  await b.close();
})();
