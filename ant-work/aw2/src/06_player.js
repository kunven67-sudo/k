/* ================================================================
   PLAYER — first-person controller, flying, shrinking, camera feel,
   cutscene camera, first-person hands / watch / camera / carried items
   ================================================================ */
const PLAYER={
  pos:V3(), vel:V3(), yaw:0, pitch:0, roll:0, vy:0, y:0, onGround:true,
  eye:1.64, radius:.32, speed:3.3, scale:1, targetScale:1,
  ctl:{move:false,look:false,interact:false,jump:true},
  fly:false, swim:false, swimPh:0, swimW:0, inMag:0, gravity:13, surface:'wood',
  bobT:0, bobAmt:0, land:0, trauma:0, fovKick:0, sprint:false, stamina:1,
  item:null, carry:null, hp:100, maxHp:100, hpOn:false,
  canInteract(){ return this.ctl.interact && !DLG.active && G.mode==='play' && !CAM.active; },
  /* cutscene start: stop dead where you are (you used to keep sliding/drifting into the scene, worst on the Moon) */
  lock(){ this.ctl.move=false; this.ctl.look=false; this.ctl.interact=false; this.sprint=false; if(this.fly) this.vel.set(0,0,0); else { this.vel.x=0; this.vel.z=0; } },
  free(){ this.ctl.move=true; this.ctl.look=true; this.ctl.interact=true; },
  enterLevel(lv,spawn){
    if(spawn.pos) this.pos.copy(spawn.pos);
    if(spawn.yaw!=null) this.yaw=spawn.yaw; if(spawn.pitch!=null) this.pitch=spawn.pitch; else this.pitch=0;
    this.vel.set(0,0,0); this.vy=0; this.onGround=true; this.y=0;
    const E=lv.env||{}; this.gravity=E.gravity||13; this.speed=E.speed||3.3; this.fly=!!E.fly; this.swim=!!E.swim;
    if(!spawn.keepScale){ this.scale=this.targetScale=1; }
    lv.scene.add(camera);
    this.groundY=lv.ground?lv.ground(this.pos.x,this.pos.z):0;
  }
};
/* ---------- camera shake (smooth noise, "trauma" model) ---------- */
function shake(amount){ if(!SETTINGS.shake) amount*=.25; PLAYER.trauma=Math.min(1.2,PLAYER.trauma+amount); }
/* ---------- the update ---------- */
const _mv=new THREE.Vector3(), _fw=new THREE.Vector3(), _rt=new THREE.Vector3();
let stepTimer=0, footSide=0;
function updatePlayer(dt,t){
  const P=PLAYER, lv=LV; if(!lv) return;
  // look
  const [dx,dy]=consumeLook();
  if(P.ctl.look && G.mode==='play' && !CAM.active){
    const k=.0022*SETTINGS.sens*(P.scale<.5?.8:1);
    P.yaw-=dx*k; P.pitch-=dy*k*(SETTINGS.invertY?-1:1);
    P.yaw-=TOUCH.lookDX*.006*SETTINGS.sens; P.pitch-=TOUCH.lookDY*.006*SETTINGS.sens;
    P.pitch=clamp(P.pitch,-1.45,1.45);
  }
  TOUCH.lookDX=0; TOUCH.lookDY=0;
  if(P.lookTo){ const L=P.lookTo; L.t+=dt; const k=smooth(L.t/L.dur); P.yaw=L.y0+angDiff(L.y0,L.y1)*k; P.pitch=lerp(L.p0,L.p1,k); if(L.t>=L.dur) P.lookTo=null; }
  // scale (shrink / grow animation)
  if(Math.abs(P.scale-P.targetScale)>1e-4){ P.scale=damp(P.scale,P.targetScale,5,dt); if(Math.abs(P.scale-P.targetScale)<.002) P.scale=P.targetScale; }
  // movement input
  let ix=TOUCH.moveX, iz=TOUCH.moveZ;
  if(keys.KeyW||keys.ArrowUp) iz-=1; if(keys.KeyS||keys.ArrowDown) iz+=1; if(keys.KeyA||keys.ArrowLeft) ix-=1; if(keys.KeyD||keys.ArrowRight) ix+=1;
  let mag=Math.hypot(ix,iz); if(mag>1){ ix/=mag; iz/=mag; mag=1; }
  const canMove=P.ctl.move && G.mode==='play' && !CAM.active && !DLG.active;
  if(!canMove){ ix=0; iz=0; mag=0; }
  P.inMag=mag;
  P.sprint=canMove && mag>.1 && (keys.ShiftLeft||keys.ShiftRight||TOUCH.run);
  const sp=P.speed*(P.sprint?1.75:1)*(P.scale<1?Math.max(.45,Math.pow(P.scale,.35))*1.25:1)*(P.carry?.85:1);   // tiny = 25% faster than before (asked for)
  const sy=Math.sin(P.yaw), cy=Math.cos(P.yaw);
  if(P.fly){
    camera.getWorldDirection(_fw); _rt.set(cy,0,-sy);
    _mv.set(0,0,0).addScaledVector(_fw,-iz).addScaledVector(_rt,ix);
    if(canMove){ if(keys.Space||TOUCH.up) _mv.y+=1; if(keys.KeyC||keys.ControlLeft||TOUCH.down) _mv.y-=1; }
    if(_mv.lengthSq()>1) _mv.normalize();
    // swimming: each breaststroke gives a push, so you surge forward in pulses
    let surge=1;
    if(P.swim){ const mvK=P.autoSwim?1:Math.min(1,_mv.length()); P.swimW=damp(P.swimW,mvK>.1?1:0,4,dt);
      const prev=P.swimPh; P.swimPh=(P.swimPh+dt*(P.swimW>.5?.62*(P.sprint?1.35:1):.32))%1;
      if(P.swimW>.5){ const ph=P.swimPh; surge=.55+Math.max(0,Math.sin(clamp((ph-.28)/.32,0,1)*Math.PI))*1.6; if(prev<.28&&ph>=.28) SFX.swimStroke(); }
      else if(prev>P.swimPh && Math.random()<.5) SFX.swimScull(); }
    P.vel.addScaledVector(_mv,sp*2.2*dt*surge);
    P.vel.multiplyScalar(Math.exp(-1.6*dt));
    P.pos.addScaledVector(P.vel,dt);
    if(lv.solids&&(P.ctl.move||P.vel.lengthSq()>.25)) resolveSolids3(lv,P.pos,P.vel,lv.swimR||1.6);
    P.pos.y+=Math.sin(t*.8)*.02*dt;
    if(lv.flyBounds) lv.flyBounds(P.pos,P.vel);
    P.roll=damp(P.roll,-ix*.08,4,dt);
    P.moving=P.vel.length()>.2;
  } else {
    const wx=(ix*cy+iz*sy)*sp, wz=(-ix*sy+iz*cy)*sp;
    const accel=P.onGround?14:(lv.env&&lv.env.gravity<5?2.5:4);
    P.vel.x=damp(P.vel.x,wx,accel,dt); P.vel.z=damp(P.vel.z,wz,accel,dt);
    P.pos.x+=P.vel.x*dt; P.pos.z+=P.vel.z*dt;
    // (while a cutscene holds you in place, nothing shoves you around)
    if(P.ctl.move||Math.abs(P.vel.x)+Math.abs(P.vel.z)>.05){ resolveCol(lv.col,P.pos,P.radius*Math.max(.12,P.scale)); pushOutNPCs(P.pos,P.radius*Math.max(.12,P.scale)); }
    if(lv.onMove) lv.onMove(P.pos);
    // ground + jumping
    const gy=lv.ground?lv.ground(P.pos.x,P.pos.z):0;
    if(P.onGround){ P.y=damp(P.y,gy,20,dt); if(gy<P.y-.35){ P.onGround=false; P.vy=0; } }
    else { P.vy-=P.gravity*dt; P.y+=P.vy*dt; if(P.y<=gy){ const impact=-P.vy; P.y=gy; P.vy=0; P.onGround=true; if(impact>2){ P.land=Math.min(.12,impact*.012)*P.scale; SFX.land(lv.surfaceAt?lv.surfaceAt(P.pos.x,P.pos.z):lv.env.surface,P.scale<1?.3:1); if(lv.onLand) lv.onLand(impact); } } }
    const hs=Math.hypot(P.vel.x,P.vel.z); P.moving=hs>.3;
    P.roll=damp(P.roll,-ix*.012,6,dt);
    // footsteps
    if(P.onGround && hs>.4){
      stepTimer-=dt*hs/(P.sprint?2.6:1.9)*(P.scale<1?1/Math.max(.3,Math.pow(P.scale,.35)):1);
      if(stepTimer<=0){ stepTimer=.5; footSide^=1; const surf=lv.surfaceAt?lv.surfaceAt(P.pos.x,P.pos.z):(lv.env.surface||'wood'); SFX.step(P.scale<.5?'tiny':surf,(P.sprint?1.2:.85)*(P.scale<.5?.6:1)); }
    }
  }
  // stamina
  if(P.sprint && P.moving){ P.stamina=Math.max(0,P.stamina-dt*.12); if(P.stamina<=0) P.sprint=false; } else P.stamina=Math.min(1,P.stamina+dt*.2);
  // head bob
  const hs2=P.fly?0:Math.hypot(P.vel.x,P.vel.z);
  P.bobAmt=damp(P.bobAmt,P.onGround&&hs2>.3?Math.min(1,hs2/4):0,8,dt);
  P.bobT+=dt*hs2*2.2/(P.scale<1?Math.max(.3,P.scale):1);
  P.land=damp(P.land,0,7,dt);
  P.trauma=Math.max(0,P.trauma-dt*.9);
  P.fovKick=damp(P.fovKick,0,3,dt);
}
/* people, aliens, robots, blocky people and dogs are solid too */
function sceneOf(o){ while(o.parent) o=o.parent; return o; }
function pushOutNPCs(pos,r){
  if(!LV) return; const sc=LV.scene;
  const test=(n,rad)=>{ if(!n||!n.visible||!n.parent||n.userData.noPush) return; if(sceneOf(n)!==sc) return; const w=n.getWorldPosition(_npw); const dx=pos.x-w.x, dz=pos.z-w.z, d=Math.hypot(dx,dz), m=r+rad; if(d<m&&d>1e-4){ pos.x=w.x+dx/d*m; pos.z=w.z+dz/d*m; } };
  for(const h of HUMANS) test(h,.28*h.scale.x);
  for(const h of ROBOTS) test(h,.38*h.scale.x);
  if(typeof FOLK!=='undefined') for(const h of FOLK) test(h,.3*h.scale.x);
  if(LV.jeff) test(LV.jeff,.32);
}
const _npw=new THREE.Vector3();
function jump(){
  const P=PLAYER; if(!P.ctl.move||!P.ctl.jump||G.mode!=='play'||CAM.active||DLG.active||P.fly) return;
  if(!P.onGround) return;
  P.vy=(LV.env&&LV.env.jump)||4.6; if(P.scale<1) P.vy*=Math.max(.5,Math.sqrt(P.scale)); P.onGround=false; SFX.jump(); if(typeof funnyOn==='function'&&funnyOn()&&trophyStat('fjumps')>=30) unlock('bouncy');
}
/* smoothly turn the player's view toward a world point */
function lookAtPoint(p,dur=.6){ const P=PLAYER, ey=P.pos.y+P.y+P.eye*P.scale; const yaw=Math.atan2(-(p.x-P.pos.x),-(p.z-P.pos.z)); const pitch=Math.atan2(p.y-ey,Math.hypot(p.x-P.pos.x,p.z-P.pos.z)); P.lookTo={t:0,dur,y0:P.yaw,y1:yaw,p0:P.pitch,p1:clamp(pitch,-1.2,1.2)}; }

