// Automated play test: node tests/play.js <outDir> [steps]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = process.argv[2], only = process.argv[3];
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.hdr': 'application/octet-stream', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0, run);
async function run() {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); }); pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?test`);
  await pg.waitForFunction('window.REGEN && window.REGEN.ready', null, { timeout: 300000 });
  await pg.click('#start');
  const wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { await pg.screenshot({ path: path.join(out, n + '.png') }); console.log('shot', n); };
  const ev = s => pg.evaluate(s);
  if (only === 'hands') {
    await wait(2000); await shot('h1-katana-fp');
    await ev("REGEN.debug.press()"); await wait(250); await shot('h2-swing-fp'); await ev("REGEN.debug.release()"); await wait(1200);
    await ev("REGEN.debug.giveWeapon('pistol')"); await wait(1500); await shot('h3-pistol-fp');
    await ev("REGEN.debug.giveWeapon('rifle')"); await wait(1500); await shot('h4-rifle-fp');
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.camDist = 1.3"); await ev("REGEN.debug.look(-700, 0)"); await wait(1500); await shot('h5-rifle-tp');
    await ev("REGEN.debug.equip(0)"); await wait(1200); await shot('h6-katana-tp');
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  await wait(2500); await shot('01-start-fp');
  await pg.keyboard.down('KeyW'); await wait(1500); await pg.keyboard.up('KeyW');
  await pg.keyboard.press('KeyV'); await wait(1500); await shot('02-third');
  await ev("REGEN.debug.spawn('wolf')"); await wait(6000); await shot('03-wolf');
  await ev("REGEN.debug.cut('lArm','upper'); REGEN.debug.cut('rLeg','lower')"); await wait(800); await shot('04-cut');
  await wait(3500); await shot('05-regrow');
  await pg.keyboard.press('KeyQ'); await wait(800); await shot('06-menu'); await pg.keyboard.press('KeyQ');
  console.log(JSON.stringify(await ev("({creatures: REGEN.creatures.map(c => [c.type.key, c.state, Math.round(c.hp), c.pos.toArray().map(v=>+v.toFixed(1))]), player: REGEN.player.pos.toArray().map(v=>+v.toFixed(2)), limbs: Object.fromEntries(Object.entries(REGEN.player.body.limbs).map(([k,v])=>[k,v.state])), fps: document.querySelector('#fps').textContent})")));
  console.log(errs.slice(0, 15).join('\n'));
  await b.close(); srv.close();
}
