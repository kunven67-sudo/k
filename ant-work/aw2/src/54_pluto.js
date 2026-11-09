/* ================================================================
   MARS SHIFT PART 3 — PLUTO. Suits with jetpacks (practice flying
   through rings), the nuke, three years later (Jeff!), and "Ready?"
   Plus the rocket cabin (used here and at the very end).
   ================================================================ */
defineLevel('cabin',{
  title:"Jim's rocket",
  env:{fx:{exposure:1.05,saturation:1.05,contrast:1.08,bloomStrength:.35,bloomThreshold:1.1,vignette:.45,aoRadius:.4},music:null,reverb:.3,amb:[['spaceDrone',.03],['labHum',.02]],surface:'metal',far:80},
  async build(scene,lv){
    scene.background=col(0x05060a);
    lv.envMap=makeEnv({top:0xd8dce8,horizon:0x8a909a,bottom:0x2a2c30,lights:[{x:0,y:10,z:0,w:8,h:8,c:0xffffff,k:3}]});
    makeRig(scene,{sun:.4,hemi:.6,sky:0xd8e0f0,ground:0x3a3c40,dir:V3(.2,1,.3),span:6,dist:12,far:30});
    const R=3.2, H=3;
    // padded white wall panels with seams and rivets
    const panT=texSet('cabinWall',512,(x,w,h)=>{ x.fillStyle='#d8dce2'; x.fillRect(0,0,w,h); for(let j=0;j<4;j++) for(let i=0;i<4;i++){ const px=i*128, py=j*128; const g=x.createLinearGradient(px,py,px,py+128); g.addColorStop(0,'#e6e9ee'); g.addColorStop(1,'#c8ccd4'); x.fillStyle=g; x.fillRect(px+5,py+5,118,118); x.strokeStyle='#9aa0aa'; x.lineWidth=3; x.strokeRect(px+5,py+5,118,118); x.fillStyle='#8a909a'; for(const [a,b] of [[14,14],[114,14],[14,114],[114,114]]){ x.beginPath(); x.arc(px+a,py+b,3.5,0,7); x.fill(); } } },{strength:2.2});
    const pw=repeatSet(panT,6,1.5);
    const wallM=new THREE.MeshStandardMaterial({map:pw.map,normalMap:pw.normalMap,roughness:.55,metalness:.15,side:THREE.BackSide});
    scene.add(mesh(new THREE.CylinderGeometry(R,R,H,48,1,true),wallM,0,H/2,0,false));
    const fl=mesh(new THREE.CircleGeometry(R,48),new THREE.MeshStandardMaterial({map:repeatSet(shipTex().floor,2,2).map,normalMap:repeatSet(shipTex().floor,2,2).normalMap,roughness:.5,metalness:.6,color:col(0x9aa2aa)}),0,0,0,false); fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; scene.add(fl);
    const ce=mesh(new THREE.CircleGeometry(R,48),mat(0xc8ccd2,{roughness:.6}),0,H,0,false); ce.rotation.x=Math.PI/2; scene.add(ce);
    const ribM=mat(0x8a9098,{metalness:.7,roughness:.35}), redM=mat(0xc8281c,{roughness:.45});
    for(const y of [.05,H-.05]){ const r=mesh(new THREE.TorusGeometry(R-.02,.05,8,64),redM,0,y,0,false); r.rotation.x=Math.PI/2; scene.add(r); }
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; const rib=box(.08,H,.08,ribM,Math.cos(a)*(R-.05),H/2,Math.sin(a)*(R-.05)); rib.rotation.y=-a; scene.add(rib); }
    // a ladder up to the nose hatch, cable bundles, ceiling lights
    for(const sd of [-1,1]) scene.add(cyl(.025,.025,H,ribM,sd*.22,H/2,R-.35,8));
    for(let y=.3;y<H;y+=.32) scene.add(box(.46,.03,.03,ribM,0,y,R-.35));
    scene.add(cyl(.45,.45,.06,mat(0x2a2c30,{metalness:.8}),0,H-.02,R-.55,24));
    for(let i=0;i<5;i++){ const c=cyl(.025,.025,H,mat(pick([0x2a2a2a,0xc8281c,0x2a5ad8,0xd8b02a]),{roughness:.6}),-1.5+i*.06,H/2,-R+.12,6,false); scene.add(c); }
    lv.lamps=[]; for(const [x,z] of [[-1,0],[1,0],[0,1.4]]){ scene.add(box(.7,.04,.2,emissiveMat(0xfff4e0,3),x,H-.03,z,false)); }
    const pl=new THREE.PointLight(col(0xfff0dc),2.2,12,2); pl.position.set(0,2.6,0); scene.add(pl);
    const pl2=new THREE.PointLight(col(0x8ab8ff),.8,6,2); pl2.position.set(2,1.6,-1.6); scene.add(pl2);
    // portholes (the front one shows where you are)
    lv.viewC=document.createElement('canvas'); lv.viewC.width=256; lv.viewC.height=256; lv.viewTex=new THREE.CanvasTexture(lv.viewC); lv.viewTex.encoding=THREE.sRGBEncoding;
    const glassM=new THREE.MeshPhysicalMaterial({color:col(0x9ab8d8),roughness:.05,transparent:true,opacity:.18,clearcoat:1});
    for(const a of [0,Math.PI*.62,-Math.PI*.62]){ const hold=new THREE.Group(); hold.rotation.y=a; scene.add(hold);
      const port=mesh(new THREE.CircleGeometry(.5,40),new THREE.MeshBasicMaterial({map:lv.viewTex}),0,1.6,-R+.05,false); port.material.color.setScalar(1.3); hold.add(port);
      hold.add(mesh(new THREE.CircleGeometry(.5,40),glassM,0,1.6,-R+.07,false)); hold.add(mesh(new THREE.TorusGeometry(.53,.07,10,40),mat(0x2a2c30,{metalness:.9,roughness:.3}),0,1.6,-R+.06,false));
      for(let k=0;k<8;k++){ const b=k/8*Math.PI*2; hold.add(sph(.02,ribM,Math.cos(b)*.62,1.6+Math.sin(b)*.62,-R+.07,6,4,false)); } }
    // seats, a console, two bunks
    for(const a of [-.9,0,.9]){ const s=new THREE.Group(); s.position.set(Math.sin(a)*2.2,0,-Math.cos(a)*2.2+1.2); s.rotation.y=-a; scene.add(s); s.add(box(.6,.5,.6,mat(0x3a3e44),0,.25,0)); s.add(rbox(.6,.12,.6,.04,mat(0x2a2c30,{roughness:.8}),0,.56,0)); s.add(rbox(.6,.9,.12,.05,redM,0,.95,.3)); for(const sd of [-1,1]) s.add(box(.05,.6,.02,mat(0x1a1a1a),sd*.2,.95,.24)); (lv.scene_solids=lv.scene_solids||[]).push({obj:s,o:{pad:.03}}); }
    const blanketM=[new THREE.MeshStandardMaterial({color:col(0x3a5a8a),roughness:.95}),new THREE.MeshStandardMaterial({color:col(0x6a8a3a),roughness:.95})];
    const mkCot=(x,z,ry,i)=>{ const cot=new THREE.Group(); cot.position.set(x,0,z); cot.rotation.y=ry; scene.add(cot); (lv.scene_solids=lv.scene_solids||[]).push({obj:cot,o:{pad:.03,cond:()=>PLAYER.ctl.move}});
      cot.add(box(.9,.3,2,mat(0x5a6068,{metalness:.5}),0,.15,0)); cot.add(rbox(.86,.12,1.94,.05,mat(0xe8e2d4,{roughness:.95}),0,.36,0)); cot.add(rbox(.5,.1,.3,.05,mat(0xf4f0e8,{roughness:.95}),0,.46,-.75)); cot.add(rbox(.88,.06,1.2,.03,blanketM[i],0,.44,.35)); return cot; };
    lv.cot=mkCot(-1.8,1.4,.9,0); lv.cot2=mkCot(1.95,1.2,-.9,1);
    const con=new THREE.Group(); con.position.set(2.2,0,-1.2); con.rotation.y=-.9; scene.add(con); (lv.scene_solids=lv.scene_solids||[]).push({obj:con,o:{pad:.03}});
    con.add(rbox(1.3,.95,.6,.06,mat(0x4a5058,{metalness:.6,roughness:.4}),0,.48,0)); const tilt=box(1.2,.05,.5,mat(0x2a2e34,{metalness:.5}),0,.98,.02); tilt.rotation.x=.4; con.add(tilt);
    lv.scrC=document.createElement('canvas'); lv.scrC.width=256; lv.scrC.height=128; lv.scrTex=new THREE.CanvasTexture(lv.scrC); lv.scrTex.encoding=THREE.sRGBEncoding;
    const scr=mesh(new THREE.PlaneGeometry(1.1,.5),new THREE.MeshBasicMaterial({map:lv.scrTex,toneMapped:false}),0,1.42,-.24,false); scr.rotation.x=-.15; con.add(scr); con.add(box(1.16,.56,.04,mat(0x1a1c20),0,1.42,-.27));
    lv.leds=[]; for(let i=0;i<10;i++){ const l=sph(.018,emissiveMat(pick([0x39ff6a,0xffcc33,0xff3a3a,0x5ab8ff]),2.5),-.5+i*.11,1.02,.12,6,4,false); con.add(l); lv.leds.push(l); }
    lv.jim=makeBlockJim(); lv.jim.userData.level='cabin'; scene.add(lv.jim);
    lv.bob=makeBlockPerson({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0xe8872a,pants:0x3a3a4a,hair:0x3a2414,beard:true}); lv.bob.userData.level='cabin'; scene.add(lv.bob);
    lv.suits=[]; for(let i=0;i<3;i++){ const s=new THREE.Group(); s.position.set(1.4-i*.7,0,2.4); scene.add(s); (lv.scene_solids=lv.scene_solids||[]).push({obj:s,o:{circle:true,cond:()=>s.visible}}); s.add(box(.5,.8,.25,mat(0xf0f0ec,{roughness:.5}),0,1.2,0)); s.add(sph(.2,new THREE.MeshPhysicalMaterial({color:col(0xffd070),roughness:.05,metalness:.3,clearcoat:1}),0,1.8,0)); s.add(box(.35,.5,.2,mat(0x5a6068),0,1.2,.22)); lv.suits.push(s); }
    for(const o of lv.scene_solids||[]) colFromObj(lv.col,o.obj,o.o);
    lv.col.radius=R-.15;
    lv.setView('space');
  },
  setView(k){ const lv=this, x=lv.viewC.getContext('2d'); x.fillStyle='#000'; x.fillRect(0,0,256,256);
    for(let i=0;i<120;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()})`; x.fillRect(Math.random()*256,Math.random()*256,1.5,1.5); }
    if(k==='pluto'){ const g=x.createRadialGradient(140,300,40,140,300,240); g.addColorStop(0,'#f0e4d0'); g.addColorStop(.6,'#c8a888'); g.addColorStop(1,'#6a4a3a'); x.fillStyle=g; x.beginPath(); x.arc(140,330,220,0,7); x.fill(); x.fillStyle='#8a4a32'; x.beginPath(); x.ellipse(90,170,50,20,.3,0,7); x.fill(); }
    if(k==='earth'){ x.fillStyle='#2a5ad8'; x.fillRect(40,120,180,140); x.fillStyle='#4a9a3a'; for(let i=0;i<14;i++) x.fillRect(40+(Math.random()*9|0)*20,120+(Math.random()*7|0)*20,20,20); }
    lv.viewTex.needsUpdate=true; },
  enter(){ FX.sunWorld=null; },
  update(dt,t){ updateFolk(dt,t); const lv=this; lv.leds.forEach((l,i)=>l.visible=Math.sin(t*(1.3+i*.37)+i)>-.3);
    lv.scrT=(lv.scrT||0)+dt; if(lv.scrT>.15){ lv.scrT=0; const x=lv.scrC.getContext('2d'); x.fillStyle='#04120a'; x.fillRect(0,0,256,128); x.strokeStyle='#39ff6a'; x.lineWidth=2; x.beginPath(); for(let i=0;i<=64;i++){ const yy=64+Math.sin(i*.3+t*3)*20*Math.sin(t*.7+i*.05); i?x.lineTo(i*4,yy):x.moveTo(0,yy); } x.stroke(); x.fillStyle='#39ff6a'; x.font='bold 14px monospace'; x.fillText('FUEL 62%   O2 OK   HULL OK',8,18); lv.scrTex.needsUpdate=true; } }
});

function plutoHeight(x,z){ let h=fbm2(x*.012,z*.012,4)*6+fbm2(x*.05,z*.05,3)*1.2; const d=Math.hypot(x,z); h*=smooth(invLerp(30,90,d)); h+=smooth(invLerp(150,260,d))*40*(.5+fbm2(x*.01+5,z*.01,3)); return h; }
defineLevel('pluto',{
  title:'Pluto',
  env:{fx:{exposure:1.15,saturation:1.0,contrast:1.1,bloomStrength:.35,bloomThreshold:1.1,vignette:.45,temp:-.06,aoRadius:.6},music:'pluto',reverb:.05,amb:[['spaceDrone',.05],['moonHum',.03]],surface:'moon',far:3000,gravity:3.2,speed:3.6},
  async build(scene,lv){
    scene.background=col(0x000000);
    scene.add(makeStars(dq(3000,5000,8000,10000,14000),2000,{band:true,k:1.8,seed:88}));
    const sunDir=V3(.6,.35,-.6).normalize();
    lv.envMap=makeEnv({top:0x0a0c14,horizon:0x2a2a34,bottom:0x3a342e,lights:[{x:sunDir.x*40,y:sunDir.y*40,z:sunDir.z*40,w:3,h:3,c:0xffffff,k:8}]});
    makeRig(scene,{sun:2.2,sunColor:0xfff0e0,hemi:.35,sky:0x8a90a8,ground:0x5a4a40,dir:sunDir,span:40,dist:90,far:200});
    scene.add(mesh(new THREE.SphereGeometry(6,16,12),basicGlow(0xffffff,20),sunDir.x*2000,sunDir.y*2000,sunDir.z*2000,false));
    // Charon, big in the sky
    const ch=mesh(new THREE.SphereGeometry(180,48,32),new THREE.MeshStandardMaterial({map:canvasTex(512,256,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const k=.55+n*.5; return [150*k,145*k,140*k]; },6,5); x.fillStyle='rgba(120,50,40,.5)'; x.beginPath(); x.ellipse(w*.5,12,w*.3,24,0,0,7); x.fill(); }),roughness:1}),-900,700,-1600,false); scene.add(ch);
    // ground: cream nitrogen ice, reddish-brown patches, icy mountains far away
    const S=dq(120,150,200,240,280);
    const tg=new THREE.PlaneGeometry(700,700,S,S); tg.rotateX(-Math.PI/2); const tp=tg.attributes.position; const cc=new Float32Array(tp.count*3);
    for(let i=0;i<tp.count;i++){ const x=tp.getX(i), z=tp.getZ(i); const h=plutoHeight(x,z); tp.setY(i,h); const red=smooth(invLerp(.1,.45,fbm2(x*.008+20,z*.008,3))); const ice=smooth(invLerp(8,25,h));
      const c=new THREE.Color(0xe8dcc8).lerp(new THREE.Color(0x8a4a32),red*.8).lerp(new THREE.Color(0xa8b4c8),ice); cc[i*3]=c.r; cc[i*3+1]=c.g; cc[i*3+2]=c.b; }
    tg.setAttribute('color',new THREE.BufferAttribute(cc,3)); tg.computeVertexNormals();
    const cellT=canvasTex(512,512,(x,w,h)=>{ x.fillStyle='#d8d8d8'; x.fillRect(0,0,w,h); noiseFill(x,w,h,n=>{ const k=.8+n*.25; return [230*k,230*k,230*k]; },10,4); x.strokeStyle='rgba(90,80,70,.35)'; x.lineWidth=3; for(let i=0;i<30;i++){ x.beginPath(); let px=rand(0,w), py=rand(0,h); x.moveTo(px,py); for(let k=0;k<5;k++){ px+=rand(-60,60); py+=rand(-60,60); x.lineTo(px,py); } x.stroke(); } },[40,40]);
    scene.add(mesh(tg,new THREE.MeshStandardMaterial({map:cellT,vertexColors:true,roughness:.85}),0,0,0,false)); scene.children[scene.children.length-1].receiveShadow=true;
    lv.hf=heightField(700,S,plutoHeight); lv.ground=(x,z)=>lv.hf.at(x,z);
    // ice boulders
    const bm=new THREE.MeshStandardMaterial({color:col(0xc8d4e0),roughness:.3,metalness:.1});
    for(let i=0;i<60;i++){ const x=rand(-120,120), z=rand(-120,120); if(Math.hypot(x,z)<14) continue; const r=rand(.4,2.2); const b=mesh(new THREE.IcosahedronGeometry(r,1),bm,x,lv.ground(x,z)+r*.3,z); b.scale.y=rand(.5,.9); scene.add(b); if(r>.45) colCircle(lv.col,x,z,r*.85); }
    // Jim's rocket, landed
    lv.rocket=makeRocket(); lv.rocket.position.set(0,lv.ground(0,-6)+1.1,-6); scene.add(lv.rocket); colCircle(lv.col,0,-6,1.6);
    // the humans (and Jeff) out here
    lv.jim=makeBlockJim(true); lv.jim.userData.level='pluto'; scene.add(lv.jim);
    const helm=()=>mesh(new THREE.SphereGeometry(.2,24,16),new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:0,transparent:true,opacity:.18,clearcoat:1,depthWrite:false}),0,.06,.02,false);
    lv.helm=helm; { const hb=helm(); hb.scale.setScalar(1.7); hb.position.set(0,.22,0); lv.jim.userData.head.add(hb); }
    lv.bob=makeBlockPerson({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0xf0f0ec,pants:0xf0f0ec,hair:0x3a2414,beard:true}); lv.bob.userData.level='pluto'; scene.add(lv.bob);
    { const hb=lv.helm(); hb.scale.setScalar(1.7); hb.position.set(0,.22,0); lv.bob.userData.head.add(hb); }
    lv.jeff=makeDog(); lv.jeff.userData.level='pluto'; scene.add(lv.jeff);
    const bub=mesh(new THREE.SphereGeometry(.26,24,16),new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:0,transparent:true,opacity:.22,clearcoat:1,depthWrite:false}),0,0,0,false); lv.jeff.userData.headJ.add(bub); lv.jeff.visible=false;
    // practice rings
    lv.rings=[]; const rp=[[8,4,-18],[16,8,-30],[6,12,-44],[-8,9,-38],[-16,6,-24],[-10,4,-12]];
    rp.forEach(([x,y,z],i)=>{ const g=new THREE.Group(); g.position.set(x,lv.ground(x,z)+y,z); scene.add(g); const r=mesh(new THREE.TorusGeometry(1.8,.14,10,40),emissiveMat(0xffcc33,2.2),0,0,0,false); g.add(r); const n=rp[(i+1)%rp.length]; g.lookAt(n[0],lv.ground(n[0],n[2])+n[1],n[2]); g.visible=false; lv.rings.push({g,r,done:false}); });
    // the little base you live in for three years
    const base=new THREE.Group(); base.position.set(-14,lv.ground(-14,4),4); scene.add(base); lv.base=base;
    base.add(mesh(new THREE.SphereGeometry(4,32,16,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:col(0xf0f0ec),roughness:.4}),0,0,0)); base.add(mesh(new THREE.TorusGeometry(4,.12,8,48),mat(0xc8281c),0,.1,0,false)).children; base.children[1].rotation.x=Math.PI/2;
    for(let i=0;i<5;i++){ const a=i/5*6.28; base.add(sph(.2,emissiveMat(0xffd070,2),Math.cos(a)*3.5,1.8,Math.sin(a)*3.5,8,6,false)); }
    base.visible=false; lv.baseCol=colCircle(lv.col,-14,4,4.2,()=>lv.base.visible);
    lv.nuke=new THREE.Group(); lv.nuke.add(cyl(.18,.18,.6,mat(0x3a4a3a,{metalness:.6}),0,0,0,16)); lv.nuke.add(mesh(new THREE.ConeGeometry(.18,.25,16),mat(0xd8c020),0,.42,0)); lv.nuke.add(box(.2,.1,.02,emissiveMat(0xff3a3a,2),0,0,.18,false)); lv.nuke.visible=false; scene.add(lv.nuke);
    lv.col.bounds=[-150,150,-150,150];
    lv.fuel=1; lv.jetT=0;
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){
    const lv=this, P=PLAYER;
    updateFolk(dt,t);
    if(lv.jeff.visible){ animateDog(lv.jeff,dt,t); lv.jeff.position.y=lv.ground(lv.jeff.position.x,lv.jeff.position.z); }
    for(const h of [lv.jim]) if(h.visible) h.position.y=lv.ground(h.position.x,h.position.z);
    if(lv.bob.visible) lv.bob.position.y=lv.ground(lv.bob.position.x,lv.bob.position.z);
    for(const r of lv.rings){ r.r.material.emissiveIntensity=r.done?.4:2+Math.sin(t*5)*.6; }
    // the jetpack: hold jump to fly; the fuel refills when you land
    if(lv.jetOn){
      const canMove=P.ctl.move&&G.mode==='play'&&!CAM.active&&!DLG.active;
      const up=canMove&&(keys.Space||TOUCH.up);
      if(up&&lv.fuel>0){ P.onGround=false; P.vy=Math.min(P.vy+15*dt,6); lv.fuel=Math.max(0,lv.fuel-dt*.28); lv.jetT-=dt; if(lv.jetT<=0){ lv.jetT=.12; SFX.jet(); }
        const p=camera.position; lv.glow.spawn(p.x+rand(-.2,.2),p.y-1.3,p.z+rand(-.2,.2),rand(-.3,.3),-rand(3,5),rand(-.3,.3),rand(.3,.6),rand(.15,.3),1,.6,.2,.9,0,0,1); }
      if(P.onGround) lv.fuel=Math.min(1,lv.fuel+dt*.6); else { if(lv.fuel<=0&&up) unlock('emptyTank'); if(P.y>40) unlock('skyHigh'); }
      if(!P.onGround){ const fw=V3(-Math.sin(P.yaw),0,-Math.cos(P.yaw)); P.vel.x+=fw.x*P.inMag*dt*3; P.vel.z+=fw.z*P.inMag*dt*3; }
      jetHUD(true,lv.fuel);
      // rings
      if(lv.ringsOn){ const cp=camera.position; for(const r of lv.rings){ if(r.done||!r.g.visible) continue; const l=r.g.worldToLocal(cp.clone()); if(Math.abs(l.z)<1.2&&Math.hypot(l.x,l.y)<1.9){ r.done=true; SFX.ding2(); toast('Ring '+lv.rings.filter(q=>q.done).length+' / '+lv.rings.length,'#ffcc33'); } }
        const left=lv.rings.filter(q=>!q.done).length; if(left!==lv.ringsLeft){ lv.ringsLeft=left; objective(left?'Fly through the rings <b>'+(lv.rings.length-left)+'/'+lv.rings.length+'</b>':'Go back to Jim'); } }
    } else jetHUD(false);
  }
});

/* ================= B11: PLUTO ================= */
CHECKPOINTS.B11=async()=>{
  const lv=await enterLevel('cabin',{pos:V3(0,0,1.2),yaw:Math.PI});
  setCheckpoint('B11'); const F=F_(); F.day=3;
  PLAYER.lock(); crosshair(true); setVM(true); setVMBlocky(true); setVMSuit(false); PLAYER.hasWatch=true; PLAYER.stitched=true; PLAYER.eye=1.64;
  hudVisible(true); showCash(false); showCoins(false); objective(null);
  lv.setView('pluto'); for(const s of lv.suits) s.visible=true;
  const jim=lv.jim, bob=lv.bob; jim.visible=true; jim.position.set(.25,0,-.55); jim.rotation.y=0; jim.userData.A.look='player'; setMood(jim,'neutral');
  bob.visible=true; bob.position.set(-1.1,0,.6); bob.rotation.y=Math.PI*.6; bob.userData.A.look='player';
  lookAtPoint(V3(.25,1.45,-.55),0);
  playMusic('pluto',2); await fade(0,1);
  say('You land on Pluto.',2.8); await wait(2.6);
  const J={h:jim,who:'Jim'};
  await talk([{...J,text:"Okay. Suits on. They make you stronger, and a lot harder to hurt.",pose:'point'},{...J,text:"They've got jetpacks too. Watch your fuel. It runs out.",pose:'talk'}]);
  clearPose(jim);
  // suit up
  await fade(1,.5); SFX.suitOn(); for(const s of lv.suits) s.visible=false; setVMSuit(true); await wait(1); SFX.helmetSeal&&SFX.helmetSeal();
  
  // outside
  const pl=await enterLevel('pluto',{pos:V3(4.5,0,-1),yaw:Math.PI*.85});
  pl.jim.visible=true; pl.jim.position.set(-2.6,0,1.8); pl.jim.userData.A.look='player'; pl.bob.visible=true; pl.bob.position.set(-3,0,1); pl.bob.userData.A.look='player'; pl.base.visible=false; pl.jeff.visible=false;
  for(const r of pl.rings){ r.done=false; r.g.visible=true; } pl.ringsLeft=-1; pl.fuel=1; pl.jetOn=true; pl.ringsOn=true;
  lookAtPoint(pl.rings[0].g.position,0);
  setMarker(()=>{ const r=pl.rings.find(q=>!q.done); return r?r.g.position:null; },'Ring','m');
  playMusic('fly',1.5); await fade(0,.8);
  itemHints([IS_TOUCH?'Hold <kbd>⤒</kbd> to fly':'Hold <kbd>Space</kbd> to fly','Land to refuel']);
  TOUCH_UI.show({jump:true});
  bark('Jim','Practice! Fly through the rings!',pl.jim,3.2,true);
  PLAYER.free();
  await waitUntil(()=>pl.rings.every(r=>r.done));
  unlock('rings'); itemHints(null); for(const r of pl.rings) r.g.visible=false;
  setMarker(()=>pl.jim.position.clone().add(V3(0,2.2,0)),'Jim','m');
  await waitUntil(()=>PLAYER.onGround&&Math.hypot(PLAYER.pos.x-pl.jim.position.x,PLAYER.pos.z-pl.jim.position.z)<3.4);
  setMarker(null); PLAYER.lock(); objective(null); pl.jetOn=false; jetHUD(false);
  lookAtPoint(pl.jim.position.clone().add(V3(0,1.6,0)),.6);
  pl.nuke.visible=true; pl.nuke.scale.setScalar(.45); holdProp(pl.jim,pl.nuke,'R',V3(0,-.1,.1));
  await talk([{h:pl.jim,who:'Jim',text:"This is a nuke. It has to go inside XXX5.",pose:'holdOut'},{h:pl.jim,who:'Jim',text:"All the way inside. It's the only way."},{who:'You',text:"...Okay."}]);
  clearPose(pl.jim); pl.nuke.visible=false;
  // three years later
  await tweenVal(k=>{ FX.blackout=k; },1.2); playMusic(null,1.5);
  cardShow('3 YEARS LATER','Pluto'); await wait(3); cardHide();
  pl.base.visible=true; PLAYER.pos.set(-9,0,9); PLAYER.yaw=-.6; lookAtPoint(V3(-14,1,4),0);
  pl.jim.position.set(-11,0,1); pl.bob.position.set(-10.5,0,5.5);
  const jeff=pl.jeff; jeff.visible=true; jeff.position.set(-16,0,8); jeff.userData.happy=true;
  playMusic('pluto',2);
  await tweenVal(k=>{ FX.blackout=1-k; },1.2);
  say('You have a dog now. His name is Jeff.',3.6);
  await tweenVal(k=>{ jeff.position.set(lerp(-16,-9.6,k),0,lerp(8,8.2,k)); jeff.rotation.y=Math.PI/2; },2.2);
  SFX.bark(); await wait(1);
  if(!pl.petSetup){ pl.petSetup=true; addInteract(pl,{obj:jeff,offset:V3(0,.6,0),label:'Pet Jeff',reach:2.4,when:()=>!!F_().canPet,act:()=>{ SFX.bark(); unlock('jeff'); if(trophyStat('pets')>=10) unlock('goodBoy'); jeff.userData.happy=true; VM.slapT=.5; bark('You','Good boy, Jeff.',null,2); F_().petted=true; }}); }
  F.canPet=true; objective('Pet Jeff'); PLAYER.free();
  await waitUntil(()=>F_().petted,25); await wait(4); F.canPet=false; objective(null); PLAYER.lock(); await wait(1.5);
  // back on Earth...
  await fade(1,.8);
  const E=await enterLevel('blockearth',{pos:V3(0,0,30),yaw:0});
  E.setBurning(true); E.rocket.visible=false; E.jim.visible=false; E.bob.visible=false; E.ship.visible=false; E.xFly.visible=false;
  for(const f of E.folk){ f.visible=true; f.userData.lifted=false; f.userData.A.mode='panic'; f.rotation.z=0; }
  playMusic('burning',1); setAmbience([['crowd',.05],['wind',.04]]); letterbox(true);
  camFollow(t=>({pos:V3(-30+t*1.5,6,26),look:V3(-10+t,5,-6)}),50);
  await fade(0,1);
  say('Back on Earth, houses are on fire.',3.4); await wait(3.6);
  camFollow(t=>({pos:V3(10,3,24-t*.4),look:V3(6,30,-60)}),46);
  say('People are getting eaten by XXX5.',3.4);
  for(let i=0;i<3;i++){ liftPerson(E,E.folk[i],4.5); await wait(.6); }
  await wait(2.2);
  say("XXX5 has a purple light now that can lift you into its mouth. And it's bigger.",4.8); await wait(4.4);
  await fade(1,.8); camRelease(0); letterbox(false);
  // Pluto: ready?
  await enterLevel('pluto',{pos:V3(-8,0,8),yaw:-.6});
   setAmbience([['spaceDrone',.05]]); playMusic('pluto',1);
  pl.jim.position.set(-8.5,0,5.6); pl.bob.position.set(-10.5,0,7); jeff.position.set(-9,0,9.4);
  lookAtPoint(pl.jim.position.clone().add(V3(0,1.6,0)),0);
  await fade(0,.8);
  await talk([{h:pl.jim,who:'Jim',text:"Ready?"},{who:'You',text:"Yes."},{h:pl.bob,who:'Bob',text:"Yes."},{h:jeff,who:'Jeff',text:"Bark!"}]);
  await wait(.4);
  await fade(1,.8);
  startFromCheckpointInner('B12');
};

