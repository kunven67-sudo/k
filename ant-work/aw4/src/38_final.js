/* ================================================================
   THE LAST NIGHT — at the ship. The Riders come. Someone holds Jay 2 at
   gunpoint (WHO depends on who you trusted this loop). Bob dies saving
   you. Gideon takes off the mask: Moe. The duel. You BOTH get out.
   Then the watch breaks reality... (Ant Work 5)
   ================================================================ */
function armNPC(h,kind='revolver'){ const U=h.userData; if(U.gunM) return; const g=gunMesh(kind); g.scale.setScalar(1.05); g.rotation.set(-Math.PI/2,0,0); g.position.set(0,-.06,.04); U.J.hdR.add(g); U.gunM=g; }
SCENES.final=async function(){ const lv=LEVELS.dust, fd=$('fade'), port=F.place==='port'; DAY.running=false; NIGHT4.on=true; clearRiders(); if(RIDE.on) dismount(); objective('');
  const at=port?DUST.hangar.clone().add(V3(0,0,18)):DUST.ship.clone().add(V3(-4,0,-22)); if(!port&&!F.shipDug) digOut();
  fd.style.transition='opacity .8s'; fd.style.opacity=1; await wait(.9); DAY.hour=19.1; dayLight(lv);
  setPlayer(at,Math.PI); PLAYER.y=lv.ground(at.x,at.z); const J=CUR.j2; J.visible=true; J.userData.hold=0; resetActor(J); J.position.copy(at).add(V3(1.6,0,.5)); J.position.y=lv.ground(J.position.x,J.position.z);
  if(!hasItem('revolver')){ INV.slots[INV.slots.indexOf(null)>=0?INV.slots.indexOf(null):5]={id:'revolver',n:1,loaded:6}; } giveAmmo('bullets',12);
  fd.style.opacity=0; playMusic('fight',1); chat(['j2_final1']);
  // the wave
  const ring=[]; for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+.3; const h=makeRider({acc:.55}); h.position.set(at.x+Math.cos(a)*55,0,at.z+Math.sin(a)*55); h.position.y=lv.ground(h.position.x,h.position.z); armNPC(h); ring.push(h); }
  if(F.abeAlly){ const A=NPC.abe; A.visible=true; A.userData.dead=false; A.position.copy(at).add(V3(-3,0,4)); armNPC(A); chat(['a_final']); const abeT=dt=>{ if(A.userData.dead) return; A.userData.shT=(A.userData.shT||2)-dt; if(A.userData.shT<=0){ A.userData.shT=rand(1.5,2.5); const tg=ring.find(h=>!h.userData.dead&&h.position.distanceTo(A.position)<60); if(tg){ faceTo(A,tg.position); setPose(A,'aim',.2); SND.play('gun_revolver2',{vol:.8,pos:A.position,ref:25}); if(Math.random()<.45) applyHit({person:tg,head:false,point:tg.position.clone().add(V3(0,1.3,0))},70,'abe'); } } }; SCENE_TICKS.push(abeT); }
  selectSlot(INV.slots.findIndex(s=>s&&s.id==='revolver'));
  objective('Hold them off!'); freeWalk(); PLAYER.ctl.jump=true;
  const t0=G.time; await waitUntil(()=>ring.filter(h=>!h.userData.dead).length<=1||G.time-t0>75||LOOP.dying); if(LOOP.dying) return;
  for(const h of ring) if(!h.userData.dead){ h.userData.dead=true; h.visible=false; } NIGHT4.riders=[];
  // the gunpoint: who has Jay 2?
  const holderId=F.betrayer==='lucky'?'lucky':(F.abeTold&&!F.abeAlly)?'abe':F.betrayer==='amos'?'amos':'gideon';
  let H; if(holderId==='gideon'){ H=makeRider({acc:.9}); NIGHT4.riders=[]; cowboy(H,{hat:false,goldTooth:true}); H.userData.who='Gideon'; H.userData.hp=99999; } else { H=NPC[holderId]; H.visible=true; H.userData.dead=false; H.userData.hp=100; }
  armNPC(H); J.userData.hold=1; J.userData.A.path=null; J.position.copy(at).add(V3(0,0,9)); J.position.y=lv.ground(J.position.x,J.position.z); faceTo(J,at); setPose(J,'handsUp',.2);
  H.position.copy(J.position).add(V3(.4,0,.7)); faceTo(H,at); setPose(H,'aim',.2); H.userData.A.look='player';
  PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(headOf(J),.6); objective(''); stopMusic(1.5); SND.play('heartbeat',{vol:.8});
  await say(['gp_'+holderId,'j2_gp']);
  const opts=[{text:'Shoot him (aim for the head)'},{text:'Talk him down'},{text:'Give him the watch'},{text:'Leave Jay 2. Take off alone.'}];
  const r=await choose(opts); const pick_=opts.indexOf(opts.find(o=>o.text===r.text));
  if(pick_===3){ await endingAlone(); return; }
  if(pick_===2){ await say(['j_watch','gp_watch']); SND.play('gun_revolver',{vol:1}); setPose(J,'dead',.2); return loopDie('jay2'); }
  if(pick_===1){ await say(['j_talkdown']); if(holderId==='abe'){ await say(['a_lower']); clearPose(H,.5); } else { await say(['gp_no']); SND.play('gun_revolver',{vol:1}); setPose(J,'dead',.2); learn('noTalk_'+holderId,'Talking won\'t work on '+holderId); return loopDie('jay2'); } }
  else { // the shot: slow motion, you aim
    freeWalk(); PLAYER.ctl.move=false; SLOWMO.target=.22; toast('AIM... (click to shoot)','#ffd27a'); let shot=null; const hp0=H.userData.hp;
    H.userData.onHit=(by,d)=>{ shot=d; }; const t1=G.real; await waitUntil(()=>shot!==null||G.real-t1>5);
    SLOWMO.target=1; H.userData.onHit=null;
    if(shot===null){ SND.play('gun_revolver',{vol:1}); setPose(J,'dead',.2); return loopDie('jay2'); }
    if(holderId==='gideon'){ H.userData.hp=99999; H.userData.dead=false; setPose(H,'flinch',.1); SND.play('voice/g_hurt',{vol:1,pos:H.position,ref:20}); }
    else if(H.userData.hp>0){ killPerson(H,'you'); } }
  clearPose(J,.4); J.userData.hold=0; PLAYER.lock(); PLAYER.ctl.look=true;
  // Gideon (if he wasn't the one holding Jay 2, he's here now)
  let G_=holderId==='gideon'?H:null; if(!G_){ G_=makeRider({acc:.9}); NIGHT4.riders=[]; cowboy(G_,{hat:false,goldTooth:true}); G_.userData.who='Gideon'; G_.userData.hp=999; G_.position.copy(at).add(V3(-4,0,13)); G_.position.y=lv.ground(G_.position.x,G_.position.z); armNPC(G_); }
  faceTo(G_,PLAYER.pos); setPose(G_,'aim',.3); G_.userData.A.look='player'; lookAtPoint(headOf(G_),.5); SND.play('voice/g_laugh',{vol:1,pos:G_.position,ref:40}); await wait(1.4);
  await say(['g_final']);
  // Bob
  if(F.bobHelps){ const B=bobAtShip(at); await wait(.3); B.position.copy(at).add(V3(2,0,4)); walkTo(B,[at.clone().add(V3(.4,0,1.6))],5.5); chat(['b_down']); await wait(.9); SND.play('gun_revolver',{vol:1,pos:G_.position,ref:30}); muzzleFlash(G_.userData.J.hdR.getWorldPosition(V3()));
    setPose(B,'dead',.25); SND.play('body_fall',{vol:1}); shake(.4); await wait(1); lookAtPoint(headOf(B),.6); await say(['j_bob1','b_last1','b_last2','j_bob2']); unlock('bob'); }
  else { SND.play('gun_revolver',{vol:1,pos:G_.position,ref:30}); hurtPlayer(30,'shot'); await say(['j2_close']); }
  // the mask comes off
  lookAtPoint(headOf(G_),.5); await wait(.4); const M=G_.userData.mask; if(M){ tweenVal(v=>{ M.position.y=v; },0,-.25,.5); later(.55,()=>{ M.visible=false; }); }
  laughGlintOn(G_); await say(['m_reveal1','j_moe1','m_reveal2']); learn('moeGideon');
  // the duel
  await say(['m_duel']); for(const n of ['3','2','1']){ toast(n,'#ffd27a'); SND.play('bell_01',{vol:.4,rate:1.4}); await wait(.9); }
  toast('DRAW!','#ff8a6a'); freeWalk(); PLAYER.ctl.move=false; selectSlot(INV.slots.findIndex(s=>s&&s.id==='revolver')); const cur=curItem(); if(cur) cur.loaded=Math.max(cur.loaded,1); SLOWMO.target=.35;
  let won=false; G_.userData.dead=false; G_.userData.hp=60; G_.userData.onDie=()=>{ won=true; }; const t2=G.real; await waitUntil(()=>won||G.real-t2>2.6); SLOWMO.target=1;
  if(!won){ SND.play('gun_shotgun',{vol:1}); return loopDie('shot'); }
  unlock('duel'); stopMusic(1); await wait(1.2); lootBody(G_.userData.loot||{gold:10});
  // off this planet
  PLAYER.lock(); PLAYER.ctl.look=true; await say(['j2_go','j_go']);
  await liftOff(at);
};
function bobAtShip(at){ const lv=LEVELS.dust; if(!lv.bobShip){ const b=makeHuman({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0x7a6a50,pants:0x3a3a40,hair:0x6a4a2a,beard:true,build:1.05,seed:60}); cowboy(b,{hatCol:0x5a4a38}); b.userData.level='dust'; b.userData.hp=100; lv.scene.add(b); lv.bobShip=b; } const b=lv.bobShip; resetActor(b); b.visible=true; return b; }
function laughGlintOn(h){ const t=h.userData.goldTooth; if(!t) return; const L=new THREE.PointLight(col(0xffd040),2.5,1.5,2); t.add(L); later(1.2,()=>t.remove(L)); }
async function endingAlone(){ const fd=$('fade'); PLAYER.lock(); SND.play('hum_build',{vol:.8}); await wait(1); fd.style.transition='opacity 2s'; fd.style.opacity=1; await wait(2.2); unlock('alone');
  await card('ENDING: ALONE','You got off Dustreach. Jay 2 didn\'t.',3); await card('...that\'s not how it happened.','',2.4); fd.style.opacity=0; loopDie('jay2'); }
