/* ================================================================
   PART 2 — the pig king's prisoners.
   collar (pig room) -> shrink (big cage) -> Day 1 (the other prisoners)
   -> Night 1 (sneak out: bone + thorn) -> Day 2 (Orrin's fight)
   -> Night 2 (thread + pebbles, make a bone spear) -> Day 3 mantis
   -> Day 4 tarantula -> Day 5 scorpion with Jay 2 (the key).
   Nothing moves on by itself unless it has a reason; you do the doing.
   ================================================================ */
CHECKPOINTS.push(
  {id:'collar',  name:'The Pig King', level:'pigroom'},
  {id:'shrink',  name:'The Cage',     level:'pigroom'},
  {id:'day1',    name:'Day 1',        level:'table'},
  {id:'night1',  name:'Night 1',      level:'table'},
  {id:'day2',    name:'Day 2',        level:'table'},
  {id:'night2',  name:'Night 2',      level:'table'},
  {id:'mantis',  name:'Day 3',        level:'table'},
  {id:'spider',  name:'Day 4',        level:'table'},
  {id:'scorpion',name:'Day 5',        level:'table'});
Object.assign(WHO_CLASS,{Orrin:'orrin',Bram:'bram',Teo:'teo'}); Object.assign(WHO_NAME,{Orrin:'ORRIN',Bram:'BRAM',Teo:'TEO'});
/* "He will remember that." (top left, like the choices games) */
function remember(who='He'){ let el=$('remember'); if(!el){ el=document.createElement('div'); el.id='remember'; el.style.cssText='position:fixed;left:24px;top:84px;z-index:45;font:italic 700 17px Nunito,system-ui;color:#f4e6cc;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .5s;pointer-events:none'; document.body.appendChild(el); }
  el.textContent=who+' will remember that.'; el.style.opacity=1; SND.play('watch_beep',{vol:.25,rate:.6}); later(3.2,()=>{ el.style.opacity=0; }); }
/* a choice with a timer bar (ONLY for serious moments). Runs out = the default */
async function timedChoice(opts,sec,def){
  const p=choose(opts.map((o,i)=>Object.assign({},o,{i})),{lead:'DECIDE'});
  const bar=document.createElement('div'); bar.style.cssText='height:6px;margin:10px auto 0;width:100%;max-width:420px;background:rgba(255,255,255,.18);border-radius:4px;overflow:hidden'; const fill=document.createElement('div'); fill.style.cssText='height:100%;width:100%;background:#ffcc33;transition:width linear '+sec+'s'; bar.appendChild(fill); $('choices').appendChild(bar);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ fill.style.width='0%'; }));
  let done=false; const to=setTimeout(()=>{ if(!done&&CHOICE.active) pickChoice(def); },sec*1000);
  const r=await p; done=true; clearTimeout(to); bar.remove(); return r.i;
}
/* talk with choices: each topic once (it goes gray), 'end' leaves */
async function topicTalk(opts){ for(;;){ const op=await choose(opts.map((o,i)=>({text:L(o.q).text,used:o.used&&!o.end,i}))); const o=opts[op.i];
    o.used=true; await say([o.q,...o.a]); if(o.remember) remember(o.remember); if(o.end) return; } }
/* the collar zap: white, buzz, shake, you drop */
async function zapDown(){ PLAYER.lock(); SND.play('zap',{vol:1}); const cr=SND.play('zap_crackle',{vol:.7,loop:true}); flashWhite(.9,.5); shake(1.1); dmgFlash(); blurScreen(.8);
  tweenVal(v=>{ PLAYER.roll=v; },0,.9,.7); tweenVal(v=>{ PLAYER.eye=v; },PLAYER.eye,.35,.7,easeIn); await wait(.75); SND.play('body_fall',{vol:.9}); await wait(.6); cr&&cr.stop(.4);
  await tweenVal(lids,0,1,.8); }
