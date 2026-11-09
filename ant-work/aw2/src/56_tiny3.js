/* ================================================================
   THE TINYVERSE PART 3 — the last two creatures (a Rotifer and a
   Volvox), getting stuck tiny, moving in with Larry in Mite Town, the
   giant tardigrade coming back hungry, and the deep quest for the
   shrink-ray crystal shard.
   ================================================================ */
/* ---------- the rotifer: a see-through trumpet with two spinning wheels of cilia ---------- */
function makeRotifer(){
  const g=new THREE.Group();
  const bodyM=rimify(new THREE.MeshPhysicalMaterial({color:col(0xd8f0e0),roughness:.2,transparent:true,opacity:.55,clearcoat:1,depthWrite:false,side:THREE.DoubleSide}),0xa0ffe0,1.2,2.2);
  const pts=[[0,-30],[1.2,-29],[2.2,-24],[3.2,-18],[5,-10],[7,-2],[8.5,6],[9,12],[10.5,16],[11,18],[0,18]].map(p=>new THREE.Vector2(p[0],p[1]));
  g.add(mesh(new THREE.LatheGeometry(pts,40),bodyM,0,0,0,false));
  // toes
  for(const s of [-1,1]){ const t=mesh(new THREE.ConeGeometry(.8,5,10),bodyM,s*.9,-32,0,false); t.rotation.z=s*.25+Math.PI; g.add(t); }
  // insides: jaws (mastax), stomach, eyespot
  g.add(sph(2.6,new THREE.MeshPhysicalMaterial({color:col(0x6a5a3a),roughness:.4,transparent:true,opacity:.8}),0,8,0,16,12,false));
  const st=sph(4,rimify(new THREE.MeshPhysicalMaterial({color:col(0x8ad84a),roughness:.3,transparent:true,opacity:.7,emissive:col(0x2a5a0a)}),0xb0ff60,.6,2),0,-2,0,20,14,false); st.scale.set(1,1.5,1); g.add(st);
  g.add(sph(.9,emissiveMat(0xff3a2a,1.5),0,14,4,8,6,false));
  // the corona: two wheels of beating cilia
  const wheels=[];
  for(const s of [-1,1]){ const w=new THREE.Group(); w.position.set(s*5.5,19,0); g.add(w); w.add(mesh(new THREE.TorusGeometry(5,.6,8,32),bodyM,0,0,0,false)).children; w.children[0].rotation.x=Math.PI/2;
    const cp=[]; for(let k=0;k<60;k++){ const a=k/60*Math.PI*2; const x=Math.cos(a)*5, z=Math.sin(a)*5; cp.push(x,0,z,x*1.25,2.4,z*1.25); }
    const cg=new THREE.BufferGeometry(); cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3)); w.add(new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:col(0xe0fff0),transparent:true,opacity:.8}))); wheels.push(w); }
  g.userData={wheels,ph:rand(0,6)}; return g;
}
/* ---------- the volvox: a hollow green ball made of little cells, with baby balls inside ---------- */
function makeVolvox(R=30){
  const g=new THREE.Group();
  g.add(sph(R,rimify(new THREE.MeshPhysicalMaterial({color:col(0x9ae87a),roughness:.1,transparent:true,opacity:.18,clearcoat:1,depthWrite:false,side:THREE.DoubleSide}),0x9aff7a,1.4,2),0,0,0,48,32,false));
  const n=700, im=new THREE.InstancedMesh(new THREE.SphereGeometry(.7,8,6),emissiveMat(0x4ac83a,.9,{roughness:.4}),n); const o=new THREE.Object3D();
  for(let i=0;i<n;i++){ const y=1-2*(i+.5)/n, r=Math.sqrt(1-y*y), a=i*2.39996; o.position.set(Math.cos(a)*r*R,y*R,Math.sin(a)*r*R); o.updateMatrix(); im.setMatrixAt(i,o.matrix); }
  g.add(im);
  const kids=[]; for(let i=0;i<5;i++){ const k=sph(rand(5,8),rimify(new THREE.MeshPhysicalMaterial({color:col(0x3aa82a),roughness:.3,transparent:true,opacity:.75,emissive:col(0x1a5a0a)}),0x8aff5a,.8,2),rand(-12,12),rand(-12,12),rand(-12,12),20,14,false); g.add(k); kids.push(k); }
  g.userData={kids,R}; return g;
}
/* the two new creatures live in the regular Tinyverse level */
function ensureP3Creatures(lv){
  if(lv.rotifer) return;
  lv.rotifer=makeRotifer(); lv.rotifer.scale.setScalar(1.6); lv.rotifer.visible=false; lv.scene.add(lv.rotifer);
  lv.volvox=makeVolvox(30); lv.volvox.visible=false; lv.scene.add(lv.volvox);
  solidAuto(lv,lv.rotifer,{k:.7}); addSolid(lv,lv.volvox,'sphere',{r:31});
  lv.subjects.push({obj:lv.rotifer,name:'rotifer',label:'Rotifer',r:34,hunt:true});
  lv.subjects.push({obj:lv.volvox,name:'volvox',label:'Volvox',r:32,hunt:true});
  const a=HUNT.anc||{pos:V3(20,0,-40),f:V3(0,0,-1),right:V3(1,0,0)};
  lv.rotifer.userData.home=clampHunt(a.pos.clone().addScaledVector(a.right,60).addScaledVector(a.f,190).add(V3(0,40,0)));
  lv.volvox.userData.home=clampHunt(a.pos.clone().addScaledVector(a.right,-40).addScaledVector(a.f,-150).add(V3(0,70,0)));
  lv.rotifer.position.copy(lv.rotifer.userData.home); lv.volvox.position.copy(lv.volvox.userData.home);
}
on('tick',()=>{ if(!LV||LV.name!=='tiny'||!LV.rotifer) return; const lv=LV, t=G.time, dt=G.dt||.016;
  const R=lv.rotifer; if(R.visible){ R.userData.wheels.forEach((w,i)=>w.rotation.y+=dt*(i?9:-9)); R.position.copy(R.userData.home).add(V3(Math.sin(t*.3)*6,Math.sin(t*.5)*4,0)); R.rotation.z=Math.sin(t*.4)*.2; R.rotation.x=Math.sin(t*.3)*.15; }
  const V=lv.volvox; if(V.visible){ V.rotation.y+=dt*.25; V.rotation.x+=dt*.1; V.position.copy(V.userData.home).add(V3(Math.sin(t*.2)*10,Math.cos(t*.17)*6,Math.sin(t*.13)*8)); }
});

