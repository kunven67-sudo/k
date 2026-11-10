/* ================================================================
   SECRET ENDINGS (no hints!) and the COMING SOON teasers.
   ================================================================ */
const SECRET_ENDINGS=['secretSteve','secretJeff','secretLarry'];

/* ---------- Mars Shift secret: knock on Steve's door too many times ---------- */
async function steveWins(){
  const lv=LEVELS.ship, F=F_(), st=lv.steve; if(F.caught) return; F.caught=true; PLAYER.lock(); objective(null);
  lv.sideDoor.target=1; sfxAt(V3(1.3,1.2,-7.5),()=>SFX.hydraulic(),2); await wait(.5);
  st.visible=true; st.userData.A.path=null; st.position.set(2.1,0,-7.5); st.rotation.y=-Math.PI/2; st.userData.A.look='player'; setMood(st,'evil'); clearPose(st,0);
  lookAtPoint(V3(2.1,1.62,-7.5),.3); SFX.heartbeat(1.4); shake(.3);
  await talk([{h:st,who:'Steve',text:"Got you.",mood:'evil'}]);
  SFX.whoosh(1); await tweenVal(k=>{ FX.blackout=k; },.25); SFX.clank(); await wait(.8);
  say("Steve got the watch.",3.2); await wait(3.2);
  // and then he uses it
  const sp=await enterLevel('space',{pos:V3(0,0,40)}); sp.rocket.visible=false; playMusic('xxx5',.5);
  const E=sp.earth; const s0=E.scale.x; letterbox(true);
  camShot(E.position.clone().add(V3(260,120,520)),E.position,{dur:0,fov:40});
  await tweenVal(k=>{ FX.blackout=1-k; },1);
  say("He shrinks the Earth.",3.6); await wait(1.4);
  SFX.shrink(); flashWhite(.6,.8);
  await tweenVal(k=>{ E.scale.setScalar(s0*(1-k*.995)); },2.6);
  SFX.sparkle&&SFX.sparkle(); await wait(1.6);
  await tweenVal(k=>{ FX.blackout=k; },1.2); letterbox(false); camRelease(0); E.scale.setScalar(s0); sp.rocket.visible=true;
  unlock('secretSteve'); showTBC('MARS SHIFT','A1',{secret:'steve'});
}
/* ---------- Mars Shift secret: free Jeff in time (you have to be REALLY fast) ---------- */
async function savedJeff(){
  const lv=LEVELS.insidex, F=F_(), jeff=lv.jeff; F.jeffStuck=false; F.boomed=true; spamHUD(false); PLAYER.lock(); objective(null);
  jeff.userData.stuck=false; jeff.userData.happy=true; SFX.gooSuck(); SFX.bark(); shake(.2);
  // you yank him out of the goo... and run
  const jy=jeff.position.y; await tweenVal(k=>{ jeff.position.y=lerp(jy,.05,k); VM.pull=1-k; },.35);
  VM.reach=0; VM.forceShow=false; jeff.position.y=0; PLAYER.eye=1.64; jeff.rotation.y=0; lookAtPoint(V3(0,1.4,12),.4);
  const j0=jeff.position.clone(), p0=PLAYER.pos.clone();
  await tweenVal(k=>{ jeff.position.lerpVectors(j0,V3(.4,0,10.4),k); PLAYER.pos.x=lerp(p0.x,0,k); PLAYER.pos.z=lerp(p0.z,9.4,k); lookAtPoint(V3(jeff.position.x,.6,jeff.position.z+3),0); },2.4,x=>x);
  countHUD(null); SFX.shipBoom(); SFX.boom(); flashWhite(1,2); shake(1.2); FX.whiteout=1; await wait(1.4);
  const E=await enterLevel('blockearth',{pos:V3(4,0,-1),yaw:Math.PI*.5});
  E.xBig.visible=false; E.rocket.visible=true; E.jim.visible=false; for(const f of E.folk) f.visible=false; E.bob.visible=true; E.bob.position.set(1.6,0,-3); E.bob.rotation.set(0,.6,0); E.bob.userData.A.mode=null;
  if(!E.jeff){ E.jeff=makeDog(); E.scene.add(E.jeff); } const J=E.jeff; J.visible=true; J.position.set(5,0,-2.2); J.rotation.y=Math.PI; J.userData.happy=true; J.userData.stuck=false;
  PLAYER.lock(); setVM(true); PLAYER.eye=1.64; lookAtPoint(V3(5,.4,-2.2),0); playMusic('pluto',2);
  for(let i=0;i<8;i++) E.glow.burst(V3(6+rand(-20,20),rand(30,60),-60+rand(-20,20)),{color:pick([0xc86aff,0xffa040]),count:30,speed:10,size:1.4,life:2,grav:4});
  await tweenVal(k=>{ FX.whiteout=1-k; },1.6);
  SFX.bark(); await wait(.6); SFX.bark();
  say('You made it out. Both of you.',3.6); await wait(3.6);
  await talk([{who:'You',text:"Good boy, Jeff."},{h:J,who:'Jeff',text:"Bark!"}]);
  await wait(.8); await tweenVal(k=>{ FX.blackout=k; },1.6);
  unlock('secretJeff'); showTBC('MARS SHIFT','A1',{secret:'jeff'});
}
/* ---------- Tinyverse secret: the second tiny piece of crystal ---------- */
async function bigLarryEnding(){
  const F=F_(); PLAYER.lock(); objective(null);
  await talk([{who:'Jim',radio:true,text:"Wait... you found TWO pieces? That's enough crystal for two!"},{who:'Larry',voice:'Larry',text:"Two? Who's the other one for?"}]);
  await fade(1,.8); $('visor').classList.remove('show'); vmCarry(null); PLAYER.carry=null;
  const L=await enterLevel('lab',{pos:V3(0,0,-1.8),yaw:Math.PI});
  PLAYER.fly=false; PLAYER.swim=false; setVMSuit(true); setVM(true); PLAYER.eye=.06; PLAYER.pitch=.1;
  const jim=L.jim; jim.visible=true; jim.position.set(.3,0,1.6); jim.rotation.y=Math.PI; jim.userData.A.look='player'; setMood(jim,'shock');
  if(!L.bigLarry){ L.bigLarry=makeDustMite(); L.scene.add(L.bigLarry); } const BL=L.bigLarry; BL.visible=true; BL.position.set(-1.7,0,-.6); BL.rotation.y=Math.PI*.7; BL.scale.setScalar(.01);
  lookAtPoint(V3(.3,1.4,1.6),0); playMusic('lab',1);
  FX.whiteout=1; await fade(0,.3);
  // the ray fires... and you grow
  SFX.rayFire&&SFX.rayFire(); SFX.grow(); shake(.6);
  await tweenVal(k=>{ FX.whiteout=1-k; PLAYER.eye=lerp(.06,1.64,k*k); },2.6);
  say("You're big again!",2.6); await wait(2.4);
  // ...and so is Larry
  SFX.grow(); flashWhite(.8,.9); shake(.4);
  lookAtPoint(V3(-1.7,.6,-.6),.8);
  await tweenVal(k=>{ BL.scale.setScalar(lerp(.01,.62,k)); },2.4);
  BL.userData.talking=true;
  await talk([{h:jim,who:'Jim',text:"...Uh oh.",mood:'shock'},{who:'Larry',voice:'Larry',text:"Guess I'm big now."}]);
  BL.userData.talking=false;
  await wait(.6); await tweenVal(k=>{ FX.blackout=k; },1.6);
  unlock('secretLarry'); showTBC('THE TINYVERSE','B1',{secret:'larry'});
}
on('tick',()=>{ const L=LEVELS.lab; if(LV===L&&L.bigLarry&&L.bigLarry.visible) animateDustMite(L.bigLarry,G.time,G.dt||.016); });

