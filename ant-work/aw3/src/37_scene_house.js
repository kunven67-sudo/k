/* ================================================================
   PART 3 — THE TWISTED HOUSE. Land on the rug. The photos are wrong.
   The answering machine: an older you ("spare key's in the cookie
   jar, keep the cat flap locked"). Shadow hunts by sight + sound.
   Hallway: split up or stick together; the web shortcut or the long way
   past the fan; drips, the toy car, the outlet. Up the floating
   things to the counter, push the lid off the cookie jar (with help),
   the crash wakes Shadow, jump onto the bed, slide down the blanket,
   run back to the cat flap, unlock it... and the watch takes you.
   ================================================================ */
CHECKPOINTS.push({id:'twisted',name:'Home?',level:'twisted'},{id:'twistedHall',name:'The Hallway',level:'twisted'},{id:'twistedKey',name:'The Cookie Jar',level:'twisted'});
const CAT={state:'sleep',t:0,target:null,seenT:0,distractT:0,home:V3(-6,0,-30)};
function crewHere(lv){ const out=[]; const tl=LEVELS.table; const J=lv.jay2;
  out.push(J); if(F.freed&&F.teoAlive!==false) out.push(lv.teo); if(F.freed&&F.bramAlive!==false) out.push(lv.bram); return out; }
async function houseStart(id,spawn,yaw){
  const lv=LEVELS.twisted, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('twisted',{pos:spawn});
  saveCheckpoint(id); F.collarFried=true; F.collared=false; torchOn(false);
  if(!lv.jay2){ const mk=(fn,o)=>{ const h=fn(o); h.userData.level='twisted'; lv.scene.add(h); return h; };
    lv.jay2=mk(makeJay2,{}); giveWatch(lv.jay2);
    lv.teo=mk(makeHuman,{name:'Teo',voice:'Teo',skin:0xb98a64,shirt:0x8a3a2a,pants:0x2a3040,shoes:0x2a2a2a,hair:0x1a120c,hairStyle:'spiky',eye:0x3a2a1a,build:.9,height:.97,seed:44});
    lv.bram=mk(makeHuman,{name:'Bram',voice:'Bram',skin:0xe0b090,shirt:0x3a4a3a,pants:0x2a2a2a,shoes:0x1a1a1a,hairStyle:'bald',beard:true,hair:0x5a3a20,eye:0x4a5a3a,build:1.12,height:1.04,seed:52}); }
  CUR.j2=lv.jay2; for(const h of [lv.jay2,lv.teo,lv.bram]){ resetActor(h); h.visible=false; }
  crewHere(lv).forEach((h,i)=>{ h.visible=true; h.position.set(spawn.x-2-i*1.2,0,spawn.z+(i%2?1.4:-1.4)); });
  setPlayer(spawn,yaw); PLAYER.eye=1.64; setVM(true); hudVisible(true); lv.inter.length=0;
  CAT.state='sleep'; CAT.t=0; CAT.seenT=0; CAT.distractT=0; const c=lv.cat; c.position.copy(CAT.home); c.position.y=4.5+10; c.rotation.y=.4; c.userData.cat.crouch=0; c.userData.cat.walk=0;
  lv.cat.position.y=0; lv.toyRolled=false; lv.toy.position.copy(HOUSE.toy); lv.toyCol.x=HOUSE.toy.x; lv.toyCol.z=HOUSE.toy.z;
  setAmbience([['fire',.0]]); return lv;
}
/* ---------- Shadow: sees you (line of sight), hears noise, stalks, pounces. Caught = eaten. ---------- */
const _cray=new THREE.Raycaster();
function catSees(lv){ const c=lv.cat, C=c.userData.cat; C.head.updateMatrixWorld(true); const eye=C.head.localToWorld(V3(0,0,.3));
  const to=camera.position.clone().sub(eye), d=to.length(); if(d>120) return false;
  const fw=V3(Math.sin(c.rotation.y),0,Math.cos(c.rotation.y)); const flat=V3(to.x,0,to.z).normalize(); if(fw.dot(flat)<.25) return false;
  _cray.set(eye,to.normalize()); _cray.near=1; _cray.far=d-.3; return _cray.intersectObjects(lv.occluders,true).length===0; }