/* ---------- a tiny-world backdrop (same look as the Tinyverse, different colours) ---------- */
function tinyBackdrop(scene,top,mid,bot){
  const m=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{t:WIND.time,top:{value:col(top)},mid:{value:col(mid)},bot:{value:col(bot)}},vertexShader:SKY_VS,
    fragmentShader:`uniform float t; uniform vec3 top,mid,bot; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5); }
      float n(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ vec3 d=normalize(vDir); vec3 c=d.y>0.0?mix(mid,top,pow(d.y,1.4)):mix(mid,bot,pow(-d.y,.8));
        float cl=n(d*3.0+vec3(t*0.02,0.0,0.0))*0.6+n(d*7.0-vec3(0.0,t*0.03,0.0))*0.4; c+=top*0.5*pow(cl,3.0)*max(0.2,d.y+0.5);
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`});
  const bg=new THREE.Mesh(new THREE.SphereGeometry(3500,48,24),m); bg.renderOrder=-10; bg.frustumCulled=false; scene.add(bg); return bg;
}
/* a fluffy lint bed: a tangle of soft fibers */
function makeLint(n=40,R=18,colors=[0xd8e8ff,0xffd8ec,0xfff4d8]){
  const g=new THREE.Group();
  for(let i=0;i<n;i++){ const pts=[]; let p=V3(rand(-R,R)*.6,rand(0,R*.4),rand(-R,R)*.6); for(let k=0;k<6;k++){ pts.push(p.clone()); p=p.clone().add(V3(rand(-R,R)*.4,rand(-R,R)*.15,rand(-R,R)*.4)); p.y=clamp(p.y,0,R*.5); }
    const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,rand(.35,.8),6),new THREE.MeshPhysicalMaterial({color:col(pick(colors)),roughness:.8,sheen:col(0xffffff),transparent:true,opacity:.85})); g.add(tube); }
  return g;
}

/* ================= the hunt continues (after Larry) ================= */
async function huntNext(n){
  const lv=LEVELS.tiny, F=F_(); ensureP3Creatures(lv);
  if(n==='larry'){ lv.rotifer.visible=true; lv.volvox.visible=false; F.huntTarget='rotifer'; setMarker(()=>lv.rotifer.position,'Creature'); objective('Find different creatures for Jim: <b>3</b>/5'); PLAYER.item='camera'; PLAYER.free(); }
  else if(n==='rotifer'){ F.huntN=4; F.huntTarget=null; await wait(1.1); objective('Find different creatures for Jim: <b>4</b>/5'); say('1 creature left.',3); await wait(1); lv.volvox.visible=true; F.huntTarget='volvox'; setMarker(()=>lv.volvox.position,'Creature'); }
  else if(n==='volvox'){ F.huntN=5; F.huntTarget=null; await wait(1.2); objective('Find different creatures for Jim: <b>5</b>/5'); unlock('allSix'); await wait(1.5); growFails(); }
}
async function growFails(){
  const lv=LEVELS.tiny, F=F_(); F.hunt=false; setMarker(null); itemHints(null); PLAYER.lock(); objective(null);
  setCheckpoint('A6');
  await talk([{who:'Jim',radio:true,text:"That's all of them! Great job! Ok, now I'm going to make you big again."}]);
  SFX.rayCharge&&SFX.rayCharge(); await wait(1.2);
  SFX.grow(); shake(.6); await tweenVal(k=>{ FX.whiteout=Math.sin(k*Math.PI)*.8; PLAYER.fovKick=-10*Math.sin(k*Math.PI); },1.4);
  await wait(1);
  SFX.grow(); shake(.4); await tweenVal(k=>{ FX.whiteout=Math.sin(k*Math.PI)*.6; },1);
  await wait(1.2);
  await talk([{who:'Jim',radio:true,text:"I'm sorry. It's not working."}]);
  say("You're stuck like this.",3.6); await wait(3.8);
  await larryRoommate();
}
function clearSpotNear(lv,p,dist){
  const objs=(lv.solids||[]).map(S=>S.obj).filter(o=>o&&worldVisible(o)), rc=new THREE.Raycaster();
  const f=new THREE.Vector3(); camera.getWorldDirection(f); f.y=0; f.normalize();
  for(const a of [0,.6,-.6,1.2,-1.2,1.8,-1.8,Math.PI]){ const d=f.clone().applyAxisAngle(V3(0,1,0),a); d.y=-.12; d.normalize(); rc.set(p,d); rc.far=dist+20; if(!rc.intersectObjects(objs,true).length) return p.clone().addScaledVector(d,dist); }
  return p.clone().add(V3(0,dist,0));
}
async function larryRoommate(){
  const lv=LEVELS.tiny, L=lv.larry, F=F_();
  // Larry swims over
  // he stops where you can actually see him: the first direction around you with nothing (a flake, a blob) in the way
  const to=clearSpotNear(lv,PLAYER.pos,42); const from=L.position.clone(); L.visible=true;
  lookAtPoint(to.clone().add(V3(0,8,0)),1);
  await tweenVal(k=>{ L.position.lerpVectors(from,to,k); const d=PLAYER.pos.clone().sub(L.position); L.rotation.y=Math.atan2(d.x,d.z); },2.4);
  L.userData.talking=true;
  await talk([{who:'Larry',voice:'Larry',text:"Guess you're my roommate now."}]);
  L.userData.talking=false;
  objective('Swim with Larry to his flake home'); F.followLarry=true;
  const home=clampHunt(PLAYER.pos.clone().add(V3(-120,-40,-260)));
  lv.larryGoal=home; setMarker(()=>L.position.clone().add(V3(0,16,0)),'Larry');
  PLAYER.free();
  // Larry swims ahead, waiting for you if you fall behind
  while(L.position.distanceTo(home)>6){ const d=L.position.distanceTo(PLAYER.pos); const sp=d<90?16:d<140?6:0; const dir=home.clone().sub(L.position).normalize(); L.position.addScaledVector(dir,sp*(G.dt||.016)); L.rotation.y=Math.atan2(dir.x,dir.z); await wait(0); }
  await waitUntil(()=>PLAYER.pos.distanceTo(home)<70);
  PLAYER.lock(); setMarker(null); objective(null);
  await fade(1,.8); $('visor').classList.remove('show');
  startFromCheckpointInner('A7');
}

