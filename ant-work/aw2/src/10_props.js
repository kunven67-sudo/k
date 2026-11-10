/* ================================================================
   PROPS — shared building blocks: sky-lit environments, textures,
   the car, instanced foliage + grass with wind, suburban houses,
   streetlights, fences.  Used by home / drive / stand.
   ================================================================ */
/* environment map from a sky mesh (so outdoor PBR picks up the real sky colours) */
function envFromSky(sky,extra){
  const s=new THREE.Scene(); const sk=sky.clone(); sk.material=sky.material; s.add(sk);
  if(extra) extra(s);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshBasicMaterial({color:col(extra&&extra.ground||0x2a2418)})); g.rotation.x=-Math.PI/2; g.position.y=-2; s.add(g);
  const rt=pmrem.fromScene(s,.03); return rt.texture;
}
/* planes whose texture tiles every `tile` metres */
function tiledPlane(w,d,m,tile,x=0,y=0,z=0){ const set={}; for(const k of ['map','normalMap','roughnessMap']) if(m[k]){ m[k]=m[k].clone(); m[k].needsUpdate=true; m[k].repeat.set(w/tile,d/tile); } const p=mesh(new THREE.PlaneGeometry(w,d),m,x,y,z,false); p.rotation.x=-Math.PI/2; p.receiveShadow=true; m.polygonOffset=true; m.polygonOffsetFactor=2; m.polygonOffsetUnits=6; return p; }  // pushed back a hair so floors laid on top never flicker
function texMat(set,rx,ry,o={}){ const r=repeatSet(set,rx,ry); const base={roughness:1}; for(const k of ['map','normalMap','roughnessMap']) if(r[k]) base[k]=r[k]; return new (o.physical?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial)(Object.assign(base,o.opts||{})); }
/* ---------- common surface textures ---------- */
const TX={
  grass:()=>texSet('grassG',512,(x,w,h)=>{ speckle(x,w,h,'#3f6e2a',['#37632a','#4a7d32','#2f5a22','#56893a','#6a8a3a','#5a7a30'],70000,2); blotches(x,w,h,'rgba(90,70,40,A)',30,8,30,.25); blotches(x,w,h,'rgba(30,70,20,A)',25,20,60,.3); },{strength:1.8,rough:(x,w,h)=>{ x.fillStyle='#d8d8d8'; x.fillRect(0,0,w,h); }}),
  concrete:()=>texSet('concr',512,(x,w,h)=>{ speckle(x,w,h,'#a9a59c',['#9d9990','#b5b1a8','#8f8b83','#bcb8af'],60000,1.5); blotches(x,w,h,'rgba(80,75,65,A)',18,10,50,.12); x.strokeStyle='rgba(60,58,52,.8)'; x.lineWidth=3; x.strokeRect(1,1,w-2,h-2); for(let i=0;i<5;i++){ x.strokeStyle='rgba(50,48,44,.35)'; x.lineWidth=1; x.beginPath(); let px=rand(0,w),py=rand(0,h); x.moveTo(px,py); for(let k=0;k<6;k++){ px+=rand(-30,30); py+=rand(-30,30); x.lineTo(px,py); } x.stroke(); } },{strength:1.6,rough:(x,w,h)=>{ x.fillStyle='#e0e0e0'; x.fillRect(0,0,w,h); blotches(x,w,h,'rgba(120,120,120,A)',20,20,60,.4); }}),
  asphalt:()=>texSet('asph',512,(x,w,h)=>{ speckle(x,w,h,'#3a3c3f',['#323437','#46484b','#2a2c2f','#57595c','#4a4a46','#606266'],90000,1.5); blotches(x,w,h,'rgba(15,15,18,A)',20,10,60,.25); x.strokeStyle='rgba(20,20,22,.6)'; x.lineWidth=2; for(let i=0;i<5;i++){ x.beginPath(); let px=rand(0,w),py=rand(0,h); x.moveTo(px,py); for(let k=0;k<6;k++){ px+=rand(-40,40); py+=rand(-40,40); x.lineTo(px,py);} x.stroke(); } },{strength:1.4,rough:(x,w,h)=>{ x.fillStyle='#d0d0d0'; x.fillRect(0,0,w,h); blotches(x,w,h,'rgba(90,90,90,A)',14,20,70,.5); }}),
  siding:()=>texSet('siding',256,(x,w,h)=>{ for(let r=0;r<10;r++){ const y=r*25.6; const g=x.createLinearGradient(0,y,0,y+25.6); g.addColorStop(0,'#fafafa'); g.addColorStop(.85,'#dcdcdc'); g.addColorStop(1,'#8a8a8a'); x.fillStyle=g; x.fillRect(0,y,w,25.6); } for(let i=0;i<2000;i++){ x.fillStyle=`rgba(0,0,0,${Math.random()*.04})`; x.fillRect(rand(0,w),rand(0,h),2,1); } },{strength:2.4}),
  shingles:()=>texSet('shing',256,(x,w,h)=>{ x.fillStyle='#3a3a3a'; x.fillRect(0,0,w,h); for(let r=0;r<8;r++){ const y=r*32, off=(r%2)*20; for(let c=-1;c<8;c++){ const tn=55+Math.random()*30; x.fillStyle=`rgb(${tn},${tn-4},${tn-8})`; x.fillRect(c*40+off+1,y+1,38,30); x.fillStyle='rgba(0,0,0,.45)'; x.fillRect(c*40+off,y+28,40,4); } } },{strength:2.6}),
  brick:()=>texSet('brick',256,(x,w,h)=>{ x.fillStyle='#b8b0a4'; x.fillRect(0,0,w,h); for(let r=0;r<16;r++){ const off=(r%2)*16; for(let c=-1;c<9;c++){ const tn=[150,130,165,120,140][(Math.random()*5)|0]; x.fillStyle=`rgb(${tn},${tn*.45|0},${tn*.35|0})`; x.fillRect(c*32+off+1,r*16+1,30,14); } } },{strength:2.4}),
  bark:()=>texSet('bark',[128,256],(x,w,h)=>{ x.fillStyle='#5a4636'; x.fillRect(0,0,w,h); for(let i=0;i<120;i++){ x.strokeStyle=`rgba(${rand(20,40)},${rand(15,30)},${rand(10,20)},${rand(.4,.8)})`; x.lineWidth=rand(1,4); x.beginPath(); let px=rand(0,w); x.moveTo(px,0); for(let y=0;y<=h;y+=16){ px+=rand(-3,3); x.lineTo(px,y); } x.stroke(); } speckle(x,0,0,'#0000',['#0000'],0); },{strength:3}),
  carpet:()=>texSet('carpet',256,(x,w,h)=>{ speckle(x,w,h,'#8a7a6a',['#7e6e5e','#96867a','#72624f','#9e8e80'],30000,1); },{strength:1}),
  plaster:()=>texSet('plaster',256,(x,w,h)=>{ speckle(x,w,h,'#e6e0d4',['#ded8cc','#ece6da','#d8d2c4'],9000,2); blotches(x,w,h,'rgba(150,140,120,A)',10,20,70,.04); },{strength:.6}),
  metalBrushed:()=>texSet('brushed',256,(x,w,h)=>{ x.fillStyle='#c8ccd0'; x.fillRect(0,0,w,h); for(let i=0;i<900;i++){ const v=Math.random()<.5?255:120; x.fillStyle=`rgba(${v},${v},${v},.08)`; x.fillRect(0,Math.random()*h,w,1); } },{strength:.4,rough:(x,w,h)=>{ x.fillStyle='#707070'; x.fillRect(0,0,w,h); for(let i=0;i<400;i++){ const v=Math.random()<.5?160:60; x.fillStyle=`rgba(${v},${v},${v},.3)`; x.fillRect(0,Math.random()*h,w,1); } }}),
  diamondPlate:()=>texSet('dplate',256,(x,w,h)=>{ x.fillStyle='#9a9ea4'; x.fillRect(0,0,w,h); for(let j=0;j<8;j++) for(let i=0;i<8;i++){ x.save(); x.translate(i*32+16+(j%2)*16,j*32+16); x.rotate((i+j)%2?.6:-.6); const g=x.createLinearGradient(-10,0,10,0); g.addColorStop(0,'#d8dce0'); g.addColorStop(1,'#6a6e74'); x.fillStyle=g; x.beginPath(); x.ellipse(0,0,11,3,0,0,7); x.fill(); x.restore(); } },{strength:3,rough:(x,w,h)=>{ x.fillStyle='#606060'; x.fillRect(0,0,w,h); }})
};
/* ---------- the car ---------- */
/* makeCar + spinWheels: see 10b_car.js */

