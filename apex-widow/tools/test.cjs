const { chromium } = require('playwright'); const { pathToFileURL } = require('url'); (async()=>{
const url=pathToFileURL(process.cwd()+'/dist/apex-widow.html').href;
const b=await chromium.launch();
const pg=await b.newPage();
const errs=[];
pg.on('console',m=>{ if(m.type()==='error')errs.push('CONSOLE: '+m.text()); });
pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await pg.setViewportSize({width:1280,height:720});
await pg.goto(url,{waitUntil:'load'});
await pg.waitForTimeout(600);
// WebGL present?
const gl=await pg.evaluate(()=>{const c=document.getElementById('c');return !!(c.getContext('webgl2')||c.getContext('webgl'));});
console.log('webgl2:',gl);
// menu visible?
const hasPlay=await pg.evaluate(()=>!!document.querySelector('#play'));
console.log('play button:',hasPlay);
// click play -> cutscene
await pg.click('#play').catch(e=>errs.push('click play: '+e.message));
await pg.waitForTimeout(500);
const state1=await pg.evaluate(()=>window.__game.state);
console.log('state after play:',state1);
// wait through cutscene (~13s) sped: just wait
await pg.waitForTimeout(14000);
const state2=await pg.evaluate(()=>window.__game.state);
console.log('state after cutscene:',state2);
// simulate movement + eat
await pg.evaluate(()=>{window.__game.ctrl.keys={KeyW:true};});
await pg.waitForTimeout(1500);
const moved=await pg.evaluate(()=>({pos:window.__game.ctrl.pos.toArray().map(x=>+x.toFixed(2)), up:window.__game.ctrl.up.toArray().map(x=>+x.toFixed(2))}));
console.log('moved to:',moved);
await pg.evaluate(()=>{window.__game.ctrl.keys={};});
// force-eat everything to test growth/molt/breakout path
await pg.evaluate(()=>{ const g=window.__game; for(let i=0;i<40;i++){ if(g.prey.length)g.prey.sort((a,b)=>a.pos.distanceTo(g.ctrl.pos)-b.pos.distanceTo(g.ctrl.pos)); } });
// teleport onto prey and eat repeatedly via internal calls
let ate=0;
for(let i=0;i<60;i++){
  const ok=await pg.evaluate(()=>{ const g=window.__game; const p=g.prey.find(x=>!x.eaten); if(!p)return 'none'; g.ctrl.pos.copy(p.pos); g._tryEat(); return g.stats.molt>=1?'moltready':'ate'; });
  if(ok==='ate'||ok==='moltready')ate++;
  if(ok==='moltready'){ await pg.evaluate(()=>window.__game._tryMolt()); await pg.waitForTimeout(1100); await pg.evaluate(()=>{const c=document.querySelector('.card');if(c)c.click();}); }
  await pg.waitForTimeout(60);
}
const grown=await pg.evaluate(()=>({scale:+window.__game.spider.scale.toFixed(2),stage:window.__game.stageI,kills:window.__game.kills,state:window.__game.state,rooftop:window.__game.rooftop}));
console.log('after eating spree:',grown, 'ate events:',ate);
// try breakout: grow big then move to window
await pg.evaluate(()=>{ const g=window.__game; g.spider.setScale(2.7); g.stageI=6; if(!g.rooftop&&g.lab.windowPos){ g.ctrl.pos.copy(g.lab.windowPos); } });
await pg.waitForTimeout(2500);
const roof=await pg.evaluate(()=>({rooftop:window.__game.rooftop,state:window.__game.state,broke:window.__game.broke}));
console.log('breakout result:',roof);
console.log('\nERRORS:',errs.length);
errs.slice(0,15).forEach(e=>console.log(' -',e));
await b.close();
})();
