/* ================================================================
   STORY A — "THE TINYVERSE" (continues the Ship Flight ending)
   ================================================================ */
const F_=()=>WORLD.flags;
/* ---------- photos (camera item) ---------- */
function snapshot(w=320){
  const vis=VM.grp.visible; VM.grp.visible=false;
  const ov=RENDER.override; renderScene(ov||LV.scene,camera);
  let url=''; try{ const c=document.createElement('canvas'); const s=renderer.domElement; c.width=w; c.height=Math.round(w*s.height/s.width); c.getContext('2d').drawImage(s,0,0,c.width,c.height); url=c.toDataURL('image/jpeg',.85); }catch(e){}
  VM.grp.visible=vis; return url;
}
function photoSubject(){
  if(!LV||!LV.subjects) return null;
  const f=new THREE.Vector3(); camera.getWorldDirection(f); let best=null, bs=0; const p=new THREE.Vector3();
  for(const s of LV.subjects){ if(s.hide||(s.obj&&!s.obj.visible)) continue; if(s.obj) s.obj.getWorldPosition(p); else p.copy(s.pos); const to=p.clone().sub(camera.position); const d=to.length(); if(d>300) continue; const ang=Math.acos(clamp(to.normalize().dot(f),-1,1)); const size=Math.atan2(s.r,d); if(ang>size+.3) continue; const score=size/(ang+.05); if(score>bs){ bs=score; best=s; } }
  return best;
}
let photoCd=0;
function takePhoto(auto,label){
  if(photoCd>0&&!auto) return; photoCd=.9;
  VM.raiseT=1; VM.photoT=.6; SFX.flashCharge();
  setTimeout(()=>{
    SFX.shutter(); flashWhite(.55,.35);
    const subj=label?{name:label}:photoSubject();
    const url=snapshot();
    if(url){ WORLD.photos.push(url); const pol=document.createElement('div'); pol.className='polaroid'; pol.innerHTML='<img src="'+url+'"><span>'+(funnyOn()&&Math.random()<.5?pick(['DEFINITELY A DOG','MY FAVORITE ROCK','JIM (PROBABLY)','BLURRY GHOST','NOT A BUG','A VERY SMALL CAR','LARRY?? AGAIN??']):(subj?(subj.label||subj.name).toUpperCase():'???'))+' · sent to Jim ✓</span>'; $('photos').prepend(pol); setTimeout(()=>pol.classList.add('out'),3800); setTimeout(()=>pol.remove(),4500); }
    emit('photo',subj); if(LV&&LV.name==='tiny'&&trophyStat('photos')>=25) unlock('paparazzi');
    setTimeout(()=>{ VM.raiseT=0; },250);
  },auto?0:180);
}
on('item',()=>{ if(G.mode!=='play'||!PLAYER.item) return; if(PLAYER.item==='camera' && PLAYER.ctl.interact) takePhoto(); });
on('primary',()=>{ if(G.mode!=='play') return; if(PLAYER.item==='camera' && LV && LV.name==='tiny' && PLAYER.ctl.interact) takePhoto(); });

/* ---------- small cinematic helpers ---------- */
async function headShake(){ const y0=PLAYER.yaw; SFX.headShake(); for(let i=0;i<24;i++){ const k=i/24; PLAYER.yaw=y0+Math.sin(k*Math.PI*4)*.32*(1-k); PLAYER.pitch=-.08+Math.sin(k*Math.PI*2)*.05; await wait(.035); } PLAYER.yaw=y0; }
async function tweenVal(fn,dur,ease=smooth){ const t0=G.time; while(G.time-t0<dur){ fn(ease((G.time-t0)/dur)); await wait(0); } fn(1); }
function nagOnce(key,cd,fn){ const now=G.time; F_()[key]=F_()[key]||-99; if(now-F_()[key]>cd){ F_()[key]=now; fn(); } }

