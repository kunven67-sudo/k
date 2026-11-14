/* ================================================================
   NIVALIS (Part 3) — a far, frozen planet. Normal size again.
   Dark, freezing, snow and ice; glowing ice-cream bushes; your watch
   is the light. A frozen lake that cracks, tracks of a snow vehicle, a
   GIANT ANT frozen in the ice, lights of a town far away. The cave.
   Also: Steve + Alex's ice lab (the chair), and their town + the cliff.
   ================================================================ */
function snowTex(){ return bugTex('snow',512,(c,s)=>{ c.fillStyle='#dfe6ef'; c.fillRect(0,0,s,s); blotch(c,s,90,['rgba(200,215,235,A)','rgba(240,245,255,A)','rgba(180,195,215,A)'],20,90); dots(c,s,1600,'rgba(255,255,255,.9)',.3,.9); },
  (c,s)=>{ c.fillStyle='#808080'; c.fillRect(0,0,s,s); blotch(c,s,160,['rgba(255,255,255,A)','rgba(0,0,0,A)'],8,40,.05,.25); },1.6,[1,1]); }
function iceTex(){ return bugTex('ice',512,(c,s)=>{ const g=c.createLinearGradient(0,0,s,s); g.addColorStop(0,'#1a3a52'); g.addColorStop(1,'#0e2638'); c.fillStyle=g; c.fillRect(0,0,s,s);
    c.strokeStyle='rgba(200,230,255,.25)'; for(let i=0;i<60;i++){ c.lineWidth=rand(.5,2); c.beginPath(); let x=Math.random()*s,y=Math.random()*s; c.moveTo(x,y); for(let k=0;k<5;k++){ x+=rand(-40,40); y+=rand(-40,40); c.lineTo(x,y); } c.stroke(); } blotch(c,s,40,['rgba(255,255,255,A)'],10,60,.02,.1); },
  (c,s)=>{ c.fillStyle='#808080'; c.fillRect(0,0,s,s); c.strokeStyle='#fff'; for(let i=0;i<60;i++){ c.lineWidth=rand(.5,2); c.beginPath(); let x=Math.random()*s,y=Math.random()*s; c.moveTo(x,y); for(let k=0;k<5;k++){ x+=rand(-40,40); y+=rand(-40,40); c.lineTo(x,y); } c.stroke(); } },1.2,[1,1]); }