async function liftOff(at){ const lv=LEVELS.dust, fd=$('fade'); const ship=F.place==='port'?lv.portShip:lv.bship;
  fd.style.transition='opacity .6s'; fd.style.opacity=1; await wait(.7); CUR.j2.visible=false; invShow(false); clockShow(false); holster(); fd.style.opacity=0;
  const loop=loopSnd('hum_build',{vol:.9}); const p0=ship.position.clone();
  camFollow(t=>{ const k=Math.min(1,t/7); return {pos:p0.clone().add(V3(30-k*10,6+k*20,40)),look:ship.position.clone(),fov:55}; },55); CAM.fnT=0;
  await tweenVal(k=>{ ship.position.y=p0.y+k*k*60; ship.rotation.x=.12-k*.5; for(let i=0;i<4;i++) lv.soft.spawn(p0.x+rand(-6,6),p0.y+1,p0.z+rand(-6,6),rand(-3,3),rand(1,4),rand(-3,3),rand(1.5,3),rand(1,2.5),.6,.5,.4,.6,0,.5,2.5); },0,1,7);
  // the watch... breaks everything
  camRelease(0); setPlayer(ship.position.clone(),0); PLAYER.y=ship.position.y; PLAYER.lock(); setVM(true);
  await tweenVal(v=>{ PLAYER.watchLook=v; },0,1,.6); await tweenVal(v=>{ PLAYER.watchGlow=v; },0,1,1.6); SND.play('static',{vol:.9}); await say(['j2_watch','j_watch2']);
  for(let i=0;i<10;i++){ FX.aberr=.01+i*.006; flashWhite(.3,.06); SND.play(pick(['static','zap','ringing']),{vol:.5+i*.04,rate:rand(.6,1.4)}); shake(.3+i*.06); lv.sky.material.uniforms.top.value.setHSL(Math.random(),1,.3); await wait(.25); }
  loop&&loop.stop(.2); SND.play('blast',{vol:1}); const wh=$('fxWhite'); wh.style.transition='opacity .15s'; wh.style.opacity=1; FX.aberr=.003; await wait(1.4);
  stopMusic(.2); await card('ANT WORK 5','',3); unlock('aw4end'); const s=getSave()||{}; s.aw4done=true; writeSave(s);
  wh.style.transition='opacity 1s'; wh.style.opacity=0; TITLE.show(false); }
