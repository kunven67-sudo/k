/* ================================================================
   THE LOOP — you OR Jay 2 die = the return sound, white, and you're
   falling through the saloon roof again (8:00 AM, day 1). Only the two
   of you remember: LOOP.know is saved and kept; everything else resets.
   THE DAY — 1 game hour = 75 s. Sundown (7 PM) = the Hollow Riders.
   ================================================================ */
const LOOP=Object.assign({n:0,know:{},deaths:0,told:{},betrayed:{}},loadJSON('aw4_loop')||{});
function saveLoop(){ saveJSON('aw4_loop',LOOP); }
function knows(k){ return !!LOOP.know[k]; }
function learn(k,msg){ if(LOOP.know[k]) return; LOOP.know[k]=1; saveLoop(); toast(msg||'You\'ll remember this (even after you die)','#e8c27a'); }
const DAY={hour:8,day:1,rate:1/75,running:false,sundownDone:0,dawnDone:0,k:1};
function clockText(){ const h=Math.floor(DAY.hour)%24, m=Math.floor((DAY.hour%1)*60/5)*5; const ap=h<12?'AM':'PM'; const hh=h%12===0?12:h%12; return hh+':'+String(m).padStart(2,'0')+' '+ap; }
(function clockHud(){ const d=document.createElement('div'); d.id='clock'; d.style.cssText='position:fixed;right:18px;top:14px;z-index:7;font:600 14px/1.2 system-ui,sans-serif;color:#f4e6c8;text-shadow:0 1px 3px #000;letter-spacing:.06em;text-align:right;pointer-events:none;display:none';
  d.innerHTML='<div id="clockT"></div><div id="clockS" style="font-size:11px;opacity:.75"></div>'; document.body.appendChild(d); })();
function clockShow(on){ $('clock').style.display=on?'':'none'; }
/* ---------- light for the hour ---------- */
const SKYK={night:[0x050816,0x0b1430,0x1a2240],dawn:[0x2a4a8a,0xd89060,0xffb070],day:[0x2a64b8,0x8ab8e8,0xf0dcb0],dusk:[0x2a2850,0xd06040,0xff9040]};
const _c1=new THREE.Color(), _c2=new THREE.Color(), _c3=new THREE.Color();
function mix3(a,b,k,out){ return out.set(a).lerp(_c2.set(b),k); }
function dayLight(lv){
  const h=DAY.hour, a=(h-6)/12*Math.PI, s=Math.sin(a), k=clamp(s*1.8+.08,0,1), warm=clamp(1-Math.abs(s)*3.2,0,1)*(h>4&&h<21?1:0); DAY.k=k;
  const dusk=h>12?SKYK.dusk:SKYK.dawn; const U=lv.sky.material.uniforms;
  for(const [key,i] of [['top',0],['mid',1],['hor',2]]){ mix3(SKYK.night[i],SKYK.day[i],k,_c1); _c1.lerp(_c3.set(dusk[i]),warm*.85); U[key].value.copy(_c1); }
  const dir=s>-.05?V3(Math.cos(a)*.85,Math.max(s,.04),.35).normalize():V3(-.35,.8,.45).normalize();
  U.sunDir.value.copy(dir); lv.rig.dir.copy(dir); FX.sunWorld=dir.clone().multiplyScalar(3000);
  lv.rig.sun.intensity=s>-.05?(.3+2.4*k):.5; lv.rig.sun.color.set(0xfff0d8).lerp(_c3.set(0xff8a40),warm).lerp(_c3.set(0x8aa0d0),1-clamp(k*3,0,1));
  lv.rig.hemi.intensity=.26+.85*k; lv.rig.hemi.color.set(0x3a4a70).lerp(_c3.set(0xb8d0f0),k); lv.rig.hemi.groundColor.set(0x1a1820).lerp(_c3.set(0xc8a070),k);
  lv.scene.fog.color.set(0x0a0e1a).lerp(_c3.set(0xd8c8a8),k).lerp(_c3.set(0xd08050),warm*.5);
  lv.stars.visible=k<.25;
  const lampOn=k<.45; for(const L of lv.lampL||[]) L.intensity=lampOn?1.6:0;
  if(lv.saloonL) lv.saloonL.intensity=1.2+(lampOn?.8:0);
  FX.exposure=1.08+(1-k)*.3;
}
function dayTick(lv,dt){
  if(!lv.sky) return;
  if(DAY.running&&G.mode==='play'&&!DLG.active){ DAY.hour+=dt*DAY.rate; if(DAY.hour>=24){ DAY.hour-=24; DAY.day++; } }
  if(DAY.running){ if(DAY.hour>=19&&DAY.hour<23.9&&DAY.sundownDone<DAY.day){ DAY.sundownDone=DAY.day; emit('sundown',DAY.day); }
    if(DAY.hour>=5&&DAY.hour<12&&DAY.day>1&&DAY.dawnDone<DAY.day){ DAY.dawnDone=DAY.day; emit('dawn',DAY.day); } }
  dayLight(lv);
  $('clockT').textContent='DAY '+DAY.day+' · '+clockText(); $('clockS').textContent=LOOP.n>0?'LOOP '+(LOOP.n+1):'';
}
function hoursLeft(){ return Math.max(0,19-DAY.hour); }
/* ---------- dying: the return ---------- */
async function loopDie(reason){
  if(LOOP.dying||G.mode!=='play') return; LOOP.dying=true; DAY.running=false;
  PLAYER.lock(); objective(''); trophyStat('deaths');
  const why={shot:'You got shot.',jay2:'Jay 2 is dead.',fell:'You fell.',mine:'Something in the dark.',blast:'The dynamite.',sleep:'Someone came in while you slept.',hanged:'The town hanged you.',train:'The train.',storm:'The storm.'}[reason]||'You died.';
  SND.play('heartbeat',{vol:.8}); dmgFlash(); shake(.6); SLOWMO.target=.25; blurScreen(.6);
  const fb=$('fxBlack'); fb.style.transition='opacity 1.4s'; fb.style.opacity=1; await wait(1.5); SLOWMO.target=1;
  stopMusic(.3); setAmbience([]);
  await card(why,'',1.6);
  // the return sound (yours if you picked a file in Settings)
  playReturnSound();
  const wh=$('fxWhite'); wh.style.transition='opacity .25s'; wh.style.opacity=1; await wait(.35); fb.style.transition='none'; fb.style.opacity=0; blurScreen(0);
  LOOP.n++; LOOP.deaths++; saveLoop();
  if(LOOP.deaths>=1) unlock('firstReturn'); if(LOOP.deaths>=10) unlock('tenLoops');
  await wait(1.6); LOOP.dying=false;
  runStory(()=>SCENES.landing());
}
function playReturnSound(){ const mode=SETTINGS.returnSnd||'game';
  if(mode==='off') return; if(mode==='file'&&SND.buf['return_custom']){ SND.play('return_custom',{vol:1}); return; }
  SND.play('return',{vol:1}); }