/* ---------- the pig room: the collar ---------- */
SCENES.collar=async function(){
  const lv=LEVELS.pigroom, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  saveCheckpoint('collar');
  const J=lv.jay2; resetActor(J); giveWatch(J); CUR.j2=J; J.userData.A.seated=true; J.userData.A.idleOff=true; setPose(J,'chained',0); setMood(J,'worried'); J.position.copy(PIGROOM.jay2); J.position.y=-.38; J.rotation.y=Math.PI;
  const pig=lv.pig, P=pig.userData.pig; pig.position.set(PIGROOM.throne.x,.06,PIGROOM.throne.z+.1); pig.rotation.y=0; P.stand=0; P.walkK=0; P.walkTarget=null; P.armPose=null; P.stop=true; P.look=camera; P.lookW=1; P.meat.visible=false; lv.remote.visible=false;
  lv.gate.rotation.y=0; lv.bigCage.visible=false; for(const s of lv.shackles) s.visible=true; for(const s of lv.jayShackles) s.visible=true; lv.armL.visible=lv.armR.visible=true;
  setPlayer(PIGROOM.you.clone(),0,-.1); PLAYER.eye=PIGROOM.eye; PLAYER.lock(); lv.chained=true; PLAYER.ctl.look=true; crosshair(false); hudVisible(false); setVM(false);
  setAmbience([['fire',.05]]); playMusic('pig',2);
  SCENE_TICKS.push(dt=>pigWalkTick(pig,dt));
  P.onStep=()=>{ SND.play('step_stone_'+randi(1,6),{vol:1,pos:pig.position.clone(),ref:4,rate:.55}); shake(.05); };
  await wait(.3); fd.style.transition='opacity .8s'; fd.style.opacity=0; await wait(1.2);
  // he puts the meat down and gets up
  SND.play('pig_4',{vol:1,pos:V3(0,1.9,-2),ref:3,rate:.7});
  await tweenVal(v=>{ P.stand=v; },0,1,1.8); await wait(.4);
  chat(['p2_c1']);
  const reach=(k)=>{ P.armPose=(P)=>{ for(const A of [P.R,P.L]){ A.sh.rotation.set(-1.15*k-.2,0,(A===P.R?.15:-.15)); A.el.rotation.set(-.5*k-.3,0,0); A.hand.rotation.set(.3*k,0,0); } }; };
  // Jay 2 first
  await pigWalkTo(pig,V3(PIGROOM.jay2.x,0,PIGROOM.jay2.z-1.25),.85); P.look=headOf(J);
  await tweenVal(reach,0,1,.8);
  const c2=makeCollar(.07); J.userData.J.head.add(c2); c2.position.set(0,-.15,.0); SND.play('chain_3',{vol:.8,pos:headOf(J),ref:2,rate:1.4}); later(.15,()=>SND.play('watch_beep',{vol:.5,pos:headOf(J),ref:2,rate:.8}));
  setMood(J,'scared'); await say(['p2_c2']);
  await tweenVal(reach,1,0,.6);
  // then you
  await pigWalkTo(pig,V3(PIGROOM.you.x,0,PIGROOM.you.z-1.25),.85); P.look=camera; lookAtPoint(V3(PIGROOM.you.x,2.0,PIGROOM.you.z-1),1);
  await tweenVal(reach,0,1,.8); shake(.25); SND.play('chain_3',{vol:1,rate:1.4}); later(.15,()=>SND.play('watch_beep',{vol:.7,rate:.8})); SND.play('gasp',{vol:.6});
  await wait(.8); await tweenVal(reach,1,0,.6);
  // the chains come off (he wants you walking, not carried)
  for(const s of [...lv.shackles,...lv.jayShackles]) s.visible=false; SND.play('chain_1',{vol:.9}); later(.3,()=>SND.play('chain_2',{vol:.8,pos:headOf(J),ref:2}));
  lv.chained=false; lv.armL.visible=lv.armR.visible=false;
  J.userData.A.seated=false; clearPose(J,.4); J.position.y=0; J.position.z=PIGROOM.jay2.z+.4;
  // he walks to the gate and opens it, then goes back to his chair and picks up the remote
  await pigWalkTo(pig,V3(-1,0,lv.gateZ-1.2),.9); P.look=null;
  SND.play('metal_2',{vol:1,pos:V3(-1,1.5,lv.gateZ),ref:4,rate:.7}); await tweenVal(v=>{ lv.gate.rotation.y=v; },0,-1.5,1.2);
  await pigWalkTo(pig,V3(PIGROOM.throne.x,0,PIGROOM.throne.z+.1),.9); await pigWalkTo(pig,V3(PIGROOM.throne.x,0,PIGROOM.throne.z+.08),.9);
  pig.rotation.y=0; await tweenVal(v=>{ P.stand=v; },1,0,1.2); lv.remote.visible=true; P.look=camera; SND.play('pig_1',{vol:.9,pos:V3(0,1.9,-2),ref:3,rate:.65});
  await say(['p2_c3']); chat(['p2_c4']);
  // your move
  PLAYER.eye=1.64; setPlayer(V3(PIGROOM.you.x,0,PIGROOM.you.z+.5),Math.PI); freeWalk(); PLAYER.ctl.jump=false; crosshair(true); hudVisible(true); setVM(true);
  objective('Run for the gate');
  await waitUntil(()=>PLAYER.pos.z>lv.gateZ-1.6);
  objective('');
  P.armPose=(P)=>{ P.L.sh.rotation.set(-.9,0,-.1); P.L.el.rotation.set(-.6,0,0); P.L.hand.rotation.set(.2,0,0); };
  chat(['p2_c5']); await zapDown();
  collapse(J);
  await wait(1.5); fd.style.transition='opacity .6s'; fd.style.opacity=1; await wait(1);
  runStory(()=>SCENES.shrink());
};
/* ---------- the big cage: the fruit kicks in ---------- */
SCENES.shrink=async function(){
  const lv=LEVELS.pigroom, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('pigroom',{pos:V3(0,0,0)});
  saveCheckpoint('shrink');
  const J=lv.jay2; resetActor(J); giveWatch(J); CUR.j2=J; J.userData.A.seated=false; clearPose(J,0);
  if(!J.userData.collar){ const c=makeCollar(.07); J.userData.J.head.add(c); c.position.set(0,-.15,0); J.userData.collar=c; }
  for(const s of [...lv.shackles,...lv.jayShackles]) s.visible=false; lv.armL.visible=lv.armR.visible=false; lv.chained=false; lv.gate.rotation.y=0;
  const pig=lv.pig, P=pig.userData.pig; pig.position.set(PIGROOM.throne.x,.06,PIGROOM.throne.z+.1); pig.rotation.y=0; P.stand=0; P.armPose=null; P.walkTarget=null; P.stop=false; P.meat.visible=true; lv.remote.visible=true; P.look=null;
  lv.bigCage.visible=true; lv.inBigCage=true;
  const C=lv.bigCage.position;
  J.position.set(C.x-.6,0,C.z+.4); faceTo(J,V3(C.x,0,C.z-2)); setPose(J,'sit',0); J.userData.A.seated=true;
  setPlayer(V3(C.x+.4,0,C.z+.2),yawTo(V3(C.x,0,C.z),V3(0,0,-2.4)),-.3); PLAYER.eye=.9; PLAYER.lock(); PLAYER.ctl.look=true; crosshair(false); setVM(false); hudVisible(false);
  setAmbience([['fire',.05]]); playMusic('cage',3);
  lids(1); blurScreen(.8); fd.style.transition='opacity .5s'; fd.style.opacity=0; await wait(.6);
  SND.play('gasp',{vol:.6}); await tweenVal(lids,1,.4,1.2); await tweenVal(lids,.4,.8,.3); await tweenVal(lids,.8,0,1); tweenVal(blurScreen,.8,0,2.5);
  tweenVal(v=>{ PLAYER.eye=v; },.9,1.64,1.4);
  await say(['p2_k1','p2_k2','p2_k3']);
  // ten seconds in the cage... then the fruit (the fruit from the pyramid was always going to do this)
  objective('Look around'); PLAYER.ctl.look=true;
  await wait(10); objective('');
  SND.play('stomach',{vol:.9}); SND.play('hum_purple',{vol:.6}); blurScreen(.35); shake(.2);
  setPose(J,'flinch',.3); await say(['p2_k4']);
  SND.play('ringing',{vol:.5}); const hum=loopSnd('hum_build',{vol:.6});
  const k0=1, k1=1/TK, J0=J.position.clone();
  chat(['p2_k5','p2_k6'],.2);
  await tweenVal(k=>{ const s=Math.exp(Math.log(k0)+(Math.log(k1)-Math.log(k0))*k); PLAYER.scale=PLAYER.targetScale=s; J.scale.setScalar(s); J.position.set(J0.x,0,J0.z); shake(.03); },0,1,4.5,smooth);
  hum&&hum.stop(1); blurScreen(0); clearPose(J,.3);
  await wait(1.5);
  // he heard it. He looks over... and his hand comes down
  P.stop=true; P.look=camera; P.lookSpeed=1; SND.play('pig_4',{vol:1,pos:V3(0,1.9,-2),ref:3,rate:.6});
  await wait(2.2); shake(.6); SND.play('pig_2',{vol:1,rate:.6}); SND.play('cage_lock',{vol:1,rate:.7});
  fd.style.transition='opacity .25s'; fd.style.opacity=1; await wait(1.4);
  lv.inBigCage=false; PLAYER.scale=PLAYER.targetScale=1; J.scale.setScalar(1);
  runStory(()=>SCENES.day1());
};
/* ---------- the table: people, cages ---------- */
function tablePeople(){
  const lv=LEVELS.table;
  if(!lv.jay2){ const mk=(fn,o)=>{ const h=fn(o); h.userData.level='table'; lv.scene.add(h); return h; };
    lv.jay2=mk(makeJay2,{}); giveWatch(lv.jay2); const c=makeCollar(.07); lv.jay2.userData.J.head.add(c); c.position.set(0,-.15,0);
    lv.orrin=mk(makeHuman,{name:'Orrin',voice:'Orrin',skin:0xd8a888,shirt:0x6a5a40,pants:0x3a342a,shoes:0x3a2a1a,hair:0xb8b4ac,hairStyle:'short',beard:true,eye:0x5a6a7a,build:.92,height:.98,stubble:.3,head:{rx:.074,ry:.104,rz:.094,jaw:.28,nose:1.1,chin:1.05},seed:31});
    lv.teo=mk(makeHuman,{name:'Teo',voice:'Teo',skin:0xb98a64,shirt:0x8a3a2a,pants:0x2a3040,shoes:0x2a2a2a,hair:0x1a120c,hairStyle:'spiky',eye:0x3a2a1a,build:.9,height:.97,seed:44});
    lv.bram=mk(makeHuman,{name:'Bram',voice:'Bram',skin:0xe0b090,shirt:0x3a4a3a,pants:0x2a2a2a,shoes:0x1a1a1a,hairStyle:'bald',beard:true,hair:0x5a3a20,eye:0x4a5a3a,build:1.12,height:1.04,seed:52});
    for(const h of [lv.orrin,lv.teo,lv.bram]){ const c2=makeCollar(.07); h.userData.J.head.add(c2); c2.position.set(0,-.15,0); } }
  const at=(h,id,dx=0,dz=0)=>{ const c=cageOf(id); resetActor(h); h.visible=true; h.scale.setScalar(1); h.position.set(c.x+dx,0,c.z+dz); faceTo(h,V3(c.x+dx,0,c.z-5)); };
  at(lv.jay2,'you',1.5,.6); at(lv.orrin,'orrin',1.4,-.4); at(lv.teo,'teo',-1.3,-.3); at(lv.bram,'bram',.6,.9); setPose(lv.bram,'sit',0); lv.bram.userData.A.seated=true;
  CUR.j2=lv.jay2; return lv;
}
function youInCage(){ const c=cageOf('you'); setPlayer(V3(c.x-.6,0,c.z-.4),0,-.05); }
async function tableStart(id,time){
  const lv=LEVELS.table, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1;
  if(LV!==lv) await enterLevel('table',{pos:V3(0,0,0)});
  saveCheckpoint(id); tablePeople(); lv.setTime(time); lv.inter.length=0; NIGHT.on=false; resetNoisy(lv);
  const P=lv.pig.userData.pig; P.armPose=null; P.look=null; P.stand=0;
  youInCage(); PLAYER.eye=1.64; setVM(true); hudVisible(true); invHUD();
  setAmbience(time==='night'?[]:[['fire',.03]]);
  return lv;
}
async function dayCard(t){ const fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1; await card(t,'',2.2); fd.style.transition='opacity 1.2s'; fd.style.opacity=0; await wait(1); }
/* ---------- DAY 1: meet the others ---------- */
SCENES.day1=async function(){
  const lv=await tableStart('day1','day'); const J=lv.jay2;
  playMusic('cage',2); PLAYER.lock(); PLAYER.ctl.look=true;
  await dayCard('DAY 1');
  setMood(J,'worried'); J.userData.A.look='player';
  await say(['d1_1','d1_2']); J.userData.A.look=null;
  freeWalk(); PLAYER.ctl.jump=false;
  const T=F.talk||(F.talk={});
  const oT=[{q:'o_q1',a:['o_a1']},{q:'o_q2',a:['o_a2','o_a2b']},{q:'o_q3',a:['o_a3','o_a3b']},{q:'o_q4',a:['o_a4'],remember:'He'},{q:'o_q5',a:['o_a5']},{q:'o_bye',a:['o_bye_r'],end:true}];
  const tT=[{q:'t_q1',a:['t_a1','t_a1b']},{q:'t_q2',a:['t_a2']},{q:'t_bye',a:[],end:true}];
  const bT=[{q:'b_q1',a:['b_a1']},{q:'b_q2',a:['b_a2']},{q:'b_q3',a:['b_a3'],remember:'He',end:true}];
  const talkTo=(h,key,first,topics)=>addInteract(lv,{obj:h,offset:V3(0,1.5,0),reach:key==='bram'?17:6,label:'Talk to '+({orrin:'the old man',teo:'Teo',bram:'the big guy'})[key],act:async()=>{ PLAYER.lock(); PLAYER.ctl.look=true; h.userData.A.look='player';
    if(!T[key]){ T[key]=1; await say(first); } await topicTalk(topics); if(key==='orrin') T.orrinDone=1; h.userData.A.look=null; freeWalk(); PLAYER.ctl.jump=false; }});
  talkTo(lv.orrin,'orrin',['o_1','o_2'],oT); talkTo(lv.teo,'teo',['t_1'],tT); talkTo(lv.bram,'bram',['b_1'],bT);
  objective('Talk to the old man in the next cage');
  await waitUntil(()=>T.orrinDone);
  objective('Talk to the others, or rest on your bedding');
  addInteract(lv,{pos:V3(cageOf('you').x+.2,.3,cageOf('you').z+.6),reach:2.2,label:'Rest until night',act:()=>{ T.rest=1; }});
  await waitUntil(()=>T.rest);
  lv.inter.length=0; objective('');
  runStory(()=>SCENES.night1());
};
/* ---------- the nights: sneaking ---------- */
const NIGHT={on:false,alert:0,alertT:0,hidden:false,goals:{}};
function resetNoisy(lv){
  lv.noisy=[{o:lv.spoon,home:{p:lv.spoon.position.clone(),r:lv.spoon.rotation.clone()},hit:(p)=>{ const s=lv.spoon; const tip=s.localToWorld(V3(0,0,-6.6)); const a=s.position; const ab=tip.clone().sub(a), t=clamp(V3(p.x,a.y,p.z).sub(a).dot(ab)/ab.lengthSq(),0,1); const c=a.clone().addScaledVector(ab,t); return Math.hypot(p.x-c.x,p.z-c.z)<1.1; },fall:()=>{ const s=lv.spoon; tweenVal(v=>{ s.rotation.z=v*1.2; s.position.y=.85-v*.75; },0,1,.35,easeIn); }},
    {o:lv.thimble,home:{p:lv.thimble.position.clone(),r:lv.thimble.rotation.clone()},hit:(p)=>Math.hypot(p.x-lv.thimble.position.x,p.z-lv.thimble.position.z)<2.2,fall:()=>{ const s=lv.thimble; tweenVal(v=>{ s.rotation.x=v*Math.PI/2; s.position.y=v*1.4; s.position.z-=.05; },0,1,.4,easeIn); }},
    {o:lv.cap,home:{p:lv.cap.position.clone(),r:lv.cap.rotation.clone()},hit:(p)=>Math.hypot(p.x-lv.cap.position.x,p.z-lv.cap.position.z)<3.3,fall:()=>{ const s=lv.cap; tweenVal(v=>{ s.rotation.z=.08+Math.sin(v*20)*.08*(1-v); },0,1,1.2); }}];
  for(const n of lv.noisy){ n.o.position.copy(n.home.p); n.o.rotation.copy(n.home.r); n.done=false; }
}
/* places he can't see you from his chair */
function coverSpots(){ const n=TABLE.napkin, cu=TABLE.cup, po=TABLE.pot, ca=TABLE.candle, y=cageOf('you');
  return [{x:n.x+5.5,z:n.z+3.5,r:3.3},{x:-14,z:-.2,r:2.8},{x:cu.x,z:cu.z+5.6,r:2.8},{x:po.x,z:po.z+8.6,r:3},{x:ca.x,z:ca.z+4.6,r:2.4},{x:y.x,z:y.z,r:2.8}]; }
