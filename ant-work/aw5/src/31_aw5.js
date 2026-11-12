/* ================================================================
   ANT WORK 5 — BEYOND. Puzzles + choices + sneaking + flying.
   No dying + restarting here. 5 endings.
   ================================================================ */
CHECKPOINTS.length=0; CHECKPOINTS.push({id:'mash',name:'The Mash',level:'mash'},{id:'lab',name:'Steve + Alex',level:'mash'},{id:'cliff',name:'The Tear',level:'mash'},{id:'white',name:'The White',level:'white'},{id:'beyond',name:'Beyond',level:'white'});
Object.assign(WHO_CLASS,{Steve:'steve',Alex:'alex',God:'pig',Jim:'jim'}); Object.assign(WHO_NAME,{Steve:'STEVE',Alex:'ALEX',God:'???',Jim:'JIM'});
LEVELS.mash.onKey=code=>{ if(code==='KeyT'){ timeFreeze(); return true; } return false; };
/* ---------- the watch: freeze time (T) ---------- */
const TIMEP={frozen:false,cd:0,hum:null,hist:[],histT:0};
function timeFreeze(){ if(TIMEP.cd>0||!F.canFreeze) return; TIMEP.cd=.5; TIMEP.frozen=!TIMEP.frozen; SND.play(TIMEP.frozen?'hum_purple':'swing_2',{vol:.7,rate:TIMEP.frozen?.7:.5});
  if(TIMEP.frozen){ TIMEP.hum=loopSnd('hum_build',{vol:.25,rate:.5}); FX.saturation=.25; toast('Time: FROZEN (T again to let it go)','#9fd8ff'); } else { TIMEP.hum&&TIMEP.hum.stop(.3); TIMEP.hum=null; FX.saturation=1.05; }
  PLAYER.watchGlow=TIMEP.frozen?.6:0; }
/* ---------- the mash: rocks in a loop, rewind spots, glitches, Steve + Alex scanning ---------- */
const SNEAK={on:false,seenT:0,ang:0};
function mashTick(lv,dt,t){ TIMEP.cd=Math.max(0,TIMEP.cd-dt);
  if(!TIMEP.frozen) for(const r of lv.rocks){ r.t=(r.t||0)+dt; r.o.position.y=r.base+Math.sin(r.t*1.7+r.ph)*1.3; r.o.rotation.y+=dt*.8; }
  // history for the rewind spots
  TIMEP.histT-=dt; if(TIMEP.histT<=0){ TIMEP.histT=.25; TIMEP.hist.push({p:PLAYER.pos.clone(),y:PLAYER.y,yaw:PLAYER.yaw}); if(TIMEP.hist.length>20) TIMEP.hist.shift(); }
  if(G.mode==='play'&&!DLG.active){ for(const R of lv.rew){ R.o.material.opacity=.18+Math.sin(t*5+R.x)*.06; if(Math.hypot(PLAYER.pos.x-R.x,PLAYER.pos.z-R.z)<2.2&&!TIMEP.rewinding){ rewindPlayer(); break; } } }
  // glitches
  lv.gT=(lv.gT||3)-dt; if(lv.gT<=0&&!TIMEP.frozen){ lv.gT=rand(2.5,6); const g=pick(lv.glitchers); const p0=g.position.clone(); g.position.add(V3(rand(-3,3),rand(-2,2),rand(-3,3))); later(.15,()=>g.position.copy(p0)); FX.aberr=.03; later(.12,()=>FX.aberr=.004); SND.play('static',{vol:.15,rate:rand(.8,1.3)}); }
  // Steve's scanner
  if(SNEAK.on&&G.mode==='play'&&!DLG.active&&!TIMEP.frozen){ SNEAK.ang+=dt*.6; const S=lv.steve; const yaw=Math.sin(SNEAK.ang)*.9; S.rotation.y=Math.PI+yaw; lv.scan.rotation.y=yaw;
    const to=V3(PLAYER.pos.x-S.position.x,0,PLAYER.pos.z-S.position.z), d=to.length(); const fwd=V3(Math.sin(Math.PI+yaw),0,Math.cos(Math.PI+yaw)); const ang=Math.acos(clamp(to.normalize().dot(fwd),-1,1));
    let seen=d<26&&ang<.38; if(seen){ const rc=new THREE.Raycaster(S.position.clone().add(V3(0,1.5,0)),camera.position.clone().sub(S.position.clone().add(V3(0,1.5,0))).normalize(),0,d); seen=rc.intersectObjects(lv.occluders,false).length===0; }
    SNEAK.seenT=seen?SNEAK.seenT+dt:Math.max(0,SNEAK.seenT-dt*.5); if(seen&&SNEAK.seenT>.25&&!SNEAK.warned){ SNEAK.warned=1; SND.play('watch_beep',{vol:.6,rate:.6}); }
    if(SNEAK.seenT>1.1){ SNEAK.on=false; F.caught=1; runStory(()=>labTalk(true)); } }
  else if(TIMEP.frozen&&SNEAK.on){ /* frozen: you can walk right past them */ } }
