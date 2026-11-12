/* ================================================================
   PART 3 — NIVALIS. The collar is fried and cracks off. Freezing. The
   walk: the ice cracks, tracks, a giant ant frozen in the ice, town
   lights far away. The cave: flint + the dead man's matches, the
   sleeping bag (him), his coat, knife, map, photo, tally marks. Sleep.
   Steve + Alex. The ice lab. The chair. (-> the fake world, 39_)
   Then: smoke + alarms, the watch on their table while they argue,
   dig the chip out, run through their town, the cliff, the blast.
   ================================================================ */
CHECKPOINTS.push({id:'nivalis',name:'Nivalis',level:'nivalis'},{id:'cave',name:'The Cave',level:'nivalis'},{id:'lab',name:'The Chair',level:'lab'},{id:'wake',name:'Wake Up',level:'lab'},{id:'run',name:'Their Town',level:'town'});
Object.assign(WHO_CLASS,{Steve:'steve',Alex:'alex',OldJay:'you',Jim:'jim'}); Object.assign(WHO_NAME,{Steve:'STEVE',Alex:'ALEX',OldJay:'ANSWERING MACHINE'});
/* the cold: frost at the edges of the screen, your breath, shivering (until you put the coat on) */
const COLD={on:false};
on('tick',dt=>{ let el=$('frost'); if(!el){ el=document.createElement('div'); el.id='frost'; el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity 1.5s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(200,225,255,.08) 82%,rgba(230,240,255,.28) 100%)'; document.body.appendChild(el); }
  const on=COLD.on&&!F.coat&&LV&&LV.name==='nivalis'&&G.mode==='play'; el.style.opacity=on?1:0; if(!on) return;
  if(Math.random()<dt*1.2) shake(.04);
  COLD.br=(COLD.br||0)-dt; if(COLD.br<=0){ COLD.br=rand(2.2,3.2); const p=camera.position.clone().add(camera.getWorldDirection(V3()).multiplyScalar(.5)); if(LV.soft) LV.soft.spawn(p.x,p.y-.15,p.z,rand(-.1,.1),rand(.15,.3),rand(-.1,.1),rand(1.2,1.8),.18,.9,.92,.95,.25,0,.3,1.5); } });
/* your watch light (a white beam from your wrist) */
const WLIGHT={s:null};
function watchLight(on){ if(!WLIGHT.s){ WLIGHT.s=new THREE.SpotLight(col(0xdce8ff),0,32,.62,.85,1.3); WLIGHT.t=new THREE.Object3D(); camera.add(WLIGHT.t); WLIGHT.t.position.set(0,0,-5); WLIGHT.s.target=WLIGHT.t; WLIGHT.s.position.set(-.2,-.25,0); }
  if(WLIGHT.s.parent!==camera) camera.add(WLIGHT.s); WLIGHT.s.intensity=on?1.5:0; }
function nivPeople(lv){ if(!lv.jay2){ const mk=(fn,o)=>{ const h=fn(o); h.userData.level=lv.name; lv.scene.add(h); return h; };
    lv.jay2=mk(makeJay2,{}); giveWatch(lv.jay2);
    lv.teo=mk(makeHuman,{name:'Teo',voice:'Teo',skin:0xb98a64,shirt:0x8a3a2a,pants:0x2a3040,shoes:0x2a2a2a,hair:0x1a120c,hairStyle:'spiky',eye:0x3a2a1a,build:.9,height:.97,seed:44});
    lv.bram=mk(makeHuman,{name:'Bram',voice:'Bram',skin:0xe0b090,shirt:0x3a4a3a,pants:0x2a2a2a,shoes:0x1a1a1a,hairStyle:'bald',beard:true,hair:0x5a3a20,eye:0x4a5a3a,build:1.12,height:1.04,seed:52}); }
  CUR.j2=lv.jay2; for(const h of [lv.jay2,lv.teo,lv.bram]){ resetActor(h); h.visible=false; }
  const crew=[lv.jay2]; if(F.freed&&F.teoAlive!==false) crew.push(lv.teo); if(F.freed&&F.bramAlive!==false) crew.push(lv.bram); crew.forEach(h=>h.visible=true); return crew; }
