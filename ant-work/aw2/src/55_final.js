/* ================================================================
   MARS SHIFT PART 3 — BACK TO EARTH. The purple light, inside XXX5,
   Steve, the nuke, Jeff. The end of this part.
   ================================================================ */
defineLevel('insidex',{
  title:'inside XXX5',
  env:{fx:{exposure:1.1,saturation:1.2,contrast:1.12,bloomStrength:.6,bloomThreshold:.9,vignette:.6,temp:-.05,aoRadius:.6,grain:.05},music:'burning',reverb:.7,amb:[['tiny',.1],['spaceDrone',.04]],surface:'tile',far:120},
  async build(scene,lv){
    scene.background=col(0x0a0210); scene.fog=new THREE.FogExp2(col(0x2a0838),.04);
    lv.envMap=makeEnv({top:0x3a0a4a,horizon:0x2a0838,bottom:0x0a0210,lights:[{x:0,y:10,z:0,w:6,h:6,c:0xc86aff,k:3}]});
    makeRig(scene,{sun:.3,sunColor:0xd8a0ff,hemi:.5,sky:0x9a4ad8,ground:0x2a0a3a,dir:V3(.2,1,.3),span:14,dist:30,far:60});
    const skin=new THREE.MeshStandardMaterial({map:BLOCKTEX.purple(),roughness:.6,emissive:col(0x9a3aff),emissiveMap:BLOCKTEX.purple(),emissiveIntensity:.5});
    const B=new VoxBatch(skin); const r=RNG(71);
    // a blocky tunnel: from the core (z=-16) to the mouth (z=+10)
    for(let z=-20;z<=10;z++) for(let a=0;a<28;a++){ const ang=a/28*Math.PI*2; const rad=(z<-12?6:4.2)+Math.sin(z*.4+a)*.4; const x=Math.round(Math.cos(ang)*rad), y=Math.round(Math.sin(ang)*rad*.8+3); if(y<1) continue; if(z>8&&y>0&&y<5&&Math.abs(x)<3) continue; const sc=1+r()*.3; B.add(x,y,z,sc,sc,sc); if(y<=2) colBoxC(lv.col,x,z,sc,sc); }
    for(let x=-7;x<=7;x++) for(let z=-20;z<=10;z++) B.add(x,-.5,z);
    for(let x=-7;x<=7;x++) for(let y=0;y<8;y++) B.add(x,y,-21);
    B.build(scene,true);
    // purple goo pools (the one at -1.5,-2 is deep: Jeff gets stuck in it)
    const goo=new THREE.MeshPhysicalMaterial({color:col(0x5a1490),roughness:.08,clearcoat:1,clearcoatRoughness:.05,emissive:col(0x3a0870),emissiveIntensity:.45});
    for(const [x,z,s] of [[-2,-14,2.2],[3,-8,1.6],[-.3,-2.5,1.6],[2,4,1.2],[-3.4,-17,1.4]]){ const p=mesh(new THREE.CircleGeometry(s,32),goo,x,.02,z,false); p.rotation.x=-Math.PI/2; scene.add(p); }
    lv.trap=V3(-.3,0,-2.5); lv.trapLight=new THREE.PointLight(col(0xe0b8ff),1.3,5,2); lv.trapLight.position.set(-.3,1.8,-2.5); scene.add(lv.trapLight);
    lv.lights=[]; for(const z of [-16,-8,0,7]){ const l=new THREE.PointLight(col(0xc86aff),1.8,10,2); l.position.set(0,3.5,z); scene.add(l); lv.lights.push(l); }
    // the core, where the nuke goes
    lv.core=new THREE.Group(); lv.core.position.set(0,0,-17.5); scene.add(lv.core);
    lv.coreM=new THREE.MeshStandardMaterial({map:BLOCKTEX.purple(),emissive:col(0xff4aff),emissiveMap:BLOCKTEX.purple(),emissiveIntensity:1,roughness:.4}); const cb=box(1.4,1.4,1.4,lv.coreM,0,1.6,0,false); lv.core.add(cb); lv.coreBox=cb;
    lv.coreIn=box(.62,.62,.62,basicGlow(0xff6aff,2.2),0,1.6,0,false); lv.core.add(lv.coreIn);
    lv.core.add(pointLightAt(0xff6aff,3,8,0,1.6,1));
    lv.nuke=new THREE.Group(); lv.nuke.add(cyl(.18,.18,.6,mat(0x3a4a3a,{metalness:.6}),0,.3,0,16)); lv.nuke.add(mesh(new THREE.ConeGeometry(.18,.25,16),mat(0xd8c020),0,.72,0)); lv.nukeScr=box(.2,.1,.02,emissiveMat(0xff3a3a,2),0,.3,.18,false); lv.nuke.add(lv.nukeScr); lv.nuke.position.set(0,0,-16.2); lv.nuke.visible=false; scene.add(lv.nuke);
    lv.nuke.userData.vmScale=1.5;
    // Steve: pale and sick, his clothes soaked dark purple
    lv.steveLight=new THREE.PointLight(col(0xe8d8ff),1.1,4,2); lv.steveLight.position.set(-.6,2.3,-7.2); scene.add(lv.steveLight);
    lv.steve=makeSteve({skin:0xc4cdbc,skinGlow:0,sss:[.3,.3,.3],shirt:0x3a1452,pants:0x2a0c3c}); lv.steve.userData.level='insidex'; scene.add(lv.steve);
    lv.bob=makeBlockPerson({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0xf0f0ec,pants:0xf0f0ec,hair:0x3a2414,beard:true}); lv.bob.userData.level='insidex'; scene.add(lv.bob);
    lv.jeff=makeDog(); scene.add(lv.jeff);
    lv.mouthLight=new THREE.PointLight(col(0xffb070),2.5,14,2); lv.mouthLight.position.set(0,2.5,10); scene.add(lv.mouthLight);
    lv.col.bounds=[-6,6,-20.2,9.6]; colCircle(lv.col,0,-17.5,1.05);
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){ const lv=this; updateFolk(dt,t); if(lv.jeff.visible) animateDog(lv.jeff,dt,t);
    lv.coreBox.rotation.y=t*.6; lv.coreBox.rotation.x=t*.3; const beat=Math.pow(Math.max(0,Math.sin(t*3.4)),6); lv.coreM.emissiveIntensity=.7+beat*1.1; lv.coreBox.scale.setScalar(1+beat*.06); lv.coreIn.rotation.y=-t*.9; lv.coreIn.rotation.z=t*.5;
    lv.lights.forEach((l,i)=>l.intensity=1.6+Math.sin(t*2+i)*.4);
    if(lv.nuke.visible) lv.nukeScr.material.emissiveIntensity=Math.sin(t*12)>0?3:.5;
    // goo drips off Steve's chin and hands
    if(lv.steve.visible&&Math.random()<dt*3){ const j=pick(['head','hdL','hdR'].map(k=>lv.steve.userData.J&&lv.steve.userData.J[k]).filter(Boolean)); if(j){ const p=j.getWorldPosition(new THREE.Vector3()); lv.glow.burst(p.add(V3(rand(-.04,.04),-.08,rand(-.04,.04))),{color:0x9a2aff,count:1,speed:.05,size:.025,life:.9,grav:5}); } }
    // bubbles in Jeff's goo
    if(lv.jeff.userData.stuck&&Math.random()<dt*5) lv.glow.burst(lv.trap.clone().add(V3(rand(-.6,.6),.05,rand(-.6,.6))),{color:0xc86aff,count:1,speed:.3,size:.05,life:.5,grav:-1});
    if(Math.random()<dt*6) lv.glow.spawn(rand(-3,3),rand(4,6),rand(-18,8),0,-rand(.5,1.2),0,rand(2,3),rand(.05,.1),.7,.2,1,.8,2,0,0); }
});

