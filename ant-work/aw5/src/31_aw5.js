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
  if(!TIMEP.frozen) for(const r of lv.rocks){ r.t=(r.t||0)+dt; r.o.position.y=r.base+Math.sin(r.t*1.7+r.ph)*.25; r.o.rotation.y+=dt*.8; }
  // history for the rewind spots
  TIMEP.histT-=dt; if(TIMEP.histT<=0){ TIMEP.histT=.25; TIMEP.hist.push({p:PLAYER.pos.clone(),y:PLAYER.y,yaw:PLAYER.yaw}); if(TIMEP.hist.length>20) TIMEP.hist.shift(); }
  if(G.mode==='play'&&!DLG.active){ for(const R of lv.rew){ R.o.material.opacity=.18+Math.sin(t*5+R.x)*.06; if(Math.hypot(PLAYER.pos.x-R.x,PLAYER.pos.z-R.z)<2.2&&!TIMEP.rewinding){ rewindPlayer(); break; } } }
  // glitches
  lv.gT=(lv.gT||3)-dt; if(lv.gT<=0&&!TIMEP.frozen){ lv.gT=rand(2.5,6); const g=pick(lv.glitchers); const p0=g.position.clone(); g.position.add(V3(rand(-3,3),rand(-2,2),rand(-3,3))); later(.15,()=>g.position.copy(p0)); FX.aberr=.03; later(.12,()=>FX.aberr=.004); SND.play('static',{vol:.15,rate:rand(.8,1.3)}); }
  // Steve's scanner
  if(SNEAK.on&&G.mode==='play'&&!DLG.active&&!TIMEP.frozen){ SNEAK.ang+=dt*.6; const S=lv.steve; const yaw=Math.sin(SNEAK.ang)*.9; S.rotation.y=yaw; lv.scan.rotation.y=yaw;
    const to=V3(PLAYER.pos.x-S.position.x,0,PLAYER.pos.z-S.position.z), d=to.length(); const fwd=V3(Math.sin(yaw),0,Math.cos(yaw)); const ang=Math.acos(clamp(to.normalize().dot(fwd),-1,1));
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
    lv.scan=new THREE.Group(); const cone=mesh(new THREE.ConeGeometry(9,26,24,1,true),new THREE.MeshBasicMaterial({color:col(0x7ac8ff),transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),0,1.5,13,false); cone.rotation.x=-Math.PI/2; lv.scan.add(cone); lv.scene.add(lv.scan); }
  const S=lv.steve, A=lv.alex; resetActor(S); resetActor(A); S.position.set(0,0,-94); S.rotation.y=0; A.position.set(2.2,0,-97); faceTo(A,lv.console.position); setPose(A,'type',.3); lv.scan.position.set(0,0,-94);
  PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(headOf(S),.8); J.userData.A.look='player'; await say(['x_lab1','x_lab2']);
  freeWalk(); PLAYER.ctl.jump=true; objective('Sneak past Steve + Alex (stay out of the blue light, use the cover)'); SNEAK.on=true; SNEAK.seenT=0; SNEAK.warned=0;
  await waitUntil(()=>PLAYER.pos.z<-100||F.caught); if(F.caught) return; SNEAK.on=false; F.snuck=1;
  const r=await choose([{text:'Keep going. Don\'t let them see us.'},{text:'Talk to them anyway'}]); if(r.text.startsWith('Talk')) return labTalk(false);
  runStory(()=>SCENES.cliff()); };
async function labTalk(caught){ F.talked=1; const lv=LEVELS.mash, S=lv.steve, A=lv.alex; PLAYER.lock(); PLAYER.ctl.look=true; clearPose(A,.3); faceTo(S,PLAYER.pos); faceTo(A,PLAYER.pos); S.userData.A.look='player'; A.userData.A.look='player'; lookAtPoint(headOf(S),.5);
  await say(caught?['x_s1','x_s2']:['x_s1b','x_s2']);
  for(let i=0;i<3;i++){ const r=await choose([{text:'What IS this watch?',w:!F.askedW},{text:'"Come with us."'},{text:'"Stay away from us."'}].filter(o=>o.w!==false));
    if(r.text.startsWith('What')){ F.askedW=1; F.talked=1; await say(['x_w1','x_a1','x_a2']); continue; }
    if(r.text.startsWith('"Come')){ F.withSA=1; await say(['x_join','x_s3','x_a3']); break; }
    await say(['x_away','x_s4']); break; }
  SNEAK.on=false; runStory(()=>SCENES.cliff()); }