/* ================= A1: HOME ================= */
CHECKPOINTS.A1=async()=>{
  const lv=await enterLevel('home',{pos:V3(.25,0,-1.85),yaw:0,pitch:-.06});
  setCheckpoint('A1');
  const F=F_();
  lv.door.target=0; lv.door.open=0; lv.blockDoor=false; lv.jim.visible=false; lv.jim.userData.A.path=null;
  PLAYER.eye=1.12; PLAYER.lock(); PLAYER.ctl.look=true; crosshair(false);
  hudVisible(true); showCash(false);
  if(!lv.interSetup){ lv.interSetup=true;
    addInteract(lv,{obj:lv.door.pivot,offset:V3(.5,1.1,0),label:'Open the door',reach:1.9,when:()=>F_().knocked&&!F_().doorOpened,act:()=>runStory(openFrontDoor)});
    addInteract(lv,{pos:V3(5.7,1,12.6),label:"Get in Jim's car",reach:2.2,when:()=>F_().jimAtCar&&!F_().driving,act:()=>runStory(driveToStand)});
    addInteract(lv,{pos:V3(7.6,1,1.1),label:'Your car',reach:2.4,when:()=>F_().follow&&!F_().driving,act:()=>bark('You',"Jim wants to take his car. Mine stays in the garage.",null,2.6)});
    addInteract(lv,{pos:V3(0,1,-5.4),label:'Watch TV',reach:2,aim:true,when:()=>F_().knocked&&!F_().doorOpened,act:()=>bark('You',"Not now. Somebody's at the door.",null,2.4)});
  }
  cardShow('FIVE YEARS LATER','Back home'); await fade(0,2.2); await wait(2.4); cardHide();
  say("Five years since the ship. Same couch. Everything is good.",4.5);
  await wait(3); SFX.sigh(); await wait(3);
  // --- the memories ---
  duckMusic(.15); SFX.tinnitus(8);
  say('',0); hideSay();
  await runFlashbacks();
  await wait(.3);
  await headShake();
  duckMusic(1);
  say("You shake your head. Not today.",3);
  await wait(3.4);
  // --- knock knock ---
  sfxAt(V3(0,1.2,3.3),()=>SFX.knock(),3);
  say('<i>*knock knock knock*</i>',2.4);
  await wait(1.2);
  lookAtPoint(V3(0,1.2,3),1.2);
  await wait(1.3);
  // get up off the couch
  await tweenVal(k=>{ PLAYER.eye=lerp(1.12,1.64,k); PLAYER.pos.z=lerp(-1.85,-2.65,k); },.9);
  F.knocked=true; PLAYER.free(); crosshair(true);
  objective('Answer the door');
  later(9,()=>{ if(!F_().doorOpened){ sfxAt(V3(0,1.2,3.3),()=>SFX.knock(),3); bark('Jim','Helloooo? Anybody home?',null,2.6); } });
};
async function openFrontDoor(){
  unlock('door');
  const lv=LEVELS.home, F=F_(), jim=lv.jim;
  F.doorOpened=true; objective(null); PLAYER.lock(); hidePrompt();
  jim.visible=true; jim.position.set(0,.16,4.35); jim.rotation.y=Math.PI; setMood(jim,'happy'); jim.userData.A.look='player';
  sfxAt(V3(0,1,3),()=>{ SFX.latch(); SFX.doorOpen(); },2); lv.door.target=1;
  setAmbience([['room',.02],['breeze',.04]]); setAmbEvents([['birds',3],['car',12],['dog',20]]);
  await wait(.4);
  PLAYER.pos.set(0,0,2.75); lookAtPoint(V3(0,1.7,4.35),.7);
  await wait(.8);
  const j=jim, S={h:j,who:'Jim'};
  await talk([
    {who:'You',text:"What's up, Jim?"},
    {...S,text:"Hey. So... about the shrinking thing.",pose:'talk'},
    {...S,text:"I need your help with my stand. You still work for me, right? Well..."},
    {...S,text:"I need you to shrink super small. Tinier than germs. So tiny that you won't even be able to see me."},
    {...S,text:"You'll be in the tinyverse. Where all the germs and creatures live.",pose:'shrug'},
    {who:'You',text:"What? I don't think I want to do that, though."},
    {...S,text:"Come on. I'll even... give you a very good paycheck. Maybe.",pose:'think',mood:'worried'},
    {...S,text:"Okay, how about 500 dollars? Is that good enough?",pose:'shrug',mood:'happy'},
    {who:'You',text:"Okay, fine. Only since you're my friend."},
    {...S,text:"Okay! Follow me.",pose:'point'}
  ]);
  clearPose(jim);
  F.follow=true; F.nagT=G.time; PLAYER.free(); objective('Follow Jim');
  jim.userData.A.look=null;
  // Jim walks to the DRIVER side of HIS car (behind it, not through it) and waits for you
  runStory(async()=>{
    await walkTo(jim,[V3(0,0,6.2),V3(1.2,0,8.4),V3(4.2,0,9.3),V3(8.8,0,9.3),V3(8.75,0,11.9)],1.35);
    faceYaw(jim,-Math.PI/2); F.jimAtCar=true; objective("Get in Jim's car");
    later(12,()=>{ if(!F_().driving) bark('Jim','Come on, get in! I\'m driving.',jim,2.6); });
  });
}
/* can't go back in the house once you're following Jim */
on('tick',()=>{
  if(!LV||LV.name!=='home') return; const F=F_(); if(!F.follow||F.driving) return;
  const p=PLAYER.pos;
  if(p.z<2.55 && p.x>-5 && p.x<5){ p.z=2.55; PLAYER.vel.z=Math.max(0,PLAYER.vel.z);
    nagOnce('nagT',2.6,()=>{ const jim=LEVELS.home.jim; facePoint(jim,p); bark('Jim','Hey, are you coming with me or not?',jim,2.4); if(trophyStat('nags')>=3) unlock('nag'); }); }
});
async function driveToStand(){
  // JIM drives HIS car (his hands on the wheel), you ride next to him
  const lv=LEVELS.home, F=F_(); F.driving=true; PLAYER.lock(); objective(null); cardHide(); hideSay();
  sfxAt(V3(7,1,12.6),()=>SFX.carDoor(),2); lv.jim.visible=false;
  await fade(1,.8);
  SFX.carDoor(); await wait(.4); SFX.engineStart();
  const D=await enterLevel('drive',{pos:V3(0,1.6,0)});
  letterbox(true); hudVisible(false);
  const Z=D.laneZ=2;
  D.driving=true; D.carX=-10; D.speed=12;
  camFollow(t=>({pos:V3(D.carX+3+t*1.2,1.0,Z-7.2),look:V3(D.carX+.8,1.0,Z)}),42);       // from the driver side: Jim driving
  fade(0,1);
  await wait(3.8);
  D.jimTalk=true; bark('Jim',"My stand's at the end of this street. You're gonna love it.",D.jim,3.6);
  camFollow(t=>({pos:V3(D.carX+4.6,1.28,Z-.05),look:V3(D.carX-.2,1.15,Z)}),38);          // through the windshield: both of you
  invalidateMotion();
  await wait(3.8);
  D.jimTalk=false;
  camFollow(t=>({pos:V3(D.carX-16+t*2,10-t*.5,Z+6),look:V3(D.carX+14,0,Z)}),50);          // up high: the street at sunset
  invalidateMotion();
  await wait(3.6);
  camFollow(t=>({pos:V3(D.carX-6-t*2.5,.55,Z+.6),look:V3(D.carX,1,Z)}),40);               // low behind the car
  invalidateMotion();
  await wait(2.6);
  await fade(1,.8);
  letterbox(false); hudVisible(true); camRelease(0);
  startFromCheckpointInner('A2');
}
/* jump to a checkpoint mid-story without the title-screen reset */
function startFromCheckpointInner(cp){ resetStory(); closeDialogNow(); hideSay(); objective(null); WORLD.cp=cp; writeSave({cp}); runStory(()=>CHECKPOINTS[cp]()); }

