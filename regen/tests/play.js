// Automated play test: node tests/play.js <outDir> [steps]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = process.argv[2], only = process.argv[3];
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.hdr': 'application/octet-stream', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0, run);
async function run() {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: only === 'hero' ? { width: 1600, height: 900 } : { width: 1280, height: 720 } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); }); pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html${(only === 'hero' || only === 'side') && !process.env.FAST ? '' : '?test'}`);
  await pg.waitForFunction('window.REGEN && window.REGEN.ready', null, { timeout: 300000 });
  await pg.click('#start'); await pg.waitForTimeout(300); await pg.evaluate('REGEN.player.pitch = 0; REGEN.player.yaw = 0;');
  const wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { await pg.screenshot({ path: path.join(out, n + '.png'), timeout: 180000 }); console.log('fps', await pg.evaluate("document.querySelector('#fps').textContent")); console.log('shot', n); };
  const ev = s => pg.evaluate(s);
  if (only === 'stand') {
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.camDist = 3; REGEN.player.pitch = -0.12"); await wait(1500); await shot('st1-behind');
    await ev("REGEN.player.holder.rotation.y = Math.PI * 0.6"); await wait(1200); await shot('st2-side');
    await ev("REGEN.player.holder.rotation.y = 0; REGEN.debug.cut('rArm','lower')"); await wait(2500); await shot('st3-drop');
    console.log(JSON.stringify(await ev("({w: REGEN.player.weapon && REGEN.player.weapon.key, inv: REGEN.debug.inv.map(i=>i.key), ground: REGEN.items.filter(i=>!i.held).map(i=>i.key+'@'+i.obj.position.y.toFixed(2))})")));
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  if (only === 'front') {
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.camDist = 2.2; REGEN.player.pitch = -0.1; REGEN.player.yaw = 2.6; REGEN.player.holder.rotation.y = Math.PI * 0.85");
    await wait(800); await shot('fr0-idle');
    await ev("REGEN.debug.cut('lArm','upper')");
    await pg.waitForFunction("REGEN.player.body.limbs.lArm.state === 'grow' && REGEN.player.body.limbs.lArm.t > 1.5", null, { timeout: 400000, polling: 50 });
    await ev("REGEN.player.body.regenRate = 0"); await wait(900); await shot('fr1-meat'); await ev("REGEN.player.body.regenRate = 1");
    await pg.waitForFunction("REGEN.player.body.limbs.lArm.state === 'ok'", null, { timeout: 400000, polling: 100 }); await wait(800); await shot('fr2-torn');
    await b.close(); srv.close(); return;
  }
  if (only === 'side') {
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.camDist = 1.7; REGEN.player.pitch = -0.1; REGEN.player.yaw = 2.6; REGEN.player.holder.rotation.y = -1.35");
    await ev("REGEN.debug.cut('lArm','upper')"); await wait(400); await shot('s0-cut');
    for (const [t, n] of [[0.55, 's1-bone'], [1.45, 's2-meat'], [2.35, 's3-skin']]) {
      await pg.waitForFunction(`REGEN.player.body.limbs.lArm.state === 'grow' && REGEN.player.body.limbs.lArm.t > ${t}`, null, { timeout: 400000, polling: 50 });
      await ev("REGEN.player.body.regenRate = 0"); await wait(900); await shot(n); await ev("REGEN.player.body.regenRate = 1");
    }
    await pg.waitForFunction("REGEN.player.body.limbs.lArm.state === 'ok'", null, { timeout: 400000, polling: 100 }); await wait(800); await shot('s4-torn');
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  if (only === 'hero') {
    await pg.evaluate("document.querySelector('#moods [data-mood=calm]').click()");
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.camDist = 1.9; REGEN.player.pitch = -0.08; REGEN.player.yaw = 0.5");
    await ev("REGEN.debug.spawn('trex')"); await wait(4000);
    await ev("(() => { const c = REGEN.creatures[0]; c.pos.set(-4, 0, 22); c.yaw = 2.3; c.state = 'roar'; c.stateT = 999; c.speed = 0; c.play('roar'); })()");
    await ev("REGEN.debug.cut('lArm','upper'); REGEN.player.yaw = 2.6");
    await pg.waitForFunction("REGEN.player.body.limbs.lArm.state === 'grow' && REGEN.player.body.limbs.lArm.t > 1.45", null, { timeout: 300000, polling: 100 });
    await ev("REGEN.player.body.regenRate = 0"); await wait(1200); await shot('hero1-regrow');
    await ev("REGEN.player.body.regenRate = 1; REGEN.debug.cut('rLeg','lower')");
    await pg.waitForFunction("REGEN.player.body.limbs.rLeg.state === 'ok' && REGEN.player.body.limbs.lArm.state === 'ok'", null, { timeout: 400000, polling: 200 });
    await ev("REGEN.player.yaw = 2.9; REGEN.player.camDist = 2.4; REGEN.player.pitch = -0.2"); await wait(1500); await shot('hero2-torn');
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.yaw = 0; REGEN.player.pitch = -0.1"); await wait(1500); await shot('hero3-fp');
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  if (only === 'fight') {
    const aimAt = n => ev(`(() => { const P = REGEN.player, c = REGEN.creatures[${n}]; if (!c) return; const e = P.eye(); P.yaw = Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z); P.pitch = Math.atan2(c.half.y - e.y, Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z)); })()`);
    await ev("REGEN.debug.spawn('bear')"); await wait(5000); await shot('f1-bear');
    await ev("REGEN.debug.giveWeapon('rifle')"); await wait(800);
    for (let i = 0; i < 4; i++) { await aimAt(0); await wait(300); await ev("REGEN.debug.press()"); await wait(200); await ev("REGEN.debug.release()"); await wait(1300); }
    await shot('f2-shot'); console.log('bear', JSON.stringify(await ev("REGEN.creatures.map(c=>[c.type.key,c.state,Math.round(c.hp)])")));
    await ev("REGEN.debug.spawn('barrel')"); await wait(1500);
    await ev("REGEN.debug.giveWeapon('grenade')"); await ev("REGEN.player.pitch = 0.25"); await wait(500); await ev("REGEN.debug.press()"); await wait(300); await ev("REGEN.debug.release()");
    await wait(3600); await shot('f3-grenade');
    await ev("REGEN.debug.spawn('raptor'); REGEN.debug.spawn('raptor')"); await wait(7000); await shot('f4-raptors');
    await pg.keyboard.press('KeyQ'); await wait(1000); await shot('f5-menu');
    console.log(JSON.stringify(await ev("({creatures: REGEN.creatures.map(c => [c.type.key, c.state, Math.round(c.hp)]), limbs: Object.fromEntries(Object.entries(REGEN.player.body.limbs).map(([k,v])=>[k,v.state])), inv: REGEN.debug.inv.map(i=>i.key), items: REGEN.items.length})")));
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  if (only === 'zoo') {
    await pg.keyboard.press('KeyV'); await ev(`REGEN.player.camDist = ${+process.env.CD || 7}; REGEN.player.pitch = -0.12`);
    const GAP = +process.env.GAP || 9, DZ = +process.env.DZ || 14;
    const keys = (process.argv[4] || 'wolf,bear,tiger,hyena,rhino,elk').split(',');
    await pg.evaluate("document.querySelector('#moods [data-mood=calm]').click()");
    for (let i = 0; i < keys.length; i++) {
      await ev(`REGEN.debug.spawn('${keys[i]}')`); await wait(1500);
      await ev(`(() => { const c = REGEN.creatures[REGEN.creatures.length-1]; c.pos.set(${(i - (keys.length - 1) / 2) * GAP}, c.def.flying ? 6 : 0, ${DZ}); c.yaw = Math.PI/2; c.state = 'wander'; c.stateT = 99; c.heading = Math.PI/2; c.rest = false; })()`);
    }
    await wait(2500); await shot('zoo');
    console.log(JSON.stringify(await ev("REGEN.creatures.map(c => [c.type.key, c.role, +c.speed.toFixed(1), c.type.size.toArray().map(v=>+v.toFixed(1))])")));
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  if (only === 'probe') {
    for (let i = 0; i < 2; i++) { await wait(800); console.log(JSON.stringify(await ev("({w: Object.entries(REGEN.player.acts).map(([k,a])=>[k,+a.weight.toFixed(2),+a.getEffectiveWeight().toFixed(2),+a.time.toFixed(2)]), pos: REGEN.player.pos.toArray().map(v=>+v.toFixed(2)), vel: REGEN.player.vel.toArray().map(v=>+v.toFixed(2)), pitch: REGEN.player.pitch, yaw: REGEN.player.yaw, ground: REGEN.player.ground, recoil: REGEN.player.recoil, drop: REGEN.player.drop, camDir: (()=>{const v=new (REGEN.player.pos.constructor)(); return document.querySelector('canvas') && 0})(), head: REGEN.player.B.Head.getWorldPosition(REGEN.player.pos.clone()).toArray().map(v=>+v.toFixed(2)), hips: REGEN.player.B.Hips.getWorldPosition(REGEN.player.pos.clone()).toArray().map(v=>+v.toFixed(2))})"))); }
    console.log(errs.filter(e => !e.includes('404')).slice(0, 10).join('\n')); await b.close(); srv.close(); return;
  }
  if (only === 'hands') {
    await wait(2000); await shot('h1-katana-fp');
    await ev("REGEN.debug.press()"); await wait(250); await shot('h2-swing-fp'); await ev("REGEN.debug.release()"); await wait(1200);
    await ev("REGEN.debug.giveWeapon('pistol')"); await wait(1500); await shot('h3-pistol-fp');
    await ev("REGEN.debug.giveWeapon('rifle')"); await wait(1500); await shot('h4-rifle-fp');
    await pg.keyboard.press('KeyV'); await ev("REGEN.player.camDist = 1.3"); await ev("REGEN.debug.look(-700, 0)"); await wait(1500); await shot('h5-rifle-tp');
    await ev("REGEN.debug.equip(0); REGEN.player.camDist = 0.75"); await ev("REGEN.debug.look(-500, 0)"); await wait(1500); await shot('h6-katana-tp');
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