SCENES.cliff=async function(){ const lv=LEVELS.mash; if(LV!==lv){ await enterLevel('mash',{pos:V3(0,0,-108)}); setPlayer(V3(0,0,-108),Math.PI); } saveCheckpoint('cliff'); jay2_5(lv); SNEAK.on=false;
  if(F.withSA&&lv.steve){ lv.steve.position.set(-3,0,-104); lv.alex.position.set(3,0,-104); }
  // (secret) freeze time right next to Jay 2 and look at him
  if(!lv.j2secret){ lv.j2secret=1; const J=lv.jay2; addInteract(lv,{obj:J,offset:V3(0,1.5,0),reach:2.4,label:'Look at him',when:()=>TIMEP.frozen&&!F.j2glow,act:async()=>{ F.j2glow=1; PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(headOf(J),.4); const L=new THREE.PointLight(col(0x9fd8ff),2.5,3,2); J.add(L); L.position.y=1.2; await say(['x_glow']); J.remove(L); freeWalk(); PLAYER.ctl.jump=true; }}); }
  F.canFreeze=1; PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(MASH.tear,1); await say(['x_c1','x_c2']); await tweenVal(v=>PLAYER.watchGlow=v,0,.8,.5); later(.8,()=>PLAYER.watchGlow=0); toast('Press T: your watch FREEZES time. Press T again to let it go.','#9fd8ff');
  freeWalk(); PLAYER.ctl.jump=true; objective('Get up to the tear (freeze the rocks with T, then climb)');
  await waitUntil(()=>PLAYER.pos.distanceTo(V3(MASH.tear.x,0,MASH.tear.z))<4&&PLAYER.y>10); if(TIMEP.frozen) timeFreeze(); F.canFreeze=0;
  PLAYER.lock(); SND.play('blast',{vol:.8}); const wh=$('fxWhite'); wh.style.transition='opacity .8s'; wh.style.opacity=1; await wait(1.2); runStory(()=>SCENES.white()); };
SCENES.white=async function(){ const lv=LEVELS.white, wh=$('fxWhite'); if(LV!==lv) await enterLevel('white',{pos:V3(0,6,10)}); saveCheckpoint('white'); setPlayer(V3(0,6,10),Math.PI); PLAYER.pos.y=6; objective('');
  const J=jay2_5(lv); J.userData.level='white'; J.position.set(2,5.4,10); setPose(J,'droop',0); wh.style.transition='opacity 2s'; wh.style.opacity=0; playMusic('sad',3); F.seen=F.seen||{};
  PLAYER.lock(); PLAYER.ctl.look=true; await wait(1.5); await say(['x_w_1','x_w_2','x_w_3']); clearPose(J,.5);
  toast('There\'s no ground here. FLY: WASD, Space = up, C = down','#cfd8e8'); freeWalk(); objective('Look into the glass boxes');
  makeGears(lv);
  for(const B of WHITE.boxes){ const g=lv.boxes[B.id]; addInteract(lv,{obj:g,reach:g.userData.S*.9,label:'Look inside',when:()=>!F.seen[B.id],act:()=>lookBox(B.id)}); }
  await waitUntil(()=>['desert','nivalis','gulch','beach','time','thing'].filter(k=>F.seen[k]).length>=4&&F.seen.beach);
  objective('The door'); PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(WHITE.door,1); SND.play('hum_purple',{vol:.8}); await tweenVal(v=>lv.door.material.opacity=v,0,1,2); await say(['x_door']); freeWalk();
  await waitUntil(()=>PLAYER.pos.distanceTo(WHITE.door)<4.5); runStory(()=>SCENES.beyond()); };