/* ---------- foliage: instanced leaf cards with wind ---------- */
function leafTex(hue=0){
  const key='leaf'+hue; if(TEXCACHE[key]) return TEXCACHE[key];
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  x.clearRect(0,0,256,256);
  for(let i=0;i<60;i++){ const px=rand(24,232), py=rand(24,232), a=rand(0,6.28), L=rand(20,34), W=L*rand(.38,.5); x.save(); x.translate(px,py); x.rotate(a);
    const gg=x.createLinearGradient(-L/2,0,L/2,0); const base=[[62,112,40],[80,128,46],[52,98,34],[96,140,52]][(Math.random()*4)|0]; const k=rand(.8,1.15);
    gg.addColorStop(0,`rgb(${base[0]*k*.8+hue},${base[1]*k*.8},${base[2]*k*.8})`); gg.addColorStop(1,`rgb(${base[0]*k*1.1+hue},${base[1]*k*1.1},${base[2]*k})`);
    x.fillStyle=gg; x.beginPath(); x.moveTo(-L/2,0); x.quadraticCurveTo(0,-W,L/2,0); x.quadraticCurveTo(0,W,-L/2,0); x.fill();
    x.strokeStyle='rgba(30,50,20,.45)'; x.lineWidth=1; x.beginPath(); x.moveTo(-L/2,0); x.lineTo(L/2,0); x.stroke(); x.restore(); }
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAX_ANISO; TEXCACHE[key]=t; return t;
}
const WIND={time:{value:0},strength:{value:1}};
function windify(m,amount=1,mode='leaf'){
  m.onBeforeCompile=sh=>{
    sh.uniforms.uTime=WIND.time; sh.uniforms.uWind=WIND.strength;
    sh.vertexShader='uniform float uTime; uniform float uWind;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 wp0=instanceMatrix*vec4(0.0,0.0,0.0,1.0);
      #else
        vec4 wp0=vec4(0.0,0.0,0.0,1.0);
      #endif
      vec4 wpw=modelMatrix*wp0;
      float ph=wpw.x*0.35+wpw.z*0.27;
      ${mode==='grass'?'float hk=clamp(position.y,0.0,1.0); hk*=hk;':'float hk=1.0;'}
      transformed.x+=sin(uTime*1.9+ph)*0.06*${amount.toFixed(3)}*uWind*hk+sin(uTime*4.7+ph*3.0)*0.015*${amount.toFixed(3)}*hk;
      transformed.z+=cos(uTime*1.5+ph*1.3)*0.05*${amount.toFixed(3)}*uWind*hk;`);
  };
  m.customProgramCacheKey=()=>'wind'+mode+amount;
  return m;
}
/* a forest of trees in one go: trunks merged, leaf cards in one InstancedMesh */
function makeTrees(scene,spots,o={}){
  const bark=TX.bark(); const br=repeatSet(bark,1,3);
  const trunkM=new THREE.MeshStandardMaterial({map:br.map,normalMap:br.normalMap,roughness:.95});
  const leafM=windify(new THREE.MeshStandardMaterial({map:leafTex(o.hue||0),alphaTest:.45,side:THREE.DoubleSide,roughness:.75,color:col(o.tint||0xffffff)}),1);
  const B=new Builder(); const cards=[]; const r=RNG(o.seed||31);
  const perTree=dq(34,50,85,120,170);
  for(const s of spots){
    const h=s.h||rand(5,8), rr=s.r||h*.07;
    B.add(new THREE.CylinderGeometry(rr*.55,rr,h*.62,9,1),trunkM,s.x,h*.31,s.z,0,rand(0,6),0);
    for(let b=0;b<4;b++){ const a=rand(0,6.28), L=h*.3, y=h*rand(.45,.62); const bg=new THREE.CylinderGeometry(rr*.18,rr*.35,L,6); bg.translate(0,L/2,0); B.add(bg,trunkM,s.x,y,s.z,Math.cos(a)*.9,0,Math.sin(a)*.9); }
    const cy=h*.72, cr=s.cr||h*.36;
    for(let i=0;i<perTree;i++){
      let dx,dy,dz; do{ dx=r()*2-1; dy=r()*2-1; dz=r()*2-1; }while(dx*dx+dy*dy+dz*dz>1);
      const p=V3(s.x+dx*cr,cy+dy*cr*.8,s.z+dz*cr);
      const sz=rand(1.1,1.9)*(cr/2.4);
      cards.push({p,sz,rot:[r()*6.28,r()*6.28,r()*6.28],shade:.6+.4*((dy+1)/2)});
    }
  }
  // trees: you bump into the trunk; bushes (and low crowns): you bump into the whole bush
  if(BUILDING_LV&&!o.noCol){ const lv=BUILDING_LV; let toW=null; if(!scene.isScene){ scene.updateMatrixWorld(true); toW=scene; }
    for(const s of spots){ const h=s.h||6, cr=s.cr||h*.36, rr=s.r||h*.07; const low=h*.72-cr*.8<1.7; const p=toW?toW.localToWorld(V3(s.x,0,s.z)):V3(s.x,0,s.z); colCircle(lv.col,p.x,p.z,low?cr*.8:rr+.1); } }
  const trunks=B.build(true,true); scene.add(trunks);
  const geo=new THREE.PlaneGeometry(1,1);
  const im=new THREE.InstancedMesh(geo,leafM,cards.length); im.castShadow=true; im.receiveShadow=true;
  const dm=new THREE.Object3D(), c=new THREE.Color();
  cards.forEach((cd,i)=>{ dm.position.copy(cd.p); dm.rotation.set(...cd.rot); dm.scale.setScalar(cd.sz); dm.updateMatrix(); im.setMatrixAt(i,dm.matrix); c.setRGB(cd.shade,cd.shade,cd.shade*.9); im.setColorAt(i,c); });
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true;
  scene.add(im);
  return {trunks,leaves:im};
}
/* bushes: squat leaf clusters */
function makeBushes(scene,spots,o={}){ return makeTrees(scene,spots.map(s=>({x:s.x,z:s.z,h:s.h||1.2,r:.01,cr:s.r||.8})),o); }
/* grass: instanced curved blades with wind, coloured root->tip */
function makeGrass(scene,area,count,o={}){
  if(count<=0) return null;
  const bg=GC('blade',()=>{ const g=new THREE.PlaneGeometry(.06,1,1,4); const p=g.attributes.position; const colA=[]; for(let i=0;i<p.count;i++){ const y=p.getY(i)+.5; p.setY(i,y); p.setX(i,p.getX(i)*(1-y*.9)); p.setZ(i,y*y*.18); colA.push(.35+y*.65,.45+y*.55,.3+y*.35); } g.setAttribute('color',new THREE.Float32BufferAttribute(colA,3)); g.computeVertexNormals(); return g; });
  const m=windify(new THREE.MeshStandardMaterial({color:col(o.color||0x4f8a34),vertexColors:true,side:THREE.DoubleSide,roughness:.8}),1.4,'grass');
  const im=new THREE.InstancedMesh(bg,m,count); im.receiveShadow=true; im.castShadow=false;
  const dm=new THREE.Object3D(), c=new THREE.Color(), r=RNG(o.seed||5);
  let n=0;
  for(let i=0;i<count*3 && n<count;i++){
    const x=area.x0+r()*(area.x1-area.x0), z=area.z0+r()*(area.z1-area.z0);
    if(area.skip && area.skip(x,z)) continue;
    const y=area.ground?area.ground(x,z):0;
    dm.position.set(x,y,z); dm.rotation.set(rand(-.15,.15),r()*6.28,rand(-.15,.15)); const h=(o.h||.28)*(.55+r()*.9); dm.scale.set(1+r(),h,1); dm.updateMatrix();
    im.setMatrixAt(n,dm.matrix); const k=.75+r()*.45+noise2(x*.2,z*.2)*.25; c.setRGB(k*(o.dry?1.1:.9),k,k*.8); im.setColorAt(n,c); n++;
  }
  im.count=n; im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true;
  scene.add(im); return im;
}
/* ---------- suburban house (exterior) ---------- */
function makeHouse(o={}){
  const opt=Object.assign({w:9,d:8,h:3,color:0xe8e2d4,roof:0x4a4a4a,trim:0xf5f2ea,door:0x6a2a20,night:0,seed:1,floors:1},o);
  const r=RNG(opt.seed);
  const g=new THREE.Group();
  const sid=TX.siding(), sh=TX.shingles();
  const wallM=new THREE.MeshStandardMaterial({color:col(opt.color),map:repeatSet(sid,opt.w/2.2,opt.h*opt.floors/1.6).map,normalMap:repeatSet(sid,opt.w/2.2,opt.h*opt.floors/1.6).normalMap,roughness:.85});
  const roofM=new THREE.MeshStandardMaterial({color:col(opt.roof),map:repeatSet(sh,opt.w/2,3).map,normalMap:repeatSet(sh,opt.w/2,3).normalMap,roughness:.9});
  const trimM=mat(opt.trim,{roughness:.6});
  const H=opt.h*opt.floors;
  g.add(box(opt.w,H,opt.d,wallM,0,H/2,0));
  // gable roof
  const rh=opt.w*.32; const rs=new THREE.Shape(); rs.moveTo(-opt.w/2-.4,0); rs.lineTo(0,rh); rs.lineTo(opt.w/2+.4,0); rs.closePath();
  const rg=new THREE.ExtrudeGeometry(rs,{depth:opt.d+.8,bevelEnabled:false}); rg.translate(0,H,-opt.d/2-.4);
  g.add(mesh(rg,roofM));
  g.add(box(opt.w+.9,.18,opt.d+.9,trimM,0,H,0));
  if(r()<.7) g.add(box(.7,1.6,.7,new THREE.MeshStandardMaterial({map:repeatSet(TX.brick(),.6,1.2).map,roughness:.9}),opt.w*.25,H+rh*.6,-opt.d*.15));
  // windows (warm glow at night) + door on the front (+z)
  const winGlow=emissiveMat(0xffcf8a,opt.night*2.2,{roughness:.2});
  const winM=opt.night>0?winGlow:new THREE.MeshPhysicalMaterial({color:col(0x2a3540),roughness:.05,metalness:.3,clearcoat:1});
  const wins=[];
  for(let f=0;f<opt.floors;f++) for(const x of [-opt.w*.3,opt.w*.3]){ if(f===0&&Math.abs(x)<1.2) continue; const wy=f*opt.h+1.6; g.add(box(1.3,1.25,.08,trimM,x,wy,opt.d/2+.02)); const w=box(1.1,1.05,.06,winM,x,wy,opt.d/2+.05,false); g.add(w); wins.push(w); g.add(box(.06,1.05,.08,trimM,x,wy,opt.d/2+.07)); g.add(box(1.1,.06,.08,trimM,x,wy,opt.d/2+.07)); for(const sx of [-.8,.8]) g.add(box(.35,1.3,.06,mat(opt.door,{roughness:.7}),x+sx,wy,opt.d/2+.06)); }
  g.add(box(1.2,2.3,.1,trimM,0,1.15,opt.d/2+.03)); g.add(box(1,2.15,.1,mat(opt.door,{roughness:.55}),0,1.08,opt.d/2+.06));
  g.add(sph(.05,mat(0xd4af37,{metalness:1,roughness:.25}),.35,1.05,opt.d/2+.13,10,8));
  g.add(box(2.6,.2,1.6,mat(0x9a948a,{roughness:.9}),0,.1,opt.d/2+.8));
  g.userData={wins,winGlow};
  return g;
}
/* streetlight (bulb glows; optionally a real point light) */
function makeStreetlight(on=0,light=false){
  const g=new THREE.Group(); const pole=mat(0x3a3e44,{metalness:.6,roughness:.45});
  g.add(cyl(.07,.1,5.2,pole,0,2.6,0,10)); const arm=cyl(.05,.05,1.4,pole,.6,5.1,0,8); arm.rotation.z=Math.PI/2; g.add(arm);
  g.add(rbox(.6,.16,.32,.05,pole,1.25,5.05,0)); const bulb=box(.46,.04,.24,emissiveMat(0xffd49a,on*6),1.25,4.96,0,false); g.add(bulb);
  if(light&&on>0){ const pl=new THREE.PointLight(col(0xffc88a),on*1.4,16,2); pl.position.set(1.25,4.7,0); g.add(pl); }
  g.userData.bulb=bulb; return g;
}
function makeFence(len,m){ const B=new Builder(); const n=Math.floor(len/.18); for(let i=0;i<n;i++) B.box(.1,1,.03,m,-len/2+i*.18,.5,0); B.box(len,.08,.05,m,0,.8,-.03); B.box(len,.08,.05,m,0,.25,-.03); return B.build(); }
function makeMailbox(){ const g=new THREE.Group(); g.add(box(.08,1.1,.08,mat(0x5a4636),0,.55,0)); const mb=rbox(.3,.28,.5,.1,mat(0x2a3a5a,{metalness:.5,roughness:.4}),0,1.2,0); g.add(mb); g.add(box(.03,.18,.12,mat(0xc0281e),.17,1.28,.1)); return g; }