/* on tall/narrow screens (phones held upright) widen the vertical FOV so the sideways view stays
   what it would be on a normal screen, instead of everything looking zoomed in */
function fitFov(v){ const a=camera.aspect; if(!(a<1.3)) return v; const t=Math.tan(v*Math.PI/360)*1.3/a; return Math.min(112,Math.max(v,2*Math.atan(t)*180/Math.PI)); }
/* ---------- camera: player view blended with a cutscene camera ---------- */
const CAM={active:false,blend:0,target:0,pos:V3(),quat:new THREE.Quaternion(),fov:70,from:null,tr:null,fn:null,releaseDur:.6,dof:null};
const _pq=new THREE.Quaternion(), _pp=new THREE.Vector3(), _e=new THREE.Euler(0,0,0,'YXZ'), _m4=new THREE.Matrix4(), _up=V3(0,1,0), _tq=new THREE.Quaternion(), _tp=new THREE.Vector3();
function lookQuat(from,to,q){ _m4.lookAt(from,to,_up); return q.setFromRotationMatrix(_m4); }
/* a cutscene camera never films through a house: if something big is between the camera and what it
   looks at, the camera moves in front of it (o.noClear turns this off for a shot) */
const _rcCam=new THREE.Raycaster(), _rcDir=new THREE.Vector3(), _rcS=new THREE.Vector3();
function camBlockers(){
  if(!LV||!LV.scene) return [];
  if(LV.__blk && LV.__blkN===LV.scene.children.length) return LV.__blk;
  const out=[];
  LV.scene.traverse(o=>{
    if(!o.isMesh||o.isSkinnedMesh||!o.geometry) return;
    const m=o.material; if(!m||Array.isArray(m)||m.transparent||m.opacity<1||m.blending!==THREE.NormalBlending||m.depthWrite===false) return;
    const g=o.geometry; if(!g.boundingSphere) g.computeBoundingSphere(); if(!g.boundingSphere) return;
    o.getWorldScale(_rcS); if(!o.isInstancedMesh && g.boundingSphere.radius*Math.max(_rcS.x,_rcS.y,_rcS.z)<1.6) return;
    for(let p=o;p;p=p.parent){ if(p===camera||(p.userData&&(p.userData.A||p.userData.noCamBlock))) return; }   // never people, never your hands, never the monster you are filming
    out.push(o);
  });
  LV.__blk=out; LV.__blkN=LV.scene.children.length; return out;
}
function clearShot(pos,look){
  try{
    _rcDir.copy(pos).sub(look); const D=_rcDir.length(); if(D<2) return pos; _rcDir.divideScalar(D);
    const blk=camBlockers(); if(!blk.length) return pos;
    _rcCam.set(look,_rcDir); _rcCam.near=1; _rcCam.far=D;
    const hit=_rcCam.intersectObjects(blk,false).find(h=>worldVisible(h.object));
    if(!hit) return pos;
    return look.clone().addScaledVector(_rcDir,Math.max(1.2,hit.distance-.45));
  }catch(e){ return pos; }
}
/* move the cutscene camera to a shot. dur=0 cuts. returns a promise that resolves when it arrives */
function camShot(pos,look,o={}){
  CAM.active=true; CAM.target=1; CAM.fn=null;
  if(!o.noClear && !RENDER.override) pos=clearShot(pos,look);
  const q=lookQuat(pos,look,new THREE.Quaternion());
  if(o.roll){ q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0,0,1),o.roll)); }
  const dur=o.dur!=null?o.dur:0;
  if(CAM.blend<.01||dur<=0){ CAM.pos.copy(pos); CAM.quat.copy(q); CAM.fov=o.fov||CAM.fov||SETTINGS.fov; if(CAM.blend<.01&&dur>0){ CAM.blend=0; CAM.blendDur=dur; } else { CAM.blend=1; } CAM.tr=null; if(dur<=0) invalidateMotion(); }
  else { CAM.tr={t:0,dur,p0:CAM.pos.clone(),p1:pos.clone(),q0:CAM.quat.clone(),q1:q,f0:CAM.fov,f1:o.fov||CAM.fov,ease:o.ease||easeInOut}; }
  if(o.dof!=null){ FX.dof=o.dof; FX.dofFocus=o.focus||pos.distanceTo(look); if(o.range) FX.dofRange=o.range; }
  return wait(Math.max(dur,0));
}
/* drive the camera with a function of time (for orbits, tracking shots) */
function camFollow(fn,fov){ CAM.active=true; CAM.target=1; CAM.tr=null; CAM.fn=fn; CAM.fnT=0; if(fov) CAM.fov=fov; }
function camRelease(dur=.6){ CAM.fn=null; CAM.tr=null; CAM.target=0; CAM.releaseDur=dur; if(dur<=0){ CAM.blend=0; CAM.active=false; invalidateMotion(); } FX.dof=0; }
const _nz=[0,0,0];
function updateCamera(dt,t){
  const P=PLAYER;
  // player camera pose
  const bob=SETTINGS.bob?P.bobAmt:P.bobAmt*.15;
  const s=P.scale;
  const eyeY=P.pos.y+P.y+P.eye*s - P.land + (P.fly?0:Math.abs(Math.sin(P.bobT))*.045*bob*s - .02*bob*s);
  _pp.set(P.pos.x+Math.cos(P.yaw)*Math.sin(P.bobT)*.025*bob*s,eyeY,P.pos.z-Math.sin(P.yaw)*Math.sin(P.bobT)*.025*bob*s);
  const tr=P.trauma*P.trauma; for(let i=0;i<3;i++) _nz[i]=noise1(t*12+i*31.7)*tr;
  _e.set(P.pitch+_nz[0]*.06+Math.sin(P.bobT*2)*.004*bob,P.yaw+_nz[1]*.06,P.roll+_nz[2]*.05+Math.sin(P.bobT)*.006*bob,'YXZ');
  _pq.setFromEuler(_e);
  let fov=SETTINGS.fov+P.fovKick+(P.sprint&&P.moving?4:0);
  // cutscene camera
  if(CAM.active){
    if(CAM.fn){ CAM.fnT+=dt; const r=CAM.fn(CAM.fnT,dt); if(r){ if(r.pos) CAM.pos.copy(r.pos); if(r.look) lookQuat(CAM.pos,r.look,CAM.quat); if(r.fov) CAM.fov=r.fov; } }
    if(CAM.tr){ const T=CAM.tr; T.t+=dt; const k=T.ease(clamp(T.t/T.dur,0,1)); CAM.pos.lerpVectors(T.p0,T.p1,k); CAM.quat.copy(T.q0).slerp(T.q1,k); CAM.fov=lerp(T.f0,T.f1,k); if(T.t>=T.dur) CAM.tr=null; }
    const bd=CAM.target?(CAM.blendDur||.5):(CAM.releaseDur||.6);
    CAM.blend=clamp(CAM.blend+(CAM.target?1:-1)*dt/Math.max(.01,bd),0,1);
    if(!CAM.target && CAM.blend<=0){ CAM.active=false; }
    const k=smooth(CAM.blend);
    _tp.copy(CAM.pos); _tp.x+=_nz[0]*.04; _tp.y+=_nz[1]*.04;
    camera.position.lerpVectors(_pp,_tp,k); camera.quaternion.copy(_pq).slerp(CAM.quat,k);
    fov=lerp(fov,CAM.fov,k);
  } else { camera.position.copy(_pp); camera.quaternion.copy(_pq); }
  fov=fitFov(fov);
  if(Math.abs(camera.fov-fov)>.01){ camera.fov=fov; camera.updateProjectionMatrix(); }
  // near plane follows scale so tiny-you never clips through the world
  const near=clamp(.05*Math.min(1,s*1.5),.004,.05)*(LV&&LV.env&&LV.env.nearMul||1);
  if(Math.abs(camera.near-near)>1e-4){ camera.near=near; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}

/* ---------- first-person view model (scaled down + pulled close, so it never clips walls) ---------- */
const VM={grp:new THREE.Group(),arms:null,t:0,punchT:0,chopT:0,photoT:0,raiseT:0,watch:null,cam:null,carryMesh:null,hurtT:0,visible:false};
VM.grp.scale.setScalar(.25); camera.add(VM.grp);
function buildViewModel(){
  const T=charTex();
  const sleeveM=new THREE.MeshPhysicalMaterial({color:col(0x2f4d6e),roughness:.9,map:T.cloth.map,normalMap:T.cloth.normalMap,sheen:col(0x222222)});
  const skinM=skinify(new THREE.MeshPhysicalMaterial({color:col(0xe2b08c),roughness:.5,normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.3,.3),sheen:col(0x442a22)}));
  const arm=(side)=>{
    const g=new THREE.Group();
    const fore=mesh(lathe('vmFore',[[0,-.3],[.042,-.29],[.046,-.2],[.05,-.05],[.052,.2],[0,.25]],16),sleeveM,0,0,0,false); fore.rotation.x=Math.PI/2; g.add(fore);
    const cuff=mesh(GC('vmCuff',()=>new THREE.TorusGeometry(.044,.012,8,18)),sleeveM,0,0,-.29,false); g.add(cuff);
    const wrist=mesh(GC('vmWrist',()=>new THREE.CylinderGeometry(.029,.031,.06,14)),skinM,0,0,-.31,false); wrist.rotation.x=Math.PI/2; g.add(wrist);
    const handG=new THREE.Group(); handG.position.set(0,0,-.33); handG.rotation.x=Math.PI/2; g.add(handG);
    const H=makeHand(side,skinM); handG.add(H.grp); H.grp.rotation.y=side>0?-.3:.3;
    g.userData={H,handG};
    return g;
  };
  const L=arm(1), R=arm(-1);
  VM.grp.add(L); VM.grp.add(R); VM.arms={L,R};
  VM.mats={sleeve:sleeveM,skin:skinM,sleeveCol:sleeveM.color.clone(),skinCol:skinM.color.clone()};
  // stitches round the watch wrist (Steve cut that hand off in Ant Work 1; it was sewn back on)
  const st=new THREE.Group(); st.position.set(0,0,-.322); L.add(st);
  const scar=mesh(GC('vmScar',()=>new THREE.TorusGeometry(.0312,.0055,6,28)),mat(0xb0403c,{roughness:.55}),0,0,0,false); st.add(scar);
  const thread=mat(0x141010,{roughness:.7});
  for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; for(const sd of [-1,1]){ const k=box(.003,.003,.02,thread,Math.cos(a)*.0335,Math.sin(a)*.0335,0,false); k.rotation.z=a; k.rotation.y=sd*.7; st.add(k); } }
  VM.stitch=st; st.visible=false;
  // Larry's net catcher, held in the right hand
  const net=new THREE.Group(); net.position.set(0,0,-.36); R.add(net);
  const pole=mesh(GC('netPole',()=>{ const c=new THREE.CylinderGeometry(.009,.011,.7,10); c.rotateX(Math.PI/2); c.translate(0,0,-.3); return c; }),mat(0xd8b070,{roughness:.5}),0,0,0,false); net.add(pole);
  const hoop=mesh(GC('netHoop',()=>new THREE.TorusGeometry(.11,.007,8,32)),mat(0x6dffd8,{roughness:.3,metalness:.3,emissive:col(0x1a6a5a)}),0,.0,-.74,false); hoop.rotation.y=Math.PI/2; net.add(hoop);
  const bag=mesh(GC('netBag',()=>{ const c=new THREE.ConeGeometry(.105,.22,16,4,true); c.rotateZ(Math.PI/2); c.translate(.11,0,0); return c; }),new THREE.MeshBasicMaterial({color:col(0xc8fff0),wireframe:true,transparent:true,opacity:.45}),0,0,-.74,false); net.add(bag);
  net.rotation.set(.35,-.18,0); VM.net=net; net.visible=false;
  // the watch (Mars): sleek band + glowing holographic face
  const w=new THREE.Group(); w.position.set(0,.034,-.29); L.add(w);
  w.add(mesh(GC('wBand',()=>{ const t=new THREE.TorusGeometry(.037,.008,8,24); return t; }),mat(0x1a1c22,{roughness:.4,metalness:.6}),0,-.034,0,false)).children;
  const face=mesh(roundedBoxGeo(.05,.012,.06,.006),mat(0x303640,{roughness:.2,metalness:.9}),0,0,0,false); w.add(face);
  const scr=mesh(GC('wScr',()=>new THREE.PlaneGeometry(.04,.05)),new THREE.MeshBasicMaterial({color:col(0x6dffd8).multiplyScalar(2.5),transparent:true,opacity:.9}),0,.0065,0,false); scr.rotation.x=-Math.PI/2; w.add(scr);
  const holo=mesh(GC('wHolo',()=>new THREE.RingGeometry(.02,.024,32)),new THREE.MeshBasicMaterial({color:col(0x6dffd8).multiplyScalar(3),transparent:true,opacity:.0,side:THREE.DoubleSide,depthWrite:false}),0,.03,0,false); holo.rotation.x=-Math.PI/2; w.add(holo);
  VM.watch=w; VM.watchScr=scr; VM.watchHolo=holo; w.visible=false;
  // photo camera
  const cam=new THREE.Group();
  cam.add(mesh(roundedBoxGeo(.16,.1,.07,.015),mat(0x1c1c20,{roughness:.45,metalness:.3}),0,0,0,false));
  cam.add(mesh(roundedBoxGeo(.05,.04,.03,.008),mat(0x2a2a30,{roughness:.4}),-.045,.06,0,false));
  const lens=mesh(GC('camLens',()=>{ const c=new THREE.CylinderGeometry(.034,.038,.06,24); c.rotateX(Math.PI/2); return c; }),mat(0x0c0c0e,{roughness:.2,metalness:.8}),.02,0,-.06,false); cam.add(lens);
  cam.add(mesh(GC('camGlass',()=>new THREE.CircleGeometry(.026,24)),new THREE.MeshPhysicalMaterial({color:col(0x223355),roughness:.02,metalness:.2,clearcoat:1}),.02,0,-.0905,false)).children;
  cam.children[cam.children.length-1].rotation.y=Math.PI;
  cam.add(mesh(GC('camFlash',()=>new THREE.BoxGeometry(.035,.018,.004)),emissiveMat(0xffffff,.4),-.05,.025,-.036,false));
  cam.add(mesh(GC('camRed',()=>new THREE.SphereGeometry(.005,8,6)),emissiveMat(0xff2a2a,3),.06,.04,-.02,false));
  VM.cam=cam; cam.visible=false; VM.grp.add(cam);
  VM.grp.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; o.renderOrder=10; } });
}
function setVM(on){ VM.visible=on; }
/* swap the first-person arms between your hoodie and the white shrink suit (gloves) */
function setVMSuit(on){ if(!VM.mats) return; VM.suit=on; VM.mats.sleeve.color.copy(on?col(0xeeece6):VM.mats.sleeveCol); VM.mats.skin.color.copy(on?col(0xff8a3a):VM.mats.skinCol); if(VM.blockMats){ VM.blockMats.shirt.color.set(on?0xf4f2ee:0xffffff).multiplyScalar(.85); VM.blockMats.skin.color.set(on?0xff9a4a:0xffffff).multiplyScalar(.85); VM.blockMats.shirt.map=on?null:VM.blockMats.shirtMap; VM.blockMats.skin.map=on?null:VM.blockMats.skinMap; VM.blockMats.shirt.needsUpdate=VM.blockMats.skin.needsUpdate=true; } }
/* carried object (rocket piece): pass a mesh, or null */
function vmCarry(obj){
  if(VM.carryMesh){ VM.grp.remove(VM.carryMesh); VM.carryMesh=null; }
  if(obj){ const c=obj.clone(); c.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.renderOrder=10; } if(o.isLight) o.visible=false; });
    c.position.set(0,0,0); c.rotation.set(.25,.35,0); c.scale.multiplyScalar((obj.userData.vmScale||1)*.6); c.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(c), sz=bb.getSize(new THREE.Vector3()), ctr=bb.getCenter(new THREE.Vector3());
    // wrap it so its middle sits at the wrapper's origin (then it can go right between your palms)
    const w=new THREE.Group(); c.position.sub(ctr); w.add(c); w.userData.w=Math.max(.05,sz.x); w.userData.h=sz.y; w.userData.s0=1;
    w.position.set(0,-.36,-.62); VM.grp.add(w); VM.carryMesh=w; }
}

