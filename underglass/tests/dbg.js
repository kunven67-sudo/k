const fs = require('fs'), path = require('path');
module.exports = async ({ app, win }) => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms)); const js = (c) => win.webContents.executeJavaScript(c);
  win.webContents.on('console-message', (e) => console.log('CONSOLE', e.message.slice(0, 300)));
  const mouse = (type, x, y, n = 1) => win.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: n });
  for (let i = 0; i < 100; i++) { if (await js('!!window.__ready')) break; await wait(200); } await wait(800);
  await js(`document.addEventListener('pointerdown', e => console.log('DOWN on', e.target.className, e.target.closest('[data-rip]')?.className), true)`);
  const sb = await js(`(()=>{const r=document.querySelector('.tb-start').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  mouse('mouseMove', sb[0], sb[1]); mouse('mouseDown', sb[0], sb[1]); for (let i = 1; i <= 10; i++) { mouse('mouseMove', sb[0] - i * 20, sb[1] - i * 50); await wait(16); } mouse('mouseUp', sb[0] - 200, sb[1] - 500);
  await wait(800); console.log('ripped:', await js(`[...document.querySelectorAll('.ripped')].map(e=>e.className).join(' | ')`), 'bodies', await js('UG.P.bodies.map(b=>b.ripKind).join(",")'));
  app.quit();
};