async function rewindPlayer(){ TIMEP.rewinding=true; const h=TIMEP.hist[0]; SND.play('swing_2',{vol:.8,rate:.35}); FX.aberr=.05; flashWhite(.4,.1); const fr=$('fxWhite');
  if(h){ PLAYER.pos.copy(h.p); PLAYER.y=h.y; PLAYER.yaw=h.yaw; PLAYER.vel&&PLAYER.vel.set(0,0,0); } TIMEP.hist.length=0; toast('Time rewound you. (Red = rewind)','#ff9aa0'); await wait(.6); FX.aberr=.004; TIMEP.rewinding=false; }
function jay2_5(lv){ if(!lv.jay2){ const J=makeJay2({shirt:0x2e8b57}); J.userData.level=lv.name; lv.scene.add(J); lv.jay2=J; } const J=lv.jay2; CUR.j2=J; J.visible=true; return J; }
on('tick',dt=>{ const J=CUR.j2; if(!J||!LV||J.userData.level!==LV.name||G.mode!=='play'||J.userData.hold) return;
  if(LV.name==='white'){ const want=PLAYER.pos.clone().add(V3(Math.sin(PLAYER.yaw+.8)*2.5,-.6,Math.cos(PLAYER.yaw+.8)*2.5)); J.position.lerp(want,1-Math.exp(-dt*2)); J.rotation.y=PLAYER.yaw+Math.PI; return; }
  const d=Math.hypot(J.position.x-PLAYER.pos.x,J.position.z-PLAYER.pos.z); if(TIMEP.frozen) return;
  if(d>14){ J.position.set(PLAYER.pos.x+1.5,0,PLAYER.pos.z+1.5); } else if(d>3.2&&(J.userData.fT=(J.userData.fT||0)-dt)<=0){ J.userData.fT=.6; walkTo(J,[PLAYER.pos.clone().add(V3(Math.sin(PLAYER.yaw+.7)*1.8,0,Math.cos(PLAYER.yaw+.7)*1.8))],d>7?3.8:1.8); }
  J.position.y=LV.ground(J.position.x,J.position.z); });
/* ---------- the story ---------- */
SCENES.mash=async function(){ const lv=LEVELS.mash, fd=$('fade'); if(LV!==lv) await enterLevel('mash',{pos:V3(0,0,10)}); saveCheckpoint('mash'); F.canFreeze=0; TIMEP.frozen=false; FX.saturation=1.05;
  const J=jay2_5(lv); resetActor(J); J.position.set(1.6,0,8); setPose(J,'lieBack',0); setPlayer(V3(0,0,10),Math.PI); PLAYER.lock(); PLAYER.eye=.5;
  fd.style.transition='none'; fd.style.opacity=1; lids(1); await wait(.4); fd.style.transition='opacity 2s'; fd.style.opacity=0; playMusic('pyramid',3);
  await tweenVal(lids,1,.4,1.2); await tweenVal(lids,.4,.8,.4); await tweenVal(lids,.8,0,1.2); PLAYER.eye=1.64; clearPose(J,.8);
  PLAYER.ctl.look=true; await say(['x_1','x_2','x_3']); lookAtPoint(lv.glitchers[0].position,.8); await say(['x_4','x_5']);
  freeWalk(); PLAYER.ctl.jump=true; objective('Find a way out of... whatever this is');
  await waitUntil(()=>PLAYER.pos.z<-55); runStory(()=>SCENES.lab()); };