const _vmHL=new THREE.Vector3(), _vmHR=new THREE.Vector3();
function updateViewModel(dt,t){
  if(!VM.arms) return;
  const P=PLAYER; VM.t+=dt;
  const show=VM.visible && G.mode==='play' && CAM.blend<.5 && (!P.fly||P.swim||P.item==='camera') && !RENDER.override && (!DLG.active||P.watchLook>0||VM.forceShow);
  VM.grp.visible=show || (VM.cam.visible&&VM.photoT>0) || !!VM.forceShow;
  if(!VM.grp.visible) return;
  const {L,R}=VM.arms, bob=P.bobAmt, bt=P.bobT;
  const swayX=Math.sin(bt)*.012*bob, swayY=Math.abs(Math.cos(bt))*.012*bob, br=Math.sin(t*1.6)*.004;
  // resting pose (low, relaxed)
  let lp=[-.3+swayX,-.52-swayY+br,-.38], rp=[.3+swayX,-.52-swayY+br,-.38], lr=[.55,.5,.5], rr=[.55,-.5,-.5];
  let lf=.45, rf=.45;
  const hasWatch=P.hasWatch;
  VM.watch.visible=hasWatch; VM.stitch.visible=!!P.stitched;
  let onL=false,onR=false;
  // ---- swimming (tinyverse): breaststroke while moving, slow treading while still ----
  if(P.swim && !P.carry){
    onL=onR=true;
    const w=smooth(P.swimW), ph=P.swimPh;
    // keyframes for the LEFT arm: [pos, rot, finger curl]; the right arm mirrors it
    const K=[[[-.07,-.23,-.62],[.1,-.2,.2],.05],[[-.36,-.25,-.5],[.05,.55,-1.1],.1],[[-.16,-.44,-.34],[.5,-.35,1.2],.55],[[-.07,-.23,-.62],[.1,-.2,.2],.05]];
    const T=[0,.3,.55,1]; let i=0; while(i<2&&ph>T[i+1]) i++; const u=smooth(clamp((ph-T[i])/(T[i+1]-T[i]),0,1));
    const sp=K[i][0].map((v,j)=>lerp(v,K[i+1][0][j],u)), sr=K[i][1].map((v,j)=>lerp(v,K[i+1][1][j],u)), sf=lerp(K[i][2],K[i+1][2],u);
    const tp=Math.sin(t*2.1), tp2=Math.cos(t*2.1);
    const tpL=[-.3+tp*.035,-.47+tp2*.015,-.42], trL=[.35,.35+tp*.3,.55+tp2*.45];
    lp=tpL.map((v,j)=>lerp(v,sp[j],w)); lr=trL.map((v,j)=>lerp(v,sr[j],w)); lf=lerp(.2,sf,w);
    rp=[-lp[0],lp[1],lp[2]]; rr=[lr[0],-lr[1],-lr[2]]; rf=lf;
    // roll the view a touch with each stroke
    P.roll=damp(P.roll,Math.sin(ph*Math.PI*2)*.012*w,3,dt);
  }
  // ---- the net: right hand holds it out, left hand keeps swimming ----
  VM.net.visible=P.item==='net' && (VM.raiseK||0)<.05;
  if(VM.net.visible){ onR=true; rp=[.24+swayX,-.4,-.4]; rr=[.25,-.15,-.5]; rf=1;
    if(VM.netT>0){ VM.netT-=dt; const k=1-VM.netT/.42; const s=Math.sin(Math.PI*k); rp=[lerp(.24,-.02,s),lerp(-.4,-.3,s),lerp(-.4,-.5,s)]; rr=[.25-s*.5,-.15+s*.9,-.5-s*.4]; } }
  if(P.carry){ onL=onR=true; lp=[-.24+swayX,-.4-swayY,-.42]; rp=[.24+swayX,-.4-swayY,-.42]; lr=[.12,.28,1.25]; rr=[.12,-.28,-1.25]; lf=.75; rf=.75; }
  if(P.watchLook>0) onL=true;
  if(P.scale<.5 && !P.carry && !P.item){ onL=onR=true; lp=[-.24+swayX,-.4-swayY+br,-.4]; rp=[.24+swayX,-.4-swayY+br,-.4]; lr=[.2,.3,.9]; rr=[.2,-.3,-.9]; lf=1; rf=1; } // fists up while tiny (bug fighting)
  if(P.watchLook>0){ const k=smooth(P.watchLook); lp=[lerp(lp[0],-.2,k),lerp(lp[1],-.24,k),lerp(lp[2],-.3,k)]; lr=[lerp(lr[0],.25,k),lerp(lr[1],-1.25,k),lerp(lr[2],-.25,k)]; lf=lerp(lf,.55,k); }
  // slap (the alarm clock): the watch hand swings down flat
  if(VM.slapT>0){ onL=true; VM.armL=Math.max(VM.armL||0,.9); VM.slapT-=dt; const k=1-VM.slapT/.5; const s=k<.4?k/.4:1-(k-.4)/.6; lp=[lerp(-.34,-.12,s),lerp(-.3,-.46,s),lerp(-.42,-.52,s)]; lr=[lerp(.1,.9,s),-.9+s*.4,-.2]; lf=.05; }
  // punch
  if(VM.punchT>0){ onR=true; VM.armR=Math.max(VM.armR||0,.9); VM.punchT-=dt; const k=Math.sin(Math.PI*(1-VM.punchT/.28)); rp=[lerp(rp[0],.05,k),lerp(rp[1],-.14,k),lerp(rp[2],-.82,k)]; rr=[rr[0]+k*.2,rr[1],rr[2]]; rf=lerp(rf,1,Math.min(1,k*3)); }
  if(VM.waveT>0){ onR=true; VM.armR=Math.max(VM.armR||0,.9); VM.waveT-=dt; const k=Math.min(1,VM.waveT*3,(2.6-VM.waveT)*3), s=Math.sin(VM.t*8); rp=[lerp(rp[0],.24+s*.05,k),lerp(rp[1],-.12,k),lerp(rp[2],-.5,k)]; rr=[lerp(rr[0],1.35,k),lerp(rr[1],-.15,k),lerp(rr[2],-.25+s*.45,k)]; rf=lerp(rf,0,k); }
  if(VM.chopT>0){ onR=true; VM.armR=Math.max(VM.armR||0,.9); VM.chopT-=dt; const k=1-VM.chopT/.35; const up=k<.35?k/.35:1-(k-.35)/.65; rp=[.08,lerp(-.1,-.3,1-up)+(k<.35?.1*up:0),-.62]; rr=[lerp(-.9,.6,1-up),-.2,-1.4]; rf=0; }
  // photo camera: tucked away while you swim, both hands bring it up to shoot
  VM.cam.visible=!!P.item&&(P.item==='camera'||P.item==='net')&&!P.carry&&((VM.raiseK||0)>.05||!P.swim);
  VM.raiseK=damp(VM.raiseK||0,VM.raiseT,14,dt);
  if(VM.cam.visible){ if(!P.swim) onR=onL=VM.raiseK>.05; else if(VM.raiseK>.05){ onR=onL=true; }
    const k=smooth(VM.raiseK);
    if(VM.photoT>0) VM.photoT-=dt;
    const hold=[lerp(.2,0,k),lerp(-.33,-.13,k),lerp(-.52,-.38,k)];
    VM.cam.position.set(hold[0]+swayX,hold[1]-swayY-(P.swim?(1-k)*.3:0),hold[2]); VM.cam.rotation.set(lerp(-.35,0,k),lerp(-.3,0,k),0);
    if(k>.05){ const hr=[hold[0]+.1,hold[1]-.12,hold[2]+.22], hl=[hold[0]-.1,hold[1]-.12,hold[2]+.22];
      rp=rp.map((v,j)=>lerp(v,hr[j],k)); lp=lp.map((v,j)=>lerp(v,hl[j],k)); rr=[.35,-.25,-1.35]; lr=[.35,.25,1.35]; rf=lf=.8; }
  }
  if(VM.reach>0){ onL=onR=true; const k=smooth(Math.min(1,VM.reach)), pull=(VM.pull||0); lp=lp.map((v,j)=>lerp(v,[-.2,-.4+pull*.08,-.56+pull*.14][j],k)); rp=rp.map((v,j)=>lerp(v,[.2,-.4+pull*.08,-.56+pull*.14][j],k)); lr=[lerp(lr[0],-.55,k),lerp(lr[1],.2,k),lerp(lr[2],.4,k)]; rr=[lerp(rr[0],-.55,k),lerp(rr[1],-.2,k),lerp(rr[2],-.4,k)]; lf=rf=lerp(.3,1,pull); }
  if(VM.handsLook>0){ onL=onR=true; const k=smooth(Math.min(1,VM.handsLook)); lp=lp.map((v,j)=>lerp(v,[-.16,-.28,-.5][j],k)); rp=rp.map((v,j)=>lerp(v,[.16,-.28,-.5][j],k)); lr=[lerp(lr[0],1.1,k),lerp(lr[1],.35,k),lerp(lr[2],.9,k)]; rr=[lerp(rr[0],1.1,k),lerp(rr[1],-.35,k),lerp(rr[2],-.9,k)]; lf=rf=.15; }
  if(VM.hurtT>0){ VM.hurtT-=dt; }
  // in a cutscene (you can't move or look) your hands stay down unless the scene asks for them
  //   (they used to float up on their own: tiny fists, swimming, the walk sway...)
  if(!P.ctl.move && !P.ctl.look && !VM.forceShow && !(VM.handsLook>0) && !(VM.reach>0) && !(VM.slapT>0) && !(VM.punchT>0) && !(VM.waveT>0) && !(VM.chopT>0) && !(P.watchLook>0) && !(VM.photoT>0) && !P.carry){ onL=onR=false; }
  // arms only appear when they are doing something (idle hands in the view just look odd)
  VM.armL=damp(VM.armL||0,onL?1:0,12,dt); VM.armR=damp(VM.armR||0,onR?1:0,12,dt); lp[1]-=(1-smooth(VM.armL))*.4; rp[1]-=(1-smooth(VM.armR))*.4; L.visible=VM.armL>.02; R.visible=VM.armR>.02;
  L.position.set(...lp); R.position.set(...rp); L.rotation.set(...lr); R.rotation.set(...rr);
  // carried piece: held BETWEEN your palms (it used to float out in front of your hands), sized to your grip
  if(VM.carryMesh && P.carry){
    VM.grp.updateMatrixWorld(true);
    const hl=L.userData.handG.getWorldPosition(_vmHL), hr=R.userData.handG.getWorldPosition(_vmHR); VM.grp.worldToLocal(hl); VM.grp.worldToLocal(hr);
    const c=VM.carryMesh, gap=hl.distanceTo(hr), k=clamp(gap*.9/c.userData.w,.35,1.6);
    c.scale.setScalar(k); c.position.copy(hl).add(hr).multiplyScalar(.5); c.position.z-=.05; c.position.y+=.01;
  }
  for(const [A,f] of [[L,lf],[R,rf]]){ const H=A.userData.H; for(const fg of H.fingers){ fg.a.rotation.x=-f*1.25; fg.b.rotation.x=-f*1.35; if(fg.c) fg.c.rotation.x=-f*1.0; } H.thumb2.rotation.x=-f*.7; }
  // watch glow
  if(hasWatch){ const g=P.watchGlow||0; VM.watchHolo.material.opacity=g*.9; VM.watchHolo.scale.setScalar(1+g*2+Math.sin(t*10)*.1*g); VM.watchHolo.position.y=.03+g*.02; VM.watchScr.material.color.copy(col(P.scale<1?0xffb347:0x6dffd8)).multiplyScalar(2.5+g*4+Math.sin(t*3)*.3); }
}

