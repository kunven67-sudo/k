/* ================================================================
   STORY B — "MARS SHIFT" (continues the Moon Escape ending)
   ================================================================ */
/* ================= B1: THE MOON ================= */
CHECKPOINTS.B1=async()=>{
  const lv=await enterLevel('moon',{pos:V3(4,0,6),yaw:-2.6});
  setCheckpoint('B1'); const F=F_();
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true); setVM(true);
  const jim=lv.jim; jim.visible=true; jim.position.set(0,0,-4.6); jim.rotation.y=0; setMood(jim,'worried'); jim.userData.A.path=null;
  F.pieces=0; F.installed=0; F.jimWorking=false; lv.jimBusy=false; jim.userData.snapGround=false; clearPose(jim); if(lv.wrench&&lv.wrench.parent) lv.wrench.parent.remove(lv.wrench);
  for(const p of lv.pieces){ p.collected=false; p.installed=false; p.wrap.visible=true; p.wrap.traverse(c=>{ if(c.isLight&&c.userData.k0!=null) c.intensity=c.userData.k0; }); for(const c of p.wrap.children) c.visible=true; }
  for(const k of ROCKET_PARTS){ lv.rocket.userData.parts[k].visible=false; lv.rocket.userData.ghosts[k].visible=true; }
  lv.rocket.position.y=1.5; setRocketFlame(lv.rocket,0);
  if(!lv.interSetup){ lv.interSetup=true;
    addInteract(lv,{obj:jim,offset:V3(0,1.6,0),label:'Talk to Jim',reach:2.6,when:()=>!F_().moonTalked,act:()=>runStory(moonTalk)});
    addInteract(lv,{obj:jim,offset:V3(0,1.6,0),label:'Talk to Jim',reach:2.6,when:()=>F_().moonTalked&&!F_().rocketDone,act:()=>{ const lvm=LEVELS.moon; if(lvm.jimBusy) return; lvm.jimBusy=true; jim.userData.A.look='player'; facePoint(jim,PLAYER.pos); setPose(jim,'talk'); bark('Jim',pick(["Five pieces! They're glowing, you can't miss 'em.","You can only carry one at a time, so bring 'em back one by one.","Look for the yellow beams of light!","I'm bolting on what we've got. You find the rest."]),jim,3); later(3,()=>{ jim.userData.A.look=null; clearPose(jim); lvm.jimBusy=false; }); }});
    for(const p of lv.pieces) addInteract(lv,{obj:p.wrap,offset:V3(0,.6,0),label:()=>'Grab the '+PART_NAMES[p.key].toLowerCase(),reach:2.4,when:()=>F_().moonTalked&&!p.collected,act:()=>grabPiece(p)});
    addInteract(lv,{pos:V3(lv.rocketPos.x,1.6,lv.rocketPos.z),label:()=>PLAYER.carry?'Put the '+PART_NAMES[PLAYER.carry.key].toLowerCase()+' on the rocket':(F_().rocketDone?'Get on the rocket ship':'Rocket ('+F_().installed+'/5 pieces)'),reach:6.2,aim:false,when:()=>F_().moonTalked&&(!!PLAYER.carry||F_().rocketDone),act:()=>{ if(PLAYER.carry) installPiece(); else if(F_().rocketDone) runStory(launchRocket); }});
    for(const c of lv.colonists) addTrigger(lv,{pos:c.h.position,r:2.2,once:false,when:()=>F_().moonTalked,fn:()=>nagOnce('col'+lv.colonists.indexOf(c),20,()=>bark('Alien',pick(["Bug food? Ew. No thanks.","Oh, it's the bug guy's friend. Hi.","I'd rather eat moon dust.","Still selling bugs? On the MOON?"]),c.h,2.6))});
  }
  cardShow('TWO YEARS LATER','The moon'); await fade(0,2); await wait(2.4); cardHide();
  say("It's been two years. You've been shrinking on the moon to help Jim.",4.2); await wait(4.4);
  say("But the stand isn't making money. Jim is going broke.",4); await wait(3);
  PLAYER.free(); objective('Talk to Jim at his stand');
  addTrigger(lv,{pos:V3(0,0,-3.5),r:4.5,once:true,when:()=>!F_().moonTalked,fn:()=>runStory(moonTalk)});
};
async function moonTalk(){
  const lv=LEVELS.moon, jim=lv.jim, F=F_(); if(F.moonTalked) return; F.moonTalked=true; PLAYER.lock(); objective(null);
  jim.userData.A.look='player'; lookAtPoint(V3(jim.position.x,1.65,jim.position.z),.6);
  const S={h:jim,who:'Jim'};
  await talk([
    {...S,text:"Hey! I'm building a rocket ship.",pose:'point',mood:'happy'},
    {...S,text:"As you can see, it's not fully done.",pose:'shrug'},
    {...S,text:"Nobody up here likes bug food. Nobody. I'm going broke.",mood:'sad',pose:'talk'},
    {...S,text:"So we're gonna fly to a new planet. One that actually likes bug food.",mood:'happy',pose:'talk'},
    {...S,text:"Can you help me find the missing pieces? There are five of them around the moon.",pose:'point'}
  ]);
  clearPose(jim); jim.userData.A.look=null; setMood(jim,'happy');
  PLAYER.free(); objective('Find the rocket pieces: <b>0</b>/5');
  itemHints([IS_TOUCH?'<kbd>USE</kbd> grab a piece':'<kbd>E</kbd> grab a piece','You can only carry one at a time','<kbd>'+(IS_TOUCH?'⤒':'Space')+'</kbd> low-gravity jump!']);
  toast('Follow the yellow beams!','#ffcc33');
  runStory(jimBuildsRocket);
}
/* Jim works on the rocket while you hunt for the pieces (he used to just stand at his stand) */
function makeWrench(){ const g=new THREE.Group(), m=mat(0x9aa0a8,{metalness:.9,roughness:.35}); g.add(box(.025,.2,.012,m,0,0,0,false)); g.add(box(.06,.035,.014,m,0,.105,0,false)); g.add(box(.05,.03,.014,m,0,-.1,0,false)); return g; }
async function jimBuildsRocket(){
  const lv=LEVELS.moon, jim=lv.jim, RP=lv.rocketPos, F=F_(), tok=STORY.token;
  if(F.jimWorking) return; F.jimWorking=true;
  const alive=()=>tok===STORY.token && LV===lv && !F_().launching;
  jim.userData.snapGround=true; jim.userData.A.look=null;
  if(!lv.wrench) lv.wrench=makeWrench();
  const spots=[V3(RP.x+5.8,0,RP.z-.5),V3(RP.x+4.9,0,RP.z+3.2),V3(RP.x+4.4,0,RP.z-3.9)];
  // walk over from the stand
  await walkTo(jim,[V3(-3,0,-1),spots[0]],1.5);
  if(!alive()) return;
  holdProp(jim,lv.wrench,'R',V3(0,-.05,.04));
  let i=0;
  while(alive() && !F_().rocketDone){
    const sp=spots[i%spots.length]; i++;
    if(Math.hypot(jim.position.x-sp.x,jim.position.z-sp.z)>.3){ clearPose(jim); await walkTo(jim,sp,1.2); if(!alive()) return; }
    facePoint(jim,V3(RP.x,0,RP.z));
    await waitUntil(()=>!lv.jimBusy,30); if(!alive()) return;
    setPose(jim,'wrench');
    const end=G.time+rand(4.5,7);
    while(alive() && G.time<end && !F_().rocketDone){
      if(lv.jimBusy){ await waitUntil(()=>!lv.jimBusy,30); if(!alive()) return; setPose(jim,'wrench'); facePoint(jim,V3(RP.x,0,RP.z)); }
      const hp=jim.userData.holdR.getWorldPosition(new THREE.Vector3());
      sfxAt(hp,()=>(Math.random()<.7?SFX.clank():SFX.bolt()),3);
      if(Math.random()<.35) lv.glow.burst(hp.clone().add(V3(0,.1,0)),{color:0xffd080,count:10,speed:3,size:.035,life:.45,grav:-9});
      await wait(rand(.45,.95));
    }
    if(!alive()) return;
    setPose(jim,'think'); await wait(rand(1.2,2)); 
  }
  if(alive()){ clearPose(jim); }
}
/* Jim stops working, turns to you and says something about the piece you brought */
const JIM_PIECE_LINES={nozzle:"The engine nozzle! Now it can actually go somewhere.",tank:"The fuel tank! Can't fly without gas. Rocket gas.",fin:"A tail fin! So it flies straight and not in circles.",nose:"The nose cone! Rockets gotta be pointy.",computer:"The navigation computer! So we don't crash into the sun."};
function jimReact(key,last){
  const lv=LEVELS.moon, jim=lv.jim, tok=STORY.token; lv.jimBusy=true;
  jim.userData.A.look='player'; facePoint(jim,PLAYER.pos); setPose(jim,last?'cheer':(Math.random()<.5?'point':'talk'));
  runStory(async()=>{
    if(!last) bark('Jim',JIM_PIECE_LINES[key]||"Nice! Keep 'em coming!",jim,3.4);
    await wait(last?2.4:3.2); if(tok!==STORY.token) return;
    jim.userData.A.look=null; clearPose(jim); lv.jimBusy=false;
  });
}
/* hide an object but keep its lights in the scene (turning a light off by hiding it makes every shader recompile = a big lag spike) */
function hideKeepLights(o){ o.traverse(c=>{ if(c.isLight){ c.userData.k0=c.userData.k0??c.intensity; c.intensity=0; } }); for(const c of o.children) if(!c.isLight) c.visible=false; }
function grabPiece(p){
  if(PLAYER.carry){ SFX.cantCarry(); bark('You',"I can only carry one at a time.",null,2.4); toast('You can only grab one at a time!','#ff9a7a'); return; }
  p.collected=true; hideKeepLights(p.wrap); PLAYER.carry=p; vmCarry(p.obj); SFX.pickup(); shake(.05);
  const lv=LEVELS.moon; lv.glow.burst(p.wrap.position.clone().add(V3(0,.6,0)),{color:0xffcc33,count:24,speed:2,size:.08,life:.8,grav:-2});
  toast('Got: '+PART_NAMES[p.key].toUpperCase(),'#ffcc33');
  objective('Bring the '+PART_NAMES[p.key].toLowerCase()+' to the rocket');
}
function installPiece(){
  const lv=LEVELS.moon, F=F_(), p=PLAYER.carry; if(!p) return;
  PLAYER.carry=null; vmCarry(null); p.installed=true; F.installed=(F.installed||0)+1;
  const part=lv.rocket.userData.parts[p.key], gh=lv.rocket.userData.ghosts[p.key];
  gh.visible=false; part.visible=true;
  const s0=part.scale.clone(); part.scale.multiplyScalar(.01);
  runStory(async()=>{ await tweenVal(k=>part.scale.copy(s0).multiplyScalar(Math.max(.01,easeBack(k))),.6); });
  const wp=part.getWorldPosition(new THREE.Vector3());
  sfxAt(wp,()=>SFX.attach(),3); shake(.12);
  for(let i=0;i<4;i++) later(.2+i*.12,()=>lv.glow.burst(wp,{color:0xffd080,count:18,speed:4,size:.05,life:.5,grav:-9}));
  jimReact(p.key,F.installed>=5);
  if(F.installed>=5){ F.rocketDone=true; unlock('rocket'); objective('The rocket is fully built! Press '+(IS_TOUCH?'USE':'E')+' to go on the rocket ship'); itemHints(null);
    later(1,()=>{ say('It is now fully built.',3); bark('Jim',"You did it! It's done! Get on, get on!",lv.jim,3); }); SFX.objective(); }
  else objective('Find the rocket pieces: <b>'+F.installed+'</b>/5');
}
async function launchRocket(){
  const lv=LEVELS.moon, F=F_(), R=lv.rocket, jim=lv.jim; if(F.launching) return; F.launching=true;
  PLAYER.lock(); objective(null); itemHints(null);
  await fade(1,.6); jim.visible=false; letterbox(true); hudVisible(false); playMusic(null,1);
  const RP=lv.rocketPos;
  await camShot(V3(RP.x+20,4,RP.z+22),V3(RP.x,5,RP.z),{fov:45}); fade(0,.8);
  await wait(.8);
  for(const n of ['Three...','Two...','One...']){ bark('Jim',n,null,1,true); SFX.countBeep(false); await wait(1); }
  SFX.countBeep(true); bark('Jim','LIFTOFF!',null,1.5,true); playMusic('launch',.3);
  SFX.ignite(); SFX.boom(); shake(.6);
  await tweenVal(k=>setRocketFlame(R,k),.4);
  for(let i=0;i<14;i++) later(i*.12,()=>lv.soft.burst(V3(RP.x,.8,RP.z),{color:0xcfcac2,count:26,speed:7,size:1.4,life:3.5,grav:.2,up:.1,grow:3,drag:1.2,alpha:.5}));
  ambVol('rocket',.5); setAmbience([['rocket',.5]]);
  let vy=0; const y0=R.position.y;
  camFollow(t=>({pos:V3(RP.x+20-t*.5,4+t*1.2,RP.z+22),look:V3(RP.x,R.position.y+3,RP.z)}),45);
  await tweenVal(k=>{ vy+=.06; R.position.y=y0+k*k*60; shake(.02); if(Math.random()<.5) lv.glow.burst(R.position.clone().add(V3(0,-2.5,0)),{color:0xffa040,count:6,speed:3,size:.4,life:.6,grav:-6}); },4.5,x=>x);
  FX.whiteout=0; await tweenVal(k=>FX.whiteout=k,.6);
  // ---- space ----
  const S=await enterLevel('space',{pos:V3(0,0,0)},{keepMusic:true});
  FX.whiteout=1; S.rx=0; S.speed=40;
  camFollow(t=>({pos:V3(S.rx-22+t*2,9,34),look:V3(S.rx,0,0)}),42);
  await tweenVal(k=>FX.whiteout=1-k,.8);
  say('The moon drops away behind you.',3.5);
  await wait(4);
  camFollow(t=>({pos:V3(S.rx-26,4,6),look:V3(S.rx+200,-20,-30)}),50); invalidateMotion();
  say('Ahead: a dusty red dot, getting bigger.',3.5);
  await wait(3.5);
  camFollow(t=>({pos:V3(S.rx-18,3,-10),look:V3(S.rx+60,0,0)}),55); invalidateMotion();
  await tweenVal(k=>{ S.speed=lerp(40,1400,easeIn(k)); FX.mblurStrength=1+k*3; },4.2);
  FX.heat=.6; SFX.reentry(4); shake(.4);
  camFollow(t=>({pos:V3(S.rx-14,2,5),look:V3(S.rx+40,-4,0)}),60);
  await tweenVal(k=>{ S.speed=lerp(1400,300,k); FX.exposure=1.1+k*.4; if(Math.random()<.7) S.glow.burst(S.rocket.position.clone().add(V3(3,0,0)),{color:0xff8a3a,count:10,speed:14,size:.6,life:.4,grav:0}); },3);
  FX.heat=0; await tweenVal(k=>FX.whiteout=k,.6);
  // ---- Mars landing ----
  const M=await enterLevel('mars',{pos:V3(16,0,6),yaw:0},{keepMusic:true});
  setCheckpoint('B2');
  FX.whiteout=1; const MR=M.rocket; const land=V3(22,marsHeight(22,12)+1.1,12); MR.position.set(land.x,land.y+70,land.z); setRocketFlame(MR,1);
  M.jim.visible=false;
  camShot(V3(8,3,-4),land.clone().add(V3(0,6,0)),{fov:50});
  await tweenVal(k=>FX.whiteout=1-k,.7);
  setAmbience([['rocket',.4],['marsWind',.06]]);
  await tweenVal(k=>{ MR.position.y=land.y+70*(1-easeOut(k)); setRocketFlame(MR,1-k*.6); if(k>.6&&Math.random()<.6) M.soft.burst(V3(land.x+rand(-3,3),land.y-.8,land.z+rand(-3,3)),{color:0xd89a70,count:6,speed:6,size:1.2,life:2.5,grav:.3,up:.2,grow:3,drag:1,alpha:.5}); },5);
  setRocketFlame(MR,0); SFX.moonThud(); SFX.boom(); shake(.4); ambVol('rocket',0);
  for(let i=0;i<5;i++) M.soft.burst(V3(land.x,land.y-.8,land.z),{color:0xd8a070,count:30,speed:8,size:1.5,life:3,grav:.2,up:.1,grow:3,drag:1.3,alpha:.45});
  await wait(1.8);
  await fade(1,.8);
  letterbox(false); hudVisible(true); camRelease(0);
  startFromCheckpointInner('B2');
}

