// one live game window I play by hand: curl localhost:7777/<cmd>
const { chromium } = require('playwright'); const http=require('http'); const url=require('url'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let p,b,SPEED=null,SLOW=null,PRESET='low'; const OUT=__dirname+'/view.png';
async function open(game,cp){ if(b) await b.close(); b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  p=await b.newPage({viewport:PRESET==='toaster'?{width:480,height:270}:{width:960,height:540}}); await p.addInitScript(pr=>{ for(const k of ['aw3_settings','aw4_settings','aw5_settings']) localStorage.setItem(k,JSON.stringify({preset:pr,autoLower:false,shadow:({low:1,medium:2,high:3,ultra:3})[pr]||0})); },PRESET);
  p.on('pageerror',e=>console.log('PAGE ERROR',e.message)); await p.goto('file://'+require('path').resolve(__dirname,'../..',game,'dist','index.html')+(cp?'?debug='+cp:'')+(SPEED?'&speed='+SPEED:'')+(SLOW?'&slow='+SLOW:'')); await sleep(9000); await p.mouse.click(480,270); }
const state=()=>p.evaluate(()=>({mode:G.mode,lv:LV&&LV.name,dlg:DLG.active,choice:typeof CHOICE!=='undefined'&&CHOICE.active,move:PLAYER.ctl.move,pos:[+PLAYER.pos.x.toFixed(1),+PLAYER.pos.y.toFixed(1),+PLAYER.pos.z.toFixed(1)],y:+(PLAYER.y||0).toFixed(2),yaw:+PLAYER.yaw.toFixed(2),obj:(($('objText')||{}).textContent||''),prompt:(($('prompt')||{}).textContent||''),sub:(($('subTxt')||{}).textContent||''),choices:[...document.querySelectorAll('#choices button.choice')].map(x=>x.textContent.slice(0,60)),cp:(getSave()||{}).cp}));
http.createServer(async(req,res)=>{ const q=url.parse(req.url,true), c=q.pathname.slice(1), a=q.query; let out='ok';
  try{
    if(c==='open'){ SPEED=a.speed||null; SLOW=a.slow||null; PRESET=a.preset||'low'; await open(a.game,a.cp); }
    else if(c==='key'){ await p.keyboard.down(a.k); await sleep(+a.ms||300); await p.keyboard.up(a.k); }
    else if(c==='keys'){ const ks=a.k.split(','); for(const k of ks) await p.keyboard.down(k); await sleep(+a.ms||300); for(const k of ks) await p.keyboard.up(k); }
    else if(c==='press') await p.keyboard.press(a.k);
    else if(c==='turn') await p.evaluate(([dx,dy])=>{ PLAYER.yaw-=dx; PLAYER.pitch=Math.max(-1.4,Math.min(1.4,PLAYER.pitch-dy)); },[+a.dx||0,+a.dy||0]);   // = moving the mouse
    else if(c==='click') { await p.evaluate(()=>{ INPUT.locked=true; }); const vp=p.viewportSize(); await p.mouse.move(vp.width/2,vp.height/2); await p.mouse.down({button:a.b||'left'}); await sleep(80); await p.mouse.up({button:a.b||'left'}); }
    else if(c==='wait') await sleep(+a.ms||1000);
    else if(c==='eval'){ out=String(await p.evaluate(a.js)); res.end(out+'\n'); return; }
    if(c!=='open'&&c!=='state') await sleep(150);
    if(a.shot!=='0'&&c!=='state') await p.screenshot({path:OUT});
    out=JSON.stringify(await state());
  }catch(e){ out='ERR '+e.message; }
  res.end(out+'\n'); }).listen(7777,()=>console.log('ready'));
