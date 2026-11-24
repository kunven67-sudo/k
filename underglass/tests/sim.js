// fast check of the people simulation (no pictures)
module.exports = async ({ app, win }) => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms)); const js = (c) => win.webContents.executeJavaScript(c);
  win.webContents.on('console-message', (e) => { if (/rror/.test(e.message)) console.log('ERR', e.message.slice(0, 300)); });
  for (let i = 0; i < 100; i++) { if (await js('!!window.__ready')) break; await wait(200); } await wait(500);
  await js(`void UG.spawn('worldball', 960, 300)`); await wait(300); await js(`void UG.worlds.enter(UG.worlds.balls[0])`); await wait(4500);
  const speed = +(process.env.UG_SPEED || 10), secs = +(process.env.UG_SECS || 60);
  await js(`UG.worlds.inside.speed=${speed}`);
  for (let t = 0; t < secs; t += 10) {
    await wait(10000);
    console.log(await js(`(()=>{const s=UG.worlds.inside,m=s.sim;return 'D'+m.day()+' '+m.hour().toFixed(1)+' pop'+m.alive().length+' era'+m.era+' know'+m.know.toFixed(0)+' w'+m.res.wood.toFixed(0)+' s'+m.res.stone.toFixed(0)+' f'+m.res.food.toFixed(0)+' | '+s.buildings.filter(b=>!b.gone).map(b=>b.type+(b.built<1?':'+b.built.toFixed(2):'')).join(',')+'\\n   '+m.alive().map(p=>p.name+'('+Math.floor(m.ageOf(p))+','+(p.job||'-')+') '+(p.plan?p.plan.type+':'+p.plan.phase:'none')+' x'+(p.stick.x/36).toFixed(0)+' wat'+p.needs.water.toFixed(0)+' fd'+p.needs.food.toFixed(0)+' en'+p.needs.energy.toFixed(0)+' '+p.stick.mode+'/'+p.stick.act).join('\\n   ')})()`));
  }
  console.log((await js(`JSON.stringify(UG.worlds.inside.feed.slice(-25).map(f=>f.t+' '+f.text))`)).replace(/","/g, '\n'));
  app.quit();
};