async function nivStart(id,spawn,yaw){ const lv=LEVELS.nivalis, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('nivalis',{pos:spawn}); saveCheckpoint(id); F.collared=false; torchOn(false);
  const crew=nivPeople(lv); crew.forEach((h,i)=>{ h.position.set(spawn.x-1.5-i,lv.ground(spawn.x-1.5-i,spawn.z+1),spawn.z+1+i*.5); });
  setPlayer(spawn,yaw); PLAYER.eye=1.64; setVM(true); hudVisible(true); lv.inter.length=0; COLD.on=true; watchLight(true); return {lv,crew}; }
function nivTick(lv,dt,t){
  // the ice cracks when you're out on the lake
  if(lv.cracking){ lv.crackT=(lv.crackT||0)+dt; lv.cracks.forEach((c,i)=>{ c.material.opacity=clamp(lv.crackT*1.2-i*.12,0,1); }); }
}
SCENES.nivalis=async function(){
  const {lv,crew}=await nivStart('nivalis',V3(NIV.start.x,0,NIV.start.z),0); const J=lv.jay2, fd=$('fade');
  PLAYER.lock(); PLAYER.ctl.look=true;
  // white, then the cold: you land in the snow. Normal size again.
  const wh=$('fxWhite'); wh.style.transition='none'; wh.style.opacity=1; fd.style.opacity=0; await wait(.3); wh.style.transition='opacity 2.5s'; wh.style.opacity=0;
  SND.play('body_fall',{vol:.8,rate:.8}); SND.play('wind_gust_1',{vol:.8}); crew.forEach(h=>setPose(h,'lieBack',0)); await wait(2.5); crew.forEach(h=>clearPose(h,.6));
  // the collar: fried by the blast, it cracks off (you're normal size, it's not)
  SND.play('zap_crackle',{vol:.5,rate:.6}); await wait(.5); SND.play('metal_2',{vol:.7,rate:1.4}); shake(.15); F.collarFried=true; toast('The collar cracked off','#cfc2aa');
  await say(['n_1','n_2','n_3']);
  playMusic('pyramid',4);
  freeWalk(); PLAYER.ctl.jump=true; objective('Walk. Find shelter.');
  const fol=followers(crew); SCENE_TICKS.push(fol);
  // the frozen lake: halfway across it starts to crack. Keep going.
  await waitUntil(()=>Math.hypot(PLAYER.pos.x-NIV.lake.x,PLAYER.pos.z-NIV.lake.z)<NIV.lake.r-10);
  lv.cracking=true; SND.play('block_1',{vol:1,rate:.4}); shake(.3); chat(['n_4']); later(.8,()=>SND.play('block_2',{vol:1,rate:.35}));
  // the thing in the ice
  await wait(1.2); PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(lv.giantAnt.position.clone().add(V3(0,4,0)),.8); await wait(.9); SND.play('heartbeat',{vol:.6}); await say(['n_5','n_6']);
  freeWalk(); PLAYER.ctl.jump=true;
  await waitUntil(()=>PLAYER.pos.z<NIV.lake.z-NIV.lake.r);
  lv.cracking=false; SND.play('block_1',{vol:1,rate:.3});
  // tracks + the lights far away
  await waitUntil(()=>PLAYER.pos.z<-130);
  PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(V3(NIV.town.x,10,NIV.town.z),1); await say(['n_7','n_8']);
  freeWalk(); PLAYER.ctl.jump=true; objective('The cave in the rock hill');
  await waitUntil(()=>PLAYER.pos.z<NIV.cave.z+1&&Math.abs(PLAYER.pos.x-NIV.cave.x)<6);
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(fol),1);
  saveCheckpoint('cave'); await cavePart(lv,crew);
};
SCENES.cave=async function(){ const {lv,crew}=await nivStart('cave',V3(NIV.cave.x,0,NIV.cave.z-2),0); await wait(.2); $('fade').style.opacity=0; playMusic('pyramid',2); await cavePart(lv,crew); };
async function cavePart(lv,crew){
  const J=lv.jay2, C=NIV.cave, at=(x,z)=>V3(C.x+x,lv.caveFloorY,C.z+z);
  crew.forEach((h,i)=>{ h.userData.A.path=null; h.position.copy(at(-1.5-i,-3)); });
  freeWalk(); PLAYER.ctl.jump=true;
  objective('Look around the cave');
  addInteract(lv,{obj:lv.tally,reach:4,label:'Look at the marks on the wall',act:async()=>{ PLAYER.lock(); PLAYER.ctl.look=true; await say(['c_1']); freeWalk(); F.sawTally=1; }});
  addInteract(lv,{obj:lv.bag,reach:3,when:()=>!F.pulled,label:'Open the sleeping bag',act:async()=>{ PLAYER.lock(); PLAYER.ctl.look=true; F.pulled=1; SND.play('craft',{vol:.6,rate:.7}); await wait(.6);
    lv.bones.visible=true; lv.bag.scale.set(.55,.15,1.1); lv.coat.visible=true; SND.play('gasp',{vol:.8}); shake(.15); await say(['c_2','c_3']); freeWalk(); }});
  addInteract(lv,{obj:lv.coat,reach:3,when:()=>F.pulled&&!F.coat,label:'Take his coat (and what\'s in the pockets)',act:async()=>{ F.coat=1; lv.coat.visible=false; SND.play('pickup',{vol:.7}); toast('His coat. A knife, a map, matches, a flint, a photo of his family.','#e0c08a'); F.knife=1; F.map=1; F.photo=1;
    PLAYER.lock(); PLAYER.ctl.look=true; await say(['c_4']); freeWalk(); }});
  addInteract(lv,{obj:lv.fire,reach:3,when:()=>F.coat&&!F.fireLit,label:'Light the fire (flint + his matches)',act:async()=>{ F.fireLit=1; SND.play('stone_1',{vol:.8,rate:1.4}); await wait(.4); SND.play('stone_2',{vol:.8,rate:1.5}); await wait(.5); lv.flame.visible=true; SND.play('spit',{vol:.5,rate:.6}); setAmbience([['fire',.08],['wind',.04]]); COLD.on=false; toast('Warm, finally','#ffcc66'); }});
  await waitUntil(()=>F.pulled&&F.coat&&F.fireLit);
  objective(''); crew.forEach((h,i)=>{ h.userData.A.path=null; h.position.copy(at(-1.2+i*.9,-11)); faceTo(h,at(0,-12)); setPose(h,'sit',.5); h.userData.A.seated=true; });
  J.userData.A.look='player'; await say(['c_5','c_6','c_7']); J.userData.A.look=null;
  addInteract(lv,{pos:at(1.6,-10.5),reach:2.5,label:'Lie down by the fire',act:()=>{ F.slept=3; }}); objective('Rest by the fire');
  await waitUntil(()=>F.slept===3);
  objective('');
  // Jay 2 keeps watch... and his head drops
  PLAYER.lock(); PLAYER.ctl.look=true; setPlayer(at(1.6,-10.5),yawTo(at(1.6,-10.5),at(0,-12))); PLAYER.eye=.5;
  lookAtPoint(headOf(J),.6); await say(['c_8']); await wait(2); setPose(J,'droop',1.5); await wait(2);
  await tweenVal(lids,0,1,2.5); stopMusic(3); await wait(2.5);
  // lights in your face
  SND.play('wind_gust_2',{vol:.6}); await wait(1); const beam=new THREE.SpotLight(col(0xe0f0ff),6,40,.35,.4,1); beam.position.copy(at(0,-1.5).add(V3(0,1.8,0))); beam.target.position.copy(camera.position); lv.scene.add(beam,beam.target);
  await tweenVal(lids,1,.35,.6); blurScreen(.7); await say(['c_9','c_10']); SND.play('zap',{vol:.8}); flashWhite(1,.2); await tweenVal(lids,.35,1,.3);
  lv.scene.remove(beam,beam.target); blurScreen(0); PLAYER.eye=1.64;
  await wait(1.5); runStory(()=>SCENES.lab());
}
/* ---------- the lab: Steve + Alex ---------- */
function labPeople(lv){ if(!lv.steve){ const mk=(fn,o)=>{ const h=fn(o); h.userData.level='lab'; lv.scene.add(h); return h; };
    // their NEW look: winter lab gear, older, harder
    lv.steve=mk(makeSteve,{shirt:0x1c2a38,pants:0x10161c,sleeves:'long',collar:true,stubble:.3,seed:71});
    lv.alex=mk(makeAlien,{name:'Alex',voice:'Alex',skin:0x8ab0e0,shirt:0x2a3a4a,pants:0x141a22,accent:0x6dffd8,seed:72});
    lv.jay2=mk(makeJay2,{}); giveWatch(lv.jay2); }
  return lv; }
