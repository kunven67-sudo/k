/* ================================================================
   THE WHITE — nothing. No ground, no up or down: you FLY (WASD, Space
   up, C down). Glass boxes float here, and every box is a reality:
   the desert, Nivalis, Dry Gulch, Earth (Jim on vacation), space +
   time, and one thing a human should not see. BEYOND them: the god.
   ================================================================ */
const WHITE={boxes:[{id:'desert',p:V3(-30,4,-40)},{id:'nivalis',p:V3(30,10,-55)},{id:'gulch',p:V3(-42,18,-95)},{id:'beach',p:V3(36,-6,-100)},{id:'time',p:V3(0,26,-130)},{id:'thing',p:V3(-10,-14,-150)}],door:V3(0,4,-185),god:V3(0,30,-640),beyondAt:V3(0,0,-520)};
function glassBox(s){ const g=new THREE.Group(); const gm=new THREE.MeshPhysicalMaterial({color:col(0xeef6ff),roughness:.03,metalness:0,transparent:true,opacity:.07,clearcoat:.4,clearcoatRoughness:.05,envMapIntensity:.12,reflectivity:.3,side:THREE.DoubleSide,depthWrite:false});
  g.add(mesh(new THREE.BoxGeometry(s,s,s),gm,0,0,0,false));
  /* real frame: brushed steel bars on all 12 edges, so it reads as a glass case, not a white blob */
  const fm=new THREE.MeshStandardMaterial({color:col(0x9aa4ae),metalness:.85,roughness:.32}); const h=s/2, b=.09;
  for(const a of [-h,h]) for(const c of [-h,h]){ g.add(mesh(new THREE.BoxGeometry(s+b,b,b),fm,0,a,c)); g.add(mesh(new THREE.BoxGeometry(b,s+b,b),fm,a,0,c)); g.add(mesh(new THREE.BoxGeometry(b,b,s+b),fm,a,c,0)); }
  return g; }
