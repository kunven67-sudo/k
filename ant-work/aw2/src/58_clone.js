/* ================================================================
   THE OTHER YOU — both normal endings end in the Dome Sweet Dome on
   Mars. The Mars Shift you (blocky, XXX5 turned Earth into blocks) and
   the Tinyverse you (a normal person) meet. Ant Work 3 starts here.
   ================================================================ */
/* "Are you... me?" — the user's own recording, made to sound like Jay (lower
   pitch, a slightly bigger voice, same timing). Both of you say it at the same
   moment: the same voice twice, one on the left and one on the right, a
   beat apart, then a soft echo in the dark. The sound is in 58b_voice.js. */
const CLONE_VOICE={buf:null,b64:'',loading:null};
function loadCloneVoice(){
  if(CLONE_VOICE.buf||CLONE_VOICE.loading||!AU.ok||!CLONE_VOICE.b64) return CLONE_VOICE.loading;
  const bin=atob(CLONE_VOICE.b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  CLONE_VOICE.loading=new Promise(res=>{ ACtx.decodeAudioData(u.buffer,b=>{ CLONE_VOICE.buf=b; res(b); },()=>res(null)); });
  return CLONE_VOICE.loading;
}
function playCloneVoice(){
  if(!AU.ok||!CLONE_VOICE.buf) return 0;
  const t0=ACtx.currentTime+.05, B=CLONE_VOICE.buf, nodes=[];
  // a soft echo that fades away, plus the big dark room
  const dl=ACtx.createDelay(2); dl.delayTime.value=.36; const fb=ACtx.createGain(); fb.gain.value=.34; const lp=ACtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1900; const hp=ACtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=160; const wet=ACtx.createGain(); wet.gain.value=.5;
  dl.connect(lp); lp.connect(hp); hp.connect(fb); fb.connect(dl); hp.connect(wet); wet.connect(voiceBus); wet.connect(revIn);
  for(const [pan,delay,cents,vol] of [[-.62,0,0,.78],[.62,.06,32,.76]]){   // two of you: clearly left + right, a beat apart, a hair different
    const s=ACtx.createBufferSource(); s.buffer=B; s.detune&&(s.detune.value=cents);
    const g=ACtx.createGain(); g.gain.value=vol; s.connect(g);
    const pn=ACtx.createStereoPanner?ACtx.createStereoPanner():null; if(pn){ pn.pan.value=pan; g.connect(pn); pn.connect(voiceBus); pn.connect(dl); } else { g.connect(voiceBus); g.connect(dl); }
    s.start(t0+delay); nodes.push(s,g,pn);
  }
  setTimeout(()=>{ for(const n of [dl,fb,lp,hp,wet,...nodes]) try{ n&&n.disconnect(); }catch(e){} },(B.duration+5)*1000);
  return B.duration+1.6;
}

/* the other you, in each look */
function otherYou(lv,blocky){
  if(blocky){ if(!lv.youBlock){ lv.youBlock=makeBlockPerson({name:'You',voice:'You',skin:0xe2b08c,shirt:0x2f4d6e,pants:0x2e3440,hair:0x2a1c12,shoes:0x2a2a2e}); lv.youBlock.userData.level=lv.name; lv.scene.add(lv.youBlock); } return lv.youBlock; }
  if(!lv.youHuman){ lv.youHuman=makeYou(); lv.youHuman.userData.level=lv.name; lv.scene.add(lv.youHuman); } return lv.youHuman;
}
on('tick',()=>{ const L=LEVELS.bighouse; if(LV===L&&L.youBlock&&L.youBlock.visible) animateBlockPerson(L.youBlock,G.dt||.016,G.time); });

/* the house door: the Dome Sweet Dome on Crater Lane */
function domeDoor(){ const M=LEVELS.mars; const h=M.houses.find(q=>q.price===100); return h.door; }
/* Mars, quiet: no bugs, nobody to talk to, only your way to the house */
function quietMars(M){
  const F=F_(); F.day=3; F.paid=true; F.cooked=true; F.boughtBig=false; F.boughtHouse=false; F.goHome=false; F.houseHunt=false; F.day3Buy=false; F.day2Convert=false; F.shiftOver=true;
  for(const b of M.bugs) M.scene.remove(b); M.bugs.length=0; F.bugsOn=false;
  if(M.steve) M.steve.visible=false; marsSellers(M,{dome:true});
  M.jim.visible=false; M.jim.userData.A.path=null; M.jim.userData.A.sleep=false; clearPose(M.jim,0);
  if(!M.cloneSetup){ M.cloneSetup=true; addInteract(M,{pos:domeDoor().clone().add(V3(0,1.1,0)),label:'Go inside',reach:2.6,aim:false,when:()=>!!F_().toClone,act:()=>runStory(()=>meetClone(F_().toClone))}); }
}
/* walk to the house yourself, then go in */
async function walkToDome(path){
  const F=F_(); F.toClone=path;
  objective('Go into the big house'); setMarker(()=>domeDoor().clone().add(V3(0,2.4,0)),'Dome Sweet Dome','m');
  PLAYER.free();
}

/* ---------- MARS SHIFT: after the cabin, straight to your house on Mars ---------- */
async function marsToClone(){
  const M=await enterLevel('mars',{pos:V3(19.5,0,16.5),yaw:Math.PI*.3});
  quietMars(M); hideSay();
  M.rocket.visible=true; M.rocket.position.set(22,marsHeight(22,12)+1.1,12); setRocketFlame(M.rocket,0);
  PLAYER.fly=false; PLAYER.swim=false; PLAYER.scale=PLAYER.targetScale=1; PLAYER.eye=1.64; PLAYER.roll=0; PLAYER.item=null; PLAYER.carry=null; vmCarry(null);
  setVM(true); setVMBlocky(true); setVMSuit(false); crosshair(true); hudVisible(true); showCash(false); showCoins(false); objective(null);
  lookAtPoint(domeDoor().clone().add(V3(0,1.6,0)),0);
  playMusic(null); setAmbience([['marsWind',.07]]);
  await tweenVal(k=>{ FX.blackout=1-k; },1.6);
  walkToDome('B');
}

/* ---------- THE MEETING ---------- */
async function meetClone(path){
  const F=F_(); if(F.cloneMet) return; F.cloneMet=true; F.toClone=null; PLAYER.lock(); objective(null); setMarker(null); hideSay(); loadCloneVoice();
  sfxAt(PLAYER.pos,()=>SFX.alienDoor(),2); await fade(1,.7);
  const H=await enterLevel('bighouse',{pos:V3(0,0,8.2),yaw:0});
  H.setNight(false); F.sleeping=true;
  // the other you: from the other story (Mars Shift you is blocky, the Tinyverse you isn't)
  const other=otherYou(H,path==='A');
  for(const o of [H.youBlock,H.youHuman]) if(o) o.visible=false;
  other.visible=true; other.position.set(0,0,3.4); other.rotation.set(0,Math.PI,0);
  const A=other.userData.A; A.look=null; A.path=null; A.mode=null; if(A.faceYaw!==undefined) A.faceYaw=Math.PI; if(other.userData.J) setMood(other,'neutral');
  playMusic(null,1.5); setAmbience([['alienHome',.015]]);
  PLAYER.eye=1.64; lookAtPoint(V3(0,1.5,0),0);
  sfxAt(V3(0,1,9),()=>SFX.alienDoor(),2);
  await fade(0,1);
  // walk in yourself; they're looking out the big window
  PLAYER.free();
  const t0=G.time; await waitUntil(()=>Math.hypot(PLAYER.pos.x-other.position.x,PLAYER.pos.z-other.position.z)<3||G.time-t0>7);   // (their pick: this one goes on by itself again)
  PLAYER.lock(); PLAYER.vel.set(0,0,0);
  // if you just stood at the door, you take a few slow steps in
  { const d=Math.hypot(PLAYER.pos.x-other.position.x,PLAYER.pos.z-other.position.z); if(d>2.3){ const p0=PLAYER.pos.clone(), to=other.position.clone().add(p0.clone().sub(other.position).setY(0).normalize().multiplyScalar(2.1)); lookAtPoint(other.position.clone().add(V3(0,1.5,0)),.8); await tweenVal(k=>{ PLAYER.pos.x=lerp(p0.x,to.x,k); PLAYER.pos.z=lerp(p0.z,to.z,k); },Math.min(3,(d-2.1)*.75),x=>x); } }
  const head=()=>other.position.clone().add(V3(0,1.58,0));
  lookAtPoint(head(),.8);
  // they hear you and turn around
  SFX.heartbeat(.6); await wait(.5);
  const r0=other.rotation.y, r1=Math.atan2(PLAYER.pos.x-other.position.x,PLAYER.pos.z-other.position.z);
  await tweenVal(k=>{ const y=angLerp(r0,r1,smooth(k)); other.rotation.y=y; if(A.faceYaw!==undefined) A.faceYaw=y; },1.3);
  A.look='player'; SFX.heartbeat(.8);
  lookAtPoint(head(),.6); await tweenVal(k=>{ PLAYER.fovKick=-14*smooth(k); },2.4);
  // black. "Are you... me?"
  FX.blackout=1; PLAYER.fovKick=0; hudVisible(false); setAmbience([]);
  await wait(.9);
  await Promise.race([loadCloneVoice()||Promise.resolve(),wait(2)]);
  const v=playCloneVoice(); await wait(v||2.2);
  await wait(.8);
  other.visible=false; hudVisible(true);
  if(path==='B'){ unlock('marsEnd'); showTBC('MARS SHIFT','A1'); }
  else showTBC('THE TINYVERSE','B1');
}

/* ---------- THE TINYVERSE: say bye to Larry, grow back, Jim flies you to Mars ---------- */
async function tinyGoHome(){
  const T=LEVELS.mitetown, F=F_();
  // 1) say bye to Larry (no words)
  T.larry.visible=true; T.larry.userData.wave=false;
  if(!T.byeSetup){ T.byeSetup=true; addInteract(T,{obj:T.larry,offset:V3(0,14,0),label:'Wave bye to Larry',reach:60,d3:true,aim:false,when:()=>!!F_().byeLarry,act:()=>runStory(waveLarry)}); }
  F.byeLarry=true; objective('Say bye to Larry'); setMarker(()=>T.larry.position.clone().add(V3(0,18,0)),'Larry');
  playMusic('larry',1.5); PLAYER.free();
}
async function waveLarry(){
  const T=LEVELS.mitetown, F=F_(), L=T.larry; if(!F.byeLarry) return; F.byeLarry=false; PLAYER.lock(); objective(null); setMarker(null);
  // float back a little so you can see all of him
  { const away=PLAYER.pos.clone().sub(L.position); if(away.length()<1) away.set(0,0,1); away.normalize(); const p0=PLAYER.pos.clone(), p1=L.position.clone().addScaledVector(away,62).add(V3(0,8,0));
    await tweenVal(k=>{ PLAYER.pos.lerpVectors(p0,p1,smooth(k)); lookAtPoint(L.position.clone().add(V3(0,10,0)),0); },1.2); }
  // Larry turns round to face you before he waves
  { const d=PLAYER.pos.clone().sub(L.position); const y0=L.rotation.y, y1=Math.atan2(d.x,d.z); await tweenVal(k=>{ L.rotation.y=y0+angDiff(y0,y1)*smooth(k); },.7); }
  VM.forceShow=true; VM.waveT=2.6; await wait(.5);
  L.userData.wave=true; await wait(2.8); L.userData.wave=false; VM.forceShow=false;
  await wait(1.2);
  // 2) up in the lab, Jim fixes the shrink ray with the shard
  await fade(1,.6); playMusic(null,1);
  $('visor').classList.remove('show');
  const Lb=await enterLevel('lab',{pos:V3(0,0,-1.8),yaw:Math.PI});
  const jim=Lb.jim; jim.visible=true; jim.userData.A.path=null; jim.position.set(1.4,0,-1.2); jim.rotation.y=-1.2; jim.userData.A.look=null; setMood(jim,'happy'); setPose(jim,'type',0);
  const sh=labShard(Lb); sh.visible=true; Lb.charge=0; Lb.beam.material.opacity=0;
  letterbox(true); camFollow(t=>({pos:V3(Math.sin(.4+t*.25)*3.2,1.75,-1.8+Math.cos(.4+t*.25)*3.2),look:V3(0,1.5,-1.8)}),44);
  await fade(0,.6);
  for(let i=0;i<10;i++){ sh.rotation.y+=.6; await wait(.24); }
  clearPose(jim); setPose(jim,'press'); SFX.rayCharge(2.4); SFX.bigButton&&SFX.bigButton();
  await tweenVal(k=>{ Lb.charge=k*.8; Lb.beam.material.opacity=k*.22; sh.rotation.y+=.2; },2.4);
  clearPose(jim);
  await fade(1,.5); letterbox(false); camRelease(0);
  // 3) back down in Mite Town: the ray's light comes down. Swim into it.
  await enterLevel('mitetown',{pos:PLAYER_TINY_POS.clone()});
  PLAYER.pos.copy(PLAYER_TINY_POS); PLAYER.fly=true; $('visor').classList.add('show');
  const spot=PLAYER.pos.clone().add(V3(30,0,-55)); spot.y=0;
  if(!T.homeBeam){ const g=new THREE.CylinderGeometry(9,9,800,40,1,true); T.homeBeam=mesh(g,new THREE.MeshBasicMaterial({color:col(0x7dffff),transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}),0,0,0,false); T.scene.add(T.homeBeam); }
  T.homeBeam.visible=true; T.homeBeam.position.set(spot.x,PLAYER.pos.y,spot.z);
  lookAtPoint(spot.clone().setY(PLAYER.pos.y),0); SFX.beam();
  await fade(0,.6);
  objective('Swim into the light'); setMarker(()=>T.homeBeam.position,'The light');
  PLAYER.free();
  await waitUntil(()=>Math.hypot(PLAYER.pos.x-T.homeBeam.position.x,PLAYER.pos.z-T.homeBeam.position.z)<8.5);
  PLAYER.lock(); objective(null); setMarker(null);
  SFX.rayFire&&SFX.rayFire(); lookAtPoint(PLAYER.pos.clone().add(V3(0,60,-5)),1.2);
  await tweenVal(k=>{ FX.whiteout=k*k; },1.4);
  T.homeBeam.visible=false;
  await growBackInLab();
}
const PLAYER_TINY_POS=V3(0,30,150);
function labShard(Lb){ if(!Lb.teaseShard){ const m=new THREE.MeshPhysicalMaterial({color:col(0xc86aff),roughness:.05,clearcoat:1,emissive:col(0x9a3aff),emissiveIntensity:2.2,transparent:true,opacity:.9}); Lb.teaseShard=mesh(new THREE.OctahedronGeometry(.12,0),m,0,1.6,-1.8,false); Lb.teaseShard.scale.set(.7,2.2,.7); Lb.scene.add(Lb.teaseShard); } return Lb.teaseShard; }
/* 4) you grow back, big, on the shrink-ray platform */
async function growBackInLab(){
  const Lb=await enterLevel('lab',{pos:V3(0,0,-1.8),yaw:Math.PI});
  const jim=Lb.jim; jim.visible=true; jim.userData.A.path=null; jim.position.set(-1.4,0,.2); jim.rotation.y=Math.PI*.8; jim.userData.A.look='player'; setMood(jim,'happy'); clearPose(jim,0);
  labShard(Lb).visible=true; Lb.beam.material.opacity=.5; Lb.charge=.8;
  $('visor').classList.remove('show');
  PLAYER.fly=false; PLAYER.swim=false; PLAYER.item=null; PLAYER.carry=null; vmCarry(null); setVMBlocky(false); setVMSuit(true); setVM(true);
  PLAYER.pos.set(0,0,-1.8); PLAYER.y=.24; PLAYER.eye=1.64; PLAYER.roll=0; PLAYER.scale=PLAYER.targetScale=.006; lookAtPoint(V3(0,5,-1.8),0);   // eye height back to normal (it stayed 0 from swimming = you looked tiny after growing)
  SFX.grow(); SFX.shrinkWarp&&SFX.shrinkWarp(); FX.glitch=.3;
  await tweenVal(k=>{ FX.whiteout=1-k; PLAYER.targetScale=PLAYER.scale=lerp(.006,1,easeOut(k)); PLAYER.fovKick=(1-k)*25; },3,x=>x);
  FX.glitch=0; PLAYER.fovKick=0; shake(.4);
  await tweenVal(k=>{ Lb.charge=.8*(1-k); Lb.beam.material.opacity=.5*(1-k); },1);
  lookAtPoint(jim.position.clone().add(V3(0,1.6,0)),1); await wait(1.4);
  // you take the suit off
  await fade(1,.4); SFX.suitOn&&SFX.suitOn(); setVMSuit(false); await wait(.8); await fade(0,.5);
  // 5) up the ladder, Jim goes first
  folkWalkHuman(jim,[V3(-5.4,0,3.2),Lb.ladderBottom.clone()]).then(()=>{ jim.visible=false; });
  objective("Go up the ladder"); setMarker(()=>Lb.ladderBottom.clone().add(V3(0,1.6,0)),'Ladder','m');
  if(!Lb.upSetup){ Lb.upSetup=true; addInteract(Lb,{pos:Lb.ladderBottom.clone().add(V3(0,1,0)),label:'Climb up the ladder',reach:2,aim:false,when:()=>!!F_().climbUp,act:()=>runStory(climbUpToStand)}); }
  F_().climbUp=true; PLAYER.free();
}
function folkWalkHuman(h,pts){ return walkTo(h,pts,1.3); }
async function climbUpToStand(){
  const F=F_(); if(!F.climbUp) return; F.climbUp=false; PLAYER.lock(); objective(null); setMarker(null);
  lookAtPoint(PLAYER.pos.clone().add(V3(0,5,-1)),.5);
  for(let i=0;i<5;i++){ SFX.ladder(); PLAYER.y+=.4; await wait(.3); }
  await fade(1,.4);
  // 6) outside: Jim's rocket next to his stand
  const S=await enterLevel('stand',{pos:S_LADDER.clone(),yaw:Math.PI});
  S.hatch.target=1; S.hatch.open=1; S.hatchPassable=true; S.hatchLight.intensity=2.5;
  if(!S.rocket2){ S.rocket2=makeRocket(); S.scene.add(S.rocket2); colCircle(S.col,ROCKET_STAND.x,ROCKET_STAND.z,1.7); addInteract(S,{obj:S.rocket2,offset:V3(0,1.4,1.4),label:"Get in Jim's rocket",reach:3.6,aim:false,when:()=>!!F_().getInRocket,act:()=>runStory(flyToMars)}); }
  S.rocket2.visible=true; S.rocket2.position.set(ROCKET_STAND.x,1.1,ROCKET_STAND.z); setRocketFlame(S.rocket2,0);
  const jim=S.jim; jim.visible=true; jim.userData.A.path=null; jim.position.set(ROCKET_STAND.x-1.6,0,ROCKET_STAND.z+1.8); jim.userData.A.look='player'; setMood(jim,'happy'); clearPose(jim,0);
  PLAYER.pos.copy(S.ladderTop); PLAYER.y=-1.6; PLAYER.eye=1.64; PLAYER.yaw=Math.PI;
  playMusic('jim',1.5); await fade(0,.6);
  for(let i=0;i<4;i++){ SFX.ladder(); PLAYER.y=Math.min(0,PLAYER.y+.4); await wait(.3); } PLAYER.y=0;
  lookAtPoint(S.rocket2.position.clone().add(V3(0,2,0)),1); await wait(1);
  F.getInRocket=true; objective("Get in Jim's rocket"); setMarker(()=>S.rocket2.position.clone().add(V3(0,3.2,0)),"Jim's rocket",'m');
  PLAYER.free();
}
const S_LADDER=V3(0,0,-5.2), ROCKET_STAND=V3(13,0,-14);
/* 7) Jim flies you to Mars */
async function flyToMars(){
  const F=F_(); if(!F.getInRocket) return; F.getInRocket=false; PLAYER.lock(); objective(null); setMarker(null);
  const S=LEVELS.stand, R=S.rocket2;
  await fade(1,.4); S.jim.visible=false;
  letterbox(true); camShot(V3(ROCKET_STAND.x-9,2.2,ROCKET_STAND.z+10),R.position.clone().add(V3(0,3,0)),{dur:0,fov:48});
  await fade(0,.4);
  SFX.ignite&&SFX.ignite(); setRocketFlame(R,1); setAmbience([['rocket',.5]]); shake(.4); playMusic('fly',1);
  await wait(1);
  await tweenVal(k=>{ R.position.y=1.1+k*k*90; },3.2,x=>x);
  await tweenVal(k=>{ FX.whiteout=k; },.6);
  const Sp=await enterLevel('space',{pos:V3(0,0,0)},{keepMusic:true});
  Sp.rx=0; Sp.speed=60; camFollow(t=>({pos:V3(Sp.rx-20+t*2,7,30),look:V3(Sp.rx,0,0)}),44);
  await tweenVal(k=>{ FX.whiteout=1-k; },.7);
  await wait(3.6);
  camFollow(t=>({pos:V3(Sp.rx-16,3,-9),look:V3(Sp.rx+60,0,0)}),55); invalidateMotion();
  await tweenVal(k=>{ Sp.speed=lerp(60,1300,easeIn(k)); },3);
  await tweenVal(k=>{ FX.whiteout=k; },.6);
  // land on Mars, right by Crater Lane
  const M=await enterLevel('mars',{pos:V3(19.5,0,16.5),yaw:Math.PI*.3},{keepMusic:true});
  quietMars(M);
  const land=V3(22,marsHeight(22,12)+1.1,12), MR=M.rocket; MR.visible=true; MR.position.set(land.x,land.y+60,land.z); setRocketFlame(MR,1);
  camShot(V3(8,3,-4),land.clone().add(V3(0,6,0)),{dur:0,fov:50});
  await tweenVal(k=>{ FX.whiteout=1-k; },.6);
  await tweenVal(k=>{ MR.position.y=land.y+60*(1-easeOut(k)); setRocketFlame(MR,1-k*.6); },3.4);
  setRocketFlame(MR,0); SFX.moonThud&&SFX.moonThud(); shake(.3); ambVol('rocket',0);
  for(let i=0;i<4;i++) M.soft.burst(V3(land.x,land.y-.8,land.z),{color:0xd8a070,count:25,speed:7,size:1.4,life:2.6,grav:.2,up:.1,grow:3,drag:1.3,alpha:.45});
  await wait(1.4);
  await fade(1,.4); camRelease(0); letterbox(false);
  // Jim (this story's Jim) stays by his rocket
  const jim=M.jim; jim.visible=true; jim.userData.A.path=null; jim.position.set(19.6,marsHeight(19.6,14.2),14.2); jim.rotation.y=-.6; jim.userData.A.look='player'; setMood(jim,'happy'); clearPose(jim,0);
  PLAYER.pos.set(18.6,0,16.6); PLAYER.eye=1.64; lookAtPoint(domeDoor().clone().add(V3(0,1.6,0)),0);
  playMusic(null,1.5); setAmbience([['marsWind',.07]]);
  await fade(0,.6);
  walkToDome('A');
}

