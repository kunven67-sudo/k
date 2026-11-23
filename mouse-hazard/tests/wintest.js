// Windows check: runs inside the real app on a Windows machine. Tests the real mouse calls and every effect,
// saves screenshots of the real screen and a results file.
'use strict';
const fs = require('fs'), path = require('path');
const { desktopCapturer, screen } = require('electron');
const wait = ms => new Promise(r => setTimeout(r, ms));
const IDS = ['forcefield', 'freeze', 'fire', 'water', 'blackhole', 'airstrike', 'lightning', 'tornado', 'earthquake', 'gravity',
  'oil', 'honey', 'lava', 'blizzard', 'drunk', 'glitch', 'clones', 'mirror', 'rubberband', 'bubble'];
module.exports = async ({ app, getOverlay, startEffect, stopAll, W, state }) => {
  const OUT = process.env.MH_OUT || path.join(__dirname, 'win-results'); fs.mkdirSync(OUT, { recursive: true });
  const res = { steps: [], errors: [] }; const ok = (name, pass, info) => { res.steps.push({ name, pass: !!pass, info }); save(); };
  const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(res, null, 1));
  setTimeout(() => { res.errors.push('timeout'); save(); W.clip(null); W.restoreAll(); app.exit(2); }, 360000);
  const shot = async (name) => { const d = screen.getPrimaryDisplay(); const s = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: d.size.width, height: d.size.height } });
    if (s[0]) fs.writeFileSync(path.join(OUT, name + '.jpg'), s[0].thumbnail.toJPEG(80)); };
  try {
    const d = screen.getPrimaryDisplay(); res.display = { bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor };
    W.setPos(300, 200); let p = W.getPos(); ok('setPos then getPos', p.x === 300 && p.y === 200, p);
    W.clip({ x: 100, y: 100, w: 50, h: 40 }); W.setPos(500, 500); p = W.getPos(); let c = W.getClip(); ok('clip keeps mouse in a box', p.x <= 150 && p.y <= 140 && c.x === 100, { p, c });
    W.clip(null); c = W.getClip(); ok('clip released', c.r - c.x >= d.bounds.width * 0.9, c);
    const pics = W.captureCursors(); const a = pics.arrow;
    let solid = 0; if (a) { const px = Buffer.from(a.rgba, 'base64'); for (let i = 3; i < px.length; i += 4) if (px[i] > 128) solid++; }
    ok('captured their real cursor pictures', a && a.w >= 16 && solid > 30, { keys: Object.keys(pics), arrow: a && [a.w, a.h, a.hx, a.hy, solid] });
    const before = W.currentCursor(); const n = W.hideAll(); ok('hide cursor', n >= 10, { n, before });
    W.restoreAll(); const pics2 = W.captureCursors(); let solid2 = 0; if (pics2.arrow) { const px = Buffer.from(pics2.arrow.rgba, 'base64'); for (let i = 3; i < px.length; i += 4) if (px[i] > 128) solid2++; }
    ok('cursor comes back after restore', solid2 === solid, { solid, solid2 });
    getOverlay().webContents.on('console-message', (e, level, msg) => { if (level >= 2) res.errors.push(msg.slice(0, 300)); });
    for (const id of IDS) {
      const cx = Math.round(d.bounds.width * 0.45), cy = Math.round(d.bounds.height * 0.45);
      W.setPos(cx, cy); await wait(150);
      startEffect(id, 2.4);
      // move like a person would during the effect
      const t0 = Date.now(); let k = 0, clipSeen = null, hiddenSeen = false;
      while (Date.now() - t0 < 2000) { const q = W.getPos(); W.setPos(q.x + Math.round(Math.sin(k / 3) * 9), q.y + Math.round(Math.cos(k / 4) * 6)); k++; await wait(16);
        if (Date.now() - t0 > 900 && !clipSeen) clipSeen = W.getClip(); if (state().cursorHidden) hiddenSeen = true;
        if (k === 75) await shot(id); }
      const done = Date.now(); while (state().overlayShown && Date.now() - done < 9000) await wait(100);
      const after = W.getClip(); const st = state();
      const info = { clipDuring: clipSeen, clipAfter: after, hiddenSeen, overlayShownAfter: st.overlayShown, cursorHiddenAfter: st.cursorHidden, ms: Date.now() - t0 };
      let pass = hiddenSeen && !st.cursorHidden && after.r - after.x >= d.bounds.width * 0.9;
      if (id === 'forcefield' || id === 'freeze') pass = pass && clipSeen && clipSeen.r - clipSeen.x < 400;
      ok('effect ' + id, pass, info);
    }
    stopAll(); await wait(500);
  } catch (e) { res.errors.push(String(e && e.stack || e)); }
  save(); W.clip(null); W.restoreAll(); app.exit(0);
};