defineLevel('white',{
  title:'???',
  env:{fx:{exposure:.9,saturation:1.05,contrast:1.1,temp:0,bloomStrength:.5,bloomThreshold:.95,aoRadius:.5,vignette:.25,grain:.03},music:null,reverb:.9,surface:'stone',far:1600,speed:5,fly:true},
  async build(scene,lv){ lv.occluders=[];
    scene.background=col(0xf2f2f4); scene.fog=new THREE.FogExp2(col(0xf2f2f4),.0028); lv.fogW=.0028;
    scene.add(new THREE.HemisphereLight(col(0xffffff),col(0xc8c8d0),.75)); const d=new THREE.DirectionalLight(col(0xffffff),.9); d.position.set(.3,1,.4); scene.add(d);
    lv.boxes={};
    const SKY5={desert:['#3a6ab8','#f0b878'],nivalis:['#020414','#1a2a4a'],gulch:['#2a2a5a','#ff8a3a'],beach:['#2a7ad8','#cfe8ff']};
    for(const B of WHITE.boxes){ const S=B.id==='beach'?11:8; const g=glassBox(S); g.position.copy(B.p); scene.add(g); lv.boxes[B.id]=g; g.userData.S=S; const inner=new THREE.Group(); inner.position.y=-S/2+.05; g.add(inner);
      if(SKY5[B.id]){ const [top,bot]=SKY5[B.id]; const tx=canvasTex(64,256,(c,w,h)=>{ const gr=c.createLinearGradient(0,0,0,h); gr.addColorStop(0,top); gr.addColorStop(.7,bot); gr.addColorStop(1,bot); c.fillStyle=gr; c.fillRect(0,0,w,h); if(B.id==='nivalis') for(let i=0;i<160;i++){ c.fillStyle='rgba(255,255,255,'+Math.random()+')'; c.fillRect(Math.random()*w,Math.random()*h*.65,1,1); } });
        /* each box = a window into its own world: 4 sky walls + a ceiling, no bottom (the ground sits there) */
        const wm=new THREE.MeshBasicMaterial({map:tx,fog:false}); const q=(S-.14)/2;
        for(let k=0;k<4;k++){ const w=mesh(new THREE.PlaneGeometry(S-.14,S-.14),wm,0,0,0,false); const a=k*Math.PI/2; w.position.set(Math.sin(a)*q,0,Math.cos(a)*q); w.rotation.y=a+Math.PI; g.add(w); }
        const cl=mesh(new THREE.PlaneGeometry(S-.14,S-.14),new THREE.MeshBasicMaterial({color:col(top),fog:false}),0,q,0,false); cl.rotation.x=Math.PI/2; g.add(cl);
        if(B.id!=='nivalis'){ const sunD=mesh(new THREE.CircleGeometry(.45,24),new THREE.MeshBasicMaterial({color:col(B.id==='gulch'?0xffb060:0xfff6dc),fog:false}),-q*.4,q*.45,-q+.02,false); g.add(sunD); }
        else { const moon=mesh(new THREE.CircleGeometry(.35,24),new THREE.MeshBasicMaterial({color:col(0xe8eef8),fog:false}),q*.35,q*.5,-q+.02,false); g.add(moon); } }
      const floor=(m)=>{ const f=mesh(new THREE.PlaneGeometry(S-.1,S-.1),m,0,0,0,false); f.rotation.x=-Math.PI/2; inner.add(f); };
      if(B.id==='desert'){ { const dg=new THREE.PlaneGeometry(S-.1,S-.1,40,40); const pp=dg.attributes.position; for(let i=0;i<pp.count;i++){ const x=pp.getX(i), y=pp.getY(i), e=Math.max(0,1-Math.max(Math.abs(x),Math.abs(y))/(S/2-.1)); pp.setZ(i,(Math.sin(x*.9+y*.35)*.22+Math.sin(x*.31-y*.7)*.18+.45)*Math.min(1,e*6)+.03); } dg.computeVertexNormals(); const dm=pbrMat('desert_sand',2,{w:8,h:8}); dm.color=col(0xa88a62); dm.envMapIntensity=.25; const f=mesh(dg,dm,0,0,0,true); f.rotation.x=-Math.PI/2; inner.add(f); } const pm=pbrMat('desert_sand',1,{}); pm.color=col(0xb09068); pm.envMapIntensity=.25; const p=mesh(new THREE.ConeGeometry(1.8,1.6,4),pm,1,.8,-1.5); p.rotation.y=Math.PI/4; inner.add(p); const L=new THREE.PointLight(col(0xffe0a0),.7,10,1.5); L.position.set(0,3.5,0); inner.add(L); }
      else if(B.id==='nivalis'){ floor(new THREE.MeshPhysicalMaterial({color:col(0x5a7088),roughness:.25,clearcoat:.6,envMapIntensity:.15})); for(let i=0;i<6;i++){ const c=mesh(new THREE.ConeGeometry(.3,rand(1,2.4),6),new THREE.MeshPhysicalMaterial({color:col(0x6a98b8),roughness:.12,clearcoat:1,envMapIntensity:.2}),rand(-3,3),.6,rand(-3,3)); inner.add(c); } const L=new THREE.PointLight(col(0xff9040),1.6,6,1.6); L.position.set(-2,.5,-2); inner.add(L); }
      else if(B.id==='gulch'){ floor(pbrMat('dry_ground_01',2,{w:8,h:8})); const W=pbrMat('brown_planks_03',1,{}); inner.add(box(.3,3,5,W,-3,1.5,0)); inner.add(box(.3,2.4,4,W,3,1.2,0)); const cr=new THREE.Group(); cr.position.set(0,0,1.5); cr.add(box(.12,1.1,.12,mat(0x5a3a1e),0,.55,0)); cr.add(box(.6,.12,.12,mat(0x5a3a1e),0,.8,0)); inner.add(cr); lv.bobGrave=cr; inner.add(mesh(new THREE.SphereGeometry(.6,12,8,0,Math.PI*2,0,Math.PI/2),pbrMat('dry_ground_01',1,{}),0,0,1.0)); }
      else if(B.id==='beach'){ const sandM=pbrMat('desert_sand',2,{w:11,h:11}); sandM.color=col(0xf0e0c0); floor(sandM); const water=mesh(new THREE.PlaneGeometry(10.9,4),new THREE.MeshPhysicalMaterial({color:col(0x2a8ab8),roughness:.05,clearcoat:1,transparent:true,opacity:.85}),0,.06,-3.4,false); water.rotation.x=-Math.PI/2; inner.add(water); lv.water=water;
        const um=new THREE.Group(); um.position.set(1.4,0,1); um.add(cyl(.04,.04,2.4,mat(0xeeeeee),0,1.2,0,8)); const top=mesh(new THREE.ConeGeometry(1.4,.45,16,1,true),new THREE.MeshStandardMaterial({map:canvasTex(256,32,(c,w,h)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#f4f0e6':'#d8402e'; c.fillRect(i*w/8,0,w/8,h); } }),roughness:.85,side:THREE.DoubleSide}),0,2.3,0); um.add(top); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; const rib=cyl(.012,.012,1.47,mat(0xcccccc),Math.cos(a)*.7,2.3,Math.sin(a)*.7,4); rib.rotation.set(0,0,0); rib.lookAt(V3(0,2.52,0).add(um.position)); rib.rotation.x+=Math.PI/2; um.add(rib); } inner.add(um);
        const chair=new THREE.Group(); chair.position.set(.6,0,1.2); const fab=new THREE.MeshStandardMaterial({map:canvasTex(64,64,(c,w,h)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#f0f0f0':'#2a6ab0'; c.fillRect(i*w/8,0,w/8,h); } }),roughness:.9}); const wood=pbrMat('rough_wood',1,{}); for(const sx of [-.33,.33]) chair.add(box(.04,.04,1.4,wood,sx,.3,0)); for(const sz of [-.6,.6]) for(const sx of [-.33,.33]) chair.add(box(.04,.3,.04,wood,sx,.15,sz)); chair.add(box(.62,.03,1.3,fab,0,.33,0)); const back=box(.62,.03,.8,fab,0,.7,.65); back.rotation.x=-1.0; chair.add(back); inner.add(chair);
        const jim=makeJim({}); jim.userData.level='white'; jim.position.set(.6,.25,1.0); jim.rotation.y=Math.PI; inner.add(jim); setPose(jim,'sit',0); jim.userData.A.seated=true; lv.jim=jim;
        const sun=new THREE.PointLight(col(0xfff0d0),1.2,14,1.4); sun.position.set(0,4.5,0); inner.add(sun); { const cool=new THREE.Group(); cool.position.set(-.2,0,1.6); cool.add(box(.42,.26,.3,new THREE.MeshStandardMaterial({color:col(0x2a6ad0),roughness:.4}),0,.13,0)); cool.add(box(.44,.06,.32,new THREE.MeshStandardMaterial({color:col(0xf2f2f2),roughness:.4}),0,.29,0)); cool.add(box(.3,.03,.04,mat(0x222222),0,.335,0)); inner.add(cool); const tw=mesh(new THREE.PlaneGeometry(.8,1.7),new THREE.MeshStandardMaterial({map:canvasTex(32,128,(c,w,h)=>{ for(let i=0;i<10;i++){ c.fillStyle=['#e8a030','#f4f0e6','#3a9a8a'][i%3]; c.fillRect(0,i*h/10,w,h/10); } }),roughness:1}),-1.6,.02,.6,false); tw.rotation.x=-Math.PI/2; tw.rotation.z=.3; inner.add(tw); } }
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
    /* six wings of light (feathered, additive), behind the rings */
    { const wt=canvasTex(128,512,(c,w,h)=>{ c.clearRect(0,0,w,h); for(let i=0;i<34;i++){ const x=w*.5+(Math.random()-.5)*w*.8*(i/34), y0=h*(i/34)*.9; const gr=c.createLinearGradient(0,y0,0,h); gr.addColorStop(0,'rgba(255,240,200,0)'); gr.addColorStop(.3,'rgba(255,236,190,.55)'); gr.addColorStop(1,'rgba(255,200,120,0)'); c.strokeStyle=gr; c.lineWidth=2+Math.random()*5; c.beginPath(); c.moveTo(w/2,h); c.quadraticCurveTo(x,h*.6,x+(Math.random()-.5)*20,y0); c.stroke(); } });
      const wm=new THREE.MeshBasicMaterial({map:wt,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
      lv.godWings=[]; for(let i=0;i<6;i++){ const a=(i/6)*Math.PI*2+Math.PI/6; const wg=mesh(new THREE.PlaneGeometry(70,260,1,8),wm,0,0,-20,false); wg.geometry.translate(0,130,0); const piv=new THREE.Group(); piv.rotation.z=a; piv.add(wg); wg.rotation.x=-.25; G.add(piv); lv.godWings.push(piv); } }
    /* the eyes on the rings get real irises, and they're bigger */
    lv.godRings.forEach(r=>r.children.forEach(e=>{ if(!e.isGroup) return; e.scale.setScalar(2.2); const iris=e.children[1]; if(iris&&iris.material){ iris.material=new THREE.MeshBasicMaterial({map:mhEyeTex(pick([0xffc040,0x40c8ff,0xb060ff,0x60ff9a])),transparent:false}); iris.scale.setScalar(1.6); } }));
    /* light dust drifting around it */
    { const N=900, pa=new Float32Array(N*3); for(let i=0;i<N;i++){ const r=rand(30,160), a=rand(0,6.283), b=rand(-1.4,1.4); pa[i*3]=Math.cos(a)*Math.cos(b)*r; pa[i*3+1]=Math.sin(b)*r; pa[i*3+2]=Math.sin(a)*Math.cos(b)*r; }
      const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.BufferAttribute(pa,3)); const dust=new THREE.Points(pg,new THREE.PointsMaterial({color:col(0xffe8b0),size:1.4,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); G.add(dust); lv.godDust=dust; }
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
    if(lv.godWings) lv.godWings.forEach((w,i)=>{ w.children[0].rotation.x=-.25+Math.sin(t*.6+i)*.12; }); if(lv.godDust) lv.godDust.rotation.y+=dt*.02;
    const a=lv.godCore.geometry.attributes.position, b=lv.godBase; for(let i=0;i<a.count;i++){ const x=b[i*3],y=b[i*3+1],z=b[i*3+2]; const k=1+Math.sin(x*.3+t*1.3)*Math.cos(y*.27+t)*.12; a.setXYZ(i,x*k,y*k,z*k); } a.needsUpdate=true; lv.godCore.rotation.y+=dt*.05;
    if(typeof whiteTick==='function') whiteTick(lv,dt,t); }
});