async function lookBox(id){ const lv=LEVELS.white, g=lv.boxes[id]; F.seen[id]=1; if(!F.firstBox) F.firstBox=id; PLAYER.lock(); PLAYER.ctl.look=true;
  const from=camera.position.clone(); camFollow(t=>{ const k=Math.min(1,t/1.2); return {pos:from.clone().lerp(g.position.clone().add(V3(0,0,g.userData.S*.75)),smooth(k)),look:g.position.clone().add(V3(0,-1,0)),fov:60}; },60); CAM.fnT=0; await wait(1.3);
  if(id==='thing'){ let k=0; const tk=dt=>{ k+=dt; FX.aberr=.02+k*.02; shake(.05+k*.03); blurScreen(Math.min(.6,k*.3)); }; SCENE_TICKS.push(tk); SND.play('static',{vol:.8,rate:.4}); await say(['x_thing1','x_thing2']); SCENE_TICKS.splice(SCENE_TICKS.indexOf(tk),1); FX.aberr=.004; blurScreen(0); unlock('looked'); }
  else if(id==='beach'){ const J=lv.jim; J.userData.A.look=camera; await say(['x_jim1','x_jim2','x_jim3','x_jim4']); unlock('vacation'); const r=await choose([{text:'Wave at him'},{text:'"We\'ll come home, Jim. I promise."'},{text:'Look away'}]); if(r.text.startsWith('"We')){ F.jimPromise=1; await say(['x_promise','x_jim5']); } }
  else await say({desert:['x_desert'],nivalis:['x_niv'],gulch:['x_gulch','x_gulch2'],time:['x_time']}[id]);
  if(id==='gulch'&&!lv.graveI){ lv.graveI=1; addInteract(lv,{obj:g,reach:g.userData.S*.75,label:'Touch the glass',when:()=>F.seen.gulch&&!F.bobRespect,act:()=>{ F.bobRespect=1; SND.play('bell_01',{vol:.3,rate:.6}); chat(['x_grave']); }}); }
  camRelease(.6); await wait(.6); freeWalk(); }
/* ---------- the gears: one hidden on each reality box (never mentioned anywhere) ---------- */
function gearMesh(){ const g=new THREE.Group(); const m=new THREE.MeshPhysicalMaterial({color:col(0xe8c060),metalness:1,roughness:.25,emissive:col(0x6a4a10),emissiveIntensity:.8});
  g.add(mesh(new THREE.TorusGeometry(.13,.035,8,24),m,0,0,0,false)); for(let i=0;i<8;i++){ const t=box(.05,.05,.05,m,Math.cos(i/8*Math.PI*2)*.17,Math.sin(i/8*Math.PI*2)*.17,0,false); g.add(t); } { const hub=mesh(new THREE.CylinderGeometry(.04,.04,.06,10),m,0,0,0,false); hub.rotation.x=Math.PI/2; g.add(hub); } return g; }
function makeGears(lv){ F.gears=F.gears||{}; if(!lv.gears){ lv.gears={}; for(const id of ['desert','nivalis','gulch','beach','time']){ const box_=lv.boxes[id], S=box_.userData.S; const g=gearMesh();
    const spot={desert:V3(S/2-.25,-S/2+.3,S/2-.25),nivalis:V3(-S/2+.25,S/2+.12,-S/2+.25),gulch:V3(S/2+.12,S/4,-S/2+.4),beach:V3(-S/2+.2,-S/2-.12,S/2-.2),time:V3(0,S/2+.12,S/2-.1)}[id];
    g.position.copy(spot); box_.add(g); lv.gears[id]=g;
    addInteract(lv,{obj:g,reach:2.6,label:'Take it',when:()=>!F.gears[id],act:()=>{ F.gears[id]=1; g.visible=false; SND.play('watch_beep',{vol:.35,rate:1.6}); }}); } }
  for(const id in lv.gears) lv.gears[id].visible=!F.gears[id]; }