function catNoise(lv,at){ if(CAT.state==='pounce'||CAT.state==='eat') return; CAT.state='hunt'; CAT.target=at.clone(); CAT.t=0; SND.play('pig_6',{vol:.6,pos:lv.cat.position,ref:60,rate:1.9}); }
function houseTick(lv,dt,t){
  const c=lv.cat, C=c.userData.cat; animateCat(c,dt,t);
  if(!lv.catOn) return;
  CAT.t+=dt; CAT.distractT-=dt;
  const toYou=V3(PLAYER.pos.x-c.position.x,0,PLAYER.pos.z-c.position.z), d=toYou.length();
  const face=(p,rate)=>{ const want=Math.atan2(p.x-c.position.x,p.z-c.position.z); c.rotation.y+=clamp(angDiff(c.rotation.y,want),-rate*dt,rate*dt); };
  const walkTo=(p,sp)=>{ face(p,2.2); const fw=V3(Math.sin(c.rotation.y),0,Math.cos(c.rotation.y)); c.position.addScaledVector(fw,sp*dt); C.walk=damp(C.walk,sp>0?1:0,5,dt); };
  const seen=CAT.distractT<=0&&catSees(lv);
  if(CAT.state==='sleep'){ C.walk=damp(C.walk,0,5,dt); if(seen&&d<38) { CAT.seenT+=dt; if(CAT.seenT>1.2){ CAT.state='hunt'; CAT.target=PLAYER.pos.clone(); SND.play('pig_6',{vol:.7,pos:c.position,ref:60,rate:1.8}); } } return; }
  if(CAT.distractT>0){ // chasing Teo or Bram around the room
    const h=CAT.distracter; if(h){ walkTo(h.position,9); } return; }
  if(CAT.state==='hunt'){ const tg=seen?PLAYER.pos:CAT.target; if(seen) CAT.target=PLAYER.pos.clone();
    if(tg) walkTo(tg,seen?7:5);
    if(seen&&d<40){ CAT.state='stalk'; CAT.t=0; SND.play('pig_5',{vol:.5,pos:c.position,ref:40,rate:2.2}); }
    if(!seen&&tg&&Math.hypot(tg.x-c.position.x,tg.z-c.position.z)<6){ CAT.t+=0; CAT.lost=(CAT.lost||0)+dt; if(CAT.lost>5){ CAT.lost=0; CAT.state='wander'; CAT.t=0; } } }
  else if(CAT.state==='stalk'){ C.walk=damp(C.walk,0,6,dt); C.crouch=damp(C.crouch,1,4,dt); face(PLAYER.pos,3); if(!seen&&CAT.t>.6){ CAT.state='hunt'; C.crouch=0; }
    if(CAT.t>1.3){ CAT.state='pounce'; CAT.t=0; CAT.from=c.position.clone(); CAT.to=PLAYER.pos.clone().addScaledVector(V3(PLAYER.vel.x,0,PLAYER.vel.z),.5); CAT.to.y=0; C.crouch=0; SND.play('swing_2',{vol:1,pos:c.position,ref:40,rate:.4}); } }
  else if(CAT.state==='pounce'){ const k=Math.min(1,CAT.t/.75); const dir=CAT.to.clone().sub(CAT.from); const L=dir.length(); const land=CAT.from.clone().addScaledVector(dir.normalize(),Math.max(0,L-10));
    c.position.lerpVectors(CAT.from,land,k); c.position.y=Math.sin(k*Math.PI)*8;
    if(k>=1){ c.position.y=0; shake(.6); SND.play('body_fall',{vol:1,pos:c.position,ref:40,rate:.6});
      const hidden=youHiddenFromCat(lv); if(d<14&&!hidden){ CAT.state='eat'; lv.catOn=false; caughtByCat(lv); } else { CAT.state='hunt'; CAT.target=PLAYER.pos.clone(); } } }
  else if(CAT.state==='wander'){ if(!CAT.wp||Math.hypot(CAT.wp.x-c.position.x,CAT.wp.z-c.position.z)<5) CAT.wp=V3(rand(-50,190),0,rand(-30,30)); walkTo(CAT.wp,3); if(seen&&d<60){ CAT.state='hunt'; } }
  // stay inside the house
  c.position.x=clamp(c.position.x,HOUSE.x0+14,HOUSE.x1-14); c.position.z=clamp(c.position.z,HOUSE.z0+12,HOUSE.z1-12);
  if(c.position.x>HOUSE.hall.x0&&c.position.x<HOUSE.hall.x1) c.position.z=clamp(c.position.z,-6,6);
}
/* safe spots: under the couch, under the bed, in a crack behind the TV stand */
function youHiddenFromCat(lv){ const p=PLAYER.pos, C=HOUSE.couch, B=HOUSE.bed;
  return (Math.abs(p.x-C.x)<C.w/2-2&&Math.abs(p.z-C.z)<C.d/2-2)||(p.x>B.x0+2&&p.x<B.x1-2&&p.z>B.z0+2&&p.z<B.z1-2&&PLAYER.y<3); }