/* ================= MITE TOWN ================= */
defineLevel('mitetown',{
  title:'Mite Town',
  env:{fly:true,swim:true,fx:{exposure:1.12,saturation:1.15,contrast:1.05,bloomStrength:.4,bloomThreshold:1.05,aoRadius:3,aoStrength:.6,vignette:.45,temp:.06,aberr:.003,grain:.04},music:'larry',reverb:.5,amb:[['tiny',.1],['tinyHi',.012]],ambEvents:[['microChirp',5]],near:.1,far:4000,speed:5},
  async build(scene,lv){
    scene.background=col(0x2a2418); tinyBackdrop(scene,0x8a7a4a,0x2a2418,0x100a08);
    lv.envMap=makeEnv({top:0xd8b870,horizon:0x4a3a20,bottom:0x100a08,lights:[{x:0,y:40,z:0,w:30,h:30,c:0xffe0a0,k:3},{x:30,y:-10,z:20,w:10,h:10,c:0x9affff,k:1}]});
    makeRig(scene,{sun:1.7,sunColor:0xffe8c0,hemi:.75,sky:0xffd890,ground:0x3a2a18,dir:V3(.2,1,.3),span:260,dist:500,far:1200});
    scene.fog=new THREE.FogExp2(col(0x2a2418),.0026); lv.fogBase=.0026;
    // the town: skin flakes stacked like floors and roofs
    lv.flakes=[]; const spots=[[0,-20,0,110,0],[-120,10,-40,80,.4],[110,-5,-60,90,-.3],[-40,40,-150,70,.8],[80,50,60,60,.2],[-110,-40,90,75,-.6],[30,-55,-170,85,1.2],[150,30,-190,60,.5]];
    for(const [x,y,z,s,r] of spots){ const f=makeSkinFlake(20+lv.flakes.length,s); f.position.set(x,y,z); f.rotation.set(-Math.PI/2+rand(-.15,.15),0,r); scene.add(f); lv.flakes.push(f); }
    // lint beds
    lv.beds=[]; for(const [x,y,z] of [[-20,-18,20],[25,-18,-15],[-118,12,-30],[112,-3,-50],[-108,-38,95]]){ const b=makeLint(34,20); b.position.set(x,y,z); scene.add(b); lv.beds.push(b); }
    // snack market: bubbles with Paramecium snacks in them, under lint awnings
    lv.market=[]; const mc=V3(-40,42,-150);
    for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; const p=mc.clone().add(V3(Math.cos(a)*30,4,Math.sin(a)*30)); const bub=sph(7,new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:0,transparent:true,opacity:.2,clearcoat:1,depthWrite:false}),p.x,p.y+6,p.z,24,16,false); scene.add(bub); solidAuto(lv,bub,{shape:'sphere',k:1}); const s=makeSnack(); s.position.copy(p).add(V3(0,6,0)); s.scale.setScalar(.8); scene.add(s); lv.market.push(s); const aw=makeLint(8,10,[0xff9ab8,0x9ad8ff,0xffe08a]); aw.position.copy(p).add(V3(0,12,0)); scene.add(aw); }
    const signT=canvasTex(512,160,(x,w,h)=>{ x.fillStyle='rgba(40,20,10,.7)'; x.fillRect(0,0,w,h); x.fillStyle='#ffe08a'; x.font='bold 64px Arial Black, sans-serif'; x.textAlign='center'; x.fillText('SNACKS',w/2,105); });
    const sign=mesh(new THREE.PlaneGeometry(40,12.5),new THREE.MeshBasicMaterial({map:signT,transparent:true,side:THREE.DoubleSide}),mc.x,mc.y+34,mc.z,false); scene.add(sign); lv.marketSign=sign;
    // the mites of Mite Town
    lv.mites=[]; for(let i=0;i<14;i++){ const m=makeDustMite(); m.scale.setScalar(rand(8,12)); const f=pick(lv.flakes); m.position.copy(f.position).add(V3(rand(-25,25),2,rand(-25,25))); m.rotation.y=rand(0,6.28); scene.add(m); m.userData.home=m.position.clone(); m.userData.ph=rand(0,6); lv.mites.push(m); }
    lv.larry=makeDustMite(); lv.larry.scale.setScalar(12); scene.add(lv.larry);
    // solid stuff in Mite Town
    for(const f of lv.flakes) flakeSolid(lv,f); for(const b of lv.beds) solidAuto(lv,b,{k:.72}); for(const m of lv.mites) solidAuto(lv,m,{k:.72}); solidAuto(lv,lv.larry,{k:.72});
    // Larry's home flake has his own lint bed and a lamp (a glowing snack)
    lv.home=lv.flakes[0];
    lv.lamp=new THREE.PointLight(col(0xffd070),2,160,2); lv.lamp.position.set(0,20,0); scene.add(lv.lamp);
    // the giant tardigrade (it comes back later) and the lint tangle you lead it into
    lv.tard=makeTardigrade({color:0xc8b098}); lv.tard.scale.setScalar(42); lv.tard.visible=false; scene.add(lv.tard);
    lv.trap=makeLint(120,60,[0xe8e8f0,0xc8d0e0,0xf0e0e8]); lv.trap.position.set(-330,-30,-170); lv.trap.scale.setScalar(1.6); scene.add(lv.trap);
    solidAuto(lv,lv.tard,{k:.68}); solidAuto(lv,lv.trap,{k:.6});
    lv.snow=makeSnowFor(scene);
    lv.flyBounds=(p,v)=>{ const lim=[[-320,320],[-200,200],[-700,300]]; ['x','y','z'].forEach((k,i)=>{ if(p[k]<lim[i][0]){ p[k]=lim[i][0]; v[k]=Math.abs(v[k])*.3; } if(p[k]>lim[i][1]){ p[k]=lim[i][1]; v[k]=-Math.abs(v[k])*.3; } }); };
    lv.col.bounds=null;
  },
  enter(){ this.scene.fog.density=this.fogBase; FX.sunWorld=V3(80,3000,300); FX.rays=.3; FX.raysColor.set(1,.9,.6); },
  update(dt,t){
    const lv=this, F=F_(); WIND.time.value=t;
    animateDustMite(lv.larry,t,dt);
    for(const m of lv.mites){ animateDustMite(m,t,dt); const U=m.userData; let goal=U.home.clone().add(V3(Math.sin(t*.3+U.ph)*6,Math.sin(t*.7+U.ph)*1.5,Math.cos(t*.25+U.ph)*6));
      if(lv.nervous){ const away=m.position.clone().sub(PLAYER.pos); const d=away.length(); if(d<70) goal.addScaledVector(away.normalize(),(70-d)*.8); }
      if(lv.panic&&lv.tard.visible){ const away=m.position.clone().sub(lv.tard.position); goal.addScaledVector(away.normalize(),30); }
      if(lv.cheer) goal.y+=Math.abs(Math.sin(t*6+U.ph))*8;
      m.position.lerp(goal,Math.min(1,dt*(lv.cheer?4:1.2))); if(lv.nervous) m.lookAt(PLAYER.pos.x,m.position.y,PLAYER.pos.z); }
    for(const s of lv.market){ s.rotation.y+=dt*.6; }
    if(lv.tard.visible) animateTardigrade(lv.tard,t*.6,lv.tardWalk==null?1:lv.tardWalk,lv.tardMouth||0);
    if(lv.snow) lv.snow.material.uniforms.px.value=renderer.domElement.height*.5;
  }
});
/* floating specks like the Tinyverse has (reuse its material when it exists) */
function makeSnowFor(scene){ const T=LEVELS.tiny; if(!T||!T.snow) return null; const s=new THREE.Points(T.snow.geometry,T.snow.material); s.frustumCulled=false; scene.add(s); return s; }

/* ================= A6: STUCK TINY ================= */
CHECKPOINTS.A6=async()=>{
  const lv=await enterLevel('tiny',{pos:V3(0,0,50),yaw:0});
  setCheckpoint('A6');
  PLAYER.fly=true; PLAYER.eye=0; PLAYER.scale=PLAYER.targetScale=1; PLAYER.item='camera'; setVM(true); setVMSuit(true);
  $('visor').classList.add('show'); $('scaleRead').textContent='1 : 10,000,000'; $('photoRead').textContent='PHOTOS: 5';
  PLAYER.lock(); crosshair(true); lv.giant.visible=false; lv.fleeing=0; lv.giantMouth=0; lv.demodex.visible=false;
  const A=placeTinyLife(lv,{pos:V3(20,0,-40),f:V3(0,0,-1)}); ensureP3Creatures(lv); lv.rotifer.visible=lv.volvox.visible=true;
  PLAYER.pos.copy(A.P).addScaledVector(A.f,-16).addScaledVector(A.right,-30); lookAtPoint(lv.larry.position,0);
  FX.whiteout=1; fade(0,.4); playMusic('tiny',1);
  await tweenVal(k=>FX.whiteout=1-k,1.2);
  await growFails();
};

