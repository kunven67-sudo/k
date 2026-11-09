/* ================================================================
   THE DREAM (Path B, night 2) — a dark, echoing version of your alien
   house floating in nothing. Steve is waiting at the end of it.
   ================================================================ */
defineLevel('dream',{
  title:'a bad dream',
  env:{fx:{exposure:1.0,saturation:.6,contrast:1.18,bloomStrength:.55,bloomThreshold:.9,vignette:.8,temp:-.18,aberr:.007,grain:.09,aoRadius:.5},music:'dream',reverb:.75,amb:[['spaceDrone',.05],['alienHome',.015]],surface:'tile',far:260,speed:2.3},
  async build(scene,lv){
    scene.background=col(0x06040a); scene.fog=new THREE.FogExp2(col(0x140a1e),.05); lv.fogBase=.05;
    lv.envMap=makeEnv({top:0x1a1030,horizon:0x100818,bottom:0x040208,lights:[{x:0,y:20,z:-20,w:6,h:6,c:0x9aff8a,k:2}]});
    const rig=makeRig(scene,{sun:.35,sunColor:0x9ab0ff,hemi:.22,sky:0x6a5aa0,ground:0x100818,dir:V3(.2,1,.4),span:30,dist:60,far:120});
    // glossy black floor with faint glowing hex seams that fade into the fog
    const seam=canvasTex(512,512,(x,w,h)=>{ x.fillStyle='#000'; x.fillRect(0,0,w,h); const r=40; x.strokeStyle='#8a6aff'; x.lineWidth=2.5; for(let j=-1;j<h/(r*1.5)+1;j++) for(let i=-1;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; x.beginPath(); for(let q=0;q<=6;q++){ const a=q/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.97,cy+Math.sin(a)*r*.97); } x.stroke(); } });
    seam.repeat.set(14,14);
    const floor=mesh(new THREE.CircleGeometry(70,64),new THREE.MeshPhysicalMaterial({color:col(0x0a0710),roughness:.12,metalness:.4,clearcoat:1,emissive:col(0xffffff),emissiveMap:seam,emissiveIntensity:.35}),0,0,0,false); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor); lv.floorM=floor.material;
    // a corridor of alien door arches leading to him
    const archM=new THREE.MeshPhysicalMaterial({color:col(0x3a2a5a),roughness:.3,clearcoat:1}), glowM=emissiveMat(0x8a6aff,1.6);
    lv.arches=[];
    for(let i=0;i<7;i++){ const z=4-i*4.6; const a=new THREE.Group(); a.position.set(Math.sin(i*1.3)*.4,0,z); a.rotation.z=Math.sin(i*2.1)*.08; scene.add(a);
      a.add(mesh(GC('dArch',()=>new THREE.TorusGeometry(2.1,.16,10,40,Math.PI)),archM,0,0,0)); a.add(mesh(GC('dArchG',()=>new THREE.TorusGeometry(2.1,.035,6,40,Math.PI)),glowM,0,0,.17,false));
      lv.arches.push({a,ph:i*.7}); for(const sd of [-1,1]) for(const dx of [2.1,1.75,1.42]) colCircle(lv.col,a.position.x+sd*dx,z,.22); }
    // pieces of your house, floating: the bed, the table, stools, hex floor tiles, a window
    const shellM=new THREE.MeshPhysicalMaterial({color:col(0xd8d0e8),roughness:.3,clearcoat:1}), purM=new THREE.MeshPhysicalMaterial({color:col(0x6a4ab8),roughness:.8});
    const hexM=new THREE.MeshPhysicalMaterial({color:col(0x2a1a40),roughness:.35,clearcoat:.6,emissive:col(0x1a0a3a)});
    lv.floaters=[];
    const add=(o,p,spin)=>{ o.position.copy(p); scene.add(o); lv.floaters.push({o,base:p.clone(),spin,ph:rand(0,6)}); };
    const bed=new THREE.Group(); bed.add(mesh(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),shellM,0,0,0)); bed.children[0].scale.set(1.1,.55,1.6); bed.add(mesh(new THREE.SphereGeometry(1,32,16),purM,0,0,0)); bed.children[1].scale.set(.95,.18,1.45); bed.rotation.set(.4,.8,.3);
    add(bed,V3(-5,4.5,-8),V3(.05,.08,.02));
    const tbl=new THREE.Group(); tbl.add(cyl(.15,.35,.8,archM,0,-.4,0,16)); tbl.add(mesh(new THREE.CylinderGeometry(1,.8,.12,32),new THREE.MeshPhysicalMaterial({color:col(0xa8e8e0),roughness:.1,clearcoat:1,transparent:true,opacity:.7}),0,.05,0)); tbl.rotation.set(-.5,0,.6);
    add(tbl,V3(5.5,3.2,-12),V3(-.06,.05,.04));
    for(let i=0;i<26;i++){ const t=mesh(GC('dHex',()=>new THREE.CylinderGeometry(1,1,.18,6)),hexM,0,0,0); t.scale.setScalar(rand(.5,1.4)); t.rotation.set(rand(0,3),rand(0,3),rand(0,3)); const a=rand(0,6.28), r=rand(5,18); add(t,V3(Math.cos(a)*r,rand(1.5,9),-12+Math.sin(a)*r),V3(rand(-.2,.2),rand(-.2,.2),rand(-.2,.2))); }
    for(let i=0;i<5;i++){ const st=new THREE.Group(); st.add(cyl(.28,.2,.5,archM,0,0,0,12)); st.add(mesh(new THREE.SphereGeometry(.32,16,8,0,Math.PI*2,0,Math.PI/2),purM,0,.25,0)); st.rotation.set(rand(0,3),rand(0,3),rand(0,3)); add(st,V3(rand(-8,8),rand(2,7),rand(-22,2)),V3(rand(-.3,.3),rand(-.3,.3),0)); }
    // Steve, waiting under a cold green light
    lv.steve=makeSteve(); lv.steve.userData.level='dream'; lv.steve.position.set(0,0,-27); scene.add(lv.steve);
    const spot=new THREE.SpotLight(col(0x9aff8a),6,16,.45,.6,1.5); spot.position.set(0,9,-26); spot.target.position.set(0,0,-27); scene.add(spot); scene.add(spot.target); lv.spot=spot;
    lv.steveLight=new THREE.PointLight(col(0x9aff8a),1.2,6,2); lv.steveLight.position.set(0,1.8,-25.6); scene.add(lv.steveLight);
    const pool=mesh(new THREE.CircleGeometry(2.4,40),basicGlow(0x5aff6a,.35),0,.02,-27,false); pool.rotation.x=-Math.PI/2; pool.material.transparent=true; pool.material.opacity=.35; scene.add(pool); lv.pool=pool;
    // a faint shaft of green light that shows through the dark from far away (it ignores the fog)
    { const g=new THREE.CylinderGeometry(.5,2.6,10,32,1,true); g.translate(0,5,0); const sh=mesh(g,new THREE.MeshBasicMaterial({color:col(0x6aff7a),transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}),0,0,-27,false); scene.add(sh); lv.shaft=sh; }
    lv.col.radius=34; lv.col.cx=0; lv.col.cz=-10;
    lv.moteT=0;
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){
    const lv=this;
    for(const f of lv.floaters){ f.o.rotation.x+=f.spin.x*dt; f.o.rotation.y+=f.spin.y*dt; f.o.rotation.z+=f.spin.z*dt; f.o.position.y=f.base.y+Math.sin(t*.5+f.ph)*.4; }
    for(const a of lv.arches){ a.a.children[1].material.emissiveIntensity=1+Math.sin(t*1.2+a.ph)*.8; }
    lv.floorM.emissiveIntensity=.25+Math.sin(t*.6)*.1;
    if(lv.spotOn) lv.spot.intensity=5+Math.sin(t*7)*.6+(Math.random()<.02?-3:0);
    if(lv.shaft){ lv.shaft.visible=!!lv.spotOn; lv.shaft.material.opacity=.06+Math.sin(t*1.3)*.015; }
    // the fog thins as you walk toward him, so he comes out of the dark
    if(lv.spotOn&&lv.steve.visible){ const d=Math.hypot(camera.position.x,camera.position.z+27); lv.scene.fog.density=lerp(.022,lv.fogBase,clamp((d-8)/30,0,1)); }
    // dust motes drifting up
    lv.moteT-=dt; if(lv.moteT<=0){ lv.moteT=.05; const p=camera.position; lv.glow.spawn(p.x+rand(-12,12),rand(0,1),p.z+rand(-16,4),rand(-.05,.05),rand(.2,.5),rand(-.05,.05),rand(4,7),rand(.03,.07),.7,.6,1,.5,0,-.02,1); }
  }
});

