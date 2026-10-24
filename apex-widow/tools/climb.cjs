const { chromium } = require('playwright'); const { pathToFileURL } = require('url');
(async()=>{
const url=pathToFileURL(process.cwd()+'/dist/apex-widow.html').href;
const b=await chromium.launch(); const pg=await b.newPage();
await pg.setViewportSize({width:800,height:600});
await pg.goto(url,{waitUntil:'load'}); await pg.waitForTimeout(400);
await pg.click('#play'); await pg.waitForTimeout(13500);
// put spider on floor, scale moderate, drive forward into a wall
await pg.evaluate(()=>{ const g=window.__game; g.spider.setScale(0.8); g.ctrl.pos.set(0,0.1,10); g.ctrl.up.set(0,1,0); g.ctrl.camYaw=0; });
// record leg foot positions over frames while moving
const legMove=await pg.evaluate(async()=>{ const g=window.__game; g.ctrl.keys={KeyW:true};
  const p0=g.spider.legs[0].target.clone();
  await new Promise(r=>setTimeout(r,500));
  const p1=g.spider.legs[0].target.clone();
  return p0.distanceTo(p1); });
console.log('leg target moved while walking:', legMove.toFixed(3), legMove>0.05?'ANIMATING OK':'NOT MOVING');
// drive toward -z wall (back wall at z=-15) to climb
await pg.evaluate(()=>{ const g=window.__game; g.ctrl.pos.set(0,0.1,-13.5); g.ctrl.up.set(0,1,0); g.ctrl.camYaw=Math.PI; g.ctrl.keys={KeyW:true}; });
await pg.waitForTimeout(1800);
const climb=await pg.evaluate(()=>({up:window.__game.ctrl.up.toArray().map(x=>+x.toFixed(2)), pos:window.__game.ctrl.pos.toArray().map(x=>+x.toFixed(1))}));
console.log('after walking into wall  up=',climb.up,'pos=',climb.pos, Math.abs(climb.up[2])>0.5?'CLIMBED WALL OK':'(stayed on floor)');
await pg.evaluate(()=>{window.__game.ctrl.keys={};});
await b.close();
})();