/* ================= A7: MITE TOWN ================= */
CHECKPOINTS.A7=async()=>{
  const lv=await enterLevel('mitetown',{pos:V3(0,30,240),yaw:0});
  setCheckpoint('A7'); const F=F_();
  PLAYER.fly=true; PLAYER.eye=0; PLAYER.scale=PLAYER.targetScale=1; PLAYER.item=null; setVM(true); setVMSuit(true);
  $('visor').classList.add('show'); $('scaleRead').textContent='1 : 10,000,000'; $('photoRead').textContent='PHOTOS: 5';
  PLAYER.lock(); crosshair(true); hudVisible(true); objective(null);
  const L=lv.larry; L.visible=true; L.position.set(55,10,170); L.rotation.y=Math.PI*1.2;
  lv.tard.visible=false; lv.nervous=true; lv.cheer=false; lv.panic=false;
  for(const m of lv.mites){ m.position.copy(m.userData.home); m.visible=true; }
  lookAtPoint(V3(0,0,0),0);
  FX.blackout=0; await fade(0,1);
  say('Mite Town. A pile of skin flakes, with a lot of dust mites living on it.',4.4); await wait(4.6);
  say('The mites look nervous.',3); await wait(1.5);
  L.userData.talking=true;
  await talk([{who:'Larry',voice:'Larry',text:"Everybody, it's ok! This is my new roommate."},{who:'Larry',voice:'Larry',text:"Come on, I'll show you around. That's the snack market. And those are the lint beds. Super comfy."}]);
  L.userData.talking=false; lv.nervous=false;
  objective('Look around Mite Town'); PLAYER.free();
  if(!lv.setup){ lv.setup=true;
    addInteract(lv,{obj:lv.marketSign,label:'Snack market',reach:90,d3:true,act:()=>{ F_().sawMarket=true; if(trophyStat('market')>=5) unlock('shopper'); bark('You','Paramecium snacks. In bubbles.',null,2.6); }});
    addInteract(lv,{obj:lv.beds[0],offset:V3(0,6,0),label:'Lint bed',reach:60,d3:true,act:()=>{ F_().sawBed=true; bark('You','It IS super comfy.',null,2.6); }});
    addInteract(lv,{obj:lv.larry,offset:V3(0,16,0),label:'Talk to Larry',reach:70,d3:true,when:()=>!F_().tardOn,act:()=>(trophyStat('larryTalk')>=5&&unlock('chatter'),larrySay)(pick(["The market has the best snacks. Trust me.","You can sleep on any lint bed you want.","The other mites will get used to you."]))});
  }
  await waitUntil(()=>F_().sawMarket&&F_().sawBed,90);
  await wait(2);
  await tardComes();
};
async function tardComes(){
  const lv=LEVELS.mitetown, F=F_(), T=lv.tard; F.tardOn=true; PLAYER.lock(); objective(null);
  sfxAt(V3(0,0,-400),()=>SFX.giantRumble&&SFX.giantRumble(),200); shake(.4);
  T.visible=true; T.position.set(-330,-10,330); T.lookAt(0,-10,0); lv.tardWalk=1; lv.tardMouth=0;
  playMusic('giant',1);
  lookAtPoint(T.position.clone().add(V3(0,40,0)),1.2); await wait(1.4);
  lv.panic=true;
  L_say: { lv.larry.userData.talking=true; await talk([{who:'Larry',voice:'Larry',text:"Oh no. The giant tardigrade! And it looks hungry!"},{who:'Larry',voice:'Larry',text:"It's heading for Mite Town!"}]); lv.larry.userData.talking=false; }
  objective("Get the tardigrade's attention"); setMarker(()=>T.position.clone().add(V3(0,50,0)),'Tardigrade');
  itemHints(['Swim close to its face','Then lead it to the big lint tangle']);
  PLAYER.free(); playMusic('launch',1);
  // the chase
  let state='approach', warned=0;
  const center=V3(0,-10,0), trap=lv.trap.position.clone();
  while(true){ const dt=G.dt||.016; await wait(0); if(DLG.active) continue;
    const head=T.position.clone().add(T.getWorldDirection(new THREE.Vector3()).multiplyScalar(60)).add(V3(0,20,0));
    const dP=head.distanceTo(PLAYER.pos);
    if(state==='approach'){ const tgt=center; const dir=tgt.clone().sub(T.position); const d=dir.length(); if(d>120) T.position.addScaledVector(dir.normalize(),12*dt); else lv.tardMouth=.5+Math.sin(G.time*3)*.3; T.lookAt(tgt.x,T.position.y,tgt.z);
      if(dP<90){ state='follow'; SFX.giantCall&&SFX.giantCall(); lv.tardMouth=0; objective('Lead the tardigrade to the big lint tangle'); setMarker(()=>trap.clone().add(V3(0,60,0)),'Lint tangle'); toast('It sees you!','#ffcc66'); } }
    else if(state==='follow'){ const dir=PLAYER.pos.clone().sub(T.position); dir.y*=.5; const d=dir.length(); T.position.addScaledVector(dir.normalize(),Math.min(14,d*.22)*dt); T.lookAt(PLAYER.pos.x,T.position.y,PLAYER.pos.z);
      if(dP<30){ SFX.suitHit(); shake(.5); PLAYER.vel.add(PLAYER.pos.clone().sub(head).normalize().multiplyScalar(22)); dmgFlash&&dmgFlash(); }
      if(d>260){ state='approach'; objective("Get the tardigrade's attention"); setMarker(()=>T.position.clone().add(V3(0,50,0)),'Tardigrade'); toast("It lost interest! It's going back to town!",'#ff8a6a'); warned++; }
      if(T.position.distanceTo(trap)<110){ break; } }
  }
  // it gets tangled in the lint and curls up
  PLAYER.lock(); setMarker(null); itemHints(null); objective(null);
  lookAtPoint(T.position.clone().add(V3(0,30,0)),.8);
  sfxAt(T.position,()=>SFX.squirm(),200); lv.tardWalk=1.3;
  await tweenVal(k=>{ T.position.lerp(trap.clone().add(V3(0,10,0)),k*.05); },2.5);
  lv.tardWalk=0; await tweenVal(k=>{ T.scale.set(42,42*(1-k*.4),42*(1-k*.3)); },1.8);
  say("It's stuck in the lint. It curls up and goes to sleep.",4); await wait(4.2);
  unlock('miteHero');
  // back in town: everybody cheers
  await fade(1,.6); PLAYER.pos.set(0,30,90); lookAtPoint(V3(0,0,0),0); lv.panic=false; lv.cheer=true; lv.larry.position.set(0,12,50); lv.larry.rotation.y=Math.PI;
  playMusic('larry',1); await fade(0,.6);
  for(let i=0;i<4;i++) later(i*.4,()=>SFX.cheer?SFX.cheer():SFX.ding2());
  say('The mites cheer!',3); await wait(2.4);
  lv.larry.userData.talking=true; await talk([{who:'Larry',voice:'Larry',text:"You did it! You're a hero!"}]); lv.larry.userData.talking=false;
  await wait(.6); lv.cheer=false;
  await talk([{who:'Jim',radio:true,text:"Hey! I found a way!"},{who:'Jim',radio:true,text:"When the shrink ray broke, a piece of its crystal broke off. It fell into the Tinyverse."},{who:'Jim',radio:true,text:"It glows purple, deep down. If you find that shard, I can reverse the ray. And make you big again."},{who:'You',text:"Deep down?"},{who:'Larry',voice:'Larry',text:"I'm coming with you."}]);
  await fade(1,.8); $('visor').classList.remove('show');
  startFromCheckpointInner('A8');
}