/* Jeff runs to a spot, always facing the way he is running */
function dogRun(d,to,speed=4.5){ return new Promise(res=>{ const tok=STORY.token; (function step(){ if(tok!==STORY.token) return res(); const dt=G.dt||.016, dx=to.x-d.position.x, dz=to.z-d.position.z, L=Math.hypot(dx,dz), st=speed*dt;
  if(L<=st){ d.position.x=to.x; d.position.z=to.z; return res(); } d.position.x+=dx/L*st; d.position.z+=dz/L*st; d.rotation.y=angLerp(d.rotation.y,Math.atan2(dx,dz),Math.min(1,dt*12)); later(0,step); })(); }); }
/* a beam of purple light from one point to another */
function beamBetween(a,b,r0,r1){ const dir=b.clone().sub(a), L=dir.length(); const g=new THREE.CylinderGeometry(r1,r0,1,32,1,true); g.translate(0,.5,0);
  const m=mesh(g,new THREE.MeshBasicMaterial({color:col(0xc86aff),transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}),a.x,a.y,a.z,false);
  m.scale.set(1,L,1); m.quaternion.setFromUnitVectors(V3(0,1,0),dir.normalize()); return m; }

/* ================= B12: BACK TO EARTH ================= */
CHECKPOINTS.B12=async()=>{
  const E=await enterLevel('blockearth',{pos:V3(12,0,6.4),yaw:0});
  setCheckpoint('B12'); const F=F_(); F.day=3;
  PLAYER.lock(); crosshair(true); setVM(true); setVMBlocky(true); setVMSuit(true); PLAYER.hasWatch=true; PLAYER.stitched=true; PLAYER.eye=1.64;
  hudVisible(true); showCash(false); showCoins(false); objective(null);
  E.setBurning(true); E.headBeamsOff=false; E.ship.visible=false; E.xFly.visible=false; E.lifted.length=0;
  for(const f of E.folk){ f.visible=true; f.userData.lifted=false; f.userData.A.mode='panic'; f.rotation.z=0; }
  const R=E.rocket; R.visible=true; R.position.set(12,70,3); setRocketFlame(R,1);
  const jim=E.jim, bob=E.bob; jim.visible=false; bob.visible=false;
  if(!E.jeff){ E.jeff=makeDog(); scene_add(E,E.jeff); } const jeff=E.jeff; jeff.visible=false; jeff.userData.happy=false; jeff.userData.stuck=false;
  playMusic('burning',1); setAmbience([['rocket',.3],['crowd',.06]]); letterbox(true);
  // 1) the town burning, XXX5 over it; Jim's rocket comes down on the road
  camFollow(t=>({pos:V3(-1+t*.4,2.4+t*.1,27),look:V3(lerp(6,12,Math.min(1,t/4)),lerp(48,8,Math.min(1,t/4.5)),lerp(-58,3,Math.min(1,t/4.5)))}),52);
  FX.blackout=0; await fade(0,1.2);
  await wait(1.2);
  await tweenVal(k=>{ R.position.y=lerp(70,0,1-Math.pow(1-k,2)); },3.6,x=>x);
  setRocketFlame(R,0); SFX.thud(); shake(.25); setAmbience([['crowd',.06],['wind',.04]]);
  for(let i=0;i<14;i++) E.glow.burst(V3(12+rand(-2,2),.3,3+rand(-2,2)),{color:0xb8a890,count:2,speed:2.5,size:.5,life:1.4,grav:-.3});
  camShot(V3(4,1.3,9),V3(12,2.2,3),{dur:0,fov:46}); await wait(1.4);
  // 2) everyone gets out
  jim.visible=true; jim.position.set(8.2,0,5.4); jim.rotation.y=0; setMood(jim,'worried'); jim.userData.A.look=null; jim.userData.A.path=null; clearPose(jim,0);
  bob.visible=true; bob.position.set(13.8,0,5.8); bob.rotation.y=0; bob.userData.A.mode=null; bob.userData.A.path=null; bob.rotation.set(0,0,0);
  jeff.visible=true; jeff.position.set(10.4,0,8.2); jeff.rotation.y=-.6;
  PLAYER.pos.set(9.2,0,7.6); PLAYER.yaw=0; PLAYER.pitch=.18; carryNuke(true);
  camRelease(.8); letterbox(false); await wait(.8);
  lookAtPoint(V3(6,62,-56),1.6); await wait(1.8);
  // people around town get pulled up into it, one after another
  const cries=['Help!','Somebody help!','HELP!','No, no, no!','Help me!'];
  for(let i=3;i<8;i++){ const f=E.folk[i]; liftPerson(E,f,5); bark('Person',cries[i-3],null,1.4); await wait(1.3); }
  await wait(.6);
  lookAtPoint(jim.position.clone().add(V3(0,1.55,0)),.7); jim.userData.A.look='player'; jim.rotation.y=Math.atan2(PLAYER.pos.x-jim.position.x,PLAYER.pos.z-jim.position.z);
  await wait(.7);
  await talk([{h:jim,who:'Jim',text:"Dang it. Worse than I thought.",mood:'worried'},{h:jim,who:'Jim',text:"Ok. You know what to do, guys.",pose:'point'}]);
  clearPose(jim);
  // 3) XXX5 looks down at the road and shines its purple light on it
  E.headBeamsOff=true;
  E.xBig.updateMatrixWorld(true); const H=E.xBig.userData.heads[0].H, mouth=H.localToWorld(V3(0,-.15,1.6)), spot=V3(2,0,2.6); E.beamSpot=spot;
  const bm=beamBetween(spot,mouth,2.4,1.4); E.scene.add(bm); E.beamMesh=bm; SFX.beam(); shake(.15);
  lookAtPoint(V3(spot.x,3,spot.z),.8);
  objective('Walk into the purple light'); setMarker(()=>spot.clone().add(V3(0,2,0)),'The purple light','m');
  PLAYER.free();
  folkWalk(bob,[V3(4,0,3.6)],2.2);
  await waitUntil(()=>Math.hypot(PLAYER.pos.x-spot.x,PLAYER.pos.z-spot.z)<2.1);
  setMarker(null); objective(null); PLAYER.lock();
  bob.userData.A.path=null; bob.position.set(spot.x+1.1,0,spot.z+.6); bob.userData.A.mode='lifted';
  SFX.beam(); lookAtPoint(mouth,1.6);
  const p0=PLAYER.pos.clone(), b0=bob.position.clone(), up=mouth.clone().sub(spot);
  await tweenVal(k=>{ const e=k*k*.32; PLAYER.pos.x=p0.x+up.x*e; PLAYER.pos.z=p0.z+up.z*e; PLAYER.eye=1.64+up.y*e; bob.position.set(b0.x+up.x*e,up.y*e,b0.z+up.z*e); bob.rotation.y+=G.dt*.8; FX.whiteout=Math.max(0,(k-.72)/.28); },4.4,x=>x);
  E.scene.remove(bm); E.headBeamsOff=false; PLAYER.eye=1.64; bob.position.y=0; bob.userData.A.mode=null;
  startInsideX();
};
function scene_add(lv,o){ lv.scene.add(o); }
/* you carry the nuke (Jim gave it to you on Pluto) */
function carryNuke(on){ if(!on){ vmCarry(null); PLAYER.carry=null; return; }
  const n=new THREE.Group(), inner=new THREE.Group(); inner.rotation.set(0,0,Math.PI/2); inner.position.set(.12,-.1,0); n.add(inner);
  inner.add(cyl(.18,.18,.6,mat(0x3a4a3a,{metalness:.6}),0,.3,0,16)); inner.add(mesh(new THREE.ConeGeometry(.18,.25,16),mat(0xd8c020),0,.72,0)); inner.add(box(.2,.1,.02,emissiveMat(0xff3a3a,2),0,.3,.18,false));
  n.userData.vmScale=.62; vmCarry(n); PLAYER.carry='nuke'; if(VM.carryMesh){ VM.carryMesh.position.set(0,-.36,-.62); VM.carryMesh.rotation.set(.25,.35,0); } }
