/* ================================================================
   MARS SHIFT PART 3 — STEVE'S SHIP. You wake up tied to a metal chair.
   Steve's story (a flashback), Jim calls your watch, the rat that eats
   metal, and the purple block that says DON'T TOUCH.
   ================================================================ */
/* your own arms, as real objects in the world (for when you're tied up) */
function makeWorldArm(side){
  const T=charTex();
  const sleeveM=new THREE.MeshPhysicalMaterial({color:col(0x2f4d6e),roughness:.9,map:T.cloth.map,normalMap:T.cloth.normalMap,sheen:col(0x222222)});
  const skinM=skinify(new THREE.MeshPhysicalMaterial({color:col(0xe2b08c),roughness:.5,normalMap:T.skinN.normalMap,normalScale:new THREE.Vector2(.3,.3),sheen:col(0x442a22)}));
  const g=new THREE.Group();
  const fore=mesh(lathe('vmFore',[[0,-.3],[.042,-.29],[.046,-.2],[.05,-.05],[.052,.2],[0,.25]],16),sleeveM,0,0,0); fore.rotation.x=Math.PI/2; g.add(fore);
  g.add(mesh(GC('vmCuff',()=>new THREE.TorusGeometry(.044,.012,8,18)),sleeveM,0,0,-.29));
  const wrist=mesh(GC('vmWrist',()=>new THREE.CylinderGeometry(.029,.031,.06,14)),skinM,0,0,-.31); wrist.rotation.x=Math.PI/2; g.add(wrist);
  const handG=new THREE.Group(); handG.position.set(0,0,-.33); handG.rotation.x=Math.PI/2; g.add(handG);
  const H=makeHand(side,skinM); handG.add(H.grp); H.grp.rotation.y=side>0?-.3:.3;
  for(const fg of H.fingers){ fg.a.rotation.x=-.25; fg.b.rotation.x=-.3; if(fg.c) fg.c.rotation.x=-.25; }
  g.userData={H};
  // the upper arm, going back up to your shoulder (so the forearm isn't a cut-off tube)
  { const el=V3(0,0,.2), sh=V3(side*.24,.5,.55), d=sh.clone().sub(el), L=d.length(); const up=mesh(new THREE.CylinderGeometry(.06,.05,L,14),sleeveM,0,0,0); up.position.copy(el).addScaledVector(d,.5); up.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize()); g.add(up); g.add(mesh(new THREE.SphereGeometry(.055,14,10),sleeveM,el.x,el.y,el.z)); }
  if(side>0){ // the watch + stitches on the left wrist
    const w=new THREE.Group(); w.position.set(0,.034,-.29); g.add(w);
    w.add(mesh(GC('wBand',()=>new THREE.TorusGeometry(.037,.008,8,24)),mat(0x1a1c22,{roughness:.4,metalness:.6}),0,-.034,0));
    w.add(mesh(roundedBoxGeo(.05,.012,.06,.006),mat(0x303640,{roughness:.2,metalness:.9}),0,0,0));
    const scr=mesh(GC('wScr',()=>new THREE.PlaneGeometry(.04,.05)),new THREE.MeshBasicMaterial({color:col(0x6dffd8).multiplyScalar(2.5),transparent:true,opacity:.9}),0,.0065,0,false); scr.rotation.x=-Math.PI/2; w.add(scr);
    g.userData.watch=w; g.userData.scr=scr;
    const st=new THREE.Group(); st.position.set(0,0,-.322); g.add(st); st.add(mesh(GC('vmScar',()=>new THREE.TorusGeometry(.0312,.0055,6,28)),mat(0xb0403c,{roughness:.55}),0,0,0));
  }
  return g;
}
/* metal textures */
function shipTex(){
  return {
    floor:texSet('shipFloor',512,(x,w,h)=>{ x.fillStyle='#34393e'; x.fillRect(0,0,w,h); for(let j=0;j<16;j++) for(let i=0;i<16;i++){ x.save(); x.translate(i*32+16,j*32+16); x.rotate((i+j)%2?.6:-.6); x.fillStyle='rgba(255,255,255,.07)'; x.fillRect(-9,-2,18,4); x.restore(); } x.strokeStyle='#1a1d20'; x.lineWidth=4; x.strokeRect(2,2,w-4,h-4); x.fillStyle='#5a6066'; for(const [a,b] of [[14,14],[w-14,14],[14,h-14],[w-14,h-14]]){ x.beginPath(); x.arc(a,b,5,0,7); x.fill(); } },{strength:2.2}),
    wall:texSet('shipWall',512,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const k=.8+n*.25; return [58*k,70*k,62*k]; },6,3); x.strokeStyle='#15191a'; x.lineWidth=5; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*w/4,0); x.lineTo(i*w/4,h); x.stroke(); } x.beginPath(); x.moveTo(0,h*.62); x.lineTo(w,h*.62); x.stroke(); x.fillStyle='#8a9a90'; for(let i=0;i<4;i++) for(const y of [10,h*.62-10,h*.62+10,h-10]){ x.beginPath(); x.arc(i*w/4+12,y,4,0,7); x.arc(i*w/4+w/4-12,y,4,0,7); x.fill(); } },{strength:2.5})
  };
}
defineLevel('ship',{
  title:"Steve's ship",
  env:{fx:{exposure:1.02,saturation:1.0,contrast:1.12,bloomStrength:.5,bloomThreshold:1.0,vignette:.55,temp:.02,aoRadius:.5,grain:.04},music:'ship',reverb:.5,amb:[['labHum',.03],['spaceDrone',.03]],surface:'metal',far:140},
  async build(scene,lv){
    scene.background=col(0x05080a);
    lv.envMap=makeEnv({top:0x2a3a30,horizon:0x1a2420,bottom:0x080a0a,lights:[{x:0,y:20,z:0,w:10,h:10,c:0xc8ffd0,k:2},{x:0,y:4,z:-30,w:6,h:6,c:0xb86aff,k:2}]});
    const rig=makeRig(scene,{sun:.35,sunColor:0xd8ffe0,hemi:.4,sky:0x9ad8a8,ground:0x1a1a22,dir:V3(.3,1,.2),span:14,dist:30,far:60}); lv.rig=rig;
    const TX_=shipTex();
    const fm=repeatSet(TX_.floor,1,1), wmT=repeatSet(TX_.wall,1,1);
    const floorM=new THREE.MeshStandardMaterial({map:fm.map,normalMap:fm.normalMap,roughness:.55,metalness:.6});
    const wallM=new THREE.MeshStandardMaterial({map:wmT.map,normalMap:wmT.normalMap,roughness:.6,metalness:.5});
    const ceilM=mat(0x1e2426,{roughness:.7,metalness:.5}), trimM=mat(0x0e1112,{roughness:.4,metalness:.8});
    const greenM=emissiveMat(0x5aff6a,2.2), purpleM=emissiveMat(0xb86aff,2.4);
    lv.shipMats=[floorM,wallM];
    // box room with door gaps: sides n(-z) s(+z) e(+x) w(-x); gaps=[{side,at,w,h}]
    const room=(x0,x1,z0,z1,H,gaps=[],glow=greenM)=>{
      const cx=(x0+x1)/2, cz=(z0+z1)/2, W=x1-x0, D=z1-z0;
      const fl=mesh(new THREE.PlaneGeometry(W,D),floorM.clone(),cx,0,cz,false); fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; fl.material.map=fm.map.clone(); fl.material.map.needsUpdate=true; fl.material.map.repeat.set(W/2,D/2); fl.material.normalMap=fm.normalMap.clone(); fl.material.normalMap.needsUpdate=true; fl.material.normalMap.repeat.set(W/2,D/2); scene.add(fl);
      const ce=mesh(new THREE.PlaneGeometry(W,D),ceilM,cx,H,cz,false); ce.rotation.x=Math.PI/2; scene.add(ce);
      const wall=(ax,az,bx,bz,side)=>{ // wall from a to b with gaps
        const len=Math.hypot(bx-ax,bz-az), dirx=(bx-ax)/len, dirz=(bz-az)/len; const gs=gaps.filter(g=>g.side===side).map(g=>({a:g.at-g.w/2,b:g.at+g.w/2,h:g.h||2.4})).sort((p,q)=>p.a-q.a);
        const toT=v=>side==='n'||side==='s'?v-ax:v-az; let cur=0; const segs=[];
        for(const g of gs){ const a=Math.abs(toT(g.a)), b=Math.abs(toT(g.b)); const lo=Math.min(a,b), hi=Math.max(a,b); if(lo>cur) segs.push([cur,lo,0,H]); segs.push([lo,hi,g.h,H]); cur=hi; }
        if(cur<len) segs.push([cur,len,0,H]);
        for(const [s0,s1,y0,y1] of segs){ if(s1-s0<.01||y1-y0<.01) continue; const m=(s0+s1)/2; const px=ax+dirx*m, pz=az+dirz*m;
          const mt=wallM.clone(); mt.map=wmT.map.clone(); mt.map.needsUpdate=true; mt.map.repeat.set((s1-s0)/3,(y1-y0)/3.4); mt.normalMap=wmT.normalMap.clone(); mt.normalMap.needsUpdate=true; mt.normalMap.repeat.copy(mt.map.repeat);
          const b=box(side==='n'||side==='s'?s1-s0:.25,y1-y0,side==='n'||side==='s'?.25:s1-s0,mt,px,(y0+y1)/2,pz); scene.add(b);
          if(y0===0){ const hw=(side==='n'||side==='s'); colBox(lv.col,hw?px-(s1-s0)/2:px-.14,hw?px+(s1-s0)/2:px+.14,hw?pz-.14:pz-(s1-s0)/2,hw?pz+.14:pz+(s1-s0)/2);
            const inset=(side==='n'?.14:side==='s'?-.14:side==='e'?-.14:.14);
            const st=box(hw?s1-s0:.03,.05,hw?.03:s1-s0,glow,px+(hw?0:inset),.1,pz+(hw?inset:0),false); scene.add(st);
            const st2=box(hw?s1-s0:.03,.04,hw?.03:s1-s0,glow,px+(hw?0:inset),H-.25,pz+(hw?inset:0),false); scene.add(st2); } }
      };
      wall(x0,z0,x1,z0,'n'); wall(x0,z1,x1,z1,'s'); wall(x1,z0,x1,z1,'e'); wall(x0,z0,x0,z1,'w');
    };
    // ---- the cell (x -4..4, z -4..4) ----
    room(-4,4,-4,4,3.4,[{side:'n',at:0,w:1.6,h:2.5}]);
    const cl=new THREE.PointLight(col(0xd8ffe0),3.2,13,2); cl.position.set(0,3,.2); scene.add(cl); lv.cellLight=cl;
    scene.add(mesh(new THREE.CircleGeometry(.5,32),basicGlow(0xd8ffe0,2),0,3.38,.6,false)).children; scene.children[scene.children.length-1].rotation.x=Math.PI/2;
    // sliding door
    const dm=new THREE.MeshStandardMaterial({color:col(0x4a5652),roughness:.4,metalness:.8});
    lv.door={L:box(.82,2.5,.12,dm,-.4,1.25,-4),R:box(.82,2.5,.12,dm,.4,1.25,-4),open:0,target:0};
    scene.add(lv.door.L); scene.add(lv.door.R);
    for(const d of [lv.door.L,lv.door.R]) d.add(box(.08,.9,1.2,greenM,0,0,0,false));
    lv.doorCol=colBox(lv.col,-.82,.82,-4.15,-3.85,()=>lv.door.open<.8);
    // intercom speaker by the door
    const ic=new THREE.Group(); ic.position.set(1.4,1.7,-3.86); scene.add(ic); ic.add(box(.34,.44,.06,trimM,0,0,0)); for(let i=0;i<5;i++) ic.add(box(.24,.02,.02,mat(0x3a3a3a),0,.12-i*.06,.035,false)); lv.icLight=sph(.03,emissiveMat(0xff4a3a,0),0,.18,.04,8,6,false); ic.add(lv.icLight);
    // ---- the metal chair ----
    const chair=new THREE.Group(); chair.position.set(0,0,1.2); scene.add(chair); lv.chair=chair;
    const cm=mat(0x6a7474,{roughness:.35,metalness:.9});
    chair.add(box(.62,.08,.6,cm,0,.48,0)); for(const [x,z] of [[-.27,-.25],[.27,-.25],[-.27,.25],[.27,.25]]) chair.add(cyl(.025,.025,.48,cm,x,.24,z,8));
    chair.add(box(.62,1.1,.06,cm,0,1.05,.3)); for(const x of [-.34,.34]){ chair.add(box(.09,.05,.56,cm,x,.66,-.02)); chair.add(cyl(.02,.02,.2,cm,x,.56,-.25,8)); }
    colCircle(lv.col,0,1.2,.45,()=>F_().freed);
    // your arms, cuffed to the armrests
    lv.armL=makeWorldArm(1); lv.armR=makeWorldArm(-1);
    for(const [a,x] of [[lv.armL,-.34],[lv.armR,.34]]){ a.scale.setScalar(.6); a.position.set(x,.715,1.16); a.rotation.set(0,x>0?-.06:.06,0); scene.add(a); }
    lv.cuffs=[];
    for(const x of [-.34,.34]){ const c=new THREE.Group(); c.position.set(x,.7,.98); scene.add(c); c.add(box(.1,.03,.1,cm,0,-.03,0)); const band=mesh(new THREE.TorusGeometry(.035,.012,8,20,Math.PI),mat(0x9aa6a6,{roughness:.25,metalness:1}),0,-.01,0); band.rotation.y=Math.PI/2; c.add(band); c.add(sph(.012,mat(0x444a4a,{metalness:1}),.04,-.01,0,8,6)); c.add(sph(.012,mat(0x444a4a,{metalness:1}),-.04,-.01,0,8,6)); lv.cuffs.push(c); }
    // Steve
    lv.steve=makeSteve(); lv.steve.userData.level='ship'; scene.add(lv.steve);
    // the rat, and the metal it's been eating
    lv.rat=makeRat(); lv.rat.scale.setScalar(.5); scene.add(lv.rat);
    const scrapM=mat(0x8a9494,{roughness:.3,metalness:1});
    const scr=new THREE.Group(); scr.position.set(2.7,0,-2.7); scene.add(scr); lv.scrap=scr;
    for(let i=0;i<5;i++){ const p=cyl(.04,.04,rand(.4,.8),scrapM,rand(-.3,.3),.05,rand(-.3,.3),10); p.rotation.set(Math.PI/2,0,rand(0,3)); scr.add(p); }
    for(let i=0;i<3;i++){ const pl=box(rand(.25,.4),.02,rand(.2,.3),scrapM,rand(-.3,.3),.03+i*.02,rand(-.3,.3)); pl.rotation.y=rand(0,3); scr.add(pl); }
    for(let i=0;i<24;i++){ const sh=box(.02,.006,.012,scrapM,rand(-.6,.6),.005,rand(-.6,.6),false); sh.rotation.y=rand(0,3); scr.add(sh); }
    const hole=mesh(new THREE.CircleGeometry(.16,20,0,Math.PI),mat(0x050505),3.86,0,-2.2,false); hole.rotation.y=-Math.PI/2; scene.add(hole);
    // ---- the corridor (x -1.3..1.3, z -11..-4) ----
    room(-1.3,1.3,-11,-4,2.8,[{side:'s',at:0,w:1.6,h:2.5},{side:'n',at:0,w:2.2,h:2.6},{side:'e',at:-7.5,w:1.4,h:2.4}]);
    // Steve's control room, off the corridor (locked)
    room(1.3,6.5,-10,-5,2.8,[{side:'w',at:-7.5,w:1.4,h:2.4}]);
    lv.sideDoor={m:box(.12,2.4,1.42,dm,1.3,1.2,-7.5),open:0,target:0}; scene.add(lv.sideDoor.m); scene.add(sph(.06,basicGlow(0xff4a3a,3),1.12,2.1,-6.6,8,6,false));
    colBox(lv.col,1.15,1.45,-8.2,-6.8,()=>lv.sideDoor.open<.8);
    const holo=new THREE.Group(); holo.position.set(4.6,1.4,-7.5); scene.add(holo); lv.holoEarth=holo;
    holo.add(sph(.6,new THREE.MeshBasicMaterial({color:col(0x5aff6a),wireframe:true,transparent:true,opacity:.6}),0,0,0,16,12,false)); holo.add(mesh(new THREE.TorusGeometry(.9,.02,6,48),basicGlow(0x5aff6a,2),0,0,0,false));
    holo.add(cyl(.5,.6,.9,trimM,0,-.95,0,16));
    lv.alex=makeAlien({name:'Alex'}); lv.alex.userData.A.faceNear=false; lv.alex.userData.level='ship'; lv.alex.position.set(5.3,0,-6.4); lv.alex.rotation.y=-2.2; scene.add(lv.alex);
    for(let z=-5.5;z>-11;z-=2){ const pl=new THREE.PointLight(col(0xa8ffb8),.9,5,2); pl.position.set(0,2.5,z); scene.add(pl); scene.add(box(.6,.03,.2,basicGlow(0xd8ffe0,2),0,2.78,z,false)); }
    // windows: sky and clouds far below (the ship is floating over Earth)
    const skyT=canvasTex(512,256,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#4a8ad8'); g.addColorStop(.6,'#a8d4f4'); g.addColorStop(1,'#e8f4ff'); x.fillStyle=g; x.fillRect(0,0,w,h); for(let i=0;i<40;i++){ x.fillStyle=`rgba(255,255,255,${rand(.5,.9)})`; x.beginPath(); x.ellipse(rand(0,w),rand(h*.55,h),rand(20,60),rand(6,14),0,0,7); x.fill(); } });
    for(const [x,ry] of [[-1.16,Math.PI/2],[1.16,-Math.PI/2]]) for(const z of [-6,-9]){ const wi=mesh(new THREE.PlaneGeometry(1.4,.8),new THREE.MeshBasicMaterial({map:skyT}),x,1.6,z,false); wi.rotation.y=ry; wi.material.color.setScalar(1.3); scene.add(wi); const fr=mesh(new THREE.TorusGeometry(.5,.05,6,4),trimM,x+(x>0?-.01:.01),1.6,z,false); fr.rotation.set(0,ry,Math.PI/4); fr.scale.set(1.45,.85,1); scene.add(fr); }
    // ---- the vault (x -5.5..5.5, z -22..-11) with the purple block ----
    room(-5.5,5.5,-22,-11,4.4,[{side:'s',at:0,w:2.2,h:2.6},{side:'n',at:0,w:2.2,h:2.8}],greenM);
    const vl=new THREE.PointLight(col(0xe0ffe8),1.6,14,2); vl.position.set(0,4,-14); scene.add(vl);
    const vl2=new THREE.PointLight(col(0xe0ffe8),1.2,12,2); vl2.position.set(0,4,-20); scene.add(vl2);
    // pedestal + the block
    const BP=V3(1.05,0,-17.4); lv.blockPos=BP;
    const ped=new THREE.Group(); ped.position.copy(BP); scene.add(ped); lv.ped=ped;
    ped.add(cyl(.42,.5,.95,mat(0x2a2e30,{roughness:.3,metalness:.9}),0,.475,0,24)); ped.add(mesh(new THREE.TorusGeometry(.44,.025,8,40),purpleM,0,.9,0,false)).children; ped.children[1].rotation.x=Math.PI/2;
    colCircle(lv.col,BP.x,BP.z,.55,()=>!F_().knocked);
    const blk=new THREE.Mesh(_U1,blockMat('purple',{emissive:col(0x9a3aff),emissiveMap:BLOCKTEX.purple(),emissiveIntensity:.7,roughness:.6})); blk.scale.setScalar(.62); const pivot=new THREE.Group(); pivot.position.set(BP.x,.95,BP.z); scene.add(pivot); pivot.add(blk); blk.position.y=.31; lv.block=blk; lv.blockPivot=pivot;
    lv.blockLight=new THREE.PointLight(col(0xb86aff),1.6,5,2); lv.blockLight.position.set(BP.x,1.6,BP.z); scene.add(lv.blockLight);
    // floating force-field rings around it
    lv.rings=[]; for(let i=0;i<3;i++){ const r=mesh(new THREE.TorusGeometry(.62,.012,6,48),basicGlow(0xc86aff,2.5),BP.x,1.1+i*.28,BP.z,false); r.rotation.x=Math.PI/2; scene.add(r); lv.rings.push(r); }
    // the sign: DON'T TOUCH — EXTREMELY DANGEROUS
    const signT=canvasTex(512,320,(x,w,h)=>{ x.fillStyle='#f4d020'; x.fillRect(0,0,w,h); x.fillStyle='#111'; for(let i=-4;i<20;i++){ x.beginPath(); x.moveTo(i*40,0); x.lineTo(i*40+20,0); x.lineTo(i*40-20,40); x.lineTo(i*40-40,40); x.fill(); x.beginPath(); x.moveTo(i*40,h-40); x.lineTo(i*40+20,h-40); x.lineTo(i*40-20,h); x.lineTo(i*40-40,h); x.fill(); } x.fillStyle='#c81818'; x.textAlign='center'; x.font='bold 76px Arial Black, sans-serif'; x.fillText("DON'T TOUCH",w/2,140); x.fillStyle='#111'; x.font='bold 40px Arial Black, sans-serif'; x.fillText('EXTREMELY',w/2,200); x.fillText('DANGEROUS',w/2,248); });
    const sign=new THREE.Group(); sign.position.set(BP.x+1.1,0,BP.z+.2); sign.rotation.y=-.5; scene.add(sign); sign.add(cyl(.03,.03,1.5,trimM,0,.75,0,8)); const sp=mesh(new THREE.PlaneGeometry(.9,.56),new THREE.MeshStandardMaterial({map:signT,roughness:.6}),0,1.55,.02); sign.add(sp); const sb=box(.92,.58,.02,trimM,0,1.55,-.005); sign.add(sb); lv.sign=sign; colCircle(lv.col,sign.position.x,sign.position.z,.15);
    // things XXX5 will eat: crates, barrels, consoles, a lamp
    lv.eatables=[];
    const crateM=new THREE.MeshStandardMaterial({color:col(0x5a6a5e),roughness:.5,metalness:.6});
    const addEat=(o,x,z,r)=>{ o.position.set(x,o.position.y,z); scene.add(o); const c=colCircle(lv.col,x,z,r); lv.eatables.push({o,c}); };
    for(const [x,z,s] of [[-4.4,-12.4,.9],[-4.5,-13.5,.8],[-3.5,-12.3,.7],[4.4,-12.5,.9],[4.6,-14,.7],[-4.6,-20.6,.9],[4.5,-20.8,.8],[3.7,-21,.6],[-4.3,-16.4,.8]]){ const c=box(s,s,s,crateM,0,s/2,0); c.rotation.y=rand(-.3,.3); c.add(box(1.02,.1,1.02,trimM,0,.3,0)); c.add(box(1.02,.1,1.02,trimM,0,-.3,0)); addEat(c,x,z,s*.6); }
    for(const [x,z] of [[-2.8,-21.2],[2.9,-12],[-4.6,-18.6]]){ const b=new THREE.Group(); b.add(cyl(.3,.3,.9,mat(0x3a8a4a,{roughness:.4,metalness:.5}),0,.45,0,20)); b.add(mesh(new THREE.TorusGeometry(.3,.02,6,24),trimM,0,.2,0)).children; b.children[1].rotation.x=Math.PI/2; addEat(b,x,z,.35); }
    for(const [x,z,ry] of [[-3.2,-15.2,.8],[3.4,-15.6,-.8]]){ const cn=new THREE.Group(); cn.rotation.y=ry; cn.add(box(1.2,.9,.6,trimM,0,.45,0)); const sc=box(1,.5,.03,emissiveMat(0x5aff6a,1.4),0,1.2,-.1,false); sc.rotation.x=-.3; cn.add(sc); addEat(cn,x,z,.7); }
    // the exit: an open hatch full of daylight
    const ex=new THREE.Group(); ex.position.set(0,0,-21.9); scene.add(ex); lv.exitG=ex;
    ex.add(mesh(new THREE.PlaneGeometry(2.2,2.8),new THREE.MeshBasicMaterial({color:col(0xeaf6ff).multiplyScalar(2.2)}),0,1.4,-.05,false));
    const exT=canvasTex(256,96,(x,w,h)=>{ x.fillStyle='#0a1a0e'; x.fillRect(0,0,w,h); x.fillStyle='#5aff6a'; x.font='bold 64px monospace'; x.textAlign='center'; x.fillText('EXIT',w/2,70); });
    const exs=mesh(new THREE.PlaneGeometry(.9,.34),new THREE.MeshBasicMaterial({map:exT,toneMapped:false}),0,3.1,.12,false); ex.add(exs);
    const exL=new THREE.PointLight(col(0xeaf6ff),2.4,8,2); exL.position.set(0,1.6,.6); ex.add(exL);
    lv.exitCol=colBox(lv.col,-1.2,1.2,-22.2,-21.6,()=>!F_().xxxAwake);
    // XXX5 (hidden until you knock the block over)
    lv.xxx=makeXXX5(1); lv.xxx.visible=false; scene.add(lv.xxx);
    lv.col.bounds=[-5.4,5.4,-21.95,3.9];
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){
    const lv=this, F=F_();
    const d=lv.door; d.open=damp(d.open,d.target,5,dt); d.L.position.x=-.4-d.open*.8; d.R.position.x=.4+d.open*.8;
    if(F.freed && !F.knocked){ const near=Math.hypot(PLAYER.pos.x,PLAYER.pos.z+4)<2.4; const t2=near?1:0; if(t2!==d.target){ d.target=t2; sfxAt(V3(0,1.2,-4),()=>SFX.hydraulic(),2); } }
    const sd=lv.sideDoor; sd.open=damp(sd.open,sd.target,5,dt); sd.m.position.z=-7.5-sd.open*1.35; if(lv.holoEarth){ lv.holoEarth.rotation.y=t*.5; }
    if(!F.knocked){ lv.block.rotation.y=t*.4; lv.block.position.y=.31+Math.sin(t*1.6)*.02; }
    lv.rings.forEach((r,i)=>{ r.visible=!F.knocked; r.rotation.z=t*(i%2?.8:-.6); r.position.y=1.1+i*.28+Math.sin(t*1.3+i)*.05; });
    if(!F.knocked) lv.blockLight.intensity=1.4+Math.sin(t*3)*.3; else if(F.xxxAwake) lv.blockLight.intensity=0;
    if(lv.rat.visible) animateRat(lv.rat,t,!!lv.ratMoving);
    if(lv.xxx.visible){ animateXXX5(lv.xxx,t,{rage:true}); }
    lv.icLight.material.emissiveIntensity=lv.icOn?(Math.sin(t*12)>0?3:0):0;
    if(lv.ringing){ const k=Math.sin(t*14)>0; lv.armL.userData.scr.material.color.set(k?0xffffff:0x6dffd8).multiplyScalar(k?4:2.5); }
  }
});

/* ---------- the flashback: a playground, a long time ago ---------- */
defineLevel('playground',{
  title:'a long time ago',
  env:{fx:{exposure:1.1,saturation:.85,contrast:1.05,bloomStrength:.5,bloomThreshold:.9,vignette:.6,temp:.12,flashback:.85,grain:.06},music:'flash',reverb:.2,amb:[['breeze',.04]],surface:'grass',far:500},
  async build(scene,lv){
    const sunDir=V3(.5,.7,.3).normalize();
    scene.add(makeSky({top:0x4a8ad8,mid:0x9ac8f0,horizon:0xffe8c0,bottom:0x6a8a50,sunDir,clouds:.45}));
    lv.envMap=makeEnv({top:0x6a9ad8,horizon:0xffe8c0,bottom:0x4a6a3a,lights:[{x:sunDir.x*30,y:sunDir.y*30,z:sunDir.z*30,w:6,h:6,c:0xfff0d0,k:6}]});
    makeRig(scene,{sun:2.6,sunColor:0xfff0d8,hemi:.55,sky:0xa8d0ff,ground:0x5a7a3a,dir:sunDir,span:18,dist:40,far:90});
    scene.fog=new THREE.FogExp2(col(0xd8e8f0),.012);
    const gT=canvasTex(256,256,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const k=.75+n*.4; return [86*k,150*k,62*k]; },8,4); for(let i=0;i<1400;i++){ x.fillStyle=`rgba(${pick(['40,90,30','120,180,80','90,140,50'])},.5)`; x.fillRect(rand(0,w),rand(0,h),1,rand(2,5)); } },[30,30]);
    const gr=mesh(new THREE.CircleGeometry(140,64),new THREE.MeshStandardMaterial({map:gT,roughness:1}),0,0,0,false); gr.rotation.x=-Math.PI/2; gr.receiveShadow=true; scene.add(gr);
    // sandbox, slide, swings, a school behind
    const wood=mat(0xb07a4a,{roughness:.8}), red=mat(0xd83a2a,{roughness:.5}), blue=mat(0x2a6ad8,{roughness:.5}), yel=mat(0xf0c030,{roughness:.5}), metal=mat(0x9aa4aa,{roughness:.3,metalness:.9});
    const sb=new THREE.Group(); sb.position.set(-5,0,-2); scene.add(sb); for(const [x,z,w,d] of [[0,-1.5,3.2,.2],[0,1.5,3.2,.2],[-1.5,0,.2,3.2],[1.5,0,.2,3.2]]) sb.add(box(w,.3,d,wood,x,.15,z)); const sand=box(2.9,.2,2.9,mat(0xe8d09a,{roughness:1}),0,.1,0); sb.add(sand);
    const sl=new THREE.Group(); sl.position.set(4.5,0,-4); sl.rotation.y=-.6; scene.add(sl); for(const x of [-.4,.4]){ sl.add(cyl(.05,.05,2.2,metal,x,1.1,-1,8)); } for(let i=0;i<6;i++) sl.add(cyl(.03,.03,.8,metal,0,.35+i*.35,-1,8)).children; sl.children.slice(-6).forEach(c=>c.rotation.z=Math.PI/2);
    sl.add(box(1,.1,1,red,0,2.2,-1)); const ramp=box(.8,.06,3.2,yel,0,1.15,.45); ramp.rotation.x=.72; sl.add(ramp);
    const sw=new THREE.Group(); sw.position.set(0,0,-8); scene.add(sw); for(const x of [-2,2]){ const a=cyl(.06,.06,2.8,blue,x,1.3,.5,8); a.rotation.x=.3; sw.add(a); const b=cyl(.06,.06,2.8,blue,x,1.3,-.5,8); b.rotation.x=-.3; sw.add(b); } const top=cyl(.06,.06,4.1,blue,0,2.62,0,8); top.rotation.z=Math.PI/2; sw.add(top);
    lv.swings=[]; for(const x of [-.9,.9]){ const s=new THREE.Group(); s.position.set(x,2.6,0); sw.add(s); s.add(cyl(.01,.01,2,metal,-.2,-1,0,4)); s.add(cyl(.01,.01,2,metal,.2,-1,0,4)); s.add(box(.5,.05,.2,red,0,-2,0)); lv.swings.push(s); }
    const sch=new THREE.Group(); sch.position.set(0,0,-26); scene.add(sch); sch.add(box(24,7,8,mat(0xb85a44,{roughness:.9}),0,3.5,0)); sch.add(box(24.5,.5,8.5,mat(0x5a4a44),0,7.2,0));
    for(let i=0;i<8;i++) for(const y of [2,5]) sch.add(box(1.6,1.4,.1,mat(0x9ad8f0,{roughness:.1,metalness:.3}),-10+i*2.85,y,4.02,false));
    sch.add(box(2,3,.1,mat(0x6a3a22),0,1.5,4.03,false));
    for(let i=-9;i<=9;i++){ scene.add(box(.08,1,.08,wood,i*2.2,.5,-18)); } scene.add(box(40,.08,.05,wood,0,.8,-18)); scene.add(box(40,.08,.05,wood,0,.4,-18));
    makeTrees(scene,[{x:-12,z:-12,h:6,r:.25,cr:2.6},{x:13,z:-10,h:7,r:.3,cr:3},{x:-16,z:4,h:6.5,r:.28,cr:2.8},{x:15,z:6,h:5.5,r:.25,cr:2.4},{x:-8,z:-20,h:7,r:.3,cr:3}],{seed:12});
    // the kids (humans) and little Steve
    const kid=(o)=>{ const h=makeHuman(Object.assign({name:'Kid',voice:'Kid',sleeves:'short',build:.9,head:{rx:.08,ry:.1,rz:.09,jaw:.2,nose:.8}},o)); h.scale.setScalar(.62); h.userData.level='playground'; scene.add(h); return h; };
    lv.kids=[kid({skin:0xf0c8a8,shirt:0xd84a3a,pants:0x3a4a7a,hair:0xd8a040,hairStyle:'short',seed:3}),kid({skin:0x8a5a3a,shirt:0x3ab85a,pants:0x2a2a3a,hair:0x1a1010,hairStyle:'spiky',seed:8}),kid({skin:0xe8b890,shirt:0x4a7ad8,pants:0x5a3a2a,hair:0x6a3a1a,hairStyle:'long',seed:13})];
    lv.kidSteve=makeSteve({name:'Kid Steve'}); lv.kidSteve.scale.setScalar(.56); lv.kidSteve.userData.level='playground'; scene.add(lv.kidSteve);
    lv.ball=sph(.12,mat(0xe84a8a,{roughness:.4}),0,.12,0,16,12); scene.add(lv.ball);
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){ const lv=this; lv.swings.forEach((s,i)=>s.rotation.x=Math.sin(t*1.4+i*2)*.3*(i?1:.5));
    if(lv.catch){ const K=lv.kids; const n=Math.floor(t/1.1)%3, k=(t%1.1)/1.1; const a=K[n].position, b=K[(n+1)%3].position; lv.ball.position.set(lerp(a.x,b.x,k),.75+Math.sin(k*Math.PI)*1.6,lerp(a.z,b.z,k)); } }
});