/* ================= A2: THE STAND ================= */
CHECKPOINTS.A2=async()=>{
  const lv=await enterLevel('stand',{pos:V3(-7.6,0,9.2),yaw:-.35});
  setCheckpoint('A2'); const F=F_();
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true);
  const jim=lv.jim; jim.visible=true; jim.position.set(-6.4,0,8.6); jim.rotation.y=Math.PI*.9; setMood(jim,'happy'); jim.userData.A.path=null;
  lv.hatch.target=0; lv.hatch.open=0; lv.hatchPassable=false; lv.kpScreen.draw('',''); lv.hatchLight.intensity=0;
  if(!lv.interSetup){ lv.interSetup=true;
    addInteract(lv,{obj:jim,offset:V3(0,1.6,0),label:'Talk to Jim',reach:2.4,when:()=>F_().atStand&&!F_().standTalked,act:()=>runStory(standTalk)});
    addInteract(lv,{pos:V3(0,.5,-5.7),label:'Climb down the ladder',reach:2,when:()=>F_().hatchOpen,act:()=>runStory(climbDown)});
    addInteract(lv,{pos:V3(-9,1,11.5),label:"Jim's car",reach:2.4,when:()=>F_().atStand&&!F_().hatchOpen,act:()=>bark('You',"Nope. I already said I'd help him.",null,2.4)});
    addTrigger(lv,{pos:V3(0,0,-4.6),r:4.2,once:false,when:()=>F_().standTalked&&!F_().keypadDone,fn:()=>runStory(keypadScene)});
  }
  await fade(0,1.2);
  say("A few minutes later, you pull up. The stand looks... a lot bigger than you remember.",4.6);
  runStory(async()=>{ await walkTo(jim,[V3(-3,0,6),V3(0,0,3.4)],1.4); faceYaw(jim,0); F.atStand=true; objective('Talk to Jim'); });
  await wait(1); PLAYER.free();
};
async function standTalk(){
  const lv=LEVELS.stand, jim=lv.jim, F=F_(); F.standTalked=true; PLAYER.lock(); objective(null);
  lookAtPoint(V3(jim.position.x,1.65,jim.position.z),.5); jim.userData.A.look='player';
  const S={h:jim,who:'Jim'};
  await talk([
    {who:'You',text:"Okay, Jim. Where's this shrink thing?"},
    {...S,text:"It's not a watch this time.",pose:'shrug'},
    {...S,text:"You have to get in my shrink ray. Yeah. I built a shrink ray.",pose:'talk'},
    {...S,text:"You stand on the platform, and I push the button that shrinks you.",pose:'press'},
    {...S,text:"You'll wear a suit. It has a radio in it, so I can talk to you the whole time.",pose:'talk'},
    {who:'You',text:"Whoa, slow down. Where even is this shrink ray, anyways?"},
    {...S,text:"Follow me.",pose:'point'}
  ]);
  clearPose(jim); jim.userData.A.look=null; PLAYER.free(); objective('Follow Jim behind the stand');
  await walkTo(jim,[V3(4.6,0,2),V3(4.4,0,-3.4),V3(1.9,0,-4.1)],1.3);
  facePoint(jim,lv.keypad.position);
}
async function keypadScene(){
  const lv=LEVELS.stand, jim=lv.jim, F=F_(); if(F.keypadDone) return; F.keypadDone=true;
  PLAYER.lock(); objective(null); letterbox(true);
  await waitUntil(()=>!jim.userData.A.path,6);
  jim.position.set(1.95,0,-4.05); facePoint(jim,lv.keypad.position);
  const kp=lv.keypad; const kpW=kp.localToWorld(V3(0,1.3,0));
  bark('Jim',"Nobody knows this code. Nobody.",jim,2.4);
  await camShot(V3(-1.5,2.1,-1.2),kpW.clone().add(V3(0,-.3,0)),{dur:1.2,fov:48});
  const closeP=kp.localToWorld(V3(-.05,1.42,.75));
  await camShot(closeP,kp.localToWorld(V3(0,1.3,0)),{dur:1,fov:30,dof:.8,focus:.78,range:.25});
  // Jim REALLY presses each key: his index finger goes to the key, pushes it in, comes back off it
  setPose(jim,'press',.3); const JA=jim.userData.A; JA.pointF='R';
  const kpN=V3(0,0,1).applyQuaternion(kp.getWorldQuaternion(new THREE.Quaternion())), tgt=lv.keys['5'].getWorldPosition(V3()).addScaledVector(kpN,.08);
  let aimW=0, aimT=1; const prevCustom=JA.custom; JA.custom=(R,t,dt,A)=>{ if(prevCustom) prevCustom(R,t,dt,A); aimW=damp(aimW,aimT,7,dt); aimArm(jim,'R',tgt,R,aimW); };
  await wait(.45);
  const press=async(k,onDown)=>{ const kw=k.getWorldPosition(V3()), z0=k.position.z;
    await tweenVal(u=>{ tgt.copy(kw).addScaledVector(kpN,lerp(.06,.004,u)); },.24);
    k.position.z=z0-.01; onDown(); await wait(.12); k.position.z=z0;
    await tweenVal(u=>{ tgt.copy(kw).addScaledVector(kpN,lerp(.004,.05,u)); },.16); };
  let code='';
  for(const d of ['5','6','8','4']) await press(lv.keys[d],()=>{ code+=d; sfxAt(kpW,()=>SFX.keyBeep(+d),1); lv.kpScreen.draw(code,''); });
  await wait(.25);
  await press(lv.greenBtn,()=>{ lv.greenBtn.material.emissiveIntensity=4; sfxAt(kpW,()=>{ SFX.bigButton(); SFX.keyOK(); },1); lv.kpScreen.draw(code,'ok'); });
  aimT=0; await wait(.45); JA.custom=prevCustom||null; JA.pointF=null;
  await wait(.5);
  clearPose(jim);
  // the hatch opens
  await camShot(V3(-3.2,2.6,-1.6),V3(0,.3,-5.3),{dur:0,fov:50}); FX.dof=0;
  sfxAt(V3(0,.3,-5.2),()=>{ SFX.unlockClunk(); },2); await wait(.5);
  sfxAt(V3(0,.3,-5.2),()=>SFX.hydraulic(),2); lv.hatch.target=1; shake(.15);
  lv.soft.burst(V3(0,.2,-5.2),{color:0xdde8ee,count:40,speed:1.4,size:.35,life:2,grav:.6,up:.9,grow:2,alpha:.35});
  await wait(1.2); lv.hatchLight.intensity=2.5; F.hatchOpen=true; unlock('hatch');
  say("The hatch swings open. A ladder goes down into the light.",3.2);
  await wait(1.4);
  // Jim climbs down
  await walkTo(jim,[V3(.5,0,-4.2),V3(0,0,-4.55)],1.2); faceYaw(jim,Math.PI);
  setPose(jim,'climb');
  await tweenVal(k=>{ jim.position.y=-k*3; jim.position.z=-4.55-k*.4; },2.2,easeIn);
  jim.visible=false; clearPose(jim,0); jim.position.y=0;
  lv.hatchPassable=true;
  camRelease(.8); letterbox(false);
  await wait(.8); PLAYER.free(); objective('Follow Jim down the ladder');
  bark('Jim','(from below) Come on down!',null,2.4,false);
}
async function climbDown(){
  const F=F_(); if(F.climbing) return; F.climbing=true; PLAYER.lock(); objective(null);
  lookAtPoint(V3(0,-1,-5.9),.5); await wait(.5);
  for(let i=0;i<5;i++){ SFX.ladder(); PLAYER.y-=.35; await wait(.32); }
  await fade(1,.5);
  startFromCheckpointInner('A3');
}