const NIV={lake:{x:0,z:-70,r:34}, cave:V3(10,0,-205), ant:V3(-14,-6,-72), town:V3(260,0,-600), start:V3(0,0,40)};
defineLevel('nivalis',{
  title:'Nivalis',
  env:{fx:{exposure:1.0,saturation:.8,contrast:1.12,temp:-.22,bloomStrength:.55,bloomThreshold:1.1,aoRadius:.6,vignette:.6,grain:.05},music:null,reverb:.25,surface:'snow',far:1400,speed:3.0},
  async build(scene,lv){
    lv.occluders=[];
    scene.background=col(0x04060c); scene.fog=new THREE.FogExp2(col(0x070b14),.012);
    lv.rig=makeRig(scene,{sun:.5,sunColor:0x8aa0d0,hemi:.32,sky:0x3a4a70,ground:0x0a0c12,dir:V3(-.3,1,.2),span:60,dist:120,far:300});
    // stars (a far galaxy: no moon, a strange band of light)
    scene.add(makeStars(5000,900,{}));
    // the ground: rolling snow, a frozen lake in the middle of the way
    const hb=(x,z)=>{ const L=Math.hypot(x-NIV.lake.x,z-NIV.lake.z); let h=fbm2(x*.008,z*.008)*14+fbm2(x*.03,z*.03)*2; h*=smooth(clamp((L-NIV.lake.r)/40,0,1)); if(L<NIV.lake.r) h=-.4;
      const dc=Math.hypot(x-NIV.cave.x,z-(NIV.cave.z-30)); h+=Math.max(0,40-dc)*1.4;   // the rock hill with the cave
      const dp=Math.abs(x-lerp(0,NIV.cave.x,clamp(-(z-40)/245,0,1))); h*=lerp(.25,1,smooth(clamp(dp/20,0,1)));   // a calmer path
      return h; };
    const mouthH=hb(NIV.cave.x,NIV.cave.z);
    const hf=heightField(900,180,(x,z)=>{ let h=hb(x,z); const lx=x-NIV.cave.x, lz=z-NIV.cave.z; if(Math.abs(lx)<15&&lz<2&&lz>-34) h=Math.min(h,mouthH-.25-smooth(clamp((-lz)/6,0,1))*.6); return h; });   /* the cave is hollow (the hill used to fill it with snow) */
    lv.hf=hf;
    const g=new THREE.PlaneGeometry(900,900,180,180); g.rotateX(-Math.PI/2); const a=g.attributes.position; for(let i=0;i<a.count;i++){ const x=a.getX(i), z=a.getZ(i); const L=Math.hypot(x-NIV.lake.x,z-NIV.lake.z); a.setY(i,L<NIV.lake.r?-.4-21*smooth(clamp((NIV.lake.r-1-L)/16,0,1)):hf.at(x,z)); } g.computeVertexNormals();   /* the lake is DEEP under the ice (you see down into it) */
    const sn=snowTex(); sn.map.repeat.set(60,60); sn.nm.repeat.set(60,60);
    const snow=mesh(g,new THREE.MeshStandardMaterial({color:col(0xe8eef8),map:sn.map,normalMap:sn.nm,normalScale:new THREE.Vector2(.8,.8),roughness:.85}),0,0,0); snow.receiveShadow=true; scene.add(snow);
    const it=iceTex(); it.map.repeat.set(3,3); it.nm.repeat.set(3,3);
    const ice=mesh(new THREE.CircleGeometry(NIV.lake.r+2,64),new THREE.MeshPhysicalMaterial({color:col(0xa8d4f0),map:it.map,normalMap:it.nm,roughness:.16,clearcoat:1,emissive:col(0x10283e),emissiveIntensity:.6,transparent:true,opacity:.72,depthWrite:false}),NIV.lake.x,-.35,NIV.lake.z,false); ice.rotation.x=-Math.PI/2; scene.add(ice); lv.ice=ice;
    // the giant ant frozen under the ice, staring up
    const ga=makeAnt(); ga.scale.setScalar(9); ga.position.copy(NIV.ant); ga.rotation.set(-.12,.8,.06); scene.add(ga); lv.giantAnt=ga; ga.updateMatrixWorld(true); { const bb=new THREE.Box3().setFromObject(ga); ga.position.y-=bb.max.y+1.4; }   /* all of it frozen UNDER the ice */
    { const gl=new THREE.PointLight(col(0x7ac8ff),1.8,40,1.3); gl.position.set(NIV.ant.x+4,-7,NIV.ant.z+6); scene.add(gl); }
    const iceBlock=mesh(new THREE.BoxGeometry(60,16,60),new THREE.MeshPhysicalMaterial({color:col(0x2a6a9a),emissive:col(0x0a2a44),roughness:.2,transparent:true,opacity:.42,depthWrite:false,side:THREE.BackSide}),NIV.ant.x,-9,NIV.ant.z,false); scene.add(iceBlock);
    // the cracks that spread when you cross (hidden until then)
    const crk=[]; for(let i=0;i<14;i++){ const pts=[]; let x=NIV.lake.x+rand(-6,6), z=NIV.lake.z+rand(-4,4); for(let k=0;k<6;k++){ pts.push(V3(x,-.3,z)); x+=rand(-6,6); z+=rand(-6,6); }
      const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xe8f6ff,transparent:true,opacity:0})); scene.add(l); crk.push(l); } lv.cracks=crk;
    // tracks of a snow vehicle: two long dents running toward the far lights
    { const trT=canvasTex(64,256,(c,w,h)=>{ c.clearRect(0,0,w,h); const gr=c.createLinearGradient(0,0,w,0); gr.addColorStop(0,'rgba(60,80,110,0)'); gr.addColorStop(.18,'rgba(60,80,110,.55)'); gr.addColorStop(.82,'rgba(60,80,110,.55)'); gr.addColorStop(1,'rgba(60,80,110,0)'); c.fillStyle=gr; c.fillRect(0,0,w,h);
        for(let y=0;y<h;y+=16){ c.strokeStyle='rgba(30,40,60,.5)'; c.lineWidth=4; c.beginPath(); c.moveTo(10,y); c.lineTo(w/2,y+7); c.lineTo(w-10,y); c.stroke(); c.strokeStyle='rgba(235,242,255,.35)'; c.lineWidth=2; c.beginPath(); c.moveTo(10,y+4); c.lineTo(w/2,y+11); c.lineTo(w-10,y+4); c.stroke(); }
        for(let i=0;i<300;i++){ c.fillStyle='rgba(255,255,255,'+Math.random()*.25+')'; c.fillRect(Math.random()*w,Math.random()*h,2,2); } },[1,1]);
      trT.wrapS=trT.wrapT=THREE.RepeatWrapping;
      const trM=new THREE.MeshStandardMaterial({color:col(0xc8d4e4),map:trT,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const ctr=[]; for(let i=0;i<=160;i++){ const t=i/160; ctr.push(V3(lerp(-30,NIV.town.x*.25,t),0,lerp(10,-180,t)+Math.sin(t*6)*8)); }
      for(const sd of [-1.6,1.6]){ const n=ctr.length, pos=new Float32Array(n*6), uv=new Float32Array(n*4), nr=new Float32Array(n*6), idx=[]; let L=0;
        for(let i=0;i<n;i++){ const o=ctr[Math.max(0,i-1)], q=ctr[Math.min(n-1,i+1)], dx=q.x-o.x, dz=q.z-o.z, l=Math.hypot(dx,dz)||1, px=-dz/l, pz=dx/l; if(i) L+=ctr[i].distanceTo(ctr[i-1]);
          for(let e=0;e<2;e++){ const off=sd+(e?.6:-.6), x=ctr[i].x+px*off, z=ctr[i].z+pz*off, k=i*2+e; pos.set([x,hf.at(x,z)+.04,z],k*3); nr.set([0,1,0],k*3); uv.set([e,L/2.4],k*2); }
          if(i<n-1){ const a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); } }
        const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nr,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(idx);
        const m=new THREE.Mesh(g,trM); m.receiveShadow=true; m.renderOrder=1; m.material.side=THREE.DoubleSide; scene.add(m); } }
    // glowing ice-cream bushes: icy shrubs with soft glowing scoops (pastel, they light the snow)
    lv.bushes=[]; const cols=[0xffb0d8,0xb0f0ff,0xfff0a0,0xc8b0ff,0xa0ffc8];
    for(let i=0;i<34;i++){ const t=i/34; const x=lerp(-20,NIV.cave.x+20,t)+rand(-30,30), z=lerp(30,NIV.cave.z+30,t)+rand(-10,10); if(Math.hypot(x-NIV.lake.x,z-NIV.lake.z)<NIV.lake.r+4) continue;
      const b=new THREE.Group(); b.position.set(x,hf.at(x,z),z); scene.add(b); const stem=new THREE.MeshStandardMaterial({color:col(0x6a7a8a),roughness:.4});
      for(let k=0;k<5;k++){ const s=cyl(.05,.09,rand(.8,1.6),stem,rand(-.4,.4),.5,rand(-.4,.4),6); s.rotation.set(rand(-.4,.4),0,rand(-.4,.4)); b.add(s); }
      const c=pick(cols); for(let k=0;k<rand(3,6);k++){ const sc=sph(rand(.22,.38),new THREE.MeshStandardMaterial({color:col(c),emissive:col(c),emissiveIntensity:.9,roughness:.6}),rand(-.6,.6),rand(1,1.8),rand(-.6,.6),12,10); b.add(sc); }
      if(i%3===0){ const L=new THREE.PointLight(col(c),1.4,14,2); L.position.set(0,1.4,0); b.add(L); }
      lv.bushes.push(b); }
    // the town lights, far away
    for(let i=0;i<40;i++){ const l=sph(rand(1,3),new THREE.MeshBasicMaterial({color:col(pick([0x9ad0ff,0xffd890,0xb0ffe0]))}),NIV.town.x+rand(-120,120),rand(2,40),NIV.town.z+rand(-60,60),6,6,false); scene.add(l); }
    // the rock hill and the cave mouth
    const rockM=pbrMat('sandstone_cracks',3,{opts:{roughness:.95}}); rockM.color=col(0x5a606a);
    const hill=mesh(new THREE.SphereGeometry(46,32,20,0,Math.PI*2,0,Math.PI/2),rockM,NIV.cave.x,-6,NIV.cave.z-30); hill.scale.set(1.2,.9,1); scene.add(hill);
    // the cave chamber (you go in through the dark mouth)
    const cave=new THREE.Group(); cave.position.copy(NIV.cave); scene.add(cave); lv.caveG=cave;
    const inner=mesh(new THREE.SphereGeometry(9,28,18),rockM,0,3,-12); inner.scale.set(1.2,.6,1.4); inner.material.side=THREE.BackSide; cave.add(inner);
    const mouth=mesh(new THREE.CylinderGeometry(3.4,3.6,10,18,1,true),rockM,0,2.6,-1.5); mouth.rotation.x=Math.PI/2; mouth.material.side=THREE.BackSide; cave.add(mouth);
    lv.caveFloorY=hf.at(NIV.cave.x,NIV.cave.z); cave.position.y=lv.caveFloorY; { const fm=pbrMat('sandstone_cracks',2,{opts:{roughness:1}}); fm.color=col(0x7a7c84); const fl=mesh(new THREE.CircleGeometry(10,40),fm,NIV.cave.x,lv.caveFloorY+.04,NIV.cave.z-12.5,false); fl.rotation.x=-Math.PI/2; fl.scale.set(1.15,1.35,1); fl.receiveShadow=true; scene.add(fl); }   /* a rock floor in the cave */ { const cl=new THREE.PointLight(col(0x8aa8d0),3.6,44,1.1); cl.position.set(NIV.cave.x,lv.caveFloorY+4.5,NIV.cave.z-9); scene.add(cl); }
    // inside: a wall torch (unlit), the old campfire ring, the sleeping bag (with him inside), tally marks
    const tally=mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshStandardMaterial({transparent:true,roughness:1,map:canvasTex(256,128,(c,w,h)=>{ c.clearRect(0,0,w,h); c.strokeStyle='rgba(240,236,220,.85)'; c.lineWidth=3; for(let i=0;i<46;i++){ const g=Math.floor(i/5), k=i%5, x=10+g*26+k*4, y=14+Math.floor(g/9)*50; if(k<4){ c.beginPath(); c.moveTo(x,y); c.lineTo(x+rand(-1,1),y+34); c.stroke(); } else { c.beginPath(); c.moveTo(x-18,y+28); c.lineTo(x+2,y+6); c.stroke(); } } })}),-7.5,2.6,-12,false); tally.rotation.y=Math.PI/2; cave.add(tally); lv.tally=tally;
    const cf=makeCampfire(rockM); cf.g.position.set(0,0,-12); cave.add(cf.g); lv.fire=cf.g; lv.fireL=cf.light; lv.flame=cf.flame; lv.campfire=cf; const wood=new THREE.MeshStandardMaterial({color:col(0x3a2a1a),roughness:.9});   /* stones, logs, flame sprites, embers */
    const bagM=new THREE.MeshPhysicalMaterial({color:col(0x4a5a3a),roughness:.85,map:charTex().cloth.map,sheen:col(0x6a7a5a)});
    const bag=ell(.55,.3,1.1,bagM,3.2,.3,-14,18); bag.rotation.y=.3; cave.add(bag); lv.bag=bag;
    const bones=new THREE.Group(); bones.position.set(3.2,.15,-14); bones.visible=false; cave.add(bones); lv.bones=bones;
    for(let i=0;i<7;i++){ const b=makeLongBone(rand(.25,.45),.02); b.rotation.set(Math.PI/2,0,rand(0,6)); b.position.set(rand(-.5,.5),0,rand(-.9,.9)); bones.add(b); }
    bones.add(sph(.11,boneMat(),0,.08,-1.0,12,10));
    const coat=box(.8,.12,1.1,new THREE.MeshPhysicalMaterial({color:col(0x6a4a2a),roughness:.9,map:charTex().cloth.map}),2.3,.08,-12.8); coat.rotation.y=.4; coat.visible=false; cave.add(coat); lv.coat=coat;
    const wtorch=new THREE.Group(); wtorch.position.set(-7.2,2.2,-9); cave.add(wtorch); wtorch.add(cyl(.05,.07,.8,wood,0,0,0,6)); lv.wallTorch=wtorch;
    lv.ground=(x,z)=>{ const lx=x-NIV.cave.x, lz=z-NIV.cave.z; if(lz<1&&lz>-28&&Math.abs(lx)<11) return lv.caveFloorY; return hf.at(x,z); };
    lv.surfaceAt=()=>'snow';
    lv.col.bounds=[-200,200,-260,80];
  },
  enter(){ FX.sunWorld=null; setAmbience([['wind',.08]]); },
  exit(){ setAmbience([]); },
  update(dt,t){ const lv=this; if(lv.campfire) lv.campfire.update(dt,t);
    if(typeof nivTick==='function') nivTick(lv,dt,t); }
});
/* ---------- Steve + Alex's ICE LAB: blue lights, frost on the machines, two chairs ---------- */
defineLevel('lab',{
  title:'???',
  env:{fx:{exposure:1.05,saturation:.85,contrast:1.1,temp:-.25,bloomStrength:.5,bloomThreshold:.9,aoRadius:.6,vignette:.5,grain:.04},music:null,reverb:.4,surface:'tile',far:120},
  async build(scene,lv){
    scene.background=col(0x060a10); scene.fog=new THREE.FogExp2(col(0x0a1220),.012);
    scene.add(new THREE.HemisphereLight(col(0x9ac0e8),col(0x2a3040),.9)); { const top=new THREE.PointLight(col(0xe0f0ff),1.4,30,1.5); top.position.set(0,5.6,0); scene.add(top); }
    const iceM=new THREE.MeshPhysicalMaterial({color:col(0x9ac8e8),roughness:.15,clearcoat:1,transparent:true,opacity:.95});
    const it=iceTex(); const wallM=new THREE.MeshPhysicalMaterial({color:col(0x8ab0d0),map:it.map,normalMap:it.nm,roughness:.2,clearcoat:.8});
    const room=mesh(new THREE.BoxGeometry(16,6,20),wallM,0,3,0); room.material.side=THREE.BackSide; scene.add(room);
    const metal=new THREE.MeshPhysicalMaterial({color:col(0x5a6670),metalness:.85,roughness:.35});
    // the two chairs with the brain-crowns, cables up to the ceiling
    lv.chairs=[]; for(const sd of [-1,1]){ const c=new THREE.Group(); c.position.set(sd*2,0,1); scene.add(c);
      c.add(box(.8,.12,.8,metal,0,.55,0)); c.add(box(.8,1.2,.12,metal,0,1.15,.4)); c.add(cyl(.12,.15,.55,metal,0,.28,0,10));
      const crown=mesh(new THREE.TorusGeometry(.14,.03,8,20),new THREE.MeshStandardMaterial({color:col(0x4ae0ff),emissive:col(0x1a90c0),emissiveIntensity:1.2}),0,1.62,.25); crown.rotation.x=Math.PI/2; c.add(crown);
      const cable=cyl(.03,.03,4.4,new THREE.MeshStandardMaterial({color:col(0x1a1a1a),roughness:.6}),0,3.8,.3,6); c.add(cable); lv.chairs.push({g:c,crown}); }
    // machines: frosted panels with blue lights
    lv.lights=[]; for(let i=0;i<4;i++){ const x=-6.5+i*4.3; const m=box(2.4,3,1,metal,x,1.5,-9.2); scene.add(m);
      for(let k=0;k<6;k++){ const l=sph(.07,new THREE.MeshBasicMaterial({color:col(pick([0x4ae0ff,0x9affff,0x2a8aff]))}),x-.8+k*.32,2.4,-8.65,6,6,false); scene.add(l); lv.lights.push(l); } }
    for(let i=0;i<3;i++){ const L=new THREE.PointLight(col(0x5ab8ff),1.6,14,2); L.position.set(-5+i*5,4.8,-2); scene.add(L); }
    lv.alarmL=new THREE.PointLight(col(0xff2020),0,20,2); lv.alarmL.position.set(0,5,0); scene.add(lv.alarmL);
    // their table, with your watch on it
    lv.table=new THREE.Group(); lv.table.position.set(4.6,0,-4); scene.add(lv.table); lv.table.add(box(1.8,.08,1,metal,0,.95,0)); for(const [x,z] of [[-.8,-.4],[.8,-.4],[-.8,.4],[.8,.4]]) lv.table.add(cyl(.04,.04,.95,metal,x,.47,z,6));
    lv.watchOnTable=new THREE.Group(); lv.watchOnTable.position.set(0,1.0,0); lv.table.add(lv.watchOnTable);
    lv.watchOnTable.add(mesh(new THREE.TorusGeometry(.05,.012,8,16),new THREE.MeshStandardMaterial({color:col(0x1a1c22),metalness:.6,roughness:.4})).rotateX(Math.PI/2)); lv.watchOnTable.add(box(.06,.015,.06,new THREE.MeshStandardMaterial({color:col(0x1a1c22),emissive:col(0x6dffd8),emissiveIntensity:.6}),0,.01,0));
    // the door out
    scene.add(box(2,3,.3,metal,0,1.5,9.9)); lv.doorZ=9.6;
    lv.ground=()=>0; lv.surfaceAt=()=>'tile'; lv.col.bounds=[-7.6,7.6,-9.6,9.6];
    colBox(lv.col,3.7,5.5,-4.5,-3.5); for(const sd of [-1,1]) colBoxC(lv.col,sd*2,1,.9,.9);
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){ for(const l of this.lights||[]) l.visible=Math.sin(t*3+l.position.x*7)>-.6; }
});
/* ---------- their TOWN at night: ice houses, glowing signs, the cliff ---------- */
const TOWN={len:420, cliffZ:-420, bridge:{z0:-250,z1:-290}};
defineLevel('town',{
  title:'???',
  env:{fx:{exposure:1.05,saturation:.9,contrast:1.12,temp:-.2,bloomStrength:.7,bloomThreshold:1.0,aoRadius:.6,vignette:.55,grain:.05},music:null,reverb:.35,surface:'snow',far:900,speed:3.3},
  async build(scene,lv){
    lv.occluders=[];
    scene.background=col(0x04060c); scene.fog=new THREE.FogExp2(col(0x0a1018),.008);
    lv.rig=makeRig(scene,{sun:.55,sunColor:0x8aa0d0,hemi:.36,sky:0x4a5a80,ground:0x0a0c12,dir:V3(.3,1,.2),span:60,dist:120,far:300});
    scene.add(makeStars(4000,800,{}));
    const sn=snowTex(); sn.map.repeat.set(40,80); sn.nm.repeat.set(40,80);
    const road=mesh(new THREE.PlaneGeometry(60,TOWN.len+20),new THREE.MeshStandardMaterial({color:col(0xdde4ee),map:sn.map,normalMap:sn.nm,roughness:.9}),0,0,-TOWN.len/2+10,false); road.rotation.x=-Math.PI/2; road.receiveShadow=true; scene.add(road);
    const it=iceTex(); const iceM=new THREE.MeshPhysicalMaterial({color:col(0x9ac8e8),map:it.map,normalMap:it.nm,roughness:.15,clearcoat:1});
    lv.windows=[]; lv.signs=[];
    for(let i=0;i<22;i++){ const z=-10-i*18; if(z<TOWN.bridge.z0+10&&z>TOWN.bridge.z1-10) continue; if(z<TOWN.cliffZ+30) break;
      for(const sd of [-1,1]){ const w=rand(10,16), h=rand(8,18), x=sd*(14+w/2+rand(0,4));
        const house=new THREE.Group(); house.position.set(x,0,z); scene.add(house); lv.occluders.push(house);
        house.add(box(w,h,12,iceM,0,h/2,0)); const dome=mesh(new THREE.SphereGeometry(w*.45,20,10,0,Math.PI*2,0,Math.PI/2),iceM,0,h,0); house.add(dome);
        const win=box(2.4,2.4,.2,new THREE.MeshBasicMaterial({color:col(0xffd890)}),-sd*(w/2+.05),h*.5,rand(-3,3),false); win.rotation.y=Math.PI/2; house.add(win); lv.windows.push({m:win,house,sd});
        if(Math.random()<.6){ const sign=mesh(new THREE.PlaneGeometry(6,1.6),new THREE.MeshBasicMaterial({map:canvasTex(256,64,(c,W,H)=>{ c.fillStyle='rgba(0,0,0,0)'; c.clearRect(0,0,W,H); c.shadowColor=pick(['#4af','#f4a','#4fa']); c.shadowBlur=14; c.fillStyle=c.shadowColor; c.font='bold 40px monospace'; let s=''; for(let k=0;k<7;k++) s+=String.fromCharCode(0x2200+randi(0,120)); c.fillText(s,10,46); }),transparent:true}),-sd*(w/2+.2),h*.8,0,false); sign.rotation.y=-sd*Math.PI/2; house.add(sign); lv.signs.push(sign); }
        colBoxC(lv.col,x,z,w,12); } }
    // the ice bridge over a crevasse (it breaks behind you)
    const B=TOWN.bridge; const gap=mesh(new THREE.PlaneGeometry(60,B.z0-B.z1),new THREE.MeshBasicMaterial({color:0x000000}),0,-.05,(B.z0+B.z1)/2,false); gap.rotation.x=-Math.PI/2; scene.add(gap);
    lv.bridge=box(8,1,B.z0-B.z1,iceM,0,-.45,(B.z0+B.z1)/2); scene.add(lv.bridge);
    colBox(lv.col,-30,-4,B.z1,B.z0); colBox(lv.col,4,30,B.z1,B.z0);
    // the slamming gates (traps): side streets close as you pass
    lv.gates=[]; for(const z of [-80,-170,-330]){ const gt=box(26,7,1,new THREE.MeshPhysicalMaterial({color:col(0x5a6670),metalness:.8,roughness:.35}),0,14,z); scene.add(gt); lv.gates.push({m:gt,z,shut:false}); }
    // the cliff: the canyon drops away, the frozen black sea far below
    const sea=mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshPhysicalMaterial({color:col(0x05080c),roughness:.05,clearcoat:1}),0,-260,TOWN.cliffZ-900,false); sea.rotation.x=-Math.PI/2; scene.add(sea);
    const cl=pbrMat('sandstone_cracks',4,{opts:{roughness:.95}}); cl.color=col(0x40464e); const wall=mesh(new THREE.PlaneGeometry(400,260),cl,0,-130,TOWN.cliffZ,false); scene.add(wall);
    lv.ground=(x,z)=>{ if(z<B.z0&&z>B.z1){ return Math.abs(x)<4&&!lv.bridgeGone?-.1:-200; } if(z<TOWN.cliffZ) return -300; return 0; };
    lv.surfaceAt=()=>'snow'; lv.col.bounds=[-28,28,TOWN.cliffZ+1.2,12];
  },
  enter(){ FX.sunWorld=null; setAmbience([['wind',.06]]); },
  update(dt,t){ for(const s of this.signs||[]) s.material.opacity=.75+Math.sin(t*5+s.id)*.25; if(typeof townTick==='function') townTick(this,dt,t); }
});
