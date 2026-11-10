/* ================================================================
   PART 1 · THE DOME SWEET DOME — right where Ant Work 2 ended.
   Face to face with the other you. Things to say (said = gray),
   or one mean line that starts a fight. Then the hum, the light,
   and the wall.
   ================================================================ */
const HOUSE={a:3.55};
const MOODS={c_who_r1:'worried',c_who_r2:'worried',c_who_r4:'neutral',c_jim_r1:'neutral',c_jim_r2:'smirk',c_jim_r4:'tired',c_clone_r1:'sad',c_clone_r2:'angry',
  c_blocks_ask_r1:'sad',c_blocks_ask_r2:'tired',c_blocks_ask_r3:'angry',c_blocks_my_r1:'neutral',c_blocks_my_r2:'smirk',c_blocks_my_r4:'sad',
  c_story_tiny_r1:'tired',c_story_tiny_r2:'sad',c_story_mars_r1:'tired',c_story_mars_r2:'sad',c_mean_r1:'angry',c_mean_r3:'angry',c_done_1:'worried',c_done_2:'neutral',
  f_hum_1:'shock',f_hum_3:'worried',f_light:'shock'};
const LM=id=>L(id,MOODS[id]?{mood:MOODS[id]}:{});
SCENES.house=async function(){
  const lv=LEVELS.bighouse; saveCheckpoint('house');
  stopMusic(0); setAmbience([['alienHome',.02]]); lv.setNight&&lv.setNight(false);
  const youBlocky=F.ending==='mars';
  if(!lv.j2h){ lv.j2h=makeJay({name:'Jay 2',voice:'Jay2'}); lv.j2h.userData.level='bighouse'; lv.scene.add(lv.j2h); giveWatch(lv.j2h); }
  if(!lv.j2b){ lv.j2b=makeBlockJay(); lv.j2b.userData.level='bighouse'; lv.scene.add(lv.j2b); }
  const J=youBlocky?lv.j2h:lv.j2b; (youBlocky?lv.j2b:lv.j2h).visible=false; resetActor(J); CUR.j2=J;
  if(J.userData.nose) J.userData.nose.visible=false;
  setVMBlocky(youBlocky);
  const AX=V3(Math.sin(HOUSE.a),0,Math.cos(HOUSE.a)), C0=V3(0,0,0);
  const youP=C0.clone().addScaledVector(AX,1.15), j2P=C0.clone().addScaledVector(AX,-1.15);
  J.position.copy(j2P); faceTo(J,youP); J.userData.A.look='player';
  setPlayer(youP,yawTo(youP,j2P),-.06);
  lookOnly(); crosshair(false);
  if(J.userData.J) setMood(J,'shock');
  lv.lights=lv.lights||(()=>{ const a=[]; lv.scene.traverse(o=>{ if(o.isLight&&!o.isHemisphereLight&&!o.isDirectionalLight) a.push({l:o,base:o.intensity}); }); return a; })();
  for(const x of lv.lights) x.l.intensity=x.base;
  await wait(.7);
  unlock('meet');
  await say([L('ayme',{auto:.7})]);
  if(J.userData.J) setMood(J,'worried');
  // ---- things to say ----
  const tiny=F.ending==='tiny';
  const opts=[
    {k:'who',ids:['c_who','c_who_r1','c_who_r2','c_who_r3','c_who_r4']},
    {k:'jim',ids:['c_jim','c_jim_r1','c_jim_r2','c_jim_r3','c_jim_r4']},
    {k:'clone',ids:['c_clone','c_clone_r1','c_clone_r2','c_clone_r3']},
    {k:'blocks',ids:tiny?['c_blocks_ask','c_blocks_ask_r1','c_blocks_ask_r2','c_blocks_ask_r3']:['c_blocks_my','c_blocks_my_r1','c_blocks_my_r2','c_blocks_my_r3','c_blocks_my_r4']},
    {k:'story',ids:tiny?['c_story_tiny','c_story_tiny_r1','c_story_tiny_r2','c_story_tiny_r3']:['c_story_mars','c_story_mars_r1','c_story_mars_r2','c_story_mars_r3']},
    {k:'mean',kind:'fight',ids:['c_mean','c_mean_r1','c_mean_r2','c_mean_r3']}
  ];
  let fight=false;
  while(opts.some(o=>!o.used&&o.k!=='mean')){
    const pick=await choose(opts.map(o=>({text:'“'+L(o.ids[0]).text+'”',used:o.used,kind:o.kind,ref:o})),{lead:'SAY SOMETHING'});
    const o=pick.ref; o.used=true; trophyStat('lines');
    await say(o.ids.map(LM));
    if(o.k==='mean'){ fight=true; break; }
    await wait(.25);
  }
  if(!fight){ unlock('talker'); await say([LM('c_done_1')]); }
  else {
    F.fought=true;
    // close the gap... fists up
    const yNear=C0.clone().addScaledVector(AX,.62), jNear=C0.clone().addScaledVector(AX,-.58);
    walkTo(J,[jNear],1.3); await autoWalk([yNear],1.1);
    PLAYER.lookTo=null; lookAtPoint(headOf(J).add(V3(0,-.05,0)),.35);
    const fightDone=runFight(J);
    await wait(15); humStart();
    await wait(13.5); FIGHT.stopReq=true; await fightDone;
    endFight(); unlock('fighter'); if(!FIGHT.gotHit&&FIGHT.swings>=4) unlock('perfect');
    stopMusic(1.2);
    // break apart, holding their heads
    if(J.userData.J){ setPose(J,'holdHead',.3); setMood(J,'shock'); }
    walkTo(J,[j2P],1.1); await autoWalk([youP],.9);
    if(J.userData.J) clearPose(J,.5);
  }
  await humAndLight(lv,J,AX,youP,j2P,fight);
};
/* the sound that builds up, like something is about to blow */
function humStart(){ if(STORY.buildH) return; STORY.buildH=SND.play('hum_build',{vol:.95,fadeIn:1.5}); STORY.humT0=G.time; }
async function humAndLight(lv,J,AX,youP,j2P,fought){
  const side=V3(Math.cos(HOUSE.a),0,-Math.sin(HOUSE.a));   // across the line between you two
  const C=side.multiplyScalar(-.85).setY(1.45);
  humStart(); if(!fought) await say([LM('c_done_2')]);
  // the room shakes a little more every second, the lights flicker
  const t0=STORY.humT0;
  SCENE_TICKS.push(dt=>{ const k=clamp((G.time-t0)/14,0,1); if(Math.random()<dt*8) shake(.02+k*.09);
    for(const x of lv.lights) x.l.intensity=x.base*(1-k*.6*Math.max(0,noise1(G.time*9+x.base)));
    if(Math.random()<dt*k*6) lv.soft.spawn(rand(-4,4),rand(3.5,5),rand(-4,4),0,-rand(.2,.5),0,rand(2,3),rand(.02,.05),.8,.75,.7,.5,-1,.5,0); });
  J.userData.A.look=C; lookAtPoint(C,1.4);
  await say([LM('f_hum_1'),L('f_hum_2'),LM('f_hum_3')]);
  // a white-purple point of light, right in the middle of the room
  const orb=new THREE.Group(); orb.position.copy(C); lv.scene.add(orb); STORY.orb=orb;
  const core=mesh(new THREE.SphereGeometry(.06,20,14),new THREE.MeshBasicMaterial({color:col(0xffffff).multiplyScalar(8)}),0,0,0,false); orb.add(core);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(128,128,(x,w,h)=>{ const g=x.createRadialGradient(64,64,2,64,64,64); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.25,'rgba(230,200,255,.75)'); g.addColorStop(.6,'rgba(170,110,255,.25)'); g.addColorStop(1,'rgba(120,60,255,0)'); x.fillStyle=g; x.fillRect(0,0,w,h); }),color:col(0xffffff).multiplyScalar(3),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  halo.scale.setScalar(.4); orb.add(halo);
  const pl=new THREE.PointLight(col(0xe6d0ff),0,30,1.4); orb.add(pl);
  tweenVal(v=>{ orb.scale.setScalar(v); pl.intensity=v*6; },.05,1,2.6,easeIn);
  SCENE_TICKS.push(dt=>{ core.scale.setScalar(1+Math.sin(G.time*30)*.15); halo.material.rotation+=dt*2; if(Math.random()<dt*20) lv.glow.spawn(C.x+rand(-.1,.1),C.y+rand(-.1,.1),C.z+rand(-.1,.1),rand(-2,2),rand(-2,2),rand(-2,2),rand(.2,.5),rand(.01,.03),.9,.8,1,1,0,1,0); });
  if(J.userData.J){ setMood(J,'shock'); setPose(J,'startle',.3); }
  await wait(2.2);
  await say([LM('f_light',{auto:.02})]);
  await blast(lv,J,AX,youP,j2P,C,orb);
}
/* blown back toward the wall in slow motion... white, right before you hit it */
async function blast(lv,J,AX,youP,j2P,C,orb){
  if(STORY.buildH){ STORY.buildH.stop(.05); STORY.buildH=null; }
  SND.play('blast',{vol:1}); flashWhite(.85,.6); shake(1.3);
  stopMusic(0); setAmbience([],.2);
  SLOWMO.k=.3; SLOWMO.target=.2;
  FX.aberr=.006; FX.bloomStrength=1.1;
  fxBurst(C,{color:0xe8d0ff,count:90,speed:9,size:.03,life:2.2,grav:0,add:true,bright:2});
  fxBurst(C,{color:0xc8b8a8,count:60,speed:5,size:.05,life:2.5,grav:-2,spread:.6});
  // how far until the dome wall behind you
  const R=8.9; const b=youP.dot(AX), c=youP.lengthSq()-R*R; const sMax=-b+Math.sqrt(b*b-c);
  const start=camera.position.clone();
  const hd=()=>headOf(J);
  camFollow((t)=>{ const k=Math.min(1,t/1.35); const e=1-Math.pow(1-k,1.7); const p=start.clone().addScaledVector(AX,e*sMax); p.y+=Math.sin(k*Math.PI)*.45-k*.25;
    return {pos:p,look:C.clone().lerp(hd(),.35),fov:SETTINGS.fov+14*k}; });
  // Jay 2 flies the other way
  if(J.userData.J){ setPose(J,'flail',.12); setMood(J,'shock'); } else J.userData.A.custom=(P,t)=>{ P.armL.rotation.x=-2.6+Math.sin(t*6)*.4; P.armR.rotation.x=-2.4+Math.cos(t*6)*.4; P.headJ.rotation.x=-.4; };
  J.userData.A.look=null; const jp0=J.position.clone();
  tweenVal(v=>{ J.position.copy(jp0).addScaledVector(AX,-v*sMax*.92); J.position.y=Math.sin(v*Math.PI)*.5; J.rotation.x=-v*.5; },0,1,1.35,v=>1-Math.pow(1-v,1.7));
  tweenVal(v=>{ orb.scale.setScalar(v); },1,3.2,.9,easeOut);
  await wait(1.12);
  SND.play('ringing',{vol:.55});
  const W=$('fxWhite'); W.style.transition='opacity .35s ease-in'; W.style.opacity=1;
  await wait(.12); SLOWMO.target=1;
  await new Promise(r=>setTimeout(r,1300));
  unlock('light');
  if(orb.parent) orb.parent.remove(orb);
  J.rotation.x=0;
  startAt('desert',F);
}
