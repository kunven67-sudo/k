/* ================================================================
   FLASHBACK — the alien ship from Ant Work 1, rebuilt for five
   one-second memories: the red corridor, Steve, the gun, the green
   bolt, and Steve bleeding out.
   ================================================================ */
function shipPanelTex(){
  return texSet('shipPanel',512,(x,w,h)=>{
    x.fillStyle='#1c2a2e'; x.fillRect(0,0,w,h);
    for(let j=0;j<4;j++) for(let i=0;i<4;i++){ const px=i*128, py=j*128; const g=x.createLinearGradient(px,py,px+128,py+128); g.addColorStop(0,'#2a3c42'); g.addColorStop(1,'#16232a'); x.fillStyle=g; x.fillRect(px+4,py+4,120,120);
      x.strokeStyle='rgba(120,200,190,.18)'; x.lineWidth=2; x.strokeRect(px+10,py+10,108,108); for(const [a,b] of [[16,16],[112,16],[16,112],[112,112]]){ x.fillStyle='#0a1012'; x.beginPath(); x.arc(px+a,py+b,3,0,7); x.fill(); } }
    for(let i=0;i<3000;i++){ x.fillStyle=`rgba(0,0,0,${Math.random()*.15})`; x.fillRect(Math.random()*w,Math.random()*h,2,2); }
  },{strength:2.5,rough:(x,w,h)=>{ x.fillStyle='#606060'; x.fillRect(0,0,w,h); blotches(x,w,h,'rgba(30,30,30,A)',30,10,40,.5); }});
}
function grateTex(){ return texSet('grate',256,(x,w,h)=>{ x.fillStyle='#0a0c0e'; x.fillRect(0,0,w,h); for(let j=0;j<16;j++) for(let i=0;i<16;i++){ x.fillStyle='#3a4448'; x.fillRect(i*16+2,j*16+2,12,12); x.fillStyle='#050607'; x.fillRect(i*16+5,j*16+5,6,6); } },{strength:3}); }
function makeAlienGun(){
  const g=new THREE.Group();
  const white=new THREE.MeshPhysicalMaterial({color:col(0xe8ecef),roughness:.2,clearcoat:1,metalness:.1}), dark=mat(0x1a1e22,{metalness:.6,roughness:.35}), glow=emissiveMat(0x39ff8a,4);
  g.add(rbox(.07,.09,.34,.03,white,0,0,-.05)); g.add(rbox(.05,.14,.07,.02,dark,0,-.1,.06)); g.children[1].rotation.x=.25;
  const barrel=mesh(GC('gunBarrel',()=>{ const c=new THREE.CylinderGeometry(.022,.028,.26,16); c.rotateX(Math.PI/2); return c; }),dark,0,.02,-.3); g.add(barrel);
  for(let i=0;i<3;i++){ const r=mesh(GC('gunRing',()=>new THREE.TorusGeometry(.034,.007,8,20)),glow,0,.02,-.22-i*.05,false); g.add(r); }
  const tip=mesh(GC('gunTip',()=>new THREE.SphereGeometry(.018,12,10)),glow,0,.02,-.44,false); g.add(tip);
  g.add(box(.012,.04,.12,glow,.036,.02,-.05,false)); g.add(box(.012,.04,.12,glow,-.036,.02,-.05,false));
  g.userData.glow=glow; return g;
}
defineLevel('flash',{
  title:'memory',
  env:{fx:{exposure:1.1,flashback:1},music:null,far:200},
  async build(scene,lv){
    scene.background=col(0x020405); scene.fog=new THREE.FogExp2(col(0x1a0406),.06);
    lv.envMap=makeEnv({top:0x100808,horizon:0x401010,bottom:0x050505,lights:[{x:0,y:10,z:0,w:4,h:30,c:0xff2a2a,k:3}]}); scene.environment=lv.envMap;
    const rig=makeRig(scene,{sun:.4,sunColor:0xff9a8a,hemi:.15,sky:0x401818,ground:0x100505,dir:V3(.2,1,.3),span:12}); rig.sun.castShadow=false;
    const pan=shipPanelTex(), gr=grateTex();
    const wallM=texMat(pan,1,1,{opts:{roughness:1,metalness:.6}}), floorM=texMat(gr,1,1,{opts:{roughness:.8,metalness:.7}});
    // corridor along -z: x in [-1.5,1.5], z in [-40,6]
    const L=46, W=3, H=3;
    for(const sd of [-1,1]){ const w=mesh(new THREE.PlaneGeometry(L,H),wallM,sd*W/2,H/2,-17,false); w.rotation.y=-sd*Math.PI/2; w.material=wallM.clone(); w.material.map=wallM.map.clone(); w.material.map.repeat.set(L/2,H/2); w.material.map.needsUpdate=true; w.material.normalMap=wallM.normalMap.clone(); w.material.normalMap.repeat.set(L/2,H/2); w.material.normalMap.needsUpdate=true; scene.add(w); }
    scene.add(tiledPlane(W,L,floorM,1,0,0,-17));
    const ce=mesh(new THREE.PlaneGeometry(W,L),mat(0x0c1214,{roughness:.6,metalness:.7}),0,H,-17,false); ce.rotation.x=Math.PI/2; scene.add(ce);
    const pipeM=mat(0x3a4448,{metalness:.8,roughness:.35});
    for(const [x,y,r] of [[-1.2,2.75,.08],[-.95,2.8,.05],[1.15,2.7,.1],[1.3,.25,.06]]){ const p=cyl(r,r,L,pipeM,x,y,-17,12); p.rotation.x=Math.PI/2; scene.add(p); }
    lv.alarms=[];
    for(let i=0;i<9;i++){ const z=4-i*5; const strip=box(.08,.08,1.2,emissiveMat(0xff1a1a,6),0,H-.05,z,false); scene.add(strip); const pl=new THREE.PointLight(col(0xff2a1a),2.2,8,2); pl.position.set(0,H-.4,z); scene.add(pl); lv.alarms.push({strip,pl,ph:i*.7});
      for(const sd of [-1,1]) scene.add(box(.05,2.2,.14,emissiveMat(0x39ffb0,1.5),sd*1.47,1.3,z-2.5,false)); }
    // finale room at the corridor start (z>6)
    const room=new THREE.Group(); room.position.set(0,0,11); scene.add(room);
    const RW=9, RD=10;
    for(const [x,z,w,ry] of [[0,-RD/2,RW,0],[0,RD/2,RW,Math.PI],[-RW/2,0,RD,Math.PI/2],[RW/2,0,RD,-Math.PI/2]]){ const w_=mesh(new THREE.PlaneGeometry(w,4),wallM,x,2,z,false); w_.rotation.y=ry; room.add(w_); }
    room.add(tiledPlane(RW,RD,floorM.clone(),1,0,.001,0));
    const rce=mesh(new THREE.PlaneGeometry(RW,RD),mat(0x0a0e10,{roughness:.6,metalness:.7}),0,4,0,false); rce.rotation.x=Math.PI/2; room.add(rce);
    const console_=new THREE.Group(); console_.position.set(-3,0,2); room.add(console_);
    console_.add(rbox(1.6,1,.7,.08,mat(0x2a3438,{metalness:.7,roughness:.4}),0,.5,0)); console_.add(box(1.4,.5,.05,emissiveMat(0x39ffb0,2),0,1.2,-.2,false));
    const hatch=mesh(new THREE.TorusGeometry(.8,.12,12,32),mat(0x4a5458,{metalness:.8,roughness:.3}),3.5,1.3,0); hatch.rotation.y=Math.PI/2; room.add(hatch);
    const rl=new THREE.PointLight(col(0xff3a2a),3,14,2); rl.position.set(0,3.5,0); room.add(rl); lv.roomLight=rl;
    const cl=new THREE.PointLight(col(0x39ffb0),1.2,6,2); cl.position.set(-3,1.6,1.4); room.add(cl);
    // Steve
    lv.steve=makeSteve(); lv.steve.userData.level='flash'; scene.add(lv.steve);
    { const sg=new THREE.PointLight(col(0x9aff8a),1.3,3.2,2); sg.position.set(0,1.6,.9); lv.steve.add(sg); } // keeps his green skin reading as green under the red alarm lights
    lv.gun=makeAlienGun();
    // blood pool (grows) + wound
    const bloodM=new THREE.MeshPhysicalMaterial({color:col(0x5a0606),roughness:.15,clearcoat:1,clearcoatRoughness:.05,emissive:col(0x100000)});
    lv.pool=mesh(new THREE.CircleGeometry(1,40),bloodM,0,.012,0,false); lv.pool.rotation.x=-Math.PI/2; lv.pool.scale.setScalar(.01); scene.add(lv.pool);
    const pg=lv.pool.geometry, pp=pg.attributes.position; for(let i=1;i<pp.count;i++){ const a=Math.atan2(pp.getY(i),pp.getX(i)); const r=1+noise1(a*3)*.25+noise1(a*7+4)*.1; pp.setXY(i,Math.cos(a)*r,Math.sin(a)*r); } pg.computeVertexNormals();
    lv.bloodM=bloodM;
    lv.bolt=mesh(GC('bolt',()=>{ const c=new THREE.CylinderGeometry(.05,.05,1,10); c.rotateX(Math.PI/2); c.translate(0,0,-.5); return c; }),basicGlow(0x39ff8a,8),0,0,0,false); lv.bolt.visible=false; scene.add(lv.bolt);
    lv.boltLight=new THREE.PointLight(col(0x39ff8a),0,10,2); scene.add(lv.boltLight);
  },
  update(dt,t){
    for(const a of this.alarms){ const k=Math.max(0,Math.sin(t*6+a.ph)); a.pl.intensity=.6+k*2.6; a.strip.material.emissiveIntensity=1+k*7; }
    if(this.poolGrow){ const s=this.pool.scale.x; this.pool.scale.setScalar(Math.min(this.poolMax||1.4,s+dt*(.9-s*.3))); }
  }
});
/* the flashback sequence: 5 memory cuts from the couch, then back */
const FLASH={active:false};
async function runFlashbacks(){
  const tok=STORY.token; const F=await buildLevel('flash'); if(tok!==STORY.token) return new Promise(()=>{});
  const home=LV; const steve=F.steve, S=steve.userData;
  const V=(x,y,z)=>V3(x,y,z);
  const shots=[
    // 1: running down the red corridor, Steve chasing behind you
    {setup(){ steve.position.set(0,0,-6); steve.rotation.y=0; setMood(steve,'angry'); setPose(steve,(t)=>({shL:[Math.sin(t*9)*.9,0,.2],shR:[-Math.sin(t*9)*.9,0,-.2],elL:[-1.4,0,0],elR:[-1.4,0,0],thL:[-Math.sin(t*9)*.8,0,0],thR:[Math.sin(t*9)*.8,0,0],knL:[.8+Math.sin(t*9)*.6,0,0],knR:[.8-Math.sin(t*9)*.6,0,0],spine:[.25,0,0]}),0);
      F.pool.visible=false; F.gun.visible=false; },
     cam:(k)=>({pos:V(Math.sin(k*20)*.05,1.6+Math.abs(Math.sin(k*20))*.05,-10-k*1.5),look:V(0,1.4,-4-k*1.2)}),text:'The ship.'},
    // 2: Steve in the finale room, furious, close
    {setup(){ F.gun.visible=false; steve.position.set(.2,0,9.4); steve.rotation.y=Math.PI; clearPose(steve,0); setMood(steve,'angry'); S.A.talk=true; S.A.look='player'; },
     cam:(k)=>({pos:V(0,1.72,8.2-k*.15),look:V(.2,1.78,9.4)}),text:''},
    // 3: your hands, the alien gun, aimed at him
    {setup(){ S.A.talk=false; setPose(steve,'shrug',.1); steve.position.set(.1,0,8.6); steve.rotation.y=Math.PI;
      F.gun.visible=true; },
     cam:(k)=>({pos:V(0,1.62,12.4),look:V(.1,1.5-.05*k,8.6)}),text:''},
    // 4: the green bolt hits him square in the chest
    {setup(){ F.gun.visible=true; F.bolt.visible=true; F.bolt.position.set(.1,1.45,12.2); F.bolt.lookAt(.1,1.45,8.6); F.bolt.scale.z=3.6; F.boltLight.position.set(.1,1.4,9); F.boltLight.intensity=12; SFX.bolt(); flashWhite(.6,.3);
      setPose(steve,()=>({spine:[-.35,0,0],shL:[-.3,0,.9],shR:[-.3,0,-.9],elL:[-.4,0,0],elR:[-.4,0,0],head:[-.4,0,0]}),.08); setMood(steve,'shock'); },
     cam:(k)=>({pos:V(.9,1.5,11.2-k*.3),look:V(.1,1.4,8.6)}),text:''},
    // 5: Steve on the floor, bleeding out
    {setup(){ F.gun.visible=false; F.bolt.visible=false; F.boltLight.intensity=0; clearPose(steve,0); S.A.dead=true;
      steve.position.set(.1,.12,8.6); steve.rotation.set(0,Math.PI,Math.PI/2.05); S.J.head.rotation.set(.3,.3,.2); S.lids.forEach(l=>l.rotation.x=.62);
      F.pool.visible=true; F.pool.position.set(-.35,.012,8.5); F.pool.scale.setScalar(.2); F.poolGrow=true; F.poolMax=1.3; },
     cam:(k)=>({pos:V(1.2,2.4-k*.2,10.2),look:V(-.2,.1,8.5)}),text:''}
  ];
  FLASH.active=true;
  const savedScene=LV; const hold=[1.25,1.05,1.0,.95,1.5];
  for(let i=0;i<shots.length;i++){
    SFX.memHit(); SFX.heartbeat(1.2); flashWhite(1,.35); shake(.35);
    FX.glitch=1; later(.2,()=>FX.glitch=0);
    shots[i].setup();
    FLASH.shot=shots[i]; FLASH.t=0; FLASH.dur=hold[i];
    swapRender(F.scene,true);
    if(i===3) later(.05,()=>SFX.bodyFall&&0);
    await wait(hold[i]);
    if(i===3){ SFX.bodyFall(); }
    // snap back to the couch for a breath between memories
    swapRender(null);
    FX.flashback=0; flashWhite(.8,.25); SFX.heartbeat(.8);
    if(i<shots.length-1) await wait(i<2?.55:.4);
  }
  F.gun.visible=false;
  FLASH.active=false; F.poolGrow=false;
  S.A.dead=false; steve.rotation.set(0,0,0); steve.position.set(0,0,-100);
}
/* render another scene (e.g. a memory) with the camera driven by FLASH.shot */
const RENDER={override:null};
function swapRender(scene,isFlash){ RENDER.override=scene; if(scene){ FX.flashback=1; FX.aberr=.004; } else { FX.flashback=0; FX.aberr=FX_BASE.aberr; } invalidateMotion(); }