on('tick',dt=>{ const lv=LEVELS.white; if(!lv||!lv.gears||LV!==lv) return; for(const id in lv.gears) lv.gears[id].rotation.z+=dt*.8; });
/* ---------- which ending (the game never says how) ---------- */
function endingFor(){ const s=getSave()||{}, E=s.endings||{}, seen=F.seen||{}, gears=Object.keys(F.gears||{}).length, n=Object.keys(seen).length;
  const five=['work','sheriff','fire','watched','keepers'].every(k=>E[k]);
  if(five&&gears>=5&&!seen.thing&&F.withSA&&F.j2glow&&F.jimPromise) return 'unmade';
  if(F.withSA&&F.askedW&&seen.time&&!seen.thing) return 'keepers';
  if(seen.thing&&!F.withSA) return 'watched';
  if(F.bobRespect&&F.snuck&&!F.talked) return 'sheriff';
  if(F.firstBox==='desert'&&F.jimPromise&&!seen.thing) return 'work';
  if(F.j2glow&&seen.nivalis&&n<=4) return 'fire';
  return null; }
/* ---------- BEYOND ---------- */
SCENES.beyond=async function(){ const lv=LEVELS.white, wh=$('fxWhite'); if(LV!==lv) await enterLevel('white',{pos:WHITE.beyondAt}); saveCheckpoint('beyond'); const J=jay2_5(lv); J.userData.level='white';
  wh.style.transition='opacity .4s'; wh.style.opacity=1; await wait(.5); lv.scene.background=col(0x050508); lv.scene.fog.color.set(0x050508); lv.scene.fog.density=.0008; lv.godL.intensity=3; setPlayer(WHITE.beyondAt.clone().add(V3(0,10,0)),Math.PI); PLAYER.pos.y=10; J.position.copy(PLAYER.pos).add(V3(2,-.5,0));
  const SA=F.withSA; if(SA&&!lv.sa){ const s_=makeSteve({}), a_=makeAlien({name:'Alex',voice:'Alex'}); for(const h of [s_,a_]){ h.userData.level='white'; lv.scene.add(h); } lv.sa=[s_,a_]; } if(lv.sa){ lv.sa.forEach(h=>h.visible=!!SA); if(SA){ lv.sa[0].position.copy(PLAYER.pos).add(V3(-2.5,-.8,1)); lv.sa[1].position.copy(PLAYER.pos).add(V3(4,-.8,1)); } }
  wh.style.transition='opacity 2.5s'; wh.style.opacity=0; stopMusic(2); PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(WHITE.god,2); await wait(2.5); playMusic('boss',4); SND.play('hum_purple',{vol:1,rate:.4});
  await say(['g5_1','x_b1','g5_2','g5_3','g5_4']);
  await say(['x_b2','g5_5']);
  // the god takes JAY 2 by the throat
  J.userData.hold=1; setPose(J,'flail',.2); const ringJ=mesh(new THREE.TorusGeometry(.16,.02,8,30),new THREE.MeshBasicMaterial({color:col(0xffd890)}),0,-.08,0,false); ringJ.rotation.x=Math.PI/2; J.userData.J.head.add(ringJ);
  const gasp=loopSnd('breath_heavy',{vol:.7,rate:1.3}); const j0=J.position.clone(); const lift=dt=>{ J.position.y=lerp(J.position.y,j0.y+5,dt*.9); J.position.z=lerp(J.position.z,j0.z-6,dt*.5); }; SCENE_TICKS.push(lift);
  lookAtPoint(headOf(J),.8); await wait(1); await say(['x_ch1']);
  // you: LET HIM GO! — and you go for him
  await say(['x_letgo']); SND.play('breath_heavy',{vol:.9,rate:.9}); const p0=PLAYER.pos.clone(); await tweenVal(k=>{ PLAYER.pos.lerpVectors(p0,p0.clone().add(V3(0,1,-14)),k); },0,1,1.1,easeIn); shake(.4);
  // ...and the god takes you too
  await say(['g5_t1']); const ring=mesh(new THREE.TorusGeometry(.45,.03,8,40),new THREE.MeshBasicMaterial({color:col(0xffd890)}),0,-.35,-.5,false); ring.rotation.x=Math.PI/2; camera.add(ring);
  const y0=PLAYER.pos.y; const up=dt=>{ PLAYER.pos.y=lerp(PLAYER.pos.y,y0+4,dt*1.2); shake(.05); }; SCENE_TICKS.push(up); blurScreen(.3); const dm=setInterval(()=>dmgFlash(),1100);
  await say(['g5_t2']); SCENE_TICKS.splice(SCENE_TICKS.indexOf(up),1); clearInterval(dm); blurScreen(0);
  SND.play('swing_2',{vol:1,rate:.4}); SND.play('blast',{vol:.6,rate:.7}); shake(1.4); flashWhite(1,.15);
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(lift),1); gasp&&gasp.stop(.3); J.userData.J.head.remove(ringJ); camera.remove(ring); clearPose(J,.1); J.userData.hold=0;
  // THROWN through 5 realities
  const end=endingFor(); const stop={work:0,fire:1,sheriff:2,unmade:4}[end]; const tl=LEVELS.thrown; if(!tl.built) await buildLevel('thrown'); tl.panes.forEach(p=>p.visible=true);
  await enterLevel('thrown',{pos:V3(0,0,2)},{keepMusic:true}); PLAYER.lock(); setVM(false); hudVisible(false); stopMusic(.5); loopSnd('wind_loop',{vol:.9});
  const gearOrbit=[]; if(end==='unmade'){ for(let i=0;i<5;i++){ const g=gearMesh(); g.scale.setScalar(.45); camera.add(g); g.visible=false; gearOrbit.push(g); } }
  await throwThrough(stop==null?5:stop,i=>{ if(gearOrbit[i]){ gearOrbit[i].visible=true; SND.play('watch_beep',{vol:.5,rate:1.4+i*.1}); } });
  stopLoops(.5);
  if(gearOrbit.length) SCENE_TICKS.push(dt=>{ gearOrbit.forEach((g,i)=>{ const a=G.time*1.4+i/5*Math.PI*2; g.position.set(Math.cos(a)*.3,Math.sin(a)*.16-.08,-.75); g.rotation.z+=dt*3; }); });
  await ({work:endWork,fire:endFire,sheriff:endSheriff,keepers:endKeepers,watched:endWatched,unmade:()=>endUnmade(gearOrbit)}[end]||endNone)(); };