/* ================= B2: MARS — the shift ================= */
const BUGS={alive:0};
function spawnMarsBug(lv){
  const aggr=Math.random()<.3; const b=makeMarsBug(aggr,randi(1,999)); b.scale.setScalar(.34);
  const a=rand(0,6.28), r=rand(1,7); const x=lv.bugPatch.x+Math.cos(a)*r, z=lv.bugPatch.z+Math.sin(a)*r;
  b.rotation.y=rand(0,6.28); b.position.set(0,0,0); b.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(b); b.userData.bug.yOff=Math.max(0,-bb.min.y)*.85; b.position.set(x,lv.ground(x,z)+b.userData.bug.yOff,z); lv.scene.add(b); lv.bugs.push(b); return b;
}
function updateMarsBugs(dt,t){
  const lv=LEVELS.mars; if(!lv.bugs) return;
  const F=F_(); const shrunk=PLAYER.scale<.5;
  for(let i=lv.bugs.length-1;i>=0;i--){
    const b=lv.bugs[i], B=b.userData.bug, A=b.userData.A;
    if(B.remove){ lv.scene.remove(b); lv.bugs.splice(i,1); continue; }
    if(B.hitFlash>0){ B.hitFlash-=dt; }
    if(B.dead){ A.speed=0; animateAnt(b,dt,t); for(const L of b.userData.legs){ L.femJ.rotation.z=L.side*1.4; } b.rotation.z=damp(b.rotation.z,Math.PI,8,dt); b.position.y=damp(b.position.y,lv.ground(b.position.x,b.position.z)+(B.yOff||0)+.06,8,dt); continue; }
    B.wanderT+=dt;
    const dx=PLAYER.pos.x-b.position.x, dz=PLAYER.pos.z-b.position.z, d=Math.hypot(dx,dz);
    let sp=.18;
    const hunt=B.aggr && shrunk && F.shiftOn!==false && d<2.2 && PLAYER.ctl.move;
    if(hunt){ B.heading=angLerp(B.heading,Math.atan2(dx,dz),dt*4); sp=d>.28?.45:0; }
    else { B.heading+=Math.sin(B.wanderT*.7+i)*dt*1.2; const hx=lv.bugPatch.x-b.position.x, hz=lv.bugPatch.z-b.position.z; if(Math.hypot(hx,hz)>8) B.heading=angLerp(B.heading,Math.atan2(hx,hz),dt*2); if((B.wanderT%6)>4.5) sp=0; }
    if(B.knock){ b.position.x+=B.knock.x*dt; b.position.z+=B.knock.z*dt; B.knock.multiplyScalar(Math.max(0,1-dt*6)); }
    b.position.x+=Math.sin(B.heading)*sp*dt; b.position.z+=Math.cos(B.heading)*sp*dt; b.position.y=lv.ground(b.position.x,b.position.z)+(B.yOff||0);
    b.rotation.y=B.heading; A.speed=damp(A.speed,sp/.34,8,dt);
    animateAnt(b,dt,t);
    B.glow.emissiveIntensity=B.hitFlash>0?8:3+Math.sin(t*4+i)*.8;
    if(hunt && d<.3){ B.atkCd-=dt; if(B.atkCd<=0){ B.atkCd=1.1; A.chew=1; setTimeout(()=>A.chew=0,300); playerBitten(); } }
  }
  const alive=lv.bugs.filter(b=>!b.userData.bug.dead).length;
  if(F.bugsOn && alive<7 && Math.random()<dt*.8) spawnMarsBug(lv);
}
function playerBitten(){
  const F=F_(); PLAYER.hp-=9; F.bitten=(F.bitten||0)+1; SFX.bite(); dmgFlash(); shake(.12); VM.hurtT=.3; setHP(PLAYER.hp,true);
  if(PLAYER.hp<=0){ PLAYER.hp=100; setHP(100,true); F.knockouts=(F.knockouts||0)+1; if(F.bugFood>0){ F.bugFood--; setBugFood(F.bugFood); }
    runStory(async()=>{ await growBack(); bark('Jim',"Whoa! You got knocked out! Careful, those alien bugs bite!",LEVELS.mars.jim,3.2); }); }
}
function nearestBug(front,reach,deadOnly){
  const lv=LEVELS.mars; const fwd=V3(-Math.sin(PLAYER.yaw),0,-Math.cos(PLAYER.yaw)); let best=null, bd=reach;
  for(const b of lv.bugs){ const B=b.userData.bug; if(deadOnly!==B.dead) continue; const to=b.position.clone().sub(PLAYER.pos); to.y=0; const d=to.length(); if(d>bd) continue; if(front && d>.12 && to.normalize().dot(fwd)<.45) continue; bd=d; best=b; }
  return best;
}
function punch(){
  if(PLAYER.scale>.5||!PLAYER.ctl.move||VM.punchT>0) return;
  VM.punchT=.28; SFX.punch();
  const b=nearestBug(true,.55,false); if(!b) return;
  const B=b.userData.bug; B.hp--; B.hitFlash=.15; SFX.hit(); shake(.05);
  const fwd=V3(-Math.sin(PLAYER.yaw),0,-Math.cos(PLAYER.yaw)); B.knock=fwd.multiplyScalar(1.2);
  LEVELS.mars.glow.burst(b.position.clone().add(V3(0,.1,0)),{color:0xffe066,count:10,speed:.8,size:.012,life:.35,grav:-2});
  if(B.hp<=0){ unlock('firstAnt'); const Fk=F_(); Fk.kos=(Fk.kos||0)+1; if(Fk.kos>=10) unlock('ants10'); }
  if(B.hp<=0 && F_().day===2){ B.dead=true; SFX.squish(); const F=F_(); F.killed=(F.killed||0)+1; toast('Alien ant knocked out! ('+F.killed+')','#ffcc33'); shiftObjective2(); LEVELS.mars.soft.burst(b.position.clone().add(V3(0,.08,0)),{color:0x6dffd8,count:14,speed:.6,size:.02,life:.6,grav:-1}); later(2.2,()=>{ LEVELS.mars.soft.burst(b.position.clone().add(V3(0,.05,0)),{color:0xb8a0d8,count:16,speed:.4,size:.03,life:.8,grav:-.5}); B.remove=true; }); return; }
  if(B.hp<=0){ B.dead=true; SFX.squish(); toast(IS_TOUCH?'Knocked out! Tap USE to chop':'Knocked out! Press E to chop','#ffcc33'); LEVELS.mars.soft.burst(b.position.clone().add(V3(0,.08,0)),{color:0x6dffd8,count:14,speed:.6,size:.02,life:.6,grav:-1}); }
}
function chopBug(b){
  const F=F_(); VM.chopT=.35; SFX.chop(); shake(.06);
  const B=b.userData.bug; B.remove=true;
  LEVELS.mars.soft.burst(b.position.clone().add(V3(0,.06,0)),{color:0x9ad16a,count:18,speed:.7,size:.015,life:.6,grav:-3});
  F.bugFood=(F.bugFood||0)+1; F.chopped=(F.chopped||0)+1; setBugFood(F.bugFood); toast('+1 alien bug food','#9aff7a'); SFX.cash();
}
async function shrinkDown(){ const F=F_(); if(PLAYER.scale<.5) return; PLAYER.watchLook=1; PLAYER.watchGlow=1; SFX.shrink(); await wait(.35); PLAYER.targetScale=.1; PLAYER.fovKick=16; flashWhite(.25,.4); setHP(PLAYER.hp,true); await wait(.6); PLAYER.watchLook=0; PLAYER.watchGlow=0; F.shrunkOnce=true; }
async function growBack(){ if(PLAYER.scale>.5) return; PLAYER.watchLook=1; PLAYER.watchGlow=1; SFX.grow(); await wait(.3); PLAYER.targetScale=1; PLAYER.fovKick=-12; flashWhite(.2,.4); await wait(.6); PLAYER.watchLook=0; PLAYER.watchGlow=0; setHP(PLAYER.hp,false); }
on('shrink',()=>{ const F=F_(); if(!LV||LV.name!=='mars'||!PLAYER.hasWatch||!PLAYER.ctl.move||F.cooking) return; if(!F.canShrink){ bark('You',"Not now.",null,1.4); return; } if(PLAYER.scale<.5) runStory(growBack); else runStory(shrinkDown); });
on('primary',()=>{ if(LV&&LV.name==='mars') punch(); });

