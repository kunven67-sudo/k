/* ================================================================
   THE MINING TRAIN — runs the line (mine <-> the south end), stops at
   the station. Rob it (the caboose safe: Lucky's key or dynamite), ride
   it (an ore car to the mine), or stop it (the switch lever).
   Two Riders guard the caboose.
   ================================================================ */
const TRAIN={z:300,dir:-1,speed:0,max:12,stopT:0,g:null,cars:[],guards:[],stopped:0,ride:false};
function makeTrain(){ const lv=LEVELS.dust, R=DUST.rail; const g=new THREE.Group(); lv.scene.add(g); TRAIN.g=g;
  const iron=new THREE.MeshPhysicalMaterial({color:col(0x1e1c1a),metalness:1,roughness:.45}), red=new THREE.MeshPhysicalMaterial({color:col(0x6a1a14),roughness:.55,metalness:.3}), brass=new THREE.MeshPhysicalMaterial({color:col(0xb8903a),metalness:1,roughness:.3});
  const wood=pbrMat('rough_wood',1,{opts:{roughness:.85}}); wood.color=col(0x7a5030);
  const wheel=(x,z,r=.5)=>{ const w=cyl(r,r,.12,iron,x,r,z,18); w.rotation.z=Math.PI/2; return w; };
  // the locomotive (z = 0 is its front)
  const loco=new THREE.Group(); g.add(loco); const boiler=cyl(.85,.85,5,iron,0,2,-2.6,24); boiler.rotation.x=Math.PI/2; loco.add(boiler);
  loco.add(cyl(.3,.45,1.4,iron,0,3.4,-.8,14)); loco.add(cyl(.5,.3,.4,iron,0,4.2,-.8,14)); loco.add(cyl(.35,.35,.5,brass,0,3,-2.6,14));
  loco.add(box(2.4,2.6,2.4,red,0,2.3,-6)); loco.add(box(2.6,.15,2.8,iron,0,3.65,-6)); loco.add(box(2.4,.3,8,iron,0,.85,-3.6)); const cc=mesh(new THREE.ConeGeometry(1.1,1,4),iron,0,.8,.3); cc.rotation.set(Math.PI/2,Math.PI/4,0); loco.add(cc);
  for(const x of [-1,1]) for(const z of [-1,-2.6,-4.2]) loco.add(wheel(x*1.05,z,z===-4.2?.8:.55));
  lv.trainSmoke=loco; TRAIN.loco=loco;
  // two ore cars + the caboose
  for(let i=0;i<2;i++){ const c=new THREE.Group(); c.position.z=-9.5-i*6.2; c.add(box(2.4,1.4,5.2,iron,0,1.6,0)); c.add(box(2.2,.5,5,mat(0x3a3028,{roughness:1}),0,2.2,0)); for(const x of [-1,1]) for(const z of [-1.8,1.8]) c.add(wheel(x*1.05,z)); g.add(c); TRAIN.cars.push(c); }
  const cab=new THREE.Group(); cab.position.z=-23; cab.add(box(2.6,2.6,6,wood,0,2.2,0)); cab.add(box(2.8,.2,6.4,red,0,3.6,0)); cab.add(box(2.6,.3,7,iron,0,.85,0)); for(const x of [-1,1]) for(const z of [-2.2,2.2]) cab.add(wheel(x*1.05,z));
  const safe=box(.9,.9,.8,new THREE.MeshPhysicalMaterial({color:col(0x2a2a2e),metalness:1,roughness:.4}),0,1.45,1.8); cab.add(safe); TRAIN.safe=safe; g.add(cab); TRAIN.cab=cab;
  g.position.set(R.x,0,TRAIN.z); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  // the guards on the caboose
  for(let i=0;i<2;i++){ const h=makeRider({guard:null,onTrain:true,range:60,acc:.6}); h.userData.trainOff=V3(i?.8:-.8,1.0,-23+(i?-2.6:2.6)); TRAIN.guards.push(h); }
  addInteract(lv,{obj:safe,reach:2.2,label:()=>INV.keys.caboose?'Open the safe (caboose key)':'The safe (locked: a key... or dynamite)',when:()=>!F.safeOpen,act:()=>{ if(!INV.keys.caboose){ toast('Locked','#ff9a7a'); return; } openSafe(); }});
  addInteract(lv,{obj:TRAIN.cars[0],offset:V3(0,2.2,0),reach:3.2,label:'Ride in the ore car (to the mine)',when:()=>TRAIN.speed<1&&!TRAIN.ride,act:()=>rideTrain()});
  addInteract(lv,{obj:lv.lever,offset:V3(0,1,0),reach:2.4,label:'Throw the switch (stop the train)',when:()=>!TRAIN.stopped,act:()=>{ TRAIN.stopped=60; SND.play('metal_1',{vol:.8,rate:.7}); tweenVal(v=>lv.leverHandle.rotation.z=v,0,-.9,.4); toast('The train will brake and stop for a minute','#e8d0a0'); }});
  on('boom',at=>{ if(!F.safeOpen&&LV===lv&&at.distanceTo(safe.getWorldPosition(V3()))<4) openSafe(true); });
}
function openSafe(blown){ F.safeOpen=1; SND.play(blown?'metal_2':'door_creak',{vol:.8}); TRAIN.safe.rotation.y=blown?.4:0; if(giveItem('fuel')){ learn('fuel','The FUEL CELL was in the caboose safe'); } giveGold(4); for(const h of TRAIN.guards) if(!h.userData.dead){ h.userData.rider.state='attack'; } }
async function rideTrain(){ TRAIN.ride=true; PLAYER.lock(); PLAYER.ctl.look=true; const c=TRAIN.cars[0]; const fd=$('fade');
  toast('Riding to the mine...','#e8d0a0'); const follow=dt=>{ const p=c.getWorldPosition(V3()); PLAYER.pos.set(p.x,0,p.z); PLAYER.y=2.3; }; SCENE_TICKS.push(follow);
  TRAIN.dir=-1; TRAIN.stopT=0; await waitUntil(()=>TRAIN.g.position.z<DUST.mine.z+60||LOOP.dying); SCENE_TICKS.splice(SCENE_TICKS.indexOf(follow),1);
  fd.style.transition='opacity .4s'; fd.style.opacity=1; await wait(.5); setPlayer(DUST.mine.clone().add(V3(4,0,14)),Math.PI); PLAYER.y=LEVELS.dust.ground(PLAYER.pos.x,PLAYER.pos.z); fd.style.opacity=0; TRAIN.ride=false; freeWalk(); }
