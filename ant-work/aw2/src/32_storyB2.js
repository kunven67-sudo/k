/* ================================================================
   STORY B, CONTINUED — Day 2 (tired Jim, the shift, the paycheck),
   the echoing dream with Steve, and Day 3 (alarm, Steve at the door,
   alien pizza with Jim).
   ================================================================ */
VOICE_PROFILES.JimTired={g:'m',i:0,pitch:1.02,rate:.78,babble:160};
/* shared: wake up in the alien bed (eyes open from black, sit up) */
async function wakeInBed(lv,{pitch=.55,look=null}={}){
  const bed=lv.bed.position;
  PLAYER.pos.set(bed.x+.9,0,bed.z+.6); PLAYER.eye=.9; PLAYER.pitch=pitch; PLAYER.yaw=Math.atan2(PLAYER.pos.x,PLAYER.pos.z);
  if(look) lookAtPoint(look,0);
}
function fmtDay(n,sub){ cardShow('DAY '+n,sub||'Mars'); }

/* ================= B5: DAY 2 ================= */
CHECKPOINTS.B5=async()=>{
  const lv=await enterLevel('alienhouse',{pos:V3(-2,0,-.2),yaw:0});
  setCheckpoint('B5'); const F=F_(); F.day=2;
  PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=true; PLAYER.stitched=true;
  hudVisible(true); showCash(false); HUD.coins=HUD.coins||0; showCoins(true); setCoins(HUD.coins,false);
  lv.setNight(false); lv.pizza.visible=false; lv.jimH.visible=false; lv.youH.visible=false; lv.drawClock('9:30',false);
  setupHouseInteractions(lv);
  await wakeInBed(lv);
  FX.blackout=1; fade(0,.3); fmtDay(2);
  await wait(2.2); cardHide();
  SFX.yawn(); await tweenVal(k=>{ FX.blackout=1-k; },1.6);
  await tweenVal(k=>{ PLAYER.eye=lerp(.9,1.64,k); PLAYER.pitch=lerp(.55,-.05,k); },1.3);
  F.canLeave=true; F.noSleep=true;
  objective("Go to Jim's stand"); PLAYER.free(); setMarker(()=>V3(0,1.2,5.9),'Door','m');
};
async function goOutsideDay2(){
  const F=F_(); if(F.outside) return; F.outside=true; setMarker(null); F.canLeave=false; PLAYER.lock(); objective(null);
  sfxAt(PLAYER.pos,()=>SFX.alienDoor(),2); await fade(1,.7);
  const lv=await enterLevel('mars',{pos:V3(30,0,33),yaw:0});
  if(!lv.interSetup){ lv.interSetup=true; setupMarsInteractions(lv); }
  const tiny=lv.houses.find(h=>h.price===50); PLAYER.pos.set(tiny.door.x,0,tiny.door.z-2.2); PLAYER.yaw=0;
  for(const h of lv.houses) h.sold=true;
  for(const b of lv.bugs) lv.scene.remove(b); lv.bugs.length=0; F.bugsOn=true; for(let i=0;i<7;i++) spawnMarsBug(lv);
  lv.rocket.position.set(22,marsHeight(22,12)+1.1,12); setRocketFlame(lv.rocket,0);
  const jim=lv.jim; jim.visible=true; jim.userData.A.path=null; jim.position.set(0,.05,-5.75); jim.rotation.y=0; jim.userData.A.faceYaw=0; setMood(jim,'tired'); setPose(jim,'droop',0); jim.userData.A.sleep=false;
  lv.stewU.heat.value=0; for(const b of lv.potBugs) b.visible=false;
  PLAYER.eye=1.64; setVM(true); PLAYER.hasWatch=true; PLAYER.stitched=true; showCoins(true);
  playMusic('mars',1.5); await fade(0,.9);
  objective("Go to Jim's stand"); PLAYER.free(); setMarker(()=>V3(0,1.8,-5.75),"Jim's stand",'m');
  addTrigger(lv,{pos:V3(0,0,-1.5),r:3.4,once:true,when:()=>F_().day===2&&!F_().jimTalked,fn:()=>runStory(jimTired)});
}
async function jimTired(){ setMarker(null);
  const lv=LEVELS.mars, jim=lv.jim, F=F_(); if(F.jimTalked) return; F.jimTalked=true;
  PLAYER.lock(); objective(null); jim.userData.A.look='player';
  const p0=PLAYER.pos.clone(), p1=V3(0,0,-2.35); lookAtPoint(V3(jim.position.x,1.5,jim.position.z),.9);
  await tweenVal(k=>{ PLAYER.pos.lerpVectors(p0,p1,k); },.9);
  const S={h:jim,who:'Jim',voice:'JimTired',mood:'tired'};
  SFX.yawn();
  await talk([{...S,text:"Hey... bud. Time for work...",pose:'droop'},{...S,text:"An... and kill those..... alien ants and.....",pose:'droop'}]);
  // he falls asleep right there on the stand
  jim.userData.A.look=null; jim.userData.A.sleep=true; setMood(jim,'asleep'); setPose(jim,'sleepCounter',1.4);
  await tweenVal(k=>{ jim.position.z=lerp(-5.75,-5.45,k); },1.4);
  say('He falls asleep. Just like that. On the stand.',3.8);
  F.jimAsleep=true; runStory(snoreLoop);
  await wait(3.2);
  startShiftDay2();
}
/* Z z z */
const ZTEX={};
function zSprite(){ if(!ZTEX.t) ZTEX.t=canvasTex(64,64,(x)=>{ x.clearRect(0,0,64,64); x.fillStyle='#ffffff'; x.font='bold 52px Arial Black, sans-serif'; x.textAlign='center'; x.fillText('Z',32,50); }); const s=new THREE.Sprite(new THREE.SpriteMaterial({map:ZTEX.t,transparent:true,depthWrite:false,color:col(0xbfe8ff)})); s.scale.setScalar(.3); return s; }
async function snoreLoop(){
  const lv=LEVELS.mars;
  while(F_().jimAsleep){
    const jim=lv.jim; const hp=V3(jim.position.x,1.45,jim.position.z+.35);
    sfxAt(hp,()=>SFX.snore(),3);
    const z=zSprite(); z.position.copy(hp); lv.scene.add(z);
    runStory(async()=>{ const p0=z.position.clone(); await tweenVal(k=>{ z.position.set(p0.x+Math.sin(k*6)*.15,p0.y+k*1.2,p0.z); z.material.opacity=1-k; z.scale.setScalar(.2+k*.3); },2.4,x=>x); lv.scene.remove(z); });
    await wait(2.9);
  }
}
function shiftObjective2(){ const F=F_(); if(!F.shiftOn) return; objective('Work until 1:00 PM · alien ants knocked out: <b>'+(F.killed||0)+'</b>'); }
function startShiftDay2(){
  const F=F_(); F.shiftOn=true; F.shiftOver=false; F.canShrink=true; F.clock=12*60; F.killed=0; F.bitten=0; F.kos=0;
  showClock(true,fmtClock(F.clock)); shiftObjective2();
  itemHints([IS_TOUCH?'<kbd>⌚</kbd> shrink / grow':'<kbd>F</kbd> shrink / grow',IS_TOUCH?'<kbd>👊</kbd> punch':'<kbd>Click</kbd> punch','The ants are by the glowing plants']);
  TOUCH_UI.show({act:true,shrink:true});
  PLAYER.free();
}
async function wakeJim(){
  const lv=LEVELS.mars, jim=lv.jim, F=F_(); if(F.woke) return; F.woke=true;
  PLAYER.lock(); objective(null); lookAtPoint(V3(jim.position.x,1.4,jim.position.z),.5);
  await talk([{who:'You',text:"Jim, wake up!"}]);
  F.jimAsleep=false; jim.userData.A.sleep=false; SFX.gasp(); shake(.15);
  setPose(jim,'startle',.1); setMood(jim,'shock'); jim.position.z=-5.75; jim.userData.A.look='player';
  await talk([{h:jim,who:'Jim',text:"What!",mood:'shock',pose:'startle'},{h:jim,who:'Jim',voice:'JimTired',text:"Oh, I'm sorry. I'm so tired.",mood:'tired',pose:'droop'},{h:jim,who:'Jim',voice:'JimTired',text:"Here is your paycheck.",mood:'tired',pose:'holdOut'}]);
  clearPose(jim); setMood(jim,'tired'); SFX.paper();
  showPaycheck();
}
async function goHomeNight(){
  const F=F_(); if(F.home2) return; F.home2=true; PLAYER.lock(); objective(null);
  sfxAt(PLAYER.pos,()=>SFX.alienDoor(),2); await fade(1,.8);
  const lv=await enterLevel('alienhouse',{pos:V3(0,0,4.9),yaw:0});
  setupHouseInteractions(lv); lv.setNight(true); lv.pizza.visible=false; lv.drawClock('9:58',false);
  showCash(HUD.cash>0); showCoins(true); setCoins(HUD.coins,false);
  F.noSleep=false; F.sleeping=false; F.canLeave=false;
  playMusic('alienHome',1.5); await fade(0,1);
  objective('Go to sleep'); PLAYER.free();
}

