// Renders frames of an Animate atlas from the private build to PNGs (for making icons from the real art).
//   node tools/own/render_frame.js build/fnf2.html shared/images/characters/nene 0,76,90 out.png [scale]
// Several frames (comma list or a-b range) write out_<frame>.png. HIDE="knife hand|Nene body" leaves those
// symbols out (to cut a head off a body cleanly).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const [html, base, frameArg, out, scale] = process.argv.slice(2);
const frames = [];
for (const part of String(frameArg).split(',')) { const m = part.split('-').map(Number); if (m.length === 2) for (let f = m[0]; f <= m[1]; f++) frames.push(f); else frames.push(m[0]); }
const hide = (process.env.HIDE || '').split('|').filter(Boolean);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(html) + '?dev=screen&name=mainMenu');
  await p.waitForFunction(() => window.G && G.screenName, null, { timeout: 120000 });
  const pngs = await p.evaluate(async ([base, frames, scale, hide]) => {
    const a = G.Atlas.load(base); await new Promise(r => G.A.afterLoad(r));
    for (const h of hide) if (a.symbols[h]) a.symbols[h] = { name: h, layers: [], frameCount: 1 };
    return frames.map(frame => {
      const r = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; G.Atlas.boundsFrame(a, a.main, frame, [1, 0, 0, 1, 0, 0], r);
      const s = scale || 1, w = Math.ceil((r.x1 - r.x0) * s) + 8, h = Math.ceil((r.y1 - r.y0) * s) + 8;
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.translate(4, 4); x.scale(s, s); x.translate(-r.x0, -r.y0); G.Atlas.draw(x, a, a.main, frame);
      return c.toDataURL('image/png');
    });
  }, [base, frames, +(scale || 1), hide]);
  pngs.forEach((png, i) => {
    const file = frames.length === 1 ? out : out.replace(/\.png$/, '_' + frames[i] + '.png');
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
  });
  await b.close();
})();
