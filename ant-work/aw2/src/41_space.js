/* ================================================================
   SPACE (cutscene) — the rocket leaves the moon behind and heads
   for a growing red dot.
   ================================================================ */
defineLevel('space',{
  title:'space',
  env:{fx:{exposure:1.1,contrast:1.12,bloomStrength:.3,bloomThreshold:1.3,vignette:.45,mblurStrength:1.5},music:'launch',reverb:0,amb:[['spaceDrone',.08],['rocket',.25]],far:9000},
  async build(scene,lv){
    scene.background=col(0x000000);
    scene.add(makeStars(dq(4000,6000,9000,12000,16000),4000,{band:true,k:1.6,seed:21}));
    const sunDir=V3(.3,.25,-1).normalize();
    lv.sunWorld=sunDir.clone().multiplyScalar(3800);
    scene.add(mesh(new THREE.SphereGeometry(70,24,16),basicGlow(0xfff4e0,40),lv.sunWorld.x,lv.sunWorld.y,lv.sunWorld.z,false));
    lv.envMap=makeEnv({top:0x05070c,horizon:0x0a0c14,bottom:0x020204,lights:[{x:sunDir.x*40,y:sunDir.y*40,z:sunDir.z*40,w:5,h:5,c:0xffffff,k:10}]});
    const rig=makeRig(scene,{sun:3.8,sunColor:0xfff4e6,hemi:.05,sky:0x3a4a6a,ground:0x000000,dir:sunDir,span:20,dist:100,far:300});
    lv.moon=makePlanet('moon',260); lv.moon.position.set(-200,-340,300); scene.add(lv.moon);
    lv.earth=makePlanet('earth',150); lv.earth.position.set(-1400,300,-1800); scene.add(lv.earth);
    lv.mars=makePlanet('mars',400); lv.mars.position.set(6000,-200,-400); scene.add(lv.mars);
    lv.rocket=makeRocket(); lv.rocket.rotation.z=-Math.PI/2; scene.add(lv.rocket); setRocketFlame(lv.rocket,1);
    lv.rx=0;
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.2; FX.raysColor.set(1,.95,.85); },
  update(dt,t){
    const lv=this; lv.rx+=dt*(lv.speed||40); lv.rocket.position.set(lv.rx,Math.sin(t*1.5)*.3,0); lv.rocket.rotation.x=Math.sin(t*.8)*.05;
    lv.earth.rotation.y+=dt*.01; if(lv.earth.userData.clouds) lv.earth.userData.clouds.rotation.y+=dt*.006;
    lv.mars.rotation.y+=dt*.004;
    if(Math.random()<dt*60){ const p=lv.rocket.localToWorld(V3(rand(-.4,.4),-3.2,rand(-.4,.4))); lv.glow.spawn(p.x,p.y,p.z,-rand(8,14),rand(-1,1),rand(-1,1),rand(.3,.7),rand(.5,1.1),1,.55,.2,.8,0,.5,1.5); }
  }
});