SCENES.lab=async function(){ const lv=LEVELS.mash; if(LV!==lv){ await enterLevel('mash',{pos:V3(0,0,-50)}); setPlayer(V3(0,0,-50),Math.PI); } saveCheckpoint('lab'); const J=jay2_5(lv);
  if(!lv.steve){ const S=makeSteve({}); S.userData.level='mash'; lv.scene.add(S); lv.steve=S; const A=makeAlien({name:'Alex',voice:'Alex'}); A.userData.level='mash'; lv.scene.add(A); lv.alex=A;
    lv.scan=new THREE.Group(); const cone=mesh(new THREE.ConeGeometry(9,26,24,1,true),new THREE.MeshBasicMaterial({color:col(0x7ac8ff),transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),0,1.5,-13,false); cone.rotation.x=Math.PI/2; lv.scan.add(cone); lv.scene.add(lv.scan); }
  const S=lv.steve, A=lv.alex; resetActor(S); resetActor(A); S.position.set(0,0,-94); S.rotation.y=Math.PI; A.position.set(2.2,0,-97); faceTo(A,lv.console.position); setPose(A,'type',.3); lv.scan.position.set(0,0,-94);
  PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(headOf(S),.8); J.userData.A.look='player'; await say(['x_lab1','x_lab2']);
  freeWalk(); PLAYER.ctl.jump=true; objective('Sneak past Steve + Alex (stay out of the blue light, use the cover)'); SNEAK.on=true; SNEAK.seenT=0; SNEAK.warned=0;
  await waitUntil(()=>PLAYER.pos.z<-100||F.caught); if(F.caught) return; SNEAK.on=false; F.snuck=1;
  const r=await choose([{text:'Keep going. Don\'t let them see us.'},{text:'Talk to them anyway'}]); if(r.text.startsWith('Talk')) return labTalk(false);
  runStory(()=>SCENES.cliff()); };
async function labTalk(caught){ const lv=LEVELS.mash, S=lv.steve, A=lv.alex; PLAYER.lock(); PLAYER.ctl.look=true; clearPose(A,.3); faceTo(S,PLAYER.pos); faceTo(A,PLAYER.pos); S.userData.A.look='player'; A.userData.A.look='player'; lookAtPoint(headOf(S),.5);
  await say(caught?['x_s1','x_s2']:['x_s1b','x_s2']);
  for(let i=0;i<3;i++){ const r=await choose([{text:'What IS this watch?',w:!F.askedW},{text:'"Come with us."'},{text:'"Stay away from us."'}].filter(o=>o.w!==false));
    if(r.text.startsWith('What')){ F.askedW=1; await say(['x_w1','x_a1','x_a2']); continue; }
    if(r.text.startsWith('"Come')){ F.withSA=1; await say(['x_join','x_s3','x_a3']); break; }
    await say(['x_away','x_s4']); break; }
  SNEAK.on=false; runStory(()=>SCENES.cliff()); }
SCENES.cliff=async function(){ const lv=LEVELS.mash; if(LV!==lv){ await enterLevel('mash',{pos:V3(0,0,-108)}); setPlayer(V3(0,0,-108),Math.PI); } saveCheckpoint('cliff'); jay2_5(lv); SNEAK.on=false;
  if(F.withSA&&lv.steve){ lv.steve.position.set(-3,0,-104); lv.alex.position.set(3,0,-104); }
  F.canFreeze=1; PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(MASH.tear,1); await say(['x_c1','x_c2']); await tweenVal(v=>PLAYER.watchGlow=v,0,.8,.5); later(.8,()=>PLAYER.watchGlow=0); toast('Press T: your watch FREEZES time. Press T again to let it go.','#9fd8ff');
  freeWalk(); PLAYER.ctl.jump=true; objective('Get up to the tear (freeze the rocks with T, then climb)');
  await waitUntil(()=>PLAYER.pos.distanceTo(V3(MASH.tear.x,0,MASH.tear.z))<4&&PLAYER.y>10); if(TIMEP.frozen) timeFreeze(); F.canFreeze=0;
  PLAYER.lock(); SND.play('blast',{vol:.8}); const wh=$('fxWhite'); wh.style.transition='opacity .8s'; wh.style.opacity=1; await wait(1.2); runStory(()=>SCENES.white()); };
SCENES.white=async function(){ const lv=LEVELS.white, wh=$('fxWhite'); if(LV!==lv) await enterLevel('white',{pos:V3(0,6,10)}); saveCheckpoint('white'); setPlayer(V3(0,6,10),Math.PI); PLAYER.pos.y=6;
  const J=jay2_5(lv); J.userData.level='white'; J.position.set(2,5.4,10); setPose(J,'droop',0); wh.style.transition='opacity 2s'; wh.style.opacity=0; playMusic('sad',3); F.seen=F.seen||{};
  PLAYER.lock(); PLAYER.ctl.look=true; await wait(1.5); await say(['x_w_1','x_w_2','x_w_3']); clearPose(J,.5);
  toast('There\'s no ground here. FLY: WASD, Space = up, C = down','#cfd8e8'); freeWalk(); objective('Look into the glass boxes');
  for(const B of WHITE.boxes){ const g=lv.boxes[B.id]; addInteract(lv,{obj:g,reach:g.userData.S*.9,label:'Look inside',when:()=>!F.seen[B.id],act:()=>lookBox(B.id)}); }
  await waitUntil(()=>['desert','nivalis','gulch','beach','time','thing'].filter(k=>F.seen[k]).length>=4&&F.seen.beach);
  objective('The door'); PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(WHITE.door,1); SND.play('hum_purple',{vol:.8}); await tweenVal(v=>lv.door.material.opacity=v,0,1,2); await say(['x_door']); freeWalk();
  await waitUntil(()=>PLAYER.pos.distanceTo(WHITE.door)<4.5); runStory(()=>SCENES.beyond()); };
async function lookBox(id){ const lv=LEVELS.white, g=lv.boxes[id]; F.seen[id]=1; PLAYER.lock(); PLAYER.ctl.look=true;
  const from=camera.position.clone(); camFollow(t=>{ const k=Math.min(1,t/1.2); return {pos:from.clone().lerp(g.position.clone().add(V3(0,0,g.userData.S*.75)),smooth(k)),look:g.position.clone().add(V3(0,-1,0)),fov:60}; },60); CAM.fnT=0; await wait(1.3);
  if(id==='thing'){ let k=0; const tk=dt=>{ k+=dt; FX.aberr=.02+k*.02; shake(.05+k*.03); blurScreen(Math.min(.6,k*.3)); }; SCENE_TICKS.push(tk); SND.play('static',{vol:.8,rate:.4}); await say(['x_thing1','x_thing2']); SCENE_TICKS.splice(SCENE_TICKS.indexOf(tk),1); FX.aberr=.004; blurScreen(0); unlock('looked'); }
  else if(id==='beach'){ const J=lv.jim; J.userData.A.look=camera; await say(['x_jim1','x_jim2','x_jim3','x_jim4']); unlock('vacation'); }
  else await say({desert:['x_desert'],nivalis:['x_niv'],gulch:['x_gulch','x_gulch2'],time:['x_time']}[id]);
  camRelease(.6); await wait(.6); freeWalk(); }
/* ---------- BEYOND ---------- */
SCENES.beyond=async function(){ const lv=LEVELS.white, wh=$('fxWhite'); if(LV!==lv) await enterLevel('white',{pos:WHITE.beyondAt}); saveCheckpoint('beyond'); const J=jay2_5(lv); J.userData.level='white';
  wh.style.transition='opacity .4s'; wh.style.opacity=1; await wait(.5); lv.scene.background=col(0x050508); lv.scene.fog.color.set(0x050508); lv.scene.fog.density=.0008; lv.godL.intensity=3; setPlayer(WHITE.beyondAt.clone().add(V3(0,10,0)),Math.PI); PLAYER.pos.y=10; J.position.copy(PLAYER.pos).add(V3(2,-.5,0));
  const SA=F.withSA; if(SA){ const s=makeSteve({}), a=makeAlien({name:'Alex',voice:'Alex'}); for(const h of [s,a]){ h.userData.level='white'; lv.scene.add(h); } s.position.copy(PLAYER.pos).add(V3(-2.5,-.8,1)); a.position.copy(PLAYER.pos).add(V3(4,-.8,1)); lv.sa=[s,a]; }
  wh.style.transition='opacity 2.5s'; wh.style.opacity=0; stopMusic(2); PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(WHITE.god,2); await wait(2.5); playMusic('boss',4); SND.play('hum_purple',{vol:1,rate:.4});
  await say(['g5_1','x_b1','g5_2','g5_3','g5_4']);
  await say(['x_b2','g5_5']); // Jay 2 says the thing he shouldn't
  // telekinesis: the god lifts you by the throat
  J.userData.hold=1; const y0=PLAYER.pos.y; const breath=loopSnd('breath_heavy',{vol:.8,rate:.8}); const ring=mesh(new THREE.TorusGeometry(.45,.03,8,40),new THREE.MeshBasicMaterial({color:col(0xffd890)}),0,0,-.5,false); camera.add(ring); ring.position.set(0,-.35,-.5); ring.rotation.x=Math.PI/2;
  const ch=dt=>{ PLAYER.pos.y=lerp(PLAYER.pos.y,y0+3,dt*.8); shake(.06); }; SCENE_TICKS.push(ch); const dm=setInterval(()=>dmgFlash(),900); blurScreen(.35); SND.play('gasp',{vol:1});
  await say(['g5_6','x_b3']);
  const opts=[{text:'Give the watch back'},{text:'"...No. It\'s mine now."'},{text:'Break the watch'},{text:'"Fix everything. Bring Bob back."'}]; if(SA) opts.push({text:'(Alex) "Take me instead. Let them go."'}); else opts.push({text:'(Jay 2) "Take ME. Let him go home."'});
  const r=await choose(opts); const i=opts.findIndex(o=>o.text===r.text);
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(ch),1); clearInterval(dm); breath&&breath.stop(.4); camera.remove(ring); blurScreen(0); J.userData.hold=0;
  await [endHome,endWander,endBlank,endRewrite,endOther][i](SA); };
