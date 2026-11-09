/* ================================================================
   YOUR ALIEN HOUSE (Path B) — "pretty big on the inside, but not that
   big. Like your old house. But alien." Table, bed, ceiling, floor,
   walls, and an alien computer.
   ================================================================ */
defineLevel('alienhouse',{
  title:'your new house',
  env:{fx:{exposure:1.05,saturation:1.12,contrast:1.06,bloomStrength:.3,bloomThreshold:1.2,aoRadius:.45,vignette:.4,temp:-.05},music:'alienHome',reverb:.25,amb:[['alienHome',.02]],ambEvents:[['alienHum',6]],surface:'tile',far:200},
  async build(scene,lv){
    scene.background=col(0x0a0612);
    lv.envMap=makeEnv({top:0x3a2a5a,horizon:0x2a1a3a,bottom:0x100818,lights:[{x:0,y:20,z:0,w:20,h:20,c:0xb08aff,k:2},{x:20,y:5,z:0,w:6,h:6,c:0x6dffd8,k:1.5}]});
    const rig=makeRig(scene,{sun:.8,sunColor:0xffd0b0,hemi:.62,sky:0x9a7aff,ground:0x2a1a3a,dir:V3(.6,.5,.3),span:8,dist:20,far:40});
    const R=6.5;
    // hex-tile floor with glowing seams
    const hexT=texSet('alienFloor',512,(x,w,h)=>{ x.fillStyle='#1a1026'; x.fillRect(0,0,w,h); const r=40; for(let j=-1;j<h/(r*1.5)+1;j++) for(let i=-1;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,'#4a3068'); g.addColorStop(1,'#2a1a40'); x.fillStyle=g; x.beginPath(); for(let q=0;q<6;q++){ const a=q/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.92,cy+Math.sin(a)*r*.92); } x.fill(); } },{strength:2.5});
    const seamT=canvasTex(512,512,(x,w,h)=>{ x.fillStyle='#000'; x.fillRect(0,0,w,h); const r=40; x.strokeStyle='#6dffd8'; x.lineWidth=3; for(let j=-1;j<h/(r*1.5)+1;j++) for(let i=-1;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; x.beginPath(); for(let q=0;q<=6;q++){ const a=q/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.97,cy+Math.sin(a)*r*.97); } x.stroke(); } });
    const fm=repeatSet(hexT,3,3); seamT.repeat.set(3,3);
    const floor=mesh(new THREE.CircleGeometry(R,64),new THREE.MeshPhysicalMaterial({map:fm.map,normalMap:fm.normalMap,roughness:.35,clearcoat:.6,emissive:col(0xffffff),emissiveMap:seamT,emissiveIntensity:.5}),0,0,0,false); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
    lv.floorMat=floor.material;
    // organic walls: a squashed dome with ribs
    const wallT=texSet('alienWall',512,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const k=.75+n*.45; return [158*k,118*k,190*k]; },5,4); for(let i=0;i<24;i++){ x.strokeStyle=`rgba(255,200,255,${rand(.04,.1)})`; x.lineWidth=rand(2,6); x.beginPath(); const xx=rand(0,w); x.moveTo(xx,0); x.bezierCurveTo(xx+rand(-40,40),h*.3,xx+rand(-40,40),h*.6,xx+rand(-20,20),h); x.stroke(); } },{strength:2});
    const wm=repeatSet(wallT,4,2);
    const wallM=new THREE.MeshPhysicalMaterial({map:wm.map,normalMap:wm.normalMap,roughness:.6,side:THREE.BackSide,clearcoat:.3});
    const dome=mesh(new THREE.SphereGeometry(R,64,32,0,Math.PI*2,0,Math.PI/2),wallM,0,0,0,false); dome.scale.y=.62; dome.receiveShadow=true; scene.add(dome);
    const ribM=new THREE.MeshPhysicalMaterial({color:col(0x5a3a7a),roughness:.4,clearcoat:.8});
    for(let i=0;i<10;i++){ const holder=new THREE.Group(); holder.rotation.y=i/10*Math.PI*2; const rib=mesh(GC('ribArc'+R,()=>new THREE.TorusGeometry(R-.05,.1,8,40,Math.PI/2)),ribM,0,0,0,false); rib.scale.set(1,.62,1); holder.add(rib); scene.add(holder); }
    // bioluminescent ceiling: glowing pods hanging from the top
    lv.pods=[];
    for(let i=0;i<14;i++){ const a=rand(0,6.28), r=rand(0,R*.7); const x=Math.cos(a)*r, z=Math.sin(a)*r; const topY=Math.sqrt(Math.max(0,R*R-r*r))*.62; const len=rand(.3,1.1);
      scene.add(cyl(.015,.015,len,mat(0x6a4a8a),x,topY-len/2,z,5,false)); const pod=sph(rand(.1,.2),emissiveMat(pick([0x6dffd8,0xff7af0,0xb08aff]),2.5),x,topY-len,z,14,10,false); scene.add(pod); lv.pods.push({pod,ph:rand(0,6)}); }
    lv.rig=rig; lv.pls=[];
    for(let i=0;i<3;i++){ const pl=new THREE.PointLight(col([0x9a7aff,0x6dffd8,0xff9ae8][i]),1.8,10,2); pl.position.set(Math.cos(i*2.1)*2.5,2.8,Math.sin(i*2.1)*2.5); scene.add(pl); lv.pls.push(pl); }
    // round window with a Mars view
    const winT=canvasTex(512,512,(x,w,h)=>{ let g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#8a5a44'); g.addColorStop(.55,'#e8b890'); g.addColorStop(.6,'#b8703a'); g.addColorStop(1,'#6a3a20'); x.fillStyle=g; x.fillRect(0,0,w,h); x.fillStyle='#9a4a28'; x.beginPath(); x.moveTo(0,h*.6); for(let i=0;i<=10;i++) x.lineTo(i*w/10,h*.52-Math.abs(Math.sin(i*1.7))*40); x.lineTo(w,h*.6); x.fill(); x.fillStyle='#fff8e8'; x.beginPath(); x.arc(w*.7,h*.22,14,0,7); x.fill(); for(let i=0;i<5;i++){ x.fillStyle='#e8e0d8'; x.fillRect(60+i*80,h*.5-rand(20,60),24,rand(20,60)); } });
    // round windows looking out at Mars (one in front, one on each side)
    for(const a of [0,Math.PI*.55,-Math.PI*.55]){ const hold=new THREE.Group(); hold.rotation.y=a; scene.add(hold);
      const win=mesh(new THREE.CircleGeometry(a?.85:1.2,48),new THREE.MeshBasicMaterial({map:winT}),0,a?1.75:2,-R+(a?.75:.9),false); win.material.color.setScalar(1.5); hold.add(win); (lv.wins=lv.wins||[]).push(win);
      hold.add(mesh(new THREE.TorusGeometry(a?.9:1.25,.14,12,48),ribM,0,a?1.75:2,-R+(a?.77:.92),false)); colFromObj(lv.col,hold,{pad:.05}); }
    // glowing baseboard where the walls meet the floor + glowing veins along each rib
    const base=mesh(new THREE.TorusGeometry(R-.12,.05,8,96),emissiveMat(0x6dffd8,2.2),0,.12,0,false); base.rotation.x=Math.PI/2; scene.add(base);
    const veinM=emissiveMat(0xff7af0,1.6);
    for(let i=0;i<10;i++){ const holder=new THREE.Group(); holder.rotation.y=i/10*Math.PI*2+Math.PI/10; const v=mesh(GC('veinArc'+R,()=>new THREE.TorusGeometry(R-.08,.018,6,48,Math.PI/2)),veinM,0,0,0,false); v.scale.set(1,.62,1); holder.add(v); scene.add(holder); }
    // shelf of glowing alien jars on the wall
    const shelfG=new THREE.Group(); shelfG.rotation.y=-Math.PI*.8; scene.add(shelfG);
    for(const y of [1.1,1.8]){ const sh=box(1.7,.06,.62,ribM,0,y,-R+.74,false); shelfG.add(sh); shelfG.add(box(.06,.4,.6,ribM,-.86,y-.2,-R+.74,false)); shelfG.add(box(.06,.4,.6,ribM,.86,y-.2,-R+.74,false));
      for(let k=0;k<4;k++){ const jx=-.6+k*.4; const jar=mesh(GC('ajar',()=>{ const g=new THREE.SphereGeometry(.1,14,10); g.scale(1,1.5,1); return g; }),new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:.05,transparent:true,opacity:.4,clearcoat:1}),jx,y+.16,-R+.72,false); shelfG.add(jar); shelfG.add(sph(.055,emissiveMat(pick([0x6dffd8,0xff7af0,0xffcc33,0x9aff7a]),2.5),jx,y+.15,-R+.72,10,8,false)); } }
    colFromObj(lv.col,shelfG,{pad:.02});
    // wardrobe pod beside the bed
    const wd=new THREE.Group(); wd.position.set(-4.6,0,.9); wd.rotation.y=1.4; scene.add(wd);
    const wdBody=mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshPhysicalMaterial({color:col(0xb8a0d8),roughness:.3,clearcoat:1}),0,1.1,0); wdBody.scale.set(.55,1.1,.45); wd.add(wdBody);
    const seam=mesh(new THREE.TorusGeometry(.5,.012,6,40),emissiveMat(0x6dffd8,2),0,1.1,.02,false); seam.scale.set(1,2.1,1); seam.rotation.y=Math.PI/2; wd.add(seam);
    colCircle(lv.col,-4.6,.9,.6);
    // the alien bed: a glowing pod with a soft mattress
    const bed=new THREE.Group(); bed.position.set(-3.2,0,-2); bed.rotation.y=.5; scene.add(bed); lv.bed=bed;
    const bedShell=new THREE.MeshPhysicalMaterial({color:col(0xe8e0f0),roughness:.25,clearcoat:1});
    bed.add(mesh(new THREE.SphereGeometry(1,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2),bedShell,0,.55,0)); bed.children[0].scale.set(1.1,.55,1.6);
    bed.add(mesh(new THREE.SphereGeometry(1,40,20),new THREE.MeshPhysicalMaterial({color:col(0x6a4ab8),roughness:.9,sheen:col(0xb08aff)}),0,.55,0)); bed.children[1].scale.set(.95,.18,1.45);
    bed.add(mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshPhysicalMaterial({color:col(0xd8c8ff),roughness:.9,sheen:col(0xffffff)}),0,.72,-1.05)); bed.children[2].scale.set(.5,.12,.25);
    bed.add(mesh(new THREE.TorusGeometry(1.05,.04,8,48),emissiveMat(0x6dffd8,2),0,.56,0,false)); bed.children[3].scale.set(1.05,1.53,1); bed.children[3].rotation.x=Math.PI/2;
    colOBB(lv.col,-3.2,-2,2.2,3.2,.5);
    // the alien table: a floating mushroom slab + alien fruit
    const tbl=new THREE.Group(); tbl.position.set(2.2,0,-1.2); scene.add(tbl); lv.table=tbl;
    tbl.add(cyl(.15,.35,.8,ribM,0,.4,0,20)); tbl.add(mesh(new THREE.CylinderGeometry(1,.8,.12,40),new THREE.MeshPhysicalMaterial({color:col(0xa8e8e0),roughness:.1,clearcoat:1,transparent:true,opacity:.85}),0,.95,0));
    tbl.add(mesh(new THREE.TorusGeometry(.95,.03,8,48),emissiveMat(0xff7af0,2),0,.95,0,false)); tbl.children[2].rotation.x=Math.PI/2;
    for(let i=0;i<4;i++) tbl.add(sph(.09,new THREE.MeshPhysicalMaterial({color:col(pick([0x9aff7a,0xff7ae0,0xffcc33])),roughness:.2,clearcoat:1,emissive:col(0x222222)}),rand(-.3,.3),1.08,rand(-.3,.3),12,10));
    lv.seats=[V3(.8,0,-1.2),V3(3.6,0,-1.2)];
    for(const sp of lv.seats){ const st=new THREE.Group(); st.position.copy(sp); scene.add(st); colCircle(lv.col,sp.x,sp.z,.3); st.add(cyl(.28,.2,.5,ribM,0,.25,0,16)); st.add(mesh(new THREE.SphereGeometry(.32,20,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:col(0xb08aff),roughness:.8,sheen:col(0xffffff)}),0,.5,0)); }
    colCircle(lv.col,2.2,-1.2,1.05);
    // alien pizza (Day 3): purple crust, teal sauce, glowing toppings, one slice missing
    const pz=new THREE.Group(); pz.position.set(2.2,1.02,-1.2); pz.visible=false; scene.add(pz); lv.pizza=pz;
    const crustM=new THREE.MeshPhysicalMaterial({color:col(0x9a5ac8),roughness:.7,clearcoat:.2}), sauceM=new THREE.MeshPhysicalMaterial({color:col(0x3ad8b0),roughness:.35,clearcoat:.8,emissive:col(0x0a3a2a)});
    pz.add(mesh(new THREE.CylinderGeometry(.46,.46,.05,40,1,false,0,Math.PI*1.75),crustM,0,0,0));
    pz.add(mesh(new THREE.CylinderGeometry(.41,.41,.02,40,1,false,.04,Math.PI*1.72),sauceM,0,.03,0,false));
    const topM=[emissiveMat(0x9aff5a,1.6),emissiveMat(0xff7af0,1.4),emissiveMat(0xffcc33,1.3)];
    for(let i=0;i<18;i++){ const a=rand(.1,Math.PI*1.7), r=rand(.08,.36); pz.add(sph(rand(.025,.045),pick(topM),Math.sin(a)*r,.05,Math.cos(a)*r,8,6,false)); }
    lv.sliceGeo=()=>{ const g=new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.3,.3,.04,12,1,false,0,Math.PI/4),crustM,0,0,0,false)); g.add(mesh(new THREE.CylinderGeometry(.27,.27,.015,12,1,false,.03,Math.PI/4-.06),sauceM,0,.025,0,false)); for(let i=0;i<3;i++){ const a=rand(.1,.7), r=rand(.08,.22); g.add(sph(.03,pick(topM),Math.sin(a)*r,.04,Math.cos(a)*r,8,6,false)); } return g; };
    // Jim + you, only used for the pizza cutscene
    lv.jimH=makeJim(); lv.jimH.userData.level='alienhouse'; lv.jimH.visible=false; scene.add(lv.jimH);
    lv.youH=makeYou(); lv.youH.userData.level='alienhouse'; lv.youH.visible=false; scene.add(lv.youH);
    // alarm clock on a little floating nightstand by the bed
    const ns=new THREE.Group(); ns.position.set(-2.3,0,-3.6); scene.add(ns); lv.nightstand=ns;
    ns.add(cyl(.05,.12,.55,ribM,0,.28,0,12)); ns.add(mesh(new THREE.CylinderGeometry(.34,.3,.08,24),new THREE.MeshPhysicalMaterial({color:col(0xd8c8f0),roughness:.2,clearcoat:1}),0,.6,0));
    const ck=new THREE.Group(); ck.position.set(0,.64,0); ck.rotation.y=Math.PI*1.25; ns.add(ck); lv.clock=ck;
    ck.add(mesh(new THREE.SphereGeometry(.15,24,16,0,Math.PI*2,0,Math.PI*.6),new THREE.MeshPhysicalMaterial({color:col(0x2a2040),roughness:.2,clearcoat:1,metalness:.3}),0,0,0));
    lv.clockC=document.createElement('canvas'); lv.clockC.width=128; lv.clockC.height=64; lv.clockTex=new THREE.CanvasTexture(lv.clockC); lv.clockTex.encoding=THREE.sRGBEncoding;
    const cs=mesh(new THREE.PlaneGeometry(.22,.11),new THREE.MeshBasicMaterial({map:lv.clockTex,toneMapped:false}),0,.1,.12,false); cs.rotation.x=-.5; ck.add(cs); lv.clockScr=cs;
    lv.clockLight=new THREE.PointLight(col(0xff5a5a),0,2.5,2); lv.clockLight.position.set(0,.3,.1); ck.add(lv.clockLight);
    lv.drawClock=(txt,on)=>{ const x=lv.clockC.getContext('2d'); x.fillStyle='#050308'; x.fillRect(0,0,128,64); x.fillStyle=on?'#ff5a5a':'#6dffd8'; x.font='bold 40px monospace'; x.textAlign='center'; x.fillText(txt,64,46); lv.clockTex.needsUpdate=true; };
    lv.drawClock('7:00',false);
    colCircle(lv.col,-2.3,-3.6,.35);
    // the alien computer: a curved console with a holographic screen
    const pc=new THREE.Group(); pc.position.set(3,0,2.6); pc.rotation.y=-2.3; scene.add(pc); lv.pc=pc;
    pc.add(rbox(1.4,.9,.6,.15,bedShell,0,.45,0)); pc.add(cyl(.05,.05,.6,ribM,0,1.2,0,8));
    lv.pcScreen={c:document.createElement('canvas')}; lv.pcScreen.c.width=256; lv.pcScreen.c.height=160; lv.pcScreen.tex=new THREE.CanvasTexture(lv.pcScreen.c); lv.pcScreen.tex.encoding=THREE.sRGBEncoding;
    const scr=mesh(new THREE.PlaneGeometry(1.2,.75),new THREE.MeshBasicMaterial({map:lv.pcScreen.tex,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),0,1.7,0,false); pc.add(scr);
    colCircle(lv.col,3,2.6,.9);
    // shelves + plants + a rug
    makeBushes(scene,[{x:-4.6,z:2.4,h:1.4,r:.6},{x:4.4,z:-3.4,h:1.2,r:.5}],{seed:77,tint:0xd8a0ff});
    const rug=mesh(new THREE.CircleGeometry(1.8,48),new THREE.MeshStandardMaterial({map:canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#2a1a4a'; x.fillRect(0,0,w,h); for(let i=0;i<6;i++){ x.strokeStyle=i%2?'#6dffd8':'#ff7af0'; x.lineWidth=5; x.beginPath(); x.arc(128,128,20+i*18,0,7); x.stroke(); } }),roughness:1}),0,.01,1,false); rug.rotation.x=-Math.PI/2; scene.add(rug);
    // door you came in through
    scene.add(mesh(new THREE.CircleGeometry(1.1,32,0,Math.PI),new THREE.MeshPhysicalMaterial({color:col(0x3a2a4a),clearcoat:1,roughness:.3}),0,0,R-.4,false)).children; scene.children[scene.children.length-1].rotation.y=Math.PI;
    const dRing=mesh(new THREE.RingGeometry(1.1,1.22,40,1,0,Math.PI),emissiveMat(0x6dffd8,2.2),0,0,R-.41,false); dRing.rotation.y=Math.PI; scene.add(dRing);
    lv.col.radius=R-.6; lv.col.cx=0; lv.col.cz=0;
  },
  enter(){ FX.sunWorld=null; },
  setNight(on){ this.night=on; for(const w of this.wins) w.material.color.set(on?0x2a2450:0xffffff).multiplyScalar(on?1:1.5); for(const pl of this.pls) pl.intensity=on?.8:1.8; if(this.rig&&this.rig.hemi) this.rig.hemi.intensity=on?.3:.62; },
  update(dt,t){
    for(const p of this.pods){ p.pod.material.emissiveIntensity=2+Math.sin(t*1.5+p.ph)*1.2; p.pod.position.y+=Math.sin(t+p.ph)*.0008; }
    this.floorMat.emissiveIntensity=.35+Math.sin(t*.8)*.15;
    this.pcT=(this.pcT||0)+dt; if(this.pcT>.1){ this.pcT=0; const x=this.pcScreen.c.getContext('2d'); x.fillStyle='rgba(0,10,8,.9)'; x.fillRect(0,0,256,160); x.fillStyle='#6dffd8'; x.font='bold 18px monospace'; x.fillText('⌬ XZL-OS 9000',10,24); x.font='13px monospace'; for(let i=0;i<6;i++){ x.fillStyle=`rgba(109,255,216,${.4+.4*Math.sin(t*3+i)})`; x.fillText(['◇◈◊⟡ ⌬⍜','⟟⊑⋔⟒ ⌇⟒⏁','⊬⍜⎍ ⊑⏃⎐⟒ Ѫ0',"HELLO, HUMAN",'⌿⍀⟒⌇⌇ ⟒','▮▮▮▮▯▯'][i],10,50+i*18); } this.pcScreen.tex.needsUpdate=true; }
  }
});

