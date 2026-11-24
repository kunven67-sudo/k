module.exports = async ({ app, win }) => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms)); const js = (c) => win.webContents.executeJavaScript(c);
  win.webContents.on('console-message', (e) => { if (/rror/.test(e.message)) console.log('ERR', e.message.slice(0, 300)); });
  for (let i = 0; i < 100; i++) { if (await js('!!window.__ready')) break; await wait(200); } await wait(500);
  await js(`void UG.spawn('worldball', 960, 300)`); await wait(300); await js(`void UG.worlds.enter(UG.worlds.balls[0])`); await wait(4500);
  await js(`UG.worlds.inside.speed=10`);
  for (let t = 0; t < 12; t++) {
    await wait(4000);
    console.log(await js(`(()=>{const s=UG.worlds.inside,m=s.sim;return 'D'+m.day()+' '+m.hour().toFixed(1)+' food'+m.res.food.toFixed(0)+' | '+m.alive().filter(p=>p.plan&&(p.plan.type==='eat'||p.plan.type==='drink')).map(p=>p.name+' '+p.plan.type+':'+p.plan.phase+' t'+(p.plan.t||0).toFixed(1)+' x'+(p.stick.x/36).toFixed(1)+' tgt'+(p.stick.target===null?'null':(p.stick.target/36).toFixed(1))+' v'+p.stick.v.toFixed(0)+' g'+p.stick.ground.toFixed(0)+' ter'+s.terrainY(p.stick.x).toFixed(0)+' fd'+p.needs.food.toFixed(0)).join(' ; ')})()`));
  }
  console.log(await js(`UG.worlds.inside.buildings.map(b=>b.type+' x'+(b.x/36).toFixed(1)+' w'+b.w+' y'+b.y.toFixed(0)).join(' | ')`));
  app.quit();
};