function tableTick(lv,dt,t){
  if(!NIGHT.on) return;
  const p=PLAYER.pos; NIGHT.hidden=coverSpots().some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r);
  let el=$('hideHud'); if(!el){ el=document.createElement('div'); el.id='hideHud'; el.style.cssText='position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:40;font:800 13px Nunito,system-ui;letter-spacing:.25em;color:#9fe0a0;text-shadow:0 1px 4px #000;pointer-events:none;transition:opacity .3s'; el.textContent='HIDDEN'; document.body.appendChild(el); }
  el.style.opacity=NIGHT.hidden?1:0;
  // knock into anything metal = noise = he wakes up
  if(NIGHT.alert===0&&PLAYER.ctl.move) for(const n of lv.noisy){ if(!n.done&&n.hit(p)){ n.done=true; n.fall(); later(.3,()=>{ SND.play('metal_'+randi(1,3),{vol:1,pos:n.o.position,ref:30,rate:.6}); later(.25,()=>SND.play('metal_'+randi(1,3),{vol:.8,pos:n.o.position,ref:30,rate:.5})); pigWakes(lv,n.o.position); }); break; } }
  if(NIGHT.alert===1){ NIGHT.alertT-=dt; if(NIGHT.alertT<=0){ NIGHT.alert=2; if(NIGHT.hidden){ pigSleeps(lv); } else { NIGHT.caught=true; } } }
}
function pigWakes(lv,at){ const P=lv.pig.userData.pig; NIGHT.alert=1; NIGHT.alertT=3.6; tweenVal(v=>{ P.sleep=v; },1,0,.7); P.look=at.clone(); P.lookSpeed=1.5; P.lookW=0;
  SND.play('pig_4',{vol:1,pos:V3(0,44,-40),ref:80,rate:.6}); chat(['n_wake']); toast('He heard that! HIDE!','#ff8a6a');
  later(1.6,()=>{ if(NIGHT.alert===1) P.look=V3(PLAYER.pos.x+rand(-6,6),0,PLAYER.pos.z+rand(-4,4)); }); }
