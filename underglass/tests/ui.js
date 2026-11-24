const fs = require('fs'), path = require('path');
module.exports = async ({ app, win }) => {
  const out = path.join(__dirname, 'shots'); const wait = (ms) => new Promise(r => setTimeout(r, ms)); const js = (c) => win.webContents.executeJavaScript(c);
  const shot = async (n) => { const im = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, n + '.png'), im.toPNG()); };
  const errs = []; win.webContents.on('console-message', (e) => { if (/rror/.test(e.message)) errs.push(e.message.slice(0, 300)); });
  const key = (k) => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode: k }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: k }); };
  const click = async (x, y) => { win.webContents.sendInputEvent({ type: 'mouseMove', x, y }); win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); await wait(40); win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }); };
  for (let i = 0; i < 100; i++) { if (await js('!!window.__ready')) break; await wait(200); } await wait(800);
  const phase = process.env.UG_PHASE || '1';
  if (phase === '1') {
    key('Tab'); await wait(600); await shot('u1-menu-spawn');
    const pw = await js(`(()=>{const r=document.querySelector('#hud .tab[data-t=powers]').getBoundingClientRect();return [r.left+r.width/2|0,r.top+r.height/2|0]})()`); await click(pw[0], pw[1]); await wait(400); await shot('u2-menu-powers');
    // pick crate from the spawn page with the mouse, then drop it
    const sp = await js(`(()=>{const r=document.querySelector('#hud .tab[data-t=spawn]').getBoundingClientRect();return [r.left+r.width/2|0,r.top+r.height/2|0]})()`); await click(sp[0], sp[1]); await wait(300);
    const cell = await js(`(()=>{const c=[...document.querySelectorAll('#hud .cell')].find(c=>c.textContent.includes('Crate'));const r=c.getBoundingClientRect();return [r.left+r.width/2|0,r.top+r.height/2|0]})()`); await click(cell[0], cell[1]); await wait(500);
    console.log('placing', await js('UG.placing'), 'bodies', await js('UG.P.bodies.length')); await click(800, 500); await wait(300); console.log('after drop placing', await js('UG.placing'), 'bodies', await js('UG.P.bodies.length'));
    key('Tab'); await wait(600); const ball = await js(`(()=>{const c=[...document.querySelectorAll('#hud .cell')].find(c=>c.textContent.includes('Tiny Universe'));const r=c.getBoundingClientRect();return [r.left+r.width/2|0,r.top+r.height/2|0]})()`); console.log('ball cell', ball); await click(ball[0], ball[1]); await wait(500); console.log('placing2', await js('UG.placing')); await click(1100, 500); await wait(2500);
    console.log('bodies', await js('UG.P.bodies.map(b=>b.label).join(",")'));
    await shot('u3-dropped'); await js('UG.save()'); await wait(1000);
    console.log('saved', await js(`require('fs').readdirSync(require('electron').ipcRenderer.sendSync ? '.' : '.').length`));
  } else {
    await wait(1500); console.log('after restart balls', await js('UG.worlds.balls.length'), 'scenes', await js('UG.worlds.scenes.size'));
    await shot('u4-restarted');
  }
  console.log('ERRS', errs.length, errs.slice(0, 5).join('\n'));
  app.quit();
};