function trainTick(dt){ if(!TRAIN.g||LV!==LEVELS.dust) return; const R=DUST.rail, g=TRAIN.g;
  const st=DUST.station.z, nearSt=Math.abs(g.position.z-st)<2&&TRAIN.lastStop!==Math.sign(TRAIN.dir)*Math.round(DAY.hour);
  if(TRAIN.stopped>0){ TRAIN.stopped-=dt; TRAIN.speed=damp(TRAIN.speed,0,1.2,dt); if(TRAIN.stopped<=0) TRAIN.stopped=0; }
  else if(TRAIN.stopT>0){ TRAIN.stopT-=dt; TRAIN.speed=0; }
  else { if(nearSt){ TRAIN.stopT=30; TRAIN.lastStop=Math.sign(TRAIN.dir)*Math.round(DAY.hour); SND.play('bell_01',{vol:.6,pos:g.position,ref:40}); } TRAIN.speed=damp(TRAIN.speed,TRAIN.max,.6,dt); }
  g.position.z+=TRAIN.dir*TRAIN.speed*dt; if(g.position.z<R.z0+40){ TRAIN.dir=1; TRAIN.stopT=20; } if(g.position.z>R.z1-10){ TRAIN.dir=-1; TRAIN.stopT=20; }
  g.rotation.y=TRAIN.dir>0?Math.PI:0;
  g.position.y=LEVELS.dust.railY?LEVELS.dust.railY(g.position.z)*0:0;
  if(TRAIN.speed>1&&Math.random()<dt*14){ const p=TRAIN.loco.localToWorld(V3(0,4.6,-.8)); LV.soft.spawn(p.x,p.y,p.z,rand(-.4,.4),rand(1.5,3),rand(-.4,.4),rand(2,4),rand(.6,1.2),.32,.3,.28,.55,0,.5,3); }
  // the guards ride on the caboose
  for(const h of TRAIN.guards){ if(h.userData.dead) continue; const p=g.localToWorld(h.userData.trainOff.clone()); if(h.userData.rider.state!=='attack'||TRAIN.speed>.5){ h.position.copy(p); h.userData.A.path=null; } }
  // standing on the train = you move with it; in front of it = you get hit
  const dz=TRAIN.dir*TRAIN.speed*dt, onIt=Math.abs(PLAYER.pos.x-R.x)<1.3&&PLAYER.pos.z<Math.max(g.position.z,g.position.z-27*TRAIN.dir)&&PLAYER.pos.z>Math.min(g.position.z,g.position.z-27*TRAIN.dir);
  if(onIt&&PLAYER.y>1.2) PLAYER.pos.z+=dz;
  else if(onIt&&TRAIN.speed>3&&!TRAIN.ride) loopDie('train');
  // the whistle + chug
  TRAIN.chugT=(TRAIN.chugT||0)-dt*TRAIN.speed*.25; if(TRAIN.chugT<=0&&TRAIN.speed>.5){ TRAIN.chugT=1; SND.play('wind_gust_2',{vol:.18,pos:g.position,ref:30,rate:.5}); } }
on('tick',dt=>trainTick(dt));
