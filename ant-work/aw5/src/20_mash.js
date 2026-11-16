/* ================================================================
   THE MASH — the watch broke reality. Pieces of every place you've been,
   stitched together wrong: the AW1 desert, Nivalis ice, the Dry Gulch
   street, the pig king's table, the twisted house. Glowing seams. Half
   the sky is day, half is night. Time is broken in spots:
   RED = it rewinds you. And the falling rocks are stuck in a loop...
   press T (your watch) to FREEZE time and climb them to the tear.
   ================================================================ */
const MASH={rocks:{x:0,z:-149,n:16}, tear:V3(0,13.2,-174), lab:{z:-80}, rewinds:[[-6,-112],[5,-118],[-2,-126],[8,-104],[-9,-124]]};
function iceTex5(){ return canvasTex(512,512,(c,w,h)=>{ c.fillStyle='#bcd8ec'; c.fillRect(0,0,w,h); for(let i=0;i<70;i++){ c.strokeStyle='rgba(255,255,255,'+(Math.random()*.5)+')'; c.lineWidth=Math.random()*2; c.beginPath(); const x=Math.random()*w,y=Math.random()*h; c.moveTo(x,y); c.lineTo(x+rand(-120,120),y+rand(-120,120)); c.stroke(); } },[6,6]); }
defineLevel('mash',{
  title:'???',
  env:{fx:{exposure:.93,saturation:1.05,contrast:1.1,temp:0,bloomStrength:.55,bloomThreshold:.9,aoRadius:.6,vignette:.45,grain:.05,aberr:.004},music:null,reverb:.5,surface:'sand',far:900,speed:3.4,jump:6},
  async build(scene,lv){ lv.occluders=[]; lv.glitchers=[];
    // the sky: split (a day half and a night half)
    const sky=new THREE.Mesh(new THREE.SphereGeometry(800,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{t:{value:0}},
      vertexShader:'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader:'varying vec3 vP; uniform float t; void main(){ float s=smoothstep(-.06,.06,vP.x+sin(vP.y*9.+t*.4)*.03); vec3 day=mix(vec3(.95,.85,.7),vec3(.3,.55,.9),clamp(vP.y*1.6,0.,1.)); vec3 night=mix(vec3(.08,.06,.16),vec3(.01,.01,.04),clamp(vP.y*1.6,0.,1.)); float seam=exp(-abs(vP.x+sin(vP.y*9.+t*.4)*.03)*120.); gl_FragColor=vec4(mix(night,day,s)+vec3(.9,.4,1.)*seam*1.5,1.); }'}));
    scene.add(sky); lv.sky=sky; const st=makeStars(2000,700); st.position.x=-200; scene.add(st);
    lv.rig=makeRig(scene,{sun:2.2,sunColor:0xfff0d8,hemi:.65,sky:0xb8c8f0,ground:0x9a8060,dir:V3(.6,.7,.2),span:60,dist:200,far:420});
    scene.fog=new THREE.FogExp2(col(0x8a7a90),.006);
    // the patches (40 x 40 m), each from a different place, at slightly different heights
    const it=iceTex5(); const patchMat={
      sand:()=>{ const m=pbrMat('desert_sand',4,{w:40,h:40,opts:{roughness:1}}); m.color=col(0xc9b08c); return m; },   /* it was blowing out white */
      ice:()=>new THREE.MeshPhysicalMaterial({color:col(0xd8ecf8),map:it,roughness:.12,clearcoat:1}),
      street:()=>{ const m=pbrMat('dry_ground_01',6,{w:40,h:40,opts:{roughness:1}}); m.color=col(0xc8a880); return m; },
      table:()=>{ const m=pbrMat('rough_wood',8,{w:40,h:40,opts:{roughness:.8}}); m.color=col(0x9a7452); return m; },
      planks:()=>{ const m=pbrMat('brown_planks_03',6,{w:40,h:40,opts:{roughness:.85}}); return m; } };
    const kinds=['sand','ice','street','table','planks']; lv.patchH={};
    const seamM=new THREE.MeshStandardMaterial({color:col(0x2a0a3a),emissive:col(0xc060ff),emissiveIntensity:2.4});
    for(let gx=-2;gx<=1;gx++) for(let gz=-5;gz<=1;gz++){ const k=kinds[((gx*7+gz*3)%5+5)%5], x=gx*40+20, z=gz*40, h=((gx*13+gz*7)%3)*.0+((gx+gz)%2?0:.06);
      const p=mesh(new THREE.PlaneGeometry(40,40),patchMat[k](),x,h,z,false); p.rotation.x=-Math.PI/2; p.receiveShadow=true; withAO(p.geometry); scene.add(p); lv.patchH[gx+','+gz]={h,k};
      scene.add(box(40,.08,.25,seamM,x,h+.02,z-20)); scene.add(box(.25,.08,40,seamM,x-20,h+.02,z)); }
    // pieces of places, stuck in the ground or floating
    const W=pbrMat('brown_planks_03',3,{w:12,h:8}); const facade=box(14,9,.5,W,-28,4.5,-30); facade.rotation.set(0,.4,.25); scene.add(facade); lv.occluders.push(facade); lv.glitchers.push(facade);
    const fsign=mesh(new THREE.PlaneGeometry(6,1.4),new THREE.MeshStandardMaterial({map:canvasTex(512,110,(c,w,h)=>{ c.fillStyle='#d9c49a'; c.fillRect(0,0,w,h); c.fillStyle='#3a1e0e'; c.font='bold 70px Georgia'; c.textAlign='center'; c.fillText('SALOON',w/2,80); })}),0,3,.3,false); facade.add(fsign);
    const spoonM=new THREE.MeshPhysicalMaterial({color:col(0xc8ccd0),metalness:1,roughness:.2}); const spoon=new THREE.Group(); spoon.add(box(1.2,.3,26,spoonM,0,0,0)); spoon.add(ell(4,1.2,6,spoonM,0,.4,15)); spoon.position.set(26,6,-40); spoon.rotation.set(.5,-.7,.3); scene.add(spoon); lv.glitchers.push(spoon);
    const iceM=new THREE.MeshPhysicalMaterial({color:col(0x9ac8e8),roughness:.1,transmission:.3,thickness:2,clearcoat:1}); for(let i=0;i<5;i++){ const sp=mesh(new THREE.ConeGeometry(rand(1,2.4),rand(5,11),6),iceM,rand(-40,-20),2,rand(-140,-20)); sp.rotation.z=rand(-.3,.3); scene.add(sp); }
    const pyr=mesh(new THREE.ConeGeometry(30,26,4),pbrMat('desert_sand',8,{w:60,h:60}),80,40,-300); pyr.rotation.set(Math.PI,0,.2); scene.add(pyr); lv.glitchers.push(pyr);   // the pyramid, upside down in the sky
    const houseWall=box(.6,16,30,new THREE.MeshStandardMaterial({color:col(0xa8b896),roughness:.95}),36,8,-100); houseWall.rotation.z=.15; scene.add(houseWall); lv.glitchers.push(houseWall);
    const floaters=['rock_07','moon_rock_01','wooden_crate_02','barrel_03','dining_chair_02','old_military_crate','metal_tool_chest'];
    for(let i=0;i<18;i++){ const nm=floaters[i%floaters.length]; const c=MODELS[nm]?fitProp(nm,rand(1.2,3.6)):box(rand(1,4),rand(1,4),rand(1,4),[W,iceM,spoonM][i%3],0,0,0); c.position.set(rand(-60,60),rand(8,40),rand(-220,20)); c.rotation.set(rand(0,6),rand(0,6),rand(0,6)); c.userData.spin=V3(rand(-.3,.3),rand(-.3,.3),rand(-.3,.3)); scene.add(c); lv.glitchers.push(c); }   /* real things torn out of real places */
    // Steve + Alex's ice lab (a chunk of it), the cover crates, their console
    /* a chunk of their ice lab: blue plated walls with steel pillars + a top rail, hanging lamps, real crates/carts/racks as cover, a real desk with a live screen */
    const labM=pbrMat('blue_metal_plate',2,{opts:{roughness:.55,metalness:.6}}); labM.color=col(0xb8c8d8);
    const steel=new THREE.MeshPhysicalMaterial({color:col(0x6a727c),metalness:1,roughness:.35,clearcoat:.3});
    const frost=new THREE.MeshPhysicalMaterial({color:col(0xe8f4ff),roughness:.15,transmission:.3,transparent:true,opacity:.55,clearcoat:1});
    for(const [x,z,w,d] of [[-14,-80,.6,22],[14,-80,.6,22]]){ const o=box(w,6,d,labM,x,3,z); scene.add(o); lv.occluders.push(o); colBoxC(lv.col,x,z,w,d);
      for(let k=-2;k<=2;k++){ scene.add(box(.5,6.2,.5,steel,x,3.1,z+k*5.4)); }                 // pillars
      scene.add(box(w+.25,.35,d+.3,steel,x,6.1,z)); scene.add(box(w+.3,.2,d+.3,steel,x,.1,z));   // top rail + kick plate
      for(let k=0;k<5;k++){ const ic=mesh(new THREE.ConeGeometry(rand(.06,.16),rand(.4,1.2),6),frost,x+(x<0?.42:-.42),5.7-rand(0,.3),z+rand(-10,10)); ic.rotation.x=Math.PI; scene.add(ic); } }   // icicles off the rail
    for(const z of [-72,-86]){ const lamp=fitProp('hanging_industrial_lamp',1.1); lamp.position.set(0,5.4,z); scene.add(lamp); const L=new THREE.PointLight(col(0xd8ecff),1.6,18,1.6); L.position.set(0,4.9,z); scene.add(L); }
    const coverM=['old_military_crate','metal_tool_chest','industrial_storage_cart','portable_generator','worn_metal_rack','barrel_03'];
    lv.cover=[]; [[-8,-70],[-3,-76],[6,-72],[-6,-86],[3,-90],[9,-84]].forEach(([x,z],i)=>{ const hit=box(2.2,1.6,2.2,labM,x,.8,z); hit.visible=false; scene.add(hit); lv.occluders.push(hit); colBoxC(lv.col,x,z,2.2,2.2); lv.cover.push(hit);
      const pr=fitProp(coverM[i],2.2,1.65); pr.position.set(x,0,z); pr.rotation.y=rand(-.4,.4)+(i%2?Math.PI/2:0); scene.add(pr); });
    lv.console=fitProp('metal_office_desk',3.0,1.2); lv.console.position.set(0,0,-96); scene.add(lv.console); colBoxC(lv.col,0,-96,3,1);
    { const scr=mesh(new THREE.PlaneGeometry(1.1,.62),new THREE.MeshBasicMaterial({map:canvasTex(512,288,(c,w,h)=>{ c.fillStyle='#04121e'; c.fillRect(0,0,w,h); c.strokeStyle='#3ac8ff'; c.lineWidth=2; for(let k=0;k<5;k++){ c.beginPath(); for(let x=0;x<w;x+=6){ const y=h*(.2+k*.15)+Math.sin(x*.05+k*2)*10*Math.random(); x?c.lineTo(x,y):c.moveTo(x,y); } c.stroke(); } c.fillStyle='#7ae8ff'; c.font='bold 22px monospace'; c.fillText('TRACK: WATCH  ▮ SIGNAL LOST',14,30); c.fillText('REALITY INDEX  0.42',14,270); })}),0,1.25,-95.8,false); scene.add(scr);
      const sl=fitProp('portable_searchlight',1.1); sl.position.set(-1.6,0,-95); sl.rotation.y=Math.PI; scene.add(sl); }
    // the stuck rocks (a time loop) on the way up the cliff, and the tear
    const R=MASH.rocks, rockM=pbrMat('cliff_side',2,{w:3,h:3}); rockM.color=col(0x9a8a7a); lv.rocks=[];
    for(let i=0;i<R.n;i++){ const r=mesh(new THREE.DodecahedronGeometry(1.15,1),rockM,R.x+Math.sin(i*1.3)*1.2,0,R.z-i*1.65); r.scale.set(1.1,.55,1.1); r.castShadow=true; scene.add(r); lv.rocks.push({o:r,base:.7+i*.8,ph:i*.7}); }
    const cliff=box(60,13,8,rockM,0,6.5,-178); scene.add(cliff); colBox(lv.col,-30,30,-182,-174.6);
    lv.tear=mesh(new THREE.PlaneGeometry(2.4,4,10,14),new THREE.MeshBasicMaterial({color:col(0xffffff),side:THREE.DoubleSide}),MASH.tear.x,MASH.tear.y+1.6,MASH.tear.z+1); scene.add(lv.tear);
    { const a=lv.tear.geometry.attributes.position; for(let i=0;i<a.count;i++) a.setX(i,a.getX(i)*(.35+Math.abs(Math.sin(a.getY(i)*2.2))*.8)); }
    lv.tearL=new THREE.PointLight(col(0xffffff),3,20,1.5); lv.tearL.position.copy(MASH.tear).add(V3(0,1.5,3)); scene.add(lv.tearL);
    // the rewind spots (red shimmer columns)
    lv.rew=[]; const rm=new THREE.MeshBasicMaterial({color:col(0xff3040),transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}); for(const [x,z] of MASH.rewinds){ const c=mesh(new THREE.CylinderGeometry(2.2,2.2,7,24,1,true),rm,x,3.5,z,false); scene.add(c); lv.rew.push({o:c,x,z}); }
    lv.ground=(x,z)=>{ for(const r of lv.rocks){ const p=r.o.position; if(Math.hypot(x-p.x,z-p.z)<1.15) return p.y+.62; } if(z<-174.6&&z>-182&&Math.abs(x)<30) return 13; return 0; };
    lv.surfaceAt=(x,z)=>{ const gx=Math.floor((x+80)/40)-2, gz=Math.round(z/40); const p=lv.patchH[gx+','+gz]; return p?(p.k==='ice'?'stone':p.k==='sand'||p.k==='street'?'sand':'wood'):'sand'; };
    lv.col.bounds=[-75,75,-200,30];
  },
  enter(){ setAmbience([['wind',.05],['tinyHi',.01]]); },
  update(dt,t){ const lv=this; lv.sky.material.uniforms.t.value=t; if(typeof mashTick==='function') mashTick(lv,dt,t);
    for(const g of lv.glitchers) if(g.userData.spin) { g.rotation.x+=g.userData.spin.x*dt*(TIMEP.frozen?0:1); g.rotation.y+=g.userData.spin.y*dt*(TIMEP.frozen?0:1); }
    lv.tear.material.color.setHSL((t*.1)%1,.4,.85+Math.sin(t*6)*.1); }
});