/* blocky arms (after XXX5 turns everything into blocks) */
function setVMBlocky(on){
  if(!VM.arms) return; VM.blocky=on;
  if(on && !VM.blockArms){ const hx=h=>'#'+new THREE.Color(h).getHexString();
    const skin=new THREE.MeshBasicMaterial({map:flatTex(hx(0xd8a880),.97,0)}), shirt=new THREE.MeshBasicMaterial({map:flatTex(hx(0x2f4d6e),.94,0)});
    skin.color.setScalar(.85); shirt.color.setScalar(.85);
    VM.blockMats={skin,shirt,skinMap:skin.map,shirtMap:shirt.map};
    VM.blockArms=[]; for(const A of [VM.arms.L,VM.arms.R]){ const g=new THREE.Group(); const sl=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.56),shirt); g.add(sl); const hd=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.16),skin); hd.position.z=-.36; g.add(hd); g.traverse(o=>{ if(o.isMesh) o.renderOrder=10; }); A.add(g); VM.blockArms.push(g); } }
  for(const A of [VM.arms.L,VM.arms.R]) for(const c of A.children){ if(c===VM.watch||c===VM.net) continue; if(VM.blockArms&&VM.blockArms.includes(c)) c.visible=on; else c.visible=!on; }
  if(!on&&VM.stitch) VM.stitch.visible=!!PLAYER.stitched;
  if(on) setVMSuit(!!VM.suit);
}