async function caughtByCat(lv){ PLAYER.lock(); const c=lv.cat; lookAtPoint(c.userData.cat.head.getWorldPosition(V3()),.25); await wait(.35);
  SND.play('pig_squeal',{vol:.6,rate:2}); shake(1); dmgFlash(); await tweenVal(lids,0,1,.35);
  cardShow('SHADOW GOT YOU','Back to the last checkpoint'); await wait(2.6); cardHide();
  const s=getSave()||{}; setTimeout(()=>startAt(s.cp||'twisted',s.flags||F),0); await new Promise(()=>{}); }
/* the drips (each drop is a bomb), the fan's wind, the outlet's sparks, the toy car, the web */
const HAZ={drips:[],sparkT:0};
function hallTick(lv,dt,t){
  if(!lv.hazOn) return;
  // drips: a shadow on the floor, then a giant drop smashes down
  for(const x of HOUSE.drips){ let d=HAZ.drips.find(o=>o.x===x); if(!d){ d={x,t:rand(0,2),m:null,sh:null}; HAZ.drips.push(d); }
    d.t-=dt; if(d.t<=0&&!d.m){ d.z=rand(-10,10); d.m=sph(1.2,new THREE.MeshPhysicalMaterial({color:col(0xb8d8e8),roughness:.05,transmission:.6,transparent:true,opacity:.8}),x,90,d.z,14,12); d.m.scale.set(1,1.5,1); lv.scene.add(d.m);
      d.sh=mesh(new THREE.CircleGeometry(3,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.0,depthWrite:false}),x,.3,d.z,false); d.sh.rotation.x=-Math.PI/2; lv.scene.add(d.sh); d.vy=0; d.life=0; }
    if(d.m){ d.life+=dt; d.vy-=60*dt; d.m.position.y+=d.vy*dt; d.sh.material.opacity=Math.min(.5,d.life*.4);
      if(d.m.position.y<=.5){ shake(.25); SND.play('drips',{vol:.9,pos:d.m.position,ref:20,rate:.5}); if(Math.hypot(PLAYER.pos.x-d.x,PLAYER.pos.z-d.z)<3.2&&PLAYER.y<2) houseDeath(lv,'A DROP HIT YOU'); lv.scene.remove(d.m); lv.scene.remove(d.sh); d.m=null; d.t=rand(2,3.4); } } }
  // the fan: wind pushes you toward the far wall while you're in front of it; too close = the blades
  const f=HOUSE.fan, fx=PLAYER.pos.x-f.x; if(Math.abs(fx)<10&&PLAYER.pos.z>f.z-2) PLAYER.pos.z+=dt*5.5*(1-Math.abs(fx)/10);
  if(Math.hypot(PLAYER.pos.x-f.x,PLAYER.pos.z-f.z)<8.2&&PLAYER.y<26) houseDeath(lv,'THE FAN GOT YOU');
  // the outlet: sparks arc out every few seconds (blue flash + a crack), stay away from the wall then
  HAZ.sparkT-=dt; if(HAZ.sparkT<=0){ HAZ.sparkT=rand(2.4,3.6); lv.sparkL.intensity=6; SND.play('zap',{vol:.7,pos:lv.sparkL.position,ref:20,rate:1.4}); later(.25,()=>{ lv.sparkL.intensity=0; });
    if(Math.abs(PLAYER.pos.x-HOUSE.outlet.x)<6&&PLAYER.pos.z<-HOUSE.hall.z+6) houseDeath(lv,'ZAPPED'); }
  // the toy car: bump it and it rolls off clattering (noise = Shadow comes)
  if(!lv.toyRolled&&Math.hypot(PLAYER.pos.x-HOUSE.toy.x,PLAYER.pos.z-HOUSE.toy.z)<9.2){ lv.toyRolled=true; SND.play('metal_3',{vol:1,pos:lv.toy.position,ref:60,rate:.6}); catNoise(lv,lv.toy.position);
    tweenVal(k=>{ lv.toy.position.x=HOUSE.toy.x+k*20; lv.toyCol.x=lv.toy.position.x; lv.toy.children.forEach(o=>{ if(o.geometry&&o.geometry.type==='CylinderGeometry') o.rotation.y+=.3; }); },0,1,2.2,easeOut); }
  // the web: stuck for a moment, and its spider comes down
  const W=HOUSE.web; if(!lv.webStuck&&PLAYER.pos.x>W.x0&&PLAYER.pos.x<W.x1&&PLAYER.pos.z>W.z0&&PLAYER.y<6){ lv.webStuck=true; webTrap(lv); }
}
async function webTrap(lv){ PLAYER.lock(); PLAYER.ctl.look=true; toast('Stuck in the web!','#ff8a6a'); SND.play('spit',{vol:.7,rate:.7});
  const sp=lv.webSpider, from=sp.position.clone(), to=V3(PLAYER.pos.x,1.2,PLAYER.pos.z);
  const ok=await new Promise(res=>{ let k=0; const tk=dt=>{ k+=dt/2.6; sp.position.lerpVectors(from,to,Math.min(1,k)*.85); animateBug(sp,dt,G.time); sp.userData.bug.walkK=1; if(k>=1){ SCENE_TICKS.splice(SCENE_TICKS.indexOf(tk),1); res(false); } }; SCENE_TICKS.push(tk);
    later(2.0,()=>{ if(k<.98){ SCENE_TICKS.splice(SCENE_TICKS.indexOf(tk),1); res(true); } }); });
  if(ok){ toast('You ripped free!','#9fe0a0'); SND.play('swing_1',{vol:.8}); freeWalk(); PLAYER.ctl.jump=true; sp.position.copy(from); lv.webStuck=false; lv.webCooldown=true; }
  else houseDeath(lv,'THE SPIDER GOT YOU'); }
