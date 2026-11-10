/* ================================================================
   WAKING UP — eyes open slow and blurry, close, open again. Chained
   to a chair. Jay 2 chained next to you. And him: the pig-man on his
   throne, chewing. Look around... then he looks at you. Black.
   ================================================================ */
SCENES.pig=async function(){
  const lv=LEVELS.pigroom; const fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  saveCheckpoint('pig');
  const J=lv.jay2; resetActor(J); giveWatch(J); CUR.j2=J; J.userData.A.seated=true; J.userData.A.idleOff=true;
  setPose(J,'chainedSleep',0); setMood(J,'asleep'); J.userData.A.look=null;
  J.position.copy(PIGROOM.jay2); J.position.y=-.38;   // sitting on the seat, not floating above it
  const pigP=lv.pig.userData.pig; pigP.stop=false; pigP.look=null; pigP.lookW=0; pigP.eatT=0;
  // you, in the chair
  setPlayer(PIGROOM.you.clone(),0,-.42); PLAYER.eye=PIGROOM.eye; PLAYER.lock(); lv.chained=false; crosshair(false); hudVisible(false);
  setVM(false); PLAYER.hasWatch=false;
  lids(1); blurScreen(1);
  setAmbience([['fire',.05]]);
  const br=loopSnd('breath_heavy',{vol:.0001}); br&&br.vol(.32,2);
  await wait(.4); fd.style.transition='opacity .2s'; fd.style.opacity=0;
  playMusic('pig',6);
  // in the dark: chewing, fire, an oink
  await wait(2.4);
  SND.play('pig_2',{vol:.9,pos:V3(0,1.9,-1.9),ref:3,rate:.8});
  await wait(1.4);
  // blink 1
  await tweenVal(lids,1,.62,1.7); await wait(.5); await tweenVal(lids,.62,.93,.45);
  await wait(.9);
  // blink 2: head comes up a little
  tweenVal(v=>{ PLAYER.pitch=v; },-.42,-.2,1.8);
  await tweenVal(lids,.93,.32,1.5); tweenVal(blurScreen,1,.75,1.5); await wait(.6); await tweenVal(lids,.32,.78,.35);
  await wait(.5);
  // open
  SND.play('gasp',{vol:.65});
  tweenVal(v=>{ PLAYER.pitch=v; },-.2,-.04,1.6);
  await tweenVal(lids,.78,0,1.4);
  tweenVal(blurScreen,.75,0,3.2);
  unlock('chained');
  br&&br.vol(.18,3);
  PLAYER.ctl.look=true; lv.chained=true; lv.prevYaw=null;
  SND.play('chain_2',{vol:.5,pos:V3(PIGROOM.you.x,.7,PIGROOM.you.z-.3),ref:1.5});
  // looking around... Jay 2 wakes up next to you
  let lookedPig=0, lookedJay=0;
  SCENE_TICKS.push(dt=>{ const fw=camera.getWorldDirection(new THREE.Vector3());
    const tp=V3(0,1.9,-2.1).sub(camera.position).normalize(), tj=headOf(J).sub(camera.position).normalize();
    if(fw.dot(tp)>.93) lookedPig+=dt; if(fw.dot(tj)>.9) lookedJay+=dt; });
  await wait(4.5);
  setPose(J,'chained',1.2); setMood(J,'worried');
  later(.8,()=>{ J.userData.A.look='player'; SND.play('chain_1',{vol:.45,pos:V3(PIGROOM.jay2.x,.7,PIGROOM.jay2.z-.3),ref:1.5}); });
  await wait(1.6);
  await chat([L('w_wake_1',{mood:'worried'}),L('w_wake_2'),L('w_wake_3',{mood:'worried',fx:()=>{ J.userData.A.look=V3(0,1.9,-2.1); }}),L('w_wake_4'),L('w_wake_5',{mood:'angry',fx:()=>{ J.userData.A.look='player'; }})],.45);
  J.userData.A.look=V3(0,1.9,-2.1);
  // a while longer to look around (or until you've had a good look at him)
  objective('Look around');
  await waitUntil(()=>lookedPig>2.5&&lookedJay>.8);   // you have to actually look (it used to move on by itself after 9 s)
  objective('');
  await wait(2);
  // he stops chewing... and looks right at you
  pigP.stop=true; pigP.lookSpeed=.7; pigP.look=camera;
  later(.4,()=>SND.play('pig_4',{vol:1,pos:V3(0,1.9,-2),ref:3,rate:.72}));
  await wait(2.6);
  SND.play('pig_1',{vol:.8,pos:V3(0,1.9,-2),ref:3,rate:.62});
  await wait(1.5);
  // cut to black. No card.
  fd.style.transition='none'; fd.style.opacity=1;
  if(AU.ok){ master.gain.cancelScheduledValues(ACtx.currentTime); master.gain.setValueAtTime(0,ACtx.currentTime); }
  stopMusic(0); stopLoops(0); setAmbience([],.01); stopSpeech();
  lv.chained=false; PLAYER.lock();
  await new Promise(r=>setTimeout(r,3800));
  const s=getSave()||{}; s.done=true; writeSave(s);
  unlock('part1');
  if(AU.ok) applyVolumes();
  TITLE.show(false);
};
