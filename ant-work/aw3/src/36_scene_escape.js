/* ================================================================
   PART 2, PIECE 3 — THE ESCAPE (night 5)
   The splinter torch, your cage door, free Teo + Bram (or run), Jay 2
   knocks the spoon, the pig wakes: his hand slams down where you are,
   the tablecloth slide, the floor run (the crack between the stones
   is where his fingers can't reach), his hand closes over you, the
   watch glows, everyone holds on... BLAST.
   ================================================================ */
CHECKPOINTS.push({id:'escape',name:'Night 5',level:'table'},{id:'chase',name:'The Chase',level:'table'});
/* ---------- the splinter torch ---------- */
const TORCH={g:null,light:null,back:false};
function torchMesh(){ const g=new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(.012,.016,.42,6),new THREE.MeshStandardMaterial({color:col(0x8a6a44),roughness:.9}),0,.0,-.12).rotateX(Math.PI/2));
  const fl=mesh(GC('torchFlame',()=>{ const s=new THREE.SphereGeometry(.035,10,8); s.scale(1,1.8,1); return s; }),new THREE.MeshBasicMaterial({color:col(0xffa040).multiplyScalar(2.2)}),0,.05,-.33,false); g.add(fl); g.userData.flame=fl;
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.renderOrder=10; } }); return g; }
function torchOn(on){
  if(!TORCH.light){ TORCH.light=new THREE.PointLight(col(0xffa055),0,16,2); }
  if(on&&F.torchLit){ if(!TORCH.g) TORCH.g=torchMesh(); if(TORCH.light.parent!==camera) camera.add(TORCH.light); TORCH.light.position.set(.25,-.2,-.6);
    if(!ARENA.active){ if(VM.wpn&&VM.wpn!==TORCH.g) VM.grp.remove(VM.wpn); VM.wpn=TORCH.g; if(TORCH.g.parent!==VM.grp) VM.grp.add(TORCH.g); } TORCH.on=true; }
  else { TORCH.on=false; TORCH.light.intensity=0; if(VM.wpn===TORCH.g){ VM.grp.remove(TORCH.g); VM.wpn=null; } }
}
on('tick',dt=>{ if(!TORCH.on||!TORCH.light) return; const t=G.time; const f=1+noise1(t*9)*.18+noise1(t*23)*.08;
  TORCH.light.intensity=(TORCH.back?.45:2.6)*f; if(TORCH.g){ TORCH.g.visible=!TORCH.back; const fl=TORCH.g.userData.flame; fl.scale.set(1+noise1(t*13)*.15,1+noise1(t*11+2)*.25,1); }
  if(TORCH.back) TORCH.light.position.set(.2,-.5,.5); else TORCH.light.position.set(.25,-.2,-.6); });