/* ================= A3: THE LAB ================= */
CHECKPOINTS.A3=async()=>{
  const lv=await enterLevel('lab',{pos:V3(-5.6,0,4.3),yaw:0});
  setCheckpoint('A3'); const F=F_();
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true);
  const jim=lv.jim; jim.visible=true; jim.position.set(-2.2,0,1.2); jim.rotation.y=Math.PI*.8; jim.userData.A.path=null; setMood(jim,'happy');
  lv.camProp.visible=true; lv.suit.visible=true; lv.charge=0; lv.beam.material.opacity=0; lv.suited=false;
  if(!lv.interSetup){ lv.interSetup=true;
    addInteract(lv,{obj:jim,offset:V3(0,1.6,0),label:'Talk to Jim',reach:2.6,when:()=>!F_().labTalked,act:()=>runStory(labTalk)});
    addInteract(lv,{pos:V3(0,.3,-1.8),label:'Step onto the platform',reach:1.8,when:()=>F_().labTalked&&!F_().onPlatform,act:()=>runStory(shrinkSequence)});
    addTrigger(lv,{pos:V3(-2.2,0,1.2),r:3.2,once:true,when:()=>!F_().labTalked,fn:()=>runStory(labTalk)});
  }
  PLAYER.y=2.4; await fade(0,.8);
  for(let i=0;i<6;i++){ SFX.ladder(); PLAYER.y=Math.max(0,PLAYER.y-.4); await wait(.3); } PLAYER.y=0;
  SFX.land('concrete');
  lookAtPoint(V3(-2.2,1.5,1.2),1); await wait(.6);
  bark('Jim','Over here!',jim,1.8); PLAYER.free();
  await walkTo(jim,[V3(-3.9,0,2.9)],1.3); facePoint(jim,PLAYER.pos);
  if(!F_().labTalked) runStory(labTalk);
};
async function labTalk(){
  const lv=LEVELS.lab, jim=lv.jim, F=F_(); if(F.labTalked) return; F.labTalked=true; PLAYER.lock(); objective(null);
  jim.userData.A.look='player'; lookAtPoint(V3(jim.position.x,1.65,jim.position.z),.6);
  const S={h:jim,who:'Jim'};
  await talk([
    {...S,text:"So this is my secret place. Nobody knows my code at all, or anything.",pose:'hips'},
    {...S,text:"I keep it down here so nobody wrecks my research.",pose:'talk'},
    {...S,text:"So. The reason why I want you to do this is because I'm testing an experiment.",pose:'think'},
    {...S,text:"To see if they would try to attack you. I want you to send pictures of what they would look like.",pose:'talk'},
    {...S,text:"I'm gonna give you a camera.",pose:null}
  ]);
  // Jim grabs the camera from the console and hands it over
  jim.userData.A.look=null;
  await walkTo(jim,[V3(-1.95,0,.2)],1.2); setPose(jim,'press'); await wait(.5);
  lv.camProp.visible=false; const cp=lv.camProp.clone(); cp.visible=true; holdProp(jim,cp,'R',V3(0,-.02,.05)); clearPose(jim);
  const toPlayer=PLAYER.pos.clone(); toPlayer.y=0; const dir=toPlayer.clone().sub(jim.position).normalize();
  await walkTo(jim,[PLAYER.pos.clone().sub(dir.multiplyScalar(1.4)).setY(0)],1.2); facePoint(jim,PLAYER.pos);
  setPose(jim,'holdOut'); jim.userData.A.look='player'; await wait(.7);
  cp.parent.remove(cp); clearPose(jim);
  PLAYER.item='camera'; setVM(true); SFX.pickup(); toast('Got: CAMERA','#9fe8ff');
  itemHints([IS_TOUCH?'<kbd>👊</kbd> take photo':'<kbd>Q</kbd> / right-click: take photo']);
  await wait(.4);
  await talk([
    {...S,text:"Oh! And the suit. Here, put this on. It's got the radio in it."}
  ]);
  await fade(1,.5); SFX.suitUp(); lv.suit.visible=false; await wait(1.6); SFX.helmetSeal();
  $('visor').classList.add('show'); lv.suited=true; await fade(0,.6);
  await talk([
    {...S,radio:true,text:"Testing, testing. Can you hear me in there?"},
    {who:'You',text:"Loud and clear."},
    {...S,radio:true,text:"Okay. Step onto the platform. When I press this button, you'll shrink down into that cage.",pose:'point'},
    {...S,radio:true,text:"There are things in there too small for anyone to see. Not me. Not you. Not with your eyes, anyway.",pose:'talk'}
  ]);
  clearPose(jim); jim.userData.A.look=null;
  walkTo(jim,[V3(-2.3,0,-.1)],1.2).then(()=>facePoint(jim,V3(0,0,-1.8)));
  PLAYER.free(); objective('Step onto the platform');
}
async function shrinkSequence(){
  const lv=LEVELS.lab, jim=lv.jim, F=F_(); F.onPlatform=true; PLAYER.lock(); objective(null); itemHints(null);
  // walk onto the centre of the platform, face Jim at the console
  const p0=PLAYER.pos.clone();
  await tweenVal(k=>{ PLAYER.pos.lerpVectors(p0,V3(0,0,-1.8),k); PLAYER.y=k*.24; },.8);
  lookAtPoint(V3(-2.4,1.5,-.4),.8); await wait(.9);
  await talk([{who:'Jim',h:jim,radio:true,text:"Okay! Hold still. Here goes nothing!",pose:'press'}]);
  SFX.rayCharge(3.6); SFX.bigButton(); lv.bigRed.position.y=.97;
  playMusic(null);
  await tweenVal(k=>{ lv.charge=k; lv.beam.material.opacity=k*.25; shake(.012); FX.aberr=.0015+k*.006; },3.6,easeIn);
  SFX.rayFire(); flashWhite(1,.6); shake(.6); lv.beam.material.opacity=.7;
  lookAtPoint(V3(0,6,-1.8),2.5);
  SFX.shrinkWarp(); FX.glitch=.4;
  await tweenVal(k=>{ PLAYER.targetScale=PLAYER.scale=lerp(1,.006,easeIn(k)); PLAYER.fovKick=k*25; FX.aberr=.006+k*.01; },3,x=>x);
  FX.glitch=0;
  FX.whiteout=0; await tweenVal(k=>{ FX.whiteout=k; },.6);
  startFromCheckpointInner('A4');
}