async function endCard(title,sub,id){ stopMusic(2); const fd=$('fade'); fd.style.transition='opacity 2s'; fd.style.opacity=1; await wait(2.2); await card(title,sub,3.4); unlock('end_'+id);
  const s=getSave()||{}; s.endings=Object.assign({},s.endings||{},{[id]:1}); writeSave(s); const n=Object.keys(s.endings).length; await card('ENDING '+n+' / 5 FOUND','',2.2); if(n>=5) unlock('allEndings');
  await card('ANT WORK','Thank you for playing. (The last boss? You decide when.)',3); fd.style.opacity=0; TITLE.show(false); }
async function endHome(){ await say(['x_e_home','g5_home']); const wh=$('fxWhite'); wh.style.transition='opacity 1.5s'; wh.style.opacity=1; await wait(1.6); PLAYER.pos.y=0; await say(['x_home1','x_home2']); wh.style.opacity=0; await endCard('ENDING: HOME','You gave it back. The ants are still at work.','home'); }
async function endWander(){ await say(['x_e_keep','g5_keep']); await endCard('ENDING: WANDERERS','Two Jays. Every reality. Forever.','wander'); }
async function endBlank(){ await say(['x_e_break','g5_break']); SND.play('glass_break',{vol:1}); SND.play('blast',{vol:1}); const wh=$('fxWhite'); wh.style.transition='opacity .2s'; wh.style.opacity=1; await wait(2); await card('...','Nobody remembers. Not even you.',3); wh.style.opacity=0; await endCard('ENDING: BLANK','','blank'); }
async function endRewrite(){ await say(['x_e_fix','g5_fix','g5_fix2']); await endCard('ENDING: REWRITE','Bob is alive. You keep the boxes now.','rewrite'); }
async function endOther(SA){ if(SA){ await say(['x_e_alex','g5_alex','x_alexbye']); } else { await say(['x_e_j2','g5_j2','x_j2bye','x_j2bye2']); } await endCard(SA?'ENDING: ALEX':'ENDING: THE OTHER YOU',SA?'Alex stayed. Steve never forgave you.':'Jay 2 stayed. You went home alone.','other'); }
/* ---------- the title: the white, the boxes ---------- */
TITLE.show=async function(first){ resetStory(); cleanUI(); G.mode='menu'; G.paused=false; unlockPointer(); const lv=LEVELS.white; await enterLevel('white',{pos:V3(0,6,10)},{keepMusic:true}); lv.scene.background=col(0xf2f2f4); lv.scene.fog.color.set(0xf2f2f4); lv.scene.fog.density=lv.fogW; lv.door.material.opacity=0;
  PLAYER.lock(); setVM(false); crosshair(false); hudVisible(false); camFollow(t=>{ const a=t*.02; return {pos:V3(Math.sin(a)*70,10+Math.sin(t*.1)*3,-90+Math.cos(a)*70),look:V3(0,4,-95),fov:55}; },55);
  playMusic('title',first?3:1.5); $('title').classList.remove('hide'); $('title').style.opacity=1; const s=getSave(); const has=!!(s&&s.cp);
  $('btnContinue').classList.toggle('hide',!has); $('contWhere').textContent=has?CP(s.cp).name:''; $('trophyCount').textContent=Object.keys(TROPHY).length+' / '+TROPHY_DEFS.length;
  if(TITLE.nav) TITLE.nav.stop(); TITLE.nav=GS3Console.nav($('titleMenu'),{first:has?$('btnContinue'):$('btnNew')}); };
$('btnContinue').onclick=()=>{ const s=getSave(); if(!s||!s.cp) return; SFX.uiClick(); startAt(s.cp,s.flags||{}); };
$('btnNew').onclick=()=>{ SFX.uiClick(); startAt('mash',{}); };