/* ================= THE DEEP ================= */
function makePhage(){
  const g=new THREE.Group(); const m=rimify(new THREE.MeshPhysicalMaterial({color:col(0xb8c8d8),roughness:.3,metalness:.4,clearcoat:1}),0xff6a8a,.8,2);
  g.add(mesh(new THREE.IcosahedronGeometry(3,0),m,0,6,0,false)); g.add(cyl(.6,.6,6,m,0,1,0,8,false)); g.add(cyl(1.4,1.4,.6,m,0,-2,0,6,false));
  const legs=[]; for(let i=0;i<6;i++){ const a=i/6*6.28; const l=new THREE.Group(); l.position.set(Math.cos(a)*1.2,-2,Math.sin(a)*1.2); l.rotation.y=-a; g.add(l); const s=cyl(.18,.18,4,m,1.6,-1.2,0,4,false); s.rotation.z=.9; l.add(s); legs.push(l); }
  g.userData={legs,ph:rand(0,6),vel:V3()}; return g;
}
function makeHydra(h=80){
  const g=new THREE.Group(); const m=rimify(new THREE.MeshPhysicalMaterial({color:col(0xa8d890),roughness:.35,transparent:true,opacity:.85,clearcoat:.6,emissive:col(0x1a3a0a)}),0xc8ff9a,.7,2);
  const pts=[]; for(let k=0;k<=6;k++) pts.push(V3(Math.sin(k*.8)*4,k/6*h,Math.cos(k*.6)*3));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),30,3.2,10),m));
  const head=new THREE.Group(); head.position.copy(pts[6]); g.add(head); head.add(mesh(new THREE.ConeGeometry(4,7,12),m,0,3,0,false));
  const tents=[]; for(let i=0;i<7;i++){ const root=new THREE.Group(); root.rotation.y=i/7*6.28; head.add(root); let par=root; const segs=[]; for(let k=0;k<8;k++){ const s=new THREE.Group(); s.position.set(k===0?3:0,k===0?4:5,0); par.add(s); s.add(cyl(.7-k*.06,.8-k*.06,5,m,0,2.5,0,6,false)); segs.push(s); par=s; } tents.push(segs); }
  g.userData={head,tents,ph:rand(0,6),h}; return g;
}
defineLevel('deep',{
  title:'the deep Tinyverse',
  env:{fly:true,swim:true,fx:{exposure:1.15,saturation:1.2,contrast:1.08,bloomStrength:.55,bloomThreshold:.95,aoRadius:3,aoStrength:.5,vignette:.55,temp:-.12,aberr:.004,grain:.05},music:'tiny',reverb:.7,amb:[['tiny',.12],['tinyHi',.01]],ambEvents:[['whale',9]],near:.1,far:4000,speed:5.5},
  async build(scene,lv){
    scene.background=col(0x06121c); lv.bg=tinyBackdrop(scene,0x0a4050,0x06121c,0x020408);
    lv.envMap=makeEnv({top:0x1a6070,horizon:0x08202c,bottom:0x020408,lights:[{x:0,y:40,z:0,w:30,h:30,c:0x9affff,k:2}]});
    lv.rig=makeRig(scene,{sun:1.2,sunColor:0xbff8ff,hemi:.6,sky:0x5ad8e8,ground:0x1a0a2a,dir:V3(.15,1,.25),span:300,dist:600,far:1500});
    scene.fog=new THREE.FogExp2(col(0x06121c),.004); lv.fogBase=.004;
    // a sediment floor that slopes down the whole way
    const fl=new THREE.PlaneGeometry(400,3000,40,200); fl.rotateX(-Math.PI/2); const fp=fl.attributes.position; for(let i=0;i<fp.count;i++){ const x=fp.getX(i), z=fp.getZ(i); fp.setY(i,lv.floorY?0:(-120+z*.02)+fbm2(x*.02,z*.02,3)*14+Math.abs(x)*.25); } fl.computeVertexNormals(); fl.translate(0,0,-1250);
    scene.add(mesh(fl,new THREE.MeshStandardMaterial({color:col(0x3a3448),roughness:.9}),0,0,0,false));
    lv.floorY=(x,z)=>-120+(z+1250)*.02+fbm2(x*.02,(z+1250)*.02,3)*14+Math.abs(x)*.25;
    addSolid(lv,null,'fn',{fn:(pos,vel,R)=>{ const fy=lv.floorY(pos.x,pos.z)+R+3; if(pos.y<fy){ pos.y=fy; if(vel&&vel.y<0) vel.y*=-.2; } }});
    // 1) the dark zone: dinoflagellates that light up blue when you swim by
    const N=1400, pos=new Float32Array(N*3), glow=new Float32Array(N);
    for(let i=0;i<N;i++){ pos[i*3]=rand(-150,150); pos[i*3+1]=rand(-130,100); pos[i*3+2]=rand(-950,-420); }
    const dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(pos,3)); dg.setAttribute('glow',new THREE.BufferAttribute(glow,1));
    const dm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{px:{value:1}},
      vertexShader:`attribute float glow; varying float vG; uniform float px; void main(){ vG=glow; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp((6.0+glow*30.0)*px*60.0/(-mv.z),1.5,64.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`varying float vG; void main(){ vec2 d=gl_PointCoord-0.5; float a=smoothstep(0.5,0.0,length(d)); gl_FragColor=vec4(vec3(0.2,0.6,1.0)*(0.35+vG*3.5)*a,a); }`});
    lv.dino=new THREE.Points(dg,dm); lv.dino.frustumCulled=false; scene.add(lv.dino); lv.dinoPos=pos; lv.dinoGlow=glow;
    // 2) the current: a river of fast water with sediment grains in it
    lv.grains=[]; const gm=new THREE.MeshStandardMaterial({color:col(0x8a7a6a),roughness:.8});
    for(let i=0;i<26;i++){ const r=rand(8,18); const g=mesh(new THREE.DodecahedronGeometry(r,0),gm,rand(-90,90),rand(-100,60),rand(-1400,-980)); g.rotation.set(rand(0,3),rand(0,3),0); scene.add(g); addSolid(lv,g,'sphere',{r:r*.92,onHit:()=>{ if(G.time-(lv.grainT||0)>.6){ lv.grainT=G.time; SFX.suitHit(); shake(.25); } }}); lv.grains.push({g,r}); }
    // 3) the hydra forest
    lv.hydras=[]; for(let i=0;i<16;i++){ const h=makeHydra(rand(70,120)); const x=rand(-110,110), z=-1450-i*30+rand(-10,10); h.position.set(x,-140+(z*.02+25),z); scene.add(h); lv.hydras.push(h); { const U=h.userData; addSolid(lv,h,'cyl',{r:3.8,h:U.h/2,cy:U.h/2}); addSolid(lv,U.head,'sphere',{r:5.5}); } }
    // 4) the virus swarm
    lv.phages=[]; for(let i=0;i<34;i++){ const p=makePhage(); p.scale.setScalar(2.2); p.position.set(rand(-120,120),rand(-100,80),rand(-2350,-1950)); p.userData.home=p.position.clone(); scene.add(p); lv.phages.push(p); }
    // 5) the shard
    const sh=new THREE.Group(); sh.position.set(0,-122,-2520); scene.add(sh); lv.shard=sh;
    const cm=new THREE.MeshPhysicalMaterial({color:col(0xc86aff),roughness:.05,metalness:.1,clearcoat:1,emissive:col(0x9a3aff),emissiveIntensity:1.8,transparent:true,opacity:.9});
    const c1=mesh(new THREE.OctahedronGeometry(8,0),cm,0,0,0,false); c1.scale.set(.7,2.2,.7); sh.add(c1); const c2=mesh(new THREE.OctahedronGeometry(4,0),cm,5,-6,2,false); c2.scale.set(.6,1.6,.6); c2.rotation.z=-.5; sh.add(c2);
    lv.shardLight=new THREE.PointLight(col(0xc86aff),4,260,1.6); sh.add(lv.shardLight);
    addSolid(lv,sh,'sphere',{r:9,cond:()=>!F_().shardTaken});
    // (a second, tiny piece of the crystal, hidden way up in the dark)
    const pc=new THREE.Group(); pc.position.set(141,97,-728); scene.add(pc); lv.piece=pc;
    const pm=new THREE.MeshPhysicalMaterial({color:col(0xc86aff),roughness:.05,clearcoat:1,emissive:col(0x9a3aff),emissiveIntensity:.5,transparent:true,opacity:.9}); const p1=mesh(new THREE.OctahedronGeometry(1.4,0),pm,0,0,0,false); p1.scale.set(.7,2,.7); pc.add(p1);
    const mound=mesh(new THREE.SphereGeometry(30,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:col(0x3a3448),roughness:.9}),0,-146,-2520,false); mound.scale.y=.4; scene.add(mound); addSolid(lv,mound,'sphere',{r:30});
    // Larry, riding a Paramecium
    lv.ride=makeSnack(); lv.ride.scale.setScalar(5.5); scene.add(lv.ride);
    solidAuto(lv,lv.ride,{k:.8,cond:()=>!F_().riding});
    lv.larry=makeDustMite(); lv.larry.scale.setScalar(6); lv.larry.position.set(0,1.2,0); lv.ride.add(lv.larry); lv.larry.scale.setScalar(6/5.5);
    { const l=new THREE.PointLight(col(0xbfe8ff),1.6,60,1.6); l.position.set(0,9,4); lv.ride.add(l); }
    // boost rings: swim through one and it shoots you forward
    lv.boosts=[]; const bm=rimify(new THREE.MeshPhysicalMaterial({color:col(0x6dffd8),emissive:col(0x2adfb0),emissiveIntensity:1.6,roughness:.2,transparent:true,opacity:.9}),0xb0fff0,1.5,2);
    for(let z=-90;z>-2400;z-=115){ if(z<-1440&&z>-1900&&(Math.round(z/115)%2)) continue; const x=Math.sin(z*.004)*45, y=-20+z*.03+Math.sin(z*.011)*18; const g=new THREE.Group(); g.position.set(x,y,z); scene.add(g);
      g.add(mesh(new THREE.TorusGeometry(12,.9,10,40),bm,0,0,0,false)); for(let i=0;i<3;i++){ const ch=mesh(new THREE.TorusGeometry(4,.5,6,3,Math.PI*.6),bm,0,0,-6-i*5,false); ch.rotation.z=Math.PI*.2; g.add(ch); } lv.boosts.push({g,cd:0}); }
    lv.snow=makeSnowFor(scene);
    lv.flyBounds=(p,v)=>{ const lim=[[-150,150],[-170,110],[-2600,80]]; ['x','y','z'].forEach((k,i)=>{ if(p[k]<lim[i][0]){ p[k]=lim[i][0]; v[k]=Math.abs(v[k])*.3; } if(p[k]>lim[i][1]){ p[k]=lim[i][1]; v[k]=-Math.abs(v[k])*.3; } }); };
    lv.col.bounds=null;
  },
  enter(){ this.scene.fog.density=this.fogBase; FX.sunWorld=null; },
  update(dt,t){
    const lv=this, P=PLAYER.pos, F=F_(); WIND.time.value=t;
    const z=P.z;
    // darker the deeper you go; the dark zone is almost black
    const dark=smooth(invLerp(-380,-500,z))*(1-smooth(invLerp(-900,-1000,z)))*.9+smooth(invLerp(-1000,-2400,z))*.55;
    lv.scene.fog.density=lv.fogBase*(1+dark*1.5); lv.rig.sun.intensity=1.2*(1-dark); lv.rig.hemi.intensity=.6*(1-dark*.85);
    // dinoflagellates
    const gp=lv.dinoPos, gg=lv.dinoGlow; for(let i=0;i<gg.length;i++){ const dx=gp[i*3]-P.x, dy=gp[i*3+1]-P.y, dzz=gp[i*3+2]-P.z; const d2=dx*dx+dy*dy+dzz*dzz; if(d2<45*45) gg[i]=1; else gg[i]=Math.max(0,gg[i]-dt*.6); }
    lv.dino.geometry.attributes.glow.needsUpdate=true; lv.dino.material.uniforms.px.value=renderer.domElement.height/720;
    // the current pushes you along
    if(z<-980&&z>-1420){ PLAYER.vel.z-=dt*26; PLAYER.vel.x+=Math.sin(t*.8+z*.01)*dt*10;
      if(Math.random()<dt*40) lv.glow.spawn(P.x+rand(-60,60),P.y+rand(-40,40),P.z+rand(20,80),0,0,-rand(60,90),rand(1,2),rand(.3,.7),.6,.9,1,.5,0,0,1);
      for(const g of lv.grains){ const d=g.g.position.distanceTo(P); if(d<g.r+3){ PLAYER.vel.add(P.clone().sub(g.g.position).normalize().multiplyScalar(20)); SFX.suitHit(); shake(.3); } } }
    for(const g of lv.grains) g.g.rotation.x+=dt*.2;
    // hydras sway; if you swim too close to a head, its tentacles grab you
    for(const h of lv.hydras){ const U=h.userData; U.tents.forEach((segs,i)=>segs.forEach((s,k)=>{ s.rotation.z=.25+Math.sin(t*1.2+U.ph+i+k*.5)*.25; s.rotation.x=Math.cos(t*.9+U.ph+i*2+k*.4)*.2; }));
      if(!F.grabbed&&F.deepOn){ const hp=U.head.getWorldPosition(new THREE.Vector3()); if(hp.distanceTo(P)<28&&(G.time-(F.grabT||0))>4){ runStory(()=>hydraGrab(h)); } } }
    // viruses chase you
    for(const p of lv.phages){ const U=p.userData; const d=p.position.distanceTo(P); let goal=U.home.clone().add(V3(Math.sin(t*.7+U.ph)*10,Math.sin(t*.9+U.ph)*8,0)); if(d<160&&F.deepOn) goal=P.clone();
      const v=goal.sub(p.position); const L=v.length(); if(L>.1) U.vel.lerp(v.multiplyScalar(Math.min(1,(d<160?9:3)/L)),Math.min(1,dt*1.5)); p.position.addScaledVector(U.vel,dt); p.lookAt(p.position.clone().sub(U.vel)); p.rotateX(Math.PI/2);
      U.legs.forEach((l,i)=>l.rotation.z=Math.sin(t*8+i)*.3);
      if(d<9&&F.deepOn){ PLAYER.vel.add(P.clone().sub(p.position).normalize().multiplyScalar(14)); U.vel.multiplyScalar(-1); if(G.time-(F.phT||0)>.8){ F.phT=G.time; SFX.suitHit(); shake(.3); } } }
    // the shard
    lv.shard.rotation.y+=dt*.6; lv.shard.position.y=-122+Math.sin(t)*3; if(!F.shardTaken) lv.shardLight.intensity=3.5+Math.sin(t*3)*.8;
    // Larry follows you on his Paramecium
    for(const b of lv.boosts){ b.g.rotation.z+=dt*1.5; if(b.cd>0){ b.cd-=dt; continue; } const l=b.g.worldToLocal(P.clone()); if(Math.abs(l.z)<5&&Math.hypot(l.x,l.y)<12.5){ b.cd=1.5; PLAYER.vel.z-=70; PLAYER.vel.y*=.3; PLAYER.fovKick=16; SFX.whoosh(1); SFX.ding2(); shake(.15); F.boosts=(F.boosts||0)+1; if(F.boosts>=15) unlock('speedy'); for(let i=0;i<30;i++) lv.glow.spawn(P.x+rand(-10,10),P.y+rand(-8,8),P.z-rand(0,20),0,0,rand(40,80),rand(.4,.8),rand(.3,.6),.4,1,.9,.8,0,0,1); } }
    const R=lv.ride;
    if(F.riding){ const z=R.position.z; const stop=z>-1400?-1410:z>-2380?null:-2492; const x=Math.sin(z*.004)*45, y=-20+z*.03+Math.sin(z*.011)*18;
      if(stop==null){ runStory(()=>rideOff("Hydras! Swim through, I'll go around and meet you on the other side!")); }
      else if(z<=stop){ if(stop===-1410) runStory(()=>rideOff("Hydras ahead! I can't fit through there. Swim through, I'll go around and meet you on the other side!"));
        else { // at the shard: he stops right next to it, you stay on, grab it from here
          if(!F.atShard){ F.atShard=true; bark('Larry',"There it is! Grab it!",null,3); } PLAYER.pos.copy(R.position).add(V3(0,24,34)); PLAYER.vel.set(0,0,0); R.userData.cil.rotation.z=Math.sin(t*6)*.04; animateDustMite(lv.larry,t,dt); } }
      else { R.position.z-=dt*48; R.position.x=damp(R.position.x,x,2,dt); R.position.y=damp(R.position.y,y,2,dt); R.rotation.set(0,Math.PI,0); PLAYER.pos.copy(R.position).add(V3(0,24,34)); PLAYER.vel.set(0,0,-48); if(Math.random()<dt*20) lv.glow.spawn(R.position.x+rand(-4,4),R.position.y,R.position.z+20,0,0,20,1,.4,1,.9,.4,.6,0,0,1); }
      R.userData.cil.rotation.z=Math.sin(t*20)*.08; animateDustMite(lv.larry,t,dt); }
    else if(R.visible){ const fw=new THREE.Vector3(); camera.getWorldDirection(fw); fw.y=0; if(fw.lengthSq()<1e-4) fw.set(0,0,-1); fw.normalize(); const rt=V3(-fw.z,0,fw.x);
      const around=P.z<-1405&&P.z>-2375&&!F.shardTaken;   // the hydra forest + virus cloud: Larry goes around, far out to the side
      let want; if(around){ const sd=R.position.x>=0?1:-1; want=V3(sd*170,P.y-8,Math.max(-2360,P.z+10)); if(!F.larryAround){ F.larryAround=true; } }
      else { want=P.clone().addScaledVector(fw,30).addScaledVector(rt,20).add(V3(0,-6,0)); if(F.larryAround&&P.z<=-2375){ F.larryAround=false; if(!F.larryBack){ F.larryBack=true; bark('Larry',"There you are! Hop on, it's right down there!",null,3.4); } } }  // swims beside you, a little ahead, where you can see him
      R.position.lerp(want,Math.min(1,dt*.9)); const dir=want.clone().sub(R.position); if(dir.lengthSq()>1) R.lookAt(R.position.clone().sub(dir)); R.userData.cil.rotation.z=Math.sin(t*14)*.05; animateDustMite(lv.larry,t,dt); }
    if(lv.snow) lv.snow.material.uniforms.px.value=renderer.domElement.height*.5;
  }
});
async function hydraGrab(h){
  const F=F_(); if(F.grabbed) return; F.grabbed=true; SFX.squirm(); shake(.4); PLAYER.vel.set(0,0,0);
  const hp=h.userData.head.getWorldPosition(new THREE.Vector3()); const hold=PLAYER.pos.clone().lerp(hp,.35);
  bark('Larry',"It grabbed you! Wiggle out!",null,2.6);
  F.wiggle=0; PLAYER.ctl.move=false; objective(IS_TOUCH?'Spam USE to break free!':'Spam E to break free!');
  while(F.wiggle<1){ PLAYER.pos.lerp(hold,.1); PLAYER.vel.set(0,0,0); F.wiggle=Math.max(0,F.wiggle-(G.dt||.016)*.15); spamHUD(true,F.wiggle,'BREAK FREE!'); await wait(0); }
  spamHUD(false); SFX.swimStroke(); PLAYER.vel.add(PLAYER.pos.clone().sub(hp).normalize().multiplyScalar(24));
  F.grabbed=false; F.grabT=G.time; PLAYER.ctl.move=true; deepObjective();
}
function rideOn(){ const F=F_(), lv=LEVELS.deep; F.riding=true; PLAYER.ctl.move=false; SFX.swimStroke(); SFX.whoosh(.6); bark('Larry','Hold on tight!',null,2); unlock('ride'); }
async function rideOff(line){ const F=F_(); if(!F.riding) return; F.riding=false; F.atShard=false; PLAYER.ctl.move=true; PLAYER.vel.set(0,0,-10); if(line) bark('Larry',line,null,4.2); }
function deepObjective(){ objective('Find the purple crystal shard, deep down'); }

/* ================= A8: THE DEEP ================= */
CHECKPOINTS.A8=async()=>{
  const lv=await enterLevel('deep',{pos:V3(0,0,40),yaw:0});
  setCheckpoint('A8'); const F=F_();
  PLAYER.fly=true; PLAYER.eye=0; PLAYER.scale=PLAYER.targetScale=1; PLAYER.item=null; setVM(true); setVMSuit(true);
  $('visor').classList.add('show'); $('scaleRead').textContent='1 : 10,000,000'; $('photoRead').textContent='PHOTOS: 5';
  PLAYER.lock(); crosshair(true); hudVisible(true); objective(null);
  lv.ride.visible=true; lv.ride.position.set(9,-2,16); lv.ride.rotation.set(0,-.5,0); if(lv.piece) lv.piece.children[0].visible=true;
  lookAtPoint(V3(9,2,16),0);
  await fade(0,1);
  await talk([{who:'Jim',radio:true,text:"The shard should be deep down. It glows purple."},{who:'Larry',voice:'Larry',text:"I'll ride my Paramecium. Stay close!"}]);
  if(!lv.setup){ lv.setup=true;
    addInteract(lv,{pos:V3(),label:'Break free!',cd:.06,reach:999,d3:false,aim:false,when:()=>!!F_().grabbed,act:()=>{ F_().wiggle=(F_().wiggle||0)+.12; SFX.squirm(); shake(.05); }});
    on('tick',()=>{ if(LV===lv){ const it=lv.inter[0]; it.pos=PLAYER.pos.clone(); } });
    addInteract(lv,{obj:lv.ride,label:()=>F_().riding?'Hop off':"Ride on Larry's Paramecium",reach:45,d3:true,aim:false,when:()=>F_().deepOn&&(F_().riding||PLAYER.pos.z>-1380||PLAYER.pos.z<-2385),act:()=>{ if(F_().riding) runStory(()=>rideOff(null)); else rideOn(); }});
    addInteract(lv,{obj:lv.piece,label:'Take it',reach:24,d3:true,when:()=>!F_().piece2&&lv.piece.children[0].visible,act:()=>{ F_().piece2=true; lv.piece.children[0].visible=false; SFX.pickup(); flashWhite(.3,.5); toast('Got: A TINY PURPLE PIECE','#c86aff'); }});
    addInteract(lv,{obj:lv.shard,label:'Take the shard',reach:90,d3:true,when:()=>!!F_().deepOn&&!F_().grabbed,act:()=>runStory(takeShard)});
    addTrigger(lv,{pos:V3(0,0,-440),r:1,box:[400,30],once:true,fn:()=>{ bark('Larry',"It's dark down here. Swim near the little guys, they light up!",null,3.6); unlock('deep'); }});
    addTrigger(lv,{pos:V3(0,0,-980),r:1,box:[400,30],once:true,fn:()=>bark('Larry',"Current! Hold on!",null,3)});
    addTrigger(lv,{pos:V3(0,0,-1420),r:1,box:[400,30],once:true,fn:()=>bark('Larry',"Hydras! Don't let the tentacles grab you!",null,3.4)});
    addTrigger(lv,{pos:V3(0,0,-1930),r:1,box:[400,30],once:true,fn:()=>{ bark('Larry',"Viruses! Swim for it!",null,3); SFX.suitAlarm(); }});
    addTrigger(lv,{pos:V3(0,0,-2380),r:1,box:[400,30],once:true,fn:()=>bark('Larry',"Whoa... look! Down there!",null,3)});
  }
  F.deepOn=true; deepObjective(); setMarker(()=>lv.shard.position,'Shard');
  itemHints([IS_TOUCH?'<kbd>⤒ ⤓</kbd> swim up / down':'<kbd>Space</kbd> / <kbd>C</kbd> swim up / down']);
  TOUCH_UI.show({down:true}); playMusic('hunt',2);
  PLAYER.free();
};
async function takeShard(){
  const lv=LEVELS.deep, F=F_(); if(!F.deepOn) return; F.deepOn=false; F.shardTaken=true; F.riding=false; PLAYER.lock(); setMarker(null); itemHints(null); objective(null);
  lookAtPoint(lv.shard.position,.8); await wait(.8);
  SFX.pickup(); flashWhite(.6,.8); for(const c of lv.shard.children) if(!c.isLight) c.visible=false; lv.shardLight.intensity=0;
  toast('Got: SHRINK-RAY CRYSTAL SHARD','#c86aff'); unlock('tinyEnd');
  // the shard in your hands, glowing
  const sh=new THREE.Group(); const m=new THREE.MeshPhysicalMaterial({color:col(0xc86aff),roughness:.05,clearcoat:1,emissive:col(0x9a3aff),emissiveIntensity:2,transparent:true,opacity:.9}); const c1=mesh(new THREE.OctahedronGeometry(.08,0),m,0,0,0,false); c1.scale.set(.7,2.2,.7); sh.add(c1); sh.userData.vmScale=3; vmCarry(sh); PLAYER.carry={shard:true};
  // everything down here lights up purple for a moment
  SFX.dreamSwell(); FX.bloomStrength=1.4; lv.shardLight.intensity=12; lv.shardLight.distance=900; lv.shard.position.copy(PLAYER.pos).add(V3(0,-5,-10));
  for(let i=0;i<8;i++) lv.glow.burst(PLAYER.pos.clone().add(V3(rand(-30,30),rand(-20,20),rand(-40,-10))),{color:pick([0xc86aff,0xff8aff,0x6dffd8]),count:30,speed:15,size:.8,life:2,grav:0});
  await wait(1.6); FX.bloomStrength=.55;
  if(F.piece2){ await talk([{who:'You',text:"I found it!"},{who:'Jim',radio:true,text:"You found it!"}]); return bigLarryEnding(); }
  await talk([{who:'You',text:"I found it!"},{who:'Jim',radio:true,text:"You found it!"},{who:'Larry',voice:'Larry',text:"We did it! Let's go home!"}]);
  // Larry's Paramecium takes you both home, fast
  await fade(1,.8); vmCarry(null); PLAYER.carry=null; lv.shardLight.intensity=0;
  const T=await enterLevel('mitetown',{pos:V3(0,40,160),yaw:0});
  T.tard.visible=false; T.nervous=false; T.panic=false; T.cheer=true; T.larry.position.set(-20,14,110); T.larry.rotation.y=Math.PI*.9;
  lookAtPoint(V3(0,0,0),0); playMusic('larry',1);
  await fade(0,.8);
  say('Back in Mite Town, everybody cheers. The shard glows in your hands.',4.4);
  for(let i=0;i<6;i++) later(i*.35,()=>SFX.ding2());
  for(let i=0;i<10;i++) T.glow.burst(V3(rand(-100,100),rand(20,60),rand(-120,60)),{color:pick([0xffe066,0xff7af0,0x6dffd8,0xc86aff]),count:40,speed:12,size:1,life:1.8,grav:4});
  await wait(4.6); T.cheer=false;
  await tinyGoHome();
}