/* ================= B6: THE DREAM ================= */
CHECKPOINTS.B6=async()=>{
  const lv=await enterLevel('dream',{pos:V3(0,0,9),yaw:0});
  setCheckpoint('B6'); const F=F_(); F.day=2;
  PLAYER.eye=1.64; PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=true; PLAYER.stitched=true;
  hudVisible(true); showCash(false); showCoins(false); objective(null);
  const st=lv.steve; st.visible=true; st.position.set(0,0,-27); st.rotation.y=0; st.userData.A.look=null; setMood(st,'neutral'); clearPose(st,0);
  st.traverse(o=>{ if(o.isMesh&&o.userData.dreamFade){ o.material.opacity=1; } });
  lv.spotOn=true; lv.steveLight.intensity=1.2; lv.pool.visible=true;
  setEcho(.55); setReverb(.7);
  FX.blackout=1; fade(0,.3); SFX.dreamSwell();
  await tweenVal(k=>{ FX.blackout=1-k; },2.6);
  say('You have a bad dream.',3); await wait(3.2);
  say('In the dream, everything echoes.',3.4);
  PLAYER.free();
  addTrigger(lv,{pos:V3(0,0,-27),r:4.2,once:true,fn:()=>runStory(steveDream)});
};
async function steveDream(){
  const lv=LEVELS.dream, st=lv.steve, F=F_(); if(F.metSteve) return; F.metSteve=true;
  PLAYER.lock(); lookAtPoint(V3(st.position.x,1.72,st.position.z),.8);
  st.userData.A.look='player'; setMood(st,'evil'); SFX.heartbeat(1.2);
  const S={h:st,who:'Steve'};
  await talk([{...S,text:"Hello, Jay.",mood:'evil'},{...S,text:"I have your watch. And the world will be mine.",mood:'evil'},{who:'You',text:"How did you find me?"}]);
  // he just crumbles into dust
  unlock('dream');
  SFX.disintegrate(); st.userData.A.talk=false;
  st.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.transparent=true; o.userData.dreamFade=true; } });
  const pts=['hips','spine','chest','head','shL','shR','elL','elR','thL','thR','knL','knR'].map(j=>st.userData.J[j]).filter(Boolean);
  const wp=new THREE.Vector3();
  await tweenVal(k=>{ st.traverse(o=>{ if(o.isMesh) o.material.opacity=1-k; }); lv.steveLight.intensity=1.2*(1-k); lv.spot.intensity=6*(1-k);
    for(let i=0;i<5;i++){ const j=pick(pts); j.getWorldPosition(wp); lv.soft.burst(wp.clone().add(V3(rand(-.14,.14),rand(-.12,.12),rand(-.14,.14))),{color:pick([0x6fe858,0x9aa890,0xc8d0b8]),count:4,speed:.6,size:.09,life:2.6,grav:-.4,drag:.8,alpha:.9}); lv.glow.burst(wp,{color:0x9aff8a,count:1,speed:.4,size:.05,life:1.5,grav:-.6}); } },2.8,x=>x);
  st.visible=false; lv.pool.visible=false; lv.spotOn=false; lv.spot.intensity=0;
  await wait(1.4);
  // wake up to the alarm
  setEcho(0); FX.whiteout=0;
  await tweenVal(k=>{ FX.blackout=k; },.35);
  startFromCheckpointInner('B7');
}

