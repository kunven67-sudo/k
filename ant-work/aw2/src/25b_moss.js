/* ================================================================
   THE MOSS (Tinyverse, first stop) — when the ray shrinks you, you land
   in the moss inside Jim's cage (real water bears live in moss!). You
   are ant-size: moss stems are trees, soil grains are boulders, a dew
   drop is a glassy dome bigger than a house. Sunlight comes through the
   leaves. A springtail jumps right over you. Walk to the dew drop and
   dive in: THAT is the microscope water world.
   Real photo textures (Poly Haven CC0): soil, moss, stems.
   ================================================================ */
const MOSS_DROP=V3(0,0,-46);
function mossLeafTex(){ return texSet('mossLeaf',[128,256],(x,w,h)=>{
    x.clearRect(0,0,w,h);
    x.save(); x.beginPath(); x.moveTo(w/2,h-4); x.bezierCurveTo(w*.98,h*.72,w*.86,h*.2,w/2,4); x.bezierCurveTo(w*.14,h*.2,w*.02,h*.72,w/2,h-4); x.closePath(); x.clip();
    // fill the leaf with the REAL moss photo, made greener, plus a midrib
    const img=(typeof AW_TEX!=='undefined'&&AW_TEX.mossPhoto)?MOSS_IMG:null;
    if(img&&img.complete){ x.drawImage(img,rand(0,200),rand(0,200),180,360,0,0,w,h); x.globalCompositeOperation='multiply'; x.fillStyle='#7ec850'; x.fillRect(0,0,w,h); x.globalCompositeOperation='source-over'; }
    else { const g=x.createLinearGradient(0,0,w,0); g.addColorStop(0,'#3d7a22'); g.addColorStop(.5,'#6aaa3a'); g.addColorStop(1,'#3d7a22'); x.fillStyle=g; x.fillRect(0,0,w,h); }
    x.strokeStyle='rgba(200,240,140,.55)'; x.lineWidth=4; x.beginPath(); x.moveTo(w/2,h); x.lineTo(w/2,8); x.stroke();
    for(let i=0;i<40;i++){ x.fillStyle=`rgba(255,255,220,${rand(.04,.12)})`; x.fillRect(rand(0,w),rand(0,h),rand(2,6),rand(6,20)); }
    x.restore();
  },{strength:1.5}); }
