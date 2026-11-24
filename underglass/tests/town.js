const fs = require('fs'), path = require('path');
module.exports = async ({ app, win }) => {
  const out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
  const wait = (ms) => new Promise(r => setTimeout(r, ms)); const js = (c) => win.webContents.executeJavaScript(c);
  const shot = async (n) => { const im = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, n + '.png'), im.toPNG()); };
  win.webContents.on('console-message', (e) => { if (/rror/.test(e.message)) console.log('ERR', e.message.slice(0, 300)); });
  for (let i = 0; i < 100; i++) { if (await js('!!window.__ready')) break; await wait(200); } await wait(500);
  // desktop stickmen close up
  await js(`(()=>{for(let i=0;i<5;i++)UG.spawn(i%2?'stickman':'kid',700+i*110,700);})()`); await wait(3500); await shot('t0-desk-sticks');
  await js(`void UG.spawn('worldball', 960, 300)`); await wait(300); await js(`void UG.worlds.enter(UG.worlds.balls[0])`); await wait(4500);
  // fast town: lots of stuff + higher age
  await js(`(()=>{const s=UG.worlds.inside,m=s.sim;m.res={wood:2000,stone:2000,food:300};m.know=700;m.era=3;for(let i=0;i<10;i++)m.addPerson(rand=(Math.random()-0.5)*40*36);for(let k=0;k<14;k++){m.townPlan();for(const b of s.buildings)if(b.built<1){b.paid=true;m.finished(b);}}m.assignJobs();m.time=24*3+10;})()`);
  await wait(6000);
  console.log(await js(`UG.worlds.inside.buildings.map(b=>b.type+'@'+(b.x/36).toFixed(0)).join(' ')`));
  const xs = JSON.parse(await js(`JSON.stringify(UG.worlds.inside.buildings.map(b=>b.x+b.w*18))`));
  await js(`(()=>{const s=UG.worlds.inside;s.cam.tz=s.cam.z=1.2;s.cam.tx=s.cam.x=0;s.cam.ty=s.cam.y=s.terrainY(0)-160;})()`); await wait(1200); await shot('t1-town');
  await js(`(()=>{const s=UG.worlds.inside;s.cam.tz=s.cam.z=0.45;s.cam.ty=s.cam.y=s.terrainY(0)-200;})()`); await wait(1200); await shot('t2-town-wide');
  await js(`(()=>{const s=UG.worlds.inside;const b=s.buildings.find(b=>b.type==='bar');s.cam.tz=s.cam.z=2.2;s.cam.tx=s.cam.x=b.x+b.w*18;s.cam.ty=s.cam.y=b.y-90;s.sim.time=Math.floor(s.sim.time/24)*24+21;})()`); await wait(3000); await shot('t3-bar-night');
  await js(`(()=>{const s=UG.worlds.inside;const b=s.buildings.find(b=>b.type==='house'||b.type==='apartment');s.cam.tx=s.cam.x=b.x+b.w*18;s.cam.ty=s.cam.y=b.y-120;s.sim.time=Math.floor(s.sim.time/24)*24+24+12;})()`); await wait(2000); await shot('t4-house-day');
  await js(`(()=>{const s=UG.worlds.inside;const b=s.buildings.find(b=>b.type==='house'||b.type==='apartment');s.explode(b.x+b.w*18,b.y-60,2.5);})()`); await wait(200); await shot('t5-house-boom'); await wait(2500); await shot('t6-house-after');
  app.quit();
};