/* ---------- Settings > Audio: "Return sound" — Game sound / Your own file (2 clicks: the row, then the file) ---------- */
const RET_DB={open(){ return new Promise((res,rej)=>{ try{ const r=indexedDB.open('aw4',1); r.onupgradeneeded=()=>r.result.createObjectStore('f'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }catch(e){ rej(e); } }); },
  async put(k,v){ const db=await this.open(); return new Promise(res=>{ const t=db.transaction('f','readwrite'); t.objectStore('f').put(v,k); t.oncomplete=()=>res(true); t.onerror=()=>res(false); }); },
  async get(k){ const db=await this.open(); return new Promise(res=>{ const t=db.transaction('f','readonly'); const q=t.objectStore('f').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null); }); }};
async function loadCustomReturn(){ try{ const ab=await RET_DB.get('return'); if(!ab||!AU.ok) return false; const b=await new Promise((res,rej)=>{ const pr=ACtx.decodeAudioData(ab.slice(0),res,rej); if(pr&&pr.catch) pr.catch(()=>{}); }); SND.buf['return_custom']=b; return true; }catch(e){ return false; } }
(function returnSetting(){
  const pane=document.querySelector('#setBody .pane[data-p="aud"] .gs3-menu'); if(!pane) return;
  const b=document.createElement('button'); b.className='gs3-item'; b.id='setReturn'; b.innerHTML='Return sound (when you die) <span class="gs3-value" id="setReturnV"></span>'; pane.appendChild(b);
  const inp=document.createElement('input'); inp.type='file'; inp.accept='audio/*,.mp3,.ogg,.wav,.m4a'; inp.style.display='none'; document.body.appendChild(inp);
  const show=()=>{ $('setReturnV').textContent={game:'Game sound',file:'Your own file',off:'Off'}[SETTINGS.returnSnd||'game']+(SETTINGS.returnSnd==='file'&&SETTINGS.returnName?' ('+SETTINGS.returnName+')':''); };
  b.onclick=()=>{ SFX.uiClick(); const m=SETTINGS.returnSnd||'game';
    if(m==='game'){ inp.value=''; inp.click(); }       // click 1 = this row, click 2 = your file
    else if(m==='file'){ SETTINGS.returnSnd='off'; saveSettings(); show(); }
    else { SETTINGS.returnSnd='game'; saveSettings(); show(); playReturnSound(); } };
  inp.onchange=async()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const ab=await f.arrayBuffer();
    try{ initAudio(); const buf=await new Promise((res,rej)=>{ const pr=ACtx.decodeAudioData(ab.slice(0),res,rej); if(pr&&pr.catch) pr.catch(()=>{}); }); SND.buf['return_custom']=buf; await RET_DB.put('return',ab); SETTINGS.returnSnd='file'; SETTINGS.returnName=f.name.slice(0,24); saveSettings(); show(); toast('Return sound set: '+f.name,'#e8c27a'); playReturnSound(); }
    catch(e){ toast('That file isn\'t a sound this browser can play','#ff8a7a'); } };
  show(); setTimeout(()=>loadCustomReturn(),1500);
})();