/* ================= B7: DAY 3 ================= */
let ALARM_TIMER=null;
CHECKPOINTS.B7=async()=>{
  setEcho(0); setReverb(.25);
  const lv=await enterLevel('alienhouse',{pos:V3(-2,0,-.2),yaw:0});
  setCheckpoint('B7'); const F=F_(); F.day=3;
  PLAYER.lock(); crosshair(true); setVM(true); PLAYER.hasWatch=true; PLAYER.stitched=true;
  hudVisible(true); showCash(false); HUD.coins=Math.max(HUD.coins||0,50); showCoins(true); setCoins(HUD.coins,false); objective(null);
  setupHouseInteractions(lv); lv.setNight(false); lv.pizza.visible=false; lv.jimH.visible=false; lv.youH.visible=false;
  await wakeInBed(lv,{pitch:.6});
  // the alarm is going off
  F.alarm=true; lv.clockLight.intensity=1.2;
  let on=false; clearInterval(ALARM_TIMER); ALARM_TIMER=setInterval(()=>{ if(!F_().alarm||!LV||LV.name!=='alienhouse'){ clearInterval(ALARM_TIMER); return; } on=!on; lv.drawClock('7:00',on); lv.clockLight.intensity=on?1.4:.2; if(on&&!G.paused) sfxAt(lv.clock.getWorldPosition(new THREE.Vector3()),()=>SFX.alarmClock(),2); },420);
  fade(0,.2); SFX.gasp(); shake(.35);
  await tweenVal(k=>{ FX.blackout=1-k; },.5);
  await wait(.6);
  lookAtPoint(lv.clock.getWorldPosition(new THREE.Vector3()).add(V3(0,.1,0)),.8);
  await wait(.9);
  objective('Turn off the alarm');
  PLAYER.ctl.look=true; PLAYER.ctl.interact=true; PLAYER.ctl.move=false;
};
async function slapAlarm(){
  const lv=LEVELS.alienhouse, F=F_(); if(!F.alarm) return;
  PLAYER.lock(); objective(null);
  VM.slapT=.5; PLAYER.watchLook=0;
  await wait(.2); F.alarm=false; clearInterval(ALARM_TIMER); SFX.slap(); shake(.1); lv.drawClock('7:00',false); lv.clockLight.intensity=0;
  await wait(.5);
  // a look at that hand: the watch, and the stitches
  PLAYER.watchLook=1; VM.forceShow=true;
  say('Your hand. The one with your watch. All stitched up.',3.6);
  await wait(3.2); PLAYER.watchLook=0; VM.forceShow=false;
  await wait(.4);
  await tweenVal(k=>{ FX.blackout=k; },.5);
  fmtDay(3); await wait(2.2); cardHide();
  await tweenVal(k=>{ FX.blackout=1-k; },.8);
  await talk([{who:'You',text:"Bad dream..."}]);
  await tweenVal(k=>{ PLAYER.eye=lerp(.9,1.64,k); PLAYER.pitch=lerp(PLAYER.pitch,-.05,k); },1.3);
  F.canLeave=true; F.noSleep=true;
  objective('Go outside'); PLAYER.free(); setMarker(()=>V3(0,1.2,5.9),'Door','m');
}
async function openDoorDay3(){
  const F=F_(); if(F.opened3) return; F.opened3=true; F.canLeave=false; PLAYER.lock(); objective(null); setMarker(null);
  sfxAt(PLAYER.pos,()=>SFX.alienDoor(),2); await fade(1,.5);
  const lv=await enterLevel('mars',{pos:V3(30,0,33),yaw:0});
  if(!lv.interSetup){ lv.interSetup=true; setupMarsInteractions(lv); }
  for(const b of lv.bugs) lv.scene.remove(b); lv.bugs.length=0; F.bugsOn=false;
  const tiny=lv.houses.find(h=>h.price===50); const door=tiny.door.clone();
  PLAYER.pos.set(door.x,0,door.z-1.4); PLAYER.yaw=0; PLAYER.pitch=-.02; PLAYER.eye=1.64;
  // Steve, standing in the lane... and Jim, sneaking up behind you
  if(!lv.steve){ lv.steve=makeSteve(); lv.steve.userData.level='mars'; lv.scene.add(lv.steve); }
  const st=lv.steve; st.visible=true; st.position.set(door.x+.3,marsHeight(door.x,door.z-6.2),door.z-6.2); st.rotation.y=Math.PI; st.userData.A.look='player'; setMood(st,'evil');
  const jim=lv.jim; jim.visible=true; jim.userData.A.path=null; jim.userData.A.sleep=false; clearPose(jim,0); setMood(jim,'happy');
  jim.position.set(door.x+1.3,marsHeight(door.x+1.3,door.z-.4),door.z-.4); jim.rotation.y=Math.PI*.8; jim.userData.A.faceYaw=null; jim.userData.A.look=null;
  playMusic(null,1); setAmbience([['marsWind',.05]]);
  await fade(0,.4);
  await wait(.5);
  // your heart races
  SFX.heartRace(11); PLAYER.fovKick=-10; shake(.15);
  await wait(2.6);
  // blink
  SFX.blink(); await tweenVal(k=>{ FX.blackout=k; },.12,x=>x);
  st.visible=false; await wait(.18);
  await tweenVal(k=>{ FX.blackout=1-k; },.22,x=>x);
  await wait(1.2);
  await talk([{who:'You',text:"I guess I'm seeing things."}]);
  await wait(.6);
  SFX.tap(); shake(.12); await wait(.5);
  lookAtPoint(V3(jim.position.x,1.62+jim.position.y,jim.position.z),.8); SFX.whoosh(.6); await wait(.9);
  jim.userData.A.look='player';
  await talk([{who:'You',text:"You scared me, Jim."},{h:jim,who:'Jim',text:"You wanna eat pizza? Or should I say... alien pizza.",pose:'talk',mood:'happy'},{h:jim,who:'Jim',text:"The pizza here is different. But good.",pose:'point',mood:'happy'}]);
  clearPose(jim);
  runStory(pizzaScene);
}
async function pizzaScene(){
  PLAYER.lock(); await fade(1,.8);
  const lv=await enterLevel('alienhouse',{pos:V3(0,0,4.9),yaw:0});
  setupHouseInteractions(lv); lv.setNight(false); setVM(false); hudVisible(false); objective(null); itemHints(null);
  lv.pizza.visible=true;
  const J=lv.jimH, Y=lv.youH;
  for(const [h,seat,face] of [[J,lv.seats[0],Math.PI/2],[Y,lv.seats[1],-Math.PI/2]]){ h.visible=true; h.position.set(seat.x,-.08,seat.z); h.rotation.y=face; h.userData.A.seated=true; h.userData.A.faceYaw=null; setPose(h,'sitEat',0); }
  setMood(J,'happy'); setMood(Y,'happy');
  if(!lv.slicesMade){ lv.slicesMade=true; for(const h of [J,Y]){ const sl=lv.sliceGeo(); sl.scale.setScalar(.8); holdProp(h,sl,'R',V3(0,-.06,.04),new THREE.Euler(0,0,Math.PI/2)); } }
  letterbox(true); playMusic('pizza',1.2);
  const T=V3(2.2,1.1,-1.2);
  camFollow((t)=>{ const a=-.3+t*.06; return {pos:V3(T.x+Math.sin(a)*2.9,1.75+Math.sin(t*.3)*.08,T.z+Math.cos(a)*2.9),look:T}; },42);
  await fade(0,.9);
  say('You guys eat pizza at an alien table.',4);
  runStory(async()=>{ for(let i=0;i<7;i++){ await wait(rand(.6,1.1)); SFX.pizzaBite(); } });
  await wait(4.2);
  // over-the-shoulder shots for the talk
  const headP=h=>{ const v=new THREE.Vector3(); (h.userData.J&&h.userData.J.head?h.userData.J.head:h).getWorldPosition(v); return v.add(V3(0,.06,0)); };
  const ots=(spk,lis)=>{ camFollow((t)=>{ const a=headP(spk), b=headP(lis); const d=b.clone().sub(a).normalize(); const side=V3(-d.z,0,d.x); return {pos:b.clone().addScaledVector(d,.62).addScaledVector(side,.36).add(V3(0,.1+Math.sin(t*.4)*.01,0)),look:a.clone().add(V3(0,-.04,0))}; },32); };
  const JS={h:J,who:'Jim',pose:'sitTalk'}, YS={h:Y,who:'You',pose:'sitTalk'};
  const onJ=()=>ots(J,Y), onY=()=>ots(Y,J);
  await talk([
    {...YS,text:"Jim, you know the alien, right?",mood:'worried',fx:onY},
    {...JS,text:"Yeah. What about it?",mood:'neutral',fx:onJ},
    {...YS,text:"Well... I had a dream he had my watch. I'm scared that he will shrink the Earth.",mood:'worried',fx:onY},
    {...JS,text:"Hahaha!",mood:'happy',fx:onJ},
    {...YS,text:"Why are you laughing?",mood:'sad',fx:onY},
    {...JS,text:"He's not going to. He doesn't even know where we are. Ok, buddy?",mood:'happy',fx:onJ},
    {...YS,text:"Ok.",mood:'neutral',fx:onY},
    {...JS,text:"And here is some money. Fifty dollars. You can probably buy a new house.",mood:'happy',pose:'sitGive',fx:onJ},
    {...YS,text:"Thank you, Jim!",mood:'happy',fx:onY}
  ]);
  SFX.paper(); await wait(.35); SFX.cash(); HUD.cash=50; showCash(true); setCash(50); toast('+$50','#9aff7a');
  setPose(J,'sitEat'); setPose(Y,'sitEat');
  camFollow((t)=>({pos:V3(T.x-.2+t*.05,1.4,T.z+1.9),look:V3(T.x,1.05,T.z)}),38);
  await wait(2.4);
  await tweenVal(k=>{ FX.blackout=k; },1.2);
  letterbox(false); camRelease(0);
  for(const h of [J,Y]){ h.visible=false; h.userData.A.seated=false; clearPose(h,0); }
  startFromCheckpointInner('B8');
}

