const { chromium } = require('playwright'); const { pathToFileURL } = require('url');
(async()=>{
const url=pathToFileURL(process.cwd()+'/dist/apex-widow.html').href;
const b=await chromium.launch(); const pg=await b.newPage();
await pg.setViewportSize({width:1280,height:720});
await pg.goto(url,{waitUntil:'load'}); await pg.waitForTimeout(500);
await pg.screenshot({path:'/tmp/shot_menu.png'});
await pg.click('#play'); await pg.waitForTimeout(400);
await pg.screenshot({path:'/tmp/shot_cutscene.png'});
await pg.waitForTimeout(14000); // into play
// frame the spider nicely: place camera close, look at spider
await pg.evaluate(()=>{ const g=window.__game; g.spider.setScale(1.0); g.stageI=4; const p=g.ctrl.pos; g.cam.position.set(p.x+3,p.y+2.2,p.z+3.5); g.cam.up.set(0,1,0); g.cam.lookAt(p.x,p.y+0.5,p.z); });
await pg.waitForTimeout(400);
await pg.screenshot({path:'/tmp/shot_spider.png'});
// gameplay wide
await pg.evaluate(()=>{ const g=window.__game; const p=g.ctrl.pos; g.cam.position.set(p.x+7,p.y+5,p.z+8); g.cam.lookAt(p.x,p.y,p.z); });
await pg.waitForTimeout(300); await pg.screenshot({path:'/tmp/shot_lab.png'});
// rooftop
await pg.evaluate(()=>{ const g=window.__game; g.spider.setScale(2.7); g.stageI=6; g.ctrl.pos.copy(g.lab.windowPos); });
await pg.waitForTimeout(2500);
await pg.evaluate(()=>{ const g=window.__game; const p=g.ctrl.pos; g.cam.position.set(p.x+10,p.y+7,p.z+12); g.cam.up.set(0,1,0); g.cam.lookAt(p.x,p.y,p.z); });
await pg.waitForTimeout(400); await pg.screenshot({path:'/tmp/shot_roof.png'});
await b.close(); console.log('shots done');
})();