CHECKPOINTS.B2=async()=>{
  const lv=await enterLevel('mars',{pos:V3(16,0,6),yaw:1.2});
  setCheckpoint('B2'); const F=F_();
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=false;
  F.bugFood=0; F.chopped=0; F.bitten=0; F.cookResults=[]; F.shiftOn=false; F.bugsOn=true;
  setBugFood(0,false); setHP(100,false); PLAYER.hp=100;
  for(const b of lv.bugs) lv.scene.remove(b); lv.bugs.length=0; for(let i=0;i<7;i++) spawnMarsBug(lv);
  lv.rocket.position.set(22,marsHeight(22,12)+1.1,12); setRocketFlame(lv.rocket,0);
  const jim=lv.jim; jim.visible=true; jim.position.set(17.6,marsHeight(17.6,7.9),7.9); jim.rotation.y=-2.5; setMood(jim,'happy'); jim.userData.A.path=null;
  lv.stewU.heat.value=0; lv.stewU.burn.value=0; for(const b of lv.potBugs) b.visible=false;
  if(!lv.interSetup){ lv.interSetup=true; setupMarsInteractions(lv); }
  hudVisible(true); await fade(0,1.2);
  say('Mars. Robot people everywhere... and they love bug food.',3.8);
  await wait(1.5);
  lookAtPoint(V3(jim.position.x,1.6+jim.position.y,jim.position.z),.8); await wait(.8);
  const S={h:jim,who:'Jim'}; jim.userData.A.look='player';
  await talk([
    {...S,text:"Welcome to Mars! See those guys? Robot people. And they LOVE bug food.",pose:'point'},
    {...S,text:"But this isn't any type of bug food. This is ALIEN bug food.",pose:'talk'},
    {...S,text:"Oh, and your old watch... well, it was broken.",mood:'worried',pose:'shrug'},
    {...S,text:"So here! A new watch!",mood:'happy',pose:'holdOut',fx:()=>runStory(giveWatch)}
  ]);
  await waitUntil(()=>F_().watchGiven,5);
  await talk([
    {who:'You',text:"Is it... better?"},
    {...S,text:"Well. It just looks better. That's all.",pose:'shrug'},
    {...S,text:"But it makes a new sound! Anyway, your shift starts now. Twelve to one.",pose:'talk'},
    {...S,text:"Shrink down, get those alien bugs, and chop 'em up into bug food. They're over by the glowing plants.",pose:'point'}
  ]);
  clearPose(jim); jim.userData.A.look=null;
  runStory(async()=>{ await walkTo(jim,[V3(12,0,2),V3(0,0,-2.4)],1.4); faceYaw(jim,0); });
  startShift();
};
async function giveWatch(){
  const F=F_(); if(F.watchGiven) return;
  PLAYER.hasWatch=true; PLAYER.watchLook=1; PLAYER.watchGlow=1; SFX.watchNew(); toast('Got: NEW WATCH','#6dffd8');
  await wait(1.6); PLAYER.watchGlow=0; await wait(.6); PLAYER.watchLook=0; F.watchGiven=true;
}
function setupMarsInteractions(lv){
  const jim=lv.jim;
  addInteract(lv,{obj:jim,offset:V3(0,1.6,0),label:()=>F_().day===2?'Wake up Jim':'Talk to Jim',reach:3.6,when:()=>PLAYER.scale>.5&&!DLG.active&&(F_().day===2?(!!F_().jimAsleep&&!!F_().shiftOver):!F_().paid),act:()=>runStory(F_().day===2?wakeJim:talkJimMars)});
  addInteract(lv,{obj:lv.cooker,offset:V3(0,1.4,0),label:()=>F_().bugFood>0?'Cook the bug food ('+F_().bugFood+')':'Bug Cooker 3000 (no bug food)',reach:2.4,when:()=>F_().day!==2&&F_().shiftOver&&!F_().cooked&&PLAYER.scale>.5,act:()=>{ if(F_().bugFood>0) runStory(cooking); else bark('You',"I don't have any bug food to cook.",null,2.2); }});
  addInteract(lv,{pos:V3(0,.2,0),label:'Chop the bug',reach:.55,aim:false,when:()=>F_().day!==2&&PLAYER.scale<.5&&!!nearestBug(false,.6,true),act:()=>{ const b=nearestBug(false,.6,true); if(b) chopBug(b); }});
  lv.inter[lv.inter.length-1].posFn=true;
  for(const h of lv.houses) addInteract(lv,{obj:h.seller,offset:V3(0,1.5,0),label:'Talk',reach:2.6,when:()=>F_().day===2&&h.seller.visible&&!F_().nightfall,act:()=>{ if(HUD.coins>=h.price) runStory(()=>sellerSellNow(h)); else bark('Seller',`It's ${h.price} alien coins. You've got ${HUD.coins}. Come back when you've got enough.`,h.seller,3.6); }});   // with the REAL numbers (it just said 'come back when you've got the coins')
  for(const h of lv.houses) addInteract(lv,{obj:h.seller,offset:V3(0,1.5,0),label:'Ask about the house',reach:2.6,when:()=>(F_().houseHunt||F_().day3Buy)&&!h.sold,act:()=>runStory(()=>sellerTalk(h))});
  addInteract(lv,{obj:lv.convAlien,offset:V3(0,1.5,0),label:'Talk to the Alien Converter',reach:2.8,when:()=>F_().houseHunt||F_().day2Convert||F_().day3Buy,act:()=>runStory(converterTalk)});
  const mid=lv.houses.find(h=>h.price===100);
  addInteract(lv,{pos:mid.door,label:'Go inside your new house',reach:2.8,aim:false,when:()=>!!F_().boughtBig,act:()=>runStory(enterBigHouse)});
  const tiny=lv.houses.find(h=>h.price===50);
  addInteract(lv,{pos:tiny.door,label:'Go inside your house',reach:2.6,aim:false,when:()=>F_().day===2?!!F_().goHome:!!F_().boughtHouse,act:()=>runStory(F_().day===2?goHomeNight:enterNewHouse)});
  for(const r of lv.queue) addTrigger(lv,{pos:r.position,r:2,once:false,fn:()=>nagOnce('rq'+lv.queue.indexOf(r),15,()=>bark('Robot',pick(['NOM. NOM. ALIEN BUG FOOD: DELICIOUS.','BEEP. THIS IS MY FIFTH BOWL.','RATING: TEN OUT OF TEN BOLTS.','MORE CRUNCH. PLEASE.']),r,2.6))});
  addTrigger(lv,{pos:V3(4,0,26),r:7,once:true,when:()=>F_().houseHunt&&!F_().convHint,fn:()=>{ const s=lv.houses[0].seller; bark('Seller','Hey! You! You looking for a house?',s,2.6); s.userData.A.look='player'; setPose(s,'wave'); setTimeout(()=>clearPose(s),1800); }});
}
/* the chop interact follows you around (it's "wherever the nearest knocked-out bug is") */
on('tick',()=>{ if(!LV||LV.name!=='mars') return; for(const it of LV.inter) if(it.posFn){ it.pos=PLAYER.pos.clone(); } });
function fmtClock(m){ let h=Math.floor(m/60)%24, mm=Math.floor(m%60); const ap=h>=12?'PM':'AM'; let hh=h%12; if(hh===0) hh=12; return hh+':'+(mm<10?'0':'')+mm+' '+ap; }
function startShift(){
  const F=F_(); F.shiftOn=true; F.canShrink=true; F.clock=12*60; F.shiftStart=G.time;
  showClock(true,fmtClock(F.clock)); setBugFood(0,true);
  objective('Work your shift until 1:00 PM — shrink with '+(IS_TOUCH?'⌚':'<kbd>F</kbd>')+', punch bugs, chop them');
  itemHints([IS_TOUCH?'<kbd>⌚</kbd> shrink / grow':'<kbd>F</kbd> shrink / grow',IS_TOUCH?'<kbd>👊</kbd> punch':'<kbd>Click</kbd> punch',IS_TOUCH?'<kbd>USE</kbd> chop a knocked-out bug':'<kbd>E</kbd> chop a knocked-out bug']);
  TOUCH_UI.show({act:true,shrink:true});
  PLAYER.free();
}
on('tick',dt=>{
  if(!LV||LV.name!=='mars') return; const F=F_(); if(!F.shiftOn||F.shiftOver) return;
  F.clock+=dt*.8; showClock(true,fmtClock(F.clock));
  if(F.clock>=13*60){ F.clock=13*60; runStory(endShift); }
});
async function endShift(){
  const F=F_(); if(F.shiftOver) return; F.shiftOver=true; F.shiftOn=false; if(!(F.bitten>0)&&(F.kos||0)>0) unlock('untouchable');
  SFX.alarm(); showClock(true,'1:00 PM');
  say('<b>1:00 PM</b> — that\'s the end of your shift!',3.4);
  if(PLAYER.scale<.5){ await wait(.8); await growBack(); }
  itemHints(null);
  if(F.day===2){ F.canShrink=false; showClock(false); objective('Wake up Jim'); return; }
  if((F.bugFood||0)===0){
    bark('Jim',"No bug food?! Go shrink down and chop at least three bugs, then cook 'em!",LEVELS.mars.jim,4);
    objective('Get some bug food (shrink with '+(IS_TOUCH?'⌚':'F')+'), then cook it in the Bug Cooker 3000');
    F.canShrink=true; showClock(false);
  } else { F.canShrink=false; showClock(false); objective('Cook ALL the bug food in the Bug Cooker 3000'); }
}
async function talkJimMars(){
  const lv=LEVELS.mars, jim=lv.jim, F=F_();
  if(!F.watchGiven) return;
  if(!F.shiftOver){ bark('Jim',pick(["Shift's not over yet! Get shrinking!","Twelve to one. You know the drill.","The bugs are by the glowing plants!"]),jim,2.6); return; }
  if(!F.cooked){ bark('Jim',F.bugFood>0?"Cook all the bug food first! The Bug Cooker 3000's right there.":"No bug food? Shrink down and get some!",jim,3); return; }
  if(F.paid) return;
  PLAYER.lock(); objective(null); jim.userData.A.look='player'; lookAtPoint(V3(jim.position.x,1.65,jim.position.z),.6);
  const S={h:jim,who:'Jim'};
  await talk([
    {...S,text:"Okay, now that you have got all the bug food, you can go find a home.",pose:'talk'},
    {...S,text:"I know we lost our home on Earth. I know.",pose:'shrug',mood:'worried'},
    {...S,text:"But you'll need your own place to sleep. You can't keep sleeping at mine.",pose:'talk',mood:'neutral'},
    {...S,text:"I already booked one. As soon as I got on this planet.",pose:'hips',mood:'happy'},
    {...S,text:"Here's your paycheck. Now go get some sleep.",pose:'holdOut'}
  ]);
  clearPose(jim); SFX.paper();
  showPaycheck();
}
function showPaycheck(){
  const F=F_(); F.paid=true;
  const res=F.cookResults||[]; const burnt=res.filter(r=>r.burnt).length; const stirMiss=res.reduce((a,r)=>a+r.miss,0);
  const n=F.chopped||0;
  let did=[['Showed up and worked 12:00 – 1:00 PM','$20'],['Chopped '+n+' alien bug'+(n===1?'':'s')+' into bug food','$15'],['Cooked all the bug food','$15']];
  let bonuses=[['Chop 12 or more bugs',n>=12,'+$10'],['Cook with zero burnt batches',burnt===0,'+$10'],['Never get bitten by a bug',!(F.bitten>0),'+$5'],['Hit every STIR!',stirMiss===0&&res.length>0,'+$5']];
  if(F.day===2){ const k=F.killed||0; did=[['Showed up and worked 12:00 – 1:00 PM','$25'],['Knocked out '+k+' alien ant'+(k===1?'':'s'),'$25']]; bonuses=[['Knock out 12 or more alien ants',k>=12,'+$10'],['Never get bitten by an ant',!(F.bitten>0),'+$5']]; }
  $('payDid').innerHTML=did.map(([t,m])=>'<div class="pl"><span><span class="ck">✔</span>'+t+'</span><span class="m">'+m+'</span></div>').join('');
  const missed=bonuses.filter(b=>!b[1]);
  $('payMiss').innerHTML=missed.length?missed.map(([t,,m])=>'<div class="pl miss"><span><span class="ck">✘</span>'+t+'</span><span class="m">'+m+'</span></div>').join(''):'<div class="pl"><span>Nothing! You did everything right.</span></div>';
  $('payAmt').textContent='$50.00';
  openModal('payOverlay'); SFX.cash();
  MODAL.onEsc=null; MODAL.onKey=code=>{ if(code==='Enter') $('payClose').click(); };
}
$('payClose').onclick=()=>{ closeModal('payOverlay'); SFX.uiClick();
  const F=F_(); HUD.cash=50; setCash(50); showCash(true); SFX.cash();
  if(F.day===2){ F.day2Convert=true; objective('Convert your paycheck into alien coins'); PLAYER.free(); const jim=LEVELS.mars.jim; jim.userData.A.look=null; clearPose(jim); return; }
  setCheckpoint('B3');
  runStory(async()=>{ const jim=LEVELS.mars.jim; jim.userData.A.look=null; clearPose(jim); runStory(()=>jimGoesHome(LEVELS.mars));
    await wait(.6); objective('Find a house to buy'); say('Objective: find a house to buy. You only have fifty dollars. Which is very broke.',4.4); F_().houseHunt=true; PLAYER.free(); laneMarker(); });
};

