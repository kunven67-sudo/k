// VR test with Meta's WebXR emulator (IWER, Quest 3 + Touch controllers). usage: node tools/vrtest.cjs <url> <outdir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [url, outDir] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 600 } });
  await ctx.grantPermissions(['microphone']);
  const iwer = fs.readFileSync(path.join(__dirname, '../node_modules/iwer/build/iwer.js'), 'utf8');
  await ctx.addInitScript({ content: iwer + '\n;window.xrDevice = new IWER.XRDevice(IWER.metaQuest3); window.xrDevice.installRuntime({ forceInstall: true });' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/Clock|IWER/.test(m.text()))) errs.push('[' + m.type() + '] ' + m.text()); });
  p.on('pageerror', (e) => errs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await p.goto(url);
  await p.waitForFunction('window.__game && window.__game.frame > 2', null, { timeout: 180000 });
  let n = 0;
  const shot = async (name) => { await p.screenshot({ path: path.join(outDir, (++n) + '-' + name + '.png') }); };
  const log = async (expr) => { const r = await p.evaluate((x) => { const G = window.__game, D = window.xrDevice; return eval(x); }, expr); console.log(JSON.stringify(r)); return r; };
  const dev = (code) => p.evaluate((c) => { const D = window.xrDevice; return eval(c); }, code);
  const wait = (ms) => p.waitForTimeout(ms);
  try {
    await wait(500);
    await p.click('[data-a="vr"]');
    await p.waitForFunction('window.__game.xr === true', null, { timeout: 20000 });
    await wait(1500);
    await log('({xr:G.xr, hands:G.player.hands.map(h=>!!h.src), head:G.player.headPos.toArray().map(v=>+v.toFixed(2))})');
    await shot('in-vr');
    // reach the mask with the right hand: mask is at rig-local (mask - rig)
    const m = await log('(()=>{const r=G.player.rig.position, q=G.mask.obj.position; return [q.x-r.x, q.y-r.y, q.z-r.z]})()');
    await dev(`D.controllers.right.position.set(${m[0] + 0.03}, ${m[1] + 0.0}, ${m[2] + 0.04}); D.controllers.right.quaternion.set(0,0,0,1);`);
    await wait(600);
    await dev(`D.controllers.right.updateButtonValue('squeeze', 1)`); await wait(500);
    await log('({held:G.player.hands.map(h=>h.held&&h.held.def.id)})');
    // bring it to the face
    await dev(`D.controllers.right.position.set(0.0, D.position.y - 0.02, D.position.z - 0.12)`); await wait(900);
    await log('({wearing:G.wearing, head:D.position.toArray? D.position.toArray(): [D.position.x,D.position.y,D.position.z]})');
    await dev(`D.controllers.right.updateButtonValue('squeeze', 0); D.controllers.right.position.set(0.2, 1.1, -0.3)`); await wait(1500);
    // A = next loop now -> a copy
    await dev(`D.controllers.right.updateButtonValue('a-button', 1)`); await wait(250); await dev(`D.controllers.right.updateButtonValue('a-button', 0)`);
    await wait(1500);
    await log('({copies:G.loop.copies.length})');
    // Y = menu, point at the first tile (Knight) and pull the trigger
    await dev(`D.controllers.left.updateButtonValue('y-button', 1)`); await wait(250); await dev(`D.controllers.left.updateButtonValue('y-button', 0)`);
    await wait(800); await shot('menu');
    const aim = await log(`(()=>{const ui=G.ui; const P=G.player; const R=P.hands[1]; const mesh=G.scene.children.find(o=>o.isMesh&&o.renderOrder===20); const rect=null; const r=G.player.rig; const tgt=mesh.localToWorld(new mesh.position.constructor(-0.86/2+0.12, 0.86*760/1024/2-0.12, 0)); const loc=r.worldToLocal(tgt.clone()); return loc.toArray()})()`);
    // controller in front of the head; turn it so its RAY (not its grip) points at the tile
    await dev(`D.controllers.right.position.set(0.15, D.position.y - 0.25, D.position.z - 0.25)`); await wait(300);
    const q = await log(`(()=>{const R=G.player.hands[1]; const T=R.xrRay.position.constructor; R.xrRay.updateMatrixWorld(true); R.xrGrip.updateMatrixWorld(true);
      const rq=R.xrRay.getWorldQuaternion(new G.player.headQuat.constructor()), gq=R.xrGrip.getWorldQuaternion(new G.player.headQuat.constructor());
      const off=rq.clone().invert().multiply(gq); const o=R.xrRay.getWorldPosition(new T()); const t=G.player.rig.localToWorld(new T(${aim[0]},${aim[1]},${aim[2]}));
      const m=new G.camera.matrix.constructor().lookAt(o,t,new T(0,1,0)); const want=new G.player.headQuat.constructor().setFromRotationMatrix(m);
      const g=want; void off; return [g.x,g.y,g.z,g.w]})()`);
    await dev(`D.controllers.right.quaternion.set(${q[0]},${q[1]},${q[2]},${q[3]})`);
    await wait(700); await shot('pointing');
    await log('({xy:window.__vrPanel.lastXY, r6:window.__vrPanel.rects.slice(6,8).map(r=>[r.x,r.y,r.w,r.h]), hover:window.__vrPanel.hover, rect:window.__vrPanel.rects[window.__vrPanel.hover]&&window.__vrPanel.rects[window.__vrPanel.hover].x, dot:window.__vrPanel.dot.visible})');
    await dev(`D.controllers.right.updateButtonValue('trigger', 1)`); await wait(300); await dev(`D.controllers.right.updateButtonValue('trigger', 0)`);
    await wait(1200);
    await log('({people:G.people.list.length, menu:G.ui.vrMenuOpen})');
    await shot('after-spawn');
  } catch (e) { errs.push('[step] ' + e.message); }
  console.log(errs.slice(0, 30).join('\n'));
  await b.close();
})();
