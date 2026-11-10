/* ================================================================
   INTRO — macro shot: an ant eats a cookie crumb on a kitchen table
   at golden hour. Then the title slams in; the scene stays behind the
   menu. Units here are centimetres (the ant is ~1 unit long).
   ================================================================ */
function woodTex(key,size=1024,o={}){
  return texSet(key,size,(x,w,h)=>{
    const planks=o.planks||6, ph=h/planks;
    for(let p=0;p<planks;p++){
      const base=o.base||[150,92,52], v=rand(-18,18);
      const img=x.createImageData(w,Math.ceil(ph)), d=img.data, seed=rand(0,100);
      for(let j=0;j<img.height;j++) for(let i=0;i<w;i++){
        const u=i/w, vv=j/ph;
        const warp=noise2(u*1.3+seed,vv*1.2)*1.3+noise2(u*6+seed,vv*3)*.18;
        const ring=Math.pow(Math.abs(Math.sin((vv*4.5+warp*2.2)*Math.PI)),6)*(.6+.4*noise2(u*8+seed,vv*20));
        const fine=noise2(u*60+seed,vv*140)*.5+.5;
        const k=.95-ring*.32+fine*.08+noise2(u*4+seed,vv*2)*.12;
        const idx=(j*w+i)*4; d[idx]=clamp((base[0]+v)*k,0,255); d[idx+1]=clamp((base[1]+v*.7)*k,0,255); d[idx+2]=clamp((base[2]+v*.5)*k,0,255); d[idx+3]=255;
      }
      x.putImageData(img,0,Math.floor(p*ph));
      if(Math.random()<.6){ const kx=rand(0,w), ky=p*ph+rand(.3,.7)*ph; const g=x.createRadialGradient(kx,ky,0,kx,ky,rand(6,16)); g.addColorStop(0,'rgba(50,25,10,.8)'); g.addColorStop(1,'rgba(50,25,10,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(kx,ky,22,8,0,0,7); x.fill(); }
      x.fillStyle='rgba(20,10,4,.85)'; x.fillRect(0,Math.floor(p*ph),w,2);
      const off=(p*337)%w; x.fillRect(off,Math.floor(p*ph),2,ph);
    }
    for(let i=0;i<40;i++){ x.strokeStyle=`rgba(255,240,220,${rand(.03,.08)})`; x.lineWidth=.6; x.beginPath(); const sx=rand(0,w),sy=rand(0,h); x.moveTo(sx,sy); x.lineTo(sx+rand(-60,60),sy+rand(-8,8)); x.stroke(); }
  },{strength:o.strength||2.5,rough:(x,w,h)=>{ x.fillStyle='#5a5a5a'; x.fillRect(0,0,w,h); for(let i=0;i<60;i++){ x.strokeStyle=`rgba(200,200,200,${rand(.1,.3)})`; x.lineWidth=rand(.5,1.5); x.beginPath(); const sx=rand(0,w),sy=rand(0,h); x.moveTo(sx,sy); x.lineTo(sx+rand(-80,80),sy+rand(-10,10)); x.stroke(); } blotches(x,w,h,'rgba(30,30,30,A)',20,20,80,.3); }});
}
function cookieTex(){
  return texSet('cookie',512,(x,w,h)=>{
    noiseFill(x,w,h,(n,u,v)=>{ const k=.75+n*.6; const bake=noise2(u*6,v*6)*.5+.5; return [clamp((196-bake*50)*k,0,255),clamp((140-bake*55)*k,0,255),clamp((72-bake*40)*k,0,255)]; },10,5);
    for(let i=0;i<500;i++){ x.fillStyle=`rgba(${rand(90,130)},${rand(50,70)},${rand(20,35)},${rand(.2,.5)})`; x.beginPath(); x.arc(rand(0,w),rand(0,h),rand(1,4),0,7); x.fill(); }
    for(let i=0;i<260;i++){ x.fillStyle=`rgba(255,250,235,${rand(.3,.8)})`; x.fillRect(rand(0,w),rand(0,h),rand(1,2.5),rand(1,2.5)); }
  },{strength:4,rough:(x,w,h)=>{ x.fillStyle='#b8b8b8'; x.fillRect(0,0,w,h); for(let i=0;i<300;i++){ x.fillStyle='rgba(40,40,40,.7)'; x.fillRect(rand(0,w),rand(0,h),2,2); } }});
}
function crumbGeo(seed,s=1){
  return GC('crumb'+seed+'_'+s,()=>{ const g=new THREE.SphereGeometry(1,40,28), p=g.attributes.position, v=new THREE.Vector3(); const r=RNG(seed);
    const ox=r()*50, oy=r()*50;
    for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const n=fbm2(v.x*2.2+ox,v.y*2.2+v.z*1.7+oy,4); const f=1+n*.55+Math.max(0,noise2(v.x*7+oy,v.z*7+ox))*.2; v.multiplyScalar(f); v.y*=.72; if(v.y<-.35) v.y=-.35+(v.y+.35)*.2; p.setXYZ(i,v.x*s,v.y*s,v.z*s); }
    g.computeVertexNormals(); return g; });
}
defineLevel('intro',{
  title:'the kitchen table',
  env:{fx:{exposure:.9,dof:1,dofFocus:3,dofRange:1.1,dofMax:6,vignette:.5,bloomStrength:.18,bloomThreshold:1.6,aoRadius:.12,aoStrength:.9,temp:.04,saturation:.94,contrast:1.1,grain:.03},near:.02,far:500,music:null,reverb:.06,amb:[['room',.03]],surface:'wood'},
  async build(scene,lv){
    lv.envMap=makeEnv({top:0x2a2220,horizon:0x6a4a34,bottom:0x1a120c,intensity:.8,lights:[{x:-20,y:14,z:-45,w:30,h:20,c:0xffc27a,k:2.2},{x:25,y:30,z:10,w:10,h:10,c:0xa0b8ff,k:.8}]});
    scene.background=col(0x0c0806);
    const rig=makeRig(scene,{sun:2.3,sunColor:0xffd6a8,hemi:.3,sky:0xffe0c0,ground:0x3a2410,dir:V3(-.8,.62,.55),span:3.2,dist:30,bias:-.0006,normalBias:.004});
    lv.rig=rig;
    // soft cool fill from the camera side so the crumb and the ant's face don't go muddy
    const fill=new THREE.DirectionalLight(col(0xc8d8ff),.55); fill.position.set(1.5,2.2,6); scene.add(fill);
    // table
    const wt=woodTex('tableWood2',1024,{planks:5,base:[118,78,50]});
    const tr=repeatSet(wt,40,40);
    const tableM=new THREE.MeshPhysicalMaterial({map:tr.map,normalMap:tr.normalMap,roughnessMap:tr.roughnessMap,roughness:1,normalScale:new THREE.Vector2(.9,.9),clearcoat:.35,clearcoatRoughness:.22});
    const table=mesh(new THREE.PlaneGeometry(400,400,1,1),tableM,0,0,0,false); table.rotation.x=-Math.PI/2; table.receiveShadow=true; scene.add(table);
    table.material.map.offset.set(.3,.1); table.material.normalMap.offset.set(.3,.1); table.material.roughnessMap.offset.set(.3,.1);
    // the crumb: a cluster of chunks the ant can eat one by one
    const ct=cookieTex(), cm=repeatSet(ct,1,1);
    const crumbM=new THREE.MeshStandardMaterial({map:cm.map,normalMap:cm.normalMap,roughnessMap:cm.roughnessMap,roughness:.9,normalScale:new THREE.Vector2(1.2,1.2)});
    const chipM=new THREE.MeshPhysicalMaterial({color:col(0x2a1206),roughness:.35,clearcoat:.6,clearcoatRoughness:.3});
    lv.crumb=new THREE.Group(); lv.crumb.position.set(0,0,0); scene.add(lv.crumb);
    lv.chunks=[];
    const defs=[[.06,.2,.05,.24],[-.14,.14,.02,.17],[.18,.13,-.1,.16],[.02,.16,-.18,.17],[-.08,.12,.2,.14],[.2,.1,.16,.13],[-.2,.09,-.12,.12],[.03,.3,.0,.13]];
    defs.forEach((d,i)=>{ const m=mesh(crumbGeo(i+3,d[3]),crumbM,d[0],d[1],d[2]); m.rotation.set(rand(0,3),rand(0,6),rand(0,3)); m.userData.s=1; lv.crumb.add(m); lv.chunks.push(m); });
    for(let i=0;i<2;i++){ const c=mesh(crumbGeo(40+i,.07),chipM,[.12,-.1][i],[.26,.22][i],[-.05,.1][i]); lv.crumb.add(c); lv.chunks.splice(i*3+2,0,c); }
    // loose sugar/crumb bits around
    for(let i=0;i<24;i++){ const a=rand(0,6.28), r=rand(.45,2.4); const b=mesh(crumbGeo(100+i,rand(.015,.045)),crumbM,Math.cos(a)*r,.01,Math.sin(a)*r); scene.add(b); }
    const sugarM=new THREE.MeshPhysicalMaterial({color:col(0xf0ece4),roughness:.1,clearcoat:1,transparent:true,opacity:.6});
    for(let i=0;i<30;i++){ const a=rand(0,6.28), r=rand(.4,3); const c=mesh(GC('sugar',()=>new THREE.BoxGeometry(.02,.02,.02)),sugarM,Math.cos(a)*r,.017,Math.sin(a)*r,false); c.rotation.set(rand(0,3),rand(0,3),rand(0,3)); scene.add(c); }
    // the ant
    lv.ant=makeAnt({seed:7}); lv.ant.scale.setScalar(1); scene.add(lv.ant);
    // ---- out-of-focus kitchen behind ----
    const bigCookie=new THREE.Group(); bigCookie.position.set(-14,0,-34); scene.add(bigCookie);
    const cookieShape=new THREE.Shape(); const R=6; for(let i=0;i<=48;i++){ const a=i/48*Math.PI*2; let rr=R*(1+noise1(i*.7)*.04); if(a>.3&&a<1.3) rr-=Math.sin((a-.3)/1*Math.PI)*1.8; cookieShape[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr); }
    const cg=new THREE.ExtrudeGeometry(cookieShape,{depth:1.1,bevelEnabled:true,bevelThickness:.4,bevelSize:.5,bevelSegments:4,curveSegments:24}); cg.rotateX(-Math.PI/2);
    const bcm=repeatSet(ct,.12,.12);
    bigCookie.add(mesh(cg,new THREE.MeshStandardMaterial({map:bcm.map,normalMap:bcm.normalMap,roughness:.85}),0,.4,0));
    for(let i=0;i<14;i++){ const a=rand(0,6.28), r=rand(.5,5); if(a>.3&&a<1.3&&r>3.8) continue; bigCookie.add(mesh(crumbGeo(60+i,rand(.35,.6)),chipM,Math.cos(a)*r,1.9,-Math.sin(a)*r)); }
    const mugPts=[[0,0],[3.6,0],[3.9,.3],[4.1,8.5],[4.3,9.6],[3.9,9.7],[3.7,1.2],[0,1.1]].map(p=>new THREE.Vector2(p[0],p[1]));
    const mug=mesh(new THREE.LatheGeometry(mugPts,40),new THREE.MeshPhysicalMaterial({color:col(0x2f7a78),roughness:.18,clearcoat:1,clearcoatRoughness:.05}),20,0,-52); scene.add(mug);
    const handle=mesh(new THREE.TorusGeometry(2.4,.6,12,24,Math.PI*1.2),mug.material,23.6,5,-52); handle.rotation.z=-Math.PI*.6; scene.add(handle);
    const jar=mesh(new THREE.CylinderGeometry(4,4,14,32),new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:.05,transmission:.9,transparent:true,opacity:.35,clearcoat:1}),-24,7,-48); scene.add(jar);
    // window + wall + fairy lights (become bokeh)
    const win=mesh(new THREE.PlaneGeometry(90,110),basicGlow(0xffc890,3.2),-170,50,-50,false); win.rotation.y=Math.PI/2.4; scene.add(win);
    const wall=mesh(new THREE.PlaneGeometry(600,300),mat(0x7a6050,{roughness:.9}),0,60,-170,false); scene.add(wall); const wall2=mesh(new THREE.PlaneGeometry(600,300),mat(0x7a6050,{roughness:.9}),-180,60,0,false); wall2.rotation.y=Math.PI/2; scene.add(wall2);
    lv.bulbs=[];
    for(let i=0;i<22;i++){ const b=mesh(GC('bulb',()=>new THREE.SphereGeometry(.6,10,8)),basicGlow(pick([0xffd08a,0xffb060,0xfff0c0]),rand(6,12)),-80+i*8+rand(-2,2),26+Math.sin(i*.8)*6,-120+rand(-10,10),false); scene.add(b); lv.bulbs.push(b); }
    // floating dust in the light beam
    lv.dust=[]; for(let i=0;i<dq(10,20,40,60,90);i++) lv.dust.push({p:V3(rand(-6,6),rand(.3,6),rand(-10,4)),v:V3(rand(-.05,.05),rand(-.02,.03),rand(-.05,.05)),s:rand(.01,.04)});
    lv.sunWorld=V3(-170,60,-50);
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.28; FX.raysColor.set(1,.8,.55); },
  update(dt,t){
    const lv=this, A=lv.ant.userData.A;
    // measured ant speed for the gait
    const p=lv.ant.position; A.speed=damp(A.speed,dt>0?Math.min(3,p.distanceTo(A.lastPos)/dt):0,12,dt); A.lastPos.copy(p);
    animateAnt(lv.ant,dt,t);
    if(lv.antPath){ const P=lv.antPath; const tgt=P.pts[P.i]; const dx=tgt.x-p.x, dz=tgt.z-p.z, d=Math.hypot(dx,dz); const step=P.speed*dt;
      if(d<=step){ p.x=tgt.x; p.z=tgt.z; P.i++; if(P.i>=P.pts.length){ lv.antPath=null; P.res(); } }
      else { p.x+=dx/d*step; p.z+=dz/d*step; lv.ant.rotation.y=angLerp(lv.ant.rotation.y,Math.atan2(dx,dz),Math.min(1,dt*6)); if(Math.random()<dt*10) SFX.antStep(); } }
    for(const c of lv.chunks){ if(c.userData.eat){ c.userData.s=Math.max(0,c.userData.s-dt*2.2); c.scale.setScalar(c.userData.s); if(c.userData.s<=0){ c.visible=false; c.userData.eat=false; } } }
    if(lv.autoFocus!==false){ const ap=lv.ant.getWorldPosition(_hw); FX.dofFocus=damp(FX.dofFocus,camera.position.distanceTo(ap),6,dt); }
    for(const d of lv.dust){ d.p.addScaledVector(d.v,dt); d.p.y+=Math.sin(t*.5+d.s*100)*.002; if(Math.random()<.02) lv.glow.spawn(d.p.x,d.p.y,d.p.z,d.v.x,d.v.y,d.v.z,.5,d.s,1,.8,.55,.35,0,0,0); }
  },
  walkAnt(pts,speed=1){ return new Promise(res=>{ this.antPath={pts,i:0,speed,res}; }); }
});
const INTRO={skipped:false,done:false,
  async prepare(progress){ progress(.1); await buildLevel('intro'); progress(1); },
  async start(){
    G.mode='menu';
    resetStory();
    const lv=await enterLevel('intro',{pos:V3(0,0,6),yaw:0});
    const tok=STORY.token; this.skipped=false; this.done=false;
    const A=lv.ant.userData.A;
    lv.ant.position.set(-3.6,0,1.3); lv.ant.rotation.y=Math.PI/2+.2; A.lastPos.copy(lv.ant.position);
    for(const c of lv.chunks){ c.visible=true; c.userData.s=1; c.scale.setScalar(1); c.userData.eat=false; }
    const skip=e=>{ if(this.done) return; this.skip(); };
    this.skipHandler=skip; window.addEventListener('keydown',skip); canvasEl.addEventListener('pointerdown',skip);
    // slow macro push-in with a little handheld drift
    camFollow((t)=>{ const k=smooth(t/14); return {pos:V3(lerp(2.6,1.55,k)+Math.sin(t*.3)*.04,lerp(.75,.42,k)+Math.sin(t*.45)*.02,lerp(2.9,1.7,k)),look:V3(lerp(-1.2,-.15,smooth(t/5)),.18,lerp(.6,.05,smooth(t/5)))}; },28);
    FX.dofFocus=3.2; FX.dofRange=.8; FX.dof=1;
    say('',0); hideSay();
    await wait(.8);
    SFX.chitter();
    await lv.walkAnt([V3(-2,0,.9),V3(-.72,0,.18)],.75);
    if(this.skipped) return;
    A.sniff=1.2; SFX.chitter(); await wait(1.2); A.sniff=0;
    lv.ant.rotation.y=Math.PI/2;
    A.headDip=.35;
    const order=[0,4,1,6,5,2,3,7,8,9];
    for(let i=0;i<order.length;i++){
      if(this.skipped||tok!==STORY.token) return;
      A.chew=1; await wait(.35); SFX.munch(); await wait(.3); SFX.munch();
      const c=lv.chunks[order[i]]; if(c){ c.userData.eat=true; const wp=c.getWorldPosition(new THREE.Vector3()); lv.soft.burst(wp,{color:0xc89050,count:14,speed:.8,size:.05,life:.9,grav:-6,up:.6}); SFX.crumb(); }
      if(i%2===1){ const cr=lv.crumb; cr.position.x=lerp(cr.position.x,-.1,.1); }
      A.headDip=.35+Math.sin(i)*.1; A.headTilt=Math.sin(i*1.7)*.15;
      await wait(i<order.length-1?.35:.2);
    }
    if(this.skipped) return;
    A.chew=0; A.headDip=0; A.headTilt=0; SFX.gulp();
    await wait(.6);
    A.groom=1; await wait(1.3); A.groom=0; SFX.sparkle();
    A.headYaw=.5; A.headTilt=-.2;
    await wait(.5);
    this.finish(false);
  },
  skip(){ if(this.done) return; this.skipped=true; resetStory(); const lv=LEVELS.intro; for(const c of lv.chunks){ c.visible=false; c.userData.eat=false; } lv.antPath=null; const A=lv.ant.userData.A; A.chew=0; A.headDip=0; A.groom=0; A.headYaw=.4; lv.ant.position.set(-.72,0,.18); lv.ant.rotation.y=Math.PI/2; this.finish(true); },
  finish(fast){
    if(!fast) unlock('crumb');
    if(this.done) return; this.done=true;
    window.removeEventListener('keydown',this.skipHandler); canvasEl.removeEventListener('pointerdown',this.skipHandler);
    SFX.titleSlam(); flashWhite(.35,.8); shake(.3);
    playMusic('title',fast?.5:2);
    this.titleCam();
    TITLE.show();
  },
  titleCam(){
    const lv=LEVELS.intro; const A=lv.ant.userData.A;
    camFollow((t)=>{ const a=.6+t*.05; return {pos:V3(-.7+Math.cos(a)*2.4,.55+Math.sin(t*.2)*.1,.2+Math.sin(a)*2.4),look:V3(-.6,.2,.15)}; },30);
    FX.dofFocus=2.4; FX.dofRange=.9; FX.dof=1;
    // the ant wanders about near the crumb site while the menu is up
    const roam=async()=>{ const tok=STORY.token; while(tok===STORY.token && G.mode==='menu'){ await wait(rand(1.5,4)); if(tok!==STORY.token||G.mode!=='menu') return; const r=Math.random(); if(r<.35){ A.groom=1; await wait(1.4); A.groom=0; } else if(r<.7){ await lv.walkAnt([V3(-.7+rand(-.5,.5),0,.15+rand(-.5,.5))],.5); } else { A.sniff=1; await wait(1); A.sniff=0; } } };
    runStory(roam);
  }
};