function pigSleeps(lv){ const P=lv.pig.userData.pig; SND.play('pig_1',{vol:.8,pos:V3(0,44,-40),ref:80,rate:.55}); later(1.2,()=>{ P.look=null; tweenVal(v=>{ P.sleep=v; },0,1,1.5); NIGHT.alert=0; }); }
async function nightSneak(lv,goals){
  // goals: [{key,label,pos,item,obj}] -> pick up all, then go back and sleep
  NIGHT.on=true; NIGHT.alert=0; NIGHT.caught=false;
  const got=()=>goals.every(g=>g.got);
  const objText=()=>goals.filter(g=>!g.got).map(g=>g.label).join(' + ')||'Go back to your cage and sleep';
  for(const g of goals){ addInteract(lv,{pos:g.pos,reach:2.4,when:()=>!g.got&&NIGHT.alert===0,label:'Take the '+g.name.toLowerCase(),act:()=>{ g.got=true; const I=inv(); I[g.item]=(I[g.item]||0)+(g.n||1); if(g.obj) g.obj.visible=false; SND.play('pickup',{vol:.6}); toast(g.name,'#e0c08a'); invHUD(); objective(objText()); }}); }
  const yc=cageOf('you');
  for(;;){
    objective(objText()); freeWalk(); PLAYER.ctl.jump=false;
    await waitUntil(()=>NIGHT.caught||(got()&&Math.hypot(PLAYER.pos.x-yc.x,PLAYER.pos.z-yc.z)<2.6&&PLAYER.pos.z<yc.z+2.8));
    if(!NIGHT.caught) break;
    // he saw you: the collar
    const P=lv.pig.userData.pig; P.look=camera; SND.play('pig_2',{vol:1,pos:V3(0,44,-40),ref:80,rate:.55}); await wait(.6);
    await zapDown(); await wait(.8);
    youInCage(); PLAYER.eye=1.64; PLAYER.roll=0; resetNoisy(lv); NIGHT.alert=0; NIGHT.caught=false; blurScreen(0); pigSleeps(lv);
    await tweenVal(lids,1,0,1.2); await say(['n_caught']);
  }
  NIGHT.on=false; $('hideHud')&&($('hideHud').style.opacity=0);
}
SCENES.night1=async function(){
  const lv=await tableStart('night1','night'); const J=lv.jay2;
  playMusic('night',2); PLAYER.lock(); PLAYER.ctl.look=true;
  await dayCard('NIGHT 1');
  F.bentBar=true;
  lv.orrin.position.x=cageOf('orrin').x+2.5; faceTo(lv.orrin,PLAYER.pos); lv.orrin.userData.A.look='player';
  await say(['n1_1','n1_2','n1_3','n1_4','n1_5']); lv.orrin.userData.A.look=null;
  setPose(J,'sit',.5); J.userData.A.seated=true;
  const pl=TABLE.plate;
  if(!lv.boneBit){ lv.boneBit=makeLongBone(1.3,.09); lv.boneBit.rotation.set(Math.PI/2,0,.4); lv.scene.add(lv.boneBit); }
  lv.boneBit.position.set(pl.x+4.2,.86,pl.z+2.2); lv.boneBit.visible=true;
  if(!lv.thornPick){ lv.thornPick=mesh(GC('thornGeo',()=>{ const c=new THREE.ConeGeometry(.35,1.4,8); c.translate(0,.7,0); return c; }),new THREE.MeshPhysicalMaterial({color:col(0x8a4a2a),roughness:.4,clearcoat:.5}),0,0,0); lv.thornPick.rotation.z=Math.PI/2; lv.scene.add(lv.thornPick); }
  lv.thornPick.position.set(TABLE.pot.x-7.2,.35,TABLE.pot.z+3); lv.thornPick.visible=true;
  // the bread roll you can hide behind (by his plate)
  if(!lv.roll){ lv.roll=ell(5,3.2,4,(()=>{ const m=pbrMat('clay_plaster',1,{opts:{roughness:.85}}); m.color=col(0xc08848); return m; })(),-14,1.4,-5.5,28); lv.scene.add(lv.roll); colCircle(lv.col,-14,-5.5,4.6); }
  await nightSneak(lv,[{name:'Sharp bone',label:'Get a sharp bone from his plate',item:'bone',pos:lv.boneBit.position,obj:lv.boneBit},{name:'Thorn',label:'Get a thorn from under the plant',item:'thorn',pos:lv.thornPick.position,obj:lv.thornPick}]);
  PLAYER.lock(); await say(['n_back']); lv.inter.length=0; objective('');
  addInteract(lv,{pos:V3(cageOf('you').x+.2,.3,cageOf('you').z+.6),reach:2.4,label:'Sleep',act:()=>{ F.slept=1; }}); F.slept=0; freeWalk(); PLAYER.ctl.jump=false; objective('Sleep on your bedding');
  await waitUntil(()=>F.slept); lv.inter.length=0; objective('');
  runStory(()=>SCENES.day2());
};
/* ---------- DAY 2: Orrin's turn ---------- */
SCENES.day2=async function(){
  const lv=await tableStart('day2','day'); const J=lv.jay2, O=lv.orrin, A=TABLE.arena;
  playMusic('cage',2); PLAYER.lock(); PLAYER.ctl.look=true;
  await dayCard('DAY 2');
  const P=lv.pig.userData.pig; P.stop=true; P.look=V3(cageOf('orrin').x,0,cageOf('orrin').z); SND.play('pig_4',{vol:1,pos:V3(0,44,-40),ref:80,rate:.6});
  O.position.set(cageOf('orrin').x+2.5,0,cageOf('orrin').z-.5); faceTo(O,PLAYER.pos); O.userData.A.look='player';
  await say(['d2_1','d2_2','d2_3']);
  // his hand comes down (black), and Orrin is in the bowl with a thorn
  const fd=$('fade'); fd.style.transition='opacity .4s'; fd.style.opacity=1; SND.play('cage_lock',{vol:1,rate:.7}); await wait(1);
  O.position.set(A.x,.35,A.z+5); faceTo(O,V3(A.x,0,A.z)); O.userData.A.look=null;
  const spear=mesh(new THREE.ConeGeometry(.08,2.4,8),new THREE.MeshPhysicalMaterial({color:col(0x8a4a2a),roughness:.4}),0,0,0); spear.rotation.x=Math.PI/2; holdProp(O,spear,'R',V3(0,0,.6));
  const sp=makeBug('spider'); sp.position.set(A.x,.35,A.z-7); lv.scene.add(sp); const B=sp.userData.bug;
  const tk=dt=>{ animateBug(sp,dt,G.time); }; SCENE_TICKS.push(tk);
  P.stop=false; P.look=V3(A.x,0,A.z);
  lookAtPoint(V3(A.x,1,A.z),0); fd.style.transition='opacity .8s'; fd.style.opacity=0; playMusic('arena',1);
  // it circles him... he pokes it... it jumps
  const c0=performance.now(); let ang=-Math.PI/2;
  await tweenVal(k=>{ ang=-Math.PI/2+k*1.6; sp.position.set(A.x+Math.cos(ang)*6.5,.35,A.z+Math.sin(ang)*6.5); sp.rotation.y=Math.atan2(O.position.x-sp.position.x,O.position.z-sp.position.z); B.walkK=1; faceTo(O,sp.position); },0,1,4.5,k=>k);
  B.walkK=0; setPose(O,'point',.2); SND.play('swing_1',{vol:.8,pos:O.position,ref:10}); await wait(.25); bugHurt(sp); SND.play('bug_hurt',{vol:.9,pos:sp.position,ref:10,rate:.8}); await wait(.5); clearPose(O,.3);
  B.atk='leap'; await tweenVal(v=>{ B.atkK=v; },0,1,.9);
  const from=sp.position.clone(); SND.play('bug_3',{vol:1,pos:from,ref:10,rate:.8});
  await tweenVal(k=>{ B.air=Math.sin(k*Math.PI); sp.position.lerpVectors(from,V3(O.position.x,.35,O.position.z-1.4),k); sp.position.y=.35+Math.sin(k*Math.PI)*3; },0,1,.55,k=>k);
  B.air=0; SND.play('scream',{vol:1,pos:O.position,ref:12,rate:.9}); shake(.4); setPose(O,'startle',.1);
  // look away (Jay 2 can't watch either)
  setMood(J,'scared'); lookAtPoint(headOf(J),.35); await wait(.4); J.userData.A.look='player';
  await wait(2.2); O.visible=false; sp.visible=false; B.atk=null; B.atkK=0; stopMusic(2);
  SND.play('pig_squeal',{vol:1,pos:V3(0,44,-40),ref:80,rate:.75});
  await wait(1.5); playMusic('sad',3);
  lookAtPoint(V3(A.x,1,A.z),1.2); await wait(1.6);
  await say(['d2_4','d2_5','d2_6']); J.userData.A.look=null;
  SCENE_TICKS.splice(SCENE_TICKS.indexOf(tk),1); lv.scene.remove(sp);
  await wait(1.5);
  runStory(()=>SCENES.night2());
};
/* ---------- NIGHT 2: thread + pebbles, make the bone spear ---------- */
SCENES.night2=async function(){
  const lv=await tableStart('night2','night'); const J=lv.jay2;
  lv.orrin.visible=false;
  playMusic('night',2); PLAYER.lock(); PLAYER.ctl.look=true;
  await dayCard('NIGHT 2');
  F.bentBar=true; const I=inv(); if(!I.bone) I.bone=1; if(!I.thorn) I.thorn=1; invHUD();
  await say(['n2_1','n2_2','n2_3']); setPose(J,'sit',.5); J.userData.A.seated=true;
  const th=lv.threads[3]; th.visible=true;
  const pebs=lv.pebbles; for(const pb of pebs) pb.visible=true;
  await nightSneak(lv,[{name:'Thread',label:'Get a loose thread from the napkin',item:'thread',pos:V3(TABLE.napkin.x-7+3*2.1,.3,TABLE.napkin.z-8),obj:th},
    {name:'Pebbles',label:'Get pebbles by the pot',item:'pebbles',n:4,pos:V3(TABLE.pebbles.x,.3,TABLE.pebbles.z),obj:null}]);
  for(const pb of pebs.slice(0,4)) pb.visible=false;
  PLAYER.lock(); await say(['n_back','n2_craft']); lv.inter.length=0;
  const st=lv.stash; addInteract(lv,{pos:V3(st.x,.3,st.z),reach:2.4,when:()=>canCraft(),label:'Make a bone spear (thorn + bone + thread)',act:()=>{ craftSpear(); objective('Sleep on your bedding'); }});
  addInteract(lv,{pos:V3(cageOf('you').x+.2,.3,cageOf('you').z+.6),reach:2.4,when:()=>!canCraft(),label:'Sleep',act:()=>{ F.slept=2; }});
  freeWalk(); PLAYER.ctl.jump=false; objective('Make a weapon at your stash (back corner of your cage)');
  await waitUntil(()=>F.slept===2); lv.inter.length=0; objective('');
  runStory(()=>SCENES.mantis());
};
/* ---------- the fights ---------- */
async function dropInBowl(lv,kind){ const fd=$('fade'); fd.style.transition='opacity .4s'; fd.style.opacity=1; SND.play('cage_lock',{vol:1,rate:.7}); await wait(1.1);
  const bug=arenaFight(kind,lv.fightOpts||{}); fd.style.transition='opacity .6s'; fd.style.opacity=0; return bug; }