/* point the way to Crater Lane (the houses for sale) until you get there */
function laneMarker(){ const L=V3(12,3,33); setMarker(()=>L,'Houses for sale','m'); runStory(async()=>{ await waitUntil(()=>Math.hypot(PLAYER.pos.x-L.x,PLAYER.pos.z-L.z)<12||!F_().houseHunt); setMarker(null); }); }
/* ---------- people on Mars have homes ---------- */
/* who's out on Crater Lane: a seller leaves once their house is sold; nobody hangs around your old house */
function marsSellers(lv,o={}){
  const F=F_();
  for(const h of lv.houses){
    let gone=!!o.night;
    if(h.price===50 && (F.day>=2 || F.boughtHouse)) gone=true;
    if(h.price===100 && (F.boughtBig || o.dome)) gone=true;
    h.seller.visible=!gone;
  }
  if(o.night) lv.convAlien.visible=false;
}
/* an alien walks off down the lane and goes home (after selling, or when it gets dark) */
async function alienGoesHome(a,delay=0){
  if(!a||!a.visible) return; const tok=STORY.token;
  await wait(delay); if(tok!==STORY.token||!a.visible) return;
  const A=a.userData.A; A.look=null; clearPose(a); A.faceNear=false;
  await walkTo(a,[V3(a.position.x,0,29),V3(-34,0,29)],1.35);
  if(tok!==STORY.token) return; a.visible=false; A.faceNear=true;
}
/* Jim walks home to his own house, around the stand and the buildings, and goes inside */
async function jimGoesHome(lv){
  const jim=lv.jim, d=lv.jimDoor, tok=STORY.token; jim.userData.A.look=null; jim.userData.A.sleep=false;
  const behind=jim.position.z<-4.5;   // behind the stand counter: go out the side first
  const path=behind?[V3(3.9,0,-6.3),V3(1,0,-10.5),V3(-7,0,-11.5),V3(-11,0,-17.5)]:[V3(-4.6,0,-1.6),V3(-7,0,-8),V3(-11,0,-17.5)];
  path.push(V3(d.x,0,d.z+1.2),V3(d.x,0,d.z+.3));
  // start from the closest point on the route (never walk back to the stand first)
  let best=0, bd=1e9; path.forEach((q,i)=>{ const dd=Math.hypot(q.x-jim.position.x,q.z-jim.position.z); if(dd<bd){ bd=dd; best=i; } });
  await walkTo(jim,path.slice(best),1.3);
  if(tok!==STORY.token) return;
  sfxAt(d,()=>SFX.alienDoor(),2); jim.visible=false;
}
/* day 2 evening: it gets dark, the sellers head home, Jim goes home */
async function marsNightfall(){
  const lv=LEVELS.mars, F=F_(); if(F.nightfall||LV!==lv) return; F.nightfall=true;
  runStory(async()=>{ await tweenVal(k=>lv.setNight(k*.9),7); });
  await wait(1.2); say("It's getting dark. Everybody on Mars is heading home.",3.8);
  let dl=.5; for(const h of lv.houses) if(h.seller.visible){ runStory(()=>alienGoesHome(h.seller,dl)); dl+=1.4; }
  if(lv.jim.visible){ clearPose(lv.jim); setMood(lv.jim,'tired'); runStory(()=>jimGoesHome(lv)); }
}
/* ================= B3: HOUSE HUNTING ================= */
CHECKPOINTS.B3=async()=>{
  const lv=await enterLevel('mars',{pos:V3(2,0,2),yaw:Math.PI});
  setCheckpoint('B3'); const F=F_();
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=true;
  if(!lv.interSetup){ lv.interSetup=true; setupMarsInteractions(lv); }
  for(const b of lv.bugs) lv.scene.remove(b); lv.bugs.length=0; F.bugsOn=true;
  lv.jim.visible=false;
  F.paid=true; F.cooked=true; F.shiftOver=true; F.watchGiven=true; F.houseHunt=true;
  HUD.cash=50; setCash(50,false); showCash(true); HUD.coins=0; setCoins(0,false); showCoins(false);
  hudVisible(true); await fade(0,1);
  objective('Find a house to buy'); PLAYER.free(); laneMarker();
};
/* any day: if you have the coins, you can buy it right now (their pick) */
async function sellerSellNow(h){
  const s=h.seller, S={h:s,who:'Seller',voice:'Seller'}; PLAYER.lock(); s.userData.A.look='player'; lookAtPoint(V3(s.position.x,s.position.y+1.6,s.position.z),.5);
  await talk([{...S,text:`${h.price} alien coins, and you've got them? It's yours if you want it!`},{who:'You',text:"Deal!"}]);
  s.userData.A.look=null; PLAYER.free(); openBuy(h);
}
async function sellerTalk(h){
  const F=F_(), s=h.seller, S={h:s,who:'Seller',voice:'Seller'}; PLAYER.lock(); s.userData.A.look='player'; lookAtPoint(V3(s.position.x,s.position.y+1.6,s.position.z),.5);
  const coins=HUD.coins;
  if(!F.convHint&&F.day!==3){
    if(h.price===100) await talk([{...S,text:"You want a house? I'm selling this one for a hundred alien coins."},{who:'You',text:"What is a hundred alien coins? I only have fifty dollars."},{...S,text:"Dollars? Ha! You can convert your dollars into alien coins at the alien converter."},{...S,text:"He's right by my house. Go talk to him.",pose:'point'}]);
    else if(h.price===2000) await talk([{...S,text:"This beauty? Two thousand alien coins."},{who:'You',text:"Alien coins? I only have dollars."},{...S,text:"Then go see the alien converter. He's by the dome house over there.",pose:'point'}]);
    else if(h.price===50) await talk([{...S,text:"This one's fifty alien coins. It's... kind of small."},{who:'You',text:"I don't have alien coins. Just dollars."},{...S,text:"The alien converter's by the dome house. He'll swap 'em for you.",pose:'point'}]);
    else await talk([{...S,text:"Seven hundred fifty alien coins. Hex houses are VERY in right now."},{who:'You',text:"Alien coins? I only have dollars."},{...S,text:"Converter's by the dome house.",pose:'point'}]);
    F.convHint=true; clearPose(s); objective('Go talk to the Alien Converter');
  } else if(h.price===2000){ await talk([{...S,text:"Two thousand alien coins. Final offer."},{who:'You',text:coins>=2000?"...Wow.":"I can't even afford that."}]); }
  else if(h.price===100){
    if(F.day===3&&coins>=100){ await talk([{...S,text:"The Dome Sweet Dome! A hundred alien coins. Deal?"},{who:'You',text:"Deal!"}]); s.userData.A.look=null; PLAYER.free(); openBuy(h); return; }
    if(F.day===3){ await talk([{...S,text:"A hundred alien coins. You don't have enough yet."},{who:'You',text:"I need to go to the converter first."}]); }
    else await talk([{...S,text:coins>=100?"A hundred alien coins! Deal?":"Still a hundred alien coins. Come back when you're richer."},{who:'You',text:coins>=100?"Let me look around first.":"Guess I'll keep looking."}]); }
  else if(h.price===50){
    if(coins>=50){ await talk([{...S,text:"Selling this house for fifty alien coins! It's kind of bad. It's not that big..."},{...S,text:"...but it's yours if you want it."}]); s.userData.A.look=null; PLAYER.free(); openBuy(h); return; }
    await talk([{...S,text:"Fifty alien coins. You don't have enough. So... no."},{who:'You',text:"I need more alien coins."}]);
  }
  s.userData.A.look=null; clearPose(s); PLAYER.free();
}
async function converterTalk(){
  const F=F_(), c=LEVELS.mars.convAlien, S={h:c,who:'Converter',voice:'Converter'}; PLAYER.lock(); c.userData.A.look='player'; lookAtPoint(V3(c.position.x,c.position.y+1.6,c.position.z),.5);
  if(HUD.cash<=0){ await talk([{...S,text:"You're out of dollars, friend. Nothing to convert."}]); PLAYER.free(); return; }
  await talk([{...S,text:F.converted?"Back again? Welcome to the Alien Currency Converter.":"Welcome to the Alien Currency Converter. One dollar, one alien coin. No refunds."},{...S,text:"What amount of money do you want to convert?"}]);
  openConverter();
}
function openConverter(){
  $('convCash').textContent=HUD.cash; $('convCoins').textContent=HUD.coins; $('convErr').textContent=''; const inp=$('convIn'); inp.value=''; inp.max=HUD.cash;
  openModal('convOverlay'); setTimeout(()=>inp.focus(),50);
  MODAL.onEsc=()=>$('convCancel').click();
}
$('convIn').addEventListener('keydown',e=>{ if(e.code==='Enter'||e.key==='Enter'){ e.preventDefault(); $('convGo').click(); } if(e.code==='Escape') $('convCancel').click(); });
$('convCancel').onclick=()=>{ closeModal('convOverlay'); SFX.uiBack(); PLAYER.free(); };
$('convGo').onclick=()=>{
  const raw=$('convIn').value.trim(); const v=Number(raw);
  if(raw===''||!isFinite(v)){ $('convErr').textContent='Type a number first.'; SFX.cantCarry(); return; }
  if(v<=0){ $('convErr').textContent='It has to be more than zero.'; SFX.cantCarry(); return; }
  if(Math.floor(v)!==v){ $('convErr').textContent='Whole dollars only. No cents on Mars.'; SFX.cantCarry(); return; }
  if(v>HUD.cash){ $('convErr').textContent='You only have $'+HUD.cash+'.'; SFX.cantCarry(); return; }
  closeModal('convOverlay'); SFX.uiClick();
  runStory(async()=>{
    const F=F_(); PLAYER.lock();
    SFX.converter(); shake(.05); const K=LEVELS.mars.converter; LEVELS.mars.glow.burst(K.localToWorld(V3(0,1.5,.6)),{color:0x6dffd8,count:30,speed:2,size:.05,life:1,grav:-1});
    await wait(1.5);
    HUD.cash-=v; setCash(HUD.cash); HUD.coins+=v; showCoins(true); setCoins(HUD.coins); coinBurst(Math.min(20,6+Math.round(v/5))); SFX.coins();
    toast('+'+v+' ALIEN COINS','#6dffd8');
    bark('Converter','There you go. All converted. Pleasure doing business.',LEVELS.mars.convAlien,3);
    F.converted=true; if(HUD.cash<=0) showCash(false);
    if(F.day===2){ F.goHome=true; objective(HUD.cash>0?'Go back home (or convert the rest)':'Go back home'); runStory(marsNightfall); }
    else if(F.day===3&&F.boughtBig){ const mid=LEVELS.mars.houses.find(q=>q.price===100); objective('Go inside your new house'); setMarker(()=>mid.door.clone().add(V3(0,2,0)),'Your new house','m'); }   // you already bought it on day 2
    else if(F.day===3){ if(HUD.coins>=100){ objective('Buy the Dome Sweet Dome'); const mid=LEVELS.mars.houses.find(h=>h.price===100); setMarker(()=>mid.seller.position.clone().add(V3(0,2.2,0)),'Dome Sweet Dome','m'); } else objective('Convert the rest of your dollars'); }
    else objective(HUD.coins>=50?'Check the other houses for one you can actually buy':'Get more alien coins, then find a house');
    PLAYER.free();
  });
};
function openBuy(h){
  $('buyName').textContent=h.name; $('buyDesc').textContent=h.price===50?"Kind of bad. Not that big. Very alien. Very cheap.":h.price===100?"Bigger. A lot of new stuff. Better stuff.":'';
  $('buyPrice').innerHTML='<span class="acoin"></span> '+h.price; $('buyErr').textContent=HUD.coins<h.price?'You only have '+HUD.coins+' alien coins.':''; $('buyYes').disabled=HUD.coins<h.price;
  openModal('buyOverlay'); MODAL.onEsc=()=>$('buyNo').click(); BUY_H=h;
}
let BUY_H=null;
$('buyNo').onclick=()=>{ closeModal('buyOverlay'); SFX.uiBack(); PLAYER.free(); };
$('buyYes').onclick=()=>{ const h=BUY_H; if(!h||HUD.coins<h.price) return; closeModal('buyOverlay');
  HUD.coins-=h.price; setCoins(HUD.coins); h.sold=true; SFX.keys(); SFX.cash();
  runStory(()=>alienGoesHome(h.seller,3.4));
  if(F_().day===2){ F_().boughtBig=true; unlock('bigHouse'); toast('YOU BOUGHT A BIGGER HOUSE!','#6dffd8'); bark('Seller','Pleasure doing business, human! Here are your keys.',h.seller,3); PLAYER.free(); return; }   // bought on day 2: you move in after work tomorrow
  if(F_().day===3){ F_().boughtBig=true; unlock('bigHouse'); toast('YOU BOUGHT A BIGGER HOUSE!','#6dffd8'); bark('Seller','Pleasure doing business, human! Here are your keys.',h.seller,3); objective('Go inside your new house'); setMarker(()=>h.door.clone().add(V3(0,2,0)),'Your new house','m'); PLAYER.free(); return; }
  unlock('house'); F_().boughtHouse=true;
  toast('YOU BOUGHT A HOUSE!','#6dffd8'); bark('Seller','Pleasure doing business, human! Here are your keys.',h.seller,3);
  objective('Go inside your new house'); PLAYER.free(); };