/* ================= COMING SOON teasers ================= */
const TEASERS={
  B:async()=>{
    // 1) a pale green hand out of purple goo... Steve survived
    const E=await enterLevel('blockearth',{pos:V3(0,0,30)}); E.setBurning(true); E.xBig.visible=false; for(const f of E.folk) f.visible=false; E.bob.visible=false; E.jim.visible=false; E.rocket.visible=false; if(E.jeff) E.jeff.visible=false;
    if(!E.teaseSteve){ E.teaseSteve=makeSteve({skin:0xc8d8c0,skinGlow:0,sss:[.3,.3,.3]}); E.teaseSteve.userData.level='blockearth'; E.scene.add(E.teaseSteve); const goo=mesh(new THREE.CircleGeometry(2.2,32),new THREE.MeshPhysicalMaterial({color:col(0x9a2aff),roughness:.05,clearcoat:1,emissive:col(0x5a0a9a),emissiveIntensity:1}),0,.03,0,false); goo.rotation.x=-Math.PI/2; E.scene.add(goo); E.teaseGoo=goo; }
    const S=E.teaseSteve; S.visible=true; S.position.set(2,-1.9,2); S.rotation.y=.3; setMood(S,'evil'); S.userData.A.look=null; E.teaseGoo.visible=true; E.teaseGoo.position.set(2,.03,2);
    letterbox(true); camShot(V3(3.4,1,5.6),V3(2,.8,2),{dur:0,fov:38}); playMusic('xxx5',.5);
    await fade(0,.6);
    await tweenVal(k=>{ S.position.y=lerp(-1.9,0,k); if(Math.random()<.3) E.glow.burst(V3(2,.2,2),{color:0xc86aff,count:4,speed:1.5,size:.06,life:.8,grav:-2}); },2.2);
    say('Steve survived.',2.6); await wait(2.2);
    // 2) Alex, at the hologram of Earth
    await fade(1,.35); E.teaseSteve.visible=false; E.teaseGoo.visible=false;
    const Sh=await enterLevel('ship',{pos:V3(0,0,-6)}); Sh.alex.visible=true; Sh.steve.visible=false; Sh.alex.userData.A.look=null; setMood(Sh.alex,'smirk');
    camShot(V3(3.2,1.5,-6.4),V3(4.8,1.4,-7.4),{dur:0,fov:40}); await fade(0,.35);
    say('Alex takes over.',2.6); await wait(2.8);
    // 3) the blocky Earth, still blocky
    await fade(1,.35);
    const E2=await enterLevel('blockearth',{pos:V3(0,0,30)}); E2.setBurning(false); E2.ship.visible=false; for(const f of E2.folk){ f.visible=true; f.userData.A.mode=null; }
    E2.jim.visible=true; E2.jim.position.set(-1.5,0,8); E2.jim.rotation.y=Math.PI; E2.bob.visible=true; E2.bob.position.set(1.5,0,8); E2.bob.rotation.y=Math.PI;
    camFollow(t=>({pos:V3(-6+t*1.2,3+t*.5,16),look:V3(0,2,-6)}),50); await fade(0,.35); playMusic('blocky',.5);
    say('Earth is still all blocks. Time to fix it.',3.2); await wait(3.4);
    // 4) a bark, somewhere far away...
    await fade(1,.35); E2.jim.visible=false; E2.bob.visible=false;
    const X=await enterLevel('insidex',{pos:V3(0,0,6)}); X.steve.visible=false; X.bob.visible=false; X.nuke.visible=false; X.jeff.visible=true; X.jeff.position.set(0,0,-8); X.jeff.rotation.y=Math.PI; X.jeff.userData.happy=false;
    camShot(V3(.4,.9,-2),V3(0,.4,-8),{dur:0,fov:36}); playMusic(null,.3); await fade(0,.5);
    await tweenVal(k=>{ X.jeff.position.z=lerp(-8,-14,k); },2.4);
    SFX.bark(); say('And Jeff...?',2.6); await wait(2.4);
  },
  A:async()=>{}   // growing back + bye Larry are in the game now: only the COMING SOON card
};
async function playTeaser(chapter,other){
  const fn=TEASERS[WORLD.path]; if(!fn){ showTBC(chapter,other,{noTeaser:true}); return; }
  const end=()=>{ $('teaserSkip').style.display='none'; $('comingSoon').style.display='none'; cardHide(); letterbox(false); camRelease(0); hideSay(); FX.whiteout=0; FX.blackout=0; showTBC(chapter,other,{noTeaser:true}); };
  $('teaserSkip').style.display=''; $('teaserSkip').onclick=()=>{ resetStory(); fade(0,.1); end(); };
  G.mode='menu'; hudVisible(false); await fade(1,.4);
  runStory(async()=>{
    await fn();
    // COMING SOON
    await fade(1,.4); playMusic(null,1); SFX.titleSlam(); $('csChap').textContent=chapter; $('comingSoon').style.display='flex'; await fade(0,.3);
    await wait(3.4); end();
  });
}