/* the pieces of an ending scene */
function landAt(seg){ const tl=LEVELS.thrown, L=tl.segs[seg].land; camRelease(0); setPlayer(L.clone(),0); PLAYER.y=0; PLAYER.lock(); PLAYER.ctl.look=true; PLAYER.eye=.6; setVM(true); return L; }
function dropJay2(at){ const tl=LEVELS.thrown; const J=jay2_5(tl); J.userData.level='thrown'; resetActor(J); J.visible=true; J.userData.hold=1; J.position.copy(at).add(V3(1.6,6,1)); tweenVal(y=>J.position.y=y,6,0,.5,easeIn).then(()=>{ SND.play('body_fall',{vol:.9}); shake(.4); setPose(J,'lieBack',0); later(1.2,()=>clearPose(J,.6)); }); return J; }
async function endCard(title,sub,id){ stopMusic(2); const fd=$('fade'); fd.style.transition='opacity 2s'; fd.style.opacity=1; await wait(2.2); await card(title,sub,3.4); if(id) unlock('end_'+id);
  const s=getSave()||{}; if(id){ s.endings=Object.assign({},s.endings||{},{[id]:1}); writeSave(s); }
  const n=['work','sheriff','fire','watched','keepers'].filter(k=>(s.endings||{})[k]).length;
  if(id==='unmade') await card('THE REAL ENDING','',2.6); else if(id){ await card('ENDING '+n+' / 5','',2.2); if(n>=5) unlock('allEndings'); }
  fd.style.opacity=0; PLAYER.eye=1.64; TITLE.show(false); }
