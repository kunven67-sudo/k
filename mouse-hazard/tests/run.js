// Test run: renders every effect over a fake desktop with a scripted mouse and saves screenshots.
// Run: MH_TEST=$PWD/tests/run.js MH_BG=$PWD/tests/shots/desktop.png xvfb-run -a -s "-screen 0 1920x1080x24" electron .
'use strict';
const fs = require('fs'), path = require('path');
const { BrowserWindow } = require('electron');
const OUT = path.join(__dirname, 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));

// mouse scripts: f(t) -> {x,y}, as JS source run inside the overlay
const PATHS = {
  default: 't => ({ x: 860 + Math.sin(t * 1.3) * 160, y: 470 + Math.sin(t * 2.1) * 90 })',
  forcefield: 't => ({ x: 700 + t * 900, y: 520 + Math.sin(t * 3) * 300 })',
  freeze: 't => ({ x: 900 + Math.sin(t * 25) * 40, y: 480 })',
  fire: 't => ({ x: 760 + t * 110, y: 560 + Math.sin(t * 2) * 60 })',
  water: 't => ({ x: 900 + Math.sin(t * 0.8) * 60, y: 430 })',
  honey: 't => ({ x: 900 + t * 300, y: 400 })',
  lava: 't => ({ x: 900 + Math.sin(t * 0.7) * 50, y: 420 })',
  gravity: 't => ({ x: 700 + t * 120, y: 300 })',
  oil: 't => ({ x: 800 + (t < 0.6 ? t * 500 : 300), y: 500 + (t < 0.6 ? t * 200 : 120) })',
  blizzard: 't => ({ x: 950, y: 330 })',
  rubberband: 't => ({ x: 900 + t * 600, y: 500 + t * 200 })',
  bubble: 't => ({ x: 900 + Math.sin(t * 4) * 200, y: 600 })',
  mirror: 't => ({ x: 600 + t * 80, y: 400 })',
};
const PLAN = [ // id, seconds, capture times
  ['forcefield', 5, [0.6, 1.4]], ['freeze', 5, [1.5, 5.25]], ['fire', 6, [1.2, 3.5]], ['water', 6, [0.75, 2.5]],
  ['blackhole', 6, [1.2, 3.2]], ['airstrike', 5, [2.0, 3.15, 3.6]], ['lightning', 5, [0.58, 1.0]], ['tornado', 5, [2.5]],
  ['earthquake', 5, [2.6]], ['gravity', 4, [0.45, 1.5]], ['oil', 5, [1.5]], ['honey', 6, [1.6, 3.5]], ['lava', 6, [2.6, 4.5]],
  ['blizzard', 6, [4.5]], ['drunk', 5, [2.2]], ['glitch', 5, [0.5, 1.6]], ['clones', 4, [1.2]], ['mirror', 6, [1.2, 4.0]],
  ['rubberband', 5, [0.8, 5.1]], ['bubble', 5, [1.5, 5.05]],
];