async function enterNewHouse(){
  PLAYER.lock(); objective(null); sfxAt(PLAYER.pos,()=>SFX.alienDoor(),2); await fade(1,.8);
  startFromCheckpointInner('B4');
}

/* ================= COOKING: the Bug Cooker 3000 ================= */
async function cooking(){
  const lv=LEVELS.mars, F=F_(); if(F.cooking) return; F.cooking=true; PLAYER.lock(); objective(null); hidePrompt(); itemHints(null);
  playMusic('cook',.8);
  const C=lv.cooker;
  await camShot(C.localToWorld(V3(-.2,3.3,2.2)),C.localToWorld(V3(0,1.35,0)),{dur:.9,fov:48});
  $('cook').classList.add('show'); TOUCH_UI.show({act:true});
  $('cookHow').innerHTML=(IS_TOUCH?'Hold <kbd>👊</kbd>':'Hold <kbd>Space</kbd> or the mouse')+' to heat it up.<br>Keep the needle inside the white box.<br>When it says <b>STIR!</b> press '+(IS_TOUCH?'<kbd>USE</kbd>':'<kbd>E</kbd>')+'.';
  const total=F.bugFood; const batches=Math.ceil(total/4); F.cookResults=[]; let left=total;
  for(let b=0;b<batches;b++){
    const n=Math.min(4,left); left-=n;
    $('cookBatch').textContent='Batch '+(b+1)+' of '+batches+' · '+n+' alien bug food';
    // drop the bugs in
    for(let i=0;i<n;i++){ const pb=lv.potBugs[i]; pb.visible=true; pb.position.set(rand(-.5,.5),3,rand(-.5,.5)); runStory(async()=>{ await tweenVal(k=>pb.position.y=lerp(3,1.47,k*k),.45); sfxAt(C.localToWorld(V3(0,1.5,0)),()=>SFX.splash(),2); lv.soft.burst(C.localToWorld(V3(pb.position.x,1.5,pb.position.z)),{color:0xffb060,count:10,speed:1.5,size:.05,life:.5,grav:-6}); }); F.bugFood--; setBugFood(F.bugFood); await wait(.28); }
    await wait(.5);
    const res=await cookBatch(lv,b);
    F.cookResults.push(res);
    lv.stewU.heat.value=0;
    if(res.burnt) unlock('burnt'); else if(res.miss===0) unlock('chef');
    if(res.burnt){ SFX.burnt(); toast('Burnt! (still counts)','#ff8a6a'); for(let i=0;i<6;i++) lv.soft.burst(C.localToWorld(V3(0,1.7,0)),{color:0x2a2622,count:12,speed:1,size:.4,life:2.4,grav:.8,grow:2,alpha:.6}); }
    else { SFX.ding(); toast(res.miss===0?'PERFECT BATCH!':'Batch cooked!','#9aff7a'); }
    for(const pb of lv.potBugs) pb.visible=false;
    lv.stewU.burn.value=0;
    await wait(.9);
  }
  $('cook').classList.remove('show'); camRelease(.7); playMusic('mars',1);
  F.cooking=false; F.cooked=true; toast('All the bug food is cooked!','#ffcc33');
  objective('Talk to Jim'); PLAYER.free(); TOUCH_UI.show({act:false,shrink:false});
}
function cookBatch(lv,b){
  return new Promise(res=>{
    const tok=STORY.token; const st={heat:0,prog:0,burn:0,zone:.5,zoneT:.5,width:.24-b*.02,stirAt:G.time+rand(2.5,4),stirOpen:0,hit:0,miss:0};
    const zoneEl=$('heatZone'), needle=$('heatNeedle'), done=$('doneBar').firstElementChild, burn=$('burnBar').firstElementChild, call=$('stirCall');
    const onKey=code=>{ if(code==='KeyE' && st.stirOpen>0){ st.stirOpen=0; st.hit++; st.prog=Math.min(1,st.prog+.1); SFX.stir(); call.classList.remove('show'); lv.stirArm.arm1.rotation.y+=2; toast('Nice stir!','#9aff7a'); return true; } if(code==='Space'||code==='KeyE') return true; };
    LV_KEY_HOOK=onKey;
    const tick=dt=>{
      if(tok!==STORY.token){ off(); return; }
      if(G.paused) return;
      const heating=keys.Space||INPUT.mouseDown||TOUCH.actHeld;
      st.heat=clamp(st.heat+(heating?.62:-.4)*dt,0,1);
      if(Math.abs(st.zone-st.zoneT)<.01) st.zoneT=rand(.3,.7); st.zone=damp(st.zone,st.zoneT,.6,dt);
      const lo=st.zone-st.width/2, hi=st.zone+st.width/2;
      if(st.heat>=lo&&st.heat<=hi){ st.prog+=.14*dt; st.burn=Math.max(0,st.burn-.12*dt); }
      else if(st.heat<lo){ st.prog+=.035*dt; st.burn=Math.max(0,st.burn-.12*dt); }
      else { st.prog+=.06*dt; st.burn+=.42*dt; if(Math.random()<dt*8) lv.soft.burst(lv.cooker.localToWorld(V3(rand(-.5,.5),1.6,rand(-.5,.5))),{color:0x3a3430,count:2,speed:.6,size:.3,life:1.6,grav:.8,grow:2,alpha:.5}); }
      if(G.time>st.stirAt && st.stirOpen<=0){ st.stirOpen=1.6; st.stirAt=G.time+rand(3,5); call.classList.add('show'); SFX.objective(); }
      if(st.stirOpen>0){ st.stirOpen-=dt; if(st.stirOpen<=0){ st.miss++; st.burn+=.22; call.classList.remove('show'); toast('Missed the stir!','#ff8a6a'); } }
      lv.stewU.heat.value=st.heat; lv.stewU.burn.value=clamp(st.burn,0,1);
      if(Math.random()<dt*(st.heat*10)) sfxAt(lv.cooker.localToWorld(V3(0,1.5,0)),()=>SFX.bubbleLoop(),2);
      zoneEl.style.left=(lo*100)+'%'; zoneEl.style.width=(st.width*100)+'%'; needle.style.left=(st.heat*100)+'%'; done.style.width=(Math.min(1,st.prog)*100)+'%'; burn.style.width=(Math.min(1,st.burn)*100)+'%'; $('cookPct').textContent=Math.floor(Math.min(1,st.prog)*100)+'%';
      if(st.burn>=1||st.prog>=1){ off(); res({burnt:st.burn>=1,hit:st.hit,miss:st.miss}); }
    };
    const off=()=>{ const i=(BUS.tick||[]).indexOf(tick); if(i>=0) BUS.tick.splice(i,1); LV_KEY_HOOK=null; call.classList.remove('show'); };
    on('tick',tick);
  });
}
let LV_KEY_HOOK=null;