/* the pig sees a torch held out front, even behind cover. Hold it behind you (T) to hide. */
function torchGivesYouAway(){ return TORCH.on&&!TORCH.back; }
/* splinter + match: available every night */
function torchInteracts(lv){
  const yc=cageOf('you');
  addInteract(lv,{pos:V3(yc.x+1.6,CAGE_Y,yc.z+1.6),reach:2.2,when:()=>!F.splinter,label:'Pull a splinter off the floor board',act:()=>{ F.splinter=1; SND.play('craft',{vol:.8,rate:1.4}); toast('Splinter: light it on the match by the cup','#e0c08a'); }});
  addInteract(lv,{obj:lv.match,offset:V3(-4.3*Math.cos(.4),.5,4.3*Math.sin(.4)),reach:3.5,when:()=>F.splinter&&!F.torchLit,label:'Light your splinter on the match',act:()=>{ F.torchLit=1; SND.play('spit',{vol:.4,rate:1.8}); torchOn(true); toast('Torch lit. T = hold it behind you (he can see the fire)','#ffcc66'); }});
}
/* ---------- the escape ---------- */
SCENES.escape=async function(){
  const lv=await tableStart('escape','night'); const J=lv.jay2, A=TABLE.arena, yc=cageOf('you');
  lv.orrin.visible=false; F.key=true; if(!F.inv) F.inv={bone:0,thorn:0,thread:0,pebbles:2,bspear:1};
  for(const c of TABLE.cages){ c.doorOpen=false; if(c.door) c.door.rotation.y=0; }
  lv.floorMode=false; lv.col.bounds=lv.tableBounds; lv.spoon2.visible=true; lv.spoon2.position.set(TABLE.cup.x-4.2,3.2,TABLE.cup.z-1); lv.spoon2.rotation.set(-1.1,0,.15); lv.thread2.visible=!!F.savedJay2;
  if(F.savedJay2===false){ setPose(J,'sit',0); J.userData.A.seated=true; }
  playMusic('night',2); PLAYER.lock(); PLAYER.ctl.look=true;
  await dayCard('NIGHT 5');
  torchInteracts(lv); torchOn(true);
  J.userData.A.look='player'; await say(['e_1']); J.userData.A.look=null;
  // your cage door: the key
  freeWalk(); PLAYER.ctl.jump=false; NIGHT.on=true; NIGHT.alert=0;
  const unlock=(id,after)=>addInteract(lv,{pos:V3(cageOf(id).x,CAGE_Y,cageOf(id).z-CAGE.d/2),reach:2.4,when:()=>!cageOf(id).doorOpen,label:'Unlock the door with the key',act:async()=>{ const c=cageOf(id);
    SND.play('cage_lock',{vol:.7,rate:1.2}); await wait(.4); c.doorOpen=true; SND.play('metal_1',{vol:.35,rate:1.4}); tweenVal(v=>{ c.door.rotation.y=v; },0,-1.6,.8); after&&after(); }});
  unlock('you'); objective('Unlock your cage door with the key');
  await waitUntil(()=>yc.doorOpen);
  J.userData.A.seated=false; clearPose(J,.3);
  // Teo begs. Serious = timer.
  lv.teo.userData.A.look='player'; chat(['e_t1']); await wait(1.2);
  const r=await timedChoice([{text:'Free them'},{text:'Run'}],6,1);
  if(r===0){ F.freed=true; F.teoAlive=true; F.bramAlive=true; objective("Unlock Teo's and Bram's cages");
    let n=0; unlock('teo',()=>n++); unlock('bram',()=>n++); await waitUntil(()=>n>=2); objective('');
    for(const [h,id] of [[lv.teo,'teo'],[lv.bram,'bram']]){ resetActor(h); h.userData.A.seated=false; const c=cageOf(id); h.position.set(c.x,CAGE_Y,c.z-CAGE.d/2-1.2); }
    lv.bram.userData.A.look='player'; await say(['e_f1']); lv.bram.userData.A.look=null; }
  else { F.freed=false; await say(['e_t2']); await wait(1.2); await say(['e_t3']); remember('They'); lv.teo.userData.A.look=null; }
  // go: down the ruler, across the table to where the tablecloth hangs
  objective('Get to the far end of the table, where the tablecloth hangs off');
  const crew=[J].concat(F.freed?[lv.teo,lv.bram]:[]);
  const follow=followers(crew); SCENE_TICKS.push(follow);
  // halfway, by the cup: Jay 2 knocks the leaning spoon (stung: his leg; saved: the thread)
  await waitUntil(()=>(PLAYER.pos.x>TABLE.cup.x-12&&PLAYER.y<.6)||NIGHT.alert>0);
  if(NIGHT.alert===0){
    J.userData.A.path=null; J.position.set(TABLE.cup.x-6,0,TABLE.cup.z-4.6); faceTo(J,lv.spoon2.position);
    if(F.savedJay2===false){ setPose(J,'startle',.15); chat(['e_k1']); } else { setPose(J,'startle',.15); chat(['e_k2']); }
    await wait(.5); const sp=lv.spoon2, p0=sp.position.clone(), r0=sp.rotation.x;
    await tweenVal(k=>{ sp.rotation.x=lerp(r0,-1.55,k); sp.position.y=lerp(p0.y,.3,k); },0,1,.45,easeIn);
    SND.play('metal_2',{vol:1,pos:sp.position,ref:40,rate:.55}); later(.3,()=>SND.play('metal_3',{vol:.9,pos:sp.position,ref:40,rate:.5})); clearPose(J,.4); }
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(follow),1);
  saveCheckpoint('chase');
  await chaseRun(lv);
};
SCENES.chase=async function(){
  const lv=await tableStart('chase','night'); const J=lv.jay2; lv.orrin.visible=false;
  for(const c of TABLE.cages) if(c.door){ c.doorOpen=c.id==='you'||(F.freed&&(c.id==='teo'||c.id==='bram')); c.door.rotation.y=c.doorOpen?-1.6:0; }
  lv.floorMode=false; lv.col.bounds=lv.tableBounds; lv.spoon2.visible=true; lv.spoon2.position.set(TABLE.cup.x-4.2,.3,TABLE.cup.z-1); lv.spoon2.rotation.set(-1.55,0,.15);
  if(F.torchLit) torchOn(true);
  setPlayer(V3(TABLE.cup.x-8,0,TABLE.cup.z-7),-Math.PI/2); resetActor(J); J.position.set(TABLE.cup.x-6,0,TABLE.cup.z-4.6);
  if(F.freed){ if(F.teoAlive!==false){ resetActor(lv.teo); lv.teo.position.set(TABLE.cup.x-10,0,TABLE.cup.z-6); } if(F.bramAlive!==false){ resetActor(lv.bram); lv.bram.position.set(TABLE.cup.x-11,0,TABLE.cup.z-8); } }
  await dayCard('THE CHASE');
  await chaseRun(lv);
};
/* everyone who's with you follows you (Jay 2 slower if the scorpion got him) */
function followers(list){ let t=0; return dt=>{ t-=dt; if(t>0) return; t=.7; list.forEach((h,i)=>{ if(!h.visible||h.userData.down) return;
  const back=V3(Math.sin(PLAYER.yaw),0,Math.cos(PLAYER.yaw)), side=V3(Math.cos(PLAYER.yaw),0,-Math.sin(PLAYER.yaw));
  const goal=PLAYER.pos.clone().addScaledVector(back,2.2+i*1.3).addScaledVector(side,(i%2?1:-1)*1.3); goal.y=0;
  if(h.position.distanceTo(goal)>1.6) walkTo(h,[goal],h===LEVELS.table.jay2&&F.savedJay2===false?2.6:3.6); }); }; }