async function endWork(){ const tl=LEVELS.thrown, L=landAt('desert'); playMusic('title',3); if(!tl.jim){ tl.jim=makeJim({}); tl.jim.userData.level='thrown'; tl.scene.add(tl.jim); } const Jm=tl.jim; resetActor(Jm); Jm.position.copy(tl.stand.position).add(V3(0,0,-1.2)); faceTo(Jm,L); Jm.userData.A.look='player';
  await wait(1); await tweenVal(e=>PLAYER.eye=e,.6,1.64,1.2); lookAtPoint(headOf(Jm),.6); await say(['x_r_w1']); dropJay2(L); await wait(1.6); await say(['x_r_w2','x_r_w3']); await endCard('ENDING: BACK TO WORK','Home. The ants never stopped.','work'); }
async function endFire(){ const tl=LEVELS.thrown, L=landAt('nivalis'); setAmbience([['wind',.12]]); await wait(1.2); await tweenVal(e=>PLAYER.eye=e,.6,1.64,1.4); lookAtPoint(tl.caveL.position,1);
  const J=jay2_5(tl); J.userData.level='thrown'; resetActor(J); J.visible=true; J.userData.hold=1; J.position.copy(tl.caveL.position).setY(0).add(V3(1,0,1)); setPose(J,'sitGround',0); J.userData.A.look='player';
  await say(['x_r_f1','x_r_f2','x_r_f3']); await endCard('ENDING: THE FIRE','No watch. No way home. Two Jays and a fire.','fire'); }
async function endSheriff(){ const tl=LEVELS.thrown, L=landAt('gulch'); playMusic('title',3); if(!tl.bob){ tl.bob=makeHuman({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0x7a6a50,pants:0x3a3a40,hair:0x6a4a2a,beard:true,build:1.05,seed:60}); tl.bob.userData.level='thrown'; tl.scene.add(tl.bob); }
  const B=tl.bob; resetActor(B); B.position.copy(L).add(V3(-8,0,-10)); await wait(.8); await tweenVal(e=>PLAYER.eye=e,.6,1.64,1.2); walkTo(B,[L.clone().add(V3(-1,0,-2.2))],3.4); lookAtPoint(headOf(B),.8); await wait(1.4); faceTo(B,L); B.userData.A.look='player';
  await say(['x_r_s1','x_r_s2','x_r_s3']); dropJay2(L); await wait(1.6); await say(['x_r_s4']); await endCard('ENDING: THE NEW SHERIFF','Bob lived. You stayed. Dry Gulch got a sheriff who falls out of the sky.','sheriff'); }
async function backToWhite(){ const lv=LEVELS.white, wh=$('fxWhite'); wh.style.transition='opacity .3s'; wh.style.opacity=1; await wait(.4); await enterLevel('white',{pos:V3(0,6,-60)},{keepMusic:true}); lv.scene.background=col(0xf2f2f4); lv.scene.fog.color.set(0xf2f2f4); lv.scene.fog.density=lv.fogW; lv.godL.intensity=0;
  camRelease(0); setPlayer(V3(0,8,-60),Math.PI); PLAYER.pos.y=8; PLAYER.lock(); PLAYER.ctl.look=true; setVM(true); if(lv.jay2) lv.jay2.visible=false; wh.style.transition='opacity 1.5s'; wh.style.opacity=0; await wait(1.4); return lv; }
async function endKeepers(){ const lv=await backToWhite(); const [S,A]=lv.sa||[]; if(S){ S.visible=A.visible=true; S.position.set(-2.5,7.2,-64); A.position.set(2,7.2,-63); faceTo(S,PLAYER.pos); faceTo(A,PLAYER.pos); S.userData.A.look='player'; A.userData.A.look='player'; }
  const J=lv.jay2; if(J){ J.visible=true; J.userData.hold=1; J.position.set(1,14,-66); tweenVal(y=>J.position.y=y,14,7.4,2.4); } playMusic('sad',2); lookAtPoint(A?headOf(A):V3(0,8,-64),.8);
  await say(['x_r_k1','x_r_k2','x_r_k3','x_r_k4']); await endCard('ENDING: THE KEEPERS','Every reality, in your hands. Forever.','keepers'); }
