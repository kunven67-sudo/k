/* ================================================================
   DRIVE (cutscene) — you and Jim drive across town at sunset
   ================================================================ */
defineLevel('drive',{
  title:'the drive',
  env:{fx:{exposure:1.0,temp:.2,saturation:1.1,contrast:1.08,bloomStrength:.2,bloomThreshold:1.5,mblurStrength:1.4},music:'drive',reverb:.05,amb:[['road',.1],['engine',.05]],far:1200},
  async build(scene,lv){
    const sunDir=V3(-.2,.12,-1).normalize();
    const sky=makeSky({top:0x2a3a78,mid:0x7a78b8,horizon:0xff9a58,bottom:0x3a3040,sunDir,sunColor:0xffb070,sunSize:.9992,sunGlow:1.6,clouds:.6,cloudColor:0xffc0a0,cloudShade:0x5a4a7a});
    scene.add(sky); lv.skyU=sky.userData.u; lv.envMap=envFromSky(sky);
    makeRig(scene,{sun:2.6,sunColor:0xffb070,hemi:.4,sky:0x9aa8d8,ground:0x5a4a3a,dir:sunDir,span:18,dist:80,far:200});
    lv.sunWorld=sunDir.clone().multiplyScalar(900);
    const L=420;
    scene.add(tiledPlane(L+200,200,texMat(TX.grass(),1,1,{opts:{roughness:1,color:col(0x8aa86a)}}),4,L/2,0,0));
    scene.add(tiledPlane(L+200,8,texMat(TX.asphalt(),1,1,{opts:{roughness:1}}),6,L/2,.01,0));
    for(const z of [-5.2,5.2]) scene.add(tiledPlane(L+200,2.4,texMat(TX.concrete(),1,1,{opts:{roughness:1}}),2.4,L/2,.02,z));
    const lineM=mat(0xe8c040,{roughness:.6}); for(let i=0;i<L/4+40;i++) scene.add(box(2.2,.01,.14,lineM,-80+i*4,.02,0,false));
    const houses=[]; const r=RNG(77);
    for(let i=0;i<22;i++) for(const sd of [-1,1]){ const x=-40+i*22+r()*6; const h=makeHouse({color:pick([0xe8d8c0,0xc8d8e0,0xd8e8c8,0xf0e0d0,0xe0d0e8,0xd8c0a8]),roof:pick([0x4a4a4a,0x5a3a2a,0x3a3a44]),seed:i*2+(sd>0?1:0),w:rand(8,11),floors:r()<.3?2:1,night:.6}); h.position.set(x,0,sd*17); h.rotation.y=sd>0?Math.PI:0; scene.add(bake(h)); }
    const trees=[]; for(let i=0;i<60;i++){ const sd=r()<.5?-1:1; trees.push({x:-60+i*8+r()*4,z:sd*(8.5+r()*4),h:rand(6,10)}); }
    makeTrees(scene,trees,{seed:44});
    lv.lights=[]; for(let i=0;i<24;i++){ const sl=makeStreetlight(1,i%3===0&&SETTINGS.detail>=2); sl.position.set(-40+i*20,0,i%2?6.4:-6.4); sl.rotation.y=i%2?-Math.PI/2:Math.PI/2; scene.add(sl); }
    makeGrass(scene,{x0:-60,x1:L,z0:-14,z1:14,skip:(x,z)=>Math.abs(z)<6.6},dq(0,4000,10000,18000,28000),{h:.2,seed:9});
    lv.car=makeCar({night:true}); scene.add(lv.car);
    lv.jim=makeJim(); lv.jim.userData.level='drive'; lv.car.add(lv.jim); lv.jim.position.set(-.12,-.17,.38); lv.jim.scale.setScalar(.92); lv.jim.rotation.y=Math.PI/2; lv.jim.userData.A.seated=true; setPose(lv.jim,'drive',0);
    lv.you=makeYou(); lv.you.userData.level='drive'; lv.car.add(lv.you); lv.you.position.set(-.12,-.17,-.38); lv.you.scale.setScalar(.92); lv.you.rotation.y=Math.PI/2; lv.you.userData.A.seated=true; setPose(lv.you,'drive',0);
    lv.jim.userData.A.custom=(R,t)=>{ if(lv.jimTalk){ R.shL[0]=-1+Math.sin(t*3)*.3; R.elL[0]=-1.2; R.head[1]-=.5; } };
    lv.carX=0;
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.35; FX.raysColor.set(1,.7,.45); },
  update(dt,t){
    const lv=this; if(lv.driving){ const sp=lv.speed||11; lv.carX+=sp*dt; lv.car.position.set(lv.carX,Math.sin(t*9)*.006,-2); spinWheels(lv.car,sp*dt); lv.car.rotation.z=Math.sin(t*1.3)*.004; ambFreq('engine',48+sp*2.2); }
    WIND.time.value=t;
  }
});

