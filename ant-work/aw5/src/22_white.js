/* ================================================================
   THE WHITE — nothing. No ground, no up or down: you FLY (WASD, Space
   up, C down). Glass boxes float here, and every box is a reality:
   the desert, Nivalis, Dry Gulch, Earth (Jim on vacation), space +
   time, and one thing a human should not see. BEYOND them: the god.
   ================================================================ */
const WHITE={boxes:[{id:'desert',p:V3(-30,4,-40)},{id:'nivalis',p:V3(30,10,-55)},{id:'gulch',p:V3(-42,18,-95)},{id:'beach',p:V3(36,-6,-100)},{id:'time',p:V3(0,26,-130)},{id:'thing',p:V3(-10,-14,-150)}],door:V3(0,4,-185),god:V3(0,30,-640),beyondAt:V3(0,0,-520)};
function glassBox(s){ const g=new THREE.Group(); const gm=new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:.02,metalness:0,transmission:.85,thickness:.4,transparent:true,opacity:.42,clearcoat:1,side:THREE.DoubleSide,depthWrite:false});
  g.add(mesh(new THREE.BoxGeometry(s,s,s),gm,0,0,0,false)); const em=new THREE.MeshBasicMaterial({color:col(0xc8d8e8)}); const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s,s,s)),new THREE.LineBasicMaterial({color:col(0x3a4a60)})); g.add(e); return g; }