async function endWatched(){ const lv=await backToWhite(); const eye=lv.eye.clone(true); eye.scale.setScalar(14); eye.position.set(0,30,-200); lv.scene.add(eye); lookAtPoint(V3(0,22,-200),2.5);
  SND.play('static',{vol:.6,rate:.4}); let k=0; const tk=dt=>{ k+=dt; eye.lookAt(camera.position); FX.aberr=.01+k*.006; }; SCENE_TICKS.push(tk); await say(['x_r_t1']); await wait(1.5); await say(['x_r_t2']);
  await endCard('ENDING: WATCHED','You looked at it. Now it never stops looking at you.','watched'); FX.aberr=.004; lv.scene.remove(eye); }
async function endNone(){ const lv=await backToWhite(); const fall=dt=>{ PLAYER.pos.y-=dt*6; }; SCENE_TICKS.push(fall); await wait(3); await card('...','',2); await card('Not like this.','',2.4); TITLE.show(false); }
/* THE REAL ENDING: the watch made them. Fix the watch, and everything it made is undone. */
async function endUnmade(gears){ const tl=LEVELS.thrown; camRelease(0); const at=tl.segs.time.land; setPlayer(at.clone(),Math.PI); PLAYER.pos.y=at.y; PLAYER.y=0; PLAYER.lock(); PLAYER.ctl.look=true; setVM(true); PLAYER.watchLook=0;
  playMusic('sad',3); await wait(1.5); await say(['x_u1']);
  await tweenVal(v=>PLAYER.watchLook=v,0,1,.8); for(const g of gears){ await tweenVal(k=>{ g.position.lerp(V3(-.12,-.18,-.42),k*.3); g.scale.setScalar(.45*(1-k)+.1); },0,1,.5); g.visible=false; SND.play('switch_01',{vol:.6,rate:1.2}); }
  await tweenVal(v=>PLAYER.watchGlow=v,0,1,2); SND.play('hum_purple',{vol:.9}); await say(['g5_u1','x_u2']);
  const J=jay2_5(tl); J.userData.level='thrown'; resetActor(J); J.visible=true; J.userData.hold=1; J.position.copy(at).add(V3(1.6,-.6,-1.6)); faceTo(J,at); J.userData.A.look='player'; lookAtPoint(headOf(J),.8);
  await say(['x_u3','x_u4','x_u5','x_u6','x_u7']);
  // gone. not dead. just... not anymore.
  const fadeM=[]; J.traverse(o=>{ if(o.isMesh&&o.material){ o.material=o.material.clone(); o.material.transparent=true; fadeM.push(o.material); } });
  const vm=[]; VM.grp.traverse(o=>{ if(o.isMesh&&o.material){ o.material.transparent=true; vm.push(o.material); } });
  await tweenVal(k=>{ for(const m of fadeM) m.opacity=1-k; for(const m of vm) m.opacity=1-k; if(Math.random()<.5) LEVELS.thrown.soft.spawn(J.position.x+rand(-.4,.4),J.position.y+rand(0,1.8),J.position.z+rand(-.4,.4),rand(-.3,.3),rand(.3,1),rand(-.3,.3),rand(1,2),.08,.7,.85,1,.9,0,.5,1.5); },0,1,5);
  stopMusic(3); const wh=$('fxWhite'); wh.style.transition='opacity 3s'; wh.style.opacity=1; await wait(3.5); for(const m of vm){ m.opacity=1; m.transparent=false; } setVM(false); PLAYER.watchGlow=0; PLAYER.watchLook=0;
  await card('','',1.5);
  // the watch falls... somewhere new. A rainy street on Earth. Someone new.
  const S=THROWN.street; tl.streetL.intensity=2.4; tl.scene.background=col(0x0a0c12); tl.scene.fog.color.set(0x0a0c12); tl.scene.fog.density=.02;
  tl.rain=dt=>{ for(let i=0;i<10;i++) tl.soft.spawn(camera.position.x+rand(-12,12),camera.position.y+rand(4,9),camera.position.z+rand(-14,4),0,-16,0,.7,.03,.7,.75,.85,.55,0,.2,1); };
  if(!tl.niko){ tl.niko=makeHuman({name:'Niko Vale',voice:'Jay',skin:0xc89a78,hair:0x14100c,hairStyle:'short',shirt:0xe8c020,hood:true,sleeves:'long',pants:0x2a3040,shoes:0x1a1a1a,build:.92,seed:333}); tl.niko.userData.level='thrown'; tl.scene.add(tl.niko); }
  const N=tl.niko; resetActor(N); N.position.set(S.x-1,0,S.z+18); const watch=gunlessWatch(); watch.position.set(S.x,.05,S.z+2); tl.scene.add(watch); const wl=new THREE.PointLight(col(0x6dffd8),1.6,4,2); wl.position.set(S.x,.3,S.z+2); tl.scene.add(wl);
  camFollow(t=>({pos:V3(S.x+3.5,1.4,S.z-4),look:V3(S.x,.6,S.z+4),fov:55}),55); CAM.fnT=0; setAmbience([['wind',.05]]); SND.play('drips',{vol:.4,loop:true});
  wh.style.transition='opacity 3s'; wh.style.opacity=0; SND.play('blast',{vol:.25,rate:1.6}); await wait(2);
  walkTo(N,[V3(S.x-.3,0,S.z+3)],1.1); await wait(3.6); faceTo(N,watch.position); setPose(N,'lookDown',.6); await wait(1.4); setPose(N,'holdOut',.6); await wait(.8); watch.visible=false; wl.intensity=4; SND.play('watch_beep',{vol:.8}); SND.play('hum_build',{vol:.5}); await wait(2);
  unlock('end_unmade'); await card('ANT WORK','NIKO VALE',3.6); await card('The watch found someone new.','',3); tl.rain=null; stopLoops(1);
  await endCard('THE REAL ENDING: UNMADE','Both Jays never existed. The watch did.','unmade'); }