/* ================= A4: THE TINYVERSE ================= */
const TINY_LINES={
  bacteria:["Those green glowy ones are bacteria! Probably. I think.","Bacteria! Don't lick them.","Ooh, a whole colony. Nice shot."],
  paramecium:["Whoa, that one's swimming! Look at all the little hairs!","That's a paramecium. I read about those. Once.","It's got a mouth groove! Gross. Cool. Gross."],
  diatom:["That's so pretty. It's like a glass cookie.","A diatom! Those are made of glass. For real."],
  amoeba:["It's a blob! A living blob!","That amoeba is looking at you. I think. Does it have eyes?"],
  pollen:["Is that... pollen? It's huge!","Spiky ball! Don't touch the spiky ball."],
  dust:["That's just dust. You're smaller than DUST.","A dust rock. Neat."],
  crystal:["Salt crystal! I dropped my fries in there once.","That's a salt crystal. From my fries. Probably."],
  tardigrade:["Oh my gosh, a water bear! A tardigrade!","It's got eight little legs! Look at it walk!"],
  virus:["Those little spider things are viruses. Stay away from them."],
  none:["Uh, I think you just took a picture of nothing.","Nice... empty picture. Try pointing at something."]
};
CHECKPOINTS.A4=async()=>{
  const lv=await enterLevel('tiny',{pos:V3(0,0,50),yaw:0});
  setCheckpoint('A4'); const F=F_();
  PLAYER.fly=true; PLAYER.eye=0; PLAYER.scale=PLAYER.targetScale=1; PLAYER.item='camera'; setVM(true); setVMSuit(true);
  $('visor').classList.add('show'); $('scaleRead').textContent='1 : 10,000,000'; $('photoRead').textContent='PHOTOS: 0';
  PLAYER.lock(); crosshair(true); F.photos=0; lv.fleeing=0; lv.giant.visible=false; lv.giantMouth=0;
  lv.paras[0].userData.curious=true;
  FX.whiteout=1; fade(0,.4);
  await tweenVal(k=>FX.whiteout=1-k,2.2); unlock('shrunk');
  say("Down here you don't walk. You float.",4);
  await wait(2.5);
  PLAYER.free();
  itemHints([IS_TOUCH?'<kbd>⤒ ⤓</kbd> swim up / down':'<kbd>Space</kbd> / <kbd>C</kbd> swim up / down',IS_TOUCH?'<kbd>👊</kbd> take photo':'<kbd>Click</kbd> / <kbd>Q</kbd> take photo']);
  TOUCH_UI.show({act:true,down:true});
  await wait(4.5);
  await talk([{who:'Jim',radio:true,text:"Whoa... I can see everything you see! There's a camera on your suit. What is all that?",auto:1.4},{who:'You',text:"Jim... this is insane.",auto:1.2},{who:'Jim',radio:true,text:"Take pictures! Take pictures of everything!",auto:1.4}]);
  objective('Take pictures for Jim: <b>0</b>/2');
  F.photoPhase=true; F.tinyStart=G.time;
  // idle radio chatter + a curious paramecium bumping into you
  runStory(async()=>{ const lines=["Is anything trying to attack you yet? Be honest.","I can see you on the monitor! You're a tiny dot.","Don't touch anything slimy.","You're doing great. I think. Are you?"]; let i=0; while(F_().photoPhase){ await wait(rand(16,24)); if(!F_().photoPhase) return; bark('Jim',lines[i++%lines.length],null,3.2,true); } });
  runStory(async()=>{ while(F_().photoPhase){ await wait(.5); const p=lv.paras[0]; if(p.position.distanceTo(PLAYER.pos)<9 && !F_().bumped){ F_().bumped=true; shake(.35); SFX.squish(); PLAYER.vel.add(PLAYER.pos.clone().sub(p.position).normalize().multiplyScalar(6)); bark('Jim','Hey! Did that thing just bump you?! Is it attacking?! Get a picture!',null,3.4,true); } } });
  runStory(async()=>{ await waitUntil(()=>(F_().photos>=2)||(G.time-F_().tinyStart>60)); if(F_().photoPhase){ await wait(2.2); runStory(giantScene); } });
};
on('photo',subj=>{
  if(!LV||LV.name!=='tiny') return; const F=F_(); if(!F.photoPhase) return;
  F.photos=(F.photos||0)+1; $('photoRead').textContent='PHOTOS: '+F.photos;
  const k=subj?subj.name:'none'; const L=TINY_LINES[k]||TINY_LINES.none;
  if(F.photos<=2) objective('Take pictures for Jim: <b>'+Math.min(2,F.photos)+'</b>/2',true);
  setTimeout(()=>bark('Jim',pick(L),null,3.2,true),700);
});
/* hide every big thing near a path (fibers, dust rocks, diatoms...) so a huge creature never swims through them; returns what it hid */
function clearTinyPath(lv,pts,R,keep=[]){
  const out=[], B=new THREE.Box3(), skip=new Set([lv.bg,lv.bac,camera,...keep].filter(Boolean));
  const samples=[]; for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1], n=Math.max(1,Math.ceil(a.distanceTo(b)/40)); for(let k=0;k<=n;k++) samples.push(a.clone().lerp(b,k/n)); }
  for(const o of lv.scene.children){ if(skip.has(o)||!o.visible||o.isLight||o.isPoints||o.isInstancedMesh) continue; if(!(o.isMesh||o.isGroup)) continue;
    B.setFromObject(o); if(B.isEmpty()) continue; const sz=B.getSize(new THREE.Vector3()); if(Math.max(sz.x,sz.y,sz.z)<6) continue;
    if(samples.some(p=>B.distanceToPoint(p)<R)){ o.visible=false; out.push(o); } }
  return out; }