/* ================= B9: STEVE'S SHIP ================= */
function shipSeat(lv){ PLAYER.pos.set(0,0,1.2); PLAYER.eye=1.16; PLAYER.yaw=0; PLAYER.pitch=-.05; lv.armL.visible=lv.armR.visible=true; }
CHECKPOINTS.B9=async()=>{
  const lv=await enterLevel('ship',{pos:V3(0,0,1.2),yaw:0});
  setCheckpoint('B9'); const F=F_(); F.day=3;
  PLAYER.lock(); crosshair(false); setVM(false); PLAYER.hasWatch=true; PLAYER.stitched=true; shipSeat(lv);
  hudVisible(true); showCash(false); showCoins(false); objective(null);
  // reset the ship
  const st=lv.steve; st.visible=true; st.position.set(.1,0,-.55); st.rotation.y=0; st.userData.A.look='player'; setMood(st,'evil'); clearPose(st,0);
  lv.door.open=lv.door.target=0; lv.sideDoor.open=lv.sideDoor.target=0; lv.alex.visible=true; lv.ringing=false; lv.icOn=false; lv.cuffs.forEach((c,i)=>{ c.visible=true; c.position.set(i?.34:-.34,.7,.98); c.rotation.set(0,0,0); });
  lv.rat.visible=true; lv.rat.position.set(2.55,0,-2.45); lv.rat.rotation.y=-.6; lv.rat.userData.chew=1;
  lv.block.visible=true; lv.blockPivot.rotation.set(0,0,0); lv.blockPivot.position.set(lv.blockPos.x,.95,lv.blockPos.z); lv.xxx.visible=false; FX.pixel=0;
  for(const e of lv.eatables){ e.o.visible=true; e.o.scale.setScalar(1); e.c.r=Math.abs(e.c.r); }
  FX.blackout=1; fade(0,.2); playMusic('ship',2);
  await wait(1.4);
  // you open your eyes
  SFX.blink(); await tweenVal(k=>{ FX.blackout=1-k*.55; },.35); await tweenVal(k=>{ FX.blackout=.45+k*.55; },.2); await wait(.3);
  SFX.gasp(); await tweenVal(k=>{ FX.blackout=1-k; },1.1);
  await wait(.5);
  // your hands: cuffed to a metal chair
  lookAtPoint(V3(0,.7,.95),.9); await wait(1.1);
  for(let i=0;i<2;i++){ SFX.clank(); shake(.12); lv.cuffs.forEach(c=>c.position.y=.71); await wait(.12); lv.cuffs.forEach(c=>c.position.y=.7); await wait(.4); }
  lookAtPoint(V3(st.position.x,1.62,st.position.z),.7); await wait(.8);
  const S={h:st,who:'Steve'};
  await talk([{who:'You',text:"No, no, no... this can't be happening."},{...S,text:"But it is.",mood:'evil'},{who:'You',text:"Why do you want this? Wh—",auto:.2},{...S,text:"Because...",mood:'sad'}]);
  await steveFlashback();
  await talk([{...S,text:"So that's why I'm going to. And when I do...",mood:'angry'},{...S,text:"Every one of you humans is going to pay.",mood:'evil',pose:'hips'}]);
  // the intercom
  lv.icOn=true; SFX.radioOn(); await wait(.6);
  st.userData.A.look=null; facePoint(st,V3(1.4,0,-3.86));
  await talk([{who:'Alex',voice:'Alex',radio:true,text:"Steve, I need help with the place Earth will be."}]);
  lv.icOn=false; st.userData.A.look='player';
  await talk([{...S,text:"When I get back... I'm cutting the hand off you.",mood:'evil',pose:'point'}]);
  clearPose(st);
  // he opens the door and leaves
  walkTo(st,[V3(0,0,-3.2)],1.3); await wait(1.6);
  lv.door.target=1; sfxAt(V3(0,1.2,-4),()=>SFX.hydraulic(),2); await wait(.8);
  walkTo(st,[V3(0,0,-5.6),V3(0,0,-7.5)],1.4); await wait(1.2);
  lv.door.target=0; sfxAt(V3(0,1.2,-4),()=>SFX.hydraulic(),2); await wait(1.2);
  lv.sideDoor.target=1; sfxAt(V3(1.3,1.2,-7.5),()=>SFX.hydraulic(),2); walkTo(st,[V3(3.2,0,-7.5)],1.4); await wait(1.8);
  lv.sideDoor.target=0; sfxAt(V3(1.3,1.2,-7.5),()=>SFX.hydraulic(),2); await wait(.6);
  await wait(1.2);
  // Jim calls
  lv.ringing=true; runStory(async()=>{ while(lv.ringing){ sfxAt(V3(-.34,.75,.95),()=>SFX.ring(),1.5); await wait(1.1); } });
  lookAtPoint(V3(-.3,.72,.92),.7);
  say("Jim calls you on your watch. Yes, he put a calling thing on it.",4.4);
  await wait(1.4);
  objective("Answer the call");
  if(!lv.callSetup){ lv.callSetup=true;
    addInteract(lv,{obj:lv.armL,offset:V3(0,.05,-.18),label:'Answer Jim',reach:3,aim:false,when:()=>!!lv.ringing,act:()=>runStory(answerJim)});
    addInteract(lv,{pos:V3(1,1.2,-7.5),label:'Locked door',reach:1.8,when:()=>!!F_().freed&&!F_().knocked,act:()=>{ const F=F_(); if(!F.eaves){ SFX.cantCarry(); bark('You',"It's locked. I can hear Steve and Alex talking in there.",null,3.4); F.eaves=true; unlock('eavesdrop'); return; } F.knocks=(F.knocks||0)+1; SFX.knock&&SFX.knock(); shake(.05); if(F.knocks>=5) runStory(steveWins); }});
    addInteract(lv,{obj:lv.rat,offset:V3(0,.2,0),label:'Call the rat',reach:5,when:()=>!!F_().ratCall&&!F_().freed&&!lv.ratMoving,act:()=>runStory(callRat)});
    addTrigger(lv,{pos:V3(0,0,-15.5),r:3.2,once:true,when:()=>!!F_().freed,fn:()=>{ say("You see a purple block. It says DON'T TOUCH. EXTREMELY DANGEROUS.",4.2); later(4.4,()=>{ if(!F_().knocked) say("But you don't think much of it.",3); }); }});
    addTrigger(lv,{pos:V3(0,0,-19.4),r:1.6,box:[2.6,.8],once:true,when:()=>!!F_().freed&&!F_().knocked,fn:()=>runStory(knockOver)});
    addTrigger(lv,{pos:V3(0,0,-21.5),r:1.1,box:[1.2,.6],once:true,when:()=>!!F_().xxxAwake,fn:()=>runStory(shipEscape)});
  }
  PLAYER.ctl.look=true; PLAYER.ctl.interact=true; PLAYER.ctl.move=false;
};
async function steveFlashback(){
  const ship=LEVELS.ship; PLAYER.lock(); SFX.memHit&&SFX.memHit();
  flashWhite(.9,.8); await fade(1,.35);
  const lv=await enterLevel('playground',{pos:V3(0,0,14),yaw:0});
  const K=lv.kids, ks=lv.kidSteve;
  K[0].position.set(-1.6,0,-.6); K[1].position.set(1.4,0,-1); K[2].position.set(0,0,1.3);
  K.forEach(k=>{ k.visible=true; k.userData.A.path=null; clearPose(k,0); setMood(k,'happy'); k.userData.A.look=null; facePoint(k,V3(0,0,0)); });
  lv.catch=true; lv.ball.visible=true;
  ks.visible=true; ks.position.set(7,0,4); ks.rotation.y=-Math.PI/2; clearPose(ks,0); setMood(ks,'happy'); ks.userData.A.look=null;
  letterbox(true);
  camFollow((t)=>({pos:V3(5+t*.12,1.5,9),look:V3(1,.7,0)}),42);
  await fade(0,.7);
  const S={who:'Steve'};
  await talk([{...S,text:"When I was a kid... I always wanted to play with the kids. You humans."}]);
  // little Steve walks up to them and waves
  walkTo(ks,[V3(2.6,0,1.4)],1.1); await wait(3);
  facePoint(ks,K[1].position); setPose(ks,'wave'); await wait(1.4); clearPose(ks);
  lv.catch=false; runStory(async()=>{ const p0=lv.ball.position.clone(); await tweenVal(k=>lv.ball.position.set(lerp(p0.x,K[1].position.x+.2,k),lerp(p0.y,.62,k),lerp(p0.z,K[1].position.z+.3,k)),.4); });
  K.forEach(k=>{ facePoint(k,ks.position); k.userData.A.look=null; setMood(k,'angry'); });
  camShot(V3(4.6,.9,3.4),V3(2,.55,1),{dur:.8,fov:40});
  await wait(1);
  // one of them pushes him
  walkTo(K[1],[V3(2.05,0,1.05)],1.4); await wait(.8);
  setPose(K[1],'push',.12); SFX.whoosh(.4); await wait(.15);
  SFX.thud(); setPose(ks,'sitGround',.2); setMood(ks,'sad');
  await tweenVal(k=>{ ks.position.x=lerp(2.6,3.2,k); ks.position.z=lerp(1.4,1.8,k); },.35);
  await wait(.4); clearPose(K[1]);
  await talk([{who:'Kid',h:K[1],text:"Loser!",mood:'angry'},{who:'Kid',h:K[0],text:"Loser!",mood:'happy',pose:'laugh'},{who:'Kid',h:K[2],text:"Ha ha! Loser!",mood:'happy',pose:'laugh'}]);
  K.forEach((k,i)=>{ clearPose(k); walkTo(k,[V3(-3-i*1.5,0,-6-i),V3(-6-i*2,0,-14)],1.5); });
  camFollow((t)=>({pos:V3(4.3-t*.05,.85,3.6),look:V3(3.1,.35,1.8)}),36);
  await wait(1.4);
  await talk([{...S,text:"But you guys just pushed me away. And called me a loser."}]);
  await wait(.6);
  // back to the ship
  flashWhite(.8,.7); await fade(1,.35); letterbox(false); camRelease(0);
  await enterLevel('ship',{pos:V3(0,0,1.2),yaw:0},{keepMusic:false});
  shipSeat(ship); lookAtPoint(V3(ship.steve.position.x,1.62,ship.steve.position.z),0); PLAYER.lock();
  await fade(0,.6);
}
async function answerJim(){
  const lv=LEVELS.ship, F=F_(); if(!lv.ringing) return; lv.ringing=false; PLAYER.lock(); objective(null);
  SFX.radioOn(); lv.armL.userData.scr.material.color.set(0x6dffd8).multiplyScalar(4);
  const J={who:'Jim',radio:true};
  await talk([{...J,text:"Jay! Where are you?"},{who:'You',text:"Jim, I'm stuck in this alien ship. Steve got me."},{...J,text:"Ok. I will find you. Ok? Just don't let him get that watch."},{who:'You',text:"Ok."}]);
  SFX.radioOff(); lv.armL.userData.scr.material.color.set(0x6dffd8).multiplyScalar(2.5);
  await wait(.8);
  // the rat
  lookAtPoint(lv.rat.position.clone().add(V3(0,.15,0)),1); await wait(1.1);
  for(let i=0;i<3;i++){ sfxAt(lv.rat.position,()=>SFX.metalBite(),1.5); await wait(.35); }
  say('You see a rat. It just ate metal.',3.4); await wait(3.4);
  lookAtPoint(V3(0,.7,.97),.8); await wait(.9);
  say('And the thing that has you tied up is made out of metal.',3.8); await wait(3.6);
  lookAtPoint(lv.rat.position.clone().add(V3(0,.15,0)),.8); await wait(.8);
  F.ratCall=true; F.ratSteps=0; objective("Get the rat's attention");
  PLAYER.ctl.look=true; PLAYER.ctl.interact=true;
}
async function callRat(){
  const lv=LEVELS.ship, F=F_(); if(lv.ratMoving||F.freed) return;
  const lines=["Psst! Here, rat!","Hey! Over here, little guy!","Come on! Come here!"];
  bark('You',lines[Math.min(F.ratSteps,lines.length-1)],null,2); SFX.tap();
  const r=lv.rat; r.userData.chew=0;
  const path=[V3(1.7,0,-1.3),V3(1,0,-.1),V3(.5,0,.62)];
  if(F.ratSteps>=path.length){ return; }
  lv.ratMoving=true; await wait(.5);
  const p0=r.position.clone(), p1=path[F.ratSteps]; r.rotation.y=Math.atan2(p1.x-p0.x,p1.z-p0.z);
  sfxAt(r.position,()=>SFX.squirm(),1.5);
  await tweenVal(k=>{ r.position.lerpVectors(p0,p1,k); },.9,x=>x);
  lv.ratMoving=false; F.ratSteps++;
  r.rotation.y=Math.atan2(-r.position.x,1.2-r.position.z);
  if(F.ratSteps>=path.length) await ratFree();
}
async function ratFree(){
  const lv=LEVELS.ship, F=F_(), r=lv.rat; PLAYER.lock(); objective(null);
  letterbox(true);
  camShot(V3(.9,1.05,.35),V3(.2,.72,.98),{dur:.8,fov:40});
  // up the chair leg onto your right hand's armrest
  const cuffAt=i=>V3(i?.34:-.34,.745,.93);
  const climb=async(to)=>{ const p0=r.position.clone(); lv.ratMoving=true; await tweenVal(k=>{ r.position.lerpVectors(p0,to,k); r.position.y+=Math.sin(k*Math.PI)*.12; },.8); lv.ratMoving=false; };
  await climb(V3(.45,.3,.9)); await climb(cuffAt(1).add(V3(.02,0,-.12)));
  r.rotation.y=Math.PI; r.userData.chew=1;
  const bite=async(i)=>{ for(let k=0;k<4;k++){ sfxAt(lv.cuffs[i].position,()=>SFX.metalBite(),1); lv.glow.burst(lv.cuffs[i].position.clone().add(V3(0,.02,0)),{color:0xffd080,count:6,speed:1.2,size:.015,life:.4,grav:-6}); await wait(.32); }
    SFX.clank(); const c=lv.cuffs[i]; const p0=c.position.clone(); await tweenVal(k=>{ c.position.set(p0.x+(i?.12:-.12)*k,p0.y-(k*k)*.68,p0.z); c.rotation.z=k*2*(i?1:-1); },.45,x=>x); sfxAt(c.position,()=>SFX.clank(),1); };
  await bite(1);
  camShot(V3(-.85,1.05,.4),V3(-.2,.72,.98),{dur:.9,fov:40});
  const p0=r.position.clone(); lv.ratMoving=true; r.rotation.y=-Math.PI/2; await tweenVal(k=>{ r.position.set(lerp(p0.x,-.32,k),.745+Math.sin(k*Math.PI)*.1,lerp(p0.z,.81,k)); },1); lv.ratMoving=false; r.rotation.y=Math.PI;
  await bite(0);
  unlock('ratFriend'); F.freed=true;
  // it hops down and scurries back to its hole
  runStory(async()=>{ const q0=r.position.clone(); lv.ratMoving=true; await tweenVal(k=>{ r.position.set(lerp(q0.x,-.6,k),lerp(q0.y,0,k)+Math.sin(k*Math.PI)*.15,lerp(q0.z,.5,k)); },.5); const q1=r.position.clone(); r.rotation.y=Math.atan2(3.8-q1.x,-2.2-q1.z); await tweenVal(k=>{ r.position.lerpVectors(q1,V3(3.8,0,-2.2),k); },1.6,x=>x); r.visible=false; lv.ratMoving=false; });
  camRelease(.6); letterbox(false); await wait(.7);
  say('It bites through the metal. You can move!',3.6);
  lv.armL.visible=lv.armR.visible=false; setVM(true); crosshair(true); VM.forceShow=true; PLAYER.watchLook=1; await wait(1.2); PLAYER.watchLook=0; VM.forceShow=false;
  await tweenVal(k=>{ PLAYER.eye=lerp(1.16,1.64,k); PLAYER.pos.z=lerp(1.2,.55,k); PLAYER.pitch=lerp(PLAYER.pitch,0,k); },1);
  objective('Find a way out'); PLAYER.free();
}
async function knockOver(){
  const lv=LEVELS.ship, F=F_(), st=lv.steve; if(F.knocked) return; PLAYER.lock(); objective(null);
  // the control room door hisses open behind you... footsteps...
  sfxAt(V3(1.3,1.2,-7.5),()=>SFX.hydraulic(),3); lv.sideDoor.target=1; await wait(.6);
  const pp=PLAYER.pos.clone();
  for(let i=0;i<3;i++){ sfxAt(V3(pp.x,0,pp.z+3-i*.5),()=>SFX.step('metal',1.2),2); await wait(.22); }
  // Steve is right behind you
  st.visible=true; st.userData.A.path=null;
  st.position.set(pp.x-.2,0,pp.z+1.3); st.rotation.y=Math.PI; st.userData.A.look='player'; setMood(st,'angry'); setPose(st,'point',0);
  SFX.gasp(); bark('Steve','Hey!',st,1.6);
  lookAtPoint(V3(st.position.x,1.62,st.position.z),.25); await wait(.28);
  shake(.6); SFX.heartbeat(1.4); PLAYER.fovKick=-10; VM.handsLook=1;
  // you stumble back: one, two... right into the pedestal
  const bp=lv.blockPos; const to=V3(bp.x-.5,0,bp.z-.45);
  for(let s2=0;s2<2;s2++){ const a=PLAYER.pos.clone(), b=a.clone().lerp(to,s2?1:.5); await tweenVal(k=>{ PLAYER.pos.lerpVectors(a,b,k); PLAYER.roll=Math.sin(k*Math.PI)*(s2?-.1:.1); PLAYER.eye=1.64-Math.sin(k*Math.PI)*.08; },.22); SFX.step('metal',1.3); }
  VM.handsLook=0;
  SFX.thud(); shake(.4); PLAYER.pitch=-.1; F.knocked=true; unlock('idiot');
  // slow motion: the block rocks on the pedestal... and tips
  letterbox(true); const pv=lv.blockPivot;
  camShot(V3(bp.x+2.2,.9,bp.z+1.8),V3(bp.x,.9,bp.z),{dur:.3,fov:40});
  playMusic(null,.3); SFX.heartbeat(1.5);
  await tweenVal(k=>{ pv.rotation.z=Math.sin(k*Math.PI*3)*.18*(1-k*.3); },1.1,x=>x);
  await tweenVal(k=>{ pv.rotation.z=k*k*1.7; pv.position.x=bp.x+k*.4; pv.position.y=.95-k*k*.66; },1.1,x=>x);
  SFX.clank(); SFX.thud(); shake(.35); lv.glow.burst(V3(bp.x+.4,.2,bp.z),{color:0xc86aff,count:60,speed:2.5,size:.05,life:.9,grav:-3});
  await tweenVal(k=>{ pv.position.y=.29+Math.sin(k*Math.PI)*.12; pv.rotation.z=1.7-Math.sin(k*Math.PI)*.2; },.35);
  // it cracks... purple light leaks out
  for(let i=0;i<3;i++){ SFX.metalBite(); lv.blockLight.intensity=3+i*2; lv.blockLight.position.set(bp.x+.4,.4,bp.z); lv.glow.burst(V3(bp.x+.4,.35,bp.z),{color:0xe08aff,count:20,speed:1.5,size:.04,life:.6,grav:-1}); shake(.1); await wait(.45); }
  camRelease(.4); letterbox(false);
  { const a=PLAYER.pos.clone(), b=V3(bp.x-1.7,0,bp.z-1.9); await tweenVal(k=>PLAYER.pos.lerpVectors(a,b,k),.3); }
  // intense music, its eyes glow purple
  playMusic('xxx5',.2);
  const X=lv.xxx; X.position.set(bp.x+.55,.5,bp.z); X.rotation.y=Math.atan2(PLAYER.pos.x-X.position.x,PLAYER.pos.z-X.position.z); X.scale.setScalar(.25);
  lookAtPoint(V3(bp.x+.4,.3,bp.z),.4);
  SFX.xxxRoar(); shake(.6); lv.block.visible=false; X.visible=true; F.xxxAwake=true;
  await tweenVal(k=>{ X.scale.setScalar(lerp(.25,.7,k)); X.position.y=lerp(.5,1.2,k); },1.3);
  // everything starts turning blocky... and then normal. Again and again.
  runStory(async()=>{ while(F_().xxxAwake && LV===lv){ FX.pixel=rand(10,16); SFX.blockGlitch(); shake(.08); await wait(rand(.55,.9)); FX.pixel=0; await wait(rand(.5,1.1)); } FX.pixel=0; });
  // it starts eating stuff
  runStory(async()=>{ for(const e of lv.eatables.slice().sort((a,b)=>a.o.position.distanceTo(X.position)-b.o.position.distanceTo(X.position))){ if(!F_().xxxAwake||LV!==lv) break; await eatThing(lv,X,e); await wait(rand(.3,.8)); } });
  await wait(1.6);
  lookAtPoint(V3(st.position.x,1.62,st.position.z),.4); setPose(st,'startle',.2); setMood(st,'angry');
  await talk([{h:st,who:'Steve',text:"YOU IDIOT! What have you done!",mood:'angry',pose:'startle'}]);
  clearPose(st); walkTo(st,[V3(-2.5,0,-15),V3(-.5,0,-12),V3(0,0,-8)],2.2);
  objective('Get to the exit!'); PLAYER.free();
}
async function eatThing(lv,X,e){
  const o=e.o; e.c.r=-Math.abs(e.c.r); // no more collision
  const p0=o.position.clone(), s0=o.scale.x; const mouth=()=>X.userData.heads[0].H.getWorldPosition(new THREE.Vector3()).add(V3(0,-.2,0));
  await tweenVal(k=>{ const m=mouth(); o.position.lerpVectors(p0,m,k*k); o.position.y+=Math.sin(k*Math.PI)*.8; o.rotation.x+=.2; o.rotation.z+=.15; o.scale.setScalar(s0*(1-k*.8)); },.9,x=>x);
  o.visible=false; sfxAt(X.position,()=>SFX.crunch(),3); shake(.12);
  const s=X.scale.x; await tweenVal(k=>X.scale.setScalar(s+.1*k),.3);
}
async function shipEscape(){
  const lv=LEVELS.ship, F=F_(); PLAYER.lock(); objective(null);
  SFX.whoosh(1); await tweenVal(k=>{ FX.whiteout=k; },.7);
  F.xxxAwake=false; FX.pixel=0;
  startFromCheckpointInner('B10');
}