async function startInsideX(){
  const F=F_(); PLAYER.lock();
  const lv=await enterLevel('insidex',{pos:V3(0,0,7.4),yaw:0});
  const st=lv.steve, bob=lv.bob, jeff=lv.jeff;
  st.visible=true; st.position.set(-1.3,0,-8.4); st.rotation.y=.12; setMood(st,'sad'); clearPose(st,0); setPose(st,'droop',0); st.userData.A.look=null;
  bob.visible=true; bob.position.set(1.3,0,7.6); bob.rotation.set(0,Math.PI,0); bob.userData.A.mode=null; bob.userData.A.path=null;
  jeff.visible=false; jeff.userData.stuck=false; jeff.position.y=0; lv.nuke.visible=false; carryNuke(true);
  // you drop down out of the light
  PLAYER.eye=2.3; PLAYER.pitch=-.15;
  await tweenVal(k=>{ FX.whiteout=1-k; },1.4);
  await tweenVal(k=>{ PLAYER.eye=lerp(2.3,1.64,k*k); },.35,x=>x); SFX.thud(); shake(.2);
  await wait(.8);
  lookAtPoint(V3(-1.3,1.5,-8.4),1.4); await wait(1.6);
  // Steve
  letterbox(true);
  camShot(V3(-.75,1.6,-6.5),V3(-1.3,1.52,-8.4),{dur:0,fov:40});
  st.userData.A.look='player';
  await wait(.6); SFX.cough(3);
  say('You see Steve. He is covered in purple liquid. He looks sick. His body is pale.',4.6); await wait(4.6);
  const S={h:st,who:'Steve',mood:'sad',pose:'droop'};
  camShot(V3(.2,1.62,-6.1),V3(-1.1,1.4,-8.4),{dur:.8,fov:44});
  await talk([{who:'You',text:"Steve, what is this?"},{...S,text:"*cough* It's XXX5. It's a dangerous thing... that will destroy the universe. *cough*",fx:()=>{ SFX.cough(2); later(4.2,()=>SFX.cough(1)); }},{h:bob,who:'Bob',text:"Who is this guy?"},{who:'You',text:"It doesn't matter. What does is I got to put the nuke in here."}]);
  camRelease(.6); letterbox(false);
  st.userData.A.look='player';
  PLAYER.pos.set(0,0,-4.6); PLAYER.yaw=0; lookAtPoint(V3(0,1.2,-17.5),0);
  bob.position.set(1.6,0,-4.2); bob.rotation.y=Math.PI;
  if(!lv.setup){ lv.setup=true;
    addInteract(lv,{obj:lv.core,offset:V3(0,1,1.2),label:'Place the nuke',reach:3.2,aim:false,when:()=>!!F_().placeNuke,act:()=>runStory(placeNuke)});
    addInteract(lv,{pos:V3(),label:'Pull Jeff out!',cd:.06,reach:4,aim:false,when:()=>!!F_().jeffStuck,act:()=>{ F_().helpK=(F_().helpK||0)+.09; VM.pull=1; SFX.squirm(); shake(.04); }});
  }
  F.placeNuke=true; objective('Place the nuke'); PLAYER.free();
}
async function placeNuke(){
  const lv=LEVELS.insidex, F=F_(); if(!F.placeNuke) return; F.placeNuke=false; PLAYER.lock(); objective(null);
  carryNuke(false);
  lv.nuke.visible=true; lv.nuke.position.set(0,0,-16.25);
  letterbox(true); camShot(V3(1.25,.55,-13.9),V3(0,.45,-16.25),{dur:0,fov:42});
  SFX.clank(); await wait(.7); SFX.nukeArm(); await wait(.9);
  let n=10; countHUD(n); SFX.countBeep(false);
  say('Nuke going off in...',2);
  await wait(1.2); n--; countHUD(n); SFX.countBeep(false);
  camRelease(.4); letterbox(false);
  // Jeff?!
  const jeff=lv.jeff; jeff.visible=true; jeff.userData.happy=true; jeff.position.set(.4,0,4); jeff.rotation.y=Math.PI;
  sfxAt(V3(.4,.5,4),()=>SFX.bark(),3);
  PLAYER.yaw=0; lookAtPoint(V3(.4,.5,-6),.6);
  await dogRun(jeff,V3(.5,0,-12.6),6);
  lookAtPoint(V3(.5,.5,-12.6),.3); SFX.bark();
  await talk([{who:'You',text:"Jeff, what are you doing here? Ok, we got to get out of here!"}]);
  objective('Get out!'); PLAYER.free();
  // the countdown keeps going while you run
  runStory(async()=>{ while(n>0&&!F.boomed){ await wait(1.2); if(F.boomed) break; n--; countHUD(n); SFX.countBeep(n<=3); } });
  // Bob runs out; Jeff runs ahead of you... right into the deep goo
  const bob=lv.bob; folkWalk(bob,[V3(1.6,0,4),V3(1,0,9.8)],4.6).then(()=>{ bob.visible=false; });
  let stuck=false; F.helpK=0;
  runStory(async()=>{ await wait(.25); await dogRun(jeff,V3(.3,0,-5.6),5.2); await dogRun(jeff,lv.trap,3.2);
    stuck=true; jeff.userData.stuck=true; jeff.userData.happy=false; SFX.gooSuck(); SFX.whine();
    await tweenVal(k=>{ jeff.position.y=-.3*k; },.6); });
  await waitUntil(()=>stuck);
  objective('Help Jeff!'); setMarker(()=>lv.trap.clone().add(V3(0,.8,0)),'Jeff','m');
  await waitUntil(()=>Math.hypot(PLAYER.pos.x-lv.trap.x,PLAYER.pos.z-lv.trap.z)<2.6||PLAYER.pos.z>lv.trap.z+1.2||n<=2);
  setMarker(null);
  if(n<=2){ F.jeffStuck=false; objective(null); PLAYER.lock(); SFX.xxxRoar(); shake(1); const s0=PLAYER.pos.clone(); lookAtPoint(V3(lv.trap.x,.2,lv.trap.z),.4);
    await tweenVal(k=>{ PLAYER.pos.z=lerp(s0.z,10.6,k*k); PLAYER.pos.x=lerp(s0.x,0,k); PLAYER.eye=lerp(1.64,.9,Math.min(1,k*2)); PLAYER.roll=Math.sin(k*Math.PI)*.35; lookAtPoint(V3(jeff.position.x,.2,jeff.position.z),0); },2.2,x=>x);
    return finalFall(n); }
  // you grab him
  F.jeffStuck=true; PLAYER.ctl.move=false; PLAYER.ctl.look=false; PLAYER.ctl.interact=true; PLAYER.vel.set(0,0,0);
  const tp=lv.trap, fromDir=V3(PLAYER.pos.x-tp.x,0,PLAYER.pos.z-tp.z); if(fromDir.length()<.1) fromDir.set(0,0,1); fromDir.normalize();
  const kneelAt=tp.clone().add(fromDir.multiplyScalar(1.5)), pk=PLAYER.pos.clone();
  runStory(()=>tweenVal(k=>{ PLAYER.pos.x=lerp(pk.x,kneelAt.x,k); PLAYER.pos.z=lerp(pk.z,kneelAt.z,k); PLAYER.eye=lerp(1.64,1.1,k); },.45));
  lookAtPoint(V3(tp.x,.3,tp.z),.45); jeff.rotation.y=Math.atan2(kneelAt.x-tp.x,kneelAt.z-tp.z);
  objective(IS_TOUCH?'Spam USE to pull Jeff out!':'Spam E to pull Jeff out!');
  const it=lv.inter.find(i=>i.label==='Pull Jeff out!'); it.pos=V3(tp.x,0,tp.z);
  VM.forceShow=true;
  while(n>2){ if(F.helpK>=1){ VM.forceShow=false; return savedJeff(); }
    const dt=G.dt||.016; VM.reach=Math.min(1,(VM.reach||0)+dt*4); VM.pull=Math.max(0,(VM.pull||0)-dt*5);
    spamHUD(true,Math.min(1,F.helpK),'PULL JEFF OUT!'); F.helpK=Math.max(0,F.helpK-dt*.6);
    jeff.position.y=-.3+F.helpK*.24+(VM.pull||0)*.03; jeff.position.x=tp.x+Math.sin(G.time*18)*.025;
    if(Math.random()<dt*.8) SFX.whine(); await wait(0); }
  // XXX5 lurches... you lose your grip and slide out of its mouth
  F.jeffStuck=false; spamHUD(false); objective(null); PLAYER.lock();
  SFX.xxxRoar(); shake(1); SFX.gooSuck();
  const jy=jeff.position.y; runStory(()=>tweenVal(k=>{ jeff.position.y=lerp(jy,-.36,k); VM.reach=1-k; },.5));
  const s0=PLAYER.pos.clone(), e0=PLAYER.eye;
  await tweenVal(k=>{ PLAYER.pos.z=lerp(s0.z,10.6,k*k); PLAYER.pos.x=lerp(s0.x,0,k); PLAYER.eye=lerp(e0,.9,Math.min(1,k*2)); PLAYER.roll=Math.sin(k*Math.PI)*.35; lookAtPoint(V3(jeff.position.x,.2,jeff.position.z),0); },2.2,x=>x);
  VM.forceShow=false; VM.reach=0; VM.pull=0; spamHUD(false);
  await finalFall(n);
}
/* falling out of XXX5's mouth; it blows up above you */
async function finalFall(n){
  const F=F_();
  const E=await enterLevel('blockearth',{pos:V3(4,0,-40),yaw:Math.PI});
  E.setBurning(true); E.headBeamsOff=true; E.xBig.visible=true; for(const f of E.folk) f.visible=false; E.jim.visible=false; E.bob.visible=false; if(E.jeff) E.jeff.visible=false; E.rocket.visible=true; E.rocket.position.set(12,0,3);
  setVM(false); PLAYER.lock(); PLAYER.roll=.3; playMusic(null,.4); setAmbience([['wind',.25]]);
  E.xBig.updateMatrixWorld(true); const H=E.xBig.userData.heads[0].H, mouth=H.localToWorld(V3(0,-.15,1.6));
  PLAYER.pos.set(mouth.x-2,0,mouth.z+4); PLAYER.eye=mouth.y-4; lookAtPoint(mouth,0);
  SFX.whoosh(1.4);
  let boomed=false;
  await tweenVal(k=>{ PLAYER.eye=lerp(mouth.y-4,1.2,k*k); PLAYER.pos.z=mouth.z+4+k*10; PLAYER.roll=.3-k*.5; lookAtPoint(mouth,0);
    if(!boomed&&k>.3){ boomed=true; xxxBoom(E); countHUD(null); F.boomed=true; } },3.4,x=>x);
  SFX.thud(); shake(1); FX.blackout=1;
  await wait(1.2);
  await finalAftermath();
}
function xxxBoom(E){
  const U=E.xBig.userData, pts=U.heads.map(h=>h.H.getWorldPosition(new THREE.Vector3())); pts.push(E.xBig.getWorldPosition(new THREE.Vector3()));
  SFX.shipBoom(); SFX.boom(); flashWhite(1,2.2); shake(1.4); E.xBig.visible=false;
  for(const p of pts) for(let i=0;i<4;i++) E.glow.burst(p.clone().add(V3(rand(-8,8),rand(-8,8),rand(-8,8))),{color:pick([0xc86aff,0xff6aff,0xffa040]),count:40,speed:18,size:2,life:2.4,grav:6});
  // chunks of purple block rain down
  if(!E.chunks){ E.chunks=[]; for(let i=0;i<36;i++){ const c=box(1,1,1,U.skin,0,0,0); c.visible=false; E.scene.add(c); E.chunks.push({o:c,v:V3(),w:V3()}); } }
  for(const c of E.chunks){ const p=pick(pts); c.o.visible=true; c.o.position.copy(p).add(V3(rand(-6,6),rand(-6,6),rand(-6,6))); c.o.scale.setScalar(rand(1.2,4)); c.v.set(rand(-14,14),rand(-2,14),rand(-14,14)); c.w.set(rand(-3,3),rand(-3,3),rand(-3,3)); }
  runStory(async()=>{ const t0=G.time; while(G.time-t0<7){ const dt=G.dt||.016; for(const c of E.chunks){ if(!c.o.visible) continue; c.v.y-=18*dt; c.o.position.addScaledVector(c.v,dt); c.o.rotation.x+=c.w.x*dt; c.o.rotation.y+=c.w.y*dt; if(c.o.position.y<c.o.scale.y*.5){ c.o.position.y=c.o.scale.y*.5; c.v.set(0,0,0); c.w.set(0,0,0); } } await wait(0); } });
}
async function finalAftermath(){
  const E=LEVELS.blockearth;
  E.xBig.visible=false; E.headBeamsOff=false; for(const f of E.fires) f.s.visible=true; E.jim.visible=false; if(E.jeff) E.jeff.visible=false;
  for(const f of E.folk) f.visible=false;
  const lp=PLAYER.pos.clone();
  const bob=E.bob; bob.visible=true; bob.userData.A.mode=null; bob.userData.A.path=null; bob.position.set(lp.x+1.2,.22,lp.z-2.5); bob.rotation.set(0,0,Math.PI/2);
  if(E.chunks) for(const c of E.chunks){ if(Math.hypot(c.o.position.x-lp.x,c.o.position.z-lp.z)<9) c.o.visible=false; }
  PLAYER.lock(); setVM(false); PLAYER.eye=.3; PLAYER.roll=.25; PLAYER.pitch=-.05; lookAtPoint(V3(bob.position.x-.8,.3,bob.position.z),0);
  playMusic(null); setAmbience([['wind',.04]]); SFX.tinnitus(9);
  await tweenVal(k=>{ FX.blackout=1-k; FX.dof=1; FX.dofFocus=.4; },2);
  await wait(4);   // Bob, out cold on the ground. The ringing in your ears says the rest
  SND.play('sob_breath',{vol:.5});
  await tweenVal(k=>{ FX.blackout=k; },3.2);
  await wait(2); FX.dof=0;
  // you wake up in Jim's rocket
  const C=await enterLevel('cabin',{pos:V3(-2.3,0,1.0),yaw:.9});
  C.setView('earth'); for(const s of C.suits) s.visible=false;
  const bob2=C.bob; bob2.visible=true; bob2.userData.A.mode='lie'; bob2.userData.A.look=null; bob2.userData.A.path=null; bob2.rotation.order='YXZ'; bob2.rotation.set(-Math.PI/2,-.9,0); bob2.position.set(1.25,.56,1.76);
  const jim=C.jim; jim.visible=true; jim.position.set(-.85,0,.45); jim.rotation.set(0,-1.05,0); jim.userData.A.mode='kneel'; jim.userData.A.look='player'; setMood(jim,'sad'); clearPose(jim,0);
  PLAYER.pos.set(-2.3,0,1.0); PLAYER.eye=.74; PLAYER.roll=0; PLAYER.yaw=.9; PLAYER.pitch=1.15; setVM(false);
  SFX.blink(); await tweenVal(k=>{ FX.blackout=1-k*.5; },.5); await tweenVal(k=>{ FX.blackout=.5+k*.5; },.3); await wait(.5);
  await tweenVal(k=>{ FX.blackout=1-k; },1.6);
  await wait(.8);
  lookAtPoint(V3(-.85,1.1,.45),1.4); await wait(1.6);
  playMusic('sad',3);
  const J={h:jim,who:'Jim',mood:'sad'};
  await talk([{...J,text:"Are you ok?"}]);
  // you sit up
  { const p0=PLAYER.pos.clone(); await tweenVal(k=>{ PLAYER.eye=lerp(.74,1.06,k); PLAYER.pos.x=lerp(p0.x,-2.05,k); PLAYER.pos.z=lerp(p0.z,1.2,k); lookAtPoint(V3(-.85,1.05,.45),0); },1.2); }
  await talk([{who:'You',text:"Yes... but is Bob ok? And Jeff?"}]);
  lookAtPoint(V3(1.6,.75,1.5),1); await wait(1.1);
  // Bob, asleep on the other cot
  camShot(V3(.55,1.25,1.0),V3(2.1,.62,1.1),{dur:.9,fov:46}); await wait(2.6); camRelease(.8); await wait(.8);
  lookAtPoint(V3(-.85,1.05,.45),.9); await wait(.9);
  await talk([{...J,text:"...",silent:true,auto:1.6},{...J,text:"Jeff is gone."},{who:'You',text:"No... no..."}]);
  // you cry (quietly: the picture blurs, you look down, your breath shakes)
  // you cry: a real recording, the picture blurs, you look down
  const cry=SND.play('crying',{vol:.8,fadeIn:.4});
    lookAtPoint(V3(-2.05+.62,.42,1.2+.5),2.2); await tweenVal(k=>{ FX.dof=k; FX.dofFocus=.25; FX.desat=k*.4; },2.2);
  await tweenVal(k=>{ const s=Math.max(0,Math.sin(k*Math.PI*7))*Math.sin(k*Math.PI); PLAYER.eye=1.06-s*.03; },4.4,x=>x);
  if(cry) cry.stop(2.2);
  lookAtPoint(V3(-.85,1.05,.45),1.6); await tweenVal(k=>{ FX.dof=1-k*.7; },1.6);
  await talk([{...J,text:"I'm sorry, bud. At least you have me.",pose:'talk'},{...J,text:"And we beat this."}]);
  clearPose(jim);
  await wait(1.2);
  await tweenVal(k=>{ FX.blackout=k; },2.4);
  FX.desat=0; FX.dof=0; jim.userData.A.mode=null; bob2.userData.A.mode=null; bob2.rotation.order='XYZ'; bob2.rotation.set(0,0,0);
  await marsToClone();
}