let houseDying=false;
async function houseDeath(lv,why){ if(houseDying) return; houseDying=true; lv.hazOn=false; lv.catOn=false; PLAYER.lock(); shake(.8); dmgFlash(); await tweenVal(lids,0,1,.4); cardShow(why,'Back to the last checkpoint'); await wait(2.4); cardHide(); houseDying=false;
  const s=getSave()||{}; setTimeout(()=>startAt(s.cp||'twisted',s.flags||F),0); await new Promise(()=>{}); }
on('tick',dt=>{ if(LV&&LV.name==='twisted'&&G.mode==='play') hallTick(LV,dt,G.time); });
/* ---------- the scenes ---------- */
SCENES.twisted=async function(){
  const lv=await houseStart('twisted',V3(0,0,6),Math.PI);
  const J=lv.jay2, fd=$('fade'); PLAYER.lock(); PLAYER.ctl.look=true; houseDying=false;
  // you land on the rug in a white flash
  const wh=$('fxWhite'); wh.style.transition='none'; wh.style.opacity=1; fd.style.opacity=0; await wait(.3); SND.play('body_fall',{vol:.9}); shake(.5); wh.style.transition='opacity 2s'; wh.style.opacity=0;
  crewHere(lv).forEach(h=>{ setPose(h,'lieBack',0); }); await wait(2.2); crewHere(lv).forEach(h=>clearPose(h,.6));
  playMusic('pyramid',3);
  J.userData.A.look='player'; await say(['h_1','h_3']); J.userData.A.look=null;
  freeWalk(); PLAYER.ctl.jump=true;
  // look around: the photos, the answering machine
  objective('Look around');
  addInteract(lv,{obj:lv.famPhoto,offset:V3(0,-4,0),reach:9,label:'Look at the photo',act:async()=>{ PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(lv.famPhoto.getWorldPosition(V3()),.6); await say(['h_2']); freeWalk(); PLAYER.ctl.jump=true; F.sawPhoto=1; }});
  addInteract(lv,{obj:lv.machine,offset:V3(2.6,3.2,.8),reach:6,label:'Press the blinking button',act:async()=>{ if(F.heardMsg) return; F.heardMsg=1; SND.play('watch_beep',{vol:.6,pos:lv.machine.position,ref:10,rate:.7});
    PLAYER.lock(); PLAYER.ctl.look=true; await wait(.8); await say(['h_am']); await say(['h_4','h_5']); freeWalk(); PLAYER.ctl.jump=true; }});
  await waitUntil(()=>F.heardMsg);
  objective('Get the cat flap key from the cookie jar (in the kitchen, through the hallway)');
  lv.catOn=true; CAT.state='sleep';
  // the cat wakes when you get close / it sees you, or when you make noise
  chat(['h_6']);
  // the hallway: split up or stick together
  await waitUntil(()=>PLAYER.pos.x>HOUSE.hall.x0-8);
  PLAYER.lock(); PLAYER.ctl.look=true; J.userData.A.look='player'; await say(['h_split']);
  const r=await choose([{text:'Split up'},{text:'Stick together'}]);
  F.split=r.text==='Split up'; remember('He'); J.userData.A.look=null;
  saveCheckpoint('twistedHall');
  await hallPart(lv);
};
SCENES.twistedHall=async function(){ const lv=await houseStart('twistedHall',V3(64,0,0),-Math.PI/2); houseDying=false; await wait(.2); $('fade').style.opacity=0; playMusic('pyramid',2); lv.catOn=true; CAT.state='wander'; lv.cat.position.set(-20,0,0); await hallPart(lv); };
async function hallPart(lv){
  const J=lv.jay2, crew=crewHere(lv);
  const fol=followers(F.split?[]:crew); SCENE_TICKS.push(fol);
  if(F.split){ crew.forEach(h=>h.visible=false); }
  lv.hazOn=true; lv.webStuck=false; freeWalk(); PLAYER.ctl.jump=true;
  objective('Get through the hallway to the kitchen (the web corner is shorter, but...)');
  await waitUntil(()=>PLAYER.pos.x>HOUSE.hall.x1+4);
  // the kitchen: cockroaches scatter, the floating things drift up and down
  for(const r of lv.roaches){ r.visible=true; const p0=r.position.clone(); tweenVal(k=>{ r.position.z=p0.z+k*20; r.position.x=p0.x+Math.sin(k*9)*4; animateBug(r,.016,G.time); r.userData.bug.walkK=1; },0,1,1.8).then(()=>r.visible=false); }
  SND.play('skitter_1',{vol:.8});
  objective('Ride the floating things up to the counter');
  if(F.split){ crew.forEach((h,i)=>{ h.visible=true; resetActor(h); h.position.set(HOUSE.counter.x0+6+i*3,HOUSE.counter.h,HOUSE.counter.z0+8); }); }
  await waitUntil(()=>PLAYER.y>HOUSE.counter.h-1&&PLAYER.pos.x>HOUSE.counter.x0);
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(fol),1);
  // everybody up here to push
  crew.forEach((h,i)=>{ h.visible=true; resetActor(h); h.position.set(HOUSE.jar.x-9-i*2,HOUSE.counter.h,HOUSE.jar.z-6+i*2); faceTo(h,HOUSE.jar); });
  if(F.split) await say(['h_met']);
  objective('Push the lid off the cookie jar');
  await new Promise(res=>addInteract(lv,{pos:V3(HOUSE.jar.x-6,HOUSE.counter.h,HOUSE.jar.z),reach:4,label:'Push the lid (all together)',act:()=>res()}));
  PLAYER.lock(); PLAYER.ctl.look=true; crew.forEach(h=>setPose(h,'push',.3)); chat(crew.length>2?['h_7b','h_8']:['h_8']);
  const lid=lv.jarLid; await tweenVal(k=>{ lid.position.x=k*4; lid.rotation.z=-k*.2; },0,1,2.4,easeIn);
  await tweenVal(k=>{ lid.position.x=4+k*12; lid.position.y=11.4-k*48; lid.rotation.z=-.2-k*3; },0,1,1.1,easeIn);
  shake(.8); SND.play('metal_1',{vol:1,rate:.35}); SND.play('body_fall',{vol:1,rate:.5}); crew.forEach(h=>clearPose(h,.3));
  catNoise(lv,V3(HOUSE.jar.x,0,HOUSE.jar.z)); lv.catOn=true; lv.cat.position.set(170,0,0);
  lv.key.visible=true; addInteract(lv,{obj:lv.key,reach:5,label:'Take the key',act:()=>{ lv.key.visible=false; F.flapKey=1; SND.play('pickup',{vol:.8}); }});
  freeWalk(); PLAYER.ctl.jump=true; await waitUntil(()=>F.flapKey);
  await say(['h_9','h_10']);
  saveCheckpoint('twistedKey');
  await keyRun(lv);
}
SCENES.twistedKey=async function(){ const lv=await houseStart('twistedKey',V3(HOUSE.jar.x-10,0,HOUSE.jar.z-4),-Math.PI/2); houseDying=false; PLAYER.y=HOUSE.counter.h; F.flapKey=1;
  crewHere(lv).forEach((h,i)=>{ h.position.set(HOUSE.jar.x-12-i*2,HOUSE.counter.h,HOUSE.jar.z-6+i*2); }); lv.jarLid.position.set(16,-36.6,0); await wait(.2); $('fade').style.opacity=0; lv.catOn=true; CAT.state='hunt'; CAT.target=V3(HOUSE.jar.x,0,HOUSE.jar.z); lv.cat.position.set(170,0,0); await keyRun(lv); };