/* ---------- the chase ---------- */
const CHASE={on:false,slamT:0,caught:false,fast:false};
async function chaseRun(lv){
  const P=lv.pig.userData.pig, J=lv.jay2;
  NIGHT.on=false; objective(''); torchOn(!!F.torchLit);
  // he wakes up... silence, your heartbeat... then the drums
  stopMusic(.2); const hb=loopSnd('heartbeat',{vol:.9});
  tweenVal(v=>{ P.sleep=v; },P.sleep,0,.6); P.look=camera; P.lookSpeed=2.5; SND.play('pig_4',{vol:1,pos:V3(0,44,-40),ref:90,rate:.55});
  await wait(1.2); SND.play('pig_squeal',{vol:1,pos:V3(0,44,-40),ref:90,rate:.6}); await tweenVal(v=>{ P.stand=v; },0,.55,1.4);
  hb&&hb.stop(.5); playMusic('boss',.1); chat(['e_c1']);
  freeWalk(); PLAYER.ctl.jump=true; objective('RUN to the tablecloth at the far end');
  const crew=[J].concat(F.freed?[lv.teo,lv.bram].filter((h,i)=>i?F.bramAlive!==false:F.teoAlive!==false):[]);
  const follow=followers(crew); SCENE_TICKS.push(follow);
  CHASE.on=true; CHASE.caught=false; CHASE.slamT=1.6; CHASE.fast=false;
  const slamTick=dt=>{ if(!CHASE.on) return; CHASE.slamT-=dt; if(CHASE.slamT<=0&&!CHASE.busy){ CHASE.slamT=rand(2.0,2.6); handSlam(lv,predict(1.1)); } };
  SCENE_TICKS.push(slamTick);
  // the two "Both moments" (only if you freed them)
  let didBram=false, didTeo=false;
  for(;;){
    await waitUntil(()=>CHASE.caught||PLAYER.pos.x>46&&Math.abs(PLAYER.pos.z)<8||(F.freed&&!didBram&&F.bramAlive!==false&&PLAYER.pos.x>18)||(F.freed&&!didTeo&&F.teoAlive!==false&&PLAYER.pos.x>32));
    if(CHASE.caught) return chaseCaught(lv,'chase');
    if(F.freed&&!didBram&&PLAYER.pos.x>18&&PLAYER.pos.x<=46){ didBram=true; await pinnedMoment(lv,lv.bram,'bram'); continue; }
    if(F.freed&&!didTeo&&PLAYER.pos.x>32&&PLAYER.pos.x<=46){ didTeo=true; await tripMoment(lv,lv.teo); continue; }
    break; }
  // the tablecloth: grab the edge and slide down to the floor
  CHASE.on=false; chat(['e_c4']); PLAYER.lock();
  const z0=clamp(PLAYER.pos.z,-6,6), from=V3(49,1.5,z0);
  SND.play('swing_2',{vol:.9,rate:.6});
  camFollow(t=>{ const k=Math.min(1,t/2.3); return {pos:V3(lerp(49,51.2,smooth(k)),lerp(1.6,-34.3,k*k),z0+Math.sin(k*9)*.3),look:V3(53,lerp(-6,-36,k),z0)}; },72); CAM.fnT=0;
  for(const h of crew) h.visible=false;
  await wait(2.4); camRelease(0);
  lv.floorMode=true; lv.col.bounds=lv.floorBounds; setPlayer(V3(53,0,z0),-Math.PI/2); PLAYER.y=-36; PLAYER.onGround=true; shake(.4); SND.play('body_fall',{vol:.8});
  crew.forEach((h,i)=>{ h.visible=true; resetActor(h); h.position.set(52.5,-36,z0+(i+1)*1.4); });
  await floorRun(lv,crew,slamTick,follow);
}
function predict(sec){ const v=PLAYER.vel||V3(); return V3(PLAYER.pos.x+(v.x||0)*sec*.8,0,PLAYER.pos.z+(v.z||0)*sec*.8); }
/* his hand comes down: a shadow first, then SLAM */
async function handSlam(lv,at){
  if(CHASE.busy) return; CHASE.busy=true;
  const arm=lv.bigArm||(lv.bigArm=makeGiantArm(lv)); arm.visible=true; armGrip(arm,.25);
  const gy=lv.floorMode?-36:lv.ground(at.x,at.z), warn=CHASE.fast?.55:1.05;
  const sh=mesh(new THREE.CircleGeometry(3.4,32),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false}),at.x,gy+.06,at.z,false); sh.rotation.x=-Math.PI/2; lv.scene.add(sh);
  const hi=V3(at.x,gy+34,at.z), lo=V3(at.x,gy+1.0,at.z);
  armPlace(arm,hi,.05);
  await tweenVal(k=>{ sh.material.opacity=k*.55; sh.scale.setScalar(.5+k*.6); armPlace(arm,hi.clone().lerp(V3(at.x,gy+14,at.z),k),.05); },0,1,warn);
  CHASE.fast=false;
  await tweenVal(k=>{ armPlace(arm,V3(at.x,gy+14,at.z).lerp(lo,k),.05); },0,1,.16,easeIn);
  shake(.7); SND.play('body_fall',{vol:1,pos:lo,ref:30,rate:.45}); SND.play('pig_'+randi(1,6),{vol:.8,pos:V3(0,44,-40),ref:90,rate:.6});
  // you're under it = he's got you (but not down in the crack between the floor stones)
  const d=Math.hypot(PLAYER.pos.x-at.x,PLAYER.pos.z-at.z), inCrack=lv.floorMode&&PLAYER.pos.z>FLOOR.crack0&&PLAYER.pos.z<FLOOR.crack1;
  if(d<3.0&&!inCrack&&CHASE.on) CHASE.caught=true;
  // the cup tips over if he hits next to it
  if(!lv.floorMode&&!lv.cupDown&&Math.hypot(at.x-TABLE.cup.x,at.z-TABLE.cup.z)<9){ lv.cupDown=true; SND.play('metal_1',{vol:1,rate:.4}); }
  await wait(.35); sh.parent&&sh.parent.remove(sh);
  await tweenVal(k=>{ armPlace(arm,lo.clone().lerp(hi,k),.05); },0,1,.6);
  arm.visible=false; CHASE.busy=false;
}
async function chaseCaught(lv,cp){
  CHASE.on=false; PLAYER.lock(); SND.play('pig_squeal',{vol:1,rate:.6}); shake(1); dmgFlash();
  await tweenVal(lids,0,1,.4); cardShow('HE GOT YOU','Try again'); await wait(2.4); cardHide();
  const s=getSave()||{}; setTimeout(()=>startAt(cp,s.flags||F),0); await new Promise(()=>{});
}
/* Bram: pinned under his finger. Pull him free (risky) or keep running */
async function pinnedMoment(lv,B){
  CHASE.on=false; const arm=lv.bigArm||(lv.bigArm=makeGiantArm(lv));
  B.userData.A.path=null; B.position.set(PLAYER.pos.x-4,lv.ground(PLAYER.pos.x-4,PLAYER.pos.z),PLAYER.pos.z+2); setPose(B,'lieBack',.1); B.userData.down=true;
  arm.visible=true; armGrip(arm,.6); armPlace(arm,V3(B.position.x,B.position.y+1.3,B.position.z),.05); shake(.6); SND.play('body_fall',{vol:1,rate:.5});
  lookAtPoint(B.position.clone().add(V3(0,.5,0)),.3); chat(['e_c2']);
  const r=await timedChoice([{text:'Pull Bram free'},{text:'Keep running'}],5,1);
  if(r===0){ SND.play('oof_1',{vol:.8}); await wait(.6); B.userData.down=false; clearPose(B,.3); F.bramAlive=true; remember('He'); CHASE.fast=true; }
  else { F.bramAlive=false; await tweenVal(k=>{ armPlace(arm,V3(B.position.x,B.position.y+1.3+k*30,B.position.z),.05); B.position.y+=k*.8; },0,1,1.2); B.visible=false; remember('He'); }
  arm.visible=false; CHASE.on=true; CHASE.slamT=.8; freeWalk(); PLAYER.ctl.jump=true;
}
/* Teo trips and falls behind. Go back for him or leave him */
async function tripMoment(lv,T){
  CHASE.on=false; T.userData.A.path=null; T.position.set(PLAYER.pos.x-6,lv.ground(PLAYER.pos.x-6,PLAYER.pos.z),PLAYER.pos.z-1); setPose(T,'lieBack',.15); T.userData.down=true;
  lookAtPoint(T.position.clone().add(V3(0,.5,0)),.3); chat(['e_c3']);
  const r=await timedChoice([{text:'Go back for Teo'},{text:'Leave him'}],5,1);
  if(r===0){ F.teoAlive=true; await wait(.5); T.userData.down=false; clearPose(T,.3); CHASE.fast=true; remember('He'); }
  else { F.teoAlive=false; remember('He'); CHASE.on=true; await handSlam(lv,T.position.clone()); T.visible=false; }
  CHASE.on=true; CHASE.slamT=.6; freeWalk(); PLAYER.ctl.jump=true;
}
/* ---------- the floor: run for the door ---------- */
async function floorRun(lv,crew,slamTick,follow){
  const P=lv.pig.userData.pig; P.stand=1; P.look=camera;
  objective('The door! Run for the light under the door (the crack between the stones = safe from his hand)');
  CHASE.on=true; CHASE.caught=false; CHASE.slamT=1.4; freeWalk(); PLAYER.ctl.jump=true; chat(['e_c5']);
  await waitUntil(()=>CHASE.caught||PLAYER.pos.x>FLOOR.doorX-22);
  if(CHASE.caught) return chaseCaught(lv,'chase');
  // his hand closes over you
  CHASE.on=false; SCENE_TICKS.splice(SCENE_TICKS.indexOf(slamTick),1); SCENE_TICKS.splice(SCENE_TICKS.indexOf(follow),1);
  PLAYER.lock(); PLAYER.ctl.look=true; objective('');
  const arm=lv.bigArm||(lv.bigArm=makeGiantArm(lv)); arm.visible=true; armGrip(arm,0);
  const at=PLAYER.pos.clone(); at.y=-36; crew.forEach((h,i)=>{ if(!h.visible) return; h.userData.A.path=null; resetActor(h); h.position.set(at.x-.9-i*.6,-36,at.z+(i%2?1:-1)*.9); faceTo(h,at); });
  lookAtPoint(V3(at.x,-10,at.z),.6); stopMusic(1.5);
  await tweenVal(k=>{ armPlace(arm,V3(at.x,-36+30-k*27.4,at.z),.05); },0,1,1.4,easeOut);
  await tweenVal(k=>armGrip(arm,k*.85),0,1,.9);
  chat(['e_c7']); for(const h of crew) if(h.visible) setPose(h,'holdOut',.3);
  // the watch: it glows, it hums, it builds
  await wait(.6); chat(['e_c6']); const hum=loopSnd('hum_build',{vol:.8}); SND.play('ringing',{vol:.5});
  await tweenVal(v=>{ PLAYER.watchGlow=v; PLAYER.watchLook=v; FX.aberr=.003+v*.02; },0,1,2.2);
  shake(1.2); flashWhite(1,.2); SND.play('blast',{vol:1}); hum&&hum.stop(.2);
  const wh=$('fxWhite'); wh.style.transition='opacity .15s'; wh.style.opacity=1; await wait(1.2);
  PLAYER.watchGlow=0; PLAYER.watchLook=0; FX.aberr=.003; arm.visible=false; torchOn(false);
  // the blast fried the collar
  F.collarFried=true; F.part2done=true; saveCheckpoint('twisted');
  const s=getSave()||{}; s.part2b=true; writeSave(s); unlock('escape');
  await wait(1.5);
  runStory(()=>SCENES.twisted());
}