SCENES.lab=async function(){
  const lv=LEVELS.lab, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('lab',{pos:V3(2,0,1)}); saveCheckpoint('lab'); COLD.on=false; watchLight(false); torchOn(false);
  labPeople(lv); const S=lv.steve, A=lv.alex, J=lv.jay2; CUR.j2=J;
  resetActor(J); J.position.set(-2,.45,1.1); J.rotation.y=Math.PI; setPose(J,'sit',0); J.userData.A.seated=true;
  resetActor(S); S.position.set(1,0,-2.2); faceTo(S,V3(2,1,1)); resetActor(A); A.position.set(-.6,0,-2.6); faceTo(A,V3(0,1,1));
  lv.watchOnTable.visible=true; lv.alarmL.intensity=0;
  setPlayer(V3(2,0,1.1),Math.PI); PLAYER.eye=1.2; PLAYER.lock(); PLAYER.ctl.look=true; setVM(false);
  lids(1); blurScreen(.8); fd.style.opacity=0; await wait(.5); await tweenVal(lids,1,.3,1); await tweenVal(lids,.3,.8,.3); await tweenVal(lids,.8,0,1); tweenVal(blurScreen,.8,0,2);
  playMusic('pig',3);
  S.userData.A.look='player'; A.userData.A.look='player';
  await say(['l_1','l_2','l_3']);
  // what do you say?
  const opts=[{q:'l_q1',a:['l_a1','l_a1b']},{q:'l_q2',a:['l_a2','l_a2b','l_a2c']},{q:'l_q3',a:['l_a3'],remember:'Steve'},{q:'l_q4',a:['l_a4']}];
  for(let k=0;k<2;k++){ const op=await choose(opts.map((o,i)=>({text:L(o.q).text,i})).filter(x=>!opts[x.i].used)); const o=opts[op.i]; o.used=true; await say([o.q,...o.a]); if(o.remember) remember(o.remember); }
  await say(['l_4','l_5']);
  // the chair
  S.userData.A.look=null; setPose(S,'press',.3); SND.play('hum_build',{vol:.6}); lv.chairs.forEach(c=>c.crown.material.emissiveIntensity=3);
  await wait(1); flashWhite(1,.3); SND.play('zap',{vol:.7}); await tweenVal(lids,0,1,.6); stopMusic(1); await wait(1.5);
  runStory(()=>SCENES.fake1());
};
/* ---------- waking up for real: smoke + alarms. The watch. The chip. Run. ---------- */
SCENES.wake=async function(){
  const lv=LEVELS.lab, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('lab',{pos:V3(2,0,1)}); saveCheckpoint('wake'); labPeople(lv); const S=lv.steve, A=lv.alex, J=lv.jay2;
  resetActor(J); J.position.set(-2,.45,1.1); J.rotation.y=Math.PI; setPose(J,'sit',0); J.userData.A.seated=true;
  resetActor(S); S.position.set(5.8,0,-6); faceTo(S,V3(4,0,-8)); resetActor(A); A.position.set(3.6,0,-7.2); faceTo(A,S.position);
  setPlayer(V3(2,0,1.1),Math.PI); PLAYER.eye=1.2; PLAYER.lock(); PLAYER.ctl.look=true; setVM(true);
  // smoke + alarms, the chairs sparking
  const alarm=loopSnd('static',{vol:.5,rate:.5}); lv.alarmL.intensity=4; const sm=dt=>{ lv.alarmL.intensity=Math.sin(G.time*8)>0?5:.5; if(Math.random()<dt*14) lv.soft.spawn(rand(-3,3),1.6,rand(0,2),rand(-.3,.3),rand(.6,1.2),rand(-.3,.3),rand(2,4),rand(.3,.7),.35,.37,.4,.5,0,.6,2.5); if(Math.random()<dt*3){ SND.play('zap_crackle',{vol:.3,rate:rand(.8,1.4)}); } }; SCENE_TICKS.push(sm);
  fd.style.opacity=0; await tweenVal(lids,1,0,.8); SND.play('gasp',{vol:.8}); playMusic('boss',.5);
  S.userData.A.look=A; A.userData.A.look=S; chat(['w_1','w_2','w_3']);
  clearPose(J,.3); J.userData.A.seated=false; J.position.y=0;
  PLAYER.eye=1.64; freeWalk(); PLAYER.ctl.jump=false;
  objective('Grab your watch off their table while they argue');
  await new Promise(res=>addInteract(lv,{obj:lv.watchOnTable,reach:2.2,label:'Grab your watch',act:()=>res()}));
  lv.watchOnTable.visible=false; SND.play('pickup',{vol:.8}); PLAYER.hasWatch=true;
  // the chip they bragged about: dig it out
  objective('Dig the tracker chip out of the watch');
  await new Promise(res=>addInteract(lv,{pos:V3(2,0,0),reach:20,label:F.knife?'Dig the chip out (his knife)':'Pry the chip out with your nails',act:()=>res()}));
  PLAYER.lock(); PLAYER.ctl.look=true; PLAYER.watchLook=1; SND.play('craft',{vol:.8,rate:1.6}); await wait(1.2); SND.play('metal_3',{vol:.5,rate:2}); PLAYER.watchLook=0; F.chipOut=1; toast('Chip out. They can\'t track you anymore.','#9fe0a0');
  S.userData.A.look='player'; A.userData.A.look='player'; await say(['w_4','w_5']);
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(sm),1); alarm&&alarm.stop(.5);
  saveCheckpoint('run'); runStory(()=>SCENES.run());
};
/* ---------- the town: run. Guards (aliens + robots), people at windows, gates slam, the bridge breaks. The cliff. ---------- */
const RUN={on:false,guards:[]};
SCENES.run=async function(){
  const lv=LEVELS.town, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('town',{pos:V3(0,0,6)}); saveCheckpoint('run'); COLD.on=false; watchLight(true);
  const mk=(fn,o)=>{ const h=fn(o); h.userData.level='town'; lv.scene.add(h); return h; };
  if(!lv.jay2){ lv.jay2=mk(makeJay2,{}); giveWatch(lv.jay2); lv.steve=mk(makeSteve,{shirt:0x1c2a38,pants:0x10161c,sleeves:'long',collar:true,stubble:.3,seed:71}); lv.alex=mk(makeAlien,{name:'Alex',voice:'Alex',skin:0x8ab0e0,shirt:0x2a3a4a,pants:0x141a22,accent:0x6dffd8,seed:72});
    for(let i=0;i<6;i++){ const g=i%2?mk(makeAlien,{name:'Guard',seed:80+i}):(()=>{ const r=makeRobot({}); r.userData.level='town'; lv.scene.add(r); return r; })(); RUN.guards.push(g); } }
  const J=lv.jay2, S=lv.steve, A=lv.alex; CUR.j2=J; lv.bridgeGone=false; lv.bridge.visible=true; lv.gates.forEach(g=>{ g.shut=false; g.m.position.y=14; });
  resetActor(J); J.position.set(-1.5,0,4); setPlayer(V3(0,0,6),0); resetActor(S); S.position.set(-2,0,18); resetActor(A); A.position.set(2,0,19);
  RUN.guards.forEach((g,i)=>{ g.position.set(rand(-14,14),0,30+i*4); });
  fd.style.opacity=0; playMusic('boss',.2); chat(['r_1']);
  freeWalk(); PLAYER.ctl.jump=true; objective('RUN');
  const fol=followers([J]); SCENE_TICKS.push(fol);
  RUN.on=true; RUN.caught=false;
  const chase=dt=>{ if(!RUN.on) return; const p=PLAYER.pos; const sp=3.0+Math.min(1.4,(6-p.z)*.004);
    for(const g of [S,A].concat(RUN.guards)){ const d=V3(p.x-g.position.x,0,p.z-g.position.z); const L=d.length(); if(L<1.3) RUN.caught=true; if(L>1){ g.position.addScaledVector(d.normalize(),sp*(g===S||g===A?1:1.05)*dt); g.rotation.y=Math.atan2(d.x,d.z); if(g.userData.A) g.userData.A.walk=1; } }
    // traps: the gates slam down behind you
    for(const gt of lv.gates) if(!gt.shut&&p.z<gt.z-3){ gt.shut=true; SND.play('metal_1',{vol:1,pos:gt.m.position,ref:30,rate:.5}); tweenVal(v=>{ gt.m.position.y=v; },14,3.5,.4,easeIn); for(const g of RUN.guards) if(g.position.z>gt.z) g.position.z+=0; }
    // people come to their windows
    for(const w of lv.windows) if(!w.lit&&Math.abs(w.house.position.z-p.z)<20){ w.lit=true; w.m.material=w.m.material.clone(); w.m.material.color=col(0xfff0c0); }
    // the bridge breaks right after you cross
    if(!lv.bridgeGone&&p.z<TOWN.bridge.z1-2){ lv.bridgeGone=true; SND.play('block_1',{vol:1,rate:.3}); shake(.6); tweenVal(v=>{ lv.bridge.position.y=v; lv.bridge.rotation.z=(v+.45)*.01; },-.45,-120,2,easeIn); for(const g of RUN.guards){ g.position.z=Math.max(g.position.z,TOWN.bridge.z0+4); } }
  };
  SCENE_TICKS.push(chase);
  await waitUntil(()=>RUN.caught||PLAYER.pos.z<TOWN.cliffZ+6);
  if(RUN.caught){ RUN.on=false; PLAYER.lock(); shake(.8); dmgFlash(); await tweenVal(lids,0,1,.4); cardShow('THEY GOT YOU','Try again'); await wait(2.2); cardHide(); setTimeout(()=>startAt('run',(getSave()||{}).flags||F),0); await new Promise(()=>{}); }
  // the cliff: nowhere left
  RUN.on=false; SCENE_TICKS.splice(SCENE_TICKS.indexOf(chase),1); SCENE_TICKS.splice(SCENE_TICKS.indexOf(fol),1);
  PLAYER.lock(); PLAYER.ctl.look=true; objective(''); stopMusic(2);
  lookAtPoint(V3(0,-200,TOWN.cliffZ-300),1); SND.play('wind_gust_1',{vol:1}); await wait(1.6);
  J.userData.A.path=null; J.position.set(-1.4,0,TOWN.cliffZ+6.5); S.position.set(-1,0,TOWN.cliffZ+16); A.position.set(1.5,0,TOWN.cliffZ+17); faceTo(S,PLAYER.pos); faceTo(A,PLAYER.pos);
  for(const g of RUN.guards){ g.position.set(rand(-8,8),0,TOWN.cliffZ+rand(20,26)); faceTo(g,PLAYER.pos); }
  lookAtPoint(headOf(S),.8); S.userData.A.look='player'; await say(['r_2','r_3']);
  lookAtPoint(headOf(J),.5); J.userData.A.look='player'; await say(['r_4']);
  // the watch decides for you
  const hum=loopSnd('hum_build',{vol:.9}); SND.play('ringing',{vol:.6}); await tweenVal(v=>{ PLAYER.watchGlow=v; PLAYER.watchLook=v*.6; FX.aberr=.003+v*.03; shake(.05*v); },0,1,2.4);
  chat(['r_5']); await wait(.8); SND.play('blast',{vol:1}); hum&&hum.stop(.2); shake(1.4);
  const wh=$('fxWhite'); wh.style.transition='opacity .15s'; wh.style.opacity=1; await wait(1.8); PLAYER.watchGlow=0; PLAYER.watchLook=0; FX.aberr=.003;
  await dustreachTeaser();
  const s=getSave()||{}; s.aw3done=true; writeSave(s); unlock('aw3end');
  fd.style.transition='opacity 1s'; fd.style.opacity=1; await wait(1.4); wh.style.opacity=0; TITLE.show(false);
};
/* 3 seconds of Dustreach: red desert, a dusty western town far below, a hot sun */
async function dustreachTeaser(){
  const lv=LEVELS.desert; await enterLevel('desert',{pos:V3(60,0,40)}); PLAYER.lock(); setVM(false); hudVisible(false);
  if(lv.jay2) lv.jay2.visible=false; const sky=lv.scene.background;
  FX.temp=.35; FX.saturation=1.25;
  if(!lv.dustTown){ const g=new THREE.Group(); lv.scene.add(g); lv.dustTown=g; const wM=pbrMat('rough_wood',1,{opts:{roughness:.9}}); wM.color=col(0x6a4a30);
    for(let i=0;i<12;i++){ const w=rand(6,12),h=rand(6,11); g.add(box(w,h,rand(6,10),wM,-120+i*14,h/2+lv.ground(-120+i*14,-260),-260+rand(-6,6))); } }
  lv.dustTown.visible=true;
  camShot(V3(60,40,60),V3(-60,10,-260),{dur:0,fov:50}); const wh=$('fxWhite'); wh.style.transition='opacity 1.2s'; wh.style.opacity=0;
  playMusic('desert',1); await wait(3.6); camRelease(0); stopMusic(1); FX.temp=0; FX.saturation=1;
}
