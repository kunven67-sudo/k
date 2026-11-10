/* ================================================================
   INSIDE THE PYRAMID — dark. You walk, Jay 2 follows and talks.
   Bones. Something moves once. Old paintings. The purple glow.
   Then the fruit.
   ================================================================ */
SCENES.pyramid=async function(){
  const lv=LEVELS.pyramid; const fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  saveCheckpoint('pyramid');
  const J=lv.jay2; resetActor(J); giveWatch(J); CUR.j2=J;
  lv.inter.length=0; lv.triggers.length=0; lv.trail.length=0; lv.follow=false;
  resetFruits(lv);
  for(const p of lv.paintings){ p.seen=false; p.lookT=0; }
  setPlayer(V3(0,0,-2.6),0,0); J.position.set(.75,0,-.9); J.rotation.y=Math.PI; J.userData.A.look=null;
  freeWalk(); PLAYER.ctl.jump=false;
  FX.exposure=.45; lv.expTarget=1.28;
  await wait(.2);
  fade(0,2.6);
  playMusic('pyramid',4);
  unlock('pyramid');
  lv.follow=true;
  await wait(1.6);
  chat(['p_feet',L('p_dark'),'p_dark_r']);
  objective('Follow the purple light');
  later(9,()=>objective(''));
  // bones on the floor
  (async()=>{ await waitUntil(()=>PLAYER.pos.z<-20.5); await chat(['p_bones',L('p_bones_r'),'p_bones_r2']); })();
  // something moves, far away. Once.
  (async()=>{ await waitUntil(()=>PLAYER.pos.z<-29); const z=-73.5;
    lv.bug.visible=true; lv.bug.rotation.y=0; lv.bugRun={t:0,dur:.75,a:V3(-4.2,0,z),b:V3(4.2,0,z)};
    SND.play('skitter_1',{vol:1,pos:V3(-1,-2,z),ref:9}); later(.3,()=>SND.play('skitter_2',{vol:.9,pos:V3(2,-2,z),ref:9}));
    await wait(1.1); J.userData.A.look=V3(0,-1.6,z); await chat([L('p_moved',{mood:'shock'}),L('p_moved_r')]); J.userData.A.look=null; })();
  (async()=>{ await waitUntil(()=>PLAYER.pos.z<-38); SND.play('stomach',{vol:.7,rate:.9}); })();
  // the paintings (secret trophy: look at all four up close)
  SCENE_TICKS.push(dt=>{ const fw=camera.getWorldDirection(new THREE.Vector3()); let all=true;
    for(const p of lv.paintings){ if(!p.seen){ const to=p.pos.clone().sub(camera.position); const d=to.length(); if(d<5.5&&to.normalize().dot(fw)>.9){ p.lookT+=dt; if(p.lookT>1.1) p.seen=true; } } if(!p.seen) all=false; }
    if(all&&!F.paintings){ F.paintings=true; unlock('paintings'); } });
  await waitUntil(()=>PLAYER.pos.z<-46.5);
  await CHATQ;
  // "Hold on. Look at the walls."
  lookOnly(); lv.follow=false; crosshair(false);
  const bugs=lv.paintings[0], king=lv.paintings[1];
  walkTo(J,[V3(.3,-2.4,-49.6)],2.2).then(()=>{ facePoint(J,bugs.pos); J.userData.A.look=bugs.pos; });
  PLAYER.lookTo=null; lookAtPoint(bugs.pos,1.3);
  await say([L('p_walls',{mood:'worried'}),L('p_walls_2',{pose:'point'}),L('p_walls_3'),
    L('p_walls_4',{pose:null,fx:()=>{ J.userData.A.look=king.pos; facePoint(J,king.pos); PLAYER.lookTo=null; lookAtPoint(king.pos,1.4); }}),
    L('p_walls_5',{mood:'angry',pose:'point'}),L('p_walls_6'),L('p_walls_7',{pose:null,mood:'neutral'})]);
  clearPose(J,.4); J.userData.A.look=null;
  freeWalk(); PLAYER.ctl.jump=false; lv.follow=true;
  await waitUntil(()=>PLAYER.pos.z<-79);
  J.userData.A.look=PYR.roomC; chat([L('p_glow',{mood:'worried'})]);
  await waitUntil(()=>Math.hypot(PLAYER.pos.x-PYR.roomC.x,PLAYER.pos.z-PYR.roomC.z)<4.4);
  await CHATQ;
  SCENES.fruit(true);
};
function resetFruits(lv){
  const C=PYR.roomC;
  lv.fruits.forEach((f,i)=>{ if(f.parent) f.parent.remove(f); f.position.set(C.x+(i?.24:-.22),C.y+.94,C.z+.05); f.rotation.set(0,i?2.1:4.4,0); f.scale.setScalar(1); lv.scene.add(f); });
  lv.fruitGlow=2.2;
}
/* the fruit. Jay 2 bites first. Then you. Then it goes wrong. */
SCENES.fruit=async function(cont){
  const lv=LEVELS.pyramid, J=lv.jay2, C=PYR.roomC;
  if(!cont){ const fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
    resetActor(J); giveWatch(J); CUR.j2=J; lv.inter.length=0; lv.trail.length=0; resetFruits(lv);
    setPlayer(V3(0,0,-88.6),0,-.05); J.position.set(.8,0,-87.2); J.rotation.y=Math.PI; FX.exposure=1.1; lv.expTarget=1.28;
    playMusic('pyramid',2); await wait(.2); fade(0,1.6); }
  saveCheckpoint('fruit');
  lv.follow=false; lookOnly(); crosshair(false); letterbox(true);
  const stand=V3(C.x,C.y,C.z+1.6), jStand=V3(C.x-.95,C.y,C.z+.95);
  walkTo(J,[V3(-.9,0,C.z+3.2),jStand],1.6).then(()=>{ facePoint(J,C); });
  await autoWalk([stand],1.3);
  PLAYER.lookTo=null; lookAtPoint(lv.fruits[1].position.clone().add(V3(0,.05,0)),1.1);
  J.userData.A.look=lv.fruits[0].position;
  stopMusic(3);
  await say([L('p_fruit',{mood:'shock'}),L('p_fruit_r'),L('p_fruit_2',{mood:'tired'}),L('p_fruit_3',{mood:'neutral'}),L('p_fruit_4')]);
  // Jay 2 takes one and bites
  const f1=lv.fruits[0]; facePoint(J,C); setPose(J,'holdFruit',.4); await wait(.45);
  holdProp(J,f1,'R',V3(0,-.075,.03),new THREE.Euler(0,0,0)); f1.scale.setScalar(1);
  J.userData.A.look='player'; await wait(.9);
  setPose(J,'eatFruit',.35); await wait(.55);
  SND.play('bite',{vol:.9,pos:headOf(J),ref:2}); biteFruit(f1,headOf(J)); await wait(.35);
  SND.play('chew_1',{vol:.7,pos:headOf(J),ref:2}); await wait(.6); SND.play('chew_2',{vol:.6,pos:headOf(J),ref:2});
  setPose(J,'holdFruit',.4);
  await wait(.7);
  await say([L('p_fruit_5',{mood:'happy'})]);
  // your turn
  const f2=lv.fruits[1];
  let bit=false;
  PLAYER.ctl.interact=true; crosshair(true);
  addInteract(lv,{obj:f2,label:'Take a bite',reach:2.6,act:()=>{ bit=true; }});
  objective('Eat the fruit');
  await waitUntil(()=>bit);
  objective(''); lv.inter.length=0; crosshair(false); PLAYER.ctl.interact=false;
  unlock('fruit');
  // up to your mouth... bite
  f2.parent.remove(f2); const held=f2.clone(); held.traverse(o=>{ if(o.isMesh){ o.renderOrder=10; o.castShadow=false; } });
  const hg=VM.arms.R.userData.handG; hg.add(held); held.position.set(.005,.07,-.045); held.rotation.set(-.4,0,.2);
  VM.holdItem=held; VM.eatK=0; VM.forceShow=true;
  await wait(.5);
  await tweenVal(v=>{ VM.eatK=v; },0,1,.85);
  SND.play('bite',{vol:1}); shake(.08); biteFruit(held,camera.getWorldPosition(new THREE.Vector3())); await wait(.3);
  SND.play('chew_2',{vol:.8});
  await tweenVal(v=>{ VM.eatK=v; },1,.15,.6);
  SND.play('chew_3',{vol:.7}); await wait(.5);
  // something is wrong: colours swim, heart pounds, the hum gets loud
  const hb=loopSnd('heartbeat',{vol:.0001}); hb&&hb.vol(.85,1.2);
  if(lv.snd&&lv.snd[3]) lv.snd[3].vol(1.3,1.5);
  SCENE_TICKS.push(dt=>{ const t=G.time; FX.saturation=damp(FX.saturation,1.45,1,dt); FX.aberr=damp(FX.aberr,.006,1,dt); lv.fruitGlow=damp(lv.fruitGlow,4.5,1,dt); PLAYER.roll=Math.sin(t*1.3)*.035*(lv.wob||0); });
  lv.wob=0; tweenVal(v=>{ lv.wob=v; },0,1,3);
  blurScreen(.12);
  await wait(1.2);
  setMood(J,'worried'); setPose(J,'flinch',.6);
  await say([L('p_fruit_6',{mood:'worried'})]);
  // Jay 2 drops first
  J.userData.A.look=null; await collapse(J);
  const f1w=f1.getWorldPosition(new THREE.Vector3()); f1.parent.remove(f1); f1.position.copy(f1w).setY(C.y+.04); lv.scene.add(f1);
  await wait(.6);
  if(VM.holdItem){ VM.holdItem.parent&&VM.holdItem.parent.remove(VM.holdItem); VM.holdItem=null; } VM.forceShow=false;
  PLAYER.lookTo=null; lookAtPoint(headOf(J),.9);
  await say([L('p_fruit_7',{auto:.3})]);
  // then you: the room tips over, everything blurs
  tweenVal(blurScreen,.12,.85,2.6);
  tweenVal(v=>{ lv.wob=v; },1,3,2);
  await wait(1.1);
  tweenVal(v=>{ PLAYER.roll=v; },PLAYER.roll,1.25,1.1,easeIn); tweenVal(v=>{ PLAYER.eye=v; },1.64,.25,1.1,easeIn); tweenVal(v=>{ PLAYER.pitch=v; },PLAYER.pitch,-.15,1.1);
  SCENE_TICKS.length=0;
  await wait(1.05);
  SND.play('body_fall',{vol:1}); shake(.5);
  hb&&hb.vol(.5,.6);
  await tweenVal(lids,0,1,1.6);
  stopLoops(1.5); stopMusic(1); for(const h of lv.snd||[]) h&&h.vol(0,.8);
  await fade(1,.6);
  await wait(1.2);
  startAt('pig',F);
};