/* ================= B4: YOUR ALIEN HOUSE ================= */
CHECKPOINTS.B4=async()=>{
  const lv=await enterLevel('alienhouse',{pos:V3(0,0,4.9),yaw:0});
  setCheckpoint('B4'); const F=F_();
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=true; showCash(false); showCoins(true); setCoins(HUD.coins||0,false);
  setupHouseInteractions(lv);
  sfxAt(V3(0,1,5.4),()=>SFX.alienDoor(),2);
  await fade(0,1);
  say("It's pretty big on the inside. But not that big. It's like your old house... but alien.",4.6); await wait(4.8);
  say("Alien table. Alien bed. Alien ceiling, alien floor, alien walls. It's crazy.",4.4); PLAYER.free(); await wait(4.6);
  say("And an alien computer. For only fifty alien coins. But hey, it's alien.",4.2); await wait(3);
  F.tourNeeded=true; F.tour={}; F.tourDone=false;
  objective('Check out your new house: <b>0</b>/2');
};
/* day 1: look at the table and the computer before the bed unlocks */
function houseTour(k){
  const F=F_(); if(!F.tourNeeded||F.tourDone) return; F.tour=F.tour||{}; F.tour[k]=true;
  const n=Object.keys(F.tour).length;
  if(n>=2){ F.tourDone=true; later(.8,()=>{ objective('Go to sleep'); SFX.objective(); }); }
  else objective('Check out your new house: <b>'+n+'</b>/2',true);
}
function setupHouseInteractions(lv){
  if(lv.interSetup) return; lv.interSetup=true;
  const tourLeft=()=>F_().tourNeeded&&!F_().tourDone;
  addInteract(lv,{obj:lv.bed,offset:V3(0,.6,0),label:()=>tourLeft()?'Bed (look around first)':'Go to sleep',reach:2.4,when:()=>!F_().noSleep&&!F_().alarm,act:()=>{ if(tourLeft()){ bark('You',"Not yet. I wanna check out the house first.",null,2.6); return; } runStory(sleepInBed); }});
  addInteract(lv,{obj:lv.pc,offset:V3(0,1.2,0),label:'Use the alien computer',reach:2.2,when:()=>!F_().alarm,act:()=>{ houseTour('pc'); openAlienPC(); }});
  addInteract(lv,{obj:lv.table,offset:V3(0,1,0),label:'Alien table',reach:2.2,when:()=>!F_().alarm,act:()=>houseTour('table')||bark('You',pick(["An alien table. It's floating. Kind of.","The fruit is glowing. I'm not eating that."]),null,2.6)});
  addInteract(lv,{pos:V3(0,1,5.9),label:'Go outside',reach:2.2,aim:false,when:()=>!!F_().canLeave,act:()=>runStory(F_().day===3?openDoorDay3:goOutsideDay2)});
  addInteract(lv,{obj:lv.clock,offset:V3(0,.15,0),label:'Turn off the alarm',reach:2.6,when:()=>!!F_().alarm,act:()=>runStory(slapAlarm)});
}
const PC_PAGES={
  home:{text:'<span class="g">⌬ XZL-OS 9000</span>\n\nWELCOME HOME, HUMAN.\nNEW OWNER DETECTED: "YOU"\nHOUSE VALUE: Ѫ 50 (VERY GOOD DEAL)\n\nWhat would you like to do?',opts:[['Check bank','bank'],['Mars weather','weather'],['Messages (1)','msg'],['Earth news','news'],['Shut down','off']]},
  bank:{text:'<span class="g">ALIEN BANK OF MARS</span>\n\nBALANCE: Ѫ {coins}\nDOLLARS: $0\n\nTip: the alien converter\nturns dollars into alien coins.',opts:[['Back','home']]},
  news:{text:'<span class="g">EARTH NEWS</span>\n(from very far away)\n\nA HUGE PYRAMID showed up in an\nEarth desert. Overnight.\nNobody built it.\n\nScientists say: "huh."\n\nAlso: farm pigs are acting weird.',opts:[['Back','home']]},
  weather:{text:'<span class="g">MARS WEATHER</span>\n\nTODAY: dusty\nTOMORROW: dusty\nNEXT WEEK: extremely dusty\n\nChance of bugs: 100%',opts:[['Back','home']]},
  msg:{text:'<span class="g">1 NEW MESSAGE</span>\n\nFROM: JIM\n"hey hope the house is good.\n shift tomorrow is 12 to 1 again.\n don\'t be late!!"',opts:[['Back','home']]},
  off:{text:'SHUTTING DOWN...\n\n⌬ goodnight, human.',opts:[['Close','close']]}
};
let PC_CUR=null;
function openAlienPC(pages){ PC_CUR=pages||PC_PAGES; openModal('pcOverlay'); SFX.pcBoot(); showPC('home'); MODAL.onEsc=()=>{ closeModal('pcOverlay'); }; }
function showPC(k){ if(k==='close'){ closeModal('pcOverlay'); return; } if(k==='msg') unlock('computer'); const p=(PC_CUR||PC_PAGES)[k]; const scr=$('pcScreen'); const txt=p.text.replace('{coins}',HUD.coins||0); scr.innerHTML=''; let i=0; const plain=txt; (function type(){ if(i>=plain.length) return; i=Math.min(plain.length,i+3); scr.innerHTML=plain.slice(0,i).replace(/<span class="g">([^<]*)$/,'<span class="g">$1</span>'); if(i%9===0) SFX.pcKey(); setTimeout(type,12); })();
  $('pcOpts').innerHTML=''; for(const [label,to] of p.opts){ const b=document.createElement('button'); b.textContent='> '+label; b.onclick=()=>{ SFX.uiClick(); showPC(to); }; $('pcOpts').appendChild(b); } }
async function sleepInBed(){
  const F=F_(); if(F.sleeping) return; F.sleeping=true; F.canLeave=false; PLAYER.lock(); objective(null); hidePrompt();
  const lv=LEVELS.alienhouse; lookAtPoint(lv.bed.position.clone().add(V3(0,.6,0)),.6); await wait(.6);
  say("You climb into the alien bed. It hums softly. It's... actually really comfy.",4);
  await tweenVal(k=>{ PLAYER.eye=lerp(1.64,.9,k); PLAYER.pitch=lerp(PLAYER.pitch,.6,k*.1); },1.4);
  SFX.yawn(); playMusic(null,3);
  await tweenVal(k=>{ FX.blackout=k*.6; FX.dof=k; FX.dofFocus=.5; },2.5);
  await wait(1.6);
  await tweenVal(k=>{ FX.blackout=.6+k*.4; },1.5);
  FX.dof=0;
  startFromCheckpointInner(F.day===2?'B6':'B5');
}

