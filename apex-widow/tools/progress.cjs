const { chromium } = require('playwright'); const { pathToFileURL } = require('url');
(async()=>{
const url=pathToFileURL(process.cwd()+'/dist/apex-widow.html').href;
const b=await chromium.launch(); const pg=await b.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.setViewportSize({width:800,height:600});
await pg.goto(url,{waitUntil:'load'}); await pg.waitForTimeout(400);
await pg.click('#play'); await pg.waitForTimeout(13500);
// realistic progression: eat nearest EATABLE prey; molt when ready; wrap big ones
let molts=0;
for(let i=0;i<140;i++){
  const r=await pg.evaluate(()=>{
    const g=window.__game;
    const alive=g.prey.filter(p=>!p.eaten);
    if(!alive.length) return 'empty';
    // eatable = not too big OR cocooned
    let target=alive.find(p=> p.t.r<=g.spider.scale*1.6 || p.cocooned);
    if(!target){ // wrap the nearest big one
      const big=alive[0]; g.ctrl.pos.copy(big.pos); g.stats.silk=1; g._tryWrap(); return 'wrapped';
    }
    g.ctrl.pos.copy(target.pos); g._tryEat();
    return g.stats.molt>=1?'moltready':'ate';
  });
  if(r==='moltready'){ await pg.evaluate(()=>window.__game._tryMolt()); await pg.waitForTimeout(1050); await pg.evaluate(()=>{const c=document.querySelector('.card');if(c)c.click();}); molts++; }
  await pg.waitForTimeout(40);
}
const st=await pg.evaluate(()=>({scale:+window.__game.spider.scale.toFixed(2),stage:window.__game.stageI,kills:window.__game.kills,rooftop:window.__game.rooftop,hp:Math.round(window.__game.stats.hp)}));
console.log('progression:',st,'molts:',molts,'errors:',errs.length);
errs.slice(0,8).forEach(e=>console.log(' -',e));
await b.close();
})();
