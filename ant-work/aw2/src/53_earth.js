/* ================================================================
   MARS SHIFT PART 3 — BLOCKY EARTH. The ship blows up, XXX5 goes for
   other planets, and everything on Earth is blocks. Bob. Calling Jim.
   Then: space (XXX5 has three heads now, and Mars is gone).
   ================================================================ */
function jetHUD(on,k){ const el=$('fuel'); el.classList.toggle('show',!!on); if(on&&k!=null){ el.querySelector('i').style.width=(k*100)+'%'; el.classList.toggle('low',k<.25); } }
function countHUD(n){ const el=$('count'); if(n==null){ el.classList.remove('show'); return; } el.textContent=n; el.classList.add('show'); }
function spamHUD(on,k,label){ const el=$('spam'); el.classList.toggle('show',!!on); document.body.classList.toggle('spamming',!!on); if(on){ el.querySelector('i').style.width=(k*100)+'%'; if(label) $('spamT').textContent=label; } }

/* a blocky house: walls, windows, door, stepped roof */
function blockHouse(B,x,z,o){ const w=o.w||7, d=o.d||7, h=o.h||4, face=o.face||1; // face: +1 door on +z side, -1 on -z
  const x0=x-(w-1)/2, z0=z-(d-1)/2;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) for(let k=0;k<d;k++){ const edge=i===0||i===w-1||k===0||k===d-1; if(!edge) continue;
    const onFace=(face>0?k===d-1:k===0), onSide=i===0||i===w-1; const px=x0+i, pz=z0+k, py=j+.5;
    if(onFace&&i===Math.floor(w/2)&&j<2){ if(j===0) B.door.add(px,1,pz+(face>0?.02:-.02),1,2,.96); continue; }
    if(j===1||j===2){ if((onFace&&(i===1||i===w-2))||(onSide&&(k===2||k===d-3))){ B.glass.add(px,py,pz); continue; } }
    B[o.wall].add(px,py,pz); if(j===0) B.stone.add(px,-.49,pz,1,.02,1); }
  for(let s=0;s<=Math.ceil(w/2);s++){ const ww=w+2-s*2; if(ww<=0) break; for(let k=-1;k<=d;k++) B.roof.add(x,h+.5+s,z0+k,ww,1,1); }
}
function blockTree(B,x,z,h=4){ for(let j=0;j<h;j++) B.log.add(x,j+.5,z); for(let a=-2;a<=2;a++) for(let b=-2;b<=2;b++) for(let c=0;c<3;c++){ if(Math.abs(a)+Math.abs(b)+c>4) continue; if(Math.random()<.12) continue; B.leaves.add(x+a,h-.5+c,z+b); } }