async function keyRun(lv){
  const J=lv.jay2, crew=crewHere(lv); playMusic('boss',1); lv.hazOn=true;
  objective('Jump down onto the bed, slide down the blanket, run to the cat flap!');
  freeWalk(); PLAYER.ctl.jump=true;
  // the crew comes along (they're right behind you)
  const fol=followers(crew); SCENE_TICKS.push(fol);
  // Teo / Bram can distract Shadow (if they're here)
  for(const h of crew) if(h!==J) addInteract(lv,{obj:h,offset:V3(0,1.5,0),reach:4,when:()=>CAT.distractT<=0&&lv.catOn,label:'Ask '+(h===lv.teo?'Teo':'Bram')+' to distract Shadow',act:()=>{ CAT.distractT=12; CAT.distracter=h; chat([h===lv.teo?'h_7':'h_7c']); h.userData.A.path=null; walkTo(h,[V3(lv.cat.position.x+20,0,lv.cat.position.z+10)],4); SCENE_TICKS.splice(SCENE_TICKS.indexOf(fol),1); later(12,()=>{ SCENE_TICKS.push(fol); }); }});
  // the bed edge -> slide down the blanket automatically when you step off the west edge
  await waitUntil(()=>PLAYER.y>HOUSE.bed.h-1&&PLAYER.pos.x<HOUSE.bed.x0+3);
  PLAYER.lock(); const z0=PLAYER.pos.z; SND.play('swing_2',{vol:.8,rate:.6});
  camFollow(t=>{ const k=Math.min(1,t/1.8); return {pos:V3(HOUSE.bed.x0-1.5,lerp(HOUSE.bed.h+1.5,1.6,k*k),z0),look:V3(HOUSE.bed.x0-20,lerp(10,1,k),z0)}; },70); CAM.fnT=0; await wait(1.9); camRelease(0);
  setPlayer(V3(HOUSE.bed.x0-3,0,z0),Math.PI/2); PLAYER.y=0; freeWalk(); PLAYER.ctl.jump=true;
  crew.forEach((h,i)=>{ h.userData.A.path=null; h.position.set(HOUSE.bed.x0-4-i*1.4,0,z0+1.5); });
  objective('The cat flap! Unlock it with the key');
  await new Promise(res=>addInteract(lv,{obj:lv.flapLock,reach:6,label:'Unlock the cat flap',act:()=>res()}));
  // through the flap... the watch
  lv.catOn=false; lv.hazOn=false; SCENE_TICKS.splice(SCENE_TICKS.indexOf(fol),1); PLAYER.lock(); PLAYER.ctl.look=true; objective('');
  SND.play('cage_lock',{vol:.8,rate:1.3}); await wait(.5); chat(['h_11']);
  await tweenVal(k=>{ lv.flap.rotation.z=k*1.1; },0,1,.9);
  crew.forEach((h,i)=>{ h.userData.A.path=null; h.position.set(HOUSE.x0+5+i*1.2,0,(i%2?1.2:-1.2)); faceTo(h,V3(HOUSE.x0,0,0)); });
  lookAtPoint(V3(HOUSE.x0,4,0),.6); await say(['h_12']);
  // the watch blasts: NIVALIS
  const hum=loopSnd('hum_build',{vol:.8}); await tweenVal(v=>{ PLAYER.watchGlow=v; },0,1,1.6); SND.play('blast',{vol:1}); hum&&hum.stop(.2); shake(1);
  const wh=$('fxWhite'); wh.style.transition='opacity .2s'; wh.style.opacity=1; await wait(1.4); PLAYER.watchGlow=0;
  F.houseDone=1; saveCheckpoint('nivalis'); unlock('house');
  runStory(()=>SCENES.nivalis());
}