async function giantScene(){
  const lv=LEVELS.tiny, F=F_(); F.photoPhase=false; PLAYER.lock(); objective(null); itemHints(null); closeDialogNow(); setMarker(null);
  playMusic(null,2); SFX.giantRumble(10); shake(.25);
  lv.fleeing=1; setAmbEvents([]);
  bark('Jim',"Uh... hey. Why is everything swimming away?",null,3,true);
  // put the giant far ahead of wherever you're looking, down in the fog
  const f=new THREE.Vector3(); camera.getWorldDirection(f); f.y=0; f.normalize();
  const right=V3(-f.z,0,f.x);
  // the skin flake you'll hide behind sits just ahead and to the right
  const A=placeTinyLife(lv,{pos:PLAYER.pos.clone().addScaledVector(f,25).addScaledVector(right,95),f});
  const G0=PLAYER.pos.clone().addScaledVector(f,1700).add(V3(0,-320,0));
  const G1=PLAYER.pos.clone().addScaledVector(f,760).add(V3(0,-250,0));
  const giant=lv.giant; giant.visible=true; giant.position.copy(G0); giant.lookAt(PLAYER.pos.x,giant.position.y,PLAYER.pos.z);
  // nothing big may sit in its path (it used to swim THROUGH fibers + rocks): clear the whole route while the water fogs up
  const gPathEnd=PLAYER.pos.clone().addScaledVector(f,950).addScaledVector(right,1300).add(V3(0,-320,0));
  const keepT=[giant,lv.flake,lv.bfFlake,lv.demodex,lv.naeg,lv.larry,lv.larryFlake,...(lv.biofilms||[]),...(lv.snacks||[])];
  const cleared=clearTinyPath(lv,[G0,G1,PLAYER.pos.clone().addScaledVector(f,520).addScaledVector(right,-60).add(V3(0,-250,0)),gPathEnd],360,keepT);
  clearTinyPath(lv,[PLAYER.pos.clone(),A.P.clone()],40,keepT).forEach(o=>cleared.push(o));
  await tweenVal(k=>{ FX.exposure=lerp(1.1,.75,k); lv.scene.fog.density=lerp(lv.fogBase,.0022,k); },2.5);
  lookAtPoint(PLAYER.pos.clone().addScaledVector(f,100).add(V3(0,-20,0)),2);
  await wait(1.2);
  playMusic('giant',.5);
  SFX.giantCall(); shake(.4);
  // it rises out of the fog toward you
  const headOff=V3(0,1.05,1.9);
  runStory(async()=>{ await tweenVal(k=>{ giant.position.lerpVectors(G0,G1,easeOut(k)); giant.lookAt(PLAYER.pos.x,giant.position.y+60,PLAYER.pos.z); },8); });
  camFollow(()=>{ const hp=giant.localToWorld(headOff.clone()), eye=PLAYER.pos.clone().add(V3(0,PLAYER.y,0)); const d=Math.hypot(hp.x-eye.x,hp.z-eye.z); hp.y=clamp(hp.y,eye.y-d*.55,eye.y+d*.55); return {pos:eye,look:hp}; },SETTINGS.fov);   // pitch kept under ~30 deg
  await wait(3);
  await talk([{who:'Jim',radio:true,text:"Wait... what is that? What IS that?!",auto:1},{who:'Jim',radio:true,text:"It's HUGE! Take a picture! TAKE A PICTURE!",auto:.6}]);
  takePhoto(true,'Tardigrade'); shake(.2);
  say("A tardigrade. It's massive.",3);
  await wait(2);
  // a Demodex mite wriggles across in front of you... and gets eaten
  const mouth=()=>giant.localToWorld(V3(0,1.0,2.05));
  const D=lv.demodex; D.visible=true; D.scale.setScalar(6);
  const D0=PLAYER.pos.clone().addScaledVector(f,70).addScaledVector(right,-75).add(V3(0,8,0));
  D.position.copy(D0); sfxAt(D0,()=>SFX.squirm(),30);
  camFollow(()=>({pos:PLAYER.pos.clone().add(V3(0,PLAYER.y,0)),look:D.position.clone().lerp(mouth(),.12)}),SETTINGS.fov);
  await tweenVal(k=>{ const p=D0.clone().addScaledVector(right,k*85).addScaledVector(f,k*45); D.position.copy(p); D.lookAt(p.clone().add(right).addScaledVector(f,.5)); },2.8,x=>x);
  say('It eats a Demodex mite!',3.2);
  SFX.slurp(); shake(.3);
  camFollow(()=>({pos:PLAYER.pos.clone().add(V3(0,PLAYER.y,0)),look:D.visible?D.position.clone():mouth()}),SETTINGS.fov);
  const Ds=D.position.clone();
  await tweenVal(k=>{ lv.giantMouth=Math.min(1,k*1.8); const m=mouth(); D.position.lerpVectors(Ds,m,easeIn(k)); D.lookAt(m); D.scale.setScalar(6*(1-k*.4)); },2.4,x=>x);
  D.visible=false; D.scale.setScalar(6); SFX.chomp(); shake(.9);
  await tweenVal(k=>{ lv.giantMouth=1-k; },.5); SFX.gulp();
  await wait(1.2);
  // hide behind the skin flake
  say('You hide behind a skin flake.',3.4);
  const up=V3(0,1,0), hide=A.P.clone().addScaledVector(A.f,-13).addScaledVector(up,-6);
  camRelease(.7); PLAYER.autoSwim=true;
  lookAtPoint(A.P,.9);
  const from=PLAYER.pos.clone();
  await tweenVal(k=>{ PLAYER.pos.lerpVectors(from,hide,k); PLAYER.vel.set(0,0,0); },3.2);
  PLAYER.autoSwim=false; lookAtPoint(A.P.clone().addScaledVector(up,-6),.6);
  // the flake goes see-through enough that you can watch its shadow slide past on the other side
  const fm=lv.flake.userData.sheet.material, op0=fm.opacity;
  await tweenVal(k=>{ fm.opacity=lerp(op0,.5,k); },.8);
  const gF=giant.position.clone(), gM=A.P.clone().addScaledVector(A.f,520).addScaledVector(A.right,-160).add(V3(0,-250,0)), gT=A.P.clone().addScaledVector(A.f,950).addScaledVector(A.right,1300).add(V3(0,-320,0));
  playMusic(null,3); SFX.giantRumble(7);
  runStory(async()=>{ for(let i=0;i<7;i++){ SFX.heartbeat(1+i*.05); await wait(.75-i*.03); } });
  const prev=new THREE.Vector3();
  await tweenVal(k=>{ prev.copy(giant.position); const q=smooth(k);
    if(q<.5) giant.position.lerpVectors(gF,gM,q*2); else giant.position.lerpVectors(gM,gT,(q-.5)*2);
    const dir=giant.position.clone().sub(prev); if(dir.lengthSq()>1e-4) giant.lookAt(giant.position.clone().add(dir)); lv.giantMouth=.15+Math.sin(k*9)*.1; shake(.004); },7,x=>x);
  giant.visible=false; lv.giantMouth=0;
  await wait(1);
  // peek over the top
  say("You look to see if it's still there...",3.4);
  const peek=hide.clone().addScaledVector(up,58).addScaledVector(A.f,4), p0=PLAYER.pos.clone();
  PLAYER.autoSwim=true; await tweenVal(k=>{ PLAYER.pos.lerpVectors(p0,peek,k); PLAYER.vel.set(0,0,0); PLAYER.roll=Math.sin(k*Math.PI)*.08; },2.2); PLAYER.autoSwim=false;
  lookAtPoint(peek.clone().addScaledVector(A.f,300).add(V3(0,-90,0)),1.1);
  await wait(2.4);
  say("It's gone.",2.8); SFX.sigh(); later(2,()=>unlock('giant'));
  runStory(async()=>{ await tweenVal(k=>{ fm.opacity=lerp(.5,op0,k); },1.5); });
  for(const o of cleared) o.visible=true;
  lv.fleeing=0; for(const b of lv.bacData) b.flee.set(0,0,0);
  await tweenVal(k=>{ FX.exposure=lerp(.75,1.1,k); lv.scene.fog.density=lerp(.0022,lv.fogBase,k); },2);
  setAmbEvents([['microChirp',4],['whale',11]]);
  setCheckpoint('A5');
  await wait(1);
  huntBegin();
}