/* ---------------- title menu + story select ---------------- */
const TITLE={
  show(){
    G.mode='menu'; unlockPointer(); hudVisible(false); TOUCH_UI.on(false);
    const s=getSave(); $('btnContinue').classList.toggle('hide',!(s&&s.cp));
    if(s&&s.cp) $('btnContinue').textContent='Continue · '+(CHECKPOINT_NAMES[s.cp]||'');
    $('title').classList.remove('hide'); $('story').classList.add('hide');
    this.onBack=null;
  },
  hide(){ $('title').classList.add('hide'); },
  storySelect(){
    SFX.uiClick(); $('title').classList.add('hide'); $('story').classList.remove('hide');
    drawPosters();
    this.onBack=()=>{ SFX.uiBack(); this.show(); };
    const lv=LEVELS.intro; camFollow((t)=>{ const a=2.2+t*.03; return {pos:V3(-.7+Math.cos(a)*1.6,.35,.2+Math.sin(a)*1.6),look:V3(-.6,.2,.15)}; },30);
  }
};
$('btnNew').onclick=async()=>{ const s=getSave(); if(s&&s.cp&&!await askConfirm('Start a new game? Your checkpoint will be replaced once you pick a story.','New game')) return; TITLE.storySelect(); };
$('btnContinue').onclick=()=>{ const s=getSave(); if(s&&s.cp){ SFX.uiClick(); startFromCheckpoint(s.cp); } };
$('btnSettings').onclick=()=>openSettings('title');
$('storyBack').onclick=()=>{ SFX.uiBack(); TITLE.show(); };
$('pickA').onclick=()=>{ SFX.uiClick(); startFromCheckpoint('A1'); };
$('pickB').onclick=()=>{ SFX.uiClick(); startFromCheckpoint('B1'); };
function drawPosters(){
  if(drawPosters.done) return; drawPosters.done=true;
  const mk=(draw)=>{ const c=document.createElement('canvas'); c.width=720; c.height=380; draw(c.getContext('2d'),720,380); return c.toDataURL('image/jpeg',.88); };
  $('picA').style.backgroundImage='url('+mk((x,w,h)=>{
    let g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#1a0f2e'); g.addColorStop(1,'#050208'); x.fillStyle=g; x.fillRect(0,0,w,h);
    for(let i=0;i<220;i++){ const r=Math.random()*2.2; x.fillStyle=`rgba(${150+Math.random()*100},${120+Math.random()*80},255,${Math.random()*.7})`; x.beginPath(); x.arc(Math.random()*w,Math.random()*h,r,0,7); x.fill(); }
    const cx=w*.68, cy=h*.46; g=x.createRadialGradient(cx,cy,0,cx,cy,170); g.addColorStop(0,'rgba(140,255,200,.35)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,w,h);
    x.strokeStyle='rgba(160,255,210,.8)'; x.lineWidth=3; x.beginPath(); x.ellipse(cx,cy,120,80,.3,0,7); x.stroke();
    for(let i=0;i<8;i++){ x.beginPath(); x.ellipse(cx-40+i*12,cy-10+Math.sin(i)*20,10,24,.3,0,7); x.stroke(); }
    x.fillStyle='rgba(255,210,120,.9)'; x.beginPath(); x.arc(w*.25,h*.62,6,0,7); x.fill(); x.fillStyle='rgba(255,255,255,.7)'; x.font='bold 15px sans-serif'; x.fillText('you are here →',w*.08,h*.7);
    for(let i=0;i<5;i++){ x.fillStyle='rgba(120,255,180,.5)'; x.beginPath(); x.ellipse(rand(0,w),rand(0,h),rand(8,20),rand(3,8),rand(0,3),0,7); x.fill(); }
  })+')';
  $('picB').style.backgroundImage='url('+mk((x,w,h)=>{
    let g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#020208'); g.addColorStop(1,'#10081a'); x.fillStyle=g; x.fillRect(0,0,w,h);
    for(let i=0;i<260;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*.8})`; x.fillRect(Math.random()*w,Math.random()*h,1.4,1.4); }
    g=x.createRadialGradient(w*.78,h*.3,10,w*.78,h*.3,110); g.addColorStop(0,'#ff9a60'); g.addColorStop(.6,'#b8401c'); g.addColorStop(1,'#3a0e04'); x.fillStyle=g; x.beginPath(); x.arc(w*.78,h*.3,95,0,7); x.fill();
    x.fillStyle='rgba(0,0,0,.25)'; x.beginPath(); x.arc(w*.74,h*.26,95,0,7); x.fill();
    g=x.createLinearGradient(0,h*.75,0,h); g.addColorStop(0,'#8a8a90'); g.addColorStop(1,'#3a3a40'); x.fillStyle=g; x.beginPath(); x.moveTo(0,h); x.lineTo(0,h*.8); for(let i=0;i<=20;i++) x.lineTo(i*w/20,h*.78+Math.sin(i*1.3)*6); x.lineTo(w,h); x.fill();
    x.save(); x.translate(w*.3,h*.72); x.rotate(-.35); x.fillStyle='#dcdfe4'; x.fillRect(-12,-90,24,90); x.fillStyle='#e04a3a'; x.beginPath(); x.moveTo(-12,-90); x.lineTo(0,-120); x.lineTo(12,-90); x.fill(); x.fillStyle='#b8401c'; x.fillRect(-20,-18,8,18); x.fillRect(12,-18,8,18); g=x.createLinearGradient(0,0,0,70); g.addColorStop(0,'rgba(255,220,120,.95)'); g.addColorStop(1,'rgba(255,90,20,0)'); x.fillStyle=g; x.beginPath(); x.moveTo(-10,0); x.lineTo(0,70); x.lineTo(10,0); x.fill(); x.restore();
    x.strokeStyle='rgba(255,255,255,.25)'; x.setLineDash([6,8]); x.lineWidth=2; x.beginPath(); x.moveTo(w*.34,h*.5); x.quadraticCurveTo(w*.55,h*.1,w*.7,h*.32); x.stroke();
  })+')';
}