async function backToCage(lv,bug){ const fd=$('fade'); fd.style.transition='opacity .6s'; fd.style.opacity=1; await wait(1); if(bug) lv.scene.remove(bug); ARENA.bug=null; youInCage(); PLAYER.lock(); PLAYER.ctl.look=true; invHUD(); await wait(.4); fd.style.opacity=0; await wait(.8); }
SCENES.mantis=async function(){
  if(!F.inv) F.inv={bone:0,thorn:0,thread:0,pebbles:4,bspear:1};   // started from the chapter list: what you'd have made by now
  const lv=await tableStart('mantis','day'); const J=lv.jay2; lv.orrin.visible=false; lv.fightOpts={};
  PLAYER.lock(); PLAYER.ctl.look=true; playMusic('cage',2);
  await dayCard('DAY 3');
  const P=lv.pig.userData.pig; P.stop=true; P.look=camera; SND.play('pig_4',{vol:1,pos:V3(0,44,-40),ref:80,rate:.6}); await wait(1.2);
  J.userData.A.look='player'; chat(['d3_1']); await wait(.8);
  const bug=await dropInBowl(lv,'mantis'); unlock('mantis');
  await backToCage(lv,bug); await say(['d3_2','d3_3']); J.userData.A.look=null;
  runStory(()=>SCENES.spider());
};
SCENES.spider=async function(){
  if(!F.inv) F.inv={bone:0,thorn:0,thread:0,pebbles:4,bspear:1};   // started from the chapter list: what you'd have made by now
  const lv=await tableStart('spider','day'); const J=lv.jay2; lv.orrin.visible=false; lv.fightOpts={};
  PLAYER.lock(); PLAYER.ctl.look=true; playMusic('cage',2);
  await dayCard('DAY 4');
  const P=lv.pig.userData.pig; P.stop=true; P.look=camera; await wait(1);
  await say(['d4_1']);
  const bug=await dropInBowl(lv,'spider'); unlock('spiderWin');
  await backToCage(lv,bug); J.userData.A.look='player'; await say(['d4_2']); J.userData.A.look=null;
  runStory(()=>SCENES.scorpion());
};
SCENES.scorpion=async function(){
  if(!F.inv) F.inv={bone:0,thorn:0,thread:0,pebbles:4,bspear:1};   // started from the chapter list: what you'd have made by now
  const lv=await tableStart('scorpion','day'); const J=lv.jay2, A=TABLE.arena; lv.orrin.visible=false;
  PLAYER.lock(); PLAYER.ctl.look=true; playMusic('cage',2);
  await dayCard('DAY 5');
  const P=lv.pig.userData.pig; P.stop=true; P.look=camera; await wait(1);
  J.userData.A.look='player'; await say(['d5_1']); J.userData.A.look=null;
  // the half-way moment: his key falls in the sand, the scorpion grabs Jay 2
  lv.fightOpts={onHalf:async()=>{
    PLAYER.lock(); PLAYER.ctl.look=true; ARENA.paused=true;
    // everything happens right in front of you: the spot 5.5 m ahead (toward the middle of the bowl)
    const toMid=V3(A.x-PLAYER.pos.x,0,A.z-PLAYER.pos.z); if(toMid.lengthSq()<1) toMid.set(0,0,-1); toMid.normalize();
    const side=V3(-toMid.z,0,toMid.x);
    const front=PLAYER.pos.clone().addScaledVector(toMid,5.5); front.y=0;
    const key=keyMesh(); const kp=front.clone().addScaledVector(side,-2.6).addScaledVector(toMid,-1.5); key.position.set(kp.x,9,kp.z); lv.scene.add(key);
    SND.play('pig_squeal',{vol:1,pos:V3(0,44,-40),ref:80,rate:.8}); lookAtPoint(V3(kp.x,5,kp.z),.5);
    await tweenVal(k=>{ key.position.y=9-k*8.45; key.rotation.z=k*4; },0,1,.9,easeIn); SND.play('sand_fall',{vol:.8,pos:key.position,ref:8}); SND.play('metal_3',{vol:.6,pos:key.position,ref:8,rate:1.4});
    await say(['d5_2']);
    // the scorpion goes for Jay 2 and pins him to the wall
    const bug=ARENA.bug, B=bug.userData.bug; const pin=front.clone().addScaledVector(side,2.2); J.userData.arenaHold=true; J.userData.A.path=null;
    J.position.set(pin.x,.35,pin.z); bug.position.copy(pin).addScaledVector(toMid,3.6).addScaledVector(side,.6); bug.position.y=.35; bug.rotation.y=Math.atan2(J.position.x-bug.position.x,J.position.z-bug.position.z); faceTo(J,bug.position);
    B.atk='pincer'; B.atkK=1; B.strikeK=.6; setPose(J,'startle',.2); setMood(J,'scared'); lookAtPoint(V3(J.position.x,1.2,J.position.z),.5);
    chat(['d5_3']); await wait(.8);
    const r=await timedChoice([{text:'Save Jay 2'},{text:'Grab the key'}],6,1);
    if(r===0){ F.savedJay2=true; SND.play('blade_2',{vol:1}); bugHurt(bug); B.atk=null; B.atkK=0; B.strikeK=0; clearPose(J,.3);
      J.position.set(key.position.x+.8,.35,key.position.z+.8); await wait(.4); key.visible=false; SND.play('pickup',{vol:.8}); await say(['d5_s1']); remember('He'); }
    else { F.savedJay2=false; lookAtPoint(key.position,.3); key.visible=false; SND.play('pickup',{vol:.8});
      B.atk='sting'; await tweenVal(v=>{ B.atkK=v; },0,1,.5); B.strikeK=1; SND.play('blade_3',{vol:1,rate:.6}); SND.play('scream',{vol:.8,rate:1.15}); lookAtPoint(V3(J.position.x,1.2,J.position.z),.3);
      await collapse(J); await say(['d5_k1']); remember('He'); B.atk=null; B.atkK=0; B.strikeK=0; }
    F.key=true; ARENA.jay=F.savedJay2?J:null; J.userData.arenaHold=!F.savedJay2;
    lookAtPoint(bug.position.clone().add(V3(0,1,0)),.4); await wait(.5);
  }};
  // both of you in the bowl
  J.userData.A.look=null; const fd=$('fade');
  const fight=dropInBowl(lv,'scorpion');
  await wait(1.2); resetActor(J); J.position.set(A.x+5,.35,A.z+5); J.position.y=.35; ARENA.jay=J; J.userData.arenaHold=false;
  const bug=await fight; unlock('scorpionWin');
  ARENA.jay=null;
  // back in the cage, night, the key hidden in the straw
  fd.style.transition='opacity .6s'; fd.style.opacity=1; await wait(1); lv.scene.remove(bug); ARENA.bug=null;
  lv.setTime('night'); youInCage(); resetActor(J); const c=cageOf('you'); J.position.set(c.x+1.4,0,c.z+.5); faceTo(J,PLAYER.pos);
  if(!F.savedJay2){ setPose(J,'sit',0); J.userData.A.seated=true; }
  PLAYER.lock(); PLAYER.ctl.look=true; playMusic('night',2); fd.style.opacity=0; await wait(1);
  J.userData.A.look='player'; await say([F.savedJay2?'d5_e1':'d5_e2','d5_e3']);
  saveCheckpoint('scorpion'); const s=getSave()||{}; s.part2=true; writeSave(s); unlock('part2');
  await wait(1.5); fd.style.transition='opacity 1.5s'; fd.style.opacity=1; stopMusic(2); await wait(3);
  TITLE.show(false);
};
function keyMesh(){ const g=new THREE.Group(); const m=new THREE.MeshPhysicalMaterial({color:col(0xb8963a),metalness:1,roughness:.3});
  g.add(mesh(new THREE.TorusGeometry(.22,.06,8,18),m,0,0,0)); g.add(box(.08,.08,.9,m,0,0,.65)); g.add(box(.08,.22,.08,m,0,-.1,.95)); g.add(box(.08,.16,.08,m,0,-.07,.78)); g.scale.setScalar(.9); return g; }
/* the table forwards keys + clicks to the arena while you fight */
LEVELS.table.onKey=code=>arenaKey(code);
LEVELS.table.onPrimary=()=>ARENA.active?arenaAttack():false;