const PREVIEW = { // id: [seconds, time, crop [x,y,w,h] or null = whole screen, mouse path]
  forcefield: [5, 1.3, [480, 270, 960, 540], 't => ({ x: 900 + t * 700, y: 520 + Math.sin(t * 3) * 200 })'],
  freeze: [5, 1.6, [580, 290, 720, 405], 't => ({ x: 900 + Math.sin(t * 25) * 40, y: 480 })'],
  fire: [6, 2.6, [620, 330, 640, 360], 't => ({ x: 940 + Math.sin(t) * 30, y: 620 })'],
  water: [6, 0.75, [600, 160, 720, 405], 't => ({ x: 930, y: 470 })'],
  blackhole: [6, 3.0, [600, 284, 720, 405], 't => ({ x: 600 + t * 40, y: 300 })'],
  airstrike: [5, 3.3, [600, 300, 720, 405], 't => ({ x: 960, y: 560 })'],
  lightning: [5, 0.6, [500, 60, 960, 540], 't => ({ x: 980, y: 560 })'],
  tornado: [5, 2.6, null, null], earthquake: [5, 3.6, null, null],
  gravity: [4, 0.34, [560, 300, 640, 360], 't => ({ x: 860, y: 300 })'],
  oil: [5, 1.5, [520, 330, 720, 405], 't => ({ x: 800 + (t < 0.6 ? t * 500 : 300), y: 500 + (t < 0.6 ? t * 200 : 120) })'],
  honey: [6, 1.3, [640, 80, 640, 360], 't => ({ x: 930, y: 420 })'],
  lava: [6, 3.2, [620, 300, 640, 360], 't => ({ x: 920, y: 420 })'],
  blizzard: [6, 5.5, null, 't => ({ x: 950, y: 330 })'], drunk: [5, 2.2, null, null], glitch: [5, 0.5, null, null],
  clones: [4, 1.2, [480, 270, 960, 540], null], mirror: [6, 1.2, null, null],
  rubberband: [5, 0.8, [760, 330, 800, 450], 't => ({ x: 900 + t * 600, y: 500 + t * 200 })'],
  bubble: [5, 1.5, [680, 340, 480, 270], 't => ({ x: 900, y: 600 })'],
};
module.exports = async ({ app, getOverlay }) => {
  const errors = [];
  try {
    // 1. fake desktop picture
    const bg = path.join(OUT, 'desktop.png');
    if (!fs.existsSync(bg)) {
      const d = new BrowserWindow({ x: 0, y: 0, width: 1920, height: 1080, frame: false, show: true });
      await d.loadFile(path.join(__dirname, 'desktop.html')); await wait(800);
      fs.writeFileSync(bg, (await d.webContents.capturePage()).toPNG()); d.destroy();
    }
    await wait(1500);
    const ov = getOverlay();
    ov.webContents.on('console-message', (e, level, msg) => { if (level >= 2 || /error/i.test(msg)) errors.push(msg); });
    ov.setBounds({ x: 0, y: 0, width: 1920, height: 1080 }); ov.showInactive();
    await ov.webContents.executeJavaScript(`new Promise(r => { const im = new Image(); im.onload = () => { Render.setScreen(im); r(1); }; im.src = ${JSON.stringify('file://' + bg)}; document.body.style.backgroundImage = 'url(${'file://' + bg})'; document.body.style.backgroundSize = '100% 100%'; })`);
    console.log('bg', await ov.webContents.executeJavaScript('getComputedStyle(document.body).backgroundImage.slice(0,80) + " " + document.body.offsetWidth'));
    const only = (process.env.MH_ONLY || '').split(',').filter(Boolean);
    const display = { id: 1, phys: { x: 0, y: 0, width: 1920, height: 1080 }, floor: 1032, scale: 1 };
    const plan = process.env.MH_PREVIEW ? Object.keys(PREVIEW).map(k => [k, PREVIEW[k][0], [PREVIEW[k][1]]]) : PLAN;
    for (const [id, secs, times] of plan) {
      if (only.length && !only.includes(id)) continue;
      const p = (process.env.MH_PREVIEW && PREVIEW[id][3]) || PATHS[id] || PATHS.default;
      await ov.webContents.executeJavaScript(`(() => { const path = ${p}; window.__MH_FIXED = 1; const t0 = MH.simTime; const tt = () => MH.simTime - t0;
        let last = path(0); const pos = { x: last.x, y: last.y };
        window.__fakeMouse = global.__fakeMouse = () => { const n = path(tt()); pos.x += n.x - last.x; pos.y += n.y - last.y; last = n; return { x: pos.x, y: pos.y }; };
        window.__fakeMouseSet = global.__fakeMouseSet = (x, y) => { pos.x = x; pos.y = y; }; MH.M.init = false; return 1; })()`);
      await ov.webContents.executeJavaScript('window.__fakeMouse(); 1');
      ov.webContents.send('start', { id, seconds: secs, display, stack: true, volume: 0 });
      let k = 0;
      for (const t of times) {
        for (let g = 0; g < 4000; g++) { const et = await ov.webContents.executeJavaScript(`(() => { const e = MH.active.find(x => x.id === '${id}'); return e ? (e.ending ? e.dur + e.te : e.t) : 1e9; })()`); if (et >= t) break; await wait(15); }
        let img = await ov.webContents.capturePage();
        if (process.env.MH_PREVIEW) { const cr = PREVIEW[id][2]; if (cr) img = img.crop({ x: cr[0], y: cr[1], width: cr[2], height: cr[3] });
          fs.writeFileSync(path.join(__dirname, '..', 'assets', 'previews', id + '.jpg'), img.resize({ width: 480, height: 270, quality: 'best' }).toJPEG(86)); }
        else fs.writeFileSync(path.join(OUT, `${id}_${k++}.jpg`), img.toJPEG(88));
      }
      ov.webContents.send('stop', { hard: true });
      await wait(700);
      const info = await ov.webContents.executeJavaScript('({ active: MH.active.length, parts: MH.Parts.count, liquid: MH.Liquid.count })');
      console.log('done', id, JSON.stringify(info));
    }
  } catch (e) { errors.push(String(e && e.stack || e)); }
  console.log('ERRORS:', errors.length ? '\n' + [...new Set(errors)].slice(0, 30).join('\n') : 'none');
  app.exit(0);
};
