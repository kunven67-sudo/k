/* ================================================================
   DRIVE — it's YOUR car, so YOU drive. First person from the driver's
   seat, your own hands on the wheel (they turn with it), Jim riding
   next to you. W = gas, S = brake, A / D = steer. Oncoming traffic,
   a whole neighborhood (two rows of houses, driveways with cars, trees,
   hills on the horizon, sunset haze) so it's never an empty void.
   Drive to the end of the street = Jim's stand.
   ================================================================ */
const DRIVE_END=360;   // (the first-person "you drive" code below is not used: Jim drives his own car)
defineLevel('drive',{
  title:'the drive',
  env:{fx:{exposure:1.0,temp:.2,saturation:1.1,contrast:1.08,bloomStrength:.2,bloomThreshold:1.5,mblurStrength:1.0},music:'drive',reverb:.05,amb:[['road',.1],['engine',.05]],far:1400},
  async build(scene,lv){
    const sunDir=V3(-.2,.12,-1).normalize();
    const sky=makeSky({top:0x2a3a78,mid:0x7a78b8,horizon:0xff9a58,bottom:0x3a3040,sunDir,sunColor:0xffb070,sunSize:.9992,sunGlow:1.6,clouds:.6,cloudColor:0xffc0a0,cloudShade:0x5a4a7a});
    scene.add(sky); lv.skyU=sky.userData.u; lv.envMap=envFromSky(sky);
    scene.fog=new THREE.Fog(col(0xc89a86),160,900);                  // sunset haze: the far stuff fades out instead of ending
    makeRig(scene,{sun:2.6,sunColor:0xffb070,hemi:.4,sky:0x9aa8d8,ground:0x5a4a3a,dir:sunDir,span:22,dist:80,far:220});
    lv.sunWorld=sunDir.clone().multiplyScalar(900);
    const L=DRIVE_END+80, MID=L/2;
    // ground all the way to the hills
    scene.add(tiledPlane(2400,2400,texMat(TX.grass(),1,1,{opts:{roughness:1,color:col(0x8aa86a)}}),6,MID,0,0));
    scene.add(tiledPlane(L+240,8,texMat(TX.asphalt(),1,1,{opts:{roughness:1}}),6,MID,.01,0));
    for(const z of [-5.2,5.2]) scene.add(tiledPlane(L+240,2.4,texMat(TX.concrete(),1,1,{opts:{roughness:1}}),2.4,MID,.02,z));
    const lineM=mat(0xe8c040,{roughness:.6}); for(let i=0;i<(L+120)/4;i++) scene.add(box(2.2,.01,.14,lineM,-100+i*4,.02,0,false));
    const edgeM=mat(0xe8e8e0,{roughness:.6}); for(const z of [-3.9,3.9]) scene.add(box(L+240,.01,.12,edgeM,MID,.021,z,false));
    // the street: houses facing the road, driveways, a back street behind them
    const r=RNG(77);
    const houseCol=[0xe8d8c0,0xc8d8e0,0xd8e8c8,0xf0e0d0,0xe0d0e8,0xd8c0a8], roofCol=[0x4a4a4a,0x5a3a2a,0x3a3a44];
    const drivewayM=texMat(TX.concrete(),1,1,{opts:{roughness:1,color:col(0xb8b4ac)}});
    lv.parked=[];
    for(let i=0;i<20;i++) for(const sd of [-1,1]){ const x=-40+i*22+r()*6; const h=makeHouse({color:pick(houseCol),roof:pick(roofCol),seed:i*2+(sd>0?1:0),w:rand(8,11),floors:r()<.3?2:1,night:.6}); h.position.set(x,0,sd*17); h.rotation.y=sd>0?Math.PI:0; scene.add(bake(h));
      scene.add(tiledPlane(3,6.6,drivewayM,3,x+5.5,.015,sd*9.7));
      if(r()<.45){ const pc=makeCar({night:false,simple:true,paint:pick([0x2a4a8a,0x8a8a8e,0x1a1a1c,0xe8e8e8,0x5a6a3a,0x8a2a2a])}); pc.position.set(x+5.5,0,sd*10.2); pc.rotation.y=sd>0?Math.PI/2:-Math.PI/2; const pb=bake(pc); scene.add(pb); lv.parked.push(pb); } }   // parked cars are baked = a few draw calls each (no lag)
    for(let i=0;i<13;i++) for(const sd of [-1,1]){ const x=-30+i*34+r()*10; const h=makeHouse({color:pick(houseCol),roof:pick(roofCol),seed:100+i*2+(sd>0?1:0),w:rand(8,12),floors:r()<.4?2:1,night:.6}); h.position.set(x,0,sd*44); h.rotation.y=sd>0?Math.PI:0; scene.add(bake(h)); }
    const trees=[]; for(let i=0;i<64;i++){ const sd=r()<.5?-1:1; trees.push({x:-60+i*7.4+r()*4,z:sd*(8.5+r()*3.5),h:rand(6,10)}); }
    for(let i=0;i<90;i++){ const sd=r()<.5?-1:1; trees.push({x:-80+r()*(L+160),z:sd*(26+r()*60),h:rand(7,13)}); }
    makeTrees(scene,trees,{seed:44});
    lv.lights=[]; for(let i=0;i<22;i++){ const sl=makeStreetlight(1,i%3===0&&SETTINGS.detail>=2); sl.position.set(-40+i*20,0,i%2?6.4:-6.4); sl.rotation.y=i%2?-Math.PI/2:Math.PI/2; scene.add(sl); }
    makeGrass(scene,{x0:-60,x1:L,z0:-14,z1:14,skip:(x,z)=>Math.abs(z)<6.6||Math.abs(z-9.7*Math.sign(z))<1.6},dq(0,4000,10000,18000,28000),{h:.2,seed:9});
    // hills all around the horizon
    const hillM=[0x4a6a3a,0x56703e,0x3e5a34,0x5e7448].map(c=>new THREE.MeshStandardMaterial({color:col(c),roughness:1}));
    for(let i=0;i<34;i++){ const a=i/34*Math.PI*2+rand(-.05,.05), d=rand(560,820); const h=mesh(GC('hill',()=>new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2)),pick(hillM),MID+Math.cos(a)*d,0,Math.sin(a)*d,false); h.scale.set(rand(110,220),rand(30,80),rand(110,200)); scene.add(h); }
    // Jim's stand sign at the end of the street
    const signT=canvasTex(512,256,(x,w,h)=>{ x.fillStyle='#f4ead0'; x.fillRect(0,0,w,h); x.strokeStyle='#6a3a1a'; x.lineWidth=14; x.strokeRect(7,7,w-14,h-14); x.fillStyle='#8a2a1a'; x.textAlign='center'; x.font='bold 84px Georgia, serif'; x.fillText("JIM'S",w/2,110); x.font='bold 60px Georgia, serif'; x.fillText('STAND  >',w/2,190); });
    const sg=new THREE.Group(); sg.position.set(DRIVE_END-14,0,6.8); sg.rotation.y=-Math.PI/2+.35; scene.add(sg); for(const z of [-.9,.9]) sg.add(cyl(.06,.06,2.6,mat(0x6a4a2a,{roughness:.9}),0,1.3,z,8)); sg.add(mesh(new THREE.PlaneGeometry(2.2,1.1),new THREE.MeshStandardMaterial({map:signT,roughness:.8}),.07,2.2,0)); sg.children[sg.children.length-1].rotation.y=Math.PI/2;
    // your car + Jim
    lv.car=makeCar({night:true,paint:0x2a4a8a}); scene.add(lv.car);     // JIM'S car (blue)
    // Jim in the driver seat: BOTH hands really grip the wheel (and follow it when it turns)
    lv.jim=makeJim(); lv.jim.userData.level='drive'; lv.car.add(lv.jim); lv.jim.position.set(-.16,-.17,-.38); lv.jim.scale.setScalar(.92); lv.jim.rotation.y=Math.PI/2; lv.jim.userData.A.seated=true; setPose(lv.jim,'drive',0);
    const gripL=new THREE.Vector3(), gripR=new THREE.Vector3();
    lv.jim.userData.A.custom=(R,t)=>{ const W=lv.car.userData.wheelOnly; W.updateMatrixWorld(true); gripL.set(0,.1,-.155); W.localToWorld(gripL); gripR.set(0,.1,.155); W.localToWorld(gripR);
      aimArm(lv.jim,'L',gripL,R,1,.07); aimArm(lv.jim,'R',gripR,R,1,.07); if(lv.jimTalk){ R.head[1]+=.45+Math.sin(t*2)*.08; } };
    // you in the passenger seat
    lv.you=makeYou(); lv.you.userData.level='drive'; lv.car.add(lv.you); lv.you.position.set(-.16,-.17,.38); lv.you.scale.setScalar(.92); lv.you.rotation.y=Math.PI/2; lv.you.userData.A.seated=true; setPose(lv.you,'ride',0);
    lv.arms=[];
    // oncoming traffic
    lv.traffic=[]; for(let i=0;i<4;i++){ const c=makeCar({paint:pick([0x2a4a8a,0xd8d8d8,0x1a1a1c,0x3a6a4a,0xc8a020]),night:true,simple:true}); c.rotation.y=Math.PI; c.position.set(80+i*70,0,-2); const cb=bake(c); cb.userData={wheels:[]}; scene.add(cb); lv.traffic.push({c:cb,sp:rand(9,12)}); }
    lv.carX=0;
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.35; FX.raysColor.set(1,.7,.45); },
  update(dt,t){
    const lv=this;
    if(lv.playerDrive) driveUpdate(lv,dt,t);
    else if(lv.driving){ const sp=lv.speed||11; lv.carX+=sp*dt; lv.car.position.set(lv.carX,Math.sin(t*9)*.006,lv.laneZ!=null?lv.laneZ:2); lv.car.userData.wheelOnly.rotation.x=Math.sin(t*.7)*.05; spinWheels(lv.car,sp*dt); lv.car.rotation.z=Math.sin(t*1.3)*.004; ambFreq('engine',48+sp*2.2); }
    for(const T of lv.traffic){ T.c.position.x-=T.sp*dt; spinWheels(T.c,T.sp*dt); const cx=lv.playerDrive?lv.car.position.x:lv.carX; if(T.c.position.x<cx-140) T.c.position.x=cx+rand(160,260); }
    WIND.time.value=t;
  }
});
/* your hands grip the wheel at 10 and 2 and follow it when it turns */
const _dvA=new THREE.Vector3(), _dvB=new THREE.Vector3();
function driveArms(lv){
  const car=lv.car, W=car.userData.wheelOnly; car.updateMatrixWorld(true);
  lv.arms.forEach((a,i)=>{ const sd=i?1:-1;
    _dvA.set(0,.1,sd*.15); W.localToWorld(_dvA); car.worldToLocal(_dvA);            // the grip point on the rim
    _dvB.set(_dvA.x-.34,_dvA.y-.16,-.38+sd*.21);                                     // toward your elbow (behind + below)
    a.position.copy(_dvA); a.lookAt(car.localToWorld(_dvB.clone()));               // forearm points from the elbow to the grip
    a.translateZ(.33*a.scale.x); });
}
function driveUpdate(lv,dt,t){
  const car=lv.car, P=PLAYER, can=G.mode==='play'&&!DLG.active&&!lv.arrived;
  const thr=can&&(keys.KeyW||keys.ArrowUp||TOUCH.moveZ<-.3)?1:0, brk=can&&(keys.KeyS||keys.ArrowDown||TOUCH.moveZ>.3)?1:0;
  const st=can?((keys.KeyA||keys.ArrowLeft||TOUCH.moveX<-.3)?1:0)-((keys.KeyD||keys.ArrowRight||TOUCH.moveX>.3)?1:0):0;
  lv.vel+=thr*7.5*dt; if(brk) lv.vel-=(lv.vel>.5?16:5)*dt; if(!thr&&!brk) lv.vel-=lv.vel*.35*dt; lv.vel-=lv.vel*.06*dt;
  lv.vel=clamp(lv.vel,-4,21);
  lv.steerA=damp(lv.steerA,st*.42/(1+Math.abs(lv.vel)*.045),5,dt);
  lv.yaw+=lv.vel*Math.tan(lv.steerA)/2.8*dt;
  const fx=Math.cos(lv.yaw), fz=-Math.sin(lv.yaw);
  const p=car.position; p.x+=fx*lv.vel*dt; p.z+=fz*lv.vel*dt;
  // curbs: bump back onto the road
  if(Math.abs(p.z)>5.6){ p.z=Math.sign(p.z)*5.6; lv.vel*=.6; lv.yaw=damp(lv.yaw,0,6,dt); if(G.time-(lv.bumpT||0)>.6){ lv.bumpT=G.time; SFX.thud(); shake(.3); } }
  if(p.x<-30){ p.x=-30; lv.vel=Math.max(0,lv.vel); }
  // traffic: crash = a jolt, Jim yells
  for(const T of lv.traffic){ if(Math.abs(T.c.position.x-p.x)<4.3 && Math.abs(T.c.position.z-p.z)<1.9){ T.c.position.x+=rand(60,90); lv.vel=-2; SFX.thud(); SFX.clank&&SFX.clank(); shake(.9); dmgFlash(); if(G.time-(lv.yellT||0)>4){ lv.yellT=G.time; bark('Jim',pick(["WATCH THE ROAD!","Dude! Other lane!","You almost killed us!"]),lv.jim,2.4); } } }
  p.y=Math.sin(t*9)*.004*Math.min(1,Math.abs(lv.vel)/5);
  car.rotation.set(0,lv.yaw,Math.sin(t*1.3)*.003-lv.steerA*Math.abs(lv.vel)*.0025);
  spinWheels(car,lv.vel*dt); for(const i of [0,1]) car.userData.wheels[i].rotation.y=lv.steerA;
  car.userData.wheelOnly.rotation.x=lv.steerA*2.6;
  { const U=car.userData, mph=Math.abs(lv.vel)*2.237; if(U.speedo) U.speedo.rotation.z=-Math.PI*.75-clamp(mph/120,0,1)*Math.PI*1.5; lv.rpm=damp(lv.rpm||.8,.8+(thr?2.2:0)+Math.abs(lv.vel)/21*3.4,4,dt); if(U.tacho) U.tacho.rotation.z=-Math.PI*.75-clamp(lv.rpm/8,0,1)*Math.PI*1.5; }   // real moving needles
  ambFreq('engine',48+Math.abs(lv.vel)*2.6);
  if(lv.arms.length) driveArms(lv);
  // you: sitting in the driver's seat, looking around freely (the view turns with the car)
  car.updateMatrixWorld(true); const seat=car.localToWorld(V3(-.26,0,-.38)); P.pos.copy(seat); P.pos.y=p.y; P.vel.set(0,0,0); P.eye=1.3;
  const base=lv.yaw-Math.PI/2; if(lv.lastBase==null) lv.lastBase=base; P.yaw+=base-lv.lastBase; lv.lastBase=base;
  const off=clamp(angDiff(base,P.yaw),-2.1,2.1); P.yaw=base+off; P.pitch=clamp(P.pitch,-.75,.55);
  if(Math.abs(lv.vel)>.5) lv.jim.userData.A.look=Math.sin(t*.3)>.6?'player':null;
  if(p.x>DRIVE_END && !lv.arrived){ lv.arrived=true; runStory(driveArrive); }
}
async function driveArrive(){
  const lv=LEVELS.drive; objective(null);
  await tweenVal(k=>{ lv.vel=lerp(lv.vel,0,k); },1.2);
  bark('Jim',"Here we are! Park it anywhere.",lv.jim,2.6); await wait(2);
  SFX.carDoor&&SFX.carDoor(); await fade(1,.8);
  lv.playerDrive=false; setVM(true); hudVisible(true);
  startFromCheckpointInner('A2');
}