function gunlessWatch(){ const w=new THREE.Group(); w.add(mesh(new THREE.TorusGeometry(.05,.012,8,24),new THREE.MeshPhysicalMaterial({color:col(0x1a1c22),roughness:.4,metalness:.6}),0,0,0,false)); w.add(mesh(new THREE.CylinderGeometry(.035,.035,.012,20),new THREE.MeshStandardMaterial({color:col(0x6dffd8),emissive:col(0x6dffd8),emissiveIntensity:2}),0,.012,0,false)); w.rotation.x=0; return w; }
/* ---------- the title: the white, the boxes ---------- */
TITLE.show=async function(first){ resetStory(); cleanUI(); G.mode='menu'; G.paused=false; unlockPointer(); const lv=LEVELS.white; await enterLevel('white',{pos:V3(0,6,10)},{keepMusic:true}); lv.scene.background=col(0xf2f2f4); lv.scene.fog.color.set(0xf2f2f4); lv.scene.fog.density=lv.fogW; lv.door.material.opacity=0;
  PLAYER.lock(); setVM(false); crosshair(false); hudVisible(false); camFollow(t=>{ const a=t*.02; return {pos:V3(Math.sin(a)*70,10+Math.sin(t*.1)*3,-90+Math.cos(a)*70),look:V3(0,4,-95),fov:55}; },55);
  playMusic('title',first?3:1.5); $('title').classList.remove('hide'); $('title').style.opacity=1; const s=getSave(); const has=!!(s&&s.cp);
  $('btnContinue').classList.toggle('hide',!has); $('contWhere').textContent=has?CP(s.cp).name:''; $('trophyCount').textContent=Object.keys(TROPHY).length+' / '+TROPHY_DEFS.length;
  if(TITLE.nav) TITLE.nav.stop(); TITLE.nav=GS3Console.nav($('titleMenu'),{first:has?$('btnContinue'):$('btnNew')}); };
$('btnContinue').onclick=()=>{ const s=getSave(); if(!s||!s.cp) return; SFX.uiClick(); startAt(s.cp,s.flags||{}); };
$('btnNew').onclick=()=>{ SFX.uiClick(); startAt('mash',{}); };