defineLevel('blockearth',{
  title:'Earth (blocky)',
  env:{fx:{exposure:1.05,saturation:1.1,contrast:1.05,bloomStrength:.25,bloomThreshold:1.2,vignette:.3,aoRadius:.6},music:'blocky',reverb:.15,amb:[['breeze',.05],['wind',.03]],surface:'grass',far:900},
  async build(scene,lv){
    const sunDir=V3(.4,.8,.3).normalize(); lv.sunDir=sunDir;
    lv.sky=makeSky({top:0x3a7ae8,mid:0x8ac0f8,horizon:0xd8ecff,bottom:0x5a8a3a,sunDir,clouds:0,sunSize:.9992}); scene.add(lv.sky);
    lv.envMap=makeEnv({top:0x6a9ae8,horizon:0xd8ecff,bottom:0x5a8a3a,lights:[{x:sunDir.x*30,y:sunDir.y*30,z:sunDir.z*30,w:6,h:6,c:0xfff0d0,k:6}]});
    lv.rig=makeRig(scene,{sun:2.4,sunColor:0xfff4e0,hemi:.7,sky:0xa8d0ff,ground:0x5a7a3a,dir:sunDir,span:50,dist:90,far:200});
    scene.fog=new THREE.Fog(col(0xc8e0f8),60,260); lv.fogCol=scene.fog.color.clone();
    // ground: one grass texel grid, 1 block = 1 metre
    const gt=BLOCKTEX.grassTop().clone(); gt.needsUpdate=true; gt.repeat.set(300,300);
    const gr=mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({map:gt,roughness:1}),0,0,0,false); gr.rotation.x=-Math.PI/2; gr.receiveShadow=true; scene.add(gr);
    const rt=BLOCKTEX.road().clone(); rt.needsUpdate=true; rt.repeat.set(300,6);
    const road=mesh(new THREE.PlaneGeometry(300,6),new THREE.MeshStandardMaterial({map:rt,roughness:1}),0,.02,3,false); road.rotation.x=-Math.PI/2; road.receiveShadow=true; scene.add(road);
    const B={}; for(const k of ['brick','whiteWall','plank','roof','glass','door','stone','log','leaves','dirt','grass']) B[k]=new VoxBatch(k==='grass'?grassBlockMats():blockMat(k,k==='glass'?{transparent:true,opacity:.75,roughness:.1}:k==='leaves'?{roughness:.9}:{}));
    const lines=new VoxBatch(new THREE.MeshStandardMaterial({color:col(0xf4f4f0),roughness:.9}));
    for(let x=-140;x<140;x+=4) lines.add(x,.03,3,2,.02,.25);
    // houses on both sides of the road
    lv.houses=[];
    const walls=['brick','whiteWall','plank'];
    for(let i=0;i<6;i++){ const x=-50+i*20; for(const side of [-1,1]){ const z=side<0?-9:15; const wall=walls[(i+(side>0?1:0))%3]; blockHouse(B,x,z,{wall,face:side<0?1:-1}); colBoxC(lv.col,x,z,7,7); lv.houses.push({x,z,door:V3(x,0,side<0?z+4:z-4)}); } }
    for(const [x,z] of [[-60,-22],[-35,-24],[-10,-26],[18,-23],[42,-25],[64,-20],[-58,30],[-28,31],[4,32],[30,30],[58,31],[-72,4],[76,-2]]){ blockTree(B,x,z,rand(4,6)|0); colCircle(lv.col,x,z,.7); }
    // hills around the town
    const r=RNG(9); for(let n=0;n<420;n++){ const a=r()*6.28, d=70+r()*70; const x=Math.round(Math.cos(a)*d), z=Math.round(Math.sin(a)*d); const hh=1+Math.floor(r()*r()*8); colBoxC(lv.col,x,z,2,2); for(let j=0;j<hh;j++) (j===hh-1?B.grass:B.dirt).add(x,j+.5,z,2,1,2); }
    lv.vox={}; for(const k in B) lv.vox[k]=B[k].build(scene,k!=='glass');
    lines.build(scene,false);
    // square blocky clouds + a square sun
    const cm=new THREE.MeshBasicMaterial({color:col(0xffffff),transparent:true,opacity:.92,fog:false}); lv.clouds=[];
    for(let i=0;i<22;i++){ const c=new THREE.Group(); const n=2+(Math.random()*4|0); for(let k=0;k<n;k++) c.add(box(rand(8,16),2,rand(5,10),cm,rand(-8,8),0,rand(-4,4),false)); c.position.set(rand(-250,250),rand(55,70),rand(-250,250)); scene.add(c); lv.clouds.push(c); }
    const sun=mesh(new THREE.PlaneGeometry(26,26),new THREE.MeshBasicMaterial({color:col(0xfff4c0).multiplyScalar(3),fog:false}),sunDir.x*500,sunDir.y*500,sunDir.z*500,false); sun.lookAt(0,0,0); scene.add(sun); lv.sunSq=sun;
    // Bob, and everybody else (blocky people)
    lv.bob=makeBlockPerson({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0xe8872a,pants:0x3a3a4a,hair:0x3a2414,beard:true}); lv.bob.userData.level='blockearth'; scene.add(lv.bob);
    const pal=[[0xd8a880,0xd83a3a,0x2a3a6a,0x2a1a0a],[0x8a5a3a,0x3ab85a,0x2a2a2a,0x101010],[0xf0c8a8,0xf0d040,0x3a4a8a,0xd8a040],[0xc89068,0x9a4ad8,0x4a3a2a,0x5a3a1a],[0xe8b890,0x3ab8d8,0x5a2a2a,0x8a5a2a],[0x6a4a2a,0xffffff,0x2a2a4a,0x0a0a0a],[0xd8a880,0x5a5a5a,0x2a3a2a,0x4a2a1a],[0xf0c8a8,0xff7ab8,0x2a2a4a,0xc89040]];
    lv.folk=pal.map((p,i)=>{ const f=makeBlockPerson({name:'Person',skin:p[0],shirt:p[1],pants:p[2],hair:p[3]}); f.userData.level='blockearth'; scene.add(f); const loop=[]; const cx=rand(-40,40), cz=rand(-2,8); for(let k=0;k<4;k++) loop.push(V3(cx+rand(-9,9),0,cz+rand(-4,4))); f.userData.loop=loop; f.userData.li=0; f.position.copy(loop[0]); return f; });
    // Steve's ship, up in the sky
    const ship=new THREE.Group(); ship.position.set(-24,58,-90); scene.add(ship); lv.ship=ship;
    const hull=mesh(new THREE.SphereGeometry(10,40,16),new THREE.MeshStandardMaterial({color:col(0x4a5652),roughness:.35,metalness:.8}),0,0,0); hull.scale.set(1,.28,1); ship.add(hull);
    const dome=mesh(new THREE.SphereGeometry(4,32,16,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:col(0x9aff8a),roughness:.1,metalness:.3,emissive:col(0x2a8a2a)}),0,2,0); ship.add(dome);
    for(let i=0;i<12;i++){ const a=i/12*6.28; ship.add(sph(.6,basicGlow(0x5aff6a,3),Math.cos(a)*9.2,-.4,Math.sin(a)*9.2,10,8,false)); }
    // the flying XXX5 (small, far away) and the 3-headed one for later
    lv.xFly=makeXXX5(1); lv.xFly.visible=false; scene.add(lv.xFly);
    lv.xBig=makeXXX5(3); lv.xBig.visible=false; lv.xBig.scale.setScalar(7); lv.xBig.position.set(6,48,-70); scene.add(lv.xBig);
    // debris cubes
    lv.debris=[]; const dM=new THREE.MeshStandardMaterial({color:col(0x4a5652),roughness:.4,metalness:.7});
    for(let i=0;i<40;i++){ const d=box(rand(.6,2),rand(.6,2),rand(.6,2),dM,0,0,0); d.visible=false; scene.add(d); lv.debris.push({o:d,v:V3()}); }
    // Jim's rocket (lands later)
    lv.rocket=makeRocket(); lv.rocket.visible=false; lv.rocket.position.set(12,0,3); scene.add(lv.rocket); lv.rocketCol=colCircle(lv.col,12,3,1.6,()=>lv.rocket.visible);
    lv.jim=makeBlockJim(); lv.jim.userData.level='blockearth'; lv.jim.visible=false; scene.add(lv.jim);
    // burning Earth (3 years later): fires, smoke, people being lifted
    const fireT=BLOCKTEX.fire(); lv.fires=[];
    const fm=new THREE.SpriteMaterial({map:fireT,color:col(0xffffff).multiplyScalar(2.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    for(const h of lv.houses){ for(let k=0;k<3;k++){ const s=new THREE.Sprite(fm); s.scale.set(rand(3,5),rand(3,5),1); s.position.set(h.x+rand(-3,3),rand(4,7),h.z+rand(-3,3)); s.visible=false; scene.add(s); lv.fires.push({s,ph:rand(0,6),y:s.position.y,sx:s.scale.x}); } }
    lv.fireLight=new THREE.PointLight(col(0xff7a2a),0,120,1.5); lv.fireLight.position.set(0,12,3); scene.add(lv.fireLight);
    lv.lifted=[]; lv.burning=false; lv.smokeT=0;
    lv.col.bounds=[-90,90,-40,40];
  },
  enter(){ FX.sunWorld=this.burning?null:this.sunSq.position.clone(); },
  /* punch blocks out of the houses (like you know what game) */
  onPrimary(){ const lv=this; if(!PLAYER.ctl.move||DLG.active||CAM.active) return false; VM.punchT=.28; SFX.punch&&SFX.punch();
    const rc=new THREE.Raycaster(); rc.setFromCamera({x:0,y:0},camera); rc.far=4.5; const targets=['brick','whiteWall','plank','roof','glass','door','log','leaves'].map(k=>lv.vox[k]).filter(Boolean);
    const hit=rc.intersectObjects(targets,false)[0]; if(!hit||hit.instanceId==null) return true;
    const im=hit.object, m=new THREE.Matrix4(); im.getMatrixAt(hit.instanceId,m); const p=new THREE.Vector3().setFromMatrixPosition(m);
    m.makeScale(0,0,0); im.setMatrixAt(hit.instanceId,m); im.instanceMatrix.needsUpdate=true;
    const c=im.material.map?0xb08060:0xffffff; lv.soft.burst(p,{color:im===lv.vox.leaves?0x3a7a2a:im===lv.vox.glass?0x9ad4ec:im===lv.vox.roof?0x5a3a34:im===lv.vox.brick?0xa8483a:c,count:18,speed:3,size:.12,life:.9,grav:9});
    SFX.crunch(); shake(.05); const n=trophyStat('blocks'); if(n>=20) unlock('miner'); if(n===1) toast('You punched a block out!','#9aff7a'); return true; },
  setBurning(on){ const lv=this; lv.burning=on; for(const f of lv.fires) f.s.visible=on; lv.fireLight.intensity=on?3:0;
    const u=lv.sky.userData.u; u.top.value.set(on?0x3a1a24:0x3a7ae8); u.mid.value.set(on?0x8a3a2a:0x8ac0f8); u.hor.value.set(on?0xe86a3a:0xd8ecff); u.k.value=on?.8:1;
    lv.scene.fog.color.set(on?0x6a3a2a:0xc8e0f8); lv.scene.fog.near=on?20:60; lv.scene.fog.far=on?180:260; lv.rig.sun.intensity=on?.9:2.4; lv.rig.sun.color.set(on?0xff9a6a:0xfff4e0); lv.sunSq.visible=!on;
    lv.xBig.visible=on; },
  update(dt,t){
    const lv=this;
    for(const c of lv.clouds){ c.position.x+=dt*1.2; if(c.position.x>260) c.position.x=-260; }
    // everybody walks (or panics) around their little loop
    for(const f of lv.folk){ if(!f.visible||f.userData.lifted) continue; const A=f.userData.A; if(!A.path){ f.userData.li=(f.userData.li+1)%f.userData.loop.length; folkWalk(f,[f.userData.loop[f.userData.li]],A.mode==='panic'?3.4:1.4); } }
    updateFolk(dt,t); if(lv.jeff&&lv.jeff.visible) animateDog(lv.jeff,dt,t);
    if(lv.xFly.visible) animateXXX5(lv.xFly,t,{});
    if(lv.xBig.visible) animateXXX5(lv.xBig,t,{beam:lv.burning&&!lv.headBeamsOff,beamLen:11.5,rage:true});
    for(const d of lv.debris){ if(!d.o.visible) continue; d.v.y-=18*dt; d.o.position.addScaledVector(d.v,dt); d.o.rotation.x+=dt*2; d.o.rotation.y+=dt*1.5; if(d.o.position.y<-5) d.o.visible=false; }
    if(lv.burning){ for(const f of lv.fires){ f.s.position.y=f.y+Math.sin(t*6+f.ph)*.2; f.s.scale.x=f.sx*(1+Math.sin(t*9+f.ph)*.1); }
      lv.fireLight.intensity=2.6+Math.sin(t*11)*.5;
      lv.smokeT-=dt; if(lv.smokeT<=0){ lv.smokeT=.06; const h=pick(lv.houses); lv.soft.spawn(h.x+rand(-3,3),rand(6,8),h.z+rand(-3,3),rand(-.3,.3),rand(1.5,3),rand(-.3,.3),rand(5,8),rand(2,4),.18,.15,.14,.55,0,-.02,2);
        const f=pick(lv.fires); lv.glow.spawn(f.s.position.x+rand(-1,1),f.s.position.y,f.s.position.z+rand(-1,1),rand(-.5,.5),rand(2,4),rand(-.5,.5),rand(1,2),rand(.1,.2),1,.6,.2,1,-1,0,0); } }
    for(const L of lv.lifted){ if(!L.p.visible) continue; L.k+=dt/L.dur; const m=L.to; L.p.position.lerpVectors(L.from,m,Math.min(1,L.k*L.k)); L.p.rotation.y+=dt*2; if(L.k>=1){ L.p.visible=false; } }
  }
});
/* someone gets lifted into XXX5's mouth by the purple light */
function liftPerson(lv,p,dur=4){ p.userData.lifted=true; p.userData.A.path=null; p.userData.A.mode='lifted'; const H=lv.xBig.userData.heads; const m=pick(H).H.getWorldPosition(new THREE.Vector3()); lv.lifted.push({p,from:p.position.clone(),to:m,k:0,dur}); if(Math.random()<.8) sfxAt(p.position,()=>SFX.scream(),6); }

/* the voxel Earth, seen from space */
function makeBlockPlanet(R=30,o={}){
  const g=new THREE.Group(); const pos=[]; const cols=[];
  for(let x=-R;x<=R;x++) for(let y=-R;y<=R;y++) for(let z=-R;z<=R;z++){ const d=Math.hypot(x,y,z); if(d>R||d<R-1.8) continue;
    const n=Math.sin(x*.21)*Math.cos(z*.17)+Math.sin(y*.19+x*.07)*.8+Math.sin((x+z)*.11)*.5; const lat=Math.abs(y)/R;
    let c; if(lat>.85) c=0xf4f8ff; else if(n>.35) c=lat>.6?0x8aa870:(n>.9?0x8a6a3a:0x4a9a3a); else c=0x2a5ad8;
    if(o.dead) c=pick([0x3a2a3a,0x5a2a2a,0x8a3a2a,0x2a1a2a]); pos.push(x,y,z); cols.push(c); }
  const im=new THREE.InstancedMesh(_U1,new THREE.MeshStandardMaterial({roughness:.8}),pos.length/3); const ob=new THREE.Object3D(); const cc=new THREE.Color();
  for(let i=0;i<pos.length/3;i++){ ob.position.set(pos[i*3],pos[i*3+1],pos[i*3+2]); ob.updateMatrix(); im.setMatrixAt(i,ob.matrix); cc.set(cols[i]); im.setColorAt(i,cc); }
  g.add(im); return g;
}
defineLevel('xspace',{
  title:'space',
  env:{fx:{exposure:1.1,contrast:1.12,bloomStrength:.4,bloomThreshold:1.1,vignette:.5},music:'burning',reverb:0,amb:[['spaceDrone',.08],['rocket',.2]],far:9000},
  async build(scene,lv){
    scene.background=col(0x000000);
    scene.add(makeStars(dq(4000,6000,9000,12000,16000),4000,{band:true,k:1.6,seed:44}));
    const sunDir=V3(-.4,.2,-1).normalize();
    lv.envMap=makeEnv({top:0x05070c,horizon:0x0a0c14,bottom:0x020204,lights:[{x:sunDir.x*40,y:sunDir.y*40,z:sunDir.z*40,w:5,h:5,c:0xffffff,k:10}]});
    makeRig(scene,{sun:3,sunColor:0xfff4e6,hemi:.12,sky:0x3a4a6a,ground:0x000000,dir:sunDir,span:200,dist:400,far:900});
    scene.add(mesh(new THREE.SphereGeometry(70,24,16),basicGlow(0xfff4e0,40),sunDir.x*3800,sunDir.y*3800,sunDir.z*3800,false));
    lv.earth=makeBlockPlanet(30); lv.earth.position.set(-260,-40,-520); scene.add(lv.earth);
    lv.x3=makeXXX5(3); lv.x3.scale.setScalar(9); lv.x3.position.set(-120,10,-420); scene.add(lv.x3);
    // where Mars used to be: a few red blocks, drifting
    lv.bits=[]; const rm=new THREE.MeshStandardMaterial({color:col(0xc86a3a),roughness:.9});
    for(let i=0;i<70;i++){ const b=box(rand(1,6),rand(1,6),rand(1,6),rm,rand(-60,60),rand(-40,40),rand(-60,60)); b.position.add(V3(420,0,-300)); scene.add(b); lv.bits.push({b,s:V3(rand(-.3,.3),rand(-.3,.3),rand(-.3,.3))}); }
    lv.rocket=makeRocket(); lv.rocket.rotation.z=-Math.PI/2; scene.add(lv.rocket); setRocketFlame(lv.rocket,1);
    lv.rx=0;
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){ const lv=this; lv.rx+=dt*(lv.speed||30); lv.rocket.position.set(lv.rx,Math.sin(t*1.5)*.3,0);
    animateXXX5(lv.x3,t,{rage:true}); lv.x3.position.x+=dt*-2; lv.x3.lookAt(lv.earth.position);
    lv.earth.rotation.y+=dt*.02; for(const b of lv.bits){ b.b.rotation.x+=b.s.x*dt; b.b.rotation.y+=b.s.y*dt; }
    if(Math.random()<dt*60){ const p=lv.rocket.localToWorld(V3(rand(-.4,.4),-3.2,rand(-.4,.4))); lv.glow.spawn(p.x,p.y,p.z,-rand(8,14),rand(-1,1),rand(-1,1),rand(.3,.7),rand(.5,1.1),1,.55,.2,.8,0,.5,1.5); } }
});

/* ================= B10: BLOCKY EARTH ================= */
CHECKPOINTS.B10=async()=>{
  const lv=await enterLevel('blockearth',{pos:V3(-6,0,7),yaw:.3});
  setCheckpoint('B10'); const F=F_(); F.day=3;
  PLAYER.lock(); crosshair(true); setVM(true); setVMBlocky(true); PLAYER.hasWatch=true; PLAYER.stitched=true; PLAYER.eye=1.64;
  hudVisible(true); showCash(false); showCoins(false); objective(null);
  lv.setBurning(false); lv.ship.visible=true; lv.rocket.visible=false; lv.jim.visible=false; lv.xFly.visible=false;
  const bob=lv.bob; bob.visible=true; bob.position.set(1.5,0,-4); bob.rotation.y=Math.PI; bob.userData.A.mode=null; bob.userData.A.look=null; bob.rotation.z=0;
  for(const f of lv.folk){ f.visible=true; f.userData.lifted=false; f.userData.A.mode='panic'; }
  lookAtPoint(lv.ship.position,0);
  FX.whiteout=1; fade(0,.1); playMusic(null);
  await tweenVal(k=>{ FX.whiteout=1-k; },1.6);
  await wait(1.2);
  // the ship explodes
  SFX.shipBoom(); flashWhite(1,1.2); shake(.8);
  const sp=lv.ship.position.clone(); lv.ship.visible=false;
  for(let i=0;i<5;i++) lv.glow.burst(sp.clone().add(V3(rand(-6,6),rand(-3,3),rand(-6,6))),{color:pick([0xffa040,0xffe080,0xc86aff]),count:40,speed:18,size:2.2,life:1.8,grav:2});
  for(let i=0;i<4;i++) lv.soft.burst(sp,{color:0x3a3434,count:20,speed:8,size:6,life:4,grav:-1,grow:2,alpha:.7});
  for(const d of lv.debris){ d.o.visible=true; d.o.position.copy(sp).add(V3(rand(-6,6),rand(-2,2),rand(-6,6))); d.v.set(rand(-14,14),rand(0,14),rand(-14,14)); }
  await wait(1.8);
  // XXX5 flies out of the smoke, and away
  const X=lv.xFly; X.visible=true; X.scale.setScalar(2.2); X.position.copy(sp); SFX.xxxRoar();
  lookAtPoint(sp,.4); playMusic('xxx5',.5);
  await tweenVal(k=>{ X.position.set(sp.x+k*40,sp.y+k*k*240,sp.z-k*120); PLAYER.lookTo=null; lookAtPoint(X.position,0); },5,x=>x);
  X.visible=false;
  say('XXX5 starts going for other planets.',3.6); await wait(3.6);
  playMusic('blocky',2);
  // everything is blocks now
  lookAtPoint(V3(PLAYER.pos.x+2,1.5,PLAYER.pos.z-8),.8); await wait(1);
  bark('You',"Everything's... made of blocks.",null,2.6); await wait(2.4);
  VM.handsLook=1; PLAYER.pitch=-.1; await wait(.3);
  bark('You',"My hands...",null,2.2); await wait(2.4); VM.handsLook=0;
  lookAtPoint(lv.folk[0].position.clone().add(V3(0,1.2,0)),.8);
  bark('You',"Everybody...",null,2.4); await wait(2.4);
  objective('Go to Bob'); setMarker(()=>bob.position.clone().add(V3(0,2.2,0)),'Bob','m');
  if(!lv.storySetup){ lv.storySetup=true;
    addTrigger(lv,{pos:bob.position,r:3.2,once:true,when:()=>F_().day===3&&!F_().bobTalk,fn:()=>runStory(bobTalk)});
    lv.callIt=addInteract(lv,{pos:V3(),label:'Call Jim on your watch',reach:5,aim:false,when:()=>!!F_().callJim,act:()=>runStory(callJimEarth)});
    addInteract(lv,{obj:lv.rocket,offset:V3(0,1.5,1.2),label:'Get in the rocket',reach:3.4,aim:false,when:()=>!!F_().getIn,act:()=>runStory(leaveEarth)});
    on('tick',()=>{ if(lv.callIt) lv.callIt.pos.copy(PLAYER.pos); });
  }
  PLAYER.free();
};
async function bobTalk(){
  const lv=LEVELS.blockearth, bob=lv.bob, F=F_(); F.bobTalk=true; PLAYER.lock(); objective(null); setMarker(null);
  bob.userData.A.look='player'; bob.rotation.y=Math.atan2(PLAYER.pos.x-bob.position.x,PLAYER.pos.z-bob.position.z);
  lookAtPoint(bob.position.clone().add(V3(0,1.55,0)),.6);
  const B={h:bob,who:'Bob'};
  await talk([{...B,text:"What is going on? Why is everything blocky? Did you do this?"},{who:'You',text:"I'm sorry, Bob. Trust me. I'm calling Jim right now."},{...B,text:"...",auto:1.2},{...B,text:"...Okay. I trust you."}]);
  F.callJim=true; objective('Call Jim on your watch'); PLAYER.free();
}
async function callJimEarth(){
  const lv=LEVELS.blockearth, F=F_(); if(!F.callJim) return; F.callJim=false; PLAYER.lock(); objective(null);
  PLAYER.watchLook=1; PLAYER.watchGlow=1; SFX.ring(); await wait(1.4); PLAYER.watchGlow=0;
  const J={who:'Jim',radio:true};
  await talk([{...J,text:"What is happening!?"},{who:'You',text:"I did something."},{...J,text:"People are dying. You know that, right..."},{who:'You',text:"I'm sorry, I—",auto:.2},{...J,text:"It doesn't matter what happened. I'm coming to get you in the rocket. Where are you?"},{who:'You',text:"I'm at Earth."},{...J,text:"Ok. Stay where you are. I'm coming."}]);
  PLAYER.watchLook=0;
  await tweenVal(k=>{ FX.blackout=k; },1); cardShow('1 HOUR LATER',''); await wait(2.6); cardHide();
  // Jim's rocket lands on the road
  const R=lv.rocket; R.visible=true; R.position.set(12,40,3); setRocketFlame(R,1); letterbox(true);
  PLAYER.pos.set(4,0,9); PLAYER.yaw=0; const bob=lv.bob; bob.position.set(5.5,0,8.5); bob.userData.A.look=null;
  camShot(V3(-2,2.5,16),V3(12,6,3),{dur:0,fov:48});
  await tweenVal(k=>{ FX.blackout=1-k; },.8);
  setAmbience([['rocket',.3],['breeze',.04]]);
  await tweenVal(k=>{ R.position.y=lerp(40,0,smooth(k)); lv.soft.spawn(12+rand(-2,2),.3,3+rand(-2,2),rand(-4,4),rand(0,1),rand(-4,4),rand(1,2),rand(1.5,3),.8,.75,.7,.5,0,.2,2); },4,x=>x);
  setRocketFlame(R,0); SFX.thud(); shake(.3); setAmbience([['breeze',.05]]);
  await wait(.8);
  const jim=lv.jim; jim.visible=true; jim.position.set(12,0,4.6); jim.rotation.y=-.5; jim.userData.A.look='player'; setMood(jim,'worried');
  camShot(V3(7,1.7,9),V3(12,1.5,4.6),{dur:1.2,fov:40}); await wait(1.3);
  await talk([{h:jim,who:'Jim',text:"Get in.",pose:'point'}]);
  clearPose(jim); camRelease(.6); letterbox(false);
  F_().getIn=true; objective('Get in the rocket'); PLAYER.free();
}
async function leaveEarth(){
  const lv=LEVELS.blockearth, F=F_(); F.getIn=false; PLAYER.lock(); objective(null);
  sfxAt(PLAYER.pos,()=>SFX.doorClose&&SFX.doorClose(),2); await fade(1,.6);
  lv.jim.visible=false; lv.bob.visible=false;
  letterbox(true);
  camShot(V3(-4,3,20),V3(12,8,3),{dur:0,fov:50});
  await fade(0,.6);
  setRocketFlame(lv.rocket,1); setAmbience([['rocket',.5]]); SFX.ignite&&SFX.ignite(); shake(.4);
  await tweenVal(k=>{ lv.rocket.position.y=k*k*120; },3.5,x=>x);
  await fade(1,.6); camRelease(0);
  // space: XXX5 has three heads now
  const sp=await enterLevel('xspace',{pos:V3(0,0,40)}); sp.rx=-40; sp.speed=24;
  camFollow(t=>({pos:V3(sp.rx+14,4,16),look:V3(sp.rx,0,0)}),50);
  await fade(0,.8); await wait(2.5);
  camShot(V3(sp.rx+30,20,40),sp.x3.position,{dur:2.6,fov:38}); await wait(2.4);
  say("XXX5 has three heads now. And it's bigger. And it's going for Earth.",4.6); await wait(3);
  await talk([{who:'Jim',text:"We have to do something."}]);
  camShot(V3(sp.rx+60,10,20),V3(420,0,-300),{dur:2.4,fov:40}); await wait(2.4);
  say("Where Mars should be... there's nothing. XXX5 ate it.",4.4); await wait(4.6);
  await fade(1,.8); camRelease(0); letterbox(false);
  startFromCheckpointInner('B11');
}

