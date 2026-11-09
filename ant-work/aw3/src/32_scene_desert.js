/* ================================================================
   THE DESERT — white... then sand, blazing noon. You're both alive,
   both normal now. The watch call: static. Real sighs. Then the long
   walk to the pyramid (you can only look around).
   ================================================================ */
SCENES.desert=async function(){
  const lv=LEVELS.desert, D=DESERT.door;
  const W=$('fxWhite'); W.style.transition='none'; W.style.opacity=1;
  saveCheckpoint('desert');
  const J=lv.jay2; resetActor(J); giveWatch(J); CUR.j2=J;
  lv.clearPrints(); lv.glareOn=true; lv.sweatOn=false;
  setVMBlocky(false);
  // you: flat on your back in the sand, the sun right above
  setPlayer(V3(0,0,0),Math.PI,1.28); PLAYER.eye=.32; PLAYER.lock(); crosshair(false); letterbox(true);
  J.position.set(2.6,0,2.2); J.rotation.y=-2.4; J.userData.A.look=null;
  lids(1);
  await wait(.3);
  W.style.transition='opacity 3.2s ease-out'; W.style.opacity=0;
  SND.play('gasp',{vol:.85});
  await tweenVal(lids,1,.15,2.4);
  await tweenVal(lids,.15,.7,.25); await tweenVal(lids,.7,0,.6);
  PLAYER.ctl.look=true;
  await wait(1.2);
  // "...You alive?"
  faceTo(J,PLAYER.pos); J.userData.A.look='player'; setMood(J,'worried');
  await say([L('d_alive'),L('d_alive_r')]);
  // sit up... stand up
  PLAYER.ctl.look=false;
  SND.play('sand_fall',{vol:.6});
  tweenVal(v=>{ PLAYER.pitch=v; },PLAYER.pitch,.05,1.4);
  await tweenVal(v=>{ PLAYER.eye=v; },.32,.95,1.4);
  await wait(.3);
  SND.play('breath_heavy',{vol:.35,offset:1});
  PLAYER.lookTo=null; lookAtPoint(headOf(J),1.2);
  await tweenVal(v=>{ PLAYER.eye=v; },.95,1.64,1.1,easeOut);
  PLAYER.ctl.look=true;
  walkTo(J,[V3(1.3,0,.9)],1.2);
  await wait(1.2);
  // you're both not blocky anymore
  if(F.ending==='tiny') await say([L('d_notblocky'),L('d_notblocky_r',{mood:'worried'})]);
  else await say([L('d_notblocky_me',{mood:'shock'}),L('d_notblocky_me_r')]);
  await say([L('d_green',{mood:'neutral'}),L('d_green_r')]);
  await say([L('d_where',{mood:'worried'}),L('d_notmars')]);
  await say([L('d_earth')]);
  // he looks past you... the pyramid
  const top=V3(DESERT.pyr.x,DESERT.height*.55,DESERT.pyr.z);
  J.userData.A.look=top; setPose(J,'point',.4); facePoint(J,top);
  await say([L('d_pyramid',{mood:'shock',fx:()=>{ PLAYER.lookTo=null; lookAtPoint(top,2.4); }})]);
  await wait(1.6); clearPose(J,.4);
  // call Jim on the watch
  J.userData.A.look='player'; faceTo(J,PLAYER.pos);
  await say([L('d_call',{mood:'neutral'})]);
  PLAYER.hasWatch=true; watchMode('calling'); tweenVal(v=>{ PLAYER.watchLook=v; },0,1,.7);
  await wait(.6); SND.play('watch_beep',{vol:.55}); await wait(.9); SND.play('watch_beep',{vol:.55});
  await wait(.9);
  watchMode('static'); const st1=loopSnd('static',{vol:.42,fadeIn:.1});
  await say([L('d_call_you')]);
  await wait(1.3);
  setPose(J,'watch',.45); J.userData.A.look=null;
  await wait(.6);
  const wp=()=>J.userData.watch?J.userData.watch.getWorldPosition(new THREE.Vector3()):headOf(J);
  if(J.userData.watchScr) J.userData.watchScr.material.color.set(0x9a9a9a).multiplyScalar(1.4);
  const st2=loopSnd('static',{vol:.55,pos:wp(),ref:1.2,offset:2});
  await say([L('d_call_him')]);
  await wait(1.4);
  st1&&st1.stop(.15); st2&&st2.stop(.15); SND.play('watch_beep',{vol:.45,rate:.8}); watchMode('time');
  if(J.userData.watchScr) J.userData.watchScr.material.color.set(0x6dffd8).multiplyScalar(1.6);
  await wait(.5);
  clearPose(J,.5); J.userData.A.look='player';
  await say([L('d_call_dead',{mood:'tired'})]);
  // both sigh (real sighs)
  setPose(J,'droop',.6); setMood(J,'tired');
  SND.play('sigh_1',{vol:1,pos:headOf(J),ref:2});
  await wait(1.9);
  tweenVal(v=>{ PLAYER.watchLook=v; },1,0,.9);
  SND.play('sigh_2',{vol:.9});
  await wait(2.4);
  unlock('static');
  clearPose(J,.6); setMood(J,'neutral');
  await walkToPyramid(lv,J);
};
/* the long walk: about 45 seconds, you can only look around */
async function walkToPyramid(lv,J){
  const D=DESERT.door;
  lookOnly(); crosshair(false); letterbox(true);
  playMusic('desert',2.5); lv.sweatOn=true;
  const path=[V3(.4,0,-14),V3(-1.6,0,-36),V3(.8,0,-62),V3(0,0,D.z+9)];
  const jpath=path.map((p,i)=>p.clone().add(V3(1.35,0,i===path.length-1?.6:.25)));
  J.userData.A.look=null;
  const speed=2.15;
  const arrive=Promise.all([autoWalk(path,speed),walkTo(J,jpath,speed*1.01)]);
  (async()=>{
    await wait(3); J.userData.A.look='player'; await chat(['d_walk_1']); J.userData.A.look=null;
    await wait(7); await chat(['d_walk_2']);
    await wait(5); J.userData.A.look='player'; await chat(['d_walk_3',L('d_walk_4')]); J.userData.A.look=null;
    await wait(3.5); SND.play('stomach',{vol:.75});
    await wait(5); J.userData.A.look=V3(0,30,DESERT.pyr.z); await chat([L('d_walk_5',{mood:'worried'})]);
  })();
  await arrive;
  lv.sweatOn=false; blurScreen(0);
  // at the dark doorway
  await walkTo(J,[V3(.9,0,D.z+3.2)],1.4);
  faceTo(J,PLAYER.pos); J.userData.A.look='player';
  PLAYER.lookTo=null; lookAtPoint(headOf(J),.8);
  await wait(.4);
  stopMusic(4);
  await say([L('d_hungry',{mood:'tired'})]);
  walkTo(J,[V3(.6,0,D.z-1),V3(.4,0,D.z-6)],1.5);
  await wait(.6);
  const go=autoWalk([V3(0,0,D.z+1.2),V3(0,0,D.z-3)],1.5);
  await wait(1.4);
  await fade(1,1.6);
  await go;
  startAt('pyramid',F);
}