defineLevel('white',{
  title:'???',
  env:{fx:{exposure:.9,saturation:1.05,contrast:1.1,temp:0,bloomStrength:.5,bloomThreshold:.95,aoRadius:.5,vignette:.25,grain:.03},music:null,reverb:.9,surface:'stone',far:1600,speed:5,fly:true},
  async build(scene,lv){ lv.occluders=[];
    scene.background=col(0xf2f2f4); scene.fog=new THREE.FogExp2(col(0xf2f2f4),.0028); lv.fogW=.0028;
    scene.add(new THREE.HemisphereLight(col(0xffffff),col(0xc8c8d0),.75)); const d=new THREE.DirectionalLight(col(0xffffff),.9); d.position.set(.3,1,.4); scene.add(d);
    lv.boxes={};
    for(const B of WHITE.boxes){ const S=B.id==='beach'?11:8; const g=glassBox(S); g.position.copy(B.p); scene.add(g); lv.boxes[B.id]=g; g.userData.S=S; const inner=new THREE.Group(); inner.position.y=-S/2+.05; g.add(inner);
      const floor=(m)=>{ const f=mesh(new THREE.PlaneGeometry(S-.1,S-.1),m,0,0,0,false); f.rotation.x=-Math.PI/2; inner.add(f); };
      if(B.id==='desert'){ floor(pbrMat('desert_sand',2,{w:8,h:8})); const p=mesh(new THREE.ConeGeometry(1.8,1.6,4),pbrMat('desert_sand',1,{}),1,.8,-1.5); p.rotation.y=Math.PI/4; inner.add(p); const L=new THREE.PointLight(col(0xffe0a0),2,10,1.5); L.position.set(0,3.5,0); inner.add(L); }
      else if(B.id==='nivalis'){ floor(new THREE.MeshPhysicalMaterial({color:col(0xd8ecf8),roughness:.1,clearcoat:1})); for(let i=0;i<6;i++){ const c=mesh(new THREE.ConeGeometry(.3,rand(1,2.4),6),new THREE.MeshPhysicalMaterial({color:col(0x9ac8e8),roughness:.1,transmission:.4,thickness:.5}),rand(-3,3),.6,rand(-3,3)); inner.add(c); } const L=new THREE.PointLight(col(0xff9040),1.6,6,1.6); L.position.set(-2,.5,-2); inner.add(L); }
      else if(B.id==='gulch'){ floor(pbrMat('dry_ground_01',2,{w:8,h:8})); const W=pbrMat('brown_planks_03',1,{}); inner.add(box(.3,3,5,W,-3,1.5,0)); inner.add(box(.3,2.4,4,W,3,1.2,0)); const cr=new THREE.Group(); cr.position.set(0,0,1.5); cr.add(box(.12,1.1,.12,mat(0x5a3a1e),0,.55,0)); cr.add(box(.6,.12,.12,mat(0x5a3a1e),0,.8,0)); inner.add(cr); lv.bobGrave=cr; inner.add(mesh(new THREE.SphereGeometry(.6,12,8,0,Math.PI*2,0,Math.PI/2),pbrMat('dry_ground_01',1,{}),0,0,1.0)); }
      else if(B.id==='beach'){ const sandM=pbrMat('desert_sand',2,{w:11,h:11}); sandM.color=col(0xf0e0c0); floor(sandM); const water=mesh(new THREE.PlaneGeometry(10.9,4),new THREE.MeshPhysicalMaterial({color:col(0x2a8ab8),roughness:.05,clearcoat:1,transparent:true,opacity:.85}),0,.06,-3.4,false); water.rotation.x=-Math.PI/2; inner.add(water); lv.water=water;
        const um=new THREE.Group(); um.position.set(1.4,0,1); um.add(cyl(.04,.04,2.4,mat(0xeeeeee),0,1.2,0,8)); const top=mesh(new THREE.ConeGeometry(1.4,.5,12),new THREE.MeshStandardMaterial({color:col(0xe84a3a),roughness:.8,side:THREE.DoubleSide}),0,2.3,0); um.add(top); inner.add(um);
        const chair=new THREE.Group(); chair.position.set(.6,0,1.2); chair.add(box(.7,.08,1.4,mat(0x2a7ab8),0,.35,0)); const back=box(.7,.08,.8,mat(0x2a7ab8),0,.7,.65); back.rotation.x=-1.0; chair.add(back); inner.add(chair);
        const jim=makeJim({}); jim.userData.level='white'; jim.position.set(.6,.25,1.0); jim.rotation.y=Math.PI; inner.add(jim); setPose(jim,'sit',0); jim.userData.A.seated=true; lv.jim=jim;
        const sun=new THREE.PointLight(col(0xfff0d0),1.2,14,1.4); sun.position.set(0,4.5,0); inner.add(sun); inner.add(box(.4,.3,.3,mat(0x3a7ae0),-.2,.15,1.6)); }
      else if(B.id==='time'){ const m=new THREE.MeshBasicMaterial({color:col(0x05050c),side:THREE.BackSide}); g.add(mesh(new THREE.BoxGeometry(S-.15,S-.15,S-.15),m,0,0,0,false)); const st=makeStars(600,3.5); g.add(st); lv.timeRings=[]; for(let i=0;i<3;i++){ const r=mesh(new THREE.TorusGeometry(1.2+i*.8,.05,8,64),new THREE.MeshBasicMaterial({color:col([0xffd060,0x80c0ff,0xff80d0][i])}),0,0,0,false); g.add(r); lv.timeRings.push(r); for(let k=0;k<12;k++){ const tk=box(.06,.25,.06,new THREE.MeshBasicMaterial({color:col(0xffffff)}),Math.cos(k/12*Math.PI*2)*(1.2+i*.8),Math.sin(k/12*Math.PI*2)*(1.2+i*.8),0,false); r.add(tk); } } }
      else if(B.id==='thing'){ const m=new THREE.MeshBasicMaterial({color:col(0x000000),side:THREE.BackSide}); g.add(mesh(new THREE.BoxGeometry(S-.15,S-.15,S-.15),m,0,0,0,false)); const eye=new THREE.Group(); g.add(eye); lv.eye=eye;
        eye.add(mesh(new THREE.SphereGeometry(1.6,32,24),new THREE.MeshPhysicalMaterial({color:col(0xf0e8e0),roughness:.3,clearcoat:1}),0,0,0,false)); const iris=mesh(new THREE.CircleGeometry(.7,32),new THREE.MeshBasicMaterial({color:col(0x6a0a8a)}),0,0,1.61,false); eye.add(iris); eye.add(mesh(new THREE.CircleGeometry(.32,32),new THREE.MeshBasicMaterial({color:col(0x000000)}),0,0,1.62,false));
        for(let i=0;i<8;i++){ const tr=mesh(new THREE.TorusGeometry(2.4+i*.25,.04,6,40,Math.PI*rand(.6,1.4)),new THREE.MeshBasicMaterial({color:col(0x8a2aaa)}),0,0,0,false); tr.rotation.set(rand(0,6),rand(0,6),0); eye.add(tr); } } }
    // the door (appears when you've looked into enough of them)
    lv.door=mesh(new THREE.PlaneGeometry(4,8),new THREE.MeshBasicMaterial({color:col(0xffd890),transparent:true,opacity:0,side:THREE.DoubleSide}),WHITE.door.x,WHITE.door.y,WHITE.door.z,false); scene.add(lv.door);
    // BEYOND: the god. Not a man. Rings of light, too many eyes, a heart of shifting crystal.
    const G=new THREE.Group(); G.position.copy(WHITE.god); scene.add(G); lv.god=G; lv.godRings=[];
    const core=mesh(new THREE.IcosahedronGeometry(16,3),new THREE.MeshPhysicalMaterial({color:col(0xfff4e0),emissive:col(0xffc870),emissiveIntensity:1.4,roughness:.1,metalness:.3,clearcoat:1}),0,0,0,false); G.add(core); lv.godCore=core; lv.godBase=core.geometry.attributes.position.array.slice();
    for(let i=0;i<6;i++){ const r=mesh(new THREE.TorusGeometry(28+i*9,.6+i*.2,10,120),new THREE.MeshBasicMaterial({color:col(0xffe8b0),transparent:true,opacity:.75}),0,0,0,false); r.rotation.set(rand(0,3),rand(0,3),0); G.add(r); lv.godRings.push(r);
      for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; const e=new THREE.Group(); e.position.set(Math.cos(a)*(28+i*9),Math.sin(a)*(28+i*9),0); e.add(mesh(new THREE.SphereGeometry(1.4,16,12),new THREE.MeshBasicMaterial({color:col(0xffffff)}),0,0,0,false)); e.add(mesh(new THREE.CircleGeometry(.6,20),new THREE.MeshBasicMaterial({color:col(0x2a1a0a)}),0,0,1.41,false)); r.add(e); } }
    lv.godL=new THREE.PointLight(col(0xffd890),0,600,1); lv.godL.position.copy(WHITE.god); scene.add(lv.godL);
    lv.ground=()=>0; lv.col.bounds=[-400,400,-900,200];
    lv.flyBounds=(p,v)=>{ if(p.y<-60){ p.y=-60; v.y=Math.max(0,v.y); } if(p.y>120){ p.y=120; v.y=Math.min(0,v.y); } };
  },
  enter(){ setAmbience([['spaceDrone',.04]]); },
  update(dt,t){ const lv=this; for(const id in lv.boxes){ const g=lv.boxes[id]; g.rotation.y=Math.sin(t*.1+g.position.x)*.15; g.position.y+=Math.sin(t*.5+g.position.x)*.004; }
    if(lv.timeRings) lv.timeRings.forEach((r,i)=>{ r.rotation.z+=dt*(i%2?-1:1)*(.4+i*.3); r.rotation.x=Math.sin(t*.3+i)*.6; });
    if(lv.eye){ lv.eye.lookAt(camera.position); lv.eye.children.forEach((c,i)=>{ if(i>2) c.rotation.z+=dt*(.5+i*.1); }); }
    if(lv.water) lv.water.position.y=.06+Math.sin(t*1.5)*.02;
    lv.godRings.forEach((r,i)=>{ r.rotation.x+=dt*.05*(i%2?1:-1); r.rotation.y+=dt*.03*(i+1); });
    const a=lv.godCore.geometry.attributes.position, b=lv.godBase; for(let i=0;i<a.count;i++){ const x=b[i*3],y=b[i*3+1],z=b[i*3+2]; const k=1+Math.sin(x*.3+t*1.3)*Math.cos(y*.27+t)*.12; a.setXYZ(i,x*k,y*k,z*k); } a.needsUpdate=true; lv.godCore.rotation.y+=dt*.05;
    if(typeof whiteTick==='function') whiteTick(lv,dt,t); }
});
