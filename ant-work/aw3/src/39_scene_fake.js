/* ================================================================
   THE FAKE WORLD — Steve + Alex's chair. 5 days at Jim's stand: ants
   come for the food, you squish them (click). Customers you've never
   seen. Glitches: small on day 1, huge on day 5 (people repeat, ants act
   wrong, Jim knows too much, the world breaks). Jay 2 shows up on day 3
   ("two Jays!"), and from then your BARE wrist buzzes (the real watch,
   on their table, calling you). Day 5: you both touch the big glitch.
   ================================================================ */
CHECKPOINTS.push({id:'fake1',name:'Day 1?',level:'stand'},{id:'fake3',name:'Day 3?',level:'stand'},{id:'fake5',name:'Day 5?',level:'stand'});
const STAND={table:V3(0,0,0), food:V3(0,1.02,0), w:3.2, d:1.4};
defineLevel('stand',{
  title:"Jim's stand",
  env:{fx:{exposure:1.12,saturation:1.15,contrast:1.04,temp:.06,bloomStrength:.25,bloomThreshold:1.2,aoRadius:.5,vignette:.3},music:null,reverb:.1,surface:'grass',far:600,speed:3.3},
  async build(scene,lv){
    const sunDir=V3(.4,.8,.3); const sky=makeSky({top:0x3a78d0,mid:0x8ab8f0,horizon:0xe8eef0,bottom:0x6a7a50,sunDir,sunColor:0xfff4dc}); scene.add(sky); lv.sky=sky;
    lv.rig=makeRig(scene,{sun:2.6,sunColor:0xfff0d8,hemi:.55,sky:0x9cc4ff,ground:0x5a6a3a,dir:sunDir,span:18,dist:60,far:140});
    const grass=new THREE.MeshStandardMaterial({color:col(0x5a8a3a),roughness:.95,map:canvasTex(256,256,(c,w,h)=>{ c.fillStyle='#5a8a3a'; c.fillRect(0,0,w,h); for(let i=0;i<9000;i++){ c.strokeStyle=pick(['#4a7a2a','#6a9a4a','#3a6a2a','#7aaa5a']); c.beginPath(); const x=Math.random()*w,y=Math.random()*h; c.moveTo(x,y); c.lineTo(x+rand(-1,1),y-rand(2,6)); c.stroke(); } },[40,40])});
    const gr=mesh(new THREE.PlaneGeometry(400,400),grass,0,0,0,false); gr.rotation.x=-Math.PI/2; gr.receiveShadow=true; scene.add(gr); lv.groundM=gr;
    const road=texPlane(400,10,'stone_tiles_02',30,0,.02,9,{}); road.material.color=col(0x6a6a6a); scene.add(road); lv.road=road;
    const W=pbrMat('rough_wood',1,{opts:{roughness:.8}}); W.color=col(0x9a7048);
    // the stand: counter table, posts, a striped awning, a sign
    const st=new THREE.Group(); scene.add(st); lv.standG=st;
    st.add(box(STAND.w,.06,STAND.d,W,0,1,0)); for(const [x,z] of [[-1.5,-.6],[1.5,-.6],[-1.5,.6],[1.5,.6]]) st.add(cyl(.05,.05,1,W,x,.5,z,8));
    for(const x of [-1.6,1.6]) for(const z of [-.7,.7]) st.add(cyl(.05,.05,2.5,W,x,1.25,z,8));
    st.add(mesh(new THREE.PlaneGeometry(3.6,1.8),new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.9,map:canvasTex(256,128,(c,w,h)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#f2ece0':'#c8302a'; c.fillRect(i*w/8,0,w/8,h); } })}),0,2.55,0,false)).rotation.x=-Math.PI/2+.12;
    const sign=mesh(new THREE.PlaneGeometry(1.6,.4),new THREE.MeshStandardMaterial({roughness:.8,map:canvasTex(256,64,(c,w,h)=>{ c.fillStyle='#f2e6c8'; c.fillRect(0,0,w,h); c.fillStyle='#5a2a14'; c.font='bold 40px Georgia'; c.fillText("JIM'S",68,46); })}),0,2.25,-.75,false); sign.rotation.y=Math.PI; st.add(sign);
    // the food: a plate of sandwiches and a bowl of fruit in the middle (what the ants want)
    const plate=cyl(.22,.2,.02,new THREE.MeshPhysicalMaterial({color:col(0xf0eee8),roughness:.2,clearcoat:.8}),0,1.04,0,24); st.add(plate);
    const bread=new THREE.MeshStandardMaterial({color:col(0xd8b878),roughness:.9}), fill=new THREE.MeshStandardMaterial({color:col(0x8a4a3a),roughness:.8});
    for(let i=0;i<4;i++){ const s=new THREE.Group(); s.position.set(-.1+(i%2)*.18,1.07+Math.floor(i/2)*.05,-.06+Math.floor(i/2)*.09); s.rotation.y=i; s.add(box(.12,.015,.12,bread,0,0,0)); s.add(box(.11,.015,.11,fill,0,.015,0)); s.add(box(.12,.015,.12,bread,0,.03,0)); st.add(s); }
    // houses up and down the road (a town you don't quite remember)
    for(let i=0;i<10;i++){ const x=-70+i*15, z=i%2?24:-22; const h=rand(4,7); const hm=new THREE.MeshStandardMaterial({color:col(pick([0xd8c8a8,0xb8c8d8,0xd8b0a0,0xc8d8b0])),roughness:.9}); const hs=box(8,h,7,hm,x,h/2,z); scene.add(hs); const rf=mesh(new THREE.ConeGeometry(6.2,3,4),new THREE.MeshStandardMaterial({color:col(0x6a3a2a),roughness:.8}),x,h+1.5,z); rf.rotation.y=Math.PI/4; scene.add(rf); (lv.houses||(lv.houses=[])).push(hs,rf); }
    for(let i=0;i<16;i++){ const x=rand(-90,90), z=pick([-1,1])*rand(30,60); scene.add(cyl(.2,.3,3,new THREE.MeshStandardMaterial({color:col(0x5a3a22)}),x,1.5,z,8)); scene.add(sph(rand(1.6,2.4),new THREE.MeshStandardMaterial({color:col(0x3a6a2a),roughness:.9}),x,3.8,z,12,10)); }
    // the big glitch (day 5): a tear in the world, black + purple, jagged
    lv.glitch=mesh(new THREE.PlaneGeometry(2.4,3.4,12,16),new THREE.MeshBasicMaterial({color:col(0x2a0a3a),side:THREE.DoubleSide,transparent:true,opacity:.95}),0,1.7,6,false); { const a=lv.glitch.geometry.attributes.position; for(let i=0;i<a.count;i++){ a.setX(i,a.getX(i)*(.4+Math.abs(Math.sin(a.getY(i)*3))*.8)); a.setZ(i,rand(-.15,.15)); } }
    lv.glitch.visible=false; scene.add(lv.glitch); lv.glitchL=new THREE.PointLight(col(0xb050ff),0,10,2); lv.glitchL.position.set(0,1.7,5.5); scene.add(lv.glitchL);
    lv.ground=()=>0; lv.surfaceAt=()=>'grass'; lv.col.bounds=[-14,14,-6,14]; colBoxC(lv.col,0,0,STAND.w,STAND.d);
  },
  enter(){ FX.sunWorld=V3(.4,.8,.3).multiplyScalar(3000); setAmbience([]); },
  update(dt,t){ const lv=this; if(lv.glitch&&lv.glitch.visible){ lv.glitch.rotation.y=Math.sin(t*1.3)*.2; lv.glitch.material.color.setHSL(.78,.8,.08+Math.abs(Math.sin(t*7))*.12); lv.glitchL.intensity=2+Math.sin(t*9)*1.2; } if(typeof fakeTick==='function') fakeTick(lv,dt,t); }
});
/* ---------- squishing ants on the table ---------- */
const FAKE={ants:[],reached:0,day:1,on:false,glitch:0,pool:[]};
function clearFakeAnts(){ for(const A of FAKE.ants){ A.o.parent&&A.o.parent.remove(A.o); FAKE.pool.push(A.o); } FAKE.ants=[]; }
function spawnFakeAnt(lv,o={}){ const a=FAKE.pool.pop()||makeAnt(); a.scale.setScalar(.025); a.visible=true; a.userData.bug.dead=0; const side=Math.random()*4|0; const hw=STAND.w/2-.05, hd=STAND.d/2-.05;
  const p=side===0?V3(-hw,1.03,rand(-hd,hd)):side===1?V3(hw,1.03,rand(-hd,hd)):side===2?V3(rand(-hw,hw),1.03,-hd):V3(rand(-hw,hw),1.03,hd);
  a.position.copy(p); lv.scene.add(a); const A={o:a,sp:rand(.06,.1)*(o.fast?1.5:1),back:!!o.back,frozen:0,dead:false}; FAKE.ants.push(A); return A; }
function fakeTick(lv,dt,t){
  if(!FAKE.on) return;
  for(const A of FAKE.ants){ if(A.dead) continue; const a=A.o; animateBug(a,dt,t); a.userData.bug.walkK=A.frozen>0?0:1;
    if(A.frozen>0){ A.frozen-=dt; a.position.y=1.03+Math.sin(t*20)*.002+.04; continue; } a.position.y=1.03;
    const to=V3(STAND.food.x-a.position.x,0,STAND.food.z-a.position.z), d=to.length();
    if(d<.2){ A.dead=true; a.visible=false; FAKE.reached++; SND.play('bite',{vol:.3,rate:2}); continue; }
    const dir=to.normalize(); a.rotation.y=Math.atan2(dir.x,dir.z)+(A.back?Math.PI:0); a.position.addScaledVector(dir,A.sp*dt); }
  // wrist buzz (day 3+): the real watch is calling you
  if(FAKE.day>=3){ FAKE.buzzT=(FAKE.buzzT||rand(6,10))-dt; if(FAKE.buzzT<=0){ FAKE.buzzT=rand(7,12); SND.play('watch_beep',{vol:.25,rate:.5}); shake(.08); PLAYER.watchLook=.6; later(.6,()=>PLAYER.watchLook=0); if(!FAKE.buzzToast){ FAKE.buzzToast=1; toast('Your wrist buzzes... but there\'s no watch on it','#cfc2aa'); } } }
  // glitches grow day by day
  FAKE.gT=(FAKE.gT||3)-dt; if(FAKE.gT<=0){ FAKE.gT=rand(Math.max(1.5,9-FAKE.day*1.6),Math.max(3,14-FAKE.day*2)); glitchFx(lv,FAKE.day); }
}
function glitchFx(lv,day){ const k=day/5;
  flashWhite(.1+k*.3,.08); FX.aberr=.003+k*.04; later(.12+k*.2,()=>FX.aberr=.003); SND.play('static',{vol:.1+k*.4,rate:rand(.8,1.4)});
  if(day>=2&&FAKE.ants.length){ const A=pick(FAKE.ants.filter(a=>!a.dead)); if(A) A.frozen=1.2; }
  if(day>=4){ lv.sky.visible=Math.random()<.5?false:true; later(.2,()=>lv.sky.visible=true); }
  if(day>=5){ for(const h of lv.houses||[]) if(Math.random()<.3) h.visible=!h.visible; lv.road.visible=Math.random()<.7; }
}
LEVELS.stand.onPrimary=()=>{ if(!FAKE.on) return false; const dir=camera.getWorldDirection(V3()), o=camera.position; let best=null, bd=.09;
  for(const A of FAKE.ants){ if(A.dead) continue; const p=A.o.position.clone().sub(o); const along=p.dot(dir); if(along<.2||along>3.2) continue; const perp=p.clone().addScaledVector(dir,-along).length(); if(perp<bd){ bd=perp; best=A; } }
  VM.punchT=.28;
  if(best){ best.dead=true; best.o.scale.y=.004; const bo=best.o; later(1.5,()=>bo.visible=false); SND.play('punch_'+randi(1,3),{vol:.35,rate:1.8}); SND.play('chew_1',{vol:.3,rate:2.4}); }
  else SND.play('punch_1',{vol:.2,rate:1.6});
  return true; };
async function fakeShift(lv,n,o={}){
  clearFakeAnts(); FAKE.reached=0; FAKE.on=true;
  for(;;){ let spawned=0; objective('Squish the ants before they get to the food (click). '+n+' coming.');
    while(spawned<n){ spawnFakeAnt(lv,{back:o.back&&Math.random()<.4,fast:o.fast}); spawned++; await wait(rand(1.1,2.2)); if(FAKE.reached>=3) break; }
    await waitUntil(()=>FAKE.reached>=3||FAKE.ants.every(a=>a.dead));
    if(FAKE.reached<3) break;
    FAKE.on=false; await say(['f_fail']); clearFakeAnts(); FAKE.reached=0; FAKE.on=true; }
  FAKE.on=false; objective(''); clearFakeAnts();
}
function fakePeople(lv){ if(!lv.jim){ const mk=(fn,o)=>{ const h=fn(o); h.userData.level='stand'; lv.scene.add(h); return h; };
    lv.jim=mk(makeJim,{}); lv.jay2=mk(makeJay2,{}); giveWatch(lv.jay2); lv.jay2.userData.watch&&(lv.jay2.userData.watch.visible=false);
    lv.cust=[mk(makeHuman,{name:'Customer',voice:'Bram',skin:0xc89070,shirt:0x6a2a6a,hairStyle:'short',hair:0x4a3020,seed:91}),mk(makeHuman,{name:'Customer',voice:'Teo',skin:0xe0b090,shirt:0x2a6a6a,hairStyle:'spiky',hair:0x8a6a3a,seed:92}),mk(makeHuman,{name:'Customer',voice:'Orrin',skin:0xd8a888,shirt:0x7a6a2a,hairStyle:'bald',beard:true,seed:93})]; }
  resetActor(lv.jim); lv.jim.position.set(-1.2,0,-1.3); faceTo(lv.jim,V3(0,1,3)); lv.jay2.visible=false; for(const c of lv.cust){ resetActor(c); c.visible=false; } return lv; }
async function customer(lv,i,ids,repeat){ const c=lv.cust[i%lv.cust.length]; c.visible=true; resetActor(c); c.position.set(-12,0,9); await walkTo(c,[V3(-1,0,5),V3(0,0,2.2)],1.4); faceTo(c,PLAYER.pos); c.userData.A.look='player';
  for(let k=0;k<(repeat?2:1);k++){ await say(ids); if(repeat&&k===0){ await wait(.4); SND.play('static',{vol:.3}); flashWhite(.15,.06); } }
  c.userData.A.look=null; await walkTo(c,[V3(4,0,6),V3(14,0,9)],1.4); c.visible=false; }
async function fakeDay(lv,day){
  FAKE.day=day; const J=lv.jay2, Jim=lv.jim, fd=$('fade');
  setPlayer(V3(0,0,1.4),0); PLAYER.eye=1.64; await dayCard('DAY '+day); fd.style.opacity=0; playMusic('desert',2);
  Jim.userData.A.look='player'; await say(['fj_'+day]); Jim.userData.A.look=null;
  if(day===3){ J.visible=true; resetActor(J); J.position.set(-10,0,8); await walkTo(J,[V3(1.6,0,1.6)],1.4); faceTo(J,PLAYER.pos); J.userData.A.look='player'; Jim.userData.A.look='player'; await say(['fj_3b','fj_3c','fj_3d']); J.userData.A.look=null; Jim.userData.A.look=null; }
  if(day>3){ J.visible=true; resetActor(J); J.position.set(1.6,0,1.6); faceTo(J,V3(0,1,0)); }
  freeWalk(); PLAYER.ctl.jump=false;
  await customer(lv,day,['fc_'+Math.min(day,4)],day>=2);
  await fakeShift(lv,6+day*2,{back:day>=4,fast:day>=3});
  if(day===4){ Jim.userData.A.look='player'; await say(['fj_4b']); Jim.userData.A.look=null; if(J.visible){ J.userData.A.look='player'; await say(['fj_4c']); J.userData.A.look=null; } }
  await wait(.8); fd.style.transition='opacity 1s'; fd.style.opacity=1; stopMusic(1); await wait(1.2);
}
SCENES.fake1=async function(){ const lv=LEVELS.stand, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1; if(LV!==lv) await enterLevel('stand',{pos:V3(0,0,1.4)}); saveCheckpoint('fake1'); fakePeople(lv); setVM(true); hudVisible(true); PLAYER.hasWatch=false;
  await fakeDay(lv,1); await fakeDay(lv,2); saveCheckpoint('fake3'); await fakeDay(lv,3); await fakeDay(lv,4); saveCheckpoint('fake5'); await fakeLast(lv); };
SCENES.fake3=async function(){ const lv=LEVELS.stand, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1; if(LV!==lv) await enterLevel('stand',{pos:V3(0,0,1.4)}); saveCheckpoint('fake3'); fakePeople(lv); setVM(true); PLAYER.hasWatch=false; await fakeDay(lv,3); await fakeDay(lv,4); saveCheckpoint('fake5'); await fakeLast(lv); };
SCENES.fake5=async function(){ const lv=LEVELS.stand, fd=$('fade'); fd.style.transition='none'; fd.style.opacity=1; if(LV!==lv) await enterLevel('stand',{pos:V3(0,0,1.4)}); saveCheckpoint('fake5'); fakePeople(lv); setVM(true); PLAYER.hasWatch=false; await fakeLast(lv); };
async function fakeLast(lv){
  FAKE.day=5; const J=lv.jay2, Jim=lv.jim, fd=$('fade'); setPlayer(V3(0,0,1.4),0); await dayCard('DAY 5'); fd.style.opacity=0; playMusic('desert',2);
  J.visible=true; resetActor(J); J.position.set(1.6,0,1.6);
  FAKE.on=true; FAKE.ants=[]; // the world is breaking
  Jim.userData.A.look='player'; await say(['fj_5']); SND.play('static',{vol:.6}); Jim.userData.A.look=null; Jim.userData.A.idleOff=true;   // frozen mid-sentence
  await wait(1); glitchFx(lv,5); stopMusic(.5);
  lv.glitch.visible=true; SND.play('hum_purple',{vol:.8}); J.userData.A.look='player'; await say(['fj_5b','fj_5c']); J.userData.A.look=null;
  freeWalk(); PLAYER.ctl.jump=false; objective('Touch the glitch. Together.');
  walkTo(J,[V3(.8,0,5.4)],1.2);
  await waitUntil(()=>Math.hypot(PLAYER.pos.x-lv.glitch.position.x,PLAYER.pos.z-lv.glitch.position.z)<1.6);
  FAKE.on=false; PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(lv.glitch.position,.4); setPose(J,'holdOut',.3);
  SND.play('blast',{vol:.8}); flashWhite(1,.2); shake(.8); const wh=$('fxWhite'); wh.style.transition='opacity .1s'; wh.style.opacity=1; await wait(1);
  lv.glitch.visible=false; for(const h of lv.houses||[]) h.visible=true; lv.road.visible=true; lv.sky.visible=true; Jim.userData.A.idleOff=false; wh.style.opacity=0;
  unlock('twoJays'); runStory(()=>SCENES.wake());
}