let MOSS_IMG=null;
function mossImgReady(){ return new Promise(res=>{ if(MOSS_IMG&&MOSS_IMG.complete) return res(); if(typeof AW_TEX==='undefined'||!AW_TEX.mossPhoto) return res(); MOSS_IMG=new Image(); MOSS_IMG.onload=()=>res(); MOSS_IMG.onerror=()=>res(); MOSS_IMG.src=AW_TEX.mossPhoto; }); }
/* a springtail: a tiny six-legged hopper with long antennae and a spring under its belly */
function makeSpringtail(){
  const g=new THREE.Group(); const m=new THREE.MeshPhysicalMaterial({color:col(0x6a7a8a),roughness:.45,clearcoat:.5,sheen:col(0x8aa0c0)}), dk=mat(0x2a3038,{roughness:.6});
  const body=mesh(GC('stBody',()=>{ const q=new THREE.CapsuleGeometry?new THREE.SphereGeometry(1,20,14):new THREE.SphereGeometry(1,20,14); q.scale(.55,.5,1.4); return q; }),m,0,.7,0); g.add(body);
  g.add(sph(.42,m,0,.8,1.25,16,12)); for(const sd of [-1,1]){ g.add(sph(.08,dk,sd*.25,.95,1.55,8,6,false)); const an=cyl(.03,.015,1.6,dk,sd*.2,1.5,2.0,6); an.rotation.x=1.0; an.rotation.z=sd*-.3; g.add(an); }
  const legs=[]; for(let i=0;i<3;i++) for(const sd of [-1,1]){ const lg=new THREE.Group(); lg.position.set(sd*.4,.55,.6-i*.55); g.add(lg); const l=cyl(.05,.03,.75,dk,0,-.3,0,6); l.rotation.z=sd*.6; lg.add(l); legs.push(lg); }
  const fur=new THREE.Group(); fur.position.set(0,.35,-1.1); g.add(fur); const f=cyl(.06,.04,1.2,dk,0,0,.55,6); f.rotation.x=Math.PI/2; fur.add(f);
  g.userData={legs,fur,body}; return g;
}
defineLevel('moss',{
  title:'the moss',
  env:{fx:{exposure:1.05,saturation:1.08,contrast:1.1,temp:.06,bloomStrength:.45,bloomThreshold:.95,vignette:.45,grain:.03},music:'tiny',reverb:.3,amb:[['breeze',.05]],surface:'dirt',far:420},
  async build(scene,lv){
    await mossImgReady();
    const sunDir=V3(.35,.9,.25).normalize();
    scene.background=col(0xa8c890); scene.fog=new THREE.FogExp2(col(0x9ab884),.011);   // thick green haze = you feel tiny
    lv.envMap=makeEnv({top:0xd8ecc0,horizon:0x8ab070,bottom:0x3a3020,lights:[{x:sunDir.x*30,y:sunDir.y*30,z:sunDir.z*30,w:8,h:8,c:0xfff2d0,k:5}]});
    makeRig(scene,{sun:2.4,sunColor:0xfff0cc,hemi:.55,sky:0xc8e8a8,ground:0x4a3a24,dir:sunDir,span:40,dist:90,far:200});
    lv.sunWorld=sunDir.clone().multiplyScalar(400);
    // the ground: real soil photo, each grain the size of a rock
    const soil=new THREE.MeshStandardMaterial({map:awTex('soil',30,30),normalMap:awTex('soilN',30,30,false),normalScale:new THREE.Vector2(2.2,2.2),roughness:.95});
    const gr=mesh(new THREE.PlaneGeometry(260,260),soil,0,0,-20); gr.rotation.x=-Math.PI/2; gr.receiveShadow=true; scene.add(gr);
    // soil grains = boulders (the path stays clear)
    const rockM=new THREE.MeshStandardMaterial({map:awTex('soil',1.5,1.5),normalMap:awTex('soilN',1.5,1.5,false),normalScale:new THREE.Vector2(2.5,2.5),roughness:.9,color:col(0xc0a890)});
    const rockG=GC('mossRock',()=>{ const q=new THREE.IcosahedronGeometry(1,2); const p=q.attributes.position; for(let i=0;i<p.count;i++){ const v=V3(p.getX(i),p.getY(i),p.getZ(i)); v.multiplyScalar(1+(Math.sin(v.x*3.1)+Math.sin(v.y*2.7+1)+Math.sin(v.z*3.7+2))*.08); p.setXYZ(i,v.x,v.y*.7,v.z); } q.computeVertexNormals(); return q; });
    const rocks=new THREE.InstancedMesh(rockG,rockM,90); const o=new THREE.Object3D(); let ri=0;
    for(let i=0;i<90;i++){ let x=rand(-70,70), z=rand(-95,40); if(Math.abs(x)<5.5&&z>-52&&z<38) x+=Math.sign(x||1)*8; const s=rand(.4,2.6);
      o.position.set(x,s*.25,z); o.rotation.set(rand(0,3),rand(0,6),rand(0,3)); o.scale.setScalar(s); o.updateMatrix(); rocks.setMatrixAt(ri++,o.matrix); if(s>1.2) colCircle(lv.col,x,z,s*.85); }
    rocks.castShadow=true; rocks.receiveShadow=true; scene.add(rocks);
    // moss: tall stems (trees to you) covered in leaves, a clear path down the middle
    const stemM=new THREE.MeshStandardMaterial({map:awTex('stem',1,6),normalMap:awTex('stemN',1,6,false),color:col(0x8aa868),roughness:.85});
    const leafT=mossLeafTex();
    const leafM=new THREE.MeshStandardMaterial({map:leafT.map,normalMap:leafT.normalMap,alphaTest:.5,side:THREE.DoubleSide,roughness:.6,emissive:col(0x2a5a12),emissiveIntensity:.35});   // a little glow = sun through the leaf
    const spots=[]; for(let i=0;i<dq(50,80,110,150,170);i++){ let x=rand(-60,60), z=rand(-90,36); if(Math.abs(x)<6.5&&z>-56&&z<38) continue; if(Math.hypot(x-MOSS_DROP.x,z-MOSS_DROP.z)<10) continue; spots.push([x,z,rand(7,22),rand(-.15,.15),rand(-.15,.15)]); }
    // a wall of moss on both sides of the path so the way to go is obvious
    for(let z=34;z>-54;z-=dq(5,4.2,3.6,3.2,3)) for(const sd of [-1,1]){ spots.push([sd*rand(7,10),z+rand(-1,1),rand(9,20),rand(-.1,.1),sd*rand(.05,.2)]); }
    const stems=new THREE.InstancedMesh(GC('mossStem',()=>{ const c=new THREE.CylinderGeometry(.13,.2,1,8,4); c.translate(0,.5,0); return c; }),stemM,spots.length);
    let leafN=0; const LPM=dq(1.6,2.2,2.8,3.2,3.6); for(const s of spots) leafN+=Math.floor(s[2]*LPM);
    const leaves=new THREE.InstancedMesh(GC('mossLeafQ',()=>{ const q=new THREE.PlaneGeometry(.9,1.8); q.translate(0,.9,0); return q; }),leafM,leafN);
    let li=0;
    spots.forEach((s,i)=>{ const [x,z,h,tx,tz]=s; o.position.set(x,0,z); o.rotation.set(tx,rand(0,6),tz); o.scale.set(1,h,1); o.updateMatrix(); stems.setMatrixAt(i,o.matrix);
      const stemM4=o.matrix.clone(); const n=Math.floor(h*LPM);
      for(let k=0;k<n;k++){ const u=k/n, y=.08+u*.96, a=k*2.4; const len=lerp(1.3,.55,u);
        const L=new THREE.Object3D(); L.position.set(0,y,0); L.rotation.set(0,a,0); L.updateMatrix();
        const tilt=new THREE.Matrix4().makeRotationX(-lerp(.9,.35,u)), sc=new THREE.Matrix4().makeScale(len,len/h*1,len);
        // leaf in stem space: unscale the stem's y stretch so leaves keep their shape
        const M=new THREE.Matrix4().multiplyMatrices(stemM4,L.matrix).multiply(new THREE.Matrix4().makeScale(1,1/h,1)).multiply(new THREE.Matrix4().makeTranslation(0,0,.12)).multiply(tilt).multiply(new THREE.Matrix4().makeScale(len,len,len));
        leaves.setMatrixAt(li++,M); }
      if(Math.abs(x)<14) colCircle(lv.col,x,z,.45); });
    leaves.count=li; stems.castShadow=true; leaves.castShadow=true; leaves.receiveShadow=true; scene.add(stems); scene.add(leaves);
    lv.leaves=leaves;
    // the giant dew drop (and small ones sitting on leaves)
    const dropM=rimify(new THREE.MeshPhysicalMaterial({color:col(0xd8ecff),roughness:0,metalness:.1,transparent:true,opacity:.32,clearcoat:1,clearcoatRoughness:0,envMapIntensity:2.2,depthWrite:false}),0xf0fbff,1.1,2.2);   // glassy water (no refraction pass = no lag on a GT 1030)
    const drop=mesh(GC('dewDrop',()=>{ const q=new THREE.SphereGeometry(1,48,32); const p=q.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i); p.setY(i,y<0?y*.25:y*.82); } q.computeVertexNormals(); return q; }),dropM,MOSS_DROP.x,1.2,MOSS_DROP.z,false); drop.scale.setScalar(7.5); scene.add(drop); lv.drop=drop;
    colCircle(lv.col,MOSS_DROP.x,MOSS_DROP.z,6.2,()=>!lv.diving);
    for(let i=0;i<26;i++){ const d=mesh(GC('dewDrop',()=>null),dropM,rand(-40,40),rand(2,14),rand(-80,30),false); d.scale.setScalar(rand(.3,1.1)); scene.add(d); }
    // sun shafts + floating dust
    lv.motes=[]; const moteM=new THREE.MeshBasicMaterial({color:col(0xfff4d8),transparent:true,opacity:.5,depthWrite:false});
    for(let i=0;i<40;i++){ const m=sph(.05,moteM,rand(-20,20),rand(1,10),rand(-50,30),6,4,false); scene.add(m); lv.motes.push({m,ph:rand(0,6),y:m.position.y}); }
    // a springtail that jumps over you, and a mite strolling in the back
    lv.spring=makeSpringtail(); lv.spring.scale.setScalar(1.4); lv.spring.position.set(-14,0,-14); lv.spring.rotation.y=Math.PI/2; scene.add(lv.spring);
    lv.mite=makeDustMite(); lv.mite.scale.setScalar(3); lv.mite.position.set(18,0,-30); scene.add(lv.mite);
    lv.col.bounds=[-12,12,-56,40];
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.55; FX.raysColor.set(1,.95,.75); },
  update(dt,t){ const lv=this;
    for(const M of lv.motes){ M.m.position.y=M.y+Math.sin(t*.4+M.ph)*.6; M.m.position.x+=Math.sin(t*.2+M.ph)*dt*.15; }
    if(lv.mite&&typeof animateDustMite==='function'){ lv.mite.position.x-=dt*.35; lv.mite.rotation.y=-Math.PI/2; try{ animateDustMite(lv.mite,t,dt); }catch(e){} }
    if(lv.drop){ const s=7.5*(1+Math.sin(t*1.3)*.006); lv.drop.scale.set(s,7.5*(1-Math.sin(t*1.3)*.008),s); }
  }
});
/* the moss stage: you land, Jim talks you to the dew drop, a springtail jumps over you, you dive in */
async function mossStage(){
  const lv=await enterLevel('moss',{pos:V3(0,0,32),yaw:0,pitch:.05});
  const F=F_(); PLAYER.fly=false; PLAYER.swim=false; PLAYER.scale=PLAYER.targetScale=1; PLAYER.eye=1.64; PLAYER.item=null; setVM(true); setVMSuit(true);
  PLAYER.lock(); crosshair(true); hudVisible(true);
  FX.whiteout=1; await tweenVal(k=>FX.whiteout=1-k,1.8);
  say("You land on something soft... and green.",3.4); await wait(2.2);
  lookAtPoint(V3(-6,16,10),2.2); await wait(2.4); lookAtPoint(V3(0,4,-20),1.6); await wait(1.4);
  await talk([{who:'Jim',radio:true,text:"Can you hear me? Whoa, it worked! You're in the moss inside my cage!",auto:1.2},
              {who:'You',text:"Jim... these are moss leaves. They're like trees.",auto:1},
              {who:'Jim',radio:true,text:"Water bears live in moss. See that big shiny ball of water down there? That's a dew drop. They're in there.",auto:1.2},
              {who:'Jim',radio:true,text:"Get in it. I'll be watching on the micro-cam.",auto:1}]);
  objective('Walk to the giant dew drop'); setMarker(()=>MOSS_DROP.clone().add(V3(0,7,0)),'dew drop','m');
  PLAYER.free();
  // halfway: the springtail
  runStory(async()=>{
    await waitUntil(()=>PLAYER.pos.z<6);
    const S=lv.spring, A=V3(-14,0,PLAYER.pos.z-9), B=V3(14,0,PLAYER.pos.z-6);
    SFX.squirm&&SFX.squirm(); bark('Jim',"What's THAT?!",null,1.6,true); await wait(.6);
    sfxAt(A,()=>SFX.whoosh&&SFX.whoosh(1),4);
    await tweenVal(k=>{ S.position.lerpVectors(A,B,k); S.position.y=Math.sin(k*Math.PI)*11; S.rotation.x=-k*Math.PI*2; S.userData.fur.rotation.x=k<.1?-1.4*(k/.1):-1.4; },1.3,x=>x);
    S.rotation.x=0; S.userData.fur.rotation.x=0; SFX.thud&&SFX.thud(); shake(.45);
    bark('Jim',"A springtail! They jump with a spring under their belly. Harmless. I think.",null,3.4,true);
    await tweenVal(k=>{ S.position.x=lerp(14,30,k); },2.5);
  });
  await waitUntil(()=>PLAYER.pos.distanceTo(V3(MOSS_DROP.x,0,MOSS_DROP.z))<9.5);
  setMarker(null); objective(null); PLAYER.lock();
  lookAtPoint(MOSS_DROP.clone().add(V3(0,3,0)),.9); await wait(1);
  say("Up close it's like a glass dome. Little things are swimming inside.",3.6); await wait(2.6);
  bark('Jim',"Go on. Jump in!",null,2,true); await wait(1.4);
  lv.diving=true; SFX.splash&&SFX.splash();
  const p0=PLAYER.pos.clone(), p1=V3(MOSS_DROP.x,0,MOSS_DROP.z+2);
  await tweenVal(k=>{ PLAYER.pos.lerpVectors(p0,p1,k); FX.whiteout=Math.max(0,(k-.6)/.4); },1.4);
  setMarker(null);
}