/* ================= A5: THE CREATURES (after the giant) ================= */
CHECKPOINTS.A5=async()=>{
  const lv=await enterLevel('tiny',{pos:V3(0,0,50),yaw:0});
  setCheckpoint('A5');
  PLAYER.fly=true; PLAYER.eye=0; PLAYER.scale=PLAYER.targetScale=1; PLAYER.item='camera'; setVM(true); setVMSuit(true);
  $('visor').classList.add('show'); $('scaleRead').textContent='1 : 10,000,000'; $('photoRead').textContent='PHOTOS: 0';
  PLAYER.lock(); crosshair(true); lv.giant.visible=false; lv.fleeing=0; lv.giantMouth=0; lv.demodex.visible=false;
  const A=placeTinyLife(lv,{pos:V3(20,0,-40),f:V3(0,0,-1)});
  PLAYER.pos.copy(A.P).addScaledVector(A.f,-16).addScaledVector(A.right,-30);
  lookAtPoint(A.P,0);
  FX.whiteout=1; fade(0,.4);
  await tweenVal(k=>FX.whiteout=1-k,1.4);
  huntBegin();
};
function huntBegin(){
  const lv=LEVELS.tiny, F=F_();
  F.hunt=true; F.huntN=0; F.huntTarget='biofilm'; F.huntDone={}; F.snacks=0;
  PLAYER.item='camera'; PLAYER.free(); playMusic('hunt',2);
  say("Bacterial biofilm colonies. They don't hurt you.",4.4);
  objective('Take a picture of the bacterial biofilm colonies');
  setMarker(()=>lv.subjects.find(s=>s.name==='biofilm').pos,'Biofilm colonies');
  itemHints([IS_TOUCH?'<kbd>⤒ ⤓</kbd> swim up / down':'<kbd>Space</kbd> / <kbd>C</kbd> swim up / down',IS_TOUCH?'<kbd>👊</kbd> take photo':'<kbd>Click</kbd> / <kbd>Q</kbd> take photo']);
  TOUCH_UI.show({act:true,down:true});
  if(!lv.huntSetup){ lv.huntSetup=true;
    addInteract(lv,{obj:lv.larry,offset:V3(0,16,0),label:'Talk to the dust mite',reach:70,d3:true,when:()=>F_().larryMet&&F_().hunt,act:()=>runStory(larryTalk)});
    for(const sn of lv.snacks) addInteract(lv,{obj:sn,label:'Catch it with the net',reach:16,d3:true,when:()=>F_().netOn&&!sn.userData.caught,act:()=>catchSnack(sn)});
  }
  lv.onUse=()=>{ if(F_().netOn&&VM.netT<=0){ VM.netT=.42; SFX.netSwing(); } };
  runStory(huntWatch);
}
async function huntWatch(){
  const lv=LEVELS.tiny;
  while(F_().hunt){ await wait(.25); const F=F_(); if(DLG.active||!PLAYER.ctl.move) continue;
    if(F.huntTarget==='naegleria' && !F.naegAttacked && lv.naeg.position.distanceTo(PLAYER.pos)<62) runStory(naegleriaAttack);
    if(F.huntTarget==='larry' && !F.larryMet && lv.larry.position.distanceTo(PLAYER.pos)<85) runStory(larryMeet); }
}
on('photo',subj=>{
  if(!LV||LV.name!=='tiny') return; const F=F_(); if(!F.hunt) return;
  F.photos=(F.photos||0)+1; $('photoRead').textContent='PHOTOS: '+F.photos;
  const n=subj&&subj.name;
  if(n&&n===F.huntTarget){
    if(n==='naegleria'&&!F.naegAttacked){ later(.5,()=>toast('Get closer to it first!','#9fe8ff')); return; }
    if(n==='larry'&&!F.larryOK){ later(.5,()=>{ if(F_().larryMet) larrySay("Get me some Paramecium snacks, then we'll talk."); else toast('Get closer!','#9fe8ff'); }); return; }
    runStory(()=>huntGot(n));
  } else if(n&&F.huntDone[n]) later(.5,()=>toast('You already have that one!','#9fe8ff'));
  else later(.5,()=>toast("That's not a new creature. Follow the marker.",'#9fe8ff'));
});
async function huntGot(n){
  const lv=LEVELS.tiny, F=F_(); if(F.huntDone[n]) return; F.huntDone[n]=true; setMarker(null);
  if(n==='biofilm'){ F.huntN=1; F.huntTarget=null; await wait(1.3);
    await talk([{who:'Jim',radio:true,text:"Good job! I just need 4 more different creatures."},{who:'You',text:"*sigh*... ok.",fx:()=>SFX.sigh()}]);
    objective('Find different creatures for Jim: <b>1</b>/5'); F.huntTarget='naegleria'; setMarker(()=>lv.naeg.position,'Creature'); }
  else if(n==='naegleria'){ F.huntN=2; F.huntTarget=null; await wait(1.1);
    await talk([{who:'You',text:"3 more to go."}]);
    objective('Find different creatures for Jim: <b>2</b>/5'); F.huntTarget='larry'; setMarker(()=>lv.larry.position.clone().add(V3(0,16,0)),'Creature'); }
  else if(n==='larry'){ F.huntN=3; F.huntTarget=null; await wait(1.2);
    objective('Find different creatures for Jim: <b>3</b>/5');
    say('There are now 2 creatures left to take a picture of.',4.6); await wait(3);
    huntNext('larry'); }
  else if(n==='rotifer'||n==='volvox'){ huntNext(n); }
}
async function naegleriaAttack(){
  const lv=LEVELS.tiny, F=F_(); if(F.naegAttacked) return; F.naegAttacked=true;
  const N=lv.naeg, U=N.userData; PLAYER.lock(); setMarker(null); itemHints(null);
  lookAtPoint(N.position,.45); sfxAt(N.position,()=>SFX.gurgle(),40); SFX.heartbeat(1.2);
  U.state='lunge'; await wait(.5);
  const from=N.position.clone(), to=PLAYER.pos.clone().add(from.clone().sub(PLAYER.pos).normalize().multiplyScalar(10));
  await tweenVal(k=>{ N.position.lerpVectors(from,to,k*k); },.8,x=>x);
  SFX.suitHit(); SFX.suitAlarm(); shake(1); dmgFlash(); $('visor').classList.add('alert'); $('suitRead').textContent='SUIT: WARNING';
  PLAYER.vel.add(PLAYER.pos.clone().sub(N.position).normalize().multiplyScalar(16));
  await wait(1.1);
  SFX.suitShield(); $('visor').classList.remove('alert'); $('visor').classList.add('shield'); $('suitRead').textContent='SUIT: PROTECTED';
  say("It tried to hurt you, but the suit protected you. Without it, you would be a goner.",5.6); later(3,()=>unlock('naeg'));
  U.state='idle'; U.home=N.position.clone().add(N.position.clone().sub(PLAYER.pos).normalize().multiplyScalar(26));
  await wait(1.8); $('visor').classList.remove('shield'); $('suitRead').textContent='SUIT: OK';
  PLAYER.free(); objective('Take a picture of the Naegleria fowleri'); setMarker(()=>N.position,'Naegleria fowleri');
  itemHints([IS_TOUCH?'<kbd>👊</kbd> take photo':'<kbd>Click</kbd> / <kbd>Q</kbd> take photo']);
}
function larrySay(text,cb){ const L=(LV&&LV.larry)||LEVELS.tiny.larry; if(!L){ if(cb) cb(); return; } L.userData.talking=true;   /* the Larry in THIS place (Mite Town has its own Larry; it crashed before) */ runStory(async()=>{ await talk([{who:'Larry',voice:'Larry',text}]); L.userData.talking=false; if(cb) cb(); }); }
async function larryMeet(){
  const lv=LEVELS.tiny, F=F_(); if(F.larryMet) return; F.larryMet=true; const L=lv.larry;
  PLAYER.lock(); setMarker(null); itemHints(null);
  lookAtPoint(L.position.clone().add(V3(0,15,0)),.9); playMusic('larry',1.5);
  say('A dust mite... that can talk!?',3.2); await wait(1.6);
  L.userData.talking=true;
  await talk([{who:'Larry',voice:'Larry',text:"Hi there! You need a picture?"},{who:'Larry',voice:'Larry',text:"Here is a net catcher.",fx:()=>giveNet()},{who:'Larry',voice:'Larry',text:"Get me 5 Paramecium snacks, then we'll talk."}]);
  L.userData.talking=false;
  F.netOn=true; F.snacks=0; for(const s of lv.snacks){ s.visible=true; s.userData.caught=false; }
  objective('Catch Paramecium snacks for Larry: <b>0</b>/3');
  itemHints([IS_TOUCH?'<kbd>USE</kbd> catch with the net':'<kbd>E</kbd> catch with the net',IS_TOUCH?'<kbd>👊</kbd> take photo':'<kbd>Click</kbd> take photo']);
  setMarker(nearestSnack,'Paramecium');
  PLAYER.free();
}
function giveNet(){ PLAYER.item='net'; SFX.pickup(); toast('Got: NET CATCHER','#6dffd8'); }
function nearestSnack(){ let best=null, bd=1e9; for(const s of LEVELS.tiny.snacks){ if(!s.visible||s.userData.caught) continue; const d=s.position.distanceTo(PLAYER.pos); if(d<bd){ bd=d; best=s; } } return best?best.position:null; }
function catchSnack(s){
  const F=F_(); if(s.userData.caught||VM.netT>0) return;
  VM.netT=.42; SFX.netSwing();
  later(.18,()=>{ if(s.userData.caught) return; s.userData.caught=true; s.visible=false; const lv=LEVELS.tiny;
    lv.glow.burst(s.position,{color:0xffe066,count:26,speed:6,size:.6,life:.6,grav:0}); sfxAt(s.position,()=>SFX.netCatch(),20);
    F.snacks=(F.snacks||0)+1; toast('Caught a Paramecium! '+F.snacks+'/3','#ffe066');
    if(F.snacks>=3){ F.netOn=false; for(const o of lv.snacks) o.visible=false; objective('Bring the snacks to Larry'); setMarker(()=>lv.larry.position.clone().add(V3(0,16,0)),'Larry'); SFX.objective(); }
    else objective('Catch Paramecium snacks for Larry: <b>'+F.snacks+'</b>/3'); });
}
async function larryTalk(){
  const lv=LEVELS.tiny, F=F_(), L=lv.larry;
  if((F.snacks||0)<3){ larrySay("Get me some Paramecium snacks, then we'll talk."); return; }
  if(F.larryOK){ larrySay("Ok, you can take your picture."); return; }
  PLAYER.lock(); setMarker(null); lookAtPoint(L.position.clone().add(V3(0,15,0)),.6);
  L.userData.talking=true;
  await talk([{who:'Larry',voice:'Larry',text:"Ok, you can take your picture.",fx:()=>{ for(let i=0;i<4;i++) later(.3+i*.35,()=>SFX.munch()); }}]);
  L.userData.talking=false;
  F.larryOK=true; PLAYER.item='camera'; PLAYER.free(); unlock('larry');
  objective('Take a picture of Larry'); setMarker(()=>L.position.clone().add(V3(0,16,0)),'Larry');
  itemHints([IS_TOUCH?'<kbd>👊</kbd> take photo':'<kbd>Click</kbd> / <kbd>Q</kbd> take photo']);
}
async function huntEnd(){
  const F=F_(); F.hunt=false; PLAYER.lock(); closeDialogNow(); setMarker(null); itemHints(null); objective(null);
  playMusic(null,2); await tweenVal(k=>{ FX.blackout=k; },1.2);
  showTBC('THE TINYVERSE','B1'); unlock('tinyEnd');
}

